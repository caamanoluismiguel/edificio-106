// Franja/cruz en el suelo desde la planta (29/09/2026): z-fighting entre el suelo lejano (CircleGeometry) y la losa de pasto
// de sitio.glb. Captura casos con el gancho ?prueba contra el sitio armado en la raíz (index.html + js/app.js) y, con --mapa,
// cuenta los píxeles que cambian al ocultar el suelo lejano y los ubica en coordenadas de escena (solo cuentan dentro del sitio).
// Uso (desde fuente/): node verificacion/glitch/capturar.mjs [--webgl] [--vista=planta|aerea|esquina] [--casos=viejo,seco,sinSuelo]
//   [--fecha=AAAA-MM-DD-HH:MM] [--cam=x,y,z] [--zoom=f] [--suf=txt] [--sal=dir] [--mapa]   · W=ancho H=alto para la ventana
// «viejo» repone el suelo lejano a −0,05 m (antes del arreglo) en la misma página: antes y después con el mismo paquete.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../..');
const ARGS = process.argv.slice(2);
const GL = ARGS.includes('--webgl');
const VISTA = (ARGS.find((a) => a.startsWith('--vista=')) ?? '--vista=planta').slice(8);
const SAL = (ARGS.find((a) => a.startsWith('--sal=')) ?? '--sal=' + AQUI + '/capturas').slice(6);
const CASOS = (ARGS.find((a) => a.startsWith('--casos=')) ?? '--casos=').slice(8).split(',').filter(Boolean);
const FECHA = (ARGS.find((a) => a.startsWith('--fecha=')) ?? '--fecha=2026-09-29-10:03').slice(8);
fs.mkdirSync(SAL, { recursive: true });
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gz': 'application/gzip', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => {
  let p = path.normalize(path.join(RAIZ, decodeURIComponent(new URL(q.url, 'http://x').pathname)));
  if (!p.startsWith(RAIZ)) { r.writeHead(403); return r.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TIPOS[path.extname(p).toLowerCase()] ?? 'application/octet-stream' });
  fs.createReadStream(p).pipe(r);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const port = srv.address().port;
const nav = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const ctx = await nav.newContext({ viewport: { width: +(process.env.W ?? 1600), height: +(process.env.H ?? 1000) }, deviceScaleFactor: 1, timezoneId: 'America/Panama', locale: 'es-PA' });
await ctx.addInitScript(() => { try { localStorage.setItem('e106-visto', '1'); localStorage.setItem('e106-nitidez', '1'); } catch (e) {} });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 300)));
await pg.goto(`http://127.0.0.1:${port}/?prueba${GL ? '&webgl' : ''}`);
await pg.waitForFunction(() => window.__e106?.escena?.cargado && document.documentElement.classList.contains('listo') && !document.documentElement.classList.contains('en-intro') && window.__e106.clima?.horario, null, { timeout: 180000, polling: 250 });
const [fy, fm, fd, hm] = FECHA.split('-'); const [hh, mi] = hm.split(':').map(Number);
await pg.evaluate(([v, f, min]) => { __e106.S.pausa = false; __e106.viajarA({ fecha: f, min, vista: v, lente: 'foto', inmediato: true }); }, [VISTA, { y: +fy, m: +fm, d: +fd }, hh * 60 + mi]);
await new Promise((ok) => setTimeout(ok, 4000));
const ZOOM = +((ARGS.find((a) => a.startsWith('--zoom=')) ?? '--zoom=1').slice(7));
if (ZOOM !== 1) { await pg.evaluate((z) => { const c = __e106.controls, cam = __e106.escena.camera; cam.position.sub(c.target).multiplyScalar(z).add(c.target); cam.updateMatrixWorld(); }, ZOOM); await new Promise((ok) => setTimeout(ok, 800)); }
const CAM = (ARGS.find((a) => a.startsWith('--cam=')) ?? '').slice(6);
if (CAM) { await pg.evaluate((c) => { const [x, y, z] = c.split(',').map(Number); const ct = __e106.controls, cam = __e106.escena.camera; ct.target.set(0, 0, 0); cam.position.set(x, y, z); cam.lookAt(0, 0, 0); ct.update(); cam.updateMatrixWorld(); }, CAM); await new Promise((ok) => setTimeout(ok, 800)); }
const SUF = (ARGS.find((a) => a.startsWith('--suf=')) ?? '--suf=').slice(6);
console.log(await pg.evaluate(() => ({ backend: __e106.escena.backend, cam: __e106.escena.camera.position.toArray().map((x) => +x.toFixed(1)), lluvia: __e106.U.lluvia.value, mojado: __e106.U.mojado.value })));

