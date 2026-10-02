// Edificio 106 en AR sobre la tarjeta impresa. MindAR (copia local, 1.2.5) solo rastrea el plano; la escena es three.js
// en metros, igual que en el sitio: en vez de colgar el modelo del ancla, se mueve la cámara con la inversa de la pose.
// Así la luz, la sombra y el sol usan las mismas coordenadas y la misma fórmula (sol.js) que el visor.
// Sin cámara, la misma escena se ve sobre una tarjeta virtual (el plano impreso) y se gira con el dedo.
import * as THREE from 'three';
import { PLANO_M, CENTRO, ESCALA, EDIFICIO, cargar, matrizPapel, solEscena, nortePapel } from './escena-ar.js';
import { vectorSol } from './sol.js';
import { fechasClave, MES3 } from './fechas.js';

const $ = id => document.getElementById(id);
const contenedor = $('ar');
const SUAVE = new URLSearchParams(location.search).get('suave') !== '0';   // por defecto el filtro suave; ?suave=0, el anterior
const VISOR = '../';                                       // el visor está un nivel arriba (…/edificio-106/)
const estado = { fase: 'inicio', modo: null, encontrado: false, vecesEncontrado: 0, cuadros: 0, errores: [], pausado: false };
window.__ar = estado;                                     // para las pruebas automáticas (ar/probar.mjs)

// hoy, en hora de Panamá (UTC−5 todo el año)
const ahora = new Date(Date.now() - 5 * 3600e3);
const HOY = { y: ahora.getUTCFullYear(), m: ahora.getUTCMonth() + 1, d: ahora.getUTCDate() };
const S = { fecha: { ...HOY }, min: 900, persona: false, norte: false, lente: false, escala: ESCALA };
const dos = n => String(n).padStart(2, '0');
const hhmm = m => `${dos(Math.floor(m / 60))}:${dos(Math.round(m) % 60)}`;

// ---------- navegador dentro de una aplicación (WhatsApp, Instagram, Facebook, TikTok, LinkedIn, Snapchat, Telegram, LINE) ----------
const ua = navigator.userAgent;
const app = /WhatsApp/i.test(ua) ? 'WhatsApp' : /Instagram/i.test(ua) ? 'Instagram' : /FBAN|FBAV|FB_IAB|FBIOS/.test(ua) ? 'Facebook'
  : /TikTok|musical_ly|Bytedance|trill_/i.test(ua) ? 'TikTok' : /LinkedInApp/i.test(ua) ? 'LinkedIn' : /Snapchat/i.test(ua) ? 'Snapchat'
  : /Telegram/i.test(ua) ? 'Telegram' : /\bLine\//.test(ua) ? 'LINE' : null;
estado.enApp = app;
if (app) {
  $('en-app').hidden = false;
  $('en-app-txt').textContent = `Dentro de ${app} la cámara suele no funcionar. Toca el menú de ${app} y elige abrir en el navegador, o copia el enlace y pégalo en Safari o Chrome.`;
}
$('copiar').addEventListener('click', async () => {
  const url = location.href.split('#')[0];
  try { await navigator.clipboard.writeText(url); $('copiado').hidden = false; }
  catch { const i = $('enlace'); i.value = url; i.hidden = false; i.focus(); i.select(); $('copiado').textContent = 'Mantén el dedo sobre el enlace para copiarlo.'; $('copiado').hidden = false; }
});

// ---------- escena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();             // la de la AR: la mueve la pose de MindAR
camera.matrixAutoUpdate = false;

const mundo = new THREE.Group(); mundo.visible = false; scene.add(mundo);
// lo que crece con el botón de escala: el edificio, la persona y el piso que recibe la sombra (la flecha del norte no:
// está dibujada sobre el papel)
const escalable = new THREE.Group(); mundo.add(escalable);
scene.add(new THREE.HemisphereLight(0xf4f1ea, 0x6b6656, 1.3));
const SOL_I = 2.6;
const sol = new THREE.DirectionalLight(0xfff4e0, SOL_I);
const centro = new THREE.Vector3(CENTRO[0], 0, CENTRO[1]);
sol.target.position.copy(centro); mundo.add(sol, sol.target);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0005;
// la sombra cae sobre el papel: un plano invisible del tamaño del plano que solo recibe sombra
const piso = new THREE.Mesh(new THREE.PlaneGeometry(PLANO_M[0], PLANO_M[1]), new THREE.ShadowMaterial({ opacity: 0.38 }));
piso.rotation.x = -Math.PI / 2; piso.position.copy(centro); piso.receiveShadow = true; escalable.add(piso);

