# Verificación para publicar

8 de octubre de 2026. Codex revisó el cambio 954f9e1 frente a origin/main 75c21ca. LM autorizó «publica» en este turno.

| Afirmación | Veredicto | Evidencia |
| --- | --- | --- |
| Main está contenido y no hay borrados | VERIFICADO | Fetch y rev-list: 0 commits remotos pendientes, 5 locales; guardia git |
| Los modelos no cambian | VERIFICADO | Guardia: los 14 GLB son idénticos byte a byte |
| No hay regresión visual detectada | VERIFICADO | 18 casos WebGPU aprobados; lente-sombras tiene 2 píxeles sobre umbral, dentro del máximo de 10 |
| Todos los grupos cargan | VERIFICADO | Guardia de carga: teléfono/computador, variantes árboles/ciudad y WebGL 2 aprobadas |
| EPW 2024 no cambia; cierre 2025 usa ERA5 adicional | VERIFICADO | Auditoría reproducible y cotejo C107 de 24 horas × 8 variables; el revisor numérico confirmó el recálculo |
| CBE importa los valores de 2024 | VERIFICADO | Repetición del callback/lector original: informe idéntico al versionado |
| 322 huellas repetidas y 660 trazados emparejados | VERIFICADO | Conteos y listas de resultados GLB; seis identidades OSM recalculadas con verificar_muestra.py |
| Alturas genéricas no son mediciones | VERIFICADO | Reglas del código oficial map3d 2c5d732 y 604+62 coincidencias versionadas |
| UX y alcance del informe son coherentes | VERIFICADO | Revisor UX aprobó: no cambia interfaz; procedencia viaja con EPW; importación local no se presenta como prueba del servicio público |

El revisor numérico confirmó su recálculo antes de agotarse los créditos. El revisor urbano no terminó por la misma limitación. Codex principal completó la revisión de fuentes, coherencia y muestra; no se presenta como un panel independiente completo. No se detectaron afirmaciones falsas, incoherentes o que confundan modelo con medición. La recomendación de no integrar GLB es una decisión de proyecto sustentada en redundancia y ausencia de beneficio demostrado, no una medición científica de utilidad.

Se reabrieron el código oficial map3d y la página oficial del campus citados en los informes. Se conservan los límites: altura real no acreditada, parques no delimitados por este GLB, año concreto en CBE y ajuste de Albrook prolongado una hora en el cierre. Escaneo del cambio completo sin patrones de credenciales. No se tocó escena, AR, modelos ni serie C107.

El informe completo del guardia está en publicacion-verificacion.json. Las verificaciones de contenido están en los informes EPW y GLB enlazados desde STATE.md. Los avisos de Vite sobre inlineDynamicImports y new URL no impidieron el build 49579a24a4.
