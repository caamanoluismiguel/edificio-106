// Kit de piezas de cuartel de Ciudad del Saber (fase 3, rama feat/ciudad). Biblioteca: la usa fuente/ciudad.mjs, que arma
// modelo/ciudad.glb con los datos de fuente/ciudad-datos.mjs. Las medidas del kit NO son supuestas: se miden en los GLB del 106
// de main al importar este módulo (medir106()), con el nodo de origen de cada una.
//
//   cd fuente && node ciudad-kit.mjs --medir    solo mide el 106 y lo imprime
//
// cuartel(e) devuelve la geometría de un edificio separada por parte (muro, moldura, teja, mediagua, vidrio, celosía, madera,
// ventilación, servicio). Cada parte sale con el material del 106 (MATERIAL_106, leído de los GLB de main) y la escena le aplica
// la misma función de material que al 106 (escena.js #material, vía src/ciudad.js). El muro lleva además, por vértice, la
// distancia hasta el encuentro muro-alero de encima (atributo _AOH), para el sustituto de oclusión bajo los aleros del 106 en
// edificios que no están a la altura del 106.
// Coordenadas de la escena: +X noreste, +Z sureste, Y arriba (registro de contexto-osm.mjs).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { ShapeUtils, Vector2 } from 'three';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MODELO = path.join(AQUI, '..', 'modelo');
const SOLO_MEDIR = process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--medir');
const rad = Math.PI / 180;

await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// =====================================================================================================================
// 1. Medidas del 106 (modelo/*.glb de main)
// =====================================================================================================================
/** Triángulos en coordenadas de la escena de las mallas de un GLB cuyo material cumple `re`. */
async function triangulos(grupo, re) {
  const doc = await io.read(path.join(MODELO, grupo + '.glb')), out = [];
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m) continue; const M = n.getWorldMatrix();
    for (const p of m.listPrimitives()) {
      if (!re.test(p.getMaterial()?.getName() ?? '')) continue;
      const A = p.getAttribute('POSITION'), I = p.getIndices(), v = [0, 0, 0], P = [];
      for (let k = 0; k < A.getCount(); k++) { A.getElement(k, v); P.push([M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]]); }
      const c = I ? I.getCount() : A.getCount();
      for (let k = 0; k < c; k += 3) {
        const a = P[I ? I.getScalar(k) : k], b = P[I ? I.getScalar(k + 1) : k + 1], d = P[I ? I.getScalar(k + 2) : k + 2];
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
        let N = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const L = Math.hypot(...N); if (L < 1e-9) continue;
        N = N.map((x) => x / L);
        out.push({ v: [a, b, d], n: N, area: L / 2, y: (a[1] + b[1] + d[1]) / 3, nodo: n.getName(), mat: p.getMaterial()?.getName() });
      }
    }
  }
  return out;
}
const minA = (a) => a.reduce((x, y) => Math.min(x, y), Infinity), maxA = (a) => a.reduce((x, y) => Math.max(x, y), -Infinity);
const r3 = (x) => Math.round(x * 1000) / 1000;
/** Pendiente media (grados, ponderada por área) de las caras de madera que miran hacia arriba en una franja de altura. */
function pendiente(T, y0, y1, arriba = true) {
  let A = 0, S = 0; const ys = [];
  for (const t of T) { if (t.y < y0 || t.y > y1) continue; const ny = arriba ? t.n[1] : -t.n[1]; if (ny < 0.5 || ny > 0.995) continue; A += t.area; S += t.area * Math.acos(ny) / rad; for (const p of t.v) ys.push(p[1]); }
  return { grados: S / A, yMin: minA(ys), yMax: maxA(ys) };
}
// Cada parte del kit lleva EL MATERIAL DEL 106 (grupo y nombre en los GLB de main). La escena le aplica la misma función que al
// 106 y a sus copias del contexto (escena.js #material, grupo «contexto»): mismo color, rugosidad, metalicidad y retoques.
// Teja y mediagua: «Clay terracotta 04», el del medio de los nueve tonos (00 a 08) que el 106 reparte entre sus tejas.
export const MATERIAL_106 = {
  muro: ['arquitectura', 'Warm lime-painted plaster'], moldura: ['detalles', 'Fresh cream trim'],
  teja: ['cubiertas', 'Clay terracotta 04'], mediagua: ['cubiertas', 'Clay terracotta 04'],
  vidrio: ['arquitectura', 'V014 physical clear glass 0'], celosia: ['detalles', 'Weathered blue-grey louvre'],
  madera: ['cubiertas', 'Dark stained roof timber'],
  ventilacion: ['cubiertas', 'Dark ventilation recess'], servicio: ['detalles', 'Brown painted service access'],
  // solo el dúplex: el piso de concreto de la planta baja (el concreto gastado del acceso del 106, sitio.glb)
  piso: ['sitio', 'V013 aged access concrete'],
  // solo cerca (pulido, recorte de WebGL 2 aprobado por LM el 5 oct 2026): la teja en canales del dúplex y de las casas de oficiales y los
  // balaustres de sus escaleras van en partes propias, con el mismo material, para que la escena las dibuje solo a menos de LOD.cerca m
  canalTeja: ['cubiertas', 'Clay terracotta 04'], canalMediagua: ['cubiertas', 'Clay terracotta 04'],
  balaustre: ['detalles', 'Brown painted service access'],
  // estacionamientos de OSM (pulido): el asfalto de las calles del contexto (contexto.glb), el mismo material y la misma textura
  asfalto: ['contexto', 'V017 street asphalt (OSM)'],
  // lámina ondulada (pulido): los faldones de lámina de las casas bajas y las naves en el detalle alto, con el material de la teja; la escena
  // le pone las ondas en el sombreado (src/ciudad.js). En los niveles medio y lejos siguen en 'teja', lisos
  lamina: ['cubiertas', 'Clay terracotta 04'],
  // la lámina azul de una cochera del área 900 (pulido): la lámina azul gris del contexto (contexto.glb)
  laminaAzul: ['contexto', 'Blue-gray metal roof sheet'],
};
async function medir106() {
  const muro = await triangulos('arquitectura', /^Warm lime-painted plaster$/);
  const piso = await triangulos('arquitectura', /interior floor/);
  const vidrio = await triangulos('arquitectura', /clear glass/);
  const madera = await triangulos('cubiertas', /roof timber/);
  const cabios = await triangulos('detalles', /roof timber/);
  const rejilla = await triangulos('detalles', /Weathered blue-grey louvre/);
  const xs = muro.flatMap((t) => t.v.map((p) => p[0])), zs = muro.flatMap((t) => t.v.map((p) => p[2])), ys = muro.flatMap((t) => t.v.map((p) => p[1]));
  const M = {};
  M.planta = { largo: r3(maxA(xs) - minA(xs)), ancho: r3(maxA(zs) - minA(zs)), fuente: 'arquitectura.glb · nodo «Warm lime-painted plaster» (caja en x y z)' };
  M.muroArriba = { y: r3(maxA(ys)), fuente: 'arquitectura.glb · nodo «Warm lime-painted plaster» (y máxima)' };
  const pisosY = [...new Set(piso.filter((t) => t.n[1] > 0.9).map((t) => r3(minA(t.v.map((p) => p[1])))))].sort((a, b) => a - b);
  // las losas: la cara de arriba del piso de cada nivel (0,65 · 4,30 · 7,95); hay también un escalón de 0,76 y una tapa de 1,28
  const losas = pisosY.filter((y) => [0.65, 4.3, 7.95].some((r) => Math.abs(r - y) < 0.02));
  M.base = { y: losas[0], fuente: 'arquitectura.glb · nodo «V014 muted interior floor» (losa del piso 1)' };
  M.piso = { m: r3((losas[2] - losas[0]) / 2), losas, fuente: 'arquitectura.glb · nodo «V014 muted interior floor» (losas a ' + losas.join(' · ') + ' m)' };
  // aleros: el borde exterior del sofito plano (caras de madera que miran abajo, n.y < −0,995) y su altura por nivel
  const planos = madera.filter((t) => t.n[1] <= -0.995);
  const niveles = [...new Set(planos.map((t) => r3(t.y)))].sort((a, b) => a - b);
  const bx = maxA(planos.flatMap((t) => t.v.map((p) => p[0]))), bz = maxA(planos.flatMap((t) => t.v.map((p) => p[2])));
  M.alero = { vuelo: r3(bx - maxA(xs)), vueloCorto: r3(bz - maxA(zs)), sofitoPlano: niveles, fuente: 'cubiertas.glb · nodo «Dark stained roof timber» (sofito plano: n.y < −0,995; borde x ±' + bx.toFixed(2) + ', z ±' + bz.toFixed(2) + ')' };
  const techo = pendiente(madera, 11, 16), med1 = pendiente(madera, 3.5, 5), med2 = pendiente(madera, 7, 8.5);
  const sof = pendiente(madera, 11, 16, false), sof1 = pendiente(madera, 3.5, 5, false);
  M.techo = { pendiente: r3(techo.grados), yAlero: r3(techo.yMin), yCumbrera: r3(techo.yMax), sofitoAlero: r3(sof.yMin), forma: 'cuatro aguas',
    fuente: 'cubiertas.glb · nodo «Dark stained roof timber», caras que miran arriba sobre 11 m (pendiente media ponderada por área; y mín = canto del alero, y máx = cumbrera)' };
  M.mediagua = { pendiente: r3((med1.grados + med2.grados) / 2), pendientes: [r3(med1.grados), r3(med2.grados)], yBorde: [r3(med1.yMin), r3(med2.yMin)], sofitoBorde: r3(sof1.yMin),
    fuente: 'cubiertas.glb · nodo «Dark stained roof timber», caras que miran arriba entre 3,5 y 5 m y entre 7 y 8,5 m' };
  // vanos de la fachada SE (z > 11,3): bordes de los paños de vidrio en x; el módulo es el período de esos bordes
  const se = vidrio.filter((t) => t.v[0][2] > 11.3 && Math.abs(t.n[2]) > 0.9);
  // bordes: los x de los vértices agrupados de a 0,1 m (más de 10 vértices), con el promedio exacto de cada grupo
  const cuenta = new Map(); for (const t of se) for (const p of t.v) { const k = (Math.round(p[0] * 10) / 10).toFixed(1), c = cuenta.get(k) ?? [0, 0]; cuenta.set(k, [c[0] + 1, c[1] + p[0]]); }
  const bordes = [...cuenta.values()].filter((e) => e[0] > 10).map((e) => r3(e[1] / e[0])).sort((a, b) => a - b);
  // período: la traslación que hace coincidir más bordes consigo mismos (entre 5 y 9 m)
  // (a igual cantidad, el de menor error medio: con bordes redondeados a 0,1 m, 6,65 y 6,70 calzan los mismos 43)
  let mejor = { p: 0, n: 0, e: Infinity };
  for (let p = 5; p <= 9.001; p += 0.01) {
    const res = bordes.map((b) => Math.min(...bordes.map((c) => Math.abs(c - (b + p))))).filter((r) => r < 0.06);
    const e = res.reduce((a, b) => a + b, 0) / (res.length || 1);
    if (res.length > mejor.n || (res.length === mejor.n && e < mejor.e - 1e-9)) mejor = { p: Math.round(p * 100) / 100, n: res.length, e };
  }
  const yv = new Map(); for (const t of se) for (const p of t.v) { const k = r3(p[1]).toFixed(2); yv.set(k, (yv.get(k) ?? 0) + 1); }
  const yVid = [...yv.entries()].filter((e) => e[1] > 20).map((e) => +e[0]).sort((a, b) => a - b);
  M.vanos = { modulo: mejor.p, bordesQueCoinciden: mejor.n, errorMedio: r3(mejor.e), bordesX: bordes, vidrioY: yVid,
    fuente: 'arquitectura.glb · nodos «V014 physical clear glass 0/1/2», fachada SE (z > 11,3): bordes de los paños en x y en y' };
  // (v1 y v2 medían aquí «cabios cada 1,625 m» agrupando de a 0,25 m: eran las viguetas horizontales cada 0,65 m, ver
  // mediaguaPiezas.viguetas más abajo)
  const ry = rejilla.flatMap((t) => t.v.map((p) => p[1]));
  M.rejillaZocalo = { y0: r3(minA(ry)), y1: r3(maxA(ry)), fuente: 'detalles.glb · nodo «Weathered blue-grey louvre» (rejillas de ventilación del zócalo)' };
  // ménsulas: las piezas de «Fresh cream trim» de la fachada SE bajo el alero del piso 1 (la que está en x ≈ 3,35, y de 2 a 4,2 m).
  // Perfil (distancia al muro, altura) de sus vértices de la cara lateral, ancho en x y altura relativa a la losa del piso 2
  const trim = await triangulos('detalles', /^Fresh cream trim$/);
  const men = trim.filter((t) => t.v.every((p) => Math.abs(p[0] - 3.35) < 0.4 && p[2] > 11.52 && p[1] > 1.5 && p[1] < 4.2));
  const mx = men.flatMap((t) => t.v.map((p) => p[0])), wallZ = maxA(zs);
  const perfil = [...new Map(men.flatMap((t) => t.v).map((p) => [r3(p[2]).toFixed(2) + ',' + r3(p[1]).toFixed(2), [r3(p[2] - wallZ), r3(p[1] - M.piso.losas[1])]])).values()];
  M.mensula = { ancho: r3(maxA(mx) - minA(mx)), perfil, niveles: 'bajo cada mediagua y bajo el alero del techo (y 3,07 a 3,84 · 6,72 a 7,49 · 10,37 a 11,14)',
    fuente: 'detalles.glb · nodo «Fresh cream trim», piezas de la fachada SE (z > 11,52) junto a x = 3,35; perfil = (distancia al muro, altura sobre la losa del piso 2)' };
  // frente de la teja de la mediagua: el espesor de la teja modelada en su borde (z > 12,9 en la SE, bajo 5 m)
  const tej = await triangulos('cubiertas', /terracotta/);
  const borde = tej.filter((t) => t.v.every((p) => p[2] > 12.9 && p[1] < 5)).flatMap((t) => t.v.map((p) => p[1]));
  M.mediagua.frenteTeja = { y0: r3(minA(borde)), y1: r3(maxA(borde)), alto: r3(maxA(borde) - minA(borde)), fuente: 'cubiertas.glb · nodos «Clay terracotta 00…08», vértices a menos de 0,2 m del borde de la mediagua del piso 1 (SE)' };
  // La mediagua del piso 1 en la fachada SE, pieza por pieza (todo relativo a la losa del piso 2, 4,301 m, y al plomo del muro,
  // z = maxA(zs)). Lo mismo, relativo al remate del muro, para el alero del techo (mismas piezas, 3,649 m más arriba).
  // Tablero inclinado: las caras de madera de cubiertas.glb (canto y sofito, arriba). Teja: lo que sube la arcilla sobre el tablero.
  const losa2 = M.piso.losas[1], tanM = Math.tan(M.mediagua.pendientes[0] * rad);
  const sobre = tej.filter((t) => t.v.every((p) => p[2] > wallZ + 0.1 && p[2] < wallZ + 1.5 && p[1] < 5 && p[1] > 3.5 && Math.abs(p[0]) < 20))
    .flatMap((t) => t.v.map((p) => p[1] - (M.mediagua.yBorde[0] + (bz - 0.05 - p[2]) * tanM))).sort((a, b) => a - b);
  // tabla de borde (fascia): madera de cubiertas.glb con todos los vértices a más de 1,5 m del muro y bajo 4,2 m (SE)
  const fasM = madera.filter((t) => t.v.every((p) => p[2] > wallZ + 1.5 && p[1] < 4.2 && p[1] > 3.5)), fasP = fasM.flatMap((t) => t.v);
  const fasT = madera.filter((t) => t.v.every((p) => p[2] > wallZ + 1.5 && p[1] < 11.3 && p[1] > 10.9)).flatMap((t) => t.v);
  // viguetas horizontales bajo el tablero (madera de detalles.glb, SE, bajo 4,2 m y fuera del muro): caja de cada una y paso
  const vigs = (y0, y1) => {
    const T = cabios.filter((t) => t.v.every((p) => p[2] > wallZ - 0.2 && p[1] > y0 && p[1] < y1) && Math.max(...t.v.map((p) => p[2])) > wallZ + 1);
    const items = T.map((t) => ({ t, x: (t.v[0][0] + t.v[1][0] + t.v[2][0]) / 3 })).sort((a, b) => a.x - b.x), G = [];
    for (const it of items) { if (G.length && it.x - G.at(-1).x1 <= 0.1) { G.at(-1).ts.push(it.t); G.at(-1).x1 = it.x; } else G.push({ ts: [it.t], x1: it.x }); }
    const cj = G.map((g) => { const P = g.ts.flatMap((t) => t.v); return { x0: minA(P.map((p) => p[0])), x1: maxA(P.map((p) => p[0])), y0: minA(P.map((p) => p[1])), y1: maxA(P.map((p) => p[1])), z0: minA(P.map((p) => p[2])), z1: maxA(P.map((p) => p[2])) }; })
      .filter((c) => c.x1 - c.x0 < 0.2);
    const cx = cj.map((c) => (c.x0 + c.x1) / 2), pasos = cx.slice(1).map((c, i) => c - cx[i]).sort((a, b) => a - b), mid = (a) => [...a].sort((p, q) => p - q)[a.length >> 1];
    return { n: cj.length, paso: r3(pasos[pasos.length >> 1]), ancho: r3(mid(cj.map((c) => c.x1 - c.x0))), y0: r3(mid(cj.map((c) => c.y0))), y1: r3(mid(cj.map((c) => c.y1))),
      desdeMuro: r3(mid(cj.map((c) => c.z0)) - wallZ), hasta: r3(mid(cj.map((c) => c.z1)) - wallZ), primera: r3(cx[0] - minA(xs)) };
  };
  const v1 = vigs(3.5, 4.2), vT = vigs(10.8, 11.5);
  // solera: la tabla de madera pegada al muro bajo la mediagua (detalles.glb, a menos de 5 cm del plomo, entre 4,2 y 4,6 m)
  const sol = cabios.filter((t) => t.v.every((p) => Math.abs(p[2] - wallZ) < 0.05 && p[1] > 4.2 && p[1] < 4.6)).flatMap((t) => t.v);
  // ménsulas: centros en x de las piezas de «Fresh cream trim» de la SE bajo la mediagua del piso 1
  const menC = (() => { const T = trim.filter((t) => t.v.every((p) => p[2] > wallZ + 0.2 && p[1] > 2.8 && p[1] < 4.3)); const it = T.map((t) => (t.v[0][0] + t.v[1][0] + t.v[2][0]) / 3).sort((a, b) => a - b), G = [];
    for (const x of it) { if (G.length && x - G.at(-1).at(-1) <= 0.15) G.at(-1).push(x); else G.push([x]); } return G.map((g) => r3((g[0] + g.at(-1)) / 2)); })();
  M.mediaguaPiezas = {
    tablero: { espesor: r3(M.mediagua.yBorde[0] - M.mediagua.sofitoBorde), fuente: 'cubiertas.glb · «Dark stained roof timber»: canto (cara de arriba) menos sofito (cara de abajo) en el borde' },
    teja: { sobreTablero: r3(sobre[Math.floor(sobre.length * 0.95)]), mediana: r3(sobre[sobre.length >> 1]), fuente: 'cubiertas.glb · «Clay terracotta 00…08», SE bajo 5 m entre 0,1 y 1,5 m del muro: altura sobre el plano del tablero (p95 y mediana)' },
    fascia: { y0: r3(minA(fasP.map((p) => p[1])) - losa2), y1: r3(maxA(fasP.map((p) => p[1])) - losa2), espesor: r3(maxA(fasP.map((p) => p[2])) - minA(fasP.map((p) => p[2]))), vuelo: r3(maxA(fasP.map((p) => p[2])) - wallZ),
      fuente: 'cubiertas.glb · «Dark stained roof timber», tabla de borde de la mediagua del piso 1 (SE, a más de 1,5 m del muro, entre 3,5 y 4,2 m)' },
    fasciaTecho: { y0: r3(minA(fasT.map((p) => p[1])) - M.muroArriba.y), y1: r3(maxA(fasT.map((p) => p[1])) - M.muroArriba.y), vuelo: r3(maxA(fasT.map((p) => p[2])) - wallZ), fuente: 'la misma tabla en el alero del techo, relativa al remate del muro' },
    viguetas: { ...v1, y0: r3(v1.y0 - losa2), y1: r3(v1.y1 - losa2), fuente: 'detalles.glb · «Dark stained roof timber», piezas horizontales bajo la mediagua del piso 1 (SE): caja de cada una (medianas), paso = mediana entre centros' },
    viguetasTecho: { ...vT, y0: r3(vT.y0 - M.muroArriba.y), y1: r3(vT.y1 - M.muroArriba.y), fuente: 'las mismas bajo el alero del techo, relativas al remate del muro' },
    solera: { y0: r3(minA(sol.map((p) => p[1])) - losa2), y1: r3(maxA(sol.map((p) => p[1])) - losa2), espesor: r3(maxA(sol.map((p) => p[2])) - minA(sol.map((p) => p[2]))), fuente: 'detalles.glb · «Dark stained roof timber», tabla pegada al muro bajo la mediagua del piso 1 (SE)' },
    mensulas: { x: menC, fachadaSE: r3(maxA(xs) - minA(xs)), fuente: 'detalles.glb · «Fresh cream trim», centros de las ménsulas bajo la mediagua del piso 1 (SE): una por módulo y una a 0,30 m de cada esquina' },
  };
  // franja de arcilla bajo el alero (entre el remate del muro y el techo), retirada del plomo del muro
  const fas = await triangulos('cubiertas', /attic fascia/);
  const fy = fas.flatMap((t) => t.v.map((p) => p[1])), fx = fas.flatMap((t) => t.v.map((p) => p[0]));
  M.fasciaAtico = { y0: r3(minA(fy)), y1: r3(maxA(fy)), retiro: r3(maxA(xs) - maxA(fx)), fuente: 'cubiertas.glb · nodo «Clay-colored vertical attic fascia» (caja)' };
  // materiales del 106 que usa el kit: nombre, color base, rugosidad, metalicidad y extras, tal como vienen en los GLB de main
  const docs = {};
  M.materiales = {};
  for (const [parte, [grupo, nombre]] of Object.entries(MATERIAL_106)) {
    docs[grupo] ??= await io.read(path.join(MODELO, grupo + '.glb'));
    const m = docs[grupo].getRoot().listMaterials().find((x) => x.getName() === nombre);
    if (!m) throw new Error(`no está el material «${nombre}» en ${grupo}.glb`);
    M.materiales[parte] = { nombre, glb: grupo + '.glb', color: m.getBaseColorFactor().map(r3), rugosidad: r3(m.getRoughnessFactor()), metalicidad: r3(m.getMetallicFactor()), extras: m.getExtras() };
  }
  return M;
}
export const MED = await medir106();
if (SOLO_MEDIR) { console.log(JSON.stringify(MED, null, 1)); process.exit(0); }

