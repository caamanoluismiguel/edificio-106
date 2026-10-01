// Prueba de la AR sin celular: Chromium con una cámara falsa que muestra la tarjeta en perspectiva.
// Comprueba que MindAR encuentra el plano, que el edificio se dibuja encima, que el sol apunta igual que en sol.js
// (pasado al papel por un camino independiente), el peso del modelo y que no hay errores en la consola.
// También prueba los controles de la versión de clase (fecha, hora, persona, norte, lente Sol, escala, enlace al visor,
// pestaña oculta), el aviso para los navegadores de WhatsApp, Instagram, Facebook y TikTok, y el modo sin cámara.
// Uso: node ar/probar.mjs --video=tarjeta-camara.y4m [--captura=salida.png] [--capturas=carpeta] [--url=suave=0]
//      node ar/probar.mjs --navegador=webkit [--capturas=carpeta]   (WebKit de Playwright con el perfil de un iPhone 13:
//      no tiene cámara falsa, así que prueba el inicio, el aviso y el modo sin cámara; no es un iPhone de verdad)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { servir } from './generar-tarjeta.mjs';
import { posicionSol, diasCeroSombra } from './sol.js';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pw = createRequire(path.join(raiz, 'fuente', 'package.json'))('playwright');
const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const WEBKIT = arg('navegador') === 'webkit';
const video = arg('video'); if (!video && !WEBKIT) { console.log('falta --video=…y4m'); process.exit(2); }
const captura = arg('captura'), capturas = arg('capturas');
if (capturas) fs.mkdirSync(capturas, { recursive: true });
const foto = async (p, nombre) => { if (capturas) await p.screenshot({ path: path.join(capturas, nombre) }); };
let ok = true;
const res = (pasa, txt) => { console.log(`${pasa ? '✓' : '✗'} ${txt}`); if (!pasa) ok = false; };
const NORTE = 90 - 56;                                     // giro del norte en el papel (el de la flecha de la tarjeta: 90° − EJE_LARGO)
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const EN_APP = { WhatsApp: UA_IPHONE + ' WhatsApp/24.10.75', Instagram: UA_IPHONE + ' Instagram 330.0.0.0.0 (iPhone14,5; iOS 17_5)',
  Facebook: UA_IPHONE + ' [FBAN/FBIOS;FBAV/460.0.0.0]', TikTok: UA_IPHONE + ' musical_ly_34.0.0 BytedanceWebview/d8a21c6' };

// 1. peso: lo que baja el celular para ver la AR
const MB = f => fs.statSync(path.join(raiz, 'ar', f)).size / 1048576;
const glb = fs.readdirSync(path.join(raiz, 'ar', 'modelo')).reduce((s, f) => s + MB('modelo/' + f), 0);
const total = glb + MB('tarjeta/plano.mind') + ['three.module.js', 'three.core.js'].reduce((s, f) => s + MB('vendor/three/' + f), 0)
  + ['mindar-image.prod.js', 'controller-mGt1s8dJ.js', 'ui-fBadYuor.js'].reduce((s, f) => s + MB('vendor/mindar/' + f), 0);
res(glb <= 2.5, `modelo ${glb.toFixed(2)} MB (meta ≤ 2,5 MB); descarga total sin comprimir ${total.toFixed(1)} MB (sin cámara suma el plano, ${MB('tarjeta/plano.png').toFixed(1)} MB)`);

