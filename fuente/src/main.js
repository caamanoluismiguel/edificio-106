// Un edificio a 9° N — v2: un solo instrumento. El gemelo se arma solo al abrir, queda en "Ahora"
// (sol calculado y tiempo real) y una máquina del tiempo recorre el día, el año y los últimos 25 años.
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Escena, U, GRUPOS, RAMPA_SOL } from './escena.js';
import { Sonido } from './sonido.js';
import { puntosIntro, conVersion } from './datos.js';
import { posicionSol, vectorSol, diasCeroSombra, saleYPone, sombraPoste, rumboTexto, FACHADAS, incidencia, dniDespejado, mediodiaSolar, EJE_LARGO } from './sol.js';
import { posicionLuna } from './luna.js';
import { Clima } from './clima.js';
import { utci, categoriaUTCI, CATEGORIAS_UTCI, tmrtSol, tmrtSombra, humedadAbs, GIVONI, dentroPoligono } from './confort.js';
import QRCode from 'qrcode';

const $ = (s) => document.querySelector(s);
export const VERSION = 'v3 · 25 sep 2026';

// ---------------- Diagnóstico: todo error queda anotado y, si hace falta, visible en pantalla ----------------
const DIAG = { log: [], gpu: 0, t0: performance.now() };
function anotar(tipo, m) {
  const txt = String(m?.message ?? m ?? '').replace(/\s+/g, ' ').slice(0, 420);
  const prev = DIAG.log[DIAG.log.length - 1];
  if (prev && prev.tipo === tipo && prev.txt === txt) { prev.n++; pintarDiag(); return; }
  DIAG.log.push({ t: ((performance.now() - DIAG.t0) / 1000).toFixed(1), tipo, txt, n: 1 });
  if (DIAG.log.length > 40) DIAG.log.shift();
  pintarDiag();
}
function pintarDiag() {
  let el = document.getElementById('diag');
  const graves = DIAG.log.filter((x) => x.tipo !== 'aviso').length;
  if (!el) {
    if (!graves && location.hash !== '#depurar') return;
    el = document.createElement('details'); el.id = 'diag';
    el.innerHTML = '<summary></summary><pre></pre>';
    document.body.appendChild(el);
    if (location.hash === '#depurar') el.open = true;
  }
  let be = '…'; try { be = escena?.backend ?? '…'; } catch (e) { /* aún no hay escena */ }
  el.querySelector('summary').textContent = `Diagnóstico · ${be} · ${graves} error${graves === 1 ? '' : 'es'} · ${VERSION}`;
  el.querySelector('pre').textContent = DIAG.log.map((x) => `${x.t} s  ${x.tipo}${x.n > 1 ? ' ×' + x.n : ''}: ${x.txt}`).join('\n');
}
addEventListener('error', (e) => anotar('error', e.message + (e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : '')));
addEventListener('unhandledrejection', (e) => anotar('promesa', e.reason?.stack?.split('\n').slice(0, 2).join(' ') ?? e.reason));
{
  const ce = console.error.bind(console), cw = console.warn.bind(console);
  console.error = (...a) => { anotar('consola', a.map((x) => x?.message ?? String(x)).join(' ')); ce(...a); };
  console.warn = (...a) => { const t = a.map((x) => x?.message ?? String(x)).join(' '); if (/THREE|WebGPU|GPU/i.test(t)) anotar('aviso', t); cw(...a); };
}
const BASE = new URL('../', import.meta.url).href;              // js/app.js -> raíz del sitio
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// Formato de números en todo el sitio (textos a mano incluidos): coma decimal y punto de miles desde las cuatro cifras,
// como se escribe en Colombia y en buena parte de Latinoamérica: 0,69 · 5,62 m · 2.000 mm · 5.880 h · 1.770 kWh/m².
// Los años (2001–2025) y los rangos de horas van sin punto. No se usa toLocaleString: en es-PA (y es-419) da el formato
// de EE. UU. (5,880.69), que choca con los decimales escritos a mano, y cambia según el navegador.
const num = (x, d = 0) => {
  const [e, f] = Math.abs(x).toFixed(d).split('.');
  const s = x < 0 && /[1-9]/.test(e + (f ?? '')) ? '-' : '';
  return s + e.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (f ? ',' + f : '');
};
const f1 = (x, d = 1) => num(x, d);
const miles = (v) => num(v, 0);
// cifras anuales con 2–3 cifras significativas: redondeo a decenas (lo que sostiene un reanálisis de celda de ~28 km)
const dec = (v) => miles(Math.round(v / 10) * 10);
const hhmm = (min) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const eio = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Hora actual en Panamá (UTC−5 todo el año). */
function ahoraPanama() {
  const d = new Date(Date.now() - 5 * 3600e3);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), min: d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 };
}
const diaDelAnio = (f) => Math.min(364, Math.round((Date.UTC(f.y, f.m - 1, f.d) - Date.UTC(f.y, 0, 1)) / 864e5));
const fechaDeDia = (y, n) => { const d = new Date(Date.UTC(y, 0, 1) + n * 864e5); return { y, m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
const diasMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const fechaTexto = (f) => `${f.d} de ${MESES[f.m - 1]} de ${f.y}`;
const kf2 = (f) => `${f.y}-${String(f.m).padStart(2, '0')}-${String(f.d).padStart(2, '0')}`;
const deISO = (t) => { const [y, m, d] = t.split('-').map(Number); return { y, m, d }; };
const fechaCorta = (f) => `${f.d} ${MES3[f.m - 1]} ${f.y}`;

// ---------------- Calidad según el equipo ----------------
function calidad() {
  const q = new URLSearchParams(location.search);
  if (q.has('ligero')) return { nivel: 'bajo', dpr: 1, px: 1.2e6, sombras: 1024, particulas: 20000, bloom: false, grupos: ['sitio', 'arquitectura', 'ventanas', 'entrada'] };
  const movil = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
  if (movil) return { nivel: 'bajo', dpr: 1.5, px: 1.6e6, sombras: 2048, particulas: 40000, bloom: false };
  if (!navigator.gpu) return { nivel: 'medio', dpr: 1.25, px: 2.4e6, sombras: 2048, particulas: 60000, bloom: false };
  const ultra = location.hash === '#ultra';
  return { nivel: 'alto', dpr: ultra ? 2 : 1.5, px: ultra ? 6e6 : 3.7e6, sombras: 4096, particulas: ultra ? 120000 : 90000, bloom: true, ao: ultra };
}

// ---------------- Vistas (coordenadas de la escena, metros; +X = noreste, +Z = sureste) ----------------
const ESQUINA = { pos: [65, 2.1, 29], tgt: [30.09, 3.71, 9.53] };     // cámara 05 de la v016: la esquina del jardín
// en pantallas verticales la misma esquina, desde un poco más lejos para que quepa el edificio
if (innerWidth / innerHeight < 0.8) ESQUINA.pos = ESQUINA.pos.map((v, i) => ESQUINA.tgt[i] + (v - ESQUINA.tgt[i]) * (i === 1 ? 1 : 1.45));
const CENTRO = [3, 5, 1];                                           // pivote para girar el edificio
const NORTE = vectorSol(0, 0), ESTE = vectorSol(0, 90);
const VISTAS = {
  esquina: ESQUINA,
  aerea: { pos: [92, 78, 104], tgt: [0, 3, 0] },
  planta: { pos: [CENTRO[0] - NORTE.x * 3.8, 215, CENTRO[2] - NORTE.z * 3.8], tgt: [CENTRO[0], 0, CENTRO[2]] },
};
// en pantallas verticales la planta, más alta: el hueco libre entre los botones y la tarjeta del recorrido es bajo (ver encuadreMovil)
if (innerWidth / innerHeight < 0.8) VISTAS.planta.pos = [CENTRO[0] - NORTE.x * 5.1, 290, CENTRO[2] - NORTE.z * 5.1];
const VISTA_FACHADA = {
  'fachada-se': { pos: [9, 1.65, 28.5], tgt: [4, 6.2, 11.5] },   // en la calle: La Casa (contexto.mjs) tiene la cubierta de su galería hasta z ≈ 30 y las columnas en z ≈ 30,9
  'fachada-no': { pos: [-2, 1.65, -32], tgt: [0, 6.2, -11.5] },
  'fachada-ne': { pos: [46, 1.65, -4], tgt: [22.75, 6.2, 0] },
  'fachada-so': { pos: [-41, 1.65, 4], tgt: [-22.75, 6.2, 0] },   // el 105 (contexto.mjs) tiene el muro en x ≈ −42,9 y el alero hasta −41,3: más atrás la cámara quedaba bajo su alero o dentro de su muro
};
const ROTULOS = [ // aparecen durante el armado, en el orden de los grupos
  { b: 0, t: 'Planta de 45,5 × 23 m' },       // aparece cuando los puntos ya formaron el edificio
  { b: 1.3, t: '3 pisos de 3,65 m' },
  { b: 2.3, t: '116 aberturas' },
  { b: 3.3, t: 'Teja de arcilla y 78 ménsulas' },
  { b: 6.4, t: 'Ciudad del Saber · 8,9993° N, 79,5827° O' },
];

// ---------------- Estado ----------------
const hoy = ahoraPanama();
const S = {
  modo: 'intro',                 // intro · ahora (sigue el reloj) · explorar
  fecha: { y: hoy.y, m: hoy.m, d: hoy.d }, min: hoy.min,
  pestana: 'dia', reproduce: false, aguacero: false, calor: false, ayudas: true, fachada: null,
  mesSerie: null,                // en el paso de 25 años: índice de mes (lluvia mensual en la escena)
  lente: 'foto',                 // foto · sol · lluvia · viento · sombras · partes
  aguaModo: 'hora',              // lente de lluvia: esta hora o año típico
  solModo: 'directa',            // lente de sol: solo directa o total (con difusa y reflejada)
  vientoModo: 'anio',            // lente de viento: esta hora, temporada seca, lluvias o año
  parte: 'alero', persona: true, alturas: false, largo: 1.65,   // lente de partes: la parte elegida, la persona de 1,70 m, la regla y el largo del voladizo
  viaje: null,                   // viaje en el tiempo en curso
  interactuo: false,             // el visitante ya tocó algo: la bienvenida no vuelve a salir
};
let consultas = null;
let escena, controls, clima = new Clima(), sonido = new Sonido(), intro = null;
let lluviaSuave = 0, nubesSuave = 30;
const cam = { anim: null };

// Algunos navegadores con WebGPU parcial rechazan el campo `swizzle` de las vistas de textura;
// three.js siempre envía la identidad ('rgba'), así que se puede quitar sin cambiar nada.
if (globalThis.GPUTexture) {
  const cv = GPUTexture.prototype.createView;
  GPUTexture.prototype.createView = function (d) {
    if (d && d.swizzle === 'rgba') { const c = {}; for (const k in d) if (k !== 'swizzle') c[k] = d[k]; d = c; }
    return cv.call(this, d);
  };
}

let visto = false; try { visto = localStorage.getItem('e106-visto') === '1'; } catch (e) { /* sin almacenamiento */ }
// «Saltar» pulsado antes de que empiece la intro: se recuerda y la intro arranca ya en su final
let saltoPendiente = false, alSaltar = () => {};
const pSalto = new Promise((ok) => { alSaltar = ok; });

// ---------------- Arranque ----------------
async function arrancar() {
  const q = calidad();
  estadoCarga('Preparando la escena…');
  // los puntos de la intro se piden primero (index.html ya los precarga con la misma URL); son decorativos y nada los espera
  const pIntro = puntosIntro(BASE).catch((e) => { console.warn(e); return null; });
  $('#saltar').addEventListener('click', () => {
    if (!intro) { saltoPendiente = true; alSaltar(); return; }
    if (intro.velocidad > 1) intro.t = intro.L; else intro.velocidad = 4;
  });
  const MIDE = /^#medir/.test(location.hash);
  let pideGL = /[?&]webgl/.test(location.search) || location.hash === '#medir-gl' || location.hash === '#webgl';
  try { if (localStorage.getItem('e106-motor') === 'webgl' && location.hash !== '#webgpu') pideGL = true; if (location.hash === '#webgpu') localStorage.removeItem('e106-motor'); } catch (e) { /* sin almacenamiento */ }
  try { escena = await new Escena($('#lienzo'), q).init(pideGL); }
  catch (e) {
    try { escena = await new Escena($('#lienzo'), { ...q, nivel: 'medio', sombras: 2048, bloom: false }).init(true); }
    catch (e2) { estadoCarga('Este navegador no puede mostrar la escena 3D. Prueba con Chrome, Edge o Safari actualizados.'); return; }
  }
  document.documentElement.dataset.backend = escena.backend;
  $('#motor').textContent = escena.backend;
  vigilarGPU();
  const cam0 = new THREE.Vector3(...ESQUINA.pos).add(new THREE.Vector3(22, 13, 15));
  escena.camera.position.copy(cam0); escena.camera.lookAt(...ESQUINA.tgt);
  escena.setSol(-7.5, 95);

  controls = new OrbitControls(escena.camera, escena.renderer.domElement);
  controls.enabled = false; controls.enableDamping = true; controls.dampingFactor = 0.075; controls.enablePan = false;
  controls.rotateSpeed = 0.55; controls.zoomSpeed = 0.8; controls.minDistance = 12; controls.maxDistance = 800;   // desde lejos se ve Ciudad del Saber entera con el canal y las esclusas de Miraflores controls.minPolarAngle = 0.01;
  controls.target.set(...ESQUINA.tgt);
  controls.addEventListener('start', alTomar);
  U.vaiven.value = reduce ? 0 : 1;
  // gancho para las comprobaciones automáticas (fuente/verificar.mjs): solo existe con ?prueba en la URL
  if (/[?&]prueba/.test(location.search)) window.__e106 = { escena, U, S, esq106: () => ESQ106, controls, clima, viajarA, enlaceMomento, VISTAS, VISTA_FACHADA, posicionSol };

  const bytes = {};
  const pModelo = escena.cargar(BASE, (g, l, t) => {
    if (t) bytes[g] = [l, t];
    const [L, T] = Object.values(bytes).reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0]);
    if (T) estadoCarga(`Modelo · ${f1(L / 1e6)} MB`);
    if (l === 1 && t === 1) compilarPronto();
  });
  clima.cargarResumen(conVersion(BASE + 'datos/clima_resumen.json')).then((ok) => { if (ok) { dibujarDecadas(); pintarMomentos(); pintarConsultas(); } });
  fetch(conVersion(BASE + 'datos/consultas.json')).then((r) => r.json()).then((j) => { consultas = j; pintarConsultas(); pintarRadiacion(); lastLect = ''; }).catch((e) => anotar('aviso', 'consultas: ' + e));
  const pVivo = clima.cargarVivo();
  setInterval(() => { if (S.modo === 'ahora') clima.cargarVivo(); }, 10 * 60e3);

  prepararUI();
  // la intro no espera a los puntos: si no llegaron cuando ya está el primer grupo del modelo (más un margen), se arma sin ellos
  const primero = pModelo.then((e) => e.promesas[GRUPOS.find((g) => (e.calidad.grupos ?? GRUPOS).includes(g))]).catch(() => {});
  const d = await Promise.race([pIntro, primero.then(() => new Promise((ok) => setTimeout(ok, 2000))), pSalto]);
  const n = d && !saltoPendiente ? escena.construirParticulas(d, q.particulas) : 0;
  estadoCarga(n ? `${miles(n)} puntos` : 'Cargando el modelo…');
  empezarIntro(n);
  requestAnimationFrame(bucle);
  escena.cargaCompleta.then(async () => {
    // compilar de antemano la lluvia y el diagrama de sombras, para que el primer aguacero o el primer clic en «Sombras» no congelen la imagen
    try { await escena.precompilar(); } catch (e) { /* se compila al dibujar */ }
    // la silueta del diagrama de sombras recorre toda la geometría (~120 ms): se calcula en un rato libre y no al primer clic
    escena.prepararSilueta();                    // en pedazos, en ratos libres
  });
  escena.cargaCompleta.then(() => estadoCarga(n ? `${miles(n)} puntos · modelo completo` : 'Modelo completo'));
  escena.cargaCompleta.then(() => {
    // cuerpo, cubiertas y ventanas, más las piezas del pórtico pegadas al edificio (en entrada.glb hay vigas que llegan a z ≈ 30)
    const c = new THREE.Box3(); for (const g of ['arquitectura', 'cubiertas', 'ventanas']) if (escena.grupos[g]?.root) c.expandByObject(escena.grupos[g].root);
    const cerca = c.clone().expandByScalar(5), b = new THREE.Box3();
    escena.grupos.entrada?.root.traverse((o) => { if (o.isMesh && cerca.containsBox(b.setFromObject(o))) c.union(b); });
    if (!c.isEmpty()) ESQ106 = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? c.max.x : c.min.x, i & 2 ? c.max.y : c.min.y, i & 4 ? c.max.z : c.min.z));
  });
  escena.cargaCompleta.then(() => clima.cargarHorario(BASE).then(() => { dibujarDecadas(); refrescar(); }).catch((e) => console.warn('clima horario', e)));
  pVivo.then(() => refrescar());
  if (location.hash === '#depurar') depurar();
  if (MIDE) escena.cargaCompleta.then(async () => {
    // espera a que la página sea visible y tenga tamaño (el visor de claude.ai la precarga oculta)
    while (!(innerWidth > 200 && innerHeight > 200 && document.visibilityState === 'visible') || intro) await new Promise((ok) => setTimeout(ok, 500));
    setTimeout(medir, 3000);
  });
}

let compilando = 0;
function compilarPronto() {
  clearTimeout(compilando);
  compilando = setTimeout(() => { escena.precompilar().catch(() => {}); }, 60);
}

function estadoCarga(t) { const el = $('#carga-estado'); if (el) el.textContent = t; }

// ---------------- Intro automática ----------------
function empezarIntro(n) {
  const h = location.hash.replace('#', '');
  const corta = visto || !!FACHADAS[h] || /^m-/.test(h) || reduce;
  intro = { t: 0, L: /[?&]rapido/.test(location.search) || /^#medir/.test(location.hash) ? 4 : corta ? 4.5 : 14, velocidad: 1, rotulo: -1 };
  document.documentElement.classList.add('en-intro');
  try { localStorage.setItem('e106-visto', '1'); } catch (e) { /* nada */ }
  // recorrido del sol al final del armado: desde antes del amanecer hasta la hora real de hoy
  const a = ahoraPanama(), { sale, pone } = saleYPone(a.y, a.m, a.d);
  intro.m1 = a.min;
  intro.m0 = a.min < sale - 45 ? a.min - 60 : a.min > pone + 60 ? pone - 60 : sale - 45;
  intro.cam0 = escena.camera.position.clone();
  // sin puntos no hay nada que juntar: se salta esa parte y el sólido empieza a revelarse casi enseguida
  if (saltoPendiente) intro.t = intro.L; else if (!n) intro.t = 0.26 * intro.L;
}

function pasoIntro(dt) {
  const it = intro; if (!it) return;
  // tiempos (u = fracción de la intro): los puntos se juntan · el sólido se revela grupo a grupo · luz · sol hasta ahora
  const B = (u) => 0.7 + 7.7 * eio(clamp01((u - 0.36) / 0.40));
  let t = it.t + dt * it.velocidad, u = t / it.L;
  // el armado espera al grupo que toca revelar si aún no ha llegado (los puntos lo siguen mostrando)
  const g = Math.floor(B(u) - 0.7);
  if (g >= 0 && g < GRUPOS.length && !escena.listos?.has(GRUPOS[g]) && (escena.calidad.grupos ?? GRUPOS).includes(GRUPOS[g])) { t = it.t; u = t / it.L; }
  it.t = t;
  const b = B(u);
  U.junta.value = eio(clamp01((u - 0.02) / 0.36));
  U.build.value = b; U.mat.value = sstep(0.66, 0.82, u); U.puntos.value = 1;
  // rótulos
  let r = u >= 0.3 ? 0 : -1; ROTULOS.forEach((x, i) => { if (i > 0 && b >= x.b) r = i; });
  if (u > 0.9) r = -2;
  if (r !== it.rotulo) {
    it.rotulo = r;
    document.querySelectorAll('#intro-rotulos li').forEach((li, i) => { li.classList.toggle('activo', i === r); li.classList.toggle('pasado', r >= 0 && i < r); });
  }
  document.documentElement.classList.toggle('intro-titulo', u < 0.3);
  // sol: hora azul mientras se arma; luego el día corre hasta la hora real de hoy
  const a = ahoraPanama(); S.fecha = { y: a.y, m: a.m, d: a.d };
  const ks = eio(clamp01((u - 0.74) / 0.2));
  S.min = u < 0.74 ? it.m0 : it.m0 + (a.min - it.m0) * ks;
  // cámara: un solo movimiento que llega a la esquina del jardín
  const kc = eio(clamp01(u / 0.96));
  escena.camera.position.lerpVectors(it.cam0, new THREE.Vector3(...ESQUINA.pos), kc);
  controls.target.set(...ESQUINA.tgt);
  escena.camera.lookAt(controls.target);
  // mientras está el título, el edificio se corre a la derecha (desplazamiento de lente, sin mover la cámara)
  escena.camera.filmOffset = innerWidth > 760 ? -6.5 * (1 - sstep(0.3, 0.55, u)) : 0; escena.camera.updateProjectionMatrix();
  if (u >= 0.93) document.documentElement.classList.add('listo');
  if (u >= 1) terminarIntro();
}

function terminarIntro() {
  intro = null;
  U.build.value = 8.4; U.mat.value = 1; U.puntos.value = 0; U.junta.value = 1;
  escena.camera.filmOffset = 0; escena.camera.updateProjectionMatrix();
  escena.liberarParticulas();
  document.documentElement.classList.remove('en-intro', 'intro-titulo');
  document.documentElement.classList.add('listo');
  controls.enabled = true;
  irAAhora(false);
  if (!visto && !location.hash) setTimeout(mostrarOferta, 900);
  const h = location.hash.replace('#', '');
  if (FACHADAS[h]) { irAFachada(h); mostrarQR(h); }
  irAMomentoHash();
}

// ---------------- Bienvenida («¿Primera vez aquí?») ----------------
// Sale una vez, al terminar la intro de quien llega por primera vez. Se va con la primera interacción real (una forma de ver,
// una vista, arrastrar la escena, la regla, Escape). No se va sola: quien llega tarde a mirar la pantalla también la ve.
function mostrarOferta() {
  if (S.paso != null || !$('#sirve').hidden || !$('#ir-a').hidden || !$('#confort').hidden || S.interactuo) return;
  $('#oferta-recorrido').hidden = false;
}
function cerrarOferta() { S.interactuo = true; $('#oferta-recorrido').hidden = true; clearTimeout(mostrarOferta.t); }

/** Enlace directo a un momento: #m-AAAAMMDD-HHMM y, opcionales, lo que se está mirando:
 *  &lente=sol|lluvia|viento|sombras|partes|foto &modo=… &vista=esquina|aerea|planta o &fachada=se|no|ne|so &parte=… y
 *  &cam=x,y,z,tx,ty,tz (posición y punto de mira de la cámara, en m). Ej.: #m-20240325-1530&lente=sol&modo=total&vista=aerea.
 *  Los enlaces viejos, solo con la fecha y la hora, siguen valiendo. */
function irAMomentoHash() {
  const r = /^#m-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(?:&(.*))?$/.exec(location.hash); if (!r) return false;
  const [y, mo, d, hh, mi] = r.slice(1, 6).map(Number), q = new URLSearchParams(r[6] ?? '');
  const lente = LENTES[q.get('lente')] ? q.get('lente') : undefined;
  const modo = lente && MODOS[lente]?.some(([k]) => k === q.get('modo')) ? q.get('modo') : undefined;
  const fachada = FACHADAS['fachada-' + q.get('fachada')] ? q.get('fachada') : undefined;
  const vista = !fachada && VISTAS[q.get('vista')] ? q.get('vista') : undefined;
  const cam = (q.get('cam') ?? '').split(',').map(Number);
  viajarA({ fecha: { y, m: mo, d }, min: hh * 60 + mi, lente, modo, fachada, vista });
  if (lente === 'partes' && PARTES[q.get('parte')]) elegirParte(q.get('parte'));
  if (cam.length === 6 && cam.every(Number.isFinite)) volarA({ pos: cam.slice(0, 3), tgt: cam.slice(3) }, 1.4, vista ?? null, false);
  return true;
}
/** El enlace del momento que se está viendo, con la forma de ver, su modo, la vista o la fachada y el encuadre de la cámara. */
function enlaceMomento() {
  const f = S.fecha, m0 = ((Math.round(S.min) % 1440) + 1440) % 1440, q = [];
  if (S.lente && S.lente !== 'foto') q.push('lente=' + S.lente);
  if (MODO_DE[S.lente] && S[MODO_DE[S.lente]]) q.push('modo=' + S[MODO_DE[S.lente]]);
  if (S.lente === 'partes' && S.parte) q.push('parte=' + S.parte);
  const vistaB = document.querySelector('.vistas [data-vista][aria-pressed="true"]');
  if (S.fachada) q.push('fachada=' + S.fachada.slice(8)); else if (vistaB) q.push('vista=' + vistaB.dataset.vista);
  const c = escena.camera.position, t = controls.target, r1 = (x) => Math.round(x * 10) / 10;
  q.push('cam=' + [c.x, c.y, c.z, t.x, t.y, t.z].map(r1).join(','));
  return `${SITIO}#m-${f.y}${dos(f.m)}${dos(f.d)}-${dos(Math.floor(m0 / 60))}${dos(m0 % 60)}&${q.join('&')}`;
}
async function copiarEnlace() {
  const u = enlaceMomento(), est = $('#img-estado');
  try { await navigator.clipboard.writeText(u); est.textContent = 'Enlace copiado: abre este mismo momento, con la misma forma de ver y el mismo encuadre.'; }
  catch (e) { prompt('Copia este enlace:', u); }
}

// ---------------- Viaje en el tiempo ----------------
// Al saltar a otra fecha el viaje va en dos tramos, para que el reloj del dock nunca diga una hora que el sol no muestra.
// Tramo 1 (0–65 %): corre solo la fecha, día a día; la hora queda en «··:··» y el sol se desliza por el camino más corto
// hasta donde estaría a la hora de salida en el día de llegada (nunca un día tras otro: sin parpadeo de día y noche).
// Tramo 2 (65–100 %): la hora va de la vieja a la nueva por el camino corto (nunca más de 12 h) y el sol sigue su arco
// real de ese día. Dentro del mismo día solo hay tramo 2. La cámara vuela a la vista pedida y, al llegar, entra el tiempo.
const easeViaje = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const TRAMO_FECHA = 0.65;
const marcaT = (f, min) => Date.UTC(f.y, f.m - 1, f.d) + min * 60e3;
const numDia = (f) => Math.round(Date.UTC(f.y, f.m - 1, f.d) / 864e5);
function solDeVector(v) { const alt = Math.asin(Math.max(-1, Math.min(1, v.y))) * 180 / Math.PI; const az = ((EJE_LARGO - Math.atan2(-v.z, v.x) * 180 / Math.PI) % 360 + 360) % 360; return { alt, az }; }
function viajarA(d) {
  parar(); explorar();
  S.mesSerie = null; S.aguacero = false; $('#capa-aguacero').checked = false; S.explica = null;
  S.momento = d.titulo ? { titulo: d.titulo, texto: d.texto ?? '' } : null;
  if (d.lente) ponerLente(d.lente, d.lente !== 'foto' && S.paso == null);
  if (d.modo && MODO_DE[d.lente]) S[MODO_DE[d.lente]] = d.modo;
  if (S.pestana !== 'dia') ponerPestana('dia');
  if (d.fachada) mostrarFachada('fachada-' + d.fachada); else { S.fachada = null; document.documentElement.classList.remove('en-fachada'); }
  const f1 = { y: d.fecha.y, m: d.fecha.m, d: d.fecha.d }, m1 = d.min;
  const dh = Math.abs(marcaT(f1, m1) - marcaT(S.fecha, S.min)) / 3.6e6;
  const T = reduce || d.inmediato ? 0 : Math.min(2800, Math.max(900, 900 + 350 * Math.log10(1 + dh)));
  const vista = d.fachada ? VISTA_FACHADA['fachada-' + d.fachada] : d.vista ? VISTAS[d.vista] : null;
  if (vista) volarA(vista, Math.max(1.2, T / 1000), d.fachada ? null : d.vista, false);
  if (!T) { S.fecha = f1; S.min = m1; S.salto = true; S.viaje = null; S.solViaje = null; U.viaje.value = 0; lastLect = ''; llegada(d); return; }
  const m0 = S.min, dm = ((((m1 - m0) % 1440) + 2160) % 1440) - 720;       // camino corto de la hora: entre −12 h y +12 h
  const mismoDia = f1.y === S.fecha.y && f1.m === S.fecha.m && f1.d === S.fecha.d;
  // el sol del tramo 1: de donde está ahora a donde estaría a la hora de salida en el día de llegada
  const p0 = posicionSol({ ...S.fecha, h: 0, min: m0 }), pA = posicionSol({ ...f1, h: 0, min: m0 });
  const v0 = vectorSol(p0.alt, p0.az), vA = vectorSol(pA.alt, pA.az);
  S.viaje = { t0: performance.now(), T, tramo: mismoDia ? 0 : TRAMO_FECHA, dia0: numDia(S.fecha), dia1: numDia(f1), m0, dm, f1, m1, fase: mismoDia ? 'hora' : 'fecha',
    v0: new THREE.Vector3(v0.x, v0.y, v0.z), vA: new THREE.Vector3(vA.x, vA.y, vA.z), nubes0: nubesSuave, d };
  $('#viaje-destino').textContent = `${f1.d} ${MES3[f1.m - 1]} ${f1.y} · ${hhmm(m1)}`;
  $('#viaje').hidden = false; document.documentElement.classList.add('viajando');
  $('#viaje').classList.remove('llego');
  lastLect = '';
}
const _vs = new THREE.Vector3();
const _vd = new THREE.Vector3(), _vt = new THREE.Vector3();
// profundidad de campo (prototipo): ?dof=0 la apaga; ?margen= (m alrededor del 106), ?rampa= (fracción de la distancia al
// punto más lejano del 106 en que el desenfoque llega al máximo), ?bokeh= (px)
const DOF = (() => { const q = new URLSearchParams(location.search), n = (k, v) => (q.has(k) ? Number(q.get(k)) : v);
  return { on: q.get('dof') !== '0', margen: n('margen', 3), rampa: n('rampa', 0.8), bokeh: n('bokeh', 4) }; })();
let ESQ106 = null;                                   // las 8 esquinas de la caja del 106 (sin sitio, vegetación ni vecinos)
function pasoViaje(now) {
  const V = S.viaje, k = Math.min(1, (now - V.t0) / V.T);
  const kA = V.tramo ? Math.min(1, k / V.tramo) : 1, kB = clamp01((k - V.tramo) / (1 - V.tramo));
  const eA = easeViaje(kA), eB = easeViaje(kB);
  V.fase = kA < 1 ? 'fecha' : 'hora';
  // tramo 1: la fecha, día a día · tramo 2: la hora, por el camino corto
  const dd = new Date((V.dia0 + Math.round((V.dia1 - V.dia0) * eA)) * 864e5);
  S.fecha = { y: dd.getUTCFullYear(), m: dd.getUTCMonth() + 1, d: dd.getUTCDate() };
  S.min = (((V.m0 + V.dm * eB) % 1440) + 1440) % 1440;
  // el sol: en el tramo 1, el camino más corto por el cielo (a lo sumo un cruce del horizonte); en el 2, su arco real (S.solViaje = null)
  if (V.fase === 'hora') S.solViaje = null;
  else { const ang = V.v0.angleTo(V.vA); if (ang < 1e-4) _vs.copy(V.vA); else { _vs.copy(V.v0).multiplyScalar(Math.sin((1 - eA) * ang)).addScaledVector(V.vA, Math.sin(eA * ang)).divideScalar(Math.sin(ang)); } S.solViaje = solDeVector(_vs); }
  U.viaje.value = Math.sin(Math.PI * k);
  $('#viaje-barra').style.transform = `scaleX(${k.toFixed(3)})`;
  if (k >= 1) {
    S.fecha = V.f1; S.min = V.m1; S.viaje = null; S.solViaje = null; U.viaje.value = 0; S.aterrizaje = now; lastLect = '';
    llegada(V.d);
  }
}
function llegada(d) {
  document.documentElement.classList.remove('viajando');
  anunciar();
  if (d.aAhora) { S.modo = 'ahora'; const a = ahoraPanama(); S.fecha = { y: a.y, m: a.m, d: a.d }; S.min = a.min; lastLect = ''; }
  const el = $('#viaje'); el.hidden = false; el.classList.add('llego');
  $('#viaje-barra').style.transform = 'scaleX(1)';
  clearTimeout(llegada.t); llegada.t = setTimeout(() => { el.hidden = true; el.classList.remove('llego'); }, 2600);
}

// ---------------- Cámara ----------------
function volarA(v, dur = 1.6, clave = null, avisar = true) {
  cerrarQR(false);                                       // la tarjeta del QR es solo para quien sigue frente a la fachada
  const p0 = escena.camera.position.clone(), t0 = controls.target.clone();
  const p1 = new THREE.Vector3(...v.pos), t1 = new THREE.Vector3(...v.tgt);
  marcarVista(clave);
  if (p0.distanceTo(p1) < 0.6 && t0.distanceTo(t1) < 0.6) {           // ya estás ahí: un pequeño empujón para que se note
    if (clave && avisar) aviso(`Ya estás en la vista ${clave === 'aerea' ? 'aérea' : clave}.`, 1600);
    cam.anim = { p0: p0.clone().lerp(t0, -0.03), t0, p1, t1, k: 0, dur: reduce ? 0.01 : 0.45, clave };
  } else cam.anim = { p0, t0, p1, t1, k: 0, dur: reduce ? 0.01 : dur, clave };
  controls.enabled = false;
}
function marcarVista(clave) {
  document.querySelectorAll('.vistas [data-vista]').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.vista === clave)); b.style.setProperty('--p', b.dataset.vista === clave ? 0 : 1); });
}
function pasoCamara(dt) {
  const a = cam.anim; if (!a) return false;
  a.k = Math.min(1, a.k + dt / a.dur); const e = eio(a.k);
  if (a.clave) document.querySelector(`.vistas [data-vista="${a.clave}"]`)?.style.setProperty('--p', e.toFixed(3));
  escena.camera.position.lerpVectors(a.p0, a.p1, e);
  // arco suave: sube un poco a mitad de camino para no atravesar el edificio
  escena.camera.position.y += Math.sin(Math.PI * e) * Math.min(30, a.p0.distanceTo(a.p1) * 0.18);
  controls.target.lerpVectors(a.t0, a.t1, e);
  escena.camera.lookAt(controls.target);
  if (a.k >= 1) { cam.anim = null; controls.enabled = !intro; controls.update(); }
  return true;
}
// al empezar a girar desde la esquina, el pivote se desliza al centro del edificio
let deslizar = null;
function alTomar() {
  cerrarOferta();
  document.documentElement.classList.add('girado');
  marcarVista(null);
  if (controls.target.distanceTo(new THREE.Vector3(...CENTRO)) > 2) deslizar = { t0: controls.target.clone(), k: 0 };
}

