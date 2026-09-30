// Pórtico de la entrada principal (fachada sureste) como en la foto WA0014 y los dos acercamientos de Street View del
// usuario: angosto y esbelto, BAJO (su cubierta se mete por debajo del alero del edificio), con una banda de madera oscura entre
// la teja y los capiteles (zapatas sobre las columnas, viga, cabios vistos y viga perimetral), la escalera más estrecha
// entre sus muretes y una columna trasera al pie de la escalera, a la izquierda. Trabaja sobre entrada.glb (el GLB web ya
// comprimido, con entrada.mjs aplicado: el de main, o el documento de optimize2.mjs después de barandas.mjs y entrada.mjs).
// Paso reproducible y sin efecto si se repite: si la columna oeste ya está en x 11,70 con el capitel a 2,40 m, no toca nada
// (y si recibe una versión anterior de este paso, con las columnas en x 11,25, se niega: hay que partir del de main).
//
//   cd fuente && node portico.mjs          corrige ../modelo/entrada.glb en su lugar (y luego: node intro.mjs)
//   node portico.mjs --medir               solo describe columnas, maderas, cubierta, escalera, muretes y pasamanos
//
// Coordenadas de la escena en metros (+X = noreste, +Z = sureste, Y arriba; en Blender: x = X, y = −Z, z = Y). Muro sureste
// en z 11,50; losa de la entrada (entrada.mjs) con la cara superior a 0,16 m.
//
// Qué había (exportación de Isthmus_v016): dos columnas (basa, fuste y capitel, «Fresh cream trim») en x 10,40 y 15,20
// (4,80 m entre ejes), z 16,40, de 0 a 3,56 m; viga («Dark stained roof timber») de x 10,00 a 15,60 a 3,40–3,70 m; la
// cubierta de teja a cuatro aguas (x 10,10 a 15,50, z 11,30 a 17,30, alero a 3,68 m, cumbrera a 4,70; pendiente 0,352) con
// sus cuatro limas (48 triángulos de la misma madera); escalera de 3,50 m (x 11,05 a 14,55) entre muretes. Así la cumbrera
// del pórtico quedaba 0,8 m por encima d// Medidas (ver el informe del commit). Las referencias fiables son del propio edificio del modelo: los peldaños (0,137 m),
// las ventanas de la planta baja y el alero corrido. En WA0014, ajustando una cámara a los siete peldaños y a la losa
// (residuos < 0,5 px):
//  · Altura: capitel a 2,5–2,6 m, alero del pórtico a ~3,0, cumbrera bajo ~3,95; las ventanas de la planta baja (antepecho
//    1,78, dintel 3,41) dan lo mismo, y la viga del pórtico tapa el dintel de la puerta (3,14). En los acercamientos de
//    Street View la cumbrera y las limas traseras se meten por debajo del alero de teja del edificio. Se baja la cubierta lo
//    justo para que su cumbrera (3,72 m) pase bajo la teja (3,87) y los cabios (3,82) de ese alero: 0,98 m. Banda de madera
//    de ~0,75 m (acercamiento 1: zapata, viga, cabios y viga perimetral): capitel a 2,40 m, 2,24 m sobre la losa.
//  · Ancho: con esa cámara, entre ejes 2,10–2,16 m (173 px en el plano de las columnas, a ~81 px/m); la proporción de la
//    foto, entre ejes = 0,84 × la columna visible, da 1,9–2,1 m. Se toma 2,20 m. (El 3,1 m de la versión anterior salía de
//    suponer que el capitel real mide 0,68 m como el del modelo; con 2,20 m el capitel sale de ~0,47 m.)
//  · Sección de las columnas, en proporción a la foto (× entre ejes): basa 0,237 (0,52 m), fuste 0,173 (0,38), capitel
//    0,214 (0,47); la basa, alta como en la foto (~24 % de la columna visible), hasta 0,62 m; el capitel, 2,14–2,40.
//  · Cubierta: su alero de frente mide ~1,75 × entre ejes: 3,85 m (antes 5,40). Se angosta en X alrededor de la puerta; el
//    fondo (z 11,30 a 17,30, 0,9 m de vuelo delante de las columnas) no cambia, así que los faldones laterales quedan más
//    empinados (0,494) que el del frente (0,352).
//  · Escalera: en la foto, vista entre las columnas, ~0,8 × entre ejes (se vería de 1,8 m); pero la puerta del modelo mide
//    2,12 m con su marco (ventanas.glb, que no se toca) y el pasamanos oeste tiene que rematar en el muro, a la izquierda
//    del marco (x 11,74): 2,30 m (x 11,65 a 13,95), que desde el punto de la foto se ve entre los fustes (queda 2,8 m
//    detrás de las columnas). La columna trasera está a la izquierda del pie de la escalera, con el fuste al ras de su
//    borde (en el acercamiento 2 se ve entre las dos del frente).
//
// Qué hace (sin reexportar nada: mueve y copia piezas del entrada.glb actual, en su cuantización):
//  1. Columnas: a x 11,70 y 13,90 (2,20 m entre ejes, centradas en la puerta, x 12,80), más esbeltas y más bajas: basa
//     0,52 × 0,52 hasta 0,62 m, fuste 0,38 × 0,38 hasta 2,32, capitel 0,47 × 0,47 de 2,14 a 2,40 (columna visible de 2,24 m).
//  2. Cubierta de teja y sus limas: angostada de 5,40 a 3,85 m (x 10,875 a 14,725) y 0,98 m más abajo (alero a 2,70,
//     cumbrera a 3,72). La teja baja moviendo el nodo de cada malla de teja (todas son de esta cubierta) y se angosta por
//     vértices. El faldón trasero (el triángulo de z 11,30 a 14,00, que bajaba hasta el muro) pasaría por delante del dintel
//     de la puerta: se sube a los planos de los faldones laterales, como en el acercamiento 2, donde la cumbrera sigue hacia
//     atrás y se mete bajo la teja del edificio.
//  3. Maderas (todas copias de la viga del frente, «Dark stained roof timber», cajas biseladas):
//     · viga del frente: x 11,35–14,25 (más larga, sus puntas saldrían por los faldones laterales), 2,58–2,88 m;
//     · zapatas sobre las dos columnas: 2,40–2,58 m, 1,00 m arriba y 0,50 abajo (extremos en chaflán), z 16,20–16,60;
//     · cabios vistos: cinco, cada 0,60 m (x 11,60 a 14,00), de 8 × 10 cm, paralelos al faldón del frente y justo debajo
//       de la teja, de la viga hasta el alero (z 17,22);
//     · viga perimetral bajo el alero: al frente (x 10,925–14,675, z 16,95–17,13) y a los lados (x 10,955–11,135 y
//       14,465–14,645, desde el muro), de 20 cm, con la cara superior bajo la teja del alero;
//     · limas: las cuatro de antes, con la teja.
//  4. Columna trasera: copia de la oeste (ya rehecha) en x 11,46, z 14,00, sobre la losa, delante del murete oeste y con el
//     fuste al ras del borde de la escalera; con su zapata (a lo largo de Z) y una viga de 24 cm de ancho (más ancha, su
//     arista saldría por el faldón lateral) de z 13,40 a 16,20, que la une con la viga del frente, a 2,58–2,88 m.
//  5. Escalera: 2,30 m (x 11,65 a 13,95, centrada en la puerta); los siete peldaños se recortan por sus bordes.
//  6. Muretes: el oeste pasa a x 10,00–11,65 y el este a x 13,95–14,90 (la llegada de la rampa, desde x 14,90, y la losa no
//     cambian).
//  7. Pasamanos (x 11,10 y 14,50, de barandas.mjs y entrada.mjs): a x 11,70 y 13,90, 5 cm dentro de los bordes de la
//     escalera. El oeste sigue rematando contra el muro, a la izquierda de la puerta (marco desde x 11,74), y el este en
//     su poste superior (z 11,65). Nada más cambia en ellos.
//
// En el .blend de origen (Isthmus_v016 y sucesores; en Blender y = −Z) hay que hacer lo mismo, además de lo de entrada.mjs:
//  · «Porch square column», «Porch column base», «Porch capital»: ejes de x 10,40 y 15,20 a x 11,70 y 13,90 (y −16,40);
//    basa 0,52 × 0,52, z 0 a 0,62; fuste 0,38 × 0,38, z 0,18 a 2,32; capitel 0,47 × 0,47, z 2,14 a 2,40.
//  · Cubierta de teja del pórtico y sus limas: angostarla a x 10,875–14,725 (mismo fondo, y −11,30 a −17,30) y bajarla
//    0,98 m (alero a 2,70, cumbrera a 3,72). El faldón trasero (entre las limas traseras, de y −14,00 a −11,30) se
//    sustituye por la prolongación de los dos faldones laterales y de la cumbrera hasta el muro, bajo el alero de la planta
//    baja.
//  · «Porch lintel»: x 11,35–14,25, z 2,58–2,88 (y −16,17 a −16,63).
//  · Maderas nuevas, material «Dark stained roof timber»: zapatas sobre cada columna (z 2,40–2,58, largo 1,00 arriba y
//    0,50 abajo, y −16,20 a −16,60); cinco cabios de 8 × 10 cm en x 11,60, 12,20, 12,80, 13,40 y 14,00, paralelos al
//    faldón del frente bajo la teja, de y −16,40 (los de los extremos) o −15,80 (los tres del centro) hasta y −17,22; viga
//    perimetral de 20 cm (z 2,48–2,68): al frente x 10,925–14,675, y −16,95 a −17,13, y a los lados x 10,955–11,135 y
//    14,465–14,645, de y −11,55 a −17,13.
//  · Columna trasera nueva, igual a las del frente: eje en x 11,46, y −14,00, sobre la losa; zapata a lo largo de y; viga
//    de 24 cm de ancho y 30 de alto, en x 11,46, de y −13,40 a y −16,20, a z 2,58–2,88.
//  · «Entrance stair» (siete peldaños): x 11,65 a 13,95 (antes 11,05 a 14,55).
//  · Muretes de la escalera (los de entrada.mjs): oeste x 10,00–11,65, este x 13,95–14,90.
//  · «Porch stair handrail» y «Porch stair rail support»: x 11,10 → 11,70 y 14,50 → 13,90.
// (cl_entrance_fix.py, en claude/Isthmus_claude_hiperrealismo.blend, angostaba el pórtico a 3,2 m entre ejes, la escalera
// a 2,2 m, y ponía dos columnas traseras de 0,36 m y dos bancas; pero no lo bajaba ni angostaba la cubierta. Aquí se sigue
// la foto y los acercamientos: una sola columna trasera, a la izquierda, igual a las del frente, y sin bancas.)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { piezas, aplicar, comprobar, copiar, centro, tam } from './barandas.mjs';

