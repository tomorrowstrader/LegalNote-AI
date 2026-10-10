import { useEffect, useCallback } from "react";
import { useLocation } from "wouter";

/** @deprecated Prefer useCaptureShortcut - kept for any lingering imports. */
export function useNewNoteShortcut() {
  const [, setLocation] = useLocation();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!event.key) return;
    if (event.key.toLowerCase() === "n" && event.ctrlKey && event.altKey) {
      event.preventDefault();
      setLocation("/capture");
    }
  }, [setLocation]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}
