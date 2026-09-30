// Confort térmico al aire libre: UTCI y temperatura radiante media de una persona al sol y bajo el alero.
//
// Fuentes
// - UTCI: Bröde P. et al. (2012) «Deriving the operational procedure for the Universal Thermal Climate Index (UTCI)».
//   Int J Biometeorol 56:481–494. DOI 10.1007/s00484-011-0454-1. Polinomio operativo de 6.º orden (210 términos).
// - ΔMRT solar: método SolarCal, ASHRAE 55-2017 Apéndice C; Arens E. et al. (2015) «Modeling the comfort effects of
//   short-wave solar radiation indoors». Building and Environment 88:3–9. DOI 10.1016/j.buildenv.2014.09.004.
// - Implementación de referencia portada: pythermalcomfort 4.6.0 (models/utci.py y models/solar_gain.py),
//   https://github.com/CenterForTheBuiltEnvironment/pythermalcomfort
//
// Atribución (licencia MIT de pythermalcomfort): los coeficientes del polinomio UTCI, el cálculo de la presión de vapor,
// la tabla de factor de área proyectada (de pie) y las ecuaciones de ERF/ΔMRT se portaron de pythermalcomfort,
// Copyright (c) 2019 Federico Tartarini. Se permite su uso, copia, modificación y distribución siempre que se conserve
// este aviso; el software se entrega «tal cual», sin garantía de ningún tipo.
// Verificación contra la referencia: verificacion/confort/comparar-utci.mjs.

// ───────────────────────────── UTCI ─────────────────────────────

