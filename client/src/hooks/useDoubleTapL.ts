import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";

const DOUBLE_TAP_THRESHOLD_MS = 500;

export function useDoubleTapL() {
  const [, setLocation] = useLocation();
  const lastKeyPressRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key.toLowerCase() !== "l") return;
    
    const target = event.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    const isEditable = target.isContentEditable;
    
    if (
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select" ||
      isEditable
    ) {
      return;
    }

    const now = Date.now();
    const timeSinceLastPress = now - lastKeyPressRef.current;

    if (timeSinceLastPress < DOUBLE_TAP_THRESHOLD_MS && timeSinceLastPress > 50) {
      event.preventDefault();
      setLocation("/new-note");
      lastKeyPressRef.current = 0;
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else {
      lastKeyPressRef.current = now;
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        lastKeyPressRef.current = 0;
      }, DOUBLE_TAP_THRESHOLD_MS);
    }
  }, [setLocation]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleKeyDown]);
}
