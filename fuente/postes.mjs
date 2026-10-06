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
//   · UNO EN CADA CRUCE, en una de sus esquinas, como el poste real (esquina de Carlos Lara y Jorge Gil). Un cruce es un nudo del
//     grafo de OSM donde se juntan tres o más tramos de calles con luz (los tramos que OSM parte sin cruce no cuentan); los cruces a
//     menos de GRUPO m unos de otros llevan uno solo. La esquina queda a RETIRO m más allá del medio ancho de las dos calles (medido
//     en el poste real); de las esquinas libres, la más cercana al rincón (−x, −z) desde el cruce, el del poste real; el brazo
//     cruza la calle principal (en un empate, la que va más cerca del eje z, como Carlos Lara). El cruce del poste real no lleva otro;
//   · uno a SIN_SALIDA m de la punta de cada calle sin salida;
//   · en los tramos de más de TRAMO_LARGO m sin cruces (entre cruces o puntas, cortados por el límite), postes en medio repartidos
//     parejos a no más de unos 100 m, del lado que deja más lugares libres;
//   · no se pone donde cae dentro de otra calle o acera, a menos de 1 m de un edificio (huellas de OSM y del kit), a menos de 1,5 m
//     del tronco de un árbol (modelo/arboles.glb y las palmas de vegetacion.glb), sobre lo modelado en el sitio a la altura de una
//     persona, dentro de la planta del 106 con sus galerías y escaleras (PLANTA más MARGEN_106 m), ni fuera del límite; ninguno a
//     menos de MIN_SEP m de otro. Si no hay lugar, falta.
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
  esquina: { valor: 'uno por cruce', fuente: 'regla propia: un poste en cada cruce de calles con luz, en una de sus esquinas, como el poste real junto al 106 (en la esquina de Carlos Lara y Jorge Gil). No observado' },
  retiro: { valor: 2.9, fuente: 'medido en el poste real: su fuste queda a 2,65 m del borde de Carlos Lara y a 3,1 m del de Jorge Gil (ejes de las calles del sitio en x 52,25 y z 23,5, 8 m de ancho); se toma 2,9 m más allá del medio ancho de cada calle' },
  rincon: { valor: [-1, -1], fuente: 'regla propia: de las esquinas libres, la más cercana a la dirección (−x, −z) desde el cruce, la del poste real' },
  brazo: { valor: 'sobre la calle principal', fuente: 'regla propia: el brazo cruza la calle de más categoría de las dos de su esquina; en un empate, la que va más cerca del eje z de la escena, como Carlos Lara bajo el brazo del poste real' },
  grupo: { valor: 25, fuente: 'regla propia: los cruces a menos de 25 m unos de otros (calzadas dobles, ramales) llevan un solo poste, en el cruce con más calles' },
  sinSalida: { valor: 10, fuente: 'regla propia: en una calle sin salida, un poste a 10 m de su punta' },
  tramoLargo: { valor: 200, fuente: 'regla propia: un tramo de más de 200 m sin cruces lleva postes en medio, repartidos parejos y a no más de unos 100 m (ceil(L / 100) − 1), para que no queden tramos largos a oscuras' },
  minSep: { valor: 12, fuente: 'regla propia: ningún poste a menos de 12 m de otro' },
  margen106: { valor: 4, fuente: 'regla propia: ningún poste a menos de 4 m de la planta del 106 (sus galerías, escaleras y la entrada)' },
};
const GRUPO = REGLA.grupo.valor, SIN_SALIDA = REGLA.sinSalida.valor, TRAMO_LARGO = REGLA.tramoLargo.valor, MIN_SEP = REGLA.minSep.valor, MIN_CUADRA = 1, RETIRO = REGLA.retiro.valor, MARGEN_106 = REGLA.margen106.valor;
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
const postes = [{ x: REAL.fuste[0], z: REAL.fuste[1], calle: 'Calle Carlos Lara', real: true, de: 'real' }];
const motivos = {}; let largoConLuz = 0;
for (const q of cuadras) largoConLuz += q.length;
const real = postes[0], adentro = (u) => { const p = coord.get(u); return dentro(LIM, p[0], p[1]); };
const unit = (d) => { const l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l]; };
/** Prueba un lugar: libre y lejos de los demás postes. Devuelve el motivo si no. */
const probar = (pq, ids) => { const m = libre(pq[0], pq[1], ids); if (m) return m; return postes.some((o) => Math.hypot(o.x - pq[0], o.z - pq[1]) < MIN_SEP) ? 'vecino' : null; };
const poner = (pq, ang, c, de) => postes.push({ x: pq[0], z: pq[1], y: suelo(pq), ang, calle: c?.nombre || null, tipo: c?.tipo, de });
const anota = (m) => { motivos[m] = (motivos[m] ?? 0) + 1; };

