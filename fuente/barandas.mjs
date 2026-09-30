// Completa las barandas de los accesos que terminaban en el aire o a unos centímetros del muro, en entrada.glb y sitio.glb
// (los GLB web ya comprimidos, o el documento de optimize2.mjs antes de escribirlo). Paso reproducible y sin efecto si se
// repite: cada regla comprueba si ya se cumple y, si es así, no toca nada.
//
//   cd fuente && node barandas.mjs              corrige ../modelo/entrada.glb y ../modelo/sitio.glb en su lugar
//   node barandas.mjs --medir                   solo mide y lista los extremos libres (no escribe)
//
// Medido en septiembre de 2026 con rayos contra arquitectura/sitio/entrada/detalles/ventanas. Coordenadas de la escena en
// metros (+X = noreste, +Z = sureste, Y arriba; en Blender: x = X, y = −Z, z = Y). Muro sureste (el de la puerta
// principal) en z = 11,50; muro noroeste en z = −11,50.
//  1. Escalera de la entrada (siete peldaños, x 11,05 a 14,55): los dos pasamanos (malla «Galvanized guardrail» de entrada,
//     a x 11,10 y x 14,50) seguían en horizontal 1,00 m más allá del último poste (z 14,80) y se cortaban en el aire en
//     z 13,80, a 2,30 m del muro. En la foto (WA0014) el pasamanos oeste sube y remata contra el muro junto a la puerta;
//     el este no puede llegar al muro porque cruzaría la llegada de la rampa al porche (x 14,9 a 15,6, z 11,5 a 12,8):
//     en el 105, de la misma tipología, termina en un poste propio.
//       · oeste: el tramo horizontal se alarga hasta el muro (z 11,50) con dos postes intermedios (z 13,70 y 12,60),
//         copias del poste superior de la escalera, a ~1,1 m como los de la escalera.
//       · este: poste de remate bajo el extremo (z 13,82), copia del mismo poste.
//     Después, entrada.mjs retira la escalera 3,15 m hasta la puerta y mueve con ella estos pasamanos (quita los tres postes
//     del porche, que quedarían dentro del edificio); sobre el entrada.glb ya corregido esta regla no hace nada. Para el
//     .blend, las instrucciones de la escalera y sus pasamanos que valen son las de entrada.mjs.
//  2. Rellano de la rampa (x 21,5 a 22,9, z 11,5 a 14,24, a 0,635 m del suelo): el borde exterior (z 14,22) quedaba abierto
//     1,32 m entre el poste final del tramo bajo (x 21,50) y el poste de esquina (x 22,82). En la foto la baranda exterior
//     del tramo bajo sigue por el rellano hasta la esquina. Se agregan sus tres tubos (pasamanos y dos travesaños, a las
//     mismas alturas que los del lado este del rellano), copias giradas de esos tubos.
//  3. Escalera trasera (fachada noroeste, «Brown painted service access» de sitio): los tres tubos que vuelven desde el
//     poste de la escalera hacia el muro (x −2,15) terminaban en z −11,60, a 9,8 cm del muro. Se alargan hasta él.
// En el .blend de origen (isthmus-digitaldouble; en Blender: x = X, y = −Z, z = Y, así que el muro sureste está en
// y = −11,50 y el noroeste en y = +11,50) hay que hacer lo mismo, con los mismos materiales:
//  · entrada, «Galvanized guardrail»: en el pasamanos oeste de la escalera (x 11,10) llevar el extremo del tramo horizontal
//    (z 2,03) de y −13,80 a y −11,50; duplicar el poste superior (x 11,10, y −14,80, z 1,12 a 2,03) en y −13,70 y −12,60;
//    duplicar el poste superior del pasamanos este (x 14,50) en y −13,82.
//  · entrada, rampa: tres tubos nuevos en y −14,22, de x 21,50 a 22,82, a z 1,565 (Ø 5,4 cm), 1,145 y 0,805 (Ø 3,6 cm),
//    como los del lado este del rellano.
//  · sitio, «Brown painted service access»: los tres tubos que salen del poste superior derecho de la escalera trasera
//    (x −2,15) hacia el muro: llevar su extremo de y 11,60 a y 11,50.
// Si el .blend ya lo trae, estas reglas no hacen nada (cada una comprueba primero si ya se cumple).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MURO_SE = 11.50, MURO_NO = -11.50;
export const aplicar = (M, [x, y, z]) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];

