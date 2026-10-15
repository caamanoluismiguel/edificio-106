// 15 · Poste de luz de la esquina. Despiece de base, fuste, brazo y luminaria, con la tapa del registro.
// Del modelo (INVENTARIO §4.31): poste de 0,08 a 11,62 m, brazo hasta x 48,62 (unos 3 m desde el fuste, en x 45,6),
// base de 0,55 × 0,56 × 0,55 m, luminaria de 0,69 × 0,13 × 0,28 m a 11,48–11,61. El poste está en foto y su altura no está
// medida. La luminaria y el registro: principio del tipo, en trazo discontinuo. El diámetro del fuste es de dibujo.
import { cajaEntre, cilindro, despiece } from './comun.js';
import { LUGARES } from './planta-106.js';

export const meta = { clave: 'poste', n: 15, titulo: 'Poste de luz' };

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const g = new THREE.Group();
  const base = new THREE.Group(), fuste = new THREE.Group(), brazo = new THREE.Group(), lum = new THREE.Group(), registro = new THREE.Group();
  base.add(cajaEntre(k, [-0.275, 0.275], [0, 0.55], [-0.28, 0.28]));
  fuste.add(cilindro(k, 0.06, [0, 0.55, 0], [0, 11.62, 0], { enfasis: true }, 14));
  brazo.add(cilindro(k, 0.035, [0, 11.55, 0], [3.0, 11.55, 0], { enfasis: true }, 10));
  lum.add(cajaEntre(k, [2.66, 3.35], [11.48, 11.61], [-0.14, 0.14], { discontinua: true, enfasis: true }));
  registro.add(cajaEntre(k, [0.06, 0.08], [0.9, 1.25], [-0.04, 0.04], { discontinua: true }));
  g.add(base, fuste, brazo, lum, registro);
  g.add(k.linea([new V(-1, 0, -1), new V(4, 0, -1), new V(4, 0, 1), new V(-1, 0, 1)], { cerrada: true, opacidad: 0.4 }));
  base.add(k.rotulo('base', [0.5, 0.3, 0]));
  fuste.add(k.rotulo('fuste', [0.3, 6, 0]));
  brazo.add(k.rotulo('brazo', [1.2, 11.2, 0]));
  lum.add(k.rotulo('luminaria · del tipo', [3.4, 12.2, 0], true));
  registro.add(k.rotulo('tapa del registro · del tipo', [0.6, 1.1, 0]));
  const aplicar = despiece(k, g, [
    { grupo: base, vector: [0, -1.2, 0], ancla: [0, 0.3, 0.28] },
    { grupo: brazo, vector: [0.6, 1.2, 0], ancla: [0.1, 11.55, 0] },
    { grupo: lum, vector: [1.2, 2.4, 0], ancla: [3.0, 11.6, 0] },
    { grupo: registro, vector: [1.4, 0.3, 0], ancla: [0.08, 1.1, 0] },
  ]);
  return {
    objeto: g,
    camara: { pos: [9, 7, 14], obj: [1.5, 6, 0] },
    caja: [[-0.6, -1.3, -0.6], [4.6, 14.2, 0.6]],
    etiqueta: 'Despiece',
    escala: '1:100 · POSTE DE LA ESQUINA',
    morfologia: 'El brazo separa la luminaria unos 3 m del fuste; la base ancha recibe el fuste y el registro de cables va abajo, a la altura de la mano.',
    rotulo: 'El poste de la esquina está en foto; su altura no está medida y las medidas son del modelo. La luminaria y la tapa del registro son el principio general del tipo, en trazo discontinuo.',
    sello: 'Poste: foto · medidas del modelo · luminaria y registro: principio general del tipo',
    certeza: [
      { que: 'Poste de la esquina', nivel: 'foto' },
      { que: 'Alto, brazo y base', nivel: 'modelo', nota: 'altura no medida' },
      { que: 'Luminaria y registro', nivel: 'general' },
    ],
    ubicacion: { pieza: LUGARES.poste, texto: 'Esquina de la calle SE' },
    inicial: 0.5,
    actualizar(m) {
      aplicar(m);
      return m < 0.03 ? 'el poste armado' : 'base, fuste, brazo, luminaria y registro separados';
    },
    cifras: () => [
      { clave: 'Alto del poste', valor: '11,54 m', certeza: 'modelo', fuente: 'de 0,08 a 11,62 m, INVENTARIO §4.31; no medido' },
      { clave: 'Brazo', valor: 'unos 3 m', certeza: 'modelo', fuente: 'hasta x 48,62, INVENTARIO §4.31' },
    ],
  };
}
