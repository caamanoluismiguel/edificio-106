// 1 · Teja canal y cobija. Portado de js/detalles.js de D.I.Visor.
// El despiece levanta una cobija y deja ver los dos canales y el solape. Si el anfitrión da ctx.llueve(), que responde
// { llueve, fuente: 'era5' | 'albrook' | 'pronostico' | 'mes' | 'aguacero' } con la regla de la escena del 106 (lluviaDibujada de main.js), sin
// lluvia las gotas no se dibujan y el camino del agua queda como línea. La frase entera la escribe este módulo (FRASE):
// nunca «llueve» ni «no hay lluvia» por un dato; ERA5 «da» y el parte de Albrook es de un aeropuerto a 4,1 km y vale solo con
// parte de observador. En el año típico ('mes') la lluvia es la del mes, no la de la hora, y la frase lo dice.
import { rad, cajaEntre, sobre } from './comun.js';
import { LUGARES } from './planta-106.js';

export const meta = { clave: 'teja', n: 1, titulo: 'Teja canal y cobija' };

// el umbral de la escena del 106 (umbralLluvia de clima.js; UMBRAL_TXT de main.js)
const UMBRAL = 'el umbral de la escena (1 mm en la hora de diciembre a marzo y 1,5 mm de abril a noviembre)';
const FRASE = {
  era5: (s) => (s ? `a esta hora ERA5 da lluvia en la celda, de unos 28 km, desde ${UMBRAL}` : `a esta hora ERA5 no da lluvia desde ${UMBRAL}: el camino del agua es el mismo`),
  pronostico: (s) => (s ? `a esta hora el pronóstico da lluvia en la celda desde ${UMBRAL}` : `a esta hora el pronóstico no da lluvia desde ${UMBRAL}: el camino del agua es el mismo`),
  // año típico: la escena dibuja lluvia cuando la lluvia del mes pasa un valor (main.js); no es un dato de la hora
  mes: (s) => (s ? 'año típico: lluvia del mes, no de esta hora' : 'año típico: el mes no da lluvia en la escena, no es un dato de esta hora'),
  albrook: (s) => (s ? 'el parte de Albrook, a 4,1 km, da lluvia a esta hora' : 'el parte de Albrook, a 4,1 km, no da lluvia a esta hora: el camino del agua es el mismo'),
  aguacero: () => 'capa «Aguacero»: lluvia de ejemplo, no un dato',
};
const SIN_FUENTE = (s) => (s ? null : 'a esta hora el dato no da lluvia: el camino del agua es el mismo');

