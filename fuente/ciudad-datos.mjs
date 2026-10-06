// Datos de cada edificio de Ciudad del Saber para el generador de la ciudad (fase 3, rama feat/ciudad). Única fuente de verdad:
// junta tres cosas y no inventa ninguna otra.
//   · docs/ciudad/inventario.json (lo genera inventario-ciudad.mjs): número, límite, altura de Open Buildings; la huella sale de
//     osm.json u osm-amplio.json registrados a la escena (contexto-osm.mjs, entorno-osm.mjs), la misma que dibuja contexto.mjs;
//   · fuente/ciudad-observado.json: lo observado en Street View, cada campo con {valor, confianza, fuente}, la clase de certeza
//     (I, II, III) y la tipología consolidada. Sale de un inventario privado que no está en el repo (decisión de LM, 5 oct 2026):
//     aquí solo van lo observado y la fecha de la imagen;
//   · fuente/ciudad-ajustes.json: correcciones a mano por id de OSM (sobreviven a cualquier regeneración: se aplican al final).
// A cada edificio le asigna una tipología del kit (si está soportada) y, para esas, los parámetros del kit con la fuente de cada
// uno ({valor, fuente}). Los que no tienen tipología soportada siguen como hoy (cajas grises de contexto.glb).
//
//   import { datosCiudad } from './ciudad-datos.mjs'      (lo usa ciudad.mjs, que además escribe docs/ciudad/edificios.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { osmRegistrado, aEscena } from './contexto-osm.mjs';
import { entornoRegistrado, relieve } from './entorno-osm.mjs';
import { KIT, MED, desplazar, simplificar, centro, rectanguloMinimo } from './ciudad-kit.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const leer = (f) => JSON.parse(fs.readFileSync(path.join(AQUI, f), 'utf8'));
const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;
/** Número para los textos de fuente: a dos decimales como mucho, con coma decimal, punto de miles y signo menos (como num() de main.js). */
const nf = (x) => { const v = r2(x), [e, d] = Math.abs(v).toString().split('.'); return (v < 0 ? '−' : '') + e.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d ? ',' + d : ''); };
// Las medidas leídas en fotos de Street View (alturas, pendientes, anchos, colores) entran al modelo como lectura aproximada: el texto
// lo dice y las redondea; se reemplazan con la medición en sitio.
const FOTO = 'lectura aproximada en foto de Street View, a medir en sitio';

// ---------------- tipologías que el kit ya sabe armar (orden de LM: cuarteles de 3 y 4 niveles primero) ----------------
export const SOPORTADAS = ['cuartel3', 'cuartel4', 'duplex', 'oficiales41', 'pabellon1', 'nco49', 'colonels', 'area900', 'crance', 'bloque2_bonilla', 'nave', 'abierto', 'moderno', 'torre'];
// las casas bajas salen de casa() (ciudad-kit.mjs); los parámetros se pasan tal cual. Desde el paso 5 también los bloques de dos pisos
// (Gonzalo Crance, Luis Bonilla), las naves y los kioscos: son rectángulos con techo inclinado, como las casas
export const CASAS = ['pabellon1', 'nco49', 'colonels', 'area900', 'crance', 'bloque2_bonilla', 'nave', 'abierto'];
// contemporáneos y torres: techo plano sobre cualquier huella (contemporaneo() en ciudad-kit.mjs)
export const PLANOS = ['moderno', 'torre'];
const FT = 0.3048, rad = Math.PI / 180;
// CERL (Enscore et al. 2000, tipologias-cerl.md §1.8): todos los cuarteles de 1936 a 1941 miden 61 ft de ancho y 121, 141 o 201 ft
// de largo (100, 150 y 200 hombres; p. 4-6 a 4-11, PDF 95 a 100)
const CERL = { ancho: 61 * FT, largos: [121, 141, 201].map((x) => x * FT) };
// pendiente del techo del cuartel estándar de CERL: 6 en 12 anotado en la fig. 4.11 (p. 4-12, PDF 101), la única pendiente que da el informe
const CERL_6_12 = Math.atan(6 / 12) * 180 / Math.PI;
// planta baja de servicio de los cuarteles de 4 niveles: altura de la losa del piso 1 sobre el suelo, leída en fotos de Street View
// (nov 2022) del 238 y el 235 con la distancia entre mediaguas del 106 (3,649 m) como escala: unos 3,5 y 2,8 m. Se toma 3,2 ± 0,4 m.
const BASE_SERVICIO = { valor: 3.2, fuente: `${FOTO} (nov 2022, 238 y 235, con la distancia entre las mediaguas del 106 como escala): unos 3,5 y 2,8 m; se toma 3,2 m, ±0,4 m. Ver docs/ciudad/CIUDAD.md` };
// tintes por la palabra observada en Street View (multiplican el color del material del 106; NO son colores medidos, salvo el café
// oscuro, ajustado a ojo desde un cociente leído en una foto)
export const TINTE = {
  muro: { 'blanco': [1, 1, 1], 'crema': [1, 0.95, 0.85], 'blanco grisáceo': [0.92, 0.92, 0.9],
    // casas de oficiales (fase 3, paso 3): las palabras del inventario; pilares y molduras blancas no se distinguen del muro
    'blanco hueso': [0.98, 0.96, 0.9], 'crema amarillo': [1, 0.92, 0.72], 'amarillo': [1, 0.86, 0.55], 'amarillo ocre': [0.98, 0.78, 0.45], 'amarillo con pilares blancos': [1, 0.86, 0.55],
    // casas del área 900 (fase 3, paso 4): el color de la planta baja de repello (la alta es de tablas, con la moldura del 106)
    'pardo oscuro': [0.55, 0.45, 0.4], 'gris': [0.82, 0.82, 0.8], 'verde claro': [0.86, 0.95, 0.84], 'oscuro': [0.6, 0.55, 0.5], 'blanco con planta baja crema': [1, 0.95, 0.85] },
  techo: { 'rojo pardo': [1, 1, 1], 'pardo oscuro': [0.6, 0.5, 0.48],
    // casas bajas (fase 3, paso 4): la lámina roja va con la teja del 106 sin tinte; la palabra «rojo» es el mismo material
    'rojo': [1, 1, 1],
    // Aroldo Cano (v2): café oscuro ajustado a ojo desde un cociente teja/muro leído en una foto de Street View (ver parametrosColonels);
    // pasa de 1 en verde y azul porque la teja del 106 es casi roja pura y el café de la foto es pardo grisáceo
    'café oscuro': [0.72, 2.4, 3.4] },
};

// ---------------- el suelo: el mismo que dibuja contexto.mjs ----------------
// Dentro del sitio, el pasto de sitio.glb (cara de arriba a −0,015 m). Fuera, la rejilla de 40 m del terreno de contexto.mjs
// (meseta a −0,6 m que pasa al relieve Copernicus en 200 m), triángulo por triángulo, con la misma diagonal. No se cuenta el agua:
// ningún edificio está en ella.
const ent = entornoRegistrado(), rel = relieve(), osm = osmRegistrado();
const MESETA = { x: 260, z0: -280, z1: 320, borde: 200 };
const sst = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const fueraMeseta = ([x, z]) => Math.max(Math.abs(x) - MESETA.x, MESETA.z0 - z, z - MESETA.z1, 0);
const enSitio = ([x, z]) => Math.abs(x) <= 180 && Math.abs(z) <= 160;
const terreno = (x, z) => { const t = sst(fueraMeseta([x, z]) / MESETA.borde); return -0.6 * (1 - t) + rel.suelo(x, z) * t; };
export function suelo([x, z]) {
  if (enSitio([x, z])) return -0.015;
  const [x0, , z0] = ent.caja, P = 40, i = Math.floor((x - x0) / P), k = Math.floor((z - z0) / P), u = (x - x0) / P - i, w = (z - z0) / P - k;
  const Y = (a, b) => terreno(x0 + a * P, z0 + b * P), Ya = Y(i, k), Yb = Y(i, k + 1), Yc = Y(i + 1, k + 1), Yd = Y(i + 1, k);
  return w >= u ? Ya + u * (Yc - Yb) + w * (Yb - Ya) : Ya + u * (Yd - Ya) + w * (Yc - Yd);
}
/** Parte un polígono [x, z] en pedazos que caen cada uno en un solo triángulo de la rejilla del terreno (las mismas celdas de 40 m y la misma
 *  diagonal que suelo()): sobre cada pedazo el terreno es un plano, así que algo dibujado a suelo() + h queda exactamente a h sobre él. Para los
 *  estacionamientos (pulido). Fuera de la rejilla (en el sitio el suelo es plano) devuelve el polígono entero. */
export function pedazosTerreno(P) {
  const [x0, , z0] = ent.caja, T = 40, xs = P.map((p) => p[0]), zs = P.map((p) => p[1]), out = [];
  const recorta = (S, C) => {   // Sutherland–Hodgman de S contra el triángulo convexo C (antihorario en x-z)
    for (let i = 0; i < 3 && S.length; i++) {
      const a = C[i], b = C[(i + 1) % 3], lado = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]), E = S; S = [];
      for (let k = 0; k < E.length; k++) {
        const p = E[k], q = E[(k + 1) % E.length], dp = lado(p), dq = lado(q);
        if (dq >= 0) { if (dp < 0) S.push([p[0] + (q[0] - p[0]) * dp / (dp - dq), p[1] + (q[1] - p[1]) * dp / (dp - dq)]); S.push(q); }
        else if (dp >= 0) S.push([p[0] + (q[0] - p[0]) * dp / (dp - dq), p[1] + (q[1] - p[1]) * dp / (dp - dq)]);
      }
    }
    return S;
  };
  const area = (Q) => Q.reduce((a, p, i) => { const q = Q[(i + 1) % Q.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
  const S0 = area(P) < 0 ? [...P].reverse() : P;
  for (let i = Math.floor((Math.min(...xs) - x0) / T); i <= Math.floor((Math.max(...xs) - x0) / T); i++)
    for (let k = Math.floor((Math.min(...zs) - z0) / T); k <= Math.floor((Math.max(...zs) - z0) / T); k++) {
      const v = (a, b) => [x0 + (i + a) * T, z0 + (k + b) * T];
      // suelo(): w ≥ u es el triángulo (i, k) · (i, k + 1) · (i + 1, k + 1); el otro, (i, k) · (i + 1, k + 1) · (i + 1, k)
      for (const C of [[v(0, 0), v(1, 1), v(0, 1)], [v(0, 0), v(1, 0), v(1, 1)]].map((c) => (area(c) < 0 ? c.reverse() : c))) {
        const Q = recorta(S0, C); if (Q.length >= 3 && Math.abs(area(Q)) > 0.01) out.push(Q);
      }
    }
  return out;
}
/** El sitio del 106 (su suelo propio, sitio.glb, con sus dos estacionamientos de contexto.mjs). */
export const enElSitio = enSitio;

/** Suelo en los vértices, los puntos medios de los lados y el centro de un polígono: mínimo, máximo. */
function sueloHuella(P) {
  const pts = [...P, ...P.map((p, i) => { const q = P[(i + 1) % P.length]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; }), centro(P)];
  const ys = pts.map(suelo); return { min: Math.min(...ys), max: Math.max(...ys) };
}

// ---------------- lectura ----------------
const INV = JSON.parse(fs.readFileSync(path.join(AQUI, '..', 'docs', 'ciudad', 'inventario.json'), 'utf8'));
const SV = leer('ciudad-observado.json');
const AJUSTES = leer('ciudad-ajustes.json');
const svDe = new Map(SV.edificios.map((e) => [e.osm_id, e]));
const polyDe = (id) => osm.edificios.find((b) => b.id === id)?.poly ?? ent.edificios.find((b) => b.id === id)?.poly ?? null;
const enContexto = new Map(osm.edificios.map((b) => [b.id, b]));

const campo = (sv, k) => sv?.campos?.[k] ?? null;
const vista = (c) => c && c.confianza && !/no visible|no se distingue/.test(c.valor ?? '');
const fuenteSV = (sv, k) => { const c = campo(sv, k); return c ? `Street View: «${c.valor}» (confianza ${c.confianza ?? 'sin dato'}; ${c.fuente})` : 'sin dato de Street View'; };

/** Rectángulo orientado de área mínima de un polígono: largo, ancho. */
function caja(P) {
  let mejor = null;
  for (let i = 0; i < P.length; i++) {
    const A = P[i], B = P[(i + 1) % P.length], L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L < 1e-6) continue;
    const d = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], s = P.map((p) => (p[0] - A[0]) * d[0] + (p[1] - A[1]) * d[1]), o = P.map((p) => -(p[0] - A[0]) * d[1] + (p[1] - A[1]) * d[0]);
    const l = Math.max(...s) - Math.min(...s), w = Math.max(...o) - Math.min(...o);
    if (!mejor || l * w < mejor.l * mejor.w) mejor = { l, w };
  }
  return { largo: Math.max(mejor.l, mejor.w), ancho: Math.min(mejor.l, mejor.w) };
}

