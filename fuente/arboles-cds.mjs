// modelo/arboles.glb: las copas de Ciudad del Saber como instancias (EXT_mesh_gpu_instancing) de un molde liviano. Datos:
// arboles_cds.geojson (copas sacadas del mapa de altura de copa de Meta y WRI con copas.py, imágenes Maxar de 2018). Entran todas
// las copas a más de 150 m del 106 (ahí están los árboles de vegetacion.glb): las sueltas con el 12 % de las hojas del molde y las
// de masa (tocan otra copa o están en un bosque de OSM) con el 20 %, para que el bosque se lea tupido sin superficies inventadas. Cada una: el molde (molde-arbol.glb) podado (Cook et al. 2007, como optimize2.mjs), girado al azar fijo y
// escalado a su altura y su diámetro de copa, con el pie en el suelo del modelo. El tronco se corre hasta 5 m si cae en
// calle, estacionamiento, bordillo, vía o agua, o pegado a un edificio (como arboles-acomodar.mjs); si no hay lugar, no entra.
//
//   cd fuente && node arboles-cds.mjs [--geojson=ruta] [--hojas=0.12] [--hojas-masa=0.2]   escribe arboles.glb y arboles_movil.glb
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshGPUInstancing, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aEscena, osmRegistrado } from './contexto-osm.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const GEOJSON = arg('geojson', path.join(AQUI, 'arboles_cds.geojson')), K_HOJAS = +arg('hojas', 0.12), K_MASA = +arg('hojas-masa', 0.2);
const CERCA_106 = 150, MAX = 5, PASO = 0.5, GIROS = 16, R_TRONCO = 0.6, HOLGURA = 0.5;
const SUELO = /grass|turf|asphalt|paving|road paint|kerb|street|ballast|water/i, DURO = /asphalt|road paint|kerb|ballast|water/i;
const rnd = (i) => { let x = (i * 2654435761) >>> 0; x ^= x >>> 16; x = Math.imul(x, 2246822507) >>> 0; x ^= x >>> 13; x = Math.imul(x, 3266489909) >>> 0; x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const aplicar = (M, [x, y, z]) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];

await MeshoptDecoder.ready; await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// 1) las copas, en la escena
const { rotacionGrados: g, centroOSM106: c0 } = osmRegistrado().registro, th = g * Math.PI / 180;
const reg = (lat, lon) => { const [x, z] = aEscena(lat, lon), dx = x - c0[0], dz = z - c0[1]; return [dx * Math.cos(th) - dz * Math.sin(th), dx * Math.sin(th) + dz * Math.cos(th)]; };
const copas = JSON.parse(fs.readFileSync(GEOJSON, 'utf8')).features.map((f, id) => ({ id, ...f.properties, p: reg(f.geometry.coordinates[1], f.geometry.coordinates[0]) }))
  .filter((c) => Math.hypot(...c.p) > CERCA_106)
  .map((c) => ({ ...c, masa: !(c.copa_separada && !c.en_bosque_osm) }));   // masa: copa que toca otra o en un bosque de OSM (molde más liviano)

