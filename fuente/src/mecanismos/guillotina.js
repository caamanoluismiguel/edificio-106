// 10 · Ventana de guillotina. La hoja de abajo sube por su riel hasta el travesaño de arriba y se queda donde la sueltas.
// El principio es equilibrar el peso de la hoja; cómo lo hace el 106 no se sabe, así que el equilibrio va como variantes del
// tipo (fricción, resorte o balancín, contrapeso), todas en trazo discontinuo y ninguna marcada como la del 106.
//
// Medidas: manda datos/familias.json (familias.hoja_guillotina.ventanas: alto, ancho, tope, recorrido y piezas,
// sacados de la geometría de main). El anfitrión lo pasa en ctx.familias; si no lo pasa, se usan los mismos valores copiados
// aquí como respaldo y la cifra lo dice. Recorridos de main: 0,772 m (1,63), 0,747 m (1,58), 0,655 m (1,40).
//   1,63 m · planta baja SE, NO y NE (25 ventanas)   · 1,40 m · planta baja SO (7)
//   1,58 m · pisos 2 y 3 (79), ventanas inferidas, solo en detalle
// El recorrido no se escribe a mano en el margen: sale de `recorrido` (o de tope − travesaño del medio en el respaldo).
// Criterios: la hoja es el paño de abajo con su tramo del travesaño del medio, partido en el parteluz, que queda fijo.
// Lo informa el equipo del proyecto (13 oct 2026): sube una sola hoja, la de abajo; la de arriba queda fija. Las ventanas de
// dos columnas llevan dos hojas, una por columna (supuesto del tipo: dos guillotinas unidas por el parteluz, que se ve
// continuo de alto a alto en foto): el dibujo sube una y rotula la otra.
// De datos/familias.json solo se leen tope y recorrido (no depende de cómo se agrupen las hojas por ventana); el ancho y el
// lugar del ejemplo son los de la ventana entera.
// La hoja va 1,5 cm por delante del paño de arriba (los dos vidrios del modelo están en el mismo plano): supuesto del modelo.
import { num, vaciar, secundario, cajaEntre, mover, helice, puntosFlecha, arcoPlanta } from './comun.js';

const T = 0.036; // alto de los travesaños del modelo
// respaldo con los valores de datos/familias.json: tope = cara de abajo del travesaño de arriba
export const VANOS = {
  '1,63': { nombre: '1,63 m · planta baja SE, NO y NE', alto: 1.63, fachada: 'SE', piso: 1, tope: 3.372, rec: 0.772, ancho: 2.268, n: 25, lugar: [[-16.56, 11.4], [-14.32, 11.49]], txt: 'Fachada SE, planta baja · ejemplo' },
  '1,40': { nombre: '1,40 m · planta baja SO', alto: 1.4, fachada: 'SO', piso: 1, tope: 3.37, rec: 0.655, ancho: 2.05, n: 7, lugar: [[-22.75, 3.52], [-22.69, 5.57]], txt: 'Fachada SO, planta baja · ejemplo' },
  '1,58': { nombre: '1,58 m · pisos 2 y 3 (inferidas)', alto: 1.58, fachada: 'SE', piso: 2, tope: 7.122, rec: 0.747, ancho: 2.268, n: 79, lugar: [[-16.56, 11.4], [-14.32, 11.49]], txt: 'Fachada SE, piso 2 · ventana inferida' },
};
/** El vano con los datos de familias.json si el anfitrión los dio. */
function resolver(k, clave) {
  const b = VANOS[clave];
  const lista = k.familias?.familias?.hoja_guillotina?.ventanas;
  const cand = (lista ?? []).filter((w) => Math.abs(w.alto - b.alto) < 0.005 && w.fachada === b.fachada && w.piso === b.piso);
  const w = cand.sort((p, q) => Math.abs(p.ancho - b.ancho) - Math.abs(q.ancho - b.ancho))[0];
  const v = { ...b, xP: 0, unaColumna: false, hojaAncho: null, origen: 'respaldo copiado de datos/familias.json (el anfitrión no lo pasó)' };
  if (w) {
    Object.assign(v, { tope: w.tope, rec: w.recorrido, ancho: w.ancho, origen: 'datos/familias.json, hoja_guillotina' });
    const caja = (clave) => clave.split('|').slice(2).map((c) => c.split(',').map((n) => n / 100));
    const cajas = w.piezas.map(caja);
    v.lugar = [[Math.min(...cajas.map((c) => c[0][0])), Math.min(...cajas.map((c) => c[0][2]))], [Math.max(...cajas.map((c) => c[1][0])), Math.max(...cajas.map((c) => c[1][2]))]];
    // corte del travesaño del medio en el parteluz: {eje, en}; la hoja que sube es hojas[0] (su paño y su tramo de travesaño)
    v.unaColumna = !w.corte;
    if (w.corte && w.travesano) {
      // en el dibujo, +x es la derecha de quien mira desde afuera: +x en la SE y +z en la SO (en la NO sería −x)
      const i = w.corte.eje === 'x' ? 0 : 2, t = caja(w.travesano), centro = (t[0][i] + t[1][i]) / 2;
      v.xP = (b.fachada === 'NO' ? -1 : 1) * (w.corte.en - centro);
    }
    const h0 = w.hojas?.[0]?.tramo;
    if (h0) v.hojaAncho = Math.round(Math.abs(h0.hasta - h0.desde) * 1000 + 1e-9) / 1000;
  }
  v.y1 = v.tope + T; v.y0 = v.y1 - v.alto;
  v.arribaAbajo = v.tope; v.medioArriba = v.tope - v.rec;
  return v;
}
export const recorrido = (v) => v.rec;

