# Edificio 106 · Isthmus

Una maqueta digital del Edificio 106 de Isthmus, en Ciudad del Saber (la antigua base de Clayton, Panamá), con el sol calculado para cada minuto y el clima de cada hora entre 2001 y 2025. Sirve para ver, en un edificio real del trópico, cómo trabajan la orientación, los aleros, la lluvia y el viento, y para discutirlo en clase con datos que se pueden revisar.

**Ver el visor:** https://caamanoluismiguel.github.io/edificio-106/

**El edificio sobre tu mesa:** en el visor, «Capas» › «Ver en la mesa (realidad aumentada)» trae una tarjeta para imprimir. Con el celular, el edificio aparece en 3D sobre el plano, con la sombra de hoy.

Proyecto académico experimental. No es un sitio oficial de Isthmus ni de Ciudad del Saber.

## Lo que muestra este edificio

Algunos resultados que salen del propio visor, con su momento para verlo en la escena («Para qué sirve»):

- **Dos días al año el sol del mediodía casi no deja sombra.** A 9° N pasa por el cenit en abril y en agosto (en 2026, el 12 de abril y el 29 de agosto, a las 12:19). Entre esas dos fechas el sol del mediodía va por el norte, así que de abril a agosto las caras NO y NE también necesitan protección.
- **Ninguna fachada se libra del sol.** Por el giro de 56° del edificio, las cuatro reciben sol de frente todos los días del año. Sin descontar nubes, la sureste unas 2.500 horas al año y la noroeste unas 1.900.
- **El alero de 1,65 m deja el vidrio en sombra con el sol alto.** Desde unos 45° de perfil, el vidrio queda en sombra mientras la pared sigue al sol.
- **El calor de la tarde llega por la fachada lateral suroeste.** En las horas de 30 °C o más (unas 1.300 al año con ERA5 ajustado al aeropuerto de Albrook; unas 440 sin ajustar), el sol está del lado de la SO en el 71 % de ellas.
- **El viento llega sobre todo del norte y el noroeste.** La fachada noroeste lo recibe de frente o en diagonal (a menos de 60° de su perpendicular) unas 5.900 horas al año, más de cuatro veces que cualquier otra: es la entrada natural para ventilar de forma cruzada.
- **Llueve unos 2.000 mm al año, casi todo de mayo a noviembre y por la tarde.** En 2001–2010 ERA5 da entre 8 y 9 % más que Albrook y Balboa; con Tocumen coincide (0,4 %) si se deja fuera 2009, que el INEC da en 863 mm, un registro que parece incompleto. Coincide en el total, no en la intensidad de cada aguacero ni en su hora.

## Qué se puede hacer

- **En vivo:** el sol de este minuto y el pronóstico de Open-Meteo, con valores cada 15 minutos interpolados; el modelo se actualiza varias veces al día.
- **Máquina del tiempo:** recorrer un día, un año o los 25 años. La regla del día marca la lluvia de cada hora (llena la que la escena dibuja, tenue la lluvia débil de la celda) y cuánto sol directo falta frente a un cielo despejado; mientras la escena dibuja lluvia, no dibuja sol directo.
- **Momentos clave:** cualquier fecha y hora desde 1940, o un momento calculado con la serie: los días sin sombra, los solsticios, la hora más lluviosa en 25 años, la sequía más larga, el día con más sol y un día típico de cada mes.
- **¿Qué quieres ver?** Cómo se ve; Sol en fachadas (la radiación que incide en cada punto, con la sombra real de los aleros, la de los árboles aproximados y la de los vecinos); Lluvia en fachadas (lluvia con viento según ISO 15927-3); Viento (rosa de vientos por temporada); Sombras del día (la sombra de cada hora sobre el terreno); Partes y medidas (el nombre de cada parte del edificio, qué es y qué hace, con una persona de 1,70 m para comparar). Cada una explica qué se ve, cómo leerlo, sus límites y cómo se calcula.
- **Confort:** la carta psicrométrica con cada hora de 2001 a 2025 sobre las zonas de Givoni y el modelo adaptativo de ASHRAE 55, el UTCI al sol y a la sombra, y «A esta hora conviene»: qué conviene abrir, tapar o ventilar a esa hora según el clima de afuera, con la fuente de cada regla.
- **Para la lámina:** guardar la escena en PNG a 2.400 px con un pie y un código QR, o copiar el enlace exacto del momento (fecha, hora, forma de ver y encuadre).
- **Ver en la mesa (realidad aumentada):** la tarjeta de realidad aumentada (abajo).
- **El entorno:** Ciudad del Saber entera con sus calles y edificios, la Avenida Omar Torrijos Herrera, el ferrocarril y el canal con las esclusas de Miraflores, sobre el relieve real fuera del sitio. Por el canal pasan barcos ilustrativos, uno cada dos horas por cada vía de las esclusas. La cámara se aleja hasta 800 m para ver el conjunto; desde la calle frente al 106 se ven al fondo los contenedores.
- **Recorrido guiado · 5 min**, de 11 pasos. Cada dato de la barra de abajo se puede tocar para ver qué significa.