// ---------- persona de 1,70 m (la escena está en metros: a 1:320 mide 5,3 mm) ----------
const persona = new THREE.Group(); persona.name = 'persona'; persona.visible = false;
{
  const mat = new THREE.MeshLambertMaterial({ color: 0x1d1d1b });   // tinta: no se confunde con los colores de la lente
  const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.08, 4, 12), mat);   // 0,2 + 1,08 + 0,2 = 1,48 m
  cuerpo.position.y = 0.74;
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), mat);       // coronilla a 1,70 m
  cabeza.position.y = 1.59;
  for (const m of [cuerpo, cabeza]) { m.castShadow = true; persona.add(m); }
  escalable.add(persona);
}

// ---------- flecha del norte, sobre el papel ----------
const norte = new THREE.Group(); norte.name = 'norte'; norte.visible = false; mundo.add(norte);
{
  const n = vectorSol(0, 0), d = new THREE.Vector2(n.x, n.z).normalize(), p = new THREE.Vector2(-d.y, d.x);
  // en la esquina de abajo a la derecha del plano, sobre la calle: lejos del edificio, que no la tape
  const c = new THREE.Vector2(CENTRO[0] + PLANO_M[0] / 2 - 7, CENTRO[1] + PLANO_M[1] / 2 - 7);
  const L = 3, pt = (a, b) => [c.x + d.x * a + p.x * b, 0.03, c.y + d.y * a + p.y * b];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...pt(L, 0), ...pt(-L * 0.8, L * 0.6), ...pt(-L * 0.4, 0), ...pt(L, 0), ...pt(-L * 0.4, 0), ...pt(-L * 0.8, -L * 0.6)], 3));
  const tinta = new THREE.MeshBasicMaterial({ color: 0x1d1d1b, side: THREE.DoubleSide });
  const disco = new THREE.Mesh(new THREE.CircleGeometry(L * 1.35, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  disco.rotation.x = -Math.PI / 2; disco.position.set(c.x, 0.02, c.y);
  // la N, más allá de la punta y siempre derecha sobre el papel
  const lienzo = document.createElement('canvas'); lienzo.width = lienzo.height = 128;
  const x = lienzo.getContext('2d'); x.fillStyle = '#1d1d1b'; x.font = 'bold 110px Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('N', 64, 70);
  const tex = new THREE.CanvasTexture(lienzo); tex.colorSpace = THREE.SRGBColorSpace;
  const letra = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  letra.rotation.x = -Math.PI / 2; const pl = pt(L * 1.35 + 2, 0); letra.position.set(pl[0], 0.04, pl[2]);
  const fondoN = new THREE.Mesh(new THREE.CircleGeometry(1.9, 24), disco.material); fondoN.rotation.x = -Math.PI / 2; fondoN.position.set(pl[0], 0.02, pl[2]);
  norte.add(disco, new THREE.Mesh(g, tinta), fondoN, letra);
  norte.userData.angulo = Math.atan2(d.x, -d.y) * 180 / Math.PI;   // desde arriba del papel, horario (para la prueba)
}

// ---------- lente Sol: el coseno de incidencia del sol directo, con su sombra, en cinco franjas planas ----------
// Pinta las paredes, que es lo que se pregunta en clase (qué fachada recibe sol y cuándo). Las tejas no: cada una tiene su
// propia inclinación y el techo quedaba moteado, así que con la lente el techo va en gris.
// Se usa el sombreado de Lambert de three con el material blanco: la parte directa vale cos(incidencia) × sombra × intensidad / π.
// Se divide por la intensidad y se multiplica por π, y queda el coseno de incidencia donde da el sol y 0 en la sombra.
const FRANJAS = ['#22305e', '#8e2a3c', '#d2401c', '#ef8a1f', '#f8d23a'], GRIS = 0x9a968c;
// lo que queda arriba de las paredes (a más de 11,75 m: el remate de las paredes llega a 11,71) va en gris, como el techo
const ALTO_PAREDES = 11.75;
const uLente = { uIntens: { value: SOL_I }, uC: { value: FRANJAS.map(c => new THREE.Color(c)) }, uGris: { value: new THREE.Color(GRIS) }, uK: { value: 1 } };
const matLente = new THREE.MeshLambertMaterial({ color: 0xffffff });
matLente.onBeforeCompile = sh => {
  Object.assign(sh.uniforms, uLente);
  sh.vertexShader = 'varying float vAlto;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tvAlto = (modelMatrix * vec4(transformed, 1.0)).y;');
  sh.fragmentShader = `varying float vAlto;\nuniform float uIntens, uK;\nuniform vec3 uC[5], uGris;\n` + sh.fragmentShader.replace('#include <opaque_fragment>',
    `float e = clamp(reflectedLight.directDiffuse.r * PI / uIntens, 0.0, 1.0);
    vec3 c = e < 0.02 ? uC[0] : e < 0.25 ? uC[1] : e < 0.5 ? uC[2] : e < 0.75 ? uC[3] : uC[4];
    if (vAlto / uK > ${ALTO_PAREDES.toFixed(2)}) c = outgoingLight * uGris;
    gl_FragColor = vec4(c, 1.0);`);
};
$('franjas').innerHTML = FRANJAS.map(c => `<i style="background:${c}"></i>`).join('');
const matTecho = new THREE.MeshLambertMaterial({ color: GRIS });
// en gris: las tejas del techo y las del pórtico, y el interior, que se ve por la abertura del centro del techo
const esTecho = o => o.userData.grupo === 'cubiertas' || /^Clay_terracotta|interior|ceiling/i.test(o.name);
let modelo = null;
function ponerLente(si) {
  S.lente = si;
  modelo?.traverse(o => {
    if (!o.isMesh) return;
    o.userData.mat ??= o.material;
    if (o.userData.mat.transparent) return;                // el vidrio queda como está
    o.material = !si ? o.userData.mat : esTecho(o) ? matTecho : matLente;
  });
  $('leyenda').hidden = !si;
  actualizar();
}

