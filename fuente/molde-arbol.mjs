// Guarda el molde de árbol en fuente/molde-arbol.glb: el árbol más completo del anillo de relleno de vegetacion.glb tal como
// estaba en b08b86b (antes de cambiar el anillo por los árboles reales), con el pie del tronco en el origen. Lo usan
// arboles-cds.mjs (árboles de Ciudad del Saber) y, como medida, arboles-acomodar.mjs.
//
//   cd fuente && node molde-arbol.mjs        (lee el GLB de b08b86b con git show)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { medirAnillo } from './arboles-reales.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const bytes = execFileSync('git', ['show', 'b08b86b:modelo/vegetacion.glb'], { cwd: AQUI, maxBuffer: 1 << 26 });
const doc = await io.readBinary(new Uint8Array(bytes));
const { molde, piezas } = medirAnillo(doc);
// cada primitiva del anillo se queda solo con los triángulos del molde, en coordenadas con el pie en el origen
for (const n of doc.getRoot().listNodes()) {
  const m = n.getMesh(), p = m?.listPrimitives()[0], tris = p && piezas.get(p);
  if (!m) continue;                                    // el grupo «vegetacion» queda (sin transformación)
  if (!tris) { n.dispose(); continue; }
  const W = n.getWorldMatrix(), A = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL'), I = p.getIndices().getArray();
  const usados = [...new Set(tris.flatMap((t) => [I[3 * t], I[3 * t + 1], I[3 * t + 2]]))], nuevo = new Map(usados.map((v, i) => [v, i]));
  const P = new Float32Array(usados.length * 3), Nn = new Float32Array(usados.length * 3), e = [0, 0, 0];
  usados.forEach((v, i) => {
    const q = A.getElement(v, e); const x = W[0] * q[0] + W[12], y = W[5] * q[1] + W[13], z = W[10] * q[2] + W[14];   // escala uniforme y traslación
    P.set([x - molde.c[0], y - molde.y0, z - molde.c[1]], 3 * i);
    const nq = N.getElement(v, e), l = Math.hypot(...nq) || 1; Nn.set([nq[0] / l, nq[1] / l, nq[2] / l], 3 * i);
  });
  const acc = (a, t) => doc.createAccessor().setType(t).setArray(a);
  p.setAttribute('POSITION', acc(P, 'VEC3')).setAttribute('NORMAL', acc(Nn, 'VEC3'));
  p.setIndices(acc(Uint16Array.from(tris.flatMap((t) => [nuevo.get(I[3 * t]), nuevo.get(I[3 * t + 1]), nuevo.get(I[3 * t + 2])])), 'SCALAR'));
  n.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]).setName(m.getName().replace('V016 ', 'molde '));
  m.setName(n.getName());
}
await doc.transform(prune());
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(path.join(AQUI, 'molde-arbol.glb'), doc);
console.log(`molde: ${molde.alto.toFixed(2)} m de alto, copa de ${molde.diam.toFixed(2)} m, alcance ${molde.alcance.toFixed(2)} m, la copa empieza a ${molde.base.toFixed(2)} m → molde-arbol.glb`);
