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

const PENDING_WINDOW_NAME = "ln-meeting-notes-pending";

/**
 * Opens a blank companion window synchronously (must run in a user-gesture stack).
 * Call {@link activateMeetingNotesPopout} once the importId / draft key is known.
 * Returns null if the browser blocked the popup.
 */
export function reserveMeetingNotesPopout(): Window | null {
  const win = window.open("about:blank", PENDING_WINDOW_NAME, POPOUT_FEATURES);
  if (!win) return null;
  try {
    win.document.write(
      `<!doctype html><title>Meeting notes — LegalNote</title>` +
        `<body style="margin:0;font:14px/1.45 system-ui,sans-serif;color:#334155;background:#f8fafc;` +
        `display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center">` +
        `<p>Opening LegalNote meeting notes…</p></body>`,
    );
    win.document.close();
  } catch {
    // ignore — navigation will replace about:blank shortly
  }
  try {
    win.focus();
  } catch {
    // ignore
  }
  return win;
}

/**
 * Navigates a reserved (or any) window to the notes companion route and registers it.
 */
export function activateMeetingNotesPopout(
  win: Window,
  opts: {
    draftKey: MeetingNotesDraftKey;
    caseTitle?: string | null;
    liveLabel?: string | null;
    elapsedSeconds?: number;
  },
): boolean {
  if (win.closed) return false;
  const url = new URL(buildMeetingNotesPopoutUrl(opts), window.location.origin).href;
  try {
    win.location.href = url;
  } catch {
    return false;
  }
  openWindows.set(opts.draftKey, win);
  try {
    win.focus();
  } catch {
    // ignore
  }
  return true;
}

function closeReservedPopout(win: Window | null | undefined): void {
  if (!win || win.closed) return;
  try {
    win.close();
  } catch {
    // ignore
  }
}

/** Close a window reserved before deploy if the bot send failed or was abandoned. */
export function discardReservedMeetingNotesPopout(win: Window | null | undefined): void {
  closeReservedPopout(win);
}

/**
 * Opens (or focuses) the companion notes window for this draft.
 * Returns null if the browser blocked the popup.
 */
export function openMeetingNotesPopout(opts: {
  draftKey: MeetingNotesDraftKey;
  caseTitle?: string | null;
  liveLabel?: string | null;
  elapsedSeconds?: number;
  /** Optional window reserved via {@link reserveMeetingNotesPopout} during a user gesture. */
  reservedWindow?: Window | null;
}): Window | null {
  const name = popoutWindowName(opts.draftKey);
  const existing = openWindows.get(opts.draftKey);
  if (existing && !existing.closed) {
    if (opts.reservedWindow && opts.reservedWindow !== existing) {
      closeReservedPopout(opts.reservedWindow);
    }
    // Always navigate — same named window may still hold React state from a prior recording
    // (URL query often unchanged at elapsed=0, so window.open alone may not remount).
    if (!activateMeetingNotesPopout(existing, opts)) {
      closeReservedPopout(existing);
      openWindows.delete(opts.draftKey);
    } else {
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
  }

  if (opts.reservedWindow && !opts.reservedWindow.closed) {
    if (activateMeetingNotesPopout(opts.reservedWindow, opts)) {
      return opts.reservedWindow;
    }
  }

  const url = buildMeetingNotesPopoutUrl(opts);
  const win = window.open(url, name, POPOUT_FEATURES);
  if (!win) {
    closeReservedPopout(opts.reservedWindow);
    return null;
  }

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
