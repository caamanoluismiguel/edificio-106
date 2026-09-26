// Sonido procedural (Web Audio): zumbido grave, brillo de partículas ligado a la velocidad del scroll,
// ambiente tropical que sigue la hora (pájaros al amanecer, insectos de noche) y un clic por hora.
export class Sonido {
  constructor() { this.on = false; }

  iniciar() {
    if (this.ctx) { this.ctx.resume(); this.on = true; return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = new C(); this.ctx = ctx;
    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination); this.master = master;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(master); this.lp = lp;
    // zumbido: dos senos desafinados + quinta suave
    this.dron = ctx.createGain(); this.dron.gain.value = 0.0; this.dron.connect(lp);
    for (const [f, g] of [[55, 0.5], [55.4, 0.5], [82.5, 0.22], [110.3, 0.12]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const gg = ctx.createGain(); gg.gain.value = g; o.connect(gg).connect(this.dron); o.start();
    }
    // ruido base (para brillo, insectos y lluvia)
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const ruido = () => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    // brillo de partículas: ruido pasa-banda alto, ganancia = velocidad del scroll
    this.brillo = ctx.createGain(); this.brillo.gain.value = 0;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 3;
    ruido().connect(bp).connect(this.brillo).connect(master);
    // insectos nocturnos: pulsos de ~4,6 kHz
    this.grillos = ctx.createGain(); this.grillos.gain.value = 0;
    const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 4600; bp2.Q.value = 18;
    const am = ctx.createGain(); am.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 28; const lg = ctx.createGain(); lg.gain.value = 0.5;
    lfo.connect(lg).connect(am.gain); lfo.start();
    ruido().connect(bp2).connect(am).connect(this.grillos).connect(master);
    // lluvia: ruido rosado aproximado
    this.lluviaG = ctx.createGain(); this.lluviaG.gain.value = 0;
    const lpR = ctx.createBiquadFilter(); lpR.type = 'lowpass'; lpR.frequency.value = 2400;
    ruido().connect(lpR).connect(this.lluviaG).connect(master);
    this.on = true;
    master.gain.setTargetAtTime(0.8, ctx.currentTime, 0.6);
    this._pajaros();
  }

  apagar() { if (!this.ctx) return; this.on = false; this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); }
  encender() { if (!this.ctx) return this.iniciar(); this.on = true; this.ctx.resume(); this.master.gain.setTargetAtTime(0.8, this.ctx.currentTime, 0.4); }

  // estado: {dron 0..1, velocidad 0..1, alt (grados), lluvia 0..1, cenit bool}
  actualizar(e) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    this.dron.gain.setTargetAtTime(0.09 * (e.dron ?? 0.5), t, 0.5);
    this.lp.frequency.setTargetAtTime(e.cenit ? 280 : 600 + 900 * (e.dron ?? 0.5), t, 0.8);
    this.brillo.gain.setTargetAtTime(e.cenit ? 0 : Math.min(0.05, 0.05 * (e.velocidad ?? 0)), t, 0.08);
    const noche = e.alt < -4 ? 1 : e.alt < 3 ? (3 - e.alt) / 7 : 0;
    this.grillos.gain.setTargetAtTime(e.cenit ? 0 : 0.035 * noche, t, 0.6);
    this.lluviaG.gain.setTargetAtTime(0.09 * (e.lluvia ?? 0), t, 0.6);
    this.alt = e.alt; this.cenit = e.cenit;
  }

  clic() {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 1320; g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.08);
  }

  /** Trueno: estruendo grave con retraso de 1 a 4 s (distancia de la descarga). */
  trueno() {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime + 1 + Math.random() * 3, dur = 2.5 + Math.random() * 2;
    const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let v = 0; for (let i = 0; i < len; i++) { v = v * 0.985 + (Math.random() * 2 - 1) * 0.15; d[i] = v; }
    const s = ctx.createBufferSource(); s.buffer = buf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180 + Math.random() * 120;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(lp).connect(g).connect(this.master); s.start(t); s.stop(t + dur + 0.1);
  }

  _pajaros() {
    // cantos breves y aleatorios entre el amanecer y media mañana, y al final de la tarde
    const cantar = () => {
      if (this.ctx && this.on && !this.cenit && this.alt > -2 && (this.alt < 35)) {
        const t = this.ctx.currentTime + 0.05, n = 2 + Math.floor(Math.random() * 4), f0 = 2200 + Math.random() * 1800;
        for (let i = 0; i < n; i++) {
          const o = this.ctx.createOscillator(), g = this.ctx.createGain(), s = t + i * (0.09 + Math.random() * 0.05);
          o.type = 'sine'; o.frequency.setValueAtTime(f0, s); o.frequency.exponentialRampToValueAtTime(f0 * (1.3 + Math.random() * 0.4), s + 0.07);
          g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.02, s + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.08);
          o.connect(g).connect(this.master); o.start(s); o.stop(s + 0.1);
        }
      }
      setTimeout(cantar, 1400 + Math.random() * 4200);
    };
    setTimeout(cantar, 2000);
  }
}
