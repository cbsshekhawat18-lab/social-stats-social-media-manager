/* Social Stats Service Worker — caches app shell for offline + Add to Home Screen */
const CACHE_NAME = 'socialstats-v1';
const SHELL_ASSETS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only cache GET requests for same-origin navigation & static assets
  if (request.method !== 'GET') return;
  // Skip API calls — always go to network
  if (request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request).then((response) => {
        // Cache static assets and navigation
        if (response.ok && (request.url.match(/\.(js|css|png|jpg|svg|woff2?)$/) || request.mode === 'navigate')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached); // Fallback to cache if offline
      return cached || fetched;
    })
  );
});
