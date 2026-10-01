// Genera la tarjeta de AR: ar/tarjeta/plano.png (el plano a 300 ppp), plano.mind (el archivo de rastreo de MindAR),
// qr.svg, tarjeta.pdf (carta apaisada que también cabe en A4, para imprimir al 100 %) y tarjeta.png (la hoja entera, para la prueba con cámara falsa).
// Uso: node ar/generar-tarjeta.mjs [--url=https://…/ar/]
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(path.join(raiz, 'fuente', 'package.json'));
const { chromium } = req('playwright');
const QRCode = req('qrcode');
const URL_AR = process.argv.find(a => a.startsWith('--url='))?.slice(6) ?? 'https://caamanoluismiguel.github.io/edificio-106/ar/';
const salida = path.join(raiz, 'ar', 'tarjeta');
fs.mkdirSync(salida, { recursive: true });

export function servir(dir) {
  const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml', '.mind': 'application/octet-stream', '.json': 'application/json', '.mp4': 'video/mp4', '.y4m': 'video/x-raw' };
  const srv = http.createServer((q, r) => {
    let f = path.join(dir, decodeURIComponent(new URL(q.url, 'http://x').pathname));
    if (f.startsWith(dir) && fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');   // como GitHub Pages
    if (!f.startsWith(dir) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': tipos[path.extname(f)] ?? 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ srv, url: `http://127.0.0.1:${srv.address().port}` })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { srv, url } = await servir(raiz);
  fs.writeFileSync(path.join(salida, 'qr.svg'), await QRCode.toString(URL_AR, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1d1d1bff', light: '#ffffffff' } }));
  const nav = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  const errores = [];
  try {
    const p = await nav.newPage();
    p.on('pageerror', e => errores.push(String(e))); p.on('console', m => m.type() === 'error' && errores.push(m.text()));
    await p.goto(`${url}/ar/tarjeta.html?paso=plano`);
    await p.waitForFunction(() => window.__listo, null, { timeout: 600000, polling: 1000 });
    const { png, mind, puntos } = await p.evaluate(() => ({ png: window.__plano, mind: window.__mind, puntos: window.__puntos }));
    fs.writeFileSync(path.join(salida, 'plano.png'), Buffer.from(png.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(salida, 'plano.mind'), Buffer.from(mind, 'base64'));
    console.log('rastreo:', JSON.stringify(puntos));
    // con las tejas completas el plano dio 512 puntos y MindAR no lo reconocía ni de frente; con las livianas, 1.553 y lo
    // encuentra en menos de un segundo. Por debajo de 1.000 el techo queda demasiado liso: no sirve como tarjeta
    if (!(puntos[0]?.puntos >= 1000)) errores.push(`el plano tiene ${puntos[0]?.puntos} puntos de rastreo (mínimo 1.000)`);

    const h = await nav.newPage({ viewport: { width: 1056, height: 816 }, deviceScaleFactor: 2 });   // carta apaisada a 96 ppp
    h.on('pageerror', e => errores.push(String(e)));
    await h.goto(`${url}/ar/tarjeta.html?paso=hoja`);
    await h.waitForFunction(() => window.__listo, null, { timeout: 60000 });
    await h.pdf({ path: path.join(salida, 'tarjeta.pdf'), width: '279.4mm', height: '215.9mm', printBackground: true, pageRanges: '1' });
    await h.screenshot({ path: path.join(salida, 'tarjeta.png') });
  } finally { await nav.close(); srv.close(); }
  for (const f of ['plano.png', 'plano.mind', 'qr.svg', 'tarjeta.pdf', 'tarjeta.png']) console.log(f.padEnd(12), (fs.statSync(path.join(salida, f)).size / 1024).toFixed(0), 'KB');
  if (errores.length) { console.log('ERRORES en la página:\n ' + errores.join('\n ')); process.exit(1); }
  console.log('QR →', URL_AR);
}