// Términos [coeficiente, exp. ta, exp. va, exp. (tmrt − ta), exp. pa]; UTCI = ta + Σ c·ta^i·va^j·Δt^k·pa^l.
// Extraídos automáticamente del árbol sintáctico de _utci_optimized (pythermalcomfort), sin transcripción a mano.
const TERMINOS = [
  [0.607562052, 0, 0, 0, 0], [-0.0227712343, 1, 0, 0, 0], [8.06470249e-4, 2, 0, 0, 0],
  [-1.54271372e-4, 3, 0, 0, 0], [-3.24651735e-6, 4, 0, 0, 0], [7.32602852e-8, 5, 0, 0, 0],
  [1.35959073e-9, 6, 0, 0, 0], [-2.2583652, 0, 1, 0, 0], [0.0880326035, 1, 1, 0, 0],
  [0.00216844454, 2, 1, 0, 0], [-1.53347087e-5, 3, 1, 0, 0], [-5.72983704e-7, 4, 1, 0, 0],
  [-2.55090145e-9, 5, 1, 0, 0], [-0.751269505, 0, 2, 0, 0], [-0.00408350271, 1, 2, 0, 0],
  [-5.21670675e-5, 2, 2, 0, 0], [1.94544667e-6, 3, 2, 0, 0], [1.14099531e-8, 4, 2, 0, 0],
  [0.158137256, 0, 3, 0, 0], [-6.57263143e-5, 1, 3, 0, 0], [2.22697524e-7, 2, 3, 0, 0],
  [-4.16117031e-8, 3, 3, 0, 0], [-0.0127762753, 0, 4, 0, 0], [9.66891875e-6, 1, 4, 0, 0],
  [2.52785852e-9, 2, 4, 0, 0], [4.56306672e-4, 0, 5, 0, 0], [-1.74202546e-7, 1, 5, 0, 0],
  [-5.91491269e-6, 0, 6, 0, 0], [0.398374029, 0, 0, 1, 0], [1.83945314e-4, 1, 0, 1, 0],
  [-1.7375451e-4, 2, 0, 1, 0], [-7.60781159e-7, 3, 0, 1, 0], [3.77830287e-8, 4, 0, 1, 0],
  [5.43079673e-10, 5, 0, 1, 0], [-0.0200518269, 0, 1, 1, 0], [8.92859837e-4, 1, 1, 1, 0],
  [3.45433048e-6, 2, 1, 1, 0], [-3.77925774e-7, 3, 1, 1, 0], [-1.69699377e-9, 4, 1, 1, 0],
  [1.69992415e-4, 0, 2, 1, 0], [-4.99204314e-5, 1, 2, 1, 0], [2.47417178e-7, 2, 2, 1, 0],
  [1.07596466e-8, 3, 2, 1, 0], [8.49242932e-5, 0, 3, 1, 0], [1.35191328e-6, 1, 3, 1, 0],
  [-6.21531254e-9, 2, 3, 1, 0], [-4.99410301e-6, 0, 4, 1, 0], [-1.89489258e-8, 1, 4, 1, 0],
  [8.15300114e-8, 0, 5, 1, 0], [7.5504309e-4, 0, 0, 2, 0], [-5.65095215e-5, 1, 0, 2, 0],
  [-4.52166564e-7, 2, 0, 2, 0], [2.46688878e-8, 3, 0, 2, 0], [2.42674348e-10, 4, 0, 2, 0],
  [1.5454725e-4, 0, 1, 2, 0], [5.2411097e-6, 1, 1, 2, 0], [-8.75874982e-8, 2, 1, 2, 0],
  [-1.50743064e-9, 3, 1, 2, 0], [-1.56236307e-5, 0, 2, 2, 0], [-1.33895614e-7, 1, 2, 2, 0],
  [2.49709824e-9, 2, 2, 2, 0], [6.51711721e-7, 0, 3, 2, 0], [1.94960053e-9, 1, 3, 2, 0],
  [-1.00361113e-8, 0, 4, 2, 0], [-1.21206673e-5, 0, 0, 3, 0], [-2.1820366e-7, 1, 0, 3, 0],
  [7.51269482e-9, 2, 0, 3, 0], [9.79063848e-11, 3, 0, 3, 0], [1.25006734e-6, 0, 1, 3, 0],
  [-1.81584736e-9, 1, 1, 3, 0], [-3.52197671e-10, 2, 1, 3, 0], [-3.3651463e-8, 0, 2, 3, 0],
  [1.35908359e-10, 1, 2, 3, 0], [4.1703262e-10, 0, 3, 3, 0], [-1.30369025e-9, 0, 0, 4, 0],
  [4.13908461e-10, 1, 0, 4, 0], [9.22652254e-12, 2, 0, 4, 0], [-5.08220384e-9, 0, 1, 4, 0],
  [-2.24730961e-11, 1, 1, 4, 0], [1.17139133e-10, 0, 2, 4, 0], [6.62154879e-10, 0, 0, 5, 0],
  [4.0386326e-13, 1, 0, 5, 0], [1.95087203e-12, 0, 1, 5, 0], [-4.73602469e-12, 0, 0, 6, 0],
  [5.12733497, 0, 0, 0, 1], [-0.312788561, 1, 0, 0, 1], [-0.0196701861, 2, 0, 0, 1],
  [9.9969087e-4, 3, 0, 0, 1], [9.51738512e-6, 4, 0, 0, 1], [-4.66426341e-7, 5, 0, 0, 1],
  [0.548050612, 0, 1, 0, 1], [-0.00330552823, 1, 1, 0, 1], [-0.0016411944, 2, 1, 0, 1],
  [-5.16670694e-6, 3, 1, 0, 1], [9.52692432e-7, 4, 1, 0, 1], [-0.0429223622, 0, 2, 0, 1],
  [0.00500845667, 1, 2, 0, 1], [1.00601257e-6, 2, 2, 0, 1], [-1.81748644e-6, 3, 2, 0, 1],
  [-1.25813502e-3, 0, 3, 0, 1], [-1.79330391e-4, 1, 3, 0, 1], [2.34994441e-6, 2, 3, 0, 1],
  [1.29735808e-4, 0, 4, 0, 1], [1.2906487e-6, 1, 4, 0, 1], [-2.28558686e-6, 0, 5, 0, 1],
  [-0.0369476348, 0, 0, 1, 1], [0.00162325322, 1, 0, 1, 1], [-3.1427968e-5, 2, 0, 1, 1],
  [2.59835559e-6, 3, 0, 1, 1], [-4.77136523e-8, 4, 0, 1, 1], [8.6420339e-3, 0, 1, 1, 1],
  [-6.87405181e-4, 1, 1, 1, 1], [-9.13863872e-6, 2, 1, 1, 1], [5.15916806e-7, 3, 1, 1, 1],
  [-3.59217476e-5, 0, 2, 1, 1], [3.28696511e-5, 1, 2, 1, 1], [-7.10542454e-7, 2, 2, 1, 1],
  [-1.243823e-5, 0, 3, 1, 1], [-7.385844e-9, 1, 3, 1, 1], [2.20609296e-7, 0, 4, 1, 1],
  [-7.3246918e-4, 0, 0, 2, 1], [-1.87381964e-5, 1, 0, 2, 1], [4.80925239e-6, 2, 0, 2, 1],
  [-8.7549204e-8, 3, 0, 2, 1], [2.7786293e-5, 0, 1, 2, 1], [-5.06004592e-6, 1, 1, 2, 1],
  [1.14325367e-7, 2, 1, 2, 1], [2.53016723e-6, 0, 2, 2, 1], [-1.72857035e-8, 1, 2, 2, 1],
  [-3.95079398e-8, 0, 3, 2, 1], [-3.59413173e-7, 0, 0, 3, 1], [7.04388046e-7, 1, 0, 3, 1],
  [-1.89309167e-8, 2, 0, 3, 1], [-4.79768731e-7, 0, 1, 3, 1], [7.96079978e-9, 1, 1, 3, 1],
  [1.62897058e-9, 0, 2, 3, 1], [3.94367674e-8, 0, 0, 4, 1], [-1.18566247e-9, 1, 0, 4, 1],
  [3.34678041e-10, 0, 1, 4, 1], [-1.15606447e-10, 0, 0, 5, 1], [-2.80626406, 0, 0, 0, 2],
  [0.548712484, 1, 0, 0, 2], [-0.0039942841, 2, 0, 0, 2], [-9.54009191e-4, 3, 0, 0, 2],
  [1.93090978e-5, 4, 0, 0, 2], [-0.308806365, 0, 1, 0, 2], [0.0116952364, 1, 1, 0, 2],
  [4.95271903e-4, 2, 1, 0, 2], [-1.90710882e-5, 3, 1, 0, 2], [0.00210787756, 0, 2, 0, 2],
  [-6.98445738e-4, 1, 2, 0, 2], [2.30109073e-5, 2, 2, 0, 2], [4.1785659e-4, 0, 3, 0, 2],
  [-1.27043871e-5, 1, 3, 0, 2], [-3.04620472e-6, 0, 4, 0, 2], [0.0514507424, 0, 0, 1, 2],
  [-0.00432510997, 1, 0, 1, 2], [8.99281156e-5, 2, 0, 1, 2], [-7.14663943e-7, 3, 0, 1, 2],
  [-2.66016305e-4, 0, 1, 1, 2], [2.63789586e-4, 1, 1, 1, 2], [-7.01199003e-6, 2, 1, 1, 2],
  [-1.06823306e-4, 0, 2, 1, 2], [3.61341136e-6, 1, 2, 1, 2], [2.29748967e-7, 0, 3, 1, 2],
  [3.04788893e-4, 0, 0, 2, 2], [-6.42070836e-5, 1, 0, 2, 2], [1.16257971e-6, 2, 0, 2, 2],
  [7.68023384e-6, 0, 1, 2, 2], [-5.47446896e-7, 1, 1, 2, 2], [-3.5993791e-8, 0, 2, 2, 2],
  [-4.36497725e-6, 0, 0, 3, 2], [1.68737969e-7, 1, 0, 3, 2], [2.67489271e-8, 0, 1, 3, 2],
  [3.23926897e-9, 0, 0, 4, 2], [-0.0353874123, 0, 0, 0, 3], [-0.22120119, 1, 0, 0, 3],
  [0.0155126038, 2, 0, 0, 3], [-2.63917279e-4, 3, 0, 0, 3], [0.0453433455, 0, 1, 0, 3],
  [-0.00432943862, 1, 1, 0, 3], [1.45389826e-4, 2, 1, 0, 3], [2.1750861e-4, 0, 2, 0, 3],
  [-6.66724702e-5, 1, 2, 0, 3], [3.3321714e-5, 0, 3, 0, 3], [-0.00226921615, 0, 0, 1, 3],
  [3.80261982e-4, 1, 0, 1, 3], [-5.45314314e-9, 2, 0, 1, 3], [-7.96355448e-4, 0, 1, 1, 3],
  [2.53458034e-5, 1, 1, 1, 3], [-6.31223658e-6, 0, 2, 1, 3], [3.02122035e-4, 0, 0, 2, 3],
  [-4.77403547e-6, 1, 0, 2, 3], [1.73825715e-6, 0, 1, 2, 3], [-4.09087898e-7, 0, 0, 3, 3],
  [0.614155345, 0, 0, 0, 4], [-0.0616755931, 1, 0, 0, 4], [0.00133374846, 2, 0, 0, 4],
  [0.00355375387, 0, 1, 0, 4], [-5.13027851e-4, 1, 1, 0, 4], [1.02449757e-4, 0, 2, 0, 4],
  [-0.00148526421, 0, 0, 1, 4], [-4.11469183e-5, 1, 0, 1, 4], [-6.80434415e-6, 0, 1, 1, 4],
  [-9.77675906e-6, 0, 0, 2, 4], [0.0882773108, 0, 0, 0, 5], [-0.00301859306, 1, 0, 0, 5],
  [0.00104452989, 0, 1, 0, 5], [2.47090539e-4, 0, 0, 1, 5], [0.00148348065, 0, 0, 0, 6],
];

