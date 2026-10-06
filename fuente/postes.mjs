// Postes de luz de Ciudad del Saber puestos POR REGLA (datos/postes.json). OpenStreetMap no tiene ninguno en Ciudad del Saber
// (consulta de Overpass del 6 de octubre de 2026: ningún highway=street_lamp ni lit=* en sus calles), así que no se observan:
// se ponen con una regla general y todos son clase III (supuesto). El único poste real del visor es el de la esquina del 106
// (sitio.glb), que no se toca ni se repite: cuenta como uno más de la regla.
//
// La regla (cada valor con su razón en REGLA, abajo):
//   · calles con alumbrado: las de OSM dentro del límite propuesto de la ciudad (docs/ciudad/limite-propuesto.geojson, no oficial)
//     de tipo tertiary, tertiary_link, secondary, residential o unclassified, y las service que tienen nombre (en Ciudad del Saber
//     son calles, como Jacinto Palacios o Ricardo Murgas). Las service sin nombre (accesos y estacionamientos), los pasillos de
//     estacionamiento, las entradas de casa, aceras, senderos, trochas y escaleras, no: no se sabe si tienen luz ni de qué tipo;
//   · DOS POR CUADRA: una cuadra es el tramo de calle con luz entre dos cruces seguidos con otras calles con luz, o hasta una calle
//     sin salida (el grafo de OSM: los tramos que OSM parte sin cruce se juntan) y cortado por el límite. Los postes van a un cuarto
//     y a tres cuartos de su largo ((i + 1/2)·L/n); uno en el medio si mide menos de CORTA m y, pasados LARGA m, uno más por cada
//     EXTRA m o fracción. Los pedazos de menos de MIN_CUADRA m no llevan;
//   · un solo lado de cada cuadra, el que deja más lugares libres (la del poste real, en su lado); cada poste se busca desde su
//     lugar hacia los dos lados hasta media separación y, si ahí no cabe, en el otro lado de la calle;
//   · el fuste a RETIRO m del borde del asfalto (el ancho de la calle es el que dibuja contexto.mjs) y el brazo hacia la calle;
//   · no se pone donde cae dentro de otra calle o acera (cruces), a menos de 1 m de un edificio (huellas de OSM y del kit), a menos
//     de 1,5 m del tronco de un árbol (modelo/arboles.glb y las palmas de vegetacion.glb), sobre lo modelado en el sitio a la
//     altura de una persona, ni fuera del límite;
//   · nada dentro de la planta del 106 con sus galerías y escaleras (PLANTA más MARGEN_106 m). El poste real de la esquina es uno
//     de los dos de su cuadra de Carlos Lara: ocupa el lugar más cercano a él y la regla pone solo el otro. Ninguno a menos de
//     MIN_SEP m de otro.
// El mapa de luz que estos postes dejan en el suelo de noche lo arma el navegador con estos puntos (src/postes.js).
//   cd fuente && node postes.mjs       escribe datos/postes.json y un resumen en la consola
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { entornoRegistrado } from './entorno-osm.mjs';
import { osmRegistrado } from './contexto-osm.mjs';
import { suelo } from './ciudad-datos.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.join(AQUI, '..');
const leer = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

