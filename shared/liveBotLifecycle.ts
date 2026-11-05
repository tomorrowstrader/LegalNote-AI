/**
 * Shared live-bot lifecycle constants and abandon/timeout messaging.
 * Keep client wait UI and Recall createBot automatic_leave in sync.
 */

/**
 * Cron deploys auto-record bots up to BOT_DEPLOY_LEAD_MINUTES before start.
 * Waiting-room timeout must exceed lead + grace so a bot is not ejected while
 * the host is still expected to admit it.
 */
export const BOT_DEPLOY_LEAD_MINUTES = 5;

/** If the cron tick missed start, still deploy up to this many minutes after. */
export const BOT_DEPLOY_GRACE_AFTER_START_MINUTES = 10;

/** Seconds LegalNote waits in a waiting room before auto-leaving (Recall). */
export const WAITING_ROOM_TIMEOUT_SEC = 900;

/** Seconds LegalNote waits alone in-call before auto-leaving (Recall). */
export const NOONE_JOINED_TIMEOUT_SEC = 300;

/** Scheduled auto-record: eligible to (re)deploy bot within this window. */
export function isWithinBotDeployWindow(startTime: Date, now: Date = new Date()): boolean {
  const startMs = startTime.getTime();
  const nowMs = now.getTime();
  const leadMs = BOT_DEPLOY_LEAD_MINUTES * 60 * 1000;
  const graceMs = BOT_DEPLOY_GRACE_AFTER_START_MINUTES * 60 * 1000;
  return nowMs >= startMs - leadMs && nowMs <= startMs + graceMs;
}

export const CONSENT_DECLINED_BOT_MESSAGE =
  "Recording was declined by email, so LegalNote will not join this meeting. Send a new consent request if they change their mind.";

/** A decline by email stops the scheduled bot, whether cron or a person deploys it. */
export function consentDeclinedBlocksBot(consentStatus: string | null | undefined): boolean {
  return consentStatus === "declined";
}

/**
 * Recall sub_codes that mean the bot never got in, so no recording can exist.
 * Codes that can also happen mid-recording, such as bot_errored, must not go here:
 * this list stops processing.
 */
export const ABANDONED_MEETING_SUB_CODES = [
  "timeout_exceeded_waiting_room",
  "timeout_exceeded_noone_joined",
  "call_ended_by_platform_waiting_room_timeout",
  "bot_kicked_from_waiting_room",
  "meeting_not_accessible",
  "meeting_requires_sign_in",
  "meeting_requires_registration",
  "meeting_not_found",
  "meeting_link_invalid",
  "meeting_link_expired",
  "meeting_password_incorrect",
  "meeting_locked",
  "meeting_full",
  "meeting_ended",
  "meeting_not_started",
  "failed_to_launch_in_time",
] as const;

export type AbandonedMeetingSubCode = (typeof ABANDONED_MEETING_SUB_CODES)[number];

export function isAbandonedMeetingSubCode(
  subCode: string | null | undefined,
): subCode is AbandonedMeetingSubCode {
  if (!subCode) return false;
  return (ABANDONED_MEETING_SUB_CODES as readonly string[]).includes(subCode);
}

const NOT_CAPTURED = "No recording was captured.";
const OWN_NOTES = "take your own notes for this meeting.";

