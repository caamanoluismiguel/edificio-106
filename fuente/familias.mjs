// Familias de piezas para la lectura «Diseño industrial»: escribe datos/familias.json, que asigna cada pieza de los GLB del
// edificio (clave de estado.json: «material|triángulos|caja en cm») a una familia con nombre y sistema. No toca ningún GLB.
//
//   cd fuente && node familias.mjs                  escribe ../datos/familias.json e imprime la cobertura por GLB
//   node familias.mjs --divisor=<edificio_piezas.glb>   otra ruta para el GLB de D.I.Visor (por defecto, el clon del repo
//                                                       público github.com/caamanoluismiguel/di-visor, carpeta divisor fuera del repo;
//                                                       avisa si su md5 no es el de la versión usada)
//
// Método (el mismo de estado.mjs, para que las claves coincidan):
//   1. Separa cada GLB del edificio en piezas: componentes conexas de triángulos de un mismo material, con los vértices unidos
//      a 0,5 mm, y su caja en el mundo redondeada a 1 cm. Comprueba que la lista de claves es idéntica a la de
//      estado/estado.json; si no lo es, se niega a escribir (la foto y los GLB no coinciden).
//   2. Separa igual el GLB de D.I.Visor (edificio_piezas.glb, exportado del .blend v016) y empareja cada componente suya con
//      la pieza de main que tiene la misma caja a 1,5 cm o menos. Ese GLB es solo FUENTE DE NOMBRES: su geometría no se usa.
//      Casan las 2.952 componentes de D.I.Visor (2.947 a 5 mm o menos, las 5 restantes entre 1 y 1,5 cm). Los nombres del
//      .blend se revisaron uno por uno contra material y medidas (INVENTARIO de D.I.Visor, docs/INVENTARIO.md del repo
//      di-visor): varios se corrigen abajo, en FAMILIAS, y «service door» se parte en dos familias.
//   3. Lo que no tiene gemela en D.I.Visor (barandas corregidas, pórtico, entrada, entorno) se asigna por regla de material y
//      posición (REGLAS, abajo), siempre a partir de la geometría de main. Una pieza de cubiertas_movil o cubiertas_sombra que
//      no tiene gemela toma la familia de su par en otro GLB del edificio (mismo material, caja a 1,5 cm).
//   4. La teja (canales y cobijas, «Clay terracotta 00…08» de 1,5 m o menos de largo) NO va pieza por pieza: son unas 95.000
//      claves entre cubiertas, cubiertas_movil, cubiertas_sombra y entrada. Va como regla en la familia «teja». La cumbrera y
//      las limas (las mismas tejas, de más de 1,5 m) van por clave en «cumbrera».
//   5. Familias nuevas, medidas en main: hoja_guillotina (la hoja de abajo de cada ventana con tres travesaños: sus paños de
//      vidrio y el travesaño del medio, con el recorrido hasta el travesaño de arriba), puerta_parda y puerta_principal (hojas,
//      canto de bisagra y sentido en que abre la hoja).
//
// Coordenadas de la escena en metros: +X = noreste, +Z = sureste, Y arriba. Muro SE en z 11,50, muro NO en z −11,50, testeros
// NE en x 22,45 y SO en x −22,45.
//
// Formato de datos/familias.json (además de los campos del contrato: version, origen.git, origen.estado, sistemas,
// familias.<id>.{nombre, sistema, n} y piezas):
//   origen.divisor            { archivo, md5 } del GLB de D.I.Visor del que salen los nombres.
//   origen.tolerancia_m       número: tolerancia de caja del emparejamiento con D.I.Visor (0,015 m).
//   familias.<id>.n           número de piezas de la familia en los GLB de escritorio (arquitectura, ventanas, detalles,
//                             cubiertas, sitio y entrada; sin cubiertas_movil ni cubiertas_sombra). La teja cuenta por su
//                             regla.
//   familias.<id>.nClaves     número de claves de la familia en «piezas», en los 8 GLB (una pieza repetida en cubiertas,
//                             cubiertas_movil y cubiertas_sombra con la misma clave cuenta una vez). La teja: 0.
//   familias.<id>.blend       [texto]: los nombres del .blend v016 que forman la familia (solo trazabilidad; puede faltar).
//   familias.<id>.nota        texto: aviso sobre la familia (puede faltar).
//   familias.teja.regla       { material: expresión regular sobre el nombre del material, glb: [GLB donde vale],
//                             largoMaxM: lado mayor de la caja en m, largoMaxNoAplicaEn: [GLB donde no se mira el largo],
//                             nota }. Vale solo para las claves que NO están en «piezas»: se busca primero en «piezas».
//   familias.hoja_guillotina.ventanas[]   una por ventana con hoja (111):
//       fachada 'SE'|'NO'|'NE'|'SO'; piso 1|2|3; alto y ancho del vano en m; piezas [todas las claves que se mueven en la
//       ventana: el travesaño del medio y los paños de vidrio bajo él]; recorrido (m, de la cara de arriba del travesaño del
//       medio a la cara de abajo del de arriba; el mismo para las hojas de la ventana); conRiel (m, de la cara de arriba del
//       travesaño de abajo a la del medio: alto de la hoja con su riel); eje [0, 1, 0] (la hoja sube en +Y); tope (y en m de
//       la cara de abajo del travesaño de arriba); travesano (clave del travesaño del medio);
//       corte: null en las ventanas de una columna; en las de dos, { eje 'x'|'z', en (m, coordenada del eje del parteluz),
//       parteluz (clave) }: el travesaño del medio es UNA pieza en el GLB y se parte con un plano perpendicular a ese eje;
//       hojas[]: una por columna (199 en total), { pano (clave del paño de abajo), piezas [pano, travesano],
//       tramo { eje, desde, hasta } (m: el tramo del travesaño que sube con esta hoja) }.
//   familias.hoja_guillotina.sinHoja[]    ventanas sin travesaño del medio (2): fachada, piso, alto, ancho, travesanos.
//   familias.puerta_parda.hojas[], familias.puerta_principal.hojas[]   una por pieza de hoja:
//       fachada; piezas [claves que giran: la hoja y su tirador si lo hay]; alto y ancho en m; y [abajo, arriba] en m;
//       hacia [x, y, z] vector unitario del sentido en que abre la hoja (al interior en la principal,
//       al exterior en las pardas); nHojas (hojas que se dibujan con esa pieza: 1 o 2); bisagra
//       [{x, z}]: lista de ejes de bisagra en m, uno por hoja (vacía si no hay dato); certeza_bisagra texto; hojas_modelo (número) y
//       hojas_foto (número, o null si ninguna foto lo confirma) solo en las pardas de servicio.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.resolve(AQUI, '..');
const SALIDA = path.join(RAIZ, 'datos', 'familias.json');
const ESTADO = path.join(AQUI, 'estado', 'estado.json');
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const DIVISOR = arg('divisor') ?? path.join(os.homedir(), 'projects', 'divisor', 'modelo', 'edificio_piezas.glb');
const GLBS = ['arquitectura', 'ventanas', 'detalles', 'cubiertas', 'cubiertas_movil', 'cubiertas_sombra', 'sitio', 'entrada'];
const TOL = 0.015;   // m: la caja de D.I.Visor y la de main casan a 1,5 cm o menos (2.947 de 2.952 a 5 mm)
const DIVISOR_MD5 = '783572f1861fce7074d695499e34addc';   // edificio_piezas.glb de di-visor usado para estos nombres

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
try { io.registerDependencies({ 'draco3d.decoder': await createRequire(import.meta.url)('draco3dgltf').createDecoderModule() }); } catch { /* sin draco */ }
const cm = (x) => Math.round(x * 100);
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');

