// Genera modelo/contexto.glb (los vecinos del Edificio 106) a partir de las huellas de OpenStreetMap (osm.json) y de la
// geometría del propio 106 (modelo/*.glb). Reproducible: no lee el contexto.glb anterior ni nada de Blender.
//
//   cd fuente && node contexto.mjs            escribe ../modelo/contexto.glb y un resumen en la consola
//
// Qué se modela (coordenadas de la escena: +X noreste, +Z sureste, Y arriba; OSM registrado al 106, ver contexto-osm.mjs):
//  · Cuarteles del cuadrángulo (105 al suroeste del 106; 102 y 103, al otro lado del cuadrángulo): son de la misma tipología
//    que el 106 (3 pisos, alero de teja en cada piso, ménsulas, techo de teja a cuatro aguas). Se usa una versión reducida del
//    propio 106 (muro exterior, vidrio, tejas simplificadas, cabios, ménsulas; sin interiores, sin vegetación, sin la entrada
//    ni el sitio) guardada una sola vez y colocada en cada huella con su giro: los tres nodos comparten la misma malla.
//  · La Fundación Ciudad del Saber (OSM 104, «Ciudad del Saber», 3 niveles): volumen propio sobre su huella, muros a la altura
//    del alero del 106 (3 pisos), techo de teja a cuatro aguas sobre el cuerpo principal y las alas, y tres grandes entradas
//    sugeridas en la fachada que da al cuadrángulo (su posición exacta no se conoce: son una indicación).
//  · La Casa (OSM 108, el salón de eventos de Ciudad del Saber), justo enfrente de la entrada del 106, al otro lado de la
//    calle: un piso, muros blancos hasta 3,2 m, galería de columnas en las caras noroeste (la de la calle) y noreste, y teja a
//    cuatro aguas con la cumbrera a ~6,8 m. Alturas ESTIMADAS en Street View (alero ~3,2 m, cumbrera 6,5–7 m).
//  · Innova (OSM 109, el Centro de Innovación, «Auditorio 109»), más allá del estacionamiento: nave blanca de doble altura con
//    cubierta plana (~11 m ESTIMADOS), paño de celosía de ladrillo y entrada con visera en la cara noroeste (la de la calle),
//    pilastras con franjas de ladrillo en las caras largas, torre de celosía (~13 m ESTIMADOS) en el flanco suroeste y el ala
//    baja al suroeste (~4 m ESTIMADOS). Identificación: verificacion/contexto2/identificacion.md.
//  · El Teatro Ateneo (OSM 182), detrás del estacionamiento: sala alta de muros blancos (~10 m ESTIMADOS) con teja.
//  · Los dos estacionamientos de asfalto: el de enfrente del 105 (polígono medido en la vista satelital) y el que queda entre
//    Innova y el Ateneo; y el cerramiento de bloque calado (~2,2 m) entre La Casa y la entrada del estacionamiento.
//  · La estructura pequeña del cuadrángulo (no está en OSM; medida en el mapa de Google del usuario): un piso, 3,5 m ESTIMADOS,
//    con cubierta metálica azulada (vista satelital).
//  · Cuarteles al norte del cuadrángulo, de la misma tipología (Street View, nov 2022): el 101 y los dos de Balboa Academy, el
//    100 (el principal; ~59 m de largo y girado 90°, medidos en Open Buildings: la misma malla, estirada a lo largo) y el 107
//    (la secundaria). OSM no les trae niveles o los dibuja con otra forma; el 101 mide 46,8 × 22,5 m en Open Buildings, como el 106.
//  · El resto de edificios de OSM: volúmenes de maqueta, techo plano, con la altura de sus niveles de OSM (3,65 m por nivel +
//    0,65 m de base). Si OSM no la trae, la altura p90 de Google Open Buildings 2.5D (alturas_ob.json, de alturas_ob.py: estimada
//    desde satélite, ~1,5 m de error) cuando cubre al menos el 60 % de la huella; si no, 2 niveles. Todas son ESTIMADAS.
// Sombras: los nodos a menos de ~60 m del 106 llevan extras.sombra = true y escena.js los pone en la capa 1 (proyectan sombra
// en el mapa de sombras); los lejanos no.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { ShapeUtils, Vector2 } from 'three';
import { osmRegistrado, distanciaPoligonos } from './contexto-osm.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MODELO = path.join(AQUI, '..', 'modelo');
const SALIDA = process.argv[2] ?? path.join(MODELO, 'contexto.glb');
const rad = Math.PI / 180;

