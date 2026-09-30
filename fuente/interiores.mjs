// Mapa de ventanas para los interiores procedurales (interior mapping). Lee los paños de vidrio de los GLB web (../modelo),
// los agrupa en ventanas, le asigna a cada una el cuarto que tiene detrás y escribe:
//   src/interiores-mapa.js                         la tabla que usa el sombreador del vidrio (escena.js la vuelve una DataTexture)
//   verificacion/interiores/mapa-ventanas.png      alzados con cada ventana coloreada por tipo
//   verificacion/interiores/mapa-ventanas.csv      la misma tabla, para leerla
// Uso: cd fuente && node interiores.mjs      (no cambia ningún GLB; si cambia el modelo, se vuelve a correr)
//
// Coordenadas de la escena en metros: +X = noreste, +Z = sureste, Y arriba. Fachadas: SE (z = +11,41), NO (z = −11,41),
// NE (x = +22,66, la corta del jardín), SO (x = −22,66). Pisos: losas a 0,65 · 4,30 · 7,95 m (3,65 m entre pisos).
// Qué hay detrás de cada ventana de la planta baja lo contó LM de memoria (uso interno: en el sitio no se nombra ningún
// espacio). Los pisos 2 y 3 son salones; su partición en salones es una suposición (cuartos de ~7,5 m).
// Cada cuarto es un rectángulo en planta: visto desde una fachada, su ancho da las paredes laterales y su fondo la pared de
// atrás, así que un cuarto de esquina (la sala de profesores, el taller, la dirección) es el mismo cuarto desde las dos
// fachadas, con la misma luz encendida o apagada.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MODELO = path.join(AQUI, '..', 'modelo');
const VERIF = path.join(AQUI, 'verificacion', 'interiores');
export const TIPOS = ['intacta', 'aula', 'oficina', 'pasillo', 'baño', 'recepción', 'vestíbulo'];
const X = 22.66, Z = 11.41;
const FACH = ['SE', 'NO', 'NE', 'SO'];          // índice de fachada en la tabla (el sombreador usa el mismo orden)
const LOSA = [0.65, 4.30, 7.95];

// ---------------- 1. paños de vidrio → ventanas ----------------
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
function componentes(doc, re) {
  const out = [];
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m || !re.test(m.getName())) continue;
    const W = n.getWorldMatrix();
    for (const p of m.listPrimitives()) {
      const A = p.getAttribute('POSITION'), e = [], P = [];
      for (let i = 0; i < A.getCount(); i++) { A.getElement(i, e); P.push([0, 1, 2].map((k) => W[k] * e[0] + W[4 + k] * e[1] + W[8 + k] * e[2] + W[12 + k])); }
      const I = p.getIndices() ? Array.from(p.getIndices().getArray()) : P.map((_, i) => i);
      const clave = new Map(), vid = P.map((q) => { const k = q.map((v) => Math.round(v * 1e3)).join(','); if (!clave.has(k)) clave.set(k, clave.size); return clave.get(k); });
      const par = Array.from({ length: clave.size }, (_, i) => i), f = (x) => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
      for (let t = 0; t < I.length; t += 3) { const a = f(vid[I[t]]), b = f(vid[I[t + 1]]), c = f(vid[I[t + 2]]); par[a] = b; par[c] = b; }
      const cs = new Map();
      for (let t = 0; t < I.length; t += 3) {
        const r = f(vid[I[t]]); let c = cs.get(r); if (!c) cs.set(r, c = { mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9], malla: m.getName() });
        for (let j = 0; j < 3; j++) { const q = P[I[t + j]]; for (let k = 0; k < 3; k++) { c.mn[k] = Math.min(c.mn[k], q[k]); c.mx[k] = Math.max(c.mx[k], q[k]); } }
      }
      out.push(...cs.values());
    }
  }
  return out;
}
const [arq, ent, ven] = await Promise.all(['arquitectura', 'entrada', 'ventanas'].map((g) => io.read(path.join(MODELO, g + '.glb'))));
const panos = [...componentes(arq, /glass/i), ...componentes(ent, /glass/i)];
const tablero = componentes(ven, /infill board/i);          // el desfogue de la cortadora láser (fachada NE, piso 2)
const celosias = componentes(ven, /louvre/i);
function ubicar(c) {
  const s = c.mx.map((v, k) => v - c.mn[k]), cx = (c.mn[0] + c.mx[0]) / 2, cz = (c.mn[2] + c.mx[2]) / 2;
  const f = s[0] < s[2] ? (cx > 0 ? 2 : 3) : (cz > 0 ? 0 : 1), porZ = f >= 2;
  return { f, a0: porZ ? c.mn[2] : c.mn[0], a1: porZ ? c.mx[2] : c.mx[0], y0: c.mn[1], y1: c.mx[1], piso: c.mn[1] < LOSA[1] ? 0 : c.mn[1] < LOSA[2] ? 1 : 2 };
}
const P = panos.map((c) => ({ ...ubicar(c), malla: c.malla }));
const par = P.map((_, i) => i), raiz = (x) => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
  const a = P[i], b = P[j], G = 0.2;
  if (a.f === b.f && a.piso === b.piso && a.a0 - G < b.a1 && b.a0 - G < a.a1 && a.y0 - G < b.y1 && b.y0 - G < a.y1) par[raiz(i)] = raiz(j);
}
const mapaV = new Map();
P.forEach((p, i) => {
  const r = raiz(i); let v = mapaV.get(r);
  if (!v) mapaV.set(r, v = { f: p.f, piso: p.piso, a0: 1e9, a1: -1e9, y0: 1e9, y1: -1e9, panos: 0, puerta: false });
  v.a0 = Math.min(v.a0, p.a0); v.a1 = Math.max(v.a1, p.a1); v.y0 = Math.min(v.y0, p.y0); v.y1 = Math.max(v.y1, p.y1); v.panos++; v.puerta ||= /Window glass/.test(p.malla);
});
const VENT = [...mapaV.values()].sort((a, b) => a.f - b.f || a.piso - b.piso || a.a0 - b.a0);
const centro = (v) => (v.a0 + v.a1) / 2;
for (const v of VENT) {
  v.celosia = celosias.some((c) => { const u = ubicar(c); return u.f === v.f && u.piso === v.piso && u.a0 < v.a1 && u.a1 > v.a0 && u.y0 < v.y1 && u.y1 > v.y0; });
  v.desfogue = tablero.some((c) => { const u = ubicar(c); return u.f === v.f && u.a0 < v.a1 && u.a1 > v.a0 && u.y0 < v.y1 && u.y1 > v.y0; });
}

