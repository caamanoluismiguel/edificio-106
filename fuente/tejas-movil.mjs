// Tejas para teléfono: modelo/cubiertas_movil.glb, derivado de modelo/cubiertas.glb (el de main) sin tocarlo.
// Uso:  cd fuente && node tejas-movil.mjs              escribe ../modelo/cubiertas_movil.glb y dice triángulos, piezas y tamaño
//       cd fuente && node tejas-movil.mjs --medir      solo cuenta, no escribe
//       --error=0.0015 --ratio=0.25                    para probar otros valores (los de abajo son los elegidos)
//
// cubiertas.glb tiene ~455.000 triángulos de tejas sueltas (4,1 MB; 1,4 MB por la red con gzip): es lo más pesado que baja un
// teléfono. Aquí cada malla de tejas («Clay terracotta 00…08») se simplifica con meshoptimizer (simplify, que respeta la forma
// de cada teja); la madera, la faja del ático y el hueco de ventilación no se tocan. Los materiales no se funden (sin dedup:
// las nueve arcillas tienen nombres distintos y escena.js los reconoce por nombre). Después se cuantiza y comprime como el
// resto del modelo (optimize2.mjs: posición a 16 bits, normal a 10, meshopt 'high').
//
// Lo que se probó (capturas de teléfono 390 × 844, vistas esquina, aérea y fachada SE, 2 oct 2026):
//  - error 0,0015 (elegido): 67 % de los triángulos, el 90 % del área de tejas, 3,1 MB (1,0 MB por la red). Igual a la vista.
//  - error 0,002: 64 %, 82 % del área; error 0,0025 a 0,003: 57 %, la mitad de las tejas desaparece (las que se solapan).
//  - error 0,0045 o más: las tejas se deshacen y se ve la madera de abajo (techo pardo).
//  - simplifySloppy (une tejas vecinas) al 2 % (es cubiertas_sombra.glb), 15 % o 25 %: manchas, huecos y aleros dentados.
// cubiertas_sombra.glb sigue siendo solo el sustituto de sombra del escritorio. La app usa este archivo solo en teléfonos
// (calidad() en main.js: tejasLivianas); el escritorio sigue con cubiertas.glb.
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, weldPrimitive, simplifyPrimitive, prune, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const arg = (k, v) => +(process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? v);
// error relativo al tamaño de cada malla de tejas (unos 50 m): 0,0015 ≈ 7 cm; ratio es el piso, el que manda es el error
const RATIO = arg('ratio', 0.25), ERROR = arg('error', 0.0015);
const ENTRADA = '../modelo/cubiertas.glb', SALIDA = '../modelo/cubiertas_movil.glb';
const MEDIR = process.argv.includes('--medir');
const esTeja = (p) => /terracotta/i.test(p.getMaterial()?.getName() ?? '');

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(ENTRADA);
const prims = () => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
const tris = () => prims().reduce((a, p) => a + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);

/** Piezas sueltas (componentes conexas) y área de las tejas: para ver si la simplificación borró tejas. */
function piezasYArea() {
  let piezas = 0, area = 0;
  for (const p of prims().filter(esTeja)) {
    const I = p.getIndices().getArray(), P = p.getAttribute('POSITION').getArray(), id = new Map(), par = [];
    const nodo = (i) => { const k = `${Math.round(P[3 * i] * 500)},${Math.round(P[3 * i + 1] * 500)},${Math.round(P[3 * i + 2] * 500)}`; if (!id.has(k)) { id.set(k, par.length); par.push(par.length); } return id.get(k); };
    const raiz = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (let t = 0; t < I.length; t += 3) {
      const [a, b, c] = [nodo(I[t]), nodo(I[t + 1]), nodo(I[t + 2])]; par[raiz(a)] = raiz(b); par[raiz(b)] = raiz(c);
      const [i, j, k] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3];
      const ux = P[j] - P[i], uy = P[j + 1] - P[i + 1], uz = P[j + 2] - P[i + 2], vx = P[k] - P[i], vy = P[k + 1] - P[i + 1], vz = P[k + 2] - P[i + 2];
      area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    }
    const r = new Set(); for (let t = 0; t < I.length; t++) r.add(raiz(nodo(I[t]))); piezas += r.size;
  }
  return { piezas, area };
}

const t0 = tris();
await doc.transform(dequantize());
const antes = piezasYArea();
for (const p of prims().filter(esTeja)) {
  weldPrimitive(p, { tolerance: 0.0001 });
  simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio: RATIO, error: ERROR, lockBorder: false });
}
const t1 = tris(), despues = piezasYArea();
console.log(`triángulos: ${t0} → ${t1} (${(100 * t1 / t0).toFixed(1)} %) · piezas de tejas: ${antes.piezas} → ${despues.piezas} · área de tejas: ${(100 * despues.area / antes.area).toFixed(1)} %`);
if (MEDIR) process.exit(0);
await doc.transform(prune(), quantize({ quantizePosition: 16, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await io.write(SALIDA, doc);
console.log(`${SALIDA}: ${(fs.statSync(SALIDA).size / 1e6).toFixed(2)} MB (cubiertas.glb: ${(fs.statSync(ENTRADA).size / 1e6).toFixed(2)} MB)`);
