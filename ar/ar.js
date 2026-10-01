// Edificio 106 en AR sobre la tarjeta impresa. MindAR (copia local, 1.2.5) solo rastrea el plano; la escena es three.js
// en metros, igual que en el sitio: en vez de colgar el modelo del ancla, se mueve la cámara con la inversa de la pose.
// Así la luz, la sombra y el sol usan las mismas coordenadas y la misma fórmula (sol.js) que el visor.
import * as THREE from 'three';
import { PLANO_M, CENTRO, EDIFICIO, cargar, matrizPapel, solEscena } from './escena-ar.js';

const $ = id => document.getElementById(id);
const contenedor = $('ar');
const estado = { fase: 'inicio', encontrado: false, vecesEncontrado: 0, cuadros: 0, errores: [] };
window.__ar = estado;                                     // para las pruebas automáticas (ar/probar.mjs)

// hoy, en hora de Panamá (UTC−5 todo el año)
const ahora = new Date(Date.now() - 5 * 3600e3);
const HOY = { y: ahora.getUTCFullYear(), m: ahora.getUTCMonth() + 1, d: ahora.getUTCDate() };

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();
camera.matrixAutoUpdate = false;

const mundo = new THREE.Group(); mundo.visible = false; scene.add(mundo);
scene.add(new THREE.HemisphereLight(0xf4f1ea, 0x6b6656, 1.3));
const sol = new THREE.DirectionalLight(0xfff4e0, 2.6);
const centro = new THREE.Vector3(CENTRO[0], 0, CENTRO[1]);
sol.target.position.copy(centro); mundo.add(sol, sol.target);
sol.castShadow = true;
Object.assign(sol.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 320 });
sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.02;
// la sombra cae sobre el papel: un plano invisible del tamaño del plano que solo recibe sombra
const piso = new THREE.Mesh(new THREE.PlaneGeometry(PLANO_M[0], PLANO_M[1]), new THREE.ShadowMaterial({ opacity: 0.38 }));
piso.rotation.x = -Math.PI / 2; piso.position.copy(centro); piso.receiveShadow = true; mundo.add(piso);