// Parámetros del kit, todos derivados de MED (ver kit-medidas.json); lo que no sale del 106 dice SUPUESTO
const vidrioY = MED.vanos.vidrioY;                        // [1.82 2.56 2.60 3.37 5.62 … 10.77]: tres paños de 1,55 m de alto
export const KIT = {
  base: MED.base.y, piso: MED.piso.m, vuelo: MED.alero.vuelo,
  techo: { pendiente: MED.techo.pendiente, canto: MED.techo.yAlero - MED.muroArriba.y, sofito: MED.techo.sofitoAlero - MED.muroArriba.y },   // relativos al remate del muro
  mediagua: { pendiente: MED.mediagua.pendiente, canto: MED.mediagua.yBorde[0] - MED.piso.losas[1], sofito: MED.mediagua.sofitoBorde - MED.piso.losas[1], faja: MED.alero.sofitoPlano[0] - MED.piso.losas[1] },
  ventana: { alto: r3(vidrioY[3] - vidrioY[0]), antepecho: [r3(vidrioY[0] - MED.piso.losas[0]), r3(vidrioY[4] - MED.piso.losas[1]), r3(vidrioY[8] - MED.piso.losas[2])] },
  // el módulo de 6,70 m de la fachada SE: machón de 1,80 m, par de ventanas de 2,20 m, machón de 0,50 m, par de 2,20 m
  // (leído de los bordes del vidrio: −14,3 → −12,5 → −10,3 → −9,8 → −7,6 → −5,8 …)
  modulo: MED.vanos.modulo, par: 2.2, machonChico: 0.5, machonGrande: 1.8,
  rejilla: [MED.rejillaZocalo.y0, MED.rejillaZocalo.y1],
  // piezas de la mediagua y del alero del 106 (MED.mediaguaPiezas; alturas relativas a la losa de arriba o al remate del muro):
  // tablero inclinado de 5,4 cm, teja 4,3 cm sobre el tablero (mediana), tabla de borde de 9,8 × 14 cm, viguetas horizontales de
  // 7,4 × 10,9 cm cada 0,65 m del muro a 1,563 m, solera de 2,7 × 27 cm contra el muro, ménsulas a 0,30 m de cada esquina
  pieza: MED.mediaguaPiezas,
  // ménsulas bajo cada mediagua y bajo el alero: perfil medido (distancia al muro, altura relativa al borde de arriba)
  mensula: (() => { const P = [...MED.mensula.perfil].sort((a, b) => a[0] - b[0]), top = maxA(P.map((p) => p[1])); return { ancho: MED.mensula.ancho, arriba: top, perfil: P.map(([o, y]) => [o, r3(y - top)]) }; })(),
  frenteTeja: MED.mediagua.frenteTeja.alto,
  fascia: { y0: r3(MED.fasciaAtico.y0 - MED.muroArriba.y), y1: r3(MED.fasciaAtico.y1 - MED.muroArriba.y), retiro: MED.fasciaAtico.retiro },
};
export const PARTE = { muro: 0, moldura: 1, teja: 2, mediagua: 3, vidrio: 4, celosia: 5, madera: 6, fascia: 7, ventilacion: 8, servicio: 9, piso: 10, canalTeja: 11, canalMediagua: 12, balaustre: 13, asfalto: 14, lamina: 15, laminaAzul: 16 };
// partes que la escena dibuja solo cerca (src/ciudad.js, umbral lod.cerca del GLB)
export const SOLO_CERCA = ['canalTeja', 'canalMediagua', 'balaustre'];

// =====================================================================================================================
// 2. Geometría
// =====================================================================================================================
/** Acumulador de triángulos con normal plana, separados por parte (cada parte sale como una primitiva con el material del 106).
 *  Muro: con `juntas` (alturas de los encuentros muro-alero, como las 4,40 · 8,05 · 11,70 m del 106), cada triángulo se corta en
 *  franjas horizontales en cada junta y 1,6 m bajo ella, y cada vértice lleva en `a` la distancia hasta la junta de encima de su
 *  franja (99 si no hay): así el sustituto de oclusión de escena.js (fuerte en el encuentro, nada a 1,6 m) sale exacto en cada
 *  píxel aunque el edificio esté a otra altura que el 106. Sin juntas (detalle lejano) todo el muro lleva 99. */
class Geo {
  constructor(juntas = []) { this.partes = {}; this.n3 = 0; this.juntas = [...juntas].sort((a, b) => a - b); this.cortes = [...new Set(this.juntas.flatMap((j) => [j - 1.6, j]))].sort((a, b) => a - b); }
  tri(parte, a, b, c, quiere = null) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const L = Math.hypot(...n); if (L < 1e-9) return;
    if (quiere && n[0] * quiere[0] + n[1] * quiere[1] + n[2] * quiere[2] < 0) { [b, c] = [c, b]; n = n.map((x) => -x); }
    if (!(parte in PARTE)) throw new Error('parte desconocida ' + parte);
    n = n.map((x) => x / L);
    if (parte !== 'muro') return this.#poner(parte, [a, b, c], n, null);
    if (!this.juntas.length) return this.#poner(parte, [a, b, c], n, [99, 99, 99]);
    // franjas: (−∞, c0], [c0, c1], …, [ck, +∞); cada una recorta el triángulo (Sutherland–Hodgman en y) y se abanica
    const ys = [a[1], b[1], c[1]], y0 = Math.min(...ys), y1 = Math.max(...ys), lim = [-Infinity, ...this.cortes, Infinity];
    for (let i = 0; i + 1 < lim.length; i++) {
      const lo = lim[i], hi = lim[i + 1]; if (hi <= y0 + 1e-6 || lo >= y1 - 1e-6) continue;
      let P = [a, b, c];
      for (const [h, s] of [[lo, 1], [hi, -1]]) {
        if (!Number.isFinite(h)) continue;
        const E = P; P = [];
        for (let k = 0; k < E.length; k++) {
          const p = E[k], q = E[(k + 1) % E.length], dp = (p[1] - h) * s >= -1e-9, dq = (q[1] - h) * s >= -1e-9;
          const corte = () => { const t = (h - p[1]) / (q[1] - p[1]); return [p[0] + (q[0] - p[0]) * t, h, p[2] + (q[2] - p[2]) * t]; };
          if (dq) { if (!dp) P.push(corte()); P.push(q); } else if (dp) P.push(corte());
        }
      }
      if (P.length < 3) continue;
      const j = this.juntas.find((x) => x >= hi - 1e-6), d = (p) => (j === undefined ? 99 : Math.max(0, j - p[1]));
      for (let k = 1; k + 1 < P.length; k++) this.#poner(parte, [P[0], P[k], P[k + 1]], n, [d(P[0]), d(P[k]), d(P[k + 1])]);
    }
  }
  #poner(parte, V, n, ao) {
    const g = (this.partes[parte] ??= { p: [], n: [], a: [] });
    for (const v of V) { g.p.push(...v); g.n.push(...n); }
    if (ao) g.a.push(...ao);
    this.n3++;
  }
  quad(parte, a, b, c, d, quiere = null) { this.tri(parte, a, b, c, quiere); this.tri(parte, a, c, d, quiere); }
  /** Caja en el marco de un lado: s a lo largo [s0, s1], o hacia afuera [o0, o1], y de y0 a y1. Sin cara de abajo. Las caras que
   *  nunca se ven se pueden omitir: atras (la de o0, contra el muro), frente (la de o1) y arriba. */
  caja(parte, F, s0, s1, o0, o1, y0, y1, { abajo = false, atras = true, frente = true, arriba = true } = {}) {
    const P = (s, o, y) => F.p(s, o, y);
    const c = [[s0, o0], [s1, o0], [s1, o1], [s0, o1]];
    const cen = F.p((s0 + s1) / 2, (o0 + o1) / 2, (y0 + y1) / 2);
    for (let i = 0; i < 4; i++) {
      if ((i === 0 && !atras) || (i === 2 && !frente)) continue;
      const [sa, oa] = c[i], [sb, ob] = c[(i + 1) % 4], m = F.p((sa + sb) / 2, (oa + ob) / 2, cen[1]);
      this.quad(parte, P(sa, oa, y0), P(sb, ob, y0), P(sb, ob, y1), P(sa, oa, y1), [m[0] - cen[0], 0, m[2] - cen[2]]);
    }
    if (arriba) this.quad(parte, P(s0, o0, y1), P(s1, o0, y1), P(s1, o1, y1), P(s0, o1, y1), [0, 1, 0]);
    if (abajo) this.quad(parte, P(s0, o0, y0), P(s1, o0, y0), P(s1, o1, y0), P(s0, o1, y0), [0, -1, 0]);
  }
  get triangulos() { return this.n3; }
}
/** Marco de un lado del polígono (antihorario en x-z: (dz, −dx) apunta hacia afuera). */
function marco(A, B) {
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]), d = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], n = [d[1], -d[0]];
  return { L, d, n, p: (s, o, y) => [A[0] + d[0] * s + n[0] * o, y, A[1] + d[1] * s + n[1] * o] };
}
function area2(P) { let A = 0; for (let i = 0; i < P.length; i++) { const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % P.length]; A += x1 * z2 - x2 * z1; } return A / 2; }
const orientar = (P) => (area2(P) < 0 ? [...P].reverse() : [...P]);
/** Quita vértices casi alineados (< 4°) y lados de menos de 0,5 m (OSM trae vértices de más). */
function simplificar(P) {
  let Q = orientar(P), cambio = true;
  while (cambio && Q.length > 3) {
    cambio = false;
    for (let i = 0; i < Q.length; i++) {
      const a = Q[(i - 1 + Q.length) % Q.length], b = Q[i], c = Q[(i + 1) % Q.length];
      const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]], lu = Math.hypot(...u), lv = Math.hypot(...v);
      const giro = Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])) / rad;
      if (giro < 4 || lu < 0.5) { Q.splice(i, 1); cambio = true; break; }
    }
  }
  return Q;
}
const convexo = (P) => P.every((b, i) => { const a = P[(i - 1 + P.length) % P.length], c = P[(i + 1) % P.length]; return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) > -1e-9; });
/** Polígono desplazado d hacia afuera (inglete en cada vértice). */
function desplazar(P, d) {
  const n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = marco(P[(i - 1 + n) % n], P[i]), b = marco(P[i], P[(i + 1) % n]);
    const m = [a.n[0] + b.n[0], a.n[1] + b.n[1]], k = d / (1 + a.n[0] * b.n[0] + a.n[1] * b.n[1]);
    out.push([P[i][0] + m[0] * k, P[i][1] + m[1] * k]);
  }
  return out;
}
/** Rectángulo orientado de área mínima (para techos de huellas no convexas). */
function rectanguloMinimo(P) {
  let mejor = null;
  for (let i = 0; i < P.length; i++) {
    const F = marco(P[i], P[(i + 1) % P.length]);
    const ss = P.map((p) => (p[0] - P[i][0]) * F.d[0] + (p[1] - P[i][1]) * F.d[1]), oo = P.map((p) => (p[0] - P[i][0]) * F.n[0] + (p[1] - P[i][1]) * F.n[1]);
    const A = (maxA(ss) - minA(ss)) * (maxA(oo) - minA(oo));
    if (!mejor || A < mejor.A) { const q = (s, o) => [P[i][0] + F.d[0] * s + F.n[0] * o, P[i][1] + F.d[1] * s + F.n[1] * o]; mejor = { A, R: orientar([q(minA(ss), minA(oo)), q(maxA(ss), minA(oo)), q(maxA(ss), maxA(oo)), q(minA(ss), maxA(oo))]) }; }
  }
  return mejor.R;
}

/** Esqueleto recto de un polígono CONVEXO antihorario (solo eventos de lado). Devuelve una cara por lado: lista de [x, t, z],
 *  con t = distancia al borde (la altura del techo es t · tan(pendiente), como el HippedRoofBuilder de streets.gl). */
function esqueleto(P) {
  const n = P.length, lados = P.map((A, i) => { const F = marco(A, P[(i + 1) % n]); return { F, ini: [], fin: [], cerrado: false }; });
  const adentro = (e) => [-lados[e].F.n[0], -lados[e].F.n[1]];
  const velocidad = (e1, e2) => { const a = adentro(e1), b = adentro(e2), k = 1 + a[0] * b[0] + a[1] * b[1]; return k < 1e-3 ? null : [(a[0] + b[0]) / k, (a[1] + b[1]) / k]; };   // lados casi opuestos (< 2,6°): cumbrera, el vértice se queda
  // vértice activo: entre el lado que entra (eIn) y el que sale (eOut); punto en el tiempo t0 y su velocidad
  let V = P.map((p, i) => ({ q: p, t0: 0, eIn: (i - 1 + n) % n, eOut: i, v: velocidad((i - 1 + n) % n, i) }));
  let t = 0;
  const en = (v, T) => [v.q[0] + v.v[0] * (T - v.t0), v.q[1] + v.v[1] * (T - v.t0)];
  while (V.length > 2) {
    // el lado que se cierra primero: entre V[i] y V[i+1]
    let mejor = null;
    for (let i = 0; i < V.length; i++) {
      const a = V[i], b = V[(i + 1) % V.length]; if (!a.v || !b.v) continue;
      // tiempo en que los dos vértices se encuentran: a(T) = b(T) en la dirección del lado
      const d = lados[a.eOut].F.d, pa = en(a, t), pb = en(b, t);
      const L = (pb[0] - pa[0]) * d[0] + (pb[1] - pa[1]) * d[1], dv = (b.v[0] - a.v[0]) * d[0] + (b.v[1] - a.v[1]) * d[1];
      if (dv >= -1e-9) continue;
      const T = t - L / dv;
      if (!mejor || T < mejor.T) mejor = { i, T };
    }
    if (!mejor) break;
    const { i, T } = mejor, a = V[i], b = V[(i + 1) % V.length];
    const q = en(a, T), nodo = [q[0], T, q[1]];
    t = T;
    lados[a.eOut].fin.push(nodo); lados[a.eOut].cerrado = true;      // el lado que se cierra
    lados[a.eIn].fin.push(nodo); lados[b.eOut].ini.push(nodo);
    const c = { q, t0: T, eIn: a.eIn, eOut: b.eOut, v: velocidad(a.eIn, b.eOut) };
    // si los dos lados de c son paralelos (cumbrera), c ya no se mueve: v = null y no entra en más eventos
    V.splice(i, 1, c); V.splice(V.indexOf(b), 1);
  }
  if (V.length === 2 && V[0].v && V[1].v) {
    // un triángulo que termina en un punto: el último vértice llega al mismo nodo
    for (const v of V) { const q = en(v, t); const nodo = [q[0], t, q[1]]; lados[v.eIn].fin.push(nodo); lados[v.eOut].ini.push(nodo); }
  }
  return lados.map((L, i) => {
    const A = P[i], B = P[(i + 1) % n], cara = [[A[0], 0, A[1]], [B[0], 0, B[1]], ...L.fin, ...[...L.ini].reverse()];
    return cara.filter((p, k) => k === 0 || Math.hypot(p[0] - cara[k - 1][0], p[1] - cara[k - 1][1], p[2] - cara[k - 1][2]) > 1e-6);
  });
}

