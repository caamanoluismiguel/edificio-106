// Interiores procedurales detrás de las ventanas («interior mapping», Joost van Dongen, 2008). Por cada fragmento del vidrio
// se sigue el rayo de la cámara hacia adentro, dentro de una caja-cuarto que no existe como geometría, y se pinta lo que
// golpea: cielorraso de placas de 60 × 60 cm con paneles de luz, paredes blancas, piso de baldosa beige y la pared del fondo.
// Todo es procedural: ni imágenes ni luces nuevas de three.js (una luz más recompila todos los materiales).
// Qué cuarto hay detrás de cada ventana lo dice la tabla de interiores-mapa.js (la genera fuente/interiores.mjs a partir del
// modelo), vuelta aquí una textura de datos de 184 × 12 píxeles (8,8 KB): una fila por fachada y piso, una columna cada 25 cm
// a lo largo de la fachada, con el tipo de cuarto, su fondo, sus paredes laterales y una semilla. La semilla decide, siempre
// igual, si la luz está encendida (de noche ~65 % de los cuartos), si lo está de día, la persiana y el aire acondicionado; el
// derrame de las ventanas en el suelo (escena.js) lee la misma textura, así que la luz de afuera coincide con la de adentro.
// Los interiores son una suposición: cómo es un salón de este edificio (fotos de LM), no lo que hay detrás de cada ventana.
import * as THREE from 'three/webgpu';
import {
  float, vec2, vec3, texture, positionWorld, normalWorld, cameraPosition, normalize, dot, abs, max, min, clamp, floor, fract,
  step, smoothstep, mix, hash, exp, pow, mod, fwidth, oneMinus, uniform,
} from 'three/tsl';
import { VENTANAS } from './interiores-mapa.js';

const ANCHO = 184, FILAS = 12, PASO = 0.25, ORIGEN = -23;   // columnas cada 25 cm desde −23 m (cubre x ±22,66 y z ±11,41)
export const LOSA0 = 0.65, ENTREPISO = 3.65, CIELO = 2.95;  // primera losa, altura entre pisos, cielorraso sobre el piso

// Ganancias. noche: luz de los paneles sobre las superficies, por unidad de U.ventanasN (calibrada para que el vidrio encendido
// promedie lo mismo que el rectángulo parejo de antes); panel: brillo del panel mismo respecto de esa luz. dia y panelDia: lo
// mismo de día en los salones con la luz prendida (de día casi no se nota fuera del panel). cielo: la luz del día que entra por
// la ventana, por unidad del relleno hemisférico.
export const K = { noche: uniform(1.0), dia: uniform(0.08), cielo: uniform(0.45), panel: uniform(2.8), panelDia: uniform(0.35) };   // uniformes: se ajustan sin recompilar

let _tex = null;
/** Textura de datos del mapa de ventanas: R = tipo + 8 × fondo en medios metros, G = semilla, B y A = paredes (columna). */
export function texturaMapa() {
  if (_tex) return _tex;
  const d = new Uint8Array(ANCHO * FILAS * 4), col = (s) => Math.max(0, Math.min(ANCHO - 1, Math.round((s - ORIGEN) / PASO)));
  for (let f = 0; f < 4; f++) for (let p = 0; p < 3; p++) {
    const L = VENTANAS.filter((v) => v[0] === f && v[1] === p), conCuarto = L.filter((v) => v[4] !== 0);
    for (let i = 0; i < ANCHO; i++) {
      const s = ORIGEN + (i + 0.5) * PASO;
      // la ventana que cubre esa columna; entre ventanas, la más cercana (para el derrame sobre el muro y el suelo)
      let v = L.find((w) => s >= w[2] - 0.13 && s <= w[3] + 0.13);
      if (!v) { let dm = 1e9; for (const w of conCuarto) { const dd = Math.max(w[2] - s, s - w[3], 0); if (dd < dm) { dm = dd; v = w; } } }
      if (!v) continue;
      const o = ((f * 3 + p) * ANCHO + i) * 4;
      d[o] = v[4] | (Math.min(31, Math.round(v[5] * 2)) << 3); d[o + 1] = v[8]; d[o + 2] = col(v[6]); d[o + 3] = col(v[7]);
    }
  }
  _tex = new THREE.DataTexture(d, ANCHO, FILAS, THREE.RGBAFormat, THREE.UnsignedByteType);
  _tex.magFilter = _tex.minFilter = THREE.NearestFilter; _tex.generateMipmaps = false; _tex.needsUpdate = true;
  return _tex;
}

