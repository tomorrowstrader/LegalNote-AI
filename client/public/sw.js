/* LegalNote PWA service worker — app-shell caching only.
 * API/audio/chunk requests always go to the network (never cached).
 */
const CACHE_NAME = "legalnote-shell-v1";
const PRECACHE_URLS = [
  "/",
  "/site.webmanifest",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/legalnote-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

function isApiOrAuthRequest(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/ws")
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isApiOrAuthRequest(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          cache.put(request, networkResponse.clone()).catch(() => {});
        }
        return networkResponse;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;

        if (request.mode === "navigate") {
          const shell = (await cache.match("/")) || (await cache.match("/index.html"));
          if (shell) return shell;
        }

        return new Response("Offline — LegalNote will reconnect when you're back online.", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })(),
  );
});