/** Techo a cuatro aguas con esqueleto recto sobre el polígono O (ya con el vuelo), canto a yA, pendiente en grados. */
function techo(G, O, yA, pend, parte = 'teja') {
  const tan = Math.tan(pend * rad);
  let cumbrera = yA;
  for (const cara of esqueleto(O)) {
    const pts = cara.map(([x, t, z]) => [x, yA + t * tan, z]);
    cumbrera = Math.max(cumbrera, ...pts.map((p) => p[1]));
    const T = ShapeUtils.triangulateShape(pts.map((p) => new Vector2(p[0], p[2])), []);
    for (const [a, b, c] of T) G.tri(parte, pts[a], pts[b], pts[c], [0, 1, 0]);
  }
  return cumbrera;
}
/** Anillo inclinado entre el polígono P (a y0) y el desplazado O (a y1): mediagua o sofito. */
function anillo(G, P, O, y0, y1, parte, quiere) {
  for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length; G.quad(parte, [P[i][0], y0, P[i][1]], [P[j][0], y0, P[j][1]], [O[j][0], y1, O[j][1]], [O[i][0], y1, O[i][1]], quiere); }
}
/** Faja vertical alrededor de O, de y0 a y1, mirando hacia afuera. */
function faja(G, O, y0, y1, parte) {
  for (let i = 0; i < O.length; i++) { const F = marco(O[i], O[(i + 1) % O.length]); G.quad(parte, F.p(0, 0, y0), F.p(F.L, 0, y0), F.p(F.L, 0, y1), F.p(0, 0, y1), [F.n[0], 0, F.n[1]]); }
}
/** Vanos a lo largo de un lado de largo L, simétricos, con el módulo medido del 106 (machón 1,80 · par 2,20 · machón 0,50 · par 2,20).
 *  pares: centros de cada par (como el 106); bandas: [centro, ancho] (los dos pares de un módulo unidos en una banda, el machón de
 *  0,50 pasa a ser un parteluz; un par suelto queda como banda de 2,20); machonGrande / machonChico: centros de los machones. */
function vanos(L) {
  const h = L / 2, lim = h - 0.8, a = KIT.machonGrande / 2 + KIT.par / 2, b = a + KIT.par + KIT.machonChico;
  const out = { pares: [], bandas: [], machonGrande: [h], machonChico: [] };
  for (let k = 0; ; k++) {
    const A = a + KIT.modulo * k, B = b + KIT.modulo * k, okA = A + KIT.par / 2 <= lim, okB = B + KIT.par / 2 <= lim;
    if (!okA) break;
    for (const sg of [-1, 1]) {
      out.pares.push(h + sg * A); if (okB) out.pares.push(h + sg * B);
      out.bandas.push(okB ? [h + sg * (A + B) / 2, 2 * KIT.par + KIT.machonChico] : [h + sg * A, KIT.par]);
      if (okB) out.machonChico.push(h + sg * (A + B) / 2);
      if (k > 0) out.machonGrande.push(h + sg * KIT.modulo * k);
    }
  }
  for (const k of Object.keys(out)) out[k].sort((x, y) => (x[0] ?? x) - (y[0] ?? y));
  return out;
}
// rumbos de las etiquetas en la escena (+X noreste, +Z sureste)
const RUMBO = { NE: [1, 0], SO: [-1, 0], SE: [0, 1], NO: [0, -1],
  // puntos cardinales (casas del kit: qué extremo lleva la cochera o la escalera); +X noreste y +Z sureste, así que el este es (1, 1)/√2
  E: [Math.SQRT1_2, Math.SQRT1_2], O: [-Math.SQRT1_2, -Math.SQRT1_2], N: [Math.SQRT1_2, -Math.SQRT1_2], S: [-Math.SQRT1_2, Math.SQRT1_2] };
const ladoDe = (marcos, et) => { const r = Array.isArray(et) ? et : RUMBO[et]; return marcos.reduce((m, F) => (F.n[0] * r[0] + F.n[1] * r[1] > m.n[0] * r[0] + m.n[1] * r[1] ? F : m), marcos[0]); };

/** Prisma de una lámina con perfil (o, y) en el plano normal a un lado, ancho w a lo largo y espesor t hacia arriba. */
function lamina(G, parte, F, s, w, perfil, t) {
  const P = (ds, o, y) => F.p(s + ds, o, y), fuera = [F.n[0], 0, F.n[1]], lado = [F.d[0], 0, F.d[1]];
  for (let i = 0; i + 1 < perfil.length; i++) {
    const [o0, y0] = perfil[i], [o1, y1] = perfil[i + 1];
    G.quad(parte, P(-w / 2, o0, y0), P(w / 2, o0, y0), P(w / 2, o1, y1), P(-w / 2, o1, y1), [0, -1, 0].map((x, k) => x + fuera[k] * 0.3));
    G.quad(parte, P(-w / 2, o0, y0 + t), P(w / 2, o0, y0 + t), P(w / 2, o1, y1 + t), P(-w / 2, o1, y1 + t), [0, 1, 0]);
    G.quad(parte, P(-w / 2, o0, y0), P(-w / 2, o1, y1), P(-w / 2, o1, y1 + t), P(-w / 2, o0, y0 + t), lado.map((x) => -x));
    G.quad(parte, P(w / 2, o0, y0), P(w / 2, o1, y1), P(w / 2, o1, y1 + t), P(w / 2, o0, y0 + t), lado);
  }
  const [oe, ye] = perfil.at(-1);
  G.quad(parte, P(-w / 2, oe, ye), P(w / 2, oe, ye), P(w / 2, oe, ye + t), P(-w / 2, oe, ye + t), fuera);
}
/** Techo de un pabellón adosado: 'cuatro aguas' (alero horizontal al frente, faldones a los lados, cumbrera contra el muro) o
 *  'dos aguas' (cumbrera perpendicular al muro, hastial al frente). Rectángulo s0..s1 × 0..fo en el marco F, canto yC. */
function techoPabellon(G, F, s0, s1, fo, yC, t, v) {
  const tan = Math.tan(t.pendiente * rad), S0 = s0 - v, S1 = s1 + v, FO = fo + v, sm = (s0 + s1) / 2;
  let cumbrera;
  if (t.forma === 'dos aguas') {
    const hw = (S1 - S0) / 2; cumbrera = yC + hw * tan;
    const R0 = F.p(sm, 0, cumbrera), R1 = F.p(sm, FO, cumbrera);
    G.quad('teja', F.p(S0, 0, yC), F.p(S0, FO, yC), R1, R0, [0, 1, 0]);
    G.quad('teja', F.p(S1, 0, yC), F.p(S1, FO, yC), R1, R0, [0, 1, 0]);
    G.tri(t.hastial ?? 'muro', F.p(s0, fo, yC), F.p(s1, fo, yC), F.p(sm, fo, yC + (s1 - s0) / 2 * tan), [F.n[0], 0, F.n[1]]);
    G.quad('teja', F.p(S0, FO, yC), F.p(S1, FO, yC), F.p(S1, FO, yC - 0.12), F.p(S0, FO, yC - 0.12), [F.n[0], 0, F.n[1]]);
  } else {
    // tres faldones: el del frente sube hasta el muro; los de los lados son triángulos (a 45° en planta)
    const yM = yC + FO * tan, c0 = Math.min(S0 + FO, sm), c1 = Math.max(S1 - FO, sm);
    G.quad('teja', F.p(S0, FO, yC), F.p(S1, FO, yC), F.p(c1, 0, yM), F.p(c0, 0, yM), [0, 1, 0]);
    G.tri('teja', F.p(S0, FO, yC), F.p(c0, 0, yM), F.p(S0, 0, yC), [0, 1, 0]);
    G.tri('teja', F.p(S1, FO, yC), F.p(c1, 0, yM), F.p(S1, 0, yC), [0, 1, 0]);
    cumbrera = yM;
  }
  // sofito plano y faja de madera en los tres bordes libres
  G.quad('madera', F.p(S0, 0, yC - 0.12), F.p(S1, 0, yC - 0.12), F.p(S1, FO, yC - 0.12), F.p(S0, FO, yC - 0.12), [0, -1, 0]);
  for (const [a, b, n] of [[[S0, FO], [S1, FO], F.n], [[S0, 0], [S0, FO], F.d.map((x) => -x)], [[S1, 0], [S1, FO], F.d]])
    G.quad('madera', F.p(a[0], a[1], yC - 0.12), F.p(b[0], b[1], yC - 0.12), F.p(b[0], b[1], yC), F.p(a[0], a[1], yC), [n[0], 0, n[1]]);
  return cumbrera;
}
/** Pabellón adosado a un lado (dato por edificio): { lado, desdeExtremo, distancia, ancho, fondo, pisos, abierto, techo, remate }. */
function pabellon(G, marcos, b, y0, yPie, base) {
  const F = ladoDe(marcos, b.lado), r = RUMBO[b.desdeExtremo];
  const sc = F.d[0] * r[0] + F.d[1] * r[1] > 0 ? F.L - b.distancia : b.distancia;
  const s0 = sc - b.ancho / 2, s1 = sc + b.ancho / 2, fo = b.fondo, yTop = y0 + base + (b.pisos ?? 1) * KIT.piso;
  if (b.abierto) {
    // plataforma a la altura del piso 1 y dos columnas al frente (sección 0,40 m, SUPUESTA)
    G.caja('moldura', F, s0, s1, 0, fo, yPie, y0 + base);
    for (const s of [s0 + 0.2, s1 - 0.2]) G.caja('moldura', F, s - 0.2, s + 0.2, fo - 0.4, fo, y0 + base, yTop + KIT.mediagua.canto);
  } else {
    for (const [a, bb, n] of [[[s0, fo], [s1, fo], F.n], [[s0, 0], [s0, fo], F.d.map((x) => -x)], [[s1, 0], [s1, fo], F.d]])
      G.quad('muro', F.p(a[0], a[1], yPie), F.p(bb[0], bb[1], yPie), F.p(bb[0], bb[1], yTop), F.p(a[0], a[1], yTop), [n[0], 0, n[1]]);
  }
  const yC = yTop + KIT.mediagua.canto;
  const cumbrera = techoPabellon(G, F, s0, s1, fo, yC, { pendiente: KIT.mediagua.pendiente, ...(b.techo ?? {}) }, b.vuelo ?? 0.4);
  if (b.remate) G.caja('madera', F, sc - 0.06, sc + 0.06, fo + (b.vuelo ?? 0.4) - 0.12, fo + (b.vuelo ?? 0.4), cumbrera, cumbrera + b.remate);
  return { s0, s1, fo, cumbrera };
}
/** Hastial de ventilación sobre un extremo del techo a cuatro aguas (dato por edificio): un tejadillo a dos aguas sobre la
 *  cumbrera, con su frente vertical (rejilla oscura) sobre el faldón del extremo y un remate en la punta.
 *  { extremo, ancho, pendiente, sobreCumbrera, largo, remate } */
function hastialTecho(G, R, yR, pendTecho, h) {
  // R: rectángulo del techo (4 puntos antihorarios); eje largo y extremo pedido
  const lados = R.map((A, i) => marco(A, R[(i + 1) % 4])), largo = lados.reduce((m, F) => (F.L > m.L ? F : m), lados[0]);
  const ancho = lados.find((F) => F !== largo && Math.abs(F.d[0] * largo.d[0] + F.d[1] * largo.d[1]) < 0.5).L;
  const c = centro(R), r = RUMBO[h.extremo], sg = largo.d[0] * r[0] + largo.d[1] * r[1] > 0 ? 1 : -1, d = largo.d.map((x) => x * sg), n = [-d[1], d[0]];
  const tanT = Math.tan(pendTecho * rad), tanH = Math.tan(h.pendiente * rad);
  const fin = [c[0] + d[0] * (largo.L / 2 - ancho / 2), c[1] + d[1] * (largo.L / 2 - ancho / 2)];   // punta de la cumbrera
  const pico = yR + h.sobreCumbrera, yb = pico - (h.ancho / 2) * tanH, t = (yR - yb) / tanT;
  const q = [fin[0] + d[0] * t, fin[1] + d[1] * t], qb = [q[0] - d[0] * h.largo, q[1] - d[1] * h.largo];
  const P = (p, lat, y) => [p[0] + n[0] * lat, y, p[1] + n[1] * lat], v = 0.3, hw = h.ancho / 2;
  const qf = [q[0] + d[0] * v, q[1] + d[1] * v];
  for (const sl of [-1, 1]) G.quad('teja', P(qb, sl * (hw + v), yb - v * tanH), P(qf, sl * (hw + v), yb - v * tanH), P(qf, 0, pico), P(qb, 0, pico), [0, 1, 0]);
  G.tri('ventilacion', P(q, -hw, yb), P(q, hw, yb), P(q, 0, pico), [d[0], 0, d[1]]);
  G.tri('ventilacion', P(qb, -hw, yb), P(qb, hw, yb), P(qb, 0, pico), [-d[0], 0, -d[1]]);
  // tablas del borde del tejadillo (madera) y remate en la punta
  for (const sl of [-1, 1]) G.quad('madera', P(qf, sl * (hw + v), yb - v * tanH), P(qf, 0, pico), P(qf, 0, pico + 0.15), P(qf, sl * (hw + v), yb - v * tanH + 0.15), [d[0], 0, d[1]]);
  if (h.remate) { const F = { p: (s, o, y) => [qf[0] + n[0] * s + d[0] * o, y, qf[1] + n[1] * s + d[1] * o] }; G.caja('madera', F, -0.06, 0.06, -0.12, 0, pico, pico + h.remate); }
  return { pico, base: yb, frente: q };
}

/** Piezas de madera bajo un alero de vuelo v alrededor del polígono P (las del 106, KIT.pieza): tabla de borde y, con detalle
 *  alto, viguetas horizontales. yRef = losa de arriba (mediagua) o remate del muro (techo). Con un vuelo mayor que el del 106
 *  (v > KIT.vuelo) la tabla de borde va al borde nuevo, las viguetas se alargan lo mismo y todo baja dy (el borde de un alero
 *  más volado a la misma pendiente queda más abajo). Con v = KIT.vuelo y dy = 0, exactamente las piezas del 106. */
function bajoAlero(G, P, marcos, yRef, fas, vig, { alto, v = KIT.vuelo, dy = 0 }) {
  const K = KIT.pieza, extra = v - KIT.vuelo, fv = fas.vuelo + extra;
  const o0 = fv - K.fascia.espesor, Oi = desplazar(P, o0), Oe = desplazar(P, fv);
  faja(G, Oe, yRef + fas.y0 + dy, yRef + fas.y1 + dy, 'madera'); faja(G, Oi, yRef + fas.y0 + dy, yRef + fas.y1 + dy, 'madera');   // tabla de borde (cara de adentro mirando afuera: se ve desde abajo entre las viguetas)
  anillo(G, Oi, Oe, yRef + fas.y0 + dy, yRef + fas.y0 + dy, 'madera', [0, -1, 0]);
  if (!alto) return;
  for (const F of marcos) for (let s = vig.primera; s <= F.L - vig.primera + 1e-6; s += vig.paso)
    // vigueta: solo los dos costados y la cara de abajo (arriba va el tablero, en un extremo el muro y en el otro la tabla de borde)
    G.caja('madera', F, s - vig.ancho / 2, s + vig.ancho / 2, 0, vig.hasta + extra, yRef + vig.y0 + dy, yRef + vig.y1 + dy, { abajo: true, atras: false, frente: false, arriba: false });
}
/** Mediagua alrededor de P sobre la losa yL, pieza por pieza como las del 106: teja sobre el tablero, frente de la teja, tablero
 *  inclinado (su cara de abajo es el sofito), tabla de borde, viguetas y solera. De lejos, solo la teja y el sofito. La junta con el
 *  muro queda donde la del 106 (canto + vuelo · tan); con un vuelo v mayor, el borde baja (v − 1,65) · tan. */
function mediaguaAlrededor(G, P, marcos, yL, { alto, medio, v = KIT.vuelo, pend = KIT.mediagua.pendiente, duplex = null }) {
  const K = KIT.pieza, tt = K.teja.mediana, tm = Math.tan(pend * rad), O = desplazar(P, v);
  const dy = -(v - KIT.vuelo) * tm;
  const yBorde = yL + KIT.mediagua.canto + dy, ySof = yBorde - K.tablero.espesor;
  anillo(G, P, O, yBorde + v * tm + tt, yBorde + tt, 'mediagua', [0, 1, 0]);
  anillo(G, P, O, ySof + v * tm, ySof, 'madera', [0, -1, 0]);
  if (!medio) return;
  const yTope = yL + MED.mediagua.frenteTeja.y1 - MED.piso.losas[1] + dy;
  if (!duplex) {
    faja(G, desplazar(P, v + 0.005), yL + K.fascia.y1 + dy, yTope, 'mediagua');
    bajoAlero(G, P, marcos, yL, K.fascia, K.viguetas, { alto, v, dy });
  } else {
    // dúplex (solo): frente de teja de duplex.frente m (el 106 tiene 0,12) con la tabla de borde del 106 debajo, cabios inclinados
    // pegados al tablero en lugar de las viguetas horizontales del 106 y, con detalle alto, la teja en canales sobre el faldón
    const yF = yTope - duplex.frente, fas = { ...K.fascia, y1: yF - yL - dy, y0: yF - yL - dy - (K.fascia.y1 - K.fascia.y0) };
    faja(G, desplazar(P, v + 0.005), yF, yTope, 'mediagua');
    bajoAlero(G, P, marcos, yL, fas, K.viguetas, { alto: false, v, dy });
    if (alto) cabiosAlero(G, marcos, ySof + v * tm, tm, v - K.fascia.espesor, duplex.cabio);
    if (alto && duplex.teja) canales(G, O, yBorde + tt, tm, v, duplex.teja, 'canalMediagua');
  }
  if (alto) faja(G, desplazar(P, K.solera.espesor), yL + K.solera.y0, yL + K.solera.y1, 'madera');
}
/** Cabios inclinados bajo el tablero de un alero (solo el dúplex): una tabla de sección ancho × alto cada `paso` m a lo largo de
 *  cada muro, del muro (sofito a ySofMuro) hasta `hasta` m afuera, pegada a la cara de abajo del tablero (pendiente tan). En las
 *  esquinas no hay cabios (el sofito sigue cerrado). */
function cabiosAlero(G, marcos, ySofMuro, tan, hasta, { paso, ancho, alto: h, primera }) {
  for (const F of marcos) for (let s = primera; s <= F.L - primera + 1e-6; s += paso) {
    const a = s - ancho / 2, b = s + ancho / 2, y = (o) => ySofMuro - o * tan, P = (ss, o, dy) => F.p(ss, o, y(o) + dy);
    G.quad('madera', P(a, 0, 0), P(a, hasta, 0), P(a, hasta, -h), P(a, 0, -h), [-F.d[0], 0, -F.d[1]]);
    G.quad('madera', P(b, 0, 0), P(b, hasta, 0), P(b, hasta, -h), P(b, 0, -h), [F.d[0], 0, F.d[1]]);
    G.quad('madera', P(a, 0, -h), P(b, 0, -h), P(b, hasta, -h), P(a, hasta, -h), [0, -1, 0]);
  }
}
/** Teja en canales sobre los faldones de un rectángulo R (antihorario; borde bajo a yA, pendiente tan), solo el dúplex: una cresta
 *  cada `paso` m perpendicular a cada borde, de `relieve` m de alto, hasta la limatesa a 45° en planta (o hasta `tope` m adentro), y
 *  el extremo de cada canal cerrado en el borde. Más la cumbrera y las limatesas como un caballete. */
