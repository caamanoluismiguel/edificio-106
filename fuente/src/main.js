// Un edificio a 9° N — v2: un solo instrumento. El gemelo se arma solo al abrir, queda en "Ahora"
// (sol calculado y tiempo real) y una máquina del tiempo recorre el día, el año y los últimos 25 años.
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Escena, U, GRUPOS } from './escena.js';
import { Sonido } from './sonido.js';
import { puntosIntro } from './datos.js';
import { posicionSol, vectorSol, diasCeroSombra, saleYPone, sombraPoste, rumboTexto, FACHADAS, incidencia, dniDespejado, mediodiaSolar } from './sol.js';
import { Clima } from './clima.js';

const $ = (s) => document.querySelector(s);
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
};
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
  try { escena = await new Escena($('#lienzo'), q).init(/[?&]webgl/.test(location.search) || location.hash === '#medir-gl'); }
  catch (e) {
    try { escena = await new Escena($('#lienzo'), { ...q, nivel: 'medio', sombras: 2048, bloom: false }).init(true); }
    catch (e2) { estadoCarga('Este navegador no puede mostrar la escena 3D. Prueba con Chrome, Edge o Safari actualizados.'); return; }
  }
  document.documentElement.dataset.backend = escena.backend;
  $('#motor').textContent = escena.backend;
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
  clima.cargarResumen(BASE + 'datos/clima_resumen.json').then((ok) => { if (ok) { dibujarDecadas(); pintarMomentos(); } });
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
  const h = location.hash.replace('#', '');
  if (FACHADAS[h]) irAFachada(h);
  irAMomentoHash();
}

/** Enlace directo a un momento: #m-AAAAMMDD-HHMM (p. ej. #m-20240724-1745). */
function irAMomentoHash() {
  const r = /^#m-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(location.hash); if (!r) return false;
  const [, y, mo, d, hh, mi] = r.map(Number);
  parar(); explorar(); S.momento = null; S.mesSerie = null; S.fecha = { y, m: mo, d }; S.min = hh * 60 + mi; S.salto = true;
  if (S.pestana !== 'dia') ponerPestana('dia');
  lastLect = ''; return true;
}

// ---------------- Cámara ----------------
function volarA(v, dur = 1.6) {
  const p0 = escena.camera.position.clone(), t0 = controls.target.clone();
  cam.anim = { p0, t0, p1: new THREE.Vector3(...v.pos), t1: new THREE.Vector3(...v.tgt), k: 0, dur: reduce ? 0.01 : dur };
  controls.enabled = false;
}
function pasoCamara(dt) {
  const a = cam.anim; if (!a) return false;
  a.k = Math.min(1, a.k + dt / a.dur); const e = eio(a.k);
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
  if (controls.target.distanceTo(new THREE.Vector3(...CENTRO)) > 2) deslizar = { t0: controls.target.clone(), k: 0 };
}

