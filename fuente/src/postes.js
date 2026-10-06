// Postes de luz de Ciudad del Saber puestos por regla (datos/postes.json, de fuente/postes.mjs; clase III, supuestos: OSM no
// tiene ninguno). Llegan con la ciudad y se van con ella (?ciudad=0, la capa apagada o el nivel «oculta»).
//   · el poste: copia del de la esquina del 106 (sitio.glb): fuste de 0,14 m hasta 8,8 m, tramo inclinado hasta 11,2 m a 1,6 m
//     del fuste, brazo hasta la luminaria a 3,0 m y la lámpara a 11,3 m. Dos InstancedMesh (fuste y brazo de acero galvanizado;
//     luminaria), con la misma función de material que la ciudad. No proyectan sombra (un fuste de 14 cm casi no se ve en el
//     mapa de la ciudad y costaría una pasada más);
//   · la luz: cientos de luces de three.js no caben. Cada poste alumbra con la MISMA ley que el poste de la esquina en escena.js
//     (I · cos θ · (l.y)^1,5 / (d² + 1)), sumada en un mapa del suelo de MAPA.paso m por texel que el navegador arma aquí: R, la
//     irradiancia sobre un plano horizontal en el suelo; G y B, la de un plano vertical a 1,5 m (un vector horizontal hacia las
//     lámparas, para los muros); A, la altura del suelo bajo las lámparas. escena.js lo lee como emisivo en el suelo, las calles
//     y los edificios de la ciudad, por el color de la lámpara del poste de la esquina y con su misma fotocelda (U.poste).
import * as THREE from 'three/webgpu';
import { vec3, normalWorld, smoothstep } from 'three/tsl';
import { CERTEZA } from './ciudad.js';

export const POSTE = { lampara: 11.3, alcance: 3.0, cabeza: [2.65, 3.35, 11.48, 11.61, 0.14] };
// mapa de luz: texel de 2 m (la mancha de una lámpara a 11,3 m mide unos 20 m: se resuelve con filtrado lineal); la luz de cada
// lámpara se corta a R m (a 32 m es el 1 % de la del pie del poste) y los valores van ×K para que el medio flotante no los pierda
export const MAPA = { paso: 2, R: 32, K: 1000, altoVertical: 1.5 };

/** Una caja entre dos puntos (x, y) del plano del poste (z = 0), de grosor g (cuadrada). */
function barra(a, b, g) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  const geo = new THREE.BoxGeometry(L, g, g);
  geo.rotateZ(Math.atan2(dy, dx)); geo.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
  return geo;
}
function unir(geos) {
  let nv = 0, ni = 0; for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
  const p = new Float32Array(nv * 3), n = new Float32Array(nv * 3), I = new Uint32Array(ni); let ov = 0, oi = 0;
  for (const g of geos) {
    p.set(g.attributes.position.array, ov * 3); n.set(g.attributes.normal.array, ov * 3);
    for (let k = 0; k < g.index.count; k++) I[oi + k] = g.index.array[k] + ov;
    ov += g.attributes.position.count; oi += g.index.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(p, 3)); out.setAttribute('normal', new THREE.BufferAttribute(n, 3)); out.setIndex(new THREE.BufferAttribute(I, 1));
  return out;
}

