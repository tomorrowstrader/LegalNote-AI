import { useEffect, useCallback } from "react";
import { useLocation } from "wouter";

/** Ctrl+Alt+N → Capture launcher (deliberate entry). */
export function useCaptureShortcut() {
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
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
