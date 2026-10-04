// Los árboles reales cerca del 106 (arboles_reales.json: copas del mapa de altura de copa de Meta y WRI, imágenes de 2018, miradas
// en 2026 en Street View, imágenes de nov 2022; arboles-acomodar.mjs las corre hasta 5 m para que no caigan en la calle ni dentro
// de un edificio). Desde que todos los árboles van en arboles.glb (arboles-cds.mjs), este archivo:
//  · da la lista de esos árboles en la escena (arbolesReales), que arboles-cds.mjs pone con el molde completo;
//  · mide el molde: el árbol más completo del anillo de relleno de la v016 (medirAnillo, para molde-arbol.mjs y --medir);
//  · quita de vegetacion.glb el anillo de relleno («V016 tropical tree bark» + «V016 broadleaf shade 0–6») o los árboles reales
//    que se pusieron ahí antes («V018 real tree…»). Las palmas, las cañas y los setos no se tocan. Sin efecto si se repite.
//
//   cd fuente && node arboles-reales.mjs            corrige ../modelo/vegetacion.glb en su lugar
//   node arboles-reales.mjs entrada.glb salida.glb  o de un archivo a otro
//   node arboles-reales.mjs --medir [glb]           mide el molde (en un GLB que todavía tenga el anillo, p. ej. el de b08b86b)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aEscena, osmRegistrado } from './contexto-osm.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ANILLO = /^V016 (tropical tree bark|broadleaf shade \d)$/, PUESTOS = /^V018 real tree /;

const aplicar = (M, [x, y, z]) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
function cascoArea(pts) {          // área del casco convexo (Andrew), en m²
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length > 1 && cr(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length > 1 && cr(hi.at(-2), hi.at(-1), q) <= 0) hi.pop(); hi.push(q); }
  const h = lo.slice(0, -1).concat(hi.slice(0, -1)); let A = 0;
  for (let i = 0; i < h.length; i++) { const [x1, z1] = h[i], [x2, z2] = h[(i + 1) % h.length]; A += x1 * z2 - x2 * z1; }
  return Math.abs(A) / 2;
}

/** Los árboles reales en la escena: [{ id, x, z, alto, diam }]. */
export function arbolesReales(archivo = path.join(AQUI, 'arboles_reales.json')) {
  const j = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const { rotacionGrados: g, centroOSM106: c0 } = osmRegistrado().registro, th = g * Math.PI / 180, co = Math.cos(th), si = Math.sin(th);
  return j.arboles.filter((a) => !a.fuera).map((a) => { const [x, z] = aEscena(a.lat, a.lon), dx = x - c0[0], dz = z - c0[1];
    const [cx, cz] = a.corrimiento_escena_m ?? [0, 0];   // corrimiento de --acomodar (tronco en pasto, copa sin tocar edificios)
    return { id: a.id, x: dx * co - dz * si + cx, z: dx * si + dz * co + cz, alto: a.altura_m, diam: a.diametro_copa_m }; });
}

