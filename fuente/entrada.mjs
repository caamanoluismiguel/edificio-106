// Entrada principal (fachada sureste) como en la foto WA0014: una losa de concreto a nivel bajo el pórtico, donde se apoyan
// las dos columnas, y la escalera retirada detrás de ellas, entre muretes, hasta la puerta. Trabaja sobre entrada.glb (el GLB
// web ya comprimido, o el documento de optimize2.mjs después de barandas.mjs). Paso reproducible y sin efecto si se repite:
// si la escalera ya arranca en z 13,64, no toca nada.
//
//   cd fuente && node entrada.mjs          corrige ../modelo/entrada.glb en su lugar (y luego: node intro.mjs)
//   node entrada.mjs --medir               solo describe la escalera, la losa y los pasamanos (no escribe)
//
// Coordenadas de la escena en metros (+X = noreste, +Z = sureste, Y arriba; en Blender: x = X, y = −Z, z = Y). Muro sureste
// en z 11,50; acera de 0,15 m de alto desde z 16,77.
//
// Qué había (exportación de Isthmus_v016, colección «V012 Access reconstruction»): siete peldaños de 0,16 m (x 11,05 a
// 14,55) que arrancaban en z 16,79, justo en la línea de las columnas (z 16,05 a 16,75), y subían a un porche macizo de
// 1,12 m (x 10,00 a 15,60, z 11,50 a 14,90). En la foto, desde la acera primero hay una losa plana bajo el pórtico y la
// escalera empieza detrás de las columnas, entre muretes, y llega a la puerta. Esa corrección ya estaba hecha en
// claude/Isthmus_claude_hiperrealismo.blend (claude/scripts/cl_entrance_fix.py: escalera 3,16 m atrás, primer peldaño en
// y −13,64, losa hasta la acera), pero la web se exportó de la v016 y no la tenía. De ese ajuste se toma solo la posición de
// la escalera y la losa; no se reexporta nada de ese .blend (traería de vuelta defectos ya corregidos en la web) ni se
// estrecha el pórtico (cl_entrance_fix.py también movía columnas, dintel y agregaba columnas traseras y bancas).
//
// Qué hace:
//  1. Peldaños («Pale cast concrete — entrance»): los siete se corren 3,15 m hacia el muro (primer peldaño en z 13,64, como
//     en cl_entrance_fix.py) y se reparten entre la losa (0,16) y el porche (1,12): siguen siendo siete contrahuellas, ahora
//     de 0,137 m. El peldaño superior se alarga hasta el muro (descanso de 0,41 m ante la puerta).
//  2. Porche («Warm lime-painted plaster»): el bloque macizo se recorta a los dos muretes de la escalera, a 1,12 m: oeste
//     x 10,00 a 11,05 y este x 14,55 a 14,90, de z 11,50 a 13,64 (el pie de la escalera). Al este de x 14,90 queda la
//     llegada de la rampa, que no se toca; ya no la tapa el porche y el arranque del tramo bajo (x 15,60, z 12,92 a 14,24)
//     queda abierto hacia la losa, como en la foto.
//  3. Losa nueva (malla propia «Pale cast concrete — entrance slab», mismo material): x 9,90 a 15,60 (hasta el arranque de
//     la rampa), z 12,82 a 16,77 (sigue bajo la escalera hasta la cara de la llegada de la rampa, para que entre el murete
//     este y el arranque del tramo bajo no quede un hueco de pasto),
//     de −0,05 a 0,16 m (1 cm sobre la acera y el camino de sitio.glb para que no parpadeen). Las columnas quedan sobre ella.
//  4. Pasamanos («Galvanized guardrail», x 11,10 y 14,50, ya corregidos por barandas.mjs): siguen a la escalera (3,15 m
//     atrás y la parte inclinada sube con los peldaños); arriba, el oeste termina contra el muro, como en la foto, y el este
//     en su poste superior (z 11,65), porque detrás tiene la ventana de la planta baja (x 14,34 a 16,56, vidrio 9 cm dentro
//     del muro): llevarlo al muro lo dejaría en el aire delante del vidrio. Los
//     tres postes que barandas.mjs había puesto en el porche (z 13,70, 12,60 y 13,82) quedarían dentro del edificio: se
//     quitan. Con la escalera en su sitio, barandas.mjs ya no aplica su regla 1 (la reconoce y no hace nada).
//
// En el .blend de origen (Isthmus_v016 y sucesores; en Blender y = −Z) hay que hacer lo mismo:
//  · «Entrance stair» (siete peldaños): y + 3,15 (el primero de y −16,79 a y −13,64); alturas de 0,16 + k·0,137 m
//    (k = 1…7) sobre una losa de 0,16; el peldaño superior hasta y −11,50.
//  · «Entrance landing» (porche x 10,00 a 15,60, y −14,90 a −11,50, 1,12 m): sustituirlo por dos muretes de 1,12 m,
//    x 10,00 a 11,05 y x 14,55 a 14,90, de y −13,64 a −11,50.
//  · Losa nueva, material «Pale cast concrete — entrance»: x 9,90 a 15,60, y −16,77 a −12,82, z −0,05 a 0,16.
//  · «Porch stair handrail» y «Porch stair rail support»: y + 3,15; la parte inclinada sube con los peldaños (13,8 cm en el
//    poste de abajo, nada en el de arriba); el tramo horizontal del oeste hasta el muro (y −11,50) y el del este hasta su
//    poste superior (y −11,65); borrar los postes que queden dentro del edificio (y > −11,50).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { piezas, aplicar, comprobar, copiar, centro, tam } from './barandas.mjs';

