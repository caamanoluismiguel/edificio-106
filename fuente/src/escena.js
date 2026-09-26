// Escena 3D del Edificio 106: carga por grupos de armado, materiales con revelado por altura,
// partículas que arman el edificio, cielo, sol real, sombras, nubes, lluvia y calor en fachadas.
import * as THREE from 'three/webgpu';
import {
  Fn, uniform, float, vec2, vec3, vec4, mix, clamp, smoothstep, max, min, pow, dot, sin, cos, fract, floor,
  positionWorld, normalWorld, time, hash, shapeCircle, instancedBufferAttribute, mx_noise_float,
  mx_fractal_noise_float, oneMinus, step, length, pass, texture, uv, select, mrt, normalView, velocity, sample,
  packNormalToRGB, unpackRGBToNormal, builtinAOContext, screenUV, positionLocal, abs, viewportSize, materialColor, materialRoughness, renderOutput, cameraPosition
} from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { vectorSol, FACHADAS, posicionSol, saleYPone } from './sol.js';
import { binario } from './datos.js';

export const GRUPOS = ['sitio', 'arquitectura', 'ventanas', 'cubiertas', 'entrada', 'detalles', 'vegetacion', 'contexto'];
// Reparto de partículas por grupo (fracción del total)
const CUOTA = { sitio: 0.11, arquitectura: 0.19, ventanas: 0.10, cubiertas: 0.20, entrada: 0.05, detalles: 0.05, vegetacion: 0.2, contexto: 0.10 };

export const U = {                       // uniformes compartidos
  build: uniform(0),                     // 0..8: avance del armado (un grupo por unidad)
  junta: uniform(0),                     // 0..1: los puntos vuelan hasta su lugar (todos a la vez)
  mat: uniform(0),                       // 0 = arcilla, 1 = materiales reales
  puntos: uniform(1),                    // visibilidad global de las partículas
  nubeSombra: uniform(0),                // 0..1: fuerza de las sombras de nubes
  nubeCob: uniform(0.35),                // cobertura de nubes (para el patrón)
  calor: uniform(0),                     // 0..1: capa de calor en fachadas
  calorF: uniform(new THREE.Vector4()),  // irradiancia normalizada por fachada (SE, NO, NE, SO)
  calorTecho: uniform(0),
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
  grisCielo: uniform(new THREE.Color(0.6, 0.62, 0.65)),
};

const clayColor = vec3(0.74, 0.72, 0.68);

export class Escena {
  constructor(canvasParent, calidad) {
    this.calidad = calidad;           // {nivel, dpr, sombras, particulas, bloom}
    this.parent = canvasParent;
    this.grupos = {};                 // nombre -> {root, minY, maxY, idx}
    this.solDir = new THREE.Vector3(0, 1, 0);
    this.listeners = [];
  }

  async init(forceWebGL = false) {
    const r = new THREE.WebGPURenderer({ antialias: false, forceWebGL, powerPreference: 'high-performance' });
    await r.init();
    this.backend = r.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
    r.setPixelRatio(this.dprMax());
    r.setSize(window.innerWidth, window.innerHeight);
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.parent.appendChild(r.domElement);
    r.domElement.style.touchAction = 'none';
    r.domElement.setAttribute('aria-hidden', 'true');
    this.renderer = r;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x9fb3c0, 350, 2600);
    this.scene = scene;
    const cam = new THREE.PerspectiveCamera(window.innerWidth / window.innerHeight < 0.8 ? 58 : 38, window.innerWidth / window.innerHeight, 0.3, 7000);
    cam.position.set(65, 2.1, 29);
    this.camera = cam;

