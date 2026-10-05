// Lectura de rendimiento en pantalla para medir en el teléfono de LM. Solo con ?medir=1 en la URL; sin ese parámetro main.js no importa este módulo. Arriba a la izquierda, letra de datos, con
// los colores de cuerpo.html. Tocar el recuadro o «Copiar» copia el texto para pegarlo en el chat.
//   motor (WebGPU, WebGPU compat o WebGL 2) · nivel de calidad · relación de píxeles · cuadros por segundo (promedio de 1 s,
//   solo cuadros dibujados) · peor cuadro de los últimos 5 s · llamadas de dibujo y triángulos del último cuadro (con la sombra
//   y el posproceso) · opción de sombra y tamaño del mapa.
// El visor no dibuja cuando nada cambia: en reposo los cuadros por segundo bajan a 0 y eso no es lentitud. Para medir, girar.

const num = (x, d = 0) => {
  const [e, f] = Math.abs(x).toFixed(d).split('.');
  return (x < 0 ? '−' : '') + e.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (f ? ',' + f : '');
};

export function medir(escena) {
  const r = escena.renderer;
  r.info.autoReset = false;                       // se suma todo lo de un cuadro (sombra, escena y posproceso)
  const ultimo = { llamadas: 0, triangulos: 0 };
  let dibujo = 0;                                  // cuadros dibujados desde el último tick
  const orig = escena.render.bind(escena);
  escena.render = (...a) => {
    r.info.reset();
    const t = orig(...a);
    ultimo.llamadas = r.info.render.drawCalls; ultimo.triangulos = r.info.render.triangles; dibujo++;
    return t;
  };
  // ticks de requestAnimationFrame: [tiempo, dibujó]. Peor cuadro = el intervalo más largo entre dos ticks seguidos que
  // dibujaron los dos (un salto después de estar en reposo no cuenta)
  const ticks = [];
  let previo = null;
  // último giro: la última racha de cuadros dibujados seguidos (≥ 0,5 s), guardada para poder copiarla después con calma
  let racha = [], giro = null;
  const resumir = (r) => {
    if (r.length < 2 || r[r.length - 1].t - r[0].t < 500) return null;
    const dts = r.slice(1).map((k) => k.dt).sort((a, b) => a - b), dur = r[r.length - 1].t - r[0].t;
    return { dur, fps: dts.length / (dur / 1000), peor: dts[dts.length - 1], p95: dts[Math.min(dts.length - 1, Math.floor(dts.length * 0.95))] };
  };
  const cerrarRacha = () => { giro = resumir(racha) ?? giro; racha = []; };
  const tick = (now) => {
    const d = dibujo > 0; dibujo = 0;
    if (previo) ticks.push({ t: now, dt: now - previo.t, vale: d && previo.d, d });
    if (d) { racha.push({ t: now, dt: previo ? now - previo.t : 0 }); if (racha.length > 2000) racha.shift(); } else cerrarRacha();
    previo = { t: now, d };
    while (ticks.length && now - ticks[0].t > 5000) ticks.shift();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const caja = document.createElement('div');
  caja.id = 'medir';
  caja.setAttribute('role', 'status');
  caja.style.cssText = 'position:fixed;left:12px;top:calc(env(safe-area-inset-top, 0px) + 64px);z-index:80;max-width:calc(100vw - 24px);'
    + 'background:var(--panel-2);border:1px solid var(--linea-2);border-radius:12px;padding:8px 10px;color:var(--cal);'
    + 'font:500 11px/1.45 var(--datos);font-variant-numeric:tabular-nums;backdrop-filter:blur(10px);cursor:pointer;user-select:text';
  const pre = document.createElement('pre');
  pre.style.cssText = 'margin:0;font:inherit;white-space:pre-wrap';
  const fila = document.createElement('div');
  fila.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:6px';
  const boton = document.createElement('button');
  boton.type = 'button'; boton.textContent = 'Copiar';
  boton.style.cssText = 'font:600 12px/1 var(--texto);color:var(--cal);background:none;border:1px solid var(--linea-2);border-radius:999px;padding:6px 12px;cursor:pointer';
  const aviso = document.createElement('span');
  aviso.style.cssText = 'font:500 11px/1 var(--datos);color:var(--cal-2)';
  fila.append(boton, aviso); caja.append(pre, fila); document.body.append(caja);

  // racha en curso (las últimas 600) o, si no hay, la última terminada
  const lineaGiro = () => {
    const actual = resumir(racha.slice(-600)), g = actual ?? giro;
    if (!g) return 'último giro: todavía no (gira la vista unos 5 s)';
    return `${actual ? 'giro en curso' : 'último giro'} ${num(g.dur / 1000, 1)} s · ${num(g.fps)} fps · p95 ${num(g.p95, 1)} ms · peor ${num(g.peor, 1)} ms`;
  };
  const backend = () => escena.backend + (r.backend?.compatibilityMode ? ' compat' : '');
  const texto = () => {
    const now = performance.now(), ult = ticks.filter((k) => now - k.t <= 1000);
    const fps = ult.filter((k) => k.d).length;
    const validos = ticks.filter((k) => k.vale), peor = validos.length ? Math.max(...validos.map((k) => k.dt)) : null;
    const q = escena.calidad, e = escena.ciudadOpc, sh = escena.sun?.shadow, m = sh?.mapSize?.x ?? 0;
    const modo = e ? e.sombra + (e.porDefecto ? ' (por defecto)' : '') : 'actual (sin ciudad)';
    const fina = `${num(m)} (±70 m, texel ${num(140 / Math.max(1, m) * 100, 1)} cm)`;
    const mapa = e?.sombra === 'sunlight' ? `${num(m)} por cascada (atlas ${num(2 * m)} × ${num(m)})` : e?.sombra === 'csm' ? `${num(m)} por cascada (3)` : fina;
    const G = escena._gruesa, gruesa = e?.sombra === 'doble' ? ` · gruesa ${escena.uGruesa?.value > 0 && G ? `${num(G.mapa)} (texel ${num(G.texel, 2)} m)` : 'apagada'}` : '';
    const pedido = e?.mapa ? ` · pedido ${num(e.mapa)}` : '';
    const c = e?.cap, eq = c ? `equipo ${c.telefono ? 'teléfono' : 'computador'}${c.gpu || c.vendedor ? ` · ${[c.vendedor, c.arquitectura, c.gpu].filter(Boolean).join(' ')}` : ''}${c.memoria != null ? ` · ${num(c.memoria)} GB` : ''}${c.nucleos != null ? ` · ${num(c.nucleos)} núcleos` : ''}${c.debil ? ' · gama baja' : c.fuerte ? ' · gama alta' : ''}` : null;
    const estado = !e ? 'no' : escena.ciudadEncendida === false ? 'apagada en Capas' : escena.ciudadLista ? 'montada' : 'cargando';
    return [
      `motor ${backend()} · nivel ${q.nivel}${q.tejasLivianas ? ' (teléfono)' : ''}`,
      `dpr ${num(r.getPixelRatio(), 2)} (dispositivo ${num(devicePixelRatio, 2)}) · lienzo ${r.domElement.width}×${r.domElement.height}`,
      `fps ${fps} (1 s)${fps === 0 ? ' en reposo' : ''} · peor ${peor === null ? '—' : num(peor, 1) + ' ms'} (5 s)`,
      lineaGiro(),
      `llamadas ${num(ultimo.llamadas)} · triángulos ${num(ultimo.triangulos / 1000)} k`,
      `sombra ${modo} · mapa ${mapa}${gruesa}${pedido}${e?.maxTex ? ` · máx ${num(e.maxTex)}` : ''}`,
      `ciudad ${estado}${e ? ` · nivel ${e.nivel} (${e.motivo})${e.sondeoMs != null ? ` · sondeo ${num(e.sondeoMs, 1)} ms` : ''} · detalle alto ${escena.ciudad?.altoActivo ? 'sí' : 'no'}` : ''}`,
      ...(eq ? [eq] : []),
      ...(e?.caidas?.length ? [`bajó sola: ${e.caidas.map((k) => `${k.de} → ${k.a} a los ${num(k.s)} s (mediana ${num(k.medianaMs, 1)} ms, cuadro ${k.cuadroMs == null ? '—' : num(k.cuadroMs, 1)} ms)`).join(' · ')}`] : []),
    ].join('\n');
  };
  const pintar = () => { pre.textContent = texto(); };
  setInterval(pintar, 500); pintar();

  // copiar: por http a una IP el teléfono no es contexto seguro y no hay navigator.clipboard; entonces execCommand con un
  // textarea, y si tampoco, el texto queda seleccionado para copiarlo a mano
  const copiar = async (ev) => {
    ev.stopPropagation();
    const t = `${texto()}\nurl ${location.search}${location.hash}\n${navigator.userAgent}`;
    let ok = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); ok = true; } } catch (e) { /* sigue */ }
    if (!ok) {
      const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:0;top:0;opacity:0;font-size:16px';
      document.body.append(ta); ta.select(); ta.setSelectionRange(0, t.length);
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
    }
    if (!ok) { const s = getSelection(), rg = document.createRange(); rg.selectNodeContents(pre); s.removeAllRanges(); s.addRange(rg); }
    aviso.textContent = ok ? 'copiado' : 'selecciónalo y cópialo';
    setTimeout(() => { aviso.textContent = ''; }, 2500);
  };
  boton.addEventListener('click', copiar);
  caja.addEventListener('click', copiar);
  // que tocar el recuadro no mueva la cámara
  for (const ev of ['pointerdown', 'touchstart', 'wheel']) caja.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
}