const EQUILIBRIO = {
  friccion: 'Fricción: el roce del riel o de un burlete aguanta el peso de la hoja.',
  resorte: 'Resorte o balancín: un resorte dentro de la jamba tira de la hoja hacia arriba.',
  contrapeso: 'Contrapeso: una cuerda pasa por una polea y cuelga un peso igual al de la hoja dentro de la jamba.',
};

export const meta = { clave: 'guillotina', n: 10, titulo: 'Ventana de guillotina' };

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const raiz = new THREE.Group();
  let vano = '1,63', equilibrio = 'friccion', s = 0;
  let g = null, hoja = null, var3 = null, partes = null;

  function armar() {
    vaciar(raiz);
    g = new THREE.Group();
    raiz.add(g);
    const v = resolver(k, vano);
    const W = v.ancho, H = v.y1 - v.y0, R = recorrido(v);
    const y = (abs) => abs - v.y0; // alturas relativas al pie del marco
    const xL = -W / 2, xP = v.unaColumna ? W / 2 - 0.02 : v.xP, ZF = 0;  // jamba izquierda, parteluz (corte del travesaño), plano de los vidrios
    const P4 = 0.04, F = 0.09;          // perfiles de 4 × 9 cm (INVENTARIO §4.12)
    // muro alrededor, recortado, de 0,30 (contexto)
    g.add(cajaEntre(k, [xL - 0.14, xL], [-0.1, H + 0.1], [-0.2, 0.1], { poche: true }), cajaEntre(k, [W / 2, W / 2 + 0.14], [-0.1, H + 0.1], [-0.2, 0.1], { poche: true }));
    // marco fijo: jambas, parteluz, travesaño de abajo y de arriba (modelo)
    g.add(cajaEntre(k, [xL, xL + P4], [0, H], [-F / 2, F / 2]), cajaEntre(k, [W / 2 - P4, W / 2], [0, H], [-F / 2, F / 2]));
    if (!v.unaColumna) g.add(cajaEntre(k, [xP - P4 / 2, xP + P4 / 2], [0, H], [-F / 2, F / 2]));   // parteluz, solo si lo hay
    g.add(cajaEntre(k, [xL, W / 2], [0, T], [-F / 2, F / 2]), cajaEntre(k, [xL, W / 2], [y(v.arribaAbajo), y(v.arribaAbajo) + T], [-F / 2, F / 2]));
    // paño de arriba, fijo (lo informa el equipo del proyecto) y la hoja de la otra columna, con su tramo de travesaño, quieta en el dibujo
    const yMed0 = y(v.medioArriba) - T;
    const vid = (x0, x1, y0, y1, z, op) => { const m = k.dibujar(new THREE.PlaneGeometry(x1 - x0, y1 - y0), { vidrio: true, ...op }); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); return m; };
    g.add(vid(xL + P4, xP - P4 / 2, y(v.medioArriba), y(v.arribaAbajo), ZF));
    if (!v.unaColumna) {
      g.add(vid(xP + P4 / 2, W / 2 - P4, y(v.medioArriba), y(v.arribaAbajo), ZF));
      g.add(vid(xP + P4 / 2, W / 2 - P4, T, yMed0, ZF), cajaEntre(k, [xP + P4 / 2, W / 2 - P4], [yMed0, y(v.medioArriba)], [-0.03, 0.03]));
    }
    // la hoja que sube: vidrio de abajo con su travesaño, 1,5 cm por delante
    hoja = new THREE.Group();
    const AD = 0.015;
    hoja.add(vid(xL + P4, xP - P4 / 2, T, yMed0, ZF + AD, { enfasis: true }));
    hoja.add(cajaEntre(k, [xL + P4, xP - P4 / 2], [yMed0, y(v.medioArriba)], [-0.03 + AD, 0.03 + AD], { enfasis: true }));
    hoja.add(cajaEntre(k, [xL + P4, xP - P4 / 2], [T, T + 0.03], [-0.02 + AD, 0.02 + AD], { enfasis: true }));
    const rayH = [];
    for (let t = -1; t <= 1; t += 0.08) {                       // rayado de la hoja que se mueve, recortado al paño
      const a0 = xL + P4, a1 = xP - P4 / 2, b0 = T, b1 = yMed0, cx0 = (a0 + a1) / 2 + t * (a1 - a0);
      const p0 = [cx0 - (b1 - b0) / 2, b0], p1 = [cx0 + (b1 - b0) / 2, b1];
      const recorte = (p, q) => { // recorta el segmento a x en [a0, a1]
        const f = (x) => p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0]);
        const xa = Math.max(a0, p[0]), xb = Math.min(a1, q[0]);
        return xb > xa ? [[xa, f(xa)], [xb, f(xb)]] : null;
      };
      const r = recorte(p0, p1);
      if (r) rayH.push(new V(r[0][0], r[0][1], ZF + AD + 0.002), new V(r[1][0], r[1][1], ZF + AD + 0.002));
    }
    hoja.add(k.linea(rayH, { segmentos: true, enfasis: true, opacidad: 0.35 }));
    hoja.add(k.rotulo('hoja de abajo', [(xL + xP) / 2, yMed0 / 2, 0.12], true));
    g.add(hoja);
    // riel en las jambas (principio del tipo)
    for (const x of [xL + P4 + 0.004, xP - P4 / 2 - 0.004]) g.add(k.linea([new V(x, T, ZF + AD + 0.012), new V(x, y(v.arribaAbajo), ZF + AD + 0.012)], { discontinua: true, guion: 0.04 }));
    // tope: la hoja llega justo a la cara de abajo del travesaño de arriba
    g.add(k.linea([new V(xL, y(v.arribaAbajo), F / 2 + 0.02), new V(xP, y(v.arribaAbajo), F / 2 + 0.02)], { discontinua: true, guion: 0.03, opacidad: 0.8 }));
    g.add(k.rotulo('paño de arriba · fijo', [W / 4, (y(v.medioArriba) + y(v.arribaAbajo)) / 2, 0.08]));
    if (!v.unaColumna) g.add(k.rotulo('sube por separado · supuesto del tipo', [W / 4 + 0.08, yMed0 / 2 - 0.1, 0.08]));
    g.add(secundario(k.rotulo('tope del recorrido', [xL - 0.05, y(v.arribaAbajo) + 0.08, 0.1])));

    // equilibrio: las tres variantes del tipo, en la jamba izquierda, en trazo discontinuo
    const jx = xL - 0.06, ZM = 0.16; // bolsillo de la jamba, dibujado por delante del muro para que se lea
    var3 = { friccion: new THREE.Group(), resorte: new THREE.Group(), contrapeso: new THREE.Group() };
    Object.values(var3).forEach((q) => g.add(q));
    // fricción: burletes a lo largo del riel y el roce en los cantos de la hoja
    for (const x of [xL + P4 + 0.01, xP - P4 / 2 - 0.01]) var3.friccion.add(k.dibujar(new THREE.BoxGeometry(0.008, y(v.arribaAbajo) - T, 0.008).translate(x, (y(v.arribaAbajo) + T) / 2, ZF + AD + 0.02), { discontinua: true }));
    const roce = k.linea(new Array(24).fill(0).map(() => new V()), { segmentos: true, enfasis: true });
    var3.friccion.add(roce);
    // resorte: hélice entre el ancla de arriba de la jamba y la hoja
    const anclaArriba = y(v.arribaAbajo) + T;
    const resorte = k.linea(helice(V, jx, ZM, 0, 1, 0.012, 14), { discontinua: true, guion: 0.012, enfasis: true });
    var3.resorte.add(resorte);
    var3.resorte.add(k.dibujar(new THREE.CylinderGeometry(0.02, 0.02, anclaArriba - T, 10).translate(jx, (anclaArriba + T) / 2, ZM), { discontinua: true, vidrio: true }));
    // contrapeso: polea arriba, cuerda a la hoja y peso que baja lo que la hoja sube
    const polea = arcoPlanta(V, 0, 0, 0, 0.035, 0, Math.PI * 2, 24).map((p) => new V(jx + 0.03 + p.x, anclaArriba - 0.05 + p.z, ZM));
    var3.contrapeso.add(k.linea(polea, { discontinua: true, guion: 0.01 }));
    const cuerda = k.linea([new V(), new V(), new V(), new V()], { discontinua: true, guion: 0.03, enfasis: true });
    var3.contrapeso.add(cuerda);
    const peso = k.dibujar(new THREE.BoxGeometry(0.03, 0.22, 0.03), { discontinua: true, enfasis: true });
    var3.contrapeso.add(peso);
    var3.friccion.add(k.rotulo('burlete en el riel · del tipo', [xL - 0.1, y(v.arribaAbajo) - 0.12, ZM]));
    var3.resorte.add(k.rotulo('resorte en la jamba · del tipo', [jx - 0.1, anclaArriba - 0.12, ZM]));
    var3.contrapeso.add(k.rotulo('polea · del tipo', [jx - 0.1, anclaArriba - 0.02, ZM]));
    var3.contrapeso.add(k.rotulo('contrapeso · del tipo', [jx - 0.12, T + 0.08, ZM]));
    // fuerzas: el peso de la hoja hacia abajo y lo que lo equilibra hacia arriba
    const fPeso = k.linea(new Array(6).fill(0).map(() => new V()), { segmentos: true });
    const fEq = k.linea(new Array(6).fill(0).map(() => new V()), { segmentos: true, enfasis: true });
    g.add(fPeso, fEq);
    const rPeso = k.rotulo('peso de la hoja', [0, 0, 0]);
    const rEq = k.rotulo('lo equilibra', [0, 0, 0], true);
    g.add(rPeso, rEq);
    partes = { v, W, H, R, xL, xP, yMed0, jx, ZM, anclaArriba, roce, resorte, cuerda, peso, fPeso, fEq, rPeso, rEq, AD };
    g.position.y = -H / 2;
  }

  function pintar() {
    const p = partes;
    const sube = s * p.R;
    hoja.position.y = sube;
    Object.entries(var3).forEach(([n, q]) => (q.visible = n === equilibrio));
    const cx = (p.xL + p.xP) / 2, cy = p.yMed0 / 2 + sube;
    mover(p.fPeso, puntosFlecha(V, [cx, cy, 0.1], [cx, cy - 0.3, 0.1], 0.05));
    p.rPeso.position.set(cx - 0.12, cy - 0.32, 0.1);
    const yHoja = p.yMed0 + sube;           // canto de arriba de la hoja
    if (equilibrio === 'friccion') {
      const pts = [];
      for (const x of [p.xL + 0.05, p.xP - 0.03]) for (const yy of [T + sube + 0.12, yHoja - 0.12]) pts.push(...puntosFlecha(V, [x, yy - 0.07, 0.05], [x, yy + 0.07, 0.05], 0.03).slice(0, 6));
      mover(p.roce, pts);
      mover(p.fEq, puntosFlecha(V, [p.xL - 0.15, cy - 0.15, 0.05], [p.xL - 0.15, cy + 0.15, 0.05], 0.05));
    } else if (equilibrio === 'resorte') {
      const y0 = T + sube + 0.02;
      const n = helice(V, p.jx, p.ZM, y0, p.anclaArriba, 0.012, 14);
      mover(p.resorte, n);
      mover(p.fEq, puntosFlecha(V, [p.jx - 0.08, y0, p.ZM], [p.jx - 0.08, y0 + 0.3, p.ZM], 0.05));
    } else {
      const px = p.jx + 0.03, py = p.anclaArriba - 0.05;
      const yPeso = p.anclaArriba - 0.35 - sube;                         // baja lo que la hoja sube
      mover(p.cuerda, [new V(p.xL + 0.05, yHoja, 0.03), new V(px - 0.035, py, p.ZM), new V(px + 0.035, py, p.ZM), new V(px + 0.035, yPeso + 0.11, p.ZM)]);
      p.peso.position.set(px + 0.035, yPeso, p.ZM);
      mover(p.fEq, puntosFlecha(V, [px - 0.1, yPeso + 0.15, p.ZM], [px - 0.1, yPeso - 0.15, p.ZM], 0.05));
    }
    p.rEq.position.set(p.xL - 0.2, cy + 0.22, 0.05);
  }

  armar();
  const o = {
    objeto: raiz,
    camara: { pos: [-1.0, 0.35, 2.4], obj: [-0.2, 0, 0] },
    etiqueta: 'Subir la hoja',
    escala: '1:10 · VENTANA DE GUILLOTINA',
    morfologia: 'La hoja se desliza en su propio plano: no ocupa espacio hacia adentro ni hacia afuera y no choca con el alero. Para que se quede donde la sueltas, algo tiene que equilibrar su peso.',
    rotulo: 'Que las ventanas suben deslizándose lo informa el equipo del proyecto, sin foto. Cómo se equilibra, el riel y los sellos: principio general del tipo, en trazo discontinuo. Que sube solo la hoja de abajo y la de arriba queda fija también lo informa el equipo. Las ventanas de dos columnas llevan una hoja por columna, que sube por separado: supuesto del tipo, dos guillotinas unidas por el parteluz, que en foto se ve continuo de alto a alto. La hoja va 1,5 cm por delante del paño de arriba: supuesto del modelo.',
    sello: 'Sube la hoja de abajo: lo informa el equipo del proyecto, sin foto · el equilibrio es una variante del tipo, no la del 106',
    certeza: [
      { que: 'Ventana de aluminio con paños', nivel: 'foto' },
      { que: 'Que sube la hoja de abajo y la de arriba queda fija', nivel: 'equipo' },
      { que: 'Una hoja por columna en las ventanas de dos columnas', nivel: 'general', nota: 'supuesto del tipo: dos guillotinas unidas por el parteluz, que en foto se ve continuo' },
      { que: 'Alto del vano y recorrido', nivel: 'modelo' },
      { que: 'Equilibrio, riel, burletes y sellos', nivel: 'general' },
      { que: 'Hoja adelantada 1,5 cm', nivel: 'modelo', nota: 'supuesto del modelo' },
    ],
    get ubicacion() { const v = resolver(k, vano); return { pieza: v.lugar, texto: v.txt }; },
    opciones: [
      { id: 'vano', nombre: 'Vano', valores: Object.entries(VANOS).map(([id, v]) => ({ id, nombre: v.nombre })), inicial: vano },
      { id: 'equilibrio', nombre: 'Equilibrio (variantes del tipo)', valores: [{ id: 'friccion', nombre: 'Fricción' }, { id: 'resorte', nombre: 'Resorte o balancín' }, { id: 'contrapeso', nombre: 'Contrapeso' }], inicial: equilibrio },
    ],
    elegir(id, valor) {
      if (id === 'vano' && VANOS[valor]) { vano = valor; armar(); }
      if (id === 'equilibrio' && EQUILIBRIO[valor]) equilibrio = valor;
      pintar();
    },
    inicial: 0.6,
    actualizar(m) {
      s = Math.min(1, Math.max(0, m));
      pintar();
      return [s < 0.01 ? 'hoja cerrada' : s > 0.99 ? 'hoja arriba: tope en el travesaño de arriba' : 'la hoja se queda donde la sueltas', EQUILIBRIO[equilibrio]];
    },
    cifras() {
      const v = resolver(k, vano), R = recorrido(v);
      const c = [
        { clave: 'Alto del vano', valor: `${num(v.alto, 2)} m`, certeza: 'modelo', fuente: v.origen },
        { clave: 'Ancho de la ventana del ejemplo', valor: `${num(v.ancho, 2)} m`, certeza: 'modelo', fuente: v.origen },
        { clave: 'Recorrido máximo de la hoja', valor: `${num(R, 2)} m`, certeza: 'modelo', fuente: v.origen },
        ...(v.hojaAncho ? [{ clave: 'Ancho de la hoja (su tramo de travesaño)', valor: `${num(Math.round(Math.round(v.hojaAncho * 1000) / 10) / 100, 2)} m`, certeza: 'modelo', fuente: 'datos/familias.json, hoja_guillotina, corte en el parteluz' }] : []),
        { clave: 'La hoja subió', valor: `${num(s * R, 2)} m`, certeza: 'modelo', fuente: 'posición del control sobre el recorrido del modelo' },
        { clave: 'Vanos como este', valor: String(v.n), certeza: 'modelo', fuente: 'conteo de alféizares del modelo: 113 ventanas, 2 sin travesaño del medio' },
      ];
      if (vano === '1,58') c.push({ clave: 'Ventana', valor: 'inferida (pisos 2 y 3)', certeza: 'modelo', fuente: 'README del 106; INVENTARIO §4.12' });
      return c;
    },
  };
  pintar();
  return o;
}
