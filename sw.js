const CACHE_NAME = 'absensi-cache-v5';
const PRECACHE_URLS = [
  './',
  './index.html',
  './admin.html',
  './style.css',
  './student.js',
  './admin.js',
  './api_connector.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force new Service Worker to activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .catch(err => console.log('Precache failed', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.indexOf('script.google.com') !== -1) return;

  // 1. Cache-First Strategy untuk CDN dan Web Fonts
  if (event.request.url.indexOf('jsdelivr.net') !== -1 || 
      event.request.url.indexOf('unpkg.com') !== -1 ||
      event.request.url.indexOf('fonts.googleapis.com') !== -1 ||
      event.request.url.indexOf('fonts.gstatic.com') !== -1) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200) return response;
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          return response;
        });
      })
    );
    return;
  }

  // 2. Network-First Strategy untuk HTML/JS/CSS Lokal
  // Ini akan mencegah isu aplikasi tersangkut di versi lawas (cache)
  event.respondWith(
    fetch(event.request).then(response => {
      // Jika berhasil ambil versi terbaru dari internet, simpan ke cache
      if (response && response.status === 200) {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
      }
      return response;
    }).catch(() => {
      // Jika koneksi internet putus (Offline), fallback ke data cache
      return caches.match(event.request);
    })
  );
});
