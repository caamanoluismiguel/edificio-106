// Acomoda los árboles reales de arboles_reales.json sobre el modelo: busca para cada uno el corrimiento más corto (hasta 5 m,
// el orden del error de posición: distancia mediana de 4,9 m entre las copas y los árboles de OSM) que deja el tronco sobre
// pasto o concreto (no en calle, estacionamiento, bordillo, vía ni agua) y la copa sin tocar ningún edificio, muro, techo ni poste del modelo. Escribe `corrimiento_escena_m` en el json;
// arboles-reales.mjs lo suma a la posición. Si ningún lugar a 5 m o menos sirve, el árbol se marca `fuera` y no se pone.
//
//   cd fuente && node arboles-acomodar.mjs           escribe los corrimientos en arboles_reales.json
//   node arboles-acomodar.mjs --medir                solo los lista
//   node arboles-acomodar.mjs --comprobar            revisa los árboles en su lugar actual (con el corrimiento ya guardado)
//
// El suelo y los obstáculos salen de los GLB de ../modelo (sitio, contexto, arquitectura, cubiertas, detalles, entrada); la
// vegetación no cuenta. La copa de cada árbol se toma como la del molde escalada (`molde` en el json, medido por
// `node arboles-reales.mjs --medir` sobre el anillo de relleno): alcance de las hojas en planta y altura donde empieza.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arbolesReales } from './arboles-reales.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), ARCHIVO = path.join(AQUI, 'arboles_reales.json');
const SUELO = /grass|turf|asphalt|paving|road paint|kerb|street|ballast|water/i, DURO = /asphalt|road paint|kerb|ballast|water/i;   // en calle, estacionamiento, bordillo, vía o agua no va un tronco
const MAX = 5, PASO = 0.25, GIROS = 32, R_TRONCO = 0.6, HOLGURA = 0.5;
const aplicar = (M, [x, y, z]) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];

