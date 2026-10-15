// Ayudas compartidas de los mecanismos (portadas de js/detalles.js de D.I.Visor y ampliadas).
// Nada aquí depende de main.js ni del DOM: todo llega por ctx.

export const num = (v, d = 0) => v.toFixed(d).replace('.', ',').replace('-', '−');
export const rad = (g) => (g * Math.PI) / 180;
export const tramo = (m, a, b) => Math.min(1, Math.max(0, (m - a) / (b - a)));

/** Los niveles de certeza son los de datos/di/fichas.json (contrato). */
export const CERTEZA = {
  foto: 'Confirmado en foto del 106',
  medido: 'Medido en el modelo',     // como el piloto: en las fichas, «medido» es siempre medido en el modelo, no en obra
  modelo: 'Del modelo, escala ±12 %',
  equipo: 'Lo informa el equipo del proyecto, sin foto',
  general: 'Principio general del tipo',
  nosabe: 'No se sabe',
  calculo: 'Calculado por el 106',
};

/** ctx.colores (contrato) o ctx.C (D.I.Visor). */
export const colores = (k) => k.colores ?? k.C;

// caja centrada en (x, y, z)
export function caja(k, w, h, d, x, y, z, op) {
  const m = k.dibujar(new k.THREE.BoxGeometry(w, h, d), op);
  m.position.set(x, y, z);
  return m;
}
// caja entre dos cotas: [x0,x1], [y0,y1], [z0,z1]
export function cajaEntre(k, [x0, x1], [y0, y1], [z0, z1], op) {
  return caja(k, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, op);
}
// cilindro entre dos puntos
export function cilindro(k, r, a, b, op, lados = 12) {
  const { THREE } = k;
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const geo = new THREE.CylinderGeometry(r, r, A.distanceTo(B), lados);
  const m = k.dibujar(geo, { umbral: 40, ...op });
  // cuatro generatrices: las aristas no dibujan la silueta de un cilindro y sin ellas un tubo sobre papel no se ve
  const L = A.distanceTo(B) / 2, gen = [];
  for (const [x, z] of [[r, 0], [-r, 0], [0, r], [0, -r]]) gen.push(new THREE.Vector3(x, -L, z), new THREE.Vector3(x, L, z));
  if (!op?.papel) m.add(k.linea(gen, { segmentos: true, enfasis: op?.enfasis, discontinua: op?.discontinua, guion: 0.02 }));
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}
// posición sobre una polilínea según t de 0 a 1 (por longitud)
export function sobre(puntos, t, V) {
  const largos = [];
  let total = 0;
  for (let i = 1; i < puntos.length; i++) { const l = puntos[i].distanceTo(puntos[i - 1]); largos.push(l); total += l; }
  let r = Math.min(Math.max(t, 0), 1) * total;
  for (let i = 0; i < largos.length; i++) {
    if (r <= largos[i] || i === largos.length - 1) return new V().lerpVectors(puntos[i], puntos[i + 1], largos[i] ? Math.min(r / largos[i], 1) : 0);
    r -= largos[i];
  }
  return puntos[0].clone();
}
export const largo = (puntos) => puntos.reduce((s, p, i) => (i ? s + p.distanceTo(puntos[i - 1]) : 0), 0);

/** Cambia los puntos de una línea ya creada (misma cantidad) y rehace los guiones si es discontinua. */
export function mover(l, puntos) {
  const pos = l.geometry.attributes.position;
  puntos.forEach((p, i) => pos.setXYZ(i, p.x ?? p[0], p.y ?? p[1], p.z ?? p[2]));
  pos.needsUpdate = true;
  l.geometry.computeBoundingSphere();
  if (!l.material?.isLineDashedMaterial && !l.material?.isLineDashedNodeMaterial) return;   // clásico (página de prueba) o Node (el 106)
  // los guiones: en su mismo atributo (en WebGPU no conviene cambiar el atributo de algo ya dibujado), como computeLineDistances
  const ld = l.geometry.attributes.lineDistance;
  if (!ld || ld.count !== pos.count) { l.computeLineDistances(); return; }
  const d = (i, j) => Math.hypot(pos.getX(i) - pos.getX(j), pos.getY(i) - pos.getY(j), pos.getZ(i) - pos.getZ(j));
  if (l.isLineSegments) for (let i = 0; i + 1 < pos.count; i += 2) { ld.setX(i, i ? ld.getX(i - 1) : 0); ld.setX(i + 1, ld.getX(i) + d(i, i + 1)); }
  else { ld.setX(0, 0); for (let i = 1; i < pos.count; i++) ld.setX(i, ld.getX(i - 1) + d(i - 1, i)); }
  ld.needsUpdate = true;
}

