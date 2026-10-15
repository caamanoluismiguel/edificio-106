// 8 · Baranda y pasamanos de la rampa. Una mano empuja el pasamanos; el poste gira en su base y el anclaje lo resiste.
// Del modelo (INVENTARIO §4.24, barandas.mjs): postes de 4 × 4 cm cada 0,98 m; pasamanos de Ø 5,4 cm a 0,925 m sobre el
// descanso y dos travesaños de Ø 3,6 cm a 0,505 y 0,165 m (de 1,565, 1,145 y 0,805 m con el descanso a 0,64).
// El anclaje no se ve: placa con pernos o empotrado, como variantes del tipo. El giro está exagerado y no lleva cifra.
import { rad, cajaEntre, cilindro, mover, puntosFlecha, arcoPlanta } from './comun.js';
import { LUGARES } from './planta-106.js';

export const meta = { clave: 'baranda', n: 8, titulo: 'Baranda y pasamanos' };

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const g = new THREE.Group();
  const PASO = 0.98, N = 4, H = [0.925, 0.505, 0.165], DIA = [0.054, 0.036, 0.036];
  const x0 = (-(N - 1) * PASO) / 2;
  // losa del descanso (corte) y la baranda, que gira en bloque sobre la línea de las bases
  g.add(cajaEntre(k, [x0 - 0.4, -x0 + 0.4], [-0.18, 0], [-0.6, 0.15], { poche: true }));
  const baranda = new THREE.Group();
  g.add(baranda);
  for (let i = 0; i < N; i++) baranda.add(cajaEntre(k, [x0 + i * PASO - 0.02, x0 + i * PASO + 0.02], [0, H[0]], [-0.02, 0.02], { enfasis: true }));
  H.forEach((h, j) => baranda.add(cilindro(k, DIA[j] / 2, [x0 - 0.1, h, 0], [-x0 + 0.1, h, 0], { enfasis: j === 0 }, 12)));
  // anclajes: dos variantes del tipo
  const placa = new THREE.Group(), empotrado = new THREE.Group();
  for (let i = 0; i < N; i++) {
    const x = x0 + i * PASO;
    placa.add(cajaEntre(k, [x - 0.06, x + 0.06], [0, 0.01], [-0.06, 0.06], { discontinua: true }));
    for (const dx of [-0.04, 0.04]) for (const dz of [-0.04, 0.04]) placa.add(k.linea([new V(x + dx, 0.015, dz), new V(x + dx, -0.1, dz)], { discontinua: true, guion: 0.01 }));
    empotrado.add(cajaEntre(k, [x - 0.02, x + 0.02], [-0.15, 0], [-0.02, 0.02], { discontinua: true }));
  }
  g.add(placa, empotrado);
  // mano y fuerzas
  const empuje = k.linea(new Array(6).fill(0).map(() => new V()), { segmentos: true, enfasis: true });
  const reaccion = k.linea(new Array(26).fill(0).map(() => new V()), { enfasis: true });
  g.add(empuje, reaccion);
  const rMano = k.rotulo('la mano empuja', [0, H[0] + 0.15, 0.4], true);
  g.add(rMano);
  g.add(k.rotulo('el anclaje resiste el giro', [x0 + 0.1, -0.25, 0.3]));
  g.add(k.rotulo('pasamanos Ø 5,4 cm', [x0 - 0.2, H[0] + 0.08, 0]));
  let variante = 'placa', m = 0;
  const o = {
    objeto: g,
    camara: { pos: [2.2, 1.4, 3.0], obj: [0, 0.45, 0] },
    caja: [[x0 - 0.3, -0.2, -0.3], [-x0 + 0.3, 1.2, 0.6]],
    etiqueta: 'Empujar el pasamanos',
    escala: '1:20 · BARANDA DE LA RAMPA',
    morfologia: 'Un pasamanos redondo de 5,4 cm sobre postes cada 0,98 m. Lo que la mano empuja arriba llega como giro a la base del poste, y ahí trabaja el anclaje.',
    rotulo: 'La baranda está en fotos del 106; sus medidas son del modelo, escala ±12 %. El anclaje no se ve: placa con pernos y poste empotrado son dos variantes del tipo, en trazo discontinuo. El giro está exagerado para que se vea.',
    sello: 'Baranda: foto · anclaje: variante del tipo · giro exagerado',
    certeza: [
      { que: 'Baranda metálica de la rampa', nivel: 'foto' },
      { que: 'Postes, pasamanos y travesaños', nivel: 'modelo' },
      { que: 'Anclaje', nivel: 'general' },
    ],
    ubicacion: { pieza: LUGARES.baranda, texto: 'Rampa de la entrada SE' },
    opciones: [{ id: 'anclaje', nombre: 'Anclaje (variantes del tipo)', valores: [{ id: 'placa', nombre: 'Placa con pernos' }, { id: 'empotrado', nombre: 'Empotrado en la losa' }], inicial: 'placa' }],
    elegir(id, v) { if (id === 'anclaje') variante = v; o.actualizar(m); },
    inicial: 0.6,
    actualizar(v) {
      m = Math.min(1, Math.max(0, v));
      placa.visible = variante === 'placa';
      empotrado.visible = variante === 'empotrado';
      const giro = rad(4) * m; // exagerado
      baranda.rotation.x = giro;
      const yM = H[0] * Math.cos(giro), zM = H[0] * Math.sin(giro);
      mover(empuje, puntosFlecha(V, [0, yM, zM - 0.45], [0, yM, zM - 0.05], 0.05));
      empuje.visible = m > 0.02;
      // la reacción: un arco alrededor de la base del primer poste, en el plano y–z
      const pts = arcoPlanta(V, 0, 0, 0, 0.14, -Math.PI * 0.2, Math.PI * 0.6, 23).map((p) => new V(x0, 0.06 + p.z, p.x));
      const fin = pts[pts.length - 1];
      mover(reaccion, [...pts, fin.clone().add(new V(0, -0.03, 0.02)), fin]);
      reaccion.visible = m > 0.02;
      return m < 0.02 ? 'sin carga' : `el poste tiende a girar en la base; ${variante === 'placa' ? 'los pernos de un lado trabajan a tracción' : 'la losa lo sujeta alrededor del empotramiento'}`;
    },
    cifras: () => [
      { clave: 'Alto del pasamanos sobre el descanso', valor: '0,925 m', certeza: 'modelo', fuente: '1,565 − 0,64, barandas.mjs; INVENTARIO §4.24' },
      { clave: 'Diámetro del pasamanos', valor: '5,4 cm', certeza: 'modelo', fuente: 'INVENTARIO §4.24' },
      { clave: 'Paso de los postes', valor: '0,98 m', certeza: 'modelo', fuente: 'INVENTARIO §4.24' },
    ],
  };
  return o;
}
