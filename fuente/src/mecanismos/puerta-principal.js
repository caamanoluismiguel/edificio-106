// 11 · Puerta principal de vidrio. Gira hacia adentro (lo informa el equipo del proyecto, sin foto; las pardas, en cambio,
// abren hacia afuera). Bisagra o pivote en el piso: dos variantes del tipo hasta que haya foto.
// Del modelo (INVENTARIO §4.21 a; datos/familias.json, puerta_principal.hojas): 2 hojas de 0,94 × 2,00 m (1,14 a 3,14),
// x 11,82 a 12,76 y 12,84 a 13,78; montantes en 11,76, 12,80 y 13,84 (0,70 a 3,24); tiradores verticales de 0,46 m en x
// 12,59 y 13,61. Se dibuja en abanico: las dos hojas giran hacia adentro con las bisagras en las jambas (x 11,82 y 13,78) y
// los tiradores al centro (supuesto del tipo). En el modelo el tirador de la hoja este es una copia trasladada de la oeste,
// sin reflejar; aquí la hoja este es la oeste reflejada, y eso va en una nota.
import { cajaEntre, cilindro, arcoPlanta, mover } from './comun.js';
import { LUGARES } from './planta-106.js';

export const meta = { clave: 'principal', n: 11, titulo: 'Puerta principal de vidrio' };

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const g = new THREE.Group();
  const C = 12.8, W = 0.94, H = 2.0, PIV = 0.07;
  const xs = (x) => x - C;
  // marco: montantes y dintel del modelo; rellano y papel detrás
  for (const x of [11.76, 12.8, 13.84]) g.add(cajaEntre(k, [xs(x) - 0.03, xs(x) + 0.03], [-0.44, 2.1], [-0.05, 0.05]));
  g.add(cajaEntre(k, [xs(11.73), xs(13.87)], [2.04, 2.1], [-0.05, 0.05]));
  g.add(k.linea([new V(-1.4, -0.02, -0.6), new V(1.4, -0.02, -0.6), new V(1.4, -0.02, 0), new V(-1.4, -0.02, 0)], { opacidad: 0.5 }));
  g.add(k.dibujar(new THREE.PlaneGeometry(2.8, 1.4).rotateX(-Math.PI / 2).translate(0, -0.022, 0.75), { papel: true }));
  g.add(k.rotulo('El interior no está modelado', [0, 0, 1.2]));
  g.add(k.rotulo('rellano 1,12 m · piso interior sin resolver', [0, -0.02, -0.45]));
  const TIR = 12.59 - 11.82; // el tirador a 0,77 m de la bisagra, hacia el centro
  const hojas = [
    { x0: xs(11.82), refl: false },
    { x0: xs(13.78), refl: true },
  ].map(({ x0, refl }) => {
    const lado = new THREE.Group();             // la bisagra en 0; la hoja este es la oeste reflejada
    lado.position.x = x0;
    if (refl) lado.scale.x = -1;
    g.add(lado);
    const piv = new THREE.Group();
    const cont = new THREE.Group();
    piv.add(cont);
    const vid = k.dibujar(new THREE.PlaneGeometry(W, H), { vidrio: true, enfasis: true });
    vid.position.set(W / 2, H / 2, 0);
    cont.add(vid, cajaEntre(k, [0, W], [0, 0.03], [-0.012, 0.012], { enfasis: true }), cajaEntre(k, [0, W], [H - 0.03, H], [-0.012, 0.012], { enfasis: true }));
    cont.add(cilindro(k, 0.012, [TIR, 0.76, 0.05], [TIR, 1.22, 0.05], { enfasis: true }, 10));
    lado.add(piv);
    const arco = k.linea(arcoPlanta(V, 0, 0.004, 0, W, 0, Math.PI / 2, 32), { opacidad: 0.5 });
    lado.add(arco);
    const barrido = k.linea(arcoPlanta(V, 0, 0.008, 0, W, 0, 0.0001, 32), { enfasis: true });
    lado.add(barrido);
    // herrajes de las dos variantes
    const bis = new THREE.Group(), pivote = new THREE.Group();
    for (const y of [0.25, H - 0.3]) bis.add(cilindro(k, 0.012, [0, y - 0.06, 0], [0, y + 0.06, 0], { discontinua: true }, 10));
    pivote.add(k.linea([new V(PIV, -0.05, 0), new V(PIV, H + 0.05, 0)], { discontinua: true, guion: 0.05, enfasis: true }));
    for (const y of [0, H]) pivote.add(cilindro(k, 0.025, [PIV, y - 0.02, 0], [PIV, y + 0.02, 0], { discontinua: true }, 12));
    lado.add(bis, pivote);
    return { x0, piv, cont, arco, barrido, bis, pivote };
  });
  g.add(k.rotulo('en abanico desde las jambas · supuesto del tipo', [0, 2.35, 0], true));
  g.add(k.rotulo('tiradores de 0,46 m', [0.35, 1.0, 0.1]));
  let variante = 'bisagra', m = 0;
  const o = {
    objeto: g,
    camara: { pos: [1.3, 3.4, 3.6], obj: [0, 0.7, 0.4] },
    caja: [[-1.2, -0.45, -0.6], [1.2, 2.2, 1.1]],
    etiqueta: 'Abrir hacia adentro',
    escala: '1:25 · PUERTA PRINCIPAL SE',
    morfologia: 'Dos hojas de vidrio con tiradores verticales de 0,46 m. Con bisagras, el eje va en el canto; con pivote, unos centímetros adentro, y la hoja barre un arco más corto por detrás.',
    rotulo: 'La puerta de vidrio está en fotos del 106. Que abre hacia adentro lo informa el equipo del proyecto, sin foto. Bisagra o pivote en el piso no se sabe: son dos variantes del tipo. Que las dos hojas abran, en abanico desde las jambas y con los tiradores al centro, es un supuesto del tipo. Nota: en el modelo el tirador de la hoja este es una copia trasladada del de la oeste, sin reflejar; el dibujo lo refleja.',
    sello: 'Hacia adentro: lo informa el equipo del proyecto, sin foto · bisagra o pivote: variante del tipo',
    certeza: [
      { que: 'Puerta de vidrio tras el pórtico', nivel: 'foto' },
      { que: 'Que abre hacia adentro', nivel: 'equipo' },
      { que: 'Dos hojas', nivel: 'modelo' },
      { que: 'Lado de giro y que las dos hojas abran', nivel: 'general', nota: 'supuesto del tipo: abanico desde las jambas; en el modelo el tirador este es una copia sin reflejar' },
      { que: 'Bisagra o pivote', nivel: 'general' },
    ],
    ubicacion: { pieza: LUGARES.puerta_principal, texto: 'Entrada SE' },
    opciones: [{ id: 'eje', nombre: 'Eje (variantes del tipo)', valores: [{ id: 'bisagra', nombre: 'Bisagras en el canto' }, { id: 'pivote', nombre: 'Pivote en el piso' }], inicial: 'bisagra' }],
    elegir(id, v) { if (id === 'eje') variante = v; o.actualizar(m); },
    inicial: 0.5,
    actualizar(v) {
      m = Math.min(1, Math.max(0, v));
      const th = (Math.PI / 2) * m;
      const e = variante === 'pivote' ? PIV : 0;
      for (const h of hojas) {
        h.piv.position.set(e, 0, 0);   // en el grupo de su lado (la hoja este va reflejada)
        h.cont.position.set(-e, 0, 0);
        h.piv.rotation.y = -th; // hacia +z: adentro, también reflejada
        h.bis.position.x = 0; h.pivote.position.x = 0;
        h.bis.visible = variante === 'bisagra'; h.pivote.visible = variante === 'pivote';
        // arco que barre la esquina libre
        const R = W - e;
        h.arco.position.set(e, 0, 0); h.barrido.position.set(e, 0, 0);
        mover(h.arco, arcoPlanta(V, 0, 0.004, 0, R, 0, Math.PI / 2, 32));
        mover(h.barrido, arcoPlanta(V, 0, 0.008, 0, R, 0, Math.max(th, 0.0001), 32));
      }
      return m < 0.01 ? 'puerta cerrada' : variante === 'pivote' ? 'cada hoja gira sobre un pivote en el piso, unos centímetros adentro del canto' : 'cada hoja gira sobre bisagras en su canto';
    },
    cifras: () => [
      { clave: 'Hoja', valor: '0,94 × 2,00 m', certeza: 'modelo', fuente: 'INVENTARIO §4.21 a' },
      { clave: 'Tiradores', valor: '0,46 m, de 1,90 a 2,36', certeza: 'modelo', fuente: 'INVENTARIO §4.21 a' },
      { clave: 'Giro en el dibujo', valor: `${Math.round(90 * m)}°`, certeza: 'general', fuente: 'posición del control, no es una medida' },
    ],
  };
  return o;
}
