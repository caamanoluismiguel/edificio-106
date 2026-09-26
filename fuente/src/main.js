// Un edificio a 9° N — v2: un solo instrumento. El gemelo se arma solo al abrir, queda en "Ahora"
// (sol calculado y tiempo real) y una máquina del tiempo recorre el día, el año y los últimos 25 años.
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Escena, U, GRUPOS } from './escena.js';
import { Sonido } from './sonido.js';
import { puntosIntro } from './datos.js';
import { posicionSol, vectorSol, diasCeroSombra, saleYPone, sombraPoste, rumboTexto, FACHADAS, incidencia, dniDespejado, mediodiaSolar, EJE_LARGO } from './sol.js';
import { Clima } from './clima.js';

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
const f1 = (x, d = 1) => x.toLocaleString('es-PA', { minimumFractionDigits: d, maximumFractionDigits: d });
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
const VISTA_FACHADA = {
  'fachada-se': { pos: [9, 1.65, 30], tgt: [4, 6.2, 11.5] },
  'fachada-no': { pos: [-2, 1.65, -32], tgt: [0, 6.2, -11.5] },
  'fachada-ne': { pos: [46, 1.65, -4], tgt: [22.75, 6.2, 0] },
  'fachada-so': { pos: [-46, 1.65, 4], tgt: [-22.75, 6.2, 0] },
};
const ROTULOS = [ // aparecen durante el armado, en el orden de los grupos
  { b: 0, t: '12 × 6 crujías sobre 45,5 × 23 m' },       // aparece cuando los puntos ya formaron el edificio
  { b: 1.3, t: '3 pisos de 3,65 m' },
  { b: 2.3, t: '113 vanos' },
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
  lente: 'foto',                 // foto · sol · lluvia · sombras
  aguaModo: 'hora',              // lente de lluvia: esta hora o año típico
  viaje: null,                   // viaje en el tiempo en curso
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

// ---------------- Arranque ----------------
async function arrancar() {
  const q = calidad();
  estadoCarga('Preparando la escena…');
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
  controls.rotateSpeed = 0.55; controls.zoomSpeed = 0.8; controls.minDistance = 12; controls.maxDistance = 360; controls.minPolarAngle = 0.01;
  controls.target.set(...ESQUINA.tgt);
  controls.addEventListener('start', alTomar);

  const bytes = {};
  escena.cargar(BASE, (g, l, t) => {
    if (t) bytes[g] = [l, t];
    const [L, T] = Object.values(bytes).reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0]);
    if (T) estadoCarga(`Modelo · ${f1(L / 1e6)} MB`);
    if (l === 1 && t === 1) compilarPronto();
  });
  const pIntro = puntosIntro(BASE).catch((e) => { console.warn(e); return null; });
  clima.cargarResumen(BASE + 'datos/clima_resumen.json').then((ok) => { if (ok) { dibujarDecadas(); pintarMomentos(); pintarConsultas(); } });
  fetch(BASE + 'datos/consultas.json').then((r) => r.json()).then((j) => { consultas = j; pintarConsultas(); }).catch((e) => anotar('aviso', 'consultas: ' + e));
  const pVivo = clima.cargarVivo();
  setInterval(() => { if (S.modo === 'ahora') clima.cargarVivo(); }, 10 * 60e3);

  prepararUI();
  const d = await pIntro;
  const n = d ? escena.construirParticulas(d, q.particulas) : 0;
  estadoCarga(n ? `${n.toLocaleString('es-PA')} puntos` : 'Cargando el modelo…');
  empezarIntro();
  requestAnimationFrame(bucle);
  escena.cargaCompleta.then(async () => {
    // compilar de antemano la lluvia, para que el primer aguacero no congele la imagen
    const o = [escena.lluviaSpr, escena.aleros, escena.salpicaduras].filter(Boolean); o.forEach((x) => { x.visible = true; });
    try { await escena.renderer.compileAsync(escena.scene, escena.camera); } catch (e) { /* se compila al dibujar */ }
  });
  escena.cargaCompleta.then(() => { if (n) estadoCarga(`${n.toLocaleString('es-PA')} puntos · modelo completo`); });
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
  compilando = setTimeout(() => { escena.renderer.compileAsync(escena.scene, escena.camera).catch(() => {}); }, 60);
}

function estadoCarga(t) { const el = $('#carga-estado'); if (el) el.textContent = t; }

// ---------------- Intro automática ----------------
function empezarIntro() {
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
  if (!visto && !location.hash) setTimeout(() => { if (S.paso == null) $('#oferta-recorrido').hidden = false; }, 900);
  const h = location.hash.replace('#', '');
  if (FACHADAS[h]) irAFachada(h);
  irAMomentoHash();
}

/** Enlace directo a un momento: #m-AAAAMMDD-HHMM (p. ej. #m-20240724-1745). */
function irAMomentoHash() {
  const r = /^#m-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(location.hash); if (!r) return false;
  const [, y, mo, d, hh, mi] = r.map(Number);
  viajarA({ fecha: { y, m: mo, d }, min: hh * 60 + mi });
  return true;
}

