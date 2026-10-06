# Lighthouse, 6 de octubre de 2026

Medición del sitio en vivo (https://caamanoluismiguel.github.io/edificio-106/, compilación `app.js?v=b00683ef89`, la de `main` en `769a076`) con Lighthouse 13.5.0 en Chrome sin pantalla (`--headless=new`) desde el Mac de LM. Cinco corridas seguidas por perfil, una tras otra y nunca dos a la vez, entre las 15:33 y las 15:35 UTC.

- **Computador:** `--preset=desktop` (40 ms de latencia, 10 Mbit/s, CPU sin frenar).
- **Teléfono:** el perfil por defecto de Lighthouse, que simula un celular de gama media con 4G lenta (150 ms, 1,6 Mbit/s, CPU 4 veces más lenta).

Lighthouse corre sin tarjeta gráfica: mide la carga de la página, no lo fluida que se ve la escena 3D una vez cargada.

## Notas (de 0 a 100)

| Corrida | Computador | Teléfono |
|---|---|---|
| 1 | 68 | 27 |
| 2 | 66 | 30 |
| 3 | 72 | 27 |
| 4 | 64 | 30 |
| 5 | 53 | 30 |
| **Mediana** | **66** | **30** |

Accesibilidad, buenas prácticas y SEO dieron 100 en las diez corridas.

## Tiempos (mediana de cada medida)

| Medida | Computador | Teléfono |
|---|---|---|
| Primera imagen en pantalla (FCP) | 1,19 s | 4,02 s |
| Contenido principal visible (LCP) | 1,88 s | 8,37 s |
| Tiempo con la página bloqueada (TBT) | 365 ms | 3.848 ms |
| Índice de velocidad | 2,97 s | 9,07 s |
| Movimiento del diseño (CLS) | 0,002 | 0,010 |

## Archivos

Los informes completos de la corrida 2 de cada perfil, que es la que dio la nota mediana, están comprimidos junto a este archivo: `lighthouse-2026-10-06-escritorio.json.gz` y `lighthouse-2026-10-06-telefono.json.gz`. Se abren en https://googlechrome.github.io/lighthouse/viewer/ después de descomprimirlos.

No hay una medición anterior guardada con la que comparar.
