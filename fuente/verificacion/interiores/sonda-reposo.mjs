// Sonda del cuadro en reposo (la misma página y ventana que verificar.mjs, comprobación 5): intervalos de requestAnimationFrame
// durante unos segundos sin tocar nada, cuántos cuadros dibuja la app y por qué, y cuánto tarda cada dibujo en la GPU.
// Uso: cd fuente && node verificacion/interiores/sonda-reposo.mjs [--antes] [--webgl] [--sin-interior]
//   --antes         la copia de main en verificacion/interiores/antes/
//   --sin-interior  apaga el interior (escena.interiorK a 0) para separar su costo
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../..');
const ARGS = process.argv.slice(2);
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gz': 'application/gzip', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let p = path.normalize(path.join(RAIZ, decodeURIComponent(new URL(q.url, 'http://x').pathname)));
  if (!p.startsWith(RAIZ) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TIPOS[path.extname(p).toLowerCase()] ?? 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${srv.address().port}/${ARGS.includes('--antes') ? 'fuente/verificacion/interiores/antes/' : ''}index.html?prueba&rapido${ARGS.includes('--webgl') ? '&webgl' : ''}`;
const nav = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, timezoneId: 'America/Panama', locale: 'es-PA' });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('e106-visto', '1'); localStorage.setItem('e106-nitidez', '1'); localStorage.removeItem('e106-motor'); } catch (e) { /* nada */ }
    let actual; Object.defineProperty(window, '__e106', { configurable: true, get: () => actual, set: (v) => { if (actual && !window.__e106base) window.__e106base = actual; if (!actual && v && !v.viajarA) window.__e106base = v; actual = v; } });
    window.__cuadros = []; const f = (t) => { window.__cuadros.push(t); requestAnimationFrame(f); }; requestAnimationFrame(f);
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('[error]', String(e).slice(0, 200)));
  await pg.goto(url, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__e106?.escena?.cargado && window.__e106base && !window.__e106base.intro && document.documentElement.classList.contains('listo')
    && !document.documentElement.classList.contains('en-intro') && window.__e106.clima?.horario, null, { timeout: 180000, polling: 250 });
  await esperar(1500);
  if (ARGS.includes('--sin-interior')) await pg.evaluate(() => { for (const u of Object.values(__e106.escena.interiorK)) u.value = 0; __e106.escena.sucio = true; });
  const r = await pg.evaluate(async () => {
    const E = __e106.escena, S = __e106.S, U = __e106.U;
    // cuenta los dibujos y su tiempo de CPU
    let n = 0, cpu = 0; const orig = E.render.bind(E);
    E.render = (...a) => { const t = performance.now(); const v = orig(...a); cpu += performance.now() - t; n++; return v; };
    const t0 = performance.now(); await new Promise((ok) => setTimeout(ok, 4000));
    E.render = orig;
    const c = __cuadros.filter((x) => x >= t0), iv = []; for (let i = 1; i < c.length; i++) iv.push(c[i] - c[i - 1]);
    const s = [...iv].sort((a, b) => a - b);
    return { cuadros: c.length, dibujos: n, cpuMsPorDibujo: +(cpu / Math.max(1, n)).toFixed(2), ivMediana: +s[s.length >> 1].toFixed(1), ivMax: +s[s.length - 1].toFixed(1), largos: iv.filter((x) => x > 25).length,
      estado: { lluvia: +U.lluvia.value.toFixed(3), sucio: !!E.sucio, viaje: !!S.viaje, particulas: !!E.particulas, noche: +U.noche.value.toFixed(2), backend: E.backend, dpr: E.renderer.getPixelRatio(), px: E.renderer.domElement.width + '×' + E.renderer.domElement.height } };
  });
  console.log(JSON.stringify(r));
} finally { await nav.close(); srv.close(); }
