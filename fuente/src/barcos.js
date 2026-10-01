// Barcos ILUSTRATIVOS por el canal: no son la posición real de ningún barco. Siguen los dos ejes del canal por las esclusas
// de Miraflores (canal-rutas.js, de OSM), uno por vía, en sentidos contrarios, con la hora de la escena.
// Lo que sí sale de fuentes (Autoridad del Canal de Panamá, consultadas el 1 de octubre de 2026):
//  · buque Panamax según la ACP: hasta 294,13 m de eslora y 32,31 m de manga (OP Notice to Shipping N-1-2024, 1.p,
//    https://pancanal.com/wp-content/uploads/2021/08/N01-2024-Vessel-Requirements-AC.pdf); aquí, 290 × 32 m y uno de 225 m;
//  · ritmo: unos 25 tránsitos Panamax al día (ACP: 7.633 entre octubre de 2025 y julio de 2026) y 23 cupos de reserva diarios
//    en las esclusas Panamax desde el 15 de septiembre de 2026 (ADV-29-2026); aquí, uno cada dos horas en cada vía (24 al día);
//  · las dos vías de las esclusas pueden ir en sentidos contrarios a la vez (ACP, «Design of the locks»).
// Sin fuente primaria (estimados, solo para el dibujo): la altura sobre el agua (casco ~8 m, contenedores hasta ~24 m, puente
// ~35 m), la velocidad (5 nudos en los canales de acceso, ~0,8 nudos de promedio dentro de las esclusas, con la espera del
// llenado) y la mezcla de tipos (dos de cada tres, portacontenedores; el resto, un gasero como el de la foto del Holiday Inn).
// La altura del agua de cada punto de la ruta sale del Copernicus DEM GLO-30 (contexto.mjs): del nivel del mar al sur de
// Miraflores al del Lago Miraflores al norte; en las esclusas el barco sube o baja de forma pareja mientras las cruza.
import * as THREE from 'three/webgpu';
import { RUTAS_CANAL } from './canal-rutas.js';

const NUDO = 0.5144;                                  // m/s
const V_CANAL = 5 * NUDO, V_ESCLUSA = 0.8 * NUDO;
const Z_ESCLUSAS = [-670, 110];                       // las cámaras de Miraflores, en Z de la escena (entorno-osm.mjs)
const CADA = 120;                                     // min entre barcos en cada vía: 12 por vía, 24 al día entre las dos

function mulberry(a) { return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/** Tabla de la ruta: distancia y tiempo acumulados (s) en cada punto, con la velocidad de cada tramo. */
function tabla(r) {
  const d = [0], t = [0];
  for (let i = 1; i < r.length; i++) {
    const l = Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]), zm = (r[i][1] + r[i - 1][1]) / 2;
    const v = zm > Z_ESCLUSAS[0] && zm < Z_ESCLUSAS[1] ? V_ESCLUSA : V_CANAL;
    d.push(d[i - 1] + l); t.push(t[i - 1] + l / v);
  }
  return { r, d, t, T: t.at(-1) };
}

/** Geometría de un barco con colores por vértice, en metros, proa hacia +X, línea de agua en y = 0. */
function casco(tipo, semilla) {
  const rnd = mulberry(semilla), cajas = [];
  const caja = (x0, x1, y0, y1, w, c) => cajas.push({ x0, x1, y0, y1, w, c });
  const L = tipo === 'gas' ? 225 : 290, B = 32, F = tipo === 'gas' ? 9 : 8;
  const rojo = [0.42, 0.05, 0.03], oscuro = [0.06, 0.07, 0.09], blanco = [0.85, 0.85, 0.82];
  // casco: cuerpo y proa en tres escalones angostos (de lejos y con desenfoque se lee como una proa afilada)
  const colorCasco = tipo === 'gas' ? rojo : (rnd() < 0.5 ? oscuro : [0.10, 0.16, 0.25]);
  caja(-L / 2, L / 2 - 24, -3, F, B, colorCasco);
  caja(L / 2 - 24, L / 2 - 12, -3, F, B * 0.72, colorCasco);
  caja(L / 2 - 12, L / 2 - 4, -3, F + 1, B * 0.4, colorCasco);
  caja(L / 2 - 4, L / 2, -1, F + 1.5, B * 0.15, colorCasco);
  // puente y alojamiento a popa (gasero) o a un tercio de la popa (portacontenedores)
  const xp = tipo === 'gas' ? -L / 2 + 22 : -L / 2 + 70;
  caja(xp - 9, xp + 9, F, F + 22, B * 0.8, blanco);
  caja(xp - 9, xp + 9, F + 22, F + 24, B, blanco);                 // alerones del puente
  caja(xp - 22, xp - 14, F, F + 26, 6, tipo === 'gas' ? blanco : [0.15, 0.15, 0.17]);   // chimenea
  if (tipo === 'gas') {
    caja(-L / 2 + 34, L / 2 - 30, F, F + 3.5, B * 0.55, [0.8, 0.8, 0.78]);   // tubería y pasarela
    for (let x = -L / 2 + 50; x < L / 2 - 40; x += 34) caja(x - 13, x + 13, F, F + 6, B * 0.7, [0.75, 0.75, 0.72]);   // domos
  } else {
    // contenedores de 40 pies (12,2 × 2,44 × 2,6 m) en pilas de 13 de ancho, de 2 a 6 de alto, antes y después del puente
    const COL = [[0.55, 0.12, 0.08], [0.12, 0.30, 0.50], [0.75, 0.75, 0.72], [0.15, 0.35, 0.20], [0.55, 0.42, 0.20], [0.35, 0.36, 0.38], [0.70, 0.45, 0.10]];
    for (let x = -L / 2 + 6; x < L / 2 - 30; x += 12.8) {
      if (Math.abs(x + 6 - xp) < 14 || Math.abs(x + 6 - (xp - 18)) < 8) continue;
      for (let f = 0; f < 13; f++) {
        const n = 2 + Math.floor(rnd() * 5), w = 2.44, zc = (f - 6) * w;
        for (let k = 0; k < n; k++) cajas.push({ x0: x, x1: x + 12.2, y0: F + k * 2.6, y1: F + (k + 1) * 2.6 - 0.05, w: w - 0.06, zc, c: COL[Math.floor(rnd() * COL.length)] });
      }
    }
  }
  // a geometría: seis caras por caja, sin la de abajo
  const pos = [], nor = [], col = [];
  const cara = (a, b, c, d, n, k) => { for (const p of [a, b, c, a, c, d]) { pos.push(...p); nor.push(...n); col.push(...k); } };
  for (const { x0, x1, y0, y1, w, zc = 0, c } of cajas) {
    const z0 = zc - w / 2, z1 = zc + w / 2;
    const s = 0.8 + 0.2 * ((x0 * 7.13 + zc * 3.1) % 1 + 1) % 1;   // un poco de variación por pila
    const k = c.map((v) => v * s), kt = c.map((v) => v * s * 1.08);
    cara([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], k);
    cara([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], k);
    cara([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], k);
    cara([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], k);
    cara([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], kt);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));   // algunos pasos piden uv
  return g;
}

