// Vite en modo biblioteca para gnomon-qr.js (ver ese archivo). No toca el armado del visor (vite.config.js).
export default { logLevel: 'warn', build: { outDir: process.env.SALIDA, emptyOutDir: false, minify: true, lib: { entry: process.env.ENTRADA, formats: ['es'], fileName: () => 'qrcode-nucleo.js' } } };