const EJE = 12.80;                               // eje de la puerta y del pórtico
const COL0 = [10.40, 15.20], COL = [11.70, 13.90];  // ejes de las columnas antes / después (2,20 m)
const COL_PREVIA = [11.25, 14.35];               // ejes de una versión anterior de este paso (3,10 m)
// sección de las columnas después (medio ancho de basa, fuste y capitel, como en la foto: 0,237 / 0,173 / 0,214 × entre
// ejes) y alturas (basa hasta 0,62; fuste hasta 2,32; capitel 2,14–2,40)
const MEDIO = [0.26, 0.19, 0.235], BASA_Y = 0.62, FUSTE_Y = 2.32, CAP_Y = [2.14, 2.40];
const CAP0 = 3.56, CAP = 2.40;                   // cara superior del capitel antes / después
const BAJA = 0.98;                               // cuánto baja la cubierta (cumbrera de 4,70 a 3,72)
const K = (4.595 - 3.645) / 2.70;                // pendiente de los faldones (de las limas: 0,352)
const ALERO = 3.66 - BAJA;                       // cara inferior de la teja en el borde del alero, después (2,68)
const bajoTeja = (z) => ALERO + (17.30 - z) * K - 0.02;   // bajo la teja del faldón del frente, con 2 cm de holgura
const S = 3.85 / 5.40, XE = [EJE - 1.925, EJE + 1.925];  // la cubierta se angosta de 5,40 a 3,85 m (1,75 × entre ejes)
const KL = K / S;                                // pendiente de los faldones laterales, después (0,494)
const VIGA = [11.35, 14.25], VIGA_Y = [2.58, 2.88];       // viga del frente, después
const ZAP_Y = [2.40, 2.58], ZAP_ARR = 0.50, ZAP_AB = 0.25;  // zapatas: alto, medio largo arriba y abajo
const CABIOS = [11.60, 12.20, 12.80, 13.40, 14.00];
const PERI_Y = [ALERO - 0.205, ALERO - 0.005];  // viga perimetral
const ESC0 = [11.05, 14.55], ESC = [11.65, 13.95];  // escalera antes / después (2,30 m)
const PAS0 = [11.10, 14.50], PAS = [11.70, 13.90];  // pasamanos antes / después
const TRAS = [11.46, 14.00];                     // eje de la columna trasera (x, z): fuste al ras del borde de la escalera
const VIGA_T = [13.40, 16.20];                   // viga sobre la columna trasera (z)
const ZCOL = 16.40;
const cerca = (a, b, tol = 0.05) => Math.abs(a - b) < tol;
const f2 = (x) => x.toFixed(2);

