// Efecto de los vecinos (contexto de OpenStreetMap) en el análisis de sol del 106: qué fachadas reciben su sombra, en qué
// meses y a qué horas, y cuánto cambia lo que dice el visor. Trazado de rayos sobre los .glb del sitio armado (la misma
// geometría que dibuja la app; verificar-geometria.mjs), sin navegador.
//
//   cd fuente && node verificacion/contexto/efecto.mjs [--antes=<carpeta con modelo/ de antes>]
//
// Puntos: la superficie visible de cada fachada (muro, vidrio, marcos), con rayos horizontales hacia el edificio cada 0,8 m
// a lo largo y cada 0,4 m en altura, de 0,8 a 11,4 m. Las sombras son las del mapa de sombras de la app (tejas con su
// sustituto cubiertas_sombra). Sol: src/sol.js (NOAA). Un punto está al sol si el sol está delante
// de su cara y el rayo hacia el sol no choca con nada.
//  · «sin vecinos»: el 106, su sitio y la vegetación (lo que el visor ya sombreaba).
//  · «con vecinos»: lo mismo más los nodos del contexto que proyectan sombra (extras.sombra en contexto.glb).
//  · «antes»: el modelo publicado (26546a4), con el anillo de árboles de relleno y el contexto sin sombra (con --antes).
// Energía: sol directo de cielo despejado (dniDespejado de sol.js) sobre cada punto, cada 15 min, un día de cada 5 de 2025.
// Horas cálidas: la serie ERA5 del sitio (datos/clima_horario.bin.gz), como el hallazgo «En las horas más cálidas…».
// Salida: verificacion/contexto/efecto.json y efecto.md (tablas).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { posicionSol, vectorSol, dniDespejado, FACHADAS } from '../../src/sol.js';
import { cargarTriangulos, Rayos } from '../../verificar-geometria.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../..');
const ARGS = process.argv.slice(2);
const ANTES = (ARGS.find((a) => a.startsWith('--antes=')) ?? '').slice(8) || null;
// --contexto=otro.glb: los vecinos de otro archivo (p. ej. con otra altura de Innova); --salida=nombre: efecto-nombre.md/json
const CTX = (ARGS.find((a) => a.startsWith('--contexto=')) ?? '').slice(11) || null;
const SAL = (ARGS.find((a) => a.startsWith('--salida=')) ?? '').slice(9);
const rad = Math.PI / 180;
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const MARCO = {   // igual que verificar.mjs: normal hacia afuera y eje a lo largo
  se: { n: [0, 0, 1], t: [1, 0, 0], largo: 45.5 },
  no: { n: [0, 0, -1], t: [-1, 0, 0], largo: 45.5 },
  ne: { n: [1, 0, 0], t: [0, 0, -1], largo: 23 },
  so: { n: [-1, 0, 0], t: [0, 0, 1], largo: 23 },
};
const pto = (M, s, y, prof) => [M.n[0] * prof + M.t[0] * s, y, M.n[2] * prof + M.t[2] * s];
// lo que proyecta sombra en la app: las tejas van con su sustituto (cubiertas_sombra), como en el mapa de sombras
const G106 = ['arquitectura', 'cubiertas', 'detalles', 'entrada', 'ventanas', 'sitio', 'cubiertas_sombra'];
const tejaReal = (mm, i) => mm.grupos[mm.grupo[i]] === 'cubiertas' && /terracotta/i.test(mm.nombres[mm.mat[i]]);

