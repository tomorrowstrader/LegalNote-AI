import type { Request } from "express";
import type { IStorage } from "../storage";
import type { AudioRecording, Case, MeetingSession } from "@shared/schema";
import { consentScriptWording } from "@shared/consent";
import { consentScriptFor } from "@shared/matterKinds";
import { sessionStartFromRecording } from "@shared/meetingTime";
import {
  carriedHoldReason,
  checkRecoveredMoveTarget,
  RECOVERED_MOVE_SOURCE_MESSAGES,
  recoveredMoveSourceBlock,
  type RecoveredMoveSourceBlock,
} from "@shared/recoveredRecordingMove";
import type { RecordConsentEventInput } from "./recordConsentEvent";

type MoveStorage = Pick<
  IStorage,
  | "getCase"
  | "updateCase"
  | "archiveCase"
  | "getMeetingSessionsByCase"
  | "createMeetingSession"
  | "updateMeetingSession"
  | "getAudioRecordingsByCaseId"
  | "updateAudioRecording"
  | "getTranscriptByCase"
  | "getDocumentsByCase"
  | "getConsentLogsByCase"
  | "createAuditLog"
>;

export interface MoveRecoveredRecordingDeps {
  storage: MoveStorage;
  findRecoveredSession(caseId: string, userId: string): Promise<{ id: string } | null>;
  relinkRecoveredSession(recoverySessionId: string, caseId: string): Promise<void>;
  recordConsent(input: RecordConsentEventInput): Promise<unknown>;
  /** Applies the storage-level hold to every recording on a held matter. */
  syncObjectHolds(caseId: string, userId: string, req?: Request): Promise<unknown>;
  clearGraceWindow(caseId: string, userId: string, req?: Request): Promise<unknown>;
  now?: () => Date;
}

export interface RecoveredMoveStatus {
  recovered: boolean;
  block: RecoveredMoveSourceBlock | null;
  message: string | null;
  audioRecordingId: string | null;
  durationSeconds: number | null;
  expiresAt: Date | null;
  hasConsentClip: boolean;
  litigationHold: boolean;
}

interface SourceState {
  source: Case;
  recoverySession: { id: string } | null;
  sessions: MeetingSession[];
  recordings: AudioRecording[];
  block: RecoveredMoveSourceBlock | null;
}

async function loadSource(deps: MoveRecoveredRecordingDeps, caseId: string, userId: string): Promise<SourceState | null> {
  const source = await deps.storage.getCase(caseId, userId);
  if (!source) return null;
  const recoverySession = await deps.findRecoveredSession(caseId, userId);
  const [sessions, recordings, transcript, documents, consentLogs] = await Promise.all([
    deps.storage.getMeetingSessionsByCase(caseId, userId),
    deps.storage.getAudioRecordingsByCaseId(caseId),
    deps.storage.getTranscriptByCase(caseId, userId),
    deps.storage.getDocumentsByCase(caseId, userId),
    deps.storage.getConsentLogsByCase(caseId, userId),
  ]);
  const recording = recordings[0];
  const block = recoveredMoveSourceBlock({
    recovered: !!recoverySession,
    caseStatus: source.status,
    hasTranscript: !!transcript,
    documentCount: documents.length,
    consentLogCount: consentLogs.length,
    recordingCount: recordings.length,
    sessionCount: sessions.length,
    audioDeleted: !!recording?.deletedAt || (!!recording && !recording.filePath),
  });
  return { source, recoverySession, sessions, recordings, block };
}

/** What the case page needs to offer the move. Null when the case does not exist. */
export async function getRecoveredMoveStatus(
  deps: MoveRecoveredRecordingDeps,
  caseId: string,
  userId: string,
): Promise<RecoveredMoveStatus | null> {
  const state = await loadSource(deps, caseId, userId);
  if (!state) return null;
  const recording = state.recordings[0];
  return {
    recovered: !!state.recoverySession,
    block: state.block,
    message: state.block ? RECOVERED_MOVE_SOURCE_MESSAGES[state.block] : null,
    audioRecordingId: recording?.id ?? null,
    durationSeconds: recording?.duration ?? null,
    expiresAt: recording?.expiresAt ?? null,
    hasConsentClip: !!recording?.consentSegmentPath,
    litigationHold: !!state.source.litigationHold,
  };
}

