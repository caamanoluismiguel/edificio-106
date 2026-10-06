# Historia del visor: del Edificio 106 a Ciudad del Saber

Este documento cuenta cómo se armó el visor de sol y clima del Edificio 106 y cómo terminó rodeado de una maqueta de Ciudad del Saber. Va del primer commit, el 25 de septiembre de 2026, al 6 de octubre de 2026: 252 commits en `main` repartidos en once días de trabajo (el 28 de septiembre no hubo ninguno). Cada etapa lleva la fecha y el hash del commit que la marca, para que se pueda revisar con `git show <hash>`. Las cifras salen del historial de git, del `README.md`, del `.claude/CLAUDE.md`, de `docs/ciudad/CIUDAD.md` y de las notas de trabajo del proyecto; lo que no estaba en esas fuentes se dejó fuera.

## De dónde salió

El punto de partida fue un modelo de Blender del 106, `Isthmus_v016.blend`, hecho antes de este repositorio por LM con ayuda de IA (Claude), a partir de fotos de Luis Miguel Caamaño y Raúl Alejandro González (autorización escrita de Raúl A. González, 6 oct 2026). El script `fuente/export_web.py` lo parte en grupos de armado (sitio, arquitectura, ventanas, cubiertas, entrada, detalles, vegetación y contexto) y los exporta como GLB para la web. La escala del modelo tiene un margen de ±12 % y las ventanas de los pisos 2 y 3 son inferidas, así que se trata como una maqueta digital.

La pregunta era concreta: cómo trabajan la orientación, los aleros, la lluvia y el viento en un edificio real del trópico, con datos que un docente o un estudiante de arquitectura puedan revisar y discutir en clase. De ahí salen las dos piezas que el visor tuvo desde el primer día: el sol calculado para cada minuto y el clima de cada hora entre 2001 y 2025.

Sobre el edificio en sí, el visor no afirma año de construcción, uso original ni autor. La única pista histórica con número es una foto del libro de construcción del fuerte, reproducida en el informe de CERL sobre Fort Clayton (Enscore et al., 2000, fig. 3.46, p. 3-24), con el título «Building 106, Field Artillery Equipment Shed for One Battery»: en el área de establos que se construyó en 1933, el 106 era un galpón para el equipo de una batería de artillería. El informe no dice de qué material era, y la numeración del Ejército no tiene por qué coincidir con la de Ciudad del Saber (`docs/ciudad/tipologias-cerl.md`).

## Las etapas

### 25 de septiembre: el 106 y su sol (`d216907`)

El primer commit, «modelo 3D con sol y clima horario», ya traía el sitio completo: la página, la app compilada, nueve GLB del modelo y el clima empaquetado. El sol sale del algoritmo de la calculadora solar de NOAA (basado en Meeus); el clima de 2001 a 2025, del reanálisis ERA5 leído por la API de archivo de Open-Meteo para la celda de 9,000° N y 79,500° O, y el «ahora», del pronóstico de Open-Meteo. El sitio llegó armado como un paquete y se publicó en GitHub Pages desde la raíz de `main`.

El mismo día entraron las consultas calculadas, las capas de visualización y el respaldo en WebGL 2 para los equipos sin WebGPU (`b644d5b`), y el primer recorrido guiado con una explicación para cada dato (`99d0629`).

### 26 y 27 de septiembre: viento, lluvia, comprobaciones y herramientas para la clase

Estos dos días se dedicaron a que la escena dijera algo útil. Entraron la capa de viento y la sombra real de los aleros (`160a9ce`), el modo «Año típico» con la radiación anual (`ed440d6`) y el modo «Partes», con el nombre y la función de cada parte del edificio sobre el modelo (`7e6ae93`). Los colores de tejas, muros y aleros se midieron contra fotos del edificio (`225645c`). El suelo empezó a mojarse según la lluvia de las horas anteriores y la vegetación a mecerse con el viento (`142acea`).

El 26 apareció también `fuente/verificar.mjs` (`e944d3a`), la batería de comprobaciones automáticas que compara el sol con otros algoritmos y las sombras con trazado de rayos. La radiación difusa pasó al modelo de cielo anisótropo de Hay y Davies (`f93bff0`), con el que la fachada noroeste recibe unos siete décimos de lo que recibe la sureste (`316ebbd`).

