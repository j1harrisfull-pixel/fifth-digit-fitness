/* Fifth Digit Fitness — service worker
   - Precaches the app shell (incl. self-hosted fonts) for instant, offline-first loads
   - Navigations are network-first (falls back to the cached shell only when offline)
   - Same-origin assets: cache-first with background fill
   Bump CACHE_VERSION to ship a new shell. */

const CACHE_VERSION = "v54";
const SHELL_CACHE = `training-log-shell-${CACHE_VERSION}`;

// Relative URLs so this works under any base path (e.g. GitHub Pages project page).
// Fonts are self-hosted (no more Google Fonts CDN) so they precache here like any
// other shell asset instead of the old runtime font-cache.
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./fonts/Geist-Regular.woff2",
  "./fonts/Geist-SemiBold.woff2",
  "./fonts/Geist-Bold.woff2",
  "./fonts/SplineSansMono-Medium.woff2",
  "./fonts/SplineSansMono-SemiBold.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Cache-first helper that fills the given cache on a miss.
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // App navigations — network-first: a deployed update reaches the user on
  // THIS launch (not "next launch, if you happen to relaunch a second time"),
  // since a real online device always gets the fresh HTML. The cached shell
  // is only ever used as the offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        try {
          const resp = await fetch("./index.html", { cache: "no-store" });
          if (resp && resp.ok) { cache.put("./index.html", resp.clone()); cache.put("./", resp.clone()); return resp; }
          throw new Error("bad response: " + resp.status);
        } catch (e) {
          const cached = (await cache.match("./index.html")) || (await cache.match("./"));
          return cached || new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })()
    );
    return;
  }

  // Same-origin assets — cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      cacheFirst(request, SHELL_CACHE).catch(() => fetch(request))
    );
    return;
  }

  // Everything else — network with cache fallback.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
