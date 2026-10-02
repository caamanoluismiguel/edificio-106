// ERA5 ajustado al aeropuerto de Albrook (MPMG, a 4,1 km), solo para la serie 2001–2025. La tabla sale de
// fuente/ajuste_albrook.py (datos/ajuste_albrook.json): temperatura por mapeo de cuantiles por mes y hora; humedad específica
// menos el sesgo medio de cada mes, con la humedad relativa recalculada a la temperatura ajustada. Calibración 2017–2025.
// confort.mjs usa estas mismas funciones, así que la carta y el «a esta hora» salen de la misma serie.
import { humedadAbs } from './confort.js';

/** ERA5 va en pasos de 1/6 °C: se desredondea con medio paso de ruido fijo por hora, igual que en ajuste_albrook.py. */
export const ruidoT = (i) => ((Math.imul(i, 2654435761) >>> 0) / 4294967296 - 0.5) / 6;

/** Temperatura ajustada: t de ERA5 (ya desredondeada si viene de la serie), mes 1–12 y hora 0–23. */
export function ajustarT(A, t, m, h) {
  const [qe, qs] = A.temperatura.tabla[m - 1][h], k = qe.length - 1;
  if (t <= qe[0]) return t + qs[0] - qe[0];
  if (t >= qe[k]) return t + qs[k] - qe[k];
  let a = 0, b = k;                                           // búsqueda binaria del tramo, como np.interp
  while (b - a > 1) { const c = (a + b) >> 1; if (qe[c] <= t) a = c; else b = c; }
  const d = qe[b] - qe[a];
  return d > 0 ? qs[a] + (qs[b] - qs[a]) * (t - qe[a]) / d : qs[b];
}

/** Humedad relativa ajustada: la humedad específica de ERA5 (a su temperatura) menos el sesgo del mes, vuelta a relativa a la
 *  temperatura ajustada. Se limita a 100 %. */
export function ajustarHR(A, t, rh, tAj, m, p = 101325) {
  const w = Math.max(0.1, humedadAbs(t, rh, p) - A.humedad.sesgo[m - 1]);
  const pv = w * p / (622 + w), ps = 610.94 * Math.exp(17.625 * tAj / (tAj + 243.04));
  return Math.min(100, 100 * pv / ps);
}