    // Cielo (Preetham + nubes procedurales de three.js)
    const sky = new SkyMesh();
    sky.scale.setScalar(6000);
    sky.turbidity.value = 7; sky.rayleigh.value = 2.0; sky.mieCoefficient.value = 0.006; sky.mieDirectionalG.value = 0.8;
    sky.cloudCoverage.value = 0.35; sky.cloudDensity.value = 0.45; sky.cloudElevation.value = 0.5;
    sky.material.fog = false;
    sky.material.colorNode = mix(sky.material.colorNode.mul(vec4(vec3(U.cielo), 1)), vec4(U.grisCielo, 1), U.cubierto);
    scene.add(sky); this.sky = sky;
    // escena aparte para el mapa de entorno (misma bóveda, sin nubes densas)
    this.skyEnvScene = new THREE.Scene();
    const sky2 = new SkyMesh(); sky2.scale.setScalar(1000);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) sky2[k].value = sky[k].value;
    sky2.cloudCoverage.value = 0.2; sky2.cloudDensity.value = 0.3; sky2.showSunDisc.value = 0;
    sky2.material.colorNode = mix(sky2.material.colorNode.mul(vec4(vec3(U.cielo), 1)), vec4(U.grisCielo, 1), U.cubierto);
    this.skyEnvScene.add(sky2); this.sky2 = sky2;
    this.pmrem = new THREE.PMREMGenerator(r);

    // Luces
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.castShadow = true;
    const S = this.calidad.sombras;
    sun.shadow.mapSize.set(S, S);
    const sc = sun.shadow.camera; sc.left = -115; sc.right = 115; sc.top = 115; sc.bottom = -115; sc.near = 10; sc.far = 1400;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.35;
    sun.shadow.radius = 2;
    sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true;   // se recalcula solo cuando cambia el sol o el armado
    sun.shadow.camera.layers.set(1);                                 // proyectan sombra solo los objetos en la capa 1
    scene.add(sun); scene.add(sun.target); this.sun = sun;
    this.hemi = new THREE.HemisphereLight(0xbfd4e6, 0x5b5a3e, 0.6);
    scene.add(this.hemi);

    // Suelo lejano para que el terreno llegue al horizonte
    const g = new THREE.CircleGeometry(3200, 64); g.rotateX(-Math.PI / 2);
    const gm = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(0.05, 0.085, 0.03), roughness: 0.95 });
    gm.colorNode = mix(clayColor.mul(0.55), vec3(0.05, 0.085, 0.03), U.mat);
    gm.receivedShadowNode = sombraNubes;
    const suelo = new THREE.Mesh(g, gm); suelo.position.y = -0.05; suelo.receiveShadow = true; scene.add(suelo);
    this.suelo = suelo;

    this.#reticula();
    this.#lluvia();
    this.#rosa();
    this.#ruta();

    // Postproceso: oclusión ambiental (GTAO) + suavizado temporal (TRAA) en equipos potentes,
    // bloom suave, viñeta y grano de película.
    this.pipeline = new THREE.RenderPipeline(r);
    const scenePass = pass(scene, cam);
    let col = scenePass.getTextureNode('output');
    if (this.calidad.ao) {
      const pre = pass(scene, cam); pre.transparent = false;
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
    const vig = smoothstep(float(1.25), float(0.35), length(screenUV.sub(0.5).mul(vec2(1.35, 1.0))));
    const grano = hash(screenUV.mul(viewportSize).add(fract(time.mul(13.7)).mul(517.0))).sub(0.5).mul(0.035);
    // suavizado FXAA sobre la imagen ya tonemapeada (más barato que MSAA ×4 a esta resolución)
    const acabar = (n, aa) => { const v = vec4(n.rgb.mul(mix(0.72, 1.0, vig)).mul(float(1).add(grano)).add(U.relampago.mul(0.35)), 1.0); return aa ? fxaa(renderOutput(v)) : renderOutput(v); };
    this.pipeline.outputColorTransform = false;
    const aa = this.calidad.nivel !== 'bajo';
    this.salidas = { sinBloom: acabar(col, aa), sinAA: acabar(col, false) };
    this.salidas.conBloom = acabar(col.add(bloom(scenePass.getTextureNode('output'), 0.12, 0.4, 2.4)), aa);
    this.bloomOn = !!this.calidad.bloom;
    this.pipeline.outputNode = this.bloomOn ? this.salidas.conBloom : this.salidas.sinBloom;

    window.addEventListener('resize', () => this.resize());
    this.setSol(-8, 90);
    return this;
  }

  /** Cambia la salida del postproceso (para medir o para bajar costo). */
  setSalida(k) { this.pipeline.outputNode = this.salidas[k]; this.pipeline.needsUpdate = true; this.sucio = true; }

  /** Resolución máxima: nunca más de ~3,7 millones de píxeles dibujados, ni más que el nivel de calidad. */
  dprMax() {
    const px = window.innerWidth * window.innerHeight, presupuesto = this.calidad.px ?? 3.7e6;
    return Math.max(0.6, Math.min(window.devicePixelRatio, this.calidad.dpr, Math.sqrt(presupuesto / px)));
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(this.renderer.getPixelRatio(), this.dprMax()));
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 58 : 38;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.sucio = true;
  }

  // ---------- Sol, cielo, exposición ----------
  setSol(alt, az) {
    this.alt = alt; this.az = az;
    const v = vectorSol(alt, az);
    this.solDir.set(v.x, v.y, v.z).normalize();
    this.sky.sunPosition.value.copy(this.solDir);
    this.sky2.sunPosition.value.copy(this.solDir);
    const up = Math.max(0, Math.sin(alt * Math.PI / 180));
    // luz directa: se apaga bajo el horizonte y se entibia cerca de él
    const k = THREE.MathUtils.smoothstep(alt, -1.5, 6);
    const warm = THREE.MathUtils.smoothstep(alt, 0, 35);
    this.sun.color.setRGB(1, 0.55 + 0.42 * warm, 0.3 + 0.62 * warm);
    const lv = this.lv ?? 0;               // lluvia visible (0..1)
    const ks = this.kSol ?? 1;             // transmisión del sol directo (DNI de los datos / DNI de cielo despejado)
    this.sun.intensity = 5.0 * k * (0.55 + 0.45 * Math.min(1, up * 2)) * (1 - 0.88 * lv) * (0.1 + 0.9 * ks);
    const cub = 1 - ks;
    const sd = this.solDir.clone().multiplyScalar(600);
    if (!this._sd || this._sd.distanceTo(sd) > 0.4) { this._sd = sd.clone(); this.sun.shadow.needsUpdate = true; this.sucio = true; }
    this.sun.position.copy(sd); this.sun.target.position.set(0, 0, 0);
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
    this.hemi.intensity = 0.08 + day * (0.22 + 0.95 * cubierto) + 5 * fl;
    const hc = new THREE.Color().setRGB(0.55 + 0.2 * day, 0.62 + 0.2 * day, 0.85 + 0.05 * day).lerp(new THREE.Color(0.86, 0.89, 0.93), cubierto);
    this.hemi.color.copy(hc);
    this.hemi.groundColor.setRGB(0.2 + 0.15 * day, 0.2 + 0.14 * day, 0.14 + 0.08 * day);
    this.renderer.toneMappingExposure = 0.85 + 0.6 * (1 - day) + 0.2 * cubierto;
    const fogC = new THREE.Color().setRGB(0.1 + 0.52 * day, 0.13 + 0.55 * day, 0.2 + 0.55 * day);
    fogC.lerp(new THREE.Color(g * 0.88, g * 0.92, g * 0.96), Math.max(lv, cubierto * 0.6));
    this.scene.fog.color.copy(fogC);
    this.scene.fog.near = 350 - 310 * lv; this.scene.fog.far = 2600 - 1900 * lv;
    this.sky.cloudCoverage.value = Math.min(1, Math.max(U.nubeCob.value, lv));
    this.sky.cloudDensity.value = 0.45 + 0.5 * lv;
    this.sky.turbidity.value = 7 + 5 * lv;
    this.sky2.cloudCoverage.value = 0.2 + 0.75 * lv;
    U.luzLluvia.value = 0.25 + 0.75 * day + 2 * fl;
    U.noche.value = 1 - THREE.MathUtils.smoothstep(alt, -6, 2);
    const clave = [Math.round(alt * 4), Math.round(az * 2), Math.round(lv * 20), Math.round(cubierto * 20)].join(',');
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

  // ---------- Carga ----------
  /** Carga los grupos del modelo. `prioridad` define el orden; vegetación y contexto llegan al final. */
  async cargar(base, onProgress) {
    const loader = new GLTFLoader();
    try { await MeshoptDecoder.ready; loader.setMeshoptDecoder(MeshoptDecoder); } catch (e) { /* sin meshopt no hay modelo */ }
    const tex = new THREE.TextureLoader();
    const texturas = {};
    const cargaTex = (f) => texturas[f] ??= tex.loadAsync(base + 'texturas/' + f).then(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }).catch(() => null);
    const lista = this.calidad.grupos ?? GRUPOS;
    const leerGLB = async (nombre) => {
      const bytes = await binario(base + 'modelo/' + nombre + '.glb', (l, t) => onProgress?.(nombre, l, t));
      return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), base + 'modelo/');
    };
    this.listos = new Set();
    const uno = async (nombre) => {
      const idx = GRUPOS.indexOf(nombre);
      const gltf = await leerGLB(nombre);
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const info = { root, idx, minY: box.min.y, maxY: box.max.y, box };
      const uMin = uniform(box.min.y), uMax = uniform(box.max.y);
      const materiales = [];
      root.traverse((o) => {
        if (!o.isMesh) return;
        // proyectan sombra: todo menos el contexto lejano y las tejas (estas usan un sustituto liviano)
        const tejas = nombre === 'cubiertas' && /terracotta/i.test(o.material?.name || '');
        o.castShadow = nombre !== 'contexto' && !tejas; o.receiveShadow = true;
        if (o.castShadow) o.layers.enable(1);
        o.material = this.#material(o.material, nombre, idx, uMin, uMax, cargaTex);
        materiales.push(o.material);
      });
      info.materiales = materiales;
      this.grupos[nombre] = info;
      this.scene.add(root); this.sun.shadow.needsUpdate = true; this.sucio = true;
      this.listos.add(nombre); onProgress?.(nombre, 1, 1, this.listos.size / lista.length);
      if (nombre === 'cubiertas') this.#sombraCubiertas(leerGLB, idx, uMin, uMax);
      return info;
    };
    // de dos en dos, en el orden del armado: lo primero que se arma llega primero
    const orden = GRUPOS.filter(g => lista.includes(g));
    const promesas = {};
    let i = 0;
    const siguiente = () => { if (i >= orden.length) return null; const g = orden[i++]; return (promesas[g] = uno(g).catch((e) => { console.warn('grupo', g, e); this.listos.add(g); })).then(siguiente); };
    this.cargaCompleta = Promise.all([siguiente(), siguiente()]);
    this.promesas = promesas;
    return this;
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

  #material(src, grupo, idx, uMin, uMax, cargaTex) {
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
      const f = ex.image.replace(/_4k\.jpg$|_2k\.jpg$/, '_1k.webp');
      m.color.setRGB(1, 1, 1);
      cargaTex(f).then((t) => { if (t) { m.map = t; m.needsUpdate = true; this.sucio = true; } });
      colBase = materialColor;       // con map, materialColor ya incluye la textura
    }
    if (glass) {
      m.color.setRGB(0.03, 0.04, 0.045); m.roughness = 0.06; m.metalness = 0.0;
      colBase = materialColor;
      m.envMapIntensity = 1.6;
      // luces interiores de noche: celdas de 3,8 m × 3,65 m, encendidas al azar (~65 %)
      const cell = floor(vec2(positionWorld.x.add(positionWorld.z).div(3.8), positionWorld.y.div(3.65)));
      const on = step(0.35, hash(cell.x.mul(17.0).add(cell.y.mul(131.0))));
      m.emissiveNode = vec3(1.0, 0.62, 0.3).mul(on).mul(U.noche).mul(3.2);
    }
    const nmPlaster = nm.includes('plaster') || nm.includes('cream trim');
    let colorFinal = colBase;
    if (nmPlaster) {
      // pañete: algas y salpicadura en la base del muro + manchas amplias de la pintura
      const y = positionWorld.y;
      const n = mx_fractal_noise_float(positionWorld.mul(vec3(0.35, 0.9, 0.35)), 3, 2.0, 0.5).mul(0.5).add(0.5);
      const base_ = smoothstep(1.0, 0.0, y).mul(0.35).mul(n.add(0.4));
      const stain = mx_noise_float(positionWorld.mul(vec3(0.08, 0.3, 0.08))).mul(0.06);
      colorFinal = colBase.mul(float(1).sub(base_).sub(stain)).mul(vec3(1, 1.0, 0.985)).add(vec3(-0.02, 0.0, -0.02).mul(base_));
    }
    if (nm.includes('terracotta') || nm.includes('clay')) {
      const n = mx_noise_float(positionWorld.mul(1.7)).mul(0.5).add(0.5);
      colorFinal = colBase.mul(mix(0.78, 1.25, n));
    }
    m.colorNode = mix(clayColor, colorFinal, U.mat);
    if (glass) m.colorNode = mix(clayColor.mul(0.35), colorFinal, U.mat);

    // Calor en fachadas (irradiancia directa por orientación), sobre muros y cubiertas
    if (!glass && !leaf && grupo !== 'contexto' && grupo !== 'vegetacion') {
      const n = normalWorld;
      const f = U.calorF;
      const w = (nx, nz) => pow(max(dot(n, vec3(nx, 0, nz)), 0), 3.0);
      const dirs = Object.values(FACHADAS).map(fc => { const v = vectorSol(0, fc.rumbo); return [v.x, v.z]; });
      const heat = w(...dirs[0]).mul(f.x).add(w(...dirs[1]).mul(f.y)).add(w(...dirs[2]).mul(f.z)).add(w(...dirs[3]).mul(f.w))
        .add(pow(max(n.y, 0), 3.0).mul(U.calorTecho));
      const ramp = mix(mix(vec3(0.05, 0.12, 0.35), vec3(0.95, 0.55, 0.08), smoothstep(0.0, 0.55, heat)), vec3(0.95, 0.12, 0.05), smoothstep(0.55, 1.0, heat));
      const prevE = m.emissiveNode;
      const e = ramp.mul(U.calor).mul(0.9);
      m.emissiveNode = prevE ? prevE.add(e) : e;
      m.colorNode = mix(m.colorNode, m.colorNode.mul(0.35), U.calor);
    }

    // Mojado: superficies porosas más oscuras y brillantes; charcos en superficies horizontales bajas
    if (!glass && !leaf) {
      const metal = nm.includes('alumin') || nm.includes('guardrail') || nm.includes('galvan') || nm.includes('cabinet');
      const poro = uniform(metal ? 0.25 : 1.0);
      const up = smoothstep(0.55, 0.95, normalWorld.y);
      const nch = mx_noise_float(vec3(positionWorld.x.mul(0.11), positionWorld.z.mul(0.11), 3.7)).mul(0.5).add(0.5);
      const charco = smoothstep(0.6, 0.7, nch).mul(up).mul(step(positionWorld.y, 1.2));
      const wv = U.mojado.mul(poro);
      m.colorNode = m.colorNode.mul(mix(float(1), mix(float(0.64), float(0.4), charco), wv));
      const r0 = materialRoughness;
      const rWet = mix(float(0.45), float(0.16), up).mul(float(1).sub(charco.mul(0.85)));
      m.roughnessNode = mix(r0, min(r0, rWet), wv);
    }

    // Revelado del grupo
    const g = uniform(idx);
    const reveal = clamp(U.build.sub(g).sub(0.78).div(0.5), 0, 1);
    const ruido = mx_noise_float(positionWorld.mul(0.6)).mul(0.6);
    if (grupo === 'contexto') {
      const r = length(positionWorld.xz);
      const cut = mix(0.0, 900.0, reveal.mul(reveal));
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
    if (!/[?&]sinnubes/.test(location.search)) m.receivedShadowNode = sombraNubes;
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
    spr.count = N; spr.frustumCulled = false; spr.renderOrder = 10;
    this.scene.add(spr); this.particulas = spr;
    return N;
  }

  /** Terminado el armado, las partículas se liberan de la memoria de la GPU. */
  liberarParticulas() {
    if (!this.particulas) return;
    this.scene.remove(this.particulas); this.particulas.material.dispose(); this.particulas.geometry?.dispose?.();
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
    this.rutaLinea = new THREE.Mesh(new THREE.BufferGeometry(), this.rutaMat); this.rutaLinea.frustumCulled = false; this.rutaLinea.renderOrder = 6;
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

  render() {
    U.cam.value.copy(this.camera.position);
    const llueve = U.lluvia.value > 0.01;
    if (this.lluviaSpr) this.lluviaSpr.visible = this.aleros.visible = this.salpicaduras.visible = llueve;
    if (this.particulas) this.particulas.visible = U.puntos.value > 0.001 && U.build.value < 8.35;
    if (this.lineasReticula) this.lineasReticula.visible = U.reticula.value > 0.001;
    if (this.rosaMesh) this.rosaMesh.visible = this.uRosa.value > 0.01;
    if (this.rutaLinea) this.rutaLinea.visible = this.rutaHoras.visible = this.uRuta.value > 0.01;
    if (this.rutaRotulos) for (const s of this.rutaRotulos) s.visible = this.uRuta.value > 0.01 && s.userData.arriba;
    if (this.rutaSol) this.rutaSol.visible = this.uRuta.value > 0.01 && this.alt > -1;
    const t0 = performance.now();
    this.pipeline.render();
    this.sucio = false;
    if (this._envPend) this.#envTalVez();
    return t0;
  }

  /** Resolución adaptable: baja si los cuadros tardan, sube si sobra tiempo. */
  ajustarResolucion(msPorCuadro) {
    const r = this.renderer, max = this.dprMax(), min = 0.6;
    let d = r.getPixelRatio();
    if (msPorCuadro > 24 && d > min) d = Math.max(min, d - 0.15);
    else if (msPorCuadro < 12 && d < max) d = Math.min(max, d + 0.1);
    else return;
    r.setPixelRatio(d); this.sucio = true;
  }
}

// Sombras de nubes proyectadas sobre todo lo que recibe sol
const sombraNubes = Fn(([s]) => {
  const p = positionWorld.xz.mul(0.0045).add(U.viento.mul(time.mul(0.012)));
  const n = mx_fractal_noise_float(vec3(p, 0.0), 2, 2.0, 0.5).mul(0.5).add(0.5);
  const cov = U.nubeCob;
  const nube = smoothstep(float(1.0).sub(cov), float(1.0).sub(cov).add(0.18), n);
  return s.mul(float(1).sub(nube.mul(U.nubeSombra).mul(0.8)));
});

export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
