// El entorno ampliado del Edificio 106: Ciudad del Saber entera, la Avenida Omar Torrijos Herrera, el ferrocarril y el canal
// con las esclusas de Miraflores, llevados a coordenadas de la escena con el MISMO registro que los vecinos (contexto-osm.mjs,
// calculado sobre osm.json), para que todo quede donde ya estaba.
// Datos: fuente/osm-amplio.json (Overpass API, caja 8,984–9,020° N, 79,606–79,564° O, base del 1 de octubre de 2026; vías,
// edificios, agua, canal, compuertas y ferrocarril con su geometría). © colaboradores de OpenStreetMap, ODbL 1.0.
//   cd fuente && node entorno-osm.mjs     resumen en la consola
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aEscena, osmRegistrado } from './contexto-osm.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const rad = Math.PI / 180;
const CAJA = [[8.984, -79.606], [8.984, -79.564], [9.020, -79.606], [9.020, -79.564]];   // la de la consulta de Overpass
const clave = (g) => `${g.lat.toFixed(7)},${g.lon.toFixed(7)}`;

/** Une las vías de una relación en anillos cerrados (por extremos que coinciden). Devuelve listas de {lat, lon}. */
function anillos(vias) {
  const libres = vias.map((v) => v.slice()), salida = [];
  while (libres.length) {
    let r = libres.shift();
    for (let cambio = true; cambio && clave(r[0]) !== clave(r.at(-1));) {
      cambio = false;
      for (let i = 0; i < libres.length; i++) {
        const v = libres[i], a = clave(r.at(-1));
        if (clave(v[0]) === a) r = r.concat(v.slice(1));
        else if (clave(v.at(-1)) === a) r = r.concat(v.slice(0, -1).reverse());
        else if (clave(v.at(-1)) === clave(r[0])) r = v.concat(r.slice(1));
        else if (clave(v[0]) === clave(r[0])) r = v.slice().reverse().concat(r.slice(1));
        else continue;
        libres.splice(i, 1); cambio = true; break;
      }
    }
    if (r.length > 3) salida.push(r);                 // los abiertos (cortados por la caja de la consulta) se cierran solos
  }
  return salida;
}

