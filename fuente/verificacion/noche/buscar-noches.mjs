// Busca en la serie horaria (2001–2025) noches de ejemplo para las hojas: despejada con luna llena alta, despejada sin luna
// y con lluvia. Uso: cd fuente && node verificacion/noche/buscar-noches.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';
import { posicionLuna } from '../../src/luna.js';
import { posicionSol } from '../../src/sol.js';
const b = zlib.gunzipSync(fs.readFileSync(new URL('../../../datos/clima_horario.bin.gz', import.meta.url)));
const n = b.readUInt32LE(4), col = (i) => b.subarray(8 + i * n, 8 + (i + 1) * n);
const nubes = col(0), lluvia = col(1);
const T0 = Date.UTC(2001, 0, 1, 0);
const llena = [], nueva = [], llueve = [];
for (let i = 0; i < n; i++) {
  const t = new Date(T0 + i * 3.6e6), f = { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), min: 0 };
  if (f.h < 19 && f.h > 4) continue;
  if (posicionSol(f).alt > -18) continue;
  const L = posicionLuna(f), nb = nubes[i], ll = lluvia[i] / 5;
  // las nubes y la lluvia de la hora siguiente también, para que la escena no cambie mientras se asienta
  const nb2 = nubes[i + 1] ?? nb;
  if (nb < 25 && nb2 < 25 && L.frac > 0.9 && L.alt > 30) llena.push({ f, nb, nb2, alt: +L.alt.toFixed(1), az: +L.az.toFixed(0), frac: +L.frac.toFixed(3) });
  if (nb < 15 && nb2 < 15 && (L.alt < -5 || L.frac < 0.03)) nueva.push({ f, nb, nb2, alt: +L.alt.toFixed(1), frac: +L.frac.toFixed(3) });
  if (ll >= 2 && (lluvia[i + 1] ?? 0) / 5 >= 2) llueve.push({ f, nb, ll, alt: +L.alt.toFixed(1), frac: +L.frac.toFixed(3) });
}
const top = (a, k) => a.sort(k).slice(0, 6).forEach((x) => console.log(' ', JSON.stringify(x)));
console.log('despejada con luna llena alta:', llena.length); top(llena, (a, b) => (a.nb + a.nb2) - (b.nb + b.nb2) || b.alt - a.alt);
console.log('despejada sin luna:', nueva.length); top(nueva, (a, b) => (a.nb + a.nb2) - (b.nb + b.nb2));
console.log('lluvia de noche:', llueve.length); top(llueve, (a, b) => b.ll - a.ll);
