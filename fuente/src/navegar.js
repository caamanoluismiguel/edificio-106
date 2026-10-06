// Navegación libre por Ciudad del Saber (rama feat/navegacion-libre; decisiones en
// ~/projects/edificio-106-ciudad-revision/navegacion/PANEL.md). Aquí va lo que no depende de la interfaz:
//   · el mapa liviano (datos/ciudad_mapa.json, de fuente/ciudad-mapa.mjs): el límite propuesto de la ciudad (no oficial), el suelo
//     de la escena en una rejilla de 40 m y la huella de cada edificio con su número, su tipo, su clase de certeza y cómo se dibuja;
//   · el suelo bajo un punto, el borde del límite, el rayo que elige un edificio (o un punto del suelo) y la prueba de la cámara
//     dentro de un edificio;
//   · cómo buscar el edificio de ?edificio=N y los textos de su ficha (datos/ciudad_fichas.json, de fuente/ciudad-fichas.mjs). Las
//     alturas del mapa son aproximadas y no se muestran; la ficha da la de Open Buildings.
// main.js decide cuándo se usa cada cosa. Nada de esto corre hasta que la persona mueve la escena.

/** Distancia (m, en planta) entre el punto que se mira y el centro del 106 desde la que se está «lejos»: la mitad del lado de la
 *  caja de la sombra fina (±70 m en el marco del sol, centrada en el origen, escena.js). Sobre el suelo esa caja llega a 70 m de
 *  lado y a 70 m / sen(altura del sol) en la dirección del sol: más allá de 70 m la sombra puede venir del mapa grueso. Se vuelve a
 *  «cerca» a CERCA m, para que el botón no parpadee en el borde. */
export const LEJOS = 70, CERCA = 60;
/** Lo más que el punto que se mira puede salir del límite mientras se arrastra (m); al soltar vuelve al borde. El agua del canal
 *  más cercana queda a 61 m del límite (contexto, OSM 2314149): con 40 m nunca se llega a ella. */
export const BORDE_BLANDO = 40;

// los tipos del kit, con las palabras de docs/ciudad/CIUDAD.md (sin fechas: el tipo se asigna por lo observado y la huella)
export const TIPOS = {
  cuartel3: 'cuartel de tres pisos', cuartel4: 'cuartel de cuatro niveles', duplex: 'dúplex', oficiales41: 'casa de oficiales',
  pabellon1: 'pabellón de un piso', nco49: 'casa tipo NCO', colonels: 'casa elevada de Colonels’ Row', area900: 'casa del área 900',
  crance: 'bloque de la calle Gonzalo Crance', bloque2_bonilla: 'bloque de la calle Luis Bonilla', nave: 'nave', abierto: 'kiosco o galera',
  moderno: 'edificio contemporáneo', torre: 'torre',
};
// las clases con las palabras de la leyenda de certeza (ciudad.js, ?certeza=1) y de CIUDAD.md; la II, sola, porque la ficha muestra
// una clase a la vez
export const CLASES = {
  I: ['confirmado', 'pisos, forma y material del techo, muros y mediaguas vistos en Street View con confianza alta o media'],
  II: ['probable', 'se ve el tipo, pero falta alguno de los datos de la clase I (pisos, techo, muros o mediaguas) o la vista deja dudas'],
  III: ['supuesto', 'casi nada se ve en las fotos o es conjetura'],   // la ficha agrega «y el tipo es supuesto» solo si tiene tipo
};

const dentroPoli = (P, x, z) => { let c = false; for (let i = 0, k = P.length - 1; i < P.length; k = i++) { const [xi, zi] = P[i], [xk, zk] = P[k]; if ((zi > z) !== (zk > z) && x < (xk - xi) * (z - zi) / (zk - zi) + xi) c = !c; } return c; };

export class Mapa {
  constructor(j) {
    this.limite = j.limite; this.S = j.suelo;
    this.edificios = j.edificios.map((e) => {
      const xs = e.p.map((p) => p[0]), zs = e.p.map((p) => p[1]);
      const caja = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
      return { ...e, caja, y1: e.y0 + e.h, cx: (caja[0] + caja[1]) / 2, cz: (caja[2] + caja[3]) / 2 };
    });
    this.e106 = this.edificios.find((e) => e.n === '106') ?? null;
  }

