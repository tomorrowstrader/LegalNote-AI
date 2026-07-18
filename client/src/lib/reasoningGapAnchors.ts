/**
 * Display-time anchors for REASONING_GAP markers.
 * Markers are replaced with @@RGAP:N@@ tokens (TipTap-safe plain text), then
 * hydrated into DOM spans so the gaps panel can jump to the exact advice point.
 */

const MARKER_OR_TOKEN_RE =
  /<!--\s*REASONING_GAP:\s*.+?\s*-->|&lt;!--\s*REASONING_GAP:\s*.+?\s*--&gt;|\{\{RGAP:(?:\\.|[^}])+\}\}/g;

const ANCHOR_TOKEN_RE = /@@RGAP:(\d+)@@/g;

export function gapAnchorToken(index: number): string {
  return `@@RGAP:${index}@@`;
}

/** Replace stored gap markers with indexed tokens for TipTap display. */
export function withReasoningGapAnchors(content: string | null | undefined): string {
  if (!content) return "";
  let index = 0;
  return content.replace(MARKER_OR_TOKEN_RE, () => gapAnchorToken(index++));
}

/** Turn @@RGAP:N@@ tokens in an HTML string into highlightable anchor spans. */
export function hydrateReasoningGapAnchorsInHtml(html: string): string {
  return html.replace(
    ANCHOR_TOKEN_RE,
    (_m, idx: string) =>
      `<span data-reasoning-gap-index="${idx}" data-testid="reasoning-gap-anchor-${idx}" class="reasoning-gap-anchor" aria-label="Reasoning gap ${Number(idx) + 1}">\u200b</span>`,
  );
}

/** Replace @@RGAP:N@@ text nodes in a live DOM tree with anchor spans. */
export function hydrateReasoningGapAnchorsInDom(root: ParentNode): void {
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
      const span = document.createElement("span");
      span.setAttribute("data-reasoning-gap-index", match[1]);
      span.setAttribute("data-testid", `reasoning-gap-anchor-${match[1]}`);
      span.className = "reasoning-gap-anchor";
      span.setAttribute("aria-label", `Reasoning gap ${Number(match[1]) + 1}`);
      span.textContent = "\u200b";
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
