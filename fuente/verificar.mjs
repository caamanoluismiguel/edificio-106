// Comprobaciones automáticas del Edificio 106 contra el sitio ya armado en la raíz del repositorio (index.html, js/app.js,
// modelo/, datos/, texturas/). No arma nada ni toca la app: levanta un servidor estático propio, abre la página con
// ?prueba (el gancho window.__e106) en Chromium y mide. Uso:  cd fuente && node verificar.mjs  [--webgl] [--visible] [--solo=1,2]
//   --webgl    fuerza WebGL 2 (?webgl) en lugar de WebGPU
//   --visible  abre el navegador con ventana (si el modo sin ventana no dibuja)
//   --solo=…   corre solo esas comprobaciones (1 a 7)
//   --control-bias=-0.004  prueba de sensibilidad de la comprobación 7 (el sol alto debe colarse bajo el alero y FALLAR)
//   --control-sesgo=0.35  prueba de sensibilidad: repone el normalBias viejo en esta página; la comprobación 2 debe fallar
// Resultado: fuente/verificacion/informe.json (con --webgl, en verificacion/webgl/), capturas al lado y un resumen en la consola.
// Tarda ~6 min (la comprobación 5 abre dos navegadores más; la 4 recorre ~80 pasos de la interfaz).
// Código de salida: 0 si todo pasa, 1 si alguna comprobación falla, 2 si el propio script no pudo correr.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { posicionSol, LAT, LON, TZ, FACHADAS, dniDespejado } from './src/sol.js';
import { solMichalsky, separacion } from './verificar-sol.mjs';
import { cargarTriangulos, Rayos } from './verificar-geometria.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
// --url=ciudad=espiga&sombra=csm: parámetros extra en la URL de la página (p. ej. la espiga de feat/ciudad); el informe va aparte,
// en verificacion/url-<parámetros>/
const EXTRA_URL = (process.argv.find((a) => a.startsWith('--url=')) ?? '').slice(6);
const SALIDA = path.join(AQUI, 'verificacion', EXTRA_URL ? 'url-' + EXTRA_URL.replace(/[^a-z0-9]+/gi, '-') : '', process.argv.includes('--webgl') ? 'webgl' : '');   // con --webgl, aparte
const ARGS = process.argv.slice(2);
const FORZAR_GL = ARGS.includes('--webgl');
const VISIBLE = ARGS.includes('--visible');
// --control-sesgo=0.35: prueba de sensibilidad de la comprobación 2; pone ese normalBias en la luz del sol (solo en esta página)
// para reproducir el error viejo de los aleros (sombras ~21 % cortas). La comprobación 2 debe FALLAR con él.
const CONTROL = Number((ARGS.find((a) => a.startsWith('--control-sesgo=')) ?? '').slice(16)) || null;
// --control-bias=-0.004: prueba de sensibilidad de la comprobación 7; pone ese bias (10 veces el de la app) y la 7 debe FALLAR
const CONTROL_BIAS = Number((ARGS.find((a) => a.startsWith('--control-bias=')) ?? '').slice(15)) || null;
const SOLO = (ARGS.find((a) => a.startsWith('--solo=')) ?? '').slice(7).split(',').filter(Boolean).map(Number);
const corre = (n) => !SOLO.length || SOLO.includes(n);
const ANCHO = 1600, ALTO = 1000;
const rad = Math.PI / 180;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const r2 = (x, d = 3) => (x == null || !isFinite(x) ? x : Math.round(x * 10 ** d) / 10 ** d);
fs.mkdirSync(SALIDA, { recursive: true });

const informe = { fecha: new Date().toISOString(), ventana: `${ANCHO}×${ALTO}`, sitio: RAIZ, comprobaciones: {} };
const t0Global = Date.now();