// ---------------- Clima en la fecha y hora elegidas ----------------
function climaEn(f, min) {
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
  if (S.midiendo) { S.midiendo.tFrame = performance.now(); S.midiendo.giro(); escena.renderer.info.reset(); }
  const dtReal = Math.min(0.25, (now - last) / 1000), dt = Math.min(0.05, dtReal); last = now;
  if (intro) { pasoIntro(dtReal); (S.dtIntro ??= []).push(now - (S.lastIntro ?? now)); S.lastIntro = now; }  // la intro sigue el reloj real
  else if (S.modo === 'ahora') { const a = ahoraPanama(); S.fecha = { y: a.y, m: a.m, d: a.d }; S.min = a.min; }
  if (S.reproduce) pasoReproducir(dt);
  const moviendo = pasoCamara(dtReal);
  if (!moviendo && !intro) {
    if (deslizar) { deslizar.k = Math.min(1, deslizar.k + dtReal / 0.9); controls.target.lerpVectors(deslizar.t0, new THREE.Vector3(...CENTRO), eio(deslizar.k)); if (deslizar.k >= 1) deslizar = null; }
    // la cámara no baja del nivel de los ojos: el ángulo máximo depende de la distancia
    const d = escena.camera.position.distanceTo(controls.target);
    controls.maxPolarAngle = Math.acos(THREE.MathUtils.clamp((1.4 - controls.target.y) / d, -1, 1));
    controls.update(dt);
  }

  // sol
  const p = posicionSol({ ...S.fecha, h: 0, min: S.min });
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
  escena.setRuta(S.fecha);
  // lluvia: la de los datos (o la del mes en el paso de 25 años), o el aguacero de la capa
  let objetivo = c ? (c.fuente === 'mes' ? Math.min(1, (c.lluviaMes ?? 0) / 380) : intensidad(c.lluvia ?? 0)) : 0;
  if (S.aguacero) objetivo = 1;
  if (intro) objetivo = 0;
  lluviaSuave += (objetivo - lluviaSuave) * (salto ? 1 : Math.min(1, dt * 1.4));
  U.lluvia.value = lluviaSuave; escena.lv = Math.min(1, lluviaSuave * 1.1);
  U.mojado.value += ((lluviaSuave > 0.08 ? 1 : 0) - U.mojado.value) * (salto ? 1 : Math.min(1, dt * (lluviaSuave > 0.08 ? 0.35 : 0.05)));
  if (c?.viento != null && c?.dir != null) { const w = vectorSol(0, (c.dir + 180) % 360); const k = 0.4 + c.viento / 12; U.viento.value.set(w.x * k, w.z * k); }
  if (escena.actualizar(dt)) sonido.trueno();
  U.calor.value += ((S.calor ? 1 : 0) - U.calor.value) * Math.min(1, dt * 4);
  actualizarCalor(p, c);
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
    [U.build.value * 500, U.mat.value * 200, S.min * 4, nubesSuave * 4, (S.kSol ?? 1) * 200, U.calor.value * 100, U.mojado.value * 200, escena.uRosa.value * 100, escena.uRuta.value * 100].map(Math.round).join(',') +
    `|${S.fecha.y}-${S.fecha.m}-${S.fecha.d}|${innerWidth}x${innerHeight}`;
  const anima = !!intro || !!escena.particulas || U.lluvia.value > 0.01 || U.relampago.value > 0 || !!S.midiendo;
  if (firma !== S.firma || anima || escena.sucio || now - (S.ultimoCambio || 0) < 500) {
    if (firma !== S.firma) { S.firma = firma; S.ultimoCambio = now; }
    escena.render();
    if (S.midiendo) { const r0 = performance.now(); S.midiendo.cpu.push(r0 - S.midiendo.tFrame); S.midiendo.dts.push(now - S.midiendo.last); S.midiendo.last = now; }
    else {
      S.cuadros = (S.cuadros || 0) + 1; S.msAcum = (S.msAcum || 0) + dt * 1000;
      if (S.cuadros >= 40) { escena.ajustarResolucion(S.msAcum / S.cuadros); S.cuadros = 0; S.msAcum = 0; }
    }
  } else { S.cuadros = 0; S.msAcum = 0; }
  requestAnimationFrame(bucle);
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
  if (kf !== S.kf) { S.kf = kf; dibujarReglas(); }
  const key = [kf, Math.round(S.min), S.modo, S.pestana, S.mesSerie, c?.fuente, Math.round((c?.temp ?? 0) * 10), Math.round(c?.nubes ?? -1), Math.round((c?.lluvia ?? 0) * 10), Math.round((c?.dni ?? 0) / 10), S.fachada].join('|');
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
  if (c) {
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
  explorar(); parar(); S.fecha = { y, m: mo, d }; S.min = /^hora-lluvia|^dia/.test(m.id) ? m.hora * 60 - 30 : m.hora * 60;
  const esMes = /^mes/.test(m.id), esAnio = /^anio/.test(m.id);
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
  parar(); S.modo = 'ahora'; S.mesSerie = null; S.momento = null; S.aguacero = false; $('#capa-aguacero').checked = false;
  const a = ahoraPanama(); S.fecha = { y: a.y, m: a.m, d: a.d }; S.min = a.min;
  if (volar && !S.fachada) volarA(VISTAS.esquina);
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
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => ponerPestana(b.dataset.tab)));
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
    const [y, mo, dd] = d.fecha.split('-').map(Number), [hh, mi] = d.hora.split(':').map(Number);
    parar(); explorar(); S.momento = null; S.mesSerie = null; S.fachada = null; document.documentElement.classList.remove('en-fachada');
    S.aguacero = false; $('#capa-aguacero').checked = false;
    S.calor = d.capa === 'calor'; $('#capa-calor').checked = S.calor;
    S.fecha = { y, m: mo, d: dd }; S.min = hh * 60 + mi;
    if (S.pestana !== 'dia') ponerPestana('dia');
    volarA(d.fachada ? VISTA_FACHADA['fachada-' + d.fachada] : VISTAS[d.vista || 'esquina']);
    if (innerWidth <= 760) abrirSirve(false);
    S.salto = true; lastLect = '';
  }));
  // ir a un momento exacto (p. ej. para comparar con una foto)
  const abrirIr = (abrir) => {
    $('#ir-a').hidden = !abrir; $('#elegir').setAttribute('aria-expanded', String(abrir));
    if (abrir) {
      $('#ir-fecha').value = `${S.fecha.y}-${String(S.fecha.m).padStart(2, '0')}-${String(S.fecha.d).padStart(2, '0')}`;
      $('#ir-hora').value = hhmm(S.min); $('#ir-fecha').focus();
    }
  };
  $('#elegir').addEventListener('click', () => abrirIr($('#ir-a').hidden));
  $('#cerrar-ir').addEventListener('click', () => abrirIr(false));
  $('#ir-a').addEventListener('submit', (e) => {
    e.preventDefault();
    const [y, mo, d] = $('#ir-fecha').value.split('-').map(Number), [hh, mi] = $('#ir-hora').value.split(':').map(Number);
    if (!y || !mo || !d || isNaN(hh)) return;
    parar(); explorar(); S.momento = null; S.mesSerie = null; S.aguacero = false; $('#capa-aguacero').checked = false;
    S.fecha = { y, m: mo, d }; S.min = hh * 60 + (mi || 0);
    if (S.pestana === 'decadas') ponerPestana('dia');
    S.salto = true; abrirIr(false); lastLect = '';
  });
  $('#abrir-capas').addEventListener('click', () => { const c = $('#capas'), abrir = c.hidden; c.hidden = !abrir; $('#abrir-capas').setAttribute('aria-expanded', String(abrir)); });
  $('#capa-calor').addEventListener('change', (e) => { S.calor = e.target.checked; });
  $('#capa-aguacero').addEventListener('change', (e) => { S.aguacero = e.target.checked; });
  $('#capa-ayudas').addEventListener('change', (e) => { S.ayudas = e.target.checked; });
  document.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => { S.fachada = null; document.documentElement.classList.remove('en-fachada'); volarA(VISTAS[b.dataset.vista]); }));
  $('#brujula').addEventListener('click', () => volarA(VISTAS.planta));
  document.querySelectorAll('[data-ir-fachada]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); irAFachada(a.dataset.irFachada); }));
  $('#salir-fachada').addEventListener('click', () => { S.fachada = null; document.documentElement.classList.remove('en-fachada'); history.replaceState(null, '', location.pathname + location.search); volarA(VISTAS.esquina); });
  addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (intro) return; if (FACHADAS[h]) irAFachada(h); else irAMomentoHash(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('#sirve').hidden = true; $('#abrir-sirve').setAttribute('aria-expanded', 'false'); $('#capas').hidden = true; $('#abrir-capas').setAttribute('aria-expanded', 'false'); $('#ir-a').hidden = true; $('#elegir').setAttribute('aria-expanded', 'false'); } });
  // la primera interacción despierta el audio si el visitante ya pidió sonido
  const d = diasCeroSombra(hoy.y);
  $('#cenit-txt').textContent = `A 9° N el sol pasa casi por el cenit dos veces al año: en ${hoy.y}, el ${d[0].d} de ${MESES[d[0].m - 1]} y el ${d[1].d} de ${MESES[d[1].m - 1]}, hacia las ${hhmm(d[0].h * 60 + d[0].min)}. Ese mediodía, un poste casi no hace sombra.`;
}

