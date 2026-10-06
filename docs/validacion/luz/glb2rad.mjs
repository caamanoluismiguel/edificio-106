// GLB del visor → polígonos de Radiance, en el marco de Blender (x, y en planta, z arriba): glTF (x, y, z) → (x, −z, y).
// Uso: node glb2rad.mjs <material> <archivo.glb>   (escribe a stdout)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
const [mat, f] = process.argv.slice(2);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(f);
let n = 0; const out = [];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const M = node.getWorldMatrix();
  for (const p of mesh.listPrimitives()) {
    if (p.getMode() !== 4) continue;
    const pos = p.getAttribute('POSITION'), idx = p.getIndices(), v = [], e = [0, 0, 0];
    const cnt = idx ? idx.getCount() : pos.getCount();
    const P = (i) => { pos.getElement(i, e); const [x, y, z] = e;
      const X = M[0] * x + M[4] * y + M[8] * z + M[12], Y = M[1] * x + M[5] * y + M[9] * z + M[13], Z = M[2] * x + M[6] * y + M[10] * z + M[14];
      return [X, -Z, Y]; };
    for (let k = 0; k + 2 < cnt; k += 3) {
      const a = P(idx ? idx.getScalar(k) : k), b = P(idx ? idx.getScalar(k + 1) : k + 1), c = P(idx ? idx.getScalar(k + 2) : k + 2);
      out.push(`${mat} polygon t${n++}\n0\n0\n9 ${a.map((q) => q.toFixed(4)).join(' ')} ${b.map((q) => q.toFixed(4)).join(' ')} ${c.map((q) => q.toFixed(4)).join(' ')}\n`);
    }
  }
}
process.stdout.write(out.join(''));
console.error(f, n, 'triángulos');