/** What went wrong and what to do next. Shown to the user as soon as the bot fails. */
export function messageForAbandonedSubCode(subCode: string | null | undefined): string {
  if (subCode?.includes("captcha")) {
    return `The meeting asked LegalNote to pass a security check it can't complete. ${NOT_CAPTURED} Ask the host about their meeting settings, or ${OWN_NOTES}`;
  }
  switch (subCode) {
    case "timeout_exceeded_waiting_room":
    case "call_ended_by_platform_waiting_room_timeout":
      return `LegalNote left the waiting room - the host did not admit it in time. ${NOT_CAPTURED} Ask the host to admit it and try again, or ${OWN_NOTES}`;
    case "bot_kicked_from_waiting_room":
      return `The host removed LegalNote from the waiting room. ${NOT_CAPTURED} Speak to the host before trying again, or ${OWN_NOTES}`;
    case "timeout_exceeded_noone_joined":
      return `LegalNote left because nobody else joined the meeting. ${NOT_CAPTURED} Try again once someone has joined.`;
    case "meeting_requires_sign_in":
      return `This meeting only allows signed-in users, so LegalNote couldn't join. ${NOT_CAPTURED} Ask the host whether they can change this, or ${OWN_NOTES}`;
    case "meeting_not_accessible":
      return `The host's meeting access settings stopped LegalNote joining. ${NOT_CAPTURED} Ask the host whether they can change them, or ${OWN_NOTES}`;
    case "meeting_requires_registration":
      return `This meeting requires registration, so LegalNote couldn't join. ${NOT_CAPTURED} Please ${OWN_NOTES}`;
    case "meeting_not_found":
    case "meeting_link_invalid":
    case "meeting_link_expired":
      return `The meeting link didn't work. ${NOT_CAPTURED} Check the link with the host, correct it in Edit Meeting, and try again.`;
    case "meeting_password_incorrect":
      return `The meeting passcode was rejected. ${NOT_CAPTURED} Check the link with the host, correct it in Edit Meeting, and try again.`;
    case "meeting_locked":
      return `The meeting is locked, so LegalNote couldn't join. ${NOT_CAPTURED} Ask the host to unlock it and try again.`;
    case "meeting_full":
      return `The meeting is full, so LegalNote couldn't join. ${NOT_CAPTURED} Please ${OWN_NOTES}`;
    case "meeting_ended":
      return `The meeting had already ended when LegalNote tried to join. ${NOT_CAPTURED}`;
    case "meeting_not_started":
      return `The meeting hadn't started when LegalNote tried to join. ${NOT_CAPTURED} Try again once it has started.`;
    case "failed_to_launch_in_time":
      return `LegalNote couldn't start in time. ${NOT_CAPTURED} Please try again.`;
    default:
      return `The meeting never started or LegalNote was not admitted. ${NOT_CAPTURED} Try again, or ${OWN_NOTES}`;
  }
}

export const USER_CANCELLED_LIVE_BOT_MESSAGE =
  "Cancelled - LegalNote left before the meeting started. No recording was captured.";

export const CONSENT_DECLINED_LIVE_BOT_MESSAGE =
  "Client declined consent - bot removed from call";

/** Import error messages that mean processing will never complete. */
export function isTerminalImportFailureMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("cancelled") ||
    lower.includes("declined consent") ||
    /waiting room|nobody else joined|never started|not admitted|no recording was captured/i.test(
      lower,
    )
  );
}

export function isUserCancelledImportMessage(message: string | null | undefined): boolean {
  return !!message && message.toLowerCase().includes("cancelled");
}

export function isConsentDeclinedImportMessage(message: string | null | undefined): boolean {
  return !!message && message.includes("declined consent");
}

/** Bot statuses where the solicitor can still cancel before a real recording starts (discards). */
export const CANCELLABLE_BOT_STATUSES = [
  "joining_call",
  "joining",
  "in_waiting_room",
  "in_call_not_recording",
] as const;

export function isCancellableBotStatus(botStatus: string | null | undefined): boolean {
  if (!botStatus) return false;
  return (CANCELLABLE_BOT_STATUSES as readonly string[]).includes(botStatus);
}

/** True when Stop (leave + still process) is appropriate - recording has started. */
export function isStoppableBotStatus(botStatus: string | null | undefined): boolean {
  return botStatus === "in_call_recording";
}

/**
 * Auto-leave deadline (seconds from deploy) for the current wait state.
 * Waiting room → 10 min; alone in call → 5 min; otherwise null.
 */
export function autoLeaveDeadlineSeconds(botStatus: string | null | undefined): number | null {
  if (botStatus === "in_waiting_room" || botStatus === "joining_call" || botStatus === "joining") {
    return WAITING_ROOM_TIMEOUT_SEC;
  }
  if (botStatus === "in_call_not_recording") {
    return NOONE_JOINED_TIMEOUT_SEC;
  }
  return null;
}

export function formatWaitRemaining(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