export class Barcos {
  constructor(scene) {
    this.rutas = RUTAS_CANAL.map(tabla);
    const mat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
    this.modelos = { contenedores: [casco('contenedores', 106), casco('contenedores', 107)], gas: [casco('gas', 108)] };
    // dos barcos por vía (el que entra y el que sale): bastan, porque cada uno tarda más o menos lo que hay entre dos
    // cada lugar tiene una malla por modelo y se muestra la que toca: cambiar la geometría de una malla ya dibujada deja a
    // WebGPU con el búfer de vértices del modelo anterior (error de validación al dibujar)
    this.barcos = []; this.lugares = [];
    for (let v = 0; v < this.rutas.length; v++) for (let k = 0; k < 2; k++) {
      const lugar = {};
      for (const [tipo, lista] of Object.entries(this.modelos)) lugar[tipo] = lista.map((g) => {
        const m = new THREE.Mesh(g, mat);
        m.castShadow = false; m.receiveShadow = false; m.visible = false; m.userData = { via: v, tipo };
        scene.add(m); this.barcos.push(m); return m;
      });
      this.lugares.push(lugar);
    }
    this.firma = '';
  }

  /** Coloca los barcos para el minuto `min` del día `dia` (número de día, para variar el tipo). Devuelve si cambió algo. */
  actualizar(min, dia = 0) {
    const firma = `${Math.round(min * 30)}|${dia}`; if (firma === this.firma) return false;
    this.firma = firma;
    let i = 0;
    for (let v = 0; v < this.rutas.length; v++) {
      const R = this.rutas[v], ida = v === 0;          // vía 0 de sur a norte; vía 1 de norte a sur
      const tAhora = (dia * 1440 + min) * 60, desfase = v * 1800;
      // los barcos de esta vía salen cada CADA min; se miran los dos más recientes que pueden seguir en la ruta
      const n0 = Math.floor((tAhora - desfase) / (CADA * 60));
      for (const n of [n0, n0 - 1]) {
        const lugar = this.lugares[i++], t = tAhora - desfase - n * CADA * 60;
        for (const lista of Object.values(lugar)) for (const b of lista) b.visible = false;
        if (t < 0 || t > R.T) continue;
        const tt = ida ? t : R.T - t;
        let j = 1; while (j < R.t.length - 1 && R.t[j] < tt) j++;
        const f = (tt - R.t[j - 1]) / (R.t[j] - R.t[j - 1] || 1), a = R.r[j - 1], b = R.r[j];
        const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f, y = a[2] + (b[2] - a[2]) * f;
        const tipo = ((n * 7 + v * 3 + dia) % 3 + 3) % 3 === 2 ? 'gas' : 'contenedores';
        const lista = lugar[tipo], m = lista[((n % lista.length) + lista.length) % lista.length];
        // proa hacia donde va: atan2 en el plano x-z (la geometría tiene la proa en +X)
        const dx = (b[0] - a[0]) * (ida ? 1 : -1), dz = (b[1] - a[1]) * (ida ? 1 : -1);
        m.position.set(x, y, z); m.rotation.set(0, -Math.atan2(dz, dx), 0);
        m.visible = true;
      }
    }
    return true;
  }
}