/** Piezas (componentes conexas) de las mallas cuyo nombre cumple `re`, con sus vértices en coordenadas del mundo. */
export function piezas(doc, re) {
  const out = [];
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m || !re.test(m.getName())) continue;
    const W = n.getWorldMatrix();
    // la escala de la cuantización es uniforme y sin giro: las normales se giran igual que las posiciones
    if (Math.abs(W[1]) + Math.abs(W[2]) + Math.abs(W[4]) + Math.abs(W[6]) + Math.abs(W[8]) + Math.abs(W[9]) > 1e-9 || Math.abs(W[0] - W[5]) > 1e-9 || Math.abs(W[0] - W[10]) > 1e-9)
      throw new Error(`${m.getName()}: el nodo tiene giro o escala no uniforme; barandas.mjs no lo contempla`);
    const W1 = [1 / W[0], 0, 0, 0, 0, 1 / W[5], 0, 0, 0, 0, 1 / W[10], 0, -W[12] / W[0], -W[13] / W[5], -W[14] / W[10], 1];
    for (const p of m.listPrimitives()) {
      const A = p.getAttribute('POSITION'), nv = A.getCount(), P = new Float64Array(nv * 3), e = [0, 0, 0];
      for (let i = 0; i < nv; i++) P.set(aplicar(W, A.getElement(i, e)), 3 * i);
      const I = Array.from(p.getIndices().getArray());
      const clave = new Map(), vid = new Int32Array(nv);
      for (let i = 0; i < nv; i++) { const k = `${Math.round(P[3 * i] * 2e3)},${Math.round(P[3 * i + 1] * 2e3)},${Math.round(P[3 * i + 2] * 2e3)}`; let v = clave.get(k); if (v === undefined) { v = clave.size; clave.set(k, v); } vid[i] = v; }
      const par = Int32Array.from({ length: clave.size }, (_, i) => i), f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
      for (let t = 0; t < I.length / 3; t++) { const a = f(vid[I[3 * t]]), b = f(vid[I[3 * t + 1]]); par[a] = b; par[f(vid[I[3 * t + 2]])] = b; }
      const porRaiz = new Map();
      for (let t = 0; t < I.length / 3; t++) {
        const r = f(vid[I[3 * t]]); let c = porRaiz.get(r);
        if (!c) { c = { malla: m.getName(), p, W, W1, P, tris: [], verts: new Set(), mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] }; porRaiz.set(r, c); out.push(c); }
        c.tris.push(t);
        for (let j = 0; j < 3; j++) { const v = I[3 * t + j]; c.verts.add(v); for (let k = 0; k < 3; k++) { c.mn[k] = Math.min(c.mn[k], P[3 * v + k]); c.mx[k] = Math.max(c.mx[k], P[3 * v + k]); } }
      }
    }
  }
  return out;
}
export const centro = (c) => c.mn.map((x, k) => (x + c.mx[k]) / 2);
export const tam = (c) => c.mx.map((x, k) => x - c.mn[k]);
/** Las piezas que cumplen `f`; con `n`, exige que sean exactamente n (si no, el modelo cambió y la regla ya no aplica). */
function elegir(L, f, n, que) {
  const r = L.filter(f);
  if (n != null && r.length !== n) throw new Error(`${que}: se esperaban ${n} piezas y hay ${r.length}; el modelo cambió, revisa barandas.mjs`);
  return r;
}

