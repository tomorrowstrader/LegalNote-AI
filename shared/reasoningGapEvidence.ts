/**
 * Transcript evidence pointers for REASONING_GAP markers.
 *
 * Stored as sibling HTML comments immediately after each gap marker:
 *   <!-- REASONING_GAP: SECTION: advice point -->
 *   <!-- RGAP_EVIDENCE: {"utteranceIndex":12,"quote":"...","startMs":45000,...} -->
 *
 * Resolution matches gap labels (section + advice citation) against utterances
 * so solicitors can peek at what was said without leaving the gap panel.
 */

export type GapTranscriptUtterance = {
  speaker?: string;
  text: string;
  start: number;
  end: number;
};

export type GapTranscriptEvidence = {
  /** Best-matching utterance index in the meeting record. */
  utteranceIndex: number;
  /** Inclusive start of the ±context window. */
  contextStart: number;
  /** Inclusive end of the ±context window. */
  contextEnd: number;
  /** Short quote from the matched utterance (for display / seek). */
  quote: string;
  /**
   * Wall-clock ms when the transcript has a real timeline (recordings).
   * Null for ordinal / upload transcripts without usable audio times.
   */
  startMs: number | null;
  endMs: number | null;
  /** 0–1 keyword hit ratio used to decide whether a match is reliable enough. */
  score: number;
};

export type GapWithEvidence = {
  label: string;
  evidence: GapTranscriptEvidence | null;
};

const EVIDENCE_COMMENT_RE =
  /<!--\s*RGAP_EVIDENCE:\s*(\{[\s\S]*?\})\s*-->/g;

const GAP_MARKER_RE =
  /<!--\s*REASONING_GAP:\s*(.+?)\s*-->|&lt;!--\s*REASONING_GAP:\s*(.+?)\s*--&gt;|\{\{RGAP:((?:\\.|[^}])+)\}\}/g;

const STOPWORDS = new Set([
  "that",
  "this",
  "with",
  "from",
  "into",
  "have",
  "been",
  "were",
  "their",
  "about",
  "whether",
  "specific",
  "options",
  "outlined",
  "treatment",
  "potential",
  "further",
  "steps",
  "taken",
  "respect",
  "advice",
  "point",
  "client",
  "should",
  "would",
  "could",
  "must",
  "being",
  "under",
  "over",
  "than",
  "then",
  "also",
  "only",
  "such",
  "onto",
  "make",
  "made",
  "doing",
  "does",
  "what",
  "when",
  "where",
  "which",
  "there",
  "here",
  "your",
  "them",
  "they",
  "just",
  "very",
  "much",
  "more",
  "some",
  "any",
]);

/** Minimum keyword hit ratio to treat a transcript match as usable. */
export const GAP_EVIDENCE_MIN_SCORE = 0.34;

const DEFAULT_CONTEXT_RADIUS = 2;

function decodeGapLabel(encoded: string): string {
  return encoded
    .replace(/\\\}/g, "}")
    .replace(/\\\{/g, "{")
    .replace(/\\\\/g, "\\");
}

function stripReasoningPrefix(detail: string): string {
  return detail
    .replace(/^reasoning\s+behind\s+advice\s+as\s+to\s+/i, "")
    .replace(/^reasoning\s+behind\s+advice\s+(?:on|regarding|concerning|for|about)\s+/i, "")
    .replace(/^reasoning\s+behind\s+(?:the\s+)?/i, "")
    .replace(/^reasoning\s+for\s+(?:the\s+)?/i, "")
    .replace(/^advice\s+as\s+to\s+/i, "")
    .trim();
}

export function splitGapLabelForEvidence(rawLabel: string): {
  section: string;
  detail: string;
  citation: string;
} {
  const colonIdx = rawLabel.indexOf(":");
  const section = (colonIdx === -1 ? rawLabel : rawLabel.slice(0, colonIdx)).trim();
  const detail = colonIdx === -1 ? "" : rawLabel.slice(colonIdx + 1).trim();
  const citation = stripReasoningPrefix(detail) || section || "";
  return { section, detail, citation };
}

export function extractGapEvidenceKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9£$]+/i)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

function keywordScore(haystack: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const text = haystack.toLowerCase();
  let hits = 0;
  for (const w of keywords) {
    if (text.includes(w)) hits++;
  }
  return hits / keywords.length;
}

/**
 * True when utterance start/end look like wall-clock milliseconds
 * (AssemblyAI / LegalNote recordings), not ordinal upload indices.
 */
