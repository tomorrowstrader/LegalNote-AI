import { normalizePersonName } from "./meetingCast";

/**
 * Exact, reviewable edits to a note. The model may only propose quotes that
 * already appear in the text. Everything else is left untouched.
 */

export interface NoteProposal {
  original: string;
  replacement: string;
  reason: string;
  /** "before" inserts the replacement ahead of the anchor and leaves the anchor in place. */
  placement?: "replace" | "before";
}

/** Who an existing note is about, applied as tracked changes rather than a rewrite. */
export interface NoteRole {
  clientName: string;
  instructionsTaken: boolean;
  clientPresent: boolean;
  representativeName: string;
  adviserIsFeeEarner: boolean;
  adviserName: string;
  attendees: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Markdown attendance note reduced to the words a reader sees. */
export function attendanceNoteToPlain(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\{\{RGAP:[\s\S]*?\}\}/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\r\n/g, "\n");
}

const FOLDED_PUNCTUATION: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201a": "'",
  "\u201b": "'",
  "\u2032": "'",
  "\u201c": '"',
  "\u201d": '"',
  "\u201e": '"',
  "\u2033": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u00a0": " ",
};

function foldMatchChar(char: string): string {
  const mapped = FOLDED_PUNCTUATION[char];
  if (mapped) return mapped;
  return /\s/.test(char) ? " " : char;
}

interface FoldedText {
  text: string;
  starts: number[];
  ends: number[];
}

/** Collapse whitespace and curly quotes so a selection can be found in the note. */
function foldText(value: string): FoldedText {
  const chars: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  let spaceAt = -1;
  for (let i = 0; i < value.length; i++) {
    const folded = foldMatchChar(value[i]);
    if (folded === " ") {
      if (chars.length > 0 && spaceAt < 0) spaceAt = i;
      continue;
    }
    if (spaceAt >= 0) {
      chars.push(" ");
      starts.push(spaceAt);
      ends.push(i);
      spaceAt = -1;
    }
    chars.push(folded);
    starts.push(i);
    ends.push(i + 1);
  }
  return { text: chars.join(""), starts, ends };
}

function foldNeedle(value: string): string {
  return foldText(value.trim()).text.trim();
}

/**
 * Find needle in haystack after folding quotes, dashes, and whitespace.
 * Indexes refer to the original haystack.
 */
export function findFoldedSpan(
  haystack: string,
  needle: string,
  fromIndex = 0,
): { start: number; end: number } | null {
  const foldedNeedle = foldNeedle(needle);
  if (!foldedNeedle) return null;
  const folded = foldText(haystack);
  let searchFrom = 0;
  if (fromIndex > 0) {
    searchFrom = folded.starts.findIndex((start) => start >= fromIndex);
    if (searchFrom < 0) return null;
  }
  const at = folded.text.indexOf(foldedNeedle, searchFrom);
  if (at < 0) return null;
  return {
    start: folded.starts[at],
    end: folded.ends[at + foldedNeedle.length - 1],
  };
}

/**
 * The exact note wording for a passage the reader selected.
 * Page chrome that is not in the note is left off either end.
 */
export function resolvePassage(plain: string, selected: string): string | null {
  const sliceAt = (value: string): string | null => {
    const span = findFoldedSpan(plain, value);
    if (!span) return null;
    const slice = plain.slice(span.start, span.end).trim();
    return slice.length >= 8 ? slice : null;
  };

  const direct = sliceAt(selected);
  if (direct) return direct;

  const words = selected.trim().split(/\s+/).filter(Boolean);
  if (words.length < 4) return null;
  const windowWords = words.length > 50 ? words.slice(0, 50) : words;
  const minWords = Math.max(4, Math.ceil(windowWords.length * 0.6));
  for (let length = windowWords.length - 1; length >= minWords; length--) {
    for (let start = 0; start + length <= windowWords.length; start++) {
      const found = sliceAt(windowWords.slice(start, start + length).join(" "));
      if (found) return found;
    }
  }
  return null;
}

