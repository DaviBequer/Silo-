const CACHE_NAME = 'siloe-cache-v58';
const ARQUIVOS = [
  './index.html',
  './style.css',
  './app.js',
  './core.js',
  './panorama.js',
  './planner.js',
  './ponto.js',
  './receitas.js',
  './louvor.js',
  './mercado.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network first com fallback para cache
  event.respondWith(
    Promise.race([
      fetch(event.request).then((resp) => {
        if (resp.ok) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resp.clone());
            return resp;
          });
        }
        return caches.match(event.request).then(cached => cached || resp);
      }),
      new Promise((resolve) => {
        setTimeout(() => {
          caches.match(event.request).then(cached => {
            resolve(cached);
          });
        }, 1500);
      })
    ]).catch(() => caches.match(event.request))
  );
});
