# Espiga de la fase 1: kit de cuarteles, carga y sombras

Rama local `feat/ciudad` (sin subir). Todo está detrás de `?ciudad=espiga`: sin esa bandera la página es la publicada (lo prueba el guardia, abajo). Es una espiga desechable, hecha para decidir cómo seguir. La revisó el verificador el 5 de octubre de 2026 y se corrigió lo que marcó.

## v3 (4 de octubre de 2026): sin árboles, mediaguas pieza por pieza del 106, techo de CERL y lectura para el teléfono

**Árboles: fuera de esta rama.** Se quitaron los 21 árboles junto al 101 y todo su código (`ciudad-kit.mjs` ya no lee `arboles_cds.geojson`; `ciudad.js` ya no arma los `InstancedMesh`). Los árboles de toda Ciudad del Saber los lleva otra rama (`feat/arboles-espiga`, `arboles.glb`). Lo que v1 y v2 dicen de árboles abajo queda como historia.

**Mediaguas y alero, medidos en el 106** (`medir106()`, `kit-medidas.json` → `medidas106.mediaguaPiezas`; mediagua del piso 1 en la fachada SE, alturas relativas a la losa del piso 2, 4,301 m, y distancias al plomo del muro):

| Pieza | Medida del 106 | Nodo |
|---|---|---|
| tablero inclinado | 17,86° (piso 1) y 17,94° (piso 2); 5,4 cm de espesor; canto a −0,450 m | cubiertas.glb · «Dark stained roof timber» |
| teja sobre el tablero | 4,3 cm (mediana; p95 8,4 cm); frente de la teja de −0,437 a −0,314 m | cubiertas.glb · «Clay terracotta 00…08» |
| tabla de borde | 9,8 × 14 cm, de −0,567 a −0,427 m, cara de afuera a 1,647 m del muro | cubiertas.glb · «Dark stained roof timber» |
| viguetas horizontales | 7,4 × 10,9 cm, de −0,483 a −0,374 m, del muro a 1,563 m, **cada 0,65 m** (70 en la SE), la primera a 0,324 m de la esquina | detalles.glb · «Dark stained roof timber» |
| solera contra el muro | 2,7 × 27 cm, de −0,035 a +0,235 m | detalles.glb · «Dark stained roof timber» |
| ménsulas | 0,26 m de ancho, 0,77 m de alto, de 0,30 a 1,47 m del muro; una por módulo de 6,70 m y **una a 0,30 m de cada esquina** (8 en la SE) | detalles.glb · «Fresh cream trim» |
| alero del techo | las mismas piezas 3,649 m más arriba (tabla de borde de −0,564 a −0,424 m y viguetas de −0,482 a −0,373 m bajo el remate del muro, 11,599 m); vuelo 1,647 m, igual que las mediaguas; 17,80° | los mismos nodos |

**Corrección:** v1 y v2 decían «cabios cada 1,625 m» siguiendo la pendiente. Era un error de agrupación (de a 0,25 m) sobre lo que en el 106 son **viguetas horizontales cada 0,65 m**, colgadas a la altura de la tabla de borde. El kit ya tenía bien el vuelo, la pendiente, el canto y el sofito; le faltaban las viguetas, la tabla de borde con espesor y cara de abajo, la solera, el espesor de la teja y las ménsulas de las esquinas. Ahora el detalle alto las tiene todas y el medio, la tabla de borde. Costo: el 101 pasa de 7.388 a 13.820 triángulos (las viguetas son casi todo) y el GLB de 295 a 392 KB.

**Lo que sigue sin cuadrar con Street View:** con las piezas exactas del 106, la banda visible de las mediaguas del 101 sigue siendo más angosta que en la foto (lectura aproximada en foto de Street View: unos 1 y 0,7 m contra 0,72 y 0,46 m esperados). Eso apunta a que las mediaguas del 101 tienen más pendiente que las del 106 (unos 26° a 30° con el mismo vuelo); no lo apliqué. Queda para medir en sitio.

**Techo del 101:** del 31° de v2 al techo del cuartel estándar de CERL (fig. 4.11, 61 ft de ancho como el 101): alero perimetral con las piezas del 106 y cuatro aguas a 6:12 (26,57°) desde el plomo del muro, con la cumbrera a 17,6 m y el hastial encima (punta a 17,9 m). Se probaron tres techos contra CERL escalado, Open Buildings recalibrado con el 106 y una lectura en foto de Street View: el de CERL es el único con un plano detrás, cuadra con el techo en dos niveles que se ve en Street View y queda dentro de lo que permite Open Buildings. Incertidumbre: pendiente de +4° a −6° (el plano es del tipo, no del 101) y cumbrera de +1,4 a −1,7 m; lo que más la mueve es el basamento, unos 1,9 m en una lectura en foto y de 0,8 a 1,2 m en otra, a medir en sitio. El kit ganó `techo.desdeMuro` (techo en dos niveles) y `mediagua.pendiente` por edificio; los cuarteles de prueba siguen con el techo del 106.

**Lectura de rendimiento para el teléfono: `?medir=1`** (`src/medir.js`, solo se importa con ese parámetro; funciona solo o con `?ciudad=espiga`). Arriba a la izquierda, en letra de datos y con los colores de `cuerpo.html`: motor (WebGPU, WebGPU compat o WebGL 2), nivel de calidad, relación de píxeles y tamaño del lienzo, cuadros por segundo (promedio de 1 s, solo los dibujados: en reposo el visor no dibuja y dice «en reposo»), el peor cuadro de los últimos 5 s (el intervalo más largo entre dos cuadros dibujados seguidos), llamadas de dibujo y triángulos del último cuadro (sombra, escena y posproceso juntos) y la sombra (opción, tamaño del mapa usado, el pedido y el máximo del equipo). Tocar el recuadro o «Copiar» copia el texto con la URL y el navegador; por `http://` a una IP el teléfono no deja usar el portapapeles moderno, así que usa `execCommand` y, si tampoco, deja el texto seleccionado.

Cambios para que el teléfono sea medible: `&sombramapa=` vale ahora también con `sombra=actual` (antes se ignoraba), se redondea a potencia de 2 y se recorta al máximo de textura del equipo (en `sunlight` el atlas mide el doble de ancho); si WebGL 2 baja al nivel «bajo» por lentitud, un `sombramapa` pedido se respeta. Sin `sombramapa`, el perfil del teléfono (`nivel: 'bajo'`, sombras de 2.048) da `actual` con 2.048 y `sunlight` con 2.048 por cascada. Probado con un teléfono emulado (390 × 844, táctil, WebGL 2 forzado): recuadro visible, sin errores de consola, 4.096 pedido con `sunlight` llega a 4.096 por cascada (máximo 16.384 en la Mac; en un teléfono puede salir menos y el recuadro lo dice).

Direcciones para LM, con el servidor de la Mac (`python3 -m http.server 8106 --bind 0.0.0.0` en el worktree, IP de hoy 192.168.0.3):

* teléfono, sombra de siempre: `http://192.168.0.3:8106/?ciudad=espiga&medir=1`
* teléfono, sombra de siempre a 2.048: `http://192.168.0.3:8106/?ciudad=espiga&sombra=actual&sombramapa=2048&medir=1`
* teléfono, SunLight a 2.048 y a 4.096: `http://192.168.0.3:8106/?ciudad=espiga&sombra=sunlight&sombramapa=2048&medir=1` y `…&sombramapa=4096&medir=1`
* lo publicado, solo para comparar: `http://192.168.0.3:8106/?medir=1`