El 27 se sumaron piezas pensadas para la clase: preguntas de predicción antes de mostrar el resultado en cuatro pasos del recorrido (`4d3cc01`), una tarjeta con dos preguntas al llegar por el código QR de una fachada (`112b952`), el corte del alero con el rayo de sol de esa hora (`9157807`) y la opción de guardar la escena como imagen para una lámina (`f5a91d6`). Cerró el día la luna, con su posición y su fase calculadas para cada fecha (`c58d1ea`), y una noche que alumbra solo con fuentes reales o declaradas (`0168ee7`).

### 29 de septiembre: texto técnico, interiores y los primeros vecinos reales

Los números pasaron a un solo formato, con coma decimal y punto de miles (`e2db833`), y los textos a un registro técnico, donde el sol incide y las sombras se proyectan (`78be7de`). La imagen para la lámina sale a 2.400 px en el lado largo (`cda1631`). Se encontró que el bloom esparcía el 36 % de la luz sobre el umbral y velaba las vistas a contraluz; quedó en el 4,5 % (`cf6b994`).

Detrás de las ventanas aparecieron interiores procedurales hechos con *interior mapping*, sin texturas (`8a44377`). Los cuartos son una suposición y el sitio no los rotula.

Las cajas inventadas que rodeaban al 106 se cambiaron por los vecinos reales de OpenStreetMap, y los cercanos empezaron a proyectar sombra sobre el análisis (`0c08bf8`). Esa misma noche, tras revisar Street View, se corrigió quién es quién frente a la entrada: la huella 108 es La Casa, un salón de un piso con galería y teja; Innova pasa al 109 y el Teatro Ateneo al 182 (`8940fa8`). Con La Casa de un piso enfrente, la fachada sureste solo pierde la primera media hora de sol (`35892c8`).

### 30 de septiembre: el modelo se corrige con scripts, y llegan la auditoría y Confort

Al comparar con fotos reales y acercamientos de Street View se vio que la entrada y el pórtico del modelo no correspondían al edificio. En lugar de volver a Blender, cada pieza se corrigió con un script que parte del GLB publicado: `fuente/entrada.mjs` dejó la losa a nivel bajo el pórtico y la escalera retirada detrás de las columnas, como en la foto WA0014 (`f561aa3`), y `fuente/portico.mjs` pasó por varias versiones hasta el pórtico angosto, con 2,20 m entre ejes de columnas (`007ed4c`). Antes, el 29, `fuente/barandas.mjs` había llevado las barandas de los accesos hasta el muro (`1c193ae`). De ahí salió una regla que sigue vigente: nunca se reexporta un grupo desde un `.blend`, porque ningún `.blend` tiene estas correcciones y el modelo más nuevo son los GLB de `main`.

El mismo día nació `fuente/guardia.mjs` (`33a57ed`), el comando que demuestra que una rama no cambia nada más que lo que declara, y se publicó la profundidad de campo con el 106 siempre nítido (`799eae0`, en `main` con `efad4eb`).

Sobre lo publicado en `efad4eb` se hizo una auditoría de expertos en sol y radiación, datos climáticos, lectura arquitectónica e historia, y visualización. Encontró, entre otras cosas, que el texto decía «verificado contra SPA» cuando la comparación era contra Michalsky; que `Date.UTC` truncaba los minutos del sol; que la refracción se contaba dos veces en la salida y la puesta; y que la lluvia guardada en pasos de 0,2 mm daba 1.990 mm al año en lugar de 2.042. La corrección guardó la lluvia en uint16 a 0,1 mm en el formato binario C107, con `fuente/descargar_era5.py` capaz de reproducir el binario byte a byte (`4ad6078`), rehízo las cifras de lluvia con la serie corregida (`caf35bb`) y sumó la sección de método y validación, `LICENSE` (MIT para el código, CC BY 4.0 para los datos derivados) y `CITATION.cff` (`2199477`). También se agregó la comprobación 7 de `verificar.mjs`: con el sol sobre 60°, no se cuela sol bajo el alero (`c3c8526`).

