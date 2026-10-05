// La ciudad (fase 3, rama feat/ciudad): los edificios del kit en la escena. Encendida por defecto (CIUDAD-PLAN §27); ?ciudad=0 o
// la capa «Ciudad del Saber (aproximada)» apagada la quitan, y entonces escena.js no importa este módulo ni pide modelo/ciudad.glb.
//   · un BatchedMesh por parte (muro, moldura, teja, mediagua, vidrio, celosía, madera…), con todos los edificios del kit; cada
//     edificio es una instancia que elige su nivel de detalle por la distancia de la cámara a su centro (alto, medio o lejos, con
//     los umbrales que trae el GLB y una histéresis de HISTERESIS m para que no titile en el borde). El detalle alto viene aparte
//     (ciudad_alto.glb) y solo se pide si el nivel del equipo lo permite (ciudad-nivel.js); se puede soltar sin recargar;
//   · cada parte pasa por la MISMA función de material que pinta al 106 y a sus copias del contexto (escena.js #material, grupo
//     «contexto»); el muro con el sustituto de oclusión bajo los aleros a la altura de cada edificio (atributo _aoh);
//   · los colores observados en Street View (muros crema o gris, techo pardo oscuro) entran como tinte por instancia, que three
//     multiplica sobre el color del material; sin dato, el del 106;
//   · ?certeza=1: cada edificio del kit de un color plano según su clase de certeza (I, II, III), las copias del 106 y las cajas
//     sin modelar con colores propios, y una leyenda que dice qué quiere decir cada clase y qué no;
//   · ?partes: cada parte de un color plano (para revisar la geometría por parte).
// En el contexto se esconden las copias reducidas del 106 que el kit reemplaza y las cajas grises de sus huellas. Las cajas no se
// borran: la malla original queda y al lado va otra con los mismos vértices y sin esos triángulos (en WebGPU no se cambia la
// geometría de algo ya dibujado), así que al apagar la ciudad vuelve el contexto de siempre.
import * as THREE from 'three/webgpu';
import { Fn, vec3, normalWorld, positionWorld, cameraPosition, transformNormalToView, normalize, sin, smoothstep, distance, length, float, fwidth } from 'three/tsl';

// ?partes: cada parte de un color plano
const PALETA = { muro: [1, 1, 1], moldura: [1, 1, 0], teja: [1, 0, 0], mediagua: [1, 0.5, 0], vidrio: [0, 0, 1], celosia: [0, 1, 1], madera: [1, 0, 1], ventilacion: [0.2, 0.2, 0.2], servicio: [0.5, 0.25, 0], piso: [0.5, 0.5, 0.5], canalTeja: [0.6, 0, 0], canalMediagua: [0.6, 0.3, 0], balaustre: [0.3, 0.15, 0], asfalto: [0.15, 0.15, 0.15], lamina: [1, 0.2, 0.4] };
// ?certeza=1: tintes planos de la paleta del sitio (cuerpo.html): I --lluvia, II --teja, III --cal-3. Sin degradados.
// fuera: lo que no sale del kit (los techos planos de las cajas grises que pone el generador) va del mismo color que las cajas
export const CERTEZA = { I: '#4aa8dc', II: '#c9653f', III: '#7f8a86', copia: '#d8c27a', caja: '#3e4643', fuera: '#3e4643' };
// histéresis del nivel de detalle (m): se pasa al más fino a T − H y se vuelve al más grueso a T + H
export const HISTERESIS = 8;
// vidrio de los edificios del kit (ver material()): color lineal, rugosidad y fuerza del reflejo del cielo; medido contra Street View con
// medir-vidrio.py (local); resumen en docs/ciudad/CIUDAD.md
// lámina ondulada (pulido): onda de 7,6 cm (el perfil común de lámina ondulada, SUPUESTO para estas casas) a lo largo del alero; la
// pendiente máxima del perfil, 0,5 (SUPUESTA); se apaga entre 12 y 35 m de la cámara (más lejos la onda mide menos de ~2 píxeles y haría
// muaré; también se apaga donde la onda ocupa menos de ~4 píxeles). Solo en el detalle alto: la parte 'lamina' del GLB
export const LAMINA = { paso: 0.076, pendiente: 0.5, cerca: 12, lejos: 35 };
export const VIDRIO_CIUDAD = { color: [0.085, 0.08, 0.07], rugosidad: 0.4, reflejo: 0.7 };
const CON_CERTEZA =/[?&]certeza=1(&|$)/.test(location.search), CON_PARTES = /[?&]partes(&|$)/.test(location.search);

