/**
 * Exact, reviewable edits to a note. The model may only propose quotes that
 * already appear in the text. Everything else is left untouched.
 */

export interface NoteProposal {
  original: string;
  replacement: string;
  reason: string;
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
