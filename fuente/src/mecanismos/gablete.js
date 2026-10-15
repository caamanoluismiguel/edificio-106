// 16 · Gablete del ático. Portado de js/detalles.js de D.I.Visor, sin flechas ni partículas
// dentro del ático (el 106 no hace CFD). El deslizador levanta el faldón para ver el volumen del ático y los dos gabletes,
// y queda la pregunta de por dónde entraría el aire. Si el anfitrión da ctx.rosa() (la rosa de la temporada del 106,
// [[rumbo en grados, fracción]]), se dibuja al lado del gablete NE; si no, no se dibuja nada.
import { LUGARES } from './planta-106.js';

export const meta = { clave: 'gablete', n: 16, titulo: 'Gablete del ático' };

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const g = new THREE.Group();
  const YE = 11.148, YR = 15.643, YG = 14.61, XE = 24.4, XR = 14.35, ZE = 13.1, ZG = 3.1;
  const cara = (pts, op) => {
    const geo = new THREE.BufferGeometry();
    const v = [];
    for (let i = 1; i < pts.length - 1; i++) v.push(...pts[0], ...pts[i], ...pts[i + 1]);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.computeVertexNormals();
    return k.dibujar(geo, { umbral: 5, vidrio: true, ...op });
  };
  // mitad −z (corte longitudinal en z = 0); los faldones van en «tapa», que el deslizador levanta
  const tapa = new THREE.Group();
  g.add(tapa);
  tapa.add(cara([[-XE, YE, -ZE], [XE, YE, -ZE], [XR, YG, -ZG], [XR, YR, 0], [-XR, YR, 0], [-XR, YG, -ZG]]));
  for (const s of [1, -1]) tapa.add(cara([[s * XE, YE, -ZE], [s * XE, YE, 0], [s * XR, YG, 0], [s * XR, YG, -ZG]]));
  // remate del muro y faja
  const rect = (y, ins) => [new V(-22.75 + ins, y, 0), new V(-22.75 + ins, y, -11.5 + ins), new V(22.75 - ins, y, -11.5 + ins), new V(22.75 - ins, y, 0)];
  g.add(k.linea(rect(11.6, 0)), k.linea(rect(11.78, 0.38), { opacidad: 0.5 }), k.linea(rect(12.04, 0.38), { opacidad: 0.5 }));
  // limas y cumbrera, para leer la forma a través del faldón translúcido
  tapa.add(k.linea([new V(-XE, YE, -ZE), new V(-XR, YG, -ZG), new V(-XR, YR, 0), new V(XR, YR, 0), new V(XR, YG, -ZG), new V(XE, YE, -ZE)]));
  g.add(k.linea([new V(-XE, YE, 0), new V(-XE, YE, -ZE), new V(XE, YE, -ZE), new V(XE, YE, 0)]));
  g.add(k.linea([new V(-XE, YE, 0), new V(-XR, YG, 0), new V(-XR, YR, 0)], { opacidad: 0.6 }), k.linea([new V(XE, YE, 0), new V(XR, YG, 0), new V(XR, YR, 0)], { opacidad: 0.6 }));
  // gabletes: NE (+x) en foto, SO (−x) extrapolado
  for (const s of [1, -1]) {
    const tri = [new V(s * XR, YG, -ZG), new V(s * XR, YG, 0), new V(s * XR, 15.6, 0), new V(s * XR, YG, -ZG)];
    g.add(k.linea(tri, { enfasis: true, discontinua: s < 0, guion: 0.4 }));
    g.add(k.linea([new V(s * XR, YG, 0), new V(s * XR, 15.53, 0)], { discontinua: s < 0 }));
  }
  g.add(k.rotulo('gablete NE (en foto)', [XR + 1, 16.4, -1.5], true));
  g.add(k.rotulo('gablete SO (extrapolado)', [-XR - 1, 16.4, -1.5]));
  g.add(k.rotulo('cumbrera 15,64 m', [0, 16.3, 0]));
  // volumen del ático (INVENTARIO §2): 44,74 × 22,24 m, de 11,99 a 14,61 m; la mitad −z
  g.add(k.linea([new V(-22.37, 11.99, 0), new V(-22.37, 11.99, -11.12), new V(22.37, 11.99, -11.12), new V(22.37, 11.99, 0)], { discontinua: true, guion: 0.5, opacidad: 0.6 }));
  // hueco del gablete NE: si tiene malla o lamas no se sabe
  g.add(k.linea([new V(XR + 0.02, YG + 0.1, -ZG + 0.4), new V(XR + 0.02, YG + 0.1, -0.1), new V(XR + 0.02, 15.4, -0.1)], { discontinua: true, guion: 0.15, enfasis: true }));
  g.add(k.rotulo('¿malla o lamas? no se sabe', [XR + 1, 14.2, -2.6]));
  // rosa de la temporada (opcional, del anfitrión)
  const rosa = new THREE.Group();
  g.add(rosa);
  let rosaHecha = false;
  const hacerRosa = () => {
    if (rosaHecha || typeof k.rosa !== 'function') return;
    const r = k.rosa();
    if (!Array.isArray(r) || !r.length) return;
    rosaHecha = true;
    const max = Math.max(...r.map((x) => x[1])) || 1;
    // rumbo desde el norte; +x de la escena apunta a 56° (EJE_LARGO de sol.js), +z a 146°
    const pts = r.map(([b, f]) => { const a = ((b - 56) * Math.PI) / 180, R = 4 * (f / max); return new V(XR + 9 + R * Math.cos(a), YG, -3 + R * Math.sin(a)); });
    rosa.add(k.linea([...pts, pts[0]], {}));
    rosa.add(k.rotulo('viento de la temporada · ERA5, celda de ~28 km', [XR + 9, YG + 1.2, -3]));
  };
  return {
    objeto: g,
    camara: { pos: [8, 52, 46], obj: [0, 13, 0] },
    caja: [[-25, 11, -13], [25, 16, 0]],
    etiqueta: 'Levantar el faldón',
    escala: '1:200 · CUBIERTA',
    morfologia: 'Una abertura alta en cada extremo, arriba, bajo el faldón del techo.',
    rotulo: 'Gablete NE en foto; el SO está extrapolado de esa foto. El modelo no tiene ventilación de cumbrera. Por dónde entraría el aire nuevo no está documentado y el visor no calcula el flujo de aire.',
    sello: 'Gablete NE: foto · SO: extrapolado · sin flujo de aire calculado',
    certeza: [
      { que: 'Gablete NE', nivel: 'foto' },
      { que: 'Gablete SO', nivel: 'modelo', nota: 'extrapolado' },
      { que: 'Malla o lamas en el hueco', nivel: 'nosabe' },
      { que: 'Entrada y salida del aire', nivel: 'nosabe' },
    ],
    ubicacion: { pieza: LUGARES.gablete, texto: 'Gablete NE' },
    inicial: 0,
    actualizar(m) {
      hacerRosa();
      tapa.position.y = 4 * m;
      tapa.visible = m < 0.99;
      return m < 0.05 ? 'la cubierta cerrada: el ático queda debajo del faldón' : '¿Por dónde entraría el aire nuevo al ático? El modelo no lo dice';
    },
    cifras: () => [
      { clave: 'Hueco de cada gablete', valor: '6,20 × 1,00 m', certeza: 'modelo', fuente: 'INVENTARIO §4.18' },
      { clave: 'Cumbrera', valor: '15,64 m', certeza: 'modelo', fuente: 'INVENTARIO §1 (kit-medidas.json)' },
    ],
  };
}
