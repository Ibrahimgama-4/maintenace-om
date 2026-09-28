// Service worker: caches the app so it still opens with no signal.
// Writes (POST/PUT/etc.) and Supabase calls are never cached — new breakdown
// reports made offline are handled by the app's own local queue, not here.

const CACHE = "om-cache-v2";

const OFFLINE_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline</title>
<style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f9fafb;color:#111827;margin:0;padding:1.5rem;text-align:center}
h1{font-size:1.2rem;margin:0 0 .5rem}p{color:#6b7280;font-size:.95rem;margin:0}</style></head>
<body><div><h1>You're offline</h1><p>This page hasn't been opened on this device yet, so it isn't available offline. Reconnect and try again — pages you've already visited will work without signal.</p></div></body></html>`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Never touch writes.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never cache Supabase (API, auth, storage) — always live.
  if (url.hostname.endsWith("supabase.co")) return;

  // Static build assets and icons: cache-first (they never change for a given build).
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
    return;
  }

  // Pages: network-first, fall back to the last copy seen on this device.
  const wantsHtml = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (wantsHtml) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((cached) => cached || new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html" } }))
        )
    );
  }
});