/** Piezas de un GLB con el algoritmo de estado.mjs (piezas()), más el nombre del nodo y la caja sin redondear. */
async function piezas(archivo) {
  const doc = await io.read(archivo), out = [];
  for (const nd of doc.getRoot().listNodes()) {
    const m = nd.getMesh(); if (!m) continue;
    const W = nd.getWorldMatrix();
    for (const p of m.listPrimitives()) {
      const mat = p.getMaterial()?.getName() ?? '(sin material)';
      const A = p.getAttribute('POSITION'), nv = A.getCount(), P = new Float64Array(nv * 3), e = [0, 0, 0];
      for (let i = 0; i < nv; i++) { A.getElement(i, e); for (let k = 0; k < 3; k++) P[3 * i + k] = W[k] * e[0] + W[4 + k] * e[1] + W[8 + k] * e[2] + W[12 + k]; }
      const I = p.getIndices()?.getArray() ?? Uint32Array.from({ length: nv }, (_, i) => i);
      const clave = new Map(), vid = new Int32Array(nv);
      for (let i = 0; i < nv; i++) {
        const k = `${Math.round(P[3 * i] * 2e3)},${Math.round(P[3 * i + 1] * 2e3)},${Math.round(P[3 * i + 2] * 2e3)}`;
        let v = clave.get(k); if (v === undefined) { v = clave.size; clave.set(k, v); } vid[i] = v;
      }
      const par = Int32Array.from({ length: clave.size }, (_, i) => i);
      const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
      for (let t = 0; t < I.length / 3; t++) { const a = f(vid[I[3 * t]]), b = f(vid[I[3 * t + 1]]), c = f(vid[I[3 * t + 2]]); par[a] = c; par[b] = c; }
      const C = new Map();
      for (let t = 0; t < I.length / 3; t++) {
        const r = f(vid[I[3 * t]]); let c = C.get(r);
        if (!c) { c = { n: 0, mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] }; C.set(r, c); }
        c.n++;
        for (let j = 0; j < 3; j++) { const v = I[3 * t + j]; for (let k = 0; k < 3; k++) { c.mn[k] = Math.min(c.mn[k], P[3 * v + k]); c.mx[k] = Math.max(c.mx[k], P[3 * v + k]); } }
      }
      for (const c of C.values()) out.push({ mat, nodo: nd.getName(), n: c.n, mn: c.mn, mx: c.mx, clave: `${mat}|${c.n}|${c.mn.map(cm).join(',')}|${c.mx.map(cm).join(',')}` });
    }
  }
  return out;
}

