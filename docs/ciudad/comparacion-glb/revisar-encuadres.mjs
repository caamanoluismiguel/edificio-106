// Codex, 8 oct 2026. Cribado geométrico nominal; NO prueba de visibilidad renderizada.
// Ejecutar revisar_procedencia.py antes. No usa ni cambia alturas del GLB.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from '../../../fuente/node_modules/three/build/three.module.js';
import { ENCUADRES } from '../../../fuente/src/encuadres.js';
import { vectorSol } from '../../../fuente/src/sol.js';
const base = new URL('./', import.meta.url);
const exterior = JSON.parse(fs.readFileSync(new URL('procedencia-resultados.json', base))).exteriores;
const north = vectorSol(0,0);
// Las tres poses base se transcriben de main.js, cuya huella se registra debajo.
const views = [
  {id:'esquina',pos:[46,1.4,29],tgt:[12,5.4,2],fov:38},
  {id:'aerea106',pos:[92,78,104],tgt:[0,3,0],fov:38},
  {id:'planta106',pos:[3-north.x*3.8,215,1-north.z*3.8],tgt:[3,0,1],fov:38},
  ...ENCUADRES,
];
const poses = views.map(v => {
  const camera = new THREE.PerspectiveCamera(v.fov,1440/900,.3,7000);
  camera.position.set(...v.pos);camera.lookAt(new THREE.Vector3(...v.tgt));camera.updateMatrixWorld();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  // Envolvente vertical hipotética amplia para descartar piezas; no son alturas medidas.
  const candidates = exterior.filter(x => frustum.intersectsBox(new THREE.Box3(
    new THREE.Vector3(x.bounds[0][0],-100,x.bounds[0][1]), new THREE.Vector3(x.bounds[1][0],200,x.bounds[1][1]))));
  return {id:v.id,pos:v.pos,tgt:v.tgt,fov:v.fov,intersectan:candidates.length,nodos:candidates.map(x=>x.node)};
});
const inputs = ['fuente/src/main.js','fuente/src/encuadres.js','fuente/src/sol.js','fuente/src/escena.js'];
const report = {autor:'OpenAI Codex',fecha:'2026-10-08',
  alcance:'Frustum nominal de escritorio 1440 × 900, sin desplazamiento del panel, sin oclusión, terreno, niebla, giro del encuadre ni navegación. Intersección no implica visibilidad.',
  envolvente_vertical_hipotetica:[-100,200],
  fuentes_sha256:Object.fromEntries(inputs.map(p => [p,createHash('sha256').update(fs.readFileSync(new URL('../../../'+p,base))).digest('hex')])),poses};
fs.writeFileSync(new URL('encuadres-exteriores.json',base),JSON.stringify(report,null,2)+'\n');
console.log(poses.map(p=>({id:p.id,candidatos:p.intersectan})));
