# La ciudad alrededor del 106

Resumen de cómo se arma la maqueta de Ciudad del Saber (el antiguo Fort Clayton) que el visor dibuja alrededor del Edificio 106: qué es, de dónde sale cada dato, qué se supone y cómo se rehace. Datos al 5 de octubre de 2026; las cifras de cada edificio están en `edificios.json`, que se regenera con el modelo.

## Qué es

Es una maqueta aproximada: el 106 sigue siendo el único edificio medido y modelado con detalle, y los demás se arman con un kit de piezas que reutiliza las medidas del 106 de `main` (teja, mediaguas, ménsulas, ventanas; `espiga/kit-medidas.json`) y los parámetros de cada tipología. El modelo está en `modelo/ciudad.glb` (detalle medio y lejano) y `modelo/ciudad_alto.glb` (detalle alto, a menos de 150 m del edificio; 100 m en casas, dúplex y casas de oficiales).

El inventario tiene 322 edificios de OpenStreetMap: 321 dentro del límite propuesto (`limite-propuesto.geojson`, que no es el límite oficial de la Fundación; las calles Hill y Parke entran por decisión de LM del 4 de octubre de 2026) y 1 de fondo.

| Cómo se dibuja | Edificios |
|---|---:|
| Kit de piezas | 228 |
| Caja gris de `contexto.glb` (sin tipología del kit o con una forma que el kit no arma) | 85 |
| Volumen a mano de `contexto.mjs` (Fundación, La Casa, Innova, Teatro Ateneo) | 4 |
| Copia reducida del 106 (103, 105 y 107) | 3 |
| El 106 (modelo propio) | 1 |
| Mitad de un edificio que dibuja la otra (332B, con el 332A) | 1 |

