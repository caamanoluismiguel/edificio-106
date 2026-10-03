// Posición del sol — algoritmo de la hoja de cálculo solar de NOAA (Meeus), con refracción.
// Ubicación del Edificio 106 (Ciudad del Saber, Panamá), la misma que usan los renders de Blender.
export const LAT = 8.9993, LON = -79.5827, TZ = -5; // Panamá: UTC−5 todo el año
export const EJE_LARGO = 56; // rumbo del eje largo (+X de Blender) medido en satélite, grados desde el norte

const rad = Math.PI / 180, deg = 180 / Math.PI;

/** fecha: objeto {y,m,d,h,min} en hora de Panamá. Devuelve {alt, az} en grados (az desde el norte, horario). */
export function posicionSol({ y, m, d, h = 12, min = 0, s = 0 }, lat = LAT, lon = LON) {
  // los minutos y segundos se suman aparte: Date.UTC trunca los fraccionarios (con min = 600,99 daba lo mismo que con 600)
  const utcMs = Date.UTC(y, m - 1, d, h - TZ) + (min * 60 + s) * 1000;
  const jd = utcMs / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * rad) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * rad);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * rad);
  const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad)) * deg;
  const yv = Math.tan(eps / 2 * rad) ** 2;
  const eqTime = 4 * deg * (yv * Math.sin(2 * L0 * rad) - 2 * e * Math.sin(M * rad) + 4 * e * yv * Math.sin(M * rad) * Math.cos(2 * L0 * rad)
    - 0.5 * yv * yv * Math.sin(4 * L0 * rad) - 1.25 * e * e * Math.sin(2 * M * rad)); // minutos
  const utcMin = ((utcMs / 60000) % 1440 + 1440) % 1440;
  let tst = (utcMin + eqTime + 4 * lon) % 1440; if (tst < 0) tst += 1440;
  let ha = tst / 4 - 180; if (ha < -180) ha += 360;
  const cosZ = Math.sin(lat * rad) * Math.sin(decl * rad) + Math.cos(lat * rad) * Math.cos(decl * rad) * Math.cos(ha * rad);
  const zen = Math.acos(Math.min(1, Math.max(-1, cosZ))) * deg;
  let az;
  const den = Math.cos(lat * rad) * Math.sin(zen * rad);
  if (Math.abs(den) > 1e-6) {
    let a = ((Math.sin(lat * rad) * Math.cos(zen * rad)) - Math.sin(decl * rad)) / den;
    a = Math.min(1, Math.max(-1, a));
    az = ha > 0 ? (Math.acos(a) * deg + 180) % 360 : (540 - Math.acos(a) * deg) % 360;
  } else az = lat > 0 ? 180 : 0;
  const elev = 90 - zen;
  let refr = 0; // refracción atmosférica (grados)
  if (elev <= 85) {
    const te = Math.tan(elev * rad);
    if (elev > 5) refr = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
    else if (elev > -0.575) refr = 1735 + elev * (-518.2 + elev * (103.4 + elev * (-12.79 + elev * 0.711)));
    else refr = -20.772 / te;
    refr /= 3600;
  }
  return { alt: elev + refr, geo: elev, az, decl, eqTime };        // geo: altura geométrica, sin refracción
}

/** Vector unitario hacia el sol en coordenadas de la escena (three.js, Y arriba),
 *  a partir de la convención de los renders: ángulo local = EJE_LARGO − az (CCW desde +X de Blender). */
export function vectorSol(alt, az, out = { x: 0, y: 0, z: 0 }) {
  const ang = (EJE_LARGO - az) * rad, ca = Math.cos(alt * rad);
  const bx = ca * Math.cos(ang), by = ca * Math.sin(ang), bz = Math.sin(alt * rad);
  out.x = bx; out.y = bz; out.z = -by; // Blender (x, y, z) -> glTF (x, z, −y)
  return out;
}