/** Pone cada vértice de la pieza (en coordenadas del mundo, tal como estaba al leerla) en `mover(v)`. */
function moverPieza(c, mover) {
  const A = c.p.getAttribute('POSITION');
  for (const v of c.verts) A.setElement(v, comprobar(aplicar(c.W1, mover([c.P[3 * v], c.P[3 * v + 1], c.P[3 * v + 2]])), c));
}
/** Mueve los «bordes» de una caja biselada según a qué lado del centro está cada vértice (el bisel no se deforma). */
const bordes = (c, d) => (w) => w.map((x, k) => x + (x < centro(c)[k] ? d[k][0] : d[k][1]));
/** Descompone un vértice de una caja biselada: lado (±1) y desplazamiento desde esa cara (el bisel) en cada eje. */
const lados = (c, w) => w.map((x, k) => { const s = x > centro(c)[k] ? 1 : -1; return [s, x - (s > 0 ? c.mx[k] : c.mn[k])]; });

/** Copia de la viga `v` como caja a lo largo de X: `fx(sx, sy)` da la cara en X según el lado en X y en Y (chaflanes). */
function cajaX(doc, v, fx, y, z, girar) {
  copiar(doc, v, (w) => { const [[sx, ox], [sy, oy], [sz, oz]] = lados(v, w); return [fx(sx, sy) + ox, y[sy > 0 ? 1 : 0] + oy, z[sz > 0 ? 1 : 0] + oz]; }, girar);
}
/** Copia de la viga `v` girada 90° alrededor de Y (su largo pasa de X a Z): `x` = [x0, x1], `fz(sz, sy)` la cara en Z,
 *  `fy(sy, z)` la cara en Y (puede depender de z: cabios paralelos al faldón). */