export function utterancesHaveRealTimestamps(
  utterances: GapTranscriptUtterance[],
): boolean {
  if (utterances.length === 0) return false;
  const maxStart = Math.max(...utterances.map((u) => u.start));
  // Ordinal uploads use 0..n; real audio ms for a short call already exceeds n*20.
  return maxStart > Math.max(utterances.length * 20, 5_000);
}

function clipQuote(text: string, maxLen = 160): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trim()}…`;
}

/**
 * Find the best transcript stretch for a single reasoning-gap label.
 * Returns null when confidence is too low (honest empty state for the UI).
 */
export function resolveGapTranscriptEvidence(
  gapLabel: string,
  utterances: GapTranscriptUtterance[],
  opts?: { contextRadius?: number; minScore?: number },
): GapTranscriptEvidence | null {
  if (!gapLabel.trim() || utterances.length === 0) return null;

  const { section, citation } = splitGapLabelForEvidence(gapLabel);
  const citationKeywords = extractGapEvidenceKeywords(citation);
  const sectionKeywords = extractGapEvidenceKeywords(section);

  // Prefer the advice-point citation; only fall back to section topic words
  // when the citation is too thin (avoids diluting a good match with heading noise).
  const primaryKeywords =
    citationKeywords.length >= 2 ? citationKeywords : [...citationKeywords, ...sectionKeywords];
  const uniquePrimary = Array.from(new Set(primaryKeywords));
  if (uniquePrimary.length === 0) return null;

  const uniqueSection = Array.from(new Set(sectionKeywords));
  let bestIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < utterances.length; i++) {
    const text = utterances[i].text;
    let score = keywordScore(text, uniquePrimary);
    // Soft boost when the section topic also appears nearby (tie-break only).
    if (uniqueSection.length > 0 && score > 0) {
      score += keywordScore(text, uniqueSection) * 0.08;
    }
    // Phrase bonus: a long contiguous slice of the citation appearing verbatim.
    const cite = citation.toLowerCase().replace(/\s+/g, " ").trim();
    if (cite.length >= 12) {
      const hay = text.toLowerCase();
      const slices = [
        cite,
        cite.replace(/^need for (a|an|the)\s+/i, ""),
        ...cite.split(/,\s+/).filter((s) => s.length >= 10),
      ];
      for (const slice of slices) {
        if (slice.length >= 10 && hay.includes(slice)) {
          score = Math.max(score, 0.85);
          break;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  const minScore = opts?.minScore ?? GAP_EVIDENCE_MIN_SCORE;
  if (bestIdx < 0 || bestScore < minScore) return null;

  const radius = opts?.contextRadius ?? DEFAULT_CONTEXT_RADIUS;
  const contextStart = Math.max(0, bestIdx - radius);
  const contextEnd = Math.min(utterances.length - 1, bestIdx + radius);
  const matched = utterances[bestIdx];
  const realTimes = utterancesHaveRealTimestamps(utterances);

  return {
    utteranceIndex: bestIdx,
    contextStart,
    contextEnd,
    quote: clipQuote(matched.text),
    startMs: realTimes ? matched.start : null,
    endMs: realTimes ? matched.end : null,
    score: bestScore,
  };
}

export function resolveAllGapTranscriptEvidence(
  gapLabels: string[],
  utterances: GapTranscriptUtterance[],
  opts?: { contextRadius?: number; minScore?: number },
): Array<GapTranscriptEvidence | null> {
  return gapLabels.map((label) => resolveGapTranscriptEvidence(label, utterances, opts));
}

function parseEvidenceJson(raw: string): GapTranscriptEvidence | null {
  try {
    const parsed = JSON.parse(raw) as Partial<GapTranscriptEvidence>;
    if (
      typeof parsed.utteranceIndex !== "number" ||
      typeof parsed.contextStart !== "number" ||
      typeof parsed.contextEnd !== "number" ||
      typeof parsed.quote !== "string" ||
      typeof parsed.score !== "number"
    ) {
      return null;
    }
    return {
      utteranceIndex: parsed.utteranceIndex,
      contextStart: parsed.contextStart,
      contextEnd: parsed.contextEnd,
      quote: parsed.quote,
      startMs: typeof parsed.startMs === "number" ? parsed.startMs : null,
      endMs: typeof parsed.endMs === "number" ? parsed.endMs : null,
      score: parsed.score,
    };
  } catch {
    return null;
  }
}

export function serializeGapEvidenceComment(evidence: GapTranscriptEvidence): string {
  const payload: GapTranscriptEvidence = {
    utteranceIndex: evidence.utteranceIndex,
    contextStart: evidence.contextStart,
    contextEnd: evidence.contextEnd,
    quote: evidence.quote,
    startMs: evidence.startMs,
    endMs: evidence.endMs,
    score: Math.round(evidence.score * 1000) / 1000,
  };
  return `<!-- RGAP_EVIDENCE: ${JSON.stringify(payload)} -->`;
}

/** Strip all RGAP_EVIDENCE comments (e.g. before re-enrichment). */
export function stripGapEvidenceComments(content: string): string {
  return content.replace(EVIDENCE_COMMENT_RE, "").replace(/\n{3,}/g, "\n\n");
}

/**
 * Parse gap markers in order, attaching an immediately-following evidence
 * comment when present.
 */
export function parseGapsWithEvidence(content: string | null | undefined): GapWithEvidence[] {
  if (!content) return [];

  const gaps: GapWithEvidence[] = [];
  const markerRe = new RegExp(GAP_MARKER_RE.source, "g");
  let match: RegExpExecArray | null;

  while ((match = markerRe.exec(content)) !== null) {
    const label = (match[1] ?? match[2] ?? decodeGapLabel(match[3] ?? "")).trim();
    if (!label) continue;

    const after = content.slice(match.index + match[0].length);
    const evidenceMatch = after.match(/^\s*<!--\s*RGAP_EVIDENCE:\s*(\{[\s\S]*?\})\s*-->/);
    const evidence = evidenceMatch ? parseEvidenceJson(evidenceMatch[1]) : null;
    gaps.push({ label, evidence });
  }

  return gaps;
}

/**
 * Resolve evidence for each gap and write/replace sibling RGAP_EVIDENCE comments.
 * Safe to call on already-enriched content (strips then rewrites).
 */
export function enrichContentWithGapEvidence(
  content: string,
  utterances: GapTranscriptUtterance[],
  opts?: { contextRadius?: number; minScore?: number },
): string {
  if (!content || utterances.length === 0) return content;

  const withoutEvidence = stripGapEvidenceComments(content);
  const markerRe = new RegExp(GAP_MARKER_RE.source, "g");
  let result = "";
  let lastIndex = 0;
  let gapIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = markerRe.exec(withoutEvidence)) !== null) {
    result += withoutEvidence.slice(lastIndex, match.index + match[0].length);
    const label = (match[1] ?? match[2] ?? decodeGapLabel(match[3] ?? "")).trim();
    const evidence = label
      ? resolveGapTranscriptEvidence(label, utterances, opts)
      : null;
    if (evidence) {
      result += `\n${serializeGapEvidenceComment(evidence)}`;
    }
    lastIndex = match.index + match[0].length;
    gapIndex++;
  }

  result += withoutEvidence.slice(lastIndex);
  return gapIndex === 0 ? content : result;
}

/**
 * Remove the nth REASONING_GAP marker and its following RGAP_EVIDENCE comment
 * (if any), replacing the marker with `replacement` text.
 */
export function replaceGapMarkerAndEvidence(
  content: string,
  targetIdx: number,
  replacement: string,
): string {
  const markerRe = /<!--\s*REASONING_GAP:\s*.+?\s*-->/g;
  let count = 0;
  let match: RegExpExecArray | null;

  while ((match = markerRe.exec(content)) !== null) {
    if (count === targetIdx) {
      let end = match.index + match[0].length;
      const after = content.slice(end);
      const evidenceMatch = after.match(/^\s*<!--\s*RGAP_EVIDENCE:\s*\{[\s\S]*?\}\s*-->/);
      if (evidenceMatch) {
        end += evidenceMatch[0].length;
      }
      return content.slice(0, match.index) + replacement + content.slice(end);
    }
    count++;
  }
  return content;
}

/**
 * Prefer stored evidence; fall back to live resolution so older notes still work.
 */
export function evidenceForGap(
  stored: GapTranscriptEvidence | null | undefined,
  gapLabel: string,
  utterances: GapTranscriptUtterance[] | null | undefined,
): GapTranscriptEvidence | null {
  if (stored && typeof stored.utteranceIndex === "number") return stored;
  if (!utterances?.length) return null;
  return resolveGapTranscriptEvidence(gapLabel, utterances);
}