// el poste de la esquina del 106 (sitio.glb, medido en su malla): fuste de 0,14 m en (45,6; 16,4), recto hasta 8,8 m, un tramo
// inclinado hasta 11,2 m a 1,6 m del fuste y el brazo hasta la luminaria, a 3,0 m del fuste; la lámpara (POSTE de escena.js) a
// 11,3 m. El fuste queda a 1,9 m del bordillo de la calle Carlos Lara (bordillo en x 47,5). Los postes de la regla lo copian.
const REAL = { fuste: [45.6, 16.4], brazo: [1, 0], lampara: 11.3, alcance: 3.0, retiro: 1.9 };
const REGLA = {
  porCuadra: { valor: 2, fuente: 'regla propia: dos por cuadra, a un cuarto y a tres cuartos de cada tramo entre cruces No observado' },
  corta: { valor: 40, fuente: 'regla propia: una cuadra de menos de 40 m lleva un solo poste, en el medio' },
  larga: { valor: 200, fuente: 'regla propia: pasados 200 m, un poste más por cada 100 m o fracción (con dos postes en 200 m quedan unos 100 m entre ellos; más allá se mantiene esa separación)' },
  extra: { valor: 100, fuente: 'ver larga' },
  minCuadra: { valor: 10, fuente: 'regla propia: los pedazos de menos de 10 m (entre dos cruces muy juntos o donde el límite corta la calle) no llevan poste' },
  minSep: { valor: 12, fuente: 'regla propia: ningún poste a menos de 12 m de otro (en los cruces, las cuadras que se tocan)' },
  retiro: { valor: REAL.retiro, fuente: 'el del poste de la esquina del 106: fuste a 1,9 m del bordillo (sitio.glb)' },
  lado: { valor: 'uno', fuente: 'regla propia: un solo lado de cada cuadra, el que deja más lugares libres' },
  margen106: { valor: 4, fuente: 'regla propia: ningún poste a menos de 4 m de la planta del 106 (sus galerías, escaleras y la entrada)' },
};
const CORTA = REGLA.corta.valor, LARGA = REGLA.larga.valor, EXTRA = REGLA.extra.valor, MIN_CUADRA = REGLA.minCuadra.valor, MIN_SEP = REGLA.minSep.valor, RETIRO = REGLA.retiro.valor, MARGEN_106 = REGLA.margen106.valor;
const PLANTA = [22.75, 11.5];                         // media planta del 106 (escena.js, PLANTA)
// anchos de las calles: los de contexto.mjs (ANCHO)
const ANCHO = { primary: 7.5, primary_link: 5, tertiary: 8, tertiary_link: 5, secondary: 8, residential: 8, unclassified: 8, service: 4, footway: 1.6, steps: 1.6 };
const CON_LUZ = new Set(['tertiary', 'tertiary_link', 'secondary', 'residential', 'unclassified']);
const conLuz = (c) => CON_LUZ.has(c.tipo) || (c.tipo === 'service' && !c.servicio && !!c.nombre);
// orden: las principales primero (eligen lado y lugar antes que las que llegan a ellas)
const PRIORIDAD = { tertiary: 0, secondary: 0, tertiary_link: 1, residential: 2, unclassified: 2, service: 3 };

const dentro = (P, x, z) => { let c = false; for (let i = 0, k = P.length - 1; i < P.length; k = i++) { const [xi, zi] = P[i], [xk, zk] = P[k]; if ((zi > z) !== (zk > z) && x < (xk - xi) * (z - zi) / (zk - zi) + xi) c = !c; } return c; };
const dSeg = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); };

// ---- las calles, con el mismo ajuste de contexto.mjs cerca del sitio (alinear): Jorge Gil y Carlos Lara de OSM pasan 2 a 5 m
// corridas de las modeladas; a menos de 12 m de su eje y paralelas se llevan a él, y 120 m más allá vuelven a su lugar de OSM
const sst = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const EJES_SITIO = [{ eje: 'z', valor: 23.5, de: -110, a: 110 }, { eje: 'x', valor: 52.25, de: -135, a: 95 }];
function alinear(L) {
  return L.map((p, i) => {
    const q = L[Math.min(i + 1, L.length - 1)], r = L[Math.max(i - 1, 0)], dx = q[0] - r[0], dz = q[1] - r[1], l = Math.hypot(dx, dz) || 1;
    let [x, z] = p;
    for (const e of EJES_SITIO) {
      const [a, b, paralelo] = e.eje === 'z' ? [p[1], p[0], Math.abs(dz / l) < 0.2] : [p[0], p[1], Math.abs(dx / l) < 0.2];
      if (!paralelo || Math.abs(a - e.valor) > 12) continue;
      const fuera = Math.max(e.de - b, b - e.a, 0), peso = 1 - sst(fuera / 120);
      if (e.eje === 'z') z += (e.valor - z) * peso; else x += (e.valor - x) * peso;
    }
    return [x, z];
  });
}

