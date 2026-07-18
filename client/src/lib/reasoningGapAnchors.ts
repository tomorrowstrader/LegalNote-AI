/**
 * Display-time anchors for REASONING_GAP markers.
 * Markers become @@RGAP:N@@ tokens, then labelled chips. Citation clicks jump to the
 * Advice given wording in the same numbered section — not headings or Client instructions.
 */

const MARKER_OR_TOKEN_RE =
  /<!--\s*REASONING_GAP:\s*.+?\s*-->|&lt;!--\s*REASONING_GAP:\s*.+?\s*--&gt;|\{\{RGAP:(?:\\.|[^}])+\}\}/g;

const ANCHOR_TOKEN_RE = /@@RGAP:(\d+)@@/g;

const CHIP_CLASS =
  "reasoning-gap-anchor inline-flex flex-wrap items-baseline gap-x-1 gap-y-0.5 rounded border border-dashed " +
  "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 " +
  "text-[11px] not-italic px-2 py-0.5 my-0.5 align-baseline max-w-full";

const CITATION_BTN_CLASS =
  "reasoning-gap-citation inline text-left font-medium underline underline-offset-2 " +
  "decoration-amber-500/70 hover:decoration-amber-700 dark:hover:decoration-amber-200 " +
  "cursor-pointer bg-transparent border-0 p-0 m-0 text-[11px] text-inherit " +
  "hover:text-amber-950 dark:hover:text-amber-100";

export function gapAnchorToken(index: number): string {
  return `@@RGAP:${index}@@`;
}

/** Replace stored gap markers with indexed tokens for TipTap display. */
export function withReasoningGapAnchors(content: string | null | undefined): string {
  if (!content) return "";
  let index = 0;
  return content.replace(MARKER_OR_TOKEN_RE, () => gapAnchorToken(index++));
}

/**
 * Strip generator boilerplate ("Reasoning behind advice as to…") so the chip
 * cites the substantive advice point, not a second "reasoning" phrase.
 */
export function stripReasoningPrefix(detail: string): string {
  return detail
    .replace(/^reasoning\s+behind\s+advice\s+as\s+to\s+/i, "")
    .replace(/^reasoning\s+behind\s+advice\s+(?:on|regarding|concerning|for|about)\s+/i, "")
    .replace(/^reasoning\s+behind\s+(?:the\s+)?/i, "")
    .replace(/^reasoning\s+for\s+(?:the\s+)?/i, "")
    .replace(/^advice\s+as\s+to\s+/i, "")
    .trim();
}

/** True when the label carries no usable advice-specific wording. */
export function isWeakGapCitation(citation: string | null | undefined): boolean {
  const c = (citation || "").trim().toLowerCase();
  if (!c) return true;
  if (c.length < 12) return true;
  return /^(the\s+|this\s+|any\s+)?advice(\s+point)?\.?$/.test(c);
}