// ---------------- Viaje en el tiempo ----------------
// Al saltar a otra fecha: la fecha y la hora corren en el dock, el sol recorre el cielo por el camino más corto
// (nunca un día tras otro: sin parpadeo de día y noche), la cámara vuela a la vista pedida y, al llegar, entra el tiempo.
const easeViaje = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const marcaT = (f, min) => Date.UTC(f.y, f.m - 1, f.d) + min * 60e3;
function solDeVector(v) { const alt = Math.asin(Math.max(-1, Math.min(1, v.y))) * 180 / Math.PI; const az = ((EJE_LARGO - Math.atan2(-v.z, v.x) * 180 / Math.PI) % 360 + 360) % 360; return { alt, az }; }
function viajarA(d) {
  parar(); explorar();
  S.mesSerie = null; S.aguacero = false; $('#capa-aguacero').checked = false; S.explica = null;
  S.momento = d.titulo ? { titulo: d.titulo, texto: d.texto ?? '' } : null;
  if (d.lente) ponerLente(d.lente, d.lente !== 'foto' && S.paso == null);
  if (S.pestana !== 'dia') ponerPestana('dia');
  if (d.fachada) mostrarFachada('fachada-' + d.fachada); else { S.fachada = null; document.documentElement.classList.remove('en-fachada'); }
  const f1 = { y: d.fecha.y, m: d.fecha.m, d: d.fecha.d }, m1 = d.min;
  const dh = Math.abs(marcaT(f1, m1) - marcaT(S.fecha, S.min)) / 3.6e6;
  const T = reduce || d.inmediato ? 0 : Math.min(2800, Math.max(900, 900 + 350 * Math.log10(1 + dh)));
  const vista = d.fachada ? VISTA_FACHADA['fachada-' + d.fachada] : d.vista ? VISTAS[d.vista] : null;
  if (vista) volarA(vista, Math.max(1.2, T / 1000), d.fachada ? null : d.vista, false);
  if (!T) { S.fecha = f1; S.min = m1; S.salto = true; S.viaje = null; lastLect = ''; llegada(d); return; }
  const p0 = posicionSol({ ...S.fecha, h: 0, min: S.min }), p1 = posicionSol({ ...f1, h: 0, min: m1 });
  const v0 = vectorSol(p0.alt, p0.az), v1 = vectorSol(p1.alt, p1.az);
  const mismoDia = f1.y === S.fecha.y && f1.m === S.fecha.m && f1.d === S.fecha.d;
  S.viaje = { t0: performance.now(), T, ts0: marcaT(S.fecha, S.min), ts1: marcaT(f1, m1), f1, m1, mismoDia,
    v0: new THREE.Vector3(v0.x, v0.y, v0.z), v1: new THREE.Vector3(v1.x, v1.y, v1.z), nubes0: nubesSuave, d };
  $('#viaje-destino').textContent = `${f1.d} ${MES3[f1.m - 1]} ${f1.y} · ${hhmm(m1)}`;
  $('#viaje').hidden = false; document.documentElement.classList.add('viajando');
  $('#viaje').classList.remove('llego');
  lastLect = '';
}
const _vs = new THREE.Vector3();
function pasoViaje(now) {
  const V = S.viaje, k = Math.min(1, (now - V.t0) / V.T), e = easeViaje(k);
  const ts = V.ts0 + (V.ts1 - V.ts0) * e, dd = new Date(ts);
  S.fecha = { y: dd.getUTCFullYear(), m: dd.getUTCMonth() + 1, d: dd.getUTCDate() };
  S.min = dd.getUTCHours() * 60 + dd.getUTCMinutes() + dd.getUTCSeconds() / 60;
  // el sol: dentro del mismo día sigue su arco real; si no, el camino más corto por el cielo (a lo sumo un cruce del horizonte)
  if (V.mismoDia) S.solViaje = null;
  else { const ang = V.v0.angleTo(V.v1); if (ang < 1e-4) _vs.copy(V.v1); else { _vs.copy(V.v0).multiplyScalar(Math.sin((1 - e) * ang)).addScaledVector(V.v1, Math.sin(e * ang)).divideScalar(Math.sin(ang)); } S.solViaje = solDeVector(_vs); }
  U.viaje.value = Math.sin(Math.PI * k);
  $('#viaje-barra').style.transform = `scaleX(${k.toFixed(3)})`;
  if (k >= 1) {
    S.fecha = V.f1; S.min = V.m1; S.viaje = null; S.solViaje = null; U.viaje.value = 0; S.aterrizaje = now; lastLect = '';
    llegada(V.d);
  }
}
function llegada(d) {
  document.documentElement.classList.remove('viajando');
  if (d.aAhora) { S.modo = 'ahora'; const a = ahoraPanama(); S.fecha = { y: a.y, m: a.m, d: a.d }; S.min = a.min; lastLect = ''; }
  const el = $('#viaje'); el.hidden = false; el.classList.add('llego');
  $('#viaje-barra').style.transform = 'scaleX(1)';
  clearTimeout(llegada.t); llegada.t = setTimeout(() => { el.hidden = true; el.classList.remove('llego'); }, 2600);
}

// ---------------- Cámara ----------------
function volarA(v, dur = 1.6, clave = null, avisar = true) {
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
  document.querySelectorAll('[data-vista]').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.vista === clave)); b.style.setProperty('--p', b.dataset.vista === clave ? 0 : 1); });
}
function pasoCamara(dt) {
  const a = cam.anim; if (!a) return false;
  a.k = Math.min(1, a.k + dt / a.dur); const e = eio(a.k);
  if (a.clave) document.querySelector(`[data-vista="${a.clave}"]`)?.style.setProperty('--p', e.toFixed(3));
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
  document.documentElement.classList.add('girado');
  marcarVista(null);
  if (controls.target.distanceTo(new THREE.Vector3(...CENTRO)) > 2) deslizar = { t0: controls.target.clone(), k: 0 };
}

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
  escena.setSol(p.alt, p.az);
  if (!S.viaje) escena.setRuta(S.fecha);
  // lluvia: la de los datos (o la del mes en el paso de 25 años), o el aguacero de la capa
  let objetivo = c ? (c.fuente === 'mes' ? Math.min(1, (c.lluviaMes ?? 0) / 380) : intensidad(c.lluvia ?? 0)) : 0;
  if (S.aguacero) objetivo = 1;
  if (intro || S.viaje) objetivo = 0;
  // al llegar de un viaje la lluvia entra rápido (~0,6 s); en el resto, suave
  const vel = S.viaje ? 5 : now - (S.aterrizaje ?? -1e9) < 1500 ? 3.2 : 1.4;
  lluviaSuave += (objetivo - lluviaSuave) * (salto ? 1 : Math.min(1, dt * vel));
  U.lluvia.value = lluviaSuave; escena.lv = Math.min(1, lluviaSuave * 1.1);
  U.mojado.value += ((lluviaSuave > 0.08 ? 1 : 0) - U.mojado.value) * (salto ? 1 : Math.min(1, dt * (lluviaSuave > 0.08 ? 0.35 : 0.05)));
  if (c?.viento != null && c?.dir != null) { const w = vectorSol(0, (c.dir + 180) % 360); const k = 0.4 + c.viento / 12; U.viento.value.set(w.x * k, w.z * k); }
  if (escena.actualizar(dt)) sonido.trueno();
  U.calor.value += ((S.lente === 'sol' ? 1 : 0) - U.calor.value) * Math.min(1, dt * 4);
  U.agua.value += ((S.lente === 'lluvia' ? 1 : 0) - U.agua.value) * Math.min(1, dt * 4);
  U.sombras.value += ((S.lente === 'sombras' && !S.viaje ? 1 : 0) - U.sombras.value) * Math.min(1, dt * 4);
  if (S.lente === 'sombras' && !S.viaje) escena.setDiagrama(S.fecha);
  actualizarCalor(p, c);
  actualizarAgua(c);
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
  // dibujar solo cuando algo cambia
  const cp = escena.camera.position, ct = controls.target;
  const firma = [cp.x, cp.y, cp.z, ct.x, ct.y, ct.z].map((v) => Math.round(v * 60)).join(',') + '|' +
    [U.build.value * 500, U.mat.value * 200, S.min * 4, nubesSuave * 4, (S.kSol ?? 1) * 200, U.calor.value * 100, U.agua.value * 100, U.sombras.value * 100, U.viaje.value * 100, U.mojado.value * 200, escena.uRosa.value * 100, escena.uRuta.value * 100, (p.alt ?? 0) * 20, (p.az ?? 0) * 20].map(Math.round).join(',') +
    `|${S.fecha.y}-${S.fecha.m}-${S.fecha.d}|${innerWidth}x${innerHeight}`;
  const anima = !!intro || !!escena.particulas || U.lluvia.value > 0.01 || U.relampago.value > 0 || !!S.midiendo || !!S.viaje;
  if (firma !== S.firma || anima || escena.sucio || now - (S.ultimoCambio || 0) < 500) {
    if (firma !== S.firma) { S.firma = firma; S.ultimoCambio = now; }
    escena.render(); S.dibujados = (S.dibujados || 0) + 1;
    if (S.midiendo) { const r0 = performance.now(); S.midiendo.cpu.push(r0 - S.midiendo.tFrame); S.midiendo.dts.push(now - S.midiendo.last); S.midiendo.last = now; }
    else medirCuadro(now, dtReal);
  } else S.dibujoPrevio = false;
}

