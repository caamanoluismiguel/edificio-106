# Edificio 106 · Isthmus

Modelo 3D paramétrico del Edificio 106 de Isthmus, en Ciudad del Saber (Clayton, Panamá), con el sol calculado para cada minuto y el clima hora por hora de 2001 a 2025. Sirve para leer y discutir cómo trabajan la orientación, los aleros y la lluvia en este edificio, y para aprender las partes básicas de un edificio.

**Ver el sitio:** https://caamanoluismiguel.github.io/edificio-106/

## Qué hace
- **Ahora:** sol de este minuto (algoritmo de NOAA) y pronóstico de modelo de Open-Meteo.
- **Máquina del tiempo:** Día · Año · 25 años. La regla del día muestra la lluvia y las nubes de cada hora (ERA5), o la probabilidad típica de lluvia si no hay dato.
- **Ir a…:** una fecha y hora exactas (desde 1940; entre 2001 y 2025 el dato viene incluido) o una de las consultas calculadas con la serie: días sin sombra, solsticios, equinoccio, sol de la tarde en el SO, la hora y el día más lluviosos (con su top 5), la fachada que más se moja, la sequía más larga, el día con más sol, el más oscuro y un día típico de cada mes. Cada salto es un viaje animado: corren la fecha y el sol, vuela la cámara y al llegar entra el tiempo.
- **Ver:** Foto · Sol (la radiación solar que incide en cada punto del edificio, con la sombra real de los aleros; solo directo o total con difusa y reflejada) · Lluvia (índice de lluvia con viento de ISO 15927-3, por hora o año típico) · Viento (rosa de vientos por temporada y qué fachada recibe el viento de frente) · Sombras (la sombra de cada hora del día sobre el terreno) · Partes (el nombre de cada parte del edificio sobre el modelo, qué es y qué hace; una persona de 1,70 m y las alturas para comparar; el alero explicado como voladizo, con tres largos para probar). Cada forma de ver trae su explicación: qué ves, cómo leerlo, algo para probar, para qué sirve, sus límites y cómo se calcula.
- **Recorrido guiado** de 11 pasos, y cada dato de la barra de abajo se puede tocar para ver qué significa.
- **Qué no hace:** temperatura interior y confort, ventilación interior (CFD), microclima y dimensionado de drenajes. La página dice qué usar en cada caso (EnergyPlus o Ladybug Tools con el EPW de Albrook, curvas IDF de una estación cercana).
- **Para qué sirve:** seis hallazgos (cero sombra, irradiación directa por fachada, el alero, la lluvia, la lluvia batiente y las horas cálidas), cada uno con un momento para verlo en la escena.
- Arrastra para girar el edificio; la brújula marca el norte real y el sol. Enlaces por fachada para los QR en sitio: `#fachada-se`, `#fachada-no`, `#fachada-ne`, `#fachada-so`. Enlace a un momento: `#m-AAAAMMDD-HHMM` (por ejemplo `#m-20240724-1745`).
- Si WebGPU falla en un equipo, la página pasa sola a WebGL 2. `#webgl` fuerza WebGL; `#webgpu` vuelve a probar WebGPU; `#depurar` muestra el diagnóstico.

## Qué no es
Un levantamiento (escala ±12 %, ventanas regularizadas) ni una medición del clima en el sitio: ERA5 representa una celda de 0,25° (unos 28 km). No sirve para dimensionar desagües ni calcula ventilación o confort.

## Fuentes y créditos
- [Weather data by Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0).
- Hersbach, H. et al. (2023). *ERA5 hourly data on single levels from 1940 to present*. C3S Climate Data Store. doi:10.24381/cds.adbb2d47. Contiene información modificada del Servicio de Cambio Climático de Copernicus (2025). Ni la Comisión Europea ni el ECMWF son responsables del uso que se haga de la información de Copernicus ni de los datos que contiene.
- Algoritmo solar de NOAA (Meeus). Estaciones de contraste: IMHPA (Tocumen) e INEC (Balboa, Albrook).
- Enscore, S. I. (2000). *Guarding the Gates: The Story of Fort Clayton*. CERL, DTIC ADA388262.
- Contexto: huellas de edificios © [colaboradores de OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL), en `fuente/osm.json`; `fuente/contexto.mjs` genera `modelo/contexto.glb` alineando OSM con el 106 del modelo. Las alturas de los vecinos son estimadas (los cuarteles del cuadrángulo repiten el 106; La Casa, el salón de un piso de enfrente, ~7 m a la cumbrera; Innova, 11 m; el Ateneo, 10 m; el resto, los niveles de OSM o dos).
- [three.js](https://threejs.org/) (MIT).

`fuente/` contiene el código (Vite) y los scripts que preparan el modelo, los puntos de la intro y el clima.

Proyecto académico experimental. No es un sitio oficial de Isthmus ni de Ciudad del Saber.