export function crear(k) {
  const { THREE } = k;
  const V = THREE.Vector3;
  const g = new THREE.Group();
  const faldon = new THREE.Group();
  const PEND = rad(17.9); // mediagua del modelo (INVENTARIO §2)
  faldon.rotation.x = PEND; // +z local baja por el faldón
  g.add(faldon);
  // arco de cilindro por cuerda y flecha, eje a lo largo de z
  const arco = (cuerda, flecha, largoT, arriba) => {
    const r = (cuerda * cuerda / 4 + flecha * flecha) / (2 * flecha);
    const medio = Math.asin(cuerda / 2 / r);
    const geo = new THREE.CylinderGeometry(r, r, largoT, 18, 1, true, arriba ? Math.PI - medio : -medio, 2 * medio);
    geo.rotateX(Math.PI / 2);
    return { geo, r, medio };
  };
  // canal de 23,5 cm de paso, cobija de 13,5, 39 cm de largo, filas cada ~33 cm en planta (INVENTARIO §4.1)
  const FILAS = 4, AVANCE = 0.347, LT = 0.41, V0 = -0.75;
  faldon.add(cajaEntre(k, [-0.45, 0.45], [-0.02, 0], [-0.8, 0.8]));
  const canales = [-0.235, 0, 0.235], cobijas = [-0.1175, 0.1175];
  const ca = arco(0.235, 0.06, LT, false), co = arco(0.135, 0.04, LT, true);
  let levantada = null;
  for (let f = 0; f < FILAS; f++) {
    const v = V0 + LT / 2 + f * AVANCE;
    const alza = (FILAS - 1 - f) * 0.012; // la fila de arriba se monta sobre la de abajo
    for (const x of canales) {
      const t = k.dibujar(ca.geo, { umbral: 30 });
      t.position.set(x, ca.r + alza, v);
      faldon.add(t);
    }
    for (const x of cobijas) {
      const elegida = f === 1 && x > 0;
      const t = k.dibujar(co.geo, { umbral: 30, enfasis: elegida });
      t.position.set(x, 0.06 - co.r * Math.cos(co.medio) + alza, v);
      faldon.add(t);
      if (elegida) levantada = { t, y: t.position.y };
    }
  }
  // franjas de solape
  for (let f = 0; f < FILAS - 1; f++) {
    const v0 = V0 + (f + 1) * AVANCE, v1 = V0 + f * AVANCE + LT;
    const y = 0.075;
    faldon.add(k.linea([new V(-0.36, y, v0), new V(0.36, y, v0), new V(0.36, y, v1), new V(-0.36, y, v1)], { cerrada: true, opacidad: 0.8 }));
  }
  const vFin = V0 + (FILAS - 1) * AVANCE + LT;
  faldon.add(cajaEntre(k, [-0.45, 0.45], [-0.14, 0], [vFin, vFin + 0.1]));
  faldon.add(cajaEntre(k, [-0.035, 0.035], [-0.13, -0.02], [-0.8, 0.85]));
  // fijación: no se sabe (gancho, clavo o mortero); se marca el sitio donde iría, en trazo discontinuo
  const fij = levantada.t.position;
  faldon.add(k.linea([new V(fij.x, 0.0, fij.z - 0.15), new V(fij.x, 0.07, fij.z - 0.15)], { discontinua: true, guion: 0.01, enfasis: true }));
  g.updateMatrixWorld(true);
  // caminos del agua: cae en la cobija, resbala al canal y baja por los solapes
  const caminos = [[-0.1175, -0.235], [-0.1175, 0], [0.1175, 0], [0.1175, 0.235]].map(([xc, xk]) => {
    const loc = [];
    const vIni = V0 + 0.12;
    loc.push(new V(xc, 0.3, vIni), new V(xc, 0.06 + 0.04 + 0.036, vIni), new V(xk, 0.004 + 0.036, vIni + 0.05));
    for (let f = 0; f < FILAS; f++) {
      const alza = (FILAS - 1 - f) * 0.012 + 0.004;
      const vA = f === 0 ? vIni + 0.05 : V0 + f * AVANCE;
      const vB = f < FILAS - 1 ? V0 + (f + 1) * AVANCE : vFin;
      loc.push(new V(xk, alza, vA), new V(xk, alza, vB));
    }
    const mundo = loc.map((p) => faldon.localToWorld(p.clone()));
    const fin = mundo[mundo.length - 1];
    mundo.push(fin.clone().add(new V(0, -0.5, 0.04)));
    g.add(k.linea(mundo, { opacidad: 0.5 }));
    const gota = k.dibujar(new THREE.SphereGeometry(0.0075, 10, 8), { enfasis: true, umbral: 80 });
    g.add(gota);
    return { mundo, gota };
  });
  g.add(k.rotulo('solape', faldon.localToWorld(new V(0.42, 0.08, V0 + AVANCE + 0.03)).toArray(), true));
  g.add(k.rotulo('canal', faldon.localToWorld(new V(0.235, 0.02, vFin - 0.05)).toArray()));
  g.add(k.rotulo('cobija', faldon.localToWorld(new V(-0.1175, 0.12, V0 + 0.2)).toArray()));
  const rFij = k.rotulo('fijación · no se sabe', faldon.localToWorld(new V(fij.x + 0.1, 0.1, fij.z - 0.2)).toArray());
  g.add(rFij);
  let desp = 0;
  return {
    objeto: g,
    camara: { pos: [1.2, 1.1, 1.4], obj: [0, 0, 0.2] },
    etiqueta: 'Recorrido del agua',
    escala: '1:5 · TEJA DEL MODELO',
    morfologia: 'El canal es una curva abierta que recoge el agua y la cobija tapa la junta entre dos canales. Cada fila monta sobre la de abajo, así el agua pasa por encima del solape.',
    rotulo: 'Canal y cobija, en fotos del 106. Las medidas son las del modelo, escala ±12 %. El material (barro o concreto), el tamaño real y la fijación no se saben.',
    sello: 'Forma en foto · medidas del modelo · la fijación no se sabe',
    certeza: [
      { que: 'Teja curva de canal y cobija', nivel: 'foto' },
      { que: 'Solape de unos 6 cm y pendiente de 17,9°', nivel: 'modelo' },
      { que: 'Material y fijación', nivel: 'nosabe' },
      { que: 'Camino del agua', nivel: 'general' },
    ],
    ubicacion: { pieza: [[-24.39, 11.41], [24.36, 13.15]], texto: 'Mediagua SE · ejemplo' },
    inicial: 0.4,
    despiece(f) {
      desp = f;
      levantada.t.position.y = levantada.y + 0.18 * f;
      rFij.visible = f > 0.3;
    },
    actualizar(m) {
      const dato = typeof k.llueve === 'function' ? k.llueve() : null;
      const lluvia = dato == null ? true : typeof dato === 'object' ? dato.llueve : dato;
      const fuente = dato && typeof dato === 'object' ? dato.fuente : null;
      // 0 a 0,15 cae · 0,15 a 0,25 resbala · 0,25 a 0,85 baja por el canal · 0,85 a 1 cae del borde
      for (const c of caminos) {
        const p = c.mundo;
        let pos;
        if (m < 0.15) pos = new V().lerpVectors(p[0], p[1], m / 0.15);
        else if (m < 0.25) pos = new V().lerpVectors(p[1], p[2], (m - 0.15) / 0.1);
        else if (m < 0.85) pos = sobre(p.slice(2, p.length - 1), (m - 0.25) / 0.6, V);
        else pos = new V().lerpVectors(p[p.length - 2], p[p.length - 1], (m - 0.85) / 0.15);
        c.gota.position.copy(pos);
        c.gota.visible = lluvia !== false;
      }
      const t = m < 0.15 ? 'la gota cae sobre la cobija' : m < 0.25 ? 'resbala de la cobija al canal'
        : m < 0.85 ? 'baja por el canal y pasa por encima de cada solape' : 'sale por el borde del alero';
      const extra = [];
      if (dato != null) {
        const frase = FRASE[fuente] ? FRASE[fuente](lluvia !== false) : SIN_FUENTE(lluvia !== false);
        if (frase) extra.push(frase);
      }
      if (desp > 0.3) extra.push('cobija levantada: debajo, la junta entre dos canales');
      return [t, ...extra];
    },
    cifras: () => [
      { clave: 'Paso de canal y cobija', valor: '23,5 cm', certeza: 'modelo', fuente: 'INVENTARIO §4.1' },
      { clave: 'Solape entre filas', valor: 'unos 6 cm', certeza: 'modelo', fuente: 'INVENTARIO §4.1' },
      { clave: 'Pendiente de la mediagua', valor: '17,9°', certeza: 'modelo', fuente: 'INVENTARIO §2 (kit-medidas.json)' },
    ],
  };
}
