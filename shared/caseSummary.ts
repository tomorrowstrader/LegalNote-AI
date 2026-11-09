/**
 * At-a-glance facts for the case quick view (dashboard drawer).
 * Counts and statuses only: no document, transcript or note content.
 */

import { RECORDING_TYPE_LABELS, type RecordingType } from "./schema";

export type DocStatus = "none" | "draft" | "approved";

export interface CaseSummary {
  meetingCount: number;
  /** Total recorded time across all meetings, or null when nothing has a duration. */
  totalDurationSeconds: number | null;
  latestMeetingAt: string | null;
  /** Recording type of the latest meeting, as a label. */
  latestMeetingTypeLabel: string | null;
  attendanceNote: { status: DocStatus; total: number; approved: number };
  summary: { status: DocStatus };
  openActionItems: number;
  audio: {
    /** Earliest scheduled deletion of audio that still exists. */
    expiresAt: string | null;
    /** Every recording's audio has been deleted. */
    allDeleted: boolean;
    hasAudio: boolean;
  };
}

interface SessionLike {
  id: string;
  startedAt: Date | string;
  durationSeconds: number | null;
  recordingType: string;
}
interface RecordingLike {
  meetingSessionId: string | null;
  duration: number | null;
  recordedAt: Date | string;
  expiresAt: Date | string;
  deletedAt: Date | string | null;
}
interface DocumentLike {
  type: string;
  status: string;
  isActive: boolean;
}
interface ActionItemLike {
  status: string;
  completed: boolean;
}

const ATTENDANCE_TYPES = new Set(["attendance_note", "meeting_notes"]);
const SUMMARY_TYPES = new Set(["summary", "client_letter"]);

function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function positive(n: number | null | undefined): number | null {
  return typeof n === "number" && n > 0 ? n : null;
}

function docStatus(docs: DocumentLike[]): DocStatus {
  if (docs.length === 0) return "none";
  return docs.every((d) => d.status === "approved") ? "approved" : "draft";
}

export function buildCaseSummary(input: {
  sessions: SessionLike[];
  recordings: RecordingLike[];
  documents: DocumentLike[];
  actionItems: ActionItemLike[];
}): CaseSummary {
  const { sessions, recordings, documents, actionItems } = input;

  // Duration: a session's own figure wins; otherwise sum its recordings.
  // Recordings with no session (older uploads) count on their own.
  let total = 0;
  let anyDuration = false;
  for (const s of sessions) {
    const own = positive(s.durationSeconds);
    const fromRecordings = recordings
      .filter((r) => r.meetingSessionId === s.id)
      .reduce((sum, r) => sum + (positive(r.duration) ?? 0), 0);
    const d = own ?? (fromRecordings > 0 ? fromRecordings : null);
    if (d !== null) {
      total += d;
      anyDuration = true;
    }
  }
  const sessionIds = new Set(sessions.map((s) => s.id));
  for (const r of recordings) {
    if (r.meetingSessionId && sessionIds.has(r.meetingSessionId)) continue;
    const d = positive(r.duration);
    if (d !== null) {
      total += d;
      anyDuration = true;
    }
  }

  const orphanRecordings = recordings.filter(
    (r) => !r.meetingSessionId || !sessionIds.has(r.meetingSessionId),
  );
  const meetingCount = sessions.length + orphanRecordings.length;

  const latestSession = [...sessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )[0];
  const latestOrphan = [...orphanRecordings].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  )[0];
  let latestMeetingAt: string | null = null;
  let latestMeetingTypeLabel: string | null = null;
  if (latestSession) {
    latestMeetingAt = toIso(latestSession.startedAt);
    latestMeetingTypeLabel =
      RECORDING_TYPE_LABELS[latestSession.recordingType as RecordingType] ?? null;
  }
  if (
    latestOrphan &&
    (!latestMeetingAt || new Date(latestOrphan.recordedAt).getTime() > new Date(latestMeetingAt).getTime())
  ) {
    latestMeetingAt = toIso(latestOrphan.recordedAt);
    latestMeetingTypeLabel = null;
  }

  const active = documents.filter((d) => d.isActive);
  const notes = active.filter((d) => ATTENDANCE_TYPES.has(d.type));
  const summaries = active.filter((d) => SUMMARY_TYPES.has(d.type));

  const live = recordings.filter((r) => !r.deletedAt);
  const expiries = live.map((r) => new Date(r.expiresAt).getTime()).sort((a, b) => a - b);

  return {
    meetingCount,
    totalDurationSeconds: anyDuration ? total : null,
    latestMeetingAt,
    latestMeetingTypeLabel,
    attendanceNote: {
      status: docStatus(notes),
      total: notes.length,
      approved: notes.filter((d) => d.status === "approved").length,
    },
    summary: { status: docStatus(summaries) },
    openActionItems: actionItems.filter((a) => a.status !== "rejected" && !a.completed).length,
    audio: {
      expiresAt: expiries.length ? new Date(expiries[0]).toISOString() : null,
      allDeleted: recordings.length > 0 && live.length === 0,
      hasAudio: recordings.length > 0,
    },
  };
}

/** 3725 -> "1 hr 2 min"; 45 -> "45 sec"; 600 -> "10 min". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} sec`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 60) return `${h + 1} hr`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
