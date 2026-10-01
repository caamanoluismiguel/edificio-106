// Genera ar/quicklook/edificio-106.usdz para AR Quick Look en iPhone y iPad: el 106 sobre la mesa, sin tarjeta.
// Parte de los mismos GLB de ar/modelo (copias byte a byte de los del sitio) y no abre ningún .blend.
//
// Qué hace:
//   1. carga los cinco GLB con GLTFLoader y el decodificador meshopt de three (en Node, sin navegador);
//   2. hornea la transformación de cada malla y junta las mallas que comparten material (menos prims, archivo más chico);
//   3. pasa todo a escala de maqueta (1:200 por defecto), con el edificio centrado en el origen y el suelo en y = 0;
//   4. el vidrio con transmisión queda como transparencia simple (opacidad 0,35), igual que en la AR con tarjeta;
//   5. exporta con USDZExporter de three (metersPerUnit = 1, Y arriba, anclaje a un plano horizontal);
//   6. si están usdcat y usdzip (vienen con macOS en /usr/bin), pasa la USDA de texto a binario (usdc): de unos
//      13,5 MB a unos 3,7 MB, con la misma geometría. Con --texto, o sin esas herramientas, queda la versión de texto.
//
// Uso: node ar/generar-usdz.mjs [--escala=200] [--texto] [--salida=ar/quicklook/edificio-106.usdz]
// Pide three en fuente/node_modules (puede ser un enlace simbólico a otro worktree; no se comitea).
// La fecha de los archivos dentro del zip va fija, así que con los mismos GLB sale el mismo archivo byte a byte.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, '..');
const nm = path.join(raiz, 'fuente', 'node_modules', 'three');
if (!fs.existsSync(nm)) { console.error('Falta fuente/node_modules/three (enlázalo desde el checkout principal).'); process.exit(2); }

const THREE = await import(path.join(nm, 'build', 'three.module.js'));
const { GLTFLoader } = await import(path.join(nm, 'examples', 'jsm', 'loaders', 'GLTFLoader.js'));
const { MeshoptDecoder } = await import(path.join(nm, 'examples', 'jsm', 'libs', 'meshopt_decoder.module.js'));
const { USDZExporter } = await import(path.join(nm, 'examples', 'jsm', 'exporters', 'USDZExporter.js'));
const { mergeGeometries } = await import(path.join(nm, 'examples', 'jsm', 'utils', 'BufferGeometryUtils.js'));
const { unzipSync } = await import(path.join(nm, 'examples', 'jsm', 'libs', 'fflate.module.js'));

const arg = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const ESCALA = Number(arg.escala ?? 200);                 // 1:200: el conjunto (68,9 × 43,6 m, con la entrada y el letrero) queda de 34 × 22 cm
const SALIDA = path.resolve(raiz, arg.salida ?? 'ar/quicklook/edificio-106.usdz');
const GRUPOS = ['arquitectura', 'cubiertas', 'detalles', 'entrada', 'ventanas'];   // los mismos que EDIFICIO en escena-ar.js
const OPACIDAD_VIDRIO = 0.35;
const FECHA_ZIP = new Date(Date.UTC(2026, 9, 1, 12, 0, 0));
if (!(ESCALA > 0)) { console.error('--escala tiene que ser un número positivo'); process.exit(2); }

// 1. cargar
await MeshoptDecoder.ready;
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
async function cargar(nombre) {
  const buf = fs.readFileSync(path.join(aqui, 'modelo', `${nombre}.glb`));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((ok, mal) => loader.parse(ab, '', ok, mal));
}
const partes = await Promise.all(GRUPOS.map(cargar));

// 2. hornear y agrupar por material
function materialUSD(m) {
  const vidrio = (m.transmission ?? 0) > 0;
  const s = new THREE.MeshStandardMaterial({
    name: m.name,
    color: m.color ? m.color.clone() : new THREE.Color(1, 1, 1),
    roughness: vidrio ? 0.05 : (m.roughness ?? 1),
    metalness: vidrio ? 0 : (m.metalness ?? 0),
    side: m.side,
  });
  if (m.emissive && !vidrio) { s.emissive.copy(m.emissive); s.emissiveIntensity = m.emissiveIntensity ?? 1; }
  if (vidrio) { s.transparent = true; s.opacity = OPACIDAD_VIDRIO; s.depthWrite = false; }
  else if (m.transparent && m.opacity < 1) { s.transparent = true; s.opacity = m.opacity; }
  if (m.map || m.normalMap || m.roughnessMap) console.warn(`aviso: ${m.name} tiene texturas y aquí se ignoran`);
  return s;
}
const clave = m => [m.name, m.color?.getHexString(), m.roughness, m.metalness, m.transmission ?? 0, m.emissive?.getHexString(), m.side, m.opacity].join('|');

