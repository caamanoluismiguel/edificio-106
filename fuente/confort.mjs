// Confort térmico precalculado de la serie horaria ERA5 2001–2025 (el mismo binario que carga el sitio): la carta psicrométrica
// (densidad de horas por temperatura y humedad absoluta, y qué parte cae en cada zona) y la sensación térmica UTCI al sol y bajo
// el alero, por mes. Escribe datos/confort.json en la raíz del sitio (y en public/datos/ si existe, para armar.sh). Todo sale de los datos.
//   cd fuente && node confort.mjs          (con --crudo, ERA5 sin el ajuste a Albrook)
// La temperatura y la humedad son las de ERA5 ajustado al aeropuerto de Albrook (datos/ajuste_albrook.json, src/ajuste.js), las
// mismas que muestra la app para cada hora; en «crudo» van también las cifras de la carta con ERA5 sin ajustar, como referencia.
// Fuentes de las zonas (ver cita completa en confort.json → fuentes):
//  - Givoni 1992, Energy and Buildings 18:11–23, variante «países cálidos en desarrollo» (línea punteada). Aire quieto: fig. 3
//    y texto §4.3 (20–29 °C hasta 12 g/kg, techo 17 g/kg). Ventilación diurna ~2 m/s: fig. 4. Los polígonos están digitalizados
//    de las figuras (±0,3 °C, ±0,5 g/kg); el texto no trae coordenadas.
//  - ASHRAE 55-2017 §5.4, modelo adaptativo: t_confort = 0,31·t_pma + 17,8 °C, aceptabilidad 80 % = ±3,5 °C; con aire en
//    movimiento se suma 1,2 / 1,8 / 2,2 °C a 0,6 / 0,9 / 1,2 m/s cuando la temperatura operativa pasa de 25 °C. t_pma: media de
//    las medias diarias de los 7 días anteriores (la norma admite de 7 a 30). Aquí la temperatura operativa se toma igual a la
//    del aire exterior a la sombra: es la suposición de un aula ventilada y liviana que sigue al aire de afuera. Adentro el sol
//    en muros y techo y la gente la suben, así que el porcentaje de ASHRAE es una cota superior.
//    Aplicabilidad: espacios naturalmente acondicionados controlados por los ocupantes, con ventanas que ellos abren y
//    cierran; sin refrigeración mecánica ni calefacción en marcha; actividad casi sedentaria; ropa que pueden adaptar
//    libremente (de Dear y Brager 2002, Energy and Buildings 34(6):549–561, §4.1, p. 556, doi:10.1016/S0378-7788(02)00005-1);
//    t_pma entre 10 y 33,5 °C (§5.4.1, citado en Simmonds 2022, CLIMA 2022; aquí, de ~25 a ~29 °C).
//  - Horas que cuentan: un horario de clase diurno, de 7:00 a 17:00 (11 lecturas por día). En ese
//    tramo el sol está sobre el horizonte todo el año (sale entre 5:58 y 6:39 y se pone entre 17:54 y 18:42, según src/sol.js).
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { posicionSol } from './src/sol.js';
import { ajustarT, ajustarHR, ruidoT } from './src/ajuste.js';
import { utci, categoriaUTCI, CATEGORIAS_UTCI, tmrtSol, tmrtSombra, humedadAbs, dentroPoligono as dentro, GIVONI } from './src/confort.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const b = zlib.gunzipSync(fs.readFileSync(path.join(AQUI, '../datos/clima_horario.bin.gz')));
const n = b.readUInt32LE(4);
// formato C107 (fuente/clima_bin.py): columnas de n bytes, salvo la lluvia, uint16 (2n bytes); aquí no se usa la lluvia
if (b.toString('latin1', 0, 4) !== 'C107') throw new Error('clima_horario.bin: se esperaba el formato C107');
const COLS = ['nubes', 'lluvia', 'temp', 'humedad', 'dni', 'difusa', 'viento', 'dir'], ANCHO = { lluvia: 2 };
const INICIO = {}; { let o = 8; for (const k of COLS) { INICIO[k] = o; o += (ANCHO[k] ?? 1) * n; } }
const col = (k) => b.subarray(INICIO[k], INICIO[k] + (ANCHO[k] ?? 1) * n);
const Tc = col('temp'), Hc = col('humedad'), DNIc = col('dni'), DIFc = col('difusa'), Vc = col('viento');
const T0 = Date.UTC(2001, 0, 1, 0);          // primera hora de la serie (hora de Panamá tratada como UTC, como en clima.js)
const OCUPADA = { desde: 7, hasta: 17 };     // lecturas de las 7:00 a las 17:00, ambas incluidas (la serie empieza a medianoche)
const enClase = (i) => { const h = i % 24; return h >= OCUPADA.desde && h <= OCUPADA.hasta; };

