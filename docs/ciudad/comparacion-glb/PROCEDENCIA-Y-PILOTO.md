# Procedencia del GLB y muestra para evaluar contexto exterior

8 de octubre de 2026. Autor: OpenAI Codex. Luis Miguel confirmó en este chat que generó el archivo con el repositorio identificado, [cartesiancs/map3d](https://github.com/cartesiancs/map3d). Codex consultó el commit `2c5d732477ba7c55995572aae926bf80303c00b9`; la versión exacta usada al exportar no quedó registrada. El atributo de descarga de macOS indica `http://localhost:5173/`, coherente con una aplicación local, aunque por sí solo no identifica el programa.

**La revisión del exportador explica la escala, las alturas repetidas y las vías verdes.** La comparación anterior deja de depender de una conjetura sobre la herramienta. No convierte sus alturas en mediciones reales.

## Qué hace el exportador

En [Space.tsx](https://github.com/cartesiancs/map3d/blob/2c5d732477ba7c55995572aae926bf80303c00b9/src/three/Space.tsx#L11), la planta usa 51.000 unidades por grado, con corrección de longitud por coseno de latitud. La extrusión lee `height`, usa 10 si falta y sustituye ese valor por 2,2 veces `building:levels` si existen niveles. Estos tienen precedencia incluso si existe `height`. Las vías se consultan como `highway` y se dibujan como líneas verdes; ese color no indica parques. La exportación selecciona objetos marcados `exportToGLB` y no conserva las fichas OSM en sus metadatos.

La dependencia declarada de Three.js es [0.173](https://github.com/cartesiancs/map3d/blob/2c5d732477ba7c55995572aae926bf80303c00b9/package.json#L23), compatible con el generador r173 registrado en el GLB. Esta coincidencia no demuestra qué commit ejecutó el usuario.

## Comprobaciones con nuestros datos

Se recalculó la regla de alturas con las etiquetas OSM ya guardadas en el proyecto para los 666 pares identificados:

| Regla aplicable | Pares | Coincidencias con el GLB |
| --- | ---: | ---: |
| Altura genérica de 10 por ausencia de altura y niveles interpretables | 604 | 604 |
| Número de niveles multiplicado por 2,2 | 62 | 62 |
| Altura tomada directamente de `height`, sin niveles | 0 | 0 |

No hubo diferencias superiores a 0,001 unidades. Esto verifica el procedimiento en esa muestra; no acredita las alturas del terreno. Tampoco comprueba la rama `height` ni las etiquetas de las 325 piezas exteriores sin identidad OSM recuperada.

La conversión horizontal derivada del radio y proyección del proyecto es:

```text
(6.378.137 × π / 180) / 51.000 = 2,1827351136
```

El ajuste de huellas dio 2,1827563008, una diferencia relativa de unas 9,71 partes por millón. Las fórmulas emplean referencias de latitud distintas; la cercanía de los factores explica la escala observada sin establecer un sistema geográfico certificado.

**No se debe escalar todo el GLB uniformemente.** La conversión de la planta es distinta de la regla que produjo las alturas. Multiplicar Y por 2,183 convertiría, por ejemplo, una altura genérica de 10 en 21,83 sin evidencia. Para integrar un volumen habría que elegir y documentar su altura por separado.

El código de map3d declara [licencia MIT](https://github.com/cartesiancs/map3d/blob/2c5d732477ba7c55995572aae926bf80303c00b9/LICENSE); los datos OSM mantienen su [atribución y licencia ODbL](https://www.openstreetmap.org/copyright). Generar personalmente el archivo no elimina la procedencia de los datos.

## Muestra seleccionada

Los centros de las 325 piezas exteriores están entre 2,13 y 3,20 km del origen del 106, en el marco nominal del proyecto. Se seleccionaron seis piezas por cercanía, tamaño y extremos espaciales, evitando duplicados. Después se identificaron en seis consultas pequeñas a la API oficial de OSM; las alturas reales siguen sin acreditarse.

| Nodo GLB | Motivo | Distancia horizontal al 106 | Área de huella transformada | Altura original |
| --- | --- | ---: | ---: | ---: |
| 225 | Más cercano | 2.132 m | 248 m² | 10 |
| 592 | Mayor huella exterior | 2.295 m | 3.592 m² | 11 |
| 248 | Extremo X menor | 2.188 m | 218 m² | 10 |
| 598 | Extremo X mayor | 2.874 m | 886 m² | 10 |
| 728 | Extremo Z menor | 2.219 m | 322 m² | 4,4 |
| 601 | Extremo Z mayor | 3.199 m | 101 m² | 10 |

Las áreas y distancias proceden de geometría transformada, no de un levantamiento. Las alturas conservan las unidades originales; la tabla no les atribuye metros reales.

### Identidades recuperadas

| Nodo | Vía OSM | Etiquetas relevantes | Consecuencia para el piloto |
| --- | --- | --- | --- |
| 225 | [540071289](https://www.openstreetmap.org/way/540071289) | `building=house`, número 1 | Casa sin altura ni niveles; el 10 es genérico |
| 592 | [1280763824](https://www.openstreetmap.org/way/1280763824) | `building=yes`, 5 niveles | El 11 exportado es 5 × 2,2; verificar altura y cubierta |
| 248 | [540073991](https://www.openstreetmap.org/way/540073991) | `building=house`, número 25 | Casa sin altura ni niveles; el 10 es genérico |
| 598 | [1280763838](https://www.openstreetmap.org/way/1280763838) | `building=school` | Escuela sin altura ni niveles; no identificarla por nombre sin otra fuente |
| 728 | [1293780733](https://www.openstreetmap.org/way/1293780733) | `building=yes`, 2 niveles | El 4,4 exportado es 2 × 2,2 |
| 601 | [1280763843](https://www.openstreetmap.org/way/1280763843) | `building=roof`, `layer=1` | Excluir de una importación automática como volumen macizo; requiere tratar la cubierta y su apoyo |

Las seis correspondencias tienen una diferencia máxima vértice-segmento de 0,0167 m nominales. Es coincidencia geométrica entre archivos, no error real. La [instantánea OSM](muestra-osm.json) conserva geometría, etiquetas, consulta, atribución y fecha. No contiene una etiqueta `height` en ninguna de las seis piezas. Overpass respondió HTTP 406 en los intentos de consulta; se obtuvo la información mediante `api.openstreetmap.org/api/0.6/map`.

## Qué aportarían a los encuadres

Se hizo un cribado con las poses de cámara del proyecto, proporción 1440 × 900 y una envolvente hipotética entre Y = −100 y 200 para cada huella. Es una prueba conservadora de intersección con el volumen visible de la cámara, no un render: omite desplazamiento del panel, oclusiones, terreno, niebla, giro y navegación.

- No hay candidatos en las tres poses nominales del 106, ni en la pose inicial «Toda la ciudad».
- Hay intersecciones potenciales en «Cuarteles» (40), «Una fila de dúplex» (302) y «Casas de oficiales» (8).
- Los demás encuadres examinados no tienen candidatos. Los grupos pueden solaparse y las cifras no deben sumarse como edificios únicos.

Intersectar esa envolvente amplia no significa aparecer en pantalla con la altura real. Además, el visor modifica la niebla con el tiempo atmosférico y con la distancia de cámara; no puede descartarse su efecto con un único radio fijo.

## Decisión del piloto

No hay evidencia de mejora en las vistas principales del 106 que justifique incorporar de inmediato las 325 piezas. El piloto queda acotado a la muestra de seis nodos y a vistas de contexto donde pudiera aparecer, especialmente «Una fila de dúplex» y «Cuarteles».

Las seis identidades ya están recuperadas. Antes de una prueba visual dentro del visor, corresponde contrastar alturas y suelo, y resolver la cubierta del nodo 601 por separado. Entonces se puede producir un antes y después en una escena de evaluación, midiendo si se ve y cuánto cuesta dibujarlo. La elección del GLB como fuente sigue siendo revisable: OSM conserva las etiquetas que el exportador descartó.

Para parques, la tarea útil sigue siendo obtener entidades con nombre, límite, fecha y fuente. El código revisado no aporta una capa de parques que se pueda habilitar simplemente. No se cambió el visor ni se integró el GLB durante este paso.

## Reproducir

```sh
python3 docs/ciudad/comparacion-glb/revisar_procedencia.py /Users/luismiguelcaamano/Downloads/ciudadelsaber.glb
node docs/ciudad/comparacion-glb/revisar-encuadres.mjs
python3 docs/ciudad/comparacion-glb/verificar_muestra.py /Users/luismiguelcaamano/Downloads/ciudadelsaber.glb
```

[procedencia-resultados.json](procedencia-resultados.json) conserva reglas contrastadas, muestra y cajas exteriores. [encuadres-exteriores.json](encuadres-exteriores.json) conserva poses, candidatos y huellas de los archivos fuente. El script de procedencia implementa explícitamente las reglas del commit citado; no descarga ni ejecuta map3d. Los supuestos de cámara se documentan en `revisar-encuadres.mjs`.
