// Las fechas clave del año para el selector de la AR, calculadas con sol.js (nada escrito a mano): los equinoccios y los
// solsticios salen de la declinación del sol al mediodía de cada día, y los dos días sin sombra, de diasCeroSombra, la
// misma función que usa el visor.
import { posicionSol, diasCeroSombra } from './sol.js';

export const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Declinación del sol a las 12:00 de Panamá para cada día del año: [{ m, d, decl }]. */
function declinaciones(y) {
  const dias = [];
  for (let i = 0; ; i++) {
    const t = new Date(Date.UTC(y, 0, 1 + i));
    if (t.getUTCFullYear() !== y) break;
    const f = { y, m: t.getUTCMonth() + 1, d: t.getUTCDate() };
    dias.push({ ...f, decl: posicionSol({ ...f, h: 12 }).decl });
  }
  return dias;
}

/** Equinoccios, solsticios y días sin sombra del año y, en orden del año. Los días sin sombra traen la hora del mediodía
 *  solar (h, min), cuando el sol pasa más cerca del cenit. */
export function fechasClave(y) {
  const dias = declinaciones(y), del = m => dias.filter(x => x.m === m);
  const min = (arr, f) => arr.reduce((a, b) => f(b) < f(a) ? b : a);
  const lista = [
    { clave: 'equinoccio-mar', nombre: 'Equinoccio de marzo', ...min(del(3), x => Math.abs(x.decl)) },
    { clave: 'solsticio-jun', nombre: 'Solsticio de junio', ...min(del(6), x => -x.decl) },
    { clave: 'equinoccio-sep', nombre: 'Equinoccio de septiembre', ...min(del(9), x => Math.abs(x.decl)) },
    { clave: 'solsticio-dic', nombre: 'Solsticio de diciembre', ...min(del(12), x => x.decl) },
  ];
  diasCeroSombra(y).forEach((z, i) => lista.push({ clave: i ? 'sin-sombra-ago' : 'sin-sombra-abr', nombre: 'Día sin sombra',
    y, m: z.m, d: z.d, h: z.h, min: z.min, alt: z.alt }));
  return lista.map(f => ({ y, ...f })).sort((a, b) => a.m - b.m || a.d - b.d);
}