  /** El suelo de la escena bajo (x, z): el sitio del 106 (plano) o la rejilla de 40 m con el mismo corte en triángulos que
   *  suelo() de ciudad-datos.mjs (fuera de la rejilla, su borde). */
  suelo(x, z) {
    const S = this.S, s = S.sitio; if (s && Math.abs(x) <= s.x && Math.abs(z) <= s.z) return s.y;
    const U = Math.min(S.nx - 1.000001, Math.max(0, (x - S.x0) / S.paso)), W = Math.min(S.nz - 1.000001, Math.max(0, (z - S.z0) / S.paso));
    const i = Math.floor(U), k = Math.floor(W), u = U - i, w = W - k, Y = (a, b) => S.y[(k + b) * S.nx + i + a];
    const Ya = Y(0, 0), Yb = Y(0, 1), Yc = Y(1, 1), Yd = Y(1, 0);
    return w >= u ? Ya + u * (Yc - Yb) + w * (Yb - Ya) : Ya + u * (Yd - Ya) + w * (Yc - Yd);
  }

  dentro(x, z) { return dentroPoli(this.limite, x, z); }

  /** El punto del borde del límite más cercano a (x, z) y la distancia (0 si está dentro). */
  borde(x, z) {
    if (this.dentro(x, z)) return { x, z, d: 0 };
    const L = this.limite; let mejor = null;
    for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length], dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
      const px = a[0] + t * dx, pz = a[1] + t * dz, d = Math.hypot(x - px, z - pz);
      if (!mejor || d < mejor.d) mejor = { x: px, z: pz, d };
    }
    return mejor;
  }

  /** El edificio cuya caja (huella × altura, más `m` m) contiene el punto, sin contar el 106 (al 106 se le puede entrar por la
   *  ventana a mirar los interiores, como siempre). */
  dentroDe(p, m = 1.5) {
    for (const e of this.edificios) {
      if (e === this.e106 || p.y > e.y1 + m || p.y < e.y0 - 5) continue;
      const c = e.caja; if (p.x < c[0] - m || p.x > c[1] + m || p.z < c[2] - m || p.z > c[3] + m) continue;
      if (dentroPoli(e.p, p.x, p.z) || e.p.some((a, i) => { const b = e.p[(i + 1) % e.p.length], dx = b[0] - a[0], dz = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p.x - a[0] - t * dx, p.z - a[1] - t * dz) < m; })) return e;
    }
    return null;
  }

  /** Lo primero que toca un rayo (o = origen, d = dirección unitaria; objetos con x, y, z): un edificio (su prisma: huella por
   *  altura) o el suelo. { tipo: 'edificio', e, t, p } · { tipo: 'suelo', t, p } · null. */
  rayo(o, d, tMax = 6000) {
    let mejor = null;
    for (const e of this.edificios) {
      const t = this.#prisma(e, o, d);
      if (t != null && t < tMax && (!mejor || t < mejor.t)) mejor = { tipo: 'edificio', e, t };
    }
    // el suelo: pasos de 4 m hasta cruzarlo y después bisección (solo si el rayo baja)
    if (d.y < 0) {
      let a = 0, y0 = o.y - this.suelo(o.x, o.z), fin = Math.min(tMax, mejor?.t ?? tMax);
      for (let t = 4; t <= fin; t += 4) {
        const y = o.y + d.y * t - this.suelo(o.x + d.x * t, o.z + d.z * t);
        if (y <= 0 && y0 > 0) {
          let lo = a, hi = t;
          for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (o.y + d.y * m - this.suelo(o.x + d.x * m, o.z + d.z * m) > 0) lo = m; else hi = m; }
          if (!mejor || hi < mejor.t) mejor = { tipo: 'suelo', t: hi };
          break;
        }
        a = t; y0 = y;
      }
    }
    if (mejor) mejor.p = { x: o.x + d.x * mejor.t, y: o.y + d.y * mejor.t, z: o.z + d.z * mejor.t };
    return mejor;
  }

  /** Primer cruce del rayo con el prisma del edificio (techo plano a y1, muros de y0 a y1), o null. */
  #prisma(e, o, d) {
    const c = e.caja, ys = [e.y0, e.y1];
    // caja alineada primero (descarta casi todos)
    let t0 = 0, t1 = Infinity;
    for (const [oo, dd, lo, hi] of [[o.x, d.x, c[0], c[1]], [o.y, d.y, ys[0], ys[1]], [o.z, d.z, c[2], c[3]]]) {
      if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return null; continue; }
      let a = (lo - oo) / dd, b = (hi - oo) / dd; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return null;
    }
    let mejor = null;
    if (d.y < 0) { const t = (e.y1 - o.y) / d.y; if (t > 0 && dentroPoli(e.p, o.x + d.x * t, o.z + d.z * t)) mejor = t; }
    for (let i = 0; i < e.p.length; i++) {
      const a = e.p[i], b = e.p[(i + 1) % e.p.length], ex = b[0] - a[0], ez = b[1] - a[1];
      const den = d.x * ez - d.z * ex; if (Math.abs(den) < 1e-12) continue;
      const t = ((a[0] - o.x) * ez - (a[1] - o.z) * ex) / den, s = ((a[0] - o.x) * d.z - (a[1] - o.z) * d.x) / den;
      if (t <= 0 || s < 0 || s > 1) continue;
      const y = o.y + d.y * t; if (y < e.y0 || y > e.y1) continue;
      if (mejor == null || t < mejor) mejor = t;
    }
    return mejor;
  }
}

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// números con coma decimal y punto de miles (como num() de main.js)
const nf = (x) => { const [a, b] = String(x).split('.'); return a.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (b ? ',' + b : ''); };
const norm = (s) => String(s ?? '').replace(/\s+/g, '').toUpperCase();

