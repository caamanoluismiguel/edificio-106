// Puntos de la animación de armado (datos/intro.bin.gz), desde los modelos web (modelo/*.glb). Es el mismo cálculo de
// precalcular.py, que lee la exportación cruda de Blender (../raw/*.glb, que no está en el repositorio): así los puntos se
// pueden rehacer cuando cambia un .glb (el contexto de OpenStreetMap, el seto quitado de vegetacion.glb, los árboles del
// anillo). Diferencias con precalcular.py: lee los nodos con su transformación (el contexto repite la malla del 106 reducido
// en tres huellas) y todas las primitivas de cada malla; el pasto lejano del contexto no recibe puntos (es un plano de
// 360 × 140 m que se llevaba casi la mitad de los del grupo, lejos de los edificios); azar propio (mulberry32, semilla 106).
//
//   cd fuente && node intro.mjs           escribe ../datos/intro.bin.gz
//
// Formato (src/datos.js): 'P106' + n (uint32), n×3 int16 (posición × 0,02 m), n×3 uint8 (color), n×3 uint8 (grupo,
// altura normalizada × 255, azar × 255); en orden aleatorio, así que cualquier prefijo es una muestra proporcional.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MODELO = path.join(AQUI, '..', 'modelo');
const SALIDA = process.argv[2] ?? path.join(AQUI, '..', 'datos', 'intro.bin.gz');
const GRUPOS = ['sitio', 'arquitectura', 'ventanas', 'cubiertas', 'entrada', 'detalles', 'vegetacion', 'contexto'];
const CUOTA = { sitio: 0.11, arquitectura: 0.19, ventanas: 0.10, cubiertas: 0.20, entrada: 0.05, detalles: 0.05, vegetacion: 0.2, contexto: 0.10 };   // = escena.js
const N = 90000;                                   // la web usa hasta 90.000 (calidad alta)
const SIN_PUNTOS = /distant park turf/i;

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry(106);

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

const filas = [];
for (let gi = 0; gi < GRUPOS.length; gi++) {
  const g = GRUPOS[gi], doc = await io.read(path.join(MODELO, g + '.glb'));
  const T = [], C = [];                            // triángulos (9 floats) y color (3) por triángulo
  for (const nodo of doc.getRoot().listNodes()) {
    const malla = nodo.getMesh(); if (!malla) continue;
    const M = nodo.getWorldMatrix();
    for (const p of malla.listPrimitives()) {
      const mat = p.getMaterial(); if (SIN_PUNTOS.test(mat?.getName() ?? '')) continue;
      const col = (mat?.getBaseColorFactor() ?? [0.7, 0.7, 0.7, 1]).slice(0, 3);
      const A = p.getAttribute('POSITION'), I = p.getIndices(), v = [0, 0, 0], w = new Float64Array(A.getCount() * 3);
      for (let k = 0; k < A.getCount(); k++) { A.getElement(k, v); w[3 * k] = M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12]; w[3 * k + 1] = M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13]; w[3 * k + 2] = M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]; }
      const n = I ? I.getCount() : A.getCount();
      for (let t = 0; t + 2 < n; t += 3) { for (let c = 0; c < 3; c++) { const j = I ? I.getScalar(t + c) : t + c; T.push(w[3 * j], w[3 * j + 1], w[3 * j + 2]); } C.push(...col); }
    }
  }
  const nt = T.length / 9, area = new Float64Array(nt);
  let y0 = Infinity, y1 = -Infinity, tot = 0;
  for (let t = 0; t < nt; t++) {
    const o = 9 * t, ux = T[o + 3] - T[o], uy = T[o + 4] - T[o + 1], uz = T[o + 5] - T[o + 2], vx = T[o + 6] - T[o], vy = T[o + 7] - T[o + 1], vz = T[o + 8] - T[o + 2];
    area[t] = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); tot += area[t];
    for (const y of [T[o + 1], T[o + 4], T[o + 7]]) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  const acum = new Float64Array(nt); let s = 0; for (let t = 0; t < nt; t++) { s += area[t]; acum[t] = s / tot; }
  const n = Math.round(N * CUOTA[g]);
  for (let k = 0; k < n; k++) {
    const r = rnd(); let lo = 0, hi = nt - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (acum[mid] < r) lo = mid + 1; else hi = mid; }
    let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const o = 9 * lo, P = [0, 1, 2].map((c) => T[o + c] + (T[o + 3 + c] - T[o + c]) * u + (T[o + 6 + c] - T[o + c]) * v);
    const h = g === 'contexto' ? Math.min(1, Math.hypot(P[0], P[2]) / 450) : (P[1] - y0) / Math.max(0.5, y1 - y0);
    // color visible: lineal, un poco más brillante para que brille como punto (igual que precalcular.py)
    const b = 0.65 + 0.35 * rnd(), col = [0, 1, 2].map((c) => Math.min(1, Math.max(0, C[3 * lo + c] * 1.2 + 0.07)) * b);
    filas.push([P, col, gi, Math.min(1, Math.max(0, h)), rnd()]);
  }
  console.log(g, n, 'puntos ·', nt, 'triángulos');
}
// orden aleatorio (Fisher-Yates)
for (let i = filas.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [filas[i], filas[j]] = [filas[j], filas[i]]; }
const n = filas.length, buf = Buffer.alloc(8 + n * 12);
buf.write('P106', 0, 'latin1'); buf.writeUInt32LE(n, 4);
const pos = new Int16Array(buf.buffer, buf.byteOffset + 8, n * 3);
filas.forEach(([P, col, g, h, r], i) => {
  for (let c = 0; c < 3; c++) { pos[3 * i + c] = Math.max(-32768, Math.min(32767, Math.round(P[c] / 0.02))); buf[8 + n * 6 + 3 * i + c] = Math.round(col[c] * 255); }
  buf[8 + n * 9 + 3 * i] = g; buf[8 + n * 9 + 3 * i + 1] = Math.round(h * 255); buf[8 + n * 9 + 3 * i + 2] = Math.round(r * 255);
});
const gz = zlib.gzipSync(buf, { level: 9 });
fs.writeFileSync(SALIDA, gz);
console.log('intro', n, (buf.length / 1e6).toFixed(2), 'MB crudo,', (gz.length / 1e6).toFixed(2), 'MB gz →', SALIDA);
