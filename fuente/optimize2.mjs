// v2: modelo liviano para la web. Parte de ../raw (exportación de Blender) y escribe public/modelo/*.glb.
//  · El contexto (contexto.glb) ya no sale de ../raw: lo genera contexto.mjs desde osm.json y la geometría del 106.
//  · Follaje: poda estocástica (Cook, Halstead, Planck y Ryu, "Stochastic Simplification of Aggregate
//    Detail", SIGGRAPH 2007): se conserva una fracción k de las hojas y cada hoja conservada se agranda
//    1/sqrt(k) en área alrededor de su centro, para que la copa tape lo mismo y la sombra no se aclare.
//  · Contexto lejano (tejas de los edificios vecinos, barandas): simplificación "sloppy" de meshoptimizer,
//    que sí fusiona piezas sueltas. El edificio 106 conserva su detalle.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, meshopt, dedup, prune, quantize, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import fs from 'fs';
import { corregirArbustos } from './arbustos.mjs';   // setos que atravesaban la escalera y la galería traseras (ver arbustos.mjs)
import { corregirBarandas } from './barandas.mjs';   // barandas de los accesos cortadas en el aire (ver barandas.mjs)
import { corregirEntrada } from './entrada.mjs';     // losa bajo el pórtico y escalera retirada hasta la puerta, como en WA0014 (ver entrada.mjs)
import { corregirPortico } from './portico.mjs';     // pórtico más angosto y alto, escalera más estrecha y columna trasera, como en WA0014 (ver portico.mjs)
import { reducirArboles } from './arboles.mjs';      // árboles del anillo de relleno que caían en edificios, calles o el estacionamiento (ver arboles.mjs)
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const groups = ['sitio', 'arquitectura', 'ventanas', 'cubiertas', 'entrada', 'detalles', 'vegetacion'];   // contexto: contexto.mjs
const SIMPL = { cubiertas: [0.25, 0.0004], contexto: [0.2, 0.001], vegetacion: [0.6, 0.002], detalles: [0.5, 0.0005] };
const HOJA = /leaf|leaflet|broadleaf|flower/i;         // mallas de follaje a podar
const PODA = { broadleaf: 0.3, default: 0.45 };        // fracción de hojas que se conserva
const SLOPPY = [[/terracotta/i, 0.06], [/guardrail/i, 0.12], [/plaster/i, 0.35]]; // solo en contexto

// PRNG determinista (misma poda en cada compilación)
const rnd = (i) => { let x = (i * 2654435761) >>> 0; x ^= x >>> 16; x = Math.imul(x, 2246822507) >>> 0; x ^= x >>> 13; x = Math.imul(x, 3266489909) >>> 0; x ^= x >>> 16; return (x >>> 0) / 4294967296; };

function triIdx(p) {
  const I = p.getIndices()?.getArray(); const n = p.getAttribute('POSITION').getCount();
  return I ? I : Uint32Array.from({ length: n }, (_, i) => i);
}

/** Poda estocástica por componente conexa (hoja). Devuelve triángulos antes/después. */
function podar(doc, p, keep, seed) {
  const P = p.getAttribute('POSITION').getArray(); const I = triIdx(p); const nt = I.length / 3;
  const key = new Map(), vid = new Int32Array(P.length / 3);
  for (let i = 0; i < vid.length; i++) { const k = `${Math.round(P[3 * i] * 1e4)},${Math.round(P[3 * i + 1] * 1e4)},${Math.round(P[3 * i + 2] * 1e4)}`; let v = key.get(k); if (v === undefined) { v = key.size; key.set(k, v); } vid[i] = v; }
  const par = Int32Array.from({ length: key.size }, (_, i) => i); const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < nt; t++) { const a = f(vid[I[3 * t]]), b = f(vid[I[3 * t + 1]]), c = f(vid[I[3 * t + 2]]); par[a] = b; par[c] = b; }
  const comp = new Int32Array(nt); const cen = new Map();
  for (let t = 0; t < nt; t++) { const r = f(vid[I[3 * t]]); comp[t] = r; let c = cen.get(r); if (!c) { c = [0, 0, 0, 0]; cen.set(r, c); }
    for (let j = 0; j < 3; j++) { const v = I[3 * t + j]; c[0] += P[3 * v]; c[1] += P[3 * v + 1]; c[2] += P[3 * v + 2]; c[3]++; } }
  const s = 1 / Math.sqrt(keep);
  const keptT = []; for (let t = 0; t < nt; t++) if (rnd(comp[t] * 7919 + seed) < keep) keptT.push(t);
  // salida sin índices: cada vértice de triángulo conservado
  for (const sem of p.listSemantics()) {
    const acc = p.getAttribute(sem), A = acc.getArray(), sz = acc.getElementSize();
    const out = new A.constructor(keptT.length * 3 * sz);
    let o = 0;
    for (const t of keptT) for (let j = 0; j < 3; j++) { const v = I[3 * t + j];
      if (sem === 'POSITION') { const c = cen.get(comp[t]); for (let k = 0; k < 3; k++) { const m = c[k] / c[3]; out[o++] = m + (A[3 * v + k] - m) * s; } }
      else for (let k = 0; k < sz; k++) out[o++] = A[v * sz + k]; }
    const na = doc.createAccessor().setType(acc.getType()).setArray(out).setNormalized(acc.getNormalized()).setBuffer(acc.getBuffer());
    p.setAttribute(sem, na);
  }
  p.setIndices(null);
  return [nt, keptT.length];
}

