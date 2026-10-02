// Quita de modelo/entrada.glb las dos vigas sueltas («Dark stained roof timber») que quedaron acostadas en el suelo, al otro
// lado de la calle frente al 106, cruzadas en X: una de 6 m (x −1,55 a −1,45; z 24,1 a 30,1) y otra de 5,4 m (x −4,2 a 1,2;
// z 27,05 a 27,15), las dos de y −0,07 a 0,07. Están en el modelo desde el primer sitio (25 sep 2026), salidas así de
// Blender; no corresponden a nada real (Street View) y en el visor se veían como una cruz en el pasto. Pedido de LM, 1 oct 2026.
// Parte del GLB de main y solo borra los triángulos de esa madera dentro de la caja de las dos vigas; nada más se mueve.
//   cd fuente && node quitar-cruz.mjs            (después: node estado.mjs --comprobar, que debe mostrar solo esas 2 piezas)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { compactPrimitive } from '@gltf-transform/functions';

const CAJA = { x: [-4.3, 1.3], y: [-0.12, 0.12], z: [24.0, 30.2] };   // las dos vigas, con 5 a 10 cm de holgura
const archivo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'modelo', 'entrada.glb');
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(archivo);
const dentro = (p) => p[0] >= CAJA.x[0] && p[0] <= CAJA.x[1] && p[1] >= CAJA.y[0] && p[1] <= CAJA.y[1] && p[2] >= CAJA.z[0] && p[2] <= CAJA.z[1];
let quitados = 0;
for (const n of doc.getRoot().listNodes()) {
  const m = n.getMesh(); if (!m) continue;
  const W = n.getWorldMatrix();
  for (const p of m.listPrimitives()) {
    if (p.getMaterial()?.getName() !== 'Dark stained roof timber') continue;
    const A = p.getAttribute('POSITION'), Ix = p.getIndices(), I = Ix.getArray(), e = [0, 0, 0];
    const mundo = (v) => { A.getElement(v, e); return [0, 1, 2].map((k) => W[k] * e[0] + W[4 + k] * e[1] + W[8 + k] * e[2] + W[12 + k]); };
    const quedan = [];
    for (let t = 0; t < I.length; t += 3) {
      if ([I[t], I[t + 1], I[t + 2]].every((v) => dentro(mundo(v)))) { quitados++; continue; }
      quedan.push(I[t], I[t + 1], I[t + 2]);
    }
    if (quedan.length !== I.length) {
      Ix.setArray(new (I.constructor)(quedan));
      compactPrimitive(p);                        // quita los vértices que ya no usa ningún triángulo (si no, siguen en la caja)
    }
  }
}
if (quitados !== 48) { console.error(`se esperaban 48 triángulos (2 vigas de 24) y salieron ${quitados}: no se escribe nada`); process.exit(1); }
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(archivo, doc);
console.log(`quitados ${quitados} triángulos (las dos vigas) · escrito ${archivo}`);
