// 5 · Bloque calado del zócalo. El deslizador separa la cara del zócalo y muestra qué hay detrás: el modelo solo tiene un hueco
// oscuro de 2 cm; si detrás hay un vacío que ventila, no se sabe .
// Del modelo (INVENTARIO §4.8): hueco de 0,32 × 0,28 m, de 0,28 a 0,56 m, uno cada 0,36 m, con 4 cuadros de 12 × 12 cm
// delante (a 0,27–0,39 y 0,45–0,56 m). Zócalo de 0,65 m (§4.7).
import { cajaEntre, despiece } from './comun.js';
import { LUGARES } from './planta-106.js';

export const meta = { clave: 'bloque', n: 5, titulo: 'Bloque calado' };

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const g = new THREE.Group();
  const N = 3, PASO = 0.36, Y0 = 0.28, Y1 = 0.56, ZOC = 0.65;
  const x0 = (-(N - 1) * PASO) / 2;
  // cara: la franja con los huecos y los cuadros, en un grupo que se separa
  const cara = new THREE.Group();
  const xs = Array.from({ length: N }, (_, i) => x0 + i * PASO);
  cara.add(cajaEntre(k, [x0 - 0.34, x0 + (N - 1) * PASO + 0.34], [0, Y0], [-0.02, 0]), cajaEntre(k, [x0 - 0.34, x0 + (N - 1) * PASO + 0.34], [Y1, ZOC], [-0.02, 0]));
  for (let i = 0; i <= N; i++) {
    const xa = i === 0 ? x0 - 0.34 : xs[i - 1] + 0.16, xb = i === N ? x0 + (N - 1) * PASO + 0.34 : xs[i] - 0.16;
    if (xb > xa) cara.add(cajaEntre(k, [xa, xb], [Y0, Y1], [-0.02, 0]));
  }
  for (const x of xs) for (const dx of [-0.08, 0.08]) for (const [ya, yb] of [[0.27, 0.39], [0.45, 0.56]]) cara.add(cajaEntre(k, [x + dx - 0.06, x + dx + 0.06], [ya, yb], [0, 0.02], { enfasis: true }));
  g.add(cara);
  // detrás: el fondo de 2 cm del modelo y luego lo que no se sabe
  for (const x of xs) g.add(cajaEntre(k, [x - 0.16, x + 0.16], [Y0, Y1], [-0.04, -0.02], { poche: true }));
  g.add(cajaEntre(k, [x0 - 0.34, x0 + (N - 1) * PASO + 0.34], [0, ZOC], [-0.3, -0.04], { discontinua: true }));
  g.add(k.rotulo('detrás: ¿macizo o vacío bajo el piso? no se sabe', [0, 0.75, -0.2]));
  g.add(k.rotulo('fondo del hueco en el modelo: 2 cm', [xs[N - 1] + 0.1, Y0 - 0.08, -0.03]));
  g.add(k.linea([new V(x0 - 0.6, 0, 0.6), new V(x0 + 1.4, 0, 0.6)], { opacidad: 0.4 }));
  // el aire que pasaría, en trazo discontinuo, y se detiene en el fondo
  for (const x of xs) g.add(k.linea([new V(x, 0.42, 0.45), new V(x, 0.42, -0.03)], { discontinua: true, guion: 0.03, opacidad: 0.7 }));
  const aplicar = despiece(k, g, [{ grupo: cara, vector: [0, 0, 0.45], ancla: [x0 - 0.34, ZOC, 0] }]);
  return {
    objeto: g,
    camara: { pos: [1.1, 0.9, 1.5], obj: [0, 0.35, -0.05] },
    etiqueta: 'Separar la cara del zócalo',
    escala: '1:10 · ZÓCALO SE',
    morfologia: 'Una pieza modular con huecos que, repetida, hace una franja que deja pasar el aire sin dejar pasar a nadie.',
    rotulo: 'Los bloques calados están en fotos del 106. El dibujo del calado, cuántos son y si ventilan un espacio bajo el piso no se saben: el modelo solo tiene un hueco oscuro de 2 cm detrás de cada bloque.',
    sello: 'Bloque: foto · medidas del modelo · qué hay detrás: no se sabe',
    certeza: [
      { que: 'Bloques calados en la base', nivel: 'foto' },
      { que: 'Hueco de 0,32 × 0,28 m cada 0,36 m', nivel: 'modelo' },
      { que: 'Qué hay detrás y qué ventila', nivel: 'nosabe' },
    ],
    ubicacion: { pieza: LUGARES.bloque, texto: 'Fachada SE, zócalo · ejemplo' },
    inicial: 0.5,
    actualizar(m) {
      aplicar(m);
      return m < 0.03 ? 'la franja de bloques en el zócalo' : 'la cara separada: detrás, el fondo de 2 cm del modelo y la pregunta';
    },
    cifras: () => [
      { clave: 'Hueco', valor: '0,32 × 0,28 m', certeza: 'modelo', fuente: 'INVENTARIO §4.8' },
      { clave: 'Paso', valor: '0,36 m', certeza: 'modelo', fuente: 'INVENTARIO §4.8' },
      { clave: 'Bloques en el modelo', valor: '77', certeza: 'modelo', fuente: '50 en la SE y 27 en la NO, INVENTARIO §4.8' },
    ],
  };
}