/** Parámetros del kit para un cuartel de 3 pisos o de 4 niveles, cada uno con su fuente. */
function parametrosCuartel(tip, sv, polyOSM) {
  const p = {};
  const cj = caja(polyOSM);
  if (tip === 'cuartel4') {
    // la huella de OSM de los 17 cuarteles de 4 niveles mide lo que un cuartel de CERL (61 ft × 121, 141 o 201 ft) más el vuelo del
    // alero del 106 a cada lado (2 × 1,65 m): OSM los dibujó por el borde del techo. Los muros van 1,65 m adentro.
    const largoCERL = CERL.largos.reduce((m, L) => (Math.abs(cj.largo - 2 * KIT.vuelo - L) < Math.abs(cj.largo - 2 * KIT.vuelo - m) ? L : m), CERL.largos[0]);
    p.huella = { valor: 'OSM menos el vuelo del alero', retiro: KIT.vuelo, osm: [r2(cj.largo), r2(cj.ancho)],
      muros: [r2(cj.largo - 2 * KIT.vuelo), r2(cj.ancho - 2 * KIT.vuelo)], cerl: [r2(largoCERL), r2(CERL.ancho)],
      fuente: `OSM ${nf(cj.largo)} × ${nf(cj.ancho)} m menos 2 × ${nf(KIT.vuelo)} m = ${nf(cj.largo - 2 * KIT.vuelo)} × ${nf(cj.ancho - 2 * KIT.vuelo)} m; cuartel de CERL más cercano ${nf(largoCERL)} × ${nf(CERL.ancho)} m (61 ft × ${Math.round(largoCERL / FT)} ft, p. 4-6 a 4-11)` };
  } else {
    p.huella = { valor: 'OSM', retiro: 0, osm: [r2(cj.largo), r2(cj.ancho)], fuente: `OSM ${nf(cj.largo)} × ${nf(cj.ancho)} m, tomada como muro como la del 106 (OSM 46,0 × 22,6; muros del modelo 45,5 × 23,0)` };
  }
  p.pisos = { valor: 3, fuente: fuenteSV(sv, 'pisos') };
  p.basamento = tip === 'cuartel4' ? { ...BASE_SERVICIO } : { valor: KIT.base, fuente: 'el 106: losa del piso 1 a 0,65 m (arquitectura.glb, «V014 muted interior floor»)' };
  p.mediaguas = { valor: [1, 2], fuente: tip === 'cuartel4'
    ? 'sobre los pisos 1 y 2 (no sobre la planta baja): Street View, nov 2022 (238 y 235); el texto del inventario («sobre la planta baja») se refiere a la del piso 1. ' + fuenteSV(sv, 'mediaguas')
    : 'sobre los pisos 1 y 2, como el 106. ' + fuenteSV(sv, 'mediaguas') };
  if (tip === 'cuartel4') {
    const b = campo(sv, 'basamento_o_piso_de_servicio');
    p.servicio = { valor: { ventanas: /ventana/.test(b?.valor ?? '') }, fuente: fuenteSV(sv, 'basamento_o_piso_de_servicio') + (/ventana/.test(b?.valor ?? '') ? '; alto y posición de la banda SUPUESTOS (de 1,3 a 0,4 m bajo la losa del piso 1)' : '') };
  }
  // techo: el del 106 (17,8° desde el canto del alero). El 6:12 de CERL (fig. 4.11) es para un muro de 61 ft; en los de 4
  // niveles (que sí miden 61 ft) lo contradicen Open Buildings y la banda de techo visible en Street View: ver docs/ciudad/CIUDAD.md
  p.techo = { valor: { forma: 'cuatro aguas', pendiente: r3(KIT.techo.pendiente), desdeMuro: false },
    fuente: tip === 'cuartel4'
      ? `el 106: un faldón de ${nf(KIT.techo.pendiente)}° desde el canto del alero (cubiertas.glb). No el 6:12 de CERL (${nf(CERL_6_12)}°): daría la cumbrera unos 2 m sobre lo que permite Open Buildings y una banda de techo de unos 2 m sobre el alero que Street View no muestra (238, nov 2022). ${fuenteSV(sv, 'forma_techo')}`
      : `el 106: un faldón de ${nf(KIT.techo.pendiente)}° desde el canto del alero (cubiertas.glb), ancho de muro como el 106 (no los 61 ft de CERL). ${fuenteSV(sv, 'forma_techo')}` };
  const vt = campo(sv, 'celosias_ventanas')?.valor ?? '';
  const esBanda = /banda/.test(vt) && !/sueltos/.test(vt);
  p.ventanas = { valor: { tipo: esBanda ? 'banda' : 'pares', retiro: 0 },
    fuente: vista(campo(sv, 'celosias_ventanas')) ? `${esBanda ? 'bandas' : 'pares, como el 106'} por ${fuenteSV(sv, 'celosias_ventanas')}; módulo y alto de ventana del 106` : 'no visible: pares del 106' };
  p.mensulas = { valor: !/^no$/.test(campo(sv, 'mensulas')?.valor ?? ''), fuente: fuenteSV(sv, 'mensulas') + '; perfil del 106' };
  if (tip === 'cuartel4') {
    // panel (5 oct 2026): las mediaguas de los cuarteles del área 200 son de tejas de fibra de vidrio rojas desde 1987 y se ven como
    // bandas rojas anchas con el sofito oscuro; la pieza de la mediagua del dúplex (no la del 106, que no cambia)
    p.alero = { valor: { frente: DUPLEX_ALERO.frente, cabio: DUPLEX_ALERO.cabio, teja: null },
      fuente: `mediaguas rojas y anchas: CERL p. 6-14 (PDF 158), en 1987 la teja española de las mediaguas de todos los cuarteles del área 200 se cambió por tejas de fibra de vidrio rojas; que estos cuarteles sean los del área 200 de CERL es por la forma y el lugar, no por el número. En Street View (nov 2022) se ven como bandas rojo pardo anchas. Se usa la pieza de la mediagua del dúplex: frente de teja de ${nf(DUPLEX_ALERO.frente)} m (el del dúplex, SUPUESTO aquí: no se leyó en estos cuarteles) y cabios inclinados pegados al tablero; sin la teja en canales del dúplex (solo se dibujaría a menos de 60 m y suma bytes). ${fuenteSV(sv, 'mediaguas')}` };
    p.sofito = { valor: 'madera del 106 («Dark stained roof timber»): tablero cerrado con cabios inclinados, sin las viguetas horizontales del 106, en las mediaguas y en el alero del techo',
      fuente: `sofito oscuro de madera (Street View, nov 2022), como el del dúplex. ${fuenteSV(sv, 'color_aleros')}` };
  }
  colores(sv, p);
  return p;
}

// ---------------- dúplex tropical (tipo de 1939 a 1943 en la Zona del Canal, CERL p. 5-7; en Clayton desde inicios de 1942, p. 5-6) ----------------
// CERL (Enscore et al. 2000), p. 5-8 (PDF 122): 301 a 306, 309 a 316, 318 a 323 y 325 a 340 son dúplex «de tres vanos» de
// 24 × 44 ft; el 307 mide 26,5 × 58 ft y el 308, 28 × 38 ft (el único de un piso). Las plantas del 307 y el 308 van como ajuste.
// OSM parte el 332 en dos mitades (332A y 332B, ajuste «unir»): no son del tamaño del tipo y no entran en la muestra del vuelo.
const FUERA_DE_MUESTRA = ['307', '308', '332A', '332B'];
const DUPLEX_CERL = { largo: 44 * FT, ancho: 24 * FT };
const media = (a) => a.reduce((x, y) => x + y, 0) / a.length, desv = (a) => { const m = media(a); return Math.sqrt(media(a.map((x) => (x - m) ** 2))); };
const mediana = (a) => { const s = [...a].sort((x, y) => x - y); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
/** Lo que vale para todo el tipo, medido sobre los 35 dúplex enteros de 24 × 44 ft (no el 307, el 308 ni las dos mitades del 332). */
const DUPLEX = (() => {
  const filas = SV.edificios.filter((e) => e.tipologia_consolidada?.clave === 'duplex' && !FUERA_DE_MUESTRA.includes(e.numero_cds))
    .map((e) => ({ cj: caja(polyDe(e.osm_id)), ob: INV.edificios.find((r) => r.osm_id === e.osm_id)?.open_buildings }));
  const vA = filas.map((f) => (f.cj.ancho - DUPLEX_CERL.ancho) / 2), vL = filas.map((f) => (f.cj.largo - DUPLEX_CERL.largo) / 2);
  return { n: filas.length, vuelo: r2(media(vA)), sdA: r2(desv(vA)), vueloL: r2(media(vL)), sdL: r2(desv(vL)),
    sdAncho: r2(desv(filas.map((f) => f.cj.ancho))), sdLargo: r2(desv(filas.map((f) => f.cj.largo))),
    ob: { p90: mediana(filas.map((f) => f.ob.p90)), p99: mediana(filas.map((f) => f.ob.p99)), p99min: Math.min(...filas.map((f) => f.ob.p99)), p99max: Math.max(...filas.map((f) => f.ob.p99)) } };
})();
// Alturas leídas en dos fotos de Street View de nov 2022 casi de frente: el lado largo del 333 (escala con los 44 ft de CERL) y el
// extremo del 307 (escala con sus 26,5 ft). Del suelo al encuentro del sofito con el muro, unos 8,8 m en las dos; la losa del primer
// piso habitable a unos 3/10 de esa altura y la junta de la mediagua con el muro a unos 2/3. Con 8,8 m: losa a 2,6 m, mediagua a
// 5,8 m (losa del segundo piso a 5,7: en el 106 la junta va 0,10 m sobre la losa), dos pisos de 3,1 m.
const DUPLEX_ALTURAS = `${FOTO} (nov 2022; el 333 y el extremo del 307, con los 44 y 26,5 ft de CERL como escala): del suelo al sofito unos 9 m (se toma 8,8); la losa del primer piso habitable a unos 3/10 de esa altura y la junta de la mediagua a unos 2/3; ±0,3 m. Ver docs/ciudad/CIUDAD.md`;
// Pendiente del techo, acotada en dos fotos de Street View (nov 2022): desde el 325 se ve el faldón del extremo, así que la pendiente
// pasa de unos 17°; el extremo del 307 visto de frente no muestra techo sobre el alero, así que queda por debajo de unos 23°. Queda el
// medio, 20 ± 3°.
const DUPLEX_PENDIENTE = { valor: 20, fuente: `acotada en fotos de Street View (nov 2022; ${FOTO}): más de unos 17° (desde el 325 se ve el faldón del extremo) y menos de unos 23° (el extremo del 307 de frente no muestra techo sobre el alero); se toma 20 ± 3°. Con 20° la cumbrera queda a unos 10,3 m; Open Buildings da p99 de 9 m (mediana del tipo) y en el 106 corrige 1,1 m hacia arriba` };

/** Envolvente convexa (antihoraria) de un conjunto de puntos [x, z]. */
function envolvente(pts) {
  const P = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), x = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const media_ = (L) => { const H = []; for (const p of L) { while (H.length >= 2 && x(H.at(-2), H.at(-1), p) <= 0) H.pop(); H.push(p); } return H; };
  const ab = media_(P), ar = media_([...P].reverse()); return [...ab.slice(0, -1), ...ar.slice(0, -1)];
}
/** Rectángulo de largo × ancho con el centro y el rumbo del rectángulo mínimo de P. */
function rectanguloCentrado(P, largo, ancho) {
  const R = rectanguloMinimo(simplificar(P)), c = centro(R);
  const lados = R.map((A, i) => { const B = R[(i + 1) % 4], L = Math.hypot(B[0] - A[0], B[1] - A[1]); return { L, d: [(B[0] - A[0]) / L, (B[1] - A[1]) / L] }; });
  const dL = lados.reduce((m, x) => (x.L > m.L ? x : m), lados[0]).d, dW = [-dL[1], dL[0]];
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [c[0] + dL[0] * a * largo / 2 + dW[0] * b * ancho / 2, c[1] + dL[1] * a * largo / 2 + dW[1] * b * ancho / 2]);
}

// ---------------- casas bajas (fase 3, paso 4): calle, extremos y muros ----------------
const { registro: REG } = osm, thR = REG.rotacionGrados * Math.PI / 180, [c0x, c0z] = REG.centroOSM106;
/** Lat/lon a la escena registrada (como contexto-osm.mjs y los scripts de Street View). */
export const aReg = (lat, lon) => { const [x, z] = aEscena(lat, lon), dx = x - c0x, dz = z - c0z; return [dx * Math.cos(thR) - dz * Math.sin(thR), dx * Math.sin(thR) + dz * Math.cos(thR)]; };
/** Dirección (unitaria, [x, z]) del centro de la huella al punto más cercano de la calle de inventario.json (via_cercana). */
function haciaLaCalle(r, P) {
  const q = r.via_cercana?.punto; if (!q) return null;
  const c = centro(P), p = aReg(q.lat, q.lon), d = [p[0] - c[0], p[1] - c[1]], l = Math.hypot(...d) || 1;
  return { v: [r3(d[0] / l), r3(d[1] / l)], calle: r.via_cercana.nombre ?? r.via_cercana.via_con_nombre?.nombre ?? 'sin nombre', m: r2(l) };
}
/** Caja de la huella de OSM: centro, eje largo, eje corto, largo y ancho. */
function ejes(P) {
  const R = rectanguloMinimo(simplificar(P)), c = centro(R);
  const lados = R.map((A, i) => { const B = R[(i + 1) % 4], L = Math.hypot(B[0] - A[0], B[1] - A[1]); return { L, d: [(B[0] - A[0]) / L, (B[1] - A[1]) / L] }; });
  const lg = lados.reduce((m, x) => (x.L > m.L ? x : m), lados[0]), co = lados.find((x) => Math.abs(x.d[0] * lg.d[0] + x.d[1] * lg.d[1]) < 0.5);
  return { c, dL: lg.d, dW: [-lg.d[1], lg.d[0]], L: lg.L, W: co.L };
}
/** Rectángulo de muros dentro de la caja de OSM: a lo largo de a a b (desde el centro, por el eje largo) y ancho w centrado (o corrido). */
const rectEjes = (E, a, b, w, dw = 0) => [[a, -w / 2 + dw], [b, -w / 2 + dw], [b, w / 2 + dw], [a, w / 2 + dw]].map(([s, o]) => [E.c[0] + E.dL[0] * s + E.dW[0] * o, E.c[1] + E.dL[1] * s + E.dW[1] * o]);
const RUMBOS = { N: [Math.SQRT1_2, -Math.SQRT1_2], E: [Math.SQRT1_2, Math.SQRT1_2], S: [-Math.SQRT1_2, Math.SQRT1_2], O: [-Math.SQRT1_2, -Math.SQRT1_2] };
/** Punto cardinal más cercano a una dirección de la escena. */
const cardinal = (v) => Object.entries(RUMBOS).reduce((m, [k, r]) => (r[0] * v[0] + r[1] * v[1] > m[1] ? [k, r[0] * v[0] + r[1] * v[1]] : m), ['', -2])[0];

/** Colores observados (muro y techo) como tinte sobre el material del 106. */
function colores(sv, p) {
  const cm = campo(sv, 'color_muros'), ct = campo(sv, 'color_techo');
  const tm = vista(cm) && TINTE.muro[cm.valor], tt = vista(ct) && TINTE.techo[ct.valor];
  p.color_muros = { valor: tm ? cm.valor : 'el del 106', tinte: tm || [1, 1, 1], fuente: tm ? `${fuenteSV(sv, 'color_muros')}; tinte SUPUESTO por la palabra sobre «Warm lime-painted plaster» del 106` : 'el material del 106 (sin dato o sin tinte para esa palabra)' };
  p.color_techo = { valor: tt ? ct.valor : 'el del 106', tinte: tt || [1, 1, 1], fuente: tt ? `${fuenteSV(sv, 'color_techo')}; tinte SUPUESTO por la palabra sobre «Clay terracotta 04» del 106` : 'el material del 106 (sin dato o sin tinte para esa palabra)' };
}

