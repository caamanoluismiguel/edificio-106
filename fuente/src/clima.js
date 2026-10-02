// Clima del Edificio 106: 25 años hora por hora (2001–2025, ERA5 vía Open-Meteo), valores típicos por mes y hora,
// y el tiempo real: pronóstico «best_match» de Open-Meteo (combina modelos solo); da valores cada 15 min interpolados,
// pero el modelo corre varias veces al día, no cada 15 min.
import { binario } from './datos.js';
import { LAT, LON } from './sol.js';
import { ajustarT, ajustarHR, ruidoT } from './ajuste.js';
// Umbral con que un dato de modelo (ERA5 o pronóstico) cuenta como lluvia en la escena y en los textos: 1 mm en la hora de
// diciembre a marzo y 1,5 mm de abril a noviembre. Con esos valores, ERA5 2017–2025 tiene unas 0,81 veces las horas con lluvia que
// informa el observador del aeropuerto de Albrook de diciembre a marzo y 1,15 de abril a noviembre (panel de expertos y verificador, 2 de octubre de 2026; ERA5 junta
// la lluvia en la tarde y reparte llovizna de modelo, así que con 0,1 mm llovía unas 3.000 horas al año). Abril va con las lluvias.
export const umbralLluvia = (m) => (m >= 4 && m <= 11 ? 1.5 : 1);

const T0 = Date.UTC(2001, 0, 1, 0);            // primera hora de la serie (hora de Panamá tratada como UTC)
// datos/clima_horario.bin, formato 'C107' (fuente/clima_bin.py): firma, n (uint32) y columnas de n horas seguidas;
// la lluvia en uint16 a 0,1 mm, el resto en uint8. ESC: valor = entero / escala + desplazamiento
const FIRMA = 'C107';
const COLS = ['nubes', 'lluvia', 'temp', 'humedad', 'dni', 'difusa', 'viento', 'dir'];
const ANCHO = { lluvia: 2 };                  // bytes por hora (1 si no está)
const ESC = { nubes: [1, 0], lluvia: [10, 0], temp: [6, 10], humedad: [1, 0], dni: [0.25, 0], difusa: [0.25, 0], viento: [1, 0], dir: [0.5, 0] };

export class Clima {
  constructor() { this.ok = false; this.horario = null; this.vivo = null; this.dias = {}; this.ajuste = null; }

  /** ERA5 ajustado a Albrook (src/ajuste.js), salvo con ?era5=crudo en la URL. */
  async cargarAjuste(url) {
    if (/[?&]era5=crudo/.test(globalThis.location?.search ?? '')) return false;
    try { this.ajuste = await (await fetch(url)).json(); } catch (e) { this.ajuste = null; }
    return !!this.ajuste;
  }
  /** Temperatura y humedad de la hora i de la serie, ajustadas si hay ajuste. */
  th(i) {
    const t = this.valor('temp', i), rh = this.valor('humedad', i), A = this.ajuste; if (!A) return [t, rh];
    const m = new Date(T0 + i * 3.6e6).getUTCMonth() + 1, h = i % 24, tj = t + ruidoT(i), ta = ajustarT(A, tj, m, h);
    return [ta, ajustarHR(A, tj, rh, ta, m)];
  }

  async cargarResumen(url) {
    try { this.r = await (await fetch(url)).json(); this.ok = true; } catch (e) { this.ok = false; }
    return this.ok;
  }

  async cargarHorario(base) {
    const b = await binario(base + 'datos/clima_horario.bin');
    const firma = String.fromCharCode(...b.subarray(0, 4));
    if (firma !== FIRMA) throw new Error(`clima_horario.bin: formato «${firma}», se esperaba «${FIRMA}» (rehazlo con fuente/clima_bin.py)`);
    const n = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(4, true);
    const c = {}; let o = 8;
    for (const k of COLS) {
      const w = ANCHO[k] ?? 1, s = b.subarray(o, o + w * n);
      // uint16 little-endian; se copia para alinear el búfer a 2 bytes
      c[k] = w === 2 ? new Uint16Array(s.slice().buffer) : s; o += w * n;
    }
    if (o !== b.byteLength) throw new Error(`clima_horario.bin: ${b.byteLength} bytes, se esperaban ${o}`);
    this.horario = c; this.n = n;
    this.#mensualNubes();
    return true;
  }