function cajaZ(doc, v, x, fz, fy, girar = ([nx, ny, nz]) => [nz, ny, -nx]) {
  copiar(doc, v, (w) => {
    const [[sx, ox], [sy, oy], [sz, oz]] = lados(v, w);
    const Z = fz(-sx, sy) - ox;                       // el giro lleva +X a −Z
    return [x[sz > 0 ? 1 : 0] + oz, fy(sy, Z) + oy, Z];
  }, girar);
}

/** Las piezas del pórtico y la escalera, en el estado `cols` (ejes de las columnas) y `esc` (bordes de la escalera). */
function buscar(doc, cols, esc, pas) {
  const trim = piezas(doc, /^Fresh cream trim$/);
  const columna = (x) => trim.filter((c) => cerca(centro(c)[0], x) && cerca(centro(c)[2], ZCOL) && tam(c)[0] < 0.8 && tam(c)[2] < 0.8)
    .sort((a, b) => a.mn[1] - b.mn[1]);                                   // basa, fuste, capitel (por altura)
  const madera = piezas(doc, /^Dark stained roof timber$/);
  return {
    cols: cols.map(columna),
    viga: madera.filter((c) => cerca(centro(c)[2], ZCOL, 0.1) && tam(c)[0] > 4 && tam(c)[1] < 0.4 && tam(c)[2] < 0.6),
    limas: madera.filter((c) => cerca(c.mn[0], 10.10) && cerca(c.mx[0], 15.50) && cerca(c.mn[2], 11.30) && cerca(c.mx[2], 17.30)),
    peldanos: piezas(doc, /^Pale cast concrete — entrance$/).filter((c) => cerca(c.mn[0], esc[0]) && cerca(c.mx[0], esc[1]) && tam(c)[2] < 0.45 && tam(c)[1] > 0.1),
    muretes: piezas(doc, /Warm lime-painted plaster/).filter((c) => cerca(c.mx[1], 1.12) && c.mx[2] < 13.7 && cerca(c.mn[2], 11.50)),
    pasamanos: piezas(doc, /guardrail/i).filter((c) => pas.some((x) => cerca(centro(c)[0], x)) && c.mn[2] > 11.4 && c.mx[2] < 14),
  };
}

