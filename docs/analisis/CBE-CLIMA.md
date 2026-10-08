# CBE Clima: uso actual y utilidad para Edificio 106

Evaluación inicial: 7 de octubre de 2026. Actualización y pruebas: 8 de octubre de 2026. Autor: OpenAI Codex, a solicitud de Luis Miguel Caamaño. Repo local y `origin/main` revisados en `75c21ca`. CBE Clima consultado en `8e3d08911b93aded23589c247ca997cea462f7a6` (1 de octubre de 2026).

## Respuesta

**Dictamen para Claude, 8 de octubre de 2026: SÍ vale la pena usar CBE Clima como herramienta externa para explorar y contrastar nuestros EPW. NO se justifica integrarlo como dependencia o desplegar un servidor propio para esta tarea.** Los EPW 2024 y 2025 pasaron la carga y el procesamiento originales de CBE ejecutados localmente. El cierre de 2025 ya usa el registro ERA5 recuperado. No se ha probado la navegación del sitio público de CBE.

**Ya existe interoperabilidad prevista mediante EPW; no se encontró una integración de la aplicación CBE Clima como dependencia o servicio del visor.** Además, el proyecto porta cálculos de `pythermalcomfort`, que pertenece al mismo centro, pero es un proyecto distinto. La importación local y el contraste ahora tienen informes reproducibles enlazados abajo.

## Evidencia del repositorio

| Evidencia | Qué acredita |
| --- | --- |
| `fuente/cuerpo.html`, sección `#epw-t`, «El clima en otro programa» | El usuario puede descargar un EPW y el texto menciona CBE Clima como destino |
| `fuente/src/epw.js`, función `epw` | Exporta un año de 2001 a 2025 a partir de los datos del visor |
| `fuente/src/main.js`, importación de `epw` y evento de `#epw-form` | La descarga está conectada a la interfaz; no es solo una idea documentada |
| Commit `c07afd6`, 6 de octubre de 2026 | Incorporó la exportación EPW, el año en un vistazo y la carta solar |
| `fuente/src/cartasolar.js` | Menciona CBE Clima como referencia de lectura de la carta solar, sin importar su código |
| `fuente/src/confort.js` | Declara un porte de UTCI y SolarCal desde `pythermalcomfort` 4.6.0, con atribución |
| `fuente/package.json` y búsqueda de referencias en fuente/documentación | No se encontró CBE Clima como paquete, endpoint, iframe o servicio conectado |

El módulo local `fuente/src/clima.js` pertenece al visor; su nombre no indica una dependencia del repositorio de Berkeley. La búsqueda también abarcó las notas Markdown del panel de producto y el plan de otros edificios. No permite descartar un uso manual de Clima fuera de esos registros.

En Descargas existe `edificio106_era5_ajustado-albrook_2024.epw`. La auditoría reproducible del 8 de octubre verificó sus 8 cabeceras, 8.760 registros, saltos CRLF y 35 campos en cada registro. El archivo coincide byte por byte con la exportación del código y datos locales. La prueba de carga de CBE es independiente y se documenta más abajo.

## Qué añadiría

