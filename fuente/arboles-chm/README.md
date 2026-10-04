# Árboles de Ciudad del Saber desde el mapa de altura de copa

Scripts que generan `../arboles_cds.geojson` y revisan las copas con Sentinel-2. Corren en una carpeta de trabajo fuera del repo (la tesela pesa 463 MB), con Python 3, `rasterio`, `numpy`, `scipy`, `scikit-image`, `shapely`, `pyproj` y `requests`.

1. Bajar la tesela de Meta y WRI (High Resolution Canopy Height Maps v1, CC BY 4.0) y sus fechas:
   `curl -O https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/032221132.tif` y
   `curl -o meta_032221132.geojson https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/metadata/032221132.geojson`.
2. `python recortar.py`: recorte a Ciudad del Saber (`chm_cds.tif`) y fecha de las imágenes (Maxar, 2018-10-04 en todo el recuadro).
3. Bajar de Overpass los árboles y bosques de OSM a `bosque_osm.json` (consulta en el encabezado de `copas.py`).
4. `python copas.py`: copas por máximos locales y cuencas → `arboles_cds.geojson` (copiarlo a `fuente/`).
5. `python sentinel.py` (con `arboles_cds.geojson` en la carpeta): NDVI de Sentinel-2 L2A, estación seca de 2019 y de 2026 → `sentinel_cds.json`. Las copas que `fuente/arboles_excluidos.json` deja fuera salen de ahí y de mirarlas en Street View.

El recuadro de Ciudad del Saber es el de las direcciones de OSM (`addr:city`): OSM no tiene polígono del límite.
