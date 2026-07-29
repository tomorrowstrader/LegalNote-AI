import { useEffect, useCallback } from "react";

export type DocumentReviewShortcutAction =
  | "adopt"
  | "nextTab"
  | "prevTab"
  | "nextUnadopted";

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  const tagName = el?.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    !!el?.isContentEditable
  );
}

/**
 * Casefile document-review chords (Control only — never Cmd):
 * - Ctrl+Enter → adopt current document
 * - Ctrl+] / Ctrl+[ → next / previous document tab
 * - Ctrl+. → jump to next unadopted document
 */
export function useDocumentReviewShortcuts(
  enabled: boolean,
  onAction: (action: DocumentReviewShortcutAction) => void,
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;
      if (!event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      // Soft-gate / dialogs: don't steal chords while a modal has focus
      if (document.querySelector('[role="dialog"]')) return;

      let action: DocumentReviewShortcutAction | null = null;

      if (event.code === "Enter" && !event.shiftKey) {
        action = "adopt";
      } else if (event.code === "BracketRight" && !event.shiftKey) {
        action = "nextTab";
      } else if (event.code === "BracketLeft" && !event.shiftKey) {
        action = "prevTab";
      } else if (
        (event.code === "Period" || event.key === ".") &&
        !event.shiftKey
      ) {
        action = "nextUnadopted";
      }

      if (!action) return;

      event.preventDefault();
      event.stopPropagation();
      onAction(action);
    },
    [enabled, onAction],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);
}