// ---------- escala: 1:320 es la de la tarjeta; 1:200 y 1:100 agrandan el modelo sobre el papel ----------
const SIGUIENTE = { 320: 200, 200: 100, 100: 320 };
function ponerEscala(e) {
  S.escala = e; const k = ESCALA / e;
  uLente.uK.value = k; escalable.scale.setScalar(k); escalable.position.copy(centro).multiplyScalar(1 - k);
  Object.assign(sol.shadow.camera, { left: -70 * k, right: 70 * k, top: 70 * k, bottom: -70 * k, near: 1, far: 320 * k });
  sol.shadow.camera.updateProjectionMatrix(); sol.shadow.normalBias = 0.02 * k;
  $('b-escala').textContent = `1:${e}`;
  $('b-escala').setAttribute('aria-label', `Escala 1:${e}. Toca para cambiar a 1:${SIGUIENTE[e]}`);
  const nota = $('escala-nota'); nota.hidden = e === ESCALA;
  nota.textContent = `La tarjeta está impresa a 1:${ESCALA}. Este botón agranda el modelo a 1:${e} (${String(k).replace('.', ',')} veces), así que ya no calza con el plano` + (e <= 100 ? ' y se sale de la tarjeta.' : '.');
  actualizar();
}

// ---------- fecha y hora ----------
const FECHAS = [{ clave: 'hoy', nombre: 'Hoy', ...HOY }, ...fechasClave(HOY.y)];
estado.fechas = FECHAS;
$('fecha').innerHTML = FECHAS.map((f, i) => `<option value="${i}">${f.nombre}, ${f.d} ${MES3[f.m - 1]}</option>`).join('');
const _dir = new THREE.Vector3();
const NOTA_LENTE = $('leyenda-nota').textContent;
function actualizar() {
  const s = solEscena({ ...S.fecha, h: 0, min: S.min }), k = ESCALA / S.escala;
  _dir.set(s.dir.x, s.dir.y, s.dir.z);
  sol.position.copy(centro).addScaledVector(_dir, 150 * k);
  sol.visible = s.alt > 0;
  estado.sol = { fecha: { ...S.fecha }, min: S.min, alt: s.alt, az: s.az, dir: [s.dir.x, s.dir.y, s.dir.z] };
  Object.assign(estado, { escala: S.escala, lente: S.lente, persona: S.persona, norte: S.norte });
  const sel = FECHAS[+$('fecha').value];
  const extra = s.alt <= 0 ? 'sin sol' : sel?.h != null && Math.abs(S.min - (sel.h * 60 + sel.min)) < 1 ? 'mediodía solar' : '';
  $('hora-txt').innerHTML = hhmm(S.min) + (extra ? `<small>${extra}</small>` : '');
  $('hora').setAttribute('aria-valuetext', hhmm(S.min) + (extra ? `, ${extra}` : ''));
  $('leyenda-nota').textContent = NOTA_LENTE + (S.lente && estado.modo === 'ar' ? ' Inclina el celular para ver las paredes.' : '');
  // el mismo momento en el visor: #m-AAAAMMDD-HHMM&vista=aerea (y la lente de sol directo si está puesta)
  const f = S.fecha, m0 = Math.round(S.min);
  const href = `${VISOR}#m-${f.y}${dos(f.m)}${dos(f.d)}-${dos(Math.floor(m0 / 60))}${dos(m0 % 60)}${S.lente ? '&lente=sol&modo=directa' : ''}&vista=aerea`;
  $('b-visor').href = href; estado.visor = href;
}
$('hora').addEventListener('input', e => { S.min = +e.target.value; actualizar(); });
$('fecha').addEventListener('change', e => {
  const f = FECHAS[+e.target.value];
  S.fecha = { y: f.y, m: f.m, d: f.d };
  if (f.h != null) { S.min = f.h * 60 + f.min; $('hora').value = S.min; }   // día sin sombra: al mediodía solar
  actualizar();
});
const alternar = (id, clave, fn) => $(id).addEventListener('click', () => {
  const si = !S[clave]; $(id).setAttribute('aria-pressed', String(si)); fn(si);
});
alternar('b-persona', 'persona', si => { S.persona = si; persona.visible = si; actualizar(); });
alternar('b-norte', 'norte', si => { S.norte = si; norte.visible = si; actualizar(); });
alternar('b-sol', 'lente', ponerLente);
$('b-escala').addEventListener('click', () => ponerEscala(SIGUIENTE[S.escala]));