function irAFachada(k) {
  const f = FACHADAS[k]; if (!f) return;
  S.fachada = k; irAAhora(false);
  volarA(VISTA_FACHADA[k]);
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

function refrescar() { lastLect = ''; }

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
  const d = document.createElement('pre');
  d.style.cssText = 'position:fixed;left:8px;top:70px;z-index:99;background:#000c;color:#9f9;font:11px/1.3 monospace;padding:6px 8px;max-width:60vw;max-height:40vh;overflow:auto;margin:0;pointer-events:none';
  document.body.appendChild(d); const errs = [];
  addEventListener('error', (e) => errs.push(e.message)); addEventListener('unhandledrejection', (e) => errs.push(String(e.reason)));
  let n = 0, t0 = performance.now();
  const f = () => { n++; const t = performance.now(); if (t - t0 > 1000) { const i = escena.renderer.info; d.textContent = `${escena.backend} · ${Math.round(n * 1000 / (t - t0))} fps · dpr ${escena.renderer.getPixelRatio().toFixed(2)} · ${Math.round(innerWidth * innerHeight * escena.renderer.getPixelRatio() ** 2 / 1e5) / 10} MP · tris ${Math.round((i.render?.triangles ?? 0) / 1e3)}k · sol ${f1(escena.alt ?? 0)}° · modo ${S.modo} · listos ${[...(escena.listos ?? [])].length}\n` + errs.slice(-8).join('\n'); n = 0; t0 = t; } requestAnimationFrame(f); };
  f();
}

globalThis.__e106 = { S, get escena() { return escena; }, get intro() { return intro; }, clima };
arrancar();