const leer = (fIdx, piso, s) => {
  const u = floor(s.sub(ORIGEN).div(PASO)).clamp(0, ANCHO - 1).add(0.5).div(ANCHO);
  const t = texture(texturaMapa(), vec2(u, fIdx.mul(3).add(piso).add(0.5).div(FILAS)));
  const R = floor(t.r.mul(255).add(0.5));
  return {
    tipo: mod(R, 8), fondo: floor(R.div(8)).mul(0.5), semilla: floor(t.g.mul(255).add(0.5)),
    sL: floor(t.b.mul(255).add(0.5)).mul(PASO).add(ORIGEN), sR: floor(t.a.mul(255).add(0.5)).mul(PASO).add(ORIGEN),
  };
};
/** ¿Luz encendida de noche en el cuarto de esta semilla? (~65 %: la misma proporción de antes) */
export const encendida = (semilla) => step(0.35, hash(semilla.mul(5).add(3)));   // 67 % del largo de ventanas (SE 71, NO 59, NE 65, SO 71)
/** Semilla del cuarto cuya ventana está más cerca de un punto q (x, z) del borde de la planta, en el piso dado. */
export function semillaFachada(q, piso) {
  const porX = step(abs(q.y).div(11.5), abs(q.x).div(22.75));            // 1 en las fachadas cortas (NE, SO)
  const fIdx = porX.mul(2).add(step(mix(q.y, q.x, porX), 0));
  return leer(fIdx, clamp(piso, 0, 2), mix(q.x, q.y, porX)).semilla;
}

/**
 * Luz que sale por el vidrio (se usa como emisivo). p: {lampara (vec3 del LED de 4000 K con luminancia 1), ventanasN (uniforme
 * de la noche, 0 de día y 3 de noche), noche (0..1), cieloLuz (uniforme con el color del relleno hemisférico: la luz del cielo
 * que entra de día), lente (0..1: las formas de ver apagan el interior), mat (0 arcilla, 1 materiales), simple (calidad baja),
 * plano (emisivo de antes, para la ventana del desfogue)}. Las ganancias están en K.
 */
/** Marco de la fachada en el fragmento del vidrio: fachada, eje a lo largo, rayo de la cámara, piso y la fila del mapa. */
function marco() {
  const P = positionWorld, n = normalWorld, V = normalize(P.sub(cameraPosition));
  const porX = step(abs(n.z), abs(n.x));                                   // la cara mira a x: fachada NE o SO
  const nd = mix(n.z, n.x, porX), neg = step(nd, 0), sg = float(1).sub(neg.mul(2));
  const fIdx = porX.mul(2).add(neg);
  const s = mix(P.x, P.z, porX), ts = mix(V.x, V.z, porX);                 // a lo largo de la fachada
  const dIn = max(mix(V.z, V.x, porX).mul(sg).negate(), 0.002);            // hacia adentro del edificio
  const piso = floor(P.y.sub(LOSA0).div(ENTREPISO)).clamp(0, 2);
  const y0 = P.y.sub(piso.mul(ENTREPISO).add(LOSA0)), dy = V.y;            // altura sobre el piso del cuarto
  return { n, V, s, ts, dIn, y0, dy, M: leer(fIdx, piso, s) };
}
/** 1 si detrás de este vidrio hay cuarto, 0 en la ventana del desfogue (que queda como estaba). */
export const conCuarto = () => step(0.5, marco().M.tipo);