// ---------------- Resolución adaptable ----------------
// Mira el intervalo entre cuadros dibujados seguidos. Baja la resolución si el equipo no alcanza la frecuencia de la
// pantalla y la vuelve a subir cuando va fluido. No cuenta la intro, los viajes, la página oculta ni los tirones de carga.
// (Antes solo subía por debajo de 12 ms por cuadro, algo imposible a 60 Hz: una vez que bajaba, se quedaba baja.)
const RES = { iv: [], minIv: 16.7, techo: 0, tTecho: -1e9, fija: false };
try { RES.fija = localStorage.getItem('e106-nitidez') === '1'; } catch (e) { /* sin almacenamiento */ }
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
  else dni *= 1 - 0.75 * Math.pow(Math.min(1, (c?.nubes ?? 30) / 100), 3.4); // nubosidad (Kasten y Czeplak, 1980)
  const ks = Object.keys(FACHADAS).map((k) => incidencia(p.alt, p.az, FACHADAS[k].rumbo) * dni);
  U.calorF.value.set(...ks.map((v) => Math.min(1, v / 750)));
  U.calorTecho.value = Math.min(1, Math.max(0, Math.sin(p.alt * Math.PI / 180)) * dni / 900);
  S.irr = ks;
}

// ---------------- Lluvia con viento en fachadas (índice de ISO 15927-3 en campo abierto) ----------------
// I = (2/9) · v · r^(8/9) · cos(D − θ), en L/m² por hora: v en m/s (10 m), r en mm/h, D = de dónde viene el viento.
function lluviaBatiente(r, vKmh, dir, rumbo) { const c = Math.cos((dir - rumbo) * Math.PI / 180); return c > 0 && r > 0 ? 2 / 9 * (vKmh / 3.6) * Math.pow(r, 8 / 9) * c : 0; }
function actualizarAgua(c) {
  const ks = Object.keys(FACHADAS);
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
  const key = [kf, Math.round(S.min), S.modo, S.pestana, S.mesSerie, c?.fuente, Math.round((c?.temp ?? 0) * 10), Math.round(c?.nubes ?? -1), Math.round((c?.lluvia ?? 0) * 10), Math.round((c?.dni ?? 0) / 10), S.fachada, S.lente, S.aguaModo, !!S.viaje].join('|');
  if (key === lastLect) return; lastLect = key;
  const vivo = S.modo === 'ahora';
  $('#l-hora').textContent = hhmm(S.min);
  $('#l-fecha').textContent = S.mesSerie !== null ? `${MESES[S.fecha.m - 1]} de ${S.fecha.y}` : fechaTexto(S.fecha);
  document.documentElement.classList.toggle('vivo', vivo);
  $('#ahora').textContent = vivo ? 'Ahora' : 'Volver a ahora';
  $('#ahora').setAttribute('aria-pressed', String(vivo));
  // sol y sombra
  $('#l-alt').textContent = p.alt > -0.5 ? f1(p.alt) + '°' : 'bajo el horizonte';
  $('#l-az').textContent = p.alt > -0.5 ? `hacia el ${rumboTexto(p.az)} · ${Math.round(p.az)}°` : `${f1(-p.alt)}° bajo el horizonte`;
  const sp = sombraPoste(p.alt, p.az);
  $('#l-sombra').textContent = sp ? (sp.largo > 99 ? '> 99 m' : f1(sp.largo, 2) + ' m') : 'sin sol';
  $('#l-sombra-r').textContent = sp ? `cae hacia el ${rumboTexto(sp.rumbo)}` : 'no hay sombra solar';
  // clima
  let temp = '—', det = '', fuente = '';
  if (c?.fuente === 'viaje') { det = 'viajando…'; }
  else if (c) {
    if (c.temp != null) temp = f1(c.temp) + ' °C';
    // línea 1: cielo · línea 2: lluvia (o la diferencia con lo típico)
    const cielo = [];
    if (c.nubes != null) cielo.push(`${Math.round(c.nubes)} % nubes`);
    if (c.dni != null && p.alt > 2) cielo.push(`sol ${Math.round(c.dni / 10) * 10} W/m²`);
    let agua = '';
    if (c.fuente === 'mes') { temp = `${Math.round(c.lluviaMes)} mm`; agua = 'de lluvia en el mes'; }
    else if (c.fuente === 'tipico') agua = `llueve en ${Math.round(c.probLluvia)} % de estas horas`;
    else agua = (c.lluvia ?? 0) >= 0.1 ? `lluvia ${f1(c.lluvia)} mm/h` : 'sin lluvia';
    if (c.fuente === 'vivo') {
      const tip = clima.tipico(S.fecha.m, S.min);
      if (tip) { const dT = c.temp - tip.temp; agua += ` · ${dT >= 0 ? '+' : '−'}${f1(Math.abs(dT))} °C vs. típico`; }
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
  // estado de la barra
  const est = $('#estado-txt');
  if (vivo) est.textContent = c?.fuente === 'vivo' ? `En vivo · ${hhmm(S.min)} · ${f1(c.temp)} °C · ${Math.round(c.nubes)} % nubes` : `Ahora · ${hhmm(S.min)} en Panamá`;
  else est.textContent = `Explorando · ${S.mesSerie !== null ? MESES[S.fecha.m - 1] + ' de ' + S.fecha.y : fechaTexto(S.fecha)}`;
  // agujas y controles
  $('#hora').value = Math.round(S.min) % 1440;
  $('#dia-anio').value = diaDelAnio(S.fecha);
  const xd = (S.min % 1440) / 1440 * 1000; $('#dia-aguja').setAttribute('x1', xd); $('#dia-aguja').setAttribute('x2', xd);
  const xa = diaDelAnio(S.fecha) / 364 * 1000; $('#anio-aguja').setAttribute('x1', xa); $('#anio-aguja').setAttribute('x2', xa);
  const im = (S.fecha.y - 2001) * 12 + S.fecha.m - 1;
  const enSerie = im >= 0 && im < 300;
  $('#mes-serie').value = Math.max(0, Math.min(299, im));
  const xs = (Math.max(0, Math.min(299, im)) + 0.5) / 300 * 1000; $('#dec-aguja').setAttribute('x1', xs); $('#dec-aguja').setAttribute('x2', xs);
  $('#dec-aguja').style.opacity = enSerie ? 1 : 0.25;
  rotulo(p, c, sp);
  leyenda();
  marcaSol(p);
  if (S.fachada) textoFachada(p);
  // fachadas: irradiancia
  Object.keys(FACHADAS).forEach((k, i) => {
    const el = document.querySelector(`[data-fachada="${k}"]`); if (!el) return;
    const v = S.irr?.[i] ?? 0; el.querySelector('i').style.setProperty('--v', Math.min(1, v / 800)); el.querySelector('b').textContent = Math.round(v) + ' W/m²';
  });
}

// el pequeño sol de la marca sigue la hora que muestra la escena
function marcaSol(p) {
  const { sale, pone } = saleYPone(S.fecha.y, S.fecha.m, S.fecha.d);
  const q = clamp01((S.min - sale) / (pone - sale)), ang = Math.PI * (1 - q), el = $('#marca-sol');
  el.setAttribute('cx', (19 + 16 * Math.cos(ang)).toFixed(2)); el.setAttribute('cy', (20 - 16 * Math.sin(ang)).toFixed(2));
  el.style.opacity = p.alt > -1 ? 1 : 0.25;
}

function rotulo(p, c, sp) {
  const tipo = $('#rotulo-tipo'), txt = $('#rotulo-texto');
  const cerrar = $('#rotulo-cerrar');
  if (S.viaje) { cerrar.hidden = true; tipo.textContent = 'Viajando en el tiempo'; txt.textContent = `Hacia el ${fechaTexto(S.viaje.f1)}, a las ${hhmm(S.viaje.m1)}.`; return; }
  if (S.explica) { const e = explicacion(S.explica, p, c); if (e) { cerrar.hidden = false; tipo.textContent = 'Qué significa · ' + e[0]; txt.textContent = e[1]; return; } }
  cerrar.hidden = true;
  if (S.momento) { tipo.textContent = S.momento.titulo; txt.textContent = S.momento.texto; return; }
  const solTxt = p.alt > 0.5 ? `El sol está a ${f1(p.alt)}° sobre el horizonte, hacia el ${rumboTexto(p.az)}; la sombra de un poste de 1 m mide ${sp.largo > 99 ? 'más de 99 m' : f1(sp.largo, 2) + ' m'} y cae hacia el ${rumboTexto(sp.rumbo)}.`
    : p.alt > -6 ? 'El sol acaba de cruzar el horizonte: es el crepúsculo.' : 'Es de noche: las ventanas encendidas son una suposición del modelo, no un dato.';
  let clTxt = '';
  if (c?.fuente === 'vivo') clTxt = (c.lluvia ?? 0) >= 0.1 ? ` Está lloviendo (${f1(c.lluvia)} mm/h).` : ` Cielo con ${Math.round(c.nubes)} % de nubes.`;
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
  $('#reproducir').setAttribute('aria-pressed', 'true'); $('#reproducir').setAttribute('aria-label', 'Pausar');
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
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
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
  $('#saltar').addEventListener('click', () => { if (!intro) return; if (intro.velocidad > 1) intro.t = intro.L; else intro.velocidad = 4; });
  $('#sonido').addEventListener('click', () => {
    const on = $('#sonido').getAttribute('aria-pressed') !== 'true';
    on ? sonido.encender() : sonido.apagar();
    $('#sonido').setAttribute('aria-pressed', String(on));
  });
  $('#info').addEventListener('click', () => { const d = $('#acerca'); d.showModal ? d.showModal() : d.setAttribute('open', ''); });
  $('#cerrar-acerca').addEventListener('click', () => $('#acerca').close?.());
  $('#ahora').addEventListener('click', () => irAAhora());
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { ponerPestana(b.dataset.tab); S.explica = 'tab-' + b.dataset.tab; lastLect = ''; }));
  // qué significa cada dato
  document.querySelectorAll('[data-explica]').forEach((b) => {
    b.addEventListener('click', () => explicar(b.dataset.explica));
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); explicar(b.dataset.explica); } });
  });
  $('#rotulo-cerrar').addEventListener('click', () => { S.explica = null; document.querySelectorAll('[data-explica]').forEach((b) => b.setAttribute('aria-pressed', 'false')); lastLect = ''; });
  $('#lente-info').addEventListener('click', () => { S.verLeyenda = !S.verLeyenda; lastLect = ''; });
  $('#ley-cerrar').addEventListener('click', () => { S.verLeyenda = false; lastLect = ''; });
  if (innerWidth <= 760) $('#ley-mas').open = false;
  // recorrido guiado
  const abrirRec = () => { $('#oferta-recorrido').hidden = true; abrirSirve(false); $('#acerca').close?.(); recorrido(0); };
  ['#abrir-recorrido', '#sirve-recorrido', '#acerca-recorrido', '#oferta-si'].forEach((x) => $(x)?.addEventListener('click', abrirRec));
  $('#oferta-no').addEventListener('click', () => { $('#oferta-recorrido').hidden = true; });
  $('#rec-sig').addEventListener('click', () => recorrido(S.paso + 1));
  $('#rec-prev').addEventListener('click', () => recorrido(S.paso - 1));
  $('#rec-salir').addEventListener('click', () => recorrido(null));
  // nitidez
  $('#capa-nitidez').checked = RES.fija;
  $('#capa-nitidez').addEventListener('change', (e) => { RES.fija = e.target.checked; RES.iv = []; RES.techo = 0; try { localStorage.setItem('e106-nitidez', RES.fija ? '1' : '0'); } catch (x) { /* nada */ } escena.sucio = true; pintarResolucion(); });
  $('#hora').addEventListener('input', (e) => { parar(); explorar(); S.momento = null; S.mesSerie = null; S.min = +e.target.value; });
  $('#dia-anio').addEventListener('input', (e) => { parar(); explorar(); S.momento = null; S.fecha = fechaDeDia(S.fecha.y, +e.target.value); });
  $('#mes-serie').addEventListener('input', (e) => {
    parar(); explorar(); S.momento = null; const i = +e.target.value, y = 2001 + Math.floor(i / 12), m = (i % 12) + 1;
    S.mesSerie = null; S.fecha = { y, m, d: Math.min(S.fecha.d, diasMes(y, m)) };
  });
  $('#reproducir').addEventListener('click', reproducir);
  // para qué sirve: hallazgos con un momento para verlos en la escena
  const abrirSirve = (abrir) => { $('#sirve').hidden = !abrir; $('#abrir-sirve').setAttribute('aria-expanded', String(abrir)); };
  $('#abrir-sirve').addEventListener('click', () => abrirSirve($('#sirve').hidden));
  $('#cerrar-sirve').addEventListener('click', () => abrirSirve(false));
  document.querySelectorAll('.hallazgo .ver').forEach((b) => b.addEventListener('click', () => {
    const art = b.closest('.hallazgo'), d = art.dataset;
    document.querySelectorAll('.hallazgo').forEach((x) => x.classList.toggle('activo', x === art));
    const [hh, mi] = d.hora.split(':').map(Number);
    if (innerWidth <= 760) abrirSirve(false);
    viajarA({ fecha: deISO(d.fecha), min: hh * 60 + mi, vista: d.fachada ? null : d.vista || 'esquina', fachada: d.fachada || null, lente: d.capa === 'calor' ? 'sol' : d.capa || 'foto' });
  }));
  // ir a un momento exacto (p. ej. para comparar con una foto) o a una de las consultas
  const abrirIr = (abrir) => {
    $('#ir-a').hidden = !abrir; $('#elegir').setAttribute('aria-expanded', String(abrir)); $('#abrir-ir').setAttribute('aria-expanded', String(abrir));
    if (abrir) { $('#capas').hidden = true; $('#abrir-capas').setAttribute('aria-expanded', 'false'); }
    if (abrir) {
      $('#ir-fecha').value = kf2(S.fecha); $('#ir-hora').value = hhmm(S.min);
      pintarConsultas(); if (innerWidth > 760) $('#ir-fecha').focus();
    }
  };
  globalThis.__abrirIr = abrirIr;
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
    viajarA({ fecha: r.f, min: r.min, vista: it.vista, fachada: it.fachada, lente: it.lente, titulo: it.t, texto: r.txt ?? it.txt });
  });
  // formas de ver
  document.querySelectorAll('[data-lente]').forEach((b) => b.addEventListener('click', () => {
    ponerLente(b.dataset.lente, true);
    if (b.dataset.lente === 'sombras' && escena.camera.position.y < 30) volarA(VISTAS.planta, 1.6, 'planta');
  }));
  document.querySelectorAll('[data-agua]').forEach((b) => b.addEventListener('click', () => { S.aguaModo = b.dataset.agua; lastLect = ''; }));
  $('#abrir-capas').addEventListener('click', () => { const c = $('#capas'), abrir = c.hidden; c.hidden = !abrir; $('#abrir-capas').setAttribute('aria-expanded', String(abrir)); if (abrir) { abrirIr(false); pintarResolucion(); } });
  $('#capa-aguacero').addEventListener('change', (e) => { S.aguacero = e.target.checked; });
  $('#capa-ayudas').addEventListener('change', (e) => { S.ayudas = e.target.checked; });
  document.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => { S.fachada = null; document.documentElement.classList.remove('en-fachada'); $('#panel-fachada').hidden = true; volarA(VISTAS[b.dataset.vista], 1.6, b.dataset.vista); }));
  $('#brujula').addEventListener('click', () => volarA(VISTAS.planta, 1.6, 'planta'));
  document.querySelectorAll('[data-ir-fachada]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); irAFachada(a.dataset.irFachada); }));
  $('#salir-fachada').addEventListener('click', () => { S.fachada = null; document.documentElement.classList.remove('en-fachada'); $('#panel-fachada').hidden = true; try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* visor */ } volarA(VISTAS.esquina, 1.6, 'esquina'); });
  addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (intro) return; if (FACHADAS[h]) irAFachada(h); else irAMomentoHash(); });
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.key === '1' || e.key === '2' || e.key === '3') { const k = ['esquina', 'aerea', 'planta'][+e.key - 1]; S.fachada = null; document.documentElement.classList.remove('en-fachada'); volarA(VISTAS[k], 1.6, k); }
    if (S.viaje && (e.key === 'Escape' || e.key === ' ')) { S.viaje.t0 = -1e9; e.preventDefault(); }
    else if (S.paso != null && e.key === 'ArrowRight') recorrido(S.paso + 1);
    else if (S.paso != null && e.key === 'ArrowLeft') recorrido(S.paso - 1);
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('#sirve').hidden = true; $('#abrir-sirve').setAttribute('aria-expanded', 'false'); $('#capas').hidden = true; $('#abrir-capas').setAttribute('aria-expanded', 'false'); $('#ir-a').hidden = true; $('#elegir').setAttribute('aria-expanded', 'false'); $('#abrir-ir').setAttribute('aria-expanded', 'false'); } });
  // la primera interacción despierta el audio si el visitante ya pidió sonido
  const d = diasCeroSombra(hoy.y);
  $('#cenit-txt').textContent = `A 9° N el sol pasa casi por el cenit dos veces al año: en ${hoy.y}, el ${d[0].d} de ${MESES[d[0].m - 1]} y el ${d[1].d} de ${MESES[d[1].m - 1]}, hacia las ${hhmm(d[0].h * 60 + d[0].min)}. Ese mediodía, un poste casi no hace sombra.`;
}

