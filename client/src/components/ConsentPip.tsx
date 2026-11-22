import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A small window that stays on top of Zoom or Teams (Document Picture-in-Picture,
 * Chrome and Edge 116+). Used for the consent card so the solicitor sees it
 * without switching back to LegalNote. Safari and Firefox don't support it, so
 * the button is hidden there and the desktop alert does the job.
 */

type DocumentPip = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
  window: Window | null;
};

function documentPip(): DocumentPip | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture ?? null;
}

export function consentPipSupported(): boolean {
  return documentPip() !== null;
}

/** Bring the app's styles (Tailwind, theme class) into the small window. */
function copyStyles(target: Window): void {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
      const style = target.document.createElement("style");
      style.textContent = css;
      target.document.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = target.document.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        target.document.head.appendChild(link);
      }
    }
  }
  target.document.documentElement.className = document.documentElement.className;
  target.document.body.className = "bg-background text-foreground p-3";
}

export function useConsentPip() {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  const open = useCallback(async () => {
    const api = documentPip();
    if (!api) return false;
    try {
      const win = await api.requestWindow({ width: 380, height: 360 });
      win.document.title = "LegalNote consent";
      copyStyles(win);
      win.addEventListener("pagehide", () => setPipWindow(null), { once: true });
      setPipWindow(win);
      return true;
    } catch {
      // Needs a click, and only one small window per tab.
      return false;
    }
  }, []);

  const close = useCallback(() => {
    pipWindow?.close();
    setPipWindow(null);
  }, [pipWindow]);

  // Close it when the component that opened it goes away.
  useEffect(() => () => pipWindow?.close(), [pipWindow]);

  return { pipWindow, open, close, supported: consentPipSupported() };
}

export function PipPortal({ pipWindow, children }: { pipWindow: Window; children: ReactNode }) {
  return createPortal(children, pipWindow.document.body);
}