Enlaces directos: `#fachada-se`, `#fachada-no`, `#fachada-ne` y `#fachada-so` abren la página frente a cada fachada (son los de los QR en el sitio); `#m-AAAAMMDD-HHMM` abre un momento, por ejemplo `#m-20240724-1745`. Si WebGPU falla, la página pasa sola a WebGL 2; `#webgl` lo fuerza y `#depurar` muestra el diagnóstico.

## Ver en la mesa: el edificio en realidad aumentada

`ar/` es una página aparte que funciona en el navegador del celular, sin instalar nada ni pagar una plataforma.

1. Descarga la tarjeta (`ar/tarjeta/tarjeta.pdf`) e imprímela en A4 o carta al 100 %, en papel mate. Sin impresora, también funciona con la tarjeta abierta en la pantalla del computador.
2. Gira la hoja hasta que la flecha N apunte al norte.
3. Escanea el código QR, permite la cámara y apunta al plano entero.

El edificio aparece sobre el plano, a escala 1:320, y la sombra cae sobre el papel con el sol de hoy. El deslizador arranca en la hora de ahora, así que la sombra del modelo se puede comparar con una sombra de verdad en el patio.

Cómo está hecho: MindAR solo reconoce el plano y three.js dibuja la escena en metros, con el mismo cálculo del sol que el visor (`ar/sol.js` es una copia exacta de `fuente/src/sol.js`, y las pruebas lo comprueban). El modelo son copias byte a byte de los GLB del sitio, con el techo en su versión liviana (menos de 1 MB). La tarjeta se genera desde el propio modelo con `node ar/generar-tarjeta.mjs`. Probado en Android con Chrome; en iPhone todavía no.

## Qué no es

- **No es un levantamiento.** La escala del modelo tiene ±12 % y las ventanas de los pisos 2 y 3 son inferidas.
- **No es una medición del clima en el sitio.** ERA5 representa una celda de unos 28 km: subestima los aguaceros cortos, adelanta la lluvia de la tarde y achica la diferencia entre el día y la noche: su máxima y su mínima diarias se separan de 4 a 6 °C, y en el aeropuerto de Albrook, a 4 km, de 5 a 8 °C. Por eso la temperatura y la humedad de 2001–2025 van ajustadas a Albrook (`fuente/ajuste_albrook.py`), que tampoco es el sitio.
- **No calcula el interior.** Ni temperatura, ni confort, ni ventilación dentro del aula (eso pide una simulación de fluidos). La página dice qué usar en cada caso: EnergyPlus o Ladybug Tools con el archivo de clima de Albrook.
- **No es el canal en vivo.** Los barcos no son la posición real de ningún barco: siguen el eje del canal de OpenStreetMap a un ritmo cercano al promedio de la ACP. Los edificios del entorno son volúmenes con altura estimada (OpenStreetMap, Open Buildings o Street View) y el relieve lejano tiene errores de algunos metros.
- **No dimensiona desagües.** Para eso hacen falta curvas de intensidad de lluvia de una estación cercana.

## Cómo está hecho

- La raíz del repositorio es el sitio publicado en GitHub Pages: `index.html`, `js/app.js` (compilado), `modelo/*.glb`, `datos/` (el clima empaquetado) y `texturas/`.
- `fuente/` tiene el código (Vite, three.js con WebGPU y WebGL 2) y los scripts que preparan el modelo, el clima y la intro. `fuente/cuerpo.html` es la página; `fuente/armar-raiz.sh` compila y escribe `index.html`.
- `ar/` es la realidad aumentada, con sus propias pruebas.

### El entorno (`modelo/contexto.glb`)

Lo genera `cd fuente && node contexto.mjs`, siempre igual a partir de los datos guardados en el repositorio (no lee el GLB anterior ni Blender):

