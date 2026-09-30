// Huellas de OpenStreetMap del entorno del Edificio 106, llevadas a coordenadas de la escena y registradas contra el modelo.
// Datos: fuente/osm.json (Overpass API, radio de 200 m alrededor de 8,9993° N, 79,5827° O, base del 6 de mayo de 2026).
// © colaboradores de OpenStreetMap, licencia ODbL 1.0 (https://www.openstreetmap.org/copyright).
//
// Paso 1, de latitud y longitud a la escena: este-norte en metros desde el punto del sitio (LAT, LON de src/sol.js, esfera
// de 6.378.137 m, suficiente a 200 m), y de ahí al marco de la escena con la misma convención que vectorSol: el eje +X de la
// escena apunta al rumbo EJE_LARGO (56°), +Z a 146° (sureste). r = hypot(E, N), az = atan2(E, N), ang = 56° − az,
// x = r·cos(ang), z = −r·sin(ang).
//
// Paso 2, registro: la huella OSM del 106 (vía 300885891) queda a 18,1 m del modelo (−14,2 m en X y −11,2 m en Z) y girada
// −1,0°, con casi el mismo tamaño (46,0 × 22,6 m en OSM, 45,5 × 23 m en el modelo). Se decidió mover OSM hacia el modelo y no
// al revés: todo lo que calcula el visor (sol, aleros, cámaras, rosa, QR) está referido al 106 del modelo, y lo que importa
// para las sombras son las distancias y posiciones relativas entre el 106 y sus vecinos, que OSM conserva. La transformación
// es rígida (sin escala): se gira todo OSM +1,0° alrededor del centro de la huella del 106 y se traslada ese centro a (0, 0).
// El giro es el que deja la huella OSM del 106 paralela al modelo; los otros cuarteles del cuadrángulo en OSM son paralelos a
// ella (−1 a −2°), así que quedan paralelos al 106 como en la realidad. Comprobado contra el mapa de Google del usuario
// (capturas del 29 de septiembre de 2026): con la escala de esa captura (~3,7 px/m) el 105 queda a (−62, +3) m del 106
// (OSM registrado: −65,7, +1,5), La Casa, el salón de enfrente (OSM 108), a (+27, +39) (OSM: +23, +44) y Balboa Academy a (+91, −4) (OSM: +95, −4):
// diferencias de 3 a 5 m, del orden de lo que se puede leer en esa captura.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAT, LON, EJE_LARGO } from './src/sol.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const R = 6378137, rad = Math.PI / 180;
export const ID_106 = 300885891;

/** Latitud y longitud → (x, z) de la escena, sin registrar. */
export function aEscena(lat, lon) {
  const E = (lon - LON) * rad * R * Math.cos(LAT * rad), N = (lat - LAT) * rad * R;
  const r = Math.hypot(E, N), az = Math.atan2(E, N) / rad, a = (EJE_LARGO - az) * rad;
  return [r * Math.cos(a), -r * Math.sin(a)];
}

function centroide(p) {
  let A = 0, cx = 0, cz = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length], c = x1 * z2 - x2 * z1;
    A += c; cx += (x1 + x2) * c; cz += (z1 + z2) * c;
  }
  A /= 2; return { A: Math.abs(A), c: [cx / (6 * A), cz / (6 * A)], signo: Math.sign(A) };
}
/** Ángulo del lado más largo (grados, en el plano x-z, atan2(dz, dx)), llevado a (−45°, 45°]. */
function anguloPrincipal(p) {
  let mejor = 0, L = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length], l = Math.hypot(x2 - x1, z2 - z1);
    if (l > L) { L = l; mejor = Math.atan2(z2 - z1, x2 - x1) / rad; }
  }
  while (mejor > 45) mejor -= 90; while (mejor <= -45) mejor += 90;
  return mejor;
}

