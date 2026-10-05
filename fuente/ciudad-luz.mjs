// ESPIGA (rama feat/ciudad): el 101 del kit y el 106 en el MISMO cuadro, para comparar cómo los pinta la escena (mismo sol, misma
// exposición). Por cada vista guarda la imagen y una máscara (pasada con colores planos: muro y techo del 101 del kit, muro y
// techo del 106) y calcula sobre cada región la luminancia media (Rec. 709, sobre los valores sRGB de 0 a 1) y el porcentaje de
// píxeles casi blancos (los tres canales ≥ 235). Solo imágenes del visor (ninguna de Google).
//   cd fuente && node ciudad-luz.mjs [--etiqueta=v2] [--vistas=calle,aerea]
// Resultado: ../docs/ciudad/espiga/capturas/<etiqueta>-luz-<vista>.png y ../docs/ciudad/espiga/medidas/luz-<etiqueta>.json
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.resolve(AQUI, '..');
const ARGS = process.argv.slice(2), arg = (k, d) => (ARGS.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=')[1];
const ETIQ = arg('etiqueta', 'v2'), URLX = arg('url', 'sombra=sunlight&sombramapa=4096');
const DOCS = path.join(RAIZ, 'docs', 'ciudad', 'espiga');
const MOMENTO = { fecha: { y: 2024, m: 1, d: 15 }, min: 9 * 60 + 30 };
const W = 1440, H = 900;
// el 106 está en el origen (45,5 × 23 m); el 101 en x 72,6 a 122,8, z −148,6 a −129,8. Vistas con los dos dentro del cuadro
// Dos clases de vista: (1) los dos edificios en el mismo cuadro; (2) pares con la MISMA posición relativa de la cámara frente a
// cada edificio (el 101 está girado 1° respecto del 106, así que cada par mira la misma fachada con el mismo ángulo), en la misma
// corrida y el mismo momento: así se comparan caras con la misma orientación al sol
const C106 = [0, 0, 0], C101 = [97.7, 0, -139.2];
const par = (c, off, mira = 6) => ({ pos: [c[0] + off[0], off[1], c[2] + off[2]], tgt: [c[0], mira, c[2]], fov: 45 });
const VISTAS = {
  calle: { pos: [170, 1.7, 20], tgt: [50, 6, -60], fov: 45 },      // los dos en el cuadro, a 1,7 m
  aerea: { pos: [250, 180, 140], tgt: [50, 0, -70], fov: 40 },     // los dos en el cuadro, desde lo alto
  'se-106': par(C106, [8, 1.7, 40]), 'se-101': par(C101, [8, 1.7, 40]),       // fachada SE (al sol a esa hora)
  'no-106': par(C106, [-8, 1.7, -40]), 'no-101': par(C101, [-8, 1.7, -40]),   // fachada NO (a la sombra)
  'alto-106': par(C106, [70, 60, 80], 3), 'alto-101': par(C101, [70, 60, 80], 3), // techo y dos fachadas
  // el 101 solo: la cámara del enlace para LM (#cam=150,35,-80,98,5,-139) y una de calle frente a la fachada NO (la del pórtico)
  aerea101: { pos: [150, 35, -80], tgt: [98, 5, -139], fov: 45 },
  calle101: { pos: [128, 1.7, -178], tgt: [100, 7, -143], fov: 55 },
};
const elegidas = arg('vistas', Object.keys(VISTAS).join(',')).split(',');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gz': 'application/gzip', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  let p; try { p = path.normalize(path.join(RAIZ, decodeURIComponent(new URL(q.url, 'http://x').pathname))); } catch { r.writeHead(400); return r.end(); }
  if (!p.startsWith(RAIZ)) { r.writeHead(403); return r.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TIPOS[path.extname(p).toLowerCase()] ?? 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const nav = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const res = { etiqueta: ETIQ, url: URLX, momento: '2024-01-15 09:30', metodo: 'luminancia Rec. 709 de los valores sRGB (0 a 1) del cuadro final; casi blanco = R, G y B ≥ 235', vistas: {}, errores: [] };
try {
  const ctx = await nav.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, timezoneId: 'America/Panama', locale: 'es-PA' });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('e106-visto', '1'); localStorage.setItem('e106-nitidez', '1'); localStorage.removeItem('e106-motor'); } catch (e) { /* nada */ }
    let s = 106; Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let actual; Object.defineProperty(window, '__e106', { configurable: true, get: () => actual, set: (v) => { if (actual && !window.__e106base) window.__e106base = actual; if (!actual && v && !v.viajarA) window.__e106base = v; actual = v; } });
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => res.errores.push(String(e).slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /ciudad/.test(m.text()))) res.errores.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  const url = `http://127.0.0.1:${srv.address().port}/index.html?prueba&rapido&ciudad=espiga&${URLX}`;
  for (let i = 1; ; i++) { await pg.goto(url, { waitUntil: 'load' }); if (await pg.waitForFunction(() => !!window.__e106?.escena, null, { timeout: 45000 }).then(() => true, () => false)) break; if (i >= 3) throw new Error('sin escena'); }
  await pg.waitForFunction(() => window.__e106?.escena?.cargado && window.__e106base && !window.__e106base.intro && document.documentElement.classList.contains('listo')
    && !document.documentElement.classList.contains('en-intro') && window.__e106.clima?.horario && window.__e106.escena.listos?.has('contexto') && window.__e106.escena.ciudadLista, null, { timeout: 400000, polling: 250 });
  await pg.evaluate((m) => { __e106.S.pausa = false; __e106.viajarA({ ...m, lente: 'foto', inmediato: true }); }, MOMENTO);
  await new Promise((ok) => setTimeout(ok, 4000));
  res.backend = await pg.evaluate(() => __e106.escena.backend);
  res.montaje = await pg.evaluate(() => __e106.escena.ciudad?.info);
  for (const v of elegidas) {
    const V = VISTAS[v];
    const [img, mask] = await pg.evaluate(async ({ V }) => {
      const E = __e106.escena, S = __e106.S, C = __e106.controls;
      // three no está expuesto: los constructores salen de objetos de la escena (rutaMat es un MeshBasicNodeMaterial)
      let bm = E.rutaMat; if (!bm) E.scene.traverse((o) => { if (!bm && o.material?.isMeshBasicNodeMaterial) bm = o.material; });
      const Basico = bm.constructor, Color = E.hemi.color.constructor;
      const poner = () => { E.camera.fov = V.fov; E.camera.aspect = innerWidth / innerHeight; E.camera.clearViewOffset(); E.camera.position.set(...V.pos); E.camera.lookAt(...V.tgt); E.camera.updateProjectionMatrix(); E.camera.updateMatrixWorld(true); };
      S.pausa = true; C.target.set(...V.tgt); poner(); E.setAlejamiento(Math.min(E.camera.position.distanceTo(C.target), 60));
      for (let i = 0; i < 4; i++) { E.sun.shadow.needsUpdate = true; E.render(); await new Promise((ok) => requestAnimationFrame(ok)); }
      poner(); const d0 = E.uDesenfoque.value; E.uDesenfoque.value = 0; E.sun.shadow.needsUpdate = true; E.render(); E.render();
      const img = E.renderer.domElement.toDataURL('image/png');
      // máscara: colores planos sin luz. 101 del kit: muro rojo, techo (teja y mediagua) verde; 106: muro azul, techo amarillo
      const guard = [];
      const cat = (o) => {
        // el 101 del kit: sus mallas llevan el nombre del material del 106 que usan
        if (/^101 · /.test(o.name)) { const n = o.material?.name ?? ''; return /^Warm lime-painted plaster$/.test(n) ? 1 : /terracotta/i.test(n) ? 2 : 0; }
        let g = null; for (const [k, info] of Object.entries(E.grupos)) { let x = o; while (x) { if (x === info.root) { g = k; break; } x = x.parent; } if (g) break; }
        if (!g || g === 'contexto' || g === 'vegetacion') return 0;
        const n = o.material?.name ?? '';
        if (/^Warm lime-painted plaster$/.test(n)) return 3;
        if (/terracotta/i.test(n)) return 4;
        return 0;
      };
      const COLS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0]];
      const cache = new Map();
      E.scene.traverse((o) => { if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return; guard.push([o, o.material, o.visible]);
        const k = cat(o); if (o.isPoints || o.isLine || o.isSprite) { o.visible = false; return; }
        if (!cache.has(k)) { const m = new Basico({ color: new Color(...COLS[k]) }); m.fog = false; cache.set(k, m); } o.material = cache.get(k); });
      const fondo = E.scene.background, tm = E.renderer.toneMapping; E.scene.background = new Color(0, 0, 0); E.renderer.toneMapping = 0;
      E.renderer.render(E.scene, E.camera);
      const mask = E.renderer.domElement.toDataURL('image/png');
      for (const [o, m, vis] of guard) { o.material = m; o.visible = vis; }
      E.scene.background = fondo; E.renderer.toneMapping = tm; E.uDesenfoque.value = d0; E.render();
      return [img, mask];
    }, { V });
    const fImg = path.join(DOCS, 'capturas', /^(aerea|calle)101$/.test(v) ? `${ETIQ}-${v}.png` : `${ETIQ}-luz-${v}.png`);
    const bi = Buffer.from(img.split(',')[1], 'base64'), bm = Buffer.from(mask.split(',')[1], 'base64');
    await sharp(bi).png({ palette: true, quality: 90 }).toFile(fImg);
    const a = await sharp(bi).removeAlpha().raw().toBuffer({ resolveWithObject: true }), m = await sharp(bm).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const reg = { 1: '101 kit · muro', 2: '101 kit · techo y mediaguas', 3: '106 · muro', 4: '106 · techo y mediaguas' }, acc = {};
    for (let i = 0; i < a.info.width * a.info.height; i++) {
      const r = m.data[i * 3] / 255, g = m.data[i * 3 + 1] / 255, b = m.data[i * 3 + 2] / 255;
      const k = r > 0.8 && g < 0.2 && b < 0.2 ? 1 : g > 0.8 && r < 0.2 && b < 0.2 ? 2 : b > 0.8 && r < 0.2 && g < 0.2 ? 3 : r > 0.8 && g > 0.8 && b < 0.2 ? 4 : 0;
      if (!k) continue;
      const R = a.data[i * 3], G = a.data[i * 3 + 1], Bb = a.data[i * 3 + 2], Y = (0.2126 * R + 0.7152 * G + 0.0722 * Bb) / 255;
      const e = (acc[k] ??= { px: 0, suma: 0, blancos: 0, ys: [] }); e.px++; e.suma += Y; if (R >= 235 && G >= 235 && Bb >= 235) e.blancos++; if (e.ys.length < 200000) e.ys.push(Y);
    }
    res.vistas[v] = { camara: V, captura: path.relative(RAIZ, fImg), regiones: Object.fromEntries(Object.entries(reg).map(([k, n]) => { const e = acc[k]; if (!e) return [n, { px: 0 }];
      e.ys.sort((x, y) => x - y); return [n, { px: e.px, luminanciaMedia: +(e.suma / e.px).toFixed(3), mediana: +e.ys[e.ys.length >> 1].toFixed(3), p95: +e.ys[Math.floor(e.ys.length * 0.95)].toFixed(3), casiBlancosPct: +(100 * e.blancos / e.px).toFixed(2) }]; })) };
    console.log(v, JSON.stringify(res.vistas[v].regiones));
  }
} finally { await nav.close(); srv.close(); }
fs.writeFileSync(path.join(DOCS, 'medidas', `luz-${ETIQ}.json`), JSON.stringify(res, null, 1) + '\n');
if (res.errores.length) console.log('errores', res.errores);
