// 13 · Gabinete verde. Solo detalle. Del modelo (INVENTARIO §4.28): cuerpo de 1,54 × 1,70 × 1,10 m (0,03 a 1,73),
// tapa de 1,66 × 0,07 × 1,16 m (1,72 a 1,79) y 17 aletas verticales de 1,26 m, una cada 7,5 cm, en la cara NO.
// Puertas y uso: no se sabe. La puerta que se abre es un supuesto, toda en trazo discontinuo, y detrás no se dibuja nada.
// Qué hacen las aletas no se sabe y aquí no se dice.
import { cajaEntre, despiece } from './comun.js';
import { LUGARES } from './planta-106.js';

export const meta = { clave: 'gabinete', n: 13, titulo: 'Gabinete verde' };

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const g = new THREE.Group();
  const WX = 1.54, WZ = 1.1;
  g.add(cajaEntre(k, [-WX / 2, WX / 2], [0.03, 1.73], [-WZ / 2, WZ / 2], { enfasis: true }));
  const tapa = new THREE.Group();
  tapa.add(cajaEntre(k, [-0.83, 0.83], [1.72, 1.79], [-0.58, 0.58]));
  g.add(tapa);
  // 17 aletas en la cara NO (−z), una cada 7,5 cm
  for (let i = 0; i < 17; i++) { const x = -0.6 + i * 0.075; g.add(cajaEntre(k, [x - 0.012, x + 0.012], [0.25, 1.51], [-WZ / 2 - 0.06, -WZ / 2])); }
  // puerta supuesta en la cara +x, con su eje del tipo
  const puerta = new THREE.Group();
  puerta.position.set(WX / 2, 0, -0.45);
  puerta.add(cajaEntre(k, [0, 0.02], [0.15, 1.6], [0, 0.9], { discontinua: true, enfasis: true }));
  puerta.add(k.linea([new V(0.01, 0.15, 0), new V(0.01, 1.6, 0)], { discontinua: true, guion: 0.04 }));
  g.add(puerta);
  g.add(k.linea([new V(-1.2, 0, -1.0), new V(1.4, 0, -1.0), new V(1.4, 0, 1.0), new V(-1.2, 0, 1.0)], { cerrada: true, opacidad: 0.4 }));
  g.add(k.rotulo('aletas · 17 en la cara NO', [-0.2, 1.0, -0.8]));
  g.add(k.rotulo('puerta: supuesta · dónde y cómo no se sabe', [1.1, 1.75, 0.2], true));
  g.add(k.rotulo('dentro: no se sabe', [0.4, 0.9, 0.2]));
  const aplicarTapa = despiece(k, g, [{ grupo: tapa, vector: [0, 0.45, 0], ancla: [0.83, 1.79, 0.58] }]);
  let m = 0;
  return {
    objeto: g,
    camara: { pos: [3.0, 2.4, -2.8], obj: [0, 0.9, 0] },
    caja: [[-1, 0, -0.8], [1.6, 2.3, 0.8]],
    etiqueta: 'Abrir la puerta (supuesta)',
    escala: '1:20 · GABINETE DE SERVICIO',
    morfologia: 'La tapa vuela 6 cm sobre los lados largos del cuerpo y 3 cm sobre los cortos. Las 17 aletas verticales van en la cara NO; para qué sirven no se sabe.',
    rotulo: 'El gabinete verde con aletas está en fotos del 106; las medidas son del modelo, no tomadas. Qué es, qué tiene dentro y dónde están sus puertas no se sabe: la puerta que se abre es un supuesto en trazo discontinuo.',
    sello: 'Gabinete y aletas: foto · puerta y uso: no se sabe',
    certeza: [
      { que: 'Gabinete verde con aletas', nivel: 'foto' },
      { que: 'Medidas y 17 aletas', nivel: 'modelo' },
      { que: 'Puertas, cerradura y uso', nivel: 'nosabe' },
    ],
    ubicacion: { pieza: LUGARES.gabinete, texto: 'Frente a la fachada NO' },
    inicial: 0.4,
    despiece(f) { aplicarTapa(f); },
    actualizar(v) {
      m = Math.min(1, Math.max(0, v));
      puerta.rotation.y = (-Math.PI / 2) * 0.9 * m;
      return m < 0.02 ? 'cerrado' : 'la puerta supuesta abre; detrás no se dibuja nada porque no se sabe qué hay';
    },
    cifras: () => [
      { clave: 'Cuerpo', valor: '1,54 × 1,70 × 1,10 m', certeza: 'modelo', fuente: 'INVENTARIO §4.28' },
      { clave: 'Vuelo de la tapa', valor: '6 cm y 3 cm', certeza: 'modelo', fuente: '(1,66 − 1,54) / 2 y (1,16 − 1,10) / 2, INVENTARIO §4.28' },
    ],
  };
}
