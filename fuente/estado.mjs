// Estado del modelo: una «foto» de cada GLB del sitio y de la AR, pieza por pieza, para probar que un cambio solo toca lo
// que dice tocar. Una pieza es una componente conexa de triángulos de un mismo material (vértices unidos a 0,5 mm), con su
// número de triángulos y su caja en el mundo redondeada a 1 cm.
//   cd fuente && node estado.mjs                 escribe estado/estado.json (la foto) y estado/ESTADO.md (el checklist)
//   cd fuente && node estado.mjs --comprobar     compara los GLB de ahora con la foto guardada: md5, piezas que faltan o
//                                                sobran (con material y caja) y el pórtico medido con portico.mjs --medir.
//                                                Sale con 1 si algo cambió.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.resolve(AQUI, '..');
const DIR = path.join(AQUI, 'estado');
const CARPETAS = ['modelo', 'ar/modelo'];
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
const cm = (x) => Math.round(x * 100);

/** Las piezas de un GLB: [«material|triángulos|caja en cm»] ordenadas, más el total de triángulos por material. */
async function piezas(archivo) {
  const doc = await io.read(archivo), lista = [], porMat = {};
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m) continue;
    const W = n.getWorldMatrix();
    for (const p of m.listPrimitives()) {
      const mat = p.getMaterial()?.getName() ?? '(sin material)';
      const A = p.getAttribute('POSITION'), nv = A.getCount(), P = new Float64Array(nv * 3), e = [0, 0, 0];
      for (let i = 0; i < nv; i++) { A.getElement(i, e); for (let k = 0; k < 3; k++) P[3 * i + k] = W[k] * e[0] + W[4 + k] * e[1] + W[8 + k] * e[2] + W[12 + k]; }
      const I = p.getIndices()?.getArray() ?? Uint32Array.from({ length: nv }, (_, i) => i);
      const clave = new Map(), vid = new Int32Array(nv);
      for (let i = 0; i < nv; i++) {
        const k = `${Math.round(P[3 * i] * 2e3)},${Math.round(P[3 * i + 1] * 2e3)},${Math.round(P[3 * i + 2] * 2e3)}`;
        let v = clave.get(k); if (v === undefined) { v = clave.size; clave.set(k, v); } vid[i] = v;
      }
      const par = Int32Array.from({ length: clave.size }, (_, i) => i);
      const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
      for (let t = 0; t < I.length / 3; t++) { const a = f(vid[I[3 * t]]), b = f(vid[I[3 * t + 1]]), c = f(vid[I[3 * t + 2]]); par[a] = c; par[b] = c; }
      const C = new Map();
      for (let t = 0; t < I.length / 3; t++) {
        const r = f(vid[I[3 * t]]); let c = C.get(r);
        if (!c) { c = { n: 0, mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] }; C.set(r, c); }
        c.n++;
        for (let j = 0; j < 3; j++) { const v = I[3 * t + j]; for (let k = 0; k < 3; k++) { c.mn[k] = Math.min(c.mn[k], P[3 * v + k]); c.mx[k] = Math.max(c.mx[k], P[3 * v + k]); } }
      }
      porMat[mat] = (porMat[mat] ?? 0) + I.length / 3;
      for (const c of C.values()) lista.push(`${mat}|${c.n}|${c.mn.map(cm).join(',')}|${c.mx.map(cm).join(',')}`);
    }
  }
  return { piezas: lista.sort(), triangulos: porMat };
}

async function foto() {
  const out = { fecha: new Date().toISOString(), git: execFileSync('git', ['-C', RAIZ, 'rev-parse', '--short', 'HEAD']).toString().trim(), archivos: {} };
  for (const c of CARPETAS) for (const f of fs.readdirSync(path.join(RAIZ, c)).filter((f) => f.endsWith('.glb')).sort()) {
    const a = path.join(RAIZ, c, f), r = await piezas(a);
    out.archivos[`${c}/${f}`] = { md5: md5(fs.readFileSync(a)), bytes: fs.statSync(a).size, nPiezas: r.piezas.length, triangulos: r.triangulos, piezas: r.piezas };
  }
  out.portico = execFileSync('node', [path.join(AQUI, 'portico.mjs'), '--medir'], { cwd: AQUI }).toString().trim().split('\n');
  return out;
}

