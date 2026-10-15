// 2 · Alféizar y goterón. Una gota baja por el vidrio, cruza el alféizar y se corta bajo su borde.
// Medidas del modelo (INVENTARIO §4.5, §4.6, §4.12, y la caja del alféizar en estado.json): alféizar de 0,05 m de alto y
// 0,34 de fondo, de y 1,74 a 1,79 en el piso 1, que sale 0,19 m de la cara del muro; vidrio 9 a 10 cm hacia adentro; moldura
// de 5 × 6 cm a 1,66–1,71 m. La pendiente y el goterón no están en el modelo: principio del tipo, en trazo discontinuo, con dos
// variantes para comparar (con goterón y sin él).
import { num, cajaEntre, sobre } from './comun.js';
import { LUGARES } from './planta-106.js';

export const meta = { clave: 'alfeizar', n: 2, titulo: 'Alféizar y goterón' };

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const g = new THREE.Group();
  const X = [-0.35, 0.35], XS = 0.355, A0 = 1.74, A1 = 1.79, ZD = -0.15, ZF = 0.19, ZV = -0.095;
  // muro de 0,30 bajo el alféizar y a los lados (corte), marco y vidrio
  g.add(cajaEntre(k, X, [1.2, A0], [-0.3, 0], { poche: true }));
  g.add(cajaEntre(k, X, [1.78, 1.82], [ZV - 0.045, ZV + 0.045]));
  const vid = k.dibujar(new THREE.PlaneGeometry(0.7, 0.55), { vidrio: true });
  vid.position.set(0, 2.095, ZV);
  g.add(vid);
  // alféizar del modelo y moldura
  g.add(cajaEntre(k, X, [A0, A1], [ZD, ZF], { enfasis: true }));
  g.add(cajaEntre(k, X, [1.66, 1.71], [0, 0.06]));
  // pendiente hacia afuera y goterón: del tipo
  const tipo = new THREE.Group();
  tipo.add(k.linea([new V(XS, A1 + 0.012, ZV + 0.05), new V(XS, A1, ZF)], { discontinua: true, guion: 0.02, enfasis: true }));
  const got = new THREE.Group();
  got.add(k.linea([new V(XS, A0, 0.135), new V(XS, A0 + 0.012, 0.14), new V(XS, A0, 0.145)], { discontinua: true, guion: 0.006, enfasis: true }));
  got.add(k.linea([new V(X[0], A0 + 0.006, 0.14), new V(X[1], A0 + 0.006, 0.14)], { discontinua: true, guion: 0.03, enfasis: true }));
  tipo.add(got);
  g.add(tipo);
  // muro mojado (solo sin goterón)
  const mojado = new THREE.Group();
  const ray = [];
  for (let y = 1.25; y < 1.66; y += 0.04) ray.push(new V(-0.12, y, 0.002), new V(0.12, y + 0.03, 0.002));
  mojado.add(k.linea(ray, { segmentos: true, opacidad: 0.6 }));
  g.add(mojado);
  const rMoj = k.rotulo('el muro se moja y se mancha', [0.15, 1.4, 0.05]);
  mojado.add(rMoj);
  // caminos de la gota
  const comun = [new V(XS, 2.3, ZV + 0.005), new V(XS, 1.83, ZV + 0.005), new V(XS, A1 + 0.01, ZV + 0.05), new V(XS, A1 + 0.004, ZF), new V(XS, A0 - 0.004, ZF)];
  const caminos = {
    con: [...comun, new V(XS, A0 - 0.004, 0.142), new V(XS, 1.2, 0.142)],
    sin: [...comun, new V(XS, A0 - 0.004, 0.003), new V(XS, 1.71 + 0.004, 0.003), new V(XS, 1.71 - 0.004, 0.064), new V(XS, 1.66 - 0.004, 0.064), new V(XS, 1.66 - 0.004, 0.003), new V(XS, 1.2, 0.003)],
  };
  const linea = { con: k.linea(caminos.con, { discontinua: true, guion: 0.02 }), sin: k.linea(caminos.sin, { discontinua: true, guion: 0.02 }) };
  g.add(linea.con, linea.sin);
  const gota = k.dibujar(new THREE.SphereGeometry(0.012, 12, 8), { enfasis: true, umbral: 10 });
  g.add(gota);
  g.add(k.rotulo('alféizar del modelo', [0.2, A1 + 0.08, ZF], true));
  g.add(k.rotulo('goterón · del tipo', [XS, A0 - 0.08, 0.22]));
  g.add(k.rotulo('vidrio', [0.2, 2.25, ZV]));
  let variante = 'con', m = 0;
  const o = {
    objeto: g,
    camara: { pos: [2.6, 1.9, 0.9], obj: [0, 1.72, 0] },
    caja: [[-0.4, 1.2, -0.3], [0.4, 2.35, 0.25]],
    etiqueta: 'La gota baja',
    escala: '1:5 · CORTE DEL ALFÉIZAR, PISO 1',
    morfologia: 'El alféizar sale del muro y su borde corta la gota por debajo: el goterón es una ranura que la gota no puede cruzar, así cae lejos de la cara del muro en vez de volver por debajo y bajar por él.',
    rotulo: 'El alféizar y su vuelo son del modelo, escala ±12 %; su forma no está confirmada en detalle. La pendiente y el goterón son el principio general del tipo, en trazo discontinuo. Las dos variantes sirven para comparar, no dicen cuál tiene el 106.',
    sello: 'Alféizar: modelo · pendiente y goterón: principio general del tipo',
    certeza: [
      { que: 'Alféizar bajo cada ventana', nivel: 'modelo' },
      { que: 'Pendiente y goterón', nivel: 'general' },
      { que: 'Camino de la gota', nivel: 'general' },
    ],
    ubicacion: { pieza: LUGARES.alfeizar_se, texto: 'Fachada SE, piso 1 · ejemplo' },
    opciones: [{ id: 'goteron', nombre: 'Variante del tipo', valores: [{ id: 'con', nombre: 'Con goterón' }, { id: 'sin', nombre: 'Sin goterón' }], inicial: 'con' }],
    elegir(id, v) { if (id === 'goteron' && caminos[v]) variante = v; o.actualizar(m); },
    inicial: 0.7,
    actualizar(v) {
      m = Math.min(1, Math.max(0, v));
      got.visible = variante === 'con';
      linea.con.visible = variante === 'con';
      linea.sin.visible = variante === 'sin';
      gota.position.copy(sobre(caminos[variante], m, V));
      mojado.visible = variante === 'sin' && m > 0.6;
      if (m < 0.35) return 'la gota baja por el vidrio';
      if (m < 0.55) return 'cruza el alféizar hacia afuera';
      return variante === 'con' ? 'el goterón la corta: cae lejos del muro' : 'sin goterón, vuelve por debajo del alféizar y baja por el muro';
    },
    cifras: () => [
      { clave: 'Fondo del alféizar', valor: `${num(ZF - ZD, 2)} m`, certeza: 'modelo', fuente: 'INVENTARIO §4.6' },
      { clave: 'Vuelo fuera del muro', valor: `${num(ZF, 2)} m`, certeza: 'modelo', fuente: 'caja del alféizar en estado.json' },
      { clave: 'Alto', valor: '0,05 m', certeza: 'modelo', fuente: 'INVENTARIO §4.6' },
    ],
  };
  return o;
}
