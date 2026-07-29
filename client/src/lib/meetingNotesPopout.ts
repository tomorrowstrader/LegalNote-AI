import type { MeetingNotesDraftKey } from "@/lib/meetingNotesDraft";

const CHANNEL_NAME = "ln-meeting-notes-popout";
const WINDOW_NAME_PREFIX = "ln-meeting-notes-";

export type MeetingNotesPopoutMessage =
  | { type: "presence"; draftKey: MeetingNotesDraftKey; open: boolean }
  | { type: "elapsed"; draftKey: MeetingNotesDraftKey; seconds: number }
  | { type: "meta"; draftKey: MeetingNotesDraftKey; caseTitle: string | null; liveLabel?: string | null }
  | { type: "close-request"; draftKey: MeetingNotesDraftKey }
  | { type: "focus-request"; draftKey: MeetingNotesDraftKey }
  | { type: "dock-request"; draftKey: MeetingNotesDraftKey };

const openWindows = new Map<string, Window>();

function getChannel(): BroadcastChannel | null {
  try {
    if (typeof BroadcastChannel === "undefined") return null;
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
}

export function popoutWindowName(draftKey: MeetingNotesDraftKey): string {
  return `${WINDOW_NAME_PREFIX}${draftKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function buildMeetingNotesPopoutUrl(opts: {
  draftKey: MeetingNotesDraftKey;
  caseTitle?: string | null;
  liveLabel?: string | null;
  elapsedSeconds?: number;
}): string {
  const params = new URLSearchParams();
  params.set("draftKey", opts.draftKey);
  if (opts.caseTitle?.trim()) params.set("caseTitle", opts.caseTitle.trim());
  if (opts.liveLabel?.trim()) params.set("liveLabel", opts.liveLabel.trim());
  if (typeof opts.elapsedSeconds === "number") {
    params.set("elapsed", String(Math.max(0, Math.floor(opts.elapsedSeconds))));
  }
  return `/meeting-notes-popout?${params.toString()}`;
}

const POPOUT_FEATURES =
  "popup=yes,width=420,height=680,resizable=yes,scrollbars=yes";

/**
 * Opens (or focuses) the companion notes window for this draft.
 * Returns null if the browser blocked the popup.
 */
export function openMeetingNotesPopout(opts: {
  draftKey: MeetingNotesDraftKey;
  caseTitle?: string | null;
  liveLabel?: string | null;
  elapsedSeconds?: number;
}): Window | null {
  const name = popoutWindowName(opts.draftKey);
  const existing = openWindows.get(opts.draftKey);
  if (existing && !existing.closed) {
    existing.focus();
    publishMeetingNotesPopout({
      type: "meta",
      draftKey: opts.draftKey,
      caseTitle: opts.caseTitle ?? null,
      liveLabel: opts.liveLabel ?? null,
    });
    if (typeof opts.elapsedSeconds === "number") {
      publishMeetingNotesPopout({
        type: "elapsed",
        draftKey: opts.draftKey,
        seconds: opts.elapsedSeconds,
      });
    }
    return existing;
  }

  const url = buildMeetingNotesPopoutUrl(opts);
  const win = window.open(url, name, POPOUT_FEATURES);
  if (!win) return null;

  openWindows.set(opts.draftKey, win);
  try {
    win.focus();
  } catch {
    // ignore
  }
  return win;
}

export function focusMeetingNotesPopout(draftKey: MeetingNotesDraftKey): boolean {
  const existing = openWindows.get(draftKey);
  if (existing && !existing.closed) {
    existing.focus();
    return true;
  }
  publishMeetingNotesPopout({ type: "focus-request", draftKey });
  return false;
}

export function isMeetingNotesPopoutWindowOpen(draftKey: MeetingNotesDraftKey): boolean | null {
  const existing = openWindows.get(draftKey);
  if (!existing) return null; // unknown — rely on BroadcastChannel presence
  if (existing.closed) {
    openWindows.delete(draftKey);
    return false;
  }
  return true;
}

export function requestCloseMeetingNotesPopout(draftKey: MeetingNotesDraftKey): void {
  const existing = openWindows.get(draftKey);
  if (existing && !existing.closed) {
    try {
      existing.close();
    } catch {
      // ignore
    }
  }
  openWindows.delete(draftKey);
  publishMeetingNotesPopout({ type: "close-request", draftKey });
}

export function publishMeetingNotesPopout(message: MeetingNotesPopoutMessage): void {
  const channel = getChannel();
  if (!channel) return;
  try {
    channel.postMessage(message);
  } finally {
    channel.close();
  }
}

export function subscribeMeetingNotesPopout(
  onMessage: (message: MeetingNotesPopoutMessage) => void,
): () => void {
  const channel = getChannel();
  if (!channel) return () => {};

  const handler = (event: MessageEvent<MeetingNotesPopoutMessage>) => {
    if (!event.data || typeof event.data !== "object" || !("type" in event.data)) return;
    onMessage(event.data);
  };
  channel.addEventListener("message", handler);
  return () => {
    channel.removeEventListener("message", handler);
    channel.close();
  };
}

export function isMeetingNotesPopoutRoute(pathname: string): boolean {
  return pathname === "/meeting-notes-popout" || pathname.startsWith("/meeting-notes-popout?");
}