// Planta baja del dúplex v2 (LM, 2026-10-04: un cuarto cerrado al centro y un estacionamiento a cada lado). Lecturas aproximadas en
// fotos de Street View de nov 2022, con los 44 ft de CERL como escala del lado largo del 333.
const DUPLEX_PB = {
  pilar: 0.45, retiroNucleo: 0.3, piso: true,
  cuarto: { largo: 6.0, celosia: [1.25, 0.6, -1.0], celosiaBajoViga: 0.05, puerta: [0.9, 2.1, 1.2] },
  escaleras: { ancho: 0.9, separacion: 0.05, descanso: 1.2, esquina: 0.15, huella: 0.25, contrahuella: 0.18, baranda: 0.9, puerta: [0.9, 2.1] },
};
const DUPLEX_PB_FUENTE = 'planta baja (LM, conocimiento del sitio, 2026-10-04): un cuarto cerrado al centro y un estacionamiento a cada lado, con piso de concreto. '
  + `Medidas: ${FOTO} (nov 2022: 333, 337, 306 y 301; imágenes de LM del 4 oct 2026, entre ellas la del 328B). `
  + 'Pilares cuadrados de unos 0,45 m (±0,08). '
  + 'Cuarto de unos 6 m a lo largo (±0,3), centrado, retirado 0,3 m de las caras largas (SUPUESTO: los pilares quedan por delante en 333 y 306). '
  + 'Celosía alta de unos 1,25 × 0,6 m justo bajo la viga (±0,15 m; 306 y 301 iguales). Puerta junto a ella (328B: puerta y nicho de lavandería en la cara del cuarto); 0,9 × 2,1 m SUPUESTO. '
  + 'Piso de concreto en los estacionamientos (333, 337, 301, 306 y 328B), dibujado 6 cm sobre el terreno de la escena. '
  + 'Escaleras de entrada: una en cada extremo, afuera del muro, que sube a lo largo del lado corto hasta un descanso con la puerta del primer piso, con huellas de teja, base blanca maciza y baranda parda (imágenes de LM del 4 oct 2026; en la del 328B la de la izquierda va dentro del estacionamiento: no se modela esa variante). Ancho 0,9 m, descanso 1,2 m, huella 0,25 y contrahuella 0,18 m SUPUESTOS (±0,2 m). '
  + 'No se modelan la escalera metálica negra dentro de los estacionamientos de 333 y 306, el muro bajo blanco delante del cuarto ni el nicho de lavandería: el dato no dice qué cara es el frente de cada dúplex.';
// Alero y mediagua del dúplex v2 (solo el dúplex, el 106 no cambia)
const DUPLEX_ALERO = {
  frente: 0.35,
  cabio: { paso: KIT.pieza.viguetasTecho.paso, ancho: KIT.pieza.viguetasTecho.ancho, alto: r3(KIT.pieza.viguetasTecho.y1 - KIT.pieza.viguetasTecho.y0), primera: KIT.pieza.viguetasTecho.primera },
  teja: { paso: 0.3, relieve: 0.07, caballete: 0.15 },
};
const DUPLEX_ALERO_FUENTE = `frente de teja de la mediagua de unos 0,35 m (±0,08; ${FOTO}, 333, nov 2022, corregida porque el borde está más cerca de la cámara que el muro), con la tabla de borde parda del 106 debajo (el 106: 0,12 m de frente de teja). `
  + 'Cabios inclinados pegados al tablero, sin luz entre ellos (Street View, nov 2022: 306 y 333; imagen de LM del 328B): sección y paso de las viguetas del 106 (cubiertas.glb y detalles.glb, 0,074 × 0,109 m cada 0,65 m). '
  + 'Teja en canales sobre el techo y la mediagua para que el faldón se lea como teja: paso de 0,30 m y relieve de 0,07 m, medidos en la teja del 106 (cubiertas.glb, faldón SE: la autocorrelación del relieve tiene picos a 0,15 y 0,30 m, canal y cobija; relieve p5 a p95 de 0,071 m); caballete de 0,15 m SUPUESTO.';

// v3 (LM, 4 oct 2026: «ventanas anchas corredizas con marco y ménsulas más grandes»). Lecturas aproximadas en fotos de Street View de
// nov 2022 con los 44 ft de CERL como escala, bahía por bahía (las tres iguales, CERL p. 5-8): el 333 casi de frente, el 337 y el 306
// en diagonal (solo posiciones y proporciones), y las imágenes de LM del 4 oct 2026.
const DUPLEX_VENTANAS = {
  pisos: [
    { dintel: 2.3, extremo: [2.1, 1.3], medio: { modo: 'pilastras', ancho: 1.15, alto: 0.95, aPilastra: 0.4 } },
    { dintel: 2.0, extremo: [2.05, 1.35], medio: { modo: 'par', ancho: 1.2, alto: 0.62, junta: 0.15 } },
  ],
  corto: { ancho: 1.8, separacion: 0.35 },
  marco: 0.05, lama: 0.2, reja: { barrote: 0.02, paso: 0.15 },
};
const DUPLEX_VENTANAS_FUENTE = `${FOTO} (nov 2022: 333 casi de frente, 337 y 306 en diagonal), bahía por bahía con la bahía de 44/3 ft como escala: `
  + 'primer piso, una ventana de unos 2,1 m en cada bahía de los extremos (unos 1,25 m de alto) y, en la del medio, dos de unos 1,15 m junto a las pilastras (337 y 306 iguales), más bajas (unos 0,9 a 1 m; se toma 0,95), con el dintel a la misma altura (2,3 m sobre la losa, la v2); ±0,2 m. '
  + 'Segundo piso, una de unos 2 m en cada bahía de los extremos (1,25 a 1,4 m de alto) y, al centro de la del medio, un par de ventanas bajas de unos 1,2 m pegadas (unos 0,6 m de alto; 337 y 306 iguales), dintel a 2,0 m (la v2). Lado corto: dos de 1,8 m al centro (la v2). '
  + 'Ventanas de aluminio claro con marco y parteluz visibles: corredizas (333) o de celosía de vidrio, lamas cada unos 0,2 m (337 y 306: unas cinco por hoja). Perfil del marco de 0,05 m SUPUESTO. '
  + 'Rejas oscuras de seguridad donde se ven (337, bahía derecha de los dos pisos; 328B, imagen de LM; 334 según el inventario): barrotes de 0,02 m cada 0,15 m SUPUESTOS. Tipo por edificio según el inventario (persianas de vidrio: celosía), salvo lo visto en Street View (ciudad-ajustes.json).';
/** Ventanas de un dúplex: el tipo sale del campo del inventario (las persianas de vidrio son celosías); las rejas, solo donde se ven. */
function ventanasDuplex(sv) {
  const t = campo(sv, 'celosias_ventanas')?.valor ?? '';
  return { valor: { ...DUPLEX_VENTANAS, tipo: /persianas de vidrio/.test(t) ? 'celosia' : 'corrediza', rejas: /rejas/.test(t) ? 'extremos' : null },
    fuente: DUPLEX_VENTANAS_FUENTE + ' ' + fuenteSV(sv, 'celosias_ventanas') };
}
const DUPLEX_MENSULAS_FUENTE = 'v3: ménsulas de bloque blancas bajo la mediagua en cada línea de bahía del lado largo, esquinas incluidas (Street View, nov 2022: 333, cuatro líneas y tres bahías, y 306; imágenes de LM del 4 oct 2026). '
  + `Medidas: ${FOTO}. Ancho de unos 0,4 m (±0,1); alto en el muro de unos 0,5 m (±0,1; se toma 0,55); vuelo de unos 1 m (±0,2: los bloques de las esquinas se ven salir del muro casi media mediagua); alto en la punta 0,35 m SUPUESTO (canto de abajo apenas inclinado en 306). `
  + 'Vigas blancas en las esquinas de los extremos hasta el borde de la mediagua (328B), de unos 0,25 × 0,35 m (tan anchas como las ménsulas vistas de lado; ±0,1 m). No es la ménsula curva del 106. La v2 tenía 0,3 m de ancho y 0,6 m de vuelo: LM las vio diminutas.';
const DUPLEX_MURO_BAJO_FUENTE = `v3: muro bajo blanco macizo delante del cuarto, del lado de la puerta (Street View, nov 2022: 333, 337 y 306; imágenes de LM): unos 1,5 m de ancho (±0,3) y 1,6 m de alto (±0,2) (${FOTO}, a la escala de las celosías del cuarto), corrido 1,2 m del centro del cuarto hacia la puerta. Fondo 0,6 m y separación de 0,4 m del muro del cuarto SUPUESTOS. Va en las dos caras largas, girado 180° como la planta: el dato no dice qué cara es el frente de cada dúplex.`;

/** Parámetros del kit para un dúplex tropical, cada uno con su fuente. El 307 y el 308 cambian planta, bahías y pisos por ajuste. */
function parametrosDuplex(sv, polyOSM) {
  const p = {}, cj = caja(polyOSM), D = DUPLEX;
  p.planta = { valor: [r3(DUPLEX_CERL.largo), r3(DUPLEX_CERL.ancho)], fuente: 'CERL p. 5-8 (PDF 122): dúplex «de tres vanos» de 24 × 44 ft (7,32 × 13,41 m)' };
  p.huella = { valor: 'rectángulo de la planta con el centro y el rumbo de la caja de OSM', osm: [r2(cj.largo), r2(cj.ancho)],
    fuente: `OSM ${nf(cj.largo)} × ${nf(cj.ancho)} m es el borde del techo (ver vuelo); los muros son la planta de CERL centrada en esa caja y con su rumbo` };
  p.vuelo = { valor: D.vuelo, fuente: `OSM dibuja el borde del techo: en los ${D.n} dúplex enteros de 24 × 44 ft (sin el 307, el 308 ni las dos mitades del 332), (ancho de OSM − 24 ft)/2 = ${nf(D.vuelo)} ± ${nf(D.sdA)} m. Por el largo da ${nf(D.vueloL)} ± ${nf(D.sdL)} m, pero OSM traza el largo con más ruido (desviación del largo ${nf(D.sdLargo)} m contra ${nf(D.sdAncho)} m del ancho en edificios iguales). Un solo vuelo para el techo y la mediagua: en Street View (nov 2022: el 333 y el extremo del 307) los dos vuelan parecido` };
  p.pisos = { valor: 2, fuente: fuenteSV(sv, 'pisos') };
  p.basamento = { valor: 2.6, fuente: DUPLEX_ALTURAS };
  p.alturas = { valor: [3.1, 3.1], fuente: DUPLEX_ALTURAS };
  p.losa = { valor: { espesor: 0.3 }, fuente: `canto de la losa y la viga sobre la planta baja abierta: unos 0,3 m (${FOTO}, 333, nov 2022); ±0,1 m` };
  p.mediaguas = { valor: [1], fuente: 'una, sobre el primer piso habitable, alrededor del bloque. ' + fuenteSV(sv, 'mediaguas') };
  p.techo = { valor: { forma: 'cuatro aguas', pendiente: r3(DUPLEX_PENDIENTE.valor) },
    fuente: `cuatro aguas: LM, conocimiento del sitio, 2026-10-04 (todos los dúplex son a cuatro aguas; la panorámica sin fecha rotulada «307» con hastial no es del 307), corregido en el inventario; antes ya lo indicaban la vista aérea (Esri World Imagery, solo mirada: limatesas a las cuatro esquinas), el extremo del 307 de frente (Street View, nov 2022: alero horizontal), el faldón del extremo visto desde el 325 (nov 2022) y la foto [5.11] de CERL (p. 5-8). Pendiente: ${DUPLEX_PENDIENTE.fuente}. Inventario: ${fuenteSV(sv, 'forma_techo')}` };
  p.bahias = { valor: 3, fuente: 'CERL p. 5-8: «three-bay configuration»; en Street View (333, 337) tres paños en el lado largo' };
  p.ventanas = ventanasDuplex(sv);
  p.planta_baja = { valor: DUPLEX_PB, fuente: DUPLEX_PB_FUENTE + ' ' + fuenteSV(sv, 'basamento_o_piso_de_servicio') };
  p.pilastras = { valor: { ancho: 0.3, sale: 0.05 }, fuente: `pilastras blancas en las líneas de bahía del lado largo, del canto de la losa al remate (Street View, nov 2022: 333, 337 y 306; imagen de LM del 328B). Ancho de unos 0,3 m (±0,08; ${FOTO}, 333); lo que salen del muro, 0,05 m, es SUPUESTO (solo se ve la línea de sombra)` };
  p.mensulas = { valor: { tipo: 'bloque', ancho: 0.4, vuelo: 1.0, alto: 0.55, punta: 0.35, viga: { ancho: 0.25, alto: 0.35 } },
    fuente: DUPLEX_MENSULAS_FUENTE + ' ' + fuenteSV(sv, 'mensulas') };
  p.muro_bajo = { valor: { ancho: 1.5, alto: 1.6, fondo: 0.6, separacion: 0.4, desdeCentro: 1.2 }, fuente: DUPLEX_MURO_BAJO_FUENTE };
  p.alero = { valor: DUPLEX_ALERO, fuente: DUPLEX_ALERO_FUENTE };
  p.sofito = { valor: 'madera del 106 («Dark stained roof timber»): tablero cerrado con cabios inclinados', fuente: 'sofito pardo oscuro con cabios sobre un tablero cerrado, sin luz entre ellos (Street View, nov 2022: 306 y 333; imágenes de LM del 4 oct 2026, entre ellas la del 328B). ' + fuenteSV(sv, 'color_aleros') };
  colores(sv, p);
  return p;
}

// ---------------- casas de oficiales (el mismo período que el dúplex: CERL p. 5-6, 5-7 y 5-9) ----------------
// CERL (Enscore et al. 2000), p. 5-9 (PDF 123): 24 casas de oficiales de compañía (401 a 414, 416, 417, 419 a 424, 427, 428), «two-story
// … 26.5 x 58 ft … basically the same as the NCO quarters of the same size (Building 307)» con medio baño más en la planta baja, y seis
// de oficiales de campo (426, 430 a 434), unifamiliares de dos pisos de 28 × 44 ft. Foto [5.12]: «Company officers' duplex quarters
// (Buildings 411-413)», 1953. Salen de duplex() con la planta, las bahías, el techo y la planta baja de este tipo.
const OFICIALES_CERL = {
  compania: { planta: [58 * FT, 26.5 * FT], numeros: [...Array(14).keys()].map((i) => 401 + i).concat([416, 417, 419, 420, 421, 422, 423, 424, 427, 428]) },
  campo: { planta: [44 * FT, 28 * FT], numeros: [426, 430, 431, 432, 433, 434] },
};
/** Compañía o campo: por el número de CERL si está en una de las dos listas; si no, por el largo de la caja de OSM (el borde del techo:
 *  planta de CERL más dos vuelos de 2,1 m), el más cercano. */
