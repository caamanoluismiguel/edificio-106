// Hojas de comparación de la noche: captura el sitio de main (7b72ba4, en verificacion/noche/actual/) y el de esta rama
// (la raíz del repositorio) en las mismas escenas, mide L* y saturación por zonas y arma JPG lado a lado.
// Uso: cd fuente && node verificacion/noche/hojas.mjs [--solo=e1,e2] [--sin-actual] [--webgl] [--visible]
// Antes: armar el sitio de la rama (js/app.js) y preparar actual/ (ver preparar-actual.sh).
// Salida: verificacion/noche/cap/*.jpg (cada captura), verificacion/noche/hoja-*.jpg y medidas.json.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { posicionSol, vectorSol } from '../../src/sol.js';
import { posicionLuna } from '../../src/luna.js';
import { cargarTriangulos, Rayos } from '../../verificar-geometria.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../..');
const CAP = path.join(AQUI, 'cap'); fs.mkdirSync(CAP, { recursive: true });
const ARGS = process.argv.slice(2);
const SOLO = (ARGS.find((a) => a.startsWith('--solo=')) ?? '').slice(7).split(',').filter(Boolean);
const ANCHO = 1440, ALTO = 900;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

// minuto del día en que el sol pasa por cierta altura al atardecer
function minutoSol(f, alt) { for (let m = 17 * 60; m < 21 * 60; m += 0.25) if (posicionSol({ ...f, h: 0, min: m }).alt <= alt) return m; return null; }
const F1 = { y: 2026, m: 9, d: 26 };
const ESCENAS = {
  e1: { t: '26 sep 2026 · 21:30 · esquina · 98 % nubes, luna llena', fecha: F1, min: 21 * 60 + 30, vista: 'esquina', rotulo: true },
  e2: { t: '22 feb 2024 · 21:30 · esquina · despejado, luna llena alta', fecha: { y: 2024, m: 2, d: 22 }, min: 21 * 60 + 30, vista: 'esquina' },
  e3: { t: '14 feb 2007 · 20:30 · esquina · despejado, sin luna', fecha: { y: 2007, m: 2, d: 14 }, min: 20 * 60 + 30, vista: 'esquina' },
  e4: { t: '26 sep 2026 · 21:30 · fachada sureste (QR y calle)', fecha: F1, min: 21 * 60 + 30, fachada: 'se' },
  e5: { t: '22 feb 2024 · 21:30 · vista aérea · despejado, luna llena', fecha: { y: 2024, m: 2, d: 22 }, min: 21 * 60 + 30, vista: 'aerea' },
  e6: { t: '24 jul 2021 · 21:30 · esquina · lluvia de 13,6 mm/h', fecha: { y: 2021, m: 7, d: 24 }, min: 21 * 60 + 30, vista: 'esquina' },
  c3: { t: 'Sol a −3°', fecha: F1, min: minutoSol(F1, -3), vista: 'esquina' },
  c8: { t: 'Sol a −8°', fecha: F1, min: minutoSol(F1, -8), vista: 'esquina' },
  c15: { t: 'Sol a −15°', fecha: F1, min: minutoSol(F1, -15), vista: 'esquina' },
  // variantes de la nueva (solo en la rama)
  e1sodio: { t: 'Nueva · poste de sodio 2100 K', base: 'e1', prep: (E) => E.setLampara('sodio'), soloNueva: true },
  e1larga: { t: 'Nueva · Exposición larga', base: 'e1', prep: () => document.querySelector('#capa-larga').click(), soloNueva: true, rotulo: true },
  e1maqueta: { t: 'Nueva · Maqueta aclarada', base: 'e1', prep: () => document.querySelector('#capa-maqueta').click(), soloNueva: true, rotulo: true },
};
for (const e of Object.values(ESCENAS)) if (e.base) Object.assign(e, { ...ESCENAS[e.base], ...e, t: e.t });

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
  pg.on('console', (m) => { if (m.type() === 'error') console.log('  [consola]', m.text().slice(0, 200)); });
  await pg.goto(url, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__e106?.escena?.cargado && window.__e106base && !window.__e106base.intro && document.documentElement.classList.contains('listo')
    && !document.documentElement.classList.contains('en-intro') && window.__e106.clima?.horario, null, { timeout: 180000, polling: 250 });
  await esperar(1500);
  return { pg, ctx };
}

