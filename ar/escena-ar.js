// Lo que comparten la página de AR (ar.js) y el generador de la tarjeta (tarjeta.html): la escala, dónde cae el
// plano del sitio sobre el papel, cómo se carga el modelo y de dónde viene el sol. Si se cambia algo de aquí, hay
// que volver a generar la tarjeta y el archivo de rastreo (ar/tarjeta/), porque el modelo y el papel dejan de coincidir.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { posicionSol, vectorSol } from './sol.js';

export const ESCALA = 300;                              // 1:300 sobre el papel
export const PLANO_MM = [277, 160];                     // la parte rastreada de la tarjeta (el plano), en mm
export const PLANO_M = PLANO_MM.map(v => v * ESCALA / 1000);   // lo que cubre del sitio, en metros: 83,1 × 48
export const CENTRO = [10.05, 8.3];                     // centro del plano en la escena (x, z): el centro de la caja del 106
// grupos del 106: los mismos GLB del sitio, copiados tal cual; las tejas, en su versión liviana (cubiertas_sombra)
export const EDIFICIO = ['arquitectura', 'cubiertas', 'detalles', 'entrada', 'ventanas'];

/** De la escena (metros, Y arriba) al ancla de MindAR (1 = el ancho del plano, X a la derecha, Y hacia arriba del
 *  papel, Z saliendo del papel). Arriba del papel es −Z de la escena, igual que en la planta del sitio. */
export function matrizPapel() {
  const k = 1 / PLANO_M[0], [cx, cz] = CENTRO;
  return new THREE.Matrix4().set(
    k, 0, 0, -cx * k,
    0, 0, -k, cz * k,
    0, k, 0, 0,
    0, 0, 0, 1);
}

/** Ángulo del norte en el papel, en grados desde arriba y en sentido horario (para dibujar la flecha). */
export function nortePapel() {
  const n = vectorSol(0, 0);                            // norte en la escena
  return Math.atan2(n.x, -n.z) * 180 / Math.PI;
}

/** Dirección del sol (vector unitario en la escena) para una fecha y hora de Panamá. */
export function solEscena(f) {
  const { alt, az } = posicionSol(f);
  return { alt, az, dir: vectorSol(alt, az) };
}

/** Carga los GLB pedidos desde `base` y los devuelve en un grupo, en coordenadas de la escena. */
export async function cargar(base, grupos, { sombras = true } = {}) {
  const loader = new GLTFLoader();
  await MeshoptDecoder.ready; loader.setMeshoptDecoder(MeshoptDecoder);
  const raiz = new THREE.Group();
  const partes = await Promise.all(grupos.map(g => loader.loadAsync(`${base}/${g}.glb`)));
  partes.forEach((gltf, i) => {
    gltf.scene.name = grupos[i];
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = sombras; o.receiveShadow = sombras;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        // el vidrio con transmisión pide una pasada extra en cada cuadro: en el celular se cambia por transparencia simple
        if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = 0.35; m.depthWrite = false; o.castShadow = false; }
      }
    });
    raiz.add(gltf.scene);
  });
  return raiz;
}
