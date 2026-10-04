# Copas de árboles de Ciudad del Saber desde Meta/WRI CHM 1 m (imágenes Maxar del 2018-10-04).
# Máximos locales sobre el CHM suavizado + cuencas (watershed) para el diámetro de copa.
# bosque_osm.json (árboles, filas y bosques de OSM, Overpass del 2026-10-04):
#   curl https://overpass-api.de/api/interpreter --data-urlencode 'data=[out:json][timeout:60];(way["natural"="wood"](8.9906,-79.5910,9.0087,-79.5725);way["natural"="tree_row"](8.9906,-79.5910,9.0087,-79.5725);node["natural"="tree"](8.9906,-79.5910,9.0087,-79.5725););out geom;' -o bosque_osm.json
import os, json, numpy as np, rasterio
from rasterio.features import rasterize
from rasterio.warp import transform
from scipy import ndimage as ndi
from skimage.feature import peak_local_max
from skimage.segmentation import watershed
from shapely.geometry import shape, Polygon, Point, box
from shapely.ops import transform as stransform
import pyproj

ALT_MIN, SEP_PX, AREA_MIN, REL, RMAX_FAC = 3, 2, 4.0, 0.5, 0.75
S, N, O, E = 8.9916, 9.0077, -79.5900, -79.5735
src = rasterio.open('chm_cds.tif'); chm = src.read(1).astype(float); T = src.transform
esc = np.cos(np.radians(9.0)); px_m = T.a * esc           # 3857 -> metros en el suelo a 9° N
a3857 = pyproj.Transformer.from_crs(4326, 3857, always_xy=True).transform

osm = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'osm-amplio.json')))['elements']
def poli(e): return Polygon([(p['lon'], p['lat']) for p in e['geometry']])
edif = [poli(e) for e in osm if 'building' in e.get('tags', {}) and len(e.get('geometry', [])) >= 4]
mask_edif = rasterize([(stransform(a3857, p), 1) for p in edif], out_shape=chm.shape, transform=T, fill=0).astype(bool)
print('píxeles >=3 m dentro de huellas de OSM:', int((chm[mask_edif] >= 3).sum()), 'de', int(mask_edif.sum()))

# bosque: natural=wood de OSM (ways cerrados) — ahí las copas se tocan y el conteo es menos fiable
q = 'https://overpass-api.de/api/interpreter'
bosque = []
try:
    bosque = [Polygon([(p['lon'], p['lat']) for p in e['geometry']]) for e in json.load(open('bosque_osm.json'))['elements'] if e['type'] == 'way' and len(e.get('geometry', [])) >= 4]
except FileNotFoundError: pass
mask_bosque = rasterize([(stransform(a3857, p), 1) for p in bosque], out_shape=chm.shape, transform=T, fill=0).astype(bool) if bosque else np.zeros_like(mask_edif)

lisa = ndi.gaussian_filter(chm, 1.0)
copa = (lisa >= ALT_MIN) & ~mask_edif
picos = peak_local_max(lisa, min_distance=SEP_PX, threshold_abs=ALT_MIN, labels=copa.astype(int), exclude_border=False)
marc = np.zeros(chm.shape, int); marc[tuple(picos.T)] = np.arange(1, len(picos) + 1)
seg = watershed(-lisa, marc, mask=copa, compactness=0.01)
# una copa no baja de la mitad de la altura de su pico: corta las faldas de arbustos y pasto alto que unen copas
pico_h = np.zeros(len(picos) + 1); pico_h[1:] = lisa[tuple(picos.T)]
seg[lisa < REL * pico_h[seg]] = 0
# y su radio no pasa de RMAX_FAC veces la altura (las copas tropicales anchas, p. ej. corotú, llegan a ~1,5 h de diámetro)
rr, cc = np.indices(chm.shape); pr = np.zeros(len(picos) + 1); pc = np.zeros(len(picos) + 1); pr[1:], pc[1:] = picos[:, 0], picos[:, 1]
seg[(np.hypot(rr - pr[seg], cc - pc[seg]) * px_m > RMAX_FAC * pico_h[seg]) & (seg > 0)] = 0
areas = ndi.sum(np.ones_like(chm), seg, index=np.arange(1, len(picos) + 1)) * px_m ** 2

