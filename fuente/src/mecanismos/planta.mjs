// Escribe planta-106.js (la planta en línea del mapa de ubicación) desde fuente/estado/estado.json, en solo lectura.
// Las cajas de estado.json son las de cada pieza de los GLB de main, en cm: «Material|triángulos|min x,y,z|max x,y,z».
// Uso: cd fuente && node src/mecanismos/planta.mjs   (rehacer si cambia estado.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const estado = JSON.parse(readFileSync(join(aqui, '../../estado/estado.json'), 'utf8'));
const piezas = (glb, mat, filtro = () => true) =>
  (estado.archivos[`modelo/${glb}.glb`]?.piezas ?? [])
    .filter((p) => p.startsWith(mat + '|'))
    .map((p) => {
      const [, n, a, b] = p.split('|');
      const [x0, y0, z0] = a.split(',').map((v) => v / 100), [x1, y1, z1] = b.split(',').map((v) => v / 100);
      return { n: +n, x0, y0, z0, x1, y1, z1 };
    })
    .filter(filtro);
const r2 = (v) => Math.round(v * 100) / 100;
const rect = (p) => [[r2(p.x0), r2(p.z0)], [r2(p.x1), r2(p.z1)]];
const union = (ps) => rect(ps.reduce((u, p) => ({ x0: Math.min(u.x0, p.x0), z0: Math.min(u.z0, p.z0), x1: Math.max(u.x1, p.x1), z1: Math.max(u.z1, p.z1) }), { x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9 }));

// muro: la pieza más grande del repello; aleros: la caja de las tejas de la cubierta liviana
const muros = piezas('arquitectura', 'Warm lime-painted plaster');
const muro = muros.reduce((a, b) => ((b.x1 - b.x0) * (b.z1 - b.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? b : a));
const tejas = Object.keys(estado.archivos['modelo/cubiertas_sombra.glb'].triangulos).filter((m) => m.startsWith('Clay terracotta'))
  .flatMap((m) => piezas('cubiertas_sombra', m));
// ventanas por su alféizar (Fresh cream trim de 5 cm de alto): 106 en ventanas.glb, de los tres pisos, y 7 de la planta baja SO
// en sitio.glb
const alfeizares = piezas('ventanas', 'Fresh cream trim', (p) => p.y1 - p.y0 < 0.08);
const alfeizaresSO = piezas('sitio', 'Fresh cream trim', (p) => p.y1 - p.y0 < 0.08 && p.x0 < -22);
const puertas = [...piezas('ventanas', 'Brown painted service access', (p) => p.n === 108), ...piezas('sitio', 'Brown painted service access', (p) => p.y1 - p.y0 > 2 && p.x1 - p.x0 < 0.1 && p.z1 - p.z0 > 1 && p.y0 > 1)];
// 5 vanos de puerta (INVENTARIO §4.21): 3 pardas, la de la galería SO y la principal de vidrio
const principal = piezas('entrada', 'Window glass');
const entrada = piezas('entrada', 'Pale cast concrete — entrance');
// galería: solo el piso (de 1,24 a 1,28), sin los peldaños; dos tramos, SO y NO (INVENTARIO §4.23)
const galeria = piezas('sitio', 'V012 aged reddish access paving', (p) => p.y0 > 1.2 && p.y1 - p.y0 < 0.1 && p.n === 12);
const tramos = [galeria.filter((p) => p.x1 <= -22.7), galeria.filter((p) => p.z1 <= -11.4)].filter((t) => t.length);

const PLANTA = {
  origen: `fuente/estado/estado.json (git ${estado.git}, ${estado.fecha.slice(0, 10)}), cajas de las piezas de los GLB de main`,
  muro: rect(muro),
  alero: union(tejas),
  ventanas: [...alfeizares, ...alfeizaresSO].map(rect),
  puertas: [...puertas.map(rect), union(principal)],
  entrada: [union(entrada)],
  galeria: tramos.map(union),
};

// lugares de cada mecanismo: la pieza que dibuja el detalle (o un ejemplo de su familia)
const primero = (glb, mat, f) => piezas(glb, mat, f)[0];
const L = {
  ventana_se: rect(alfeizares.filter((p) => p.y0 < 2 && p.z0 > 11).sort((a, b) => a.x0 - b.x0)[0]),
  puerta_so: rect(puertas.find((p) => p.x0 < -22)),
  puerta_parda: rect(puertas[0]),
  puerta_principal: union(piezas('entrada', 'Window glass')),
  lama: rect(primero('ventanas', 'V011 photographed blue grey louvres')),
  letrero: union(piezas('entrada', '106 sign grey')),
  gabinete: union(piezas('detalles', 'Utility cabinet enamel')),
  tubo: rect(primero('detalles', 'Fresh cream trim', (p) => p.y1 - p.y0 > 10)),
  bloque: rect(primero('detalles', 'Dark ventilation recess', (p) => Math.abs(p.y1 - p.y0 - 0.28) < 0.03 && p.z0 > 11)),
  condensadora: rect(primero('detalles', 'Fresh cream trim', (p) => Math.abs(p.x1 - p.x0 - 0.91) < 0.03 && p.y0 < 0.2)),
  poste: union(piezas('sitio', 'Galvanized guardrail', (p) => p.y1 > 11)),
  rampa: union(entrada.filter((p) => p.x0 > 15)),
  baranda: union(piezas('entrada', 'Galvanized guardrail', (p) => p.x0 > 15)),
  gablete: rect(primero('cubiertas_sombra', 'Dark ventilation recess', (p) => p.x0 > 0)),
  mensula_se: rect(primero('detalles', 'Fresh cream trim', (p) => p.n === 24 && p.y0 > 6 && p.y0 < 7 && p.z0 > 11)),
  alfeizar_se: rect(alfeizares.filter((p) => p.y0 < 2 && p.z0 > 11).sort((a, b) => a.x0 - b.x0)[0]),
};
for (const [k, v] of Object.entries(L)) if (!v || v.flat().some((n) => !Number.isFinite(n))) console.warn('sin lugar:', k);

writeFileSync(join(aqui, 'planta-106.js'),
  `// GENERADO por planta.mjs desde fuente/estado/estado.json. No editar a mano.\n` +
  `// Coordenadas de la escena del 106 en metros: x a lo largo (hacia la NE), z a lo ancho (hacia la SE).\n` +
  `export const PLANTA = ${JSON.stringify(PLANTA)};\n` +
  `export const LUGARES = ${JSON.stringify(L, null, 1)};\n`);
console.log('planta-106.js:', PLANTA.ventanas.length, 'alféizares (', alfeizaresSO.length, 'de la SO),', PLANTA.puertas.length, 'vanos de puerta,', PLANTA.galeria.length, 'tramos de galería', PLANTA.galeria, '; muro', PLANTA.muro, 'alero', PLANTA.alero);
console.log(L);
