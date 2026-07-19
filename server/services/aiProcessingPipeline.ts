import { AssemblyAIService, formatDiarizedTranscript, type SpeakerUtterance } from './assemblyAIService';
import { TranscriptCorrectionService } from './transcriptCorrectionService';
import { IStorage } from '../storage';
import { logAuditEvent } from '../auditMiddleware';
import { buildKeytermsConfig } from './legalVocabulary';
import { deriveDocumentsFromTranscript } from './transcriptDerivationService';

export interface AIProcessingResult {
  success: boolean;
  caseId: string;
  transcriptId?: string;
  documentIds?: {
    summary: string;
    attendanceNote: string;
  };
  totalCost: number;
  error?: string;
}

export interface ProcessingMetadata {
  status: 'idle' | 'transcribing' | 'generating_documents' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep?: string;
  transcriptionCost?: number;
  documentGenerationCost?: number;
  totalCost?: number;
  totalTokens?: {
    input: number;
    output: number;
  };
  error?: string;
  completedAt?: string;
}

export class AIProcessingPipeline {
  private assemblyAIService: AssemblyAIService;
  private correctionService: TranscriptCorrectionService;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.assemblyAIService = new AssemblyAIService();
    this.correctionService = new TranscriptCorrectionService();
    this.storage = storage;
    console.log('[AI Pipeline] AssemblyAI service initialized — speaker diarization enabled');
  }

  private async getLatestSessionForCase(caseId: string, userId: string): Promise<{ recordingType: string; sessionId: string | null }> {
    try {
      const sessions = await this.storage.getMeetingSessionsByCase(caseId, userId);
      if (sessions.length > 0) {
        return {
          recordingType: sessions[0].recordingType || 'full_meeting',
          sessionId: sessions[0].id,
        };
      }
    } catch (e) {
    }
    return { recordingType: 'full_meeting', sessionId: null };
  }

  /**
   * Process a case: transcribe audio → generate documents
   */
  async processCase(caseId: string, userId: string, sessionId?: string): Promise<AIProcessingResult> {
    console.log(`Starting AI processing for case ${caseId}${sessionId ? ` (session ${sessionId})` : ''}`);

    try {
      const caseData = await this.storage.getCase(caseId, userId);
      if (!caseData) {
        throw new Error('Case not found');
      }

      let audio;
      if (sessionId) {
        audio = await this.storage.getAudioRecordingBySession(sessionId);
      }
      if (!audio) {
        audio = await this.storage.getAudioRecordingByCase(caseId, userId);
      }
      if (!audio) {
        throw new Error('No audio recording found for case');
      }

      if (!audio.filePath) {
        throw new Error('Audio file path not found');
      }

      // Update status: processing started
      await this.updateProcessingStatus(caseId, userId, {
        status: 'transcribing',
        progress: 10,
        currentStep: 'Downloading audio file...',
      });

      await logAuditEvent(userId, "ai_processing_started", {
        caseId,
        audioRecordingId: audio.id,
        metadata: { audioId: audio.id },
      });

      // Step 1: Transcribe audio (with diarization if AssemblyAI available)
      console.log(`Transcribing audio for case ${caseId}...`);
      await this.updateProcessingStatus(caseId, userId, {
        status: 'transcribing',
        progress: 20,
        currentStep: 'Converting speech to text with speaker identification...',
      });

      let transcriptText: string;
      let transcriptUtterances: SpeakerUtterance[] = [];
      let speakerCount: number | undefined;
      let transcriptionCost: number;

      // Resolve session type early so it can be passed to the keyterms config for native prompting
      let earlySessionType: string | undefined;
      if (sessionId) {
        try {
          const earlySession = await this.storage.getMeetingSession(sessionId);
          earlySessionType = earlySession?.recordingType || undefined;
        } catch {
        }
      }
      if (!earlySessionType) {
        try {
          const sessions = await this.storage.getMeetingSessionsByCase(caseId, userId);
          earlySessionType = sessions[0]?.recordingType || undefined;
        } catch {
        }
      }

      const keytermsConfig = buildKeytermsConfig({
        clientName: caseData.clientName,
        title: caseData.title,
        matterReference: caseData.matterReference || undefined,
        practiceArea: caseData.practiceArea || undefined,
        sessionType: earlySessionType,
      });

      const diarizedResult = await this.assemblyAIService.transcribeWithDiarization(
        audio.filePath,
        audio.duration || 0,
        undefined,
        keytermsConfig
      );
      transcriptText = diarizedResult.text;
      transcriptUtterances = diarizedResult.utterances;
      speakerCount = diarizedResult.speakerCount;
      transcriptionCost = diarizedResult.cost;
      console.log(`[Diarization] Detected ${speakerCount} speakers, ${transcriptUtterances.length} utterances`);

      // Step 1.5: Apply GPT post-processing for context-aware error correction
      await this.updateProcessingStatus(caseId, userId, {
        status: 'transcribing',
        progress: 35,
        currentStep: 'Applying context-aware corrections...',
      });

      let correctionCost = 0;
      try {
        const textToCorrect = transcriptUtterances.length > 0
          ? formatDiarizedTranscript(transcriptUtterances)
          : transcriptText;
        
        const correctionResult = await this.correctionService.correctTranscript(
          textToCorrect,
          {
            clientName: caseData.clientName,
            matterReference: caseData.matterReference || undefined,
            caseTitle: caseData.title,
          }
        );

        // Account for the correction pass even when it correctly determines
        // that no changes are required.
        correctionCost = correctionResult.cost;
        if (correctionResult.corrections.length > 0) {
          transcriptText = correctionResult.correctedText;
          console.log(`[AI Pipeline] Applied ${correctionResult.corrections.length} corrections`);
          // Note: We intentionally do NOT update transcriptUtterances with corrected text.
          // The utterances preserve original timing/speaker/confidence data from AssemblyAI.
          // Corrected text is used for document generation via transcriptText.
          // Attempting to re-align corrected text to utterances by index is fragile
          // if GPT adds/removes/merges segments.
        }
      } catch (correctionError) {
        console.warn('[AI Pipeline] Correction pass failed, using original transcript:', correctionError);
      }
      
      transcriptionCost += correctionCost;

      let sessionInfo: { recordingType: string; sessionId: string | null };
      if (sessionId) {
        const session = await this.storage.getMeetingSession(sessionId);
        sessionInfo = {
          recordingType: session?.recordingType || 'full_meeting',
          sessionId,
        };
      } else {
        sessionInfo = await this.getLatestSessionForCase(caseId, userId);
      }

      // Save transcript with diarization data if available
      const transcript = await this.storage.createTranscript({
        caseId,
        content: transcriptText,
        utterances: transcriptUtterances.length > 0 ? transcriptUtterances : undefined,
        speakerCount: speakerCount,
        meetingSessionId: sessionInfo.sessionId ?? undefined,
      });

      await logAuditEvent(userId, "transcription_completed", {
        caseId,
        transcriptId: transcript.id,
        metadata: {
          textLength: transcriptText.length,
          cost: transcriptionCost,
          hasDiarization: transcriptUtterances.length > 0,
          speakerCount: speakerCount,
        },
      });

      // Step 2+: Derive attendance note + client letter via shared derivation engine
      const deriveResult = await deriveDocumentsFromTranscript({
        storage: this.storage,
        caseId,
        userId,
        transcriptId: transcript.id,
        sessionId: sessionInfo.sessionId,
        recordingType: sessionInfo.recordingType,
        meetingTimestamp: audio.recordedAt ? new Date(audio.recordedAt) : undefined,
        durationSeconds: audio.duration ?? null,
        generateClientLetter: true,
        transcriptionCost,
      });

      if (!deriveResult.success) {
        throw new Error(deriveResult.error || 'Document derivation failed');
      }

      console.log(`AI processing completed for case ${caseId}. Total cost: $${deriveResult.totalCost.toFixed(4)}`);

      return {
        success: true,
        caseId,
        transcriptId: transcript.id,
        documentIds: {
          summary: deriveResult.documentIds.clientLetter ?? '',
          attendanceNote: deriveResult.documentIds.attendanceNote,
        },
        totalCost: deriveResult.totalCost,
      };
    } catch (error: any) {
      console.error(`AI processing failed for case ${caseId}:`, error);

      // Log failure
      await logAuditEvent(userId, "ai_processing_failed", {
        caseId,
        metadata: { error: error.message },
        severity: "critical",
      });

      // Update status with error
      await this.updateProcessingStatus(caseId, userId, {
        status: 'failed',
        progress: 0,
        error: error.message,
      });

      return {
        success: false,
        caseId,
        totalCost: 0,
        error: error.message,
      };
    }
  }

  /**
   * Update case processing metadata
   */
  private async updateProcessingStatus(
    caseId: string,
    userId: string,
    metadata: Partial<ProcessingMetadata>
  ): Promise<void> {
    const caseData = await this.storage.getCase(caseId, userId);
    if (!caseData) return;

    const currentMetadata = (caseData.aiProcessingMetadata as ProcessingMetadata) || {};
    const updatedMetadata = { ...currentMetadata, ...metadata };

    const caseUpdate: { aiProcessingMetadata: ProcessingMetadata; status?: string } = {
      aiProcessingMetadata: updatedMetadata,
    };
    if (metadata.status === 'failed') {
      caseUpdate.status = 'failed';
    }

    await this.storage.updateCase(caseId, caseUpdate, userId);
  }
}

