// Carta solar con la máscara del alero (Olgyay y Olgyay, 1957; la misma lectura que Ladybug y CBE Clima): proyección polar
// equidistante, el norte arriba, el cenit al centro y el horizonte en el borde. Cada punto es el sol del día 21 de un mes a una
// hora en punto, con el color de la temperatura media de ese mes y esa hora en 2001–2025 (ERA5 ajustado a Albrook). Para la
// fachada elegida, el punto va lleno si el sol llega al vidrio del piso 2 y hueco si lo tapan el alero o el muro. Las dos curvas
// son los ángulos de perfil del corte: debajo de la de abajo el vidrio queda todo al sol y encima de la de arriba, todo a la sombra.
import { posicionSol, LAT, LON } from './sol.js';
import { VARIABLES } from './anual.js';

const R = 110, C = 136;                                            // radio y centro del dibujo (viewBox 272 × 272)
const rad = Math.PI / 180;
const xy = (alt, az) => { const r = (90 - alt) / 90 * R; return [C + r * Math.sin(az * rad), C - r * Math.cos(az * rad)]; };
const f1 = (v) => v.toFixed(1);
const colorT = (t) => { let c = null; for (const [lim, col] of VARIABLES.temp.pasos) if (t >= lim) c = col; return c; };

/** Ángulo de perfil (grados) del sol sobre una fachada de rumbo dado, o null si está detrás o bajo el horizonte. */
export function perfil(alt, az, rumbo) {
  const c = Math.cos((az - rumbo) * rad);
  if (alt <= 0 || c <= 0.01) return null;
  return Math.atan(Math.tan(alt * rad) / c) / rad;
}

/** Temperatura media (ajustada) de cada mes y hora en la serie: [12][24]. Se calcula una vez. */
export function mediasMesHora(clima) {
  if (mediasMesHora.r) return mediasMesHora.r;
  const s = Array.from({ length: 12 }, () => new Float64Array(24)), n = Array.from({ length: 12 }, () => new Uint32Array(24));
  const T0 = Date.UTC(2001, 0, 1);
  for (let i = 0; i < clima.n; i++) {
    const m = new Date(T0 + i * 3.6e6).getUTCMonth(), h = i % 24;
    s[m][h] += clima.th(i)[0]; n[m][h]++;
  }
  return (mediasMesHora.r = s.map((f, m) => Array.from(f, (v, h) => v / n[m][h])));
}

/** Horas por año con 30 °C o más y, de ellas, en cuántas el sol directo (120 W/m² o más, umbral de la OMM) llega al vidrio. */
export function horasCalorVidrio(clima, rumbo, cortes) {
  const T0 = Date.UTC(2001, 0, 1); let calor = 0, sol = 0;
  for (let i = 0; i < clima.n; i++) {
    const t = clima.th(i)[0]; if (t < 30) continue;
    calor++;
    if (clima.valor('dni', i) < 120) continue;
    const f = new Date(T0 + i * 3.6e6);                              // la temperatura es del instante: el sol de la misma hora
    const p = posicionSol({ y: f.getUTCFullYear(), m: f.getUTCMonth() + 1, d: f.getUTCDate(), h: i % 24, min: 0 }, LAT, LON);
    const q = perfil(p.alt, p.az, rumbo);
    if (q !== null && q < cortes.sombra) sol++;
  }
  const anos = clima.n / 8766;
  return { calor: calor / anos, sol: sol / anos };
}

/** SVG de la carta. rumbo: normal de la fachada; cortes: {sol, sombra} en grados de perfil; ahora: {alt, az} o null. */
export function cartaSolar(clima, rumbo, cortes, ahora) {
  const M = mediasMesHora(clima), o = [];
  o.push(`<circle cx="${C}" cy="${C}" r="${R}" class="cs-borde"/>`);
  for (const a of [30, 60]) o.push(`<circle cx="${C}" cy="${C}" r="${(90 - a) / 90 * R}" class="cs-guia"/><text x="${C + 3}" y="${C - (90 - a) / 90 * R + 11}" class="cs-m">${a}°</text>`);
  for (const [t, az] of [['N', 0], ['E', 90], ['S', 180], ['O', 270]]) { const [x, y] = xy(-12, az); o.push(`<text x="${f1(x)}" y="${f1(y + 4)}" class="cs-p" text-anchor="middle">${t}</text>`); }
  // la fachada: el plano del muro (sol detrás de esta línea = no llega) y las dos curvas de perfil del corte
  const [ax, ay] = xy(0, rumbo - 90), [bx, by] = xy(0, rumbo + 90);
  o.push(`<line x1="${f1(ax)}" y1="${f1(ay)}" x2="${f1(bx)}" y2="${f1(by)}" class="cs-muro"/>`);
  for (const [k, phi] of [['cs-c0', cortes.sol], ['cs-c1', cortes.sombra]]) {
    const pts = [];
    for (let g = -89; g <= 89; g += 2) pts.push(xy(Math.atan(Math.tan(phi * rad) * Math.cos(g * rad)) / rad, rumbo + g).map(f1).join(','));
    o.push(`<polyline points="${pts.join(' ')}" class="${k}"/>`);
  }
  // el sol del 21 de cada mes, de hora en hora
  for (let m = 1; m <= 12; m++) for (let h = 0; h < 24; h++) {
    const p = posicionSol({ y: 2025, m, d: 21, h, min: 0 }, LAT, LON); if (p.alt <= 0) continue;
    const [x, y] = xy(p.alt, p.az), q = perfil(p.alt, p.az, rumbo), c = colorT(M[m - 1][h]);
    o.push(q !== null && q < cortes.sombra
      ? `<circle cx="${f1(x)}" cy="${f1(y)}" r="3.4" fill="${c}"/>`
      : `<circle cx="${f1(x)}" cy="${f1(y)}" r="2.9" fill="none" stroke="${c}" stroke-width="1.2"/>`);
  }
  if (ahora && ahora.alt > 0) { const [x, y] = xy(ahora.alt, ahora.az); o.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="6" class="cs-sol"/>`); }
  return o.join('');
}