// ---------------- parámetros ----------------
const PISO = 3.65, BASE = 0.65;                   // altura de piso y base del 106 (main.js, «Partes»)
const ALERO_106 = 11.6;                           // altura del muro del 106 bajo el alero del techo (arquitectura.glb)
// La Casa (OSM 108): alero de la galería y cumbrera ESTIMADOS en Street View (verificacion/contexto2/identificacion.md)
const CASA = { alero: +(process.env.CASA_ALERO ?? 3.2), vuelo: 0.6, pend: +(process.env.CASA_PEND ?? 14.7), galeria: 2.5, columna: 0.4, paso: 3.3 };   // cumbrera = 3,2 + 13,75 · tan 14,7° ≈ 6,8 m (CASA_ALERO=… CASA_PEND=… para probar)
// Innova (OSM 109): nave, torre y ala ESTIMADAS en Street View (pretil a ~11 m en jg_xm100_h145, f ≈ 554 px)
const H_INNOVA = +(process.env.H_INNOVA ?? 11), H_TORRE = 13, H_ALA = 4;
const H_ATENEO = 10, H_ATENEO_FRENTE = 7;         // ESTIMADAS: la sala del Ateneo al alero y el cuerpo de su frente
const H_ESTRUCTURA = 3.5;                         // ESTIMADA: la estructura pequeña del cuadrángulo, un piso
const NIVELES_SIN_DATO = 2;                       // si OSM no trae building:levels
const RADIO_SOMBRA = 60;                          // m: a menos de esto del 106 (huella a huella) proyectan sombra
const TIPOLOGIA_106 = new Set(['105', '102', '103', '101', '100', '107']);   // cuarteles iguales al 106 (el usuario y Street View)
// largo medido en Open Buildings de los cuarteles que no miden lo que el 106 (45,5 m): la malla se estira a lo largo
const LARGO_CUARTEL = { '100': 58.7 };
// alturas de Open Buildings 2.5D (alturas_ob.py) para las huellas sin niveles en OSM
const OB = JSON.parse(fs.readFileSync(path.join(AQUI, 'alturas_ob.json'), 'utf8')).edificios;
const OB_CUBRE = 0.6;                              // fracción mínima de la huella con edificio en el dato para usar su altura
const ID_FUNDACION = 300885892, ID_CASA = 300885896, ID_INNOVA = 300885897, ID_ATENEO = 300885895, ID_106 = 300885891;
// la estructura pequeña del cuadrángulo, leída en el mapa de Google (captura del 29 sep 2026, ~3,7 px/m): 9,7 × 6,0 m,
// paralela al 106, con centro a (−28,7; −24,0) m del centro del 106 en la escena
const ESTRUCTURA = { c: [-28.7, -24.0], largo: 9.7, ancho: 6.0 };
// estacionamientos (medidos sobre la vista satelital georreferenciada, verificacion/contexto2/sat_centro.jpg): el de enfrente
// del 105, con la esquina oeste recortada por la curva de la vía que va a Innova, y su entrada desde la calle (vía OSM
// 1251012796); y el de detrás, entre Innova y el Ateneo, que sale a la calle del Ateneo
const ESTACIONAMIENTO = { poly: [[-87, 33], [-22, 38], [-19, 70], [-65, 73], [-82, 56]], entrada: { x: [-26.5, -18.5], z: [29.5, 38] } };
const ESTACIONAMIENTO_2 = [[-93, 76], [-55, 76], [-55, 121], [-93, 121]];
// cerramiento de bloque calado entre La Casa y la entrada del estacionamiento (Street View jg_xp0_h145, jg_xm20_h145): posición
// y medidas aproximadas
const CERRAMIENTO = { c: [-13.5, 34.5], largo: 3.6, ancho: 3.0, alto: 2.2 };

// materiales: los nombres deciden cómo los pinta escena.js (#material): «plaster» (pañete con manchas), «terracotta» (teja),
// «glass» (vidrio, con luces de noche más tenues en el contexto), «turf» (suelo abierto de noche)
const MAT = {
  muro: { n: 'Warm lime-painted plaster', c: [0.73, 0.75, 0.70], r: 0.84 },
  vidrio: { n: 'V016 context reflective glass 0', c: [0.06, 0.09, 0.10], r: 0.2, m: 0.18, glass: true },
  teja: { n: 'Clay terracotta 00', c: [0.125, 0.03, 0.015], r: 0.75 },
  madera: { n: 'Dark stained roof timber', c: [0.10, 0.06, 0.04], r: 0.74 },
  faja: { n: 'Clay-colored vertical attic fascia', c: [0.27, 0.10, 0.05], r: 0.8 },
  hueco: { n: 'Dark ventilation recess', c: [0.01, 0.02, 0.01], r: 0.95 },
  blanco: { n: 'V016 white painted render', c: [0.80, 0.80, 0.77], r: 0.85 },
  ladrillo: { n: 'V016 brick lattice', c: [0.30, 0.10, 0.05], r: 0.9 },
  maqueta: { n: 'V016 massing model (estimated height)', c: [0.62, 0.61, 0.57], r: 0.9 },
  asfalto: { n: 'Weathered asphalt 02 — photographic 3m', c: [0.23, 0.23, 0.22], r: 0.75, image: 'asphalt_02_diff_4k.jpg', ground_uv: 3 },
  pasto: { n: 'V016 distant park turf', c: [0.09, 0.16, 0.05], r: 0.96 },
  piedra: { n: 'Rubble stone plinth', c: [0.28, 0.24, 0.20], r: 0.92 },
  metal: { n: 'Blue-gray metal roof sheet', c: [0.22, 0.29, 0.36], r: 0.55, m: 0.25 },
};