/** Mueve a `valor` (en el eje `eje`, coordenadas del mundo) los vértices de la pieza que están en su extremo `lado`. */
function estirar(c, eje, lado, valor) {
  const A = c.p.getAttribute('POSITION'), lim = lado === 'min' ? c.mn[eje] : c.mx[eje];
  let n = 0;
  for (const v of c.verts) {
    const w = [c.P[3 * v], c.P[3 * v + 1], c.P[3 * v + 2]];
    if (Math.abs(w[eje] - lim) > 0.01) continue;
    w[eje] = valor; A.setElement(v, comprobar(aplicar(c.W1, w), c)); n++;
  }
  return n;
}
export function comprobar(l, c) {
  if (l.some((x) => Math.abs(x) > 1 + 1e-4)) throw new Error(`${c.malla}: la pieza nueva sale del volumen de cuantización de la malla`);
  return l.map((x) => Math.max(-1, Math.min(1, x)));         // los vértices del borde del volumen, sin el error de redondeo
}

/** Agrega a la primitiva de `molde` una copia de sus triángulos con cada vértice (del mundo) pasado por `mover`,
 *  y cada normal por `girar`. */
export function copiar(doc, molde, mover, girar = (n) => n) {
  const p = molde.p, vs = [...molde.verts], nuevo = new Map(), base = p.getAttribute('POSITION').getCount();
  vs.forEach((v, i) => nuevo.set(v, base + i));
  for (const sem of p.listSemantics()) {
    const acc = p.getAttribute(sem), viejo = acc.getArray(), sz = acc.getElementSize();
    const arr = new viejo.constructor(viejo.length + vs.length * sz); arr.set(viejo);
    acc.setArray(arr);
    const e = [];
    vs.forEach((v, i) => {
      acc.getElement(v, e);
      if (sem === 'POSITION') acc.setElement(base + i, comprobar(aplicar(molde.W1, mover([molde.P[3 * v], molde.P[3 * v + 1], molde.P[3 * v + 2]])), molde));
      else if (sem === 'NORMAL') acc.setElement(base + i, girar(e.slice(0, 3)));
      else acc.setElement(base + i, e);
    });
  }
  const ind = p.getIndices(), I = ind.getArray(), total = base + vs.length;
  const tipo = total > 65535 ? Uint32Array : I.constructor, J = new tipo(I.length + molde.tris.length * 3); J.set(I);
  let o = I.length;
  for (const t of molde.tris) for (let j = 0; j < 3; j++) J[o++] = nuevo.get(I[3 * t + j]);
  ind.setArray(J);
}

const f2 = (x) => x.toFixed(2);
/** ¿Alguna de las piezas tiene un vértice a menos de `tol` (en planta; en altura, 3 cm) del punto? */
const hayVertice = (L, [x, y, z], tol) => L.some((c) => [...c.verts].some((v) => Math.hypot(c.P[3 * v] - x, c.P[3 * v + 2] - z) < tol && Math.abs(c.P[3 * v + 1] - y) < 0.03));

