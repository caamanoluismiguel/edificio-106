# CBE Clima: uso actual y utilidad para Edificio 106

Fecha: 7 de octubre de 2026. Autor: OpenAI Codex, a solicitud de Luis Miguel Caamaño. Repo local y `origin/main` revisados en `75c21ca`. CBE Clima consultado en `8e3d08911b93aded23589c247ca997cea462f7a6` (1 de octubre de 2026).

## Respuesta

**Ya existe interoperabilidad prevista mediante EPW; no se encontró una integración de la aplicación CBE Clima como dependencia o servicio del visor.** Además, el proyecto porta cálculos de `pythermalcomfort`, que pertenece al mismo centro, pero es un proyecto distinto. No se encontró en lo revisado un informe que pruebe que el EPW del visor se haya importado y contrastado efectivamente en CBE Clima.

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

En Descargas existe `edificio106_era5_ajustado-albrook_2024.epw`. Se inspeccionó localmente: 8 líneas de cabecera, 8.760 registros horarios, saltos CRLF y 35 campos en el primer registro. Eso confirma la estructura básica y que hay un archivo disponible, no una importación exitosa en CBE Clima.

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

Por eso hay que revisar las convenciones de hora 1–24, UTC−5, unidades de viento/radiación, días bisiestos, campos faltantes y el último registro del año al comparar programas. Son puntos de verificación propuestos, no errores demostrados en esta evaluación.

## Siguiente paso recomendado

Usar CBE Clima como herramienta externa de exploración y contraste del EPW que ya exporta el visor. Primera prueba: importar el EPW de 2024, comprobar que se lee, contrastar una muestra de registros y estadísticas de temperatura, humedad, viento y radiación, y guardar gráficos con sus filtros y versión. Después comparar otro año o un EPW de referencia claramente identificado.

No se ha realizado esa importación en esta revisión ni se ha enviado el archivo a un servicio externo. Tampoco se ha añadido una dependencia, instalado Clima o modificado el sitio. Un despliegue propio de la aplicación Python requeriría ejecución de servidor además de GitHub Pages; no hace falta asumir ese trabajo para aprovechar los EPW existentes.

El [GLB de Descargas](../ciudad/GLB-DESCARGAS-USOS.md) y CBE Clima aportarían cosas distintas: geometría urbana por un lado y lectura del clima por otro. Combinarlos no crea automáticamente una simulación de microclima o ventilación urbana.