function canales(G, R, yA, tan, tope, { paso, relieve: h, caballete, dosAguas = false }, parte = 'teja') {
  const corto = Math.min(...R.map((A, i) => marco(A, R[(i + 1) % 4]).L));
  tope = Math.min(tope, corto / 2);
  for (let i = 0; i < 4; i++) {
    const F = marco(R[i], R[(i + 1) % 4]), n = Math.floor(F.L / paso), s00 = (F.L - n * paso) / 2;
    // dos aguas (casas de oficiales): canales solo en los dos lados largos, del borde a la cumbrera en todo el largo
    if (dosAguas && F.L < corto + 1e-6) continue;
    const tc = dosAguas ? () => tope : (s) => Math.max(0, Math.min(s, F.L - s, tope)), P = (s, t, lift) => F.p(s, -t, yA + t * tan + lift), fuera = [F.n[0], 0, F.n[1]];
    for (let k = 0; k < n; k++) {
      const s0 = s00 + k * paso, s1 = s0 + paso, sc = (s0 + s1) / 2;
      G.quad(parte, P(s0, 0, 0), P(sc, 0, h), P(sc, tc(sc), h), P(s0, tc(s0), 0), [0, 1, 0]);
      G.quad(parte, P(sc, 0, h), P(s1, 0, 0), P(s1, tc(s1), 0), P(sc, tc(sc), h), [0, 1, 0]);
      G.tri(parte, P(s0, 0, 0), P(s1, 0, 0), P(sc, 0, h), fuera);
    }
  }
  if (!caballete) return;
  // cumbrera y limatesas: un caballete triangular de `caballete` m de ancho y alto sobre cada línea
  const lados = R.map((A, i) => marco(A, R[(i + 1) % 4])), L = Math.max(lados[0].L, lados[1].L), W = Math.min(lados[0].L, lados[1].L);
  const FL = lados.find((F) => Math.abs(F.L - L) < 1e-6), c = centro(R), yR = yA + Math.min(W / 2, tope) * tan;
  if (tope + 1e-6 < W / 2) return;   // mediagua: sin cumbrera
  const e0 = [c[0] - FL.d[0] * (L - W) / 2, c[1] - FL.d[1] * (L - W) / 2], e1 = [c[0] + FL.d[0] * (L - W) / 2, c[1] + FL.d[1] * (L - W) / 2];
  const linea = (A, B) => {
    const dx = B[0] - A[0], dz = B[2] - A[2], l = Math.hypot(dx, dz) || 1, nx = -dz / l * caballete / 2, nz = dx / l * caballete / 2;
    const up = (p, lift) => [p[0], p[1] + lift, p[2]];
    G.quad(parte, [A[0] + nx, A[1] + h, A[2] + nz], [B[0] + nx, B[1] + h, B[2] + nz], up(B, h + caballete / 2), up(A, h + caballete / 2), [0, 1, 0]);
    G.quad(parte, [A[0] - nx, A[1] + h, A[2] - nz], [B[0] - nx, B[1] + h, B[2] - nz], up(B, h + caballete / 2), up(A, h + caballete / 2), [0, 1, 0]);
  };
  const E0 = [e0[0], yR, e0[1]], E1 = [e1[0], yR, e1[1]];
  if (dosAguas) {   // la cumbrera de punta a punta, sin limatesas
    const m0 = [(R[0][0] + R[3][0]) / 2, yR, (R[0][1] + R[3][1]) / 2], m1 = [(R[1][0] + R[2][0]) / 2, yR, (R[1][1] + R[2][1]) / 2];
    const largo0 = marco(R[0], R[1]).L > marco(R[1], R[2]).L;
    return largo0 ? linea(m0, m1) : linea([(R[0][0] + R[1][0]) / 2, yR, (R[0][1] + R[1][1]) / 2], [(R[2][0] + R[3][0]) / 2, yR, (R[2][1] + R[3][1]) / 2]);
  }
  linea(E0, E1);
  for (const q of R) { const d0 = Math.hypot(q[0] - e0[0], q[1] - e0[1]), d1 = Math.hypot(q[0] - e1[0], q[1] - e1[1]); linea([q[0], yA, q[1]], d0 < d1 ? E0 : E1); }
}
/** Techo a dos aguas con hastial (solo las casas de oficiales, que salen de duplex()): cumbrera a lo largo del eje largo, alero de vuelo
 *  v en los lados largos y vh en los hastiales. Teja en dos faldones del borde a la cumbrera (con canales en detalle alto), su cara de
 *  abajo de madera oscura (el sofito, del mismo tablero que el resto del dúplex), tabla de borde a lo largo de los aleros y de los
 *  hastiales, cabios inclinados en los lados largos y el hastial de muro (triángulo) sobre cada lado corto hasta el sofito. */
function techoDosAguas(G, { FL, W, L, marcos, esLargo, v, vh, tan, yCanto, ySof, ySofMuro, yMuroArriba, tt, alto, medio, AL, parteTeja = 'teja' }) {
  // marco del lado largo de referencia: s a lo largo (0..L), o hacia afuera (0 en el muro, −W en el otro muro)
  const s0 = -vh, s1 = L + vh, oE = [v, -W - v], half = W / 2 + v, yTop = (d) => yCanto + tt + d * tan, ySofD = (d) => ySof + d * tan;
  const cumbrera = yTop(half), oR = -W / 2;
  // faldones: d = distancia desde el borde del alero de ese lado
  for (const oe of oE) {
    G.quad(parteTeja, FL.p(s0, oe, yTop(0)), FL.p(s1, oe, yTop(0)), FL.p(s1, oR, cumbrera), FL.p(s0, oR, cumbrera), [0, 1, 0]);
    if (medio) G.quad('madera', FL.p(s0, oe, ySofD(0)), FL.p(s1, oe, ySofD(0)), FL.p(s1, oR, ySofD(half)), FL.p(s0, oR, ySofD(half)), [0, -1, 0]);
  }
  if (!medio) return cumbrera;
  // tablas de borde: frente del alero en los lados largos y tablas inclinadas en los hastiales (del sofito a la teja)
  const K = KIT.pieza, fh = K.fasciaTecho.y1 - K.fasciaTecho.y0;
  for (const oe of oE) { const nn = oe > 0 ? FL.n : FL.n.map((x) => -x); G.quad('madera', FL.p(s0, oe, ySofD(0) - fh * 0.3), FL.p(s1, oe, ySofD(0) - fh * 0.3), FL.p(s1, oe, yTop(0)), FL.p(s0, oe, yTop(0)), [nn[0], 0, nn[1]]); }
  for (const se of [s0, s1]) {
    const nn = se < 0 ? FL.d.map((x) => -x) : FL.d;
    for (const oe of oE) G.quad('madera', FL.p(se, oe, ySofD(0) - fh * 0.3), FL.p(se, oR, ySofD(half) - fh * 0.3), FL.p(se, oR, cumbrera), FL.p(se, oe, yTop(0)), [nn[0], 0, nn[1]]);
  }
  // hastiales de muro: del remate al sofito, sobre los lados cortos
  for (const se of [0, L]) {
    const nn = se === 0 ? FL.d.map((x) => -x) : FL.d;
    G.tri('muro', FL.p(se, 0, yMuroArriba), FL.p(se, -W, yMuroArriba), FL.p(se, oR, ySofMuro + (W / 2) * tan), [nn[0], 0, nn[1]]);
  }
  if (alto && AL) {
    cabiosAlero(G, marcos.filter(esLargo), ySofMuro, tan, v - K.fascia.espesor, AL.cabio);
    canales(G, [FL.p(s0, oE[0], 0), FL.p(s1, oE[0], 0), FL.p(s1, oE[1], 0), FL.p(s0, oE[1], 0)].map((p) => [p[0], p[2]]), yCanto + tt, tan, Infinity, { ...AL.teja, dosAguas: true }, 'canalTeja');
  }
  return cumbrera;
}
/** Prisma recto de un polígono convexo (o, y) en el plano normal a un lado, de s0 a s1 a lo largo (ménsula, viga, cuña). */
function prisma(G, parte, F, s0, s1, perfil) {
  const n = perfil.length, P = (s, [o, y]) => F.p(s, o, y);
  for (let k = 1; k + 1 < n; k++) {
    G.tri(parte, P(s0, perfil[0]), P(s0, perfil[k]), P(s0, perfil[k + 1]), [-F.d[0], 0, -F.d[1]]);
    G.tri(parte, P(s1, perfil[0]), P(s1, perfil[k]), P(s1, perfil[k + 1]), [F.d[0], 0, F.d[1]]);
  }
  const co = perfil.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n], [0, 0]);
  for (let k = 0; k < n; k++) {
    const a = perfil[k], b = perfil[(k + 1) % n], m = [(a[0] + b[0]) / 2 - co[0], (a[1] + b[1]) / 2 - co[1]];
    const w = F.p(0, m[0], 0), o = F.p(0, 0, 0);
    G.quad(parte, P(s0, a), P(s1, a), P(s1, b), P(s0, b), [w[0] - o[0], m[1], w[2] - o[2]]);
  }
}
/** Marco de una ventana del 106 (detalle alto): parteluces (nP − 1), jambas y, si dintel, dintel y alféizar de moldura crema.
 *  oV: plano del vidrio (0 en el plomo; negativo, retirado). */
function marcoVentana(G, F, s0, s1, yb, yt, { nP = 2, oV = 0, dintel = true, w = s1 - s0 } = {}) {
  const m = 0.1, f = 0.06;
  const sinVer = { atras: false, arriba: false };   // contra el vidrio y bajo el dintel: no se ven
  for (let i = 1; i < nP; i++) { const sx = s0 + (w * i) / nP; G.caja('moldura', F, sx - m / 2, sx + m / 2, oV, oV + f * 0.6, yb, yt, sinVer); }
  G.caja('moldura', F, s0, s0 + m, oV, oV + f, yb, yt, sinVer); G.caja('moldura', F, s1 - m, s1, oV, oV + f, yb, yt, sinVer);   // marco
  if (dintel) {
    G.caja('moldura', F, s0 - m, s1 + m, 0, f, yt, yt + m, { atras: false });                           // dintel
    G.caja('moldura', F, s0 - m - 0.05, s1 + m + 0.05, 0, 0.1, yb - 0.12, yb, { abajo: true, atras: false });   // alféizar
  }
}

/** Ventana de aluminio del dúplex (solo el dúplex y las casas de oficiales; el 106 no la usa). Vidrio del 106 a 1,2 cm del muro (6 cm
 *  de lejos) y, con detalle alto, el marco claro de aluminio (moldura del 106): perfil de `V.marco` m alrededor, un parteluz al centro y
 *  un alféizar delgado; tipo 'celosia' suma las lamas de vidrio (líneas claras cada `V.lama` m) y `reja` una reja oscura delante
 *  (barrotes de `V.reja.barrote` m cada `V.reja.paso` m, con el material de la ventilación del 106). */
function ventanaAluminio(G, F, s0, s1, yb, yt, V, { alto, tipo, reja, caja = false }) {
  const fuera = [F.n[0], 0, F.n[1]], o = alto ? 0.012 : 0.06;
  // caja (casas bajas, recorte de WebGL 2): el marco es una sola caja de moldura y el vidrio va delante, metido el ancho del perfil;
  // sin parteluz ni alféizar
  if (caja && alto) {
    // V.parteMarco (pulido): el marco de otra parte del 106 (Gonzalo Crance: marco oscuro, la madera del 106)
    const m = V.marco, f = 0.035, pm = V.parteMarco ?? 'moldura';
    G.caja(pm, F, s0, s1, 0, f, yb, yt, { atras: false });
    G.quad('vidrio', F.p(s0 + m, f + 0.002, yb + m), F.p(s1 - m, f + 0.002, yb + m), F.p(s1 - m, f + 0.002, yt - m), F.p(s0 + m, f + 0.002, yt - m), fuera);
    if (tipo === 'celosia') for (let y = yb + m + V.lama; y < yt - m - 0.03; y += V.lama) G.quad(pm, F.p(s0 + m, f + 0.004, y - 0.015), F.p(s1 - m, f + 0.004, y - 0.015), F.p(s1 - m, f + 0.004, y), F.p(s0 + m, f + 0.004, y), fuera);
  } else G.quad('vidrio', F.p(s0, o, yb), F.p(s1, o, yb), F.p(s1, o, yt), F.p(s0, o, yt), fuera);
  if (!alto) return;
  const m = V.marco, f = 0.035, sv = { atras: false }, sc = (s0 + s1) / 2;
  if (caja) { if (reja) rejaVentana(G, F, s0, s1, yb, yt, V, fuera); return; }
  G.caja('moldura', F, s0, s0 + m, 0, f, yb, yt, sv); G.caja('moldura', F, s1 - m, s1, 0, f, yb, yt, sv);
  G.caja('moldura', F, s0 + m, s1 - m, 0, f, yt - m, yt, { atras: false, abajo: true }); G.caja('moldura', F, s0 + m, s1 - m, 0, f, yb, yb + m, sv);
  G.caja('moldura', F, sc - m * 0.4, sc + m * 0.4, 0, f * 0.8, yb + m, yt - m, { atras: false, arriba: false });   // parteluz (las dos hojas)
  G.caja('moldura', F, s0 - 0.03, s1 + 0.03, 0, 0.06, yb - 0.04, yb, { atras: false, abajo: true });              // alféizar
  if (tipo === 'celosia') for (let y = yb + m + V.lama; y < yt - m - 0.03; y += V.lama)
    for (const [a, b] of [[s0 + m, sc - m * 0.4], [sc + m * 0.4, s1 - m]]) G.quad('moldura', F.p(a, 0.025, y - 0.015), F.p(b, 0.025, y - 0.015), F.p(b, 0.025, y), F.p(a, 0.025, y), fuera);   // solo la cara de afuera
  if (reja) rejaVentana(G, F, s0, s1, yb, yt, V, fuera);
}
/** Reja oscura delante de una ventana: barrotes de V.reja.barrote cada V.reja.paso y tres travesaños, solo la cara de afuera (de cerca se
 *  leen como líneas oscuras delante del vidrio). */
function rejaVentana(G, F, s0, s1, yb, yt, V, fuera) {
  const R = V.reja, ob = 0.06, w = R.barrote;
  for (let s = s0 + R.paso / 2; s < s1 - 0.05; s += R.paso) G.quad('ventilacion', F.p(s - w / 2, ob, yb), F.p(s + w / 2, ob, yb), F.p(s + w / 2, ob, yt), F.p(s - w / 2, ob, yt), fuera);
  for (const y of [yb + 0.03, (yb + yt) / 2, yt - 0.03]) G.quad('ventilacion', F.p(s0, ob + 0.003, y - w / 2), F.p(s1, ob + 0.003, y - w / 2), F.p(s1, ob + 0.003, y + w / 2), F.p(s0, ob + 0.003, y + w / 2), fuera);
}

/** Escalera exterior de entrada a lo largo del muro del marco F (la del dúplex v2, compartida con las casas del kit): sube a lo largo
 *  del muro hasta un descanso de S.descanso m que termina a S.esquina m del final del marco, con la puerta sobre el descanso; huellas
 *  de teja, una cuña blanca maciza debajo, dos postes bajo el descanso y, con detalle alto, la baranda parda con balaustres. */
/** Piso de concreto bajo una planta baja abierta (dúplex v2, casas elevadas): rejilla de 1,8 m que sigue el terreno de la escena a 6 cm
 *  sobre él, con su canto hasta el pie en los cuatro lados. */
function pisoConcreto(G, FL, L, W, terreno, yPie) {
  const nx = Math.max(2, Math.ceil(L / 1.8)), nz = Math.max(2, Math.ceil(W / 1.8)), Q = (i, k) => { const p = FL.p((L * i) / nx, (-W * k) / nz, 0); return [p[0], terreno(p[0], p[2]) + 0.06, p[2]]; };
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) G.quad('piso', Q(i, k), Q(i + 1, k), Q(i + 1, k + 1), Q(i, k + 1), [0, 1, 0]);
  // canto del piso, del pie a la cara de arriba, en los cuatro lados
  const borde = [[(t) => Q(t, 0), nx, FL.n], [(t) => Q(nx, t), nz, FL.d], [(t) => Q(nx - t, nz), nx, FL.n.map((x) => -x)], [(t) => Q(0, nz - t), nz, FL.d.map((x) => -x)]];
  for (const [q, m, nn] of borde) for (let t = 0; t < m; t++) { const a = q(t), b = q(t + 1); G.quad('piso', [a[0], yPie, a[2]], [b[0], yPie, b[2]], b, a, [nn[0], 0, nn[1]]); }
}
/** Extremos con escalera: S.en (rumbo o lista de rumbos: el lado corto que más mira hacia allá, casa por casa), S.extremos === 1 (solo el
 *  extremo de s = 0) o los dos. */
