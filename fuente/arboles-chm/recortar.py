# Recorta la tesela de Meta/WRI CHM 1 m al contorno de Ciudad del Saber (OSM addr:city) y dice la fecha de las imágenes.
import json, numpy as np, rasterio
from rasterio.windows import from_bounds
from rasterio.warp import transform, transform_geom
from shapely.geometry import shape, box
S, N, O, E = 8.9916, 9.0077, -79.5900, -79.5735
M = 0.001  # ~110 m de margen
xs, ys = transform('EPSG:4326', 'EPSG:3857', [O-M, E+M], [S-M, N+M])
with rasterio.open('032221132.tif') as s:
    w = from_bounds(xs[0], ys[0], xs[1], ys[1], s.transform)
    a = s.read(1, window=w); t = s.window_transform(w)
    prof = s.profile | dict(width=a.shape[1], height=a.shape[0], transform=t, compress='deflate', tiled=True, blockxsize=256, blockysize=256)
with rasterio.open('chm_cds.tif', 'w', **prof) as d: d.write(a, 1)
print('recorte', a.shape, 'm por píxel', t.a, 'altura max', a.max(), 'nodata', prof.get('nodata'))
cds = box(O, S, E, N)
fechas = {}
for f in json.load(open('meta_032221132.geojson'))['features']:
    g = shape(f['geometry'])
    if g.intersects(cds):
        fechas[f['properties']['acq_date']] = fechas.get(f['properties']['acq_date'], 0) + g.intersection(cds).area / cds.area
print('fechas de las imágenes sobre CdS (fracción del recuadro):', {k: round(v, 3) for k, v in sorted(fechas.items())})