// ---------------- Avisos para lectores de pantalla ----------------
// #rotulo, #leyenda y #panel-fachada se reescriben con cada minuto simulado. Quedan en silencio (aria-live="off") y solo
// hablan un momento después de algo que el usuario hizo a propósito: nunca mientras se reproduce o se arrastra la regla.
const VIVAS = ['#rotulo', '#leyenda', '#panel-fachada'];
function anunciar(ms = 1500) {
  if (S.reproduce) return;
  VIVAS.forEach((x) => $(x)?.setAttribute('aria-live', 'polite'));
  clearTimeout(anunciar.t); anunciar.t = setTimeout(silenciar, ms);
}
function silenciar() { clearTimeout(anunciar.t); VIVAS.forEach((x) => $(x)?.setAttribute('aria-live', 'off')); }

// ---------------- Clima en la fecha y hora elegidas ----------------
function climaEn(f, min) {
  if (S.viaje) return { fuente: 'viaje', nubes: S.viaje.nubes0 + (35 - S.viaje.nubes0) * Math.min(1, (performance.now() - S.viaje.t0) / S.viaje.T), lluvia: 0, dni: null, temp: null };
  if (S.modo === 'ahora' && clima.vivo) return clima.vivo;
  if (S.mesSerie !== null) { const q = clima.meses[S.mesSerie]; if (q) return { fuente: 'mes', nubes: q.nubes ?? 55, lluviaMes: q.lluvia, lluvia: 0, temp: null }; }
  const r = clima.registro(f, min); if (r) return r;
  // fuera de 2001–2025: se pide el día en línea (una vez); mientras llega, lo típico
  const p = clima.pedirDia(f);
  if (p instanceof Promise && !p._visto) { p._visto = true; p.then(() => { lastLect = ''; }); }
  return clima.registroDia(f, min) ?? { ...clima.tipico(f.m, min), buscando: p instanceof Promise };
}
const intensidad = (mm) => mm < 0.2 ? 0 : Math.min(1, 0.25 + 0.75 * Math.log1p(mm) / Math.log1p(15));

// ---------------- Bucle ----------------
let last = performance.now(), lastHour = -1;
function bucle(now) {
  requestAnimationFrame(bucle);                 // primero: un error en un cuadro no detiene los siguientes
  if (S.pausa) return;
  // el visor de claude.ai precarga la página oculta y sin tamaño: la intro espera a que se vea
  if (innerWidth < 2 || innerHeight < 2) { last = now; return; }
  try { paso(now); } catch (e) { anotar('cuadro', e?.stack?.split('\n').slice(0, 3).join(' ← ') ?? e); }
}
function paso(now) {
  if (S.midiendo) { S.midiendo.tFrame = performance.now(); S.midiendo.giro(); escena.renderer.info.reset(); }
  const dtReal = Math.min(0.25, (now - last) / 1000), dt = Math.min(0.05, dtReal); last = now;
  if (intro) { pasoIntro(dtReal); (S.dtIntro ??= []).push(now - (S.lastIntro ?? now)); S.lastIntro = now; }  // la intro sigue el reloj real
  else if (S.modo === 'ahora') { const a = ahoraPanama(); S.fecha = { y: a.y, m: a.m, d: a.d }; S.min = a.min; }
  if (S.reproduce) pasoReproducir(dt);
  if (S.viaje) pasoViaje(now);
  const moviendo = pasoCamara(dtReal);
  if (!moviendo && !intro) {
    if (deslizar) { deslizar.k = Math.min(1, deslizar.k + dtReal / 0.9); controls.target.lerpVectors(deslizar.t0, new THREE.Vector3(...CENTRO), eio(deslizar.k)); if (deslizar.k >= 1) deslizar = null; }
    // la cámara no baja del nivel de los ojos: el ángulo máximo depende de la distancia
    const d = escena.camera.position.distanceTo(controls.target);
    controls.maxPolarAngle = Math.acos(THREE.MathUtils.clamp((1.4 - controls.target.y) / d, -1, 1));
    controls.update(dt);
  }

  escena.setAlejamiento(escena.camera.position.distanceTo(controls.target));
  // barcos ilustrativos: con «Ahora», el reloj real (al segundo); si no, la hora de la escena. Durante la intro no están.
  if (escena.barcos) {
    if (intro) { for (const b of escena.barcos.barcos) b.visible = false; escena.barcos.firma = ''; }
    else {
      const d = new Date(), real = ((d.getUTCHours() + 19) % 24) * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
      const minB = S.modo === 'ahora' && !S.viaje ? real : S.min, dia = Math.floor(Date.UTC(S.fecha.y, S.fecha.m - 1, S.fecha.d) / 864e5);
      if (escena.barcos.actualizar(minB, dia)) escena.sucio = true;
    }
  }
  // sol
  const p = S.solViaje ?? posicionSol({ ...S.fecha, h: 0, min: S.min });
  const c = climaEn(S.fecha, S.min);
  const nub = c?.nubes ?? 30;
  const salto = !!S.salto; S.salto = false;               // al saltar a un momento, el tiempo se muestra de inmediato
  nubesSuave += (nub - nubesSuave) * (salto ? 1 : Math.min(1, dt * 2.5));
  // sol directo: la DNI del dato frente a la de cielo despejado (la nubosidad total incluye cirros que casi no tapan el sol)
  const dc = dniDespejado(p.alt);
  const kObj = p.alt <= 0.5 ? 1 : c?.dni != null ? clamp01(c.dni / Math.max(40, dc)) : 1 - 0.75 * Math.pow(clamp01(nub / 100), 3.4);
  S.kSol = (S.kSol ?? kObj) + (kObj - (S.kSol ?? kObj)) * (salto ? 1 : Math.min(1, dt * 2.5));
  escena.kSol = S.kSol; escena.nb = nubesSuave / 100;
  escena.setNubes(0.08 + 0.85 * nubesSuave / 100);
  U.nubeSombra.value = 0.25 + 2.4 * S.kSol * (1 - S.kSol);         // las sombras de nubes pesan más con cielo a medias
  escena.luna = p.alt < 2 ? posicionLuna({ ...S.fecha, h: 0, min: S.min }) : null;   // la luna de esa noche (de día no hace falta)
  escena.setSol(p.alt, p.az);
  document.documentElement.classList.toggle('de-noche', p.alt < -4);   // los interruptores y el rótulo de los modos de noche
  if (!S.viaje) escena.setRuta(S.fecha);
  // lluvia: la de los datos (o la del mes en el paso de 25 años), o el aguacero de la capa
  let objetivo = c ? (c.fuente === 'mes' ? Math.min(1, (c.lluviaMes ?? 0) / 380) : intensidad(c.lluvia ?? 0)) : 0;
  if (S.aguacero) objetivo = 1;
  if (intro || S.viaje) objetivo = 0;
  // al llegar de un viaje la lluvia entra rápido (~0,6 s); en el resto, suave
  const vel = S.viaje ? 5 : now - (S.aterrizaje ?? -1e9) < 1500 ? 3.2 : 1.4;
  lluviaSuave += (objetivo - lluviaSuave) * (salto ? 1 : Math.min(1, dt * vel));
  U.lluvia.value = lluviaSuave; escena.lv = Math.min(1, lluviaSuave * 1.1);
  // mojado: llueve ahora, o todavía no se seca lo que llovió en las horas anteriores (sale de la serie de datos)
  const conSerie = c && (c.fuente === 'serie' || c.fuente === 'dia');
  const secando = conSerie ? clima.mojado(S.fecha, S.min) ?? 0 : 0;
  const mojadoObj = Math.max(lluviaSuave > 0.08 ? 1 : 0, secando);
  // con serie, el secado ya viene en el dato y se sigue rápido; sin ella (tiempo real, valores típicos) se seca despacio, como antes
  U.mojado.value += (mojadoObj - U.mojado.value) * (salto ? 1 : Math.min(1, dt * (mojadoObj > U.mojado.value ? 0.8 : conSerie ? 0.6 : 0.05)));
  if (c?.viento != null && c?.dir != null) {
    const w = vectorSol(0, (c.dir + 180) % 360); const k = 0.4 + c.viento / 12; U.viento.value.set(w.x * k, w.z * k);
    const n = Math.hypot(w.x, w.z) || 1; U.vientoDir.value.set(w.x / n, w.z / n);
  }
  // la vegetación se mece con el viento de esa hora (el vaivén se ve mientras la escena se redibuja)
  const brisaObj = intro || S.viaje ? 0 : clamp01((c?.viento ?? 0) / 35);
  U.brisa.value += (brisaObj - U.brisa.value) * (salto ? 1 : Math.min(1, dt * 1.5));
  if (escena.actualizar(dt)) sonido.trueno();
  const solAnio = S.lente === 'sol' && S.solModo === 'anio';
  U.calor.value += ((S.lente === 'sol' && !solAnio ? 1 : 0) - U.calor.value) * Math.min(1, dt * 4);
  U.agua.value += ((S.lente === 'lluvia' || S.lente === 'viento' || solAnio ? 1 : 0) - U.agua.value) * Math.min(1, dt * 4);
  U.total.value += ((S.solModo === 'total' && S.hayDifusa ? 1 : 0) - U.total.value) * Math.min(1, dt * 4);
  escena.uViento.value += ((S.lente === 'viento' && !S.viaje ? 1 : 0) - escena.uViento.value) * Math.min(1, dt * 4);
  U.sombras.value += ((S.lente === 'sombras' && !S.viaje ? 1 : 0) - U.sombras.value) * Math.min(1, dt * 4);
  // profundidad de campo: el 106 entero siempre nítido. La franja nítida va de su punto más cercano al más lejano a lo largo de
  // la mirada (las 8 esquinas de su caja, más un margen); lo que queda fuera se desenfoca. Antes del modelo: el punto que se mira
  const dirCam = escena.camera.getWorldDirection(_vd);
  let cerca = Infinity, lejos = -Infinity;
  if (ESQ106) for (const e of ESQ106) { const z = _vt.subVectors(e, escena.camera.position).dot(dirCam); cerca = Math.min(cerca, z); lejos = Math.max(lejos, z); }
  else cerca = lejos = _vt.subVectors(controls.target, escena.camera.position).dot(dirCam);
  cerca = Math.max(0.5, cerca - DOF.margen); lejos = Math.max(cerca + 1, lejos + DOF.margen);
  escena.uFoco.value = (cerca + lejos) / 2; escena.uBanda.value = (lejos - cerca) / 2;
  escena.uRampa.value = Math.max(20, lejos * DOF.rampa); escena.uBokeh.value = DOF.bokeh;
  const desenfoque = DOF.on && S.lente !== 'sombras' && !S.fachada && dirCam.y > -0.8 ? 1 : 0;      // en planta, sombras o fachada: nítido
  escena.uDesenfoque.value += (desenfoque - escena.uDesenfoque.value) * Math.min(1, dt * 3);
  if (S.lente === 'sombras' && !S.viaje) escena.setDiagrama(S.fecha);
  actualizarCalor(p, c);
  actualizarAgua(c);
  if (S.lente === 'viento') {
    const clave = S.vientoModo === 'hora' ? `h|${S.vientoDato ? Math.round(c.dir / 5) + '|' + Math.round(c.viento) : '-'}` : S.vientoModo + (consultas ? '1' : '0');
    if (clave !== S.claveRosa) {
      S.claveRosa = clave;
      if (S.vientoModo === 'hora') escena.dibujarViento({ hora: true, dir: S.vientoDato ? c.dir : 0, v: S.vientoDato ? c.viento : 0 });
      else if (consultas?.viento) escena.dibujarViento(consultas.viento[S.vientoModo]);
    }
  }
  // ayudas de orientación: la rosa y el arco del sol se ven desde arriba
  const alto = escena.camera.position.y;
  const ay = S.ayudas && !intro ? 1 : 0;
  escena.uRosa.value += (ay * sstep(8, 45, alto) - escena.uRosa.value) * Math.min(1, dt * 4);
  const abajo = -escena.camera.getWorldDirection(_c).y;              // 1 = mirando hacia abajo
  escena.uRuta.value += (ay * sstep(4, 30, alto) * (0.35 + 0.65 * sstep(0.5, 0.95, abajo)) - escena.uRuta.value) * Math.min(1, dt * 4);
  // sonido
  sonido.actualizar({ dron: intro ? 0.35 : 0.55, velocidad: intro ? 0.3 : 0, alt: p.alt, lluvia: U.lluvia.value, cenit: p.alt > 89 });
  const hr = Math.floor(S.min / 60); if (hr !== lastHour) { if (lastHour >= 0 && S.reproduce) sonido.clic(); lastHour = hr; }
  brujula(p);
  lecturas(p, c);
  if (!intro) plegarRotulo(now);
  encuadreMovil(dtReal);
  esquivarHoras();
  // dibujar solo cuando algo cambia
  const cp = escena.camera.position, ct = controls.target;
  const firma = [cp.x, cp.y, cp.z, ct.x, ct.y, ct.z].map((v) => Math.round(v * 60)).join(',') + '|' +
    [U.build.value * 500, U.mat.value * 200, S.min * 4, nubesSuave * 4, (S.kSol ?? 1) * 200, U.calor.value * 100, U.agua.value * 100, U.sombras.value * 100, U.total.value * 100, escena.uViento.value * 100, U.viaje.value * 100, U.mojado.value * 200, U.brisa.value * 100, escena.uRosa.value * 100, escena.uRuta.value * 100, (p.alt ?? 0) * 20, (p.az ?? 0) * 20].map(Math.round).join(',') +
    `|${S.fecha.y}-${S.fecha.m}-${S.fecha.d}|${innerWidth}x${innerHeight}|${Math.round(ENC.dy)}`;
  const anima = !!intro || !!escena.particulas || U.lluvia.value > 0.01 || U.relampago.value > 0 || !!S.midiendo || !!S.viaje;
  if (firma !== S.firma || anima || escena.sucio || now - (S.ultimoCambio || 0) < 500) {
    if (firma !== S.firma) { S.firma = firma; S.ultimoCambio = now; }
    escena.render(); S.dibujados = (S.dibujados || 0) + 1;
    if (S.midiendo) { const r0 = performance.now(); S.midiendo.cpu.push(r0 - S.midiendo.tFrame); S.midiendo.dts.push(now - S.midiendo.last); S.midiendo.last = now; }
    else medirCuadro(now, dtReal);
  } else S.dibujoPrevio = false;
  pintarPartes();
  if (S.voladizo) pintarCorte(p);
}

// ---------------- Encuadre en el teléfono ----------------
// En pantallas angostas los paneles de abajo (la barra del tiempo, el rótulo, la tarjeta del recorrido) tapan casi la mitad
// de la imagen y el edificio quedaba debajo, sobre todo en planta. La vista se corre en vertical (desplazamiento de lente con
// setViewOffset: la cámara no se mueve y las etiquetas, que proyectan con la misma cámara, siguen en su lugar) para que el
// punto que se mira quede en el centro del hueco libre entre los botones de arriba y el panel más alto de abajo.
// En escritorio no cambia nada.
const ENC = { dy: 0, aplicado: 0 };
const PANELES_ABAJO = ['#dock', '#rotulo', '#recorrido', '#oferta-recorrido', '#viaje'];
function encuadreMovil(dt) {
  const W = innerWidth, H = innerHeight;
  let obj = 0;
  if (W <= 760 && !intro) {
    const arriba = $('#hud')?.getBoundingClientRect().bottom ?? 0;
    let abajo = H;
    for (const q of PANELES_ABAJO) { const r = $(q)?.getBoundingClientRect(); if (r && r.height > 0 && r.top > H * 0.3) abajo = Math.min(abajo, r.top); }
    if (abajo - arriba > 60) obj = (arriba + abajo) / 2 - H / 2;
  }
  ENC.dy += (obj - ENC.dy) * (reduce ? 1 : Math.min(1, dt * 5));
  if (Math.abs(obj - ENC.dy) < 0.5) ENC.dy = obj;
  if (Math.abs(ENC.dy - ENC.aplicado) < 0.25 && ENC.W === W && ENC.H === H) return;
  ENC.aplicado = ENC.dy; ENC.W = W; ENC.H = H;
  const cam = escena.camera;
  if (Math.abs(ENC.dy) < 0.5) cam.clearViewOffset(); else cam.setViewOffset(W, H, 0, -ENC.dy, W, H);
}

// ---------------- Resolución adaptable ----------------
// Mira el intervalo entre cuadros dibujados seguidos. Baja la resolución si el equipo no alcanza la frecuencia de la
// pantalla y la vuelve a subir cuando va fluido. No cuenta la intro, los viajes, la página oculta ni los tirones de carga.
// (Antes solo subía por debajo de 12 ms por cuadro, algo imposible a 60 Hz: una vez que bajaba, se quedaba baja.)
const RES = { iv: [], minIv: 16.7, techo: 0, tTecho: -1e9, fija: false };
// máxima nitidez por defecto (pedido de LM): solo se apaga si alguien la desmarca en Capas
try { RES.fija = localStorage.getItem('e106-nitidez') !== '0'; } catch (e) { RES.fija = true; }
function medirCuadro(now, dtReal) {
  const iv = dtReal * 1000, previo = S.dibujoPrevio; S.dibujoPrevio = true;
  if (RES.fija) { if (Math.abs(escena.renderer.getPixelRatio() - escena.dprMax()) > 0.01) { escena.fijarResolucion(escena.dprMax()); pintarResolucion(); } return; }
  if (!previo || intro || S.viaje || iv > 90 || document.visibilityState !== 'visible') return;
  RES.iv.push(iv); if (RES.iv.length < 50) return;
  const a = RES.iv.sort((x, y) => x - y), med = a[a.length >> 1], p10 = a[Math.floor(a.length * 0.1)]; RES.iv = [];
  RES.minIv = Math.max(6, Math.min(RES.minIv, p10));             // la frecuencia de la pantalla (16,7 ms a 60 Hz, 8,3 a 120 Hz)
  const d = escena.renderer.getPixelRatio(), max = escena.dprMax();
  if (med > RES.minIv * 1.5 && d > 0.6) { RES.techo = d; RES.tTecho = now; escena.fijarResolucion(d - 0.1); pintarResolucion(); }
  else if (med < RES.minIv * 1.15 && d < max - 0.005) {
    if (d + 0.1 >= RES.techo - 0.001 && now - RES.tTecho < 30000) return;    // no volver en seguida al nivel que ya pesó
    escena.fijarResolucion(Math.min(max, d + 0.1)); pintarResolucion();
  }
}
function pintarResolucion() {
  const el = $('#res-actual'); if (!el || !escena) return;
  const d = escena.renderer.getPixelRatio(), max = escena.dprMax();
  el.textContent = RES.fija ? `Fija al máximo: ${f1(d, 2)}×.` : `Ahora: ${f1(d, 2)}× de un máximo de ${f1(max, 2)}×${d < max - 0.005 ? ' (el equipo va justo; sube sola cuando va fluido)' : ''}.`;
}

