// Vista previa para redes (img/og.jpg, 1200 × 630): el 106 solo, sin nada que derive de Street View ni de Google Maps.
//
// Abre el sitio armado de esta carpeta con ?prueba&rapido, lleva la app a un momento fijo del dato ERA5, oculta todo lo que no es
// el 106 (ver OCULTOS) y dibuja UN cuadro con el reloj congelado, igual que guardia.mjs. Después compone la franja del título en
// una página aparte y guarda el JPEG. No toca ningún GLB ni la app: lo oculto se oculta solo en esta página.
//
//   cd fuente && node og.mjs              escribe ../img/og.jpg
//   cd fuente && node og.mjs --escena=x   guarda además la escena sola (PNG a 2400 × 1260) en x, para revisarla
//   cd fuente && node og.mjs --buscar     lista las tardes secas con menos nubes en ERA5 (para elegir MOMENTO) y no escribe nada
//   --sonda=x,y (píxeles CSS del cuadro de 1200 × 630) dice qué mallas tienen su caja en ese punto; --ocultar=a,b oculta más grupos
//
// Qué se ve y qué no (TERCEROS.md, «Qué depende todavía de Street View o de Google Maps»):
// - se ven el 106 (arquitectura, ventanas, cubiertas, detalles), el suelo del sitio, el cielo y la luz del sol calculado;
// - no se ven `contexto.glb` (La Casa, Innova, Teatro Ateneo, el cerramiento, el 100, el 101, el 107, el quiosco, los
//   estacionamientos, el relieve y el canal), la ciudad ni sus postes (?ciudad=0: no se piden), los árboles (?arboles=0 y el
//   grupo oculto), `entrada.glb` entero (el pórtico va fundido por material con la escalera y los letreros: no se puede aislar,
//   así que se oculta todo el grupo) ni la vegetación de `vegetacion.glb` (setos y palmas: «mejor ningún árbol»);
// - el poste de la esquina (va dentro de una malla de «sitio» junto con el zócalo del 106, así que no se puede ocultar solo; fuste
//   en x 45,6, z 16,4, brazo hasta 11,6 m) cae en el cuadro pero detrás del 106: se revisó con la escena ampliada (--escena). El
//   script dice dónde cae; si cambias la cámara, vuelve a revisarlo;
// - las dos varas finas sobre la cumbrera son del propio 106 (grupo «detalles», en x ±20, z -2, de 12,5 a 17 m), no postes;
// - la malla sin nombre que sale en la lista de visibles es el domo del cielo (caja de ±3000 m);
// - `datos/ciudad_mapa.json` sí se pide (main.js lo usa para la navegación con el teclado), pero no se dibuja.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.resolve(AQUI, '..');
const ARG = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));

