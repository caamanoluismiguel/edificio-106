// Ficha de cada edificio de Ciudad del Saber (al tocarlo en la navegación libre o con ?edificio=N): datos/ciudad_fichas.json.
// Determinista y sin nada nuevo sobre los edificios: todo sale de
//   · docs/ciudad/edificios.json (número, nombre, tipología, clase de certeza, cómo se dibuja, Open Buildings y los parámetros del
//     kit con su fuente), que sale de ciudad.mjs;
//   · docs/ciudad/inventario.json (la fecha de la base de OpenStreetMap);
//   · fuente/ciudad-observado.json (los pisos vistos en Street View, con su confianza y la fecha de la imagen: el mismo dato que usa
//     el kit, sin imágenes, identificadores ni posiciones de Google).
// Lo único que se agrega aquí es la tabla TIPOS_CERL: para cada tipo del kit que viene del informe de CERL, sus años y sus listas de
// números, con la página. Cada cifra está en docs/ciudad/tipologias-cerl.md y se comprobó en el OCR por página
// (docs/ciudad/fuentes/DTIC_ADA388262_por_pagina.txt, con el pie de cada página).
//
// Origen del tipo. CERL usa la numeración del Ejército y no la relaciona con la de Ciudad del Saber (tipologias-cerl.md §3). Si el
// número del edificio está en la lista de CERL de SU tipo (no de otro: el 100 de CERL era un galpón y el 355, una casa NCO), el origen
// es «por número»; si no, el tipo se asignó por lo observado y por la forma y el tamaño de la huella («por forma»). El año es siempre
// el del tipo, nunca el del edificio.
//
// Conteo de lo SUPUESTO (el mismo criterio de la ronda 2 del panel, 7-debate.md): de los parámetros del kit de cada edificio (las
// claves de `parametros` en edificios.json), cuenta el que tenga en su fuente, o en la de alguna de sus partes, la palabra «SUPUESTO»
// o «SUPUESTA» en mayúsculas (también SUPUESTOS y SUPUESTAS). Basta una parte supuesta para que el parámetro cuente: el tinte de un
// color observado es SUPUESTO, así que los colores cuentan casi siempre. Contar solo «SUPUESTO» daba el 53 % de la ciudad; con los
// dos géneros es el 60 %. Las cajas grises, los volúmenes a mano y las copias del 106 no tienen parámetros del kit.
//
// El 332B: OpenStreetMap parte en dos el mismo dúplex (332A y 332B, ajuste «unir» de ciudad-ajustes.json); lo dibuja el 332A y tiene
// una sola ficha, la del 332A, que nombra a los dos. Así los dúplex son 38, como en docs/ciudad/CIUDAD.md.
//
// Uso: cd fuente && node ciudad-fichas.mjs   (se rehace cuando cambian edificios.json u observado)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.join(AQUI, '..');
const leer = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const E = leer(path.join(RAIZ, 'docs/ciudad/edificios.json')).edificios;
const INV = leer(path.join(RAIZ, 'docs/ciudad/inventario.json'));
const OBS = new Map(leer(path.join(AQUI, 'ciudad-observado.json')).edificios.map((o) => [o.osm_id, o]));

