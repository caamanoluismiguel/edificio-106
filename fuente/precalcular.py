"""Precalcula datos de la v2:
 - intro.bin: 120.000 puntos sobre las superficies del modelo, con color, grupo y altura normalizada,
   en orden aleatorio (cualquier prefijo es una muestra proporcional).
 - clima_horario.bin.gz: 219.144 horas × 8 variables en uint8, por columnas.
 - clima_resumen.json: bandas típicas (p10/p50/p90) por mes y hora, serie mensual, momentos curados."""
import json, struct, glob, gzip, math, datetime as dt, sys
import numpy as np
RAW = 'raw'; OUT = 'site/public/datos'
GRUPOS = ['sitio', 'arquitectura', 'ventanas', 'cubiertas', 'entrada', 'detalles', 'vegetacion', 'contexto']
CUOTA = dict(sitio=0.11, arquitectura=0.19, ventanas=0.10, cubiertas=0.20, entrada=0.05, detalles=0.05, vegetacion=0.2, contexto=0.10)
N = 120000  # la web usa los primeros 90.000 (cualquier prefijo es proporcional)
rng = np.random.default_rng(106)

def leer(g):
    f = open(f'{RAW}/{g}.glb', 'rb').read()
    jl = struct.unpack('<I', f[12:16])[0]; js = json.loads(f[20:20 + jl]); b = f[20 + jl + 8:]
    out = []
    for m in js['meshes']:
        pr = m['primitives'][0]; a = js['accessors'][pr['attributes']['POSITION']]; v = js['bufferViews'][a['bufferView']]
        P = np.frombuffer(b[v['byteOffset']:v['byteOffset'] + v['byteLength']], np.float32).reshape(-1, 3, 3)
        col = js['materials'][pr['material']]['pbrMetallicRoughness']['baseColorFactor'][:3]
        out.append((P, np.array(col)))
    return out

pts = []
for gi, g in enumerate(GRUPOS):
    ms = leer(g)
    tris = np.concatenate([P for P, _ in ms]); cols = np.concatenate([np.repeat(c[None], len(P), 0) for P, c in ms])
    A = 0.5 * np.linalg.norm(np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0]), axis=1)
    n = int(N * CUOTA[g])
    idx = rng.choice(len(tris), n, p=A / A.sum())
    u, v = rng.random(n), rng.random(n); s = u + v > 1; u[s], v[s] = 1 - u[s], 1 - v[s]
    T = tris[idx]; P = T[:, 0] + (T[:, 1] - T[:, 0]) * u[:, None] + (T[:, 2] - T[:, 0]) * v[:, None]
    C = cols[idx]
    if g == 'contexto': h = np.clip(np.hypot(P[:, 0], P[:, 2]) / 450, 0, 1)
    else: y0, y1 = tris[..., 1].min(), tris[..., 1].max(); h = (P[:, 1] - y0) / max(0.5, y1 - y0)
    # color visible: linear -> un poco más brillante para que brille como punto
    Cv = np.clip(C * 1.2 + 0.07, 0, 1) * (0.65 + 0.35 * rng.random((n, 1)))
    pts.append(np.column_stack([P, Cv, np.full(n, gi), h, rng.random(n)]))
    print(g, n, 'tris', len(tris))
X = np.concatenate(pts); X = X[rng.permutation(len(X))]
q = np.round(X[:, :3] / 0.02).astype(np.int16)                       # 2 cm
c8 = np.round(np.clip(X[:, 3:6], 0, 1) * 255).astype(np.uint8)
meta = np.column_stack([X[:, 6], np.round(X[:, 7] * 255), np.round(X[:, 8] * 255)]).astype(np.uint8)
buf = struct.pack('<4sI', b'P106', len(X)) + q.tobytes() + c8.tobytes() + meta.tobytes()
open(f'{OUT}/intro.bin.gz', 'wb').write(gzip.compress(buf, 9))
print('intro', len(X), len(buf) / 1e6, 'MB crudo', len(gzip.compress(buf, 9)) / 1e6, 'MB gz')