// ---------------- geometría ----------------
console.time('geometría');
const m = await cargarTriangulos(RAIZ, [...G106, 'vegetacion']);
const esVeg = m.grupos.indexOf('vegetacion');
const esSust = m.grupos.indexOf('cubiertas_sombra');
const r106 = new Rayos(m, (i) => m.grupo[i] !== esVeg && m.grupo[i] !== esSust);   // para hallar los puntos de las fachadas (lo que se ve)
const rSin = new Rayos(m, (i) => !tejaReal(m, i));                                   // 106 + sitio + vegetación, como en el mapa de sombras
// contexto: solo los nodos que proyectan sombra, cada uno con su nombre (para saber quién da la sombra)
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
async function vecinos(raiz) {
  const doc = await io.read(CTX ?? path.join(raiz, 'modelo', 'contexto.glb'));
  const tri = [], quien = [];
  for (const nodo of doc.getRoot().listNodes()) {
    const malla = nodo.getMesh(); if (!malla || !nodo.getExtras()?.sombra) continue;
    const M = nodo.getWorldMatrix();
    for (const p of malla.listPrimitives()) {
      const A = p.getAttribute('POSITION'), I = p.getIndices(), v = [0, 0, 0], w = [];
      for (let k = 0; k < A.getCount(); k++) { A.getElement(k, v); w.push([M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]]); }
      const n = I ? I.getCount() : A.getCount();
      for (let t = 0; t + 2 < n; t += 3) { for (let c = 0; c < 3; c++) tri.push(...w[I ? I.getScalar(t + c) : t + c]); quien.push(nodo.getName()); }
    }
  }
  const mm = { tri: Float32Array.from(tri), mat: new Uint16Array(quien.length), grupo: new Uint8Array(quien.length), nombres: [''], grupos: ['contexto'] };
  return { rayos: new Rayos(mm), quien };
}
const ctx = await vecinos(RAIZ);
// quién es quién en el nodo de los vecinos cercanos (Innova, Balboa y la estructura van juntos): por la posición del choque
function nombreVecino(i, p) {
  const q = ctx.quien[i];
  if (/cuartel 105/.test(q)) return '105';
  if (p[0] > 50) return 'Balboa';
  if (p[2] > 25) return 'Innova';
  if (p[2] < -18 && p[0] < -20) return 'estructura';
  return q;
}
let rAntes = null;
if (ANTES) { const ma = await cargarTriangulos(ANTES, [...G106, 'vegetacion']); rAntes = new Rayos(ma, (i) => !tejaReal(ma, i)); }
console.timeEnd('geometría');

// ---------------- puntos de cada fachada ----------------
const puntos = {};
for (const [k, M] of Object.entries(MARCO)) {
  const L = [];
  for (let s = -M.largo / 2 + 0.4; s < M.largo / 2; s += 0.8) for (let y = 0.8; y <= 11.41; y += 0.4) {
    const o = pto(M, s, y, 40), h = r106.lanzar(o, M.n.map((x) => -x), 45);
    if (!h) continue;
    let n = h.n; if (n[0] * M.n[0] + n[2] * M.n[2] < 0) n = n.map((x) => -x);
    if (n[0] * M.n[0] + n[2] * M.n[2] < 0.5) continue;             // solo caras que miran hacia afuera (no cantos ni sofitos)
    const nm = m.nombres[m.mat[h.i]].toLowerCase();
    const clase = /glass/.test(nm) ? 'vidrio' : /plaster/.test(nm) && !/interior/.test(nm) ? 'muro' : 'otro';
    const p = o.map((x, c) => x - M.n[c] * h.t + n[c] * 0.004);
    L.push({ p, n, clase, y, piso: y < 4.4 ? 1 : y < 8.05 ? 2 : 3 });
  }
  puntos[k] = L;
}
const cuenta = Object.fromEntries(Object.entries(puntos).map(([k, L]) => [k, { total: L.length, vidrio: L.filter((q) => q.clase === 'vidrio').length }]));
console.log('puntos', cuenta);