/** Fracción de píxeles distintos entre dos capturas (en el navegador, a 320 × 180, para no depender de una librería). */
async function difFrac(p, a, b) {
  return p.evaluate(async ([a, b]) => {
    const leer = async s => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode();
      const g = document.createElement('canvas'); g.width = 320; g.height = 180; const x = g.getContext('2d'); x.drawImage(i, 0, 0, 320, 180); return x.getImageData(0, 0, 320, 180).data; };
    const [da, db] = await Promise.all([leer(a), leer(b)]); let n = 0;
    for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) n++;
    return n / (320 * 180);
  }, [a, b]);
}
/** Fracción de píxeles parecidos a alguno de los colores dados (para ver que la lente pinta con su paleta). */
async function fracColores(p, png, colores) {
  return p.evaluate(async ([s, cs]) => {
    const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode();
    const g = document.createElement('canvas'); g.width = 320; g.height = 180; const x = g.getContext('2d'); x.drawImage(i, 0, 0, 320, 180);
    const d = x.getImageData(0, 0, 320, 180).data, rgb = cs.map(c => [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16))); let n = 0;
    for (let j = 0; j < d.length; j += 4) if (rgb.some(c => Math.abs(d[j] - c[0]) + Math.abs(d[j + 1] - c[1]) + Math.abs(d[j + 2] - c[2]) < 40)) n++;
    return n / (320 * 180);
  }, [png, colores]);
}
const png = async p => (await p.screenshot()).toString('base64');
const ponerHora = (p, m) => p.evaluate(m => { const r = document.getElementById('hora'); r.value = m; r.dispatchEvent(new Event('input')); }, m);
/** Cuánto cubre la capa 3D: la pantalla con y sin el lienzo. */
async function cobertura(p) {
  const con = await png(p);
  await p.evaluate(() => { document.querySelector('#ar canvas').style.visibility = 'hidden'; });
  const sin = await png(p);
  await p.evaluate(() => { document.querySelector('#ar canvas').style.visibility = ''; });
  return difFrac(p, con, sin);
}
const espera = ms => new Promise(r => setTimeout(r, ms));
// dos capturas seguidas sin cambiar nada: el ruido de fondo (la cámara falsa se mueve un poco, el filtro se asienta)
async function ruido(p) { const a = await png(p); await espera(250); return difFrac(p, a, await png(p)); }

