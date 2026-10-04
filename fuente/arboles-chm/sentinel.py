# ¿Sigue habiendo vegetación donde el mapa de copas (imágenes de 2018) pone cada árbol? Sentinel-2 L2A (Copernicus, datos
# abiertos) del catálogo Earth Search de Element84 en AWS. Misma estación los dos años (seca, enero a abril: los árboles que botan
# las hojas en verano no cuentan como perdidos): mediana del NDVI de las escenas de menos de 20 % de nubes, solo con los píxeles
# que la clasificación de escena (SCL) da como vegetación, suelo o agua (sin nube, sombra ni cirro).
#   2019: la estación seca más cercana después de las imágenes del mapa (Maxar, 2018-10-04)
#   2026: la de este año
# Por copa: NDVI del píxel de 10 m en su centro, contra un umbral medido (ver abajo).
# Salida: sentinel_cds.json (por copa) y el resumen en pantalla.
import os, json, numpy as np, requests, rasterio
from rasterio.windows import from_bounds
from rasterio.warp import transform, transform_bounds
from rasterio.enums import Resampling
S, N, O, E = 8.9916, 9.0077, -79.5900, -79.5735
API = 'https://earth-search.aws.element84.com/v1/search'
VALIDO = {4, 5, 6}                       # SCL: vegetación, suelo desnudo, agua

def escenas(desde, hasta, n=8):
    r = requests.post(API, json={'collections': ['sentinel-2-l2a'], 'bbox': [O, S, E, N], 'datetime': f'{desde}T00:00:00Z/{hasta}T00:00:00Z',
                                 'query': {'eo:cloud_cover': {'lt': 20}}, 'limit': 100}, timeout=60).json()['features']
    r = [f for f in r if f['properties'].get('s2:mgrs_tile', f['id'].split('_')[1]) .endswith('PPK') or '17PPK' in f['id']]
    vistos, sal = set(), []
    for f in sorted(r, key=lambda f: f['properties']['eo:cloud_cover']):
        d = f['properties']['datetime'][:10]
        if d in vistos: continue          # un mismo pase procesado dos veces (_0 y _1)
        vistos.add(d); sal.append(f)
    return sal[:n]

def leer(href, crs_ref=None, ventana_ref=None, forma=None):
    with rasterio.open(href) as s:
        b = transform_bounds('EPSG:4326', s.crs, O - 0.001, S - 0.001, E + 0.001, N + 0.001)
        w = from_bounds(*b, s.transform)
        a = s.read(1, window=w, out_shape=forma, resampling=Resampling.nearest, boundless=True, fill_value=0)
        return a, s.window_transform(w) if forma is None else None, s.crs

def compuesto(desde, hasta):
    fs = escenas(desde, hasta); pilas, usadas = [], []
    T = crs = forma = None
    for f in fs:
        a = f['assets']
        red, T0, crs0 = leer(a['red']['href']); nir, _, _ = leer(a['nir']['href'])
        if forma is None: forma, T, crs = red.shape, T0, crs0
        if red.shape != forma: continue
        scl, _, _ = leer(a['scl']['href'], forma=forma)
        bnd = a['red'].get('raster:bands', [{}])[0]; esc = bnd.get('scale', 1e-4)
        # con earthsearch:boa_offset_applied los números ya traen restado el desplazamiento de 2022 en adelante: no se resta otra vez
        off = 0.0 if f['properties'].get('earthsearch:boa_offset_applied') else bnd.get('offset', 0.0)
        R, Nn = red * esc + off, nir * esc + off
        ok = np.isin(scl, list(VALIDO)) & (red > 0) & (nir > 0)
        ndvi = np.where(ok, (Nn - R) / np.maximum(Nn + R, 1e-6), np.nan)
        pilas.append(ndvi); usadas.append((f['id'], f['properties']['datetime'][:10], round(float(ok.mean()) * 100)))
    return np.nanmedian(np.stack(pilas), axis=0), T, crs, usadas

