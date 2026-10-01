"""Relieve del entorno ampliado (Ciudad del Saber, la avenida y el canal) desde el Copernicus DEM GLO-30.
  cd fuente && uv run --with rasterio --with numpy --with scipy python relieve.py     escribe relieve.json
Fuente: Copernicus Digital Elevation Model GLO-30, accedido el 1 de octubre de 2026 desde
https://registry.opendata.aws/copernicus-dem (piezas N08 y N09 de W080, 1 segundo de arco ≈ 30 m), licencia de acceso libre
del programa Copernicus. Es un modelo de SUPERFICIE: trae los techos y las copas de los árboles. Para sacar un suelo
aproximado se toma el mínimo en una ventana de 5 × 5 píxeles (~150 m) y se suaviza con la media de 5 × 5: el resultado
tiene errores de algunos metros, sirve para el paisaje lejano y no para medir. El agua sí sale pareja (la mediana sobre
cada superficie de agua la calcula contexto.mjs con la rejilla «superficie», sin filtrar).
Salida: rejilla en latitud y longitud (la del DEM) con las alturas en decímetros sobre el nivel del mar: «suelo» filtrado y
«superficie» tal cual."""
import json, os
import numpy as np, rasterio
from scipy import ndimage

AQUI = os.path.dirname(os.path.abspath(__file__))
S, N, O, E = 8.984, 9.020, -79.606, -79.564          # la caja de osm-amplio.json
URL = '/vsicurl/https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_{0}_00_W080_00_DEM/Copernicus_DSM_COG_10_{0}_00_W080_00_DEM.tif'
d = 1 / 3600
lat = np.arange(N, S - d / 2, -d); lon = np.arange(O, E + d / 2, d)
sup = np.full((len(lat), len(lon)), np.nan, np.float32)
LA, LO = np.meshgrid(lat, lon, indexing='ij')
for pieza in ('N08', 'N09'):
    with rasterio.open(URL.format(pieza)) as r:
        b = r.bounds
        m = (LA >= b.bottom) & (LA < b.top) & np.isnan(sup)
        if m.any(): sup[m] = [v[0] for v in r.sample(zip(LO[m], LA[m]))]
assert not np.isnan(sup).any(), 'faltan píxeles del DEM en la caja'
suelo = ndimage.uniform_filter(ndimage.minimum_filter(sup, size=5), size=5)
json.dump({'fuente': 'Copernicus DEM GLO-30 (registry.opendata.aws/copernicus-dem), accedido 2026-10-01', 'lat0': N, 'lon0': O, 'd': d,
           'filas': len(lat), 'columnas': len(lon), 'suelo_dm': np.round(suelo * 10).astype(int).ravel().tolist(),
           'superficie_dm': np.round(sup * 10).astype(int).ravel().tolist()}, open(os.path.join(AQUI, 'relieve.json'), 'w'), separators=(',', ':'))
print('rejilla', sup.shape, 'suelo', round(float(suelo.min()), 1), 'a', round(float(suelo.max()), 1), 'm')
