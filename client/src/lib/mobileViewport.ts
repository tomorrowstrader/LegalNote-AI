/** Phone and tablet shell. Matches Tailwind `lg` (1024px), where the top bar returns. */
export const MOBILE_SHELL_MQ = "(max-width: 1023px)";

export function isMobileShell(): boolean {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_SHELL_MQ).matches;
}

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "radio",
  "range",
  "file",
  "submit",
  "reset",
  "image",
  "hidden",
  "color",
]);

export function isTextEntry(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = ((target as HTMLInputElement).type || "text").toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type);
  }
  return false;
}

/** Whole-editor focus should not jump a long note. The editor scrolls the caret itself. */
export function shouldRevealOnFocus(target: HTMLElement): boolean {
  return !target.isContentEditable;
}

export function keyboardInsetPx(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
}

export function syncVisualViewportVars(): void {
  const root = document.documentElement;
  const vv = window.visualViewport;
  if (!vv || !isMobileShell()) {
    root.style.setProperty("--vvh", "100dvh");
    root.style.setProperty("--vv-offset-top", "0px");
    root.style.setProperty("--keyboard-inset", "0px");
    return;
  }
  root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
  root.style.setProperty("--vv-offset-top", `${Math.round(vv.offsetTop)}px`);
  root.style.setProperty("--keyboard-inset", `${keyboardInsetPx()}px`);
}

/** Bottom edge of the screen that is not covered by the keyboard or the bottom bar. */
export function visibleViewportBottom(): number {
  const vv = window.visualViewport;
  const layoutBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  if (!isMobileShell()) return layoutBottom;
  const keyboardOpen =
    keyboardInsetPx() > 80 || document.documentElement.classList.contains("ln-keyboard-open");
  if (keyboardOpen) return layoutBottom;
  const safeRaw = getComputedStyle(document.documentElement).getPropertyValue("--safe-area-bottom").trim();
  const safe = Number.parseFloat(safeRaw);
  const safePx = Number.isFinite(safe) ? safe : 0;
  return layoutBottom - 64 - safePx;
}

export function scrollFieldIntoView(el: HTMLElement): void {
  const vv = window.visualViewport;
  const visibleTop = (vv?.offsetTop ?? 0) + 12;
  const visibleBottom = visibleViewportBottom() - 12;
  const rect = el.getBoundingClientRect();
  if (rect.top >= visibleTop && rect.bottom <= visibleBottom && rect.height < visibleBottom - visibleTop) {
    return;
  }
  el.scrollIntoView({ block: "center", inline: "nearest" });
}

function scrollParentOf(node: HTMLElement | null): HTMLElement | null {
  let current = node;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      current.scrollHeight > current.clientHeight + 4
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

/** Keep the caret above the keyboard without scrolling the whole note to centre. */
export function scrollCaretIntoView(): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;
  const vv = window.visualViewport;
  const visibleTop = (vv?.offsetTop ?? 0) + 72;
  const visibleBottom = visibleViewportBottom() - 16;
  const anchor = selection.anchorNode;
  const anchorEl = anchor instanceof HTMLElement ? anchor : anchor?.parentElement ?? null;
  const scrollParent = scrollParentOf(anchorEl);
  if (!scrollParent) return;
  if (rect.top < visibleTop) {
    scrollParent.scrollTop -= visibleTop - rect.top;
  } else if (rect.bottom > visibleBottom) {
    scrollParent.scrollTop += rect.bottom - visibleBottom;
  }
}
