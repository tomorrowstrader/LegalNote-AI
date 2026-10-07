/**
 * UK English spelling review.
 * Finds words. Does not rewrite text. Callers decide whether to move the
 * cursor or, only after an explicit choice, replace one word.
 */

export interface SpellAdapter {
  correct(word: string): boolean;
  suggest(word: string): string[];
  add(word: string): void;
}

export interface TextSegment {
  text: string;
  /** Document or string offset of text[0]. */
  from: number;
  /** Struck-through or redacted text is not part of the note the reader will keep. */
  skip?: boolean;
}

export interface SpellingIssue {
  word: string;
  from: number;
  to: number;
}

const WORD_RE = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

/** Short all-caps tokens used constantly in these notes. Longer capitals are still checked. */
const MAX_ABBREVIATION_LENGTH = 5;

export function isSpellingAccepted(word: string, spell: SpellAdapter): boolean {
  if (word.length < 2) return true;
  if (spell.correct(word) || spell.correct(word.toLowerCase())) return true;

  if (/^[A-Z]{2,5}$/.test(word) && word.length <= MAX_ABBREVIATION_LENGTH) return true;

  const stem = word.replace(/['’]s$/i, "");
  if (stem !== word && stem.length >= 2 && (spell.correct(stem) || spell.correct(stem.toLowerCase()))) {
    return true;
  }

  if (word.includes("-") || word.includes("’")) {
    const parts = word.split(/[-’']/).filter(Boolean);
    if (
      parts.length > 1 &&
      parts.every((part) => part.length < 2 || spell.correct(part) || spell.correct(part.toLowerCase()))
    ) {
      return true;
    }
  }

  return false;
}

export function spellingSuggestions(word: string, spell: SpellAdapter, limit = 5): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const suggestion of spell.suggest(word.toLowerCase())) {
    const trimmed = suggestion.trim();
    if (!trimmed || trimmed.toLowerCase() === word.toLowerCase()) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}

/** Teach the checker names and labels that are not general English. */
export function addSpellVocabulary(spell: SpellAdapter, phrases: Array<string | undefined | null>) {
  for (const phrase of phrases) {
    if (!phrase) continue;
    WORD_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = WORD_RE.exec(phrase))) {
      const word = match[0];
      if (word.length >= 2) spell.add(word);
    }
  }
}

export function spellingIssuesInSegments(segments: TextSegment[], spell: SpellAdapter): SpellingIssue[] {
  const issues: SpellingIssue[] = [];
  for (const segment of segments) {
    if (segment.skip || !segment.text) continue;
    WORD_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = WORD_RE.exec(segment.text))) {
      const word = match[0];
      if (isSpellingAccepted(word, spell)) continue;
      issues.push({
        word,
        from: segment.from + match.index,
        to: segment.from + match.index + word.length,
      });
      if (issues.length >= 300) return issues;
    }
  }
  return issues;
}
