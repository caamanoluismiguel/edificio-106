// Reduce el anillo de árboles de relleno de vegetacion.glb («V016 tropical tree bark» + «V016 broadleaf shade 0–6»): 37
// árboles iguales puestos en rejilla alrededor del cuadrángulo en la v016, cuando el contexto eran cajas inventadas. Con los
// vecinos de OpenStreetMap (contexto.mjs) muchos quedaban dentro de un edificio, sobre una calle o en el estacionamiento.
// Se quita cada árbol entero (tronco, ramas y hojas) cuya copa toca una huella de OSM (con 2 m de holgura para los aleros),
// la estructura pequeña del cuadrángulo, el estacionamiento o la calzada de una calle de OSM (4 m a cada lado del eje).
// Los demás quedan como estaban. Paso reproducible y sin efecto si se repite (lo que ya cumple no se toca).
//
//   cd fuente && node arboles.mjs              corrige ../modelo/vegetacion.glb en su lugar
//   node arboles.mjs entrada.glb salida.glb    o de un archivo a otro
//
// Los setos, las palmas y el resto de la vegetación del 106 no se tocan (solo las mallas V016 del anillo).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { compactPrimitive } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { osmRegistrado } from './contexto-osm.mjs';

const ANILLO = /V016 tropical tree bark|V016 broadleaf shade/;
const TRONCO = /bark/;
const HOLGURA_ALERO = 2, MEDIA_CALZADA = 4;
// lo mismo que usa contexto.mjs para la estructura del cuadrángulo y el estacionamiento
const OBSTACULOS_EXTRA = [
  { nombre: 'estructura del cuadrángulo', poly: [[-33.55, -27], [-23.85, -27], [-23.85, -21], [-33.55, -21]] },
  { nombre: 'estacionamiento', poly: [[-91, 37], [-16, 37], [-16, 73], [-91, 73]] },
];

const aplicar = (M, [x, y, z]) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
function dentro([x, z], P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
function distSeg(p, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz); }
function distPoligono(p, P) { if (dentro(p, P)) return 0; let d = Infinity; for (let i = 0; i < P.length; i++) d = Math.min(d, distSeg(p, P[i], P[(i + 1) % P.length])); return d; }

