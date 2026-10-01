// Compara la forma del modelo de AR (ar/modelo) con la del sitio (modelo/): planta y 4 elevaciones
// proyectadas en ortogonal sobre una grilla de 2 cm. Pasa si cada vista coincide en ≥ 98 % (IoU)
// y la caja (huella y altura) difiere en ≤ 2 cm. Uso: node ar/silueta.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarTriangulos } from '../fuente/verificar-geometria.mjs';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITIO = ['arquitectura', 'cubiertas', 'detalles', 'entrada', 'ventanas'];
const PX = 0.02, MIN_IOU = 0.98, MAX_CAJA = 0.02;

const sitio = await cargarTriangulos(raiz, SITIO);
const ar = await cargarTriangulos(path.join(raiz, 'ar'), SITIO);

function caja(t) {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < t.length; i++) { const c = i % 3; lo[c] = Math.min(lo[c], t[i]); hi[c] = Math.max(hi[c], t[i]); }
  return { lo, hi };
}
const cs = caja(sitio.tri), ca = caja(ar.tri);

// vista: dos ejes (u, v) en coordenadas de la escena (y arriba)
const giro = 56 * Math.PI / 180, c = Math.cos(giro), s = Math.sin(giro);
const VISTAS = {
  planta: [[1, 0, 0], [0, 0, 1]],
  'elev. eje largo': [[c, 0, -s], [0, 1, 0]],
  'elev. eje corto': [[s, 0, c], [0, 1, 0]],
  'elev. x': [[1, 0, 0], [0, 1, 0]],
  'elev. z': [[0, 0, 1], [0, 1, 0]],
};

function rasterizar(tri, [U, V], lim) {
  const W = Math.ceil((lim.u1 - lim.u0) / PX) + 1, H = Math.ceil((lim.v1 - lim.v0) / PX) + 1;
  const m = new Uint8Array(W * H);
  const p = new Float64Array(6);
  for (let t = 0; t < tri.length; t += 9) {
    for (let k = 0; k < 3; k++) {
      const x = tri[t + k * 3], y = tri[t + k * 3 + 1], z = tri[t + k * 3 + 2];
      p[k * 2] = (U[0] * x + U[1] * y + U[2] * z - lim.u0) / PX;
      p[k * 2 + 1] = (V[0] * x + V[1] * y + V[2] * z - lim.v0) / PX;
    }
    const [ax, ay, bx, by, cx, cy] = p;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) continue;               // de canto: no aporta silueta
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const px = i + 0.5, py = j + 0.5;
      const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
      const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
      if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) m[j * W + i] = 1;
    }
  }
  return m;
}

function limites(tri, [U, V]) {
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (let t = 0; t < tri.length; t += 3) {
    const u = U[0] * tri[t] + U[1] * tri[t + 1] + U[2] * tri[t + 2], v = V[0] * tri[t] + V[1] * tri[t + 1] + V[2] * tri[t + 2];
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  return { u0: u0 - 0.1, u1: u1 + 0.1, v0: v0 - 0.1, v1: v1 + 0.1 };
}

let ok = true;
console.log(`triángulos: sitio ${sitio.tri.length / 9}, AR ${ar.tri.length / 9}`);
const dc = Math.max(...[0, 1, 2].flatMap(k => [Math.abs(cs.lo[k] - ca.lo[k]), Math.abs(cs.hi[k] - ca.hi[k])]));
console.log(`caja: diferencia máxima ${(dc * 100).toFixed(1)} cm (alto sitio ${(cs.hi[1] - cs.lo[1]).toFixed(2)} m, AR ${(ca.hi[1] - ca.lo[1]).toFixed(2)} m)`);
if (dc > MAX_CAJA) { ok = false; console.log('  FALLA: la caja se movió más de 2 cm'); }
for (const [nombre, ejes] of Object.entries(VISTAS)) {
  const lim = limites(sitio.tri, ejes);
  const a = rasterizar(sitio.tri, ejes, lim), b = rasterizar(ar.tri, ejes, lim);
  let inter = 0, union = 0, solo = 0, falta = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] & b[i]) inter++; if (a[i] | b[i]) union++; if (b[i] && !a[i]) solo++; if (a[i] && !b[i]) falta++; }
  const iou = inter / union;
  const pasa = iou >= MIN_IOU;
  if (!pasa) ok = false;
  console.log(`${pasa ? '✓' : '✗'} ${nombre.padEnd(16)} coincidencia ${(iou * 100).toFixed(2)} %  (falta ${(falta * PX * PX).toFixed(2)} m², sobra ${(solo * PX * PX).toFixed(2)} m²)`);
}
console.log(ok ? 'silueta: la forma es la misma' : 'silueta: HAY DIFERENCIAS, no seguir');
process.exit(ok ? 0 : 1);
