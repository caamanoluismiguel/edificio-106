// 12 · Celosía de lamas. Portado de js/detalles.js de D.I.Visor. Solo detalle, con el rótulo «si giraran»:
// que las lamas giren no se sabe (INVENTARIO §4.13). Sin cifra de paso de aire.
import { rad, caja, mover } from './comun.js';
import { LUGARES } from './planta-106.js';

export const meta = { clave: 'celosia', n: 12, titulo: 'Celosía de lamas' };

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const g = new THREE.Group();
  const N = 8, PASO = 0.093, CUERDA = 0.095, LARGO = 1.02, BRAZO = 0.03, XB = -0.5;
  g.add(caja(k, 0.04, 0.74, 0.09, -0.53, 0, 0), caja(k, 0.04, 0.74, 0.09, 0.53, 0, 0));
  const vidrio = k.dibujar(new THREE.PlaneGeometry(1.08, 0.74), { vidrio: true });
  vidrio.position.z = -0.05;
  g.add(vidrio);
  const lamas = [], brazos = [];
  for (let i = 0; i < N; i++) {
    const y = -0.326 + i * PASO;
    const lama = k.dibujar(new THREE.BoxGeometry(LARGO, 0.006, CUERDA));
    lama.position.set(0, y, 0);
    lamas.push(lama);
    const brazo = k.dibujar(new THREE.BoxGeometry(0.006, BRAZO, 0.006), { enfasis: true, discontinua: true });
    brazos.push(brazo);
    g.add(lama, brazo);
  }
  // varilla y palanca: principio del tipo, en trazo discontinuo
  const varilla = k.dibujar(new THREE.BoxGeometry(0.008, 0.72, 0.008), { enfasis: true, discontinua: true });
  const palanca = k.dibujar(new THREE.BoxGeometry(0.012, 0.1, 0.012), { enfasis: true, discontinua: true });
  g.add(varilla, palanca);
  const rayos = [0, 1, 2].map(() => { const l = k.linea([new V(), new V()], { opacidad: 0.6 }); g.add(l); return l; });
  g.add(k.rotulo('varilla · del tipo', [-0.62, 0.42, 0.05], true));
  return {
    objeto: g,
    camara: { pos: [1.1, 0.55, 1.25], obj: [0, 0, 0] },
    etiqueta: 'Giro de las lamas, si giraran',
    escala: '1:5 · PRINCIPIO GENERAL',
    morfologia: 'Lamas angostas que filtran la luz y dejan pasar el aire. Una varilla une todas por un brazo y forma un paralelogramo: las mueve a la vez y paralelas.',
    rotulo: 'Los paños con lamas están en fotos del 106. Que giren, su material y si van por fuera del vidrio no se sabe: esto es el principio general de una celosía operable, si giraran.',
    sello: 'Si giraran: principio general del tipo, no confirmado en el 106',
    certeza: [
      { que: 'Paños con lamas', nivel: 'foto' },
      { que: '8 lamas por paño, una cada 9,3 cm', nivel: 'modelo' },
      { que: 'Que giren, varilla y brazos', nivel: 'general' },
    ],
    ubicacion: { pieza: LUGARES.lama, texto: 'Fachada NO, piso 1 · ejemplo' },
    inicial: 0.5,
    actualizar(m) {
      const th = rad(80 * (1 - m)); // ángulo de la lama respecto a la horizontal
      const n = new V(0, Math.cos(th), Math.sin(th)); // normal a la cuerda: dirección del brazo
      lamas.forEach((l, i) => {
        l.rotation.x = th;
        const piv = new V(XB, l.position.y, 0);
        brazos[i].position.copy(piv).addScaledVector(n, BRAZO / 2);
        brazos[i].rotation.x = th;
      });
      // el paralelogramo: todas las puntas se corren igual, la varilla se traslada sin girar
      varilla.position.set(XB, n.y * BRAZO, n.z * BRAZO);
      palanca.position.set(XB, -0.36 - 0.05 + n.y * BRAZO, n.z * BRAZO);
      const c = new V(0, -Math.sin(th), Math.cos(th)); // dirección de la cuerda
      const abierta = th < rad(78);
      [1, 3, 5].forEach((j, r) => {
        const p = new V(-0.2 + r * 0.3, -0.326 + (j + 0.5) * PASO, 0);
        mover(rayos[r], [p.clone().addScaledVector(c, -0.4), p.clone().addScaledVector(c, 0.4)]);
        rayos[r].visible = abierta;
      });
      return abierta ? 'si giraran: lamas abiertas, pasan aire y luz' : 'si giraran: lamas solapadas';
    },
    cifras: () => [
      { clave: 'Lamas por paño', valor: '8', certeza: 'modelo', fuente: 'INVENTARIO §4.13' },
      { clave: 'Paso entre lamas', valor: '9,3 cm', certeza: 'modelo', fuente: 'INVENTARIO §4.13' },
    ],
  };
}
