// Prueba de carga: abre el sitio armado de esta carpeta como teléfono (perfil de calidad «bajo», tejas y árboles livianos,
// grupos diferidos) y como computador, con y sin ?arboles=0, y comprueba que llegan TODOS los grupos de GRUPOS (escena.js),
// sin errores de consola ni de página ni peticiones locales fallidas. El guardia y verificar.mjs miran solo el perfil de
// computador: el 4 de octubre de 2026 un cambio dejó el teléfono sin vegetación, contexto ni árboles y ninguno lo vio.
// La ciudad (encendida por defecto) también: montada en cada caso que la pide, con ciudad_alto.glb solo en el nivel completo,
// y sin pedir ciudad.glb con ?ciudad=0 o con la capa apagada guardada.
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
// ciudad: 'completo' (con ciudad_alto.glb), 'medio' (sin él), false (no se pide ciudad.glb)
const PC = { viewport: { width: 1600, height: 1000 } };
const CASOS = [
  { nombre: 'teléfono', disp: devices['Pixel 7'], q: '', esperados: GRUPOS, archivos: ['cubiertas_movil.glb', 'arboles_movil.glb'], ciudad: 'medio' },
  { nombre: 'teléfono ?arboles=0', disp: devices['Pixel 7'], q: '&arboles=0', esperados: GRUPOS.filter((g) => g !== 'arboles'), ciudad: 'medio' },
  { nombre: 'teléfono ?ciudad=0', disp: devices['Pixel 7'], q: '&ciudad=0', esperados: GRUPOS, ciudad: false },
  { nombre: 'computador', disp: PC, q: '', esperados: GRUPOS, archivos: ['cubiertas.glb', 'arboles.glb'], pc: true, ciudad: 'completo' },
  { nombre: 'computador ?arboles=0', disp: PC, q: '&arboles=0', esperados: GRUPOS.filter((g) => g !== 'arboles'), ciudad: 'completo' },
  { nombre: 'computador ?ciudad=0', disp: PC, q: '&ciudad=0', esperados: GRUPOS, pc: true, ciudad: false },
  // un navegador que quedó en WebGL por un fallo viejo (antes se guardaba «webgl» para siempre) vuelve a WebGPU con la versión nueva
  { nombre: 'computador en WebGL 2', disp: PC, q: '&webgl', esperados: GRUPOS, ciudad: 'completo' },
  { nombre: 'computador con «webgl» viejo guardado', disp: PC, q: '', esperados: GRUPOS, motorViejo: 'webgl', pc: true, ciudad: 'completo' },
  // la capa «Ciudad del Saber» apagada en una visita anterior: no se descarga; ?ciudad=1 la trae igual
  { nombre: 'computador con la ciudad apagada guardada', disp: PC, q: '', esperados: GRUPOS, guardar: { 'e106-ciudad': '0' }, pc: true, ciudad: false },
  { nombre: 'computador con la ciudad apagada guardada y ?ciudad=1', disp: PC, q: '&ciudad=1', esperados: GRUPOS, guardar: { 'e106-ciudad': '0' }, ciudad: 'completo' },
];
let falla = false;
for (const c of CASOS) {
  const ctx = await nav.newContext({ ...c.disp, timezoneId: 'America/Panama', locale: 'es-PA' });
  await ctx.addInitScript(([viejo, guardar]) => { try { localStorage.setItem('e106-visto', '1'); if (viejo && !sessionStorage.getItem('puesto')) { localStorage.setItem('e106-motor', viejo); sessionStorage.setItem('puesto', '1'); } for (const [k, v] of Object.entries(guardar ?? {})) localStorage.setItem(k, v); } catch (e) { /* nada */ } }, [c.motorViejo ?? null, c.guardar ?? null]);
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
    await pg.evaluate(() => Promise.race([window.__e106.escena.cargaCiudad, new Promise((ok) => setTimeout(ok, 120000))]));
    await pg.waitForTimeout(2500);   // la profundidad de campo entra suave (~1 s)
    r = await pg.evaluate(() => { const E = window.__e106.escena; return { grupos: Object.keys(E.grupos ?? {}), nivel: E.calidad?.nivel, backend: E.backend, dof: E.uDesenfoque?.value, conDof: !!E.conDof,
      ciudad: E.ciudadOpc ? { lista: !!E.ciudadLista, nivel: E.ciudadOpc.nivel, alto: !!E.ciudad?.altoActivo, marcada: document.querySelector('#capa-ciudad')?.checked } : null }; });
  } catch (e) { errores.push('no cargó: ' + String(e).slice(0, 200)); r = { grupos: [] }; }
  const faltan = c.esperados.filter((g) => !r.grupos.includes(g)), sobran = r.grupos.filter((g) => !c.esperados.includes(g));
  const sinArchivo = (c.archivos ?? []).filter((f) => !pedidos.includes(f));
  // la ciudad: montada y en el nivel esperado, con la capa marcada; o, si no se pide, ni el archivo
  const pideCiudad = pedidos.includes('ciudad.glb'), pideAlto = pedidos.includes('ciudad_alto.glb');
  if (c.ciudad === false && (pideCiudad || r.ciudad?.lista)) errores.push('ciudad: se pidió o se montó sin que tocara');
  if (c.ciudad && !(r.ciudad?.lista && pideCiudad)) errores.push(`ciudad: no llegó (${JSON.stringify(r.ciudad)})`);
  if (c.ciudad && r.ciudad?.lista && (r.ciudad.nivel !== c.ciudad || pideAlto !== (c.ciudad === 'completo') || r.ciudad.marcada !== true)) errores.push(`ciudad: nivel ${r.ciudad.nivel}, detalle alto pedido ${pideAlto}, capa marcada ${r.ciudad.marcada} (se espera ${c.ciudad})`);
  // profundidad de campo armada y encendida en todos los casos (LM la quiere siempre); en computador, además, WebGPU y nivel alto
  if (!r.conDof || !(r.dof > 0.9)) errores.push(`profundidad de campo: armada ${r.conDof} · ${r.dof?.toFixed?.(2) ?? r.dof} (se espera armada y 1)`);
  if (c.pc && (r.backend !== 'WebGPU' || r.nivel !== 'alto')) errores.push(`computador: ${r.backend} · nivel ${r.nivel} (se espera WebGPU y alto)`);
  const mal = faltan.length || sobran.length || sinArchivo.length || errores.length;
  if (mal) falla = true;
  console.log(`${mal ? '✗' : '✓'} ${c.nombre} (${r.backend ?? '?'}, nivel ${r.nivel ?? '?'}${`, profundidad de campo ${r.conDof ? (r.dof?.toFixed?.(2)) : 'no'}`}, ciudad ${r.ciudad?.lista ? r.ciudad.nivel : 'no'}): ${r.grupos.length} grupos` + (faltan.length ? ` · FALTAN ${faltan.join(', ')}` : '') + (sobran.length ? ` · SOBRAN ${sobran.join(', ')}` : '')
    + (sinArchivo.length ? ` · no pidió ${sinArchivo.join(', ')}` : '') + (errores.length ? `\n    ${errores.slice(0, 5).join('\n    ')}` : ''));
  await ctx.close();
}
await nav.close(); srv.close();
console.log(falla ? 'RESULTADO: ALGO NO CARGA' : 'RESULTADO: todo carga en teléfono y computador');
process.exit(falla ? 1 : 0);
