// Service worker de ContaTaller (PWA).
// Estrategia: network-first para páginas y estáticos (siempre fresco online,
// con respaldo desde caché si no hay conexión). Las rutas /api NO se cachean
// (datos privados y siempre en vivo).

const CACHE = 'contataller-v1';
const OFFLINE_FALLBACK = '/';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // Limpia cachés de versiones anteriores.
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // solo mismo origen
  if (url.pathname.startsWith('/api/')) return; // no cachear API

  event.respondWith(
    fetch(req)
      .then(res => {
        // Guarda una copia para uso sin conexión.
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const fallback = await caches.match(OFFLINE_FALLBACK);
          if (fallback) return fallback;
        }
        return Response.error();
      })
  );
});