// ---------------- GPU: errores, pérdida del dispositivo y paso automático a WebGL ----------------
function vigilarGPU() {
  const dev = escena.renderer.backend?.device; if (!dev) return;
  dev.addEventListener('uncapturederror', (e) => {
    if (innerWidth < 2 || innerHeight < 2 || document.visibilityState === 'hidden') { anotar('aviso', 'GPU con la página oculta: ' + (e.error?.message ?? '')); return; }
    DIAG.gpu++; anotar('GPU', e.error?.message ?? e.error);
    if (DIAG.gpu >= 3) rescatar('la tarjeta gráfica rechazó cuadros');
  });
  dev.lost.then((i) => { if (i.reason === 'destroyed' && rescatando) return; anotar('GPU perdida', `${i.reason ?? ''} ${i.message ?? ''}`); rescatar('se perdió la tarjeta gráfica'); });
}
let rescatando = false;
async function rescatar(motivo) {
  if (rescatando || escena?.backend !== 'WebGPU') return;
  rescatando = true; S.pausa = true;
  anotar('rescate', `${motivo}: paso a WebGL`);
  try { localStorage.setItem('e106-motor', 'webgl'); } catch (e) { /* sin almacenamiento */ }
  try {
    await escena.pasarAWebGL();
    controls.disconnect(); controls.connect(escena.renderer.domElement);
    document.documentElement.dataset.backend = escena.backend; $('#motor').textContent = escena.backend;
    S.firma = ''; escena.sucio = true;
    aviso('WebGPU falló en este equipo. La escena sigue en modo compatible (WebGL 2).');
  } catch (e) { anotar('rescate', e); try { location.reload(); } catch (e2) { /* nada */ } }
  S.pausa = false; rescatando = false; pintarDiag();
}
function aviso(t, ms = 6000) {
  let el = $('#aviso'); if (!el) { el = document.createElement('div'); el.id = 'aviso'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = t; el.classList.add('ver'); clearTimeout(aviso.t); aviso.t = setTimeout(() => el.classList.remove('ver'), ms);
}

// ---------------- Calor en fachadas ----------------
function actualizarCalor(p, c) {
  let dni = dniDespejado(p.alt);
  if (c?.dni != null) dni = c.dni;                                  // valor de esa hora en la serie
  else dni *= 1 - 0.75 * Math.pow(Math.min(1, (c?.nubes ?? 30) / 100), 3.4); // nubosidad (Kasten y Czeplak, 1980): es una ley para la global, no para la directa; solo de respaldo cuando no hay dato
  if (p.alt <= 0) dni = 0;
  const sa = Math.max(0, Math.sin(p.alt * Math.PI / 180));
  const dhi = p.alt > 0 ? c?.difusa ?? null : 0, ghi = dni * sa + (dhi ?? 0);
  S.hayDifusa = dhi != null;
  // cielo anisótropo (Hay-Davies): la parte de la difusa que viene de alrededor del sol (Ai) es la DNI frente a la de fuera de
  // la atmósfera ese día (1.367 W/m² con la excentricidad de la órbita); la misma cuenta que la lente y consultas.py
  const dia = (Date.UTC(S.fecha.y, S.fecha.m - 1, S.fecha.d) - Date.UTC(S.fecha.y, 0, 0)) / 864e5;
  const ai = Math.min(1, Math.max(0, dni / (1367 * (1 + 0.033 * Math.cos(2 * Math.PI * dia / 365)))));
  U.dniW.value = dni; U.dhiW.value = dhi ?? 0; U.ghiW.value = ghi; U.ai.value = ai;
  // números por orientación: una pared sin alero de cada fachada (la escena, en cambio, cuenta la sombra real punto por punto)
  // difusa de una pared vertical: DHI · [Ai · Rb + (1 − Ai) / 2], con Rb = cos(incidencia) / cos(cenit), cenit acotado a 85°
  const tot = S.solModo === 'total' && dhi != null;
  S.irr = Object.keys(FACHADAS).map((k) => {
    const ci = incidencia(p.alt, p.az, FACHADAS[k].rumbo), rb = sa > 0 ? ci / Math.max(sa, 0.087) : 0;
    return ci * dni + (tot ? dhi * (ai * rb + (1 - ai) * 0.5) + 0.1 * ghi : 0);
  });
  S.irrTecho = dni * sa + (tot ? dhi : 0);
}

// ---------------- Lluvia con viento en fachadas (índice de ISO 15927-3 en campo abierto) ----------------
// I = (2/9) · v · r^(8/9) · cos(D − θ), en L/m² por hora: v en m/s (10 m), r en mm/h, D = de dónde viene el viento.
function lluviaBatiente(r, vKmh, dir, rumbo) { const c = Math.cos((dir - rumbo) * Math.PI / 180); return c > 0 && r > 0 ? 2 / 9 * (vKmh / 3.6) * Math.pow(r, 8 / 9) * c : 0; }
// las leyendas se arman con los mismos colores de las lentes: el shader los usa en RGB lineal y la CSS los pide en sRGB
const hexLin = (c) => '#' + new THREE.Color().setRGB(c[0], c[1], c[2]).getHexString();
const rampaCSS = (paradas) => `linear-gradient(90deg, ${paradas.map((c, i) => `${hexLin(c)} ${Math.round(100 * i / (paradas.length - 1))}%`).join(', ')})`;
const PAL = { lluvia: [[0.05, 0.07, 0.1], [0.08, 0.42, 0.9], [0.6, 0.9, 1.0]], viento: [[0.03, 0.08, 0.07], [0.1, 0.62, 0.48], [0.78, 1.0, 0.86]],
  sol: [[0.01, 0.03, 0.22], [0.85, 0.12, 0.02], [1.0, 0.85, 0.15]] };
const SOL_ANIO_MAX = 1000;
/** Rampa y rótulos de la leyenda de la lente, según el modo: con números y diciendo si la escala es fija o relativa. */
function leyendaLente(L) {
  const anioSol = S.lente === 'sol' && S.solModo === 'anio';
  if (anioSol) return { c: rampaCSS(PAL.sol), esc: ['0', '500', `≥${miles(SOL_ANIO_MAX)} kWh/m² año`] };
  if (S.lente === 'lluvia') {
    if (S.aguaModo === 'anio' && consultas?.lluviaViento) { const m = Math.max(...Object.values(consultas.lluviaViento).map((x) => x.anual ?? 0));
      return { c: L.rampa, esc: ['0', '', `${dec(m)} L/m² año · relativa`] }; }
    return { c: L.rampa, esc: ['0', '2,5', '≥5 L/m² en la hora'] };
  }
  if (S.lente === 'viento') {
    if (S.vientoModo !== 'hora' && consultas?.viento) { const m = Math.max(1, ...Object.values(consultas.viento[S.vientoModo].frente));
      return { c: L.rampa, esc: ['0', '', `~${miles(Math.round(m / 100) * 100)} h · relativa`] }; }
    return { c: L.rampa, esc: ['0', '7,5', '≥15 km/h de frente'] };
  }
  return L.rampa ? { c: L.rampa, esc: L.esc } : null;
}
function actualizarAgua(c) {
  const ks = Object.keys(FACHADAS), pal = PAL[S.lente === 'viento' ? 'viento' : S.lente === 'sol' ? 'sol' : 'lluvia'];
  U.pal0.value.setRGB(...pal[0]); U.pal1.value.setRGB(...pal[1]); U.pal2.value.setRGB(...pal[2]);
  if (S.lente === 'sol') {                                       // año típico: total anual por orientación, escala fija de 0 a 1.000 kWh/m²
    // (las paredes van de ~600 a ~900; con una escala hasta 1.800 la diferencia no se veía; el techo, ~1.800, queda en el tope)
    const R = consultas?.radiacion;
    U.aguaF.value.set(...ks.map((k) => R ? Math.min(1, R.fachadas[k.slice(8)].total / SOL_ANIO_MAX) : 0));
    U.aguaT.value = R ? Math.min(1, R.techo.total / SOL_ANIO_MAX) : 0;
    return;
  }
  U.aguaT.value = 0;
  if (S.lente === 'viento') {
    if (S.vientoModo !== 'hora' && consultas?.viento) {
      const V = consultas.viento[S.vientoModo]; S.vientoF = ks.map((k) => V.frente[k.slice(8)]);
      const m = Math.max(1, ...S.vientoF); U.aguaF.value.set(...S.vientoF.map((v) => v / m));
    } else {
      const ok = !!c && c.viento != null && c.dir != null && ['serie', 'dia', 'vivo'].includes(c.fuente);
      S.vientoDato = ok;
      S.vientoF = ks.map((k) => ok ? Math.max(0, Math.cos((c.dir - FACHADAS[k].rumbo) * Math.PI / 180)) * c.viento : 0);
      U.aguaF.value.set(...S.vientoF.map((v) => Math.min(1, v / 15)));
    }
    return;
  }
  if (S.aguaModo === 'anio' && consultas?.lluviaViento) {
    const L = consultas.lluviaViento, m = Math.max(...ks.map((k) => L[k.slice(8)].anual));
    S.agua = ks.map((k) => L[k.slice(8)].anual); U.aguaF.value.set(...S.agua.map((v) => v / m));
  } else {
    const ok = c && c.lluvia != null && c.viento != null && c.dir != null && (c.fuente === 'serie' || c.fuente === 'dia' || c.fuente === 'vivo');
    S.agua = ks.map((k) => ok ? lluviaBatiente(c.lluvia, c.viento, c.dir, FACHADAS[k].rumbo) : 0);
    S.aguaDato = ok;
    U.aguaF.value.set(...S.agua.map((v) => Math.min(1, v / 5)));
  }
}

// ---------------- Brújula: el norte real en pantalla ----------------
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
let lastBruj = '';
function brujula(p) {
  const t = controls.target;
  _a.set(t.x, 0, t.z).project(escena.camera); _b.set(t.x + NORTE.x * 20, 0, t.z + NORTE.z * 20).project(escena.camera);
  const dx = (_b.x - _a.x) * innerWidth, dy = (_b.y - _a.y) * innerHeight;
  const ang = Math.atan2(dx, dy) * 180 / Math.PI;                  // 0 = el norte apunta hacia arriba de la pantalla
  const fwd = _a.copy(t).sub(escena.camera.position); fwd.y = 0;
  const rumbo = ((Math.atan2(fwd.x * ESTE.x + fwd.z * ESTE.z, fwd.x * NORTE.x + fwd.z * NORTE.z) * 180 / Math.PI) + 360) % 360;
  const clave = [Math.round(ang * 2), Math.round(p.az), p.alt > 0 ? 1 : 0, Math.round(rumbo / 22.5)].join(',');
  if (clave === lastBruj) return; lastBruj = clave;
  $('#rosa-g').setAttribute('transform', `rotate(${ang.toFixed(1)})`);
  const r = (p.az) * Math.PI / 180;
  const sol = $('#brujula-sol'); sol.setAttribute('cx', (40 * Math.sin(r)).toFixed(1)); sol.setAttribute('cy', (-40 * Math.cos(r)).toFixed(1));
  sol.style.opacity = p.alt > 0 ? 1 : 0.28;
  $('#mirando').textContent = fwd.lengthSq() > 1 ? `Miras hacia el ${rumboTexto(rumbo)}` : 'Vista desde arriba';
}

// ---------------- Lecturas y rótulo ----------------
let lastLect = '';
function lecturas(p, c) {
  const kf = `${S.fecha.y}-${S.fecha.m}-${S.fecha.d}`;
  if (kf !== S.kf && !S.viaje) { S.kf = kf; dibujarReglas(); }
  const kc = kf + '|' + (clima.horario ? 1 : 0) + '|' + (clima.dias[kf2(S.fecha)] ? (clima.dias[kf2(S.fecha)] instanceof Promise ? 1 : 2) : 0) + '|' + (clima.ok ? 1 : 0);
  if (kc !== S.kClimaDia && !S.viaje) { S.kClimaDia = kc; pintarClimaDia(); }
  const key = [kf, Math.round(S.min), S.modo, S.pestana, S.mesSerie, c?.fuente, Math.round((c?.temp ?? 0) * 10), Math.round(c?.nubes ?? -1), Math.round((c?.lluvia ?? 0) * 10), Math.round((c?.dni ?? 0) / 10), S.fachada, S.lente, S.aguaModo, S.viaje?.fase].join('|');
  confortHora(p, c);                              // el punto de la carta y la línea de UTCI, si el panel está abierto
  if (key === lastLect) return; lastLect = key;
  const vivo = S.modo === 'ahora', V = S.viaje;
  // en el viaje, mientras corre la fecha, la hora no se muestra: todavía no es la de ningún momento real
  $('#l-hora').textContent = V?.fase === 'fecha' ? '··:··' : hhmm(S.min);
  // fecha larga y corta (la corta es la del teléfono: «26 sep 2026»); el CSS muestra una u otra
  const larga = S.mesSerie !== null ? `${MESES[S.fecha.m - 1]} de ${S.fecha.y}` : fechaTexto(S.fecha);
  const corta = S.mesSerie !== null ? `${MES3[S.fecha.m - 1]} ${S.fecha.y}` : fechaCorta(S.fecha);
  const lf = $('#l-fecha'); if (!lf.firstChild) lf.innerHTML = '<span class="larga"></span><span class="corta"></span>';
  lf.children[0].textContent = larga; lf.children[1].textContent = corta;
  document.documentElement.classList.toggle('vivo', vivo);
  $('#ahora').textContent = vivo ? 'Ahora' : 'Volver a ahora';
  $('#ahora').setAttribute('aria-pressed', String(vivo));
  // sol y sombra (en el viaje, «—», como el clima: el sol va de paso, no es el de un momento)
  const sp = sombraPoste(p.alt, p.az);
  if (V) { $('#l-alt').textContent = '—'; $('#l-az').textContent = ''; $('#l-sombra').textContent = '—'; $('#l-sombra-r').textContent = ''; }
  else {
    $('#l-alt').textContent = p.alt > -0.5 ? f1(p.alt) + '°' : 'bajo el horizonte';
    $('#l-az').textContent = p.alt > -0.5 ? `hacia el ${rumboTexto(p.az)} · ${Math.round(p.az)}°` : `${f1(-p.alt)}° bajo el horizonte`;
    $('#l-sombra').textContent = sp ? (sp.largo > 99 ? '> 99 m' : f1(sp.largo, 2) + ' m') : 'sin sol';
    $('#l-sombra-r').textContent = sp ? `se proyecta hacia el ${rumboTexto(sp.rumbo)}` : 'no hay sombra solar';
  }
  // clima
  let temp = '—', det = '', fuente = '';
  if (c?.fuente === 'viaje') { det = 'viajando…'; }
  else if (c) {
    if (c.temp != null) temp = Math.round(c.temp) + ' °C';        // en enteros: ERA5 no sostiene las décimas en una celda de ~28 km
    // línea 1: cielo · línea 2: lluvia (o la diferencia con lo típico)
    const cielo = [];
    if (c.nubes != null) cielo.push(`${Math.round(c.nubes)} % nubes`);
    if (c.dni != null && p.alt > 2) cielo.push(`sol ${miles(Math.round(c.dni / 10) * 10)} W/m²`);
    let agua = '';
    if (c.fuente === 'mes') { temp = `${Math.round(c.lluviaMes)} mm`; agua = 'de lluvia en el mes'; }
    else if (c.fuente === 'tipico') agua = `llueve en ${Math.round(c.probLluvia)} % de estas horas`;
    else agua = (c.lluvia ?? 0) >= 0.1 ? `lluvia ${f1(c.lluvia)} mm/h` : c.llovizna ? 'llovizna leve en la zona' : 'sin lluvia';
    if (c.fuente === 'vivo') {
      const tip = clima.tipico(S.fecha.m, S.min);
      if (tip) { const dT = c.temp - tip.temp; if (Math.abs(dT) >= 1) agua += ` · ${dT >= 0 ? '+' : '−'}${Math.round(Math.abs(dT))} °C vs. típico (pronóstico frente a la mediana de ERA5)`; }
    }
    det = cielo.join(' · ') + '\n' + agua;
    if (c.fuente === 'vivo') fuente = `Pronóstico de modelo (Open-Meteo), ${c.hora}. El sol es calculado.`;
    else if (c.fuente === 'serie') fuente = `Dato de esa hora: ${clima.r?.era5 ? 'reanálisis ERA5' : 'archivo histórico'} (Open-Meteo), celda de ~28 km.`;
    else if (c.fuente === 'dia') fuente = c.modelo === 'era5' ? 'Dato de esa hora: reanálisis ERA5 (Open-Meteo), consultado en línea. Celda de ~28 km.' : 'Dato de esa hora: modelo de pronóstico de Open-Meteo (días recientes o próximos), consultado en línea.';
    else if (c.fuente === 'mes') fuente = `Total del mes en la serie 2001–2025 (Open-Meteo).`;
    else fuente = vivo ? (globalThis.MODELO_B64 ? 'Típico para esta fecha y hora (2001–2025). En esta vista previa no hay conexión al tiempo real.' : 'Típico para esta fecha y hora (2001–2025): no se pudo leer el tiempo real.')
      : c.buscando ? 'Buscando el dato de ese día en Open-Meteo…' : globalThis.MODELO_B64 ? 'Típico para esta fecha y hora (mediana 2001–2025). Fuera de 2001–2025 el dato exacto se consulta en línea, y esta vista previa no tiene conexión.' : 'Típico para esta fecha y hora (mediana 2001–2025): no hay dato en línea para ese día.';
  }
  $('#l-temp').textContent = temp; $('#l-clima').textContent = det; $('#l-fuente').textContent = fuente;
  // resumen de una línea para el teléfono: solo los valores
  // sello corto de procedencia, siempre visible (en el teléfono la línea larga de la fuente no se muestra)
  const sello = !c || V ? '' : c.fuente === 'vivo' ? 'pronóstico' : c.fuente === 'serie' || (c.fuente === 'dia' && c.modelo === 'era5') ? 'ERA5' : c.fuente === 'dia' ? 'modelo' : c.fuente === 'mes' ? 'ERA5, mes' : 'típico';
  $('#lect-resumen-t').textContent = V ? 'Viajando…' : (sp ? `Sol ${$('#l-alt').textContent} · sombra ${$('#l-sombra').textContent} · ${temp}` : `Sol bajo el horizonte · ${temp}`) + (sello ? ` · ${sello}` : '');
  // estado de la barra (quieto durante el viaje: solo corren el dock y la tarjeta «Viajando a»)
  const est = $('#estado-txt');
  if (V) { /* se actualiza al llegar */ }
  else if (vivo) est.textContent = c?.fuente === 'vivo' ? `En vivo · ${hhmm(S.min)} · ${f1(c.temp)} °C · ${Math.round(c.nubes)} % nubes` : `Ahora · ${hhmm(S.min)} en Panamá`;
  else est.textContent = `Explorando · ${S.mesSerie !== null ? MESES[S.fecha.m - 1] + ' de ' + S.fecha.y : fechaTexto(S.fecha)}`;
  // agujas y controles
  $('#hora').value = Math.round(S.min) % 1440;
  $('#dia-anio').value = diaDelAnio(S.fecha);
  $('#hora').setAttribute('aria-valuetext', hhmm(S.min));
  $('#dia-anio').setAttribute('aria-valuetext', fechaTexto(S.fecha));
  const xd = (S.min % 1440) / 1440 * 1000; $('#dia-aguja').setAttribute('x1', xd); $('#dia-aguja').setAttribute('x2', xd);
  const xa = diaDelAnio(S.fecha) / 364 * 1000; $('#anio-aguja').setAttribute('x1', xa); $('#anio-aguja').setAttribute('x2', xa);
  const im = (S.fecha.y - 2001) * 12 + S.fecha.m - 1;
  const enSerie = im >= 0 && im < 300;
  $('#mes-serie').value = Math.max(0, Math.min(299, im));
  $('#mes-serie').setAttribute('aria-valuetext', enSerie ? `${MESES[S.fecha.m - 1]} de ${S.fecha.y}` : `${MESES[S.fecha.m - 1]} de ${S.fecha.y}, fuera de 2001–2025`);
  const xs = (Math.max(0, Math.min(299, im)) + 0.5) / 300 * 1000; $('#dec-aguja').setAttribute('x1', xs); $('#dec-aguja').setAttribute('x2', xs);
  $('#dec-aguja').style.opacity = enSerie ? 1 : 0.25;
  rotulo(p, c, sp);
  leyenda(c);
  marcaSol(p);
  if (S.fachada) { if (V) $('#fachada-texto').textContent = `Viajando al ${fechaTexto(V.f1)}, a las ${hhmm(V.m1)}.`; else textoFachada(p, c); }
  // fachadas: irradiancia
  Object.keys(FACHADAS).forEach((k, i) => {
    const el = document.querySelector(`[data-fachada="${k}"]`); if (!el) return;
    const v = S.irr?.[i] ?? 0; el.querySelector('i').style.setProperty('--v', Math.min(1, v / 800)); el.querySelector('b').textContent = miles(v) + ' W/m²';
  });
}

// el pequeño sol de la marca sigue la hora que muestra la escena
function marcaSol(p) {
  const { sale, pone } = saleYPone(S.fecha.y, S.fecha.m, S.fecha.d);
  const q = clamp01((S.min - sale) / (pone - sale)), ang = Math.PI * (1 - q), el = $('#marca-sol');
  el.setAttribute('cx', (19 + 16 * Math.cos(ang)).toFixed(2)); el.setAttribute('cy', (20 - 16 * Math.sin(ang)).toFixed(2));
  el.style.opacity = p.alt > -1 ? 1 : 0.25;
}

/** Qué luz hay de noche, en dos frases: depende de si la luna está arriba, de su fase y de las nubes de esa hora. Lo que es
 *  supuesto (las ventanas encendidas, la lámpara del poste) se explica en la lente Foto, no aquí. */
function textoNoche(c) {
  const L = escena.luna, nub = c?.nubes ?? 30, llueve = (c?.lluvia ?? 0) >= 0.1;
  const fase = !L ? '' : L.frac > 0.95 ? 'la luna llena' : L.frac < 0.45 ? `una luna ${L.fase < 180 ? 'creciente' : 'menguante'} delgada` : `la luna ${L.fase < 180 ? 'creciente' : 'menguante'}`;
  if (!L || L.alt <= 0) return 'Es de noche y la luna no está en el cielo. Alumbran solo el cielo de la ciudad y el poste de la esquina.';
  if (L.frac < 0.05) return 'Es de noche y es casi luna nueva. Alumbran solo el cielo de la ciudad y el poste de la esquina.';
  if (llueve || nub >= 70) return `Es de noche y ${llueve ? 'llueve; ' : ''}las nubes tapan ${fase}. Alumbran el resplandor de la ciudad en las nubes y el poste de la esquina.`;
  return `Es de noche y alumbra ${fase}, hacia el ${rumboTexto(L.az)}. Suman algo el cielo de la ciudad y el poste de la esquina.`;
}

function rotulo(p, c, sp) {
  const tipo = $('#rotulo-tipo'), txt = $('#rotulo-texto');
  const cerrar = $('#rotulo-cerrar');
  // de noche, dos atajos para ver el mismo día con luz
  const noche = !S.viaje && !S.explica && !S.momento && S.mesSerie === null && p.alt <= -6;
  $('#rotulo-noche').hidden = !noche;
  if (noche) {
    const a = ahoraPanama(), hoy = S.fecha.y === a.y && S.fecha.m === a.m && S.fecha.d === a.d;
    $('#noche-dia').textContent = hoy ? 'Ver hoy a las 9:00' : 'Ver este día a las 9:00';
    $('#noche-atardecer').textContent = `Ver el atardecer ${hoy ? 'de hoy' : 'de ese día'} (${hhmm(saleYPone(S.fecha.y, S.fecha.m, S.fecha.d).pone)})`;
  }
  if (S.viaje) { cerrar.hidden = true; tipo.textContent = 'Viajando en el tiempo'; txt.textContent = `Hacia el ${fechaTexto(S.viaje.f1)}, a las ${hhmm(S.viaje.m1)}.`; return; }
  if (S.explica) { const e = explicacion(S.explica, p, c); if (e) { cerrar.hidden = false; tipo.textContent = 'Qué significa · ' + e[0]; txt.textContent = e[1]; return; } }
  cerrar.hidden = true;
  if (S.momento) { tipo.textContent = S.momento.titulo; txt.textContent = S.momento.texto; return; }
  // de noche el rótulo queda en dos frases cortas y los dos atajos; el dato del tiempo sigue en el dock
  if (noche) { tipo.textContent = S.modo === 'ahora' ? 'Ahora en Ciudad del Saber' : `${fechaTexto(S.fecha)} · ${hhmm(S.min)}`; txt.textContent = textoNoche(c); return; }
  const solTxt = p.alt > 0.5 ? `El sol está a ${f1(p.alt)}° sobre el horizonte, hacia el ${rumboTexto(p.az)}; la sombra de un poste de 1 m mide ${sp.largo > 99 ? 'más de 99 m' : f1(sp.largo, 2) + ' m'} y se proyecta hacia el ${rumboTexto(sp.rumbo)}.`
    : p.alt > -6 ? 'El sol acaba de cruzar el horizonte: es el crepúsculo.' : textoNoche(c);
  let clTxt = '';
  if (c?.fuente === 'vivo') clTxt = (c.lluvia ?? 0) >= 0.1 ? ` El modelo da lluvia en la zona (${f1(c.lluvia)} mm/h).` : c.llovizna ? ` Cielo con ${Math.round(c.nubes)} % de nubes; el modelo marca una llovizna leve en la zona (${f1(c.lluviaModelo)} mm/h), que aquí puede no notarse.` : ` Cielo con ${Math.round(c.nubes)} % de nubes.`;
  else if (c?.fuente === 'serie' || c?.fuente === 'dia') {
    clTxt = (c.lluvia ?? 0) >= 0.1 ? ` Entre las ${hhmm(Math.floor(S.min / 60) * 60)} y las ${hhmm(Math.floor(S.min / 60) * 60 + 60)} llovieron ${f1(c.lluvia)} mm.` : ` A esa hora no llovía; ${Math.round(c.nubes)} % de nubes.`;
    clTxt += ` ${f1(c.temp)} °C, humedad ${Math.round(c.humedad)} %, viento ${Math.round(c.viento)} km/h desde el ${rumboTexto(c.dir)}.`;
  }
  else if (c?.fuente === 'mes') clTxt = ` En ${MESES[S.fecha.m - 1]} de ${S.fecha.y} llovieron ${Math.round(c.lluviaMes)} mm (un ${MESES[S.fecha.m - 1]} típico: ${Math.round(clima.r.climMensual[S.fecha.m - 1])} mm).`;
  if (S.modo === 'ahora') { tipo.textContent = 'Ahora en Ciudad del Saber'; txt.textContent = solTxt + clTxt; }
  else { tipo.textContent = `${fechaTexto(S.fecha)} · ${hhmm(S.min)}`; txt.textContent = (S.mesSerie !== null ? '' : solTxt) + clTxt; }
}

// ---------------- Reglas: día, año y 25 años ----------------
function colorCielo(alt) {
  const st = [[-18, [10, 18, 22]], [-8, [27, 36, 64]], [-3, [70, 60, 100]], [0, [196, 104, 76]], [4, [232, 146, 80]], [12, [242, 196, 120]], [35, [246, 222, 170]], [90, [252, 240, 212]]];
  if (alt <= st[0][0]) return st[0][1];
  for (let i = 1; i < st.length; i++) if (alt <= st[i][0]) { const [a0, c0] = st[i - 1], [a1, c1] = st[i], k = (alt - a0) / (a1 - a0); return c0.map((v, j) => Math.round(v + (c1[j] - v) * k)); }
  return st[st.length - 1][1];
}

function dibujarReglas() {
  const f = S.fecha, { sale, pone } = saleYPone(f.y, f.m, f.d), md = mediodiaSolar(f.y, f.m, f.d);
  let stops = '';
  // el color del cielo cada 20 min: el amanecer y el atardecer duran unos minutos y una franja por hora los borraba. No es
  // un degradado decorativo: es el dato (la altura del sol) y su transición real es continua
  for (let m = 0; m <= 1440; m += 20) { const c = colorCielo(posicionSol({ ...f, h: 0, min: m }).alt); stops += `<stop offset="${(m / 1440).toFixed(4)}" stop-color="rgb(${c})"></stop>`; }
  $('#grad-dia').innerHTML = stops;
  let t = '';
  for (let h = 0; h <= 24; h++) { const x = h / 24 * 1000; t += `<line class="tick" x1="${x}" x2="${x}" y1="24" y2="${h % 6 === 0 ? 32 : 28}"></line>`; }
  for (const m of [sale, pone]) { const x = m / 1440 * 1000; t += `<line class="tick sol" x1="${x}" x2="${x}" y1="0" y2="4"></line>`; }
  const xn = (md.h * 60 + md.min) / 1440 * 1000; t += `<line class="tick med" x1="${xn}" x2="${xn}" y1="0" y2="4"></line>`;
  $('#dia-ticks').innerHTML = t;
  const et = $('#dia-etiquetas'); et.textContent = '';
  const pon = (x, txt, cls) => { const s = document.createElement('span'); s.style.left = x + '%'; s.className = cls || ''; s.textContent = txt; et.appendChild(s); };
  for (const h of [0, 6, 12, 18]) pon(h / 24 * 100, String(h).padStart(2, '0'));
  pon(sale / 14.4, '↑ ' + hhmm(sale), 'arriba'); pon(pone / 14.4, '↓ ' + hhmm(pone), 'arriba');
  // año: meses, temporada de lluvias (mayo–noviembre), solsticios y los dos días de cero sombra
  const y = f.y, x = (m, d) => diaDelAnio({ y, m, d }) / 364 * 1000;
  let a = `<rect x="${x(5, 1)}" y="4" width="${x(11, 30) - x(5, 1)}" height="12" fill="var(--lluvia)" opacity=".26" rx="2"></rect>`;
  a += `<rect x="0" y="9" width="1000" height="2" fill="var(--linea-2)"></rect>`;
  for (let m = 1; m <= 12; m++) a += `<line class="mes" x1="${x(m, 1)}" x2="${x(m, 1)}" y1="2" y2="18"></line>`;
  for (const [m, d] of [[6, 21], [12, 21]]) a += `<line class="tick med" x1="${x(m, d)}" x2="${x(m, d)}" y1="1" y2="19"></line>`;
  for (const z of diasCeroSombra(y)) a += `<circle class="cenit" cx="${x(z.m, z.d)}" cy="10" r="3.2"><title>Cero sombra: ${z.d} de ${MESES[z.m - 1]}</title></circle>`;
  $('#anio-marcas').innerHTML = a;
  const ea = $('#anio-etiquetas'); ea.textContent = '';
  MES3.forEach((l, i) => { const s = document.createElement('span'); s.style.left = x(i + 1, 15) / 10 + '%'; s.textContent = l; ea.appendChild(s); });
}

function dibujarDecadas() {
  const meses = clima.meses; if (!meses.length) return;
  const max = Math.max(...meses.map((q) => q.lluvia));
  let s = '';
  meses.forEach((q, i) => { const h = Math.max(0.6, q.lluvia / max * 30); s += `<rect x="${(i / 300 * 1000).toFixed(2)}" y="${(32 - h).toFixed(2)}" width="2.4" height="${h.toFixed(2)}" rx="1.1"><title>${MESES[q.m - 1]} de ${q.y}: ${Math.round(q.lluvia)} mm</title></rect>`; });
  $('#dec-barras').innerHTML = s;
  const et = $('#dec-etiquetas'); et.textContent = '';
  for (let y = 2001; y <= 2025; y += 4) { const sp = document.createElement('span'); sp.style.left = ((y - 2001) * 12 + 6) / 3 + '%'; sp.textContent = y; et.appendChild(sp); }
  $('#dec-leyenda').textContent = `Lluvia de cada mes, 2001–2025 · el más lluvioso: ${Math.round(max)} mm`;
}

function pintarMomentos() {
  const ul = $('#momentos'); ul.textContent = '';
  for (const m of clima.r.momentos ?? []) {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.innerHTML = `<span></span><b></b>`;
    b.querySelector('span').textContent = m.titulo; b.querySelector('b').textContent = `${f1(m.valor, m.valor < 100 ? 1 : 0)} ${m.unidad}`;
    b.addEventListener('click', () => irAMomento(m));
    li.appendChild(b); ul.appendChild(li);
  }
}

function irAMomento(m) {
  const [y, mo, d] = m.fecha.split('-').map(Number);
  const esMes = /^mes/.test(m.id), esAnio = /^anio/.test(m.id);
  if (!esMes && !esAnio) {
    const cuando = `${d} de ${MESES[mo - 1]} de ${y}${/^hora-lluvia|^dia/.test(m.id) ? `, de ${hhmm(m.hora * 60 - 60)} a ${hhmm(m.hora * 60)}` : ', ' + hhmm(m.hora * 60)}`;
    viajarA({ fecha: { y, m: mo, d }, min: /^hora-lluvia|^dia/.test(m.id) ? m.hora * 60 - 30 : m.hora * 60, vista: 'esquina', titulo: m.titulo + ' de la serie',
      texto: `${cuando}: ${f1(m.valor, m.valor < 100 ? 1 : 0)} ${m.unidad}, según el reanálisis para la celda que cubre el edificio (~28 km). Es un dato de modelo, no de un pluviómetro en el sitio.` });
    ponerPestana('decadas'); S.momento = S.momento; return;
  }
  explorar(); parar(); S.fecha = { y, m: mo, d }; S.min = m.hora * 60;
  const cuando = esAnio ? `${y}` : esMes ? `${MESES[mo - 1]} de ${y}` : `${d} de ${MESES[mo - 1]} de ${y}${/^hora-lluvia/.test(m.id) ? `, de ${hhmm(m.hora * 60 - 60)} a ${hhmm(m.hora * 60)}` : /^hora/.test(m.id) ? ', ' + hhmm(m.hora * 60) : ''}`;
  S.momento = { titulo: m.titulo + ' de la serie', texto: `${cuando}: ${f1(m.valor, m.valor < 100 ? 1 : 0)} ${m.unidad}, según el reanálisis para la celda que cubre el edificio (~28 km). Es un dato de modelo, no de un pluviómetro en el sitio.` };
  // mes y año: la escena muestra la lluvia del mes; hora y día: el dato de esa hora
  S.mesSerie = esMes || esAnio ? (y - 2001) * 12 + mo - 1 : null;
  lastLect = '';
}

// ---------------- Reproducir ----------------
function pasoReproducir(dt) {
  const v = reduce ? 4 : 1;
  if (S.pestana === 'dia') {
    const { sale, pone } = saleYPone(S.fecha.y, S.fecha.m, S.fecha.d);
    S.min += dt * 60 * 1.6 * v;                                    // ~96 min por segundo
    if (S.min > pone + 50) parar();
  } else if (S.pestana === 'anio') {
    const n = diaDelAnio(S.fecha) + Math.max(1, Math.round(dt * 60)) * v;
    if (n > 364) { parar(); return; }
    S.fecha = fechaDeDia(S.fecha.y, n);
  } else {
    S.acum = (S.acum || 0) + dt * 12 * v;                            // 12 meses por segundo: 25 años en 25 s
    if (S.acum >= 1) {
      S.acum = 0; const i = (S.mesSerie ?? -1) + 1; if (i >= 300) { parar(); return; }
      S.mesSerie = i; S.fecha = { y: 2001 + Math.floor(i / 12), m: (i % 12) + 1, d: 15 }; S.min = 15 * 60;
    }
  }
}
function reproducir() {
  if (S.reproduce) return parar();
  explorar(); S.momento = null; S.reproduce = true;
  if (S.pestana === 'dia') { const { sale } = saleYPone(S.fecha.y, S.fecha.m, S.fecha.d); S.min = sale - 25; }
  else if (S.pestana === 'anio') { S.fecha = { y: S.fecha.y, m: 1, d: 1 }; }
  else { S.mesSerie = -1; S.acum = 1; }
  $('#reproducir').setAttribute('aria-pressed', 'true'); $('#reproducir').setAttribute('aria-label', 'Pausar'); silenciar();
}
function parar() { S.reproduce = false; $('#reproducir').setAttribute('aria-pressed', 'false'); $('#reproducir').setAttribute('aria-label', 'Reproducir'); }

// ---------------- Modos ----------------
function explorar() { if (S.modo !== 'explorar') { S.modo = 'explorar'; lastLect = ''; } }
function irAAhora(volar = true) {
  parar(); S.mesSerie = null; S.momento = null; S.aguacero = false; $('#capa-aguacero').checked = false;
  const a = ahoraPanama();
  if (volar && S.modo !== 'ahora') {                   // volver a ahora también es un viaje
    viajarA({ fecha: { y: a.y, m: a.m, d: a.d }, min: a.min, vista: S.fachada ? null : 'esquina', fachada: S.fachada ? S.fachada.slice(8) : null, aAhora: true });
    return;
  }
  S.modo = 'ahora'; S.fecha = { y: a.y, m: a.m, d: a.d }; S.min = a.min;
  if (volar && !S.fachada) volarA(VISTAS.esquina, 1.6, 'esquina');
  lastLect = '';
}
function ponerPestana(t) {
  S.pestana = t;
  document.querySelectorAll('[data-tab]').forEach((b) => { b.setAttribute('aria-selected', String(b.dataset.tab === t)); b.tabIndex = b.dataset.tab === t ? 0 : -1; });
  for (const k of ['dia', 'anio', 'decadas']) $('#regla-' + k).hidden = k !== t;
  $('#momentos-caja').hidden = t !== 'decadas';
  if (t !== 'decadas') { S.mesSerie = null; S.momento = null; }
  lastLect = '';
}

// ---------------- UI ----------------
function prepararUI() {
  // el rótulo y el panel de capas se apoyan sobre el dock: su altura real va a --dock-h
  const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--dock-h', $('#dock').offsetHeight + 'px'));
  ro.observe($('#dock'));
  $('#sonido').addEventListener('click', () => {
    const on = $('#sonido').getAttribute('aria-pressed') !== 'true';
    on ? sonido.encender() : sonido.apagar();
    $('#sonido').setAttribute('aria-pressed', String(on));
  });
  $('#info').addEventListener('click', () => { const d = $('#acerca'); d.showModal ? d.showModal() : d.setAttribute('open', ''); });
  $('#cerrar-acerca').addEventListener('click', () => $('#acerca').close?.());
  $('#ahora').addEventListener('click', () => irAAhora());
  const tabs = [...document.querySelectorAll('[data-tab]')];
  const elegirTab = (b) => { ponerPestana(b.dataset.tab); S.explica = 'tab-' + b.dataset.tab; lastLect = ''; anunciar(); };
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => elegirTab(b));
    b.addEventListener('keydown', (e) => {
      const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]; if (j == null) return;
      e.preventDefault(); e.stopPropagation();                        // las flechas no deben pasar al recorrido guiado
      const t = tabs[(j + tabs.length) % tabs.length]; t.focus(); elegirTab(t);
    });
  });
  // qué significa cada dato
  document.querySelectorAll('[data-explica]').forEach((b) => {
    b.addEventListener('click', () => explicar(b.dataset.explica));
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); explicar(b.dataset.explica); } });
  });
  $('#rotulo-cerrar').addEventListener('click', () => { anunciar(); S.explica = null; document.querySelectorAll('[data-explica]').forEach((b) => b.setAttribute('aria-pressed', 'false')); lastLect = ''; });
  $('#rotulo-abrir').addEventListener('click', () => { ROT.abierto = true; ROT.t = performance.now(); soloUnPanel(null); });
  $('#lente-info').addEventListener('click', () => { cerrarOferta(); S.verLeyenda = !S.verLeyenda; if (S.verLeyenda) soloUnPanel('leyenda'); lastLect = ''; });
  $('#ley-cerrar').addEventListener('click', () => { S.verLeyenda = false; lastLect = ''; });
  if (innerWidth <= 760) $('#ley-mas').open = false;
  prepararPartes();
  // recorrido guiado
  const abrirRec = () => { cerrarOferta(); abrirSirve(false); $('#acerca').close?.(); recorrido(0); };
  ['#abrir-recorrido', '#sirve-recorrido', '#acerca-recorrido', '#oferta-si'].forEach((x) => $(x)?.addEventListener('click', abrirRec));
  $('#oferta-no').addEventListener('click', () => { cerrarOferta(); });
  $('#oferta-sirve').addEventListener('click', () => { cerrarOferta(); abrirSirve(true); $('#sirve').scrollTop = 0; });
  $('#acerca-sirve').addEventListener('click', () => { $('#acerca').close?.(); abrirSirve(true); $('#sirve').scrollTop = 0; });
  $('#rec-sig').addEventListener('click', () => recorrido(S.paso + 1));
  $('#rec-prev').addEventListener('click', () => recorrido(S.paso - 1));
  $('#rec-salir').addEventListener('click', () => { recorrido(null); enfocar($('#abrir-recorrido')); });
  $('#rec-plegar').addEventListener('click', () => plegarRecorrido(!document.documentElement.classList.contains('rec-plegado')));
  $('#rec-ver').addEventListener('click', verRespuesta);
  // nitidez
  $('#capa-nitidez').checked = RES.fija;
  $('#capa-nitidez').addEventListener('change', (e) => { RES.fija = e.target.checked; RES.iv = []; RES.techo = 0; try { localStorage.setItem('e106-nitidez', RES.fija ? '1' : '0'); } catch (x) { /* nada */ } escena.sucio = true; pintarResolucion(); });
  $('#hora').addEventListener('input', (e) => { parar(); explorar(); S.momento = null; S.mesSerie = null; S.min = +e.target.value; });
  $('#dia-anio').addEventListener('input', (e) => { parar(); explorar(); S.momento = null; S.fecha = fechaDeDia(S.fecha.y, +e.target.value); });
  $('#mes-serie').addEventListener('input', (e) => {
    parar(); explorar(); S.momento = null; const i = +e.target.value, y = 2001 + Math.floor(i / 12), m = (i % 12) + 1;
    S.mesSerie = null; S.fecha = { y, m, d: Math.min(S.fecha.d, diasMes(y, m)) };
  });
  $('#reproducir').addEventListener('click', () => { cerrarOferta(); reproducir(); });
  $('#lect-resumen').addEventListener('click', () => {
    const abrir = !document.documentElement.classList.contains('lect-abiertas');
    document.documentElement.classList.toggle('lect-abiertas', abrir); $('#lect-resumen').setAttribute('aria-expanded', String(abrir));
  });
  // indicio de que hay más: la fila de botones del teléfono (hacia la derecha) y la leyenda (hacia abajo)
  for (const el of [$('.hud-botones'), $('#leyenda')]) { el.addEventListener('scroll', () => hayMas(el), { passive: true }); new ResizeObserver(() => hayMas(el)).observe(el); }
  // los paneles largos: el mismo aviso plano, pegado abajo mientras quede texto por ver (se mira también cuando cambia su contenido)
  for (const el of ['#sirve', '#ir-a', '#confort', '#capas', '#voladizo', '#rec-cuerpo'].map((q) => $(q)).filter(Boolean)) {
    const aviso = document.createElement('div'); aviso.className = 'panel-sigue'; aviso.setAttribute('aria-hidden', 'true'); aviso.textContent = 'Hay más abajo ▾';
    el.append(aviso);
    el.addEventListener('scroll', () => hayMas(el), { passive: true });
    const ro = new ResizeObserver(() => hayMas(el)); ro.observe(el); for (const h of el.children) if (h !== aviso) ro.observe(h);
  }
  ['#hora', '#dia-anio', '#mes-serie'].forEach((x) => $(x).addEventListener('input', () => { cerrarOferta(); silenciar(); }));
  // para qué sirve: hallazgos con un momento para verlos en la escena
  const abrirSirve = (abrir) => { $('#sirve').hidden = !abrir; $('#abrir-sirve').setAttribute('aria-expanded', String(abrir)); if (abrir) { cerrarOferta(); abrirVoladizo(false); soloUnPanel('sirve'); } };
  $('#abrir-sirve').addEventListener('click', () => abrirSirve($('#sirve').hidden));
  $('#cerrar-sirve').addEventListener('click', () => abrirSirve(false));
  document.querySelectorAll('.hallazgo .ver').forEach((b) => b.addEventListener('click', () => {
    const art = b.closest('.hallazgo'), d = art.dataset;
    document.querySelectorAll('.hallazgo').forEach((x) => x.classList.toggle('activo', x === art));
    const [hh, mi] = d.hora.split(':').map(Number);
    if (innerWidth <= 760) abrirSirve(false);
    viajarA({ fecha: deISO(d.fecha), min: hh * 60 + mi, vista: d.fachada ? null : d.vista || 'esquina', fachada: d.fachada || null, lente: d.capa === 'calor' ? 'sol' : d.capa || 'foto', modo: d.modo || null });
  }));
  // ir a un momento exacto (p. ej. para comparar con una foto) o a una de las consultas
  const abrirIr = (abrir) => {
    $('#ir-a').hidden = !abrir; $('#elegir').setAttribute('aria-expanded', String(abrir)); $('#abrir-ir').setAttribute('aria-expanded', String(abrir));
    if (abrir) { cerrarOferta(); abrirVoladizo(false); soloUnPanel('ir'); }
    if (abrir) {
      { const a = ahoraPanama(), t = new Date(Date.UTC(a.y, a.m - 1, a.d + 15)); $('#ir-fecha').max = kf2({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }); }   // el pronóstico llega a 15 días
      $('#ir-fecha').value = kf2(S.fecha); $('#ir-hora').value = hhmm(S.min);
      pintarConsultas(); if (innerWidth > 760) $('#ir-fecha').focus();
    }
  };
  globalThis.__abrirIr = abrirIr;
  $('#abrir-confort').addEventListener('click', () => abrirConfort($('#confort').hidden));
  $('#cerrar-confort').addEventListener('click', () => abrirConfort(false));
  $('#elegir').addEventListener('click', () => abrirIr($('#ir-a').hidden));
  $('#abrir-ir').addEventListener('click', () => abrirIr($('#ir-a').hidden));
  $('#ir-fecha').addEventListener('change', () => { const [y, m] = $('#ir-fecha').value.split('-').map(Number); if (y > 1900 && m) { const f0 = S.fecha; S.fecha = { ...S.fecha, y, m }; pintarConsultas(); S.fecha = f0; } });
  $('#cerrar-ir').addEventListener('click', () => abrirIr(false));
  $('#ir-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const [y, mo, d] = $('#ir-fecha').value.split('-').map(Number), [hh, mi] = $('#ir-hora').value.split(':').map(Number);
    if (!y || !mo || !d || isNaN(hh)) return;
    if (innerWidth <= 760) abrirIr(false);
    viajarA({ fecha: { y, m: mo, d }, min: hh * 60 + (mi || 0) });
  });
  $('#consultas').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]'); if (!b) return;
    const it = S.listaConsultas?.[+b.dataset.i]; if (!it) return;
    const r = b.dataset.r != null ? it.rank[+b.dataset.r] : it;
    document.querySelectorAll('#consultas .activo').forEach((x) => x.classList.remove('activo'));
    const li = b.closest('li'); li.classList.add('activo');
    li.querySelector('.c-txt').textContent = (b.dataset.r != null ? `#${+b.dataset.r + 1} · ` : '') + (r.txt ?? it.txt ?? '');
    li.querySelectorAll('.rank button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (innerWidth <= 760) abrirIr(false);
    viajarA({ fecha: r.f, min: r.min, vista: it.vista, fachada: it.fachada, lente: it.lente, modo: it.modo, titulo: it.t, texto: r.txt ?? it.txt });
  });
  // formas de ver
  document.querySelectorAll('.lentes [data-lente]').forEach((b) => b.addEventListener('click', () => {
    cerrarOferta(); anunciar();
    const conTarjeta = !(b.dataset.lente === 'partes' && innerWidth <= 760);   // en el teléfono, primero las etiquetas; la tarjeta sale al tocar una
    ponerLente(b.dataset.lente, conTarjeta); if (conTarjeta) soloUnPanel('leyenda');
    if (b.dataset.lente === 'sombras' && escena.camera.position.y < 30) volarA(VISTAS.planta, 1.6, 'planta');
    if (b.dataset.lente === 'partes' && escena.camera.position.y > 60) volarA(VISTAS.esquina, 1.6, 'esquina');
  }));
  $('#ley-modos').addEventListener('click', (e) => { const b = e.target.closest('[data-modo]'); if (!b || !MODO_DE[S.lente]) return; S[MODO_DE[S.lente]] = b.dataset.modo; S.claveRosa = ''; lastLect = ''; anunciar(); });
  $('#guardar-img').addEventListener('click', guardarImagen);
  $('#copiar-enlace').addEventListener('click', copiarEnlace);
  $('#abrir-capas').addEventListener('click', () => { const c = $('#capas'), abrir = c.hidden; c.hidden = !abrir; $('#abrir-capas').setAttribute('aria-expanded', String(abrir)); if (abrir) { cerrarOferta(); soloUnPanel('capas'); pintarResolucion(); } });
  $('#capa-aguacero').addEventListener('change', (e) => { S.aguacero = e.target.checked; });
  // exposición larga: la alternativa a la noche honesta; se rotula en la escena mientras está activa
  $('#capa-larga').addEventListener('change', (e) => {
    escena.setModoNoche(e.target.checked ? 'larga' : 'honesta');
    const a = $('#aviso-noche'); a.textContent = 'Exposición larga: la escena se aclara como una foto de 20 segundos en trípode'; a.hidden = !e.target.checked;
  });
  $('#noche-dia').addEventListener('click', () => viajarA({ fecha: { ...S.fecha }, min: 9 * 60, vista: S.fachada ? null : 'esquina', fachada: S.fachada ? S.fachada.slice(8) : null }));
  $('#noche-atardecer').addEventListener('click', () => viajarA({ fecha: { ...S.fecha }, min: Math.round(saleYPone(S.fecha.y, S.fecha.m, S.fecha.d).pone), vista: S.fachada ? null : 'esquina', fachada: S.fachada ? S.fachada.slice(8) : null }));
  $('#capa-ayudas').addEventListener('change', (e) => { S.ayudas = e.target.checked; });
  document.querySelectorAll('.vistas [data-vista]').forEach((b) => b.addEventListener('click', () => { cerrarOferta(); S.fachada = null; document.documentElement.classList.remove('en-fachada'); $('#panel-fachada').hidden = true; volarA(VISTAS[b.dataset.vista], 1.6, b.dataset.vista); }));
  $('#brujula').addEventListener('click', () => { cerrarOferta(); volarA(VISTAS.planta, 1.6, 'planta'); });
  document.querySelectorAll('[data-ir-fachada]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); irAFachada(a.dataset.irFachada); }));
  $('#qr-cerrar').addEventListener('click', () => cerrarQR(true));
  $('#salir-fachada').addEventListener('click', () => { S.fachada = null; document.documentElement.classList.remove('en-fachada'); $('#panel-fachada').hidden = true; try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* visor */ } volarA(VISTAS.esquina, 1.6, 'esquina'); });
  addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (intro) return; if (FACHADAS[h]) { irAFachada(h); mostrarQR(h); } else irAMomentoHash(); });   // un segundo QR escaneado con la página abierta también trae su tarjeta
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.key === '1' || e.key === '2' || e.key === '3') { const k = ['esquina', 'aerea', 'planta'][+e.key - 1]; S.fachada = null; document.documentElement.classList.remove('en-fachada'); volarA(VISTAS[k], 1.6, k); }
    if (S.viaje && (e.key === 'Escape' || e.key === ' ')) { S.viaje.t0 = -1e9; e.preventDefault(); }
    else if (S.paso != null && e.key === 'ArrowRight') recorrido(S.paso + 1);
    else if (S.paso != null && e.key === 'ArrowLeft') recorrido(S.paso - 1);
  });
  $('#saltar-a')?.addEventListener('click', (e) => { e.preventDefault(); $('#principal').focus(); });   // sin cambiar el #: el # es el momento
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // el foco vuelve al botón que abrió el panel; Escape durante un viaje solo lo salta, sin salir del recorrido
    const dentro = ['#sirve', '#capas', '#ir-a', '#confort', '#recorrido'].find((x) => !$(x).hidden && $(x).contains(document.activeElement));
    const abridor = dentro === '#recorrido' ? $('#abrir-recorrido') : dentro && document.querySelector(`[aria-controls="${dentro.slice(1)}"][aria-expanded="true"]`);
    if (S.paso != null && !S.viaje) recorrido(null);
    if (dentro && (dentro !== '#recorrido' || S.paso == null)) setTimeout(() => enfocar(abridor), 0);
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { cerrarQR(!$('#qr').hidden && $('#qr').contains(document.activeElement)); cerrarOferta(); abrirVoladizo(false); $('#sirve').hidden = true; $('#abrir-sirve').setAttribute('aria-expanded', 'false'); $('#capas').hidden = true; $('#abrir-capas').setAttribute('aria-expanded', 'false'); $('#ir-a').hidden = true; $('#elegir').setAttribute('aria-expanded', 'false'); $('#abrir-ir').setAttribute('aria-expanded', 'false'); abrirConfort(false); } });
  // la primera interacción despierta el audio si el visitante ya pidió sonido
  const d = diasCeroSombra(hoy.y);
  $('#cenit-txt').textContent = `A 9° N el sol pasa casi por el cenit dos veces al año: en ${hoy.y}, el ${d[0].d} de ${MESES[d[0].m - 1]} y el ${d[1].d} de ${MESES[d[1].m - 1]}, hacia las ${hhmm(d[0].h * 60 + d[0].min)}. Ese mediodía, un poste casi no hace sombra.`;
}

