// Postes de luz de Ciudad del Saber puestos POR REGLA (datos/postes.json). OpenStreetMap no tiene ninguno en Ciudad del Saber
// (consulta de Overpass del 6 de octubre de 2026: ningún highway=street_lamp ni lit=* en sus calles), así que no se observan:
// se ponen con una regla general y todos son clase III (supuesto). El único poste real del visor es el de la esquina del 106
// (sitio.glb), que no se toca ni se repite: cuenta como uno más de la regla.
//
// La regla (cada valor con su razón en REGLA, abajo):
//   · calles con alumbrado: las de OSM dentro del límite propuesto de la ciudad (docs/ciudad/limite-propuesto.geojson, no oficial)
//     de tipo tertiary, tertiary_link, secondary, residential o unclassified, y las service que tienen nombre (en Ciudad del Saber
//     son calles, como Jacinto Palacios o Ricardo Murgas). Las service sin nombre (accesos y estacionamientos), los pasillos de
//     estacionamiento, las entradas de casa, aceras, senderos, trochas y escaleras, no: no se sabe si tienen luz ni de qué tipo;
//   · un solo lado de cada calle, el que deja más lugares libres a lo largo de ella (la del poste real, en su lado); si un obstáculo deja un hueco de más de 1,5
//     pasos, ese tramo pasa al otro lado;
//   · un poste cada PASO m a lo largo de la calle, con el fuste a RETIRO m del borde del asfalto (el ancho de la calle es el que
//     dibuja contexto.mjs) y el brazo hacia la calle;
//   · no se pone donde cae dentro de otra calle o acera (cruces), a menos de 1 m de un edificio (huellas de OSM y del kit), a menos
//     de 1,5 m del tronco de un árbol (modelo/arboles.glb y las palmas de vegetacion.glb) ni fuera del límite;
//   · nada a menos de EXCLUSION m de la planta del 106 (su único poste es el real) y ninguno a menos de 0,85 pasos de otro de la
//     misma calle ni a menos de medio paso de uno de otra calle (los cruces y las calles que OSM parte en tramos).
// El mapa de luz que estos postes dejan en el suelo de noche lo arma el navegador con estos puntos (src/postes.js).
//   cd fuente && node postes.mjs       escribe datos/postes.json y un resumen en la consola
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { entornoRegistrado } from './entorno-osm.mjs';
import { osmRegistrado } from './contexto-osm.mjs';
import { suelo } from './ciudad-datos.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.join(AQUI, '..');
const leer = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

// el poste de la esquina del 106 (sitio.glb, medido en su malla): fuste de 0,14 m en (45,6; 16,4), recto hasta 8,8 m, un tramo
// inclinado hasta 11,2 m a 1,6 m del fuste y el brazo hasta la luminaria, a 3,0 m del fuste; la lámpara (POSTE de escena.js) a
// 11,3 m. El fuste queda a 1,9 m del bordillo de la calle Carlos Lara (bordillo en x 47,5). Los postes de la regla lo copian.
const REAL = { fuste: [45.6, 16.4], brazo: [1, 0], lampara: 11.3, alcance: 3.0, retiro: 1.9 };
const REGLA = {
  paso: { valor: 35, fuente: 'regla propia: unas tres veces la altura de la lámpara (11,3 m, la del poste de la esquina), un espaciado común para luminarias de brazo de un solo lado en calles de poco tránsito. No observado' },
  retiro: { valor: REAL.retiro, fuente: 'el del poste de la esquina del 106: fuste a 1,9 m del bordillo (sitio.glb)' },
  lado: { valor: 'uno', fuente: 'regla propia: un solo lado, el que deja más lugares libres' },
  exclusion: { valor: 35, fuente: 'regla propia: a menos de 35 m de la planta del 106 queda solo el poste real de la esquina' },
};
const PASO = REGLA.paso.valor, RETIRO = REGLA.retiro.valor, EXCLUSION = REGLA.exclusion.valor;
const PLANTA = [22.75, 11.5];                         // media planta del 106 (escena.js, PLANTA)
// anchos de las calles: los de contexto.mjs (ANCHO)
const ANCHO = { primary: 7.5, primary_link: 5, tertiary: 8, tertiary_link: 5, secondary: 8, residential: 8, unclassified: 8, service: 4, footway: 1.6, steps: 1.6 };
const CON_LUZ = new Set(['tertiary', 'tertiary_link', 'secondary', 'residential', 'unclassified']);
const conLuz = (c) => CON_LUZ.has(c.tipo) || (c.tipo === 'service' && !c.servicio && !!c.nombre);
// orden: las principales primero (eligen lado y lugar antes que las que llegan a ellas)
const PRIORIDAD = { tertiary: 0, secondary: 0, tertiary_link: 1, residential: 2, unclassified: 2, service: 3 };