  /** Índice de hora en la serie para una fecha y hora de Panamá, o -1 si está fuera. */
  indice(f, h) { const i = Math.floor((Date.UTC(f.y, f.m - 1, f.d, h) - T0) / 3.6e6); return i >= 0 && i < (this.n ?? 0) ? i : -1; }
  enSerie(f) { return f.y >= 2001 && f.y <= 2025; }
  valor(k, i) { const [e, o] = ESC[k]; return this.horario[k][i] / e + o; }

  /** Registro de reanálisis a una fecha y minuto del día (interpolado entre horas; la lluvia es el total de esa hora).
   *  El viento y su dirección van con la lluvia: son los de la marca que cierra la hora en curso (la misma de la lluvia), como
   *  en consultas.py, para que la lluvia batiente (lluvia × viento × coseno) no mezcle horas distintas. */
  registro(f, min) {
    if (!this.horario || !this.enSerie(f)) return null;
    const h = Math.floor(min / 60), a = this.indice(f, h); if (a < 0) return null;
    const b = Math.min(this.n - 1, a + 1), t = (min - h * 60) / 60, L = (k) => this.valor(k, a) * (1 - t) + this.valor(k, b) * t;
    // la radiación de la hora H es el promedio de H−1 a H (centrada en H−0,5): se interpola entre centros
    const x = a + t + 0.5, i0 = Math.min(this.n - 1, Math.floor(x)), i1 = Math.min(this.n - 1, i0 + 1), u = x - Math.floor(x);
    const R = (k) => this.valor(k, i0) * (1 - u) + this.valor(k, i1) * u;
    const [ta, ha] = this.th(a), [tb, hb] = this.th(b);
    return { fuente: 'serie', ajustado: !!this.ajuste, nubes: L('nubes'), lluvia: this.valor('lluvia', b), temp: ta * (1 - t) + tb * t, humedad: ha * (1 - t) + hb * t,
      dni: R('dni'), difusa: R('difusa'), viento: this.valor('viento', b), dir: this.valor('dir', b) };
  }

  /** Qué tan mojadas siguen las superficies (0..1) a una fecha y minuto: la lluvia de las 12 horas anteriores menos lo que
   *  secaron el sol, el viento y el aire seco. Modelo simple e ilustrativo, no medido: 1 mm en una hora empapa; con sol pleno
   *  y brisa se seca en una hora y pico, y de noche con aire húmedo tarda más de diez. Null si no hay serie para ese momento. */
  mojado(f, min) {
    const h = Math.floor(min / 60), t = (min - h * 60) / 60;
    let fin, lee;
    if (this.horario && this.enSerie(f)) {
      fin = this.indice(f, h); if (fin < 0) return null;
      lee = (i) => i < 0 || i >= this.n ? null : [this.valor('lluvia', i), this.valor('dni', i), this.valor('viento', i), this.valor('humedad', i)];
    } else {
      const k = `${f.y}-${String(f.m).padStart(2, '0')}-${String(f.d).padStart(2, '0')}`, D = this.dias[k];
      if (!D || D instanceof Promise) return null;
      fin = h;                                   // solo se conocen las horas de ese día
      lee = (i) => i < 0 || i > 23 ? null : [D.h.precipitation[i] ?? 0, D.h.direct_normal_irradiance[i] ?? 0, D.h.wind_speed_10m[i] ?? 0, D.h.relative_humidity_2m[i] ?? 80];
    }
    // la lluvia de la marca i es la de la hora que termina en i: se recorre hasta la hora en curso (fin + 1) y se interpola
    let w = 0, antes = 0;
    for (let i = fin - 12; i <= fin + 1; i++) {
      if (i === fin + 1) antes = w;
      const r = lee(i); if (!r) continue;
      const [mm, dni, v, hr] = r;
      const seca = (0.12 + 0.9 * Math.min(1, dni / 700) + 0.02 * v) * Math.max(0.3, 1.3 - hr / 100);
      w =Math.max(0, Math.min(1, w + mm) - seca);
    }
    return antes + (w - antes) * t;
  }

  /** Valores típicos (mediana 2001–2025) para el mes y la hora. */
  tipico(m, min) {
    if (!this.ok) return null;
    const r = this.r, h = Math.min(23, Math.floor(min / 60)), g = (v, q = 'p50') => v[q][m - 1][h];
    const hl = (h + 1) % 24;                  // la probabilidad de lluvia de la marca H es la de H−1 a H
    const A = this.ajuste, aj = (t) => A ? ajustarT(A, t, m, h) : t, t50 = g(r.temp);
    return { fuente: 'tipico', ajustado: !!A, nubes: g(r.nubes), temp: aj(t50), tempBaja: aj(g(r.temp, 'p10')), tempAlta: aj(g(r.temp, 'p90')), humedad: A ? ajustarHR(A, t50, g(r.humedad), aj(t50), m) : g(r.humedad),
      viento: g(r.viento), dni: r.dni ? g(r.dni) : null, probLluvia: r.probLluvia[m - 1][hl], lluvia: 0 };
  }