export function splitGapLabelParts(rawLabel: string | undefined): {
  section: string;
  detail: string;
  citation: string;
} {
  if (!rawLabel?.trim()) {
    return { section: "", detail: "", citation: "this advice point" };
  }
  const colonIdx = rawLabel.indexOf(":");
  const section = (colonIdx === -1 ? rawLabel : rawLabel.slice(0, colonIdx)).trim();
  const detail = colonIdx === -1 ? "" : rawLabel.slice(colonIdx + 1).trim();
  const citation = stripReasoningPrefix(detail) || section || "this advice point";
  return { section, detail, citation };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function buildGapChipElement(
  index: number,
  rawLabel: string | undefined,
  asDom: true,
): HTMLSpanElement;
function buildGapChipElement(
  index: number,
  rawLabel: string | undefined,
  asDom: false,
): string;
function buildGapChipElement(
  index: number,
  rawLabel: string | undefined,
  asDom: boolean,
): HTMLSpanElement | string {
  const { section, citation } = splitGapLabelParts(rawLabel);
  const aria = `Reasoning needed — ${citation}`;

  if (asDom) {
    const span = document.createElement("span");
    span.setAttribute("data-reasoning-gap-index", String(index));
    span.setAttribute("data-testid", `reasoning-gap-anchor-${index}`);
    span.setAttribute("data-gap-section", section);
    span.setAttribute("data-gap-citation", citation);
    span.className = CHIP_CLASS;
    span.setAttribute("aria-label", aria);

    const glyph = document.createElement("span");
    glyph.setAttribute("aria-hidden", "true");
    glyph.textContent = "⚠";
    span.appendChild(glyph);

    const bold = document.createElement("strong");
    bold.className = "font-semibold";
    bold.textContent = "Reasoning needed";
    span.appendChild(bold);

    span.appendChild(document.createTextNode(" — "));

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = CITATION_BTN_CLASS;
    btn.setAttribute("data-gap-citation", citation);
    btn.setAttribute("data-gap-section", section);
    btn.setAttribute("data-gap-index", String(index));
    btn.setAttribute("data-testid", `button-gap-citation-${index}`);
    btn.title = "Jump to this advice in the note";
    btn.textContent = `“${citation}”`;
    span.appendChild(btn);

    return span;
  }

  return (
    `<span data-reasoning-gap-index="${index}" data-testid="reasoning-gap-anchor-${index}" ` +
    `data-gap-section="${escapeAttr(section)}" data-gap-citation="${escapeAttr(citation)}" ` +
    `class="${CHIP_CLASS}" aria-label="${escapeAttr(aria)}">` +
    `<span aria-hidden="true">⚠</span>` +
    `<strong class="font-semibold">Reasoning needed</strong>` +
    ` — ` +
    `<button type="button" class="${CITATION_BTN_CLASS}" ` +
    `data-gap-citation="${escapeAttr(citation)}" data-gap-section="${escapeAttr(section)}" ` +
    `data-gap-index="${index}" data-testid="button-gap-citation-${index}" ` +
    `title="Jump to this advice in the note">` +
    `“${escapeHtml(citation)}”</button></span>`
  );
}

/** Turn @@RGAP:N@@ tokens in an HTML string into labelled, clickable marker chips. */
export function hydrateReasoningGapAnchorsInHtml(
  html: string,
  labels?: string[],
): string {
  return html.replace(ANCHOR_TOKEN_RE, (_m, idx: string) => {
    const i = Number(idx);
    return buildGapChipElement(i, labels?.[i], false);
  });
}

/** Replace @@RGAP:N@@ text nodes in a live DOM tree with labelled, clickable marker chips. */
export function hydrateReasoningGapAnchorsInDom(
  root: ParentNode,
  labels?: string[],
): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.textContent && ANCHOR_TOKEN_RE.test(node.textContent)) {
      textNodes.push(node as Text);
    }
    ANCHOR_TOKEN_RE.lastIndex = 0;
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? "";
    const frag = document.createDocumentFragment();
    let last = 0;
    let match: RegExpExecArray | null;
    const re = new RegExp(ANCHOR_TOKEN_RE.source, "g");
    while ((match = re.exec(text)) !== null) {
      if (match.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, match.index)));
      }
      const i = Number(match[1]);
      frag.appendChild(buildGapChipElement(i, labels?.[i], true));
      last = match.index + match[0].length;
    }
    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)));
    }
    textNode.parentNode?.replaceChild(frag, textNode);
  }
}

export function findReasoningGapAnchor(root: ParentNode, gapIndex: number): HTMLElement | null {
  return root.querySelector(`[data-reasoning-gap-index="${gapIndex}"]`);
}

function blockText(el: HTMLElement): string {
  return (el.textContent || "").replace(/\u200b/g, "").trim();
}

function isSectionHeadingBlock(el: HTMLElement): boolean {
  const t = blockText(el);
  if (!t || t.length > 180) return false;
  if (/^\d+\.\s+\S/.test(t)) return true;
  // Professional ALL-CAPS section titles used in attendance notes
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 10 && letters === letters.toUpperCase() && /[A-Z]/.test(letters)) {
    return true;
  }
  return false;
}

