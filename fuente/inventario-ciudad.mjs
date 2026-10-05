// Inventario maestro de los edificios de Ciudad del Saber (antiguo Fort Clayton) para reconstruirla entera en 3D.
//
//   cd fuente && node inventario-ciudad.mjs [--ruta=<archivo.md>]
//
// Escribe, siempre igual a partir de los datos guardados en el repositorio (no consulta nada en línea):
//   docs/ciudad/inventario.json        un registro por edificio, con lo que se sabe y los campos vacíos por llenar
//   docs/ciudad/inventario.md          resumen, tabla por número y lista de los edificios sin número
//   con --ruta=<archivo.md>, la lista para verificar cada edificio en Street View y a pie, calle por calle, con su enlace. Va fuera
//     del repo (decisión de LM, 5 oct 2026): el repo no guarda enlaces ni datos de Street View por edificio.
//   docs/ciudad/limite-propuesto.geojson   el límite de Ciudad del Saber que se usó (propuesto, ver abajo)
//
// Datos: fuente/osm-amplio.json (Overpass, base del 1 oct 2026; © colaboradores de OpenStreetMap, ODbL 1.0), fuente/osm.json
// (los vecinos que modela contexto.mjs), fuente/alturas_ob.json (Google Open Buildings 2.5D Temporal v1, 2023, CC BY 4.0).
// Coordenadas de la escena: las mismas que contexto.mjs y entorno-osm.mjs (aEscena + el registro de OSM al 106 que calcula
// contexto-osm.mjs). Cómo se modela hoy cada edificio: se leen las constantes de contexto.mjs (no se copian a mano).
//
// El límite. OpenStreetMap no tiene un polígono de Ciudad del Saber (consulta a Overpass del 4 oct 2026: hay «Clayton»
// residencial, bosques urbanos, el corregimiento de Ancón y parches de landuse, pero ningún landuse, amenity ni boundary con
// ese nombre). Se propone uno trazado sobre las calles de OSM:
//   · suroeste: la Avenida Omar Torrijos Herrera (vía 701195587 y su continuación al noroeste), unos metros hacia adentro;
//     al otro lado quedan la Finca de Tanques y la Planta de Miraflores (ACP);
//   · este: la Calle Aroldo Cano Arosemena (vías 1261986906 y 85687071) y, al norte de ella, el borde este del grupo de los 400
//     (Calle McIntosh, Calle Smith);
//   · norte: justo al norte de los edificios 248A y 389 y del grupo de Calle Smith;
//   · sur: la Calle Johnston y la Calle Alberto Constance, donde terminan los edificios con addr:city = «Ciudad del Saber».
// Decisión de LM (4 de octubre de 2026, CIUDAD-PLAN §14): el grupo residencial de la Calle Hill y la Calle Parke, al otro lado
// de la Calle Aroldo Cano Arosemena, ENTRA («dentro», con limite_motivo); los demás edificios de fuera del límite que parecen de
// Ciudad del Saber (addr:city «Ciudad del Saber» o un número de tres cifras; hoy solo Clayton Plaza) quedan como «fondo»: caja
// de fondo, sin tipología del kit.
//
// La tipología es una CONJETURA POR FORMA: sale solo del rectángulo orientado de la huella de OSM. La referencia de los
// cuarteles es Enscore et al. (2000), «Guarding the Gates: The Story of Fort Clayton», ERDC/CERL (DTIC ADA388262), PDF p. 96:
// los cuarteles del cuadrángulo «measured 61 x 141 ft» (18,6 × 43,0 m) y «this basic design was adopted for all barracks
// subsequently built at Fort Clayton». Ojo: la numeración del Ejército no es la de Ciudad del Saber.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aEscena, osmRegistrado, distanciaPoligonos, ID_106 } from './contexto-osm.mjs';
import { LAT, LON, EJE_LARGO } from './src/sol.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.join(AQUI, '..', 'docs', 'ciudad');
const R = 6378137, rad = Math.PI / 180;

// ---------------- límite propuesto (lat, lon), antihorario visto desde arriba ----------------
const LIMITE = [
  [8.99135, -79.57985],   // punta sur, junto a la avenida
  [8.99260, -79.57960],   // Calle Johnston (lado este)
  [8.99400, -79.57950],
  [8.99560, -79.57950],   // Calle Teófilo De La Torre
  [8.99650, -79.57930],   // empalme con la Calle Aroldo Cano Arosemena
  [8.99720, -79.57840],
  [8.99830, -79.57750],
  [8.99940, -79.57680],
  [9.00030, -79.57620],
  [9.00160, -79.57630],
  [9.00260, -79.57690],
  [9.00330, -79.57640],   // sigue al norte por el borde este del grupo de los 400
  [9.00470, -79.57580],
  [9.00620, -79.57560],
  [9.00760, -79.57560],   // esquina noreste (Calle Smith)
  [9.00770, -79.57800],
  [9.00720, -79.57990],   // al norte del 389
  [9.00640, -79.58280],
  [9.00620, -79.58450],
  [9.00710, -79.58700],
  [9.00820, -79.58840],   // al norte del 248A
  [9.00800, -79.59000],
  [9.00620, -79.59120],
  [9.00500, -79.59130],   // la avenida, al oeste del 228
  [9.00370, -79.58920],
  [9.00270, -79.58800],
  [9.00120, -79.58690],
  [8.99860, -79.58500],
  [8.99640, -79.58340],
  [8.99270, -79.58070],
];
const CALLES_BORDE = ['Calle Hill', 'Calle Parke'];   // su grupo de casas, fuera del límite, entra entero (decisión de LM)
const BORDE_MAX_M = 300;                              // y solo si está a menos de esto del límite
const MOTIVO_BORDE = 'Calle Hill o Calle Parke: fuera del límite trazado, entra por decisión de LM (4 de octubre de 2026)';
const MOTIVO_FONDO = 'fuera del límite trazado; queda como caja de fondo por decisión de LM (4 de octubre de 2026)';

