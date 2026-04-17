// ── SERVICE WORKER ──────────────────────────────────────
// Cache name — change the version number any time you update
// the app files, so the old cache gets replaced automatically.
const CACHE = 'tasks-v1';

// Every file the app needs to work offline
const FILES = [
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap'
];

// ── INSTALL ─────────────────────────────────────────────
// Runs once when the service worker is first registered.
// Downloads and caches all the files listed above.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      // Add files one by one so a single failure doesn't break everything
      return Promise.allSettled(
        FILES.map(url => cache.add(url).catch(() => {
          console.warn('SW: could not cache', url);
        }))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ────────────────────────────────────────────
// Runs after install. Cleans up any old caches from previous versions.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────
// Every network request goes through here.
// Strategy: cache first, fall back to network.
// This means the app loads instantly from cache, even offline.
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached; // serve from cache

      // Not in cache — try network, then cache the response for next time
      return fetch(event.request).then(response => {
        if (!response || (response.status !== 200 && response.type !== 'opaque')) return response;
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline and not cached — for HTML pages return the main app
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