  mes(y, m) { return this.r?.mensual.find((q) => q.y === y && q.m === m) ?? null; }
  get meses() { return this.r?.mensual ?? []; }

  #mensualNubes() {
    // nubosidad media de cada mes (para el paso de 25 años)
    for (const q of this.meses) {
      const a = this.indice({ y: q.y, m: q.m, d: 1 }, 0), b = q.m === 12 ? this.indice({ y: q.y + 1, m: 1, d: 1 }, 0) : this.indice({ y: q.y, m: q.m + 1, d: 1 }, 0);
      const fin = b < 0 ? this.n : b; let s = 0; for (let i = a; i < fin; i++) s += this.horario.nubes[i];
      q.nubes = s / Math.max(1, fin - a);
    }
  }

  /** Un día fuera de la serie incluida (antes de 2001 o después de 2025): se pide en línea a Open-Meteo.
   *  Días pasados con más de 6 días: archivo histórico con ERA5. Últimos días y hasta 15 días adelante: modelo de pronóstico.
   *  Devuelve null si no hay red (en la vista previa de claude.ai no hay conexiones externas). */
  pedirDia(f) {
    const k = `${f.y}-${String(f.m).padStart(2, '0')}-${String(f.d).padStart(2, '0')}`;
    if (k in this.dias) return this.dias[k];
    const t = Date.UTC(f.y, f.m - 1, f.d), ahora = Date.now() - 5 * 3600e3, dias = (t - ahora) / 864e5;
    if (globalThis.MODELO_B64 || f.y < 1940 || dias > 15) { this.dias[k] = null; return null; }
    const H = 'temperature_2m,relative_humidity_2m,precipitation,cloud_cover,direct_normal_irradiance,diffuse_radiation,wind_speed_10m,wind_direction_10m';
    const reciente = dias > -6;
    const u = (reciente ? 'https://api.open-meteo.com/v1/forecast' : 'https://archive-api.open-meteo.com/v1/archive') +
      `?latitude=${LAT}&longitude=${LON}&hourly=${H}&timezone=America%2FPanama&start_date=${k}&end_date=${k}` + (reciente ? '' : '&models=era5');
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 9000);
    this.dias[k] = fetch(u, { signal: ctl.signal }).then((r) => r.ok ? r.json() : null).then((j) => {
      const h = j?.hourly; if (!h?.time?.length) return (this.dias[k] = null);
      return (this.dias[k] = { modelo: reciente ? 'pronostico' : 'era5', h });
    }).catch(() => (this.dias[k] = null)).finally(() => clearTimeout(to));
    return this.dias[k];
  }

  /** Registro de un día pedido en línea (mismo formato que registro(): el viento y su dirección, de la hora de la lluvia). */
  registroDia(f, min) {
    const k = `${f.y}-${String(f.m).padStart(2, '0')}-${String(f.d).padStart(2, '0')}`, D = this.dias[k];
    if (!D || D instanceof Promise) return null;
    const h = Math.min(23, Math.floor(min / 60)), b = Math.min(23, h + 1), t = (min - h * 60) / 60, v = (key, i) => D.h[key][i] ?? 0;
    const L = (key) => v(key, h) * (1 - t) + v(key, b) * t;
    const x = h + t + 0.5, i0 = Math.min(23, Math.floor(x)), i1 = Math.min(23, i0 + 1), u = x - Math.floor(x);
    return { fuente: 'dia', modelo: D.modelo, nubes: L('cloud_cover'), lluvia: v('precipitation', b), temp: L('temperature_2m'), humedad: L('relative_humidity_2m'),
      dni: v('direct_normal_irradiance', i0) * (1 - u) + v('direct_normal_irradiance', i1) * u,
      difusa: D.h.diffuse_radiation ? v('diffuse_radiation', i0) * (1 - u) + v('diffuse_radiation', i1) * u : null, viento: v('wind_speed_10m', b), dir: v('wind_direction_10m', b) };
  }

  /** Tiempo real: el pronóstico de modelo de Open-Meteo para las coordenadas del edificio y, encima, el último parte (METAR)
   *  del aeropuerto de Albrook (MPMG), a 4,1 km, leído del Iowa Environmental Mesonet (deja leerlo desde el navegador). */
  async cargarVivo() {
    const [modelo, parte] = await Promise.all([this.#vivoModelo(), leerAlbrook()]);
    this.vivo = modelo ? conAlbrook(modelo, parte) : null;
    return this.vivo;
  }

  async #vivoModelo() {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,direct_normal_irradiance,diffuse_radiation,is_day&timezone=America%2FPanama`;
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 12000);   // 12 s: mientras la escena compila, el navegador tarda en atender la respuesta
    try {
      const r = await fetch(u, { signal: ctl.signal }); if (!r.ok) throw new Error(r.status);
      const j = await r.json(), c = j.current;
      // la precipitación actual es la suma de los últimos `interval` segundos (15 min): se lleva a mm por hora
      const k = 3600 / (c.interval || 900);
      // el modelo reparte trazas de lluvia por toda su celda (la más cercana cae ~4 km al sur del edificio): 0,1 mm en 15 min, su
      // unidad mínima, son 0,4 mm/h y casi nunca se notan en la calle. En vivo solo se cuenta como lluvia desde el umbral del mes (umbralLluvia); por debajo
      // queda como «llovizna del modelo» (se dice en el texto, la escena no la dibuja ni moja)
      const mmh = c.precipitation * k, llueve = mmh >= umbralLluvia(+c.time.slice(5, 7));
      return { fuente: 'vivo', hora: c.time.slice(11, 16), fecha: c.time.slice(0, 10), nubes: c.cloud_cover, lluvia: llueve ? mmh : 0, lluviaModelo: mmh, llovizna: !llueve && mmh > 0, lluvia15: c.precipitation, temp: c.temperature_2m,
        humedad: c.relative_humidity_2m, viento: c.wind_speed_10m, dir: c.wind_direction_10m, dni: c.direct_normal_irradiance ?? null, difusa: c.diffuse_radiation ?? null, recibido: Date.now() };
    } catch (e) { return null; }
    finally { clearTimeout(to); }
  }
}

