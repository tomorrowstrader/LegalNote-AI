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

/** After first successful adopt, use the short "I Adopt" label. */
export const SHORT_ADOPT_LABEL_KEY = "legalnote-adopt-label-short";

export function hasUsedShortAdoptLabel(): boolean {
  try {
    return localStorage.getItem(SHORT_ADOPT_LABEL_KEY) === "1";
  } catch {
    return false;
  }
}

export function markShortAdoptLabelUsed(): void {
  try {
    localStorage.setItem(SHORT_ADOPT_LABEL_KEY, "1");
  } catch {
    /* ignore */
  }
}
