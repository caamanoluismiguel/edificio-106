# Inventario de edificios de Ciudad del Saber

Generado por `fuente/inventario-ciudad.mjs` (no editar a mano: se rehace con `cd fuente && node inventario-ciudad.mjs`). Datos completos por edificio en `inventario.json`. OpenStreetMap con base del 2026-10-01 (© colaboradores de OpenStreetMap, ODbL 1.0); alturas de Google Open Buildings 2.5D Temporal v1, 2023 (CC BY 4.0), estimadas desde satélite.

## El límite usado

OpenStreetMap no tiene un polígono de Ciudad del Saber (consulta a Overpass del 4 de octubre de 2026). El límite de `limite-propuesto.geojson` es una **propuesta** trazada sobre las calles: la Avenida Omar Torrijos Herrera al suroeste, la Calle Aroldo Cano Arosemena y el grupo de los 400 (Calle McIntosh, Calle Smith) al este, el norte de los edificios 248A y 389, y la Calle Johnston al sur. No es el límite oficial de la Fundación.

El grupo de casas de la Calle Hill y la Calle Parke, al otro lado de la Calle Aroldo Cano Arosemena, queda fuera del polígono pero **entra** (30 edificios, marcados «dentro (Hill/Parke)»): lo decidió LM el 4 de octubre de 2026. Los demás de fuera que parecen de Ciudad del Saber (`addr:city` «Ciudad del Saber» o un número de tres cifras) van como **fondo**: siguen como caja de fondo, sin tipología del kit (hoy solo Clayton Plaza).

## Resumen

- **Total: 322 edificios** (321 dentro, de ellos 30 de las calles Hill y Parke, y 1 de fondo).
- **Con número de Ciudad del Saber: 204** (204 dentro); sin número: 118. El número sale de `addr:housenumber` (204), `ref` (0) o del nombre (0).
- Números repetidos en OSM: 246 (3 huellas), 140 (2 huellas).
- Con registro de Open Buildings: 322 (con altura p90 mayor que 0: 319); con al menos 60 % de la huella cubierta: 263. Con `building:levels` en OSM: 50. Con alguna etiqueta de techo (`roof:*`): 4; con `height`: 0.
- Parecidos en planta al cuartel de CERL (61 × 141 ft = 18,6 × 43,0 m, ±20 % de largo y ±30 % de ancho, marcados con ★): 29.

| Tamaño | Dentro | Fondo | Total |
|---|---:|---:|---:|
| XS (<100 m²) | 16 | 0 | 16 |
| S (100–300 m²) | 96 | 0 | 96 |
| M (300–1.000 m²) | 173 | 1 | 174 |
| L (1.000–3.000 m²) | 35 | 0 | 35 |
| XL (≥3.000 m²) | 1 | 0 | 1 |

| Modelado en main (contexto.mjs) | Dentro | Fondo | Total |
|---|---:|---:|---:|
| maqueta | 310 | 1 | 311 |
| cuartel106 | 6 | 0 | 6 |
| a mano | 4 | 0 | 4 |
| el 106 (modelo propio) | 1 | 0 | 1 |

| Tipología (conjetura por forma) | Dentro | Fondo | Total |
|---|---:|---:|---:|
| bloque rectangular mediano | 157 | 0 | 157 |
| casa o pabellón pequeño | 67 | 0 | 67 |
| bloque estrecho y alargado (tira de viviendas o pabellón) | 41 | 0 | 41 |
| barraca alargada tipo cuartel (como el 106) | 31 | 0 | 31 |
| forma compuesta (L, T, U o con patio) | 14 | 1 | 15 |
| caseta o estructura menor | 10 | 0 | 10 |
| nave o edificio grande | 1 | 0 | 1 |

Qué significa cada «modelado en main» (`contexto.mjs`, el visor sin la ciudad; lo que dibuja la ciudad, edificio por edificio, está en `edificios.json`): **cuartel106** es la copia reducida del 106 puesta en la huella (105, 102, 103, 101, 100, 107); **a mano** son los volúmenes propios (Fundación, La Casa, Innova, Teatro Ateneo); **maqueta** es un volumen gris de techo plano con la altura de sus niveles de OSM (3,65 m por nivel + 0,65 m), de Open Buildings p90 si cubre el 60 % de la huella, o de 2 niveles sin dato. La estructura pequeña del cuadrángulo y los estacionamientos no están en OSM y no aparecen aquí.

La tipología es una **conjetura por forma**: sale solo del rectángulo orientado de la huella de OSM, nunca de una foto. La referencia del cuartel es Enscore et al. (2000), *Guarding the Gates: The Story of Fort Clayton*, ERDC/CERL, DTIC ADA388262, PDF p. 96: los cuarteles del cuadrángulo «measured 61 x 141 ft» y «this basic design was adopted for all barracks subsequently built at Fort Clayton». La numeración del Ejército en ese informe no es la de Ciudad del Saber.

Columnas: «Caja» es el rectángulo orientado de área mínima (largo × ancho); «Rumbo», el del eje largo desde el norte (0 a 180°; el 106 está a 56°); «A 106», la distancia de huella a huella hasta el 106 del modelo.

## Edificios con número (204), por número

