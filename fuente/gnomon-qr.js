// Entrada para vendorizar el núcleo de qrcode 1.5.4 (solo la matriz, sin dibujo) en gnomon/vendor/qrcode-nucleo.js;
// la hoja del gnomon dibuja el QR en SVG, sin servicios externos. Se rehace con:
//   cd fuente && ENTRADA=gnomon-qr.js SALIDA=../gnomon/vendor ./node_modules/.bin/vite build --config gnomon-qr.config.mjs
import { create } from 'qrcode/lib/core/qrcode.js';
export function matrizQR(texto, nivel = 'M') {
  const q = create(texto, { errorCorrectionLevel: nivel });
  return { n: q.modules.size, datos: Array.from(q.modules.data) };
}
