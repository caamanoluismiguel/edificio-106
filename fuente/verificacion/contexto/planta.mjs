// Planta del modelo con OpenStreetMap encima (registrado al 106 del modelo, ver contexto-osm.mjs).
// Uso: cd fuente && node verificacion/contexto/planta.mjs [salida.png]   (por defecto verificacion/contexto/planta-osm.png)
// Colores: rojo = el 106 · azul = contexto (vecinos del modelo; más oscuro = proyecta sombra) · verde = vegetación ·
// gris = calles y pavimentos del modelo · negro = huellas OSM · naranja = calles OSM (discontinuo, servicio y peatonales).
// Arriba = noroeste (−Z), derecha = noreste (+X), como la vista en planta del visor girada al eje del edificio.
// Datos OSM: © colaboradores de OpenStreetMap (ODbL).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { cargarTriangulos } from '../../verificar-geometria.mjs';
import { osmRegistrado } from '../../contexto-osm.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../..');
const SALIDA = process.argv[2] ?? path.join(AQUI, 'planta-osm.png');
const X0 = -215, X1 = 245, Z0 = -265, Z1 = 225, K = 2.6;          // metros de la escena y píxeles por metro
const W = Math.round((X1 - X0) * K), H = Math.round((Z1 - Z0) * K);
const px = (x, z) => [(x - X0) * K, (z - Z0) * K];

const img = new Uint8Array(W * H * 4).fill(255);
function tri(a, b, c, col) {           // relleno de un triángulo proyectado (x, z)
  const P = [px(a[0], a[2]), px(b[0], b[2]), px(c[0], c[2])];
  const y0 = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0; i < 3; i++) { const [u, v] = [P[i], P[(i + 1) % 3]]; if ((u[1] <= yc) !== (v[1] <= yc)) xs.push(u[0] + (yc - u[1]) / (v[1] - u[1]) * (v[0] - u[0])); }
    if (xs.length < 2) continue;
    const xa = Math.max(0, Math.round(Math.min(...xs))), xb = Math.min(W - 1, Math.round(Math.max(...xs)) - 1);
    for (let x = xa; x <= xb; x++) { const o = (y * W + x) * 4; img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2]; }
  }
}

const G = ['sitio', 'arquitectura', 'cubiertas', 'entrada', 'detalles', 'vegetacion', 'contexto'];
const m = await cargarTriangulos(RAIZ, G);
const color = (i) => {
  const g = G[m.grupo[i]], nm = m.nombres[m.mat[i]].toLowerCase();
  if (g === 'sitio') { if (/grass/.test(nm)) return null; if (/asphalt/.test(nm)) return [150, 150, 150]; if (/kerb/.test(nm)) return [205, 175, 90]; if (/paving|concrete|paint/.test(nm)) return [185, 185, 180]; return [215, 90, 80]; }
  if (g === 'vegetacion') return /bark|stem|cane/.test(nm) ? [40, 90, 30] : [70, 150, 60];
  if (g === 'contexto') { if (/turf/.test(nm)) return null; if (/asphalt/.test(nm)) return [165, 165, 170]; return m.sombra?.[i] ? [40, 70, 170] : [90, 125, 215]; }
  return [205, 45, 40];
};
// orden de pintado: suelo, contexto, vegetación, el 106
const orden = ['sitio', 'contexto', 'vegetacion', 'arquitectura', 'entrada', 'detalles', 'cubiertas'];
// qué nodos del contexto proyectan sombra: se marcan por el nombre del material de sombra (lo decide contexto.mjs, extras.sombra)
m.sombra = new Uint8Array(m.mat.length);
{
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const { MeshoptDecoder } = await import('meshoptimizer');
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(path.join(RAIZ, 'modelo', 'contexto.glb'));
  // cajas de los nodos que proyectan sombra: los triángulos del contexto dentro de ellas se marcan
  const cajas = [];
  for (const n of doc.getRoot().listNodes()) if (n.getExtras()?.sombra && n.getMesh()) {
    const M = n.getWorldMatrix(); let mn = [Infinity, Infinity], mx = [-Infinity, -Infinity];
    for (const p of n.getMesh().listPrimitives()) { const a = p.getAttribute('POSITION'), v = [0, 0, 0]; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); const x = M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], z = M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]; mn = [Math.min(mn[0], x), Math.min(mn[1], z)]; mx = [Math.max(mx[0], x), Math.max(mx[1], z)]; } }
    cajas.push([mn, mx]);
  }
  const gi = G.indexOf('contexto');
  for (let i = 0; i < m.mat.length; i++) if (m.grupo[i] === gi) {
    const o = i * 9, x = (m.tri[o] + m.tri[o + 3] + m.tri[o + 6]) / 3, z = (m.tri[o + 2] + m.tri[o + 5] + m.tri[o + 8]) / 3;
    if (cajas.some(([a, b]) => x >= a[0] - 0.01 && x <= b[0] + 0.01 && z >= a[1] - 0.01 && z <= b[1] + 0.01)) m.sombra[i] = 1;
  }
}
for (const g of orden) {
  const gi = G.indexOf(g);
  for (let i = 0; i < m.mat.length; i++) {
    if (m.grupo[i] !== gi) continue;
    const c = color(i); if (!c) continue;
    const o = i * 9, T = m.tri;
    tri([T[o], T[o + 1], T[o + 2]], [T[o + 3], T[o + 4], T[o + 5]], [T[o + 6], T[o + 7], T[o + 8]], c);
  }
}