// Presión de vapor de saturación (hPa) sobre agua, como la referencia (Hardy 1998 / ITS-90).
const G = [-2836.5744, -6028.076559, 19.54263612, -0.02737830188, 0.000016261698, 7.0229056e-10, -1.8680009e-13];
function presionSaturacion(ta) {
  const tk = ta + 273.15;
  let es = 2.7150305 * Math.log(tk);
  for (let i = 0; i < G.length; i++) es += G[i] * Math.pow(tk, i - 2);
  return Math.exp(es) * 0.01;
}

/** UTCI (°C). ta: aire °C; tmrt: radiante media °C; va: viento a 10 m (m/s); rh: humedad relativa %.
 *  Fuera del rango de validez (ta −50…50, tmrt − ta −30…70, va 0,5…17, límites incluidos) devuelve NaN, igual que
 *  la referencia con limit_inputs=True. La referencia no recorta el viento: con { recortarViento: true } se lleva va
 *  a 0,5…17 antes de evaluar (práctica habitual para calma, p. ej. viento de 0,2 m/s → 0,5). Sin redondear. */
export function utci(ta, tmrt, va, rh, { recortarViento = false } = {}) {
  if (recortarViento) va = Math.min(17, Math.max(0.5, va));
  const dt = tmrt - ta;
  if (!(ta >= -50 && ta <= 50 && dt >= -30 && dt <= 70 && va >= 0.5 && va <= 17)) return NaN;
  const pa = presionSaturacion(ta) * (rh / 100) / 10;  // kPa
  // potencias 0..6 de cada variable, una sola vez
  const P = [ta, va, dt, pa].map((x) => { const p = [1]; for (let i = 1; i <= 6; i++) p[i] = p[i - 1] * x; return p; });
  let u = ta;
  for (const [c, i, j, k, l] of TERMINOS) u += c * P[0][i] * P[1][j] * P[2][k] * P[3][l];
  return u;
}

