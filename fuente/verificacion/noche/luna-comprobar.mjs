// Comprueba src/luna.js (Meeus, baja precisión) de tres maneras:
//  1. Lunas llenas y nuevas publicadas (instantes UTC del USNO / NASA): en la llena la fracción iluminada debe ser ~1 y en
//     la nueva ~0.
//  2. Eclipses de sol vistos desde Ciudad del Saber: en su máximo, la luna y el sol calculados por separado (luna.js y sol.js)
//     deben quedar a menos de ~0,5° (el disco de cada uno mide ~0,5°). Es una prueba de posición topocéntrica.
//  3. Si está instalado Astronomy Engine (ASTRO=/ruta/a/astronomy-engine), una rejilla 2001–2026 contra él.
// Uso: cd fuente && node verificacion/noche/luna-comprobar.mjs
import { posicionLuna } from '../../src/luna.js';
import { posicionSol, LAT, LON, TZ } from '../../src/sol.js';

const rad = Math.PI / 180;
const local = (iso) => { const t = new Date(Date.parse(iso) + TZ * 3600e3); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), min: t.getUTCMinutes(), s: t.getUTCSeconds() }; };
const sep = (a1, z1, a2, z2) => Math.acos(Math.min(1, Math.sin(a1 * rad) * Math.sin(a2 * rad) + Math.cos(a1 * rad) * Math.cos(a2 * rad) * Math.cos((z1 - z2) * rad))) / rad;
const r = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

console.log('1. Fases publicadas');
const fases = [
  ['2022-11-08T11:02Z', 'llena (eclipse total de luna)'], ['2024-12-15T09:02Z', 'llena'], ['2025-03-14T06:55Z', 'llena (eclipse total de luna)'],
  ['2026-09-26T16:49Z', 'llena'], ['2024-04-08T18:21Z', 'nueva (eclipse total de sol)'], ['2023-10-14T17:55Z', 'nueva (eclipse anular)'],
  ['2026-09-11T03:27Z', 'nueva'], ['2025-09-29T23:54Z', 'cuarto creciente'],
];
for (const [iso, q] of fases) { const L = posicionLuna(local(iso)); console.log(`  ${iso}  ${q.padEnd(30)} fracción ${r(L.frac, 4)}  fase ${r(L.fase, 1)}°`); }

console.log('2. Eclipses de sol desde Ciudad del Saber (separación mínima luna-sol)');
for (const [a, b, q] of [['2023-10-14T16:00Z', '2023-10-14T19:30Z', 'anular 14/10/2023'], ['2024-04-08T17:00Z', '2024-04-08T20:00Z', 'total (parcial en Panamá) 8/4/2024']]) {
  let mejor = { s: 99 };
  for (let t = Date.parse(a); t <= Date.parse(b); t += 60e3) { const f = local(new Date(t).toISOString()); const L = posicionLuna(f), P = posicionSol(f); const s = sep(L.alt, L.az, P.alt, P.az); if (s < mejor.s) mejor = { s, t: new Date(t).toISOString().slice(11, 16) }; }
  console.log(`  ${q}: ${r(mejor.s, 3)}° a las ${mejor.t} UTC`);
}

if (process.env.ASTRO) {
  const A = await import(process.env.ASTRO);
  const obs = new A.Observer(LAT, LON, 60);
  let n = 0, mA = 0, mZ = 0, mS = 0, mF = 0;
  for (let t = Date.UTC(2001, 0, 1); t < Date.UTC(2026, 11, 31); t += 37.3 * 3600e3) {
    const fecha = new Date(t), L = posicionLuna(local(fecha.toISOString()));
    const eq = A.Equator(A.Body.Moon, fecha, obs, true, true), hz = A.Horizon(fecha, obs, eq.ra, eq.dec, 'normal');
    if (hz.altitude < 2) continue;
    const ill = A.Illumination(A.Body.Moon, fecha);
    n++; mA = Math.max(mA, Math.abs(L.alt - hz.altitude)); mS = Math.max(mS, sep(L.alt, L.az, hz.altitude, hz.azimuth));
    if (hz.altitude < 80) mZ = Math.max(mZ, Math.abs(((L.az - hz.azimuth + 540) % 360) - 180));
    mF = Math.max(mF, Math.abs(L.frac - ill.phase_fraction));
  }
  console.log(`3. Contra Astronomy Engine (${n} momentos con la luna sobre 2°, 2001–2026): altura máx ${r(mA)}°, azimut máx (bajo 80°) ${r(mZ)}°, separación máx ${r(mS)}°, fracción iluminada máx ${r(mF, 4)}`);
}