// el deslizador arranca en la hora de ahora (redondeada a 10 min), para comparar con una sombra real; fuera de su rango
// (de 5:50 a 18:50, lo que dura el día en Panamá con un margen), a las 15:00
const minAhora = Math.round((ahora.getUTCHours() * 60 + ahora.getUTCMinutes()) / 10) * 10;
if (minAhora >= +$('hora').min && minAhora <= +$('hora').max) $('hora').value = minAhora;
S.min = +$('hora').value;
ponerEscala(ESCALA);

/** Medidas para las pruebas: el tamaño del modelo en la escena, la altura de la persona y el giro de la flecha. */
estado.medir = () => {
  mundo.updateMatrixWorld(true);
  const b = modelo ? new THREE.Box3().setFromObject(modelo) : null, bp = new THREE.Box3().setFromObject(persona, true);
  return { modelo: b && b.getSize(new THREE.Vector3()).toArray(), persona: bp.max.y - bp.min.y, norte: norte.userData.angulo, nortePapel: nortePapel() };
};

let cargaModelo = null;
function cargarModelo() {
  cargaModelo ??= cargar('./modelo', EDIFICIO).then(m => {
    modelo = m; escalable.add(m);
    for (const g of m.children) g.traverse(o => { o.userData.grupo = g.name; });
    // la persona, delante de la fachada sureste (+z de la escena, hacia la calle), a 3,5 m de la pared (fuera del alero,
    // para que se vea desde arriba) y a la izquierda de la escalera de la entrada, que empieza en x ≈ 10 m
    const b = new THREE.Box3().setFromObject(m.getObjectByName('arquitectura'));
    persona.position.set(7, 0, b.max.z + 3.5);
    if (S.lente) ponerLente(true);
    return m;
  }).catch(e => { cargaModelo = null; throw e; });      // si falla, «Intentar de nuevo» lo vuelve a pedir
  return cargaModelo;
}

