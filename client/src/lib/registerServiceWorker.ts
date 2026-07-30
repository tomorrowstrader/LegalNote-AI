/** Register the LegalNote PWA service worker (production / secure contexts only). */
export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // Avoid SW interference during Vite HMR in local development.
  if (import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("[PWA] Service worker registration failed:", error);
    });
  });
}