const ent = entornoRegistrado(), osm = osmRegistrado();
const mapa = leer(path.join(RAIZ, 'datos/ciudad_mapa.json'));
const LIM = mapa.limite;
const calles = ent.calles.filter((c) => ANCHO[c.tipo]).map((c) => ({ ...c, w: ANCHO[c.tipo], L: alinear(c.linea) }));

// ---- obstáculos en una rejilla de 4 m (para buscar rápido)
const CELDA = 4, rejilla = new Map(), clave = (i, k) => i * 100003 + k;
const meter = (x0, x1, z0, z1, o) => { for (let i = Math.floor(x0 / CELDA); i <= Math.floor(x1 / CELDA); i++) for (let k = Math.floor(z0 / CELDA); k <= Math.floor(z1 / CELDA); k++) { const c = clave(i, k); if (!rejilla.has(c)) rejilla.set(c, []); rejilla.get(c).push(o); } };
const cerca = (x, z) => rejilla.get(clave(Math.floor(x / CELDA), Math.floor(z / CELDA))) ?? [];
const M = 2;                                           // margen de la caja de cada obstáculo (m), más que cualquier holgura
// edificios: huellas de OSM (las del contexto y las del entorno ampliado) y las del kit (ciudad_mapa.json)
const huellas = [...osm.edificios.map((b) => b.poly), ...ent.edificios.map((b) => b.poly), ...mapa.edificios.map((e) => e.p)].filter((P) => P?.length > 2);
for (const P of huellas) { const xs = P.map((p) => p[0]), zs = P.map((p) => p[1]); meter(Math.min(...xs) - M, Math.max(...xs) + M, Math.min(...zs) - M, Math.max(...zs) + M, { t: 'edificio', P }); }
// calles y aceras (todas las que se dibujan): un poste no va dentro de ninguna
for (const c of calles) for (let i = 1; i < c.L.length; i++) {
  const a = c.L[i - 1], b = c.L[i], r = c.w / 2 + M;
  meter(Math.min(a[0], b[0]) - r, Math.max(a[0], b[0]) + r, Math.min(a[1], b[1]) - r, Math.max(a[1], b[1]) + r, { t: 'calle', a, b, w: c.w, id: c.id });
}
// troncos: las instancias de los árboles (arboles.glb) y los tallos y palmas del sitio (vegetacion.glb)
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
let troncos = 0;
for (const archivo of ['arboles.glb', 'vegetacion.glb']) {
  const doc = await io.read(path.join(RAIZ, 'modelo', archivo));
  for (const n of doc.getRoot().listNodes()) {
    const ins = n.getExtension('EXT_mesh_gpu_instancing'), nm = n.getName();
    if (ins && /bark/i.test(nm)) {
      const T = ins.getAttribute('TRANSLATION'), v = [0, 0, 0];
      for (let i = 0; i < T.getCount(); i++) { T.getElement(i, v); meter(v[0] - M, v[0] + M, v[2] - M, v[2] + M, { t: 'tronco', p: [v[0], v[2]] }); troncos++; }
    } else if (!ins && n.getMesh() && /stem|cane|trunk|bark/i.test(nm)) {
      const W = n.getWorldMatrix(), v = [0, 0, 0];
      for (const pr of n.getMesh().listPrimitives()) {
        const P = pr.getAttribute('POSITION');
        for (let i = 0; i < P.getCount(); i++) {
          P.getElement(i, v); const y = W[1] * v[0] + W[5] * v[1] + W[9] * v[2] + W[13]; if (y > 1.5) continue;
          const x = W[0] * v[0] + W[4] * v[1] + W[8] * v[2] + W[12], z = W[2] * v[0] + W[6] * v[1] + W[10] * v[2] + W[14];
          meter(x - M, x + M, z - M, z + M, { t: 'tronco', p: [x, z] }); troncos++;
        }
      }
    }
  }
}

