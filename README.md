# Edificio 106 · Isthmus

Modelo 3D paramétrico del Edificio 106 de Isthmus, en Ciudad del Saber (Clayton, Panamá), con el sol calculado para cada minuto y el clima hora por hora de 2001 a 2025. Sirve para leer y discutir cómo trabajan la orientación, los aleros y la lluvia en este edificio.

**Ver el sitio:** https://caamanoluismiguel.github.io/edificio-106/

## Qué hace
- **Ahora:** sol de este minuto (algoritmo de NOAA) y pronóstico de modelo de Open-Meteo.
- **Máquina del tiempo:** Día · Año · 25 años, o una fecha y hora exactas. Entre 2001 y 2025, las nubes, la lluvia y la radiación directa de cada hora salen del reanálisis ERA5; otras fechas se consultan en línea.
- **Para qué sirve:** seis hallazgos (cero sombra, irradiación directa por fachada, el alero, la lluvia, la lluvia batiente y las horas cálidas), cada uno con un momento para verlo en la escena.
- Arrastra para girar el edificio; la brújula marca el norte real y el sol. Enlaces por fachada para los QR en sitio: `#fachada-se`, `#fachada-no`, `#fachada-ne`, `#fachada-so`.

## Qué no es
Un levantamiento (escala ±12 %, ventanas regularizadas) ni una medición del clima en el sitio: ERA5 representa una celda de 0,25° (unos 28 km). No sirve para dimensionar desagües ni calcula ventilación o confort.

## Fuentes y créditos
- [Weather data by Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0).
- Hersbach, H. et al. (2023). *ERA5 hourly data on single levels from 1940 to present*. C3S Climate Data Store. doi:10.24381/cds.adbb2d47. Contiene información modificada del Servicio de Cambio Climático de Copernicus (2025). Ni la Comisión Europea ni el ECMWF son responsables del uso que se haga de la información de Copernicus ni de los datos que contiene.
- Algoritmo solar de NOAA (Meeus). Estaciones de contraste: IMHPA (Tocumen) e INEC (Balboa, Albrook).
- Enscore, S. I. (2000). *Guarding the Gates: The Story of Fort Clayton*. CERL, DTIC ADA388262.
- [three.js](https://threejs.org/) (MIT).

`fuente/` contiene el código (Vite) y los scripts que preparan el modelo, los puntos de la intro y el clima.

Proyecto académico experimental. No es un sitio oficial de Isthmus ni de Ciudad del Saber.
