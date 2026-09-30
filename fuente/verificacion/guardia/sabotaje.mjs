// Prueba de sensibilidad del guardia: mueve 5 cm un nodo de modelo/detalles.glb (en la carpeta, sin commitear)
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const f = '../modelo/detalles.glb', doc = await io.read(f);
const nodos = doc.getRoot().listNodes().filter((n) => n.getMesh());
console.log('nodos:', nodos.map((n) => n.getName()).join(', '));
const n = nodos[0], t = n.getTranslation(); n.setTranslation([t[0] + 0.05, t[1], t[2]]);
await io.write(f, doc); console.log('movido 5 cm en x:', n.getName());