/** Find needle in haystack, treating any run of whitespace as equal. */
export function findFlexibleSpan(
  haystack: string,
  needle: string,
  fromIndex = 0,
): { start: number; end: number } | null {
  const parts = needle
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp);
  if (parts.length === 0) return null;
  const re = new RegExp(parts.join("\\s+"), "g");
  re.lastIndex = Math.max(0, fromIndex);
  const match = re.exec(haystack);
  if (!match || match.index < fromIndex) return null;
  return { start: match.index, end: match.index + match[0].length };
}

/**
 * Whole-token matches. "Jaz" does not match inside "Jazz".
 */
export function findBoundedMatches(
  haystack: string,
  find: string,
): Array<{ start: number; end: number }> {
  const trimmed = find.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return [];
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(trimmed)}(?![\\p{L}\\p{N}])`,
    "gu",
  );
  const matches: Array<{ start: number; end: number }> = [];
  let found: RegExpExecArray | null;
  while ((found = re.exec(haystack)) !== null) {
    matches.push({ start: found.index, end: found.index + found[0].length });
    if (found.index === re.lastIndex) re.lastIndex += 1;
  }
  return matches;
}

export function proposeNameReplacements(
  plain: string,
  find: string,
  replaceWith: string,
): NoteProposal[] {
  const replacement = replaceWith.trim();
  if (!replacement || replacement.length > 200) return [];
  return findBoundedMatches(plain, find)
    .slice(0, 50)
    .map((span) => ({
      original: plain.slice(span.start, span.end),
      replacement,
      reason: "Name",
    }))
    .filter((proposal) => proposal.original !== proposal.replacement);
}

function sanitiseProposal(proposal: NoteProposal): NoteProposal | null {
  const original = proposal.original?.trim() ?? "";
  const replacement = (proposal.replacement ?? "").replace(/\s*\n\s*/g, " ").trim();
  const reason = (proposal.reason ?? "").trim().slice(0, 300);
  if (original.length < 12 || original.length > 600) return null;
  if (!replacement || replacement.length > 800) return null;
  if (collapseWhitespace(original) === collapseWhitespace(replacement)) return null;
  return { original, replacement, reason };
}

/**
 * Keep proposals whose original text is actually in the note, preferring the
 * longer quote when two overlap. Quotes that are not in the note are dropped.
 */
export function keepPlaceableProposals(
  plain: string,
  proposals: NoteProposal[],
): { kept: NoteProposal[]; unplaced: NoteProposal[] } {
  const candidates = proposals
    .map(sanitiseProposal)
    .filter((proposal): proposal is NoteProposal => proposal !== null)
    .sort((a, b) => b.original.length - a.original.length);

  const occupied: Array<{ start: number; end: number }> = [];
  const kept: NoteProposal[] = [];
  const unplaced: NoteProposal[] = [];

  for (const proposal of candidates) {
    let from = 0;
    let placed = false;
    while (from < plain.length) {
      const span = findFlexibleSpan(plain, proposal.original, from);
      if (!span) break;
      const overlaps = occupied.some(
        (range) => span.start < range.end && span.end > range.start,
      );
      if (!overlaps) {
        occupied.push(span);
        kept.push(proposal);
        placed = true;
        break;
      }
      from = span.end;
    }
    if (!placed) unplaced.push(proposal);
  }

  if (kept.length > 25) {
    return { kept: kept.slice(0, 25), unplaced: [...unplaced, ...kept.slice(25)] };
  }
  return { kept, unplaced };
}

function asRoleText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function parseNoteRole(value: unknown): NoteRole | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  return {
    clientName: asRoleText(raw.clientName, 200),
    instructionsTaken: raw.instructionsTaken === true,
    clientPresent: raw.clientPresent !== false,
    representativeName: asRoleText(raw.representativeName, 200),
    adviserIsFeeEarner: raw.adviserIsFeeEarner !== false,
    adviserName: asRoleText(raw.adviserName, 200),
    attendees: asRoleText(raw.attendees, 500),
  };
}

export function noteRoleError(role: NoteRole): string | null {
  const prospective = !role.instructionsTaken;
  const absent = !role.clientPresent;
  const otherAdviser = !role.adviserIsFeeEarner;
  const others = role.attendees.trim().length > 0;
  if (!prospective && !absent && !otherAdviser && !others) {
    return "Say what should change: that instructions have not been taken, that they were not there, or who gave the advice.";
  }
  if ((prospective || absent) && !role.clientName.trim()) {
    return "Name the person this note is about.";
  }
  if (absent && !role.representativeName.trim()) {
    return "Name who attended for them.";
  }
  if (otherAdviser && !role.adviserName.trim()) {
    return "Name the person who gave the advice.";
  }
  return null;
}

export function roleOpeningSentence(role: NoteRole): string {
  const client = role.clientName.trim();
  const representative = role.representativeName.trim();
  const adviser = role.adviserName.trim();
  const parts: string[] = [];
  if (!role.instructionsTaken && client) {
    parts.push(`${client} is the prospective client.`);
    parts.push("Instructions have not been taken.");
  }
  if (!role.clientPresent && client) {
    parts.push(`${client} was not present.`);
    if (representative) {
      parts.push(`${representative} attended and spoke on behalf of ${client}.`);
      parts.push(
        `The account that follows from ${representative} is ${representative}'s account, and not instructions from ${client}.`,
      );
    }
  }
  if (!role.instructionsTaken && client) {
    parts.push(`Nothing is to be done until instructions have been received from ${client}.`);
  }
  if (!role.adviserIsFeeEarner && adviser) {
    parts.push(`${adviser} gave the advice.`);
  }
  if (role.attendees.trim()) {
    parts.push(`Also present: ${role.attendees.trim()}.`);
  }
  return parts.join(" ");
}

