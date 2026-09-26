// Geometría del modelo para las comprobaciones (fuente/verificar.mjs): lee los .glb de la raíz del sitio,
// los pasa a triángulos en coordenadas de la escena (las mismas de three.js: los glTF no se transforman al cargar)
// y lanza rayos contra ellos con un árbol de cajas (BVH) sencillo. No depende del navegador ni de la app.
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

/** Carga los grupos pedidos y devuelve { tri: Float32Array (9 por triángulo), mat: Uint16Array, nombres, grupo: Uint8Array }. */
export async function cargarTriangulos(raiz, grupos) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const tri = [], mat = [], grp = [], nombres = [], idxNombre = new Map();
  for (let gi = 0; gi < grupos.length; gi++) {
    const doc = await io.read(path.join(raiz, 'modelo', grupos[gi] + '.glb'));
    for (const nodo of doc.getRoot().listNodes()) {
      const malla = nodo.getMesh(); if (!malla) continue;
      const M = nodo.getWorldMatrix();
      // instancias (EXT_mesh_gpu_instancing): no aparecen en estos modelos, pero si llegaran se avisa
      if (nodo.getExtension('EXT_mesh_gpu_instancing')) console.warn(`aviso: ${grupos[gi]} tiene instancias que esta lectura ignora`);
      for (const p of malla.listPrimitives()) {
        if (p.getMode() !== 4) continue;                         // solo triángulos
        const nm = p.getMaterial()?.getName() ?? '';
        if (!idxNombre.has(nm)) { idxNombre.set(nm, nombres.length); nombres.push(nm); }
        const k = idxNombre.get(nm);
        const pos = p.getAttribute('POSITION'), ind = p.getIndices();
        const n = ind ? ind.getCount() : pos.getCount();
        const v = [0, 0, 0], w = new Float32Array(pos.getCount() * 3);
        for (let i = 0; i < pos.getCount(); i++) {
          pos.getElement(i, v);
          w[i * 3] = M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12];
          w[i * 3 + 1] = M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13];
          w[i * 3 + 2] = M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14];
        }
        for (let t = 0; t + 2 < n; t += 3) {
          for (let c = 0; c < 3; c++) { const j = ind ? ind.getScalar(t + c) : t + c; tri.push(w[j * 3], w[j * 3 + 1], w[j * 3 + 2]); }
          mat.push(k); grp.push(gi);
        }
      }
    }
  }
  return { tri: Float32Array.from(tri), mat: Uint16Array.from(mat), grupo: Uint8Array.from(grp), nombres, grupos };
}

/** Árbol de cajas para lanzar rayos. `filtro(i)` decide qué triángulos entran. */
export class Rayos {
  constructor(malla, filtro = () => true) {
    this.m = malla;
    const ids = []; for (let i = 0; i < malla.mat.length; i++) if (filtro(i)) ids.push(i);
    this.ids = Uint32Array.from(ids);
    const T = malla.tri, N = ids.length;
    this.cen = new Float32Array(N * 3);
    for (let k = 0; k < N; k++) { const o = ids[k] * 9; for (let c = 0; c < 3; c++) this.cen[k * 3 + c] = (T[o + c] + T[o + 3 + c] + T[o + 6 + c]) / 3; }
    this.nodos = [];
    this.orden = new Uint32Array(N).map((_, i) => i);
    this.#armar(0, N);
  }

  #armar(a, b) {
    const T = this.m.tri, ids = this.ids, ord = this.orden;
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let k = a; k < b; k++) { const o = ids[ord[k]] * 9; for (let v = 0; v < 3; v++) for (let c = 0; c < 3; c++) { const x = T[o + v * 3 + c]; if (x < mn[c]) mn[c] = x; if (x > mx[c]) mx[c] = x; } }
    const nodo = { mn, mx, a, b, izq: -1, der: -1 };
    const i = this.nodos.length; this.nodos.push(nodo);
    if (b - a > 8) {
      const eje = [0, 1, 2].reduce((e, c) => (mx[c] - mn[c] > mx[e] - mn[e] ? c : e), 0);
      const sub = Array.from(ord.subarray(a, b)).sort((p, q) => this.cen[p * 3 + eje] - this.cen[q * 3 + eje]);
      ord.set(sub, a);
      const m = (a + b) >> 1;
      nodo.izq = this.#armar(a, m); nodo.der = this.#armar(m, b);
    }
    return i;
  }

  /** Primer choque del rayo (o, d) con t en (tMin, tMax). Devuelve { t, i (triángulo), n (normal) } o null. */
  lanzar(o, d, tMax = Infinity, tMin = 1e-4) {
    const T = this.m.tri, ids = this.ids, ord = this.orden, inv = d.map((x) => 1 / x);
    let mejor = null, tm = tMax;
    const pila = [0];
    while (pila.length) {
      const nd = this.nodos[pila.pop()];
      let t0 = tMin, t1 = tm;
      for (let c = 0; c < 3; c++) {
        let ta = (nd.mn[c] - o[c]) * inv[c], tb = (nd.mx[c] - o[c]) * inv[c];
        if (ta > tb) { const s = ta; ta = tb; tb = s; }
        if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
        if (t0 > t1) break;
      }
      if (t0 > t1) continue;
      if (nd.izq >= 0) { pila.push(nd.izq, nd.der); continue; }
      for (let k = nd.a; k < nd.b; k++) {
        const ti = ids[ord[k]], q = ti * 9;
        const e1x = T[q + 3] - T[q], e1y = T[q + 4] - T[q + 1], e1z = T[q + 5] - T[q + 2];
        const e2x = T[q + 6] - T[q], e2y = T[q + 7] - T[q + 1], e2z = T[q + 8] - T[q + 2];
        const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
        const det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) continue;
        const id = 1 / det, sx = o[0] - T[q], sy = o[1] - T[q + 1], sz = o[2] - T[q + 2];
        const u = (sx * px + sy * py + sz * pz) * id; if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
        const v = (d[0] * qx + d[1] * qy + d[2] * qz) * id; if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * id;
        if (t > tMin && t < tm) {
          tm = t;
          const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x, L = Math.hypot(nx, ny, nz) || 1;
          mejor = { t, i: ti, n: [nx / L, ny / L, nz / L] };
        }
      }
    }
    return mejor;
  }
}
