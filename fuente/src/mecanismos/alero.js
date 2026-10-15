// 7 · Alero como conjunto con el sol. Portado de detalles.js (D.I.Visor) con las tres correcciones del plan:
// 1) no tiene sol propio: el ángulo de perfil llega de afuera (ctx.perfil, que el 106 calcula con perfil() de cartasolar.js
//    y la fecha, la hora y la fachada); el ángulo libre queda solo como «Prueba un ángulo · sin fecha»;
// 2) es el corte del piso 2, el mismo CORTE de main.js, y lo rotula;
// 3) el muro mide 0,30 (INVENTARIO §1 y §4.4).
// La sombra se calcula con la misma fórmula de estadoCorte() de main.js (con F = 0), para que el margen, la carta solar
// y el corte den lo mismo.
import { num, rad, caja, cajaEntre, mover } from './comun.js';
import { LUGARES } from './planta-106.js';

/** El CORTE de main.js (piso 2) con el muro corregido a 0,30, y el vuelo de 1,65 m. */
export const CORTE = { alero: 7.4, losa: 3.74, esp: 0.2, vidAbajo: 5.62, vidArriba: 7.12, rehundido: 0.1, muro: 0.3 };
export const VUELO = 1.65;
const VIDRIO_TXT = { sombra: 'a la sombra', casiSombra: 'casi todo a la sombra', medias: 'a medias', casiSol: 'casi todo al sol', sol: 'al sol' };

/** estadoCorte de main.js para un ángulo de perfil dado (grados), sin faldón. */
export function sombraCorte(pf, L = VUELO, C = CORTE) {
  const t = Math.tan(rad(pf));
  const dw = L * t, dg = (L + C.rehundido) * t;
  const alto = C.vidArriba - C.vidAbajo, sup = C.alero - C.vidArriba;
  const frac = Math.min(1, Math.max(0, (dg - sup) / alto));
  const vidrio = frac >= 0.97 ? 'sombra' : frac >= 0.75 ? 'casiSombra' : frac > 0.25 ? 'medias' : frac > 0.03 ? 'casiSol' : 'sol';
  return { pf, t, dw, dg, frac, vidrio, hSombra: C.alero - dw, pisoEntero: C.alero - dw <= C.losa + C.esp };
}