/** El edificio de ?edificio=<q> (null si no está). Por número, sin espacios y sin distinguir mayúsculas: el 332B lleva al 332A, que lo
 *  dibuja; si el número se repite (el 140 y el 246 en OpenStreetMap), el de menor id de OSM. Con «osm» delante, por id de OSM
 *  (?edificio=osm678917549): así se nombran los que no tienen número o lo repiten. `F`: datos/ciudad_fichas.json. */
export function buscarEdificio(mapa, F, q) {
  const k = norm(q); if (!k || !mapa) return null;
  const osm = /^OSM(\d+)$/.exec(k);
  if (osm) return mapa.edificios.find((e) => e.o === Number(osm[1])) ?? null;
  const otra = Object.entries(F?.edificios ?? {}).find(([, f]) => f.une && norm(f.une) === k);
  if (otra) return mapa.edificios.find((e) => e.o === Number(otra[0])) ?? null;
  return mapa.edificios.filter((e) => e.n && norm(e.n) === k).sort((a, b) => a.o - b.o)[0] ?? null;
}
/** Cómo se nombra el edificio en un enlace: su número si es único; si no tiene o se repite, «osm» y su id. */
export const idEnlace = (e, F) => (e.n && !F?.edificios?.[e.o]?.rep ? e.n : 'osm' + e.o);

/** La frase de la copa en la ficha del 106, con las cifras de datos/copa.json (fuente/copa.py): copa de 3 m o más en el suelo
 *  sin edificios, dentro del límite propuesto y a 100 m del 106, con su procedencia. */
export function fraseCopa(C) {
  const pc = (x) => Math.round(100 * x), [a, m] = C.chm.imagenes_fecha.split('-').map(Number);
  return `Estimación de la copa de árbol de ${nf(C.umbral_m)}\u00a0m o más sobre el suelo sin edificios: ${pc(C.distrito.copa_suelo_libre)}\u00a0% dentro del límite del distrito `
    + `y ${pc(C.edificio_106.copa_suelo_libre_por_radio_m['100'])}\u00a0% a 100\u00a0m del 106. Sale del mapa de altura de copa de Meta y WRI, hecho con imágenes `
    + `${C.chm.imagenes} de ${MES_LARGO[m - 1]} de ${a}, cuyo error medio en la altura es de ${nf(C.chm.error_absoluto_medio_altura_m)}\u00a0m según sus autores `
    + `(Tolan et al., 2024), en una validación hecha en ${C.chm.validacion_paises}, no en Panamá. El límite del distrito es una propuesta del visor y no el oficial de la Fundación Ciudad del Saber.`;
}
const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** La ficha de un edificio (al tocarlo o con ?edificio=N), de datos/ciudad_fichas.json (fuente/ciudad-fichas.mjs). `ciudad`: si la
 *  capa de la ciudad está marcada (si no, en su lugar está el contexto de siempre). Devuelve el título, una línea bajo él, las filas
 *  [título, texto] y las notas; los textos de CERL y la tabla de años vienen hechos del generador. `C`: datos/copa.json (la frase
 *  de la copa del 106; sin él, la ficha del 106 sale sin esa frase). */
