/**
 * Display-time anchors for REASONING_GAP markers.
 * Markers are replaced with @@RGAP:N@@ tokens (TipTap-safe plain text), then
 * hydrated into visible marker chips so the reviewer can see, at the exact spot,
 * which advice point still needs reasoning — and jump to that advice wording.
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
    `data-testid="button-gap-citation-${index}" title="Jump to this advice in the note">` +
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
