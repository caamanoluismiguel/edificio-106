// ¿Alguna hoja o seto de vegetacion.glb se mete en la entrada nueva (losa, peldaños, muretes, pasamanos)? Y, como
// vegetacion.glb no cambia, repite en seco las holguras de arbustos.mjs (escalera trasera, galería noroeste, cajas noreste).
//   cd fuente && node verificacion/entrada/cruces.mjs
// Cada pieza de la entrada se toma como su caja (con 2 cm de holgura); se cuentan los vértices de vegetación dentro, y los
// triángulos de vegetación que la atraviesan (segmentos de arista contra la caja).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { piezas, centro, tam } from '../../barandas.mjs';
import { cargarTriangulos } from '../../verificar-geometria.mjs';
import { corregirArbustos } from '../../arbustos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const ent = await io.read(path.join(RAIZ, 'modelo', 'entrada.glb'));
const cajas = [
  ...piezas(ent, /Pale cast concrete — entrance/).filter((c) => c.mx[0] < 15.7 && c.mn[0] < 14.6).map((c) => [c.malla, c]),
  ...piezas(ent, /Warm lime-painted plaster/).map((c) => [c.malla, c]),
  ...piezas(ent, /guardrail/i).filter((c) => Math.abs(centro(c)[0] - 11.10) < 0.05 || Math.abs(centro(c)[0] - 14.50) < 0.05).map((c) => [c.malla, c]),
];
const veg = await cargarTriangulos(RAIZ, ['vegetacion']);
const H = 0.02, T = veg.tri;
// segmento p→q contra caja (método de las franjas)
const cruza = (p, q, mn, mx) => { let a = 0, b = 1; for (let k = 0; k < 3; k++) { const d = q[k] - p[k];
  if (Math.abs(d) < 1e-12) { if (p[k] < mn[k] || p[k] > mx[k]) return false; continue; }
  let t0 = (mn[k] - p[k]) / d, t1 = (mx[k] - p[k]) / d; if (t0 > t1) [t0, t1] = [t1, t0]; a = Math.max(a, t0); b = Math.min(b, t1); if (a > b) return false; } return true; };
let total = 0;
for (const [nombre, c] of cajas) {
  const mn = c.mn.map((x) => x - H), mx = c.mx.map((x) => x + H);
  let dentro = 0, tris = 0; const mats = new Set();
  for (let i = 0; i < veg.mat.length; i++) {
    const v = [0, 1, 2].map((j) => [T[9 * i + 3 * j], T[9 * i + 3 * j + 1], T[9 * i + 3 * j + 2]]);
    const vin = v.filter((p) => p.every((x, k) => x >= mn[k] && x <= mx[k])).length;
    if (vin || cruza(v[0], v[1], mn, mx) || cruza(v[1], v[2], mn, mx) || cruza(v[2], v[0], mn, mx)) { tris++; dentro += vin; mats.add(veg.nombres[veg.mat[i]]); }
  }
  total += tris;
  console.log(`${nombre.slice(0, 34).padEnd(34)} x ${c.mn[0].toFixed(2)}–${c.mx[0].toFixed(2)} y ${c.mn[1].toFixed(2)}–${c.mx[1].toFixed(2)} z ${c.mn[2].toFixed(2)}–${c.mx[2].toFixed(2)}  triángulos de vegetación: ${tris}${tris ? ' (' + [...mats].join(', ') + ')' : ''}`);
}
console.log(`\nentrada: ${total} triángulos de vegetación tocan alguna pieza (${cajas.length} piezas, holgura ${H * 100} cm)`);
const r = corregirArbustos(await io.read(path.join(RAIZ, 'modelo', 'vegetacion.glb')));
console.log(`arbustos.mjs en seco sobre vegetacion.glb: ${r.length ? r.join('; ') : 'nada que corregir (escalera trasera, galería y cajas siguen libres)'}`);
void tam;
process.exit(total || r.length ? 1 : 0);
