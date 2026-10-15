// Lectura «Diseño industrial»: el mismo 106 (los GLB de main que ya cargó escena.js) dibujado en línea sobre papel, con cámara
// ortográfica, foco con fantasma y corte con poché. Escena aparte: no toca ninguna malla, geometría, material, luz ni pasada
// del 106 (solo comparte sus atributos de posición). Solo existe con ?lectura=di: escena.js crea el objeto y, si existe,
// dibuja esta escena en vez del postproceso. Las decisiones de dibujo las debatió el panel del carril D (D1 a D14).
import * as THREE from 'three/webgpu';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { conVersion } from './datos.js';
import { PLANTA } from './mecanismos/planta-106.js';

export const LECTURA_DI = typeof location !== 'undefined' && /[?&]lectura=di(?:&|#|$)/.test(location.search);

// ---------------------------------------------------------------- sistemas y familias
// Los siete sistemas del contrato de datos/familias.json. Orden de armado de las aristas (D8): lo que da la silueta primero.
export const SISTEMAS = { base: 'Base y suelo', estructura: 'Losas y cartelas', muros: 'Muros', ventanas: 'Ventanas y lamas',
  cubierta: 'Cubierta', accesos: 'Accesos', servicios: 'Instalaciones' };
const ORDEN = ['muros', 'ventanas', 'cubierta', 'estructura', 'accesos', 'base', 'servicios'];
// grupos del 106 que se dibujan (D7): el edificio y lo del sitio que es edificio; ni vegetación, ni contexto, ni ciudad
const GRUPOS_DI = ['arquitectura', 'ventanas', 'cubiertas', 'entrada', 'detalles', 'sitio'];

// Con datos/familias.json, por familia (D7, D5, D14): lo que no se dibuja, lo que lleva poché y lo que va sin aristas
const FUERA_FAM = new Set(['calzada', 'pintura_vial', 'bordillo', 'cesped', 'acera', 'junta_acera', 'muro_curvo']);
const POCHE_FAM = new Set(['muro', 'losa', 'piso_interior', 'cielorraso', 'losa_entrada']);
const SIN_ARISTAS_FAM = new Set(['vidrio']);
const RAYADO_FAM = new Set(['teja']);
// Respaldo provisional por material, para lo que no tiene clave en familias.json (o si el archivo no está)
const FUERA_SITIO = /Leafy grass|Weathered asphalt|Road paint|Worn yellow kerb|Concrete paving|Painted soffits/i;   // «Painted soffits» de sitio.glb va de x −69 a 49, casi todo lejos del 106 (no es el alero)
const TEJA = /terracotta/i;
const VIDRIO = /glass/i;
const POCHE_MAT = /^(Warm lime-painted plaster|Unlit interior walls|V014 neutral interior plaster|V014 muted interior floor|V014 shaded neutral ceiling)/i;
const REGLAS = [
  [/sign|Utility cabinet|diffuser/i, 'servicios'],
  [/Brown painted service access|guardrail|Pale cast concrete|access paving|access concrete/i, 'accesos'],
  [/ventilation recess|support piers|splash on plinth/i, 'base'],
  [/terracotta|roof timber|attic fascia/i, 'cubierta'],
  [/glass|window frames|louvre|infill board|cream trim/i, 'ventanas'],
  [/plaster|Unlit interior walls/i, 'muros'],
  [/interior floor|ceiling|soffits/i, 'estructura'],
];
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
/** Familia provisional de un material (una familia por material, con su sistema por regla). null: no se dibuja. */
function provisional(grupo, mat0) {
  if (grupo === 'sitio' && FUERA_SITIO.test(mat0)) return null;
  const mat = mat0.replace(/\s\d+$/, '');   // «Clay terracotta 04» y «… 00» son la misma familia
  return { familia: 'mat_' + slug(mat), nombre: mat, sistema: REGLAS.find(([re]) => re.test(mat))?.[1] ?? 'estructura',
    poche: POCHE_MAT.test(mat), rayado: TEJA.test(mat), sinAristas: VIDRIO.test(mat), provisional: true };
}
/** Descripción de una familia de familias.json. */
function deContrato(datos, id) {
  const f = datos.familias[id]; if (!f || FUERA_FAM.has(id)) return null;
  return { familia: id, nombre: f.nombre, sistema: f.sistema, poche: POCHE_FAM.has(id), rayado: RAYADO_FAM.has(id), sinAristas: SIN_ARISTAS_FAM.has(id) };
}

/** Las familias de una malla del 106, en tramos: devuelve paso(fin) → null mientras trabaja y, al terminar, la lista
 *  [{ desc, indices }] (indices = null: la malla entera). Sin datos, provisional por material. Con familias.json (contrato del
 *  carril C), parte la malla en piezas como fuente/estado.mjs (triángulos de un material, vértices unidos a 0,5 mm en el
 *  mundo, clave «material|triángulos|caja en cm»), busca cada clave en `piezas`, aplica la regla de la teja a las que no
 *  están y deja el resto con la familia provisional de su material. No escribe nada en la malla ni en su geometría. */
export function familiasDe(grupo, malla, datos) {
  const mat = malla.material?.name || '(sin material)';
  if (!datos) { const d = provisional(grupo, mat); return () => (d ? [{ desc: d, indices: null }] : []); }
  const pos = malla.geometry.attributes.position, idx = malla.geometry.index;
  const nv = pos.count, nt = idx ? idx.count / 3 : nv / 3, M = malla.matrixWorld.elements;
  let P, vid, clave, num0 = null;
  const tri = (t, j) => (idx ? idx.getX(3 * t + j) : 3 * t + j);
  const regla = datos.familias.teja?.regla, glbTeja = regla && regla.glb?.some((g) => g === grupo || g.startsWith(grupo + '_'));
  const reTeja = regla ? new RegExp(regla.material) : null;
  let fase = 0, i = 0, par, C, lista, porFam, grupos, salida;
  return (fin) => {
    if (fase === 0) {          // vértices en el mundo y unidos a 0,5 mm
      if (!P) {
        P = new Float64Array(nv * 3); vid = new Int32Array(nv); clave = new Map();
        const bb = malla.geometry.boundingBox?.clone().applyMatrix4(malla.matrixWorld);   // caja del cargador (copia: no se toca la del 106)
        if (bb) {
          const lo = [bb.min.x, bb.min.y, bb.min.z].map((v) => Math.round(v * 2e3) - 2), n = [bb.max.x, bb.max.y, bb.max.z].map((v, k) => Math.round(v * 2e3) + 3 - lo[k]);
          if (n[0] * n[1] * n[2] < 2 ** 52) num0 = [...lo, n[0], n[1]];
        } if (performance.now() > fin) return null; }   // reservar puede gastar el tramo
      for (; i < nv; i++) {
        if ((i & 63) === 0 && performance.now() > fin) return null;
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        for (let k = 0; k < 3; k++) P[3 * i + k] = M[k] * x + M[4 + k] * y + M[8 + k] * z + M[12 + k];
        const ix = Math.round(P[3 * i] * 2e3), iy = Math.round(P[3 * i + 1] * 2e3), iz = Math.round(P[3 * i + 2] * 2e3);
        const ex = num0 ? ix - num0[0] : -1, ey = num0 ? iy - num0[1] : -1, ez = num0 ? iz - num0[2] : -1;
        const kk = ex >= 0 && ex < num0[3] && ey >= 0 && ey < num0[4] && ez >= 0 ? ex + num0[3] * (ey + num0[4] * ez) : `${ix},${iy},${iz}`;   // número exacto (sin basura de cadenas); fuera de la caja, cadena
        let v = clave.get(kk); if (v === undefined) { v = clave.size; clave.set(kk, v); } vid[i] = v;
      }
      par = new Int32Array(clave.size); clave = null; fase = 1; i = -1;
    }
    if (fase === 1 && i < 0) {
      for (let k = 0; k < par.length; k++) par[k] = k;
      i = 0; if (performance.now() > fin) return null;
    }
    const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    if (fase === 1) {          // componentes conexas
      for (; i < nt; i++) {
        if ((i & 63) === 0 && performance.now() > fin) return null;
        const a = f(vid[tri(i, 0)]), b = f(vid[tri(i, 1)]), c = f(vid[tri(i, 2)]); par[a] = c; par[b] = c;
      }
      C = new Map(); fase = 2; i = 0;
    }
    if (fase === 2) {          // caja y triángulos de cada pieza
      for (; i < nt; i++) {
        if ((i & 63) === 0 && performance.now() > fin) return null;
        const r = f(vid[tri(i, 0)]); let c = C.get(r);
        if (!c) { c = { n: 0, mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9], t: [] }; C.set(r, c); }
        c.n++; c.t.push(i);
        for (let j = 0; j < 3; j++) { const v = tri(i, j); for (let k = 0; k < 3; k++) { const q = P[3 * v + k]; if (q < c.mn[k]) c.mn[k] = q; if (q > c.mx[k]) c.mx[k] = q; } }
      }
      fase = 3;
    }
    if (fase === 3) {          // cada pieza a su familia
      lista = [...C.values()]; porFam = new Map(); fase = 4; i = 0;
    }
    const cm = (x) => Math.round(x * 100);
    if (fase === 4) {
      for (; i < lista.length; i++) {
        if ((i & 63) === 0 && performance.now() > fin) return null;
        const c = lista[i], k = `${mat}|${c.n}|${c.mn.map(cm).join(',')}|${c.mx.map(cm).join(',')}`;
        let d; const id = datos.piezas[k];
        if (id) d = deContrato(datos, id);
        else if (glbTeja && reTeja.test(mat) && (grupo === 'cubiertas_sombra' || Math.max(c.mx[0] - c.mn[0], c.mx[1] - c.mn[1], c.mx[2] - c.mn[2]) <= regla.largoMaxM)) d = deContrato(datos, 'teja');
        else d = provisional(grupo, mat);
        if (!d) continue;
        let g = porFam.get(d.familia); if (!g) porFam.set(d.familia, g = { desc: d, t: [], piezas: 0, conClave: 0 });
        for (const t of c.t) g.t.push(t);
        g.piezas++; if (id) g.conClave++;
      }
      grupos = [...porFam.values()]; salida = []; fase = 5; i = 0;
    }
    for (; i < grupos.length; i++) {   // un índice por familia, en tramos
      const g = grupos[i];
      g.ind ??= new Uint32Array(g.t.length * 3); g.k ??= 0;
      for (; g.k < g.t.length; g.k++) {
        if ((g.k & 1023) === 0 && performance.now() > fin) return null;
        for (let j = 0; j < 3; j++) g.ind[3 * g.k + j] = tri(g.t[g.k], j);
      }
      salida.push({ desc: g.desc, indices: g.ind, piezas: g.piezas, conClave: g.conClave });
    }
    return salida;
  };
}

