// Tabla de la hoja del gnomon («predice, mira, mide», gnomon/index.html): largo y rumbo de la sombra de un palo vertical de 1 m
// junto al 106, cada día de 2026 y 2027, de 7:00 a 17:00 cada 30 min y al mediodía solar. El sol sale de src/sol.js (NOAA/Meeus,
// el mismo del visor); aquí no se reimplementa.
//   node fuente/gnomon.mjs              escribe gnomon/datos/gnomon.json y gnomon/datos/AAAA-MM.json (24 archivos)
//   node fuente/gnomon.mjs --comprobar  rehace todo en memoria y falla (código 1) si los archivos no son idénticos, si la sombra
//                                       se aparta de NREL SPA (spa_referencia.csv) más que la tolerancia o si los días sin
//                                       sombra no cuadran con la declinación del sol.
// Cada día: [mediodía solar (minuto del día), momento del mediodía, momentos de 7:00 a 17:00].
// Cada momento: [altura del sol ×10 (°), rumbo de la sombra (°, entero, desde el norte geográfico, en el sentido del reloj),
//   largo (cm), penumbra en la punta (cm), cambio del largo en 5 min (cm), cambio del rumbo en 5 min (×10, °),
//   cambio del largo si el suelo sube PENDIENTE grados hacia la punta (cm), y si baja (cm)];
//   con el sol bajo ALT_MIN solo van los dos primeros: la hoja no da el largo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { posicionSol, mediodiaSolar, diasCeroSombra, LAT, LON, TZ } from './src/sol.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(AQUI, '..', 'gnomon', 'datos');
const ANIOS = [2026, 2027];
const HORAS = Array.from({ length: 21 }, (_, i) => 420 + 30 * i);   // 7:00 a 17:00, en minutos del día (hora de Panamá)
const ALT_MIN = 10;          // con el sol más bajo, la sombra pasa de 5,67 m y la punta se borra: la hoja no da el largo
const PENDIENTE = 2;         // grados: ejemplo de suelo inclinado en la dirección de la sombra (2° = 3,5 %)
const DIAMETRO_SOL = 0.533;  // diámetro aparente medio del disco del sol, en grados (va de 0,524° a 0,542° en el año)
// Declinación magnética en el 106 (8,9993° N, 79,5827° O, al nivel del mar): NOAA NCEI, calculadora de declinación con el
// modelo WMM-2025, consultada el 6 de octubre de 2026. Negativa = al oeste. Entre los dos extremos se interpola en línea recta
// (el WMM varía en línea recta dentro de su época); el valor del 6 de octubre de 2026 sirve de control.
const DECLINACION = {
  modelo: 'WMM-2025', fuente: 'NOAA NCEI, calculadora de declinación magnética', consultada: '2026-10-06',
  url: 'https://www.ngdc.noaa.gov/geomag/calculators/magcalc.shtml',
  puntos: [[2026.0, -5.5822], [2027.9973, -5.89553]],
  control: [2026.7616, -5.70145],
  incertidumbre: 0.32826,      // grados, la que da la calculadora (modelo de error del WMM)
  cambioAnual: -0.15676,       // grados por año
};

const rad = Math.PI / 180;
const red = (x, k = 1) => Math.round(x * k) / k;
const difAng = (a, b) => ((a - b + 540) % 360) - 180;
const largo = (alt) => 1 / Math.tan(alt * rad);
const rumbo = (az) => (az + 180) % 360;
// suelo que sube (b > 0) o baja (b < 0) b grados hacia la punta: el rayo que pasa por la punta del palo corta el suelo a
// cos(h) / sen(h + b) metros del pie, medidos sobre el suelo
const largoEnPendiente = (alt, b) => Math.cos(alt * rad) / Math.sin((alt + b) * rad);

function momento(y, m, d, min) {
  const p = posicionSol({ y, m, d, h: 0, min });
  const fila = [red(p.alt * 10), Math.round(rumbo(p.az)) % 360];
  if (p.alt < ALT_MIN) return fila;
  const q = posicionSol({ y, m, d, h: 0, min: min + 5 }), r = DIAMETRO_SOL / 2;
  return fila.concat([
    Math.round(100 * largo(p.alt)),
    Math.round(100 * (largo(p.alt - r) - largo(p.alt + r))),
    Math.round(100 * (largo(q.alt) - largo(p.alt))),
    Math.round(10 * difAng(rumbo(q.az), rumbo(p.az))),
    Math.round(100 * (largoEnPendiente(p.alt, PENDIENTE) - largo(p.alt))),
    Math.round(100 * (largoEnPendiente(p.alt, -PENDIENTE) - largo(p.alt))),
  ]);
}