/** Lee osm.json y devuelve los edificios y las calles ya registrados al modelo, más el registro usado. */
export function osmRegistrado(archivo = path.join(AQUI, 'osm.json')) {
  const j = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const crudos = j.elements.filter((e) => e.type === 'way' && e.geometry).map((e) => {
    const p = e.geometry.map((g) => aEscena(g.lat, g.lon));
    const cerrado = p.length > 2 && Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 1e-6;
    if (cerrado) p.pop();
    return { e, p };
  });
  const b106 = crudos.find((c) => c.e.id === ID_106);
  const c0 = centroide(b106.p).c, th = -anguloPrincipal(b106.p) * rad;   // el giro que deja el 106 de OSM paralelo al modelo
  const co = Math.cos(th), si = Math.sin(th);
  const reg = ([x, z]) => { const dx = x - c0[0], dz = z - c0[1]; return [dx * co - dz * si, dx * si + dz * co]; };
  const edificios = [], calles = [];
  for (const { e, p } of crudos) {
    const q = p.map(reg), t = e.tags ?? {};
    if (t.building) {
      const { A, c, signo } = centroide(q);
      if (signo < 0) q.reverse();                      // antihorario en (x, z)
      const ang = anguloPrincipal(q);
      // largo y ancho en el marco del lado principal
      const ca = Math.cos(-ang * rad), sa = Math.sin(-ang * rad);
      const loc = q.map(([x, z]) => [(x - c[0]) * ca - (z - c[1]) * sa, (x - c[0]) * sa + (z - c[1]) * ca]);
      const xs = loc.map((v) => v[0]), zs = loc.map((v) => v[1]);
      edificios.push({ id: e.id, num: t['addr:housenumber'] ?? '', nombre: t.name ?? '', niveles: t['building:levels'] ? +t['building:levels'] : null,
        tipo: t.building, poly: q, area: A, centro: c, ang, largo: Math.max(...xs) - Math.min(...xs), ancho: Math.max(...zs) - Math.min(...zs),
        caja: [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)] });
    } else if (t.highway) calles.push({ id: e.id, tipo: t.highway, servicio: t.service ?? '', linea: q });
  }
  return { edificios, calles, registro: { rotacionGrados: th / rad, centroOSM106: c0, traslacion: [-c0[0], -c0[1]] }, fecha: j.osm3s?.timestamp_osm_base };
}

/** Distancia horizontal más corta entre dos polígonos convexos o no (por lados), 0 si se cruzan. */
export function distanciaPoligonos(a, b) {
  const dps = (p, u, v) => { const dx = v[0] - u[0], dz = v[1] - u[1], t = Math.max(0, Math.min(1, ((p[0] - u[0]) * dx + (p[1] - u[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p[0] - u[0] - t * dx, p[1] - u[1] - t * dz); };
  let d = Infinity;
  for (let i = 0; i < a.length; i++) for (let k = 0; k < b.length; k++) d = Math.min(d, dps(a[i], b[k], b[(k + 1) % b.length]), dps(b[k], a[i], a[(i + 1) % a.length]));
  return d;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const o = osmRegistrado();
  console.log('registro', o.registro, 'base OSM', o.fecha);
  const P106 = [[-22.75, -11.5], [22.75, -11.5], [22.75, 11.5], [-22.75, 11.5]];
  for (const b of o.edificios.sort((u, v) => Math.hypot(...u.centro) - Math.hypot(...v.centro)))
    console.log(String(b.id).padEnd(11), b.num.padEnd(8), (b.nombre || '').slice(0, 26).padEnd(26), 'niv', String(b.niveles ?? '-').padEnd(2), 'c', b.centro.map((v) => v.toFixed(1)).join(','), 'ang', b.ang.toFixed(2), 'dim', b.largo.toFixed(1), '×', b.ancho.toFixed(1), 'n', b.poly.length, 'dist106', distanciaPoligonos(b.poly, P106).toFixed(1));
}
