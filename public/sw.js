/* fresh2go — PWA service worker (customer / store / driver). */
const CACHE = 'fresh-pwa-v6';
const PRECACHE = [
  '/',
  '/order',
  '/store',
  '/driver',
  '/manifest.json',
  '/manifest-store.json',
  '/manifest-customer.json',
  '/manifest-driver.json',
  '/icons/store-192.png',
  '/icons/store-512.png',
  '/icons/app-192.png',
  '/icons/app-512.png',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(url.pathname || '/', copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          const path = url.pathname || '/';
          const candidates = [path, '/order', '/store', '/driver', '/'];
          for (const p of candidates) {
            const hit = await caches.match(p);
            if (hit) return hit;
          }
          return caches.match('/');
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const networked = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || networked;
    }),
  );
});