const ROLE_SECTION_MARKERS = [/What was discussed:/i, /Key Points:/i, /MATTERS DISCUSSED/i];

/** The first sentence of the discussion, used as the anchor for the opening line. */
export function findRoleAnchor(plain: string): string | null {
  let from = 0;
  for (const marker of ROLE_SECTION_MARKERS) {
    const match = marker.exec(plain);
    if (!match) continue;
    from = match.index + match[0].length;
    break;
  }
  const lines = plain.slice(from).split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length < 12) continue;
    if (
      /^(What was discussed:|Advice given:|Key points advised:|Reasoning behind advice|Client's instructions|MATTERS DISCUSSED|NEXT STEPS|Key Points:)/i.test(
        line,
      )
    ) {
      continue;
    }
    const sentenceEnd = line.search(/[.!?](\s|$)/);
    const sentence = sentenceEnd >= 11 ? line.slice(0, sentenceEnd + 1) : line;
    const clipped = sentence.length > 220 ? sentence.slice(0, 220).replace(/\s+\S*$/, "") : sentence;
    return clipped.length >= 12 ? clipped : null;
  }
  return null;
}

function pushPhraseMatches(
  plain: string,
  source: string,
  replace: (match: RegExpExecArray) => string,
  reason: string,
  into: NoteProposal[],
): void {
  const re = new RegExp(source, "gu");
  let found: RegExpExecArray | null;
  while ((found = re.exec(plain)) !== null) {
    const original = found[0];
    const replacement = replace(found);
    if (original !== replacement) {
      into.push({ original, replacement, reason });
    }
    if (found.index === re.lastIndex) re.lastIndex += 1;
  }
}

