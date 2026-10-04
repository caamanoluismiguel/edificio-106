// Prueba de carga: abre el sitio armado de esta carpeta como teléfono (perfil de calidad «bajo», tejas y árboles livianos,
// grupos diferidos) y como computador, con y sin ?arboles=0, y comprueba que llegan TODOS los grupos de GRUPOS (escena.js),
// sin errores de consola ni de página ni peticiones locales fallidas. El guardia y verificar.mjs miran solo el perfil de
// computador: el 4 de octubre de 2026 un cambio dejó el teléfono sin vegetación, contexto ni árboles y ninguno lo vio.
//   cd fuente && node probar-carga.mjs        código de salida 0 si todo carga, 1 si algo falta
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.resolve(AQUI, '..');
const GRUPOS = JSON.parse(fs.readFileSync(path.join(AQUI, 'src/escena.js'), 'utf8').match(/export const GRUPOS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gz': 'application/gzip', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  let p = path.normalize(path.join(RAIZ, decodeURIComponent(new URL(q.url, 'http://x').pathname)));
  if (!p.startsWith(RAIZ)) { r.writeHead(403); return r.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TIPOS[path.extname(p).toLowerCase()] ?? 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${srv.address().port}/`;
const nav = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const CASOS = [
  { nombre: 'teléfono', disp: devices['Pixel 7'], q: '', esperados: GRUPOS, archivos: ['cubiertas_movil.glb', 'arboles_movil.glb'] },
  { nombre: 'teléfono ?arboles=0', disp: devices['Pixel 7'], q: '&arboles=0', esperados: GRUPOS.filter((g) => g !== 'arboles') },
  { nombre: 'computador', disp: { viewport: { width: 1600, height: 1000 } }, q: '', esperados: GRUPOS, archivos: ['cubiertas.glb', 'arboles.glb'] },
  { nombre: 'computador ?arboles=0', disp: { viewport: { width: 1600, height: 1000 } }, q: '&arboles=0', esperados: GRUPOS.filter((g) => g !== 'arboles') },
];
let falla = false;
for (const c of CASOS) {
  const ctx = await nav.newContext({ ...c.disp, timezoneId: 'America/Panama', locale: 'es-PA' });
  await ctx.addInitScript(() => { try { localStorage.setItem('e106-visto', '1'); } catch (e) { /* nada */ } });
  const pg = await ctx.newPage(), errores = [], pedidos = [];
  pg.on('pageerror', (e) => errores.push('página: ' + String(e).slice(0, 200)));
  pg.on('console', (m) => { if (m.type() === 'error') errores.push('consola: ' + m.text().slice(0, 200)); });
  pg.on('requestfailed', (r) => { if (r.url().startsWith(base)) errores.push('petición: ' + r.url()); });
  pg.on('response', (r) => { if (r.url().startsWith(base)) { pedidos.push(r.url().split('?')[0].split('/').pop()); if (r.status() >= 400) errores.push(`${r.status()}: ${r.url()}`); } });
  let r;
  try {
    await pg.goto(base + '?prueba&rapido' + c.q, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__e106?.escena?.cargado, null, { timeout: 180000, polling: 500 });
    await pg.evaluate(() => Promise.race([window.__e106.escena.cargaDiferida, new Promise((ok) => setTimeout(ok, 120000))]));
    r = await pg.evaluate(() => ({ grupos: Object.keys(window.__e106.escena.grupos ?? {}), nivel: window.__e106.escena.calidad?.nivel }));
  } catch (e) { errores.push('no cargó: ' + String(e).slice(0, 200)); r = { grupos: [] }; }
  const faltan = c.esperados.filter((g) => !r.grupos.includes(g)), sobran = r.grupos.filter((g) => !c.esperados.includes(g));
  const sinArchivo = (c.archivos ?? []).filter((f) => !pedidos.includes(f));
  const mal = faltan.length || sobran.length || sinArchivo.length || errores.length;
  if (mal) falla = true;
  console.log(`${mal ? '✗' : '✓'} ${c.nombre} (nivel ${r.nivel ?? '?'}): ${r.grupos.length} grupos` + (faltan.length ? ` · FALTAN ${faltan.join(', ')}` : '') + (sobran.length ? ` · SOBRAN ${sobran.join(', ')}` : '')
    + (sinArchivo.length ? ` · no pidió ${sinArchivo.join(', ')}` : '') + (errores.length ? `\n    ${errores.slice(0, 5).join('\n    ')}` : ''));
  await ctx.close();
}
await nav.close(); srv.close();
console.log(falla ? 'RESULTADO: ALGO NO CARGA' : 'RESULTADO: todo carga en teléfono y computador');
process.exit(falla ? 1 : 0);
