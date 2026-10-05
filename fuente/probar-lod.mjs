// Prueba del nivel de detalle de la ciudad con la cámara en movimiento (PANEL.md S10, CIUDAD-PLAN §27). Abre el sitio armado de
// esta carpeta (computador, WebGPU o con --webgl WebGL 2), con la ciudad en el nivel completo, y:
//   1. lleva la cámara desde el 106 hasta 700 m y de vuelta, en pasos de 2 m, cruzando los umbrales de 100 m (casas bajas),
//      150 m (alto) y 400 m (medio) de cientos de edificios: en cada paso, ningún edificio del kit puede quedar sin ninguna
//      parte visible (el 184 no trae muro en el nivel lejos: lo dibujan su vidrio y su techo);
//   2. va y viene ±3 m alrededor del umbral de 150 m del 101, 40 veces, entrando desde cerca (queda en alto) y desde lejos
//      (queda en medio): con la histéresis de ciudad.js no cambia nada;
//   3. en 6 paradas, con la cámara quieta, dibuja el cuadro, suelta el detalle alto (todo lo cercano pasa al medio) y lo vuelve a
//      dibujar: el 106 en pantalla (su caja proyectada) no puede cambiar ni un píxel (sobre 8 niveles), ni su sombra.
// Uso: cd fuente && node probar-lod.mjs [--webgl]   código de salida 0 si pasa, 1 si algo falla
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.resolve(AQUI, '..'), GL = process.argv.includes('--webgl');
const SALIDA = path.join(AQUI, 'verificacion', 'lod', GL ? 'webgl' : 'webgpu'); fs.mkdirSync(SALIDA, { recursive: true });
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gz': 'application/gzip', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  let p = path.normalize(path.join(RAIZ, decodeURIComponent(new URL(q.url, 'http://x').pathname)));
  if (!p.startsWith(RAIZ)) { r.writeHead(403); return r.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TIPOS[path.extname(p).toLowerCase()] ?? 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const nav = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, timezoneId: 'America/Panama', locale: 'es-PA' });
