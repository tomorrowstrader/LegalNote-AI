import { DocumentService, type CaseMetadata } from "./documentService";
import { formatDiarizedTranscript, type SpeakerUtterance } from "./assemblyAIService";
import { logDocumentGovernanceViolations } from "./documentGovernanceGate";
import {
  extractAndComputeRelationshipDurations,
  practiceAreaNeedsRelationshipDurations,
  toIsoDate,
} from "./relationshipDateExtraction";
import { logAuditEvent } from "../auditMiddleware";
import type { IStorage } from "../storage";
import type { Document, Case, AudioRecording, MeetingSession, User } from "@shared/schema";
import { PRIMARY_ROLE_LABELS, type PrimaryRole } from "@shared/schema";

const PRODUCIBLE_TYPES = new Set([
  "attendance_note",
  "meeting_notes",
  "client_letter",
  "summary",
]);

export class ProduceDocumentVersionError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ProduceDocumentVersionError";
  }
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

async function buildMetadata(
  storage: IStorage,
  caseData: Case,
  audio: AudioRecording | undefined,
  meetingSession: MeetingSession | null | undefined,
): Promise<CaseMetadata> {
  const firmProfile = await storage.getFirmProfile();
  const showFullSolicitorName = firmProfile?.showFullSolicitorName ?? true;

  const feeEarnerUserId =
    meetingSession?.createdBy ?? caseData.assignedToUserId ?? caseData.createdBy;
  const feeEarnerUser = await storage.getUser(feeEarnerUserId);

  const meetingTimestamp = audio?.recordedAt
    ? new Date(audio.recordedAt)
    : meetingSession?.startedAt
      ? new Date(meetingSession.startedAt)
      : undefined;

  let durationMinutes: number | undefined;
  let units: number | undefined;
  let durationDisplay: string | undefined;
  if (audio?.duration != null && audio.duration > 0) {
    durationMinutes = Math.ceil(audio.duration / 60);
    units = Math.ceil(durationMinutes / 6);
    durationDisplay = formatDurationMinutes(durationMinutes);
  }

  return {
    title: caseData.title,
    clientName: caseData.clientName,
    matterReference: caseData.matterReference || undefined,
    recordingDate: meetingTimestamp
      ? formatUkLongDate(meetingTimestamp)
      : formatUkLongDate(new Date()),
    recordingDateIso: toIsoDate(meetingTimestamp ?? new Date()),
    datePrepared: formatUkLongDate(new Date()),
    meetingStartTime: meetingTimestamp ? format24HourTime(meetingTimestamp) : undefined,
    durationDisplay,
    units,
    feeEarnerDisplayName: feeEarnerUser
      ? buildFeeEarnerDisplayName(feeEarnerUser, showFullSolicitorName)
      : undefined,
    feeEarnerName: feeEarnerUser ? buildFeeEarnerPlainName(feeEarnerUser) : undefined,
    firmName: firmProfile?.firmName ?? undefined,
    templateId: caseData.templateId || undefined,
    practiceArea: caseData.practiceArea || undefined,
  };
}

async function updateProduceProgress(
  storage: IStorage,
  caseId: string,
  userId: string,
  progress: number,
  currentStep: string,
  status: "processing" | "completed" | "failed" = "processing",
  error?: string,
  /** On failure, restore this case status so existing docs stay on the matter file. */
  restoreStatusOnFailure?: string,
): Promise<void> {
  const caseData = await storage.getCase(caseId, userId);
  if (!caseData) return;
  const currentMetadata = (caseData.aiProcessingMetadata as Record<string, unknown>) || {};
  const restored =
    restoreStatusOnFailure === "completed" || restoreStatusOnFailure === "review_required"
      ? restoreStatusOnFailure
      : "review_required";
  await storage.updateCase(
    caseId,
    {
      // Further-version failure must not flip the matter to first-time "failed" —
      // that hides existing attendance notes and makes Retry re-run full AI processing.
      status:
        status === "failed"
          ? restored
          : status === "completed"
            ? "review_required"
            : "processing",
      aiProcessingMetadata: {
        ...currentMetadata,
        status,
        progress,
        currentStep,
        ...(error ? { error } : { error: undefined }),
        ...(status === "failed"
          ? { produceVersionFailed: true, produceVersionError: error }
          : { produceVersionFailed: undefined, produceVersionError: undefined }),
      },
    },
    userId,
  );
}

/**
 * Produce a further version of an attendance note or client letter from existing
 * transcript / attendance note — does not re-transcribe. Prior version remains
 * on file (inactive) with parentVersionId linkage.
 *
 * Uses the same generateDocumentByRecordingType + generateSummary path as the
 * meeting-end AIProcessingPipeline derivation engine, with revision context
 * (previous on-file content + optional fee-earner reason) so further versions
 * are not identical re-runs at temperature 0.
 */