// Las 10 categorías oficiales de estrés térmico (Bröde et al. 2012); min incluido, max excluido.
export const CATEGORIAS_UTCI = [
  { min: -Infinity, max: -40, nombre: 'Estrés por frío extremo' },
  { min: -40, max: -27, nombre: 'Estrés por frío muy fuerte' },
  { min: -27, max: -13, nombre: 'Estrés por frío fuerte' },
  { min: -13, max: 0, nombre: 'Estrés por frío moderado' },
  { min: 0, max: 9, nombre: 'Estrés por frío leve' },
  { min: 9, max: 26, nombre: 'Sin estrés térmico' },
  { min: 26, max: 32, nombre: 'Estrés por calor moderado' },
  { min: 32, max: 38, nombre: 'Estrés por calor fuerte' },
  { min: 38, max: 46, nombre: 'Estrés por calor muy fuerte' },
  { min: 46, max: Infinity, nombre: 'Estrés por calor extremo' },
];

/** Índice 0..9 de la categoría de estrés para un UTCI (−1 si es NaN). */
export function categoriaUTCI(u) {
  if (Number.isNaN(u)) return -1;
  for (let i = 0; i < CATEGORIAS_UTCI.length; i++) if (u < CATEGORIAS_UTCI[i].max) return i;
  return CATEGORIAS_UTCI.length - 1;
}

