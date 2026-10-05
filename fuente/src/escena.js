// Escena 3D del Edificio 106: carga por grupos de armado, materiales con revelado por altura,
// partículas que arman el edificio, cielo, sol real, sombras, nubes, lluvia y calor en fachadas.
import * as THREE from 'three/webgpu';
import {
  Fn, uniform, float, vec2, vec3, vec4, mix, clamp, smoothstep, max, min, pow, dot, sin, cos, fract, floor,
  positionWorld, normalWorld, time, hash, shapeCircle, instancedBufferAttribute, mx_noise_float,
  mx_fractal_noise_float, oneMinus, step, length, pass, texture, uv, select, mrt, normalView, velocity, sample,
  packNormalToRGB, unpackRGBToNormal, builtinAOContext, screenUV, positionLocal, abs, viewportSize, materialColor, materialRoughness, renderOutput, cameraPosition, property,
  modelWorldMatrix, modelWorldMatrixInverse, output, normalize, attribute, lightShadowMatrix
} from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { vectorSol, FACHADAS, posicionSol, saleYPone } from './sol.js';
import { binario, conVersion, VER } from './datos.js';
import { NIVEL, NIVELES, VIGIA, Vigia, bajar, capacidad, nivelEstatico, nivelSondeo } from './ciudad-nivel.js';
import { Barcos } from './barcos.js';
import { luzInterior, encendida, semillaFachada, conCuarto, K as K_INTERIOR } from './interiores.js';

export const GRUPOS = ['sitio', 'arquitectura', 'ventanas', 'cubiertas', 'entrada', 'detalles', 'vegetacion', 'contexto', 'arboles'];   // arboles: las copas de Ciudad del Saber (arboles-cds.mjs), al final para no mover el índice de los demás
// Reparto de partículas por grupo (fracción del total)
const CUOTA = { sitio: 0.11, arquitectura: 0.19, ventanas: 0.10, cubiertas: 0.20, entrada: 0.05, detalles: 0.05, vegetacion: 0.2, contexto: 0.10, arboles: 0.02 };

/** Paradas de la rampa de la lente «Sol» (RGB lineal, a 0, 200, 400, 600 y 800 W/m²). La leyenda se arma con estas mismas,
 *  pasadas a sRGB (main.js), para que el color de la leyenda sea el que se pinta antes de la luz de la escena. */
export const RAMPA_SOL = [[0.01, 0.03, 0.22], [0.30, 0.02, 0.40], [0.85, 0.12, 0.02], [1.0, 0.45, 0.0], [1.0, 0.85, 0.15]];
export const U = {                       // uniformes compartidos
  build: uniform(0),                     // 0..8: avance del armado (un grupo por unidad)
  junta: uniform(0),                     // 0..1: los puntos vuelan hasta su lugar (todos a la vez)
  mat: uniform(0),                       // 0 = arcilla, 1 = materiales reales
  puntos: uniform(1),                    // visibilidad global de las partículas
  nubeSombra: uniform(0),                // 0..1: fuerza de las sombras de nubes
  nubeCob: uniform(0.35),                // cobertura de nubes (para el patrón)
  calor: uniform(0),                     // 0..1: capa de calor en fachadas
  noche: uniform(0),                     // 0..1: luces interiores
  lluvia: uniform(0),                    // 0..1: intensidad de lluvia
  viento: uniform(new THREE.Vector2(1, 0.3)),
  reticula: uniform(0),
  mojado: uniform(0),                    // 0..1: superficies mojadas y charcos
  cam: uniform(new THREE.Vector3()),     // posición de la cámara (la lluvia la rodea)
  luzLluvia: uniform(1),                 // brillo de las gotas según la luz del cielo
  relampago: uniform(0),
  cielo: uniform(0.2),                 // ganancia del cielo de Preetham (sale ~20× más brillante que la escena)
  cubierto: uniform(0),                  // 0..1: cielo gris parejo (nublado o con lluvia)
  agua: uniform(0),                      // 0..1: lente «lluvia con viento en fachadas»
  aguaF: uniform(new THREE.Vector4()),   // índice de lluvia batiente normalizado por fachada (SE, NO, NE, SO)
  sombras: uniform(0),                   // 0..1: lente «diagrama de sombras del día»
  viaje: uniform(0),                     // 0..1: viñeta del viaje en el tiempo
};
Object.assign(U, {
  grisCielo: uniform(new THREE.Color(0.6, 0.62, 0.65)),
  solDir: uniform(new THREE.Vector3(0, 1, 0)), // dirección hacia el sol (escena)
  dniW: uniform(0),                      // radiación directa normal de esa hora, W/m²
  dhiW: uniform(0),                      // difusa horizontal, W/m²
  ghiW: uniform(0),                      // global horizontal, W/m²
  total: uniform(0),                     // 0 = solo directa, 1 = directa + difusa + reflejada
  ai: uniform(0),                        // índice de anisotropía de Hay-Davies: DNI / DNI fuera de la atmósfera (0..1)
  pal0: uniform(new THREE.Color(0.05, 0.07, 0.1)),   // paleta de la lente de fachadas (lluvia o viento)
  pal1: uniform(new THREE.Color(0.08, 0.42, 0.9)),
  pal2: uniform(new THREE.Color(0.6, 0.9, 1.0)),
  aguaT: uniform(0),                     // valor del techo en la lente de fachadas (solo el año típico del sol lo usa)
  brisa: uniform(0),                     // 0..1: viento de esa hora para la vegetación (35 km/h o más = 1)
  vientoDir: uniform(new THREE.Vector2(1, 0)),   // hacia dónde sopla, en el plano de la escena (unitario)
  vaiven: uniform(1),                    // 0 con movimiento reducido: la vegetación solo se inclina, no se mece
  nocturna: uniform(0),                  // 0..1: de noche (cielo de noche y relleno del cielo urbano), sube al ponerse el sol
  cieloH: uniform(new THREE.Color(0.05, 0.05, 0.05)),   // bóveda de noche en el horizonte y en el cenit (lineal), según las nubes y la luna
  cieloZ: uniform(new THREE.Color(0.02, 0.02, 0.02)),
  entornoN: uniform(new THREE.Color(0.03, 0.03, 0.03)), // la misma bóveda, para el mapa de entorno (lo que ilumina y se refleja)
  purkinje: uniform(0),                  // 0..1: cuánto se acerca la imagen a la visión nocturna (menos color, algo más fría)
  poste: uniform(0),                     // intensidad del poste de la esquina (0 de día)
  posteCol: uniform(new THREE.Color(1, 1, 1)),          // color de su lámpara, con luminancia 1
  ventanasN: uniform(0),                 // encendido de las ventanas y su derrame (0 de día)
  lunaDir: uniform(new THREE.Vector3(0, -1, 0)),        // hacia dónde está la luna (escena)
  lunaLuz: uniform(new THREE.Vector3(0, 1, 0)),         // hacia dónde está el sol visto desde la luna (da el terminador)
  lunaDisco: uniform(0),                 // brillo del disco de la luna (0 sin luna, de día o tapada por nubes densas)
  lunaNube: uniform(0),                  // 0..1: nubes delante de la luna (el borde del disco se difumina)
  cieloArriba: uniform(new THREE.Color(0, 0, 0)),       // de noche, lo que suma la bóveda completa a techos y suelo abiertos
});
// sombra geométrica del sol en cada punto (0 = en sombra, 1 = al sol): la escribe el mapa de sombras y la lee la lente «Sol».
// Ojo con el orden: three.js emite el emisivo ANTES que el código de las luces (la sombra se calcula al usarse la iluminación,
// cuando se asigna la salida), así que un emisivo que lea esta variable ve siempre el 1 de la asignación inicial. La lente
// se suma por eso en outputNode, que se evalúa después de la iluminación.
const sombraSol = property('float', 'sombraSol');

// Noche honesta: de noche la escena solo recibe la luz que de verdad hay. La luna sale de luna.js (posición y fase de esa
// noche) y pasa por las nubes del dato; el cielo nublado devuelve el resplandor anaranjado de la ciudad (más claro que un muro
// sin luz) y el despejado es más oscuro y neutro; la única fuente de la escena es el poste de la esquina, más las ventanas
// encendidas, que son una suposición. El frío de la noche no está en la luz sino en la visión (Purkinje, en el postproceso).
const NOCHE = {
  lunaMax: 0.42,                         // luna llena en el cenit con cielo despejado (el sol de mediodía llega a 5)
  lunaColor: [1.0, 0.96, 0.9],           // es luz del sol reflejada, apenas más cálida
  lunaDisco: 1.4,                        // brillo del disco en el cielo (sale casi blanco, sin encandilar)
  nubladoH: [0.09, 0.08, 0.075], nubladoZ: [0.05, 0.045, 0.042],      // resplandor urbano en nubes bajas
  despejadoH: [0.05, 0.05, 0.056], despejadoZ: [0.009, 0.0105, 0.016],
  lunaCielo: [0.012, 0.017, 0.028],      // lo que suma la luna llena alta al cielo despejado
  crepH: [0.30, 0.25, 0.30], crepZ: [0.10, 0.13, 0.24],               // cielo del crepúsculo cuando el sol está a −2°
  relleno: 0.35,                         // relleno hemisférico, en proporción a la luz de la bóveda (lo recibe el muro en sombra)
  suelo: [0.30, 0.28, 0.25],             // rebote del suelo, relativo a la bóveda
  exposicion: 1.1,
  pasosLarga: 3,                         // «Exposición larga»: pasos de exposición sobre la noche honesta
  ventanas: 3.0,                         // emisivo de una ventana encendida
  ventanaLum: 0.52,                      // luminancia del vidrio encendido por unidad de U.ventanasN (la misma del naranja de antes)
  poste: 330,                            // intensidad del poste (el charco llega a ~2,5 en el centro)
  lamparas: { led: [1.0, 0.617, 0.381], sodio: [1.0, 0.42, 0.07] },  // 4000 K y sodio de alta presión (~2100 K), lineales
};
for (const c of Object.values(NOCHE.lamparas)) { const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; c.forEach((v, i) => { c[i] = v / l; }); }
// dónde está la cabeza del poste de la esquina (grupo «sitio»: fuste en (45,6; 16,4), brazo hacia la calle) y la planta del edificio
const POSTE = new THREE.Vector3(48.6, 11.3, 16.43);
const PLANTA = [22.75, 11.5];
const clayColor = vec3(0.74, 0.72, 0.68);
const TEX_BLANCA = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);   // mientras llega la textura real
TEX_BLANCA.needsUpdate = true;
/** 1 / color promedio (lineal) de una imagen sRGB, para que la textura multiplique alrededor de 1. */
function promedioInverso(img) {
  const v = new THREE.Vector3(1, 1, 1);
  try {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data, lin = (u) => { u /= 255; return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
    let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += lin(d[i]); g += lin(d[i + 1]); b += lin(d[i + 2]); }
    const n = d.length / 4; v.set(n / Math.max(r, 1e-3), n / Math.max(g, 1e-3), n / Math.max(b, 1e-3));
  } catch (e) { /* sin lienzo: la textura queda tal cual */ }
  return v;
}

// LA CIUDAD (fase 3): encendida por defecto (CIUDAD-PLAN §27). La quitan ?ciudad=0, ?ligero y la capa «Ciudad del Saber
// (aproximada)» apagada (main.js lo recuerda en localStorage «e106-ciudad» = '0'); ?ciudad=1 (o ?ciudad=espiga) la pide aunque
// esté apagada. Sin ciudad nada de esto corre y la página es la de main. Llega después del 106 (arrancarCiudad), con el nivel que
// el equipo aguanta (ciudad-nivel.js). La sombra por defecto es la «doble»: el mapa fino de siempre (±70 m, el mismo texel del 106)
// y un mapa grueso aparte para la ciudad (SombraGruesa). Opciones para medir: ?sombra=actual|sunlight|csm|ajustada|doble,
// &sombramapa=1024|2048|4096 y ?ciudadnivel=completo|medio|liviano|oculta (fija el nivel: sin sondeo ni vigía).
// con ?prueba no hay sondeo ni vigía (las capturas deben repetirse); ?sondeo y ?vigia los vuelven a poner para probarlos
const PRUEBA = typeof location !== 'undefined' && /[?&]prueba/.test(location.search);
const SONDEA = !PRUEBA || /[?&]sondeo/.test(location.search), VIGILA = !PRUEBA || /[?&]vigia/.test(location.search);
const CIUDAD = (() => {
  if (typeof location === 'undefined') return null;
  const q = new URLSearchParams(location.search), c = q.get('ciudad'), pedida = c === '1' || c === 'espiga';
  let guardada = null; try { guardada = localStorage.getItem('e106-ciudad'); } catch (e) { /* sin almacenamiento */ }
  if (c === '0' || q.has('ligero') || (!pedida && guardada === '0')) return null;
  const sombra = q.get('sombra'), nivel = q.get('ciudadnivel');
  return { sombra: ['actual', 'sunlight', 'csm', 'ajustada', 'doble'].includes(sombra) ? sombra : null, mapa: q.has('sombramapa') ? +q.get('sombramapa') : null,
    nivelPedido: NIVELES.includes(nivel) ? nivel : null };
})();
// Sombra gruesa de la ciudad. El mapa fino del 106 no cambia en nada; en los materiales que reciben sombra, fuera de su caja (con
// MARGEN_FINA m de transición) se usa el valor de este segundo mapa, que cubre toda la ciudad con un texel más grande. Es un
// ShadowNode de una luz aparte que no está en la escena ni ilumina (intensidad 0): solo presta su cámara de sombra. Dentro de la
// caja fina el resultado es exactamente el de siempre (s·1 + gruesa·0). GRUESA se arma antes de compilar ningún material.
let GRUESA = null;
const MARGEN_FINA = 6;
// capa de lo que proyecta sombra solo en el mapa grueso (el contexto lejano del 106); la cámara de la sombra fina ve solo la 1
const CAPA_GRUESA = 2;
// del contexto, lo que no es edificio (no proyecta sombra en ningún mapa): terreno, calles, aceras, ferrocarril, agua, esclusas
// y estacionamientos
const SUELO_CONTEXTO = /asphalt|concrete walk|rail ballast|canal water|lock wall|grass turf/i;
class SombraGruesa extends THREE.ShadowNode {
  /** Como ShadowNode.setup, sin aplicar el receivedShadowNode del material: lo aplica la sombra fina, que ya trae esta adentro. */
  setup(builder) {
    if (builder.renderer.shadowMap.enabled === false) return;
    return Fn(() => {
      const tipo = builder.renderer.shadowMap.type;
      if (this._currentShadowType !== tipo) { this._reset(); this._node = null; }
      let node = this._node;
      this.setupShadowPosition(builder);
      if (node === null) { this._node = node = this.setupShadow(builder); this._currentShadowType = tipo; }
      return node;
    })();
  }
}
/** La sombra fina tal cual dentro de su caja; afuera, la gruesa (si la ciudad la usa ahora: GRUESA.uso). */
function conGruesa(s) {
  const G = GRUESA; if (!G) return s;
  const c = G.fina.mul(vec4(positionWorld, 1)).xy, m = G.margen;
  const w = smoothstep(0, m, c.x).mul(smoothstep(0, m, c.x.oneMinus())).mul(smoothstep(0, m, c.y)).mul(smoothstep(0, m, c.y.oneMinus()));
  const p = max(w, float(1).sub(G.uso));
  // s·p + gruesa·(1 − p): con p = 1 da s exacto (s·1 + gruesa·0); un select() con la sombra adentro dejaba la gruesa sin calcular
  // en la franja de transición (salía negra)
  return s.mul(p).add(G.nodo.mul(float(1).sub(p)));
}

export class Escena {
  constructor(canvasParent, calidad) {
    this.ciudadOpc = CIUDAD ? { ...CIUDAD } : null;
    this.calidad = calidad;           // {nivel, dpr, sombras, particulas, bloom}
    this.parent = canvasParent;
    this.grupos = {};                 // nombre -> {root, minY, maxY, idx}
    this.solDir = new THREE.Vector3(0, 1, 0);
    this.listeners = [];
    this.modoNoche = 'honesta';       // noche: 'honesta' o 'larga'
    this.lampara = 'led';             // poste de la esquina: LED de 4000 K por defecto (el sodio queda para comparar)
  }

  async init(forceWebGL = false) {
    await this.#crearRenderer(forceWebGL);
    this.#nivelWebGL();
    if (this.ciudadOpc) await this.#nivelCiudadInicial();
    const r = this.renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x9fb3c0, 350, 2600);
    this.scene = scene;
    const cam = new THREE.PerspectiveCamera(window.innerWidth / window.innerHeight < 0.8 ? 58 : 38, window.innerWidth / window.innerHeight, 0.3, 7000);
    cam.position.set(46, 1.4, 29);                                  // la vista Esquina (main.js la fija y arma la intro)
    this.camera = cam;