const { quieto: QUIETO, ventilacion: VENTILACION } = GIVONI;
// temperatura y humedad de cada hora: ERA5 ajustado a Albrook (o crudo con --crudo)
const AJ = process.argv.includes('--crudo') ? null : JSON.parse(fs.readFileSync(path.join(AQUI, '../datos/ajuste_albrook.json')));
const TCr = new Float64Array(n), HCr = new Float64Array(n), TA = new Float64Array(n), HA = new Float64Array(n);
for (let i = 0; i < n; i++) {
  TCr[i] = Tc[i] / 6 + 10; HCr[i] = Hc[i];
  if (!AJ) { TA[i] = TCr[i]; HA[i] = HCr[i]; continue; }
  const m = new Date(T0 + i * 3.6e6).getUTCMonth() + 1, tj = TCr[i] + ruidoT(i);
  TA[i] = ajustarT(AJ, tj, m, i % 24); HA[i] = ajustarHR(AJ, tj, HCr[i], TA[i], m);
}
/** Porcentajes de la carta en horas de clase para una serie de temperatura y humedad (para la referencia «crudo»). */
function pctCarta(T, H) {
  const md = new Float64Array(Math.floor(n / 24)); for (let d = 0; d < md.length; d++) { let s = 0; for (let h = 0; h < 24; h++) s += T[d * 24 + h]; md[d] = s / 24; }
  const k = { horas: 0, quieto: 0, ventilacion: 0, a80: 0, a80_06: 0 };
  for (let i = 7 * 24; i < n; i++) {
    if (!enClase(i)) continue; const t = T[i], w = humedadAbs(t, H[i]), d = Math.floor(i / 24);
    let tp = 0; for (let j = 1; j <= 7; j++) tp += md[d - j]; tp /= 7; const tc = 0.31 * tp + 17.8;
    k.horas++; if (dentro(t, w, QUIETO)) k.quieto++; if (dentro(t, w, VENTILACION)) k.ventilacion++;
    if (t >= tc - 3.5 && t <= tc + 3.5) k.a80++; if (t >= tc - 3.5 && t <= tc + 3.5 + (t > 25 ? 1.2 : 0)) k.a80_06++;
  }
  const q = (x) => Math.round(1000 * x / k.horas) / 10;
  return { quieto: q(k.quieto), ventilacion: q(k.ventilacion), adaptativo80: q(k.a80), adaptativo80_06: q(k.a80_06) };
}

// ---------- carta psicrométrica ----------
const C = { t0: 18, t1: 36, w0: 8, w1: 24 };                // rejilla de 1 °C × 1 g/kg
const celdas = Array.from({ length: C.w1 - C.w0 }, () => new Array(C.t1 - C.t0).fill(0));
let fuera = 0;
// t_pma: media de las medias diarias de los 7 días anteriores
const dias = Math.floor(n / 24), mediaDia = new Float64Array(dias);
for (let d = 0; d < dias; d++) { let s = 0; for (let h = 0; h < 24; h++) s += TA[d * 24 + h]; mediaDia[d] = s / 24; }
const cuenta = { horas: 0, quieto: 0, ventilacion: 0, a80: 0, a80_06: 0, a80_09: 0, a80_12: 0 };
const todas = { horas: 0, quieto: 0, ventilacion: 0, a80: 0 };   // las 24 horas, solo como referencia en el JSON
let tpmaMin = 99, tpmaMax = -99, tpmaSum = 0, tpmaN = 0;
for (let i = 0; i < n; i++) {
  const t = TA[i], rh = HA[i], w = humedadAbs(t, rh), d = Math.floor(i / 24);
  if (d < 7) continue;                                         // la primera semana no tiene t_pma
  let tp = 0; for (let k = 1; k <= 7; k++) tp += mediaDia[d - k]; tp /= 7;
  const tc = 0.31 * tp + 17.8, lo = tc - 3.5, hi = tc + 3.5;
  todas.horas++; if (dentro(t, w, QUIETO)) todas.quieto++; if (dentro(t, w, VENTILACION)) todas.ventilacion++; if (t >= lo && t <= hi) todas.a80++;
  if (!enClase(i)) continue;
  cuenta.horas++;
  const ci = Math.floor(t - C.t0), cj = Math.floor(w - C.w0);
  if (ci >= 0 && ci < C.t1 - C.t0 && cj >= 0 && cj < C.w1 - C.w0) celdas[cj][ci]++; else fuera++;
  if (dentro(t, w, QUIETO)) cuenta.quieto++;
  if (dentro(t, w, VENTILACION)) cuenta.ventilacion++;
  tpmaMin = Math.min(tpmaMin, tp); tpmaMax = Math.max(tpmaMax, tp); tpmaSum += tp; tpmaN++;
  const extra = (dv) => (t > 25 ? dv : 0);
  if (t >= lo && t <= hi) cuenta.a80++;
  if (t >= lo && t <= hi + extra(1.2)) cuenta.a80_06++;
  if (t >= lo && t <= hi + extra(1.8)) cuenta.a80_09++;
  if (t >= lo && t <= hi + extra(2.2)) cuenta.a80_12++;
}
const pct = (x) => Math.round(1000 * x / cuenta.horas) / 10;
// (Antes aquí se restaba la humedad de Tocumen para ver cuánto dependía la carta del sesgo de ERA5. Se quitó el 2 de octubre
// de 2026: corregir solo la humedad sin la temperatura da una cifra de Givoni falsa; ahora se ajustan las dos con Albrook.)