/** Estado de una fachada con el sol en `d`: fracción al sol sin vecinos, con vecinos, antes; y quién sombrea. */
function estado(k, d, conAntes = false) {
  const L = puntos[k]; let delante = 0, sin = 0, con = 0, antes = 0, vS = 0, vC = 0, vA = 0, nv = 0; const por = {};
  const pisoV = { 1: [0, 0, 0], 2: [0, 0, 0], 3: [0, 0, 0] };
  for (const q of L) {
    const c = q.n[0] * d[0] + q.n[1] * d[1] + q.n[2] * d[2];
    if (q.clase === 'vidrio') { nv++; pisoV[q.piso][0]++; }
    if (c <= 0.02) continue;
    delante++;
    const a = !rSin.lanzar(q.p, d, 400);
    let b = a;
    if (a) { const h = ctx.rayos.lanzar(q.p, d, 400); if (h) { b = false; const hp = q.p.map((x, j) => x + d[j] * h.t); const nmb = nombreVecino(h.i, hp); por[nmb] = (por[nmb] ?? 0) + 1; } }
    if (a) sin++; if (b) con++;
    if (q.clase === 'vidrio') { if (a) { vS++; pisoV[q.piso][1]++; } if (b) { vC++; pisoV[q.piso][2]++; } }
    if (conAntes && rAntes) { const e = !rAntes.lanzar(q.p, d, 400); if (e) antes++; if (e && q.clase === 'vidrio') vA++; }
  }
  const N = L.length;
  return { delante: delante / N, sin: sin / N, con: con / N, antes: conAntes && rAntes ? antes / N : null, vidrioSin: vS / nv, vidrioCon: vC / nv, vidrioAntes: conAntes && rAntes ? vA / nv : null, por, pisoV };
}
const solEn = (f, min) => { const p = posicionSol({ ...f, h: 0, min }); const v = vectorSol(p.alt, p.az); return { ...p, d: [v.x, v.y, v.z] }; };

// ---------------- 1. día 21 de cada mes, cada 10 min ----------------
console.time('meses');
const Y = 2025, tabla = [];
for (let mes = 1; mes <= 12; mes++) {
  const f = { y: Y, m: mes, d: 21 };
  for (let min = 5 * 60 + 40; min <= 18 * 60 + 40; min += 10) {
    const s = solEn(f, min); if (s.alt < 0.5) continue;
    for (const k of Object.keys(MARCO)) {
      const e = estado(k, s.d, true);
      if (e.delante === 0) continue;
      tabla.push({ mes, min, alt: s.alt, az: s.az, k, ...e });
    }
  }
}
console.timeEnd('meses');

// ---------------- 2. energía directa de cielo despejado en un año ----------------
console.time('año');
const E = Object.fromEntries(Object.keys(MARCO).map((k) => [k, { sin: 0, con: 0, antes: 0, vSin: 0, vCon: 0, horasSin: 0, horasCon: 0 }]));
for (let dia = 2; dia < 365; dia += 5) {
  const dd = new Date(Date.UTC(Y, 0, 1 + dia)), f = { y: Y, m: dd.getUTCMonth() + 1, d: dd.getUTCDate() };
  for (let min = 5 * 60 + 37.5; min <= 18 * 60 + 45; min += 15) {
    const s = solEn(f, min); if (s.alt < 0.5) continue;
    const dni = dniDespejado(s.alt);
    for (const k of Object.keys(MARCO)) {
      const L = puntos[k]; let a = 0, b = 0, c0 = 0, va = 0, vb = 0, nv = 0;
      for (const q of L) {
        if (q.clase === 'vidrio') nv++;
        const c = q.n[0] * s.d[0] + q.n[1] * s.d[1] + q.n[2] * s.d[2]; if (c <= 0.02) continue;
        const lit = !rSin.lanzar(q.p, s.d, 400); if (!lit) { if (rAntes && !rAntes.lanzar(q.p, s.d, 400)) c0 += c; continue; }
        const litN = !ctx.rayos.lanzar(q.p, s.d, 400);
        a += c; if (litN) b += c;
        if (rAntes && !rAntes.lanzar(q.p, s.d, 400)) c0 += c;
        if (q.clase === 'vidrio') { va += c; if (litN) vb += c; }
      }
      const w = dni * (15 / 60) * 5 / 1000 / L.length;        // kWh/m² (cada muestra vale 5 días × 15 min), promedio de la fachada
      E[k].sin += a * w; E[k].con += b * w; E[k].antes += c0 * w;
      E[k].vSin += va * dni * (15 / 60) * 5 / 1000 / Math.max(1, nv); E[k].vCon += vb * dni * (15 / 60) * 5 / 1000 / Math.max(1, nv);
    }
  }
}
console.timeEnd('año');

