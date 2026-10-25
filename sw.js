const CACHE_NAME = 'siloe-cache-v129';
const APP_VERSION = '12.9';
/* arquivos do app: guardados na instalação para abrir sem internet */
const ARQUIVOS = [
  './',
  './index.html',
  `./style.css?v=${APP_VERSION}`,
  `./supabase.js?v=${APP_VERSION}`,
  `./core.js?v=${APP_VERSION}`,
  `./layout.js?v=${APP_VERSION}`,
  `./app.js?v=${APP_VERSION}`,
  `./panorama.js?v=${APP_VERSION}`,
  `./planner.js?v=${APP_VERSION}`,
  `./ponto.js?v=${APP_VERSION}`,
  `./louvor.js?v=${APP_VERSION}`,
  `./louvor-extra.js?v=${APP_VERSION}`,
  `./louvor-medley.js?v=${APP_VERSION}`,
  `./louvor-comparar.js?v=${APP_VERSION}`,
  `./louvor-culto.js?v=${APP_VERSION}`,
  `./louvor-drive.js?v=${APP_VERSION}`,
  `./fatura-pdf.js?v=${APP_VERSION}`,
  `./emprestimo.js?v=${APP_VERSION}`,
  `./vendas.js?v=${APP_VERSION}`,
  `./atualizar.js?v=${APP_VERSION}`,
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './splash-cordeiro.png',
  './logo-cifraclub.png',
  './fonts/Inconsolata-Regular.ttf',
  './fonts/Inconsolata-Bold.ttf'
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
    await Promise.all(nomes.filter((n) => n !== CACHE_NAME && n !== 'siloe-compartilhado').map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* Rede primeiro (sempre a versão mais nova); se a rede falhar ou demorar mais de 3 s, usa a cópia guardada.
   O banco (Supabase) e o login nunca passam por aqui: vão direto, sem cópia. */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  /* "Compartilhar → Siloé" (PDF/foto da cifra): guarda o arquivo e abre o app, que importa no Louvor */
  if (req.method === 'POST' && url.origin === self.location.origin && url.searchParams.has('compartilhar')) {
    event.respondWith((async () => {
      try {
        const dados = await req.formData();
        const arq = dados.getAll('arquivo').find(f => f && typeof f !== 'string');
        if (arq) {
          const cache = await caches.open('siloe-compartilhado');
          await cache.put('./arquivo-compartilhado', new Response(arq, { headers: { 'Content-Type': arq.type || 'application/pdf', 'X-Nome': encodeURIComponent(arq.name || 'cifra.pdf') } }));
        }
      } catch (e) {}
      return Response.redirect('./?compartilhado=1', 303);
    })());
    return;
  }
  if (req.method !== 'GET') return;
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

/* Notificações (mandadas pelo serviço "avisos" do Supabase): { titulo, corpo, url, tag } */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { corpo: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.titulo || 'Siloé', {
    body: d.corpo || '',
    icon: './icon-192.png',
    badge: './splash-cordeiro.png',   // ícone pequeno da barra: cordeiro branco
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || './' }
  }));
});
/* tocou na notificação: abre o app (ou traz para a frente) já na aba certa */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  const aba = (url.split('#')[1] || '');
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const j = janelas.find(c => c.url.startsWith(self.registration.scope));
    if (j) { if (aba) j.postMessage({ abrirAba: aba }); return j.focus(); }
    return self.clients.openWindow(url);
  })());
});