// ---------- UTCI al sol y bajo el alero, horas de día, por mes ----------
// la radiación de la hora H es el promedio de H−1 a H (Open-Meteo): el sol se toma a H−0:30; la temperatura, la humedad y el
// viento, los de la hora H (instantáneos). Viento a 10 m de ERA5 (la altura de referencia del UTCI), recortado a 0,5 m/s en calma.
const NC = CATEGORIAS_UTCI.length;
const meses = Array.from({ length: 12 }, () => ({ sol: new Array(NC).fill(0), sombra: new Array(NC).fill(0), horas: 0 }));
let alivioSum = 0, alivioN = 0;
for (let i = 0; i < n; i++) {
  const f = new Date(T0 + i * 3.6e6), y = f.getUTCFullYear(), m = f.getUTCMonth() + 1, dd = f.getUTCDate(), h = f.getUTCHours();
  const p = posicionSol({ y, m, d: dd, h, min: -30 });
  if (p.alt <= 5) continue;                                    // de día, con el sol por encima de 5°
  const ta = TA[i], rh = HA[i], va = Vc[i] / 3.6, dni = DNIc[i] * 4, dif = DIFc[i] * 4;
  const uSol = utci(ta, tmrtSol({ ta, altSol: p.alt, dni, difusa: dif }), va, rh, { recortarViento: true });
  const uSom = utci(ta, tmrtSombra({ ta, difusa: dif, altSol: p.alt, dni }), va, rh, { recortarViento: true });
  if (!Number.isFinite(uSol) || !Number.isFinite(uSom)) continue;
  const M = meses[m - 1]; M.horas++; M.sol[categoriaUTCI(uSol)]++; M.sombra[categoriaUTCI(uSom)]++;
  alivioSum += uSol - uSom; alivioN++;
}
const anual = { sol: new Array(NC).fill(0), sombra: new Array(NC).fill(0), horas: 0 };
for (const M of meses) { anual.horas += M.horas; for (let k = 0; k < NC; k++) { anual.sol[k] += M.sol[k]; anual.sombra[k] += M.sombra[k]; } }