// ---------------- lo que dice contexto.mjs (se lee su código, para no quedar desfasado) ----------------
const fuenteContexto = fs.readFileSync(path.join(AQUI, 'contexto.mjs'), 'utf8');
function constante(re, nombre) { const m = fuenteContexto.match(re); if (!m) throw new Error(`no encuentro ${nombre} en contexto.mjs`); return m; }
const TIPOLOGIA_106 = new Set(JSON.parse(constante(/const TIPOLOGIA_106 = new Set\((\[[^\]]*\])\)/, 'TIPOLOGIA_106')[1].replace(/'/g, '"')));
const LARGO_CUARTEL = JSON.parse(constante(/const LARGO_CUARTEL = (\{[^}]*\})/, 'LARGO_CUARTEL')[1].replace(/'/g, '"'));
const [, PISO, BASE] = constante(/const PISO = ([\d.]+), BASE = ([\d.]+)/, 'PISO y BASE').map(Number);
const NIVELES_SIN_DATO = +constante(/const NIVELES_SIN_DATO = (\d+)/, 'NIVELES_SIN_DATO')[1];
const OB_CUBRE = +constante(/const OB_CUBRE = ([\d.]+)/, 'OB_CUBRE')[1];
const IDS = Object.fromEntries([...constante(/const (ID_FUNDACION = .*);/, 'los ID de los vecinos')[1].matchAll(/ID_(\w+) = (\d+)/g)].map((m) => [+m[2], m[1]]));
const A_MANO = {
  FUNDACION: 'volumen propio: muros de 3 pisos a la altura del alero del 106, teja a cuatro aguas, 3 entradas sugeridas',
  CASA: 'La Casa: un piso, galería de columnas al noroeste y al noreste, teja a cuatro aguas (alturas estimadas en Street View)',
  INNOVA: 'Innova: nave blanca de cubierta plana (~11 m estimados), celosía de ladrillo, torre (~13 m) y ala baja (~4 m)',
  ATENEO: 'Teatro Ateneo: sala alta de muros blancos (~10 m estimados) con teja y cuerpo del frente de ~7 m',
};
if (!IDS[ID_106]) throw new Error('contexto.mjs ya no define ID_106 como antes');
for (const k of Object.keys(A_MANO)) if (!Object.values(IDS).includes(k)) throw new Error(`contexto.mjs ya no define ID_${k}`);

// ---------------- datos ----------------
const leer = (f) => JSON.parse(fs.readFileSync(path.join(AQUI, f), 'utf8'));
const amplio = leer('osm-amplio.json'), vecinos = leer('osm.json'), OB = leer('alturas_ob.json').edificios;
const enVecinos = new Map(vecinos.elements.filter((e) => e.type === 'way' && e.tags?.building).map((e) => [e.id, e]));
const { registro } = osmRegistrado();
const [rcx, rcz] = registro.centroOSM106, rth = registro.rotacionGrados * rad, rco = Math.cos(rth), rsi = Math.sin(rth);
/** lat, lon → (x, z) de la escena, con el registro de contexto-osm.mjs (el mismo de entorno-osm.mjs). */
const escena = (lat, lon) => { const [x, z] = aEscena(lat, lon), dx = x - rcx, dz = z - rcz; return [dx * rco - dz * rsi, dx * rsi + dz * rco]; };
/** lat, lon ↔ este-norte en metros desde el punto del sitio (la misma esfera de contexto-osm.mjs). */
const kE = rad * R * Math.cos(LAT * rad), kN = rad * R;
const aEN = ([lat, lon]) => [(lon - LON) * kE, (lat - LAT) * kN];
const aLL = ([E, N]) => [LAT + N / kN, LON + E / kE];

// ---------------- geometría (en metros este-norte) ----------------
function areaCentroide(P) {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length], c = x1 * y2 - x2 * y1; A += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c; }
  A /= 2; return { A: Math.abs(A), c: [cx / (6 * A), cy / (6 * A)] };
}
function envolvente(P) {
  const p = [...P].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cruz(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (hi.length >= 2 && cruz(hi.at(-2), hi.at(-1), q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
/** Rectángulo orientado de área mínima (por los lados de la envolvente): largo, ancho y rumbo del lado largo (0–180°). */
function cajaOrientada(P) {
  const H = envolvente(P); let mejor = null;
  for (let i = 0; i < H.length; i++) {
    const [x1, y1] = H[i], [x2, y2] = H[(i + 1) % H.length], L = Math.hypot(x2 - x1, y2 - y1); if (L < 1e-6) continue;
    const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, y] of H) { const a = x * ux + y * uy, b = -x * uy + y * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
    const area = (a1 - a0) * (b1 - b0);
    if (!mejor || area < mejor.area - 1e-9) mejor = { area, la: a1 - a0, lb: b1 - b0, ux, uy };
  }
  const largoEnU = mejor.la >= mejor.lb, [vx, vy] = largoEnU ? [mejor.ux, mejor.uy] : [-mejor.uy, mejor.ux];
  let az = Math.atan2(vx, vy) / rad; az = ((az % 180) + 180) % 180;               // rumbo desde el norte, eje sin sentido
  return { largo: Math.max(mejor.la, mejor.lb), ancho: Math.min(mejor.la, mejor.lb), azimut: az, area: mejor.area };
}
function dentro([x, y], P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; }
  return c;
}
/** Punto más cercano de un segmento a p, y su distancia. */
function cercanoSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  const q = [a[0] + t * dx, a[1] + t * dy]; return { q, d: Math.hypot(p[0] - q[0], p[1] - q[1]) };
}
/** Distancia de una polilínea a un polígono, con el punto de la polilínea donde se da. */
function lineaAPoligono(L, P) {
  let mejor = { d: Infinity, q: null };
  for (let i = 0; i + 1 < L.length; i++) {
    for (const v of P) { const r = cercanoSeg(v, L[i], L[i + 1]); if (r.d < mejor.d) mejor = r; }
    for (let k = 0; k < P.length; k++) for (const e of [L[i], L[i + 1]]) { const r = cercanoSeg(e, P[k], P[(k + 1) % P.length]); if (r.d < mejor.d) mejor = { d: r.d, q: e }; }
  }
  return mejor;
}
const distPuntoPoligono = (p, P) => Math.min(...P.map((a, i) => cercanoSeg(p, a, P[(i + 1) % P.length]).d));

// ---------------- vías para Street View ----------------
const AUTOS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service',
  'primary_link', 'secondary_link', 'tertiary_link']);
