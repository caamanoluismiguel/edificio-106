// Capturas de la entrada principal (losa bajo el pórtico, escalera, muretes, pasamanos y rampa), para comparar antes y
// después de fuente/entrada.mjs. «foto» repite el punto y el encuadre de la foto WA0014 (de frente, desde el otro lado de la
// calle; 1280 × 960 como la foto y ~69° de campo horizontal). Sirve el sitio armado de la raíz, abre
// ?prueba&rapido#m-20260315-1000 y fija la cámara con el gancho.
//   cd fuente && node verificacion/entrada/capturar.mjs antes      (o «despues»; --webgl para WebGL 2)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../..');
const ETIQ = process.argv[2] ?? 'antes', GL = process.argv.includes('--webgl');
// cam, obj, campo vertical (°), tamaño; «veg: true» deja la vegetación (la foto tiene la palma a la izquierda)
const VISTAS = {
  'foto': { cam: [12.9, 1.6, 31.0], obj: [12.9, 4.9, 16.0], fov: 55, w: 1280, h: 960, veg: true },
  'foto-sin-vegetacion': { cam: [12.9, 1.6, 31.0], obj: [12.9, 4.9, 16.0], fov: 55, w: 1280, h: 960 },
  'frente-cerca': { cam: [12.8, 1.7, 22.5], obj: [12.8, 1.3, 13.0], fov: 50, w: 1600, h: 1000 },
  'lateral-este': { cam: [21.0, 2.2, 19.5], obj: [12.6, 1.2, 13.6], fov: 50, w: 1600, h: 1000 },
  'lateral-oeste': { cam: [5.2, 1.9, 18.0], obj: [12.8, 1.1, 13.4], fov: 50, w: 1600, h: 1000 },
  'rampa-este': { cam: [26.5, 2.4, 17.5], obj: [18.5, 1.0, 12.8], fov: 50, w: 1600, h: 1000 },
  'planta': { cam: [13.8, 14.0, 17.2], obj: [13.8, 0, 13.6], fov: 50, w: 1600, h: 1000, sinTecho: true },
};
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gz': 'application/gzip', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  let p = path.normalize(path.join(RAIZ, decodeURIComponent(new URL(q.url, 'http://x').pathname)));
  if (!p.startsWith(RAIZ)) { r.writeHead(403); return r.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TIPOS[path.extname(p)] ?? 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const nav = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const salida = path.join(AQUI, ETIQ + (GL ? '-webgl' : '')); fs.mkdirSync(salida, { recursive: true });
// una página por tamaño de ventana (la foto es 4:3)
const tamanos = [...new Set(Object.values(VISTAS).map((v) => `${v.w}x${v.h}`))];
for (const t of tamanos) {
  const [w, h] = t.split('x').map(Number);
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, timezoneId: 'America/Panama', locale: 'es-PA' });
  await ctx.addInitScript(() => { try { localStorage.setItem('e106-visto', '1'); localStorage.setItem('e106-nitidez', '1'); localStorage.removeItem('e106-motor'); } catch (e) { /* nada */ } });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.error('página:', String(e).slice(0, 300)));
  await pg.goto(`http://127.0.0.1:${srv.address().port}/?prueba&rapido${GL ? '&webgl' : ''}#m-20260315-1000`);
  await pg.waitForFunction(() => window.__e106?.escena?.cargado && window.__e106.viajarA && document.documentElement.classList.contains('listo')
    && !document.documentElement.classList.contains('en-intro') && /15 de marzo/.test(document.body.innerText), null, { timeout: 180000, polling: 250 });
  await new Promise((ok) => setTimeout(ok, 3000));
  const lista = Object.entries(VISTAS).filter(([, v]) => v.w === w && v.h === h);
  // el primer cuadro pausado todavía sale con la vista del vuelo de la app: se dibuja una vez la primera vista y se descarta
  for (const [nombre, v] of [['(descartada)', lista[0][1]], ...lista]) {
    const url = await pg.evaluate((v) => {
      const E = __e106.escena; __e106.S.pausa = true;
      if (E.grupos.vegetacion) E.grupos.vegetacion.root.visible = !!v.veg;
      for (const g of ['cubiertas', 'cubiertas_sombra']) if (E.grupos[g]) E.grupos[g].root.visible = !v.sinTecho;
      if (E.grupos.entrada) E.grupos.entrada.root.traverse((o) => { if (o.material && /terracotta|timber/i.test(o.material.name)) o.visible = !v.sinTecho; });
      E.camera.fov = v.fov; E.camera.updateProjectionMatrix();
      E.camera.position.set(...v.cam); E.camera.lookAt(...v.obj); E.camera.updateMatrixWorld(true);
      E.sun.shadow.needsUpdate = true; E.render(); E.render();
      return E.renderer.domElement.toDataURL('image/png');
    }, v);
    if (nombre.startsWith('(')) { await new Promise((ok) => setTimeout(ok, 500)); continue; }
    fs.writeFileSync(path.join(salida, nombre + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log('capturada', nombre);
  }
  await ctx.close();
}
await nav.close(); srv.close();
