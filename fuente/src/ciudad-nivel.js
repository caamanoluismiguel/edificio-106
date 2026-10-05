// Nivel de la ciudad según lo que el equipo puede (CIUDAD-PLAN §27: encendida para todos, sin castigar a los equipos débiles).
// No se decide por «tiene WebGPU» ni por «es teléfono»: primero lo que el navegador dice del equipo (la GPU que informa el
// adaptador de WebGPU o WebGL, navigator.deviceMemory, los núcleos) y después un sondeo corto del cuadro (el 106 ya armado,
// dibujado y esperado hasta que la GPU termina). Mientras se usa, si el cuadro se queda lento, la ciudad baja sola un
// escalón: primero el detalle, después su sombra y al final se esconde. El 106 no se toca nunca.
//   completo: ciudad.glb y ciudad_alto.glb (detalle alto cerca) y sombra propia de la ciudad con un mapa de 4.096 px
//   medio:    solo ciudad.glb y la sombra de la ciudad con 2.048 px (la «liviana»)
//   liviano:  solo ciudad.glb, sin sombra propia (los edificios del kit sí proyectan en el mapa fino del 106, ±70 m)
//   oculta:   sin ciudad (el contexto de siempre: las copias del 106 y las cajas grises)
export const NIVELES = ['completo', 'medio', 'liviano', 'oculta'];
export const NIVEL = {
  completo: { alto: true, sombra: 4096 },
  medio: { alto: false, sombra: 2048 },
  liviano: { alto: false, sombra: 0 },
  oculta: { alto: false, sombra: 0, oculta: true },
};
// umbrales del sondeo (cuadro del 106 solo, con la espera a la GPU, en ms). En el Apple M4 a 1440 × 900 el sondeo da unos 13 ms
// en WebGPU y 16 en WebGL 2 (con la profundidad de campo); la ciudad suma de 1 a 5 ms en WebGPU y de 3 a 10 en WebGL 2
// (docs/ciudad/CIUDAD.md, medido en la fase 3). PROVISIONALES hasta medir un teléfono de gama baja y una portátil de aula.
export const SONDEO = { holgura: 8, justo: 18, lento: 30 };
// vigía: mediana de los cuadros dibujados seguidos durante VIGIA.ventana ms; si pasa de VIGIA.lento, se confirma con un
// sondeo (para no castigar una pantalla limitada a 30 Hz, que da 33 ms entre cuadros sin estar lenta) y se baja un escalón
export const VIGIA = { ventana: 3000, lento: 30, confirma: 22 };

// GPU de teléfono de gama alta: Adreno 730 o más (Snapdragon 8 Gen 1 en adelante), Immortalis, Mali-G710 o más, Xclipse 9xx
const GPU_FUERTE = /Adreno[^0-9]*(7[3-9]\d|[89]\d\d)\b|Immortalis|Mali-G(7[1-9]\d|9\d\d)\b|Xclipse 9\d\d|Apple M\d|NVIDIA|GeForce|Radeon RX|Radeon Pro/i;
// gama baja: Mali de la serie T y G hasta la G5x (la G52 MC2 de los Galaxy A06, Moto G15 y Redmi 14C), Adreno 6xx o menos,
// PowerVR y los gráficos integrados de Intel anteriores a Iris Xe
const GPU_DEBIL = /Mali-(T\d+|G[1-5]\d)\b|Adreno[^0-9]*[1-6]\d\d\b|PowerVR|\bIMG\b|\bBXM\b|\bGE8\d{3}|Intel.*\b(U?HD Graphics)/i;
const ARQ_DEBIL = /^(bifrost|midgard|utgard|adreno-[1-6]|gen-(7|8|9|11)|rogue|sgx)/i;
const SOFTWARE = /SwiftShader|llvmpipe|softpipe|Microsoft Basic|Software Adapter/i;