Para medir: esperar a que diga «(montada)», girar con el dedo unos 5 s y copiar.

**Pruebas (v3):** `bash fuente/armar-raiz.sh`; `node estado.mjs --comprobar`: solo `ciudad_espiga.glb` (y el pórtico idéntico); `node guardia.mjs` contra `origin/main` (9ff7f28, sin bandera, WebGPU): modelo de main idéntico byte a byte y **18 de 18 cuadros iguales** (0 píxeles distintos); `node verificar.mjs` sin bandera: comprobaciones 1, 2, 3, 5, 6 y 7 PASAN en la corrida completa; la 4 falló por un 503 de un servicio externo en la carga y **PASA** al repetirla sola (0 errores); con `--solo=2 --url=ciudad=espiga&sombra=sunlight&sombramapa=4096`: **8 de 8 PASAN** (peor error −8,5 cm). **Los tiempos de esta corrida no valen como medida de rendimiento:** en la misma máquina corrían otros procesos al mismo tiempo.

**Diferencias que se ven contra Street View** (compuesto local que no se publica, las mismas cuatro vistas de v2; capturas del visor solo en `capturas/v3-101-*.png`). Son observaciones:

* En las vistas cercanas (`101-sur`) el edificio del visor sale unas 1,5 veces más grande que en la foto (la cámara del visor queda más cerca: el error de posición ya descrito en las comparaciones), y eso esconde más el techo.
* El faldón del techo ahora asoma sobre el alero en las vistas lejanas (`101-s`, `101-oeste`); en `101-sur` casi no se ve, y en Street View se ve una banda ancha de teja con el hastial grande encima.
* Bajo los aleros, el visor muestra un enrejado claro (las viguetas iluminadas desde abajo); en Street View el sofito se lee oscuro.
* Las mediaguas siguen más angostas que en la foto (ver arriba).
* Las ménsulas del kit son láminas curvas delgadas; en Street View son bloques blancos macizos.
* Sin árboles en el visor; en Street View hay árboles grandes delante en `101-sur` y `101-frente-so`.
* El tubo vertical de la esquina, las banderas y los postes no están en el visor.
* La luz no es comparable (Street View nublado, visor con sol a las 10:00).

## v2 (4 de octubre de 2026): materiales del 106 y el 101 según Street View

LM revisó la espiga y pidió materiales como los del 106, no reflectivos, y corregir la entrada del 101. Lo que cambió:

**Materiales.** El kit ya no tiene valores de material propios. Cada parte sale del generador como una primitiva con **el material del 106**, con su nombre y los valores que trae en los GLB de main (`MATERIAL_106` en `ciudad-kit.mjs`; quedan en `kit-medidas.json`, `medidas106.materiales`):

| Parte | Material del 106 | GLB |
|---|---|---|
| muro | Warm lime-painted plaster | arquitectura.glb |
| moldura, ménsulas, columnas | Fresh cream trim | detalles.glb |
| teja y mediagua | Clay terracotta 04 (el del medio de los nueve tonos 00 a 08 del 106) | cubiertas.glb |
| vidrio | V014 physical clear glass 0 | arquitectura.glb |
| celosía | Weathered blue-grey louvre | detalles.glb |
| madera (sofitos, fajas, cabios) | Dark stained roof timber | cubiertas.glb |
| rejilla del hastial | Dark ventilation recess | cubiertas.glb |
| paneles del zócalo del 101 | Brown painted service access | detalles.glb |

En la escena, `src/ciudad.js` pasa cada material por **la misma función** que pinta al 106 y a sus copias del contexto (`escena.js #material`, grupo «contexto»: sin lentes ni cuartos interiores), expuesta como `ctx.material`. Al 101 se le suma el sustituto de oclusión bajo los aleros del 106, con las alturas de sus propios aleros (opción `aoAlturas`, que sin la bandera no existe: sin `opc` la función es idéntica). Se quitaron el sombreador propio (hiladas y canales dibujados, tono por teja, rugosidades del kit) y `COLOR_0`. Lo que el kit **no** copia del 106 es la geometría de las tejas: el 106 tiene tejas modeladas y el kit planos, así que de cerca el techo del kit se ve liso.

Costo: el héroe pasa de 1 a 8 llamadas de dibujo (una por material) y los 22 cuarteles de prueba de 1 a 5 (`BatchedMesh` por material). El GLB pasa de 229 a 295 KB. No volví a correr la matriz de rendimiento.

**Medición de brillo** (`fuente/ciudad-luz.mjs`, informe en `medidas/luz-v2.json`): el 101 del kit y el 106 en la misma corrida, 15 de enero de 2024, 9:30, `sombra=sunlight&sombramapa=4096`, WebGPU, 1440 × 900. Una pasada con colores planos marca qué píxeles son muro o techo de cada uno; sobre el cuadro final se mide la luminancia (Rec. 709 sobre los valores sRGB de 0 a 1) y el porcentaje de píxeles casi blancos (los tres canales ≥ 235). Cada celda: píxeles · media · mediana · casi blancos.

| Vista | Región | 101 del kit | 106 |
|---|---|---|---|
| calle, los dos en el cuadro | muro | 8.058 · 0,772 · 0,795 · 0 % | 3.397 · 0,375 · 0,339 · 0 % |
| calle, los dos en el cuadro | techo y mediaguas | 5.255 · 0,340 · 0,344 · 0 % | 1.664 · 0,251 · 0,260 · 0 % |
| aérea, los dos en el cuadro | muro | 2.447 · 0,683 · 0,793 · 0 % | 1.644 · 0,471 · 0,350 · 0 % |
| aérea, los dos en el cuadro | techo y mediaguas | 9.429 · 0,341 · 0,354 · 0 % | 12.084 · 0,273 · 0,318 · 0 % |
| par SE, misma cámara relativa | muro | 322.084 · 0,779 · 0,796 · 0 % | 143.691 · 0,619 · 0,788 · 0 % |
| par SE | techo y mediaguas | 71.066 · 0,353 · 0,355 · 0 % | 19.766 · 0,339 · 0,349 · 0 % |
| par NO | muro | 331.061 · 0,210 · 0,249 · 0 % | 342.061 · 0,217 · 0,248 · 0 % |
| par NO | techo y mediaguas | 105.512 · 0,461 · 0,469 · 0 % | 34.106 · 0,048 · 0,025 · 0 % |
| par alto | muro | 15.275 · 0,693 · 0,799 · 0 % | 11.897 · 0,658 · 0,792 · 0 % |
| par alto | techo y mediaguas | 63.363 · 0,336 · 0,348 · 0 % | 63.489 · 0,308 · 0,332 · 0 % |