const ahora = await foto();
if (!process.argv.includes('--comprobar')) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, 'estado.json'), JSON.stringify(ahora, null, 1));
  const L = [`# Estado del modelo (${ahora.fecha.slice(0, 10)}, git ${ahora.git})`, '',
    'Foto de referencia de cada GLB, pieza por pieza. Antes de publicar un cambio del modelo: `cd fuente && node estado.mjs --comprobar`.',
    'Solo pueden aparecer en la lista de diferencias las piezas que el cambio dice tocar. Después de aprobar el cambio, `node estado.mjs` rehace la foto.', '',
    '| Archivo | Piezas | Triángulos | md5 |', '|---|---|---|---|'];
  for (const [k, v] of Object.entries(ahora.archivos)) L.push(`| ${k} | ${v.nPiezas} | ${Object.values(v.triangulos).reduce((a, b) => a + b, 0)} | \`${v.md5.slice(0, 12)}\` |`);
  L.push('', '## Invariantes que hay que revisar a mano', '',
    '- El pórtico: columnas en x 11,70 y 13,90 (2,20 m entre ejes), columna trasera en 11,46, capitel a 2,40 m, viga, zapatas y cinco cabios (`node portico.mjs --medir`).',
    '- Los GLB de `ar/modelo/` son copias byte a byte de los de `modelo/` (`bash ar/verificar-huellas.sh`).',
    '- Las sombras y el sol: `node verificar.mjs` (7 comprobaciones).',
    '- La imagen: `node guardia.mjs` (18 cuadros contra main).', '',
    '## El pórtico medido', '', '```', ...ahora.portico, '```');
  fs.writeFileSync(path.join(DIR, 'ESTADO.md'), L.join('\n') + '\n');
  console.log('foto escrita en', DIR, '·', Object.keys(ahora.archivos).length, 'archivos');
} else {
  const antes = JSON.parse(fs.readFileSync(path.join(DIR, 'estado.json'), 'utf8'));
  let cambios = 0;
  for (const k of new Set([...Object.keys(antes.archivos), ...Object.keys(ahora.archivos)])) {
    const a = antes.archivos[k], b = ahora.archivos[k];
    if (!a || !b) { console.log(`✗ ${k}: ${a ? 'falta' : 'nuevo'}`); cambios++; continue; }
    if (a.md5 === b.md5) { console.log(`✓ ${k} idéntico`); continue; }
    const cuenta = (l) => l.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
    const A = cuenta(a.piezas), B = cuenta(b.piezas), menos = [], mas = [];
    for (const [x, n] of A) for (let i = (B.get(x) ?? 0); i < n; i++) menos.push(x);
    for (const [x, n] of B) for (let i = (A.get(x) ?? 0); i < n; i++) mas.push(x);
    console.log(`✗ ${k}: md5 distinto · piezas ${a.nPiezas} → ${b.nPiezas} · desaparecen ${menos.length}, aparecen ${mas.length}`);
    const ver = (s, x) => { const [mat, n, mn, mx] = x.split('|'); console.log(`    ${s} ${mat} · ${n} triángulos · caja (${mn.split(',').map((v) => v / 100).join('; ')}) a (${mx.split(',').map((v) => v / 100).join('; ')}) m`); };
    menos.slice(0, 40).forEach((x) => ver('−', x)); mas.slice(0, 40).forEach((x) => ver('+', x));
    cambios++;
  }
  const pa = antes.portico.join('\n'), pb = ahora.portico.join('\n');
  console.log(pa === pb ? '✓ pórtico: la medición es idéntica' : '✗ pórtico: la medición cambió');
  if (pa !== pb) cambios++;
  console.log(cambios ? `RESULTADO: ${cambios} cambio(s): revisar que sean solo los esperados` : 'RESULTADO: todo igual a la foto');
  process.exit(cambios ? 1 : 0);
}
