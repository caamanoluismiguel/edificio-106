// Guardia antes de publicar: demuestra que una rama no cambia nada más que lo que dice cambiar. Compara el sitio armado de
// esta carpeta (la raíz del repositorio, con lo que haya sin commitear) contra otra revisión (por defecto origin/main):
//   1. git: que la revisión esté contenida en esta rama (avance rápido) y qué archivos del sitio se borran o cambian
//   2. modelo: cada modelo/*.glb byte a byte y, si cambia, nodo a nodo y pieza a pieza (verificacion/entrada/comparar.mjs)
//   3. imagen: el mismo cuadro en las dos versiones, píxel a píxel, en ~20 casos (vistas, fachadas, lentes, noche, lluvia),
//      con el reloj de los sombreadores congelado (grano, vegetación, lluvia) y Math.random con semilla fija
// Uso:  cd fuente && node guardia.mjs [revisión] [--webgl] [--solo=git,modelo,imagen,carga] [--casos=esquina,lente-sol] [--url=dof=0]
//   4. carga: probar-carga.mjs, el sitio de esta carpeta como teléfono y como computador (todos los grupos deben llegar)
// Resultado en fuente/verificacion/guardia/ (ignorado por git): informe.json y, en cada caso que difiere, antes, después
// y un mapa de las diferencias. Código de salida: 0 si no cambia nada, 1 si algo cambia, 2 si el script no pudo correr.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const ARGS = process.argv.slice(2);
const REV = ARGS.find((a) => !a.startsWith('--')) ?? 'origin/main';
const GL = ARGS.includes('--webgl');
const SOLO = (ARGS.find((a) => a.startsWith('--solo=')) ?? '--solo=git,modelo,imagen,carga').slice(7).split(',');
const FILTRO = (ARGS.find((a) => a.startsWith('--casos=')) ?? '').slice(8).split(',').filter(Boolean);
// --url=dof=0: parámetros extra en la URL de las dos versiones (p. ej. apagar un efecto nuevo para probar que, sin él, todo queda igual)
const EXTRA = (ARGS.find((a) => a.startsWith('--url=')) ?? '').slice(6);
const SALIDA = path.join(AQUI, 'verificacion', 'guardia', GL ? 'webgl' : 'webgpu');
const ANCHO = 1600, ALTO = 1000;
// umbrales de la imagen: un píxel «cambia» si algún canal se mueve más de UMBRAL niveles (0–255); un caso falla si cambian
// más de MAX_PX píxeles. Calibrado 2026-09-30: main contra main da 0 px en WebGPU (máx 2 niveles) y ≤ 3 px en WebGL (un
// borde, máx 13 niveles); una baranda movida 5 cm (verificacion/guardia/sabotaje.mjs) da de 25 px (planta) a 3.200 px
const UMBRAL = 8, MAX_PX = 10;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const git = (...a) => execFileSync('git', ['-C', RAIZ, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
fs.rmSync(SALIDA, { recursive: true, force: true }); fs.mkdirSync(SALIDA, { recursive: true });
const informe = { fecha: new Date().toISOString(), revision: REV, commitRevision: git('rev-parse', '--short', REV), rama: git('rev-parse', '--abbrev-ref', 'HEAD'),
  commitRama: git('rev-parse', '--short', 'HEAD'), sinCommitear: git('status', '--porcelain', '--untracked-files=no', '--', '.', ':!fuente').split('\n').filter(Boolean), backend: GL ? 'WebGL 2' : 'WebGPU' };
let falla = false;
const titulo = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 70 - t.length))}`);

// ---------------- 1. git ----------------
if (SOLO.includes('git')) {
  titulo(`1. git: ${informe.rama} (${informe.commitRama}) contra ${REV} (${informe.commitRevision})`);
  let contenida = true; try { execFileSync('git', ['-C', RAIZ, 'merge-base', '--is-ancestor', REV, 'HEAD']); } catch { contenida = false; }
  // archivos del sitio (todo menos fuente/) que difieren entre la revisión y lo que hay en la carpeta, commiteado o no
  const cambios = git('diff', '--name-status', REV, '--', '.', ':!fuente').split('\n').filter(Boolean).map((l) => { const [e, ...r] = l.split('\t'); return { estado: e, archivo: r.join(' → ') }; });
  const fuente = git('diff', '--name-status', REV, '--', 'fuente').split('\n').filter(Boolean).map((l) => { const [e, ...r] = l.split('\t'); return { estado: e, archivo: r.join(' → ') }; });
  const borrados = [...cambios, ...fuente].filter((c) => c.estado === 'D');
  informe.git = { contenida, cambiosSitio: cambios, cambiosFuente: fuente, borrados };
  console.log(contenida ? `✓ ${REV} está contenida en la rama (avance rápido: no se pisa nada)` : `✗ ${REV} NO está contenida en la rama: hay commits en ${REV} que la rama no tiene. Rebase y recompilar js/app.js antes de publicar`);
  console.log(borrados.length ? `✗ se borran ${borrados.length} archivos: ${borrados.map((b) => b.archivo).join(', ')}` : '✓ no se borra ningún archivo');
  console.log(`  sitio: ${cambios.length ? cambios.map((c) => `${c.estado} ${c.archivo}`).join(' · ') : 'sin cambios'}`);
  console.log(`  fuente: ${fuente.length ? fuente.map((c) => `${c.estado} ${c.archivo}`).join(' · ') : 'sin cambios'}`);
  if (informe.sinCommitear.length) console.log(`  (sin commitear: ${informe.sinCommitear.join(' · ')})`);
  if (!contenida || borrados.length) falla = true;
}

// ---------------- 2. modelo ----------------
if (SOLO.includes('modelo')) {
  titulo('2. modelo: modelo/*.glb');
  const r = spawnSync(process.execPath, [path.join(AQUI, 'verificacion/entrada/comparar.mjs'), REV], { cwd: AQUI, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) { console.log(r.stdout, r.stderr); console.log('✗ no se pudo comparar el modelo'); process.exit(2); }
  const lineas = r.stdout.trim().split('\n');
  const cambian = lineas.filter((l) => /^\S.*(CAMBIA|BORRADO|NUEVO)/.test(l));
  informe.modelo = { cambian: cambian.map((l) => l.trim()), detalle: lineas };
  for (const l of lineas) if (/^\S/.test(l) || /^\s+[~+−]/.test(l) || /^\s+(antes|ahora)/.test(l)) console.log(l.startsWith(' ') ? l : (/(CAMBIA|BORRADO|NUEVO)/.test(l) ? '✗ ' : '✓ ') + l);
  if (cambian.length) falla = true;
}

// ---------------- 3. imagen ----------------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gz': 'application/gzip',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
function servidor(raiz) {
  const srv = http.createServer((q, r) => {
    let p; try { p = path.normalize(path.join(raiz, decodeURIComponent(new URL(q.url, 'http://x').pathname))); } catch { r.writeHead(400); return r.end(); }
    if (!p.startsWith(raiz)) { r.writeHead(403); return r.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': TIPOS[path.extname(p).toLowerCase()] ?? 'application/octet-stream' });   // los .bin.gz sin Content-Encoding (la app los descomprime)
    fs.createReadStream(p).pipe(r);
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}
/** Copia del sitio armado en la revisión (sin fuente/), en una carpeta temporal. */
function exportar(rev) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e106-guardia-'));
  const raiz = git('ls-tree', '--name-only', rev).split('\n').filter((x) => x && x !== 'fuente');
  const tar = spawnSync('sh', ['-c', `git -C "${RAIZ}" archive "${rev}" ${raiz.map((x) => `'${x}'`).join(' ')} | tar -x -C "${dir}"`]);
  if (tar.status !== 0) throw new Error('git archive: ' + tar.stderr);
  return dir;
}
const MOM = {
  manana: { y: 2024, m: 1, d: 15, min: 7 * 60 + 30 },     // el hallazgo del alero: sol bajo en la SE
  mediodia: { y: 2024, m: 3, d: 21, min: 12 * 60 + 15 },
  tarde: { y: 2024, m: 7, d: 26, min: 16 * 60 + 45 },
  noche: { y: 2024, m: 1, d: 15, min: 21 * 60 },
};
const caso = (id, mom, extra) => ({ id, fecha: { y: MOM[mom].y, m: MOM[mom].m, d: MOM[mom].d }, min: MOM[mom].min, lente: 'foto', ...extra });
const CASOS = [
  caso('esquina-manana', 'manana', { vista: 'esquina' }), caso('esquina-tarde', 'tarde', { vista: 'esquina' }),
  caso('aerea-manana', 'manana', { vista: 'aerea' }), caso('aerea-mediodia', 'mediodia', { vista: 'aerea' }),
  caso('planta-mediodia', 'mediodia', { vista: 'planta' }), caso('planta-tarde', 'tarde', { vista: 'planta' }),
  caso('fachada-se', 'manana', { fachada: 'se' }), caso('fachada-no', 'tarde', { fachada: 'no' }),
  caso('fachada-ne', 'manana', { fachada: 'ne' }), caso('fachada-so', 'tarde', { fachada: 'so' }),
  caso('noche-esquina', 'noche', { vista: 'esquina' }), caso('noche-aerea', 'noche', { vista: 'aerea' }),
  caso('lente-sol', 'manana', { vista: 'esquina', lente: 'sol' }), caso('lente-lluvia', 'mediodia', { vista: 'esquina', lente: 'lluvia' }),
  caso('lente-viento', 'mediodia', { vista: 'aerea', lente: 'viento' }), caso('lente-sombras', 'mediodia', { vista: 'aerea', lente: 'sombras' }),
  caso('lente-partes', 'manana', { vista: 'esquina', lente: 'partes' }),
  { id: 'lluvia-esquina', lluvia: true, lente: 'foto', vista: 'esquina' },   // la hora de más lluvia de 2023 (se busca en la serie)
].filter((c) => !FILTRO.length || FILTRO.some((f) => c.id.includes(f)));

async function abrir(nav, url) {
  const ctx = await nav.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 1, timezoneId: 'America/Panama', locale: 'es-PA', reducedMotion: 'no-preference' });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('e106-visto', '1'); localStorage.setItem('e106-nitidez', '1'); localStorage.removeItem('e106-motor'); } catch (e) { /* nada */ }
    let s = 106; Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let actual; Object.defineProperty(window, '__e106', { configurable: true, get: () => actual, set: (v) => { if (actual && !window.__e106base) window.__e106base = actual; if (!actual && v && !v.viajarA) window.__e106base = v; actual = v; } });
  });
  const pg = await ctx.newPage(), errores = [];
  pg.on('pageerror', (e) => errores.push(String(e).slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 300)); });
  await pg.goto(url, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__e106?.escena?.cargado && window.__e106base && !window.__e106base.intro && document.documentElement.classList.contains('listo')
    && !document.documentElement.classList.contains('en-intro') && window.__e106.clima?.horario, null, { timeout: 180000, polling: 250 });
  await esperar(2500);
  return { ctx, pg, errores };
}
async function buscarLluvia(pg) {
  return pg.evaluate(() => { let mejor = null;
    for (let dia = 0; dia < 365; dia++) { const d = new Date(Date.UTC(2023, 0, 1 + dia)), f = { y: 2023, m: d.getUTCMonth() + 1, d: d.getUTCDate() };
      for (let h = 9; h <= 15; h++) { const r = __e106.clima.registro(f, h * 60 + 30); if (r && (!mejor || r.lluvia > mejor.lluvia)) mejor = { fecha: f, min: h * 60 + 30, lluvia: r.lluvia }; } }
    return mejor; });
}
/** Lleva la app al caso, espera a que se asiente y dibuja UN cuadro con el reloj congelado. Devuelve el PNG. */
async function capturar(pg, c, pose = null) {
  await pg.evaluate((c) => { __e106.S.pausa = false; __e106.viajarA({ fecha: c.fecha, min: c.min, lente: c.lente, vista: c.vista, fachada: c.fachada, inmediato: true }); }, c);
  await esperar(3000);
  return pg.evaluate((pose) => {
    // tiempo de los sombreadores = 0 en este cuadro: con el bucle de animación de three activo, render() no avanza el cuadro
    // de nodos (los uniformes de tipo FRAME, como `time`, guardarían el valor del último cuadro), así que se avanza aquí
    const E = __e106.escena, nf = E.renderer._nodes.nodeFrame, pn = performance.now, t0 = nf.time, cam = E.camera; __e106.S.pausa = true;
    // la misma cámara exacta en las dos versiones: el amortiguado de la órbita no llega al mismo punto al bit en cada carga,
    // y medio píxel de diferencia cambia los bordes finos (setos, barandas). La segunda versión copia la pose de la primera
    if (pose) { cam.position.fromArray(pose.p); cam.quaternion.fromArray(pose.q); cam.fov = pose.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); }
    // también en t = 0: el mapa de sombras (las hojas que se mecen se sombrean a sí mismas) y el mapa de entorno, que se toma
    // del cielo y el cielo tiene nubes que se mueven: se regenera al final de un primer cuadro y el segundo es el que se compara
    const congelar = () => { nf.time = 0; nf.lastTime = undefined; nf.update(); E.sun.shadow.needsUpdate = true; };
    performance.now = () => 1e6;
    try { congelar(); E._envT = 0; E._envPend = true; E.render(); congelar(); E.render(); }
    finally { performance.now = pn; nf.time = t0; nf.lastTime = pn.call(performance); E._envT = pn.call(performance); }
    return { url: E.renderer.domElement.toDataURL('image/png'), pose: { p: cam.position.toArray(), q: cam.quaternion.toArray(), fov: cam.fov } };
  }, pose).then((r) => ({ png: Buffer.from(r.url.split(',')[1], 'base64'), pose: r.pose }));
}
async function comparar(a, b) {
  const [A, B] = await Promise.all([sharp(a).raw().ensureAlpha().toBuffer({ resolveWithObject: true }), sharp(b).raw().ensureAlpha().toBuffer({ resolveWithObject: true })]);
  const { width: w, height: h } = A.info;
  if (w !== B.info.width || h !== B.info.height) return { distintoTamano: true, px: w * h, mapa: null };
  const mapa = Buffer.alloc(w * h * 4); let px = 0, max = 0, x0 = w, y0 = h, x1 = -1, y1 = -1, suma = 0;
  for (let i = 0, p = 0; p < w * h; p++, i += 4) {
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
    suma += d; if (d > max) max = d;
    const g = Math.round((A.data[i] + A.data[i + 1] + A.data[i + 2]) / 9);          // fondo: la imagen de antes, gris y oscura
    if (d > UMBRAL) { px++; const x = p % w, y = (p / w) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); mapa[i] = 255; mapa[i + 1] = Math.max(0, 200 - d * 2); mapa[i + 2] = 0; }
    else { mapa[i] = mapa[i + 1] = mapa[i + 2] = g; }
    mapa[i + 3] = 255;
  }
  return { px, pct: +(100 * px / (w * h)).toFixed(4), maxNivel: max, mediaNivel: +(suma / (w * h)).toFixed(3), caja: px ? [x0, y0, x1, y1] : null,
    mapa: px ? await sharp(mapa, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer() : null };
}

if (SOLO.includes('imagen')) {
  titulo(`3. imagen: ${CASOS.length} casos, ${informe.backend}, ${ANCHO}×${ALTO}${EXTRA ? ` · URL con &${EXTRA}` : ''}`);
  const viejo = exportar(REV);
  const [sA, sB] = await Promise.all([servidor(viejo), servidor(RAIZ)]);
  const q = `index.html?prueba&rapido${GL ? '&webgl' : ''}${EXTRA ? '&' + EXTRA : ''}`;
  const nav = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const filas = [];
  try {
    // cada versión en su propia página; los casos se alternan (A, B, A, B…) para que el calor de la máquina no favorezca a una
    const A = await abrir(nav, `http://127.0.0.1:${sA.address().port}/${q}`), B = await abrir(nav, `http://127.0.0.1:${sB.address().port}/${q}`);
    const ll = CASOS.some((c) => c.lluvia) ? await buscarLluvia(A.pg) : null;
    for (const c0 of CASOS) {
      const c = c0.lluvia ? { ...c0, fecha: ll.fecha, min: ll.min } : c0;
      const { png: a, pose } = await capturar(A.pg, c), { png: b } = await capturar(B.pg, c, pose);
      const r = await comparar(a, b);
      const ok = !r.distintoTamano && r.px <= MAX_PX;
      if (!ok) {
        falla = true;
        fs.writeFileSync(path.join(SALIDA, `${c.id}-antes.png`), a); fs.writeFileSync(path.join(SALIDA, `${c.id}-despues.png`), b);
        if (r.mapa) fs.writeFileSync(path.join(SALIDA, `${c.id}-diferencias.png`), r.mapa);
      }
      const { mapa, ...dato } = r;
      filas.push({ caso: c.id, estado: ok ? (r.px ? 'TOLERANCIA' : 'IGUAL') : 'CAMBIA', ...dato });
      console.log(`${ok ? (r.px ? '≈' : '✓') : '✗'} ${c.id.padEnd(16)} ${ok ? (r.px ? 'igual dentro de la tolerancia' : 'igual') : 'CAMBIA'}  ${r.distintoTamano ? 'tamaño distinto' : `${r.px} px sobre ${UMBRAL} niveles (${r.pct} %) · máx ${r.maxNivel} · media ${r.mediaNivel}${r.caja ? ` · caja ${r.caja.join(',')}` : ''}`}`);
    }
    informe.imagen = { umbralNiveles: UMBRAL, maxPixeles: MAX_PX, lluvia: ll, erroresAntes: A.errores, erroresDespues: B.errores, casos: filas };
    if (A.errores.length || B.errores.length) console.log(`  errores de consola · antes: ${A.errores.length} · después: ${B.errores.length}`, B.errores.slice(0, 3));
    if (B.errores.length > A.errores.length) falla = true;
  } finally { await nav.close(); sA.close(); sB.close(); fs.rmSync(viejo, { recursive: true, force: true }); }
}

