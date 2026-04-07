import { useEffect, useCallback } from "react";
import { useLocation } from "wouter";

export function useNewNoteShortcut() {
  const [, setLocation] = useLocation();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key.toLowerCase() === "n" && event.ctrlKey && event.altKey) {
      event.preventDefault();
      setLocation("/new-note");
    }
  }, [setLocation]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}