/** Corrige el documento de entrada.glb en su lugar. Devuelve un resumen de lo hecho. */
export function corregirPortico(doc) {
  if (buscar(doc, COL_PREVIA, [11.60, 14.00], [11.65, 13.95]).cols[0].length === 3)
    throw new Error('portico.mjs: columnas en x 11,25 y 14,35: es una versión anterior de este paso; parte del entrada.glb de main');
  const hecho = buscar(doc, COL, ESC, PAS);
  if (hecho.cols[0].length === 3 && hecho.cols[1].length === 3) {
    const cap = hecho.cols[0][2].mx[1];
    if (!cerca(cap, CAP, 0.02)) throw new Error(`portico.mjs: columnas ya en x ${COL.join(' y ')} pero con el capitel a ${f2(cap)} m (se esperaba ${CAP}); es una versión anterior de este paso: parte del entrada.glb de main`);
    if (hecho.peldanos.length !== 7) throw new Error(`portico.mjs: columnas ya en x ${COL.join(' y ')} pero hay ${hecho.peldanos.length} peldaños de x ${ESC.join(' a ')}`);
    return ['pórtico: las columnas ya están en x ' + COL.map(f2).join(' y ') + ' con el capitel a ' + f2(CAP) + ' m; nada que corregir'];
  }
  const P = buscar(doc, COL0, ESC0, PAS0), res = [];
  const exigir = (L, n, que) => { if (L.length !== n) throw new Error(`portico.mjs: se esperaban ${n} ${que} y hay ${L.length}; el modelo cambió`); };
  exigir(P.cols[0], 3, 'piezas en la columna oeste (x 10,40)'); exigir(P.cols[1], 3, 'piezas en la columna este (x 15,20)');
  exigir(P.viga, 1, 'vigas del frente (x 10,00 a 15,60)'); exigir(P.limas, 1, 'juegos de limas de la cubierta');
  exigir(P.peldanos, 7, 'peldaños de x 11,05 a 14,55 (¿falta entrada.mjs?)'); exigir(P.muretes, 2, 'muretes de la escalera (¿falta entrada.mjs?)');
  if (!cerca(P.cols[0][2].mx[1], CAP0, 0.02)) throw new Error(`portico.mjs: el capitel está a ${f2(P.cols[0][2].mx[1])} m (se esperaba ${CAP0})`);
  exigir(P.pasamanos.filter((c) => tam(c)[2] > 1), 2, 'pasamanos inclinados en x 11,10 y 14,50');
  const tejas = doc.getRoot().listNodes().filter((n) => /Clay terracotta/.test(n.getMesh()?.getName() ?? ''));
  const T = piezas(doc, /Clay terracotta/);
  for (const c of T) if (c.mn[0] < 10.05 || c.mx[0] > 15.55 || c.mn[2] < 11.25 || c.mx[2] > 17.35 || c.mn[1] < 3.6)
    throw new Error(`portico.mjs: hay teja fuera de la cubierta del pórtico (x ${f2(c.mn[0])}–${f2(c.mx[0])}, z ${f2(c.mn[2])}–${f2(c.mx[2])})`);

  // columnas: se corren al eje nuevo; el fuste se acorta por arriba y el capitel baja
  //    (cada pieza es una caja biselada: se rehace por sus caras, con el bisel intacto)
  const colMover = (L, cx, cz) => (w, i) => {
    const [[sx, ox], [sy, oy], [sz, oz]] = lados(L[i], w);
    const y = i === 0 ? (sy > 0 ? BASA_Y + oy : w[1]) : i === 1 ? (sy > 0 ? FUSTE_Y + oy : w[1]) : CAP_Y[sy > 0 ? 1 : 0] + oy;
    return [cx + sx * MEDIO[i] + ox, y, cz + sz * MEDIO[i] + oz];
  };
  // 4 (las copias salen de las posiciones leídas, antes de mover nada). Columna trasera = copia de la oeste, ya acortada.
  P.cols[0].forEach((c, i) => copiar(doc, c, (w) => colMover(P.cols[0], TRAS[0], TRAS[1])(w, i)));
  res.push(`columna trasera nueva (copia de la oeste): eje en x ${f2(TRAS[0])}, z ${f2(TRAS[1])}, basa x ${f2(TRAS[0] - MEDIO[0])}–${f2(TRAS[0] + MEDIO[0])}, z ${f2(TRAS[1] - MEDIO[0])}–${f2(TRAS[1] + MEDIO[0])}, capitel hasta ${f2(CAP)} m`);

  // 3. maderas nuevas, copias de la viga del frente (antes de moverla)
  const v = P.viga[0];
  // zapatas: extremos en chaflán (1,30 m arriba, 0,70 abajo); la normal de la cara del extremo se inclina hacia abajo
  const nChaf = Math.hypot(ZAP_ARR - ZAP_AB, ZAP_Y[1] - ZAP_Y[0]);
  const girarX = ([nx, ny, nz]) => (Math.abs(nx) > 0.7 ? [Math.sign(nx) * (ZAP_Y[1] - ZAP_Y[0]) / nChaf, -(ZAP_ARR - ZAP_AB) / nChaf, nz] : [nx, ny, nz]);
  for (const x of COL) cajaX(doc, v, (sx, sy) => x + sx * (sy > 0 ? ZAP_ARR : ZAP_AB), ZAP_Y, [16.20, 16.60], girarX);
  res.push(`zapatas sobre las columnas: x ${COL.map((x) => `${f2(x - ZAP_ARR)}–${f2(x + ZAP_ARR)}`).join(' y ')} (abajo ±${f2(ZAP_AB)}), ${f2(ZAP_Y[0])}–${f2(ZAP_Y[1])} m`);
  //    zapata de la columna trasera, a lo largo de Z
  const girarZ = ([nx, ny, nz]) => (Math.abs(nx) > 0.7 ? [nz, -(ZAP_ARR - ZAP_AB) / nChaf, -Math.sign(nx) * (ZAP_Y[1] - ZAP_Y[0]) / nChaf] : [nz, ny, -nx]);
  cajaZ(doc, v, [TRAS[0] - 0.12, TRAS[0] + 0.12], (sz, sy) => TRAS[1] + sz * (sy > 0 ? ZAP_ARR : ZAP_AB), (sy) => ZAP_Y[sy > 0 ? 1 : 0], girarZ);
  //    viga sobre la columna trasera, hasta la del frente
  const medio = 0.12;                               // 24 cm: más ancha, su arista saldría por el faldón lateral
  cajaZ(doc, v, [TRAS[0] - medio, TRAS[0] + medio], (sz) => VIGA_T[sz > 0 ? 1 : 0], (sy) => VIGA_Y[sy > 0 ? 1 : 0]);
  res.push(`viga nueva sobre la columna trasera: x ${f2(TRAS[0] - medio)}–${f2(TRAS[0] + medio)}, z ${f2(VIGA_T[0])}–${f2(VIGA_T[1])}, ${f2(VIGA_Y[0])}–${f2(VIGA_Y[1])} m, con su zapata`);
  //    cabios: paralelos al faldón del frente, de la viga al alero; los de los extremos empiezan donde el faldón del frente
  //    todavía está por encima de los laterales (limas a 45°)
  for (const x of CABIOS) {
    const z0 = Math.max(15.80, 17.30 - ((x - 0.04) - XE[0]) / S + 0.06, 17.30 - (XE[1] - (x + 0.04)) / S + 0.06);
    cajaZ(doc, v, [x - 0.04, x + 0.04], (sz) => (sz > 0 ? 17.22 : z0), (sy, Z) => bajoTeja(Z) - (sy > 0 ? 0 : 0.10));
    res.push(`cabio en x ${f2(x)}: z ${f2(z0)}–17.22, 8 × 10 cm, bajo la teja (${f2(bajoTeja(z0))} → ${f2(bajoTeja(17.22))} m)`);
  }
  //    viga perimetral bajo el alero: frente y lados (los lados desde el muro)
  const PF = [XE[0] + 0.05, XE[1] - 0.05], PL = [[XE[0] + 0.08, XE[0] + 0.26], [XE[1] - 0.26, XE[1] - 0.08]];
  cajaX(doc, v, (sx) => PF[sx > 0 ? 1 : 0], PERI_Y, [16.95, 17.13]);
  for (const x of PL) cajaZ(doc, v, x, (sz) => (sz > 0 ? 17.13 : 11.55), (sy) => PERI_Y[sy > 0 ? 1 : 0]);
  res.push(`viga perimetral bajo el alero: frente x ${PF.map(f2).join('–')}, z 16.95–17.13; lados x ${PL.map((a) => a.map(f2).join('–')).join(' y ')}, z 11.55–17.13; ${f2(PERI_Y[0])}–${f2(PERI_Y[1])} m`);

  // 1. columnas
  P.cols.forEach((L, k) => L.forEach((c, i) => moverPieza(c, (w) => colMover(L, COL[k], ZCOL)(w, i))));
  res.push(`columnas: de x ${COL0.map(f2).join(' y ')} (${f2(COL0[1] - COL0[0])} m entre ejes) a x ${COL.map(f2).join(' y ')} (${f2(COL[1] - COL[0])} m); capitel de ${f2(CAP0)} a ${f2(CAP)} m (columna visible sobre la losa: ${f2(CAP - 0.16)} m); sección: basa ${f2(2 * MEDIO[0])} (hasta ${f2(BASA_Y)} m), fuste ${f2(2 * MEDIO[1])}, capitel ${f2(2 * MEDIO[2])} (${CAP_Y.map(f2).join('–')} m)`);

  // 3. viga del frente
  moverPieza(v, bordes(v, [[VIGA[0] - v.mn[0], VIGA[1] - v.mx[0]], [VIGA_Y[0] - v.mn[1], VIGA_Y[1] - v.mx[1]], [0, 0]]));
  res.push(`viga del frente: de x ${f2(v.mn[0])}–${f2(v.mx[0])} a x ${f2(VIGA[0])}–${f2(VIGA[1])}, de ${f2(v.mn[1])}–${f2(v.mx[1])} a ${f2(VIGA_Y[0])}–${f2(VIGA_Y[1])} m`);

  // 2. cubierta: el faldón trasero sube a los planos de los laterales (por vértice, en las coordenadas de antes) y todo
  //    baja: las limas por vértices, la teja por nodo
  const trasero = ([x, y, z]) => { const d = (Math.min(x - 10.10, 15.50 - x) - (z - 11.30)) * K; return [x, y + Math.max(0, d), z]; };
  const angosta = (w) => { const [x, y, z] = trasero(w); return [EJE + (x - EJE) * S, y, z]; };
  let nTras = 0;
  for (const c of T) { if (centro(c)[2] < 14.0 && [...c.verts].some((i) => trasero([c.P[3 * i], 0, c.P[3 * i + 2]])[1] > 0.005)) nTras++; moverPieza(c, angosta); }
  moverPieza(P.limas[0], (w) => { const r = angosta(w); return [r[0], r[1] - BAJA, r[2]]; });
  for (const n of tejas) { const t = n.getTranslation(); n.setTranslation([t[0], t[1] - BAJA, t[2]]); }
  res.push(`cubierta de teja (${tejas.length} mallas) y sus limas: ${f2(BAJA)} m más abajo (alero a ${f2(3.68 - BAJA)}, cumbrera a ${f2(4.70 - BAJA)} m) y angostada de 5,40 a ${f2(XE[1] - XE[0])} m (x ${XE.map(f2).join(' a ')}; faldones laterales con pendiente ${KL.toFixed(3)}, el del frente ${K.toFixed(3)}); faldón trasero (${nTras} tejas) subido a los planos de los laterales, bajo el alero del edificio`);

  // 5. peldaños
  for (const c of P.peldanos) moverPieza(c, bordes(c, [[ESC[0] - ESC0[0], ESC[1] - ESC0[1]], [0, 0], [0, 0]]));
  res.push(`escalera: de x ${ESC0.map(f2).join(' a ')} (${f2(ESC0[1] - ESC0[0])} m) a x ${ESC.map(f2).join(' a ')} (${f2(ESC[1] - ESC[0])} m), 7 peldaños`);

  // 6. muretes
  for (const c of P.muretes) {
    const oeste = centro(c)[0] < EJE;
    moverPieza(c, bordes(c, [oeste ? [0, ESC[0] - c.mx[0]] : [ESC[1] - c.mn[0], 0], [0, 0], [0, 0]]));
    res.push(`murete ${oeste ? 'oeste' : 'este'}: de x ${f2(c.mn[0])}–${f2(c.mx[0])} a x ${f2(oeste ? c.mn[0] : ESC[1])}–${f2(oeste ? ESC[0] : c.mx[0])}`);
  }

  // 7. pasamanos
  for (const c of P.pasamanos) {
    const k = cerca(centro(c)[0], PAS0[0]) ? 0 : 1, dx = PAS[k] - PAS0[k];
    moverPieza(c, ([x, y, z]) => [x + dx, y, z]);
  }
  res.push(`pasamanos: ${P.pasamanos.length} piezas (tubos y postes) de x ${PAS0.map(f2).join(' y ')} a x ${PAS.map(f2).join(' y ')}; el oeste sigue contra el muro, el este en su poste superior`);
  return res;
}