Lectura: **ningún píxel casi blanco** en muros ni techos del kit ni del 106. Con la misma orientación al sol, las medianas del muro coinciden (SE 0,796 contra 0,788; NO 0,249 contra 0,248; desde lo alto 0,799 contra 0,792) y las del techo visto desde arriba también (0,348 contra 0,332). Las medias del muro difieren más (SE 0,779 contra 0,619) porque el 106 tiene más superficie a la sombra en ese encuadre (pórtico, árboles, oclusión de su modelo); en los cuadros con los dos edificios a la vez las caras visibles no tienen la misma orientación, y por eso difieren. En el par NO el techo del kit es más claro (0,461 contra 0,048): desde abajo, del 106 se ven sobre todo los envés en sombra de las tejas modeladas; del kit, el tejadillo del pórtico (que está en la NO y recibe cielo) y el frente de teja de las mediaguas. **No tengo el mismo cuadro con el kit v1** para comparar el antes y el después: el brillo que vio LM no quedó medido.

**El 101.** Las pruebas de Street View, la huella de OSM, la vista desde arriba y el CERL quedan en un informe de trabajo fuera del repositorio; las medidas leídas en fotos son aproximadas, a medir en sitio. En corto: no aparece un pabellón central de varios pisos en una fachada larga; sí un hastial de ventilación con remate sobre el extremo SO y un pórtico de entrada de un piso en la fachada NO, cerca del extremo NE. El kit ganó parámetros por edificio con valor por defecto del 106: `pisos`, `basamento`, `techo.pendiente`, `ventanas` (`pares` o `banda` con `retiro`), `mensulas`, `rejilla`, `pabellones` (adosados: lado, distancia a un extremo, ancho, fondo, pisos, abiertos con columnas o cerrados, techo a dos aguas con hastial o a cuatro aguas, pendiente, remate) y `hastial` (sobre un extremo del techo). Al 101 se le pusieron los valores estimados (basamento 1,9 m, techo a 31°, bandas retiradas 0,3 m, paneles pardos en el zócalo, pórtico y hastial). Para todos los cuarteles, también los de prueba: ménsulas con el perfil medido del 106 (`detalles.glb`, «Fresh cream trim», 0,26 m de ancho y 1,47 m de vuelo) y el frente de la teja de la mediagua (12,4 cm, `cubiertas.glb`). Los 22 de prueba no cambian de pisos ni de basamento: eso viene con el inventario (227, 235 y 239 parecen tener 4 niveles y el 228 un basamento alto, según las comparaciones de Street View).

**Diferencias que se ven contra Street View** (compuesto local que no se publica, cuatro vistas):

* La luz no es comparable: Street View está nublado y el visor tiene sol a las 10:00; las caras a la sombra salen grises en el visor.
* El faldón del techo se ve en Street View desde la calle como una banda ancha de teja; en el visor, aun a 31°, se ve poco por encima del alero.
* Las mediaguas de Street View se leen como bandas anchas de teja con sofito oscuro; las del kit siguen más delgadas (el kit tiene el frente de teja del 106, 12 cm, y un plano liso).
* El hastial y su remate aparecen en el visor sobre el extremo SO, más chicos y de borde más fino que en Street View; el tubo vertical de la esquina no está modelado.
* Ventanas: en Street View hay más paños por banda en la cara SO (4 o 5 paños casi de lado a lado); el kit pone dos bandas de 4,9 m por piso en esa cara.
* Árboles, banderas, postes, mástiles y la caja gris de la maqueta vecina difieren (ver el informe de comparaciones).

Capturas del visor (sin imágenes de Google): `capturas/v2-calle101.png` y `v2-aerea101.png` (el 101 solo; la aérea es la cámara del enlace de LM), `v2-luz-*.png` (los cuadros de la medición de brillo).

**Pruebas (v2):** `bash fuente/armar-raiz.sh`; `node estado.mjs --comprobar`: solo `ciudad_espiga.glb` (y `cubiertas_movil.glb`, el punto 7 de abajo, igual que antes); `node guardia.mjs HEAD` (sin bandera, WebGPU, contra la espiga v1): modelo de main idéntico y **18 de 18 cuadros iguales** (0 píxeles distintos; máx. de canal 1 en 4 casos); `node verificar.mjs` sin bandera: **7 de 7 PASAN**. Ojo: `origin/main` avanzó (9ff7f28, árboles reales en `vegetacion.glb`), así que `node guardia.mjs` contra `origin/main` sale distinto en 13 cuadros por esos árboles, no por la espiga; hay que hacer rebase antes de cualquier comparación con main.

## Qué se armó

- **Kit de piezas** (`fuente/ciudad-kit.mjs` → `modelo/ciudad_espiga.glb`, 229 KB). Entrada por edificio: polígono de la huella, pisos, pendiente y forma del techo, colores. Salida: una sola geometría por edificio con `_PARTID` por vértice (0 muro, 1 moldura, 2 teja, 3 mediagua, 4 vidrio, 5 celosía, 6 madera) y el color base en `COLOR_0`. Techo a cuatro aguas con esqueleto recto propio (solo polígonos convexos; si la huella no es convexa, rectángulo mínimo), altura = distancia al borde × tan(pendiente).
- **(v1, reemplazado en v2)** **Material único** TSL (`fuente/src/ciudad.js`), un `MeshStandardNodeMaterial` que ramifica según `_partid`, con los colores y rugosidades de los GLB del 106 y los mismos retoques de `escena.js #material` (pañete casi neutro con manchas, tinte de la teja, sofitos oscuros), hiladas y canales de teja dibujados en el sombreador y ventanas que se encienden de noche como las del contexto. `?partes` pinta cada parte de un color plano para revisar el atributo.
- **Héroe: el 101** en detalle alto sobre su huella de `osm.json` (50,2 × 18,7 m): 8.022 triángulos, una llamada de dibujo. Con la bandera se esconde su copia reducida del 106.
- **Prueba de carga: 22 huellas** que el inventario marca como parecidas al cuartel CERL de 18,6 × 43 m y que hoy son cajas grises. **Conjetura por forma, solo prueba de rendimiento**: nadie comprobó que sean cuarteles ni su número de pisos (salen de la altura p90 de Open Buildings, de 1 a 3 pisos). Van en un `BatchedMesh` con dos niveles por instancia: medio (4.843 triángulos en total) a menos de 350 m de la cámara y lejano (491) más allá. Se quitan del contexto los 234 triángulos de sus cajas grises (de 10.556 de maqueta). Las otras 7 huellas del grupo de 29 ya tienen modelo (el 106, sus 5 copias y el Ateneo) y no se tocan.
- **Árboles**: 21 árboles junto al 101 en dos `InstancedMesh` (alto, 208 triángulos cada uno; bajo, 20), que se cambian a 160 m del grupo. Sus posiciones, alturas y diámetros de copa salen de `~/projects/edificio-106-arboles/arboles_cds.geojson` (Meta y WRI, CHM v1, imágenes Maxar del 4 de octubre de 2018, Tolan et al. 2024; **APROXIMADO**, sin verificar): solo árboles con copa separada y fuera de bosque OSM, los 21 más cercanos al 101 hasta 150 m, registrados con el mismo giro y traslado de `contexto-osm.mjs`. El archivo se lee desde afuera del repo, no se copió. **Desfase conocido sin corregir:** frente a los árboles de OSM hay un corrimiento medio de unos 3,7 m hacia el sur (el propio archivo dice 4,9 m contra 24 árboles de OSM). Sin ese archivo, el script cae a posiciones inventadas.
- **Sombras** con `?sombra=actual|sunlight|csm|ajustada` (solo con la bandera): la de siempre (±70 m, 4.096 px); `SunLight` de r186 (2 cascadas, 600 m de alcance, 2.048 px por cascada; `&sombramapa=4096` las sube); `CSMShadowNode` (3 cascadas, 600 m, 2.048 px, con fundido); y un solo mapa ajustado a la caja de la ciudad según el sol, con el sesgo escalado para que valga los mismos 0,56 m de siempre.
- **No se hizo** la parte F (cielo con `LightProbeGrid`).

