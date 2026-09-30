// Pórtico de la entrada principal (fachada sureste) como en la foto WA0014: más angosto y algo más alto, con la escalera
// más estrecha entre sus muretes y una columna trasera al pie de la escalera, a la izquierda. Trabaja sobre entrada.glb
// (el GLB web ya comprimido, o el documento de optimize2.mjs después de barandas.mjs y entrada.mjs). Paso reproducible y
// sin efecto si se repite: si la columna oeste ya está en x 11,25, no toca nada.
//
//   cd fuente && node portico.mjs          corrige ../modelo/entrada.glb en su lugar (y luego: node intro.mjs)
//   node portico.mjs --medir               solo describe columnas, viga, cubierta, escalera, muretes y pasamanos
//
// Coordenadas de la escena en metros (+X = noreste, +Z = sureste, Y arriba; en Blender: x = X, y = −Z, z = Y). Muro sureste
// en z 11,50; losa de la entrada (entrada.mjs) con la cara superior a 0,16 m.
//
// Qué había (exportación de Isthmus_v016): dos columnas (basa, fuste y capitel, «Fresh cream trim») en x 10,40 y 15,20
// (4,80 m entre ejes), z 16,40, de 0 a 3,56 m; viga («Dark stained roof timber») de x 10,00 a 15,60 a 3,40–3,70 m; la
// cubierta de teja a cuatro aguas (x 10,10 a 15,50, z 11,30 a 17,30, alero a 3,68 m, cumbrera a 4,70) con sus cuatro limas
// (48 triángulos de la misma madera); escalera de 3,50 m (x 11,05 a 14,55) entre muretes.
//
// Medido en la foto (1280 × 960 px), en el plano de las columnas (relaciones sin escala, que no dependen de dónde estaba
// la cámara): entre ejes 173 px y columna visible (losa a capitel) 206 px, o sea entre ejes = 0,84 × altura (modelo:
// 4,80 / 3,40 = 1,41); el alero de teja del frente mide 323 px (ya corregido por estar ~0,9 m más cerca que las columnas,
// 303 px = 1,75 × entre ejes) y la viga ~255 px. La cubierta del modelo mide 5,40 m de ancho; si ese ancho vale, las
// columnas quedan a 3,09 m entre ejes (lo que se lee en la foto, ~3,1 m, y lo de cl_entrance_fix.py, 3,2 m) y la columna
// visible mide 3,68 m. La escalera, vista entre las columnas, mide ~0,8 × entre ejes (2,4 m) y la columna trasera está a
// la izquierda del pie de la escalera, casi en su borde. Nota: las referencias del edificio (peldaños de 0,137 m, ventanas
// de la planta baja, el alero corrido) no cuadran entre sí en la foto (el modelo no copia exactamente las proporciones
// reales del edificio); por eso se toman las relaciones del propio pórtico y el ancho de su cubierta. Ver el informe.
//
// Qué hace (sin reexportar nada: mueve y copia piezas del entrada.glb actual, en su cuantización):
//  1. Columnas: a x 11,25 y 14,35 (3,10 m entre ejes, centradas en la puerta, x 12,80), 0,28 m más altas: el fuste se
//     estira por arriba y el capitel sube (capitel hasta 3,84 m; columna visible de 3,68 m sobre la losa).
//  2. Viga: sube 0,28 m (3,68–3,98) y se acorta a x 10,45–15,15 (0,80 m más allá de cada eje, como en la foto).
//  3. Cubierta de teja y sus limas: suben 0,28 m con la viga; el ancho no cambia (en la foto la cubierta vuela ~1,15 m
//     más allá de cada columna). La teja sube moviendo el nodo de cada malla de teja (todas son de esta cubierta); las limas,
//     por vértices.
//  4. Columna trasera: copia de la columna oeste (basa, fuste y capitel, ya estirada) en x 11,40, z 14,00, sobre la losa,
//     delante del murete oeste y con el fuste al ras del borde de la escalera; lleva encima una viga de la misma madera
//     (copia girada de la viga del frente) de z 13,70 a 16,20 que la une con la viga del frente, por debajo de la cubierta.
//  5. Escalera: 2,40 m (x 11,60 a 14,00, centrada en la puerta); los siete peldaños se recortan por sus bordes.
//  6. Muretes: el oeste pasa a x 10,00–11,60 y el este a x 14,00–14,90 (siguen a la escalera; la llegada de la rampa, desde
//     x 14,90, y la losa no cambian).
//  7. Pasamanos (x 11,10 y 14,50, de barandas.mjs y entrada.mjs): se corren 0,55 m con los bordes de la escalera, a x 11,65
//     y 13,95. El oeste sigue rematando contra el muro, a la izquierda de la puerta (marco desde x 11,74), y el este en su
//     poste superior (z 11,65). Nada más cambia en ellos.
//
// En el .blend de origen (Isthmus_v016 y sucesores; en Blender y = −Z) hay que hacer lo mismo, además de lo de entrada.mjs:
//  · «Porch square column», «Porch column base», «Porch capital»: x 10,40 → 11,25 y 15,20 → 14,35; fuste 0,28 m más largo
//    (de 0,18–3,48 a 0,18–3,76) y capitel 0,28 m más arriba (3,64–3,84).
//  · «Porch lintel»: de x 10,00–15,60 a x 10,45–15,15 y 0,28 m más arriba (z 3,68–3,98).
//  · Cubierta de teja del pórtico y sus limas: 0,28 m más arriba (alero a 3,96, cumbrera a 4,98), mismo ancho.
//  · Columna trasera nueva, igual a las del frente: eje en x 11,40, y −14,00, sobre la losa; viga de la misma sección que el
//    dintel, de y −13,70 a y −16,20, en x 11,40, a z 3,68–3,98.
//  · «Entrance stair» (siete peldaños): x 11,60 a 14,00 (antes 11,05 a 14,55).
//  · Muretes de la escalera (los de entrada.mjs): oeste x 10,00–11,60, este x 14,00–14,90.
//  · «Porch stair handrail» y «Porch stair rail support»: x 11,10 → 11,65 y 14,50 → 13,95.
// (cl_entrance_fix.py, en claude/Isthmus_claude_hiperrealismo.blend, ya angostaba el pórtico a 3,2 m entre ejes, la
// escalera a 2,2 m, y ponía dos columnas traseras de 0,36 m y dos bancas; aquí se sigue la foto: una sola columna trasera,
// a la izquierda, igual a las del frente, y sin bancas.)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { piezas, aplicar, comprobar, copiar, centro, tam } from './barandas.mjs';

