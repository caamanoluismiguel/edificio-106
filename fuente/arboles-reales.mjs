// Cambia el anillo de árboles de relleno de vegetacion.glb («V016 tropical tree bark» + «V016 broadleaf shade 0–6», árboles
// iguales puestos en rejilla en la v016) por los árboles reales de arboles_reales.json: copas detectadas en el mapa de altura de
// copa de Meta y WRI (rejilla de 1,18 m en el suelo, imágenes de 2018) y miradas en 2026 en Street View (imágenes de nov 2022), a 150 m
// o menos del 106. Sin especie.
//
// Cada árbol real es una copia del árbol de relleno más completo (el molde), girada al azar (fijo por árbol) y escalada: en
// alto, a la altura del dato; en planta, para que el círculo de igual área que la copa del molde mida el diámetro del dato
// (la misma definición que usa copas.py; en vertical la hoja no queda igual a la del molde). La posición sale de la latitud y longitud con el mismo registro que el entorno de OSM
// (contexto-osm.mjs). Las mallas nuevas se llaman «V018 real tree…» y usan los mismos materiales que el anillo.
// Paso reproducible y sin efecto si se repite (si ya no hay anillo, no hace nada).
//
//   cd fuente && node arboles-reales.mjs            corrige ../modelo/vegetacion.glb en su lugar
//   node arboles-reales.mjs entrada.glb salida.glb  o de un archivo a otro
//   node arboles-reales.mjs --medir                 lista el molde y los árboles sin escribir nada
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aEscena, osmRegistrado } from './contexto-osm.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ANILLO = /^V016 (tropical tree bark|broadleaf shade \d)$/;
const NUEVO = (n) => n.replace('V016 tropical tree bark', 'V018 real tree bark').replace(/V016 broadleaf shade (\d)/, 'V018 real tree broadleaf $1');

