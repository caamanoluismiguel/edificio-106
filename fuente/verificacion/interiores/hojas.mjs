// Hojas antes/después de los interiores procedurales detrás de las ventanas.
// Uso: cd fuente && node verificacion/interiores/hojas.mjs --sitio=antes|despues [--solo=d1,n1] [--webgl] [--calidad=bajo] [--hojas]
//   --sitio=antes    captura la raíz tal como está (el sitio publicado, main 26546a4): hay que correrlo ANTES de armar la rama
//   --sitio=despues  captura la raíz armada con la rama (fuente/armar.sh o verificacion/noche/armar-rama.sh)
//   --hojas          arma las hojas lado a lado con lo que haya en cap/
// Además mide el vidrio del edificio en cada captura (rayos contra el modelo): luminancia lineal media de los píxeles que
// caen en un paño de vidrio, para comparar la noche de antes y la de después (la noche honesta no debe cambiar de brillo).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { cargarTriangulos, Rayos } from '../../verificar-geometria.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../..');
const CAP = path.join(AQUI, 'cap'); fs.mkdirSync(CAP, { recursive: true });
const ARGS = process.argv.slice(2);
const arg = (k) => (ARGS.find((a) => a.startsWith(`--${k}=`)) ?? '').slice(k.length + 3);
const SOLO = arg('solo').split(',').filter(Boolean);
const SITIO = arg('sitio');
const CALIDAD = arg('calidad');
const KS = arg('k') ? Object.fromEntries(arg('k').split(',').map((x) => { const [a, b] = x.split(':'); return [a, +b]; })) : null;   // --k=noche:0.6,panel:2.5 (ajuste sin recompilar)
const SUF = arg('suf') || (arg('lente') ? 'lente-' + arg('lente') : '');
const LENTE = arg('lente');   // --lente=sol: captura con esa forma de ver (el interior debe apagarse como el resto del material)
const ANCHO = 1440, ALTO = 900;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

const F1 = { y: 2026, m: 9, d: 26 }, F2 = { y: 2024, m: 2, d: 22 }, FD = { y: 2024, m: 2, d: 9 };   // FD: día seco y despejado (ERA5)
const ESCENAS = {
  d1: { t: '9 feb 2024 · 09:00 · esquina', fecha: FD, min: 9 * 60, vista: 'esquina' },
  d2: { t: '9 feb 2024 · 10:30 · fachada sureste en la entrada', fecha: FD, min: 10 * 60 + 30, fachada: 'se', cam: { pos: [14.5, 1.7, 21.5], tgt: [12.5, 2.6, 11.4] } },
  d2b: { t: '9 feb 2024 · 16:30 · fachada sureste en la entrada (en sombra)', fecha: FD, min: 16 * 60 + 30, fachada: 'se', cam: { pos: [14.5, 1.7, 21.5], tgt: [12.5, 2.6, 11.4] } },
  d3: { t: '9 feb 2024 · 10:00 · fachada noreste', fecha: FD, min: 10 * 60, fachada: 'ne', cam: { pos: [37, 3.2, 1.5], tgt: [22.7, 5.2, 0.5] } },
  n1: { t: '26 sep 2026 · 21:30 · esquina · noche honesta', fecha: F1, min: 21 * 60 + 30, vista: 'esquina' },
  n2: { t: '26 sep 2026 · 21:30 · fachada sureste', fecha: F1, min: 21 * 60 + 30, fachada: 'se' },
  n3: { t: '22 feb 2024 · 21:30 · vista aérea', fecha: F2, min: 21 * 60 + 30, vista: 'aerea' },
  g1: { t: '26 sep 2026 · 21:30 · pegado a una ventana (medir la GPU)', fecha: F1, min: 21 * 60 + 30, fachada: 'se', cam: { pos: [5.5, 6.3, 16.5], tgt: [4.6, 6.3, 11.4] } },
  n4: { t: '26 sep 2026 · 21:30 · fachada sureste en la entrada', fecha: F1, min: 21 * 60 + 30, fachada: 'se', cam: { pos: [14.5, 1.7, 21.5], tgt: [12.5, 2.6, 11.4] } },
};

// ---------------- servidor ----------------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gz': 'application/gzip', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
function servidor() {
  const srv = http.createServer((q, r) => {
    let p; try { p = path.normalize(path.join(RAIZ, decodeURIComponent(new URL(q.url, 'http://x').pathname))); } catch (e) { r.writeHead(400); return r.end(); }
    if (!p.startsWith(RAIZ)) { r.writeHead(403); return r.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': TIPOS[path.extname(p).toLowerCase()] ?? 'application/octet-stream' });
    fs.createReadStream(p).pipe(r);
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}
async function abrir(nav, url) {
  const ctx = await nav.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 1, timezoneId: 'America/Panama', locale: 'es-PA' });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('e106-visto', '1'); localStorage.setItem('e106-nitidez', '1'); localStorage.removeItem('e106-motor'); } catch (e) { /* nada */ }
    let actual; Object.defineProperty(window, '__e106', { configurable: true, get: () => actual, set: (v) => { if (actual && !window.__e106base) window.__e106base = actual; if (!actual && v && !v.viajarA) window.__e106base = v; actual = v; } });
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('  [error de página]', String(e).slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('  [consola]', m.text().slice(0, 300)); });
  await pg.goto(url, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__e106?.escena?.cargado && window.__e106base && !window.__e106base.intro && document.documentElement.classList.contains('listo')
    && !document.documentElement.classList.contains('en-intro') && window.__e106.clima?.horario, null, { timeout: 180000, polling: 250 });
  await esperar(1500);
  return { pg, ctx };
}

