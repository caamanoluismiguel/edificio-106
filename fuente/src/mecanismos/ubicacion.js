// Mapa de ubicación (idea de Pascal, aprobada): recuadro con la planta del 106 en línea y la zona del mecanismo marcada.
// Componente sin three ni DOM: devuelve el texto de un <svg> que el anfitrión pone donde quiera.
// Entrada: la caja del edificio (por defecto el muro de PLANTA) y la caja de la pieza, en metros de la escena del 106
// (x a lo largo, hacia la NE; z a lo ancho, hacia la SE). El norte sale de EJE_LARGO = 56° (sol.js): +x apunta a 56°.
import { PLANTA } from './planta-106.js';

const EJE_LARGO = 56; // igual que sol.js; no se importa para que el componente no arrastre nada más

/**
 * @param {object} o
 * @param {number[][]} o.pieza       [[x0, z0], [x1, z1]] de la pieza (o el ejemplo de su familia)
 * @param {number[][]} [o.edificio]  [[x0, z0], [x1, z1]] del edificio; por defecto, el muro de PLANTA
 * @param {object}  [o.planta]       planta en línea (PLANTA de planta-106.js); null para dibujar solo la caja del edificio
 * @param {string}  [o.texto]        rótulo corto debajo del mapa (p. ej. «Fachada SE, piso 1 · ejemplo»)
 * @param {object}  [o.colores]      { tinta, tenue, enfasis, papel } en CSS; por defecto, variables CSS del anfitrión
 * @param {number}  [o.ancho]        ancho en px (alto proporcional)
 */
export function svgUbicacion({ pieza, edificio, planta = PLANTA, texto = '', colores = {}, ancho = 160 } = {}) {
  const c = { tinta: 'var(--tinta, #14181f)', tenue: 'var(--tenue, #7a8090)', enfasis: 'var(--teja, #c9653f)', papel: 'var(--papel, #f7f6f2)', ...colores };
  const ed = edificio ?? planta?.muro;
  const cajas = [ed, planta?.alero, pieza].filter(Boolean);
  let x0 = Math.min(...cajas.map((b) => b[0][0])), x1 = Math.max(...cajas.map((b) => b[1][0]));
  let z0 = Math.min(...cajas.map((b) => b[0][1])), z1 = Math.max(...cajas.map((b) => b[1][1]));
  const pad = Math.max(x1 - x0, z1 - z0) * 0.08;
  x0 -= pad; x1 += pad; z0 -= pad; z1 += pad;
  const W = x1 - x0, H = z1 - z0;
  // el rótulo va debajo, en una o dos líneas (corta en « · » si no cabe: unos 6,6 px por carácter a 11 px)
  const cabe = Math.floor(ancho / 6.6);
  const lineas = [];
  for (const parte of texto ? texto.split(' · ') : []) {              // por « · » y, si no cabe, por palabras
    let l = '';
    for (const w of parte.split(' ')) { if (l && (l + ' ' + w).length > cabe) { lineas.push(l); l = w; } else l = l ? l + ' ' + w : w; }
    if (l) lineas.push(l);
  }
  const alto = Math.round((ancho * H) / W) + lineas.length * 14 + (lineas.length ? 4 : 0);
  const k = ancho / W;                                                    // px por metro
  const X = (x) => ((x - x0) * k).toFixed(1), Z = (z) => ((z - z0) * k).toFixed(1);
  const r = (b, extra) => `<rect x="${X(b[0][0])}" y="${Z(b[0][1])}" width="${(Math.max(b[1][0] - b[0][0], 0.05) * k).toFixed(1)}" height="${(Math.max(b[1][1] - b[0][1], 0.05) * k).toFixed(1)}" ${extra}/>`;
  let g = '';
  if (planta?.alero) g += r(planta.alero, `fill="none" stroke="${c.tenue}" stroke-width="0.75" stroke-dasharray="3 2"`);
  g += r(ed, `fill="none" stroke="${c.tinta}" stroke-width="1.5"`);
  for (const b of planta?.entrada ?? []) g += r(b, `fill="none" stroke="${c.tenue}" stroke-width="0.75"`);
  for (const b of planta?.galeria ?? []) g += r(b, `fill="none" stroke="${c.tenue}" stroke-width="0.75"`);
  for (const b of planta?.ventanas ?? []) g += r(b, `fill="${c.tinta}" stroke="none" opacity="0.35"`);
  for (const b of planta?.puertas ?? []) g += r(b, `fill="${c.tinta}" stroke="none"`);
  // la pieza: su caja en tinta gruesa y un círculo que se ve aunque la pieza mida centímetros
  const cx = (pieza[0][0] + pieza[1][0]) / 2, cz = (pieza[0][1] + pieza[1][1]) / 2;
  const rad = Math.max(Math.hypot(pieza[1][0] - pieza[0][0], pieza[1][1] - pieza[0][1]) * k / 2 + 3, 7);
  g += r(pieza, `fill="${c.enfasis}" stroke="${c.enfasis}" stroke-width="2"`);
  if (rad < 12) g += `<circle cx="${X(cx)}" cy="${Z(cz)}" r="${rad.toFixed(1)}" fill="none" stroke="${c.enfasis}" stroke-width="2"/>`; // solo si la pieza es chica
  // norte: +x apunta a EJE_LARGO, +z (abajo) a EJE_LARGO + 90, así que el norte está girado 90 − EJE_LARGO a la derecha de «arriba»
  const nx = ancho - 12, ny = 13;
  g += `<g transform="translate(${nx} ${ny}) rotate(${90 - EJE_LARGO})"><path d="M0 -8 L3.5 4 L0 2 L-3.5 4 Z" fill="${c.tinta}"/><text y="-10" text-anchor="middle" font-size="11" font-family="IBM Plex Mono, monospace" fill="${c.tinta}">N</text></g>`;
  const pie = lineas.map((l, i) => `<text x="0" y="${alto - 4 - (lineas.length - 1 - i) * 14}" font-size="11" font-family="IBM Plex Mono, monospace" fill="${c.tinta}">${esc(l)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="ubicacion" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Ubicación en la planta del 106${texto ? ': ' + esc(texto) : ''}">${g}${pie}</svg>`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