/** Distancia en planta de un punto a un triángulo (0 si cae dentro). */
function distTri(x, z, t) {
  const [ax, az, bx, bz, cx, cz] = t, d1 = (x - bx) * (az - bz) - (ax - bx) * (z - bz), d2 = (x - cx) * (bz - cz) - (bx - cx) * (z - cz), d3 = (x - ax) * (cz - az) - (cx - ax) * (z - az);
  if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return 0;
  const seg = (px, pz, qx, qz) => { const dx = qx - px, dz = qz - pz, u = Math.max(0, Math.min(1, ((x - px) * dx + (z - pz) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - px - u * dx, z - pz - u * dz); };
  return Math.min(seg(ax, az, bx, bz), seg(bx, bz, cx, cz), seg(cx, cz, ax, az));
}

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const j = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')), M = j.molde;
const comprobar = process.argv.includes('--comprobar');
if (!comprobar) for (const a of j.arboles) { delete a.corrimiento_escena_m; delete a.fuera; }   // se parte siempre de la posición del dato
fs.writeFileSync(ARCHIVO + '.tmp', JSON.stringify(j)); const reales = arbolesReales(ARCHIVO + '.tmp'); fs.rmSync(ARCHIVO + '.tmp');
const lejos = Math.max(...reales.map((r) => Math.hypot(r.x, r.z))) + 30;
const suelo = [], obst = [];                                            // [ax, az, bx, bz, cx, cz, y0, y1, pasto]
for (const g of ['sitio', 'contexto', 'arquitectura', 'cubiertas', 'detalles', 'entrada']) {
  const doc = await io.read(path.join(AQUI, `../modelo/${g}.glb`));
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m) continue; const W = n.getWorldMatrix();
    for (const p of m.listPrimitives()) {
      const mat = p.getMaterial()?.getName() ?? '', esSuelo = SUELO.test(mat), pasto = !DURO.test(mat);
      const A = p.getAttribute('POSITION'), e = [0, 0, 0], nv = A.getCount(), P = new Float64Array(nv * 3);
      for (let i = 0; i < nv; i++) P.set(aplicar(W, A.getElement(i, e)), 3 * i);
      const I = p.getIndices()?.getArray() ?? Uint32Array.from({ length: nv }, (_, i) => i);
      for (let t = 0; t < I.length; t += 3) {
        const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
        if (Math.min(P[a], P[b], P[c]) > lejos || Math.max(P[a], P[b], P[c]) < -lejos || Math.min(P[a + 2], P[b + 2], P[c + 2]) > lejos || Math.max(P[a + 2], P[b + 2], P[c + 2]) < -lejos) continue;   // fuera del cuadro (los triángulos del suelo pueden ser enormes)
        const y0 = Math.min(P[a + 1], P[b + 1], P[c + 1]), y1 = Math.max(P[a + 1], P[b + 1], P[c + 1]);
        if (Math.abs((P[b] - P[a]) * (P[c + 2] - P[a + 2]) - (P[c] - P[a]) * (P[b + 2] - P[a + 2])) < 1e-6) continue;   // vertical o degenerado en planta: no tapa nada desde arriba
        const tri = [P[a], P[a + 2], P[b], P[b + 2], P[c], P[c + 2], y0, y1, pasto, mat];
        if (esSuelo && y1 < 1.2) suelo.push(tri); else if (!esSuelo && y1 > 0.3) obst.push(tri);
      }
    }
  }
}
/** ¿Sirve el tronco en (x, z) para el árbol r? Devuelve null si sirve o el motivo si no. */
function motivo(r, x, z) {
  for (const [ox, oz] of [[0, 0], ...Array.from({ length: 8 }, (_, k) => [R_TRONCO * Math.cos(k * Math.PI / 4), R_TRONCO * Math.sin(k * Math.PI / 4)])]) {
    let arriba = null;                                                  // la capa de suelo más alta bajo ese punto
    for (const t of suelo) if (distTri(x + ox, z + oz, t) === 0 && (!arriba || t[7] > arriba[7])) arriba = t;
    if (!arriba || !arriba[8]) return `tronco sobre ${arriba ? arriba[9] : 'nada'}`;
  }
  const sh = r.diam / M.diam, sv = r.alto / M.alto, alcance = M.alcance * sh + HOLGURA, base = M.base * sv;
  for (const t of obst) {
    if (t[6] > r.alto) continue;                                        // por encima de la copa
    const d = distTri(x, z, t);
    if (t[7] > base && d < alcance) return 'la copa toca un edificio';
    if (d < R_TRONCO + HOLGURA) return 'el tronco toca un edificio';
  }
  return null;
}
if (comprobar) {
  let mal = 0;
  for (const r of reales) { const m = motivo(r, r.x, r.z); if (m) mal++; console.log(`#${r.id} en (${r.x.toFixed(1)}, ${r.z.toFixed(1)}): ${m ?? 'bien'}`); }
  console.log(mal ? `${mal} árbol(es) mal puestos` : `los ${reales.length} árboles están bien puestos`); process.exit(mal ? 1 : 0);
}
const res = [];
for (const [k, r] of reales.entries()) {
  const a = j.arboles[k]; let hecho = null, primero = motivo(r, r.x, r.z);
  if (!primero) hecho = [0, 0];
  for (let d = PASO; !hecho && d <= MAX + 1e-9; d += PASO)
    for (let g = 0; g < GIROS && !hecho; g++) { const ang = 2 * Math.PI * g / GIROS, dx = d * Math.cos(ang), dz = d * Math.sin(ang); if (!motivo(r, r.x + dx, r.z + dz)) hecho = [dx, dz]; }
  if (hecho) { a.corrimiento_escena_m = hecho.map((v) => +v.toFixed(2)); delete a.fuera; } else a.fuera = primero;
  const bajo = hecho ? (() => { let ar = null; for (const t of suelo) if (distTri(r.x + hecho[0], r.z + hecho[1], t) === 0 && (!ar || t[7] > ar[7])) ar = t; return ar ? ar[9] : 'nada'; })() : '';
  if (hecho) a.suelo = bajo;
  res.push(`#${r.id}: ${bajo ? `sobre ${bajo}; ` : ''}${primero ? `${primero}; ` : ''}${hecho ? `corrido ${Math.hypot(...hecho).toFixed(2)} m` : `FUERA (nada a ${MAX} m o menos)`}`);
}
console.log(res.join('\n'));
if (!process.argv.includes('--medir')) { fs.writeFileSync(ARCHIVO, JSON.stringify(j, null, 1) + '\n'); console.log('escrito', ARCHIVO); }