// ── Sistemas (contrato) ───────────────────────────────────────────────────────────────────────────────────────────────────
const SISTEMAS = { base: 'Base y suelo', estructura: 'Losas y cartelas', muros: 'Muros', ventanas: 'Ventanas y lamas',
  cubierta: 'Cubierta', accesos: 'Accesos', servicios: 'Instalaciones' };

// ── Familias: id → [nombre, sistema, nombres del .blend que la forman] ──────────────────────────────────────────────────
// Los nombres del .blend que no corresponden a la pieza (revisión contra material, medidas y el INVENTARIO de D.I.Visor) ya
// van corregidos aquí; el nombre de origen queda en «blend».
const FAMILIAS = {
  zocalo: ['Zócalo', 'base', ['Foundation']],
  bloque_calado: ['Bloque calado', 'base', ['Foundation vent recess', 'Foundation lattice corner']],
  pilar: ['Pilar expuesto', 'base', ['open-bay pier']],
  rejilla_galeria: ['Rejilla del frente de la galería', 'base', ['recessed plinth vent', 'rust brown vent slat']],
  franja_oscura: ['Franja oscura junto a la escalera SO', 'base', ['drainage recess', 'drainage concrete edge']],
  acera: ['Acera y camino', 'base', ['front access paving']],
  junta_acera: ['Línea de la acera', 'base', []],
  bordillo: ['Bordillo', 'base', []],
  calzada: ['Calzada', 'base', []],
  pintura_vial: ['Pintura vial', 'base', []],
  cesped: ['Césped', 'base', []],
  muro_curvo: ['Muro curvo del jardín', 'base', []],

  losa: ['Canto de losa', 'estructura', ['Floor slab']],
  piso_interior: ['Piso interior', 'estructura', ['floor plane']],
  cielorraso: ['Cielorraso', 'estructura', ['ceiling plane']],
  tarima_so: ['Tarima interior del extremo SO', 'estructura', ['far end raised interior threshold']],
  volumen_interior: ['Volumen interior supuesto', 'estructura', ['inferred core skirting end', 'inferred core skirting far_end', 'inferred core skirting rear', 'inferred core skirting street']],
  mensula: ['Ménsula', 'estructura', ['Photo-matched white haunch']],
  difusor: ['Difusor interior supuesto', 'estructura', ['Interior light strip']],

  muro: ['Muro', 'muros', ['solid wall']],
  moldura: ['Moldura bajo el alféizar', 'muros', ['continuous sill band']],
  faja_mediagua: ['Faja sobre la mediagua', 'muros', ['eave wall band']],

  vidrio: ['Paño de vidrio', 'ventanas', ['street individual pane', 'rear individual pane', 'end individual pane', 'far_end individual pane']],
  hoja_guillotina: ['Hoja de guillotina', 'ventanas', []],
  jamba: ['Jamba', 'ventanas', ['window jamb']],
  travesano: ['Travesaño', 'ventanas', ['window transom']],
  parteluz: ['Parteluz', 'ventanas', ['window mullion', 'window vent mullion']],
  alfeizar: ['Alféizar', 'ventanas', ['window sill']],
  lama_celosia: ['Lama de celosía', 'ventanas', ['window observed lower louvre', 'window lower louvre']],
  panel_ne: ['Tableros de la NE, piso 2', 'ventanas', ['window observed lower infill', 'window round board vent']],

  teja: ['Teja', 'cubierta', []],
  cumbrera: ['Cumbrera y limas', 'cubierta', ['Main ridge cap']],
  cabio: ['Cabio', 'cubierta', ['Exposed timber rafter']],
  tabla_frente: ['Frente del alero', 'cubierta', ['Level 1 tiled sunshade fascia', 'Level 2 tiled sunshade fascia', 'Main lower hipped roof fascia']],
  tablero_alero: ['Sofito del alero', 'cubierta', ['Level 1 tiled sunshade substrate', 'Level 2 tiled sunshade substrate', 'Main roof outer eave']],
  faldon: ['Faldón del techo principal', 'cubierta', ['Main roof upper hip']],
  faja_atico: ['Faja del ático', 'cubierta', ['Main roof continuous step fascia']],
  gablete: ['Gablete del ático', 'cubierta', ['Gabled roof monitor', 'Monitor bargeboard', 'vent central timber', 'vent cross timber']],
  mastil: ['Mástil del techo', 'cubierta', ['Roof antenna']],

  puerta_principal: ['Puerta principal', 'accesos', []],
  puerta_parda: ['Puerta parda', 'accesos', ['far-end brown door']],
  fondo_puerta: ['Fondo oscuro de la puerta principal', 'accesos', []],
  marco_puerta: ['Marco de puerta', 'accesos', ['Door slender frame', 'brown door jamb', 'brown door head']],
  tirador: ['Tirador', 'accesos', ['door handle']],
  escalon_servicio: ['Escalón de servicio', 'accesos', ['Brown access tread']],
  escalera_so: ['Escalera SO junto al muro', 'accesos', ['front stair brown tread', 'front stair white riser', 'white stair cheek']],
  escalera_puerta_so: ['Escalera de la puerta SO', 'accesos', ['quadrangle stair apron', 'quadrangle stair concrete', 'quadrangle stair tread']],
  escalera_trasera: ['Escalera trasera NO', 'accesos', ['rear replacement step']],
  galeria: ['Galería elevada', 'accesos', ['rear corridor base', 'rear corridor finish', 'rear corridor slab', 'end corridor finish', 'end corridor slab', 'white corridor plinth']],
  baranda_parda: ['Baranda parda', 'accesos', []],
  escalera_entrada: ['Escalera de la entrada', 'accesos', []],
  losa_entrada: ['Losa de la entrada', 'accesos', ['continuous ramp approach']],
  rampa: ['Rampa', 'accesos', ['ramp wall junction fillet']],
  baranda_entrada: ['Baranda de la entrada', 'accesos', []],
  murete: ['Murete de la escalera', 'accesos', []],
  columna_portico: ['Columna del pórtico', 'accesos', []],
  vigas_portico: ['Banda oscura del pórtico', 'accesos', []],
  letrero: ['Letrero «106»', 'accesos', ['Garden wayfinding blue header', 'Garden wayfinding panel', 'Garden wayfinding post']],

  condensadora: ['Condensadora', 'servicios', ['Condenser housing', 'Condenser fan recess', 'Condenser side grille']],
  cubretubos: ['Cubretubos de la condensadora', 'servicios', []],
  tubo_vertical: ['Tubo vertical', 'servicios', []],
  abrazadera: ['Abrazadera', 'servicios', ['Small pipe strap']],
  gabinete: ['Gabinete de servicio', 'servicios', ['Green utility transformer', 'Transformer raised lid', 'Utility cabinet cooling fin']],
  poste_luz: ['Poste de luz', 'servicios', []],
  soporte_bicicletas: ['Soporte de bicicletas', 'servicios', []],
};
// «service door» del .blend: 3 componentes pardas son puertas; la cuarta («Unlit interior walls», 2,08 m) es el fondo oscuro
// de la puerta principal de vidrio (INVENTARIO §4.21 a y b). Se resuelve por material.
const PARTIDAS = { 'service door': (c) => (/Brown painted/.test(c.mat) ? 'puerta_parda' : 'fondo_puerta') };
const DE_BLEND = new Map();
for (const [id, [, , nombres]] of Object.entries(FAMILIAS)) for (const n of nombres) DE_BLEND.set(n, id);