export function ficha(e, F, ciudad, C) {
  if (e.n === '106') return { titulo: 'Edificio 106', es106: true, filas: [],
    lineas: ['Es el único edificio medido del visor. Sol en fachadas, Lluvia en fachadas, Viento, Sombras del día, Partes y medidas y Confort lo analizan a él.',
      'En el inventario de la ciudad es de clase I de certeza, pero a diferencia de los demás no se arma con el kit: está medido y tiene modelo propio. Cómo se hizo y qué no hace está en «Acerca del modelo».',
      ...(C ? [fraseCopa(C)] : [])] };
  const f = F?.edificios?.[e.o] ?? {}, T = f.t ? F?.tipos?.[f.t] : null, G = T && f.g != null ? T.grupos[f.g] : null;
  const titulo = e.n ? `Edificio ${e.n}${f.une ? ' y ' + f.une : ''}` : f.nom ?? 'Edificio sin número';
  const sub = e.n ? f.nom ?? null : f.nom ? 'Sin número en OpenStreetMap' : null;
  const filas = [];
  // tipo, origen y año (siempre el del tipo)
  if (f.t) {
    const tipo = TIPOS[f.t] ?? f.t, partes = [tipo[0].toUpperCase() + tipo.slice(1) + '.'];
    if (G) partes.push(`Por número: ${G.txt.replace('{n}', e.n)}. CERL no relaciona la numeración del Ejército con la de Ciudad del Saber.`);
    else partes.push(`Por forma: se asignó por lo que se ve en las fotos y por la forma y el tamaño de la huella${e.n && T?.grupos.length ? '; su número no está en la lista de CERL de este tipo' : ''}.`);
    const anios = G?.anios ?? T?.anios; if (anios) partes.push(anios);
    filas.push(['Tipo', partes.join(' ')]);
  } else filas.push(['Tipo', 'No tiene un tipo del kit.']);
  // pisos vistos en las fotos y altura de Open Buildings
  const p = f.p;
  if (p) filas.push(['Pisos', p.v ? `«${p.v}» en ${p.f}, con confianza ${p.k}.` : /Street View/.test(p.f) ? `No se ven en las fotos (${p.f}).` : `No se ven: ${p.f}.`]);
  const ob = f.ob;
  const OB = 'Google Open Buildings 2.5D (2023, usada con ODbL)';
  filas.push(['Altura', !ob ? `${OB} no la tiene.` : ob[1] >= 0.6 ? `Unos ${nf(ob[0])} m según ${OB}, estimada desde satélite.`
    : ob[1] > 0 ? `${OB} ve edificio solo en el ${Math.round(ob[1] * 100)} % de la huella: aquí su altura no sirve.` : `${OB} no ve edificio en esta huella.`]);
  // certeza y lo supuesto
  const [nom, txt] = CLASES[f.c ?? e.c] ?? CLASES.III;
  filas.push(['Certeza', `${f.c ?? e.c}, ${nom}: ${txt}${(f.c ?? e.c) === 'III' && f.t ? ', y el tipo es supuesto' : ''}. ` + (f.s ? `${f.s[0]} de sus ${f.s[1]} parámetros del kit tienen alguna parte supuesta.` : 'No se arma con el kit, así que no tiene parámetros que contar.')]);
  // cómo se dibuja
  let como;
  if (e.m === 'kit') como = ciudad ? 'Con el kit de piezas, sobre la huella de OpenStreetMap.' : e.k ? 'Con el kit de piezas; con la ciudad apagada, en su lugar se ve una copia del 106.' : 'Con el kit de piezas; con la ciudad apagada, en su lugar se ve un volumen simple.';
  else if (e.m === 'cuartel106') como = 'Repite el volumen del 106.';
  else if (e.m === 'a mano') como = 'Es un volumen hecho a mano.';
  else como = `Es una caja gris con la altura estimada: ${f.t ? 'el kit todavía no arma su forma' : 'su tipo no está en el kit'}.`;
  if (f.une) como += ` OpenStreetMap lo parte en dos huellas, ${e.n} y ${f.une}: es un solo dúplex y se dibuja una vez, como uno de los 38 del kit.`;
  filas.push(['Cómo se dibuja', como]);
  const notas = [];
  if (f.nota) notas.push(f.nota);
  if (f.rep) notas.push(`Hay ${f.rep} edificios con el número ${e.n} en OpenStreetMap: el enlace de este usa su id de OSM.`);
  const b = (F?.osm_base ?? '').split('-').map(Number);
  const base = b.length === 3 ? `${b[2]} ${MES[b[1] - 1]} ${b[0]}` : '';
  const sc = F?.supuestos_ciudad;
  return { titulo, sub, filas, notas, es106: false, base, cerl: !!T?.cerl,
    supuestosCiudad: sc ? `${nf(sc[0])} de ${nf(sc[1])} (${Math.round(100 * sc[0] / sc[1])} %)` : '' };
}