// ---------------- Albrook (METAR) ----------------
// Un parte vale hasta 90 min después de su hora (provisional: el de las 20:00 UTC estaba en IEM a las 20:23; hay que medir la
// latencia unos días). Albrook emite un parte de rutina cada hora; de 23 a 5 h casi siempre es automático (AUTO) y no informa
// si llueve. Fuentes de las reglas: WMO-No. 306, vol. I.1, FM 15 (15.8.4 y 15.8.5: «-» ligera, sin signo moderada, «+» fuerte;
// 15.8.8: TS solo, truena sin precipitación; 15.8.10, nota 1: VC, a entre unos 8 y 16 km del aeródromo; 15.11.1: temperatura y
// punto de rocío redondeados al grado entero).
const ALBROOK_URL = 'https://mesonet.agron.iastate.edu/api/1/currents.json?station=MPMG';
const ALBROOK_VIGENTE = 90 * 60e3;
// intensidad que dibuja la escena para cada clase del parte (mm/h ilustrativos, dentro de las clases de la OMM: WMO-No. 8, 2023,
// vol. I, p. 484; no se muestran como dato). La llovizna ligera se dibuja apenas.
const ALBROOK_MMH = { ligera: 1, moderada: 5, fuerte: 20, llovizna: 0.3 };

async function leerAlbrook() {
  if (globalThis.MODELO_B64) return null;
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 12000);   // 12 s: mientras la escena compila, el navegador tarda en atender la respuesta
  try {
    const r = await fetch(ALBROOK_URL, { signal: ctl.signal }); if (!r.ok) return null;
    const d = (await r.json())?.data?.[0]; if (!d?.raw || !d.utc_valid) return null;
    return { t: Date.parse(d.utc_valid), raw: d.raw, tmpf: d.tmpf, dwpf: d.dwpf, relh: d.relh, sknt: d.sknt, drct: d.drct };
  } catch (e) { return null; }
  finally { clearTimeout(to); }
}

