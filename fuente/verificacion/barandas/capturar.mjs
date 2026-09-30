// Capturas de las barandas de los accesos (entrada SE, escalera trasera NO, accesos laterales), para comparar antes y después
// de fuente/barandas.mjs. Sirve el sitio armado de la raíz, abre ?prueba&rapido#m-20260315-1000 y fija la cámara con el gancho.
//   cd fuente && node verificacion/barandas/capturar.mjs antes      (o «despues»; --webgl para WebGL 2)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../..');
const ETIQ = process.argv[2] ?? 'antes', GL = process.argv.includes('--webgl');
const VISTAS = {
  'entrada-frente': { cam: [12.8, 1.75, 21.5], obj: [12.8, 1.5, 13.5] },
  'entrada-oeste': { cam: [7.4, 2.3, 18.2], obj: [12.6, 1.5, 13.6] },
  'entrada-este': { cam: [18.6, 2.3, 18.8], obj: [12.8, 1.5, 13.6] },
  'rampa-este': { cam: [26.5, 2.4, 17.5], obj: [18.5, 1.0, 12.8] },
  'rampa-oeste': { cam: [13.2, 2.6, 17.8], obj: [19.5, 1.0, 12.8] },
  'escalera-trasera': { cam: [-3.3, 1.9, -19.5], obj: [-3.3, 1.0, -13.2] },
  'escalera-trasera-lado': { cam: [0.8, 1.6, -17.0], obj: [-3.3, 0.9, -13.4] },
  'escalera-trasera-remate': { cam: [0.6, 2.5, -14.6], obj: [-2.15, 1.7, -11.7] },
  'rampa-rellano': { cam: [19.6, 2.6, 17.4], obj: [22.4, 1.0, 13.3] },
  'lateral-so-oeste': { cam: [-31.5, 2.3, -1.0], obj: [-25.3, 1.2, -4.7] },
  'lateral-so-sur': { cam: [-27.5, 2.2, 15.5], obj: [-23.6, 1.2, 9.4] },
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
const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'America/Panama', locale: 'es-PA' });
await ctx.addInitScript(() => { try { localStorage.setItem('e106-visto', '1'); localStorage.setItem('e106-nitidez', '1'); localStorage.removeItem('e106-motor'); } catch (e) { /* nada */ } });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => console.error('página:', String(e).slice(0, 300)));
await pg.goto(`http://127.0.0.1:${srv.address().port}/?prueba&rapido${GL ? '&webgl' : ''}#m-20260315-1000`);
await pg.waitForFunction(() => window.__e106?.escena?.cargado && window.__e106.viajarA && document.documentElement.classList.contains('listo')
  && !document.documentElement.classList.contains('en-intro') && /15 de marzo/.test(document.body.innerText), null, { timeout: 180000, polling: 250 });
await new Promise((ok) => setTimeout(ok, 3000));
const salida = path.join(AQUI, ETIQ + (GL ? '-webgl' : '')); fs.mkdirSync(salida, { recursive: true });
// el primer cuadro pausado todavía sale con la vista del vuelo de la app: se dibuja una vez la primera vista y se descarta
for (const [nombre, v] of [['(descartada)', Object.values(VISTAS)[0]], ...Object.entries(VISTAS)]) {
  const url = await pg.evaluate((v) => {
    const E = __e106.escena; __e106.S.pausa = true;
    if (E.grupos.vegetacion) E.grupos.vegetacion.root.visible = false;   // sin palmas ni setos delante de las barandas
    E.camera.fov = 50; E.camera.updateProjectionMatrix();
    E.camera.position.set(...v.cam); E.camera.lookAt(...v.obj); E.camera.updateMatrixWorld(true);
    E.sun.shadow.needsUpdate = true; E.render(); E.render();
    return E.renderer.domElement.toDataURL('image/png');
  }, v);
  if (nombre.startsWith('(')) { await new Promise((ok) => setTimeout(ok, 500)); continue; }
  fs.writeFileSync(path.join(salida, nombre + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  console.log('capturada', nombre);
}
await nav.close(); srv.close();
