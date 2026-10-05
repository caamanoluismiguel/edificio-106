// Generador de la ciudad (fase 3 del plan de Ciudad del Saber, rama feat/ciudad). Determinista, como contexto.mjs.
//
//   cd fuente && node ciudad.mjs      escribe ../modelo/ciudad.glb, ../modelo/ciudad_alto.glb y ../docs/ciudad/edificios.json
//
// Datos: ciudad-datos.mjs (inventario.json + ciudad-observado.json + ciudad-ajustes.json). Geometría: el kit de ciudad-kit.mjs, con
// las medidas del 106 de main. Cada edificio del kit es un nodo con tres niveles de detalle (alto, medio y lejos); cada nivel es
// una malla con una primitiva por parte. El detalle alto va en un archivo aparte (ciudad_alto.glb, el grueso de los bytes): un
// teléfono que no es de gama alta no lo pide y de cerca se queda con el medio y el material del 106 de esa parte (la escena lo pinta con escena.js #material, vía
// src/ciudad.js, y arma un BatchedMesh por parte con el nivel elegido por instancia). Los demás edificios no se tocan: siguen en
// contexto.glb (cajas grises, la copia reducida del 106 o los volúmenes a mano).
// El archivo semántico (lo que se sabe de cada edificio y de dónde sale) es docs/ciudad/edificios.json; el GLB solo dibuja.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, quantize, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { MED, KIT, PARTE, SOLO_CERCA, cuartel, duplex, casa, contemporaneo, centro, estacionamiento, techoDeCaja, triangulos } from './ciudad-kit.mjs';
import { datosCiudad, TINTE, SOPORTADAS, CASAS, PLANOS, suelo, aReg, pedazosTerreno, enElSitio } from './ciudad-datos.mjs';
import { osmRegistrado } from './contexto-osm.mjs';
import { entornoRegistrado } from './entorno-osm.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(AQUI, '..', 'modelo', 'ciudad.glb'), SALIDA_ALTO = path.join(AQUI, '..', 'modelo', 'ciudad_alto.glb');
const SEMANTICO = path.join(AQUI, '..', 'docs', 'ciudad', 'edificios.json');
const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;
// distancias de la cámara al centro del edificio para cada nivel de detalle (las aplica src/ciudad.js; quedan en el GLB)
const LOD = { alto: 150, medio: 400, cerca: 60 };
// detalle alto de las casas bajas a menos de 100 m (recorte de WebGL 2 aprobado por LM, 4 oct 2026); va por edificio en sus extras
const LOD_ALTO_CASAS = 100;
// lo mismo para el dúplex y las casas de oficiales, y su teja en canales y los balaustres solo a menos de LOD.cerca (pulido, LM 5 oct 2026)
const LOD_ALTO_DUPLEX = 100;
// --huellas=<archivo.json>: además, la huella (sha1 de posiciones y normales al mm) de cada parte de cada edificio en cada nivel, para
// comparar pieza por pieza contra otra corrida (que una tipología que no se tocó salga igual)
const ARG_HUELLAS = process.argv.find((a) => a.startsWith('--huellas='))?.slice(10), HUELLAS = ARG_HUELLAS ? {} : null;
const huellaPartes = (G) => Object.fromEntries(Object.entries(G.partes).map(([k, g]) => [k, crypto.createHash('sha1').update(Float32Array.from([...g.p, ...g.n], (x) => Math.round(x * 1000) / 1000)).digest('hex').slice(0, 16)]));

await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const D = datosCiudad();
const kit = D.filter((e) => e.modelo === 'kit');
const osm = osmRegistrado(), ent = entornoRegistrado();
const polyOSM = (id) => osm.edificios.find((b) => b.id === id)?.poly ?? ent.edificios.find((b) => b.id === id)?.poly;