function isClientInstructionsBlock(el: HTMLElement): boolean {
  return /^client'?s instructions/i.test(blockText(el));
}

function isReasoningLabelBlock(el: HTMLElement): boolean {
  return /^reasoning behind advice/i.test(blockText(el));
}

function isAdviceRegionBlock(el: HTMLElement): boolean {
  const t = blockText(el);
  return /^(advice given|key points advised)\b/i.test(t) || /\bi advised\b/i.test(t);
}

function citationKeywordScore(block: string, citation: string): number {
  const words = citation
    .toLowerCase()
    .split(/[^a-z0-9£$]+/i)
    .filter((w) => w.length >= 4 && !/^(that|this|with|from|into|have|been|were|their|about|whether|specific|options|outlined|treatment|potential|further|steps|taken|respect)$/i.test(w));
  if (words.length === 0) return 0;
  const text = block.toLowerCase();
  let hits = 0;
  for (const w of words) {
    if (text.includes(w)) hits++;
  }
  return hits / words.length;
}

/** Ordered note body blocks across all visible page surfaces. */
export function collectNoteBodyBlocks(roots: ParentNode[]): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  for (const root of roots) {
    if (!(root instanceof Element)) continue;
    if (root.closest?.("[data-page-view-measure]") || root.closest?.('[aria-hidden="true"]')) continue;
    const found = Array.from(
      root.querySelectorAll("h1, h2, h3, h4, h5, p, li, td, th, blockquote"),
    ) as HTMLElement[];
    for (const el of found) {
      if (el.closest("[data-page-view-measure]") || el.closest('[aria-hidden="true"]')) continue;
      if (el.closest("[data-testid^='panel-gap-review']")) continue;
      blocks.push(el);
    }
  }
  return blocks;
}

/** Blocks belonging to the numbered section that contains the gap anchor / section name. */
export function getSectionBlocksForGap(
  blocks: HTMLElement[],
  opts: { gapIndex?: number; section?: string; anchor?: HTMLElement | null },
): HTMLElement[] {
  if (blocks.length === 0) return [];

  let anchorIdx = -1;
  if (opts.anchor) {
    anchorIdx = blocks.findIndex((b) => b === opts.anchor || b.contains(opts.anchor!));
  }
  if (anchorIdx < 0 && opts.gapIndex != null) {
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].querySelector?.(`[data-reasoning-gap-index="${opts.gapIndex}"]`)) {
        anchorIdx = i;
        break;
      }
    }
  }
  if (anchorIdx < 0 && opts.section) {
    const needle = opts.section.replace(/^\d+\.\s*/, "").toLowerCase();
    for (let i = 0; i < blocks.length; i++) {
      const t = blockText(blocks[i]).toLowerCase();
      if (t.includes(needle) && isSectionHeadingBlock(blocks[i])) {
        anchorIdx = i;
        break;
      }
    }
  }
  if (anchorIdx < 0) return blocks;

  let start = anchorIdx;
  for (let i = anchorIdx; i >= 0; i--) {
    if (isSectionHeadingBlock(blocks[i])) {
      start = i;
      break;
    }
  }

  let end = blocks.length;
  for (let i = start + 1; i < blocks.length; i++) {
    if (isSectionHeadingBlock(blocks[i])) {
      end = i;
      break;
    }
  }
  return blocks.slice(start, end);
}

