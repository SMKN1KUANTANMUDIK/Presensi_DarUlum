const CACHE_NAME = 'absensi-cache-v2';
const PRECACHE_URLS = [
  './',
  './index.html',
  './admin.html',
  './style.css',
  './student.js',
  './admin.js',
  './api_connector.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
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
  // Hanya simpan request GET (Hindari POST seperti kirim absen)
  if (event.request.method !== 'GET') return;
  
  // Jangan simpan response dari API Google Script (Karena isinya dinamis)
  if (event.request.url.indexOf('script.google.com') !== -1) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 1. Jika ada di cache (misal: model AI dari jsdelivr), langsung pakai dari Cache!
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // 2. Jika tidak ada di cache, minta ke internet lalu simpan
      return fetch(event.request).then(response => {
        // Validasi response (200 OK atau 0 untuk opaque CORS)
        if (!response || (response.status !== 200 && response.status !== 0)) {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Bisa tambahkan fallback offline di sini jika diperlukan
      });
    })
  );
});