// lo modelado en el sitio del 106 (pórtico de la entrada, escaleras, barandas, setos, muros bajos, troncos): cada triángulo que
// baja de 2,5 m y sube de 0,3 m (lo que está a la altura de una persona), visto desde arriba en una rejilla de 0,5 m. El suelo, las
// calles y las copas altas no cuentan
const SIT = { x0: -190, z0: -170, n: 0.5, W: 760, H: 680 }, ocupado = new Uint8Array(SIT.W * SIT.H);
for (const archivo of ['sitio.glb', 'entrada.glb', 'detalles.glb', 'arquitectura.glb', 'vegetacion.glb']) {
  const doc = await io.read(path.join(RAIZ, 'modelo', archivo));
  for (const nd of doc.getRoot().listNodes()) {
    const me = nd.getMesh(); if (!me || nd.getExtension('EXT_mesh_gpu_instancing')) continue;
    const W = nd.getWorldMatrix(), v = [0, 0, 0];
    for (const pr of me.listPrimitives()) {
      const A = pr.getAttribute('POSITION'), I = pr.getIndices(), P = new Float32Array(A.getCount() * 3);
      for (let i = 0; i < A.getCount(); i++) { A.getElement(i, v); P[i * 3] = W[0] * v[0] + W[4] * v[1] + W[8] * v[2] + W[12]; P[i * 3 + 1] = W[1] * v[0] + W[5] * v[1] + W[9] * v[2] + W[13]; P[i * 3 + 2] = W[2] * v[0] + W[6] * v[1] + W[10] * v[2] + W[14]; }
      const nT = I ? I.getCount() / 3 : A.getCount() / 3, ix = (k) => (I ? I.getScalar(k) : k);
      for (let t = 0; t < nT; t++) {
        const a = ix(t * 3), b = ix(t * 3 + 1), c = ix(t * 3 + 2), ys = [P[a * 3 + 1], P[b * 3 + 1], P[c * 3 + 1]];
        if (Math.min(...ys) > 2.5 || Math.max(...ys) < 0.3) continue;
        const X = [P[a * 3], P[b * 3], P[c * 3]], Z = [P[a * 3 + 2], P[b * 3 + 2], P[c * 3 + 2]];
        const i0 = Math.floor((Math.min(...X) - SIT.x0) / SIT.n), i1 = Math.floor((Math.max(...X) - SIT.x0) / SIT.n);
        const k0 = Math.floor((Math.min(...Z) - SIT.z0) / SIT.n), k1 = Math.floor((Math.max(...Z) - SIT.z0) / SIT.n);
        if (i1 < 0 || k1 < 0 || i0 >= SIT.W || k0 >= SIT.H) continue;
        // la caja del triángulo (para un triángulo inclinado o vertical es su huella; los grandes y planos ya quedaron fuera por la altura)
        for (let i = Math.max(0, i0); i <= Math.min(SIT.W - 1, i1); i++) for (let k = Math.max(0, k0); k <= Math.min(SIT.H - 1, k1); k++) ocupado[k * SIT.W + i] = 1;
      }
    }
  }
}
const enSitio = (x, z, r) => {
  for (let i = Math.floor((x - r - SIT.x0) / SIT.n); i <= Math.floor((x + r - SIT.x0) / SIT.n); i++) for (let k = Math.floor((z - r - SIT.z0) / SIT.n); k <= Math.floor((z + r - SIT.z0) / SIT.n); k++)
    if (i >= 0 && k >= 0 && i < SIT.W && k < SIT.H && ocupado[k * SIT.W + i]) return true;
  return false;
};

