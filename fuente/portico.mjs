// Pórtico de la entrada principal (fachada sureste) como en la foto WA0014 y los dos acercamientos de Street View del
// usuario: más angosto, BAJO (su cubierta se mete por debajo del alero del edificio), con una banda de madera oscura entre
// la teja y los capiteles (zapatas sobre las columnas, viga, cabios vistos y viga perimetral), la escalera más estrecha
// entre sus muretes y una columna trasera al pie de la escalera, a la izquierda. Trabaja sobre entrada.glb (el GLB web ya
// comprimido, con entrada.mjs aplicado: el de main, o el documento de optimize2.mjs después de barandas.mjs y entrada.mjs).
// Paso reproducible y sin efecto si se repite: si la columna oeste ya está en x 11,25 con el capitel a 2,40 m, no toca nada.
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
// del pórtico quedaba 0,8 m por encima del alero corrido de la planta baja (teja desde 3,87 m en z 13,1; cabios del alero a
// 3,82–3,93 m hasta z 13,06).
//
// Medidas (ver el informe del commit):
//  · Ancho: en el acercamiento 1 el capitel (0,68 m) mide 135 px y entre ejes hay 620 px: 3,1 m entre ejes. En WA0014 la
//    escalera, vista entre las columnas, mide ~0,8 × entre ejes (2,4 m), y la columna trasera está a la izquierda del pie de
//    la escalera, casi en su borde (en el acercamiento 2 se ve entre las dos del frente).
//  · Altura: en los acercamientos la cumbrera y las limas traseras se meten por debajo del alero de teja del edificio y el
//    alero del pórtico queda claramente más bajo que el del edificio. En WA0014, ajustando una cámara a los siete peldaños
//    (0,137 m) y a la losa (residuos < 0,5 px), el capitel sale a 2,5–2,6 m, el alero del pórtico a ~3,0 y la cumbrera bajo
//    ~3,95; las ventanas de la planta baja (antepecho 1,78, dintel 3,41) dan lo mismo: la fila del capitel cae en la mitad de
//    la ventana (~2,65 m en el muro → ~2,5 m en el plano de las columnas). La puerta (dintel a 3,14) queda tapada por la viga
//    del pórtico en la foto, lo que confirma que la viga está más baja que el dintel de la puerta. Se baja la cubierta lo
//    justo para que su cumbrera (3,72 m) pase bajo el alero y los cabios del edificio: 0,98 m.
//  · Banda de madera: en el acercamiento 1, del capitel al borde de la teja hay ~150 px (~0,75 m con el capitel de 0,68 m =
//    135 px): de abajo arriba, zapata sobre cada columna, viga (dintel), cabios vistos cada ~0,8 m y la viga perimetral
//    bajo el alero. Con la cubierta 0,98 m más abajo, la teja pasa sobre las columnas (z 16,40) a ~3,0 m: capitel a 2,40.
//
// Qué hace (sin reexportar nada: mueve y copia piezas del entrada.glb actual, en su cuantización):
//  1. Columnas: a x 11,25 y 14,35 (3,10 m entre ejes, centradas en la puerta, x 12,80) y más bajas: el fuste se acorta por
//     arriba y el capitel baja (capitel 2,20–2,40 m; columna visible de 2,24 m sobre la losa).
//  2. Cubierta de teja y sus limas: 0,98 m más abajo (alero a 2,70, cumbrera a 3,72), mismo ancho (en los acercamientos y en
//     WA0014 la cubierta vuela ~1,15 m más allá de cada columna). La teja baja moviendo el nodo de cada malla de teja (todas
//     son de esta cubierta). El faldón trasero (el triángulo de z 11,30 a 14,00, que bajaba hasta el muro) pasaría ahora por
//     delante del dintel de la puerta y de la ventana de al lado: se sube a los planos de los faldones laterales, como en el
//     acercamiento 2, donde la cumbrera sigue hacia atrás y se mete bajo la teja del edificio (queda debajo de ese alero).
//  3. Maderas (todas copias de la viga del frente, «Dark stained roof timber», cajas biseladas):
//     · viga del frente: x 10,75–14,85 (0,50 m más allá de cada eje: más larga, sus puntas saldrían por los faldones
//       laterales, que ahí bajan), 2,58–2,88 m;
//     · zapatas sobre las dos columnas: 2,40–2,58 m, 1,30 m arriba y 0,70 abajo (extremos en chaflán), z 16,20–16,60;
//     · cabios vistos: cinco, cada 0,80 m (x 11,20 a 14,40), de 8 × 10 cm, paralelos al faldón del frente y justo debajo de
//       la teja, de la viga hasta el alero (z 17,22);
//     · viga perimetral bajo el alero: al frente (x 10,15–15,45, z 16,95–17,13) y a los lados (x 10,18–10,36 y 15,24–15,42,
//       desde el muro), de 20 cm, con la cara superior bajo la teja del alero;
//     · limas: las cuatro de antes, bajadas con la teja.
//  4. Columna trasera: copia de la columna oeste (ya acortada) en x 11,40, z 14,00, sobre la losa, delante del murete oeste
//     y con el fuste al ras del borde de la escalera; con su zapata (girada, a lo largo de Z) y una viga de la misma sección
//     que la del frente de z 13,40 a 16,20, que la une con la viga del frente, a 2,58–2,88 m.
//  5. Escalera: 2,40 m (x 11,60 a 14,00, centrada en la puerta); los siete peldaños se recortan por sus bordes.
//  6. Muretes: el oeste pasa a x 10,00–11,60 y el este a x 14,00–14,90 (siguen a la escalera; la llegada de la rampa, desde
//     x 14,90, y la losa no cambian).
//  7. Pasamanos (x 11,10 y 14,50, de barandas.mjs y entrada.mjs): se corren 0,55 m con los bordes de la escalera, a x 11,65
//     y 13,95. El oeste sigue rematando contra el muro, a la izquierda de la puerta (marco desde x 11,74), y el este en su
//     poste superior (z 11,65). Nada más cambia en ellos.
//
// En el .blend de origen (Isthmus_v016 y sucesores; en Blender y = −Z) hay que hacer lo mismo, además de lo de entrada.mjs:
//  · «Porch square column», «Porch column base», «Porch capital»: x 10,40 → 11,25 y 15,20 → 14,35; fuste de 0,18–3,48 a
//    0,18–2,32 y capitel de 3,36–3,56 a 2,20–2,40.
//  · Cubierta de teja del pórtico y sus limas: 0,98 m más abajo (alero a 2,70, cumbrera a 3,72), mismo ancho. El faldón
//    trasero (entre las limas traseras, y de −14,00 a −11,30) se sustituye por la prolongación de los dos faldones laterales
//    y de la cumbrera hasta el muro, por debajo del alero de la planta baja.
//  · «Porch lintel»: x 10,75–14,85, z 2,58–2,88 (y −16,17 a −16,63).
//  · Maderas nuevas, material «Dark stained roof timber»: zapatas sobre cada columna (z 2,40–2,58, largo 1,30 arriba y 0,70
//    abajo, y −16,20 a −16,60); cinco cabios de 8 × 10 cm en x 11,20, 12,00, 12,80, 13,60 y 14,40, paralelos al faldón del
//    frente bajo la teja, de y −16,30 (los de los extremos) o −15,80 (los tres del centro) hasta y −17,22; viga perimetral de
//    20 cm (z 2,47–2,67): al frente x 10,15–15,45, y −16,95 a −17,13, y a los lados x 10,18–10,36 y 15,24–15,42, de y −11,55
//    a −17,13.
//  · Columna trasera nueva, igual a las del frente: eje en x 11,40, y −14,00, sobre la losa; zapata a lo largo de y; viga
//    de la misma sección que el dintel, en x 11,40, de y −13,40 a y −16,20, a z 2,58–2,88.
//  · «Entrance stair» (siete peldaños): x 11,60 a 14,00 (antes 11,05 a 14,55).
//  · Muretes de la escalera (los de entrada.mjs): oeste x 10,00–11,60, este x 14,00–14,90.
//  · «Porch stair handrail» y «Porch stair rail support»: x 11,10 → 11,65 y 14,50 → 13,95.
// (cl_entrance_fix.py, en claude/Isthmus_claude_hiperrealismo.blend, ya angostaba el pórtico a 3,2 m entre ejes, la
// escalera a 2,2 m, y ponía dos columnas traseras de 0,36 m y dos bancas; pero no lo bajaba. Aquí se sigue la foto y los
// acercamientos: una sola columna trasera, a la izquierda, igual a las del frente, y sin bancas.)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { piezas, aplicar, comprobar, copiar, centro, tam } from './barandas.mjs';