const salida = {
  generado: 'fuente/confort.mjs, a partir de datos/clima_horario.bin (ERA5 2001–2025 vía Open-Meteo, celda de ~28 km)',
  horas: cuenta.horas, ocupacion: OCUPADA, carta: { ...C, celdas, fueraDeRejilla: fuera },
  zonas: { quieto: QUIETO, ventilacion: VENTILACION },
  pct: { quieto: pct(cuenta.quieto), ventilacion: pct(cuenta.ventilacion), adaptativo80: pct(cuenta.a80), adaptativo80_06: pct(cuenta.a80_06), adaptativo80_09: pct(cuenta.a80_09), adaptativo80_12: pct(cuenta.a80_12) },
  todasLasHoras: { horas: todas.horas, quieto: Math.round(1000 * todas.quieto / todas.horas) / 10, ventilacion: Math.round(1000 * todas.ventilacion / todas.horas) / 10, adaptativo80: Math.round(1000 * todas.a80 / todas.horas) / 10 },
  tpma: { min: +tpmaMin.toFixed(1), max: +tpmaMax.toFixed(1), media: +(tpmaSum / tpmaN).toFixed(1) },
  ajuste: AJ ? { fuente: 'ERA5 ajustado al aeropuerto de Albrook (MPMG, a 4,1 km)', calibracion: AJ.calibracion } : null,
  crudo: AJ ? pctCarta(TCr, HCr) : null,
  utci: { categorias: CATEGORIAS_UTCI.map((c) => c.nombre), meses, anual, alivioMedioAlero: +(alivioSum / alivioN).toFixed(1), solMin: 5 },
  fuentes: [
    'Givoni, B. (1992). Comfort, climate analysis and building design guidelines. Energy and Buildings 18(1), 11–23. doi:10.1016/0378-7788(92)90047-K',
    'ASHRAE 55-2017. Thermal Environmental Conditions for Human Occupancy, §5.4 (modelo adaptativo) y apéndice C (SolarCal).',
    'de Dear, R. J. y Brager, G. S. (2002). Thermal comfort in naturally ventilated buildings: revisions to ASHRAE Standard 55. Energy and Buildings 34(6), 549–561. doi:10.1016/S0378-7788(02)00005-1',
    'Bröde, P. et al. (2012). Deriving the operational procedure for the Universal Thermal Climate Index (UTCI). Int J Biometeorol 56, 481–494. doi:10.1007/s00484-011-0454-1',
    'Arens, E. et al. (2015). Modeling the comfort effects of short-wave solar radiation indoors. Building and Environment 88, 3–9. doi:10.1016/j.buildenv.2014.09.004',
    'METAR del aeropuerto de Albrook (MPMG), partes de rutina 2017–2025, Iowa Environmental Mesonet (mesonet.agron.iastate.edu): calibración del ajuste de temperatura y humedad.',
    'Tartarini, F. y Schiavon, S. (2020). pythermalcomfort. SoftwareX 12, 100578. doi:10.1016/j.softx.2020.100578 (implementación de referencia; errores < 1e-11 °C)',
  ],
};
const destinos = [path.join(AQUI, '../datos/confort.json'), ...(fs.existsSync(path.join(AQUI, 'public/datos')) ? [path.join(AQUI, 'public/datos/confort.json')] : [])];
for (const out of destinos) fs.writeFileSync(out, JSON.stringify(salida));
console.log(`${cuenta.horas} horas de clase (${OCUPADA.desde}:00 a ${OCUPADA.hasta}:00) · Givoni quieto ${salida.pct.quieto} % · ventilación ${salida.pct.ventilacion} % · adaptativo 80 % ${salida.pct.adaptativo80} % (1,2 m/s: ${salida.pct.adaptativo80_12} %) · t_pma ${tpmaMin.toFixed(1)}–${tpmaMax.toFixed(1)} °C`);
console.log(`UTCI de día (${anual.horas} h): al sol`, anual.sol.map((x, k) => x && `${CATEGORIAS_UTCI[k].nombre} ${Math.round(100 * x / anual.horas)} %`).filter(Boolean).join(' · '));
console.log('              bajo el alero', anual.sombra.map((x, k) => x && `${CATEGORIAS_UTCI[k].nombre} ${Math.round(100 * x / anual.horas)} %`).filter(Boolean).join(' · '), `· alivio medio del alero ${salida.utci.alivioMedioAlero} °C`);
if (salida.crudo) console.log(`ERA5 sin ajustar: Givoni quieto ${salida.crudo.quieto} % · ventilación ${salida.crudo.ventilacion} % · adaptativo 80 % ${salida.crudo.adaptativo80} % (0,6 m/s: ${salida.crudo.adaptativo80_06} %)`);
console.log(`las 24 horas (${todas.horas}): Givoni quieto ${salida.todasLasHoras.quieto} % · ventilación ${salida.todasLasHoras.ventilacion} % · adaptativo 80 % ${salida.todasLasHoras.adaptativo80} %`);
console.log(`fuera de la rejilla de la carta: ${fuera} h · ${(fs.statSync(destinos[0]).size / 1024).toFixed(1)} KB`);
