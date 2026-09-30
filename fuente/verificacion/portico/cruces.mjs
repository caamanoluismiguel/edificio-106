// ¿Alguna hoja, tronco o seto de vegetacion.glb atraviesa una pieza nueva o movida del pórtico (portico.mjs)? Intersección
// exacta de triángulos (cada arista de un triángulo contra el otro, en los dos sentidos) entre la vegetación y cada pieza:
// columnas (las dos del frente y la trasera), vigas, limas, teja, peldaños, muretes y pasamanos. Además cuenta, como la
// comprobación de verificacion/entrada/cruces.mjs, los triángulos de vegetación dentro de la caja de cada pieza (+2 cm).
//   cd fuente && node verificacion/portico/cruces.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { piezas, centro } from '../../barandas.mjs';
import { cargarTriangulos } from '../../verificar-geometria.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const ent = await io.read(path.join(RAIZ, 'modelo', 'entrada.glb'));
const zona = (c) => c.mx[0] > 9.8 && c.mn[0] < 15.7 && c.mx[2] > 11.25 && c.mn[2] < 17.4;
const L = [
  ...piezas(ent, /^Fresh cream trim$/).filter(zona),
  ...piezas(ent, /^Dark stained roof timber$/).filter(zona),
  ...piezas(ent, /Clay terracotta/),
  ...piezas(ent, /^Pale cast concrete — entrance( slab)?$/).filter((c) => zona(c) && c.mn[0] < 14.6),
  ...piezas(ent, /Warm lime-painted plaster/),
  ...piezas(ent, /guardrail/i).filter((c) => [11.65, 13.95].some((x) => Math.abs(centro(c)[0] - x) < 0.05) && c.mn[2] > 11.4),
];
const veg = await cargarTriangulos(RAIZ, ['vegetacion']);
const T = veg.tri, NV = veg.mat.length;
const vt = (A, i) => [0, 1, 2].map((j) => [A[9 * i + 3 * j], A[9 * i + 3 * j + 1], A[9 * i + 3 * j + 2]]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], pto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** ¿El segmento p→q corta el triángulo t (Möller–Trumbore, 0 ≤ s ≤ 1)? */
function segTri(p, q, t) {
  const d = sub(q, p), e1 = sub(t[1], t[0]), e2 = sub(t[2], t[0]), h = cruz(d, e2), a = pto(e1, h);
  if (Math.abs(a) < 1e-12) return false;
  const f = 1 / a, s = sub(p, t[0]), u = f * pto(s, h); if (u < 0 || u > 1) return false;
  const qq = cruz(s, e1), v = f * pto(d, qq); if (v < 0 || u + v > 1) return false;
  const k = f * pto(e2, qq); return k >= 0 && k <= 1;
}
const triTri = (a, b) => [0, 1, 2].some((i) => segTri(a[i], a[(i + 1) % 3], b) || segTri(b[i], b[(i + 1) % 3], a));
// cajas de los triángulos de vegetación (para descartar rápido)
const BX = new Float32Array(NV * 6);
for (let i = 0; i < NV; i++) { const v = vt(T, i); for (let k = 0; k < 3; k++) { BX[6 * i + k] = Math.min(v[0][k], v[1][k], v[2][k]); BX[6 * i + 3 + k] = Math.max(v[0][k], v[1][k], v[2][k]); } }
const H = 0.02; let totalCaja = 0, totalCruce = 0;
for (const c of L) {
  const mn = c.mn.map((x) => x - H), mx = c.mx.map((x) => x + H);
  const cand = []; for (let i = 0; i < NV; i++) { let ok = true; for (let k = 0; k < 3 && ok; k++) ok = BX[6 * i + k] <= mx[k] && BX[6 * i + 3 + k] >= mn[k]; if (ok) cand.push(i); }
  const I = c.p.getIndices().getArray(), P = c.P, tri = (t) => [0, 1, 2].map((j) => { const v = I[3 * t + j]; return [P[3 * v], P[3 * v + 1], P[3 * v + 2]]; });
  let cruces = 0; const mats = new Set();
  for (const i of cand) { const b = vt(T, i); if (c.tris.some((t) => triTri(tri(t), b))) { cruces++; mats.add(veg.nombres[veg.mat[i]]); } }
  totalCaja += cand.length; totalCruce += cruces;
  if (!/terracotta/.test(c.malla) || cand.length || cruces)
    console.log(`${c.malla.slice(0, 34).padEnd(34)} x ${c.mn[0].toFixed(2)}–${c.mx[0].toFixed(2)} y ${c.mn[1].toFixed(2)}–${c.mx[1].toFixed(2)} z ${c.mn[2].toFixed(2)}–${c.mx[2].toFixed(2)}  en su caja: ${cand.length}  la atraviesan: ${cruces}${cruces ? ' (' + [...mats].join(', ') + ')' : ''}`);
}
console.log(`\n${L.length} piezas (${L.filter((c) => /terracotta/.test(c.malla)).length} de teja, listadas solo si hay algo en su caja): ${totalCaja} triángulos de vegetación en sus cajas (+${H * 100} cm), ${totalCruce} las atraviesan`);
process.exit(totalCruce ? 1 : 0);
