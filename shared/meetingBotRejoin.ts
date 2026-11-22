/**
 * Rules for keeping LegalNote in a meeting: when the meeting card stays live,
 * when the bot can be sent back in, when processing waits for a rejoin, and how
 * consent and script-start times map onto the recording.
 *
 * Pure functions only, so they are shared by the server and the dashboard card.
 */

/** Show the card's live controls from this long before the scheduled start. */
export const LIVE_WINDOW_LEAD_MS = 5 * 60 * 1000;
/** Keep them this long after the scheduled end, for meetings that overrun. */
export const LIVE_WINDOW_TAIL_MS = 15 * 60 * 1000;
/** Length assumed when a meeting has no end time. */
export const DEFAULT_MEETING_LENGTH_MS = 60 * 60 * 1000;

/** Seconds of audio kept before the script-start press, so the opening words are not clipped. */
export const SCRIPT_START_MARGIN_SECONDS = 3;
/** Seconds kept after the consent press, so the client's answer is inside the clip. */
export const CONSENT_END_MARGIN_SECONDS = 3;

export type MeetingTimes = {
  startTime: Date | string;
  endTime?: Date | string | null;
};

function toMs(value: Date | string): number {
  return new Date(value).getTime();
}

/** Scheduled end, or start plus an hour when the calendar gave no end. */
export function scheduledEndMs(meeting: MeetingTimes): number {
  const start = toMs(meeting.startTime);
  const end = meeting.endTime ? toMs(meeting.endTime) : NaN;
  return Number.isFinite(end) && end > start ? end : start + DEFAULT_MEETING_LENGTH_MS;
}

/**
 * The card keeps its live controls (status, Send back in, consent) from 5 minutes
 * before the start until 15 minutes after the scheduled end.
 */
export function isInMeetingLiveWindow(meeting: MeetingTimes, now: number = Date.now()): boolean {
  const start = toMs(meeting.startTime);
  return now >= start - LIVE_WINDOW_LEAD_MS && now <= scheduledEndMs(meeting) + LIVE_WINDOW_TAIL_MS;
}

/** The latest moment a held recording waits for a rejoin before the note is made. */
export function rejoinHoldDeadline(meeting: MeetingTimes): Date {
  return new Date(scheduledEndMs(meeting) + LIVE_WINDOW_TAIL_MS);
}

/**
 * Recall sub_codes that mean the meeting itself is over (or the solicitor told
 * LegalNote to leave), so there is nothing to rejoin and the note can be made now.
 */
export const MEETING_OVER_SUB_CODES = [
  "call_ended_by_host",
  "timeout_exceeded_everyone_left",
  "call_ended_by_platform_idle",
  "call_ended_by_platform_max_length",
  "bot_received_leave_call",
] as const;

export function meetingIsOverForSubCode(subCode: string | null | undefined): boolean {
  if (!subCode) return false;
  return (MEETING_OVER_SUB_CODES as readonly string[]).includes(subCode);
}

/**
 * Whether a finished bot recording should wait for a possible rejoin.
 * Only bots sent from a meeting card, that left before the scheduled end for a
 * reason other than the meeting finishing (removed, dropped, errored).
 */
export function holdForRejoinUntil(params: {
  meeting: MeetingTimes | null | undefined;
  subCode: string | null | undefined;
  now?: number;
}): Date | null {
  const { meeting, subCode } = params;
  const now = params.now ?? Date.now();
  if (!meeting) return null;
  if (meetingIsOverForSubCode(subCode)) return null;
  const deadline = rejoinHoldDeadline(meeting);
  return deadline.getTime() > now ? deadline : null;
}

/** Whole seconds from the recording's start to a moment, or null if unknown or before it. */
export function secondsIntoRecording(
  recordingStartedAt: Date | string | null | undefined,
  at: Date | string | null | undefined,
): number | null {
  if (!recordingStartedAt || !at) return null;
  const diff = (toMs(at) - toMs(recordingStartedAt)) / 1000;
  if (!Number.isFinite(diff)) return null;
  // A press a moment before Recall's clock says recording began counts as the start.
  if (diff < -5) return null;
  return Math.max(0, Math.round(diff));
}

/** One bot's recording within a meeting, in the order the bots were sent. */
export type RecordingPart = {
  durationSeconds: number | null | undefined;
  recordingStartedAt?: Date | string | null;
  consentConfirmedAt?: Date | string | null;
  /** Browser-counted fallback, used only when server times are missing. */
  consentElapsedSeconds?: number | null;
  consentScriptStartedAt?: Date | string | null;
};

export type CombinedTimeline = {
  /** Total length of the joined recording, or null when a part's length is unknown. */
  totalSeconds: number | null;
  /** Seconds into the joined recording where consent was confirmed. */
  consentSecond: number | null;
  /** Seconds into the joined recording where the consent script was started. */
  scriptStartSecond: number | null;
  /** Where each part begins in the joined recording. */
  partOffsets: number[];
};

/**
 * Lay the parts end to end and place consent and script start on that timeline.
 * The first consent and first script start count. Server times are preferred;
 * the browser's elapsed count is the fallback for consent only.
 */
export function combineRecordingParts(parts: RecordingPart[]): CombinedTimeline {
  const partOffsets: number[] = [];
  let offset = 0;
  let lengthsKnown = true;
  let consentSecond: number | null = null;
  let scriptStartSecond: number | null = null;

  parts.forEach((part) => {
    partOffsets.push(offset);
    // A later part's times only make sense if every earlier length is known.
    const canPlace = lengthsKnown;

    if (canPlace && consentSecond === null) {
      const fromServer = secondsIntoRecording(part.recordingStartedAt, part.consentConfirmedAt);
      const local =
        fromServer ??
        (typeof part.consentElapsedSeconds === "number" && part.consentElapsedSeconds >= 0
          ? part.consentElapsedSeconds
          : null);
      if (local !== null) consentSecond = offset + local;
    }
    if (canPlace && scriptStartSecond === null) {
      const local = secondsIntoRecording(part.recordingStartedAt, part.consentScriptStartedAt);
      if (local !== null) scriptStartSecond = offset + local;
    }

    const length = typeof part.durationSeconds === "number" && part.durationSeconds > 0 ? part.durationSeconds : null;
    if (length === null) lengthsKnown = false;
    else offset += length;
  });

  // Consent cannot come before the script it answers; ignore a script mark after consent.
  if (scriptStartSecond !== null && consentSecond !== null && scriptStartSecond > consentSecond) {
    scriptStartSecond = null;
  }

  return {
    totalSeconds: lengthsKnown ? offset : null,
    consentSecond,
    scriptStartSecond,
    partOffsets,
  };
}

/**
 * Where to cut the recording. Audio before `trimStartSecond` is dropped (small
 * talk before the script). The consent clip runs from the new start to
 * `consentClipSeconds` into the trimmed audio.
 */
export function consentCutPoints(timeline: Pick<CombinedTimeline, "consentSecond" | "scriptStartSecond">): {
  trimStartSecond: number;
  consentClipSeconds: number | null;
} {
  const trimStartSecond =
    timeline.scriptStartSecond !== null
      ? Math.max(0, timeline.scriptStartSecond - SCRIPT_START_MARGIN_SECONDS)
      : 0;
  const consentClipSeconds =
    timeline.consentSecond !== null
      ? Math.max(1, timeline.consentSecond + CONSENT_END_MARGIN_SECONDS - trimStartSecond)
      : null;
  return { trimStartSecond, consentClipSeconds };
}