/** ¿Se puede poner un fuste en (x, z)? `propia`: las vías de OSM de su cuadra (no cuentan como obstáculo). */
function libre(x, z, propia) {
  if (!dentro(LIM, x, z)) return 'limite';
  if (Math.abs(x) < PLANTA[0] + MARGEN_106 && Math.abs(z) < PLANTA[1] + MARGEN_106) return 'edificio';
  if (enSitio(x, z, 0.8)) return 'sitio';
  for (const o of cerca(x, z)) {
    if (o.t === 'tronco' && Math.hypot(x - o.p[0], z - o.p[1]) < 1.5) return 'tronco';
    if (o.t === 'calle' && !propia?.has(o.id) && dSeg(x, z, o.a, o.b) < o.w / 2 + 0.5) return 'calle';
    if (o.t === 'edificio' && (dentro(o.P, x, z) || o.P.some((p, i) => dSeg(x, z, p, o.P[(i + 1) % o.P.length]) < 1))) return 'edificio';
  }
  return null;
}

// ---- recorrido de cada calle con luz, de 1 en 1 m
// ---- las cuadras: el grafo de las calles con luz de OSM (nudos con su id). Un cruce es un nudo donde se juntan tres o más tramos de
// calles con luz; un extremo, una calle sin salida. Entre dos cruces o extremos seguidos hay una cuadra, aunque OSM la parta en
// varias vías (un nudo con solo dos tramos no corta). Lo que sale del límite se corta: cada pedazo adentro es una cuadra
const NODOS = new Map(leer(path.join(AQUI, 'osm-amplio.json')).elements.filter((e) => e.type === 'way' && e.nodes).map((e) => [e.id, e.nodes]));
const conLuzV = calles.filter(conLuz).map((c) => ({ ...c, nodos: NODOS.get(c.id) })).filter((c) => c.nodos?.length === c.L.length);
const coord = new Map(), ady = new Map(), arista = (u, v) => (u < v ? `${u}-${v}` : `${v}-${u}`);
for (const c of conLuzV) for (let i = 0; i < c.nodos.length; i++) {
  coord.set(c.nodos[i], c.L[i]);
  if (i && c.nodos[i] !== c.nodos[i - 1]) for (const [u, v] of [[c.nodos[i - 1], c.nodos[i]], [c.nodos[i], c.nodos[i - 1]]]) { if (!ady.has(u)) ady.set(u, []); ady.get(u).push({ v, c }); }
}
const grado = (u) => ady.get(u).length, usadas = new Set(), caminos = [];
const andar = (u0, e0) => {
  const nodos = [u0], tramos = []; let u = u0, e = e0;
  for (;;) {
    usadas.add(arista(u, e.v)); nodos.push(e.v); tramos.push(e.c); u = e.v;
    if (grado(u) !== 2) break;
    const sig = ady.get(u).find((x) => !usadas.has(arista(u, x.v))); if (!sig) break;
    e = sig;
  }
  caminos.push({ nodos, tramos });
};
for (const [u, es] of ady) if (grado(u) !== 2) for (const e of es) if (!usadas.has(arista(u, e.v))) andar(u, e);
for (const [u, es] of ady) for (const e of es) if (!usadas.has(arista(u, e.v))) andar(u, e);   // anillos sin cruces
// puntos cada 1 m con su normal (a la izquierda del sentido) y su calle; los pedazos dentro del límite son las cuadras
const cuadras = [];
for (const { nodos, tramos } of caminos) {
  let pedazo = [];
  const cerrar = () => { if (pedazo.length >= MIN_CUADRA) cuadras.push(pedazo); pedazo = []; };
  for (let i = 1; i < nodos.length; i++) {
    const A = coord.get(nodos[i - 1]), B = coord.get(nodos[i]), c = tramos[i - 1], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz); if (l < 1e-3) continue;
    const n = Math.max(1, Math.round(l));
    for (let k = 0; k < n; k++) {
      const p = [A[0] + dx * k / n, A[1] + dz * k / n];
      if (dentro(LIM, p[0], p[1])) pedazo.push({ p, n: [-dz / l, dx / l], c }); else cerrar();
    }
  }
  cerrar();
}
/** Postes de una cuadra de L m: 1 si es corta, 2 hasta LARGA m y uno más por cada EXTRA m (o fracción) que pase de LARGA. */
const cuantos = (L) => (L < CORTA ? 1 : L <= LARGA ? 2 : 2 + Math.ceil((L - LARGA) / EXTRA));

