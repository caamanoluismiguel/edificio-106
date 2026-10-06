# Partes de terceros y sus licencias

Lo que se lista aquí no es del autor y no queda bajo el `LICENSE` del repositorio: cada parte conserva su licencia, y lo que esa licencia permite sigue permitido. Las fuentes con su cita completa están en el README, en «Fuentes».

## Datos

| Qué | Dónde se usa | Licencia y aviso |
|---|---|---|
| OpenStreetMap: huellas de edificios, calles, ferrocarril, agua y estacionamientos | `fuente/osm.json`, `fuente/osm-amplio.json`, `fuente/osm-estacionamientos.json`, las huellas de `docs/ciudad/inventario.json`, `docs/ciudad/edificios.json` y `datos/ciudad_mapa.json`, el número y el nombre de cada edificio en `datos/ciudad_fichas.json`, y la geometría que de ellos toman `modelo/contexto.glb` y `modelo/ciudad*.glb` | © colaboradores de OpenStreetMap, [Open Database License (ODbL)](https://www.openstreetmap.org/copyright). Los extractos y lo que se derive de ellos como base de datos siguen bajo la ODbL: el `LICENSE` de este repositorio no los restringe. |
| Clima horario ERA5 por la API de Open-Meteo | `datos/clima_horario.bin.gz` (serie 2001–2025) y lo que se calcula con ella (`clima_resumen.json`, `consultas.json`, `confort.json`); pronóstico en vivo, leído en el navegador | [Weather data by Open-Meteo.com](https://open-meteo.com/), CC BY 4.0. Contiene información modificada del Servicio de Cambio Climático de Copernicus (ERA5, doi:10.24381/cds.adbb2d47); ni la Comisión Europea ni el ECMWF son responsables del uso que se haga de ella. |
| Partes METAR de Albrook (MPMG) | «Ahora» del visor y ajuste de la serie (`datos/ajuste_albrook.json`) | Iowa Environmental Mesonet, Iowa State University (https://mesonet.agron.iastate.edu/). |
| Alturas de Open Buildings 2.5D Temporal v1 | `fuente/alturas_ob.json` y las alturas de `docs/ciudad/edificios.json` y `datos/ciudad_fichas.json` | Google Research, CC BY 4.0. |
| Mapa de altura de copa de Meta y WRI | `fuente/arboles_cds.geojson`, `modelo/arboles*.glb` | CC BY 4.0 ([registro de AWS](https://registry.opendata.aws/dataforgood-fb-forests/)); imágenes © Maxar. |
| Sentinel-2 L2A | revisión de las copas (`fuente/arboles-chm/`) | Contains modified Copernicus Sentinel data 2019, 2026 ([aviso legal](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice)). |
| Copernicus DEM GLO-30 | `fuente/relieve.json` | Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. |

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

El modelo del 106 lo hizo el autor con ayuda de IA (Claude), a partir de fotos propias y de fotos de Alejandro González, usadas con su permiso. El modelo es del autor y queda bajo el `LICENSE`; las fotos de Alejandro González son suyas y no están en este repositorio.

## Letras y texturas

- Atkinson Hyperlegible Next (Braille Institute), Bricolage Grotesque e IBM Plex Mono: SIL Open Font License, servidas por Google Fonts.
- Texturas de asfalto, concreto y pasto de [Poly Haven](https://polyhaven.com/): CC0.