const dentro = (P, x, z) => { let c = false; for (let i = 0, k = P.length - 1; i < P.length; k = i++) { const [xi, zi] = P[i], [xk, zk] = P[k]; if ((zi > z) !== (zk > z) && x < (xk - xi) * (z - zi) / (zk - zi) + xi) c = !c; } return c; };
const dSeg = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); };

// ---- las calles, con el mismo ajuste de contexto.mjs cerca del sitio (alinear): Jorge Gil y Carlos Lara de OSM pasan 2 a 5 m
// corridas de las modeladas; a menos de 12 m de su eje y paralelas se llevan a él, y 120 m más allá vuelven a su lugar de OSM
const sst = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const EJES_SITIO = [{ eje: 'z', valor: 23.5, de: -110, a: 110 }, { eje: 'x', valor: 52.25, de: -135, a: 95 }];
function alinear(L) {
  return L.map((p, i) => {
    const q = L[Math.min(i + 1, L.length - 1)], r = L[Math.max(i - 1, 0)], dx = q[0] - r[0], dz = q[1] - r[1], l = Math.hypot(dx, dz) || 1;
    let [x, z] = p;
    for (const e of EJES_SITIO) {
      const [a, b, paralelo] = e.eje === 'z' ? [p[1], p[0], Math.abs(dz / l) < 0.2] : [p[0], p[1], Math.abs(dx / l) < 0.2];
      if (!paralelo || Math.abs(a - e.valor) > 12) continue;
      const fuera = Math.max(e.de - b, b - e.a, 0), peso = 1 - sst(fuera / 120);
      if (e.eje === 'z') z += (e.valor - z) * peso; else x += (e.valor - x) * peso;
    }
    return [x, z];
  });
}

const ent = entornoRegistrado(), osm = osmRegistrado();
const mapa = leer(path.join(RAIZ, 'datos/ciudad_mapa.json'));
const LIM = mapa.limite;
const calles = ent.calles.filter((c) => ANCHO[c.tipo]).map((c) => ({ ...c, w: ANCHO[c.tipo], L: alinear(c.linea) }));