export async function produceDocumentVersion(params: {
  storage: IStorage;
  caseId: string;
  documentId: string;
  userId: string;
  reason?: string;
  /** When true, drive case processing UI progress (Meeting-to-Matter Engine card). */
  trackProgress?: boolean;
}): Promise<Document> {
  const { storage, caseId, documentId, userId, reason, trackProgress = false } = params;
  const documentService = new DocumentService();
  let statusBeforeProduce: string | undefined;

  const setProgress = async (progress: number, currentStep: string) => {
    if (!trackProgress) return;
    await updateProduceProgress(storage, caseId, userId, progress, currentStep);
  };

  try {
    const caseData = await storage.getCase(caseId, userId);
    if (!caseData) {
      throw new ProduceDocumentVersionError("Case not found", 404, "case_not_found");
    }
    const meta = (caseData.aiProcessingMetadata as Record<string, unknown>) || {};
    statusBeforeProduce =
      (typeof meta.statusBeforeProduce === "string" && meta.statusBeforeProduce) ||
      caseData.status;

    if (caseData.litigationHold) {
      throw new ProduceDocumentVersionError(
        "Cannot produce a further version while this matter is under litigation hold",
        403,
        "litigation_hold",
      );
    }

    const parent = await storage.getDocument(documentId);
    if (!parent || parent.caseId !== caseId) {
      throw new ProduceDocumentVersionError("Document not found", 404, "document_not_found");
    }

    if (!parent.isActive) {
      throw new ProduceDocumentVersionError(
        "Only the current (active) version can be used to produce a further version",
        400,
        "inactive_parent",
      );
    }

    if (!PRODUCIBLE_TYPES.has(parent.type)) {
      throw new ProduceDocumentVersionError(
        "Further versions can only be produced for attendance notes and client letters",
        400,
        "unsupported_type",
      );
    }

    await setProgress(10, "Preparing to compile a further version...");

    const firmProfile = await storage.getFirmProfile();
    const firmPreferences = {
      includeLocation: firmProfile?.includeLocation ?? true,
      showFullSolicitorName: firmProfile?.showFullSolicitorName ?? true,
      includeClientConfirmation: firmProfile?.includeClientConfirmation ?? false,
    };

    const meetingSession = parent.meetingSessionId
      ? await storage.getMeetingSession(parent.meetingSessionId)
      : undefined;

    let audio: AudioRecording | undefined;
    if (parent.meetingSessionId) {
      audio = await storage.getAudioRecordingBySession(parent.meetingSessionId);
    }
    if (!audio) {
      audio = await storage.getAudioRecordingByCase(caseId, userId);
    }

    const metadata = await buildMetadata(storage, caseData, audio, meetingSession);

    const isAttendance =
      parent.type === "attendance_note" || parent.type === "meeting_notes";
    const isClientLetter = parent.type === "client_letter" || parent.type === "summary";

    let primaryVersion: Document;

    if (isAttendance) {
      let transcript = parent.transcriptSnapshotId
        ? await storage.getTranscript(parent.transcriptSnapshotId)
        : undefined;
      if (!transcript && parent.meetingSessionId) {
        transcript = await storage.getTranscriptBySession(parent.meetingSessionId);
      }
      if (!transcript) {
        transcript = await storage.getTranscriptByCase(caseId, userId);
      }
      if (!transcript?.content?.trim()) {
        throw new ProduceDocumentVersionError(
          "No transcript is available to produce a further attendance note",
          400,
          "transcript_required",
        );
      }

      const utterances = (transcript.utterances as SpeakerUtterance[] | null) ?? [];
      const transcriptForDocGen =
        utterances.length > 0 ? formatDiarizedTranscript(utterances) : transcript.content;

      const recordingType = meetingSession?.recordingType || "full_meeting";

      await setProgress(40, "Compiling attendance note via derivation engine...");

      if (practiceAreaNeedsRelationshipDurations(metadata.practiceArea)) {
        try {
          const durationResult = await extractAndComputeRelationshipDurations(
            transcriptForDocGen,
            {
              asOfIso: metadata.recordingDateIso ?? toIsoDate(new Date()),
              clientName: metadata.clientName,
              matterReference: metadata.matterReference,
              title: metadata.title,
            },
          );
          metadata.relationshipDurations = durationResult.durations;
        } catch (durationError) {
          console.warn(
            "[produceDocumentVersion] Relationship duration extraction failed; continuing without duration facts:",
            durationError,
          );
        }
      }

      const attendanceRevision = {
        previousContent: parent.content,
        reason: reason?.trim() || undefined,
      };

      const attendanceResult = await documentService.generateDocumentByRecordingType(
        recordingType,
        transcriptForDocGen,
        metadata,
        firmPreferences,
        utterances.length > 0 ? utterances : undefined,
        attendanceRevision,
      );

      logDocumentGovernanceViolations(attendanceResult.content, recordingType, { caseId });

      await setProgress(55, "Verifying attendance note against transcript...");

      const verification = await documentService.verifyDocumentAgainstTranscript(
        attendanceResult.content,
        transcriptForDocGen,
        {
          clientName: metadata.clientName,
          feeEarnerName: metadata.feeEarnerName,
          relationshipDurations: metadata.relationshipDurations,
        },
      );

      const attendanceVersion = await storage.createDocumentVersion(
        documentId,
        attendanceResult.content,
        "further_produced",
        userId,
        {
          verificationWarnings:
            verification.warnings.length > 0 ? verification.warnings : undefined,
        },
      );

      if (!attendanceVersion) {
        throw new ProduceDocumentVersionError(
          "Could not produce further version — access denied or litigation hold",
          403,
          "version_create_failed",
        );
      }

      await logAuditEvent(userId, "document_regenerated", {
        caseId,
        documentId: attendanceVersion.id,
        metadata: {
          action: "produce_new_version",
          documentType: parent.type,
          parentDocumentId: documentId,
          parentVersion: parent.version,
          newVersion: attendanceVersion.version,
          versionType: "further_produced",
          reason: reason?.trim() || undefined,
          wasApproved: parent.status === "approved",
          recordingType,
          inputTokens: attendanceResult.inputTokens,
          outputTokens: attendanceResult.outputTokens,
          cost: attendanceResult.cost,
        },
      });

      // Mirror meeting-end pipeline: also regenerate client letter from the new note
      const activeDocs = await storage.getActiveDocumentsByCase(caseId, userId);
      const clientLetterParent =
        activeDocs.find(
          (d) =>
            (d.type === "client_letter" || d.type === "summary") &&
            (!parent.meetingSessionId || d.meetingSessionId === parent.meetingSessionId) &&
            d.id !== attendanceVersion.id,
        ) ??
        activeDocs.find(
          (d) =>
            (d.type === "client_letter" || d.type === "summary") && d.id !== attendanceVersion.id,
        );

      if (clientLetterParent) {
        await setProgress(70, "Compiling client letter...");
        const letterResult = await documentService.generateSummary(
          attendanceResult.content,
          metadata,
          {
            previousContent: clientLetterParent.content,
            reason: reason?.trim() || undefined,
          },
        );
        logDocumentGovernanceViolations(letterResult.content, "client_letter", { caseId });

        await setProgress(85, "Verifying client letter against attendance note...");
        const letterVerification = await documentService.verifyDocumentAgainstTranscript(
          letterResult.content,
          attendanceResult.content,
          { clientName: metadata.clientName, feeEarnerName: metadata.feeEarnerName },
        );

        const letterVersion = await storage.createDocumentVersion(
          clientLetterParent.id,
          letterResult.content,
          "further_produced",
          userId,
          {
            verificationWarnings:
              letterVerification.warnings.length > 0 ? letterVerification.warnings : undefined,
          },
        );

        if (letterVersion) {
          await logAuditEvent(userId, "document_regenerated", {
            caseId,
            documentId: letterVersion.id,
            metadata: {
              action: "produce_new_version",
              documentType: clientLetterParent.type,
              parentDocumentId: clientLetterParent.id,
              parentVersion: clientLetterParent.version,
              newVersion: letterVersion.version,
              versionType: "further_produced",
              reason: reason?.trim() || undefined,
              pairedWithAttendanceVersion: attendanceVersion.id,
              inputTokens: letterResult.inputTokens,
              outputTokens: letterResult.outputTokens,
              cost: letterResult.cost,
            },
          });
        }
      }

      primaryVersion = attendanceVersion;
    } else if (isClientLetter) {
      await setProgress(40, "Compiling client letter...");

      const activeDocs = await storage.getActiveDocumentsByCase(caseId, userId);
      const attendanceNote =
        activeDocs.find(
          (d) =>
            (d.type === "attendance_note" || d.type === "meeting_notes") &&
            (!parent.meetingSessionId || d.meetingSessionId === parent.meetingSessionId),
        ) ??
        activeDocs.find((d) => d.type === "attendance_note" || d.type === "meeting_notes");

      if (!attendanceNote?.content?.trim()) {
        throw new ProduceDocumentVersionError(
          "An attendance note is required before a further client letter can be produced",
          400,
          "attendance_note_required",
        );
      }

      const letterResult = await documentService.generateSummary(
        attendanceNote.content,
        metadata,
        {
          previousContent: parent.content,
          reason: reason?.trim() || undefined,
        },
      );

      logDocumentGovernanceViolations(letterResult.content, "client_letter", { caseId });

      await setProgress(70, "Verifying client letter against attendance note...");

      const verification = await documentService.verifyDocumentAgainstTranscript(
        letterResult.content,
        attendanceNote.content,
        { clientName: metadata.clientName, feeEarnerName: metadata.feeEarnerName },
      );

      const newVersion = await storage.createDocumentVersion(
        documentId,
        letterResult.content,
        "further_produced",
        userId,
        {
          verificationWarnings:
            verification.warnings.length > 0 ? verification.warnings : undefined,
        },
      );

      if (!newVersion) {
        throw new ProduceDocumentVersionError(
          "Could not produce further version — access denied or litigation hold",
          403,
          "version_create_failed",
        );
      }

      await logAuditEvent(userId, "document_regenerated", {
        caseId,
        documentId: newVersion.id,
        metadata: {
          action: "produce_new_version",
          documentType: parent.type,
          parentDocumentId: documentId,
          parentVersion: parent.version,
          newVersion: newVersion.version,
          versionType: "further_produced",
          reason: reason?.trim() || undefined,
          wasApproved: parent.status === "approved",
          inputTokens: letterResult.inputTokens,
          outputTokens: letterResult.outputTokens,
          cost: letterResult.cost,
        },
      });

      primaryVersion = newVersion;
    } else {
      throw new ProduceDocumentVersionError(
        "Further versions can only be produced for attendance notes and client letters",
        400,
        "unsupported_type",
      );
    }

    if (trackProgress) {
      await updateProduceProgress(
        storage,
        caseId,
        userId,
        100,
        "Processing complete",
        "completed",
      );
    }

    return primaryVersion;
  } catch (error: any) {
    if (trackProgress) {
      try {
        await updateProduceProgress(
          storage,
          caseId,
          userId,
          0,
          "Production failed",
          "failed",
          error?.message || "Failed to produce further version",
          statusBeforeProduce,
        );
        // Restore session status so the matter doesn't look mid-processing forever
        const parent = await storage.getDocument(documentId);
        if (parent?.meetingSessionId) {
          await storage.updateMeetingSession(parent.meetingSessionId, { status: "completed" });
        }
      } catch {
        // ignore status update failure
      }
    }
    throw error;
  }
}