// ---------------- 2. cuartos ----------------
// planta baja: rectángulos en planta [x0, x1, z0, z1] con su tipo y un uso (el uso solo sirve para esta tabla)
const PB = [
  { uso: 'sala de profesores', tipo: 1, r: [-X, -13.2, 6.6, Z] },
  { uso: 'pasillo (a lo largo de la fachada)', tipo: 3, r: [-11.3, 11.75, 9.0, Z] },
  { uso: 'vestíbulo (puerta de vidrio)', tipo: 6, r: [11.75, 13.9, 8.6, Z] },
  { uso: 'recepción (vidrio hacia adentro)', tipo: 5, r: [13.9, 19.9, 7.2, Z] },
  { uso: 'baño', tipo: 4, r: [19.9, X, 3.6, Z] },
  { uso: 'baño', tipo: 4, r: [19.9, X, -0.3, 3.6] },
  { uso: 'oficina (finanzas)', tipo: 2, r: [18.7, X, -3.4, -0.3] },
  { uso: 'oficina (coordinación)', tipo: 2, r: [18.7, X, -6.9, -3.4] },
  { uso: 'oficina (dirección)', tipo: 2, r: [17.4, X, -Z, -6.9] },
  { uso: 'biblioteca', tipo: 1, r: [-1.0, 9.2, -Z, -3.5] },
  { uso: 'pasillo (hacia adentro)', tipo: 3, r: [-10.7, -7.9, -Z, 2.0] },
  { uso: 'taller', tipo: 1, r: [-X, -13.0, -Z, -0.5] },
  { uso: 'cafetería', tipo: 1, r: [-X, -15.5, 0.6, 6.6] },
];
const semilla = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 251) + 1; };
/** Paredes laterales (a lo largo de la fachada) y fondo de un rectángulo visto desde la fachada f. */
function vista(r, f) {
  const [x0, x1, z0, z1] = r;
  if (f === 0) return { sL: x0, sR: x1, prof: Z - z0 };
  if (f === 1) return { sL: x0, sR: x1, prof: z1 + Z };
  if (f === 2) return { sL: z0, sR: z1, prof: X - x0 };
  return { sL: z0, sR: z1, prof: x1 + X };
}
const dentro = (v, r) => { const c = centro(v); return v.f <= 1 ? c > r[0] && c < r[1] && (v.f === 0 ? r[3] >= Z - 0.01 : r[2] <= -Z + 0.01) : c > r[2] && c < r[3] && (v.f === 2 ? r[1] >= X - 0.01 : r[0] <= -X + 0.01); };
const avisos = [];
for (const v of VENT) {
  if (v.desfogue) { Object.assign(v, { tipo: 0, uso: 'desfogue de la cortadora láser (sin tocar)', sL: v.a0, sR: v.a1, prof: 0, sala: 'desfogue' }); continue; }
  if (v.piso === 0) {
    const c = PB.find((q) => dentro(v, q.r));
    if (!c) { avisos.push(`ventana sin cuarto: ${FACH[v.f]} P${v.piso + 1} ${v.a0.toFixed(2)}..${v.a1.toFixed(2)}`); Object.assign(v, { tipo: 1, uso: 'salón (sin dato)', ...vista([-1, 1, -1, 1], v.f), sala: 'x' }); continue; }
    Object.assign(v, { tipo: c.tipo, uso: c.uso, ...vista(c.r, v.f), sala: c.uso + c.r.join(',') });
  }
}
// pisos 2 y 3: salones de ~7,5 m a lo largo de cada fachada, partidos en el hueco entre dos ventanas, de 7,5 m de fondo
for (let f = 0; f < 4; f++) for (const piso of [1, 2]) {
  const L = VENT.filter((v) => v.f === f && v.piso === piso && !v.desfogue), lim = f <= 1 ? X : Z;
  let ini = -lim, k = 0;
  for (let i = 0; i < L.length; i++) {
    const v = L[i], sig = L[i + 1];
    v.salaIni = ini; v.salaN = k;
    if (!sig || sig.a1 - ini > 8.2) { const fin = sig ? (v.a1 + sig.a0) / 2 : lim; for (const w of L) if (w.salaN === k && w.salaIni === ini) Object.assign(w, { sR: fin }); ini = fin; k++; }
  }
  for (const v of L) Object.assign(v, { tipo: 1, uso: 'salón', sL: v.salaIni, prof: 7.5, sala: `salón ${FACH[f]} P${piso + 1} #${v.salaN}` });
}
// el desfogue vive dentro de un salón: su hueco no lleva interior, pero las paredes son las del salón vecino
for (const v of VENT) v.semilla = semilla(v.sala);