const EJE = 12.80;                               // eje de la puerta y del pórtico
const COL0 = [10.40, 15.20], COL = [11.25, 14.35];  // ejes de las columnas antes / después (3,10 m)
const CAP0 = 3.56, CAP = 2.40;                   // cara superior del capitel antes / después
const BAJA = 0.98;                               // cuánto baja la cubierta (cumbrera de 4,70 a 3,72)
const K = (4.595 - 3.645) / 2.70;                // pendiente de los faldones (de las limas: 0,352)
const ALERO = 3.66 - BAJA;                       // cara inferior de la teja en el borde del alero, después (2,68)
const bajoTeja = (z) => ALERO + (17.30 - z) * K - 0.02;   // bajo la teja del faldón del frente, con 2 cm de holgura
const VIGA = [10.75, 14.85], VIGA_Y = [2.58, 2.88];       // viga del frente, después
const ZAP_Y = [2.40, 2.58], ZAP_ARR = 0.65, ZAP_AB = 0.35;  // zapatas: alto, medio largo arriba y abajo
const CABIOS = [11.20, 12.00, 12.80, 13.60, 14.40];
const PERI_Y = [ALERO - 0.205, ALERO - 0.005];  // viga perimetral
const ESC0 = [11.05, 14.55], ESC = [11.60, 14.00];  // escalera antes / después (2,40 m)
const PAS0 = [11.10, 14.50], PAS = [11.65, 13.95];  // pasamanos antes / después
const TRAS = [11.40, 14.00];                     // eje de la columna trasera (x, z)
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
  const dCap = CAP - CAP0;
  const colMover = (L, dx) => (w, i) => [w[0] + dx, w[1] + (i === 2 || (i === 1 && w[1] > centro(L[1])[1]) ? dCap : 0), w[2]];
  // 4 (las copias salen de las posiciones leídas, antes de mover nada). Columna trasera = copia de la oeste, ya acortada.
  const dxT = TRAS[0] - COL0[0], dzT = TRAS[1] - ZCOL;
  P.cols[0].forEach((c, i) => { const m = colMover(P.cols[0], dxT); copiar(doc, c, (w) => { const r = m(w, i); r[2] += dzT; return r; }); });
  res.push(`columna trasera nueva (copia de la oeste): eje en x ${f2(TRAS[0])}, z ${f2(TRAS[1])}, basa z ${f2(P.cols[0][0].mn[2] + dzT)}–${f2(P.cols[0][0].mx[2] + dzT)}, capitel hasta ${f2(CAP)} m`);

  // 3. maderas nuevas, copias de la viga del frente (antes de moverla)
  const v = P.viga[0];
  // zapatas: extremos en chaflán (1,30 m arriba, 0,70 abajo); la normal de la cara del extremo se inclina hacia abajo
  const nChaf = Math.hypot(ZAP_ARR - ZAP_AB, ZAP_Y[1] - ZAP_Y[0]);
  const girarX = ([nx, ny, nz]) => (Math.abs(nx) > 0.7 ? [Math.sign(nx) * (ZAP_Y[1] - ZAP_Y[0]) / nChaf, -(ZAP_ARR - ZAP_AB) / nChaf, nz] : [nx, ny, nz]);
  for (const x of COL) cajaX(doc, v, (sx, sy) => x + sx * (sy > 0 ? ZAP_ARR : ZAP_AB), ZAP_Y, [16.20, 16.60], girarX);
  res.push(`zapatas sobre las columnas: x ${COL.map((x) => `${f2(x - ZAP_ARR)}–${f2(x + ZAP_ARR)}`).join(' y ')} (abajo ±${f2(ZAP_AB)}), ${f2(ZAP_Y[0])}–${f2(ZAP_Y[1])} m`);
  //    zapata de la columna trasera, a lo largo de Z
  const girarZ = ([nx, ny, nz]) => (Math.abs(nx) > 0.7 ? [nz, -(ZAP_ARR - ZAP_AB) / nChaf, -Math.sign(nx) * (ZAP_Y[1] - ZAP_Y[0]) / nChaf] : [nz, ny, -nx]);
  cajaZ(doc, v, [TRAS[0] - 0.20, TRAS[0] + 0.20], (sz, sy) => TRAS[1] + sz * (sy > 0 ? ZAP_ARR : ZAP_AB), (sy) => ZAP_Y[sy > 0 ? 1 : 0], girarZ);
  //    viga sobre la columna trasera, hasta la del frente
  const medio = tam(v)[2] / 2;
  cajaZ(doc, v, [TRAS[0] - medio, TRAS[0] + medio], (sz) => VIGA_T[sz > 0 ? 1 : 0], (sy) => VIGA_Y[sy > 0 ? 1 : 0]);
  res.push(`viga nueva sobre la columna trasera: x ${f2(TRAS[0] - medio)}–${f2(TRAS[0] + medio)}, z ${f2(VIGA_T[0])}–${f2(VIGA_T[1])}, ${f2(VIGA_Y[0])}–${f2(VIGA_Y[1])} m, con su zapata`);
  //    cabios: paralelos al faldón del frente, de la viga al alero; los de los extremos empiezan donde el faldón del frente
  //    todavía está por encima de los laterales (limas a 45°)
  for (const x of CABIOS) {
    const z0 = Math.max(15.80, 27.40 - (x - 0.04) + 0.06, (x + 0.04) + 1.80 + 0.06);
    cajaZ(doc, v, [x - 0.04, x + 0.04], (sz) => (sz > 0 ? 17.22 : z0), (sy, Z) => bajoTeja(Z) - (sy > 0 ? 0 : 0.10));
    res.push(`cabio en x ${f2(x)}: z ${f2(z0)}–17.22, 8 × 10 cm, bajo la teja (${f2(bajoTeja(z0))} → ${f2(bajoTeja(17.22))} m)`);
  }
  //    viga perimetral bajo el alero: frente y lados (los lados desde el muro)
  cajaX(doc, v, (sx) => (sx > 0 ? 15.45 : 10.15), PERI_Y, [16.95, 17.13]);
  for (const x of [[10.18, 10.36], [15.24, 15.42]]) cajaZ(doc, v, x, (sz) => (sz > 0 ? 17.13 : 11.55), (sy) => PERI_Y[sy > 0 ? 1 : 0]);
  res.push(`viga perimetral bajo el alero: frente x 10.15–15.45, z 16.95–17.13; lados x 10.18–10.36 y 15.24–15.42, z 11.55–17.13; ${f2(PERI_Y[0])}–${f2(PERI_Y[1])} m`);

  // 1. columnas
  P.cols.forEach((L, k) => L.forEach((c, i) => moverPieza(c, (w) => colMover(L, COL[k] - COL0[k])(w, i))));
  res.push(`columnas: de x ${COL0.map(f2).join(' y ')} (${f2(COL0[1] - COL0[0])} m entre ejes) a x ${COL.map(f2).join(' y ')} (${f2(COL[1] - COL[0])} m); capitel de ${f2(CAP0)} a ${f2(CAP)} m (columna visible sobre la losa: ${f2(CAP - 0.16)} m)`);

  // 3. viga del frente
  moverPieza(v, bordes(v, [[VIGA[0] - v.mn[0], VIGA[1] - v.mx[0]], [VIGA_Y[0] - v.mn[1], VIGA_Y[1] - v.mx[1]], [0, 0]]));
  res.push(`viga del frente: de x ${f2(v.mn[0])}–${f2(v.mx[0])} a x ${f2(VIGA[0])}–${f2(VIGA[1])}, de ${f2(v.mn[1])}–${f2(v.mx[1])} a ${f2(VIGA_Y[0])}–${f2(VIGA_Y[1])} m`);

  // 2. cubierta: el faldón trasero sube a los planos de los laterales (por vértice, en las coordenadas de antes) y todo
  //    baja: las limas por vértices, la teja por nodo
  const trasero = ([x, y, z]) => { const d = (Math.min(x - 10.10, 15.50 - x) - (z - 11.30)) * K; return [x, y + Math.max(0, d), z]; };
  let nTras = 0;
  for (const c of T) if (centro(c)[2] < 14.0 && [...c.verts].some((i) => trasero([c.P[3 * i], 0, c.P[3 * i + 2]])[1] > 0.005)) { moverPieza(c, trasero); nTras++; }
  moverPieza(P.limas[0], ([x, y, z]) => { const w = trasero([x, y, z]); return [w[0], w[1] - BAJA, w[2]]; });
  for (const n of tejas) { const t = n.getTranslation(); n.setTranslation([t[0], t[1] - BAJA, t[2]]); }
  res.push(`cubierta de teja (${tejas.length} mallas) y sus limas: ${f2(BAJA)} m más abajo (alero a ${f2(3.68 - BAJA)}, cumbrera a ${f2(4.70 - BAJA)} m), mismo ancho (x 10,10 a 15,50); faldón trasero (${nTras} tejas) subido a los planos de los laterales, bajo el alero del edificio`);

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