| N.º | Nombre | Límite | Área m² | Caja m | Rumbo | Niveles OSM | OB p90 m (cubre) | Modelado en main | Tipología (conjetura por forma) | A 106 m | OSM |
|---|---|---|---:|---|---:|---:|---|---|---|---:|---|
| 100 |  | dentro | 1.478 | 62,7 × 23,6 | 143° |  | 13,0 (95 %) | cuartel106 | barraca alargada tipo cuartel (como el 106) | 128 | 678917549 |
| 101 |  | dentro | 939 | 50,2 × 18,7 | 55° |  | 14,5 (89 %) | cuartel106 | barraca alargada tipo cuartel (como el 106) ★ | 128 | 386353666 |
| 102 | UNICEF Regional Office | dentro | 1.091 | 46,6 × 23,4 | 55° | 3 | 12,0 (94 %) | cuartel106 | barraca alargada tipo cuartel (como el 106) ★ | 116 | 183921947 |
| 103 | UNOPS and UNEP Regional Offices | dentro | 1.083 | 47,4 × 22,8 | 54° | 3 | 13,0 (95 %) | cuartel106 | barraca alargada tipo cuartel (como el 106) ★ | 117 | 242667845 |
| 104 | Ciudad del Saber | dentro | 4.699 | 159,2 × 41,9 | 144° | 3 | 13,5 (91 %) | a mano | forma compuesta (L, T, U o con patio) | 87 | 300885892 |
| 105 |  | dentro | 1.041 | 46,3 × 22,5 | 55° | 3 | 14,0 (100 %) | cuartel106 | barraca alargada tipo cuartel (como el 106) ★ | 20 | 300885890 |
| 106 |  | dentro | 1.040 | 46,0 × 22,6 | 55° | 3 | 14,0 (98 %) | el 106 (modelo propio) | barraca alargada tipo cuartel (como el 106) ★ | 0 | 300885891 |
| 107 | Balboa Academy | dentro | 1.089 | 47,6 × 22,9 | 54° | 3 | 11,0 (94 %) | cuartel106 | barraca alargada tipo cuartel (como el 106) ★ | 48 | 387400206 |
| 108 |  | dentro | 1.025 | 39,3 × 26,3 | 54° |  | 7,5 (89 %) | a mano | bloque rectangular mediano | 19 | 300885896 |
| 109 |  | dentro | 1.273 | 49,6 × 43,7 | 53° |  | 10,0 (73 %) | a mano | forma compuesta (L, T, U o con patio) | 83 | 300885897 |
| 110 |  | dentro | 381 | 26,1 × 14,6 | 143° |  | 11,0 (83 %) | maqueta | bloque rectangular mediano | 157 | 354960990 |
| 111 | Cathalac | dentro | 332 | 24,7 × 13,4 | 143° |  | 11,5 (87 %) | maqueta | bloque rectangular mediano | 168 | 354960991 |
| 112 |  | dentro | 292 | 26,3 × 11,1 | 146° |  | 9,5 (71 %) | maqueta | bloque rectangular mediano | 186 | 354960992 |
| 113 |  | dentro | 292 | 26,3 × 11,1 | 146° |  | 9,5 (75 %) | maqueta | bloque rectangular mediano | 208 | 678917552 |
| 114 |  | dentro | 292 | 26,3 × 11,1 | 146° |  | 7,0 (79 %) | maqueta | bloque rectangular mediano | 234 | 678917551 |
| 115 | IOM R4V | dentro | 584 | 38,0 × 15,4 | 143° |  | 5,5 (46 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 192 | 387400205 |
| 116 | Louis Berger Group LAC | dentro | 428 | 29,8 × 14,4 | 147° |  | 9,0 (58 %) | maqueta | bloque rectangular mediano | 259 | 387424352 |
| 117 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 6,0 (67 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 242 | 443410728 |
| 118 | Esri Panamá | dentro | 460 | 36,7 × 12,5 | 146° | 1 | 10,5 (59 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 292 | 443410760 |
| 119 |  | dentro | 460 | 36,7 × 12,5 | 146° | 1 | 6,0 (76 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 288 | 443410725 |
| 120 |  | dentro | 393 | 31,4 × 12,5 | 146° | 1 | 5,5 (83 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 328 | 443410762 |
| 121 |  | dentro | 460 | 36,7 × 12,5 | 146° | 1 | 5,5 (75 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 332 | 443410722 |
| 122 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 6,0 (63 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 367 | 443410766 |
| 123 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 5,5 (58 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 373 | 387400204 |
| 124 | Programa Mundial de Alimentos | dentro | 274 | 22,9 × 12,0 | 142° |  | 7,5 (95 %) | maqueta | bloque rectangular mediano | 411 | 678917553 |
| 125 | Programa Mundial de Alimentos | dentro | 365 | 29,3 × 12,5 | 143° |  | 7,5 (69 %) | maqueta | bloque rectangular mediano | 440 | 387424351 |
| 128 | Casa de Las Naciones Unidas | dentro | 1.148 | 49,2 × 23,6 | 69° |  | 13,5 (78 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 447 | 353913256 |
| 129 | UNDSS HQ | dentro | 1.137 | 49,0 × 23,3 | 68° |  | 14,5 (69 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 454 | 353913255 |
| 130 | Isaac Rabin School | dentro | 1.153 | 46,6 × 24,7 | 69° |  | 14,0 (82 %) | maqueta | barraca alargada tipo cuartel (como el 106) | 468 | 353913251 |
| 131 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 5,5 (60 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 379 | 443410742 |
| 132 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 6,0 (84 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 368 | 443410758 |
| 133 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 5,5 (39 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 337 | 443410740 |
| 134 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 6,5 (60 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 325 | 443410754 |
| 135 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 5,0 (37 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 295 | 443410738 |
| 136 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 6,5 (36 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 281 | 443410752 |
| 137 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 6,0 (41 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 251 | 443410734 |
| 138 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 6,0 (53 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 234 | 443410748 |
| 139 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 5,5 (68 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 211 | 443410732 |
| 140 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 5,0 (63 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 191 | 443410746 |
| 140 |  | dentro | 460 | 36,7 × 12,5 | 161° |  | 5,0 (80 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 135 | 1387876288 |
| 141 |  | dentro | 569 | 39,2 × 17,7 | 145° |  | 5,5 (50 %) | maqueta | bloque rectangular mediano | 391 | 387400203 |
| 143 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 9,5 (57 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 352 | 443410780 |
| 144 |  | dentro | 460 | 36,7 × 12,5 | 54° |  | 6,0 (52 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 390 | 443410783 |
| 145 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 6,5 (67 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 311 | 443410777 |
| 146 |  | dentro | 460 | 36,7 × 12,5 | 55° |  | 13,0 (57 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 354 | 678806131 |
| 147 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 6,5 (65 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 268 | 443410774 |
| 148 |  | dentro | 460 | 36,7 × 12,5 | 55° |  | 0,0 (0 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 318 | 678806130 |
| 149 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 5,0 (67 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 225 | 443410772 |
| 150 |  | dentro | 460 | 36,7 × 12,5 | 55° |  | 4,5 (60 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 283 | 608482544 |
| 151 |  | dentro | 460 | 36,7 × 12,5 | 146° |  | 11,5 (44 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 180 | 443410768 |
| 152 |  | dentro | 460 | 36,7 × 12,5 | 55° |  | 5,5 (62 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 248 | 608482545 |
| 154 |  | dentro | 460 | 36,7 × 12,5 | 55° |  | 7,0 (55 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 213 | 608482546 |
| 155 |  | dentro | 460 | 36,7 × 12,5 | 37° |  | 5,5 (80 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 169 | 608482547 |
| 157-158 | Dormitorios | dentro | 2.054 | 108,4 × 29,4 | 145° | 3 | 10,5 (82 %) | maqueta | forma compuesta (L, T, U o con patio) | 197 | 1203393924 |
| 159 |  | dentro | 310 | 22,2 × 14,0 | 146° |  | 10,0 (78 %) | maqueta | bloque rectangular mediano | 321 | 678806127 |
| 160 |  | dentro | 328 | 26,3 × 12,5 | 145° |  | 7,5 (70 %) | maqueta | bloque rectangular mediano | 354 | 678806128 |
| 161 |  | dentro | 409 | 27,6 × 19,8 | 147° |  | 7,5 (77 %) | maqueta | forma compuesta (L, T, U o con patio) | 388 | 678806129 |
| 162 |  | dentro | 366 | 30,4 × 12,3 | 44° |  | 8,5 (77 %) | maqueta | bloque rectangular mediano | 435 | 608482541 |
| 163 |  | dentro | 369 | 32,4 × 11,4 | 69° |  | 6,0 (90 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 481 | 678917550 |
| 164 |  | dentro | 457 | 29,4 × 15,6 | 8° |  | 14,5 (66 %) | maqueta | bloque rectangular mediano | 415 | 387400198 |
| 165 | UNHCR Americas Regional Bureau & R4V | dentro | 459 | 31,9 × 14,4 | 1° | 2 | 8,0 (84 %) | maqueta | bloque rectangular mediano | 446 | 387424349 |
| 166 |  | dentro | 408 | 23,6 × 20,2 | 72° |  | 8,5 (69 %) | maqueta | bloque rectangular mediano | 392 | 387400197 |
| 167 |  | dentro | 325 | 20,6 × 18,7 | 74° |  | 8,5 (71 %) | maqueta | bloque rectangular mediano | 422 | 608482540 |
| 168 |  | dentro | 408 | 23,6 × 20,2 | 56° |  | 9,5 (48 %) | maqueta | bloque rectangular mediano | 366 | 387400196 |
| 169 |  | dentro | 325 | 20,5 × 18,7 | 60° |  | 8,0 (85 %) | maqueta | bloque rectangular mediano | 399 | 608482539 |
| 170 |  | dentro | 408 | 23,6 × 20,2 | 49° |  | 8,5 (6 %) | maqueta | bloque rectangular mediano | 342 | 387400195 |
| 171 | UNHCR ACNUR Regional Office Panama | dentro | 325 | 20,5 × 18,7 | 57° | 2 | 7,5 (80 %) | maqueta | bloque rectangular mediano | 373 | 608482538 |
| 172 |  | dentro | 330 | 18,7 × 17,7 | 142° |  | 8,5 (65 %) | maqueta | bloque rectangular mediano | 301 | 387400194 |
| 173 |  | dentro | 582 | 30,0 × 21,5 | 55° |  | 6,5 (71 %) | maqueta | bloque rectangular mediano | 338 | 608482542 |
| 174 |  | dentro | 325 | 20,5 × 18,7 | 55° |  | 9,5 (88 %) | maqueta | bloque rectangular mediano | 274 | 608482514 |
| 175 |  | dentro | 325 | 20,5 × 18,7 | 57° |  | 9,5 (80 %) | maqueta | bloque rectangular mediano | 300 | 608482516 |
| 176 |  | dentro | 409 | 23,5 × 20,6 | 35° |  | 8,5 (63 %) | maqueta | bloque rectangular mediano | 249 | 387400193 |
| 177 |  | dentro | 325 | 20,5 × 18,7 | 45° |  | 9,0 (71 %) | maqueta | bloque rectangular mediano | 276 | 608482517 |
| 178 |  | dentro | 362 | 25,9 × 14,0 | 100° |  | 8,5 (73 %) | maqueta | bloque rectangular mediano | 209 | 387400192 |
| 179 |  | dentro | 325 | 20,5 × 18,7 | 34° |  | 8,0 (74 %) | maqueta | bloque rectangular mediano | 252 | 608482518 |
| 180 |  | dentro | 362 | 25,9 × 14,0 | 65° |  | 9,0 (47 %) | maqueta | bloque rectangular mediano | 178 | 608482548 |
| 181 |  | dentro | 362 | 25,9 × 14,0 | 105° |  | 10,1 (52 %) | maqueta | bloque rectangular mediano | 220 | 608482519 |
| 182 |  | dentro | 899 | 41,3 × 23,7 | 145° |  | 9,0 (94 %) | a mano | bloque rectangular mediano ★ | 68 | 300885895 |
| 183 |  | dentro | 1.700 | 42,9 × 39,6 | 144° |  | 8,5 (97 %) | maqueta | bloque rectangular mediano | 93 | 608482549 |
| 184 | Centro de Convenciones | dentro | 1.906 | 47,6 × 42,8 | 144° |  | 5,0 (87 %) | maqueta | bloque rectangular mediano | 108 | 678917548 |
| 185A |  | dentro | 551 | 30,1 × 18,3 | 145° |  | 7,5 (90 %) | maqueta | bloque rectangular mediano | 175 | 608482550 |
| 185B | Balboa Academy's GYM | dentro | 1.724 | 52,3 × 37,7 | 55° |  | 9,5 (91 %) | maqueta | bloque rectangular mediano | 176 | 354865113 |
| 200 |  | dentro | 138 | 12,5 × 11,0 | 55° |  | 5,5 (100 %) | maqueta | casa o pabellón pequeño | 252 | 678917546 |
| 201 | Estación de Bomberos No. 14 - Christian Arnheiter Jr. | dentro | 1.468 | 56,9 × 55,3 | 55° | 2 | 9,0 (93 %) | maqueta | forma compuesta (L, T, U o con patio) | 173 | 353044725 |
| 215 |  | dentro | 1.351 | 92,3 × 14,6 | 128° |  | 6,0 (88 %) | maqueta | bloque rectangular mediano | 386 | 358402095 |
| 216 | Centro de Acopio de Reciclaje de CLayton | dentro | 934 | 53,9 × 17,9 | 127° |  | 6,0 (97 %) | maqueta | barraca alargada tipo cuartel (como el 106) | 399 | 358402094 |
| 217 | Telecarrier | dentro | 2.206 | 66,1 × 34,3 | 33° |  | 18,5 (92 %) | maqueta | bloque rectangular mediano | 408 | 294447208 |
| 218 | Operaciones Ciudad del Saber | dentro | 1.224 | 48,9 × 25,0 | 33° |  | 8,0 (92 %) | maqueta | barraca alargada tipo cuartel (como el 106) | 431 | 294447204 |
| 219 |  | dentro | 1.312 | 58,2 × 22,6 | 33° |  | 8,5 (96 %) | maqueta | barraca alargada tipo cuartel (como el 106) | 457 | 294447207 |
| 220 |  | dentro | 423 | 27,5 × 15,4 | 148° | 3 | 8,5 (92 %) | maqueta | bloque rectangular mediano | 637 | 1280703658 |
| 221 |  | dentro | 1.401 | 64,4 × 21,7 | 108° | 4 | 14,0 (73 %) | maqueta | bloque rectangular mediano | 684 | 380913417 |
| 222 |  | dentro | 1.037 | 47,5 × 21,8 | 108° | 4 | 15,0 (76 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 744 | 380913418 |
| 223 |  | dentro | 1.009 | 47,3 × 21,4 | 108° | 4 | 15,5 (87 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 796 | 380913419 |
| 224 |  | dentro | 881 | 41,2 × 21,4 | 108° | 4 | 18,0 (90 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 849 | 380913420 |
| 225 |  | dentro | 1.033 | 46,7 × 22,1 | 108° | 4 | 17,0 (88 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 894 | 380913421 |
| 227 | Florida State University Panamá | dentro | 897 | 40,4 × 22,2 | 59° | 4 | 15,5 (92 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 942 | 387400207 |
| 228 | Core Laboratories | dentro | 864 | 40,4 × 21,4 | 58° |  | 17,5 (96 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 957 | 387400208 |
| 230 |  | dentro | 929 | 40,6 × 22,9 | 123° | 4 | 15,5 (85 %) | maqueta | bloque rectangular mediano ★ | 913 | 620904395 |
| 231 |  | dentro | 898 | 41,1 × 21,9 | 123° | 4 | 12,0 (90 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 854 | 387425207 |
| 232 |  | dentro | 1.022 | 46,9 × 21,8 | 123° | 4 | 13,5 (94 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 789 | 620904481 |
| 233 |  | dentro | 869 | 41,0 × 21,2 | 124° | 4 | 11,5 (97 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 729 | 353913896 |
| 234 |  | dentro | 896 | 40,7 × 22,0 | 123° | 4 | 15,5 (89 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 670 | 353913898 |
| 235 |  | dentro | 936 | 41,6 × 22,5 | 123° | 4 | 15,5 (88 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 610 | 353913355 |
| 237 |  | dentro | 888 | 41,1 × 21,6 | 124° | 4 | 13,5 (96 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 494 | 353913897 |
| 238 |  | dentro | 1.493 | 64,6 × 23,1 | 34° | 4 | 15,0 (96 %) | maqueta | bloque rectangular mediano | 473 | 294447205 |
| 239 |  | dentro | 926 | 40,3 × 23,0 | 35° | 4 | 15,5 (96 %) | maqueta | bloque rectangular mediano ★ | 497 | 294447209 |
| 240 |  | dentro | 1.358 | 63,8 × 21,3 | 34° | 4 | 13,0 (98 %) | maqueta | barraca alargada tipo cuartel (como el 106) | 521 | 294447206 |
| 243 |  | dentro | 413 | 32,7 × 12,6 | 58° |  | 5,5 (45 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 966 | 380913422 |
| 244 |  | dentro | 355 | 32,7 × 10,9 | 58° |  | 5,0 (49 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 998 | 660936084 |
| 245 |  | dentro | 584 | 33,5 × 18,9 | 58° |  | 5,5 (52 %) | maqueta | bloque rectangular mediano | 1.022 | 660936087 |
| 246 |  | dentro | 382 | 34,1 × 11,4 | 59° | 1 | 6,0 (29 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 1.058 | 660936090 |
| 246 |  | dentro | 414 | 32,4 × 12,8 | 58° | 1 | 7,5 (92 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 1.090 | 660936093 |
| 246 |  | dentro | 692 | 34,1 × 20,4 | 59° | 1 | 7,5 (92 %) | maqueta | bloque rectangular mediano | 1.069 | 1280703660 |
| 247 |  | dentro | 923 | 44,0 × 21,0 | 159° |  | 7,5 (94 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 981 | 380913428 |
| 248A |  | dentro | 1.437 | 62,7 × 23,8 | 31° |  | 10,5 (90 %) | maqueta | barraca alargada tipo cuartel (como el 106) | 1.062 | 660936100 |
| 248B |  | dentro | 160 | 19,0 × 8,4 | 31° |  | 5,0 (20 %) | maqueta | casa o pabellón pequeño | 1.048 | 679223196 |
| 301 |  | dentro | 184 | 15,2 × 12,2 | 109° |  | 10,5 (77 %) | maqueta | casa o pabellón pequeño | 386 | 387425213 |
| 302 |  | dentro | 184 | 15,2 × 12,2 | 109° |  | 9,0 (84 %) | maqueta | casa o pabellón pequeño | 390 | 387425212 |
| 303 |  | dentro | 184 | 15,2 × 12,2 | 109° |  | 8,0 (91 %) | maqueta | casa o pabellón pequeño | 396 | 387425211 |
| 304 |  | dentro | 184 | 15,2 × 12,2 | 109° |  | 12,0 (85 %) | maqueta | casa o pabellón pequeño | 404 | 387425210 |
| 305 |  | dentro | 184 | 15,2 × 12,2 | 109° |  | 9,0 (99 %) | maqueta | casa o pabellón pequeño | 413 | 387425209 |
| 306 |  | dentro | 184 | 15,2 × 12,2 | 109° |  | 9,5 (92 %) | maqueta | casa o pabellón pequeño | 426 | 387425208 |
| 307 |  | dentro | 269 | 22,2 × 12,1 | 147° |  | 8,5 (60 %) | maqueta | bloque rectangular mediano | 442 | 544411975 |
| 308 |  | dentro | 205 | 17,4 × 11,8 | 108° |  | 7,0 (70 %) | maqueta | casa o pabellón pequeño | 433 | 544412645 |
| 309 |  | dentro | 210 | 18,2 × 11,6 | 108° |  | 8,5 (76 %) | maqueta | casa o pabellón pequeño | 435 | 544412643 |
| 310 |  | dentro | 186 | 16,6 × 11,2 | 108° |  | 8,5 (90 %) | maqueta | casa o pabellón pequeño | 439 | 544412642 |
| 311 |  | dentro | 194 | 16,2 × 12,0 | 108° |  | 10,0 (87 %) | maqueta | casa o pabellón pequeño | 443 | 544412640 |
| 312 |  | dentro | 185 | 16,0 × 11,6 | 108° |  | 10,0 (86 %) | maqueta | casa o pabellón pequeño | 452 | 544412639 |
| 313 |  | dentro | 202 | 17,2 × 11,8 | 106° |  | 9,0 (84 %) | maqueta | casa o pabellón pequeño | 461 | 544412637 |
| 314 |  | dentro | 207 | 17,5 × 11,8 | 108° |  | 8,5 (68 %) | maqueta | casa o pabellón pequeño | 469 | 544412636 |
| 315 |  | dentro | 210 | 18,2 × 11,5 | 109° |  | 8,5 (58 %) | maqueta | casa o pabellón pequeño | 479 | 544412634 |
| 316 |  | dentro | 186 | 16,6 × 11,2 | 108° |  | 7,0 (73 %) | maqueta | casa o pabellón pequeño | 461 | 1387881347 |
| 318 |  | dentro | 186 | 16,6 × 11,2 | 108° |  | 8,5 (57 %) | maqueta | casa o pabellón pequeño | 465 | 678917543 |
| 319 |  | dentro | 194 | 16,2 × 12,0 | 108° |  | 8,0 (74 %) | maqueta | casa o pabellón pequeño | 467 | 678917542 |
| 320 |  | dentro | 185 | 16,0 × 11,6 | 108° |  | 9,5 (70 %) | maqueta | casa o pabellón pequeño | 472 | 678917540 |
| 321 |  | dentro | 202 | 17,2 × 11,8 | 106° |  | 8,5 (73 %) | maqueta | casa o pabellón pequeño | 480 | 678917539 |
| 322 |  | dentro | 207 | 17,5 × 11,8 | 108° |  | 7,5 (60 %) | maqueta | casa o pabellón pequeño | 490 | 678917538 |
| 323 |  | dentro | 210 | 18,2 × 11,5 | 109° |  | 9,0 (57 %) | maqueta | casa o pabellón pequeño | 499 | 678917541 |
| 325 |  | dentro | 199 | 17,1 × 11,8 | 108° |  | 7,0 (83 %) | maqueta | casa o pabellón pequeño | 511 | 678917537 |
| 326 |  | dentro | 186 | 16,6 × 11,2 | 108° |  | 8,5 (79 %) | maqueta | casa o pabellón pequeño | 511 | 678917536 |
| 327 |  | dentro | 194 | 16,2 × 12,0 | 108° |  | 8,0 (63 %) | maqueta | casa o pabellón pequeño | 511 | 678917535 |
| 328 |  | dentro | 185 | 16,0 × 11,6 | 108° |  | 9,0 (74 %) | maqueta | casa o pabellón pequeño | 515 | 678917533 |
| 329 |  | dentro | 202 | 17,2 × 11,8 | 106° |  | 9,0 (70 %) | maqueta | casa o pabellón pequeño | 519 | 678917532 |
| 330 |  | dentro | 207 | 17,5 × 11,8 | 108° |  | 9,0 (63 %) | maqueta | casa o pabellón pequeño | 524 | 678917531 |
| 331 |  | dentro | 210 | 18,2 × 11,5 | 109° |  | 9,0 (71 %) | maqueta | casa o pabellón pequeño | 532 | 678917534 |
| 332A |  | dentro | 123 | 12,6 × 9,7 | 161° | 3 | 7,5 (73 %) | maqueta | casa o pabellón pequeño | 554 | 387391537 |
| 332B |  | dentro | 128 | 12,7 × 10,1 | 161° | 3 | 7,5 (72 %) | maqueta | casa o pabellón pequeño | 547 | 387391538 |
| 333 |  | dentro | 219 | 17,9 × 12,2 | 112° |  | 6,5 (62 %) | maqueta | casa o pabellón pequeño | 537 | 387391539 |
| 334 |  | dentro | 210 | 18,2 × 11,6 | 108° |  | 8,0 (73 %) | maqueta | casa o pabellón pequeño | 535 | 678917530 |
| 335 |  | dentro | 186 | 16,6 × 11,2 | 108° |  | 7,5 (73 %) | maqueta | casa o pabellón pequeño | 536 | 678917529 |
| 336 |  | dentro | 194 | 16,2 × 12,0 | 108° |  | 7,9 (69 %) | maqueta | casa o pabellón pequeño | 535 | 678917528 |
| 337 |  | dentro | 185 | 16,0 × 11,6 | 108° |  | 8,0 (83 %) | maqueta | casa o pabellón pequeño | 539 | 678917526 |
| 338 |  | dentro | 202 | 17,2 × 11,8 | 106° |  | 10,0 (78 %) | maqueta | casa o pabellón pequeño | 543 | 678917525 |
| 339 |  | dentro | 207 | 17,5 × 11,8 | 108° |  | 8,5 (97 %) | maqueta | casa o pabellón pequeño | 549 | 678917524 |
| 340 |  | dentro | 210 | 18,2 × 11,5 | 109° |  | 7,5 (85 %) | maqueta | casa o pabellón pequeño | 554 | 678917527 |
| 341 |  | dentro | 407 | 24,8 × 16,4 | 35° |  | 6,0 (78 %) | maqueta | bloque rectangular mediano | 364 | 386353668 |
| 342 |  | dentro | 527 | 29,4 × 17,9 | 47° |  | 7,0 (69 %) | maqueta | bloque rectangular mediano | 405 | 386353658 |
| 347 |  | dentro | 464 | 28,3 × 16,4 | 83° |  | 5,5 (81 %) | maqueta | bloque rectangular mediano | 574 | 608482557 |
| 348 |  | dentro | 465 | 27,3 × 17,1 | 83° |  | 5,0 (78 %) | maqueta | bloque rectangular mediano | 605 | 387424348 |
| 349 |  | dentro | 296 | 21,7 × 16,7 | 119° | 2 | 4,5 (0 %) | maqueta | bloque rectangular mediano | 652 | 1387881350 |
| 350 |  | dentro | 296 | 21,7 × 16,7 | 123° | 2 | 8,5 (32 %) | maqueta | bloque rectangular mediano | 661 | 1387881349 |
| 351 |  | dentro | 296 | 21,7 × 16,7 | 125° | 2 | 8,0 (52 %) | maqueta | bloque rectangular mediano | 667 | 1387881348 |
| 352 |  | dentro | 296 | 21,7 × 16,7 | 143° | 2 | 8,0 (62 %) | maqueta | bloque rectangular mediano | 675 | 388106852 |
| 353 |  | dentro | 280 | 18,9 × 15,2 | 52° | 2 | 8,0 (57 %) | maqueta | bloque rectangular mediano | 672 | 1387090589 |
| 354 |  | dentro | 280 | 18,9 × 15,1 | 52° |  | 6,5 (72 %) | maqueta | bloque rectangular mediano | 673 | 388106873 |
| 355 |  | dentro | 322 | 18,1 × 17,8 | 58° |  | 6,5 (65 %) | maqueta | bloque rectangular mediano | 678 | 388106856 |
| 356 |  | dentro | 311 | 18,4 × 16,9 | 143° | 2 | 6,0 (76 %) | maqueta | bloque rectangular mediano | 682 | 543575139 |
| 369C | Gazebo Espave | dentro | 184 | 23,5 × 7,8 | 93° |  | 4,0 (66 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 334 | 608482531 |
| 369D |  | dentro | 394 | 31,8 × 13,9 | 55° | 1 | 6,5 (89 %) | maqueta | bloque rectangular mediano | 204 | 608482551 |
| 371 |  | dentro | 417 | 27,0 × 15,4 | 149° |  | 6,0 (77 %) | maqueta | bloque rectangular mediano | 674 | 608482560 |
| 372 |  | dentro | 417 | 27,0 × 15,4 | 59° |  | 5,5 (80 %) | maqueta | bloque rectangular mediano | 681 | 608482559 |
| 373 |  | dentro | 507 | 26,4 × 19,2 | 55° |  | 5,5 (72 %) | maqueta | bloque rectangular mediano | 682 | 358401799 |
| 374 |  | dentro | 426 | 27,8 × 15,4 | 57° |  | 6,0 (81 %) | maqueta | bloque rectangular mediano | 640 | 358401840 |
| 375 |  | dentro | 531 | 30,1 × 17,7 | 57° |  | 6,0 (76 %) | maqueta | bloque rectangular mediano | 637 | 358401794 |
| 376 |  | dentro | 417 | 27,0 × 15,4 | 59° |  | 5,5 (66 %) | maqueta | bloque rectangular mediano | 599 | 608482558 |
| 377 |  | dentro | 417 | 27,0 × 15,4 | 148° |  | 8,5 (79 %) | maqueta | bloque rectangular mediano | 580 | 608482570 |
| 378 |  | dentro | 417 | 27,0 × 15,4 | 57° |  | 10,5 (59 %) | maqueta | bloque rectangular mediano | 604 | 608482569 |
| 379 |  | dentro | 416 | 27,0 × 15,4 | 57° |  | 6,5 (89 %) | maqueta | bloque rectangular mediano | 632 | 608482571 |
| 380 |  | dentro | 417 | 27,0 × 15,4 | 57° |  | 6,5 (98 %) | maqueta | bloque rectangular mediano | 652 | 608482568 |
| 381 |  | dentro | 417 | 27,0 × 15,4 | 57° |  | 6,0 (77 %) | maqueta | bloque rectangular mediano | 637 | 608482567 |
| 382 |  | dentro | 417 | 27,0 × 15,4 | 57° |  | 6,0 (77 %) | maqueta | bloque rectangular mediano | 688 | 608482566 |
| 383 |  | dentro | 417 | 27,0 × 15,4 | 57° |  | 5,5 (61 %) | maqueta | bloque rectangular mediano | 677 | 608482564 |
| 384 |  | dentro | 417 | 27,0 × 15,4 | 57° |  | 6,5 (84 %) | maqueta | bloque rectangular mediano | 729 | 608482565 |
| 385 |  | dentro | 416 | 27,0 × 15,4 | 57° |  | 5,0 (68 %) | maqueta | bloque rectangular mediano | 718 | 608482563 |
| 386 |  | dentro | 417 | 27,0 × 15,4 | 149° |  | 5,5 (92 %) | maqueta | bloque rectangular mediano | 760 | 608482561 |
| 387 |  | dentro | 417 | 27,0 × 15,4 | 149° |  | 6,5 (92 %) | maqueta | bloque rectangular mediano | 787 | 608482562 |
| 388 |  | dentro | 417 | 27,0 × 15,4 | 57° |  | 6,5 (79 %) | maqueta | bloque rectangular mediano | 763 | 608482575 |
| 389 |  | dentro | 417 | 27,0 × 15,4 | 57° |  | 6,0 (77 %) | maqueta | bloque rectangular mediano | 828 | 608482578 |
| 390 |  | dentro | 417 | 27,0 × 15,4 | 57° |  | 7,0 (85 %) | maqueta | bloque rectangular mediano | 789 | 608482576 |
| 391 |  | dentro | 417 | 27,0 × 15,4 | 57° |  | 6,5 (63 %) | maqueta | bloque rectangular mediano | 725 | 608482574 |
| 392 |  | dentro | 417 | 27,0 × 15,4 | 57° |  | 7,5 (79 %) | maqueta | bloque rectangular mediano | 752 | 608482577 |
| 393 |  | dentro | 416 | 27,0 × 15,4 | 57° |  | 7,0 (94 %) | maqueta | bloque rectangular mediano | 689 | 608482573 |
| 394 |  | dentro | 417 | 27,0 × 15,4 | 57° |  | 7,5 (93 %) | maqueta | bloque rectangular mediano | 717 | 608482572 |
| 395 |  | dentro | 417 | 27,0 × 15,4 | 57° |  | 13,0 (34 %) | maqueta | bloque rectangular mediano | 682 | 608482579 |
| 396 |  | dentro | 416 | 27,0 × 15,4 | 88° |  | 5,5 (82 %) | maqueta | bloque rectangular mediano | 627 | 608482582 |
| 397 |  | dentro | 417 | 27,0 × 15,4 | 90° |  | 9,0 (39 %) | maqueta | bloque rectangular mediano | 670 | 608482580 |
| 398 |  | dentro | 417 | 27,0 × 15,4 | 103° |  | 8,0 (80 %) | maqueta | bloque rectangular mediano | 630 | 608482581 |
| 400 |  | dentro | 295 | 21,8 × 13,5 | 109° | 3 | 10,0 (85 %) | maqueta | bloque rectangular mediano | 752 | 353045457 |
| 402 A/B |  | dentro | 230 | 19,1 × 12,0 | 104° |  | 8,0 (93 %) | maqueta | casa o pabellón pequeño | 762 | 353045538 |
| 414B |  | dentro | 212 | 24,2 × 8,7 | 97° |  | 4,0 (1 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 853 | 387387464 |
| 426 |  | dentro | 197 | 16,6 × 11,8 | 127° |  | 8,5 (78 %) | maqueta | casa o pabellón pequeño | 1.115 | 387387462 |
| 427 |  | dentro | 173 | 20,0 × 8,7 | 103° |  | 8,0 (76 %) | maqueta | casa o pabellón pequeño | 1.095 | 387387463 |
| 461 |  | dentro | 132 | 11,9 × 11,1 | 152° |  | 6,0 (93 %) | maqueta | casa o pabellón pequeño | 950 | 387424346 |
| 913 |  | dentro | 271 | 24,7 × 11,0 | 103° |  | 9,0 (96 %) | maqueta | bloque rectangular mediano | 884 | 355570831 |

## Edificios sin número (118)

Ordenados por distancia al 106. Muchos son casetas, garitas o techos sueltos; otros son edificios grandes que OSM no numera (la verificación en Street View o a pie debería anotar el número del rótulo, si lo tienen).

| N.º | Nombre | Límite | Área m² | Caja m | Rumbo | Niveles OSM | OB p90 m (cubre) | Modelado en main | Tipología (conjetura por forma) | A 106 m | OSM |
|---|---|---|---:|---|---:|---:|---|---|---|---:|---|
|  | Clayton Bowling | dentro | 802 | 43,8 × 18,3 | 55° | 1 | 6,5 (94 %) | maqueta | barraca alargada tipo cuartel (como el 106) ★ | 163 | 300885894 |
|  |  | dentro | 54 | 8,8 × 6,1 | 148° |  | 1,5 (0 %) | maqueta | caseta o estructura menor | 200 | 608482553 |
|  |  | dentro | 54 | 8,8 × 6,1 | 148° |  | 1,0 (0 %) | maqueta | caseta o estructura menor | 205 | 608482552 |
|  | COPA Airlines Training center | dentro | 2.590 | 91,0 × 41,5 | 56° |  | 9,5 (92 %) | maqueta | forma compuesta (L, T, U o con patio) | 211 | 353044693 |
|  |  | dentro | 415 | 55,0 × 7,5 | 145° |  | 5,0 (51 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 213 | 678917544 |
|  |  | dentro | 938 | 41,9 × 30,7 | 145° |  | 5,5 (86 %) | maqueta | forma compuesta (L, T, U o con patio) | 225 | 678917545 |
|  |  | dentro | 703 | 28,9 × 24,4 | 55° |  | 7,0 (85 %) | maqueta | bloque rectangular mediano | 230 | 1420857940 |
|  | Centro Nacional de Metrología de Panamá AIP | dentro | 1.243 | 52,9 × 23,5 | 54° |  | 12,5 (85 %) | maqueta | barraca alargada tipo cuartel (como el 106) | 257 | 834058361 |
|  | Instituto de Investigaciones Científicas y Servicios de Alta Tecnología de Panamá | dentro | 1.845 | 70,8 × 26,1 | 144° |  | 15,5 (81 %) | maqueta | bloque rectangular mediano | 268 | 834058362 |
|  |  | dentro | 1.303 | 66,0 × 21,3 | 54° |  | 7,5 (98 %) | maqueta | bloque rectangular mediano | 286 | 294447899 |
|  | Secretaría Nacional de Ciencia, Tecnología e Innovación | dentro | 1.929 | 75,1 × 25,7 | 145° |  | 15,0 (76 %) | maqueta | bloque rectangular mediano | 289 | 834058363 |
|  |  | dentro | 333 | 21,8 × 17,4 | 108° |  | 13,0 (96 %) | maqueta | bloque rectangular mediano | 293 | 1202990397 |
|  |  | dentro | 310 | 34,4 × 9,0 | 29° | 1 | 5,0 (80 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 308 | 1388077062 |
|  |  | dentro | 863 | 37,1 × 23,3 | 54° |  | 7,0 (96 %) | maqueta | bloque rectangular mediano ★ | 319 | 294447900 |
|  |  | dentro | 58 | 11,4 × 5,1 | 41° |  | 4,0 (83 %) | maqueta | caseta o estructura menor | 333 | 1388268566 |
|  |  | dentro | 294 | 24,4 × 12,1 | 86° | 2 | 7,0 (85 %) | maqueta | bloque rectangular mediano | 346 | 386353660 |
|  |  | dentro | 45 | 8,9 × 5,0 | 93° |  | 2,0 (43 %) | maqueta | caseta o estructura menor | 351 | 608482530 |
|  |  | dentro | 59 | 11,9 × 5,0 | 133° |  | 4,0 (90 %) | maqueta | caseta o estructura menor | 357 | 1388268565 |
|  |  | dentro | 32 | 6,0 × 5,3 | 19° |  | 3,5 (39 %) | maqueta | caseta o estructura menor | 364 | 608482536 |
|  |  | dentro | 85 | 11,2 × 7,7 | 43° |  | 5,5 (60 %) | maqueta | casa o pabellón pequeño | 373 | 1388077069 |
|  |  | dentro | 265 | 22,5 × 12,1 | 127° |  | 6,0 (81 %) | maqueta | bloque rectangular mediano | 384 | 1388257054 |
|  |  | dentro | 32 | 6,0 × 5,2 | 90° |  | 0,0 (0 %) | maqueta | caseta o estructura menor | 385 | 1388257061 |
|  |  | dentro | 227 | 16,6 × 13,7 | 90° |  | 6,0 (97 %) | maqueta | casa o pabellón pequeño | 389 | 608482529 |
|  |  | dentro | 32 | 6,0 × 5,2 | 66° |  | 3,0 (96 %) | maqueta | caseta o estructura menor | 418 | 608482534 |
|  | UNHCR Americas Regional Bureau | dentro | 533 | 37,7 × 14,7 | 64° |  | 5,5 (83 %) | maqueta | bloque rectangular mediano ★ | 424 | 753443423 |
|  |  | dentro | 32 | 6,0 × 5,2 | 38° |  | 0,0 (0 %) | maqueta | caseta o estructura menor | 430 | 1388257060 |
|  |  | dentro | 32 | 6,0 × 5,2 | 21° |  | 3,5 (74 %) | maqueta | caseta o estructura menor | 442 | 608482535 |
|  |  | dentro | 83 | 11,1 × 7,8 | 157° |  | 4,2 (74 %) | maqueta | casa o pabellón pequeño | 447 | 1388077070 |
|  |  | dentro | 210 | 32,0 × 8,2 | 69° |  | 4,5 (66 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 472 | 353913253 |
|  |  | dentro | 157 | 15,3 × 10,3 | 125° |  | 5,5 (60 %) | maqueta | casa o pabellón pequeño | 493 | 1000601269 |
|  |  | dentro | 351 | 28,9 × 12,2 | 88° | 1 | 5,0 (91 %) | maqueta | bloque rectangular mediano | 512 | 1291630817 |
|  | La Taberna del Canal | dentro | 260 | 18,3 × 14,2 | 143° |  | 10,5 (85 %) | maqueta | bloque rectangular mediano | 525 | 387400202 |
|  |  | dentro | 331 | 19,0 × 17,4 | 34° |  | 8,5 (60 %) | maqueta | bloque rectangular mediano | 525 | 543575151 |
|  |  | dentro | 346 | 18,8 × 18,4 | 125° |  | 9,5 (45 %) | maqueta | bloque rectangular mediano | 540 | 543575150 |
|  |  | dentro | 348 | 19,7 × 17,7 | 34° |  | 8,0 (83 %) | maqueta | bloque rectangular mediano | 559 | 543575149 |
|  | The Panama International Hotel School | dentro | 303 | 30,9 × 9,8 | 146° |  | 11,5 (57 %) | maqueta | bloque estrecho y alargado (tira de viviendas o pabellón) | 565 | 387400199 |
|  |  | dentro | 321 | 17,9 × 17,9 | 36° |  | 8,5 (82 %) | maqueta | bloque rectangular mediano | 578 | 543575148 |
|  | Paddy Mick's | dentro | 211 | 21,2 × 10,4 | 153° |  | 5,5 (80 %) | maqueta | casa o pabellón pequeño | 579 | 413191027 |
|  |  | dentro | 351 | 19,3 × 18,2 | 127° |  | 6,0 (55 %) | maqueta | bloque rectangular mediano | 598 | 543575147 |
|  | Holiday Inn | dentro | 2.741 | 59,1 × 56,1 | 153° |  | 27,5 (73 %) | maqueta | nave o edificio grande | 613 | 183921945 |
|  |  | dentro | 353 | 19,0 × 18,6 | 35° |  | 9,0 (77 %) | maqueta | bloque rectangular mediano | 622 | 543575146 |
|  |  | dentro | 297 | 17,4 × 17,1 | 121° |  | 8,5 (70 %) | maqueta | bloque rectangular mediano | 644 | 543575145 |
|  |  | dentro | 94 | 16,3 × 15,8 | 123° |  | 11,5 (8 %) | maqueta | casa o pabellón pequeño | 657 | 1387881354 |
|  |  | dentro | 339 | 18,4 × 18,4 | 109° |  | 8,5 (61 %) | maqueta | bloque rectangular mediano | 662 | 543575144 |
|  |  | dentro | 308 | 18,9 × 16,3 | 4° |  | 6,0 (0 %) | maqueta | bloque rectangular mediano | 677 | 543575143 |
|  |  | dentro | 332 | 20,4 × 16,2 | 172° |  | 7,5 (61 %) | maqueta | bloque rectangular mediano | 686 | 543575142 |
|  |  | dentro | 295 | 18,5 × 15,9 | 151° |  | 7,5 (80 %) | maqueta | bloque rectangular mediano | 689 | 543575140 |
|  |  | dentro | 346 | 20,0 × 17,3 | 165° |  | 7,5 (65 %) | maqueta | bloque rectangular mediano | 690 | 543575141 |
|  | Clayton Towers | dentro | 1.083 | 74,1 × 14,6 | 129° |  | 18,0 (82 %) | maqueta | bloque rectangular mediano | 706 | 358401792 |
|  | Canal View A | dentro | 391 | 26,3 × 14,9 | 127° |  | 21,0 (87 %) | maqueta | bloque rectangular mediano | 719 | 353045673 |
|  | Canal View B | dentro | 379 | 25,3 × 15,0 | 126° |  | 25,0 (78 %) | maqueta | bloque rectangular mediano | 726 | 353045704 |
|  |  | dentro (Hill/Parke) | 276 | 23,2 × 11,9 | 140° |  | 6,0 (86 %) | maqueta | bloque rectangular mediano | 731 | 388106849 |
|  |  | dentro (Hill/Parke) | 271 | 20,4 × 13,3 | 153° |  | 6,5 (42 %) | maqueta | bloque rectangular mediano | 750 | 388106863 |
|  |  | dentro (Hill/Parke) | 382 | 23,3 × 21,9 | 147° |  | 8,0 (85 %) | maqueta | forma compuesta (L, T, U o con patio) | 754 | 388106869 |
|  |  | dentro (Hill/Parke) | 253 | 19,3 × 13,1 | 171° |  | 7,5 (76 %) | maqueta | bloque rectangular mediano | 757 | 388106868 |
|  |  | dentro (Hill/Parke) | 201 | 18,4 × 11,1 | 107° |  | 6,0 (97 %) | maqueta | casa o pabellón pequeño | 761 | 1388268954 |
|  |  | dentro (Hill/Parke) | 424 | 25,6 × 16,6 | 177° |  | 7,5 (60 %) | maqueta | bloque rectangular mediano | 762 | 388106857 |
|  | Fundación Valorate | dentro | 340 | 23,8 × 14,3 | 61° |  | 5,0 (71 %) | maqueta | bloque rectangular mediano | 764 | 387424350 |
|  |  | dentro (Hill/Parke) | 323 | 23,9 × 13,5 | 140° |  | 5,5 (74 %) | maqueta | bloque rectangular mediano | 764 | 388106855 |
|  |  | dentro | 359 | 24,2 × 15,8 | 106° |  | 9,5 (78 %) | maqueta | bloque rectangular mediano | 771 | 353045556 |
|  |  | dentro | 240 | 19,4 × 12,4 | 103° |  | 10,0 (98 %) | maqueta | casa o pabellón pequeño | 781 | 388106871 |
|  |  | dentro (Hill/Parke) | 344 | 22,7 × 15,1 | 165° |  | 5,0 (60 %) | maqueta | bloque rectangular mediano | 784 | 388106870 |
|  |  | dentro | 304 | 20,7 × 19,2 | 104° |  | 10,0 (96 %) | maqueta | bloque rectangular mediano | 785 | 355565544 |
|  |  | dentro | 441 | 26,9 × 21,7 | 105° |  | 8,5 (75 %) | maqueta | bloque rectangular mediano | 795 | 355565546 |
|  |  | dentro (Hill/Parke) | 385 | 22,2 × 19,9 | 92° |  | 7,0 (51 %) | maqueta | bloque rectangular mediano | 802 | 388106875 |
|  |  | dentro | 97 | 9,9 × 9,8 | 12° | 1 | 5,3 (97 %) | maqueta | casa o pabellón pequeño | 804 | 1491582516 |
|  |  | dentro | 303 | 20,8 × 14,6 | 104° |  | 10,5 (63 %) | maqueta | bloque rectangular mediano | 806 | 355565545 |
|  |  | dentro (Hill/Parke) | 327 | 23,8 × 13,8 | 172° |  | 6,5 (74 %) | maqueta | bloque rectangular mediano | 809 | 388106839 |
|  |  | dentro (Hill/Parke) | 375 | 25,4 × 20,3 | 127° |  | 5,5 (74 %) | maqueta | forma compuesta (L, T, U o con patio) | 810 | 543575396 |
|  |  | dentro (Hill/Parke) | 922 | 38,3 × 24,8 | 20° |  | 5,0 (61 %) | maqueta | bloque rectangular mediano | 816 | 388106846 |
|  |  | dentro | 263 | 20,4 × 19,0 | 13° |  | 7,0 (87 %) | maqueta | bloque rectangular mediano | 820 | 355570820 |
|  |  | dentro (Hill/Parke) | 484 | 27,7 × 20,8 | 39° |  | 6,0 (67 %) | maqueta | bloque rectangular mediano | 826 | 388106853 |
|  |  | dentro (Hill/Parke) | 585 | 30,5 × 21,6 | 40° |  | 5,5 (68 %) | maqueta | bloque rectangular mediano | 836 | 388106858 |
|  |  | dentro | 207 | 21,1 × 9,8 | 98° |  | 9,0 (91 %) | maqueta | casa o pabellón pequeño | 838 | 358401798 |
|  |  | dentro (Hill/Parke) | 429 | 24,2 × 23,8 | 126° |  | 6,5 (66 %) | maqueta | forma compuesta (L, T, U o con patio) | 840 | 388106851 |
|  |  | dentro | 228 | 18,1 × 12,6 | 10° |  | 6,2 (10 %) | maqueta | casa o pabellón pequeño | 842 | 358401797 |
|  |  | dentro (Hill/Parke) | 470 | 24,4 × 19,3 | 36° |  | 5,5 (63 %) | maqueta | bloque rectangular mediano | 850 | 388106876 |
|  |  | dentro (Hill/Parke) | 586 | 26,2 × 25,0 | 153° |  | 7,0 (41 %) | maqueta | bloque rectangular mediano | 862 | 388106847 |
|  |  | dentro | 495 | 30,5 × 23,7 | 13° |  | 8,5 (66 %) | maqueta | forma compuesta (L, T, U o con patio) | 866 | 386353659 |
|  |  | dentro (Hill/Parke) | 525 | 29,2 × 20,8 | 38° |  | 5,5 (79 %) | maqueta | bloque rectangular mediano | 866 | 388106844 |
|  |  | dentro | 271 | 24,7 × 11,0 | 103° |  | 8,0 (92 %) | maqueta | bloque rectangular mediano | 870 | 387387461 |
|  |  | dentro (Hill/Parke) | 392 | 28,1 × 14,0 | 34° |  | 5,0 (88 %) | maqueta | bloque rectangular mediano | 872 | 388106862 |
|  |  | dentro (Hill/Parke) | 294 | 24,4 × 12,0 | 34° |  | 6,0 (99 %) | maqueta | bloque rectangular mediano | 877 | 388106861 |
|  |  | dentro (Hill/Parke) | 474 | 28,8 × 19,3 | 26° |  | 6,5 (60 %) | maqueta | bloque rectangular mediano | 896 | 388106840 |
|  |  | dentro | 577 | 32,8 × 17,6 | 64° |  | 8,5 (47 %) | maqueta | bloque rectangular mediano | 901 | 387424347 |
|  |  | dentro (Hill/Parke) | 408 | 25,3 × 16,1 | 39° |  | 12,5 (77 %) | maqueta | bloque rectangular mediano | 914 | 388106866 |
|  |  | dentro (Hill/Parke) | 454 | 29,7 × 15,3 | 36° |  | 5,5 (82 %) | maqueta | bloque rectangular mediano | 915 | 388106864 |
|  |  | dentro | 274 | 23,1 × 11,9 | 65° |  | 6,5 (91 %) | maqueta | bloque rectangular mediano | 920 | 386353667 |
|  |  | dentro (Hill/Parke) | 615 | 30,2 × 24,7 | 121° |  | 6,0 (63 %) | maqueta | bloque rectangular mediano | 929 | 388106841 |
|  |  | dentro (Hill/Parke) | 282 | 19,9 × 16,7 | 64° |  | 5,5 (51 %) | maqueta | bloque rectangular mediano | 935 | 388106878 |
|  |  | dentro | 144 | 14,5 × 9,9 | 148° |  | 5,0 (60 %) | maqueta | casa o pabellón pequeño | 939 | 1280703657 |
|  |  | dentro (Hill/Parke) | 507 | 28,9 × 19,6 | 37° |  | 5,5 (77 %) | maqueta | bloque rectangular mediano | 947 | 388106854 |
|  |  | dentro | 462 | 29,3 × 16,1 | 103° |  | 9,0 (83 %) | maqueta | bloque rectangular mediano | 953 | 679244364 |
|  |  | dentro | 164 | 14,9 × 11,7 | 59° |  | 6,5 (66 %) | maqueta | casa o pabellón pequeño | 963 | 753443420 |
|  |  | dentro | 270 | 20,8 × 13,5 | 104° |  | 8,0 (69 %) | maqueta | bloque rectangular mediano | 976 | 679244365 |
|  |  | dentro | 199 | 20,9 × 9,5 | 102° |  | 9,0 (61 %) | maqueta | casa o pabellón pequeño | 976 | 679244368 |
|  |  | dentro (Hill/Parke) | 306 | 25,2 × 16,5 | 97° |  | 6,5 (75 %) | maqueta | forma compuesta (L, T, U o con patio) | 977 | 388106842 |
|  |  | dentro (Hill/Parke) | 358 | 22,2 × 22,1 | 41° |  | 7,5 (63 %) | maqueta | forma compuesta (L, T, U o con patio) | 980 | 388106860 |
|  |  | dentro (Hill/Parke) | 546 | 30,8 × 24,9 | 164° |  | 5,5 (78 %) | maqueta | forma compuesta (L, T, U o con patio) | 984 | 388106859 |
|  |  | dentro (Hill/Parke) | 492 | 27,9 × 21,1 | 142° |  | 8,0 (75 %) | maqueta | bloque rectangular mediano | 989 | 388106850 |
|  |  | dentro | 106 | 11,1 × 9,9 | 114° |  | 6,0 (79 %) | maqueta | casa o pabellón pequeño | 991 | 753393174 |
|  |  | dentro | 328 | 25,9 × 12,8 | 103° |  | 8,5 (68 %) | maqueta | bloque rectangular mediano | 991 | 679244367 |
|  |  | dentro | 106 | 11,1 × 9,9 | 114° |  | 7,5 (98 %) | maqueta | casa o pabellón pequeño | 996 | 753393175 |
|  |  | dentro | 253 | 21,2 × 12,1 | 103° |  | 8,5 (57 %) | maqueta | bloque rectangular mediano | 1.009 | 679244366 |
|  |  | dentro | 576 | 38,6 × 14,9 | 78° | 3 | 13,5 (77 %) | maqueta | bloque rectangular mediano ★ | 1.018 | 1280703663 |
|  |  | dentro | 269 | 16,8 × 16,5 | 14° |  | 6,0 (66 %) | maqueta | bloque rectangular mediano | 1.023 | 753393176 |
|  |  | dentro | 199 | 20,9 × 9,5 | 102° |  | 8,5 (55 %) | maqueta | casa o pabellón pequeño | 1.035 | 679244369 |
|  |  | dentro | 224 | 18,2 × 12,6 | 109° |  | 7,0 (76 %) | maqueta | casa o pabellón pequeño | 1.036 | 753442187 |
|  | Clayton Plaza | fondo | 406 | 25,8 × 22,6 | 130° |  | 6,0 (34 %) | maqueta | forma compuesta (L, T, U o con patio) | 1.053 | 387424344 |
|  |  | dentro | 337 | 25,3 × 13,3 | 19° |  | 9,0 (79 %) | maqueta | bloque rectangular mediano | 1.055 | 679244363 |
|  |  | dentro | 298 | 25,4 × 11,9 | 102° |  | 9,0 (87 %) | maqueta | bloque rectangular mediano | 1.060 | 679244371 |
|  |  | dentro | 240 | 21,2 × 11,3 | 103° |  | 9,0 (71 %) | maqueta | casa o pabellón pequeño | 1.071 | 679244362 |
|  |  | dentro | 270 | 22,2 × 12,3 | 102° |  | 9,0 (73 %) | maqueta | bloque rectangular mediano | 1.078 | 679244370 |
|  |  | dentro | 95 | 11,4 × 8,6 | 101° |  | 7,5 (86 %) | maqueta | casa o pabellón pequeño | 1.110 | 753443422 |
|  |  | dentro | 198 | 16,2 × 12,2 | 101° |  | 11,0 (52 %) | maqueta | casa o pabellón pequeño | 1.122 | 679244361 |
|  |  | dentro | 99 | 10,3 × 9,9 | 11° |  | 7,0 (55 %) | maqueta | casa o pabellón pequeño | 1.124 | 753443421 |
|  |  | dentro | 242 | 16,1 × 15,0 | 116° |  | 9,0 (70 %) | maqueta | casa o pabellón pequeño | 1.151 | 679244360 |
|  |  | dentro | 275 | 18,6 × 14,8 | 117° |  | 10,5 (60 %) | maqueta | bloque rectangular mediano | 1.172 | 679244359 |