// ---------------- geometría ----------------
/** Acumulador de triángulos por material (posiciones y normales planas, en coordenadas de la escena). */
class Malla {
  constructor() { this.m = {}; }
  /** Un triángulo; si se da `quiere`, se le da la vuelta para que su normal apunte hacia ese lado. */
  tri(mat, a, b, c, quiere = null) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const L = Math.hypot(...n);
    if (L < 1e-9) return;
    if (quiere && n[0] * quiere[0] + n[1] * quiere[1] + n[2] * quiere[2] < 0) { [b, c] = [c, b]; n = n.map((x) => -x); }
    const e = (this.m[mat] ??= { p: [], n: [] });
    e.p.push(...a, ...b, ...c); for (let k = 0; k < 3; k++) e.n.push(n[0] / L, n[1] / L, n[2] / L);
  }
  quad(mat, a, b, c, d, quiere = null) { this.tri(mat, a, b, c, quiere); this.tri(mat, a, c, d, quiere); }
  /** Caja orientada: centro (x, z), medidas a lo largo (l) y a lo ancho (w), de y0 a y1, girada ang grados (atan2(dz, dx)). */
  caja(mat, cx, cz, l, w, y0, y1, ang, { sinFondo = true, matTapa = null } = {}) {
    const P = rectangulo(cx, cz, l, w, ang);
    this.prisma(mat, P, y0, y1, { sinFondo, matTapa });
  }
  /** Prisma recto sobre un polígono (x, z): muros hacia afuera, tapa arriba y, si se pide, fondo. */
  prisma(mat, P, y0, y1, { sinFondo = true, matTapa = null } = {}) {
    P = orientar(P);
    const n = P.length;
    for (let i = 0; i < n; i++) {
      const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % n];
      this.quad(mat, [x1, y0, z1], [x1, y1, z1], [x2, y1, z2], [x2, y0, z2], [z2 - z1, 0, x1 - x2]);
    }
    const T = ShapeUtils.triangulateShape(P.map(([x, z]) => new Vector2(x, z)), []);
    for (const [a, b, c] of T) {
      this.tri(matTapa ?? mat, [P[a][0], y1, P[a][1]], [P[b][0], y1, P[b][1]], [P[c][0], y1, P[c][1]], [0, 1, 0]);
      if (!sinFondo) this.tri(mat, [P[a][0], y0, P[a][1]], [P[b][0], y0, P[b][1]], [P[c][0], y0, P[c][1]], [0, -1, 0]);
    }
  }
  /** Techo a cuatro aguas sobre un rectángulo (con vuelo), alero a yA y pendiente de 17° como el 106. */
  cuatroAguas(cx, cz, l, w, ang, yA, vuelo = 1.2, pend = 17) {
    const L = l + 2 * vuelo, W = w + 2 * vuelo, h = (W / 2) * Math.tan(pend * rad);
    const ca = Math.cos(ang * rad), sa = Math.sin(ang * rad);
    const q = (u, v, y) => [cx + u * ca - v * sa, y, cz + u * sa + v * ca];
    const r = Math.max(0, L / 2 - W / 2);                 // media cumbrera
    const a = q(-L / 2, -W / 2, yA), b = q(L / 2, -W / 2, yA), c = q(L / 2, W / 2, yA), d = q(-L / 2, W / 2, yA);
    const e = q(-r, 0, yA + h), f = q(r, 0, yA + h);
    // caras hacia afuera (antihorario visto desde fuera)
    const arriba = [0, 1, 0];
    this.quad('teja', a, e, f, b, arriba); this.quad('teja', c, f, e, d, arriba); this.tri('teja', b, f, c, arriba); this.tri('teja', d, e, a, arriba);
    this.quad('madera', a, b, c, d, [0, -1, 0]);          // sofito (mira hacia abajo)
    return yA + h;
  }
}
function rectangulo(cx, cz, l, w, ang) {
  const ca = Math.cos(ang * rad), sa = Math.sin(ang * rad), q = (u, v) => [cx + u * ca - v * sa, cz + u * sa + v * ca];
  return [q(-l / 2, -w / 2), q(-l / 2, w / 2), q(l / 2, w / 2), q(l / 2, -w / 2)];   // antihorario visto desde +Y
}
/** Polígono con área positiva en el plano (x, z) (x1·z2 − x2·z1 > 0): así (dz, −dx) de cada lado apunta hacia afuera. */
function orientar(P) { let A = 0; for (let i = 0; i < P.length; i++) { const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % P.length]; A += x1 * z2 - x2 * z1; } return A < 0 ? [...P].reverse() : [...P]; }