/** Arma los postes y el mapa de luz. d = datos/postes.json; material(src, opc) = el de la ciudad; luz = { tn, o, t } de escena.js. */
export function armarPostes(d, { material, U, luz }) {
  const P = d.postes, N = P.length;
  // el poste en su marco: el brazo hacia +x (rumbo 0)
  const fuste = unir([barra([0, -0.6], [0, 8.8], 0.14), barra([0, 8.8], [1.6, 11.2], 0.12), barra([1.6, 11.2], [2.75, 11.5], 0.1)]);
  const [c0, c1, y0, y1, ancho] = POSTE.cabeza, cab = new THREE.BoxGeometry(c1 - c0, y1 - y0, ancho * 2);
  cab.translate((c0 + c1) / 2, (y0 + y1) / 2, 0);
  // los materiales del poste de la esquina (sitio.glb): «Galvanized guardrail» y la luminaria con el de los sofitos
  const srcF = new THREE.MeshStandardMaterial({ name: 'Galvanized street lamp pole (por regla)', color: new THREE.Color(0.53, 0.55, 0.54), roughness: 0.27, metalness: 0.8 });
  const srcC = new THREE.MeshStandardMaterial({ name: 'Street lamp head, painted (por regla)', color: new THREE.Color(0.45, 0.43, 0.36), roughness: 0.8, metalness: 0 });
  const mF = material(srcF, { sinPostes: true }), mC = material(srcC, { sinPostes: true });
  // la lámpara misma, como la cabeza del poste de la esquina: la cara de abajo entera y el resto al 30 %, que satura y hace bloom
  const abajo = smoothstep(-0.5, -0.9, normalWorld.y).max(0.3);
  mC.emissiveNode = mC.emissiveNode.add(vec3(U.posteCol).mul(U.poste).mul(U.postesVer).mul(abajo).mul(0.08));
  // ?certeza=1: del color plano de la clase III (supuesto), como los edificios de la ciudad
  if (/[?&]certeza=1(&|$)/.test(location.search)) for (const m of [mF, mC]) { m.colorNode = vec3(...new THREE.Color(CERTEZA.III).toArray()); m.emissiveNode = null; m.metalness = 0; m.roughness = 0.9; }
  const raiz = new THREE.Group(); raiz.name = 'postes de luz (por regla)';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0), uno = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  for (const [geo, mat, nombre] of [[fuste, mF, 'postes · fuste y brazo'], [cab, mC, 'postes · luminaria']]) {
    const IM = new THREE.InstancedMesh(geo, mat, N); IM.name = nombre;
    for (let i = 0; i < N; i++) {
      const [x, z, y, a] = P[i];
      // rumbo a = atan2(dz, dx): girar +x hasta (cos a, sin a) en x-z es girar −a alrededor de y
      IM.setMatrixAt(i, m4.compose(v.set(x, y, z), q.setFromAxisAngle(eje, -a), uno));
    }
    IM.castShadow = false; IM.receiveShadow = true; IM.computeBoundingSphere();
    raiz.add(IM);
  }

  // ---- el mapa de luz del suelo
  const { paso, R, K, altoVertical } = MAPA, H = POSTE.lampara, Hv = H - altoVertical;
  const L = P.map(([x, z, y, a]) => [x + POSTE.alcance * Math.cos(a), z + POSTE.alcance * Math.sin(a), y]);
  const xs = L.map((l) => l[0]), zs = L.map((l) => l[1]);
  const x0 = Math.floor((Math.min(...xs) - R - 2 * paso) / paso) * paso, z0 = Math.floor((Math.min(...zs) - R - 2 * paso) / paso) * paso;
  const nx = Math.ceil((Math.max(...xs) + R + 2 * paso - x0) / paso), nz = Math.ceil((Math.max(...zs) + R + 2 * paso - z0) / paso);
  const Eh = new Float32Array(nx * nz), Ex = new Float32Array(nx * nz), Ez = new Float32Array(nx * nz), Ey = new Float32Array(nx * nz);
  const ss = (a, b, t) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (const [lx, lz, ly] of L) {
    const i0 = Math.max(0, Math.floor((lx - R - x0) / paso)), i1 = Math.min(nx - 1, Math.ceil((lx + R - x0) / paso));
    const k0 = Math.max(0, Math.floor((lz - R - z0) / paso)), k1 = Math.min(nz - 1, Math.ceil((lz + R - z0) / paso));
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const dx = lx - (x0 + (i + 0.5) * paso), dz = lz - (z0 + (k + 0.5) * paso), r2 = dx * dx + dz * dz;
      if (r2 >= R * R) continue;
      const r = Math.sqrt(r2), corte = ss(R, 0.6 * R, r), j = k * nx + i;
      // suelo: cos θ = l.y = H / d, así que l.y^2,5 / (d² + 1)
      const d2 = r2 + H * H, e = Math.pow(H / Math.sqrt(d2), 2.5) / (d2 + 1) * corte;
      Eh[j] += e; Ey[j] += e * ly;
      // muro a 1,5 m que mira a la lámpara: cos θ = r / d', l.y = Hv / d'
      if (r > 0.01) {
        const dv2 = r2 + Hv * Hv, dv = Math.sqrt(dv2), ev = (r / dv) * Math.pow(Hv / dv, 1.5) / (dv2 + 1) * corte;
        Ex[j] += ev * dx / r; Ez[j] += ev * dz / r;
      }
    }
  }
  const datos = new Uint16Array(nx * nz * 4), h = THREE.DataUtils.toHalfFloat;
  for (let j = 0; j < nx * nz; j++) {
    datos[j * 4] = h(Eh[j] * K); datos[j * 4 + 1] = h(Ex[j] * K); datos[j * 4 + 2] = h(Ez[j] * K);
    datos[j * 4 + 3] = h(Eh[j] > 0 ? Ey[j] / Eh[j] : 0);
  }
  const tex = new THREE.DataTexture(datos, nx, nz, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  luz.tn.value = tex; luz.o.value.set(x0, z0); luz.t.value.set(nx * paso, nz * paso); luz.k.value = 1 / K; luz.alto.value = H;
  return { raiz, n: N, mapa: { nx, nz, paso, x0, z0, mb: Math.round(datos.byteLength / 1e5) / 10 } };
}