export const meta = { clave: 'alero', n: 7, titulo: 'Alero con el sol' };

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const C = CORTE;
  const g = new THREE.Group();
  const X = [-0.6, 0.6];
  const fl = C.losa + C.esp;
  // muro de 0,30 con el hueco de la ventana; alero del piso 1 abajo, como en el corte del 106
  g.add(cajaEntre(k, X, [fl, C.vidAbajo - 0.04], [-C.muro, 0]), cajaEntre(k, X, [C.vidArriba + 0.04, 8.25], [-C.muro, 0]));
  g.add(cajaEntre(k, X, [C.losa, fl], [0, VUELO]));
  const vidrio = k.dibujar(new THREE.PlaneGeometry(1.2, C.vidArriba - C.vidAbajo), { vidrio: true });
  vidrio.position.set(0, (C.vidArriba + C.vidAbajo) / 2, -C.rehundido);
  g.add(vidrio);
  // marco (perfiles de 4 cm), alféizar de 0,05 × 0,34 y moldura de 5 × 6 cm (INVENTARIO §4.5, §4.6, §4.12)
  g.add(cajaEntre(k, X, [C.vidAbajo - 0.04, C.vidAbajo], [-0.14, -0.05]), cajaEntre(k, X, [C.vidArriba, C.vidArriba + 0.04], [-0.14, -0.05]));
  g.add(cajaEntre(k, X, [5.53, 5.58], [-0.1, 0.24]), cajaEntre(k, X, [5.46, 5.51], [0, 0.06]));
  // alero del piso 2 (INVENTARIO §4.2, §4.3, §4.15, §4.16): ménsula de 0,82 × 1,50, cabios de 7 × 11 cm, tablero a 17,9°,
  // tabla de frente con su canto inferior en CORTE.alero y faja contra el muro
  const al = [];
  const forma = new THREE.Shape([new THREE.Vector2(0, 6.67), new THREE.Vector2(0, 7.49), new THREE.Vector2(1.5, 7.49)]);
  const mg = new THREE.ExtrudeGeometry(forma, { depth: 0.26, bevelEnabled: false });
  mg.rotateY(-Math.PI / 2);
  mg.translate(0.13, 0, 0);
  al.push(k.dibujar(mg, { enfasis: true }));
  for (const x of [-0.325, 0.325]) al.push(caja(k, 0.07, 0.11, VUELO, x, 7.525, VUELO / 2, { enfasis: true }));
  const PEND = rad(17.9);
  const tab = caja(k, 1.2, 0.03, VUELO / Math.cos(PEND), 0, 7.45 + (Math.tan(PEND) * VUELO) / 2, VUELO / 2, { enfasis: true });
  tab.rotation.x = PEND;
  al.push(tab);
  al.push(cajaEntre(k, X, [C.alero, C.alero + 0.14], [VUELO - 0.1, VUELO], { enfasis: true }));
  al.push(cajaEntre(k, X, [7.91, 8.18], [0, 0.03]));
  al.forEach((p) => g.add(p));
  const ray = [];
  for (let x = -0.55; x <= 0.56; x += 0.1) ray.push(new V(x, 7.49, VUELO), new V(x, 7.49 + Math.tan(PEND) * VUELO, 0));
  g.add(k.linea(ray, { segmentos: true, opacidad: 0.5 }));
  // sombra sobre el vidrio: rayado en tinta, recortado al paño cada vez que cambia el ángulo
  const NR = 40;
  const sombra = k.linea(new Array(NR * 2 + 2).fill(0).map(() => new V()), { segmentos: true, opacidad: 0.7 });
  g.add(sombra);
  const rayarSombra = (bajo) => {
    const zs = -C.rehundido + 0.005, x0 = -0.6, x1 = 0.6, y0 = bajo, y1 = C.vidArriba, pts = [];
    for (let i = 0; i < NR; i++) {
      const c = x0 - y1 + ((i + 0.5) * (x1 - y0 - (x0 - y1))) / NR;            // rayas a 45°: x − y = c
      const xa = Math.max(x0, c + y0), xb = Math.min(x1, c + y1);
      if (xb > xa) pts.push(new V(xa, xa - c, zs), new V(xb, xb - c, zs));
      else pts.push(new V(0, y1, zs), new V(0, y1, zs));
    }
    pts.push(new V(x0, y0, zs), new V(x1, y0, zs));                           // el borde de la sombra
    mover(sombra, pts);
  };
  const P = new V(0, C.alero, VUELO);
  // rayos de sol: el único ámbar del dibujo
  const rayos = [0, 1, 2, 3, 4].map((i) => { const l = k.linea([new V(), new V()], { sol: true, opacidad: i === 0 ? 1 : 0.45 }); g.add(l); return l; });
  const marcaMuro = k.linea([new V(-0.62, 0, 0.005), new V(0.62, 0, 0.005)], { discontinua: true, guion: 0.05 });
  g.add(marcaMuro);
  g.add(k.rotulo('P · borde del alero', [0, 7.25, 1.95], true));
  g.add(k.rotulo('vidrio del piso 2', [0, 6.0, -0.12]));
  g.add(k.rotulo('muro 0,30', [-0.6, 4.6, -0.15]));

  let ultimo = null;
  const libre = (m) => 5 + 85 * m;
  return {
    objeto: g,
    camara: { pos: [3.4, 7.4, 4.4], obj: [0, 6.4, 0.5] },
    caja: [[-0.7, 5.3, -0.4], [0.7, 8.3, 1.8]],
    etiqueta: 'Prueba un ángulo · sin fecha',
    escala: '1:25 · CORTE DEL PISO 2',
    morfologia: 'Un vuelo horizontal tapa el vidrio del sol alto y deja pasar el bajo. Cuánto tapa depende solo del ángulo de perfil del sol sobre la fachada y del vuelo.',
    rotulo: 'Corte del piso 2, el mismo del 106. Geometría del modelo, escala ±12 %. El ángulo de perfil lo da el sol del 106 para la fecha, la hora y la fachada; sin fecha, el control es solo una prueba.',
    sello: 'Geometría del modelo · sol calculado',
    certeza: [
      { que: 'Alero, ménsula y cabios', nivel: 'foto' },
      { que: 'Vuelo de 1,65 m y alturas del corte', nivel: 'modelo' },
      { que: 'Ángulo de perfil', nivel: 'calculo', nota: 'sol.js (NOAA/Meeus) y perfil() de cartasolar.js' },
    ],
    ubicacion: { pieza: LUGARES.mensula_se, texto: 'Alero SE, piso 2 · ejemplo' },
    inicial: 0.5,
    /** m: control libre (solo si ctx.perfil no da un ángulo). ctx.perfil() → { grados: número | null, rotulo } | undefined */
    actualizar(m) {
      const dato = typeof k.perfil === 'function' ? k.perfil() : undefined;
      const conFecha = dato !== undefined;
      const a = conFecha ? dato.grados : libre(m);
      this.etiqueta = conFecha ? `Sol del 106 · ${dato.rotulo ?? ''}`.trim() : 'Prueba un ángulo · sin fecha';
      if (a == null) {
        rayos.forEach((l) => (l.visible = false));
        sombra.visible = false;
        marcaMuro.visible = false;
        ultimo = { pf: null, rotulo: dato?.rotulo };
        return dato?.motivo ?? 'el sol no incide en esta fachada a esta hora';
      }
      const E = sombraCorte(a);
      ultimo = { ...E, conFecha };
      const ar = rad(a);
      const d = new V(0, -Math.sin(ar), -Math.cos(ar));
      const perp = new V(0, -Math.cos(ar), Math.sin(ar));
      rayos.forEach((l, i) => {
        l.visible = true;
        const o = P.clone().addScaledVector(perp, i * 0.35);
        const t = (o.z + C.rehundido) / Math.cos(ar);
        const fin = o.clone().addScaledVector(d, t);
        if (fin.y < C.vidAbajo) fin.copy(o).addScaledVector(d, (o.y - C.vidAbajo) / Math.sin(ar));
        mover(l, [o.clone().addScaledVector(d, -2.2), fin]);
      });
      const bajo = Math.max(C.vidAbajo, C.alero - E.dg);
      sombra.visible = E.frac > 0.001;
      if (sombra.visible) rayarSombra(bajo);
      marcaMuro.visible = E.hSombra > fl;
      marcaMuro.position.y = Math.max(E.hSombra, fl);
      return `ángulo de perfil ${num(a, 1)}° · vidrio ${VIDRIO_TXT[E.vidrio]}`;
    },
    cifras() {
      if (!ultimo) return [];
      if (ultimo.pf == null) return [{ clave: 'Sol en la fachada', valor: 'no incide', certeza: 'calculo', fuente: 'sol.js' }];
      const origen = ultimo.conFecha ? 'perfil() de cartasolar.js con sol.js' : 'prueba sin fecha, no es un sol del 106';
      return [
        { clave: 'Ángulo de perfil', valor: `${num(ultimo.pf, 1)}°`, certeza: ultimo.conFecha ? 'calculo' : 'general', fuente: origen },
        { clave: 'La sombra baja en el muro hasta', valor: ultimo.pisoEntero ? 'todo el piso' : `${num(ultimo.hSombra, 2)} m`, certeza: 'modelo', fuente: 'estadoCorte de main.js, CORTE del piso 2' },
        { clave: 'Vidrio a la sombra', valor: `${num(ultimo.frac * 100)} %`, certeza: 'modelo', fuente: 'estadoCorte de main.js, CORTE del piso 2' },
      ];
    },
  };
}