/** Aristas de EdgesGeometry de three r186 (mismo algoritmo: vértices iguales si coinciden redondeados a 1e-4, aristas
 *  emparejadas por dirección, umbral de ángulo y bordes de una sola cara), en tramos y sin cadenas: cada vértice redondeado
 *  recibe un número y cada arista dirigida una casilla, para no llenar la memoria de basura en el teléfono.
 *  `indices` = subconjunto de triángulos (o null: la malla entera).
 *  paso(fin) → null mientras trabaja y Float32Array (pares de puntos, en coordenadas de la malla) al terminar. */
export function aristasDe(geo, indices, umbral = 24) {
  const pos = geo.attributes.position, idx = indices ?? (geo.index ? geo.index.array : null);
  const cuenta = idx ? idx.length : pos.count, precision = 1e4, umbralDot = Math.cos(THREE.MathUtils.DEG2RAD * umbral);
  const tri = new THREE.Triangle(), n = new THREE.Vector3(), v0 = new THREE.Vector3(), v1 = new THREE.Vector3();
  const ind = [0, 0, 0], vk = ['a', 'b', 'c'], h = [0, 0, 0];
  const ids = new Map();                 // vértice redondeado → número
  const casilla = new Map();             // arista dirigida (a, b) → casilla; -1 = ya emparejada
  let i0 = [], i1 = [], nor = [], out = [], i = 0, k = 0, nid = 0, vals = null;
  const bb = geo.boundingBox, r = (v) => Math.round(v * precision);
  // clave numérica exacta del vértice redondeado si la caja cabe en 2^52; si no, cadena (como three)
  let lo = null, nx = 0, ny = 0;
  if (bb) { lo = [r(bb.min.x) - 2, r(bb.min.y) - 2, r(bb.min.z) - 2]; nx = r(bb.max.x) + 3 - lo[0]; ny = r(bb.max.y) + 3 - lo[1]; if (nx * ny * (r(bb.max.z) + 3 - lo[2]) >= 2 ** 52) lo = null; }
  const id = (v) => {
    const x = r(v.x), y = r(v.y), z = r(v.z), dx = lo ? x - lo[0] : -1, dy = lo ? y - lo[1] : -1, dz = lo ? z - lo[2] : -1;
    const key = dx >= 0 && dx < nx && dy >= 0 && dy < ny && dz >= 0 ? dx + nx * (dy + ny * dz) : `${x},${y},${z}`;   // fuera de la caja: cadena
    let q = ids.get(key); if (q === undefined) ids.set(key, q = nid++); return q;
  };
  const N = 1 << 26;                     // ids de vértice < 2^26: la arista (a, b) = a·2^26 + b cabe en un número exacto
  return (fin) => {
    for (; i < cuenta; i += 3) {
      if ((i % 48) === 0 && performance.now() > fin) return null;
      for (let j = 0; j < 3; j++) ind[j] = idx ? idx[i + j] : i + j;
      tri.a.fromBufferAttribute(pos, ind[0]); tri.b.fromBufferAttribute(pos, ind[1]); tri.c.fromBufferAttribute(pos, ind[2]);
      tri.getNormal(n);
      h[0] = id(tri.a); h[1] = id(tri.b); h[2] = id(tri.c);
      if (h[0] === h[1] || h[1] === h[2] || h[2] === h[0]) continue;
      for (let j = 0; j < 3; j++) {
        const jn = (j + 1) % 3, a = tri[vk[j]], b = tri[vk[jn]];
        const kd = h[j] * N + h[jn], kr = h[jn] * N + h[j], otra = casilla.get(kr);
        if (otra !== undefined && otra >= 0) {
          if (n.x * nor[3 * otra] + n.y * nor[3 * otra + 1] + n.z * nor[3 * otra + 2] <= umbralDot) out.push(a.x, a.y, a.z, b.x, b.y, b.z);
          casilla.set(kr, -1);
        } else if (!casilla.has(kd)) { const c = i0.length; casilla.set(kd, c); i0.push(ind[j]); i1.push(ind[jn]); nor.push(n.x, n.y, n.z); }
      }
    }
    if (k === 0) { k = 1; vals = [...casilla.values()]; casilla.clear(); ids.clear(); }
    for (; k - 1 < vals.length; k++) {
      if ((k & 63) === 0 && performance.now() > fin) return null;
      const c = vals[k - 1]; if (c < 0) continue;
      v0.fromBufferAttribute(pos, i0[c]); v1.fromBufferAttribute(pos, i1[c]);
      out.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z);
    }
    const res = new Float32Array(out); out = i0 = i1 = nor = vals = null; return res;
  };
}