/** Tiempo presente del parte: solo el grupo de la observación (antes de TEMPO, BECMG, NOSIG o RMK). */
export function tiempoPresente(raw) {
  const g = raw.split(/\s+/), fin = g.findIndex((x) => /^(TEMPO|BECMG|NOSIG|RMK)$/.test(x) || /^[QA]\d{4}$/.test(x));   // lo que va después de la presión son notas
  const obs = fin < 0 ? g : g.slice(0, fin), auto = obs.includes('AUTO');
  const wx = obs.filter((x) => /^(\+|-)?(VC)?(MI|BC|PR|DR|BL|SH|TS|FZ|VC){0,3}(DZ|RA|SN|SG|PL|GR|GS|UP|FG|BR|HZ)*$/.test(x) && /(DZ|RA|SH|TS|SN|GR|GS|PL|SG|UP)/.test(x));
  let lluvia = null, cerca = null, truena = false;
  for (const x of wx) {
    if (x.startsWith('VC')) { cerca = x.includes('TS') ? 'tormenta' : 'chubascos'; continue; }
    if (x.includes('VC')) { if (x.includes('TS')) truena = true; cerca = 'chubascos'; continue; }     // TSVCSH: truena aquí, chubascos cerca
    if (x.includes('TS')) truena = true;
    if (/RA|GR|GS|PL|UP/.test(x) || (/SH/.test(x) && !/DZ/.test(x))) {
      const clase = x.startsWith('+') ? 'fuerte' : x.startsWith('-') ? 'ligera' : 'moderada';
      if (!lluvia || ['ligera', 'moderada', 'fuerte'].indexOf(clase) > ['ligera', 'moderada', 'fuerte'].indexOf(lluvia.clase)) lluvia = { clase, tormenta: x.includes('TS') };
    } else if (/DZ/.test(x) && !lluvia) lluvia = { clase: x.startsWith('+') ? 'fuerte' : x.startsWith('-') ? 'ligera' : 'moderada', tormenta: false, llovizna: true };
  }
  return { auto, lluvia, cerca, truena: truena && !lluvia };
}

/** El «ahora» con el parte de Albrook: temperatura, humedad y viento medidos; si el parte lo hizo un observador, también si llueve.
 *  Las nubes y la luz del sol siguen siendo del modelo (el METAR no mide radiación). Los mm de lluvia para los cálculos (la
 *  lluvia con viento por fachada) siguen siendo los del modelo: el parte no da milímetros. */
function conAlbrook(v, a) {
  const edad = a ? Date.now() - a.t : Infinity;
  if (!a || edad > ALBROOK_VIGENTE || edad < -15 * 60e3 || a.tmpf == null) return { ...v, albrook: null, albrookViejo: a && a.tmpf != null ? a : null };
  const wx = tiempoPresente(a.raw), hora = new Date(a.t - 5 * 3600e3).toISOString().slice(11, 16);
  const temp = Math.round((a.tmpf - 32) / 1.8), x = { ...v, temp, recibido: Date.now() };
  if (a.relh != null) x.humedad = a.relh;
  if (a.sknt != null) { x.viento = a.sknt * 1.852; if (a.drct != null && a.sknt > 0) x.dir = a.drct; }
  x.lluviaMm = v.lluvia;                                   // la del modelo, para la lluvia con viento por fachada
  if (!wx.auto) {
    x.lluvia = wx.lluvia ? ALBROOK_MMH[wx.lluvia.llovizna ? 'llovizna' : wx.lluvia.clase] : 0;
    x.llovizna = false;
    if (!wx.lluvia) x.lluviaMm = 0;
  }
  x.albrook = { hora, auto: wx.auto, lluvia: wx.lluvia, cerca: wx.cerca, truena: wx.truena, raw: a.raw };
  return x;
}

/** Cómo se dice lo que informa el parte, sin afirmar que llueve en el edificio. */
export function textoAlbrook(A) {
  if (!A) return '';
  if (A.auto) return `el parte automático de las ${A.hora} no informa si llueve`;
  if (A.lluvia) return A.lluvia.llovizna ? `Albrook informó llovizna ${A.lluvia.clase} a las ${A.hora}`
    : `Albrook informó lluvia ${A.lluvia.clase}${A.lluvia.tormenta ? ' con tormenta' : ''} a las ${A.hora}`;
  if (A.truena) return `Albrook informó tormenta sin lluvia en el aeropuerto a las ${A.hora}`;
  if (A.cerca) return `Albrook informó ${A.cerca === 'tormenta' ? 'tormenta' : 'chubascos'} en las cercanías (a entre 8 y 16 km del aeropuerto) a las ${A.hora}`;
  return `Albrook no informó lluvia a las ${A.hora}`;
}
