// 14 · Condensadora. Portado de js/detalles.js de D.I.Visor, con su certeza: que es condensadora, en foto;
// el ventilador no está modelado; ciclo y soporte, principio del tipo. Nada de consumo eléctrico (descartado).
import { rad, caja, cajaEntre, sobre, largo } from './comun.js';
import { LUGARES } from './planta-106.js';

export const meta = { clave: 'condensadora', n: 14, titulo: 'Condensadora' };

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const g = new THREE.Group();
  g.add(cajaEntre(k, [-0.455, 0.455], [0.09, 0.71], [-0.22, 0.22], { vidrio: true }));
  const cx = -0.16, cy = 0.4, zf = 0.22; // hueco del ventilador corrido 0,16 m del centro, como en el modelo
  const circulo = (r, z, op) => {
    const p = [];
    for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; p.push(new V(cx + r * Math.cos(a), cy + r * Math.sin(a), z)); }
    return k.linea(p, { cerrada: true, ...op });
  };
  g.add(circulo(0.25, zf));
  for (const d of [0.48, 0.42, 0.32, 0.22, 0.14]) g.add(circulo(d / 2, zf + 0.002, { enfasis: true }));
  const aspa = new THREE.Group();
  aspa.position.set(cx, cy, zf - 0.05);
  const cubo = k.dibujar(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 16).rotateX(Math.PI / 2), { enfasis: true, discontinua: true });
  aspa.add(cubo);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Group();
    b.rotation.z = (i / 3) * Math.PI * 2;
    const hoja = k.dibujar(new THREE.BoxGeometry(0.19, 0.09, 0.004), { enfasis: true, discontinua: true });
    hoja.position.x = 0.135;
    hoja.rotation.x = rad(28);
    b.add(hoja);
    aspa.add(b);
  }
  g.add(aspa);
  g.add(caja(k, 0.1, 0.1, 0.08, cx, cy, zf - 0.12));
  // serpentín en L con aletas
  g.add(cajaEntre(k, [-0.43, 0.43], [0.13, 0.67], [-0.215, -0.165], { discontinua: true }), cajaEntre(k, [-0.45, -0.4], [0.13, 0.67], [-0.2, 0.15], { discontinua: true }));
  const aletas = [];
  for (let i = 0; i < 20; i++) { const x = -0.42 + (i / 19) * 0.84; aletas.push(new V(x, 0.13, -0.163), new V(x, 0.67, -0.163)); }
  g.add(k.linea(aletas, { segmentos: true, opacidad: 0.5 }));
  // rejilla del frente, junto al ventilador (en el modelo: 0,15 × 0,36 m a +0,325 m del centro)
  g.add(cajaEntre(k, [0.25, 0.4], [0.22, 0.58], [0.22, 0.226]));
  const lamas = [];
  for (let y = 0.25; y < 0.58; y += 0.04) lamas.push(new V(0.26, y, 0.227), new V(0.39, y, 0.227));
  g.add(k.linea(lamas, { segmentos: true, opacidad: 0.6 }));
  g.add(k.dibujar(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 18), { discontinua: true }).translateX(0.2).translateY(0.24).translateZ(-0.02));
  g.add(cajaEntre(k, [-0.79, -0.5], [0.38, 2.1], [-0.215, 0.215], { vidrio: true }));
  // circuito: compresor → serpentín → tubo fino arriba → vuelve por el grueso → compresor
  const circ = [
    new V(0.2, 0.39, -0.02), new V(0.2, 0.6, -0.12), new V(-0.4, 0.6, -0.19), new V(0.4, 0.6, -0.19),
    new V(0.4, 0.4, -0.19), new V(-0.4, 0.4, -0.19), new V(-0.4, 0.2, -0.19), new V(0.3, 0.2, -0.19), new V(0.3, 0.16, 0),
    new V(-0.6, 0.16, 0), new V(-0.6, 2.05, 0), new V(-0.69, 2.05, 0), new V(-0.69, 0.3, 0), new V(0.2, 0.3, -0.02),
  ];
  g.add(k.linea([...circ, circ[0]], { discontinua: true, guion: 0.03, opacidad: 0.7 }));
  const L = largo([...circ, circ[0]]);
  const iLiq = largo(circ.slice(0, 8)) / L, iSube = largo(circ.slice(0, 11)) / L;
  const puntos = Array.from({ length: 12 }, (_, i) => {
    const s = k.dibujar(new THREE.SphereGeometry(0.014, 10, 8), { enfasis: true, umbral: 80 });
    g.add(s);
    return { s, u: i / 12 };
  });
  const flechas = Array.from({ length: 6 }, () => { const l = k.linea([new V(), new V()], { enfasis: true, opacidad: 0.6 }); g.add(l); return l; });
  g.add(k.rotulo('ventilador · no modelado', [cx, cy + 0.33, zf], true));
  g.add(k.rotulo('serpentín · del tipo', [-0.1, 0.72, -0.25]));
  g.add(k.rotulo('compresor · del tipo', [0.2, 0.05, 0.1]));
  g.add(k.rotulo('rejilla del frente', [0.33, 0.66, 0.24]));
  g.add(k.rotulo('a la unidad interior', [-0.65, 2.2, 0]));
  let giro = 0, fase = 0;
  return {
    objeto: g,
    camara: { pos: [1.5, 1.1, 1.7], obj: [0, 0.55, 0] },
    caja: [[-0.8, 0.05, -0.25], [0.5, 1.0, 0.25]],
    etiqueta: 'Giro del ventilador y ciclo',
    escala: '1:10 · UNIDAD DEL MODELO',
    animado: true,
    morfologia: 'Una rejilla redonda delante de un ventilador axial que mueve el aire a través del serpentín. La caja del modelo mide 0,91 × 0,62 × 0,44 m.',
    rotulo: 'Que son condensadoras de aire acondicionado está en fotos del 106. El ventilador no está modelado. Compresor, serpentín, ciclo y soporte: principio general del aparato.',
    sello: 'Que es condensadora: foto · ventilador, ciclo y soporte: principio general del tipo',
    certeza: [
      { que: 'Condensadoras al pie del muro', nivel: 'foto' },
      { que: 'Caja, rejilla y cubretubos', nivel: 'modelo' },
      { que: 'Ventilador', nivel: 'general', nota: 'no modelado' },
      { que: 'Ciclo, compresor y soporte', nivel: 'general' },
    ],
    ubicacion: { pieza: LUGARES.condensadora, texto: 'Fachada SE · ejemplo' },
    inicial: 0.5,
    cifras: () => [
      { clave: 'Caja', valor: '0,91 × 0,62 × 0,44 m', certeza: 'modelo', fuente: 'INVENTARIO §4.27' },
      { clave: 'Unidades en el modelo', valor: '15', certeza: 'modelo', fuente: 'INVENTARIO §4.27; las fotos muestran más' },
    ],
    actualizar(m, dt) {
      giro += m * Math.PI * 2 * 3 * dt;
      aspa.rotation.z = -giro;
      fase = (fase + m * 0.12 * dt) % 1;
      for (const p of puntos) {
        const u = (p.u + fase) % 1;
        p.s.position.copy(sobre([...circ, circ[0]], u, V));
        p.s.scale.setScalar(u < iLiq ? 1.2 : u < iSube ? 0.7 : 0.95);
      }
      flechas.forEach((l, i) => {
        const x = -0.3 + (i % 3) * 0.3, y = 0.3 + Math.floor(i / 3) * 0.2;
        const pos = l.geometry.attributes.position;
        pos.setXYZ(0, x, y, -0.45);
        pos.setXYZ(1, x, y, -0.45 + 0.95 * m);
        pos.needsUpdate = true;
        l.visible = m > 0.02;
      });
      return m < 0.02 ? 'unidad detenida' : 'gas caliente al serpentín, líquido a la unidad interior, gas frío de regreso';
    },
  };
}