/**
 * Kick off async further-version production with the same case processing UI
 * as first-time meeting-end AI processing.
 */
export async function enqueueProduceDocumentVersion(params: {
  storage: IStorage;
  caseId: string;
  documentId: string;
  userId: string;
  reason?: string;
}): Promise<void> {
  const { storage, caseId, documentId, userId, reason } = params;

  const caseData = await storage.getCase(caseId, userId);
  if (!caseData) {
    throw new ProduceDocumentVersionError("Case not found", 404, "case_not_found");
  }

  const metadata = (caseData.aiProcessingMetadata as any) || {};
  if (caseData.status === "processing" || metadata.status === "processing") {
    throw new ProduceDocumentVersionError(
      "Case is already being processed",
      400,
      "already_processing",
    );
  }

  const parent = await storage.getDocument(documentId);
  if (!parent || parent.caseId !== caseId) {
    throw new ProduceDocumentVersionError("Document not found", 404, "document_not_found");
  }
  if (!parent.isActive) {
    throw new ProduceDocumentVersionError(
      "Only the current (active) version can be used to produce a further version",
      400,
      "inactive_parent",
    );
  }
  if (!PRODUCIBLE_TYPES.has(parent.type)) {
    throw new ProduceDocumentVersionError(
      "Further versions can only be produced for attendance notes and client letters",
      400,
      "unsupported_type",
    );
  }
  if (caseData.litigationHold) {
    throw new ProduceDocumentVersionError(
      "Cannot produce a further version while this matter is under litigation hold",
      403,
      "litigation_hold",
    );
  }

  await storage.updateCase(
    caseId,
    {
      status: "processing",
      aiProcessingMetadata: {
        status: "processing",
        progress: 0,
        currentStep: "Queued for further version production...",
        error: undefined,
        produceVersionFailed: undefined,
        produceVersionError: undefined,
        /** Restored if further-version production fails (keeps existing docs on file). */
        statusBeforeProduce: caseData.status,
      },
    },
    userId,
  );

  if (parent.meetingSessionId) {
    await storage.updateMeetingSession(parent.meetingSessionId, { status: "processing" });
  }

  const { jobQueue } = await import("./jobQueue");
  await jobQueue.addJob("produce-document-version", {
    caseId,
    documentId,
    userId,
    reason,
  });
}
