/* Service worker do Gestão de Obras — faz o sistema abrir sem internet.
   Gerado no build: a versão e a lista de arquivos são preenchidas pelo plugin em vite.config.ts. */

const VERSAO = '__VERSAO__';
const PRECACHE = __PRECACHE__;

const C_APP    = `gdo-app-${VERSAO}`;
const C_API    = 'gdo-api';
const C_MIDIA  = 'gdo-midia';
const C_MAPA   = 'gdo-mapa';
const C_FONTES = 'gdo-fontes';
const LIMITE_MAPA = 2500;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(C_APP).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.startsWith('gdo-app-') && k !== C_APP) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'limpar-dados') e.waitUntil(caches.delete(C_API));
});

/* ── estratégias ── */

function comTempo(promessa, ms) {
  return new Promise((ok, falha) => {
    const t = setTimeout(() => falha(new Error('tempo')), ms);
    promessa.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); falha(e); });
  });
}

async function cacheFirst(req, nome, limite) {
  const c = await caches.open(nome);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') {
    await c.put(req, res.clone());
    if (limite) aparar(c, limite);
  }
  return res;
}

async function aparar(c, limite) {
  const chaves = await c.keys();
  for (let i = 0; i < chaves.length - limite; i++) await c.delete(chaves[i]);
}

/* API: tenta a rede (com prazo, para sinal fraco); sem rede, usa a última resposta guardada */
async function apiNetworkFirst(req) {
  const tenant = req.headers.get('X-Tenant-Id') || '';
  const chave = new Request(`${req.url}${req.url.includes('?') ? '&' : '?'}__t=${encodeURIComponent(tenant)}`);
  const c = await caches.open(C_API);
  try {
    const res = await comTempo(fetch(req), 10000);
    if (res.ok) await c.put(chave, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(chave);
    if (hit) return hit;
    throw err;
  }
}

async function navegacao(req) {
  try {
    const res = await comTempo(fetch(req), 6000);
    return res;
  } catch {
    const c = await caches.open(C_APP);
    return (await c.match('/index.html')) || (await c.match('/')) || Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    e.respondWith(navegacao(req));
    return;
  }

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/tenant/') || url.pathname.startsWith('/api/public/')) {
      e.respondWith(apiNetworkFirst(req));
      return;
    }
    if (url.pathname.startsWith('/uploads/')) {
      e.respondWith(cacheFirst(req, C_MIDIA, 400));
      return;
    }
    if (PRECACHE.includes(url.pathname)) {
      e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    }
    return;
  }

  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith(cacheFirst(req, C_MAPA, LIMITE_MAPA));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'unpkg.com') {
    e.respondWith(cacheFirst(req, C_FONTES));
  }
});
