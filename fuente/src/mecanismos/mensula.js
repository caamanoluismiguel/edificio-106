// 6 · Cabio y ménsula: despiece del alero del piso 2 con líneas guía hasta el muro.
// Del modelo (INVENTARIO §4.2, §4.3, §4.15, §4.16): ménsula de 0,26 × 0,82 × 1,50 m (6,67 a 7,49), cabios de 7 × 11 cm cada
// 0,65 m (7,47 a 7,58), tablero a 17,9°, tabla de frente y faja de 0,27 m contra el muro (7,91 a 8,18); muro de 0,30.
// Uniones y si la ménsula carga: no se sabe; se marcan en trazo discontinuo.
import { rad, caja, cajaEntre, despiece } from './comun.js';
import { LUGARES } from './planta-106.js';

export const meta = { clave: 'mensula', n: 6, titulo: 'Cabio y ménsula' };

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const g = new THREE.Group();
  const VUELO = 1.65, X = [-0.65, 0.65], PEND = rad(17.9);
  g.add(cajaEntre(k, X, [6.3, 8.4], [-0.3, 0], { poche: true }));
  g.add(k.rotulo('muro 0,30', [-0.65, 8.3, -0.15]));
  const mensula = new THREE.Group(), cabios = new THREE.Group(), tablero = new THREE.Group(), frente = new THREE.Group(), faja = new THREE.Group();
  const forma = new THREE.Shape([new THREE.Vector2(0, 6.67), new THREE.Vector2(0, 7.49), new THREE.Vector2(1.5, 7.49)]);
  const mg = new THREE.ExtrudeGeometry(forma, { depth: 0.26, bevelEnabled: false });
  mg.rotateY(-Math.PI / 2);
  mg.translate(0.13, 0, 0);
  mensula.add(k.dibujar(mg, { enfasis: true }));
  for (const x of [-0.325, 0.325]) cabios.add(caja(k, 0.07, 0.11, VUELO, x, 7.525, VUELO / 2));
  const tab = caja(k, 1.3, 0.03, VUELO / Math.cos(PEND), 0, 7.6 + (Math.tan(PEND) * VUELO) / 2, VUELO / 2);
  tab.rotation.x = PEND;
  tablero.add(tab);
  const ray = [];
  for (let x = -0.6; x <= 0.61; x += 0.1175) ray.push(new V(x, 7.64, VUELO), new V(x, 7.64 + Math.tan(PEND) * VUELO, 0));
  tablero.add(k.linea(ray, { segmentos: true, opacidad: 0.5 }));
  frente.add(cajaEntre(k, X, [7.4, 7.54], [VUELO - 0.1, VUELO]));
  faja.add(cajaEntre(k, X, [7.91, 8.18], [0, 0.03]));
  g.add(mensula, cabios, tablero, frente, faja);
  // uniones: no se sabe cómo son; marcas en trazo discontinuo en el sitio de cada una
  const union = (p, txt) => {
    const c = new THREE.Group();
    c.add(k.linea([new V(p[0] - 0.08, p[1] - 0.06, p[2]), new V(p[0] + 0.08, p[1] - 0.06, p[2]), new V(p[0] + 0.08, p[1] + 0.06, p[2]), new V(p[0] - 0.08, p[1] + 0.06, p[2]), new V(p[0] - 0.08, p[1] - 0.06, p[2])], { discontinua: true, guion: 0.02, enfasis: true }));
    c.add(k.rotulo(txt, [p[0] + 0.5, p[1], p[2]]));
    g.add(c);
  };
  union([0.15, 7.08, 0.02], 'unión con el muro · no se sabe');
  union([0.15, 7.49, 0.75], 'unión con el alero · no se sabe');
  const aplicar = despiece(k, g, [
    { grupo: tablero, vector: [0, 0.9, 0.3], ancla: [0, 7.9, 0.4] },
    { grupo: cabios, vector: [0, 0.45, 0.35], ancla: [0.325, 7.58, 0.2] },
    { grupo: frente, vector: [0, 0, 0.7], ancla: [0, 7.47, VUELO] },
    { grupo: mensula, vector: [0, -0.6, 0.45], ancla: [0, 6.9, 0.05] },
    { grupo: faja, vector: [-0.9, 0.2, 0.2], ancla: [-0.65, 8.05, 0.03] },
  ]);
  const rot = [
    k.rotulo('ménsula', [0.2, 6.9, 0.5], true), k.rotulo('cabio', [0.4, 7.53, 1.2]), k.rotulo('tablero y teja', [0.7, 8.0, 0.4]),
    k.rotulo('tabla de frente', [0.7, 7.47, VUELO]), k.rotulo('faja', [-0.8, 8.05, 0.05]),
  ];
  rot.forEach((r, i) => [mensula, cabios, tablero, frente, faja][i].add(r));
  return {
    objeto: g,
    camara: { pos: [3.2, 8.0, 3.6], obj: [0, 7.3, 0.6] },
    caja: [[-0.9, 6.0, -0.3], [0.9, 9.0, 2.4]],
    etiqueta: 'Despiece del alero',
    escala: '1:25 · ALERO DEL PISO 2',
    morfologia: 'La ménsula, en escuadra, une el borde del alero con el muro; si carga o es decorativa no se sabe. Los cabios reciben el tablero y la teja.',
    rotulo: 'Ménsulas y cabios están en fotos del 106; sus medidas son del modelo, escala ±12 %. Cómo se unen al muro y al alero, y si la ménsula carga o es decorativa, no se sabe: las uniones van en trazo discontinuo.',
    sello: 'Piezas: foto · medidas del modelo · uniones y carga: no se sabe',
    certeza: [
      { que: 'Ménsula, cabios, tabla y faja', nivel: 'foto' },
      { que: 'Medidas y alturas', nivel: 'modelo' },
      { que: 'Uniones y si la ménsula carga', nivel: 'nosabe' },
    ],
    ubicacion: { pieza: LUGARES.mensula_se, texto: 'Alero SE, piso 2 · ejemplo' },
    inicial: 0.5,
    actualizar(m) {
      aplicar(m);
      return m < 0.03 ? 'el alero armado' : 'cada pieza separada; la línea guía lleva a su sitio';
    },
    cifras: () => [
      { clave: 'Vuelo', valor: '1,65 m', certeza: 'modelo', fuente: 'INVENTARIO §4.16' },
      { clave: 'Ménsula', valor: '0,26 × 0,82 × 1,50 m', certeza: 'modelo', fuente: 'INVENTARIO §4.15' },
      { clave: 'Paso de los cabios', valor: '0,65 m', certeza: 'modelo', fuente: 'INVENTARIO §4.2' },
    ],
  };
}