// ---- obstáculos en una rejilla de 4 m (para buscar rápido)
const CELDA = 4, rejilla = new Map(), clave = (i, k) => i * 100003 + k;
const meter = (x0, x1, z0, z1, o) => { for (let i = Math.floor(x0 / CELDA); i <= Math.floor(x1 / CELDA); i++) for (let k = Math.floor(z0 / CELDA); k <= Math.floor(z1 / CELDA); k++) { const c = clave(i, k); if (!rejilla.has(c)) rejilla.set(c, []); rejilla.get(c).push(o); } };
const cerca = (x, z) => rejilla.get(clave(Math.floor(x / CELDA), Math.floor(z / CELDA))) ?? [];
const M = 2;                                           // margen de la caja de cada obstáculo (m), más que cualquier holgura
// edificios: huellas de OSM (las del contexto y las del entorno ampliado) y las del kit (ciudad_mapa.json)
const huellas = [...osm.edificios.map((b) => b.poly), ...ent.edificios.map((b) => b.poly), ...mapa.edificios.map((e) => e.p)].filter((P) => P?.length > 2);
for (const P of huellas) { const xs = P.map((p) => p[0]), zs = P.map((p) => p[1]); meter(Math.min(...xs) - M, Math.max(...xs) + M, Math.min(...zs) - M, Math.max(...zs) + M, { t: 'edificio', P }); }
// calles y aceras (todas las que se dibujan): un poste no va dentro de ninguna
for (const c of calles) for (let i = 1; i < c.L.length; i++) {
  const a = c.L[i - 1], b = c.L[i], r = c.w / 2 + M;
  meter(Math.min(a[0], b[0]) - r, Math.max(a[0], b[0]) + r, Math.min(a[1], b[1]) - r, Math.max(a[1], b[1]) + r, { t: 'calle', a, b, w: c.w, id: c.id });
}
// troncos: las instancias de los árboles (arboles.glb) y los tallos y palmas del sitio (vegetacion.glb)
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
let troncos = 0;
for (const archivo of ['arboles.glb', 'vegetacion.glb']) {
  const doc = await io.read(path.join(RAIZ, 'modelo', archivo));
  for (const n of doc.getRoot().listNodes()) {
    const ins = n.getExtension('EXT_mesh_gpu_instancing'), nm = n.getName();
    if (ins && /bark/i.test(nm)) {
      const T = ins.getAttribute('TRANSLATION'), v = [0, 0, 0];
      for (let i = 0; i < T.getCount(); i++) { T.getElement(i, v); meter(v[0] - M, v[0] + M, v[2] - M, v[2] + M, { t: 'tronco', p: [v[0], v[2]] }); troncos++; }
    } else if (!ins && n.getMesh() && /stem|cane|trunk|bark/i.test(nm)) {
      const W = n.getWorldMatrix(), v = [0, 0, 0];
      for (const pr of n.getMesh().listPrimitives()) {
        const P = pr.getAttribute('POSITION');
        for (let i = 0; i < P.getCount(); i++) {
          P.getElement(i, v); const y = W[1] * v[0] + W[5] * v[1] + W[9] * v[2] + W[13]; if (y > 1.5) continue;
          const x = W[0] * v[0] + W[4] * v[1] + W[8] * v[2] + W[12], z = W[2] * v[0] + W[6] * v[1] + W[10] * v[2] + W[14];
          meter(x - M, x + M, z - M, z + M, { t: 'tronco', p: [x, z] }); troncos++;
        }
      }
    }
  }
}

/** ¿Se puede poner un fuste en (x, z)? `propia`: la calle a la que pertenece (no cuenta como obstáculo). */
function libre(x, z, propia) {
  if (!dentro(LIM, x, z)) return 'limite';
  if (Math.abs(x) < PLANTA[0] + EXCLUSION && Math.abs(z) < PLANTA[1] + EXCLUSION) return 'exclusion';
  for (const o of cerca(x, z)) {
    if (o.t === 'tronco' && Math.hypot(x - o.p[0], z - o.p[1]) < 1.5) return 'tronco';
    if (o.t === 'calle' && o.id !== propia && dSeg(x, z, o.a, o.b) < o.w / 2 + 0.5) return 'calle';
    if (o.t === 'edificio' && (dentro(o.P, x, z) || o.P.some((p, i) => dSeg(x, z, p, o.P[(i + 1) % o.P.length]) < 1))) return 'edificio';
  }
  return null;
}

