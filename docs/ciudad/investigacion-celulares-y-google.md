# Investigación: celulares en Panamá y cobertura 3D de Google

Fecha de la investigación: 4 de octubre de 2026. Visor: three.js 0.186.1 con WebGPURenderer y respaldo automático a WebGL2.

Convención de este documento:

- **[verificado]** lo leí en la fuente primaria indicada.
- **[secundario]** viene de prensa o foros, no de la fuente primaria.
- **[estimación]** es criterio mío, razonado pero sin una fuente que lo respalde directamente.
- **[sin verificar]** no pude confirmarlo.

---

## P1. ¿Qué tan viejo puede ser el celular?

### 1.1 Mercado móvil de Panamá (StatCounter, octubre 2025 a septiembre 2026)

Descargué los CSV de StatCounter Global Stats para Panamá, solo tráfico móvil, mensual, de 2025-10 a 2026-09. Los promedios son de los 12 meses; "sep 2026" es el último mes. **[verificado]**

**Sistema operativo móvil** ([fuente](https://gs.statcounter.com/os-market-share/mobile/panama))

| SO | Promedio 12 meses | Sep 2026 |
|---|---|---|
| Android | 68,1 % | 69,6 % |
| iOS | 31,8 % | 30,5 % |

**Fabricante** ([fuente](https://gs.statcounter.com/vendor-market-share/mobile/panama))

| Marca | Promedio 12 meses | Sep 2026 |
|---|---|---|
| Apple | 31,8 % | 30,5 % |
| Samsung | 31,1 % | 30,2 % |
| Xiaomi | 10,4 % | 13,3 % |
| Honor | 10,0 % | 14,6 % |
| Desconocido | 8,4 % | 5,7 % |
| Huawei | 2,3 % | 1,6 % |
| Google | 1,7 % | 0,6 % |
| Tecno | 0,9 % | 0,8 % |
| Motorola | 0,8 % | 0,5 % |

En septiembre de 2026, Honor y Xiaomi suman 27,9 % y Samsung 30,2 %; en el promedio de 12 meses, 20,4 % y 31,1 %. Motorola casi no aparece.

**Versión de Android** ([fuente](https://gs.statcounter.com/android-version-market-share/mobile/panama))

| Versión | Promedio 12 meses | Sep 2026 |
|---|---|---|
| 16 | 24,3 % | 43,4 % |
| 14 | 22,1 % | 17,1 % |
| 15 | 18,9 % | 15,9 % |
| 13 | 14,8 % | 11,5 % |
| 12 | 7,0 % | 4,4 % |
| 11 | 4,3 % | 2,6 % |
| 10 | 4,0 % | 2,5 % |
| 9 o anterior | 4,3 % | 1,6 % |
| 17 | 0,2 % | 0,8 % |

En septiembre de 2026, Android 12 o superior suma cerca de **93 %** de los Android; Android 10 y 11 cerca de **5 %**; Android 9 o anterior cerca de **1,6 %**.

**Versión de iOS** ([fuente](https://gs.statcounter.com/ios-version-market-share/mobile/panama)), agrupada por versión mayor:

| Versión | Promedio 12 meses | Sep 2026 |
|---|---|---|
| iOS 26 | 50,0 % | 72,8 % |
| iOS 18 | 39,1 % | 16,5 % |
| iOS 27 | 0,7 % | 6,4 % |
| iOS 16 | 4,5 % | 2,9 % |
| iOS 17 | 2,4 % | 0,8 % |
| iOS 15 o anterior | 3,1 % | 0,7 % |

**Resolución de pantalla móvil** (12 meses agregados, en puntos CSS) ([fuente](https://gs.statcounter.com/screen-resolution-stats/mobile/panama)): 414×896 (13,3 %), 384×832 (9,1 %), 390×844 (6,5 %), 360×800 (6,1 %), 393×873 (4,7 %), 375×812 (3,8 %), 385×854 (3,4 %), 360×780 (3,4 %), 412×915 (2,9 %). 414×896 es el tamaño lógico de iPhone XR, 11 y XS Max; 390×844 el de iPhone 12 a 14. Casi todo cae entre 360 y 414 puntos de ancho.

**Navegador móvil** (sep 2026): Chrome 64,5 %, Safari 25,5 %, Samsung Internet 6,5 %, Edge 1,3 %. **[verificado]**

**Advertencias sobre estos datos:**

1. **Ruido.** En mayo de 2026 aparecen picos raros (Google 8,1 % como fabricante, Android 5, 6 y 8 con 6 % cada uno) que desaparecen al mes siguiente. **[estimación]** Puede ser tráfico automatizado. Por eso doy promedio y último mes.
2. **Escritorio inflado.** StatCounter dice que en Panamá el 70,3 % del tráfico es de escritorio y solo 28,7 % móvil ([fuente](https://gs.statcounter.com/platform-market-share/desktop-mobile-tablet/panama)). Eso no se parece a ningún país de la región; probablemente hay tráfico no humano o de oficinas. No lo uses para decidir "móvil primero o no". **[estimación]**
3. **Versión de iOS.** Desde Safari 26, el agente de usuario de iOS se congeló en "iPhone OS 18_6", aunque el teléfono tenga iOS 26 ([Niels Leenheer](https://nielsleenheer.com/articles/2025/the-user-agent-string-of-safari-on-ios-26-and-macos-26/), [WebKit bug 298260](https://bugs.webkit.org/show_bug.cgi?id=298260), [Daring Fireball](https://daringfireball.net/2026/01/ios_26_adoption_rate_is_not_bizarrely_low)). StatCounter ya parece corregirlo leyendo la versión de Safari (iOS 18.6 cae a 1,1 % en sep 2026), pero navegadores que no son Safari dentro de iOS pueden seguir contando como "18". O sea, la cifra de iOS 26 o más es probablemente un piso, no un techo. **[secundario]**
4. **No es tu público.** Son todas las visitas a sitios con StatCounter en Panamá. Estudiantes de arquitectura de Isthmus pueden tener teléfonos mejores o peores que el promedio. **[estimación]**

### 1.2 ¿Quién tiene WebGPU en el celular (octubre 2026)?

**Chrome en Android** **[verificado]**

- WebGPU activo por defecto desde Chrome 121 en Android 12 o superior con GPU Qualcomm (Adreno) o ARM (Mali) ([Chrome 121](https://developer.chrome.com/blog/new-in-webgpu-121)).
- La lista de bloqueo vigente de Chromium dice textualmente: ARM, Qualcomm e Intel en Android 12+ con Vulkan, y en Android 10+ con OpenGL ES; Imagination (PowerVR) solo en Android 16+ con Vulkan o Android 13+ con OpenGL ES; **cualquier otro fabricante de GPU queda bloqueado** ([webgpu_blocklist_impl.cc](https://chromium.googlesource.com/chromium/src.git/+/main/gpu/config/webgpu_blocklist_impl.cc)). El mismo archivo confirma que Android 10 es hoy el mínimo de Chrome.
- La tabla oficial del grupo de trabajo de WebGPU coincide: Imagination desde Chrome 139 en Android 16+; **Samsung Xclipse (la GPU AMD de los Exynos) todavía "por definir"** ([gpuweb Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)).
- Chrome 146 (febrero 2026) añadió el **modo de compatibilidad** sobre OpenGL ES 3.1, empezando por Android ([Chrome 146](https://developer.chrome.com/blog/new-in-webgpu-146)). Se pide con `featureLevel: "compatibility"`.
- Chrome dejó de actualizarse en Android 8 y 9 a partir de Chrome 139 ([9to5Google](https://9to5google.com/2025/06/26/google-chrome-android-versions-no-longer-supported-2025/)). **[secundario, coherente con el comentario del código de Chromium]**

**Hallazgo importante sobre three.js 0.186.1** **[verificado en el código instalado]**: `WebGPUBackend.js` pide el adaptador con `featureLevel: 'compatibility'` y luego activa todas las funciones que el adaptador ofrezca. Consecuencias:

- En teléfonos con Android 10 u 11 y GPU Mali o Adreno con OpenGL ES 3.1, Chrome 146+ puede darle a tu visor un adaptador WebGPU en modo compatibilidad en lugar de caer a WebGL2.
- Si el dispositivo no tiene la función `core-features-and-limits`, three.js pone `compatibilityMode = true` y **apaga el MSAA** (`renderer._samples = 0`). Hay que contar con bordes sin suavizar en esos equipos, o usar FXAA o SMAA.

**Safari en iPhone** **[verificado]**

- WebGPU viene activado en Safari 26 para iOS, iPadOS, macOS y visionOS ([WebKit, Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)); caniuse lo marca como soportado en iOS Safari 26.0 a 27.2 ([caniuse, datos crudos](https://github.com/Fyrd/caniuse/blob/main/features-json/webgpu.json)).
- iOS 26 e iOS 27 llegan al **iPhone 11, 11 Pro, 11 Pro Max y iPhone SE de 2.ª generación en adelante**. La página oficial de Apple de iOS 27 los lista ([apple.com/os/ios](https://www.apple.com/os/ios/)); había rumores de que iOS 27 dejaría fuera al iPhone 11 y no pasó. El iPhone XR y XS se quedan en iOS 18, o sea, **sin WebGPU, solo WebGL2**.
- En iOS todos los navegadores usan WebKit, así que Chrome para iPhone también debería tener WebGPU en iOS 26. **[sin verificar]** Lo mismo para navegadores dentro de apps (WhatsApp, Instagram), que usan vistas web del sistema. **[sin verificar]**

**Samsung Internet**: caniuse lo marca con WebGPU desde la versión 24 ([caniuse](https://github.com/Fyrd/caniuse/blob/main/features-json/webgpu.json)). Hereda las mismas reglas de GPU de Chromium. **[verificado en caniuse; la herencia de la lista de bloqueo es estimación]**

**Firefox en Android**: sin WebGPU por defecto ([gpuweb](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)). **[verificado]**

**Cuenta rápida para Panamá** **[estimación]**: iOS 26 o 27 es cerca del 79 % de los iPhone, o sea unos 24 de cada 100 celulares. En Android, el ~93 % tiene Android 12+, pero hay que restar los que tienen GPU Xclipse (Galaxy A55, A56, S22 a S24 con Exynos) y PowerVR viejas (Galaxy A12, Redmi 9A) y sumar los Android 10 y 11 que entren por modo compatibilidad. No encontré datos de reparto por fabricante de GPU en Panamá. Mi rango razonable: **entre 55 % y 75 % de los celulares en Panamá recibirían WebGPU; el resto, WebGL2.** El respaldo a WebGL2 no es un caso raro; es un tercio del público.

### 1.3 Teléfonos típicos en Panamá y su GPU

No encontré una lista de modelos más vendidos específica de Panamá. Uso el top 10 de Latinoamérica 2025 de Counterpoint ([GSMArena](https://www.gsmarena.com/counterpoint_samsung_galaxy_a06_was_the_bestselling_phone_in_latam_for_2025-news-71620.php)) y Canalys Q2 2025 ([Canalys](https://canalys.com/newsroom/latam-smartphone-market-Q2-2025)): Galaxy A06 (n.º 1, 7 % de las ventas), Galaxy A16, Moto G15, Redmi 14C, Galaxy A15, Moto G05, Redmi A5, Moto G35, Galaxy A56, Redmi Note 14 4G; el 80 % de ese top es 4G y casi todos cuestan menos de 200 dólares. Canalys añade que Honor creció por su serie X, y Honor pesa mucho en Panamá. **[secundario]**

Fichas técnicas leídas en GSMArena **[verificado]** y rendimiento gráfico de Notebookcheck en GFXBench Manhattan ES 3.1 Offscreen (1080p fuera de pantalla, mayor es mejor) **[secundario, cifras tomadas del extracto del buscador; las páginas de Notebookcheck bloquearon la descarga directa]**:

| Teléfono (año) | Chip | GPU | RAM | Pantalla | Android de fábrica | Manhattan 3.1 off. (mediana GPU) | ¿WebGPU en Chrome? |
|---|---|---|---|---|---|---|---|
| [Galaxy A06](https://www.gsmarena.com/samsung_galaxy_a06-13265.php) (2024) | Helio G85 | Mali-G52 MC2 | 4 a 6 GB | 720×1600 | 14 | ~15 fps ([NBC](https://www.notebookcheck.net/ARM-Mali-G52-MP2-GPU-Benchmarks-and-Specs.466940.0.html)) | Sí (ARM, Android 14+) |
| [Moto G15](https://www.gsmarena.com/motorola_moto_g15-13507.php) (2024) | Helio G81 Extreme | Mali-G52 MC2 | 4 a 8 GB | 1080×2400 | 15 | ~15 fps | Sí |
| [Redmi 14C](https://www.gsmarena.com/xiaomi_redmi_14c-13291.php) (2024) | Helio G81 Ultra | Mali-G52 MC2 | 4 a 8 GB | 720×1640 | 14 | ~15 fps | Sí |
| [Redmi A5](https://www.gsmarena.com/xiaomi_redmi_a5_4g-13737.php) (2025) | Unisoc T7250 | Mali-G57 MP1 | 3 a 6 GB | 720×1640 | 15 Go | menor que G57 MC2 **[estimación]** | Sí (ARM) |
| [Galaxy A16 4G](https://www.gsmarena.com/samsung_galaxy_a16-13383.php) (2024) | Helio G99 | Mali-G57 MC2 | 4 a 8 GB | 1080×2340 | 14 | ~25 fps ([NBC](https://www.notebookcheck.net/ARM-Mali-G57-MP2-GPU-Benchmarks-and-Specs.537758.0.html)) | Sí |
| [Honor X7c 4G](https://www.gsmarena.com/honor_x7c-13416.php) (2024) | Snapdragon 685 | Adreno 610 | 4 a 8 GB | 720×1610 | 14 | ~13 fps ([NBC](https://www.notebookcheck.net/Adreno-610-vs-Mali-G52-MP2-vs-Mali-G57-MP3_9921_10399_10571.247598.0.html)) | Sí (Qualcomm) |
| [Honor X8c](https://www.gsmarena.com/honor_x8c-13621.php) (2025) | Snapdragon 685 | Adreno 610 | 6 a 8 GB | 1080×2412 | 15 | ~13 fps | Sí |
| [Galaxy A56](https://www.gsmarena.com/samsung_galaxy_a56-13603.php) (2025) | Exynos 1580 | Xclipse 540 | 6 a 12 GB | 1080×2340 | 15 | alto **[sin cifra]** | **No** (Xclipse bloqueado) → WebGL2 |
| [Galaxy A12](https://www.gsmarena.com/samsung_galaxy_a12-10604.php) (2020) | Helio P35 | PowerVR GE8320 | 2 a 6 GB | 720×1600 | 10 (máx. 12) | ~6,7 fps ([NBC](https://www.notebookcheck.net/PowerVR-GE8320-Graphics-Card-Benchmarks-and-Specs.372646.0.html)) | **No** (PowerVR exige Android 13+) → WebGL2 |
| iPhone 11 / SE 2 (2019, 2020) | A13 | Apple 4 núcleos | 4 GB / 3 GB | 828×1792 / 750×1334 | iOS 26 y 27 | ~110 fps ([NBC](https://www.notebookcheck.net/Apple-A13-Bionic-GPU.434833.0.html)) | Sí (Safari 26+) |

Lectura en términos de GPU:

- **"Viejo" en Android no significa año de compra.** Un Galaxy A06 o Redmi 14C comprado nuevo en 2025 tiene la misma GPU (Mali-G52 MC2, de 2018) que un Redmi 9 de 2020. El piso real de lo que se vende hoy en Panamá es una GPU unas **7 veces más lenta que un iPhone 11** (15 frente a 110 fps en la misma prueba).
- Las GPU de gama baja se agrupan en tres escalones: **PowerVR GE8320** (~7 fps, el más bajo), **Mali-G52 MC2 / Adreno 610** (~13 a 15 fps, el piso de hoy), **Mali-G57 MC2** (~25 fps, gama media baja). Cualquier iPhone 11 o más nuevo está muy por encima de todos.
- Muchos de estos teléfonos tienen pantallas de 720 p, lo que ayuda: menos píxeles que pintar. Los de 1080 p con Mali-G52 (Moto G15) son el peor caso.

### 1.4 Tres niveles propuestos

Todo lo de esta sección es **[estimación]** salvo donde cito una fuente. Las referencias públicas más cercanas que encontré:

- Google Scene Viewer (visor 3D de Android para un objeto en RA): límite recomendado de **100.000 triángulos**, rango ideal 30.000 a 50.000; hasta **10 materiales**; texturas de **2048×2048** como máximo; modelo de **10 MB** recomendado, 15 MB máximo ([Google ARCore](https://developers.google.com/ar/develop/scene-viewer)). **[verificado]**
- Meta Quest: menos de **100 llamadas de dibujo y 750.000 triángulos** por cuadro en Quest 2, y menos de 200 y 1,5 millones en Quest 3, con un chip Snapdragon muy superior a la gama baja de Panamá ([Meta](https://developers.meta.com/horizon/documentation/unity/unity-perf/)). **[secundario, cifras del extracto del buscador]**
- Velocidad móvil mediana en Panamá: **32,43 Mbps** a finales de 2025 según Ookla ([DataReportal Digital 2026 Panamá](https://datareportal.com/reports/digital-2026-panama)). 10 MB tardan unos 2,5 s en condiciones medianas; en el aula con wifi compartido, bastante más. **[secundario]**

| | **Alto** | **Medio** | **Bajo** |
|---|---|---|---|
| Ejemplos | iPhone 12 o más nuevo; Galaxy S21 en adelante; Galaxy A55 / A56 (Xclipse, por WebGL2; sin cifra de GFXBench); Snapdragon 7 u 8 (Adreno 7xx) | iPhone 11, SE 2 y SE 3 (GPU de sobra, poca RAM); Galaxy A15 / A16 4G, Redmi Note 14 4G (Mali-G57 MC2); Honor X8c, X7c (Adreno 610) en el borde | Galaxy A06, Moto G05 / G15, Redmi 14C, Honor X6b (Mali-G52 MC2); Redmi A5 (Mali-G57 MP1) |
| Ruta típica | WebGPU núcleo, o WebGL2 en Xclipse | WebGPU (núcleo o compatibilidad) o WebGL2 | WebGPU o WebGL2, sin MSAA |
| Triángulos dibujados por cuadro | 1 a 1,5 millones | 300.000 a 500.000 | 100.000 a 150.000 |
| Llamadas de dibujo | hasta 300 | hasta 150 | hasta 60 |
| Memoria de texturas en GPU | hasta 256 MB | hasta 128 MB | hasta 48 a 64 MB; texturas de 1024 como máximo |
| Descarga inicial (antes de ver algo) | hasta 25 MB | hasta 12 MB | hasta 5 a 6 MB |
| Descarga total de la sesión | hasta 60 MB | hasta 30 MB | hasta 12 MB |
| Relación de píxeles máxima | 2 | 1,5 | 1 a 1,25 |
| Sombras | mapa 2048, 2 o 3 cascadas | mapa 1024 a 2048, 1 cascada | una sombra 1024 o sombras precalculadas en la geometría solo para el contexto |
| Posproceso | ligero (tonemapping, AO barata) | solo tonemapping y FXAA | nada caro; FXAA si el MSAA está apagado |

Cómo llegué a esos números:

- **Bajo** parte del rango de Scene Viewer (100.000 triángulos, 10 materiales, 10 MB) porque es la recomendación de Google para un objeto en un Android cualquiera. Un edificio con su contexto se parece más a "una escena" que a "un objeto", así que subo un poco los triángulos y bajo la descarga inicial para que el primer cuadro llegue rápido.
- **Medio** multiplica por 3 a 4 el bajo, que es aproximadamente la distancia entre Mali-G52 MC2 y Mali-G57 MC2 sumada a la ventaja de pantallas de 720 p. El iPhone 11 cae aquí por memoria (3 a 4 GB) aunque su GPU sea de nivel alto.
- **Alto** se acerca al presupuesto de Quest 2 sin el costo del estéreo.
- Las llamadas de dibujo cuestan menos en WebGPU que en WebGL2, pero el visor tiene que funcionar en ambos, así que el presupuesto se fija para WebGL2.

**Dispositivo más viejo soportado (propuesta)** **[estimación]**:

- **Android:** Android 10 con Chrome actualizado, GPU con OpenGL ES 3.0 (WebGL2) y 3 GB de RAM. Ejemplo concreto del piso: **Galaxy A12 (2020, PowerVR GE8320)**. Funciona en nivel bajo por WebGL2, sin promesas de fluidez. Debajo de eso (Android 8 o 9, 2 GB) queda fuera: Chrome ya no se actualiza ahí.
- **iPhone:** **iPhone 11 y SE 2** es el más viejo con WebGPU. **iPhone XR / XS (iOS 18)** se soporta por WebGL2 en nivel medio o bajo. iPhone 8 y X (iOS 16, cerca del 3 % de los iPhone) solo como "mejor esfuerzo".

**Recomendación práctica** **[estimación]**: decidir el nivel en tiempo de ejecución por lo que el navegador reporta (ruta WebGPU núcleo, compatibilidad o WebGL2; nombre de la GPU; `navigator.deviceMemory` en Chrome; tiempo de los primeros cuadros) y no por la marca del teléfono. Y registrar esos datos de forma anónima durante la primera semana con estudiantes: en un mes tendrías el reparto real de tu público, que vale más que StatCounter.

---

## P2. ¿Google tiene 3D fotorrealista de Clayton / Ciudad del Saber?

### Respuesta corta

**No, según la fuente oficial de Google.** La tabla de cobertura de Google Maps Platform, actualizada el **28 de septiembre de 2026**, marca a Panamá con mapas 2D pero **sin teselas 3D** y **sin "Maps JavaScript 3D"** ([developers.google.com/maps/coverage](https://developers.google.com/maps/coverage)). **[verificado]**

### Lo que se puede verificar

1. **Tabla oficial de cobertura de Google** ([enlace](https://developers.google.com/maps/coverage), columna "Map Tiles 2D / 3D"). La leí entera: **unos 50 países o territorios** tienen 3D (la cuenta exacta no se repitió en la revisión). En Latinoamérica solo **México, Brasil, Argentina, Chile y Puerto Rico**. Panamá, Colombia, Costa Rica, Perú, Ecuador, Guatemala, República Dominicana, Uruguay y Venezuela tienen solo 2D. La leyenda dice que la falta del punto significa "no disponible o con baja calidad o disponibilidad", así que lo correcto es decir que **Google no ofrece 3D fotorrealista con calidad aceptable en Panamá**, no que no exista ni un solo edificio en malla. **[verificado]**
2. **Las teselas cubren el planeta, pero fuera de las ciudades con 3D solo hay relieve con la foto aérea encima**, sin volumen de edificios. Lo dice Luciad en su guía de integración de las teselas de Google ([Luciad](https://dev.luciad.com/portal/productDocumentation/LuciadRIA/docs/articles/howto/ogc3dtiles/google3DTiles.html)). Si cargas las teselas de Google en Clayton vas a ver suelo con foto, no edificios. **[secundario]**
3. **Mapa comunitario de zonas 3D de Google Earth Blog** (KML de 15 MB, 5.651 lugares). Lo descargué y busqué: no hay ningún polígono dentro de Centroamérica ni Panamá; las cinco entradas "Panama City" son de Panama City, **Florida** (latitud 30). Ojo: su última actualización es de **julio de 2017**, así que solo prueba que no había 3D en 2017 ([KML](https://www.gearthblog.com/kmfiles/3DMeshLocations.kml), [artículo](https://www.gearthblog.com/blog/archives/2015/11/maintaining-map-3d-areas.html)). **[verificado, pero viejo]**
4. **Usuario de Google Earth VR, enero 2019**: "la Ciudad de Panamá se ve plana, solo el terreno está en 3D" ([Steam](https://steamcommunity.com/app/348250/discussions/0/1742230617609707197/)). **[secundario, viejo]**
5. **Trampa en los resultados de búsqueda:** un artículo de Google Earth Blog de 2009 dice que hay "modelos de calidad en ... Panama City" ([enlace](https://www.gearthblog.com/blog/archives/2009/09/more_3d_cities_appearing_in_google.html)). Habla de los **modelos hechos a mano por usuarios en SketchUp / 3D Warehouse**, que Google retiró después ([GEB 2013](https://www.gearthblog.com/blog/archives/2013/08/google-continues-to-expand-3d-imagery.html)). No es fotogrametría y no sirve como evidencia. **[verificado]**

### Lo que no pude verificar

- **Google Earth (la app) frente a Maps Platform.** A veces Google Earth muestra 3D en lugares que la tabla de Maps Platform no marca. No encontré ninguna noticia, anuncio de Google ni publicación en foros de Cesium que muestre 3D fotorrealista en Panamá, pero tampoco puedo confirmar que no exista en Google Earth hoy. **[sin verificar]**
- Luciad menciona una capa "3D Coverage" dentro de Google Earth para ver exactamente dónde hay 3D. No confirmé en qué versión ni en qué menú está. **[sin verificar]**

### Cómo comprobarlo a mano en 30 segundos

1. Abre este enlace en Chrome de computadora: **https://earth.google.com/web/@8.998,-79.582,40a,1200d,35y,0h,60t,0r** (te deja sobre Ciudad del Saber, a unos 1.200 m, inclinado 60°).
2. En la barra izquierda entra a **Estilo de mapa** y asegúrate de que **"Activar edificios 3D"** esté encendido.
3. Mira los edificios:
   - Si los techos y fachadas **se levantan del suelo con textura de foto** cuando giras la cámara (mantén Shift y arrastra), **hay fotogrametría**.
   - Si todo es **una foto plana pegada al relieve**, o solo aparecen **cajas grises lisas**, **no hay** 3D fotorrealista.
4. Para comparar, prueba lo mismo en un lugar que sí lo tiene, por ejemplo Ciudad de México: https://earth.google.com/web/@19.4326,-99.1332,2300a,1200d,35y,0h,60t,0r

### Microsoft Flight Simulator (aparte, porque usa Bing y Blackshark, no Google)

- MSFS 2024 trae fotogrametría en más de 500 ciudades según una guía no oficial; no encontré a Panamá en ninguna lista de ciudades con fotogrametría ([FlyAwaySimulation](https://flyawaysimulation.com/ask/answers/msfs-2024-photogrammetry-cities-areas/), [foro oficial](https://forums.flightsimulator.com/t/where-is-the-list-of-all-photogrammetry-cities-in-msfs-2024/678156)). **[secundario]**
- No encontré ninguna World Update de MSFS dedicada a Centroamérica. **[sin verificar]**
- Panamá en MSFS se ve con edificios generados automáticamente (hay quejas en el [foro oficial](https://forums.flightsimulator.com/t/unreal-buildings-in-panama/360060)) y existe un paquete pago de terceros, Orbx Landmarks Panama City, con hitos modelados a mano ([FSElite](https://fselite.net/content/orbxs-landmarks-panama-city-pack-now-available-for-msfs/)). Nada de eso cubre Clayton con fotogrametría ni se puede usar en un visor web. **[secundario]**

### Qué significa para el visor

Aunque los términos de uso lo permitieran (ya descartados en `referentes-ciudades.md` por luz horneada y licencia), **Google no tiene un modelo 3D de Clayton que se pueda aprovechar**. El contexto urbano tiene que seguir saliendo de fuentes propias: OSM, Open Buildings, el informe CERL y modelado propio.