/** Arco en un plano horizontal (y fija), de a0 a a1 (radianes, desde +x hacia +z). */
export function arcoPlanta(V, cx, y, cz, r, a0, a1, n = 32) {
  const p = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; p.push(new V(cx + r * Math.cos(a), y, cz + r * Math.sin(a))); }
  return p;
}

/** Flecha: segmento con dos barbas, en el plano que contiene la flecha y `arriba`. Devuelve una línea de segmentos. */
export function flecha(k, a, b, op = {}) {
  const V = k.THREE.Vector3;
  const l = k.linea(puntosFlecha(V, a, b, op.barba ?? 0.06), { ...op, segmentos: true });
  return l;
}
export function puntosFlecha(V, a, b, barba = 0.06) {
  const A = new V(...(a.toArray ? a.toArray() : a)), B = new V(...(b.toArray ? b.toArray() : b));
  const d = B.clone().sub(A);
  const L = d.length() || 1e-6;
  d.divideScalar(L);
  const ref = Math.abs(d.y) > 0.9 ? new V(1, 0, 0) : new V(0, 1, 0);
  const n = new V().crossVectors(d, ref).normalize().cross(d).normalize();
  const s = Math.min(barba, L * 0.4);
  const b1 = B.clone().addScaledVector(d, -s).addScaledVector(n, s * 0.5);
  const b2 = B.clone().addScaledVector(d, -s).addScaledVector(n, -s * 0.5);
  return [A, B, B, b1, B, b2];
}

/**
 * Despiece al estilo de DI_visor: cada subsistema se corre por su vector y una línea guía discontinua
 * une su sitio con el desplazado. `partes` = [{ grupo, vector: [x,y,z], ancla: [x,y,z] }].
 * Devuelve aplicar(f) con f de 0 a 1.
 */
export function despiece(k, raiz, partes) {
  const V = k.THREE.Vector3;
  const guias = partes.map((p) => {
    const a = new V(...p.ancla);
    const l = k.linea([a, a.clone().add(new V(0.0001, 0, 0))], { discontinua: true, guion: 0.06, opacidad: 0.7 });
    raiz.add(l);
    return l;
  });
  return (f) => {
    partes.forEach((p, i) => {
      const v = new V(...p.vector).multiplyScalar(f);
      p.grupo.position.copy(v);
      const a = new V(...p.ancla);
      mover(guias[i], [a, a.clone().add(v).add(new V(0.0001, 0, 0))]);
      guias[i].visible = f > 0.02;
    });
  };
}

/** Hélice (resorte) entre dos alturas, a lo largo de y. */
export function helice(V, x, z, y0, y1, r, vueltas, n = 120) {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * vueltas * Math.PI * 2;
    p.push(new V(x + r * Math.cos(a), y0 + (y1 - y0) * t, z + r * Math.sin(a)));
  }
  return p;
}

/** Vacía un grupo avisando a cada descendiente que salió de la escena: así CSS2DRenderer quita también los rótulos anidados. */
export function vaciar(grupo) {
  grupo.traverse((o) => { if (o !== grupo) o.dispatchEvent({ type: 'removed' }); });
  grupo.clear();
}

/**
 * Marca un rótulo como secundario: el anfitrión puede ocultarlo en pantallas angostas (clase «secundario»).
 * Regla: nunca un rótulo con certeza («del tipo», «no se sabe», «supuesto», «foto», «equipo», «modelo»). Esos se ven
 * siempre; si se montan en el teléfono, se acerca la cámara en lugar de ocultarlos.
 */
export function secundario(r) {
  r.userData.secundario = true;
  r.element?.classList?.add('secundario');
  return r;
}