// ---- recorrido de cada calle con luz, de 1 en 1 m
const postes = [{ x: REAL.fuste[0], z: REAL.fuste[1], calle: 'Calle Carlos Lara', real: true }];
const motivos = {}; let largoConLuz = 0;
const conLuzOrd = calles.filter(conLuz).sort((a, b) => (PRIORIDAD[a.tipo] - PRIORIDAD[b.tipo]) || (b.L.length - a.L.length));
for (const c of conLuzOrd) {
  // puntos cada 1 m con su normal (izquierda del sentido de la vía)
  const S = [];
  for (let i = 1; i < c.L.length; i++) {
    const a = c.L[i - 1], b = c.L[i], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); if (l < 1e-3) continue;
    const n = Math.max(1, Math.round(l)), nx = -dz / l, nz = dx / l;
    for (let k = 0; k < n; k++) S.push({ p: [a[0] + dx * k / n, a[1] + dz * k / n], n: [nx, nz] });
  }
  if (!S.length) continue;
  const enLim = S.filter((s) => dentro(LIM, s.p[0], s.p[1])).length; largoConLuz += enLim;
  if (!enLim) continue;
  const off = c.w / 2 + RETIRO;
  const cand = (s, lado) => [s.p[0] + s.n[0] * off * lado, s.p[1] + s.n[1] * off * lado];
  // el lado con más lugares libres
  const cuenta = (lado) => S.filter((s) => { const q = cand(s, lado); return !libre(q[0], q[1], c.id); }).length;
  // la calle del poste real sigue en su lado (Carlos Lara, al oeste); las demás, en el lado con más lugares libres
  const real = postes[0], junto = S.reduce((m, s) => { const d = Math.hypot(real.x - s.p[0], real.z - s.p[1]); return d < m.d ? { d, s } : m; }, { d: Infinity });
  const lado0 = junto.d < c.w / 2 + RETIRO + 2 ? Math.sign((real.x - junto.s.p[0]) * junto.s.n[0] + (real.z - junto.s.p[1]) * junto.s.n[1]) || 1
    : cuenta(1) >= cuenta(-1) ? 1 : -1;
  let desde = Infinity;                                 // metros desde el último poste de esta calle
  for (const s of S) {
    desde++;
    if (desde < PASO) continue;
    let elegido = null;
    for (const lado of desde >= 1.5 * PASO ? [lado0, -lado0] : [lado0]) {
      const q = cand(s, lado), m = libre(q[0], q[1], c.id);
      if (m) { motivos[m] = (motivos[m] ?? 0) + 1; continue; }
      const muyCerca = postes.some((o) => { const d = Math.hypot(o.x - q[0], o.z - q[1]); return d < (o.calle && o.calle === c.nombre ? 0.85 * PASO : 0.5 * PASO); });
      if (muyCerca) { motivos.vecino = (motivos.vecino ?? 0) + 1; continue; }
      elegido = { q, lado }; break;
    }
    if (!elegido) continue;
    // el brazo hacia la calle (contra la normal del lado)
    const ang = Math.atan2(-s.n[1] * elegido.lado, -s.n[0] * elegido.lado);
    postes.push({ x: elegido.q[0], z: elegido.q[1], y: suelo(elegido.q), ang, calle: c.nombre || null, tipo: c.tipo, otroLado: elegido.lado !== lado0 });
    desde = 0;
  }
}

const nuevos = postes.filter((p) => !p.real);
const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
const out = {
  generado_por: 'fuente/postes.mjs',
  certeza: 'III',
  fuente: 'Puestos por regla, no observados: OpenStreetMap no tiene postes de luz en Ciudad del Saber (consulta de Overpass del 6 de octubre de 2026). Calles de OpenStreetMap (osm-amplio.json, © colaboradores de OpenStreetMap, ODbL 1.0); límite propuesto, no oficial',
  regla: REGLA,
  // el poste tal como lo dibuja el visor (src/postes.js): copia del de la esquina
  poste: { lampara: { valor: REAL.lampara, fuente: 'altura de la lámpara del poste de la esquina (POSTE de escena.js)' }, alcance: { valor: REAL.alcance, fuente: 'del fuste a la lámpara, en el poste de la esquina' } },
  // [x, z, y del suelo, rumbo del brazo en radianes (atan2(dz, dx))]
  postes: nuevos.map((p) => [r2(p.x), r2(p.z), r2(p.y), r3(p.ang)]),
};
fs.writeFileSync(path.join(RAIZ, 'datos/postes.json'), JSON.stringify(out));
const porTipo = {}; for (const p of nuevos) porTipo[p.tipo] = (porTipo[p.tipo] ?? 0) + 1;
console.log(`datos/postes.json: ${nuevos.length} postes (más el real de la esquina) · ${(largoConLuz / 1000).toFixed(1)} km de calles con luz dentro del límite · por tipo ${JSON.stringify(porTipo)}`);
console.log(`${nuevos.filter((p) => p.otroLado).length} postes pasan al otro lado de su calle por un hueco de más de 1,5 pasos`);
console.log(`lugares descartados (metros recorridos): ${JSON.stringify(motivos)} · troncos ${troncos} · ${(fs.statSync(path.join(RAIZ, 'datos/postes.json')).size / 1024).toFixed(0)} KB`);
const xs = nuevos.map((p) => p.x), zs = nuevos.map((p) => p.z);
console.log(`caja: x ${Math.min(...xs).toFixed(0)} a ${Math.max(...xs).toFixed(0)}, z ${Math.min(...zs).toFixed(0)} a ${Math.max(...zs).toFixed(0)}`);