// ---------------- 3. horas cálidas de ERA5 (hallazgo del SO) ----------------
console.time('horas cálidas');
const bin = zlib.gunzipSync(fs.readFileSync(path.join(RAIZ, 'datos', 'clima_horario.bin.gz')));
const n = bin.readUInt32LE(4), col = (i) => bin.subarray(8 + i * n, 8 + (i + 1) * n);
const TEMP = col(2), DNI = col(4);
const cal = { horas: 0, frenteSO: 0, so100: 0, soVidrioSin: 0, soVidrioCon: 0, so100Con: 0, soSombra105: 0, anios: 25 };
const cache = new Map();
for (let i = 1; i < n; i++) {
  const T = TEMP[i] / 6 + 10; if (T < 30) continue;
  cal.horas++;
  // la hora i va de i−1 a i (hora de Panamá desde el 1 de enero de 2001); el sol, a la mitad
  const t = Date.UTC(2001, 0, 1) + (i - 0.5) * 3600e3, dd = new Date(t);
  const f = { y: dd.getUTCFullYear(), m: dd.getUTCMonth() + 1, d: dd.getUTCDate() }, min = dd.getUTCHours() * 60 + dd.getUTCMinutes();
  const s = solEn(f, min); if (s.alt <= 0) continue;
  const cSO = Math.cos(s.alt * rad) * Math.cos((s.az - FACHADAS['fachada-so'].rumbo) * rad);
  if (cSO <= 0) continue;
  cal.frenteSO++;
  const dni = DNI[i] * 4;
  if (dni * cSO > 100) cal.so100++;
  const clave = `${f.m}-${Math.round(min / 10)}`;               // la geometría del sol se repite de un año a otro
  let e = cache.get(clave); if (!e) { e = estado('so', s.d); cache.set(clave, e); }
  if (dni * cSO > 100) { cal.so100Con += e.con / Math.max(1e-9, e.sin) > 0.5 ? 1 : 0; if (e.sin - e.con > 0.05) cal.soSombra105++; }
  if (dni * cSO > 100) { if (e.vidrioSin > 0.01) cal.soVidrioSin++; if (e.vidrioCon > 0.01) cal.soVidrioCon++; }
}
console.timeEnd('horas cálidas');

// ---------------- 4. momentos que cita el visor ----------------
const momentos = [
  { que: 'Hallazgo «El alero…»: 15/01/2026 07:30, fachada SE («casi todo el vidrio del piso 2 al sol»)', f: { y: 2026, m: 1, d: 15 }, min: 450, k: 'se' },
  { que: 'La misma fachada SE el 15/01/2026 a las 08:00', f: { y: 2026, m: 1, d: 15 }, min: 480, k: 'se' },
  { que: 'La misma fachada SE el 15/01/2026 a las 08:30', f: { y: 2026, m: 1, d: 15 }, min: 510, k: 'se' },
  { que: 'Recorrido guiado, paso 4: 25/03/2024 15:30, fachada SO («la recibe casi de frente»)', f: { y: 2024, m: 3, d: 25 }, min: 930, k: 'so' },
  { que: 'Consulta «Sol de la tarde en la fachada lateral SO» (a las 15:30 de un día de mucho sol; aquí 13/01/2024)', f: { y: 2024, m: 1, d: 13 }, min: 930, k: 'so' },
  { que: 'Captura: 13/01/2024 16:30, fachada SO', f: { y: 2024, m: 1, d: 13 }, min: 990, k: 'so' },
  { que: 'Captura: 07/12/2022 07:30, fachada SE', f: { y: 2022, m: 12, d: 7 }, min: 450, k: 'se' },
  { que: 'Hallazgo «En las horas más cálidas…»: 11/04/2003 15:30, fachada SO', f: { y: 2003, m: 4, d: 11 }, min: 930, k: 'so' },
  { que: 'Hallazgo «Sol directo…»: 05/03/2024 09:30, vista aérea (SE con el valor más alto)', f: { y: 2024, m: 3, d: 5 }, min: 570, k: 'se' },
];
for (const q of momentos) { const s = solEn(q.f, q.min); q.sol = { alt: +s.alt.toFixed(1), az: +s.az.toFixed(1) }; q.e = estado(q.k, s.d, true); }