// ─────────────────────────── SolarCal ───────────────────────────

const ALT = [0, 15, 30, 45, 60, 75, 90];
// Factor de área proyectada fp de una persona DE PIE: filas = SHARP 0,15…180° (acimut del sol respecto al frente),
// columnas = altura solar 0,15…90°. ASHRAE 55 tabla C2-1, tal como la trae pythermalcomfort.
const FP_DE_PIE = [
  [0.35, 0.35, 0.314, 0.258, 0.206, 0.144, 0.082],
  [0.342, 0.342, 0.31, 0.252, 0.2, 0.14, 0.082],
  [0.33, 0.33, 0.3, 0.244, 0.19, 0.132, 0.082],
  [0.31, 0.31, 0.275, 0.228, 0.175, 0.124, 0.082],
  [0.283, 0.283, 0.251, 0.208, 0.16, 0.114, 0.082],
  [0.252, 0.252, 0.228, 0.188, 0.15, 0.108, 0.082],
  [0.23, 0.23, 0.214, 0.18, 0.148, 0.108, 0.082],
  [0.242, 0.242, 0.222, 0.18, 0.153, 0.112, 0.082],
  [0.274, 0.274, 0.245, 0.203, 0.165, 0.116, 0.082],
  [0.304, 0.304, 0.27, 0.22, 0.174, 0.121, 0.082],
  [0.328, 0.328, 0.29, 0.234, 0.183, 0.125, 0.082],
  [0.344, 0.344, 0.304, 0.244, 0.19, 0.128, 0.082],
  [0.347, 0.347, 0.308, 0.246, 0.191, 0.128, 0.082],
];
// Promedio de fp sobre SHARP uniforme en 0…180° (la persona gira o no sabemos hacia dónde mira). Como la referencia
// interpola lineal entre filas, el promedio exacto es la regla del trapecio sobre las 13 filas.
const FP_PROMEDIO = ALT.map((_, c) => {
  let s = 0; for (let r = 0; r < 12; r++) s += (FP_DE_PIE[r][c] + FP_DE_PIE[r + 1][c]) / 2;
  return s / 12;
});

function interpolar(xs, ys, x) {
  for (let i = 0; i < xs.length - 1; i++) {
    if (x >= xs[i] && x <= xs[i + 1]) return ys[i] + (ys[i + 1] - ys[i]) * (x - xs[i]) / (xs[i + 1] - xs[i]);
  }
  return NaN;
}

/** Factor de área proyectada de pie; sharp en grados 0…180 o null para el promedio sobre orientaciones. */
function fpDePie(altSol, sharp) {
  if (sharp == null) return interpolar(ALT, FP_PROMEDIO, altSol);
  // bilineal en (sharp, altura), como la referencia
  if (!(sharp >= 0 && sharp <= 180)) return NaN;
  const r = Math.min(11, Math.floor(sharp / 15)), t = (sharp - r * 15) / 15;
  return interpolar(ALT, FP_DE_PIE[r].map((v, c) => v * (1 - t) + FP_DE_PIE[r + 1][c] * t), altSol);
}

const F_EFF = 0.725;  // fracción del cuerpo (de pie) que intercambia radiación con el entorno
const HR = 6;         // coeficiente radiativo, W/m²K
const ABS_LW = 0.95;  // absortividad de onda larga