// ---------------------------------------------------------------- colores (D1): del CSS del 106, sin colores nuevos ni ámbar
function colores() {
  const s = getComputedStyle(document.documentElement);
  const c = (v, def) => new THREE.Color((s.getPropertyValue(v) || '').trim() || def);
  return { papel: c('--cal', '#efe9de'), tinta: c('--noche', '#0a1216'), tenue: c('--cal-3', '#7f8a86'), poche: c('--solido', '#0e171b'), teja: c('--teja', '#c9653f') };
}
const num = (x, d = 1) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(d).replace('.', ',');

const PASO_TEJA = 0.5;          // rayado: una línea cada 0,5 m (valor de dibujo, no la medida de la teja; D3)
const PRESUPUESTO = 6;          // ms por tramo (D8)
const MAX_GRUESA = 60000;       // segmentos: más que eso en tinta gruesa (LineSegments2) no se arma; queda la línea fina
const PLANTA_DEF = 2.6;         // corte en planta por defecto (D10): la mitad del vano de planta baja
const PISO_PB = 0.65;           // cara de arriba del piso interior de planta baja en el modelo
const GALERIA = 1.28;           // piso de la galería elevada en el modelo
// Fachada hacia la que crece cada eje del corte (planta-106.js: x a lo largo hacia la NE, z a lo ancho hacia la SE; +x apunta a
// EJE_LARGO = 56° de sol.js y +z a 146°, el rumbo de la fachada SE)
const LADO = { x: ['NE', 'SO'], z: ['SE', 'NO'] };
const afuera = (v) => (v < 0 ? Math.floor(v * 10) : Math.ceil(v * 10)) / 10;   // al decímetro, hacia afuera
const libre = (f) => (globalThis.requestIdleCallback ? requestIdleCallback(f, { timeout: 120 }) : setTimeout(() => f({ timeRemaining: () => PRESUPUESTO }), 16));