// ── Reglas para lo que no tiene gemela en D.I.Visor ─────────────────────────────────────────────────────────────────────
const C = (c, k) => (c.mn[k] + c.mx[k]) / 2, L = (c, k) => c.mx[k] - c.mn[k];
const largo = (c) => Math.max(L(c, 0), L(c, 1), L(c, 2));
const TEJA_GLB = ['cubiertas', 'cubiertas_movil', 'cubiertas_sombra', 'entrada'];
// en cubiertas_sombra las tejas se funden en manchas de más de 1,5 m: ahí no se mira el largo (la regla es aproximada)
const esTeja = (c, glb) => TEJA_GLB.includes(glb) && /^Clay terracotta \d\d$/.test(c.mat) && (glb === 'cubiertas_sombra' || largo(c) <= 1.5);
/** Familia por regla de material, GLB y posición, o null. Cada regla dice qué pieza del INVENTARIO es. */
function porRegla(c, glb) {
  const m = c.mat;
  if (esTeja(c, glb)) return 'teja';
  if (/^Clay terracotta \d\d$/.test(m) && glb !== 'cubiertas_sombra' && largo(c) > 1.5) return 'cumbrera';   // cumbrera (28,7 m) y limas
  if (glb === 'arquitectura' && /V014 neutral interior plaster/.test(m)) return 'volumen_interior';   // INVENTARIO §4.30
  if (glb === 'detalles') {
    if (m === 'Fresh cream trim' && L(c, 1) > 10) return 'tubo_vertical';                    // 12 tubos de 0,12 a 10,80 m (§4.19)
    if (m === 'Fresh cream trim' && c.mn[1] > 0.3 && c.mx[1] < 2.2 && L(c, 1) > 1.5) return 'cubretubos';   // 15, de 0,38 a 2,10 m (§4.27)
    if (C(c, 0) > 44) return 'letrero';                                                      // letras del poste de señalización (§4.26 b)
    if (/Galvanized guardrail/.test(m) && c.mn[0] > 37 && c.mx[0] < 38.1) return 'soporte_bicicletas';     // §4.31
    if (/Galvanized guardrail/.test(m) && c.mx[1] < 0.7) return 'condensadora';              // rejilla redonda, 5 anillos × 15 (§4.27)
    if (/Brown painted/.test(m)) return 'baranda_parda';                                     // pasamanos de los escalones de servicio (§4.22 b)
  }
  if (glb === 'sitio') {
    if (/Leafy grass/.test(m)) return 'cesped';
    if (/asphalt/.test(m)) return 'calzada';
    if (/Worn yellow kerb/.test(m)) return 'bordillo';
    if (/Road paint/.test(m)) return 'pintura_vial';
    if (/Painted soffits/.test(m)) return c.mn[1] > 5 ? 'poste_luz' : 'junta_acera';        // luminaria a 11,5 m; líneas cada 4 m en la acera
    if (/Concrete paving/.test(m)) return C(c, 0) > 45 && c.mx[1] > 0.3 && L(c, 0) < 1 ? 'poste_luz' : 'acera';   // base del poste
    if (/Galvanized guardrail/.test(m)) return 'poste_luz';                                  // §4.31
    if (m === 'Fresh cream trim' && c.n >= 300) return 'muro_curvo';                         // §4.31
    if (/Brown painted/.test(m)) return 'baranda_parda';                                     // galería y escaleras SO y NO (§4.23)
    if (/Warm lime/.test(m)) return 'muro';                                                  // muro de la planta baja SO
  }
  if (glb === 'entrada') {
    if (/106 sign/.test(m)) return 'letrero';
    if (/Window glass/.test(m)) return 'puerta_principal';                                   // 2 hojas de vidrio (§4.21 a)
    if (/Warm lime/.test(m)) return 'murete';
    if (/Dark stained roof timber/.test(m)) return 'vigas_portico';
    if (m === 'Fresh cream trim') {
      if (C(c, 2) > 16.2 && C(c, 2) < 16.3 && C(c, 0) > 21) return 'letrero';               // letras en la cara del letrero
      if (L(c, 0) > 5) return 'rampa';                                                       // bordillos laterales de la rampa
      return 'columna_portico';                                                              // basa, fuste y capitel × 3
    }
    if (/Galvanized guardrail/.test(m)) return c.n === 48 && L(c, 1) < 0.5 && C(c, 2) < 11.7 ? 'tirador' : 'baranda_entrada';
    if (/Pale cast concrete/.test(m)) {
      if (Math.min(L(c, 0), L(c, 2)) < 0.1) return 'baranda_entrada';                   // postes de 4 × 4 cm en el material del concreto
      if (c.mn[0] >= 11.6 && c.mx[0] <= 14 && c.mx[2] < 13.7) return 'escalera_entrada';     // 7 peldaños (§4.22 a)
      if (c.mn[1] < -0.01) return 'losa_entrada';
      return 'rampa';
    }
  }
  return null;
}