function extractQuotedAdviceSnippet(text: string, maxLen = 140): string {
  const cleaned = text
    .replace(/^(advice given|key points advised)\s*:?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";

  // Prefer an "I advised…" sentence
  const advisedMatch = cleaned.match(/\bI advised[^.!?\n]{12,}[.!?]?/i);
  if (advisedMatch) {
    const s = advisedMatch[0].trim();
    return s.length > maxLen ? `${s.slice(0, maxLen - 1).trim()}…` : s;
  }

  // Else first substantial sentence / bullet-like clause
  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
  const out = sentence.trim();
  return out.length > maxLen ? `${out.slice(0, maxLen - 1).trim()}…` : out;
}

/**
 * Find the best Advice-given block in a section for a gap citation.
 * Never prefers Client's instructions or bare headings.
 */
export function findAdviceTargetInSection(
  sectionBlocks: HTMLElement[],
  citation?: string,
): HTMLElement | null {
  if (sectionBlocks.length === 0) return null;

  const candidates = sectionBlocks.filter((b) => {
    if (b.closest(".reasoning-gap-anchor")) return false;
    if (isSectionHeadingBlock(b)) return false;
    if (isClientInstructionsBlock(b)) return false;
    if (isReasoningLabelBlock(b) && !/\bi advised\b/i.test(blockText(b))) return false;
    return true;
  });

  const adviceBlocks = candidates.filter(isAdviceRegionBlock);
  const pool = adviceBlocks.length > 0 ? adviceBlocks : candidates.filter((b) => !isReasoningLabelBlock(b));

  if (pool.length === 0) return null;

  const cite = (citation || "").trim();
  if (cite && !isWeakGapCitation(cite)) {
    let best: HTMLElement | null = null;
    let bestScore = 0;
    for (const block of pool) {
      const text = blockText(block);
      // Strong path: verbatim / near-verbatim
      if (text.toLowerCase().includes(cite.toLowerCase())) {
        return block;
      }
      const score = citationKeywordScore(text, cite);
      if (score > bestScore) {
        bestScore = score;
        best = block;
      }
    }
    if (best && bestScore >= 0.34) return best;
  }

  // Weak / unmatched label: land on the first real advice block in the section
  const advised = pool.find((b) => /\bi advised\b/i.test(blockText(b)));
  if (advised) return advised;
  return pool[0] ?? null;
}

/**
 * After chips are in the DOM, replace weak/generic citations with a short quote
 * taken from that section's Advice given wording.
 */
export function enrichGapCitationChips(roots: ParentNode[]): void {
  const blocks = collectNoteBodyBlocks(roots);
  if (blocks.length === 0) return;

  const chips = roots.flatMap((root) =>
    Array.from(
      (root instanceof Element ? root : document).querySelectorAll?.("[data-reasoning-gap-index]") ?? [],
    ),
  ) as HTMLElement[];

  // Deduplicate (same chip can appear if roots overlap)
  const seen = new Set<string>();
  for (const chip of chips) {
    const idx = chip.getAttribute("data-reasoning-gap-index") || "";
    if (!idx || seen.has(idx)) continue;
    seen.add(idx);

    const section = chip.getAttribute("data-gap-section") || undefined;
    const current = chip.getAttribute("data-gap-citation") || "";
    const sectionBlocks = getSectionBlocksForGap(blocks, {
      gapIndex: Number(idx),
      section,
      anchor: chip,
    });
    const adviceEl = findAdviceTargetInSection(sectionBlocks, current);
    if (!adviceEl) continue;

    const quote = extractQuotedAdviceSnippet(blockText(adviceEl));
    if (!quote || quote.length < 12) continue;

    // Enrich when weak, or when current citation barely overlaps the advice text
    const overlap = citationKeywordScore(blockText(adviceEl), current);
    if (!isWeakGapCitation(current) && overlap >= 0.34 && blockText(adviceEl).toLowerCase().includes(current.toLowerCase().slice(0, 24))) {
      continue;
    }

    chip.setAttribute("data-gap-citation", quote);
    chip.setAttribute("aria-label", `Reasoning needed — ${quote}`);
    const btn = chip.querySelector(".reasoning-gap-citation") as HTMLElement | null;
    if (btn) {
      btn.setAttribute("data-gap-citation", quote);
      btn.textContent = `“${quote}”`;
    }
  }
}
