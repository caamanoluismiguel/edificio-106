// Posición del sol con un algoritmo independiente del de la app, para la comprobación 1 de fuente/verificar.mjs.
// Es el de Michalsky (1988, «The Astronomical Almanac's algorithm for approximate solar position», Solar Energy 40),
// válido 1950–2050 con un error cercano a 0,01°. No comparte código ni coeficientes con src/sol.js (NOAA/Meeus).
// La refracción es la fórmula de Sæmundsson (1986) para 10 °C y 1010 hPa, también distinta de la de NOAA.
const rad = Math.PI / 180, deg = 180 / Math.PI;
const mod = (x, m) => ((x % m) + m) % m;

/** utcMs: instante en milisegundos UTC. Devuelve { alt (aparente), altGeo (sin refracción), az (desde el norte, horario) }. */
export function solMichalsky(utcMs, lat, lon) {
  const jd = utcMs / 86400000 + 2440587.5;
  const n = jd - 2451545.0;                                   // días desde J2000.0
  const horaUT = mod(utcMs / 3600000, 24);
  // coordenadas eclípticas
  const L = mod(280.460 + 0.9856474 * n, 360);                // longitud media
  const g = mod(357.528 + 0.9856003 * n, 360) * rad;          // anomalía media
  const lambda = mod(L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g), 360) * rad;
  const eps = (23.439 - 0.0000004 * n) * rad;                 // oblicuidad
  // coordenadas ecuatoriales
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  // tiempo sidéreo local y ángulo horario
  const gmst = mod(6.697375 + 0.0657098242 * n + horaUT, 24);
  const lmst = mod(gmst + lon / 15, 24) * 15 * rad;
  let ha = lmst - ra;
  if (ha < -Math.PI) ha += 2 * Math.PI; if (ha > Math.PI) ha -= 2 * Math.PI;
  // coordenadas locales
  const phi = lat * rad;
  const sinEl = Math.sin(dec) * Math.sin(phi) + Math.cos(dec) * Math.cos(phi) * Math.cos(ha);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl))) * deg;
  // azimut con atan2 (la fórmula con arcoseno del artículo original tiene un error de cuadrante conocido)
  const az = mod(Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(ha)) * deg, 360);
  // refracción de Sæmundsson: R (minutos de arco) = 1,02 / tan(h + 10,3 / (h + 5,11)), con h la altura geométrica en grados
  let refr = 0;
  if (el > -1) refr = 1.02 / Math.tan((el + 10.3 / (el + 5.11)) * rad) / 60;
  return { alt: el + refr, altGeo: el, az };
}

/** Separación angular entre dos direcciones dadas por (alt, az) en grados. */
export function separacion(a1, z1, a2, z2) {
  const c = Math.sin(a1 * rad) * Math.sin(a2 * rad) + Math.cos(a1 * rad) * Math.cos(a2 * rad) * Math.cos((z1 - z2) * rad);
  return Math.acos(Math.max(-1, Math.min(1, c))) * deg;
}

// ---------- Comprobación contra NREL SPA (solo al correr este archivo: node fuente/verificar-sol.mjs) ----------
// Compara src/sol.js con fuente/spa_referencia.csv, que escribe fuente/spa_referencia.py con pvlib (spa_python). Tolerancias
// publicadas en «Qué es · fuentes»: altura ≤ 0,03° con el sol sobre 3°, azimut ≤ 0,11° (redondeado a centésimas) y salida y
// puesta a ±1 min. Sale con código 1 si alguna no se cumple.
import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === (await import('node:path')).resolve(process.argv[1])) {
  const fs = await import('node:fs'), path = await import('node:path');
  const { posicionSol, saleYPone } = await import('./src/sol.js');
  const csv = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'spa_referencia.csv'), 'utf8');
  let nPos = 0, dAlt = 0, dAz = 0, nDia = 0, dSale = 0, dPone = 0;
  for (const linea of csv.split('\n')) {
    const [tipo, a, b, c] = linea.split(',');
    if (tipo === 'pos') {
      const ms = +a, altS = +b, azS = +c; if (altS <= 3) continue;
      const p = new Date(ms - 5 * 3600e3);                       // hora de Panamá como campos UTC (UTC−5 todo el año)
      const r = posicionSol({ y: p.getUTCFullYear(), m: p.getUTCMonth() + 1, d: p.getUTCDate(), h: p.getUTCHours(), min: p.getUTCMinutes(), s: p.getUTCSeconds() });
      nPos++; dAlt = Math.max(dAlt, Math.abs(r.alt - altS)); dAz = Math.max(dAz, Math.abs(mod(r.az - azS + 180, 360) - 180));
    } else if (tipo === 'dia') {
      const [y, m, d] = a.split('-').map(Number), r = saleYPone(y, m, d);
      nDia++; dSale = Math.max(dSale, Math.abs(r.sale - +b)); dPone = Math.max(dPone, Math.abs(r.pone - +c));
    }
  }
  const ok = { alt: dAlt <= 0.03, az: +dAz.toFixed(2) <= 0.11, sol: dSale <= 1 && dPone <= 1 };
  console.log(`NREL SPA (pvlib), ${nPos} momentos con el sol sobre 3°: altura máx ${dAlt.toFixed(4)}° ${ok.alt ? 'ok' : 'FALLA'} (≤ 0,03°) · azimut máx ${dAz.toFixed(4)}° ${ok.az ? 'ok' : 'FALLA'} (≤ 0,11°)`);
  console.log(`${nDia} días: salida máx ${dSale.toFixed(2)} min · puesta máx ${dPone.toFixed(2)} min ${ok.sol ? 'ok' : 'FALLA'} (≤ 1 min)`);
  if (!nPos || !nDia || !ok.alt || !ok.az || !ok.sol) process.exit(1);
}
