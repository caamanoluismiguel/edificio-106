# GLB de Descargas: posibles usos en Edificio 106

**Dictamen final para Claude Code, 8 de octubre de 2026: NO vale la pena integrar este GLB en el proyecto con la evidencia actual.** La evaluación posterior encontró duplicación de las huellas existentes, alturas genéricas, vías que necesitan reconstrucción y ningún parque identificable. Conservarlo como referencia de comparación. Los usos propuestos más abajo documentan hipótesis iniciales, no trabajo recomendado; ver el [dictamen y su evidencia](comparacion-glb/PROCEDENCIA-Y-PILOTO.md).

Fecha: 7 de octubre de 2026. Autor: OpenAI Codex, a solicitud de Luis Miguel Caamaño. Análisis desde urbanismo, Three.js y datos; es una evaluación preliminar, no un levantamiento ni una integración aprobada. Repo examinado: `75c21ca`.

## Archivo inspeccionado

- Archivo local: `/Users/luismiguelcaamano/Downloads/ciudadelsaber.glb`.
- Tamaño: 4.568.296 bytes (4,57 MB decimales).
- SHA-256: `c09b25daf4eddef945b66ab7d80a82e6a4a3b661f94f55918f776dd3634668a2`.
- glTF 2.0; generador declarado: `THREE.GLTFExporter r173`.
- 1.803 nodos, 1.802 mallas y 991 definiciones de material, idénticas entre sí. No hay imágenes/texturas ni nombres de nodo que identifiquen edificios.
- 991 primitivas tienen material; otras 811 llevan atributos `_INSTANCESTART` y `_INSTANCEEND`, compatibles con geometrías auxiliares de líneas instanciadas. No se deben contar como edificios ni tratar automáticamente como volúmenes urbanos útiles.
- Cargado directamente con GLTFLoader en una escena de inspección, el render informó 1.802 llamadas de dibujo y 23.530 triángulos. Es una medición de esa vista aislada, no una prueba de rendimiento en el visor o en un teléfono.
- No se encontró procedencia geográfica, fecha del dato, CRS, origen geográfico ni identificadores de edificios en los metadatos inspeccionados. El formato y el tamaño numérico no certifican la escala real de la exportación.

Se leyó el JSON interno del GLB y se abrió con Three.js. La [perspectiva de inspección](glb-descargas-perspectiva.png) muestra volúmenes simples. Esta vista no prueba que el archivo cubra toda Ciudad del Saber ni que las calles u otros elementos se hayan exportado de forma utilizable. El GLB original permanece fuera del repositorio; esta nota guarda su ubicación y huella para reconocerlo.

## Qué ya existe

El [inventario actual](CIUDAD.md) documenta 322 edificios: incluye 85 cajas grises, modelos por tipología, volúmenes particulares y el modelo detallado del 106. Las fichas conservan fuentes, supuestos y clases de certeza. `ciudad.glb` y `ciudad_alto.glb` ya resuelven distintos niveles de detalle.

Por tanto, el valor de este archivo depende de lo que añada o permita contrastar respecto a esa base; no se parte de una ciudad vacía.

## Usos propuestos, por prioridad

| Prioridad | Uso | Resultado útil | Condición |
| --- | --- | --- | --- |
| 1 | Superposición de ambas maquetas | Lista de diferencias en huellas, orientación, posición y cobertura | Alinear primero; una diferencia no demuestra cuál modelo está bien |
| 2 | Revisar las cajas grises y geometrías compuestas | Candidatos a completar con una forma más representativa | Comprobar cada candidato con una fuente; conservar ficha e identidad |
| 3 | Revisar vecinos del 106 | Detectar discrepancias que afecten vistas u obstrucción solar | Verificar norte, escala, posición, alturas y nivel del suelo |
| 4 | Ensayar contexto simplificado para vistas lejanas | Comparar peso y fluidez frente al nivel actual | Limpiar exportación, agrupar materiales y medir en móvil; no prometer mejora antes de probar |
| 5 | Material docente de lectura urbana | Comparar relaciones entre volúmenes, separaciones y espacios no edificados | No equiparar espacio vacío a espacio público o área verde sin datos adicionales |

El archivo no aporta por sí solo uso del suelo, vegetación real, ocupación, temperatura, ventilación, escorrentía o confort urbano. Tampoco convierte los cálculos del 106 en cálculos válidos para todos los edificios. No se proponen aquí los recorridos con sombra ni la captación de agua que LM ya descartó.

## Criterio técnico de integración

Compartir el material repetido y agrupar geometrías por sectores es un candidato de optimización. Three.js documenta [BatchedMesh](https://threejs.org/docs/pages/BatchedMesh.html) para dibujar geometrías distintas que comparten material con menos llamadas. La técnica concreta debe respetar la selección por edificio, el recorte de objetos fuera de cámara y los niveles de detalle; reducir el tamaño del archivo no garantiza aumentar los fps.

Antes de usar las 811 primitivas auxiliares, revisar cómo las generó el exportador y qué conservó GLTFLoader. No asumir que representan una red de calles navegable. Evitar geometría duplicada con `contexto.glb` o `ciudad.glb`, y preservar los GLB corregidos del 106.

## Prueba pequeña recomendada

1. Registrar origen, herramienta de exportación, fecha, unidad, norte y procedencia de las alturas. Actualización del 8 de octubre: LM confirmó map3d y Codex contrastó sus reglas de escala y altura; ver [Procedencia y piloto](comparacion-glb/PROCEDENCIA-Y-PILOTO.md). La versión exacta de exportación y las alturas reales no están acreditadas.
2. Identificar el 106 y al menos otros dos puntos separados y no alineados para estimar traslación, giro y escala. Reservar puntos distintos para comprobar el ajuste; verificar la cota vertical por separado.
3. Comparar una muestra distribuida: el 106, vecinos cercanos, una caja gris y edificios alejados. Registrar identidad actual, geometría candidata, diferencias, fuente de contraste y decisión.
4. Medir errores en unidades reales solo cuando la escala esté acreditada. El umbral de aceptación depende del uso: contexto lejano y sombra sobre una ventana requieren precisiones distintas.
5. Probar únicamente las piezas que aporten información verificable, en una rama aparte y con las comprobaciones de geometría, imagen y carga del proyecto.

## Resultado de la comparación posterior

Codex realizó la [alineación y comparación de huellas](comparacion-glb/README.md) el 7 de octubre de 2026. Encontró correspondencias para los 322 edificios del inventario, incluidas las 85 cajas grises. No aparecieron piezas adicionales con centro dentro del límite del campus. Hay 325 volúmenes con centro fuera de la caja de consulta OSM del proyecto que podrían servir para estudiar una ampliación del contexto. La comparación de plantas no acredita las alturas ni la procedencia.

Decisión actual: conservar como referencia; la comparación no justifica sustituir los edificios actuales. El GLB está alineado horizontalmente para análisis, pero no está validado en sitio, integrado ni publicado. Relación con el análisis climático: ver [CBE Clima](../analisis/CBE-CLIMA.md); Clima analiza EPW, no acredita la geometría urbana.

Ampliación del 8 de octubre: la [revisión de calles y parques](comparacion-glb/CALLES-Y-PARQUES.md) recuperó 811 polilíneas auxiliares y encontró 660 correspondencias con vías OSM existentes. Las 151 restantes no intersectan la consulta ni el límite propuesto del proyecto. No se identificaron parques en el GLB. Los trazados están en atributos especiales que GLTFLoader no reconstruye como calles al cargar el archivo directamente.