/** Copia una geometría del GLB (posiciones cuantizadas) a Float32 en coordenadas del mundo, con índice Uint32 (y _aoh si lo trae). */
function aMundo(mesh) {
  const g = mesh.geometry, M = mesh.matrixWorld, N = new THREE.Matrix3().getNormalMatrix(M), out = new THREE.BufferGeometry();
  const P = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
  const p = new Float32Array(P.count * 3), nn = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i).applyMatrix4(M); p.set([v.x, v.y, v.z], i * 3);
    v.fromBufferAttribute(n, i).applyMatrix3(N).normalize(); nn.set([v.x, v.y, v.z], i * 3);
  }
  out.setAttribute('position', new THREE.BufferAttribute(p, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
  if (g.attributes._aoh) out.setAttribute('_aoh', new THREE.BufferAttribute(Float32Array.from({ length: P.count }, (_, i) => g.attributes._aoh.getX(i)), 1));
  out.setIndex(new THREE.BufferAttribute(g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: P.count }, (_, i) => i), 1));
  out.computeBoundingBox(); out.computeBoundingSphere();
  return out;
}
const dentro = (P, x, z) => { let c = false; for (let i = 0, k = P.length - 1; i < P.length; k = i++) { const [xi, zi] = P[i], [xk, zk] = P[k]; if ((zi > z) !== (zk > z) && x < (xk - xi) * (z - zi) / (zk - zi) + xi) c = !c; } return c; };
const dSeg = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); };
const mallas = (o) => { const out = []; o?.traverse((x) => { if (x.isMesh) out.push(x); }); return out; };

/** Leyenda de ?certeza=1 (una vez): qué quiere decir cada color y qué no. Con los colores y la letra de cuerpo.html. */
function leyendaCerteza() {
  if (typeof document === 'undefined' || document.getElementById('leyenda-certeza')) return;
  const filas = [
    ['I', CERTEZA.I, 'confirmado', 'pisos, forma y material del techo, muros y mediaguas vistos en Street View con confianza alta o media'],
    ['II', CERTEZA.II, 'probable', 'se ve el tipo, pero falta alguno de esos cinco datos o la vista deja dudas'],
    ['III', CERTEZA.III, 'supuesto', 'casi nada se ve; el tipo es supuesto'],
    ['', CERTEZA.copia, 'copia del 106', 'mismo cuartel que el 106 en Street View y huella de OpenStreetMap a 1,6 m o menos de la suya: se repite su modelo'],
    ['', CERTEZA.caja, 'fuera del kit', 'caja sin modelar, con la altura de OpenStreetMap o de Open Buildings'],
  ];
  // abajo a la derecha en el computador; en una pantalla angosta, arriba y plegada (se abre tocando el título)
  const angosta = matchMedia('(max-width: 760px)').matches;
  const caja = document.createElement('details');
  caja.id = 'leyenda-certeza'; caja.open = !angosta;
  caja.style.cssText = `position:fixed;z-index:6;right:12px;${angosta ? 'top:calc(env(safe-area-inset-top, 0px) + 64px)' : 'bottom:16px'};width:min(320px, calc(100vw - 24px));box-sizing:border-box;`
    + 'background:var(--panel-2);border:1px solid var(--linea-2);border-radius:12px;padding:12px 14px;color:var(--cal);backdrop-filter:blur(12px)';
  const h = document.createElement('summary');
  h.textContent = 'Certeza de la ciudad';
  h.style.cssText = 'cursor:pointer;font:500 12px/1 var(--datos);color:var(--cal-2);letter-spacing:.1em;text-transform:uppercase;min-height:24px;display:flex;align-items:center';
  caja.append(h);
  for (const [clase, color, nombre, texto] of filas) {
    const f = document.createElement('div');
    f.style.cssText = 'display:grid;grid-template-columns:12px 1fr;gap:2px 10px;align-items:start;margin-top:8px';
    const m = document.createElement('i');
    m.style.cssText = `width:12px;height:12px;border-radius:999px;margin-top:3px;background:${color}`;
    const t = document.createElement('div');
    t.style.cssText = 'font:400 13px/1.35 var(--texto);color:var(--cal-2)';
    const b = document.createElement('b'); b.textContent = (clase ? clase + ' · ' : '') + nombre; b.style.cssText = 'font-weight:600;color:var(--cal)';
    t.append(b, document.createTextNode(': ' + texto));
    f.append(m, t); caja.append(f);
  }
  const pie = document.createElement('p');
  pie.style.cssText = 'margin:8px 0 0;font:400 12px/1.4 var(--texto);color:var(--cal-2)';
  pie.textContent = 'La clase cuenta qué tan bien se vio cada edificio en las fotos. Aun en la clase I, las pendientes, las alturas de piso y los colores pueden ser supuestos. El único modelo medido es el 106.';
  caja.append(pie);
  document.body.append(caja);
}