// ---------------- medición del vidrio ----------------
const lin = (u) => { u /= 255; return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
const LIN = Float64Array.from({ length: 256 }, (_, i) => lin(i));
let GEO = null;
async function medir(pg, png) {
  if (!GEO) { const G = ['arquitectura', 'cubiertas', 'detalles', 'entrada', 'ventanas', 'sitio', 'vegetacion']; const m = await cargarTriangulos(RAIZ, G); GEO = { m, G, rayos: new Rayos(m) }; }
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const paso = 4, cols = Math.floor(ANCHO / paso), filas = Math.floor(ALTO / paso);
  const rays = await pg.evaluate(([cols, filas, paso]) => {
    const E = __e106.escena, cam = E.camera, V = cam.position.constructor, out = [];
    cam.updateMatrixWorld(true);
    for (let j = 0; j < filas; j++) for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * paso, y = (j + 0.5) * paso;
      const v = new V(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2, 0.5).unproject(cam).sub(cam.position).normalize();
      out.push([x, y, v.x, v.y, v.z]);
    }
    return { o: cam.position.toArray(), d: out };
  }, [cols, filas, paso]);
  const sx = info.width / ANCHO, sy = info.height / ALTO, Y = [];
  for (const [x, y, dx, dy, dz] of rays.d) {
    const h = GEO.rayos.lanzar(rays.o, [dx, dy, dz], 400);
    if (!h || !/glass/i.test(GEO.m.nombres[GEO.m.mat[h.i]])) continue;
    const o = (Math.round(y * sy) * info.width + Math.round(x * sx)) * 4;
    Y.push(0.2126 * LIN[data[o]] + 0.7152 * LIN[data[o + 1]] + 0.0722 * LIN[data[o + 2]]);
  }
  Y.sort((a, b) => a - b);
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  const E = Y.filter((v) => v > 0.08);   // vidrio encendido (de noche)
  return { n: Y.length, encendido: r4(E.length / Math.max(1, Y.length)), mediaEncendido: r4(E.reduce((a, b) => a + b, 0) / Math.max(1, E.length)), media: r4(Y.reduce((a, b) => a + b, 0) / Math.max(1, Y.length)), p50: r4(Y[Y.length >> 1] ?? 0), p90: r4(Y[Math.floor(Y.length * 0.9)] ?? 0), max: r4(Y[Y.length - 1] ?? 0) };
}

// ---------------- captura ----------------
async function capturar(pg, clave, esc) {
  await pg.evaluate((d) => { __e106.S.pausa = false; __e106.viajarA({ ...d, inmediato: true }); }, { fecha: esc.fecha, min: esc.min, vista: esc.vista ?? null, fachada: esc.fachada ?? null });
  await esperar(1500);
  // fecha en la interfaz = la pedida
  await pg.waitForFunction((f) => { const S = __e106.S; return S.fecha.y === f.y && S.fecha.m === f.m && S.fecha.d === f.d && !S.viaje; }, esc.fecha, { timeout: 20000, polling: 200 });
  if (esc.cam) await pg.evaluate((c) => { const E = __e106.escena, C = __e106.controls; E.camera.position.set(...c.pos); C.target.set(...c.tgt); E.camera.lookAt(C.target); C.update(); E.sucio = true; }, esc.cam);
  if (LENTE) await pg.evaluate((k) => [...document.querySelectorAll(`button[data-lente="${k}"]`)].find((b) => b.offsetParent)?.click(), LENTE);
  await esperar(3000);
  // sin relámpagos (en los aguaceros caen al azar y aclaran toda la imagen)
  await pg.evaluate(() => { __e106.escena._rel = 1e9; __e106.escena._flash = null; __e106.U.relampago.value = 0; });
  await esperar(400);
  const url = await pg.evaluate(() => { const E = __e106.escena; __e106.S.pausa = true; E.render(); return E.renderer.domElement.toDataURL('image/png'); });
  const png = Buffer.from(url.split(',')[1], 'base64');
  // la imagen del lienzo, sin la interfaz encima
  const jpg = path.join(CAP, `${SITIO}${CALIDAD ? '-' + CALIDAD : ''}${SUF ? '-' + SUF : ''}_${clave}.jpg`);
  await sharp(png).resize(ANCHO, ALTO).jpeg({ quality: 90 }).toFile(jpg);
  // costo en la GPU: 80 cuadros seguidos, esperando a que la GPU termine cada uno (mediana en ms por cuadro)
  // costo en la GPU: con el navegador sin tope de cuadros (--gpu lo abre con vsync apagado), 400 cuadros seguidos dibujados en
  // requestAnimationFrame con la app en pausa; el intervalo medio es lo que tarda un cuadro completo (CPU + GPU)
  const gpu = ARGS.includes('--gpu') ? await pg.evaluate(() => new Promise((ok) => {
    const E = __e106.escena, t = []; let i = 0, prev = 0;
    const paso = (ts) => { E.render(); if (prev) t.push(ts - prev); prev = ts; if (++i < 420) requestAnimationFrame(paso); else { const u = t.slice(20).sort((a, b) => a - b); ok({ mediaMs: Math.round(u.reduce((a, b) => a + b, 0) / u.length * 100) / 100, medianaMs: Math.round(u[u.length >> 1] * 100) / 100, px: E.renderer.domElement.width + '×' + E.renderer.domElement.height }); } };
    requestAnimationFrame(paso);
  })) : null;
  return { jpg, vidrio: await medir(pg, png), gpu };
}

