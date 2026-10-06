// Service worker del visor: guarda en el navegador los archivos que llevan versión (?v=<huella>, la que pone armar-raiz.sh) y los
// sirve desde ahí en las visitas siguientes. Una versión nueva cambia la huella y la URL, así que nunca sirve algo viejo; al guardar
// la versión nueva de un archivo borra la anterior. La página (index.html) va siempre primero a la red y solo usa lo guardado si
// no hay conexión. Lo de otros sitios (letras de Google, Open-Meteo, los partes de Albrook) no pasa por aquí.
const CACHE = 'e106-archivos';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((k) => k.put(url.pathname, c)); return r; })
      .catch(() => caches.match(url.pathname)));
    return;
  }
  if (!url.searchParams.has('v')) return;
  e.respondWith(caches.open(CACHE).then(async (k) => {
    const guardado = await k.match(req);
    if (guardado) return guardado;
    const r = await fetch(req);
    if (r.ok && r.status === 200) {
      for (const viejo of await k.keys()) {                 // otra versión del mismo archivo: fuera
        const u = new URL(viejo.url);
        if (u.pathname === url.pathname && u.search !== url.search) k.delete(viejo);
      }
      k.put(req, r.clone());
    }
    return r;
  }));
});
