# Qué entra en cada DOI

El visor se archiva en Zenodo en dos registros, como decidió el autor el 6 de octubre de 2026. Ninguno existe todavía. Este archivo dice qué lleva cada uno, cómo se separan y cómo se enlazan. Lo que todavía depende de Google Street View o de Google Maps está en `TERCEROS.md` y no se esconde: cada dato dice su fuente hasta que se vuelva a observar en sitio.

## DOI 1: el 106 y su clima (software)

Registro de software que crea la integración de Zenodo con GitHub al publicar la etiqueta `v1.0.0` (ver `docs/VERSIONES.md`). Zenodo baja el zip de la release, que GitHub arma con `git archive`, y lee los metadatos de `.zenodo.json` (si existe, no lee `CITATION.cff`).

**Entra:** el código del visor (`fuente/`, `index.html`, `js/app.js`, `sw.js`), el modelo del 106 y su entorno inmediato (`modelo/*.glb` menos los de la ciudad), el clima (`datos/`), las dos lecturas, «Arquitectura y clima» y «Diseño industrial» (`datos/di/`, `datos/familias.json`, `fuente/src/mecanismos/`), la realidad aumentada (`ar/`), la hoja del gnomon (`gnomon/`), las validaciones (`docs/validacion/`), la historia, los análisis y las pruebas (`fuente/verificacion/`, salvo la hoja de abajo). También las bases de las que salen el entorno y los árboles (`fuente/osm.json`, `fuente/osm-amplio.json`, `fuente/osm-estacionamientos.json`, `fuente/alturas_ob.json`, `fuente/arboles_cds.geojson`, `fuente/relieve.json`): la ODbL (4.6) pide ofrecer la base derivada a quien recibe una obra producida con ella.

**Queda fuera del zip** (lista exacta en `.gitattributes`, con `export-ignore`; los archivos siguen en el repositorio y en el sitio):

| Qué | Por qué |
|---|---|
| La ciudad: `docs/ciudad/`, `datos/ciudad_mapa.json`, `datos/ciudad_fichas.json`, `modelo/ciudad.glb`, `modelo/ciudad_alto.glb`, `fuente/ciudad-observado.json`, `fuente/ciudad-ajustes.json`, `fuente/arboles_reales.json`, `fuente/arboles_excluidos.json` y los scripts que la arman (`fuente/ciudad*.mjs`, `fuente/inventario-ciudad.mjs`) | Lleva observaciones de Street View campo por campo o sale de ellas. Va en el DOI 2 |
| `fuente/verificacion/entrada/comparativa-entrada.png` | Lleva la foto WA0014; se reemplaza por una foto propia de la fachada |
| `.claude/` y `ar/HUELLAS.txt` | Instrucciones de trabajo y huellas con rutas de la máquina del autor; no son parte de la obra |

Sin la ciudad, el visor archivado no la dibuja: es un archivo para citar y preservar, no una copia para publicar (ver `LICENSE`). Dos fichas de «Diseño industrial» (Losa de entrepiso y Alero y su sofito) citan `docs/ciudad/espiga/kit-medidas.json`, que queda fuera; entra con el DOI 2.

**Sigue dentro y depende todavía de Street View o de Google Maps** todo lo listado en `TERCEROS.md`, entre ello el pórtico del 106 (`modelo/entrada.glb` y sus copias en `ar/`), las alturas de tres vecinos, el cerramiento y la estructura del cuadrángulo en `modelo/contexto.glb`, y los 13 árboles cercanos de `modelo/arboles.glb`. Se publica el DOI 1 cuando todas las piezas de esa lista de `TERCEROS.md` se hayan vuelto a observar en sitio.

**Licencia en Zenodo:** `other-closed` («Other (Not Open)» en el vocabulario de Zenodo), que corresponde a «Todos los derechos reservados» con los permisos de `LICENSE`. El acceso es abierto: los archivos se ven y se bajan, y su uso sigue a `LICENSE`. Zenodo admite una sola licencia en `.zenodo.json` y la aplica a todo el registro, así que las licencias de terceros van en `notes` y, una vez publicado, se agregan en la web del registro (ODbL 1.0, CC BY 4.0, CC0 1.0, MIT, Apache 2.0 y la de Copernicus WorldDEM-30). Los metadatos de Zenodo quedan con CC0, como en todo registro.

**Cómo se comprueba el zip antes de etiquetar:**

```
git archive --format=tar HEAD | tar -t | grep -E '^(docs/ciudad|datos/ciudad|modelo/ciudad|fuente/ciudad|fuente/inventario-ciudad|fuente/arboles_(reales|excluidos)|\.claude)|comparativa-entrada|HUELLAS'
```

No debe mostrar nada.

## DOI 2: la ciudad (datos)

Registro aparte, de tipo `dataset` y con licencia `odbl-1.0`: es una base derivada de OpenStreetMap y de Open Buildings que el visor usa en público, y la ODbL (4.4) pide que vaya con esa licencia, como ya dice `LICENSE` en su punto 1. Los derechos reservados del 106 no cambian: son dos registros con dos licencias.

Se crea **después del levantamiento en sitio**. Lo que solo se leyó en Street View y no se haya vuelto a observar se quita del paquete y se dice en su LEEME; nunca se cambia la fuente a «observación del autor» sin haber ido a mirar.

**No lo crea la integración de GitHub** (esa solo lee `.zenodo.json`): se sube a mano en zenodo.org con un paquete de datos.

1. Quitar de `.gitattributes` las líneas de la ciudad y publicar una versión nueva del software (`v1.1.0` o la que toque), para que el código, los GLB y la documentación de la ciudad entren en el registro del visor con la licencia del autor.
2. Armar el paquete con las bases, en formato legible por máquina:
   ```
   git archive --format=zip -o ciudad-datos-vX.Y.Z.zip vX.Y.Z -- \
     docs/ciudad/edificios.json docs/ciudad/inventario.json docs/ciudad/limite-propuesto.geojson \
     docs/ciudad/espiga/kit-medidas.json datos/ciudad_mapa.json datos/ciudad_fichas.json \
     fuente/ciudad-observado.json fuente/ciudad-ajustes.json fuente/arboles_cds.geojson \
     fuente/arboles_reales.json fuente/arboles_excluidos.json fuente/alturas_ob.json \
     fuente/osm.json fuente/osm-amplio.json fuente/osm-estacionamientos.json fuente/relieve.json
   ```
   y agregarle un `LEEME.md` con el diccionario de campos, las clases de certeza, los avisos de cada fuente y la lista de lo que se quitó por venir solo de Street View.
3. En zenodo.org, «New upload»: subir el zip y llenar los metadatos de `docs/doi/zenodo-ciudad.json` (o mandarlos por la API de depósito). Antes, cambiar en ese archivo los dos enlaces al repositorio por el DOI de la **versión** del visor de la que sale el paquete (`isSupplementTo` e `isCompiledBy`), y agregar como `contributors` a quienes hicieron el levantamiento.
4. Ya publicado, editar los metadatos del registro del visor y agregar el DOI 2 con la relación `isSupplementedBy`. Editar metadatos no crea una versión nueva.

Sin comunidad de Zenodo por ahora: con dos registros enlazados basta, y una comunidad se puede crear después sin tocar los DOI.

Las relaciones siguen el esquema de DataCite 4.6: `IsSupplementTo` (A es un suplemento de B), `IsCompiledBy` (B se usó para crear A), `IsDerivedFrom` (B es la fuente de la que sale A) y `References` (B se usó como fuente de información para A).
