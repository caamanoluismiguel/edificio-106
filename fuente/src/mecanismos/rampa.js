// Rampa contra escalera. Portado de js/detalles.js de D.I.Visor; no está en el catálogo, es una de las seis
// escenas. Cotas inferidas (INVENTARIO §4.22 y §4.24): no se dice si cumple una norma.
import { num, caja, cajaEntre, sobre, largo } from './comun.js';
import { LUGARES } from './planta-106.js';

export const meta = { clave: 'rampa', n: null, titulo: 'Rampa contra escalera' };

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const g = new THREE.Group();
  g.add(cajaEntre(k, [-3.2, 7.6], [0.06, 0.16], [-0.2, 3.2]));
  g.add(cajaEntre(k, [-0.7, 7.3], [0.16, 1.96], [-0.15, 0]));
  // losas inclinadas como prismas por sus cuatro esquinas de arriba
  const losa = (x0, x1, z0, z1, y0, y1) => {
    const geo = new THREE.BufferGeometry();
    const e = 0.12;
    const p = [[x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1]];
    const v = [...p.map(([x, y, z]) => [x, y, z]), ...p.map(([x, y, z]) => [x, y - e, z])].flat();
    const caras = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setIndex(caras);
    geo.computeVertexNormals();
    return k.dibujar(geo, { umbral: 10 });
  };
  g.add(losa(0, 5.9, 1.42, 2.74, 0.16, 0.64));
  const descanso = cajaEntre(k, [5.9, 7.3], [0.52, 0.64], [0, 2.74], { enfasis: true });
  g.add(descanso);
  g.add(losa(0, 5.9, 0, 1.32, 1.12, 0.64));
  g.add(cajaEntre(k, [-0.7, 0], [0.16, 1.12], [0, 2.3]));
  // escalera de 7 peldaños de 0,137 m que llega al mismo porche
  for (let i = 0; i < 7; i++) g.add(cajaEntre(k, [-2.8 + i * 0.3, -0.7], [0.16, 0.16 + (i + 1) * 0.137], [0, 2.3]));
  // postes y pasamanos (altura de dibujo, sin cifra)
  const H = 0.9;
  const yRampa = (x, baja) => (baja ? 0.16 + (0.48 * x) / 5.9 : 1.12 - (0.48 * x) / 5.9);
  const postes = [];
  for (let i = 0; i < 7; i++) {
    const x = 0.1 + i * 0.98;
    postes.push([x, yRampa(x, true), 2.7], [x, yRampa(x, true), 1.46], [x, yRampa(x, false), 1.28]);
  }
  for (const [x, y, z] of postes) g.add(caja(k, 0.04, H, 0.04, x, y + H / 2, z));
  const fuera = [new V(0, yRampa(0, true) + H, 2.7), new V(5.9, 0.64 + H, 2.7), new V(7.26, 0.64 + H, 2.7), new V(7.26, 0.64 + H, 0.04)];
  const dentro = [new V(0, yRampa(0, true) + H, 1.46), new V(5.9, 0.64 + H, 1.46), new V(5.9, 0.64 + H, 1.28), new V(0, 1.12 + H, 1.28)];
  for (const camino of [fuera, dentro]) {
    g.add(k.dibujar(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(camino, false, 'catmullrom', 0.05), 60, 0.027, 6), { enfasis: true, umbral: 60 }));
    for (const f of [0.35, 0.65]) g.add(k.linea(camino.map((p) => p.clone().setY(p.y - H * (1 - f))), { opacidad: 0.6 }));
  }
  // marcadores
  const pr = [new V(0, 0.16, 2.08), new V(5.9, 0.64, 2.08), new V(6.6, 0.64, 2.08), new V(6.6, 0.64, 0.66), new V(5.9, 0.64, 0.66), new V(0, 1.12, 0.66)];
  const largoRampa = largo(pr.map((p) => new V(p.x, 0, p.z))); // en planta, como la escalera
  const marcador = () => {
    const c = k.dibujar(new THREE.CylinderGeometry(0.225, 0.225, 1.2, 16), { enfasis: true, umbral: 60 });
    g.add(c);
    return c;
  };
  const mr = marcador(), me = marcador();
  g.add(k.rotulo('descanso', [6.6, 0.9, 2.4], true));
  g.add(k.rotulo('escalera de 7 peldaños', [-1.75, 1.5, 2.6]));
  const pend = (0.48 / 5.9) * 100;
  return {
    objeto: g,
    camara: { pos: [-2.0, 6.5, 13.0], obj: [2.5, 0.6, 1.0] },
    etiqueta: 'Subida por la rampa',
    escala: '1:50 · ENTRADA SE',
    rotulo: `Pendiente de cada tramo en el modelo: ${num(pend, 1)} % (0,48 m en 5,90 m). Cotas inferidas y escala ±12 %: no se puede decir si cumple una norma.`,
    morfologia: 'Para subir la misma altura, la rampa cambia altura por largo: dos tramos con un descanso y el giro pegado al muro, contra siete peldaños.',
    sello: 'Rampa en foto · cotas inferidas del modelo',
    certeza: [
      { que: 'Rampa de dos tramos con giro', nivel: 'foto' },
      { que: '7 peldaños de la entrada', nivel: 'foto' },
      { que: 'Cotas, pendiente y alto de los peldaños', nivel: 'modelo', nota: 'inferidas' },
    ],
    ubicacion: { pieza: LUGARES.rampa, texto: 'Entrada SE' },
    inicial: 0.5,
    cifras: () => [
      { clave: 'Pendiente de cada tramo', valor: `${num(pend, 1)} %`, certeza: 'modelo', fuente: '0,48 m en 5,90 m, INVENTARIO §4.24 (inferida)' },
      { clave: 'Altura a salvar', valor: '0,96 m', certeza: 'modelo', fuente: 'de 0,16 a 1,12 m, INVENTARIO §4.22 a' },
    ],
    actualizar(m) {
      const p = sobre(pr, m, V);
      mr.position.set(p.x, p.y + 0.6, p.z);
      const xe = -2.8 + 2.1 * m;
      const peld = Math.min(7, Math.floor(m * 7 + 1e-6) + (m > 0 ? 1 : 0));
      const ye = m >= 1 ? 1.12 : 0.16 + Math.min(peld, 7) * 0.137 * (m > 0 ? 1 : 0);
      me.position.set(xe, ye + 0.6, 1.15);
      return [`rampa · altura ${num(p.y, 2)} m · recorrido ${num(largoRampa * m, 1)} m`,
        `escalera · altura ${num(ye, 2)} m · recorrido ${num(2.1 * m, 1)} m`];
    },
  };
}