// ---------------- Servidor estático ----------------
// Los .bin.gz van como application/gzip y SIN Content-Encoding: la app los descomprime ella misma (DecompressionStream);
// si el servidor anunciara gzip, el navegador los descomprimiría antes y la app fallaría al hacerlo por segunda vez.
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.glb': 'model/gltf-binary', '.gz': 'application/gzip', '.bin': 'application/octet-stream', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
function servidor() {
  const srv = http.createServer((q, r) => {
    let p;
    try { p = path.normalize(path.join(RAIZ, decodeURIComponent(new URL(q.url, 'http://x').pathname))); } catch (e) { r.writeHead(400); return r.end(); }
    if (!p.startsWith(RAIZ)) { r.writeHead(403); return r.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': TIPOS[path.extname(p).toLowerCase()] ?? 'application/octet-stream' });   // sin Cache-Control: no-store (con él, Chromium da por abortado el .glb más grande aunque la app lo lee completo)
    fs.createReadStream(p).pipe(r);
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

// ---------------- Utilidades de imagen ----------------
const lin = (u) => { u /= 255; return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
const LIN = Float64Array.from({ length: 256 }, (_, i) => lin(i));
async function decodificar(dataURL) {
  const buf = Buffer.from(dataURL.split(',')[1], 'base64');
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, png: buf };
}
/** Luminancia lineal (Rec. 709) con interpolación bilineal en (u, v) píxeles. */
function lumBilineal(img, u, v) {
  const x0 = Math.floor(u - 0.5), y0 = Math.floor(v - 0.5), fx = u - 0.5 - x0, fy = v - 0.5 - y0;
  const px = (x, y) => { x = Math.max(0, Math.min(img.w - 1, x)); y = Math.max(0, Math.min(img.h - 1, y)); const o = (y * img.w + x) * 4; return 0.2126 * LIN[img.data[o]] + 0.7152 * LIN[img.data[o + 1]] + 0.0722 * LIN[img.data[o + 2]]; };
  return px(x0, y0) * (1 - fx) * (1 - fy) + px(x0 + 1, y0) * fx * (1 - fy) + px(x0, y0 + 1) * (1 - fx) * fy + px(x0 + 1, y0 + 1) * fx * fy;
}

// ---------------- Navegador ----------------
let pasoActual = 'arranque';
const eventos = { consola: [], avisos: [], pagina: [], peticiones: [] };
async function abrirNavegador() {
  const args = ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'];
  return chromium.launch({ headless: !VISIBLE, args });
}
async function abrirPagina(navegador, url, etiqueta) {
  const ctx = await navegador.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 1, timezoneId: 'America/Panama', locale: 'es-PA' });
  await ctx.addInitScript(() => {
    // estado fijo: la intro corta de quien ya la vio y la resolución fija al máximo (sin la adaptable, que cambia con la carga)
    try { localStorage.setItem('e106-visto', '1'); localStorage.setItem('e106-nitidez', '1'); localStorage.removeItem('e106-motor'); } catch (e) { /* nada */ }
    // la app deja un __e106 global al cargar el módulo (con DIAG e intro) y luego, con ?prueba, lo reemplaza por el gancho
    // de pruebas: se guarda el primero en __e106base para leer el diagnóstico y el estado de la intro
    let actual;
    Object.defineProperty(window, '__e106', { configurable: true, get: () => actual, set: (v) => { if (actual && !window.__e106base) window.__e106base = actual; if (!actual && v && !v.viajarA) window.__e106base = v; actual = v; } });
    // marcas de tiempo de cada cuadro (requestAnimationFrame), para medir tirones
    window.__cuadros = [];
    const f = (t) => { window.__cuadros.push(t); if (window.__cuadros.length > 20000) window.__cuadros.splice(0, 10000); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const pg = await ctx.newPage();
  const local = (u) => /^https?:\/\/127\.0\.0\.1[:/]/.test(u);
  pg.on('console', (m) => {
    const e = { paso: pasoActual, pagina: etiqueta, tipo: m.type(), texto: m.text().slice(0, 500) };
    if (m.type() === 'error') eventos.consola.push(e); else if (m.type() === 'warning') eventos.avisos.push(e);
  });
  pg.on('pageerror', (err) => eventos.pagina.push({ paso: pasoActual, pagina: etiqueta, texto: String(err?.stack ?? err).slice(0, 800) }));
  const t0p = Date.now();
  pg.on('requestfailed', (q) => eventos.peticiones.push({ paso: pasoActual, pagina: etiqueta, url: q.url().slice(0, 200), motivo: q.failure()?.errorText, tipo: q.resourceType(), metodo: q.method(), s: r2((Date.now() - t0p) / 1000, 2), externa: !local(q.url()) }));
  pg.on('response', (r) => { if (r.status() >= 400) eventos.peticiones.push({ paso: pasoActual, pagina: etiqueta, url: r.url().slice(0, 200), motivo: 'HTTP ' + r.status(), externa: !local(r.url()) }); });
  const t0 = Date.now();
  await pg.goto(url, { waitUntil: 'load' });
  // listo = modelo completo, intro terminada y serie horaria de clima cargada
  await pg.waitForFunction(() => window.__e106?.escena?.cargado && window.__e106base && !window.__e106base.intro
    && document.documentElement.classList.contains('listo') && !document.documentElement.classList.contains('en-intro') && window.__e106.clima?.horario,
  null, { timeout: 180000, polling: 250 });
  // la ciudad (encendida por defecto) llega después del 106: se mide con ella montada
  await pg.evaluate(() => Promise.race([window.__e106.escena.cargaCiudad, new Promise((ok) => setTimeout(ok, 120000))]));
  await esperar(1500);
  const estado = await pg.evaluate(() => ({ ciudad: __e106.escena.ciudadOpc ? { lista: !!__e106.escena.ciudadLista, nivel: __e106.escena.ciudadOpc.nivel, sombra: __e106.escena.ciudadOpc.sombra, gruesa: __e106.escena._gruesa ?? null, texelFinoM: 140 / __e106.escena.sun.shadow.mapSize.x } : null, backend: __e106.escena.backend, dpr: __e106.escena.renderer.getPixelRatio(), nivel: __e106.escena.calidad.nivel,
    bloom: __e106.escena.bloomOn, sombras: __e106.escena.calidad.sombras, ua: navigator.userAgent, grupos: Object.keys(__e106.escena.grupos) }));
  estado.cargaMs = Date.now() - t0;
  return { pg, ctx, estado };
}

/** Deja la app en un momento y una vista, espera a que se asiente (vuelo de cámara de 1,2 s y transiciones de ~1 s). */
async function irA(pg, d, ms = 2600) {
  await pg.evaluate((d) => { __e106.S.pausa = false; __e106.viajarA({ ...d, inmediato: true }); }, d);
  await esperar(ms);
}
/** Detiene el bucle de la app, dibuja un cuadro y devuelve el lienzo (PNG en data URL). `prep` corre antes de dibujar. */
async function capturar(pg, prep = null, arg = null) {
  return pg.evaluate(([prep, arg]) => {
    const E = __e106.escena; __e106.S.pausa = true;
    if (prep) (0, eval)(`(${prep})`)(E, arg);
    E.render();
    return E.renderer.domElement.toDataURL('image/png');
  }, [prep ? prep.toString() : null, arg]);
}

// =====================================================================================================================
// 1. Posición del sol contra un algoritmo independiente (Michalsky 1988), en Node y a través del gancho del sitio armado
// =====================================================================================================================
function comprobacion1() {
  let n = 0, mA = 0, mZ = 0, mS = 0, peorA = null, peorZ = null;
  for (let y = 2001; y <= 2025; y++) for (let dia = (y * 3) % 5; dia < 366; dia += 5) for (let min = 5 * 60; min <= 19 * 60; min += 10) {
    const d = new Date(Date.UTC(y, 0, 1 + dia)); if (d.getUTCFullYear() !== y) continue;
    const f = { y, m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: 0, min };
    const a = posicionSol(f);
    // sol.js recibe la hora de Panamá (UTC−5 todo el año, sin horario de verano): UTC = hora local + 5 h
    const b = solMichalsky(Date.UTC(f.y, f.m - 1, f.d, 0, min) - TZ * 3600e3, LAT, LON);
    if (a.alt <= 0 && b.alt <= 0) continue;
    if (Math.min(a.alt, b.alt) <= 0) continue;                     // justo en el horizonte uno lo ve y el otro no
    n++;
    const dA = Math.abs(a.alt - b.alt), dZ = Math.abs(((a.az - b.az + 540) % 360) - 180), s = separacion(a.alt, a.az, b.alt, b.az);
    if (dA > mA) { mA = dA; peorA = { ...f, altApp: r2(a.alt, 4), altRef: r2(b.alt, 4) }; }
    // cerca del cenit el azimut está mal condicionado (un error mínimo de posición cambia mucho el azimut): se compara bajo 85°
    if (a.alt < 85 && dZ > mZ) { mZ = dZ; peorZ = { ...f, alt: r2(a.alt, 2), azApp: r2(a.az, 4), azRef: r2(b.az, 4) }; }
    if (s > mS) mS = s;
  }
  // convención de hora: el mediodía solar de hoy debe caer ~12:10–12:25 hora de Panamá (79,58° O está 0,4° al este del meridiano de UTC−5)
  const md = [];
  for (const [m, d] of [[2, 11], [5, 14], [7, 26], [11, 3]]) {
    let mejor = { alt: -99 }; for (let min = 11 * 60; min < 13 * 60 + 30; min += 0.5) { const p = posicionSol({ y: 2024, m, d, h: 0, min }); if (p.alt > mejor.alt) mejor = { alt: p.alt, min }; }
    const hh = Math.floor(mejor.min / 60), mm = mejor.min % 60;
    md.push(`${d}/${m}: ${String(hh).padStart(2, '0')}:${String(Math.floor(mm)).padStart(2, '0')}`);
  }
  const pasa = mA <= 0.1 && mZ <= 0.1;
  return { estado: pasa ? 'PASA' : 'FALLA', backend: 'Node (src/sol.js)', referencia: 'Michalsky 1988 + refracción de Sæmundsson', rejilla: '2001–2025, cada 5 días, cada 10 min, sol sobre el horizonte',
    muestras: n, maxDeltaAltitud: r2(mA, 4), maxDeltaAzimut_bajo85: r2(mZ, 4), maxSeparacionAngular: r2(mS, 4), peorAltitud: peorA, peorAzimut: peorZ,
    convencionHora: `sol.js usa hora de Panamá, TZ = ${TZ} (UTC−5 fijo, sin horario de verano). Mediodía solar 2024: ${md.join(' · ')}`, umbral: '0,1°' };
}
/** El mismo algoritmo a través del gancho del sitio armado (js/app.js): confirma que el paquete usa el mismo sol.js. */
async function comprobacion1Gancho(pg) {
  const casos = [];
  for (let k = 0; k < 60; k++) { const y = 2001 + (k * 7) % 25, m = 1 + (k * 5) % 12, d = 1 + (k * 11) % 28, min = 360 + (k * 37) % 720; casos.push({ y, m, d, h: 0, min }); }
  const app = await pg.evaluate((c) => c.map((f) => __e106.posicionSol(f)), casos);
  let mx = 0; casos.forEach((f, i) => { const a = posicionSol(f); mx = Math.max(mx, Math.abs(a.alt - app[i].alt), Math.abs(((a.az - app[i].az + 540) % 360) - 180)); });
  return { casos: casos.length, maxDiferenciaFuenteVsPaquete: mx };
}

// =====================================================================================================================
// 2. Sombra de los aleros: la sombra medida en la imagen contra la geometría
// =====================================================================================================================
// Marco de cada fachada en la escena: normal hacia afuera y eje a lo largo de la fachada (ver VISTA_FACHADA en main.js).
const MARCO = {
  'fachada-se': { n: [0, 0, 1], t: [1, 0, 0], largo: 45.5 },
  'fachada-no': { n: [0, 0, -1], t: [-1, 0, 0], largo: 45.5 },
  'fachada-ne': { n: [1, 0, 0], t: [0, 0, -1], largo: 23 },
  'fachada-so': { n: [-1, 0, 0], t: [0, 0, 1], largo: 23 },
};
const NIVELES = [3.74, 7.40, 11.10];                    // aleros (main.js, LENTES.partes.tec; escena.js, #partes)
const suma = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const pto = (M, s, y, prof) => [M.n[0] * prof + M.t[0] * s, y, M.n[2] * prof + M.t[2] * s];   // (a lo largo, altura, hacia afuera)

async function prepararGeometria() {
  const t0 = Date.now();
  // el contexto entra en las sombras (los vecinos cercanos también las proyectan en la app, y la vegetación se oculta al medir),
  // pero no en la vista: los rayos que miden el muro salen de 40 m afuera, dentro del 105 en la fachada suroeste
  const G = ['arquitectura', 'cubiertas', 'detalles', 'entrada', 'ventanas', 'sitio', 'cubiertas_sombra', 'contexto'];
  const m = await cargarTriangulos(RAIZ, G);
  const gi = (g) => G.indexOf(g);
  const esTeja = (i) => /terracotta/i.test(m.nombres[m.mat[i]]);
  const esFachada = (i) => { const n = m.nombres[m.mat[i]].toLowerCase(); return n.includes('plaster') && !n.includes('interior'); };
  // modelo real (tejas de verdad) y lo que la app usa para proyectar sombras (tejas → sustituto cubiertas_sombra)
  const real = new Rayos(m, (i) => m.grupo[i] !== gi('cubiertas_sombra'));
  const app = new Rayos(m, (i) => m.grupo[i] !== gi('cubiertas') ? true : !esTeja(i));
  // la vista: lo que la cámara ve del 106 (sin el sustituto, que solo ve la cámara de la sombra, y sin los vecinos)
  const vista = new Rayos(m, (i) => m.grupo[i] !== gi('cubiertas_sombra') && m.grupo[i] !== gi('contexto'));
  return { m, real, app, vista, esFachada, ms: Date.now() - t0, triangulos: m.mat.length };
}

/** Datos del muro y del alero de una fachada: plano del muro, borde del alero y altura del canto inferior en cada nivel. */
function medirAlero(geo, clave) {
  const M = MARCO[clave], out = {};
  // plano del muro: rayos horizontales hacia el edificio a media altura de cada piso, en varias posiciones
  const prof = [];
  for (let s = -M.largo / 2 + 2; s < M.largo / 2 - 2; s += 0.5) for (const y of [2.6, 6.3, 10]) {
    const o = pto(M, s, y, 40), h = geo.vista.lanzar(o, M.n.map((x) => -x));
    if (h && geo.esFachada(h.i)) prof.push(40 - h.t);
  }
  prof.sort((a, b) => a - b); out.muro = prof[prof.length >> 1];
  // borde del alero y canto inferior: rayos hacia arriba justo por dentro del borde
  out.niveles = NIVELES.map((yN) => {
    // borde exterior: el primer choque de rayos verticales que avanzan desde afuera (mediana de varias posiciones)
    const bordes = [];
    for (let s = -M.largo / 2 + 3.1; s < M.largo / 2 - 3; s += 2.9) {
      for (let d = out.muro + 2.2; d > out.muro; d -= 0.005) { const h = geo.vista.lanzar(pto(M, s, yN - 0.8, d), [0, 1, 0], 1.2); if (h) { bordes.push(d); break; } }
    }
    bordes.sort((a, b) => a - b); const borde = bordes[bordes.length >> 1];
    const cantos = [];
    for (let s = -M.largo / 2 + 3; s < M.largo / 2 - 3; s += 0.73) { const h = geo.vista.lanzar(pto(M, s, yN - 0.8, borde - 0.01), [0, 1, 0], 1.2); if (h) cantos.push(yN - 0.8 + h.t); }
    cantos.sort((a, b) => a - b);
    return { nivel: yN, borde, canto: cantos[cantos.length >> 1], vuelo: borde - out.muro };
  });
  return out;
}

/** Perfil de sombra de verdad (trazado de rayos hacia el sol) en una columna del muro; devuelve el borde sombra→sol. */
function bordeVerdad(rayos, M, s, muro, yArriba, yAbajo, sol) {
  const enSol = (y) => !rayos.lanzar(pto(M, s, y, muro + 0.003), sol, 200);
  const paso = 0.01, cambios = [];
  let prev = enSol(yArriba);
  for (let y = yArriba - paso; y >= yAbajo - 1e-9; y -= paso) {
    const v = enSol(y);
    if (v !== prev) { let a = y + paso, b = y; for (let i = 0; i < 12; i++) { const c = (a + b) / 2; (enSol(c) === prev) ? a = c : b = c; } cambios.push({ y: (a + b) / 2, aSol: v }); }
    prev = v;
  }
  return { cambios, arribaEnSol: enSol(yArriba) };
}

/** Busca una columna limpia de pañete (sin ventanas, ménsulas ni bajantes) para un nivel y un sol dados. */
function buscarColumna(geo, clave, alero, nivelIdx, sol) {
  const M = MARCO[clave], muro = alero.muro, N = alero.niveles[nivelIdx];
  const haciaMuro = M.n.map((x) => -x);
  const esPanete = (s, y) => { const h = geo.vista.lanzar(pto(M, s, y, muro + 4), haciaMuro, 6); return h && geo.esFachada(h.i) && Math.abs(4 - h.t) < 0.03; };
  const candidatos = [];
  for (let s = -M.largo / 2 + 1.2; s <= M.largo / 2 - 1.2; s += 0.2) {
    // tramo continuo de pañete bajo el alero (en esta columna y a ±8 cm, para poder promediar varios píxeles)
    let yTop = null, yBot = null;
    // se empieza justo sobre el canto del alero: más arriba, entre el canto y el encuentro con el muro, el rayo choca con el
    // alero; y sobre el encuentro vuelve a haber pañete, pero es el del piso de arriba
    for (let y = N.canto + 0.04; y > N.nivel - 3.2; y -= 0.02) {
      const ok = esPanete(s, y) && esPanete(s - 0.08, y) && esPanete(s + 0.08, y);
      if (ok && yTop == null) yTop = y;
      if (!ok && yTop != null) { yBot = y + 0.02; break; }
    }
    if (yTop == null || yBot == null || yTop - yBot < 0.8) continue;
    const vr = bordeVerdad(geo.real, M, s, muro, yTop - 0.01, yBot + 0.01, sol);
    // exactamente un paso de sombra (arriba) a sol (abajo) dentro del tramo, con margen a ambos lados
    if (vr.arribaEnSol || vr.cambios.length !== 1 || !vr.cambios[0].aSol) continue;
    const yS = vr.cambios[0].y;
    if (yTop - yS < 0.2 || yS - yBot < 0.3) continue;
    // lo que da la sombra en el borde debe ser el alero (no una ménsula ni un poste): el rayo choca cerca del borde exterior
    const h = geo.real.lanzar(pto(M, s, yS + 0.01, muro + 0.003), sol, 200);
    const pc = suma(pto(M, s, yS + 0.01, muro + 0.003), sol, h.t);
    const fuera = pc[0] * M.n[0] + pc[2] * M.n[2];
    if (fuera < N.borde - 0.25 || geo.m.grupos[geo.m.grupo[h.i]] !== 'cubiertas') continue;
    // y el caso debe ser el de un alero corrido (lejos de la entrada y de las esquinas): la fórmula y el trazado coinciden
    const tanP = sol[1] / Math.hypot(sol[0], sol[2]) / ((sol[0] * M.n[0] + sol[2] * M.n[2]) / Math.hypot(sol[0], sol[2]));
    if (Math.abs((N.canto - yS) - N.vuelo * tanP) > 0.05) continue;
    // la sombra que dibuja la app (con el sustituto de las tejas)
    const va = bordeVerdad(geo.app, M, s, muro, yTop - 0.01, yBot + 0.01, sol);
    const yApp = va.cambios.length === 1 && !va.arribaEnSol ? va.cambios[0].y : null;
    candidatos.push({ s, yTop, yBot, yS, yApp, margen: Math.min(yTop - yS, yS - yBot) });
  }
  // preferir el tramo más holgado y, a igualdad, el más cercano al centro de la fachada
  candidatos.sort((a, b) => (b.margen - a.margen) || (Math.abs(a.s) - Math.abs(b.s)));
  return candidatos;
}

function elegirMomentos(clave) {
  // momentos en que el sol pega en la fachada con un ángulo que da 0,45–1,8 m de sombra bajo el alero (1,65 m de vuelo)
  const rumbo = FACHADAS[clave].rumbo, bins = [[0.5, 0.85], [1.05, 1.6]], out = bins.map(() => []);
  for (let dia = 0; dia < 366; dia += 2) {
    const d = new Date(Date.UTC(2024, 0, 1 + dia)), f = { y: 2024, m: d.getUTCMonth() + 1, d: d.getUTCDate() };
    for (let min = 6 * 60 + 30; min <= 17 * 60 + 30; min += 10) {
      const p = posicionSol({ ...f, h: 0, min }), c = Math.cos((p.az - rumbo) * rad);
      if (p.alt < 12 || c < 0.45) continue;
      const prof = 1.65 * Math.tan(p.alt * rad) / c;
      bins.forEach(([a, b], i) => { if (prof >= a && prof <= b) out[i].push({ fecha: f, min, alt: p.alt, az: p.az, prof }); });
    }
  }
  return out;
}

/** Momentos y columnas de muro para medir la sombra de los aleros (los usan las comprobaciones 2 y 6). Se eligen una vez. */
let seleccion = null;
async function seleccionarCasos(pg, geo) {
  if (seleccion) return seleccion;
  const casos = [], notas = [];
  // cielo despejado en los datos (DNI ≥ 80 % de la de cielo limpio), para que la sombra tenga contraste
  for (const clave of Object.keys(MARCO)) {
    const alero = medirAlero(geo, clave);
    const bins = elegirMomentos(clave);
    for (let b = 0; b < bins.length; b++) {
      const lista = bins[b];
      // se prueban en orden (determinista) hasta hallar uno despejado con columna limpia
      const regs = await pg.evaluate((L) => L.map((c) => { const r = __e106.clima.registro(c.fecha, c.min); return r ? r.dni : null; }), lista);
      let hecho = false;
      for (let k = 0; k < lista.length && !hecho; k += 3) {
        const c = lista[k]; const dc = dniDespejado(c.alt);
        if (regs[k] == null || regs[k] < 0.8 * dc) continue;
        const nivelIdx = b === 0 ? 0 : 1;
        await irA(pg, { fecha: c.fecha, min: c.min, fachada: clave.slice(8), lente: 'foto' }, 2200);
        const dir = await pg.evaluate(() => { const E = __e106.escena; return { d: [E.solDir.x, E.solDir.y, E.solDir.z], alt: E.alt, az: E.az, int: E.sun.intensity, lluvia: __e106.U.lluvia.value }; });
        let cols = buscarColumna(geo, clave, alero, nivelIdx, dir.d);
        let nivelUsado = nivelIdx;
        if (!cols.length) { for (const alt of [0, 1, 2]) { if (alt === nivelIdx) continue; cols = buscarColumna(geo, clave, alero, alt, dir.d); if (cols.length) { nivelUsado = alt; break; } } }
        if (!cols.length) { notas.push(`${clave} ${c.fecha.y}-${c.fecha.m}-${c.fecha.d} ${c.min}: sin columna limpia`); continue; }
        casos.push({ clave, alero, nivelIdx: nivelUsado, col: cols[0], mom: c, dir }); hecho = true;
      }
      if (!hecho) notas.push(`${clave}, sombra ${['corta', 'larga'][b]}: no hubo momento despejado con columna limpia`);
    }
  }
  return (seleccion = { casos, notas });
}

async function comprobacion2(pg, geo) {
  const casos = [], notas = [];
  const sesgoApp = await pg.evaluate((c) => { const L = __e106.escena.sun.shadow; if (c) { L.normalBias = c; L.needsUpdate = true; } return { normalBias: L.normalBias, bias: L.bias, mapa: L.mapSize.x, radio: L.radius }; }, CONTROL);
  if (CONTROL) notas.push(`CONTROL: normalBias forzado a ${CONTROL} para probar que la comprobación detecta sombras cortas`);
  const sel = await seleccionarCasos(pg, geo);
  notas.push(...sel.notas);
  for (const s of sel.casos) {
    // la sombra se mide en la vista «Foto» (la selección pudo haber dejado otra lente si la corrió la comprobación 6)
    await irA(pg, { fecha: s.mom.fecha, min: s.mom.min, fachada: s.clave.slice(8), lente: 'foto' }, 2200);
    casos.push(await medirCaso(pg, geo, s.clave, s.alero, s.nivelIdx, s.col, s.mom, s.dir, casos.length));
  }
  // restaurar la vegetación y el bucle
  await pg.evaluate(() => { const E = __e106.escena; if (E.grupos.vegetacion) E.grupos.vegetacion.root.visible = true; E.sun.shadow.needsUpdate = true; __e106.S.pausa = false; });
  const medidos = casos.filter((c) => c.estado !== 'NO MEDIBLE');
  const falla = medidos.some((c) => c.estado === 'FALLA');
  const errs = medidos.map((c) => c.errorCm / 100 / c.profundidadVerdad);
  const sesgoMedio = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : null;
  return { estado: !medidos.length ? 'NO MEDIBLE' : falla ? 'FALLA' : 'PASA', sombraApp: sesgoApp, errorRelativoMedio: r2(sesgoMedio, 4),
    esperadoPorNormalBias: r2(-sesgoApp.normalBias / 1.65, 4), casos, notas,
    criterio: 'error ≤ máx(8 cm, 10 % de la profundidad de la sombra), contra el borde trazado con rayos sobre la geometría real',
    metodo: 'dos cuadros con la misma cámara: con sol y con el sol apagado (intensidad 0). Su cociente de luminancia vale 1 en la sombra y >1 al sol, lo que anula el color del pañete, la oclusión falsa bajo el alero, la viñeta y la niebla; el borde es el cruce del 50 % entre las mesetas de sombra y de sol. Vegetación oculta durante la medida (sus sombras tapan el muro).' };
}

// 7. Sol alto: bajo el alero no se cuela el sol. Con el sol a más de 60°, el muro justo bajo el alero está en sombra (el alero
//    tapa el rayo a menos de un metro del muro); ahí es donde el desplazamiento del mapa de sombras (bias) podría dejar pasar luz.
//    Se mide la franja de 60 cm bajo el canto, donde el trazado de rayos sobre la geometría da sombra en toda la franja.
function momentosSolAlto(clave) {
  const rumbo = FACHADAS[clave].rumbo, out = [];
  for (let dia = 0; dia < 366; dia += 2) {
    const d = new Date(Date.UTC(2024, 0, 1 + dia)), f = { y: 2024, m: d.getUTCMonth() + 1, d: d.getUTCDate() };
    for (let min = 9 * 60; min <= 15 * 60; min += 10) {
      const p = posicionSol({ ...f, h: 0, min }), c = Math.cos((p.az - rumbo) * rad);
      if (p.alt >= 60 && c >= 0.15) out.push({ fecha: f, min, alt: p.alt, az: p.az });
    }
  }
  return out;
}
function columnaSolAlto(geo, clave, alero, sol) {
  const M = MARCO[clave], muro = alero.muro, haciaMuro = M.n.map((x) => -x);
  const esPanete = (s, y) => { const h = geo.vista.lanzar(pto(M, s, y, muro + 4), haciaMuro, 6); return h && geo.esFachada(h.i) && Math.abs(4 - h.t) < 0.03; };
  for (const N of alero.niveles) for (let s = -M.largo / 2 + 1.2; s <= M.largo / 2 - 1.2; s += 0.2) {
    const yTop = N.canto - 0.02, yBot = N.canto - 0.62;
    let limpia = true; for (let y = yTop; y >= yBot && limpia; y -= 0.05) limpia = esPanete(s, y) && esPanete(s - 0.08, y) && esPanete(s + 0.08, y);
    if (!limpia) continue;
    const vr = bordeVerdad(geo.real, M, s, muro, yTop, yBot, sol);
    if (vr.arribaEnSol || vr.cambios.length) continue;                     // la verdad: sombra en toda la franja
    const h = geo.real.lanzar(pto(M, s, (yTop + yBot) / 2, muro + 0.003), sol, 200);
    if (!h || geo.m.grupos[geo.m.grupo[h.i]] !== 'cubiertas') continue;     // y la da el alero, no una ménsula
    // punto de control al sol: el suelo 3 m delante del muro, si el trazado lo da iluminado
    const g0 = pto(M, s, 6, muro + 3), hg = geo.real.lanzar(g0, [0, -1, 0], 12); if (!hg) continue;
    const suelo = [g0[0], 6 - hg.t + 0.01, g0[2]];
    if (geo.real.lanzar(suelo, sol, 200)) continue;
    return { s, nivel: N.nivel, canto: N.canto, yTop, yBot, suelo };
  }
  return null;
}
async function comprobacion7(pg, geo) {
  const casos = [], notas = [];
  const sesgoApp = await pg.evaluate((b) => { const L = __e106.escena.sun.shadow; if (b) { L.bias = b; L.needsUpdate = true; } return { bias: L.bias, normalBias: L.normalBias, mapa: L.mapSize.x }; }, CONTROL_BIAS);
  if (CONTROL_BIAS) notas.push(`CONTROL: bias forzado a ${CONTROL_BIAS} para probar que la comprobación detecta el sol colándose bajo el alero`);
  for (const clave of Object.keys(MARCO)) {
    const alero = medirAlero(geo, clave), lista = momentosSolAlto(clave);
    if (!lista.length) { notas.push(`${clave}: el sol nunca pasa de 60° de su lado`); continue; }
    const regs = await pg.evaluate((L) => L.map((c) => { const r = __e106.clima.registro(c.fecha, c.min); return r ? r.dni : null; }), lista);
    let hecho = false;
    for (let k = 0; k < lista.length && !hecho; k += 4) {
      const c = lista[k]; if (regs[k] == null || regs[k] < 0.8 * dniDespejado(c.alt)) continue;
      await irA(pg, { fecha: c.fecha, min: c.min, fachada: clave.slice(8), lente: 'foto' }, 2200);
      const dir = await pg.evaluate(() => { const E = __e106.escena; return { d: [E.solDir.x, E.solDir.y, E.solDir.z], alt: E.alt, az: E.az }; });
      const col = columnaSolAlto(geo, clave, alero, dir.d);
      if (!col) { notas.push(`${clave} ${c.fecha.m}/${c.fecha.d} ${c.min}: sin franja limpia en sombra bajo el alero`); continue; }
      const M = MARCO[clave], muro = alero.muro, yMid = (col.yTop + col.yBot) / 2;
      // cámara a 11 m y por DEBAJO del canto (si no, el propio alero tapa la franja), mirando entre la franja y el suelo de control
      const objetivo = pto(M, col.s, yMid - 1.4, muro + 1.5), cam = pto(M, col.s, col.yBot - 0.3, muro + 11);
      // solo los puntos de la franja que la cámara ve directamente (sin el alero, un poste o una baranda delante)
      const visible = (p) => { const dv = [p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]], L = Math.hypot(...dv); return !geo.vista.lanzar(cam, dv.map((x) => x / L), L - 0.01); };
      const ys = []; for (let y = col.yTop; y >= col.yBot; y -= 0.01) if (visible(pto(M, col.s, y, muro + 0.001))) ys.push(y);
      if (ys.length < 40) { notas.push(`${clave} ${c.fecha.m}/${c.fecha.d} ${c.min}: la cámara no ve la franja`); continue; }
      const puntos = [...ys.map((y) => pto(M, col.s, y, muro + 0.001)), col.suelo];
      const prep = (E, a) => {
        if (E.grupos.vegetacion && E.grupos.vegetacion.root.visible) { E.grupos.vegetacion.root.visible = false; E.sun.shadow.needsUpdate = true; }
        // los postes de la ciudad puestos por regla (src/postes.js) tampoco están en la geometría del trazado (geo.vista): uno delante
        // de la franja la tapa sin que visible() lo sepa. Se esconden como la vegetación; no proyectan sombra
        if (E.postes?.raiz.visible) E.postes.raiz.visible = false;
        E.camera.position.set(...a.cam); E.camera.lookAt(...a.objetivo); E.camera.updateMatrixWorld(true);
        if (a.apagar) { E._intGuardada = E.sun.intensity; E.sun.intensity = 0; } else if (E._intGuardada != null) { E.sun.intensity = E._intGuardada; E._intGuardada = null; }
      };
      await capturar(pg, prep, { cam, objetivo, apagar: false });
      const urlA = await capturar(pg, prep, { cam, objetivo, apagar: false }), urlB = await capturar(pg, prep, { cam, objetivo, apagar: true });
      await capturar(pg, prep, { cam, objetivo, apagar: false });
      const px = await pg.evaluate((P) => { const E = __e106.escena, V = E.camera.position.constructor; return P.map((p) => { const v = new V(...p).project(E.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }); }, puntos);
      const A = await decodificar(urlA), B = await decodificar(urlB), esc = A.w / ANCHO;
      const cociente = ([u, v]) => { let a = 0, bb = 0; for (let q = -4; q <= 4; q++) { a += lumBilineal(A, (u + q) * esc, v * esc); bb += lumBilineal(B, (u + q) * esc, v * esc); } return a / Math.max(bb, 1e-6); };
      const pSuelo = px.pop(), dentro = ([u, v]) => u > 8 && v > 8 && u < ANCHO - 8 && v < ALTO - 8;
      if (!dentro(pSuelo) || !px.every(dentro)) { notas.push(`${clave} ${c.fecha.m}/${c.fecha.d} ${c.min}: la franja o el suelo de control salen del cuadro`); continue; }
      const rSuelo = cociente(pSuelo), r = suavizar(px.map(cociente));
      let jMax = 0; r.forEach((x, j) => { if (x > r[jMax]) jMax = j; });
      // en sombra, el cociente sol/sin sol vale ~1; al sol (el suelo de control), bastante más. Tolerancia: 8 % del salto del control
      const umbral = 1 + 0.08 * (rSuelo - 1);
      const estado = rSuelo < 1.25 ? 'NO MEDIBLE' : r[jMax] <= umbral ? 'PASA' : 'FALLA';
      casos.push({ estado, fachada: clave, momento: `${c.fecha.y}-${String(c.fecha.m).padStart(2, '0')}-${String(c.fecha.d).padStart(2, '0')} ${String(Math.floor(c.min / 60)).padStart(2, '0')}:${String(c.min % 60).padStart(2, '0')}`,
        alt: r2(dir.alt, 1), nivelAlero: col.nivel, cocienteMaxFranja: r2(r[jMax], 3), bajoElCantoCm: Math.round((col.canto - ys[jMax]) * 100), cocienteSueloAlSol: r2(rSuelo, 2), umbral: r2(umbral, 3) });
      hecho = true;
    }
    if (!hecho) notas.push(`${clave}: no hubo momento despejado con sol alto y franja limpia`);
  }
  await pg.evaluate(() => { const E = __e106.escena; if (E.grupos.vegetacion) E.grupos.vegetacion.root.visible = true; if (E.postes && E.ciudad) E.postes.raiz.visible = E.ciudad.visible !== false; E.sun.shadow.needsUpdate = true; __e106.S.pausa = false; });
  const medidos = casos.filter((c) => c.estado !== 'NO MEDIBLE');
  return { estado: !medidos.length ? 'NO MEDIBLE' : medidos.some((c) => c.estado === 'FALLA') ? 'FALLA' : 'PASA', sombraApp: sesgoApp, casos, notas,
    criterio: 'con el sol a más de 60°, en la franja de 60 cm bajo el canto del alero (en sombra según el trazado de rayos) el cociente de luminancia con sol / sin sol no pasa de 1 + 8 % del de un suelo al sol',
    metodo: 'dos cuadros con la misma cámara, con sol y con el sol apagado; el cociente vale 1 en la sombra; control: un punto de suelo a 3 m del muro, al sol según el trazado, debe dar al menos 1,25. Vegetación oculta.' };
}

/** Media móvil de 5 muestras (±2), sin salirse de los extremos. */
const suavizar = (r) => r.map((_, j) => { let s = 0, n = 0; for (let k = -2; k <= 2; k++) if (r[j + k] != null) { s += r[j + k]; n++; } return s / n; });
/** Mesetas de sombra (lo) y de sol (hi) de un perfil que va de arriba (sombra) hacia abajo (sol), el umbral y sus cruces. */
function mesetasYCruces(ys, suav) {
  // mesetas: primero globales (percentiles 5 y 95: la columna se eligió con ≥ 20 cm de sombra y ≥ 30 cm de sol) y luego
  // locales, a 6–20 cm a cada lado del cruce, para que la variación lenta del muro (oclusión falsa, tonemapping) no corra el umbral
  const orden = [...suav].sort((x, y) => x - y);
  let lo = orden[Math.floor(orden.length * 0.05)], hi = orden[Math.floor(orden.length * 0.95)];
  let umbral = (lo + hi) / 2;
  const med = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
  const cruceEn = (thr) => { for (let j = 1; j < suav.length; j++) if (suav[j - 1] <= thr && suav[j] > thr) return ys[j - 1] + (ys[j] - ys[j - 1]) * (thr - suav[j - 1]) / (suav[j] - suav[j - 1]); return null; };
  for (let it = 0; it < 3; it++) {
    const yc = cruceEn(umbral); if (yc == null) break;
    const l = med(ys.map((y, j) => (y > yc + 0.06 && y < yc + 0.2 ? suav[j] : null))), h = med(ys.map((y, j) => (y < yc - 0.06 && y > yc - 0.2 ? suav[j] : null)));
    if (l == null || h == null || h <= l) break;
    lo = l; hi = h; umbral = (lo + hi) / 2;
  }
  // cruces del umbral (con histéresis del 15 % del salto), de arriba (sombra) hacia abajo (sol)
  const hist = 0.15 * (hi - lo); let estado = suav[0] > umbral ? 1 : 0; const cruces = [];
  for (let j = 1; j < suav.length; j++) {
    if (estado === 0 && suav[j] > umbral + hist) { estado = 1; cruces.push(j); }
    else if (estado === 1 && suav[j] < umbral - hist) { estado = 0; cruces.push(-j); }
  }
  return { lo, hi, umbral, cruces };
}
/** Altura exacta (interpolada) donde el perfil pasa el umbral, cerca del cruce j. */
function alturaDelCruce(ys, suav, umbral, j) {
  while (j > 0 && suav[j - 1] > umbral) j--;
  const f = (umbral - suav[j - 1]) / (suav[j] - suav[j - 1]);
  return ys[j - 1] + (ys[j] - ys[j - 1]) * f;
}

async function medirCaso(pg, geo, clave, alero, nivelIdx, col, mom, dir, i) {
  const M = MARCO[clave], N = alero.niveles[nivelIdx], muro = alero.muro;
  const yMid = (col.yS + Math.max(col.yBot, col.yS - 0.6)) / 2 + 0.15;
  const D = 8;                                                       // cámara a 8 m del muro, de frente, a la altura del borde esperado
  const objetivo = pto(M, col.s, yMid, muro), cam = pto(M, col.s, yMid, muro + D);
  // la línea vertical de puntos del muro, 1 mm por delante
  const ys = []; for (let y = col.yTop - 0.02; y >= col.yBot + 0.02; y -= 0.004) ys.push(y);
  const puntos = ys.map((y) => pto(M, col.s, y, muro + 0.001));
  // ¿algo tapa la línea desde la cámara? (postes, barandas, la entrada)
  const tapados = puntos.filter((p) => { const dv = [p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]], L = Math.hypot(...dv); return geo.vista.lanzar(cam, dv.map((x) => x / L), L - 0.01); }).length;
  const prep = (E, a) => {
    if (E.grupos.vegetacion && E.grupos.vegetacion.root.visible) { E.grupos.vegetacion.root.visible = false; E.sun.shadow.needsUpdate = true; }
    E.camera.position.set(...a.cam); E.camera.lookAt(...a.objetivo); E.camera.updateMatrixWorld(true);
    if (a.apagar) { E._intGuardada = E.sun.intensity; E.sun.intensity = 0; } else if (E._intGuardada != null) { E.sun.intensity = E._intGuardada; E._intGuardada = null; }
  };
  await capturar(pg, prep, { cam, objetivo, apagar: false });            // un cuadro para rehacer el mapa de sombras sin vegetación
  const urlA = await capturar(pg, prep, { cam, objetivo, apagar: false });
  const urlB = await capturar(pg, prep, { cam, objetivo, apagar: true });
  await capturar(pg, prep, { cam, objetivo, apagar: false });
  // proyección de los puntos con la cámara de la app
  const canto = N.canto;
  const px = await pg.evaluate((P) => { const E = __e106.escena, V = E.camera.position.constructor; return P.map((p) => { const v = new V(...p).project(E.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }); }, [...puntos, pto(M, col.s, canto, muro + 0.001)]);
  const pxCanto = px.pop();
  const A = await decodificar(urlA), B = await decodificar(urlB);
  const escala = A.w / ANCHO;
  // cociente de luminancias, promediado en ±4 px a lo ancho (la columna es limpia en ±8 cm ≈ ±14 px)
  const r = px.map(([u, v]) => { let a = 0, b = 0; for (let k = -4; k <= 4; k++) { a += lumBilineal(A, (u + k) * escala, v * escala); b += lumBilineal(B, (u + k) * escala, v * escala); } return a / Math.max(b, 1e-6); });
  const suav = suavizar(r);
  const { lo, hi, umbral, cruces } = mesetasYCruces(ys, suav);
  let yMedido = null, motivo = null;
  const contraste = hi / lo;
  if (contraste < 1.25) motivo = `poco contraste entre sombra y sol (cociente ${contraste.toFixed(2)})`;
  else if (suav[0] > umbral) motivo = 'la parte alta del muro no está en sombra en la imagen';
  else if (cruces.length !== 1) motivo = `el perfil cruza el umbral ${cruces.length} veces (se esperaba una)`;
  else yMedido = alturaDelCruce(ys, suav, umbral, cruces[0]);
  const profVerdad = canto - col.yS, profApp = col.yApp != null ? canto - col.yApp : null;
  const tanP = Math.tan(dir.alt * rad) / Math.cos((dir.az - FACHADAS[clave].rumbo) * rad);
  const profFormula = N.vuelo * tanP;
  const profMedida = yMedido != null ? canto - yMedido : null;
  const err = profMedida != null ? profMedida - profVerdad : null;
  const tol = Math.max(0.08, 0.1 * profVerdad);
  const estado2 = profMedida == null ? 'NO MEDIBLE' : Math.abs(err) <= tol ? 'PASA' : 'FALLA';
  // captura anotada: la línea medida, el borde de verdad (magenta) y el medido (verde)
  const aPix = (y) => { const j = Math.max(0, Math.min(ys.length - 1, Math.round((col.yTop - 0.02 - y) / 0.004))); return px[j]; };
  const [u0, v0] = px[0], [u1, v1] = px[px.length - 1];
  const marca = (y, color, txt, lado) => { const [u, v] = y === canto ? pxCanto : aPix(y); return `<line x1="${u - 60}" y1="${v}" x2="${u + 60}" y2="${v}" stroke="${color}" stroke-width="2"/><text x="${lado > 0 ? u + 66 : u - 66}" y="${v + 5}" fill="${color}" font-size="18" font-family="monospace" text-anchor="${lado > 0 ? 'start' : 'end'}" stroke="black" stroke-width="3" paint-order="stroke">${txt}</text>`; };
  const f2 = (x) => (x == null ? '—' : x.toFixed(3));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${A.w}" height="${A.h}"><g transform="scale(${escala})">
    <line x1="${u0}" y1="${v0}" x2="${u1}" y2="${v1}" stroke="#39f" stroke-width="1.5" stroke-dasharray="6 4"/>
    ${marca(col.yS, '#ff3df2', `verdad ${f2(profVerdad)} m`, -1)}
    ${yMedido != null ? marca(yMedido, '#3dff6a', `medida ${f2(profMedida)} m`, 1) : ''}
    ${marca(canto, '#ffd23d', `canto del alero ${canto.toFixed(2)} m`, 1)}
    <rect x="10" y="10" width="980" height="92" fill="black" opacity="0.6"/>
    <text x="20" y="38" fill="white" font-size="20" font-family="monospace">${clave} · ${mom.fecha.y}-${String(mom.fecha.m).padStart(2, '0')}-${String(mom.fecha.d).padStart(2, '0')} ${String(Math.floor(mom.min / 60)).padStart(2, '0')}:${String(mom.min % 60).padStart(2, '0')} · alt ${dir.alt.toFixed(1)}° az ${dir.az.toFixed(1)}° · nivel ${N.nivel} m</text>
    <text x="20" y="64" fill="white" font-size="20" font-family="monospace">verdad ${f2(profVerdad)} · fórmula ${f2(profFormula)} · sombra de la app ${f2(profApp)} · medida ${f2(profMedida)} m</text>
    <text x="20" y="90" fill="${estado2 === 'PASA' ? '#3dff6a' : '#ff5a5a'}" font-size="20" font-family="monospace">${estado2}${err != null ? ` · error ${(err * 100).toFixed(1)} cm (tolerancia ${(tol * 100).toFixed(1)} cm)` : ` · ${motivo}`}</text>
  </g></svg>`;
  const nombre = `sombra-${String(i + 1).padStart(2, '0')}-${clave}.png`;
  await sharp(A.png).composite([{ input: Buffer.from(svg) }]).png().toFile(path.join(SALIDA, nombre));
  return {
    estado: estado2, fachada: clave, momento: `${mom.fecha.y}-${String(mom.fecha.m).padStart(2, '0')}-${String(mom.fecha.d).padStart(2, '0')} ${String(Math.floor(mom.min / 60)).padStart(2, '0')}:${String(mom.min % 60).padStart(2, '0')}`,
    alt: r2(dir.alt, 2), az: r2(dir.az, 2), intensidadSol: r2(dir.int, 2), nivelAlero: N.nivel, cantoAlero: r2(canto), vuelo: r2(N.vuelo), muro: r2(muro),
    columna: r2(col.s, 2), tramoPanete: [r2(col.yBot, 2), r2(col.yTop, 2)],
    profundidadVerdad: r2(profVerdad), profundidadFormula: r2(profFormula), profundidadSombraApp: r2(profApp), profundidadMedida: r2(profMedida),
    errorCm: err != null ? r2(err * 100, 1) : null, toleranciaCm: r2(tol * 100, 1), contraste: r2(contraste, 2), cruces: cruces.length, puntosTapados: tapados,
    mmPorPixel: r2(Math.abs((ys[0] - ys[ys.length - 1]) / (v1 - v0)) * 1000, 2), mesetas: [r2(lo, 3), r2(hi, 3)], motivo, captura: nombre,
    perfil: ys.map((y, j) => [r2(y, 3), r2(suav[j], 3)]).filter((_, j) => j % 5 === 0),   // [altura, cociente con sol / sin sol] cada 2 cm
  };
}

// =====================================================================================================================
// 6. La sombra de los aleros en la lente «Sol» (solo directo): los mismos momentos y columnas de la comprobación 2
// =====================================================================================================================
// La lente pinta cada punto según el sol directo que le llega. Bajo el alero, en sombra, debe salir el color de «nada»
// (azul noche), y al sol, uno claramente más cálido; el borde entre los dos, donde lo pone la geometría.
async function comprobacion6(pg, geo) {
  const sel = await seleccionarCasos(pg, geo);
  const casos = [], notas = [...sel.notas];
  for (const s of sel.casos) {
    await irA(pg, { fecha: s.mom.fecha, min: s.mom.min, fachada: s.clave.slice(8), lente: 'sol', modo: 'directa' }, 2800);
    casos.push(await medirLenteSol(pg, s, casos.length));
  }
  await pg.evaluate(() => { const E = __e106.escena; if (E.grupos.vegetacion) E.grupos.vegetacion.root.visible = true; E.sun.shadow.needsUpdate = true; __e106.S.pausa = false; });
  const medidos = casos.filter((c) => c.estado !== 'NO MEDIBLE');
  return { estado: !casos.length ? 'NO MEDIBLE' : casos.some((c) => c.estado !== 'PASA') ? 'FALLA' : 'PASA', casos, notas,
    criterio: 'en la lente Sol, «Solo directo»: dentro de la sombra del alero el muro sale del color de «nada» (diferencia media ≤ 8 niveles por canal contra el mismo cuadro con la radiación directa en 0); al sol, al menos 40 niveles más cálido (rojo menos azul); y el borde a ≤ máx(8 cm, 10 % de la profundidad) del trazado con rayos. Un caso que no se puede medir cuenta como falla: sin la sombra, la lente no tiene borde.',
    metodo: 'dos cuadros con la misma cámara y la misma luz: la lente tal cual y la lente con la radiación directa normal puesta en 0 (todo el muro de color «nada»). La diferencia de calidez (R − B, en niveles sRGB) vale 0 en la sombra y crece al sol; el borde es el cruce del 50 % entre las dos mesetas, igual que en la comprobación 2.',
    medidos: medidos.length };
}

async function medirLenteSol(pg, s, i) {
  const { clave, alero, nivelIdx, col, mom, dir } = s;
  const M = MARCO[clave], N = alero.niveles[nivelIdx], muro = alero.muro, canto = N.canto;
  const yMid = (col.yS + Math.max(col.yBot, col.yS - 0.6)) / 2 + 0.15;
  const objetivo = pto(M, col.s, yMid, muro), cam = pto(M, col.s, yMid, muro + 8);
  const ys = []; for (let y = col.yTop - 0.02; y >= col.yBot + 0.02; y -= 0.004) ys.push(y);
  const puntos = ys.map((y) => pto(M, col.s, y, muro + 0.001));
  const prep = (E, a) => {
    if (E.grupos.vegetacion && E.grupos.vegetacion.root.visible) { E.grupos.vegetacion.root.visible = false; E.sun.shadow.needsUpdate = true; }
    E.camera.position.set(...a.cam); E.camera.lookAt(...a.objetivo); E.camera.updateMatrixWorld(true);
    if (a.nada) { E._dniGuardada = __e106.U.dniW.value; __e106.U.dniW.value = 0; } else if (E._dniGuardada != null) { __e106.U.dniW.value = E._dniGuardada; E._dniGuardada = null; }
  };
  await capturar(pg, prep, { cam, objetivo, nada: false });
  const urlA = await capturar(pg, prep, { cam, objetivo, nada: false });
  const urlB = await capturar(pg, prep, { cam, objetivo, nada: true });
  await capturar(pg, prep, { cam, objetivo, nada: false });
  const estadoLente = await pg.evaluate(() => ({ lente: __e106.S.lente, modo: __e106.S.solModo, calor: __e106.U.calor.value, total: __e106.U.total.value, dni: __e106.U.dniW.value }));
  const px = await pg.evaluate((P) => { const E = __e106.escena, V = E.camera.position.constructor; return P.map((p) => { const v = new V(...p).project(E.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }); }, puntos);
  const A = await decodificar(urlA), B = await decodificar(urlB), escala = A.w / ANCHO;
  // color promedio (sRGB, 0–255) en ±4 px a lo ancho de la columna
  const rgb = (img, u, v) => { const c = [0, 0, 0]; const y = Math.max(0, Math.min(img.h - 1, Math.round(v * escala - 0.5)));
    for (let k = -4; k <= 4; k++) { const x = Math.max(0, Math.min(img.w - 1, Math.round((u + k) * escala - 0.5))), o = (y * img.w + x) * 4; c[0] += img.data[o]; c[1] += img.data[o + 1]; c[2] += img.data[o + 2]; }
    return c.map((x) => x / 9); };
  const cA = px.map(([u, v]) => rgb(A, u, v)), cB = px.map(([u, v]) => rgb(B, u, v));
  const calidez = suavizar(cA.map((a, j) => (a[0] - a[2]) - (cB[j][0] - cB[j][2])));
  const difAbs = cA.map((a, j) => (Math.abs(a[0] - cB[j][0]) + Math.abs(a[1] - cB[j][1]) + Math.abs(a[2] - cB[j][2])) / 3);
  const med = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
  // zonas según la verdad (trazado de rayos), con 8 cm de margen al borde
  const enSombra = med(difAbs.map((d, j) => (ys[j] > col.yS + 0.08 ? d : null)));
  const alSol = med(calidez.map((d, j) => (ys[j] < col.yS - 0.08 ? d : null)));
  const zonaS = cA.filter((_, j) => ys[j] > col.yS + 0.08);
  const colorSombra = zonaS.length ? [0, 1, 2].map((k) => Math.round(zonaS.reduce((t, a) => t + a[k], 0) / zonaS.length)) : null;
  const { hi, umbral, cruces } = mesetasYCruces(ys, calidez);
  const profVerdad = canto - col.yS, tol = Math.max(0.08, 0.1 * profVerdad);
  let yMedido = null, motivo = null;
  if (enSombra == null || enSombra > 8) motivo = `dentro de la sombra del alero el muro no tiene el color de «nada» (diferencia media ${enSombra?.toFixed(1)} niveles)`;
  else if (alSol == null || alSol < 40) motivo = `al sol el muro no sale claramente más cálido (${alSol?.toFixed(1)} niveles)`;
  else if (calidez[0] > umbral) motivo = 'la parte alta del muro no está en sombra en la lente';
  else if (cruces.length !== 1) motivo = `el perfil cruza el umbral ${cruces.length} veces (se esperaba una)`;
  else yMedido = alturaDelCruce(ys, calidez, umbral, cruces[0]);
  const profMedida = yMedido != null ? canto - yMedido : null, err = profMedida != null ? profMedida - profVerdad : null;
  const estado = motivo ? 'FALLA' : Math.abs(err) <= tol ? 'PASA' : 'FALLA';
  if (!motivo && estado === 'FALLA') motivo = `borde a ${(err * 100).toFixed(1)} cm del trazado (tolerancia ${(tol * 100).toFixed(1)} cm)`;
  // captura anotada: borde de verdad (magenta) y medido (verde)
  const aPix = (y) => px[Math.max(0, Math.min(ys.length - 1, Math.round((col.yTop - 0.02 - y) / 0.004)))];
  const marca = (y, color, txt, lado) => { const [u, v] = aPix(y); return `<line x1="${u - 60}" y1="${v}" x2="${u + 60}" y2="${v}" stroke="${color}" stroke-width="2"/><text x="${lado > 0 ? u + 66 : u - 66}" y="${v + 5}" fill="${color}" font-size="18" font-family="monospace" text-anchor="${lado > 0 ? 'start' : 'end'}" stroke="black" stroke-width="3" paint-order="stroke">${txt}</text>`; };
  const f2 = (x) => (x == null ? '—' : x.toFixed(3));
  const fecha = `${mom.fecha.y}-${String(mom.fecha.m).padStart(2, '0')}-${String(mom.fecha.d).padStart(2, '0')} ${String(Math.floor(mom.min / 60)).padStart(2, '0')}:${String(mom.min % 60).padStart(2, '0')}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${A.w}" height="${A.h}"><g transform="scale(${escala})">
    <line x1="${px[0][0]}" y1="${px[0][1]}" x2="${px[px.length - 1][0]}" y2="${px[px.length - 1][1]}" stroke="#39f" stroke-width="1.5" stroke-dasharray="6 4"/>
    ${marca(col.yS, '#ff3df2', `verdad ${f2(profVerdad)} m`, -1)}
    ${yMedido != null ? marca(yMedido, '#3dff6a', `medida ${f2(profMedida)} m`, 1) : ''}
    <rect x="10" y="10" width="1080" height="66" fill="black" opacity="0.6"/>
    <text x="20" y="38" fill="white" font-size="20" font-family="monospace">lente Sol, solo directo · ${clave} · ${fecha} · alt ${dir.alt.toFixed(1)}° · nivel ${N.nivel} m</text>
    <text x="20" y="64" fill="${estado === 'PASA' ? '#3dff6a' : '#ff5a5a'}" font-size="20" font-family="monospace">${estado}${err != null ? ` · error ${(err * 100).toFixed(1)} cm (tol. ${(tol * 100).toFixed(1)})` : ''}${motivo ? ' · ' + motivo.slice(0, 70) : ''}</text>
  </g></svg>`;
  const nombre = `lente-sol-${String(i + 1).padStart(2, '0')}-${clave}.png`;
  await sharp(A.png).composite([{ input: Buffer.from(svg) }]).png().toFile(path.join(SALIDA, nombre));
  return { estado, fachada: clave, momento: fecha, alt: r2(dir.alt, 2), nivelAlero: N.nivel, lente: estadoLente,
    profundidadVerdad: r2(profVerdad), profundidadMedida: r2(profMedida), errorCm: err != null ? r2(err * 100, 1) : null, toleranciaCm: r2(tol * 100, 1),
    difSombraNiveles: r2(enSombra, 1), calidezSolNiveles: r2(alSol, 1), mesetaSol: r2(hi, 1), cruces: cruces.length,
    colorSombraSRGB: colorSombra, motivo, captura: nombre,
    perfil: ys.map((y, j) => [r2(y, 3), r2(calidez[j], 1)]).filter((_, j) => j % 5 === 0) };
}

// =====================================================================================================================
// 3. Luces quemadas
// =====================================================================================================================
async function elegirMomentosLuz(pg) {
  // un día seco con sol limpio en la mañana, al mediodía y en la tarde; y la hora diurna más lluviosa de 2023
  const cand = [];
  for (let dia = 10; dia < 110; dia++) { const d = new Date(Date.UTC(2024, 0, 1 + dia)); cand.push({ y: 2024, m: d.getUTCMonth() + 1, d: d.getUTCDate() }); }
  const H = [8 * 60 + 30, 12 * 60 + 15, 16 * 60 + 45];
  const regs = await pg.evaluate(([C, H]) => C.map((f) => H.map((min) => __e106.clima.registro(f, min))), [cand, H]);
  // el día más limpio: el que tiene la mayor transmisión mínima (DNI de ERA5 / DNI de cielo despejado) en las tres horas, sin lluvia
  let despejado = null, mejorK = -1;
  for (let i = 0; i < cand.length; i++) {
    const ks = H.map((min, k) => { const p = posicionSol({ ...cand[i], h: 0, min }), r = regs[i][k]; return r && r.lluvia < 0.1 ? r.dni / dniDespejado(p.alt) : -1; });
    const k = Math.min(...ks); if (k > mejorK) { mejorK = k; despejado = cand[i]; }
  }
  if (mejorK < 0.5) despejado = null;
  const lluvia = await pg.evaluate(() => {
    let mejor = null;
    for (let dia = 0; dia < 365; dia++) { const d = new Date(Date.UTC(2023, 0, 1 + dia)), f = { y: 2023, m: d.getUTCMonth() + 1, d: d.getUTCDate() };
      for (let h = 9; h <= 15; h++) { const r = __e106.clima.registro(f, h * 60 + 30); if (r && (!mejor || r.lluvia > mejor.lluvia)) mejor = { f, min: h * 60 + 30, lluvia: r.lluvia, nubes: r.nubes, dni: r.dni }; } }
    return mejor;
  });
  const m = [];
  if (despejado) {
    m.transmision = mejorK;
    m.push({ id: 'mañana despejada', fecha: despejado, min: H[0] }, { id: 'mediodía despejado', fecha: despejado, min: H[1] }, { id: 'tarde despejada', fecha: despejado, min: H[2] });
  }
  if (lluvia) m.push({ id: `lluvia (${lluvia.lluvia.toFixed(1)} mm/h, ${Math.round(lluvia.nubes)} % nubes)`, fecha: lluvia.f, min: lluvia.min });
  return m;
}

async function comprobacion3(pg) {
  const momentos = await elegirMomentosLuz(pg);
  const vistas = [['esquina', { vista: 'esquina' }], ['aerea', { vista: 'aerea' }], ['fachada-se', { fachada: 'se' }], ['fachada-no', { fachada: 'no' }], ['fachada-ne', { fachada: 'ne' }], ['fachada-so', { fachada: 'so' }]];
  const filas = [];
  for (const mo of momentos) for (const [nv, dv] of vistas) {
    await irA(pg, { fecha: mo.fecha, min: mo.min, lente: 'foto', ...dv }, 2800);
    const urlA = await capturar(pg);
    // máscara del cielo: el mismo cuadro sin la bóveda; lo que queda negro (fondo) es cielo
    const urlB = await capturar(pg, (E) => { E.sky.visible = false; });
    // y sin bloom, para saber cuánto aclara el bloom (dato informativo: a contraluz deja un velo lechoso)
    const urlC = await capturar(pg, (E) => { E.sky.visible = true; E._salida0 = E.pipeline.outputNode; E.setSalida('sinBloom'); });
    await capturar(pg, (E) => { E.pipeline.outputNode = E._salida0; E.pipeline.needsUpdate = true; });
    await pg.evaluate(() => { __e106.S.pausa = false; });
    const A = await decodificar(urlA), B = await decodificar(urlB), C = await decodificar(urlC);
    let total = 0, quemados = 0, cielo = 0, velo = 0;
    const hist = new Uint32Array(256);
    const mask = Buffer.alloc(A.w * A.h * 4);
    for (let p = 0; p < A.w * A.h; p++) {
      const o = p * 4;
      if (Math.max(B.data[o], B.data[o + 1], B.data[o + 2]) <= 4) { cielo++; mask[o + 2] = 120; mask[o + 3] = 90; continue; }
      total++;
      const mx = Math.max(A.data[o], A.data[o + 1], A.data[o + 2]); hist[mx]++;
      velo += (A.data[o] + A.data[o + 1] + A.data[o + 2] - C.data[o] - C.data[o + 1] - C.data[o + 2]) / 3;
      if (A.data[o] >= 250 || A.data[o + 1] >= 250 || A.data[o + 2] >= 250) { quemados++; mask[o] = 255; mask[o + 3] = 255; }
    }
    const pct = total ? (100 * quemados) / total : 0;
    let acum = 0, p999 = 0, maximo = 0; for (let v = 0; v < 256; v++) { if (hist[v]) maximo = v; acum += hist[v]; if (!p999 && acum >= total * 0.999) p999 = v; }
    const nombre = `luz-${mo.id.split(' ')[0].normalize('NFD').replace(/[^a-z]/gi, '')}-${nv}.png`;
    await sharp(A.png).composite([{ input: mask, raw: { width: A.w, height: A.h, channels: 4 } }]).png().toFile(path.join(SALIDA, nombre));
    filas.push({ momento: mo.id, fecha: `${mo.fecha.y}-${mo.fecha.m}-${mo.fecha.d} ${Math.floor(mo.min / 60)}:${String(mo.min % 60).padStart(2, '0')}`, vista: nv,
      pctQuemado: r2(pct, 3), pixelesQuemados: quemados, canalMax: maximo, canalP999: p999, aclaradoBloom: r2(total ? velo / total : 0, 1), pixelesEdificioSuelo: total, pctCielo: r2((100 * cielo) / (A.w * A.h), 1), estado: pct > 1 ? 'FALLA' : 'PASA', captura: nombre });
  }
  return { estado: !filas.length ? 'NO MEDIBLE' : filas.some((f) => f.estado === 'FALLA') ? 'FALLA' : 'PASA',
    transmisionDiaDespejado: r2(momentos.transmision, 2), umbral: 'más del 1 % de los píxeles de edificio y suelo con algún canal ≥ 250',
    notaBloom: 'aclaradoBloom = cuánto sube en promedio (niveles 0–255) cada píxel de edificio y suelo por el bloom; es informativo, no cuenta para PASA/FALLA',
    mascara: 'cielo = píxeles que quedan negros (≤ 4) al dibujar el mismo cuadro sin la bóveda del cielo (la escena no tiene fondo): excluye cielo y nubes con exactitud de píxel, sin suponer dónde está el horizonte. En las capturas: rojo = quemado, azul = cielo excluido.',
    filas };
}

// =====================================================================================================================
// 4 y 5. Formas de ver, vistas, recorrido guiado y consultas: errores y tirones
// =====================================================================================================================
const LENTES = ['sol', 'lluvia', 'viento', 'sombras', 'partes', 'foto'];
async function clicLente(pg, k) {
  // el botón visible de la barra «Ver» (hay otros data-lente dentro de textos); el clic ocurre dentro de la página
  return pg.evaluate((k) => {
    const b = [...document.querySelectorAll(`[data-lente="${k}"]`)].find((e) => e.offsetParent !== null && e.tagName === 'BUTTON') ?? document.querySelector(`button[data-lente="${k}"]`);
    const t0 = performance.now(); b?.click(); return { t0, hay: !!b };
  }, k);
}
async function tironesUnaVez(pg) {
  // en la página recién cargada: el primer cambio a cada forma de ver es el que puede compilar sombreadores
  const filas = [];
  const base0 = await pg.evaluate(() => performance.now()); await esperar(2000);
  const base = await pg.evaluate((t) => { const c = __cuadros.filter((x) => x >= t); let m = 0; for (let i = 1; i < c.length; i++) m = Math.max(m, c[i] - c[i - 1]); return { max: m, n: c.length }; }, base0);
  for (const k of LENTES) {
    const { t0, hay } = await clicLente(pg, k);
    await esperar(2200);
    const r = await pg.evaluate((t0) => {
      const c = __cuadros.filter((x) => x >= t0 - 1); const iv = []; let prev = t0;
      for (const x of c) { iv.push(x - prev); prev = x; }
      const s = [...iv].sort((a, b) => a - b);
      return { max: Math.max(0, ...iv), p50: s[s.length >> 1] ?? 0, n: c.length, primero: c.length ? c[0] - t0 : null };
    }, t0);
    filas.push({ lente: k, boton: hay, cuadroMasLargoMs: r2(r.max, 1), medianaMs: r2(r.p50, 1), cuadros: r.n, primerCuadroMs: r2(r.primero, 1), estado: r.max > 250 ? 'FALLA' : 'PASA' });
  }
  return { reposoMaxMs: r2(base.max, 1), reposoCuadros: base.n, filas };
}
/** Tres veces, cada una en un navegador nuevo (perfil limpio, sin caché de sombreadores del anterior): el tiempo de
 *  compilación varía de una carga a otra, así que se informa el peor de las tres. La última vez usa la página A. */
async function comprobacion5(paginaA) {
  const vueltas = [];
  for (let v = 0; v < 2; v++) {
    const nav = await abrirNavegador();
    try { const P = await abrirPagina(nav, paginaA.url, `tirones ${v + 1}`); vueltas.push(await tironesUnaVez(P.pg)); await P.ctx.close(); }
    finally { await nav.close(); }
  }
  vueltas.push(await tironesUnaVez(paginaA.pg));
  // diagnóstico: cuánto de CPU cuesta la primera vez el diagrama de sombras (envolventes de la silueta del edificio), aparte
  // de compilar sombreadores; se borra la caché y se mide en frío, sin dibujar
  const diagramaMs = await paginaA.pg.evaluate(() => {
    const E = __e106.escena, S = __e106.S, out = {};
    E._silueta = null; E._diagClave = null; let t = performance.now(); E.setDiagrama(S.fecha); out.primeraVez = performance.now() - t;
    E._diagClave = null; t = performance.now(); E.setDiagrama({ ...S.fecha, d: S.fecha.d === 1 ? 2 : 1 }); out.otroDia = performance.now() - t;
    return out;
  });
  const filas = LENTES.map((k) => {
    const v = vueltas.map((x) => x.filas.find((f) => f.lente === k));
    const peor = Math.max(...v.map((f) => f.cuadroMasLargoMs));
    return { lente: k, cuadroMasLargoMs: peor, porVuelta: v.map((f) => f.cuadroMasLargoMs), medianaMs: v[v.length - 1].medianaMs, primerCuadroMs: v[v.length - 1].primerCuadroMs, estado: peor > 250 ? 'FALLA' : 'PASA' };
  });
  return { estado: filas.some((f) => f.estado === 'FALLA') ? 'FALLA' : 'PASA', umbral: 'cuadro de más de 250 ms en los 2,2 s siguientes al primer cambio a esa forma de ver; peor de 3 cargas en navegadores nuevos',
    reposoMaxMs: Math.max(...vueltas.map((x) => x.reposoMaxMs)), vueltas: vueltas.length,
    cpuDiagramaSombrasMs: { primeraVez: r2(diagramaMs.primeraVez, 1), otroDia: r2(diagramaMs.otroDia, 1) }, filas };
}

async function esperarQuieto(pg, extra = 1200, max = 6000) {
  const t = Date.now();
  while (Date.now() - t < max) { const v = await pg.evaluate(() => !!__e106.S.viaje); if (!v) break; await esperar(150); }
  await esperar(extra);
}
async function comprobacion4(pg) {
  const pasos = [];
  const hacer = async (nombre, fn) => {
    pasoActual = nombre;
    const antes = eventos.consola.length + eventos.pagina.length + eventos.peticiones.filter((p) => !p.externa).length;
    try { await fn(); } catch (e) { eventos.pagina.push({ paso: nombre, pagina: 'script', texto: 'el script no pudo hacer este paso: ' + e.message }); }
    const despues = eventos.consola.length + eventos.pagina.length + eventos.peticiones.filter((p) => !p.externa).length;
    pasos.push({ paso: nombre, errores: despues - antes });
  };
  const clic = (sel) => pg.evaluate((sel) => { const b = document.querySelector(sel); if (!b) throw new Error('no existe ' + sel); b.click(); }, sel);
  for (const k of LENTES) {
    await hacer(`lente ${k}`, async () => { await clicLente(pg, k); await esperar(1600); });
    const modos = await pg.evaluate(() => [...document.querySelectorAll('#ley-modos [data-modo]')].filter(() => !document.querySelector('#ley-modos').hidden).map((b) => b.dataset.modo));
    for (const mo of modos) await hacer(`lente ${k} · ${mo}`, async () => { await clic(`#ley-modos [data-modo="${mo}"]`); await esperar(1200); });
    if (k === 'partes') {
      const partes = await pg.evaluate(() => [...document.querySelectorAll('[data-parte]')].map((b) => b.dataset.parte));
      for (const p of partes) await hacer(`parte ${p}`, async () => { await clic(`[data-parte="${p}"]`); await esperar(500); });
      for (const m of ['persona', 'alturas']) await hacer(`partes · ${m}`, async () => { await clic(`#ley-parte [data-mostrar="${m}"]`); await esperar(500); });
    }
  }
  for (const v of ['esquina', 'aerea', 'planta']) await hacer(`vista ${v}`, async () => { await pg.evaluate((v) => { [...document.querySelectorAll(`.vistas [data-vista="${v}"]`)][0].click(); }, v); await esperar(2000); });
  for (const f of Object.keys(FACHADAS)) await hacer(`vista ${f}`, async () => { await clic(`[data-ir-fachada="${f}"]`); await esperar(2000); });
  await hacer('salir de la fachada', async () => { await clic('#salir-fachada'); await esperar(1800); });
  // recorrido guiado: los 11 pasos con «Siguiente» y «Terminar»
  await hacer('recorrido paso 1', async () => { await clic('#abrir-recorrido'); await esperarQuieto(pg, 1800); });
  const nPasos = await pg.evaluate(() => __e106.S.pasos?.length ?? 0);
  for (let i = 1; i < nPasos; i++) await hacer(`recorrido paso ${i + 1}`, async () => { await clic('#rec-sig'); await esperarQuieto(pg, i === 2 ? 3000 : 1800); });
  await hacer('recorrido terminar', async () => { await clic('#rec-sig'); await esperar(1500); });
  // «Ir a…»: cada consulta (días extremos de la serie)
  await hacer('abrir «Ir a…»', async () => { await clic('#abrir-ir'); await esperar(600); });
  const nC = await pg.evaluate(() => document.querySelectorAll('#consultas button.c-item').length);
  for (let i = 0; i < nC; i++) await hacer(`consulta ${i + 1}`, async () => { await pg.evaluate((i) => document.querySelectorAll('#consultas button.c-item')[i].click(), i); await esperarQuieto(pg, 1500); });
  // «Para qué sirve»: cada hallazgo con su momento
  const nH = await pg.evaluate(() => document.querySelectorAll('.hallazgo .ver').length);
  for (let i = 0; i < nH; i++) await hacer(`hallazgo ${i + 1}`, async () => { await pg.evaluate((i) => document.querySelectorAll('.hallazgo .ver')[i].click(), i); await esperarQuieto(pg, 1500); });
  await hacer('volver a Ahora', async () => { await clic('#ahora'); await esperarQuieto(pg, 2000); });
  const diag = await pg.evaluate(() => (window.__e106base?.DIAG?.log ?? []).map((x) => ({ ...x })));
  return { pasos, nPasosRecorrido: nPasos, nConsultas: nC, nHallazgos: nH, diagnosticoApp: diag };
}

// =====================================================================================================================
// Programa
// =====================================================================================================================
async function main() {
  const srv = await servidor();
  const base = `http://127.0.0.1:${srv.address().port}/index.html?prueba&rapido${FORZAR_GL ? '&webgl' : ''}${EXTRA_URL ? '&' + EXTRA_URL : ''}`;
  let navegador = null, geoCache = null;
  try {
    if (corre(1)) { informe.comprobaciones['1'] = { nombre: 'Posición del sol contra un algoritmo independiente', ...comprobacion1() }; }
    const necesitaNav = [1, 2, 3, 4, 5, 6, 7].some((n) => n !== 1 && corre(n)) || corre(1);
    if (!necesitaNav) return;
    navegador = await abrirNavegador();
    // página A: tirones (5) primero, con la página recién cargada; luego las medidas de imagen (2 y 3) y el gancho de (1)
    pasoActual = 'carga';
    const A = await abrirPagina(navegador, base, 'A');
    informe.navegador = { ...A.estado, sinVentana: !VISIBLE };
    console.log(`Página lista en ${(A.estado.cargaMs / 1000).toFixed(1)} s · ${A.estado.backend} · dpr ${A.estado.dpr} · nivel ${A.estado.nivel}`);
    if (corre(5)) { pasoActual = 'tirones'; informe.comprobaciones['5'] = { nombre: 'Tirones al cambiar de forma de ver', backend: A.estado.backend, ...(await comprobacion5({ pg: A.pg, url: base })) }; }
    if (corre(1)) { informe.comprobaciones['1'].paquete = await comprobacion1Gancho(A.pg); }
    if (corre(2)) {
      pasoActual = 'sombras de aleros';
      const geo = geoCache = await prepararGeometria();
      console.log(`Geometría: ${geo.triangulos.toLocaleString('es')} triángulos en ${(geo.ms / 1000).toFixed(1)} s`);
      informe.comprobaciones['2'] = { nombre: 'Sombra de los aleros contra la geometría', backend: A.estado.backend, ...(await comprobacion2(A.pg, geo)) };
    }
    if (corre(6)) {
      pasoActual = 'sombra en la lente Sol';
      const geo = geoCache ?? await prepararGeometria();
      informe.comprobaciones['6'] = { nombre: 'Sombra de los aleros en la lente Sol', backend: A.estado.backend, ...(await comprobacion6(A.pg, geo)) };
    }
    if (corre(7)) {
      pasoActual = 'sol alto bajo el alero';
      const geo = geoCache ?? (geoCache = await prepararGeometria());
      informe.comprobaciones['7'] = { nombre: 'Sol alto: bajo el alero no se cuela el sol', backend: A.estado.backend, ...(await comprobacion7(A.pg, geo)) };
    }
    if (corre(3)) { pasoActual = 'luces quemadas'; informe.comprobaciones['3'] = { nombre: 'Luces quemadas', backend: A.estado.backend, ...(await comprobacion3(A.pg)) }; }
    await A.ctx.close();
    // página B, limpia: recorrer todas las formas de ver, vistas, el recorrido guiado y las consultas
    if (corre(4)) {
      pasoActual = 'carga (página B)';
      const B = await abrirPagina(navegador, base, 'B');
      const r = await comprobacion4(B.pg);
      await B.ctx.close();
      const locales = eventos.peticiones.filter((p) => !p.externa), externas = eventos.peticiones.filter((p) => p.externa);
      const graves = eventos.consola.length + eventos.pagina.length + locales.length;
      informe.comprobaciones['4'] = { nombre: 'Errores y formas de ver', backend: B.estado.backend, estado: graves ? 'FALLA' : 'PASA',
        alcance: 'errores de consola, errores de página y peticiones fallidas durante TODA la corrida (páginas A y B); la página B recorre formas de ver, modos, partes, vistas, fachadas, recorrido guiado, consultas y hallazgos',
        erroresConsola: eventos.consola, erroresPagina: eventos.pagina, peticionesFallidasLocales: locales, peticionesFallidasExternas: externas,
        avisosConsola: eventos.avisos.slice(0, 60), nAvisos: eventos.avisos.length, ...r };
    }
  } finally {
    if (navegador) await navegador.close();
    srv.close();
  }
}

function resumen() {
  const C = informe.comprobaciones, L = [];
  const est = (e) => (e === 'PASA' ? 'PASA ' : e === 'FALLA' ? 'FALLA' : e);
  L.push('', `Edificio 106 · verificación · ${informe.navegador?.backend ?? '—'} · ${informe.ventana} · ${((Date.now() - t0Global) / 1000).toFixed(0)} s`, '');
  if (C['1']) { const c = C['1']; L.push(`[${est(c.estado)}] 1. Sol: ${c.muestras} muestras · máx |Δalt| ${c.maxDeltaAltitud}° · máx |Δaz| (alt < 85°) ${c.maxDeltaAzimut_bajo85}° · separación máx ${c.maxSeparacionAngular}° (umbral 0,1°)`);
    L.push(`         ${c.convencionHora}`); if (c.paquete) L.push(`         paquete js/app.js vs src/sol.js: ${c.paquete.casos} casos, diferencia máx ${c.paquete.maxDiferenciaFuenteVsPaquete}°`); }
  if (C['2']) { const c = C['2']; L.push(`[${est(c.estado)}] 2. Sombra de aleros (${c.backend}) · ${c.criterio}`);
    for (const k of c.casos) L.push(`         ${k.estado.padEnd(10)} ${k.fachada} ${k.momento} alt ${k.alt}° · nivel ${k.nivelAlero} · verdad ${k.profundidadVerdad} m · fórmula ${k.profundidadFormula} · app (sustituto) ${k.profundidadSombraApp} · medida ${k.profundidadMedida ?? '—'} · error ${k.errorCm ?? '—'} cm${k.motivo ? ' · ' + k.motivo : ''}`);
    for (const n of c.notas) L.push(`         nota: ${n}`); }
  if (C['6']) { const c = C['6']; L.push(`[${est(c.estado)}] 6. Sombra de aleros en la lente Sol (${c.backend}) · ${c.criterio}`);
    for (const k of c.casos) L.push(`         ${k.estado.padEnd(6)} ${k.fachada} ${k.momento} alt ${k.alt}° · nivel ${k.nivelAlero} · verdad ${k.profundidadVerdad} m · medida ${k.profundidadMedida ?? '—'} · error ${k.errorCm ?? '—'} cm · sombra vs «nada» ${k.difSombraNiveles} niveles · calidez al sol ${k.calidezSolNiveles}${k.motivo ? ' · ' + k.motivo : ''}`);
    for (const n of c.notas) L.push(`         nota: ${n}`); }
  if (C['7']) { const c = C['7']; L.push(`[${est(c.estado)}] 7. Sol alto bajo el alero (${c.backend}) · ${c.criterio}`);
    for (const k of c.casos) L.push(`         ${k.estado.padEnd(10)} ${k.fachada} ${k.momento} alt ${k.alt}° · nivel ${k.nivelAlero} · cociente máx en la franja ${k.cocienteMaxFranja} (a ${k.bajoElCantoCm} cm del canto) · umbral ${k.umbral} · suelo al sol ${k.cocienteSueloAlSol}`);
    for (const n of c.notas) L.push(`         nota: ${n}`); }
  if (C['3']) { const c = C['3']; L.push(`[${est(c.estado)}] 3. Luces quemadas (${c.backend}) · ${c.umbral}`);
    for (const f of c.filas) L.push(`         ${f.estado.padEnd(6)} ${f.momento.padEnd(34)} ${f.vista.padEnd(11)} ${String(f.pctQuemado).padStart(7)} % · canal máx ${String(f.canalMax).padStart(3)} · p99,9 ${String(f.canalP999).padStart(3)} · bloom ${f.aclaradoBloom >= 0 ? "+" : ""}${f.aclaradoBloom}`); }
  if (C['4']) { const c = C['4']; L.push(`[${est(c.estado)}] 4. Errores (${c.backend}): ${c.erroresConsola.length} de consola · ${c.erroresPagina.length} de página · ${c.peticionesFallidasLocales.length} peticiones locales fallidas · ${c.peticionesFallidasExternas.length} externas (no cuentan) · ${c.nAvisos} avisos · ${c.pasos.length} pasos (${c.nPasosRecorrido} del recorrido, ${c.nConsultas} consultas, ${c.nHallazgos} hallazgos)`);
    for (const e of [...c.erroresConsola, ...c.erroresPagina, ...c.peticionesFallidasLocales].slice(0, 15)) L.push(`         [${e.paso}] ${(e.texto ?? `${e.url} ${e.motivo}`).slice(0, 200)}`);
    const dg = c.diagnosticoApp.filter((x) => x.tipo !== 'aviso'); if (dg.length) L.push(`         diagnóstico de la app: ${dg.length} entradas graves`); }
  if (C['5']) { const c = C['5']; L.push(`[${est(c.estado)}] 5. Tirones (${c.backend}) · ${c.umbral} · en reposo ${c.reposoMaxMs} ms · CPU del diagrama de sombras: ${c.cpuDiagramaSombrasMs.primeraVez} ms la primera vez, ${c.cpuDiagramaSombrasMs.otroDia} ms otro día`);
    for (const f of c.filas) L.push(`         ${f.estado.padEnd(6)} ${f.lente.padEnd(8)} cuadro más largo ${String(f.cuadroMasLargoMs).padStart(6)} ms (vueltas: ${f.porVuelta.join(' · ')}) · mediana ${f.medianaMs} ms`); }
  L.push('', `Informe: ${path.relative(process.cwd(), path.join(SALIDA, 'informe.json'))} · capturas en ${path.relative(process.cwd(), SALIDA)}/`, '');
  return L.join('\n');
}

let codigo = 0;
try { await main(); }
catch (e) { informe.errorDelScript = String(e?.stack ?? e); console.error('El script no pudo terminar:', e); codigo = 2; }
informe.duracionS = Math.round((Date.now() - t0Global) / 1000);
informe.eventos = eventos;
fs.writeFileSync(path.join(SALIDA, 'informe.json'), JSON.stringify(informe, null, 2));
console.log(resumen());
if (!codigo && Object.values(informe.comprobaciones).some((c) => c.estado === 'FALLA')) codigo = 1;
process.exit(codigo);