const postes = [{ x: REAL.fuste[0], z: REAL.fuste[1], calle: 'Calle Carlos Lara', real: true }];
const motivos = {}, porN = {}, huecos = []; let largoConLuz = 0;
const real = postes[0];
// la cuadra del poste real: la de Carlos Lara que pasa más cerca de él (a lo más a medio ancho + retiro + 2 m de su eje)
let cuadraReal = null, sReal = 0;
for (const q of cuadras) q.forEach((s, j) => { const d = Math.hypot(real.x - s.p[0], real.z - s.p[1]); if (s.c.nombre === real.calle && d < s.c.w / 2 + RETIRO + 2 && (!cuadraReal || d < cuadraReal.d)) { cuadraReal = { q, d }; sReal = j; } });
const prio = (q) => Math.min(...q.map((s) => PRIORIDAD[s.c.tipo]));
const orden = [...cuadras].sort((a, b) => (a === cuadraReal?.q ? -1 : b === cuadraReal?.q ? 1 : 0) || (prio(a) - prio(b)) || (b.length - a.length));
for (const q of orden) {
  const L = q.length, n = cuantos(L), ids = new Set(q.map((s) => s.c.id)); largoConLuz += L;
  porN[n] = (porN[n] ?? 0) + 1;
  const cand = (s, lado) => { const off = s.c.w / 2 + RETIRO; return [s.p[0] + s.n[0] * off * lado, s.p[1] + s.n[1] * off * lado]; };
  const esReal = q === cuadraReal?.q;
  // el lado: el del poste real en su cuadra; en las demás, el que deja más lugares libres
  const lado0 = esReal ? Math.sign((real.x - q[sReal].p[0]) * q[sReal].n[0] + (real.z - q[sReal].p[1]) * q[sReal].n[1]) || 1
    : (q.filter((s) => !libre(...cand(s, 1), ids)).length >= q.filter((s) => !libre(...cand(s, -1), ids)).length ? 1 : -1);
  // los lugares: a (i + 1/2)·L/n (un cuarto y tres cuartos con dos); en la cuadra del real, él ocupa el lugar más cercano a él
  let metas = Array.from({ length: n }, (_, i) => (i + 0.5) * L / n);
  if (esReal) { const k = metas.reduce((m, t, i) => (Math.abs(t - sReal) < Math.abs(metas[m] - sReal) ? i : m), 0); metas.splice(k, 1); }
  const puestos = esReal ? [sReal] : [], ventana = Math.max(3, L / (2 * n));
  for (const t of metas) {
    let elegido = null;
    // primero en su lado, del punto meta hacia afuera hasta media separación; si no hay lugar, en el otro lado
    for (const lado of [lado0, -lado0]) {
      for (let d = 0; d <= ventana && !elegido; d++) for (const j of d ? [Math.round(t) - d, Math.round(t) + d] : [Math.round(t)]) {
        if (j < 0 || j >= L || elegido) continue;
        const s = q[j], pq = cand(s, lado), m = libre(pq[0], pq[1], ids);
        if (m) { motivos[m] = (motivos[m] ?? 0) + 1; continue; }
        if (postes.some((o) => Math.hypot(o.x - pq[0], o.z - pq[1]) < MIN_SEP)) { motivos.vecino = (motivos.vecino ?? 0) + 1; continue; }
        elegido = { s, j, pq, lado };
      }
      if (elegido) break;
    }
    if (!elegido) { motivos.sinLugar = (motivos.sinLugar ?? 0) + 1; continue; }
    const { s, pq, lado } = elegido, ang = Math.atan2(-s.n[1] * lado, -s.n[0] * lado);   // el brazo hacia la calle
    postes.push({ x: pq[0], z: pq[1], y: suelo(pq), ang, calle: s.c.nombre || null, tipo: s.c.tipo, otroLado: lado !== lado0 });
    puestos.push(elegido.j);
  }
  puestos.sort((a, b) => a - b); for (let i = 1; i < puestos.length; i++) huecos.push(puestos[i] - puestos[i - 1]);
}

