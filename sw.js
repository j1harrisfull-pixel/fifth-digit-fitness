/* Fifth Digit Fitness — service worker
   - Precaches the app shell (incl. self-hosted fonts) for instant, offline-first loads
   - Navigations are network-first (falls back to the cached shell only when offline)
   - Same-origin assets: cache-first with background fill
   Bump CACHE_VERSION to ship a new shell. */

const CACHE_VERSION = "v56";
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

  // App navigations — network-first with a 3s cap: a deployed update reaches
  // the user on THIS launch when genuinely online, but a stalled "Lie-Fi"
  // connection can't hold the launch hostage for the browser's full fetch
  // timeout — after 3s the cached shell wins and the fetch keeps running in
  // the background to refresh the cache for next time. Cache is only the
  // fallback (offline / stall), never the first answer while online.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const network = fetch("./index.html", { cache: "no-store" }).then((resp) => {
          if (resp && resp.ok) { cache.put("./index.html", resp.clone()); cache.put("./", resp.clone()); return resp; }
          throw new Error("bad response: " + (resp && resp.status));
        });
        const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 3000));
        try {
          const fresh = await Promise.race([network, timeout]);
          if (fresh) return fresh;
        } catch (e) { /* fall through to cache */ }
        network.catch(() => {}); // keep background refresh alive; swallow its late failure
        const cached = (await cache.match("./index.html")) || (await cache.match("./"));
        if (cached) return cached;
        try { return await network; } catch (e) { return new Response("Offline", { status: 503, statusText: "Offline" }); }
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
