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
- Hersbach, H. et al. (2020). The ERA5 global reanalysis. *QJRMS* 146, 1999–2049. doi:10.1002/qj.3803. Y (2023). *ERA5 hourly data on single levels from 1940 to present*. C3S Climate Data Store. doi:10.24381/cds.adbb2d47. Contiene información modificada del Servicio de Cambio Climático de Copernicus (2026). Ni la Comisión Europea ni el ECMWF son responsables del uso que se haga de la información de Copernicus ni de los datos que contiene.
- Algoritmo solar de NOAA (Meeus), verificado contra Michalsky (1988) y NREL SPA (Reda y Andreas, 2004). Estaciones de contraste: Tocumen (IMHPA 1977–2010 e INEC 2001–2010), Balboa (ACP) y Albrook (Autoridad de Aeronáutica Civil), publicadas por el INEC, cuadro 121-01.
- Enscore, S. I., Johnson, S. P., Webster, J. L. y Cohen, G. L. (2000). *Guarding the Gates: The Story of Fort Clayton*. CERL, DTIC ADA388262. Ojo: en sus planos de los años 30, el número 106 era un galpón de madera para equipo de artillería (fig. 3.46); la numeración actual puede no corresponder al mismo edificio.
- Contexto: huellas de edificios © [colaboradores de OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL), en `fuente/osm.json`; `fuente/contexto.mjs` genera `modelo/contexto.glb` alineando OSM con el 106 del modelo. Las alturas de los vecinos son estimadas (los edificios vecinos del cuadrángulo, que parecen repetir el volumen del 106; La Casa, el salón de un piso de enfrente, ~7 m a la cumbrera; Innova, 11 m; el Ateneo, 10 m; el resto, los niveles de OSM o dos).
- [three.js](https://threejs.org/) (MIT).

## Método y validación
- **Datos:** ERA5 (Hersbach et al., 2020, doi:10.1002/qj.3803) por la API de archivo de Open-Meteo (Zippenfenig, 2024, doi:10.5281/zenodo.7970649), celda 9,000° N 79,500° O (24 m), hora de Panamá. `fuente/descargar_era5.py` baja la serie y `fuente/clima_bin.py` la empaqueta (lluvia 0,1 mm, temperatura 1/6 °C, radiación 4 W/m², viento 1 km/h, dirección 2°).
- **Sol:** NOAA/Meeus, verificado contra Michalsky (1988) y NREL SPA (Reda y Andreas, 2004): ≤0,03° en altura y ≤0,11° en azimut; salida y puesta a ±1 min.
- **Radiación en fachadas:** Hay y Davies (1980), suelo al 20 %, sin factor de vista del cielo. **Lluvia batiente:** ISO 15927-3 en campo abierto (Blocken y Carmeliet, 2004, doi:10.1016/j.jweia.2004.06.003). **Confort:** Givoni (1992), ASHRAE 55-2017 y UTCI (Bröde et al., 2012), verificados contra pythermalcomfort.
- **Pruebas:** `cd fuente && node verificar.mjs` (sol, sombras contra trazado de rayos, sombra en la lente Sol, sin sol colado bajo el alero con el sol alto, luces, errores y tirones) y `node guardia.mjs` antes de publicar (que nada cambie fuera de lo declarado).

## Cómo citar
Caamaño, L. M. (2026). *Edificio 106 · Isthmus: visor de sol y clima* (versión del 30 de septiembre de 2026) [software]. https://github.com/caamanoluismiguel/edificio-106. Ver `CITATION.cff`. Código MIT (`LICENSE`); datos derivados CC BY 4.0.

`fuente/` contiene el código (Vite) y los scripts que preparan el modelo, los puntos de la intro y el clima.

Proyecto académico experimental. No es un sitio oficial de Isthmus ni de Ciudad del Saber.
