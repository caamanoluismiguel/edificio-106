# Edificio 106 · Isthmus

Una maqueta digital del Edificio 106 de Isthmus, en Ciudad del Saber (la antigua base de Clayton, Panamá), con el sol calculado para cada minuto y el clima de cada hora entre 2001 y 2025. Sirve para ver, en un edificio real del trópico, cómo trabajan la orientación, los aleros, la lluvia y el viento, y para discutirlo en clase con datos que se pueden revisar.

**Ver el visor:** https://caamanoluismiguel.github.io/edificio-106/

**El edificio sobre tu mesa:** en el visor, «Capas» › «Sobre la mesa» trae una tarjeta para imprimir. Con el celular, el edificio aparece en 3D sobre el plano, con la sombra de hoy.

Proyecto académico experimental. No es un sitio oficial de Isthmus ni de Ciudad del Saber.

## Lo que muestra este edificio

Algunos resultados que salen del propio visor, con su momento para verlo en la escena («Para qué sirve»):

- **Dos días al año el sol del mediodía no deja sombra.** A 9° N pasa por el cenit en abril y en agosto (en 2026, el 12 de abril y el 29 de agosto, a las 12:19). Entre esas dos fechas el sol del mediodía va por el norte, así que de abril a agosto la cara norte también necesita protección.
- **Ninguna fachada se libra del sol.** Por el giro de 56° del edificio, las cuatro reciben sol de frente todos los días del año. Sin descontar nubes, la sureste unas 2.500 horas al año y la noroeste unas 1.900.
- **El alero de 1,65 m hace lo que promete con el sol alto.** Con el sol cerca del cenit, el vidrio bajo el alero queda en sombra mientras la pared sigue al sol.
- **El calor de la tarde llega por la fachada lateral suroeste.** En las horas de 30 °C o más (unas 440 al año), el sol está frente a la SO en el 78 % de ellas.
- **El viento llega casi siempre del norte y el noroeste.** La fachada noroeste lo recibe de frente unas 5.900 horas al año, más de cuatro veces que cualquier otra: es la entrada natural para ventilar de forma cruzada.
- **Llueve unos 2.000 mm al año, casi todo de mayo a noviembre y por la tarde.** En el total anual ERA5 da entre 6 y 8 % más que Tocumen, Balboa y Albrook. Coincide en el total, no en la intensidad de cada aguacero ni en su hora.

## Qué se puede hacer

- **Ahora:** el sol de este minuto y el pronóstico de Open-Meteo, que se renueva cada 15 minutos.
- **Máquina del tiempo:** recorrer un día, un año o los 25 años. La regla del día marca la lluvia y las nubes de cada hora.
- **Ir a…:** cualquier fecha y hora desde 1940, o un momento calculado con la serie: los días sin sombra, los solsticios, la hora más lluviosa en 25 años, la sequía más larga, el día con más sol y un día típico de cada mes.
- **Formas de ver:** Foto; Sol (la radiación que incide en cada punto, con la sombra real de los aleros, los árboles y los vecinos); Lluvia (lluvia con viento según ISO 15927-3); Viento (rosa de vientos por temporada); Sombras (la sombra de cada hora sobre el terreno); Partes (el nombre de cada parte del edificio, qué es y qué hace, con una persona de 1,70 m para comparar). Cada una explica qué se ve, cómo leerlo, sus límites y cómo se calcula.
- **Confort:** la carta psicrométrica con cada hora de 2001 a 2025 sobre las zonas de Givoni y el modelo adaptativo de ASHRAE 55, el UTCI al sol y a la sombra, y «A esta hora conviene»: qué conviene abrir, tapar o ventilar a esa hora según el clima de afuera, con la fuente de cada regla.
- **Para la lámina:** guardar la escena en PNG a 2.400 px con un pie y un código QR, o copiar el enlace exacto del momento (fecha, hora, forma de ver y encuadre).
- **Sobre la mesa:** la tarjeta de realidad aumentada (abajo).
- **Recorrido guiado** de 11 pasos. Cada dato de la barra de abajo se puede tocar para ver qué significa.