## Medidas del kit, tomadas del 106 (modelo/*.glb de main)

| Medida | Valor | De dónde sale |
|---|---|---|
| Planta del 106 | 45,50 × 23,00 m | `arquitectura.glb`, nodo «Warm lime-painted plaster» (caja) |
| Remate del muro | 11,60 m | el mismo nodo, y máxima |
| Base (losa del piso 1) | 0,65 m | `arquitectura.glb`, nodo «V014 muted interior floor» |
| Piso a piso | 3,649 m (losas a 0,65 · 4,301 · 7,949) | el mismo nodo |
| Vuelo de aleros y mediaguas | 1,65 m (1,647 en las caras cortas) | `cubiertas.glb`, nodo «Dark stained roof timber», sofito plano (borde x ±24,40, z ±13,15) |
| Sofito plano de cada alero | 3,734 · 7,386 · 11,035 m | el mismo nodo |
| Pendiente del techo | 17,8° (canto a 11,148 m, cumbrera a 15,643 m) | el mismo nodo, caras hacia arriba sobre 11 m, media ponderada por área |
| Pendiente de las mediaguas | 17,9° (17,86° y 17,94°); canto a 3,851 y 7,499 m | el mismo nodo, entre 3,5 y 5 m y entre 7 y 8,5 m |
| Módulo de vanos | 6,69 m (42 bordes calzan, error medio 1,2 cm): machón 1,80 · par de 2,20 · machón 0,50 · par de 2,20 | `arquitectura.glb`, nodos «V014 physical clear glass 0/1/2», bordes del vidrio en la fachada SE |
| Ventana | 1,55 m de alto; antepecho 1,17 m (piso 1) y 1,32 m (pisos 2 y 3) | los mismos nodos, bordes en y |
| Cabios (ERROR, corregido en v3: viguetas horizontales cada 0,65 m) | cada 1,625 m (29 en la SE, piso 1) | `detalles.glb`, nodo «Dark stained roof timber» |
| Rejillas del zócalo | de 0,222 a 0,578 m | `detalles.glb`, nodo «Weathered blue-grey louvre» |

Todo queda en `docs/ciudad/espiga/kit-medidas.json` (`node ciudad-kit.mjs --medir` lo vuelve a medir). Lo que el kit **supone** sin dato: anchos del par de ventanas y de los machones (leídos de los bordes, no de un plano), el mismo ritmo de vanos en las caras cortas, el zócalo de moldura, las rejillas cada 3,25 m y que todos los cuarteles repiten las medidas del 106. Los alzados del CERL (fig. 4.10 y 4.11) muestran la misma familia (planta baja elevada, mediaguas por piso, cuatro aguas con ventilación de cumbrera), pero sus medidas no se usaron.

## Cómo se midió

- `fuente/ciudad-medir.mjs`, Chromium sin ventana de Playwright 1.63 en un **Mac con Apple M4** (no es un teléfono). Momento fijo: 15 de enero de 2024, 9:30. Tres vistas: aérea, calle frente al 101 a 1,6 m y los cuarteles de prueba. Perfiles: `alto` 1440 × 900 (con WebGL 2 forzado, `escena.js` lo baja a `medio`), `bajo` (lo mismo y `escena.bajarNivel()`, que deja la sombra en 1.024 px, también en «sunlight4096») y `movil`, ventana táctil de 390 × 844 que activa el perfil del teléfono de `main.js`.
- **Llamadas y triángulos**: `renderer.info` de un cuadro con la sombra rehecha, y el mínimo y máximo de cada cuadro mientras la cámara gira (con `actual` y `ajustada` la sombra no se rehace al girar; con `sunlight` y `csm` sí, en cada cuadro).
- **Tiempo de cuadro**: dos medidas. La de la comprobación 5 (intervalos de `requestAnimationFrame` girando 4 s): todo da 16,7 ms porque el navegador tiene tope de 60 Hz, así que solo detecta tirones. Y el cuadro con GPU: después de un `requestAnimationFrame`, desde el inicio del render hasta que la GPU termina (en WebGPU, una copia de un píxel del lienzo y `onSubmittedWorkDone`; en WebGL 2, leer un píxel), 120 cuadros girando. Entre corridas iguales la mediana varió hasta 3 ms: las diferencias de menos de eso no dicen nada.
- Las filas de WebGL 2 y de `bajo` se tomaron con la cámara de calle en (106; 1,6; −110); las de `alto` y `movil`, con la cámara en (116; 1,6; −112), corrida después para que un tronco no tape la fachada.

## Números

#### webgpu · alto

| Sombra | Nivel | Carga s | GLB total KB | Vista | Llamadas (cuadro con sombra rehecha) | Llamadas girando (mín–máx) | Triángulos | Texel de sombra cerca (m) | rAF mediana / peor ms | Cuadro con GPU mediana / p95 / peor ms | LOD medio/lejos |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sin | alto | 5,0 | 7.848 | aerea | 329 | 203–205 | 1.294 k | 0,034 | 16,7 / 16,8 | 10,7 / 11,5 / 12,6 | — |
| sin | alto | 5,0 | 7.848 | calle101 | 193 | 67–131 | 535 k | 0,034 | 16,7 / 16,8 | 10,9 / 11,3 / 11,4 | — |
| sin | alto | 5,0 | 7.848 | cuarteles | 164 | 33–37 | 425 k | 0,034 | 16,7 / 16,8 | 11,2 / 12,4 / 12,8 | — |
| actual | alto | 5,1 | 8.077 | aerea | 339 | 202–209 | 1.261 k | 0,034 | 16,7 / 16,8 | 11,1 / 11,8 / 18,6 | 0/22 |
| actual | alto | 5,1 | 8.077 | calle101 | 206 | 69–128 | 511 k | 0,034 | 16,7 / 16,8 | 11,4 / 11,9 / 12,9 | 2/20 |
| actual | alto | 5,1 | 8.077 | cuarteles | 174 | 39–173 | 427 k | 0,034 | 16,7 / 16,8 | 7,6 / 11,3 / 20,9 | 11/11 |
| sunlight | alto | 5,4 | 8.077 | aerea | 359 | 344–352 | 1.291 k | 0,134, 0,468 | 16,7 / 16,8 | 10,7 / 11,5 / 11,7 | 0/22 |
| sunlight | alto | 5,4 | 8.077 | calle101 | 344 | 345–391 | 758 k | 0,134, 0,468 | 16,7 / 16,8 | 11,1 / 11,7 / 12,2 | 2/20 |
| sunlight | alto | 5,4 | 8.077 | cuarteles | 84 | 89–201 | 226 k | 0,134, 0,468 | 16,7 / 16,8 | 11,7 / 12,2 / 12,3 | 11/11 |
| sunlight4096 | alto | 5,7 | 8.077 | aerea | 359 | 344–352 | 1.291 k | 0,067, 0,234 | 16,7 / 16,8 | 10,5 / 10,8 / 10,9 | 0/22 |
| sunlight4096 | alto | 5,7 | 8.077 | calle101 | 344 | 345–391 | 758 k | 0,067, 0,234 | 16,7 / 33,4 | 12,0 / 12,3 / 12,4 | 2/20 |
| sunlight4096 | alto | 5,7 | 8.077 | cuarteles | 84 | 89–201 | 226 k | 0,067, 0,234 | 16,7 / 16,8 | 10,5 / 11,9 / 12,2 | 11/11 |
| csm | alto | 5,6 | 8.077 | aerea | 389 | 356–385 | 1.348 k | 0,065, 0,143, 0,387 | 16,7 / 16,8 | 11,8 / 13,9 / 20,1 | 0/22 |
| csm | alto | 5,6 | 8.077 | calle101 | 303 | 307–427 | 719 k | 0,065, 0,143, 0,387 | 16,7 / 16,8 | 12,3 / 13,3 / 14,3 | 2/20 |
| csm | alto | 5,6 | 8.077 | cuarteles | 73 | 64–83 | 161 k | 0,065, 0,143, 0,387 | 16,7 / 16,8 | 11,2 / 12,5 / 12,7 | 11/11 |
| ajustada | alto | 5,3 | 8.077 | aerea | 363 | 202–209 | 1.270 k | 0,265 | 16,7 / 16,8 | 10,8 / 11,7 / 12,7 | 0/22 |
| ajustada | alto | 5,3 | 8.077 | calle101 | 230 | 69–128 | 519 k | 0,265 | 16,7 / 16,8 | 10,9 / 11,9 / 13,0 | 2/20 |
| ajustada | alto | 5,3 | 8.077 | cuarteles | 198 | 39–197 | 438 k | 0,265 | 16,7 / 16,8 | 11,4 / 13,3 / 14,3 | 11/11 |