/** Describe el pórtico (para el informe y para comprobar). */
function medir(doc) {
  const L = [];
  const dsc = (c) => `x ${f2(c.mn[0])}–${f2(c.mx[0])}  y ${f2(c.mn[1])}–${f2(c.mx[1])}  z ${f2(c.mn[2])}–${f2(c.mx[2])}`;
  const zona = (c) => c.mx[0] > 9.8 && c.mn[0] < 15.7 && c.mx[2] > 11.3 && c.mn[2] < 17.4;
  for (const c of piezas(doc, /^Fresh cream trim$|^Dark stained roof timber$/).filter((c) => zona(c) && c.mn[2] > 11.25)) L.push(`${c.malla.padEnd(34)} ${dsc(c)}`);
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const c of piezas(doc, /Clay terracotta/)) { mn = mn.map((x, k) => Math.min(x, c.mn[k])); mx = mx.map((x, k) => Math.max(x, c.mx[k])); }
  L.push(`${'teja del pórtico (todas)'.padEnd(34)} ${dsc({ mn, mx })}`);
  for (const c of piezas(doc, /^Pale cast concrete — entrance( slab)?$/).filter((c) => zona(c) && c.mn[0] < 14.6)) L.push(`${c.malla.padEnd(34)} ${dsc(c)}`);
  for (const c of piezas(doc, /Warm lime-painted plaster/)) L.push(`${c.malla.padEnd(34)} ${dsc(c)}`);
  for (const c of piezas(doc, /guardrail/i).filter((c) => [...PAS0, ...PAS].some((x) => cerca(centro(c)[0], x)) && c.mn[2] > 11.4)) L.push(`${c.malla.padEnd(34)} ${dsc(c)}`);
  return L;
}

// uso desde la línea de comandos
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await MeshoptDecoder.ready; await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const archivo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'modelo', 'entrada.glb');
  const doc = await io.read(archivo);
  if (process.argv.includes('--medir')) { console.log(medir(doc).join('\n')); process.exit(0); }
  const r = corregirPortico(doc);
  console.log(r.join('\n'));
  // la misma compresión que optimize2.mjs (meshopt «high» = filtros de cuantización sobre los búferes)
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  if (!/nada que corregir/.test(r[0])) { await io.write(archivo, doc); console.log('escrito', archivo); }
}