    // Cielo (Preetham + nubes procedurales de three.js)
    const sky = new SkyMesh();
    sky.scale.setScalar(6000);
    sky.turbidity.value = 7; sky.rayleigh.value = 2.0; sky.mieCoefficient.value = 0.006; sky.mieDirectionalG.value = 0.8;
    sky.cloudCoverage.value = 0.35; sky.cloudDensity.value = 0.45; sky.cloudElevation.value = 0.5;
    sky.material.fog = false;
    // de noche la bóveda pasa a la de noche (U.cieloH y U.cieloZ, según las nubes, la luna y el crepúsculo; ver setSol)
    const altura = clamp(normalize(positionWorld).y, 0, 1);
    const cieloNoche = vec4(mix(vec3(U.cieloH), vec3(U.cieloZ), pow(altura, 0.45)), 1);
    // disco de la luna en su lugar y con su fase: cada punto del disco es un punto de una esfera vista de lejos, iluminado si
    // su normal mira hacia el sol visto desde la luna (U.lunaLuz, armado con la fracción iluminada de luna.js y el lado del sol).
    // Radio aparente de 0,55° (el real es 0,26°: al doble se lee sin dominar el cielo). Las nubes difuminan el borde.
    const dirV = normalize(positionWorld.sub(cameraPosition));
    const rL = Math.sin(0.55 * Math.PI / 180);
    const cosL = dot(dirV, U.lunaDir);
    const off = dirV.sub(vec3(U.lunaDir).mul(cosL)).div(rL);            // posición en el disco, en radios (0 en el centro)
    const r2 = dot(off, off);
    const nLuna = off.sub(vec3(U.lunaDir).mul(max(float(1).sub(r2), 0).sqrt()));   // normal de la cara que vemos
    const borde = mix(float(0.08), float(0.6), U.lunaNube);
    const dentro = smoothstep(float(1).add(borde), float(1).sub(borde), r2.sqrt()).mul(step(0, cosL));
    const lit = smoothstep(-0.06, 0.06, dot(nLuna, U.lunaLuz));
    const disco = vec3(...NOCHE.lunaColor).mul(dentro.mul(lit).mul(U.lunaDisco));
    sky.material.colorNode = mix(mix(sky.material.colorNode.mul(vec4(vec3(U.cielo), 1)), vec4(U.grisCielo, 1), U.cubierto), cieloNoche, U.nocturna).add(vec4(disco, 0));
    scene.add(sky); this.sky = sky;
    // escena aparte para el mapa de entorno (misma bóveda, sin nubes densas)
    this.skyEnvScene = new THREE.Scene();
    const sky2 = new SkyMesh(); sky2.scale.setScalar(1000);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) sky2[k].value = sky[k].value;
    sky2.cloudCoverage.value = 0.2; sky2.cloudDensity.value = 0.3; sky2.showSunDisc.value = 0;
    // la bóveda que ilumina y se refleja va casi sin saturación: el azul puro teñía de pizarra todo lo que queda en sombra
    // (en las fotos los muros en sombra son blanco neutro, (184, 184, 181) en WA0024)
    const c2 = sky2.material.colorNode.mul(vec4(vec3(U.cielo), 1));
    const l2 = dot(c2.rgb, vec3(0.2126, 0.7152, 0.0722));
    sky2.material.colorNode = mix(mix(vec4(mix(c2.rgb, vec3(l2), 0.8), 1), vec4(U.grisCielo, 1), U.cubierto), vec4(vec3(U.entornoN), 1), U.nocturna);
    this.skyEnvScene.add(sky2); this.sky2 = sky2;
    this.pmrem = new THREE.PMREMGenerator(r);

    // Luces
    const sun = this.ciudadOpc?.sombra === 'sunlight' ? await this.#solSunLight() : new THREE.DirectionalLight(0xffffff, 3);
    sun.castShadow = true;
    const S = this.calidad.sombras;
    sun.shadow.mapSize.set(S, S);
    // ±70 m cubre el edificio, los árboles cercanos y las sombras largas de la mañana; con 4096 px, un texel mide 3,4 cm
    const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 1400;
    // normalBias va en metros: con 0,35 cada punto se probaba 35 cm fuera del muro y los aleros sombreaban como si fueran un 21 % más cortos
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
    sun.shadow.radius = 2;
    sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true;   // se recalcula solo cuando cambia el sol o el armado
    sun.shadow.camera.layers.set(1);                                 // proyectan sombra solo los objetos en la capa 1
    scene.add(sun); scene.add(sun.target); this.sun = sun;
    if (this.ciudadOpc) await this.#sombraCiudad();
    this.hemi = new THREE.HemisphereLight(0xbfd4e6, 0x5b5a3e, 0.6);
    scene.add(this.hemi);

    // Suelo lejano para que el terreno llegue al horizonte. Va 0,5 m bajo cero, por debajo de todo el suelo del sitio: el pasto
    // de sitio.glb es una losa con la cara de arriba a −0,032 m (fondo a −0,428) y el asfalto llega a −0,047. A −0,05 m quedaba
    // a 1,8 cm del pasto y a 3 mm del asfalto, menos de lo que distingue el búfer de profundidad desde la planta (~1 cm a 215 m
    // con near 0,3): los dos suelos se peleaban el píxel y se veía una franja de pantalla completa, más clara sobre el pasto y
    // granulada sobre la calle, a cualquier hora. A 0,5 m el sitio siempre gana y el borde de la losa tapa el escalón.
    const g = new THREE.CircleGeometry(3200, 64); g.rotateX(-Math.PI / 2);
    const gm = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(0.05, 0.085, 0.03), roughness: 0.95 });
    gm.colorNode = mix(clayColor.mul(0.55), vec3(0.05, 0.085, 0.03), U.mat);
    gm.receivedShadowNode = sombraNubes;
    gm.emissiveNode = gm.colorNode.mul(vec3(U.cieloArriba));   // de noche, la bóveda completa sobre el terreno abierto
    // Con el relieve del entorno (contexto.glb, Copernicus DEM) el canal queda hasta ~26 m bajo el 106: el suelo lejano va
    // bajo todo eso, a −30 m, y solo asoma más allá de la caja del relieve (~3 km), ya en la niebla. Junto al sitio, el
    // terreno del entorno está a −0,6 m, igual que antes estaba este suelo (a −0,5).
    const suelo = new THREE.Mesh(g, gm); suelo.position.y = -30; suelo.receiveShadow = true; scene.add(suelo);
    this.suelo = suelo;
    // barcos ilustrativos por el canal (barcos.js); ?barcos=0 los quita (para comparar con la versión sin barcos)
    this.barcos = /[?&]barcos=0/.test(location.search) ? null : new Barcos(scene);

    this.#reticula();
    this.#lluvia();
    this.#rosa();
    this.#ruta();
    this.#diagrama();
    this.#vientoRosa();
    this.#partes();

    this.#pipeline();

    window.addEventListener('resize', () => this.resize());
    this.setSol(-8, 90);
    // el cielo, el suelo, la lluvia y las ayudas, en tramos mientras llegan los puntos de la intro (el primer cuadro los compilaba juntos)
    this.precompilar().catch(() => {});
    return this;
  }

  async #crearRenderer(forceWebGL) {
    const r = new THREE.WebGPURenderer({ antialias: false, forceWebGL, powerPreference: 'high-performance' });
    await r.init();
    this.backend = r.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
    r.setPixelRatio(this.dprMax());
    this._w = Math.max(2, window.innerWidth); this._h = Math.max(2, window.innerHeight);
    r.setSize(this._w, this._h);
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = this.renderer?.toneMappingExposure ?? 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    if (this._sunNodo) r.library.addLight(...this._sunNodo);
    r.domElement.style.touchAction = 'none';
    r.domElement.setAttribute('aria-hidden', 'true');
    if (this.renderer) this.renderer.domElement.replaceWith(r.domElement); else this.parent.appendChild(r.domElement);
    this.renderer = r;
  }

  /** En WebGL 2 (pedido con #webgl, sin WebGPU o de rescate) el nivel 'alto' no cabe: con sombras de 4.096, bloom y profundidad
   *  de campo, el jurado midió 28 cuadros por segundo al girar (p95 de 50 ms). Pasa al nivel 'medio' (sin bloom; la profundidad
   *  de campo se queda, en todos los niveles), el mismo que ya usa un
   *  navegador sin WebGPU. Cambia el objeto de calidad en su lugar (main.js lee de él las partículas). En WebGPU no hace nada. */
  #nivelWebGL() {
    const q = this.calidad;
    if (this.backend !== 'WebGL 2' || q.nivel !== 'alto') return;
    Object.assign(q, { nivel: 'medio', dpr: Math.min(q.dpr, 1.25), px: Math.min(q.px ?? 3.7e6, 2.4e6), sombras: Math.min(q.sombras, 2048),
      particulas: Math.min(q.particulas, 60000), bloom: false, ao: false });
    this.renderer.setPixelRatio(this.dprMax());
  }

  /** Baja al nivel 'bajo' sin recompilar los materiales: mapa de sombras de 1.024, sin FXAA y la resolución del teléfono.
   *  Lo pide main.js (vigilarNivel) si en WebGL 2 los primeros cuadros no llegan a 30 por segundo. */
  bajarNivel() {
    const q = this.calidad;
    if (q.nivel === 'bajo') return false;
    Object.assign(q, { nivel: 'bajo', dpr: Math.min(q.dpr, 1), px: Math.min(q.px ?? 3.7e6, 1.6e6), sombras: 1024, bloom: false });
    if (!this.ciudadOpc?.mapa) this.sun.shadow.mapSize.set(1024, 1024);   // ciudad: un &sombramapa= pedido se respeta
    this.sun.shadow.needsUpdate = true;
    this.bloomOn = false; this.setSalida('sinAA');
    this.fijarResolucion(this.dprMax());
    return true;
  }

  /** Si WebGPU falla en este equipo, la misma escena pasa a WebGL 2 sin recargar la página. */
  async pasarAWebGL() {
    const viejo = this.renderer;
    await this.#crearRenderer(true);
    this.#nivelWebGL(); this.sun.shadow.mapSize.set(this.calidad.sombras, this.calidad.sombras);
    this._compilados = null;                        // lo compilado era del renderer anterior
    if (GRUESA && this.sunG) GRUESA.nodo = new SombraGruesa(this.sunG);   // su mapa era del renderer anterior
    try { viejo.setAnimationLoop?.(null); viejo.dispose(); } catch (e) { /* el dispositivo ya no existe */ }
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this._envRT = null; this.scene.environment = null; this._envClave = null; this._envT = 0;
    this.#pipeline();
    this.sun.shadow.needsUpdate = true; this.sucio = true;
    this.setSol(this.alt, this.az);
  }

  #pipeline() {
    // Postproceso: oclusión ambiental (GTAO) + suavizado temporal (TRAA) en equipos potentes,
    // bloom suave, viñeta y grano de película.
    const r = this.renderer, scene = this.scene, cam = this.camera;
    this.pipeline = new THREE.RenderPipeline(r);
    const scenePass = pass(scene, cam);
    this.pasadas = [scenePass];                   // para precompilar() en el mismo contexto en que se dibuja
    let col = scenePass.getTextureNode('output');
    if (this.calidad.ao) {
      const pre = pass(scene, cam); pre.transparent = false; this.pasadas.push(pre);
      pre.setMRT(mrt({ output: packNormalToRGB(normalView), velocity }));
      const nTex = pre.getTexture('output'); nTex.type = THREE.UnsignedByteType;
      const preNormal = sample((u) => unpackRGBToNormal(pre.getTextureNode().sample(u)));
      const preDepth = pre.getTextureNode('depth'), preVel = pre.getTextureNode('velocity');
      const aoPass = ao(preDepth, preNormal, cam);
      aoPass.resolutionScale = 0.5; aoPass.radius.value = 1.6; aoPass.thickness.value = 1.2; aoPass.scale.value = 1.0; aoPass.samples.value = 14;
      scenePass.contextNode = builtinAOContext(aoPass.getTextureNode().sample(screenUV).r);
      const t = traa(scenePass, preDepth, preVel, cam); t.useSubpixelCorrection = false;
      col = t;
      this.aoPass = aoPass;
    }
    // profundidad de campo (idea de sael.net/internet): nítido en una franja alrededor del punto que se mira y suave fuera de
    // ella, lo lejano más que lo cercano. main.js mueve el foco con la cámara y apaga el efecto donde el suelo o la fachada son
    // lo que se lee (planta, diagrama de sombras, tarjeta de fachada). Con uDesenfoque = 0 la imagen sale idéntica (CoC = 0).
    // En todos los niveles (teléfono y WebGL 2 incluidos): LM la quiere siempre por defecto (4 de octubre de 2026).
    this.uFoco = uniform(60); this.uBanda = uniform(20); this.uRampa = uniform(40); this.uDesenfoque = uniform(0); this.uBokeh = uniform(4);
    this.conDof = true;
    {
      const d = scenePass.getViewZNode().negate().sub(this.uFoco);                 // + detrás del foco, − delante
      const fuera = max(abs(d).sub(this.uBanda), 0).mul(select(d.lessThan(0), float(0.6), float(1))).mul(this.uDesenfoque);
      col = dof(col, this.uFoco.add(select(d.lessThan(0), fuera.negate(), fuera)).negate(), this.uFoco, this.uRampa, this.uBokeh);
    }
    const vig = smoothstep(float(1.25), float(0.35), length(screenUV.sub(0.5).mul(vec2(1.35, 1.0))));
    const grano = hash(screenUV.mul(viewportSize).add(fract(time.mul(13.7)).mul(517.0))).sub(0.5).mul(0.035);
    // suavizado FXAA sobre la imagen ya tonemapeada (más barato que MSAA ×4 a esta resolución)
    // curva S suave después del tonemapping (AgX sale plano): más contraste entre sol y sombra, sin tocar los extremos
    const curva = (o) => vec4(mix(o.rgb, smoothstep(0.0, 1.0, o.rgb), 0.3), o.a);
    // visión nocturna (Purkinje): con poca luz el ojo ve con los bastones, casi sin color y algo más frío. Se mezcla hacia la
    // luminancia antes del tonemapping, por uniforme; lo claro (las ventanas, la lámpara y su charco) conserva su color,
    // como pasa en la visión mesópica. Nada de esto cambia la luz de la escena, solo cómo se ve.
    const nocturno = (c) => { const lum = dot(c, vec3(0.2126, 0.7152, 0.0722)); return mix(c, vec3(lum).mul(vec3(0.85, 0.95, 1.1)), U.purkinje.mul(oneMinus(smoothstep(0.05, 0.6, lum)))); };
    const acabar = (n, aa) => { const v = vec4(nocturno(n.rgb).mul(mix(float(0.72).sub(U.viaje.mul(0.15)), 1.0, vig)).mul(float(1).add(grano)).add(U.relampago.mul(0.35)), 1.0); return aa ? fxaa(curva(renderOutput(v))) : curva(renderOutput(v)); };
    this.pipeline.outputColorTransform = false;
    const aa = this.calidad.nivel !== 'bajo';
    this.salidas = { sinBloom: acabar(col, aa), sinAA: acabar(col, false) };
    // bloom = destello de la lente: parte de la luz de lo que pasa del umbral se esparce por la imagen. El filtro deja pasar el
    // valor entero de cada píxel sobre el umbral y las cinco escalas del desenfoque suman 3 veces su energía (con radio 0,4), así
    // que la fuerza 0,12 le agregaba a toda la imagen el 36 % de la luz del halo del sol: a contraluz el muro en sombra quedaba
    // casi tan claro como el cielo. Una lente real esparce del 1 al 5 % (velo de ISO 9358); 0,015 da el 4,5 %. De noche no cambia
    // nada visible: lo único sobre el umbral es la cabeza del poste, que es pequeña.
    this.salidas.conBloom = acabar(col.add(bloom(scenePass.getTextureNode('output'), 0.015, 0.4, 2.4)), aa);
    this.bloomOn = !!this.calidad.bloom;
    this.pipeline.outputNode = this.bloomOn ? this.salidas.conBloom : this.salidas.sinBloom;

  }

  /** Cambia la salida del postproceso (para medir o para bajar costo). */
  setSalida(k) { this.pipeline.outputNode = this.salidas[k]; this.pipeline.needsUpdate = true; this.sucio = true; }

  /** Compila de antemano los sombreadores de todo lo que puede llegar a verse (lentes, partes, diagrama, lluvia…), para que
   *  el primer clic no congele la imagen. renderer.compileAsync(scene, camera) a secas compila para la pantalla, pero cada
   *  cuadro se dibuja dentro de las pasadas del postproceso: otro destino (render target, MRT) y otra profundidad de llamada,
   *  y three.js les da un contexto distinto, así que esa compilación no servía (la lente «Sombras» compilaba 9 pipelines al
   *  primer clic). Aquí se compila con el destino y la profundidad de cada pasada, y con todo visible y sin descarte por
   *  cámara solo mientras se recorre la escena (esa parte de compileAsync es sincrónica). Idea tomada de boring-forest.
   *  Si algo no coincide, three.js rehace el objeto al dibujarlo: en el peor caso se compila de más, nunca se ve mal.
   *  Quedan fuera (se compilan al primer uso, son pocos y chicos): las mallas transparentes de dos caras, que compileAsync
   *  compila de dos caras y el render dibuja en dos pasadas (atrás y adelante), y la pasada del mapa de sombras. */
  async precompilar() {
    // una sola tanda a la vez: si llega otro grupo mientras se compila, se da otra vuelta al final (solo con lo nuevo)
    if (this._compilando) { this._otraVuelta = true; return this._compilando; }
    this._compilando = (async () => { do { this._otraVuelta = false; await this.#precompilarTanda(); } while (this._otraVuelta); })()
      .finally(() => { this._compilando = null; });
    return this._compilando;
  }
  /** true mientras precompilar() tiene trabajo pendiente. */
  get compilando() { return !!this._compilando; }

  /** Compila objeto por objeto, en tramos de ~25 ms con un cuadro de por medio: de un tirón eran 0,6 s de página congelada
   *  con WebGPU y 5 a 6 s con WebGL 2 (allí three.js arma y enlaza cada programa en el hilo principal). compileAsync con el
   *  objeto y la escena de destino (las luces y el entorno salen de ella) da las mismas claves que el render. Cada objeto se
   *  compila una vez por material: la vuelta que pide un grupo nuevo solo compila lo nuevo. */
  async #precompilarTanda() { await this.#compilar(this.scene); }

  /** Compila lo que cuelga de `raiz` y aún no está compilado con su material. Sirve también para un grupo que todavía no
   *  está en la escena (cargar() lo compila antes de agregarlo): las luces y el entorno salen de this.scene igual. */
  async #compilar(raiz) {
    const r = this.renderer, rc = r._renderContexts, get = rc.get;
    const hechos = (this._compilados ??= new WeakMap()), cola = [];
    raiz.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.material && hechos.get(o) !== o.material) cola.push(o); });
    const promesas = [], cuadro = () => new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 0)));
    const TRAMO = 25;
    let t0 = performance.now();
    for (const o of cola) {
      if (!o.parent || hechos.get(o) === o.material) continue;   // se quitó mientras tanto, o ya lo compiló otra tanda
      const rt0 = r.getRenderTarget(), mrt0 = r.getMRT(), v = o.visible, fc = o.frustumCulled;
      o.visible = true; o.frustumCulled = false;
      try {
        for (const p of this.pasadas ?? []) {
          r.setRenderTarget(p.renderTarget); r.setMRT(p._mrt ?? null);
          rc.get = (t, m) => get.call(rc, t, m, 1);      // las pasadas se dibujan dentro del render del postproceso (profundidad 1)
          promesas.push(r.compileAsync(o, this.camera, this.scene).catch(() => {}));
          rc.get = get;
        }
        hechos.set(o, o.material);
      } finally { rc.get = get; r.setRenderTarget(rt0); r.setMRT(mrt0); o.visible = v; o.frustumCulled = fc; }
      if (performance.now() - t0 > TRAMO) { await cuadro(); t0 = performance.now(); }
    }
    await Promise.all(promesas);
  }

  /** Resolución máxima: nunca más de ~3,7 millones de píxeles dibujados, ni más que el nivel de calidad. */
  dprMax() {
    const px = window.innerWidth * window.innerHeight, presupuesto = this.calidad.px ?? 3.7e6;
    return Math.max(0.6, Math.min(window.devicePixelRatio, this.calidad.dpr, Math.sqrt(presupuesto / px)));
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (w < 2 || h < 2) return;
    this._w = w; this._h = h;
    this.renderer.setPixelRatio(Math.min(this.renderer.getPixelRatio(), this.dprMax()));
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 58 : 38;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.csm?.updateFrustums();
    this.sucio = true;
  }

  // ---------- Sol, cielo, exposición ----------
  setSol(alt, az) {
    this.alt = alt; this.az = az;
    const v = vectorSol(alt, az);
    this.solDir.set(v.x, v.y, v.z).normalize();
    U.solDir.value.copy(this.solDir);
    this.sky.sunPosition.value.copy(this.solDir);
    this.sky2.sunPosition.value.copy(this.solDir);
    const up = Math.max(0, Math.sin(alt * Math.PI / 180));
    // luz directa: se apaga bajo el horizonte y se entibia cerca de él
    const k = THREE.MathUtils.smoothstep(alt, -1.5, 6);
    const warm = THREE.MathUtils.smoothstep(alt, 0, 35);
    this.sun.color.setRGB(1, 0.55 + 0.42 * warm, 0.3 + 0.62 * warm);
    const lv = this.lv ?? 0;               // lluvia visible (0..1)
    const ks = this.kSol ?? 1;             // transmisión del sol directo (DNI de los datos / DNI de cielo despejado)
    // la luz del sol sigue solo al dato (kSol): con lluvia en la escena, main.js ya lo pone en 0 (sin factor propio de la lluvia)
    this.sun.intensity = 5.0 * k * (0.55 + 0.45 * Math.min(1, up * 2)) * (0.1 + 0.9 * ks);
    const cub = 1 - ks;
    // con el sol velado por nubes delgadas o bruma la sombra pierde el borde nítido (el radio va en texeles del mapa, sin recompilar)
    this.sun.shadow.radius = 2 + 3 * cub;
    // De noche. El cielo de noche entra de 0,5° sobre el horizonte a 4° bajo él, para no tapar el arrebol. La misma luz
    // direccional pasa a ser la luna cuando el sol ya se apagó del todo (k = 0), así que nada se recompila.
    const S_ = THREE.MathUtils.smoothstep;
    const nv = 1 - S_(alt, -4, 4);
    U.nocturna.value = 1 - S_(alt, -4, 0.5);
    const modo = this.modoNoche ?? 'honesta';
    const nb = Math.min(1, Math.max(this.nb ?? 0.3, lv));   // nubes del dato; con lluvia, cielo cubierto
    // luna de esa noche (luna.js; la pone main.js). Su brillo frente a la llena sale de la magnitud según el ángulo de fase φ
    // (Allen, «Astrophysical Quantities»): la media luna da ~9 % de la llena, no la mitad. La extinción del aire la baja cerca
    // del horizonte (masa de aire de Kasten y Young, 1989).
    const L = this.luna;
    let bl = 0;
    if (L && L.alt > -1) {
      const phi = Math.acos(Math.min(1, Math.max(-1, 2 * L.frac - 1))) * 180 / Math.PI, h = Math.max(L.alt, 0);
      const masa = 1 / (Math.sin(h * Math.PI / 180) + 0.50572 * (h + 6.07995) ** -1.6364);
      bl = 10 ** (-0.4 * (0.026 * phi + 4e-9 * phi ** 4)) * Math.exp(-0.2 * (masa - 1)) * S_(L.alt, -0.5, 3);
    }
    this.brilloLuna = bl;
    // el disco: su brillo de superficie no depende de la fase (la fase cambia cuánto disco está iluminado), sí de la extinción
    // cerca del horizonte y de las nubes, que lo apagan casi del todo cuando cubren el cielo
    if (L && L.alt > -1) {
      const v = vectorSol(L.alt, L.az), ld = U.lunaDir.value.set(v.x, v.y, v.z).normalize();
      const h = Math.max(L.alt, 0), masa = 1 / (Math.sin(h * Math.PI / 180) + 0.50572 * (h + 6.07995) ** -1.6364);
      // sol visto desde la luna: forma con la dirección hacia la Tierra el ángulo de fase i (cos i = 2·frac − 1), del lado del sol
      const t = this.solDir.clone().addScaledVector(ld, -this.solDir.dot(ld));
      if (t.lengthSq() < 1e-8) t.set(0, 1, 0).addScaledVector(ld, -ld.y);
      t.normalize();
      const ci = Math.min(1, Math.max(-1, 2 * L.frac - 1)), si = Math.sqrt(1 - ci * ci);
      U.lunaLuz.value.copy(ld).multiplyScalar(-ci).addScaledVector(t, si).normalize();
      U.lunaDisco.value = NOCHE.lunaDisco * Math.exp(-0.2 * (masa - 1)) * S_(L.alt, -0.5, 1.5) * (1 - 0.93 * nb) * (1 - S_(alt, -6, 2));
      U.lunaNube.value = nb;
    } else U.lunaDisco.value = 0;
    const nl = k === 0 ? 1 - S_(alt, -5, -1.5) : 0;   // en −1,5° el sol termina de apagarse y la luna empieza
    let sd;
    if (k === 0) {
      if (bl > 0) { const v = vectorSol(L.alt, L.az); sd = new THREE.Vector3(v.x, v.y, v.z).multiplyScalar(600); }
      else sd = this._sd ? this._sd.clone() : this.solDir.clone().multiplyScalar(600);   // sin luna: la sombra no se recalcula
      this.sun.color.setRGB(...NOCHE.lunaColor);
      this.sun.intensity = NOCHE.lunaMax * bl * (1 - 0.9 * nb) * nl;
      this.sun.shadow.radius = 2 + 10 * nb;          // con nubes la luz de la luna llega difusa: sombra de borde blando
    } else sd = this.solDir.clone().multiplyScalar(600);
    if (!this._sd || this._sd.distanceTo(sd) > 0.4) { this._sd = sd.clone(); this.sun.shadow.needsUpdate = true; this.sucio = true; }
    this.sun.position.copy(sd); this.sun.target.position.set(0, 0, 0);
    if (this.ciudadOpc?.sombra === 'ajustada') this.#ajustarSombra();
    // castShadow queda siempre encendido: apagarlo al ponerse el sol también obligaba a recompilar los materiales
    if (this.rutaSol) { this.rutaSol.position.set(this.solDir.x * 70, this.solDir.y * 70 + 1, this.solDir.z * 70); this.rutaSol.visible = alt > -1; }
    // cielo y relleno
    const day = THREE.MathUtils.smoothstep(alt, -10, 12);
    const fl = U.relampago.value;
    // cielo cubierto de día: gris parejo, sin disco ni halo del sol, y una luz difusa fuerte que ilumina todo por igual
    // (así se ve una tarde de lluvia en una foto: gris y clara, no oscura como de noche)
    const cubierto = Math.min(0.92, Math.max(THREE.MathUtils.smoothstep(cub, 0.3, 0.95) * 0.85, lv * 0.95)) * day;
    U.cubierto.value = cubierto;
    const g = 0.06 + 0.66 * day;
    U.grisCielo.value.setRGB(g * 0.92, g * 0.96, g * 1.0);
    this.sky.showSunDisc.value = ks > 0.35 && lv < 0.3 ? 1 : 0;
    this.sky.mieCoefficient.value = 0.006 * (0.2 + 0.8 * ks) * (1 - 0.8 * lv);
    // bóveda de noche: nublada, el resplandor de la ciudad en las nubes; despejada, oscura y neutra, más clara con luna alta.
    // En el crepúsculo se suma la luz que queda del sol, que cae ~10 veces cada 4° (a −3° todavía se ve, a −15° ya no).
    const crep = alt >= -2 ? 1 : 10 ** ((alt + 2) / 4);
    const cmix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
    const lunaC = bl * (1 - nb);
    const H = cmix(NOCHE.despejadoH, NOCHE.nubladoH, nb).map((x, i) => x + NOCHE.lunaCielo[i] * lunaC + NOCHE.crepH[i] * crep);
    const Z = cmix(NOCHE.despejadoZ, NOCHE.nubladoZ, nb).map((x, i) => x + NOCHE.lunaCielo[i] * 0.8 * lunaC + NOCHE.crepZ[i] * crep);
    U.cieloH.value.setRGB(...H); U.cieloZ.value.setRGB(...Z);
    U.entornoN.value.setRGB(...H.map((x, i) => (x + Z[i]) / 2));
    // relleno: de día el de antes; de noche, la misma bóveda (así el muro en sombra nunca queda más claro que el cielo).
    // Relleno atado al dato: con cielo despejado, la razón entre suelo al sol y suelo en sombra que daría el cielo de esa hora
    // (Hay-Davies con la DNI, la difusa y Ai del dato, como la lente Sol: (DNI·sen h + DHI) / (DHI·(1 − Ai))) manda sobre el
    // relleno fijo de antes, que dejaba las sombras de una hora despejada en la mitad o un tercio de esa razón. Solo baja el
    // relleno, nunca lo sube: lo nublado queda como estaba. Sin dato de difusa, con lluvia o de noche, no actúa.
    // KAPPA lleva las luces de la escena a esa razón: medido el 15/02/2024 a las 10:00 en el concreto en planta, con el relleno
    // de antes, razón 3,61 en escena con el sol a 4,62 y 46,4° (salida AgX invertida; panel de sombras, 3 de octubre de 2026).
    let fRel = 1;
    const dhiD = U.dhiW.value, dniD = U.dniW.value, aiD = U.ai.value, sh = Math.sin(Math.max(alt, 0) * Math.PI / 180);
    if (alt > 2 && dhiD > 0 && lv < 0.05 && !(this.lluviaEsc ?? false)) {
      const KAPPA = 0.234, Rf = (dniD * sh + dhiD) / (dhiD * Math.max(0.05, 1 - aiD)), Rv = 1 + KAPPA * this.sun.intensity * sh / 0.30;
      if (Rf > 1.01) fRel = THREE.MathUtils.clamp((Rv - 1) / (Rf - 1), 0.3, 1);
    }
    this._fRel = (this._fRel ?? fRel) + (fRel - (this._fRel ?? fRel)) * 0.15;     // sin saltos al pasar de una hora a otra
    const rel = 1 + (this._fRel - 1) * day;
    const Iday = (0.08 + day * 0.22) * rel + day * 0.95 * cubierto;
    if (this._envRT) this.scene.environmentIntensity = 0.4 * rel;
    const hc = new THREE.Color().setRGB(0.55 + 0.27 * day, 0.62 + 0.21 * day, 0.85 - 0.02 * day).lerp(new THREE.Color(0.88, 0.89, 0.9), cubierto).multiplyScalar(Iday);
    const hn = new THREE.Color().setRGB(...H.map((x, i) => (x * 0.4 + Z[i] * 0.6) * NOCHE.relleno * 10));
    // techos y suelo abiertos ven la bóveda entera: reciben el 100 % de su luz, no el 35 % del relleno (lo que le llega al muro
    // en sombra, que ve media bóveda y el resto es suelo oscuro y edificios). Se suma la diferencia; el muro no cambia.
    U.cieloArriba.value.copy(hn).multiplyScalar((1 / NOCHE.relleno - 1) * nv / Math.PI);
    this.hemi.intensity = 1;
    this.hemi.color.copy(hc.lerp(hn, nv)).addScalar(5 * fl);
    const gd = new THREE.Color().setRGB(0.2 + 0.2 * day, 0.2 + 0.17 * day, 0.14 + 0.07 * day).multiplyScalar(Iday);
    this.hemi.groundColor.copy(gd.lerp(new THREE.Color(...NOCHE.suelo).multiply(hn), nv)).addScalar(5 * fl);
    // exposición: la noche honesta, 1,1 (antes 1,45); la exposición larga suma sus pasos sin agregar luz
    const larga = modo === 'larga' ? 2 ** (NOCHE.pasosLarga * U.nocturna.value) : 1;
    this.renderer.toneMappingExposure = (0.95 + (NOCHE.exposicion - 0.95) * (1 - day) + 0.2 * cubierto) * larga;
    U.purkinje.value = 0.8 * U.nocturna.value;
    // fuentes: el poste se enciende al ponerse el sol (fotocelda); las ventanas, como antes
    U.noche.value = 1 - S_(alt, -6, 2);
    U.poste.value = NOCHE.poste * (1 - S_(alt, -3, 1));
    U.ventanasN.value = NOCHE.ventanas * U.noche.value;
    U.posteCol.value.setRGB(...NOCHE.lamparas[this.lampara ?? 'led']);
    const fogC = new THREE.Color().setRGB(0.1 + 0.52 * day, 0.13 + 0.55 * day, 0.2 + 0.55 * day);
    fogC.lerp(new THREE.Color(g * 0.88, g * 0.92, g * 0.96), Math.max(lv, cubierto * 0.6));
    fogC.lerp(new THREE.Color(...H), nv);             // de noche, la niebla del color del horizonte
    this.scene.fog.color.copy(fogC);
    this._niebla = [350 - 310 * lv, 2600 - 1900 * lv];
    this.scene.fog.near = this._niebla[0] * (this.alejamiento ?? 1); this.scene.fog.far = this._niebla[1] * (this.alejamiento ?? 1);
    this.sky.cloudCoverage.value = Math.min(1, Math.max(U.nubeCob.value, lv));
    this.sky.cloudDensity.value = 0.45 + 0.5 * lv;
    this.sky.turbidity.value = 7 + 5 * lv;
    this.sky2.cloudCoverage.value = 0.2 + 0.75 * lv;
    U.luzLluvia.value = 0.62 + 0.38 * day + 2 * fl;              // de noche las gotas siguen visibles (reflejan las luces)
    const clave = [Math.round(alt * 4), Math.round(az * 2), Math.round(lv * 20), Math.round(cubierto * 20), Math.round(nv * 20), Math.round(nb * 20), Math.round(bl * 20), modo].join(',');
    if (clave !== this._envClave) { this._envClave = clave; this.#envTalVez(); }
  }

  /** Relámpagos durante los aguaceros. Devuelve true cuando cae uno (para el trueno). */
  actualizar(dt) {
    const lv = this.lv ?? 0; let cae = false;
    this._rel = (this._rel ?? 3) - dt;
    if (lv > 0.55 && this._rel <= 0) { this._rel = 5 + Math.random() * 14; this._flash = [0, 0.09, 0.2, 0.26]; this._ft = 0; cae = true; }
    if (this._flash) {
      this._ft += dt; const [a, b, c2, d] = this._flash, t = this._ft;
      U.relampago.value = t < b ? 1 : t < c2 ? 0.15 : t < d ? 0.7 : Math.max(0, 0.7 - (t - d) * 3);
      if (t > d + 0.3) { this._flash = null; U.relampago.value = 0; }
    }
    return cae;
  }

  #envTalVez() {
    const now = performance.now();
    if (this._envT && now - this._envT < 400) { this._envPend = true; return; }
    this._envT = now; this._envPend = false;
    try {
      // se reutiliza siempre el mismo render target: si cambiara la textura del entorno, three.js recompilaría
      // todos los materiales (eso congelaba ~0,8 s cada vez que el sol o la lluvia cambiaban)
      const rt = this.pmrem.fromScene(this.skyEnvScene, 0, 0.5, 2000, { size: 128, renderTarget: this._envRT ?? null });
      if (!this._envRT) { this._envRT = rt; this.scene.environment = rt.texture; this.scene.environmentIntensity = 0.4; }
      this.sucio = true;
    } catch (e) { /* sin mapa de entorno */ }
  }

  setNubes(cob) { U.nubeCob.value = cob; }

  /** Constantes de la noche (para ajustarlas desde las pruebas). */
  get NOCHE() { return NOCHE; }

  /** Noche: 'honesta' (la luz que hay) o 'larga' (la misma luz, con más exposición). */
  setModoNoche(m) { this.modoNoche = m === 'larga' ? 'larga' : 'honesta'; this.sucio = true; this.setSol(this.alt, this.az); }
  /** Lámpara del poste de la esquina: 'led' (4000 K) o 'sodio' (~2100 K). No se sabe cuál hay: es una suposición. */
  setLampara(k) { this.lampara = k; this.sucio = true; this.setSol(this.alt, this.az); }

  // ---------- Carga ----------
  /** Carga los grupos del modelo en el orden del armado; vegetación y contexto llegan al final. Con `calidad.diferidos`
   *  (teléfonos) esos grupos no entran en cargaCompleta: se piden después, en un rato libre, y la intro no los espera.
   *  Con `calidad.tejasLivianas` las cubiertas son cubiertas_movil.glb (fuente/tejas-movil.mjs: las mismas piezas y materiales,
   *  con cada teja simplificada; 1,0 MB en vez de 1,4 MB por la red y 2/3 de los triángulos), que proyectan la sombra ellas mismas. */
  async cargar(base, onProgress) {
    const loader = new GLTFLoader();
    try { await MeshoptDecoder.ready; loader.setMeshoptDecoder(MeshoptDecoder); } catch (e) { /* sin meshopt no hay modelo */ }
    const tex = new THREE.TextureLoader();
    const texturas = {};
    const cargaTex = (f) => texturas[f] ??= tex.loadAsync(conVersion(base + 'texturas/' + f)).then(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }).catch(() => null);
    const sinArboles = (g) => g !== 'arboles' || !/[?&]arboles=0/.test(location.search);   // ?arboles=0: sin los árboles de CdS
    const lista = (this.calidad.grupos ?? GRUPOS).filter(sinArboles);
    // los diferidos NO están en `lista` en el teléfono (se piden aparte): solo se les quita arboles con ?arboles=0
    const diferidos = GRUPOS.filter((g) => this.calidad.diferidos?.includes(g) && sinArboles(g));
    const livianas = !!this.calidad.tejasLivianas;
    const leerGLB = async (nombre) => {
      const bytes = await binario(base + 'modelo/' + nombre + '.glb', (l, t) => onProgress?.(nombre, l, t));
      return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), base + 'modelo/');
    };
    this.listos = new Set();
    this._leerGLB = leerGLB; this._cargaTex = cargaTex;   // la ciudad llega después (arrancarCiudad) con el mismo cargador
    const uno = async (nombre) => {
      const idx = GRUPOS.indexOf(nombre === 'arboles' ? 'vegetacion' : nombre);   // las copas de CdS se revelan con la vegetación (el armado llega hasta 8,4)
      const gltf = await leerGLB(livianas && (nombre === 'cubiertas' || nombre === 'arboles') ? nombre + '_movil' : nombre);   // arboles_movil: solo las copas sueltas
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const info = { root, idx, minY: box.min.y, maxY: box.max.y, box };
      const uMin = uniform(box.min.y), uMax = uniform(box.max.y);
      const materiales = [], pedidas = [], texG = (f) => { const p = cargaTex(f); pedidas.push(p); return p; };
      root.traverse((o) => {
        if (!o.isMesh) return;
        // proyectan sombra: todo menos las tejas (usan un sustituto liviano; las del teléfono, ya livianas, la proyectan ellas) y, del contexto, solo los vecinos a menos de ~60 m
        // del 106 (contexto.mjs los marca con extras.sombra; los lejanos no llegan al edificio), en la capa 1 (los dos mapas)
        const tejas = nombre === 'cubiertas' && /terracotta/i.test(o.material?.name || '');
        let vecino = false; for (let p = o; p && !vecino; p = p.parent) vecino = !!p.userData?.sombra;
        o.castShadow = (nombre !== 'contexto' || vecino) && (!tejas || livianas); o.receiveShadow = true;
        if (o.castShadow) o.layers.enable(1);
        // con la sombra gruesa de la ciudad, los demás edificios del contexto (cajas grises, volúmenes hechos a mano, copias del
        // 106) la proyectan solo en ese mapa: capa 2, que la cámara de la sombra fina no ve. El suelo, las calles y el agua, no
        else if (this.sunG && nombre === 'contexto' && !SUELO_CONTEXTO.test(o.material?.name || '')) { o.castShadow = true; o.layers.enable(CAPA_GRUESA); }
        o.material = this.#material(o.material, nombre, idx, uMin, uMax, texG);
        materiales.push(o.material);
      });
      info.materiales = materiales;
      // compilado antes de entrar a la escena, en tramos: si no, el primer cuadro con el grupo lo compilaba entero de un tirón
      // (0,2 a 1,6 s de imagen congelada por grupo con WebGL 2)
      // con sus texturas ya puestas: la textura cambia el sombreador (sRGB), y al llegar después se recompilaba el grupo
      try { await Promise.all(pedidas); await this.#compilar(root); } catch (e) { /* se compila al dibujar */ }
      // la pasada de la sombra también compila un programa por pieza al primer cuadro: las piezas entran a la capa de la sombra
      // de a pocas, un cuadro cada tanda (unos cuadros con la sombra del grupo a medias, mientras el armado todavía lo oculta)
      const sombra = []; root.traverse((o) => { if (o.isMesh && o.layers.isEnabled(1)) { sombra.push(o); o.layers.disable(1); } });
      this.grupos[nombre] = info;
      this.scene.add(root); this.sun.shadow.needsUpdate = true; this.sucio = true;
      this.#calentarSombra(sombra);
      this.listos.add(nombre); onProgress?.(nombre, 1, 1, this.listos.size / (orden.length + diferidos.length));
      if (nombre === 'cubiertas' && !livianas) this.#sombraCubiertas(leerGLB, idx, uMin, uMax);
      return info;
    };
    // de dos en dos, en el orden del armado: lo primero que se arma llega primero
    const orden = GRUPOS.filter(g => lista.includes(g) && !diferidos.includes(g));
    const promesas = {};
    let i = 0;
    const siguiente = () => { if (i >= orden.length) return null; const g = orden[i++]; return (promesas[g] = uno(g).catch((e) => { console.warn('grupo', g, e); this.listos.add(g); })).then(siguiente); };
    this.cargaCompleta = Promise.all([siguiente(), siguiente()]).then((r) => { this.cargado = true; return r; });
    this.promesas = promesas;
    // diferidos: de a uno, cuando el resto ya llegó y la página tiene un rato libre (no compiten con lo que se arma primero)
    const libre = () => new Promise((ok) => (window.requestIdleCallback ?? ((f) => setTimeout(f, 200)))(ok, { timeout: 2000 }));
    this.cargaDiferida = diferidos.length ? this.cargaCompleta.then(async () => {
      for (const g of diferidos) { await libre(); await (promesas[g] = uno(g).catch((e) => { console.warn('grupo', g, e); this.listos.add(g); })); }
    }) : this.cargaCompleta;
    return this;
  }

  // ---------- LA CIUDAD (encendida por defecto): edificios del kit, su nivel y su sombra ----------
  /** Nivel antes de cargar nada (ciudad-nivel.js): lo que el navegador dice del equipo. Si el vigía ya la bajó en este equipo con
   *  esta versión del sitio, se empieza ahí. Decide también si se arma la sombra gruesa (solo si el nivel de partida la usa). */
  async #nivelCiudadInicial() {
    const o = this.ciudadOpc;
    o.cap = await capacidad(this.renderer, this.backend).catch(() => ({ telefono: false, debil: false, software: false }));
    let r = o.nivelPedido ? { nivel: o.nivelPedido, motivo: 'pedido en la URL' } : nivelEstatico(o.cap);
    let antes = null; try { antes = localStorage.getItem('e106-ciudad-nivel'); } catch (e) { /* sin almacenamiento */ }
    const [na, va] = (antes ?? '').split('|');
    if (!o.nivelPedido && !PRUEBA && va === VER && NIVELES.indexOf(na) > NIVELES.indexOf(r.nivel)) { r = { nivel: na, motivo: r.motivo + ', ya bajó antes en este equipo' }; o.piso = na; }
    o.nivel = r.nivel; o.motivo = r.motivo; o.estatico = r.nivel;
    o.gpu = [o.cap.vendedor, o.cap.arquitectura, o.cap.gpu].filter(Boolean).join(' · '); o.telefono = o.cap.telefono;
    if (!o.sombra) { o.sombra = NIVEL[o.nivel].sombra ? 'doble' : 'actual'; o.porDefecto = true; }
  }
  /** Carga la ciudad cuando el 106 y lo diferido ya llegaron y terminó la intro (`antes`, de main.js), en un rato libre: primero
   *  un sondeo corto del cuadro (sin ?prueba ni ?ciudadnivel=), que ajusta el nivel, y después los GLB de ese nivel. */
  arrancarCiudad(antes = Promise.resolve()) {
    const o = this.ciudadOpc;
    if (!o || this.cargaCiudad) return this.cargaCiudad;
    const libre = () => new Promise((ok) => (window.requestIdleCallback ?? ((f) => setTimeout(f, 200)))(ok, { timeout: 2000 }));
    this.cargaCiudad = (async () => {
      await Promise.all([this.cargaDiferida, antes]);
      await libre();
      if (o.nivel === 'oculta') { this.alCambiarCiudad?.(); return; }
      if (!o.nivelPedido && SONDEA) {
        // en reposo: sin cuadros de la app desde hace 0,4 s (después de la intro viene el vuelo a «Ahora»), hasta 8 s
        for (const t0 = performance.now(); performance.now() - (this._dibujo ?? 0) < 400 && performance.now() - t0 < 8000;) await new Promise((ok) => setTimeout(ok, 100));
        o.sondeoMs = await this.medirCuadro(10).catch(() => null);
        const r = nivelSondeo({ nivel: o.nivel, motivo: o.motivo }, o.sondeoMs, o.cap);
        let n = r.nivel;
        if (o.piso && NIVELES.indexOf(o.piso) > NIVELES.indexOf(n)) n = o.piso;          // lo que el vigía ya bajó no se vuelve a subir
        if (NIVEL[n].sombra && !this.sunG) n = 'liviano';                                  // sin la sombra gruesa armada al iniciar
        o.nivel = n; o.motivo = r.motivo + (n !== r.nivel ? ` (queda en ${n})` : '');
      }
      await this.#cargarCiudad();
    })().catch((e) => console.warn('ciudad', e));
    return this.cargaCiudad;
  }
  /** La capa «Ciudad del Saber (aproximada)». Encendida sin haberla cargado (?ciudad=0 o apagada al entrar): la carga ahora,
   *  sin sombra gruesa (no se armó al iniciar) y sin vigía. Encendida a mano después de que el vigía la escondió: vuelve en el
   *  nivel liviano y el vigía ya no la toca. */
  async mostrarCiudad(si) {
    this.ciudadEncendida = !!si;
    if (si && !this.ciudadOpc) {
      this.ciudadOpc = { sombra: 'actual', mapa: null, nivelPedido: null, nivel: 'liviano', motivo: 'encendida en Capas', manual: true, tarde: true };
      this.ciudadOpc.cap = await capacidad(this.renderer, this.backend).catch(() => ({}));
      this.alCambiarCiudad?.();
      await (this.cargaCiudad = this.#cargarCiudad().catch((e) => console.warn('ciudad', e)));
      return;
    }
    const o = this.ciudadOpc; if (!o) return;
    if (si && o.nivel === 'oculta') { o.manual = true; o.motivo = 'encendida en Capas'; if (!this.ciudad) { o.nivel = 'liviano'; await (this.cargaCiudad = this.#cargarCiudad().catch((e) => console.warn('ciudad', e))); return; } this.fijarNivelCiudad('liviano'); return; }
    if (this.ciudad) this.fijarNivelCiudad(o.nivel); else this.alCambiarCiudad?.();
  }
  async #cargarCiudad() {
    const o = this.ciudadOpc, t0 = performance.now();
    const { Ciudad } = await import('./ciudad.js');
    // material: la misma función que pinta al 106 y a sus copias del contexto (grupo «contexto»: sin lentes ni interiores)
    const idx = GRUPOS.indexOf('contexto'), sinTex = () => Promise.resolve(null), cargaTex = this._cargaTex;
    this.ciudad = new Ciudad(this, { U, sombraNubes: /[?&]sinnubes/.test(location.search) ? soloSombraSol : sombraNubes, sombraSol, NOCHE,
      conAlto: o.sombra === 'sunlight' || o.sombra === 'csm' ? true : NIVEL[o.nivel].alto,
      // el asfalto de los estacionamientos (pulido) lleva la textura del de las calles del contexto, el mismo material: donde se pisan no se nota
      material: (src, opc) => this.#material(src, 'contexto', idx, uniform(0), uniform(1), src.userData?.ciudadParte === 'asfalto' ? cargaTex : sinTex, opc) });
    this.ciudad.pedir(this._leerGLB);
    const raiz = await this.ciudad.montar();
    try { await this.#compilar(raiz); } catch (e) { /* se compila al dibujar */ }
    this.scene.add(raiz);
    // el contexto (si llegó) sin las copias del 106 que el kit reemplaza ni sus cajas; al apagar la ciudad vuelven
    if (this.grupos.contexto?.root) await this.ciudad.filtrarContexto(this.grupos.contexto.root).catch((e) => console.warn('ciudad: filtrar contexto', e));
    this.ciudadLista = true;
    o.cargaMs = Math.round(performance.now() - t0);
    if (o.sombra === 'ajustada') this.#ajustarSombra();
    this.fijarNivelCiudad(o.nivel);
  }
  /** Aplica un nivel sin recargar: detalle alto, sombra gruesa (y su tamaño) y si se ve. */
  fijarNivelCiudad(n) {
    const o = this.ciudadOpc; if (!o || !NIVEL[n]) return;
    o.nivel = n;
    const N = NIVEL[n], ver = !N.oculta && this.ciudadEncendida !== false;
    this.ciudad?.usarAlto(N.alto);
    this.ciudad?.mostrar(ver);
    if (this.sunG) {
      const usa = ver && N.sombra > 0 && !!this.ciudadLista;
      this.uGruesa.value = usa ? 1 : 0;
      if (usa) { const m = Math.min(N.sombra, this.ciudadOpc.maxTex ?? 4096); this.sunG.shadow.mapSize.set(m, m); this._gruesaSucia = true; }
    }
    this.sun.shadow.needsUpdate = true; this.sucio = true;
    this.alCambiarCiudad?.();
  }
  /** Vigía (main.js le pasa el intervalo de cada cuadro dibujado seguido, sin intro, viaje ni carga). Si la mediana de unos 3 s
   *  pasa de VIGIA.lento ms y un sondeo confirma que el cuadro cuesta (no es una pantalla a 30 Hz), baja un escalón y lo anota
   *  (localStorage «e106-ciudad-nivel», para la próxima visita con esta versión). Con ?prueba o ?ciudadnivel= no actúa. */
  cuadroCiudad(iv) {
    const o = this.ciudadOpc;
    if (!o || !this.ciudadLista || !VIGILA || o.nivelPedido || o.manual || this._vigiaOcupado || this.ciudadEncendida === false || o.nivel === 'oculta') return;
    const med = (this._vigia ??= new Vigia()).cuadro(iv);
    if (med == null || med <= VIGIA.lento) return;
    const sig = bajar(o.nivel); if (!sig) return;
    this._vigiaOcupado = true;
    this.medirCuadro(6).catch(() => null).then((ms) => {
      if (ms != null && ms < VIGIA.confirma) return;
      (o.caidas ??= []).push({ s: Math.round(performance.now() / 100) / 10, de: o.nivel, a: sig, medianaMs: Math.round(med * 10) / 10, cuadroMs: ms == null ? null : Math.round(ms * 10) / 10 });
      o.motivo = `bajó sola de ${o.nivel} a ${sig}`;
      try { localStorage.setItem('e106-ciudad-nivel', sig + '|' + VER); } catch (e) { /* sin almacenamiento */ }
      this.fijarNivelCiudad(sig);
    }).finally(() => { this._vigiaOcupado = false; this._vigia.reiniciar(); });
  }
  /** Costo de un cuadro (ms): dibuja n cuadros y espera cada vez a que la GPU termine (WebGPU: una copia del lienzo obliga a
   *  mandar los comandos y onSubmittedWorkDone espera; WebGL 2: leer un píxel obliga a terminar). Mediana sin los dos primeros.
   *  Los cuadros son iguales a los que ya se ven: no se nota. */
  async medirCuadro(n = 12) {
    const r = this.renderer, be = r.backend, gl = be.gl, px = new Uint8Array(4), out = [];
    for (let i = 0; i < n; i++) {
      await new Promise((ok) => requestAnimationFrame(ok));
      if (document.visibilityState !== 'visible') return null;
      const t = performance.now(); this.render();
      if (be.isWebGPUBackend) { const b = await createImageBitmap(r.domElement, 0, 0, 1, 1); b.close(); await be.device.queue.onSubmittedWorkDone(); }
      else gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      if (i >= 2) out.push(performance.now() - t);
    }
    out.sort((a, b) => a - b);
    return out.length ? out[out.length >> 1] : null;
  }
  /** La cámara de la sombra gruesa sigue al sol y se ajusta a la caja de la ciudad (y la del sitio) vista desde el sol. El sesgo
   *  va en texeles: normalBias de 2 texeles y bias de (1 + 1 / tan(altura del sol)) texeles de profundidad. */
  #ajustarGruesa() {
    const G = this.sunG, sun = this.sun;
    G.position.copy(sun.position); G.target.position.copy(sun.target.position); G.updateMatrixWorld(); G.target.updateMatrixWorld();
    G.shadow.radius = 1;                                 // PCF de un texel: con más, el texel grueso se mezcla con el vecino
    const caja = new THREE.Box3(new THREE.Vector3(-70, -30, -70), new THREE.Vector3(70, 20, 70));
    if (this.ciudad?.cajaSombra && !this.ciudad.cajaSombra.isEmpty()) caja.union(this.ciudad.cajaSombra);
    const sc = G.shadow.camera, ojo = G.position, M = new THREE.Matrix4().lookAt(ojo, G.target.position, sc.up);
    const x = new THREE.Vector3().setFromMatrixColumn(M, 0), y = new THREE.Vector3().setFromMatrixColumn(M, 1), z = new THREE.Vector3().setFromMatrixColumn(M, 2);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, d0 = Infinity, d1 = -Infinity; const v = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? caja.max.x : caja.min.x, i & 2 ? caja.max.y + 10 : caja.min.y, i & 4 ? caja.max.z : caja.min.z).sub(ojo);
      const a = v.dot(x), b = v.dot(y), d = -v.dot(z);
      x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); d0 = Math.min(d0, d); d1 = Math.max(d1, d);
    }
    Object.assign(sc, { left: x0, right: x1, bottom: y0, top: y1, near: d0 - 20, far: d1 + 20 });
    sc.updateProjectionMatrix();
    // sesgo en texeles, mayor con el sol bajo (el suelo cruza más profundidad por texel): sin eso el terreno se sombreaba solo
    const texel = Math.max(x1 - x0, y1 - y0) / G.shadow.mapSize.x, tanAlt = Math.max(0.15, Math.tan(Math.asin(Math.min(1, Math.max(0, z.y)))));
    G.shadow.normalBias = 2 * texel; G.shadow.bias = -texel * (1 + 1 / tanAlt) / (sc.far - sc.near);
    G.shadow.needsUpdate = true; this._gruesaSucia = false;
    this._gruesa = { ancho: x1 - x0, alto: y1 - y0, texel, mapa: G.shadow.mapSize.x };
  }
  /** SunLight de r186 (addon): dos cascadas en un atlas, ajustadas cada cuadro a la cámara. Sin target: la dirección es su
   *  posición; se le da un target vacío para que el resto de escena.js no cambie. */
  async #solSunLight() {
    const [{ SunLight }, { SunLightNode }] = await Promise.all([import('three/addons/lights/SunLight.js'), import('three/addons/lights/SunLightNode.js')]);
    this._sunNodo = [SunLightNode, SunLight]; this.renderer.library.addLight(SunLightNode, SunLight);
    const sun = new SunLight(0xffffff, 3); sun.target = new THREE.Object3D();
    return sun;
  }
  /** Ajustes de cada opción de sombra (después de la configuración de siempre). */
  async #sombraCiudad() {
    const sun = this.sun, modo = this.ciudadOpc.sombra;
    // tamaño pedido con &sombramapa=…, recortado al máximo del equipo (en SunLight el atlas mide 2 × mapa de ancho; un teléfono
    // con WebGL 2 puede tener un máximo de 4.096). Queda anotado en this.ciudadOpc.mapaUsado para ?medir=1
    const b = this.renderer.backend, maxTex = b.device?.limits?.maxTextureDimension2D ?? b.gl?.getParameter(b.gl.MAX_TEXTURE_SIZE) ?? 4096, sc0 = sun.shadow.camera;
    const pedido = this.ciudadOpc.mapa && this.ciudadOpc.mapa >= 256 ? 2 ** Math.round(Math.log2(this.ciudadOpc.mapa)) : null;
    const mapa = pedido ? Math.min(pedido, modo === 'sunlight' ? maxTex / 2 : maxTex) : null;
    this.ciudadOpc.maxTex = maxTex;
    if (modo === 'actual') { if (mapa) sun.shadow.mapSize.set(mapa, mapa); }
    else if (modo === 'doble') {
      // el mapa fino queda exactamente como el publicado; la luz de la sombra gruesa no está en la escena ni ilumina
      const g = new THREE.DirectionalLight(0xffffff, 0); g.castShadow = true; g.name = 'sombra gruesa de la ciudad';
      const m = Math.min(mapa ?? (NIVEL[this.ciudadOpc.nivel].sombra || 2048), maxTex);
      g.shadow.mapSize.set(m, m); g.shadow.camera.layers.set(1); g.shadow.camera.layers.enable(CAPA_GRUESA); g.shadow.autoUpdate = false; g.shadow.needsUpdate = false;
      this.sunG = g; this.uGruesa = uniform(0);                        // 0 hasta que la ciudad está montada
      GRUESA = { nodo: new SombraGruesa(g), uso: this.uGruesa, fina: lightShadowMatrix(sun), margen: MARGEN_FINA / (sc0.right - sc0.left) };
    }
    else if (modo === 'sunlight') {
      const m = mapa ?? Math.min(this.calidad.sombras, 2048);          // por cascada: el atlas mide 2m × m
      sun.shadow.mapSize.set(m, m); sun.shadow.camera.near = 10; sun.shadow.camera.far = 600;   // alcance de las cascadas
      for (let i = 0; i < 2; i++) sun.shadow.getCamera(i).layers.set(1);   // como la cámara de sombra de siempre: solo la capa 1
      sun.shadow.autoUpdate = true;                                      // las cascadas siguen a la cámara: se rehacen cada cuadro
    } else if (modo === 'csm') {
      const { CSMShadowNode } = await import('three/addons/csm/CSMShadowNode.js');
      const m = mapa ?? Math.min(this.calidad.sombras, 2048);
      sun.shadow.mapSize.set(m, m); sun.shadow.autoUpdate = true;
      const csm = new CSMShadowNode(sun, { cascades: 3, maxFar: 600, mode: 'practical', lightMargin: 300 });
      csm.fade = true; sun.shadow.shadowNode = csm; this.csm = csm;
    } else if (modo === 'ajustada') {
      if (mapa) sun.shadow.mapSize.set(mapa, mapa);
    }
    this.ciudadOpc.mapaUsado = sun.shadow.mapSize.x;
  }
  /** Un solo mapa de sombra ajustado a la caja de la ciudad (el kit y el sitio del 106) vista desde el sol de
   *  ahora, como el ejemplo webgpu_generator_city. El sesgo se escala para que en metros sea el mismo de siempre. */
  #ajustarSombra() {
    const caja = new THREE.Box3(new THREE.Vector3(-70, -2, -70), new THREE.Vector3(70, 20, 70));
    if (this.ciudad?.caja) caja.union(this.ciudad.caja);
    const sc = this.sun.shadow.camera, ojo = this.sun.position, M = new THREE.Matrix4().lookAt(ojo, this.sun.target.position, sc.up);
    const x = new THREE.Vector3().setFromMatrixColumn(M, 0), y = new THREE.Vector3().setFromMatrixColumn(M, 1), z = new THREE.Vector3().setFromMatrixColumn(M, 2);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, d0 = Infinity, d1 = -Infinity; const v = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? caja.max.x : caja.min.x, i & 2 ? caja.max.y : caja.min.y, i & 4 ? caja.max.z : caja.min.z).sub(ojo);
      const a = v.dot(x), b = v.dot(y), d = -v.dot(z);
      x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); d0 = Math.min(d0, d); d1 = Math.max(d1, d);
    }
    Object.assign(sc, { left: x0, right: x1, bottom: y0, top: y1, near: Math.max(0.5, d0 - 20), far: d1 + 20 });
    sc.updateProjectionMatrix();
    // la app usa bias −0,0004 sobre un rango de 1.390 m (near 10, far 1.400): −0,56 m en profundidad; aquí, lo mismo en metros
    this.sun.shadow.bias = -0.0004 * 1390 / (sc.far - sc.near);
    this._ajuste = { ancho: x1 - x0, alto: y1 - y0, rango: sc.far - sc.near, texel: Math.max(x1 - x0, y1 - y0) / this.sun.shadow.mapSize.x };
  }

  /** Una pieza por cuadro a la capa de la sombra (cada pieza trae su material: hasta 33 por grupo, ~1 s a 60 Hz). */
  async #calentarSombra(piezas) {
    const cuadro = () => new Promise((ok) => requestAnimationFrame(ok)), TANDA = 1;
    for (let i = 0; i < piezas.length; i += TANDA) {
      for (const o of piezas.slice(i, i + TANDA)) o.layers.enable(1);
      this.sun.shadow.needsUpdate = true; this.sucio = true;
      if (i + TANDA < piezas.length) { await cuadro(); await cuadro(); }
    }
  }

  /** Sustituto de sombra de las tejas: solo lo ve la cámara de la sombra (capa 1). */
  async #sombraCubiertas(leerGLB, idx, uMin, uMax) {
    try {
      const g = await leerGLB('cubiertas_sombra');
      const reveal = clamp(U.build.sub(uniform(idx)).sub(0.78).div(0.5), 0, 1);
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
        m.maskNode = positionWorld.y.lessThan(mix(uMin.sub(0.6), uMax.add(0.8), reveal));
        o.material = m; o.castShadow = true; o.receiveShadow = false; o.layers.set(1);
      });
      this.scene.add(g.scene); this.sun.shadow.needsUpdate = true;
    } catch (e) { /* sin sustituto: las tejas no proyectan sombra */ }
  }

  /** opc (solo la ciudad la usa): { aoAlturas } = alturas del encuentro muro-alero para el sustituto de oclusión de un edificio
   *  que no es el 106; { aoAtributo } = esa distancia viene por vértice en el atributo _aoh (ciudad.glb, ver ciudad-kit.mjs). Sin opc, el material es exactamente el de siempre. */
  #material(src, grupo, idx, uMin, uMax, cargaTex, opc = {}) {
    const ex = src.userData || {};
    const nm = (src.name || '').toLowerCase();
    const base = src.color ? src.color.clone() : new THREE.Color(0.7, 0.7, 0.7);
    const glass = ex.glass || nm.includes('glass');
    const leaf = ex.leaf;
    const m = new THREE.MeshStandardNodeMaterial({
      color: base, roughness: src.roughness ?? 0.8, metalness: src.metalness ?? 0,
      side: leaf ? THREE.DoubleSide : THREE.FrontSide,
    });
    m.name = src.name;
    let colBase = materialColor;     // referencia al color del material: el mismo shader sirve para todos
    if (ex.image) {
      // el suelo llega sin coordenadas de textura: se proyecta desde arriba, con el tamaño de repetición que anota el exportador
      const f = ex.image.replace(/_4k\.jpg$|_2k\.jpg$/, '_1k.webp');
      const rep = ex.ground_uv || 2;
      // el color del material es el promedio que dio Blender (con el tinte del nodo: el pasto de Poly Haven es pardo y allá
      // se tiñe de verde); la textura solo aporta la variación alrededor de su propio promedio
      const tn = texture(TEX_BLANCA, positionWorld.xz.div(rep)), inv = uniform(new THREE.Vector3(1, 1, 1));
      cargaTex(f).then((t) => { if (t) { tn.value = t; inv.value.copy(promedioInverso(t.image)); this.sucio = true; } });
      colBase = tn.rgb.mul(inv).mul(materialColor);
    }
    if (glass) {
      m.color.setRGB(0.03, 0.04, 0.045); m.roughness = 0.06; m.metalness = 0.0;
      colBase = materialColor;
      m.envMapIntensity = 1.6;
      // luces interiores de noche: celdas de 3,8 m × 3,65 m, encendidas al azar (~65 %)
      const cell = floor(vec2(positionWorld.x.add(positionWorld.z).div(3.8), positionWorld.y.div(3.65)));
      // en los edificios vecinos (paños de vidrio grandes) se encienden menos y más tenues, para que no aparezcan bloques de luz
      const on = step(grupo === 'contexto' ? 0.6 : 0.35, hash(cell.x.mul(17.0).add(cell.y.mul(131.0)))).mul(grupo === 'contexto' ? 0.45 : 1);
      // con la noche honesta la escena es oscura y las ventanas vuelven a ser lo más claro (U.ventanasN). Luz blanca de ~4000 K:
      // en las fotos de los salones hay paneles LED en cielorraso de placas, paredes blancas y piso claro (antes era naranja)
      const plano = vec3(...NOCHE.lamparas.led).mul(NOCHE.ventanaLum).mul(U.ventanasN);
      m.emissiveNode = plano.mul(on);
      // en el edificio 106, detrás del vidrio hay cuartos (interiores.js): la luz sale de los paneles del cielorraso y de lo que
      // alumbran, no del vidrio entero; el vidrio mismo queda casi negro (no tiene color difuso) y conserva su reflejo
      if (grupo !== 'contexto') {
        colBase = materialColor.mul(mix(float(1), float(0.25), conCuarto()));   // el desfogue conserva el vidrio de antes
        this._cieloLuz ??= uniform(this.hemi.color);                    // el relleno del cielo (setSol lo actualiza en su lugar)
        this.interiorK = K_INTERIOR;                                    // ganancias del interior (para ajustarlas desde las pruebas)
        m.emissiveNode = luzInterior({ lampara: vec3(...NOCHE.lamparas.led), ventanasN: U.ventanasN, noche: U.noche, cieloLuz: this._cieloLuz,
          lente: max(U.calor, U.agua), mat: U.mat, simple: this.calidad.nivel === 'bajo', plano });
      }
    }
    const nmPlaster = (nm.includes('plaster') || nm.includes('cream trim')) && !nm.includes('interior');
    let colorFinal = colBase;
    // interiores inventados (v014): oscuros y neutros, para que detrás del vidrio no aparezcan manchas blancas
    if (nm.includes('interior') || nm.includes('ceiling') || nm.includes('diffuser')) colorFinal = colBase.mul(0.3);
    if (nmPlaster) {
      // blanco casi neutro, como en las fotos (WA0014, WA0024), en lugar del gris verdoso que dejó el promedio del exportador
      colBase = colBase.mul(vec3(0.99, 0.97, 0.93));
      // pañete: algas y salpicadura en la base del muro + manchas amplias de la pintura
      const y = positionWorld.y;
      const n = mx_fractal_noise_float(positionWorld.mul(vec3(0.35, 0.9, 0.35)), 3, 2.0, 0.5).mul(0.5).add(0.5);
      const base_ = smoothstep(1.0, 0.0, y).mul(0.35).mul(n.add(0.4));
      const stain = mx_noise_float(positionWorld.mul(vec3(0.08, 0.3, 0.08))).mul(0.06);
      colorFinal = colBase.mul(float(1).sub(base_).sub(stain)).mul(vec3(1, 1.0, 0.985)).add(vec3(-0.02, 0.0, -0.02).mul(base_));
    }
    if (nm.includes('terracotta') || nm.includes('clay')) {
      const n = mx_noise_float(positionWorld.mul(1.7)).mul(0.5).add(0.5);
      // más naranja y menos azul, medido contra las tejas de WA0014, WA0018, WA0024 (mediana ≈ (125, 63, 50))
      colorFinal = colBase.mul(vec3(1.2, 0.85, 0.7)).mul(mix(0.78, 1.25, n));
    }
    // bajo los aleros: las caras que miran hacia abajo solo ven el suelo y la sombra del propio alero (en las fotos se leen
    // como una franja parda oscura); no reciben sol directo, así que oscurecerlas no cambia ninguna sombra del análisis
    if (!leaf && !glass && grupo !== 'sitio' && grupo !== 'vegetacion' && grupo !== 'arboles') {
      const abajo = smoothstep(-0.2, -0.75, normalWorld.y).mul(smoothstep(2.4, 3.2, positionWorld.y));
      colorFinal = colorFinal.mul(mix(float(1), float(0.22), abajo));   // cabios y sofitos: en las fotos, una franja parda oscura
    }
    // sustituto de oclusión bajo los aleros (hasta hornear la de Blender): el alero de 1,65 m le tapa el cielo al muro en
    // el metro y pico bajo su encuentro, medido en el modelo a 4,40 · 8,05 · ~11,7 m
    if (nmPlaster && (opc.aoAlturas || opc.aoAtributo || (grupo !== 'sitio' && grupo !== 'contexto'))) {
      const y = positionWorld.y, vertical = smoothstep(0.6, 0.3, abs(normalWorld.y));
      // fuerte en el primer metro (entre los cabios, donde las fotos muestran una franja oscura) y se desvanece hacia 1,6 m
      const bajo = (j) => step(y, j).mul(smoothstep(1.6, 0.5, float(j).sub(y)));
      // con aoAtributo, la distancia j − y llega por vértice (cortada en cada junta: exacta en cada píxel) y la junta es la de su franja
      const occ = (opc.aoAtributo ? smoothstep(1.6, 0.5, attribute('_aoh', 'float')) : (opc.aoAlturas ?? [4.4, 8.05, 11.7]).map(bajo).reduce((a, b) => max(a, b))).mul(vertical);
      // como oclusión ambiental: el alero le tapa el cielo al muro, no el sol. El sol bajo de la mañana que entra bajo el alero
      // (la SE en enero, «Ver el corte del alero») sigue entrando con toda su fuerza. 0,15 en el encuentro sigue el perfil de una
      // foto de un bloque gemelo, nublado (~8 a 1 en el contacto; panel de sombras, 3 de octubre de 2026). Antes multiplicaba el
      // color por 0,32, y eso apagaba también el sol directo
      m.aoNode = mix(float(1), float(0.15), occ);
    }
    m.colorNode = mix(clayColor, colorFinal, U.mat);
    if (glass) m.colorNode = mix(clayColor.mul(0.35), colorFinal, U.mat);

    // Formas de ver sobre el edificio (muros, cubiertas y vidrio). El grupo «sitio» trae también partes del edificio (el muro
    // de la planta baja de la fachada suroeste, rejillas, marcos, pilares del acceso): esas sí se pintan; el suelo, no.
    const delEdificio = grupo !== 'sitio' || /plaster|trim|louvre|frame|soffit|service access|ventilation|plinth|piers|timber|guardrail|entrance/.test(nm);
    if (!leaf && grupo !== 'contexto' && grupo !== 'vegetacion' && grupo !== 'arboles' && delEdificio) {   // solo el edificio
      const n = normalWorld;
      // Sol: la radiación que llega a cada punto, con la sombra real (el mismo mapa de sombras de la escena)
      const cosInc = max(dot(n, U.solDir), 0);
      const directa = U.dniW.mul(cosInc).mul(sombraSol);
      // difusa de cielo anisótropo (Hay-Davies): una parte viene de alrededor del sol y se comporta como la directa (con su
      // coseno y su sombra); el resto es un cielo parejo. Rb acota el coseno del cenit a 0,087 (sol a 5°) para que el sol bajo
      // no la dispare. Más la reflejada por un suelo que devuelve el 20 %.
      const rb = cosInc.div(max(U.solDir.y, 0.087));
      const difusa = U.dhiW.mul(U.ai.mul(rb).mul(sombraSol).add(float(1).sub(U.ai).mul(n.y.add(1).mul(0.5))))
        .add(U.ghiW.mul(0.1).mul(float(1).sub(n.y)));
      const irr = directa.add(difusa.mul(U.total)).div(800);
      // escala de calor ordenada (azul noche → morado → rojo → naranja → amarillo), con colores puros para que el tonemapping no la lave
      const s4 = (a, b) => clamp(irr.sub(a).div(b - a), 0, 1);       // tramos lineales, como la leyenda (rampaCSS)
      const [c0, c1, c2, c3, c4] = RAMPA_SOL.map((c) => vec3(...c));
      const ramp = mix(mix(mix(mix(c0, c1, s4(0.0, 0.25)), c2, s4(0.25, 0.5)), c3, s4(0.5, 0.75)), c4, s4(0.75, 1.0));
      const e = ramp.mul(U.calor).mul(0.8);
      // lluvia con viento y viento de frente: reparto por orientación, con la paleta de cada lente (el techo queda neutro)
      const w = (nx, nz) => pow(max(dot(n, vec3(nx, 0, nz)), 0), 3.0);
      const dirs = Object.values(FACHADAS).map(fc => { const v = vectorSol(0, fc.rumbo); return [v.x, v.z]; });
      const a = U.aguaF;
      const wet = w(...dirs[0]).mul(a.x).add(w(...dirs[1]).mul(a.y)).add(w(...dirs[2]).mul(a.z)).add(w(...dirs[3]).mul(a.w)).add(pow(max(n.y, 0), 3.0).mul(U.aguaT));
      const rampA = mix(mix(vec3(U.pal0), vec3(U.pal1), clamp(wet.mul(2), 0, 1)), vec3(U.pal2), clamp(wet.mul(2).sub(1), 0, 1));   // lineal, como la leyenda
      // el índice de lluvia y el viento de frente valen para paredes verticales: techo, aleros y suelo quedan con su material
      // (en «Año típico» del Sol el techo sí se pinta, con aguaT)
      const vert = float(1).sub(smoothstep(0.35, 0.6, abs(n.y)));
      const lenteA = U.agua.mul(max(vert, step(0.001, U.aguaT)));
      const eA = rampA.mul(lenteA).mul(0.8);
      const prevE = m.emissiveNode;
      m.emissiveNode = prevE ? prevE.add(eA) : eA;
      // la lente «Sol» se suma después de la iluminación, cuando sombraSol ya trae la sombra (ver arriba, junto a sombraSol)
      m.outputNode = vec4(output.rgb.add(e), output.a);
      // el material se apaga (color y brillos) para que mande el color de la lente
      const lente = max(U.calor, lenteA);
      m.colorNode = mix(m.colorNode, m.colorNode.mul(0.04), lente);
      m.roughnessNode = mix(m.roughnessNode ?? materialRoughness, float(1), lente);
      m.lenteNode = lente;
    }

    // Mojado: superficies porosas más oscuras y brillantes; charcos en superficies horizontales bajas. El pasto del entorno
    // (contexto.mjs, «V017 grass turf») se trata como el del sitio, que es vegetación y no se moja: si no, con lluvia los dos
    // pastos se separaban de tono y la unión volvía a cruzar el cuadrángulo
    if (!glass && !leaf && !/V017 grass turf/.test(src.name || '')) {
      const metal = nm.includes('alumin') || nm.includes('guardrail') || nm.includes('galvan') || nm.includes('cabinet');
      const poro = uniform(metal ? 0.25 : 1.0);
      const up = smoothstep(0.55, 0.95, normalWorld.y);
      const nch = mx_noise_float(vec3(positionWorld.x.mul(0.11), positionWorld.z.mul(0.11), 3.7)).mul(0.5).add(0.5);
      const charco = smoothstep(0.6, 0.7, nch).mul(up).mul(step(positionWorld.y, 1.2));
      const wv = U.mojado.mul(poro);
      m.colorNode = m.colorNode.mul(mix(float(1), mix(float(0.64), float(0.4), charco), wv));
      const r0 = materialRoughness;
      const rWet = mix(float(0.45), float(0.16), up).mul(float(1).sub(charco.mul(0.85)));
      m.roughnessNode = m.lenteNode ? mix(mix(r0, min(r0, rWet), wv), float(1), m.lenteNode) : mix(r0, min(r0, rWet), wv);
    }

    // luz de las fuentes de la noche, sin luces nuevas (una luz de three.js más obligaría a recompilar todo): se suma como
    // emisivo, multiplicada por el color del material. El poste de la esquina es un punto que alumbra hacia abajo y cae con
    // la distancia al cuadrado (el charco mide unos 20 m); las ventanas encendidas derraman un poco de su luz blanca en el suelo
    // y los pasillos que tienen al frente y en el sofito que tienen encima (misma celda al azar que el vidrio).
    if (!glass) {
      const dL = vec3(...POSTE.toArray()).sub(positionWorld), d2 = dot(dL, dL), l = dL.div(d2.sqrt());
      const ePoste = vec3(U.posteCol).mul(U.poste).mul(max(dot(normalWorld, l), 0)).mul(pow(max(l.y, 0), 1.5)).div(d2.add(1)).mul(smoothstep(0.3, 1.2, d2))
        .mul(oneMinus(step(abs(positionWorld.z.sub(POSTE.z)), 0.45).mul(step(45.2, positionWorld.x)).mul(step(0.4, positionWorld.y))));   // el poste no se alumbra a sí mismo
      const q = clamp(positionWorld.xz, vec2(-PLANTA[0], -PLANTA[1]), vec2(PLANTA[0], PLANTA[1]));
      const dq = length(positionWorld.xz.sub(q)), y = positionWorld.y;
      const arriba = smoothstep(0.5, 0.9, normalWorld.y), abajo = smoothstep(-0.5, -0.9, normalWorld.y);
      // piso cuya ventana alumbra: la de su mismo piso si la cara mira arriba, la de abajo si mira abajo (sofito)
      const piso = max(floor(mix(y.add(0.3), y.sub(0.2), abajo).div(3.65)), 0);
      // el cuarto de la ventana más cercana, con la misma luz encendida o apagada que se ve por el vidrio (interiores.js)
      const enc = encendida(semillaFachada(q, piso)).mul(step(piso, 2.5));
      const cerca = arriba.mul(pow(float(0.5), dq.div(0.9))).mul(0.3).add(abajo.mul(smoothstep(2.4, 0.8, dq)).mul(0.18));
      const eVent = vec3(...NOCHE.lamparas.led).mul(enc).mul(cerca).mul(U.ventanasN).mul(0.175);   // la misma luz blanca del salón
      // la bóveda completa sobre lo que mira al cielo sin nada encima: las tejas (siempre son techo) y el suelo fuera de los
      // aleros. Se suma aparte para no tocar el muro ni el piso de los pasillos, que tienen el alero encima
      const teja = /terracotta/.test(nm);
      const abierto = teja ? float(1) : grupo === 'sitio' ? step(y, 1.2).mul(step(1.9, dq)) : grupo === 'contexto' && /turf/.test(nm) ? float(1) : float(0);
      const eCielo = vec3(U.cieloArriba).mul(max(normalWorld.y, 0)).mul(abierto);
      const eArt = m.colorNode.mul(ePoste.add(eVent).add(eCielo));
      m.emissiveNode = m.emissiveNode ? m.emissiveNode.add(eArt) : eArt;
      // la cabeza del poste: la lámpara misma, que satura y hace bloom
      if (grupo === 'sitio' && nm.includes('soffit')) {
        const cabeza = step(POSTE.y + 0.05, positionWorld.y).mul(step(47.9, positionWorld.x)).mul(abajo.max(0.3));
        m.emissiveNode = m.emissiveNode.add(vec3(U.posteCol).mul(U.poste).mul(cabeza).mul(0.08));
      }
    }

    // el viento de esa hora mueve la vegetación: la base queda fija en el suelo y la copa se inclina y se mece, más con más viento
    // (~20 cm en la copa de una palma de 10 m con 35 km/h; los setos casi no se mueven). Solo se ve mientras la escena se redibuja.
    if (grupo === 'vegetacion' || grupo === 'arboles') {   // con instancias, positionLocal ya trae la de cada árbol (three la aplica antes)
      const pw = modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz;
      // en arboles.glb la altura sobre el suelo de cada árbol viene en el atributo _altura (el árbol puede estar en una loma)
      const h = grupo === 'arboles' ? attribute('_altura', 'float') : min(max(pw.y, 0).div(10), 1.6);
      const fase = time.mul(1.3).add(pw.x.mul(0.21)).add(pw.z.mul(0.17));
      const vaiven = sin(fase).mul(0.65).add(sin(fase.mul(2.3).add(1.7)).mul(0.35)).mul(U.vaiven);
      const amp = U.brisa.mul(h.mul(h)).mul(0.22);
      let d = vec3(U.vientoDir.x, 0, U.vientoDir.y).mul(amp.mul(float(0.55).add(vaiven.mul(0.45))));
      // las hojas además tiemblan un poco, cada una a su ritmo
      if (leaf) d = d.add(vec3(sin(fase.mul(4.1).add(pw.y)), 0, cos(fase.mul(3.7).add(pw.x))).mul(U.brisa.mul(U.vaiven).mul(min(h, 1)).mul(0.035)));
      m.positionNode = positionLocal.add(modelWorldMatrixInverse.mul(vec4(d, 0)).xyz);
    }

    // Revelado del grupo
    const g = uniform(idx);
    const reveal = clamp(U.build.sub(g).sub(0.78).div(0.5), 0, 1);
    const ruido = mx_noise_float(positionWorld.mul(0.6)).mul(0.6);
    if (grupo === 'contexto') {
      const r = length(positionWorld.xz);
      // el frente avanza hasta 900 m durante el armado; ya armado, se suelta para que se vea el entorno ampliado (el canal)
      const cut = mix(0.0, 900.0, reveal.mul(reveal)).add(step(0.999, reveal).mul(1e5));
      m.maskNode = r.add(ruido.mul(8)).lessThan(cut);
      const band = smoothstep(cut.sub(6), cut, r).mul(step(reveal, 0.999));
      m.emissiveNode = (m.emissiveNode ? m.emissiveNode.add(vec3(1.0, 0.7, 0.35).mul(band).mul(0.6)) : vec3(1.0, 0.7, 0.35).mul(band).mul(0.6));
    } else {
      const cut = mix(uMin.sub(0.6), uMax.add(0.8), reveal);
      m.maskNode = positionWorld.y.add(ruido).lessThan(cut);
      const band = smoothstep(cut.sub(0.35), cut, positionWorld.y.add(ruido)).mul(step(reveal, 0.999));
      const glow = vec3(1.0, 0.72, 0.38).mul(band).mul(1.2);
      m.emissiveNode = m.emissiveNode ? m.emissiveNode.add(glow) : glow;
    }
    m.receivedShadowNode = /[?&]sinnubes/.test(location.search) ? soloSombraSol : sombraNubes;
    const cn = m.colorNode;
    m.colorNode = Fn(() => { sombraSol.assign(1.0); return cn; })();   // valor por defecto, antes de la iluminación
    // las calles, aceras y vías del entorno ampliado (contexto.mjs, «V017 street…») van a 2 cm del pasto del sitio: de lejos
    // el búfer de profundidad no los distingue y el pasto se las comía; se adelantan un poco en profundidad para que ganen
    if (/^V017 street/.test(src.name || '')) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; }
    if (src.map) m.map = src.map;
    return m;
  }

  // ---------- Partículas: armado desde puntos precalculados (intro.bin) ----------
  /** d = {n, pos Int16Array (×0,02 m), col Uint8Array, meta Uint8Array (grupo, altura·255, azar·255)} */
  construirParticulas(d, total) {
    const N = Math.min(total, d.n);
    const home = new Float32Array(N * 3), start = new Float32Array(N * 3), col = new Float32Array(N * 3), meta = new Float32Array(N * 4);
    const rnd = mulberry(106);
    for (let k = 0; k < N; k++) {
      home[k * 3] = d.pos[k * 3] * 0.02; home[k * 3 + 1] = d.pos[k * 3 + 1] * 0.02; home[k * 3 + 2] = d.pos[k * 3 + 2] * 0.02;
      // salida: una nube amplia sobre el terreno, sesgada hacia arriba
      const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 1.6 - 0.6), R = 70 + rnd() * 170;
      start[k * 3] = Math.cos(th) * Math.sin(ph) * R; start[k * 3 + 1] = 25 + Math.cos(ph) * R * 0.6 + rnd() * 40; start[k * 3 + 2] = Math.sin(th) * Math.sin(ph) * R;
      col[k * 3] = d.col[k * 3] / 255; col[k * 3 + 1] = d.col[k * 3 + 1] / 255; col[k * 3 + 2] = d.col[k * 3 + 2] / 255;
      const g = d.meta[k * 3];
      meta[k * 4] = g; meta[k * 4 + 1] = d.meta[k * 3 + 1] / 255; meta[k * 4 + 2] = d.meta[k * 3 + 2] / 255; meta[k * 4 + 3] = g === 6 ? 0.8 : 1.0;
    }
    this.nParticulas = N;
    const aHome = instancedBufferAttribute(new THREE.InstancedBufferAttribute(home, 3));
    const aStart = instancedBufferAttribute(new THREE.InstancedBufferAttribute(start, 3));
    const aCol = instancedBufferAttribute(new THREE.InstancedBufferAttribute(col, 3));
    const aMeta = instancedBufferAttribute(new THREE.InstancedBufferAttribute(meta, 4));
    const g = aMeta.x, h = aMeta.y, r = aMeta.z;
    // todos los puntos llegan a la vez (de abajo hacia arriba y con algo de azar); el sólido se revela después, grupo a grupo
    const local = clamp(U.junta.mul(1.45).sub(h.mul(0.3)).sub(r.mul(0.15)), 0, 1);
    const e = float(1).sub(pow(float(1).sub(local), 3));
    const t = time.mul(0.25);
    const drift = vec3(sin(t.add(r.mul(40.0))), cos(t.mul(0.8).add(r.mul(17.0))), sin(t.mul(0.6).add(r.mul(9.0)))).mul(4.0).mul(oneMinus(e));
    const reveal = clamp(U.build.sub(g).sub(0.78).div(0.5), 0, 1);
    const mat = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pos = mix(aStart, aHome, e).add(drift);
    mat.positionNode = pos;
    mat.colorNode = aCol.mul(float(0.9).add(oneMinus(e).mul(0.7)));
    mat.scaleNode = mix(float(0.5), float(0.24), e).mul(aMeta.w).mul(this.calidad.nivel === 'bajo' ? 1.3 : 1.0);
    // los puntos que pasan pegados a la cámara se desvanecen (si no, se ven como discos enormes)
    const cerca = smoothstep(float(4), float(20), length(pos.sub(cameraPosition)));
    mat.opacityNode = shapeCircle().mul(float(0.32).add(e.mul(0.22))).mul(oneMinus(reveal)).mul(U.puntos).mul(cerca);
    mat.fog = false;
    const spr = new THREE.Sprite(mat);
    // geometría propia: todos los Sprite de three.js comparten una sola geometría (intercalada); si se liberara esa,
    // three.js destruye su búfer en la GPU y no lo vuelve a crear, y cualquier sprite (la lluvia, los rótulos del arco
    // del sol) dejaba a WebGPU rechazando cada cuadro: la imagen se quedaba congelada en el último cuadro bueno.
    spr.geometry = new THREE.PlaneGeometry(1, 1);
    spr.count = N; spr.frustumCulled = false; spr.renderOrder = 10;
    this.scene.add(spr); this.particulas = spr;
    return N;
  }

  /** Terminado el armado, las partículas se liberan de la memoria de la GPU. */
  liberarParticulas() {
    if (!this.particulas) return;
    this.scene.remove(this.particulas); this.particulas.material.dispose();
    if (this.particulas.geometry?.type === 'PlaneGeometry') this.particulas.geometry.dispose();   // nunca la compartida
    this.particulas = null; this.sucio = true;
  }

  // ---------- Rosa de los vientos en el suelo y recorrido del sol ----------
  #rosa() {
    // textura dibujada una vez: anillo con marcas cada 5°, rumbos cada 45° y letras N · E · S · O
    const c = document.createElement('canvas'); c.width = c.height = 2048;
    const x = c.getContext('2d'), C = 1024, R = 980;
    x.translate(C, C); x.strokeStyle = 'rgba(255,236,200,1)'; x.fillStyle = 'rgba(255,236,200,1)';
    x.lineWidth = 6; x.beginPath(); x.arc(0, 0, R - 60, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 3; x.beginPath(); x.arc(0, 0, R - 150, 0, Math.PI * 2); x.stroke();
    for (let a = 0; a < 360; a += 5) {
      const l = a % 45 === 0 ? 150 : a % 15 === 0 ? 70 : 36;
      x.save(); x.rotate(a * Math.PI / 180); x.lineWidth = a % 45 === 0 ? 8 : 4;
      x.beginPath(); x.moveTo(0, -(R - 60)); x.lineTo(0, -(R - 60) + l); x.stroke(); x.restore();
    }
    x.font = '700 150px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const [a, t] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'O']]) {
      x.save(); x.rotate(a * Math.PI / 180); x.translate(0, -(R - 300)); x.fillText(t, 0, 0); x.restore();
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const RADIO = 46;                                  // m: rodea el edificio (45,5 × 23 m) y la acera
    const geo = new THREE.PlaneGeometry(RADIO * 2, RADIO * 2); geo.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.uRosa = uniform(0);
    m.colorNode = vec3(1.0, 0.85, 0.55); m.opacityNode = texture(tex).a.mul(this.uRosa).mul(0.55); m.fog = false;
    const rosa = new THREE.Mesh(geo, m);
    const N = vectorSol(0, 0);                         // el norte en coordenadas de la escena
    rosa.rotation.y = Math.atan2(-N.x, -N.z);
    rosa.position.set(0, 0.32, 0); rosa.renderOrder = 4;
    this.scene.add(rosa); this.rosaMesh = rosa;
  }

  #ruta() {
    // arco del sol sobre el edificio para la fecha elegida (radio 70 m): un tubo que brilla, puntos cada hora y rótulos
    this.uRuta = uniform(0);
    this.rutaMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.rutaMat.colorNode = vec3(1.0, 0.7, 0.3); this.rutaMat.opacityNode = this.uRuta.mul(0.6); this.rutaMat.fog = false;
    this.rutaLinea = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), this.rutaMat); this.rutaLinea.frustumCulled = false; this.rutaLinea.renderOrder = 6;
    const gp = new THREE.BufferGeometry(); gp.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 25), 3));
    const mp = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, sizeAttenuation: false });
    mp.colorNode = vec3(1.0, 0.85, 0.55); mp.opacityNode = this.uRuta; mp.sizeNode = float(6); mp.fog = false;
    this.rutaHoras = new THREE.Points(gp, mp); this.rutaHoras.frustumCulled = false; this.rutaHoras.renderOrder = 6;
    const ms = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    ms.colorNode = vec3(1.0, 0.78, 0.4).mul(2.2); ms.opacityNode = shapeCircle().mul(this.uRuta); ms.fog = false;
    this.rutaSol = new THREE.Sprite(ms); this.rutaSol.scale.setScalar(4.2); this.rutaSol.renderOrder = 7;
    this.scene.add(this.rutaLinea, this.rutaHoras, this.rutaSol);
    // rótulos de hora (6, 9, 12, 15 y 18 h)
    this.rutaRotulos = [6, 9, 12, 15, 18].map((h) => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
      x.font = '600 76px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffe2a8'; x.fillText(`${h} h`, 128, 64);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, depthTest: false });
      m.colorNode = texture(t).rgb; m.opacityNode = texture(t).a.mul(this.uRuta); m.fog = false;
      const s = new THREE.Sprite(m); s.scale.set(7, 3.5, 1); s.renderOrder = 8; s.userData.h = h; this.scene.add(s); return s;
    });
  }

  /** Redibuja el arco del sol para una fecha. */
  setRuta(f) {
    const clave = `${f.y}-${f.m}-${f.d}`; if (clave === this._ruta) return; this._ruta = clave;
    const R = 70, v = {}, H = this.rutaHoras.geometry.attributes.position;
    const { sale, pone } = saleYPone(f.y, f.m, f.d);
    const pts = [];
    for (let i = 0; i < 90; i++) {
      const min = sale - 4 + (pone - sale + 8) * i / 89, p = posicionSol({ ...f, h: 0, min });
      vectorSol(Math.max(-0.6, p.alt), p.az, v); pts.push(new THREE.Vector3(v.x * R, v.y * R + 1, v.z * R));
    }
    this.rutaLinea.geometry.dispose();
    this.rutaLinea.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 180, 0.22, 5, false);
    let k = 0;
    for (let h = 0; h < 24; h++) { const p = posicionSol({ ...f, h, min: 0 }); if (p.alt < 0) continue; vectorSol(p.alt, p.az, v); H.setXYZ(k++, v.x * R, v.y * R + 1, v.z * R); }
    H.needsUpdate = true; this.rutaHoras.geometry.setDrawRange(0, k);
    for (const s of this.rutaRotulos) {
      const p = posicionSol({ ...f, h: s.userData.h, min: 0 }); s.userData.arriba = p.alt > 2;
      vectorSol(p.alt, p.az, v); s.position.set(v.x * (R + 6), v.y * (R + 6) + 3, v.z * (R + 6));
    }
    this.sucio = true;
  }

  // ---------- Partes del edificio: persona de 1,70 m, regla de alturas y un módulo resaltado ----------
  #partes() {
    const ambar = new THREE.Color(0xf4b545);
    // persona de 1,70 m junto a la esquina del jardín (fuera del alero, que termina a 24,4 m)
    const mp = new THREE.MeshStandardNodeMaterial({ color: ambar, roughness: 0.6, metalness: 0 });
    mp.emissive = new THREE.Color(0x3a2400);
    const persona = new THREE.Group();
    const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 1.02, 6, 14), mp); cuerpo.position.y = 0.70;
    const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12), mp); cabeza.position.y = 1.575;
    for (const o of [cuerpo, cabeza]) { o.castShadow = true; o.layers.enable(1); persona.add(o); }
    persona.position.set(24.7, 0, 11.3); persona.visible = false;
    this.scene.add(persona); this.persona = persona;
    // regla de alturas en la esquina noreste–sureste: suelo, base (0,65), aleros (3,74 · 7,40 · 11,10)
    const X = 22.78, Z = 11.53, niveles = [0, 0.65, 3.74, 7.4, 11.1], pts = [X, 0, Z, X, 11.1, Z];
    for (const y of niveles) pts.push(X - 0.45, y, Z + 0.45, X + 0.45, y, Z - 0.45);
    const gr = new THREE.BufferGeometry(); gr.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    gr.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pts.length / 3 * 2), 2));   // algunos pasos del render piden uv
    const mr = new THREE.LineBasicNodeMaterial({ color: ambar, depthTest: false, depthWrite: false, transparent: true });
    mr.fog = false;
    const regla = new THREE.LineSegments(gr, mr); regla.renderOrder = 30; regla.visible = false; regla.frustumCulled = false;
    this.scene.add(regla); this.regla = regla;
    // un módulo de la fachada principal: entre dos ménsulas (6,70 m), en el piso 2
    const x0 = 13.4, x1 = 20.1, y0 = 3.95, y1 = 7.2, z = 11.56;
    const gm = new THREE.BufferGeometry();
    gm.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, z, x1, y0, z, x1, y0, z, x1, y1, z, x1, y1, z, x0, y1, z, x0, y1, z, x0, y0, z], 3));
    gm.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(16), 2));
    const mm = new THREE.LineBasicNodeMaterial({ color: ambar }); mm.fog = false;
    const marco = new THREE.LineSegments(gm, mm); marco.renderOrder = 29;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), new THREE.MeshBasicNodeMaterial({ color: ambar, transparent: true, opacity: 0.3, depthWrite: false }));
    pl.position.set((x0 + x1) / 2, (y0 + y1) / 2, z + 0.01); pl.material.fog = false; pl.renderOrder = 28;
    const modulo = new THREE.Group(); modulo.add(marco, pl); modulo.visible = false;
    this.scene.add(modulo); this.moduloResaltado = modulo;
  }

  /** Muestra u oculta la persona de 1,70 m, la regla de alturas y el módulo resaltado. */
  setPartes({ persona = false, alturas = false, modulo = false } = {}) {
    if (!this.persona) return;
    if (this.persona.visible !== persona) { this.persona.visible = persona; this.sun.shadow.needsUpdate = true; }
    this.regla.visible = alturas; this.moduloResaltado.visible = modulo;
    this.sucio = true;
  }

  // ---------- Viento: rosa de vientos en el suelo o flechas del viento de esa hora ----------
  #vientoRosa() {
    const c = document.createElement('canvas'); c.width = c.height = 1024; this._vc = c;
    c.getContext('2d');                               // lienzo vacío pero válido: precompilar() sube la textura antes del primer dibujo
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; this._vtex = tex;
    const geo = new THREE.PlaneGeometry(200, 200); geo.rotateX(-Math.PI / 2);      // la rosa empieza fuera del anillo N·E·S·O (46 m)
    this.uViento = uniform(0);
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    m.colorNode = texture(tex).rgb; m.opacityNode = texture(tex).a.mul(this.uViento).mul(0.92); m.fog = false;
    const mesh = new THREE.Mesh(geo, m);
    const N = vectorSol(0, 0); mesh.rotation.y = Math.atan2(-N.x, -N.z);     // arriba del lienzo = norte real
    mesh.position.set(0, 0.36, 0); mesh.renderOrder = 4; mesh.visible = false;
    this.scene.add(mesh); this.vientoMesh = mesh;
  }

  /** Dibuja la rosa (frec: % por rumbo de 16, vel: km/h) o, con `hora`, flechas del viento de esa hora (dir: de dónde viene). */
  dibujarViento(d) {
    const c = this._vc, x = c.getContext('2d'), C = 512, R0 = 262, R1 = 505;
    x.clearRect(0, 0, 1024, 1024); x.save(); x.translate(C, C);
    const col = (v, a) => { const t = Math.min(1, v / 18); return `rgba(${Math.round(40 + 150 * t)}, ${Math.round(200 + 55 * t)}, ${Math.round(170 + 40 * t)}, ${a})`; };
    if (d.hora) {
      if (d.v >= 1) {
        // flechas paralelas que cruzan el lienzo en la dirección en que sopla (de dónde viene + 180°)
        x.rotate((d.dir + 180) * Math.PI / 180);
        const L = 150 + Math.min(1, d.v / 20) * 280;
        x.strokeStyle = x.fillStyle = col(d.v, 0.55 + 0.45 * Math.min(1, d.v / 15)); x.lineWidth = 12; x.lineCap = 'round';
        for (const off of [-300, -150, 0, 150, 300]) {
          const y0 = 420 - (Math.abs(off) === 150 ? 60 : 0);
          x.beginPath(); x.moveTo(off, y0); x.lineTo(off, y0 - L); x.stroke();
          x.beginPath(); x.moveTo(off, y0 - L - 34); x.lineTo(off - 26, y0 - L + 8); x.lineTo(off + 26, y0 - L + 8); x.closePath(); x.fill();
        }
      }
    } else {
      const max = Math.max(1, ...d.frec);
      x.font = '600 34px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let i = 0; i < 16; i++) {
        const r = R0 + (R1 - R0) * d.frec[i] / max, a0 = (i * 22.5 - 9 - 90) * Math.PI / 180, a1 = (i * 22.5 + 9 - 90) * Math.PI / 180;
        x.beginPath(); x.arc(0, 0, R0, a0, a1); x.arc(0, 0, r, a1, a0, true); x.closePath();
        x.fillStyle = col(d.vel[i], 0.78); x.fill();
        if (d.frec[i] >= 4) {
          const am = (i * 22.5 - 90) * Math.PI / 180, tx = Math.cos(am) * Math.min(R1 - 20, r + 34), ty = Math.sin(am) * Math.min(R1 - 20, r + 34), t = `${Math.round(d.frec[i])} %`;
          x.lineWidth = 8; x.strokeStyle = 'rgba(6,14,14,0.85)'; x.strokeText(t, tx, ty); x.fillStyle = '#e6fff6'; x.fillText(t, tx, ty);
        }
      }
      x.strokeStyle = 'rgba(230,255,246,0.35)'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, R0, 0, Math.PI * 2); x.stroke();
    }
    x.restore();
    this._vtex.needsUpdate = true; this.sucio = true;
  }

  // ---------- Diagrama de sombras: la silueta de la sombra del edificio en cada hora del día ----------
  #diagrama() {
    const MAX = 13 * 96 * 6;                        // 13 horas × hasta 96 lados × 2 triángulos
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, vertexColors: true, side: THREE.DoubleSide });
    m.opacityNode = U.sombras.mul(0.95); m.fog = false;
    const lineas = new THREE.Mesh(g, m); lineas.frustumCulled = false; lineas.renderOrder = 9;
    // relleno: cada hora suma un velo oscuro; donde se superponen más horas, más oscuro (horas de sombra)
    const gf = new THREE.BufferGeometry();
    gf.setAttribute('position', new THREE.BufferAttribute(new Float32Array(13 * 96 * 3 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    gf.setDrawRange(0, 0);
    const mf = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
    mf.colorNode = vec3(0.02, 0.03, 0.06); mf.opacityNode = U.sombras.mul(0.075); mf.fog = false;
    const relleno = new THREE.Mesh(gf, mf); relleno.frustumCulled = false; relleno.renderOrder = 8;
    this.diagramaGrupo = new THREE.Group(); this.diagramaGrupo.add(relleno, lineas); this.diagramaGrupo.visible = false;
    this.scene.add(this.diagramaGrupo);
    this.diagLineas = lineas; this.diagRelleno = relleno;
    relleno.visible = false;                         // el velo de antes ya no se dibuja (lo reemplazan las horas de sombra)
    // horas de sombra por bandas: una cuadrícula de 1,5 m sobre el terreno cuenta en cuántas de las horas en punto con el sol a 3° o más (de 7 a 17 o 18 h: 11 o 12 por día)
    // cae dentro de la sombra; se pinta en 5 bandas (1–2, 3–4, 5–6, 7–8 y 9 o más horas), como las horas de sombra de ArcGIS o
    // las horas de sol directo de Ladybug. Reemplaza el velo de antes (7,5 % por hora, casi invisible)
    const NR = 160, CELDA = 1.5;
    this._horas = { NR, CELDA, datos: new Uint8Array(NR * NR) };
    const th = new THREE.DataTexture(this._horas.datos, NR, NR, THREE.RedFormat, THREE.UnsignedByteType);
    th.magFilter = th.minFilter = THREE.NearestFilter; th.needsUpdate = true; this._horas.tex = th;
    const gh = new THREE.PlaneGeometry(NR * CELDA, NR * CELDA); gh.rotateX(-Math.PI / 2);
    const mh = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    const banda = min(floor(floor(texture(th).r.mul(255).add(0.5)).add(1).div(2)), float(5));   // la cuenta entera, sin depender del redondeo de la GPU
    mh.colorNode = vec3(0.02, 0.04, 0.09); mh.opacityNode = banda.mul(0.11).mul(U.sombras); mh.fog = false;
    const horas = new THREE.Mesh(gh, mh); horas.position.y = 0.09; horas.renderOrder = 7; horas.frustumCulled = false;
    this.diagramaGrupo.add(horas);
    // la sombra de la hora que marca la regla: contorno crema y grueso, y un relleno suave
    const ga = new THREE.BufferGeometry();
    ga.setAttribute('position', new THREE.BufferAttribute(new Float32Array(96 * 6 * 3), 3).setUsage(THREE.DynamicDrawUsage)); ga.setDrawRange(0, 0);
    const ma = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
    ma.colorNode = vec3(0.94, 0.91, 0.87); ma.opacityNode = U.sombras; ma.fog = false;
    const gaf = new THREE.BufferGeometry();
    gaf.setAttribute('position', new THREE.BufferAttribute(new Float32Array(96 * 3 * 3), 3).setUsage(THREE.DynamicDrawUsage)); gaf.setDrawRange(0, 0);
    const maf = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
    maf.colorNode = vec3(0.02, 0.03, 0.06); maf.opacityNode = U.sombras.mul(0.22); maf.fog = false;
    this.diagAhora = new THREE.Mesh(ga, ma); this.diagAhora.renderOrder = 10; this.diagAhora.frustumCulled = false; this.diagAhora.visible = false;
    this.diagAhoraR = new THREE.Mesh(gaf, maf); this.diagAhoraR.renderOrder = 9; this.diagAhoraR.frustumCulled = false; this.diagAhoraR.visible = false;
    this.diagramaGrupo.add(this.diagAhora, this.diagAhoraR);
    this.diagRotulos = [];
    for (let h = 6; h <= 18; h++) {
      const c = document.createElement('canvas'); c.width = 160; c.height = 80; const x = c.getContext('2d');
      x.font = '600 54px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = 10; x.strokeStyle = 'rgba(8,12,16,0.85)'; x.strokeText(`${h} h`, 80, 42);
      x.fillStyle = '#' + colorHora(h).getHexString(); x.fillText(`${h} h`, 80, 42);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const ms = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, depthTest: false });
      ms.colorNode = texture(t).rgb; ms.opacityNode = texture(t).a.mul(U.sombras); ms.fog = false;
      const sp = new THREE.Sprite(ms); sp.scale.set(8, 4, 1); sp.renderOrder = 12; sp.visible = false; sp.userData.h = h;
      this.diagramaGrupo.add(sp); this.diagRotulos.push(sp);
    }
  }

  /** Puntos candidatos de la silueta (una sola vez): los extremos del edificio, franja por franja de altura. */
  #siluetaPuntos() {
    if (this._silueta) return this._silueta;
    if (!this.cargado) return null;                    // con el modelo a medias la silueta saldría incompleta
    for (const _ of this.#recorrerSilueta()) { /* de un tirón */ }
    return this._silueta;
  }

  /** Arma la silueta pieza por pieza: cede el control después de cada malla y de cada franja de altura. */
  *#recorrerSilueta() {
    const bandas = new Map(), v = new THREE.Vector3(), mi = new THREE.Matrix4(), mw = new THREE.Matrix4();
    const poner = (p) => { if (p.y < 0.05) return; const k = Math.floor(p.y / 0.5); let b = bandas.get(k); if (!b) bandas.set(k, b = []); b.push(p.x, p.y, p.z); };
    const mallas = [];
    for (const nombre of ['arquitectura', 'cubiertas', 'entrada', 'ventanas', 'detalles']) {
      const info = this.grupos[nombre]; if (!info) continue;
      info.root.updateMatrixWorld(true);
      info.root.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.position) mallas.push(o); });
    }
    for (const o of mallas) {
      const pos = o.geometry.attributes.position;
      if (o.isInstancedMesh) {
        o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox;
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, mi); mw.multiplyMatrices(o.matrixWorld, mi);
          for (let c = 0; c < 8; c++) { v.set(c & 1 ? bb.max.x : bb.min.x, c & 2 ? bb.max.y : bb.min.y, c & 4 ? bb.max.z : bb.min.z).applyMatrix4(mw); poner(v); }
        }
      } else {
        const paso = Math.max(1, Math.floor(pos.count / 40000));
        for (let i = 0; i < pos.count; i += paso) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); poner(v); }
      }
      yield;
    }
    const out = [];
    for (const arr of bandas.values()) {
      const pts = []; for (let i = 0; i < arr.length; i += 3) pts.push([arr[i], arr[i + 2], arr[i + 1]]);
      for (const p of envolvente(pts)) out.push(p);           // [x, z, y]
      yield;
    }
    this._silueta = out.length > 8 ? out : null;
  }

  /** Calcula de antemano la silueta del diagrama de sombras en ratos libres, sin bloquear más de unos milisegundos
   *  seguidos (de un tirón tomaba ~120 ms y, si coincidía con un clic, se notaba como un tirón). */
  async prepararSilueta() {
    if (this._silueta || !this.cargado) return !!this._silueta;
    const libre = () => new Promise((ok) => (window.requestIdleCallback ?? ((f) => setTimeout(() => f({ timeRemaining: () => 6 }), 30)))(ok, { timeout: 1000 }));
    const it = this.#recorrerSilueta();
    let d = await libre();
    for (;;) {
      if (this._silueta) return true;                 // mientras tanto alguien la pidió de un tirón
      const t0 = performance.now();
      let r;
      do { r = it.next(); } while (!r.done && performance.now() - t0 < Math.min(8, Math.max(2, d.timeRemaining())));
      if (r.done) return !!this._silueta;
      d = await libre();
    }
  }

  /** Dibuja la sombra de cada hora (6 a 18 h) del día elegido. */
  setDiagrama(f) {
    const clave = `${f.y}-${f.m}-${f.d}`; if (clave === this._diagClave) return true;
    const P = this.#siluetaPuntos(); if (!P) return false;
    this._diagClave = clave;
    const pos = this.diagLineas.geometry.attributes.position, col = this.diagLineas.geometry.attributes.color, fp = this.diagRelleno.geometry.attributes.position;
    let n = 0, nf = 0; const Y = 0.12, W = 0.28, d = {}, contornos = [];
    for (const sp of this.diagRotulos) {
      const p = posicionSol({ ...f, h: sp.userData.h, min: 0 });
      sp.visible = sp.userData.vale = false;
      if (p.alt < 3) continue;
      vectorSol(p.alt, p.az, d);
      const k = 1 / d.y, proy = P.map(([x, z, y]) => [x - d.x * y * k, z - d.z * y * k]);
      const H = envolvente(proy); if (H.length < 3) continue;
      contornos.push(H);
      const c = colorHora(sp.userData.h);
      // contorno como cinta de 0,56 m (las líneas de 1 px casi no se ven desde arriba)
      let cx = 0, cz = 0; H.forEach(([x, z]) => { cx += x; cz += z; }); cx /= H.length; cz /= H.length;
      for (let i = 0; i < H.length && n < pos.count - 6; i++) {
        const [x0, z0] = H[i], [x1, z1] = H[(i + 1) % H.length];
        const ex = x1 - x0, ez = z1 - z0, L = Math.hypot(ex, ez) || 1, nx = -ez / L * W, nz = ex / L * W;
        const q = [[x0 - nx, z0 - nz], [x1 - nx, z1 - nz], [x1 + nx, z1 + nz], [x0 - nx, z0 - nz], [x1 + nx, z1 + nz], [x0 + nx, z0 + nz]];
        for (const [x, z] of q) { pos.setXYZ(n, x, Y, z); col.setXYZ(n, c.r, c.g, c.b); n++; }
      }
      // rótulo en la punta de la sombra (el vértice más lejos del edificio)
      let best = H[0], bd = -1; for (const q of H) { const dd = q[0] * q[0] + q[1] * q[1]; if (dd > bd) { bd = dd; best = q; } }
      const r = Math.sqrt(bd) || 1; sp.position.set(best[0] + best[0] / r * 5, 1.5, best[1] + best[1] / r * 5); sp.visible = sp.userData.vale = true;
    }
    this.#contarHoras(contornos);
    this._ahoraClave = '';
    pos.needsUpdate = col.needsUpdate = fp.needsUpdate = true;
    this.diagLineas.geometry.setDrawRange(0, n); this.diagRelleno.geometry.setDrawRange(0, nf);
    this.sucio = true;
    return true;
  }

  /** Cuántas de las horas en punto cae cada celda dentro de la sombra (contornos convexos; recorte por caja de cada uno). */
  #contarHoras(contornos) {
    const { NR, CELDA, datos, tex } = this._horas, half = NR * CELDA / 2;
    datos.fill(0);
    for (const H of contornos) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [x, z] of H) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const i0 = Math.max(0, Math.floor((x0 + half) / CELDA)), i1 = Math.min(NR - 1, Math.floor((x1 + half) / CELDA));
      const j0 = Math.max(0, Math.floor((half - z1) / CELDA)), j1 = Math.min(NR - 1, Math.floor((half - z0) / CELDA));
      for (let j = j0; j <= j1; j++) {
        const z = half - (j + 0.5) * CELDA;
        for (let i = i0; i <= i1; i++) {
          const x = -half + (i + 0.5) * CELDA;
          let signo = 0, dentro = true;
          for (let k = 0; k < H.length; k++) {
            const [ax, az] = H[k], [bx, bz] = H[(k + 1) % H.length];
            const cr = (bx - ax) * (z - az) - (bz - az) * (x - ax);
            if (cr !== 0) { const sg = Math.sign(cr); if (signo === 0) signo = sg; else if (sg !== signo) { dentro = false; break; } }
          }
          if (dentro) datos[j * NR + i]++;
        }
      }
    }
    tex.needsUpdate = true;
  }

  /** La sombra del minuto que marca la regla (dentro de «Sombras del día»): contorno crema grueso y relleno suave. */
  setSombraAhora(f, min) {
    const clave = `${f.y}-${f.m}-${f.d}-${Math.round(min)}`; if (clave === this._ahoraClave || !this.diagAhora) return;
    this._ahoraClave = clave;
    const P = this._silueta, pa = this.diagAhora.geometry.attributes.position, pf = this.diagAhoraR.geometry.attributes.position;
    const p = posicionSol({ ...f, h: 0, min });
    let n = 0, nf = 0;
    if (P && p.alt >= 3) {
      const d = {}; vectorSol(p.alt, p.az, d);
      const k = 1 / d.y, H = envolvente(P.map(([x, z, y]) => [x - d.x * y * k, z - d.z * y * k]));
      let cx = 0, cz = 0; H.forEach(([x, z]) => { cx += x; cz += z; }); cx /= H.length || 1; cz /= H.length || 1;
      const Y = 0.16, W = 0.5;
      for (let i = 0; i < H.length && n < pa.count - 6; i++) {
        const [x0, z0] = H[i], [x1, z1] = H[(i + 1) % H.length];
        const ex = x1 - x0, ez = z1 - z0, L = Math.hypot(ex, ez) || 1, nx = -ez / L * W, nz = ex / L * W;
        for (const [x, z] of [[x0 - nx, z0 - nz], [x1 - nx, z1 - nz], [x1 + nx, z1 + nz], [x0 - nx, z0 - nz], [x1 + nx, z1 + nz], [x0 + nx, z0 + nz]]) pa.setXYZ(n++, x, Y, z);
        if (nf < pf.count - 3) { pf.setXYZ(nf++, cx, Y - 0.03, cz); pf.setXYZ(nf++, x0, Y - 0.03, z0); pf.setXYZ(nf++, x1, Y - 0.03, z1); }
      }
    }
    pa.needsUpdate = pf.needsUpdate = true;
    this.diagAhora.geometry.setDrawRange(0, n); this.diagAhoraR.geometry.setDrawRange(0, nf);
    this.diagAhora.visible = n > 0; this.diagAhoraR.visible = nf > 0;   // sin nada que dibujar, ni se llama (WebGPU avisa)
    this.sucio = true;
  }

  #reticula() {
    // 12 crujías × 6 crujías sobre 45,5 × 23 m, al nivel del zócalo (0,65 m)
    const L = 45.5, W = 23, y = 0.7, pts = [];
    for (let i = 0; i <= 12; i++) { const x = -L / 2 + i * L / 12; pts.push(x, y, -W / 2 - 4, x, y, W / 2 + 4); }
    for (let j = 0; j <= 6; j++) { const z = -W / 2 + j * W / 6; pts.push(-L / 2 - 4, y, z, L / 2 + 4, y, z); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.LineBasicNodeMaterial({ transparent: true, depthWrite: false });
    m.colorNode = vec3(1.0, 0.78, 0.42); m.opacityNode = U.reticula.mul(0.85); m.fog = false;
    const lines = new THREE.LineSegments(geo, m); lines.renderOrder = 5;
    this.scene.add(lines); this.lineasReticula = lines;
  }

  #lluvia() {
    // 1) Gotas alrededor de la cámara (caja de 90 × 45 × 90 m que la acompaña); sin gotas bajo los aleros.
    const q = this.calidad.nivel, N = q === 'bajo' ? 9000 : q === 'medio' ? 16000 : 24000;
    const base = new Float32Array(N * 4); const rnd = mulberry(9);
    for (let i = 0; i < N; i++) { base[i * 4] = rnd(); base[i * 4 + 1] = rnd(); base[i * 4 + 2] = rnd(); base[i * 4 + 3] = rnd(); }
    const a = instancedBufferAttribute(new THREE.InstancedBufferAttribute(base, 4));
    const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false });
    const t = time;
    const lado = float(90), alto = float(45);
    const x = U.cam.x.add(fract(a.x.add(t.mul(U.viento.x).mul(0.004))).sub(0.5).mul(lado));
    const z = U.cam.z.add(fract(a.z.add(t.mul(U.viento.y).mul(0.004))).sub(0.5).mul(lado));
    const y = U.cam.y.add(24).sub(fract(a.y.add(t.mul(0.2))).mul(alto));   // ~9 m/s
    m.positionNode = vec3(x, y, z);
    const bajoAlero = step(abs(x), 24.4).mul(step(abs(z), 13.15)).mul(step(y, 11.1));
    const cerca = smoothstep(float(55), float(4), length(vec3(x, y, z).sub(U.cam)));
    m.scaleNode = vec2(0.016, 0.62);
    m.colorNode = vec3(0.78, 0.83, 0.88).mul(U.luzLluvia);
    m.opacityNode = step(a.w, U.lluvia).mul(step(0.0, y)).mul(oneMinus(bajoAlero)).mul(float(0.12).add(cerca.mul(0.3)));
    m.fog = true;
    const s = new THREE.Sprite(m); s.count = N; s.frustumCulled = false; s.renderOrder = 20;
    this.scene.add(s); this.lluviaSpr = s;

    // 2) Cortinas de agua desde los tres aleros (bordes medidos en el modelo: ±24,4 × ±13,15 m)
    const tiers = [[3.74, 0.02], [7.4, 3.8], [11.1, 7.45]];
    const perPerim = q === 'bajo' ? 700 : 1500, per = 2 * (48.8 + 26.3);
    const D = new Float32Array(tiers.length * perPerim * 4), D2 = new Float32Array(tiers.length * perPerim * 2);
    let k = 0;
    for (const [top, bot] of tiers) for (let i = 0; i < perPerim; i++) {
      let u = rnd() * per, px, pz;
      if (u < 48.8) { px = -24.4 + u; pz = -13.12; } else if ((u -= 48.8) < 26.3) { px = 24.37; pz = -13.15 + u; }
      else if ((u -= 26.3) < 48.8) { px = 24.4 - u; pz = 13.12; } else { u -= 48.8; px = -24.37; pz = 13.15 - u; }
      D[k * 4] = px; D[k * 4 + 1] = top; D[k * 4 + 2] = pz; D[k * 4 + 3] = rnd(); D2[k * 2] = bot; D2[k * 2 + 1] = rnd(); k++;
    }
    const b = instancedBufferAttribute(new THREE.InstancedBufferAttribute(D, 4));
    const b2 = instancedBufferAttribute(new THREE.InstancedBufferAttribute(D2, 2));
    const mc = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false });
    const fase = fract(t.mul(float(0.55).add(b2.y.mul(0.35))).add(b.w));
    const yc = mix(b.y, b2.x, fase.mul(fase));      // cae acelerando
    mc.positionNode = vec3(b.x.add(sin(b.w.mul(90.0)).mul(0.03)), yc, b.z.add(cos(b.w.mul(70.0)).mul(0.03)));
    mc.scaleNode = vec2(0.013, mix(0.12, 0.45, fase));
    mc.colorNode = vec3(0.82, 0.86, 0.9).mul(U.luzLluvia);
    mc.opacityNode = step(b2.y, U.lluvia.mul(1.3)).mul(0.45);
    const sc = new THREE.Sprite(mc); sc.count = k; sc.frustumCulled = false; sc.renderOrder = 21;
    this.scene.add(sc); this.aleros = sc;

    // 3) Salpicaduras: anillos que se abren en el suelo alrededor de la cámara y en la línea de goteo
    const NS = q === 'bajo' ? 1200 : 2600;
    const S = new Float32Array(NS * 4);
    for (let i = 0; i < NS; i++) {
      const enGoteo = i < NS * 0.35;
      if (enGoteo) { const j = Math.floor(rnd() * k); S[i * 4] = D[j * 4] + (D[j * 4] > 0 ? 0.25 : -0.25) * (Math.abs(D[j * 4]) > 24 ? 1 : 0); S[i * 4 + 2] = D[j * 4 + 2] + (D[j * 4 + 2] > 0 ? 0.25 : -0.25) * (Math.abs(D[j * 4 + 2]) > 13 ? 1 : 0); S[i * 4 + 1] = 1; }
      else { S[i * 4] = rnd(); S[i * 4 + 2] = rnd(); S[i * 4 + 1] = 0; }
      S[i * 4 + 3] = rnd();
    }
    const ring = new THREE.RingGeometry(0.7, 1.0, 20); ring.rotateX(-Math.PI / 2);
    const ms = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    const sa = instancedBufferAttribute(new THREE.InstancedBufferAttribute(S, 4));
    const ph = fract(t.mul(1.7).add(sa.w.mul(7.0)));
    const rx = select(sa.y.greaterThan(0.5), sa.x, U.cam.x.add(fract(sa.x.add(floor(t.mul(1.7).add(sa.w.mul(7.0))).mul(0.618))).sub(0.5).mul(70)));
    const rz = select(sa.y.greaterThan(0.5), sa.z, U.cam.z.add(fract(sa.z.add(floor(t.mul(1.7).add(sa.w.mul(7.0))).mul(0.382))).sub(0.5).mul(70)));
    const sz = mix(0.03, 0.2, ph);
    ms.positionNode = positionLocal.mul(sz).add(vec3(rx, 0.03, rz));
    const dentro = step(abs(rx), 24.3).mul(step(abs(rz), 13.05));
    ms.colorNode = vec3(0.85, 0.88, 0.92).mul(U.luzLluvia);
    ms.opacityNode = oneMinus(ph).mul(oneMinus(ph)).mul(step(sa.w, U.lluvia)).mul(oneMinus(dentro)).mul(0.55);
    const splash = new THREE.InstancedMesh(ring, ms, NS);
    splash.frustumCulled = false; splash.renderOrder = 19;
    this.scene.add(splash); this.salpicaduras = splash;
  }

  /** Con la cámara más lejos que 360 m (el alcance de antes), la neblina se corre en proporción: desde lejos se sigue viendo
   *  el entorno (el canal, a 1,5 a 2 km de la cámara). Hasta 360 m la neblina queda igual que siempre. */
  setAlejamiento(dist) {
    const k = Math.max(1, dist / 360); if (Math.abs(k - (this.alejamiento ?? 1)) < 0.01) return;
    this.alejamiento = k;
    if (this._niebla) { this.scene.fog.near = this._niebla[0] * k; this.scene.fog.far = this._niebla[1] * k; }
    this.sucio = true;
  }

  render() {
    // el visor de claude.ai precarga la página oculta y sin tamaño: con 0 × 0 px WebGPU rechaza el búfer de profundidad
    if (window.innerWidth < 2 || window.innerHeight < 2) return 0;
    if (this._w !== window.innerWidth || this._h !== window.innerHeight) this.resize();
    U.cam.value.copy(this.camera.position);
    const llueve = U.lluvia.value > 0.01;
    if (this.lluviaSpr) this.lluviaSpr.visible = this.aleros.visible = this.salpicaduras.visible = llueve;
    if (this.particulas) this.particulas.visible = U.puntos.value > 0.001 && U.build.value < 8.35;
    if (this.lineasReticula) this.lineasReticula.visible = U.reticula.value > 0.001;
    if (this.rosaMesh) this.rosaMesh.visible = this.uRosa.value > 0.01;
    if (this.rutaLinea) this.rutaLinea.visible = this.rutaHoras.visible = this.uRuta.value > 0.01;
    if (this.rutaRotulos) for (const s of this.rutaRotulos) s.visible = this.uRuta.value > 0.01 && s.userData.arriba && U.sombras.value < 0.5 && !s.userData.tapado;   // con el diagrama, sus rótulos mandan; tapado: bajo un panel (main.js)
    if (this.diagRotulos) for (const sp of this.diagRotulos) sp.visible = !!sp.userData.vale && !sp.userData.tapado;
    if (this.rutaSol) this.rutaSol.visible = this.uRuta.value > 0.01 && this.alt > -1;
    if (this.diagramaGrupo) this.diagramaGrupo.visible = U.sombras.value > 0.01 && !!this._diagClave;
    if (this.vientoMesh) this.vientoMesh.visible = this.uViento.value > 0.01;
    // la sombra gruesa se rehace con la fina (el sol se movió, llegó o cambió algo), no por un cambio de nivel de detalle
    if (this.sunG && this.uGruesa.value > 0 && (this.sun.shadow.needsUpdate || this._gruesaSucia)) this.#ajustarGruesa();
    if (this.ciudad?.actualizar(this.camera)) this.sun.shadow.needsUpdate = true;
    const t0 = performance.now(); this._dibujo = t0;
    this.pipeline.render();
    this.sucio = false;
    if (this._envPend) this.#envTalVez();
    return t0;
  }

  /** Fija la relación de píxeles (resolución) entre 0,6 y el máximo de este equipo. */
  fijarResolucion(d) {
    const v = Math.max(0.6, Math.min(this.dprMax(), d));
    if (Math.abs(v - this.renderer.getPixelRatio()) < 0.001) return;
    this.renderer.setPixelRatio(v); this.sucio = true;
  }
}