/** ΔMRT solar (°C) de una persona de pie, SolarCal (ASHRAE 55 Ap. C) como en pythermalcomfort solar_gain.
 *  Diferencia con la referencia: ella supone difusa = 0,2·dni (caso interior); aquí la difusa horizontal se pasa aparte.
 *  altSol: altura solar °; dni y difusa: W/m²; sharp: acimut relativo 0…180° o null (promedio, valor por defecto);
 *  fsvv: fracción de bóveda celeste vista (1 a cielo abierto); fbes: fracción del cuerpo al sol (1 sin sombras);
 *  asw: absortividad de onda corta (0,7 como la referencia); reflectancia: del suelo (0,2 exterior; la referencia usa
 *  0,6 para piso interior); transmitancia: 1 al aire libre. Con el sol bajo el horizonte no hay directa. */
export function deltaMrtSolar({ altSol, dni, difusa, sharp = null, fsvv = 1, fbes = 1, asw = 0.7, reflectancia = 0.2, transmitancia = 1 }) {
  if (altSol > 90) return NaN;
  const sobre = altSol > 0 && dni > 0;
  const fp = sobre ? fpDePie(altSol, sharp) : 0;
  const seno = sobre ? Math.sin(altSol * Math.PI / 180) : 0;
  const eDif = F_EFF * fsvv * 0.5 * transmitancia * difusa;
  const eDir = F_EFF * fp * transmitancia * fbes * dni;
  const eRef = F_EFF * fsvv * 0.5 * transmitancia * (dni * seno + difusa) * reflectancia;
  const erf = (eDif + eDir + eRef) * (asw / ABS_LW);
  return erf / (HR * F_EFF);
}

/** Temperatura radiante media de una persona de pie AL SOL (°C). La MRT base sin sol se aproxima con ta (se rotula
 *  en la interfaz): no se modela el déficit de onda larga del cielo ni el suelo caliente. */
export function tmrtSol({ ta, altSol, dni, difusa, ...opciones }) {
  return ta + deltaMrtSolar({ altSol, dni, difusa, ...opciones });
}

/** Temperatura radiante media bajo el alero (°C). Supuesto: la persona no recibe directa (fbes = 0) y el alero le tapa
 *  la mitad de la bóveda que vería a cielo abierto (fraccionCielo = 0,5 por defecto; un alero profundo sobre fachada
 *  deja ver cielo solo hacia afuera). Recibe difusa y reflejada del suelo con esa misma fracción, igual que SolarCal
 *  escala la reflejada con fsvv. Si pasas altSol y dni, la reflejada incluye la directa que cae en el suelo soleado de
 *  enfrente; si no, solo la difusa. Lo elegimos frente a tmrt = ta porque ignorar la difusa (100–400 W/m² en días
 *  nublados de Panamá) subestimaría 2–5 °C la radiante bajo el alero. */
export function tmrtSombra({ ta, difusa, fraccionCielo = 0.5, altSol = 0, dni = 0, ...opciones }) {
  return ta + deltaMrtSolar({ altSol, dni, difusa, fsvv: fraccionCielo, fbes: 0, ...opciones });
}

/** Humedad absoluta (g de agua por kg de aire seco) a partir de la temperatura (°C) y la humedad relativa (%), a nivel del mar.
 *  Presión de saturación de Magnus (Alduchov y Eskridge 1996); razón de mezcla 622·pv/(p − pv) (ASHRAE Fundamentals, cap. 1). */
export const humedadAbs = (t, rh, p = 101325) => { const ps = 610.94 * Math.exp(17.625 * t / (t + 243.04)), pv = rh / 100 * ps; return 622 * pv / (p - pv); };

/** Zonas de Givoni (1992), variante «países cálidos en desarrollo», en [°C, g/kg]. Aire quieto: fig. 3 y texto §4.3 (20–29 °C
 *  hasta 12 g/kg; techo de 17 g/kg). Ventilación diurna con ~2 m/s: fig. 4. Digitalizadas de las figuras (±0,3 °C, ±0,5 g/kg). */
export const GIVONI = {
  quieto: [[20, 4], [29, 4], [29, 12], [26.9, 17], [25.7, 17], [20, 12]],
  ventilacion: [[20, 4], [32, 4], [32, 15.7], [29.9, 19], [25.4, 19], [20, 13.5]],
};
/** ¿El punto (x, y) cae dentro del polígono P? (par-impar) */
export const dentroPoligono = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
