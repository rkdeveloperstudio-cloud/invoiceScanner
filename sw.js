const CACHE_NAME = "rkscan-v6";   // bump this every time you deploy changes
const SHELL = [
  "./manifest.json",
  "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
  // NOTE: do NOT pre-cache index.html — it's handled network-first below.
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never cache Supabase (DB) or Puter (AI) — must always be live.
  if (url.hostname.includes("supabase")) return;
  if (url.hostname.includes("puter")) return;

  // Network-first for HTML so updates land immediately.
  if (e.request.mode === "navigate" || url.pathname.endsWith(".html")) {
    e.respondWith(
      fetch(e.request)
        .then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() =>
          caches.match(e.request).then(r => r || caches.match("./index.html"))
        )
    );
    return;
  }

  // Cache-first for static assets.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((resp) => {
          if (resp && resp.ok && e.request.method === "GET") {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => cached);
    })
  );
});