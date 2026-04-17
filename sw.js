// ── SERVICE WORKER ──────────────────────────────────────
// Cache name — bump the version any time you update files.
const CACHE = 'tasks-v2';

// Derive the app's base path from the SW's own URL.
// If SW lives at /Task_Manager/sw.js, BASE becomes "/Task_Manager/".
// If it lives at the domain root, BASE becomes "/".
const BASE = new URL('./', self.location).pathname;

// Every file the app needs to work offline (relative to BASE)
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap'
];

// ── INSTALL ─────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      // Add files one by one so a single failure doesn't break everything
      return Promise.allSettled(
        FILES.map(url => {
          // Resolve relative URLs against the SW's location so they work
          // whether the app is at the domain root or in a subfolder.
          const resolved = new URL(url, self.location).toString();
          return cache.add(resolved).catch(() => {
            console.warn('SW: could not cache', resolved);
          });
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ────────────────────────────────────────────
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
// Cache-first, fall back to network.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (!response || (response.status !== 200 && response.type !== 'opaque')) return response;
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline and not cached — for HTML pages return the main app
        if (event.request.destination === 'document') {
          return caches.match(new URL('./index.html', self.location).toString());
        }
      });
    })
  );
});