// El momento: 29 de febrero de 2020 a las 16:00 (hora de Panamá), estación seca. Se eligió por el dato, no a ojo: es la tarde
// (15 o 16 h) de diciembre a marzo de 2020 a 2025 con menos nubes en ERA5 (0 %), sin lluvia y con DNI de 722 W/m² (`--buscar`
// lista los candidatos). La comprobación de abajo falla si ERA5 da lluvia o poco sol directo a esa hora.
const MOMENTO = { fecha: { y: 2020, m: 2, d: 29 }, min: 16 * 60 };
// La cámara (metros de la escena; +X = noreste, +Z = sureste): desde el oeste, a la altura de una persona sobre un talud,
// mirando la fachada noroeste (la trasera, sin la entrada) y el testero suroeste, que recibe el sol de la tarde.
const CAMARA = { pos: [-62, 6, -48], tgt: [-2, 6.2, -1], fov: 32 };
// Grupos de escena.js que se ocultan (además, ?ciudad=0&arboles=0 hace que la ciudad, sus postes y los árboles no se pidan).
const OCULTOS = ['contexto', 'entrada', 'vegetacion', 'arboles'];
const POSTE_ESQUINA = [45.6, 6, 16.4];
const ANCHO = 2400, ALTO = 1260;   // se dibuja al doble y se reduce a 1200 × 630
const SALIDA = path.join(RAIZ, 'img/og.jpg');

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
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
let salida = 0;
try {
  // 1. La escena
  const ctx = await nav.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 1, timezoneId: 'America/Panama', locale: 'es-PA' });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('e106-visto', '1'); localStorage.setItem('e106-nitidez', '1'); localStorage.removeItem('e106-motor'); } catch (e) { /* nada */ }
    let s = 106; Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  });
  const pg = await ctx.newPage(), errores = [], pedidos = [];
  pg.on('pageerror', (e) => errores.push(String(e).slice(0, 300)));
  pg.on('response', (r) => { if (r.url().startsWith(base)) pedidos.push(r.url().split('?')[0].split('/').pop()); });
  await pg.goto(base + 'index.html?prueba&rapido&ciudad=0&arboles=0&panel=0', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__e106?.escena?.cargado && document.documentElement.classList.contains('listo')
    && !document.documentElement.classList.contains('en-intro') && window.__e106.clima?.horario, null, { timeout: 180000, polling: 250 });
  await pg.evaluate(() => Promise.race([window.__e106.escena.cargaDiferida, new Promise((ok) => setTimeout(ok, 60000))]));
  await esperar(2000);
  if (ARG.buscar) {   // candidatos: tardes de la estación seca (dic a mar) de 2020 a 2025 sin lluvia, por nubes y luego por sol directo
    const lista = await pg.evaluate(() => { const c = [];
      for (let y = 2020; y <= 2025; y++) for (const m of [1, 2, 3, 12]) for (let d = 1; d <= 31; d++) for (const h of [15, 16]) {
        const f = { y, m, d }, r = __e106.clima.registro(f, h * 60); if (r && r.lluvia === 0 && r.dni > 500) c.push({ f: `${y}-${m}-${d} ${h}:00`, nubes: Math.round(r.nubes), dni: Math.round(r.dni), difusa: Math.round(r.difusa) }); }
      return c.sort((a, b) => a.nubes - b.nubes || b.dni - a.dni).slice(0, 15); });
    console.table(lista); throw new Error('solo búsqueda');
  }
  const dato = await pg.evaluate((m) => { __e106.S.pausa = false; __e106.viajarA({ fecha: m.fecha, min: m.min, lente: 'foto', inmediato: true }); return __e106.clima.registro(m.fecha, m.min); }, MOMENTO);
  console.log(`momento ${MOMENTO.fecha.d}/${MOMENTO.fecha.m}/${MOMENTO.fecha.y} ${Math.floor(MOMENTO.min / 60)}:${String(MOMENTO.min % 60).padStart(2, '0')}: ERA5 lluvia ${dato.lluvia} mm, nubes ${Math.round(dato.nubes)} %, DNI ${Math.round(dato.dni)} W/m², difusa ${Math.round(dato.difusa)} W/m²`);
  if (!(dato.lluvia < 0.1) || !(dato.dni > 300)) throw new Error('el momento no es de sol: elige otro');
  await esperar(3000);
  const r = await pg.evaluate(({ c, ocultos, poste }) => {
    const E = __e106.escena, THREE_V = E.camera.position.constructor, cam = E.camera; __e106.S.pausa = true;
    const faltan = [];
    for (const g of ocultos) { const info = E.grupos[g]; if (info) info.root.visible = false; else faltan.push(g); }
    // nada de la ciudad ni de sus postes en la escena
    if (E.ciudad?.raiz) E.ciudad.raiz.visible = false;
    if (E.postes?.raiz) E.postes.raiz.visible = false;
    cam.position.set(...c.pos); cam.fov = c.fov; cam.lookAt(...c.tgt); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    __e106.controls.target.set(...c.tgt);
    // ¿el poste de la esquina cae en el cuadro? (si cae, tiene que quedar detrás del 106)
    const p = new THREE_V(...poste).project(cam), enCuadro = Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && p.z < 1;
    // la interfaz no sale: se captura el lienzo, pero también se esconde por si acaso
    document.body.style.background = '#000';
    const nf = E.renderer._nodes.nodeFrame, pn = performance.now, t0 = nf.time;
    const congelar = () => { nf.time = 0; nf.lastTime = undefined; nf.update(); E.sun.shadow.needsUpdate = true; };
    performance.now = () => 1e6;
    try { congelar(); E._envT = 0; E._envPend = true; E.render(); congelar(); E.render(); }
    finally { performance.now = pn; nf.time = t0; nf.lastTime = pn.call(performance); E._envT = pn.call(performance); }
    const sonda = [];   // --sonda=x,y (píxeles del lienzo): qué mallas visibles tienen su caja en ese punto, de la más chica a la más grande
    if (c.sonda) { const [sx, sy] = c.sonda, nx = sx / innerWidth * 2 - 1, ny = 1 - sy / innerHeight * 2, V = THREE_V;
      E.scene.traverse((o) => { if (!o.isMesh || !o.geometry) return; let v = true, n = o; while (n) { if (!n.visible) { v = false; break; } n = n.parent; } if (!v) return;
        o.geometry.computeBoundingBox?.(); const b = o.geometry.boundingBox; if (!b) return; o.updateMatrixWorld(true);
        let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
        for (let i = 0; i < 8; i++) { const p = new V(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(o.matrixWorld); const w = p.clone(); p.project(cam); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
        if (nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1) { const wb = b.clone().applyMatrix4(o.matrixWorld); sonda.push({ n: o.name, padre: o.parent?.name, area: (x1 - x0) * (y1 - y0), min: wb.min.toArray().map((q) => +q.toFixed(1)), max: wb.max.toArray().map((q) => +q.toFixed(1)) }); } });
      sonda.sort((a, b) => a.area - b.area); }
    const visibles = [];
    const raizDe = new Map(Object.entries(E.grupos).map(([g, i]) => [i.root, g]));
    E.scene.traverse((o) => { if (o.isMesh && o.visible) { let v = true, n = o, g = null; while (n) { if (!n.visible) { v = false; break; } g ??= raizDe.get(n); n = n.parent; } if (v) visibles.push(g ? 'grupo ' + g : (o.name || 'malla sin nombre') + (o.parent?.name ? ` (en ${o.parent.name})` : '')); } });
    return { sonda: sonda.slice(0, 8), url: E.renderer.domElement.toDataURL('image/png'), faltan, poste: { x: p.x, y: p.y, z: p.z, enCuadro }, grupos: Object.keys(E.grupos), visibles: [...new Set(visibles)],
      ciudad: !!E.ciudad, postes: !!E.postes, backend: E.backend, nivel: E.calidad?.nivel, w: E.renderer.domElement.width, h: E.renderer.domElement.height };
  }, { c: { ...CAMARA, sonda: ARG.sonda ? ARG.sonda.split(',').map(Number) : null }, ocultos: ARG.ocultar ? [...OCULTOS, ...ARG.ocultar.split(',')] : OCULTOS, poste: POSTE_ESQUINA });
  if (ARG.sonda) console.log(r.sonda);
  console.log(`${r.backend} · nivel ${r.nivel} · lienzo ${r.w} × ${r.h} · grupos cargados: ${r.grupos.join(', ')}`);
  console.log(`ocultos: ${OCULTOS.filter((g) => !r.faltan.includes(g)).join(', ')}${r.faltan.length ? ` (no cargados: ${r.faltan.join(', ')})` : ''} · raíces con mallas visibles: ${r.visibles.join(', ')}`);
  console.log(`poste de la esquina en pantalla: x ${r.poste.x.toFixed(2)}, y ${r.poste.y.toFixed(2)} (${r.poste.enCuadro ? 'dentro del cuadro: revisar que lo tape el 106' : 'fuera del cuadro'})`);
  const prohibidos = pedidos.filter((f) => /^(ciudad|arboles)/.test(f) && f !== 'ciudad_mapa.json' || f === 'postes.json');   // ciudad_mapa.json es el mapa de la navegación (no se dibuja)
  if (r.ciudad || r.postes || prohibidos.length) throw new Error(`se cargó algo de la ciudad o los árboles: ${prohibidos.join(', ')}`);
  if (errores.length) throw new Error('errores en la página:\n  ' + errores.join('\n  '));
  const escena = Buffer.from(r.url.split(',')[1], 'base64');
  if (ARG.escena) fs.writeFileSync(path.resolve(ARG.escena), escena);
  await ctx.close();

  // 2. La composición: la escena reducida a 1200 × 630 y la franja de abajo (la misma del og.jpg anterior: #0a1216, 132 px,
  // el arco del ícono, Bricolage Grotesque 800 y IBM Plex Mono 500 en mayúsculas). Colores planos, sin degradados.
  const fondo = await sharp(escena).resize(1200, 630, { kernel: 'lanczos3' }).png().toBuffer();
  // el ícono es la marca de la barra del visor (cuerpo.html: viewBox 38 × 22, trazo 1,5 en --cal-3, sol de radio 3 en --sol), a 75 px de ancho
  const icono = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 38 22" width="75" height="43.42"><path d="M3 20 A16 16 0 0 1 35 20" fill="none" stroke="#7f8a86" stroke-width="1.5"/><line x1="0" y1="20" x2="38" y2="20" stroke="#7f8a86" stroke-width="1.5"/><circle cx="19" cy="4" r="3" fill="#f4b545"/></svg>';
  const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=IBM+Plex+Mono:wght@500&display=block">
<style>
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#0a1216}
.fondo{position:absolute;inset:0;width:1200px;height:630px;display:block}
.franja{position:absolute;left:0;right:0;top:498px;height:132px;background:#0a1216}
.icono{position:absolute;left:48px;top:45px;line-height:0}
h1{position:absolute;left:151px;top:22px;margin:0;font:800 57px/1 'Bricolage Grotesque',sans-serif;font-variation-settings:'opsz' 96;color:#f1e8df;letter-spacing:-0.5px;white-space:nowrap}
p{position:absolute;left:151px;top:90px;margin:0;font:500 19px/1 'IBM Plex Mono',monospace;color:#bbc3c5;letter-spacing:1.1px;white-space:nowrap}
</style></head><body>
<img class="fondo" src="data:image/png;base64,${fondo.toString('base64')}">
<div class="franja"><div class="icono">${icono}</div><h1>Edificio 106: sol y lluvia</h1><p>ISTHMUS · CIUDAD DEL SABER, PANAMÁ</p></div>
</body></html>`;
  const ctx2 = await nav.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const pg2 = await ctx2.newPage();
  await pg2.setContent(html, { waitUntil: 'networkidle' });
  await pg2.evaluate(() => document.fonts.ready);
  const letras = await pg2.evaluate(() => [document.fonts.check("800 57px 'Bricolage Grotesque'"), document.fonts.check("500 19px 'IBM Plex Mono'")]);
  if (!letras.every(Boolean)) throw new Error('no llegaron las letras de Google Fonts');
  const png = await pg2.screenshot({ type: 'png' });
  await ctx2.close();
  const jpg = await sharp(png).jpeg({ quality: 88, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer();
  fs.writeFileSync(SALIDA, jpg);
  console.log(`✓ ${path.relative(RAIZ, SALIDA)}: 1200 × 630, ${Math.round(jpg.length / 1024)} KB`);
} catch (e) { console.error('✗', e.message ?? e); salida = 1; }
await nav.close(); srv.close();
process.exit(salida);