// ---------- dibujo, hasta 30 cuadros por segundo: alcanza y no calienta el celular ----------
let camActiva = camera, orbita = null, ultimo = 0;
function bucle(t) {
  if (t - ultimo < 1000 / 31) return;
  ultimo = t; estado.cuadros++;
  orbita?.update();
  renderer.render(scene, camActiva);
}

// ---------- cámara del celular y MindAR ----------
let video, controller, postMatrix;
const papel = matrizPapel();
const _m = new THREE.Matrix4();

function pose(worldMatrix) {
  if (estado.modo !== 'ar') return;
  if (worldMatrix === null) { if (estado.encontrado) buscandoDesde = performance.now(); mundo.visible = false; aviso(true); estado.encontrado = false; return; }
  _m.fromArray(worldMatrix).multiply(postMatrix).multiply(papel);   // escena (m) → cámara
  camera.matrix.copy(_m).invert(); camera.updateMatrixWorld(true);
  const e = camera.matrix.elements;                       // posición de la cámara, para medir el temblor en ar/probar.mjs
  (estado.camara ??= []).push([e[12], e[13], e[14]]); if (estado.camara.length > 600) estado.camara.shift();
  if (!estado.encontrado) estado.vecesEncontrado++;
  mundo.visible = true; aviso(false); estado.encontrado = true;
}
function aviso(ver) { $('aviso').hidden = !ver; }

// si el plano no aparece en 10 s (desde que empieza el rastreo o desde que se perdió), una ayuda y la salida sin cámara
const AVISO = $('aviso-txt').textContent, AYUDA_MS = 10000;
let buscandoDesde = 0, reloj = 0;
function vigilarBusqueda() {
  clearInterval(reloj); buscandoDesde = performance.now(); estado.ayuda = false;
  reloj = setInterval(() => {
    if (estado.modo !== 'ar') { clearInterval(reloj); return; }
    const ayuda = !estado.encontrado && !estado.pausado && performance.now() - buscandoDesde >= AYUDA_MS;
    $('aviso-txt').textContent = ayuda ? '¿No aparece? Aleja el celular hasta que se vea toda la hoja, sin reflejos ni tu sombra encima.' : AVISO;
    if (ayuda && !estado.ayuda) { estado.ayuda = true; $('b-sin-camara').hidden = false; }
  }, 250);
}
function pararCamara() {
  clearInterval(reloj);
  controller?.stopProcessVideo(); controller = null;
  video?.srcObject?.getTracks().forEach(t => t.stop());
  if (video) { video.srcObject = null; video.remove(); }
  estado.encontrado = false; mundo.visible = false;
  $('aviso-txt').textContent = AVISO; aviso(false); $('b-sin-camara').hidden = true;
}

function ajustar() {
  const W = contenedor.clientWidth, H = contenedor.clientHeight;
  renderer.setSize(W, H);
  if (estado.modo === 'sin-camara') { if (orbita) encuadre(W, H); return; }
  if (!controller) return;
  // misma cuenta que MindARThree.resize (mind-ar 1.2.5, src/image-target/three.js): video en modo «cubrir»
  const vw0 = video.videoWidth, vh0 = video.videoHeight;
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
}
addEventListener('resize', ajustar);