// ---------------- 3. tabla para el sombreador ----------------
const r2 = (x) => Math.round(x * 100) / 100;
const filas = VENT.map((v) => [v.f, v.piso, r2(v.a0), r2(v.a1), v.tipo, r2(v.prof), r2(v.sL), r2(v.sR), v.semilla]);
const js = `// Generado por fuente/interiores.mjs a partir de los paños de vidrio del modelo: no editar a mano.
// Una fila por ventana: [fachada (0 SE, 1 NO, 2 NE, 3 SO), piso (0 a 2), desde, hasta (m a lo largo de la fachada: x en SE y NO,
// z en NE y SO), tipo, fondo del cuarto (m), pared izquierda, pared derecha (m, mismo eje), semilla del cuarto (1 a 251)].
// Tipos: ${TIPOS.map((t, i) => `${i} ${t}`).join(' · ')}.
export const TIPOS_INTERIOR = ${JSON.stringify(TIPOS)};
export const VENTANAS = [
${filas.map((f) => '  ' + JSON.stringify(f)).join(',\n')},
];
`;
fs.writeFileSync(path.join(AQUI, 'src', 'interiores-mapa.js'), js);
fs.mkdirSync(VERIF, { recursive: true });
const csv = ['fachada,piso,desde_m,hasta_m,ancho_m,alto_vidrio_m,celosia,tipo,uso,pared_izq_m,pared_der_m,fondo_m,semilla'];
for (const v of VENT) csv.push([FACH[v.f], v.piso + 1, r2(v.a0), r2(v.a1), r2(v.a1 - v.a0), `${r2(v.y0)}-${r2(v.y1)}`, v.celosia ? 'sí' : '', TIPOS[v.tipo], `"${v.uso}"`, r2(v.sL), r2(v.sR), r2(v.prof), v.semilla].join(','));
fs.writeFileSync(path.join(VERIF, 'mapa-ventanas.csv'), csv.join('\n') + '\n');

