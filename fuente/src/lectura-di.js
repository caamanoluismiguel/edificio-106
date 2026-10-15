// Las dos lecturas a la vista (fase 3 de la integración de D.I.Visor): el conmutador «Arquitectura y clima | Diseño industrial»,
// la entrada doble, la ficha de la pieza, el recorrido «Construir el 106» y la URL de la lectura. No trae piezas de interfaz
// propias: usa las del 106 (el HUD, el dock, la tarjeta de la lente #leyenda, la tarjeta del recorrido #recorrido y la oferta
// #oferta-recorrido), así el lenguaje es el mismo. El dibujo es el de dibujo.js (escena.ponerLecturaDI). Todo el contenido sale de
// datos/di/ (fichas.json y etapas.json, carril F); aquí solo hay rótulos de interfaz.
import { conVersion } from './datos.js';
import { CERTEZA } from './mecanismos/comun.js';
import { MECANISMOS, svgUbicacion } from './mecanismos/indice.js';
import { crearAnfitrion } from './mecanismos/anfitrion.js';
import { posicionSol, FACHADAS } from './sol.js';
import { perfil } from './cartasolar.js';

export const CLAVE_ENTRADA = 'e106-lecturas';   // la entrada doble ya se respondió en este navegador (no es e106-visto: DUDAS.md, punto 5)
export const CLAVE_DI = 'e106-di-visto';        // ya se ofreció «Construir el 106» en este navegador
const SEG_ETAPA = 30;                            // s por etapa con «Reproducir»: 10 etapas, 5 minutos
const PARAMS = ['lectura', 'pieza', 'corte', 'contexto', 'etapa', 'meca', 'mopc'];
const EJE = { planta: 'y', longitudinal: 'z', transversal: 'x' };
const NOMBRE_LENTE = { piezas: 'Piezas', construir: 'Construir el 106', mecanismos: 'Mecanismos' };
const maquina = (v) => String(+(+v).toFixed(2));          // metros y posiciones en la URL: con punto, formato de máquina (A8)
const maquinaPos = (v) => String(+(+v).toFixed(3));      // la posición del mecanismo, con la precisión de su paso (0,005)
const leerNum = (t) => (t == null || t === '' ? undefined : parseFloat(String(t).replace(',', '.')));

// Familias de datos/familias.json que etapas.json no lista: se dibujan en la etapa de su sistema (F3.md, punto 7). Es solo dibujo:
// ningún texto de las etapas cambia por esto. Las familias provisionales (sin clave en familias.json) van por su sistema.
const EXTRA_ETAPA = {
  pilar: 'base', rejilla_galeria: 'base', franja_oscura: 'base',
  piso_interior: 'cuerpo', cielorraso: 'cuerpo', tarima_so: 'cuerpo', volumen_interior: 'cuerpo', difusor: 'cuerpo',
  cumbrera: 'techo', faldon: 'techo', faja_atico: 'techo',
  panel_ne: 'ventanas',
  marco_puerta: 'accesos', murete: 'accesos', losa_entrada: 'accesos',
  mastil: 'instalaciones', poste_luz: 'instalaciones', soporte_bicicletas: 'instalaciones',
};
const SISTEMA_ETAPA = { base: 'base', estructura: 'cuerpo', muros: 'cuerpo', cubierta: 'techo', ventanas: 'ventanas', accesos: 'accesos', servicios: 'instalaciones' };
// Fase 4a: «Ver de cerca» en la ficha de una pieza (de familia de datos/familias.json a mecanismo de src/mecanismos/) y en la etapa
// del recorrido (de id de datos/di/etapas.json a mecanismos). Cada mecanismo va en la etapa que trae una de sus familias en
// etapas.json o en EXTRA_ETAPA (el bloque calado está en «base», no en «cuerpo»). Son tablas de contenido: van al verificador.
export const MECA_FAMILIA = {
  teja: 'teja', alfeizar: 'alfeizar', tubo_vertical: 'tubo', abrazadera: 'tubo', cubretubos: 'tubo', letrero: 'letrero',
  bloque_calado: 'bloque', mensula: 'mensula', cabio: 'mensula', tablero_alero: 'alero', tabla_frente: 'alero',
  baranda_entrada: 'baranda', baranda_parda: 'baranda', puerta_parda: 'puerta', hoja_guillotina: 'guillotina', travesano: 'guillotina',
  parteluz: 'guillotina', puerta_principal: 'principal', lama_celosia: 'celosia', gabinete: 'gabinete', condensadora: 'condensadora',
  poste_luz: 'poste', gablete: 'gablete', rampa: 'rampa', escalera_entrada: 'rampa',
};
export const MECANISMOS_ETAPA = {
  base: ['bloque'], mensulas: ['mensula'], aleros: ['alero'], techo: ['gablete'], teja: ['teja'], ventanas: ['guillotina', 'alfeizar'],
  celosias: ['celosia'], accesos: ['puerta', 'principal', 'rampa', 'baranda'], instalaciones: ['condensadora', 'gabinete', 'tubo', 'letrero', 'poste'],
};
// el alero (B5): la fachada del sol, como el corte del alero, y «Prueba un ángulo · sin fecha», apagado por defecto
const SOL_FACHADAS = ['se', 'no', 'ne', 'so'];

const certezaTxt = (k) => CERTEZA[k] ?? (k ? k[0].toUpperCase() + k.slice(1) : '');
const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const guardar = (k) => { try { localStorage.setItem(k, '1'); } catch (e) { /* sin almacenamiento: vuelve a salir */ } };

