# Referentes: ciudades reconstruidas en 3D con detalle por edificio

Investigación del 4 de octubre de 2026 para reconstruir toda Ciudad del Saber (antiguo Fort Clayton) en el visor. Cada afirmación lleva su fuente. Lo que no pude confirmar en una fuente primaria va marcado como **[sin verificar]**.

Nota de estilo: los nombres de niveles de detalle (LoD1.2, LoD2.2, LOD3.0) se dejan con punto porque son etiquetas oficiales de los estándares, no números decimales.

## 1. Tokio y Japón: Project PLATEAU (MLIT)

**Qué es.** Programa del Ministerio de Territorio de Japón, iniciado en 2020, que publica modelos 3D urbanos abiertos de más de 250 ciudades ([ISPRS Annals 2025](https://isprs-annals.copernicus.org/articles/X-4-W6-2025/89/2025/isprs-annals-X-4-W6-2025-89-2025.pdf)). Usa CityGML más una extensión propia, i-UR, para atributos urbanos japoneses ([Manual estándar de operación](https://www.mlit.go.jp/plateau/file/libraries/doc/plateau_doc_0002_ver05.pdf)).

**Vocabulario de LOD.** LOD1 es la huella extruida con altura uniforme; LOD2 refina el techo; LOD3 refina las fachadas; LOD4 describe el interior ([ISPRS Annals 2025](https://isprs-annals.copernicus.org/articles/X-4-W6-2025/89/2025/isprs-annals-X-4-W6-2025-89-2025.pdf)). Lo valioso es que PLATEAU parte LOD3 en subniveles con **umbrales medibles**: LOD3.0 representa techos cuyo lado corto mide 3 m o más y vanos (puertas, ventanas) con lado corto de 1 m o más; LOD3.1 y LOD3.2 bajan esos umbrales a 1 m o 1 m² ([LOD3.0](https://www.mlit.go.jp/plateaudocument/toc4/toc4_02/toc4_02_01/toc4_02_01_04/_dc6c7af3-ee5b-bfef-92bf-b258de2751ab), [LOD3.1](https://www.mlit.go.jp/plateaudocument/toc4/toc4_02/toc4_02_01/toc4_02_01_04/_de177dc4-f790-071f-f164-8f4f9cc07ffb), [LOD3.2](https://www.mlit.go.jp/plateaudocument/toc4/toc4_02/toc4_02_01/toc4_02_01_04/_c4868258-515b-6da1-8ba8-96c1e01bbd3c)). LOD3 se apoya en datos tomados desde el costado, como nubes de puntos y fotos de vehículos de mapeo móvil ([resumen LOD3](https://www.mlit.go.jp/plateaudocument/toc4/toc4_02/toc4_02_01/toc4_02_01_04/_da554178-d7ce-cbf3-bd20-7834e9359422)).

**Cómo hicieron techos y texturas a escala ciudad.** PLATEAU recomienda que el LOD2 lleve texturas fotográficas; en Japón se producen sobre todo con fotos aéreas nadirales por costo, porque las oblicuas dan más resolución en fachada pero sufren oclusión ([ISPRS Annals 2025](https://isprs-annals.copernicus.org/articles/X-4-W6-2025/89/2025/isprs-annals-X-4-W6-2025-89-2025.pdf)). El MLIT también desarrolló y liberó una herramienta de generación automática de LOD2 con IA ([informe técnico 0056](https://www.mlit.go.jp/plateau/file/libraries/doc/plateau_tech_doc_0056_ver01.pdf)); el nombre exacto del repositorio en GitHub queda **[sin verificar]**.

**Procedencia por atributo: lo mejor de PLATEAU para nosotros.** Cada objeto puede llevar `uro:DataQualityAttribute` con fuente de la geometría **por LOD** (`geometrySrcDescLod0` a `Lod4`), fuente de los atributos temáticos (`thematicSrcDesc`), **fuente de la apariencia por LOD** (`appearanceSrcDescLod0` a `Lod4`), escala de origen por LOD (`srcScaleLod*`) y el método con que se obtuvo la altura LOD1 (`lod1HeightType`), todo con listas de códigos cerradas ([definición oficial](https://www.mlit.go.jp/plateaudocument01-02/contents/1/uro_DataQualityAttribute.html)). Es decir: un mismo edificio puede declarar que su volumen viene de un levantamiento y su textura de una foto aérea.

**Visor y salida.** PLATEAU VIEW corre sobre CesiumJS dentro de Re:Earth y su código es abierto ([Cesium blog](https://cesium.com/blog/2023/07/31/reearth-cesiumjs-intuitive-data-visualization/), [PLATEAU VIEW](https://www.mlit.go.jp/plateau/plateau-view-app/), [GitHub](https://github.com/Project-PLATEAU/PLATEAU-VIEW)). Los datos se distribuyen en CityGML, 3D Tiles, GeoPackage, FBX y OBJ bajo CC BY 4.0, ODbL u ODC-BY ([wiki OSM sobre PLATEAU](https://wiki.openstreetmap.org/wiki/MLIT_PLATEAU), [política del sitio](https://www.mlit.go.jp/plateau/site-policy/)). Hay SDK para Unity y Unreal; Silicon Studio mostró cómo vestir PLATEAU proceduralmente para juegos ([CEDEC 2023](https://www.siliconstudio.co.jp/rd/presentations/files/CEDEC2023/CEDEC2023_Procedural_PLATEAU.pdf)).

**Por qué se ve real o no.** Las texturas aéreas nadirales dan techos creíbles pero fachadas borrosas o estiradas: es el límite que el propio paper describe. Fallo típico: luz y sombra horneadas en la foto, que chocarían con nuestro sol de ERA5.

## 2. Nueva York

**NYC 3D Building Model (DoITT, hoy OTI).** Todos los edificios presentes en 2014, construidos a partir del vuelo aéreo de DoITT de ese año, con estructura de techo y más detalle en algunos edificios icónicos ([data.gov](https://catalog.data.gov/dataset/3-d-building-model)). City Planning lo convirtió a Rhino (.3dm) y lo partió en los 59 distritos comunitarios con capas de lotes, calles y parques ([NYC Planning](https://www.nyc.gov/site/planning/data-maps/open-data/dwn-nyc-3d-model-download.page), [data.gov por distrito](https://catalog.data.gov/dataset/nyc-3d-model-by-community-district)). Antes, AppGeo había hecho un modelo de masas de toda la ciudad con FME ([Safe Software](https://fme.safe.com/fme-in-action/customers/appgeo/)). El método fotogramétrico exacto y la precisión vertical no aparecen en lo que pude leer: **[sin verificar]**; el PDF de metadatos ([NYC Planning](https://www.nyc.gov/assets/planning/download/pdf/data-maps/open-data/nyc-3d-model-metadata.pdf)) no se dejó descargar.

**Versión CityGML LoD2 de TUM.** La Cátedra de Geoinformática de la TU Múnich integró más de 30 datasets abiertos de NYC en un solo modelo CityGML LoD2, con más de 500.000 objetos de espacio vial en 11 clases (calzadas, aceras, estacionamientos) y publicó los flujos FME ([TUM](https://www.asg.ed.tum.de/en/gis/news/article/improved-virtual-3d-city-model-of-new-york-city-in-citygml-lod2-available-as-open-data), [GitHub tum-gis](https://github.com/tum-gis/3d-model-new-york-city)). Lección: el suelo (aceras, bordillos, parqueos) pesa tanto como los edificios en la sensación de realidad.

**Reconstrucción de techos desde LiDAR en NYC.** NYC tiene un levantamiento LiDAR de 2017 y existen métodos académicos de techos desde LiDAR, pero no encontré un modelo oficial de techos de NYC derivado de él: **[sin verificar]**. Para nuestro caso no aplica: no tenemos LiDAR de Clayton.

**Demos web.** El demo de NYC de Cesium usa OSM convertido a 3D Tiles en un paso previo, con herramientas de conversión cerradas ([foro Cesium](https://community.cesium.com/t/source-code-for-new-york-city-using-osm-data/5655)); Cesium OSM Buildings cubre más de 350 millones de edificios con metadatos por edificio ([Cesium](https://cesium.com/platform/cesium-ion/content/cesium-osm-buildings/)). Las vistas "hiperreales" de NYC en web son las teselas fotorrealistas de Google, que ya descartamos por luz horneada y términos de uso.

**Por qué se ve real o no.** El modelo DoITT es geometría limpia sin textura: correcto pero de maqueta blanca. La sensación de realidad en NYC la dan las mallas fotogramétricas, justo lo que no podemos usar.

## 3. Otros referentes

### 3D BAG (Países Bajos): la vara de medir en calidad declarada

Modelos 3D automáticos de los 10 millones de edificios del país en LoD1.2, LoD1.3 y LoD2.2, con atributos como año de construcción y tipo de techo ([GIM International](https://www.gim-international.com/content/article/3dbag-automatically-generated-3d-models-of-10-million-buildings)). Se reconstruyen con roofer, de TU Delft ([GitHub roofer](https://github.com/3DBAG/roofer)); método en [Peters et al., arXiv 2201.01191](https://arxiv.org/pdf/2201.01191). Los LoD x.y vienen de la especificación refinada de 16 niveles de Biljecki, Ledoux y Stoter, pensada para quitar ambigüedad a CityGML ([TU Delft](https://3d.bk.tudelft.nl/lod), [paper](https://3d.bk.tudelft.nl/hledoux/pdfs/16_ceus_lod_specs.pdf)).

Lo que hay que copiar está en su esquema de atributos ([docs.3dbag.nl](https://docs.3dbag.nl/en/schema/attributes/)), que verifiqué uno por uno:

- `b3_rmse_lod22`: error cuadrático medio, en metros, entre la nube de puntos y el modelo.
- `b3_val3dity_lod22`: lista de errores de validez geométrica; vacía significa sólido válido.
- `b3_pw_bron` y `b3_pw_datum`: qué nube de puntos se usó y de qué año.
- `b3_pw_selectie_reden`: por qué se eligió esa fuente (por ejemplo, la más reciente pero desactualizada).
- `b3_pw_onvoldoende`: la fuente no alcanzó para modelar.
- `b3_extrusie`: método usado; `lod11_fallback` cuando solo hubo una extrusión simple.
- `b3_dak_type`: tipo de techo, incluyendo `unknown` y `no points`.
- `b3_mutatie_ahn4_ahn5`: cambio detectado entre dos vuelos.
- `b3_kwaliteitsindicator`: un booleano que resume todo lo anterior en "reconstrucción correcta" o "posiblemente incorrecta".

Ese último es la idea central: una fórmula pública que convierte métricas en un sí o no por edificio.

### Helsinki: modelo dual

Helsinki publicó a la vez un modelo semántico CityGML (LoD1 y LoD2, con techos y muros etiquetados) y un modelo de malla de realidad hecho con más de 42.000 fotos aéreas a unos 7,5 cm por píxel ([HRI](https://hri.fi/en_gb/new-generation-city-information-models-for-helsinki), [avoindata](https://avoindata.fi/data/en/dataset/helsingin-3d-kaupunkimalli)). Lección: separar el modelo que **sabe** (semántico, calculable) del modelo que **parece** (malla). Nosotros hacemos lo mismo al revés: el modelo semántico es el que se ve, y las fotos quedan como referencia.

### Virtual Singapore

Proyecto de 73 millones de dólares con Dassault Systèmes; LiDAR aéreo y móvil, más de 3 millones de imágenes en 5.500 km de vías ([GovTech](https://www.govtech.com/fs/Virtual-Singapore-Is-More-Than-Just-a-3-D-Model-Its-an-Intelligent-Rendering-of-the-City.html)). La parte transferible es la ETH Zúrich: un sistema de LoD3 que combina fuentes y deja **edición interactiva humana** donde el automático falla ([ETH Research Collection](https://research-collection.ethz.ch/handle/20.500.11850/409483), [ISPRS 2018](https://isprs-archives.copernicus.org/articles/XLII-4-W10/55/2018/)).

### Zúrich y Viena: techos por prototipo

Zúrich publica su modelo de techos LoD2 por año ("Jahresstand" 2011, 2013, 2015, 2018) ([opendata.swiss](https://ckan.opendata.swiss/dataset/3d-dachmodell-lod2-jahresstand-2018-3d)). Lección: versionar por fecha de estado, no solo por fecha de publicación. Viena es aún más cercana a nuestro caso: tiene un modelo de techos generalizado (LOD2.1) con **formas prototípicas simples** captadas de forma semiautomática para todos los edificios, y un modelo detallado (LOD2.4) que se hace solo por proyecto ([wien.gv.at](https://www.wien.gv.at/stadtentwicklung/stadtvermessung/geodaten/dachmodell/)). Es exactamente nuestra estrategia: tipos estándar de cuartel para todo, detalle fino donde haya fuentes.

### Berlín: LoD2 texturizado

Unos 550.000 edificios LoD2 en 890 km², texturizados automáticamente con fotos aéreas oblicuas, abiertos en CityGML ([Berlin Partner](https://berlin-partner.de/en/press/detail/new-3d-city-model-from-the-business-location-center), [portal de descarga](https://www.businesslocationcenter.com/en/economic-atlas/download-portal)). Funciona desde el aire; a nivel peatón, las texturas oblicuas se deshacen. Mismo choque con luz dinámica.

### OSM en el navegador: streets.gl, OSM2World, Blosm

streets.gl está escrito en TypeScript sobre WebGL2, genera geometría al vuelo según Simple 3D Buildings, con PBR diferido, hora del día, TAA y SSAO ([GitHub](https://github.com/strandedkitty/streets-gl), [wiki OSM](https://wiki.openstreetmap.org/wiki/Streets_GL)). OSM2World permite texturas por material pero no por edificio ([foro OSM](https://community.openstreetmap.org/t/requesting-osm2world-support-adding-custom-building-roof-and-texture-images/101113)). Blosm aplica texturas repetibles con UV en su versión de pago ([Gumroad](https://prochitecture.gumroad.com/l/blender-osm), [GitHub](https://github.com/vvoovv/blosm)). Fallo común: sin datos de fachada, todo edificio recibe la misma textura de "material" y la ciudad parece genérica.

### CityEngine, Pompeya y Rome Reborn: gramáticas e incertidumbre

La gramática CGA de Müller y colegas (SIGGRAPH 2006) se mostró reconstruyendo Pompeya ([historia SIGGRAPH](https://history.siggraph.org/?p=113547)), ajustando modelos de vivienda romana a las huellas excavadas ([DH abstracts](https://dh-abstracts.library.virginia.edu/works/1839)). La sintaxis clave es el split repetido de fachada: pisos con altura propia, y en cada piso un borde de muro fijo más mosaicos de ancho flexible `{ ~tile_width : Tile }*` que se ajustan para llenar sin huecos ([CityEngine Tutorial 7](https://doc.arcgis.com/en/cityengine/latest/tutorials/tutorial-7-facade-modeling.htm)).

Rome Reborn divide los edificios en **Clase I** (monumentos con evidencia, modelados a mano) y **Clase II** (los cerca de 7.000 edificios domésticos, menos seguros, hechos con CityEngine); la generación de toda la ciudad tardó 1 h 55 min ([Digital Classicist](https://wiki.digitalclassicist.org/Rome_Reborn), [ProVideo Coalition](https://www.provideocoalition.com/cityengine_generates_rome_inone_day/), [CAA](https://proceedings.caaconference.org/?p=4933)). Esa separación por clases es honestidad epistemológica aplicada. El marco normativo lo dan la Carta de Londres (fuentes identificadas y evaluadas de forma documentada, información suficiente para evaluar métodos y resultados) ([londoncharter.org](https://londoncharter.org/principles.html)) y los Principios de Sevilla para patrimonio arqueológico ([CIPA](https://www.cipaheritagedocumentation.org/wp-content/uploads/2018/12/L%C3%B3pez-Menchero-Grande-The-principles-of-the-Seville-Charter.pdf)).

### Microsoft Flight Simulator y Blackshark.ai

Blackshark detecta huellas desde imagen satelital, clasifica techos y estima alturas con modelos dedicados, y se apoya en alturas promedio por tipo de zona ([TechCrunch](https://techcrunch.com/2020/08/17/meet-the-startup-that-helped-microsoft-build-the-world-of-flight-simulator), [docs Orca](https://orca-docs.blackshark.ai/userdocs/containers)). Reconstruyó unos 1.500 millones de edificios ([FSElite](https://fselite.net/content/microsoft-flight-simulator-partnership-update-with-blackshark-ai/)). Por qué se ve genérico: la fachada se infiere, no se observa; los usuarios piden variantes regionales de arquitectura y se quejan de repetición y de que de costado no se parecen al edificio real ([foro MSFS](https://forums.flightsimulator.com/t/expand-on-regional-architecture-blackshark-ai/491757), [foro fotogrametría](https://forums.flightsimulator.com/t/best-examples-of-photogrammetry-in-msfs/560774/25)). Lección para nosotros: un kit sin tipología local verificada produce el mismo efecto.

### Juegos: Spider-Man y Assassin's Creed

Insomniac presentó en GDC 2019 dos charlas: el postmortem técnico (streaming, iluminación, herramientas procedurales para "marcar" Manhattan) y "Procedurally Crafting Manhattan", que insiste en que la salida procedural debe admitir **pulido manual** sin que una regeneración lo borre ([Game Developer](https://www.gamedeveloper.com/design/swing-by-gdc-and-learn-about-the-making-of-i-marvel-s-spider-man-i-from-top-to-bottom), [GDC Vault 1026496](https://gdcvault.com/play/1026496), [GDC Vault 1025765](https://www.gdcvault.com/play/1025765), [80.lv](https://80.lv/articles/marvels-spider-man-a-technical-postmortem)). Qué charla corresponde a cada ID del Vault: **[sin verificar]**. De Assassin's Creed Unity solo pude confirmar que se usó generación procedural de distribuciones de edificios ([TheSixthAxis](https://www.thesixthaxis.com/2014/07/22/ac-unitys-paris-bigger-ac3s-entire-frontier/)) y que Ubisoft invierte en herramientas Houdini de construcción de mundo ([SideFX](https://www.sidefx.com/community/houdini-hive-gamedev-presentations/)); los detalles del kit de Unity quedan **[sin verificar]**.

### Mapbox

Mapbox Standard ofrece hitos 3D con ventanas, muros y techos estilizados que responden a la luz dinámica, edificios que aparecen con fundido al entrar en vista y oclusión ambiental barata en la base ([Mapbox blog](https://www.mapbox.com/blog/standard-core-style), [actualización](https://www.mapbox.com/blog/mapbox-style-updates-more-flexible-configurations-for-the-3d-basemap)). En State of the Map Europe 2025 explicaron que clasifican la forma del techo combinando huellas OSM con imagen aérea y generan fachadas según la orientación a la calle más cercana ([pretalx SotM EU 2025](https://pretalx.com/sotmeu2025/talk/Z8VSHM/)). Lección: la orientación a la calle es una regla barata y buena para decidir dónde va la fachada principal y el porche.

## 4. Patrones transversales

- **Qué hace que se vea real.** Tres cosas, en este orden: proporción correcta (altura de piso, alero, pendiente), sombra y oclusión coherentes, y variación local (desgaste, vegetación, suelo). La textura fotográfica ayuda desde el aire pero estorba con sol dinámico.
- **De dónde sale el detalle.** Los proyectos serios separan lo observado (LiDAR, levantamiento, foto) de lo inferido (tipología, reglas). Los que no lo separan (MSFS) pierden credibilidad apenas un usuario conoce el lugar.
- **Procedencia.** PLATEAU la declara por LOD y por capa (geometría, atributos, apariencia); 3D BAG la mide y la resume en un sí o no; Rome Reborn la reduce a clases visibles.
- **LOD.** Niveles con umbrales numéricos (PLATEAU LOD3.x, Biljecki LoD x.y) evitan discusiones de "cuánto detalle es LOD3".
- **Rendimiento web.** 3D Tiles con jerarquía espacial (PLATEAU, Cesium), fundido de aparición (Mapbox), geometría generada en el cliente a partir de datos livianos (streets.gl).

## 5. Lo mejor de cada uno: técnicas que debemos adoptar

Ordenadas por impacto en credibilidad dividido por costo. "Costo" es una estimación de esfuerzo propia, no viene de las fuentes.

1. **Procedencia por capa y por LOD, al estilo `uro:DataQualityAttribute`.** Cada edificio declara por separado la fuente de su huella, su altura, su techo, su fachada y sus materiales (por ejemplo: huella OSM, altura Open Buildings, techo del informe de 2000, fachada por tipología). Por qué: es la credibilidad hecha dato y alimenta la interfaz. Costo: bajo, es un esquema JSON. Fuente: [PLATEAU](https://www.mlit.go.jp/plateaudocument01-02/contents/1/uro_DataQualityAttribute.html).
2. **Semáforo de calidad por edificio con fórmula pública, como `b3_kwaliteitsindicator`.** Por ejemplo: verde si huella y altura cuadran entre fuentes dentro de una tolerancia y el tipo está confirmado por foto; ámbar si el tipo se infiere; rojo si hay conflicto. Publicar la fórmula. Costo: bajo. Fuente: [3D BAG](https://docs.3dbag.nl/en/schema/attributes/).
3. **Clases de certeza visibles, como Rome Reborn, ancladas en la Carta de Londres.** Clase I: edificios con documentación propia (el 106, la capilla). Clase II: cuarteles por tipología estándar. Clase III: edificios nuevos o sin datos, en volumen simple. Un modo de vista que tiña por clase. Costo: bajo a medio. Fuentes: [Digital Classicist](https://wiki.digitalclassicist.org/Rome_Reborn), [Carta de Londres](https://londoncharter.org/principles.html).
4. **Vocabulario de LOD con umbrales numéricos.** Adoptar LoD1.2, LoD2.2 y una versión propia de LOD3.0 con umbral explícito (por ejemplo, vanos de lado corto mayor o igual a 1 m). Así sabemos qué significa "detalle real" en cada edificio. Costo: bajo. Fuentes: [Biljecki y otros](https://3d.bk.tudelft.nl/lod), [PLATEAU LOD3.0](https://www.mlit.go.jp/plateaudocument/toc4/toc4_02/toc4_02_01/toc4_02_01_04/_dc6c7af3-ee5b-bfef-92bf-b258de2751ab).
5. **Techos por prototipo de tipología, como Viena LOD2.1.** Un catálogo cerrado de techos (a cuatro aguas del cuartel tipo A, tipo B, casa de oficiales) parametrizado por huella, y detalle tipo LOD2.4 solo donde haya planos. El esqueleto recto se usa para generar, pero el resultado se valida contra el prototipo. Costo: medio. Fuente: [wien.gv.at](https://www.wien.gv.at/stadtentwicklung/stadtvermessung/geodaten/dachmodell/).
6. **Gramática de fachada tipo CGA para crujías con mediagua.** Partición por piso con altura fija del informe de 2000, y en cada piso bordes fijos más módulos de ancho flexible (`~ancho`) para ventana con persiana, porche o mediagua. Mantener la gramática como datos, no como código suelto. Costo: medio. Fuente: [CityEngine Tutorial 7](https://doc.arcgis.com/en/cityengine/latest/tutorials/tutorial-7-facade-modeling.htm).
7. **Separar lo que sabe de lo que se ve, como Helsinki.** Un archivo semántico (atributos, procedencia, superficies etiquetadas como techo, muro, alero) y un GLB de render derivado de él. Nunca editar el GLB a mano. Costo: bajo si se decide ahora. Fuente: [HRI Helsinki](https://hri.fi/en_gb/new-generation-city-information-models-for-helsinki).
8. **Pulido manual que sobrevive a la regeneración, como Spider-Man.** Sobrescrituras por ID de edificio (un porche que falta, una escalera exterior) guardadas aparte y aplicadas después de la generación. Costo: medio. Fuente: [GDC 2019](https://www.gamedeveloper.com/design/swing-by-gdc-and-learn-about-the-making-of-i-marvel-s-spider-man-i-from-top-to-bottom).
9. **Kit de piezas con hojas de recorte (trim sheets) y atlas de materiales PBR sin luz horneada.** Pocas texturas compartidas por todos los cuarteles, desgaste por edificio vía parámetros (semilla, suciedad, color). Evita el error de OSM2World y Blosm (misma textura en todos) sin caer en fotos con sombra pintada como Berlín o PLATEAU. Costo: medio. Fuentes: [OSM2World](https://community.openstreetmap.org/t/requesting-osm2world-support-adding-custom-building-roof-and-texture-images/101113), [Berlin Partner](https://berlin-partner.de/en/press/detail/new-3d-city-model-from-the-business-location-center), [ISPRS Annals 2025](https://isprs-annals.copernicus.org/articles/X-4-W6-2025/89/2025/isprs-annals-X-4-W6-2025-89-2025.pdf).
10. **Fachada principal según la calle más cercana, como Mapbox.** Regla por defecto para orientar porche y escalera cuando la foto no lo confirma, marcada como inferida. Costo: bajo. Fuente: [SotM EU 2025](https://pretalx.com/sotmeu2025/talk/Z8VSHM/).
11. **Capa de suelo y espacio vial semántica, como TUM NYC.** Aceras, cunetas, parqueos y césped como clases propias; es lo que más ve un estudiante a nivel peatón. Costo: medio. Fuente: [TUM](https://www.asg.ed.tum.de/en/gis/news/article/improved-virtual-3d-city-model-of-new-york-city-in-citygml-lod2-available-as-open-data).
12. **Fecha de estado explícita, como Zúrich.** El modelo dice "estado 2000 según informe del Ejército" o "estado 2025 según OSM y fotos", y no mezcla épocas sin avisarlo. Costo: bajo. Fuente: [opendata.swiss](https://ckan.opendata.swiss/dataset/3d-dachmodell-lod2-jahresstand-2018-3d).
13. **Validación geométrica automática por edificio, como val3dity.** Sólidos cerrados, sin caras invertidas ni techos que atraviesan muros; la lista de errores va al JSON y al indicador de calidad. Costo: bajo a medio. Fuente: [3D BAG](https://docs.3dbag.nl/en/schema/attributes/).
14. **Generación en cliente o en build desde datos livianos, como streets.gl, con aparición por fundido como Mapbox.** Para teléfonos: cargar primero LoD1.2 en un solo lote, luego reemplazar por LoD2.2 y el kit de fachada cerca de la cámara. Costo: medio. Fuentes: [streets.gl](https://github.com/strandedkitty/streets-gl), [Mapbox](https://www.mapbox.com/blog/mapbox-style-updates-more-flexible-configurations-for-the-3d-basemap).
15. **Licencia y atribución claras desde el día uno, como PLATEAU.** Publicar el modelo con licencia abierta y la atribución de OSM (ODbL) y Open Buildings visible. Costo: bajo. Fuente: [wiki OSM PLATEAU](https://wiki.openstreetmap.org/wiki/MLIT_PLATEAU).

## 6. Modos de fallo que debemos evitar

- **Ciudad clonada** (MSFS, OSM2World): un solo tipo para todo. Antídoto: catálogo de tipos verificados y variación paramétrica por edificio.
- **Luz horneada** (Berlín, PLATEAU, Helsinki malla, Google): contradice el sol de ERA5. Antídoto: solo PBR sin sombras pintadas.
- **Detalle sin respaldo** (fachadas inventadas que parecen documentadas): antídoto, puntos 1 a 3.
- **Ediciones manuales perdidas** al regenerar: antídoto, punto 8.

## 7. Pendiente de verificar

- Repositorio y método exacto de la herramienta LOD2 automática de PLATEAU.
- Método y precisión del vuelo DoITT 2014 de NYC (el PDF de metadatos no descargó).
- Existencia de un modelo oficial de techos de NYC desde LiDAR 2017.
- Qué charla de Spider-Man corresponde a cada ID de GDC Vault, y detalles del kit de Assassin's Creed Unity.
