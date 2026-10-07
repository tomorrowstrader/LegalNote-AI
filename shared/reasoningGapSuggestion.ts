/**
 * Choosing which passages on a matter may support a drafted reason,
 * and checking that a draft stays inside those passages.
 */

import {
  resolveGapTranscriptEvidence,
  type GapTranscriptUtterance,
} from "./reasoningGapEvidence";

/** Stricter than the on-screen "what was said" peek. A weak overlap is not a source. */
export const SUGGESTION_MIN_SCORE = 0.5;

export type GapSuggestionPassage = {
  sessionId: string;
  sessionLabel: string;
  dateLabel: string;
  earlier: boolean;
  kind: "transcript" | "attendance_note";
  text: string;
  score: number;
};

export type GapSuggestionCandidate = {
  sessionId: string;
  sessionLabel: string;
  dateLabel: string;
  earlier: boolean;
  kind: "transcript" | "attendance_note";
  utterances: GapTranscriptUtterance[];
};

const FRAMING_WORDS = new Set([
  "follows",
  "reasoning",
  "meeting",
  "advised",
  "considered",
  "recorded",
  "given",
  "earlier",
  "advice",
  "where",
  "which",
  "about",
  "their",
  "there",
  "would",
  "could",
  "should",
  "having",
  "because",
  "client",
  "march",
  "april",
  "january",
  "february",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]);

export function suggestionSourceLabel(passage: Pick<GapSuggestionPassage, "earlier" | "kind" | "dateLabel">): string {
  if (!passage.earlier) return "From this meeting.";
  if (passage.kind === "attendance_note") return `From the attendance note of ${passage.dateLabel}.`;
  return `From the meeting on ${passage.dateLabel}.`;
}

function windowText(utterances: GapTranscriptUtterance[], start: number, end: number): string {
  return utterances
    .slice(start, end + 1)
    .map((utterance) => utterance.text.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 1200);
}

/** Keep the strongest passages. This meeting's transcript comes before an earlier note. */
export function selectSuggestionPassages(
  gapLabel: string,
  candidates: GapSuggestionCandidate[],
  limit = 3,
): GapSuggestionPassage[] {
  const found: GapSuggestionPassage[] = [];
  for (const candidate of candidates) {
    if (!candidate.utterances.length) continue;
    const evidence = resolveGapTranscriptEvidence(gapLabel, candidate.utterances, {
      minScore: SUGGESTION_MIN_SCORE,
      contextRadius: candidate.kind === "attendance_note" ? 1 : 2,
    });
    if (!evidence) continue;
    const text = windowText(candidate.utterances, evidence.contextStart, evidence.contextEnd);
    if (!text) continue;
    found.push({
      sessionId: candidate.sessionId,
      sessionLabel: candidate.sessionLabel,
      dateLabel: candidate.dateLabel,
      earlier: candidate.earlier,
      kind: candidate.kind,
      text,
      score: evidence.score,
    });
  }

  found.sort((a, b) => {
    if (a.earlier !== b.earlier) return a.earlier ? 1 : -1;
    if (!a.earlier && a.kind !== b.kind) return a.kind === "transcript" ? -1 : 1;
    if (a.earlier && a.kind !== b.kind) return a.kind === "attendance_note" ? -1 : 1;
    return b.score - a.score;
  });

  return found.slice(0, limit);
}

export function quoteAppearsInPassage(quote: string, passage: string): boolean {
  const needle = quote.replace(/\s+/g, " ").trim().toLowerCase();
  if (needle.length < 12) return false;
  return passage.replace(/\s+/g, " ").toLowerCase().includes(needle);
}

/** True when the draft's substantive words are already in the passages it claims to use. */
export function suggestionDraftIsGrounded(draft: string, passages: GapSuggestionPassage[]): boolean {
  const haystack = passages
    .map((passage) => `${passage.text} ${passage.dateLabel} ${passage.sessionLabel}`)
    .join(" ")
    .toLowerCase();
  const words = draft
    .toLowerCase()
    .split(/[^a-z0-9£$]+/i)
    .filter((word) => word.length >= 5 && !FRAMING_WORDS.has(word));
  if (words.length === 0) return false;
  const hits = words.filter((word) => haystack.includes(word)).length;
  return hits / words.length >= 0.6;
}