/** Lo que el navegador dice del equipo. No pide nada a la red ni dibuja. */
export async function capacidad(renderer, backend) {
  const c = { backend, telefono: matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820,
    memoria: navigator.deviceMemory ?? null, nucleos: navigator.hardwareConcurrency ?? null, gpu: '', vendedor: '', arquitectura: '', respaldo: false };
  const be = renderer.backend;
  try {
    if (be.isWebGPUBackend) {
      const info = be.device?.adapterInfo ?? (await navigator.gpu.requestAdapter())?.info ?? {};
      c.vendedor = info.vendor ?? ''; c.arquitectura = info.architecture ?? ''; c.gpu = info.description ?? ''; c.respaldo = !!info.isFallbackAdapter;
    } else if (be.gl) {
      const gl = be.gl, ext = gl.getExtension('WEBGL_debug_renderer_info');
      c.gpu = String(gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) ?? '');
      c.vendedor = String(gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR) ?? '');
    }
  } catch (e) { /* sin dato: cuenta como desconocida */ }
  const txt = `${c.vendedor} ${c.arquitectura} ${c.gpu}`;
  c.software = c.respaldo || SOFTWARE.test(txt) || (c.vendedor === 'google' && /swiftshader/i.test(c.arquitectura));
  c.debil = c.software || GPU_DEBIL.test(txt) || ARQ_DEBIL.test(c.arquitectura) || (c.memoria != null && c.memoria <= 4) || (c.nucleos != null && c.nucleos <= 4);
  c.fuerte = !c.debil && (GPU_FUERTE.test(txt) || c.vendedor === 'apple' || c.vendedor === 'nvidia' || c.vendedor === 'amd');
  return c;
}

/** Nivel antes del sondeo: computador sin señales de gama baja, completo; teléfono o equipo débil, medio; GPU por
 *  software, liviano. */
export function nivelEstatico(c) {
  if (c.software) return { nivel: 'liviano', motivo: 'GPU por software' };
  if (c.telefono) return { nivel: 'medio', motivo: 'teléfono' };
  if (c.debil) return { nivel: 'medio', motivo: 'equipo de gama baja' };
  return { nivel: 'completo', motivo: 'computador' };
}

/** Ajuste por el sondeo (ms del cuadro del 106 solo). Con holgura sube a completo (un teléfono, solo con 6 GB o más si el
 *  navegador lo dice); justo, se queda; lento, a lo más medio; muy lento, liviano. Nunca la esconde: eso lo hace el vigía. */
export function nivelSondeo(base, ms, c) {
  if (ms == null || !isFinite(ms)) return { nivel: base.nivel, motivo: base.motivo + ', sin sondeo' };
  const i = NIVELES.indexOf(base.nivel), f = (n) => `${base.motivo}, sondeo ${ms.toFixed(1).replace('.', ',')} ms → ${n}`;
  if (ms <= SONDEO.holgura && !c.software && (!c.telefono || c.memoria == null || c.memoria >= 6)) return { nivel: 'completo', motivo: f('completo') };
  if (ms <= SONDEO.justo) return { nivel: base.nivel, motivo: f(base.nivel) };
  if (ms <= SONDEO.lento) return { nivel: NIVELES[Math.max(i, 1)], motivo: f(NIVELES[Math.max(i, 1)]) };
  return { nivel: NIVELES[Math.max(i, 2)], motivo: f(NIVELES[Math.max(i, 2)]) };
}

/** Escalón siguiente hacia abajo (o null si ya está escondida). */
export const bajar = (n) => NIVELES[NIVELES.indexOf(n) + 1] ?? null;

/** Vigía del cuadro: recibe los intervalos entre cuadros dibujados seguidos (ms) y avisa cuando la mediana de una ventana
 *  de VIGIA.ventana ms pasa de VIGIA.lento. */
export class Vigia {
  constructor() { this.iv = []; this.suma = 0; }
  cuadro(iv) {
    if (!(iv > 0) || iv > 250) return null;            // un salto (carga, pestaña oculta) no cuenta
    this.iv.push(iv); this.suma += iv;
    if (this.suma < VIGIA.ventana) return null;
    const a = this.iv.sort((x, y) => x - y), med = a[a.length >> 1];
    this.iv = []; this.suma = 0;
    return med;
  }
  reiniciar() { this.iv = []; this.suma = 0; }
}