// ---------------- medición ----------------
const lin = (u) => { u /= 255; return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
const LIN = Float64Array.from({ length: 256 }, (_, i) => lin(i));
const Lstar = (Y) => (Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y);
let GEO = null;
async function geometria() {
  if (GEO) return GEO;
  const G = ['arquitectura', 'cubiertas', 'detalles', 'entrada', 'ventanas', 'sitio', 'vegetacion', 'contexto'];
  const m = await cargarTriangulos(RAIZ, G);
  GEO = { m, G, rayos: new Rayos(m) };
  return GEO;
}
function clase(g, i, n) {
  const nm = g.m.nombres[g.m.mat[i]].toLowerCase(), gr = g.G[g.m.grupo[i]];
  if (/glass/.test(nm)) return gr === 'contexto' ? 'otro' : 'vidrio';
  if (gr === 'contexto') return 'otro';
  if (/plaster/.test(nm) && !/interior/.test(nm) && Math.abs(n[1]) < 0.3) return 'muro';
  if (/terracotta|clay/.test(nm)) return 'teja';
  if (/grass|turf/.test(nm)) return 'pasto';
  return 'otro';
}
const mediana = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };
async function medir(pg, esc, png) {
  const g = await geometria();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const paso = 10, cols = Math.floor(ANCHO / paso), filas = Math.floor(ALTO / paso);
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
  // luna (misma cuenta que la app) para saber qué muro la recibe
  const L = posicionLuna({ ...esc.fecha, h: 0, min: esc.min }), lv = vectorSol(L.alt, L.az), luna = [lv.x, lv.y, lv.z];
  const Z = { muroSombra: [], muroLuna: [], cieloHor: [], cieloAlto: [], vidrio: [], teja: [], pasto: [] }, S = { muroSombra: [], muroLuna: [], vidrio: [], teja: [], pasto: [] };
  let elevMax = -90;
  const sx = info.width / ANCHO, sy = info.height / ALTO;
  const muestra = (x, y) => { // promedio 3×3 en lineal
    let r = 0, gg = 0, b = 0, k = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const o = (Math.round(y * sy + dy) * info.width + Math.round(x * sx + dx)) * 4; r += LIN[data[o]]; gg += LIN[data[o + 1]]; b += LIN[data[o + 2]]; k++; }
    r /= k; gg /= k; b /= k;
    const Y = 0.2126 * r + 0.7152 * gg + 0.0722 * b, sr = [r, gg, b].map((u) => (u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055));
    const mx = Math.max(...sr), mn = Math.min(...sr);
    return { L: Lstar(Y), s: mx > 0.02 ? (mx - mn) / mx : 0 };
  };
  const cielo = [];
  for (const [x, y, dx, dy, dz] of rays.d) {
    const h = g.rayos.lanzar(rays.o, [dx, dy, dz], 3000);
    const px = muestra(x, y);
    if (!h) { const el = Math.asin(dy) * 180 / Math.PI; if (el > 0) cielo.push([el, px.L]); elevMax = Math.max(elevMax, el); continue; }
    const c = clase(g, h.i, h.n);
    const p = rays.o.map((o, k) => o + [dx, dy, dz][k] * h.t);
    if (c === 'muro') {
      // la cara que ve la cámara (el modelo puede traer la normal al revés)
      const n = h.n[0] * dx + h.n[1] * dy + h.n[2] * dz > 0 ? h.n.map((u) => -u) : h.n;
      const alLuna = L.alt > 0 && n[0] * luna[0] + n[1] * luna[1] + n[2] * luna[2] > 0.15 && !g.rayos.lanzar(p.map((u, k) => u + n[k] * 0.02), luna, 400);
      (alLuna ? Z.muroLuna : Z.muroSombra).push(px.L); (alLuna ? S.muroLuna : S.muroSombra).push(px.s);
    } else if (c === 'vidrio') { Z.vidrio.push(px.L); S.vidrio.push([px.L, px.s]); }
    else if (c === 'teja' || c === 'pasto') { Z[c].push(px.L); S[c].push(px.s); }
  }
  for (const [el, l] of cielo) (el < 8 ? Z.cieloHor : el > elevMax - 6 ? Z.cieloAlto : []).push(l);
  // ventanas encendidas: el cuartil alto del vidrio (~65 % de las celdas encendidas, más marcos y reflejos)
  const vL = pct(Z.vidrio, 0.8), vS = mediana(S.vidrio.filter(([l]) => l >= pct(Z.vidrio, 0.7)).map(([, s]) => s));
  const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
  return {
    luna: { alt: r1(L.alt), az: r1(L.az), frac: r2(L.frac) }, n: Object.fromEntries(Object.entries(Z).map(([k, v]) => [k, v.length])),
    L: { muroSombra: r1(mediana(Z.muroSombra)), muroLuna: r1(mediana(Z.muroLuna)), cieloHorizonte: r1(mediana(Z.cieloHor)), cieloAlto: r1(mediana(Z.cieloAlto)), ventanas: r1(vL), teja: r1(mediana(Z.teja)), pasto: r1(mediana(Z.pasto)) },
    sat: { muroSombra: r2(mediana(S.muroSombra)), muroLuna: r2(mediana(S.muroLuna)), ventanas: r2(vS), teja: r2(mediana(S.teja)), pasto: r2(mediana(S.pasto)) },
    elevCieloAlto: r1(elevMax),
  };
}

