# Edificio 106 · Isthmus: instrucciones del proyecto

Visor 3D de sol y clima del Edificio 106 de Isthmus (Ciudad del Saber, Panamá). En vivo en https://caamanoluismiguel.github.io/edificio-106/ (GitHub Pages desde `main`, raíz). Repo público. Dueño: LM (Luis Miguel Caamaño); habla español, con tuteo.

Lo usan docentes, estudiantes y pares académicos de arquitectura. **Lo que más importa es la credibilidad:** cada número y cada regla tienen que tener una fuente real y verificable.

## Mapa

- **Raíz = sitio publicado.** `index.html` y `js/app.js` son generados; `modelo/*.glb`, `datos/` (clima empaquetado), `texturas/`.
- **`fuente/`** tiene el código:
  - `cuerpo.html` es la página, con todo el texto y el CSS;
  - `src/` es la app: `main.js` (interfaz), `escena.js` (three.js con WebGPU y WebGL 2), `sol.js`, `clima.js`, `confort.js`, `luna.js`, `interiores.js`;
  - los scripts que tocan los GLB: `entrada.mjs`, `portico.mjs`, `barandas.mjs`, `arbustos.mjs`, `contexto.mjs`, `arboles.mjs`, `arboles-cds.mjs` (todos los árboles en `modelo/arboles.glb` y `arboles_movil.glb`, instancias de `molde-arbol.glb`; los 13 cercanos de `arboles_reales.json`, acomodados por `arboles-acomodar.mjs`; las copas de `arboles_cds.geojson`, que sale de `arboles-chm/`, menos `arboles_excluidos.json`), `arboles-reales.mjs` (quita el anillo de relleno de `vegetacion.glb`);
  - el clima: `descargar_era5.py` y `clima_bin.py`;
  - las pruebas: `verificar.mjs`, `guardia.mjs` y `verificar-geometria.mjs`.
- **`ar/`** es la realidad aumentada sobre la tarjeta impresa, autocontenida. No usa el build de `fuente/`: tiene import map y la carpeta `vendor/`.

## Armar

- `bash fuente/armar-raiz.sh`: compila con Vite, copia `js/app.js` y escribe `index.html` desde `cuerpo.html` con la huella `?v=`.
- **Nunca** editar `js/app.js` ni `index.html` a mano.
- **Nunca** fusionar `app.js` como texto en un rebase: se recompila.
- `fuente/node_modules` puede ser un enlace simbólico a otro worktree. No se comitea nunca: `git add` solo con rutas explícitas.

## Antes de publicar (sin excepciones)

1. `git fetch` y comprobar las dos direcciones contra `origin/main`. Codex y otras sesiones de Claude empujan a main en paralelo. Si main avanzó, rebase y recompilar.
2. Si se tocó un GLB: `cd fuente && node estado.mjs --comprobar` contra la foto de `fuente/estado/` (pieza por pieza); solo pueden aparecer las piezas que el cambio dice tocar. Al aprobarse, `node estado.mjs` rehace la foto. Checklist legible en `fuente/estado/ESTADO.md`.
3. `cd fuente && node guardia.mjs`: git (avance rápido, sin borrados), modelo (GLB byte a byte y nodo a nodo) y 18 cuadros píxel a píxel contra main. Con un efecto nuevo, correrlo también con `--url=<param>=0`.
4. Si se tocó la escena: `cd fuente && node verificar.mjs` (7 comprobaciones, unos 6,5 min). Los controles que deben fallar: `--control-sesgo=0.35` (comprobación 2) y `--control-bias=-0.004` (comprobación 7).
5. Si se tocó `ar/`: `node ar/probar.mjs --video=<cámara falsa>.y4m`, `node ar/silueta.mjs` y `bash ar/verificar-huellas.sh`.
6. Escanear secretos en lo que se va a comitear (`AIza`, `sk_`, `sbp_`, `whsec_`).
7. **Publicar solo cuando LM dice «publica» en ese turno.** El clasificador bloquea el push a main sin esa autorización.

Hay un hook `pre-push` en `.git/hooks`, compartido por todos los worktrees. Bloquea un push a main que no contenga el main remoto o que borre archivos. Para borrar a propósito: `PERMITIR_BORRADOS=1`.

Después del push, Pages tarda de 1 a 3 minutos. Comprobar que lo que está en vivo es igual a lo local (md5 de los archivos servidos).

## El modelo no se daña

- **Nunca reexportar grupos desde un `.blend`.** El sitio salió de `Isthmus_v016.blend` y después se corrigieron en los GLB el pórtico, la entrada, las barandas y los setos. Ningún `.blend` tiene esas correcciones: el modelo más nuevo son los `modelo/*.glb` de main.
- Una pieza se corrige con su script (`portico.mjs`, `entrada.mjs`…), partiendo del GLB de main. Después se prueba que no regresó nada: `--medir`, `verificacion/entrada/comparar.mjs` nodo a nodo y el guardia.
- El pórtico correcto: columnas en x 11,70 y 13,90 (2,20 m entre ejes), columna trasera en 11,46, capitel a 2,40 m, viga, zapatas y cinco cabios.