/** Un solo panel lateral a la vez (Para qué sirve, Ir a…, Confort, Capas o la tarjeta de la forma de ver): al abrir uno, se
 *  cierran los demás. Con null los cierra todos. */
function soloUnPanel(k) {
  if (k !== 'sirve' && !$('#sirve').hidden) { $('#sirve').hidden = true; $('#abrir-sirve').setAttribute('aria-expanded', 'false'); }
  if (k !== 'ir' && !$('#ir-a').hidden) globalThis.__abrirIr?.(false);
  if (k !== 'confort' && !$('#confort').hidden) abrirConfort(false);
  if (k !== 'capas' && !$('#capas').hidden) { $('#capas').hidden = true; $('#abrir-capas').setAttribute('aria-expanded', 'false'); }
  if (k !== 'leyenda' && S.verLeyenda) { S.verLeyenda = false; lastLect = ''; }
}

// El rótulo («Ahora en Ciudad del Saber», un momento elegido…) se lee al cambiar y después se pliega a su línea de arriba:
// a los 8 s (14 s si es un momento con su explicación) o en cuanto se abre un panel. «Leer» lo despliega. No se pliega con la
// explicación de un dato (tiene «Entendido»), de noche (lleva los atajos al día) ni mientras se viaja.
const ROT = { clave: null, t: 0, abierto: false };
function plegarRotulo(now) {
  const clave = `${S.modo}|${S.momento?.titulo ?? ''}|${S.explica ?? ''}|${S.fachada ?? ''}|${S.viaje ? 'v' : ''}`;
  if (clave !== ROT.clave) { ROT.clave = clave; ROT.t = now; ROT.abierto = false; }
  const fijo = !!S.explica || !!S.viaje || !$('#rotulo-noche').hidden;
  const panel = !$('#leyenda').hidden || !$('#capas').hidden;
  const plegar = !fijo && (panel || (!ROT.abierto && now - ROT.t > (S.momento ? 14000 : 8000)));
  const html = document.documentElement;
  if (html.classList.contains('rotulo-plegado') !== plegar) {
    html.classList.toggle('rotulo-plegado', plegar);
    $('#rotulo-abrir').setAttribute('aria-expanded', String(!plegar));
    pintarPartes.f = '';
  }
}

/** Marca con .hay-mas un panel que tiene contenido oculto por desplazar (a la derecha si es una fila, abajo si no). */
function hayMas(el) {
  if (!el) return;
  const fila = el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible';
  const mas = fila ? el.scrollLeft + el.clientWidth < el.scrollWidth - 4 : el.scrollTop + el.clientHeight < el.scrollHeight - 4;
  if (el.classList.contains('hay-mas') !== mas) el.classList.toggle('hay-mas', mas);
}

function irAFachada(k) {
  if (!FACHADAS[k]) return;
  irAAhora(false); mostrarFachada(k); volarA(VISTA_FACHADA[k]);
}
function mostrarFachada(k) {
  const f = FACHADAS[k]; if (!f) return;
  anunciar();
  S.fachada = k; marcarVista(null);
  document.documentElement.classList.add('en-fachada');
  $('#fachada-titulo').textContent = `${f.nombre}: ${f.lugar}`;
  $('#panel-fachada').hidden = false;
  lastLect = '';
}
// ---------------- Tarjeta del QR en sitio ----------------
// Solo al abrir la página desde un enlace #fachada-xx (los QR pegados en el edificio). Dos preguntas para responder mirando
// la pared real; los hechos salen de la orientación (sol.js) y de consultas.json (lluvia con viento, horas de viento de frente).
const NOMBRE_CORTO = { se: 'sureste', no: 'noroeste', ne: 'lateral noreste', so: 'lateral suroeste' };
function preguntasQR(c) {
  const C = consultas, nom = (x) => NOMBRE_CORTO[x];
  const oLl = C ? Object.keys(C.lluviaViento).sort((a, b) => C.lluviaViento[b].anual - C.lluviaViento[a].anual) : null;
  const W = C?.viento?.anio.frente, oVi = W ? Object.keys(W).sort((a, b) => W[b] - W[a]) : null;
  const lluvia = (k) => {
    if (!oLl) return 'Cuando llueve con viento, unas paredes se mojan más que otras.';
    const r = oLl.indexOf(k);
    return r === 0 ? 'Es la pared que más se moja cuando llueve con viento.'
      : r === 1 ? `Después de la ${nom(oLl[0])}, es la que más se moja cuando llueve con viento.`
      : r === oLl.length - 1 ? 'Es la pared que menos se moja cuando llueve con viento.'
      : `Se moja menos que la ${nom(oLl[0])} cuando llueve con viento.`;
  };
  const viento = (k) => {
    if (!oVi) return 'El viento le llega de frente muchas horas al año.';
    const r = oVi.indexOf(k);
    return r === 0 ? `Recibe el viento de frente más horas que ninguna otra: ${miles(W[k])} al año.`
      : `Recibe el viento de frente unas ${miles(W[k])} horas al año; la ${nom(oVi[0])}, unas ${miles(W[oVi[0]])}.`;
  };
  const opuesta = oVi ? nom(oVi[0]) : 'noroeste';
  return {
    se: ['Recibe el sol de la mañana. Párate bajo el alero de la entrada: ¿a qué hora crees que el sol deja de incidir sobre el vidrio? Compruébalo con la regla del día.',
      `El viento llega casi siempre por la cara opuesta, la ${opuesta}, así que el aire que cruzara el edificio saldría por aquí, si el interior lo deja pasar. ¿Qué ventanas o rejillas lo dejarían salir?`],
    no: [`${lluvia('no')} ¿Ves manchas de humedad o pintura gastada abajo o bajo las ventanas? Compáralo con la forma de ver «Lluvia».`,
      `${viento('no')} Ponte de espaldas a la pared: ¿sientes la brisa en la cara?`],
    ne: ['Mira al noreste, del lado por donde sale el sol, y solo recibe sol en la mañana. ¿A qué hora crees que queda en sombra? Compruébalo con la regla del día.',
      `${lluvia('ne')} ¿El zócalo y la pintura se ven más limpios que en la noroeste? Compáralo con la forma de ver «Lluvia».`],
    so: ['Recibe el sol de la tarde. Párate bajo el alero: ¿a qué hora crees que el sol empieza a incidir sobre el vidrio? Búscala con la regla del día.',
      `${lluvia('so')} ¿Ves marcas de agua bajo las ventanas o en las esquinas? Compáralo con la forma de ver «Lluvia».`],
  }[c];
}
function mostrarQR(k) {
  const f = FACHADAS[k], c = k.replace('fachada-', ''); if (!f) return;
  const pintar = () => {
    $('#qr-t').textContent = `Estás frente a la fachada ${NOMBRE_CORTO[c]}`;
    $('#qr-lugar').textContent = f.lugar[0].toUpperCase() + f.lugar.slice(1) + '.';
    $('#qr-preg').innerHTML = preguntasQR(c).map((q) => `<li>${q}</li>`).join('');
  };
  pintar();
  if (!consultas) { const t = setInterval(() => { if (consultas) { clearInterval(t); if (!$('#qr').hidden) pintar(); } }, 400); setTimeout(() => clearInterval(t), 20000); }
  const el = $('#qr'); el.hidden = false;
  el.focus({ preventScroll: true });
}
function cerrarQR(devolverFoco) {
  const el = $('#qr'); if (!el || el.hidden) return;
  el.hidden = true;
  if (devolverFoco) $('#salir-fachada')?.focus({ preventScroll: true });
}
/** Umbral de sol directo: la OMM cuenta horas de sol cuando la irradiancia directa normal pasa de 120 W/m² (WMO-No. 8,
 *  vol. I, ed. 2023, cap. 8, §8.1.1, p. 309; la misma sección asocia el sol con «la aparición de sombras»). Con el dato horario
 *  de ERA5 es una aproximación: una hora con nubes que pasan puede promediar menos y tener ratos de sol. */
const UMBRAL_SOL = 120;
function textoFachada(p, c) {
  const f = FACHADAS[S.fachada], sp = sombraPoste(p.alt, p.az), inc = incidencia(p.alt, p.az, f.rumbo);
  // con el sol a menos de 0,5° no hay sombra del poste que comparar (sombraPoste da null): se dice solo la hora
  if (!sp) { $('#fachada-texto').textContent = `Son las ${hhmm(S.min)} en Panamá y el sol está ${p.alt <= 0 ? 'bajo el horizonte' : 'en el horizonte'}.`; return; }
  // la geometría dice si el sol mira a la fachada; el dato de esa hora (DNI) dice si su rayo llega con fuerza
  const dni = c?.dni, debil = dni != null && dni < UMBRAL_SOL, hacia = `hacia el ${rumboTexto(sp.rumbo)}`, largo = `${f1(sp.largo, 2)} veces tu estatura`;
  const frente = inc <= 0.02 ? 'Esta fachada está en sombra.'
    : dni == null ? 'El sol mira a esta fachada; si el cielo está despejado, incide sobre ella.'
    : debil ? `El sol mira a esta fachada, pero ${dniDespejado(p.alt) < UMBRAL_SOL ? 'está tan bajo que su rayo llega débil' : dni < 20 ? 'las nubes lo tapan' : 'las nubes casi lo tapan'}: la radiación directa es de ${miles(Math.round(dni))} W/m², menos de los 120 W/m² con que la OMM cuenta horas de sol, y las sombras ${dni < 20 ? 'no se marcan' : 'apenas se marcan'}.`
    : 'Esta fachada recibe sol directo.';
  $('#fachada-texto').textContent = `Son las ${hhmm(S.min)}. El sol está a ${f1(p.alt)}° de altura, hacia el ${rumboTexto(p.az)}. ${frente} `
    + (debil ? `Si el sol se asoma, tu sombra se proyectará ${hacia} y medirá ${largo}.` : `Tu sombra debería proyectarse ${hacia} y medir ${largo}: compárala con la del modelo.`);
}

function refrescar() { lastLect = ''; S.kClimaDia = ''; }