const vias = amplio.elements.filter((e) => e.type === 'way' && e.tags?.highway && AUTOS.has(e.tags.highway) && e.geometry
  && !['parking_aisle', 'driveway', 'drive-through'].includes(e.tags.service))
  .map((e) => {
    const L = e.geometry.map((g) => aEN([g.lat, g.lon]));
    const xs = L.map((p) => p[0]), ys = L.map((p) => p[1]);
    return { id: e.id, nombre: e.tags.name ?? '', tipo: e.tags.highway, L, caja: [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] };
  });
function viaMasCercana(P, soloConNombre = false) {
  const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), c = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let mejor = null;
  for (const v of vias) {
    if (soloConNombre && !v.nombre) continue;
    const gap = Math.max(0, v.caja[0] - c[1], c[0] - v.caja[1], v.caja[2] - c[3], c[2] - v.caja[3]);
    if (mejor && gap > mejor.d) continue;
    const r = lineaAPoligono(v.L, P);
    if (!mejor || r.d < mejor.d - 1e-9 || (Math.abs(r.d - mejor.d) < 1e-9 && v.id < mejor.v.id)) mejor = { ...r, v };
  }
  return mejor;
}

// ---------------- clasificación ----------------
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100, r6 = (x) => Math.round(x * 1e6) / 1e6;
function claseTamano(A) { return A < 100 ? 'XS (<100 m²)' : A < 300 ? 'S (100–300 m²)' : A < 1000 ? 'M (300–1.000 m²)' : A < 3000 ? 'L (1.000–3.000 m²)' : 'XL (≥3.000 m²)'; }
const CERL = { largo: 141 * 0.3048, ancho: 61 * 0.3048 };   // 42,98 × 18,59 m
function tipologia({ largo: L, ancho: W }, A) {
  const rect = A / (L * W), prop = L / W;
  const parecido = Math.abs(L - CERL.largo) / CERL.largo < 0.2 && Math.abs(W - CERL.ancho) / CERL.ancho < 0.3 && rect >= 0.85;
  let clase;
  if (L >= 38 && L <= 64 && W >= 15 && W <= 26 && prop >= 1.8 && rect >= 0.85) clase = 'barraca alargada tipo cuartel (como el 106)';
  else if (A < 60) clase = 'caseta o estructura menor';
  else if (rect < 0.75 && A >= 300) clase = 'forma compuesta (L, T, U o con patio)';
  else if (A >= 2500) clase = 'nave o edificio grande';
  else if (prop >= 2.5 && W <= 14) clase = 'bloque estrecho y alargado (tira de viviendas o pabellón)';
  else if (A < 250) clase = 'casa o pabellón pequeño';
  else clase = 'bloque rectangular mediano';
  return { clase, nota: 'conjetura por forma', rectangularidad: r2(rect), proporcion: r2(prop),
    parecido_cuartel_cerl_61x141ft: parecido };
}
function modeladoHoy(e, t) {
  const num = t['addr:housenumber'] ?? '', ob = OB[e.id], niv = t['building:levels'] ? +t['building:levels'] : null;
  if (e.id === ID_106) return { tipo: 'el 106 (modelo propio)', detalle: 'modelo/*.glb, hecho con fotos', altura_m: null, altura_fuente: 'modelo' };
  if (enVecinos.has(e.id)) {
    if (TIPOLOGIA_106.has(num)) return { tipo: 'cuartel106', detalle: `copia reducida del 106 colocada en la huella${LARGO_CUARTEL[num] ? `, estirada a ${LARGO_CUARTEL[num]} m de largo` : ''}`, altura_m: null, altura_fuente: 'la del 106' };
    if (A_MANO[IDS[e.id]]) return { tipo: 'a mano', detalle: A_MANO[IDS[e.id]], altura_m: null, altura_fuente: 'estimada en Street View (contexto.mjs)' };
    const usaOB = !niv && ob?.cubre >= OB_CUBRE;
    const h = usaOB ? ob.p90 : (niv ?? NIVELES_SIN_DATO) * PISO + BASE;
    return { tipo: 'maqueta', detalle: 'volumen gris de techo plano (vecinos de osm.json)', altura_m: r2(h),
      altura_fuente: usaOB ? 'Open Buildings p90' : niv ? `${niv} niveles de OSM` : `${NIVELES_SIN_DATO} niveles, sin dato` };
  }
  if ((e.geometry?.length ?? 0) > 3) {
    const usaOB = !niv && ob?.cubre >= OB_CUBRE;
    const h = niv ? niv * PISO + BASE : usaOB ? Math.max(ob.p90, 2.5) : NIVELES_SIN_DATO * PISO + BASE;
    return { tipo: 'maqueta', detalle: 'volumen gris de techo plano (entorno ampliado)', altura_m: r2(h),
      altura_fuente: niv ? `${niv} niveles de OSM` : usaOB ? 'Open Buildings p90 (mínimo 2,5 m)' : `${NIVELES_SIN_DATO} niveles, sin dato` };
  }
  return { tipo: 'sin modelar', detalle: 'huella de menos de 4 nodos', altura_m: null, altura_fuente: null };
}
function numeroCdS(t) {
  if (t['addr:housenumber']) return { numero: t['addr:housenumber'], fuente: 'addr:housenumber' };
  if (t.ref) return { numero: t.ref, fuente: 'ref' };
  const m = (t.name ?? '').match(/\b(?:Edificio|Edif\.?|Building|No\.?)\s*(\d{2,4}[A-Z]?)\b/i);
  if (m) return { numero: m[1], fuente: 'name' };
  return { numero: null, fuente: null };
}
const CLAVES_3D = ['building', 'building:levels', 'building:min_level', 'height', 'min_height', 'roof:shape', 'roof:levels', 'roof:height',
  'roof:colour', 'roof:material', 'roof:orientation', 'building:colour', 'building:material', 'colour', 'material', 'layer'];

