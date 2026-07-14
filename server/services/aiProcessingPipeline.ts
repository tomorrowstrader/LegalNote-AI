import { AssemblyAIService, formatDiarizedTranscript, type SpeakerUtterance } from './assemblyAIService';
import { DocumentService, type CaseMetadata } from './documentService';
import { TranscriptCorrectionService } from './transcriptCorrectionService';
import { IStorage } from '../storage';
import { logAuditEvent } from '../auditMiddleware';
import { buildKeytermsConfig } from './legalVocabulary';
import {
  PRIMARY_ROLE_LABELS,
  type PrimaryRole,
  type User,
} from '@shared/schema';
import { isFeatureVisible } from '@shared/featureVisibility';

function formatUkLongDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function format24HourTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/London',
  });
}

function formatDurationMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${hours} hour${hours === 1 ? '' : 's'} ${mins} minutes`;
}

function resolveFeeEarnerTitle(user: User): string {
  if (user.primaryRole === 'custom' && user.customRoleLabel?.trim()) {
    return user.customRoleLabel.trim();
  }
  if (user.primaryRole && user.primaryRole in PRIMARY_ROLE_LABELS) {
    return PRIMARY_ROLE_LABELS[user.primaryRole as PrimaryRole];
  }
  if (user.role?.trim()) {
    const r = user.role.trim();
    return r.charAt(0).toUpperCase() + r.slice(1);
  }
  return 'Solicitor';
}

function buildFeeEarnerInitials(user: User): string {
  const parts: string[] = [];
  if (user.firstName?.trim()) parts.push(user.firstName.trim().charAt(0).toUpperCase());
  if (user.lastName?.trim()) parts.push(user.lastName.trim().charAt(0).toUpperCase());
  if (parts.length > 0) return parts.join('.') + '.';
  if (user.email) return user.email.split('@')[0].slice(0, 2).toUpperCase();
  return 'S';
}

function buildFeeEarnerDisplayName(user: User, showFullSolicitorName: boolean): string {
  const title = resolveFeeEarnerTitle(user);
  if (showFullSolicitorName) {
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.email ||
      'Solicitor';
    return `${name}, ${title}`;
  }
  return `${buildFeeEarnerInitials(user)}, ${title}`;
}

function buildFeeEarnerPlainName(user: User): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.email ||
    'Solicitor'
  );
}

async function buildDocumentGenerationMetadata(
  storage: IStorage,
  params: {
    caseData: {
      title: string;
      clientName: string;
      matterReference?: string | null;
      templateId?: string | null;
      practiceArea?: string | null;
      assignedToUserId?: string | null;
      createdBy: string;
    };
    audio: { duration?: number | null; recordedAt?: Date | string | null };
    meetingSession: { createdBy: string; startedAt?: Date | string | null } | null | undefined;
    showFullSolicitorName: boolean;
    firmName?: string;
  },
): Promise<CaseMetadata> {
  const feeEarnerUserId =
    params.meetingSession?.createdBy ??
    params.caseData.assignedToUserId ??
    params.caseData.createdBy;

  const feeEarnerUser = await storage.getUser(feeEarnerUserId);
  const feeEarnerDisplayName = feeEarnerUser
    ? buildFeeEarnerDisplayName(feeEarnerUser, params.showFullSolicitorName)
    : undefined;
  const feeEarnerName = feeEarnerUser ? buildFeeEarnerPlainName(feeEarnerUser) : undefined;

  const meetingTimestamp = params.audio.recordedAt
    ? new Date(params.audio.recordedAt)
    : params.meetingSession?.startedAt
      ? new Date(params.meetingSession.startedAt)
      : undefined;

  let durationMinutes: number | undefined;
  let units: number | undefined;
  let durationDisplay: string | undefined;
  if (params.audio.duration != null && params.audio.duration > 0) {
    durationMinutes = Math.ceil(params.audio.duration / 60);
    units = Math.ceil(durationMinutes / 6);
    durationDisplay = formatDurationMinutes(durationMinutes);
  }

  return {
    title: params.caseData.title,
    clientName: params.caseData.clientName,
    matterReference: params.caseData.matterReference || undefined,
    recordingDate: meetingTimestamp
      ? formatUkLongDate(meetingTimestamp)
      : formatUkLongDate(new Date()),
    datePrepared: formatUkLongDate(new Date()),
    meetingStartTime: meetingTimestamp ? format24HourTime(meetingTimestamp) : undefined,
    durationDisplay,
    units,
    feeEarnerDisplayName,
    feeEarnerName,
    firmName: params.firmName,
    templateId: params.caseData.templateId || undefined,
    practiceArea: params.caseData.practiceArea || undefined,
  };
}

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
  private documentService: DocumentService;
  private correctionService: TranscriptCorrectionService;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.assemblyAIService = new AssemblyAIService();
    this.documentService = new DocumentService();
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

      await this.updateProcessingStatus(caseId, userId, {
        status: 'generating_documents',
        progress: 40,
        currentStep: 'Generating attendance note...',
        transcriptionCost: transcriptionCost,
      });

      // For document generation, use formatted diarized transcript if available
      const transcriptForDocGen = transcriptUtterances.length > 0
        ? formatDiarizedTranscript(transcriptUtterances)
        : transcriptText;

      const firmProfile = await this.storage.getFirmProfile();
      const showFullSolicitorName = firmProfile?.showFullSolicitorName ?? true;

      const meetingSession = sessionInfo.sessionId
        ? await this.storage.getMeetingSession(sessionInfo.sessionId)
        : undefined;

      const metadata = await buildDocumentGenerationMetadata(this.storage, {
        caseData,
        audio,
        meetingSession,
        showFullSolicitorName,
        firmName: firmProfile?.firmName ?? undefined,
      });

      const firmPreferences = {
        includeLocation: firmProfile?.includeLocation ?? true,
        showFullSolicitorName,
        includeClientConfirmation: firmProfile?.includeClientConfirmation ?? false,
      };

      const recordingType = sessionInfo.recordingType;
      const isInternalMeeting = recordingType === 'internal_meeting';
      const docType = isInternalMeeting ? 'meeting_notes' : 'attendance_note';
      const logLabel = isInternalMeeting ? 'meeting notes' : 'attendance note';

      // Step 2: Generate primary document first (attendance note or meeting notes)
      console.log(`Generating ${logLabel} for case ${caseId} (recording type: ${recordingType}, session: ${sessionInfo.sessionId})...`);
      const attendanceResult = await this.documentService.generateDocumentByRecordingType(
        recordingType,
        transcriptForDocGen,
        metadata,
        firmPreferences,
        transcriptUtterances.length > 0 ? transcriptUtterances : undefined
      );

      await this.updateProcessingStatus(caseId, userId, {
        status: 'generating_documents',
        progress: 55,
        currentStep: `Verifying ${logLabel} against transcript...`,
      });

      const attendanceVerification = await this.documentService.verifyDocumentAgainstTranscript(
        attendanceResult.content,
        transcriptForDocGen
      );

      const attendanceDoc = await this.storage.createDocument({
        caseId,
        transcriptSnapshotId: transcript.id,
        type: docType,
        content: attendanceResult.content,
        version: 1,
        versionType: 'system_generated',
        createdBy: userId,
        isActive: true,
        verificationWarnings: attendanceVerification.warnings.length > 0 ? attendanceVerification.warnings : undefined,
        isShortRecording: attendanceResult.isShortRecording || false,
        meetingSessionId: sessionInfo.sessionId ?? undefined,
      });

      await logAuditEvent(userId, "document_generated", {
        caseId,
        documentId: attendanceDoc.id,
        metadata: {
          documentType: docType,
          inputTokens: attendanceResult.inputTokens,
          outputTokens: attendanceResult.outputTokens,
          cost: attendanceResult.cost,
        },
      });

      let clientLetterResult: typeof attendanceResult | undefined;
      let clientLetterVerification: Awaited<ReturnType<DocumentService['verifyDocumentAgainstTranscript']>> | undefined;
      let clientLetterDoc: typeof attendanceDoc | undefined;

      if (!isInternalMeeting) {
        await this.updateProcessingStatus(caseId, userId, {
          status: 'generating_documents',
          progress: 70,
          currentStep: 'Generating client letter...',
        });

        console.log(`Generating client letter for case ${caseId}...`);
        clientLetterResult = await this.documentService.generateSummary(
          attendanceResult.content,
          metadata
        );

        await this.updateProcessingStatus(caseId, userId, {
          status: 'generating_documents',
          progress: 85,
          currentStep: 'Verifying client letter against attendance note...',
        });

        clientLetterVerification = await this.documentService.verifyDocumentAgainstTranscript(
          clientLetterResult.content,
          attendanceResult.content
        );

        clientLetterDoc = await this.storage.createDocument({
          caseId,
          transcriptSnapshotId: transcript.id,
          type: 'client_letter',
          content: clientLetterResult.content,
          version: 1,
          versionType: 'system_generated',
          createdBy: userId,
          isActive: true,
          verificationWarnings: clientLetterVerification.warnings.length > 0 ? clientLetterVerification.warnings : undefined,
          isShortRecording: clientLetterResult.isShortRecording || false,
          meetingSessionId: sessionInfo.sessionId ?? undefined,
        });

        await logAuditEvent(userId, "document_generated", {
          caseId,
          documentId: clientLetterDoc.id,
          metadata: {
            documentType: "client_letter",
            inputTokens: clientLetterResult.inputTokens,
            outputTokens: clientLetterResult.outputTokens,
            cost: clientLetterResult.cost,
          },
        });
      }

      const verificationCost = attendanceVerification.cost + (clientLetterVerification?.cost ?? 0);

      const totalCost = transcriptionCost + 
                       attendanceResult.cost +
                       (clientLetterResult?.cost ?? 0) +
                       verificationCost;

      const totalTokens = {
        input: attendanceResult.inputTokens + (clientLetterResult?.inputTokens ?? 0) + attendanceVerification.inputTokens + (clientLetterVerification?.inputTokens ?? 0),
        output: attendanceResult.outputTokens + (clientLetterResult?.outputTokens ?? 0) + attendanceVerification.outputTokens + (clientLetterVerification?.outputTokens ?? 0),
      };

      // Update final status
      await this.updateProcessingStatus(caseId, userId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Processing complete',
        transcriptionCost: transcriptionCost,
        documentGenerationCost: attendanceResult.cost + (clientLetterResult?.cost ?? 0) + verificationCost,
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

      // AML Trigger Detection: scan transcript for compliance-relevant language (only for entitled users, skip for internal meetings)
      if (!isInternalMeeting && isFeatureVisible("amlCompliance")) {
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
      } else {
        console.log(`[AML] Skipping trigger detection for internal meeting in case ${caseId}`);
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

      console.log(`AI processing completed for case ${caseId}. Total cost: $${totalCost.toFixed(4)}`);

      return {
        success: true,
        caseId,
        transcriptId: transcript.id,
        documentIds: {
          summary: clientLetterDoc?.id ?? '',
          attendanceNote: attendanceDoc.id,
        },
        totalCost,
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