// ── Lectura ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const estado = JSON.parse(fs.readFileSync(ESTADO, 'utf8'));
const M = {};
for (const g of GLBS) {
  M[g] = await piezas(path.join(RAIZ, 'modelo', `${g}.glb`));
  const a = M[g].map((c) => c.clave).sort(), b = estado.archivos[`modelo/${g}.glb`]?.piezas ?? [];
  if (a.length !== b.length || a.some((x, i) => x !== b[i])) { console.error(`✗ modelo/${g}.glb no coincide con ${path.relative(RAIZ, ESTADO)}: rehaz la foto o revisa el GLB`); process.exit(1); }
}
const md5Divisor = md5(fs.readFileSync(DIVISOR));
if (md5Divisor !== DIVISOR_MD5) console.warn(`⚠ ${DIVISOR}: md5 ${md5Divisor}, no el de la versión usada (${DIVISOR_MD5}); revisa los nombres antes de comitear`);
const DI = (await piezas(DIVISOR)).map((c) => ({ ...c, blend: c.nodo.replace(/[._ ]\d+$/, '').trim() }));
const todos = GLBS.flatMap((g) => M[g].map((c) => ({ ...c, glb: g })));

// ── 1. Gemelas de D.I.Visor ──────────────────────────────────────────────────────────────────────────────────────────────
const dif = (a, b) => Math.max(...[0, 1, 2].flatMap((k) => [Math.abs(a.mn[k] - b.mn[k]), Math.abs(a.mx[k] - b.mx[k])]));
const celda = (c) => [0, 1, 2].map((k) => Math.floor(C(c, k) / 0.5));
const idx = new Map();
for (const c of todos) { const k = celda(c).join(); (idx.get(k) ?? idx.set(k, []).get(k)).push(c); }
const cerca = (c) => { const b = celda(c), out = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) out.push(...(idx.get([b[0] + i, b[1] + j, b[2] + k].join()) ?? [])); return out; };
const familia = new Map(), origen = new Map();   // clave → id; clave → 'blend' | 'par' | 'regla'
const asignar = (clave, id, como) => {
  const antes = familia.get(clave);
  if (antes && antes !== id) throw new Error(`clave en dos familias: ${clave} (${antes}, ${id})`);
  familia.set(clave, id); origen.set(clave, como);
};
let sinGemela = 0, distintoMaterial = 0;
const sinNombre = new Set();
for (const d of DI) {
  let mejor = null, dm = Infinity;
  for (const c of cerca(d)) { const x = dif(c, d); if (x < dm) { dm = x; mejor = c; } }
  if (!mejor || dm > TOL) { sinGemela++; continue; }
  if (mejor.mat !== d.mat) distintoMaterial++;
  const id = PARTIDAS[d.blend]?.(mejor) ?? DE_BLEND.get(d.blend);
  if (!id) { sinNombre.add(d.blend); continue; }
  // las gemelas son de la misma caja: todas las piezas de main con esa caja y material (en GLB distintos) toman la familia
  for (const c of cerca(d)) if (dif(c, d) <= TOL && c.mat === mejor.mat && c.n === mejor.n) asignar(c.clave, id, 'blend');
}
if (sinNombre.size) { console.error('✗ familias del .blend sin id:', [...sinNombre].join(', ')); process.exit(1); }

