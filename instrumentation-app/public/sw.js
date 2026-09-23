// Minimal service worker — enough to make the app installable on Android/Chrome.
// It doesn't cache anything aggressively, so the app always loads fresh data;
// this can be expanded later for real offline support if needed.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Pass-through: always fetch from the network, no offline caching yet.
  event.respondWith(fetch(event.request));
});
