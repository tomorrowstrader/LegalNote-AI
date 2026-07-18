/**
 * Display-time anchors for REASONING_GAP markers.
 * Markers are replaced with @@RGAP:N@@ tokens (TipTap-safe plain text), then
 * hydrated into visible marker chips so the reviewer can see, at the exact spot,
 * which advice point still needs reasoning — and the panel can jump straight to it.
 */

const MARKER_OR_TOKEN_RE =
  /<!--\s*REASONING_GAP:\s*.+?\s*-->|&lt;!--\s*REASONING_GAP:\s*.+?\s*--&gt;|\{\{RGAP:(?:\\.|[^}])+\}\}/g;

const ANCHOR_TOKEN_RE = /@@RGAP:(\d+)@@/g;

const CHIP_CLASS =
  "reasoning-gap-anchor inline-flex items-center gap-1 rounded border border-dashed " +
  "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 " +
  "text-[11px] not-italic px-2 py-0.5 my-0.5 align-baseline";

export function gapAnchorToken(index: number): string {
  return `@@RGAP:${index}@@`;
}

/** Replace stored gap markers with indexed tokens for TipTap display. */
export function withReasoningGapAnchors(content: string | null | undefined): string {
  if (!content) return "";
  let index = 0;
  return content.replace(MARKER_OR_TOKEN_RE, () => gapAnchorToken(index++));
}

/** Short, human label for a gap: the detail after the colon, else the section. */
function gapChipText(rawLabel: string | undefined): string {
  if (!rawLabel) return "Reasoning needed at this advice point";
  const colonIdx = rawLabel.indexOf(":");
  const detail = colonIdx === -1 ? "" : rawLabel.slice(colonIdx + 1).trim();
  const section = colonIdx === -1 ? rawLabel.trim() : rawLabel.slice(0, colonIdx).trim();
  const focus = detail || section;
  if (!focus) return "Reasoning needed at this advice point";
  // Detail copy already reads "Reasoning behind advice as to …"; don't double up.
  if (/^reasoning\b/i.test(focus)) return `Reasoning needed — ${focus}`;
  return `Reasoning needed: ${focus}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turn @@RGAP:N@@ tokens in an HTML string into visible marker chips. */
export function hydrateReasoningGapAnchorsInHtml(
  html: string,
  labels?: string[],
): string {
  return html.replace(ANCHOR_TOKEN_RE, (_m, idx: string) => {
    const i = Number(idx);
    const text = gapChipText(labels?.[i]);
    return (
      `<span data-reasoning-gap-index="${i}" data-testid="reasoning-gap-anchor-${i}" ` +
      `class="${CHIP_CLASS}" aria-label="${escapeHtml(text)}">` +
      `<span aria-hidden="true">⚠</span>${escapeHtml(text)}</span>`
    );
  });
}

/** Replace @@RGAP:N@@ text nodes in a live DOM tree with visible marker chips. */
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
      const chipText = gapChipText(labels?.[i]);
      const span = document.createElement("span");
      span.setAttribute("data-reasoning-gap-index", String(i));
      span.setAttribute("data-testid", `reasoning-gap-anchor-${i}`);
      span.className = CHIP_CLASS;
      span.setAttribute("aria-label", chipText);
      const glyph = document.createElement("span");
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = "⚠";
      span.appendChild(glyph);
      span.appendChild(document.createTextNode(chipText));
      frag.appendChild(span);
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