/** Corrige el documento de vegetacion.glb en su lugar. Devuelve un resumen de lo hecho. */
/** Mide el anillo de relleno y su molde. Devuelve { molde, piezas (primitiva → triángulos del molde), res (texto) } o null. */
export function medirAnillo(doc) {
  // 1) las mallas del anillo, con cada vértice en el mundo, y sus piezas (componentes conexas)
  const prims = [];
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m || !ANILLO.test(m.getName())) continue;
    const padre = n.getParentNode();   // el grupo «vegetacion», sin transformación: la matriz del nodo es la del mundo
    if (padre && padre.getWorldMatrix().some((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) > 1e-9)) throw new Error(`${n.getName()}: el padre tiene transformación`);
    const W = n.getWorldMatrix(), [p] = m.listPrimitives();
    if (m.listPrimitives().length !== 1) throw new Error(`${m.getName()}: se esperaba una sola primitiva`);
    const A = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL'), nv = A.getCount(), P = new Float64Array(nv * 3), Nr = new Float64Array(nv * 3), e = [0, 0, 0];
    for (let i = 0; i < nv; i++) { P.set(aplicar(W, A.getElement(i, e)), 3 * i); const q = N.getElement(i, e), l = Math.hypot(...q) || 1; Nr.set([q[0] / l, q[1] / l, q[2] / l], 3 * i); }
    const I = Array.from(p.getIndices().getArray());
    const par = Int32Array.from({ length: nv }, (_, i) => i), f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const clave = new Map(); for (let i = 0; i < nv; i++) { const k = `${Math.round(P[3 * i] * 1e3)},${Math.round(P[3 * i + 1] * 1e3)},${Math.round(P[3 * i + 2] * 1e3)}`; const v = clave.get(k); if (v === undefined) clave.set(k, i); else par[f(i)] = f(v); }
    for (let t = 0; t < I.length / 3; t++) { const a = f(I[3 * t]); par[f(I[3 * t + 1])] = a; par[f(I[3 * t + 2])] = a; }
    const piezas = new Map();
    for (let t = 0; t < I.length / 3; t++) {
      const r = f(I[3 * t]); let s = piezas.get(r); if (!s) { s = { tris: [], x: 0, z: 0, y0: Infinity, n: 0 }; piezas.set(r, s); }
      s.tris.push(t); for (let j = 0; j < 3; j++) { const v = I[3 * t + j]; s.x += P[3 * v]; s.z += P[3 * v + 2]; s.y0 = Math.min(s.y0, P[3 * v + 1]); s.n++; }
    }
    prims.push({ n, m, p, I, P, Nr, tronco: /bark/.test(m.getName()), piezas: [...piezas.values()].map((s) => ({ ...s, c: [s.x / s.n, s.z / s.n] })) });
  }
  if (!prims.length) return null;
  // 2) árboles del anillo: el pie de cada tronco, y cada pieza al pie más cercano (como arboles.mjs)
  const pies = [];
  for (const pr of prims) if (pr.tronco) for (const s of pr.piezas) if (s.y0 < 0.3) {
    const q = pies.find((a) => Math.hypot(a.c[0] - s.c[0], a.c[1] - s.c[1]) < 3);
    if (q) { q.c = [(q.c[0] * q.k + s.c[0]) / (q.k + 1), (q.c[1] * q.k + s.c[1]) / (q.k + 1)]; q.k++; } else pies.push({ c: s.c, k: 1, piezas: [] });
  }
  for (const pr of prims) for (const s of pr.piezas) {
    let mejor = null, d = Infinity; for (const a of pies) { const e = Math.hypot(a.c[0] - s.c[0], a.c[1] - s.c[1]); if (e < d) { d = e; mejor = a; } }
    mejor.piezas.push({ pr, s });
  }
  // 3) el molde: el árbol del anillo con más triángulos de hoja (la copa más completa); su alto y su diámetro de copa
  for (const a of pies) {
    a.hojas = a.piezas.filter(({ pr }) => !pr.tronco).reduce((t, { s }) => t + s.tris.length, 0);
    let y0 = Infinity, y1 = -Infinity; const planta = [];
    for (const { pr, s } of a.piezas) for (const t of s.tris) for (let j = 0; j < 3; j++) {
      const v = pr.I[3 * t + j], y = pr.P[3 * v + 1]; y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      if (!pr.tronco) planta.push([pr.P[3 * v], pr.P[3 * v + 2]]);
    }
    a.y0 = y0; a.alto = y1 - y0; a.diam = planta.length > 2 ? 2 * Math.sqrt(cascoArea(planta) / Math.PI) : 0;
    a.alcance = Math.max(0, ...planta.map(([x, z]) => Math.hypot(x - a.c[0], z - a.c[1])));   // la hoja más lejana del pie
    let yb = Infinity; for (const { pr, s } of a.piezas) if (!pr.tronco) for (const t of s.tris) for (let j = 0; j < 3; j++) yb = Math.min(yb, pr.P[3 * pr.I[3 * t + j] + 1]);
    a.base = yb - y0;                                                                                // donde empieza la copa
  }
  const molde = pies.reduce((b, a) => (a.hojas > b.hojas ? a : b));
  const piezas = new Map(); for (const { pr, s } of molde.piezas) { if (!piezas.has(pr.p)) piezas.set(pr.p, []); piezas.get(pr.p).push(...s.tris); }
  const res = [`anillo: ${pies.length} árboles de relleno; molde en (${molde.c.map((v) => v.toFixed(1)).join(', ')}), ${molde.alto.toFixed(2)} m de alto, copa de ${molde.diam.toFixed(2)} m, alcance ${molde.alcance.toFixed(2)} m, la copa empieza a ${molde.base.toFixed(2)} m, ${molde.hojas} triángulos de hoja`];
  return { molde, piezas, res };
}

/** Quita de vegetacion.glb el anillo de relleno o los árboles reales puestos ahí antes. Devuelve un resumen. */
export function quitarArbolesDeVegetacion(doc) {
  const res = [];
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m || !(ANILLO.test(m.getName()) || PUESTOS.test(m.getName()))) continue;
    res.push(`quitado «${m.getName()}»`); n.dispose(); m.dispose();
  }
  return res;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await MeshoptDecoder.ready; await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--')), medir = process.argv.includes('--medir');
  const ent = args[0] ?? path.join(AQUI, '../modelo/vegetacion.glb'), sal = args[1] ?? ent;
  const doc = await io.read(ent);
  if (medir) { const r = medirAnillo(doc); console.log(r ? r.res.join('\n') : 'este GLB ya no tiene el anillo de relleno'); }
  else {
    const r = quitarArbolesDeVegetacion(doc);
    console.log(r.length ? r.join('\n') : 'nada que quitar');
    if (r.length) {
      await doc.transform(prune());
      doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
      await io.write(sal, doc); console.log('escrito', sal);
    }
  }
}
