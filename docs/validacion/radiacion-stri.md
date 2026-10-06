# Radiación de ERA5 frente a la grúa del STRI

Contraste hecho el 6 de octubre de 2026 entre la radiación global horizontal de ERA5 que usa el visor y la medida por los piranómetros del techo de la grúa del Parque Natural Metropolitano, a 4,4 km del 106.

## Datos

- **Medido:** Physical Monitoring Program del Smithsonian Tropical Research Institute, *Parque Metropolitano Crane, Top_Solar Radiation, Pyranometer*, [doi:10.60635/C3791K](https://doi.org/10.60635/C3791K) (archivo `metpark_cranetop_sr.zip`, bajado el 6 de octubre de 2026). Data were provided by the Physical Monitoring Program of the Smithsonian Tropical Research Institute. Dos sensores lado a lado en lo alto de la grúa (8,9944° N, 79,5430° O), promedios de 15 minutos que terminan en la marca de tiempo. Se usaron solo los registros que el STRI marca como `good`. Los datos no se copian a este repositorio. Las cifras de este documento son derivadas (promedios por hora y por día), no los datos originales que distribuye el STRI.
- **Modelo:** ERA5 por la API de archivo de Open-Meteo, celda 9,000° N, 79,500° O, variable `shortwave_radiation` (promedio de la hora anterior), hora de Panamá, del 1 de marzo de 2012 al 31 de diciembre de 2025.

Las dos series se compararon por hora (cuatro registros de 15 minutos por hora) y por día (solo días con las 24 horas medidas). La correlación horaria es mayor sin desfase (r = 0,889) que con una hora de más o de menos (0,856 y 0,822), así que las horas están alineadas. Los dos sensores difieren en promedio 1,4 W/m² de día.

## Resultado

El sesgo cambia con el sensor que tenía la grúa:

| Período | Sensor | Días completos | ERA5 frente a lo medido |
|---|---|---|---|
| Hasta el 13 de junio de 2016 | LI-COR LI200 | 701 | +22,9 % |
| 14 de junio de 2016 al 30 de julio de 2018 | Kipp & Zonen SP-Lite2 (frente) y LI-COR LI200S (atrás) | 557 | +17,0 % |
| Desde el 31 de julio de 2018 | Kipp & Zonen CMP3 (frente) y SP-Lite2 (atrás) | 2.170 | **+8,8 %** |

Con los sensores actuales, por época del año (kWh/m² por día):

| Meses | Días | Medido | ERA5 | Diferencia |
|---|---|---|---|---|
| Enero y febrero | 380 | 5,41 | 5,28 | −2,5 % |
| Marzo y abril | 390 | 5,34 | 5,75 | +7,6 % |
| Mayo a noviembre | 1.214 | 3,97 | 4,53 | +14,1 % |
| Diciembre | 186 | 4,26 | 4,64 | +8,9 % |

Y por hora (promedio de la hora que termina en la marca, W/m², agosto de 2018 en adelante): a las 9:00, 343 medido y 328 ERA5; a las 11:00, 578 y 629; a las 13:00, 617 y 716; a las 15:00, 456 y 516; a las 17:00, 213 y 228. En la mañana coinciden y la diferencia crece al mediodía y en la tarde.

## Límites

- Es una sola estación, a 4,4 km del 106 y sobre el bosque. La celda de ERA5 mide unos 28 km e incluye mar. El resultado da el orden del sesgo, no su valor exacto en el 106.
- La diferencia entre períodos muestra que el sensor importa; el período del CMP3 es el de referencia.
- No se ajustó la serie del visor con este resultado.

## Reproducir

Los scripts están en [`stri/`](stri/): `cruce.py` hace el contraste completo (su salida está en `resultado.txt`, con todos los años), `anual.py` lo separa por sensor y `reciente.py` da las cifras desde agosto de 2018.