function escalerasEn(S, cortos, enS0) {
  if (S.en) return [...new Set([].concat(S.en).map((r) => ladoDe(cortos, r)))];
  return S.extremos === 1 ? cortos.filter(enS0) : cortos;
}
function escaleraExterior(G, F, S, { yT, y0, yPie, terreno, alto, parteBalaustre = 'servicio' }) {
  const e = { terreno }, fuera = [F.n[0], 0, F.n[1]], o0 = S.separacion, o1 = o0 + S.ancho;
  const sL1 = F.L - S.esquina, sL0 = sL1 - S.descanso;
  const pieEn = (s) => (e.terreno ? (([x, , z]) => e.terreno(x, z))(F.p(s, (o0 + o1) / 2, 0)) : y0);
  const nP = Math.max(2, Math.round((yT - pieEn(sL0 - 3)) / S.contrahuella)), hu = Math.min(S.huella, (sL0 - 0.2) / (nP - 1));
  const sA = sL0 - (nP - 1) * hu, yA0 = pieEn(sA), cH = (yT - yA0) / nP;
  // cuña maciza (muro) bajo las huellas y el bloque bajo el descanso
  const ladoF = (s0_, s1_, y0_, ya, yb) => {
    for (const [oo, nn] of [[o0, fuera.map((x) => -x)], [o1, fuera]]) G.quad('muro', F.p(s0_, oo, y0_), F.p(s1_, oo, y0_), F.p(s1_, oo, yb), F.p(s0_, oo, ya), nn);
  };
  ladoF(sA, sL0, yPie, yA0, yT - cH - 0.12);
  G.quad('muro', F.p(sA, o0, yA0), F.p(sL0, o0, yT - cH - 0.12), F.p(sL0, o1, yT - cH - 0.12), F.p(sA, o1, yA0), [0, 1, 0]);
  for (const s of [sL0 + 0.1, sL1 - 0.1]) G.caja('muro', F, s - 0.1, s + 0.1, o1 - 0.2, o1, yPie, yT - 0.05, { arriba: false });   // dos postes bajo el descanso
  G.caja('muro', F, sL0, sL1, o0, o1, yT - 0.25, yT - 0.05, { atras: false, arriba: false, abajo: true });   // losa del descanso
  G.caja('teja', F, sL0, sL1, o0 - 0.02, o1 + 0.03, yT - 0.05, yT, { atras: false });   // piso del descanso, de teja
  if (alto) for (let k = 0; k < nP - 1; k++) {
    const s = sA + k * hu, y = yA0 + (k + 1) * cH;
    G.caja('teja', F, s, s + hu + 0.02, o0, o1 + 0.03, y - 0.05, y, { atras: false });
    G.caja('muro', F, s, s + hu, o0 + 0.01, o1 - 0.01, y - cH - 0.12, y - 0.05, { atras: false, arriba: false });
  }
  else G.quad('teja', F.p(sA, o0, yA0 + cH), F.p(sL0, o0, yT - 0.05), F.p(sL0, o1, yT - 0.05), F.p(sA, o1, yA0 + cH), [0, 1, 0]);
  // puerta en el muro del extremo, sobre el descanso
  const sp = (sL0 + sL1) / 2;
  G.quad('servicio', F.p(sp - S.puerta[0] / 2, 0.012, yT), F.p(sp + S.puerta[0] / 2, 0.012, yT), F.p(sp + S.puerta[0] / 2, 0.012, yT + S.puerta[1]), F.p(sp - S.puerta[0] / 2, 0.012, yT + S.puerta[1]), fuera);
  if (alto) {
    // baranda: pasamanos inclinado y del descanso, postes, en el borde de afuera
    const h = S.baranda, a = 0.05, ob = o1 - 0.02, pas = (sa, ya, sb, yb) => {
      const p = (s, y, dy, oo) => F.p(s, oo, y + dy);
      G.quad('servicio', p(sa, ya, h, ob - a), p(sb, yb, h, ob - a), p(sb, yb, h, ob + a), p(sa, ya, h, ob + a), [0, 1, 0]);
      G.quad('servicio', p(sa, ya, h - a, ob + a), p(sb, yb, h - a, ob + a), p(sb, yb, h, ob + a), p(sa, ya, h, ob + a), fuera);
      G.quad('servicio', p(sa, ya, h - a, ob - a), p(sb, yb, h - a, ob - a), p(sb, yb, h, ob - a), p(sa, ya, h, ob - a), fuera.map((x) => -x));
    };
    pas(sA, yA0 + cH, sL0, yT, yT); pas(sL0, yT, sL1, yT);
    for (const [s, y] of [[sA, yA0 + cH], [sA + (sL0 - sA) / 2, (yA0 + cH + yT) / 2], [sL0, yT], [sL1 - 0.05, yT]]) G.caja('servicio', F, s - 0.04, s + 0.04, ob - 0.04, ob + 0.04, y, y + h);
    // balaustres (v3, por rendimiento): una lámina de 2,4 cm con sus dos caras, afuera y adentro, en lugar de una caja de cuatro
    const bal = (s, y) => { for (const sg of [1, -1]) G.quad(parteBalaustre, F.p(s - 0.012, ob, y), F.p(s + 0.012, ob, y), F.p(s + 0.012, ob, y + h - a), F.p(s - 0.012, ob, y + h - a), fuera.map((x) => x * sg)); };
    for (let s = sA + 0.12; s < sL0 - 0.05; s += 0.12) bal(s, yA0 + cH + ((s - sA) / (sL0 - sA)) * (yT - yA0 - cH));
    for (let s = sL0 + 0.12; s < sL1 - 0.05; s += 0.12) bal(s, yT);
  }
}

export const centro = (P) => P.reduce((a, p) => [a[0] + p[0] / P.length, a[1] + p[1] / P.length], [0, 0]);
export { desplazar, simplificar, convexo, orientar, rectanguloMinimo, triangulos };

/**
 * Un cuartel del kit sobre una huella. Entrada (datos por edificio, todos con valor por defecto del 106):
 *   poly (muros), y0 (suelo de la planta baja), yPie (pie del muro, bajo el terreno), pisos, basamento (altura de la losa del
 *   piso 1 sobre y0; 106: 0,65 m; en un cuartel de 4 niveles es la planta baja de servicio),
 *   mediaguas: losas con mediagua (1 = sobre el piso 1, …; por defecto todas menos la última, como el 106),
 *   servicio: { ventanas } (banda baja de ventanas en la planta baja de servicio),
 *   techo: { pendiente, desdeMuro }, mediagua: { pendiente }, ventanas: { tipo: 'pares' | 'banda', retiro }, mensulas (bool),
 *   rejilla: { parte, bajoBandas, y: [y0, y1] } (por defecto las rejillas azul gris del zócalo del 106),
 *   pabellones: [ ... ] (ver pabellon()), hastial: { ... } (ver hastialTecho()), detalle: 'alto' | 'medio' | 'lejos',
 *   alero: { frente, cabio, teja } (solo los cuarteles de 4 niveles, por dato: la mediagua del dúplex, con el frente de teja alto,
 *   los cabios inclinados pegados al tablero en lugar de las viguetas horizontales del 106 y la teja en canales; también los
 *   cabios bajo el alero del techo). Sin `alero`, las piezas del 106 tal cual.
 * Devuelve { G, P, cumbrera, forma, yMuro, juntas, extras }.
 */
export function cuartel(e) {
  const P = simplificar(e.poly), alto = e.detalle === 'alto', medio = e.detalle !== 'lejos';
  const y0 = e.y0 ?? 0, yPie = (e.yPie ?? y0) - 0.3, pisos = e.pisos ?? 3, base = e.basamento ?? KIT.base;
  const losa = (k) => y0 + base + k * KIT.piso;
  const yMuro = losa(pisos), pend = e.techo?.pendiente ?? KIT.techo.pendiente, V = KIT.vuelo;
  const meds = (e.mediaguas ?? [...Array(pisos - 1).keys()].map((k) => k + 1)).filter((k) => k >= 1 && k < pisos);
  // encuentros muro-alero (losa + 0,10 m bajo cada mediagua y remate + 0,10 bajo el alero, como 4,40 · 8,05 · 11,70 en el 106)
  const juntas = [...meds.map((k) => losa(k) + 0.1), yMuro + 0.1].map(r3);
  const G = new Geo(medio ? juntas : []);
  const banda = e.ventanas?.tipo === 'banda', retiro = e.ventanas?.retiro ?? 0;
  const marcos = P.map((A, i) => marco(A, P[(i + 1) % P.length]));
  const yVent = (k) => { const yb = losa(k) + KIT.ventana.antepecho[Math.min(k, 2)]; return [yb, yb + KIT.ventana.alto]; };
  const hueco = banda && retiro > 0 && alto;   // bandas retiradas: el muro lleva el hueco
  // muros (pañete), del pie bajo el terreno al remate; con bandas retiradas, en franjas con los huecos de cada piso
  for (const F of marcos) {
    const fuera = [F.n[0], 0, F.n[1]], q = (sa, sb, ya, yb) => G.quad('muro', F.p(sa, 0, ya), F.p(sb, 0, ya), F.p(sb, 0, yb), F.p(sa, 0, yb), fuera);
    if (!hueco || F.L < 4) { q(0, F.L, yPie, yMuro); continue; }
    const filas = [...Array(pisos).keys()].map(yVent).filter(([, yt]) => yt <= yMuro - 0.3), B = vanos(F.L).bandas;
    let y = yPie;
    for (const [yb, yt] of filas) {
      q(0, F.L, y, yb); let s = 0;
      for (const [c, w] of B) { q(s, c - w / 2, yb, yt); s = c + w / 2; }
      q(s, F.L, yb, yt); y = yt;
    }
    q(0, F.L, y, yMuro);
  }
  // zócalo de moldura crema, 2 cm afuera: del pie a la losa del piso 1 (106) o, sobre una planta baja de servicio más alta que la
  // base del 106, solo hasta esa altura (0,65 m)
  const yZoc = y0 + Math.min(base, KIT.base);
  if (medio) { const Z = desplazar(P, alto ? 0.02 : 0.05); faja(G, Z, yPie, yZoc, 'moldura'); anillo(G, Z, P, yZoc, yZoc, 'moldura', [0, 1, 0]); }
  if (medio) for (const F of marcos) {
    if (F.L < 4) continue;
    const VA = vanos(F.L), fuera = [F.n[0], 0, F.n[1]];
    const huecos = banda ? VA.bandas : VA.pares.map((s) => [s, KIT.par]);
    // planta baja de servicio: banda baja de ventanas (SUPUESTA: de 1,3 a 0,4 m bajo la losa del piso 1, el ancho de cada vano)
    if (e.servicio?.ventanas && base > 2.2) for (const [s, w] of huecos) {
      const yt = losa(0) - 0.4, yb = losa(0) - 1.3, o = alto ? 0.012 : 0.06;
      G.quad('vidrio', F.p(s - w / 2, o, yb), F.p(s + w / 2, o, yb), F.p(s + w / 2, o, yt), F.p(s - w / 2, o, yt), fuera);
    }
    for (const [s, w] of huecos) for (let k = 0; k < pisos; k++) {
      const [yb, yt] = yVent(k);
      if (yt > yMuro - 0.3) continue;
      const s0 = s - w / 2, s1 = s + w / 2;
      if (hueco) {
        // banda retirada: el vidrio a `retiro` m dentro del plomo, con mochetas, dintel y antepecho de pañete
        const o = -retiro;
        G.quad('vidrio', F.p(s0, o, yb), F.p(s1, o, yb), F.p(s1, o, yt), F.p(s0, o, yt), fuera);
        G.quad('muro', F.p(s0, o, yb), F.p(s0, 0, yb), F.p(s0, 0, yt), F.p(s0, o, yt), [F.d[0], 0, F.d[1]]);
        G.quad('muro', F.p(s1, o, yb), F.p(s1, 0, yb), F.p(s1, 0, yt), F.p(s1, o, yt), [-F.d[0], 0, -F.d[1]]);
        G.quad('muro', F.p(s0, o, yt), F.p(s1, o, yt), F.p(s1, 0, yt), F.p(s0, 0, yt), [0, -1, 0]);
        G.quad('moldura', F.p(s0, o, yb), F.p(s1, o, yb), F.p(s1, 0.05, yb), F.p(s0, 0.05, yb), [0, 1, 0]);
      } else {
        const o = alto ? 0.012 : 0.06;   // de lejos, 6 cm para que el búfer de profundidad los separe del muro
        G.quad('vidrio', F.p(s0, o, yb), F.p(s1, o, yb), F.p(s1, o, yt), F.p(s0, o, yt), fuera);
      }
      // parteluces: en un par, uno al medio (como el 106); en una banda, uno cada ~1,2 m
      if (alto) marcoVentana(G, F, s0, s1, yb, yt, { nP: banda ? Math.max(1, Math.round(w / 1.2)) : 2, oV: banda ? -retiro : 0, dintel: !banda || retiro === 0, w });
    }
    // ventilación del zócalo: rejillas azul gris del 106 (0,6 m, cada 3,25 m) o, por dato, paneles bajo cada banda
    const rj = e.rejilla;
    if (alto && rj?.bajoBandas) for (const [s, w] of VA.bandas) G.quad(rj.parte, F.p(s - w / 2, 0.025, y0 + rj.y[0]), F.p(s + w / 2, 0.025, y0 + rj.y[0]), F.p(s + w / 2, 0.025, y0 + rj.y[1]), F.p(s - w / 2, 0.025, y0 + rj.y[1]), fuera);
    else if (alto) for (let s = 1.6; s < F.L - 1; s += 3.25) G.quad('celosia', F.p(s - 0.3, 0.025, y0 + KIT.rejilla[0]), F.p(s + 0.3, 0.025, y0 + KIT.rejilla[0]), F.p(s + 0.3, 0.025, y0 + KIT.rejilla[1]), F.p(s - 0.3, 0.025, y0 + KIT.rejilla[1]), fuera);
    // ménsulas del 106 (perfil medido) bajo cada mediagua y bajo el alero: en el machón chico (106, ventanas en pares) o en el
    // machón grande (ventanas en banda), y una a 0,30 m de cada esquina, como en el 106 (MED.mediaguaPiezas.mensulas)
    if (alto && e.mensulas !== false) for (const s of [0.3, ...(banda ? VA.machonGrande : VA.machonChico), F.L - 0.3]) for (const k of [...meds, pisos])
      lamina(G, 'moldura', F, s, KIT.mensula.ancho, KIT.mensula.perfil.map(([o, y]) => [o, y + losa(k) + KIT.mensula.arriba]), 0.08);
  }
  // mediaguas sobre las losas pedidas y alero del techo, pieza por pieza como las del 106 (KIT.pieza): teja sobre el tablero,
  // frente de la teja, tablero inclinado (su cara de abajo es el sofito), tabla de borde, viguetas horizontales y solera.
  // De lejos, solo la teja y el sofito de cada mediagua.
  const O = desplazar(P, V), K = KIT.pieza, tt = K.teja.mediana, AL = e.alero;
  // con `alero`, la teja en canales solo sobre una huella de 4 lados (canales() trabaja sobre un rectángulo)
  const ALm = AL ? { frente: AL.frente, cabio: AL.cabio, teja: P.length === 4 ? AL.teja : null } : null;
  for (const k of meds) mediaguaAlrededor(G, P, marcos, losa(k), { alto, medio, pend: e.mediagua?.pendiente ?? KIT.mediagua.pendiente, duplex: ALm });
  // techo: canto del alero, sofito inclinado y cuatro aguas con esqueleto recto
  // Dos formas: la del 106 (un faldón del canto del alero a la cumbrera) o, con techo.desdeMuro, la del cuartel estándar de CERL
  // (fig. 4.10 y 4.11): un alero perimetral como una mediagua más (las piezas y la pendiente del alero del 106) y el techo a cuatro
  // aguas que arranca en el plomo del muro, sobre el encuentro del alero con el muro, con su propia pendiente
  const tan = Math.tan(pend * rad);
  const yCanto = yMuro + KIT.techo.canto, ySofT = yMuro + KIT.techo.sofito, dosNiveles = !!e.techo?.desdeMuro;
  const tanA = dosNiveles ? Math.tan(KIT.techo.pendiente * rad) : tan;
  const forma = convexo(P) ? 'esqueleto' : 'rectángulo mínimo';
  const base4 = dosNiveles ? (forma === 'esqueleto' ? P : rectanguloMinimo(P)) : null;
  const OT = dosNiveles ? base4 : forma === 'esqueleto' ? O : desplazar(rectanguloMinimo(P), V);
  const yArranque = dosNiveles ? yCanto + V * tanA + tt : yCanto + tt;
  if (dosNiveles) anillo(G, P, O, yArranque, yCanto + tt, 'teja', [0, 1, 0]);
  const cumbrera = techo(G, OT, yArranque, pend, 'teja');
  if (medio) {
    anillo(G, P, O, ySofT + V * tanA, ySofT, 'madera', [0, -1, 0]);
    bajoAlero(G, P, marcos, yMuro, K.fasciaTecho, K.viguetasTecho, { alto: alto && !AL });
    if (alto && AL) cabiosAlero(G, marcos, ySofT + V * tanA, tanA, V - K.fascia.espesor, AL.cabio);
  } else anillo(G, P, O, yCanto + V * tanA, yCanto, 'madera', [0, -1, 0]);
  // piezas por dato: pabellones adosados y hastial de ventilación sobre un extremo del techo
  const extras = {};
  if (medio && e.pabellones) extras.pabellones = e.pabellones.map((b) => pabellon(G, marcos, b, y0, yPie, base));
  if (e.hastial && OT.length === 4) extras.hastial = hastialTecho(G, OT, cumbrera, pend, e.hastial);
  return { G, P, cumbrera: Math.max(cumbrera, extras.hastial?.pico ?? -Infinity), cumbreraTecho: cumbrera, forma, yMuro, juntas, extras };
}

/**
 * Un dúplex tropical (tipo de 1939 a 1943 en la Zona del Canal, CERL p. 5-7) del kit sobre el rectángulo de sus muros. Entrada (datos por edificio, ciudad-datos.mjs):
 *   poly (muros, rectángulo), y0 (suelo bajo la huella, el más bajo), yPie, terreno ((x, z) → y del suelo que dibuja la escena),
 *   basamento (cara de arriba de la losa del primer piso habitable sobre y0), losa: { espesor } (lo que asoma la losa bajo ese
 *   piso), alturas (piso a piso de cada piso habitable; el último llega al remate del muro), mediaguas (pisos habitables con
 *   mediagua encima: 1 = sobre el primero), vuelo (del techo y de la mediagua), techo: { pendiente }, bahias (vanos en el lado
 *   largo), ventanas: { largo, corto, pisos }, planta: { pilar, retiroNucleo, cuarto, piso, escaleras } (planta baja: pilares en las
 *   líneas de bahía; con `cuarto`, un cuarto cerrado al centro con celosías y puerta y un estacionamiento a cada lado; sin él, el
 *   núcleo liso en la bahía del medio), pilastras, mensulas, alero: { frente, cabio, teja }, detalle.
 * Las piezas son las del 106 (muro, moldura, teja, mediagua, vidrio, madera, celosía, servicio y el concreto de la entrada), con sus
 * materiales. Todo lo propio del dúplex (cabios inclinados, teja en canales, frente de teja más alto, ménsulas de bloque, escaleras)
 * vive solo en esta función y en las auxiliares que solo ella llama: el 106 y los cuarteles no cambian.
 * Devuelve { G, P, cumbrera, forma, yMuro, juntas, extras } como cuartel().
 */