# copa separada: su segmento no toca el de otra copa (vecindad de 8). Si toca, es parte de una masa continua.
toca = np.zeros(len(picos) + 1, bool)
for dr, dc in [(0, 1), (1, 0), (1, 1), (1, -1)]:
    A = seg[max(dr, 0):seg.shape[0] + min(dr, 0) or None, max(dc, 0):seg.shape[1] + min(dc, 0) or None]
    B = seg[max(-dr, 0):seg.shape[0] + min(-dr, 0) or None, max(-dc, 0):seg.shape[1] + min(-dc, 0) or None]
    m = (A > 0) & (B > 0) & (A != B); toca[A[m]] = True; toca[B[m]] = True
xs, ys = rasterio.transform.xy(T, picos[:, 0], picos[:, 1])
lon, lat = transform('EPSG:3857', 'EPSG:4326', xs, ys)
cds = box(O, S, E, N)
feats, sueltas = [], []
for i, (r, c) in enumerate(picos):
    if areas[i] < AREA_MIN or not (S <= lat[i] <= N and O <= lon[i] <= E): continue
    feats.append(dict(type='Feature', geometry=dict(type='Point', coordinates=[round(lon[i], 7), round(lat[i], 7)]),
        properties=dict(altura_m=int(chm[r, c]), diametro_copa_m=round(2 * np.sqrt(areas[i] / np.pi), 1), en_bosque_osm=bool(mask_bosque[r, c]), copa_separada=bool(not toca[i + 1]))))
    if not toca[i + 1] and not mask_bosque[r, c]: sueltas.append(i + 1)       # segmento de una copa suelta (va como árbol, no como masa)
json.dump(dict(type='FeatureCollection', properties=dict(
    fuente='Meta y WRI, High Resolution Canopy Height Maps v1 (Tolan et al. 2024, Remote Sensing of Environment 300:113888), 1 m, CC BY 4.0',
    tesela='032221132', imagenes='Maxar, 2018-10-04 (toda Ciudad del Saber)', error_absoluto_medio_altura_m=2.8, nota_error='MAE de la validación del artículo (lidar aéreo en otros sitios, no en Panamá); error medio (sesgo) 0,6 m',
    metodo=f'máximos locales del CHM suavizado (sigma 1 px, altura >= {ALT_MIN} m, separación >= {SEP_PX} px) y cuencas; la copa no baja de {REL} veces la altura del pico ni pasa de un radio de {RMAX_FAC} veces la altura; se quitan copas < {AREA_MIN} m2 y lo que cae en huellas de edificios de OSM',
    aviso='APROXIMADO: copas sacadas por nuestro script del mapa de altura de copa (un modelo sobre imágenes de 2018). No es un censo. Sin especie. Contra 24 árboles de OSM, distancia mediana 4,9 m.',
    bbox_cds=[O, S, E, N]), features=feats), open('arboles_cds.geojson', 'w'))

h = np.array([f['properties']['altura_m'] for f in feats]); dcop = np.array([f['properties']['diametro_copa_m'] for f in feats]); fb = np.array([f['properties']['en_bosque_osm'] for f in feats])
print(f'copas en el recuadro de CdS: {len(feats)}  (fuera de bosque OSM: {(~fb).sum()}, dentro: {fb.sum()})')
print('altura m  p10/p50/p90/max:', np.percentile(h, [10, 50, 90]).round(1), h.max())
print('copa m    p10/p50/p90/max:', np.percentile(dcop, [10, 50, 90]).round(1), dcop.max())
print('copas separadas:', sum(f['properties']['copa_separada'] for f in feats), ' en masa continua:', sum(not f['properties']['copa_separada'] for f in feats))
rr0, cc0 = np.indices(chm.shape); xs0, ys0 = rasterio.transform.xy(T, rr0.ravel(), cc0.ravel()); lo0, la0 = transform('EPSG:3857', 'EPSG:4326', xs0, ys0)
dentro = ((np.array(la0) >= S) & (np.array(la0) <= N) & (np.array(lo0) >= O) & (np.array(lo0) <= E)).reshape(chm.shape)
print('cobertura de copa >=3 m solo en el recuadro:', round(100 * copa[dentro].mean(), 1), '%  · sin contar el área de edificios:', round(100 * copa[dentro & ~mask_edif].mean(), 1), '%')
np.save('picos.npy', picos); np.save('seg.npy', seg); np.save('sueltas.npy', np.array(sueltas)); np.save('copa.npy', copa)