#### webgl · alto

| Sombra | Nivel | Carga s | GLB total KB | Vista | Llamadas (cuadro con sombra rehecha) | Llamadas girando (mín–máx) | Triángulos | Texel de sombra cerca (m) | rAF mediana / peor ms | Cuadro con GPU mediana / p95 / peor ms | LOD medio/lejos |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sin | medio | 5,5 | 7.848 | aerea | 308 | 182–184 | 1.294 k | 0,068 | 16,7 / 16,8 | 11,9 / 12,4 / 13,1 | — |
| sin | medio | 5,5 | 7.848 | calle101 | 166 | 33–53 | 493 k | 0,068 | 16,7 / 16,8 | 12,8 / 13,5 / 13,8 | — |
| sin | medio | 5,5 | 7.848 | cuarteles | 143 | 12–16 | 425 k | 0,068 | 16,7 / 16,8 | 12,5 / 13,2 / 13,7 | — |
| actual | medio | 5,5 | 8.077 | aerea | 305 | 179–181 | 1.261 k | 0,068 | 16,7 / 16,8 | 12,8 / 14,2 / 14,6 | 0/22 |
| actual | medio | 5,5 | 8.077 | calle101 | 163 | 30–50 | 465 k | 0,068 | 16,7 / 16,8 | 13,4 / 15,0 / 16,4 | 2/20 |
| actual | medio | 5,5 | 8.077 | cuarteles | 144 | 13–144 | 426 k | 0,068 | 16,7 / 16,8 | 13,4 / 15,3 / 18,1 | 11/11 |
| sunlight | medio | 5,6 | 8.077 | aerea | 320 | 313–315 | 1.291 k | 0,134, 0,468 | 16,7 / 16,8 | 11,9 / 13,1 / 13,9 | 0/22 |
| sunlight | medio | 5,6 | 8.077 | calle101 | 287 | 285–316 | 716 k | 0,134, 0,468 | 16,7 / 16,8 | 11,4 / 11,9 / 12,2 | 2/20 |
| sunlight | medio | 5,6 | 8.077 | cuarteles | 34 | 39–152 | 226 k | 0,134, 0,468 | 16,7 / 16,8 | 13,1 / 14,9 / 15,4 | 11/11 |
| sunlight4096 | medio | 5,9 | 8.077 | aerea | 320 | 313–315 | 1.290 k | 0,067, 0,234 | 16,7 / 16,8 | 13,9 / 15,1 / 15,7 | 0/22 |
| sunlight4096 | medio | 5,9 | 8.077 | calle101 | 296 | 304–361 | 758 k | 0,067, 0,234 | 16,7 / 16,8 | 14,4 / 14,9 / 15,2 | 2/20 |
| sunlight4096 | medio | 5,9 | 8.077 | cuarteles | 34 | 39–152 | 226 k | 0,067, 0,234 | 16,7 / 16,8 | 11,1 / 12,4 / 12,9 | 11/11 |
| csm | medio | 47,3 | 8.077 | aerea | 338 | 315–336 | 1.348 k | 0,065, 0,143, 0,387 | 16,7 / 150,0 | 14,4 / 19,5 / 27,5 | 0/22 |
| csm | medio | 47,3 | 8.077 | calle101 | 214 | 228–294 | 617 k | 0,065, 0,143, 0,387 | 16,7 / 16,8 | 12,1 / 13,1 / 14,2 | 2/20 |
| csm | medio | 47,3 | 8.077 | cuarteles | 17 | 17–33 | 161 k | 0,065, 0,143, 0,387 | 16,7 / 16,8 | 11,7 / 13,5 / 14,3 | 11/11 |
| ajustada | medio | 5,7 | 8.077 | aerea | 309 | 179–181 | 1.270 k | 0,499 | 16,7 / 16,8 | 11,4 / 12,1 / 12,9 | 0/22 |
| ajustada | medio | 5,7 | 8.077 | calle101 | 167 | 30–50 | 479 k | 0,499 | 16,7 / 16,8 | 12,4 / 14,8 / 15,9 | 2/20 |
| ajustada | medio | 5,7 | 8.077 | cuarteles | 148 | 13–148 | 438 k | 0,499 | 16,7 / 16,8 | 12,8 / 14,9 / 15,3 | 11/11 |

#### webgpu · bajo