export function duplex(e) {
  const P = simplificar(e.poly), alto = e.detalle === 'alto', medio = e.detalle !== 'lejos';
  if (P.length !== 4) throw new Error('dúplex: los muros tienen que ser un rectángulo');
  const y0 = e.y0 ?? 0, yPie = (e.yPie ?? y0) - 0.3, base = e.basamento, alturas = e.alturas, n = alturas.length;
  const losa = (k) => y0 + base + alturas.slice(0, k).reduce((a, b) => a + b, 0);   // k = 0: primer piso habitable
  const yMuro = losa(n), yBajoLosa = losa(0) - e.losa.espesor, v = e.vuelo, pend = e.techo.pendiente;
  const meds = (e.mediaguas ?? []).filter((k) => k >= 1 && k < n);
  const juntas = [...meds.map((k) => losa(k) + 0.1), yMuro + 0.1].map(r3);
  const G = new Geo(medio ? juntas : []);
  const marcos = P.map((A, i) => marco(A, P[(i + 1) % 4]));
  // lado largo de referencia (marco con su normal hacia afuera; adentro es o < 0) y ancho
  const FL = marcos.reduce((m, F) => (F.L > m.L ? F : m), marcos[0]), W = marcos.find((F) => Math.abs(F.d[0] * FL.d[0] + F.d[1] * FL.d[1]) < 0.5).L, L = FL.L;
  const esLargo = (F) => Math.abs(F.d[0] * FL.d[0] + F.d[1] * FL.d[1]) > 0.5;
  const nb = e.bahias, bah = L / nb, PB = e.planta, AL = e.alero;
  // alero del techo: el sofito inclinado llega al muro a la misma altura que en el 106 (remate + sofito + 1,65 · tan 17,8°) y baja
  // v · tan(pendiente) hasta el borde; tablero del espesor del 106 y la teja encima
  const K = KIT.pieza, tt = K.teja.mediana, O = desplazar(P, v), tan = Math.tan(pend * rad);
  const ySofMuro = yMuro + KIT.techo.sofito + KIT.vuelo * Math.tan(KIT.techo.pendiente * rad), ySof = ySofMuro - v * tan;
  // muros de los pisos habitables: del canto de abajo de la losa hasta el sofito (sin la rendija entre el remate y el tablero)
  const yMuroArriba = AL ? Math.max(yMuro, ySofMuro) : yMuro;
  for (const F of marcos) G.quad('muro', F.p(0, 0, yBajoLosa), F.p(F.L, 0, yBajoLosa), F.p(F.L, 0, yMuroArriba), F.p(0, 0, yMuroArriba), [F.n[0], 0, F.n[1]]);
  // ---------------- planta baja ----------------
  const pl = PB.pilar, rn = PB.retiroNucleo;
  if (medio) G.quad('muro', FL.p(0, 0, yBajoLosa), FL.p(L, 0, yBajoLosa), FL.p(L, -W, yBajoLosa), FL.p(0, -W, yBajoLosa), [0, -1, 0]);
  // pilares cuadrados en las líneas de bahía de los dos lados largos, del pie a la losa
  for (let i = 0; i <= nb; i++) {
    const s = Math.min(Math.max(i * bah, pl / 2), L - pl / 2);
    for (const o of [0, -W + pl]) G.caja('muro', FL, s - pl / 2, s + pl / 2, o - pl, o, yPie, yBajoLosa, { arriba: false });
  }
  // piso de concreto bajo todo el edificio (estacionamientos y cuarto), siguiendo el terreno que dibuja la escena a 6 cm sobre él
  if (medio && PB.piso && e.terreno) pisoConcreto(G, FL, L, W, e.terreno, yPie);
  if (PB.cuarto) {
    // cuarto cerrado al centro (PB.cuarto.largo a lo largo, centrado; retirado rn de las dos caras largas) con un estacionamiento a
    // cada lado; en cada cara larga, una celosía alta y una puerta (girados 180° en la otra cara: la planta es simétrica)
    // con `bahiasAbiertas` (casas de oficiales), el cuarto ocupa todo menos esas bahías del extremo de s = 0 (la cochera)
    const C = PB.cuarto, ab = C.bahiasAbiertas ?? 0, sc = L / 2;
    // C.cocheraEn (rumbo, casa por casa): la cochera va en el extremo que más mira hacia allá; sin él, en el de s = 0
    const cochS0 = !C.cocheraEn || (() => { const F = ladoDe(marcos.filter((x) => !esLargo(x)), C.cocheraEn), m = F.p(F.L / 2, 0, 0), a = FL.p(0, 0, 0); return (m[0] - a[0]) * FL.d[0] + (m[2] - a[2]) * FL.d[1] < L / 2; })();
    const s0 = ab ? (cochS0 ? ab * bah + pl / 2 : pl / 2) : sc - C.largo / 2, s1 = ab ? (cochS0 ? L - pl / 2 : L - ab * bah - pl / 2) : sc + C.largo / 2;
    G.caja('muro', FL, s0, s1, -W + rn, -rn, yPie, yBajoLosa, { arriba: false });
    if (medio) for (const F of marcos.filter(esLargo)) {
      // centro del cuarto en el marco de esta cara: los dos marcos largos van en sentidos opuestos, así que el mismo s relativo
      // queda girado 180° (con el cuarto al centro, F.L / 2 en las dos)
      const mismo = F.d[0] * FL.d[0] + F.d[1] * FL.d[1] > 0;
      const c = !ab ? F.L / 2 : mismo ? (s0 + s1) / 2 : F.L - (s0 + s1) / 2, fuera = [F.n[0], 0, F.n[1]], o = -rn + (alto ? 0.012 : 0.04);
      const [cw, ch, cs] = C.celosia, [pw, ph, ps] = C.puerta;
      const yct = yBajoLosa - C.celosiaBajoViga, ycb = yct - ch;
      G.quad('celosia', F.p(c + cs - cw / 2, o, ycb), F.p(c + cs + cw / 2, o, ycb), F.p(c + cs + cw / 2, o, yct), F.p(c + cs - cw / 2, o, yct), fuera);
      const pp = F.p(c + ps, -rn, 0), yp = e.terreno ? Math.max(y0, e.terreno(pp[0], pp[2]) + 0.06) : y0;
      G.quad('servicio', F.p(c + ps - pw / 2, o, yp), F.p(c + ps + pw / 2, o, yp), F.p(c + ps + pw / 2, o, yp + ph), F.p(c + ps - pw / 2, o, yp + ph), fuera);
      if (alto) {
        marcoVentana(G, F, c + cs - cw / 2, c + cs + cw / 2, ycb, yct, { nP: 2, oV: -rn, dintel: false });
        // tablillas de la celosía: una cada 0,1 m, de moldura
        for (let y = ycb + 0.1; y < yct - 0.02; y += 0.1) G.caja('moldura', F, c + cs - cw / 2, c + cs + cw / 2, -rn, -rn + 0.03, y - 0.012, y, { atras: false, abajo: true });
        G.caja('moldura', F, c + ps - pw / 2 - 0.06, c + ps + pw / 2 + 0.06, -rn, -rn + 0.04, yp + ph, yp + ph + 0.08, { atras: false });   // dintel de la puerta
      }
    }
    // v3: muro bajo blanco delante del cuarto (una caja maciza, en las dos caras largas: el dato no dice cuál es el frente)
    const MB = e.muroBajo;
    if (medio && MB) for (const F of marcos.filter(esLargo)) {
      const sc = F.L / 2 + MB.desdeCentro, o0 = -rn + MB.separacion, p = F.p(sc, o0 + MB.fondo / 2, 0), yb = e.terreno ? e.terreno(p[0], p[2]) + 0.06 : y0;
      G.caja('muro', F, sc - MB.ancho / 2, sc + MB.ancho / 2, o0, o0 + MB.fondo, yPie, yb + MB.alto);
    }
  } else {
    // sin dato del cuarto: el núcleo liso en la bahía del medio (como en la v1)
    const sN0 = bah * Math.floor((nb - 1) / 2), sN1 = L - sN0;
    G.caja('muro', FL, sN0 + pl / 2, sN1 - pl / 2, -W + rn, -rn, yPie, yBajoLosa, { arriba: false });
  }
  // escaleras de entrada: una en cada extremo (lado corto), afuera del muro, que sube a lo largo del muro hasta un descanso junto a la
  // esquina con la puerta del primer piso; huellas de teja, una cuña blanca maciza debajo y la baranda parda (girada 180° en el
  // otro extremo, como las unidades A y B)
  // `extremos: 1`: una sola escalera, en el extremo de la cochera (s = 0 del lado largo de referencia)
  const cortos = marcos.filter((x) => !esLargo(x)), enS0 = (F) => { const m = F.p(F.L / 2, 0, 0), a = FL.p(0, 0, 0); return (m[0] - a[0]) * FL.d[0] + (m[2] - a[2]) * FL.d[1] < L / 2; };
  if (medio && PB.escaleras) for (const F of escalerasEn(PB.escaleras, cortos, enS0))
    escaleraExterior(G, F, PB.escaleras, { yT: losa(0), y0, yPie, terreno: e.terreno, alto, parteBalaustre: 'balaustre' });
  // ---------------- pisos habitables ----------------
  // ventanas: en el lado largo, una ancha en cada bahía de los extremos y dos angostas en las del medio; en el lado corto, dos al
  // centro (con escalera, la del lado del descanso se corre lo que haga falta para no pisar la puerta). Vidrio a 1,2 cm del muro (6 cm
  // de lejos) y, con detalle alto, el marco del 106
  // v3: por piso, en el lado largo, una ventana ancha en cada bahía de los extremos y, en las del medio, o dos junto a las pilastras
  // (modo 'pilastras') o un par pegado al centro (modo 'par'), o una por bahía (modo 'una', casas de oficiales); todas con el dintel a
  // la misma altura. En el lado corto, dos al centro con la altura de las anchas
  if (medio) for (const F of marcos) {
    const largo = esLargo(F), V_ = e.ventanas;
    for (let k = 0; k < n; k++) {
      const Pk = V_.pisos[Math.min(k, V_.pisos.length - 1)], huecos = [];   // [centro, ancho, alto, bahía extrema, bahía]
      if (largo) for (let b = 0; b < nb; b++) {
        const c = (b + 0.5) * bah, ext = b === 0 || b === nb - 1, M = Pk.medio;
        if (ext || M.modo === 'una') huecos.push([c, ...(ext ? Pk.extremo : [M.ancho, M.alto]), ext, b]);
        else if (M.modo === 'pilastras') for (const sg of [-1, 1]) huecos.push([c + sg * (bah / 2 - M.aPilastra - M.ancho / 2), M.ancho, M.alto, false, b]);
        else for (const sg of [-1, 1]) huecos.push([c + sg * (M.ancho + M.junta) / 2, M.ancho, M.alto, false, b]);
      }
      else for (const sg of [-1, 1]) huecos.push([F.L / 2 + sg * (V_.corto.ancho + V_.corto.separacion) / 2, V_.corto.ancho, Pk.extremo[1], true, -1]);
      const yt = losa(k) + Pk.dintel;
      for (const [s, w, h, ext, b] of huecos) {
        let s0 = s - w / 2, s1 = s + w / 2;
        if (!largo && k === 0 && PB.escaleras) { const lim = F.L - PB.escaleras.esquina - PB.escaleras.descanso - 0.15; if (s1 > lim) { s1 = lim; if (s1 - s0 < 0.6) continue; } }
        // rejas: 'todas', 'extremos' (bahías de los extremos del lado largo) o 'derecha' (la bahía de la derecha vista desde afuera, que es
        // la de s = 0: mirando hacia el muro, la derecha es −d; girada 180° en la otra cara, como la planta)
        ventanaAluminio(G, F, s0, s1, yt - h, yt, V_, { alto, tipo: V_.tipo, reja: V_.rejas === 'todas' || (largo && ((V_.rejas === 'extremos' && ext) || (V_.rejas === 'derecha' && b === 0))) });
      }
    }
    // pilastras: en las líneas de bahía del lado largo, del canto de la losa al remate, apenas salidas del muro
    if (largo && e.pilastras) for (let i = 1; i < nb; i++) { const s = i * bah, pi = e.pilastras; G.caja('muro', F, s - pi.ancho / 2, s + pi.ancho / 2, 0, pi.sale, yBajoLosa, yMuroArriba, { atras: false, arriba: false }); }
  }
  // mediagua que rodea el bloque (las piezas del 106 alargadas al vuelo del dúplex, con lo propio del dúplex si hay `alero`)
  const tm = Math.tan(KIT.mediagua.pendiente * rad);
  for (const k of meds) mediaguaAlrededor(G, P, marcos, losa(k), { alto, medio, v, pend: KIT.mediagua.pendiente, duplex: AL ? { frente: AL.frente, cabio: AL.cabio, teja: AL.teja } : null });
  // ménsulas de bloque blancas bajo la mediagua: en cada línea de bahía del lado largo (también las esquinas), y vigas blancas en las
  // esquinas que salen a lo largo del eje largo hasta el borde de la mediagua
  if (medio && e.mensulas?.tipo === 'bloque') for (const k of meds) {
    const M = e.mensulas, dyM = -(v - KIT.vuelo) * tm, ySofW = losa(k) + KIT.mediagua.canto + dyM - K.tablero.espesor + v * tm;
    const techoEn = (o) => ySofW - o * tm;
    for (const F of marcos) {
      if (esLargo(F)) for (let i = 0; i <= nb; i++) {
        const s = Math.min(Math.max(i * bah, M.ancho / 2), F.L - M.ancho / 2);
        prisma(G, 'moldura', F, s - M.ancho / 2, s + M.ancho / 2, [[0, techoEn(0) - M.alto], [M.vuelo, techoEn(M.vuelo) - M.punta], [M.vuelo, techoEn(M.vuelo)], [0, techoEn(0)]]);
      }
      else for (const s of [M.viga.ancho / 2, F.L - M.viga.ancho / 2]) {
        const hasta = v - K.fascia.espesor;
        prisma(G, 'moldura', F, s - M.viga.ancho / 2, s + M.viga.ancho / 2, [[0, techoEn(0) - M.viga.alto], [hasta, techoEn(hasta) - M.viga.alto], [hasta, techoEn(hasta)], [0, techoEn(0)]]);
      }
    }
  }
  const yCanto = ySof + (KIT.techo.canto - KIT.techo.sofito);
  if (e.techo.forma === 'dos aguas') {
    const c2 = techoDosAguas(G, { P, FL, W, L, marcos, esLargo, v, vh: e.techo.vueloHastial, tan, yCanto, ySof, ySofMuro, yMuroArriba, tt, alto, medio, AL });
    return { G, P, cumbrera: c2, cumbreraTecho: c2, forma: 'dos aguas', yMuro, juntas, extras: { bahias: nb, ancho: r3(W), largo: r3(L) } };
  }
  // techo a cuatro aguas
  const cumbrera = techo(G, O, yCanto + tt, pend, 'teja');
  if (alto && AL) canales(G, O, yCanto + tt, tan, Infinity, AL.teja, 'canalTeja');
  if (medio) {
    anillo(G, P, O, ySof + v * tan, ySof, 'madera', [0, -1, 0]);
    bajoAlero(G, P, marcos, yMuro, K.fasciaTecho, K.viguetasTecho, { alto: alto && !AL, v, dy: ySof - (yMuro + KIT.techo.sofito) });
    if (alto && AL) cabiosAlero(G, marcos, ySofMuro, tan, v - K.fascia.espesor, AL.cabio);
  } else anillo(G, P, O, yCanto + v * tan, yCanto, 'madera', [0, -1, 0]);
  return { G, P, cumbrera, cumbreraTecho: cumbrera, forma: 'esqueleto', yMuro, juntas, extras: { bahias: nb, ancho: r3(W), largo: r3(L) } };
}

/** Abertura con las esquinas de arriba redondeadas (arco rebajado de las casas elevadas, CERL [3.30]): contorno de la enjuta sobre
 *  la abertura [a, b] × [.., yA] hasta yT, en (s, y). */
function enjuta(a, b, yA, rc, yT, k = 4) {
  const pts = [[a, yA - rc]];
  for (let i = 1; i < k; i++) { const t = Math.PI - (i / k) * (Math.PI / 2); pts.push([a + rc + rc * Math.cos(t), yA - rc + rc * Math.sin(t)]); }
  pts.push([a + rc, yA], [b - rc, yA]);
  for (let i = 1; i < k; i++) { const t = Math.PI / 2 - (i / k) * (Math.PI / 2); pts.push([b - rc + rc * Math.cos(t), yA - rc + rc * Math.sin(t)]); }
  pts.push([b, yA - rc], [b, yT], [a, yT]);
  return pts;
}

/**
 * Una casa baja del kit (fase 3, paso 4): el pabellón de un piso con cochera plana, la casa NCO de 1949, la casa elevada de Aroldo Cano
 * («Colonels' Row») y la casa del área 900. Una sola función con piezas por dato; reusa las del dúplex y las casas de oficiales
 * (techoDosAguas, techo con esqueleto, ventanaAluminio, escaleraExterior, pisoConcreto, hastialTecho) y no cambia ninguna.
 * Entrada (ciudad-datos.mjs):
 *   poly (muros, rectángulo), y0, yPie, terreno, detalle;
 *   base: cara de arriba de la losa del primer piso sobre y0; pisos: [alto de cada piso, del piso al remate];
 *   techo: { forma: 'dos aguas' | 'cuatro aguas', pendiente, vuelo, vueloHastial, espesor, hastiales: { ancho, pendiente, sobreCumbrera, largo } };
 *   ventanas: { tipo, marco, lama, reja, pisos: [{ largo: [fracciones del lado], corto: [...], ancho, alto, dintel }] };
 *   puertas: { largo: [fracciones], ancho, alto } (primer piso, en las dos caras largas);
 *   cochera: { en ([x, z] o rumbo: el extremo), largo, columna, losa } (techo plano sobre columnas, pegado al extremo);
 *   faldon: { cara, ancho, fondo, pendiente, poste } (el techo de una cara larga sigue sobre la cochera, NCO de 1949);
 *   arcada: { bahiasLargo, bahiasCorto, pilar, fondoPilar, abertura, radio, losa, cerrada: { cara, fondo, ventana } } (planta baja abierta);
 *   escaleras: [{ cara, hasta, ...S de escaleraExterior }]; tablas: { desde, paso, sale } (tablas horizontales de los pisos altos).
 * Devuelve { G, P, cumbrera, forma, yMuro, juntas, extras } como cuartel().
 */