El panel «Confort» llegó ese día con la carta psicrométrica de cada hora de 2001 a 2025 sobre las zonas de Givoni (1992) y el modelo adaptativo de ASHRAE 55, más el UTCI al sol y bajo el alero (`a3809d9`). El cálculo del UTCI es un porte de pythermalcomfort verificado contra él. Después vino «A esta hora conviene», con qué abrir, tapar o ventilar según el clima de afuera y la fuente de cada regla (`ba69f70`, `16749f8`, `ca99d54`). En el camino apareció un hallazgo que cambió la lectura de la carta: ERA5 tiene más humedad que las estaciones y aplana la oscilación del día, así que la carta se publicó con la humedad de Tocumen como línea de contraste (`16749f8`). El 2 de octubre esa línea se quitó, porque corregía solo la humedad y daba una cifra falsa (`ffaa187`); contra Albrook, en 2017 a 2025, ERA5 da de 0,2 a 0,9 g/kg más de humedad.

Cerraron la jornada los archivos con versión en la URL para que el navegador no mezcle versiones (`655733f`) y el enlace completo del momento, que guarda fecha, hora, forma de ver y encuadre (`ec97e20`).

### 1 de octubre: realidad aumentada, vecinos con altura y el entorno con el canal

La realidad aumentada empezó como una prueba aparte, sin enlazar desde el sitio (`ac7ea67`): una tarjeta impresa con el plano del sitio que MindAR reconoce, y encima el 106 en 3D con la sombra del sol calculado con el mismo `sol.js` del visor. El modelo de la AR son copias byte a byte de los GLB del sitio, con el techo en su versión liviana, y el plano de la tarjeta también se dibuja con las tejas livianas, porque con las completas MindAR no lo reconocía. LM la probó en su Android con Chrome y pidió un filtro más estable, que quedó por defecto (`c960981`). Ese mismo día la tarjeta pasó al sitio, en carta y A4 a escala 1:320 (`bf3c1fe`), y llegaron la versión de clase con fechas clave, persona de 1,70 m, norte y escalas 1:200 y 1:100 (`ab4f71f`), el archivo USDZ para Quick Look en iPhone y iPad (`eab178f`) y el material del piloto (`fa972e5`). En iPhone sigue sin probarse.

Los edificios 100, 101 y 107 pasaron a modelarse con la misma tipología que el 106, después de verlos en Street View, y los vecinos sin niveles en OpenStreetMap recibieron la altura de Google Open Buildings 2.5D (`df0f306`). En el propio 106, Open Buildings da alrededor de un metro menos que la cumbrera real.

Luego el entorno creció hasta Ciudad del Saber entera, con la Avenida Omar Torrijos Herrera, el ferrocarril, el canal y las esclusas de Miraflores (`f33bf3c`), sobre el relieve del Copernicus DEM GLO-30 fuera de una meseta plana alrededor del sitio (`24dbc9d`). Por el canal pasan barcos ilustrativos, uno cada dos horas por cada vía de las esclusas, 24 al día, cerca del promedio de unos 25 tránsitos Panamax diarios que registró la ACP (`7e3ab6b`). El panel de expertos atrapó aquí un error real antes de publicar: la primera versión daba 48 barcos al día. Todo se publicó en `f8aa5f7`. La cámara se aleja hasta 800 m y desde la calle frente al 106 se ven al fondo los contenedores.

Al final del día se quitaron dos vigas sueltas en X que estaban frente al 106 desde el primer sitio y nació `fuente/estado.mjs`, la foto del modelo pieza por pieza (`7114a61`).

### 2 de octubre: jurado, verificador, Albrook y veracidad

Un jurado simulado de tres revisores (agentes de IA con el papel de un arquitecto bioclimático y de dos jueces de diseño web, no personas reales) auditó el sitio, y sus hallazgos se arreglaron en siete ramas en paralelo que se integraron en `a9fd725`: metadatos, accesibilidad, rigor de fuentes, carga, densidad de la interfaz, teléfono y la página de la AR. Después vino un pulido gráfico de la interfaz (`2ca9778`).

Ese día se formalizó el agente verificador (`1915879`), del que se habla más abajo.