// Sombras de nubes proyectadas sobre todo lo que recibe sol
const sombraNubes = Fn(([s0]) => {
  const s = conGruesa(s0);                     // con la ciudad: la sombra gruesa fuera de la caja fina (sin ciudad, s0 tal cual)
  sombraSol.assign(vec3(s).x);                 // la sombra geométrica, antes de sumar la de las nubes
  // el ruido de Perlin se anula en su cuadrícula (cada 222 m): con el origen en el 106 y el corte en z = 0, sobre un plano de
  // la propia cuadrícula, sus líneas cruzaban el edificio como una cruz de franjas rectas (más visible al cambiar las nubes
  // en un viaje en el tiempo). Se corre la cuadrícula y se corta entre dos planos.
  const p = positionWorld.xz.mul(0.0045).add(vec2(0.37, 0.61)).add(U.viento.mul(time.mul(0.012)));
  const n = mx_fractal_noise_float(vec3(p, 0.43), 2, 2.0, 0.5).mul(0.5).add(0.5);
  const cov = U.nubeCob;
  const nube = smoothstep(float(1.0).sub(cov), float(1.0).sub(cov).add(0.18), n);
  return s.mul(float(1).sub(nube.mul(U.nubeSombra).mul(0.8)));
});
// con ?sinnubes: solo anota la sombra geométrica para la lente «Sol»
const soloSombraSol = Fn(([s0]) => { const s = conGruesa(s0); sombraSol.assign(vec3(s).x); return s; });

export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/** Envolvente convexa 2D (cadena monótona de Andrew). Recibe [x, z, ...] y devuelve los vértices en orden. */
export function envolvente(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  lo.pop(); hi.pop(); return lo.concat(hi);
}

/** Color de cada hora en el diagrama de sombras: mañana azul verdosa, mediodía claro, tarde ámbar. */
export function colorHora(h) {
  const t = Math.min(1, Math.max(0, (h - 6) / 12));
  const a = new THREE.Color(0x5cc8d6), b = new THREE.Color(0xf2efe6), c = new THREE.Color(0xf4a23a);
  return t < 0.5 ? a.lerp(b, t * 2) : b.clone().lerp(c, (t - 0.5) * 2);
}