// ── 2. Pares entre GLB del edificio (cubiertas, cubiertas_movil, cubiertas_sombra) ───────────────────────────────────────
for (const c of todos) {
  if (familia.has(c.clave) || esTeja(c, c.glb)) continue;
  const par = cerca(c).find((o) => familia.has(o.clave) && o.mat === c.mat && dif(o, c) <= TOL);
  if (par) asignar(c.clave, familia.get(par.clave), 'par');
}
// ── 3. Reglas ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const sinFamilia = [];
for (const c of todos) {
  if (familia.has(c.clave)) continue;
  const id = porRegla(c, c.glb);
  if (id === 'teja') continue;                                  // va por regla de familia, no pieza por pieza
  if (id) asignar(c.clave, id, 'regla'); else sinFamilia.push(c);
}

// ── 4. Hoja de guillotina ────────────────────────────────────────────────────────────────────────────────────────────────
// Una ventana = un alféizar. Sus piezas: las de ventana cuyo centro cae dentro del ancho del alféizar, a menos de 0,6 m de su
// plano y de su cara de arriba a 1,9 m más arriba. La hoja de abajo: los paños de vidrio bajo el travesaño del medio y ese
// travesaño (el riel de encuentro). Recorrido: de la cara de arriba del travesaño del medio a la cara de abajo del de arriba.
// El parteluz, las jambas y las lamas quedan fijos (el modelo no trae marco de hoja).
const r3 = (x) => Math.round(x * 1000) / 1000;
const FAMV = new Set(['vidrio', 'jamba', 'travesano', 'parteluz', 'lama_celosia', 'panel_ne']);
const ventanas = [];
for (const s of todos.filter((c) => familia.get(c.clave) === 'alfeizar').sort((a, b) => a.clave < b.clave ? -1 : 1)) {
  const enX = L(s, 0) > L(s, 2), u = enX ? 0 : 2, w = enX ? 2 : 0;
  const fachada = enX ? (C(s, 2) > 0 ? 'SE' : 'NO') : (C(s, 0) > 0 ? 'NE' : 'SO');
  const y0 = s.mx[1];
  const partes = todos.filter((c) => FAMV.has(familia.get(c.clave)) && C(c, u) > s.mn[u] + 0.005 && C(c, u) < s.mx[u] - 0.005
    && Math.abs(C(c, w) - C(s, w)) < 0.6 && C(c, 1) > y0 - 0.05 && C(c, 1) < y0 + 1.9);
  const tr = partes.filter((c) => familia.get(c.clave) === 'travesano').sort((a, b) => a.mn[1] - b.mn[1]);
  const jb = partes.filter((c) => familia.get(c.clave) === 'jamba');
  const v = { fachada, piso: y0 < 4 ? 1 : y0 < 8 ? 2 : 3, alto: r3(Math.max(...jb.map((j) => j.mx[1])) - Math.min(...jb.map((j) => j.mn[1]))),
    ancho: r3(s.mx[u] - s.mn[u] - 0.04), travesanos: tr.length };
  if (tr.length === 3) {
    const [abajo, medio, arriba] = tr;
    const panos = partes.filter((c) => familia.get(c.clave) === 'vidrio' && C(c, 1) < medio.mn[1]).sort((a, b) => C(a, u) - C(b, u));
    // dos columnas: una hoja por columna; el travesaño del medio es UNA pieza en el GLB y se parte en el eje del parteluz
    const pl = panos.length > 1 ? partes.filter((c) => familia.get(c.clave) === 'parteluz' && C(c, u) > C(panos[0], u) && C(c, u) < C(panos[panos.length - 1], u)) : [];
    if (panos.length > 1 && (panos.length !== 2 || pl.length !== 1)) throw new Error(`ventana ${fachada} piso ${v.piso}: ${panos.length} paños y ${pl.length} parteluces`);
    const ejeU = u === 0 ? 'x' : 'z', corte = pl.length ? r3(C(pl[0], u)) : null;
    v.hoja = { piezas: [medio, ...panos].map((c) => c.clave).sort(), recorrido: r3(arriba.mn[1] - medio.mx[1]), conRiel: r3(medio.mx[1] - abajo.mx[1]),
      eje: [0, 1, 0], tope: r3(arriba.mn[1]), travesano: medio.clave,
      corte: corte === null ? null : { eje: ejeU, en: corte, parteluz: pl[0].clave },
      hojas: panos.map((c, i) => ({ pano: c.clave, piezas: [c.clave, medio.clave],
        tramo: { eje: ejeU, desde: i === 0 ? r3(medio.mn[u]) : corte, hasta: i === panos.length - 1 ? r3(medio.mx[u]) : corte } })) };
  }
  ventanas.push(v);
}
for (const v of ventanas) for (const k of v.hoja?.piezas ?? []) familia.set(k, 'hoja_guillotina');

