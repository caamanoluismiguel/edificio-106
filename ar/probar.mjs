// Prueba de la AR sin celular: Chromium con una cámara falsa que muestra la tarjeta en perspectiva.
// Comprueba que MindAR encuentra el plano, que el edificio se dibuja encima, que el sol apunta igual que en sol.js
// (pasado al papel por un camino independiente), el peso del modelo y que no hay errores en la consola.
// Uso: node ar/probar.mjs --video=tarjeta-camara.y4m [--captura=salida.png]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { servir } from './generar-tarjeta.mjs';
import { posicionSol } from './sol.js';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'fuente', 'package.json'))('playwright');
const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const video = arg('video'); if (!video) { console.log('falta --video=…y4m'); process.exit(2); }
const captura = arg('captura');
let ok = true;
const res = (pasa, txt) => { console.log(`${pasa ? '✓' : '✗'} ${txt}`); if (!pasa) ok = false; };

// 1. peso: lo que baja el celular para ver la AR
const MB = f => fs.statSync(path.join(raiz, 'ar', f)).size / 1048576;
const glb = fs.readdirSync(path.join(raiz, 'ar', 'modelo')).reduce((s, f) => s + MB('modelo/' + f), 0);
const total = glb + MB('tarjeta/plano.mind') + ['three.module.js', 'three.core.js'].reduce((s, f) => s + MB('vendor/three/' + f), 0)
  + ['mindar-image.prod.js', 'controller-mGt1s8dJ.js', 'ui-fBadYuor.js'].reduce((s, f) => s + MB('vendor/mindar/' + f), 0);
res(glb <= 2.5, `modelo ${glb.toFixed(2)} MB (meta ≤ 2,5 MB); descarga total sin comprimir ${total.toFixed(1)} MB`);

// 2. la página con la cámara falsa
const { srv, url } = await servir(raiz);
const nav = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${path.resolve(video)}`, '--use-angle=metal', '--ignore-gpu-blocklist'] });
const errores = [];
try {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 720 }, permissions: ['camera'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => errores.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  await p.goto(`${url}/ar/`);
  await p.click('#empezar');
  const t0 = Date.now();
  const hallado = await p.waitForFunction(() => window.__ar.encontrado || window.__ar.fase === 'error', null, { timeout: 90000, polling: 200 }).then(() => true, () => false);
  const est = await p.evaluate(() => window.__ar);
  res(hallado && est.encontrado, `MindAR encuentra el plano (${((Date.now() - t0) / 1000).toFixed(1)} s, fase «${est.fase}»)`);

  if (est.encontrado) {
    const c0 = await p.evaluate(() => window.__ar.cuadros); await p.waitForTimeout(3000);
    const e2 = await p.evaluate(() => window.__ar);
    const fps = (e2.cuadros - c0) / 3;
    res(fps >= 15, `fluidez en este Mac: ${fps.toFixed(0)} cuadros por segundo (tope 30; meta ≥ 15)`);
    res(e2.encontrado, `sigue rastreando después de 3 s (encontrado ${e2.vecesEncontrado} vez/veces)`);
    // ¿el edificio está dibujado encima del plano? se compara la pantalla con y sin la capa 3D (leer el lienzo WebGL
    // directamente da vacío después de dibujar), en el navegador mismo para no depender de una librería de imágenes
    const con = (await p.screenshot()).toString('base64');
    await p.evaluate(() => { document.querySelector('#ar canvas').style.visibility = 'hidden'; });
    const sin = (await p.screenshot()).toString('base64');
    await p.evaluate(() => { document.querySelector('#ar canvas').style.visibility = ''; });
    const pix = await p.evaluate(async ([a, b]) => {
      const leer = async s => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode();
        const g = document.createElement('canvas'); g.width = 320; g.height = 180; const x = g.getContext('2d'); x.drawImage(i, 0, 0, 320, 180); return x.getImageData(0, 0, 320, 180).data; };
      const [da, db] = await Promise.all([leer(a), leer(b)]); let n = 0;
      for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) n++;
      return n / (320 * 180);
    }, [con, sin]);
    res(pix > 0.08 && pix < 0.9, `el edificio cubre ${(pix * 100).toFixed(0)} % de la pantalla (entre 8 y 90 %)`);
    if (captura) await p.screenshot({ path: captura });
  }

  // 3. el sol: la dirección de la luz pasada al papel tiene que dar el azimut de sol.js más el giro del norte
  // en el papel (34°, el mismo de la flecha de la tarjeta: 90° − EJE_LARGO), por un camino que no usa vectorSol
  const norte = 90 - 56;
  for (const min of [7 * 60, 900, 17 * 60 + 30]) {
    await p.evaluate(m => { const r = document.getElementById('hora'); r.value = m; r.dispatchEvent(new Event('input')); }, min);
    const s = await p.evaluate(() => window.__ar.sol);
    const hoy = new Date(Date.now() - 5 * 3600e3);
    const ref = posicionSol({ y: hoy.getUTCFullYear(), m: hoy.getUTCMonth() + 1, d: hoy.getUTCDate(), h: 0, min });
    // dir de la escena → papel: x → derecha, −z → arriba (matrizPapel); ángulo desde arriba, horario
    const azPapel = Math.atan2(s.dir[0], -s.dir[2]) * 180 / Math.PI;
    const dif = Math.abs(((azPapel - (ref.az + norte)) % 360 + 540) % 360 - 180);
    const dAlt = Math.abs(Math.asin(s.dir[1]) * 180 / Math.PI - ref.alt);
    res(dif < 0.1 && dAlt < 0.1, `sol a las ${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}: alt ${ref.alt.toFixed(1)}°, az ${ref.az.toFixed(1)}° · en el papel difiere ${dif.toFixed(3)}° y ${dAlt.toFixed(3)}°`);
  }
} finally { await nav.close(); srv.close(); }
res(errores.length === 0, `sin errores en la consola${errores.length ? ':\n   ' + errores.slice(0, 5).join('\n   ') : ''}`);
console.log(ok ? 'AR: todo pasa' : 'AR: HAY FALLAS, no seguir');
process.exit(ok ? 0 : 1);