/** Simplificación sloppy de una primitiva indexada (tras weld). */
function sloppy(p, ratio) {
  const I = p.getIndices().getArray(); const P = p.getAttribute('POSITION');
  const pos = new Float32Array(P.getCount() * 3); for (let i = 0; i < P.getCount(); i++) { const e = P.getElement(i, []); pos.set(e, 3 * i); }
  const target = Math.max(3, Math.floor(I.length * ratio / 3) * 3);
  const [out] = MeshoptSimplifier.simplifySloppy(Uint32Array.from(I), pos, 3, null, target, 0.02);
  p.getIndices().setArray(P.getCount() > 65535 ? Uint32Array.from(out) : Uint16Array.from(out));
  compactPrimitive(p);
  return [I.length / 3, out.length / 3];
}

const resumen = {};
for (const g of groups) {
  const doc = await io.read(`../raw/${g}.glb`);
  const cnt = () => { let t = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3; return Math.round(t); };
  const t0 = cnt();
  if (g === 'vegetacion') {
    let seed = 1;
    for (const m of doc.getRoot().listMeshes()) if (HOJA.test(m.getName())) for (const p of m.listPrimitives()) {
      const k = /broadleaf/i.test(m.getName()) ? PODA.broadleaf : PODA.default; podar(doc, p, k, seed++);
    }
  }
  await doc.transform(weld({ tolerance: 0.0001 }));
  if (g === 'contexto') {
    for (const m of doc.getRoot().listMeshes()) { const r = SLOPPY.find(([re]) => re.test(m.getName())); if (r) for (const p of m.listPrimitives()) sloppy(p, r[1]); }
  } else if (SIMPL[g]) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: SIMPL[g][0], error: SIMPL[g][1], lockBorder: false }));
  const t1 = cnt();
  await doc.transform(dedup(), prune(), quantize({ quantizePosition: 16, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  if (g === 'vegetacion') console.log([...corregirArbustos(doc), ...reducirArboles(doc)].join('\n'));
  if (g === 'entrada' || g === 'sitio') console.log(corregirBarandas(doc, g).join('\n'));
  if (g === 'entrada') console.log(corregirEntrada(doc).join('\n'));   // después de barandas.mjs: mueve sus pasamanos con la escalera
  if (g === 'entrada') console.log(corregirPortico(doc).join('\n'));   // después de entrada.mjs: angosta su escalera y corre sus pasamanos
  await io.write(`public/modelo/${g}.glb`, doc);
  const b = fs.readFileSync(`public/modelo/${g}.glb`);
  resumen[g] = { tris0: t0, tris: t1, MB: +(b.length / 1e6).toFixed(2) };
  console.log(g, t0, '->', t1, resumen[g].MB + ' MB');
}
// Sustituto de sombra para las cubiertas: las ~45.000 tejas proyectan sombra con una versión "sloppy"
// de 2 % de sus triángulos (solo la ve la cámara de la sombra; la cámara principal ve las tejas completas).
{
  const doc = await io.read('../raw/cubiertas.glb');
  await doc.transform(weld({ tolerance: 0.0001 }));
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) if (/terracotta/i.test(m.getName())) sloppy(p, 0.02);
  const t = doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + p.getIndices().getCount() / 3, 0), 0);
  await doc.transform(dedup(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 8 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await io.write('public/modelo/cubiertas_sombra.glb', doc);
  resumen.cubiertas_sombra = { tris: Math.round(t), MB: +(fs.statSync('public/modelo/cubiertas_sombra.glb').size / 1e6).toFixed(2) };
  console.log('cubiertas_sombra', resumen.cubiertas_sombra);
}
fs.writeFileSync('public/modelo/resumen.json', JSON.stringify(resumen, null, 1));
