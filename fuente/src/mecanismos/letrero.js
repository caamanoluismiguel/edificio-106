// 4 · Letrero 106 de la entrada. Despiece de base, panel y franja.
// Del modelo (INVENTARIO §4.26 a): panel de 1,64 × 0,14 m, de 0,49 a 2,79 m; base de 1,30 × 0,54 × 0,18 m; franja de
// 1,66 × 0,52 m arriba (2,27 a 2,79), en la cara que mira al SE. El real es curvo y el modelo casi plano. El anclaje no se
// ve: pernos del tipo, en trazo discontinuo.
import { cajaEntre, despiece } from './comun.js';
import { LUGARES } from './planta-106.js';

export const meta = { clave: 'letrero', n: 4, titulo: 'Letrero 106' };

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const g = new THREE.Group();
  // el pie del panel a 0,49 m; la base de 0,18 m se dibuja justo debajo (la cota del terreno ahí no está en el inventario)
  const Y0 = 0.49, YB = Y0 - 0.18;
  const base = new THREE.Group(), panel = new THREE.Group(), franja = new THREE.Group(), pernos = new THREE.Group();
  base.add(cajaEntre(k, [-0.65, 0.65], [YB, Y0], [-0.27, 0.27]));
  panel.add(cajaEntre(k, [-0.82, 0.82], [Y0, 2.79], [-0.07, 0.07], { enfasis: true }));
  franja.add(cajaEntre(k, [-0.83, 0.83], [2.27, 2.79], [0.07, 0.085], { enfasis: true }));
  const ray = [];
  for (let x = -0.78; x <= 0.79; x += 0.08) ray.push(new V(x, 2.3, 0.087), new V(x + 0.06, 2.76, 0.087));
  franja.add(k.linea(ray, { segmentos: true, opacidad: 0.5 }));
  franja.add(k.rotulo('franja azul', [0.95, 2.55, 0.09]));
  for (const x of [-0.5, -0.17, 0.17, 0.5]) pernos.add(k.linea([new V(x, YB - 0.1, 0), new V(x, Y0 + 0.15, 0)], { discontinua: true, guion: 0.03, enfasis: true }));
  pernos.add(k.rotulo('anclaje · del tipo', [0.75, YB, 0.3]));
  g.add(base, panel, franja, pernos);
  g.add(k.linea([new V(-1.2, YB, -0.6), new V(1.2, YB, -0.6), new V(1.2, YB, 0.6), new V(-1.2, YB, 0.6)], { cerrada: true, opacidad: 0.4 }));
  g.add(k.rotulo('106', [0, 2.5, 0.12], true));
  g.add(k.rotulo('panel', [0.95, 1.4, 0]));
  const aplicar = despiece(k, g, [
    { grupo: base, vector: [0, -0.5, 0], ancla: [0, YB, 0.27] },
    { grupo: franja, vector: [0, 0.35, 0.6], ancla: [0, 2.53, 0.085] },
    { grupo: pernos, vector: [-1.1, -0.2, 0], ancla: [-0.5, YB, 0] },
  ]);
  return {
    objeto: g,
    camara: { pos: [2.4, 2.0, 3.6], obj: [0, 1.5, 0] },
    caja: [[-1, YB - 0.6, -0.3], [1, 3.2, 0.7]],
    etiqueta: 'Despiece',
    escala: '1:20 · LETRERO DE LA ENTRADA',
    morfologia: 'La franja de color corona el panel, de 2,27 a 2,79 m, y el panel se apoya en una base más ancha.',
    rotulo: 'El letrero está en fotos del 106: un tótem curvo, gris con la parte de arriba azul. El modelo lo tiene casi plano; las medidas son del modelo, no tomadas. El anclaje no se ve: los pernos son el principio general del tipo.',
    sello: 'Letrero: foto · medidas del modelo · anclaje: principio general del tipo',
    certeza: [
      { que: 'Letrero gris y azul', nivel: 'foto' },
      { que: 'Medidas', nivel: 'modelo', nota: 'el real es curvo' },
      { que: 'Anclaje', nivel: 'general' },
    ],
    ubicacion: { pieza: LUGARES.letrero, texto: 'Entrada SE, junto a la rampa' },
    inicial: 0,
    actualizar(m) {
      aplicar(m);
      return m < 0.03 ? 'el letrero armado' : 'base, panel, franja y anclaje separados';
    },
    cifras: () => [
      { clave: 'Panel', valor: '1,64 × 2,30 m', certeza: 'modelo', fuente: 'de 0,49 a 2,79 m, INVENTARIO §4.26' },
      { clave: 'Franja', valor: '1,66 × 0,52 m', certeza: 'modelo', fuente: 'INVENTARIO §4.26' },
    ],
  };
}
