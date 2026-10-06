// Rendimiento, carga y descarga de esta rama contra otra revisión (por defecto origin/main), con la ciudad encendida por defecto.
// De a una corrida: nunca dos pruebas de rendimiento en paralelo.
//   cd fuente && node medir-motor.mjs [revisión] [--webgl] [--movil] [--noche] [--url=ciudad=0]   (--noche: a las 21:00 en vez de las 9:30)
// Por versión (la revisión exportada con git archive y esta carpeta), en el mismo navegador y por turnos:
//   · carga: primer pintado (first-contentful-paint), 106 completo (los seis grupos del edificio), modelo completo (cargaCompleta)
//     y ciudad montada, en s desde la navegación, con ?rapido (la intro corta no cambia la carga);
//   · descarga: lo que pidió la página hasta la ciudad montada, en KB con gzip (GitHub Pages sirve los .glb con gzip; los .gz
//     ya vienen comprimidos), por archivo y en total;
//   · cuadro con GPU en 4 vistas (esquina, aérea, dúplex, casas de oficiales): mediana de 120 cuadros girando, dibujando y
//     esperando a la GPU (WebGPU: copia del lienzo + onSubmittedWorkDone; WebGL 2: leer un píxel), como ciudad-medir.mjs.
// Resultado: fuente/verificacion/motor/medir-<etiqueta>.json (ignorado por git) y una tabla en la consola.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.resolve(AQUI, '..');
const ARGS = process.argv.slice(2), REV = ARGS.find((a) => !a.startsWith('--')) ?? 'origin/main';
const GL = ARGS.includes('--webgl'), MOVIL = ARGS.includes('--movil'), NOCHE = ARGS.includes('--noche'), EXTRA = (ARGS.find((a) => a.startsWith('--url=')) ?? '').slice(6);
const ETIQ = `${MOVIL ? 'movil' : 'pc'}-${GL ? 'webgl' : 'webgpu'}${NOCHE ? '-noche' : ''}${EXTRA ? '-' + EXTRA.replace(/[^a-z0-9]+/gi, '-') : ''}`;
const SALIDA = path.join(AQUI, 'verificacion', 'motor'); fs.mkdirSync(SALIDA, { recursive: true });
const MOMENTO = { fecha: { y: 2024, m: 1, d: 15 }, min: NOCHE ? 21 * 60 : 9 * 60 + 30 };
const VISTAS = {
  esquina: null,                                                       // la vista de inicio (main.js)
  aerea: 'aerea',                                                      // la vista «Aérea» de main.js
  duplex: { pos: [290, 12, -300], tgt: [360, 3, -400] },               // las de ciudad-medir.mjs
  oficiales: { pos: [1150, 28, -195], tgt: [1085, 17, -245] },
};
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gz': 'application/gzip', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
const gz = new Map();
function servidor(raiz, pedidos) {
  const srv = http.createServer((q, r) => {
    let p; try { p = path.normalize(path.join(raiz, decodeURIComponent(new URL(q.url, 'http://x').pathname))); } catch { r.writeHead(400); return r.end(); }
    if (!p.startsWith(raiz)) { r.writeHead(403); return r.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
    const k = path.relative(raiz, p);
    if (!gz.has(p)) { const b = fs.readFileSync(p); gz.set(p, /\.(gz|png|jpg|webp)$/.test(p) ? b.length : zlib.gzipSync(b, { level: 6 }).length); }
    pedidos.push({ archivo: k, gz: gz.get(p), t: performance.now() });
    r.writeHead(200, { 'Content-Type': TIPOS[path.extname(p).toLowerCase()] ?? 'application/octet-stream' });
    fs.createReadStream(p).pipe(r);
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}
function exportar(rev) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e106-medir-'));
  const raiz = execFileSync('git', ['-C', RAIZ, 'ls-tree', '--name-only', rev], { encoding: 'utf8' }).split('\n').filter((x) => x && x !== 'fuente');
  const t = spawnSync('sh', ['-c', `git -C "${RAIZ}" archive "${rev}" ${raiz.map((x) => `'${x}'`).join(' ')} | tar -x -C "${dir}"`]);
  if (t.status !== 0) throw new Error('git archive: ' + t.stderr);
  return dir;
}

const nav = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const viejo = exportar(REV);
const res = { etiqueta: ETIQ, revision: REV, fecha: new Date().toISOString(), versiones: {} };
try {
  for (const [nombre, raiz] of [['main', viejo], ['rama', RAIZ]]) {
    const pedidos = [], srv = await servidor(raiz, pedidos);
    const ctx = await nav.newContext(MOVIL ? { ...devices['Pixel 7'], timezoneId: 'America/Panama', locale: 'es-PA' } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, timezoneId: 'America/Panama', locale: 'es-PA' });
    await ctx.addInitScript(() => {
      try { localStorage.setItem('e106-visto', '1'); localStorage.setItem('e106-nitidez', '1'); localStorage.removeItem('e106-motor'); } catch (e) { /* nada */ }
      // marcas de carga: grupos del 106, modelo completo y ciudad
      window.__marcas = {}; const t = () => performance.now();
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__marcas.primerPintado = e.startTime; }).observe({ type: 'paint', buffered: true });
      const mirar = () => { const E = window.__e106?.escena, M = window.__marcas;
        if (E?.listos && !M.edificio && ['sitio', 'arquitectura', 'ventanas', 'cubiertas', 'entrada', 'detalles'].every((g) => E.listos.has(g))) M.edificio = t();
        if (E?.cargado && !M.modelo) M.modelo = t(); if (E?.ciudadLista && !M.ciudad) M.ciudad = t();
        if (!M.ciudad || !M.modelo) setTimeout(mirar, 20); };
      setTimeout(mirar, 20);
    });
    const pg = await ctx.newPage(), errores = [];
    pg.on('pageerror', (e) => errores.push(String(e).slice(0, 300)));
    pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 300)); });
    const t0 = performance.now();
    await pg.goto(`http://127.0.0.1:${srv.address().port}/index.html?prueba&rapido${GL ? '&webgl' : ''}${EXTRA ? '&' + EXTRA : ''}`, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__e106?.escena?.cargado && document.documentElement.classList.contains('listo') && !document.documentElement.classList.contains('en-intro'), null, { timeout: 240000, polling: 100 });
    await pg.evaluate(() => Promise.race([window.__e106.escena.cargaCiudad, new Promise((ok) => setTimeout(ok, 120000))]));
    await pg.evaluate(() => Promise.race([window.__e106.escena.cargaDiferida, new Promise((ok) => setTimeout(ok, 120000))]));
    await pg.waitForTimeout(1500);
    const marcas = await pg.evaluate(() => ({ ...window.__marcas, ciudadOpc: window.__e106.escena.ciudadOpc ? { nivel: window.__e106.escena.ciudadOpc.nivel, motivo: window.__e106.escena.ciudadOpc.motivo } : null, backend: window.__e106.escena.backend, nivel: window.__e106.escena.calidad.nivel }));
    const porArchivo = {}; for (const p of pedidos) porArchivo[p.archivo] = p.gz;
    const total = Object.values(porArchivo).reduce((a, b) => a + b, 0);
    const v = { backend: marcas.backend, nivelCalidad: marcas.nivel, ciudad: marcas.ciudadOpc, cargaS: Object.fromEntries(['primerPintado', 'edificio', 'modelo', 'ciudad'].map((k) => [k, marcas[k] == null ? null : Math.round(marcas[k] / 10) / 100])),
      descargaKB: Math.round(total / 1024), glbKB: Object.fromEntries(Object.entries(porArchivo).filter(([k]) => /\.glb$/.test(k)).map(([k, b]) => [path.basename(k), Math.round(b / 1024)])), vistas: {}, errores };
    // cuadro con GPU por vista
    await pg.evaluate((m) => { __e106.S.pausa = false; __e106.viajarA({ ...m, lente: 'foto', vista: 'esquina', inmediato: true }); }, MOMENTO);
    await pg.waitForTimeout(3000);
    for (const [vk, V] of Object.entries(VISTAS)) {
      if (typeof V === 'string' || V === null) { await pg.evaluate(([m, vista]) => { __e106.S.pausa = false; __e106.viajarA({ ...m, lente: 'foto', vista, inmediato: true }); }, [MOMENTO, V ?? 'esquina']); await pg.waitForTimeout(3000); }
      v.vistas[vk] = await pg.evaluate(async (V) => {
        const E = __e106.escena, S = __e106.S, C = __e106.controls, r = E.renderer; S.pausa = true;
        if (V && typeof V === 'object') { C.target.set(...V.tgt); E.camera.position.set(...V.pos); E.camera.lookAt(...V.tgt); E.camera.updateMatrixWorld(true); E.setAlejamiento(E.camera.position.distanceTo(C.target)); }
        const off = E.camera.position.clone().sub(C.target), eje = E.camera.up.clone(); let ang = 0;
        const be = r.backend, gl = be.gl, px = new Uint8Array(4), sync = [];
        const esperarGPU = async () => { if (be.isWebGPUBackend) { const b = await createImageBitmap(r.domElement, 0, 0, 1, 1); b.close(); await be.device.queue.onSubmittedWorkDone(); } else gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
        r.info.autoReset = false; let llamadas = 0, tris = 0;
        for (let i = 0; i < 130; i++) {
          ang += 0.004; E.camera.position.copy(C.target).add(off.clone().applyAxisAngle(eje, ang)); E.camera.lookAt(C.target); E.camera.updateMatrixWorld(true);
          await new Promise((ok) => requestAnimationFrame(ok)); r.info.reset(); const t = performance.now(); E.render(); await esperarGPU();
          if (i >= 10) { sync.push(performance.now() - t); llamadas = r.info.render.drawCalls; tris = r.info.render.triangles; }
        }
        r.info.autoReset = true; S.pausa = false;
        const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))]; };
        return { medianaMs: Math.round(q(sync, 0.5) * 10) / 10, p95Ms: Math.round(q(sync, 0.95) * 10) / 10, llamadas, triangulosK: Math.round(tris / 1000) };
      }, V);
    }
    res.versiones[nombre] = v;
    await ctx.close(); srv.close();
  }
} finally { await nav.close(); fs.rmSync(viejo, { recursive: true, force: true }); }
fs.writeFileSync(path.join(SALIDA, `medir-${ETIQ}.json`), JSON.stringify(res, null, 1));
const A = res.versiones.main, B = res.versiones.rama, f = (x) => x == null ? '—' : String(x).replace('.', ',');
console.log(`${ETIQ} · main: ${A.backend} ${A.nivelCalidad} · rama: ${B.backend} ${B.nivelCalidad}, ciudad ${B.ciudad ? B.ciudad.nivel + ' (' + B.ciudad.motivo + ')' : 'no'}`);
console.log(`carga (s): primer pintado ${f(A.cargaS.primerPintado)} → ${f(B.cargaS.primerPintado)} · 106 completo ${f(A.cargaS.edificio)} → ${f(B.cargaS.edificio)} · modelo ${f(A.cargaS.modelo)} → ${f(B.cargaS.modelo)} · ciudad ${f(B.cargaS.ciudad)}`);
console.log(`descarga con gzip: ${A.descargaKB} KB → ${B.descargaKB} KB (glb de la rama: ${JSON.stringify(B.glbKB)})`);
for (const k of Object.keys(VISTAS)) console.log(`  ${k.padEnd(10)} cuadro con GPU ${f(A.vistas[k].medianaMs)} → ${f(B.vistas[k].medianaMs)} ms (p95 ${f(A.vistas[k].p95Ms)} → ${f(B.vistas[k].p95Ms)}) · llamadas ${A.vistas[k].llamadas} → ${B.vistas[k].llamadas} · triángulos ${A.vistas[k].triangulosK}k → ${B.vistas[k].triangulosK}k`);
if (A.errores.length || B.errores.length) console.log('errores', A.errores.slice(0, 3), B.errores.slice(0, 3));
