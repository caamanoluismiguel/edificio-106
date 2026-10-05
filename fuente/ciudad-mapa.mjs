// Mapa liviano de Ciudad del Saber para la navegación libre (main.js, src/navegar.js): datos/ciudad_mapa.json.
// No inventa nada: junta lo que ya usan el contexto y la ciudad.
//   · limite: el límite propuesto (docs/ciudad/limite-propuesto.geojson, no oficial) en metros de la escena (aReg de ciudad-datos.mjs);
//   · suelo: el terreno de la escena (suelo() de ciudad-datos.mjs: el sitio del 106 y la rejilla de 40 m de contexto.mjs sobre
//     Copernicus GLO-30), muestreado cada PASO m (el paso de la rejilla): con él el punto que se mira nunca queda bajo el suelo;
//   · edificios: por cada edificio del inventario, su número, tipología del kit, clase de certeza, cómo se dibuja, la huella
//     simplificada en la escena, el suelo bajo ella y una altura de techo aproximada (la del kit, la de la caja de contexto.mjs:
//     niveles de OSM × 3,65 + 0,65 o Open Buildings p90, o la del 106). Sirve para elegir un edificio con dos toques y para que la
//     cámara no entre en uno. Las alturas no se muestran: son aproximadas.
// Uso: cd fuente && node ciudad-mapa.mjs   (se rehace cuando cambian edificios.json o el límite)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aReg, suelo } from './ciudad-datos.mjs';
import { osmRegistrado } from './contexto-osm.mjs';
import { entornoRegistrado } from './entorno-osm.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.join(AQUI, '..');
const leer = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const E = leer(path.join(RAIZ, 'docs/ciudad/edificios.json')).edificios;
const LIM = leer(path.join(RAIZ, 'docs/ciudad/limite-propuesto.geojson')).features[0].geometry.coordinates[0];
const OB = leer(path.join(AQUI, 'alturas_ob.json')).edificios;
const osm = osmRegistrado(), ent = entornoRegistrado();
const polyDe = (id) => osm.edificios.find((b) => b.id === id) ?? ent.edificios.find((b) => b.id === id) ?? null;
const r1 = (x) => Math.round(x * 10) / 10;
const PASO = 40;

// límite en la escena (sin repetir el primer punto)
let limite = LIM.map(([lon, lat]) => aReg(lat, lon).map(r1));
if (limite.length > 1 && limite[0][0] === limite.at(-1)[0] && limite[0][1] === limite.at(-1)[1]) limite.pop();

// Douglas–Peucker cerrado, tolerancia 0,5 m: la huella para elegir y para la cámara, no para dibujar
function simplificar(P, tol = 0.5) {
  if (P.length <= 4) return P;
  const d = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / L; };
  const dp = (Q) => { let m = 0, k = 0; for (let i = 1; i < Q.length - 1; i++) { const v = d(Q[i], Q[0], Q.at(-1)); if (v > m) { m = v; k = i; } } return m > tol ? [...dp(Q.slice(0, k + 1)).slice(0, -1), ...dp(Q.slice(k))] : [Q[0], Q.at(-1)]; };
  const R = dp([...P, P[0]]); R.pop(); return R.length >= 3 ? R : P;
}
const PISO = 3.65, BASE = 0.65;
const edificios = [];
for (const e of E) {
  if (e.modelo === 'unido') continue;                                  // lo dibuja su otra mitad (332B con el 332A)
  const b = polyDe(e.osm_id), poly = e.parametros && e.poly ? e.poly : b?.poly;
  if (!poly) { console.warn('sin huella', e.numero, e.osm_id); continue; }
  const P = simplificar(poly.map((p) => [p[0], p[1]])).map((p) => p.map(r1));
  const ys = P.map(suelo), y0 = e.suelo?.y0 ?? Math.min(...ys);
  let alto;
  if (e.resultado?.cumbrera) alto = e.resultado.cumbrera;
  else if (e.modelo === 'cuartel106' || e.modelo === 'el 106 (modelo propio)') alto = 15.7;
  else { const ob = !b?.niveles && OB[e.osm_id]?.cubre >= 0.6 ? OB[e.osm_id] : null; alto = ob ? ob.p90 : (b?.niveles ?? 2) * PISO + BASE; }
  // k: con la ciudad apagada, en su lugar queda una copia reducida del 106 (contexto.glb)
  edificios.push({ n: e.numero ?? null, t: e.tipologia ?? null, c: e.clase_certeza, m: e.modelo, ...(e.en_contexto ? { k: 1 } : {}), y0: r1(y0), h: r1(alto), p: P });
}

// suelo cada PASO m en la caja del límite más 400 m (el borde blando y la cámara alejada)
const xs = limite.map((p) => p[0]), zs = limite.map((p) => p[1]);
const x0 = Math.floor((Math.min(...xs) - 400) / PASO) * PASO, z0 = Math.floor((Math.min(...zs) - 400) / PASO) * PASO;
const nx = Math.ceil((Math.max(...xs) + 400 - x0) / PASO) + 1, nz = Math.ceil((Math.max(...zs) + 400 - z0) / PASO) + 1;
const y = []; for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) y.push(r1(suelo([x0 + i * PASO, z0 + k * PASO])));

const out = { generado_por: 'fuente/ciudad-mapa.mjs', fuentes: 'docs/ciudad/edificios.json, docs/ciudad/limite-propuesto.geojson (no oficial), terreno de contexto.mjs; alturas aproximadas, solo para elegir y para la cámara',
  limite, suelo: { x0, z0, paso: PASO, nx, nz, y }, edificios };
fs.writeFileSync(path.join(RAIZ, 'datos/ciudad_mapa.json'), JSON.stringify(out));
console.log(`datos/ciudad_mapa.json: ${edificios.length} edificios, límite de ${limite.length} puntos, suelo ${nx} × ${nz}, ${(fs.statSync(path.join(RAIZ, 'datos/ciudad_mapa.json')).size / 1024).toFixed(0)} KB`);
