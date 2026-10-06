"""Copa de árbol del distrito frente a la que rodea al 106, para la frase de la ficha del 106 (datos/copa.json).

Cuenta la fracción de píxeles del mapa de altura de copa (CHM) de Meta y WRI con 3 m o más:
  - dentro del límite propuesto de Ciudad del Saber (docs/ciudad/limite-propuesto.geojson, que es una propuesta del
    visor y no el límite oficial de la Fundación), con y sin las huellas de edificios;
  - en el suelo libre (sin huellas) a 50, 100 y 200 m del centroide del 106.
Las huellas son las de OpenStreetMap de los 322 edificios de docs/ciudad/inventario.json (geometría de fuente/osm-amplio.json).
Se excluyen porque el CHM puede leer un techo como copa. El ráster está en EPSG:3857: un radio de r m en el suelo es
r / cos(latitud) en esa proyección. Es una estimación: el CHM es de imágenes Maxar del 4 de octubre de 2018 (tesela 032221132)
y su error absoluto medio de altura es 2,8 m (Tolan et al. 2024, doi:10.1016/j.rse.2023.113888).

El ráster chm_cds.tif no va en el repo: es el recorte de la tesela 032221132 que hace recortar.py en
~/projects/edificio-106-arboles/ (ver su README). Su sha256 queda en el JSON para comprobar que es el mismo.

Rehacerlo (determinista: mismas entradas, mismo JSON):
  ~/projects/edificio-106-arboles/.venv/bin/python -I fuente/copa.py [--chm=<ruta de chm_cds.tif>]
desde la raíz del repo. Ese entorno tiene numpy, shapely, rasterio y pyproj.
"""
import hashlib, json, os, sys
import numpy as np
import rasterio
from rasterio import features
from shapely.geometry import shape, Polygon, Point, mapping
from shapely.ops import transform
from pyproj import Transformer

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHM = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--chm=')),
           os.path.expanduser('~/projects/edificio-106-arboles/chm_cds.tif'))
UMBRAL = 3          # m de altura de copa
RADIOS = (50, 100, 200)  # m en el suelo desde el centroide del 106


def leer(rel):
    with open(os.path.join(RAIZ, rel), encoding='utf-8') as f:
        return json.load(f)


a3857 = Transformer.from_crs(4326, 3857, always_xy=True).transform
lim_geo = leer('docs/ciudad/limite-propuesto.geojson')['features'][0]
lim = transform(a3857, shape(lim_geo['geometry']))
inv = leer('docs/ciudad/inventario.json')
vias = {e['id']: e for e in leer('fuente/osm-amplio.json')['elements'] if e['type'] == 'way' and 'geometry' in e}
huellas = []
for e in inv['edificios']:
    w = vias[e['osm_id']]
    c = [(p['lon'], p['lat']) for p in w['geometry']]
    huellas.append(transform(a3857, Polygon(c)))

with open(CHM, 'rb') as f:
    sha = hashlib.sha256(f.read()).hexdigest()
r = rasterio.open(CHM)
chm = r.read(1)
masc = lambda geoms: features.geometry_mask([mapping(g) for g in geoms], chm.shape, r.transform, invert=True)
m_lim = masc([lim])
m_huellas = masc(huellas)
frac = lambda m: float((chm[m] >= UMBRAL).mean())

# qué parte del límite cae dentro del ráster
ext = Polygon([(r.bounds.left, r.bounds.bottom), (r.bounds.right, r.bounds.bottom), (r.bounds.right, r.bounds.top), (r.bounds.left, r.bounds.top)])
cubre = lim.intersection(ext).area / lim.area

e106 = next(e for e in inv['edificios'] if e['numero_cds'] == '106')
c = e106['centroide']
p106 = transform(a3857, Point(c['lon'], c['lat']))
k = 1 / np.cos(np.radians(c['lat']))
radios = {}
for rad in RADIOS:
    m = masc([p106.buffer(rad * k, 256)]) & ~m_huellas
    radios[str(rad)] = round(frac(m), 4)

r4 = lambda x: round(x, 4)
salida = {
    'que_es': 'Fracción del suelo con copa de árbol de 3 m o más según el CHM de Meta y WRI. Estimación.',
    'generado_por': 'fuente/copa.py',
    'metodo': ('Píxeles del CHM (EPSG:3857, ~1,2 m) con altura >= umbral_m. «Suelo libre» excluye las huellas de OpenStreetMap '
               'de los edificios de docs/ciudad/inventario.json. Los radios se miden en el suelo desde el centroide del 106 '
               '(radio en EPSG:3857 = radio / cos(latitud)).'),
    'umbral_m': UMBRAL,
    'distrito': {
        'limite': 'docs/ciudad/limite-propuesto.geojson',
        'limite_nota': 'Límite propuesto por el visor, no el oficial de la Fundación Ciudad del Saber.',
        'fraccion_del_limite_cubierta_por_el_raster': r4(cubre),
        'copa_todo': r4(frac(m_lim)),
        'copa_suelo_libre': r4(frac(m_lim & ~m_huellas)),
    },
    'edificio_106': {
        'centro': {'lat': c['lat'], 'lon': c['lon'], 'fuente': 'centroide de la huella de OSM 300885891 en docs/ciudad/inventario.json'},
        'copa_suelo_libre_por_radio_m': radios,
    },
    'huellas_excluidas': {'cuantas': len(huellas), 'de': 'docs/ciudad/inventario.json, geometría de fuente/osm-amplio.json',
                          'osm_base': inv.get('osm_base')},
    'chm': {'archivo': 'chm_cds.tif (fuera del repo; recorte de la tesela 032221132 en ~/projects/edificio-106-arboles/recortar.py)',
            'sha256': sha, 'imagenes_fecha': '2018-10-04', 'imagenes': 'Maxar',
            'error_absoluto_medio_altura_m': 2.8,
            'error_nota': 'MAE de la validación de Tolan et al. (2024) con lidar aparte, en otros sitios; no se midió en Panamá.'},
    'fuentes': [
        'Meta and World Resources Institute (WRI), 2024. High Resolution Canopy Height Maps by WRI and Meta, CC BY 4.0 '
        '(https://registry.opendata.aws/dataforgood-fb-forests/). Source imagery for CHM © 2016 Maxar; la tesela 032221132 es de '
        'imágenes del 4 de octubre de 2018.',
        'Tolan, J. et al. (2024). Very high resolution canopy height maps from RGB imagery using self-supervised vision transformer '
        'and convolutional decoder trained on aerial lidar. Remote Sensing of Environment 300, 113888. doi:10.1016/j.rse.2023.113888. '
        'Error absoluto medio de altura: 2,8 m.',
        '© colaboradores de OpenStreetMap, ODbL (huellas y, de ellas, el límite propuesto).',
    ],
    'licencia': 'ODbL 1.0 (deriva de las huellas de OpenStreetMap), conservando el crédito del CHM de Meta y WRI (CC BY 4.0).',
}
with open(os.path.join(RAIZ, 'datos/copa.json'), 'w', encoding='utf-8') as f:
    json.dump(salida, f, ensure_ascii=False, indent=1)
    f.write('\n')
print(json.dumps({'cubre': r4(cubre), 'todo': salida['distrito']['copa_todo'], 'libre': salida['distrito']['copa_suelo_libre'],
                  'radios': radios, 'huellas': len(huellas)}, ensure_ascii=False))
