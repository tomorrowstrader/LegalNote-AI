import type { Request } from "express";
import type { IStorage } from "../storage";
import type { Case } from "@shared/schema";
import { CONSENT_DISCLAIMER_TEXT, CONSENT_DISCLAIMER_VERSION } from "@shared/consent";
import { checkRecoveredMoveTarget } from "@shared/recoveredRecordingMove";
import { alignSessionStartToRecording } from "./alignSessionStart";
import type { RecordConsentEventInput } from "./recordConsentEvent";
import type { ParkedRecording } from "./chunkedUploadService";

type FileStorage = Pick<
  IStorage,
  | "getCase"
  | "updateCase"
  | "createMeetingSession"
  | "getMeetingSession"
  | "updateMeetingSession"
  | "getAudioRecording"
  | "updateAudioRecording"
  | "createAuditLog"
>;

export interface FileParkedRecordingDeps {
  storage: FileStorage;
  getParked(sessionId: string, userId: string): Promise<ParkedRecording | null>;
  assemble(
    sessionId: string,
    userId: string,
    target: { caseId: string },
  ): Promise<
    | { ok: true; audioRecordingId: string; filePath: string; consentSegmentPath?: string; startedAt: Date; durationSeconds: number }
    | { ok: false; message: string }
  >;
  recordConsent(input: RecordConsentEventInput): Promise<unknown>;
  applyObjectHold(params: {
    caseId: string;
    audioRecordingId: string;
    filePath: string;
    consentSegmentPath?: string;
    userId: string;
    req?: Request;
  }): Promise<unknown>;
}

export interface FileParkedRecordingInput {
  recordingSessionId: string;
  targetCaseId: unknown;
  recordingType: unknown;
  practiceArea?: unknown;
  /** True when the user confirms everyone agreed to the recording when it started. */
  consentConfirmed: unknown;
  userId: string;
  practiceAreas: readonly string[];
  req?: Request;
}

export type FileParkedRecordingResult =
  | {
      ok: true;
      caseId: string;
      sessionId: string;
      audioRecordingId: string;
      consentSealed: boolean;
      consentError: string | null;
    }
  | { ok: false; status: number; message: string };

/**
 * Files a Quick Record that was set aside with "File later" onto the chosen matter.
 * The session is dated from when the recording began, so it takes its place among
 * the matter's sessions in meeting order, whenever it is filed.
 */
export async function fileParkedRecording(
  deps: FileParkedRecordingDeps,
  input: FileParkedRecordingInput,
): Promise<FileParkedRecordingResult> {
  const { storage } = deps;
  const { userId, req } = input;

  if (typeof input.targetCaseId !== "string" || !input.targetCaseId) {
    return { ok: false, status: 400, message: "Choose the matter to file the recording on." };
  }
  if (typeof input.consentConfirmed !== "boolean") {
    return { ok: false, status: 400, message: "Say whether everyone agreed to the recording." };
  }

  const parked = await deps.getParked(input.recordingSessionId, userId);
  if (!parked) {
    return { ok: false, status: 404, message: "This recording is no longer waiting to be filed." };
  }

  const target = await storage.getCase(input.targetCaseId, userId);
  const targetCheck = checkRecoveredMoveTarget({
    sourceCaseId: "",
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

  // Assemble first: it is the step most likely to fail, and a failure then leaves no empty session behind.
  const assembled = await deps.assemble(input.recordingSessionId, userId, { caseId: targetCase.id });
  if (!assembled.ok) return { ok: false, status: 409, message: assembled.message };

  const session = await storage.createMeetingSession({
    caseId: targetCase.id,
    createdBy: userId,
    // The insert schema predates internal meetings on client matters; the type was validated above.
    recordingType: targetCheck.recordingType as Parameters<FileStorage["createMeetingSession"]>[0]["recordingType"],
    sessionTitle: "Quick Record",
    status: "pending",
    durationSeconds: assembled.durationSeconds || parked.durationSeconds || undefined,
  });
  await storage.updateAudioRecording(assembled.audioRecordingId, { meetingSessionId: session.id });

  await alignSessionStartToRecording(storage, {
    sessionId: session.id,
    audioRecordingId: assembled.audioRecordingId,
    recordingStart: assembled.startedAt,
    source: "parked_recording",
    userId,
    caseId: targetCase.id,
    req,
  });

  await deps.applyObjectHold({
    caseId: targetCase.id,
    audioRecordingId: assembled.audioRecordingId,
    filePath: assembled.filePath,
    consentSegmentPath: assembled.consentSegmentPath,
    userId,
    req,
  });

  await storage.createAuditLog({
    eventType: "parked_recording_filed",
    userId,
    caseId: targetCase.id,
    ipAddress: req?.ip || req?.socket?.remoteAddress,
    metadata: {
      recordingSessionId: input.recordingSessionId,
      sessionId: session.id,
      audioRecordingId: assembled.audioRecordingId,
      recordingType: targetCheck.recordingType,
      recordingStartedAt: assembled.startedAt.toISOString(),
      consentConfirmed: input.consentConfirmed,
      consentClipPreserved: !!assembled.consentSegmentPath,
    },
    severity: "info",
  });

  let consentSealed = false;
  let consentError: string | null = null;
  if (input.consentConfirmed) {
    try {
      // The same wording and modality Quick Record seals when filed straight away.
      await deps.recordConsent({
        caseId: targetCase.id,
        audioRecordingId: assembled.audioRecordingId,
        solicitorId: userId,
        consentGiven: true,
        disclaimerScriptVersion: CONSENT_DISCLAIMER_VERSION,
        disclaimerWordingText: CONSENT_DISCLAIMER_TEXT,
        consentModality: "verbal_recorded",
        lawfulBasis: "consent",
        recordingPurpose: "Creation of attendance notes and transcripts for legal record-keeping",
        source: "quick_record_filed_later",
        req,
        auditMetadataExtras: {
          recordingSessionId: input.recordingSessionId,
          consentClipPreserved: !!assembled.consentSegmentPath,
        },
      });
      consentSealed = true;
    } catch {
      consentError = "The recording was filed, but consent could not be sealed. Record it on the matter before processing.";
    }
  }

  return {
    ok: true,
    caseId: targetCase.id,
    sessionId: session.id,
    audioRecordingId: assembled.audioRecordingId,
    consentSealed,
    consentError,
  };
}