// ---------------- documentos: medio y lejos en ciudad.glb, alto en ciudad_alto.glb ----------------
function documento() {
  const doc = new Document(), buf = doc.createBuffer();
  const MATS = Object.fromEntries(Object.entries(MED.materiales).map(([parte, m]) => [parte, doc.createMaterial(m.nombre)
    .setBaseColorFactor(m.color).setRoughnessFactor(m.rugosidad).setMetallicFactor(m.metalicidad).setExtras({ ...m.extras, ciudadParte: parte })]));
  const malla = (nombre, G, c) => {
    const mesh = doc.createMesh(nombre);
    for (const parte of Object.keys(PARTE)) {
      const g = G.partes[parte]; if (!g) continue;
      const p = Float32Array.from(g.p); for (let i = 0; i < p.length; i += 3) { p[i] -= c[0]; p[i + 1] -= c[1]; p[i + 2] -= c[2]; }
      const pr = doc.createPrimitive().setMaterial(MATS[parte])
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(p).setBuffer(buf))
        .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(Float32Array.from(g.n)).setBuffer(buf));
      // muro: distancia al encuentro muro-alero de encima (sustituto de oclusión de escena.js), en m
      if (parte === 'muro') pr.setAttribute('_AOH', doc.createAccessor().setType('SCALAR').setArray(Float32Array.from(g.a)).setBuffer(buf));
      mesh.addPrimitive(pr);
    }
    return mesh;
  };
  const raiz = doc.createNode('ciudad'); doc.createScene().addChild(raiz);
  return { doc, malla, raiz };
}
async function escribir({ doc }, archivo) {
  await doc.transform(weld({ tolerance: 0.0001 }), prune(),
    quantize({ pattern: /^(POSITION|NORMAL)$/, quantizePosition: 16, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await io.write(archivo, doc);
  return fs.statSync(archivo).size / 1024;
}
const M = documento(), A = documento();
const resumen = [];
const tris = { alto: 0, medio: 0, lejos: 0 };
for (const e of kit) {
  const P = e.parametros, v = (k) => P[k]?.valor;
  const dup = e.tipologia === 'duplex' || e.tipologia === 'oficiales41', esCasa = CASAS.includes(e.tipologia), plano = PLANOS.includes(e.tipologia);
  // las casas de oficiales salen de duplex(); las casas bajas, los bloques de dos pisos, las naves y los kioscos, de casa(); los
  // contemporáneos y las torres, de contemporaneo()
  const armar = plano ? contemporaneo : esCasa ? casa : dup ? duplex : cuartel;
  const base = plano
    ? { poly: e.poly, y0: e.suelo.y0, yPie: e.suelo.y0, ...Object.fromEntries(['alto', 'pisos', 'muro', 'plantaBaja', 'bandas', 'piel', 'visera', 'pretil', 'balcones', 'mansarda', 'columnas'].map((k) => [k, v(k)])) }
    : esCasa
    ? { poly: e.poly, y0: e.suelo.y0, yPie: e.suelo.yPie ?? e.suelo.y0, terreno: (x, z) => suelo([x, z]), ...Object.fromEntries(['base', 'pisos', 'techo', 'ventanas', 'puertas', 'cochera', 'faldon', 'arcada', 'escaleras', 'tablas', 'ala', 'tornapuntas', 'zocalo', 'abierto', 'cobertizo'].map((k) => [k, v(k)])), entrePisos: v('entre_pisos') }
    : dup
    ? { poly: e.poly, y0: e.suelo.y0, yPie: e.suelo.y0, basamento: v('basamento'), losa: v('losa'), alturas: v('alturas'), mediaguas: v('mediaguas'),
      vuelo: v('vuelo'), techo: v('techo'), bahias: v('bahias'), ventanas: v('ventanas'), planta: v('planta_baja'), mensulas: v('mensulas'),
      pilastras: v('pilastras'), alero: v('alero'), muroBajo: v('muro_bajo'), terreno: (x, z) => suelo([x, z]) }
    : { poly: e.poly, y0: e.suelo.y0, yPie: e.suelo.y0, pisos: v('pisos'), basamento: v('basamento'), mediaguas: v('mediaguas'),
      servicio: v('servicio'), techo: v('techo'), ventanas: v('ventanas'), mensulas: v('mensulas'), rejilla: v('rejilla'),
      pabellones: v('pabellones'), hastial: v('hastial'), mediagua: v('mediagua'), alero: v('alero') };
  const c0 = centro(e.poly), c = [r3(c0[0]), r3(e.suelo.y0), r3(c0[1])];
  const nombre = `${e.numero ?? 's/n'} · ${e.tipologia} (OSM ${e.osm_id})`;
  const extras = { osm: e.osm_id, numero: e.numero, tipologia: e.tipologia, clase: e.clase_certeza,
    tinte: { muro: P.color_muros.tinte, teja: P.color_techo.tinte }, sombra: true, ...(esCasa ? { lodAlto: LOD_ALTO_CASAS } : dup ? { lodAlto: LOD_ALTO_DUPLEX } : {}) };
  const n = M.doc.createNode(nombre).setTranslation(c).setExtras(extras), nA = A.doc.createNode(nombre).setTranslation(c).setExtras(extras);
  const niveles = {};
  for (const d of ['alto', 'medio', 'lejos']) {
    const r = armar({ ...base, detalle: d }), D_ = d === 'alto' ? A : M;
    (d === 'alto' ? nA : n).addChild(D_.doc.createNode(d).setMesh(D_.malla(`${e.osm_id} ${d}`, r.G, c)).setExtras({ lod: d }));
    niveles[d] = r; tris[d] += r.G.triangulos;
  }
  const r = niveles.alto;
  e.resultado = { muro: r3(r.yMuro - e.suelo.y0), cumbrera: r3(r.cumbrera - e.suelo.y0), techo: r.forma, juntas: r.juntas.map((j) => r3(j - e.suelo.y0)),
    triangulos: Object.fromEntries(Object.entries(niveles).map(([k, x]) => [k, x.G.triangulos])) };
  M.raiz.addChild(n); A.raiz.addChild(nA);
  resumen.push(e);
  if (HUELLAS) HUELLAS[e.osm_id] = { tipologia: e.tipologia, ...Object.fromEntries(Object.entries(niveles).map(([d, x]) => [d, huellaPartes(x.G)])) };
}
// ---------------- techos de las cajas grises (panel, 5 oct 2026): tapa con el color observado, solo con la bandera (en ciudad.glb) ----------------
// La caja sigue en contexto.glb (main, sin tocar). La tapa va 3 cm sobre su cara de arriba, que se lee en contexto.glb: las caras que miran
// arriba del material de maqueta con el centro dentro de la huella. Clase «fuera» (no es I, II ni III: no es un edificio del kit).
const dentro = (P, [x, z]) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
const tapasMaqueta = (await triangulos('contexto', /massing model/)).filter((t) => t.n[1] > 0.99);
const cajas = [];
for (const e of D.filter((x) => x.techo_caja?.valor)) {
  const P = polyOSM(e.osm_id);
  const ys = P ? tapasMaqueta.filter((t) => dentro(P, [(t.v[0][0] + t.v[1][0] + t.v[2][0]) / 3, (t.v[0][2] + t.v[1][2] + t.v[2][2]) / 3])).map((t) => t.y) : [];
  if (!ys.length) { e.techo_caja = { ...e.techo_caja, dibujado: false, razon: 'no se encontró la cara de arriba de su caja en contexto.glb' }; continue; }
  const y = Math.max(...ys) + 0.03, c0 = centro(P), c = [r3(c0[0]), r3(y), r3(c0[1])], Q = P.map((p) => p.map(r3));
  const r = techoDeCaja({ poly: Q, y, parte: e.techo_caja.valor.parte });
  const extras = { osm: e.osm_id, numero: e.numero, tipologia: 'techo de caja', clase: 'fuera', certeza: e.clase_certeza, tinte: { muro: [1, 1, 1], teja: e.techo_caja.valor.tinte }, sombra: true };
  const n = M.doc.createNode(`${e.numero ?? 's/n'} · techo de caja (OSM ${e.osm_id})`).setTranslation(c).setExtras(extras);
  for (const d of ['medio', 'lejos']) { n.addChild(M.doc.createNode(d).setMesh(M.malla(`${e.osm_id} techo ${d}`, r.G, c)).setExtras({ lod: d })); tris[d] += r.G.triangulos ?? 0; }
  M.raiz.addChild(n);
  e.techo_caja = { ...e.techo_caja, dibujado: true, y: r3(y) };
  cajas.push(e.osm_id);
  if (HUELLAS) HUELLAS['caja ' + e.osm_id] = { tipologia: 'techo de caja', medio: huellaPartes(r.G), lejos: huellaPartes(r.G) };
}
// ---------------- estacionamientos de OSM (pulido): asfalto sobre el terreno, solo con la bandera (van en ciudad.glb) ----------------
// fuente/osm-estacionamientos.json (Overpass, 5 oct 2026: amenity=parking en la caja de osm-amplio.json). Los accesos y los pasillos
// (highway=service, driveway, parking_aisle) ya los dibuja contexto.mjs como cintas de 4 m con este mismo material. Fuera quedan los que tocan
// el sitio del 106 (ahí están los dos estacionamientos medidos de contexto.mjs, sobre el suelo de sitio.glb).
const EST = JSON.parse(fs.readFileSync(path.join(AQUI, 'osm-estacionamientos.json'), 'utf8'));
const estac = [];
// fuera por revisión (panel, 5 oct 2026): lo que OSM marca como estacionamiento pero no lo es en la vista aérea
const ESTAC_FUERA = { 1281824089: 'parking=street_side: en la vista aérea (Esri World Imagery, solo mirada) el polígono cubre la calzada de la calle frente a los cuarteles del norte, que contexto.mjs ya dibuja; los autos se estacionan a la orilla sur, fuera de él. No es un estacionamiento: se quita' };
for (const el of EST.elements) {
  const anillos = el.type === 'way' ? [el.geometry] : (el.members ?? []).filter((m) => m.role === 'outer' && m.geometry).map((m) => m.geometry);
  anillos.forEach((g, k) => {
    let P = g.map((q) => aReg(q.lat, q.lon).map(r3));
    if (P.length > 3 && Math.hypot(P[0][0] - P.at(-1)[0], P[0][1] - P.at(-1)[1]) < 0.01) P = P.slice(0, -1);
    if (P.length < 3) return;
    const id = el.type === 'way' ? el.id : `${el.id}-${k}`;
    if (P.some(enElSitio)) { estac.push({ id, tags: el.tags, fuera: 'toca el sitio del 106 (sus estacionamientos son los de contexto.mjs)' }); return; }
    if (ESTAC_FUERA[id]) { estac.push({ id, tags: el.tags, fuera: ESTAC_FUERA[id] }); return; }
    const pedazos = pedazosTerreno(P), c0 = centro(P), c = [r3(c0[0]), r3(suelo(c0)), r3(c0[1])];
    const r = estacionamiento({ pedazos, suelo });
    const area = Math.abs(P.reduce((a, p, i) => { const q = P[(i + 1) % P.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
    const extras = { osm: id, tipologia: 'estacionamiento', clase: 'I', sombra: false };
    const n = M.doc.createNode(`estacionamiento (OSM ${id})`).setTranslation(c).setExtras(extras);
    for (const d of ['medio', 'lejos']) { n.addChild(M.doc.createNode(d).setMesh(M.malla(`${id} ${d}`, r.G, c)).setExtras({ lod: d })); tris[d] += r.G.triangulos; }
    M.raiz.addChild(n);
    estac.push({ id, tags: el.tags, area_m2: Math.round(area), pedazos: pedazos.length, triangulos: r.G.triangulos, poly: P });
    if (HUELLAS) HUELLAS['est ' + id] = { tipologia: 'estacionamiento', medio: huellaPartes(r.G), lejos: huellaPartes(r.G) };
  });
}
if (HUELLAS) { fs.writeFileSync(ARG_HUELLAS, JSON.stringify(HUELLAS) + '\n'); console.log('huellas por parte en', ARG_HUELLAS); }
// lo que la escena quita del contexto con la bandera puesta: las copias reducidas del 106 y las cajas grises de las huellas del kit
const reemplaza = {
  cuarteles: kit.filter((e) => e.en_contexto).map((e) => e.en_contexto),
  // las de los edificios del kit y las de los que dibuja otro del kit (ajuste «unir»: mitades de un mismo edificio en OSM)
  cajas: [...kit.filter((e) => !e.en_contexto), ...D.filter((e) => e.modelo === 'unido')].map((e) => ({ osm: e.osm_id, poly: polyOSM(e.osm_id).map((p) => p.map(r3)) })),
};
M.raiz.setExtras({ generadoPor: 'fuente/ciudad.mjs', datos: 'docs/ciudad/edificios.json', alto: 'ciudad_alto', lod: LOD, soloCerca: SOLO_CERCA, reemplaza,
  partes: PARTE, materiales: Object.fromEntries(Object.entries(MED.materiales).map(([k, m]) => [k, m.nombre])) });
A.raiz.setExtras({ generadoPor: 'fuente/ciudad.mjs', nivel: 'alto' });
const kb = await escribir(M, SALIDA), kbA = await escribir(A, SALIDA_ALTO);

// ---------------- archivo semántico ----------------
const cuenta = (f) => D.reduce((m, e) => { const k = f(e); m[k] = (m[k] ?? 0) + 1; return m; }, {});
fs.writeFileSync(SEMANTICO, JSON.stringify({
  generado_por: 'fuente/ciudad.mjs (datos de fuente/ciudad-datos.mjs)',
  fuentes: { geometria: 'docs/ciudad/inventario.json (OSM, Open Buildings)', observado: 'fuente/ciudad-observado.json (Street View, solo mirada; sin identificadores ni posiciones de Google)', ajustes: 'fuente/ciudad-ajustes.json', kit: 'fuente/ciudad-kit.mjs, medidas del 106 de main' },
  tipologias_kit: SOPORTADAS, tintes: TINTE, lod_m: { ...LOD, alto_casas: LOD_ALTO_CASAS, alto_duplex_y_oficiales: LOD_ALTO_DUPLEX, cerca_solo: 'teja en canales y balaustres de dúplex y oficiales' },
  modelos: cuenta((e) => e.modelo), clases: cuenta((e) => e.clase_certeza),
  kit_medidas: { piso: KIT.piso, base: KIT.base, vuelo: KIT.vuelo, techo: KIT.techo, mediagua: KIT.mediagua, modulo: KIT.modulo, fuente: 'docs/ciudad/espiga/kit-medidas.json (medir106 de ciudad-kit.mjs)' },
  glb: { archivo: 'modelo/ciudad.glb', kb: Math.round(kb), archivo_alto: 'modelo/ciudad_alto.glb', kb_alto: Math.round(kbA), triangulos: tris },
  edificios: D.map((e) => ({ ...e, poly: undefined })),
  estacionamientos: { fuente: 'fuente/osm-estacionamientos.json (' + EST.consulta + '). © colaboradores de OpenStreetMap, ODbL 1.0. Asfalto con el material de las calles de contexto.glb, 2 cm sobre el terreno de la escena', lista: estac.map((x) => ({ ...x, poly: undefined })) },
}, null, 1) + '\n');

console.log(`kit: ${kit.length} edificios (${SOPORTADAS.map((t) => `${t} ${kit.filter((e) => e.tipologia === t).length}`).join(', ')}) · triángulos alto ${tris.alto}, medio ${tris.medio}, lejos ${tris.lejos}`);
for (const e of resumen) console.log(`  ${(e.numero ?? 's/n').padEnd(4)} ${e.tipologia} clase ${e.clase_certeza} · muro ${e.resultado.muro} m · cumbrera ${e.resultado.cumbrera} m · suelo ${e.suelo.y0} (desnivel ${e.suelo.desnivel}) · ${e.resultado.triangulos.alto}/${e.resultado.triangulos.medio}/${e.resultado.triangulos.lejos}`);
console.log(`estacionamientos: ${estac.filter((x) => !x.fuera).length} (${estac.filter((x) => x.fuera).length} fuera) · techos de caja: ${cajas.length}`);
console.log('reemplaza: cuarteles', reemplaza.cuarteles.join(', '), '· cajas', reemplaza.cajas.length);
console.log('escrito', SALIDA, kb.toFixed(0), 'KB ·', SALIDA_ALTO, kbA.toFixed(0), 'KB ·', SEMANTICO);
