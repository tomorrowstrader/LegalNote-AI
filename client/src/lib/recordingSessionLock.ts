/** Mutual exclusion so Quick Record and New Note cannot capture at once. */
export type RecordingSource = "quick_record" | "new_note";

let holder: RecordingSource | null = null;

export function tryAcquireRecordingLock(source: RecordingSource): boolean {
  if (holder && holder !== source) return false;
  holder = source;
  return true;
}

export function releaseRecordingLock(source: RecordingSource): void {
  if (holder === source) holder = null;
}

export function getActiveRecordingSource(): RecordingSource | null {
  return holder;
}