function mostrarError(e) {
  console.error(e);
  estado.fase = 'error'; estado.errores.push(String(e?.message ?? e));
  const msg = e?.name === 'NotAllowedError' ? 'El celular no dio permiso para usar la cámara. Puedes darlo en los ajustes del navegador y volver a intentar, o ver el modelo sin cámara. En iPhone: toca «aA» en la barra de direcciones, Configuración del sitio web, Cámara, Permitir.'
    : e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' ? 'No encontramos una cámara en este aparato. Puedes ver el modelo sin cámara.'
    : e?.name === 'NotReadableError' ? 'Otra aplicación está usando la cámara. Ciérrala y vuelve a intentar.'
    : e?.message === 'sin-camara' ? 'Este navegador no deja usar la cámara. Abre el enlace en Safari o Chrome, no dentro de WhatsApp ni Instagram.'
    : 'No se pudo abrir la cámara o cargar el modelo. Recarga la página para intentarlo de nuevo.';
  $('inicio').hidden = false; $('panel').hidden = true;
  $('error').textContent = msg; $('error').hidden = false;
  $('empezar').disabled = false; $('empezar').textContent = 'Intentar de nuevo'; $('sin-camara').disabled = false;
}

async function empezar() {
  $('empezar').disabled = true; $('error').hidden = true;
  try {
    estado.fase = 'camara'; estado.modo = 'ar';
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('sin-camara');
    video ??= document.createElement('video');
    video.setAttribute('autoplay', ''); video.setAttribute('muted', ''); video.setAttribute('playsinline', ''); video.muted = true;
    contenedor.appendChild(video); contenedor.appendChild(renderer.domElement);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
    video.srcObject = stream;
    await new Promise(ok => video.readyState >= 1 ? ok() : video.addEventListener('loadedmetadata', ok, { once: true }));
    await video.play().catch(() => {});
    video.setAttribute('width', video.videoWidth); video.setAttribute('height', video.videoHeight);

    estado.fase = 'cargando';
    $('empezar').textContent = 'Cargando el edificio…';
    const [{ Controller }] = await Promise.all([import('./vendor/mindar/mindar-image.prod.js'), cargarModelo()]);
    controller = new Controller({
      inputWidth: video.videoWidth, inputHeight: video.videoHeight, maxTrack: 1,
      // filtro de MindAR (One Euro). Su documentación (docs/quick-start/tracking-config.md): bajar filterMinCF reduce el
      // temblor y subir filterBeta reduce el retraso; por defecto 0,001 y 1000. Aquí va un corte 10 veces menor, elegido por
      // LM (2026-10-01) porque el edificio temblaba con el celular quieto; ?suave=0 vuelve al 0,001 para comparar.
      filterMinCF: SUAVE ? 0.0001 : 0.001, filterBeta: 1,
      onUpdate: d => {
        if (d.type === 'updateMatrix') pose(d.worldMatrix);
        else if (d.type === 'processDone') { estado.procesados = (estado.procesados ?? 0) + 1; ultimoProceso = performance.now(); }
      },
    });
    // el plano se baja aquí y no con controller.addImageTargets: esa función de MindAR se traga el error de la descarga y
    // su promesa no termina nunca (se quedaba en «Cargando el edificio…» sin dar ningún aviso)
    const rMind = await fetch('./tarjeta/plano.mind');
    if (!rMind.ok) throw new Error(`plano.mind: ${rMind.status}`);
    const { dimensions } = controller.addImageTargetsFromBuffer(await rMind.arrayBuffer());
    const [mw, mh] = dimensions[0];
    postMatrix = new THREE.Matrix4().compose(new THREE.Vector3(mw / 2, mh / 2, 0), new THREE.Quaternion(), new THREE.Vector3(mw, mw, mw));
    ajustar();
    controller.dummyRun(video);
    if (!document.hidden) controller.processVideo(video);

    $('inicio').hidden = true; $('panel').hidden = false; aviso(true); $('fecha').focus();
    estado.fase = 'rastreando'; vigilarBusqueda(); actualizar();
    if (!document.hidden) renderer.setAnimationLoop(bucle);
  } catch (e) {
    // se suelta la cámara y se deja todo como al principio, para que «Intentar de nuevo» arranque limpio
    pararCamara(); renderer.setAnimationLoop(null); estado.modo = null;
    mostrarError(e);
  }
}