const MURO = 11.50;              // muro sureste
const DY = 3.15;                 // cuánto se retira la escalera
const PIE0 = 16.79, PIE = PIE0 - DY;          // primer peldaño antes / después (13,64)
const LOSA = 0.16, PORCHE = 1.12;             // cara superior de la losa y del porche
const ACERA = 16.77;
const LOSA_Z0 = 12.82;                        // fondo de la losa: la cara de la llegada de la rampa (tramo alto)
const K = (PORCHE - LOSA) / PORCHE;           // escala vertical de los peldaños (0,857)
const cerca = (a, b, tol = 0.05) => Math.abs(a - b) < tol;
const f2 = (x) => x.toFixed(2);

/** Pone cada vértice de la pieza (en coordenadas del mundo) en `mover(v)`. */
function moverPieza(c, mover) {
  const A = c.p.getAttribute('POSITION');
  for (const v of c.verts) A.setElement(v, comprobar(aplicar(c.W1, mover([c.P[3 * v], c.P[3 * v + 1], c.P[3 * v + 2]])), c));
}
/** Quita los triángulos de las piezas (todas de una vez por primitiva: al quitar cambian los números de los triángulos
 *  que siguen). Los vértices quedan sin uso; son unos pocos. */
function quitar(L) {
  for (const p of new Set(L.map((c) => c.p))) {
    const ind = p.getIndices(), I = ind.getArray(), fuera = new Set(L.filter((c) => c.p === p).flatMap((c) => c.tris));
    const J = new I.constructor(I.length - fuera.size * 3); let o = 0;
    for (let t = 0; t < I.length / 3; t++) if (!fuera.has(t)) { J[o++] = I[3 * t]; J[o++] = I[3 * t + 1]; J[o++] = I[3 * t + 2]; }
    ind.setArray(J);
  }
}
/** Mueve los «bordes» de una caja biselada: cada vértice se corre según a qué lado del centro de la caja está, en cada eje.
 *  Así el bisel no se deforma. `d` = [[dmin, dmax] por eje]. */
const bordes = (c, d) => (w) => w.map((x, k) => x + (x < centro(c)[k] ? d[k][0] : d[k][1]));

/** Altura del pasamanos inclinado sobre los peldaños (antes): del poste de abajo (z 16,70, peldaño a 0,16) al de arriba
 *  (z 14,80, porche a 1,12); arriba de z 14,80, horizontal. */
const pendiente = (z) => (z <= 14.80 ? PORCHE : PORCHE - (z - 14.80) * (0.96 / 1.90));
/** Cuánto sube cada punto del pasamanos cuando los peldaños pasan a repartirse entre 0,16 y 1,12. */
const alza = (z) => LOSA * (1 - pendiente(z) / PORCHE);