// ---------------- hojas ----------------
const esc_ = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function hoja(nombre, titulo, cols) {
  const W = ANCHO, H = ALTO, cab = 64, sub = 70;
  const ancho = cols.length * W + (cols.length - 1) * 12, alto = sub + cab + H;
  const capas = [{ input: Buffer.from(`<svg width="${ancho}" height="${sub}"><rect width="100%" height="100%" fill="#111"/><text x="24" y="46" font-family="Helvetica" font-size="32" fill="#eee">${esc_(titulo)}</text></svg>`), top: 0, left: 0 }];
  cols.forEach((c, i) => {
    const left = i * (W + 12);
    capas.push({ input: Buffer.from(`<svg width="${W}" height="${cab}"><rect width="100%" height="100%" fill="#1b1b1b"/><text x="20" y="42" font-family="Helvetica" font-weight="bold" font-size="30" fill="#f2c14e">${esc_(c.rotulo)}</text></svg>`), top: sub, left });
    capas.push({ input: c.jpg, top: sub + cab, left });
  });
  const out = path.join(AQUI, `hoja-${nombre}.jpg`);
  await sharp({ create: { width: ancho, height: alto, channels: 3, background: '#111' } }).composite(capas).jpeg({ quality: 84 }).toFile(out);
  return out;
}

const archivoMedidas = path.join(AQUI, 'medidas.json');
const medidas = fs.existsSync(archivoMedidas) ? JSON.parse(fs.readFileSync(archivoMedidas, 'utf8')) : {};
if (SITIO) {
  const srv = await servidor(), base = `http://127.0.0.1:${srv.address().port}`;
  const nav = await chromium.launch({ headless: !ARGS.includes('--visible'), args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', ...(ARGS.includes('--gpu') ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [])] });
  const q = '?prueba&rapido' + (ARGS.includes('--webgl') ? '&webgl' : '') + (CALIDAD === 'bajo' ? '&ligero' : '');
  try {
    // «antes» sale de verificacion/interiores/antes/ (index.html y js/ de main, con enlaces a modelo/, datos/ y texturas/)
    const dirAntes = fs.existsSync(path.join(AQUI, 'antes', 'index.html')) && SITIO === 'antes' ? 'fuente/verificacion/interiores/antes/' : '';
    const { pg, ctx } = await abrir(nav, `${base}/${dirAntes}index.html${q}`);
    console.log('motor', await pg.evaluate(() => __e106.escena.backend + ' · ' + __e106.escena.calidad.nivel));
    if (KS) console.log('K', await pg.evaluate((ks) => { const K = __e106.escena.interiorK; for (const [k, v] of Object.entries(ks)) K[k].value = v; return Object.fromEntries(Object.entries(K).map(([k, u]) => [k, u.value])); }, KS));
    for (const k of Object.keys(ESCENAS).filter((k) => !SOLO.length || SOLO.includes(k))) {
      const r = await capturar(pg, k, ESCENAS[k]);
      medidas[`${SITIO}${CALIDAD ? '-' + CALIDAD : ''}${SUF ? '-' + SUF : ''}_${k}`] = { escena: ESCENAS[k].t, vidrio: r.vidrio, gpu: r.gpu };
      console.log(SITIO, k, JSON.stringify(r.vidrio), r.gpu ? 'gpu ' + JSON.stringify(r.gpu) : '');
    }
    await ctx.close();
  } finally { await nav.close(); srv.close(); fs.writeFileSync(archivoMedidas, JSON.stringify(medidas, null, 1)); }
}
if (ARGS.includes('--hojas')) {
  const J = (s, k) => path.join(CAP, `${s}_${k}.jpg`), hay = (s, k) => fs.existsSync(J(s, k));
  for (const k of Object.keys(ESCENAS)) if (hay('antes', k) && hay('despues', k)) console.log(await hoja(k, ESCENAS[k].t, [{ rotulo: 'Antes (main)', jpg: J('antes', k) }, { rotulo: 'Después (interiores)', jpg: J('despues', k) }]));
}