// ---------------- 4. carga ----------------
// las imágenes son de computador: probar-carga.mjs abre también el perfil de teléfono (grupos diferidos, modelos livianos) y
// exige que lleguen todos los grupos. No es una comparación con main: si algo no carga, falla aunque main tampoco cargue.
let cargaMal = false;
if (SOLO.includes('carga')) {
  titulo('4. carga: teléfono y computador, con y sin ?arboles=0');
  const r = spawnSync(process.execPath, [path.join(AQUI, 'probar-carga.mjs')], { cwd: AQUI, encoding: 'utf8', maxBuffer: 1 << 24 });
  process.stdout.write(r.stdout); if (r.stderr) process.stdout.write(r.stderr);
  informe.carga = { ok: r.status === 0, salida: r.stdout };
  if (r.status !== 0) { cargaMal = true; falla = true; }
}

fs.writeFileSync(path.join(SALIDA, 'informe.json'), JSON.stringify(informe, null, 1));
titulo(cargaMal ? 'RESULTADO: ALGO NO CARGA (no publicar)' : falla ? 'RESULTADO: HAY CAMBIOS (revisar antes de publicar)' : 'RESULTADO: ni el modelo ni la imagen cambian');
console.log(`Informe: ${path.relative(AQUI, SALIDA)}/informe.json`);
process.exit(falla ? 1 : 0);