/** Corrige el documento de entrada.glb en su lugar. Devuelve un resumen de lo hecho. */
export function corregirEntrada(doc) {
  const res = [];
  const H = piezas(doc, /^Pale cast concrete — entrance$/);
  // (de x 11,05 a 14,55; o de x 11,60 a 14,00 si portico.mjs ya angostó la escalera)
  const pasos = H.filter((c) => cerca(centro(c)[0], 12.80) && (cerca(tam(c)[0], 3.50) || cerca(tam(c)[0], 2.40)) && tam(c)[2] < 0.45 && tam(c)[1] > 0.1);
  if (pasos.length !== 7) throw new Error(`entrada.mjs: se esperaban 7 peldaños y hay ${pasos.length}; el modelo cambió`);
  const pie = Math.max(...pasos.map((c) => c.mx[2]));
  if (cerca(pie, PIE, 0.02)) return ['entrada: la escalera ya arranca en z ' + f2(PIE) + '; nada que corregir'];
  if (!cerca(pie, PIE0, 0.02)) throw new Error(`entrada.mjs: el primer peldaño está en z ${f2(pie)} (se esperaba ${PIE0}); el modelo cambió`);

  // 3 (antes de mover los peldaños: la losa sale del peldaño de abajo, una caja de 0 a 0,16). Malla y nodo propios: la losa
  //   sale del volumen de cuantización de la malla de concreto (x ≥ 11,05).
  const bajo = pasos.find((c) => c.mx[2] === pie);
  losa(doc, bajo);
  res.push(`losa nueva bajo el pórtico: x 9,90 a 15,60, z ${f2(LOSA_Z0)} a ${f2(ACERA)}, cara superior a ${f2(LOSA)} m`);

  // 1. peldaños
  const orden = [...pasos].sort((a, b) => b.mx[1] - a.mx[1]);         // de arriba abajo
  for (const c of orden) {
    const arriba = c === orden[0], zmin = c.mn[2];
    moverPieza(c, ([x, y, z]) => {
      let z2 = z - DY;
      if (arriba && z < zmin + 0.03) z2 += MURO - (zmin - DY);           // el peldaño superior, hasta el muro
      return [x, LOSA + y * K, z2];
    });
  }
  res.push(`escalera: 7 peldaños retirados ${f2(DY)} m (primero en z ${f2(PIE)}, antes ${f2(PIE0)}); contrahuellas de ${(0.16 * K).toFixed(3)} m de ${f2(LOSA)} a ${f2(PORCHE)}; peldaño superior hasta el muro (z ${f2(MURO)})`);

  // 2. porche → muretes
  const [porche] = piezas(doc, /Warm lime-painted plaster/i).filter((c) => cerca(c.mn[0], 10.0) && cerca(c.mx[0], 15.6) && cerca(c.mx[2], 14.9) && cerca(c.mx[1], PORCHE));
  if (!porche) throw new Error('entrada.mjs: no encuentro el porche (x 10,00 a 15,60, z hasta 14,90)');
  const dz = [0, PIE - porche.mx[2]];
  copiar(doc, porche, bordes(porche, [[14.55 - 10.0, 14.90 - porche.mx[0]], [0, 0], dz]));   // murete este
  moverPieza(porche, bordes(porche, [[0, 11.05 - porche.mx[0]], [0, 0], dz]));                // murete oeste (en su lugar)
  res.push(`porche macizo (x 10,00 a 15,60, z hasta 14,90) → muretes de ${f2(PORCHE)} m: x 10,00 a 11,05 y x 14,55 a 14,90, z ${f2(MURO)} a ${f2(PIE)}`);

  // 4. pasamanos
  const R = piezas(doc, /guardrail/i).filter((c) => (cerca(centro(c)[0], 11.10) || cerca(centro(c)[0], 14.50)) && c.mx[2] > 12 && c.mn[2] > 11.4);
  const sobran = R.filter((c) => tam(c)[2] < 0.06 && c.mx[2] < 14.5);
  quitar(sobran);
  for (const c of sobran) res.push(`pasamanos: quitado el poste de x ${f2(centro(c)[0])}, z ${f2(centro(c)[2])} (quedaría dentro del edificio)`);
  for (const c of R) {
    const poste = tam(c)[2] < 0.06;
    if (sobran.includes(c)) continue;
    // tope del tramo horizontal: el oeste llega al muro; el este remata en su poste superior (z 14,80 − DY = 11,65),
    // porque en x 14,50 el muro tiene la ventana de la planta baja (vidrio 9 cm adentro, x 14,34 a 16,56 desde 1,78 m)
    const oeste = centro(c)[0] < 12.8, tope = oeste ? MURO : 14.80 - DY, zc = centro(c)[2];
    moverPieza(c, ([x, y, z]) => [x, y + alza(poste ? zc : z), Math.max(tope, z - DY)]);
    if (!poste) res.push(`pasamanos ${oeste ? 'oeste' : 'este'} (x ${f2(centro(c)[0])}): de z ${f2(c.mn[2])}–${f2(c.mx[2])} a z ${f2(Math.max(tope, c.mn[2] - DY))}–${f2(c.mx[2] - DY)}, abajo ${((alza(c.mx[2])) * 100).toFixed(1)} cm más alto; arriba ${oeste ? 'contra el muro' : 'remata en su poste superior (ventana detrás)'}`);
  }
  if (R.filter((c) => tam(c)[2] > 1).length !== 2) throw new Error('entrada.mjs: se esperaban 2 pasamanos inclinados');
  return res;
}

