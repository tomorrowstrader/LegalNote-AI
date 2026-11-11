import type { Request } from "express";
import type { IStorage } from "../storage";
import { sessionStartFromRecording } from "@shared/meetingTime";

type AlignStorage = Pick<
  IStorage,
  "getMeetingSession" | "updateMeetingSession" | "getAudioRecording" | "updateAudioRecording" | "createAuditLog"
>;

export interface AlignSessionStartInput {
  sessionId: string | null | undefined;
  audioRecordingId?: string | null;
  /** When the recording began, from a server-held source (upload session, recovered audio). */
  recordingStart: Date | string | null | undefined;
  /** Where the time came from, for the audit trail. */
  source: "chunked_upload" | "recovered_recording" | "parked_recording" | "audio_recorded_time";
  userId: string;
  caseId: string;
  req?: Request;
  now?: Date;
}

/**
 * Dates a session (and its recording) from when the recording began rather than
 * when it was filed, so sessions are numbered in the order the meetings happened.
 * Records the change in the audit trail. Returns the new start, or null if unchanged.
 */
export async function alignSessionStartToRecording(
  storage: AlignStorage,
  input: AlignSessionStartInput,
): Promise<Date | null> {
  if (!input.sessionId) return null;
  const session = await storage.getMeetingSession(input.sessionId);
  if (!session || session.caseId !== input.caseId) return null;

  const newStart = sessionStartFromRecording(session.startedAt, input.recordingStart, input.now);

  let previousAudioRecordedAt: string | null = null;
  if (input.audioRecordingId) {
    const audio = await storage.getAudioRecording(input.audioRecordingId);
    const audioStart = audio ? sessionStartFromRecording(audio.recordedAt, input.recordingStart, input.now) : null;
    if (audio && audioStart) {
      previousAudioRecordedAt = audio.recordedAt ? new Date(audio.recordedAt).toISOString() : null;
      await storage.updateAudioRecording(audio.id, { recordedAt: audioStart });
    }
  }

  if (!newStart) return null;

  await storage.updateMeetingSession(session.id, { startedAt: newStart });
  await storage.createAuditLog({
    eventType: "session_dated_from_recording",
    userId: input.userId,
    caseId: input.caseId,
    ipAddress: input.req?.ip || input.req?.socket?.remoteAddress,
    metadata: {
      sessionId: session.id,
      audioRecordingId: input.audioRecordingId ?? null,
      previousStartedAt: session.startedAt ? new Date(session.startedAt).toISOString() : null,
      startedAt: newStart.toISOString(),
      previousAudioRecordedAt,
      source: input.source,
    },
    severity: "info",
  });
  return newStart;
}