function tipoOficial(numero, cj) {
  const n = parseInt(numero ?? '', 10);
  for (const [k, T] of Object.entries(OFICIALES_CERL)) if (T.numeros.includes(n)) return { tipo: k, por: `número ${numero} en la lista de CERL p. 5-9 (${k === 'campo' ? 'oficiales de campo' : 'oficiales de compañía'})` };
  const d = (k) => Math.abs(cj.largo - (OFICIALES_CERL[k].planta[0] + 2 * OFICIALES_VUELO_HASTIAL));
  const tipo = d('compania') <= d('campo') ? 'compania' : 'campo';
  return { tipo, por: `el largo de OSM (${numero ? `el ${numero} no está en las listas de CERL p. 5-9` : 'sin número'}): ${nf(cj.largo)} m, más cerca de ${nf(OFICIALES_CERL[tipo].planta[0] + 2 * OFICIALES_VUELO_HASTIAL)} m (${tipo === 'campo' ? 'campo, 44 ft' : 'compañía, 58 ft'} más dos vuelos de hastial) que del otro tipo` };
}
// Vuelo del alero en los hastiales: en una foto de Street View de nov 2022 del 679244370 (calle Palmer), con la bahía de 58/4 ft como
// escala, el hastial sale unos 2 m del muro del extremo; se toma 2,1 ± 0,4 m. Las cajas de OSM dibujadas por el techo dan, por el
// largo, de 0,2 a 4,1 m (mediana 1,6): OSM traza el largo con ruido.
const OFICIALES_VUELO_HASTIAL = 2.1;
const OFICIALES_VENTANAS = {
  ...DUPLEX_VENTANAS, tipo: 'corrediza', rejas: null,
  pisos: [
    { dintel: 2.3, extremo: [1.8, 1.3], medio: { modo: 'una', ancho: 1.8, alto: 1.3 } },
    { dintel: 2.0, extremo: [1.75, 1.25], medio: { modo: 'una', ancho: 1.75, alto: 1.25 } },
  ],
};
/** Parámetros de una casa de oficiales: los del dúplex con lo propio del tipo, cada uno con su fuente. */
function parametrosOficiales(sv, polyOSM, numero) {
  const p = parametrosDuplex(sv, polyOSM), cj = caja(polyOSM), T = tipoOficial(numero, cj), campo_ = T.tipo === 'campo';
  const pl = OFICIALES_CERL[T.tipo].planta;
  p.planta = { valor: pl.map(r3), tipo: T.tipo, fuente: `CERL p. 5-9 (PDF 123): ${campo_ ? 'oficiales de campo, 28 × 44 ft (8,53 × 13,41 m), unifamiliar' : 'oficiales de compañía, 26,5 × 58 ft (8,08 × 17,68 m), dúplex «basically the same as … Building 307»'}. Tipo por ${T.por}` };
  const vA = (cj.ancho - pl[1]) / 2;
  p.huella = { valor: 'rectángulo de la planta con el centro y el rumbo de la caja de OSM', osm: [r2(cj.largo), r2(cj.ancho)], vuelo_implicito: r2(vA),
    fuente: `OSM ${nf(cj.largo)} × ${nf(cj.ancho)} m: por el ancho, (OSM − planta)/2 = ${nf(vA)} m, ${vA > 1.2 ? 'OSM dibuja el borde del techo (como en los dúplex)' : 'OSM dibuja casi el muro'}; los muros son la planta de CERL centrada en esa caja y con su rumbo` };
  p.bahias = { valor: campo_ ? 3 : 4, fuente: campo_ ? 'SUPUESTO: 44 ft como el dúplex de tres bahías (CERL p. 5-8)' : 'cuatro bahías como el 307 (CERL p. 5-9: iguales al 307; ciudad-ajustes.json del 307) y como se ven entre pilastras en el 679244370 (Street View, nov 2022); SUPUESTO en las demás' };
  p.techo = { valor: { forma: 'dos aguas', pendiente: r3(DUPLEX_PENDIENTE.valor), vueloHastial: OFICIALES_VUELO_HASTIAL },
    fuente: `dos aguas con hastial en los lados cortos, revisado en Street View casa por casa (no se copió el inventario, que se equivocó en los dúplex): ver docs/ciudad/CIUDAD.md. Vuelo en los hastiales ${nf(OFICIALES_VUELO_HASTIAL)} m (${FOTO}, 679244370, nov 2022; ±0,4 m). Pendiente SUPUESTA igual a la del dúplex (${nf(DUPLEX_PENDIENTE.valor)}°): CERL dice que son iguales al 307 y ninguna vista deja medirla (en la foto de Street View del 679244370, nov 2022, el hastial se ve de canto), así que va al recorrido a pie. Inventario: ${fuenteSV(sv, 'forma_techo')}` };
  p.planta_baja = { valor: { ...DUPLEX_PB, cuarto: { ...DUPLEX_PB.cuarto, bahiasAbiertas: 1 }, escaleras: { ...DUPLEX_PB.escaleras, ...(campo_ ? { extremos: 1 } : {}) } },
    fuente: `planta baja de servicio: cuartos cerrados en todas las bahías menos una, abierta como cochera en un extremo (679244370: la cochera bajo el descanso de la escalera y los cuartos con ventanas en las otras tres; 427: «cerrada con cuartos, una abierta para auto»; 426: «cochera abierta y cuartos»). Qué extremo es la cochera, SUPUESTO (el de s = 0). Escaleras de entrada como las del dúplex, ${campo_ ? 'una sola (unifamiliar, CERL p. 5-9), en el extremo de la cochera' : 'una en cada extremo (dúplex, CERL p. 5-9)'}; en 679244370 la escalera sube junto al lado largo hasta un descanso en la esquina: la forma es la del dúplex, SUPUESTA. ${fuenteSV(sv, 'basamento_o_piso_de_servicio')}` };
  p.muro_bajo = { valor: null, fuente: 'no se ve en las casas de oficiales' };
  p.ventanas = { valor: OFICIALES_VENTANAS, fuente: `una ventana por bahía y por piso, de aluminio con parteluz, como en el 679244370 (Street View, nov 2022): unas 0,4 bahías de ancho en los dos pisos (se toman 1,8 m en el primero y 1,75 m en el segundo) y 1,3 y 1,25 m de alto (${FOTO}; ±0,3 m). Dintel a la altura del dúplex. ${fuenteSV(sv, 'celosias_ventanas')}` };
  return p;
}

// ---------------- pabellón de un piso con cochera plana ----------------
// No está en CERL (inventario). Todo sale de fotos de Street View de nov 2022 y de la vista aérea (Esri World Imagery, solo mirada).
// Ver docs/ciudad/CIUDAD.md.
const PAB = {
  // foto de Street View del 152, con una puerta estándar de 6 ft 8 in (2,03 m, SUPUESTO) como escala vertical: del suelo al sofito junto
  // a la puerta unos 2,5 m; umbral de la puerta a unos 0,2 m sobre el pasto; ventana de unos 1,15 m de alto con el alféizar a 1 m del suelo
  base: 0.2, piso: 2.25, vuelo: 0.7, pendiente: 12,
  ventana: { ancho: 1.2, alto: 1.15, dintel: 1.95 }, puerta: { ancho: 0.9, alto: 2.03 },
  cochera: { largo: 6.0, columna: 0.45, losa: 0.25 },
};
const PAB_ALTURAS = `${FOTO} (152, nov 2022), con una puerta estándar de 6 ft 8 in (2,03 m, SUPUESTO) como escala vertical: del suelo al sofito junto a la puerta unos 2,5 m, umbral a unos 0,2 m sobre el pasto. Losa de 0,2 m y muro de 2,25 m hasta el sofito; ±0,2 m`;
/** Parámetros del pabellón: muros dentro de la caja de OSM (que es el borde del techo y de la cochera), techo, ventanas y cochera. */
function parametrosPabellon(sv, polyOSM, r, aj) {
  const p = {}, E = ejes(polyOSM), K = PAB, calle = haciaLaCalle(r, polyOSM);
  // extremo de la cochera: por ajuste (visto en Street View) o, si no, el extremo que mira hacia el punto más cercano de la calle
  const porAjuste = aj?.cochera_en?.valor, vEnd = porAjuste ? RUMBOS[porAjuste] : calle?.v ?? E.dL;
  const sg = vEnd[0] * E.dL[0] + vEnd[1] * E.dL[1] >= 0 ? 1 : -1, enV = E.dL.map((x) => r3(x * sg));
  const a = sg > 0 ? -E.L / 2 + K.vuelo : -E.L / 2 + K.cochera.largo, b = sg > 0 ? E.L / 2 - K.cochera.largo : E.L / 2 - K.vuelo;
  p.muros = { valor: rectEjes(E, a, b, E.W - 2 * K.vuelo).map((q) => q.map(r3)), largo: r2(b - a), ancho: r2(E.W - 2 * K.vuelo),
    fuente: `caja de OSM ${nf(E.L)} × ${nf(E.W)} m tomada como borde del techo y de la cochera: en la vista aérea (Esri World Imagery, solo mirada) el techo rojo mide de ancho lo mismo que OSM donde no lo tapan árboles (152: 12,5 a 14,8 m; 147: 11,9 a 15,2; 154: 12,7 a 13,0; OSM 12,5). Muros de ${nf(b - a)} × ${nf(E.W - 2 * K.vuelo)} m: OSM menos el vuelo a cada lado y en el hastial, y menos la cochera en su extremo` };
  p.base = { valor: K.base, fuente: PAB_ALTURAS };
  p.pisos = { valor: [K.piso], fuente: PAB_ALTURAS + '. Un piso: ' + fuenteSV(sv, 'pisos') };
  p.techo = { valor: { forma: 'dos aguas', pendiente: K.pendiente, vuelo: K.vuelo, vueloHastial: K.vuelo, espesor: 0.15, lamina: true },
    fuente: `dos aguas con hastial en los lados cortos: la cumbrera corre a lo largo en la vista aérea (149, 150, 155 y 140 de OSM 1387876288) y en Street View se ve el hastial bajo en el extremo (138; en el 152, el del cuerpo de servicio del extremo); clase I en 138 y 152, el resto por el tipo. Vuelo de ${nf(K.vuelo)} ± 0,3 m (${FOTO}, 138, a la escala de la altura del alero; poca confianza). Pendiente ${nf(K.pendiente)}° SUPUESTA («pendiente baja»): ninguna vista deja medirla; va al recorrido a pie. Lámina roja con el material de la teja del 106. Lámina ondulada en el detalle alto (pulido, ondas de 7,6 cm en el sombreado, SUPUESTAS: el perfil común de lámina ondulada). Inventario: ${fuenteSV(sv, 'forma_techo')}; ${fuenteSV(sv, 'material_techo')}` };
  // sinLamas (recorte de WebGL 2 aprobado por LM, 4 oct 2026): las lamas de vidrio no se dibujan; el tipo sigue siendo celosía
  p.ventanas = { valor: { tipo: 'celosia', sinLamas: true, marco: 0.05, lama: 0.2, reja: { barrote: 0.02, paso: 0.15 }, rejas: null,
    pisos: [{ largo: [0.08, 0.2, 0.42, 0.58, 0.8, 0.92], corto: [0.5], ...K.ventana }] },
    fuente: `152 (Street View, nov 2022): ventanas de aluminio de celosía de vidrio, de unos 1,15 m de alto con el alféizar a 1 m del suelo (${FOTO}; dintel a 1,95 m sobre la losa); ancho 1,2 m SUPUESTO (la fachada se ve en diagonal). Cuántas y dónde: SUPUESTO, seis por cara larga y una por extremo («puertas sueltas en la fachada larga», inventario). Las lamas no se dibujan (recorte de WebGL 2, LM 4 oct 2026). ${fuenteSV(sv, 'celosias_ventanas')}` };
  p.puertas = { valor: { largo: [0.31, 0.69], ...K.puerta }, fuente: 'dos puertas por cara larga (rótulos «152 A», «143 B», «149 B», «137 B»: dos unidades por pabellón); 0,9 × 2,03 m estándar SUPUESTO; posición SUPUESTA. ' + fuenteSV(sv, 'entrada') };
  p.cochera = { valor: { en: enV, cardinal: cardinal(enV), ...K.cochera },
    fuente: `techo plano sobre columnas blancas pegado a un extremo (Street View, nov 2022: 140 de OSM 1387876288, 138, 147 y 155): unos 6 m de largo (±0,5) (140: un auto de ~4,3 m cabe con margen), del ancho de la casa, columnas de bloque de unos 0,45 m y losa con canto pardo de unos 0,25 m a la altura del alero (${FOTO}). Extremo: ${porAjuste ? `${porAjuste}, visto en Street View (${aj.cochera_en.fuente})` : `SUPUESTO, el que mira hacia la calle más cercana (${calle?.calle ?? 'sin calle'}); al ${cardinal(enV)}`}. ${fuenteSV(sv, 'rasgos_notables')}` };
  colores(sv, p);
  return p;
}

