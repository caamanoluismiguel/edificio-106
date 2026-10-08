# Verificación de la comparación

Revisión local de OpenAI Codex, 8 de octubre de 2026. No es una validación de campo ni un dictamen independiente de otro agente. Los informes quedan como análisis local; no se han publicado ni se ha integrado geometría.

| Afirmación revisada | Veredicto | Evidencia |
| --- | --- | --- |
| 991 huellas y 811 primitivas auxiliares | VERIFICADO | Lectura del GLB identificado por SHA-256; extracción de los contornos inferiores y lectura de atributos de líneas |
| 322 de 322 entradas del inventario emparejadas, incluidas 85 maquetas | VERIFICADO | Cruce por OSM ID en `resultados.json`; sin duplicados en las 666 correspondencias |
| 529 pares para ajuste y 137 controles | VERIFICADO | Partición determinista por OSM ID módulo 5; controles excluidos de votación y mínimos cuadrados |
| Diferencia máxima frente al mapa de navegación de 0,0723 m nominales | VERIFICADO | Comparación simétrica de vértices contra segmentos para las 321 huellas del mapa; no es Hausdorff continua ni error en terreno |
| 325 volúmenes sin correspondencia y 0 adicionales con centro dentro del límite propuesto | VERIFICADO | Clasificación de centroides; no equivale a intersección de polígonos |
| 133 huellas OSM de referencia sin correspondencia | VERIFICADO | 799 referencias menos 666 pares únicos; no pertenecen al inventario de 322 |
| 747 alturas de 10 unidades; 272 en el inventario | VERIFICADO | Extremos verticales de vértices transformados por matrices de nodos; conteo con redondeo a 0,001 |
| Esas alturas son medidas reales o comparten la escala horizontal | NO VERIFICABLE | No hay procedencia ni escala vertical acreditadas; los informes no afirman tal equivalencia |
| 811 polilíneas continuas, 5.538 segmentos, 660 pares OSM | VERIFICADO | `comparar_vias.py`; coincidencia ordenada de vértices y máximo menor que 0,1 m nominales |
| 151 líneas exteriores no intersectan consulta ni límite propuesto | VERIFICADO | Prueba de puntos interiores y cruce de segmentos contra ambos polígonos; no solo centroides |
| 81 vías OSM sin correspondencia | VERIFICADO | 741 referencias menos 660 pares únicos; alcance limitado al criterio de emparejamiento |
| GLTFLoader no reconstruye la red vial de esos atributos | VERIFICADO | `verificar-loader.mjs`: 811 Mesh ordinarios, misma caja de la plantilla, material estándar, sin instancias |
| No hay parques identificables en el GLB | VERIFICADO | Alcance estructural: sin nombres ni metadatos de parques; las mallas inspeccionadas son volúmenes y plantillas de líneas. No demuestra ausencia de parques reales |
| Pasto y copas del proyecto no delimitan parques | VERIFICADO | `contexto.mjs` reviste la rejilla con pasto; `arboles_cds.geojson` aporta puntos aproximados, no polígonos de parques |
| La Fundación distingue Parque Deportivo, Parque Los Lagos y Reserva Biológica | VERIFICADO | Página oficial `https://ciudaddelsaber.org/conoce-el-campus`, leída el 8 oct 2026; nombres y categorías, sin extraer límites |
| El GLB es más preciso o completo que el proyecto | NO VERIFICABLE | Coincidencias internas y coberturas diferentes no prueban exactitud o completitud; no se recomienda un reemplazo |

Se revisaron visualmente los PNG de ambos planos. Los datos originales, `modelo/`, `datos/`, `index.html` y `js/app.js` no fueron modificados por esta comparación. Las salidas JSON registran versiones, transformación y huellas de entradas; los scripts permiten recalcular las cifras. No se corrió el guardia de publicación: no cambió el sitio y no se publicó esta rama.

Actualización posterior del 8 de octubre: LM confirmó la generación con map3d. `PROCEDENCIA-Y-PILOTO.md` registra el commit consultado y las licencias de código y datos. Las reglas del exportador reprodujeron las alturas de los 666 pares (604 genéricas y 62 por niveles), con tolerancia de 0,001. Esto explica cómo se generaron, no acredita alturas reales. El cribado nominal de cámaras omite render, oclusión y niebla; sus candidatos no son edificios visibles confirmados.

Las seis identidades exteriores se recuperaron con la API oficial de OSM y se contrastaron con el GLB; `verificar_muestra.py` reproduce el cotejo sobre la instantánea local. Una pieza tiene `building=roof`, por lo que no debe importarse automáticamente como edificio macizo. Antes de cualquier integración quedan pendientes alturas reales, cota del suelo, conservar las atribuciones y las comprobaciones de modelos, imagen y carga exigidas por `.claude/CLAUDE.md`. La versión exacta de map3d usada en la exportación tampoco quedó acreditada.