// ---------------- captura ----------------
async function capturar(pg, clave, esc, sitio) {
  await pg.evaluate((d) => { __e106.S.pausa = false; __e106.viajarA({ ...d, inmediato: true }); }, { fecha: esc.fecha, min: esc.min, vista: esc.vista ?? null, fachada: esc.fachada ?? null });
  await esperar(1200);
  if (esc.prep && sitio === 'nueva') await pg.evaluate((f) => { (0, eval)(`(${f})`)(__e106.escena); }, esc.prep.toString());
  await esperar(2600);
  const info = await pg.evaluate(() => { const c = __e106.escena; return { alt: c.alt, exp: c.renderer.toneMappingExposure, luz: c.sun.intensity }; });
  // cuadro sin interfaz para medir
  const url = await pg.evaluate(() => { const E = __e106.escena; __e106.S.pausa = true; E.render(); return E.renderer.domElement.toDataURL('image/png'); });
  const png = Buffer.from(url.split(',')[1], 'base64');
  // interfaz: sin la leyenda; el rótulo solo donde se pide
  await pg.addStyleTag({ content: `#leyenda{display:none!important} ${esc.rotulo ? '' : '#rotulo{display:none!important}'}` }).catch(() => {});
  await pg.evaluate(() => { const E = __e106.escena; E.render(); });
  await esperar(250);
  const jpg = path.join(CAP, `${sitio}_${clave}.jpg`);
  await pg.screenshot({ path: jpg, type: 'jpeg', quality: 90 });
  await pg.evaluate(() => { document.querySelectorAll('style').forEach((s) => { if (/#leyenda\{display:none/.test(s.textContent)) s.remove(); }); });
  if (esc.prep && sitio === 'nueva') await pg.evaluate(() => { const E = __e106.escena; E.setLampara?.('led'); for (const id of ['#capa-larga', '#capa-maqueta']) { const b = document.querySelector(id); if (b?.checked) b.click(); } });
  const m = await medir(pg, esc, png);
  return { jpg, ...info, medida: m };
}

// ---------------- hojas ----------------
const esc_ = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function hoja(nombre, titulo, cols, filas = null) {
  // cols: [{rotulo, jpg}] en una fila, o filas: [[...], [...]]
  const F = filas ?? [cols], W = ANCHO, H = ALTO, cab = 64, sub = titulo ? 70 : 0;
  const nc = Math.max(...F.map((f) => f.length)), ancho = nc * W + (nc - 1) * 12, alto = sub + F.length * (cab + H) + (F.length - 1) * 12;
  const capas = [];
  if (titulo) capas.push({ input: Buffer.from(`<svg width="${ancho}" height="${sub}"><rect width="100%" height="100%" fill="#111"/><text x="24" y="46" font-family="Helvetica" font-size="32" fill="#eee">${esc_(titulo)}</text></svg>`), top: 0, left: 0 });
  F.forEach((fila, j) => fila.forEach((c, i) => {
    const top = sub + j * (cab + H + 12), left = i * (W + 12);
    capas.push({ input: Buffer.from(`<svg width="${W}" height="${cab}"><rect width="100%" height="100%" fill="#1b1b1b"/><text x="20" y="42" font-family="Helvetica" font-weight="bold" font-size="30" fill="#f2c14e">${esc_(c.rotulo)}</text></svg>`), top, left });
    capas.push({ input: c.jpg, top: top + cab, left });
  }));
  const out = path.join(AQUI, `hoja-${nombre}.jpg`);
  await sharp({ create: { width: ancho, height: alto, channels: 3, background: '#111' } }).composite(capas).jpeg({ quality: 86 }).toFile(out);
  return out;
}

// ---------------- principal ----------------
const srv = await servidor(), base = `http://127.0.0.1:${srv.address().port}`;
const nav = await chromium.launch({ headless: !ARGS.includes('--visible'), args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const q = '?prueba&rapido' + (ARGS.includes('--webgl') ? '&webgl' : '');
const archivoMedidas = path.join(AQUI, 'medidas.json');
const medidas = fs.existsSync(archivoMedidas) ? JSON.parse(fs.readFileSync(archivoMedidas, 'utf8')) : {};
const claves = Object.keys(ESCENAS).filter((k) => !SOLO.length || SOLO.includes(k));
try {
  for (const sitio of ['nueva', ...(ARGS.includes('--sin-actual') ? [] : ['actual'])]) {
    const lista = claves.filter((k) => sitio === 'nueva' || !ESCENAS[k].soloNueva);
    if (!lista.length) continue;
    const { pg, ctx } = await abrir(nav, `${base}/${sitio === 'actual' ? 'fuente/verificacion/noche/actual/' : ''}index.html${q}`);
    for (const k of lista) {
      const r = await capturar(pg, k, ESCENAS[k], sitio);
      medidas[`${sitio}_${k}`] = { escena: ESCENAS[k].t, ...r, jpg: path.relative(AQUI, r.jpg) };
      console.log(sitio, k, JSON.stringify(r.medida.L), JSON.stringify(r.medida.sat), 'exp', r.exp?.toFixed(2), 'luz', r.luz?.toFixed(3));
    }
    await ctx.close();
  }
} finally { await nav.close(); srv.close(); fs.writeFileSync(archivoMedidas, JSON.stringify(medidas, null, 1)); }

// hojas con lo que haya
const J = (s, k) => path.join(CAP, `${s}_${k}.jpg`), hay = (s, k) => fs.existsSync(J(s, k));
const hechas = [];
for (const k of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6']) if (hay('actual', k) && hay('nueva', k)) hechas.push(await hoja(k, ESCENAS[k].t, [{ rotulo: 'Actual (main)', jpg: J('actual', k) }, { rotulo: 'Nueva', jpg: J('nueva', k) }]));
if (['c3', 'c8', 'c15'].every((k) => hay('nueva', k))) {
  const filas = [['c3', 'c8', 'c15'].map((k) => ({ rotulo: 'Nueva · ' + ESCENAS[k].t, jpg: J('nueva', k) }))];
  if (['c3', 'c8', 'c15'].every((k) => hay('actual', k))) filas.unshift(['c3', 'c8', 'c15'].map((k) => ({ rotulo: 'Actual · ' + ESCENAS[k].t, jpg: J('actual', k) })));
  hechas.push(await hoja('crepusculo', '26 sep 2026 · crepúsculo en la esquina', null, filas));
}
if (hay('nueva', 'e1') && hay('nueva', 'e1sodio')) hechas.push(await hoja('lamparas', ESCENAS.e1.t, [{ rotulo: 'Nueva · poste LED 4000 K', jpg: J('nueva', 'e1') }, { rotulo: 'Nueva · poste de sodio 2100 K', jpg: J('nueva', 'e1sodio') }]));
if (['e1', 'e1larga', 'e1maqueta'].every((k) => hay('nueva', k))) hechas.push(await hoja('modos', ESCENAS.e1.t, [{ rotulo: 'Nueva', jpg: J('nueva', 'e1') }, { rotulo: 'Exposición larga', jpg: J('nueva', 'e1larga') }, { rotulo: 'Maqueta aclarada', jpg: J('nueva', 'e1maqueta') }]));
console.log(hechas.join('\n'));