export class Dibujo {
  constructor(escena) {
    this.e = escena;
    this.C = colores();
    this.escena = new THREE.Scene();
    this.escena.background = this.C.papel.clone();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 4000);
    // todo lo dibujado va dentro de un ClippingGroup: en three/webgpu material.clippingPlanes no tiene efecto
    this.plano = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4);
    this.raiz = new THREE.ClippingGroup();
    this.raiz.clippingPlanes = [this.plano];
    this.escena.add(this.raiz);
    const C = this.C;
    // materiales compartidos (D1, D2, D6): cambiar de estado es cambiar el material, nunca la geometría
    const relleno = (side) => new THREE.MeshBasicNodeMaterial({ color: C.papel, side, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const linea = (color, opacity) => new THREE.LineBasicNodeMaterial({ color, transparent: true, opacity, depthWrite: false });
    this.M = {
      relleno: relleno(THREE.DoubleSide), rellenoMacizo: relleno(THREE.FrontSide),
      poche: new THREE.MeshBasicNodeMaterial({ color: C.poche, side: THREE.BackSide }),
      linea: linea(C.tinta, 0.9), fantasma: linea(C.tenue, 0.5),
      rayado: linea(C.tinta, 0.35), rayadoFantasma: linea(C.tenue, 0.15),
      elegida: new THREE.Line2NodeMaterial({ color: C.teja, linewidth: 2.5, worldUnits: false, depthWrite: false }),
      etapa: new THREE.Line2NodeMaterial({ color: C.tinta, linewidth: 2, worldUnits: false, depthWrite: false }),
      marco: new THREE.LineDashedNodeMaterial({ color: C.tinta, dashSize: 0.6, gapSize: 0.35, transparent: true, opacity: 0.8, depthWrite: false }),
    };
    this.familias = new Map();           // familia -> { id, nombre, sistema, rellenos, lineas, rayados, poches, ocultas }
    this.hechos = new Set();             // grupos ya puestos
    this.cola = [];                      // tramos pendientes { prio, paso(fin) -> true al terminar }
    this.caja = new THREE.Box3();        // caja del dibujo (de las cajas del cargador, sin recalcular nada del 106)
    this.datos = undefined;              // familias.json: undefined = pidiéndolo, null = no está (provisional)
    this.corte = null;                   // { eje: 'y'|'x'|'z', valor }
    this.contexto = 'fantasma';
    this.foco = null;
    this.etapaF = null;                  // recorrido «Construir el 106»: { nuevas: Set, previas: Set } de familias, o null
    this.activo = true;                  // fase 3: el conmutador la pausa (vuelve la luz del 106) y la reanuda sin rehacer las aristas
    this.alElegir = null;                // main.js: se llama con la familia elegida al tocar (o null al soltar)
    this.medidas = { inicio: performance.now(), primerDibujo: null, aristasListas: null, segmentos: 0, segRayado: 0, bytesLineas: 0, tramos: 0, tramoMax: 0, msTramos: 0, piezas: 0, conClave: 0, familiasJSON: null };
    this.#rotulo();
    this.#leerURL();
    this.#toque();
    this.#trabajar();
  }

  // ---------------------------------------------------------------- armado en tramos
  #encolar(prio, paso, que = '') {
    let k = this.cola.length; while (k > 0 && this.cola[k - 1].prio > prio) k--;
    this.cola.splice(k, 0, { prio, paso, que });
  }

  #pedirFamilias() {
    if (this.datos !== undefined || this._pidiendo || this.e._base === undefined) return;
    this._pidiendo = true;
    fetch(conVersion(this.e._base + 'datos/familias.json'))   // con la huella ?v=, como los demás datos del 106
     .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j) => { this.datos = j?.piezas && j?.familias ? j : null; this.medidas.familiasJSON = !!this.datos; this.medidas.tDatos = Math.round(performance.now()); });
  }

  /** Pone en la cola los grupos del 106 que ya llegaron. Solo recorre la escena: nada de cajas ni matrices nuevas. */
  #poner() {
    if (this.datos === undefined) return;     // primero se sabe si hay familias.json
    for (const g of GRUPOS_DI) {
      const info = this.e.grupos?.[g];
      if (!info || this.hechos.has(g)) continue;
      this.hechos.add(g);
      info.root.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes?.position) return;
        // partir una malla va justo antes de las aristas de su sistema (por el material), así el primer dibujo llega pronto
        const paso = familiasDe(g, o, this.datos), pv = provisional(g, o.material?.name || '');
        this.#encolar(pv?.rayado ? 3.5 : ORDEN.indexOf(pv?.sistema ?? 'base') + 0.5, (fin) => {
          const r = paso(fin); if (r === null) return false;
          for (const p of r) this.#pieza(g, o, p);
          return true;
        }, 'familias ' + g + ' ' + o.material?.name);
      });
    }
  }

  #fam(d) {
    let r = this.familias.get(d.familia);
    if (!r) this.familias.set(d.familia, r = { id: d.familia, nombre: d.nombre, sistema: d.sistema, provisional: !!d.provisional, rellenos: [], lineas: [], rayados: [], poches: [], ocultas: [] });
    return r;
  }

  #pieza(grupo, o, { desc: d, indices, piezas = 0, conClave = 0 }) {
    const r = this.#fam(d);
    this.medidas.tPrimeraPieza ??= Math.round(performance.now());
    this.medidas.piezas += piezas; this.medidas.conClave += conClave;
    let geo = o.geometry;
    if (indices) {             // la familia: un índice propio sobre los atributos del GLB (no copia la geometría)
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', o.geometry.attributes.position);
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
      if (o.geometry.boundingBox) geo.boundingBox = o.geometry.boundingBox.clone();          // cajas del cargador: contienen al subconjunto
      if (o.geometry.boundingSphere) geo.boundingSphere = o.geometry.boundingSphere.clone();
    }
    if (geo.boundingBox) this.caja.union(geo.boundingBox.clone().applyMatrix4(o.matrixWorld));   // caja de lo dibujado (para el marco del corte)
    const fijo = (obj) => { obj.matrixAutoUpdate = false; obj.matrix.copy(o.matrixWorld); obj.userData.familia = d.familia; return obj; };
    const m = fijo(new THREE.Mesh(geo, d.poche ? this.M.rellenoMacizo : this.M.relleno));
    m.visible = !(this.foco && this.foco !== r.id && this.contexto === 'fantasma');
    r.rellenos.push(m); this.raiz.add(m);
    if (this.etapaF) this._repintar = true;
    if (d.poche) {
      const p = fijo(new THREE.Mesh(geo, this.M.poche));
      p.visible = !!this.corte; p.raycast = () => {};
      r.poches.push(p); this.raiz.add(p);
    }
    const prio = ORDEN.indexOf(d.sistema) + 1;
    if (d.rayado) { this.#encolar(3.6, this.#rayado(o, geo, r), 'rayado ' + r.id); return; }
    const paso = aristasDe(geo, indices);
    this.#encolar(d.sinAristas ? 8 : prio, (fin) => {
      const arr = paso(fin); if (arr === null) return false;
      if (!arr.length) return true;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const l = fijo(new THREE.LineSegments(g, this.foco && this.foco !== r.id ? this.M.fantasma : this.M.linea));
      l.raycast = () => {}; l.renderOrder = 1;
      if (d.sinAristas) { r.ocultas.push(l); return true; }      // solo para marcar la pieza elegida (el vidrio no lleva arista)
      r.lineas.push(l); this.raiz.add(l);
      this.medidas.segmentos += arr.length / 6; this.medidas.bytesLineas += arr.byteLength;
      if (this.foco === r.id || this.etapaF) this._repintar = true;   // la gruesa se rehace una vez por cuadro, no por tramo
      return true;
    }, 'aristas ' + r.id);
  }

  /** Rayado de tejas (D3): cada triángulo de teja se corta con planos verticales cada PASO_TEJA en el eje horizontal de su
   *  faldón, así las líneas bajan por la pendiente. El faldón sale de la posición dentro de la caja de la malla (techo a
   *  cuatro aguas: el lado más cercano manda), porque la curva de canal y cobija tuerce la normal de cada teja. La caja es la
   *  del cargador (o se mide aquí, en tramos, sin escribirla en la geometría). */
  #rayado(o, geo, r) {
    const pos = geo.attributes.position, idx = geo.index;
    const nt = idx ? idx.count / 3 : pos.count / 3, M = o.matrixWorld;
    let caja = o.geometry.boundingBox ? o.geometry.boundingBox.clone().applyMatrix4(M) : null, cx, cz, hx, hz;
    const P = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], n = new THREE.Vector3(), u = new THREE.Vector3();
    const pts = [];
    let i = 0, iv = 0;
    return (fin) => {
      if (!caja) { caja = new THREE.Box3(); }
      if (caja.isEmpty() || iv < pos.count && !o.geometry.boundingBox) {
        for (; iv < pos.count; iv++) { if ((iv & 255) === 0 && performance.now() > fin) return false; caja.expandByPoint(u.fromBufferAttribute(pos, iv).applyMatrix4(M)); }
      }
      cx = (caja.min.x + caja.max.x) / 2; cz = (caja.min.z + caja.max.z) / 2; hx = (caja.max.x - caja.min.x) / 2; hz = (caja.max.z - caja.min.z) / 2;
      for (; i < nt; i++) {
        if ((i & 127) === 0 && performance.now() > fin) return false;
        for (let e = 0; e < 3; e++) P[e].fromBufferAttribute(pos, idx ? idx.getX(i * 3 + e) : i * 3 + e).applyMatrix4(M);
        n.subVectors(P[1], P[0]).cross(u.subVectors(P[2], P[0]));
        const l = n.length(); if (l < 1e-12) continue;
        if (n.y / l < 0.25) continue;                         // caras de abajo y cantos fuera
        const gx = (P[0].x + P[1].x + P[2].x) / 3 - cx, gz = (P[0].z + P[1].z + P[2].z) / 3 - cz;
        const ej = hx - Math.abs(gx) < hz - Math.abs(gz) ? 'z' : 'x';   // faldón de la punta (mira a ±x): líneas a z constante
        const d0 = P[0][ej], d1 = P[1][ej], d2 = P[2][ej], d = [d0, d1, d2];
        const lo = Math.ceil(Math.min(d0, d1, d2) / PASO_TEJA), hi = Math.floor(Math.max(d0, d1, d2) / PASO_TEJA);
        for (let k = lo; k <= hi; k++) {
          const v = k * PASO_TEJA; let m = 0;
          for (let e = 0; e < 3; e++) {
            const p = P[e], q = P[(e + 1) % 3], dp = d[e], dq = d[(e + 1) % 3];
            if ((dp - v) * (dq - v) < 0) { const t = (v - dp) / (dq - dp); pts.push(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t + 0.01, p.z + (q.z - p.z) * t); m++; }
          }
          if (m === 1 || m === 3) pts.length -= 3;
        }
      }
      if (pts.length) {
        const arr = new Float32Array(pts);
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        const ls = new THREE.LineSegments(g, this.foco && this.foco !== r.id ? this.M.rayadoFantasma : this.M.rayado);
        ls.userData.familia = r.id; ls.raycast = () => {}; ls.renderOrder = 1;
        r.rayados.push(ls); this.raiz.add(ls);
        if (this.etapaF) this._repintar = true;
        this.medidas.segRayado += arr.length / 6; this.medidas.bytesLineas += arr.byteLength;
      }
      return true;
    };
  }

  /** Bucle de tramos: en cada rato libre, hasta PRESUPUESTO ms (el tramo se mide entero); pide un cuadro cuando algo entra. */
  #trabajar() {
    const tramo = (plazo) => {
      const t0 = performance.now(), fin = t0 + Math.min(PRESUPUESTO, Math.max(4, plazo?.timeRemaining?.() ?? PRESUPUESTO));
      this.#pedirFamilias();
      this.#poner();
      let algo = false;
      while (this.cola.length && performance.now() < fin) {
        const j = this.cola[0];   // un paso puede encolar trabajos delante de sí: se quita por referencia
        const tp = performance.now(), hecho = j.paso(fin), dp = performance.now() - tp;
        if (dp > (this.medidas.pasoMax?.ms ?? 0)) this.medidas.pasoMax = { ms: +dp.toFixed(1), que: j.que };
        if (hecho) { this.cola.splice(this.cola.indexOf(j), 1); algo = true; } else break;
      }
      const dt = performance.now() - t0;
      if (dt > 0.5) { this.medidas.tramos++; this.medidas.msTramos += dt; this.medidas.tramoMax = Math.max(this.medidas.tramoMax, dt); }
      if (algo) this.e.sucio = true;
      const todos = GRUPOS_DI.every((g) => this.hechos.has(g) || this.e.listos?.has(g));
      if (!this.cola.length && todos && this.e.cargado && this.datos !== undefined) {
        if (!this.medidas.aristasListas) { this.medidas.aristasListas = performance.now(); this.e.sucio = true; this.#marco(); }
        return;
      }
      libre(tramo);
    };
    libre(tramo);
  }

  // ---------------------------------------------------------------- foco con fantasma (D6)
  /** Elige una familia (o null para soltar). La pieza queda sólida con su arista gruesa en --teja; el resto, fantasma o sólido. */
  enfocar(id) {
    this.foco = id && this.familias.has(id) ? id : null;
    if (this.foco) this.etapaF = null;
    this.#pintarFoco();
    return this.foco;
  }
  /** «Contexto: Fantasma · Sólido» (el interruptor de la fase 3). */
  fijarContexto(k) { this.contexto = k === 'solido' ? 'solido' : 'fantasma'; this.#pintarFoco(); }
  /** Recorrido «Construir el 106» (fase 3): lo que agrega la etapa (`nuevas`) en tinta gruesa, lo anterior (`previas`) en gris
   *  fino y lo demás sin dibujar. Sin argumentos, el edificio entero otra vez. */
  mostrarEtapa(nuevas, previas = []) {
    this.etapaF = nuevas ? { nuevas: new Set(nuevas), previas: new Set(previas) } : null;
    if (this.etapaF) this.foco = null;
    this.#pintarFoco();
  }

  #pintarFoco() {
    this._repintar = false;
    const foco = this.foco, fantasma = foco && this.contexto === 'fantasma', E = this.etapaF;
    for (const r of this.familias.values()) {
      if (E) {                 // por etapa: nueva, previa o todavía no
        const rol = E.nuevas.has(r.id) ? 'n' : E.previas.has(r.id) ? 'p' : null;
        for (const m of r.rellenos) m.visible = !!rol;
        for (const p of r.poches) p.visible = !!rol && !!this.corte;
        for (const l of r.lineas) { l.material = rol === 'p' ? this.M.fantasma : this.M.linea; l.visible = !!rol; }
        for (const l of r.rayados) { l.material = rol === 'p' ? this.M.rayadoFantasma : this.M.rayado; l.visible = !!rol; }
        continue;
      }
      const es = r.id === foco, otro = foco && !es;
      for (const m of r.rellenos) m.visible = !(fantasma && otro);       // relleno del fantasma a opacidad 0 = no se dibuja
      for (const p of r.poches) p.visible = !!this.corte;
      for (const l of r.lineas) { l.material = otro ? this.M.fantasma : this.M.linea; l.visible = !es; }
      for (const l of r.rayados) { l.material = otro ? this.M.rayadoFantasma : this.M.rayado; l.visible = true; }
    }
    if (this.gruesa) { this.raiz.remove(this.gruesa); this.gruesa.geometry.dispose(); this.gruesa = null; }
    let fuentes = [], mat = this.M.elegida;
    if (E) {                   // la tinta gruesa de la etapa; con más de MAX_GRUESA segmentos queda la línea fina en tinta (teléfono)
      mat = this.M.etapa;
      for (const id of E.nuevas) { const r = this.familias.get(id); if (r) fuentes.push(...r.lineas, ...(r.lineas.length ? [] : r.rayados)); }
      if (fuentes.reduce((s, l) => s + l.geometry.attributes.position.count / 2, 0) > MAX_GRUESA) fuentes = [];
    } else {
      const r = foco && this.familias.get(foco);
      fuentes = r ? [...r.lineas, ...r.ocultas, ...(r.lineas.length ? [] : r.rayados)] : [];
    }
    if (fuentes.length) {
      const pts = [], v = new THREE.Vector3();
      for (const l of fuentes) {
        const p = l.geometry.attributes.position;
        for (let k = 0; k < p.count; k++) { v.fromBufferAttribute(p, k).applyMatrix4(l.matrix); pts.push(v.x, v.y, v.z); }
      }
      const g = new LineSegmentsGeometry(); g.setPositions(pts);
      this.gruesa = new LineSegments2(g, mat); this.gruesa.renderOrder = 2; this.gruesa.raycast = () => {};
      this.raiz.add(this.gruesa);
    }
    this.e.sucio = true;
  }

  // ---------------------------------------------------------------- corte con poché (fase 2)
  /** Corta por un plano: eje 'y' (planta, se queda lo de abajo), 'z' (longitudinal) o 'x' (transversal), en `valor` metros.
   *  Sin eje, sin corte. Mover el corte es cambiar `plane.constant` (no recompila). */
  cortar(eje, valor) {
    if (!eje) { this.corte = null; this.plano.normal.set(0, -1, 0); this.plano.constant = 1e4; }
    else {
      if (valor === undefined || Number.isNaN(valor)) valor = { y: PLANTA_DEF, z: 0, x: 0 }[eje];
      this.corte = { eje, valor };
      this.plano.normal.set(eje === 'x' ? -1 : 0, eje === 'y' ? -1 : 0, eje === 'z' ? -1 : 0);   // se queda lo que está a menos de `valor`
      this.plano.constant = valor;
    }
    this.#pintarFoco();       // poches según el corte (y la etapa, si hay recorrido)
    this.#marco();
    this.e.sucio = true;
  }

  /** Rango del deslizador del corte, en metros del modelo (A3 de la fase 4): la caja del alero (planta-106.js, sacada de
   *  estado.json) redondeada hacia afuera al decímetro en los cortes verticales, y en planta de 0 a la cara de arriba de la
   *  cumbrera (las claves de la familia `cumbrera` en datos/familias.json, también al decímetro hacia arriba). Sin
   *  familias.json, la caja de lo dibujado. */
  rangoCorte(eje) {
    if (eje === 'x' || eje === 'z') { const i = eje === 'x' ? 0 : 1; return [afuera(PLANTA.alero[0][i]), afuera(PLANTA.alero[1][i])]; }
    if (eje !== 'y') return null;
    if (this._techo == null && this.datos) {
      let t = -Infinity;
      for (const [k, f] of Object.entries(this.datos.piezas)) if (f === 'cumbrera') t = Math.max(t, +k.split('|')[3].split(',')[1] / 100);
      if (Number.isFinite(t)) this._techo = afuera(t);
    }
    return [0, this._techo ?? (this.caja.isEmpty() ? 16 : afuera(this.caja.max.y))];
  }

  /** Mueve el plano del corte ya elegido sin rehacer nada (el camino rápido del deslizador, A7): `plane.constant`, el marco
   *  trasladado (su geometría es la misma) y el texto del rótulo. La tinta gruesa está dentro del ClippingGroup: se recorta sola. */
  moverCorte(valor) {
    if (!this.corte || !Number.isFinite(valor)) return;
    const [lo, hi] = this.rangoCorte(this.corte.eje);
    valor = Math.min(hi, Math.max(lo, valor));
    if (valor === this.corte.valor) return;
    this.corte.valor = valor; this.plano.constant = valor;
    if (this.marcoCorte) {
      const k = this.corte.eje, d = valor - this._marcoV0;
      this.marcoCorte.position.set(k === 'x' ? d : 0, k === 'y' ? d : 0, k === 'z' ? d : 0);
      for (const e of this.esquinas) e[k] = valor;
      this.#textoRotulo();
    }
    this.e.sucio = true;
  }

  /** El plano del corte, en trazo discontinuo de tinta (D12), con su rótulo. */
  #marco() {
    if (this.marcoCorte) { this.escena.remove(this.marcoCorte); this.marcoCorte.geometry.dispose(); this.marcoCorte = null; }
    this.rotuloEl.hidden = true;
    if (!this.corte || this.caja.isEmpty()) return;
    const { eje, valor } = this.corte, b = this.caja, m = 1;
    this._marcoV0 = valor;
    const x0 = b.min.x - m, x1 = b.max.x + m, y0 = b.min.y, y1 = b.max.y + m, z0 = b.min.z - m, z1 = b.max.z + m;
    const q = eje === 'y' ? [[x0, valor, z0], [x1, valor, z0], [x1, valor, z1], [x0, valor, z1]]
      : eje === 'x' ? [[valor, y0, z0], [valor, y0, z1], [valor, y1, z1], [valor, y1, z0]]
        : [[x0, y0, valor], [x1, y0, valor], [x1, y1, valor], [x0, y1, valor]];
    const pts = []; for (let k = 0; k < 4; k++) pts.push(new THREE.Vector3(...q[k]), new THREE.Vector3(...q[(k + 1) % 4]));
    this.marcoCorte = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), this.M.marco);
    this.marcoCorte.computeLineDistances(); this.marcoCorte.renderOrder = 3;
    this.escena.add(this.marcoCorte);
    this.esquinas = q.map((c) => new THREE.Vector3(...c));   // el rótulo va bajo el marco, donde no tapa el corte
    this.#textoRotulo();
    this.rotuloEl.hidden = !!this.detalle;
  }
  #textoRotulo() {
    const t = this.textoCorte();
    this.rotuloEl.replaceChildren(...t.map((s, k) => { const e = document.createElement(k ? 'span' : 'b'); e.textContent = s; e.style.display = 'block'; if (k) e.style.fontWeight = '500'; return e; }));
  }

  /** Dónde está el plano, en palabras: un solo generador para el rótulo del plano, el valor del deslizador y su aria-valuetext
   *  (A4). corto: «3,2 m hacia la SE», «en el centro», «a 2,6 m de altura». */
  posCorte(corto = true, corte = this.corte) {
    if (!corte) return '';
    const { eje, valor } = corte;
    if (eje === 'y') return corto ? `a ${num(valor)} m de altura` : `a ${num(valor)} m`;
    if (Math.abs(valor) < 0.05) return corto ? 'en el centro' : 'por el centro';
    const lado = LADO[eje][valor > 0 ? 0 : 1];
    return `a ${num(Math.abs(valor))} m hacia la ${lado}${corto ? '' : ' del centro'}`;
  }

  /** Texto del rótulo del corte (D10, D11). Cifras del modelo. */
  textoCorte() {
    if (!this.corte) return [];
    const { eje, valor } = this.corte;
    if (eje === 'y') {
      const t = [`Corte en planta a ${num(valor)} m (modelo)`];
      // dos pisos en planta baja (D15): se dan los dos niveles y no una sola altura sobre «el piso»
      if (valor > GALERIA && valor < 3.4) t.push(`piso interior a ${num(PISO_PB, 2)} m y galería a ${num(GALERIA, 2)} m (modelo)`);
      return t;
    }
    return [`Corte ${eje === 'x' ? 'transversal' : 'longitudinal'} ${this.posCorte(false)} (modelo)`,
      'Entre el piso y el cielorraso el modelo no trae la losa'];
  }

  #rotulo() {
    const el = document.createElement('div');
    el.hidden = true; el.setAttribute('role', 'note');
    Object.assign(el.style, { position: 'absolute', left: '0', top: '0', zIndex: '1', pointerEvents: 'none', maxWidth: window.innerWidth < 760 ? '13rem' : '15rem',
      font: (window.innerWidth < 760 ? '500 11px' : '600 12px') + '/1.3 var(--datos)', color: 'var(--noche)', background: 'var(--cal)', border: '1px solid var(--cal-3)',
      borderRadius: '8px', padding: window.innerWidth < 760 ? '4px 6px' : '5px 8px' });
    this.e.parent.appendChild(el);
    this.rotuloEl = el;
  }

  #ponerRotulo() {
    if (this.rotuloEl.hidden || !this.esquinas) return;
    const c = this.e.renderer.domElement, w = c.clientWidth, h = c.clientHeight;
    let sx = Infinity, sy = -Infinity;
    for (const e of this.esquinas) { const v = e.clone().project(this.cam); sx = Math.min(sx, (v.x + 1) / 2 * w); sy = Math.max(sy, (1 - v.y) / 2 * h); }
    const bw = this.rotuloEl.offsetWidth, bh = this.rotuloEl.offsetHeight, m = 16;
    // fuera del panel lateral o de la hoja del 106 (solo se leen sus medidas)
    const dock = document.getElementById('dock')?.getBoundingClientRect(), lateral = document.documentElement.classList.contains('panel-lateral');
    const x0 = lateral && dock ? dock.right + m : m, y1 = !lateral && dock && dock.top > h / 3 ? dock.top - m : h - m;
    // en el teléfono (hoja abajo) va pegado a la hoja, a la izquierda: ahí suele haber suelo o papel, no el edificio (D16)
    const telefono = !lateral && w < 760;
    const x = telefono ? m : Math.min(w - bw - m, Math.max(x0, sx)), y = telefono ? y1 - bh : Math.min(y1 - bh, Math.max(m + 56, sy + 12));
    this.rotuloEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  // ---------------------------------------------------------------- tocar una pieza
  #toque() {
    const ray = new THREE.Raycaster(), pt = new THREE.Vector2();
    let abajo = null;
    const lienzo = this.e.parent;
    this._abajo = (e) => { abajo = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    this._arriba = (e) => {
      const a = abajo; abajo = null;
      if (this.apagado || this.detalle || !a || performance.now() - a.t > 400 || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 6) return;
      const rc = this.e.renderer.domElement.getBoundingClientRect();
      pt.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
      this.#camara();
      ray.setFromCamera(pt, this.cam);
      const visibles = [];
      for (const r of this.familias.values()) for (const m of r.rellenos) if (m.visible) visibles.push(m);
      const hit = ray.intersectObjects(visibles, false).find((h) => !this.corte || this.plano.distanceToPoint(h.point) >= 0);
      if (this.etapaF) return;   // en el recorrido se mira la etapa: tocar no elige
      this.enfocar(hit ? hit.object.userData.familia : null);
      this.alElegir?.(this.foco);
    };
    lienzo.addEventListener('pointerdown', this._abajo);
    lienzo.addEventListener('pointerup', this._arriba);
  }

  // ---------------------------------------------------------------- cámara ortográfica (D4): la dirección del 106, la distancia a zoom
  #camara() {
    const p = this.e.camera, o = this.cam;
    const dir = new THREE.Vector3(); p.getWorldDirection(dir);
    // distancia al punto de mira: la que main.js le da a escena.setAlejamiento en cada cuadro (OrbitControls mira a ese punto)
    const d = Math.max(1, this.e.distMira ?? dir.dot(new THREE.Vector3(0, 5, 0).sub(p.position)));
    const h = d * Math.tan(THREE.MathUtils.degToRad(p.fov / 2)) / (p.zoom || 1), w = h * p.aspect;
    o.left = -w; o.right = w; o.top = h; o.bottom = -h;
    o.position.copy(p.position); o.quaternion.copy(p.quaternion);
    if (p.view?.enabled) o.setViewOffset(p.view.fullWidth, p.view.fullHeight, p.view.offsetX, p.view.offsetY, p.view.width, p.view.height);
    else if (o.view) o.clearViewOffset();
    o.updateProjectionMatrix(); o.updateMatrixWorld();
  }

  /** Dibuja la escena en línea (lo llama escena.render() en vez del postproceso). */
  render() {
    const r = this.e.renderer;
    if (r.toneMapping !== THREE.NoToneMapping) { this._tono = r.toneMapping; r.toneMapping = THREE.NoToneMapping; }   // papel y tinta tal cual (solo en esta lectura)
    if (this.detalle) { this.#renderDetalle(r); return; }
    if (this._repintar) this.#pintarFoco();
    this.#camara();
    if (this.gruesa) { this.M.elegida.linewidth = 2.5 * r.getPixelRatio(); this.M.etapa.linewidth = 2 * r.getPixelRatio(); }
    const t0 = performance.now(); r.render(this.escena, this.cam);
    const dr = performance.now() - t0, m = this.medidas; m.cuadros = (m.cuadros ?? 0) + 1;
    if (m.cuadros <= 2) m.renderPrimeros = Math.max(m.renderPrimeros ?? 0, dr); else m.renderMax = Math.max(m.renderMax ?? 0, dr);   // los primeros compilan
    this.#ponerRotulo();
    if (this.medidas.primerDibujo === null && this.medidas.segmentos > 0) this.medidas.primerDibujo = performance.now();
  }

  // ---------------------------------------------------------------- detalle de un mecanismo (fase 4a, B2 a B4)
  /** «Ver de cerca»: el módulo `d` (lo que devuelve crear(ctx) de src/mecanismos/) en una escena propia sobre el mismo papel,
   *  con su cámara en perspectiva de 30° y sus OrbitControls, como en mecanismos-prueba.html. La cámara del 106 no se toca:
   *  main.js apaga sus controles y su teclado mientras tanto, y al volver todo está donde estaba. `anf` = el anfitrión
   *  (mecanismos/anfitrion.js), que suelta materiales y geometrías al cerrar. `paso(dt)` se llama en cada cuadro de un módulo
   *  animado (la condensadora). */
  verDetalle(d, anf, { paso = null, escala = '' } = {}) {
    this.verEdificio();
    const r = this.e.renderer, esc = new THREE.Scene();
    esc.background = this.C.papel.clone();
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 800);
    const ctl = new OrbitControls(cam, r.domElement);
    ctl.enableDamping = true; ctl.dampingFactor = 0.1; ctl.enablePan = false;
    const cont = document.createElement('div');
    cont.className = 'rot-capa';
    Object.assign(cont.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden', zIndex: '1' });
    this.e.parent.appendChild(cont);
    const pastilla = document.createElement('div');   // «DETALLE · escala», con el estilo del rótulo del corte
    pastilla.className = 'di-escala'; pastilla.textContent = escala; pastilla.hidden = !escala; pastilla.setAttribute('role', 'note');
    cont.appendChild(pastilla);
    esc.add(d.objeto);
    this.detalle = { d, anf, esc, cam, ctl, cont, pastilla, paso, cuadro: 0, t: performance.now() };
    ctl.addEventListener('change', () => { this.e.sucio = true; });
    this.rotuloEl.hidden = true;
    this.encuadrarDetalle();
    this.e.sucio = true;
  }

  /** Vuelve al edificio: suelta todo lo del detalle (controles, rótulos, geometrías y materiales). */
  verEdificio() {
    const D = this.detalle; if (!D) return;
    this.detalle = null;
    D.ctl.dispose();
    D.cont.remove();
    D.esc.remove(D.d.objeto);
    D.anf?.liberar?.();
    this.rotuloEl.hidden = !this.corte || !this.activo || this.caja.isEmpty();
    this.e.sucio = true;
  }

  /** Lo que queda libre del lienzo (fuera del panel lateral, de la hoja y del HUD del teléfono), en px del lienzo. */
  #libre(w, h) {
    const html = document.documentElement, lateral = html.classList.contains('panel-lateral');
    const dock = document.getElementById('dock')?.getBoundingClientRect(), hud = document.getElementById('hud')?.getBoundingClientRect();
    const L = { x0: 0, y0: 0, x1: w, y1: h };
    if (lateral && dock) L.x0 = dock.right;
    else {
      if (dock && dock.top > h / 3) L.y1 = dock.top;
      if (hud && hud.height > 0) {
        if (w < 760) {   // teléfono: bajo el conmutador y bajo el mapa de ubicación, que va a la derecha y si no taparía los rótulos de arriba
          const mapa = document.getElementById('di-mapa'), m = mapa && !mapa.hidden ? mapa.getBoundingClientRect() : null;
          L.y0 = Math.min(Math.max(document.getElementById('lecturas')?.getBoundingClientRect().bottom ?? hud.bottom, m?.height ? m.bottom + 4 : 0), L.y1 - 160);
        }
        else if (hud.left > w / 2) L.x1 = Math.max(hud.left, L.x0 + 240);         // diseño intermedio: la tarjeta va a la derecha
      }
    }
    return L;
  }

  /** Encuadra el detalle en lo que queda libre: la caja del módulo (o la de su objeto) entra entera, mirando desde su `camara`. */
  encuadrarDetalle() {
    const D = this.detalle; if (!D) return;
    const c = this.e.renderer.domElement, w = c.clientWidth || 1, h = c.clientHeight || 1, L = this.#libre(w, h);
    D.w = w; D.h = h;
    const d = D.d, cam = D.cam;
    const caja = d.caja ? new THREE.Box3(new THREE.Vector3(...d.caja[0]), new THREE.Vector3(...d.caja[1])) : new THREE.Box3().setFromObject(d.objeto);
    const centro = caja.getCenter(new THREE.Vector3()), radio = caja.getSize(new THREE.Vector3()).length() / 2;
    const dir = new THREE.Vector3(...d.camara.pos).sub(new THREE.Vector3(...d.camara.obj)).normalize();
    cam.aspect = w / h;
    // el centro de lo libre es el centro de la vista: ventana corrida, como el setViewOffset del 106 con el panel o la hoja
    cam.setViewOffset(w, h, (w - (L.x0 + L.x1)) / 2, (h - (L.y0 + L.y1)) / 2, w, h);
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const a = Math.atan(Math.min(t * (L.y1 - L.y0) / h, t * cam.aspect * (L.x1 - L.x0) / w));
    const dist = radio / Math.sin(a) * (w < 760 ? 1.12 : 1.02);
    cam.position.copy(centro).addScaledVector(dir, dist);
    D.ctl.target.copy(centro);
    cam.near = dist / 100; cam.far = dist * 20; cam.updateProjectionMatrix();
    D.ctl.update();
    D.libre = L;
    this.e.sucio = true;
  }

  #renderDetalle(r) {
    const D = this.detalle, c = r.domElement, w = c.clientWidth, h = c.clientHeight;
    if (D.w !== w || D.h !== h) this.encuadrarDetalle();
    const ahora = performance.now(), dt = Math.min(0.1, (ahora - D.t) / 1000); D.t = ahora;
    if (D.paso) D.paso(dt);
    const mueve = D.ctl.update();
    const t0 = performance.now(); r.render(D.esc, D.cam);
    const m = this.medidas; m.detalleMax = Math.max(m.detalleMax ?? 0, performance.now() - t0);
    // rótulos: cada `div` sobre su punto; los de un grupo oculto (otra variante) no se ven
    const v = new THREE.Vector3(), n = ++D.cuadro;
    D.esc.updateMatrixWorld();
    D.esc.traverseVisible((o) => {
      const el = o.element; if (!el) return;
      if (el.parentNode !== D.cont) D.cont.appendChild(el);
      v.setFromMatrixPosition(o.matrixWorld).project(D.cam);
      el._cuadro = n;
      el.style.display = v.z > 1 || v.z < -1 ? 'none' : '';
      el.style.transform = `translate(-50%, -50%) translate(${Math.round((v.x + 1) / 2 * w)}px, ${Math.round((1 - v.y) / 2 * h)}px)`;
    });
    for (const el of D.cont.children) if (el._cuadro !== n && el !== D.pastilla) el.style.display = 'none';
    const L = D.libre, ph = D.pastilla.offsetHeight;
    D.pastilla.style.transform = `translate(${Math.round(L.x0 + 16)}px, ${Math.round(L.y1 - 16 - ph)}px)`;
    if (mueve || D.paso) requestAnimationFrame(() => { this.e.sucio = true; });   // escena.render() deja sucio en false al volver
  }

  /** Fase 3, el conmutador: vuelve a la luz del 106 sin deshacer lo armado (las aristas siguen en memoria y se siguen
   *  armando en tramos). El toque queda apagado y el rótulo del corte, oculto. */
  pausar() {
    this.verEdificio();
    const r = this.e.renderer;
    if (this._tono !== undefined) { r.toneMapping = this._tono; this._tono = undefined; }
    this.activo = false; this.apagado = true; this.rotuloEl.hidden = true;
    this.e.sucio = true;
  }
  /** Vuelve a dibujar en línea (con el corte y la pieza que tenía). */
  reanudar() {
    this.activo = true; this.apagado = false;
    this.#marco();
    this.e.sucio = true;
  }

  /** Quita el dibujo para siempre: devuelve la salida de la luz del 106 (AgX) y quita el rótulo y el toque. Quien la llama
   *  borra después `escena.di` para que render() vuelva al postproceso. */
  salir() {
    const r = this.e.renderer;
    if (this._tono !== undefined) { r.toneMapping = this._tono; this._tono = undefined; }
    this.apagado = true;
    this.rotuloEl.remove();
    this.e.parent.removeEventListener('pointerdown', this._abajo);
    this.e.parent.removeEventListener('pointerup', this._arriba);
    this.e.sucio = true;
  }

  /** Para pruebas: ?pieza=<familia>&contexto=solido&corte=planta|longitudinal|transversal[:metros] */
  #leerURL() {
    const q = new URLSearchParams(location.search);
    if (q.get('contexto')) this.contexto = q.get('contexto') === 'solido' ? 'solido' : 'fantasma';
    const c = q.get('corte');
    if (c) {
      const [k, v] = c.split(':'), eje = { planta: 'y', longitudinal: 'z', transversal: 'x' }[k];
      if (eje) this.cortar(eje, v !== undefined ? parseFloat(v.replace(',', '.')) : undefined);
    }
    const pz = q.get('pieza');
    if (pz) {
      const t = setInterval(() => { const r = this.familias.get(pz); if (r && (r.lineas.length || r.rayados.length || r.ocultas.length)) { clearInterval(t); this.enfocar(pz); this.alElegir?.(this.foco); } }, 250);
      setTimeout(() => clearInterval(t), 60000);
    }
  }

  /** Estado legible para las pruebas (window.__e106.escena.di.estado()). */
  estado() {
    const m = this.medidas;
    return { ...m, familias: [...this.familias.values()].map((r) => ({ id: r.id, nombre: r.nombre, sistema: r.sistema, provisional: r.provisional, rellenos: r.rellenos.length, lineas: r.lineas.length, segmentos: r.lineas.reduce((s, l) => s + l.geometry.attributes.position.count / 2, 0) })),
      grupos: [...this.hechos], cola: this.cola.length, corte: this.corte, rotulo: this.textoCorte(), foco: this.foco, contexto: this.contexto, activo: this.activo,
      etapa: this.etapaF ? { nuevas: [...this.etapaF.nuevas], previas: this.etapaF.previas.size } : null, info: this.e.renderer.info?.memory,
      rango: this.corte ? this.rangoCorte(this.corte.eje) : null, posCorte: this.posCorte(),
      detalle: this.detalle ? { rotulos: this.detalle.cont.children.length, cam: this.detalle.cam.position.toArray(), objetivo: this.detalle.ctl.target.toArray() } : null };
  }
}