// ---------------- Formas de ver (lentes) ----------------
// Cada lente trae su explicación en lenguaje llano: qué ves, cómo leerlo, algo para probar, para qué sirve en el diseño,
// qué no dice y cómo se calcula. Las cifras de «Para el diseño» salen de la serie ERA5 2001–2025 (ver «Para qué sirve»).
const LENTES = {
  foto: { t: 'Foto: el edificio como se vería', rampa: null,
    que: 'El sol está calculado para este minuto exacto. El cielo, las nubes y la lluvia salen del dato del tiempo de esa hora. El suelo y los muros siguen mojados mientras no se seca lo que llovió en las horas anteriores, y la vegetación se mece con el viento de esa hora.',
    prueba: 'Mueve la regla del día y mira cómo giran y se acortan las sombras. Cerca del mediodía, el alero de 1,65 m deja las paredes casi todas en sombra.',
    porque: 'Sirve para comparar con una foto real del mismo día y hora, y para ver el edificio con la luz de cualquier momento desde 1940.',
    ojo: 'La cantidad de nubes y de lluvia sale del dato; su forma y su posición exacta no. De noche solo alumbran fuentes reales o declaradas, con otra exposición (no es una simulación fotométrica): la luna está en su lugar y con su fase de esa noche, y las nubes del dato la tapan; el cielo devuelve el resplandor de la ciudad. Dos cosas son supuestas: los cuartos que se ven detrás del vidrio y cuáles tienen la luz prendida (con la luz que derraman) son inventados, no un dato de uso, y la lámpara del poste de la esquina, la única del modelo, se supone LED de 4000 K. En Capas está la exposición larga, que aclara la noche sin agregar luz. Lo que tarda en secarse y cuánto se mueve cada árbol son una estimación sencilla, no una medición.',
    tec: 'Posición del sol: algoritmo de NOAA (hasta 0,03° en altura y 0,11° en azimut frente a NREL SPA). Tiempo: reanálisis ERA5 (Open-Meteo), una celda de unos 28 km que contiene el edificio; para hoy, pronóstico de modelo. Sombras en tiempo real con un mapa de sombras: contra el trazado de rayos sobre la geometría, bajo el alero salen unos 5 cm más cortas.' },
  sol: { t: 'Sol: la irradiancia solar que incide en cada punto del edificio', u: 'W/m²', rampa: rampaCSS(RAMPA_SOL), esc: ['nada', '400 W/m²', '800 o más'],
    que: 'Cada punto del edificio, vidrio incluido, se pinta según la radiación solar que incide sobre él en este momento: azul oscuro es nada, morado es poco, rojo es bastante y naranja y amarillo son mucho. Cuenta la sombra real de los aleros y del propio edificio, la de los árboles y la de los vecinos más cercanos (el 105, el salón de un piso de enfrente y Balboa Academy): bajo el alero, el color baja.',
    leer: '«Solo sol directo» es el rayo del sol. «Total» le suma la luz difusa del cielo y la que refleja el suelo, que con los cielos nublados de Panamá pesan mucho. Los números de abajo son los de una pared sin alero de cada orientación, y el techo: en W/m² en esta hora, y en kWh/m² en «Año típico».',
    prueba: 'Abre «Para qué sirve» → el hallazgo del alero (fachada SE, 15 de enero, 7:30) y pasa la regla hasta las 10:00: el muro sigue al sol, pero el vidrio bajo el alero queda en sombra. Luego cambia a «Total»: de día ninguna parte queda en cero.',
    porque: 'Es el asoleamiento del edificio: muestra qué partes necesitan protección y cuánto protege el alero, ventana por ventana. En un año, contando solo el sol directo, la sureste y la suroeste reciben más del doble que la noroeste; sumando la difusa y la reflejada, la noroeste recibe unos siete décimos de lo que recibe la sureste{RAD_NO_SE}.',
    ojo: 'La difusa usa un cielo que brilla más alrededor del sol (Hay-Davies); esa parte cercana al sol se tapa con la sombra del alero, pero el resto del cielo que tapan el alero o los vecinos no se descuenta: bajo el alero la exagera un poco. La reflejada supone que el suelo devuelve el 20 %. Los vecinos son volúmenes sobre las huellas de OpenStreetMap con alturas estimadas; los que están a más de ~60 m no proyectan sombra. Y no es temperatura: mucho sol en una pared no dice cuánto calor entra al edificio.',
    tec: 'Directa: radiación directa normal (DNI), que Open-Meteo deriva de la directa horizontal de ERA5 (resolución de 4 W/m²), × coseno del ángulo entre el sol y la superficie × sombra, con el mismo mapa de sombras de la escena. Difusa: modelo de Hay-Davies con la difusa horizontal de ERA5: la parte circunsolar (según cuánto sol directo llega frente al que llega fuera de la atmósfera) va con el ángulo del sol y con la sombra; el resto, × (1 + cos de la inclinación) / 2. Reflejada: global horizontal × 0,2 × (1 − cos de la inclinación) / 2.' },
  lluvia: { t: 'Lluvia: qué fachada se moja cuando llueve con viento', rampa: rampaCSS(PAL.lluvia), esc: ['nada', '', 'mucha'],
    que: 'Con viento, la lluvia no cae derecha: se moja más la fachada que mira hacia donde viene el viento. Cada fachada se pinta en azules según esa exposición: oscuro es nada y azul claro es mucha.',
    leer: '«Esta hora» usa la lluvia y el viento de esa hora, en litros por metro cuadrado. «Año típico» es el promedio de un año, sumando 25 años de datos.',
    prueba: 'Pasa a «Año típico»: la noroeste se moja más de cinco veces lo que la fachada lateral noreste. Luego abre «Ir a…» y elige «La fachada que más se moja».',
    porque: 'Dice dónde reforzar aleros, bordes que cortan el goteo, juntas y acabados, y dónde no conviene poner materiales que sufren con el agua.',
    ojo: 'Es un índice para comparar las fachadas entre sí, no el agua que de verdad llega al muro: no descuenta el alero, los árboles ni los edificios vecinos, y el viento del modelo no tiene ráfagas. En las superficies oblicuas el color mezcla el de dos fachadas vecinas.',
    tec: 'Índice de lluvia batiente de la norma ISO 15927-3 en campo abierto: (2/9) · v · r^(8/9) · cos(D − θ), con v el viento a 10 m de altura (m/s), r la lluvia (mm/h), D de dónde viene el viento y θ hacia dónde mira la fachada. Datos ERA5, celda de unos 28 km.' },
  viento: { t: 'Viento: de dónde viene y qué fachada lo recibe de frente', rampa: rampaCSS(PAL.viento), esc: ['nada', '', 'mucho'],
    que: 'En el suelo se dibuja una rosa de vientos: cada pétalo apunta hacia donde viene el viento y es más largo cuanto más seguido sopla desde ahí; su color es la velocidad media. Las fachadas se pintan en verde según cuánto viento reciben de frente.',
    leer: '«Esta hora» muestra con flechas el viento de esa hora. «Seca» (diciembre a abril; para el IMHPA, diciembre y abril son meses de transición), «Lluvias» (mayo a noviembre) y «Año» muestran la rosa de 25 años y, abajo, las horas con viento de frente en cada fachada.',
    prueba: 'Compara «Seca» con «Lluvias»: en la temporada seca el viento es más fuerte (unos 12 km/h de media) y casi siempre llega del norte y el noroeste; en la de lluvias es más flojo (unos 8 km/h) y más variable.',
    porque: 'Es el primer dato para la ventilación cruzada: las entradas de aire van en la fachada que recibe el viento de frente y las salidas, en la opuesta. Aquí la noroeste lo recibe de frente o en diagonal (a menos de 60° de su perpendicular) unas 5.900 horas al año, más de cuatro veces que cualquier otra: es la fachada natural de entrada, y la sureste, la de salida.',
    ojo: 'Es el viento a 10 m de altura en terreno abierto, promedio de una celda de unos 28 km y sin ráfagas. Entre árboles y edificios, a la altura de las ventanas, suele ser bastante más flojo y puede cambiar de dirección. No simula cómo entra y sale el aire del edificio: para eso hace falta una simulación de fluidos (CFD). En las superficies oblicuas el color mezcla el de dos fachadas vecinas.',
    tec: 'Viento a 10 m de ERA5, hora por hora, 2001–2025. Rosa de 16 rumbos; viento flojo, menos de 1 m/s (3,6 km/h). Viento de frente, un criterio de este proyecto: dirección dentro de ±60° de la perpendicular a la fachada y al menos 5 km/h. Las ventanas de dos fachadas vecinas se solapan, así que una hora puede contar para las dos.' },
  sombras: { t: 'Sombras: la proyección de sombra del edificio en cada hora', rampa: 'linear-gradient(90deg, #5cc8d6, #f2efe6 50%, #f4a23a)', esc: ['6 h', '12 h', '18 h'],
    que: 'Sobre el terreno se dibuja el contorno de la sombra del edificio en cada hora en punto, de 6 a 18 h: turquesa en la mañana, blanco al mediodía y naranja en la tarde. Donde se enciman más contornos, ese pedazo de suelo pasa más horas a la sombra.',
    prueba: 'Cambia la fecha con la regla del año: en diciembre las sombras son largas y se proyectan hacia el norte; en junio, a mediodía, son cortas y apuntan al sur. En los días sin sombra (abril y agosto), la del mediodía casi desaparece.',
    porque: 'Sirve para decidir dónde poner un patio, una terraza, una banca o un árbol: qué partes del jardín tienen sombra en la mañana y cuáles en la tarde.',
    ojo: 'Es la sombra del volumen del edificio solo, sobre un terreno plano, sin árboles ni vecinos.',
    tec: 'Para cada hora se proyecta la silueta del edificio sobre el suelo en la dirección del sol (NOAA) y se traza su contorno exterior. Es exacto para el volumen; los detalles pequeños quedan dentro del contorno.' },
  partes: { t: 'Partes del edificio', rampa: null, que: '',
    prueba: 'Toca «Alero» y luego «El alero como voladizo»: cambia el largo y mira cuánto crece el esfuerzo. Después gira el edificio: las etiquetas pasan a la cara que tienes enfrente.',
    porque: 'Nombrar las partes es el primer paso para leer un edificio y conversar sobre él: son las mismas palabras de los planos y de una clase de diseño.',
    ojo: 'Los nombres son los de uso común en arquitectura. Las medidas salen del modelo 3D, que tiene una escala aproximada (±12 %), no de planos oficiales. El modelo muestra lo que se ve por fuera: no dice cómo es la estructura por dentro (columnas, vigas, refuerzos).',
    tec: 'Cada etiqueta se ancla a un punto del modelo y se dibuja en la cara que mira hacia ti. Medidas tomadas de la geometría: planta de 45,5 × 23 m; aleros a 3,74, 7,40 y 11,10 m, que salen 1,65 m del muro; base de 0,65 m; cumbrera a 15,7 m.' },
};
const MODOS = { sol: [['directa', 'Solo directo'], ['total', 'Total'], ['anio', 'Año típico']], lluvia: [['hora', 'Esta hora'], ['anio', 'Año típico']],
  viento: [['hora', 'Esta hora'], ['seca', 'Seca'], ['lluvias', 'Lluvias'], ['anio', 'Año']] };
const MODO_DE = { sol: 'solModo', lluvia: 'aguaModo', viento: 'vientoModo' };
/** Cifras de radiación anual por fachada (consultas.json → radiacion) en los textos que las citan. */
function textoRad(t) {
  const R = consultas?.radiacion?.fachadas;
  return t.replace('{RAD_NO_SE}', R ? ` (~${dec(R.no.total)} contra ~${dec(R.se.total)} kWh/m² al año en una pared sin alero)` : '');
}
function pintarRadiacion() {
  const R = consultas?.radiacion; if (!R) return;
  document.querySelectorAll('[data-rad]').forEach((el) => { const [a, b] = el.dataset.rad.split('.'), v = a === 'techo' ? R.techo[b] : R.fachadas[a]?.[b]; if (v != null) el.textContent = miles(v); });
  const f = Object.values(R.fachadas).map((x) => x.directa / x.total);
  document.querySelectorAll('[data-rad-pct]').forEach((el) => { el.textContent = `${Math.round(Math.min(...f) * 100)}–${Math.round(Math.max(...f) * 100)} %`; });
  const el = $('#leyenda'); if (el) el.dataset.lente = '';     // la tarjeta abierta vuelve a tomar las cifras
}
function ponerLente(k, mostrar = true) {
  if (!(k in LENTES)) k = 'foto';
  S.lente = k; if (mostrar) S.verLeyenda = true;
  document.querySelectorAll('.lentes [data-lente]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lente === k)));   // solo los botones: #leyenda y #ley-modos también llevan data-lente
  aplicarPartes(); pintarPartes.f = '';
  document.documentElement.classList.toggle('en-partes', k === 'partes');
  lastLect = '';
}
function leyenda(c) {
  const L = LENTES[S.lente], el = $('#leyenda');
  el.hidden = !S.verLeyenda; $('#lente-info').setAttribute('aria-expanded', String(!!S.verLeyenda));
  if (!S.verLeyenda) return;
  const anioSol = S.lente === 'sol' && S.solModo === 'anio';
  const esPartes = S.lente === 'partes', P = esPartes ? (PARTES[S.parte] ?? PARTES.alero) : null;
  const claveT = S.lente + (anioSol ? '-anio' : '') + (esPartes ? '-' + S.parte : '');
  // escala con números: cambia con el modo (esta hora, año típico, temporadas), así que va aparte de los textos fijos
  const ley = L.rampa ? leyendaLente(L) : null, claveE = ley ? ley.c + ley.esc.join('|') : '';
  if (el.dataset.escala !== claveE) {
    el.dataset.escala = claveE;
    $('#ley-rampa').hidden = $('#ley-escala').hidden = !ley;
    if (ley) { $('#ley-rampa').style.background = ley.c; $('#ley-escala').innerHTML = ley.esc.map((x) => `<span>${x}</span>`).join(''); }
  }
  if (el.dataset.lente !== claveT) {                            // textos fijos: solo al cambiar de lente (o al año típico del sol, o de parte)
    el.dataset.lente = claveT;
    $('#ley-t').textContent = esPartes ? P.t : L.t; $('#ley-que').textContent = esPartes ? P.que : L.que;
    $('#ley-parte').hidden = !esPartes;
    if (esPartes) {
      $('#lp-aqui').textContent = P.aqui; $('#lp-hace').textContent = P.hace;
      $('#lp-hace-k').textContent = P.hk ?? 'Qué hace:';
      $('#lp-tabla').hidden = S.parte !== 'escala';
      $('#lp-voladizo').hidden = S.parte !== 'alero';
    }
    $('#ley-leer').textContent = L.leer ?? ''; $('#ley-leer').hidden = !L.leer;
    $('#ley-prueba').textContent = L.prueba; $('#ley-porque').textContent = textoRad(L.porque); $('#ley-ojo').textContent = L.ojo; $('#ley-tec').textContent = L.tec;
    const M = MODOS[S.lente];
    $('#ley-modos').innerHTML = M ? M.map(([k, t]) => `<button type="button" data-modo="${k}">${t}</button>`).join('') : '';
    $('#ley-modos').hidden = !M; $('#ley-modos').dataset.lente = S.lente;
  }
  const actual = S[MODO_DE[S.lente]];
  $('#ley-modos').querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === actual)));
  if (esPartes) document.querySelectorAll('#ley-parte [data-mostrar]').forEach((b) => b.setAttribute('aria-pressed', String(!!S[b.dataset.mostrar])));
  const ks = Object.keys(FACHADAS), nom = { 'fachada-se': 'SE', 'fachada-no': 'NO', 'fachada-ne': 'NE', 'fachada-so': 'SO' };
  let filas = '';
  if (anioSol && consultas?.radiacion) {
    const R = consultas.radiacion;
    filas = ks.map((k) => `<li><span>${nom[k]}</span><b>${dec(R.fachadas[k.slice(8)].total)}</b><small>kWh/m² año</small></li>`).join('') + `<li><span>TECHO</span><b>${dec(R.techo.total)}</b><small>kWh/m² año</small></li>`;
  } else if (S.lente === 'sol') filas = ks.map((k, i) => `<li><span>${nom[k]}</span><b>${miles(S.irr?.[i] ?? 0)}</b><small>W/m²</small></li>`).join('') + `<li><span>TECHO</span><b>${miles(S.irrTecho ?? 0)}</b><small>W/m²</small></li>`;
  else if (S.lente === 'viento') {
    const hora = S.vientoModo === 'hora';
    filas = ks.map((k, i) => `<li><span>${nom[k]}</span><b>${hora ? miles(S.vientoF?.[i] ?? 0) : dec(S.vientoF?.[i] ?? 0)}</b><small>${hora ? 'km/h de frente' : S.vientoModo === 'anio' ? 'h al año' : 'h por temporada'}</small></li>`).join('');
  }
  else if (S.lente === 'lluvia') {
    const anual = S.aguaModo === 'anio';
    filas = ks.map((k, i) => `<li><span>${nom[k]}</span><b>${anual ? dec(S.agua?.[i] ?? 0) : f1(S.agua?.[i] ?? 0)}</b><small>${anual ? 'L/m² al año' : 'L/m² en la hora'}</small></li>`).join('');
  }
  $('#ley-fachadas').innerHTML = filas; $('#ley-fachadas').hidden = !filas; $('#ley-fachadas').classList.toggle('cinco', S.lente === 'sol');
  // nota de la situación: qué pasa en este momento
  let nota = '';
  const p = posicionSol({ ...S.fecha, h: 0, min: S.min });
  if (S.lente === 'sol') {
    nota = p.alt <= 0 ? 'Ahora es de noche: nada recibe sol. Mueve la regla del día a la mañana o a la tarde.'
      : `Ahora el sol está hacia el ${rumboTexto(p.az)}, a ${f1(p.alt)}° de altura${(S.irr ?? []).every((v) => v < 5) ? ': a esta hora ninguna pared lo recibe de frente, o las nubes lo tapan.' : '.'}`;
    if (S.solModo === 'total' && !S.hayDifusa) nota += ' Para esta hora no hay dato de luz difusa (hay entre 2001 y 2025 y en los días consultados en línea): se muestra solo el sol directo.';
    if (anioSol) {
      const R = consultas?.radiacion?.fachadas;
      nota = R ? `Total de un año típico (2001–2025) en una pared sin alero de cada orientación. La escala de color llega a 1.000 kWh/m²: el techo, ~1.800, queda en el tope. Solo el sol directo: SE ${miles(R.se.directa)} · SO ${miles(R.so.directa)} · NE ${miles(R.ne.directa)} · NO ${miles(R.no.directa)} kWh/m²; la difusa del cielo suma entre ${miles(Math.min(R.se.difusa, R.so.difusa, R.ne.difusa, R.no.difusa))} y ${miles(Math.max(R.se.difusa, R.so.difusa, R.ne.difusa, R.no.difusa))} según la orientación, y la reflejada por el suelo ${miles(R.se.reflejada)} en cada una. En «Año típico» cada pared se pinta según su orientación, sin descontar la sombra del alero.` : 'Cargando los totales del año…';
    }
  }
  if (S.lente === 'viento') {
    if (S.vientoModo === 'hora') nota = S.vientoDato ? `Ahora el viento viene del ${rumboTexto(c.dir)} a ${Math.round(c.viento)} km/h.` : 'Para esta hora no hay dato de viento con dirección (solo valores típicos). Elige «Seca», «Lluvias» o «Año», o una fecha entre 2001 y 2025.';
    else if (consultas?.viento) { const V = consultas.viento[S.vientoModo]; nota = `${S.vientoModo === 'seca' ? 'Temporada seca (diciembre a abril)' : S.vientoModo === 'lluvias' ? 'Temporada de lluvias (mayo a noviembre)' : 'Todo el año'}, 2001–2025: velocidad media ${Math.round(V.media)} km/h; viento flojo (menos de 1 m/s) el ${Math.round(V.calma)} % del tiempo. El color es relativo: el más claro es la fachada que más lo recibe.`; }
  }
  if (S.lente === 'lluvia' && S.aguaModo === 'hora' && !S.viaje) {
    if (!S.aguaDato) nota = 'Para esta hora no hay dato de lluvia y viento (solo valores típicos). Pasa a «Año típico» o elige una fecha entre 2001 y 2025.';
    else if (!(S.agua ?? []).some((v) => v > 0.05)) nota = 'A esta hora no llueve con viento contra ninguna fachada. Pasa a «Año típico» o busca un aguacero en «Ir a…».';
  }
  if (S.lente === 'lluvia' && S.aguaModo === 'anio') nota = 'Promedio de un año, 2001–2025. El color es relativo: el más claro es la fachada más expuesta.';
  if (S.lente === 'sombras') nota = !escena._diagClave ? 'El diagrama aparece cuando termina de cargar el modelo.' : `Sombras del ${fechaTexto(S.fecha)}. Se ven mejor desde arriba: botón «Planta».`;
  if (esPartes) nota = 'Toca otra etiqueta sobre el edificio para ver esa parte. Si no ves alguna, gira el edificio: cada etiqueta aparece en la cara que tienes enfrente.';
  $('#ley-nota').textContent = nota; $('#ley-nota').hidden = !nota;
  hayMas(el);
}

// ---------------- Partes del edificio (forma de ver «Partes») ----------------
// Etiquetas ancladas al modelo (metros; +X = noreste, +Z = sureste; el muro va de ±22,75 × ±11,5 y los aleros llegan a ±24,4 × ±13,15).
// Cada parte trae candidatos en varias caras, en orden: se usa el primero que mira hacia la cámara, así las etiquetas se reparten
// entre las fachadas que se ven. Posiciones medidas en la geometría del modelo (ménsulas, ventanas, aleros, cumbrera).
const LADO = { se: [0, 0, 1], no: [0, 0, -1], ne: [1, 0, 0], so: [-1, 0, 0] };
const PARTES = {
  techo: { e: 'Techo a cuatro aguas', t: 'Techo a cuatro aguas', a: [[[3, 15.7, 0], null]],
    que: 'Un techo con cuatro lados inclinados que bajan hacia las cuatro fachadas.',
    aqui: 'De teja de arcilla. En el modelo, la línea más alta del techo (la cumbrera) queda a unos 15,7 m del suelo y mide unos 29 m de largo.',
    hace: 'La pendiente saca rápido el agua de lluvia (aquí caen unos 2.000 mm al año), y los cuatro lados terminan en aleros que protegen todas las fachadas.' },
  alero: { e: 'Alero', t: 'Alero', a: [[[24.4, 7.4, -3], 'ne'], [[-13, 7.4, 13.15], 'se'], [[13, 7.4, -13.15], 'no'], [[-24.4, 7.4, 3], 'so']],
    que: 'La parte de la cubierta que sobresale del muro, como la visera de una gorra. Los dos niveles intermedios son tejaroces corridos, lo que el informe del Ejército llama mediagua.',
    aqui: 'Tres aleros, uno por piso, a 3,74, 7,40 y 11,10 m de altura. Los tres salen 1,65 m del muro.',
    hace: 'Dan sombra a las ventanas cuando el sol, visto de perfil contra la fachada, está alto, y alejan la lluvia de los muros. El sol bajo de la tarde entra por debajo. Cuanto más largo, más protege, pero más cuesta sostenerlo.' },
  lateral: { e: 'Fachada lateral', t: 'Fachada lateral', a: [[[22.75, 9.3, -6], 'ne'], [[-22.75, 9.3, 6], 'so']],
    que: 'Cada una de las caras cortas de un edificio alargado. En arquitectura también se le dice testero.',
    aqui: 'Dos de 23 m: la noreste, hacia el jardín de la esquina, y la suroeste.',
    hace: 'Son más cortas. Por metro, la suroeste recibe casi lo mismo que la sureste, y además el sol bajo de la tarde, el de las horas más calurosas; la noreste, algo menos.' },
  principal: { e: 'Fachada principal', t: 'Fachada principal', a: [[[-17, 9.2, 11.5], 'se']],
    que: 'Cada cara exterior de un edificio es una fachada; la principal es la de la entrada.',
    aqui: 'Mira al sureste y tiene la entrada con el letrero 106. La de atrás mira al noroeste. Las dos miden 45,5 m.',
    hace: 'Hacia dónde mira cada fachada decide cuánto sol, lluvia y viento recibe. Pruébalo con Sol, Lluvia y Viento.' },
  mensula: { e: 'Ménsula', t: 'Ménsula', a: [[[16.75, 3.35, 12.0], 'se'], [[23.3, 3.35, 7.26], 'ne'], [[-4.52, 3.35, -12.0], 'no'], [[-23.4, 3.35, -6.85], 'so']],
    que: 'Una pieza en forma de escuadra que sostiene el alero desde abajo, como el soporte de una repisa.',
    aqui: 'Unas 78 ménsulas en el modelo, bajo los tres aleros. En la fachada principal se repiten cada 6,70 m. El modelo no dice si cargan de verdad o son decorativas.',
    hace: 'Es el apoyo típico de un voladizo: lleva parte de su peso hasta el muro.' },
  vano: { e: 'Abertura (vano)', t: 'Abertura (vano)', a: [[[-11.36, 6.3, 11.5], 'se'], [[9.78, 6.3, -11.5], 'no'], [[22.7, 6.3, 5.82], 'ne'], [[-22.7, 6.3, 5.9], 'so']],
    que: 'Cualquier hueco en un muro: una ventana o una puerta. En arquitectura se le llama vano.',
    aqui: 'Unas 116 aberturas en el modelo: 112 ventanas (las de los pisos 2 y 3, inferidas) y 4 puertas. En los pisos 2 y 3 de la fachada principal, las ventanas van de dos en dos.',
    hace: 'Deja entrar la luz y el aire. Su tamaño y su lugar deciden cuánto sol entra; por eso importa el alero que tiene encima.' },
  modulo: { e: 'Módulo', t: 'Módulo', a: [[[16.75, 5.6, 11.6], 'se']],
    que: 'Una medida o un tramo que se repite a lo largo del edificio.',
    aqui: 'En los pisos 2 y 3 de la fachada principal, el tramo resaltado se repite cada 6,70 m: dos ventanas juntas y una ménsula sobre el muro angosto que las separa. Hay seis tramos iguales y, en cada punta, uno más corto con una sola ventana.',
    hace: 'Repetir un mismo tramo ordena la fachada y simplifica el diseño y la construcción: se resuelve una vez y se repite.' },
  zocalo: { e: 'Base o zócalo', t: 'Base o zócalo', a: [[[22.8, 0.35, 4], 'ne'], [[-22.8, 0.35, -4], 'so'], [[-16, 0.35, 11.55], 'se'], [[8, 0.35, -11.55], 'no']],
    que: 'La franja de abajo del edificio, más alta que el terreno.',
    aqui: '0,65 m de alto, en todo el perímetro.',
    hace: 'Eleva el piso y aleja el arranque del muro del agua que salpica cuando llueve. La humedad que sube del terreno se corta con una barrera impermeable, no con la altura.' },
  escala: { e: '1,70 m', t: 'Escala humana: ¿qué tan grande es?', a: [[[24.7, 1.95, 11.3], null]], hk: 'Qué enseña:',
    que: 'Una persona de 1,70 m junto a la esquina del jardín, para comparar el edificio con el cuerpo.',
    aqui: 'Con «Alturas» se ven las medidas en la esquina. Cada fila compara una medida con personas de 1,70 m:',
    hace: 'Un piso alto aleja la cabeza del techo caliente y, si hay aberturas arriba, deja escapar el aire caliente. Sin ellas, la ganancia es pequeña.' },
};
// cotas de la regla de alturas (esquina noreste–sureste) y la cumbrera
const COTAS = [[[22.75, 0.65, 11.5], '0,65 m · base'], [[22.75, 3.74, 11.5], '3,74 m · primer alero'], [[22.75, 7.4, 11.5], '7,40 m · segundo alero'],
  [[22.75, 11.1, 11.5], '11,10 m · tercer alero'], [[14.4, 15.73, 0], 'cumbrera · 15,7 m', 'der']];

function prepararPartes() {
  const capa = $('#partes-capa');
  capa.innerHTML = Object.entries(PARTES).map(([k, P]) => `<button type="button" class="parte${k === 'escala' ? ' persona' : ''}" data-parte="${k}" aria-pressed="false" hidden><i></i><span>${P.e}</span></button>`).join('')
    + COTAS.map(([, t, d], i) => `<span class="cota${d ? ' der' : ''}" data-cota="${i}" hidden>${t}</span>`).join('');
  capa.addEventListener('click', (e) => { const b = e.target.closest('[data-parte]'); if (b) elegirParte(b.dataset.parte); });
  document.querySelectorAll('#ley-parte [data-mostrar]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.mostrar; S[k] = !S[k];
    if (!S.persona && S.parte === 'escala') S.parte = 'alero';
    aplicarPartes(); pintarPartes.f = ''; lastLect = ''; $('#leyenda').dataset.lente = '';
  }));
  $('#lp-voladizo').addEventListener('click', () => abrirVoladizo(true));
  $('#cerrar-voladizo').addEventListener('click', () => abrirVoladizo(false));
  document.querySelectorAll('#voladizo [data-largo]').forEach((b) => b.addEventListener('click', () => { S.largo = +b.dataset.largo; pintarVoladizo(); }));
  document.querySelectorAll('#corte [data-corte]').forEach((b) => b.addEventListener('click', () => { S.corteF = b.dataset.corte; pintarCorte(); }));
  pintarVoladizo();
}
function elegirParte(k) {
  if (!PARTES[k]) return;
  anunciar();
  S.parte = k; S.verLeyenda = true;
  if (k === 'escala') { S.persona = true; S.alturas = true; }
  aplicarPartes(); pintarPartes.f = ''; lastLect = '';
}
/** La persona, la regla y el módulo resaltado solo existen dentro de «Partes». */
function aplicarPartes() {
  const on = S.lente === 'partes';
  escena?.setPartes({ persona: on && S.persona, alturas: on && S.alturas, modulo: on && S.parte === 'modulo' });
  document.querySelectorAll('.parte').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.parte === S.parte)));
  if (!on) abrirVoladizo(false);
}
const _pp = new THREE.Vector3(), _pv = new THREE.Vector3();
// paneles de la interfaz que las etiquetas no deben tapar ni quedar debajo
const OBSTACULOS = ['#brujula', '#mirando', '.vistas', '.lentes', '#leyenda', '#dock', '#recorrido', '#oferta-recorrido', '#sirve', '#ir-a', '#capas', '#confort', '#panel-fachada', '#qr', '#aviso.ver', '#rotulo', '.pista', '#viaje', '#aviso-noche'];
/** Rectángulos (con 6 px de margen) de la barra de arriba y de los paneles visibles. Casi todos son position: fixed, así que
 *  offsetParent no sirve para saber si se ven: un panel oculto (display: none) da un rectángulo vacío. */
function rectsUI(W) {
  const obst = [[0, 0, W, 66]];
  for (const q of OBSTACULOS) {
    const el = document.querySelector(q); if (!el || el.hidden) continue;
    const r = el.getBoundingClientRect(); if (r.width && r.height && getComputedStyle(el).opacity !== '0') obst.push([r.left - 6, r.top - 6, r.width + 12, r.height + 12]);
  }
  return obst;
}
const cruzaR = (a, b, m = 5) => a[0] < b[0] + b[2] + m && b[0] < a[0] + a[2] + m && a[1] < b[1] + b[3] + m && b[1] < a[1] + a[3] + m;

// Rótulos de hora de la escena (las sombras de cada hora y el arco del sol): son sprites que siguen al terreno. Se oculta el
// que caería bajo un panel o encima de otro rótulo; primero se ponen las horas que más dicen (mediodía y los extremos del día).
const ORDEN_HORAS = [12, 6, 18, 9, 15, 7, 17, 8, 16, 10, 14, 11, 13];
function esquivarHoras() {
  const diag = escena?.diagRotulos, ruta = escena?.rutaRotulos ?? [];
  if (!diag) return;
  const cam = escena.camera, W = innerWidth, H = innerHeight;
  const verDiag = U.sombras.value > 0.01 && !!escena._diagClave, verRuta = escena.uRuta.value > 0.01 && U.sombras.value < 0.5;
  const html = document.documentElement;
  const firma = [cam.position.x, cam.position.y, cam.position.z, controls.target.x, controls.target.y, controls.target.z].map((v) => Math.round(v * 20)).join(',')
    + `|${W}x${H}|${verDiag}|${verRuta}|${escena._diagClave}|${escena._ruta}|${html.className}|${S.lente}|${S.parte}|${S.verLeyenda}|${S.paso}|${Math.round(ENC.dy)}`
    + ['#sirve', '#ir-a', '#capas', '#confort', '#voladizo', '#oferta-recorrido', '#qr', '#viaje'].map((q) => $(q)?.hidden ? 0 : 1).join('');
  if (firma === esquivarHoras.f) return;
  esquivarHoras.f = firma;
  const obst = (verDiag || verRuta) ? rectsUI(W) : [], puestos = [];
  const px = H / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));      // píxeles por metro a 1 m de distancia
  const colocar = (s, vale) => {
    let tapado = false;
    if (vale) {
      _pv.copy(s.position).project(cam);
      if (_pv.z < 1 && _pv.z > -1) {
        const x = (_pv.x + 1) / 2 * W, y = (1 - _pv.y) / 2 * H, k = px / Math.max(1, cam.position.distanceTo(s.position));
        const w = s.scale.x * k * 0.7, h = s.scale.y * k * 0.62, r = [x - w / 2, y - h / 2, w, h];   // el texto ocupa ~70 × 62 % del sprite
        tapado = obst.some((o) => cruzaR(r, o, 0)) || puestos.some((o) => cruzaR(r, o, 8));
        if (!tapado) puestos.push(r);
      }
    }
    if (!!s.userData.tapado !== tapado) { s.userData.tapado = tapado; escena.sucio = true; }
  };
  const porHora = new Map(diag.map((s) => [s.userData.h, s]));
  for (const h of ORDEN_HORAS) { const s = porHora.get(h); if (s) colocar(s, verDiag && s.userData.vale); }
  for (const s of ruta) colocar(s, verRuta && s.userData.arriba);
}
/** Coloca las etiquetas sobre la imagen: proyecta cada ancla con la cámara, esquiva los paneles y evita que se encimen. */
function pintarPartes() {
  const capa = $('#partes-capa'); if (!capa || !escena) return;
  const ver = S.lente === 'partes' && !intro && !S.viaje && !S.voladizo;
  if (capa.hidden === ver) capa.hidden = !ver;
  if (!ver) return;
  const cam = escena.camera, W = innerWidth, H = innerHeight;
  const firma = [cam.position.x, cam.position.y, cam.position.z, controls.target.x, controls.target.y, controls.target.z].map((v) => Math.round(v * 50)).join(',')
    + `|${W}x${H}|${S.persona}|${S.alturas}|${S.parte}|${S.verLeyenda}|${S.paso}|${$('#sirve').hidden}${$('#ir-a').hidden}${$('#capas').hidden}`;
  if (firma === pintarPartes.f) return;
  pintarPartes.f = firma;
  // 1) leer: dónde están los paneles (antes de mover nada, para no forzar el diseño dos veces)
  const obst = rectsUI(W), cruza = cruzaR;
  const tapa = (r) => obst.some((o) => cruza(r, o, 0));
  const puestos = [];
  const aPantalla = (p) => {
    _pv.set(p[0], p[1], p[2]).project(cam);
    if (_pv.z > 1 || _pv.z < -1 || Math.abs(_pv.x) > 0.98 || Math.abs(_pv.y) > 0.98) return null;
    return [(_pv.x + 1) / 2 * W, (1 - _pv.y) / 2 * H];
  };
  const anchos = new Map();
  capa.querySelectorAll('.parte, .cota').forEach((el) => { if (!el._w) { const h0 = el.hidden; el.hidden = false; el._w = (el.querySelector('span') ?? el).offsetWidth; el.hidden = h0; } anchos.set(el, el._w || 110); });
  // 2) cotas de la regla (fijas: se ponen primero y las etiquetas las esquivan)
  capa.querySelectorAll('.cota').forEach((el) => {
    const q = S.alturas ? aPantalla(COTAS[+el.dataset.cota][0]) : null;
    const r = q && [q[0] + 12, q[1] - 13, anchos.get(el), 26];
    const ok = r && !tapa(r) && !puestos.some((o) => cruza(r, o, 2));
    el.hidden = !ok; if (!ok) return;
    puestos.push(r);
    el.style.transform = `translate(${q[0].toFixed(1)}px, ${q[1].toFixed(1)}px)`;
  });
  // 3) etiquetas: primero el lugar natural (arriba del punto); si choca, más arriba o corrida a un lado
  for (const [k, P] of Object.entries(PARTES)) {
    const el = capa.querySelector(`[data-parte="${k}"]`); if (!el) continue;
    let q = null;
    if (k !== 'escala' || S.persona) for (const [p, lado] of P.a) {
      if (lado) {                                                     // solo la cara que mira hacia la cámara
        const n = LADO[lado]; _pp.set(p[0], p[1], p[2]); _pv.copy(cam.position).sub(_pp).normalize();
        if (n[0] * _pv.x + n[1] * _pv.y + n[2] * _pv.z < 0.12) continue;
      }
      q = aPantalla(p); if (q && tapa([q[0] - 6, q[1] - 6, 12, 12])) q = null;   // el punto mismo quedaría bajo un panel
      if (q) break;
    }
    if (!q) { el.hidden = true; continue; }
    const w = anchos.get(el), h = 31, lx = Math.max(0, w / 2 - 16);
    const opciones = [[0, 0], [0, 36], [-lx, 0], [lx, 0], [0, 72], [-lx, 36], [lx, 36], [0, 108], [-lx, 72], [lx, 72], [0, 144]];
    let elegido = null;
    // 0: sin tocar otra etiqueta ni la línea que la une a su punto · 1 (solo la parte elegida): se permite encimar etiquetas, nunca paneles
    for (const pasada of k === S.parte ? [0, 1] : [0]) {
      for (const [dx, dy] of opciones) {
        const r = [q[0] - w / 2 + dx, q[1] - 18 - h - dy, w, h], tallo = [q[0] - 3, q[1] - 18 - dy, 6, 18 + dy];
        if (tapa(r) || r[0] < 4 || r[0] + w > W - 4) continue;
        if (pasada === 0 && (puestos.some((o) => cruza(r, o)) || puestos.some((o) => !o.tallo && cruza(tallo, o, 2)))) continue;
        elegido = [dx, dy, r, tallo]; break;
      }
      if (elegido) break;
    }
    if (!elegido) { el.hidden = true; continue; }
    const tallo = elegido[3]; tallo.tallo = true;
    el.hidden = false; puestos.push(elegido[2], tallo);
    el.style.transform = `translate(${q[0].toFixed(1)}px, ${q[1].toFixed(1)}px)`;
    el.style.setProperty('--dx', elegido[0].toFixed(1) + 'px'); el.style.setProperty('--dy', elegido[1] + 'px');
  }
}