/** Corrige el documento de `grupo` ('entrada' o 'sitio') en su lugar. Devuelve un resumen de lo hecho. */
export function corregirBarandas(doc, grupo) {
  const res = [];
  if (grupo === 'entrada') {
    const L = piezas(doc, /guardrail/i);
    const cerca = (a, b, tol = 0.05) => Math.abs(a - b) < tol;
    // 1. pasamanos de la escalera: tubo inclinado de ~2,9 m en z, a x 11,10 y 14,50. Si entrada.mjs ya retiró la escalera
    //    hasta la puerta (sin poste superior en z 14,80), los pasamanos ya llegan al muro y la regla no aplica.
    const retirada = !L.some((c) => cerca(c.mn[1], 1.12) && tam(c)[2] < 0.06 && cerca(centro(c)[2], 14.80));
    if (retirada) res.push('escalera de la entrada ya retirada (entrada.mjs): regla 1 sin efecto');
    for (const x of retirada ? [] : [11.10, 14.50]) {
      const [pas] = elegir(L, (c) => cerca(centro(c)[0], x) && tam(c)[2] > 1.2 && tam(c)[1] > 0.5, 1, `pasamanos de la escalera x ${x}`);
      const [poste] = elegir(L, (c) => cerca(centro(c)[0], x) && cerca(centro(c)[2], 14.80) && tam(c)[2] < 0.06 && cerca(c.mn[1], 1.12), 1, `poste superior x ${x}`);
      // (por vértices y no por piezas: una pieza nueva puede quedar soldada a la vecina si comparten vértices)
      const hayPoste = (z) => hayVertice(L, [x, 1.12, z], 0.03);
      const pon = (z) => { if (hayPoste(z)) return; const dz = z - centro(poste)[2]; copiar(doc, poste, ([a, b, c]) => [a, b, c + dz]); res.push(`poste nuevo en x ${f2(x)}, z ${f2(z)}`); };
      if (x < 12) {
        if (pas.mn[2] > MURO_SE + 0.01) {
          const antes = pas.mn[2], n = estirar(pas, 2, 'min', MURO_SE);
          res.push(`pasamanos oeste de la escalera: de z ${f2(antes)} al muro (z ${f2(MURO_SE)}), ${((antes - MURO_SE) * 100).toFixed(0)} cm más (${n} vértices)`);
        }
        pon(13.70); pon(12.60);
      } else pon(13.82);          // el este remata en un poste propio: más allá cruzaría la llegada de la rampa
    }
    // 2. borde exterior del rellano de la rampa: copias de los tres tubos del lado este (x 22,82, de z 11,52 a 14,22)
    //    (el borde está cerrado a una altura si una misma pieza tiene vértices en los dos postes, x 21,50 y 22,82)
    const X0 = 21.50, X1 = 22.82, Zb = 14.22;
    const cerrado = (y) => L.some((c) => hayVertice([c], [X0, y, Zb], 0.04) && hayVertice([c], [X1, y, Zb], 0.04));
    const faltan = [1.565, 1.145, 0.805].filter((y) => !cerrado(y));
    const tubos = faltan.length ? elegir(L, (c) => cerca(centro(c)[0], 22.82) && tam(c)[2] > 2.5 && tam(c)[1] < 0.07, 3, 'tubos del lado este del rellano') : [];
    for (const t of tubos) {
      const y = centro(t)[1];
      if (!faltan.some((a) => cerca(a, y, 0.02))) continue;
      const z0 = t.mn[2], z1 = t.mx[2], xc = centro(t)[0], k = (X1 - X0) / (z1 - z0);
      // giro de 90° alrededor de Y (el eje del tubo pasa de +Z a +X) y escala a lo largo del eje
      copiar(doc, t, ([a, b, c]) => [X0 + (c - z0) * k, b, Zb - (a - xc)], ([nx, ny, nz]) => [nz, ny, -nx]);
      res.push(`rellano de la rampa: tubo nuevo en z ${f2(Zb)}, x ${f2(X0)} a ${f2(X1)}, a ${f2(y)} m`);
    }
  } else if (grupo === 'sitio') {
    const L = piezas(doc, /Brown painted service access/i);
    // 3. remates de la escalera trasera hacia el muro noroeste
    const remates = elegir(L, (c) => Math.abs(centro(c)[0] + 2.15) < 0.05 && tam(c)[2] > 1 && tam(c)[1] < 0.07 && c.mn[2] > -13 && c.mx[2] < -11, 3, 'remates de la escalera trasera');
    for (const c of remates) {
      if (c.mx[2] >= MURO_NO - 0.01) continue;
      const antes = c.mx[2]; estirar(c, 2, 'max', MURO_NO);
      res.push(`escalera trasera: tubo a ${f2(centro(c)[1])} m de z ${f2(antes)} al muro (z ${f2(MURO_NO)}), ${((MURO_NO - antes) * 100).toFixed(1)} cm más`);
    }
  }
  return res;
}

