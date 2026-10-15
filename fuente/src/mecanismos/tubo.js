// 3 · Tubo y abrazadera. El tubo se alarga con el calor y se desliza dentro de las abrazaderas sin empujar el muro.
// Del modelo (INVENTARIO §4.19): 12 tubos de 0,12 a 10,80 m, 4 abrazaderas por tubo a 0,80, 2,60, 5,50 y 9,20 m. Que los
// tubos existen está en foto; si son bajantes no se sabe. Punto fijo y guías deslizantes: principio general del tipo.
// El alargamiento se dibuja exagerado y sin cifra: el material del tubo no se sabe.
import { cajaEntre, mover, puntosFlecha } from './comun.js';
import { LUGARES } from './planta-106.js';

export const meta = { clave: 'tubo', n: 3, titulo: 'Tubo y abrazadera' };

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const g = new THREE.Group();
  const R = 0.03, ZT = 0.09, ARRIBA = 3.1, CLAMPS = [0.8, 2.6];
  // muro (corte vertical) y suelo
  g.add(cajaEntre(k, [-0.3, 0.3], [0, ARRIBA + 0.1], [-0.3, 0], { poche: true }));
  g.add(k.linea([new V(-0.3, 0, 0), new V(-0.3, 0, 0.5), new V(0.3, 0, 0.5), new V(0.3, 0, 0)], { opacidad: 0.5 }));
  // el tubo: se dibuja hasta 3,1 m con una línea de corte arriba
  const tubo = new THREE.Group();
  tubo.add(cajaEntre(k, [-R, R], [0.12, ARRIBA], [ZT - R, ZT + R], { enfasis: true }));
  g.add(tubo);
  g.add(k.linea([new V(-0.08, ARRIBA + 0.03, ZT), new V(-0.02, ARRIBA - 0.02, ZT), new V(0.02, ARRIBA + 0.05, ZT), new V(0.08, ARRIBA, ZT)], {}));
  g.add(k.rotulo('sigue hasta 10,80 m', [0.2, ARRIBA, ZT]));
  // abrazaderas: anillo y patas al muro (forma del tipo); la de abajo hace de punto fijo, la de arriba de guía
  CLAMPS.forEach((y, i) => {
    // anillo: cuatro lados alrededor del tubo, con 1 cm de holgura (forma del tipo)
    const h = R + 0.012, e = 0.008;
    for (const [xa, xb, za, zb] of [[-h - e, h + e, ZT + h, ZT + h + e], [-h - e, h + e, ZT - h - e, ZT - h], [-h - e, -h, ZT - h, ZT + h], [h, h + e, ZT - h, ZT + h]])
      g.add(cajaEntre(k, [xa, xb], [y - 0.02, y + 0.02], [za, zb], { discontinua: true }));
    for (const s of [-1, 1]) g.add(cajaEntre(k, [s * (h + 0.004) - 0.004, s * (h + 0.004) + 0.004], [y - 0.02, y + 0.02], [0, ZT - h], { discontinua: true }));
    g.add(k.rotulo(i === 0 ? 'punto fijo · del tipo' : 'guía deslizante · del tipo', [0.2, y, ZT], i === 0));
  });
  // pie del tubo: si descarga al suelo, es bajante; no se sabe
  g.add(k.linea([new V(0, 0.12, ZT), new V(0, 0.0, ZT + 0.15)], { discontinua: true, guion: 0.02 }));
  g.add(k.rotulo('pie del tubo: ¿bajante? no se sabe', [0.25, 0.25, ZT + 0.1]));
  const flechas = k.linea(new Array(12).fill(0).map(() => new V()), { segmentos: true, enfasis: true });
  g.add(flechas);
  return {
    objeto: g,
    camara: { pos: [1.6, 2.2, 2.4], obj: [0, 1.6, 0.05] },
    etiqueta: 'Calor del tubo (ilustrativo)',
    escala: '1:20 · TUBO DE LA FACHADA NO',
    morfologia: 'Fijar en puntos y no a todo lo largo: una abrazadera retiene el tubo y las demás lo guían, así puede alargarse con el calor sin empujar el muro ni romper las fijaciones.',
    rotulo: 'Los tubos y sus abrazaderas están en el modelo y los tubos se ven en fotos. Si son bajantes de lluvia, desagües o ductos no se sabe. La forma de la abrazadera, el punto fijo y la guía son el principio general del tipo. El alargamiento está exagerado y no lleva cifra: el material del tubo no se sabe.',
    sello: 'Tubos: foto · fijación y alargamiento: principio general del tipo, exagerado',
    certeza: [
      { que: 'Tubos sobre la fachada', nivel: 'foto' },
      { que: '4 abrazaderas por tubo', nivel: 'modelo' },
      { que: 'Si son bajantes', nivel: 'nosabe' },
      { que: 'Punto fijo, guía y alargamiento', nivel: 'general' },
    ],
    ubicacion: { pieza: LUGARES.tubo, texto: 'Fachada NO · ejemplo' },
    inicial: 0.6,
    actualizar(m) {
      const d = 0.12 * m; // exagerado a propósito
      // el tubo crece a los dos lados del punto fijo (la abrazadera de abajo): y' = yFijo + (y − yFijo)·s
      const L0 = ARRIBA - 0.12;
      tubo.scale.y = (L0 + d) / L0;
      tubo.position.y = CLAMPS[0] * (1 - tubo.scale.y);
      const p = [];
      for (const y of [CLAMPS[1] + 0.12, ARRIBA - 0.15]) p.push(...puntosFlecha(V, [-0.06, y, ZT + 0.05], [-0.06, y + 0.04 + d, ZT + 0.05], 0.025));
      mover(flechas, p);
      flechas.visible = m > 0.03;
      return m < 0.03 ? 'tubo frío' : 'el tubo se alarga desde el punto fijo y se desliza dentro de la guía';
    },
    cifras: () => [
      { clave: 'Largo del tubo', valor: '10,68 m', certeza: 'modelo', fuente: 'INVENTARIO §4.19' },
      { clave: 'Abrazaderas', valor: '4 por tubo', certeza: 'modelo', fuente: 'a 0,80, 2,60, 5,50 y 9,20 m, INVENTARIO §4.19' },
    ],
  };
}