// ---------------- casa NCO de 1949, un piso ----------------
// CERL (Enscore et al. 2000), p. 6-16 y 6-17 (PDF 160 y 161): 36 edificios (350 a 385), 72 viviendas; «Constructed on a concrete slab, each
// one-story building was rectangular, with two 16 ft wings extending to the rear … low-pitched overhanging roof … red corrugated asbestos
// … In the front center was a covered carport for both families … matched in the rear by a covered utility area … covered by
// continuous roofing from the main block, and supported by corner posts». CERL no da medidas del bloque.
const NCO = {
  base: 0.15, piso: 2.45, vuelo: 0.9, pendiente: 12,
  faldon: { ancho: 6.0, fondo: 5.5, pendiente: 6, poste: 0.2 },
  ventana: { ancho: 1.8, alto: 1.4, dintel: 2.2 }, puerta: { ancho: 0.9, alto: 2.03 },
};
const NCO_ALTURAS = `${FOTO} (372, panorámica de usuario, may 2020), con una puerta de 6 ft 8 in (2,03 m, SUPUESTO) como escala vertical: del suelo al sofito junto a la puerta unos 2,6 m; losa casi a nivel del suelo (inventario: «sobre losa, casi a nivel del suelo»). Losa de 0,15 m y muro de 2,45 m; ±0,2 m`;
function parametrosNco(sv, polyOSM, r, aj) {
  const p = {}, E = ejes(polyOSM), K = NCO, calle = haciaLaCalle(r, polyOSM);
  // la cara de la cochera: por ajuste o la que mira a la calle más cercana (CERL: «front center»)
  const vC = aj?.cochera_en?.valor ? RUMBOS[aj.cochera_en.valor] : calle?.v ?? E.dW, sg = vC[0] * E.dW[0] + vC[1] * E.dW[1] >= 0 ? 1 : -1, frente = E.dW.map((x) => r3(x * sg));
  const W = E.W - 2 * K.vuelo - K.faldon.fondo, L = E.L - 2 * K.vuelo;
  p.muros = { valor: rectEjes(E, -L / 2, L / 2, W, -sg * K.faldon.fondo / 2).map((q) => q.map(r3)), largo: r2(L), ancho: r2(W),
    fuente: `caja de OSM ${nf(E.L)} × ${nf(E.W)} m tomada como borde del techo con el faldón de la cochera (en la vista aérea, Esri World Imagery, el techo rojo llena la caja de OSM en 372, 384, 385 y 380, con el corrimiento de la imagen). Bloque de ${nf(L)} × ${nf(W)} m: OSM menos el vuelo a cada lado y menos el fondo del faldón (${nf(K.faldon.fondo)} m, SUPUESTO) del lado de la cochera. CERL no da medidas del bloque; las dos alas traseras de 16 ft y el área de servicio de atrás no se modelan` };
  p.base = { valor: K.base, fuente: NCO_ALTURAS };
  p.pisos = { valor: [K.piso], fuente: NCO_ALTURAS + '. Un piso (CERL p. 6-17: «one-story»)' };
  p.techo = { valor: { forma: 'dos aguas', pendiente: K.pendiente, vuelo: K.vuelo, vueloHastial: K.vuelo, espesor: 0.15, lamina: true },
    fuente: `dos aguas con hastial bajo en los lados cortos: Street View (372, 384, 394, clase I, y otras 10 con el mismo campo) y CERL («low-pitched overhanging roof … red corrugated asbestos»); en el 394 el extremo derecho es un hastial con el alero volado y el sofito oscuro. Vuelo ${nf(K.vuelo)} ± 0,3 m a ojo en fotos de Street View (372 y 394); pendiente ${nf(K.pendiente)}° SUPUESTA («low-pitched»): ninguna vista deja medirla. Lámina con el material de la teja del 106. Lámina ondulada en el detalle alto (pulido, ondas de 7,6 cm en el sombreado, SUPUESTAS: el perfil común de lámina ondulada). ${fuenteSV(sv, 'forma_techo')}` };
  p.faldon = { valor: { cara: frente, cardinal: cardinal(frente), ...K.faldon },
    fuente: `cochera al frente y al centro bajo el mismo techo, sobre postes en las esquinas (CERL p. 6-17; Street View, 372 y 394: el faldón sigue sobre la cochera, con el borde unos 0,6 m más bajo que el alero, de ahí la pendiente de ${nf(K.faldon.pendiente)} ± 3°). Ancho ${nf(K.faldon.ancho)} m y fondo ${nf(K.faldon.fondo)} m SUPUESTOS (dos autos; 372: un auto cabe bajo el faldón). Cara: ${aj?.cochera_en ? `${aj.cochera_en.valor}, ${aj.cochera_en.fuente}` : `la que mira a la calle más cercana (${calle?.calle ?? 'sin calle'}), SUPUESTO`}; al ${cardinal(frente)}` };
  p.ventanas = { valor: { tipo: 'corrediza', marco: 0.05, lama: 0.2, reja: { barrote: 0.02, paso: 0.15 }, rejas: null, pisos: [{ largo: [0.1, 0.27, 0.73, 0.9], corto: [], ...K.ventana }] },
    fuente: `ventanas anchas de aluminio con marco y parteluz (Street View, 372 y 394; CERL: las persianas metálicas se cambiaron por guillotina en 1976): unos 1,8 × 1,4 m (${FOTO}), dintel a 2,2 m sobre la losa, ±0,3 m. Dos a cada lado de la cochera por cara larga y ninguna en los extremos (372: extremo derecho ciego), SUPUESTO en la cara de atrás. ` + fuenteSV(sv, 'celosias_ventanas') };
  p.puertas = { valor: { largo: [0.38, 0.62], ...K.puerta }, fuente: 'una puerta por vivienda a cada lado de la cochera (CERL: «front door entering into the living room, and a service door from the carport into the kitchen»; Street View, 372 y 394); 0,9 × 2,03 m SUPUESTO. ' + fuenteSV(sv, 'entrada') };
  colores(sv, p);
  return p;
}

// ---------------- casa elevada de Aroldo Cano, «Colonels' Row» ----------------
// CERL (Enscore et al. 2000), p. 3-12 a 3-15 (PDF 61 a 64): casas de oficiales de compañía 72 a 85 (1932 a 1933), «almost square, measuring
// 44 x 52.75 ft … main living areas were raised one story on concrete pillars, and part of the space underneath was enclosed … The remaining
// open area underneath was used as a parking space … central door at the top of concrete steps, both in front and back … tile roofs were
// overhanging and low-pitched»; el frente mira al área abierta y atrás pasa un camino de servicio. Planos [3.29] y alzados [3.30] (p. 3-14,
// PDF 63), medidos en fuentes/figuras/pdf-p063-000.png con el ancho del alzado frontal (760 px = 52,75 ft: 14,4 px/ft) como escala.
const COL_CERL = { planta: [52.75 * FT, 44 * FT] };
const COL = {
  base: 2.95, piso: 3.05, vuelo: 1.5, pendiente: Math.atan(6 / 12) * 180 / Math.PI,
  // v2 (LM, 4 oct 2026): sin hastialitos (Street View 543575149 y 543575145 no los muestran); dos vanos anchos por cara y, en la de la
  // escalera de atrás, la bahía bajo el descanso cerrada; teja café oscuro (tinte ajustado a ojo desde una foto de Street View, abajo)
  arcada: { bahiasLargo: 3, bahiasCorto: 2, pilar: 0.45, fondoPilar: 0.45, abertura: 2.3, radio: 0.6, losa: 0.3, cerradaBajoDescanso: true, cerrada: { fondo: 6.0, ventana: [1.2, 1.0] } },
  escalera: { ancho: 1.1, separacion: 0.05, huella: 0.25, contrahuella: 0.2, baranda: 0.9, puerta: [0.9, 2.1] },
};
const COL_FIG = 'CERL [3.30] (p. 3-14, PDF 63; fuentes/figuras/pdf-p063-000.png), medido a 14,4 px/ft (alzado frontal: 760 px entre pilares de las esquinas = 52,75 ft)';
function parametrosColonels(sv, polyOSM, r, aj) {
  const p = {}, E = ejes(polyOSM), K = COL, calle = haciaLaCalle(r, polyOSM), [Lc, Wc] = COL_CERL.planta;
  const vL = (E.L - Lc) / 2, vW = (E.W - Wc) / 2;
  p.muros = { valor: rectEjes(E, -Lc / 2, Lc / 2, Wc).map((q) => q.map(r3)), largo: r2(Lc), ancho: r2(Wc), vuelo_implicito: [r2(vL), r2(vW)],
    fuente: `CERL p. 3-12: 52,75 × 44 ft (16,08 × 13,41 m), centrada en la caja de OSM (${nf(E.L)} × ${nf(E.W)} m) con su rumbo. OSM es el borde del techo: vuelo implícito ${nf(vL)} m por el largo y ${nf(vW)} m por el ancho (el alzado dibuja ~1,5 m)` };
  p.base = { valor: K.base, fuente: `${COL_FIG}: del piso terminado de la planta baja al del primer piso, 140 px = 9,7 ft (2,96 m). En una foto de Street View (145, nov 2022) con la puerta de arriba como escala (2,03 m SUPUESTO), unos 2,8 m (lectura aproximada, a medir en sitio). ±0,2 m` };
  p.pisos = { valor: [K.piso], fuente: `${COL_FIG}: viga de techo («ceiling joist») a 283 px del suelo = 19,7 ft (6,0 m), 3,03 m sobre el piso; se toma 3,05. Con el vuelo y la pendiente, el canto del alero queda a unos 5,4 m (alzado: 5,46 m; en una foto de Street View del 145, nov 2022, también unos 5,4 m, lectura aproximada)` };
  p.techo = { valor: { forma: 'cuatro aguas', pendiente: r3(K.pendiente), vuelo: K.vuelo, espesor: 0.15 },
    fuente: `cuatro aguas de teja: Street View (13 de 14 clase I, «cuatro aguas») y la vista aérea (543575145: limatesas a las cuatro esquinas). Pendiente 6:12 (${nf(K.pendiente)}°) medida en los dos alzados laterales de ${COL_FIG} (390 px de vuelo horizontal por 195 de alto; el alero del porche igual): CERL la llama «low-pitched». En una foto de Street View (543575149, nov 2022) la pendiente sale de unos 25° (23 a 28°; ${FOTO}): no es más baja que el 6:12 dentro del error, así que se deja el 6:12. Vuelo 1,5 m (unos 5 ft en el alzado). Sin los hastialitos de ventilación de los alzados: en Street View (543575149 y 543575145, nov 2022) la cumbrera se ve limpia. ${fuenteSV(sv, 'forma_techo')}` };
  const atras = calle?.v ?? E.dW, frente = atras.map((x) => -x);
  p.arcada = { valor: { ...K.arcada, cerrada: { ...K.arcada.cerrada, cara: frente.map(r3) } },
    fuente: `v2: dos vanos anchos por cara (bahiasCorto 2; en las caras largas, tres bahías con la de debajo del descanso de la escalera de atrás cerrada con una puerta, como en Street View 543575149 y 543575145, nov 2022). Planta baja abierta entre pilares con arcos rebajados (Street View: «planta baja abierta con pilares y arcos rebajados», 543575151, 543575145, 543575142; ${COL_FIG}: tres arcos por cara, abertura de 7,5 ft (2,3 m) con las esquinas redondeadas, pilares de ~1,4 ft). Cuartos de servicio y bodega cerrados del lado del frente (CERL [3.29]); el frente mira al área abierta y la calle (${calle?.calle ?? 'sin calle'}) es el camino de servicio de atrás, donde queda el estacionamiento abierto, como se ve desde la calle. Fondo de los cuartos 6,0 m a ojo en [3.29]; radio del arco 0,6 m y pilar de 0,45 m, ±0,15 m` };
  p.escaleras = { valor: [{ cara: atras.map(r3), hasta: 0.8, descanso: 2.4, invertir: true, ...K.escalera }, { cara: frente.map(r3), hasta: 0.48, descanso: 4.3, ...K.escalera }],
    fuente: `escalera de concreto adelante y atrás hasta la puerta central (CERL p. 3-12). Adelante, a lo largo de la fachada hasta un descanso de 4,3 m que termina a 0,48 del ancho (${COL_FIG}, alzado frontal); atrás, desde la calle se ve subir de izquierda a derecha hasta un descanso que termina a unos 0,8 del largo (Street View 145 y 149, nov 2022; el alzado trasero también sube hacia la derecha). El sentido de la de adelante es el del alzado frontal, sin vista que lo confirme. Ancho 1,1 m, huella 0,25 y contrahuella 0,2 m SUPUESTOS` };
  p.ventanas = { valor: { tipo: 'corrediza', marco: 0.05, lama: 0.2, reja: { barrote: 0.02, paso: 0.15 }, rejas: null, pisos: [{ largo: [0.14, 0.38, 0.62, 0.86], corto: [0.25, 0.75], ancho: 1.5, alto: 1.2, dintel: 2.3 }] },
    fuente: `ventanas de aluminio (CERL p. 3-15: guillotina doble de aluminio desde 1988); en Street View (149 y 145, nov 2022), ventanas de unos 1,5 × 1,2 m con marco (${FOTO}, a la escala de la puerta); cuatro por cara larga y dos por extremo SUPUESTO (los alzados de [3.30] tienen el porche abierto, cerrado antes de 1968). ${fuenteSV(sv, 'celosias_ventanas')}` };
  colores(sv, p);
  // teja café oscuro (LM, 4 oct 2026): el inventario dice «rojo pardo», pero en una foto de Street View del 543575149 (nov 2022, nublado)
  // la teja se lee parda y mucho más oscura que el muro; el tinte acerca a ojo el cociente teja/muro del visor al de la foto
  p.color_techo = { valor: 'café oscuro', tinte: TINTE.techo['café oscuro'], fuente: `café oscuro (LM, 4 oct 2026): en una foto de Street View del 543575149 (nov 2022, nublado) la teja se lee parda, con un cociente teja/muro de cerca de la mitad en los tres canales; en el visor con «Clay terracotta 04» era de cerca de 0,6 en rojo y de 0,2 a 0,3 en verde y azul (${FOTO}). Tinte por canal sobre el material del 106, ajustado a ojo para acercar el cociente; es un tinte, no un material nuevo. ` + p.color_techo.fuente };
  return p;
}