// ---- cruces: nudos con tres o más tramos de calles con luz, dentro del límite, juntados en grupos de menos de GRUPO m
const cruces = [...ady.keys()].filter((u) => grado(u) >= 3 && adentro(u)).sort((a, b) => grado(b) - grado(a));
const grupos = [];
for (const u of cruces) { const p = coord.get(u); if (!grupos.some((g) => g.some((v) => { const r = coord.get(v); return Math.hypot(p[0] - r[0], p[1] - r[1]) < GRUPO; }))) grupos.push([u]); else grupos.find((g) => g.some((v) => { const r = coord.get(v); return Math.hypot(p[0] - r[0], p[1] - r[1]) < GRUPO; })).push(u); }
// el cruce del poste real (el más cercano a él): ahí no se pone otro
const dReal = (g) => Math.min(...g.map((u) => { const p = coord.get(u); return Math.hypot(p[0] - real.x, p[1] - real.z); }));
const grupoReal = grupos.reduce((m, g) => (dReal(g) < dReal(m) ? g : m), grupos[0]);
const RINCON = unit(REGLA.rincon.valor);
const puntas = [...ady.keys()].filter((u) => grado(u) === 1 && adentro(u)).length;
let sinEsquina = 0;
for (const g of grupos) {
  if (g === grupoReal && dReal(g) < 15) continue;
  const u = g[0], O = coord.get(u);                                  // el de más calles del grupo
  // las calles que salen del cruce, ordenadas por ángulo; cada par seguido es una esquina
  const sal = ady.get(u).map((e) => { const d = unit([coord.get(e.v)[0] - O[0], coord.get(e.v)[1] - O[1]]); return { d, c: e.c, a: Math.atan2(d[1], d[0]) }; }).sort((x, y) => x.a - y.a);
  const ids = new Set(sal.map((e) => e.c.id));
  const esquinas = sal.map((A, i) => {
    const B = sal[(i + 1) % sal.length]; let th = B.a - A.a; if (th <= 0) th += 2 * Math.PI;
    if (th < (40 * Math.PI) / 180 || th > (200 * Math.PI) / 180) return null;   // ni esquinas muy agudas ni el lado de afuera de una curva
    const bis = unit([Math.cos(A.a + th / 2), Math.sin(A.a + th / 2)]), w = Math.max(A.c.w, B.c.w) / 2 + RETIRO;
    const pq = [O[0] + bis[0] * w / Math.sin(th / 2), O[1] + bis[1] * w / Math.sin(th / 2)];
    // el brazo cruza la calle principal: más categoría; en un empate, la que va más cerca del eje z
    const pri = (e) => [PRIORIDAD[e.c.tipo], -Math.abs(e.d[1])];
    const M = pri(A)[0] !== pri(B)[0] ? (pri(A)[0] < pri(B)[0] ? A : B) : (pri(A)[1] <= pri(B)[1] ? A : B);
    const rel = [pq[0] - O[0], pq[1] - O[1]], t = rel[0] * M.d[0] + rel[1] * M.d[1], v = [rel[0] - t * M.d[0], rel[1] - t * M.d[1]];
    return { pq, ang: Math.atan2(-v[1], -v[0]), c: M.c, pref: bis[0] * RINCON[0] + bis[1] * RINCON[1] };
  }).filter(Boolean).sort((x, y) => y.pref - x.pref);
  const e = esquinas.find((x) => { const m = probar(x.pq, ids); if (m) anota(m); return !m; });
  if (e) poner(e.pq, e.ang, e.c, 'cruce'); else sinEsquina++;
}