const porMaterial = new Map();   // clave -> { material, geoms: [] }
let mallasGLB = 0, triGLB = 0;
const cajaM = new THREE.Box3();
for (const gltf of partes) {
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    // GLTFLoader hace una malla por primitiva: cada malla tiene un solo material
    if (Array.isArray(o.material)) throw new Error(`${o.name}: malla con varios materiales, no prevista`);
    const m = o.material;
    mallasGLB++;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    // solo posición y normal, en float (los GLB vienen cuantizados con KHR_mesh_quantization)
    const limpia = new THREE.BufferGeometry();
    for (const n of ['position', 'normal']) {
      const a = g.attributes[n];
      if (!a) continue;
      const f = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); }
      limpia.setAttribute(n, new THREE.BufferAttribute(f, 3));
    }
    if (!limpia.attributes.normal) limpia.computeVertexNormals();
    limpia.applyMatrix4(o.matrixWorld);
    if (o.matrixWorld.determinant() < 0) {   // un espejo invierte el orden de los vértices: se corrige
      for (const n of ['position', 'normal']) {
        const a = limpia.attributes[n].array;
        for (let t = 0; t < a.length; t += 9) for (let k = 0; k < 3; k++) { const x = a[t + 3 + k]; a[t + 3 + k] = a[t + 6 + k]; a[t + 6 + k] = x; }
      }
    }
    triGLB += limpia.attributes.position.count / 3;
    limpia.computeBoundingBox(); cajaM.union(limpia.boundingBox);
    const k = clave(m);
    if (!porMaterial.has(k)) porMaterial.set(k, { material: materialUSD(m), geoms: [] });
    porMaterial.get(k).geoms.push(limpia);
  });
}

// 3. a escala de maqueta, centrado y con el suelo en y = 0
const centro = cajaM.getCenter(new THREE.Vector3());
const s = 1 / ESCALA;
const aMesa = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-centro.x, -cajaM.min.y, -centro.z));

const escena = new THREE.Scene();
const edificio = new THREE.Group(); edificio.name = 'Edificio_106';
escena.add(edificio);
let i = 0, triUSD = 0;
for (const { material, geoms } of porMaterial.values()) {
  const g = mergeGeometries(geoms, false);
  g.applyMatrix4(aMesa);
  const n = g.attributes.position.count;
  // reindexar fundiendo vértices iguales (posición y normal): la USDA es texto y así pesa menos
  const mapa = new Map(), pos = [], nor = [], ind = [];
  const P = g.attributes.position.array, N = g.attributes.normal.array;
  for (let v = 0; v < n; v++) {
    const kk = `${P[v * 3].toFixed(6)},${P[v * 3 + 1].toFixed(6)},${P[v * 3 + 2].toFixed(6)},${N[v * 3].toFixed(3)},${N[v * 3 + 1].toFixed(3)},${N[v * 3 + 2].toFixed(3)}`;
    let j = mapa.get(kk);
    if (j === undefined) { j = pos.length / 3; mapa.set(kk, j); pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); nor.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); }
    ind.push(j);
  }
  const gi = new THREE.BufferGeometry();
  gi.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  gi.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  gi.setIndex(ind);
  triUSD += ind.length / 3;
  const malla = new THREE.Mesh(gi, material);
  malla.name = `m${String(i++).padStart(2, '0')}_${(material.name || 'material').normalize('NFD').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
  edificio.add(malla);
}

// 4. exportar, con la fecha del zip fija para que el archivo sea reproducible
const DateReal = globalThis.Date;
globalThis.Date = class extends DateReal { constructor(...a) { if (a.length === 0) super(FECHA_ZIP.getTime()); else super(...a); } };
let datos;
try {
  datos = await new USDZExporter().parseAsync(escena, { quickLookCompatible: true, includeAnchoringProperties: true });
} finally { globalThis.Date = DateReal; }
fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
const pesoTexto = datos.byteLength;
let formato = 'texto (usda)';

// 5. a binario con las herramientas USD de macOS, si están
const hay = h => { try { execFileSync('which', [h], { stdio: 'ignore' }); return true; } catch { return false; } };
if (!('texto' in arg) && hay('usdcat') && hay('usdzip')) {
  // carpeta de nombre fijo: usdcat guarda la ruta de la capa de origen dentro del usdc
  const tmp = path.join(os.tmpdir(), 'usdz-edificio-106');
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp);
  try {
    for (const [nombre, bytes] of Object.entries(unzipSync(new Uint8Array(datos)))) {
      fs.mkdirSync(path.join(tmp, path.dirname(nombre)), { recursive: true });
      fs.writeFileSync(path.join(tmp, nombre), bytes);
    }
    const usdc = path.join(tmp, 'edificio-106.usdc');
    execFileSync('usdcat', ['--flatten', path.join(tmp, 'model.usda'), '-o', usdc], { stdio: ['ignore', 'ignore', 'pipe'] });
    fs.utimesSync(usdc, FECHA_ZIP, FECHA_ZIP);   // usdzip pone la fecha del archivo: fija, para que salga igual
    const zip = path.join(tmp, 'salida.usdz');
    execFileSync('usdzip', [zip, 'edificio-106.usdc'], { cwd: tmp, stdio: ['ignore', 'ignore', 'pipe'] });
    datos = fs.readFileSync(zip);
    formato = 'binario (usdc)';
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
fs.writeFileSync(SALIDA, Buffer.from(datos));

const caja = new THREE.Box3().setFromObject(escena), tam = caja.getSize(new THREE.Vector3());
const vidrios = [...porMaterial.values()].filter(x => x.material.transparent).length;
console.log(`GLB: ${mallasGLB} mallas, ${Math.round(triGLB)} triángulos; caja ${cajaM.getSize(new THREE.Vector3()).toArray().map(v => v.toFixed(3)).join(' × ')} m (x, y, z)`);
console.log(`USDZ 1:${ESCALA}: ${porMaterial.size} mallas (una por material, ${vidrios} transparentes), ${triUSD} triángulos; caja ${tam.toArray().map(v => (v * 100).toFixed(2)).join(' × ')} cm; suelo en y = ${(caja.min.y * 100).toFixed(3)} cm`);
console.log(`${path.relative(raiz, SALIDA)}: ${(datos.byteLength / 1e6).toFixed(2)} MB en ${formato} (la de texto pesa ${(pesoTexto / 1e6).toFixed(2)} MB)`);