// ---------------- casa del área 900, calles Hill y Parke ----------------
// CERL (Enscore et al. 2000), p. 7-8 a 7-10 (PDF 186 a 188): vivienda con planos de 1977 y obra terminada en 1979 (el cuadro de p. 7-9 dice
// 1978 a 1979), áreas 900 y 1100; «walls of wood studs and gypsum board
// … roofing material was steel coated with baked enamel. The exterior finish for the first floor was stucco, and for the second floor was
// either horizontal or vertical siding. Some units had stucco panels under the second-story windows»; dúplex de cuatro dormitorios con
// cocheras a los lados o de cuatro viviendas con cochera central. CERL no da medidas.
const A900 = { base: 0.15, pisos: [2.35, 2.75], vuelo: 0.6, vueloHastial: 2.0, pendiente: 10 };
const A900_ALTURAS = `${FOTO} (OSM 388106868, nov 2022, casi de frente), con la puerta como escala (2,03 m SUPUESTO): losa a unos 0,15 m, comienzo de las tablas del piso alto a unos 2,5 m y sofito a unos 5,3 m del suelo; ±0,2 m`;
function parametrosArea900(sv, polyOSM, r, aj) {
  // pulido: con el ajuste cochera_l, la huella en L de OSM se parte (partirL) en la casa (el rectángulo grande) y la cochera (el chico)
  // de los dos cortes de la L, el que deja la casa con el lado corto más cerca del fondo de las casas medidas (388106868: 13,1 m; 388106870:
  // 15,1 m; media 14,1); si empatan, el de la cochera más chica
  const Lc = aj?.cochera_l ? (() => { const L = partirL(polyOSM, true), ar = (q) => (q[1] - q[0]) * (q[3] - q[2]), fondo = (q) => Math.abs(Math.min(q[1] - q[0], q[3] - q[2]) - 14.1);
    const k = Math.abs(fondo(L.A.grande) - fondo(L.B.grande)) < 0.05 ? (ar(L.A.chico) <= ar(L.B.chico) ? 'A' : 'B') : fondo(L.A.grande) < fondo(L.B.grande) ? 'A' : 'B';
    return { E: L.E, ...L[k] }; })() : null, casaPoly = Lc ? rectSO(Lc.E, ...Lc.grande) : polyOSM;
  const p = {}, E = ejes(casaPoly), K = A900;
  p.muros = { valor: rectEjes(E, -E.L / 2, E.L / 2, E.W).map((q) => q.map(r3)), largo: r2(E.L), ancho: r2(E.W),
    fuente: `caja de OSM ${nf(E.L)} × ${nf(E.W)} m tomada como muro: en una foto de Street View del 388106868 (casi de frente) la fachada mide unos 19 m a la escala de la puerta (lectura aproximada) y OSM 19,3 m. Solo una casa medida; en las demás, SUPUESTO` };
  p.base = { valor: K.base, fuente: A900_ALTURAS };
  p.pisos = { valor: K.pisos, fuente: A900_ALTURAS + '. Dos pisos: ' + fuenteSV(sv, 'pisos') };
  p.techo = { valor: { forma: 'cuatro aguas', pendiente: K.pendiente, vuelo: K.vuelo, vueloHastial: K.vueloHastial, espesor: 0.15, lamina: true },
    fuente: `cuatro aguas: en la vista aérea (Esri World Imagery, solo mirada) se ven las limatesas en 388106857, 388106864, 388106868 y 388106870; el inventario dice «dos aguas de pendiente baja» en muchas y «alero recto» en las de tablas (no se cambió el inventario: pregunta para LM). Alero de los extremos de unos 2 m (${FOTO}, 388106868; 388106849: «alero muy volado en el hastial lateral»); el de los lados largos, ${nf(K.vuelo)} m SUPUESTO. Pendiente ${nf(K.pendiente)}° SUPUESTA («lámina de pendiente baja»; desde la calle no se ve el faldón). Acero esmaltado (CERL) con el material de la teja del 106. Lámina ondulada en el detalle alto (pulido, ondas de 7,6 cm en el sombreado, SUPUESTAS: el perfil común de lámina ondulada). ${fuenteSV(sv, 'forma_techo')}` };
  p.tablas = { valor: { desde: 1, paso: 0.2, sale: 0.01 }, fuente: 'tablas horizontales en el piso alto (CERL p. 7-10: «horizontal or vertical siding»; Street View 388106868, 388106870, 388106863, 388106849: horizontales); hilada de 0,2 m SUPUESTA; con la moldura crema del 106 (en Street View son crema, gris o verde claro). ' + fuenteSV(sv, 'color_muros') };
  p.ventanas = { valor: { tipo: 'corrediza', marco: 0.05, lama: 0.2, reja: { barrote: 0.02, paso: 0.15 }, rejas: null,
    pisos: [{ largo: [0.39, 0.61], corto: [0.5], ancho: 1.4, alto: 1.15, dintel: 1.95 }, { largo: [0.085, 0.245, 0.39, 0.61, 0.755, 0.915], corto: [0.3, 0.7], ancho: 1.25, alto: 0.9, dintel: 2.15 }] },
    fuente: `ventanas de aluminio de guillotina (CERL: «single-hung aluminum windows»), ${FOTO} (388106868, nov 2022): abajo unos 1,4 × 1,15 m con el dintel a unos 1,95 m sobre la losa; arriba unos 1,25 × 0,9 m con el dintel a unos 2,15 m sobre el piso; posiciones de esa fachada (las de la derecha tapadas por una palma, por simetría); la cara de atrás y los extremos, SUPUESTO. No se modelan los paneles de repello bajo las ventanas altas ni las rejas` };
  p.puertas = { valor: { largo: [0.14, 0.86], ancho: 1.1, alto: 2.03 }, fuente: 'Street View del 388106868 (nov 2022): puerta de entrada a 0,14 del largo y puerta corrediza de vidrio a ~0,86 (CERL: «sliding glass door … to the patio»); ancho SUPUESTO' };
  p.cochera = { valor: null, fuente: 'la cochera larga de lámina sobre columnas metálicas (inventario) no se modela: en la vista aérea queda fuera de la caja de OSM y no se sabe de qué lado en cada casa' };
  if (Lc) {
    const [a0, a1, b0, b1] = Lc.chico;
    p.muros.fuente = `huella en L de OSM (ajuste cochera_l) partida en la casa, el rectángulo grande de ${nf(E.L)} × ${nf(E.W)} m tomado como muro (del tamaño de las casas medidas: 388106868, 19,3 × 13,1 m; 388106870, 22,7 × 15,1 m), y la cochera, el chico`;
    p.cobertizo = { valor: { muros: rectSO(Lc.E, a0, a1, b0, b1), alto: 2.6, espesor: 0.1, columna: 0.15, parte: aj.cochera_l.valor === 'azul' ? 'laminaAzul' : 'teja' },
      fuente: `cochera de lámina sobre columnas en el rectángulo chico de la L de OSM (${nf(a1 - a0)} × ${nf(b1 - b0)} m; de los dos cortes de la L, el que deja la casa con el fondo más cerca de 14,1 m, el de las casas medidas): ${aj.cochera_l.fuente}. Techo plano a 2,6 m, lámina de 0,1 m y columnas de 0,15 m SUPUESTOS` };
    p.cochera = { valor: null, fuente: 'la cochera va como cobertizo (ver cobertizo)' };
  }
  colores(sv, p);
  // el color de la planta baja de repello, cuando el inventario lo da por pisos («planta alta de tablas …; planta baja de repello X»)
  const pb = /planta baja (?:de repello )?([a-záéíóúñ ]+)$/.exec(campo(sv, 'color_muros')?.valor ?? '')?.[1]?.trim();
  if (pb && TINTE.muro[pb]) p.color_muros = { valor: pb, tinte: TINTE.muro[pb], fuente: `${fuenteSV(sv, 'color_muros')}: color de la planta baja de repello; tinte SUPUESTO por la palabra` };
  return p;
}

// ---------------- fase 3, paso 5: altos y modernos ----------------
// Nada de esto está en CERL: sale de Street View (nov 2022 salvo donde se dice), de la vista aérea
// (Esri World Imagery, solo mirada) y de Open Buildings (alturas p90 de inventario.json). Ver docs/ciudad/CIUDAD.md.
const OB = (r) => r.open_buildings ?? {};
const ob90 = (r) => `Open Buildings p90 ${nf(OB(r).p90 ?? 0)} m (p99 ${nf(OB(r).p99 ?? 0)}, cubre ${nf(OB(r).cubre ?? 0)})`;
/** Rectángulo de a × b (en el marco de ejes(), s a lo largo y o a lo ancho) entre s0..s1 y o0..o1, en la escena. */
const rectSO = (E, s0, s1, o0, o1) => [[s0, o0], [s1, o0], [s1, o1], [s0, o1]].map(([s_, o]) => [r3(E.c[0] + E.dL[0] * s_ + E.dW[0] * o), r3(E.c[1] + E.dL[1] * s_ + E.dW[1] * o)]);
/** Una huella en L de 6 vértices (dos rectángulos de techo, como dibuja OSM los bloques de Gonzalo Crance) se parte en el rectángulo grande
 *  y el chico; de los dos cortes posibles, el que deja el chico de menos área. Devuelve los dos en el marco de ejes() o null si no es una L. */
export function partirL(P, ambos = false) {
  const S = simplificar(P); if (S.length !== 6) return null;
  const E = ejes(P), loc = S.map((p) => { const d = [p[0] - E.c[0], p[1] - E.c[1]]; return [d[0] * E.dL[0] + d[1] * E.dL[1], d[0] * E.dW[0] + d[1] * E.dW[1]]; });
  const ss = loc.map((p) => p[0]), oo = loc.map((p) => p[1]), S0 = Math.min(...ss), S1 = Math.max(...ss), O0 = Math.min(...oo), O1 = Math.max(...oo);
  // el vértice entrante: el que no está en el borde de la caja en ninguno de los dos ejes
  const r = loc.find((p) => Math.min(p[0] - S0, S1 - p[0]) > 0.5 && Math.min(p[1] - O0, O1 - p[1]) > 0.5); if (!r) return null;
  // la esquina vacía de la caja: la que no es vértice de la huella
  const vacia = [[S0, O0], [S1, O0], [S1, O1], [S0, O1]].find((q) => !loc.some((p) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.6)); if (!vacia) return null;
  const [sv, ov] = vacia;
  const sLejos = sv === S0 ? S1 : S0, oLejos = ov === O0 ? O1 : O0;
  // corte en s = r[0]: grande = s entre r[0] y sLejos (todo o); chico = s entre sv y r[0], o entre r[1] y oLejos
  const A = { grande: [Math.min(r[0], sLejos), Math.max(r[0], sLejos), O0, O1], chico: [Math.min(sv, r[0]), Math.max(sv, r[0]), Math.min(r[1], oLejos), Math.max(r[1], oLejos)], lado: 's' };
  const B = { grande: [S0, S1, Math.min(r[1], oLejos), Math.max(r[1], oLejos)], chico: [Math.min(r[0], sLejos), Math.max(r[0], sLejos), Math.min(ov, r[1]), Math.max(ov, r[1])], lado: 'o' };
  const area = (q) => (q[1] - q[0]) * (q[3] - q[2]);
  if (ambos) return { E, A, B };
  return { E, ...(area(A.chico) <= area(B.chico) ? A : B) };
}
const VENT = { tipo: 'corrediza', marco: 0.05, lama: 0.2, reja: { barrote: 0.02, paso: 0.15 }, rejas: null };
/** Fracciones de un lado para n ventanas repartidas. */
const fracciones = (n) => [...Array(n).keys()].map((i) => r3((i + 0.5) / n));

// ---- módulo 4: bloque de dos pisos con cuerpo bajo (calle Gonzalo Crance, 162 a 181) ----
// Medidas: la foto de Street View del 177 (casi de frente, nov 2022) no da una escala absoluta fiable; las alturas de piso son SUPUESTAS (3,0 m) y se comprueban contra Open Buildings: con ellas la cumbrera da 8,6 a 8,9 m y Open
// Buildings da p90 de 7,5 a 9,5 m en las 16 (mediana 8,5).
const CR = { base: 0.8, piso: 3.0, vuelo: 1.0, pendiente: 12, ala: { alto: 3.8, pendiente: 15, vuelo: 1.0 } };
const CR_FUENTE_OSM = 'en la vista aérea (Esri World Imagery, solo mirada: 176 y 177) el techo llena la L de OSM: OSM es el borde de los dos techos';
function parametrosCrance(sv, polyOSM, r) {
  const p = {}, K = CR, L = partirL(polyOSM), E = L?.E ?? ejes(polyOSM);
  const [s0, s1, o0, o1] = L ? L.grande : [-E.L / 2, E.L / 2, -E.W / 2, E.W / 2], v = K.vuelo;
  p.muros = { valor: rectSO(E, s0 + v, s1 - v, o0 + v, o1 - v), largo: r2(Math.max(s1 - s0, o1 - o0) - 2 * v), ancho: r2(Math.min(s1 - s0, o1 - o0) - 2 * v),
    fuente: `${L ? 'huella en L de OSM partida en el cuerpo alto (el rectángulo grande) y el cuerpo bajo' : 'huella rectangular de OSM: solo el cuerpo alto'}; ${CR_FUENTE_OSM}. Muros del cuerpo alto: el techo menos ${nf(v)} m de vuelo a cada lado (SUPUESTO, ±0,3 m; en Street View 177 el alero vuela algo menos que un hueco de ventana)` };
  p.base = { valor: K.base, fuente: 'primer piso levantado sobre un zócalo con rejillas o persianas de madera entre pilares (Street View 177, 179, 172: «zócalo cerrado con persianas de madera»; 170, 174: «levantado sobre pilares»); 0,8 m SUPUESTO (±0,3 m)' };
  p.pisos = { valor: [K.piso, K.piso], fuente: `dos pisos (Street View: ${campo(sv, 'pisos')?.valor ?? 'sin dato'}); 3,0 m cada uno SUPUESTO, comprobado contra ${ob90(r)}` };
  p.techo = { valor: { forma: 'dos aguas', pendiente: K.pendiente, vuelo: v, vueloHastial: v, espesor: 0.12 },
    fuente: `dos aguas de lámina con hastial en el extremo y el alero inclinado volado (Street View 177, 176, 172, 162: el hastial del cuerpo alto con su alero inclinado; inventario «dos aguas en el cuerpo alto (hastial en el extremo)» en 166, 172, 176, 177, 179). Pendiente ${nf(K.pendiente)}° SUPUESTA («pendiente baja»). Lámina roja con el material de la teja del 106, sin ondas. ${fuenteSV(sv, 'forma_techo')}` };
  if (L) {
    const [a0, a1, b0, b1] = L.chico, va = K.ala.vuelo;
    // el cuerpo bajo va del muro del cuerpo alto (metido v bajo su alero) al borde de su techo menos su vuelo
    const pega = L.lado === 's' ? (Math.abs(a0 - s1) < 0.01 ? [s1 - v, a1 - va, b0 + va, b1 - va] : [a0 + va, s0 + v, b0 + va, b1 - va])
      : (Math.abs(b0 - o1) < 0.01 ? [a0 + va, a1 - va, o1 - v, b1 - va] : [a0 + va, a1 - va, b0 + va, o0 + v]);
    p.ala = { valor: { muros: rectSO(E, ...pega), alto: K.ala.alto, base: K.base, techo: { pendiente: K.ala.pendiente, vuelo: va, espesor: 0.12 }, tornapuntas: 2.0,
      ventanas: { una: true, paso: 2.6, ancho: 1.1, alto: 2.0, dintel: 2.5 } },
      fuente: `cuerpo bajo de un piso adosado: el rectángulo chico de la L de OSM (${nf(L.chico[1] - L.chico[0])} × ${nf(L.chico[3] - L.chico[2])} m de techo). Techo a cuatro aguas de lámina roja con tornapuntas de madera oscura bajo el alero (Street View 177, 176, 172; inventario de 166 a 179). Alto del muro 3,8 m (el primer piso del cuerpo alto) y pendiente ${nf(K.ala.pendiente)}° SUPUESTOS; una ventana alta con marco oscuro al centro de cada cara libre (pulido: Street View 177, una por cara; leída en la foto con el muro SUPUESTO de 3,8 m como escala, así que también es SUPUESTA: unos 1,1 × 2 m con el dintel a unos 2,5 m sobre el piso; se toma 1,1 × 2,0 m, ±0,3 m; centrada, SUPUESTO)` };
    p.entre_pisos = { valor: { pisos: [1], vuelo: 1.0, pendiente: 15, espesor: 0.12 },
      fuente: 'alero corrido de lámina entre los dos pisos del cuerpo alto, con tornapuntas (Street View 177 y 176, también en 172; inventario «alero corrido entre los dos pisos» en 168, 174, 175, 177, 179). Vuelo 1,0 m y pendiente 15° SUPUESTOS' };
  } else {
    p.ala = { valor: null, fuente: `huella de OSM rectangular: sin cuerpo bajo (inventario: ${campo(sv, 'pisos')?.valor ?? 'sin dato'}; 162, 164, 178 y 181 no lo tienen; el 172 sí lo tiene en Street View pero OSM no lo dibuja)` };
    p.entre_pisos = { valor: null, fuente: 'sin alero entre pisos (Street View 162: «no; capote de teja sobre la puerta»)' };
  }
  p.tornapuntas = { valor: { paso: 2.4, techo: false, hastial: true }, fuente: 'tornapuntas de madera oscura bajo el alero corrido y en el hastial (Street View 177, 176); cada 2,4 m y sección de 0,1 m SUPUESTAS' };
  p.zocalo = { valor: { paso: 2.4, ancho: 1.4, alto: 0.5, parte: 'servicio' }, fuente: 'persianas de madera parda entre los pilares del zócalo (Street View 177, 179, 172); posición y medidas SUPUESTAS' };
  p.ventanas = { valor: { ...VENT, parteMarco: 'madera', pisos: [{ largo: fracciones(6), corto: [0.3, 0.7], ancho: 1.1, alto: 1.4, dintel: 2.4 }] },
    fuente: `vanos sueltos de ~1,1 × 1,4 m (Street View 177 y 176: una por crujía, marco oscuro); seis por cara larga y dos por extremo SUPUESTO; el marco oscuro va con la madera del 106 («Dark stained roof timber», pulido). ${fuenteSV(sv, 'celosias_ventanas')}` };
  p.puertas = { valor: { largo: [0.5], ancho: 1.2, alto: 2.1 }, fuente: 'una puerta al centro de cada cara larga, SUPUESTO (Street View 179: «escalera de ladrillo y rampa al centro»). No se modelan la escalera ni la rampa' };
  colores(sv, p);
  return p;
}

