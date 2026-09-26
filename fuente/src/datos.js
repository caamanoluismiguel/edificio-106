// Lectura de archivos binarios del sitio. En hosting propio se piden tal cual (los .gz se descomprimen aquí);
// en el Artifact de claude.ai cada archivo viaja como texto base64 de su versión gzip (nombre + '.gz.b64.txt'),
// porque ese servidor solo entrega tipos de archivo web y precarga todo antes de abrir la página.

const esGzip = (b) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;

async function gunzip(bytes) {
  if (!globalThis.DecompressionStream) throw new Error('Este navegador no puede descomprimir gzip (DecompressionStream).');
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

function desdeBase64(txt) {
  txt = txt.trim();
  if (Uint8Array.fromBase64) return Uint8Array.fromBase64(txt);
  const bin = atob(txt), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function leer(url, onProgress) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const total = +r.headers.get('content-length') || 0;
  if (!r.body || !onProgress) return new Uint8Array(await r.arrayBuffer());
  const rd = r.body.getReader(), partes = []; let n = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; partes.push(value); n += value.length; onProgress(n, total); }
  const out = new Uint8Array(n); let o = 0; for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}

/** Devuelve los bytes descomprimidos de `url` (p. ej. 'datos/intro.bin' o 'modelo/sitio.glb'). */
export async function binario(url, onProgress) {
  if (globalThis.MODELO_B64) {
    const txt = new TextDecoder().decode(await leer(url + '.gz.b64.txt', onProgress));
    return gunzip(desdeBase64(txt));
  }
  const gz = url.endsWith('.bin');                       // los .bin se publican comprimidos (.bin.gz)
  const b = await leer(gz ? url + '.gz' : url, onProgress);
  return esGzip(b) ? gunzip(b) : b;
}

/** intro.bin: 'P106' + n, luego n×3 int16 (posición ×0,02 m), n×3 uint8 (color), n×3 uint8 (grupo, altura, azar). */
export async function puntosIntro(base) {
  const b = await binario(base + 'datos/intro.bin');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (String.fromCharCode(b[0], b[1], b[2], b[3]) !== 'P106') throw new Error('intro.bin inválido');
  const n = dv.getUint32(4, true), o = b.byteOffset + 8;
  const pos = new Int16Array(b.buffer.slice(o, o + n * 6));
  const col = b.subarray(8 + n * 6, 8 + n * 9), meta = b.subarray(8 + n * 9, 8 + n * 12);
  return { n, pos, col, meta };
}
