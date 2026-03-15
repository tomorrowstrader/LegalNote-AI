import { TranscriptionService } from './transcriptionService';
import { AssemblyAIService, formatDiarizedTranscript, type SpeakerUtterance, type WordBoostConfig } from './assemblyAIService';
import { DocumentService } from './documentService';
import { TranscriptCorrectionService } from './transcriptCorrectionService';
import { IStorage } from '../storage';
import { auditLogger, AuditEventType } from '../auditLog';
import { buildWordBoostList } from './legalVocabulary';

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
  private transcriptionService: TranscriptionService;
  private assemblyAIService: AssemblyAIService | null = null;
  private documentService: DocumentService;
  private correctionService: TranscriptCorrectionService;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.transcriptionService = new TranscriptionService();
    this.documentService = new DocumentService();
    this.correctionService = new TranscriptCorrectionService();
    this.storage = storage;

    if (process.env.ASSEMBLYAI_API_KEY) {
      try {
        this.assemblyAIService = new AssemblyAIService();
        console.log('[AI Pipeline] AssemblyAI service initialized - speaker diarization enabled');
      } catch (error) {
        console.warn('[AI Pipeline] AssemblyAI not available, falling back to Whisper (no diarization)');
      }
    } else {
      console.log('[AI Pipeline] No AssemblyAI key - using Whisper transcription (no diarization)');
    }
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

      auditLogger.log({
        eventType: AuditEventType.AI_PROCESSING_STARTED,
        userId,
        resourceId: caseId,
        resourceType: 'case',
        details: { audioId: audio.id },
        severity: 'medium',
      });

      // Step 1: Transcribe audio (with diarization if AssemblyAI available)
      console.log(`Transcribing audio for case ${caseId}...`);
      await this.updateProcessingStatus(caseId, userId, {
        status: 'transcribing',
        progress: 20,
        currentStep: this.assemblyAIService 
          ? 'Converting speech to text with speaker identification...'
          : 'Converting speech to text...',
      });

      let transcriptText: string;
      let transcriptUtterances: SpeakerUtterance[] = [];
      let speakerCount: number | undefined;
      let transcriptionCost: number;

      const wordBoostList = buildWordBoostList({
        clientName: caseData.clientName,
        title: caseData.title,
        matterReference: caseData.matterReference || undefined,
        practiceArea: caseData.practiceArea || undefined,
      });
      const wordBoostConfig: WordBoostConfig = {
        words: wordBoostList,
        boost: 'high',
      };

      if (this.assemblyAIService) {
        try {
          const diarizedResult = await this.assemblyAIService.transcribeWithDiarization(
            audio.filePath,
            audio.duration || 0,
            undefined,
            wordBoostConfig
          );
          transcriptText = diarizedResult.text;
          transcriptUtterances = diarizedResult.utterances;
          speakerCount = diarizedResult.speakerCount;
          transcriptionCost = diarizedResult.cost;
          console.log(`[Diarization] Detected ${speakerCount} speakers, ${transcriptUtterances.length} utterances`);
        } catch (assemblyError) {
          console.error('[AI Pipeline] AssemblyAI transcription failed, falling back to Whisper:', assemblyError);
          await this.updateProcessingStatus(caseId, userId, {
            status: 'transcribing',
            progress: 25,
            currentStep: 'Retrying with alternative transcription service...',
          });
          const whisperResult = await this.transcriptionService.transcribeAudio(
            audio.filePath,
            audio.duration || 0,
            audio.mimeType || undefined
          );
          transcriptText = whisperResult.text;
          transcriptionCost = whisperResult.cost;
        }
      } else {
        const whisperResult = await this.transcriptionService.transcribeAudio(
          audio.filePath,
          audio.duration || 0,
          audio.mimeType || undefined
        );
        transcriptText = whisperResult.text;
        transcriptionCost = whisperResult.cost;
      }

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
        
        if (correctionResult.corrections.length > 0) {
          transcriptText = correctionResult.correctedText;
          correctionCost = correctionResult.cost;
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

      auditLogger.log({
        eventType: AuditEventType.AI_TRANSCRIPTION_COMPLETED,
        userId,
        resourceId: transcript.id,
        resourceType: 'transcript',
        details: { 
          caseId,
          textLength: transcriptText.length,
          cost: transcriptionCost,
          hasDiarization: transcriptUtterances.length > 0,
          speakerCount: speakerCount,
        },
        severity: 'medium',
      });

      await this.updateProcessingStatus(caseId, userId, {
        status: 'generating_documents',
        progress: 40,
        currentStep: 'Generating summary...',
        transcriptionCost: transcriptionCost,
      });

      // For document generation, use formatted diarized transcript if available
      const transcriptForDocGen = transcriptUtterances.length > 0
        ? formatDiarizedTranscript(transcriptUtterances)
        : transcriptText;

      // Step 2: Generate documents
      const metadata = {
        title: caseData.title,
        clientName: caseData.clientName,
        matterReference: caseData.matterReference || undefined,
        recordingDate: new Date().toISOString().split('T')[0],
        templateId: caseData.templateId || undefined,
        practiceArea: caseData.practiceArea || undefined,
      };

      // Generate summary
      console.log(`Generating summary for case ${caseId}...`);
      const summaryResult = await this.documentService.generateSummary(
        transcriptForDocGen,
        metadata
      );

      await this.updateProcessingStatus(caseId, userId, {
        status: 'generating_documents',
        progress: 50,
        currentStep: 'Verifying summary against transcript...',
      });

      const summaryVerification = await this.documentService.verifyDocumentAgainstTranscript(
        summaryResult.content,
        transcriptForDocGen
      );

      const summaryDoc = await this.storage.createDocument({
        caseId,
        transcriptSnapshotId: transcript.id,
        type: 'summary',
        content: summaryResult.content,
        version: 1,
        versionType: 'ai_generated',
        createdBy: userId,
        isActive: true,
        verificationWarnings: summaryVerification.warnings.length > 0 ? summaryVerification.warnings : undefined,
        isShortRecording: summaryResult.isShortRecording || false,
        meetingSessionId: sessionInfo.sessionId ?? undefined,
      });

      auditLogger.log({
        eventType: AuditEventType.AI_DOCUMENT_GENERATED,
        userId,
        resourceId: summaryDoc.id,
        resourceType: 'document',
        details: { 
          caseId,
          documentType: 'summary',
          inputTokens: summaryResult.inputTokens,
          outputTokens: summaryResult.outputTokens,
          cost: summaryResult.cost,
        },
        severity: 'medium',
      });

      await this.updateProcessingStatus(caseId, userId, {
        status: 'generating_documents',
        progress: 60,
        currentStep: 'Generating attendance note...',
      });

      // Get firm preferences for document generation
      const firmProfile = await this.storage.getFirmProfile();
      const firmPreferences = {
        includeLocation: firmProfile?.includeLocation ?? true,
        showFullSolicitorName: firmProfile?.showFullSolicitorName ?? true,
        includeClientConfirmation: firmProfile?.includeClientConfirmation ?? false,
      };

      const recordingType = sessionInfo.recordingType;
      console.log(`Generating attendance note for case ${caseId} (recording type: ${recordingType}, session: ${sessionInfo.sessionId})...`);
      const attendanceResult = await this.documentService.generateDocumentByRecordingType(
        recordingType,
        transcriptForDocGen,
        metadata,
        firmPreferences,
        transcriptUtterances.length > 0 ? transcriptUtterances : undefined
      );

      await this.updateProcessingStatus(caseId, userId, {
        status: 'generating_documents',
        progress: 75,
        currentStep: 'Verifying attendance note against transcript...',
      });

      const attendanceVerification = await this.documentService.verifyDocumentAgainstTranscript(
        attendanceResult.content,
        transcriptForDocGen
      );

      const attendanceDoc = await this.storage.createDocument({
        caseId,
        transcriptSnapshotId: transcript.id,
        type: 'attendance_note',
        content: attendanceResult.content,
        version: 1,
        versionType: 'ai_generated',
        createdBy: userId,
        isActive: true,
        verificationWarnings: attendanceVerification.warnings.length > 0 ? attendanceVerification.warnings : undefined,
        isShortRecording: attendanceResult.isShortRecording || false,
        meetingSessionId: sessionInfo.sessionId ?? undefined,
      });

      auditLogger.log({
        eventType: AuditEventType.AI_DOCUMENT_GENERATED,
        userId,
        resourceId: attendanceDoc.id,
        resourceType: 'document',
        details: { 
          caseId,
          documentType: 'attendance_note',
          inputTokens: attendanceResult.inputTokens,
          outputTokens: attendanceResult.outputTokens,
          cost: attendanceResult.cost,
        },
        severity: 'medium',
      });

      const verificationCost = summaryVerification.cost + attendanceVerification.cost;

      const totalCost = transcriptionCost + 
                       summaryResult.cost + 
                       attendanceResult.cost +
                       verificationCost;

      const totalTokens = {
        input: summaryResult.inputTokens + attendanceResult.inputTokens + summaryVerification.inputTokens + attendanceVerification.inputTokens,
        output: summaryResult.outputTokens + attendanceResult.outputTokens + summaryVerification.outputTokens + attendanceVerification.outputTokens,
      };

      // Update final status
      await this.updateProcessingStatus(caseId, userId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Processing complete',
        transcriptionCost: transcriptionCost,
        documentGenerationCost: summaryResult.cost + attendanceResult.cost + verificationCost,
        totalCost,
        totalTokens,
        completedAt: new Date().toISOString(),
      });

      // Update case status to review_required
      await this.storage.updateCase(caseId, { status: 'review_required' }, userId);

      if (sessionInfo.sessionId) {
        try {
          await this.storage.updateMeetingSession(sessionInfo.sessionId, {
            status: 'completed',
            durationSeconds: audio.duration ? Math.round(audio.duration) : undefined,
          });
        } catch (e) {
          console.warn('[AI Pipeline] Failed to update session status:', e);
        }
      }

      // Undertaking Detection: scan transcript for undertaking language
      try {
        console.log(`[UNDERTAKINGS] Scanning for undertakings in case ${caseId}...`);
        const undertakingResult = await this.documentService.extractUndertakings(
          transcriptForDocGen,
          metadata
        );
        if (undertakingResult.items.length > 0) {
          await this.updateProcessingStatus(caseId, userId, {
            undertakingCandidates: undertakingResult.items.map(item => ({
              wording: item.wording,
              speaker: item.speaker,
              sourceQuote: item.sourceQuote,
              deadline: item.deadline,
              meetingSessionId: sessionInfo.sessionId ?? undefined,
            })),
          });
          console.log(`[UNDERTAKINGS] Detected ${undertakingResult.items.length} candidate(s) in case ${caseId}`);
        }
      } catch (undertakingError) {
        console.error('[UNDERTAKINGS] Detection failed (non-blocking):', undertakingError);
      }

      // AML Trigger Detection: scan transcript for compliance-relevant language (only for entitled users)
      try {
        const pipelineUser = await this.storage.getUser(userId);
        if (!pipelineUser?.complianceThread) {
          console.log(`[AML] Skipping trigger detection - user ${userId} does not have compliance thread enabled`);
        } else {
          const { detectAmlTriggersAI, getAmlRiskSuggestion } = await import('./amlTriggerService');
          const triggers = await detectAmlTriggersAI(transcriptText);
          if (triggers.length > 0) {
            const suggestedRisk = getAmlRiskSuggestion(triggers);
            const currentCase = await this.storage.getCase(caseId, userId);
            if (!currentCase?.riskLevel && suggestedRisk) {
              await this.storage.updateCase(caseId, { riskLevel: suggestedRisk }, userId);
            }
            await this.updateProcessingStatus(caseId, userId, {
              amlTriggers: triggers,
            });
            console.log(`[AML] Detected ${triggers.length} trigger(s) in case ${caseId}, suggested risk: ${suggestedRisk}`);
          }
        }
      } catch (amlError) {
        console.error('[AML] Trigger detection failed (non-blocking):', amlError);
      }

      // Obligations Auto-Extraction: extract obligations from transcript after processing
      try {
        const existingItems = await this.storage.getActionItemsByCase(caseId, userId);
        if (existingItems.length === 0) {
          const obligationMetadata = {
            title: caseData.title,
            clientName: caseData.clientName,
            matterReference: caseData.matterReference || undefined,
            recordingDate: new Date().toISOString().split('T')[0],
          };
          const obligationResult = await this.documentService.extractActionItems(transcriptForDocGen, obligationMetadata);
          for (const item of obligationResult.items) {
            await this.storage.createActionItem({
              caseId,
              transcriptId: transcript.id,
              description: item.description,
              originalDescription: item.description,
              assignee: item.assignee || null,
              dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
              priority: item.priority || "medium",
              status: 'draft',
            });
          }
          console.log(`[OBLIGATIONS] Auto-extracted ${obligationResult.items.length} obligation(s) for case ${caseId}`);
        } else {
          console.log(`[OBLIGATIONS] Skipping extraction - ${existingItems.length} obligation(s) already exist for case ${caseId}`);
        }
      } catch (obligationError) {
        console.error('[OBLIGATIONS] Auto-extraction failed (non-blocking):', obligationError);
      }

      // GDPR Compliance: Delete audio immediately after successful processing
      // This implements "whichever comes first" - 7 days OR successful processing
      try {
        const { ObjectStorageService } = await import('../objectStorage');
        const objectStorageService = new ObjectStorageService();
        
        if (audio.filePath && !audio.deletedAt) {
          await objectStorageService.deleteObjectEntity(audio.filePath);
          await this.storage.updateAudioRecording(audio.id, { deletedAt: new Date() });
          
          // Log audit event using auditLogger (no req object needed for system events)
          auditLogger.log({
            eventType: AuditEventType.AUDIO_DELETED,
            userId,
            resourceId: audio.id,
            resourceType: 'audio_recording',
            details: {
              caseId,
              reason: "successful_processing_completion",
              filePath: audio.filePath,
              deletedAt: new Date().toISOString(),
            },
            severity: 'low',
          });
          
          console.log(`[GDPR] Deleted audio after successful processing: ${audio.id} (case: ${caseId})`);
        }
      } catch (deleteError) {
        // Don't fail the processing if deletion fails - it will be cleaned up by expiration
        console.error(`[GDPR] Failed to delete audio after processing (will be cleaned up on expiration):`, deleteError);
      }

      console.log(`AI processing completed for case ${caseId}. Total cost: $${totalCost.toFixed(4)}`);

      return {
        success: true,
        caseId,
        transcriptId: transcript.id,
        documentIds: {
          summary: summaryDoc.id,
          attendanceNote: attendanceDoc.id,
        },
        totalCost,
      };
    } catch (error: any) {
      console.error(`AI processing failed for case ${caseId}:`, error);

      // Log failure
      auditLogger.log({
        eventType: AuditEventType.AI_PROCESSING_FAILED,
        userId,
        resourceId: caseId,
        resourceType: 'case',
        details: { error: error.message },
        severity: 'critical',
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

    await this.storage.updateCase(caseId, {
      aiProcessingMetadata: updatedMetadata,
    }, userId);
  }
}
