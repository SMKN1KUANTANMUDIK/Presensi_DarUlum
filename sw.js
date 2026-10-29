/* =========================================================
   Service Worker — Presensi SMKN 1 Kuantan Mudik
   Semua URL dihitung relatif terhadap lokasi file ini,
   jadi aplikasi tetap bisa dipasang walau di-hosting di subfolder.
========================================================= */

const VERSION = 'v2.9.0';
const CACHE = `presensi-${VERSION}`;
const SCOPE = self.registration ? self.registration.scope : self.location.href;
const url = (p) => new URL(p, SCOPE).href;

const OFFLINE_URL = url('offline.html');

// Shell minimal — aset ber-hash (js/css) dicache otomatis saat pertama dibuka
const PRECACHE = [
  url('./'),
  url('index.html'),
  url('manifest.webmanifest'),
  url('offline.html'),
  url('icons/icon-192.png'),
  url('icons/icon-512.png'),
  url('logo_sekolah.png'),
];

const GAS_ORIGINS = ['script.google.com', 'script.googleusercontent.com'];
const CDN_ORIGINS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const ASSET_RE = /\.(?:css|js|mjs|png|jpe?g|svg|gif|ico|webp|woff2?|ttf|otf)$/i;

/* ---------------- install ---------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled(
        PRECACHE.map((u) =>
          cache.add(new Request(u, { cache: 'reload' })).catch(() => {
            console.warn('[SW] gagal precache', u);
          })
        )
      );
      await self.skipWaiting();
    })()
  );
});

/* ---------------- activate ---------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

/* ---------------- message ---------------- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ---------------- fetch ---------------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let target;
  try {
    target = new URL(request.url);
  } catch {
    return;
  }

  if (!target.protocol.startsWith('http')) return;

  // API Apps Script → biarkan browser (redirect/opaque)
  if (GAS_ORIGINS.includes(target.hostname)) return;

  const sameOrigin = target.origin === self.location.origin;
  const isCdn = CDN_ORIGINS.includes(target.hostname);
  if (!sameOrigin && !isCdn) return;

  // Navigasi halaman (SPA) → network-first, fallback ke index.html cache
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // Aset statis → stale-while-revalidate
  if (ASSET_RE.test(target.pathname) || isCdn) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

/* ---------------- strategi ---------------- */
async function networkFirstPage(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res?.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (
      (await cache.match(request)) ||
      (await cache.match(url('index.html'))) ||
      (await cache.match(OFFLINE_URL)) ||
      new Response('<h1>Offline</h1>', { status: 503, headers: { 'Content-Type': 'text/html' } })
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((res) => {
      if (res?.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    network.catch(() => {});
    return cached;
  }

  const fresh = await network;
  if (fresh) return fresh;

  return new Response('', { status: 504, statusText: 'Offline' });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res?.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('', { status: 504, statusText: 'Offline' });
  }
}