export class Ciudad {
  /** ctx: { U, sombraNubes, sombraSol, NOCHE, material, conAlto } de escena.js. */
  constructor(escena, ctx) { this.escena = escena; this.ctx = ctx; this.info = {}; this.conAlto = !!ctx.conAlto; this.altoActivo = this.conAlto; }

  /** Pide los GLB (una vez). leerGLB es el de escena.cargar (mismo cargador, meshopt y huella de versión). */
  pedir(leerGLB) {
    this._alto ??= this.conAlto ? leerGLB('ciudad_alto').then((g) => { g.scene.updateMatrixWorld(true); return g; }).catch((e) => { console.warn('ciudad: detalle alto', e); return null; }) : Promise.resolve(null);
    return (this._gltf ??= leerGLB('ciudad').then((g) => {
      g.scene.updateMatrixWorld(true); let d = null;
      g.scene.traverse((o) => { if (!d && o.userData?.reemplaza) d = o.userData; });
      this.datos = d ?? {}; return g;
    }));
  }

  /** Prepara el contexto para la ciudad (una vez, aunque el contexto ya se haya dibujado): anota las copias reducidas del 106 que
   *  el kit reemplaza y, por cada malla de cajas grises con alguna caja en una huella del kit, arma una malla hermana con los
   *  mismos vértices (compartidos) y un índice sin esos triángulos. mostrar() cambia cuál se ve. En WebGPU no se cambia la
   *  geometría de algo ya dibujado: la hermana es nueva y la original no se toca. */
  async filtrarContexto(root) {
    await this._gltf;
    const R = this.datos?.reemplaza; if (!R || this.contexto) return;
    const ocultos = [], nums = new Set(R.cuarteles ?? []), reemplazadas = [], copias = [], hermanas = [];
    root.traverse((o) => {
      const m = /^cuartel[ _](\w+?)([ _]|$)/.exec(o.name); if (!m) return;
      if (nums.has(m[1])) { reemplazadas.push(o); ocultos.push(o.name); } else copias.push(o);
    });
    const cajas = (R.cajas ?? []).map((c) => { const xs = c.poly.map((p) => p[0]), zs = c.poly.map((p) => p[1]); return { poly: c.poly, caja: [Math.min(...xs) - 1, Math.max(...xs) + 1, Math.min(...zs) - 1, Math.max(...zs) + 1] }; });
    let quitados = 0, total = 0; const v = new THREE.Vector3(), mallasCaja = [];
    root.traverse((o) => { if (o.isMesh && /massing model/i.test(o.material?.name ?? '')) mallasCaja.push(o); });
    if (cajas.length) for (const o of mallasCaja) {
      const g = o.geometry, P = g.attributes.position, I = g.index ? g.index.array : Uint32Array.from({ length: P.count }, (_, i) => i), keep = [];
      for (let t = 0; t < I.length; t += 3) {
        let cx = 0, cz = 0; for (let k = 0; k < 3; k++) { v.fromBufferAttribute(P, I[t + k]).applyMatrix4(o.matrixWorld); cx += v.x / 3; cz += v.z / 3; }
        const fuera = !cajas.some((c) => cx >= c.caja[0] && cx <= c.caja[1] && cz >= c.caja[2] && cz <= c.caja[3]
          && (dentro(c.poly, cx, cz) || c.poly.some((p, i) => dSeg(cx, cz, p, c.poly[(i + 1) % c.poly.length]) < 0.6)));
        if (fuera) keep.push(I[t], I[t + 1], I[t + 2]); else quitados++;
        total++;
      }
      if (keep.length === I.length) continue;
      const g2 = new THREE.BufferGeometry();
      for (const [k, a] of Object.entries(g.attributes)) g2.setAttribute(k, a);
      g2.setIndex(new THREE.BufferAttribute(Uint32Array.from(keep), 1));
      g2.boundingBox = g.boundingBox; g2.boundingSphere = g.boundingSphere;
      const h = o.clone(false); h.geometry = g2; h.name = o.name + ' · sin las huellas del kit'; h.visible = false;
      o.parent.add(h); hermanas.push([o, h]);
    }
    this.contexto = { reemplazadas, copias, hermanas, mallasCaja };
    this.info.contexto = { ocultos, triangulosQuitados: quitados, triangulosMaqueta: total, mallasHermanas: hermanas.length };
    if (CON_CERTEZA) this.#certezaContexto();
    this.mostrar(this.visible ?? true);
  }

