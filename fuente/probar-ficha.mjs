// Prueba de la ficha del edificio (?edificio=N): abre el sitio armado de esta carpeta con un dúplex, un cuartel, una caja gris y el
// 106, como teléfono (390 × 844), en el diseño intermedio (820 px) y con el panel lateral (1440 px), y guarda una captura de cada uno.
// Comprueba además que la ficha se abre, que la del 106 lleva la frase de la copa (datos/copa.json), que el centro del edificio queda a la vista (fuera de la ficha y de los paneles de abajo),
// que Escape la cierra, y cómo se eligen el 332B, un número repetido y un id de OSM.
//   cd fuente && node probar-ficha.mjs [--salida=<carpeta>]      código de salida 0 si todo pasa
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.resolve(AQUI, '..');
const arg = (k, v) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? v;
const SALIDA = arg('salida', path.join(os.homedir(), 'projects/edificio-106-PANEL-PRODUCTO/capturas-ficha'));
fs.mkdirSync(SALIDA, { recursive: true });
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gz': 'application/gzip', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  let p = path.normalize(path.join(RAIZ, decodeURIComponent(new URL(q.url, 'http://x').pathname)));
  if (!p.startsWith(RAIZ)) { r.writeHead(403); return r.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TIPOS[path.extname(p).toLowerCase()] ?? 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${srv.address().port}/`;
const nav = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });

const PANTALLAS = [
  { nombre: 'telefono-390', disp: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  { nombre: 'intermedio-820', disp: { viewport: { width: 820, height: 1000 } } },
  { nombre: 'panel-1440', disp: { viewport: { width: 1440, height: 900 } } },
];
const EDIFICIOS = [['305', 'duplex'], ['128', 'cuartel'], ['200', 'caja-gris'], ['106', 'el-106']];
const MOMENTO = '#m-20260315-1000';    // la misma luz en todas las capturas
let falla = false;
const mal = (t) => { falla = true; console.log('  ✗ ' + t); };

for (const P of PANTALLAS) {
  const ctx = await nav.newContext({ ...P.disp, timezoneId: 'America/Panama', locale: 'es-PA' });
  await ctx.addInitScript(() => { try { localStorage.setItem('e106-visto', '1'); localStorage.setItem('e106-navegar', '1'); } catch (e) { /* nada */ } });
  for (const [n, rotulo] of EDIFICIOS) {
    const pg = await ctx.newPage(), errores = [];
    pg.on('pageerror', (e) => errores.push(String(e).slice(0, 200)));
    pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 200)); });
    await pg.goto(`${base}?prueba&rapido&edificio=${encodeURIComponent(n)}${MOMENTO}`, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__e106?.escena?.cargado, null, { timeout: 180000, polling: 500 });
    await pg.evaluate(() => Promise.race([window.__e106.escena.cargaCiudad, new Promise((ok) => setTimeout(ok, 120000))]));
    await pg.waitForFunction(() => { const el = document.querySelector('#tarjeta-edificio'); return el && !el.hidden && document.querySelector('#te-t').textContent; }, null, { timeout: 60000, polling: 250 });
    await pg.waitForTimeout(4500);   // el vuelo de la cámara (1,6 s), el encuadre que se corre y la profundidad de campo
    const r = await pg.evaluate(() => {
      const { escena, NAV } = window.__e106, e = NAV.tarjeta, cam = escena.camera;
      const ficha = document.querySelector('#tarjeta-edificio').getBoundingClientRect();
      const W = innerWidth, H = innerHeight;
      // el centro del edificio en la pantalla (con el desplazamiento de lente del encuadre)
      const v = cam.position.clone().set(e.cx, e.y0 + e.h / 2, e.cz).project(cam);
      const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
      const tapado = ['#tarjeta-edificio', '#dock', '#hud'].some((q) => { const b = document.querySelector(q)?.getBoundingClientRect(); return b && b.width && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom; });
      return { titulo: document.querySelector('#te-t').textContent, x: Math.round(x), y: Math.round(y), W, H, ficha: [Math.round(ficha.left), Math.round(ficha.top), Math.round(ficha.right), Math.round(ficha.bottom)], tapado,
        texto: document.querySelector('#te-txt').innerText.replace(/\s+/g, ' ').slice(0, 160),
        copa: [...document.querySelectorAll('#te-txt p')].map((p) => p.textContent).find((t) => t.startsWith('Estimación de la copa')) ?? null,
        copaVisible: (() => { const p = [...document.querySelectorAll('#te-txt p')].find((q) => q.textContent.startsWith('Estimación de la copa')); return !!p && p.getClientRects().length > 0; })() };
    });
    const archivo = path.join(SALIDA, `${P.nombre}-${rotulo}-${n}.png`);
    await pg.screenshot({ path: archivo });
    console.log(`${P.nombre} · ${n}: «${r.titulo}», centro del edificio en (${r.x}, ${r.y}) de ${r.W} × ${r.H}, ficha ${r.ficha.join(', ')} → ${path.basename(archivo)}`);
    // la ficha del 106 lleva la frase de la copa (datos/copa.json); las demás no
    if (n === '106') {
      if (!r.copa || !r.copaVisible) mal('la ficha del 106 no muestra la frase de la copa');
      else {
        console.log('  ✓ copa: ' + r.copa);
        // la ficha se desplaza hasta la frase (en el teléfono queda bajo el pliegue) y se captura otra vez
        await pg.evaluate(() => [...document.querySelectorAll('#te-txt p')].find((q) => q.textContent.startsWith('Estimación de la copa')).scrollIntoView({ block: 'nearest' }));
        await pg.waitForTimeout(300);
        await pg.screenshot({ path: path.join(SALIDA, `${P.nombre}-${rotulo}-${n}-copa.png`) });
        // el crédito de la copa (Meta y WRI, OSM) se alcanza al desplazar la ficha hasta el final: queda entero dentro del área visible
        const cr = await pg.evaluate(async () => {
          const txt = document.querySelector('#te-txt'), c = [...txt.querySelectorAll('.te-credito')].find((q) => q.textContent.startsWith('Copa: Meta y WRI'));
          if (!c) return null;
          txt.scrollTop = txt.scrollHeight; await new Promise((ok) => setTimeout(ok, 300));
          const a = txt.getBoundingClientRect(), b = c.getBoundingClientRect();
          return { dentro: b.top >= a.top - 1 && b.bottom <= a.bottom + 1, desplaza: txt.scrollHeight > txt.clientHeight, texto: c.textContent };
        });
        if (!cr) mal('la ficha del 106 no tiene el crédito de la copa');
        else if (!cr.dentro) mal('el crédito de la copa no se alcanza al desplazar la ficha');
        else console.log(`  ✓ crédito de la copa visible${cr.desplaza ? ' al desplazar la ficha hasta el final' : ' sin desplazar'}`);
        await pg.screenshot({ path: path.join(SALIDA, `${P.nombre}-${rotulo}-${n}-credito.png`) });
      }
    }
    else if (r.copa) mal('la frase de la copa sale en una ficha que no es la del 106');
    if (r.tapado || r.x < 0 || r.x > r.W || r.y < 0 || r.y > r.H) mal(`el centro del edificio queda tapado o fuera de la pantalla`);
    if (errores.length) mal('errores: ' + errores.join(' | '));
    // el foco pasa al título de la ficha; Escape la cierra y el foco sale de ella
    if ((await pg.evaluate(() => document.activeElement?.id)) !== 'te-t') mal('al abrir, el foco no pasó al título de la ficha');
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
    const tras = await pg.evaluate(() => ({ oculta: document.querySelector('#tarjeta-edificio').hidden, foco: document.activeElement?.id || document.activeElement?.tagName }));
    if (!tras.oculta) mal('Escape no cerró la ficha');
    if (tras.foco === 'te-t' || tras.foco === 'BODY') mal(`al cerrar, el foco quedó en ${tras.foco}`);
    // el doble toque (o doble clic) sobre el mismo edificio la vuelve a abrir, con el foco en ella; × la cierra y el foco vuelve a la escena
    if (n !== '106') {
      await pg.evaluate(() => document.querySelector('#lienzo').focus());
      if (P.disp.hasTouch) { await pg.touchscreen.tap(r.x, r.y); await pg.waitForTimeout(120); await pg.touchscreen.tap(r.x, r.y); }
      else await pg.mouse.dblclick(r.x, r.y);
      await pg.waitForFunction(() => !document.querySelector('#tarjeta-edificio').hidden, null, { timeout: 5000 }).catch(() => {});
      const otra = await pg.evaluate(() => ({ t: document.querySelector('#tarjeta-edificio').hidden ? null : document.querySelector('#te-t').textContent, foco: document.activeElement?.id }));
      if (otra.t !== r.titulo || otra.foco !== 'te-t') mal(`doble toque: ${JSON.stringify(otra)}`);
      await pg.click('#te-cerrar'); await pg.waitForTimeout(200);
      const f = await pg.evaluate(() => document.activeElement?.id);
      if (f !== 'lienzo') mal(`× no devolvió el foco a la escena (${f})`);
      else console.log(`  ✓ foco: título al abrir, de vuelta al salir; doble ${P.disp.hasTouch ? 'toque' : 'clic'} y × funcionan`);
    }
    await pg.close();
  }
  await ctx.close();
}

// cómo se eligen el 332B, un número repetido, un id de OSM y un número que no está (sin capturas)
{
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Panama', locale: 'es-PA' });
  await ctx.addInitScript(() => { try { localStorage.setItem('e106-visto', '1'); } catch (e) { /* nada */ } });
  const pg = await ctx.newPage();
  await pg.goto(`${base}?prueba&rapido${MOMENTO}`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__e106?.escena?.cargado && window.__e106.NAV.mapa, null, { timeout: 180000, polling: 500 });
  for (const [q, espera] of [['332B', 'Edificio 332A y 332B'], ['332a', 'Edificio 332A y 332B'], ['246', 'Edificio 246'], ['osm1280703660', 'Edificio 246'], ['402 A/B', 'Edificio 402 A/B'], ['9999', null]]) {
    const t = await pg.evaluate(async (q) => { const e = await window.__e106.abrirEdificio(q, false); return e ? { t: document.querySelector('#te-t').textContent, o: e.o, enlace: window.__e106.enlaceMomento().split('#')[0] } : null; }, q);
    const ok = espera === null ? t === null : t?.t === espera;
    if (!ok) mal(`?edificio=${q}: ${JSON.stringify(t)} (se espera ${espera})`);
    else console.log(`✓ ?edificio=${q} → ${t ? `${t.t} (OSM ${t.o}), enlace ${t.enlace}` : 'no está: la página abre sin ficha'}`);
  }
  await ctx.close();
}
await nav.close(); srv.close();
console.log(falla ? 'RESULTADO: LA FICHA FALLA' : `RESULTADO: la ficha abre en las tres pantallas · capturas en ${SALIDA}`);
process.exit(falla ? 1 : 0);