| Pieza | Datos | Script |
|---|---|---|
| Vecinos cercanos (cuarteles, el salón de enfrente, Innova, Ateneo, Fundación) | `fuente/osm.json` + lecturas de Street View | `contexto.mjs`, `contexto-osm.mjs` |
| Ciudad del Saber entera, avenida, ferrocarril, agua del canal y esclusas | `fuente/osm-amplio.json` (Overpass, 1 oct 2026) | `entorno-osm.mjs` |
| Alturas sin niveles en OSM | `fuente/alturas_ob.json` | `alturas_ob.py` (Google Open Buildings 2.5D, 2023) |
| Relieve | `fuente/relieve.json` | `relieve.py` (Copernicus DEM GLO-30, filtrado a suelo) |
| Ejes del canal para los barcos | `fuente/src/canal-rutas.js` (lo escribe `contexto.mjs`) | `src/barcos.js` |

Decisiones que hay que respetar al tocarlo:

- **El registro de OSM es el del 106:** todo el entorno usa el mismo giro y traslado que `contexto-osm.mjs` calcula con la huella del 106, así nada se mueve respecto a los vecinos.
- **Junto al sitio el terreno es plano** (−0,6 m, bajo el pasto de `sitio.glb`, en una meseta de ±260 × −280/+320 m) y sube o baja al relieve real en 200 m. En 75 × 60 m alrededor del 106 no se agrega ninguna calle de OSM: ahí manda el modelo hecho con las fotos.
- **Las calles de OSM empalman con las del sitio:** se quitan solo donde ya hay asfalto modelado (una máscara leída de `sitio.glb`) y cerca del sitio se alinean con los ejes de Jorge Gil (z = 23,5 m) y Carlos Lara (x = 52,25 m). Miden 8 m como las modeladas; la avenida, 7,5 m por calzada.
- **Dos mallas por cada cosa, cerca y lejos.** `quantize` usa una sola escala por malla: en una malla de 6 km cada paso de altura mide 17 cm y las calles se hundían bajo el pasto. Lo que está a menos de 400 m va en mallas propias, con pasos de 1,25 cm.
- **Los materiales del entorno empiezan con «V017 street…»** y `escena.js` los adelanta en profundidad (polygonOffset) para que ganen al pasto del sitio. `dedup` junta materiales con los mismos parámetros aunque tengan otro nombre, por eso el asfalto de OSM lleva una rugosidad de 0,751 y no 0,75.
- **El agua** va a su nivel: el del mar al sur de Miraflores, el del Lago Miraflores al norte y, en la esclusa, dos cámaras. Los barcos suben o bajan en las compuertas.
- **Los barcos** usan una malla por modelo y lugar: cambiar la geometría de una malla ya dibujada deja a WebGPU con el búfer anterior. `?barcos=0` los quita.
- **La cámara** se aleja hasta 800 m y, pasados 360 m, la neblina se corre en proporción para que se siga viendo el canal.

Para armar el sitio: `cd fuente && npm install && bash armar-raiz.sh`. Para bajar de nuevo la serie de clima: `python3 fuente/descargar_era5.py` (reproduce los datos byte a byte).

## Cómo aportar

