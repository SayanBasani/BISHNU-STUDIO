// Bishnu Studio - Clean Self-Unregistering Service Worker
// Automatically unregisters any stale browser service worker to eliminate 404 console noise
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.registration
      .unregister()
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => {
        // Stale worker clean-up complete
      })
  );
});