El clima dio dos pasos importantes. El «ahora» pasó a leer el último parte METAR del aeropuerto de Albrook (MPMG), a 4,1 km, servido por el Iowa Environmental Mesonet (`d39f4f2`). La serie de 2001 a 2025 se ajusta a Albrook al leerla: la temperatura por cuantiles de cada mes y hora, la humedad restando el sesgo de cada mes, con calibración en 2017 a 2025 (`ffaa187`, publicado en `e411afe`). El binario C107 no cambia. Con el ajuste, las horas de 30 °C o más pasan de unas 440 a unas 1.300 al año, y la hora más calurosa de la serie queda en 35,6 °C (27 de marzo de 2010 a las 14:00) en lugar de los 32,8 °C crudos. El umbral para dibujar lluvia quedó en 1 mm por hora de diciembre a marzo y 1,5 mm de abril a noviembre. Un arreglo posterior le dio al «ahora» 12 s de espera y reintentos a los 20 s y al minuto (`3b94dec`, publicado en `ac1ba99`).

Ese mismo día se hizo una pasada de veracidad sobre todo el visor, con un panel de clima de Panamá y uno de visualización, que terminó en `9f03bd2`. De ahí salieron reglas que siguen en el `.claude/CLAUDE.md`: mientras la escena dibuja lluvia no dibuja sol directo, y un dato de ERA5 se presenta como «ERA5 da», nunca como «llueve». La vista «Esquina» se movió para que el poste de luz real de la esquina no partiera el edificio en dos (`dddaf2e`).

### 3 de octubre: la interfaz en cuatro fases y las sombras fieles al dato

Tras un arreglo de medianoche (`d81073d`: de 00:00 a 00:59 la intro pedía una hora negativa), se ejecutó un plan de interfaz en cuatro fases, cada una publicada por separado:

1. Textos en lenguaje claro según un glosario aprobado por LM (`1a0f7eb`).
2. El narrador, que pasa a ser la primera fila del dock (`99f58e2`, con ajustes en `ab03e28`).
3. Una hoja inferior con varias alturas en el teléfono (`0fadcc8`).
4. Un panel lateral fijo en pantallas anchas y una guía de primera visita en tres pasos (`1cffa12`).

Después llegaron el corte del alero a un toque, el Sonido con su ícono de parlante y una guía para la noche (`30844dc`). Para comprobar que no se perdía nada, se hizo un inventario de 196 elementos de la interfaz contra `d81073d` (antes del plan) y pasó en 390, 820 y 1.440 px de ancho. Después de la fase 1 hubo también una prueba con estudiantes, que fue simulada (sin personas reales): 2 de 5 completaron las cuatro tareas. La prueba con estudiantes reales sigue pendiente.

El mismo día, el panel midió que con cielo despejado el contraste entre sol y sombra de la escena quedaba entre la mitad y un tercio de la razón física, y se rehízo la luz para que siga al dato (`b08b86b`). El sol del dato se compara con lo más despejado que da ERA5 (0,8 del cielo de Meinel, el percentil 95 de 2001 a 2025), el relleno de cielo se ata a la radiación difusa de esa hora y la franja oscura bajo el alero es oclusión de cielo, que no apaga el sol directo que entra bajo él. «Sombras del día» muestra ahora las horas de sombra de cada punto en cinco bandas.

### 4 de octubre: árboles reales

LM pidió un censo de árboles de Ciudad del Saber y no hay ninguno público. La alternativa fue el mapa de altura de copa de Meta y WRI (Tolan et al., 2024), a 1 m, sobre imágenes de Maxar del 4 de octubre de 2018, tesela 032221132. De ahí `fuente/arboles-chm/` saca 2.337 copas con altura y diámetro. No dicen especies, y el error absoluto medio del mapa es de 2,8 m en la validación del artículo, hecha en otros sitios.

Primero se cambiaron los árboles de relleno junto al 106 por 13 copas confirmadas en Street View, a unos 150 m o menos del edificio (`f4c0632`, publicado en `9ff7f28`). Tres se corrieron entre 0,50 y 3,75 m para que ningún tronco cayera en la calle ni una copa dentro de un edificio (`dda9b8a`), y una que caía en un estacionamiento quedó fuera. Después se extendió a toda la ciudad, con las copas como instancias de un mismo molde de árbol escalado a cada una (`392892a`). Se probó una superficie continua de copa para las zonas de bosque y LM la descartó. Una revisión con Sentinel-2 L2A de 2019 y 2026, seguida de Street View, dejó fuera 28 copas con verdor de edificio en 2026 que Street View no confirma (`0ec7de6`). Todo se publicó en `9b8a8dc`.