// ---- módulo 13: bloque de oficinas de dos pisos (calle Luis Bonilla, 112 a 125) ----
const BO = { base: 0.3, piso: 2.9, vuelo: 0.8, pendiente: 14 };
function parametrosBonilla(sv, polyOSM, r) {
  const p = {}, K = BO, E = ejes(polyOSM), v = K.vuelo;
  p.muros = { valor: rectEjes(E, -E.L / 2 + v, E.L / 2 - v, E.W - 2 * v).map((q) => q.map(r3)), largo: r2(E.L - 2 * v), ancho: r2(E.W - 2 * v),
    fuente: `caja de OSM ${nf(E.L)} × ${nf(E.W)} m tomada como borde del techo (vista aérea, Esri World Imagery, solo mirada: en 114 y 116 el techo llena la caja); muros ${nf(v)} m adentro, SUPUESTO ±0,3 m` };
  p.base = { valor: K.base, fuente: 'losa algo levantada (Street View 114: dos escalones a la puerta); 0,3 m SUPUESTO' };
  p.pisos = { valor: [K.piso, K.piso], fuente: `dos pisos (Street View 112, 113, 114, 116: «2»); 2,9 m cada uno SUPUESTO, comprobado contra ${ob90(r)}` };
  p.techo = { valor: { forma: 'dos aguas', pendiente: K.pendiente, vuelo: v, vueloHastial: 1.0, espesor: 0.12 },
    fuente: `dos aguas de pendiente baja con hastial y el alero volado en el extremo (Street View 114: el hastial derecho con tornapuntas; 112, 116: «alero inclinado en el extremo»; la vista aérea de 114 muestra la cumbrera a lo largo). Pendiente ${nf(K.pendiente)}° SUPUESTA. ${fuenteSV(sv, 'forma_techo')}; ${fuenteSV(sv, 'material_techo')}` };
  p.tornapuntas = { valor: { paso: 2.4, techo: false, hastial: /tornapuntas/.test(campo(sv, 'forma_techo')?.valor ?? '') }, fuente: 'tornapuntas en el alero del hastial donde el inventario las ve (114, 116); sección SUPUESTA' };
  const banda = /bandas/.test(campo(sv, 'celosias_ventanas')?.valor ?? '');
  p.ventanas = { valor: { ...VENT, pisos: [{ largo: fracciones(banda ? 7 : 8), corto: [0.5], ancho: banda ? 2.4 : 1.1, alto: 1.2, dintel: 2.3 }] },
    fuente: `${banda ? 'bandas continuas de ventanas (116: «bandas continuas en los dos pisos»; aquí como ventanas de 2,4 m pegadas)' : 'vanos sueltos de unos 1,1 × 1,2 m (Street View 114: ocho por piso en la fachada larga, marco claro)'}; posiciones SUPUESTAS. ${fuenteSV(sv, 'celosias_ventanas')}` };
  p.puertas = { valor: { largo: [0.5], ancho: 1.0, alto: 2.1 }, fuente: 'una puerta al centro de la fachada (112: «central en la fachada a la calle»), SUPUESTA en las demás. No se modelan las escaleras metálicas exteriores (113, 114) ni la marquesina del 112' };
  colores(sv, p);
  return p;
}

// ---- módulo 9: nave de lámina a dos aguas (243 a 248A, patio de la calle Carlos Lara y sueltas) ----
// La altura del muro sale de Open Buildings: muro = p90 menos lo que sube el techo, entre 3 y 7 m, solo en las «naves altas»; en las de
// un piso común, 3,0 m SUPUESTO.
const NA = { vuelo: 0.6, vueloHastial: 0.3, pendiente: 14 };
function parametrosNave(sv, polyOSM, r) {
  const p = {}, K = NA, S = simplificar(polyOSM), R = S.length === 4 ? S : rectanguloMinimo(S), E = ejes(R), v = K.vuelo, vh = K.vueloHastial;
  const W = E.W - 2 * v, sube = (W / 2 + v) * Math.tan(K.pendiente * rad), pisosSV = campo(sv, 'pisos')?.valor ?? '';
  const altaSV = /alta|alto|doble/.test(pisosSV), h = altaSV ? Math.min(7, Math.max(3, (OB(r).p90 ?? 0) - sube - 0.15)) : 3.0;
  p.muros = { valor: rectEjes(E, -E.L / 2 + vh, E.L / 2 - vh, W).map((q) => q.map(r3)), largo: r2(E.L - 2 * vh), ancho: r2(W),
    fuente: `${S.length === 4 ? 'caja' : `rectángulo mínimo (huella de ${S.length} vértices)`} de OSM ${nf(E.L)} × ${nf(E.W)} m tomada como borde del techo; muros ${nf(v)} m adentro en los lados largos y ${nf(vh)} m en los hastiales (Street View 244, 245, 246: «alero volado en el lado largo»; SUPUESTO ±0,3 m). En la vista aérea de 244 el techo mide lo mismo que OSM, corrido unos 5 m (la imagen y OSM no calzan)` };
  p.base = { valor: 0.15, fuente: 'sobre losa (Street View 244, 245, 246: «sobre losa»)' };
  p.pisos = { valor: [r2(h)], fuente: altaSV ? `nave alta (Street View: «${pisosSV}»): muro = ${ob90(r)} menos lo que sube el techo (${nf(sube)} m), entre 3 y 7 m` : `un piso (Street View: «${pisosSV || 'sin dato'}»): muro de 3,0 m SUPUESTO` };
  p.techo = { valor: { forma: 'dos aguas', pendiente: K.pendiente, vuelo: v, vueloHastial: vh, espesor: 0.1, lamina: true },
    fuente: `dos aguas de lámina con hastial en el lado corto (Street View 243, 244, 245, 246; vista aérea de 244: cumbrera a lo largo). Pendiente ${nf(K.pendiente)}° SUPUESTA. Lámina ondulada en el detalle alto (pulido, ondas de 7,6 cm en el sombreado, SUPUESTAS: el perfil común de lámina ondulada). ${fuenteSV(sv, 'forma_techo')}` };
  p.ventanas = { valor: { ...VENT, pisos: [{ largo: [0.2, 0.8], corto: [], ancho: 1.2, alto: 1.0, dintel: Math.min(h - 0.4, 2.4) }] }, fuente: 'pocos vanos (Street View 244: «vanos sueltos»; 246: «pocos vanos»); dos por cara larga SUPUESTO' };
  p.puertas = { valor: { largo: [0.5], ancho: 3.0, alto: Math.min(h - 0.3, 3.2) }, fuente: 'portón metálico en el lado largo (Street View 245: «puerta enrollable»; 246: «portón corredizo»); 3,0 m de ancho SUPUESTO, en las dos caras largas' };
  colores(sv, p);
  return p;
}

// ---- módulo 8: kiosco o galera abierta (y los pabellones cerrados de un piso que el inventario juntó con ellos) ----
function parametrosAbierto(sv, polyOSM, r) {
  const p = {}, S = simplificar(polyOSM), R = S.length === 4 ? S : rectanguloMinimo(S), E = ejes(R);
  const t = campo(sv, 'forma_techo')?.valor ?? '', mat = campo(sv, 'material_techo')?.valor ?? '';
  const forma = /una sola agua|un agua/.test(t) ? 'una agua' : /plano/.test(t) ? 'plano' : /cuatro aguas/.test(t) ? 'cuatro aguas' : 'dos aguas';
  const teja = /teja/.test(mat), pend = forma === 'plano' ? 0 : forma === 'una agua' ? 8 : teja ? 25 : 15, v = forma === 'plano' ? 0.3 : 0.5;
  const textos = ['pisos', 'color_muros', 'galerias', 'rasgos_notables'].map((k) => campo(sv, k)?.valor ?? '').join(' · ');
  const abierto = /abiert|sin muros/.test(campo(sv, 'pisos')?.valor ?? '') || /sin muros/.test(campo(sv, 'color_muros')?.valor ?? '') || /kiosco abierto|cubierta abierta|galera abierta/.test(textos);
  // «cubierta alta» (1420857940): los postes llegan a Open Buildings p90 menos el techo; si no, 2,6 m SUPUESTO
  const altaSV = /alta/.test(campo(sv, 'pisos')?.valor ?? ''), h = altaSV ? Math.max(2.6, r2((OB(r).p90 ?? 0) - 0.4)) : 2.6;
  p.muros = { valor: rectEjes(E, -E.L / 2 + v, E.L / 2 - v, E.W - 2 * v).map((q) => q.map(r3)), largo: r2(E.L - 2 * v), ancho: r2(E.W - 2 * v),
    fuente: `${S.length === 4 ? 'caja' : `rectángulo mínimo (huella de ${S.length} vértices)`} de OSM ${nf(E.L)} × ${nf(E.W)} m tomada como borde del techo (vista aérea de 1000601269: el techo llena la caja); postes o muros ${nf(v)} m adentro, SUPUESTO` };
  p.base = { valor: 0.15, fuente: 'losa de concreto (Street View 248B: «losa de concreto»), 0,15 m SUPUESTO' };
  p.pisos = { valor: [h], fuente: altaSV ? `cubierta alta: postes de ${nf(h)} m, ${ob90(r)} menos 0,4 m de la losa del techo` : `un piso; ${abierto ? 'postes' : 'muro'} de 2,6 m SUPUESTO (${ob90(r)} con el techo encima)` };
  p.techo = { valor: { forma, pendiente: pend, vuelo: v, vueloHastial: v, espesor: 0.1 },
    fuente: `${forma} (${fuenteSV(sv, 'forma_techo')}); ${teja ? 'teja' : 'lámina'} (${fuenteSV(sv, 'material_techo')}); pendiente ${nf(pend)}° SUPUESTA` };
  p.abierto = abierto ? { valor: { poste: 0.25, paso: 3.0, murete: /murete/.test(textos) ? 0.6 : 0, bancas: /banca|mesa|gradería/.test(textos), parte: 'muro' },
    fuente: `abierto sobre postes o columnas (${textos}); postes de 0,25 m cada ~3 m SUPUESTOS${/murete/.test(textos) ? '; murete bajo de 0,6 m' : ''}${/banca|mesa|gradería/.test(textos) ? '; bancas de madera adentro (posición SUPUESTA)' : ''}` }
    : { valor: null, fuente: `cerrado: pabellón de un piso (${textos})` };
  if (!abierto) {
    p.ventanas = { valor: { ...VENT, pisos: [{ largo: fracciones(Math.max(1, Math.round(E.L / 4))), corto: [0.5], ancho: 1.1, alto: 1.1, dintel: 2.2 }] }, fuente: 'vanos sueltos cada ~4 m SUPUESTOS. ' + fuenteSV(sv, 'celosias_ventanas') };
    p.puertas = { valor: { largo: [0.5], ancho: 0.9, alto: 2.03 }, fuente: 'una puerta en la fachada larga SUPUESTA. ' + fuenteSV(sv, 'entrada') };
  }
  colores(sv, p);
  return p;
}