if (ARGS.includes('--rayos')) {
  const pts = [[100,150],[300,300],[1070,305],[870,625],[1000,900],[400,850],[800,50]];
  const r = await pg.evaluate((pts) => {
    const E = __e106.escena, cam = E.camera; cam.updateMatrixWorld();
    const out = [];
    const metas = [];
    E.scene.traverse((o) => { if (!o.isMesh || !o.geometry?.attributes?.position) return; const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox.clone().applyMatrix4(o.matrixWorld); metas.push([o, b]); });
    for (const [px, py] of pts) {
      const v = cam.position.clone().set(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1, 0.5).unproject(cam);
      const d = v.sub(cam.position).normalize(); const t = -cam.position.y / d.y; const x = cam.position.x + d.x * t, z = cam.position.z + d.z * t;
      const hits = metas.filter(([o, b]) => x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z && b.min.y < 1.0 && b.max.y - b.min.y < 3 && o.visible)
        .map(([o, b]) => `${o.name}|${o.material?.name}|y ${b.min.y.toFixed(3)}..${b.max.y.toFixed(3)}|ro ${o.renderOrder}|poff ${o.material?.polygonOffset}`);
      out.push({ px, py, x: +x.toFixed(1), z: +z.toFixed(1), hits });
    }
    return out;
  }, pts);
  console.log(JSON.stringify(r, null, 1));
}
if (ARGS.includes('--suelos')) {
  console.log(JSON.stringify(await pg.evaluate(() => { const out = []; __e106.escena.scene.traverse((o) => { if (!o.isMesh || !o.geometry?.attributes?.position) return; const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (b.min.y < 0.2 && b.max.y - b.min.y < 1.5) out.push(`${o.name || o.geometry.type}|${o.material?.name}|x ${b.min.x.toFixed(1)}..${b.max.x.toFixed(1)} y ${b.min.y.toFixed(3)}..${b.max.y.toFixed(3)} z ${b.min.z.toFixed(1)}..${b.max.z.toFixed(1)}|vis ${o.visible}`); }); return out; }), null, 1));
}
// cada caso: [nombre, cuerpo de prep(E, U)]
const todos = {
  base: '',
  seco: 'U.lluvia.value = 0; U.mojado.value = 0;',
  mojado: 'U.lluvia.value = 0; U.mojado.value = 1;',
  llovizna: 'U.lluvia.value = 0.25; U.mojado.value = 1;',
  lluviaSinGotas: 'U.lluvia.value = 0.25; U.mojado.value = 1; E.__ocultar = ["lluviaSpr"];',
  lluviaSinSalp: 'U.lluvia.value = 0.25; U.mojado.value = 1; E.__ocultar = ["salpicaduras"];',
  lluviaSinAleros: 'U.lluvia.value = 0.25; U.mojado.value = 1; E.__ocultar = ["aleros"];',
  lluviaSeco: 'U.lluvia.value = 0.25; U.mojado.value = 0;',
  sinSuelo: 'E.suelo.visible = false;',
  sueloBajo: 'E.suelo.position.y = -0.6; E.suelo.updateMatrixWorld();',
  sinNubes: 'U.nubeSombra.value = 0;',
  viejo: 'E.suelo.position.y = -0.05; E.suelo.updateMatrixWorld();',
  nublado: 'U.cubierto.value = 1; U.nubeCob.value = 1; U.mojado.value = 1;',
  nubladoSinNubes: 'U.cubierto.value = 1; U.nubeCob.value = 1; U.mojado.value = 1; U.nubeSombra.value = 0;',
  nubladoSinSuelo: 'U.cubierto.value = 1; U.nubeCob.value = 1; U.mojado.value = 1; E.suelo.visible = false;',
  nubladoSinContexto: 'U.cubierto.value = 1; U.nubeCob.value = 1; U.mojado.value = 1; E.grupos.contexto.root.visible = false;',
  sinTerreno: 'U.cubierto.value = 1; U.nubeCob.value = 1; U.mojado.value = 1; E.scene.traverse((o) => { if (/terreno|entorno/.test(o.name)) o.visible = false; });',
  sinPastoNO: 'U.cubierto.value = 1; U.nubeCob.value = 1; U.mojado.value = 1; E.scene.traverse((o) => { if (o.isMesh && /distant park turf/.test(o.material?.name || "")) o.visible = false; });',
  nubesFuertes: 'U.nubeSombra.value = 1; U.nubeCob.value = 0.5; U.lluvia.value = 0; U.mojado.value = 0;',
  nubesFuertes7: 'U.nubeSombra.value = 1; U.nubeCob.value = 0.7; U.lluvia.value = 0; U.mojado.value = 0;',
  seco2: 'U.lluvia.value = 0; U.mojado.value = 0;',
  secoSinSueloA: 'U.lluvia.value = 0; U.mojado.value = 0; E.suelo.visible = false;',
  secoSinSueloB: 'U.lluvia.value = 0; U.mojado.value = 0; E.suelo.visible = false;',
  secoSinNubesA: 'U.lluvia.value = 0; U.mojado.value = 0; U.nubeSombra.value = 0;',
  secoSinNubesB: 'U.lluvia.value = 0; U.mojado.value = 0; U.nubeSombra.value = 0;',
  sinNiebla: 'U.lluvia.value = 0.25; U.mojado.value = 1; E.scene.fog.near = 1e5; E.scene.fog.far = 2e5;',
};
const lista = CASOS.length ? CASOS : Object.keys(todos);
for (const n of lista) {
  const url = await pg.evaluate((body) => {
    const E = __e106.escena, U = __e106.U; __e106.S.pausa = true;
    E.__ocultar = []; E.__y0 ??= E.suelo.position.y;
    (0, eval)(`(function(E,U){${body}})`)(E, U);
    // render() pone visible según U.lluvia: se sacan de la escena los que se apagan
    const quitados = (E.__ocultar ?? []).map((k) => E[k]).filter(Boolean);
    for (const o of quitados) E.scene.remove(o);
    E.render();
    E.suelo.visible = true; E.suelo.position.y = -0.5; E.suelo.updateMatrixWorld();
    const d = E.renderer.domElement.toDataURL('image/png');
    for (const o of quitados) E.scene.add(o);
    return d;
  }, todos[n] ?? n);
  fs.writeFileSync(path.join(SAL, `${VISTA}${SUF}${GL ? '-gl' : ''}-${n}.png`), Buffer.from(url.split(',')[1], 'base64'));
  console.log('ok', n);
}
if (ARGS.includes('--mapa')) {
  const sharp = createRequire(import.meta.url)('sharp');
  const f = (n) => path.join(SAL, `${VISTA}${SUF}${GL ? '-gl' : ''}-${n}.png`);
  const A = await sharp(process.env.MAPA_A ?? f(lista.find((n) => n !== 'sinSuelo') ?? 'seco')).raw().toBuffer({ resolveWithObject: true }), B = await sharp(f('sinSuelo')).raw().toBuffer();
  const { width: w, height: h, channels: c } = A.info; const pts = [];
  let tot = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * c; let d = 0; for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(A.data[i + k] - B[i + k])); if (d > 12) { tot++; if ((x % 4 === 0) && (y % 4 === 0)) pts.push([x, y]); } }
  const xz = await pg.evaluate((pts) => { const cam = __e106.escena.camera; cam.updateMatrixWorld(); return pts.map(([px, py]) => { const v = cam.position.clone().set(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1, 0.5).unproject(cam); const d = v.sub(cam.position).normalize(); const t = -cam.position.y / d.y; return [cam.position.x + d.x * t, cam.position.z + d.z * t]; }); }, pts);
  const hx = {}, hz = {}; for (const [x, z] of xz) { const bx = Math.round(x / 2) * 2, bz = Math.round(z / 2) * 2; hx[bx] = (hx[bx] ?? 0) + 1; hz[bz] = (hz[bz] ?? 0) + 1; }
  const top = (hh) => Object.entries(hh).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join(' ');
  const dentro = xz.filter(([x, z]) => Math.abs(x) < 178 && Math.abs(z) < 158).length; console.log(`dentro del sitio (±178 × ±158 m): ${dentro} de ${Math.ceil(w / 4) * Math.ceil(h / 4)} muestras = ${(100 * dentro / (Math.ceil(w / 4) * Math.ceil(h / 4))).toFixed(2)} % de la pantalla`);
  console.log(`px distintos ${(100 * tot / (w * h)).toFixed(2)} %; muestras ${xz.length}`);
  console.log('x más frecuentes (m, bin 2 m):', top(hx)); console.log('z más frecuentes:', top(hz));
}
await nav.close(); srv.close();