/** Descompone un polígono casi ortogonal (en su marco local) en franjas rectangulares a lo largo de su eje largo. */
function franjas(P, ang) {
  const ca = Math.cos(-ang * rad), sa = Math.sin(-ang * rad);
  const L = P.map(([x, z]) => [x * ca - z * sa, x * sa + z * ca]);
  const zs = [...new Set(L.map((p) => Math.round(p[1] * 2) / 2))].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i + 1 < zs.length; i++) {
    const zm = (zs[i] + zs[i + 1]) / 2, xs = [];
    for (let k = 0; k < L.length; k++) { const [x1, z1] = L[k], [x2, z2] = L[(k + 1) % L.length]; if ((z1 <= zm) !== (z2 <= zm)) xs.push(x1 + (zm - z1) / (z2 - z1) * (x2 - x1)); }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) out.push({ z0: zs[i], z1: zs[i + 1], x0: xs[k], x1: xs[k + 1] });
  }
  return { franjas: out, aMundo: (u, v) => [u * Math.cos(ang * rad) - v * Math.sin(ang * rad), u * Math.sin(ang * rad) + v * Math.cos(ang * rad)] };
}

/** Del marco local de un edificio (u a lo largo de su lado principal, v a lo ancho; origen en b.centro) a la escena, y al revés. */
function local(b, u, v) { const ca = Math.cos(b.ang * rad), sa = Math.sin(b.ang * rad); return [b.centro[0] + u * ca - v * sa, b.centro[1] + u * sa + v * ca]; }
function aLocal(b, x, z) { const ca = Math.cos(b.ang * rad), sa = Math.sin(b.ang * rad), dx = x - b.centro[0], dz = z - b.centro[1]; return [dx * ca + dz * sa, -dx * sa + dz * ca]; }

// ---------------- el 106 reducido ----------------
await MeshoptDecoder.ready; await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

/** Triángulos (mundo) de las mallas de un GLB cuyo material cumple `re`: { p: Float32Array, n: Float32Array, i: Uint32Array }. */
async function extraer(grupo, re) {
  const doc = await io.read(path.join(MODELO, grupo + '.glb'));
  const p = [], n = [], idx = [];
  for (const nodo of doc.getRoot().listNodes()) {
    const malla = nodo.getMesh(); if (!malla) continue;
    const M = nodo.getWorldMatrix();
    for (const pr of malla.listPrimitives()) {
      if (!re.test(pr.getMaterial()?.getName() ?? '')) continue;
      const A = pr.getAttribute('POSITION'), N = pr.getAttribute('NORMAL'), I = pr.getIndices(), base = p.length / 3, v = [0, 0, 0], w = [0, 0, 0];
      for (let k = 0; k < A.getCount(); k++) {
        A.getElement(k, v); p.push(M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]);
        N.getElement(k, w); const x = M[0] * w[0] + M[4] * w[1] + M[8] * w[2], y = M[1] * w[0] + M[5] * w[1] + M[9] * w[2], z = M[2] * w[0] + M[6] * w[1] + M[10] * w[2], L = Math.hypot(x, y, z) || 1;
        n.push(x / L, y / L, z / L);
      }
      const cnt = I ? I.getCount() : A.getCount();
      for (let k = 0; k < cnt; k++) idx.push(base + (I ? I.getScalar(k) : k));
    }
  }
  return { p: Float32Array.from(p), n: Float32Array.from(n), i: Uint32Array.from(idx) };
}
/** Simplificación sloppy (fusiona piezas sueltas, como las tejas). */
function reducir(g, fraccion, error) {
  const target = Math.max(3, Math.floor(g.i.length * fraccion / 3) * 3);
  const [out] = MeshoptSimplifier.simplifySloppy(g.i, g.p, 3, null, target, error);
  return { ...g, i: out };
}

const tipo = {
  muro: await extraer('arquitectura', /^Warm lime-painted plaster$/),
  vidrio: await extraer('arquitectura', /physical clear glass/),
  teja: reducir(await extraer('cubiertas', /terracotta/i), 0.045, 0.01),
  madera: await extraer('cubiertas_sombra', /roof timber/),
  mensulas: reducir(await extraer('detalles', /roof timber/), 0.35, 0.004),
  faja: await extraer('cubiertas_sombra', /attic fascia/),
  hueco: await extraer('cubiertas_sombra', /ventilation recess/),
};
tipo.madera = unir(tipo.madera, tipo.mensulas); delete tipo.mensulas;
function unir(a, b) { const k = a.p.length / 3; return { p: Float32Array.from([...a.p, ...b.p]), n: Float32Array.from([...a.n, ...b.n]), i: Uint32Array.from([...a.i, ...Array.from(b.i, (x) => x + k)]) }; }