Se puede reportar un dato o una fuente incorrecta, proponer una fuente mejor (sobre todo panameña), corregir un edificio de la ciudad o mandar un cambio de código. Todo empieza en los [issues](https://github.com/caamanoluismiguel/edificio-106/issues), con su plantilla. Las reglas de contenido y cómo probar un cambio están en [`CONTRIBUTING.md`](CONTRIBUTING.md). La historia de cómo se hizo el visor, etapa por etapa, está en [`docs/HISTORIA.md`](docs/HISTORIA.md).

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
- Partes METAR de Albrook (MPMG) del [Iowa Environmental Mesonet](https://mesonet.agron.iastate.edu/), Iowa State University: el «ahora» del visor y el ajuste de la serie a Albrook (calibración 2017–2025).
- INEC. [Cuadro 121-01](https://www.inec.gob.pa/archivos/P3771121-01.pdf): Balboa (ACP), Albrook (Autoridad de Aeronáutica Civil) y Tocumen, 2001–2010.

**Sol y radiación**
- Algoritmo de la [calculadora solar de NOAA](https://gml.noaa.gov/grad/solcalc/), basado en Meeus, J. (1998). *Astronomical Algorithms* (2.ª ed.). Willmann-Bell.
- Michalsky, J. J. (1988). The Astronomical Almanac's algorithm for approximate solar position (1950–2050). *Solar Energy*, 40(3), 227–235. doi:10.1016/0038-092X(88)90045-X
- Reda, I. y Andreas, A. (2004). Solar position algorithm for solar radiation applications. *Solar Energy*, 76(5), 577–589. doi:10.1016/j.solener.2003.12.003
- Hay, J. E. y Davies, J. A. (1980). Calculation of the solar radiation incident on an inclined surface. En J. E. Hay y T. K. Won (eds.), *Proceedings of the First Canadian Solar Radiation Data Workshop* (pp. 59–72). Toronto.
- Duffie, J. A. y Beckman, W. A. (2013). *Solar Engineering of Thermal Processes* (4.ª ed.). Wiley.
- Olgyay, A. y Olgyay, V. (1957). *Solar Control and Shading Devices*. Princeton University Press.

**Lluvia con viento**
- ISO 15927-3:2009. *Hygrothermal performance of buildings. Calculation and presentation of climatic data. Part 3: Calculation of a driving rain index for vertical surfaces from hourly wind and rain data.*
- Blocken, B. y Carmeliet, J. (2004). A review of wind-driven rain research in building science. *Journal of Wind Engineering and Industrial Aerodynamics*, 92(13), 1079–1130. doi:10.1016/j.jweia.2004.06.003

**Confort y estrategias**
- Givoni, B. (1992). Comfort, climate analysis and building design guidelines. *Energy and Buildings*, 18(1), 11–23. doi:10.1016/0378-7788(92)90047-K
- ASHRAE (2017). *ANSI/ASHRAE Standard 55-2017: Thermal Environmental Conditions for Human Occupancy*.
- de Dear, R. J. y Brager, G. S. (2002). Thermal comfort in naturally ventilated buildings: revisions to ASHRAE Standard 55. *Energy and Buildings*, 34(6), 549–561. doi:10.1016/S0378-7788(02)00005-1. Origen del modelo adaptativo y sus condiciones de uso (§4.1, p. 556): espacios naturalmente acondicionados, ventanas que abren los ocupantes, sin refrigeración mecánica, actividad casi sedentaria
- Bröde, P. et al. (2012). Deriving the operational procedure for the Universal Thermal Climate Index (UTCI). *International Journal of Biometeorology*, 56(3), 481–494. doi:10.1007/s00484-011-0454-1
- Arens, E. et al. (2015). Modeling the comfort effects of short-wave solar radiation indoors. *Building and Environment*, 88, 3–9. doi:10.1016/j.buildenv.2014.09.004
- Tartarini, F. y Schiavon, S. (2020). pythermalcomfort: A Python package for thermal comfort research. *SoftwareX*, 12, 100578. doi:10.1016/j.softx.2020.100578. El cálculo del UTCI de `fuente/src/confort.js` es un porte de pythermalcomfort (MIT) y se verificó contra él.
- Secretaría Nacional de Energía de Panamá (2016). *Guía de Construcción Sostenible para el Ahorro de Energía en Edificaciones*. Adoptada por la Resolución N.º 3142 (Gaceta Oficial N.º 28165, 24 de noviembre de 2016). Rango de confort para Panamá (p. 8), protección solar (pp. 33–37).
- UN-Habitat (2014). *Sustainable Building Design for Tropical Climates: Principles and Applications for Eastern Africa*. Nairobi: UN-Habitat. Ventilación cruzada (pp. 70–71), viento a la altura de la ventana (p. 29), persianas y lluvia (p. 115), ventilar a toda hora en clima cálido húmedo (p. 68).
- Givoni (1992), §4.6.1, p. 17: el enfriamiento nocturno de la masa, aplicable sobre todo en regiones áridas, y los ventiladores, que amplían el rango de confort.
- Organización Meteorológica Mundial (2023). *Guide to Instruments and Methods of Observation* (WMO-No. 8), vol. I, cap. 8, §8.1.1, p. 309. Umbral de 120 W/m² de radiación directa para contar horas de sol.
- Se revisó y no se usa Cedeño et al. (2022), *Novasinergia*: su simulación de aulas probó tasas de ventilación por debajo del mínimo que ella misma calcula.

**El lugar**
- Enscore, S. I., Johnson, S. P., Webster, J. L. y Cohen, G. L. (2000). *Guarding the Gates: The Story of Fort Clayton*. U.S. Army Construction Engineering Research Laboratory (CERL). [DTIC ADA388262](https://archive.org/details/DTIC_ADA388262). En una foto del libro de construcción del fuerte (fig. 3.46, p. 3-24), el número 106 era un galpón para el equipo de una batería de artillería, y el informe no dice de qué material era. La numeración actual puede no corresponder al mismo edificio, y este repositorio no afirma año de construcción, uso original ni autor del 106.
- Gordón, C. A. (2021). [Fort Clayton: procesos de cambio urbano, militar y tecnológico en la antigua Zona del Canal](https://www.laestrella.com.pa/panama/nacional/fort-clayton-procesos-cambio-urbano-PILE459512). *La Estrella de Panamá*, 20 de noviembre de 2021.
- Fundación Ciudad del Saber: [Historia](https://ciudaddelsaber.org/historia) y [Conoce el campus](https://ciudaddelsaber.org/conoce-el-campus). Isthmus: [isthmus.edu.pa](https://isthmus.edu.pa/ciudad-del-saber/).
- Huellas de los edificios vecinos © [colaboradores de OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL), en `fuente/osm.json`; `fuente/contexto.mjs` genera `modelo/contexto.glb` alineando OSM con el 106 del modelo. Las alturas de los vecinos son estimadas: los cuarteles que repiten el volumen del 106 (los del cuadrángulo, el 101 y los dos de Balboa Academy, el 100 y el 107) se vieron en Street View, igual que el salón de un piso de enfrente (~7 m a la cumbrera), Innova (11 m) y el Ateneo (10 m); el resto lleva los niveles de OSM o, si OSM no los trae, la altura de Open Buildings.
- Ciudad del Saber (encendida por defecto; se apaga en «Capas» o con `?ciudad=0`): de los 322 edificios de OSM, 228 se arman con un kit de piezas (`fuente/ciudad.mjs` → `modelo/ciudad.glb` y `ciudad_alto.glb`) con las medidas del 106 del modelo y los tipos y dimensiones de CERL; los pisos, los techos y los colores salen de Street View, usado solo como referencia visual, y del conocimiento del sitio del autor. El kit reemplaza las copias del 106 en el 100, el 101 y el 102; el 103, el 105 y el 107 siguen como copias. Es aproximada: el único modelo medido es el 106. Fuentes, supuestos y clases de certeza en [`docs/ciudad/CIUDAD.md`](docs/ciudad/CIUDAD.md).
- Google Research. *Open Buildings 2.5D Temporal* v1, 2023 (CC BY 4.0): alturas estimadas desde satélite para los vecinos sin niveles en OSM. `fuente/alturas_ob.py` las extrae a `fuente/alturas_ob.json`. En el 106 da alrededor de un metro menos que la cumbrera real.
- Árboles: Tolan, J. et al. (2024). *Very high resolution canopy height maps from RGB imagery using self-supervised vision transformer and convolutional decoder trained on aerial lidar*. Remote Sensing of Environment 300, 113888 ([doi:10.1016/j.rse.2023.113888](https://doi.org/10.1016/j.rse.2023.113888)). Datos de Meta y WRI, CC BY 4.0 ([registro de AWS](https://registry.opendata.aws/dataforgood-fb-forests/)), tesela 032221132, imágenes © Maxar del 4 de octubre de 2018. `fuente/arboles-chm/` saca las copas (`copas.py` → `fuente/arboles_cds.geojson`) y las revisa con Sentinel-2 L2A (Copernicus, catálogo Earth Search de Element84, `sentinel.py`). Todos los árboles van en `modelo/arboles.glb` (`fuente/arboles-cds.mjs`), como instancias del molde `fuente/molde-arbol.glb` (el árbol más completo del anillo de relleno de la v016) escaladas a la altura y la copa de cada una: a unos 150 m o menos del 106, las 13 copas de `fuente/arboles_reales.json` que se vieron en Street View (imágenes de noviembre de 2022), con el molde completo y acomodadas por `fuente/arboles-acomodar.mjs` (tres se corrieron de 0,50 a 3,75 m; #1836, en un estacionamiento, quedó fuera); en el resto, 2.209 copas del mapa con el molde podado (Cook et al., 2007), corridas hasta 5 m si el tronco caía en la calle, en un estacionamiento o pegado a un edificio o la copa tocaba un edificio (169) o dejadas fuera si no cabían (77). Los edificios de la ciudad (`modelo/ciudad.glb` y `ciudad_alto.glb`, con el asfalto de sus estacionamientos) cuentan como obstáculo. `fuente/arboles_excluidos.json` deja fuera 28 copas con verdor de edificio en 2026 que Street View no confirma (27 fuera del círculo de 150 m). Contains modified Copernicus Sentinel data 2019, 2026 ([aviso legal](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice)). `modelo/arboles_movil.glb` (teléfono) lleva solo los 13 cercanos y las copas sueltas (ni las que tocan otra ni las de bosques de OSM). Aproximados: no es un censo y no dicen especies. Error absoluto medio del mapa: 2,8 m en la validación del artículo, en otros sitios. Las palmas, las cañas y los setos de `vegetacion.glb` vienen del modelo original y no de este dato.
- Entorno ampliado © colaboradores de OpenStreetMap (ODbL): calles, ferrocarril, agua y edificios de Ciudad del Saber, la Avenida Omar Torrijos Herrera y el canal hasta las esclusas de Miraflores, en `fuente/osm-amplio.json` (Overpass, base del 1 de octubre de 2026), leído por `fuente/entorno-osm.mjs`.
- Copernicus Digital Elevation Model (DEM) GLO-30, accedido el 1 de octubre de 2026 desde https://registry.opendata.aws/copernicus-dem; produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. Es un modelo de superficie (techos y árboles); `fuente/relieve.py` lo filtra a un suelo aproximado, con errores de algunos metros, en `fuente/relieve.json`. Junto al 106 el terreno sigue plano.
- Barcos ilustrativos (`fuente/src/barcos.js`), no son posiciones reales: miden lo que la ACP define como buque Panamax, hasta 294,13 × 32,31 m ([OP Notice to Shipping N-1-2024](https://pancanal.com/wp-content/uploads/2021/08/N01-2024-Vessel-Requirements-AC.pdf)), y pasan uno cada dos horas por cada vía de Miraflores (24 al día), cerca de los ~25 tránsitos Panamax diarios que registró la [ACP](https://pancanal.com/canal-de-panama-cumple-112-de-operaciones-manteniendo-su-vision-a-futuro/) entre octubre de 2025 y julio de 2026; desde el 15 de septiembre de 2026 hay 23 cupos de reserva diarios en esas esclusas ([ADV-29-2026](https://pancanal.com/wp-content/uploads/2026/08/ADV-29-2026-Additional-Measures-to-Address-Reduced-Precipitation-in-the-Canal-Watershed.pdf)). La altura sobre el agua, la velocidad y los tipos son supuestos del dibujo.

**Software, letras y texturas**
- [three.js](https://threejs.org/) (MIT). Follaje simplificado por poda estocástica: Cook, R., Halstead, J., Planck, M. y Ryu, D. (2007). Stochastic simplification of aggregate detail. *ACM Transactions on Graphics*, 26(3), 79. doi:10.1145/1276377.1276476
- [MindAR](https://github.com/hiukim/mind-ar-js) 1.2.5, de HiuKim Yuen (MIT), para reconocer la tarjeta. Copia sin modificar en `ar/vendor/`.
- [meshoptimizer](https://github.com/zeux/meshoptimizer) (MIT) y [glTF Transform](https://gltf-transform.dev/) (MIT) para comprimir y leer los modelos; [node-qrcode](https://github.com/soldair/node-qrcode) (MIT) para los QR; [Playwright](https://playwright.dev/) (Apache 2.0) para las pruebas.
- Letras: Atkinson Hyperlegible Next (Braille Institute), Bricolage Grotesque e IBM Plex Mono, todas con licencia SIL Open Font License, servidas por Google Fonts.
- Texturas de asfalto, concreto y pasto de [Poly Haven](https://polyhaven.com/) (CC0).

## Cómo citar

Caamaño, L. M. (2026). *Edificio 106 · Isthmus: visor de sol y clima* (versión del 1 de octubre de 2026) [software]. https://github.com/caamanoluismiguel/edificio-106

Ver `CITATION.cff`.

## Licencia

Todos los derechos reservados desde el 6 de octubre de 2026 (antes, MIT). Sin pedir permiso se puede ver el código, hacer fork dentro de GitHub, usar el visor publicado en clase y en investigación, y citarlo y mostrar sus imágenes con la cita. Publicar otra versión, usar copias locales para dar clase o cualquier uso comercial piden permiso escrito del autor, que se solicita en un issue. Los hechos y los datos en sí no quedan reservados. El texto completo está en [`LICENSE`](LICENSE). Los datos y el software de terceros (OpenStreetMap, ERA5 y Open-Meteo, three.js, MindAR y otros) conservan su propia licencia: ver [`TERCEROS.md`](TERCEROS.md).