const EJE = 12.80;                               // eje de la puerta y del pórtico
const COL0 = [10.40, 15.20], COL = [11.25, 14.35];  // ejes de las columnas antes / después (3,10 m)
const ALZA = 0.28;                               // cuánto sube el pórtico (capitel de 3,56 a 3,84)
const VIGA = [10.45, 15.15];                     // viga del frente, después
const ESC0 = [11.05, 14.55], ESC = [11.60, 14.00];  // escalera antes / después (2,40 m)
const PAS0 = [11.10, 14.50], PAS = [11.65, 13.95];  // pasamanos antes / después
const TRAS = [11.40, 14.00];                     // eje de la columna trasera (x, z)
const VIGA_T = [13.70, 16.20];                   // viga sobre la columna trasera (z)
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
    if (hecho.peldanos.length !== 7) throw new Error(`portico.mjs: columnas ya en x ${COL.join(' y ')} pero hay ${hecho.peldanos.length} peldaños de x ${ESC.join(' a ')}`);
    return ['pórtico: las columnas ya están en x ' + COL.map(f2).join(' y ') + '; nada que corregir'];
  }
  const P = buscar(doc, COL0, ESC0, PAS0), res = [];
  const exigir = (L, n, que) => { if (L.length !== n) throw new Error(`portico.mjs: se esperaban ${n} ${que} y hay ${L.length}; el modelo cambió`); };
  exigir(P.cols[0], 3, 'piezas en la columna oeste (x 10,40)'); exigir(P.cols[1], 3, 'piezas en la columna este (x 15,20)');
  exigir(P.viga, 1, 'vigas del frente (x 10,00 a 15,60)'); exigir(P.limas, 1, 'juegos de limas de la cubierta');
  exigir(P.peldanos, 7, 'peldaños de x 11,05 a 14,55 (¿falta entrada.mjs?)'); exigir(P.muretes, 2, 'muretes de la escalera (¿falta entrada.mjs?)');
  const incl = P.pasamanos.filter((c) => tam(c)[2] > 1);
  exigir(incl, 2, 'pasamanos inclinados en x 11,10 y 14,50');
  const tejas = doc.getRoot().listNodes().filter((n) => /Clay terracotta/.test(n.getMesh()?.getName() ?? ''));
  for (const c of piezas(doc, /Clay terracotta/)) if (c.mn[0] < 10.05 || c.mx[0] > 15.55 || c.mn[2] < 11.25 || c.mx[2] > 17.35 || c.mn[1] < 3.6)
    throw new Error(`portico.mjs: hay teja fuera de la cubierta del pórtico (x ${f2(c.mn[0])}–${f2(c.mx[0])}, z ${f2(c.mn[2])}–${f2(c.mx[2])})`);

  // 1. columnas: se corren al eje nuevo; el fuste se estira por arriba y el capitel sube
  const estirarCol = (L, dx) => (w, i) => [w[0] + dx, w[1] + (i === 2 || (i === 1 && w[1] > centro(L[1])[1]) ? ALZA : 0), w[2]];
  // 4 (antes de mover: las copias salen de las posiciones leídas). Columna trasera = copia de la oeste, ya estirada.
  const dxT = TRAS[0] - COL0[0], dzT = TRAS[1] - ZCOL;
  P.cols[0].forEach((c, i) => { const m = estirarCol(P.cols[0], dxT); copiar(doc, c, (w) => { const r = m(w, i); r[2] += dzT; return r; }); });
  res.push(`columna trasera nueva (copia de la oeste): eje en x ${f2(TRAS[0])}, z ${f2(TRAS[1])}, basa z ${f2(P.cols[0][0].mn[2] + dzT)}–${f2(P.cols[0][0].mx[2] + dzT)}, capitel hasta ${f2(P.cols[0][2].mx[1] + ALZA)} m`);
  //    viga sobre ella: copia de la viga del frente girada 90° (su largo pasa de X a Z) y acortada por sus extremos
  const v = P.viga[0], cv = centro(v), largo = VIGA_T[1] - VIGA_T[0], recorte = (tam(v)[0] - largo) / 2, zc = (VIGA_T[0] + VIGA_T[1]) / 2;
  copiar(doc, v, ([a, b, c]) => { const u = a - cv[0]; const u2 = u < 0 ? u + recorte : u - recorte; return [TRAS[0] + (c - cv[2]), b + ALZA, zc - u2]; }, ([nx, ny, nz]) => [nz, ny, -nx]);
  res.push(`viga nueva sobre la columna trasera: x ${f2(TRAS[0] - tam(v)[2] / 2)}–${f2(TRAS[0] + tam(v)[2] / 2)}, z ${f2(VIGA_T[0])}–${f2(VIGA_T[1])}, ${f2(v.mn[1] + ALZA)}–${f2(v.mx[1] + ALZA)} m`);

  P.cols.forEach((L, k) => L.forEach((c, i) => moverPieza(c, (w) => estirarCol(L, COL[k] - COL0[k])(w, i))));
  res.push(`columnas: de x ${COL0.map(f2).join(' y ')} (${f2(COL0[1] - COL0[0])} m entre ejes) a x ${COL.map(f2).join(' y ')} (${f2(COL[1] - COL[0])} m); capitel de ${f2(P.cols[0][2].mx[1])} a ${f2(P.cols[0][2].mx[1] + ALZA)} m (columna visible sobre la losa: ${f2(P.cols[0][2].mx[1] + ALZA - 0.16)} m)`);

  // 2. viga del frente
  moverPieza(v, bordes(v, [[VIGA[0] - v.mn[0], VIGA[1] - v.mx[0]], [ALZA, ALZA], [0, 0]]));
  res.push(`viga del frente: de x ${f2(v.mn[0])}–${f2(v.mx[0])} a x ${f2(VIGA[0])}–${f2(VIGA[1])}, de ${f2(v.mn[1])}–${f2(v.mx[1])} a ${f2(v.mn[1] + ALZA)}–${f2(v.mx[1] + ALZA)} m`);

  // 3. cubierta: limas por vértices, teja por nodo
  moverPieza(P.limas[0], ([x, y, z]) => [x, y + ALZA, z]);
  for (const n of tejas) { const t = n.getTranslation(); n.setTranslation([t[0], t[1] + ALZA, t[2]]); }
  res.push(`cubierta de teja (${tejas.length} mallas) y sus limas: ${f2(ALZA)} m más arriba (alero a ${f2(3.68 + ALZA)}, cumbrera a ${f2(4.70 + ALZA)} m), mismo ancho (x 10,10 a 15,50)`);

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