c19, T, crs, u19 = compuesto('2019-01-01', '2019-05-01')
c26, T26, _, u26 = compuesto('2026-01-01', '2026-05-01')
assert c19.shape == c26.shape and T == T26, 'las dos rejillas deben coincidir (mismo cuadro MGRS)'
print('2019:', u19); print('2026:', u26)
# Umbral medido, no supuesto: puntos al azar a más de 8 m de cualquier copa del CHM y fuera de edificios de OSM (pasto, calles,
# suelo); el umbral es el NDVI que solo el 5 % de esos puntos alcanza en 2026 (píxel central). Una copa «sigue verde» si su
# píxel central lo pasa en 2026; «posible pérdida» si lo pasaba en 2019 y en 2026 queda por debajo de la mediana de los
# edificios; lo demás «no se distingue» (copa chica o píxel mezclado: 10 m de Sentinel-2 contra copas de 3 a 40 m).
from scipy import ndimage as ndi
from shapely.geometry import Polygon, Point
inv = ~T
def pix(lon, lat, a):
    x, y = transform('EPSG:4326', crs, list(lon), list(lat)); o = []
    for xx, yy in zip(x, y):
        c, r = [int(v) for v in inv * (xx, yy)]; o.append(float(a[r, c]) if 0 <= r < a.shape[0] and 0 <= c < a.shape[1] and np.isfinite(a[r, c]) else np.nan)
    return np.array(o)
osm = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'osm-amplio.json')))['elements']
ed = [Polygon([(p['lon'], p['lat']) for p in e['geometry']]) for e in osm if 'building' in e.get('tags', {}) and len(e.get('geometry', [])) >= 4]
ed = [p for p in ed if O < p.centroid.x < E and S < p.centroid.y < N and p.area > 2e-8]
chm = rasterio.open('chm_cds.tif'); a = chm.read(1); lejos = ndi.distance_transform_edt(a < 3) * abs(chm.transform.a) * np.cos(np.radians(9)); ic = ~chm.transform
rng = np.random.default_rng(1); lo_ = rng.uniform(O, E, 4000); la_ = rng.uniform(S, N, 4000); x3, y3 = transform('EPSG:4326', 'EPSG:3857', list(lo_), list(la_))
sin = [i for i, (xx, yy) in enumerate(zip(x3, y3)) if (lambda c, r: 0 <= r < a.shape[0] and 0 <= c < a.shape[1] and lejos[r, c] > 8)(*[int(v) for v in ic * (xx, yy)]) and not any(p.contains(Point(lo_[i], la_[i])) for p in ed)]
ref26 = pix(lo_[sin], la_[sin], c26); UMBRAL = float(np.nanpercentile(ref26, 95))
EDIF = float(np.nanmedian(pix([p.centroid.x for p in ed], [p.centroid.y for p in ed], c26)))
print(f'umbral (p95 de {len(sin)} puntos sin árbol, 2026): {UMBRAL:.3f}; mediana de {len(ed)} edificios: {EDIF:.3f}')
feats = json.load(open('arboles_cds.geojson'))['features']
lon = [f['geometry']['coordinates'][0] for f in feats]; lat = [f['geometry']['coordinates'][1] for f in feats]
v19, v26 = pix(lon, lat, c19), pix(lon, lat, c26)
res, cuenta = [], {}
for i, f in enumerate(feats):
    d = f['properties']['diametro_copa_m']
    if not np.isfinite(v26[i]): k = 'sin dato'
    elif v26[i] >= UMBRAL: k = 'sigue verde'
    elif np.isfinite(v19[i]) and v19[i] >= UMBRAL and v26[i] < EDIF: k = 'posible pérdida'
    else: k = 'no se distingue'
    g = 'copa >= 10 m' if d >= 10 else 'copa < 10 m'
    cuenta.setdefault(g, {}); cuenta[g][k] = cuenta[g].get(k, 0) + 1
    res.append(dict(id=i, ndvi_2019=None if not np.isfinite(v19[i]) else round(float(v19[i]), 3), ndvi_2026=None if not np.isfinite(v26[i]) else round(float(v26[i]), 3), estado=k))
json.dump(dict(fuente='Sentinel-2 L2A (Copernicus), Earth Search de Element84; mediana de la estación seca (enero a abril) con la máscara SCL; píxel de 10 m en el centro de cada copa',
               escenas_2019=u19, escenas_2026=u26, umbral=round(UMBRAL, 3), mediana_edificios=round(EDIF, 3), puntos_referencia=len(sin),
               criterio='sigue verde: NDVI 2026 >= umbral (p95 de puntos sin árbol); posible pérdida: 2019 >= umbral y 2026 < mediana de edificios; no se distingue: lo demás',
               resumen=cuenta, copas=res), open('sentinel_cds.json', 'w'), ensure_ascii=False)
print(json.dumps(cuenta, ensure_ascii=False))
np.save('ndvi_2019.npy', c19); np.save('ndvi_2026.npy', c26)