export function luzInterior(p) {
  const { n, V, s, ts, dIn, y0, dy, M } = marco();
  const tipo = M.tipo, sem = M.semilla;
  const es = (k) => step(abs(tipo.sub(k)), 0.5);
  const h = (k) => hash(sem.mul(13).add(k));
  const aula = es(1), ofi = es(2).add(es(5)), pas = es(3), bano = es(4), rec = es(5), ves = es(6);

  // luz de los paneles: de noche la de antes (U.ventanasN) en los cuartos encendidos; de día algunos salones la tienen prendida,
  // con los mismos paneles (su brillo absoluto no cambia, pero de día casi no se nota fuera del panel mismo)
  const on = encendida(sem), onDia = on.mul(step(mix(float(0.5), float(0.15), max(ofi, pas)), h(71)));   // oficinas y pasillos, casi siempre
  const lampN = on.mul(p.ventanasN).mul(K.noche), lampD = onDia.mul(oneMinus(p.noche));
  const lamp = lampN.add(lampD.mul(K.dia)), lampPanel = lampN.mul(K.panel).add(lampD.mul(K.panelDia));
  const cielo = vec3(p.cieloLuz).mul(K.cielo);                          // luz del día que entra por la ventana

  // caja del cuarto (coordenadas: s a lo largo, y sobre el piso, d hacia adentro)
  const D = max(M.fondo.add(h(5).sub(0.5).mul(0.9).mul(aula)), 1.5);
  const sL = M.sL, sR = M.sR, yC = float(CIELO);
  const tB = D.div(dIn);
  const tS = abs(mix(sL, sR, step(0, ts)).sub(s)).div(max(abs(ts), 1e-4));
  const tV = abs(yC.mul(step(0, dy)).sub(y0)).div(max(abs(dy), 1e-4));
  const t = min(tB, min(tS, tV));
  const hs = s.add(ts.mul(t)), hy = y0.add(dy.mul(t)), hd = dIn.mul(t);
  const esB = step(tB, min(tS, tV)), esS = oneMinus(esB).mul(step(tS, tV)), esV = oneMinus(esB).mul(oneMinus(esS));
  const techo = esV.mul(step(0, dy)), suelo = esV.mul(oneMinus(step(0, dy)));
  // raya fina en cada entero de x (ancho w a cada lado); a lo lejos, cuando ya no cabe en un píxel, queda su gris promedio
  const aa = (x, w) => {
    const fw = fwidth(x), dist = float(0.5).sub(abs(fract(x).sub(0.5)));
    return mix(oneMinus(smoothstep(w.sub(fw.mul(0.5)), w.add(fw.mul(0.5)), dist)), w.mul(2), smoothstep(w, w.mul(4), fw));
  };

  // cielorraso: placas de 60 cm (juntas grises) y paneles de luz de 60 × 60 cm, cada 4 × 3 placas en los salones y en fila en
  // los pasillos (a lo largo del lado más largo)
  const iS = floor(hs.sub(sL).div(0.6)), iD = floor(hd.div(0.6));
  const largoS = step(D, sR.sub(sL));                                      // pasillo a lo largo de la fachada
  const filaPas = mix(step(abs(iS.sub(floor(sR.sub(sL).div(1.2)))), 0.5).mul(step(mod(iD, 4), 0.5)),
    step(abs(iD.sub(floor(D.div(1.2)))), 0.5).mul(step(mod(iS, 4), 0.5)), largoS);
  const rejilla = step(abs(mod(iS.add(floor(h(9).mul(4))), 4).sub(1)), 0.5).mul(step(abs(mod(iD, 3).sub(1)), 0.5));
  const panel = techo.mul(mix(rejilla, filaPas, pas)).mul(step(0.35, hd)).mul(oneMinus(bano));
  const juntaT = p.simple ? float(0) : max(aa(hs.sub(sL).div(0.6), float(0.035)), aa(hd.div(0.6), float(0.035)));
  // piso: baldosa beige de 60 cm con junta y un poco de variación
  const baldosa = hash(iS.mul(31).add(iD.mul(7)).add(sem.mul(3)).add(1000)).sub(0.5).mul(0.08);
  const juntaP = p.simple ? float(0) : max(aa(hs.sub(sL).div(0.6), float(0.02)), aa(hd.div(0.6), float(0.02)));
  const albTecho = mix(float(0.8), float(0.58), juntaT);
  const albSuelo = vec3(0.62, 0.56, 0.47).mul(float(1).add(baldosa)).mul(mix(float(1), float(0.8), juntaP));
  let albMuro = vec3(0.8, 0.8, 0.78);

  // detalles de las paredes (no en calidad baja): puerta gris al fondo, pizarra en una pared lateral de los salones, split de
  // aire acondicionado en algunas paredes, y un escritorio bajo en las oficinas (dos en la recepción, paralelos a la ventana)
  let extra = vec3(0), escr = float(0);
  const lado = step(0.5, h(17));                                           // pared lateral elegida (izquierda o derecha)
  const enLado = esS.mul(mix(step(0, ts).oneMinus(), step(0, ts), lado));  // golpea esa pared
  if (!p.simple) {
    const w = sR.sub(sL);
    const pc = mix(sL.add(0.6), sR.sub(1.5), h(21));                      // puerta en el fondo
    const puerta = esB.mul(step(pc, hs)).mul(step(hs, pc.add(0.95))).mul(step(hy, 2.1)).mul(oneMinus(bano));
    const puertasPas = esB.mul(pas).mul(largoS).mul(step(mod(hs.sub(sL).add(h(23).mul(3)), 7.0), 0.95)).mul(step(hy, 2.1));
    const pizarra = enLado.mul(aula).mul(step(0.35, h(27))).mul(step(1.2, hd)).mul(step(hd, D.sub(1.2))).mul(step(0.95, hy)).mul(step(hy, 2.05));
    const acD = mix(float(0.8), max(D.sub(1.8), 0.9), h(31));
    const ac = enLado.oneMinus().mul(esS).mul(step(0.45, h(33))).mul(aula.add(ofi)).mul(step(acD, hd)).mul(step(hd, acD.add(0.85))).mul(step(2.28, hy)).mul(step(hy, 2.58));
    const acRanura = ac.mul(step(hy, 2.33));
    const vidrioFondo = esB.mul(rec.add(ves.mul(step(abs(hs.sub(sL.add(w.mul(0.5)))), 0.95)).mul(step(hy, 2.2))));
    const mont = vidrioFondo.mul(aa(hs.sub(sL).div(1.2), float(0.02)));
    albMuro = mix(albMuro, vec3(0.42, 0.43, 0.44), max(puerta, puertasPas));
    albMuro = mix(albMuro, vec3(0.9, 0.9, 0.9), pizarra.mul(0.9));
    albMuro = mix(albMuro, vec3(0.88, 0.89, 0.9), ac);
    albMuro = mix(albMuro, vec3(0.2, 0.2, 0.2), acRanura);
    albMuro = mix(albMuro, vec3(0.1, 0.12, 0.13), vidrioFondo.mul(0.85));
    albMuro = mix(albMuro, vec3(0.3, 0.3, 0.3), mont);
    // lo que se ve a través del vidrio del fondo: un pasillo iluminado más allá, sin detalle
    extra = vidrioFondo.mul(0.25);
    // escritorios: tablero a 75 cm y su frente
    const yE = 0.75, tE = y0.sub(yE).div(max(dy.negate(), 1e-4));
    const eS = s.add(ts.mul(tE)), eD = dIn.mul(tE);
    const c1 = mix(sL.add(0.5), sR.sub(2.1), h(41));
    const d1 = mix(float(1.1), float(1.4), h(43)), d2 = d1.add(1.5);
    const enE = (d0, c0) => step(c0, eS).mul(step(eS, c0.add(1.6))).mul(step(d0, eD)).mul(step(eD, d0.add(0.7)));
    const hayE = step(dy, -1e-3).mul(ofi).mul(step(tE, t)).mul(max(enE(d1, c1), enE(d2, c1).mul(rec)));
    escr = hayE;
  }

  // iluminación: panel (su propio brillo), luz de los paneles sobre cada superficie (el cielorraso recibe menos) y luz del día
  // que cae con la distancia a la ventana; las esquinas del cuarto un poco más oscuras
  const fT = mix(mix(float(0.8), float(1.0), suelo), float(0.3), techo);    // muros 0,8 · piso 1 · cielorraso 0,3 (los paneles alumbran hacia abajo)
  const fDia = mix(mix(float(0.7), float(1.0), suelo), float(0.45), techo).mul(float(0.12).add(exp(hd.div(-2.2)).mul(0.88)));
  const dmin = min(min(hs.sub(sL), sR.sub(hs)).add(esS.mul(99)), min(min(hy, yC.sub(hy)).add(esV.mul(99)), D.sub(hd).add(esB.mul(99))));
  const ao = p.simple ? float(1) : mix(float(0.55), float(1), smoothstep(0.0, 0.7, dmin));
  const alb = mix(mix(albMuro, albSuelo, suelo), vec3(albTecho), techo);
  const albF = mix(alb, vec3(0.42, 0.36, 0.3), escr);                      // escritorio de melamina parda
  const luzSup = vec3(p.lampara).mul(lampN).add(mix(vec3(p.lampara), vec3(1), 0.6).mul(lampD.mul(K.dia))).mul(fT).add(cielo.mul(fDia)).mul(ao);
  let L = albF.mul(luzSup).add(mix(vec3(p.lampara), vec3(1), 0.55).mul(lampPanel).mul(panel))   // el panel mismo se ve casi blanco (es lo más claro)
    .add(vec3(p.lampara).mul(lamp).mul(extra)).add(vec3(0.06).mul(panel).mul(cielo));   // panel apagado: difusor claro

  // persiana: en algunos cuartos, bajada desde arriba hasta cierta altura; de día la alumbra la ventana, de noche trasluce
  const persiana = step(0.62, h(51)).mul(oneMinus(bano)).mul(oneMinus(ves));
  const hP = float(2.85).sub(mix(float(0.35), float(1.1), h(53)).mul(persiana)).add(oneMinus(persiana).mul(9));
  const enP = step(hP, y0);
  const lamas = p.simple ? float(0) : aa(y0.div(0.06), float(0.12));
  const colP = vec3(0.84, 0.84, 0.81).mul(mix(float(1), float(0.8), lamas));
  const Lp = colP.mul(cielo.mul(0.7).add(vec3(p.lampara).mul(lamp).mul(0.3)));
  L = mix(L, Lp, enP);

  // baño: vidrio esmerilado, sin vista; difuso y algo claro de día, parejo de noche si la luz está encendida
  // (el vidrio lechoso devuelve parte de la luz de afuera y deja pasar, pareja, la de adentro)
  const Lb = vec3(0.8, 0.82, 0.84).mul(vec3(p.cieloLuz).mul(0.4).mul(float(0.9).add(y0.sub(1.2).mul(0.08))).add(vec3(p.lampara).mul(lampN).mul(K.noche).mul(0.5)));
  L = mix(L, Lb, bano);

  // la ventana del desfogue (tipo 0): como antes, solo el brillo parejo de la noche
  L = mix(L, p.plano.mul(on), es(0));

  // lo que atraviesa el vidrio: Fresnel de Schlick (a ángulo rasante manda el reflejo) y un 10 % que se queda en el vidrio
  const c = abs(dot(V, n)), F = float(0.04).add(pow(oneMinus(c), 5).mul(0.96));
  return L.mul(oneMinus(F).mul(0.9)).mul(oneMinus(p.lente)).mul(p.mat);
}