// ---------------- registros ----------------
const LIM = LIMITE.map(aEN);
const P106 = [[-22.75, -11.5], [22.75, -11.5], [22.75, 11.5], [-22.75, 11.5]];   // el 106 del modelo en la escena (como contexto.mjs)
const avenida = vias.filter((v) => v.nombre === 'Avenida Omar Torrijos Herrera');
/** ¿Está al este (noreste) de la avenida? Por el lado de la vía más cercana de la avenida (producto cruz con su rumbo). */
function alEsteDeLaAvenida(p) {
  let mejor = null;
  for (const v of avenida) for (let i = 0; i + 1 < v.L.length; i++) { const r = cercanoSeg(p, v.L[i], v.L[i + 1]); if (!mejor || r.d < mejor.d) mejor = { ...r, a: v.L[i], b: v.L[i + 1] }; }
  if (!mejor) return true;
  let [dx, dy] = [mejor.b[0] - mejor.a[0], mejor.b[1] - mejor.a[1]]; if (dy < 0) { dx = -dx; dy = -dy; }   // rumbo hacia el norte
  return dx * (p[1] - mejor.a[1]) - dy * (p[0] - mejor.a[0]) < 0;                                       // a la derecha = este
}
const registros = [];
for (const e of amplio.elements) {
  const t = e.tags ?? {};
  if (e.type !== 'way' || !t.building || !e.geometry || e.geometry.length < 3) continue;
  const g = e.geometry.map((p) => [p.lat, p.lon]);
  if (g.length > 3 && Math.abs(g[0][0] - g.at(-1)[0]) < 1e-9 && Math.abs(g[0][1] - g.at(-1)[1]) < 1e-9) g.pop();
  const P = g.map(aEN), { A, c } = areaCentroide(P);
  const esCdS = t['addr:city'] === 'Ciudad del Saber' || /^\d{3}[A-Z]?(-\d{3})?$/.test(t['addr:housenumber'] ?? '');
  let limite = null, limiteMotivo = null;
  if (dentro(c, LIM)) limite = 'dentro';
  let via = null, viaNombrada = null;
  if (!limite && distPuntoPoligono(c, LIM) < BORDE_MAX_M && alEsteDeLaAvenida(c)) {
    via = viaMasCercana(P); viaNombrada = via?.v.nombre ? via : viaMasCercana(P, true);
    if (CALLES_BORDE.includes(viaNombrada?.v.nombre)) { limite = 'dentro'; limiteMotivo = MOTIVO_BORDE; }
    else if (esCdS) { limite = 'fondo'; limiteMotivo = MOTIVO_FONDO; }
  }
  if (!limite) continue;
  const ll = aLL(c), sc = escena(ll[0], ll[1]), Pesc = g.map(([la, lo]) => escena(la, lo));
  const caja = cajaOrientada(P), { numero, fuente } = numeroCdS(t), ob = OB[e.id];
  if (!via) { via = viaMasCercana(P); viaNombrada = via?.v.nombre ? via : viaMasCercana(P, true); }
  const vp = via ? aLL(via.q) : null;
  const rumbo = via ? ((Math.atan2(c[0] - via.q[0], c[1] - via.q[1]) / rad) + 360) % 360 : null;
  const tags3d = Object.fromEntries(CLAVES_3D.filter((k) => t[k] != null).map((k) => [k, t[k]]));
  let giro106 = ((caja.azimut - EJE_LARGO) % 180 + 180) % 180; if (giro106 > 90) giro106 -= 180;
  registros.push({
    osm_id: e.id,
    numero_cds: numero,
    numero_fuente: fuente,
    nombre: t.name ?? null,
    calle_osm: t['addr:street'] ?? null,
    addr_city: t['addr:city'] ?? null,
    limite,
    limite_motivo: limiteMotivo,
    tags_3d: tags3d,
    centroide: { lat: r6(ll[0]), lon: r6(ll[1]) },
    escena: { x: r1(sc[0]), z: r1(sc[1]) },
    area_m2: r1(A),
    clase_tamano: claseTamano(A),
    caja_orientada: { largo_m: r1(caja.largo), ancho_m: r1(caja.ancho), azimut_eje_largo_grados: r1(caja.azimut), giro_respecto_al_106_grados: r1(giro106) },
    vertices: P.length,
    open_buildings: ob ? { p50: ob.p50, p90: ob.p90, p99: ob.p99, cubre: ob.cubre } : null,
    distancia_106_m: r1(distanciaPoligonos(Pesc, P106)),
    distancia_centro_106_m: r1(Math.hypot(sc[0], sc[1])),
    modelado_hoy: modeladoHoy(e, t),
    tipologia: tipologia(caja, A),
    via_cercana: via ? { osm_id: via.v.id, nombre: via.v.nombre || null, tipo: via.v.tipo, distancia_m: r1(via.d),
      punto: { lat: r6(vp[0]), lon: r6(vp[1]) }, rumbo_hacia_el_edificio_grados: Math.round(rumbo),
      via_con_nombre: viaNombrada ? { osm_id: viaNombrada.v.id, nombre: viaNombrada.v.nombre, distancia_m: r1(viaNombrada.d) } : null } : null,
    // solo para la ruta (--ruta); no se escribe en inventario.json
    streetview: vp ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${vp[0].toFixed(6)},${vp[1].toFixed(6)}&heading=${Math.round(rumbo)}` : null,
    // por llenar en la verificación (Street View y a pie); fuente_cada_campo: { campo: 'Street View <fecha>' | 'a pie <fecha>' | ... }
    color_muros: null, color_techo: null, material_techo: null, forma_techo: null, aleros: null, mediaguas: null, celosias: null,
    pisos_verificados: null, fuente_cada_campo: {}, foto_streetview_fecha: null, notas: '',
  });
}
// orden: los numerados por número (parte numérica y sufijo), luego los demás por id
const claveNum = (n) => { const m = String(n).match(/^(\d+)(.*)$/); return m ? [+m[1], m[2]] : [Infinity, String(n)]; };
const ordenNum = (a, b) => {
  if (a.numero_cds && !b.numero_cds) return -1; if (!a.numero_cds && b.numero_cds) return 1;
  if (a.numero_cds && b.numero_cds) { const [x, s] = claveNum(a.numero_cds), [y, u] = claveNum(b.numero_cds); if (x !== y) return x - y; if (s !== u) return s < u ? -1 : 1; }
  return a.osm_id - b.osm_id;
};
registros.sort(ordenNum);

// ---------------- salida JSON y GeoJSON ----------------
fs.mkdirSync(DOCS, { recursive: true });
const base = amplio.osm3s?.timestamp_osm_base;
fs.writeFileSync(path.join(DOCS, 'inventario.json'), JSON.stringify({
  generado_por: 'fuente/inventario-ciudad.mjs',
  osm_base: base,
  fuentes: {
    osm: 'fuente/osm-amplio.json, © colaboradores de OpenStreetMap, ODbL 1.0',
    open_buildings: 'fuente/alturas_ob.json, Google Open Buildings 2.5D Temporal v1 (2023), CC BY 4.0; estimada desde satélite, ~1,5 m de error publicado',
    escena: 'aEscena + registro de contexto-osm.mjs (OSM girado y trasladado al 106 del modelo); +X al rumbo 56°, +Z al 146°',
    tipologia: 'conjetura por forma; referencia de cuartel: Enscore et al. 2000, ERDC/CERL, DTIC ADA388262, PDF p. 96 (61 x 141 ft)',
  },
  limite: 'propuesto (no existe en OSM), ver limite-propuesto.geojson y el encabezado del script; las calles Hill y Parke entran aunque queden fuera del polígono y lo demás de fuera es «fondo» (decisión de LM, 4 oct 2026)',
  total: registros.length,
  edificios: registros.map(({ streetview, ...r }) => r),
}, null, 1) + '\n');
fs.writeFileSync(path.join(DOCS, 'limite-propuesto.geojson'), JSON.stringify({
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: { nombre: 'Ciudad del Saber (límite propuesto, no oficial)', fuente: 'trazado sobre calles de OpenStreetMap por fuente/inventario-ciudad.mjs' },
    geometry: { type: 'Polygon', coordinates: [[...LIMITE, LIMITE[0]].map(([la, lo]) => [lo, la])] } }],
}, null, 1) + '\n');

// ---------------- inventario.md ----------------
const num = (x, d = 1) => { const s = Math.abs(x).toFixed(d).split('.'); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return (x < 0 ? '−' : '') + s.join(','); };
const cuenta = (lista, f) => { const m = new Map(); for (const r of lista) { const k = f(r); m.set(k, (m.get(k) ?? 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); };
const dentroL = registros.filter((r) => r.limite === 'dentro'), bordeL = registros.filter((r) => r.limite === 'fondo');
const hillParke = dentroL.filter((r) => r.limite_motivo === MOTIVO_BORDE);
const numerados = registros.filter((r) => r.numero_cds), sinNum = registros.filter((r) => !r.numero_cds);
const repetidos = cuenta(numerados, (r) => r.numero_cds).filter(([, n]) => n > 1);
const ordenTam = ['XS (<100 m²)', 'S (100–300 m²)', 'M (300–1.000 m²)', 'L (1.000–3.000 m²)', 'XL (≥3.000 m²)'];
const tablaCuenta = (titulo, filas) => `| ${titulo} | Dentro | Fondo | Total |\n|---|---:|---:|---:|\n` + filas.map((k) =>
  `| ${k[0]} | ${k[1](dentroL)} | ${k[1](bordeL)} | ${k[1](registros)} |`).join('\n');
const por = (f, v) => (L) => L.filter((r) => f(r) === v).length;
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|');
const fila = (r) => `| ${esc(r.numero_cds ?? '')} | ${esc(r.nombre ?? '')} | ${r.limite === 'dentro' ? (r.limite_motivo ? 'dentro (Hill/Parke)' : 'dentro') : 'fondo'} | ${num(r.area_m2, 0)} | ${num(r.caja_orientada.largo_m)} × ${num(r.caja_orientada.ancho_m)} | ${num(r.caja_orientada.azimut_eje_largo_grados, 0)}° | ${r.tags_3d['building:levels'] ?? ''} | ${r.open_buildings ? `${num(r.open_buildings.p90)} (${num(r.open_buildings.cubre * 100, 0)} %)` : ''} | ${r.modelado_hoy.tipo} | ${r.tipologia.clase}${r.tipologia.parecido_cuartel_cerl_61x141ft ? ' ★' : ''} | ${num(r.distancia_106_m, 0)} | ${r.osm_id} |`;
const cabeza = '| N.º | Nombre | Límite | Área m² | Caja m | Rumbo | Niveles OSM | OB p90 m (cubre) | Modelado en main | Tipología (conjetura por forma) | A 106 m | OSM |\n|---|---|---|---:|---|---:|---:|---|---|---|---:|---|';
const md = `# Inventario de edificios de Ciudad del Saber

Generado por \`fuente/inventario-ciudad.mjs\` (no editar a mano: se rehace con \`cd fuente && node inventario-ciudad.mjs\`). Datos completos por edificio en \`inventario.json\`. OpenStreetMap con base del ${base?.slice(0, 10)} (© colaboradores de OpenStreetMap, ODbL 1.0); alturas de Google Open Buildings 2.5D Temporal v1, 2023 (CC BY 4.0), estimadas desde satélite.

## El límite usado

OpenStreetMap no tiene un polígono de Ciudad del Saber (consulta a Overpass del 4 de octubre de 2026). El límite de \`limite-propuesto.geojson\` es una **propuesta** trazada sobre las calles: la Avenida Omar Torrijos Herrera al suroeste, la Calle Aroldo Cano Arosemena y el grupo de los 400 (Calle McIntosh, Calle Smith) al este, el norte de los edificios 248A y 389, y la Calle Johnston al sur. No es el límite oficial de la Fundación.

El grupo de casas de la ${CALLES_BORDE.join(' y la ')}, al otro lado de la Calle Aroldo Cano Arosemena, queda fuera del polígono pero **entra** (${hillParke.length} edificios, marcados «dentro (Hill/Parke)»): lo decidió LM el 4 de octubre de 2026. Los demás de fuera que parecen de Ciudad del Saber (\`addr:city\` «Ciudad del Saber» o un número de tres cifras) van como **fondo**: siguen como caja de fondo, sin tipología del kit (hoy solo Clayton Plaza).

## Resumen

- **Total: ${registros.length} edificios** (${dentroL.length} dentro, de ellos ${hillParke.length} de las calles Hill y Parke, y ${bordeL.length} de fondo).
- **Con número de Ciudad del Saber: ${numerados.length}** (${numerados.filter((r) => r.limite === 'dentro').length} dentro); sin número: ${sinNum.length}. El número sale de \`addr:housenumber\` (${registros.filter((r) => r.numero_fuente === 'addr:housenumber').length}), \`ref\` (${registros.filter((r) => r.numero_fuente === 'ref').length}) o del nombre (${registros.filter((r) => r.numero_fuente === 'name').length}).
${repetidos.length ? `- Números repetidos en OSM: ${repetidos.map(([k, n]) => `${k} (${n} huellas)`).join(', ')}.\n` : ''}- Con registro de Open Buildings: ${registros.filter((r) => r.open_buildings).length} (con altura p90 mayor que 0: ${registros.filter((r) => r.open_buildings?.p90 > 0).length}); con al menos 60 % de la huella cubierta: ${registros.filter((r) => r.open_buildings?.cubre >= 0.6).length}. Con \`building:levels\` en OSM: ${registros.filter((r) => r.tags_3d['building:levels']).length}. Con alguna etiqueta de techo (\`roof:*\`): ${registros.filter((r) => Object.keys(r.tags_3d).some((k) => k.startsWith('roof:'))).length}; con \`height\`: ${registros.filter((r) => r.tags_3d.height).length}.
- Parecidos en planta al cuartel de CERL (61 × 141 ft = 18,6 × 43,0 m, ±20 % de largo y ±30 % de ancho, marcados con ★): ${registros.filter((r) => r.tipologia.parecido_cuartel_cerl_61x141ft).length}.

${tablaCuenta('Tamaño', ordenTam.map((k) => [k, por((r) => r.clase_tamano, k)]))}

${tablaCuenta('Modelado en main (contexto.mjs)', cuenta(registros, (r) => r.modelado_hoy.tipo).map(([k]) => [k, por((r) => r.modelado_hoy.tipo, k)]))}

${tablaCuenta('Tipología (conjetura por forma)', cuenta(registros, (r) => r.tipologia.clase).map(([k]) => [k, por((r) => r.tipologia.clase, k)]))}

Qué significa cada «modelado en main» (\`contexto.mjs\`, el visor sin la ciudad; lo que dibuja la ciudad, edificio por edificio, está en \`edificios.json\`): **cuartel106** es la copia reducida del 106 puesta en la huella (${[...TIPOLOGIA_106].join(', ')}); **a mano** son los volúmenes propios (Fundación, La Casa, Innova, Teatro Ateneo); **maqueta** es un volumen gris de techo plano con la altura de sus niveles de OSM (${num(PISO, 2)} m por nivel + ${num(BASE, 2)} m), de Open Buildings p90 si cubre el ${num(OB_CUBRE * 100, 0)} % de la huella, o de ${NIVELES_SIN_DATO} niveles sin dato. La estructura pequeña del cuadrángulo y los estacionamientos no están en OSM y no aparecen aquí.

La tipología es una **conjetura por forma**: sale solo del rectángulo orientado de la huella de OSM, nunca de una foto. La referencia del cuartel es Enscore et al. (2000), *Guarding the Gates: The Story of Fort Clayton*, ERDC/CERL, DTIC ADA388262, PDF p. 96: los cuarteles del cuadrángulo «measured 61 x 141 ft» y «this basic design was adopted for all barracks subsequently built at Fort Clayton». La numeración del Ejército en ese informe no es la de Ciudad del Saber.

Columnas: «Caja» es el rectángulo orientado de área mínima (largo × ancho); «Rumbo», el del eje largo desde el norte (0 a 180°; el 106 está a ${EJE_LARGO}°); «A 106», la distancia de huella a huella hasta el 106 del modelo.

## Edificios con número (${numerados.length}), por número

${cabeza}
${numerados.map(fila).join('\n')}

## Edificios sin número (${sinNum.length})

Ordenados por distancia al 106. Muchos son casetas, garitas o techos sueltos; otros son edificios grandes que OSM no numera (la verificación en Street View o a pie debería anotar el número del rótulo, si lo tienen).

${cabeza}
${[...sinNum].sort((a, b) => a.distancia_106_m - b.distancia_106_m || a.osm_id - b.osm_id).map(fila).join('\n')}
`;
fs.writeFileSync(path.join(DOCS, 'inventario.md'), md);

// ---------------- ruta de verificación (solo con --ruta, fuera del repo) ----------------
const ARG_RUTA = process.argv.find((a) => a.startsWith('--ruta='))?.slice(7);
// grupos por la calle con nombre más cercana (las vías sin nombre van con la calle con nombre más cercana al edificio)
const grupos = new Map();
for (const r of registros) {
  const v = r.via_cercana; if (!v) continue;
  const k = v.nombre ?? v.via_con_nombre?.nombre ?? 'Sin calle con nombre cerca';
  if (!grupos.has(k)) grupos.set(k, []);
  grupos.get(k).push(r);
}
const pVista = (r) => aEN([r.via_cercana.punto.lat, r.via_cercana.punto.lon]);
// orden de recorrido: desde la calle del 106, cada vez la calle cuyo edificio más cercano queda más cerca del último visitado
const r106 = registros.find((r) => r.osm_id === ID_106);
let actual = r106 ? pVista(r106) : [0, 0];
const pendientes = new Set(grupos.keys()), recorrido = [];
const primero = r106 ? (r106.via_cercana.nombre ?? r106.via_cercana.via_con_nombre?.nombre) : null;
while (pendientes.size) {
  let elegido = null, dMin = Infinity;
  for (const k of [...pendientes].sort()) {
    const d = (k === primero && !recorrido.length) ? -1 : Math.min(...grupos.get(k).map((r) => Math.hypot(...pVista(r).map((v, i) => v - actual[i]))));
    if (d < dMin) { dMin = d; elegido = k; }
  }
  pendientes.delete(elegido);
  // dentro de la calle: a lo largo de su dirección principal, empezando por el extremo más cercano
  const L = grupos.get(elegido), pts = L.map(pVista), m = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
  let sxx = 0, sxy = 0, syy = 0; for (const [x, y] of pts) { sxx += (x - m[0]) ** 2; sxy += (x - m[0]) * (y - m[1]); syy += (y - m[1]) ** 2; }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), u = [Math.cos(th), Math.sin(th)];
  const s = (p) => (p[0] - m[0]) * u[0] + (p[1] - m[1]) * u[1];
  let orden = L.map((r, i) => ({ r, s: s(pts[i]) })).sort((a, b) => a.s - b.s || a.r.osm_id - b.r.osm_id);
  const ini = orden[0].r, fin = orden.at(-1).r, dist = (r) => Math.hypot(...pVista(r).map((v, i) => v - actual[i]));
  if (dist(fin) < dist(ini)) orden = orden.reverse();
  recorrido.push({ calle: elegido, lista: orden.map((o) => o.r) });
  actual = pVista(orden.at(-1).r);
}
const linea = (r) => {
  const v = r.via_cercana, nombreVia = v.nombre ?? `vía de servicio sin nombre (OSM ${v.osm_id})`;
  const titulo = r.numero_cds ? `**${r.numero_cds}**` : `**s/n** (OSM ${r.osm_id})`;
  return `- [ ] ${titulo}${r.nombre ? ` ${r.nombre}` : ''}${r.limite === 'fondo' ? ' *(fondo)*' : r.limite_motivo ? ' *(Hill/Parke)*' : ''} · [Street View](${r.streetview}) desde ${nombreVia}, a ${num(v.distancia_m, 0)} m, mirando a ${v.rumbo_hacia_el_edificio_grados}° · ${num(r.caja_orientada.largo_m, 0)} × ${num(r.caja_orientada.ancho_m, 0)} m${r.tags_3d['building:levels'] ? ` · ${r.tags_3d['building:levels']} niveles en OSM` : ''}\n  ☐ pisos ☐ forma techo ☐ material techo ☐ color muros ☐ color techo/alero ☐ mediaguas ☐ celosías/ventanas ☐ fecha de la imagen Street View: ________`;
};
const ruta = `# Ruta de verificación en Street View y a pie

Generada por \`fuente/inventario-ciudad.mjs\` a partir de \`inventario.json\` (${registros.length} edificios: ${dentroL.length} dentro, con las calles Hill y Parke, y ${bordeL.length} de fondo). Las respuestas se anotan en los campos vacíos de cada edificio en \`inventario.json\` (\`pisos_verificados\`, \`forma_techo\`, \`material_techo\`, \`color_muros\`, \`color_techo\`, \`aleros\`, \`mediaguas\`, \`celosias\`, \`foto_streetview_fecha\`) y en \`fuente_cada_campo\` se dice de dónde salió cada uno (por ejemplo «Street View, nov 2022» o «a pie, 12 oct 2026»).

**Uso de Street View.** Street View se usa solo como referencia visual para anotar hechos (número de pisos, forma y material del techo, colores, mediaguas, celosías). No se guardan capturas para usarlas como texturas ni se calca nada sobre las imágenes, conforme a los términos de Google Maps. Lo que se modela sale de esas anotaciones, de OSM y de las medidas propias.

**Cómo usar cada enlace.** Abre el panorama más cercano al punto de la calle más próximo al edificio, mirando hacia su centro. Si en esa calle no hay Street View (pasa en vías de servicio), Google abre el panorama más cercano que encuentre, que puede no mostrar el edificio: en ese caso anótalo como «sin Street View» y verifícalo a pie. Anota siempre la fecha de la imagen (aparece en la esquina del panorama): de ella depende cuánto vale cada dato.

**Orden.** Calle por calle, empezando por la del 106 y siguiendo cada vez con la calle más cercana a la anterior; dentro de cada calle, de un extremo al otro. Las vías sin nombre van con la calle con nombre más cercana. «s/n» es un edificio sin número en OSM: si tiene rótulo, anota el número.

Datos de OpenStreetMap con base del ${base?.slice(0, 10)} (© colaboradores de OpenStreetMap, ODbL 1.0).

${recorrido.map((g, i) => `## ${i + 1}. ${g.calle} (${g.lista.length})\n\n${g.lista.map(linea).join('\n')}`).join('\n\n')}
`;
if (ARG_RUTA) fs.writeFileSync(ARG_RUTA, ruta);

console.log(`base OSM ${base} · ${registros.length} edificios (${dentroL.length} dentro con ${hillParke.length} de Hill y Parke, ${bordeL.length} de fondo) · ${numerados.length} con número · ${recorrido.length} calles en la ruta${ARG_RUTA ? ` (escrita en ${ARG_RUTA})` : ''}`);
console.log('modelado hoy:', JSON.stringify(Object.fromEntries(cuenta(registros, (r) => r.modelado_hoy.tipo))));
console.log('tamaño:', JSON.stringify(Object.fromEntries(ordenTam.map((k) => [k, registros.filter((r) => r.clase_tamano === k).length]))));
console.log('tipología:', JSON.stringify(Object.fromEntries(cuenta(registros, (r) => r.tipologia.clase))));
