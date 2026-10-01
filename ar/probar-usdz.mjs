// Vuelve a abrir ar/quicklook/edificio-106.usdz con USDLoader de three en Chromium y lo compara con los GLB de ar/modelo:
// caja en metros (llevada a escala real), triángulos y mallas. Guarda una captura con los dos lado a lado.
// Pasa si la caja difiere en ≤ 2 cm (a escala real) y los triángulos son los mismos.
// Uso: node ar/probar-usdz.mjs [--escala=200] [--captura=ruta.png]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'fuente', 'package.json'))('playwright');
const arg = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const ESCALA = Number(arg.escala ?? 200);
const CAPTURA = path.resolve(arg.captura ?? path.join(os.tmpdir(), 'prueba-usdz.png'));
const TIPOS = { '.js': 'text/javascript', '.html': 'text/html', '.glb': 'model/gltf-binary', '.usdz': 'model/vnd.usdz+zip', '.wasm': 'application/wasm' };

const pagina = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#eceae4">
<script type="importmap">{"imports":{"three":"/fuente/node_modules/three/build/three.module.js","three/addons/":"/fuente/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { USDLoader } from 'three/addons/loaders/USDLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const ESCALA = ${ESCALA};
const GRUPOS = ['arquitectura', 'cubiertas', 'detalles', 'entrada', 'ventanas'];
const W = 1400, H = 700;
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(W, H); r.setScissorTest(true); document.body.appendChild(r.domElement);
function tri(o) { let t = 0, m = 0; o.traverse(x => { if (x.isMesh) { m++; const g = x.geometry; t += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return { t, m }; }
function escena(obj) {
  const s = new THREE.Scene(); s.background = new THREE.Color(0xeceae4);
  s.add(new THREE.HemisphereLight(0xffffff, 0x8a8577, 2.2));
  const d = new THREE.DirectionalLight(0xffffff, 2.5); d.position.set(-1, 2, 1.5); s.add(d);
  s.add(obj); return s;
}
await MeshoptDecoder.ready;
const gl = new GLTFLoader(); gl.setMeshoptDecoder(MeshoptDecoder);
const glb = new THREE.Group();
for (const g of GRUPOS) glb.add((await gl.loadAsync('/ar/modelo/' + g + '.glb')).scene);
// los GLB a la misma escala y posición que el USDZ: centrados en x y z, suelo en y = 0
const c0 = new THREE.Box3().setFromObject(glb), ctr = c0.getCenter(new THREE.Vector3());
const maqueta = new THREE.Group(); maqueta.add(glb); glb.position.set(-ctr.x, -c0.min.y, -ctr.z); maqueta.scale.setScalar(1 / ESCALA);
const usd = await new USDLoader().loadAsync('/ar/quicklook/edificio-106.usdz');
// USDLoader lee diffuseColor como sRGB, pero UsdPreviewSurface (y USDZExporter, y Quick Look) lo tratan como lineal:
// se deshace esa conversión para que la captura muestre los colores que verá el iPhone
usd.traverse(x => { if (x.isMesh) x.material.color.convertLinearToSRGB(); });
const cU = new THREE.Box3().setFromObject(usd), cG = new THREE.Box3().setFromObject(maqueta);
const cam = new THREE.PerspectiveCamera(32, (W / 2) / H, 0.01, 10);
cam.position.set(0.32, 0.26, 0.42); cam.lookAt(0, 0.02, 0);
const sG = escena(maqueta), sU = escena(usd);
r.setViewport(0, 0, W / 2, H); r.setScissor(0, 0, W / 2, H); r.render(sG, cam);
r.setViewport(W / 2, 0, W / 2, H); r.setScissor(W / 2, 0, W / 2, H); r.render(sU, cam);
const tr = o => ({ min: o.min.toArray(), max: o.max.toArray() });
window.__res = { usd: { caja: tr(cU), ...tri(usd) }, glb: { caja: tr(cG), ...tri(glb) },
  transparentes: (() => { let n = 0; usd.traverse(x => { if (x.isMesh && x.material.transparent) n++; }); return n; })() };
</script>`;

const nav = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await nav.newPage({ viewport: { width: 1400, height: 700 } });
const errores = [];
p.on('pageerror', e => errores.push(String(e)));
p.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
await p.route('http://e106.local/**', async ruta => {
  const u = new URL(ruta.request().url());
  if (u.pathname === '/') return ruta.fulfill({ contentType: 'text/html', body: pagina });
  const f = path.join(raiz, decodeURIComponent(u.pathname));
  if (!f.startsWith(raiz) || !fs.existsSync(f)) return ruta.fulfill({ status: 404, body: '' });
  ruta.fulfill({ contentType: TIPOS[path.extname(f)] ?? 'application/octet-stream', body: fs.readFileSync(f) });
});
await p.goto('http://e106.local/');
await p.waitForFunction(() => window.__res || null, null, { timeout: 120000 }).catch(() => {});
const res = await p.evaluate(() => window.__res);
if (res) { fs.mkdirSync(path.dirname(CAPTURA), { recursive: true }); await p.screenshot({ path: CAPTURA }); }
await nav.close();
if (!res) { console.error('no cargó:', errores.join('\n')); process.exit(1); }

const real = v => v.map(x => x * ESCALA);
const dif = Math.max(...[0, 1, 2].flatMap(i => [Math.abs(res.usd.caja.min[i] - res.glb.caja.min[i]), Math.abs(res.usd.caja.max[i] - res.glb.caja.max[i])])) * ESCALA;
const tam = c => [0, 1, 2].map(i => (c.max[i] - c.min[i]));
console.log(`GLB:  ${res.glb.m} mallas, ${res.glb.t} triángulos, caja a escala real ${real(tam(res.glb.caja)).map(v => v.toFixed(3)).join(' × ')} m`);
console.log(`USDZ: ${res.usd.m} mallas (${res.transparentes} transparentes), ${res.usd.t} triángulos, caja a escala real ${real(tam(res.usd.caja)).map(v => v.toFixed(3)).join(' × ')} m; suelo en y = ${(res.usd.caja.min[1] * 1000).toFixed(3)} mm`);
console.log(`diferencia máxima de la caja: ${(dif * 100).toFixed(2)} cm a escala real; errores en la consola: ${errores.length}`);
console.log(`captura: ${CAPTURA} (izquierda los GLB, derecha el USDZ)`);
const ok = dif <= 0.02 && res.usd.t === res.glb.t && Math.abs(res.usd.caja.min[1]) < 1e-6 && errores.length === 0;
console.log(ok ? 'USDZ: pasa' : 'USDZ: NO pasa');
process.exit(ok ? 0 : 1);