## Reglas de contenido (de LM)

- **Verificador siempre (`.claude/agents/verificador.md`).** Toda cifra, fuente, regla, recomendación o texto nuevo o cambiado pasa por el verificador antes de publicarse, también los informes del panel de expertos y los cálculos propios. Comprueba que cada número se recalcule, que cada fuente diga lo que se le atribuye, que las cifras cuadren en todo el visor y que nada sea subjetivo. Lo FALSO, INCOHERENTE o lo que presente un modelo como medición bloquea la publicación.
- **Panel de expertos antes de publicar información nueva** (cifras, recomendaciones, capas): expertos del tema con contexto de Panamá, uno de visualización o UX y un crítico que cruce los informes. Las fuentes se verifican contra el original (DOI, URL oficial, página) y los números clave se comprueban con los datos del visor. Se prefieren las fuentes panameñas: IMHPA, ETESA, la Guía de Construcción Sostenible de 2016, la UTP.
- **Clima de Panamá:**
  - estación seca de diciembre a abril, con alisios del norte y el noroeste;
  - lluvias de mayo a noviembre;
  - veranillo en julio;
  - humedad alta todo el año;
  - dos días sin sombra (abril y agosto).
- **Texto:**
  - tuteo, nunca voseo;
  - nada de guiones como separadores;
  - nada de ritmo de IA (tríadas, antítesis, frases eslogan);
  - lenguaje técnico: «incide», «se proyecta»;
  - números con coma decimal y punto de miles (`num()` en main.js; `toLocaleString('es-PA')` da formato de EE. UU.).
- **Interfaz:**
  - sin degradados;
  - solo se renombran los botones listados en el glosario de `~/projects/edificio-106-UX-MANUAL.md`; «Confort» no cambia;
  - no sobrecargar;
  - poco esfuerzo y alto valor primero;
  - ámbar (`--sol`) solo para lo que es el sol (brújula, regla, lente Sol), la acción primaria (`.primario`, play), los enlaces y los eyebrows de los paneles; lo seleccionado o encendido va en crema (`--cal`) y los bordes de panel en `--linea-2`;
  - escala de letra: 11 · 12 · 13 · 14 · 15 · 16 · 18 · 22 px (26, 30 y 46 para títulos y la hora); radios: 8 chips · 12 tarjetas · 18 paneles · 999 píldoras. Nada de medios píxeles;
  - las fuentes de Google se cargan en los pesos que el CSS pide (Plex Mono 400/500/600): un peso que no está cargado sale como negrita sintética.
- **Honestidad:** decir lo que no hace (interior, CFD, desagües). ERA5 es una celda de ~28 km: marca de 0,2 a 0,9 g/kg más de humedad que Albrook (2017–2025) y aplana la oscilación del día (4 a 6 °C; Albrook, 5 a 8). Albrook es un aeropuerto a 4,1 km: nunca decir «medido en Clayton» ni «llueve aquí» por un parte de Albrook. Tampoco «llovieron» ni «llueve» por un dato de ERA5: «ERA5 da». «Fuerte» es la clase de la OMM (10 mm/h o más, WMO-No. 8, 2023, vol. I, p. 484), la misma del parte. Lavers et al. (2022) usa lluvia diaria: no citarlo para la hora de la lluvia. No afirmar el año de construcción, el uso original ni el autor del 106: en los planos de CERL de los años 30, el «106» era un galpón de madera.
- **Descartado por LM, no proponer de nuevo:** recorridos con sombra, lluvia de la ACP, consumo eléctrico, captación de agua, el catálogo retocado con IA, la reexportación desde Blender y la AO horneada (+842 KB, casi invisible).

## Datos

- **Serie:** ERA5 por la API de archivo de Open-Meteo, celda 9,000° N 79,500° O, 2001–2025, en hora de Panamá (UTC−5 todo el año).
- **Formato binario C107:**
  - lluvia en uint16 a 0,1 mm;
  - temperatura `/6+10`;
  - humedad en %;
  - directa y difusa ×4;
  - viento en km/h;
  - dirección ×2.
