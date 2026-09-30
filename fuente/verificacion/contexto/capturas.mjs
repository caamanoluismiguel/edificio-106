// Capturas del contexto (vecinos de OpenStreetMap): el sitio armado en la raíz del repositorio en escenas fijas.
// Uso: cd fuente && node verificacion/contexto/capturas.mjs --etiqueta=antes|despues [--solo=aerea,esquina] [--raiz=<sitio>] [--cap=<carpeta>] [--movil] [--webgl] [--visible]
// Antes de «despues»: armar el sitio de la rama en la raíz (ver verificacion/noche/armar-rama.sh) y al terminar restaurar
// index.html y js/ (git checkout -- ../index.html ../js). Salida: verificacion/contexto/cap/<etiqueta>_<escena>.jpg
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve((process.argv.find((a) => a.startsWith('--raiz=')) ?? '').slice(7) || path.resolve(AQUI, '../../..'));   // --raiz=: otro sitio armado (p. ej. el publicado)
const ARGS = process.argv.slice(2);
const CAP = path.resolve((ARGS.find((a) => a.startsWith('--cap=')) ?? '').slice(6) || path.join(AQUI, 'cap')); fs.mkdirSync(CAP, { recursive: true });
const ETIQ = (ARGS.find((a) => a.startsWith('--etiqueta=')) ?? '--etiqueta=despues').slice(11);
const SOLO = (ARGS.find((a) => a.startsWith('--solo=')) ?? '').slice(7).split(',').filter(Boolean);
const MOVIL = ARGS.includes('--movil');                    // pantalla vertical de teléfono (las vistas cambian de encuadre)
const ANCHO = MOVIL ? 390 : 1440, ALTO = MOVIL ? 844 : 900;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// escenas: momento fijo (hash #m-…), vista o fachada, forma de ver
export const ESCENAS = {
  aerea: { fecha: { y: 2024, m: 3, d: 25 }, min: 15 * 60 + 30, vista: 'aerea' },
  esquina: { fecha: { y: 2024, m: 3, d: 25 }, min: 15 * 60 + 30, vista: 'esquina' },
  planta: { fecha: { y: 2024, m: 3, d: 25 }, min: 11 * 60, vista: 'planta' },
  aerea_manana: { fecha: { y: 2024, m: 3, d: 25 }, min: 7 * 60 + 30, vista: 'aerea' },
  aerea_tarde: { fecha: { y: 2024, m: 1, d: 13 }, min: 16 * 60 + 30, vista: 'aerea' },
  aerea_lejos: { fecha: { y: 2024, m: 3, d: 25 }, min: 10 * 60, cam: { pos: [150, 170, 200], tgt: [-20, 0, -30] } },
  // tarde despejada de enero (ERA5: DNI 656 W/m², 1 % de nubes entre las 16 y las 17) y mañana despejada de diciembre (548 W/m², 3 %)
  so_tarde: { fecha: { y: 2024, m: 1, d: 13 }, min: 16 * 60 + 30, fachada: 'so' },
  so_tarde_sol: { fecha: { y: 2024, m: 1, d: 13 }, min: 16 * 60 + 30, fachada: 'so', lente: 'sol' },
  so_arriba: { fecha: { y: 2024, m: 1, d: 13 }, min: 16 * 60 + 30, cam: { pos: [-38, 9, 34], tgt: [-22.75, 4.5, -2] } },
  so_arriba_sol: { fecha: { y: 2024, m: 1, d: 13 }, min: 16 * 60 + 30, lente: 'sol', cam: { pos: [-38, 9, 34], tgt: [-22.75, 4.5, -2] } },
  so_frente_1715: { fecha: { y: 2024, m: 1, d: 13 }, min: 17 * 60 + 15, cam: { pos: [-40.5, 2.5, 1], tgt: [-22.75, 6, 0] } },
  so_frente_1715_sol: { fecha: { y: 2024, m: 1, d: 13 }, min: 17 * 60 + 15, lente: 'sol', cam: { pos: [-40.5, 2.5, 1], tgt: [-22.75, 6, 0] } },
  so_1715: { fecha: { y: 2024, m: 1, d: 13 }, min: 17 * 60 + 15, cam: { pos: [-38, 9, 34], tgt: [-22.75, 4.5, -2] } },
  se_manana: { fecha: { y: 2022, m: 12, d: 7 }, min: 7 * 60 + 30, fachada: 'se' },
  se_manana_sol: { fecha: { y: 2022, m: 12, d: 7 }, min: 7 * 60 + 30, fachada: 'se', lente: 'sol' },
  se_arriba: { fecha: { y: 2022, m: 12, d: 7 }, min: 7 * 60 + 30, cam: { pos: [-38, 8, 24], tgt: [0, 4.5, 11.5] } },
  se_arriba_sol: { fecha: { y: 2022, m: 12, d: 7 }, min: 7 * 60 + 30, lente: 'sol', cam: { pos: [-38, 8, 24], tgt: [0, 4.5, 11.5] } },
  se_hallazgo: { fecha: { y: 2026, m: 1, d: 15 }, min: 7 * 60 + 30, fachada: 'se' },
  f_se: { fecha: { y: 2024, m: 3, d: 25 }, min: 10 * 60, fachada: 'se' },
  f_no: { fecha: { y: 2024, m: 3, d: 25 }, min: 10 * 60, fachada: 'no' },
  f_ne: { fecha: { y: 2024, m: 3, d: 25 }, min: 10 * 60, fachada: 'ne' },
  f_so: { fecha: { y: 2024, m: 3, d: 25 }, min: 10 * 60, fachada: 'so' },
  alero: { fecha: { y: 2024, m: 3, d: 25 }, min: 10 * 60, cam: { pos: [34.6, 7.5, 29.6], tgt: [19, 7.5, 11] } },
  alero_antes: { fecha: { y: 2024, m: 3, d: 25 }, min: 10 * 60, cam: { pos: [40, 7.5, 36], tgt: [19, 7.5, 11] } },
  vecino105: { fecha: { y: 2024, m: 3, d: 25 }, min: 10 * 60, cam: { pos: [-28, 5, 24], tgt: [-62, 7, 0] } },
  innova: { fecha: { y: 2024, m: 3, d: 25 }, min: 10 * 60, cam: { pos: [-35, 2, 26], tgt: [10, 6, 45] } },
  fundacion: { fecha: { y: 2024, m: 3, d: 25 }, min: 10 * 60, cam: { pos: [-70, 22, -30], tgt: [-128, 8, -62] } },
  // contexto2 (108 La Casa, 109 Innova): la fachada SE en la mañana del hallazgo del alero, desde la entrada y desde el estacionamiento
  se_0730: { fecha: { y: 2024, m: 1, d: 15 }, min: 7 * 60 + 30, fachada: 'se' },
  se_0800: { fecha: { y: 2024, m: 1, d: 15 }, min: 8 * 60, fachada: 'se' },
  se_0730_sol: { fecha: { y: 2024, m: 1, d: 15 }, min: 7 * 60 + 30, fachada: 'se', lente: 'sol' },
  se_0800_sol: { fecha: { y: 2024, m: 1, d: 15 }, min: 8 * 60, fachada: 'se', lente: 'sol' },
  se_0730_arriba: { fecha: { y: 2024, m: 1, d: 15 }, min: 7 * 60 + 30, cam: { pos: [-30, 14, 40], tgt: [5, 3, 18] } },
  entrada_salon: { fecha: { y: 2024, m: 3, d: 25 }, min: 10 * 60, cam: { pos: [17, 1.7, 21], tgt: [-2, 3, 45] } },
  entrada_casa: { fecha: { y: 2024, m: 3, d: 25 }, min: 10 * 60, cam: { pos: [20, 1.7, 21], tgt: [22, 3, 45] } },
  aerea_frente: { fecha: { y: 2024, m: 1, d: 15 }, min: 7 * 60 + 30, cam: { pos: [45, 60, -35], tgt: [-25, 0, 50] } },
  innova_est: { fecha: { y: 2024, m: 3, d: 25 }, min: 10 * 60, cam: { pos: [-55, 1.7, 44], tgt: [-104, 6, 62] } },
  innova_calle: { fecha: { y: 2024, m: 3, d: 25 }, min: 10 * 60, cam: { pos: [-104.5, 1.7, 24], tgt: [-104, 6, 51] } },
  ateneo_est: { fecha: { y: 2024, m: 3, d: 25 }, min: 10 * 60, cam: { pos: [-55, 1.7, 44], tgt: [-40, 6, 90] } },
  balboa: { fecha: { y: 2024, m: 3, d: 25 }, min: 10 * 60, cam: { pos: [30, 3, 16], tgt: [90, 6, -5] } },
};

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
const dos = (n) => String(n).padStart(2, '0');