// ── 5. Puertas ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// Sentido en que abre la hoja (lo informa el equipo del proyecto, 14 oct 2026): la principal abre hacia adentro, el contrario
// a la normal de su fachada; las pardas abren hacia afuera, la normal de su fachada. Cuántas hojas tienen las pardas no lo informa.
//   · puerta principal: dos hojas activas en abanico, cada una con la bisagra en su jamba (el canto más lejos del centro del
//     vano) y el tirador hacia el centro. Supuesto del tipo: en el modelo el tirador de la hoja este es una copia trasladada
//     de la oeste, sin reflejar, y por eso queda junto a la jamba;
//   · parda SE: una hoja (una foto de la SE la muestra con la manija del lado +x), bisagra en el canto SO (−x);
//   · pardas NO: dos hojas por el montante del centro (una foto lejana lo apoya, no lo confirma), bisagras en las jambas;
//   · parda SO: una hoja, bisagra en el canto opuesto al tirador del modelo.
const conFam = (id) => todos.filter((c) => familia.get(c.clave) === id);
const uniq = (l) => [...new Map(l.map((c) => [c.clave, c])).values()];
const puertas = [];
const tiradores = uniq(conFam('tirador'));
for (const p of uniq(conFam('puerta_parda')).concat(uniq(conFam('puerta_principal')))) {
  const enX = L(p, 0) > L(p, 2), u = enX ? 0 : 2, w = enX ? 2 : 0;
  const fachada = enX ? (C(p, 2) > 0 ? 'SE' : 'NO') : (C(p, 0) > 0 ? 'NE' : 'SO');
  const fuera = familia.get(p.clave) === 'puerta_parda' ? 1 : -1;   // pardas hacia afuera, principal hacia adentro
  const hacia = enX ? [0, 0, (C(p, 2) > 0 ? 1 : -1) * fuera] : [(C(p, 0) > 0 ? 1 : -1) * fuera, 0, 0];
  const t = tiradores.find((h) => C(h, u) > p.mn[u] - 0.02 && C(h, u) < p.mx[u] + 0.02 && Math.abs(C(h, w) - C(p, w)) < 0.2);
  const montantes = uniq(conFam('marco_puerta')).filter((m) => L(m, 1) > 2 && C(m, u) > p.mn[u] - 0.05 && C(m, u) < p.mx[u] + 0.05 && Math.abs(C(m, w) - C(p, w)) < 0.2).map((m) => r3(C(m, u))).sort((a, b) => a - b);
  const punto = (uv) => (enX ? { x: r3(uv), z: r3(C(p, 2)) } : { x: r3(C(p, 0)), z: r3(uv) });
  const id = familia.get(p.clave);
  const base = { familia: id, fachada, piezas: [p.clave], alto: r3(L(p, 1)), ancho: r3(L(p, u)), y: [r3(p.mn[1]), r3(p.mx[1])], hacia };
  if (id === 'puerta_principal') {
    const vano = uniq(conFam('puerta_principal')), centro = (Math.min(...vano.map((h) => h.mn[u])) + Math.max(...vano.map((h) => h.mx[u]))) / 2;
    const bis = Math.abs(p.mn[u] - centro) > Math.abs(p.mx[u] - centro) ? p.mn[u] : p.mx[u];
    if (t) base.piezas.push(t.clave);
    puertas.push({ ...base, nHojas: 1, bisagra: [punto(bis)], certeza_bisagra: 'supuesto del tipo: abanico desde las jambas, las dos hojas activas' });
  } else if (t) {
    const bis = Math.abs(C(t, u) - p.mn[u]) > Math.abs(C(t, u) - p.mx[u]) ? p.mn[u] : p.mx[u];
    base.piezas.push(t.clave);
    puertas.push({ ...base, nHojas: 1, bisagra: [punto(bis)], certeza_bisagra: 'modelo: canto opuesto al tirador' });
  } else if (id === 'puerta_parda' && montantes.length === 3 && fachada === 'SE') {
    puertas.push({ ...base, nHojas: 1, hojas_modelo: 2, hojas_foto: 1, bisagra: [punto(p.mn[u])],
      certeza_bisagra: 'foto: una hoja, manija del lado +x y bisagra del lado SO; el ancho del modelo no está confirmado' });
  } else if (id === 'puerta_parda' && montantes.length === 3) {
    puertas.push({ ...base, nHojas: 2, hojas_modelo: 2, hojas_foto: null, bisagra: [punto(p.mn[u]), punto(p.mx[u])],
      certeza_bisagra: 'modelo: dos hojas por el montante del centro (una foto lejana lo apoya, no lo confirma); bisagras en las jambas: supuesto del tipo' });
  } else puertas.push({ ...base, bisagra: [], certeza_bisagra: 'sin dato' });
}
puertas.sort((a, b) => (a.familia + a.fachada + a.piezas[0] < b.familia + b.fachada + b.piezas[0] ? -1 : 1));