await ctx.addInitScript(() => { try { localStorage.setItem('e106-visto', '1'); localStorage.setItem('e106-nitidez', '1'); } catch (e) { /* nada */ } });
const pg = await ctx.newPage(), errores = [];
pg.on('pageerror', (e) => errores.push(String(e).slice(0, 300)));
pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 300)); });
let falla = false;
const res = {};
try {
  await pg.goto(`http://127.0.0.1:${srv.address().port}/index.html?prueba&rapido&ciudadnivel=completo${GL ? '&webgl' : ''}`);
  await pg.waitForFunction(() => window.__e106?.escena?.cargado && document.documentElement.classList.contains('listo') && !document.documentElement.classList.contains('en-intro'), null, { timeout: 180000, polling: 250 });
  await pg.evaluate(() => Promise.race([__e106.escena.cargaCiudad, new Promise((ok) => setTimeout(ok, 120000))]));
  await pg.evaluate(() => { __e106.S.pausa = false; __e106.viajarA({ fecha: { y: 2024, m: 1, d: 15 }, min: 8 * 60 + 15, lente: 'foto', vista: 'aerea', inmediato: true }); });
  await pg.waitForTimeout(3000);

  // 1 y 2: recorrido y vaivén (todo en la página, sin capturas)
  Object.assign(res, await pg.evaluate(() => {
    const E = __e106.escena, Cd = E.ciudad, cam = E.camera; __e106.S.pausa = true;
    const edificios = new Map();   // edificio -> sus lotes (sin las partes de solo cerca)
    for (const l of Cd.lotes) if (!l.cerca) { const a = edificios.get(l.n) ?? []; a.push(l); edificios.set(l.n, a); }
    const sinMuro = () => { const out = []; for (const [n, ls] of edificios) if (!ls.some((l) => l.actual && l.actual !== 'oculto' && l.ids[l.actual] !== undefined)) out.push(n.name); return out; };
    const cuenta = () => Object.fromEntries(['alto', 'medio', 'lejos'].map((k) => [k, Cd.lotes.filter((l) => l.actual === k).length]));
    const dir = { x: 0.62, y: 0.25, z: 0.74 }, tgt = [0, 3, 0], pasos = [];
    for (let d = 20; d <= 700; d += 2) pasos.push(d);
    for (let d = 700; d >= 20; d -= 2) pasos.push(d);
    let cambios = 0, peor = [], visto = { alto: 0, medio: 0, lejos: 0 };
    for (const d of pasos) {
      cam.position.set(dir.x * d, 2 + dir.y * d, dir.z * d); cam.lookAt(...tgt); cam.updateMatrixWorld(true);
      if (Cd.actualizar(cam)) cambios++;
      const s = sinMuro(); if (s.length && peor.length < 5) peor.push({ d, faltan: s.slice(0, 5), n: s.length });
      const c = cuenta(); for (const k in visto) visto[k] = Math.max(visto[k], c[k]);
    }
    // vaivén alrededor del umbral del alto del 101 (150 m de su centro), por la recta que une el centro con el 106
    const l101 = Cd.lotes.find((l) => /386353666/.test(l.n.name) && l.B.name.includes('· muro ·'));
    const c = l101.c, u = { x: -c.x, z: -c.z }, m = Math.hypot(u.x, u.z); u.x /= m; u.z /= m;
    const umbral = l101.n.userData.lodAlto ?? Cd.lod.alto, ida = [];
    let vaivenes = 0;
    const poner = (d) => { cam.position.set(c.x + u.x * d, c.y, c.z + u.z * d); cam.lookAt(c.x, c.y, c.z); cam.updateMatrixWorld(true); Cd.actualizar(cam); return l101.actual; };
    for (const desde of [umbral - 30, umbral + 30]) {
      const inicio = poner(desde); ida.push(inicio);
      for (let i = 0; i < 40; i++) if (poner(umbral + (i % 2 ? 3 : -3)) !== inicio) vaivenes++;
    }
    return { recorrido: { pasos: pasos.length, cuadrosConCambio: cambios, edificiosSinMuro: peor, maximoPorNivel: visto }, vaiven: { umbral, idas: 40, cambiosDel101: vaivenes, primeros: ida } };
  }));
  if (res.recorrido.edificiosSinMuro.length) falla = true;
  if (res.vaiven.cambiosDel101 > 0) falla = true;

  // 3: paradas con la cámara quieta: el 106 no cambia al soltar el detalle alto
  // la última es el control: frente al 101 a 40 m, mirándolo; ahí el cambio de detalle tiene que verse (si no, la prueba no mide)
  const paradas = [{ pos: [60, 25, 50] }, { pos: [140, 50, 90] }, { pos: [-120, 40, -60] }, { pos: [30, 8, 160] }, { pos: [200, 90, -150] }, { pos: [-60, 20, 150] }, { pos: [130, 12, -110], mira: [98, 7, -141], control: true }];
  res.paradas = [];
  for (const [i, p] of paradas.entries()) {
    const r = await pg.evaluate(async (p) => {
      const E = __e106.escena, cam = E.camera, Cd = E.ciudad; __e106.S.pausa = true;
      cam.position.set(...p.pos); cam.lookAt(...(p.mira ?? [5, 5, 0])); cam.updateMatrixWorld(true); E.setAlejamiento(cam.position.length());
      const d0 = E.uDesenfoque.value; E.uDesenfoque.value = 0;
      // un cuadro nuevo en su propia vuelta de requestAnimationFrame: dos capturas en la misma tarea devolvían el mismo lienzo
      // y con el reloj de los sombreadores congelado, como en guardia.mjs (grano, vegetación y nubes se mueven con el tiempo)
      const cuadro = async () => {
        await new Promise((ok) => requestAnimationFrame(ok));
        const nf = E.renderer._nodes.nodeFrame, pn = performance.now, t0 = nf.time;
        const congelar = () => { nf.time = 0; nf.lastTime = undefined; nf.update(); E.sun.shadow.needsUpdate = true; };
        performance.now = () => 1e6;
        try { congelar(); E._envT = 0; E._envPend = true; E.render(); congelar(); E.render(); }
        finally { performance.now = pn; nf.time = t0; nf.lastTime = pn.call(performance); E._envT = pn.call(performance); }
        return E.renderer.domElement.toDataURL('image/png');
      };
      Cd.usarAlto(true); const a = await cuadro(); const altos = Cd.lotes.filter((l) => l.actual === 'alto').length;
      Cd.usarAlto(false); const b = await cuadro(); const altosDespues = Cd.lotes.filter((l) => l.actual === 'alto').length;
      Cd.usarAlto(true); E.render(); E.uDesenfoque.value = d0;
      // caja del 106 en pantalla (las 8 esquinas de main.js)
      const W = E.renderer.domElement.width, H = E.renderer.domElement.height; let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (const v of __e106.esq106()) { const q = v.clone().project(cam); x0 = Math.min(x0, (q.x + 1) / 2 * W); x1 = Math.max(x1, (q.x + 1) / 2 * W); y0 = Math.min(y0, (1 - q.y) / 2 * H); y1 = Math.max(y1, (1 - q.y) / 2 * H); }
      return { a, b, altos, altosDespues, caja: [x0, y0, x1, y1].map(Math.round), W, H };
    }, p);
    const [x0, y0, x1, y1] = [Math.max(0, r.caja[0]), Math.max(0, r.caja[1]), Math.min(r.W, r.caja[2]), Math.min(r.H, r.caja[3])];
    const recorte = (u) => sharp(Buffer.from(u.split(',')[1], 'base64')).extract({ left: x0, top: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) }).raw().ensureAlpha().toBuffer();
    const [A, B] = await Promise.all([recorte(r.a), recorte(r.b)]);
    let px = 0, max = 0; for (let k = 0; k < A.length; k += 4) { const d = Math.max(Math.abs(A[k] - B[k]), Math.abs(A[k + 1] - B[k + 1]), Math.abs(A[k + 2] - B[k + 2])); if (d > max) max = d; if (d > 8) px++; }
    // y en todo el cuadro, para ver que el cambio de detalle sí pasó (los edificios cercanos cambian)
    const [FA, FB] = await Promise.all([r.a, r.b].map((u) => sharp(Buffer.from(u.split(',')[1], 'base64')).raw().ensureAlpha().toBuffer()));
    let pxTodo = 0, pxTodo1 = 0; for (let k = 0; k < FA.length; k += 4) { const d = Math.max(Math.abs(FA[k] - FB[k]), Math.abs(FA[k + 1] - FB[k + 1]), Math.abs(FA[k + 2] - FB[k + 2])); if (d > 8) pxTodo++; if (d > 0) pxTodo1++; }
    if (p.control && !pxTodo) falla = true;
    if (p.control) px = 0;             // el 106 queda detrás de la cámara: su caja proyectada no vale
    if (px) { falla = true; fs.writeFileSync(path.join(SALIDA, `parada-${i}-alto.png`), Buffer.from(r.a.split(',')[1], 'base64')); fs.writeFileSync(path.join(SALIDA, `parada-${i}-medio.png`), Buffer.from(r.b.split(',')[1], 'base64')); }
    res.paradas.push({ control: !!p.control, pos: p.pos, caja106: [x0, y0, x1, y1], edificiosEnAlto: r.altos, despues: r.altosDespues, px106: px, maxNivel106: max, pxCuadro: pxTodo, pxCuadroAlgo: pxTodo1 });
  }
} catch (e) { errores.push('script: ' + String(e?.stack ?? e).slice(0, 400)); falla = true; }
finally { await nav.close(); srv.close(); }
if (errores.length) falla = true;
res.errores = errores;
fs.writeFileSync(path.join(SALIDA, 'informe.json'), JSON.stringify(res, null, 1));
const R = res.recorrido, V = res.vaiven;
if (V && (V.primeros[0] !== 'alto' || V.primeros[1] !== 'medio')) falla = true;
if (R) console.log(`${R.edificiosSinMuro.length ? '✗' : '✓'} recorrido de 20 a 700 m y de vuelta (${R.pasos} pasos, ${R.cuadrosConCambio} con cambio de detalle; a la vez hasta ${R.maximoPorNivel.alto} partes en alto, ${R.maximoPorNivel.medio} en medio y ${R.maximoPorNivel.lejos} en lejos): ${R.edificiosSinMuro.length ? 'EDIFICIOS SIN NINGUNA PARTE ' + JSON.stringify(R.edificiosSinMuro) : 'ningún edificio desaparece'}`);
if (V) console.log(`${V.cambiosDel101 ? '✗' : '✓'} vaivén de ±3 m sobre el umbral de ${V.umbral} m del 101, ${V.idas} veces: ${V.cambiosDel101} cambios (${V.primeros.join(' y ')} al empezar desde cerca y desde lejos)`);
for (const p of res.paradas ?? []) console.log(`${p.px106 || (p.control && !p.pxCuadro) ? '✗' : '✓'} ${p.control ? 'control (frente al 101)' : 'parada'} ${p.pos.join(', ')}: ${p.control ? '' : `106 ${p.px106} px sobre 8 niveles (máx ${p.maxNivel106}) `}al pasar ${p.edificiosEnAlto} partes de alto a medio (quedan ${p.despues}); en todo el cuadro cambian ${p.pxCuadro} px sobre 8 niveles y ${p.pxCuadroAlgo} en algo`);
if (errores.length) console.log('errores:', errores.slice(0, 5));
console.log(falla ? 'RESULTADO: FALLA' : 'RESULTADO: el detalle cambia sin saltos del 106 ni edificios perdidos');
process.exit(falla ? 1 : 0);
