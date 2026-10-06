# Radiación en fachadas: el visor frente a Radiance

Contraste hecho el 6 de octubre de 2026 de la radiación anual que el visor da en cada fachada (pared sin alero, hallazgo «Sol directo: SE y SO reciben más del doble que la NO» y lente Sol en «Año típico»), calculada en `fuente/consultas.py`, contra Radiance 6.1a, un programa de trazado de rayos de Lawrence Berkeley National Laboratory.

## Qué se comparó

Los dos cálculos usan el mismo dato: la radiación directa normal y la difusa de cada hora de 2001 a 2025 (ERA5 por Open-Meteo, `datos/clima_horario.bin.gz`), en una pared vertical sin obstáculos de cada orientación, con el suelo al 20 %. Lo que cambia es el método:

- **El visor** suma el sol directo hora por hora, el cielo con el modelo de Hay y Davies (1980) y el suelo como la mitad del 20 % de la radiación global.
- **Radiance** reparte cada hora en un cielo de 2.305 parches con el modelo de Perez (`gendaymtx`, Perez et al., 1993) y calcula cuánto ve cada pared de cada parche con trazado de rayos (`rfluxmtx`).

Antes del año completo se comprobó una hora suelta (21 de marzo, 15:30, 800 W/m² de directa): Radiance da 522 W/m² en la SO y el visor 522; en el techo, 558 y 549.

## Resultado (kWh/m² al año, promedio 2001–2025)

| | SE | NO | NE | SO | Techo |
|---|---|---|---|---|---|
| Sol directo, visor | 374 | 144 | 302 | 362 | 1.058 |
| Sol directo, Radiance | 381 | 143 | 300 | 366 | 1.055 |
| Cielo, visor (Hay y Davies) | 325 | 287 | 317 | 324 | 712 |
| Cielo, Radiance (Perez) | 383 | 337 | 368 | 392 | 732 |
| Suelo, los dos | 177 | 177 | 177 | 177 | |
| **Total, visor** | **876** | **608** | **795** | **863** | **1.770** |
| **Total, Radiance** | **941** | **657** | **845** | **934** | **1.787** |

- **El sol directo coincide** en las cuatro fachadas, con diferencias de 2 % o menos. Esto prueba la geometría del sol y de las fachadas del visor contra un programa independiente.
- **El suelo coincide:** es la misma regla en los dos (en la SO, Radiance da 176 al restar cifras ya redondeadas).
- **El cielo difiere por el modelo.** Perez da entre 16 y 21 % más luz difusa en las paredes que Hay y Davies, porque además del brillo alrededor del sol cuenta el brillo del horizonte, que una pared vertical ve de frente. Por eso el total del visor queda entre 6 y 8 % por debajo del de Radiance.
- **El orden y las proporciones no cambian:** SE y SO arriba, luego NE y la NO al final. La NO recibe 0,69 de lo que recibe la SE en el visor y 0,70 en Radiance, así que «unos siete décimos» vale con los dos modelos.

Ninguno de los dos totales es una medición: los dos son modelos de cielo con el mismo dato de ERA5, que además da más radiación que la medida en la grúa del STRI ([`radiacion-stri.md`](radiacion-stri.md)). Lo que dice este contraste es que el visor calcula bien el sol directo y que su cifra de cielo está en el lado bajo de los dos modelos más usados.

## Reproducir

Los archivos están en [`radiance/`](radiance/) y los pasos en `radiance/LEEME.txt`. Radiance se bajó como zip de su página de versiones (https://github.com/LBNL-ETA/Radiance/releases, 39b99660), sin instalarlo en el sistema.

Fuentes del método: Hay, J. E. y Davies, J. A. (1980), en *Proceedings of the First Canadian Solar Radiation Data Workshop*, pp. 59–72. Perez, R., Seals, R. y Michalsky, J. (1993). All-weather model for sky luminance distribution: preliminary configuration and validation. *Solar Energy*, 50(3), 235–245. doi:10.1016/0038-092X(93)90017-I.