| Sombra | Nivel | Carga s | GLB total KB | Vista | Llamadas (cuadro con sombra rehecha) | Llamadas girando (mín–máx) | Triángulos | Texel de sombra cerca (m) | rAF mediana / peor ms | Cuadro con GPU mediana / p95 / peor ms | LOD medio/lejos |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sin | bajo | 5,2 | 7.848 | aerea | 316 | 190–192 | 1.294 k | 0,137 | 16,7 / 16,8 | 12,1 / 13,2 / 13,5 | — |
| sin | bajo | 5,2 | 7.848 | calle101 | 174 | 41–61 | 493 k | 0,137 | 16,7 / 16,8 | 12,2 / 14,1 / 15,2 | — |
| sin | bajo | 5,2 | 7.848 | cuarteles | 151 | 20–24 | 425 k | 0,137 | 16,7 / 16,8 | 8,5 / 13,7 / 14,8 | — |
| actual | bajo | 5,4 | 8.077 | aerea | 325 | 189–196 | 1.261 k | 0,137 | 16,7 / 16,8 | 11,0 / 12,1 / 12,8 | 0/22 |
| actual | bajo | 5,4 | 8.077 | calle101 | 188 | 54–65 | 465 k | 0,137 | 16,7 / 16,8 | 12,2 / 13,4 / 14,2 | 2/20 |
| actual | bajo | 5,4 | 8.077 | cuarteles | 160 | 26–159 | 426 k | 0,137 | 16,7 / 16,8 | 8,6 / 14,1 / 15,7 | 11/11 |
| sunlight | bajo | 5,6 | 8.077 | aerea | 346 | 330–338 | 1.291 k | 0,268, 0,936 | 16,7 / 16,8 | 12,6 / 14,1 / 159,0 | 0/22 |
| sunlight | bajo | 5,6 | 8.077 | calle101 | 324 | 321–338 | 716 k | 0,268, 0,936 | 16,7 / 16,8 | 9,1 / 13,4 / 13,9 | 2/20 |
| sunlight | bajo | 5,6 | 8.077 | cuarteles | 71 | 77–188 | 226 k | 0,268, 0,936 | 16,7 / 16,8 | 8,4 / 9,4 / 10,5 | 11/11 |
| sunlight4096 | bajo | 5,3 | 8.077 | aerea | 346 | 331–339 | 1.291 k | 0,268, 0,936 | 16,7 / 16,8 | 11,3 / 12,1 / 12,6 | 0/22 |
| sunlight4096 | bajo | 5,3 | 8.077 | calle101 | 331 | 332–378 | 758 k | 0,268, 0,936 | 16,7 / 16,8 | 11,6 / 12,5 / 12,8 | 2/20 |
| sunlight4096 | bajo | 5,3 | 8.077 | cuarteles | 71 | 77–188 | 226 k | 0,268, 0,936 | 16,7 / 16,8 | 7,5 / 8,5 / 8,9 | 11/11 |
| csm | bajo | 5,5 | 8.077 | aerea | 376 | 342–371 | 1.348 k | 0,065, 0,143, 0,387 | 16,7 / 16,8 | 11,6 / 12,0 / 15,1 | 0/22 |
| csm | bajo | 5,5 | 8.077 | calle101 | 260 | 271–318 | 617 k | 0,065, 0,143, 0,387 | 16,7 / 16,8 | 11,8 / 12,6 / 12,8 | 2/20 |
| csm | bajo | 5,5 | 8.077 | cuarteles | 60 | 50–70 | 161 k | 0,065, 0,143, 0,387 | 16,7 / 16,8 | 11,9 / 13,3 / 13,6 | 11/11 |
| ajustada | bajo | 5,3 | 8.077 | aerea | 350 | 189–196 | 1.270 k | 0,997 | 16,7 / 16,8 | 11,0 / 11,5 / 11,7 | 0/22 |
| ajustada | bajo | 5,3 | 8.077 | calle101 | 213 | 54–65 | 479 k | 0,997 | 16,7 / 16,8 | 12,0 / 13,2 / 13,5 | 2/20 |
| ajustada | bajo | 5,3 | 8.077 | cuarteles | 185 | 26–184 | 438 k | 0,997 | 16,7 / 16,8 | 7,7 / 13,0 / 15,9 | 11/11 |

#### webgpu · movil

| Sombra | Nivel | Carga s | GLB total KB | Vista | Llamadas (cuadro con sombra rehecha) | Llamadas girando (mín–máx) | Triángulos | Texel de sombra cerca (m) | rAF mediana / peor ms | Cuadro con GPU mediana / p95 / peor ms | LOD medio/lejos |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sin | bajo | 5,1 | 6.571 | aerea | 191 | 46–58 | 940 k | 0,068 | 16,7 / 16,8 | 6,8 / 8,6 / 10,1 | — |
| sin | bajo | 5,1 | 6.571 | calle101 | 161 | 32–50 | 765 k | 0,068 | 16,7 / 16,8 | 8,1 / 9,8 / 10,4 | — |
| sin | bajo | 5,1 | 6.571 | cuarteles | 139 | 11–14 | 698 k | 0,068 | 16,7 / 16,8 | 7,0 / 8,4 / 9,0 | — |
| actual | bajo | 5,0 | 6.800 | aerea | 194 | 49–57 | 907 k | 0,068 | 16,7 / 16,8 | 7,4 / 9,0 / 10,0 | 0/22 |
| actual | bajo | 5,0 | 6.800 | calle101 | 170 | 30–47 | 741 k | 0,068 | 16,7 / 16,8 | 7,2 / 9,2 / 9,8 | 2/20 |
| actual | bajo | 5,0 | 6.800 | cuarteles | 148 | 15–144 | 700 k | 0,068 | 16,7 / 16,8 | 6,7 / 8,9 / 11,3 | 11/11 |
| sunlight | bajo | 5,0 | 6.800 | aerea | 215 | 188–197 | 936 k | 0,13, 0,452 | 16,7 / 16,8 | 7,6 / 9,5 / 10,2 | 0/22 |
| sunlight | bajo | 5,0 | 6.800 | calle101 | 309 | 302–318 | 1.260 k | 0,13, 0,452 | 16,7 / 16,8 | 8,2 / 9,9 / 10,3 | 2/20 |
| sunlight | bajo | 5,0 | 6.800 | cuarteles | 107 | 121–173 | 600 k | 0,13, 0,452 | 16,7 / 16,8 | 7,8 / 9,3 / 10,1 | 11/11 |
| sunlight4096 | bajo | 5,1 | 6.800 | aerea | 215 | 188–197 | 936 k | 0,065, 0,226 | 16,7 / 66,7 | 7,5 / 9,6 / 10,8 | 0/22 |
| sunlight4096 | bajo | 5,1 | 6.800 | calle101 | 309 | 302–318 | 1.260 k | 0,065, 0,226 | 16,7 / 16,8 | 10,4 / 11,2 / 12,1 | 2/20 |
| sunlight4096 | bajo | 5,1 | 6.800 | cuarteles | 105 | 121–171 | 599 k | 0,065, 0,226 | 16,7 / 16,8 | 7,5 / 9,6 / 9,9 | 11/11 |
| csm | bajo | 5,2 | 6.800 | aerea | 238 | 198–223 | 989 k | 0,061, 0,134, 0,364 | 16,7 / 16,8 | 7,4 / 8,6 / 9,3 | 0/22 |
| csm | bajo | 5,2 | 6.800 | calle101 | 135 | 151–337 | 680 k | 0,061, 0,134, 0,364 | 16,7 / 16,8 | 8,3 / 10,0 / 10,4 | 2/20 |
| csm | bajo | 5,2 | 6.800 | cuarteles | 49 | 36–54 | 161 k | 0,061, 0,134, 0,364 | 16,7 / 16,8 | 7,7 / 9,4 / 10,1 | 11/11 |
| ajustada | bajo | 5,1 | 6.800 | aerea | 218 | 49–57 | 915 k | 0,53 | 16,7 / 16,8 | 7,8 / 9,3 / 9,9 | 0/22 |
| ajustada | bajo | 5,1 | 6.800 | calle101 | 194 | 30–47 | 749 k | 0,53 | 16,7 / 16,8 | 7,5 / 9,1 / 9,8 | 2/20 |
| ajustada | bajo | 5,1 | 6.800 | cuarteles | 172 | 15–168 | 711 k | 0,53 | 16,7 / 16,8 | 7,1 / 8,3 / 9,2 | 11/11 |

#### webgl · movil