/** ctx: lo que la lectura necesita de main.js (nada más). */
export function crearLecturaDI(ctx) {
  const { $, S } = ctx, html = document.documentElement;
  const q0 = new URLSearchParams(location.search);
  const [corte0, corteV0] = (q0.get('corte') ?? '').split(':'), [meca0, mecaM0] = (q0.get('meca') ?? '').split(':');
  const D = {
    activa: /[?&]lectura=di(?:&|#|$)/.test(location.search),
    lente: MECANISMOS[meca0] ? 'mecanismos' : 'piezas', pieza: null, corte: EJE[corte0] ? corte0 : '',
    cortes: EJE[corte0] && Number.isFinite(leerNum(corteV0)) ? { [EJE[corte0]]: leerNum(corteV0) } : {},   // metros de cada eje en esta visita (A3)
    meca: null, mecaURL: MECANISMOS[meca0] ? { clave: meca0, m: leerNum(mecaM0), opc: leerOpciones() } : null, famJSON: null,
    contexto: q0.get('contexto') === 'solido' ? 'solido' : 'fantasma',
    etapa: null, etapaURL: Math.max(0, parseInt(q0.get('etapa'), 10) || 0), reproduce: false, tEtapa: 0,
    fichas: null, etapas: null, familias: null, enEntrada: false, verLeyClima: false,
  };
  const enLink = D.activa || /[?&]lectura=/.test(location.search);

  // ---- contenido: datos/di/ y los nombres de familias.json (se piden la primera vez que hacen falta)
  let pDatos = null;
  const cargar = () => (pDatos ??= Promise.all(['datos/di/fichas.json', 'datos/di/etapas.json', 'datos/familias.json']
    .map((f) => fetch(conVersion(ctx.BASE + f)).then((r) => (r.ok ? r.json() : null)).catch(() => null)))
    .then(([f, e, fam]) => { D.fichas = f; D.etapas = Array.isArray(e) ? e : null; D.familias = fam?.familias ?? null; D.famJSON = fam; ctx.refrescar(); }));
  /** mopc=<id>.<valor>,… (B7). Se lee del texto crudo de la URL: un valor puede llevar coma (el vano «1,63» de la guillotina),
   *  que va codificada (%2C), y URLSearchParams la decodificaría antes de partir. */
  function leerOpciones() {
    const crudo = location.search.replace(/^\?/, '').split('&').find((x) => x.startsWith('mopc='))?.slice(5) ?? '';
    const o = {};
    for (const par of crudo.split(',').filter(Boolean)) { const k = par.indexOf('.'); if (k > 0) try { o[decodeURIComponent(par.slice(0, k))] = decodeURIComponent(par.slice(k + 1)); } catch (e) { /* mal escrito */ } }
    return o;
  }

  // ---- el dibujo de dibujo.js
  const dibujo = () => ctx.escena()?.di;
  function conectar() {
    const di = dibujo(); if (!di || di._lectura) return di;
    di._lectura = true;
    di.alElegir = (id) => { D.pieza = id; if (id) D.lente = 'piezas';   // tocar una pieza da su ficha (con «Ver de cerca» si tiene mecanismo)
      ctx.cerrarOferta(); S.verLeyenda = true; if (id) ctx.soloUnPanel('leyenda'); escribirURL(); pintarConmutador(); ctx.refrescar(); };
    if (D.contexto !== di.contexto) di.fijarContexto(D.contexto);
    if ((di.corte?.eje ?? '') !== (EJE[D.corte] ?? '')) di.cortar(EJE[D.corte], D.cortes[EJE[D.corte]]);
    if (di.corte) D.cortes[di.corte.eje] = di.corte.valor;
    return di;
  }

  // ---- el conmutador: cambia de lectura con un fundido de 400 ms del lienzo (corte seco con movimiento reducido)
  function poner(on, { cruce = true, ofrecer = true } = {}) {
    on = !!on;
    if (on === D.activa && html.classList.contains('lectura-di') === on) return;
    const aplicar = () => {
      if (on) {
        D.verLeyClima = !!S.verLeyenda;
        ctx.alEntrar();                                    // cierra lo que es de la luz; la cámara, la hora y la forma de ver no se tocan
        D.activa = true; html.classList.add('lectura-di');
        ctx.escena().ponerLecturaDI(true); conectar(); cargar();
        S.verLeyenda = !ctx.telefono() || !!D.pieza || !!D.corte;   // en la hoja del teléfono, primero el narrador («Toca una pieza…»); la ficha sale al tocar.
        // Con un eje de corte elegido, la tarjeta se abre: su deslizador va en la hoja cerrada (pendiente 9, parte 1)
      } else {
        cerrarMeca(true);
        pararRecorrido(true);
        D.activa = false; html.classList.remove('lectura-di');
        ctx.escena().ponerLecturaDI(false);
        S.verLeyenda = D.verLeyClima;
        ctx.alSalir();
      }
      pintarConmutador(); pintarOferta();
      const ley = $('#leyenda'); ley.classList.remove('texto'); delete ley.dataset.lente; delete ley.dataset.escala;
      escribirURL(); ctx.refrescar();
      if (on && ofrecer) ofrecerRecorrido();
    };
    ctx.cerrarOferta();
    const lienzo = $('#lienzo');
    if (!cruce || ctx.reduce) { aplicar(); return; }
    lienzo.style.background = on ? 'var(--cal)' : '#101b21';          // se funde hacia el fondo de la lectura que llega
    html.classList.add('cruzando');
    clearTimeout(poner.t);
    poner.t = setTimeout(() => {
      aplicar();
      requestAnimationFrame(() => requestAnimationFrame(() => { html.classList.remove('cruzando'); setTimeout(() => { lienzo.style.background = ''; }, 220); }));
    }, 200);
  }
  function pintarConmutador() {
    document.querySelectorAll('#lecturas [data-lectura]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.lectura === 'di') === D.activa)));
    const lente = lenteActiva();
    document.querySelectorAll('.lentes [data-lente-di]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lenteDi === lente)));
    $('#modo-activo-t').textContent = D.activa ? NOMBRE_LENTE[lente] : ctx.nombreLenteClima();
  }

  const lenteActiva = () => (D.meca && D.etapa == null ? 'mecanismos' : D.etapa != null ? 'construir' : D.lente);

  // ---- URL: ?lectura=di&pieza=…&corte=<eje>:<m>&contexto=solido&etapa=N&meca=<clave>:<pos>&mopc=<id>.<valor>,…, con
  // replaceState; el momento sigue en el #m-…. El corte lleva siempre sus metros, también los de por defecto (A8)
  function params() {
    if (!D.activa) return [];
    const p = ['lectura=di'];
    if (D.pieza) p.push('pieza=' + encodeURIComponent(D.pieza));
    if (D.corte) { const v = dibujo()?.corte?.valor ?? D.cortes[EJE[D.corte]]; p.push('corte=' + D.corte + (v != null ? ':' + maquina(v) : '')); }
    if (D.pieza && D.contexto === 'solido') p.push('contexto=solido');
    if (D.etapa != null) p.push('etapa=' + (D.etapa + 1));
    if (D.meca) {
      const M = D.meca, opc = Object.entries(M.opc).filter(([k, v]) => v !== M.inicial[k]).map(([k, v]) => encodeURIComponent(k) + '.' + encodeURIComponent(v));
      p.push('meca=' + M.clave + ':' + maquinaPos(M.m));
      if (opc.length) p.push('mopc=' + opc.join(','));
    }
    return p;
  }
  function escribirURL() {
    const otros = location.search.replace(/^\?/, '').split('&').filter((x) => x && !PARAMS.includes(x.split('=')[0]));
    const q = [...otros, ...params()];
    try { history.replaceState(null, '', location.pathname + (q.length ? '?' + q.join('&') : '') + location.hash); } catch (e) { /* visor */ }
  }

  // ---- la tarjeta de la lente: la ficha de la pieza, con su certeza como sello (siempre a la vista)
  const nombreFam = (id) => D.familias?.[id]?.nombre ?? id;
  function filas(dl, pares) {
    dl.replaceChildren(...pares.flatMap(([k, v]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; return [dt, dd]; }));
    dl.hidden = !pares.length;
  }
  function parrafo(id, txt) { $(id + '-p').hidden = !txt; $(id).textContent = txt ?? ''; }
  function leyenda() {
    const el = $('#leyenda');
    el.hidden = !S.verLeyenda || (D.etapa != null && !D.meca) || D.enEntrada;
    $('#lente-info').setAttribute('aria-expanded', String(!el.hidden));
    if (el.hidden) return;
    const lista = D.lente === 'mecanismos' && !D.meca, M = D.meca;
    const id = lista || M ? null : D.pieza, f = id ? D.fichas?.[id] : null;
    const clave = M ? `di-meca-${M.clave}|${M.version}` : lista ? 'di-lista' : `di-${id ?? '-'}|${D.corte}|${D.contexto}|${D.fichas ? 1 : 0}|${D.familias ? 1 : 0}`;
    if (el.dataset.lente === clave) return;
    el.dataset.lente = clave;
    if (el.classList.contains('texto')) { el.classList.remove('texto'); ctx.textoLeyenda(false); }
    // tres contenidos en la misma tarjeta: la ficha de la pieza, la lista de los mecanismos y el detalle de uno
    $('#di-ficha').hidden = !!(lista || M); $('#di-meca-lista').hidden = !lista; $('#di-meca').hidden = !M;
    $('#ley-que').hidden = !!M;
    if (M) { pintarMeca(); ctx.hayMas(el); return; }
    if (lista) {
      $('#ley-t').textContent = 'Mecanismos';
      $('#ley-que').textContent = 'Elige uno para verlo de cerca.';
      ctx.ponSello($('#ley-sello'), ''); $('#ley-nota').hidden = true;
      ctx.hayMas(el); return;
    }
    $('#ley-t').textContent = !id ? 'Piezas' : f ? f.titulo : nombreFam(id);
    $('#ley-que').textContent = !id ? 'Toca una pieza del edificio para ver qué es y cómo se sabe.'
      : f ? f.texto : 'Esta pieza todavía no tiene ficha.';
    document.querySelectorAll('#di-corte [data-corte-di]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.corteDi === D.corte)));
    pintarCorte();
    $('#di-cerca').hidden = !(id && MECA_FAMILIA[id]);
    $('#di-contexto-caja').hidden = !id;
    document.querySelectorAll('#di-contexto [data-contexto]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.contexto === D.contexto)));
    filas($('#di-datos'), f?.datos ?? []);
    const F = f?.fachada;
    $('#di-fachada').hidden = !F;
    if (F) {
      $('#di-fachada-t').textContent = F.titulo; $('#di-fachada-txt').textContent = F.texto;
      filas($('#di-fachada-datos'), F.datos ?? []);
      ctx.ponSello($('#di-fachada-fuente'), F.fuente ? 'Fuente: ' + F.fuente : '');
    }
    $('#di-mas').hidden = !f;
    if (f) {
      $('#di-certezas').replaceChildren(...(f.certezas ?? []).map(([k, v]) => { const li = document.createElement('li'), b = document.createElement('b'); b.textContent = k + ': '; li.append(b, certezaTxt(v)); return li; }));
      parrafo('#di-decision', f.decision); parrafo('#di-del106', f.proceso?.del_106); parrafo('#di-tipico', f.proceso?.tipico);
      parrafo('#di-principio', f.principio); parrafo('#di-foto', f.foto_que_falta); parrafo('#di-fuente', f.fuente);
    }
    ctx.ponSello($('#ley-sello'), f ? certezaTxt(f.certeza) : '');
    const nota = id ? 'Toca otra pieza para ver la suya, o el papel para soltarla.' : '';
    $('#ley-nota').textContent = nota; $('#ley-nota').hidden = !nota;
    ctx.hayMas(el);
  }

  // ---- el deslizador del corte (A1 a A8): visible con un eje elegido; el arrastre va por el camino rápido (moverCorte, una vez
  // por cuadro) y la URL se escribe al soltar
  function pintarCorte() {
    const di = dibujo(), caja = $('#di-corte-pos'), c = di?.corte;
    caja.hidden = !c; $('#di-corte-val').textContent = c ? di.posCorte() : '';
    if (!c) return;
    const [lo, hi] = di.rangoCorte(c.eje);
    caja.min = lo; caja.max = hi; caja.step = 0.1; caja.value = c.valor;
    caja.setAttribute('aria-valuetext', di.textoCorte()[0] ?? '');
  }
  let corteRAF = 0, cortePend = null;
  function moverCorte(v) {
    cortePend = v;
    if (corteRAF) return;
    corteRAF = requestAnimationFrame(() => {
      corteRAF = 0; const di = dibujo(); if (!di?.corte || cortePend == null) return;
      di.moverCorte(cortePend); cortePend = null;
      D.cortes[di.corte.eje] = di.corte.valor;
      $('#di-corte-val').textContent = di.posCorte();
      $('#di-corte-pos').setAttribute('aria-valuetext', di.textoCorte()[0] ?? '');
    });
  }
  function soltarCorte() {                       // al soltar (o al terminar una ráfaga de teclas): la URL y el aviso al lector
    clearTimeout(soltarCorte.t);
    soltarCorte.t = setTimeout(() => {
      const di = dibujo(); if (!di?.corte) return;
      escribirURL(); $('#di-corte-vivo').textContent = di.textoCorte()[0] ?? '';
    }, 250);
  }

  // ---- los mecanismos de cerca (B1 a B7): el módulo de src/mecanismos/ en el detalle de dibujo.js, con sus controles en la
  // tarjeta de la lente; la cámara del 106 no se toca
  function coloresDetalle() {
    const C = dibujo().C, s = getComputedStyle(html), css = (v, d) => (s.getPropertyValue(v) || '').trim() || d;
    return { papel: C.papel, tinta: C.tinta, enfasis: C.teja, tenue: C.tenue, sol: C.papel.clone().set(css('--sol', '#f4b545')), poche: C.papel.clone().set(css('--cal-2', '#b6bdb9')) };
  }
  const dos = (n) => String(n).padStart(2, '0');
  /** ctx.perfil() del alero: el sol del 106 a la fecha y la hora de la escena sobre la fachada elegida (perfil() de cartasolar.js) */
  function perfilMeca() {
    const M = D.meca; if (!M || !M.sol) return undefined;
    const f = S.fecha, min = S.min, p = posicionSol({ ...f, h: 0, min }), k = M.opc.fachada, sigla = k.toUpperCase();
    const rotulo = `${sigla} · ${dos(f.d)}/${dos(f.m)} ${ctx.hhmm(min)}`, g = perfil(p.alt, p.az, FACHADAS['fachada-' + k].rumbo);
    if (g == null) return { grados: null, rotulo, motivo: p.alt <= 0 ? 'el sol está bajo el horizonte' : `el sol está detrás de la fachada ${sigla}` };
    return { grados: g, rotulo };
  }
  function abrirMeca(clave, { m, opc = {}, desdeEtapa = false } = {}) {
    const di = dibujo(), mod = MECANISMOS[clave]; if (!di || !mod) return;
    if (D.meca) cerrarMeca(true);
    reproducir(false);
    const anf = crearAnfitrion({ colores: coloresDetalle(), perfil: perfilMeca, llueve: ctx.lluviaAhora, familias: D.famJSON ?? undefined });
    const d = mod.crear(anf);
    const inicial = Object.fromEntries((d.opciones ?? []).map((o) => [o.id, o.inicial]));
    if (clave === 'alero') Object.assign(inicial, { fachada: 'se', sol: 'dato' });
    if (d.despiece) inicial.desp = '0';
    const M = D.meca = { clave, mod, d, anf, inicial, opc: { ...inicial }, m: Number.isFinite(m) ? Math.min(1, Math.max(0, m)) : (d.inicial ?? 0.5), sol: true, desp: 0, desdeEtapa, version: 0, vivo: 0 };
    for (const [k, v] of Object.entries(opc)) elegirOpcion(k, v, false);
    ctx.detalle(true);
    di.verDetalle(d, anf, { escala: d.escala ? 'DETALLE · ' + d.escala : '', paso: d.animado && !ctx.reduce ? (dt) => { pintarFrase(d.actualizar(M.m, dt)); } : null });
    html.classList.add('en-detalle'); delete $('#leyenda').dataset.lente;   // la tarjeta se repinta aunque se abra el mismo otra vez
    if (desdeEtapa) $('#recorrido').hidden = true;
    pintarMapa();
    S.verLeyenda = true; ctx.soloUnPanel('leyenda');
    if (S.hoja !== undefined) ctx.ponerHoja(0);         // teléfono: la tarjeta compacta (sello, deslizador y frase), el detalle arriba
    escribirURL(); pintarConmutador(); ctx.refrescar();
    if (ctx.telefono()) setTimeout(() => dibujo()?.encuadrarDetalle(), 380);   // la hoja cambia de alto con la tarjeta nueva
  }
  function cerrarMeca(solo = false) {
    const M = D.meca; if (!M) return;
    D.meca = null;
    dibujo()?.verEdificio();
    html.classList.remove('en-detalle'); $('#di-mapa').hidden = true; $('#di-mapa').replaceChildren();
    ctx.detalle(false);
    if (M.desdeEtapa && D.etapa != null) $('#recorrido').hidden = false;      // vuelve a la misma etapa (B1)
    if (!solo) { escribirURL(); pintarConmutador(); ctx.refrescar(); }
  }
  function elegirOpcion(id, valor, pintar = true) {
    const M = D.meca; if (!M) return;
    if (id === 'fachada' && M.clave === 'alero') { if (!SOL_FACHADAS.includes(valor)) return; M.opc.fachada = valor; }
    else if (id === 'sol' && M.clave === 'alero') { if (valor !== 'dato' && valor !== 'libre') return; M.opc.sol = valor; M.sol = valor === 'dato'; }
    else if (id === 'desp' && M.d.despiece) { const f = leerNum(valor); if (!Number.isFinite(f)) return; M.desp = Math.min(1, Math.max(0, f)); M.opc.desp = maquina(M.desp); }
    else { const op = (M.d.opciones ?? []).find((o) => o.id === id); if (!op || !op.valores.some((v) => v.id === valor)) return; M.opc[id] = valor; M.d.elegir(id, valor); }
    if (!pintar) return;
    M.version++; ctx.refrescar();
    if (id !== 'sol' && id !== 'desp') { pintarMapa(); dibujo()?.encuadrarDetalle(); }
  }
  function pintarMapa() {
    const M = D.meca, u = M?.d.ubicacion, b = $('#di-mapa');
    b.hidden = !u; if (!u) { b.replaceChildren(); return; }
    b.innerHTML = svgUbicacion({ pieza: u.pieza, texto: u.texto, ancho: ctx.telefono() ? 112 : 150, colores: { tinta: 'var(--noche)', tenue: 'var(--cal-3)', enfasis: 'var(--teja)', papel: 'var(--cal)' } });
  }
  function pintarFrase(t) {
    const el = $('#di-meca-frase'), lineas = (Array.isArray(t) ? t : [t]).filter(Boolean);
    if (el.dataset.t === lineas.join('|')) return;
    el.dataset.t = lineas.join('|');
    el.replaceChildren(...lineas.map((x) => { const sp = document.createElement('span'); sp.textContent = x; return sp; }));
  }
  /** Los controles del detalle en la tarjeta y lo que dice el módulo (frase, cifras con su certeza, sello y certezas). */
  function pintarMeca(movido = false) {
    const M = D.meca; if (!M) return;
    const d = M.d, alero = M.clave === 'alero';
    if (d.despiece) d.despiece(M.desp);
    const t = d.actualizar(M.m, 0);
    $('#ley-t').textContent = M.mod.meta.titulo;
    ctx.ponSello($('#ley-sello'), d.sello ?? '');
    if (movido) { M.vivo = performance.now(); $('#ley-sello').classList.add('vivo'); clearTimeout(pintarMeca.t); pintarMeca.t = setTimeout(() => $('#ley-sello').classList.remove('vivo'), 1500); }
    $('#ley-nota').hidden = true;
    const r = $('#di-meca-m');
    $('#di-meca-etq').textContent = d.etiqueta ?? '';
    if (alero && M.sol) { r.min = 0; r.max = 1439; r.step = 1; r.value = Math.round(S.min) % 1440; r.setAttribute('aria-valuetext', ctx.hhmm(S.min)); }
    else { r.min = 0; r.max = 1; r.step = 0.005; r.value = M.m; r.setAttribute('aria-valuetext', `${Math.round(M.m * 100)} %`); }
    $('#di-meca-desp-caja').hidden = !d.despiece; $('#di-meca-desp').value = M.desp;
    pintarFrase(t);
    // opciones: un .segmento por opción (de 2 a 4 valores); el alero suma la fachada del sol y «Prueba un ángulo · sin fecha»
    const ops = [...(d.opciones ?? [])];
    if (alero) ops.push({ id: 'fachada', nombre: 'Fachada', valores: SOL_FACHADAS.map((k) => ({ id: k, nombre: k.toUpperCase() })) },
      { id: 'sol', nombre: 'Ángulo', valores: [{ id: 'dato', nombre: 'Sol del 106' }, { id: 'libre', nombre: 'Prueba un ángulo · sin fecha' }] });
    const firma = M.clave + '|' + ops.map((o) => o.id + ':' + M.opc[o.id]).join(',');
    const caja = $('#di-meca-ops');
    if (caja.dataset.f !== firma) {
      caja.dataset.f = firma;
      caja.replaceChildren(...ops.map((o) => {
        const g = document.createElement('div'); g.className = 'di-seg'; g.setAttribute('role', 'group'); g.setAttribute('aria-label', o.nombre);
        const t0 = document.createElement('span'); t0.textContent = o.nombre;
        const seg = document.createElement('div'); seg.className = 'segmento';
        seg.append(...o.valores.map((v) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.op = o.id; b.dataset.val = v.id; b.textContent = v.nombre; b.setAttribute('aria-pressed', String(M.opc[o.id] === v.id)); return b; }));
        g.append(t0, seg); return g;
      }));
    }
    // cifras del margen: cada una con su certeza y su fuente en la misma fila; si no hay, se dice
    const cif = d.cifras?.() ?? [];
    $('#di-meca-cifras').replaceChildren(...(cif.length ? cif.flatMap((c) => {
      const dt = document.createElement('dt'), sm = document.createElement('small'), dd = document.createElement('dd');
      dt.textContent = c.clave; sm.textContent = `${certezaTxt(c.certeza)} · ${c.fuente}`; dt.append(sm); dd.textContent = c.valor; return [dt, dd];
    }) : [Object.assign(document.createElement('dt'), { textContent: 'Sin cifras del 106 para este mecanismo.' })]));
    $('#di-meca-morf').textContent = d.morfologia ?? ''; $('#di-meca-sabe').textContent = d.rotulo ?? '';
    $('#di-meca-cert').replaceChildren(...(d.certeza ?? []).map((x) => { const li = document.createElement('li'), b = document.createElement('b'); b.textContent = x.que + ': '; li.append(b, certezaTxt(x.nivel) + (x.nota ? ' · ' + x.nota : '')); return li; }));
    dibujo() && (dibujo().e.sucio = true);
  }

  // ---- el narrador: qué se está viendo y, en una línea, la hora de la escena (la luz de esa hora está en la otra lectura)
  function narrador() {
    $('#rotulo-cerrar').hidden = true; $('#rotulo-noche').hidden = true;
    $('#rotulo-tipo').textContent = 'Diseño industrial';
    const E = D.etapa != null ? D.etapas?.[D.etapa] : null, f = D.pieza ? D.fichas?.[D.pieza] : null;
    $('#rotulo-texto').textContent = D.meca ? `De cerca: ${D.meca.mod.meta.titulo}.`
      : E ? `Construir el 106, etapa ${D.etapa + 1} de ${D.etapas.length}: ${E.titulo}.`
      : D.pieza ? `Pieza elegida: ${f ? f.titulo : nombreFam(D.pieza)}.`
        : 'Toca una pieza del edificio para ver qué es y cómo se sabe.';
    $('#di-hora').textContent = `${ctx.hhmm(S.min)} · la luz de esta hora está en Arquitectura y clima`;
    // el ángulo sigue a la fecha y la hora exactas de la escena: con la hora redondeada, un enlace abierto durante el viaje de la
    // intro se quedaba con el ángulo de un minuto fraccionario (900,37) y no repintaba al aterrizar en 900
    const cuando = `${S.fecha.y}-${S.fecha.m}-${S.fecha.d}|${S.min}`;
    if (D.meca?.clave === 'alero' && D.meca.sol && D.meca.cuando !== cuando) { D.meca.cuando = cuando; pintarMeca(); }
  }

  // ---- el recorrido «Construir el 106»: las 10 etapas de etapas.json, en la tarjeta del recorrido guiado
  function familiasEtapa(i) {
    const E = D.etapas, id = E[i].id, s = new Set(E[i].familias);
    for (const [f, e] of Object.entries(EXTRA_ETAPA)) if (e === id) s.add(f);
    const di = dibujo();
    if (di) for (const r of di.familias.values()) if (r.provisional && SISTEMA_ETAPA[r.sistema] === id) s.add(r.id);
    return s;
  }
  function pintarEtapaDibujo() {
    const di = dibujo(); if (!di || D.etapa == null || !D.etapas) return;
    const nuevas = familiasEtapa(D.etapa), previas = new Set();
    for (let k = 0; k < D.etapa; k++) for (const f of familiasEtapa(k)) previas.add(f);
    di.mostrarEtapa([...nuevas], [...previas]);
  }
  async function recorrido(i) {
    if (!D.etapas) await cargar();
    const E = D.etapas; if (!E) return;
    if (!D.activa) poner(true, { ofrecer: false, cruce: false });
    if (i == null || i < 0 || i >= E.length) { pararRecorrido(); return; }
    const empieza = D.etapa == null;
    if (empieza) {
      ctx.cerrarOferta(); ctx.soloUnPanel(null); D.pieza = null; dibujo()?.enfocar(null);
      if (S.hoja !== undefined && S.hoja !== 0) ctx.ponerHoja(0);
      ctx.volarA('aerea');                                    // una sola vez: que se vea el techo; después la cámara es del docente
    }
    D.etapa = i; D.tEtapa = 0;
    const q = E[i], rec = $('#recorrido');
    rec.classList.add('di');
    $('#rec-n').textContent = `Etapa ${i + 1} de ${E.length}`;
    $('#rec-t').textContent = q.titulo; $('#rec-txt').textContent = q.texto;
    $('#rec-pregunta').hidden = true; $('#rec-respuesta').hidden = false; $('#rec-ver').hidden = true;
    $('#rec-dis-k').textContent = 'Se apoya en:'; $('#rec-dis').textContent = q.se_apoya_en;
    $('#rec-tapa-p').hidden = !q.tapa_a; $('#rec-tapa').textContent = q.tapa_a ?? '';
    $('#rec-pensar-p').hidden = !q.para_pensar; $('#rec-pensar').textContent = q.para_pensar ?? '';
    $('#rec-fuente-p').hidden = !q.fuente; $('#rec-fuente').textContent = q.fuente ?? '';
    const cerca = (MECANISMOS_ETAPA[q.id] ?? []).filter((k) => MECANISMOS[k]);
    $('#rec-cerca-p').hidden = !cerca.length;
    $('#rec-cerca').replaceChildren(...cerca.map((k) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'boton'; b.dataset.meca = k; b.textContent = MECANISMOS[k].meta.titulo; return b; }));
    ctx.ponSello($('#rec-sello'), [q.sello, certezaTxt(q.certeza)].filter(Boolean).join(' · ')); $('#rec-sello').hidden = false;
    $('#rec-prev').disabled = i === 0; $('#rec-sig').textContent = i === E.length - 1 ? 'Terminar' : 'Siguiente';
    const puntos = $('#rec-puntos'); puntos.removeAttribute('aria-hidden'); puntos.setAttribute('role', 'group'); puntos.setAttribute('aria-label', 'Ir a una etapa');
    puntos.replaceChildren(...E.map((e, j) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.etapa = j; b.className = j === i ? 'hoy' : j < i ? 'ya' : '';
      b.setAttribute('aria-label', `Etapa ${j + 1}: ${e.titulo}`); if (j === i) b.setAttribute('aria-current', 'step'); return b;
    }));
    $('#rec-play').hidden = false; pintarPlay();
    rec.hidden = false; html.classList.add('en-recorrido'); ctx.plegarRecorrido(false);
    pintarEtapaDibujo(); pintarConmutador(); escribirURL(); ctx.refrescar();
  }
  function pararRecorrido(salirSolo = false) {
    if (D.etapa == null) return;
    if (D.meca?.desdeEtapa) cerrarMeca(true);
    D.etapa = null; reproducir(false);
    const rec = $('#recorrido');
    rec.hidden = true; rec.classList.remove('di'); html.classList.remove('en-recorrido');
    // la tarjeta vuelve a ser la del recorrido guiado
    const puntos = $('#rec-puntos'); puntos.replaceChildren(); puntos.setAttribute('aria-hidden', 'true'); puntos.removeAttribute('role'); puntos.removeAttribute('aria-label');
    ['#rec-play', '#rec-sello', '#rec-tapa-p', '#rec-pensar-p', '#rec-fuente-p', '#rec-cerca-p'].forEach((x) => { $(x).hidden = true; });
    $('#rec-dis-k').textContent = 'Para el diseño:';
    dibujo()?.mostrarEtapa(null);
    if (!salirSolo) { S.verLeyenda = !ctx.telefono() || !!D.corte; pintarConmutador(); escribirURL(); ctx.refrescar(); }
  }
  function pintarPlay() { const b = $('#rec-play'); b.setAttribute('aria-pressed', String(D.reproduce)); b.setAttribute('aria-label', D.reproduce ? 'Pausar' : 'Reproducir'); }
  function reproducir(on = !D.reproduce) {
    D.reproduce = on && D.etapa != null; clearInterval(reproducir.t); pintarPlay();
    if (!D.reproduce) return;
    reproducir.t = setInterval(() => {
      if (document.hidden) return;
      D.tEtapa += 0.25;
      if (D.tEtapa < SEG_ETAPA) return;
      if (D.etapa < D.etapas.length - 1) recorrido(D.etapa + 1); else reproducir(false);   // en la última se queda, quieto
    }, 250);
  }

  // ---- la oferta de «Construir el 106»: la primera vez que se entra a Diseño industrial en este navegador
  function pintarOferta() {
    $('#oferta-txt').hidden = D.activa; $('#oferta-txt-di').hidden = !D.activa; $('#oferta-sirve').hidden = D.activa;
  }
  function ofrecerRecorrido() {
    if (leer(CLAVE_DI) || D.pieza || D.etapa != null || D.etapaURL) return;
    if (/[?&]prueba/.test(location.search) && !/[?&]guia/.test(location.search)) return;
    guardar(CLAVE_DI); pintarOferta(); $('#oferta-recorrido').hidden = false;
  }

  // ---- la entrada doble: al terminar la intro, una vez por navegador; un enlace directo nunca pregunta
  function debePreguntar() {
    if (enLink || leer(CLAVE_ENTRADA)) return false;
    return !/[?&]prueba/.test(location.search) || /[?&]entrada/.test(location.search);
  }
  function preguntar(alElegir) {
    D.enEntrada = true; ctx.refrescar();
    const el = $('#entrada'); el.hidden = false;
    const fin = (k) => {
      if (!D.enEntrada) return;
      D.enEntrada = false; el.hidden = true; guardar(CLAVE_ENTRADA);
      removeEventListener('keydown', esc, true);
      if (k === 'di') poner(true); else ctx.refrescar();
      alElegir?.(k);
    };
    const esc = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); fin('clima'); } };
    addEventListener('keydown', esc, true);
    el.querySelectorAll('[data-entrada]').forEach((b) => { b.onclick = () => fin(b.dataset.entrada); });
    el.focus();                                        // la tarjeta, no un botón: ninguno de los dos queda marcado como «el elegido»
  }

  // ---- eventos
  document.querySelectorAll('#lecturas [data-lectura]').forEach((b) => b.addEventListener('click', () => {
    if (D.enEntrada) $('#entrada').querySelector(`[data-entrada="${b.dataset.lectura}"]`).click();
    else poner(b.dataset.lectura === 'di');
  }));
  document.querySelectorAll('.lentes [data-lente-di]').forEach((b) => b.addEventListener('click', () => {
    ctx.cerrarOferta();
    if (b.dataset.lenteDi === 'construir') { if (D.etapa == null) { cerrarMeca(true); recorrido(D.etapaURL ? D.etapaURL - 1 : 0); } return; }
    cerrarMeca(true); pararRecorrido(); D.lente = b.dataset.lenteDi; S.verLeyenda = true; ctx.soloUnPanel('leyenda'); escribirURL(); pintarConmutador(); ctx.refrescar();
    if (S.hoja !== undefined) ctx.ponerHoja(0);
  }));
  // con la cámara por debajo del plano, el corte en planta se ve de canto (en «Esquina» la cámara va a 1,4 m): se vuela una vez a
  // «Aérea», como al empezar el recorrido. Solo al elegir Planta o con un enlace sin cámara; cambiar de lectura nunca mueve la cámara
  const bajoElCorte = () => D.corte === 'planta' && (ctx.escena()?.camera.position.y ?? 99) < (dibujo()?.corte?.valor ?? 0) + 0.5;
  $('#di-corte').addEventListener('click', (e) => {
    const b = e.target.closest('[data-corte-di]'); if (!b) return;
    D.corte = b.dataset.corteDi;
    const di = dibujo(); di?.cortar(EJE[D.corte], D.cortes[EJE[D.corte]]); if (di?.corte) D.cortes[di.corte.eje] = di.corte.valor;
    escribirURL(); ctx.refrescar();
    // en la hoja del teléfono el deslizador queda bajo los botones y a veces fuera de la hoja: se trae a la vista
    if (D.corte && ctx.telefono()) requestAnimationFrame(() => $('#di-corte-pos').scrollIntoView({ block: 'nearest', behavior: ctx.reduce ? 'auto' : 'smooth' }));
    if (bajoElCorte()) ctx.volarA('aerea');
  });
  const posCorte = $('#di-corte-pos');
  posCorte.addEventListener('input', () => moverCorte(+posCorte.value));
  posCorte.addEventListener('change', soltarCorte);
  posCorte.addEventListener('keydown', (e) => {          // RePág y AvPág: 1 m (cambian según el navegador; Inicio, Fin y flechas son las nativas)
    if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
    e.preventDefault();
    const v = Math.min(+posCorte.max, Math.max(+posCorte.min, Math.round((+posCorte.value + (e.key === 'PageUp' ? 1 : -1)) * 10) / 10));
    posCorte.value = v; moverCorte(v); soltarCorte();
  });
  $('#di-cerca').addEventListener('click', () => { const k = MECA_FAMILIA[D.pieza]; if (k) abrirMeca(k); });
  $('#di-meca-lista').addEventListener('click', (e) => { const b = e.target.closest('[data-meca]'); if (b) abrirMeca(b.dataset.meca); });
  $('#di-meca-volver').addEventListener('click', () => cerrarMeca());
  $('#di-mapa').addEventListener('click', () => cerrarMeca());
  $('#di-meca-ops').addEventListener('click', (e) => { const b = e.target.closest('[data-op]'); if (b) { elegirOpcion(b.dataset.op, b.dataset.val); escribirURL(); } });
  const rMeca = $('#di-meca-m'), rDesp = $('#di-meca-desp');
  rMeca.addEventListener('input', () => {
    const M = D.meca; if (!M) return;
    if (M.clave === 'alero' && M.sol) ctx.ponerHora(+rMeca.value);   // el alero con el sol del 106 mueve la hora, como la regla (B5)
    else M.m = +rMeca.value;
    pintarMeca(true);
  });
  rDesp.addEventListener('input', () => { const M = D.meca; if (!M) return; M.desp = +rDesp.value; M.opc.desp = maquina(M.desp); pintarMeca(true); });
  for (const r of [rMeca, rDesp]) r.addEventListener('change', () => { clearTimeout(soltarCorte.m); soltarCorte.m = setTimeout(escribirURL, 250); });
  $('#di-contexto').addEventListener('click', (e) => {
    const b = e.target.closest('[data-contexto]'); if (!b) return;
    D.contexto = b.dataset.contexto; dibujo()?.fijarContexto(D.contexto); escribirURL(); ctx.refrescar();
  });
  $('#di-hora').addEventListener('click', () => poner(false));
  // la tarjeta del recorrido es compartida: en «Construir el 106» sus botones mandan aquí (fase de captura, antes que main.js)
  $('#recorrido').addEventListener('click', (e) => {
    if (D.etapa == null) return;
    const b = e.target.closest('button'); if (!b || b.id === 'rec-plegar') return;
    e.stopPropagation();
    if (b.id === 'rec-sig') recorrido(D.etapa + 1);
    else if (b.id === 'rec-prev') recorrido(D.etapa - 1);
    else if (b.id === 'rec-salir') { pararRecorrido(); $('#lecturas [data-lectura="di"]')?.focus(); }
    else if (b.id === 'rec-play') reproducir();
    else if (b.dataset.meca) abrirMeca(b.dataset.meca, { desdeEtapa: true });
    else if (b.dataset.etapa != null) { recorrido(+b.dataset.etapa); }
  }, true);
  $('#oferta-recorrido').addEventListener('click', (e) => {
    if (!D.activa) return;
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'oferta-si') { e.stopPropagation(); ctx.cerrarOferta(); recorrido(0); }
  }, true);
  // el menú de la marca: lo que es de la luz vuelve a Arquitectura y clima; «Construir el 106» va a Diseño industrial
  $('#menu-lista').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'abrir-construir') { recorrido(0); return; }
    if (D.activa && ['abrir-guia', 'abrir-recorrido', 'abrir-sirve'].includes(b.id)) poner(false, { cruce: false });
  }, true);
  addEventListener('keydown', (e) => {
    if (D.meca && e.key === 'Escape' && !e.target.closest?.('input, textarea')) { cerrarMeca(); return; }
    if (D.meca || D.etapa == null || e.target.closest?.('input, textarea')) return;
    if (e.key === 'ArrowRight') recorrido(D.etapa + 1);
    else if (e.key === 'ArrowLeft') recorrido(D.etapa - 1);
    else if (e.key === 'Escape') pararRecorrido();
  });

  // la lista de la lente Mecanismos, en el orden del catálogo (indice.js)
  $('#di-meca-lista').replaceChildren(...Object.entries(MECANISMOS).map(([k, m]) => {
    const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.dataset.meca = k; b.textContent = m.meta.titulo; li.append(b); return li;
  }));

  // al cargar con ?lectura=di: la lectura ya está puesta (el dibujo lo creó escena.js); se pintan sus controles
  if (D.activa) { html.classList.add('lectura-di'); D.verLeyClima = !!S.verLeyenda; S.verLeyenda = !ctx.telefono() || !!D.corte; conectar(); cargar(); pintarOferta(); }
  pintarConmutador();

  return {
    D, poner, leyenda, narrador, recorrido, params, escribirURL, debePreguntar, preguntar, conectar, enLink,
    /** al terminar la intro de un enlace con lectura=di: la etapa del enlace o la oferta */
    alTerminarIntro() {
      if (!D.activa) return; conectar();
      if (D.etapaURL) recorrido(D.etapaURL - 1); else if (!D.mecaURL) ofrecerRecorrido();
      if (D.etapaURL === 0 && !D.mecaURL && !/[#&]cam=/.test(location.hash) && bajoElCorte()) ctx.volarA('aerea');
      const u = D.mecaURL; D.mecaURL = null;                 // un enlace con meca abre el detalle al terminar la intro (B7)
      if (u) cargar().then(() => abrirMeca(u.clave, { m: u.m, opc: u.opc, desdeEtapa: D.etapa != null }));
    },
    abrirMeca, cerrarMeca, moverCorte,
    estado: () => ({ activa: D.activa, lente: lenteActiva(), pieza: D.pieza, corte: D.corte, cortes: { ...D.cortes }, contexto: D.contexto, etapa: D.etapa, reproduce: D.reproduce, enEntrada: D.enEntrada, fichas: !!D.fichas, etapas: D.etapas?.length ?? 0,
      meca: D.meca ? { clave: D.meca.clave, m: D.meca.m, opc: { ...D.meca.opc }, sol: D.meca.sol, cifras: D.meca.d.cifras?.() ?? [], sello: D.meca.d.sello, etiqueta: D.meca.d.etiqueta } : null }),
  };
}
