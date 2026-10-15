// Anfitrión de los mecanismos dentro del 106 (fase 4a): las cuatro funciones del contrato de indice.js (linea, dibujar,
// rotulo, colores) reescritas para three/webgpu, con materiales Node y rótulos `div` que proyecta dibujo.js en cada cuadro.
// Es el mismo dibujo que mecanismos-prueba.html (que usa WebGLRenderer, materiales clásicos y CSS2DRenderer): mismos colores
// por papel, misma regla de énfasis y del único ámbar, mismo umbral de aristas. Lo opcional del anfitrión (perfil, llueve y
// familias) llega por parámetro: aquí no se calcula nada del sol ni de la lluvia.
import {
  BoxGeometry, BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, DoubleSide, EdgesGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, Line,
  LineBasicNodeMaterial, LineDashedNodeMaterial, LineSegments, Mesh, MeshBasicNodeMaterial, Object3D, PlaneGeometry, Shape, SphereGeometry, TubeGeometry,
  Vector2, Vector3,
} from 'three/webgpu';

// ctx.THREE con solo lo que usan los módulos: pasar el espacio de nombres entero como valor deja sin podar three en el armado
// (+212 KB de three.core.js). Si un módulo nuevo usa otra clase, va aquí.
const THREE = Object.freeze({ BoxGeometry, BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, DoubleSide, EdgesGeometry, ExtrudeGeometry, Float32BufferAttribute,
  Group, Line, LineBasicNodeMaterial, LineDashedNodeMaterial, LineSegments, Mesh, MeshBasicNodeMaterial, Object3D, PlaneGeometry, Shape, SphereGeometry, TubeGeometry, Vector2, Vector3 });

/**
 * @param {object} o
 * @param {object} o.colores   { papel, tinta, enfasis, tenue, sol, poche } (THREE.Color)
 * @param {Function} [o.perfil]  alero: () → { grados, rotulo, motivo } | undefined
 * @param {Function} [o.llueve]  teja: () → { llueve, fuente }
 * @param {object} [o.familias]  datos/familias.json entero (la guillotina lee familias.hoja_guillotina)
 * @returns ctx del contrato, más `liberar()`, que suelta materiales y geometrías del detalle
 */
export function crearAnfitrion({ colores, perfil, llueve, familias }) {
  const mats = new Map();       // un material por combinación: los módulos nunca cambian un material ya dado
  const geos = new Set();
  const mat = (clave, hacer) => { let m = mats.get(clave); if (!m) mats.set(clave, m = hacer()); return m; };
  const colorDe = (o) => (o.sol ? colores.sol : o.enfasis ? colores.enfasis : colores.tinta);
  const nombre = (c) => c.getHexString();

  function linea(puntos, o = {}) {
    // three/webgpu no dibuja LineLoop: la línea cerrada es una Line que vuelve al primer punto (ningún módulo mueve una cerrada)
    const geo = new THREE.BufferGeometry().setFromPoints(o.cerrada && !o.segmentos && puntos.length ? [...puntos, puntos[0]] : puntos); geos.add(geo);
    const color = colorDe(o), op = o.opacidad ?? 1, g = o.guion || 0.3;
    const m = o.discontinua
      ? mat(`ld|${nombre(color)}|${op}|${g}`, () => new THREE.LineDashedNodeMaterial({ color, dashSize: g, gapSize: g * 0.6, transparent: true, opacity: op }))
      : mat(`lb|${nombre(color)}|${op}`, () => new THREE.LineBasicNodeMaterial({ color, transparent: true, opacity: op }));
    const l = new (o.segmentos ? THREE.LineSegments : THREE.Line)(geo, m);
    if (o.discontinua) l.computeLineDistances();
    return l;
  }

  function dibujar(geo, o = {}) {
    geos.add(geo);
    const op = o.discontinua ? 0 : o.vidrio ? 0.18 : 1;
    const relleno = mat(`r|${o.poche ? 'p' : 'q'}|${op}`, () => new THREE.MeshBasicNodeMaterial({ color: o.poche ? colores.poche : colores.papel, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, transparent: true, opacity: op, depthWrite: op === 1 }));
    const m = new THREE.Mesh(geo, relleno);
    if (o.papel) return m;
    const color = o.enfasis ? colores.enfasis : colores.tinta;
    const aristas = new THREE.EdgesGeometry(geo, o.umbral || 20); geos.add(aristas);
    const lm = o.discontinua
      ? mat(`ad|${nombre(color)}`, () => new THREE.LineDashedNodeMaterial({ color, dashSize: 0.012, gapSize: 0.008 }))
      : mat(`ab|${nombre(color)}`, () => new THREE.LineBasicNodeMaterial({ color }));
    const ls = new THREE.LineSegments(aristas, lm);
    if (o.discontinua) ls.computeLineDistances();
    m.add(ls);
    return m;
  }

  /** Rótulo: un Object3D con su `div` en `element` (como CSS2DObject, así `secundario()` de comun.js sirve igual). dibujo.js
   *  lo pone en el DOM y lo proyecta; al sacarlo de la escena (vaciar() de comun.js avisa con «removed») se quita. */
  function rotulo(texto, pos, enfasis = false) {
    const el = document.createElement('span');
    el.className = 'rot-3d' + (enfasis ? ' enfasis' : '');
    el.textContent = texto;
    const ob = new THREE.Object3D();
    ob.position.set(...pos);
    ob.element = el; ob.userData.rotulo = true;
    ob.addEventListener('removed', () => el.remove());
    return ob;
  }

  return {
    THREE, linea, dibujar, rotulo, colores, perfil, llueve, familias,
    liberar() { for (const g of geos) g.dispose(); for (const m of mats.values()) m.dispose(); geos.clear(); mats.clear(); },
  };
}