/** Día y hora del sol más alto (mediodía solar) para una fecha, con precisión de ~10 s. */
export function mediodiaSolar(y, m, d) {
  let best = { alt: -99 };
  for (let t = 11 * 3600 + 50 * 60; t <= 12 * 3600 + 50 * 60; t += 10) {
    const h = Math.floor(t / 3600), mi = Math.floor((t % 3600) / 60), s = t % 60;
    const p = posicionSol({ y, m, d, h, min: mi, s });
    if (p.alt > best.alt) best = { ...p, h, min: mi, s };
  }
  return best;
}

/** Los dos días del año en que el sol pasa más cerca del cenit (a 9° N: abril y agosto). */
export function diasCeroSombra(y) {
  const res = [];
  for (const [m, d0, d1] of [[4, 5, 20], [8, 22, 31]]) {
    let best = null;
    for (let d = d0; d <= d1; d++) { const s = mediodiaSolar(y, m, d); if (!best || s.alt > best.alt) best = { ...s, y, m, d }; }
    res.push(best);
  }
  return res;
}

/** Salida y puesta del sol en minutos del día, por bisección: el centro del disco a −0,833° de altura GEOMÉTRICA (los −0,833°
 *  ya incluyen la refracción media en el horizonte y el radio del disco; con la altura aparente se contaba la refracción dos
 *  veces y la salida salía ~1 min antes y la puesta ~2 min después que NREL SPA). */
export function saleYPone(y, m, d) {
  const f = (min) => posicionSol({ y, m, d, h: 0, min }).geo + 0.833;
  const bis = (a, b) => { for (let i = 0; i < 40; i++) { const c = (a + b) / 2; (f(a) * f(c) <= 0) ? b = c : a = c; } return (a + b) / 2; };
  return { sale: bis(240, 720), pone: bis(720, 1260) };
}

/** Longitud de la sombra de un poste de 1 m y hacia dónde cae (rumbo). */
export function sombraPoste(alt, az) {
  if (alt <= 0.5) return null;
  return { largo: 1 / Math.tan(alt * rad), rumbo: (az + 180) % 360 };
}

/** Rumbo en palabras (8 puntos). */
export function rumboTexto(b) {
  const n = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
  return n[Math.round(((b % 360) + 360) % 360 / 45) % 8];
}

// Fachadas: rumbo de su normal hacia afuera (derivado del eje largo a 56°; coincide con el catálogo).
export const FACHADAS = {
  'fachada-se': { nombre: 'Fachada sureste', lugar: 'hacia la calle, con la entrada 106', rumbo: 146 },
  'fachada-no': { nombre: 'Fachada noroeste', lugar: 'hacia el cuadrángulo', rumbo: 326 },
  'fachada-ne': { nombre: 'Fachada lateral noreste', lugar: 'el jardín de la esquina', rumbo: 56 },
  'fachada-so': { nombre: 'Fachada lateral suroeste', lugar: 'el extremo opuesto al jardín', rumbo: 236 },
};

/** Coseno de incidencia del sol sobre una fachada vertical de rumbo dado (0 si el sol está detrás). */
export function incidencia(alt, az, rumboFachada) {
  if (alt <= 0) return 0;
  return Math.max(0, Math.cos(alt * rad) * Math.cos((az - rumboFachada) * rad));
}

/** Lo más despejado que da ERA5 en su celda, frente a Meinel: el percentil 95 de DNI/Meinel en 2001–2025 es ~0,80 en todas
 *  las bandas de altura del sol (0,78 a 0,86, de 2 a 90°; panel de sombras, 3 de octubre de 2026). La escena mide el sol del
 *  dato contra esto y no contra Meinel: si no, la hora más despejada se dibujaba con el sol al 82 % y la sombra borrosa. */
export const DESPEJADO_ERA5 = 0.8;
export const dniDespejadoEra5 = (alt) => DESPEJADO_ERA5 * dniDespejado(alt);

/** Irradiancia directa normal de cielo despejado (modelo de Meinel, aproximado), W/m². */
export function dniDespejado(alt) {
  if (alt <= 0) return 0;
  const am = 1 / (Math.sin(alt * rad) + 0.50572 * Math.pow(alt + 6.07995, -1.6364));
  return 1353 * Math.pow(0.7, Math.pow(am, 0.678));
}
