// Corrige los setos que atraviesan estructuras del modelo en vegetacion.glb (el GLB web ya comprimido, o el documento de
// optimize2.mjs antes de escribirlo). Es un paso reproducible y sin efecto si se repite: cada regla es una holgura que se
// cumple o no, y lo que ya la cumple no se toca.
//
//   cd fuente && node arbustos.mjs              corrige ../modelo/vegetacion.glb en su lugar
//   node arbustos.mjs entrada.glb salida.glb    o de un archivo a otro
//
// Qué corrige (medido con cruces de triángulos entre las hojas y sitio/arquitectura/entrada/detalles, septiembre de 2026).
// Coordenadas de la escena en metros (+X = noreste, +Z = sureste, Y arriba; en Blender: x = X, y = −Z, z = Y):
//  1. Fachada trasera (noroeste), seto «Live hedge leaf» + «Ixora flower» con centro en (−2,8; 1,0; −13,3): cubría entera la
//     escalera de acceso trasera (peldaños «V012 aged reddish access paving» y baranda «Brown painted service access»,
//     x −4,37 a −2,22 · z −14,31 a −12,80). Se quita: una escalera no puede ir dentro de un arbusto.
//  2. Los otros dos setos traseros (centros en x −17,0 y −10,0; z −13,2) se metían ~0,7 m en la galería elevada de la fachada
//     noroeste («V013 restrained splash on plinth» y la losa «Warm lime-painted plaster», borde en z −12,80, 1,24 m de alto),
//     y las hojas salían sobre la losa detrás de la baranda. Cada hoja se desplaza entera (sin deformarla) hacia afuera,
//     comprimiendo el seto contra su borde exterior, hasta dejar 5 cm libres: z ≤ −12,85.
//  3. El seto de la fachada lateral noreste («V015 hedge leaf natural variation», x 23,07 a 24,98) tocaba las cajas de
//     ventilación y sus rejillas al pie del muro («Fresh cream trim», «Galvanized guardrail», «Weathered blue-grey louvre» de
//     detalles, hasta x 23,38). Mismo arreglo, contra su borde exterior: x ≥ 23,42.
// En el .blend de origen (colección «Vegetation» para los setos «Live hedge», «V015 Photographic planting» para el seto
// noreste) hay que hacer lo mismo: borrar el seto de la escalera trasera y separar de la galería y de las cajas los otros.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { compactPrimitive } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SETO = /hedge|Ixora/i;
const ESCALERA_NO = { x: [-4.37, -2.22], z: [-14.31, -12.80] };
const REGLAS = [
  { nombre: 'setos de la galería trasera', elige: (c) => c[2] < -11.5, eje: 2, limite: -12.85, lado: 'max' },   // z máx.
  { nombre: 'seto de la fachada noreste', elige: (c) => c[0] > 22, eje: 0, limite: 23.42, lado: 'min' },        // x mín.
];

