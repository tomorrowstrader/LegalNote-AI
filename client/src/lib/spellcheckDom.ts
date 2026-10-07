import { isSpellingAccepted, type SpellAdapter } from "@shared/ukSpellcheck";

export interface DomWordHit {
  word: string;
  node: Text;
  start: number;
  end: number;
}

const WORD_RE = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
const SKIP_ANCESTOR = "del, .track-change-deletion, .redaction-mark, .legal-field-token, .rm-page-header, .rm-page-footer, .rm-pagination-gap";

export function collectDomWordHits(roots: ParentNode[], spell: SpellAdapter): DomWordHit[] {
  const hits: DomWordHit[] = [];
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current: Node | null;
    while ((current = walker.nextNode())) {
      const text = current as Text;
      if (!text.data || !/[A-Za-z]/.test(text.data)) continue;
      const parent = text.parentElement;
      if (parent?.closest(SKIP_ANCESTOR)) continue;
      WORD_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = WORD_RE.exec(text.data))) {
        const word = match[0];
        if (isSpellingAccepted(word, spell)) continue;
        hits.push({ word, node: text, start: match.index, end: match.index + word.length });
        if (hits.length >= 300) return hits;
      }
    }
  }
  return hits;
}

function highlightCtor(): (typeof Highlight) | null {
  if (typeof Highlight === "undefined" || !CSS.highlights) return null;
  return Highlight;
}

export function paintDomHits(hits: DomWordHit[], activeIndex: number) {
  clearDomHits();
  const active = hits[activeIndex];
  const Ctor = highlightCtor();
  if (!Ctor) {
    if (!active) return;
    const range = rangeFor(active);
    if (!range) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    active.node.parentElement?.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }

  const rest: Range[] = [];
  const current: Range[] = [];
  hits.forEach((hit, index) => {
    const range = rangeFor(hit);
    if (!range) return;
    if (index === activeIndex) current.push(range);
    else rest.push(range);
  });
  if (rest.length) CSS.highlights.set("ln-spellcheck", new Ctor(...rest));
  if (current.length) CSS.highlights.set("ln-spellcheck-active", new Ctor(...current));
  active?.node.parentElement?.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function clearDomHits() {
  CSS.highlights?.delete("ln-spellcheck");
  CSS.highlights?.delete("ln-spellcheck-active");
}

function rangeFor(hit: DomWordHit): Range | null {
  if (!hit.node.isConnected) return null;
  if (hit.end > hit.node.data.length) return null;
  const range = document.createRange();
  range.setStart(hit.node, hit.start);
  range.setEnd(hit.node, hit.end);
  return range;
}
