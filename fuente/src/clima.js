// Clima del Edificio 106: 25 años hora por hora (2001–2025, Open-Meteo), valores típicos por mes y hora,
// y el tiempo real (pronóstico de modelo de Open-Meteo, que se actualiza cada 15 min).
import { binario } from './datos.js';
import { LAT, LON } from './sol.js';

const T0 = Date.UTC(2001, 0, 1, 0);            // primera hora de la serie (hora de Panamá tratada como UTC)
const COLS = ['nubes', 'lluvia', 'temp', 'humedad', 'dni', 'difusa', 'viento', 'dir'];
const ESC = { nubes: [1, 0], lluvia: [5, 0], temp: [6, 10], humedad: [1, 0], dni: [0.25, 0], difusa: [0.25, 0], viento: [1, 0], dir: [0.5, 0] };

export class Clima {
  constructor() { this.ok = false; this.horario = null; this.vivo = null; this.dias = {}; }

  async cargarResumen(url) {
    try { this.r = await (await fetch(url)).json(); this.ok = true; } catch (e) { this.ok = false; }
    return this.ok;
  }

  async cargarHorario(base) {
    const b = await binario(base + 'datos/clima_horario.bin');
    const n = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(4, true);
    const c = {}; COLS.forEach((k, i) => { c[k] = b.subarray(8 + i * n, 8 + (i + 1) * n); });
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
    return { fuente: 'serie', nubes: L('nubes'), lluvia: this.valor('lluvia', b), temp: L('temp'), humedad: L('humedad'),
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
    return { fuente: 'tipico', nubes: g(r.nubes), temp: g(r.temp), tempBaja: g(r.temp, 'p10'), tempAlta: g(r.temp, 'p90'), humedad: g(r.humedad),
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

  /** Tiempo real: pronóstico de modelo de Open-Meteo para las coordenadas del edificio. */
  async cargarVivo() {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,direct_normal_irradiance,diffuse_radiation,is_day&timezone=America%2FPanama`;
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 5000);
    try {
      const r = await fetch(u, { signal: ctl.signal }); if (!r.ok) throw new Error(r.status);
      const j = await r.json(), c = j.current;
      // la precipitación actual es la suma de los últimos `interval` segundos (15 min): se lleva a mm por hora
      const k = 3600 / (c.interval || 900);
      this.vivo = { fuente: 'vivo', hora: c.time.slice(11, 16), fecha: c.time.slice(0, 10), nubes: c.cloud_cover, lluvia: c.precipitation * k, lluvia15: c.precipitation, temp: c.temperature_2m,
        humedad: c.relative_humidity_2m, viento: c.wind_speed_10m, dir: c.wind_direction_10m, dni: c.direct_normal_irradiance ?? null, difusa: c.diffuse_radiation ?? null, recibido: Date.now() };
    } catch (e) { this.vivo = null; }
    finally { clearTimeout(to); }
    return this.vivo;
  }
}
