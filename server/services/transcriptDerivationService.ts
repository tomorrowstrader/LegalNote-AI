import { DocumentService, type CaseMetadata } from "./documentService";
import { formatDiarizedTranscript, type SpeakerUtterance } from "./assemblyAIService";
import { logDocumentGovernanceViolations } from "./documentGovernanceGate";
import {
  extractAndComputeRelationshipDurations,
  practiceAreaNeedsRelationshipDurations,
  toIsoDate,
} from "./relationshipDateExtraction";
import type { IStorage } from "../storage";
import { logAuditEvent } from "../auditMiddleware";
import {
  PRIMARY_ROLE_LABELS,
  type PrimaryRole,
  type User,
  type MeetingSession,
  type InsertDocument,
  type InsertActionItem,
  type Transcript,
} from "@shared/schema";
import { isFeatureVisible } from "@shared/featureVisibility";
import { repairRtfTranscriptContent } from "./normalizeUploadedTranscript";
import { generateDocumentHash } from "../utils/documentHash";
import { looksLikeRtf } from "@shared/stripRtf";

export interface ProcessingMetadata {
  status: "idle" | "transcribing" | "generating_documents" | "completed" | "failed" | "processing";
  progress: number;
  currentStep?: string;
  transcriptionCost?: number;
  documentGenerationCost?: number;
  totalCost?: number;
  totalTokens?: { input: number; output: number };
  error?: string;
  completedAt?: string;
  undertakingCandidates?: unknown[];
  amlTriggers?: unknown[];
}

export interface DeriveFromTranscriptParams {
  storage: IStorage;
  caseId: string;
  userId: string;
  transcriptId: string;
  sessionId?: string | null;
  /** Override session recording type when known at import time */
  recordingType?: string;
  meetingTimestamp?: Date;
  durationSeconds?: number | null;
  generateClientLetter?: boolean;
  /** Pass-through from audio transcription path for cost totals */
  transcriptionCost?: number;
}

export interface DeriveFromTranscriptResult {
  success: boolean;
  caseId: string;
  transcriptId: string;
  documentIds: {
    attendanceNote: string;
    clientLetter?: string;
  };
  totalCost: number;
  error?: string;
}

function formatUkLongDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function format24HourTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  });
}

function formatDurationMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${hours} hour${hours === 1 ? "" : "s"} ${mins} minutes`;
}

function resolveFeeEarnerTitle(user: User): string {
  if (user.primaryRole === "custom" && user.customRoleLabel?.trim()) {
    return user.customRoleLabel.trim();
  }
  if (user.primaryRole && user.primaryRole in PRIMARY_ROLE_LABELS) {
    return PRIMARY_ROLE_LABELS[user.primaryRole as PrimaryRole];
  }
  if (user.role?.trim()) {
    const r = user.role.trim();
    return r.charAt(0).toUpperCase() + r.slice(1);
  }
  return "Solicitor";
}

function buildFeeEarnerInitials(user: User): string {
  const parts: string[] = [];
  if (user.firstName?.trim()) parts.push(user.firstName.trim().charAt(0).toUpperCase());
  if (user.lastName?.trim()) parts.push(user.lastName.trim().charAt(0).toUpperCase());
  if (parts.length > 0) return parts.join(".") + ".";
  if (user.email) return user.email.split("@")[0].slice(0, 2).toUpperCase();
  return "S";
}

function buildFeeEarnerDisplayName(user: User, showFullSolicitorName: boolean): string {
  const title = resolveFeeEarnerTitle(user);
  if (showFullSolicitorName) {
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.email ||
      "Solicitor";
    return `${name}, ${title}`;
  }
  return `${buildFeeEarnerInitials(user)}, ${title}`;
}

function buildFeeEarnerPlainName(user: User): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.email ||
    "Solicitor"
  );
}

async function updateProcessingStatus(
  storage: IStorage,
  caseId: string,
  userId: string,
  metadata: Partial<ProcessingMetadata>,
): Promise<void> {
  const caseData = await storage.getCase(caseId, userId);
  if (!caseData) return;

  const currentMetadata = (caseData.aiProcessingMetadata as ProcessingMetadata) || {};
  const updatedMetadata = { ...currentMetadata, ...metadata };

  const caseUpdate: { aiProcessingMetadata: ProcessingMetadata; status?: string } = {
    aiProcessingMetadata: updatedMetadata,
  };
  if (metadata.status === "failed") {
    caseUpdate.status = "failed";
  }

  await storage.updateCase(caseId, caseUpdate, userId);
}

async function buildMetadata(
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
    meetingSession: MeetingSession | null | undefined;
    meetingTimestamp?: Date;
    durationSeconds?: number | null;
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

  const meetingTimestamp =
    params.meetingTimestamp ??
    (params.meetingSession?.startedAt ? new Date(params.meetingSession.startedAt) : undefined);

  const durationSeconds =
    params.durationSeconds ?? params.meetingSession?.durationSeconds ?? null;

  let durationMinutes: number | undefined;
  let units: number | undefined;
  let durationDisplay: string | undefined;
  if (durationSeconds != null && durationSeconds > 0) {
    durationMinutes = Math.ceil(durationSeconds / 60);
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
    recordingDateIso: toIsoDate(meetingTimestamp ?? new Date()),
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

/**
 * Derive attendance note (+ optional client letter) from an existing transcript.
 * Shared by the audio pipeline (after transcription) and transcript-upload imports.
 */
export async function deriveDocumentsFromTranscript(
  params: DeriveFromTranscriptParams,
): Promise<DeriveFromTranscriptResult> {
  const {
    storage,
    caseId,
    userId,
    transcriptId,
    sessionId,
    generateClientLetter = true,
    transcriptionCost = 0,
  } = params;

  const documentService = new DocumentService();

  try {
    const caseData = await storage.getCase(caseId, userId);
    if (!caseData) {
      throw new Error("Case not found");
    }

    let transcript = await storage.getTranscript(transcriptId);
    if (!transcript || transcript.caseId !== caseId) {
      throw new Error("Transcript not found for this case");
    }

    // Repair TextEdit / Word RTF that was stored before stripping (or pasted raw)
    if (looksLikeRtf(transcript.content)) {
      try {
        const repaired = repairRtfTranscriptContent(transcript.content);
        if (repaired) {
          const contentHash = generateDocumentHash(repaired.content);
          const updated = await storage.updateTranscript(
            transcript.id,
            {
              content: repaired.content,
              utterances: repaired.utterances ?? [],
              speakerCount: repaired.speakerCount ?? null,
              contentHash,
            } as Partial<Transcript>,
            userId,
          );
          transcript = updated ?? {
            ...transcript,
            content: repaired.content,
            utterances: repaired.utterances ?? [],
            speakerCount: repaired.speakerCount ?? null,
            contentHash,
          };
          console.log(
            `[DeriveTranscript] Stripped RTF markup from transcript ${transcript.id} (${repaired.characterCount} chars plain text)`,
          );
        }
      } catch (rtfErr: any) {
        // Still strip for generation even if below min-length / other normalize errors
        const { stripRtfToPlainText } = await import("@shared/stripRtf");
        const plain = stripRtfToPlainText(transcript.content);
        console.warn(
          `[DeriveTranscript] Could not fully repair RTF transcript ${transcript.id}:`,
          rtfErr?.message || rtfErr,
        );
        if (plain && plain !== transcript.content) {
          transcript = { ...transcript, content: plain, utterances: [] };
        }
      }
    }

    const effectiveSessionId = sessionId ?? transcript.meetingSessionId ?? null;
    let meetingSession: MeetingSession | undefined;
    if (effectiveSessionId) {
      meetingSession = await storage.getMeetingSession(effectiveSessionId);
    }

    const recordingType =
      params.recordingType ||
      meetingSession?.recordingType ||
      "full_meeting";

    // Idempotency: if an active attendance note already exists for this transcript, reuse it
    const existingDocs = effectiveSessionId
      ? await storage.getDocumentsBySession(effectiveSessionId)
      : await storage.getDocumentsByCase(caseId, userId);
    const existingAttendance = existingDocs.find(
      (d) =>
        d.isActive &&
        (d.type === "attendance_note" || d.type === "meeting_notes") &&
        d.transcriptSnapshotId === transcriptId,
    );
    const existingLetter = existingDocs.find(
      (d) =>
        d.isActive &&
        (d.type === "client_letter" || d.type === "summary") &&
        d.transcriptSnapshotId === transcriptId,
    );

    if (existingAttendance && (!generateClientLetter || existingLetter)) {
      await updateProcessingStatus(storage, caseId, userId, {
        status: "completed",
        progress: 100,
        currentStep: "Processing complete",
        completedAt: new Date().toISOString(),
      });
      await storage.updateCase(caseId, { status: "review_required" }, userId);
      if (effectiveSessionId) {
        await storage.updateMeetingSession(effectiveSessionId, { status: "completed" });
      }
      return {
        success: true,
        caseId,
        transcriptId,
        documentIds: {
          attendanceNote: existingAttendance.id,
          clientLetter: existingLetter?.id,
        },
        totalCost: 0,
      };
    }

    const transcriptText = transcript.content;
    const transcriptUtterances = Array.isArray(transcript.utterances)
      ? (transcript.utterances as SpeakerUtterance[])
      : [];

    const transcriptForDocGen =
      transcriptUtterances.length > 0
        ? formatDiarizedTranscript(transcriptUtterances)
        : transcriptText;

    const firmProfile = await storage.getFirmProfile();
    const showFullSolicitorName = firmProfile?.showFullSolicitorName ?? true;

    const metadata = await buildMetadata(storage, {
      caseData,
      meetingSession,
      meetingTimestamp: params.meetingTimestamp,
      durationSeconds: params.durationSeconds,
      showFullSolicitorName,
      firmName: firmProfile?.firmName ?? undefined,
    });

    const firmPreferences = {
      includeLocation: firmProfile?.includeLocation ?? true,
      showFullSolicitorName,
      includeClientConfirmation: firmProfile?.includeClientConfirmation ?? false,
    };

    await updateProcessingStatus(storage, caseId, userId, {
      status: "generating_documents",
      progress: 40,
      currentStep: "Producing attendance note...",
      transcriptionCost,
    });

    let relationshipDurationCost = 0;
    if (practiceAreaNeedsRelationshipDurations(metadata.practiceArea)) {
      await updateProcessingStatus(storage, caseId, userId, {
        status: "generating_documents",
        progress: 42,
        currentStep: "Extracting relationship dates...",
      });
      try {
        const durationResult = await extractAndComputeRelationshipDurations(transcriptForDocGen, {
          asOfIso: metadata.recordingDateIso ?? toIsoDate(new Date()),
          clientName: metadata.clientName,
          matterReference: metadata.matterReference,
          title: metadata.title,
        });
        metadata.relationshipDurations = durationResult.durations;
        relationshipDurationCost = durationResult.cost;
      } catch (durationError) {
        console.warn(
          "[TranscriptDerivation] Relationship duration extraction failed; continuing without duration facts:",
          durationError,
        );
      }
    }

    let attendanceDoc = existingAttendance;
    let attendanceResult: Awaited<ReturnType<DocumentService["generateDocumentByRecordingType"]>> | undefined;
    let attendanceVerification: Awaited<
      ReturnType<DocumentService["verifyDocumentAgainstTranscript"]>
    > | undefined;

    if (!attendanceDoc) {
      console.log(
        `[TranscriptDerivation] Producing attendance note for case ${caseId} (type: ${recordingType}, session: ${effectiveSessionId})`,
      );
      attendanceResult = await documentService.generateDocumentByRecordingType(
        recordingType,
        transcriptForDocGen,
        metadata,
        firmPreferences,
        transcriptUtterances.length > 0 ? transcriptUtterances : undefined,
      );

      logDocumentGovernanceViolations(attendanceResult.content, recordingType, { caseId });

      await updateProcessingStatus(storage, caseId, userId, {
        status: "generating_documents",
        progress: 55,
        currentStep: "Verifying attendance note against transcript...",
      });

      attendanceVerification = await documentService.verifyDocumentAgainstTranscript(
        attendanceResult.content,
        transcriptForDocGen,
        {
          clientName: metadata.clientName,
          feeEarnerName: metadata.feeEarnerName,
          relationshipDurations: metadata.relationshipDurations,
        },
      );

      attendanceDoc = await storage.createDocument({
        caseId,
        transcriptSnapshotId: transcript.id,
        type: "attendance_note",
        content: attendanceResult.content,
        version: 1,
        versionType: "system_generated",
        createdBy: userId,
        isActive: true,
        verificationWarnings:
          attendanceVerification.warnings.length > 0 ? attendanceVerification.warnings : undefined,
        meetingSessionId: effectiveSessionId ?? undefined,
      } as InsertDocument);

      await logAuditEvent(userId, "document_generated", {
        caseId,
        documentId: attendanceDoc.id,
        metadata: {
          documentType: "attendance_note",
          inputTokens: attendanceResult.inputTokens,
          outputTokens: attendanceResult.outputTokens,
          cost: attendanceResult.cost,
          source: "transcript_derivation",
        },
      });
    }

    let clientLetterDoc = existingLetter;
    let clientLetterResult: Awaited<ReturnType<DocumentService["generateSummary"]>> | undefined;
    let clientLetterVerification: Awaited<
      ReturnType<DocumentService["verifyDocumentAgainstTranscript"]>
    > | undefined;

    if (generateClientLetter && !clientLetterDoc) {
      await updateProcessingStatus(storage, caseId, userId, {
        status: "generating_documents",
        progress: 70,
        currentStep: "Producing client letter...",
      });

      console.log(`[TranscriptDerivation] Producing client letter for case ${caseId}...`);
      clientLetterResult = await documentService.generateSummary(attendanceDoc.content, metadata);

      logDocumentGovernanceViolations(clientLetterResult.content, "client_letter", { caseId });

      await updateProcessingStatus(storage, caseId, userId, {
        status: "generating_documents",
        progress: 85,
        currentStep: "Verifying client letter against attendance note...",
      });

      clientLetterVerification = await documentService.verifyDocumentAgainstTranscript(
        clientLetterResult.content,
        attendanceDoc.content,
      );

      clientLetterDoc = await storage.createDocument({
        caseId,
        transcriptSnapshotId: transcript.id,
        type: "client_letter",
        content: clientLetterResult.content,
        version: 1,
        versionType: "system_generated",
        createdBy: userId,
        isActive: true,
        verificationWarnings:
          clientLetterVerification.warnings.length > 0
            ? clientLetterVerification.warnings
            : undefined,
        meetingSessionId: effectiveSessionId ?? undefined,
      } as InsertDocument);

      await logAuditEvent(userId, "document_generated", {
        caseId,
        documentId: clientLetterDoc.id,
        metadata: {
          documentType: "client_letter",
          inputTokens: clientLetterResult.inputTokens,
          outputTokens: clientLetterResult.outputTokens,
          cost: clientLetterResult.cost,
          source: "transcript_derivation",
        },
      });
    }

    const verificationCost =
      (attendanceVerification?.cost ?? 0) + (clientLetterVerification?.cost ?? 0);
    const docGenCost =
      (attendanceResult?.cost ?? 0) +
      (clientLetterResult?.cost ?? 0) +
      verificationCost +
      relationshipDurationCost;
    const totalCost = transcriptionCost + docGenCost;

    const totalTokens = {
      input:
        (attendanceResult?.inputTokens ?? 0) +
        (clientLetterResult?.inputTokens ?? 0) +
        (attendanceVerification?.inputTokens ?? 0) +
        (clientLetterVerification?.inputTokens ?? 0),
      output:
        (attendanceResult?.outputTokens ?? 0) +
        (clientLetterResult?.outputTokens ?? 0) +
        (attendanceVerification?.outputTokens ?? 0) +
        (clientLetterVerification?.outputTokens ?? 0),
    };

    await updateProcessingStatus(storage, caseId, userId, {
      status: "completed",
      progress: 100,
      currentStep: "Processing complete",
      transcriptionCost,
      documentGenerationCost: docGenCost,
      totalCost,
      totalTokens,
      completedAt: new Date().toISOString(),
    });

    await storage.updateCase(caseId, { status: "review_required" }, userId);

    if (effectiveSessionId) {
      try {
        await storage.updateMeetingSession(effectiveSessionId, {
          status: "completed",
          durationSeconds:
            params.durationSeconds != null
              ? Math.round(params.durationSeconds)
              : meetingSession?.durationSeconds ?? undefined,
        });
      } catch (e) {
        console.warn("[TranscriptDerivation] Failed to update session status:", e);
      }
    }

    // Post-processing: undertakings, AML, obligations (non-blocking individually)
    try {
      const undertakingResult = await documentService.extractUndertakings(
        transcriptForDocGen,
        metadata,
      );
      if (undertakingResult.items.length > 0) {
        await updateProcessingStatus(storage, caseId, userId, {
          undertakingCandidates: undertakingResult.items.map((item) => ({
            wording: item.wording,
            speaker: item.speaker,
            sourceQuote: item.sourceQuote,
            deadline: item.deadline,
            meetingSessionId: effectiveSessionId ?? undefined,
          })),
        });
      }
    } catch (undertakingError) {
      console.error("[TranscriptDerivation] Undertaking detection failed:", undertakingError);
    }

    if (isFeatureVisible("amlCompliance")) {
      try {
        const pipelineUser = await storage.getUser(userId);
        if (pipelineUser?.complianceThread) {
          const { detectAmlTriggersAI, getAmlRiskSuggestion } = await import("./amlTriggerService");
          const triggers = await detectAmlTriggersAI(transcriptText);
          if (triggers.length > 0) {
            const suggestedRisk = getAmlRiskSuggestion(triggers);
            const currentCase = await storage.getCase(caseId, userId);
            if (!currentCase?.riskLevel && suggestedRisk) {
              await storage.updateCase(caseId, { riskLevel: suggestedRisk }, userId);
            }
            await updateProcessingStatus(storage, caseId, userId, { amlTriggers: triggers });
          }
        }
      } catch (amlError) {
        console.error("[TranscriptDerivation] AML detection failed:", amlError);
      }
    }

    try {
      const existingItems = await storage.getActionItemsByCase(caseId, userId);
      if (existingItems.length === 0) {
        const obligationResult = await documentService.extractActionItems(transcriptForDocGen, {
          title: caseData.title,
          clientName: caseData.clientName,
          matterReference: caseData.matterReference || undefined,
          recordingDate: new Date().toISOString().split("T")[0],
        });
        for (const item of obligationResult.items) {
          await storage.createActionItem({
            caseId,
            transcriptId: transcript.id,
            description: item.description,
            originalDescription: item.description,
            assignee: item.assignee || undefined,
            dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
            priority: item.priority || "medium",
            status: "draft",
            completed: false,
          } as InsertActionItem);
        }
      }
    } catch (obligationError) {
      console.error("[TranscriptDerivation] Obligation extraction failed:", obligationError);
    }

    return {
      success: true,
      caseId,
      transcriptId,
      documentIds: {
        attendanceNote: attendanceDoc.id,
        clientLetter: clientLetterDoc?.id,
      },
      totalCost,
    };
  } catch (error: any) {
    console.error(`[TranscriptDerivation] Failed for case ${caseId}:`, error);
    await logAuditEvent(userId, "ai_processing_failed", {
      caseId,
      metadata: { error: error.message, source: "transcript_derivation" },
      severity: "critical",
    });
    await updateProcessingStatus(storage, caseId, userId, {
      status: "failed",
      progress: 0,
      error: error.message,
    });
    if (params.sessionId) {
      try {
        await storage.updateMeetingSession(params.sessionId, { status: "failed" });
      } catch {
        /* ignore */
      }
    }
    return {
      success: false,
      caseId,
      transcriptId,
      documentIds: { attendanceNote: "" },
      totalCost: 0,
      error: error.message,
    };
  }
}