/** Lista los extremos de los tubos horizontales o inclinados de las barandas y la distancia al primer sólido en su dirección. */
async function medir(io, raiz) {
  const { cargarTriangulos, Rayos } = await import('./verificar-geometria.mjs');
  const malla = await cargarTriangulos(raiz, ['arquitectura', 'sitio', 'entrada', 'detalles', 'ventanas']);
  const RIEL = /guardrail|Brown painted service access/i;
  const rayos = new Rayos(malla, (i) => !RIEL.test(malla.nombres[malla.mat[i]]));
  const filas = [];
  for (const g of ['entrada', 'sitio']) {
    const T = piezas(await io.read(path.join(raiz, 'modelo', g + '.glb')), /guardrail|Brown painted service access|Pale cast concrete/i);
    const L = T.filter((c) => RIEL.test(c.malla));
    // ¿un poste (pieza con vértices a menos de 6 cm en planta, por encima y por debajo del extremo) sostiene el extremo?
    const sostenido = (e, yo) => T.some((s) => s !== yo && tam(s)[1] > 0.4 && [...s.verts].some((v) => Math.hypot(s.P[3 * v] - e[0], s.P[3 * v + 2] - e[2]) < 0.06 && s.P[3 * v + 1] > e[1] - 0.1)
      && [...s.verts].some((v) => Math.hypot(s.P[3 * v] - e[0], s.P[3 * v + 2] - e[2]) < 0.06 && s.P[3 * v + 1] < e[1] - 0.12));
    for (const c of L) {
      const d = tam(c), eje = d[0] > d[2] ? 0 : 2;
      if (Math.max(d[0], d[2]) < 0.6 || Math.min(d[0], d[2]) > 0.07 || d[1] > 1.5) continue;     // solo tubos rectos (no las rejillas)
      for (const lado of ['min', 'max']) {
        const lim = lado === 'min' ? c.mn[eje] : c.mx[eje], V = [...c.verts].filter((v) => Math.abs(c.P[3 * v + eje] - lim) < 0.01);
        const e = [0, 1, 2].map((k) => V.reduce((s, v) => s + c.P[3 * v + k], 0) / V.length);
        const dir = [0, 0, 0]; dir[eje] = lado === 'min' ? -1 : 1;
        const o = e.map((x, k) => x - dir[k] * 0.02), h0 = rayos.lanzar(o, dir, 3.02), h = h0 && { ...h0, t: Math.max(0, h0.t - 0.02) };   // desde 2 cm dentro del tubo
        const poste = sostenido(e, c);
        filas.push(`${g.padEnd(8)} ${c.malla.slice(0, 18).padEnd(18)} extremo (${e.map(f2).join(', ')})  ${h ? (h.t < 0.01 ? 'contra el muro   ' : `muro a ${(h.t * 100).toFixed(1).padStart(6)} cm`) : 'nada a 3 m       '}  ${poste ? 'con poste' : 'SIN POSTE'}`);
      }
    }
  }
  return filas;
}

// uso desde la línea de comandos
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await MeshoptDecoder.ready; await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  if (process.argv.includes('--medir')) { console.log((await medir(io, raiz)).join('\n')); process.exit(0); }
  for (const g of ['entrada', 'sitio']) {
    const archivo = path.join(raiz, 'modelo', g + '.glb'), doc = await io.read(archivo);
    const r = corregirBarandas(doc, g);
    console.log(r.length ? r.join('\n') : `${g}: nada que corregir`);
    // la misma compresión que optimize2.mjs (meshopt «high» = filtros de cuantización sobre los búferes)
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
    if (r.some((x) => !/sin efecto/.test(x))) { await io.write(archivo, doc); console.log('escrito', archivo); }
  }
}