function declinacionEn(anioDec) {
  const [[t0, d0], [t1, d1]] = DECLINACION.puntos;
  return d0 + (d1 - d0) * (anioDec - t0) / (t1 - t0);
}
const anioDecimal = (y, m, d) => y + (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1));
const diasMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const minutoDe = (s) => Math.round((s.h * 3600 + s.min * 60 + s.s) / 60);   // el mediodía solar al minuto, como lo abre el enlace

export function generar() {
  const archivos = {};
  for (const y of ANIOS) for (let m = 1; m <= 12; m++) {
    const dias = [];
    for (let d = 1; d <= diasMes(y, m); d++) {
      const hm = minutoDe(mediodiaSolar(y, m, d));
      dias.push([hm, momento(y, m, d, hm), ...HORAS.map((min) => momento(y, m, d, min))]);
    }
    archivos[`${y}-${String(m).padStart(2, '0')}.json`] = JSON.stringify({ y, m, dec: red(declinacionEn(anioDecimal(y, m, 15)), 10), dias }) + '\n';
  }
  const ceroSombra = ANIOS.flatMap((y) => diasCeroSombra(y).map((z) => {
    const hm = minutoDe(z), p = posicionSol({ y, m: z.m, d: z.d, h: 0, min: hm });
    return { y, m: z.m, d: z.d, hm, alt: red(p.alt, 10), largo_cm: red(100 * largo(p.alt), 10) };
  }));
  archivos['gnomon.json'] = JSON.stringify({
    lugar: { lat: LAT, lon: LON, tz: TZ, nota: 'Coordenadas del 106 en fuente/src/sol.js, las mismas del visor' },
    anios: ANIOS, horas: HORAS, altMin: ALT_MIN, largoMax_cm: Math.round(100 * largo(ALT_MIN)), diametroSol: DIAMETRO_SOL,
    penumbraMin_cm: Math.round(100 * (largo(ALT_MIN - DIAMETRO_SOL / 2) - largo(ALT_MIN + DIAMETRO_SOL / 2))),   // penumbra con el sol a ALT_MIN: más bajo, más larga pendiente: PENDIENTE,
    palo: { inclinacion: 2, cambio_cm: red(100 * Math.sin(2 * rad), 10), nota: 'palo inclinado 2° hacia la sombra o hacia el sol: la punta se corre sen(2°) = 3,5 cm; el coseno cambia menos de 0,1 %' },
    sitio: 'https://caamanoluismiguel.github.io/edificio-106/',
    ceroSombra,
    declinacion: DECLINACION,
    spa: compararSPA(),
  }, null, 1) + '\n';
  return archivos;
}

/** Sombra de sol.js frente a la de NREL SPA (spa_referencia.csv, 2001 a 2025), con el sol desde ALT_MIN. */
export function compararSPA() {
  const csv = fs.readFileSync(path.join(AQUI, 'spa_referencia.csv'), 'utf8');
  let n = 0, dAlt = 0, dAz = 0, dLargo = 0, dRumbo = 0;
  for (const linea of csv.split('\n')) {
    const [tipo, a, b, c] = linea.split(',');
    if (tipo !== 'pos' || +b < ALT_MIN) continue;
    const t = new Date(+a + TZ * 3600e3);                 // hora de Panamá como campos UTC (UTC−5 todo el año)
    const p = posicionSol({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), min: t.getUTCMinutes(), s: t.getUTCSeconds() });
    n++;
    dAlt = Math.max(dAlt, Math.abs(p.alt - +b));
    dAz = Math.max(dAz, Math.abs(difAng(p.az, +c)));
    dLargo = Math.max(dLargo, Math.abs(largo(p.alt) - largo(+b)));
    dRumbo = Math.max(dRumbo, Math.abs(difAng(rumbo(p.az), rumbo(+c))));
  }
  return { referencia: 'NREL SPA (Reda y Andreas 2004) con pvlib, fuente/spa_referencia.csv', momentos: n, altMin: ALT_MIN,
    maxAltura: red(dAlt, 1e4), maxAcimut: red(dAz, 1e4), maxLargo_cm: red(100 * dLargo, 100), maxRumbo: red(dRumbo, 1e4) };
}

