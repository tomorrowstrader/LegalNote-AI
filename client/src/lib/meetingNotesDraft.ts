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

function storageKey(draftKey: MeetingNotesDraftKey): string {
  return `${DRAFT_PREFIX}${draftKey}`;
}

function flushedKey(draftKey: MeetingNotesDraftKey): string {
  return `${FLUSHED_PREFIX}${draftKey}`;
}

export function readMeetingNotesDraft(draftKey: MeetingNotesDraftKey): string {
  try {
    return sessionStorage.getItem(storageKey(draftKey)) ?? "";
  } catch {
    return "";
  }
}

export function writeMeetingNotesDraft(draftKey: MeetingNotesDraftKey, content: string): void {
  try {
    if (!content) {
      sessionStorage.removeItem(storageKey(draftKey));
    } else {
      sessionStorage.setItem(storageKey(draftKey), content);
    }
  } catch {
    // ignore quota / private mode
  }
}

export function clearMeetingNotesDraft(draftKey: MeetingNotesDraftKey): void {
  try {
    sessionStorage.removeItem(storageKey(draftKey));
    sessionStorage.removeItem(flushedKey(draftKey));
  } catch {
    // ignore
  }
}

export function hasMeetingNotesDraft(draftKey: MeetingNotesDraftKey): boolean {
  return readMeetingNotesDraft(draftKey).trim().length > 0;
}

function wasFlushed(draftKey: MeetingNotesDraftKey): boolean {
  try {
    return sessionStorage.getItem(flushedKey(draftKey)) === "1";
  } catch {
    return false;
  }
}

function markFlushed(draftKey: MeetingNotesDraftKey): void {
  try {
    sessionStorage.setItem(flushedKey(draftKey), "1");
  } catch {
    // ignore
  }
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
