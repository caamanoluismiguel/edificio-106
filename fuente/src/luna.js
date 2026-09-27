// Posición y fase de la luna para el Edificio 106. Teoría de baja precisión de Jean Meeus, «Astronomical Algorithms»
// (2.ª ed., 1998): cap. 47 con los términos mayores de las tablas 47.A y 47.B (longitud, latitud y distancia), cap. 48
// (ec. 48.4) para el ángulo de fase y cap. 12 para el tiempo sidéreo. Se corrige la paralaje (la luna está tan cerca que
// vista desde Panamá baja hasta ~1° respecto del centro de la Tierra) y la refracción (Bennett, 1982). Error típico
// contra Astronomy Engine: unas centésimas de grado en la fracción iluminada y ~0,1–0,3° en posición (ver
// fuente/verificacion/noche/luna-comprobar.mjs).
import { LAT, LON, TZ } from './sol.js';

const rad = Math.PI / 180, deg = 180 / Math.PI;
const nrm = (x) => ((x % 360) + 360) % 360;
const S = (x) => Math.sin(x * rad), C = (x) => Math.cos(x * rad);

/** fecha: {y,m,d,h,min} en hora de Panamá. Devuelve {alt, az, frac, fase, dist}: altura y azimut topocéntricos en grados
 *  (az desde el norte, horario, con refracción), fracción iluminada del disco (0..1), fase en grados (0 = nueva,
 *  180 = llena; menos de 180 es creciente) y distancia en km. */
export function posicionLuna({ y, m, d, h = 0, min = 0, s = 0 }, lat = LAT, lon = LON) {
  const utcMs = Date.UTC(y, m - 1, d, h - TZ, min, s);
  const dias = utcMs / 86400000 + 2440587.5 - 2451545;
  const T = dias / 36525;
  const Lp = nrm(218.3164477 + 481267.88123421 * T);      // longitud media de la luna
  const D = nrm(297.8501921 + 445267.1114034 * T);        // elongación media
  const M = nrm(357.5291092 + 35999.0502909 * T);         // anomalía media del sol
  const Mp = nrm(134.9633964 + 477198.8675055 * T);       // anomalía media de la luna
  const F = nrm(93.2720950 + 483202.0175233 * T);         // argumento de latitud
  const E = 1 - 0.002516 * T;
  const lon_ = Lp + 6.288774 * S(Mp) + 1.274027 * S(2 * D - Mp) + 0.658314 * S(2 * D) + 0.213618 * S(2 * Mp)
    - 0.185116 * E * S(M) - 0.114332 * S(2 * F) + 0.058793 * S(2 * D - 2 * Mp) + 0.057066 * E * S(2 * D - M - Mp)
    + 0.053322 * S(2 * D + Mp) + 0.045758 * E * S(2 * D - M) - 0.040923 * E * S(M - Mp) - 0.034720 * S(D)
    - 0.030383 * E * S(M + Mp) + 0.015327 * S(2 * D - 2 * F) - 0.012528 * S(Mp + 2 * F) + 0.010980 * S(Mp - 2 * F);
  const lat_ = 5.128122 * S(F) + 0.280602 * S(Mp + F) + 0.277693 * S(Mp - F) + 0.173237 * S(2 * D - F)
    + 0.055413 * S(2 * D - Mp + F) + 0.046271 * S(2 * D - Mp - F) + 0.032573 * S(2 * D + F) + 0.017198 * S(2 * Mp + F);
  const dist = 385000.56 - 20905.355 * C(Mp) - 3699.111 * C(2 * D - Mp) - 2955.968 * C(2 * D) - 569.925 * C(2 * Mp)
    + 48.888 * E * C(M) - 3.149 * C(2 * F) + 246.158 * C(2 * D - 2 * Mp) - 152.138 * E * C(2 * D - M - Mp)
    - 170.733 * C(2 * D + Mp) - 204.586 * E * C(2 * D - M) - 129.620 * E * C(M - Mp) + 108.743 * C(D);
  // de eclípticas a ecuatoriales (oblicuidad media)
  const eps = 23.439291 - 0.0130042 * T;
  const ra = Math.atan2(S(lon_) * C(eps) - Math.tan(lat_ * rad) * S(eps), C(lon_)) * deg;
  const dec = Math.asin(S(lat_) * C(eps) + C(lat_) * S(eps) * S(lon_)) * deg;
  // tiempo sidéreo medio de Greenwich (Meeus 12.4) y ángulo horario local (longitud positiva al este)
  const gmst = nrm(280.46061837 + 360.98564736629 * dias + 0.000387933 * T * T);
  const H = nrm(gmst + lon - ra);
  const altG = Math.asin(S(lat) * S(dec) + C(lat) * C(dec) * C(H)) * deg;
  const az = nrm(Math.atan2(S(H), C(H) * S(lat) - Math.tan(dec * rad) * C(lat)) * deg + 180);
  // paralaje en altura (la Tierra como esfera: basta para ~0,01°) y refracción
  const par = Math.asin(6378.14 / dist) * deg;
  let alt = altG - par * C(altG);
  if (alt > -1.5) alt += 1.02 / Math.tan((alt + 10.3 / (alt + 5.11)) * rad) / 60;
  // ángulo de fase (Meeus 48.4) y fracción iluminada
  const i = 180 - D - 6.289 * S(Mp) + 2.100 * S(M) - 1.274 * S(2 * D - Mp) - 0.658 * S(2 * D) - 0.214 * S(2 * Mp) - 0.110 * S(D);
  const frac = (1 + C(i)) / 2;
  return { alt, az, frac, fase: nrm(180 - i), dist, dec, ra: nrm(ra) };
}
