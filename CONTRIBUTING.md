# Cómo aportar

Gracias por querer mejorar el visor del Edificio 106. Está hecho para que docentes y estudiantes de arquitectura puedan revisar cada número y cada regla en su fuente. Por eso también sirve, sin tocar el código, reportar un dato que no cuadra o proponer una fuente mejor.

Antes de aportar, lee el [`LICENSE`](LICENSE): el repositorio no es de código abierto. Se puede ver, hacer fork en GitHub y aportar, pero publicar otra versión, usar copias locales para dar clase o cualquier uso comercial piden permiso escrito del autor, que se solicita en un issue.

## Formas de aportar

**Reportar un dato o una fuente incorrecta.** Abre un issue con la plantilla «Dato o fuente incorrecta». Di qué cifra o frase está mal, dónde aparece (en el visor, con el enlace del momento si se puede, o en un archivo del repo) y cuál es la fuente que lo contradice, con página o DOI.

**Proponer una fuente mejor**, sobre todo panameña: IMHPA, ETESA, la UTP, la Guía de Construcción Sostenible de 2016, planos o fotos de Ciudad del Saber. Usa la plantilla «Propuesta».

**Reportar un error del visor**: algo que no carga, se ve mal o no responde. Usa la plantilla «Error del visor» y di el equipo, el navegador y el enlace del momento.

**Corregir un edificio o un árbol de la ciudad.** La ciudad es aproximada y cada edificio tiene una clase de certeza ([`docs/ciudad/CIUDAD.md`](docs/ciudad/CIUDAD.md)). Si conoces un edificio (pisos, techo, color, si existe o no), una foto tuya o una observación en sitio sube su certeza. No envíes capturas de Street View ni de Google Maps: sus condiciones de uso no dejan publicarlas.

**Proponer un cambio de código o de texto** con un pull request (ver abajo). Para algo grande, abre antes un issue para conversarlo.

Antes de proponer una función, revisa en el README la sección «Qué no es» y en [`docs/HISTORIA.md`](docs/HISTORIA.md) la lista de lo descartado: hay ideas que ya se evaluaron y no se van a hacer.

## Reglas de contenido

Todo texto, cifra o regla nueva o cambiada pasa por una revisión de veracidad antes de publicarse. Facilita esa revisión:

- **Cada número con su fuente** y, si sale de un cálculo, el cálculo o el script que lo reproduce.
- **Un modelo no es una medición.** ERA5 es una celda de unos 28 km: se dice «ERA5 da», nunca «llovió» o «llueve aquí». Albrook es un aeropuerto a 4,1 km del 106: nunca «medido en Clayton».
- **No afirmar** el año de construcción, el uso original ni el autor del 106.
- **Texto en español con tuteo**, sin voseo. Lenguaje técnico («incide», «se proyecta»). Sin guiones como separadores de frases.
- **Números con coma decimal y punto de miles** (2.337 copas, 0,8). En el código, `num()` de `fuente/src/main.js`.
- **Interfaz:** sin degradados; el color ámbar solo para lo que es el sol, la acción principal y los enlaces.

## Cambios de código

### Lo que necesitas

- Node.js 22.12 o más nuevo (lo pide Vite 8).
- Python 3 solo para los scripts de datos (`fuente/*.py` y `fuente/arboles-chm/*.py`). Casi todos piden `numpy`; según el script, también `rasterio`, `shapely`, `scipy`, `pyproj`, `scikit-image`, `requests`, `pandas` o `pvlib`. `descargar_era5.py` usa solo la biblioteca estándar, y `export_web.py` corre dentro de Blender (`bpy`).

### Cómo está organizado

- La raíz es el sitio publicado en GitHub Pages. **`index.html` y `js/app.js` son generados: no los edites a mano.**
- `fuente/cuerpo.html` es la página, con todo el texto y el CSS.
- `fuente/src/` es la app: `main.js` (interfaz), `escena.js` (three.js), `sol.js`, `clima.js`, `confort.js`.
- Los modelos (`modelo/*.glb`) se corrigen solo con sus scripts (`portico.mjs`, `entrada.mjs`, `contexto.mjs`, `ciudad.mjs`…), partiendo del GLB actual. No se reexportan desde Blender: ningún `.blend` tiene las correcciones.
- `ar/` es la realidad aumentada, autocontenida.

### Armar y probar

```bash
cd fuente
npm install
bash armar-raiz.sh          # compila js/app.js y escribe index.html
```

Para verlo, sirve la raíz con cualquier servidor local (por ejemplo `npx serve ..`) y abre la página. `?prueba` deja el estado de la escena en `window.__e106` (se lee desde la consola) y `?rapido` acorta la intro.

Antes de abrir el pull request:

- `node guardia.mjs`: compara tu rama con `main` en git, en los modelos (nodo a nodo) y en 18 cuadros píxel a píxel. Si cambia algo que tu cambio no dice tocar, revísalo.
- Si tocaste la escena: `node verificar.mjs` (unos 6,5 minutos).
- Si tocaste un GLB: `node estado.mjs --comprobar`.
- Si tocaste `ar/`: las pruebas de `ar/` que lista el README en «Cómo se comprueba».

Si no puedes correr alguna, dilo en el pull request y la corre el autor.

### El pull request

- Una rama por cambio, con nombre `tipo/descripcion` (por ejemplo `fix/sombra-alero`).
- Mensajes de commit con el formato `tipo(ámbito): descripción` en español (`feat`, `fix`, `docs`, `chore`…).
- Incluye el `js/app.js` y el `index.html` recompilados.
- Describe qué cambia, por qué, con qué fuente, y qué pruebas corriste.

La publicación en el sitio la decide el autor.

## Lo que aceptas al aportar

Al enviar un aporte (issue, pull request, comentario, dato, foto o fuente) y marcar la casilla de aceptación de la plantilla, declaras que el aporte es tuyo o que tienes derecho a aportarlo. Conservas todos tus derechos sobre él y le concedes al autor una licencia no exclusiva para usarlo dentro de la obra, como dice el punto 4 del `LICENSE`. Tu aporte queda reconocido en el historial de git y, si es un dato o una fuente, en el texto que lo use cuando corresponda.

Aportar es voluntario. Si el visor se usa en un curso, aportar no puede ser condición para aprobarlo.

## Dónde preguntar

En los issues del repositorio: https://github.com/caamanoluismiguel/edificio-106/issues