// rangos de números de CERL: [desde, hasta]
const R = (...x) => x.map((r) => (Array.isArray(r) ? r : [r, r]));
// Por tipo del kit: `anios` es la línea del año del tipo (o la que dice por qué no lo hay); `grupos`, las listas de números de CERL de ese tipo, con lo que dice el informe de esa lista ({n} es el número del edificio) y, si
// cambia, el año de esa lista.
const ZONA_1939_1943 = 'Tipo construido de 1939 a 1943 en el istmo según CERL (p. 5-7); en Clayton, el primer grupo se terminó a inicios de 1942 (p. 5-6).';
const TIPOS_CERL = {
  // p. 5-6 (PDF 120), 5-7 (PDF 121) y 5-8 (PDF 122)
  duplex: { anios: ZONA_1939_1943, grupos: [
    // los años de cada lista, del cuadro «Summary of Housing Types Constructed on Fort Clayton», p. 7-9 (PDF 187): NCO Type 3,
    // «194243» en el OCR (1942-43), 301-306, 309-316, 318-323, 325-340; NCO (2F3), 1942, 307; NCO Type 4, 1942, 308
    { r: R([301, 306], [309, 316], [318, 323], [325, 340]), txt: 'el {n} está en la lista de dúplex de suboficiales de CERL (p. 5-8), que el cuadro de la p. 7-9 fecha en 1942 y 1943' },
    { r: R(307), txt: 'CERL da el 307 como el dúplex de suboficiales de rango, de 26,5 × 58 ft (p. 5-8), y el cuadro de la p. 7-9 lo fecha en 1942' },
    { r: R(308), txt: 'CERL da el 308 como la casa de suboficiales de rango de un piso, la única de un piso de ese período en Clayton (p. 5-8), y el cuadro de la p. 7-9 la fecha en 1942' },
  ] },
  // p. 5-9 (PDF 123): «This round of construction also provided…»
  oficiales41: { anios: ZONA_1939_1943, grupos: [
    // cuadro de la p. 7-9: CO Type 6, «194243» (1942-43), 401-414, 416-417, 419-424, 427-428; FO Type 4, 1942, 426, 430-434
    { r: R([401, 414], [416, 417], [419, 424], [427, 428]), txt: 'el {n} está en la lista de casas de oficiales de compañía de CERL (p. 5-9), que el cuadro de la p. 7-9 fecha en 1942 y 1943' },
    { r: R(426, [430, 434]), txt: 'el {n} está en la lista de casas de oficiales de campo de CERL (p. 5-9), que el cuadro de la p. 7-9 fecha en 1942' },
  ] },
  // p. 4-6 (PDF 95): obra de julio de 1936 a junio de 1937; p. 4-10 (PDF 99): «by the end of 1941»; 61 ft de ancho, p. 4-6 a 4-11
  cuartel4: { anios: 'Tipo construido de 1936 a 1941 según CERL (p. 4-6 a 4-11): el cuartel estándar de 61 ft de ancho.', grupos: [] },
  // CERL describe varios cuarteles de tres pisos de distintos años sin proponer cuál es cuál (tipologias-cerl.md §3): sin número que
  // coincida no hay año (y el 106, de este tipo, no se fecha: .claude/CLAUDE.md)
  cuartel3: { anios: 'Sin año: CERL describe cuarteles de tres pisos de varios años y la forma no dice de cuál es este.', grupos: [
    { r: R([126, 127]), txt: 'el {n} está en CERL entre los cuarteles del 11.º de Ingenieros (p. 4-6)', anios: 'Tipo construido de 1936 a 1937 según CERL (p. 4-6).' },
    // p. 4-7 (PDF 96) y 4-8 (PDF 97): de enero de 1939 a marzo de 1940; foto [4.06], «Buildings 128, 130-132»
    { r: R(128, [130, 132]), txt: 'el {n} está en CERL entre los cuarteles estándar del 11.º de Ingenieros (p. 4-8)', anios: 'Tipo construido de 1939 a 1940 según CERL (p. 4-8).' },
    { r: R([154, 156]), txt: 'el {n} está en CERL entre los cuarteles de 150 hombres modificados (p. 4-10)', anios: 'Tipo terminado a fines de 1941 según CERL (p. 4-10).' },
    // p. 4-11 (PDF 100): «completed in December 1941»; 200 hombres 201, 218, 220; 150, 202, 203, 205; 100, 204, 207, 208, 210 a 215, 217, 219
    { r: R([201, 205], [207, 208], [210, 215], [217, 220]), txt: 'el {n} está en CERL entre los cuarteles del «New Post» (p. 4-11)', anios: 'Tipo terminado en diciembre de 1941 según CERL (p. 4-11).' },
  ] },
  // p. 6-16 (PDF 160): «completed in 1949»
  nco49: { anios: 'Tipo terminado en 1949 según CERL (p. 6-16).', grupos: [
    { r: R([350, 385]), txt: 'el {n} está en la lista de casas de suboficiales de 1949 de CERL (p. 6-16)' },
  ] },
  // p. 3-12 (PDF 61): iniciadas del 20 de diciembre de 1932 al 8 de marzo de 1933, terminadas el 12 de septiembre de 1933
  colonels: { anios: 'Tipo construido de 1932 a 1933 según CERL (p. 3-12).', grupos: [
    { r: R([72, 85]), txt: 'el {n} está en la lista de casas de oficiales de 1932 a 1933 de CERL (p. 3-12)' },
  ] },
  // p. 7-8 (PDF 186): «Plans were drawn up in 1977 and construction was completed in 1979». Sin lista de números: la p. 7-8 no da
  // números y la lista del cuadro de la p. 7-9 tiene huecos que el OCR mezcla (ninguna casa del área 900 tiene número en OSM)
  area900: { anios: 'Tipo con planos de 1977 y obra terminada en 1979 según CERL (p. 7-8).', grupos: [] },
};
// tipos del kit que no salen de CERL (ciudad-datos.mjs: «No está en CERL», «Nada de esto está en CERL»)
for (const t of ['pabellon1', 'crance', 'bloque2_bonilla', 'nave', 'abierto', 'moderno', 'torre']) TIPOS_CERL[t] = { anios: 'Este tipo no sale del informe de CERL, así que no tiene año.', grupos: [], noCerl: true };

// un edificio que contradice a CERL (docs/ciudad/CIUDAD.md, «Decisiones que siguen abiertas»): CERL da el 220 como cuartel de 200
// hombres de tres pisos y 201 × 61 ft (p. 4-11, PDF 100); la huella de OSM sale de edificios.json
const nf2 = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
const NOTAS = {
  220: (e) => `CERL da con este número un cuartel de tres pisos de 61,26 × 18,59 m (201 × 61 ft, p. 4-11). La huella de OpenStreetMap del 220 mide ${e.parametros.huella.osm.map(nf2).join(' × ')} m, y las fotos y Open Buildings le dan dos pisos: con esas medidas no se puede decir que sea el mismo edificio.`,
};