| Sombra | Nivel | Carga s | GLB total KB | Vista | Llamadas (cuadro con sombra rehecha) | Llamadas girando (mín–máx) | Triángulos | Texel de sombra cerca (m) | rAF mediana / peor ms | Cuadro con GPU mediana / p95 / peor ms | LOD medio/lejos |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sin | bajo | 5,0 | 6.571 | aerea | 191 | 46–58 | 940 k | 0,068 | 16,7 / 16,8 | 8,0 / 10,3 / 11,5 | — |
| sin | bajo | 5,0 | 6.571 | calle101 | 162 | 32–50 | 766 k | 0,068 | 16,7 / 16,8 | 8,0 / 9,7 / 10,3 | — |
| sin | bajo | 5,0 | 6.571 | cuarteles | 139 | 11–14 | 698 k | 0,068 | 16,7 / 16,8 | 5,3 / 6,0 / 6,3 | — |
| actual | bajo | 4,9 | 6.800 | aerea | 188 | 48–55 | 907 k | 0,068 | 16,7 / 16,8 | 8,6 / 10,4 / 10,9 | 0/22 |
| actual | bajo | 4,9 | 6.800 | calle101 | 159 | 29–47 | 738 k | 0,068 | 16,7 / 16,8 | 8,9 / 10,9 / 11,5 | 2/20 |
| actual | bajo | 4,9 | 6.800 | cuarteles | 140 | 12–140 | 699 k | 0,068 | 16,7 / 16,8 | 7,0 / 8,8 / 12,1 | 11/11 |
| sunlight | bajo | 5,0 | 6.800 | aerea | 203 | 179–187 | 936 k | 0,13, 0,452 | 16,7 / 16,8 | 10,0 / 12,3 / 13,2 | 0/22 |
| sunlight | bajo | 5,0 | 6.800 | calle101 | 234 | 265–302 | 1.207 k | 0,13, 0,452 | 16,7 / 16,8 | 10,7 / 12,8 / 13,7 | 2/20 |
| sunlight | bajo | 5,0 | 6.800 | cuarteles | 79 | 93–145 | 600 k | 0,13, 0,452 | 16,7 / 16,8 | 8,1 / 10,3 / 10,7 | 11/11 |
| sunlight4096 | bajo | 5,1 | 6.800 | aerea | 203 | 179–188 | 936 k | 0,065, 0,226 | 16,7 / 16,8 | 10,7 / 13,6 / 14,0 | 0/22 |
| sunlight4096 | bajo | 5,1 | 6.800 | calle101 | 279 | 278–307 | 1.260 k | 0,065, 0,226 | 16,7 / 16,8 | 11,4 / 14,4 / 14,9 | 2/20 |
| sunlight4096 | bajo | 5,1 | 6.800 | cuarteles | 77 | 93–145 | 599 k | 0,065, 0,226 | 16,7 / 16,8 | 8,7 / 11,3 / 12,3 | 11/11 |
| csm | bajo | 23,4 | 6.800 | aerea | 218 | 183–214 | 989 k | 0,061, 0,134, 0,364 | 16,7 / 2.099,9 | 9,1 / 11,5 / 12,0 | 0/22 |
| csm | bajo | 23,4 | 6.800 | calle101 | 101 | 99–275 | 675 k | 0,061, 0,134, 0,364 | 16,7 / 16,8 | 10,9 / 12,1 / 12,8 | 2/20 |
| csm | bajo | 23,4 | 6.800 | cuarteles | 16 | 15–28 | 161 k | 0,061, 0,134, 0,364 | 16,7 / 16,8 | 8,3 / 10,1 / 10,6 | 11/11 |
| ajustada | bajo | 5,0 | 6.800 | aerea | 192 | 48–55 | 916 k | 0,499 | 16,7 / 16,8 | 8,7 / 11,0 / 11,2 | 0/22 |
| ajustada | bajo | 5,0 | 6.800 | calle101 | 163 | 29–47 | 751 k | 0,499 | 16,7 / 16,8 | 9,6 / 11,5 / 12,1 | 2/20 |
| ajustada | bajo | 5,0 | 6.800 | cuarteles | 144 | 12–144 | 711 k | 0,499 | 16,7 / 16,8 | 7,8 / 9,5 / 10,2 | 11/11 |

Lectura de la tabla:

- **El kit.** Con la sombra de siempre, la vista aérea pasa de 329 a 339 llamadas y los triángulos bajan de 1.294 mil a 1.261 mil (los 22 cuarteles lejanos pesan menos que las cajas grises y la copia del 106 que reemplazan). El GLB suma 229 KB (7.848 → 8.077 KB de modelo bajado en escritorio). El cuadro con GPU no cambia más que el ruido. En la mediana ningún perfil pasa de 14,4 ms en esta máquina (90 vistas medidas; la más alta es `csm` con WebGL 2 en la aérea); el peor cuadro sí pasa de 16,7 ms en 6 vistas (hasta 159 ms con `sunlight` en `bajo`, aérea) y el p95, en una (`csm` con WebGL 2, aérea, 19,5 ms).
- **Las cascadas rehacen la sombra en cada cuadro**: al girar, `sunlight` y `csm` dibujan de 300 a 430 llamadas en la calle, contra 70 a 130 con `actual`. Es el costo que se pagaría en un teléfono.
- **CSM con WebGL 2 tarda en arrancar**: 47 s de carga (`alto`) y 23 s (`movil`), y en la primera vista aérea un cuadro de 150 ms y otro de 2.100 ms (compilación de sombreadores). En WebGPU carga en 5,6 s.
- `ajustada` estira un solo mapa sobre 1,5 km: texel de 0,27 m (4.096 px), 0,50 m (2.048) y 1 m (1.024).
- La carga sin ventana se trabó a veces sin crear la escena (WebGPU sin adaptador durante minutos), con o sin bandera. `ciudad-medir.mjs` recarga hasta 3 veces; en la matriz final no hizo falta, pero una corrida (ajustada, bajo) se repitió por eso.

## Sombras: la comprobación 2 decide

`node verificar.mjs --solo=2,7 --url=ciudad=espiga&sombra=<opción>` (opción nueva de `verificar.mjs`; informe aparte en `fuente/verificacion/url-…/`). Criterio de la comprobación 2: error ≤ máx(8 cm, 10 % de la profundidad de la sombra) contra el borde trazado con rayos.

| Opción | Texel junto al 106 | Comprobación 2 (8 casos) | Peor error | Comprobación 7 |
|---|---|---|---|---|
| actual (con la bandera) | 3,4 cm | PASA 8 de 8 | −6,6 cm | PASA |
| sunlight, 2.048 px por cascada | 13,4 cm | FALLA (6 pasan, 2 fallan) | −12,6 cm | PASA |
| **sunlight, 4.096 px por cascada** | 6,7 cm | **PASA 8 de 8** | −8,5 cm | PASA |
| csm, 2.048 px | 6,5 cm | FALLA 8 de 8 | −26,6 cm | PASA |
| csm, 4.096 px | ~3,3 cm | FALLA (4 pasan, 4 fallan) | −12,0 cm | no se corrió |
| ajustada, 4.096 px | 26,5 cm | FALLA (7 fallan, 1 no medible) | −23,0 cm | PASA (cociente 1,35 en la NE, umbral 2,97) |

Sin bandera, `verificar.mjs` completo: las 7 comprobaciones PASAN (WebGPU).