// OSM encima, en SVG
const osm = osmRegistrado();
const pt = (p) => px(p[0], p[1]).map((v) => v.toFixed(1)).join(',');
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif">`;
for (const c of osm.calles) {
  const peat = c.tipo === 'footway', serv = c.tipo === 'service';
  svg += `<polyline points="${c.linea.map(pt).join(' ')}" fill="none" stroke="#f08a00" stroke-width="${peat ? 1.2 : serv ? 2 : 3}" ${peat || serv ? 'stroke-dasharray="6 4"' : ''} opacity="0.9"/>`;
}
for (const b of osm.edificios) {
  svg += `<polygon points="${b.poly.map(pt).join(' ')}" fill="none" stroke="#000" stroke-width="2"/>`;
  const [cx, cz] = px(...b.centro);
  const t = [b.num, b.nombre ? b.nombre.slice(0, 22) : '', b.niveles ? `${b.niveles} niv.` : ''].filter(Boolean).join(' · ');
  svg += `<text x="${cx.toFixed(0)}" y="${cz.toFixed(0)}" font-size="13" text-anchor="middle" fill="#000" stroke="#fff" stroke-width="3" paint-order="stroke">${t.replace(/&/g, '&amp;')}</text>`;
}
// cuadrícula cada 50 m y rótulos
for (let x = Math.ceil(X0 / 50) * 50; x <= X1; x += 50) { const [u] = px(x, 0); svg += `<line x1="${u}" y1="0" x2="${u}" y2="${H}" stroke="#0003"/><text x="${u + 3}" y="14" font-size="12" fill="#555">x ${x}</text>`; }
for (let z = Math.ceil(Z0 / 50) * 50; z <= Z1; z += 50) { const [, v] = px(0, z); svg += `<line x1="0" y1="${v}" x2="${W}" y2="${v}" stroke="#0003"/><text x="3" y="${v - 3}" font-size="12" fill="#555">z ${z}</text>`; }
// círculo de 60 m (vecinos que proyectan sombra) y cuadro del mapa de sombras (±70 m alrededor del origen, visto desde el sol
// alto; con el sol bajo el cuadro se alarga en el suelo)
{ const [cx, cz] = px(0, 0); svg += `<circle cx="${cx}" cy="${cz}" r="${(60 + 12) * K}" fill="none" stroke="#c00" stroke-dasharray="3 5" opacity="0.6"/>`; }
svg += `<rect x="${W - 560}" y="${H - 112}" width="552" height="104" fill="#fff" opacity="0.9"/>
<text x="${W - 550}" y="${H - 88}" font-size="15"><tspan fill="#cd2d28">■</tspan> 106 del modelo  <tspan fill="#2846aa">■</tspan> vecinos que proyectan sombra  <tspan fill="#5a7dd7">■</tspan> vecinos lejanos</text>
<text x="${W - 550}" y="${H - 66}" font-size="15"><tspan fill="#46963c">■</tspan> vegetación  <tspan fill="#969696">■</tspan> calles del modelo  <tspan fill="#000">□</tspan> huellas OSM  <tspan fill="#f08a00">━</tspan> calles OSM</text>
<text x="${W - 550}" y="${H - 44}" font-size="13" fill="#333">OSM registrado al 106 del modelo: giro +${osm.registro.rotacionGrados.toFixed(2)}°, traslación (${osm.registro.traslacion.map((v) => v.toFixed(1)).join(', ')}) m.</text>
<text x="${W - 550}" y="${H - 24}" font-size="13" fill="#333">Arriba = noroeste. Círculo rojo: ~60 m del 106. Huellas © colaboradores de OpenStreetMap (ODbL).</text>`;
svg += '</svg>';
await sharp(Buffer.from(img.buffer), { raw: { width: W, height: H, channels: 4 } }).composite([{ input: Buffer.from(svg) }]).png().toFile(SALIDA);
console.log(SALIDA, W, '×', H);
