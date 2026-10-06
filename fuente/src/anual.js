// El año en un vistazo: los 365 días (columnas) por las 24 horas (filas) de un año de la serie, con la temperatura ajustada,
// la lluvia o la radiación global en pasos planos de color (sin degradado). La radiación global sale de la directa y la difusa
// como en el EPW (src/epw.js). La lluvia y la radiación son de la hora que termina en la marca; la temperatura, del instante.
import { posicionSol, LAT, LON } from './sol.js';
import { umbralLluvia } from './clima.js';

export const VARIABLES = {
  temp: {
    nombre: 'Temperatura del aire', unidad: '°C',
    pasos: [[-99, '#24414f', 'menos de 24'], [24, '#3d6670', '24 a 26'], [26, '#6f8a6a', '26 a 28'], [28, '#a07e62', '28 a 30'],
      [30, '#c9653f', '30 a 32'], [32, '#a23a2c', '32 o más']],
    valor: (c, i) => c.th(i)[0],
  },
  lluvia: {
    nombre: 'Lluvia en la hora', unidad: 'mm',
    pasos: [[-1, null, 'menos del umbral'], [0, '#2f6f93', 'del umbral a 5'], [5, '#4aa8dc', '5 a 10'], [10, '#a9dcf5', '10 o más', ', fuerte según la OMM']],
    // por debajo del umbral del visor (1 mm de diciembre a marzo, 1,5 mm de abril a noviembre) no cuenta como lluvia
    valor: (c, i, m) => { const v = c.valor('lluvia', i); return v < umbralLluvia(m) ? -1 : v; },
  },
  ghi: {
    nombre: 'Radiación global horizontal', unidad: 'W/m²',
    pasos: [[-1, null, 'noche'], [1, 'rgba(244,181,69,.22)', 'menos de 200'], [200, 'rgba(244,181,69,.42)', '200 a 400'],
      [400, 'rgba(244,181,69,.62)', '400 a 600'], [600, 'rgba(244,181,69,.82)', '600 a 800'], [800, '#f4b545', '800 o más']],
    valor: (c, i, m, d, h, y) => {
      const alt = posicionSol({ y, m, d, h: (h + 23) % 24, min: 30 }, LAT, LON).alt;   // la hora que termina a las h:00
      const g = c.valor('dni', i) * Math.max(0, Math.sin(alt * Math.PI / 180)) + c.valor('difusa', i);
      return g < 1 ? -1 : g;
    },
  },
};

const color = (pasos, v) => { let c = null; for (const [lim, col] of pasos) if (v >= lim) c = col; return c; };

/** Dibuja el año y en el lienzo (365 × 24 píxeles, uno por hora; sin el 29 de febrero). */
export function pintarAnual(cv, clima, clave, y) {
  const V = VARIABLES[clave], g = cv.getContext('2d');
  cv.width = 365; cv.height = 24; g.clearRect(0, 0, 365, 24);
  let x = 0;
  for (let m = 1; m <= 12; m++) {
    const dm = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let d = 1; d <= dm; d++) {
      if (m === 2 && d === 29) continue;
      const i0 = clima.indice({ y, m, d }, 0);
      for (let h = 0; h < 24; h++) {
        const c = color(V.pasos, V.valor(clima, i0 + h, m, d, h, y));
        if (c) { g.fillStyle = c; g.fillRect(x, h, 1, 1); }
      }
      x++;
    }
  }
}

/** Día y hora de un punto del lienzo (fracciones 0–1 de ancho y alto). */
export function diaHora(y, fx, fy) {
  let n = Math.min(364, Math.max(0, Math.floor(fx * 365)));
  const h = Math.min(23, Math.max(0, Math.floor(fy * 24)));
  for (let m = 1; m <= 12; m++) {
    const dm = new Date(Date.UTC(y, m, 0)).getUTCDate() - (m === 2 && y % 4 === 0 ? 1 : 0);
    if (n < dm) return { fecha: { y, m, d: n + 1 }, h };
    n -= dm;
  }
  return { fecha: { y, m: 12, d: 31 }, h };
}