// ---------- sin cámara: el modelo sobre una tarjeta virtual, con giro y zoom ----------
async function sinCamara() {
  $('sin-camara').disabled = true; $('empezar').disabled = true; $('error').hidden = true;
  try {
    estado.fase = 'cargando'; estado.modo = 'sin-camara';
    $('sin-camara').textContent = 'Cargando el edificio…';
    renderer.setAnimationLoop(null); pararCamara();                  // si viene de la AR, se apaga la cámara y MindAR
    const [{ OrbitControls }, , tex] = await Promise.all([
      import('three/addons/controls/OrbitControls.js'), cargarModelo(), new THREE.TextureLoader().loadAsync('./tarjeta/plano.png')]);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const hoja = new THREE.Mesh(new THREE.PlaneGeometry(PLANO_M[0], PLANO_M[1]), new THREE.MeshBasicMaterial({ map: tex }));
    hoja.rotation.x = -Math.PI / 2; hoja.position.set(CENTRO[0], -0.05, CENTRO[1]); hoja.name = 'tarjeta-virtual'; mundo.add(hoja);
    document.body.classList.add('sin-camara');
    if (!renderer.domElement.parentNode) contenedor.appendChild(renderer.domElement);
    camActiva = new THREE.PerspectiveCamera(40, 1, 0.5, 3000);
    $('inicio').hidden = true; $('panel').hidden = false; aviso(false); $('fecha').focus();
    orbita?.dispose(); orbita = null; vistaVertical = null; tocado = false;
    const dist = encuadre(contenedor.clientWidth, contenedor.clientHeight);
    orbita = new OrbitControls(camActiva, renderer.domElement);
    orbita.addEventListener('start', () => { tocado = true; });
    orbita.target.copy(objetivo); orbita.enableDamping = true; orbita.maxPolarAngle = Math.PI * 0.47;
    orbita.minDistance = 12; orbita.maxDistance = Math.max(320, dist * 1.5); orbita.update();
    mundo.visible = true; ajustar();
    estado.fase = 'sin-camara'; actualizar();
    if (!document.hidden) renderer.setAnimationLoop(bucle);
  } catch (e) { estado.modo = null; mostrarError(e); }
}

/** Sin cámara: el centro de la vista se corre para que el panel no tape el edificio, y la cámara se acerca hasta que el
 *  plano llena lo que queda libre de pantalla. En una pantalla ancha se mira desde el borde de abajo, como en la AR, con
 *  la tarjeta entera o apenas recortada si así el edificio crece (hasta 1,15 veces la distancia que lo llena). En el celular vertical la tarjeta, que es apaisada, dejaba el edificio chico: ahí manda el edificio
 *  (con 6 m de tarjeta alrededor) y se mira en diagonal desde la esquina de abajo a la derecha, que llena mejor una
 *  pantalla alta. La distancia se elige al entrar y al girar el celular, no en cada cambio de tamaño, para no
 *  perder el zoom de quien está mirando; si el panel crece (la leyenda de la lente Sol), la vista se corre hacia arriba
 *  y, si nadie la tocó todavía, también se vuelve a encuadrar. Devuelve la distancia. */