// ---------------- documento ----------------
const doc = new Document();
const buf = doc.createBuffer();
const mats = {};
for (const [k, d] of Object.entries(MAT)) {
  const m = doc.createMaterial(d.n).setBaseColorFactor([...d.c, 1]).setRoughnessFactor(d.r).setMetallicFactor(d.m ?? 0);
  m.setExtras({ leaf: false, glass: !!d.glass, image: d.image ?? null, ground_uv: d.ground_uv ?? null });
  mats[k] = m;
}
function primitiva(mat, p, n, i = null) {
  const pr = doc.createPrimitive().setMaterial(mats[mat])
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(p instanceof Float32Array ? p : Float32Array.from(p)).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(n instanceof Float32Array ? n : Float32Array.from(n)).setBuffer(buf));
  if (i) pr.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(i)).setBuffer(buf));
  return pr;
}
function mallaDe(nombre, malla) {
  const m = doc.createMesh(nombre);
  for (const [mat, e] of Object.entries(malla.m)) m.addPrimitive(primitiva(mat, e.p, e.n));
  return m;
}
const raiz = doc.createNode('contexto').setExtras({ orden: 7 });
doc.createScene().addChild(raiz);

const osm = osmRegistrado();
const P106 = rectangulo(0, 0, 45.5, 23, 0);
const cerca = (P) => distanciaPoligonos(P, P106) < RADIO_SOMBRA;
const resumen = { cuarteles: [], volumenes: [], sombra: [] };

// cuarteles: la malla del 106 reducido, compartida
const mTipo = doc.createMesh('tipologia 106 reducida');
for (const [mat, g] of Object.entries(tipo)) mTipo.addPrimitive(primitiva(mat, g.p, g.n, g.i));
for (const b of osm.edificios.filter((e) => TIPOLOGIA_106.has(e.num))) {
  const s = cerca(b.poly);
  const ang = b.ang + (b.largo < b.ancho ? 90 : 0);  // la huella del 100 tiene el lado largo a lo ancho del 106
  const nodo = doc.createNode(`cuartel ${b.num}${b.nombre ? ' · ' + b.nombre : ''} (OSM ${b.id})`).setMesh(mTipo)
    .setTranslation([b.centro[0], 0, b.centro[1]]).setRotation([0, Math.sin(-ang * rad / 2), 0, Math.cos(-ang * rad / 2)]);
  if (LARGO_CUARTEL[b.num]) nodo.setScale([LARGO_CUARTEL[b.num] / 45.5, 1, 1]);
  if (s) nodo.setExtras({ sombra: true });
  raiz.addChild(nodo);
  resumen.cuarteles.push(`${b.num} (${b.centro.map((v) => v.toFixed(1)).join(', ')}) giro ${ang.toFixed(2)}°${LARGO_CUARTEL[b.num] ? `, ${LARGO_CUARTEL[b.num]} m de largo` : ''}${s ? ', proyecta sombra' : ''}`);
}

