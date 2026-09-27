// Sonda para ajustar la noche: abre el sitio de la rama una vez y corre una lista de trabajos (JSON en argv[2]):
// [{nombre, fecha:{y,m,d}, min, vista|fachada|cam:{pos,tgt}, noche:{...ajustes de NOCHE}, modo, lampara}]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.resolve(AQUI, '../../..');
const OUT = process.env.SONDA_OUT ?? path.join(AQUI, 'sonda'); fs.mkdirSync(OUT, { recursive: true });
const trabajos = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const srv = http.createServer((q, r) => { let p = path.join(RAIZ, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html'); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' }[path.extname(p)] ?? 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const nav = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, timezoneId: 'America/Panama' });
  await ctx.addInitScript(() => { try { localStorage.setItem('e106-visto', '1'); localStorage.setItem('e106-nitidez', '1'); } catch (e) { /* */ } });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('[error]', String(e).slice(0, 300)));
  await pg.goto(`http://127.0.0.1:${srv.address().port}/index.html?prueba&rapido`);
  await pg.waitForFunction(() => window.__e106?.escena?.cargado && window.__e106.clima?.horario && !document.documentElement.classList.contains('en-intro'), null, { timeout: 180000, polling: 300 });
  await esperar(2500);
  for (const t of trabajos) {
    await pg.evaluate((t) => {
      const E = __e106.escena; Object.assign(E.NOCHE, t.noche ?? {});
      E.setLampara(t.lampara ?? 'led'); E.setModoNoche(t.modo ?? 'honesta');
      __e106.S.pausa = false; __e106.viajarA({ fecha: t.fecha, min: t.min, vista: t.vista ?? (t.cam || t.fachada ? null : 'esquina'), fachada: t.fachada ?? null, inmediato: true });
    }, t);
    await esperar(3200);
    if (t.cam) await pg.evaluate((c) => { const E = __e106.escena; __e106.controls.target.set(...c.tgt); E.camera.position.set(...c.pos); __e106.controls.update(); }, t.cam);
    await esperar(600);
    const d = await pg.evaluate(() => { const E = __e106.escena; __e106.S.pausa = true; E.render(); return { url: E.renderer.domElement.toDataURL('image/jpeg', 0.85), exp: E.renderer.toneMappingExposure, luz: E.sun.intensity, bl: E.brilloLuna, luna: E.luna }; });
    fs.writeFileSync(path.join(OUT, t.nombre + '.jpg'), Buffer.from(d.url.split(',')[1], 'base64'));
    console.log(t.nombre, 'exp', d.exp.toFixed(2), 'luz', d.luz.toFixed(3), 'brillo luna', d.bl?.toFixed(3), JSON.stringify(d.luna && { alt: d.luna.alt.toFixed(1), az: d.luna.az.toFixed(0), frac: d.luna.frac.toFixed(2) }));
  }
} finally { await nav.close(); srv.close(); }
