// 9 · Puerta parda que abre hacia afuera: la hoja gira sobre bisagras de pernio con su pasador, con el corte en planta a 1 m
// y el arco del giro en el suelo. Bisagras, tirador y cerradura son el principio del tipo y van en trazo discontinuo.
// Medidas (INVENTARIO §4.21 b y c: 3 puertas pardas de servicio más la de la galería SO):
//   (datos/familias.json, puerta_parda.hojas: SO con bisagra en z −5,325 que abre hacia −x, a la galería)
//   galería SO: hoja de 1,26 × 2,07 m (1,25 en datos/familias.json), de 1,28 a 3,35, en x −22,75, z −5,33 a −4,07; la manija del modelo junto a z −4,08,
//   así que la bisagra va en el canto contrario, z −5,33 (inferencia del modelo, no del testimonio).
//   SE: una hoja (foto), que gira entera con la bisagra en x −13,75; el modelo la hace de 1,50 × 2,54 m, pero la foto la
//   muestra más angosta: su ancho real no se sabe.
//   NO (x −4,15 a −2,45, 1,70 m): dos hojas, cada una en su jamba de afuera; lo sugiere el listón del centro del modelo y
//   una foto lejana lo apoya sin confirmarlo.
// Las pardas abren hacia afuera (lo informa el equipo del proyecto, 14 oct 2026): certeza «equipo». Cuántas hojas tiene cada
// una no lo informa: una o dos hojas siguen saliendo del modelo y de las fotos, con su certeza.
import { num, cajaEntre, mover, arcoPlanta, cilindro, vaciar, secundario } from './comun.js';
import { LUGARES } from './planta-106.js';

export const PUERTAS = {
  so: { nombre: 'Galería SO', W: 1.26, H: 2.07, piso: 1.28, hojas: 1, ladoBisagra: 'NO', lugar: LUGARES.puerta_so, txt: 'Fachada SO, galería' },
  se: { nombre: 'Servicio SE (una hoja en la foto)', W: 1.5, H: 2.54, piso: 0.7, hojas: 1, ladoBisagra: 'SO', lugar: LUGARES.puerta_parda, txt: 'Fachada SE, puerta parda' },
  no: { nombre: 'Servicio NO (dos hojas en el modelo)', W: 1.7, H: 2.54, piso: 0.7, hojas: 2, lugar: [[-4.15, -11.48], [-2.45, -11.41]], txt: 'Fachada NO, puerta parda' },
};
const MURO = 0.3, ESP = 0.04, CORTE_PLANTA = 1.0;