const numeroBase = (n) => { const m = /^(\d+)/.exec(n ?? ''); return m ? Number(m[1]) : null; };
const SUP = /SUPUEST[OA]/;
function fuentes(o, acc = []) {
  if (Array.isArray(o)) for (const v of o) fuentes(v, acc);
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'fuente' && typeof v === 'string') acc.push(v); else fuentes(v, acc); }
  return acc;
}
/** [parámetros con SUPUESTO o SUPUESTA, parámetros] de un edificio del kit, o null si no tiene parámetros. */
function supuestos(e) {
  const P = e.parametros; if (!P) return null;
  const ks = Object.keys(P);
  return [ks.filter((k) => fuentes(P[k]).some((f) => SUP.test(f))).length, ks.length];
}
/** Pisos vistos en Street View: valor, fecha de la imagen y confianza (sin valor: no se ven). */
function pisosVistos(osm) {
  const p = OBS.get(osm)?.campos?.pisos; if (!p) return null;
  const f = (p.fuente ?? '').replace(/; la tarjeta dice [^)]*/g, '');
  return p.confianza && p.valor !== 'no visible' ? { v: p.valor, f, k: p.confianza } : { f };
}

const r1 = (x) => Math.round(x * 10) / 10;
const repetidos = new Map(); for (const e of E) if (e.numero) repetidos.set(e.numero, (repetidos.get(e.numero) ?? 0) + 1);
// la mitad «unida» (332B) va en la ficha de la otra (332A): el ajuste «unir» del 332A en ciudad-ajustes.json
const AJ = leer(path.join(AQUI, 'ciudad-ajustes.json'));
const unidos = new Map();
for (const [id, a] of Object.entries(AJ)) for (const o of a?.unir?.valor ?? []) { const m = E.find((x) => x.osm_id === o); if (m) unidos.set(Number(id), m.numero); }

const edificios = {};
let sup = 0, tot = 0;
for (const e of E) {
  const s = supuestos(e); if (s) { sup += s[0]; tot += s[1]; }
  if (e.modelo === 'unido') continue;                                // su ficha es la de la otra mitad
  const f = { n: e.numero ?? null };
  if (e.nombre) f.nom = e.nombre;
  if (e.tipologia) {
    f.t = e.tipologia;
    const T = TIPOS_CERL[e.tipologia], nb = numeroBase(e.numero);
    const g = T && nb != null ? T.grupos.findIndex((G) => G.r.some(([a, b]) => nb >= a && nb <= b)) : -1;
    if (g >= 0) f.g = g;
  }
  f.c = e.clase_certeza;
  f.m = e.modelo;
  const pv = pisosVistos(e.osm_id); if (pv) f.p = pv;
  if (e.open_buildings) f.ob = [r1(e.open_buildings.p90), e.open_buildings.cubre];
  if (s) f.s = s;
  if (unidos.has(e.osm_id)) f.une = unidos.get(e.osm_id);
  if ((repetidos.get(e.numero) ?? 0) > 1) f.rep = repetidos.get(e.numero);
  if (NOTAS[e.numero]) f.nota = NOTAS[e.numero](e);
  edificios[e.osm_id] = f;
}

const out = {
  generado_por: 'fuente/ciudad-fichas.mjs',
  fuentes: 'docs/ciudad/edificios.json, docs/ciudad/inventario.json, fuente/ciudad-observado.json; años y páginas de CERL de docs/ciudad/tipologias-cerl.md',
  osm_base: INV.osm_base.slice(0, 10),
  criterio_supuestos: 'parámetros del kit (claves de «parametros» en edificios.json) con «SUPUESTO» o «SUPUESTA» en su fuente o en la de alguna de sus partes',
  supuestos_ciudad: [sup, tot],
  // cerl: el tipo sale del informe de CERL (la ficha lleva entonces su crédito)
  tipos: Object.fromEntries(Object.entries(TIPOS_CERL).map(([k, T]) => [k, { anios: T.anios, cerl: !T.noCerl, grupos: T.grupos.map((G) => ({ txt: G.txt, ...(G.anios ? { anios: G.anios } : {}) })) }])),
  edificios,
};
fs.writeFileSync(path.join(RAIZ, 'datos/ciudad_fichas.json'), JSON.stringify(out));
const n = Object.keys(edificios).length;
console.log(`datos/ciudad_fichas.json: ${n} fichas, ${sup} de ${tot} parámetros del kit con SUPUESTO o SUPUESTA (${Math.round(100 * sup / tot)} %), ${(fs.statSync(path.join(RAIZ, 'datos/ciudad_fichas.json')).size / 1024).toFixed(0)} KB`);
