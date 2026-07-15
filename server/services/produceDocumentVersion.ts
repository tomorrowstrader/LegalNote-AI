import { DocumentService, type CaseMetadata } from "./documentService";
import { formatDiarizedTranscript, type SpeakerUtterance } from "./assemblyAIService";
import { logDocumentGovernanceViolations } from "./documentGovernanceGate";
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

/**
 * Produce a further version of an attendance note or client letter from existing
 * transcript / attendance note — does not re-transcribe. Prior version remains
 * on file (inactive) with parentVersionId linkage.
 */
export async function produceDocumentVersion(params: {
  storage: IStorage;
  caseId: string;
  documentId: string;
  userId: string;
  reason?: string;
}): Promise<Document> {
  const { storage, caseId, documentId, userId, reason } = params;
  const documentService = new DocumentService();

  const caseData = await storage.getCase(caseId, userId);
  if (!caseData) {
    throw new ProduceDocumentVersionError("Case not found", 404, "case_not_found");
  }

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

  let newContent: string;
  let verificationWarnings: string[] | undefined;
  let generationMeta: {
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
  } = {};

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
    const attendanceResult = await documentService.generateDocumentByRecordingType(
      recordingType,
      transcriptForDocGen,
      metadata,
      firmPreferences,
      utterances.length > 0 ? utterances : undefined,
    );

    logDocumentGovernanceViolations(attendanceResult.content, recordingType, { caseId });

    const verification = await documentService.verifyDocumentAgainstTranscript(
      attendanceResult.content,
      transcriptForDocGen,
      { clientName: metadata.clientName, feeEarnerName: metadata.feeEarnerName },
    );

    newContent = attendanceResult.content;
    verificationWarnings =
      verification.warnings.length > 0 ? verification.warnings : undefined;
    generationMeta = {
      inputTokens: attendanceResult.inputTokens,
      outputTokens: attendanceResult.outputTokens,
      cost: attendanceResult.cost,
    };
  } else if (isClientLetter) {
    // Prefer active attendance note for the same session, then any active attendance note
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
    );

    logDocumentGovernanceViolations(letterResult.content, "client_letter", { caseId });

    const verification = await documentService.verifyDocumentAgainstTranscript(
      letterResult.content,
      attendanceNote.content,
      { clientName: metadata.clientName, feeEarnerName: metadata.feeEarnerName },
    );

    newContent = letterResult.content;
    verificationWarnings =
      verification.warnings.length > 0 ? verification.warnings : undefined;
    generationMeta = {
      inputTokens: letterResult.inputTokens,
      outputTokens: letterResult.outputTokens,
      cost: letterResult.cost,
    };
  } else {
    throw new ProduceDocumentVersionError(
      "Further versions can only be produced for attendance notes and client letters",
      400,
      "unsupported_type",
    );
  }

  const newVersion = await storage.createDocumentVersion(
    documentId,
    newContent,
    "further_produced",
    userId,
    { verificationWarnings },
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
      ...generationMeta,
    },
  });

  return newVersion;
}