/** Corrige el documento de vegetacion.glb en su lugar. Devuelve un resumen de lo hecho. */
export function reducirArboles(doc) {
  // 1) piezas (componentes conexas) de las mallas del anillo, con su centro en el mundo
  const prims = [];
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m || !ANILLO.test(m.getName())) continue;
    const W = n.getWorldMatrix();
    for (const p of m.listPrimitives()) {
      const A = p.getAttribute('POSITION'), nv = A.getCount(), P = new Float64Array(nv * 3), e = [0, 0, 0];
      for (let i = 0; i < nv; i++) P.set(aplicar(W, A.getElement(i, e)), 3 * i);
      const I = p.getIndices() ? Array.from(p.getIndices().getArray()) : Array.from({ length: nv }, (_, i) => i);
      const par = Int32Array.from({ length: nv }, (_, i) => i), f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
      // vértices en el mismo lugar cuentan como uno (las piezas se cortan en vértices duplicados)
      const clave = new Map(); for (let i = 0; i < nv; i++) { const k = `${Math.round(P[3 * i] * 1e3)},${Math.round(P[3 * i + 1] * 1e3)},${Math.round(P[3 * i + 2] * 1e3)}`; const v = clave.get(k); if (v === undefined) clave.set(k, i); else par[f(i)] = f(v); }
      for (let t = 0; t < I.length / 3; t++) { const a = f(I[3 * t]); par[f(I[3 * t + 1])] = a; par[f(I[3 * t + 2])] = a; }
      const piezas = new Map();
      for (let t = 0; t < I.length / 3; t++) {
        const r = f(I[3 * t]); let s = piezas.get(r); if (!s) { s = { tris: [], x: 0, z: 0, y0: Infinity, n: 0 }; piezas.set(r, s); }
        s.tris.push(t); for (let j = 0; j < 3; j++) { const v = I[3 * t + j]; s.x += P[3 * v]; s.z += P[3 * v + 2]; s.y0 = Math.min(s.y0, P[3 * v + 1]); s.n++; }
      }
      prims.push({ p, I, P, tronco: TRONCO.test(m.getName()), piezas: [...piezas.values()].map((s) => ({ ...s, c: [s.x / s.n, s.z / s.n] })), quitar: new Uint8Array(I.length / 3) });
    }
  }
  // 2) árboles: el pie de cada tronco (piezas de corteza que llegan al suelo), y cada pieza al pie más cercano
  const pies = [];
  for (const pr of prims) if (pr.tronco) for (const s of pr.piezas) if (s.y0 < 0.3) {
    const q = pies.find((a) => Math.hypot(a.c[0] - s.c[0], a.c[1] - s.c[1]) < 3);
    if (q) { q.c = [(q.c[0] * q.k + s.c[0]) / (q.k + 1), (q.c[1] * q.k + s.c[1]) / (q.k + 1)]; q.k++; } else pies.push({ c: s.c, k: 1, r: 0, piezas: [] });
  }
  if (!pies.length) return ['el anillo ya no tiene árboles'];
  for (const pr of prims) for (const s of pr.piezas) {
    let mejor = null, d = Infinity; for (const a of pies) { const e = Math.hypot(a.c[0] - s.c[0], a.c[1] - s.c[1]); if (e < d) { d = e; mejor = a; } }
    mejor.piezas.push({ pr, s }); if (!pr.tronco) mejor.r = Math.max(mejor.r, d);
  }
  // 3) obstáculos: huellas de OSM (con holgura), la estructura, el estacionamiento y las calles
  const osm = osmRegistrado();
  const obst = [...osm.edificios.map((b) => ({ nombre: `${b.num || b.id}${b.nombre ? ' ' + b.nombre : ''}`, poly: b.poly, holgura: HOLGURA_ALERO })),
    ...OBSTACULOS_EXTRA.map((o) => ({ ...o, holgura: 0.5 }))];
  const calles = osm.calles.filter((c) => c.tipo === 'residential');
  const resumen = [];
  let quedan = 0;
  for (const a of pies) {
    const radio = Math.min(a.r, 9);                        // copa (las hojas más lejanas del pie)
    let motivo = null;
    for (const o of obst) if (distPoligono(a.c, o.poly) < radio + o.holgura) { motivo = o.nombre; break; }
    if (!motivo) for (const c of calles) for (let i = 0; i + 1 < c.linea.length && !motivo; i++) if (distSeg(a.c, c.linea[i], c.linea[i + 1]) < MEDIA_CALZADA + 1) motivo = `calle (OSM ${c.id})`;
    if (!motivo) { quedan++; continue; }
    for (const { pr, s } of a.piezas) for (const t of s.tris) pr.quitar[t] = 1;
    resumen.push(`quitado el árbol de (${a.c.map((v) => v.toFixed(1)).join(', ')}), copa ${radio.toFixed(1)} m: ${motivo}`);
  }
  // 4) escribir
  for (const pr of prims) if (pr.quitar.some(Boolean)) {
    const I = pr.I.filter((_, j) => !pr.quitar[Math.floor(j / 3)]);
    const acc = pr.p.getIndices();
    acc.setArray(new (acc.getArray().constructor)(I));
    compactPrimitive(pr.p);
  }
  if (resumen.length) resumen.push(`quedan ${quedan} de ${pies.length} árboles del anillo`);
  return resumen;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await MeshoptDecoder.ready; await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const ent = process.argv[2] ?? path.join(aqui, '../modelo/vegetacion.glb'), sal = process.argv[3] ?? ent;
  const doc = await io.read(ent);
  const r = reducirArboles(doc);
  console.log(r.length ? r.join('\n') : 'nada que corregir');
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  if (r.length && !/ya no tiene/.test(r[0])) { await io.write(sal, doc); console.log('escrito', sal); }
}