  /** Con la ciudad, el contexto sin las copias que reemplaza ni sus cajas; sin ella, el contexto de siempre. */
  mostrar(si) {
    this.visible = si;
    if (this.raiz) this.raiz.visible = si;
    const L = typeof document !== 'undefined' && document.getElementById('leyenda-certeza'); if (L) L.hidden = !si;
    const C = this.contexto; if (!C) return;
    for (const o of C.reemplazadas) o.visible = !si;
    for (const [o, h] of C.hermanas) { o.visible = !si; h.visible = si; }
  }

  /** Suelta (o vuelve a usar) el detalle alto: los edificios cercanos pasan al medio en el cuadro siguiente. */
  usarAlto(si) { this.altoActivo = !!si && this.conAlto; }

  /** ?certeza=1: las copias del 106 que quedan en el contexto y las cajas sin modelar, de color plano; leyenda en pantalla. */
  #certezaContexto() {
    const plano = (hex) => { const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0 }); m.colorNode = vec3(...new THREE.Color(hex).toArray()); m.receivedShadowNode = this.ctx.sombraNubes; return m; };
    const mc = plano(CERTEZA.copia), mk = plano(CERTEZA.caja);
    for (const c of this.contexto.copias) c.traverse((o) => { if (o.isMesh) o.material = mc; });
    for (const o of this.contexto.mallasCaja) o.material = mk;
    for (const [, h] of this.contexto.hermanas) h.material = mk;
    leyendaCerteza();
  }

  /** Material de una parte: el del 106 (escena.js #material) sobre el material que trae el GLB. */
  material(src) {
    const parte = src.userData?.ciudadParte;
    const m = this.ctx.material(src, parte === 'muro' ? { aoAtributo: true } : {});
    // vidrio de la ciudad (pulido): el del 106 se lee casi negro y azulado en los edificios del kit; en Street View el vidrio de las casas
    // es gris con cortinas detrás (vidrio/muro de 0,32 a 0,48 en caras con luz: 333, 177, 157-158). Solo aquí: más color difuso, neutro
    // tirando a cálido, y el reflejo del cielo más difuso y más débil (sin brillo de espejo). El 106 y su material no cambian
    if (parte === 'lamina' && !CON_PARTES && !CON_CERTEZA) {
      // la normal se inclina hacia un lado y otro a lo largo del alero (horizontal y perpendicular a la caída del faldón)
      const n = normalWorld, h = vec3(n.z, 0, n.x.negate()), lh = length(h), t = h.div(lh.max(1e-4));
      const fase = positionWorld.x.mul(t.x).add(positionWorld.z.mul(t.z)).mul((2 * Math.PI) / LAMINA.paso);
      const k = smoothstep(LAMINA.lejos, LAMINA.cerca, distance(cameraPosition, positionWorld)).mul(smoothstep(0.02, 0.08, lh)).mul(LAMINA.pendiente)
        // y donde una onda mide menos de ~4 píxeles en pantalla (de lado o rasante), para que no haga muaré
        .mul(smoothstep(1.6, 0.8, fwidth(fase)));
      m.normalNode = transformNormalToView(normalize(n.add(t.mul(sin(fase).mul(k)))));
    }
    if (parte === 'vidrio' && !CON_PARTES && !CON_CERTEZA) { m.color.setRGB(...VIDRIO_CIUDAD.color); m.roughness = VIDRIO_CIUDAD.rugosidad; m.envMapIntensity = VIDRIO_CIUDAD.reflejo; }
    if (CON_PARTES) { const c = PALETA[parte] ?? [0.5, 0.5, 0.5]; m.colorNode = Fn(() => { this.ctx.sombraSol.assign(1.0); return vec3(...c); })(); }
    // certeza: un gris claro parejo que el tinte de cada instancia (color de la clase) vuelve plano; vidrio y madera igual que el muro
    else if (CON_CERTEZA && parte !== 'asfalto') { m.colorNode = vec3(0.8, 0.8, 0.8); m.emissiveNode = null; m.metalness = 0; m.roughness = 0.9; }
    return m;
  }

  /** Arma la ciudad en la escena. Devuelve la raíz (escena.js la compila y la agrega). */
  async montar() {
    const [gltf, alto] = await Promise.all([this._gltf, this._alto]), t0 = performance.now();
    const raiz = new THREE.Group(); raiz.name = 'ciudad';
    const LOD = this.datos.lod ?? { alto: 150, medio: 400 };
    this.lod = LOD;
    // partes que solo se dibujan cerca (la teja en canales y los balaustres del dúplex y de las casas de oficiales): en el nivel alto,
    // solo a menos de LOD.cerca m del centro del edificio
    const soloCerca = new Set(this.datos.soloCerca ?? []);
    const nodosAlto = new Map(); alto?.scene.traverse((o) => { if (o.userData?.osm && o.children.length) nodosAlto.set(o.userData.osm, o); });
    const edificios = []; gltf.scene.traverse((o) => { if (o.userData?.osm && o.userData.tipologia) edificios.push(o); });
    // por parte: las filas de cada edificio con su geometría en cada nivel
    const porParte = new Map(), tris = { alto: 0, medio: 0, lejos: 0 };
    for (const n of edificios) {
      // por parte (extras del material): teja y mediagua llevan el mismo material del 106 («Clay terracotta 04») y no se pueden juntar por nombre
      const nivel = (raizNivel, lod) => { const h = raizNivel?.children.find((x) => x.userData?.lod === lod), r = {}; for (const ms of mallas(h)) r[ms.material.userData?.ciudadParte ?? ms.material.name] = ms; return r; };
      const L = { alto: nivel(nodosAlto.get(n.userData.osm), 'alto'), medio: nivel(n, 'medio'), lejos: nivel(n, 'lejos') };
      for (const nombre of new Set(Object.values(L).flatMap((x) => Object.keys(x)))) {
        const src = (L.medio[nombre] ?? L.lejos[nombre] ?? L.alto[nombre]).material;
        const e = porParte.get(nombre) ?? { src, filas: [] }; porParte.set(nombre, e);
        const f = { n, geo: {} };
        for (const lod of ['alto', 'medio', 'lejos']) if (L[lod][nombre]) { f.geo[lod] = aMundo(L[lod][nombre]); tris[lod] += f.geo[lod].index.count / 3; }
        e.filas.push(f);
      }
    }
    // centro de cada edificio (para elegir el nivel): el de su caja con todas las partes del nivel medio
    const centros = new Map();
    for (const { filas } of porParte.values()) for (const f of filas) { const b = centros.get(f.n) ?? new THREE.Box3(); const g = f.geo.medio ?? f.geo.lejos ?? f.geo.alto; b.union(g.boundingBox); centros.set(f.n, b); }
    const caja = new THREE.Box3(), cajaSombra = new THREE.Box3(), color = new THREE.Color();
    this.lotes = []; this.batched = [];
    for (const [nombre, e] of porParte) {
      let nv = 0, ni = 0; for (const f of e.filas) for (const g of Object.values(f.geo)) { nv += g.attributes.position.count; ni += g.index.count; }
      const parte = e.src.userData?.ciudadParte;
      const B = new THREE.BatchedMesh(e.filas.length, nv, ni, this.material(e.src)); B.name = 'ciudad · ' + nombre + ' · ' + e.src.name;
      // el asfalto de los estacionamientos recibe sombra pero no la proyecta (como el suelo del contexto)
      B.castShadow = parte !== 'asfalto'; B.receiveShadow = true; if (B.castShadow) B.layers.enable(1); B.sortObjects = false; B.perObjectFrustumCulled = true;
      for (const f of e.filas) {
        const ids = Object.fromEntries(Object.entries(f.geo).map(([lod, g]) => [lod, B.addGeometry(g)]));
        const ini = ids.lejos ?? ids.medio ?? ids.alto, inst = B.addInstance(ini);
        if (ids.lejos === undefined) B.setVisibleAt(inst, false);
        const u = f.n.userData, t = CON_CERTEZA ? null : parte === 'muro' ? u.tinte?.muro : parte === 'teja' || parte === 'canalTeja' || parte === 'lamina' ? u.tinte?.teja : null;
        if (CON_CERTEZA && parte !== 'asfalto') B.setColorAt(inst, color.set(CERTEZA[u.clase] ?? CERTEZA.III));
        else if (t) B.setColorAt(inst, color.setRGB(...t));
        const c = centros.get(f.n).getCenter(new THREE.Vector3());
        caja.union(centros.get(f.n)); if (B.castShadow) cajaSombra.union(centros.get(f.n));
        this.lotes.push({ B, n: f.n, ids, inst, c, conAlto: nodosAlto.has(f.n.userData.osm), actual: ids.lejos === undefined ? null : 'lejos', cerca: soloCerca.has(parte) ? (LOD.cerca ?? 60) : 0 });
      }
      raiz.add(B); this.batched.push(B);
    }
    this.caja = caja; this.cajaSombra = cajaSombra;   // la de la sombra, sin los estacionamientos (no proyectan; llegan a 2 km)
    this.info.montaje = { ms: Math.round(performance.now() - t0), edificios: edificios.length, partes: this.batched.length, triangulos: tris, conAlto: !!alto };
    this.raiz = raiz; raiz.visible = this.visible ?? true;
    return raiz;
  }

  /** Cada cuadro: nivel de detalle por instancia. Devuelve true si cambió alguno (la sombra se rehace). */
  actualizar(camara) {
    if (!this.lotes || this.visible === false) return false;
    const cp = camara.position, H = HISTERESIS; let cambio = false;
    for (const l of this.lotes) {
      // el nivel es del edificio (por la distancia a su centro: todas sus partes cambian juntas); sin el detalle alto (no se pidió o
      // se soltó), el medio llega hasta el edificio. Una parte que no existe en ese nivel (las rejillas solo en el alto) se esconde.
      // El umbral del detalle alto puede venir por edificio (lodAlto: las casas bajas, 100 m). Histéresis: un edificio que ya está en
      // un nivel lo deja H m más allá del umbral y no entra a uno más fino hasta H m más acá (sin eso titilaba al girar en el borde)
      const d = l.c.distanceTo(cp), a = l.actual, fino = a === 'alto' || a === 'oculto';
      const tAlto = (l.n.userData.lodAlto ?? this.lod.alto) + (fino ? H : -H), tMedio = this.lod.medio + (a === 'lejos' || a === null ? -H : H);
      let nivel = d < tAlto && l.conAlto && this.altoActivo ? 'alto' : d < tMedio ? 'medio' : 'lejos';
      if (l.cerca && nivel === 'alto' && d >= l.cerca + (a === 'alto' ? H : -H)) nivel = 'oculto';   // las partes de solo cerca no existen en los otros niveles
      if (nivel === l.actual) continue;
      const id = l.ids[nivel];
      if (id === undefined) l.B.setVisibleAt(l.inst, false); else { l.B.setGeometryIdAt(l.inst, id); l.B.setVisibleAt(l.inst, true); }
      l.actual = nivel; cambio = true;
    }
    return cambio;
  }

  /** Cuántos edificios están ahora en cada nivel (para el informe). */
  get niveles() { if (!this.lotes) return null; const u = new Map(this.lotes.filter((l) => !l.cerca && l.n.userData.tipologia !== 'estacionamiento').map((l) => [l.n, l.actual])), c = { alto: 0, medio: 0, lejos: 0 }; for (const v of u.values()) c[v]++; return c; }
}
