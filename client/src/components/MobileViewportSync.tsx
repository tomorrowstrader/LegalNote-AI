import { useEffect } from "react";
import {
  isMobileShell,
  isTextEntry,
  scrollCaretIntoView,
  scrollFieldIntoView,
  shouldRevealOnFocus,
  syncVisualViewportVars,
} from "@/lib/mobileViewport";

/**
 * Keeps the on-screen keyboard from covering the focused field.
 * Hides the bottom bar while typing and scrolls the field into the visual viewport.
 */
export function MobileViewportSync() {
  useEffect(() => {
    const root = document.documentElement;
    let blurTimer = 0;
    let revealTimer = 0;

    const reveal = (el: HTMLElement) => {
      window.clearTimeout(revealTimer);
      const run = () => {
        if (!root.classList.contains("ln-keyboard-open")) return;
        if (document.activeElement !== el) return;
        scrollFieldIntoView(el);
      };
      requestAnimationFrame(run);
      revealTimer = window.setTimeout(run, 320);
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isMobileShell() || !isTextEntry(event.target)) return;
      window.clearTimeout(blurTimer);
      root.classList.add("ln-keyboard-open");
      syncVisualViewportVars();
      if (shouldRevealOnFocus(event.target)) reveal(event.target);
      else {
        window.clearTimeout(revealTimer);
        revealTimer = window.setTimeout(() => scrollCaretIntoView(), 320);
      }
    };

    const onFocusOut = () => {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        if (!isTextEntry(document.activeElement)) {
          root.classList.remove("ln-keyboard-open");
          syncVisualViewportVars();
        }
      }, 80);
    };

    const onViewport = () => {
      syncVisualViewportVars();
      const active = document.activeElement;
      if (root.classList.contains("ln-keyboard-open") && isTextEntry(active)) {
        if (shouldRevealOnFocus(active)) scrollFieldIntoView(active);
        else scrollCaretIntoView();
      }
    };

    syncVisualViewportVars();
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.visualViewport?.addEventListener("resize", onViewport);
    window.visualViewport?.addEventListener("scroll", onViewport);
    window.addEventListener("resize", onViewport);

    return () => {
      window.clearTimeout(blurTimer);
      window.clearTimeout(revealTimer);
      root.classList.remove("ln-keyboard-open");
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.visualViewport?.removeEventListener("resize", onViewport);
      window.visualViewport?.removeEventListener("scroll", onViewport);
      window.removeEventListener("resize", onViewport);
    };
  }, []);

  return null;
}