// ── Salida ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const n = Object.fromEntries(Object.keys(FAMILIAS).map((id) => [id, 0]));
const ESCRITORIO = ['arquitectura', 'ventanas', 'detalles', 'cubiertas', 'sitio', 'entrada'];   // el edificio que se carga en escritorio
for (const g of ESCRITORIO) for (const c of M[g]) { const id = familia.get(c.clave) ?? (esTeja(c, g) ? 'teja' : null); if (id) n[id]++; }
const vacias = Object.keys(n).filter((id) => !n[id]);
if (vacias.length) { console.error('✗ familias sin piezas:', vacias.join(', ')); process.exit(1); }
const familias = {};
for (const [id, [nombre, sistema, blend]] of Object.entries(FAMILIAS)) {
  familias[id] = { nombre, sistema, n: n[id], nClaves: [...familia.values()].filter((x) => x === id).length };
  if (blend.length) familias[id].blend = blend;
}
familias.teja.regla = { material: '^Clay terracotta \\d\\d$', glb: TEJA_GLB, largoMaxM: 1.5, largoMaxNoAplicaEn: ['cubiertas_sombra'],
  nota: 'canales y cobijas: van por regla, no en piezas; la regla vale solo para las claves que no están en piezas (la cumbrera y las limas sí están); en cubiertas_sombra las tejas se funden en manchas y la regla es aproximada' };
familias.losa_entrada.nota = 'la pieza «continuous ramp approach» (x 14,40 a 15,60; z 13,40 a 16,77; de 0 a 0,15 m) queda dentro de la losa de entrada.mjs (de −0,05 a 0,16 m) y probablemente no se ve';
familias.hoja_guillotina.ventanas = ventanas.filter((v) => v.hoja).map(({ fachada, piso, alto, ancho, hoja }) => ({ fachada, piso, alto, ancho, ...hoja }));
familias.hoja_guillotina.sinHoja = ventanas.filter((v) => !v.hoja).map(({ fachada, piso, alto, ancho, travesanos }) => ({ fachada, piso, alto, ancho, travesanos }));
familias.puerta_principal.nota = 'el tirador de la hoja este del modelo es una copia trasladada de la oeste, sin reflejar: queda a 0,16 m del canto de la hoja y a 0,22 m del eje del montante de la jamba; se dibuja con la bisagra en la jamba';
for (const id of ['puerta_parda', 'puerta_principal']) familias[id].hojas = puertas.filter((p) => p.familia === id).map(({ familia: _, ...p }) => p);
const piezasOrd = Object.fromEntries([...familia].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
// el commit que dejó los GLB como están (el último que tocó modelo/), no el HEAD de la rama: así no cambia con cada commit ajeno
const git = execFileSync('git', ['-C', RAIZ, 'log', '-1', '--format=%h', '--', 'modelo']).toString().trim();
const salida = { version: 1,
  origen: { git, estado: 'fuente/estado/estado.json', divisor: { archivo: 'edificio_piezas.glb', md5: md5Divisor }, tolerancia_m: TOL },
  sistemas: SISTEMAS, familias, piezas: piezasOrd };
fs.writeFileSync(SALIDA, JSON.stringify(salida) + '\n');

// ── Informe ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const cuenta = (l, f) => l.reduce((m, x) => m.set(f(x), (m.get(f(x)) ?? 0) + 1), new Map());
console.log(`D.I.Visor: ${DI.length} componentes, ${DI.length - sinGemela} con gemela en main a ≤ ${TOL * 100} cm (${distintoMaterial} con otro nombre de material)`);
console.log('Cobertura por GLB (con familia / piezas; la teja cuenta por su regla):');
for (const g of GLBS) {
  const l = M[g], con = l.filter((c) => esTeja(c, g) || familia.has(c.clave)).length, explicit = l.filter((c) => familia.has(c.clave)).length;
  console.log(`  ${g.padEnd(17)} ${String(con).padStart(6)} / ${String(l.length).padStart(6)}  ${(100 * con / l.length).toFixed(1)} %   (${explicit} por clave, ${l.filter((c) => esTeja(c, g) && !familia.has(c.clave)).length} teja por regla)`);
}
console.log('Sin familia:', sinFamilia.length);
for (const c of sinFamilia) console.log(`  ${c.glb} · ${c.clave}`);
const como = cuenta([...origen.values()], (x) => x);
console.log('Origen de la asignación:', [...como].map(([k, v]) => `${k} ${v}`).join(' · '), '· hoja_guillotina', [...familia.values()].filter((x) => x === 'hoja_guillotina').length);
console.log('Ventanas:', ventanas.length, '·', [...cuenta(ventanas, (v) => `${String(v.alto).replace('.', ',')} m con ${v.travesanos} travesaños`)].map(([k, v]) => `${v} de ${k}`).join(' · '));
console.log('Recorridos:', [...cuenta(ventanas.filter((v) => v.hoja), (v) => `${v.alto} → ${v.hoja.recorrido} (con riel ${v.hoja.conRiel})`)].map(([k, v]) => `${k} ×${v}`).join(' · '));
for (const p of puertas) console.log(`Puerta ${p.familia} ${p.fachada} ancho ${p.ancho} alto ${p.alto} bisagra ${JSON.stringify(p.bisagra)} hacia ${p.hacia}`);
console.log(`Escrito ${path.relative(RAIZ, SALIDA)}: ${Object.keys(familias).length} familias, ${Object.keys(piezasOrd).length} claves, ${fs.statSync(SALIDA).size} bytes`);