Enlaces directos: `#fachada-se`, `#fachada-no`, `#fachada-ne` y `#fachada-so` abren la página frente a cada fachada (son los de los QR en el sitio); `#m-AAAAMMDD-HHMM` abre un momento, por ejemplo `#m-20240724-1745`. Si WebGPU falla, la página pasa sola a WebGL 2; `#webgl` lo fuerza y `#depurar` muestra el diagnóstico.

## Sobre la mesa: el edificio en realidad aumentada

`ar/` es una página aparte que funciona en el navegador del celular, sin instalar nada ni pagar una plataforma.

1. Descarga la tarjeta (`ar/tarjeta/tarjeta.pdf`) e imprímela en A4 o carta al 100 %, en papel mate. Sin impresora, también funciona con la tarjeta abierta en la pantalla del computador.
2. Gira la hoja hasta que la flecha N apunte al norte.
3. Escanea el código QR, permite la cámara y apunta al plano entero.

El edificio aparece sobre el plano, a escala 1:320, y la sombra cae sobre el papel con el sol de hoy. El deslizador arranca en la hora de ahora, así que la sombra del modelo se puede comparar con una sombra de verdad en el patio.

Cómo está hecho: MindAR solo reconoce el plano y three.js dibuja la escena en metros, con el mismo cálculo del sol que el visor (`ar/sol.js` es una copia exacta de `fuente/src/sol.js`, y las pruebas lo comprueban). El modelo son copias byte a byte de los GLB del sitio, con el techo en su versión liviana (menos de 1 MB). La tarjeta se genera desde el propio modelo con `node ar/generar-tarjeta.mjs`. Probado en Android con Chrome; en iPhone todavía no.

## Qué no es

- **No es un levantamiento.** La escala del modelo tiene ±12 % y las ventanas de los pisos 2 y 3 son inferidas.
- **No es una medición del clima en el sitio.** ERA5 representa una celda de unos 28 km: subestima los aguaceros cortos, adelanta la lluvia de la tarde y achica la diferencia entre el día y la noche (en la estación seca oscila de 4 a 6 °C, y Tocumen, de 11 a 16 °C).
- **No calcula el interior.** Ni temperatura, ni confort, ni ventilación dentro del aula (eso pide una simulación de fluidos). La página dice qué usar en cada caso: EnergyPlus o Ladybug Tools con el archivo de clima de Albrook.
- **No dimensiona desagües.** Para eso hacen falta curvas de intensidad de lluvia de una estación cercana.

## Cómo está hecho

- La raíz del repositorio es el sitio publicado en GitHub Pages: `index.html`, `js/app.js` (compilado), `modelo/*.glb`, `datos/` (el clima empaquetado) y `texturas/`.
- `fuente/` tiene el código (Vite, three.js con WebGPU y WebGL 2) y los scripts que preparan el modelo, el clima y la intro. `fuente/cuerpo.html` es la página; `fuente/armar-raiz.sh` compila y escribe `index.html`.
- `ar/` es la realidad aumentada, con sus propias pruebas.

Para armar el sitio: `cd fuente && npm install && bash armar-raiz.sh`. Para bajar de nuevo la serie de clima: `python3 fuente/descargar_era5.py` (reproduce los datos byte a byte).

## Cómo se comprueba

- `cd fuente && node verificar.mjs`: el sol contra otros algoritmos, las sombras contra trazado de rayos, la sombra en la forma de ver Sol, que no se cuele sol bajo el alero con el sol alto, las luces, los errores y los tirones. Las comprobaciones de sombras tienen un control con un error a propósito que debe hacerlas fallar, para probar que la prueba sirve.
- `cd fuente && node guardia.mjs`: antes de publicar, compara el sitio contra `origin/main` en git, en el modelo (nodo a nodo) y en 18 cuadros píxel a píxel. Si algo cambia fuera de lo que se dijo que cambiaba, no se publica.
- `node ar/probar.mjs --video=<video>.y4m`: la AR con una cámara falsa (encuentra el plano, dibuja el edificio, el sol coincide con el del visor). `node ar/silueta.mjs` y `bash ar/verificar-huellas.sh` comprueban que el modelo de la AR es el mismo del sitio.

## Fuentes