const _dir = new THREE.Vector3();
function ponerSol(min) {
  const s = solEscena({ ...HOY, h: 0, min });
  _dir.set(s.dir.x, s.dir.y, s.dir.z);
  sol.position.copy(centro).addScaledVector(_dir, 150);
  sol.visible = s.alt > 0;
  estado.sol = { min, alt: s.alt, az: s.az, dir: [s.dir.x, s.dir.y, s.dir.z] };
  $('hora-txt').textContent = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}` + (s.alt > 0 ? '' : ' · sin sol');
}
$('hora').addEventListener('input', e => ponerSol(+e.target.value));
ponerSol(+$('hora').value);

// ---------- cámara del celular y MindAR ----------
let video, controller, postMatrix;
const papel = matrizPapel();
const _m = new THREE.Matrix4();

function pose(worldMatrix) {
  if (worldMatrix === null) { mundo.visible = false; aviso(true); estado.encontrado = false; return; }
  _m.fromArray(worldMatrix).multiply(postMatrix).multiply(papel);   // escena (m) → cámara
  camera.matrix.copy(_m).invert(); camera.updateMatrixWorld(true);
  const e = camera.matrix.elements;                       // posición de la cámara, para medir el temblor en ar/probar.mjs
  (estado.camara ??= []).push([e[12], e[13], e[14]]); if (estado.camara.length > 600) estado.camara.shift();
  if (!estado.encontrado) estado.vecesEncontrado++;
  mundo.visible = true; aviso(false); estado.encontrado = true;
}
function aviso(ver) { $('aviso').hidden = !ver; }

function ajustar() {
  if (!controller) return;
  // misma cuenta que MindARThree.resize (mind-ar 1.2.5, src/image-target/three.js): video en modo «cubrir»
  const W = contenedor.clientWidth, H = contenedor.clientHeight, vw0 = video.videoWidth, vh0 = video.videoHeight;
  // MindAR lee el tamaño del video de los atributos width y height (no de videoWidth): sin ellos dibuja 0 × 0 y no encuentra nada
  video.setAttribute('width', vw0); video.setAttribute('height', vh0);
  const rv = vw0 / vh0, rc = W / H;
  const vw = rv > rc ? H * rv : W, vh = rv > rc ? H : W / rv;
  Object.assign(video.style, { width: vw + 'px', height: vh + 'px', top: -(vh - H) / 2 + 'px', left: -(vw - W) / 2 + 'px' });
  const proj = controller.getProjectionMatrix();
  const fovAjuste = H / vh;
  camera.fov = 2 * Math.atan(1 / proj[5] * fovAjuste) * 180 / Math.PI;
  camera.near = proj[14] / (proj[10] - 1); camera.far = proj[14] / (proj[10] + 1);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  renderer.setSize(W, H);
}

async function empezar() {
  $('empezar').disabled = true; $('error').hidden = true;
  try {
    estado.fase = 'camara';
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('sin-camara');
    video = document.createElement('video');
    video.setAttribute('autoplay', ''); video.setAttribute('muted', ''); video.setAttribute('playsinline', ''); video.muted = true;
    contenedor.appendChild(video); contenedor.appendChild(renderer.domElement);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
    video.srcObject = stream;
    await new Promise(ok => video.readyState >= 1 ? ok() : video.addEventListener('loadedmetadata', ok, { once: true }));
    await video.play().catch(() => {});
    video.setAttribute('width', video.videoWidth); video.setAttribute('height', video.videoHeight);

    estado.fase = 'cargando';
    $('empezar').textContent = 'Cargando el edificio…';
    const [{ Controller }, modelo] = await Promise.all([
      import('./vendor/mindar/mindar-image.prod.js'),
      cargar('./modelo', EDIFICIO),
    ]);
    mundo.add(modelo);
    controller = new Controller({
      inputWidth: video.videoWidth, inputHeight: video.videoHeight, maxTrack: 1,
      filterMinCF: 0.001, filterBeta: 1,                   // los valores de MindAR para un modelo quieto sobre la mesa
      onUpdate: d => { if (d.type === 'updateMatrix') pose(d.worldMatrix); else if (d.type === 'processDone') estado.procesados = (estado.procesados ?? 0) + 1; },
    });
    const { dimensions } = await controller.addImageTargets('./tarjeta/plano.mind');
    const [mw, mh] = dimensions[0];
    postMatrix = new THREE.Matrix4().compose(new THREE.Vector3(mw / 2, mh / 2, 0), new THREE.Quaternion(), new THREE.Vector3(mw, mw, mw));
    ajustar(); addEventListener('resize', ajustar);
    controller.dummyRun(video);
    controller.processVideo(video);

    $('inicio').hidden = true; $('panel').hidden = false; aviso(true);
    estado.fase = 'rastreando';
    let ultimo = 0;
    renderer.setAnimationLoop(t => {
      if (t - ultimo < 1000 / 31) return;                  // hasta 30 cuadros por segundo: alcanza y no calienta el celular
      ultimo = t; estado.cuadros++;
      renderer.render(scene, camera);
    });
  } catch (e) {
    console.error(e);
    estado.fase = 'error'; estado.errores.push(String(e?.message ?? e));
    const msg = e?.name === 'NotAllowedError' ? 'El celular no dio permiso para usar la cámara. Puedes darlo en los ajustes del navegador y volver a intentar.'
      : e?.message === 'sin-camara' ? 'Este navegador no deja usar la cámara. Abre el enlace en Safari o Chrome, no dentro de WhatsApp ni Instagram.'
      : 'No se pudo abrir la cámara o cargar el modelo. Recarga la página para intentarlo de nuevo.';
    $('error').textContent = msg; $('error').hidden = false;
    $('empezar').disabled = false; $('empezar').textContent = 'Intentar de nuevo';
  }
}
$('empezar').addEventListener('click', empezar);