export function casa(e) {
  const P = simplificar(e.poly), alto = e.detalle === 'alto', medio = e.detalle !== 'lejos';
  if (P.length !== 4) throw new Error('casa: los muros tienen que ser un rectángulo');
  const y0 = e.y0, yPie = e.yPie - 0.3, n = e.pisos.length, T = e.techo, AR = e.arcada;
  const losa = (k) => y0 + e.base + e.pisos.slice(0, k).reduce((a, b) => a + b, 0), yMuro = losa(n);
  const marcos = P.map((A, i) => marco(A, P[(i + 1) % 4]));
  const FL = marcos.reduce((m, F) => (F.L > m.L ? F : m), marcos[0]), L = FL.L, W = marcos.find((F) => Math.abs(F.d[0] * FL.d[0] + F.d[1] * FL.d[1]) < 0.5).L;
  const esLargo = (F) => Math.abs(F.d[0] * FL.d[0] + F.d[1] * FL.d[1]) > 0.5;
  // techo: el sofito inclinado llega al muro en el remate y baja v · tan hasta el borde; canto = sofito + espesor
  const v = T.vuelo, tan = Math.tan(T.pendiente * rad), esp = T.espesor ?? 0.15, tt = 0.02;
  const ySofMuro = yMuro, ySof = ySofMuro - v * tan, yCanto = ySof + esp;
  const juntas = [...(e.entrePisos ? e.entrePisos.pisos.map((k) => r3(losa(k) + 0.05)) : []), r3(yMuro)];
  const G = new Geo(medio ? juntas : []);
  // ---------------- muros ----------------
  // con arcada, los muros empiezan en el canto de abajo de la losa; sobre losa, en la losa (debajo va el zócalo de concreto)
  // con zócalo (Gonzalo Crance) el muro baja hasta el pie: el zócalo es del muro, con las rejillas encima, no una plataforma de concreto
  const yArranque = AR ? losa(0) - AR.losa : e.zocalo ? yPie : y0;
  if (!e.abierto) for (const F of marcos) G.quad('muro', F.p(0, 0, yArranque), F.p(F.L, 0, yArranque), F.p(F.L, 0, yMuro), F.p(0, 0, yMuro), [F.n[0], 0, F.n[1]]);
  else galeraAbierta(G, marcos, e.abierto, { y0, yPie, yMuro, FL, L, W, medio, alto });
  // tablas horizontales en los pisos altos (área 900): una lámina por hilada, inclinada hacia afuera abajo (la sombra de la junta)
  if (medio && e.tablas) for (const F of marcos) for (let y = losa(e.tablas.desde); y + 0.01 < yMuro - 0.05; y += e.tablas.paso) {
    const y1 = Math.min(y + e.tablas.paso, yMuro - 0.05), s_ = e.tablas.sale;
    G.quad('moldura', F.p(0, s_, y), F.p(F.L, s_, y), F.p(F.L, 0.001, y1), F.p(0, 0.001, y1), [F.n[0], 0.2, F.n[1]]);
    if (alto) G.quad('moldura', F.p(0, 0, y), F.p(F.L, 0, y), F.p(F.L, s_, y), F.p(0, s_, y), [0, -1, 0]);
  }
  // ---------------- planta baja con arcada (casas elevadas) ----------------
  const extras = { ancho: r3(W), largo: r3(L) };
  if (AR) {
    const yT = losa(0) - AR.losa, yA = y0 + AR.abertura, pw = AR.pilar, pd = AR.fondoPilar, C = AR.cerrada, Fc = C ? ladoDe(marcos, C.cara) : null;
    if (medio) G.quad('muro', FL.p(0, 0, yT), FL.p(L, 0, yT), FL.p(L, -W, yT), FL.p(0, -W, yT), [0, -1, 0]);   // cielo de la planta baja
    if (medio && e.terreno) pisoConcreto(G, FL, L, W, e.terreno, yPie);
    // AR.cerradaBajoDescanso (casas elevadas, v2): en la cara de la primera escalera, la bahía bajo su descanso va cerrada (muro con una
    // puerta), como en Street View 543575149 y 543575145: dos vanos anchos y la parte cerrada bajo el descanso
    let Fd = null, bd = -1;
    if (AR.cerradaBajoDescanso && e.escaleras?.length) {
      const S = e.escaleras[0], F0 = ladoDe(marcos, S.cara), sD = S.hasta * F0.L - S.descanso / 2;
      const nb0 = esLargo(F0) ? AR.bahiasLargo : AR.bahiasCorto;
      Fd = F0; bd = Math.max(0, Math.min(nb0 - 1, Math.floor((S.invertir ? F0.L - sD : sD) / (F0.L / nb0))));
    }
    for (const F of marcos) {
      const nb = esLargo(F) ? AR.bahiasLargo : AR.bahiasCorto, bw = F.L / nb, fuera = [F.n[0], 0, F.n[1]];
      if (F === Fd) {
        // bahía cerrada bajo el descanso: muro lleno de pilar a pilar con una puerta al centro
        const a = bd * bw + pw / 2, bb = (bd + 1) * bw - pw / 2, c = (a + bb) / 2;
        G.quad('muro', F.p(a, -pd / 2, yPie), F.p(bb, -pd / 2, yPie), F.p(bb, -pd / 2, yT), F.p(a, -pd / 2, yT), fuera);
        if (medio) G.quad('servicio', F.p(c - 0.45, -pd / 2 + 0.012, y0), F.p(c + 0.45, -pd / 2 + 0.012, y0), F.p(c + 0.45, -pd / 2 + 0.012, y0 + 2.1), F.p(c - 0.45, -pd / 2 + 0.012, y0 + 2.1), fuera);
      }
      if (F === Fc) {
        // cara cerrada (cuartos de servicio y bodega, CERL [3.29]): muro lleno con una ventana por bahía y la puerta en la del medio
        G.quad('muro', F.p(0, 0, yPie), F.p(F.L, 0, yPie), F.p(F.L, 0, yT), F.p(0, 0, yT), fuera);
        if (medio) for (let b = 0; b < nb; b++) {
          const c = (b + 0.5) * bw;
          if (b === (nb - 1) / 2) G.quad('servicio', F.p(c - 0.45, 0.012, y0), F.p(c + 0.45, 0.012, y0), F.p(c + 0.45, 0.012, y0 + 2.1), F.p(c - 0.45, 0.012, y0 + 2.1), fuera);
          else ventanaAluminio(G, F, c - C.ventana[0] / 2, c + C.ventana[0] / 2, y0 + 2.0 - C.ventana[1], y0 + 2.0, e.ventanas, { alto, tipo: e.ventanas.tipo, reja: false, caja: true });
        }
        continue;
      }
      // pilares en las líneas de bahía (cajas de pw × pd) y enjutas con arco rebajado entre ellos, por las dos caras
      for (let i = 0; i <= nb; i++) { const s = Math.min(Math.max(i * bw, pw / 2), F.L - pw / 2); G.caja('muro', F, s - pw / 2, s + pw / 2, -pd, 0, yPie, yT, { arriba: false }); }
      if (!medio) { for (let b = 0; b < nb; b++) G.quad('muro', F.p(b * bw + pw / 2, 0, yA), F.p((b + 1) * bw - pw / 2, 0, yA), F.p((b + 1) * bw - pw / 2, 0, yT), F.p(b * bw + pw / 2, 0, yT), fuera); continue; }
      for (let b = 0; b < nb; b++) {
        const a = b * bw + pw / 2, bb = (b + 1) * bw - pw / 2, C2 = enjuta(a, bb, yA, Math.min(AR.radio, (bb - a) / 2), yT);
        const tri = ShapeUtils.triangulateShape(C2.map(([s_, y]) => new Vector2(s_, y)), []);
        for (const [o, nn] of [[0, fuera], [-pd, fuera.map((x) => -x)]]) for (const [i, j, k] of tri) G.tri('muro', F.p(C2[i][0], o, C2[i][1]), F.p(C2[j][0], o, C2[j][1]), F.p(C2[k][0], o, C2[k][1]), nn);
        // intradós del arco (la cara de abajo de la enjuta, del frente al fondo del pilar)
        for (let i = 0; i + 3 < C2.length - 2; i++) { const [s1, y1] = C2[i], [s2, y2] = C2[i + 1]; G.quad('muro', F.p(s1, 0, y1), F.p(s2, 0, y2), F.p(s2, -pd, y2), F.p(s1, -pd, y1), [0, -1, 0]); }
      }
    }
    // cuartos cerrados detrás de la cara cerrada: una caja de C.fondo hacia adentro (su cara de afuera es la cara cerrada)
    if (Fc) G.caja('muro', Fc, pw, Fc.L - pw, -C.fondo, -0.01, yPie, yT, { frente: false, arriba: false });
  }
  // ---------------- ventanas y puertas ----------------
  const V = e.ventanas;
  if (medio && V) for (const F of marcos) for (let k = 0; k < n; k++) {
    const Pk = V.pisos[Math.min(k, V.pisos.length - 1)], fr = esLargo(F) ? Pk.largo : Pk.corto, yt = losa(k) + Pk.dintel;
    for (const f of fr ?? []) { const c = f * F.L; ventanaAluminio(G, F, c - Pk.ancho / 2, c + Pk.ancho / 2, yt - Pk.alto, yt, V, { alto, tipo: V.sinLamas ? null : V.tipo, reja: !!V.rejas, caja: true }); }
  }
  const Pu = e.puertas;
  if (medio && Pu) for (const F of marcos.filter(esLargo)) for (const f of Pu.largo) {
    const c = f * F.L, yb = losa(0), fuera = [F.n[0], 0, F.n[1]];
    G.quad('servicio', F.p(c - Pu.ancho / 2, 0.012, yb), F.p(c + Pu.ancho / 2, 0.012, yb), F.p(c + Pu.ancho / 2, 0.012, yb + Pu.alto), F.p(c - Pu.ancho / 2, 0.012, yb + Pu.alto), fuera);
  }
  // losa sobre el suelo (casas sin arcada): el canto de la losa y, en terreno con pendiente, la plataforma bajo ella hasta el punto más
  // bajo, de concreto (las casas de 1949 están en terrazas, CERL p. 6-16); de lejos, la plataforma con el muro
  if (!AR && !e.zocalo) faja(G, desplazar(P, 0.02), yPie, y0 + Math.max(e.base, 0.05), medio ? 'piso' : 'muro');
  // ---------------- escaleras exteriores (casas elevadas) ----------------
  // S.invertir: sube en el otro sentido (el marco espejado: s va del otro extremo); S.hasta es la fracción del lado, en ese sentido,
  // donde termina el descanso
  if (medio && e.escaleras) for (const S of e.escaleras) {
    const F0 = ladoDe(marcos, S.cara), F = S.invertir ? { L: F0.L, n: F0.n, d: F0.d.map((x) => -x), p: (s_, o, y) => F0.p(F0.L - s_, o, y) } : F0;
    escaleraExterior(G, F, { ...S, esquina: F.L * (1 - S.hasta) }, { yT: losa(0), y0, yPie, terreno: e.terreno, alto });
  }
  // ---------------- techo ----------------
  // lámina ondulada (pulido): con T.lamina, los faldones del detalle alto van en la parte 'lamina'
  // T.parte (por dato): otra parte para los faldones en todos los niveles (la lámina azul gris de una casa del área 900)
  const pT = T.parte ?? (alto && T.lamina ? 'lamina' : 'teja');
  let cumbrera;
  if (T.forma === 'dos aguas') {
    cumbrera = techoDosAguas(G, { P, FL, W, L, marcos, esLargo, v, vh: T.vueloHastial ?? v, tan, yCanto, ySof, ySofMuro, yMuroArriba: yMuro, tt, alto, medio, AL: null, parteTeja: pT });
  } else if (T.forma === 'una agua' || T.forma === 'plano') {
    cumbrera = techoPlanoOUnAgua(G, { P, FL, W, L, marcos, esLargo, v, tan: T.forma === 'plano' ? 0 : tan, esp, yMuro, medio, cerrado: !e.abierto, parteTeja: pT });
  } else {
    // con T.vueloHastial, el alero de los lados cortos vuela otra cosa que el de los largos (área 900)
    const vh = T.vueloHastial ?? v, O = vh === v ? desplazar(P, v) : P.map((q, i) => { const a = marcos[(i + 3) % 4], b = marcos[i], va = esLargo(a) ? v : vh, vb = esLargo(b) ? v : vh; return [q[0] + a.n[0] * va + b.n[0] * vb, q[1] + a.n[1] * va + b.n[1] * vb]; });
    cumbrera = techo(G, O, yCanto + tt, T.pendiente, pT);
    if (medio) { anillo(G, P, O, ySofMuro, ySof, 'madera', [0, -1, 0]); faja(G, vh === v ? desplazar(P, v + 0.005) : O, ySof - 0.05, yCanto + tt, 'madera'); }
    else anillo(G, P, O, yCanto, ySof, 'madera', [0, -1, 0]);
    // hastialitos de ventilación en los dos extremos de la cumbrera (CERL [3.30]): el de los cuarteles, una vez por extremo
    if (T.hastiales && medio) {
      const R = O, lados = R.map((A, i) => marco(A, R[(i + 1) % 4])), dl = lados.reduce((m, F) => (F.L > m.L ? F : m), lados[0]).d;
      const mejor = (d) => Object.entries(RUMBO).reduce((m, [k, r]) => (r[0] * d[0] + r[1] * d[1] > m[1] ? [k, r[0] * d[0] + r[1] * d[1]] : m), ['', -2])[0];
      for (const d of [dl, dl.map((x) => -x)]) extras.hastial = hastialTecho(G, R, cumbrera, T.pendiente, { ...T.hastiales, extremo: mejor(d) });
    }
  }
  // ---------------- cochera plana sobre columnas, pegada a un extremo ----------------
  const CO = e.cochera;
  if (CO) {
    const Fe = ladoDe(marcos.filter((x) => !esLargo(x)), CO.en), cw = CO.columna, yC = yMuro, fuera = [Fe.n[0], 0, Fe.n[1]];
    // techo: losa de CO.losa m, del muro del extremo a CO.largo m afuera y del ancho de la casa
    G.caja('madera', Fe, 0, Fe.L, 0, CO.largo, yC - CO.losa, yC, { atras: false, abajo: true });
    for (const s of [cw / 2, Fe.L - cw / 2]) for (const o of [CO.largo / 2, CO.largo - cw / 2]) G.caja('muro', Fe, s - cw / 2, s + cw / 2, o - cw / 2, o + cw / 2, yPie, yC - CO.losa, { arriba: false });
    if (medio && e.terreno) { const Q = (s, o) => { const p = Fe.p(s, o, 0); return [p[0], e.terreno(p[0], p[2]) + 0.05, p[2]]; }; G.quad('piso', Q(0, 0), Q(Fe.L, 0), Q(Fe.L, CO.largo), Q(0, CO.largo), [0, 1, 0]); }
    extras.cochera = { largo: CO.largo, fuera };
  }
  // ---------------- faldón sobre la cochera (NCO de 1949): el techo de una cara larga sigue, con menos pendiente ----------------
  const FA = e.faldon;
  if (FA) {
    const F = ladoDe(marcos.filter(esLargo), FA.cara), c = F.L / 2, s0 = c - FA.ancho / 2, s1 = c + FA.ancho / 2, tF = Math.tan(FA.pendiente * rad);
    const yW = yCanto + tt + v * tan, yE = yW - (FA.fondo + v) * tF, oE = FA.fondo + v;   // arranca en el muro a la altura del techo
    G.quad(pT, F.p(s0, 0, yW), F.p(s1, 0, yW), F.p(s1, oE, yE), F.p(s0, oE, yE), [0, 1, 0]);
    if (medio) {
      G.quad('madera', F.p(s0, 0, yW - esp), F.p(s1, 0, yW - esp), F.p(s1, oE, yE - esp), F.p(s0, oE, yE - esp), [0, -1, 0]);
      for (const [a, b, nn] of [[[s0, oE], [s1, oE], F.n], [[s0, 0], [s0, oE], F.d.map((x) => -x)], [[s1, 0], [s1, oE], F.d]])
        G.quad('madera', F.p(a[0], a[1], yW - (a[1] / oE) * (yW - yE) - esp - 0.05), F.p(b[0], b[1], yW - (b[1] / oE) * (yW - yE) - esp - 0.05), F.p(b[0], b[1], yW - (b[1] / oE) * (yW - yE)), F.p(a[0], a[1], yW - (a[1] / oE) * (yW - yE)), [nn[0], 0, nn[1]]);
    }
    const yPost = yE - esp - 0.05 + (oE - FA.fondo) * tF;
    for (const s of [s0 + FA.poste, s1 - FA.poste]) G.caja('muro', F, s - FA.poste / 2, s + FA.poste / 2, FA.fondo - FA.poste, FA.fondo, yPie, yPost, { arriba: false });
    if (medio && e.terreno) { const Q = (s, o) => { const p = F.p(s, o, 0); return [p[0], e.terreno(p[0], p[2]) + 0.05, p[2]]; }; G.quad('piso', Q(s0, 0), Q(s1, 0), Q(s1, FA.fondo), Q(s0, FA.fondo), [0, 1, 0]); }
  }
  // ---------------- piezas de los bloques de dos pisos, naves y kioscos (fase 3, paso 5) ----------------
  // alero corrido entre pisos (Gonzalo Crance), cuerpo bajo adosado (ala), tornapuntas de madera bajo los aleros y rejillas del zócalo
  if (e.entrePisos) for (const k of e.entrePisos.pisos) aleroCorrido(G, P, marcos, losa(k), e.entrePisos, { medio, alto });
  if (e.cobertizo) extras.cobertizo = cobertizo(G, e.cobertizo, { y0, yPie, P, medio, terreno: e.terreno });
  if (e.ala) extras.ala = alaBaja(G, e.ala, { y0, yPie, P, medio, alto, ventanas: e.ventanas, zocalo: !!e.zocalo });
  if (alto && e.tornapuntas) {
    const TP = e.tornapuntas;
    // bajo el alero del techo (solo en los lados largos: en los hastiales lo hacen las tablas) y bajo el alero corrido
    for (const F of marcos.filter(esLargo)) {
      if (TP.techo) for (let s_ = TP.paso / 2; s_ < F.L; s_ += TP.paso) tornapunta(G, F, s_, ySofMuro - 0.75 * v * tan, 0.75 * v);
      if (e.entrePisos) for (const k of e.entrePisos.pisos) { const ve = e.entrePisos.vuelo, te = Math.tan(e.entrePisos.pendiente * rad); for (let s_ = TP.paso / 2; s_ < F.L; s_ += TP.paso) tornapunta(G, F, s_, losa(k) + 0.05 + ve * 0.25 * te - (e.entrePisos.espesor ?? 0.12), 0.75 * ve); }
    }
    // en el hastial (bloques de Luis Bonilla, Gonzalo Crance): dos bajo el alero volado de cada extremo
    if (TP.hastial && T.forma === 'dos aguas') for (const F of marcos.filter((x) => !esLargo(x))) for (const f_ of [0.2, 0.8]) tornapunta(G, F, f_ * F.L, yMuro - 0.1, 0.75 * (T.vueloHastial ?? v));
  }
  if (alto && e.zocalo) for (const F of marcos) for (let s_ = e.zocalo.paso / 2; s_ < F.L - 0.3; s_ += e.zocalo.paso) {
    const Z = e.zocalo, y1 = losa(0) - 0.1, yb = Math.max(y0 + 0.05, y1 - Z.alto);
    if (y1 - yb > 0.1) G.quad(Z.parte ?? 'servicio', F.p(s_ - Z.ancho / 2, 0.012, yb), F.p(s_ + Z.ancho / 2, 0.012, yb), F.p(s_ + Z.ancho / 2, 0.012, y1), F.p(s_ - Z.ancho / 2, 0.012, y1), [F.n[0], 0, F.n[1]]);
  }
  return { G, P, cumbrera: Math.max(cumbrera, extras.hastial?.pico ?? -Infinity, extras.ala?.cumbrera ?? -Infinity), cumbreraTecho: cumbrera, forma: T.forma, yMuro, juntas, extras };
}

/** Tornapunta de madera bajo un alero (bloques de Gonzalo Crance y Luis Bonilla, naves): un brazo horizontal pegado al sofito, de `vuelo` m
 *  desde el muro, y el puntal inclinado que baja al muro 0,8 · vuelo más abajo. Sección de 0,10 m SUPUESTA. */
function tornapunta(G, F, s, ySof, vuelo, w = 0.1) {
  prisma(G, 'madera', F, s - w / 2, s + w / 2, [[0, ySof - w], [vuelo, ySof - w], [vuelo, ySof], [0, ySof]]);
  const yb = ySof - 0.8 * vuelo, k = w * 1.4;
  prisma(G, 'madera', F, s - w / 2, s + w / 2, [[0, yb], [vuelo * 0.85 - k, ySof - w], [vuelo * 0.85, ySof - w], [0, yb + k]]);
}
/** Alero corrido de lámina alrededor del bloque, sobre la losa yL (Gonzalo Crance: «alero corrido entre los dos pisos»): faldón inclinado
 *  de `vuelo` m con `pendiente`, su cara de abajo de madera oscura y la tabla de borde. No es la mediagua del 106 (sin ménsulas ni viguetas). */
function aleroCorrido(G, P, marcos, yL, A, { medio }) {
  const v = A.vuelo, tn = Math.tan(A.pendiente * rad), O = desplazar(P, v), esp = A.espesor ?? 0.12, yW = yL + 0.05 + v * tn, yB = yL + 0.05;
  anillo(G, P, O, yW + esp, yB + esp, 'teja', [0, 1, 0]);
  if (!medio) return;
  anillo(G, P, O, yW, yB, 'madera', [0, -1, 0]);
  faja(G, desplazar(P, v + 0.005), yB - 0.03, yB + esp, 'madera');
}
/** Cuerpo bajo de un piso adosado al bloque (Gonzalo Crance): muros del rectángulo A.muros de y0 a A.alto, ventanas de aluminio en las
 *  caras que no tocan el bloque, techo a cuatro aguas de lámina con su sofito y tabla de borde, y tornapuntas bajo el alero. */
