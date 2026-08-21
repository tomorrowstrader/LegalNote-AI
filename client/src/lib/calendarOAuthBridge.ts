/**
 * Calendar OAuth popup ↔ opener bridge.
 *
 * Microsoft (and some browsers) apply Cross-Origin-Opener-Policy on the login
 * page, which permanently nullifies `window.opener` after the redirect chain.
 * BroadcastChannel works same-origin regardless of opener, so parents must
 * listen here as well as (optionally) via postMessage.
 */

export const CALENDAR_OAUTH_CHANNEL = "legalnote-calendar-oauth";
export const CALENDAR_OAUTH_SOURCE = "calendar-oauth-callback";
export const CALENDAR_OAUTH_POPUP_FLAG = "legalnote_calendar_oauth_popup";

export type CalendarOAuthMessage = {
  source: typeof CALENDAR_OAUTH_SOURCE;
  success: boolean;
  provider?: string;
  error?: string;
  syncSuccess?: boolean;
  syncError?: string | null;
  caseId?: string | null;
};

export function isCalendarOAuthPopupWindow(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("popup") === "1") return true;
  } catch {
    /* ignore */
  }
  if (/^(google|outlook)-oauth$/i.test(window.name)) return true;
  try {
    if (sessionStorage.getItem(CALENDAR_OAUTH_POPUP_FLAG) === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Call from the opener right after window.open, while the popup is still blank/same-origin. */
export function markCalendarOAuthPopup(popup: Window): void {
  try {
    popup.sessionStorage.setItem(CALENDAR_OAUTH_POPUP_FLAG, "1");
  } catch {
    /* ignore — cross-origin or storage blocked */
  }
}

export function clearCalendarOAuthPopupMark(): void {
  try {
    sessionStorage.removeItem(CALENDAR_OAUTH_POPUP_FLAG);
  } catch {
    /* ignore */
  }
}

export function publishCalendarOAuthResult(
  message: Omit<CalendarOAuthMessage, "source">,
): void {
  const payload: CalendarOAuthMessage = {
    source: CALENDAR_OAUTH_SOURCE,
    ...message,
  };

  try {
    const channel = new BroadcastChannel(CALENDAR_OAUTH_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  } catch {
    /* BroadcastChannel unsupported */
  }

  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(payload, window.location.origin);
    } catch {
      /* opener inaccessible */
    }
  }
}

export function subscribeCalendarOAuthResult(
  handler: (message: CalendarOAuthMessage) => void,
): () => void {
  let lastKey = "";
  let lastAt = 0;

  const deliver = (data: CalendarOAuthMessage) => {
    // Both BroadcastChannel and postMessage may fire when opener still exists.
    const key = JSON.stringify(data);
    const now = Date.now();
    if (key === lastKey && now - lastAt < 2500) return;
    lastKey = key;
    lastAt = now;
    handler(data);
  };

  const onWindowMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.source !== CALENDAR_OAUTH_SOURCE) return;
    deliver(data as CalendarOAuthMessage);
  };

  window.addEventListener("message", onWindowMessage);

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CALENDAR_OAUTH_CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== CALENDAR_OAUTH_SOURCE) return;
      deliver(data as CalendarOAuthMessage);
    };
  } catch {
    /* BroadcastChannel unsupported */
  }

  return () => {
    window.removeEventListener("message", onWindowMessage);
    channel?.close();
  };
}

/** Best-effort close after notifying the opener; browsers may block if not user-initiated. */
export function closeCalendarOAuthPopup(): void {
  clearCalendarOAuthPopupMark();
  try {
    window.close();
  } catch {
    /* ignore */
  }
}
