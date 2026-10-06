# Partes de terceros y sus licencias

Lo que se lista aquí no es del autor y no queda bajo el `LICENSE` del repositorio: cada parte conserva su licencia, y lo que esa licencia permite sigue permitido. Las fuentes con su cita completa están en el README, en «Fuentes».

## Datos

| Qué | Dónde se usa | Licencia y aviso |
|---|---|---|
| OpenStreetMap: huellas de edificios, calles, ferrocarril, agua y estacionamientos | `fuente/osm.json`, `fuente/osm-amplio.json`, `fuente/osm-estacionamientos.json`, las huellas de `docs/ciudad/inventario.json`, `docs/ciudad/edificios.json` y `datos/ciudad_mapa.json`, el número y el nombre de cada edificio en `datos/ciudad_fichas.json`, la geometría que de ellos toman `modelo/contexto.glb` y `modelo/ciudad*.glb`, y los árboles (`fuente/arboles_cds.geojson`, `fuente/arboles_reales.json`, `fuente/arboles_excluidos.json`, `modelo/arboles*.glb`), que se filtran y se corren con las huellas, las calles y los bosques de OSM | © colaboradores de OpenStreetMap, [Open Database License (ODbL)](https://www.openstreetmap.org/copyright). Los extractos y lo que se derive de ellos como base de datos siguen bajo la ODbL: el `LICENSE` de este repositorio no los restringe. |
| Clima horario ERA5 por la API de Open-Meteo | `datos/clima_horario.bin.gz` (serie 2001–2025) y lo que se calcula con ella (`clima_resumen.json`, `consultas.json`, `confort.json`); pronóstico en vivo, leído en el navegador | [Weather data by Open-Meteo.com](https://open-meteo.com/), CC BY 4.0. Contiene información modificada del Servicio de Cambio Climático de Copernicus (ERA5, doi:10.24381/cds.adbb2d47); ni la Comisión Europea ni el ECMWF son responsables del uso que se haga de ella. |
| Partes METAR de Albrook (MPMG) | «Ahora» del visor y ajuste de la serie (`datos/ajuste_albrook.json`) | Iowa Environmental Mesonet, Iowa State University (https://mesonet.agron.iastate.edu/). |
| Alturas de Open Buildings 2.5D Temporal v1 | `fuente/alturas_ob.json`, las alturas de `docs/ciudad/edificios.json`, `datos/ciudad_fichas.json` y `datos/ciudad_mapa.json`, y las cajas de `modelo/contexto.glb` que las usan | Google Research. Se ofrece con CC BY 4.0 u ODbL 1.0, a elección ([página oficial](https://sites.research.google/gr/open-buildings/temporal/)); aquí se usa con ODbL, porque las alturas se combinan con las huellas de OpenStreetMap en una base que la ODbL obliga a distribuir con la misma licencia. «We have leveraged Copernicus Sentinel data (2016-2023) processed by the European Space Agency.» Cita: W. Sirko, E.A. Brempong, J.T.C. Marcos, A. Annkah, A. Korme, M.A. Hassen, K. Sapkota, T. Shekel, A. Diack, S. Nevo, J. Hickey, J.A. Quinn (2023). *High-Resolution Building and Road Detection from Sentinel-2*. arXiv:2310.11622. |
| Mapa de altura de copa de Meta y WRI | `fuente/arboles_cds.geojson`, `modelo/arboles*.glb` | CC BY 4.0 ([registro de AWS](https://registry.opendata.aws/dataforgood-fb-forests/)). High Resolution Canopy Height Maps by WRI and Meta, accedido el 1 de octubre de 2026. Meta and World Resources Institute (WRI), 2024. Source imagery for CHM © 2016 Maxar (la tesela usada, 032221132, es de imágenes del 4 de octubre de 2018). Tolan et al. (2024), doi:10.1016/j.rse.2023.113888. Los árboles del visor son base derivada de OpenStreetMap (ver la fila de OSM) y van con ODbL, conservando este crédito. |
| Sentinel-2 L2A | revisión de las copas (`fuente/arboles-chm/`) | Contains modified Copernicus Sentinel data 2019, 2026 ([aviso legal](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice)). |
| Copernicus DEM GLO-30 | `fuente/relieve.json` y el terreno que de él toman `modelo/contexto.glb`, `modelo/ciudad*.glb`, `modelo/arboles*.glb`, `docs/ciudad/edificios.json`, `datos/ciudad_mapa.json`, `datos/postes.json`, `datos/intro.bin.gz` y `fuente/src/canal-rutas.js` | [Licencia de Copernicus WorldDEM-30](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf). Art. 6 b: «produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved». Art. 6 c: «The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30» (las organizaciones a cargo del programa Copernicus por ley o por delegación no asumen ninguna responsabilidad por el uso que se haga de Copernicus WorldDEM-30). Art. 6 e: quien redistribuya estos archivos tiene que pasar estos avisos a quien los reciba. |

## Software

| Qué | Dónde | Licencia |
|---|---|---|
| three.js 0.186.1 | dentro de `js/app.js` y en `ar/vendor/three/` | MIT, aviso en `ar/vendor/three/LICENSE` |
| MindAR 1.2.5, de HiuKim Yuen | `ar/vendor/mindar/`, sin modificar | MIT, aviso en `ar/vendor/mindar/LICENSE` |
| TensorFlow.js 4.16.0, de Google | dentro de `ar/vendor/mindar/controller-mGt1s8dJ.js` (lo empaqueta MindAR) | Apache 2.0, avisos dentro del mismo archivo |
| node-qrcode 1.5.4, con dijkstrajs | dentro de `js/app.js` | MIT |
| Decodificador de meshoptimizer | dentro de `js/app.js` (por three.js) | MIT |
| Coeficientes del UTCI portados de pythermalcomfort | `fuente/src/confort.js` | MIT, Copyright (c) 2019 Federico Tartarini |

Las herramientas que solo se usan para armar y probar (Vite, glTF Transform, meshoptimizer, sharp, Playwright) no van en el sitio publicado y tienen sus licencias en `fuente/node_modules` tras `npm install`.

## Fotos de referencia del modelo

El modelo del 106 lo hizo el autor con ayuda de IA (Claude), a partir de fotos de Luis Miguel Caamaño y Raúl Alejandro González (autorización escrita de Raúl A. González, 6 oct 2026). El modelo es del autor y queda bajo el `LICENSE`; las fotos de Raúl Alejandro González son suyas. De ese conjunto, en el árbol actual del repositorio solo está la foto WA0014, dentro de la hoja `fuente/verificacion/entrada/comparativa-entrada.png`.

## Fuentes consultadas que no se redistribuyen

Estas fuentes se miraron durante la investigación; ninguna imagen ni tesela suya está en el árbol actual del repositorio.

| Qué | Cómo se usó | Condiciones |
|---|---|---|
| Google Street View | Observaciones escritas (pisos, techos, colores) y medidas leídas o estimadas en fotos. No hay identificadores de panorámica (panoid), pero `fuente/contexto.mjs` guarda tres rótulos de captura (`jg_xm100_h145`, `jg_xp0_h145`, `jg_xm20_h145`) que codifican la posición pedida sobre la calle y el rumbo de la cámara, y `fuente/inventario-ciudad.mjs` arma enlaces con `viewpoint` y `heading` | [Condiciones de Google Maps](https://www.google.com/help/terms_maps/) y [Geo Guidelines](https://about.google/brand-resource-center/products-and-services/geo-guidelines/), que prohíben «Creating data from Street View images» |
| Google Maps, mapa y vista satelital | La estructura pequeña del cuadrángulo (9,7 × 6,0 m y su posición, leída en el mapa, captura del 29 sep 2026) y los dos estacionamientos junto al 106 (medidos sobre la vista satelital), en `fuente/contexto.mjs`; `fuente/contexto-osm.mjs` comprobó contra el mapa el giro de OSM | [Condiciones de Google Maps](https://www.google.com/help/terms_maps/) |
| Esri World Imagery | Un agente bajó teselas de zoom 19 directamente del servidor, fuera de ArcGIS Online, para mirar la forma de los techos de la ciudad y comprobar sus anchos | Esri Master License Agreement; créditos «Esri, Vantor, Earthstar Geographics, and the GIS User Community» ([ficha](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9)). La ficha dice que la capa «is not intended to be used to export tiles for offline» |

### Qué depende todavía de Street View o de Google Maps

Hasta que se vuelva a observar en sitio, la fuente de estos datos sigue diciendo Street View o Google Maps:

- `modelo/contexto.glb` (y el 10 % de los puntos de `datos/intro.bin.gz`, que sale de él), por `fuente/contexto.mjs`:
  - las alturas de tres vecinos, estimadas en Street View: La Casa (el salón de eventos, enfrente de la entrada del 106; alero de ~3,2 m y cumbrera de 6,5 a 7 m), Innova (pretil a ~11 m, en `jg_xm100_h145`, con una distancia focal de unos 554 px) y el Teatro Ateneo (~10 m);
  - el cerramiento de bloque calado entre La Casa y el estacionamiento (posición y medidas aproximadas, de Street View);
  - que el 100, el 101 y el 107 son de la misma tipología que el 106 (Street View, nov 2022);
  - de Google Maps, la estructura pequeña del cuadrángulo y los dos estacionamientos;
- el pórtico del 106: `fuente/portico.mjs` lo corrigió con la foto WA0014 y dos acercamientos de Street View. Está en `modelo/entrada.glb`, en `ar/modelo/entrada.glb` (el mismo archivo), en `ar/quicklook/edificio-106.usdz` (que `ar/generar-usdz.mjs` arma con el grupo `entrada`) y en el 5 % de los puntos de `datos/intro.bin.gz`;
- `modelo/arboles.glb` y `arboles_movil.glb`: los 13 árboles cercanos se confirmaron en Street View (`fuente/arboles_reales.json`) y 28 copas se dejaron fuera porque Street View no las confirma (`fuente/arboles_excluidos.json`);
- la ciudad: `fuente/ciudad-observado.json`, `fuente/ciudad-ajustes.json`, `fuente/ciudad-datos.mjs`, `docs/ciudad/edificios.json`, `datos/ciudad_mapa.json` y `modelo/ciudad*.glb`;
- siguen a `contexto.glb`: `datos/postes.json` (sus posiciones esquivan las huellas de `datos/ciudad_mapa.json` y los troncos de `arboles.glb`) e `img/og.jpg` (muestra La Casa y los vecinos de `contexto.glb`).

Aparte del pórtico, `fuente/quitar-cruz.mjs` quitó de `entrada.glb` dos vigas sueltas, acostadas al otro lado de la calle, porque Street View no muestra nada ahí.

## Letras y texturas

- Atkinson Hyperlegible Next (Braille Institute), Bricolage Grotesque e IBM Plex Mono: SIL Open Font License, servidas por Google Fonts.
- Texturas de asfalto, concreto y pasto de [Poly Haven](https://polyhaven.com/): CC0.
