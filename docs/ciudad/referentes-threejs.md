# Referentes three.js: ciudades y escenas urbanas en el navegador (2024 a octubre de 2026)

Investigación del 4 de octubre de 2026 para el visor de Ciudad del Saber (antiguo Fort Clayton). El plan ya elegido es: kit de piezas procedural sobre huellas de OSM, techos a cuatro aguas con esqueleto recto, PBR, BatchedMesh con LOD, CSMShadowNode, árboles instanciados con impostores octaédricos y quizás la atmósfera de Takram, todo en three.js 0.186 con WebGPU y WebGL2.

Cada ejemplo trae dirección, fecha, qué muestra, versión y motor de render, técnicas, rendimiento en teléfonos si alguien lo midió, y qué nos sirve. Lo que no pude confirmar en una fuente primaria va marcado **[sin verificar]**. Las fechas y versiones salen de la API de GitHub, de los JSON del foro de three.js o del propio código.

Nota de estilo: los números de versión (r186, 0.19.1) se dejan con punto porque son etiquetas, no números decimales.

## Hallazgo principal

El referente más útil no es un sitio premiado: es el **ejemplo oficial de ciudad procedural de three.js**, que mrdoob añadió en junio de 2026 y mejoró en septiembre, justo antes de r186. Usa casi las mismas piezas que nuestro plan y trae dos que nos faltan: **iluminación global por sondas horneada contra cajas simplificadas** y una **cámara de sombra ajustada a la ciudad según el ángulo del sol**. Además, r186 trae un `SunLight` nuevo con cascadas que compite con CSMShadowNode.

La segunda sorpresa es negativa: las bibliotecas de impostores e instancias de agargaro (las que todo el mundo cita) **no funcionan con WebGPURenderer** todavía, y la atmósfera de Takram tiene errores abiertos reportados en septiembre de 2026 **exactamente sobre nuestra combinación** (r186, WebGPURenderer con backend WebGL2).

## Ejemplos, del más nuevo al más viejo

### 1. Zippy Town (2 de octubre de 2026)