**Clima**
- Hersbach, H. et al. (2020). The ERA5 global reanalysis. *Quarterly Journal of the Royal Meteorological Society*, 146(730), 1999–2049. doi:10.1002/qj.3803
- Hersbach, H. et al. (2023). *ERA5 hourly data on single levels from 1940 to present*. Copernicus Climate Change Service (C3S) Climate Data Store. doi:10.24381/cds.adbb2d47. Contiene información modificada del Servicio de Cambio Climático de Copernicus (2026). Ni la Comisión Europea ni el ECMWF son responsables del uso que se haga de la información de Copernicus ni de los datos que contiene.
- Zippenfenig, P. (2024). *Open-Meteo.com Weather API*. Zenodo. doi:10.5281/zenodo.7970649. [Weather data by Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0).
- Lavers, D. A. et al. (2022). An evaluation of ERA5 precipitation for climate monitoring. *Quarterly Journal of the Royal Meteorological Society*, 148(748), 3152–3165. doi:10.1002/qj.4351
- IMHPA. [Caracterización del clima en el distrito de Panamá](https://www.imhpa.gob.pa/uploads/documentos/caracterizacin_del_clima_en_el_distrito_de_panam.pdf) (Tocumen, 1977–2010).
- INEC. [Cuadro 121-01](https://www.inec.gob.pa/archivos/P3771121-01.pdf): Balboa (ACP), Albrook (Autoridad de Aeronáutica Civil) y Tocumen, 2001–2010.

**Sol y radiación**
- Algoritmo de la [calculadora solar de NOAA](https://gml.noaa.gov/grad/solcalc/), basado en Meeus, J. (1998). *Astronomical Algorithms* (2.ª ed.). Willmann-Bell.
- Michalsky, J. J. (1988). The Astronomical Almanac's algorithm for approximate solar position (1950–2050). *Solar Energy*, 40(3), 227–235. doi:10.1016/0038-092X(88)90045-X
- Reda, I. y Andreas, A. (2004). Solar position algorithm for solar radiation applications. *Solar Energy*, 76(5), 577–589. doi:10.1016/j.solener.2003.12.003
- Hay, J. E. y Davies, J. A. (1980). Calculation of the solar radiation incident on an inclined surface. En J. E. Hay y T. K. Won (eds.), *Proceedings of the First Canadian Solar Radiation Data Workshop* (pp. 59–72). Toronto.
- Duffie, J. A. y Beckman, W. A. (2013). *Solar Engineering of Thermal Processes* (4.ª ed.). Wiley.
- Olgyay, V. y Olgyay, A. (1957). *Solar Control and Shading Devices*. Princeton University Press.

**Lluvia con viento**
- ISO 15927-3:2009. *Hygrothermal performance of buildings. Calculation and presentation of climatic data. Part 3: Calculation of a driving rain index for vertical surfaces from hourly wind and rain data.*
- Blocken, B. y Carmeliet, J. (2004). A review of wind-driven rain research in building science. *Journal of Wind Engineering and Industrial Aerodynamics*, 92(13), 1079–1130. doi:10.1016/j.jweia.2004.06.003

**Confort y estrategias**
- Givoni, B. (1992). Comfort, climate analysis and building design guidelines. *Energy and Buildings*, 18(1), 11–23. doi:10.1016/0378-7788(92)90047-K
- ASHRAE (2017). *ANSI/ASHRAE Standard 55-2017: Thermal Environmental Conditions for Human Occupancy*.
- Bröde, P. et al. (2012). Deriving the operational procedure for the Universal Thermal Climate Index (UTCI). *International Journal of Biometeorology*, 56(3), 481–494. doi:10.1007/s00484-011-0454-1
- Arens, E. et al. (2015). Modeling the comfort effects of short-wave solar radiation indoors. *Building and Environment*, 88, 3–9. doi:10.1016/j.buildenv.2014.09.004
- Tartarini, F. y Schiavon, S. (2020). pythermalcomfort: A Python package for thermal comfort research. *SoftwareX*, 12, 100578. doi:10.1016/j.softx.2020.100578. El cálculo del UTCI de `fuente/src/confort.js` es un porte de pythermalcomfort (MIT) y se verificó contra él.
- Secretaría Nacional de Energía de Panamá (2016). *Guía de Construcción Sostenible para el Ahorro de Energía en Edificaciones*. Adoptada por la Resolución N.º 3142 (Gaceta Oficial N.º 28165, 24 de noviembre de 2016). Rango de confort para Panamá (p. 8), protección solar (pp. 33–37).
- UN-Habitat (2014). *Sustainable Building Design for Tropical Climates: Principles and Applications for Eastern Africa*. Nairobi: UN-Habitat. Ventilación cruzada (pp. 70–71), viento a la altura de la ventana (p. 29), persianas y lluvia (p. 115).
- Se revisó y no se usa Cedeño et al. (2022), *Novasinergia*: su simulación de aulas probó tasas de ventilación por debajo del mínimo que ella misma calcula.

**El lugar**
- Enscore, S. I., Johnson, S. P., Webster, J. L. y Cohen, G. L. (2000). *Guarding the Gates: The Story of Fort Clayton*. U.S. Army Construction Engineering Research Laboratory (CERL). [DTIC ADA388262](https://archive.org/details/DTIC_ADA388262). En sus planos de los años 30, el número 106 era un galpón de madera para equipo de artillería (fig. 3.46): la numeración actual puede no corresponder al mismo edificio, y este repositorio no afirma año de construcción, uso original ni autor del 106.
- Gordón, C. A. (2021). [Fort Clayton: procesos de cambio urbano](https://www.laestrella.com.pa/panama/nacional/fort-clayton-procesos-cambio-urbano-PILE459512). *La Estrella de Panamá*.
- Fundación Ciudad del Saber: [Historia](https://ciudaddelsaber.org/historia) y [Conoce el campus](https://ciudaddelsaber.org/conoce-el-campus). Isthmus: [isthmus.edu.pa](https://isthmus.edu.pa/ciudad-del-saber/).
- Huellas de los edificios vecinos © [colaboradores de OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL), en `fuente/osm.json`; `fuente/contexto.mjs` genera `modelo/contexto.glb` alineando OSM con el 106 del modelo. Las alturas de los vecinos son estimadas: los cuarteles que repiten el volumen del 106 (los del cuadrángulo, el 101 y los dos de Balboa Academy, el 100 y el 107) se vieron en Street View, igual que La Casa (~7 m a la cumbrera), Innova (11 m) y el Ateneo (10 m); el resto lleva los niveles de OSM o, si OSM no los trae, la altura de Open Buildings.
- Google Research. *Open Buildings 2.5D Temporal* v1, 2023 (CC BY 4.0): alturas estimadas desde satélite para los vecinos sin niveles en OSM. `fuente/alturas_ob.py` las extrae a `fuente/alturas_ob.json`. En el 106 da alrededor de un metro menos que la cumbrera real.

**Software, letras y texturas**
- [three.js](https://threejs.org/) (MIT). Follaje simplificado por poda estocástica: Cook, R., Halstead, J., Planck, M. y Ryu, D. (2007). Stochastic simplification of aggregate detail. *ACM Transactions on Graphics*, 26(3), 79. doi:10.1145/1276377.1276476
- [MindAR](https://github.com/hiukim/mind-ar-js) 1.2.5, de HiuKim Yuen (MIT), para reconocer la tarjeta. Copia sin modificar en `ar/vendor/`.
- [meshoptimizer](https://github.com/zeux/meshoptimizer) (MIT) y [glTF Transform](https://gltf-transform.dev/) (MIT) para comprimir y leer los modelos; [node-qrcode](https://github.com/soldair/node-qrcode) (MIT) para los QR; [Playwright](https://playwright.dev/) (Apache 2.0) para las pruebas.
- Letras: Atkinson Hyperlegible Next (Braille Institute), Bricolage Grotesque e IBM Plex Mono, todas con licencia SIL Open Font License, servidas por Google Fonts.
- Texturas de asfalto, concreto y pasto de [Poly Haven](https://polyhaven.com/) (CC0).

## Cómo citar

Caamaño, L. M. (2026). *Edificio 106 · Isthmus: visor de sol y clima* (versión del 1 de octubre de 2026) [software]. https://github.com/caamanoluismiguel/edificio-106

Ver `CITATION.cff`. El código tiene licencia MIT (`LICENSE`); los datos derivados, CC BY 4.0.