function comprobar() {
  let fallas = 0;
  const ok = (cond, txt) => { console.log(`${cond ? 'ok   ' : 'FALLA'} ${txt}`); if (!cond) fallas++; };
  // 1. los archivos publicados son exactamente los que salen del generador
  const nuevos = generar();
  const malos = Object.entries(nuevos).filter(([f, txt]) => { try { return fs.readFileSync(path.join(SALIDA, f), 'utf8') !== txt; } catch { return true; } });
  ok(!malos.length, `${Object.keys(nuevos).length} archivos idénticos a los de gnomon/datos${malos.length ? ': difieren ' + malos.map(([f]) => f).join(', ') : ''}`);
  // 2. contra SPA: la sombra hereda el error del sol; tolerancias de sol.js (altura ≤ 0,03°, azimut ≤ 0,11°) y su efecto en el largo
  const s = compararSPA();
  ok(s.momentos > 1000 && s.maxAltura <= 0.03 && +s.maxAcimut.toFixed(2) <= 0.11, `SPA, ${s.momentos} momentos con el sol desde ${ALT_MIN}°: altura máx ${s.maxAltura}°, acimut máx ${s.maxAcimut}° (≤ 0,03° y ≤ 0,11° redondeado a centésimas, las tolerancias de verificar-sol.mjs)`);
  ok(s.maxLargo_cm <= 2 && +s.maxRumbo.toFixed(2) <= 0.11, `sombra de 1 m frente a SPA: largo máx ${s.maxLargo_cm} cm (≤ 2 cm), rumbo máx ${s.maxRumbo}° (≤ 0,11° redondeado)`);
  // 3. días sin sombra: el día en que la declinación del sol pasa más cerca de la latitud, hallado aparte
  for (const z of JSON.parse(nuevos['gnomon.json']).ceroSombra) {
    let mejor = null;
    for (let d = 1; d <= diasMes(z.y, z.m); d++) {
      const q = posicionSol({ y: z.y, m: z.m, d, h: 0, min: z.hm });
      if (!mejor || Math.abs(q.decl - LAT) < mejor.dif) mejor = { d, dif: Math.abs(q.decl - LAT) };
    }
    ok(mejor.d === z.d && z.alt > 89.5 && z.largo_cm < 1, `sin sombra ${z.d}/${z.m}/${z.y} a las ${Math.floor(z.hm / 60)}:${String(z.hm % 60).padStart(2, '0')}: altura ${z.alt}°, sombra ${z.largo_cm} cm (declinación = latitud el ${mejor.d})`);
  }
  // 4. declinación magnética: la recta entre los dos extremos pasa por el valor de control de NOAA
  const [tc, dc] = DECLINACION.control, di = declinacionEn(tc);
  ok(Math.abs(di - dc) < 0.01, `declinación magnética interpolada ${di.toFixed(4)}° frente a ${dc}° de NOAA el ${tc}`);
  // 5. la fórmula: con el sol a 45° la sombra mide lo mismo que el palo; en suelo plano la pendiente no cambia nada
  ok(Math.abs(largo(45) - 1) < 1e-12 && Math.abs(largoEnPendiente(37, 0) - largo(37)) < 1e-12, 'con el sol a 45° la sombra mide 1 m; con pendiente 0 da lo mismo que en plano');
  if (fallas) { console.log(`${fallas} comprobaciones fallaron`); process.exit(1); }
  console.log('todo cuadra');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes('--comprobar')) comprobar();
  else {
    fs.mkdirSync(SALIDA, { recursive: true });
    const a = generar();
    for (const [f, txt] of Object.entries(a)) fs.writeFileSync(path.join(SALIDA, f), txt);
    const kb = Object.values(a).reduce((s, t) => s + t.length, 0) / 1024;
    console.log(`${Object.keys(a).length} archivos en gnomon/datos (${kb.toFixed(0)} KB)`);
  }
}