- **Dónde:** [zippy.town](https://zippy.town), [hilo del foro](https://discourse.threejs.org/t/title-zippy-town-a-toy-city-with-live-traffic-day-night-lighting-and-a-scroll-driven-camera/94955).
- **Qué muestra:** ciudad de juguete con tráfico, ciclo día y noche y cámara guiada por scroll.
- **Render:** three.js con EffectComposer, o sea WebGLRenderer; versión **[sin verificar]**.
- **Técnicas:** luz horneada en Blender Cycles, un juego de lightmaps para el día y otro para la noche, mezclados en un ShaderMaterial; el ciclo cuesta casi nada. Los autos "leen" la luz horneada a partir de muestras por tramo de calle, sin luces en tiempo real.
- **Teléfonos:** la versión Android pasó a Filament porque un WebView vacío ya gastaba unos 130 MB y Android recomienda menos de 100 MB para fondos animados. Dato útil sobre presupuesto de memoria en móviles.
- **Para nosotros:** contraejemplo. Hornear sol de día y de noche es barato pero contradice el sol de ERA5. Lo rescatable es la idea de muestrear la luz en puntos para los objetos que se mueven. Ojo: LM ya descartó la AO horneada en archivo (+842 KB, casi invisible), así que tampoco va por ahí.

### 2. Three-geo-play (1 de octubre de 2026)

- **Dónde:** [repo](https://github.com/lorenzoMezza/Three-geo-play), [demo](https://lorenzomezza.github.io/Three-geo-play-demo-website/), [hilo](https://discourse.threejs.org/t/introducing-three-geo-play-a-native-vector-tile-renderer-for-three-js/94910).
- **Qué muestra:** teselas vectoriales convertidas en objetos nativos de three.js (ExtrudeGeometry para edificios) con un gestor de teselas por cámara.
- **Para nosotros:** confirma la tendencia de meter el mapa dentro de la escena para controlar materiales, luz y sombras. Es trabajo en curso y solo extruye: no aporta techos.

### 3. Sector07: maquetas en splats reiluminadas dentro de una ciudad three.js (16 de septiembre de 2026)

- **Dónde:** [sector07.narayaman.workers.dev](https://sector07.narayaman.workers.dev), [hilo](https://discourse.threejs.org/t/two-gunpla-scanned-as-3d-gaussian-splats-relit-inside-a-three-js-city/94407).
- **Qué muestra:** dos maquetas escaneadas como Gaussian Splats dentro de una ciudad generada en three.js.
- **Render:** el autor dice que usa el renderizador de splats nativo de r186 y que cae a WebGL2. En nuestra investigación anterior el splat nativo figuraba como solo WebGPU; esa contradicción queda **[sin verificar]**.
- **Técnicas:** pase propio para **reiluminar** splats que traen luz horneada; como los splats no proyectan sombra, arma un **casco convexo invisible** con las posiciones de los splats y lo usa como emisor de sombra. La pantalla de carga corre en un worker para que no se congele.
- **Para nosotros:** si algún día usamos un escaneo (por ejemplo, un interior o un objeto del museo), el truco del casco convexo como sombra invisible resuelve el problema de que los splats ignoren nuestro sol.

### 4. Ejemplo oficial `webgpu_generator_city` de three.js (24 de junio de 2026, mejorado el 6 de septiembre de 2026)

- **Dónde:** [PR #33817](https://github.com/mrdoob/three.js/pull/33817), [PR #33906](https://github.com/mrdoob/three.js/pull/33906), [código del ejemplo en r186](https://github.com/mrdoob/three.js/blob/r186/examples/webgpu_generator_city.html), [documentación de CityGenerator](https://threejs.org/docs/pages/CityGenerator.html). Demo de la versión mejorada: [raw.githack](https://raw.githack.com/mrdoob/three.js/8e5ca7f64f9db650318ab8b652ae756b6919b085/examples/webgpu_generator_city.html).
- **Qué muestra:** manzanas de rascacielos neogóticos y Beaux Arts de terracota, aceras con bordillo de granito, asfalto mojado, mobiliario urbano, peatones, autos, vitrinas con interiores falsos y toldos.
- **Render:** WebGPURenderer, TSL, r185 y r186.
- **Técnicas que lo hacen creíble:**
  - **Un edificio, una llamada de dibujo.** Cada torre se hornea en una sola BufferGeometry con un atributo `partId` por vértice, y un solo `MeshStandardNodeMaterial` ramifica según ese número (ladrillo, desgaste, vidrio, aires acondicionados). El detalle de cerca y el color por edificio se resuelven por distancia o por vértice para abaratar cada píxel ([PR #33817](https://github.com/mrdoob/three.js/pull/33817)).
  - **Cielo físico que alimenta todo.** `SkyMesh` (turbidez 8, Rayleigh 3) se renderiza a un PMREM y sirve como fondo y como luz ambiental; el sol direccional se alinea con el sol del cielo.
  - **Sondas de luz horneadas contra cajas.** `LightProbeGrid` reparte sondas de armónicos esféricos por la ciudad. Para hornear, esconde la ciudad detallada y muestra `buildProxy()`: **una caja instanciada por torre, en una sola llamada**, que proyecta las mismas sombras de calle y rebota el mismo relleno cálido. Hornea **una fila de sondas por fotograma**, primero luz directa y después rebote, con cubemaps de 16 píxeles. La luz del cielo en las reflexiones baja a 0,05 porque el relleno difuso, ya con oclusión, lo dan las sondas.
  - **Cámara de sombra ajustada.** Un solo mapa de 4096 cuyo frustum se recalcula para que envuelva la caja de la ciudad vista desde el sol actual: los texeles se gastan solo donde puede caer sombra. Usa `normalBias` de 0,05 en vez de `bias`, porque un sesgo de profundidad crece con el rango y borra sombras cortas, como la de un auto.
  - Bloom a un cuarto de resolución, ACES y FirstPersonControls.
- **Teléfonos:** nadie reportó cifras. Un mapa de 4096 y `devicePixelRatio` sin tope no son pensados para móvil.
- **Para nosotros:** es nuestro plan, con tres mejoras listas para copiar (ver "Qué copiar"). Lo que no aplica: los edificios no salen de huellas reales, sino de una cuadrícula.

### 5. Piezas nuevas de three.js r184 a r186 que tocan el plan

No son escenas, pero salen del mismo trabajo y cambian decisiones.

- **`SunLight` con cascadas** ([PR #34259](https://github.com/mrdoob/three.js/pull/34259), 6 de septiembre de 2026; [issue #34221](https://github.com/mrdoob/three.js/issues/34221)). Luz sin `target`, su dirección es su posición. En WebGLRenderer usa cuatro cascadas en un atlas, ajustadas cada fotograma, con ajuste a texel contra el parpadeo y fundido entre cascadas. Para WebGPURenderer es un addon (`SunLightNode`, `SunShadowNode`) que se registra con `renderer.library.addLight`; en r186 el código fija **dos cascadas** de 1024 por lado, con fundido del 10 % y solo PCF (si pides VSM avisa y cae a PCF) ([SunLightShadow.js en r186](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/lights/SunLightShadow.js)). Mugen87 lo describe como más fácil y robusto que el CSM de antes.
- **`LightProbeGrid`** ([PR #33125](https://github.com/mrdoob/three.js/pull/33125), 16 de abril de 2026): horneado completo en GPU, sin lectura a CPU, guardado en una textura 3D con filtro trilineal.
- **`VXGINode`** ([PR #34402](https://github.com/mrdoob/three.js/pull/34402), 31 de agosto de 2026). Mugen87 compara: SSGI es dinámico pero con artefactos de pantalla; las sondas son lo más rápido pero exigen horneado, se filtran y no dan oclusión; VXGI da la mejor calidad, pero **todavía no soporta BatchedMesh**.
- **Niebla de altura** `exponentialHeightFogFactor()` ([ejemplo webgpu_fog_height](https://github.com/mrdoob/three.js/blob/r186/examples/webgpu_fog_height.html), enero de 2026) y **TreeGenerator / ForestGenerator** (junio a septiembre de 2026): árbol por tubos con modelo de tubería, solo ramas; el follaje va aparte ([TreeGenerator.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/generators/TreeGenerator.js)).

### 6. Odessis (2 de septiembre de 2026)

- **Dónde:** [odessis.in](https://odessis.in/), [nota técnica](https://odessis.in/field-notes/city-is-the-portfolio-webgl-world/), [hilo](https://discourse.threejs.org/t/odessis-one-reversible-three-js-city-across-eight-chapters/93981).
- **Qué muestra:** una ciudad griega inventada en una colina, ocho capítulos dentro de una sola geografía continua.
- **Técnicas:** regla de que todo lo visible sea geometría, sin fondos pintados ni imágenes generadas. Una "biblia del mundo" con sus leyes físicas y un registro por capítulo de dónde va la cámara. El scroll nativo controla el estado y la URL; la cámara sigue un valor amortiguado aparte, así los enlaces directos caen exactos.
- **Pruebas:** un registro de capturas en ocho estaciones y siete puntos intermedios, a **1440×900 y 390×844**, y una auditoría que **bloquea WebGL** y comprueba que el contenido sigue funcionando sin el renderizador.
- **Teléfonos:** tope de `devicePixelRatio` en 1,5 y mapa de sombra más chico; el autor dice que es lo que más sigue afinando.
- **Para nosotros:** el registro de capturas en dos tamaños y la prueba sin WebGL encajan con el checklist del modelo y con la regla de credibilidad.

### 7. Pueblito Cordobés (6 de agosto de 2026)

- **Dónde:** [gigazer.com/pueblito](https://gigazer.com/pueblito), [hilo](https://discourse.threejs.org/t/pueblito-cordobes-explore-in-3d-a-beautiful-colombian-town/93339).
- **Qué muestra:** un pueblo de Córdoba (Colombia) con arquitectura tradicional, estilizado.
- **Lección del hilo:** la crítica fue que bancos y edificios se leían como "manchas de un color" desde algunos ángulos por falta de contraste entre caras. Es el fallo típico de geometría procedural con colores planos y luz suave: hace falta variación de valor entre caras y sombras de contacto, que es justo lo que dan las sondas y la oclusión ambiental.
- **Técnica y versión:** **[sin verificar]**.

### 8. Threejs-Punk, de Anderson Mancini y sunag (19 de julio de 2026, revisado para el TSL Workshop 2026)

- **Dónde:** [repo](https://github.com/ektogamat/threejs-conference), [demo](https://threejspunk.vercel.app/).
- **Qué muestra:** callejón cyberpunk con lluvia, piso mojado y neones, en primera persona.
- **Render:** three.js ^0.185, WebGPU y TSL, RenderPipeline.
- **Técnicas:**
  - **Lluvia que respeta techos.** Cada fotograma (o cada N) un pase ortográfico desde arriba escribe en una textura de 512 la altura del punto más alto por columna; un compute shader mueve unas 5000 gotas y las respawnea si caen bajo ese piso ([collision-rain.md](https://github.com/ektogamat/threejs-conference/blob/main/docs/techniques/collision-rain.md)).
  - **Presupuestos por dispositivo** antes de crear el renderizador: DPR máximo 1,5; en teléfonos se apagan GTAO, destellos de lente y carteles; en iPhone y Safari DPR máximo 1,25 y **sin cambio de tamaño adaptativo**, porque redimensionar mientras compila congela Safari WebGPU ([performanceProfile.js](https://github.com/ektogamat/threejs-conference/blob/main/src/platform/performanceProfile.js)). GTAO a media resolución con 6 muestras en escritorio.
  - **DPR adaptativo**: si el promedio cae bajo 50 fps en dos ventanas seguidas, baja la resolución.
  - **Calentamiento de shaders** repartido antes del primer fotograma.
- **Para nosotros:** la lluvia por textura de alturas es la forma barata de que la lluvia de ERA5 no atraviese los aleros, y el perfil por dispositivo es una receta ya probada para teléfonos.

### 9. Takram three-geospatial: atmósfera, nubes y sombras (WebGPU desde noviembre de 2025; @takram/three-atmosphere 0.19.1 del 6 de mayo de 2026)

- **Dónde:** [repo](https://github.com/takram-design-engineering/three-geospatial), [WEBGPU.md](https://github.com/takram-design-engineering/three-geospatial/blob/main/packages/atmosphere/WEBGPU.md), [Storybook WebGPU](https://takram-design-engineering.github.io/three-geospatial-webgpu/) con historias "Cityscape" (Manhattan) y "Non geospatial".
- **Qué muestra:** cielo, perspectiva aérea, luz solar y del cielo físicamente correctas, nubes volumétricas, sobre teselas 3D de Manhattan y Fuji.
- **Render:** dos ramas. La de WebGL depende de `postprocessing`; la de WebGPU es TSL, pide three ≥ 0.182 y se declara "en progreso". Modelo de Bruneton con la LUT de dispersión múltiple de Hillaire, y marcha de rayos entre cámara y objeto que elimina artefactos de precisión.
- **Técnicas de la historia Cityscape:** `AtmosphereLight` (reemplaza sol y sonda de cielo), `aerialPerspective` como post, `CascadedShadowMapsNode` propio, `shadowLength` para rayos de luz, TAA, dithering y AgX ([3DTilesRenderer-Shadows.tsx](https://github.com/takram-design-engineering/three-geospatial/blob/main/storybook-webgpu/src/atmosphere/3DTilesRenderer-Shadows.tsx)). La historia "Non geospatial" muestra que se usa en escenas locales fijando `matrixWorldToECEF`.
- **Riesgos verificados en sus issues:**
  - [#114](https://github.com/takram-design-engineering/three-geospatial/issues/114) (28 de septiembre de 2026): con r186, WebGPURenderer y **backend WebGL2** en Windows (ANGLE D3D11), la LUT de irradiancia sale mal y la cara nocturna queda demasiado clara.
  - [#116](https://github.com/takram-design-engineering/three-geospatial/issues/116) (29 de septiembre de 2026): en WebGL2, un material que lee la LUT antes de que se genere puede quedar atado a una textura borrada; depende del tiempo.
  - [#107](https://github.com/takram-design-engineering/three-geospatial/issues/107) (abierto): en iPhone y iPad, la historia de sombras falla a veces con "GPUCommandEncoder.finish: Unable to finish".
- **Para nosotros:** la perspectiva aérea es lo que separa una maqueta de un paisaje a 1 o 2 km, y la luz sale de una fecha, que es nuestro caso. Pero hoy es un riesgo en WebGL2 y en iOS. Si entra, que sea opcional y solo con backend WebGPU, con SkyMesh como respaldo.

### 10. Building an open world in the browser, parte 19: impostores (Cinevva, 4 de mayo de 2026)

- **Dónde:** [artículo](https://app.cinevva.com/blog/2026-05-04-open-world-browser-part-19-imposters), con demos y código enlazados en cada "spike".
- **Qué muestra:** el nivel de detalle más lejano para bosques: un quad con fotos del árbol.
- **Render:** el material de tiempo de ejecución es `MeshStandardNodeMaterial`, o sea TSL; el impostor recibe el sol y la luz ambiental de la escena.
- **Técnicas:**
  - Dos atlas por árbol: color sin luz (material unlit al hornear) y **normales en espacio mundo**, para que el impostor se reilumine con el sol real.
  - La codificación octaédrica de libro dio desacuerdos entre la CPU y la GPU en los bordes. Primero la cambiaron por azimut por elevación con **un número impar de filas**, para que exista una fila a 0° (con 4×4 las filas quedan en ±22,5° y nadie ve el árbol de frente). Después pasaron a **hemioctaédrico** con **mezcla bilineal de las 4 celdas vecinas** (8 lecturas) y normales renormalizadas: sin saltos al orbitar. Costo: atlas de 12×12 de unos 9 MB y horneado unas 5 veces más largo.
  - Todo por GPU: centro, giro y escala suben una vez como atributos; el vertex shader arma la base del billboard; el único trabajo por fotograma en CPU es copiar la posición de la cámara. Hay que poner una esfera envolvente explícita o three.js recorta el bosque entero.
  - Ubicación en cuadrícula con jitter para garantizar separación mínima.
- **Para nosotros:** es la receta para escribir nuestro propio impostor en TSL, que hace falta porque la biblioteca de agargaro no soporta WebGPU (ver punto 15).

### 11. Thessaloniki Jewish Heritage (3 de abril de 2026)

- **Dónde:** [map.jct.gr](https://map.jct.gr/), [hilo](https://discourse.threejs.org/t/thessaloniki-jewish-heritage-a-3d-interactive-experience/90774).
- **Qué muestra:** reconstrucción 3D de barrios de entreguerras de Salónica que ya no existen, recorrible en vuelo, con documentos de archivo dentro del mundo. También corre como instalación de tres paredes con tres cámaras sincronizadas.
- **Render:** el paquete de producción usa WebGLRenderer, BatchedMesh, InstancedMesh, LOD y FogExp2, y parece ser r174 (lo deduje del código minificado; **[sin verificar]**).
- **Proceso:** 1,5 a 2 años, sobre todo por el archivo; el autor dice que gran parte del trabajo fue "interpretar datos históricos incompletos". Equipo de cuatro: modelador, diseñador de interfaz, guionista de cámara y desarrollador.
- **Crítica recibida:** el post estilizado "de dibujo a mano" distrae; faltaba contexto histórico y fechas.
- **Para nosotros:** es el análogo más cercano (reconstrucción histórica en web, a escala de barrio). La lección es doble: la parte cara es la interpretación de archivo, no el render, y un filtro estilizado resta credibilidad. Ninguno de los dos declara procedencia por edificio; nosotros sí podemos.

### 12. Sunform (13 de junio de 2026)

- **Dónde:** [herramienta](https://www.jakewhitearchitecture.com/sunform), [repo](https://github.com/JakeWhiteArchitecture/sunform).
- **Qué muestra:** horas de sol sobre techos, suelo y fachadas de un modelo IFC, como mapa de calor por píxel.
- **Render:** three.js r128, viejo; el método es lo que vale.
- **Técnicas:** subdivide cada superficie a una arista máxima, lanza un rayo al sol desde cada vértice en cada paso de tiempo con BVH, dentro de un Web Worker. Tiene un **espejo determinista en Python** del mismo cálculo para pruebas, y un aviso explícito de que es una ayuda indicativa, no un estudio normativo.
- **Para nosotros:** ya publicamos "horas de sombra" en el visor; el espejo de pruebas fuera del navegador y el aviso de alcance son dos prácticas de credibilidad que vale la pena copiar.

### 13. Bruno Simon, folio 2025 (repo creado en octubre de 2024; three ^0.183.2)

- **Dónde:** [bruno-simon.com](https://bruno-simon.com), [repo](https://github.com/brunosimon/folio-2025), [caso en Awwwards](https://www.awwwards.com/brunos-portfolio-case-study.html). Fecha de lanzamiento **[sin verificar]**.
- **Qué muestra:** un mundo para recorrer en auto con clima, ciclos de día y año, viento, pasto, hojas, lluvia, nieve y agua.
- **Render:** WebGPURenderer con TSL y RenderPipeline.
- **Técnicas:** dos niveles de calidad por agente de usuario: en teléfono, mapa de sombra de **512** en vez de 2048, bloom con 2 niveles en vez de 5 y sin profundidad de campo. La sombra sigue a un "área óptima" alrededor de la cámara. Hay un orden explícito de sistemas por fotograma: ciclos, luego clima, luego viento, luego todo lo que depende del viento ([readme](https://github.com/brunosimon/folio-2025/blob/main/readme.md), [Quality.js](https://github.com/brunosimon/folio-2025/blob/main/sources/Game/Quality.js), [Ligthing.js](https://github.com/brunosimon/folio-2025/blob/main/sources/Game/Ligthing.js)).
- **Para nosotros:** la cadena ciclo, clima, viento es el mismo orden que necesitamos con ERA5. La niebla es un degradado radial de pantalla, puro efecto, justo lo que no queremos.

### 14. Bosque procedural instanciado de red-reddington (11 de diciembre de 2025)

- **Dónde:** [hilo](https://discourse.threejs.org/t/procedural-instanced-forest-high-performance-real-trees/88610), [CodePen](https://codepen.io/the-red-reddington/full/JoXxmzY), [versión con recorte por árbol](https://codepen.io/the-red-reddington/full/NPNJdoV).
- **Técnicas:** solo dos llamadas de dibujo (corteza y hojas). LOD en el vertex shader: las hojas lejanas se mandan fuera del recorte; las hojas se encogen con la distancia y la corteza se tiñe de verde para disimular el cambio. Para teléfonos añadió recorte por árbol en CPU que reordena las instancias visibles al frente del búfer, recalculado solo si la cámara se mueve más de 0,5 unidades o gira más de 0,01 rad.
- **Para nosotros:** el disimulo del cambio de nivel (encoger hojas y teñir corteza) sirve para pasar de árbol 3D a impostor sin fundido.

### 15. Bosque de impostores octaédricos de agargaro (1 de agosto de 2025)

- **Dónde:** [demo](https://octahedral-impostor.vercel.app), [repo](https://github.com/agargaro/octahedral-impostor), [hilo](https://discourse.threejs.org/t/a-forest-of-octahedral-impostors/85735).
- **Qué muestra:** terreno de 3072×3072 con 200.000 árboles; el autor dice que anda bien en teléfonos.
- **Técnicas:** terreno con BatchedMesh y LOD generados con meshoptimizer; árboles con InstancedMesh2 y BVH para recorte; LOD intermedio de 15 a 100 unidades y impostor desde 100. En el hilo, Usnul explica que si el reemplazo ocurre cuando el objeto ocupa en pantalla igual o menos que la resolución horneada, no hace falta fundido.
- **Límite verificado:** la biblioteca de impostores dice "wip" y no se toca desde noviembre de 2025. InstancedMesh2 tiene abiertos los issues de soporte WebGPU [#131](https://github.com/agargaro/instanced-mesh/issues/131) y [#154](https://github.com/agargaro/instanced-mesh/issues/154), y las extensiones de BatchedMesh marcan los uniformes por instancia como **solo WebGLRenderer**.
- **Para nosotros:** la arquitectura (BVH, LOD de sombra, impostor desde cierta distancia) es buena, pero no podemos usar estas bibliotecas tal cual en WebGPU.

### 16. Messenger, de Abeto (lanzado en 2025; mes **[sin verificar]**)

- **Dónde:** [messenger.abeto.co](https://messenger.abeto.co), [80.lv](https://80.lv/articles/deliver-mail-on-tiny-colorful-planet-in-this-relaxing-web-game).
- **Qué muestra:** planeta pequeño con pueblo, entrega de cartas, multijugador. Estilo de animé con sombreado plano; modelado en Houdini y Blender; WebGL con three.js; anda bien en teléfonos según la prensa.
- **Para nosotros:** referencia de dirección de arte y rendimiento móvil, no de credibilidad. Su luz es de autor, no de datos.

### 17. 3D BAG viewer (activo; última subida el 28 de septiembre de 2026)

- **Dónde:** [3dbag.nl](https://3dbag.nl), [repo](https://github.com/3DBAG/3dbag-viewer).
- **Render:** three 0.185.1 con 3d-tiles-renderer 0.5.2 y WebGLRenderer.
- **Técnicas:** luz puntual y direccional **pegadas a la cámara** (luz de minero), luz ambiental y FogExp2 apagada por defecto. Hay un plugin de estilo semántico que colorea por atributo, y avisos honestos como "acércate para ver edificios" o "cargando edificios" que distinguen entre "no hay datos" y "todavía no llegaron" ([SemanticStylingPlugin.js](https://github.com/3DBAG/3dbag-viewer/blob/main/src/utils/SemanticStylingPlugin.js), [buildingNotice.js](https://github.com/3DBAG/3dbag-viewer/blob/main/src/utils/buildingNotice.js)).
- **Para nosotros:** el visor de datos más serio del grupo renuncia al sol a propósito. Nosotros no podemos, porque el sol es el contenido, pero sí copiar el modo "colorear por procedencia" y los avisos de estado.

### 18. streets.gl (sin cambios desde agosto de 2025)

- **Dónde:** [streets.gl](https://streets.gl), [repo](https://github.com/StrandedKitty/streets-gl).
- **Render:** no es three.js. Usa su propia capa sobre WebGL2 con un grafo de render. Lo incluyo porque es la mejor ciudad OSM con buen aspecto en el navegador.
- **Técnicas:** sombreado diferido PBR, CSM propio, TAA, SSAO con reproyección, atmósfera con perspectiva aérea a partir de LUTs, árboles instanciados con textura generada. Techos: 17 constructores, entre ellos a cuatro aguas sobre esqueleto recto. Si el edificio trae `roof:angle`, la altura del techo se calcula como la altura máxima del esqueleto por la tangente del ángulo ([HippedRoofBuilder.ts](https://github.com/StrandedKitty/streets-gl/blob/dev/src/lib/tile-processing/tile3d/builders/roofs/HippedRoofBuilder.ts)).
- **Teléfonos:** su README pide WebGL2 y "probablemente" una GPU dedicada para ir fluido.
- **Para nosotros:** la fórmula de la pendiente es exacta para nuestros techos si medimos la pendiente en las fotos o en los planos del CERL. Su conjunto de efectos es el techo de lo posible, no el piso móvil.

### 19. Otros, en una línea

- **Mini Tokyo 3D** ([repo](https://github.com/nagix/mini-tokyo-3d)): Mapbox GL 3.32 más three 0.183.2 para los trenes; activo en octubre de 2026. Muestra el camino de "capa three.js sobre un mapa", que no seguimos.
- **Giro3D 2.0.4** (31 de agosto de 2026, [npm](https://www.npmjs.com/package/@giro3d/giro3d)) e **iTowns** ([repo](https://github.com/iTowns/itowns)): SIG sobre three.js, con 3D Tiles y nubes de puntos. Giro3D declara three ^0.180 como dependencia. Sirven para datos, no para luz realista.
- **osm2threejs** (PyPI, de agosto a septiembre de 2026, [GitLab](https://gitlab.com/geospacephilo/osm2threejs)): techos a cuatro aguas y otros desde etiquetas OSM, altura por `building:levels` × 3,2 m, y doce temas visuales. Útil como comparación, no como base.
- **Mapbox Standard 3D**: no es three.js; no lo revisé en esta ronda **[sin verificar]**.
- **Estudios (Lusion, Active Theory, Immersive Garden, 14islands, Resn):** no encontré escenas de ciudad con código inspeccionable entre 2024 y 2026. Lo único fechado fue el caso de Immersive Garden de marzo de 2025 en Awwwards, con bajorrelieves, no ciudades **[sin verificar]**. Codrops publicó en agosto de 2026 "Exploring Procedural Geometry with Three.js and WebGPU", pero Cloudflare bloqueó la lectura **[sin verificar]**.

## Qué copiar

Ordenado de mayor a menor impacto en credibilidad por esfuerzo.

1. **Sondas de luz horneadas contra cajas simples** (ejemplo oficial de ciudad, punto 4). `LightProbeGrid` sobre el campus, horneado contra las huellas extruidas como cajas en una sola InstancedMesh, una fila por fotograma, cubemaps de 16, re-horneado cuando cambia el sol. Se calcula en el navegador con el sol de ERA5 del momento, sin archivos horneados, así que no choca con la AO horneada que LM descartó. Es la luz del cielo con oclusión que oscurece portales, bajo aleros y calles angostas, y es lo que les faltó a Pueblito Cordobés y a cualquier maqueta procedural plana.
2. **Un material por tipología con `partId` por vértice** (punto 4). BatchedMesh exige un solo material: muros, techo, alero, persianas y vanos se distinguen con un atributo entero y un `MeshStandardNodeMaterial` que ramifica. El detalle fino se apaga por distancia.
3. **Cámara de sombra ajustada a lo visible según el sol, con `normalBias`** (punto 4), o bien **`SunLight` de r186** (punto 5). Hay que probar ambas contra CSMShadowNode en un teléfono real: SunLight es más simple, pero en WebGPU trae dos cascadas fijas y solo PCF.
4. **Perfil por dispositivo antes de crear el renderizador** (Threejs-Punk, punto 8; Bruno, punto 13; Odessis, punto 6): DPR máximo 1,5 (1,25 en iOS), GTAO apagado en teléfonos, mapa de sombra de 512 a 1024 en móvil, sin cambio de tamaño adaptativo en Safari, y DPR adaptativo con umbral de 50 fps confirmado en dos ventanas.
5. **Impostor propio en TSL** según la receta de Cinevva (punto 10): atlas de color sin luz más normales del mundo; hemioctaédrico con mezcla de 4 celdas, o azimut por elevación con número impar de filas; billboards totalmente en GPU; esfera envolvente explícita. Para el cambio de 3D a impostor, el criterio de Usnul (reemplazar cuando el tamaño en pantalla sea igual o menor que el horneado) y el disimulo de red-reddington.
6. **Pendiente del techo desde el ángulo** (streets.gl, punto 18): altura = altura máxima del esqueleto × tan(pendiente), con la pendiente medida en fuente primaria y guardada como dato con procedencia.
7. **Lluvia con textura de alturas** (Threejs-Punk, punto 8): un pase ortográfico desde arriba y un compute shader. La lluvia de ERA5 deja de caer bajo los aleros sin raycasts.
8. **Registro de capturas en 1440×900 y 390×844, y prueba con WebGL bloqueado** (Odessis, punto 6), sumado al `estado.mjs --comprobar` que ya existe.
9. **Espejo determinista del cálculo de sol fuera del navegador y aviso de alcance** (Sunform, punto 12) para las horas de sombra y el sol del visor.
10. **Modo "colorear por procedencia" y avisos de estado de datos** (3D BAG viewer, punto 17).
11. **Perspectiva aérea de Takram solo con backend WebGPU** (punto 9), detrás de un interruptor y con SkyMesh como respaldo, mientras sigan abiertos los issues #107, #114 y #116.
12. **Casco convexo invisible como emisor de sombra** para cualquier escaneo o splat que entre a la escena (Sector07, punto 3).

## Qué cambia en el plan

- **Se agrega una capa de iluminación indirecta.** El plan tenía sol, sombras y quizás atmósfera, pero no decía de dónde sale la luz del cielo con oclusión. Propuesta: `LightProbeGrid` horneada contra cajas de las huellas, de forma incremental. Se descarta VXGI porque todavía no soporta BatchedMesh, y SSGI en teléfonos por costo y artefactos.
- **CSMShadowNode deja de ser la única opción.** Hay que comparar en un teléfono real tres variantes: CSMShadowNode, `SunLight` de r186 y un solo mapa ajustado a lo visible (como el ejemplo oficial). Desde arriba, para todo el campus, la tercera puede bastar; a nivel de calle mandan las cascadas.
- **Impostores: se construyen, no se instalan.** `@three.ez/octahedral-impostor` está sin terminar e InstancedMesh2 no soporta WebGPU. Usamos BatchedMesh e InstancedMesh nativos con LOD propio, y un impostor TSL escrito según la receta de Cinevva. Si el plazo aprieta, el plan B son billboards en cruz con normales horneadas.
- **Takram pasa de "posible" a "opcional, solo WebGPU".** Sus errores abiertos de septiembre de 2026 afectan justo a r186 con backend WebGL2 e iOS. La perspectiva aérea puede esperar a una segunda fase; mientras tanto, `exponentialHeightFogFactor()` con color tomado del cielo y densidad fija declarada.
- **El kit de piezas se modela como "un material por tipología".** Cada barraca o casa se hornea con `partId`, en línea con el SkyscraperGenerator. Esto también simplifica el LOD: el nivel lejano es la misma caja que se usa para hornear las sondas.
- **No hornear el sol.** Zippy Town y los lightmaps de día y noche son el contraejemplo: baratos pero falsos frente a ERA5. Tampoco vuelve la AO horneada en archivo, que LM ya descartó. Las sondas del punto 1 no son eso: se calculan en el navegador con el sol del momento y no pesan nada en la descarga.
- **El presupuesto móvil se fija antes de modelar.** DPR, tamaño de sombra, AO apagado y tope de memoria (la experiencia de Zippy Town con 130 MB en un WebView es una advertencia) se escriben en el perfil desde el día uno, no al final.
- **La credibilidad tiene su propia prueba.** Al checklist se suman el registro de capturas en dos tamaños, la prueba sin WebGL y el espejo del cálculo solar, que ninguna de las escenas bonitas tiene y que el proyecto de Salónica, el más parecido al nuestro, tampoco declara.