**`SunLight` con 4.096 px por cascada es la opción que se elige**: la única de las tres nuevas que no empeora la sombra del 106 según la comprobación 2, y además es la que da sombra en toda la ciudad (con `actual`, el 101, a 128 m, queda sin ninguna sombra porque cae fuera de la caja de ±70 m). CSM falla aun con mapas del doble; parece cosa de su sesgo (multiplica el sesgo por el número de cascada y lo aplica sobre un rango de profundidad mayor), no de resolución: con texeles parecidos a los de `actual` sigue errando unos 12 cm. No lo investigué más. La ajustada tiene texeles de un cuarto de metro: sirve para la vista aérea, no para los aleros.

El precio de la ganadora: un atlas de 8.192 × 4.096 (unos 128 MB de profundidad en 32 bits) que se rehace en cada cuadro que la cámara se mueve, y de 300 a 390 llamadas al girar en la calle. En escritorio midió lo mismo que `actual` dentro del ruido. **En un teléfono no está medido** y ese atlas no es razonable ahí: para el teléfono la opción a probar es `sunlight` con 2.048 (falla por poco: −8,1 y −12,6 cm) o una sombra doble, la de siempre para el 106 y otra gruesa para la ciudad.

## Problemas que aparecieron

1. `COLOR_0` llega en uint8 normalizado con paso de 4 bytes (meshopt): leerlo con `.array` daba colores de arcoíris. Se lee con `getComponent`.
2. Con un esqueleto ingenuo, dos lados casi paralelos (la huella de OSM del 101 tiene 1 cm de diferencia) daban velocidades enormes; lados a menos de 2,6° se tratan como cumbrera.
3. Los cabios en caja recta atravesaban la teja cerca del borde: ahora siguen la pendiente del sofito.
4. El héroe y el `BatchedMesh` usan dos instancias del mismo material. Se separaron por precaución mientras buscaba por qué no se veía la sombra del alero sobre el muro del héroe; no comprobé que con un solo material fallara.
5. A ojo no distingo la franja de sombra del alero sobre el muro, ni en el 106 ni en el héroe; para el 106 la comprobación 2 mide que está y dónde. **Para el héroe no hay ninguna comprobación**: falta llevar la comprobación 2 al 101.
6. Con `ajustada`, los techos de teja de las copias reducidas del 106 muestran acné de sombra (texel de 27 cm sobre tejas modeladas).
7. `estado.mjs --comprobar` marca `modelo/cubiertas_movil.glb` como «nuevo»: ya faltaba en la foto de `fuente/estado/` antes de esta rama (el guardia lo da idéntico a main). No lo toqué.
8. La matriz completa (30 corridas: 6 sombras por 5 perfiles) se rehízo una vez entera porque la primera medía el cuadro con un método que no esperaba a la GPU (0,6 ms de mediana, imposible); esos números se descartaron.

## Pruebas del sitio

- `node estado.mjs --comprobar`: todos los GLB idénticos a la foto salvo `ciudad_espiga.glb` (nuevo, esperado) y `cubiertas_movil.glb` (ver el punto 7). Pórtico idéntico.
- `node guardia.mjs` (sin bandera, WebGPU): el modelo de main idéntico byte a byte; **18 de 18 cuadros iguales** (17 con 0 píxeles distintos, `lente-lluvia` con 2 píxeles, dentro de la tolerancia de 10). Sale con «HAY CAMBIOS» solo por el GLB nuevo y porque `js/app.js` e `index.html` están recompilados. Esto prueba que sin la bandera lo publicado no cambia. No se corrió con `--webgl`.
- `node verificar.mjs` sin bandera: 7 de 7 PASAN. Con bandera, las comprobaciones 2 y 7 de cada opción, en la tabla de arriba.
- Detalle: la última corrección (árboles del CHM y su escala de copa) se hizo después del guardia y del verificador; solo toca código que corre con la bandera, pero el guardia no se volvió a correr sobre ese `js/app.js`.

## Recomendación: seguir con el kit, con condiciones

**Seguir con el kit.** Medidas trazables al 106 de main, una llamada por edificio, 22 cuarteles en un lote con LOD por instancia, 229 KB y ningún cambio medible en el tiempo de cuadro de escritorio. Que escalar a los 322 edificios fuera barato en geometría era una predicción de la espiga; la fase 3 lo midió después: con WebGL 2 y la ciudad entera, la mediana del cuadro con GPU va de 16,5 a 22,1 ms según la vista en esta máquina (`../fase3/medidas/defecto-webgl-alto.json`).

**Condiciones antes de la fase 3:**

1. Medir en el celular de LM (y uno de nivel bajo) con `sombra=actual` y `sombra=sunlight&sombramapa=4096` y `2048`: el Mac no dice nada del teléfono.
2. La sombra: `SunLight` a 4.096 en escritorio con WebGPU; para WebGL 2 y el teléfono, decidir entre la sombra doble y aceptar el error de 2.048. CSM y la ajustada quedan descartadas por la comprobación 2.
3. Llevar la comprobación 2 al 101 (el héroe) antes de dar por buena su sombra.
4. LM juzga las capturas. Los cuarteles de prueba no se publican: son conjetura.

## Capturas para LM

En `docs/ciudad/espiga/capturas/` (PNG con paleta). Nombre: `<sombra>-webgpu-<perfil>-<vista>.png`, con sombra `sin` (lo publicado), `actual`, `sunlight`, `sunlight4096`, `csm` y `ajustada`; perfil `alto` (1440 × 900) y `movil` (390 × 844); vista `aerea`, `calle101` y `cuarteles`. Son 36. Para comparar sombras, abrir en fila las `calle101` de un mismo perfil. Las capturas se toman sin profundidad de campo.

## Abrirlo en el teléfono

En la Mac, con el teléfono en la misma red:

```
cd ~/projects/edificio-106-ciudad && python3 -m http.server 8106 --bind 0.0.0.0
```

(`python3 -m http.server` sirve los `.bin.gz` como `application/gzip` sin `Content-Encoding`, como pide la app; comprobado. No probé `vite preview --host --outDir ..`.) Direcciones, con la IP de hoy de la Mac (192.168.0.3):

- lo publicado: `http://192.168.0.3:8106/`
- espiga con la sombra de siempre: `http://192.168.0.3:8106/?ciudad=espiga`
- `http://192.168.0.3:8106/?ciudad=espiga&sombra=sunlight` y `…&sombra=sunlight&sombramapa=4096`
- `http://192.168.0.3:8106/?ciudad=espiga&sombra=csm` · `…&sombra=ajustada`
- colores por parte: `…?ciudad=espiga&partes`
- un momento fijo: agregar `#m-20240115-0930`

Ojo: por `http://` a una IP, el teléfono no es un «contexto seguro» y **no ofrece WebGPU**: verás WebGL 2. Para WebGPU en el teléfono hace falta HTTPS.

## Archivos

- `fuente/ciudad-kit.mjs`, `fuente/src/ciudad.js`, `fuente/ciudad-medir.mjs`
- `fuente/src/escena.js` (bandera, opciones de sombra, filtro del contexto, LOD), `fuente/verificar.mjs` (opción `--url=`)
- `modelo/ciudad_espiga.glb`, `js/app.js`, `index.html` (recompilados)
- `docs/ciudad/espiga/kit-medidas.json`, `medidas/*.json`, `capturas/*.png`