Por tipología, el kit arma 38 dúplex y 18 casas de oficiales de un tipo que CERL da como construido de 1939 a 1943 en el istmo (p. 5-7; en Clayton, el primer grupo se terminó a inicios de 1942, p. 5-6), 31 pabellones de un piso, 28 casas NCO de 1949, 17 cuarteles de cuatro niveles, 6 de tres pisos, 16 bloques de la calle Gonzalo Crance, 6 de la calle Luis Bonilla, 16 naves, 14 casas elevadas de la calle Aroldo Cano (Colonels' Row), 13 kioscos o galeras, 13 casas del área 900, 8 edificios contemporáneos y 4 torres. Además dibuja 54 de los 57 estacionamientos de OSM con el asfalto de las calles (el 1281824089 se quita: en la vista aérea es la calzada de una calle, no un estacionamiento; los dos que tocan el sitio del 106 ya los dibuja `contexto.mjs`) y, sobre 65 de las 85 cajas grises, una tapa plana con el color del techo observado en Street View; las otras 20 quedan grises porque no hay color de techo con confianza alta o media.

## De dónde sale cada dato

* **Huellas:** OpenStreetMap, base del 1 de octubre de 2026 (© colaboradores de OpenStreetMap, ODbL 1.0), las mismas que usa `contexto.mjs`. En los dúplex, las casas de oficiales y Colonels' Row la planta es la de CERL centrada en la huella de OSM, porque OSM dibuja el borde del techo.
* **Alturas:** Google Open Buildings 2.5D Temporal v1, 2023 (CC BY 4.0), estimadas desde satélite. Sirven para comprobar las alturas de piso y, en los contemporáneos, las torres y las naves altas, para dar la altura.
* **Tipologías y medidas por tipo:** Enscore et al. (2000), *Guarding the Gates: The Story of Fort Clayton*, ERDC/CERL, DTIC ADA388262 (distribución sin límite), con cada página en `tipologias-cerl.md`. Ejemplos: los cuarteles de 1936 a 1941 miden 61 ft de ancho y 121, 141 o 201 ft de largo (p. 4-6 a 4-11); los dúplex, 24 × 44 ft (p. 5-8); las casas de oficiales, 26,5 × 58 y 28 × 44 ft (p. 5-9).
* **Lo observado:** Street View de Google, solo como observación (`fuente/ciudad-observado.json`): pisos, forma, material y color del techo, color de los muros, mediaguas, ventanas y escaleras, cada campo con su confianza y la fecha de la imagen. En el repositorio no hay imágenes, identificadores ni posiciones de Google, y nada se calcó sobre ellas.
* **Lecturas en foto:** algunas medidas (alturas, pendientes, anchos de piezas y el color de la teja de Colonels' Row) se leyeron en fotos de Street View con una escala conocida, como los pies de CERL o una puerta estándar. Son lecturas aproximadas, a medir en sitio: los textos de `edificios.json` lo dicen y las redondean. Por ejemplo, del suelo al sofito de un dúplex hay unos 9 m (el modelo usa 8,8 m, ±0,3 m) y la planta baja de servicio de los cuarteles de cuatro niveles mide unos 3 m (el modelo usa 3,2 m, ±0,4 m).
* **Vista aérea:** Esri World Imagery, solo mirada (limatesas, forma de las huellas).
* **Conocimiento del sitio de LM**, con su fecha: los dúplex son a cuatro aguas, la planta baja del dúplex tiene un cuarto al centro y un estacionamiento a cada lado, Canal View A tiene 8 pisos.
* **Correcciones a mano** por edificio, cada una con su razón: `fuente/ciudad-ajustes.json`.
* **Mediaguas de los cuarteles de cuatro niveles:** CERL (p. 6-14, PDF 158) dice que en 1987 la teja de las mediaguas de todos los cuarteles del área 200 se cambió por tejas de fibra de vidrio rojas, y en Street View se ven como bandas rojas anchas con el sofito oscuro. Esos 17 cuarteles llevan la pieza de la mediagua del dúplex (frente de teja de 0,35 m, SUPUESTO en ellos, y cabios bajo un tablero cerrado); el 106 y los cuarteles de tres pisos siguen con las piezas del 106.

## Clases de certeza

Cada edificio lleva una clase según lo que se pudo observar:

* **I** (156 edificios): pisos, forma y material del techo, muros y mediaguas observados con confianza alta o media.
* **II** (140): la tipología es clara, pero algunos de esos campos no se ven o la vista deja dudas (de quién es la foto, de lejos, tras una cerca o a contraluz).
* **III** (26): casi nada se ve o es conjetura.

La clase cuenta qué tan bien se vio el edificio en las fotos; también en los de clase I hay pendientes, alturas de piso, posiciones de ventanas y tintes SUPUESTOS. En el kit van 114 de clase I, 110 de clase II y 4 de clase III; fuera del kit, 42, 30 y 22.

## Lo que se supone

Cada parámetro de `edificios.json` dice si es SUPUESTO. Los principales:

* las pendientes que ninguna vista deja medir: 12° en pabellones, casas NCO y bloques de Gonzalo Crance, 10° en el área 900, 14° en naves y bloques de Luis Bonilla, y la del hastial de las casas de oficiales, tomada igual a la del dúplex (20 ± 3°, acotada en fotos);
* las alturas de piso de los bloques de dos pisos (3,0 y 2,9 m), comprobadas contra Open Buildings;
* cuántas ventanas y puertas hay y dónde, en las caras que no se ven;
* qué extremo tiene la cochera o la escalera cuando no se ve;
* los colores: un tinte sobre el material del 106 por la palabra observada («crema», «amarillo»), no un color medido.

Decisiones que siguen abiertas y están dichas en su ajuste: el 220 sale con dos pisos (Street View y Open Buildings) aunque CERL da un cuartel de tres pisos terminado en diciembre de 1941, así que puede haber perdido un piso o ser otro edificio; el 104 sigue con el volumen a mano porque su huella compuesta no se puede partir sin verla.

## Lo que no hace

* No mide nada en sitio: todo lo que dice «a medir en sitio» espera el recorrido a pie.
* Las lentes (Sol en fachadas, lluvia, viento) no se aplican a la ciudad, y la ciudad no tiene interiores.
* El terreno es la rejilla de 40 m de `contexto.mjs`: no tiene el talud del 220 ni las terrazas de las casas NCO.
* La numeración del Ejército en CERL no es la de Ciudad del Saber. Donde un número coincide se dice; donde no, el tipo se asigna por la forma y el tamaño (por ejemplo, las casas de oficiales de compañía y de campo por el largo de la huella).

## Cómo se rehace

```
cd fuente
node inventario-ciudad.mjs     # docs/ciudad/inventario.json, inventario.md y limite-propuesto.geojson
node ciudad.mjs                # modelo/ciudad.glb, modelo/ciudad_alto.glb y docs/ciudad/edificios.json
node ciudad.mjs --huellas=<archivo.json>   # además, la huella de cada parte de cada edificio para comparar dos corridas
```

Los dos son deterministas. `fuente/ciudad-observado.json` sale de un inventario de trabajo que queda fuera del repositorio; para corregir un edificio se usa `fuente/ciudad-ajustes.json`, que se aplica al final y sobrevive a cualquier regeneración. Antes de publicar un cambio: `node estado.mjs --comprobar`, `node guardia.mjs` y `node verificar.mjs` (ver el CLAUDE.md del repositorio).

Las mediciones de rendimiento están en `fase3/medidas/` y `espiga/` (`INFORME.md` y `medidas/`), y las capturas del visor, sin imágenes de Google, en `fase3/capturas/` y `espiga/capturas/`.
