/** Preference: auto-enter review mode when documents await adoption. Default on. */
export const AUTO_REVIEW_FIRST_PREF_KEY = "legalnote-auto-review-first";

/** Per-case session flag: user exited review mode this visit — don't auto-reenter. */
export function reviewFirstExitedKey(caseId: string): string {
  return `legalnote-review-first-exited-${caseId}`;
}

export function isAutoReviewFirstEnabled(): boolean {
  try {
    return localStorage.getItem(AUTO_REVIEW_FIRST_PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setAutoReviewFirstEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_REVIEW_FIRST_PREF_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function wasReviewFirstExitedThisVisit(caseId: string): boolean {
  try {
    return sessionStorage.getItem(reviewFirstExitedKey(caseId)) === "1";
  } catch {
    return false;
  }
}

export function markReviewFirstExitedThisVisit(caseId: string): void {
  try {
    sessionStorage.setItem(reviewFirstExitedKey(caseId), "1");
  } catch {
    /* ignore */
  }
}

export function clearReviewFirstExitedThisVisit(caseId: string): void {
  try {
    sessionStorage.removeItem(reviewFirstExitedKey(caseId));
  } catch {
    /* ignore */
  }
}

/** Persist waveform expand/collapse on the casefile audio player. */
export const CASE_AUDIO_EXPANDED_KEY = "legalnote-case-audio-expanded";

export function isCaseAudioExpanded(): boolean {
  try {
    return localStorage.getItem(CASE_AUDIO_EXPANDED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setCaseAudioExpanded(expanded: boolean): void {
  try {
    localStorage.setItem(CASE_AUDIO_EXPANDED_KEY, expanded ? "1" : "0");
  } catch {
    /* ignore */
  }
}