/** Los controles de la versión de clase. Valen igual con la cámara (AR) y sin ella. */
async function probarControles(p, modo) {
  const pre = `[${modo}]`;
  const altos = await p.evaluate(() => ['#fecha', '#hora', ...[...document.querySelectorAll('.herramientas > *')].map((_, i) => `.herramientas > :nth-child(${i + 1})`)]
    .map(q => document.querySelector(q).getBoundingClientRect().height));
  res(altos.every(h => h >= 44), `${pre} controles tocables: fecha, hora y ${altos.length - 2} botones de ${Math.min(...altos).toFixed(0)} px de alto o más (≥ 44)`);
  const est = () => p.evaluate(() => { const { medir, fechas, camara, ...e } = window.__ar; return { ...e, fechas, medida: medir() }; });
  let e = await est();
  // fechas clave: calculadas con sol.js para el año de hoy
  const y = e.fechas[0].y, F = Object.fromEntries(e.fechas.map((f, i) => [f.clave, { ...f, i }]));
  const decl = f => posicionSol({ y, m: f.m, d: f.d, h: 12 }).decl, z = diasCeroSombra(y);
  const okF = Math.abs(decl(F['equinoccio-mar'])) < 0.5 && Math.abs(decl(F['equinoccio-sep'])) < 0.5 && decl(F['solsticio-jun']) > 23.2 && decl(F['solsticio-dic']) < -23.2
    && F['sin-sombra-abr'].d === z[0].d && F['sin-sombra-ago'].d === z[1].d && F['sin-sombra-abr'].m === 4 && F['sin-sombra-ago'].m === 8;
  res(okF && e.fechas.length === 7, `${pre} fechas de ${y}: ` + e.fechas.slice(1).map(f => `${f.clave} ${f.d}/${f.m}`).join(', '));

  // la fecha mueve el sol, igual que sol.js; el día sin sombra va al mediodía solar con el sol casi en el cenit
  await ponerHora(p, 900);
  const dirHoy = (await est()).sol.dir;
  let peor = 0, minAng = 180;
  for (const c of ['equinoccio-mar', 'solsticio-jun', 'equinoccio-sep', 'solsticio-dic']) {
    await p.selectOption('#fecha', String(F[c].i));
    const s = (await est()).sol, ref = posicionSol({ y, m: F[c].m, d: F[c].d, h: 0, min: s.min });
    const azPapel = Math.atan2(s.dir[0], -s.dir[2]) * 180 / Math.PI;
    peor = Math.max(peor, Math.abs(((azPapel - (ref.az + NORTE)) % 360 + 540) % 360 - 180), Math.abs(Math.asin(s.dir[1]) * 180 / Math.PI - ref.alt));
    if (c.startsWith('solsticio')) minAng = Math.min(minAng, Math.acos(Math.min(1, s.dir.reduce((t, v, k) => t + v * dirHoy[k], 0))) * 180 / Math.PI);
  }
  res(peor < 0.1 && minAng > 5, `${pre} la fecha mueve el sol: en los solsticios a las 15:00 cambia ≥ ${minAng.toFixed(1)}° respecto de hoy; contra sol.js difiere ${peor.toFixed(3)}°`);
  await p.selectOption('#fecha', String(F['sin-sombra-abr'].i));
  let s = (await est()).sol;
  res(s.alt > 89.5 && s.min === z[0].h * 60 + z[0].min, `${pre} día sin sombra de abril (${z[0].d}/4): va a las ${Math.floor(s.min / 60)}:${String(s.min % 60).padStart(2, '0')}, sol a ${s.alt.toFixed(2)}° de altura`);
  await p.selectOption('#fecha', '0');

  // la hora mueve la sombra
  await ponerHora(p, 8 * 60); await espera(300); const a8 = await png(p);
  await ponerHora(p, 16 * 60); await espera(300); const a16 = await png(p);
  const r0 = await ruido(p), dh = await difFrac(p, a8, a16);
  res(dh > 0.01 && dh > 3 * r0, `${pre} la hora mueve la sombra: de 8:00 a 16:00 cambia ${(dh * 100).toFixed(1)} % de la pantalla (ruido ${(r0 * 100).toFixed(1)} %)`);

  // la lente Sol pinta las paredes con sus franjas y muestra la leyenda (a las 9:00 el sol da en la fachada sureste,
  // la que mira a la cámara). El techo queda en gris y la cámara falsa mira casi desde arriba: las paredes son ~1 % de la pantalla
  await ponerHora(p, 9 * 60); await espera(300);
  const sinL = await png(p);
  await p.click('#b-sol'); await espera(400);
  const conL = await png(p);
  const FR = ['#d2401c', '#ef8a1f', '#f8d23a'], TODAS = ['#22305e', '#8e2a3c', ...FR];
  const fSin = await fracColores(p, sinL, FR), fCon = await fracColores(p, conL, FR), dl = await difFrac(p, sinL, conL);
  const tSin = await fracColores(p, sinL, TODAS), tCon = await fracColores(p, conL, TODAS);
  e = await est();
  const ley = await p.isVisible('#leyenda');
  res(e.lente && ley && dl > 0.02 && tCon > 0.005 && tCon > 5 * tSin + 0.001 && fCon > 0.002 && fCon > 5 * fSin + 0.001,
    `${pre} la lente Sol pinta: cambia ${(dl * 100).toFixed(1)} % de la pantalla; colores de la lente ${(tSin * 100).toFixed(1)} % → ${(tCon * 100).toFixed(1)} %, de ellos con sol directo ${(fSin * 100).toFixed(1)} % → ${(fCon * 100).toFixed(1)} %; leyenda ${ley ? 'visible' : 'oculta'}`);
  const visorSol = e.visor;
  await p.click('#b-sol'); await espera(300);
  e = await est();
  res(!e.lente && !(await p.isVisible('#leyenda')), `${pre} la lente Sol se apaga`);

  // persona y norte
  await p.click('#b-persona'); await p.click('#b-norte'); await espera(300);
  e = await est();
  res(e.persona && Math.abs(e.medida.persona - 1.7) < 0.01, `${pre} persona: mide ${e.medida.persona.toFixed(3)} m en la escena (a 1:320, ${(e.medida.persona * 1000 / 320).toFixed(1)} mm sobre el papel)`);
  res(e.norte && Math.abs(e.medida.norte - NORTE) < 0.1 && Math.abs(e.medida.nortePapel - NORTE) < 0.1, `${pre} norte: la flecha gira ${e.medida.norte.toFixed(2)}° (la de la tarjeta, ${NORTE}°)`);

  // escala: el modelo crece alrededor del centro
  const t320 = e.medida.modelo, c320 = await cobertura(p);
  await p.click('#b-escala'); await p.click('#b-escala'); await espera(400);
  e = await est();
  const t100 = e.medida.modelo, c100 = await cobertura(p), k = t100[0] / t320[0];
  res(e.escala === 100 && Math.abs(k - 3.2) < 0.01 && Math.abs(t100[1] / t320[1] - 3.2) < 0.01 && c100 > c320 * 1.3 && await p.isVisible('#escala-nota'),
    `${pre} escala 1:100: el modelo crece ${k.toFixed(3)} veces (meta 3,2) y cubre ${(c320 * 100).toFixed(0)} % → ${(c100 * 100).toFixed(0)} % de la pantalla`);
  await foto(p, `${modo}-1a100.png`);
  await p.click('#b-escala'); await espera(200);
  res((await est()).escala === 320, `${pre} el botón vuelve a 1:320`);

  // enlace al visor con el mismo momento
  await ponerHora(p, 14 * 60 + 30);
  e = await est();
  const hoy = e.fechas[0], fx = `${hoy.y}${String(hoy.m).padStart(2, '0')}${String(hoy.d).padStart(2, '0')}`;
  res(e.visor === `../#m-${fx}-1430&vista=aerea` && /^\.\.\/#m-\d{8}-\d{4}&lente=sol&modo=directa&vista=aerea$/.test(visorSol) && (await p.getAttribute('#b-visor', 'href')) === e.visor,
    `${pre} enlace al visor: ${e.visor} (con la lente: ${visorSol})`);

  // pestaña oculta: se para todo; al volver, sigue
  const vis = h => p.evaluate(h => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, h);
  const cuenta = () => p.evaluate(() => ({ c: window.__ar.cuadros, pr: window.__ar.procesados ?? 0, pausado: window.__ar.pausado, v: document.querySelector('#ar video')?.paused ?? null }));
  const r1 = await cuenta(); await espera(1000); const r2 = await cuenta();
  await vis(true); await espera(300); const h1 = await cuenta(); await espera(1000); const h2 = await cuenta();
  res(h1.pausado && h2.c === h1.c && h2.pr === h1.pr && (modo !== 'ar' || h2.v === true),
    `${pre} pestaña oculta: en 1 s, ${h2.c - h1.c} cuadros y ${h2.pr - h1.pr} vueltas de MindAR (antes ${r2.c - r1.c} y ${r2.pr - r1.pr})${modo === 'ar' ? ', video en pausa' : ''}`);
  await vis(false);
  await p.waitForFunction(() => !window.__ar.pausado, null, { timeout: 5000 });
  if (modo === 'ar') await p.waitForFunction(() => window.__ar.encontrado, null, { timeout: 20000 }).catch(() => {});
  await espera(1500);
  const v1 = await cuenta(); await espera(1000); const v2 = await cuenta();
  const vueltas = v2.pr - v1.pr, antes = r2.pr - r1.pr;
  res(!v2.pausado && v2.c - v1.c >= 15 && (modo !== 'ar' || ((await est()).encontrado && vueltas > 0 && vueltas <= antes * 1.5 + 2)),
    `${pre} al volver sigue: ${v2.c - v1.c} cuadros por segundo` + (modo === 'ar' ? `, ${vueltas} vueltas de MindAR por segundo (antes ${antes}: una sola, no dos), plano encontrado otra vez` : ''));
  // se deja como estaba: persona y norte apagados
  await p.click('#b-persona'); await p.click('#b-norte');
}