const aplicar = (M, [x, y, z]) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
const rnd = (i) => { let x = (i * 2654435761) >>> 0; x ^= x >>> 16; x = Math.imul(x, 2246822507) >>> 0; x ^= x >>> 13; x = Math.imul(x, 3266489909) >>> 0; x ^= x >>> 16; return (x >>> 0) / 4294967296; };
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
export function ponerArbolesReales(doc, { medir = false } = {}) {
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
  if (!prims.length) return ['el anillo ya no está (los árboles reales ya se pusieron)'];
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
  const reales = arbolesReales();
  const res = [`anillo: ${pies.length} árboles de relleno; molde en (${molde.c.map((v) => v.toFixed(1)).join(', ')}), ${molde.alto.toFixed(1)} m de alto, copa de ${molde.diam.toFixed(1)} m, ${molde.hojas} triángulos de hoja`];
  for (const r of reales) res.push(`árbol real #${r.id} en (${r.x.toFixed(1)}, ${r.z.toFixed(1)}): ${r.alto} m de alto, copa de ${r.diam} m (escala ${(r.diam / molde.diam).toFixed(2)} en planta, ${(r.alto / molde.alto).toFixed(2)} en alto)`);
  if (medir) return Object.assign(res, { molde: { alto: molde.alto, diam: molde.diam, alcance: molde.alcance, base: molde.base } });
  // 4) cada primitiva del anillo se rehace con las copias del molde, una por árbol real
  // En las copas más chicas que el molde se conserva solo una fracción k = (escala en planta)² de las hojas, y cada hoja
  // conservada se agranda 1/√k alrededor de su centro (poda estocástica de Cook et al. 2007, la misma de optimize2.mjs): la
  // copa tapa lo mismo, las hojas quedan del tamaño de las del molde y el archivo no crece con cada árbol chico.
  const pos = [], nor = [], ind = new Map(prims.map((pr) => [pr, []]));
  let hojas = 0;
  prims.forEach((pr, ip) => {
    const piezas = molde.piezas.filter((q) => q.pr === pr).map(({ s }) => {
      const vs = [...new Set(s.tris.flatMap((t) => [pr.I[3 * t], pr.I[3 * t + 1], pr.I[3 * t + 2]]))], c = [0, 0, 0];
      for (const v of vs) for (let j = 0; j < 3; j++) c[j] += pr.P[3 * v + j] / vs.length;
      return { s, vs, c };
    });
    const P = [], Nn = [], I = ind.get(pr);
    reales.forEach((r) => {
      const sh = r.diam / molde.diam, sv = r.alto / molde.alto, a = rnd(r.id) * 2 * Math.PI, co = Math.cos(a), si = Math.sin(a);
      const k = pr.tronco ? 1 : Math.min(1, sh * sh), f = 1 / Math.sqrt(k);
      piezas.forEach(({ s, vs, c }, j) => {
        if (rnd(r.id * 100003 + ip * 7919 + j) >= k) return;
        if (!pr.tronco) hojas += s.tris.length;
        const o = P.length / 3, nuevo = new Map(vs.map((v, i) => [v, o + i]));
        for (const v of vs) {
          const q = [0, 1, 2].map((e) => c[e] + (pr.P[3 * v + e] - c[e]) * f);   // la hoja agrandada alrededor de su centro
          const dx = (q[0] - molde.c[0]) * sh, dz = (q[2] - molde.c[1]) * sh;
          P.push(r.x + dx * co - dz * si, molde.y0 + (q[1] - molde.y0) * sv, r.z + dx * si + dz * co);
          const nx = pr.Nr[3 * v] / sh, ny = pr.Nr[3 * v + 1] / sv, nz = pr.Nr[3 * v + 2] / sh, l = Math.hypot(nx, ny, nz) || 1;   // inversa transpuesta de la escala
          Nn.push((nx * co - nz * si) / l, ny / l, (nx * si + nz * co) / l);
        }
        for (const t of s.tris) for (let e = 0; e < 3; e++) I.push(nuevo.get(pr.I[3 * t + e]));
      });
    });
    pos.push(Float64Array.from(P)); nor.push(Float64Array.from(Nn));
  });
  prims.forEach((pr, ip) => {
    const P = pos[ip], Nn = nor[ip], I = ind.get(pr), nv = P.length / 3;
    // misma cuantización que el resto del archivo: posiciones int16 normalizadas con escala uniforme y traslación en el nodo
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < nv; i++) for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], P[3 * i + j]); hi[j] = Math.max(hi[j], P[3 * i + j]); }
    const T = lo.map((v, j) => (v + hi[j]) / 2), S = Math.max(...hi.map((v, j) => (v - lo[j]) / 2)) || 1;
    const A = pr.p.getAttribute('POSITION'), N = pr.p.getAttribute('NORMAL');
    const qp = new (A.getArray().constructor)(nv * 3), qn = new (N.getArray().constructor)(nv * 3);
    const maxP = 2 ** (8 * qp.BYTES_PER_ELEMENT - 1) - 1, maxN = 2 ** (8 * qn.BYTES_PER_ELEMENT - 1) - 1;
    for (let i = 0; i < nv * 3; i++) { qp[i] = Math.round((P[i] - T[i % 3]) / S * maxP); qn[i] = Math.round(Nn[i] * maxN); }
    A.setArray(qp); N.setArray(qn);
    const idx = pr.p.getIndices(); idx.setArray(nv > 65535 ? Uint32Array.from(I) : Uint16Array.from(I));
    pr.n.setMatrix([S, 0, 0, 0, 0, S, 0, 0, 0, 0, S, 0, T[0], T[1], T[2], 1]);
    pr.n.setName(NUEVO(pr.n.getName())); pr.m.setName(NUEVO(pr.m.getName()));
  });
  res.push(`puestos ${reales.length} árboles reales en lugar de los ${pies.length} de relleno (${hojas} triángulos de hoja)`);
  return res;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await MeshoptDecoder.ready; await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--')), medir = process.argv.includes('--medir');
  const ent = args[0] ?? path.join(AQUI, '../modelo/vegetacion.glb'), sal = args[1] ?? ent;
  const doc = await io.read(ent);
  const r = ponerArbolesReales(doc, { medir });
  console.log(r.join('\n'));
  if (!medir && !/ya no está/.test(r[0])) {
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
    await io.write(sal, doc); console.log('escrito', sal);
  }
}