function invertir(m) {        // inversa de una matriz 4×4 (columnas, como glTF)
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  return [(a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d, (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d, (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d, (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d, (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d];
}
const aplicar = (M, [x, y, z]) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];

/** Corrige el documento de vegetacion.glb en su lugar. Devuelve un resumen de lo hecho. */
export function corregirArbustos(doc) {
  // 1) hojas: componentes conexas de cada malla de seto, con sus vértices en coordenadas del mundo
  const hojas = [], prims = [];
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m || !SETO.test(m.getName())) continue;
    const W = n.getWorldMatrix();
    for (const p of m.listPrimitives()) {
      const A = p.getAttribute('POSITION'), nv = A.getCount(), P = new Float64Array(nv * 3), e = [0, 0, 0];
      for (let i = 0; i < nv; i++) P.set(aplicar(W, A.getElement(i, e)), 3 * i);
      const I = p.getIndices() ? Array.from(p.getIndices().getArray()) : Array.from({ length: nv }, (_, i) => i);
      const pr = { p, W, P, I, nv, quitar: new Uint8Array(I.length / 3), mover: new Float64Array(nv * 3) }; prims.push(pr);
      const clave = new Map(), vid = new Int32Array(nv);
      for (let i = 0; i < nv; i++) { const k = `${Math.round(P[3 * i] * 2e3)},${Math.round(P[3 * i + 1] * 2e3)},${Math.round(P[3 * i + 2] * 2e3)}`; let v = clave.get(k); if (v === undefined) { v = clave.size; clave.set(k, v); } vid[i] = v; }
      const par = Int32Array.from({ length: clave.size }, (_, i) => i), f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
      for (let t = 0; t < I.length / 3; t++) { const a = f(vid[I[3 * t]]), b = f(vid[I[3 * t + 1]]); par[a] = b; par[f(vid[I[3 * t + 2]])] = b; }
      const porRaiz = new Map();
      for (let t = 0; t < I.length / 3; t++) {
        const r = f(vid[I[3 * t]]); let h = porRaiz.get(r);
        if (!h) { h = { pr, tris: [], verts: new Set(), mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9], cen: [0, 0, 0] }; porRaiz.set(r, h); hojas.push(h); }
        h.tris.push(t);
        for (let j = 0; j < 3; j++) { const v = I[3 * t + j]; h.verts.add(v); for (let k = 0; k < 3; k++) { h.mn[k] = Math.min(h.mn[k], P[3 * v + k]); h.mx[k] = Math.max(h.mx[k], P[3 * v + k]); } }
      }
      for (const h of porRaiz.values()) h.cen = h.mn.map((x, k) => (x + h.mx[k]) / 2);
    }
  }
  // 2) arbustos: hojas vecinas (centros a menos de 0,45 m) forman un mismo seto
  const R = 0.45, rej = new Map(), par = hojas.map((_, i) => i), f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const celda = (c) => c.map((x) => Math.floor(x / R));
  hojas.forEach((h, i) => { const k = celda(h.cen).join(','); (rej.get(k) ?? rej.set(k, []).get(k)).push(i); });
  hojas.forEach((h, i) => { const [a, b, c] = celda(h.cen);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (const j of rej.get(`${a + dx},${b + dy},${c + dz}`) ?? [])
      if (j > i && Math.hypot(h.cen[0] - hojas[j].cen[0], h.cen[1] - hojas[j].cen[1], h.cen[2] - hojas[j].cen[2]) < R) par[f(i)] = f(j); });
  const grupos = new Map();
  hojas.forEach((h, i) => { const r = f(i); let s = grupos.get(r); if (!s) { s = { hojas: [], mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] }; grupos.set(r, s); }
    s.hojas.push(h); for (let k = 0; k < 3; k++) { s.mn[k] = Math.min(s.mn[k], h.mn[k]); s.mx[k] = Math.max(s.mx[k], h.mx[k]); } });
  const setos = [...grupos.values()].filter((s) => s.hojas.length > 20);
  const fx = (v) => v.map((x) => x.toFixed(2)).join(', ');
  const resumen = [];
  for (const s of setos) {
    const c = s.mn.map((x, k) => (x + s.mx[k]) / 2);
    // regla 1: el seto que tapa la escalera trasera
    if (s.mx[0] > ESCALERA_NO.x[0] && s.mn[0] < ESCALERA_NO.x[1] && s.mx[2] > ESCALERA_NO.z[0] && s.mn[2] < ESCALERA_NO.z[1]) {
      for (const h of s.hojas) for (const t of h.tris) h.pr.quitar[t] = 1;
      resumen.push(`quitado el seto de la escalera trasera: centro [${fx(c)}], ${s.hojas.length} hojas`); continue;
    }
    // reglas 2 y 3: comprimir el seto contra su borde exterior moviendo cada hoja entera
    for (const r of REGLAS) {
      if (!r.elige(c)) continue;
      const e = r.eje, borde = r.lado === 'max' ? s.mn[e] : s.mx[e], lejos = r.lado === 'max' ? s.mx[e] : s.mn[e];
      const sobra = r.lado === 'max' ? lejos - r.limite : r.limite - lejos;
      if (sobra <= 1e-4) continue;                                   // ya cumple la holgura
      const k = (r.limite - borde) / (lejos - borde);
      let maxMov = 0;
      for (const h of s.hojas) {
        const ext = r.lado === 'max' ? h.mx[e] : h.mn[e], d = (ext - borde) * (k - 1);
        maxMov = Math.max(maxMov, Math.abs(d));
        for (const v of h.verts) h.pr.mover[3 * v + e] = d;
      }
      resumen.push(`${r.nombre}: centro [${fx(c)}], ${s.hojas.length} hojas movidas hasta ${maxMov.toFixed(2)} m (${'xyz'[e]} ${r.lado === 'max' ? '≤' : '≥'} ${r.limite})`);
    }
  }
  // 3) escribir: posiciones movidas (en el espacio local del nodo, con la misma cuantización) y triángulos quitados
  for (const pr of prims) {
    const A = pr.p.getAttribute('POSITION'), inv = invertir(pr.W);
    let movidos = 0;
    for (let i = 0; i < pr.nv; i++) {
      const d = [pr.mover[3 * i], pr.mover[3 * i + 1], pr.mover[3 * i + 2]]; if (!d[0] && !d[1] && !d[2]) continue;
      const w = [pr.P[3 * i] + d[0], pr.P[3 * i + 1] + d[1], pr.P[3 * i + 2] + d[2]];
      let l = aplicar(inv, w); if (A.getNormalized()) l = l.map((x) => Math.max(-1, Math.min(1, x)));
      A.setElement(i, l); movidos++;
    }
    if (pr.quitar.some(Boolean)) {
      const I = pr.I.filter((_, j) => !pr.quitar[Math.floor(j / 3)]);
      const acc = pr.p.getIndices();
      if (acc) acc.setArray(new (acc.getArray().constructor)(I));
      else pr.p.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(I)).setBuffer(A.getBuffer()));
      compactPrimitive(pr.p);
    }
  }
  return resumen;
}

// uso desde la línea de comandos
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await MeshoptDecoder.ready; await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const ent = process.argv[2] ?? path.join(aqui, '../modelo/vegetacion.glb'), sal = process.argv[3] ?? ent;
  const doc = await io.read(ent);
  const r = corregirArbustos(doc);
  console.log(r.length ? r.join('\n') : 'nada que corregir');
  // la misma compresión que optimize2.mjs (meshopt «high» = filtros de cuantización sobre los búferes)
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  if (r.length) { await io.write(sal, doc); console.log('escrito', sal); }
}