Esa publicación dejó una lección: en el teléfono solo se veía el 106, porque un filtro nuevo descartaba los grupos que en el perfil de teléfono se cargan después. Las pruebas eran solo de computador y no lo vieron. Se arregló en `73532e0`, y desde `55b963b` el guardia prueba también la carga como teléfono. El día cerró con la profundidad de campo por defecto en todos los niveles de calidad (`d415bc0`).

### 5 de octubre: Ciudad del Saber completa

La maqueta de la ciudad se publicó en `42871f0`, en un solo commit, encendida por defecto (se apaga en «Capas» o con `?ciudad=0`). El inventario tiene 322 edificios de OpenStreetMap. De ellos, 228 se arman con un kit de piezas que reutiliza las medidas del 106 del modelo (teja, mediaguas, ménsulas, ventanas) y los tipos y dimensiones del informe de CERL; 85 quedan como cajas grises con su altura estimada; 4 son volúmenes hechos a mano (la Fundación, La Casa, Innova y el Teatro Ateneo); 3 son copias reducidas del 106 (103, 105 y 107); el 106 tiene su modelo propio, y el último es la mitad de un dúplex que se dibuja con su otra mitad (`docs/ciudad/CIUDAD.md`).

Las huellas vienen de OpenStreetMap, las alturas de los niveles de OSM o de Open Buildings, y los pisos, la forma del techo y los colores de Street View, usado solo como referencia visual, y del conocimiento del sitio de LM. Cada edificio lleva una clase de certeza según qué tan bien se vio: I (156 edificios), II (140) y III (26). Aun en la clase I hay pendientes, alturas de piso y colores supuestos, y el único edificio medido sigue siendo el 106. La investigación con Street View queda fuera del repositorio; al repositorio va solo lo necesario para armar la ciudad, sin imágenes, identificadores ni posiciones de Google.

Los árboles se acomodaron contra los edificios nuevos: 2.209 copas puestas, 169 corridas hasta 5 m y 77 dejadas fuera porque no cabían (`README.md`). El mismo día llegaron la capa «Encuadres», con ocho planos de Ciudad del Saber y una vista aérea (`1312c68`; el de las esclusas se quitó en `5de10eb`), la navegación libre por la ciudad con la tarjeta de cada edificio (`457ef44`, `3727b79`) y la sombra de los demás edificios en un mapa de sombras más grueso, aparte del mapa fino del 106 (`e526e33`, publicado en `ee120e1`).

### 6 de octubre: postes de luz

OpenStreetMap no tiene ningún poste de luz en Ciudad del Saber (consulta del 6 de octubre de 2026). Además del poste real de la esquina del 106, que está en el modelo del sitio, `fuente/postes.mjs` pone postes por regla (`0b45d46`), todos de clase III porque ninguno se observó. La regla se ajustó varias veces durante el día: un poste en cada cruce, en una de sus esquinas, como el real junto al 106, y otro cerca del final de cada calle sin salida (`2712fd3`); postes a no más de unos 100 m solo en los tramos sin cruces de más de 200 m (`ea11bf7`). Quedaron 136. En 3 de los 60 cruces y en un tramo de 214 m no hubo lugar libre y ahí no hay poste. Tienen la forma y la altura del poste de la esquina, no proyectan sombra y de noche su luz se apaga del todo a unos 32 m de cada lámpara. El último commit del período es `769a076`.

Ese mismo día se midió la carga del sitio publicado con Lighthouse 13.5.0, cinco corridas por perfil: la nota de rendimiento dio una mediana de 66 sobre 100 en computador y de 30 en el teléfono simulado (gama media con 4G lenta), y 100 en accesibilidad, buenas prácticas y SEO en todas. En el teléfono simulado el contenido principal tarda unos 8,4 s en verse y la página queda bloqueada unos 3,8 s mientras arma la escena. Lighthouse no tiene tarjeta gráfica, así que mide la carga y no la fluidez del 3D. Los datos y los informes completos están en `docs/rendimiento/lighthouse-2026-10-06.md`.