function proposeRolePhrases(plain: string, role: NoteRole): NoteProposal[] {
  const phrases: NoteProposal[] = [];
  if (!role.instructionsTaken && role.clientName.trim()) {
    pushPhraseMatches(
      plain,
      "(?<![\\p{L}\\p{N}])([Tt]he) client('s|\u2019s)(?![\\p{L}\\p{N}])",
      (match) => `${match[1] === "The" ? "The" : "the"} prospective client${match[2]}`,
      "Prospective client",
      phrases,
    );
    pushPhraseMatches(
      plain,
      "(?<![\\p{L}\\p{N}])([Tt]he) client(?![\\p{L}\\p{N}])(?!\\s+care\\b)(?!\\s+letter\\b)",
      (match) => `${match[1] === "The" ? "The" : "the"} prospective client`,
      "Prospective client",
      phrases,
    );
  }
  if (!role.adviserIsFeeEarner && role.adviserName.trim()) {
    const adviser = role.adviserName.trim();
    pushPhraseMatches(
      plain,
      "(?<![\\p{L}\\p{N}])I advised(?![\\p{L}\\p{N}])",
      () => `${adviser} advised`,
      "Adviser",
      phrases,
    );
  }
  return phrases.sort((a, b) => b.original.length - a.original.length);
}

function headerClientProposal(plain: string, role: NoteRole): NoteProposal | null {
  const client = role.clientName.trim();
  if (!client) return null;
  const match = plain.match(/^Client Name:\s*(.+)$/im);
  if (!match) return null;
  const current = match[1].trim();
  const currentName = normalizePersonName(current.replace(/\s*\(prospective client\)\s*$/i, ""));
  if (
    currentName === normalizePersonName(client) &&
    (role.instructionsTaken || /\(prospective client\)\s*$/i.test(current))
  ) {
    return null;
  }
  const suffix = role.instructionsTaken ? "" : " (prospective client)";
  const replacement = `Client Name: ${client}${suffix}`;
  if (collapseWhitespace(match[0]) === collapseWhitespace(replacement)) return null;
  return {
    original: match[0].trim(),
    replacement,
    reason: "Who this note is about",
  };
}

function firstFreeSpan(
  plain: string,
  needle: string,
  occupied: Array<{ start: number; end: number }>,
): { start: number; end: number } | null {
  let cursor = 0;
  while (cursor < plain.length) {
    const span = findFlexibleSpan(plain, needle, cursor);
    if (!span) return null;
    const overlaps = occupied.some((range) => span.start < range.end && span.end > range.start);
    if (!overlaps) return span;
    cursor = span.end;
  }
  return null;
}

/**
 * Opening line, role-word replacements, and the sentences the model found.
 * A sentence wins over a role word inside it. The opening line is inserted
 * ahead of the discussion and does not replace that sentence.
 */
export function assembleRoleProposals(
  plain: string,
  role: NoteRole,
  modelSentences: NoteProposal[],
): { kept: NoteProposal[]; unplaced: NoteProposal[] } {
  const { kept: sentences, unplaced } = keepPlaceableProposals(
    plain,
    modelSentences.map((proposal) => ({ ...proposal, placement: "replace" as const })),
  );
  const occupied: Array<{ start: number; end: number }> = [];
  for (const sentence of sentences) {
    const span = findFlexibleSpan(plain, sentence.original);
    if (span) occupied.push(span);
  }
  const kept: NoteProposal[] = [...sentences];

  let phraseCount = 0;
  for (const phrase of proposeRolePhrases(plain, role)) {
    if (phraseCount >= 40) break;
    const span = firstFreeSpan(plain, phrase.original, occupied);
    if (!span) continue;
    occupied.push(span);
    kept.push({ ...phrase, original: plain.slice(span.start, span.end) });
    phraseCount += 1;
  }

  const header = headerClientProposal(plain, role);
  if (header) {
    const span = firstFreeSpan(plain, header.original, occupied);
    if (span) {
      occupied.push(span);
      kept.push(header);
    }
  }

  const opening = roleOpeningSentence(role);
  const anchor = findRoleAnchor(plain);
  const openingAlreadyThere = opening
    ? findFlexibleSpan(plain, opening.slice(0, Math.min(80, opening.length)))
    : null;
  if (anchor && opening && !openingAlreadyThere) {
    const span = findFlexibleSpan(plain, anchor);
    if (span) {
      kept.push({
        original: plain.slice(span.start, span.end),
        replacement: opening,
        reason: "Who this note is about",
        placement: "before",
      });
    }
  }

  return { kept, unplaced };
}