const objetivo = new THREE.Vector3(), _p = new THREE.Vector3();
let vistaVertical = null, distVista = 0, tocado = false;
function encuadre(W, H, rehacer = false) {
  const r = $('panel').getBoundingClientRect(), abajo = r.top > H / 2;
  const libreW = abajo ? W : W - r.width - 12, libreH = abajo ? H - r.height - 12 : H;
  camActiva.aspect = W / H;
  camActiva.setViewOffset(W, H, abajo ? 0 : (W - libreW) / 2, abajo ? (H - libreH) / 2 : 0, W, H);
  camActiva.updateProjectionMatrix();
  const vertical = libreW < libreH;
  if ((orbita && vertical === vistaVertical && !rehacer) || !modelo) return distVista;
  vistaVertical = vertical;
  const dir = orbita ? camActiva.position.clone().sub(orbita.target).normalize() : new THREE.Vector3(vertical ? 0.42 : 0, 0.8, 0.6).normalize();
  mundo.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(modelo.getObjectByName('arquitectura') ?? modelo);
  b.getCenter(objetivo); objetivo.y = b.min.y + (b.max.y - b.min.y) * 0.3;
  const M = 6, esquinas = (x0, x1, y0, y1, z0, z1) => [x0, x1].flatMap(x => [y0, y1].flatMap(y => [z0, z1].map(z => new THREE.Vector3(x, y, z))));
  const edif = esquinas(b.min.x - M, b.max.x + M, 0, b.max.y, b.min.z - M, b.max.z + M);
  const [cx, cz] = CENTRO, [aw, ah] = PLANO_M.map(v => v / 2);
  const hoja = [...edif, ...esquinas(cx - aw, cx + aw, 0, 0, cz - ah, cz + ah)];
  const m = 16, x1 = abajo ? W : libreW, y1 = abajo ? libreH : H;
  const cabe = (pts, d) => {
    camActiva.position.copy(objetivo).addScaledVector(dir, d); camActiva.lookAt(objetivo); camActiva.updateMatrixWorld(true);
    return pts.every(q => {
      if (_p.copy(q).applyMatrix4(camActiva.matrixWorldInverse).z > -camActiva.near) return false;   // detrás de la cámara
      _p.copy(q).project(camActiva);
      const x = (_p.x + 1) / 2 * W, y = (1 - _p.y) / 2 * H;
      return x >= m && x <= x1 - m && y >= m && y <= y1 - m;
    });
  };
  const ajusta = pts => { let lo = 5, hi = 3000; for (let i = 0; i < 40; i++) { const d = (lo + hi) / 2; cabe(pts, d) ? hi = d : lo = d; } return hi; };
  const dE = ajusta(edif), dH = ajusta(hoja);
  distVista = vertical ? dE : Math.min(dH, dE * 1.15);
  camActiva.position.copy(objetivo).addScaledVector(dir, distVista); camActiva.lookAt(objetivo);
  if (orbita) { orbita.target.copy(objetivo); orbita.update(); }
  estado.vista = { vertical, distancia: distVista };
  return distVista;
}

// sin cámara, el panel cambia de alto con la leyenda y la nota de escala: que no tape el edificio
new ResizeObserver(() => {
  if (estado.modo === 'sin-camara' && orbita) encuadre(contenedor.clientWidth, contenedor.clientHeight, !tocado);
}).observe($('panel'));

// ---------- pestaña oculta: se para la cámara, MindAR y el dibujo; al volver, siguen ----------
let ultimoProceso = 0, turno = 0;
const cuadro = () => new Promise(r => requestAnimationFrame(r));
async function pausar() {
  turno++; estado.pausado = true;
  renderer.setAnimationLoop(null);
  if (controller) { controller.stopProcessVideo(); pose(null); }
  video?.pause();
}
async function reanudar() {
  const mio = ++turno;
  if (estado.fase !== 'rastreando' && estado.fase !== 'sin-camara') { estado.pausado = false; return; }
  if (estado.modo === 'ar' && controller) {
    await video.play().catch(() => {});
    // el bucle de MindAR termina en la vuelta siguiente a stopProcessVideo; si se lo vuelve a arrancar antes, quedan dos.
    // Se espera a que deje de avisar «processDone» por 600 ms.
    const t0 = performance.now();
    while (performance.now() - Math.max(ultimoProceso, t0) < 600) { await cuadro(); if (mio !== turno) return; }
    controller.processVideo(video);
    buscandoDesde = performance.now();                     // los 10 s de la ayuda cuentan desde que vuelve
  }
  estado.pausado = false;
  renderer.setAnimationLoop(bucle);
}
document.addEventListener('visibilitychange', () => { document.hidden ? pausar() : reanudar(); });

$('empezar').addEventListener('click', empezar);
$('sin-camara').addEventListener('click', sinCamara);
$('b-sin-camara').addEventListener('click', sinCamara);
actualizar();
