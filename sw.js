const CACHE_NAME = 'siloe-cache-v43';
const APP_VERSION = '4.2';
/* arquivos do app: guardados na instalação para abrir sem internet */
const ARQUIVOS = [
  './',
  './index.html',
  `./style.css?v=${APP_VERSION}`,
  `./supabase.js?v=${APP_VERSION}`,
  `./core.js?v=${APP_VERSION}`,
  `./comando.js?v=${APP_VERSION}`,
  `./layout.js?v=${APP_VERSION}`,
  `./app.js?v=${APP_VERSION}`,
  `./panorama.js?v=${APP_VERSION}`,
  `./planner.js?v=${APP_VERSION}`,
  `./ponto.js?v=${APP_VERSION}`,
  `./louvor.js?v=${APP_VERSION}`,
  `./louvor-extra.js?v=${APP_VERSION}`,
  `./emprestimo.js?v=${APP_VERSION}`,
  `./vendas.js?v=${APP_VERSION}`,
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];
/* bibliotecas de fora que o app precisa para abrir (banco e PDF do ponto) */
const EXTERNOS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ARQUIVOS);
    /* externos um a um: se um falhar, não impede a instalação */
    await Promise.all(EXTERNOS.map(url => cache.add(new Request(url, { mode:'cors' })).catch(() => {})));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* Rede primeiro (sempre a versão mais nova); se a rede falhar ou demorar mais de 3 s, usa a cópia guardada.
   O banco (Supabase) e o login nunca passam por aqui: vão direto, sem cópia. */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;
  const daCasa = url.origin === self.location.origin;
  const guardavel = daCasa || EXTERNOS.some(e => req.url.startsWith(e)) || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  if (!guardavel) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const guardada = () => cache.match(req, { ignoreVary:true }).then(r => r || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
    const rede = fetch(req).then(resp => {
      if (resp && (resp.ok || resp.type === 'opaque')) cache.put(req, resp.clone()).catch(() => {});
      return resp;
    });
    const espera = new Promise(resolve => setTimeout(resolve, 3000));
    try {
      const primeiro = await Promise.race([rede, espera.then(() => null)]);
      if (primeiro) return primeiro;
      /* demorou: se houver cópia guardada, mostra ela; senão continua esperando a rede */
      return (await guardada()) || await rede;
    } catch (e) {
      const g = await guardada();
      if (g) return g;
      throw e;
    }
  })());
});