function irAFachada(k) {
  if (!FACHADAS[k]) return;
  irAAhora(false); mostrarFachada(k); volarA(VISTA_FACHADA[k]);
}
function mostrarFachada(k) {
  const f = FACHADAS[k]; if (!f) return;
  S.fachada = k; marcarVista(null);
  document.documentElement.classList.add('en-fachada');
  $('#fachada-titulo').textContent = `${f.nombre}: ${f.lugar}`;
  $('#panel-fachada').hidden = false;
  lastLect = '';
}
function textoFachada(p) {
  const f = FACHADAS[S.fachada], sp = sombraPoste(p.alt, p.az), inc = incidencia(p.alt, p.az, f.rumbo);
  $('#fachada-texto').textContent = p.alt <= 0
    ? `Son las ${hhmm(S.min)} en Panamá y el sol está bajo el horizonte.`
    : `Son las ${hhmm(S.min)}. El sol está a ${f1(p.alt)}° de altura, hacia el ${rumboTexto(p.az)}. ${inc > 0.02 ? 'Esta fachada recibe sol directo.' : 'Esta fachada está en sombra.'} Tu sombra debería caer hacia el ${rumboTexto(sp.rumbo)} y medir ${f1(sp.largo, 2)} veces tu estatura: compárala con la del modelo.`;
}

