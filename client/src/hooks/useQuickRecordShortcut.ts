import { useEffect, useCallback } from "react";

/** Dispatched so QuickRecordButton can start the same flow as the red mic. */
export const QUICK_RECORD_SHORTCUT_EVENT = "legalnote-quick-record";

/**
 * Global Control+L (Mac Control / Windows Ctrl) → Quick Record.
 * Uses capture phase + event.code so layout quirks and browser chrome
 * are less likely to swallow the chord before our handler runs.
 */
export function useQuickRecordShortcut() {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Prefer physical key — with Control held, event.key is unreliable across layouts
    const isL = event.code === "KeyL" || event.key?.toLowerCase() === "l";
    if (!isL) return;

    // Control only — never Cmd (Mac address bar) or Alt/Shift chords
    if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase();
    if (
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select" ||
      target?.isContentEditable
    ) {
      return;
    }

    // If the red mic isn't mounted (public pages / focus mode), do nothing
    const mic = document.querySelector<HTMLElement>('[data-testid="button-quick-record"]');
    if (!mic) return;

    event.preventDefault();
    event.stopPropagation();

    window.dispatchEvent(new CustomEvent(QUICK_RECORD_SHORTCUT_EVENT));
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);
}
