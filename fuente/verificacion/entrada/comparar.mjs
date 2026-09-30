// Compara modelo/*.glb con otra revisión (por defecto origin/main): bytes de cada archivo y, en los que cambian, nodo a
// nodo (vértices, triángulos, caja) y pieza a pieza (componentes conexas: las que desaparecen y las que aparecen, con su
// caja). Sirve para demostrar que solo cambió lo esperado.
//   cd fuente && node verificacion/entrada/comparar.mjs [revisión]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const REV = process.argv[2] ?? 'origin/main';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
const f2 = (x) => x.toFixed(2);

/** Nodos con malla → { nombre: { v, t, mn, mx, piezas: [clave de caja redondeada a 1 cm] } } en coordenadas del mundo. */
async function leer(buf) {
  const doc = await io.readBinary(new Uint8Array(buf)), out = {};
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m) continue;
    const W = n.getWorldMatrix(), r = { v: 0, t: 0, mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9], piezas: [] };
    for (const p of m.listPrimitives()) {
      const A = p.getAttribute('POSITION'), nv = A.getCount(), P = new Float64Array(nv * 3), e = [0, 0, 0];
      for (let i = 0; i < nv; i++) { A.getElement(i, e); for (let k = 0; k < 3; k++) P[3 * i + k] = W[k] * e[0] + W[4 + k] * e[1] + W[8 + k] * e[2] + W[12 + k]; }
      const I = p.getIndices()?.getArray() ?? Uint32Array.from({ length: nv }, (_, i) => i);
      r.v += nv; r.t += I.length / 3;
      const clave = new Map(), vid = new Int32Array(nv);
      for (let i = 0; i < nv; i++) { const k = `${Math.round(P[3 * i] * 2e3)},${Math.round(P[3 * i + 1] * 2e3)},${Math.round(P[3 * i + 2] * 2e3)}`; let v = clave.get(k); if (v === undefined) { v = clave.size; clave.set(k, v); } vid[i] = v; }
      const par = Int32Array.from({ length: clave.size }, (_, i) => i), f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
      for (let t = 0; t < I.length / 3; t++) { const a = f(vid[I[3 * t]]), b = f(vid[I[3 * t + 1]]); par[a] = b; par[f(vid[I[3 * t + 2]])] = b; }
      const C = new Map();
      for (let t = 0; t < I.length / 3; t++) {
        const rr = f(vid[I[3 * t]]); let c = C.get(rr); if (!c) { c = { n: 0, mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] }; C.set(rr, c); }
        c.n++;
        for (let j = 0; j < 3; j++) { const v = I[3 * t + j]; for (let k = 0; k < 3; k++) { c.mn[k] = Math.min(c.mn[k], P[3 * v + k]); c.mx[k] = Math.max(c.mx[k], P[3 * v + k]); r.mn[k] = Math.min(r.mn[k], P[3 * v + k]); r.mx[k] = Math.max(r.mx[k], P[3 * v + k]); } }
      }
      for (const c of C.values()) r.piezas.push(`${c.n} tris  x ${f2(c.mn[0])}–${f2(c.mx[0])}  y ${f2(c.mn[1])}–${f2(c.mx[1])}  z ${f2(c.mn[2])}–${f2(c.mx[2])}`);
    }
    out[n.getName()] = r;
  }
  return out;
}

const archivos = [...new Set([...fs.readdirSync(path.join(RAIZ, 'modelo')),
  ...execFileSync('git', ['-C', RAIZ, 'ls-tree', '--name-only', REV, 'modelo/'], { encoding: 'utf8' }).split('\n').filter(Boolean).map((x) => path.basename(x))])].filter((x) => x.endsWith('.glb')).sort();
for (const a of archivos) {
  const ruta = path.join(RAIZ, 'modelo', a);
  let viejo = null; try { viejo = execFileSync('git', ['-C', RAIZ, 'show', `${REV}:modelo/${a}`], { maxBuffer: 1 << 30 }); } catch { /* no estaba */ }
  const nuevo = fs.existsSync(ruta) ? fs.readFileSync(ruta) : null;
  if (!nuevo) { console.log(`${a.padEnd(22)} BORRADO`); continue; }
  if (!viejo) { console.log(`${a.padEnd(22)} NUEVO`); continue; }
  if (md5(viejo) === md5(nuevo)) { console.log(`${a.padEnd(22)} idéntico (${nuevo.length} bytes, md5 ${md5(nuevo)})`); continue; }
  console.log(`${a.padEnd(22)} CAMBIA: ${viejo.length} → ${nuevo.length} bytes`);
  const A = await leer(viejo), B = await leer(nuevo);
  for (const n of [...new Set([...Object.keys(A), ...Object.keys(B)])]) {
    const x = A[n], y = B[n];
    if (!x) { console.log(`  + nodo nuevo «${n}»: ${y.v} vértices, ${y.t} triángulos, caja x ${f2(y.mn[0])}–${f2(y.mx[0])} y ${f2(y.mn[1])}–${f2(y.mx[1])} z ${f2(y.mn[2])}–${f2(y.mx[2])}`); continue; }
    if (!y) { console.log(`  − nodo quitado «${n}»`); continue; }
    const sx = new Map(); for (const p of x.piezas) sx.set(p, (sx.get(p) ?? 0) + 1);
    const sy = new Map(); for (const p of y.piezas) sy.set(p, (sy.get(p) ?? 0) + 1);
    const fuera = [], dentro = [];
    for (const [p, c] of sx) for (let i = 0; i < c - (sy.get(p) ?? 0); i++) fuera.push(p);
    for (const [p, c] of sy) for (let i = 0; i < c - (sx.get(p) ?? 0); i++) dentro.push(p);
    const caja = (r) => `x ${f2(r.mn[0])}–${f2(r.mx[0])} y ${f2(r.mn[1])}–${f2(r.mx[1])} z ${f2(r.mn[2])}–${f2(r.mx[2])}`;
    if (!fuera.length && !dentro.length && x.v === y.v && x.t === y.t) { console.log(`  = «${n}» igual (${y.v} vértices, ${y.t} triángulos, ${y.piezas.length} piezas, ${caja(y)})`); continue; }
    console.log(`  ~ «${n}»: vértices ${x.v} → ${y.v}, triángulos ${x.t} → ${y.t}, piezas ${x.piezas.length} → ${y.piezas.length}; caja ${caja(x)} → ${caja(y)}`);
    for (const p of fuera) console.log(`      antes  ${p}`);
    for (const p of dentro) console.log(`      ahora  ${p}`);
  }
}