function refrescar() { lastLect = ''; S.kClimaDia = ''; }

// ---------------- Formas de ver (lentes) ----------------
// Cada lente trae su explicación en lenguaje llano: qué ves, cómo leerlo, algo para probar, para qué sirve en el diseño,
// qué no dice y cómo se calcula. Las cifras de «Para el diseño» salen de la serie ERA5 2001–2025 (ver «Para qué sirve»).
const LENTES = {
  foto: { t: 'Foto: el edificio como se vería', rampa: null,
    que: 'El sol está calculado para este minuto exacto. El cielo, las nubes, la lluvia y el suelo mojado salen del dato del tiempo de esa hora.',
    prueba: 'Mueve la regla del día y mira cómo giran y se acortan las sombras. Cerca del mediodía, el alero de 1,65 m deja las paredes casi todas en sombra.',
    porque: 'Sirve para comparar con una foto real del mismo día y hora, y para ver el edificio con la luz de cualquier momento desde 1940.',
    ojo: 'La cantidad de nubes y de lluvia sale del dato; su forma y su posición exacta no. Las ventanas encendidas de noche son una suposición.',
    tec: 'Posición del sol: algoritmo de NOAA (error menor a 0,02°). Tiempo: reanálisis ERA5 (Open-Meteo), una celda de unos 28 km que contiene el edificio; para hoy, pronóstico de modelo. Sombras en tiempo real con un mapa de sombras.' },
  sol: { t: 'Sol: cuánto sol directo le pega a cada fachada', u: 'W/m²', rampa: 'linear-gradient(90deg, #0d1f59, #f28c14 55%, #f21f0d)', esc: ['nada', '375 W/m²', '750 o más'],
    que: 'Cada fachada se pinta según el sol directo que le llega en este momento: azul oscuro es nada, naranja es bastante y rojo es mucho. Los números son vatios por metro cuadrado (W/m²).',
    leer: 'Con cielo despejado, una pared que mira de frente al sol llega a unos 600–700 W/m². Con el sol tapado por nubes, casi a cero.',
    prueba: 'Mueve la hora de la mañana a la tarde: el color pasa de la fachada sureste (la de la entrada) a la suroeste. Al mediodía las paredes casi no reciben sol: el sol está tan alto que le pega sobre todo al techo.',
    porque: 'La fachada que más sol recibe es la que más se calienta y la que más protección pide: aleros, parasoles o vidrio con control solar. En un año, la sureste y la suroeste reciben más del doble de sol directo que la noroeste.',
    ojo: 'Cuenta solo el sol directo: no la luz del cielo nublado ni la reflejada, ni la sombra de árboles o vecinos. El color y el número son los de una pared sin alero: la sombra del alero se ve en la escena, pero no se resta del número.',
    tec: 'Radiación directa sobre un plano vertical = radiación directa normal (DNI) de ERA5 en esa hora × coseno del ángulo entre el sol y la cara de la fachada. El techo usa su plano horizontal.' },
  lluvia: { t: 'Lluvia: qué fachada se moja cuando llueve con viento', rampa: 'linear-gradient(90deg, #0d121a, #1566e6 50%, #99e6ff)', esc: ['nada', '', 'mucha'],
    que: 'Con viento, la lluvia no cae derecha: se moja más la fachada que mira hacia donde viene el viento. Cada fachada se pinta en azules según esa exposición: oscuro es nada y azul claro es mucha.',
    leer: '«Esta hora» usa la lluvia y el viento de esa hora, en litros por metro cuadrado. «Año típico» es el promedio de un año, sumando 25 años de datos.',
    prueba: 'Pasa a «Año típico»: la noroeste se moja más de cinco veces lo que el testero noreste. Luego abre «Ir a…» y elige «La fachada que más se moja».',
    porque: 'Dice dónde reforzar aleros, goterones, juntas y acabados, y dónde no conviene poner materiales que sufren con el agua.',
    ojo: 'Es un índice para comparar las fachadas entre sí, no el agua que de verdad llega al muro: no descuenta el alero, los árboles ni los edificios vecinos, y el viento del modelo no tiene ráfagas.',
    tec: 'Índice de lluvia batiente de la norma ISO 15927-3 en campo abierto: (2/9) · v · r^(8/9) · cos(D − θ), con v el viento a 10 m de altura (m/s), r la lluvia (mm/h), D de dónde viene el viento y θ hacia dónde mira la fachada. Datos ERA5, celda de unos 28 km.' },
  sombras: { t: 'Sombras: la sombra del edificio en cada hora del día', rampa: 'linear-gradient(90deg, #5cc8d6, #f2efe6 50%, #f4a23a)', esc: ['6 h', '12 h', '18 h'],
    que: 'Sobre el terreno se dibuja el contorno de la sombra del edificio en cada hora en punto, de 6 a 18 h: turquesa en la mañana, blanco al mediodía y naranja en la tarde. Donde se enciman más contornos, ese pedazo de suelo pasa más horas a la sombra.',
    prueba: 'Cambia la fecha con la regla del año: en diciembre las sombras son largas y caen hacia el norte; en junio son cortas y caen hacia el sur. En los días sin sombra (abril y agosto), la del mediodía casi desaparece.',
    porque: 'Sirve para decidir dónde poner un patio, una terraza, una banca o un árbol: qué partes del jardín tienen sombra en la mañana y cuáles en la tarde.',
    ojo: 'Es la sombra del volumen del edificio solo, sobre un terreno plano, sin árboles ni vecinos.',
    tec: 'Para cada hora se proyecta la silueta del edificio sobre el suelo en la dirección del sol (NOAA) y se traza su contorno exterior. Es exacto para el volumen; los detalles pequeños quedan dentro del contorno.' },
};
function ponerLente(k, mostrar = true) {
  if (!(k in LENTES)) k = 'foto';
  S.lente = k; if (mostrar) S.verLeyenda = true;
  document.querySelectorAll('[data-lente]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lente === k)));
  lastLect = '';
}
function leyenda() {
  const L = LENTES[S.lente], el = $('#leyenda');
  el.hidden = !S.verLeyenda; $('#lente-info').setAttribute('aria-expanded', String(!!S.verLeyenda));
  if (!S.verLeyenda) return;
  if (el.dataset.lente !== S.lente) {                           // textos fijos: solo al cambiar de lente
    el.dataset.lente = S.lente;
    $('#ley-t').textContent = L.t; $('#ley-que').textContent = L.que;
    $('#ley-rampa').hidden = $('#ley-escala').hidden = !L.rampa;
    if (L.rampa) { $('#ley-rampa').style.background = L.rampa; $('#ley-escala').innerHTML = L.esc.map((x) => `<span>${x}</span>`).join(''); }
    $('#ley-leer').textContent = L.leer ?? ''; $('#ley-leer').hidden = !L.leer;
    $('#ley-prueba').textContent = L.prueba; $('#ley-porque').textContent = L.porque; $('#ley-ojo').textContent = L.ojo; $('#ley-tec').textContent = L.tec;
  }
  $('#ley-modos').hidden = S.lente !== 'lluvia';
  document.querySelectorAll('[data-agua]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.agua === S.aguaModo)));
  const ks = Object.keys(FACHADAS), nom = { 'fachada-se': 'SE', 'fachada-no': 'NO', 'fachada-ne': 'NE', 'fachada-so': 'SO' };
  let filas = '';
  if (S.lente === 'sol') filas = ks.map((k, i) => `<li><span>${nom[k]}</span><b>${Math.round(S.irr?.[i] ?? 0)}</b><small>W/m²</small></li>`).join('');
  else if (S.lente === 'lluvia') {
    const anual = S.aguaModo === 'anio';
    filas = ks.map((k, i) => `<li><span>${nom[k]}</span><b>${anual ? Math.round(S.agua?.[i] ?? 0) : f1(S.agua?.[i] ?? 0)}</b><small>${anual ? 'L/m² al año' : 'L/m² en la hora'}</small></li>`).join('');
  }
  $('#ley-fachadas').innerHTML = filas; $('#ley-fachadas').hidden = !filas;
  // nota de la situación: qué pasa en este momento
  let nota = '';
  const p = posicionSol({ ...S.fecha, h: 0, min: S.min });
  if (S.lente === 'sol') nota = p.alt <= 0 ? 'Ahora es de noche: ninguna fachada recibe sol. Mueve la regla del día a la mañana o a la tarde.'
    : `Ahora el sol está hacia el ${rumboTexto(p.az)}, a ${f1(p.alt)}° de altura${(S.irr ?? []).every((v) => v < 5) ? ': a esta hora ninguna pared lo recibe de frente, o las nubes lo tapan.' : '.'}`;
  if (S.lente === 'lluvia' && S.aguaModo === 'hora' && !S.viaje) {
    if (!S.aguaDato) nota = 'Para esta hora no hay dato de lluvia y viento (solo valores típicos). Pasa a «Año típico» o elige una fecha entre 2001 y 2025.';
    else if (!(S.agua ?? []).some((v) => v > 0.05)) nota = 'A esta hora no llueve con viento contra ninguna fachada. Pasa a «Año típico» o busca un aguacero en «Ir a…».';
  }
  if (S.lente === 'lluvia' && S.aguaModo === 'anio') nota = 'Promedio de un año, 2001–2025.';
  if (S.lente === 'sombras') nota = !escena._diagClave ? 'El diagrama aparece cuando termina de cargar el modelo.' : `Sombras del ${fechaTexto(S.fecha)}. Se ven mejor desde arriba: botón «Planta».`;
  $('#ley-nota').textContent = nota; $('#ley-nota').hidden = !nota;
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
    if (c.dni != null && p.alt > 2) partes.push(`${Math.round(c.dni)} W/m² de sol directo (con cielo despejado, a esta altura, serían unos ${Math.round(dc)} W/m²)`);
    const ll = c.lluvia ?? 0;
    const txtLl = ll >= 0.1 ? `Llueven ${f1(ll)} mm en la hora: ${f1(ll)} litros por cada metro cuadrado. Desde unos 8 mm en una hora ya se considera lluvia fuerte.` : 'No llueve a esa hora.';
    return ['El tiempo de esa hora', `${partes.join(', ')}. ${txtLl} ${c.fuente === 'vivo' ? 'Es el pronóstico de modelo de Open-Meteo para ahora.' : 'Es el dato del reanálisis ERA5: un modelo alimentado con mediciones, para una celda de unos 28 km. Un aguacero muy local puede no aparecer.'}`];
  }
  if (k === 'tab-dia') return ['La regla del día', 'Es un día completo, de 00:00 a 24:00. El color es la luz del cielo; ↑ y ↓ marcan la salida y la puesta del sol, y la marca del centro, el mediodía solar. Las barras azules son la lluvia de cada hora y lo gris, las horas en que las nubes tapan el sol. Arrástrala para recorrer el día.'];
  if (k === 'tab-anio') return ['La regla del año', 'Cada punto es un día del año. La franja azul es la temporada de lluvias (mayo a noviembre), las dos líneas son los solsticios (21 de junio y 21 de diciembre) y los puntos dorados, los dos días sin sombra. Arrástrala para ver cómo cambia el recorrido del sol en el año.'];
  if (k === 'tab-decadas') return ['25 años de lluvia', 'Cada barra es la lluvia de un mes entre 2001 y 2025. Se ven los años secos y los muy lluviosos, y que casi toda la lluvia cae de mayo a noviembre. Arrástrala para recorrer los meses, o ▶ para pasarlos en 25 segundos; abajo están los extremos de la serie.'];
  return null;
}
function explicar(k) {
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
    { t: 'El norte y el recorrido del sol', txt: 'La rosa del suelo marca el norte real. El edificio no mira al norte: su eje largo gira 56°, así que sus cuatro fachadas miran al sureste, noroeste, noreste y suroeste. El arco dorado es el recorrido del sol hoy, con las horas marcadas.', dis: 'A 9° al norte del ecuador el sol pasa muy alto: casi encima al mediodía, todo el año.',
      ir: () => { volarA(VISTAS.aerea, 1.8, 'aerea', false); S.ayudas = true; $('#capa-ayudas').checked = true; } },
    { t: 'Un día en un minuto', txt: 'El sol sale por el este y se pone por el oeste. Mira cómo gira la sombra del edificio y cómo se acorta hacia el mediodía. Cuando el sol está alto, los aleros dejan las paredes y las ventanas en sombra.', dis: 'Eso hace un alero de 1,65 m en el trópico: con el sol alto, protege la pared.',
      ir: () => { volarA(VISTAS.esquina, 1.6, 'esquina', false); ponerLente('foto', false); ponerPestana('dia'); reproducir(); } },
    { t: '¿Qué fachada se calienta más?', txt: 'Con la forma de ver «Sol», cada fachada se pinta según el sol directo que recibe: azul es nada, rojo es mucho. A las 3:30 de la tarde, el testero suroeste lo recibe casi de frente.', dis: 'En un año, la sureste y la suroeste reciben más del doble de sol directo que la noroeste: son las que más protección piden.',
      ir: () => viajarA({ fecha: { y: 2024, m: 3, d: 25 }, min: 15 * 60 + 30, fachada: 'so', lente: 'sol' }) },
    { t: 'El día sin sombra', txt: `Dos veces al año, en abril y en agosto, el sol del mediodía pasa casi justo encima. Este año, el primero es el ${z.d} de ${MESES[z.m - 1]} a las ${hhmm(z.h * 60 + z.min)}: la sombra de un poste casi desaparece y la del edificio queda debajo de sus aleros.`, dis: 'Entre abril y agosto el sol del mediodía viene del norte: las fachadas que miran al norte también necesitan protección.',
      ir: () => viajarA({ fecha: { y, m: z.m, d: z.d }, min: z.h * 60 + z.min, vista: 'aerea', lente: 'foto' }) },
    { t: 'Las sombras de todo un día', txt: 'La forma de ver «Sombras» dibuja la sombra de cada hora sobre el terreno. El 21 de diciembre las sombras son las más largas del año y caen hacia el norte; en la tarde, el jardín noreste queda a la sombra del edificio.', dis: 'Sirve para decidir dónde poner un patio, una terraza o un árbol.',
      ir: () => viajarA({ fecha: { y, m: 12, d: 21 }, min: 15 * 60, vista: 'planta', lente: 'sombras' }) },
    { t: 'La lluvia', txt: 'Aquí llueven unos 2.000 mm al año, casi todo de mayo a noviembre y sobre todo en la tarde. Esta es la hora más lluviosa de 25 años de datos: 19 mm entre las 14:00 y las 15:00 del 1 de julio de 2023. Mira las cortinas de agua que caen de los tres aleros.', dis: 'Por eso los aleros anchos: alejan el agua de los muros y de las ventanas.',
      ir: () => viajarA({ fecha: { y: 2023, m: 7, d: 1 }, min: 14 * 60 + 30, vista: 'esquina', lente: 'foto' }) },
    { t: 'La lluvia con viento', txt: 'La forma de ver «Lluvia» muestra qué fachada se moja más cuando llueve con viento. En un año típico, la noroeste recibe más de cinco veces lo que el testero noreste.', dis: 'Dice dónde reforzar aleros, goterones, juntas y acabados.',
      ir: () => { S.aguaModo = 'anio'; viajarA({ fecha: { y: 2006, m: 11, d: 23 }, min: 10 * 60 + 30, fachada: 'no', lente: 'lluvia' }); } },
    { t: 'Ahora te toca', txt: 'Con «Ir a…» puedes ir a cualquier fecha desde 1940, o a los días extremos de la serie. Toca cualquier dato de abajo para saber qué significa, y cambia la forma de ver con Foto, Sol, Lluvia o Sombras.', dis: '«Para qué sirve» reúne los seis hallazgos principales, con sus límites.',
      ir: () => { S.aguaModo = 'hora'; irAAhora(true); ponerLente('foto', false); } },
  ];
}
function recorrido(i) {
  const P = S.pasos ?? (S.pasos = pasosRecorrido());
  if (i == null || i < 0 || i >= P.length) { S.paso = null; S.pasos = null; $('#recorrido').hidden = true; document.documentElement.classList.remove('en-recorrido'); if (S.reproduce) parar(); lastLect = ''; return; }
  S.paso = i; S.explica = null; parar();
  const q = P[i];
  $('#rec-n').textContent = `Paso ${i + 1} de ${P.length}`;
  $('#rec-t').textContent = q.t; $('#rec-txt').textContent = q.txt; $('#rec-dis').textContent = q.dis;
  $('#rec-prev').disabled = i === 0; $('#rec-sig').textContent = i === P.length - 1 ? 'Terminar' : 'Siguiente';
  $('#rec-puntos').innerHTML = P.map((_, j) => `<i class="${j === i ? 'hoy' : j < i ? 'ya' : ''}"></i>`).join('');
  $('#recorrido').hidden = false; document.documentElement.classList.add('en-recorrido');
  ['#sirve', '#ir-a', '#capas'].forEach((x) => { $(x).hidden = true; });
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
  sol({ t: 'Solsticio de junio', f: { y, m: 6, d: 21 }, min: 9 * 60, vista: 'planta', lente: 'sombras', v: `mediodía ${f1(mediodiaSolar(y, 6, 21).alt, 1)}° al N`, txt: 'El sol del mediodía pasa al norte del cenit: las sombras de la tarde caen hacia el sureste y el sur. Diagrama con el volumen del edificio, sin árboles ni vecinos.' });
  sol({ t: 'Solsticio de diciembre', f: { y, m: 12, d: 21 }, min: 9 * 60, vista: 'planta', lente: 'sombras', v: `mediodía ${f1(mediodiaSolar(y, 12, 21).alt, 1)}° al S`, txt: 'Las sombras más largas del año, hacia el norte: el jardín noreste recibe la sombra del edificio en la tarde.' });
  sol({ t: 'Equinoccio de marzo', f: { y, m: 3, d: 20 }, min: md({ y, m: 3, d: 20 }), vista: 'planta', lente: 'sombras', v: `mediodía ${f1(mediodiaSolar(y, 3, 20).alt, 1)}°`, txt: 'El sol sale por el este y se pone por el oeste: la punta de las sombras recorre una línea recta.' });
  const fa = g('Sol en fachadas');
  if (C) {
    const ds = C.diasSol[1] ?? C.diasSol[0], tE = C.tipicos[0], tJ = C.tipicos[5];
    fa({ t: 'Sol de la tarde en el testero SO', f: deISO(ds.fecha), min: 15 * 60 + 30, fachada: 'so', lente: 'sol', v: `${f1(ds.kwh, 2)} kWh/m²·día`, txt: `Uno de los días con más sol de la serie (${f1(ds.kwh, 2)} kWh/m²): a las 15:30 el sol da casi de frente al testero SO y el alero solo sombrea la parte alta de cada piso.` });
    fa({ t: 'Sol de la mañana en la entrada SE', f: deISO(tE.fecha), min: 7 * 60 + 45, fachada: 'se', lente: 'sol', v: 'día típico', txt: 'Un día típico de enero: el sol bajo de la mañana entra bajo el alero de la fachada principal. Pasa la regla a las 10:00 para ver el ángulo de corte.' });
    fa({ t: 'Sol del poniente en la NO (junio)', f: deISO(tJ.fecha), min: 17 * 60, fachada: 'no', lente: 'sol', v: 'día típico', txt: 'En junio el sol se pone por el oeste-noroeste y alcanza la fachada NO, que casi todo el año queda a la sombra. Suele estar nublado: mira el valor en W/m².' });
    const lv = g('Lluvia');
    const H = C.horasLluvia.map((q) => ({ f: deISO(q.fecha), min: q.hora * 60 - 30, v: `${f1(q.mm)} mm`, txt: `${fechaTexto(deISO(q.fecha))}, de ${hhmm(q.hora * 60 - 60)} a ${hhmm(q.hora * 60)}: ${f1(q.mm)} mm. Es el promedio de una celda de ~28 km: en el sitio pudo llover más.` }));
    lv({ t: 'La hora más lluviosa', ...H[0], vista: 'esquina', lente: 'foto', rank: H });
    const D = C.diasLluvia.map((q) => ({ f: deISO(q.fecha), min: q.hora * 60 - 30, v: `${q.mm} mm`, txt: `${fechaTexto(deISO(q.fecha))}: ${q.mm} mm en el día; la hora más fuerte, de ${hhmm(q.hora * 60 - 60)} a ${hhmm(q.hora * 60)} (${f1(q.pico)} mm).` }));
    lv({ t: 'El día más lluvioso', ...D[0], vista: 'esquina', lente: 'foto', rank: D });
    const W = C.lluviaViento.no.max, orden = Object.entries(C.lluviaViento).sort((a, b) => b[1].anual - a[1].anual).map(([k, v]) => `${k.toUpperCase()} ${v.anual}`).join(' · ');
    lv({ t: 'La fachada que más se moja', f: deISO(W.fecha), min: W.hora * 60 - 30, fachada: 'no', lente: 'lluvia', v: `NO · ${Math.round(C.lluviaViento.no.anual)} L/m²·año`,
      txt: `Índice anual de lluvia con viento (L/m²): ${orden}. Aquí, su hora más fuerte: ${f1(W.mm)} mm con viento de ${W.viento} km/h que llega casi de frente. Ordena fachadas; no mide el agua sobre el muro.` });
    const R = C.rachaSeca;
    lv({ t: 'La sequía más larga', f: deISO(R.hasta), min: 15 * 60, vista: 'aerea', lente: 'foto', v: `${R.dias} días`, txt: `${R.dias} días seguidos con menos de 1 mm, del ${fechaTexto(deISO(R.desde))} al ${fechaTexto(deISO(R.hasta))}. Referencia para el riego del jardín o una cisterna de agua lluvia.` });
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
function pintarConsultas() {
  const ul = $('#consultas'); if (!ul) return;
  const L = listaConsultas(); S.listaConsultas = L;
  let html = '', grupo = '';
  L.forEach((it, i) => {
    if (it.grupo !== grupo) { if (grupo) html += '</ul></section>'; grupo = it.grupo; html += `<section class="c-grupo" data-g="${grupo === 'Lluvia' ? 'lluvia' : 'sol'}"><h4>${grupo}</h4><ul>`; }
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

globalThis.__e106 = { S, DIAG, get escena() { return escena; }, get intro() { return intro; }, clima, rescatar };
arrancar();