/** Recorta un polígono (x, z) a un rectángulo [x0, x1] × [z0, z1] (Sutherland–Hodgman). */
function recortar(P, [x0, x1, z0, z1]) {
  const lados = [[(p) => p[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
    [(p) => p[1] >= z0, (a, b) => [a[0] + (b[0] - a[0]) * (z0 - a[1]) / (b[1] - a[1]), z0]],
    [(p) => p[1] <= z1, (a, b) => [a[0] + (b[0] - a[0]) * (z1 - a[1]) / (b[1] - a[1]), z1]]];
  for (const [dentro, corte] of lados) {
    const e = P; P = [];
    for (let i = 0; i < e.length; i++) {
      const a = e[i], b = e[(i + 1) % e.length];
      if (dentro(b)) { if (!dentro(a)) P.push(corte(a, b)); P.push(b); } else if (dentro(a)) P.push(corte(a, b));
    }
    if (!P.length) break;
  }
  return P;
}

/** Une los tramos del eje del canal en recorridos de punta a punta: uno por cada vía de las esclusas. */
function rutas(tramos) {
  const k = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`, ady = new Map();
  for (const t of tramos) for (const [a, b] of [[t.linea[0], t.linea.at(-1)], [t.linea.at(-1), t.linea[0]]]) {
    if (!ady.has(k(a))) ady.set(k(a), []);
    ady.get(k(a)).push({ t, sigue: k(b), puntos: k(a) === k(t.linea[0]) ? t.linea : t.linea.slice().reverse() });
  }
  const puntas = [...ady].filter(([, v]) => v.length === 1).map(([c]) => c);
  const salida = [];
  const andar = (c, usados, linea) => {
    const sig = ady.get(c).filter((s) => !usados.has(s.t.id));
    if (!sig.length) { if (puntas.includes(c) && linea.length > 2) salida.push(linea); return; }
    for (const s of sig) andar(s.sigue, new Set([...usados, s.t.id]), linea.concat(linea.length ? s.puntos.slice(1) : s.puntos));
  };
  // desde la punta más al sur (z mayor: +Z apunta al sureste), todos los recorridos hasta otra punta
  const sur = puntas.sort((a, b) => +b.split(',')[1] - +a.split(',')[1])[0];
  andar(sur, new Set(), []);
  return salida.sort((a, b) => b.length - a.length);
}

/** Lee osm-amplio.json y devuelve lo que no está ya en osm.json, registrado a la escena. */
export function entornoRegistrado(archivo = path.join(AQUI, 'osm-amplio.json')) {
  const { registro } = osmRegistrado();
  const [cx, cz] = registro.centroOSM106, th = registro.rotacionGrados * rad, co = Math.cos(th), si = Math.sin(th);
  const reg = (g) => { const [x, z] = aEscena(g.lat, g.lon), dx = x - cx, dz = z - cz; return [dx * co - dz * si, dx * si + dz * co]; };
  const yaEsta = new Set(JSON.parse(fs.readFileSync(path.join(AQUI, 'osm.json'), 'utf8')).elements.map((e) => e.id));
  const j = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const edificios = [], calles = [], tren = [], agua = [], canal = [];
  const poligono = (g) => { const p = g.map(reg); if (p.length > 2 && Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 1e-6) p.pop(); return p; };
  for (const e of j.elements) {
    const t = e.tags ?? {};
    if (e.type === 'way' && e.geometry) {
      if (t.building && !yaEsta.has(e.id) && e.geometry.length > 3)
        edificios.push({ id: e.id, nombre: t.name ?? '', niveles: t['building:levels'] ? +t['building:levels'] : null, poly: poligono(e.geometry) });
      else if (t.highway) calles.push({ id: e.id, tipo: t.highway, servicio: t.service ?? '', nombre: t.name ?? '', linea: e.geometry.map(reg) });
      else if (t.railway === 'rail') tren.push({ id: e.id, linea: e.geometry.map(reg) });
      else if (t.natural === 'water' || t.landuse === 'basin') agua.push({ id: e.id, nombre: t.name ?? '', exterior: poligono(e.geometry), huecos: [] });
      else if (t.waterway === 'canal') canal.push({ id: e.id, nombre: t.name ?? '', linea: e.geometry.map(reg) });
    } else if (e.type === 'relation' && t.natural === 'water') {
      const de = (rol) => e.members.filter((m) => m.type === 'way' && m.role === rol && m.geometry?.length > 1).map((m) => m.geometry);
      const huecos = anillos(de('inner')).map(poligono);
      for (const r of anillos(de('outer'))) agua.push({ id: e.id, nombre: t.name ?? '', exterior: poligono(r), huecos });
    }
  }
  // la caja de la consulta en la escena (sus cuatro esquinas registradas): el agua se recorta a ella
  const b = CAJA.map(([lat, lon]) => reg({ lat, lon }));
  const caja = [Math.min(...b.map((p) => p[0])), Math.max(...b.map((p) => p[0])), Math.min(...b.map((p) => p[1])), Math.max(...b.map((p) => p[1]))];
  const aguaR = agua.map((a) => ({ ...a, exterior: recortar(a.exterior, caja), huecos: a.huecos.map((h) => recortar(h, caja)).filter((h) => h.length > 2) }))
    .filter((a) => a.exterior.length > 2);
  return { edificios, calles, tren, agua: aguaR, canal, rutas: rutas(canal), caja, fecha: j.osm3s?.timestamp_osm_base };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const o = entornoRegistrado();
  const tipos = {}; for (const c of o.calles) tipos[c.tipo] = (tipos[c.tipo] ?? 0) + 1;
  console.log('base OSM', o.fecha, '· edificios nuevos', o.edificios.length, '· calles', JSON.stringify(tipos), '· tren', o.tren.length);
  for (const a of o.agua) console.log('agua', a.id, a.nombre, a.exterior.length, 'puntos', a.huecos.length, 'huecos', 'x', Math.min(...a.exterior.map((p) => p[0])).toFixed(0), Math.max(...a.exterior.map((p) => p[0])).toFixed(0), 'z', Math.min(...a.exterior.map((p) => p[1])).toFixed(0), Math.max(...a.exterior.map((p) => p[1])).toFixed(0));
  for (const r of o.rutas) console.log('ruta', r.length, 'puntos de', r[0].map((v) => v.toFixed(0)).join(','), 'a', r.at(-1).map((v) => v.toFixed(0)).join(','));
  console.log('caja', o.caja.map((v) => v.toFixed(0)).join(' '));
  if (0) for (const c of o.canal) console.log('canal', c.id, c.linea.length, 'de', c.linea[0].map((v) => v.toFixed(0)).join(','), 'a', c.linea.at(-1).map((v) => v.toFixed(0)).join(','));
}
