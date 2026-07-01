/* LUDUZO service worker — installability + offline static shell.
   Strategy: cache-first for immutable static assets (fonts, icons, /_next/static),
   network for everything else (pages/API) so authenticated content is never served
   stale. This is deliberately conservative — it enables install + offline assets
   without risking cross-user cache leakage of authed pages. */
const CACHE = "luduzo-static-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isStatic =
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/brand") ||
    /\.(?:png|jpg|jpeg|svg|ico|css|js|woff2?|webmanifest)$/.test(url.pathname);

  if (isStatic) {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(req).then((hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
        )
      )
    );
  }
  // pages/API: default network (no SW interception) — keeps auth correct.
});