// 2) suelo y obstáculos del modelo, en una rejilla de 4 m (para buscar rápido)
const C = 4, rej = { suelo: new Map(), obst: new Map() }, clave = (i, k) => i * 65536 + k;
const meter = (m, t) => { for (let i = Math.floor(t.x0 / C); i <= Math.floor(t.x1 / C); i++) for (let k = Math.floor(t.z0 / C); k <= Math.floor(t.z1 / C); k++) { const q = clave(i, k); if (!m.has(q)) m.set(q, []); m.get(q).push(t); } };
for (const gr of ['sitio', 'contexto', 'arquitectura', 'cubiertas', 'detalles', 'entrada']) {
  const doc = await io.read(path.join(AQUI, `../modelo/${gr}.glb`));
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m) continue; const W = n.getWorldMatrix();
    for (const p of m.listPrimitives()) {
      const mat = p.getMaterial()?.getName() ?? '', esSuelo = SUELO.test(mat), duro = DURO.test(mat);
      const A = p.getAttribute('POSITION'), e = [0, 0, 0], nv = A.getCount(), P = new Float64Array(nv * 3);
      for (let i = 0; i < nv; i++) P.set(aplicar(W, A.getElement(i, e)), 3 * i);
      const I = p.getIndices()?.getArray() ?? Uint32Array.from({ length: nv }, (_, i) => i);
      for (let t = 0; t < I.length; t += 3) {
        const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
        if (Math.abs((P[b] - P[a]) * (P[c + 2] - P[a + 2]) - (P[c] - P[a]) * (P[b + 2] - P[a + 2])) < 1e-6) continue;
        const tri = { v: [P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[c], P[c + 1], P[c + 2]], x0: Math.min(P[a], P[b], P[c]), x1: Math.max(P[a], P[b], P[c]), z0: Math.min(P[a + 2], P[b + 2], P[c + 2]), z1: Math.max(P[a + 2], P[b + 2], P[c + 2]), y0: Math.min(P[a + 1], P[b + 1], P[c + 1]), y1: Math.max(P[a + 1], P[b + 1], P[c + 1]), duro };
        if (tri.x1 - tri.x0 > 400 || tri.z1 - tri.z0 > 400) { if (esSuelo) { tri.grande = true; } else continue; }
        if (esSuelo) meter(rej.suelo, tri); else if (tri.y1 > 0.3) meter(rej.obst, tri);
      }
    }
  }
}
const bari = (x, z, v) => {        // coordenadas baricéntricas en planta, o null si (x, z) cae fuera
  const d = (v[3] - v[0]) * (v[8] - v[2]) - (v[6] - v[0]) * (v[5] - v[2]);
  const u = ((v[3] - x) * (v[8] - z) - (v[6] - x) * (v[5] - z)) / d, w = ((v[6] - x) * (v[2] - z) - (v[0] - x) * (v[8] - z)) / d;
  return u >= -1e-9 && w >= -1e-9 && u + w <= 1 + 1e-9 ? [u, w, 1 - u - w] : null;
};
const distTri = (x, z, v) => {
  if (bari(x, z, v)) return 0;
  const seg = (px, pz, qx, qz) => { const dx = qx - px, dz = qz - pz, u = Math.max(0, Math.min(1, ((x - px) * dx + (z - pz) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - px - u * dx, z - pz - u * dz); };
  return Math.min(seg(v[0], v[2], v[3], v[5]), seg(v[3], v[5], v[6], v[8]), seg(v[6], v[8], v[0], v[2]));
};
/** La capa de suelo más alta en (x, z): { y, duro } o null. */
function suelo(x, z) {
  let mejor = null;
  for (const t of rej.suelo.get(clave(Math.floor(x / C), Math.floor(z / C))) ?? []) {
    const b = bari(x, z, t.v); if (!b) continue; const y = b[0] * t.v[1] + b[1] * t.v[4] + b[2] * t.v[7];
    if (!mejor || y > mejor.y) mejor = { y, duro: t.duro };
  }
  return mejor;
}
const molde = await io.read(path.join(AQUI, 'molde-arbol.glb'));
const MOLDE = { alto: 18.22, diam: 18.11, alcance: 10.42, base: 7.13 };   // node molde-arbol.mjs
function motivo(c, x, z) {
  for (const [ox, oz] of [[0, 0], ...Array.from({ length: 8 }, (_, k) => [R_TRONCO * Math.cos(k * Math.PI / 4), R_TRONCO * Math.sin(k * Math.PI / 4)])]) {
    const s = suelo(x + ox, z + oz); if (!s) return 'sin suelo'; if (s.duro) return 'tronco en calle o estacionamiento';
  }
  const sh = c.diametro_copa_m / MOLDE.diam, sv = c.altura_m / MOLDE.alto, alcance = MOLDE.alcance * sh + HOLGURA, base = MOLDE.base * sv, y0 = suelo(x, z).y;
  const R = Math.ceil((alcance + C) / C), vistos = new Set();
  for (let i = -R; i <= R; i++) for (let k = -R; k <= R; k++) for (const t of rej.obst.get(clave(Math.floor(x / C) + i, Math.floor(z / C) + k)) ?? []) {
    if (vistos.has(t)) continue; vistos.add(t);
    if (t.y0 > y0 + c.altura_m || t.y1 < y0) continue;
    const d = distTri(x, z, t.v);
    if (t.y1 > y0 + base && d < alcance) return 'la copa toca un edificio';
    if (d < R_TRONCO + HOLGURA) return 'el tronco toca un edificio';
  }
  return null;
}

// 3) dónde va cada árbol
const puestos = [], fuera = {};
for (const c of copas) {
  let hecho = motivo(c, ...c.p) ? null : [0, 0];
  for (let d = PASO; !hecho && d <= MAX + 1e-9; d += PASO) for (let gi = 0; gi < GIROS && !hecho; gi++) { const a = 2 * Math.PI * gi / GIROS, dx = d * Math.cos(a), dz = d * Math.sin(a); if (!motivo(c, c.p[0] + dx, c.p[1] + dz)) hecho = [dx, dz]; }
  if (!hecho) { const m = motivo(c, ...c.p); fuera[m] = (fuera[m] ?? 0) + 1; continue; }
  const x = c.p[0] + hecho[0], z = c.p[1] + hecho[1];
  puestos.push({ c, x, z, y: suelo(x, z).y, corrido: Math.hypot(...hecho) });
}

// 4) el molde liviano: una fracción de las hojas, agrandadas 1/√k; el tronco simplificado. Dos archivos: arboles.glb con todas
//    las copas y arboles_movil.glb solo con las sueltas (el teléfono, como cubiertas_movil.glb)
async function escribir(archivo, conMasa) {
  const doc = new Document(), buf = doc.createBuffer(), escena = doc.createScene('arboles');
  const inst = doc.createExtension(EXTMeshGPUInstancing).setRequired(true);
  const ac = (a, t) => doc.createAccessor().setType(t).setArray(a).setBuffer(buf);
  const raiz = doc.createNode('arboles'); escena.addChild(raiz);
  const materiales = new Map();
  let tris = 0;
  function plantilla(lista, k, sufijo) {
    if (!lista.length) return;
    const T = new Float32Array(lista.length * 3), Q = new Float32Array(lista.length * 4), S = new Float32Array(lista.length * 3);
    lista.forEach(({ c, x, y, z }, i) => {
      const a = rnd(c.id) * Math.PI; T.set([x, y, z], 3 * i); Q.set([0, Math.sin(a), 0, Math.cos(a)], 4 * i);
      S.set([c.diametro_copa_m / MOLDE.diam, c.altura_m / MOLDE.alto, c.diametro_copa_m / MOLDE.diam], 3 * i);
    });
    const aT = ac(T, 'VEC3'), aQ = ac(Q, 'VEC4'), aS = ac(S, 'VEC3');
    for (const m of molde.getRoot().listMeshes()) {
      const p0 = m.listPrimitives()[0], A = p0.getAttribute('POSITION').getArray(), N = p0.getAttribute('NORMAL').getArray(), I = p0.getIndices().getArray();
      const tronco = /bark/.test(m.getName());
      // hojas: componentes conexas (cada hoja), se queda una fracción k agrandada alrededor de su centro
      let P = Array.from(A), NN = Array.from(N), II = Array.from(I);
      if (tronco) {                     // el tronco, a una sexta parte de sus triángulos (meshoptimizer)
        const [ind] = MeshoptSimplifier.simplify(Uint32Array.from(I), Float32Array.from(A), 3, Math.max(36, Math.floor(I.length / 6 / 3) * 3), 0.02);
        II = Array.from(ind);
      } else {
        const par = Int32Array.from({ length: A.length / 3 }, (_, i) => i), f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
        for (let t = 0; t < I.length; t += 3) { const r = f(I[t]); par[f(I[t + 1])] = r; par[f(I[t + 2])] = r; }
        const hojas = new Map(); for (let t = 0; t < I.length; t += 3) { const r = f(I[t]); if (!hojas.has(r)) hojas.set(r, []); hojas.get(r).push(t); }
        const fac = 1 / Math.sqrt(k); P = []; NN = []; II = []; let j = 0;
        for (const [r, ts] of hojas) {
          if (rnd(r * 7919 + 13) >= k) continue;
          const vs = [...new Set(ts.flatMap((t) => [I[t], I[t + 1], I[t + 2]]))], cen = [0, 1, 2].map((e) => vs.reduce((s, v) => s + A[3 * v + e], 0) / vs.length), nuevo = new Map();
          for (const v of vs) { nuevo.set(v, j++); for (let e = 0; e < 3; e++) { P.push(cen[e] + (A[3 * v + e] - cen[e]) * fac); NN.push(N[3 * v + e]); } }
          for (const t of ts) II.push(nuevo.get(I[t]), nuevo.get(I[t + 1]), nuevo.get(I[t + 2]));
        }
      }
      const mm = p0.getMaterial();
      if (!materiales.has(mm.getName())) materiales.set(mm.getName(), doc.createMaterial(mm.getName()).setBaseColorFactor(mm.getBaseColorFactor()).setRoughnessFactor(mm.getRoughnessFactor()).setMetallicFactor(0).setDoubleSided(mm.getDoubleSided()).setExtras(mm.getExtras()));
      const alt = new Float32Array(P.length / 3); for (let i = 0; i < alt.length; i++) alt[i] = Math.min(1.6, Math.max(0, P[3 * i + 1]) * 0.06);   // para el viento: ~altura sobre el suelo /10 de un árbol típico (escala vertical ~0,6)
      const prim = doc.createPrimitive().setMaterial(materiales.get(mm.getName())).setAttribute('POSITION', ac(Float32Array.from(P), 'VEC3')).setAttribute('NORMAL', ac(Float32Array.from(NN), 'VEC3')).setAttribute('_ALTURA', ac(alt, 'SCALAR')).setIndices(ac(Uint32Array.from(II), 'SCALAR'));
      const malla = doc.createMesh(m.getName().replace('molde ', `V019 cds ${sufijo} `)).addPrimitive(prim);
      raiz.addChild(doc.createNode(malla.getName()).setMesh(malla).setExtension('EXT_mesh_gpu_instancing', inst.createInstancedMesh().setAttribute('TRANSLATION', aT).setAttribute('ROTATION', aQ).setAttribute('SCALE', aS)));
      tris += (II.length / 3) * lista.length;
    }
  }
  plantilla(puestos.filter((p) => !p.c.masa), K_HOJAS, 'tree');
  if (conMasa) plantilla(puestos.filter((p) => p.c.masa), K_MASA, 'stand');
  await doc.transform(prune());
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await io.write(path.join(AQUI, `../modelo/${archivo}`), doc);
  console.log(`${archivo}: ${(fs.statSync(path.join(AQUI, `../modelo/${archivo}`)).size / 1024).toFixed(0)} KB, ${(tris / 1e6).toFixed(2)} M triángulos dibujados`);
}
console.log(`copas a más de ${CERCA_106} m del 106: ${copas.length}; puestas ${puestos.length} (${puestos.filter((p) => !p.c.masa).length} sueltas, ${puestos.filter((p) => p.c.masa).length} de masa; corridas ${puestos.filter((p) => p.corrido > 0).length}); fuera: ${JSON.stringify(fuera)}; suelo de ${Math.min(...puestos.map((p) => p.y)).toFixed(1)} a ${Math.max(...puestos.map((p) => p.y)).toFixed(1)} m`);
await escribir('arboles.glb', true);
await escribir('arboles_movil.glb', false);