const { srv, url } = await servir(raiz);
const motor = WEBKIT ? pw.webkit : pw.chromium;
const opciones = WEBKIT ? {} : { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', ...(video ? [`--use-file-for-fake-video-capture=${path.resolve(video)}`] : []), '--use-angle=metal', '--ignore-gpu-blocklist'] };
const nav = await motor.launch(opciones);
const errores = [];
const vigilar = (p, nombre) => {
  p.on('pageerror', e => errores.push(`${nombre}: ${e}`));
  p.on('console', m => { if (m.type() === 'error') errores.push(`${nombre}: ${m.text()}`); });
};
const movil = WEBKIT ? { ...pw.devices['iPhone 13'] } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA_IPHONE };
try {
  // 2. pantalla de inicio y aviso para los navegadores dentro de una aplicación
  {
    const ctx = await nav.newContext(movil);
    const p = await ctx.newPage(); vigilar(p, 'inicio');
    await p.goto(`${url}/ar/`); await p.waitForFunction(() => window.__ar);
    const sinAviso = !(await p.isVisible('#en-app'));
    const tam = await p.evaluate(() => [...document.querySelectorAll('.botones button')].map(b => b.getBoundingClientRect().height));
    res(sinAviso && tam.every(h => h >= 44), `inicio: sin aviso de aplicación en ${WEBKIT ? 'WebKit (iPhone 13)' : 'un navegador común'}; botones de ${tam.map(h => h.toFixed(0)).join(' y ')} px de alto (≥ 44)`);
    await foto(p, 'inicio.png');
    await ctx.close();
    for (const [app, ua] of Object.entries(EN_APP)) {
      const c = await nav.newContext({ ...movil, userAgent: ua, ...(WEBKIT ? {} : { permissions: ['clipboard-read', 'clipboard-write'] }) });
      const q = await c.newPage(); vigilar(q, app);
      await q.goto(`${url}/ar/?desde=prueba`); await q.waitForFunction(() => window.__ar);
      const visto = await q.isVisible('#en-app'), txt = await q.textContent('#en-app');
      await q.click('#copiar'); await espera(200);
      const copiado = WEBKIT ? await q.isVisible('#copiado') : (await q.evaluate(() => navigator.clipboard.readText().catch(() => ''))) === `${url}/ar/?desde=prueba`;
      res(visto && txt.includes('Abre este enlace en Safari o Chrome') && txt.includes(app) && copiado, `aviso dentro de ${app}: ${visto ? 'visible' : 'NO aparece'}, copiar el enlace ${copiado ? 'funciona' : 'NO funciona'}`);
      if (app === 'Instagram') await foto(q, 'en-app.png');
      await c.close();
    }
  }

  // 3. la página con la cámara falsa (solo Chromium)
  if (!WEBKIT) {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 720 }, permissions: ['camera'] });
    const p = await ctx.newPage(); vigilar(p, 'AR');
    await p.goto(`${url}/ar/${arg('url') ? '?' + arg('url') : ''}`);
    // el deslizador arranca en la hora de ahora en Panamá (redondeada a 10 min) si es de día; si no, en las 15:00
    const ini = +(await p.inputValue('#hora'));
    const ya = new Date(Date.now() - 5 * 3600e3), minYa = Math.round((ya.getUTCHours() * 60 + ya.getUTCMinutes()) / 10) * 10;
    const esperado = minYa >= 360 && minYa <= 1080 ? minYa : 900;
    res(Math.abs(ini - esperado) <= 10, `el deslizador arranca en ${Math.floor(ini / 60)}:${String(ini % 60).padStart(2, '0')} (ahora en Panamá: ${ya.getUTCHours()}:${String(ya.getUTCMinutes()).padStart(2, '0')})`);
    await p.click('#empezar');
    const t0 = Date.now();
    const hallado = await p.waitForFunction(() => window.__ar.encontrado || window.__ar.fase === 'error', null, { timeout: 90000, polling: 200 }).then(() => true, () => false);
    const est = await p.evaluate(() => window.__ar);
    res(hallado && est.encontrado, `MindAR encuentra el plano (${((Date.now() - t0) / 1000).toFixed(1)} s, fase «${est.fase}»)`);

    if (est.encontrado) {
      await p.waitForTimeout(4000);                          // que el filtro se asiente: la deriva inicial no es temblor
      const c0 = await p.evaluate(() => window.__ar.cuadros); await p.waitForTimeout(3000);
      const e2 = await p.evaluate(() => window.__ar);
      const fps = (e2.cuadros - c0) / 3;
      res(fps >= 15 && fps <= 31, `fluidez en este Mac: ${fps.toFixed(0)} cuadros por segundo (tope 30; meta ≥ 15)`);
      // temblor: con la tarjeta quieta, el salto de la cámara de una medición a la siguiente (lo que el ojo ve como
      // temblor), en mm del papel real a 1:320 (1 m del modelo = 1000/320 mm; ESCALA de escena-ar.js). La deriva lenta mientras el filtro se asienta no cuenta.
      const cam = e2.camara.slice(-60), mm = 1000 / 320;
      let suma = 0; for (let i = 1; i < cam.length; i++) suma += (cam[i][0] - cam[i - 1][0]) ** 2 + (cam[i][1] - cam[i - 1][1]) ** 2 + (cam[i][2] - cam[i - 1][2]) ** 2;
      const salto = Math.sqrt(suma / (cam.length - 1)) * mm;
      const dist = Math.hypot(...[0, 1, 2].map(k => cam.reduce((s, c) => s + c[k], 0) / cam.length)) * mm;
      // vaivén: cuánto se pasea la cámara alrededor de su posición media en esos ~2 s (el temblor lento que se ve en el celular)
      const media = [0, 1, 2].map(k => cam.reduce((s, c) => s + c[k], 0) / cam.length);
      const vaiven = Math.sqrt(cam.reduce((s, c) => s + [0, 1, 2].reduce((t, k) => t + (c[k] - media[k]) ** 2, 0), 0) / cam.length) * mm;
      // solo informativo: el video sintético no reproduce el temblor de un celular real (con el estabilizador probado el
      // 2026-10-01 dio más vaivén que sin él, y de una corrida a otra varía). El temblor se juzga con un video del celular.
      console.log(`· temblor con la tarjeta quieta: ${salto.toFixed(2)} mm por cuadro y ${vaiven.toFixed(2)} mm de vaivén (cámara a ${dist.toFixed(0)} mm; informativo)`);
      res(e2.encontrado, `sigue rastreando después de 7 s (encontrado ${e2.vecesEncontrado} vez/veces)`);
      // ¿el edificio está dibujado encima del plano? se compara la pantalla con y sin la capa 3D (leer el lienzo WebGL
      // directamente da vacío después de dibujar), en el navegador mismo para no depender de una librería de imágenes
      const pix = await cobertura(p);
      res(pix > 0.08 && pix < 0.9, `el edificio cubre ${(pix * 100).toFixed(0)} % de la pantalla (entre 8 y 90 %)`);
      if (captura) await p.screenshot({ path: captura });

      // 4. el sol: la dirección de la luz pasada al papel tiene que dar el azimut de sol.js más el giro del norte
      // en el papel (34°, el mismo de la flecha de la tarjeta: 90° − EJE_LARGO), por un camino que no usa vectorSol
      for (const min of [7 * 60, 900, 17 * 60 + 30]) {
        await ponerHora(p, min);
        const s = await p.evaluate(() => window.__ar.sol);
        const hoy = new Date(Date.now() - 5 * 3600e3);
        const ref = posicionSol({ y: hoy.getUTCFullYear(), m: hoy.getUTCMonth() + 1, d: hoy.getUTCDate(), h: 0, min });
        // dir de la escena → papel: x → derecha, −z → arriba (matrizPapel); ángulo desde arriba, horario
        const azPapel = Math.atan2(s.dir[0], -s.dir[2]) * 180 / Math.PI;
        const dif = Math.abs(((azPapel - (ref.az + NORTE)) % 360 + 540) % 360 - 180);
        const dAlt = Math.abs(Math.asin(s.dir[1]) * 180 / Math.PI - ref.alt);
        res(dif < 0.1 && dAlt < 0.1, `sol a las ${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}: alt ${ref.alt.toFixed(1)}°, az ${ref.az.toFixed(1)}° · en el papel difiere ${dif.toFixed(3)}° y ${dAlt.toFixed(3)}°`);
      }

      // 5. los controles nuevos, con la cámara
      await probarControles(p, 'ar');
      if (capturas) {
        await ponerHora(p, 9 * 60);
        await p.click('#b-persona'); await p.click('#b-norte'); await p.click('#b-sol'); await espera(500);
        await foto(p, 'ar-persona-norte-sol.png');
        await p.click('#b-persona'); await p.click('#b-norte'); await p.click('#b-sol');
      }
    }
    await ctx.close();
  }

  // 6. sin cámara: el modelo sobre la tarjeta virtual
  {
    const ctx = await nav.newContext(WEBKIT ? movil : { viewport: { width: 1280, height: 720 } });
    const p = await ctx.newPage(); vigilar(p, 'sin cámara');
    await p.goto(`${url}/ar/`);
    await p.click('#sin-camara');
    const listo = await p.waitForFunction(() => window.__ar.fase === 'sin-camara' || window.__ar.fase === 'error', null, { timeout: 60000 }).then(() => true, () => false);
    const fase = await p.evaluate(() => window.__ar.fase);
    res(listo && fase === 'sin-camara', `sin cámara: la tarjeta virtual carga (fase «${fase}»)`);
    if (fase === 'sin-camara') {
      await espera(800);
      const cub = await cobertura(p);
      res(cub > 0.15, `sin cámara: la tarjeta y el edificio cubren ${(cub * 100).toFixed(0)} % de la pantalla`);
      // girar con el dedo (o el ratón): arrastrar cambia la vista
      const a = await png(p);
      const vp = p.viewportSize(), x0 = vp.width / 2, y0 = vp.height * 0.3;
      await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x0 + vp.width * 0.15, y0 + 30, { steps: 8 }); await p.mouse.up(); await espera(2500);   // que termine el giro amortiguado
      const dg = await difFrac(p, a, await png(p));
      res(dg > 0.05, `sin cámara: arrastrar gira la vista (cambia ${(dg * 100).toFixed(0)} % de la pantalla)`);
      await probarControles(p, 'sin-camara');
      if (capturas) {
        const m = await nav.newContext(movil), q = await m.newPage(); vigilar(q, 'sin cámara, celular');
        await q.goto(`${url}/ar/`); await q.click('#sin-camara');
        await q.waitForFunction(() => window.__ar.fase === 'sin-camara', null, { timeout: 60000 });
        await q.evaluate(() => { const r = document.getElementById('hora'); r.value = 540; r.dispatchEvent(new Event('input')); });
        await q.click('#b-persona'); await q.click('#b-norte'); await q.click('#b-sol'); await espera(800);
        await foto(q, 'sin-camara.png');
        await m.close();
      }
    }
    await ctx.close();
  }
} finally { await nav.close(); srv.close(); }
res(errores.length === 0, `sin errores en la consola${errores.length ? ':\n   ' + errores.slice(0, 5).join('\n   ') : ''}`);
console.log(ok ? 'AR: todo pasa' : 'AR: HAY FALLAS, no seguir');
process.exit(ok ? 0 : 1);
