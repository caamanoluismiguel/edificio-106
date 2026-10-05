// Rama feat/ciudad: mide y fotografía la ciudad (?ciudad=1) con cada opción de sombra. Uso (de a una corrida: nunca dos
// pruebas de rendimiento en paralelo):
//   cd fuente && node ciudad-medir.mjs --sombra=defecto|actual|sunlight|csm|ajustada|sin [--webgl] [--perfil=alto|bajo|movil] [--capturas]
//   --sombra=sin  la página sin ?ciudad=1 (lo publicado), como referencia; --sombra=defecto: ?ciudad=1 sin ?sombra= (la regla de escena.js)
//   --perfil      alto: 1440 × 900 (WebGPU da 'alto'; con --webgl, escena.js lo baja a 'medio'); bajo: lo mismo y luego
//                 escena.bajarNivel(); movil: 390 × 844 táctil (main.js elige el perfil del teléfono: nivel 'bajo', tejas
//                 livianas, vegetación y entorno diferidos). Es la ventana del teléfono en ESTA máquina, no un teléfono.
// Resultado: ../docs/ciudad/fase3/medidas/<etiqueta>.json y, con --capturas, ../docs/ciudad/fase3/capturas/<etiqueta>-<vista>.png
// Método del tiempo de cuadro: el de main.js medir() y la comprobación 5 de verificar.mjs (intervalos de requestAnimationFrame
// con la cámara girando y la escena redibujándose cada cuadro; 0,7 s de calentamiento y 4 s medidos).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const ARGS = process.argv.slice(2), arg = (k, d) => (ARGS.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=')[1];
const SOMBRA = arg('sombra', 'actual'), GL = ARGS.includes('--webgl'), PERFIL = arg('perfil', 'alto'), CAPTURAS = ARGS.includes('--capturas');
const MOVIL = PERFIL === 'movil', MAPA = arg('mapa', '');   // --mapa=4096: ?sombramapa (píxeles por cascada)
const ETIQ = `${SOMBRA}${MAPA ? MAPA : ''}-${GL ? 'webgl' : 'webgpu'}-${PERFIL}`;
const DOCS = path.join(RAIZ, 'docs', 'ciudad', 'fase3');
fs.mkdirSync(path.join(DOCS, 'medidas'), { recursive: true }); fs.mkdirSync(path.join(DOCS, 'capturas'), { recursive: true });
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const MOMENTO = { fecha: { y: 2024, m: 1, d: 15 }, min: 9 * 60 + 30 };   // 15 de enero de 2024, 9:30: sol a ~35°, día despejado en la serie
// vistas (escena: +X noreste, +Z sureste). El 101 va de x 72,6 a 122,8 y de z −148,6 a −129,8 (osm.json registrado)
const VISTAS = {
  aerea: { pos: [330, 260, 60], tgt: [-40, 0, -250] },
  calle101: { pos: [116, 1.6, -112], tgt: [100, 6, -139] },
  cuarteles: { pos: [-90, 40, -560], tgt: [-240, 5, -760] },
  cuarteles4: { pos: [-60, 12, -470], tgt: [-150, 2, -560] },
  // los dúplex del área 300 (301 a 340) desde la calle Jacinto Palacios, a 12 m de altura
  duplex: { pos: [290, 12, -300], tgt: [360, 3, -400] },
  // las casas de oficiales de la calle Palmer (426, 427 y vecinas) desde el este, a unos 10 m sobre la calle (que va a ~17 m)
  oficiales: { pos: [1150, 28, -195], tgt: [1085, 17, -245] },
  // fase 3, paso 4 (casas bajas): los pabellones de las calles Gustavo y Evelio Lara, a 10 m de altura
  pabellones: { pos: [40, 10, 150], tgt: [-20, 0, 230] },
  // las casas NCO de 1949 (371 a 398) en la loma de las calles Wells y Henry
  nco49: { pos: [700, 25, -330], tgt: [600, 12, -420] },
  // las casas elevadas de la calle Aroldo Cano
  colonels: { pos: [660, 30, 340], tgt: [530, 2, 300] },
  // las casas del área 900 (calles Hill y Parke)
  area900: { pos: [940, 30, 340], tgt: [860, -3, 180] },
  // fase 3, paso 5 (altos y modernos): los bloques de la calle Gonzalo Crance, a 15 m de altura
  crance: { pos: [120, 15, 170], tgt: [175, 3, 280] },
  // los bloques de oficinas de la calle Luis Bonilla (112 a 116)
  bonilla: { pos: [-150, 14, 90], tgt: [-185, 4, 200] },
  // los institutos de la calle Rodolfo Benítez (contemporáneos)
  modernos: { pos: [-40, 30, -200], tgt: [-90, 5, -290] },
  // el Centro de Convenciones (184)
  convenciones: { pos: [200, 25, 130], tgt: [130, 3, 70] },
  // las naves del área 240 (243 a 248A)
  naves: { pos: [20, 25, -940], tgt: [-60, 3, -1040] },
  // el kiosco entre el 238 y el 239
  kioscos: { pos: [-10, 12, -480], tgt: [-50, 2, -520] },
  // las torres Canal View y Clayton Towers
  torres: { pos: [620, 40, -160], tgt: [745, 15, -70] },
  // toda la ciudad desde muy arriba
  ciudad: { pos: [700, 750, 650], tgt: [100, 0, -200] },
};

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gz': 'application/gzip',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
const bytes = {};
const srv = http.createServer((q, r) => {
  let p; try { p = path.normalize(path.join(RAIZ, decodeURIComponent(new URL(q.url, 'http://x').pathname))); } catch { r.writeHead(400); return r.end(); }
  if (!p.startsWith(RAIZ)) { r.writeHead(403); return r.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  if (/\/modelo\//.test(p)) bytes[path.basename(p)] = fs.statSync(p).size;
  r.writeHead(200, { 'Content-Type': TIPOS[path.extname(p).toLowerCase()] ?? 'application/octet-stream' });
  fs.createReadStream(p).pipe(r);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));

const nav = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const res = { etiqueta: ETIQ, fecha: new Date().toISOString(), sombra: SOMBRA, perfil: PERFIL, forzarWebGL: GL, errores: [], vistas: {} };
try {
  const ctx = await nav.newContext(MOVIL ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, timezoneId: 'America/Panama', locale: 'es-PA' }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, timezoneId: 'America/Panama', locale: 'es-PA' });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('e106-visto', '1'); localStorage.setItem('e106-nitidez', '1'); localStorage.removeItem('e106-motor'); } catch (e) { /* nada */ }
    let s = 106; Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let actual; Object.defineProperty(window, '__e106', { configurable: true, get: () => actual, set: (v) => { if (actual && !window.__e106base) window.__e106base = actual; if (!actual && v && !v.viajarA) window.__e106base = v; actual = v; } });
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => res.errores.push(String(e).slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /ciudad|THREE/.test(m.text()))) res.errores.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  const url = `http://127.0.0.1:${srv.address().port}/index.html?prueba&rapido${GL ? '&webgl' : ''}${SOMBRA === 'sin' ? '' : `&ciudad=1${SOMBRA === 'defecto' ? '' : '&sombra=' + SOMBRA}${MAPA ? '&sombramapa=' + MAPA : ''}`}`;
  const t0 = Date.now();
  // a veces la página se queda sin escena (WebGPU no entrega el adaptador) varios minutos: se recarga hasta 3 veces
  for (let intento = 1; ; intento++) {
    await pg.goto(url, { waitUntil: 'load' });
    const ok = await pg.waitForFunction(() => !!window.__e106?.escena, null, { timeout: 45000, polling: 250 }).then(() => true, () => false);
    if (ok) { res.intentos = intento; break; }
    if (intento >= 3) throw new Error('la escena no se creó en 3 intentos de 45 s');
  }
  await pg.waitForFunction((conCiudad) => window.__e106?.escena?.cargado && window.__e106base && !window.__e106base.intro && document.documentElement.classList.contains('listo')
    && !document.documentElement.classList.contains('en-intro') && window.__e106.clima?.horario && window.__e106.escena.listos?.has('contexto') && (!conCiudad || window.__e106.escena.ciudadLista),
  SOMBRA !== 'sin', { timeout: 400000, polling: 250 });
  res.cargaS = (Date.now() - t0) / 1000;
  if (PERFIL === 'bajo') await pg.evaluate(() => __e106.escena.bajarNivel());
  await pg.evaluate((m) => { __e106.S.pausa = false; __e106.viajarA({ ...m, lente: 'foto', inmediato: true }); }, MOMENTO);
  await esperar(3000);
  res.estado = await pg.evaluate(() => {
    const E = __e106.escena, sh = E.sun.shadow;
    return { backend: E.backend, nivel: E.calidad.nivel, dpr: E.renderer.getPixelRatio(), lienzo: [E.renderer.domElement.width, E.renderer.domElement.height],
      luz: E.sun.type, mapa: [sh.mapSize.x, sh.mapSize.y], csm: !!E.csm, normalBias: sh.normalBias, bias: sh.bias, ajuste: E._ajuste ?? null,
      ciudad: E.ciudad ? { ...E.ciudad.info, caja: E.ciudad.caja ? [E.ciudad.caja.min.toArray(), E.ciudad.caja.max.toArray()].map((v) => v.map((x) => Math.round(x))) : null } : null };
  });
  res.modeloBytes = { ...bytes }; res.modeloTotalKB = Math.round(Object.values(bytes).reduce((a, b) => a + b, 0) / 1024);
  for (const [nombre, V] of Object.entries(VISTAS)) {
    // cámara fija; un cuadro para rehacer sombras y LOD y el segundo es el que se mide y se guarda
    const r = await pg.evaluate(async ({ V, cap }) => {
      const E = __e106.escena, S = __e106.S, C = __e106.controls, r = E.renderer;
      S.pausa = true; C.target.set(...V.tgt); E.camera.position.set(...V.pos); E.camera.lookAt(...V.tgt); E.camera.updateMatrixWorld(true);
      E.setAlejamiento(E.camera.position.distanceTo(C.target));
      E.sun.shadow.needsUpdate = true; E.render(); await new Promise((ok) => requestAnimationFrame(ok));
      E.sun.shadow.needsUpdate = true; r.info.autoReset = false; r.info.reset(); E.render();
      const inf = { llamadas: r.info.render.drawCalls, triangulos: r.info.render.triangles };
      // la captura sin la profundidad de campo (main.js enfoca según sus vistas, no según estas) y después se repone
      let png = null;
      if (cap) { const d0 = E.uDesenfoque.value; E.uDesenfoque.value = 0; E.render(); png = r.domElement.toDataURL('image/png'); E.uDesenfoque.value = d0; }
      const niveles = E.ciudad?.niveles ?? null;
      // tamaño del texel de sombra donde está la cámara (la cascada más cercana): ancho de la cámara de sombra / píxeles
      const sh = E.sun.shadow, ancho = (c) => Math.max(c.right - c.left, c.top - c.bottom);
      const texel = E.csm ? E.csm.lights.map((l) => ancho(l.shadow.camera) / l.shadow.mapSize.x)
        : sh.isSunLightShadow ? [0, 1].map((i) => ancho(sh.getCamera(i)) / sh.mapSize.x) : [ancho(sh.camera) / sh.mapSize.x];
      // tiempo de cuadro: la cámara gira alrededor del objetivo (S.midiendo de main.js redibuja cada cuadro)
      S.pausa = false; C.enabled = false;
      const off = E.camera.position.clone().sub(C.target), eje = E.camera.up.clone();
      const M = { dts: [], cpu: [], last: performance.now(), ang: 0, calls: [], tris: [] };
      M.giro = () => { if (M.dts.length) { M.calls.push(r.info.render.drawCalls); M.tris.push(r.info.render.triangles); } M.ang += 0.004; E.camera.position.copy(C.target).add(off.clone().applyAxisAngle(eje, M.ang)); E.camera.lookAt(C.target); };
      S.midiendo = M; await new Promise((ok) => setTimeout(ok, 700)); M.dts.length = 0; M.cpu.length = 0; M.calls.length = 0; M.tris.length = 0;
      await new Promise((ok) => setTimeout(ok, 4000)); S.midiendo = null; C.enabled = true; r.info.autoReset = true;
      const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * p))] : null; };
      // costo real del cuadro sin el tope de 60 Hz: se dibuja un cuadro, se espera a que la GPU termine (WebGPU:
      // onSubmittedWorkDone; WebGL 2: leer un píxel obliga a terminar) y se mide desde el inicio del render; 120 cuadros girando
      S.pausa = true; const sync = [];
      // la espera: en WebGPU, Chrome no manda los comandos al proceso de la GPU hasta que algo lo obliga; createImageBitmap del
      // lienzo lo obliga y después onSubmittedWorkDone sí espera a que la GPU termine (sin la copia volvía en 0,6 ms: no esperaba
      // nada). En WebGL 2, leer un píxel obliga a terminar.
      const be = r.backend, gl = be.gl, px = new Uint8Array(4);
      const esperarGPU = async () => { if (be.isWebGPUBackend) { const b = await createImageBitmap(r.domElement, 0, 0, 1, 1); b.close(); await be.device.queue.onSubmittedWorkDone(); } else gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
      for (let i = 0; i < 130; i++) {
        M.ang += 0.004; E.camera.position.copy(C.target).add(off.clone().applyAxisAngle(eje, M.ang)); E.camera.lookAt(C.target); E.camera.updateMatrixWorld(true);
        await new Promise((ok) => requestAnimationFrame(ok)); const t = performance.now(); E.render(); await esperarGPU(); if (i >= 10) sync.push(performance.now() - t);
      }
      S.pausa = false;
      return { ...inf, texelSombraM: texel.map((t) => Math.round(t * 1000) / 1000), gpuMedianaMs: q(sync, 0.5), gpuP95Ms: q(sync, 0.95), gpuPeorMs: Math.max(...sync), niveles, png, cuadros: M.dts.length, medianaMs: q(M.dts, 0.5), p95Ms: q(M.dts, 0.95), peorMs: Math.max(0, ...M.dts), cpuMedianaMs: q(M.cpu, 0.5),
        llamadasGirando: { min: Math.min(...M.calls), max: Math.max(...M.calls) }, triangulosGirando: { min: Math.min(...M.tris), max: Math.max(...M.tris) } };
    }, { V, cap: CAPTURAS });
    if (r.png) {
      const f = path.join(DOCS, 'capturas', `${ETIQ}-${nombre}.png`);
      await sharp(Buffer.from(r.png.split(',')[1], 'base64')).png({ compressionLevel: 9, palette: true, quality: 85 }).toFile(f);
      r.captura = path.relative(RAIZ, f);
    }
    delete r.png;
    for (const k of ['medianaMs', 'p95Ms', 'peorMs', 'cpuMedianaMs', 'gpuMedianaMs', 'gpuP95Ms', 'gpuPeorMs']) r[k] = r[k] == null ? null : Math.round(r[k] * 10) / 10;
    res.vistas[nombre] = r;
    console.log(`${ETIQ} · ${nombre.padEnd(9)} llamadas ${String(r.llamadas).padStart(4)} · triángulos ${String(Math.round(r.triangulos / 1000)).padStart(5)}k · rAF mediana ${r.medianaMs} / peor ${r.peorMs} ms · cuadro con GPU mediana ${r.gpuMedianaMs} / p95 ${r.gpuP95Ms} / peor ${r.gpuPeorMs} ms${r.niveles ? ` · LOD alto ${r.niveles.alto}/medio ${r.niveles.medio}/lejos ${r.niveles.lejos}` : ''}`);
  }
} catch (e) { res.errorDelScript = String(e?.stack ?? e); console.error(e); }
finally { await nav.close(); srv.close(); }
fs.writeFileSync(path.join(DOCS, 'medidas', `${ETIQ}.json`), JSON.stringify(res, null, 1) + '\n');
console.log(`${ETIQ}: ${res.estado?.backend ?? '?'} · nivel ${res.estado?.nivel ?? '?'} · carga ${res.cargaS ?? '?'} s · modelo ${res.modeloTotalKB} KB · errores ${res.errores.length}${res.errores.length ? ': ' + res.errores.slice(0, 3).join(' | ') : ''}`);
process.exit(res.errorDelScript ? 2 : 0);
