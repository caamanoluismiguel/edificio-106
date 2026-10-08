// Codex, 8 oct 2026. Verifica cómo GLTFLoader interpreta las líneas exportadas.
// node docs/ciudad/comparacion-glb/verificar-loader.mjs /ruta/ciudadelsaber.glb
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { GLTFLoader } from '../../../fuente/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { REVISION } from '../../../fuente/node_modules/three/build/three.module.js';
const data = fs.readFileSync(process.argv[2]);
const hash = createHash('sha256').update(data).digest('hex');
if (hash !== 'c09b25daf4eddef945b66ab7d80a82e6a4a3b661f94f55918f776dd3634668a2') throw new Error('GLB distinto al inspeccionado');
const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
const auxiliary = [];
gltf.scene.traverse(object => {
  if (!object.geometry?.attributes._instancestart) return;
  object.geometry.computeBoundingBox();
  auxiliary.push({ type: object.type, instanced: !!object.isInstancedMesh,
    position: object.geometry.attributes.position.count,
    segments: object.geometry.attributes._instancestart.count,
    min: object.geometry.boundingBox.min.toArray(), max: object.geometry.boundingBox.max.toArray(),
    material: object.material.type });
});
const report = { autor: 'OpenAI Codex', fecha: '2026-10-08', three_revision: REVISION, glb_sha256: hash,
  count: auxiliary.length, first: auxiliary[0],
  sameBounds: auxiliary.every(a => JSON.stringify(a.min) === JSON.stringify(auxiliary[0].min) && JSON.stringify(a.max) === JSON.stringify(auxiliary[0].max)),
  allOrdinaryMeshes: auxiliary.every(a => a.type === 'Mesh' && !a.instanced && a.material === 'MeshStandardMaterial') };
fs.writeFileSync(new URL('./loader-vias.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