// ---- módulos 7 y 14: contemporáneos y torres (techo plano sobre la huella de OSM, cualquier forma) ----
// Cada uno es distinto: las piezas van por edificio (CONTEMP, con su fuente); la altura es siempre la p90 de Open Buildings.
const CONTEMP = {
  1202990397: { pisos: 3, plantaBaja: { alto: 4.0, retiro: 3.0 }, piel: { paso: 0.35, sale: 0.3, alto: 0.08, parte: 'teja', minLado: 2 }, pretil: { alto: 0.6 },
    fuente: 'La Plaza: volumen octogonal revestido de lamas color terracota sobre una arcada de un piso con locales (Street View, nov 2022: «volumen central alto … sobre una arcada de un piso»). Lamas con la teja del 106 (terracota); paso, vuelo y retiro de la arcada SUPUESTOS' },
  834058362: { pisos: 4, bandas: { antepecho: 0.9, alto: 1.6 }, piel: { paso: 0.45, sale: 0.6, alto: 0.06, minLado: 30 }, visera: { vuelo: 2.0, espesor: 0.35 },
    fuente: 'INDICASAT: lamas horizontales metálicas en toda la fachada larga y alero de techo muy volado (Street View: «parasoles horizontales en toda la fachada larga; alero de techo muy volado»). Pisos no se cuentan: 4 por la altura; lamas con el material metálico de la celosía del 106; paso, vuelo de la visera y de las lamas SUPUESTOS' },
  834058363: { pisos: 4, bandas: { antepecho: 1.0, alto: 1.2 }, visera: { vuelo: 1.5, espesor: 0.3 },
    fuente: 'SENACYT: cuatro pisos por filas de ventanas y techo plano con visera volada (Street View). No se modelan el volumen en voladizo de la esquina, las lamas verticales ni el plano azul' },
  834058361: { pisos: 2, plantaBaja: { alto: 4.5, retiro: 1.5 }, piel: { paso: 0.45, sale: 0.5, alto: 0.06, minLado: 30 }, visera: { vuelo: 1.2, espesor: 0.3 },
    fuente: 'Centro Nacional de Metrología: planta baja acristalada retranqueada, piso alto con lamas metálicas horizontales en la fachada larga y alero volado (Street View). Medidas SUPUESTAS' },
  353044693: { pisos: 2, pretil: { alto: 1.0 },
    fuente: 'COPA: volúmenes blancos de techo plano sin filas de ventanas claras (Street View). No se modelan el muro cortina de la esquina, el muro verde ni el volumen técnico' },
  387400202: { pisos: 2, bandas: { antepecho: 0.9, alto: 1.5 }, pretil: { alto: 0.8 },
    fuente: 'La Taberna del Canal: dos pisos, techo plano con pretil y bandas de ventanas en los dos pisos (Street View, nov 2022)' },
  678917548: { pisos: 1, muro: 'vidrio', columnas: { paso: 4.5, ancho: 0.6 }, mansarda: { alto: 1.6, retiro: 1.5, vuelo: 0.6 },
    fuente: 'Centro de Convenciones (184): una planta alta, vidrio oscuro entre columnas blancas de piso a faldón y faldón perimetral de teja tipo mansarda (Street View, desde unos 44 m); en la vista aérea el centro del techo es plano (Esri, solo mirada). Paso de columnas, alto, retiro y vuelo del faldón SUPUESTOS (pulido: el faldón vuela 0,6 m sobre el vidrio, como se ve en Street View; antes el muro lo tapaba). No se modelan el muro bajo en talud ni las palmas' },
  1203393924: { pisos: 3, plantaBaja: { alto: 3.5, retiro: 1.5 }, piel: { paso: 0.35, sale: 0.4, alto: 0.06, minLado: 3 },
    fuente: 'Dormitorios 157-158: planta baja de vidrio oscuro retranqueada bajo el volumen de arriba sobre columnas y una piel continua de lamas metálicas horizontales (Street View, de canto desde unos 60 m). Dos pisos sobre la planta baja SUPUESTOS («parecen 2»)' },
  // torres (módulo 14)
  353045673: { pisos: 8, balcones: { sale: 1.2, baranda: 'celosia' }, bandas: { antepecho: 1.0, alto: 1.3 },
    fuente: 'Canal View A: 8 pisos (LM, conocimiento del sitio, 2026-10-05); con Open Buildings (21 m) quedan 2,6 m por piso. Ventanas en banda con balcones de baranda metálica en cada piso (Street View, panorámica de usuario, may 2020). El inventario de Street View decía «al menos 9»: era un conteo dudoso en esa panorámica' },
  353045704: { pisos: 10, balcones: { sale: 1.2, baranda: 'celosia' }, bandas: { antepecho: 1.0, alto: 1.3 },
    fuente: 'Canal View B: diez pisos contados por los balcones del frente, techo plano (Street View); con Open Buildings quedan 2,5 m por piso' },
  358401792: { pisos: 6, balcones: { sale: 1.2, baranda: 'vidrio' }, bandas: { antepecho: 1.0, alto: 1.3 },
    fuente: 'Clayton Towers: ventanas en banda con balcones de vidrio y baranda (panorámica de usuario, may 2020: «al menos 6 visibles»); 6 pisos con Open Buildings (3,0 m por piso). No se modela la planta de estacionamiento detrás de la reja' },
  183921945: { pisos: 9, bandas: { antepecho: 1.0, alto: 1.3 },
    fuente: 'Holiday Inn: torre de 9 o 10 niveles (Street View, conteo dudoso); se toman 9. Va con techo plano: el techo de verdad es a dos aguas de pendiente baja con hastiales y cuerpos escalonados, y los pabellones bajos de teja de delante no se modelan; los balcones curvos de cada ventana tampoco (solo las bandas)' },
};
function parametrosContemporaneo(sv, polyOSM, r) {
  const p = {}, C = CONTEMP[r.osm_id] ?? { pisos: Math.max(1, Math.round((OB(r).p90 ?? 6) / 3.5)), pretil: { alto: 0.6 }, fuente: 'sin piezas propias: caja de techo plano con pretil (SUPUESTO)' };
  const alto = Math.max(3, OB(r).p90 ?? 6);
  p.muros = { valor: simplificar(polyOSM).map((q) => q.map(r3)), fuente: `huella de OSM tal cual (${simplificar(polyOSM).length} vértices), tomada como muro; en la vista aérea (Esri, solo mirada) la de 834058362 calza con el techo corrida unos metros` };
  p.alto = { valor: r2(alto), fuente: `del suelo más bajo bajo la huella al techo plano: ${ob90(r)}` };
  p.pisos = { valor: C.pisos, fuente: C.fuente };
  for (const k of ['plantaBaja', 'bandas', 'piel', 'visera', 'pretil', 'balcones', 'mansarda', 'columnas', 'muro']) if (C[k] !== undefined) p[k] = { valor: C[k], fuente: C.fuente };
  colores(sv, p);
  return p;
}

/** Casas del kit con techo de lámina azul gris en Street View (confianza alta o media): los faldones van con la lámina azul gris del
 *  contexto (panel, 5 oct 2026: 388106847), no con la teja del 106. */
function techoAzul(p, sv) {
  const c = campo(sv, 'color_techo');
  if (!c || !/azul/.test(c.valor ?? '') || !['alta', 'media'].includes(c.confianza) || !p.techo) return;
  p.techo = { ...p.techo, valor: { ...p.techo.valor, parte: 'laminaAzul' }, fuente: `${p.techo.fuente}. Lámina azul gris («Blue-gray metal roof sheet» de contexto.glb) por ${fuenteSV(sv, 'color_techo')}` };
  p.color_techo = { valor: c.valor, tinte: [1, 1, 1], fuente: `${fuenteSV(sv, 'color_techo')}: la lámina azul gris del contexto, sin tinte` };
}
/** Tapa de una caja gris con el color del techo observado (panel, 5 oct 2026): la parte del kit que más se le parece y, en la teja, el
 *  tinte de la palabra. Solo con confianza alta o media; si no, la caja queda gris. Nunca un gris parejo: la clase III de ?certeza=1
 *  es gris, así que el gris observado va con la lámina azul gris. */
function techoDeCaja(sv) {
  const c = campo(sv, 'color_techo'), w = (c?.valor ?? '').toLowerCase();
  if (!c || !['alta', 'media'].includes(c.confianza) || /^no visible/.test(w) || !w) return { valor: null, fuente: c ? `sin color de techo con confianza alta o media (${fuenteSV(sv, 'color_techo')}): queda la caja gris` : 'sin dato de Street View: queda la caja gris' };
  const lado = /^(blanco)/.test(w) ? { parte: 'muro', tinte: [1, 1, 1], como: 'el muro del 106 (blanco)' }
    : /^(gris|azul)/.test(w) ? { parte: 'laminaAzul', tinte: [1, 1, 1], como: 'la lámina azul gris del contexto' }
    : /^(pardo oscuro|pardo óxido|pardo)\b/.test(w) && !/rojizo/.test(w) ? { parte: 'teja', tinte: TINTE.techo['pardo oscuro'], como: 'la teja del 106 con el tinte «pardo oscuro»' }
    : { parte: 'teja', tinte: [1, 1, 1], como: 'la teja del 106 (rojo pardo)' };
  return { valor: { parte: lado.parte, tinte: lado.tinte }, fuente: `${fuenteSV(sv, 'color_techo')}: tapa plana sobre la caja gris de contexto.glb con ${lado.como}; tinte SUPUESTO por la palabra. La forma del techo no se modela` };
}

/** Aplica los ajustes a mano de un edificio (ciudad-ajustes.json): cada clave reemplaza el parámetro entero. */
function aplicarAjustes(e, aj) {
  if (!aj) return;
  for (const [k, v] of Object.entries(aj)) {
    if (k.startsWith('_') || k === 'numero') continue;
    if (k === 'modelo') { e.modelo = v.valor; e.modelo_fuente = v.fuente; continue; }
    if (k === 'tipologia') { e.tipologia = v.valor; e.tipologia_fuente = v.fuente; continue; }
    if (!e.parametros) continue;
    // «combinar»: cambia solo las claves dadas del valor (p. ej. el tipo de ventana) y suma la fuente del ajuste a la del parámetro
    const ant = e.parametros[k];
    e.parametros[k] = v.combinar && ant ? { ...ant, valor: { ...ant.valor, ...v.valor }, fuente: `${ant.fuente} Ajuste: ${v.fuente}`, ajuste: true } : { ...v, ajuste: true };
  }
  e.ajustado = true;
}

/** Todos los edificios del inventario con su modelo y, los del kit, sus parámetros. Determinista. */
export function datosCiudad() {
  const out = [];
  for (const r of INV.edificios) {
    const sv = svDe.get(r.osm_id), clave = sv?.tipologia_consolidada?.clave ?? null;
    const e = {
      osm_id: r.osm_id, numero: r.numero_cds, nombre: r.nombre, limite: r.limite, escena: r.escena,
      open_buildings: r.open_buildings, tipologia_sv: clave, clase_certeza: sv?.clase_certeza ?? 'III',
      clase_fuente: sv ? 'ciudad-observado.json (regla de la revisión del 4 oct 2026)' : 'sin ficha de Street View',
      modelo: r.modelado_hoy.tipo, modelo_fuente: 'contexto.mjs (como hoy)', tipologia: null,
    };
    if (r.limite === 'dentro' && SOPORTADAS.includes(clave) && r.osm_id !== 300885891) { e.tipologia = clave; e.modelo = 'kit'; e.modelo_fuente = 'tipología del kit soportada'; }
    const aj = AJUSTES[String(r.osm_id)];
    // los ajustes de modelo y tipología van primero (pueden sacar un edificio del kit o meterlo)
    if (aj?.modelo) { e.modelo = aj.modelo.valor; e.modelo_fuente = aj.modelo.fuente; }
    if (aj?.tipologia) { e.tipologia = aj.tipologia.valor; e.tipologia_fuente = aj.tipologia.fuente; }
    if (e.modelo === 'kit') {
      // «unir» (ajuste): un edificio que OSM dibuja en varios polígonos; la huella es la envolvente de todos
      const poly = aj?.unir ? envolvente([r.osm_id, ...aj.unir.valor].flatMap((id) => polyDe(id) ?? [])) : polyDe(r.osm_id);
      if (!poly) throw new Error(`sin huella para ${r.osm_id}`);
      if (PLANOS.includes(e.tipologia)) {
        e.parametros = parametrosContemporaneo(sv, poly, r);
        aplicarAjustes(e, aj);
        e.poly = e.parametros.muros.valor;
      } else if (CASAS.includes(e.tipologia)) {
        e.parametros = PARAMETROS_CASA[e.tipologia](sv, poly, r, aj);
        techoAzul(e.parametros, sv);
        aplicarAjustes(e, aj);
        e.poly = e.parametros.muros.valor;
      } else if (e.tipologia === 'duplex' || e.tipologia === 'oficiales41') {
        e.parametros = e.tipologia === 'duplex' ? parametrosDuplex(sv, poly) : parametrosOficiales(sv, poly, r.numero_cds);
        aplicarAjustes(e, aj);
        // casas de oficiales: el extremo de la cochera y el de la escalera, casa por casa donde se ven (ajustes cochera_en y escalera_en)
        const ce = e.parametros.cochera_en?.valor, ee = e.parametros.escalera_en?.valor, pb = e.parametros.planta_baja;
        if (e.tipologia === 'oficiales41' && (ce || ee)) e.parametros.planta_baja = { ...pb, valor: { ...pb.valor, cuarto: { ...pb.valor.cuarto, ...(ce ? { cocheraEn: ce } : {}) }, escaleras: { ...pb.valor.escaleras, ...(ee ? { en: ee } : {}) } },
          fuente: pb.fuente + (ce ? ` Cochera en el extremo ${ce}: ${e.parametros.cochera_en.fuente}.` : '') + (ee ? ` Escalera en el extremo ${ee}: ${e.parametros.escalera_en.fuente}.` : '') };
        e.poly = rectanguloCentrado(poly, ...e.parametros.planta.valor).map((p) => p.map(r3));
      } else {
        e.parametros = parametrosCuartel(e.tipologia, sv, poly);
        aplicarAjustes(e, aj);
        const P0 = simplificar(poly), ret = e.parametros.huella.retiro ?? 0;
        e.poly = (ret ? desplazar(P0, -ret) : P0).map((p) => p.map(r3));
      }
      const s = sueloHuella(e.poly);
      // la planta baja se apoya en el punto más bajo del terreno bajo la huella; del lado alto, el terreno tapa parte de ella
      e.suelo = { y0: r3(s.min), desnivel: r3(s.max - s.min), fuente: 'terreno de contexto.mjs (rejilla de 40 m sobre Copernicus GLO-30; −0,015 en el sitio): mínimo y máximo bajo la huella' };
      // casas sobre losa (sin planta baja abierta): la losa va a media altura entre el punto más bajo y el más alto del terreno bajo la
      // huella, y la plataforma de concreto baja hasta el más bajo. El terreno de la escena (rejilla de 40 m) no tiene las terrazas de los
      // lotes (CERL p. 6-16): con la losa en el máximo, la plataforma llegaba a 1,9 m; así no pasa de la mitad del desnivel, y del lado alto
      // el terreno tapa lo mismo
      if (CASAS.includes(e.tipologia) && !e.parametros.arcada?.valor) e.suelo = { ...e.suelo, y0: r3((s.min + s.max) / 2), yPie: r3(s.min), fuente: e.suelo.fuente + '; casa sobre losa: losa a media altura entre el mínimo y el máximo, plataforma hasta el mínimo' };
      // la copia reducida del 106 que el kit reemplaza (solo esas se esconden por número; las cajas grises se quitan por huella)
      e.en_contexto = enContexto.has(r.osm_id) && r.modelado_hoy?.tipo === 'cuartel106' ? enContexto.get(r.osm_id).num || null : null;
    } else if (aj) aplicarAjustes(e, aj);
    // las cajas grises (contexto.glb) llevan una tapa con el color del techo observado (ciudad.mjs; solo con la ciudad)
    if (e.modelo === 'maqueta') e.techo_caja = techoDeCaja(sv);
    out.push(e);
  }
  return out;
}
export const AJUSTES_LEIDOS = AJUSTES;
const PARAMETROS_CASA = { pabellon1: parametrosPabellon, nco49: parametrosNco, colonels: parametrosColonels, area900: parametrosArea900,
  crance: parametrosCrance, bloque2_bonilla: parametrosBonilla, nave: parametrosNave, abierto: parametrosAbierto };
export { MED };
