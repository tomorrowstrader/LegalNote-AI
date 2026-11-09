import type { InsertMeetingSession, MeetingImport } from "@shared/schema";
import { defaultRecordingTypeForMatterKind, validateRecordingType } from "@shared/recordingTypes";
import { isClientMatterKind } from "@shared/matterKinds";
import type { IStorage } from "../storage";

type SessionStorage = Pick<
  IStorage,
  "getCase" | "getMeetingSession" | "createMeetingSession" | "updateMeetingSession" | "getScheduledMeetingByBotId"
>;

/**
 * How long the bot recorded, in whole seconds. Recall's recording object gives
 * started_at and completed_at, not a duration, so the length is worked out from
 * those when no duration is supplied. Returns undefined rather than guessing.
 */
export function recordingDurationSeconds(params: {
  duration?: number | null;
  startedAt?: Date;
  completedAt?: Date;
}): number | undefined {
  if (typeof params.duration === "number" && params.duration > 0) return Math.round(params.duration);
  if (!params.startedAt || !params.completedAt) return undefined;
  const seconds = Math.round((params.completedAt.getTime() - params.startedAt.getTime()) / 1000);
  // A recording longer than a day is not a real meeting length.
  return seconds > 0 && seconds <= 24 * 60 * 60 ? seconds : undefined;
}

/**
 * When the meeting actually took place. Prefers the bot's recording start,
 * then the scheduled meeting time, then when the bot was sent.
 */
export async function resolveBotMeetingStart(
  storage: Pick<IStorage, "getScheduledMeetingByBotId">,
  importRecord: MeetingImport,
): Promise<Date> {
  if (importRecord.meetingStartTime) return new Date(importRecord.meetingStartTime);
  if (importRecord.recallBotId) {
    try {
      const scheduled = await storage.getScheduledMeetingByBotId(importRecord.recallBotId);
      if (scheduled?.startTime) return new Date(scheduled.startTime);
    } catch {
      // Fall through to when the bot was sent.
    }
  }
  return new Date(importRecord.createdAt);
}

/**
 * The meeting type chosen on the upcoming meeting, if it suits the matter.
 * Otherwise the matter's default.
 */
export async function chosenRecordingType(
  storage: Pick<IStorage, "getScheduledMeetingByBotId">,
  importRecord: MeetingImport,
  matterKind: string | null | undefined,
): Promise<string> {
  if (importRecord.recallBotId) {
    try {
      const scheduled = await storage.getScheduledMeetingByBotId(importRecord.recallBotId);
      if (scheduled?.recordingType) {
        const check = validateRecordingType(scheduled.recordingType, { matterKind });
        if (check.ok) return check.recordingType;
      }
    } catch {
      // Fall back to the matter's default.
    }
  }
  // The solicitor said the client was not in the meeting and read the participant notice.
  if (importRecord.consentScript === "participant") {
    const check = validateRecordingType("internal_meeting", { matterKind });
    if (check.ok && isClientMatterKind(matterKind)) return check.recordingType;
  }
  return defaultRecordingTypeForMatterKind(matterKind);
}

/**
 * Every bot recording gets its own session on the matter. Never fall back to
 * the matter's latest session: that files a new meeting under an old one.
 *
 * Order: the session the assign step just created, then the session already
 * linked to this recording (a retry), then a new session.
 */
export async function resolveBotRecordingSession(params: {
  storage: SessionStorage;
  importRecord: MeetingImport;
  caseId: string;
  userId: string;
  assignedSessionId?: string;
  linkedSessionId?: string | null;
}): Promise<{ sessionId: string; meetingStart: Date; created: boolean }> {
  const { storage, importRecord, caseId, userId, assignedSessionId, linkedSessionId } = params;
  const meetingStart = await resolveBotMeetingStart(storage, importRecord);

  const belongsToCase = async (id: string | null | undefined) => {
    if (!id) return false;
    const session = await storage.getMeetingSession(id);
    return !!session && session.caseId === caseId;
  };

  if (await belongsToCase(linkedSessionId)) {
    return { sessionId: linkedSessionId!, meetingStart, created: false };
  }

  if (await belongsToCase(assignedSessionId)) {
    await storage.updateMeetingSession(assignedSessionId!, {
      startedAt: meetingStart,
      durationSeconds: importRecord.durationSeconds ?? undefined,
    });
    return { sessionId: assignedSessionId!, meetingStart, created: false };
  }

  const caseData = await storage.getCase(caseId, userId);
  if (!caseData) throw new Error("Matter not found for this recording");

  const recordingType = await chosenRecordingType(storage, importRecord, caseData.matterKind);
  const session = await storage.createMeetingSession({
    caseId,
    createdBy: userId,
    // The insert type's list predates internal_meeting; the column is text and the
    // routes store this same value for non-client matters.
    recordingType: recordingType as InsertMeetingSession["recordingType"],
    sessionTitle: importRecord.meetingTitle?.trim().slice(0, 200) || undefined,
    status: "pending",
    durationSeconds: importRecord.durationSeconds ?? undefined,
  });
  // startedAt is not settable on insert; set it to when the meeting happened.
  await storage.updateMeetingSession(session.id, { startedAt: meetingStart });
  return { sessionId: session.id, meetingStart, created: true };
}
