/* ================================================================
   Darul Ulum Islamiyyah — Service Worker
   Strategy: Cache-First for assets, Network-First for app shell
   ================================================================ */

const CACHE_VERSION = 'absensi-v21';
const PRECACHE_URLS = [
  './',
  './index.html',
  './admin.html',
  './style.css',
  './student.css',
  './admin.css',
  './holidays.js',
  './student.js',
  './admin.js',
  './api_connector.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* ---- Install ---- */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .catch(err => console.warn('[SW] Precache sebagian gagal:', err))
  );
});

/* ---- Activate — purge old caches ---- */
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_VERSION)
            .map(key => caches.delete(key))
        )
      )
    ])
  );
});

/* ---- Fetch ---- */
self.addEventListener('fetch', event => {
  const { request } = event;

  /* Skip non-GET */
  if (request.method !== 'GET') return;

  /* Skip Google Apps Script API calls — must always be fresh */
  if (request.url.includes('script.google.com')) return;

  /* Skip cross-origin navigations */
  if (request.mode === 'navigate' && !request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);

  /* ---- Cache-First: CDN assets & web fonts ---- */
  const isCdn =
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isCdn) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  /* ---- Network-First: local HTML, JS, CSS ---- */
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