/** La losa: copia del peldaño de abajo (caja biselada de 0 a 0,16) estirada por sus bordes, en una malla nueva con el mismo
 *  material y su propio volumen de cuantización (int16 normalizado, como las demás). */
function losa(doc, molde) {
  const p = molde.p, vs = [...molde.verts], nuevo = new Map(); vs.forEach((v, i) => nuevo.set(v, i));
  const mover = bordes(molde, [[9.90 - molde.mn[0], 15.60 - molde.mx[0]], [-0.05 - molde.mn[1], LOSA - molde.mx[1]], [LOSA_Z0 - molde.mn[2], ACERA - molde.mx[2]]]);
  const W = vs.map((v) => mover([molde.P[3 * v], molde.P[3 * v + 1], molde.P[3 * v + 2]]));
  const mn = [0, 1, 2].map((k) => Math.min(...W.map((w) => w[k]))), mx = [0, 1, 2].map((k) => Math.max(...W.map((w) => w[k])));
  const c = mn.map((x, k) => (x + mx[k]) / 2), s = Math.max(...mx.map((x, k) => (x - mn[k]) / 2)) * 1.001;
  const buf = doc.getRoot().listBuffers()[0];
  const P = new Int16Array(vs.length * 3);
  W.forEach((w, i) => { for (let k = 0; k < 3; k++) P[3 * i + k] = Math.round(((w[k] - c[k]) / s) * 32767); });
  const prim = doc.createPrimitive().setMaterial(p.getMaterial())
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P).setNormalized(true).setBuffer(buf));
  const N0 = p.getAttribute('NORMAL');
  if (N0) {
    // copia cruda de los valores (misma cuantización de normales); el nodo nuevo tiene escala uniforme, como el del molde
    const raw = N0.getArray(), N = new raw.constructor(vs.length * 3);
    vs.forEach((v, i) => { for (let k = 0; k < 3; k++) N[3 * i + k] = raw[3 * v + k]; });
    prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setNormalized(N0.getNormalized()).setBuffer(buf));
  }
  const I = p.getIndices().getArray(), J = new Uint16Array(molde.tris.length * 3); let o = 0;
  for (const t of molde.tris) for (let j = 0; j < 3; j++) J[o++] = nuevo.get(I[3 * t + j]);
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(J).setBuffer(buf));
  const malla = doc.createMesh('Pale cast concrete — entrance slab').addPrimitive(prim);
  const nodo = doc.createNode('Pale cast concrete — entrance slab').setMesh(malla).setTranslation(c).setScale([s, s, s]);
  // hermano de los demás nodos de entrada (mismo padre)
  const hermano = doc.getRoot().listNodes().find((n) => n.getMesh() === p.listParents().find((x) => x.propertyType === 'Mesh'));
  const padre = hermano.getParentNode();
  if (padre) padre.addChild(nodo); else doc.getRoot().getDefaultScene().addChild(nodo);
}

/** Describe la escalera, los muretes, la losa y los pasamanos (para el informe y para comprobar). */
async function medir(doc) {
  const L = [];
  const dsc = (c) => `x ${f2(c.mn[0])}–${f2(c.mx[0])}  y ${c.mn[1].toFixed(3)}–${c.mx[1].toFixed(3)}  z ${f2(c.mn[2])}–${f2(c.mx[2])}`;
  for (const c of piezas(doc, /Pale cast concrete — entrance/).filter((c) => c.mx[0] < 16 && c.mn[0] < 14.6)) L.push(`${c.malla.padEnd(34)} ${dsc(c)}`);
  for (const c of piezas(doc, /Warm lime-painted plaster/)) L.push(`${c.malla.padEnd(34)} ${dsc(c)}`);
  for (const c of piezas(doc, /guardrail/i).filter((c) => [11.10, 14.50, 11.65, 13.95].some((x) => cerca(centro(c)[0], x)) && c.mn[2] > 11.4)) L.push(`${c.malla.padEnd(34)} ${dsc(c)}`);
  return L;
}

// uso desde la línea de comandos
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await MeshoptDecoder.ready; await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const archivo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'modelo', 'entrada.glb');
  const doc = await io.read(archivo);
  if (process.argv.includes('--medir')) { console.log((await medir(doc)).join('\n')); process.exit(0); }
  const r = corregirEntrada(doc);
  console.log(r.join('\n'));
  // la misma compresión que optimize2.mjs (meshopt «high» = filtros de cuantización sobre los búferes)
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  if (!/nada que corregir/.test(r[0])) { await io.write(archivo, doc); console.log('escrito', archivo); }
}