CBE Clima es una aplicación de análisis climático basada en EPW, admite archivos propios y produce gráficos y métricas derivadas. Usa Python, Dash, Plotly y Pandas. Fuentes: [repositorio oficial](https://github.com/CenterForTheBuiltEnvironment/clima), [documentación](https://cbe-berkeley.gitbook.io/clima) y [Pipfile de la versión consultada](https://github.com/CenterForTheBuiltEnvironment/clima/blob/8e3d08911b93aded23589c247ca997cea462f7a6/Pipfile).

| Uso propuesto | Aporte respecto al visor | Límite |
| --- | --- | --- |
| Contrastar la exportación EPW | Detectar problemas de horas, unidades, faltantes o reconstrucción de variables con un lector externo | Que un gráfico coincida no valida ERA5 contra el clima real del lugar |
| Explorar combinaciones de variables | Cruzar temperatura, humedad, radiación y viento con filtros para preguntas de clase o investigación | El resultado conserva la procedencia e incertidumbre del EPW |
| Comparar años y estaciones | Elaborar gráficos equivalentes para años exportados y archivos de referencia | Distinguir año concreto de año meteorológico típico; usar períodos, filtros y unidades comparables |
| Carta psicrométrica filtrada | Analizar horarios de clase, meses y frecuencia de condiciones con más opciones externas | No demuestra el confort dentro del aula |
| Potencial climático de ventilación | Contar horas que cumplen umbrales explícitos y explorar el punto de rocío | No calcula caudal, renovaciones de aire ni flujo entre edificios |
| Contrastar UTCI | Revisar resultados bajo entradas y supuestos equivalentes | No comparar directamente el entorno genérico de Clima con la sombra específica del alero |

El [explorador de datos](https://cbe-berkeley.gitbook.io/clima/documentation/tabs-explained/data-explorer) permite seleccionar variables, colorear por otra y aplicar filtros. La [carta psicrométrica](https://github.com/CenterForTheBuiltEnvironment/clima/blob/8e3d08911b93aded23589c247ca997cea462f7a6/docs/documentation/tabs-explained/psychrometric-chart/README.md) admite filtros de fecha, hora y variables. Son herramientas útiles fuera del visor, donde se puede investigar sin añadir más controles a la interfaz móvil.

La [ventilación potencial](https://cbe-berkeley.gitbook.io/clima/documentation/tabs-explained/natural-ventilation) se basa principalmente en temperatura exterior, con filtros configurables y una condición de temperatura superficial/punto de rocío. Su rango predeterminado documentado de 10 a 24 °C no debe convertirse automáticamente en una regla de diseño para Panamá.

La sección de [confort exterior](https://github.com/CenterForTheBuiltEnvironment/clima/blob/8e3d08911b93aded23589c247ca997cea462f7a6/docs/documentation/tabs-explained/outdoor-comfort/README.md) usa UTCI. El Pipfile consultado fija `pythermalcomfort` 2.9.1; el porte del visor declara 4.6.0. Una comparación necesita registrar versiones, viento, temperatura radiante media y tratamiento de la radiación. Compartir una familia de implementación reduce la independencia del contraste: no es una validación experimental.

## Condiciones del EPW que deben acompañar cualquier análisis

Según `epw.js`, exportamos un año concreto de ERA5 con temperatura y humedad ajustadas a Albrook cuando el ajuste está cargado. No es una medición en Ciudad del Saber ni un año meteorológico típico construido estadísticamente. Se omite el 29 de febrero para mantener 8.760 registros. La radiación global se reconstruye a partir de DNI, difusa y posición solar; la presión es estándar a 24 m; varios campos llevan indicadores de dato faltante. El EPW tampoco transporta el GLB ni las sombras de sus edificios.

La revisión local de horas, unidades y cierre de año ya se ejecutó; los resultados y sus límites se detallan a continuación. También se contrastaron los valores importados con el lector y la ruta de carga originales de CBE.

## Auditoría ejecutada por Codex el 8 de octubre de 2026

Método: ejecutar los módulos reales `Clima` y `epw` con el binario horario y el ajuste local, regenerar 2024 y compararlo byte por byte con Descargas. Comprobar por separado el calendario y el índice de fin de intervalo. La reconstrucción de GHI reutiliza la función solar del visor: verifica la exportación, no valida independientemente el modelo solar.

- Script: [`epw/auditar.mjs`](epw/auditar.mjs), Node 22.16.0, sin paquetes adicionales. Ejecutar desde la raíz: `node docs/analisis/epw/auditar.mjs /Users/luismiguelcaamano/Downloads/edificio106_era5_ajustado-albrook_2024.epw`.
- Evidencia: [`epw/resultado.json`](epw/resultado.json), con hashes de las fuentes, datos y EPW, estadísticas y cuatro registros de frontera. SHA-256 del EPW: `0e3fb4d0f4f2c04724f0e09d3f6e1616c68c320194b3a581c0f842f737b46d89`.
- Calendario: 8.760 fechas únicas y ordenadas; horas 1–24, minuto 60, UTC−5. No hay 29 de febrero. El salto de 25 horas entre las marcas de fin de intervalo de 28/02 h24 y 01/03 h1 corresponde a las 24 horas omitidas; no representa una serie continua del año bisiesto real.
- Unidades y redondeo: temperatura ±0,05 °C; humedad ±0,5 puntos porcentuales; viento dividido entre 3,6 y redondeado a 0,1 m/s; GHI ±0,5 Wh/m² por intervalo horario. DNI, DHI y lluvia coinciden con los valores de origen. Cero incumplimientos de los rangos primarios comprobados y ningún punto de rocío superior a la temperatura seca.
- Cierre de 2024: 31/12 h24 lee el dato disponible de 01/01/2025 00:00 de Panamá. No necesita repetir la hora anterior.
- **Cierre de 2025 resuelto:** la serie base termina en el índice 219.143, pero 31/12 h24 necesita 219.144. Se recuperó esa hora de ERA5 y se incorporó como dato adicional exclusivo del EPW. La última fila ya no duplica la anterior; su procedencia y el ajuste de temperatura/humedad se declaran en COMMENTS 2.

| Variable del EPW 2024 | Mínimo | Máximo | Media |
| --- | ---: | ---: | ---: |
| Temperatura, °C | 22,9 | 35,6 | 27,881 |
| Humedad relativa, % | 40 | 100 | 80,564 |
| Viento, m/s | 0 | 8,3 | 2,586 |
| GHI, Wh/m² por intervalo horario | 0 | 1.029 | 201,929 |

Presión de 101.037 Pa, cielo opaco igualado al total, nieve cero y 88 días desde nieve son supuestos o constantes del exportador. No interpretarlos como mediciones. La radiación infrarroja horizontal está marcada como faltante. La definición de horas y campos procede del [diccionario EPW de EnergyPlus 24.1](https://bigladdersoftware.com/epx/docs/24-1/auxiliary-programs/energyplus-weather-file-epw-data-dictionary.html).

## Precauciones del lector CBE comprobadas en ejecución

Se revisó `create_df` de [`pages/lib/extract_df.py` en 8e3d089](https://github.com/CenterForTheBuiltEnvironment/clima/blob/8e3d08911b93aded23589c247ca997cea462f7a6/pages/lib/extract_df.py) y se ejecutó localmente la ruta original de carga, sin enviar el archivo a un servicio externo:

- Lee las filas 8 a 8.767: espera 8.760 registros. Nuestro archivo satisface ese tamaño.
- Si no encuentra un período explícito en los metadatos, un único año 2024 se convierte por redondeo en la etiqueta **2020–2030**. La ejecución confirmó ese valor en los metadatos devueltos para 2024 y 2025; no es un período climático real de diez años. El informe de cualquier prueba debe conservar «año concreto 2024».
- Construye las fechas de cálculo con **2019**, un año no bisiesto. Para UTC−5 coloca la primera marca solar a las 06:00 UTC, equivalente a 01:00 en Panamá. El exportador calcula GHI con la altura solar de mitad del intervalo, 00:30 para esa fila. Alinear estas convenciones antes de comparar radiación derivada, posición solar o UTCI; no exigir igualdad automática.

La carga local correcta no prueba la exactitud meteorológica en el sitio ni el confort real del edificio. Tampoco prueba la navegación del servicio público de CBE.

## Cierre de 2025 recuperado por Codex

Se consultó la [API histórica de Open-Meteo](https://open-meteo.com/en/docs/historical-weather-api) con `models=era5`, las mismas ocho variables, coordenadas y zona `America/Panama`. La respuesta completa y URL están en [`cierre-2025-api.json`](epw/cierre-2025-api.json). Devuelve la celda 9° N, 79,5° O y 24 m. El registro de 01/01/2026 00:00 contiene 26,2 °C, 86 % HR, 16,2 km/h, dirección 339°, 62 % de nubes y cero lluvia/DNI/difusa.

[`preparar-cierre.py`](epw/preparar-cierre.py) reproduce la cuantización C107 y comprueba el solapamiento del 31/12/2025: **24 horas × 8 variables, cero diferencias** frente al binario existente. Escribe `fuente/src/epw-cierre.json`; los valores cuantizados son 26,1667 °C, 86 % HR, 16 km/h y 340°. Evidencia en [`cierre-verificacion.json`](epw/cierre-verificacion.json). El binario histórico no cambia.

`epw(clima, y)` usa esa hora adicional exclusivamente cuando el índice solicitado coincide con el cierre y la serie termina justo antes. Con ajuste activo aplica las mismas funciones y ruido determinista de `Clima.th`, prolongando una hora el ajuste mensual de Albrook a enero, 00:00. COMMENTS 2 declara esta prolongación y la fecha de consulta. En modo crudo conserva ERA5 cuantizado sin ajuste. No es una medición local. El contador y aviso de sustituciones siguen disponibles si faltan horas que no cubre el cierre.

Pruebas de [`auditar.mjs`](epw/auditar.mjs): 2024 idéntico byte a byte; en 2025 solo cambian COMMENTS 2 y la última fila frente a `aa47881`. La salida anterior tiene SHA-256 `98d65c44c2982e84e547c6c4541fa4e4f4515686f9e58eb1f88bf98521255c7e`. El cierre coincide con una extensión del C107 solo en memoria leída por `Clima.th`; modo crudo comprobado; una serie acortada una hora conserva el aviso de dos sustituciones. El JSON de resultados contiene la nueva última fila y hashes.

Compilación completada con `bash fuente/armar-raiz.sh`: versión local `49579a24a4`; `index.html` y `js/app.js` regenerados. Vite informó avisos sobre `inlineDynamicImports` y `new URL('../', import.meta.url)`; no bloquearon el armado. No publicado.

## Importación local en CBE completada

[`importar-cbe.py`](epw/importar-cbe.py) carga la aplicación original del commit `8e3d08911b93aded23589c247ca997cea462f7a6`, entrega el EPW en base64 a `submitted_data` con el evento de carga de Dash y ejecuta `create_df` completo, incluidos los cálculos derivados. El código de CBE no se modificó. Se usó Python 3.11.15 en un entorno temporal aislado, con las versiones fijadas en su Pipfile; las versiones numéricas efectivas se guardan en los informes y el entorno completo en [`cbe-requirements.txt`](epw/cbe-requirements.txt). No se añadió una dependencia al visor.

| Prueba | 2024 | 2025 con cierre recuperado |
| --- | --- | --- |
| Callback de carga | Éxito, verde | Éxito, verde |
| Filas / columnas tras procesamiento | 8.760 / 65 | 8.760 / 65 |
| Diferencia máxima en 14 campos comparados, todas las filas | 0 | 0 |
| Período devuelto por CBE | 2020–2030 | 2020–2030 |

Los 14 campos incluyen fecha/hora, temperatura seca y rocío, humedad, presión, GHI/DNI/DHI, dirección y velocidad de viento y nubosidad. Los cuatro registros de frontera y las estadísticas están en [`cbe-importacion-2024.json`](epw/cbe-importacion-2024.json) y [`cbe-importacion-2025.json`](epw/cbe-importacion-2025.json). Filtros: todos los meses y horas; unidades SI. La comparación exacta cubre campos importados; no valida los valores derivados de UTCI ni el modelo de confort contra mediciones. Los informes cuentan los NaN derivados sin ocultarlos.

Reproducir desde la raíz con el Python del entorno de CBE: `python docs/analisis/epw/importar-cbe.py /ruta/clima /ruta/archivo.epw /ruta/resultado.json`. Para generar el EPW actualizado de 2025: `node docs/analisis/epw/auditar.mjs /ruta/archivo2024.epw /ruta/salida2025.epw`. La prueba ejercita el callback y procesamiento originales; no automatiza un navegador ni acredita funcionamiento del despliegue público.

## Estado para el relevo

Análisis, recuperación y pruebas terminados. Queda publicar los cambios del visor cuando LM indique «publica», siguiendo fetch, reconciliación y guardia del repo. Para cualquier uso académico de CBE, rotular el año concreto y conservar filtros y versión; sus metadatos automáticos no justifican presentar 2024 o 2025 como una década.

El [GLB de Descargas](../ciudad/GLB-DESCARGAS-USOS.md) permanece descartado para integración. CBE analiza clima; el EPW no contiene edificios ni sombras específicas y no resuelve el microclima urbano.
