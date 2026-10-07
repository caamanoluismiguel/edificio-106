# Corrección del panel Confort en móvil

Fecha: 7 de octubre de 2026 (Bogotá).

**Autoría del ajuste: OpenAI Codex**, a solicitud de Luis Miguel Caamaño, quien detectó el problema y aportó una captura de su teléfono. Codex inspeccionó la captura, reprodujo el fallo, modificó el CSS, recompiló el sitio y comprobó el resultado con Playwright/Chromium. Este registro también fue redactado por Codex.

Base: `5f8979c9fc151986a72cc9bd0fe216150374eae5`. Rama de trabajo: `fix/confort-movil`. Implementación registrada en `fe86812`; LM autorizó después la publicación en GitHub Pages.

## Problema y causa

Al abrir «Confort térmico» en móvil, el panel quedaba reducido a una franja con el título y «Hay más abajo», sin espacio para leer las recomendaciones.

La regla `html.hoja-0 #confort` de `fuente/cuerpo.html` limitaba la altura al menor valor entre `38dvh` y el alto de la ventana menos la barra inferior, el área segura superior y **320 px reservados para la escena**. Con la barra inferior y una ventana reducida por la interfaz del navegador, esa reserva consumía casi todo el espacio del panel.

Se reprodujo en una ventana de 393 × 700 píxeles CSS, con el momento `#m-20240125-1950`: el panel medía **62 px**, frente a unos 318 px de barra inferior. Es una reproducción del síntoma de la captura; no una medición del teléfono de LM.

## Cómo lo corrigió Codex

1. En `fuente/cuerpo.html`, sustituyó la reserva fija de 320 px por 96 px para la cabecera y los márgenes. Conservó el límite de `38dvh` y descontó explícitamente las áreas seguras superior e inferior y el alto real de la barra (`--dock-h`).
2. Para el recorrido guiado, añadió `--confort-rec-h`: descuenta la altura real de la tarjeta del paso y los 6 px adicionales de separación. Así Confort permanece dentro de la ventana cuando se apila sobre esa tarjeta.
3. Conservó la regla de la hora y el desplazamiento interno del panel. La corrección afecta la distribución del espacio; no cambia el tamaño de letra ni los datos o cálculos de Confort.
4. Ejecutó `bash fuente/armar-raiz.sh` para regenerar `index.html` desde la fuente. El JavaScript compilado quedó idéntico. No se editó el HTML generado a mano.

La fórmula resultante para el alto máximo es:

```css
min(38dvh, calc(
  100dvh
  - env(safe-area-inset-top, 0px)
  - env(safe-area-inset-bottom, 0px)
  - var(--dock-h)
  - 96px
  - var(--confort-rec-h, 0px)
))
```

En ventanas bajas, el panel ocupa más del espacio que antes se reservaba a la escena para permitir la lectura.

## Comprobaciones y evidencia

Pruebas automatizadas con Playwright y Chromium, en contexto táctil emulado, redimensionado a las seis ventanas siguientes. Son píxeles CSS; los valores se redondean aquí, y las mediciones completas están en [resultado.json](resultado.json).

| Ventana | Alto del panel después |
| --- | ---: |
| 393 × 700 | 266 px (antes: 62 px) |
| 360 × 640 | 226 px |
| 390 × 844 | 321 px |
| 393 × 600 | 186 px |
| 820 × 700 | 260 px |
| 1440 × 900 | 806 px |

Pasaron las comprobaciones de altura, posición dentro de la ventana y desplazamiento hasta el final. En los tamaños móviles, el panel quedó por encima de la barra inferior, sin superponerla. También se comprobó cambiar la hora a las 13:00, cerrar y reabrir Confort, y llegar a la parada 11 del recorrido guiado: a 393 × 700 el panel midió 153 px y mostró la respuesta de sensación térmica. Codex inspeccionó visualmente las capturas del caso reproducido y del recorrido. La compilación y `git diff --check` terminaron correctamente.

- [Antes, 393 × 700](antes.png) y [medición original](baseline.json).
- [Después, 393 × 700](despues-393x700.png).
- [Después, parada de Confort del recorrido](despues-recorrido.png).

Para repetir manualmente: servir la raíz del repo, abrir `/?prueba&rapido#m-20240125-1950` con una ventana de 393 × 700, desplegar los controles con el asa y tocar «Confort». Leer y desplazar el panel, cambiar la hora y comprobar su cierre. En el recorrido, avanzar hasta la parada 11 y mostrar la respuesta.

Alcance de la validación: navegador de escritorio con emulación táctil; no se probó este ajuste en un teléfono físico. No se ejecutó `verificar.mjs`: el cambio es de distribución CSS y no modifica la escena ni sus cálculos.

## Verificación previa a publicación

El 7 de octubre, tras la autorización de LM, Codex ejecutó `git fetch origin`, confirmó que `origin/main` estaba contenido en la rama, recompiló y comprobó que el resultado coincidía con el commit. También cruzó las cifras de esta nota con los JSON y revisó los enlaces locales y las líneas añadidas en busca de los patrones de secretos del proyecto, sin coincidencias.

El guardia completo, `node fuente/guardia.mjs origin/main`, terminó con código 0 sobre `fe86812`, comparado con `5f8979c`. [Informe conservado](guardia.json):

- Git: avance rápido y ningún archivo borrado.
- Modelos: los 14 GLB comparados permanecen idénticos.
- Imagen: los 18 casos pasaron, con 0 píxeles por encima del umbral de 8 niveles. La mayor diferencia de un canal fue de 1 nivel.
- Carga: pasaron los 10 escenarios de teléfono y computador, incluidas las variantes de árboles, ciudad, WebGL 2 y preferencias guardadas.

No se cambió código después de estas pruebas; solo se agregó este registro de verificación.