- `descargar_era5.py` reproduce el binario byte a byte.
- **Ajuste a Albrook (`fuente/ajuste_albrook.py` → `datos/ajuste_albrook.json`, aplicado al leer en `src/ajuste.js` y en `confort.mjs`):** temperatura por cuantiles por mes y hora, humedad menos el sesgo de cada mes; calibración 2017–2025; ERA5 y METAR desredondeados con ruido fijo (sin eso, los empates de los pasos de 1/6 °C mueven el resultado un 5 %). Solo 2001–2025. El binario C107 no cambia. `resultado.hora_calor` es la hora más calurosa ajustada (27/03/2010 14:00, 35,6 °C): el chip de «25 años» la usa en lugar de la cruda de `clima_resumen.json` (32,8 °C, que queda como referencia). `?era5=crudo` lo apaga en la lectura por hora (la carta de 25 años va ajustada y muestra lo crudo como referencia). Los METAR (IEM) están en `~/projects/edificio-106-estaciones/metar/`; al archivo le faltan las lluvias de 2011, 2015 y 2016, así que las cifras de lluvia contra Albrook usan 2017–2025.
- **«Ahora» con Albrook (`cargarVivo` en clima.js):** último parte de MPMG en `mesonet.agron.iastate.edu/api/1/currents.json` (deja leer desde el navegador), vigente 90 min (provisional: medir la latencia). Temperatura, humedad y viento del parte; lluvia solo si lo hizo un observador (de 23 a 5 h es AUTO). VC y TS solo no son lluvia (WMO-No. 306). Nubes, luz y los mm para la lluvia con viento, del modelo.
- **Umbral de lluvia (`umbralLluvia` en clima.js):** 1 mm en la hora de diciembre a marzo y 1,5 mm de abril a noviembre, el mismo en escena, textos y Confort. Por debajo, «lluvia débil en la celda». Mientras la escena dibuja lluvia (dato desde el umbral, parte de Albrook con observador o la capa «Aguacero»; `lluviaDibujada` en main.js) no dibuja sol directo (kSol = 0); la DNI del dato sigue en el dock y en la lente Sol. Solo moja la lluvia desde el umbral (`mojado` en clima.js). Con 90 % de nubes o más y 120 W/m² o más, los textos dicen «sol a ratos» (`solARatos`). La regla del día pinta llenas las barras desde el umbral y tenues las de 0,1 mm al umbral. Excepción aceptada por el verificador: la probabilidad típica (`probLluvia` de `clima_resumen.json`, que sale de `clima_bin.py` con las descargas crudas) cuenta 1 mm todo el año; el texto lo dice («1 mm o más») y en lo típico la escena no llueve.
- **Sol:** NOAA/Meeus, verificado contra Michalsky y SPA. `Date.UTC` trunca los minutos fraccionarios: se suman aparte.

## Realidad aumentada (`ar/`)

- **Cómo funciona:** MindAR 1.2.5 (en `vendor/`, sin modificar) se usa solo como `Controller`, porque su envoltorio de three importa `sRGBEncoding` y no carga con three 0.186. La escena va en metros y la cámara se mueve con la inversa de la pose.
- **Gotcha de MindAR:** el video necesita los atributos `width` y `height`. Sin ellos, MindAR dibuja 0 × 0 y no encuentra nada, sin dar ningún error.
- **La tarjeta:** carta apaisada que también cabe en A4, plano a 1:320 (83,1 × 48 m del sitio).
  - Se regenera con `node ar/generar-tarjeta.mjs`, que falla si el plano tiene menos de 1.000 puntos de rastreo.
  - El techo del plano usa las tejas livianas: con las completas, MindAR no lo reconoce.
  - Si cambia la imagen del plano, cambia `plano.mind` y las tarjetas impresas antes dejan de servir.
- **Filtro:** `filterMinCF` 0,0001 por defecto (lo eligió LM porque temblaba); `?suave=0` vuelve al anterior. La cámara falsa no reproduce el temblor real: el temblor se juzga en el celular.
- **Probado** por LM en Android con Chrome, vertical y girado, también apuntando a la pantalla del computador. **iPhone sin probar.**
- **Pendiente:** selector de fechas (solsticios y días sin sombra), mensajes de error y ayuda, `visibilitychange`.

## Gotchas

- **Entorno (`contexto.glb`):** se rehace con `node contexto.mjs` (ver README, «El entorno»). Una malla grande pierde precisión al cuantizar (17 cm en 6 km): lo cercano va en mallas propias. `dedup` funde materiales iguales aunque cambie el nombre. En WebGPU no cambiar `mesh.geometry` de algo ya dibujado. Los barcos son ilustrativos (1 cada 2 h por vía).
- Los `.bin.gz` se sirven como `application/gzip` sin `Content-Encoding`, y la app los abre con `DecompressionStream`. Las rutas son siempre relativas (`/edificio-106/`).
- `?prueba` expone `window.__e106` y `?rapido` acorta la intro. En las capturas, fijar el momento (`#m-…`) y esperar a que aparezca la fecha.
- La comprobación 5 («en reposo») toma el peor cuadro: no es fps. Nunca correr dos pruebas de rendimiento en paralelo.
- El stash de git es compartido entre worktrees. Nada de `git stash` a secas: se usa un commit temporal.

## Referencias fuera del repo (en la máquina de LM)

- `~/projects/edificio-106-AR-PLAN.md`: plan y lecciones de la AR.
- `~/projects/edificio-106-auditoria-2026-09-30.md`: auditoría de expertos de lo publicado.
- `~/projects/edificio-106-UX-PLAN.md`: plan de interfaz en 4 fases, glosario aprobado y pendientes en espera.
- `~/projects/edificio-106-UX-MANUAL.md`: manual de interfaz con la investigación y las fuentes.
- `~/projects/edificio-106-UX-prototipo.html`: prototipo de comportamiento (no es código para copiar).
- `~/Documents/Web/libros-climatizacion/`: las fuentes en PDF y `REGLAS_EXTRAIDAS.md`, las reglas con su página.