## Cómo se trabajó

**Panel de expertos y verificador.** Toda información nueva (cifras, recomendaciones, capas) pasa antes por un panel simulado, hecho de agentes de IA con un papel cada uno, no de personas reales: expertos del tema con contexto de Panamá, uno de visualización y un crítico que cruza los informes. Se prefieren fuentes panameñas como el IMHPA, ETESA, la Guía de Construcción Sostenible de 2016 y la UTP. Desde el 2 de octubre (`1915879`) hay además un agente verificador permanente (`.claude/agents/verificador.md`), que recalcula cada número, abre cada fuente en el original y revisa que las cifras cuadren en todo el visor. Lo que marca como falso, incoherente o como un modelo presentado como medición bloquea la publicación.

**Guardia píxel a píxel.** Antes de cada publicación, `fuente/guardia.mjs` compara la rama contra `origin/main`: en git (avance rápido y ningún archivo borrado), en el modelo (cada GLB byte a byte y nodo a nodo), en 18 cuadros de la escena píxel a píxel y en la carga, como teléfono y como computador. Para que los cuadros sean comparables, el guardia fija el tiempo de los sombreadores, regenera el cielo y las sombras en ese instante y usa números al azar con semilla. `fuente/verificar.mjs` corre siete comprobaciones de sol y sombra, y dos de ellas tienen un control con un error a propósito que debe hacerlas fallar, para demostrar que la prueba sirve.

**Foto del modelo pieza por pieza.** `fuente/estado.mjs` guarda en `fuente/estado/` cada pieza de cada GLB del sitio y de la AR, con su material, sus triángulos y su caja a 1 cm, más la medida del pórtico. Con `--comprobar` lista exactamente qué piezas aparecen o desaparecen, y solo pueden aparecer las que el cambio dice tocar. Nació porque la forma del edificio ya había sufrido regresiones varias veces.

**Varias sesiones en paralelo.** Según el `.claude/CLAUDE.md`, Codex y otras sesiones de Claude Code empujan a `main` en paralelo, cada una en su rama y su worktree. Por eso cada publicación empieza con `git fetch` y la comprobación de las dos direcciones contra `origin/main`, y la app compilada nunca se fusiona como texto: se recompila. Un hook `pre-push` bloquea el push a `main` si no contiene el `main` remoto o si borra archivos.

**Publicar solo con «publica».** Nada sube a `main` sin que LM diga «publica» en ese turno. Después del push se comprueba que lo que sirve GitHub Pages sea igual, por md5, a lo local.

## Lo que no hace y lo que se descartó

Lo que el visor no hace, según su propio `README.md` y `docs/ciudad/CIUDAD.md`:

- No es un levantamiento. La escala tiene ±12 % y las ventanas de los pisos 2 y 3 son inferidas.
- No mide el clima en el sitio. ERA5 representa una celda de unos 28 km, subestima los aguaceros cortos y aplana la diferencia entre el día y la noche. El ajuste a Albrook acerca la temperatura y la humedad a las de un aeropuerto a 4,1 km, que tampoco es el sitio.
- No calcula el interior: ni temperatura, ni confort, ni ventilación dentro del aula. Para eso remite a EnergyPlus o Ladybug Tools.
- No dimensiona desagües.
- No muestra el canal en vivo. Los barcos son ilustrativos: siguen el eje del canal de OpenStreetMap a un ritmo cercano al promedio de la ACP.
- La ciudad es aproximada. Las lentes de fachada no se aplican a ella, no tiene interiores, los postes de las calles están puestos por regla y lo que dice «a medir en sitio» espera un recorrido a pie.

Lo que LM descartó y no se vuelve a proponer: los recorridos con sombra, la lluvia observada de la ACP, el consumo eléctrico, la captación de agua del techo, el catálogo de renders retocado con IA, la reexportación desde Blender, la oclusión ambiental horneada (sumaba 842 KB para una mejora casi invisible) y la superficie continua de copa para los bosques. En la investigación de la ciudad se descartaron también las Google Photorealistic 3D Tiles, que Google no ofrece en Panamá según su tabla de cobertura, y cualquier modelo capturado (fotogrametría o *splats*) donde la sombra importa, porque traen la luz del día de captura. Un corte con «rayos X» de las instalaciones también se descartó, porque no hay datos reales de plomería ni de electricidad.