// ---------------- 4. alzados ----------------
const COL = { 0: '#8a5a2b', 1: '#3b82c4', 2: '#e08a1e', 3: '#3aa66a', 4: '#b7c3cc', 5: '#c0508a', 6: '#6b4fb8' };
const E = 26, M = 40;                                  // píxeles por metro, margen
// cada alzado visto desde afuera: SE y SO de izquierda a derecha según +x/+z; NO y NE al revés
const ORDEN = [0, 3, 1, 2], SENT = { 0: 1, 1: -1, 2: -1, 3: 1 };
let y = M + 60, svg = '';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const ancho = Math.max(Math.ceil(2 * X * E + 2 * M), M + 8 * 205 + 60);
for (const f of ORDEN) {
  const lim = f <= 1 ? X : Z, w = 2 * lim * E, h = 12.2 * E, u = (a) => M + (SENT[f] > 0 ? a + lim : lim - a) * E, vy = (yy) => y + h - yy * E;
  svg += `<text x="${M}" y="${y - 12}" font-family="Helvetica" font-size="22" font-weight="bold" fill="#222">Fachada ${FACH[f]}${f >= 2 ? ' (corta)' : ''} · vista desde afuera · ${SENT[f] > 0 ? (f <= 1 ? 'x' : 'z') + ' crece a la derecha' : (f <= 1 ? 'x' : 'z') + ' crece a la izquierda'}</text>`;
  svg += `<rect x="${M}" y="${vy(11.7)}" width="${w}" height="${11.7 * E}" fill="#f4f1ea" stroke="#999"/>`;
  for (const l of LOSA) svg += `<line x1="${M}" x2="${M + w}" y1="${vy(l)}" y2="${vy(l)}" stroke="#bbb" stroke-dasharray="4 4"/>`;
  for (const v of VENT.filter((q) => q.f === f)) {
    const x0 = Math.min(u(v.a0), u(v.a1)), x1 = Math.max(u(v.a0), u(v.a1));
    // paredes del cuarto (a lo largo), como una raya bajo la ventana
    const s0 = Math.min(u(v.sL), u(v.sR)), s1 = Math.max(u(v.sL), u(v.sR));
    if (v.tipo) svg += `<line x1="${s0 + 2}" x2="${s1 - 2}" y1="${vy(LOSA[v.piso]) - 5}" y2="${vy(LOSA[v.piso]) - 5}" stroke="${COL[v.tipo]}" stroke-width="3" opacity="0.6"/>`;
    svg += `<rect x="${x0}" y="${vy(v.y1)}" width="${x1 - x0}" height="${(v.y1 - v.y0) * E}" fill="${COL[v.tipo]}" stroke="#222" stroke-width="1"/>`;
    if (v.celosia) svg += `<rect x="${x0}" y="${vy(v.y0 + (v.y1 - v.y0) * 0.5)}" width="${x1 - x0}" height="${(v.y1 - v.y0) * 0.5 * E}" fill="url(#cel)"/>`;
    if (v.desfogue) svg += `<text x="${(x0 + x1) / 2}" y="${vy(v.y1) - 6}" text-anchor="middle" font-family="Helvetica" font-size="13" fill="#8a5a2b">desfogue</text>`;
    if (v.piso === 0) svg += `<text transform="translate(${(x0 + x1) / 2 + 4},${vy(0.55)}) rotate(-90)" font-family="Helvetica" font-size="11" fill="#333">${esc(v.uso.replace(/ \(.*\)/, ''))}</text>`;
  }
  // leyenda de este alzado: los tipos presentes
  y += h + 70;
}
const ley = TIPOS.map((t, i) => `<rect x="${M + i * 205}" y="${M}" width="22" height="16" fill="${COL[i]}" stroke="#222"/><text x="${M + i * 205 + 28}" y="${M + 13}" font-family="Helvetica" font-size="15" fill="#222">${i === 0 ? 'sin interior (desfogue)' : t}</text>`).join('')
  + `<rect x="${M + 7 * 205}" y="${M}" width="22" height="16" fill="url(#cel)" stroke="#222"/><text x="${M + 7 * 205 + 28}" y="${M + 13}" font-family="Helvetica" font-size="15" fill="#222">celosía delante</text>`;
const alto = y;
const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><defs><pattern id="cel" width="6" height="6" patternUnits="userSpaceOnUse"><line x1="0" y1="3" x2="6" y2="3" stroke="#222" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="#fff"/>${ley}${svg}</svg>`;
await sharp(Buffer.from(doc)).png().toFile(path.join(VERIF, 'mapa-ventanas.png'));

const cuenta = {}; for (const v of VENT) cuenta[TIPOS[v.tipo]] = (cuenta[TIPOS[v.tipo]] ?? 0) + 1;
console.log(`${VENT.length} ventanas (${P.length} paños) ·`, JSON.stringify(cuenta));
for (const a of avisos) console.log('aviso:', a);