export const meta = { clave: 'puerta', n: 9, titulo: 'Puerta parda hacia afuera' };

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const raiz = new THREE.Group();
  let cual = 'so', m = 0, P = null;

  function armar() {
    vaciar(raiz);
    const d = PUERTAS[cual];
    const g = new THREE.Group();
    raiz.add(g);
    // x a lo largo del muro (bisagra en 0), z hacia adentro (+), y desde el piso de la puerta
    // muro en corte a 1 m a los dos lados del vano: el poché se lee por el relleno
    g.add(cajaEntre(k, [-1.0, 0], [0, CORTE_PLANTA], [0, MURO], { poche: true }), cajaEntre(k, [d.W, d.W + 1.0], [0, CORTE_PLANTA], [0, MURO], { poche: true }));
    g.add(k.linea([new V(-1.0, CORTE_PLANTA, 0), new V(d.W + 1.0, CORTE_PLANTA, 0)], { discontinua: true, guion: 0.08, opacidad: 0.5 }));
    g.add(secundario(k.rotulo(`corte en planta a ${num(CORTE_PLANTA, 2)} m`, [-0.6, 0.15, -0.05])));   // sin certeza: se puede ocultar
    // suelo de afuera (galería) y papel adentro: el interior no está modelado
    const zF = -(d.hojas === 2 ? d.W / 2 : d.W) - 0.25;   // el suelo de afuera llega más allá del giro de la hoja
    g.add(k.linea([new V(-1.0, 0, zF), new V(d.W + 1.0, 0, zF), new V(d.W + 1.0, 0, 0), new V(-1.0, 0, 0)], { opacidad: 0.4 }));
    const papel = k.dibujar(new THREE.PlaneGeometry(d.W + 2.0, 1.9).rotateX(-Math.PI / 2).translate(d.W / 2, -0.002, MURO + 0.95), { papel: true });
    g.add(papel);
    g.add(k.rotulo(cual === 'so' ? 'El interior no está modelado · piso interior: cota sin resolver' : 'El interior no está modelado', [d.W / 2, 0.02, MURO + 1.55]));
    const PZ = 0; // la hoja del modelo está en la cara de afuera (6 cm de caja); abre hacia afuera, así que gira sobre su canto de afuera
    const yM = 0.94;
    // dos hojas (NO): cada una con su bisagra en su jamba, la de la derecha reflejada; las dos giran hacia −z, afuera.
    // Una hoja (SE y SO): la bisagra va en x = d.W, a la derecha de quien mira desde adentro, que es el lado SO en la SE
    // (x −13,75) y el lado NO en la SO (z −5,325); la hoja es la reflejada y la manija queda en el canto opuesto.
    const lista = d.hojas === 2
      ? [{ x: 0, w: d.W / 2, refl: false, tirador: true }, { x: d.W, w: d.W / 2, refl: true, tirador: false }]
      : [{ x: d.W, w: d.W, refl: true, tirador: true }];
    const hojas = lista.map((h) => {
      const marco = new THREE.Group();
      marco.position.x = h.x;
      if (h.refl) marco.scale.x = -1;
      g.add(marco);
      const w = h.w;
      // arco del giro en el suelo de afuera (planta): el cuarto de vuelta entero, fino, y lo barrido hasta ahora, en color de la pieza
      marco.add(k.linea(arcoPlanta(V, 0, 0.005, PZ, w, 0, -Math.PI / 2, 40), { opacidad: 0.55 }));
      marco.add(k.linea([new V(0, 0.005, PZ), new V(0, 0.005, PZ - w)], { opacidad: 0.55 }));
      const barrido = k.linea(arcoPlanta(V, 0, 0.01, PZ, w, 0, -0.0001, 40), { enfasis: true });
      marco.add(barrido);
      // la hoja: tablero de 4 cm con listones verticales (bordes y centro, INVENTARIO §4.21 b)
      const hoja = new THREE.Group();
      hoja.position.set(0, 0, PZ);
      hoja.add(cajaEntre(k, [0.01, w], [0, d.H], [0, ESP], { enfasis: true }));
      const listones = d.hojas === 2 ? [0.06, w - 0.04] : [0.06, w / 2, w - 0.05];
      for (const x of listones) hoja.add(cajaEntre(k, [x - 0.04, x + 0.04], [0.02, d.H - 0.02], [-0.02, 0], { enfasis: true }));
      // tirador y cerradura en el canto libre, principio del tipo (la manija del modelo de la SO está a 0,94 m sobre la galería)
      if (h.tirador) {
        hoja.add(cajaEntre(k, [w - 0.17, w - 0.05], [yM - 0.015, yM + 0.015], [ESP + 0.01, ESP + 0.06], { discontinua: true }));
        hoja.add(cajaEntre(k, [w - 0.14, w - 0.02], [yM - 0.1, yM + 0.1], [0.005, ESP - 0.005], { discontinua: true }));
        hoja.add(cajaEntre(k, [w - 0.17, w - 0.05], [yM - 0.015, yM + 0.015], [-0.07, -0.02], { discontinua: true }));
      }
      marco.add(hoja);
      // bisagras de pernio: nudillos alternos (unos del marco, otros de la hoja) y el pasador que los atraviesa
      const nudHoja = [];
      for (const yb of [0.22, d.H / 2, d.H - 0.25]) {
        for (let i = 0; i < 4; i++) {
          const y0 = yb - 0.06 + i * 0.03;
          if (i % 2) {                                    // nudillo de la hoja: gira con ella alrededor del pasador
            const q = new THREE.Group();
            q.position.set(0, 0, PZ);
            q.add(cilindro(k, 0.011, [0, y0, 0], [0, y0 + 0.028, 0], { discontinua: true }, 10));
            q.add(k.linea([new V(0, y0 + 0.014, 0), new V(0.035, y0 + 0.014, 0)], { enfasis: true }));
            marco.add(q);
            nudHoja.push(q);
          } else marco.add(cilindro(k, 0.011, [0, y0, PZ], [0, y0 + 0.028, PZ], { discontinua: true }, 10));
        }
        marco.add(k.linea([new V(0, yb - 0.08, PZ), new V(0, yb + 0.08, PZ)], { discontinua: true, guion: 0.015, enfasis: true }));
      }
      return { hoja, nudHoja, barrido, w };
    });
    const xBis = d.hojas === 2 ? 0 : d.W, xTir = d.hojas === 2 ? d.W / 2 : 0;
    g.add(k.rotulo('bisagra de pernio y pasador · del tipo', [xBis, d.H - 0.1, PZ - 0.05], true));
    if (d.ladoBisagra) g.add(k.rotulo(`bisagra · lado ${d.ladoBisagra}`, [xBis, d.H * 0.45, PZ - 0.05]));
    g.add(k.rotulo('tirador y cerradura · del tipo', [xTir, yM + 0.25, 0.1]));
    if (d.hojas === 2) g.add(k.rotulo('dos hojas · modelo; una foto lejana lo apoya', [d.W / 2, d.H + 0.2, 0]));
    if (cual === 'se') g.add(k.rotulo('una hoja · foto; ancho real: no se sabe', [d.W / 2, d.H + 0.2, 0]));
    g.add(k.rotulo('afuera', [-0.6, 0.05, -0.5]));
    g.add(k.rotulo('adentro', [d.W + 0.6, 0.05, MURO + 0.5]));
    g.position.set(-d.W / 2, -d.H / 3, -0.1);
    P = { d, hojas, PZ };
  }

  function pintar() {
    const th = (Math.PI / 2) * m;
    for (const h of P.hojas) {
      h.hoja.rotation.y = th;           // +x gira hacia −z: hacia afuera
      h.nudHoja.forEach((q) => (q.rotation.y = th));
      mover(h.barrido, arcoPlanta(V, 0, 0.01, P.PZ, h.w, 0, -Math.max(th, 0.0001), 40));
    }
  }

  armar();
  const o = {
    objeto: raiz,
    camara: { pos: [0.9, 4.6, 2.6], obj: [0, 0, 0.1] },
    get caja() { const d = PUERTAS[cual]; return [[-d.W / 2 - 1, -d.H / 3, -1.5], [d.W / 2 + 1, (2 * d.H) / 3, 1.4]]; },
    etiqueta: 'Abrir hacia afuera',
    escala: '1:20 · PUERTA EN PLANTA Y EN ALZADO',
    morfologia: 'Una hoja plana rigidizada con listones gira sobre un eje vertical. Si abre hacia afuera, los nudillos de las bisagras quedan del lado de afuera, y la hoja abierta ocupa el paso de afuera y queda a la lluvia.',
    rotulo: 'Que las puertas pardas abren hacia afuera lo informa el equipo del proyecto, sin foto; cuántas hojas tiene cada una no lo informa, y el número de hojas que se dibuja sale del modelo o de una foto. Bisagras, pasador, tirador y cerradura son el principio general del tipo, en trazo discontinuo; cuántas bisagras lleva y de qué tipo no se sabe. La hoja y su posición son del modelo.',
    sello: 'Abre hacia afuera: lo informa el equipo del proyecto, sin foto · herrajes: principio general del tipo',
    get certeza() {
      const c = [
        { que: 'La puerta parda', nivel: 'foto' },
        { que: 'Que abre hacia afuera', nivel: 'equipo' },
      ];
      if (cual === 'so') c.push({ que: 'Ancho y alto de la hoja', nivel: 'modelo' }, { que: 'Lado de la bisagra', nivel: 'modelo', nota: 'canto opuesto a la manija del modelo' });
      if (cual === 'se') c.push({ que: 'Una hoja y lado de la manija', nivel: 'foto', nota: 'el equipo no lo ha confirmado' }, { que: 'Ancho de la hoja', nivel: 'nosabe', nota: 'el modelo da 1,50 m; la foto la muestra más angosta' }, { que: 'Alto de la hoja', nivel: 'modelo' });
      if (cual === 'no') c.push({ que: 'Dos hojas', nivel: 'modelo', nota: 'una foto lejana lo apoya, no lo confirma; el equipo no lo ha confirmado' }, { que: 'Ancho y alto del vano', nivel: 'modelo' });
      c.push({ que: 'Bisagras de pernio, pasador, tirador y cerradura', nivel: 'general' });
      return c;
    },
    get ubicacion() { const d = PUERTAS[cual]; return { pieza: d.lugar, texto: d.txt }; },
    opciones: [{ id: 'puerta', nombre: 'Puerta', valores: Object.entries(PUERTAS).map(([id, d]) => ({ id, nombre: d.nombre })), inicial: cual }],
    elegir(id, valor) { if (id === 'puerta' && PUERTAS[valor]) { cual = valor; armar(); pintar(); } },
    inicial: 0.55,
    actualizar(v) {
      m = Math.min(1, Math.max(0, v));
      pintar();
      return m < 0.01 ? 'puerta cerrada' : 'la hoja gira hacia afuera; el pasador queda quieto y los nudillos de la hoja giran a su alrededor';
    },
    cifras() {
      const d = PUERTAS[cual];
      return [
        cual === 'no'
          ? { clave: 'Ancho del vano · cada hoja (radio del arco)', valor: `${num(d.W, 2)} · ${num(d.W / 2, 2)} m`, certeza: 'modelo', fuente: 'INVENTARIO §4.21 b' }
          : cual === 'se'
            ? { clave: 'Ancho de la hoja en el modelo (radio del arco)', valor: `${num(d.W, 2)} m`, certeza: 'nosabe', fuente: 'INVENTARIO §4.21 b; la foto la muestra más angosta' }
            : { clave: 'Ancho de la hoja (radio del arco)', valor: `${num(d.W, 2)} m`, certeza: 'modelo', fuente: 'INVENTARIO §4.21 c' },
        { clave: 'Alto de la hoja', valor: `${num(d.H, 2)} m`, certeza: 'modelo', fuente: 'INVENTARIO §4.21' },
        { clave: 'Giro en el dibujo', valor: `${num(90 * m)}°`, certeza: 'general', fuente: 'posición del control, no es una medida' },
      ];
    },
  };
  pintar();
  return o;
}
