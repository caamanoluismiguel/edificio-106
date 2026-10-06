// Lee del visor (con ?prueba) los valores de la luz en un momento y calcula la razón entre suelo al sol y suelo en sombra que
// busca la escena: 1 + (Rv − 1) / fRel, con Rv = 1 + KAPPA · intensidad del sol · sen h / 0,30 y fRel con tope 0,3 (escena.js).
// Uso, desde fuente/ con el sitio armado en la raíz: node ../docs/validacion/luz/medir-escena.mjs 20240325-1500 50.6
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const [m, alt] = process.argv.slice(2), R = path.resolve('..');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gz': 'application/gzip', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { let f = path.join(R, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': tipos[path.extname(f)] ?? 'application/octet-stream' }); r.end(b); }); }).listen(8767);
const b = await chromium.launch({ args: ['--enable-unsafe-webgpu'] }), p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(`http://localhost:8767/?prueba&rapido#m-${m}`); await p.waitForTimeout(14000);
const r = await p.evaluate(() => { const e = __e106.escena, U = __e106.U; return { fRel: e._fRel, sol: e.sun.intensity, dni: U.dniW.value, dhi: U.dhiW.value, ai: U.ai.value }; });
const sh = Math.sin(alt * Math.PI / 180), Rf = (r.dni * sh + r.dhi) / (r.dhi * Math.max(0.05, 1 - r.ai)), Rv = 1 + 0.234 * r.sol * sh / 0.30;
console.log(m, r, 'fórmula', Rf.toFixed(2), 'escena', (1 + (Rv - 1) / Math.max(0.3, Math.min(1, (Rv - 1) / (Rf - 1)))).toFixed(2));
await b.close(); srv.close();
