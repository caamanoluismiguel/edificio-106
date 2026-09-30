// Hojas antes/después del contexto: junta las capturas de cap/ (capturas.mjs) de a pares, con un rótulo.
// Uso: cd fuente && node verificacion/contexto/hojas.mjs      Salida: verificacion/contexto/hoja-*.jpg
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CAP = path.join(AQUI, 'cap');
const HOJAS = {
  aerea: ['Vista aérea · 25 mar 2024 15:30', [['antes_aerea', 'Antes: cajas inventadas, sin sombra'], ['despues_aerea', 'Después: huellas OSM; el 105 y los vecinos cercanos proyectan sombra']]],
  aerea_lejos: ['El cuadrángulo desde más lejos · 25 mar 2024 10:00', [['antes_aerea_lejos', 'Antes'], ['despues_aerea_lejos', 'Después (Fundación, cuarteles 102/103/105, Balboa, Innova)']]],
  esquina: ['Esquina · 25 mar 2024 15:30', [['antes_esquina', 'Antes'], ['despues_esquina', 'Después']]],
  so_tarde: ['Fachada SO por la tarde · 13 ene 2024 17:15 (ERA5: 1 % de nubes) · forma de ver «Sol»', [['antes_so_frente_1715_sol', 'Antes: el SO entero al sol'], ['despues_so_frente_1715_sol', 'Después: el 105 deja en sombra los pisos 1 y 2']]],
  so_tarde_foto: ['Fachada SO por la tarde · 13 ene 2024 17:15 · Foto', [['antes_so_frente_1715', 'Antes'], ['despues_so_frente_1715', 'Después']]],
  se_manana: ['Fachada SE por la mañana · 7 dic 2022 07:30 (ERA5: 2 % de nubes) · forma de ver «Sol»', [['antes_se_arriba_sol', 'Antes'], ['despues_se_arriba_sol', 'Después: el salón de Innova (11 m, estimado) sombrea la mitad este de los pisos 1 y 2']]],
  se_manana_foto: ['Fachada SE por la mañana · 7 dic 2022 07:30 · Foto', [['antes_se_arriba', 'Antes'], ['despues_se_arriba', 'Después']]],
  se_hallazgo: ['El momento del hallazgo «El alero…» · 15 ene 2026 07:30 · fachada SE', [['antes_se_hallazgo', 'Antes'], ['despues_se_hallazgo', 'Después']]],
};
const W = 960, H = 600, CAB = 46, TIT = 56;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
for (const [nombre, [titulo, pares]] of Object.entries(HOJAS)) {
  const hay = pares.filter(([f]) => fs.existsSync(path.join(CAP, f + '.jpg')));
  if (hay.length < pares.length) { console.log('falta', nombre, pares.map(([f]) => f).filter((f) => !fs.existsSync(path.join(CAP, f + '.jpg')))); continue; }
  const ancho = pares.length * W + (pares.length - 1) * 10, alto = TIT + CAB + H;
  const capas = [{ input: Buffer.from(`<svg width="${ancho}" height="${TIT}"><rect width="100%" height="100%" fill="#111"/><text x="18" y="37" font-family="Helvetica" font-size="24" fill="#eee">${esc(titulo)}</text></svg>`), top: 0, left: 0 }];
  for (let i = 0; i < pares.length; i++) {
    const [f, r] = pares[i], left = i * (W + 10);
    capas.push({ input: Buffer.from(`<svg width="${W}" height="${CAB}"><rect width="100%" height="100%" fill="#1b1b1b"/><text x="14" y="30" font-family="Helvetica" font-weight="bold" font-size="19" fill="#f2c14e">${esc(r)}</text></svg>`), top: TIT, left });
    capas.push({ input: await sharp(path.join(CAP, f + '.jpg')).resize(W, H).toBuffer(), top: TIT + CAB, left });
  }
  const out = path.join(AQUI, `hoja-${nombre}.jpg`);
  await sharp({ create: { width: ancho, height: alto, channels: 3, background: '#111' } }).composite(capas).jpeg({ quality: 85 }).toFile(out);
  console.log(out);
}