// ---- calles sin salida: un poste a SIN_SALIDA m de la punta, del lado más cercano al rincón preferido (o el otro si no cabe)
for (const [u] of ady) {
  if (grado(u) !== 1 || !adentro(u)) continue;
  const O = coord.get(u), { v, c } = ady.get(u)[0], d = unit([coord.get(v)[0] - O[0], coord.get(v)[1] - O[1]]), n = [-d[1], d[0]];
  const base = [O[0] + d[0] * SIN_SALIDA, O[1] + d[1] * SIN_SALIDA], off = c.w / 2 + RETIRO, ids = new Set([c.id]);
  const lados = n[0] * RINCON[0] + n[1] * RINCON[1] >= 0 ? [1, -1] : [-1, 1];
  const ok = lados.find((l) => { const m = probar([base[0] + n[0] * off * l, base[1] + n[1] * off * l], ids); if (m) anota(m); return !m; });
  if (ok !== undefined) poner([base[0] + n[0] * off * ok, base[1] + n[1] * off * ok], Math.atan2(-n[1] * ok, -n[0] * ok), c, 'sin salida');
}

// ---- tramos largos sin cruces (las cuadras entre cruces o puntas, cortadas por el límite): más de TRAMO_LARGO m, postes en medio
for (const q of cuadras) {
  const L = q.length; if (L <= TRAMO_LARGO) continue;
  const k = Math.ceil(L / 100) - 1, ids = new Set(q.map((s) => s.c.id));
  const cand = (s, lado) => { const off = s.c.w / 2 + RETIRO; return [s.p[0] + s.n[0] * off * lado, s.p[1] + s.n[1] * off * lado]; };
  const lado0 = q.filter((s) => !libre(...cand(s, 1), ids)).length >= q.filter((s) => !libre(...cand(s, -1), ids)).length ? 1 : -1;
  const ventana = L / (2 * (k + 1));
  for (let i = 1; i <= k; i++) {
    const t = Math.round(i * L / (k + 1)); let hecho = false;
    for (const lado of [lado0, -lado0]) {
      for (let dd = 0; dd <= ventana && !hecho; dd++) for (const j of dd ? [t - dd, t + dd] : [t]) {
        if (hecho || j < 0 || j >= L) continue;
        const s = q[j], pq = cand(s, lado), m = probar(pq, ids);
        if (m) { anota(m); continue; }
        poner(pq, Math.atan2(-s.n[1] * lado, -s.n[0] * lado), s.c, 'tramo largo'); hecho = true;
      }
      if (hecho) break;
    }
    if (!hecho) anota('sinLugar');
  }
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
const porDe = {}; for (const p of nuevos) porDe[p.de] = (porDe[p.de] ?? 0) + 1;
console.log(`por origen: ${JSON.stringify(porDe)} · ${grupos.length} grupos de cruces (${cruces.length} cruces; el del poste real no lleva otro) · ${sinEsquina} cruces sin esquina libre · ${puntas} calles sin salida · ${cuadras.filter((q) => q.length > TRAMO_LARGO).length} tramos de más de ${TRAMO_LARGO} m`);
console.log(`poste más cercano (en línea recta, contando el real): mediana ${med(vecino).toFixed(1)}, mínima ${Math.min(...vecino).toFixed(1)}, máxima ${Math.max(...vecino).toFixed(1)} m`);
console.log(`lugares descartados (metros recorridos): ${JSON.stringify(motivos)} · troncos ${troncos} · ${(fs.statSync(path.join(RAIZ, 'datos/postes.json')).size / 1024).toFixed(0)} KB`);
const xs = nuevos.map((p) => p.x), zs = nuevos.map((p) => p.z);
console.log(`caja: x ${Math.min(...xs).toFixed(0)} a ${Math.max(...xs).toFixed(0)}, z ${Math.min(...zs).toFixed(0)} a ${Math.max(...zs).toFixed(0)}`);
console.log(`cruce del poste real a ${dReal(grupoReal).toFixed(1)} m de él`);