function alaBaja(G, A, { y0, yPie, P, medio, alto, ventanas, zocalo }) {
  const R = simplificar(A.muros), marcos = R.map((p, i) => marco(p, R[(i + 1) % R.length])), yM = y0 + A.alto, T = A.techo, v = T.vuelo, tn = Math.tan(T.pendiente * rad);
  const c = centro(P), toca = (F) => { const m = F.p(F.L / 2, 0.3, 0); return dentro2(P, m[0], m[2]); };
  for (const F of marcos) G.quad('muro', F.p(0, 0, yPie - 0.3), F.p(F.L, 0, yPie - 0.3), F.p(F.L, 0, yM), F.p(0, 0, yM), [F.n[0], 0, F.n[1]]);
  if (medio && !zocalo) faja(G, desplazar(R, 0.02), yPie - 0.3, y0 + Math.max(A.base, 0.05), 'piso');
  if (medio && A.ventanas) for (const F of marcos) { if (toca(F)) continue; const W_ = A.ventanas, n = W_.una ? 1 : Math.max(1, Math.round(F.L / W_.paso)); for (let i = 0; i < n; i++) { const sc = (i + 0.5) * F.L / n, yt = y0 + A.base + W_.dintel; ventanaAluminio(G, F, sc - W_.ancho / 2, sc + W_.ancho / 2, yt - W_.alto, yt, ventanas ?? W_, { alto, tipo: null, reja: false, caja: true }); } }
  const O = desplazar(R, v), ySof = yM - v * tn, esp = T.espesor ?? 0.12;
  const cumbrera = techo(G, O, ySof + esp, T.pendiente, 'teja');
  if (medio) { anillo(G, R, O, yM, ySof, 'madera', [0, -1, 0]); faja(G, desplazar(R, v + 0.005), ySof - 0.05, ySof + esp, 'madera'); }
  if (alto && A.tornapuntas) for (const F of marcos) { if (toca(F)) continue; for (let s_ = A.tornapuntas / 2; s_ < F.L; s_ += A.tornapuntas) tornapunta(G, F, s_, yM - 0.75 * v * tn, 0.75 * v); }
  return { cumbrera, alto: r3(yM - y0) };
}
/** Cochera de lámina sobre columnas (área 900, pulido): techo plano de C.espesor m sobre el rectángulo C.muros a C.alto m del suelo, de la
 *  parte C.parte (la lámina roja o azul), con su cara de abajo de madera oscura, columnas de C.columna m en las esquinas que no tocan la casa y
 *  el piso de concreto sobre el terreno de la escena. */
function cobertizo(G, C, { y0, yPie, P, medio, terreno }) {
  const R = simplificar(C.muros), marcos = R.map((p, i) => marco(p, R[(i + 1) % R.length])), yT = y0 + C.alto, e = C.espesor, cw = C.columna;
  const triR = ShapeUtils.triangulateShape(R.map((p) => new Vector2(p[0], p[1])), []);
  for (const [a, b, c] of triR) G.tri(C.parte, [R[a][0], yT + e, R[a][1]], [R[b][0], yT + e, R[b][1]], [R[c][0], yT + e, R[c][1]], [0, 1, 0]);
  if (medio) for (const [a, b, c] of triR) G.tri('madera', [R[a][0], yT, R[a][1]], [R[b][0], yT, R[b][1]], [R[c][0], yT, R[c][1]], [0, -1, 0]);
  faja(G, R, yT, yT + e, 'madera');
  // columnas en las esquinas que quedan fuera de la casa (a más de 0,5 m de su huella)
  const cerca = (q) => dentro2(P, q[0], q[1]) || P.some((a, i) => { const b = P[(i + 1) % P.length], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dz) < 0.5; });
  for (let i = 0; i < R.length; i++) {
    if (cerca(R[i])) continue;
    // la esquina R[i] es el inicio del marco F (R antihorario): la columna va adentro de las dos caras (o > 0 hacia adentro)
    const F = marcos[i], Fq = { p: (s_, o, y) => [R[i][0] + F.d[0] * s_ - F.n[0] * o, y, R[i][1] + F.d[1] * s_ - F.n[1] * o] };
    G.caja('moldura', Fq, 0.05, 0.05 + cw, 0.05, 0.05 + cw, yPie, yT, { arriba: false });
  }
  if (medio && terreno) for (const [a, b, c] of triR) { const Y = (p) => [p[0], terreno(p[0], p[1]) + 0.05, p[1]]; G.tri('piso', Y(R[a]), Y(R[b]), Y(R[c]), [0, 1, 0]); }
  return { alto: r3(C.alto) };
}
const dentro2 = (P, x, z) => { let c = false; for (let i = 0, k = P.length - 1; i < P.length; k = i++) { const [xi, zi] = P[i], [xk, zk] = P[k]; if ((zi > z) !== (zk > z) && x < (xk - xi) * (z - zi) / (zk - zi) + xi) c = !c; } return c; };
/** Galera o kiosco abierto: postes cuadrados en las esquinas y cada A.paso m a lo largo de cada lado (del pie al alero), el cielo del techo
 *  de madera oscura, y si el dato lo pide un murete bajo con una entrada al centro de cada lado largo y bancas de madera adentro. */
function galeraAbierta(G, marcos, A, { y0, yPie, yMuro, FL, L, W, medio, alto }) {
  const pw = A.poste;
  for (const F of marcos) { const n = Math.max(1, Math.round(F.L / A.paso)); for (let i = 0; i < n; i++) { const s_ = Math.min(Math.max(i * F.L / n, pw / 2), F.L - pw / 2); G.caja(A.parte ?? 'muro', F, s_ - pw / 2, s_ + pw / 2, -pw, 0, yPie - 0.3, yMuro, { arriba: false }); } }
  G.quad('madera', FL.p(0, 0, yMuro), FL.p(L, 0, yMuro), FL.p(L, -W, yMuro), FL.p(0, -W, yMuro), [0, -1, 0]);
  if (medio && A.murete) for (const F of marcos) {
    const largo = F.L >= Math.max(...marcos.map((x) => x.L)) - 1e-6, m0 = largo ? F.L / 2 - 1.0 : F.L, h = y0 + A.murete;
    for (const [a, b] of largo ? [[pw, m0], [m0 + 2.0, F.L - pw]] : [[pw, F.L - pw]]) G.caja('muro', F, a, b, -0.15, 0, yPie - 0.3, h);
  }
  if (alto && A.bancas) for (const F of marcos.filter((x) => x.L >= Math.max(...marcos.map((y) => y.L)) - 1e-6))
    G.caja('madera', F, 0.8, F.L - 0.8, -pw - 0.5, -pw - 0.1, y0 + 0.4, y0 + 0.45, { abajo: true });
}
/** Techo plano (losa con canto) o a una agua (sube desde el lado largo de referencia hasta el opuesto) sobre el rectángulo P con vuelo v. */
function techoPlanoOUnAgua(G, { P, FL, W, L, marcos, v, tan, esp, yMuro, medio, cerrado, parteTeja = 'teja' }) {
  const yA = yMuro, yB = yMuro + (W + 2 * v) * tan, h = (o) => yA + (o + v) * tan;   // o: hacia adentro desde el borde de FL (0 en el muro)
  const q = (s_, o, dy) => FL.p(s_, -o, h(o) + dy);
  G.quad(parteTeja, q(-v, -v, esp), q(L + v, -v, esp), q(L + v, W + v, esp), q(-v, W + v, esp), [0, 1, 0]);
  if (medio || !cerrado) G.quad('madera', q(-v, -v, 0), q(L + v, -v, 0), q(L + v, W + v, 0), q(-v, W + v, 0), [0, -1, 0]);
  // cantos de la losa en los cuatro bordes
  for (const [a, b, nn] of [[[-v, -v], [L + v, -v], FL.n], [[L + v, W + v], [-v, W + v], FL.n.map((x) => -x)], [[-v, W + v], [-v, -v], FL.d.map((x) => -x)], [[L + v, -v], [L + v, W + v], FL.d]])
    G.quad('madera', q(a[0], a[1], 0), q(b[0], b[1], 0), q(b[0], b[1], esp), q(a[0], a[1], esp), [nn[0], 0, nn[1]]);
  // a una agua y cerrado: los muros de los lados cortos suben bajo el faldón (dos triángulos-trapecio)
  if (cerrado && tan > 0) {
    for (const s_ of [0, L]) G.quad('muro', FL.p(s_, 0, yMuro), FL.p(s_, -W, yMuro), FL.p(s_, -W, h(W)), FL.p(s_, 0, h(0)), [(s_ ? 1 : -1) * FL.d[0], 0, (s_ ? 1 : -1) * FL.d[1]]);
    for (const [o, nn] of [[0, FL.n], [W, FL.n.map((x) => -x)]]) G.quad('muro', FL.p(0, -o, yMuro), FL.p(L, -o, yMuro), FL.p(L, -o, h(o)), FL.p(0, -o, h(o)), [nn[0], 0, nn[1]]);
  }
  return Math.max(yA, yB) + esp;
}

/**
 * Edificio contemporáneo o torre del kit (fase 3, paso 5): un juego de piezas armado sobre la huella
 * de OSM, cualquier polígono simple (no hace falta que sea rectángulo ni convexo). Piezas por dato (ciudad-datos.mjs), todas opcionales:
 *   poly, y0, yPie, alto (del suelo al techo plano), pisos, detalle;
 *   muro: parte de los muros ('muro' o 'vidrio', muro cortina);
 *   plantaBaja: { alto, retiro } (planta baja vidriada retirada bajo el volumen de arriba, con columnas en la línea de la fachada);
 *   bandas: { antepecho, alto } (una banda de vidrio por piso en cada lado de más de 3 m);
 *   piel: { paso, sale, alto, parte, minLado, desde } (lamas horizontales delante de la fachada, de punta a punta de cada lado largo);
 *   visera: { vuelo, espesor } (losa del techo volada) o pretil: { alto };
 *   balcones: { sale, minLado, baranda } (losa volada y baranda de vidrio en cada piso desde el segundo, en los lados largos);
 *   mansarda: { alto, retiro } (faldón perimetral de teja, Centro de Convenciones); columnas: { paso, ancho } (blancas delante del muro).
 * Las partes y los materiales son los del 106 (muro, moldura, vidrio, celosía metálica, teja, el concreto de la entrada para el techo).
 * Devuelve { G, P, cumbrera, forma, yMuro, juntas, extras } como cuartel().
 */
export function contemporaneo(e) {
  const P = simplificar(e.poly), alto = e.detalle === 'alto', medio = e.detalle !== 'lejos';
  const y0 = e.y0, yPie = e.yPie - 0.3, yTop = y0 + e.alto, n = e.pisos, hp = (yTop - y0) / n;
  const marcos = P.map((A, i) => marco(A, P[(i + 1) % P.length])), largoMax = Math.max(...marcos.map((F) => F.L));
  const G = new Geo(medio ? [r3(yTop)] : []);
  const PB = e.plantaBaja, yPB = PB ? y0 + PB.alto : y0, parteMuro = e.muro ?? 'muro';
  // con mansarda, el muro llega al pie del faldón (pulido: antes subía hasta el techo y tapaba el faldón)
  const yMuroTop = e.mansarda ? yTop - e.mansarda.alto : yTop;
  // muros (y, con planta baja retirada, el volumen de arriba desde yPB y la planta baja de vidrio adentro)
  for (const F of marcos) G.quad(parteMuro, F.p(0, 0, PB ? yPB : yPie), F.p(F.L, 0, PB ? yPB : yPie), F.p(F.L, 0, yMuroTop), F.p(0, 0, yMuroTop), [F.n[0], 0, F.n[1]]);
  if (PB) {
    const Pi = desplazar(P, -PB.retiro), Mi = Pi.map((A, i) => marco(A, Pi[(i + 1) % Pi.length]));
    for (const F of Mi) G.quad('vidrio', F.p(0, 0, yPie), F.p(F.L, 0, yPie), F.p(F.L, 0, yPB), F.p(0, 0, yPB), [F.n[0], 0, F.n[1]]);
    anillo(G, Pi, P, yPB, yPB, 'moldura', [0, -1, 0]);
    // columnas en la línea de la fachada: en cada vértice y cada ~6 m
    for (const F of marcos) { const k = Math.max(1, Math.round(F.L / 6)); for (let i = 0; i < k; i++) { const s_ = Math.max(0.2, i * F.L / k); G.caja('muro', F, s_ - 0.2, s_ + 0.2, -0.4, 0, yPie, yPB, { arriba: false }); } }
  }
  // techo plano: losa sobre la huella (o la visera volada) con el concreto de la entrada del 106
  const V = e.visera, Ot = V ? desplazar(P, V.vuelo) : P, esp = V?.espesor ?? 0.3;
  const M = e.mansarda, Pt = M ? desplazar(P, -M.retiro) : Ot, yT2 = yTop + (V ? esp : 0);
  const triT = ShapeUtils.triangulateShape(Pt.map((p) => new Vector2(p[0], p[1])), []);
  for (const [a, b, c] of triT) G.tri('piso', [Pt[a][0], yT2, Pt[a][1]], [Pt[b][0], yT2, Pt[b][1]], [Pt[c][0], yT2, Pt[c][1]], [0, 1, 0]);
  // faldón de teja tipo mansarda: del borde volado M.vuelo afuera del muro, al pie, hasta el techo plano retirado M.retiro; con su cara de
  // abajo (el sofito) de madera oscura
  if (M) { const Mv = desplazar(P, M.vuelo ?? 0); anillo(G, Mv, Pt, yTop - M.alto, yTop, 'teja', [0, 1, 0]); if (M.vuelo) anillo(G, P, Mv, yTop - M.alto, yTop - M.alto, 'madera', [0, -1, 0]); }
  if (V) { faja(G, Ot, yTop, yT2, 'moldura'); if (medio) anillo(G, P, Ot, yTop, yTop, 'moldura', [0, -1, 0]); }
  let cumbrera = yT2;
  if (e.pretil && medio) { faja(G, desplazar(P, 0.01), yTop, yTop + e.pretil.alto, 'muro'); faja(G, desplazar(P, -0.2).reverse(), yTop, yTop + e.pretil.alto, 'muro'); anillo(G, desplazar(P, -0.2), P, yTop + e.pretil.alto, yTop + e.pretil.alto, 'muro', [0, 1, 0]); cumbrera = Math.max(cumbrera, yTop + e.pretil.alto); }
  if (!medio) return { G, P, cumbrera, cumbreraTecho: cumbrera, forma: 'plano', yMuro: yTop, juntas: [r3(yTop)], extras: {} };
  // bandas de vidrio por piso, con parteluces cada 1,5 m en detalle alto
  const B = e.bandas, k0 = PB ? 1 : 0;
  if (B) for (const F of marcos) { if (F.L < 3) continue; const fuera = [F.n[0], 0, F.n[1]], o = alto ? 0.012 : 0.06;
    for (let k = k0; k < n; k++) { const yb = y0 + k * hp + B.antepecho, yt = Math.min(yb + B.alto, y0 + (k + 1) * hp - 0.3);
      G.quad('vidrio', F.p(0.4, o, yb), F.p(F.L - 0.4, o, yb), F.p(F.L - 0.4, o, yt), F.p(0.4, o, yt), fuera);
      if (alto) for (let s_ = 0.4 + 1.5; s_ < F.L - 0.6; s_ += 1.5) G.caja('moldura', F, s_ - 0.03, s_ + 0.03, 0, 0.05, yb, yt, { atras: false, arriba: false }); } }
  // piel de lamas metálicas horizontales: una lámina por lama de punta a punta del lado (cara de afuera y de abajo)
  const L_ = e.piel;
  if (L_) for (const F of marcos) { if (F.L < (L_.minLado ?? 4)) continue; const fuera = [F.n[0], 0, F.n[1]];
    for (let y = y0 + (L_.desde ?? (PB ? PB.alto : 0.5)) + L_.paso / 2; y < yTop - 0.2; y += L_.paso) {
      G.quad(L_.parte ?? 'celosia', F.p(0, L_.sale, y - L_.alto), F.p(F.L, L_.sale, y - L_.alto), F.p(F.L, L_.sale, y), F.p(0, L_.sale, y), fuera);
      G.quad(L_.parte ?? 'celosia', F.p(0, 0, y - L_.alto), F.p(F.L, 0, y - L_.alto), F.p(F.L, L_.sale, y - L_.alto), F.p(0, L_.sale, y - L_.alto), [0, -1, 0]);
    } }
  // balcones de las torres: losa volada y baranda en cada piso desde el segundo, en los lados largos
  const BA = e.balcones;
  if (BA) for (const F of marcos) { if (F.L < (BA.minLado ?? 0.6 * largoMax)) continue; const fuera = [F.n[0], 0, F.n[1]];
    for (let k = 1; k < n; k++) { const y = y0 + k * hp;
      G.caja('moldura', F, 0.3, F.L - 0.3, 0, BA.sale, y - 0.15, y, { atras: false, abajo: true });
      G.quad(BA.baranda ?? 'vidrio', F.p(0.3, BA.sale, y), F.p(F.L - 0.3, BA.sale, y), F.p(F.L - 0.3, BA.sale, y + 1.0), F.p(0.3, BA.sale, y + 1.0), fuera);
      if (alto) G.caja('moldura', F, 0.3, F.L - 0.3, BA.sale - 0.05, BA.sale + 0.02, y + 1.0, y + 1.05, { atras: false }); } }
  // columnas blancas delante del muro (Centro de Convenciones: vidrio oscuro entre columnas blancas)
  const C = e.columnas;
  if (C) for (const F of marcos) { const k = Math.max(1, Math.round(F.L / C.paso)); for (let i = 0; i <= k; i++) { const s_ = Math.min(Math.max(i * F.L / k, C.ancho / 2), F.L - C.ancho / 2); G.caja('muro', F, s_ - C.ancho / 2, s_ + C.ancho / 2, 0, C.ancho, yPie, yTop - (M ? M.alto : 0), { atras: false }); } }
  return { G, P, cumbrera, cumbreraTecho: cumbrera, forma: 'plano', yMuro: yTop, juntas: [r3(yTop)], extras: { pisos: n } };
}

/** Estacionamiento de OSM (pulido): el asfalto sobre los pedazos de terreno de pedazosTerreno() (ciudad-datos.mjs), cada uno a `h` m sobre el
 *  suelo de la escena (exacto: cada pedazo cae en un solo plano del terreno). Mismo resultado en los tres niveles; sin juntas. */
/** Techo de una caja gris (pulido, panel): una tapa plana sobre el polígono P a la altura y, en la parte dada (el color del techo
 *  observado). La caja sigue en contexto.glb; la tapa va en ciudad.glb y solo se ve con la ciudad. */
export function techoDeCaja({ poly, y, parte }) {
  const G = new Geo([]), Q = area2(poly) < 0 ? [...poly].reverse() : poly;
  const T = ShapeUtils.triangulateShape(Q.map((p) => new Vector2(p[0], p[1])), []);
  for (const [a, b, c] of T) G.tri(parte, [Q[a][0], y, Q[a][1]], [Q[b][0], y, Q[b][1]], [Q[c][0], y, Q[c][1]], [0, 1, 0]);
  return { G };
}
export function estacionamiento({ pedazos, suelo, h = 0.02 }) {
  const G = new Geo([]);
  for (const Q of pedazos) {
    const T = ShapeUtils.triangulateShape(Q.map((p) => new Vector2(p[0], p[1])), []), y = (p) => [p[0], suelo(p) + h, p[1]];
    for (const [a, b, c] of T) G.tri('asfalto', y(Q[a]), y(Q[b]), y(Q[c]), [0, 1, 0]);
  }
  return { G };
}
