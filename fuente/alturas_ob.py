"""Alturas de los vecinos del 106 según Google Open Buildings 2.5D Temporal (2023), una por huella de osm.json.
  cd fuente && uv run --with rasterio --with numpy --with pyproj --with shapely python alturas_ob.py   escribe alturas_ob.json
Fuente: Google Research, Open Buildings 2.5D Temporal v1 (CC BY 4.0), estimación desde Sentinel-2, 4 m efectivos, ráster a
0,5 m. Bucket público, sin clave: gs://open-buildings-temporal-data/v1. La pieza que cubre Clayton (UTM 17N, celda S2 8facc):
  https://storage.googleapis.com/open-buildings-temporal-data/v1/geotiffs/8facc_2023_06_30/tile_W-7AFfiNcwo.tif
  (manifiesto v1/manifests/8f_EPSG_32617_2023_06_30.json; origen 649040 E, 996600 N; bandas: conteo, altura, presencia)
Se lee por HTTP solo la ventana de las huellas. Por huella: percentiles 50, 90 y 99 de la altura y la fracción de la huella
con presencia > 0,5 («cubre»). Contraste en el 106 (cumbrera real 15,7 m, alero 11,1 m): p90 14,0 m y p99 14,5 m, o sea que el
dato se queda alrededor de un metro corto en la cumbrera. Google publica un error medio de 1,5 m, medido fuera de Latinoamérica."""
import json, os
import numpy as np, rasterio
from rasterio.windows import Window
from rasterio.features import geometry_mask
from pyproj import Transformer
from shapely.geometry import Polygon

AQUI = os.path.dirname(os.path.abspath(__file__))
TIF = '/vsicurl/https://storage.googleapis.com/open-buildings-temporal-data/v1/geotiffs/8facc_2023_06_30/tile_W-7AFfiNcwo.tif'
a_utm = Transformer.from_crs(4326, 32617, always_xy=True).transform

osm = json.load(open(os.path.join(AQUI, 'osm.json')))
huellas = [(e, Polygon([a_utm(g['lon'], g['lat']) for g in e['geometry']]))
           for e in osm['elements'] if e.get('type') == 'way' and 'building' in e.get('tags', {}) and 'geometry' in e]
xs = [c for _, p in huellas for c in p.bounds[0::2]]; ys = [c for _, p in huellas for c in p.bounds[1::2]]
with rasterio.open(TIF) as r:
    c0, f0 = ~r.transform * (min(xs) - 20, max(ys) + 20)
    c1, f1 = ~r.transform * (max(xs) + 20, min(ys) - 20)
    W = Window(int(c0), int(f0), int(c1 - c0), int(f1 - f0))
    cuenta, altura, presencia = r.read(window=W)
    T = r.window_transform(W)
salida = {}
for e, p in huellas:
    m = ~geometry_mask([p.__geo_interface__], out_shape=altura.shape, transform=T)
    v = altura[m]; v = v[v >= 0]
    if v.size < 20: continue
    p50, p90, p99 = (round(float(x), 1) for x in np.percentile(v, [50, 90, 99]))
    salida[str(e['id'])] = {'num': e['tags'].get('addr:housenumber', ''), 'p50': p50, 'p90': p90, 'p99': p99,
                            'cubre': round(float((presencia[m] > 0.5).mean()), 2)}
json.dump({'fuente': 'Google Open Buildings 2.5D Temporal v1, 2023 (CC BY 4.0)', 'edificios': salida},
          open(os.path.join(AQUI, 'alturas_ob.json'), 'w'), ensure_ascii=False, indent=1)
print(len(salida), 'huellas ->', 'alturas_ob.json')
for k, x in sorted(salida.items(), key=lambda kv: kv[1]['num']): print(f"{x['num']:>8} OSM {k}: p90 {x['p90']} m, p99 {x['p99']} m, cubre {x['cubre']}")
