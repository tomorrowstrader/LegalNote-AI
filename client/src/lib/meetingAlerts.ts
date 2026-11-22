/**
 * Desktop alerts for a live meeting. The solicitor is looking at Zoom or Teams,
 * not the LegalNote tab, so the moment LegalNote is admitted they need telling.
 */

export function desktopAlertsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Ask once, from a click (browsers ignore requests made without one). */
export async function askForMeetingAlerts(): Promise<void> {
  if (!desktopAlertsSupported()) return;
  if (Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {
    // Older browsers use a callback form; not worth supporting.
  }
}

function alreadyAlerted(key: string): boolean {
  try {
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, "1");
  } catch {
    // Storage blocked: alert anyway.
  }
  return false;
}

/**
 * "LegalNote is in - read the consent script now." Once per bot. Clicking it
 * brings the LegalNote tab forward. Also flashes the tab title as a fallback
 * when alerts are blocked.
 */
export function alertLegalNoteAdmitted(params: { importId: string; participantNotice?: boolean }): void {
  if (typeof window === "undefined") return;
  if (alreadyAlerted(`ln-admitted-alert-${params.importId}`)) return;

  const body = params.participantNotice
    ? "Read the participant notice to everyone now, before the meeting gets going."
    : "Read the consent script to your client now, before the meeting gets going.";

  if (desktopAlertsSupported() && Notification.permission === "granted") {
    try {
      const n = new Notification("LegalNote is in the meeting", {
        body,
        tag: `ln-admitted-${params.importId}`,
        requireInteraction: true,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      // Some browsers only allow notifications from a service worker.
    }
  }

  if (document.hidden) flashTitle("LegalNote is in - read consent");
}

function flashTitle(message: string): void {
  const original = document.title;
  let on = false;
  const id = window.setInterval(() => {
    document.title = on ? original : message;
    on = !on;
  }, 1000);
  const stop = () => {
    window.clearInterval(id);
    document.title = original;
    document.removeEventListener("visibilitychange", onVisible);
  };
  const onVisible = () => {
    if (!document.hidden) stop();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.setTimeout(stop, 5 * 60 * 1000);
}
