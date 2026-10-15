# Versiones

Hasta octubre de 2026 el visor se citaba por fecha («versión del 1 de octubre de 2026») y no tenía etiquetas. Desde el primer DOI usa versiones numeradas con etiqueta de git, y cada etiqueta publicada como release de GitHub crea en Zenodo una versión con su propio DOI, bajo un DOI de concepto que reúne todas.

## Esquema

`vMAYOR.MENOR.PARCHE`, como en [SemVer 2.0.0](https://semver.org/lang/es/), leído para un visor con datos:

- **PARCHE** (`v1.0.1`): se corrige un error o un texto sin que cambie ninguna cifra publicada ni lo que se puede hacer.
- **MENOR** (`v1.1.0`): algo nuevo (una lente, una lectura, un dato, una parte que entra al archivo, como la ciudad) sin que cambien las cifras que ya estaban.
- **MAYOR** (`v2.0.0`): cambia una cifra o una regla ya publicada (otra serie de clima, otro ajuste, otra definición de temporada) o se quita algo. Quien citó la versión anterior tiene que poder ver que ya no es la misma.

La primera es `v1.0.0`, la del DOI 1 (el 106 y su clima, sin la ciudad; ver `docs/doi/ALCANCE.md`). Mientras no exista esa etiqueta, `CITATION.cff` dice `1.0.0-rc.1`: candidata a la 1.0.0, no publicada en Zenodo.

## Cómo se hace una versión

Nada de esto se hace sin el «publica» del autor en ese turno.

1. En una rama, poner en `CITATION.cff` la versión (`version: "1.0.0"`, sin la `v`) y la fecha de hoy (`date-released`), y en el README y en `fuente/cuerpo.html` («Cómo citar») la misma versión. `.zenodo.json` no lleva versión: Zenodo toma el nombre de la etiqueta.
2. Validar: `cffconvert --validate -i CITATION.cff` y el `.zenodo.json` contra el esquema de depósito de Zenodo (ver `docs/doi/ALCANCE.md`). Comprobar con `git archive` que el zip no lleva lo que debe quedar fuera.
3. Armar, pasar el guardia, `estado.mjs --comprobar` y `verificar.mjs` como en cualquier publicación, y publicar en `main`.
4. Crear la etiqueta anotada sobre ese commit de `main` y subirla:
   ```
   git tag -a v1.0.0 -m "v1.0.0: el 106 y su clima"
   git push origin v1.0.0
   ```
5. En GitHub, Releases → Draft a new release → elegir la etiqueta → título y notas de qué cambió → Publish release. Si la integración con Zenodo está activa, Zenodo baja el zip y crea la versión. Un borrador de release no dispara nada; solo la release publicada.
6. Cuando Zenodo muestre el DOI: en `CITATION.cff`, `doi:` con el DOI de **concepto** (sirve para todas las versiones), y en «Cómo citar» del README y de `cuerpo.html` el DOI. Ese cambio va en el siguiente commit; no hace falta otra etiqueta para él.

Una etiqueta publicada no se mueve ni se borra: si algo salió mal, se hace la versión siguiente.