// «Más de la mitad del vidrio recibe sol en la SE hasta cerca de las 8:45 en enero, y en el SO desde cerca de las 15:40 en
// noviembre y diciembre»: la hora en que el vidrio al sol cruza el 50 %, con y sin vecinos (promedio de los días del mes)
function cruce(k, meses) {
  // para cada día, la primera y la última hora con más de la mitad del vidrio al sol; luego la mediana de los días
  const dias = { sin: [], con: [] };
  for (const mes of meses) for (let d = 1; d <= 28; d += 3) {
    const f = { y: Y, m: mes, d }, S = [], C = [];
    for (let min = 5 * 60 + 45; min <= 18 * 60 + 45; min += 5) {
      const s = solEn(f, min); if (s.alt < 0.5) continue;
      const e = estado(k, s.d); if (e.delante === 0) continue;
      if (e.vidrioSin > 0.5) S.push(min); if (e.vidrioCon > 0.5) C.push(min);
    }
    dias.sin.push(S.length ? [S[0], S.at(-1)] : null); dias.con.push(C.length ? [C[0], C.at(-1)] : null);
  }
  const med = (a, j) => { const b = a.filter(Boolean).map((x) => x[j]).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
  const nulos = (a) => a.filter((x) => !x).length;
  return { sin: [med(dias.sin, 0), med(dias.sin, 1)], con: [med(dias.con, 0), med(dias.con, 1)], diasSinMitad: { sin: nulos(dias.sin), con: nulos(dias.con), de: dias.sin.length }, dias };
}
const vidrioSE = cruce('se', [1]), vidrioSO = cruce('so', [11, 12]);
// y cuánto del vidrio queda al sol en la hora del alba: el máximo de la mañana (SE, enero) o de la tarde (SO, nov-dic)
function maxVidrio(k, meses, rango) {
  let sin = 0, con = 0, cuando = null, conMax = 0, cuandoCon = null;
  for (const mes of meses) { const f = { y: Y, m: mes, d: 15 }; for (let min = rango[0]; min <= rango[1]; min += 5) { const s = solEn(f, min); if (s.alt < 0.5) continue; const e = estado(k, s.d);
    if (e.vidrioSin > sin) { sin = e.vidrioSin; con = e.vidrioCon; cuando = `${f.d}/${f.m} ${hhmm(min)}`; }
    if (e.vidrioCon > conMax) { conMax = e.vidrioCon; cuandoCon = `${f.d}/${f.m} ${hhmm(min)}`; } } }
  return { sin, con, cuando, conMax, cuandoCon };
}
const maxSE = maxVidrio('se', [1], [6 * 60, 10 * 60]), maxSO = maxVidrio('so', [11, 12], [14 * 60, 18 * 60]);

// ---------------- salida ----------------
const pc = (x) => (x == null ? '—' : `${Math.round(x * 100)} %`);
const f1 = (x) => (x == null ? '—' : x.toFixed(1).replace('.', ','));
const nombreF = { se: 'SE', no: 'NO', ne: 'NE', so: 'SO' };
let md = `# Efecto de los vecinos en el análisis de sol del 106\n\n`;
md += `Trazado de rayos sobre la geometría del sitio (${Object.values(cuenta).reduce((a, c) => a + c.total, 0)} puntos de fachada: SE ${cuenta.se.total}, NO ${cuenta.no.total}, NE ${cuenta.ne.total}, SO ${cuenta.so.total}; de ellos ${Object.values(cuenta).reduce((a, c) => a + c.vidrio, 0)} en vidrio). `;
md += `«Sin vecinos» = el 106, su sitio y la vegetación, lo que el visor sombreaba antes; «con vecinos» = más los vecinos a menos de ~60 m (105, salón de Innova, Balboa Academy, estructura del cuadrángulo), que ahora sí proyectan sombra en el mapa de sombras. Porcentajes sobre el área de la fachada. Sol de ${Y} (NOAA).\n\n`;
md += `## 1. Energía directa de un año de cielo despejado (kWh/m², promedio de la fachada, con la sombra de aleros y vegetación)\n\n| Fachada | Sin vecinos | Con vecinos | Pierde | Vidrio sin | Vidrio con | Vidrio pierde |${rAntes ? ' Antes (modelo publicado) |' : ''}\n|---|---|---|---|---|---|---|${rAntes ? '---|' : ''}\n`;
for (const k of Object.keys(MARCO)) { const e = E[k]; md += `| ${nombreF[k]} | ${Math.round(e.sin)} | ${Math.round(e.con)} | ${pc(1 - e.con / e.sin)} | ${Math.round(e.vSin)} | ${Math.round(e.vCon)} | ${pc(1 - e.vCon / Math.max(1e-9, e.vSin))} |${rAntes ? ` ${Math.round(e.antes)} |` : ''}\n`; }
md += `\n## 2. Cuándo y cuánto: día 21 de cada mes, momentos en que los vecinos dejan en sombra al menos el 5 % de la fachada\n\n`;
md += `Por fachada y mes: ventana horaria, máximo de fachada que pasa de sol a sombra por los vecinos (y la hora), quién la da y, en ese momento, la fachada al sol sin y con vecinos. Los máximos caen casi siempre con el sol a pocos grados del horizonte, cuando llega poca energía; la última columna da el caso más fuerte con el sol a 10° o más.\n\n| Fachada | Mes | Horas | Máx. sombra de vecinos | Hora del máx. | Sol / altura | Quién | Al sol sin → con | Con el sol a ≥ 10°: hora · sombra · sin → con |\n|---|---|---|---|---|---|---|---|---|\n`;
const resumenMeses = [];
for (const k of Object.keys(MARCO)) for (let mes = 1; mes <= 12; mes++) {
  const F = tabla.filter((r) => r.k === k && r.mes === mes && r.sin - r.con >= 0.05);
  if (!F.length) continue;
  const mx = F.reduce((a, r) => (r.sin - r.con > a.sin - a.con ? r : a));
  const quien = Object.entries(F.reduce((a, r) => { for (const [q, c] of Object.entries(r.por)) a[q] = (a[q] ?? 0) + c; return a; }, {})).sort((a, b) => b[1] - a[1]).map(([q]) => q).join(', ');
  const t0 = Math.min(...F.map((r) => r.min)), t1 = Math.max(...F.map((r) => r.min));
  resumenMeses.push({ k, mes, desde: hhmm(t0), hasta: hhmm(t1), max: mx.sin - mx.con, hora: hhmm(mx.min), alt: mx.alt, az: mx.az, quien, sin: mx.sin, con: mx.con });
  const A = F.filter((r) => r.alt >= 10), m10 = A.length ? A.reduce((a, r) => (r.sin - r.con > a.sin - a.con ? r : a)) : null;
  resumenMeses.at(-1).alto = m10 ? { hora: hhmm(m10.min), alt: m10.alt, sombra: m10.sin - m10.con, sin: m10.sin, con: m10.con } : null;
  md += `| ${nombreF[k]} | ${MES[mes - 1]} | ${hhmm(t0)}–${hhmm(t1)} | ${pc(mx.sin - mx.con)} | ${hhmm(mx.min)} | az ${Math.round(mx.az)}° · ${f1(mx.alt)}° | ${quien} | ${pc(mx.sin)} → ${pc(mx.con)} | ${m10 ? `${hhmm(m10.min)} (${f1(m10.alt)}°) · ${pc(m10.sin - m10.con)} · ${pc(m10.sin)} → ${pc(m10.con)}` : '—'} |\n`;
}
md += `\n## 3. Lo que dice el visor, con y sin vecinos\n\n| Momento | Sol | Fachada al sol sin → con | Vidrio al sol sin → con | Vidrio del piso 2 sin → con |${rAntes ? ' Antes (fachada / vidrio) |' : ''}\n|---|---|---|---|---|${rAntes ? '---|' : ''}\n`;
for (const q of momentos) { const p2 = q.e.pisoV[2]; md += `| ${q.que} | az ${q.sol.az}° · ${f1(q.sol.alt)}° | ${pc(q.e.sin)} → ${pc(q.e.con)} | ${pc(q.e.vidrioSin)} → ${pc(q.e.vidrioCon)} | ${pc(p2[1] / Math.max(1, p2[0]))} → ${pc(p2[2] / Math.max(1, p2[0]))} |${rAntes ? ` ${pc(q.e.antes)} / ${pc(q.e.vidrioAntes)} |` : ''}\n`; }
md += `\nHallazgo «El alero de 1,65 m…» («más de la mitad del vidrio recibe sol en la SE hasta cerca de las 8:45 en enero, y en el SO desde cerca de las 15:40 en noviembre y diciembre»), mediana de los días del mes:\n\n`;
const franja = (c) => (c[0] == null ? 'ningún momento' : `${hhmm(c[0])}–${hhmm(c[1])}`);
md += `- SE, enero: más de la mitad del vidrio al sol de ${franja(vidrioSE.sin)} sin vecinos y de ${franja(vidrioSE.con)} con vecinos (${vidrioSE.diasSinMitad.con} de ${vidrioSE.diasSinMitad.de} días sin ningún momento). Máximo de vidrio al sol en la mañana del 15 de enero: ${pc(maxSE.sin)} sin vecinos (${maxSE.cuando}), ${pc(maxSE.con)} con vecinos en ese momento; con vecinos, el máximo es ${pc(maxSE.conMax)} (${maxSE.cuandoCon}).\n`;
md += `- SO, noviembre y diciembre: más de la mitad del vidrio al sol de ${franja(vidrioSO.sin)} sin vecinos y de ${franja(vidrioSO.con)} con vecinos (${vidrioSO.diasSinMitad.con} de ${vidrioSO.diasSinMitad.de} días sin ningún momento). Máximo de vidrio al sol en la tarde del 15 de nov/dic: ${pc(maxSO.sin)} sin vecinos (${maxSO.cuando}), ${pc(maxSO.con)} con vecinos en ese momento; con vecinos, el máximo es ${pc(maxSO.conMax)} (${maxSO.cuandoCon}).\n`;
md += `\nHallazgo «En las horas más cálidas…» (ERA5 2001–2025, horas de 30 °C o más): ${cal.horas} horas (${Math.round(cal.horas / 25)} al año); el sol está frente al SO en ${pc(cal.frenteSO / cal.horas)} e incide con más de 100 W/m² en ${pc(cal.so100 / cal.horas)}. `;
md += `En esas horas de más de 100 W/m², los vecinos dejan en sombra más del 5 % del SO en ${cal.soSombra105} (${pc(cal.soSombra105 / Math.max(1, cal.so100))}); el vidrio del SO recibe algo de sol en ${Math.round(cal.soVidrioSin / 25)} h al año sin vecinos y ${Math.round(cal.soVidrioCon / 25)} h con vecinos.\n`;
fs.writeFileSync(path.join(AQUI, `efecto${SAL ? '-' + SAL : ''}.md`), md);
fs.writeFileSync(path.join(AQUI, `efecto${SAL ? '-' + SAL : ''}.json`), JSON.stringify({ fecha: new Date().toISOString(), puntos: cuenta, energia: E, meses: resumenMeses, momentos: momentos.map(({ e, ...q }) => ({ ...q, e: { ...e, pisoV: undefined } })), vidrioSE, vidrioSO, maxSE, maxSO, horasCalidas: cal }, null, 1));
console.log(md);