// volúmenes propios: cerca (proyectan sombra) y lejos
const MC = new Malla(), ML = new Malla();
for (const b of osm.edificios) {
  if (b.id === ID_106 || TIPOLOGIA_106.has(b.num)) continue;
  const s = cerca(b.poly), M = s ? MC : ML, P = b.poly;
  if (b.id === ID_FUNDACION) {
    // muros de 3 pisos a la altura del alero del 106; techo de teja sobre el cuerpo principal (la franja común a todo el
    // largo) y sobre cada ala; tres entradas grandes en la cara que mira al cuadrángulo (+X)
    M.prisma('muro', P, 0, ALERO_106, { matTapa: 'madera' });
    const { franjas: todas, aMundo } = franjas(b.poly, b.ang);
    const F = todas.filter((f) => f.z1 - f.z0 >= 1.5);        // sin las franjas de medio metro que deja el giro en los extremos
    const x0 = Math.max(...F.map((f) => f.x0)), x1 = Math.min(...F.map((f) => f.x1)), z0 = Math.min(...F.map((f) => f.z0)), z1 = Math.max(...F.map((f) => f.z1));
    const cM = aMundo((x0 + x1) / 2, (z0 + z1) / 2);
    const cumbrera = M.cuatroAguas(cM[0], cM[1], z1 - z0, x1 - x0, b.ang + 90, ALERO_106);
    // alas: lo que sobra de cada franja fuera del cuerpo principal (más de 3 m de ancho)
    for (const f of F) for (const [a, c] of [[f.x0, x0], [x1, f.x1]]) {
      if (c - a < 3) continue;
      const cA = aMundo((a + c) / 2, (f.z0 + f.z1) / 2);
      M.cuatroAguas(cA[0], cA[1], f.z1 - f.z0, c - a, b.ang + 90, ALERO_106 - 0.3, 0.6);
    }
    // entradas: pórticos de 10 m de ancho y 2,5 m de fondo, un poco más altos que el alero, con un vano oscuro de 5 × 7,5 m
    for (const zc of [z0 + (z1 - z0) / 6, (z0 + z1) / 2, z1 - (z1 - z0) / 6]) {
      const u = x1 + 1.25, c = aMundo(u, zc);
      M.caja('muro', c[0], c[1], 2.5, 10, 0, ALERO_106 + 0.8, b.ang, { matTapa: 'teja' });
      const v = aMundo(x1 + 2.52, zc);
      M.caja('hueco', v[0], v[1], 0.04, 5, 0, 7.5, b.ang);
    }
    resumen.volumenes.push(`Fundación Ciudad del Saber (OSM ${b.id}): muros de ${ALERO_106} m, cumbrera ${cumbrera.toFixed(1)} m, 3 entradas sugeridas`);
  } else if (b.id === ID_CASA) {
    // La Casa: la huella de OSM incluye la galería (el borde de la cubierta); los muros quedan 2,5 m adentro en las caras
    // noroeste (−Z local, la de la calle) y noreste (+X local); columnas blancas en el borde; teja a cuatro aguas sobre toda la
    // huella, con el sofito de la galería a la altura del alero
    const [u0, u1, v0, v1] = b.caja, g = CASA.galeria, cM = local(b, (u0 + u1) / 2, (v0 + v1) / 2);
    M.prisma('muro', [local(b, u0, v0 + g), local(b, u0, v1), local(b, u1 - g, v1), local(b, u1 - g, v0 + g)], 0, CASA.alero);
    // zócalo de piedra (arcos y zócalo en Street View) en los muros de la galería, 5 cm hacia afuera
    M.caja('piedra', ...local(b, (u0 + u1 - g) / 2, v0 + g - 0.025), u1 - g - u0, 0.05, 0, 0.9, b.ang);
    M.caja('piedra', ...local(b, u1 - g + 0.025, (v0 + g + v1) / 2), 0.05, v1 - v0 - g, 0, 0.9, b.ang);
    const col = (u, v) => { const p = local(b, u, v); M.caja('blanco', p[0], p[1], CASA.columna, CASA.columna, 0, CASA.alero, b.ang); };
    const r = CASA.columna / 2 + 0.05;
    const nU = Math.round((u1 - r - (u0 + r)) / CASA.paso), nV = Math.round((v1 - r - (v0 + r)) / CASA.paso);
    for (let k = 0; k <= nU; k++) col(u0 + r + (u1 - u0 - 2 * r) * k / nU, v0 + r);                  // cara noroeste
    for (let k = 1; k <= nV; k++) col(u1 - r, v0 + r + (v1 - v0 - 2 * r) * k / nV);                  // cara noreste
    const cumbrera = M.cuatroAguas(cM[0], cM[1], u1 - u0, v1 - v0, b.ang, CASA.alero, CASA.vuelo, CASA.pend);
    resumen.volumenes.push(`La Casa (OSM ${b.id}): ${b.largo.toFixed(1)} × ${b.ancho.toFixed(1)} m, un piso, alero ${CASA.alero} m y cumbrera ${cumbrera.toFixed(1)} m ESTIMADOS, galería al noroeste y al noreste`);
  } else if (b.id === ID_INNOVA) {
    // la huella tiene dos partes: la nave (x > −115) y el ala baja al suroeste; se separan por los vértices de la unión
    const lejos = P.map(([x]) => x < -118), i0 = lejos.indexOf(true), i1 = lejos.lastIndexOf(true);
    const ala = P.slice(i0 - 1, i1 + 2), nave = [...P.slice(i1 + 1), ...P.slice(0, i0)];
    M.prisma('blanco', ala, 0, H_ALA);
    // la nave en su propio marco (el de la huella): caja local [u0, u1] × [v0, v1]; la cara noroeste es v0 (−Z)
    const n = { centro: [0, 0], ang: b.ang };
    // (en este marco la cara suroeste libre, la noreste y la noroeste son rectas; la suroeste se abre hacia afuera junto al ala)
    const loc = nave.map(([x, z]) => aLocal(n, x, z));
    const u0 = Math.max(...loc.filter((p) => p[0] < -100).map((p) => p[0])), u1 = Math.min(...loc.filter((p) => p[0] > -100).map((p) => p[0]));
    const v0 = Math.max(...loc.filter((p) => p[1] < 60).map((p) => p[1])), v1 = Math.min(...loc.filter((p) => p[1] > 88).map((p) => p[1]));
    const vAla = Math.min(...ala.map(([x, z]) => aLocal(n, x, z)[1])), vt = (v0 + vAla) / 2;   // donde empieza el ala; la torre, en el tramo libre
    const q = (u, v) => local(n, u, v), uc = (u0 + u1) / 2;
    M.prisma('blanco', nave, 0, H_INNOVA);
    M.prisma('blanco', [q(u0 + 0.6, v0 + 0.6), q(u0 + 0.6, v1 - 0.6), q(u1 - 0.6, v1 - 0.6), q(u1 - 0.6, v0 + 0.6)], H_INNOVA, H_INNOVA + 0.6);   // pretil
    // cara noroeste: paño de celosía de ladrillo en el centro, la entrada vidriada debajo y la visera
    const c1 = q(uc, v0 - 0.12); M.caja('ladrillo', c1[0], c1[1], 4.4, 0.24, 4.0, H_INNOVA - 0.3, b.ang);
    for (let u = uc - 1.95; u <= uc + 1.96; u += 0.3) for (let y = 4.2; y <= H_INNOVA - 0.64; y += 0.3) { const h = q(u, v0 - 0.27); M.caja('hueco', h[0], h[1], 0.15, 0.01, y, y + 0.15, b.ang); }
    const c2 = q(uc, v0 - 0.03); M.caja('vidrio', c2[0], c2[1], 5, 0.06, 0, 3.0, b.ang);
    const c3 = q(uc, v0 - 1.6); M.caja('blanco', c3[0], c3[1], 7, 3.2, 3.1, 3.5, b.ang, { sinFondo: false });
    // caras largas (noreste, hacia el estacionamiento, y suroeste): pilastras blancas cada 3,2 m y, entre ellas, franjas de ladrillo
    for (let v = v0 + 1.6; v < v1 - 1; v += 3.2) for (const [u, du] of [[u0, -1], [u1, 1]]) {
      if (du < 0 && (v > vAla - 1.8 || Math.abs(v - vt) < 2.5)) continue;          // en la suroeste, solo en el tramo libre y fuera de la torre
      const p = q(u + du * 0.2, v); M.caja('blanco', p[0], p[1], 0.4, 0.5, 0, H_INNOVA, b.ang);
      if (v + 1.6 < (du < 0 ? vAla - 1.8 : v1 - 1) && !(du < 0 && Math.abs(v + 1.6 - vt) < 2.5)) { const f = q(u + du * 0.03, v + 1.6); M.caja('ladrillo', f[0], f[1], 0.06, 0.9, 0.6, H_INNOVA - 1.2, b.ang); }
    }
    // torre esbelta de celosía de ladrillo en el flanco suroeste, en el tramo libre de la nave (entre la cara noroeste y el ala)
    const t = q(u0 - 1.5, vt);
    M.caja('ladrillo', t[0], t[1], 2.6, 2.6, 0, H_TORRE, b.ang);
    for (let y = 1.5; y <= H_TORRE - 1.2; y += 0.7) for (const d of [-0.6, 0, 0.6]) { const h = q(u0 - 2.83, vt + d); M.caja('hueco', h[0], h[1], 0.01, 0.3, y, y + 0.35, b.ang); }
    resumen.volumenes.push(`Innova (OSM ${b.id}): nave ${(u1 - u0).toFixed(1)} × ${(v1 - v0).toFixed(1)} m a ${H_INNOVA} m, torre ${H_TORRE} m, ala ${H_ALA} m (ESTIMADAS); celosía en la cara noroeste`);
  } else if (b.id === ID_ATENEO) {
    // la sala (el rectángulo grande de la huella) a 10 m con teja a cuatro aguas; el cuerpo del frente, más bajo
    const n = { centro: [0, 0], ang: b.ang }, loc = P.map(([x, z]) => aLocal(n, x, z));
    const vF = Math.max(...loc.filter((p) => p[1] < 90).map((p) => p[1]));   // donde empieza la sala (detrás del cuerpo del frente)
    const u0 = Math.min(...loc.map((p) => p[0])), u1 = Math.max(...loc.map((p) => p[0])), v1 = Math.max(...loc.map((p) => p[1]));
    M.prisma('muro', P, 0, H_ATENEO_FRENTE, { matTapa: 'madera' });
    const sala = [local(n, u0, vF), local(n, u0, v1), local(n, u1, v1), local(n, u1, vF)];
    M.prisma('muro', sala, H_ATENEO_FRENTE, H_ATENEO, { matTapa: 'madera' });
    const c = local(n, (u0 + u1) / 2, (vF + v1) / 2);
    const cumbrera = M.cuatroAguas(c[0], c[1], v1 - vF, u1 - u0, b.ang + 90, H_ATENEO, 0.8, 15);
    resumen.volumenes.push(`Teatro Ateneo (OSM ${b.id}): sala de ${H_ATENEO} m, cumbrera ${cumbrera.toFixed(1)} m, frente de ${H_ATENEO_FRENTE} m (ESTIMADAS)`);
  } else {
    const ob = !b.niveles && OB[b.id]?.cubre >= OB_CUBRE ? OB[b.id] : null;
    const niv = b.niveles ?? NIVELES_SIN_DATO, h = ob ? ob.p90 : niv * PISO + BASE;
    M.prisma('maqueta', P, 0, h);
    resumen.volumenes.push(`${b.num || '—'} ${b.nombre || ''} (OSM ${b.id}): maqueta de ${h.toFixed(2)} m (${ob ? 'Open Buildings p90' : niv + ' niveles' + (b.niveles ? ' de OSM' : ', sin dato')}; ESTIMADA)`);
  }
  if (s) resumen.sombra.push(`${b.num || b.id} ${b.nombre || ''} (a ${distanciaPoligonos(b.poly, P106).toFixed(1)} m)`);
}
// estructura pequeña del cuadrángulo (proyecta sombra: está a ~10 m del 106)
MC.caja('muro', ESTRUCTURA.c[0], ESTRUCTURA.c[1], ESTRUCTURA.largo, ESTRUCTURA.ancho, 0, H_ESTRUCTURA, 0, { matTapa: 'metal' });
resumen.sombra.push(`estructura pequeña del cuadrángulo (a ${distanciaPoligonos(rectangulo(ESTRUCTURA.c[0], ESTRUCTURA.c[1], ESTRUCTURA.largo, ESTRUCTURA.ancho, 0), P106).toFixed(1)} m)`);
// estacionamientos (planos, a 1,5 cm sobre el pasto; no proyectan sombra)
{
  const y = 0.015, e = ESTACIONAMIENTO.entrada;
  const plano = (P) => { P = orientar(P); for (const [a, b, c] of ShapeUtils.triangulateShape(P.map(([x, z]) => new Vector2(x, z)), [])) ML.tri('asfalto', [P[a][0], y, P[a][1]], [P[b][0], y, P[b][1]], [P[c][0], y, P[c][1]], [0, 1, 0]); };
  plano(ESTACIONAMIENTO.poly); plano(ESTACIONAMIENTO_2);
  plano([[e.x[0], e.z[0]], [e.x[1], e.z[0]], [e.x[1], e.z[1]], [e.x[0], e.z[1]]]);
}
// cerramiento de bloque calado: caja blanca con una rejilla de huecos oscuros en las cuatro caras (no proyecta sombra)
{
  const { c, largo: l, ancho: w, alto: h } = CERRAMIENTO;
  ML.caja('blanco', c[0], c[1], l, w, 0, h, 0);
  for (let y = 0.35; y <= h - 0.3; y += 0.3) {
    for (let u = -l / 2 + 0.3; u <= l / 2 - 0.29; u += 0.3) for (const s of [-1, 1]) ML.caja('hueco', c[0] + u, c[1] + s * (w / 2 + 0.03), 0.18, 0.01, y, y + 0.18, 0);
    for (let v = -w / 2 + 0.3; v <= w / 2 - 0.29; v += 0.3) for (const s of [-1, 1]) ML.caja('hueco', c[0] + s * (l / 2 + 0.03), c[1] + v, 0.01, 0.18, y, y + 0.18, 0);
  }
}
// pasto lejano al noroeste (más allá del terreno del sitio, como el contexto anterior)
ML.quad('pasto', [-180, -0.12, -260], [-180, -0.12, -120], [180, -0.12, -120], [180, -0.12, -260], [0, 1, 0]);

const nC = doc.createNode('vecinos cercanos (proyectan sombra)').setMesh(mallaDe('vecinos cercanos', MC)).setExtras({ sombra: true });
const nL = doc.createNode('vecinos lejanos').setMesh(mallaDe('vecinos lejanos', ML));
raiz.addChild(nC); raiz.addChild(nL);

// ---------------- compresión (como optimize2.mjs) ----------------
await doc.transform(weld({ tolerance: 0.0001 }), dedup(), prune(), quantize({ quantizePosition: 16, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(SALIDA, doc);

let tris = 0;
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
console.log('cuarteles (106 reducido, malla compartida):\n  ' + resumen.cuarteles.join('\n  '));
console.log('volúmenes:\n  ' + resumen.volumenes.join('\n  '));
console.log('proyectan sombra (< ' + RADIO_SOMBRA + ' m del 106):\n  ' + resumen.sombra.join('\n  '));
console.log('triángulos guardados', Math.round(tris), '· 106 reducido:', Object.entries(tipo).map(([k, g]) => `${k} ${g.i.length / 3}`).join(', '));
console.log('escrito', SALIDA, (fs.statSync(SALIDA).size / 1024).toFixed(0), 'KB');