export interface MoveRecoveredRecordingInput {
  sourceCaseId: string;
  targetCaseId: unknown;
  recordingType: unknown;
  practiceArea?: unknown;
  /** True when the user confirms everyone agreed to the recording when it was made. */
  consentConfirmed: unknown;
  userId: string;
  practiceAreas: readonly string[];
  req?: Request;
}

export type MoveRecoveredRecordingResult =
  | {
      ok: true;
      targetCaseId: string;
      sessionId: string;
      audioRecordingId: string;
      holdCarried: boolean;
      consentSealed: boolean;
      consentError: string | null;
    }
  | { ok: false; status: number; message: string };

/**
 * Moves the session and audio of a recovered recording onto the chosen matter.
 * A hold on the recovered case travels with it, consent is sealed on the
 * destination when the user confirms it, and the empty recovered case is archived.
 */
export async function moveRecoveredRecording(
  deps: MoveRecoveredRecordingDeps,
  input: MoveRecoveredRecordingInput,
): Promise<MoveRecoveredRecordingResult> {
  const { storage, now = () => new Date() } = deps;
  const { userId, req } = input;

  if (typeof input.targetCaseId !== "string" || !input.targetCaseId) {
    return { ok: false, status: 400, message: "Choose the matter to move the recording to." };
  }
  if (typeof input.consentConfirmed !== "boolean") {
    return { ok: false, status: 400, message: "Say whether everyone agreed to the recording." };
  }

  const state = await loadSource(deps, input.sourceCaseId, userId);
  if (!state) return { ok: false, status: 404, message: "Case not found." };
  if (state.block) {
    return {
      ok: false,
      status: state.block === "not_recovered" ? 400 : 409,
      message: RECOVERED_MOVE_SOURCE_MESSAGES[state.block],
    };
  }
  const { source, recoverySession, sessions } = state;
  const recording = state.recordings[0];

  const target = await storage.getCase(input.targetCaseId, userId);
  const targetCheck = checkRecoveredMoveTarget({
    sourceCaseId: source.id,
    target: target ?? null,
    recordingType: input.recordingType,
    practiceArea: input.practiceArea,
    practiceAreas: input.practiceAreas,
  });
  if (!targetCheck.ok) return targetCheck;
  const targetCase = target!;

  if (targetCheck.setPracticeArea) {
    await storage.updateCase(targetCase.id, { practiceArea: targetCheck.setPracticeArea as Case["practiceArea"] }, userId);
  }

  // The hold goes first, so the audio is never on an unheld matter while it moves.
  let holdCarried = false;
  if (source.litigationHold && !targetCase.litigationHold) {
    const reason = carriedHoldReason(source.title, source.litigationHoldReason);
    await storage.updateCase(
      targetCase.id,
      {
        litigationHold: true,
        litigationHoldAppliedAt: now(),
        litigationHoldAppliedBy: userId,
        litigationHoldReason: reason,
        litigationHoldReleasedAt: null,
        litigationHoldReleasedBy: null,
      },
      userId,
    );
    await deps.clearGraceWindow(targetCase.id, userId, req);
    await storage.createAuditLog({
      eventType: "litigation_hold_applied",
      userId,
      caseId: targetCase.id,
      ipAddress: req?.ip || req?.socket?.remoteAddress,
      metadata: {
        reason,
        appliedBy: userId,
        carriedFromCaseId: source.id,
        previousHoldStatus: false,
        caseTitle: targetCase.title,
        actionTimestamp: now().toISOString(),
      },
      severity: "critical",
    });
    holdCarried = true;
  }

  const existingSession = sessions[0];
  // Sessions are numbered by start, so the moved session keeps the time the recording began.
  const recordedStart = sessionStartFromRecording(existingSession?.startedAt ?? null, recording.recordedAt, now());
  let session: MeetingSession;
  if (existingSession) {
    const moved = await storage.updateMeetingSession(existingSession.id, {
      caseId: targetCase.id,
      recordingType: targetCheck.recordingType,
      status: "pending",
      ...(recordedStart ? { startedAt: recordedStart } : {}),
    });
    if (!moved) return { ok: false, status: 500, message: "Could not move the session. Nothing was moved." };
    session = moved;
  } else {
    session = await storage.createMeetingSession({
      caseId: targetCase.id,
      createdBy: userId,
      // The insert schema predates internal meetings on client matters; the type was validated above.
      recordingType: targetCheck.recordingType as Parameters<MoveStorage["createMeetingSession"]>[0]["recordingType"],
      status: "pending",
      durationSeconds: recording.duration ?? undefined,
    });
    // startedAt is not settable on insert; set it to when the recording began.
    if (recordedStart) {
      session = (await storage.updateMeetingSession(session.id, { startedAt: recordedStart })) ?? session;
    }
  }

  try {
    const movedAudio = await storage.updateAudioRecording(recording.id, {
      caseId: targetCase.id,
      meetingSessionId: session.id,
    });
    if (!movedAudio) throw new Error("audio not updated");
  } catch (error) {
    if (existingSession) {
      await storage.updateMeetingSession(existingSession.id, {
        caseId: source.id,
        recordingType: existingSession.recordingType,
        status: existingSession.status,
        startedAt: existingSession.startedAt,
      }).catch(() => undefined);
    }
    return { ok: false, status: 500, message: "Could not move the audio. The recording is still on its recovered case." };
  }

  await deps.relinkRecoveredSession(recoverySession!.id, targetCase.id);

  if (holdCarried || targetCase.litigationHold) {
    await deps.syncObjectHolds(targetCase.id, userId, req);
  }

  const auditBase = {
    fromCaseId: source.id,
    toCaseId: targetCase.id,
    sessionId: session.id,
    audioRecordingId: recording.id,
    recordingType: targetCheck.recordingType,
    holdCarried,
    consentConfirmed: input.consentConfirmed,
    sessionStartedAt: session.startedAt ? new Date(session.startedAt).toISOString() : null,
  };
  await storage.createAuditLog({
    eventType: "recovered_recording_moved",
    userId,
    caseId: targetCase.id,
    ipAddress: req?.ip || req?.socket?.remoteAddress,
    metadata: { ...auditBase, direction: "in" },
    severity: "warning",
  });
  await storage.createAuditLog({
    eventType: "recovered_recording_moved",
    userId,
    caseId: source.id,
    ipAddress: req?.ip || req?.socket?.remoteAddress,
    metadata: { ...auditBase, direction: "out" },
    severity: "warning",
  });

  let consentSealed = false;
  let consentError: string | null = null;
  if (input.consentConfirmed) {
    const wording = consentScriptWording(
      consentScriptFor(targetCase.matterKind, !!targetCase.hasExternalAttendees, targetCheck.recordingType),
    );
    try {
      await deps.recordConsent({
        caseId: targetCase.id,
        audioRecordingId: recording.id,
        solicitorId: userId,
        consentGiven: true,
        disclaimerScriptVersion: wording.version,
        disclaimerWordingText: wording.text,
        consentModality: "verbal_attested",
        lawfulBasis: "consent",
        recordingPurpose: wording.purpose,
        source: "recovered_recording_move",
        req,
        auditMetadataExtras: {
          movedFromCaseId: source.id,
          consentClipPreserved: !!recording.consentSegmentPath,
        },
      });
      consentSealed = true;
    } catch (error) {
      consentError = "The recording moved, but consent could not be sealed. Record it on the matter before processing.";
    }
  }

  await storage.archiveCase(source.id, true, userId);

  return {
    ok: true,
    targetCaseId: targetCase.id,
    sessionId: session.id,
    audioRecordingId: recording.id,
    holdCarried,
    consentSealed,
    consentError,
  };
}