// El alero como voladizo: proporciones con la misma sección y la misma carga por metro (no es el cálculo de este alero)
const VISTA_ALERO = { pos: [34.6, 7.5, 29.6], tgt: [19, 7.5, 11] };        // la esquina: los aleros y sus ménsulas de perfil, a la derecha del panel (en la misma línea de antes, más cerca: en (40; 36) quedaba dentro de la caja de 11 m que el contexto anterior ponía sobre la huella 108; hoy ahí está La Casa, un salón de un piso cuya huella empieza en z ≈ 30,6 y cuya cubierta queda por debajo de los 7 m)
function abrirVoladizo(abrir) {
  const el = $('#voladizo'); if (!el) return;
  if (!!S.voladizo === abrir) return;
  S.voladizo = abrir; el.hidden = !abrir; pintarPartes.f = '';
  if (abrir) {
    $('#sirve').hidden = true; $('#abrir-sirve').setAttribute('aria-expanded', 'false'); globalThis.__abrirIr?.(false);
    if (S.fachada) S.corteF = S.fachada.slice(8);            // el corte arranca en la fachada que se estaba mirando
    S.fachada = null; document.documentElement.classList.remove('en-fachada');
    S.vistaPrevia = { pos: escena.camera.position.toArray(), tgt: controls.target.toArray() };
    volarA(VISTA_ALERO, 1.6, null);
  } else if (S.vistaPrevia && S.lente === 'partes') { volarA(S.vistaPrevia, 1.4, null); S.vistaPrevia = null; }
  else S.vistaPrevia = null;
}
function pintarVoladizo() {
  const L = S.largo ?? 1.65, coma = num;
  const K = 150, x0 = 46, y0 = 70, th = 14, Lp = L * K;
  const tip = 14 * Math.pow(L / 1.65, 4);
  const baja = (s) => tip * (s * s * (6 - 4 * s + s * s) / 3);          // forma de la deformada de una viga en voladizo con carga repartida
  const curva = (off) => Array.from({ length: 25 }, (_, i) => { const s = i / 24; return [x0 + s * Lp, y0 + off + baja(s)]; });
  const top = curva(0), bot = curva(th);
  const trazo = (a) => a.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const cuerpo = trazo(top) + ' ' + bot.slice().reverse().map((p) => 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + ' Z';
  let flechas = '';
  for (let x = x0 + 18; x <= x0 + Lp - 4; x += 30) {
    const y = y0 + baja((x - x0) / Lp) - 3;
    flechas += `M${x.toFixed(1)} 26 L${x.toFixed(1)} ${y.toFixed(1)} M${(x - 4).toFixed(1)} ${(y - 7).toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)} L${(x + 4).toFixed(1)} ${(y - 7).toFixed(1)} `;
  }
  const yb = 186, hm = 26 * Math.pow(L / 1.65, 2);
  let mom = `M${x0} ${yb}`;
  for (let i = 0; i <= 24; i++) { const s = i / 24; mom += ` L${(x0 + s * Lp).toFixed(1)} ${(yb - hm * (1 - s) * (1 - s)).toFixed(1)}`; }
  mom += ' Z';
  const xc = x0 + 10 + Math.max(0, Math.min(Lp - 160, 150)), yc = y0 + th + baja((xc - x0) / Lp) + 16;
  $('#vol-svg').innerHTML = `
    <rect x="18" y="16" width="28" height="176" fill="#3a4448"></rect>
    <path d="M18 30 L46 16 M18 58 L46 44 M18 86 L46 72 M18 114 L46 100 M18 142 L46 128 M18 170 L46 156 M18 192 L42 180" stroke="#5a666b" stroke-width="1.5"></path>
    <text x="32" y="12" text-anchor="middle" class="vt m">muro</text>
    <rect x="46" y="70" width="${(1.65 * K).toFixed(1)}" height="14" fill="none" stroke="rgba(239,233,222,0.35)" stroke-dasharray="4 4"></rect>
    <path d="${flechas}" stroke="#b6bdb9" stroke-width="1.5" fill="none"></path>
    <path d="${cuerpo}" fill="rgba(239,233,222,0.22)"></path>
    <path d="${trazo(top)}" stroke="#e2553a" stroke-width="3" fill="none"></path>
    <path d="${trazo(bot)}" stroke="#4aa8dc" stroke-width="3" fill="none"></path>
    <path d="${mom}" fill="rgba(244,181,69,0.28)" stroke="#f4b545" stroke-width="1.5"></path>
    <line x1="46" y1="186" x2="${(x0 + Lp).toFixed(1)}" y2="186" stroke="rgba(239,233,222,0.35)"></line>
    <text x="56" y="62" class="vt" fill="#ff8a70">tracción: se estira</text>
    <text x="${xc.toFixed(0)}" y="${yc.toFixed(0)}" class="vt" fill="#7cc4ec">compresión: se aprieta</text>
    <text x="52" y="${yb - 7}" class="vt" fill="#f4b545">momento: máximo en la raíz</text>
    <text x="504" y="30" text-anchor="end" class="vt m">deformación exagerada</text>`;
  const m = Math.pow(L / 1.65, 2), d = Math.pow(L / 1.65, 4), ang = Math.atan(1.65 / L) * 180 / Math.PI, real = Math.abs(L - 1.65) < 0.01;
  $('#vol-m').textContent = real ? 'igual' : '×' + coma(m, m < 1 ? 2 : 1);
  $('#vol-d').textContent = real ? 'igual' : '×' + coma(d, d < 1 ? 2 : 1);
  $('#vol-a').textContent = Math.round(ang) + '°';
  document.querySelectorAll('#voladizo [data-largo]').forEach((b) => b.setAttribute('aria-pressed', String(Math.abs(+b.dataset.largo - L) < 0.01)));
}

// Corte del alero con el rayo de sol: piso 2 de una fachada, esquema 2D. Alturas medidas en el modelo 3D: alero (su cara
// de abajo) a 3,74 y 7,40 m; vidrio del piso 2 de 5,62 a 7,12 m, 10 cm hacia adentro del muro. Con el alero real de 1,65 m
// sale el mismo corte del hallazgo: todo el vidrio al sol por debajo de ~9° de perfil y todo a la sombra por encima de ~45°.
const CORTE = { alero: 7.4, losa: 3.74, esp: 0.2, vidAbajo: 5.62, vidArriba: 7.12, rehundido: 0.1, muro: 0.25 };
const SIGLA = { se: 'SE', no: 'NO', ne: 'NE', so: 'SO' };
const VIDRIO_TXT = { sombra: 'a la sombra', casiSombra: 'casi todo a la sombra', medias: 'a medias', casiSol: 'casi todo al sol', sol: 'al sol' };
/** Ángulo de perfil (grados) del sol sobre una fachada vertical, o null si el sol está detrás o bajo el horizonte. */
function perfilSol(alt, az, rumbo) {
  const c = Math.cos((az - rumbo) * Math.PI / 180);
  if (alt <= 0 || c <= 0.01) return null;
  return Math.atan(Math.tan(alt * Math.PI / 180) / c) * 180 / Math.PI;
}
function estadoCorte(p, L, k) {
  const C = CORTE, pf = perfilSol(p.alt, p.az, FACHADAS['fachada-' + k].rumbo);
  if (pf == null) return { pf, motivo: p.alt <= 0 ? 'noche' : 'detras' };
  const t = Math.tan(pf * Math.PI / 180);
  const dw = L * t, dg = (L + C.rehundido) * t;                   // cuánto baja la sombra en el muro y en el vidrio
  const alto = C.vidArriba - C.vidAbajo, sup = C.alero - C.vidArriba;
  const frac = Math.min(1, Math.max(0, (dg - sup) / alto));       // parte del vidrio (desde arriba) a la sombra
  const vidrio = frac >= 0.97 ? 'sombra' : frac >= 0.75 ? 'casiSombra' : frac > 0.25 ? 'medias' : frac > 0.03 ? 'casiSol' : 'sol';
  return { pf, t, dw, dg, frac, vidrio, hSombra: C.alero - dw, pisoEntero: C.alero - dw <= C.losa + C.esp };
}
function pintarCorte(p) {
  const el = $('#corte-svg'); if (!el) return;
  p ??= S.solViaje ?? posicionSol({ ...S.fecha, h: 0, min: S.min });
  const L = S.largo ?? 1.65, k = S.corteF ?? 'se';
  const clave = [L, k, p.alt.toFixed(2), p.az.toFixed(2)].join('|');
  if (clave === pintarCorte.f) return; pintarCorte.f = clave;
  document.querySelectorAll('#corte [data-corte]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.corte === k)));
  $('#corte-t').textContent = `Corte del piso 2, fachada ${SIGLA[k]}, con el sol de esta hora`;
  const C = CORTE, E = estadoCorte(p, L, k), coma = (v, n = 2) => num(v, n);
  const K = 58, XW = 64, Y = (h) => 302 - (h - 3.3) * K, X = (m) => XW + m * K;   // m: metros hacia afuera desde la cara del muro
  const tip = X(L), fl = C.losa + C.esp, yv0 = Y(C.vidArriba), yv1 = Y(C.vidAbajo);
  const r = (x0, y0, x1, y1, extra) => `<rect x="${Math.min(x0, x1).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${Math.abs(x1 - x0).toFixed(1)}" height="${Math.abs(y1 - y0).toFixed(1)}" ${extra}></rect>`;
  let g = '';
  // losa de abajo (piso) y de arriba (alero), muro con el hueco de la ventana y el vidrio rehundido
  g += r(0, Y(C.losa), tip, Y(fl), 'fill="#56615f"') + r(0, Y(C.alero), tip, Y(C.alero + C.esp), 'fill="#56615f"');
  g += r(X(-C.muro), Y(fl), XW, yv1, 'fill="#3a4448"') + r(X(-C.muro), yv0, XW, Y(C.alero), 'fill="#3a4448"');
  g += r(X(-C.rehundido) - 3, yv0, X(-C.rehundido), yv1, 'fill="#4aa8dc" fill-opacity="0.55"');
  // cara del muro y del vidrio: ámbar donde incide el sol, gris donde hay sombra
  const franja = (x, h0, h1, sol) => h1 > h0 ? `<line x1="${x.toFixed(1)}" y1="${Y(h1).toFixed(1)}" x2="${x.toFixed(1)}" y2="${Y(h0).toFixed(1)}" stroke="${sol ? '#f4b545' : '#7f8a86'}" stroke-width="${sol ? 5 : 3}" stroke-linecap="butt"></line>` : '';
  const partes = [[XW + 2.5, fl, C.vidAbajo, E.dw], [XW + 2.5, C.vidArriba, C.alero, E.dw], [X(-C.rehundido) + 2.5, C.vidAbajo, C.vidArriba, E.dg]];
  for (const [x, h0, h1, d] of partes) {
    if (E.pf == null) { g += franja(x, h0, h1, false); continue; }
    const hs = Math.min(h1, Math.max(h0, C.alero - d));           // por debajo de hs hay sol
    g += franja(x, h0, hs, true) + franja(x, hs, h1, false);
  }
  // rótulos fijos
  g += `<text x="4" y="${(Y(C.alero) + 15).toFixed(1)}" class="m">${coma(C.alero)} m</text><text x="4" y="${(Y(C.losa) + 15).toFixed(1)}" class="m">${coma(C.losa)} m</text>`;
  g += `<text x="${(X(-C.muro) - 4).toFixed(1)}" y="${((yv1 + Y(fl)) / 2 + 4).toFixed(1)}" text-anchor="end" class="m">muro</text>`;
  g += `<text x="${(X(-C.muro) - 4).toFixed(1)}" y="${((yv0 + yv1) / 2 + 4).toFixed(1)}" text-anchor="end" class="m">vidrio</text>`;
  g += `<text x="${((XW + tip) / 2).toFixed(1)}" y="${(Y(C.alero + C.esp) - 6).toFixed(1)}" text-anchor="middle">alero ${coma(L)} m</text>`;
  g += `<text x="4" y="16" class="m">esquema · alero continuo, sin retornos laterales</text>`;
  g += `<text x="396" y="${(Y(fl) - 8).toFixed(1)}" text-anchor="end" class="m">fachada ${SIGLA[k]} · exterior →</text>`;
  if (E.pf == null) {
    g += `<text x="${(tip + 12).toFixed(1)}" y="${(Y(6.4)).toFixed(1)}" class="s">${E.motivo === 'noche' ? 'El sol está bajo el horizonte' : 'El sol está detrás de esta fachada'}</text>`;
    g += `<text x="${(tip + 12).toFixed(1)}" y="${(Y(6.4) + 17).toFixed(1)}" class="m">sin rayo directo a esta hora</text>`;
  } else {
    const a = E.pf * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), ya = Y(C.alero);
    // hasta dónde llega el rayo que roza la punta del alero
    let hx = XW, hy = E.hSombra;
    if (E.hSombra < C.vidArriba && E.hSombra > C.vidAbajo) { const hg = C.alero - E.dg; if (hg >= C.vidAbajo) { hx = X(-C.rehundido); hy = hg; } }
    if (hy < fl) { hy = fl; hx = tip - (C.alero - fl) / E.t * K; }
    const rayo = (x1, y1) => {
      const R = Math.min((396 - x1) / ux, (y1 - 36) / uy);
      return { x0: x1 + ux * R, y0: y1 - uy * R };
    };
    const hxPx = hx, hyPx = Y(hy), o = rayo(tip, ya);
    // rayos paralelos más abajo: inciden en el muro o el vidrio al sol
    for (let i = 1; i <= 3; i++) {
      const hh = hy - i * 0.62; if (hh < fl + 0.05) break;
      const enVid = hh > C.vidAbajo && hh < C.vidArriba, x1 = enVid ? X(-C.rehundido) : XW, y1 = Y(hh);
      const q = rayo(x1, y1);
      g += `<line x1="${q.x0.toFixed(1)}" y1="${q.y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#f4b545" stroke-opacity="0.45" stroke-width="1.5"></line>`;
    }
    g += `<line x1="${o.x0.toFixed(1)}" y1="${o.y0.toFixed(1)}" x2="${hxPx.toFixed(1)}" y2="${hyPx.toFixed(1)}" stroke="#ffd27a" stroke-width="2.5"></line>`;
    g += `<circle cx="${o.x0.toFixed(1)}" cy="${o.y0.toFixed(1)}" r="9" fill="#f4b545"></circle>`;
    // ángulo de perfil en la punta del alero
    const ra = 34, ax = tip + ra * ux, ay = ya - ra * uy;
    g += `<path d="M${(tip + ra).toFixed(1)} ${ya.toFixed(1)} A${ra} ${ra} 0 0 0 ${ax.toFixed(1)} ${ay.toFixed(1)}" fill="none" stroke="#ffd27a" stroke-width="1.5"></path>`;
    g += `<line x1="${tip.toFixed(1)}" y1="${ya.toFixed(1)}" x2="${(tip + ra + 12).toFixed(1)}" y2="${ya.toFixed(1)}" stroke="#ffd27a" stroke-width="1" stroke-dasharray="3 3"></line>`;
    const rb = ra + 14, bx = tip + rb * Math.cos(a / 2), by = ya - rb * Math.sin(a / 2) + 5;
    g += `<text x="${bx.toFixed(1)}" y="${by.toFixed(1)}" class="s">${Math.round(E.pf)}°</text>`;
    // cota de la sombra sobre el muro
    const hc = Math.max(fl, E.hSombra), xc = XW + 14;
    g += `<path d="M${xc} ${ya.toFixed(1)} L${xc} ${Y(hc).toFixed(1)} M${xc - 4} ${ya.toFixed(1)} L${xc + 4} ${ya.toFixed(1)} M${xc - 4} ${Y(hc).toFixed(1)} L${xc + 4} ${Y(hc).toFixed(1)}" stroke="#b6bdb9" stroke-width="1.2"></path>`;
    if (!E.pisoEntero && E.dw > 0.7) g += `<text x="${xc + 7}" y="${((ya + Y(hc)) / 2 + 4).toFixed(1)}" class="m">sombra ${coma(E.dw)} m</text>`;
  }
  const hora = hhmm(S.min), fach = `fachada ${SIGLA[k]}`;
  let txt, desc = `Corte esquemático del piso 2, ${fach}, con un alero de ${coma(L)} m. `;
  if (E.pf == null) {
    txt = E.motivo === 'noche' ? `A las ${hora} el sol está bajo el horizonte: no hay rayo directo en ninguna fachada.`
      : `A las ${hora} el sol está detrás de la ${fach}: esta cara está a la sombra con o sin alero. Prueba otra fachada o mueve la hora.`;
    desc += E.motivo === 'noche' ? 'El sol está bajo el horizonte.' : 'El sol está detrás de la fachada, sin rayo directo.';
    $('#corte-perfil').textContent = '–'; $('#corte-sombra').textContent = '–'; $('#corte-vidrio').textContent = 'sin sol';
  } else {
    const pfT = `${coma(E.pf, 1)}°`, somT = E.pisoEntero ? 'todo el piso' : `${coma(E.dw)} m`;
    $('#corte-perfil').textContent = pfT; $('#corte-sombra').textContent = somT;
    $('#corte-vidrio').textContent = VIDRIO_TXT[E.vidrio];
    txt = `A las ${hora} el sol incide sobre la ${fach} con un ángulo de perfil de ${pfT}. `;
    if (E.pisoEntero) txt += 'La sombra del alero cubre todo este piso: el vidrio y el muro quedan sin sol directo.';
    else if (E.vidrio === 'sombra') txt += `La sombra baja ${coma(E.dw)} m por el muro y tapa todo el vidrio; el sol solo incide en la franja de muro que queda debajo, hasta ${coma(E.hSombra)} m del suelo.`;
    else if (E.vidrio === 'sol') txt += `El sol entra por debajo del alero e incide en todo el vidrio. La sombra solo baja ${coma(E.dw)} m${E.dw > 0.05 ? ', sobre el muro que hay encima de la ventana' : ''}.`;
    else txt += `La sombra baja ${coma(E.dw)} m: cubre ${E.vidrio === 'casiSol' ? 'solo' : ''} la parte de arriba del vidrio (${Math.round(E.frac * 100)} %) y el resto recibe sol.`.replace('cubre  la', 'cubre la');
    desc += `Sol de perfil a ${Math.round(E.pf)} grados. ${E.pisoEntero ? 'La sombra del alero cubre todo el piso.' : `La sombra del alero baja ${coma(E.dw)} m por el muro.`} El vidrio queda ${E.vidrio === 'sombra' || E.vidrio === 'sol' ? VIDRIO_TXT[E.vidrio] : `${VIDRIO_TXT[E.vidrio]}, ${Math.round(E.frac * 100)} % a la sombra`}.`;
  }
  el.innerHTML = `<desc id="corte-desc">${desc}</desc>${g}`;
  $('#corte-txt').textContent = txt;
}

// ---------------- Guardar imagen para la lámina ----------------
// El lienzo de WebGPU/WebGL solo se puede leer justo después de dibujar: se dibuja y se copia en el mismo tick.
const SITIO = 'https://caamanoluismiguel.github.io/edificio-106/';
const dos = (n) => String(n).padStart(2, '0');
/** Colores de una rampa CSS «linear-gradient(90deg, #a, #b 50%, …)» como [[posición 0–1, color]]. */
function paradasRampa(css) {
  const cs = [...css.matchAll(/(#[0-9a-f]{3,8})(?:\s+([\d.]+)%)?/gi)];
  return cs.map((m, i) => [m[2] != null ? +m[2] / 100 : i / Math.max(1, cs.length - 1), m[1]]);
}
// La escena de la lámina sale a resolución fija, no a la del lienzo (en un teléfono serían ~600 px): 2.400 px en el lado
// largo, con el mismo encuadre. Solo cambia la relación de píxeles del renderizador (el tamaño CSS del lienzo y la cámara
// quedan igual), se dibuja, se copia en el mismo tick y se devuelve todo como estaba. 2.400 px de lado largo son a lo sumo
// ~5,8 MP en pantallas cuadradas (unos 2,7 MP en un teléfono vertical): cabe en el límite de texturas de WebGPU (8.192) y
// de WebGL 2 en teléfonos (4.096). Si esa captura sale vacía (sin memoria, contexto perdido), se prueba a 1.600 px y
// luego a la resolución de pantalla.
const LADO_LAMINA = 2400;
function capturarAlta() {
  const r = escena.renderer, pr0 = r.getPixelRatio(), cw = escena._w, ch = escena._h, largo = Math.max(cw, ch);
  const lim = r.backend?.device?.limits?.maxTextureDimension2D ?? (r.backend?.gl?.getParameter?.(r.backend.gl.MAX_RENDERBUFFER_SIZE)) ?? 4096;
  const intentos = [...new Set([...[LADO_LAMINA, 1600].map((l) => Math.min(l, lim) / largo), pr0])];
  for (const s of [...(escena.diagRotulos ?? []), ...(escena.rutaRotulos ?? [])]) s.userData.tapado = false;
  esquivarHoras.f = '';                                         // el cuadro siguiente vuelve a esquivar los paneles
  try {
    for (const pr of intentos) {
      r.setPixelRatio(pr);
      escena.render();                                          // dibujar y copiar en el mismo tick
      const src = r.domElement, W = src.width, H = src.height;
      const cap = document.createElement('canvas'); cap.width = W; cap.height = H;
      const cx = cap.getContext('2d'); cx.drawImage(src, 0, 0);
      // comprobar que no salió vacía (negra o transparente)
      const muestra = cx.getImageData(0, 0, W, H).data; let suma = 0;
      for (let i = 0; i < muestra.length; i += 4 * 997) suma += muestra[i] + muestra[i + 1] + muestra[i + 2];
      if (suma >= 30) return { cap, W, H };
      anotar('aviso', `guardar imagen: captura vacía a ${W}×${H}`);
    }
    throw new Error('captura vacía');
  } finally {
    r.setPixelRatio(pr0); escena.sucio = true; escena.render();   // la vista del usuario vuelve a su resolución en este mismo tick
  }
}
async function guardarImagen() {
  const b = $('#guardar-img'), est = $('#img-estado');
  if (!escena || b.getAttribute('aria-busy') === 'true') return;
  const texto0 = b.textContent;
  b.setAttribute('aria-busy', 'true'); b.disabled = true; b.textContent = 'Generando imagen…'; est.textContent = '';
  try {
    const f = S.fecha, m0 = ((Math.round(S.min) % 1440) + 1440) % 1440, hh = Math.floor(m0 / 60), mi = m0 % 60;
    const enlace = enlaceMomento();                    // el QR abre este mismo momento, forma de ver y encuadre
    const L = LENTES[S.lente], modo = MODOS[S.lente]?.find(([k]) => k === S[MODO_DE[S.lente]])?.[1];
    const forma = L.t.split(':')[0] + (modo ? ` · ${modo}` : '') + (S.lente === 'partes' ? ` · ${(PARTES[S.parte] ?? PARTES.alero).t}` : '');
    const vistaB = document.querySelector('.vistas [data-vista][aria-pressed="true"]');
    const kf = S.fachada ? S.fachada.slice(8) : null;
    const donde = S.fachada ? FACHADAS[S.fachada].nombre : vistaB ? `Vista ${vistaB.textContent.trim().toLowerCase()}` : 'Vista libre';
    const p = posicionSol({ ...f, h: 0, min: S.min });
    const solTxt = p.alt > 0.5 ? `Sol a ${f1(p.alt)}° de altura, hacia el ${rumboTexto(p.az)}` : 'El sol está bajo el horizonte';
    const anioSol = S.lente === 'sol' && S.solModo === 'anio';
    const rampa = leyendaLente(L);
    const qr = document.createElement('canvas');
    await QRCode.toCanvas(qr, enlace, { margin: 2, width: 360, errorCorrectionLevel: 'M', color: { dark: '#0a1216ff', light: '#ffffffff' } });
    try { await document.fonts.ready; } catch (e) { /* sin fuentes */ }
    const { cap, W, H } = capturarAlta();
    // lienzo final: escena y pie
    const u = Math.min(3, Math.max(0.7, W / 1200)), pad = 26 * u, qrT = 150 * u;
    const out = document.createElement('canvas'), cx = out.getContext('2d');
    const fT = (w, px, fam = 'texto') => `${w} ${Math.round(px * u)}px ${fam === 'datos' ? '"IBM Plex Mono", ui-monospace, monospace' : fam === 'display' ? '"Bricolage Grotesque", system-ui, sans-serif' : '"Atkinson Hyperlegible Next", "Atkinson Hyperlegible", system-ui, sans-serif'}`;
    const anchoTxt = W - 3 * pad - qrT;
    const partir = (txt, font, ancho) => {           // parte un texto en líneas que quepan
      cx.font = font; const pal = txt.split(' '), lin = []; let l = '';
      for (const w of pal) { const t = l ? l + ' ' + w : w; if (cx.measureText(t).width > ancho && l) { lin.push(l); l = w; } else l = t; }
      if (l) lin.push(l); return lin;
    };
    const filas = [
      { font: fT(760, 30, 'display'), color: '#efe9de', lin: partir(`${fechaTexto(f)}, ${hhmm(S.min)} · hora de Panamá`, fT(760, 30, 'display'), anchoTxt), alto: 36 },
      { font: fT(600, 20), color: '#f4b545', lin: partir(`${forma} · ${donde}`, fT(600, 20), anchoTxt), alto: 26 },
      { font: fT(400, 17), color: '#b6bdb9', lin: partir(`${solTxt}. Edificio 106 · Isthmus, Ciudad del Saber, Panamá.`, fT(400, 17), anchoTxt), alto: 23 },
    ];
    let hTxt = filas.reduce((a, r) => a + r.lin.length * r.alto * u, 0) + 8 * u;
    const hRampa = rampa ? 46 * u : 0;
    const linkLin = partir(enlace, fT(500, 15, 'datos'), anchoTxt);
    const hLink = (18 + linkLin.length * 20) * u;
    const altoPie = Math.ceil(Math.max(hTxt + hRampa + hLink, qrT + 24 * u) + 2 * pad);
    out.width = W; out.height = H + altoPie;
    cx.drawImage(cap, 0, 0);
    cx.fillStyle = '#0e171b'; cx.fillRect(0, H, W, altoPie);
    cx.fillStyle = '#f4b545'; cx.fillRect(0, H, W, Math.max(2, 3 * u));
    cx.textBaseline = 'alphabetic';
    let y = H + pad;
    for (const r of filas) { cx.font = r.font; cx.fillStyle = r.color; for (const l of r.lin) { y += r.alto * u; cx.fillText(l, pad, y - 6 * u); } }
    y += 8 * u;
    if (rampa) {
      const w = Math.min(420 * u, anchoTxt), gr = cx.createLinearGradient(pad, 0, pad + w, 0);
      for (const [o, c] of paradasRampa(rampa.c)) gr.addColorStop(Math.min(1, Math.max(0, o)), c);
      cx.fillStyle = gr; cx.fillRect(pad, y, w, 14 * u);
      cx.strokeStyle = 'rgba(239,233,222,0.35)'; cx.lineWidth = Math.max(1, u); cx.strokeRect(pad, y, w, 14 * u);
      cx.font = fT(500, 14, 'datos'); cx.fillStyle = '#b6bdb9';
      rampa.esc.forEach((t, i) => { if (!t) return; cx.textAlign = i === 0 ? 'left' : i === rampa.esc.length - 1 ? 'right' : 'center'; cx.fillText(t, pad + w * i / (rampa.esc.length - 1), y + 34 * u); });
      cx.textAlign = 'left'; y += hRampa;
    }
    cx.font = fT(500, 13, 'datos'); cx.fillStyle = '#7f8a86'; y += 14 * u; cx.fillText('Abre este momento:', pad, y);
    cx.font = fT(500, 15, 'datos'); cx.fillStyle = '#efe9de';
    for (const l of linkLin) { y += 20 * u; cx.fillText(l, pad, y); }
    const qx = W - pad - qrT, qy = H + pad;
    cx.fillStyle = '#ffffff'; cx.fillRect(qx, qy, qrT, qrT);
    cx.imageSmoothingEnabled = false; cx.drawImage(qr, qx, qy, qrT, qrT); cx.imageSmoothingEnabled = true;
    cx.font = fT(500, 12, 'datos'); cx.fillStyle = '#b6bdb9'; cx.textAlign = 'center'; cx.fillText(kf ? `fachada ${kf.toUpperCase()} · QR del momento` : 'QR del momento', qx + qrT / 2, qy + qrT + 17 * u); cx.textAlign = 'left';
    const nombre = `edificio106_${f.y}-${dos(f.m)}-${dos(f.d)}_${dos(hh)}${dos(mi)}_${S.lente}_${kf ? 'fachada-' + kf : 'vista-' + (vistaB?.dataset.vista ?? 'libre')}.png`;
    const blob = await new Promise((res, rej) => out.toBlob((bl) => bl ? res(bl) : rej(new Error('toBlob')), 'image/png'));
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    guardarImagen.ultima = { nombre, W: out.width, H: out.height };
    est.textContent = `Listo: se descargó ${nombre} (${miles(out.width)} × ${miles(out.height)} px).`;
  } catch (e) {
    anotar('aviso', 'guardar imagen: ' + (e?.message ?? e));
    est.textContent = 'No se pudo generar la imagen en este navegador. Prueba de nuevo o usa una captura de pantalla.';
  } finally {
    b.removeAttribute('aria-busy'); b.disabled = false; b.textContent = texto0;
  }
}

// ---------------- Qué significa cada dato (se toca un dato del dock) ----------------
function explicacion(k, p, c) {
  const sp = sombraPoste(p.alt, p.az);
  if (k === 'hora') return ['La hora', `Es la hora de Panamá, que usa UTC−5 todo el año (no tiene horario de verano). El sol se calcula para este minuto exacto: ${fechaTexto(S.fecha)}, ${hhmm(S.min)}. Arrastra la regla de abajo para cambiarla, o usa «Ir a…» para una fecha exacta.`];
  if (k === 'sol') return ['El sol: altura y rumbo', p.alt <= 0.5 ? `Ahora el sol está ${f1(-p.alt)}° bajo el horizonte: es de noche o está por salir. La altura es el ángulo del sol sobre el horizonte (0° al salir o ponerse, 90° justo encima) y el rumbo, hacia dónde está, medido desde el norte.`
    : `La altura es el ángulo del sol sobre el horizonte: 0° al salir o ponerse, 90° justo encima. Ahora está a ${f1(p.alt)}°. El rumbo dice hacia dónde está, medido desde el norte en el sentido del reloj: ${Math.round(p.az)}° es hacia el ${rumboTexto(p.az)}. A 9° al norte del ecuador, el sol del mediodía pasa casi encima todo el año; por eso el techo recibe mucho más sol que las paredes.`];
  if (k === 'sombra') return ['La sombra de 1 m', sp ? `Es lo que mide ahora la sombra de un palo de 1 m: ${f1(sp.largo, 2)} m, hacia el ${rumboTexto(sp.rumbo)}. Sirve de regla para cualquier cosa: una persona de 1,70 m hace una sombra de ${f1(1.7 * sp.largo, 1)} m y un poste de luz de 6 m, una de ${f1(6 * sp.largo, 1)} m. Mientras más corta la sombra, más alto está el sol.`
    : 'Ahora no hay sol, así que no hay sombra solar. Mueve la regla del día a una hora con sol.'];
  if (k === 'clima') {
    if (!c || c.fuente === 'viaje') return ['El tiempo', 'Se está cargando el dato del tiempo.'];
    if (c.fuente === 'tipico') return ['El tiempo: valores típicos', `Para esta fecha no hay dato de esa hora, así que se muestra lo típico: la mediana de 2001–2025 para ${MESES[S.fecha.m - 1]} a esta hora. ${f1(c.temp)} °C y ${Math.round(c.nubes)} % del cielo con nubes; llueve en el ${Math.round(c.probLluvia)} % de estas horas. Entre 2001 y 2025 hay dato de cada hora; desde 1940 se consulta en línea.`];
    if (c.fuente === 'mes') return ['La lluvia del mes', `En la vista de 25 años se muestra la lluvia total del mes: ${Math.round(c.lluviaMes)} mm, es decir, ${Math.round(c.lluviaMes)} litros por metro cuadrado. Un ${MESES[S.fecha.m - 1]} típico tiene ${Math.round(clima.r.climMensual[S.fecha.m - 1])} mm.`];
    const dc = dniDespejado(p.alt);
    const partes = [`${f1(c.temp)} °C de temperatura del aire`, `${Math.round(c.nubes)} % del cielo cubierto de nubes`];
    if (c.dni != null && p.alt > 2) partes.push(`${miles(Math.round(c.dni / 10) * 10)} W/m² de sol directo (con cielo despejado, a esta altura, serían unos ${miles(Math.round(dc / 10) * 10)} W/m², según el modelo sencillo de Meinel y Meinel, 1976)`);
    const ll = c.lluvia ?? 0;
    const txtLl = ll >= 0.1 ? `Llueven ${f1(ll)} mm en la hora: ${f1(ll)} litros por cada metro cuadrado. Desde unos 8 mm en una hora ya se considera lluvia fuerte (más de 7,6 mm/h, según el glosario de la AMS).` : 'No llueve a esa hora.';
    return ['El tiempo de esa hora', `${partes.join(', ')}. ${txtLl} ${c.fuente === 'vivo' ? 'Es el pronóstico de modelo de Open-Meteo para ahora.' : 'Es el dato del reanálisis ERA5: un modelo alimentado con mediciones, para una celda de unos 28 km. Un aguacero muy local puede no aparecer.'}`];
  }
  if (k === 'tab-dia') return ['La regla del día', 'Es un día completo, de 00:00 a 24:00. El color es la luz del cielo; ↑ y ↓ marcan la salida y la puesta del sol, y la marca del centro, el mediodía solar. Las barras azules son la lluvia de cada hora y lo gris, las horas en que las nubes tapan el sol. Arrástrala para recorrer el día.'];
  if (k === 'tab-anio') return ['La regla del año', 'Cada punto es un día del año. La franja azul es la temporada de lluvias (mayo a noviembre), las dos líneas son los solsticios (hacia el 21 de junio y el 21 de diciembre) y los puntos dorados, los dos días sin sombra. Arrástrala para ver cómo cambia el recorrido del sol en el año.'];
  if (k === 'tab-decadas') return ['25 años de lluvia', 'Cada barra es la lluvia de un mes entre 2001 y 2025. Se ven los años secos y los muy lluviosos, y que casi toda la lluvia cae de mayo a noviembre. Arrástrala para recorrer los meses, o ▶ para pasarlos en 25 segundos; abajo están los extremos de la serie.'];
  return null;
}
function explicar(k) {
  anunciar();
  S.explica = S.explica === k ? null : k;
  document.querySelectorAll('[data-explica]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.explica === S.explica)));
  lastLect = '';
}

// ---------------- Recorrido guiado ----------------
function pasosRecorrido() {
  const a = ahoraPanama(), y = a.y, z = diasCeroSombra(y)[0];
  return [
    { t: 'Este es el Edificio 106', txt: 'Un edificio de 3 pisos de Isthmus, en Ciudad del Saber, la antigua base de Clayton. Tiene un alero de 1,65 m en cada piso y techo de teja. Todo lo que verás está calculado para este edificio y con su orientación real.', dis: 'Arrastra la escena para girar el edificio; la rueda del ratón o el pellizco acercan.',
      ir: () => viajarA({ fecha: { y: a.y, m: a.m, d: a.d }, min: a.min, vista: 'esquina', lente: 'foto', aAhora: true }) },
    { t: 'El norte y el recorrido del sol', txt: 'La rosa del suelo marca el norte real. El edificio no mira al norte: su eje largo gira 56°, así que sus cuatro fachadas miran al sureste, noroeste, noreste y suroeste. El arco dorado es el recorrido del sol hoy, con las horas marcadas.', dis: 'A 9° al norte del ecuador el sol pasa muy alto al mediodía durante todo el año. Por eso aquí el techo recibe más sol que cualquier pared.',
      ir: () => { volarA(VISTAS.aerea, 1.8, 'aerea', false); S.ayudas = true; $('#capa-ayudas').checked = true; } },
    { t: 'Un día en un minuto', txt: 'El sol sale por el este y se pone por el oeste. Mira cómo gira la sombra del edificio y cómo se acorta hacia el mediodía. Cuando el sol sube, los aleros dejan las ventanas en sombra; lo que cuenta es su ángulo visto de perfil contra cada fachada.', dis: 'Eso hace un alero de 1,65 m en el trópico: con el sol alto protege el vidrio; con el sol bajo de la tarde, no alcanza.',
      ir: () => { volarA(VISTAS.esquina, 1.6, 'esquina', false); ponerLente('foto', false); ponerPestana('dia'); reproducir(); } },
    { t: '¿Qué fachada recibe más sol?', txt: 'Con la forma de ver «Sol», cada punto del edificio se pinta según la radiación solar que incide sobre él, contando la sombra de los aleros: azul es nada; rojo, naranja y amarillo, cada vez más. A las 3:30 de la tarde, la fachada lateral suroeste lo recibe casi de frente, salvo bajo los aleros.', dis: 'Contando solo el sol directo, la sureste y la suroeste reciben en un año más del doble que la noroeste; sumando la luz difusa del cielo, la noroeste recibe unos siete décimos de lo que recibe la sureste.',
      pre: 'Son las 3:30 de la tarde del 25 de marzo y el sol ya va bajando hacia el oeste. Mira el edificio desde arriba: ¿cuál de las cuatro paredes crees que lo recibe más de frente?',
      antes: () => viajarA({ fecha: { y: 2024, m: 3, d: 25 }, min: 15 * 60 + 30, vista: 'aerea', lente: 'foto' }),
      ir: () => viajarA({ fecha: { y: 2024, m: 3, d: 25 }, min: 15 * 60 + 30, fachada: 'so', lente: 'sol' }) },
    { t: 'El día sin sombra', txt: `Dos veces al año, en abril y en agosto, el sol del mediodía pasa casi justo encima. Este año, el primero es el ${z.d} de ${MESES[z.m - 1]} a las ${hhmm(z.h * 60 + z.min)}: la sombra de un poste casi desaparece y la del edificio queda debajo de sus aleros.`, dis: 'Entre abril y agosto el sol del mediodía viene del norte: las fachadas que miran al norte también necesitan protección.',
      ir: () => viajarA({ fecha: { y, m: z.m, d: z.d }, min: z.h * 60 + z.min, vista: 'aerea', lente: 'foto' }) },
    { t: 'Las sombras de todo un día', txt: 'La forma de ver «Sombras» dibuja la sombra de cada hora sobre el terreno. El 21 de diciembre las sombras son las más largas del año y se proyectan hacia el norte; en la tarde, el jardín noreste queda a la sombra del edificio.', dis: 'Sirve para decidir dónde poner un patio, una terraza o un árbol.',
      pre: 'Está amaneciendo el 21 de diciembre. En esta época el sol del mediodía viene del sur, y la rosa del suelo te dice dónde queda el norte. ¿Hacia dónde crees que se proyectarán las sombras del edificio a lo largo del día?',
      antes: () => { S.ayudas = true; $('#capa-ayudas').checked = true; viajarA({ fecha: { y, m: 12, d: 21 }, min: Math.round(saleYPone(y, 12, 21).sale) + 12, vista: 'planta', lente: 'foto' }); },
      ir: () => viajarA({ fecha: { y, m: 12, d: 21 }, min: 15 * 60, vista: 'planta', lente: 'sombras' }) },
    { t: 'La lluvia', txt: 'Aquí llueven unos 2.000 mm al año, casi todo de mayo a noviembre y sobre todo en la tarde. Esta es la hora más lluviosa de 25 años de datos: 19 mm entre las 14:00 y las 15:00 del 1 de julio de 2023. Mira las cortinas de agua que caen de los tres aleros.', dis: 'Por eso los aleros anchos: alejan el agua de los muros y de las ventanas.',
      ir: () => viajarA({ fecha: { y: 2023, m: 7, d: 1 }, min: 14 * 60 + 30, vista: 'esquina', lente: 'foto' }) },
    { t: 'La lluvia con viento', txt: 'La forma de ver «Lluvia» muestra qué fachada se moja más cuando llueve con viento. En un año típico, la noroeste recibe más de cinco veces lo que la fachada lateral noreste.', dis: 'Dice dónde reforzar aleros, bordes que cortan el goteo, juntas y acabados.',
      pre: 'Cuando llueve con viento, el agua no cae derecha y moja unas paredes más que otras. ¿Cuál de las cuatro crees que se moja más?',
      antes: () => viajarA({ fecha: { y: 2006, m: 11, d: 23 }, min: 10 * 60 + 30, vista: 'aerea', lente: 'foto' }),
      ir: () => { S.aguaModo = 'anio'; viajarA({ fecha: { y: 2006, m: 11, d: 23 }, min: 10 * 60 + 30, fachada: 'no', lente: 'lluvia' }); } },
    { t: 'El viento', txt: 'La forma de ver «Viento» dibuja en el suelo una rosa de vientos: cada pétalo apunta hacia donde viene el viento. Unas dos de cada tres horas del año sopla entre el oeste noroeste y el norte, y la fachada noroeste lo recibe de frente o en diagonal (a menos de 60° de su perpendicular) unas 5.900 horas al año.', dis: 'Para ventilar de forma cruzada, las entradas de aire van en la fachada noroeste y las salidas en la sureste. Es el viento de afuera, a 10 m de altura: no simula el aire dentro del edificio.',
      pre: 'Acabas de ver cuál pared se moja más con la lluvia. Con esa pista, ¿de qué lado crees que llega el viento cuando llueve? ¿Y qué pared lo recibe de frente?',
      antes: () => { S.aguaModo = 'hora'; viajarA({ fecha: { y: 2016, m: 2, d: 18 }, min: 14 * 60, vista: 'aerea', lente: 'foto' }); },
      ir: () => { S.aguaModo = 'hora'; viajarA({ fecha: { y: 2016, m: 2, d: 18 }, min: 14 * 60, vista: 'aerea', lente: 'viento', modo: 'anio' }); } },
    { t: 'Las partes del edificio', txt: 'La forma de ver «Partes» le pone nombre a cada cosa: techo a cuatro aguas, alero, ménsula, base o zócalo, módulo. Toca una etiqueta para saber qué es, cómo es en este edificio y qué hace. La persona de 1,70 m junto a la esquina sirve para comparar tamaños.', dis: 'El alero trabaja como un voladizo: si fuera el doble de largo, el esfuerzo en su raíz sería cuatro veces mayor. Tócalo y prueba otros largos.',
      ir: () => { volarA(VISTAS.esquina, 1.6, 'esquina', false); ponerLente('partes', false); elegirParte('alero'); } },
    { t: 'Ahora te toca', txt: 'Con «Ir a…» puedes ir a cualquier fecha desde 1940, o a los días extremos de la serie. Toca cualquier dato de abajo para saber qué significa, y cambia la forma de ver con Foto, Sol, Lluvia, Viento, Sombras o Partes. En «Confort», abajo a la derecha, ves qué sugiere el clima de afuera a cada hora: por dónde entraría la brisa y en qué vidrios incide el sol.', dis: '«Para qué sirve» reúne los hallazgos principales y lo que esta herramienta no hace, con qué usar después: temperatura interior, ventilación, microclima y drenaje.',
      ir: () => { S.aguaModo = 'hora'; irAAhora(true); ponerLente('foto', false); } },
  ];
}
function recorrido(i) {
  const P = S.pasos ?? (S.pasos = pasosRecorrido());
  if (i == null || i < 0 || i >= P.length) { S.paso = null; S.pasos = null; $('#recorrido').hidden = true; document.documentElement.classList.remove('en-recorrido'); if (S.reproduce) parar(); lastLect = ''; return; }
  S.paso = i; S.explica = null; parar(); plegarRecorrido(false);
  const q = P[i];
  $('#rec-n').textContent = `Paso ${i + 1} de ${P.length}`;
  $('#rec-t').textContent = q.t; $('#rec-txt').textContent = q.txt; $('#rec-dis').textContent = q.dis;
  // con pregunta: primero la predicción y la escena sin la respuesta pintada; «Ver respuesta» muestra el texto y la forma de ver
  const conPregunta = !!q.pre, foco = $('#recorrido').contains(document.activeElement);
  $('#rec-pregunta').hidden = !conPregunta; $('#rec-respuesta').hidden = conPregunta;
  $('#rec-ver').hidden = false;
  if (conPregunta) $('#rec-preg').textContent = q.pre;
  $('#rec-prev').disabled = i === 0; $('#rec-sig').textContent = i === P.length - 1 ? 'Terminar' : 'Siguiente';
  $('#rec-puntos').innerHTML = P.map((_, j) => `<i class="${j === i ? 'hoy' : j < i ? 'ya' : ''}"></i>`).join('');
  $('#recorrido').hidden = false; document.documentElement.classList.add('en-recorrido');
  ['#sirve', '#ir-a', '#capas', '#confort'].forEach((x) => { $(x).hidden = true; }); abrirVoladizo(false);
  (conPregunta ? q.antes : q.ir)(); S.momento = null; S.verLeyenda = S.lente !== 'foto'; lastLect = '';
  if (conPregunta && foco) $('#rec-ver').focus();
}
/** Devuelve el foco a un botón al cerrar su panel; si ese botón no se ve (en el teléfono no hay «Recorrido guiado» arriba), a la zona principal. */
function enfocar(b) {
  if (b && (b.checkVisibility ? b.checkVisibility() : b.offsetParent !== null)) b.focus(); else $('#principal')?.focus();
}
/** En el teléfono la tarjeta del paso se pliega a su título para ver la escena entera. */
function plegarRecorrido(plegar) {
  document.documentElement.classList.toggle('rec-plegado', plegar);
  const b = $('#rec-plegar'); b.textContent = plegar ? 'Leer el paso' : 'Ver el edificio'; b.setAttribute('aria-expanded', String(!plegar));
}
function verRespuesta() {
  const q = S.pasos?.[S.paso]; if (!q || !$('#rec-respuesta').hidden) return;
  const rec = $('#recorrido');
  rec.setAttribute('aria-live', 'off');                 // el foco lee la respuesta; sin esto el lector la diría dos veces
  $('#rec-ver').hidden = true; $('#rec-respuesta').hidden = false;
  $('#rec-txt').focus();
  setTimeout(() => rec.setAttribute('aria-live', 'polite'), 400);
  q.ir(); S.momento = null; S.verLeyenda = S.lente !== 'foto'; lastLect = '';
}

// ---------------- Regla del día: lluvia y sol de cada hora ----------------
function pintarClimaDia() {
  const f = S.fecha, g = $('#dia-clima'); if (!g) return;
  let h = '', fuente = '';
  const reg = (min) => clima.registro(f, min) ?? clima.registroDia(f, min);
  const hay = !!reg(0);
  for (let i = 0; i < 24; i++) {
    const x = i / 24 * 1000 + 2, w = 1000 / 24 - 4;
    if (hay) {
      const r = reg(i * 60), q = reg(i * 60 + 30), alt = posicionSol({ ...f, h: i, min: 30 }).alt;
      if (alt > 2 && q?.dni != null) { const k = clamp01(q.dni / Math.max(40, dniDespejado(alt))); if (k < 0.85) h += `<rect class="nube" x="${x - 2}" y="6" width="${w + 4}" height="16" opacity="${(0.62 * (1 - k)).toFixed(2)}"></rect>`; }
      const mm = r?.lluvia ?? 0;
      if (mm >= 0.1) { const hh = Math.max(2, Math.min(16, 3 + 13 * Math.log1p(mm) / Math.log1p(15))); h += `<rect class="gota" x="${x}" y="${22 - hh}" width="${w}" height="${hh}" rx="1.5"><title>${hhmm(i * 60)}–${hhmm(i * 60 + 60)}: ${f1(mm)} mm</title></rect>`; }
      fuente = 'lluvia y nubes de cada hora (ERA5)';
    } else if (clima.ok) {
      const t = clima.tipico(f.m, i * 60), pr = t?.probLluvia ?? 0;
      if (pr >= 5) { const hh = Math.max(1.5, 16 * pr / 100); h += `<rect class="prob" x="${x}" y="${22 - hh}" width="${w}" height="${hh}" rx="1.5"><title>${hhmm(i * 60)}–${hhmm(i * 60 + 60)}: llueve en ${Math.round(pr)} % de estas horas (típico de ${MESES[f.m - 1]})</title></rect>`; }
      fuente = `probabilidad de lluvia típica de ${MESES[f.m - 1]}`;
    }
  }
  g.innerHTML = h;
  $('#dia-ley').textContent = fuente ? '▮ ' + fuente : '';
}

// ---------------- Consultas: los días que un arquitecto quiere ver ----------------
function listaConsultas() {
  const C = consultas, y = S.fecha.y, z = diasCeroSombra(y), md = (f) => { const m = mediodiaSolar(f.y, f.m, f.d); return m.h * 60 + m.min; };
  const out = [];
  const g = (grupo) => (it) => out.push({ grupo, ...it });
  const sol = g('Sol y sombra');
  z.forEach((q, i) => sol({ t: `Día sin sombra de ${i ? 'agosto' : 'abril'}`, f: { y, m: q.m, d: q.d }, min: q.h * 60 + q.min, vista: 'aerea', lente: 'sombras',
    v: `sol a ${f1(q.alt, 1)}°`, txt: `El sol pasa a ${f1(90 - q.alt, 1)}° del cenit: a mediodía la sombra queda casi toda bajo los aleros. Geometría solar exacta (NOAA).` }));
  sol({ t: 'Solsticio de junio', f: { y, m: 6, d: 21 }, min: 9 * 60, vista: 'planta', lente: 'sombras', v: `mediodía ${f1(mediodiaSolar(y, 6, 21).alt, 1)}° al N`, txt: 'El sol del mediodía pasa al norte del cenit: a mediodía las sombras apuntan al sur, y en la tarde hacia el sureste y el este sureste. Diagrama con el volumen del edificio, sin árboles ni vecinos.' });
  sol({ t: 'Solsticio de diciembre', f: { y, m: 12, d: 21 }, min: 9 * 60, vista: 'planta', lente: 'sombras', v: `mediodía ${f1(mediodiaSolar(y, 12, 21).alt, 1)}° al S`, txt: 'Las sombras más largas del año, hacia el norte: el jardín noreste recibe la sombra del edificio en la tarde.' });
  sol({ t: 'Equinoccio de marzo', f: { y, m: 3, d: 20 }, min: md({ y, m: 3, d: 20 }), vista: 'planta', lente: 'sombras', v: `mediodía ${f1(mediodiaSolar(y, 3, 20).alt, 1)}°`, txt: 'El sol sale por el este y se pone por el oeste: la punta de las sombras recorre una línea recta.' });
  const fa = g('Sol en fachadas');
  if (C) {
    const ds = C.diasSol[1] ?? C.diasSol[0], tE = C.tipicos[0], tJ = C.tipicos[5];
    fa({ t: 'Sol de la tarde en la fachada lateral SO', f: deISO(ds.fecha), min: 15 * 60 + 30, fachada: 'so', lente: 'sol', v: `${f1(ds.kwh, 2)} kWh/m²·día`, txt: `Uno de los días con más sol de la serie (${f1(ds.kwh, 2)} kWh/m²): a las 15:30 el sol incide casi de frente sobre la fachada lateral SO; el alero deja las ventanas a la sombra y el sol solo incide en la franja de muro que queda debajo de ellas.` });
    fa({ t: 'Sol de la mañana en la entrada SE', f: deISO(tE.fecha), min: 7 * 60 + 45, fachada: 'se', lente: 'sol', v: 'día típico', txt: 'Un día típico de enero: el sol bajo de la mañana entra bajo el alero de la fachada principal. Pasa la regla a las 10:00 para ver el ángulo de corte.' });
    fa({ t: 'Sol del poniente en la NO (junio)', f: deISO(tJ.fecha), min: 17 * 60, fachada: 'no', lente: 'sol', v: 'día típico', txt: 'En junio el sol se pone por el oeste-noroeste y alcanza la fachada NO, que casi todo el año queda a la sombra. Suele estar nublado: mira el valor en W/m².' });
    const lv = g('Lluvia');
    const H = C.horasLluvia.map((q) => ({ f: deISO(q.fecha), min: q.hora * 60 - 30, v: `${f1(q.mm)} mm`, txt: `${fechaTexto(deISO(q.fecha))}, de ${hhmm(q.hora * 60 - 60)} a ${hhmm(q.hora * 60)}: ${f1(q.mm)} mm. Es el promedio de una celda de ~28 km: en el sitio pudo llover más.` }));
    lv({ t: 'La hora más lluviosa', ...H[0], vista: 'esquina', lente: 'foto', rank: H });
    const D = C.diasLluvia.map((q) => ({ f: deISO(q.fecha), min: q.hora * 60 - 30, v: `${miles(q.mm)} mm`, txt: `${fechaTexto(deISO(q.fecha))}: ${miles(q.mm)} mm en el día; la hora más fuerte, de ${hhmm(q.hora * 60 - 60)} a ${hhmm(q.hora * 60)} (${f1(q.pico)} mm).` }));
    lv({ t: 'El día más lluvioso', ...D[0], vista: 'esquina', lente: 'foto', rank: D });
    const W = C.lluviaViento.no.max, orden = Object.entries(C.lluviaViento).sort((a, b) => b[1].anual - a[1].anual).map(([k, v]) => `${k.toUpperCase()} ${miles(v.anual)}`).join(' · ');
    lv({ t: 'La fachada que más se moja', f: deISO(W.fecha), min: W.hora * 60 - 30, fachada: 'no', lente: 'lluvia', v: `NO · ${miles(C.lluviaViento.no.anual)} L/m²·año`,
      txt: `Índice anual de lluvia con viento (L/m²): ${orden}. Aquí, su hora más fuerte: ${f1(W.mm)} mm con viento de ${W.viento} km/h que llega casi de frente. Ordena fachadas; no mide el agua sobre el muro.` });
    const R = C.rachaSeca;
    lv({ t: 'La sequía más larga', f: deISO(R.hasta), min: 15 * 60, vista: 'aerea', lente: 'foto', v: `${R.dias} días`, txt: `${R.dias} días seguidos con menos de 1 mm, del ${fechaTexto(deISO(R.desde))} al ${fechaTexto(deISO(R.hasta))}. Referencia para el riego del jardín o una cisterna de agua lluvia.` });
    const vi = g('Viento');
    if (C.viento) {
      const tS = C.tipicos[1], tL = C.tipicos[8];
      vi({ t: 'El viento de la temporada seca', f: deISO(tS.fecha), min: 14 * 60, vista: 'aerea', lente: 'viento', modo: 'seca', v: `${f1(C.viento.seca.media)} km/h de media`,
        txt: `De diciembre a abril el viento llega casi siempre del norte y el noroeste (${Math.round(C.viento.seca.frec[0] + C.viento.seca.frec[15] + C.viento.seca.frec[14])} % de las horas), a unos ${Math.round(C.viento.seca.media)} km/h de media: la fachada noroeste lo recibe de frente la mayor parte del tiempo.` });
      vi({ t: 'El viento de la temporada de lluvias', f: deISO(tL.fecha), min: 14 * 60, vista: 'aerea', lente: 'viento', modo: 'lluvias', v: `${f1(C.viento.lluvias.media)} km/h de media`,
        txt: `De mayo a noviembre el viento es más flojo (unos ${Math.round(C.viento.lluvias.media)} km/h de media) y más variable: sigue mandando el noroeste, pero también llega del sur y del oeste; en calma el ${Math.round(C.viento.lluvias.calma)} % del tiempo.` });
      vi({ t: 'Qué fachada recibe el viento de frente', f: deISO(tS.fecha), min: 14 * 60, fachada: 'no', lente: 'viento', modo: 'anio', v: `NO · ${miles(C.viento.anio.frente.no)} h al año`,
        txt: `Horas al año con viento de frente (±60°, 5 km/h o más): NO ${miles(C.viento.anio.frente.no)}, NE ${miles(C.viento.anio.frente.ne)}, SO ${miles(C.viento.anio.frente.so)}, SE ${miles(C.viento.anio.frente.se)}. Para ventilar de forma cruzada: entrada por la NO, salida por la SE.` });
    }
    const lz = g('Luz y cielo');
    const S5 = C.diasSol.map((q) => ({ f: deISO(q.fecha), min: md(deISO(q.fecha)), v: `${f1(q.kwh, 2)} kWh/m²`, txt: `${fechaTexto(deISO(q.fecha))}: ${f1(q.kwh, 2)} kWh/m² de radiación global sobre el plano horizontal; un día medio recibe ${f1(C.solMedio, 2)}.` }));
    lz({ t: 'El día con más sol', ...S5[0], vista: 'aerea', lente: 'sol', rank: S5 });
    const O5 = C.diasOscuros.map((q) => ({ f: deISO(q.fecha), min: 12 * 60 + 30, v: `${f1(q.kwh, 2)} kWh/m²`, txt: `${fechaTexto(deISO(q.fecha))}: ${f1(q.kwh, 2)} kWh/m² y ${q.mm} mm de lluvia. Casi toda la luz es difusa: un cielo gris parejo.` }));
    lz({ t: 'El día más oscuro', ...O5[0], vista: 'esquina', lente: 'foto', rank: O5 });
    const tm = C.tipicos[S.fecha.m - 1];
    lz({ t: `Un día típico de ${MESES[tm.m - 1]}`, f: deISO(tm.fecha), min: 14 * 60 + 30, vista: 'esquina', lente: 'foto', v: `${f1(tm.mm)} mm · ${f1(tm.kwh, 2)} kWh/m²`,
      txt: `El día real más parecido a la mediana de ${MESES[tm.m - 1]} en 2001–2025: ${f1(tm.kwh, 2)} kWh/m² de sol y ${f1(tm.mm)} mm de lluvia. Llueve (1 mm o más) en el ${tm.probLluvia} % de los días de ${MESES[tm.m - 1]}.` });
  }
  return out;
}
// ---------------- Confort térmico: carta psicrométrica y sensación térmica (UTCI) ----------------
// Lo de 25 años viene precalculado en datos/confort.json (fuente/confort.mjs); aquí solo se dibuja y se calcula la hora elegida.
let confortJ = null;
// categorías de UTCI en calor, de «sin estrés» a «extremo»: pasos planos de color, sin degradado (índices de CATEGORIAS_UTCI)
const UTCI_COL = { 4: '#8fa39b', 5: '#f2c46b', 6: '#e8913a', 7: '#cf5a2c', 8: '#9e2f1c', 9: '#5e1a12' };
async function abrirConfort(abrir) {
  $('#confort').hidden = !abrir; $('#abrir-confort').setAttribute('aria-expanded', String(abrir));
  if (!abrir) return;
  cerrarOferta(); abrirVoladizo(false); soloUnPanel('confort');
  if (!confortJ) {
    try { confortJ = await (await fetch(conVersion(BASE + 'datos/confort.json'))).json(); }
    catch (e) { anotar('aviso', 'confort: ' + e); $('#carta-cifras').textContent = 'No se pudieron cargar los datos de confort.'; return; }
    pintarCarta(); pintarUTCI();
  }
  confortClave = ''; confortHora(posicionSol({ ...S.fecha, h: 0, min: S.min }), climaEn(S.fecha, S.min));
}

// carta: x = temperatura del aire (°C), y = humedad absoluta (g/kg); área útil dentro de márgenes para ejes y rótulos
const CARTA = { x0: 34, x1: 366, y0: 12, y1: 226 };
const cx = (t) => CARTA.x0 + (t - confortJ.carta.t0) / (confortJ.carta.t1 - confortJ.carta.t0) * (CARTA.x1 - CARTA.x0);
const cy = (w) => CARTA.y1 - (w - confortJ.carta.w0) / (confortJ.carta.w1 - confortJ.carta.w0) * (CARTA.y1 - CARTA.y0);
function pintarCarta() {
  const J = confortJ, C = J.carta, s = [];
  // densidad de horas: cinco clases planas (cuantiles de las celdas con horas), una sola tinta
  const vals = C.celdas.flat().filter((v) => v > 0).sort((a, b) => a - b), q = [0.2, 0.4, 0.6, 0.8].map((p) => vals[Math.floor(p * vals.length)]);
  const clase = (v) => (v <= q[0] ? 0 : v <= q[1] ? 1 : v <= q[2] ? 2 : v <= q[3] ? 3 : 4), OP = [0.14, 0.26, 0.4, 0.58, 0.8];
  C.celdas.forEach((fila, j) => fila.forEach((v, i) => { if (!v) return;
    s.push(`<rect x="${cx(C.t0 + i).toFixed(1)}" y="${cy(C.w0 + j + 1).toFixed(1)}" width="${(cx(1) - cx(0)).toFixed(1)}" height="${(cy(0) - cy(1)).toFixed(1)}" fill="#4aa8dc" fill-opacity="${OP[clase(v)]}"><title>${C.t0 + i}–${C.t0 + i + 1} °C · ${C.w0 + j}–${C.w0 + j + 1} g/kg: ${miles(v)} h</title></rect>`); }));
  // curvas de humedad relativa (50 % y 100 %, rotuladas) y 70 / 90 % finas
  for (const rh of [50, 70, 90, 100]) {
    const pts = []; for (let t = C.t0; t <= C.t1; t += 0.5) { const w = humedadAbs(t, rh); if (w <= C.w1 + 0.01) pts.push(`${cx(t).toFixed(1)},${cy(Math.max(C.w0, w)).toFixed(1)}`); }
    s.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="rgba(239,233,222,${rh === 100 ? 0.6 : 0.25})" stroke-width="${rh === 100 ? 1.4 : 1}"/>`);
    if (rh === 50 || rh === 100) { const t = rh === 100 ? 18.2 : 34; s.push(`<text x="${cx(t) + 3}" y="${cy(Math.min(C.w1, humedadAbs(t, rh))) + (rh === 100 ? -6 : 12)}" fill="#b6bdb9" font-size="10">${rh === 100 ? 'HR 100 %' : rh + ' %'}</text>`); }
  }
  // banda adaptativa de ASHRAE 55 (80 %) para el rango de t_pma de la serie; con aire a 1,2 m/s llega 2,2 °C más arriba
  const lo = 0.31 * J.tpma.min + 17.8 - 3.5, hi = 0.31 * J.tpma.max + 17.8 + 3.5;
  s.push(`<rect x="${cx(lo).toFixed(1)}" y="${CARTA.y0}" width="${(cx(hi) - cx(lo)).toFixed(1)}" height="${CARTA.y1 - CARTA.y0}" fill="none" stroke="#b6bdb9" stroke-width="1" stroke-dasharray="2 3"/>`);
  s.push(`<rect x="${cx(hi).toFixed(1)}" y="${CARTA.y0}" width="${(cx(hi + 2.2) - cx(hi)).toFixed(1)}" height="${CARTA.y1 - CARTA.y0}" fill="none" stroke="#b6bdb9" stroke-width="1" stroke-dasharray="1 4"/>`);
  s.push(`<text x="${cx(lo) + 3}" y="${CARTA.y0 + 10}" fill="#b6bdb9" font-size="9.5">ASHRAE 55</text>`);
  // zonas de Givoni: aire quieto (línea llena) y con ventilación (a trazos), recortadas a la carta
  const poli = (P) => P.map(([t, w]) => `${cx(t).toFixed(1)},${cy(Math.max(C.w0, w)).toFixed(1)}`).join(' ');
  s.push(`<polygon points="${poli(GIVONI.ventilacion)}" fill="none" stroke="#f4b545" stroke-width="1.6" stroke-dasharray="6 4"/>`);
  s.push(`<polygon points="${poli(GIVONI.quieto)}" fill="none" stroke="#f4b545" stroke-width="2"/>`);
  // ejes
  for (let t = C.t0; t <= C.t1; t += 2) s.push(`<line x1="${cx(t)}" x2="${cx(t)}" y1="${CARTA.y1}" y2="${CARTA.y1 + 4}" stroke="#7f8a86"/><text x="${cx(t)}" y="${CARTA.y1 + 15}" fill="#b6bdb9" font-size="10" text-anchor="middle">${t}</text>`);
  for (let w = C.w0; w <= C.w1; w += 4) s.push(`<line x1="${CARTA.x0 - 4}" x2="${CARTA.x0}" y1="${cy(w)}" y2="${cy(w)}" stroke="#7f8a86"/><text x="${CARTA.x0 - 7}" y="${cy(w) + 3.5}" fill="#b6bdb9" font-size="10" text-anchor="end">${w}</text>`);
  s.push(`<text x="${(CARTA.x0 + CARTA.x1) / 2}" y="${CARTA.y1 + 31}" fill="#b6bdb9" font-size="10" text-anchor="middle">temperatura del aire (°C)</text>`);
  s.push(`<text x="10" y="${(CARTA.y0 + CARTA.y1) / 2}" fill="#b6bdb9" font-size="10" text-anchor="middle" transform="rotate(-90 10 ${(CARTA.y0 + CARTA.y1) / 2})">humedad (g/kg)</text>`);
  s.push('<g id="carta-punto"></g>');
  $('#carta').innerHTML = `<desc id="carta-desc">Densidad de ${miles(J.horas)} horas de clase en temperatura y humedad; la mayoría cae arriba de 17 g/kg con la humedad de ERA5, que es algo más alta que la medida en Tocumen.</desc>` + s.join('');
  const P = J.pct, li = (col, dash, txt) => `<li><i style="border:2px ${dash} ${col};background:none"></i>${txt}</li>`;
  $('#carta-cifras').innerHTML = [
    // en enteros: ERA5 no sostiene décimas en la humedad de una celda de ~28 km
    li('#f4b545', 'solid', `Givoni, aire quieto: <b>${Math.round(P.quieto)} %</b> de las horas de clase`),
    li('#f4b545', 'dashed', `Givoni, con ventilación de ~2 m/s: <b>${Math.round(P.ventilacion)} %</b>`),
    li('#b6bdb9', 'dotted', `ASHRAE 55 adaptativo, aire quieto: <b>hasta ${Math.round(P.adaptativo80)} %</b> · con aire a 0,6 m/s: <b>hasta ${Math.round(P.adaptativo80_06)} %</b> (cota superior: usa el aire de afuera a la sombra)`),
    J.tocumen ? `<li><i style="background:none"></i>Con la humedad de Tocumen (ETESA) en lugar de la de ERA5, Givoni da <b>${Math.round(J.tocumen.quieto)} %</b> con aire quieto y <b>${Math.round(J.tocumen.ventilacion)} %</b> con brisa.</li>` : '',
  ].join('');
}
let confortClave = '';
function confortHora(p, c) {
  if (!confortJ || $('#confort').hidden) return;
  const ok = c && c.temp != null && c.humedad != null, k = ok ? [Math.round(c.temp * 10), Math.round(c.humedad), Math.round((c.dni ?? 0) / 10), Math.round((c.difusa ?? 0) / 10), Math.round(c.viento ?? 0), Math.round(c.dir ?? -1), Math.round((c.lluvia ?? 0) * 10), Math.round(p.alt), Math.round(p.az)].join('|') : 'no';
  if (k === confortClave) return; confortClave = k;
  const g = $('#carta-punto');
  if (!ok) { if (g) g.innerHTML = ''; $('#conviene').innerHTML = '<li class="accion">Esta hora no tiene temperatura ni humedad: elige una hora de la serie (2001–2025) o «Ahora».</li>'; $('#conviene-porque').innerHTML = ''; $('#conviene-resumen').textContent = 'Por qué'; $('#utci-hora').textContent = 'Esta hora no tiene temperatura ni humedad (elige una hora de la serie o «Ahora»).'; return; }
  const R = conviene(p, c), sr = (gl) => `<span class="sr">${gl === '●' ? 'Sí: ' : gl === '◐' ? 'Con condición: ' : 'No alcanza: '}</span>`;
  $('#conviene').innerHTML = R.hacer.map((t) => `<li class="accion">${t}</li>`).join('');
  $('#conviene-porque').innerHTML = R.porque.map(([cl, gl, t]) => `<li${cl ? ` class="${cl}"` : ''}>${gl ? `<i aria-hidden="true">${gl}</i>` : ''}<span>${gl ? sr(gl) : ''}${t}</span></li>`).join('') + R.datos.map((t) => `<li class="cierre">${t}</li>`).join('');
  $('#conviene-resumen').textContent = `Por qué · Givoni ${R.porque[0][1]} · Guía de Panamá ${R.porque[1][1]}`;
  $('#conviene-sello').textContent = `Clima de afuera, no del aula · ${c.fuente === 'vivo' ? `pronóstico ${c.hora ?? ''}`.trim() : c.fuente === 'serie' || (c.fuente === 'dia' && c.modelo === 'era5') ? 'ERA5' : c.fuente === 'dia' ? 'modelo' : 'típico'} · viento a 10 m`;
  const w = humedadAbs(c.temp, c.humedad), C = confortJ.carta, dentro = c.temp >= C.t0 && c.temp <= C.t1 && w >= C.w0 && w <= C.w1;
  if (g) g.innerHTML = dentro ? `<circle cx="${cx(c.temp).toFixed(1)}" cy="${cy(w).toFixed(1)}" r="5.5" fill="#c9653f" stroke="#efe9de" stroke-width="2"><title>Esta hora: ${f1(c.temp)} °C, ${f1(w)} g/kg</title></circle>` : '';
  const va = (c.viento ?? 0) / 3.6, hora = `${hhmm(S.min)}`;
  if (p.alt <= 0 || c.dni == null) {
    const u = utci(c.temp, c.temp, va, c.humedad, { recortarViento: true }), k2 = categoriaUTCI(u);
    $('#utci-hora').innerHTML = `A las ${hora} (de noche o sin radiación): UTCI <b>${Math.round(u)} °C</b>, ${CATEGORIAS_UTCI[k2]?.nombre.toLowerCase() ?? '—'}. Aire ${f1(c.temp)} °C · ${f1(w)} g/kg.`;
    return;
  }
  const uS = utci(c.temp, tmrtSol({ ta: c.temp, altSol: p.alt, dni: c.dni, difusa: c.difusa ?? 0 }), va, c.humedad, { recortarViento: true });
  const uA = utci(c.temp, tmrtSombra({ ta: c.temp, difusa: c.difusa ?? 0, altSol: p.alt, dni: c.dni }), va, c.humedad, { recortarViento: true });
  const nom = (u) => CATEGORIAS_UTCI[categoriaUTCI(u)]?.nombre.toLowerCase() ?? '—';
  $('#utci-hora').innerHTML = `A las ${hora}: al sol se siente <b>${Math.round(uS)} °C</b> (${nom(uS)}); bajo el alero <b>${Math.round(uA)} °C</b> (${nom(uA)}). Aire ${f1(c.temp)} °C · ${f1(w)} g/kg.`;
}
/** Qué conviene a esta hora, a partir del clima de afuera (especificación revisada por el panel de expertos, 30/09/2026).
 *  Dos marcos de confort (Givoni 1992; Guía de Construcción Sostenible de Panamá 2016, p. 8, con la extensión de ASHRAE 55
 *  por aire en movimiento) y hasta dos acciones (sol, aire) más la lluvia si llueve. Fuentes y límites en «¿De dónde sale?». */
const CORTO = { 'fachada-se': 'SE', 'fachada-no': 'NO', 'fachada-ne': 'NE', 'fachada-so': 'SO' };
const LARGAS = ['fachada-no', 'fachada-se'];
const OPUESTA = { 'fachada-se': 'fachada-no', 'fachada-no': 'fachada-se', 'fachada-ne': 'fachada-so', 'fachada-so': 'fachada-ne' };
function conviene(p, c) {
  const out = [], w = humedadAbs(c.temp, c.humedad), dia = p.alt > 0, mes = S.fecha.m, seca = mes === 12 || mes <= 4, h = S.min / 60;
  const T = f1(c.temp), W = f1(w), banda = seca ? 1 : 0.5;
  // 1. Givoni (con la banda «en el borde»: ERA5 marca algo más de humedad que Tocumen)
  const enQ = dentroPoligono(c.temp, w, GIVONI.quieto), enV = dentroPoligono(c.temp, w, GIVONI.ventilacion);
  // «en el borde»: el veredicto cambiaría con ±1 °C o con ±banda g/kg (la diferencia entre ERA5 y Tocumen)
  const borde = [[1, 0], [-1, 0], [0, banda], [0, -banda]].some(([dt, dw]) => dentroPoligono(c.temp + dt, w + dw, GIVONI.ventilacion) !== enV);
  let g;
  if (c.temp < 20) g = ['●', '<b>Givoni: fresco.</b> Ventilar poco.'];
  else if (enQ) g = ['●', '<b>Givoni: confort con el aire quieto.</b> Basta la sombra.'];
  else if (borde) g = ['◐', `<b>Givoni: en el borde.</b> Con ${T} °C y ${W} g/kg, y la humedad de ERA5 algo alta, puede quedar dentro o fuera de la zona con brisa.`];
  else if (enV) g = ['◐', `<b>Givoni: confort si se mueve el aire</b> (${T} °C, ${W} g/kg).`];
  else if (w > 19) g = seca ? ['◐', `<b>Givoni: fuera por poco</b> (${W} g/kg). En esta época la humedad real suele ser algo menor que la de ERA5.`] : ['○', `<b>Givoni: demasiado húmedo para el confort pasivo</b> (${W} g/kg). Mover el aire igual ayuda.`];
  else g = ['○', `<b>Givoni: demasiado caluroso</b> (${T} °C).`];
  out.push(['', ...g]);
  // 2. Guía de Panamá: 23,5 a 28,5 °C; con aire a ~0,6 m/s, ASHRAE 55 acepta 1,2 °C más (solo sobre 25 °C)
  let pa;
  if (c.temp < 23.5) pa = ['●', '<b>Guía de Panamá: fresco para su rango</b> (23,5 a 28,5 °C).'];
  else if (c.temp <= 28.5) pa = ['●', '<b>Guía de Panamá: dentro del rango</b> (23,5 a 28,5 °C).'];
  else if (c.temp <= 29.7) pa = ['◐', `<b>Guía de Panamá: aceptable con ventilador o brisa suave</b> (${T} °C, el rango llega a 28,5).`];
  else pa = ['○', `<b>Guía de Panamá: caluroso</b> (${T} °C, aun con el aire en movimiento).`];
  out.push(['', ...pa]);
  out.push(['cierre', '', g[0] === pa[0] ? 'Coinciden.' : 'No coinciden porque Givoni mira la humedad y la Guía solo la temperatura.']);
  // 3. Sol en el vidrio (de día, con sol directo, perfil bajo el corte del alero)
  const acciones = [], datos = [];
  if (dia && (c.dni ?? 0) >= UMBRAL_SOL) {
    const al = [];
    for (const k of Object.keys(FACHADAS)) {
      const ca = Math.cos((p.az - FACHADAS[k].rumbo) * Math.PI / 180); if (ca <= 0.05) continue;
      const perfil = Math.atan(Math.tan(p.alt * Math.PI / 180) / ca) * 180 / Math.PI;
      if (perfil < 45) al.push(`${CORTO[k]} (perfil ${Math.round(perfil)}°)`);
    }
    if (al.length) { acciones.push(`<b>Baja las persianas o cortinas de la ${al.map((x) => x.split(' ')[0]).join(' y la ')}.</b> El sol entra por debajo del alero; las ventanas pueden seguir abiertas.${h >= 13 && h < 16 ? ' A esta hora es lo que más importa.' : ''}`);
      datos.push(`Sol en el vidrio con ángulo de perfil ${al.map((x) => x.replace(' (perfil ', ' ').replace('°)', '°')).join(' y ')}; el alero tapa el vidrio desde unos 45°.`); }
  }
  // 4. Aire: con las fachadas largas como eje
  const v = c.viento ?? 0, variable = mes >= 5 && mes <= 11 ? ' (en esta época la dirección cambia de hora en hora)' : '';
  if (c.dir == null || v < 6) { acciones.push('<b>Si hay ventiladores, préndelos.</b> Casi no hay viento; si hay ventanas altas, ábrelas para que salga el aire caliente.'); datos.push(`Viento de ${Math.round(v)} km/h a 10 m de altura: la ventilación cruzada rinde poco.`); }
  else {
    let k = LARGAS[0], ang = 180;
    for (const f of LARGAS) { const a = Math.abs(((c.dir - FACHADAS[f].rumbo + 540) % 360) - 180); if (a < ang) { ang = a; k = f; } }
    if (ang <= 30) acciones.push(`<b>Abre las ventanas de la ${CORTO[k]} y de la ${CORTO[OPUESTA[k]]}.</b> La brisa entra de frente por la ${CORTO[k]} y sale por la otra.`);
    else if (ang <= 60) acciones.push(`<b>Abre las ventanas de las dos fachadas largas, NO y SE.</b> La brisa llega de lado y entra más o menos la mitad del aire.`);
    else acciones.push('<b>Si hay ventiladores, préndelos.</b> La brisa corre paralela a las fachadas largas y casi no entra.');
    if (seca && h >= 5 && h < 9) acciones[acciones.length - 1] += ' Aprovecha: es la hora más fresca del día.';
    datos.push(`Viento del ${rumboTexto(c.dir)} a ${Math.round(v)} km/h a 10 m de altura, a ${Math.round(ang)}° de la perpendicular de la ${CORTO[k]}${variable}. Conviene que la salida sea igual o mayor que la entrada.`);
  }
  const hacer = acciones.slice(0, 2);
  // 5. Lluvia, solo si llueve
  if ((c.lluvia ?? 0) >= 1) hacer.push('<b>Cierra lo que el alero no protege.</b> Llueve y el agua puede entrar por cualquier lado; las persianas de vidrio pueden quedar abiertas.');
  // de noche: en clima cálido húmedo conviene ventilar todo el día (UN-Habitat 2014, p. 68); enfriar la masa de noche es una
  // estrategia de regiones áridas (Givoni 1992, §4.6.1, p. 17): baja la máxima de adentro un 45 a 55 % de la oscilación de afuera,
  // con el aula cerrada y en sombra de día. Oscilación media: Tocumen 11 a 15 °C (ETESA 1977–2010, p. 3); ERA5 de 4 a 6 °C.
  if (!dia) { hacer.push('<b>Si el aula puede quedar abierta de noche sin riesgo, déjala ventilada.</b> En clima cálido húmedo conviene ventilar a toda hora. Cuánto se enfrían los muros depende de cuánto refresque la noche: mira «Por qué».');
    datos.push('Givoni (1992, p. 17) considera el enfriamiento nocturno de los muros aplicable sobre todo en regiones áridas: en un edificio pesado, aislado y en sombra, cerrado de día y ventilado solo de noche, la máxima de adentro puede bajar un 45 a 55 % de la diferencia entre la máxima y la mínima de afuera. En Tocumen esa diferencia es de 11 a 15 °C en promedio (ETESA, 1977–2010); ERA5 la aplana a unos 4 a 6 °C. Clayton no es Tocumen: sin una medición en el sitio no se sabe cuánto rendiría aquí.'); }
  return { hacer, porque: out, datos };
}
function pintarUTCI() {
  const J = confortJ.utci, s = [], L = 38, R = 372, T = 8, B = 118, gw = (R - L) / 12, bw = gw * 0.36;
  const usadas = [4, 5, 6, 7, 8, 9].filter((k) => J.anual.sol[k] + J.anual.sombra[k] > 0);
  J.meses.forEach((M, m) => ['sol', 'sombra'].forEach((lado, j) => {
    let y = B; const x = L + m * gw + gw * 0.12 + j * (bw + gw * 0.04);
    for (const k of usadas) { const h = M.horas ? (M[lado][k] / M.horas) * (B - T) : 0; if (h <= 0) continue; y -= h;
      s.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${UTCI_COL[k]}"><title>${MESES[m]}, ${lado === 'sol' ? 'al sol' : 'bajo el alero'}: ${CATEGORIAS_UTCI[k].nombre.toLowerCase()}, ${Math.round(100 * M[lado][k] / M.horas)} % de las horas de día</title></rect>`); }
  }));
  MES3.forEach((t, m) => s.push(`<text x="${(L + m * gw + gw / 2).toFixed(1)}" y="${B + 12}" fill="#b6bdb9" font-size="10" text-anchor="middle">${t}</text>`));
  for (const p of [0, 50, 100]) s.push(`<text x="${L - 5}" y="${(B - p / 100 * (B - T) + 3.5).toFixed(1)}" fill="#7f8a86" font-size="9.5" text-anchor="end">${p} %</text>`);
  $('#utci').innerHTML = `<desc id="utci-desc">Por mes, la parte de las horas de día en cada categoría de estrés térmico, al sol y bajo el alero.</desc>` + s.join('');
  const pc = (lado, k) => Math.round(100 * J.anual[lado][k] / J.anual.horas);
  $('#utci-ley').innerHTML = '<li style="grid-column:1/-1">En cada mes, la barra de la izquierda es al sol y la de la derecha, bajo el alero.</li>' + usadas.map((k) => `<li><i style="background:${UTCI_COL[k]}"></i>${CATEGORIAS_UTCI[k].nombre} · sol ${pc('sol', k)} % · alero ${pc('sombra', k)} %</li>`).join('')
    + `<li style="grid-column:1/-1">El alero baja la sensación térmica unos <b>${Math.round(J.alivioMedioAlero)} °C</b> en promedio.</li>`;
}

function pintarConsultas() {
  const ul = $('#consultas'); if (!ul) return;
  const L = listaConsultas(); S.listaConsultas = L;
  let html = '', grupo = '';
  L.forEach((it, i) => {
    if (it.grupo !== grupo) { if (grupo) html += '</ul></section>'; grupo = it.grupo; html += `<section class="c-grupo" data-g="${grupo === 'Lluvia' ? 'lluvia' : grupo === 'Viento' ? 'viento' : 'sol'}"><h3>${grupo}</h3><ul>`; }
    const rank = it.rank ? `<span class="rank" aria-label="Otros del ranking">${it.rank.slice(1).map((r, j) => `<button type="button" data-i="${i}" data-r="${j + 1}" title="${fechaCorta(r.f)} · ${r.v}">${j + 2}</button>`).join('')}</span>` : '';
    html += `<li><button type="button" class="c-item" data-i="${i}"><span class="c-t">${it.t}</span><span class="c-d num">${fechaCorta(it.f)} · ${hhmm(it.min)} · ${it.fachada ? 'fachada ' + it.fachada.toUpperCase() : it.vista === 'aerea' ? 'aérea' : it.vista}</span><span class="c-v num">${it.v ?? ''}</span><span class="c-txt">${it.txt ?? ''}</span></button>${rank}</li>`;
  });
  if (grupo) html += '</ul></section>';
  if (!consultas) html += '<p class="nota">Cargando los extremos de la serie…</p>';
  ul.innerHTML = html;
  $('#consultas-anio').textContent = S.fecha.y;
}

// ---------------- Medición de rendimiento (#medir): cuadros continuos girando alrededor del edificio ----------------
async function medir() {
  const caja = document.createElement('pre');
  caja.style.cssText = 'position:fixed;left:12px;top:70px;z-index:99;background:#000e;color:#cfe;font:13px/1.45 ui-monospace,monospace;padding:12px 14px;margin:0;border-radius:10px;max-width:92vw;white-space:pre-wrap';
  document.body.appendChild(caja);
  const r = escena.renderer, d0 = r.getPixelRatio(), filas = [];
  const px = () => Math.round(innerWidth * innerHeight * r.getPixelRatio() ** 2 / 1e4) / 100;
  const q0 = (a, p) => { const b = [...(a || [])].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))] || 0; };
  const it = (S.dtIntro || []).slice(2);
  const introTxt = `intro: ${it.length} cuadros · mediana ${q0(it, 0.5).toFixed(1)} ms · p90 ${q0(it, 0.9).toFixed(1)} ms · máx ${Math.max(0, ...it).toFixed(0)} ms · listo a los ${(performance.now() / 1000).toFixed(1)} s de abrir\n`;
  const cab0 = `${escena.backend} · ventana ${innerWidth}×${innerHeight} · devicePixelRatio ${devicePixelRatio} · nivel ${escena.calidad.nivel}\n${navigator.userAgent.slice(0, 120)}\n`;
  const cab = cab0 + introTxt;
  const vis = (g, v) => { const i = escena.grupos[g]; if (i) i.root.visible = v; };
  const pruebas = [
    ['actual', () => {}],
    ['sin bloom', () => escena.setSalida('sinBloom')],
    ['sin bloom ni FXAA', () => escena.setSalida('sinAA')],
    ['resolución ×0,7', () => { escena.setSalida('sinBloom'); r.setPixelRatio(d0 * 0.7); }],
    ['resolución ×0,5', () => { r.setPixelRatio(d0 * 0.5); }],
    ['×0,5 sin cielo', () => { escena.sky.visible = false; }],
    ['×1 sin cielo', () => { r.setPixelRatio(d0); }],
    ['×1 sin tejas', () => { escena.sky.visible = true; vis('cubiertas', false); }],
    ['×1 sin follaje', () => { vis('cubiertas', true); vis('vegetacion', false); }],
    ['×1 sin contexto', () => { vis('vegetacion', true); vis('contexto', false); }],
    ['sol en movimiento', () => { vis('contexto', true); S.modo = 'explorar'; S.muevesol = true; }],
    ['lluvia', () => { S.muevesol = false; S.aguacero = true; }],
    ['lluvia + sol', () => { S.muevesol = true; }],
  ];
  controls.enabled = false; r.info.autoReset = false;
  const tgt = controls.target.clone(), off = escena.camera.position.clone().sub(tgt);
  for (const [nombre, prep] of pruebas) {
    prep(); escena.sucio = true;
    const M = { dts: [], cpu: [], last: performance.now(), ang: 0 };
    M.giro = () => { if (S.muevesol) S.min = (S.min + 2) % 1440; M.ang += 0.01; const o = off.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), M.ang); escena.camera.position.copy(tgt).add(o); escena.camera.lookAt(tgt); };
    S.midiendo = M;
    await new Promise((ok) => setTimeout(ok, 700)); M.dts.length = 0; M.cpu.length = 0;   // calentamiento
    await new Promise((ok) => setTimeout(ok, 2500));
    S.midiendo = null;
    const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))] || 0; };
    const inf = r.info.render;
    filas.push(`${nombre.padEnd(20)} ${String(px()).padStart(5)} MP  mediana ${q(M.dts, 0.5).toFixed(1).padStart(5)} ms  p90 ${q(M.dts, 0.9).toFixed(1).padStart(5)} ms  (${Math.round(1000 / q(M.dts, 0.5))} fps)  cpu ${q(M.cpu, 0.5).toFixed(1)} ms  llamadas ${inf.drawCalls ?? inf.calls ?? '?'}  triángulos ${Math.round((inf.triangles ?? 0) / 1e3)}k`);
    caja.textContent = cab + filas.join('\n');
  }
  S.muevesol = false; S.aguacero = false; irAAhora();
  r.info.autoReset = true; vis('contexto', true); r.setPixelRatio(d0); escena.setSalida(escena.bloomOn ? 'conBloom' : 'sinBloom'); controls.enabled = true;
  caja.textContent = cab + filas.join('\n') + '\nLISTO';
}

function depurar() {
  pintarDiag();
  let n = 0, t0 = performance.now();
  const f = () => {
    n++; const t = performance.now();
    if (t - t0 > 1000) {
      const i = escena.renderer.info, el = document.getElementById('diag');
      if (el) el.querySelector('summary').textContent = `${VERSION} · ${escena.backend} · ${Math.round(n * 1000 / (t - t0))} fps · dpr ${escena.renderer.getPixelRatio().toFixed(2)} · tris ${Math.round((i.render?.triangles ?? 0) / 1e3)}k · sol ${f1(escena.alt ?? 0)}° · lluvia ${f1(U.lluvia.value, 2)} · modo ${S.modo} · cuadros ${S.dibujados ?? 0}`;
      n = 0; t0 = t;
    }
    requestAnimationFrame(f);
  };
  f();
}

globalThis.__e106 = { S, DIAG, U, get escena() { return escena; }, get controls() { return controls; }, get intro() { return intro; }, clima, rescatar };
arrancar();
