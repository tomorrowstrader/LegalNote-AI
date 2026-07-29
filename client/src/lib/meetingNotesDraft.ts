import { apiRequest, queryClient } from "@/lib/queryClient";

const DRAFT_PREFIX = "ln-meeting-notes:";
const FLUSHED_PREFIX = "ln-meeting-notes-flushed:";

export type MeetingNotesDraftKey =
  | `live:${string}`
  | `session:${string}`;

export function liveBotDraftKey(importId: string): MeetingNotesDraftKey {
  return `live:${importId}`;
}

export function newSessionDraftKey(caseId: string): MeetingNotesDraftKey {
  return `session:${caseId}`;
}

/** Unique per Capture/mic recording so a leftover pop-out cannot keep a stale timer. */
export function captureRecordingDraftKey(sessionToken: string): MeetingNotesDraftKey {
  return `session:rec-${sessionToken}`;
}

function storageKey(draftKey: MeetingNotesDraftKey): string {
  return `${DRAFT_PREFIX}${draftKey}`;
}

function flushedKey(draftKey: MeetingNotesDraftKey): string {
  return `${FLUSHED_PREFIX}${draftKey}`;
}

function readFrom(store: Storage, key: string): string {
  try {
    return store.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeTo(store: Storage, key: string, content: string): void {
  try {
    if (!content) {
      store.removeItem(key);
    } else {
      store.setItem(key, content);
    }
  } catch {
    // ignore quota / private mode
  }
}

/**
 * localStorage so the main app and a pop-out companion window share the same draft.
 * Migrates any legacy sessionStorage draft on first read.
 */
export function readMeetingNotesDraft(draftKey: MeetingNotesDraftKey): string {
  const key = storageKey(draftKey);
  try {
    const fromLocal = localStorage.getItem(key);
    if (fromLocal != null) return fromLocal;

    const fromSession = sessionStorage.getItem(key);
    if (fromSession) {
      localStorage.setItem(key, fromSession);
      sessionStorage.removeItem(key);
      return fromSession;
    }
    return "";
  } catch {
    return readFrom(sessionStorage, key);
  }
}

export function writeMeetingNotesDraft(draftKey: MeetingNotesDraftKey, content: string): void {
  const key = storageKey(draftKey);
  try {
    writeTo(localStorage, key, content);
    // Clear legacy session copy so windows don't diverge
    sessionStorage.removeItem(key);
  } catch {
    writeTo(sessionStorage, key, content);
  }
}

export function clearMeetingNotesDraft(draftKey: MeetingNotesDraftKey): void {
  const key = storageKey(draftKey);
  const flushed = flushedKey(draftKey);
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(flushed);
    sessionStorage.removeItem(key);
    sessionStorage.removeItem(flushed);
  } catch {
    // ignore
  }
}

export function hasMeetingNotesDraft(draftKey: MeetingNotesDraftKey): boolean {
  return readMeetingNotesDraft(draftKey).trim().length > 0;
}

function wasFlushed(draftKey: MeetingNotesDraftKey): boolean {
  try {
    return (
      localStorage.getItem(flushedKey(draftKey)) === "1" ||
      sessionStorage.getItem(flushedKey(draftKey)) === "1"
    );
  } catch {
    return false;
  }
}

function markFlushed(draftKey: MeetingNotesDraftKey): void {
  try {
    localStorage.setItem(flushedKey(draftKey), "1");
  } catch {
    try {
      sessionStorage.setItem(flushedKey(draftKey), "1");
    } catch {
      // ignore
    }
  }
}

/**
 * Subscribe to draft changes from other windows (pop-out ↔ main).
 * Does not fire for writes in the same window.
 */
export function subscribeMeetingNotesDraft(
  draftKey: MeetingNotesDraftKey,
  onChange: (content: string) => void,
): () => void {
  const key = storageKey(draftKey);
  const handler = (e: StorageEvent) => {
    if (e.storageArea !== localStorage) return;
    if (e.key !== key) return;
    onChange(e.newValue ?? "");
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function formatMeetingNoteHeader(caseTitle?: string | null): string {
  const when = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const matter = caseTitle?.trim() ? ` · ${caseTitle.trim()}` : "";
  return `Meeting notes — ${when}${matter}`;
}

/**
 * Posts a non-empty draft to the case Notes section (quick_notes) and clears local storage.
 * Safe to call multiple times — only flushes once per draft key.
 */
export async function flushMeetingNotesToCase(opts: {
  caseId: string;
  draftKey: MeetingNotesDraftKey;
  caseTitle?: string | null;
}): Promise<boolean> {
  const { caseId, draftKey, caseTitle } = opts;
  if (!caseId || wasFlushed(draftKey)) return false;

  const body = readMeetingNotesDraft(draftKey).trim();
  if (!body) {
    clearMeetingNotesDraft(draftKey);
    return false;
  }

  const content = `${formatMeetingNoteHeader(caseTitle)}\n\n${body}`;
  await apiRequest("POST", `/api/cases/${caseId}/quick-notes`, { content });
  markFlushed(draftKey);
  writeMeetingNotesDraft(draftKey, "");
  queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/quick-notes`] });
  queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
  return true;
}

/** Flush after a live-bot import is assigned to a matter (allocate-later path). */
export async function flushLiveBotNotesOnAssign(
  importId: string,
  caseId: string,
  caseTitle?: string | null,
): Promise<boolean> {
  return flushMeetingNotesToCase({
    caseId,
    draftKey: liveBotDraftKey(importId),
    caseTitle,
  });
}