Quedan pendientes, entre otros: la prueba de la AR en iPhone, la prueba de la interfaz con estudiantes reales, la medición en un teléfono de gama baja y el recorrido a pie por Ciudad del Saber para confirmar techos y pendientes.

## Fuentes de datos

| Dato | Fuente | Enlace oficial |
|---|---|---|
| Clima horario 2001 a 2025 | ERA5, Copernicus Climate Change Service (Hersbach et al., 2020 y 2023) | https://doi.org/10.24381/cds.adbb2d47 |
| Lectura de ERA5 y pronóstico | Open-Meteo (CC BY 4.0) | https://open-meteo.com/ |
| «Ahora» con Albrook | Parte METAR de MPMG por el Iowa Environmental Mesonet | https://mesonet.agron.iastate.edu/ |
| Estaciones de contraste | INEC, cuadro 121-01 (Balboa, Albrook y Tocumen, 2001 a 2010) | https://www.inec.gob.pa/archivos/P3771121-01.pdf |
| Clima de Tocumen 1977 a 2010 | IMHPA, Caracterización del clima en el distrito de Panamá | https://www.imhpa.gob.pa/uploads/documentos/caracterizacin_del_clima_en_el_distrito_de_panam.pdf |
| Posición del sol | Calculadora solar de NOAA (Meeus), verificada contra Michalsky (1988) y SPA (Reda y Andreas, 2004) | https://gml.noaa.gov/grad/solcalc/ |
| Lluvia con viento | ISO 15927-3:2009 (norma de pago) | (sin enlace abierto) |
| Confort | Givoni (1992); ASHRAE 55-2017; de Dear y Brager (2002); UTCI portado de pythermalcomfort (Tartarini y Schiavon, 2020) | https://doi.org/10.1016/j.softx.2020.100578 |
| Historia y tipologías de Clayton | Enscore et al. (2000), *Guarding the Gates: The Story of Fort Clayton*, CERL, DTIC ADA388262 | https://archive.org/details/DTIC_ADA388262 |
| Huellas, calles, ferrocarril y agua | OpenStreetMap (ODbL), base del 1 de octubre de 2026 | https://www.openstreetmap.org/copyright |
| Alturas estimadas | Google Open Buildings 2.5D Temporal v1, 2023 (Sirko et al., 2023, arXiv:2310.11622). Se ofrece con CC BY 4.0 u ODbL a elección; aquí se usa con ODbL, porque las alturas se combinan con las huellas de OpenStreetMap | https://sites.research.google/gr/open-buildings/temporal/ |
| Relieve | Copernicus DEM GLO-30 | https://registry.opendata.aws/copernicus-dem |
| Árboles | Meta y WRI, High Resolution Canopy Height Maps v1 (Tolan et al., 2024; CC BY 4.0). Source imagery for CHM © 2016 Maxar; la tesela usada es de imágenes del 4 de octubre de 2018 | https://registry.opendata.aws/dataforgood-fb-forests/ |
| Revisión de los árboles | Sentinel-2 L2A, Copernicus (contains modified Copernicus Sentinel data 2019, 2026) | https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice |
| Medidas de los barcos | ACP, OP Notice to Shipping N-1-2024 | https://pancanal.com/wp-content/uploads/2021/08/N01-2024-Vessel-Requirements-AC.pdf |
| Pisos, techos y colores de la ciudad | Street View de Google, solo como referencia visual. En el árbol actual del repositorio no hay imágenes de Street View; una hoja de verificación con dos recortes (`fuente/verificacion/portico/comparativa-portico.png`) estuvo en `main` hasta el commit que la borró (6 de octubre de 2026) y sigue en la historia de git | (sin enlace) |
| Reconocimiento de la tarjeta de AR | MindAR 1.2.5 (MIT) | https://github.com/hiukim/mind-ar-js |
| Texturas de asfalto, concreto y pasto | Poly Haven (CC0) | https://polyhaven.com/ |

Las citas completas, con DOI y páginas, están en la sección «Fuentes» del `README.md`.
