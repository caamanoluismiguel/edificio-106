"""Alturas de los vecinos del 106 según Google Open Buildings 2.5D Temporal (2023), una por huella de osm.json.
  cd fuente && uv run --with rasterio --with numpy --with pyproj --with shapely python alturas_ob.py   escribe alturas_ob.json
Lee las huellas de osm.json (los vecinos) y de osm-amplio.json (Ciudad del Saber entera, la avenida y el canal).
Fuente: Google Research, Open Buildings 2.5D Temporal v1 (CC BY 4.0), estimación desde Sentinel-2, 4 m efectivos, ráster a
0,5 m. Bucket público, sin clave: gs://open-buildings-temporal-data/v1. La pieza que cubre Clayton (UTM 17N, celda S2 8facc):
  https://storage.googleapis.com/open-buildings-temporal-data/v1/geotiffs/8facc_2023_06_30/tile_W-7AFfiNcwo.tif
  (manifiesto v1/manifests/8f_EPSG_32617_2023_06_30.json; origen 649040 E, 996600 N; bandas: conteo, altura, presencia)
Se lee por HTTP solo la ventana de las huellas. Por huella: percentiles 50, 90 y 99 de la altura y la fracción de la huella
con presencia > 0,5 («cubre»). Contraste en el 106 (cumbrera real 15,7 m, alero 11,1 m): p90 14,0 m y p99 14,5 m, o sea que el
dato se queda alrededor de un metro corto en la cumbrera. Google publica un error medio de 1,5 m, medido fuera de Latinoamérica."""
import json, os
import numpy as np, rasterio, rasterio.transform
from rasterio.windows import Window
from rasterio.features import geometry_mask
from pyproj import Transformer
from shapely.geometry import Polygon

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = '/vsicurl/https://storage.googleapis.com/open-buildings-temporal-data/v1/geotiffs/8facc_2023_06_30/'
TIFS = [BASE + 'tile_W-7AFfiNcwo.tif',   # origen 649040 E, 996600 N (el 106)
        BASE + 'tile_3-yvSHRduQE.tif']   # origen 649040 E, 1009100 N (la franja norte: lo que queda arriba de ~9,013° N)
a_utm = Transformer.from_crs(4326, 32617, always_xy=True).transform

vistos, huellas = set(), []
for archivo in ('osm.json', 'osm-amplio.json'):
    for e in json.load(open(os.path.join(AQUI, archivo)))['elements']:
        if e.get('type') == 'way' and 'building' in e.get('tags', {}) and len(e.get('geometry', [])) > 2 and e['id'] not in vistos:
            vistos.add(e['id']); huellas.append((e, Polygon([a_utm(g['lon'], g['lat']) for g in e['geometry']])))
xs = [c for _, p in huellas for c in p.bounds[0::2]]; ys = [c for _, p in huellas for c in p.bounds[1::2]]
# rejilla común de 0,5 m (las piezas comparten la misma rejilla): se pega en ella lo que cada pieza tenga de la caja
x0, y1 = (min(xs) - 20) // 0.5 * 0.5, -((-(max(ys) + 20)) // 0.5) * 0.5
an, al = int((max(xs) + 20 - x0) / 0.5) + 1, int((y1 - (min(ys) - 20)) / 0.5) + 1
altura = np.full((al, an), -99, np.float32); presencia = np.zeros((al, an), np.float32)
T = rasterio.transform.from_origin(x0, y1, 0.5, 0.5)
for tif in TIFS:
    with rasterio.open(tif) as r:
        c0, f0 = (~r.transform * (x0, y1)); c0, f0 = int(round(c0)), int(round(f0))
        a0, b0 = max(c0, 0), max(f0, 0); a1, b1 = min(c0 + an, r.width), min(f0 + al, r.height)
        if a1 <= a0 or b1 <= b0: continue
        _, h, pr = r.read(window=Window(a0, b0, a1 - a0, b1 - b0))
        altura[b0 - f0:b1 - f0, a0 - c0:a1 - c0] = h; presencia[b0 - f0:b1 - f0, a0 - c0:a1 - c0] = pr
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
for k, x in sorted(salida.items(), key=lambda kv: kv[1]['num'])[:40]: print(f"{x['num']:>8} OSM {k}: p90 {x['p90']} m, p99 {x['p99']} m, cubre {x['cubre']}")