const nuevos = postes.filter((p) => !p.real);
const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
const out = {
  generado_por: 'fuente/postes.mjs',
  certeza: 'III',
  fuente: 'Puestos por regla, no observados: OpenStreetMap no tiene postes de luz en Ciudad del Saber (consulta de Overpass del 6 de octubre de 2026). Calles de OpenStreetMap (osm-amplio.json, © colaboradores de OpenStreetMap, ODbL 1.0); límite propuesto, no oficial',
  regla: REGLA,
  // el poste tal como lo dibuja el visor (src/postes.js): copia del de la esquina
  poste: { lampara: { valor: REAL.lampara, fuente: 'altura de la lámpara del poste de la esquina (POSTE de escena.js)' }, alcance: { valor: REAL.alcance, fuente: 'del fuste a la lámpara, en el poste de la esquina' } },
  // [x, z, y del suelo, rumbo del brazo en radianes (atan2(dz, dx))]
  postes: nuevos.map((p) => [r2(p.x), r2(p.z), r2(p.y), r3(p.ang)]),
};
fs.writeFileSync(path.join(RAIZ, 'datos/postes.json'), JSON.stringify(out));
const porTipo = {}; for (const p of nuevos) porTipo[p.tipo] = (porTipo[p.tipo] ?? 0) + 1;
console.log(`datos/postes.json: ${nuevos.length} postes (más el real de la esquina) · ${(largoConLuz / 1000).toFixed(1)} km de calles con luz dentro del límite · por tipo ${JSON.stringify(porTipo)}`);
const med = (v) => { const a = [...v].sort((x, y) => x - y); return a.length ? a[a.length >> 1] : null; };
const vecino = nuevos.map((p) => Math.min(...postes.filter((o) => o !== p).map((o) => Math.hypot(o.x - p.x, o.z - p.z))));
console.log(`${cuadras.length} cuadras (por número de postes: ${JSON.stringify(porN)}) · ${nuevos.filter((p) => p.otroLado).length} postes en el otro lado`);
console.log(`separación dentro de una cuadra (a lo largo de la calle): mediana ${med(huecos)} m, mínima ${Math.min(...huecos)}, máxima ${Math.max(...huecos)} · poste más cercano (en línea recta): mediana ${med(vecino).toFixed(1)}, mínima ${Math.min(...vecino).toFixed(1)}, máxima ${Math.max(...vecino).toFixed(1)} m`);
console.log(`lugares descartados (metros recorridos): ${JSON.stringify(motivos)} · troncos ${troncos} · ${(fs.statSync(path.join(RAIZ, 'datos/postes.json')).size / 1024).toFixed(0)} KB`);
const xs = nuevos.map((p) => p.x), zs = nuevos.map((p) => p.z);
console.log(`caja: x ${Math.min(...xs).toFixed(0)} a ${Math.max(...xs).toFixed(0)}, z ${Math.min(...zs).toFixed(0)} a ${Math.max(...zs).toFixed(0)}`);
console.log(`cuadra del poste real: ${cuadraReal ? `${cuadraReal.q.length} m, ${cuantos(cuadraReal.q.length)} postes con el real, el real a ${sReal} m de una punta` : 'no se encontró'}`);