async function escena(nav, base, clave, e) {
  const ctx = await nav.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: MOVIL ? 2 : 1, isMobile: MOVIL, hasTouch: MOVIL, timezoneId: 'America/Panama', locale: 'es-PA' });
  await ctx.addInitScript(() => { try { localStorage.setItem('e106-visto', '1'); localStorage.setItem('e106-nitidez', '1'); localStorage.removeItem('e106-motor'); } catch (x) { /* nada */ }
    let actual; Object.defineProperty(window, '__e106', { configurable: true, get: () => actual, set: (v) => { if (actual && !window.__e106base) window.__e106base = actual; if (!actual && v && !v.viajarA) window.__e106base = v; actual = v; } });
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (x) => console.log('  [error de página]', String(x).slice(0, 300)));
  const hh = Math.floor(e.min / 60), mi = e.min % 60;
  const hash = `#m-${e.fecha.y}${dos(e.fecha.m)}${dos(e.fecha.d)}-${dos(hh)}${dos(mi)}`;
  await pg.goto(`${base}/index.html?prueba&rapido${ARGS.includes('--webgl') ? '&webgl' : ''}${hash}`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__e106?.escena?.cargado && window.__e106base && !window.__e106base.intro && document.documentElement.classList.contains('listo') && !document.documentElement.classList.contains('en-intro') && window.__e106.clima?.horario, null, { timeout: 180000, polling: 250 });
  await esperar(1500);
  // el viaje del hash termina antes del salto inmediato
  await pg.waitForFunction(() => !__e106.S.viaje, null, { timeout: 20000, polling: 200 }).catch(() => {});
  // el momento del hash: se espera a que el reloj muestre esa fecha y hora
  const texto = `${e.fecha.d} ${MES3[e.fecha.m - 1]}`;
  await pg.evaluate((d) => { __e106.S.pausa = false; __e106.viajarA({ ...d, inmediato: true }); }, { fecha: e.fecha, min: e.min, vista: e.vista ?? null, fachada: e.fachada ?? null, lente: e.lente ?? 'foto' });
  await pg.waitForFunction(([t, h]) => document.body.innerText.includes(h) && document.body.innerText.toLowerCase().includes(t), [texto, `${dos(hh)}:${dos(mi)}`], { timeout: 30000, polling: 250 }).catch(() => console.log('  (no se vio el texto de la fecha)', clave));
  // y a que el sol de la escena sea el de ese momento (el viaje del hash puede llegar después)
  await pg.waitForFunction((d) => { const p = __e106.posicionSol({ ...d.fecha, h: 0, min: d.min }); return Math.abs(__e106.escena.alt - p.alt) < 0.3 && !__e106.S.viaje; }, { fecha: e.fecha, min: e.min }, { timeout: 30000, polling: 250 })
    .catch(async () => { console.log('  (el sol no llegó; se repite el salto)', clave, JSON.stringify(await pg.evaluate(() => ({ alt: __e106.escena.alt, pausa: __e106.S.pausa, viaje: !!__e106.S.viaje, fecha: __e106.S.fecha, min: __e106.S.min, modo: __e106.S.modo, diag: JSON.stringify(window.__e106base?.DIAG?.log ?? null).slice(0, 600), cuadros: window.__e106base?.DIAG ? 1 : 0, back: __e106.escena.backend })))); await pg.evaluate((d) => { __e106.viajarA({ ...d, inmediato: true }); }, { fecha: e.fecha, min: e.min, vista: e.vista ?? null, fachada: e.fachada ?? null, lente: e.lente ?? 'foto' }); await esperar(3000); });
  if (e.cam) await pg.evaluate((c) => { const { escena: E, controls } = __e106; E.camera.position.set(...c.pos); controls.target.set(...c.tgt); E.camera.lookAt(controls.target); controls.update(); }, e.cam);
  await esperar(4200);
  const jpg = path.join(CAP, `${ETIQ}_${clave}${MOVIL ? '_movil' : ''}.jpg`);
  await pg.screenshot({ path: jpg, type: 'jpeg', quality: 88 });
  await ctx.close();
  return jpg;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const srv = await servidor(), base = `http://127.0.0.1:${srv.address().port}`;
  const nav = await chromium.launch({ headless: !ARGS.includes('--visible'), args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  try {
    for (const [k, e] of Object.entries(ESCENAS)) { if (SOLO.length && !SOLO.includes(k)) continue; console.log(k, await escena(nav, base, k, e)); }
  } finally { await nav.close(); srv.close(); }
}
