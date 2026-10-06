# Luz al sol y en sombra junto al 106: la escena frente a Radiance

Contraste hecho el 6 de octubre de 2026. Con cielo despejado, la escena ajusta la luz de la sombra para que el suelo al sol quede más claro que el suelo en sombra en la razón (DNI · sen h + DHI) / (DHI · (1 − Ai)), con el cielo de Hay y Davies (`fRel` en `fuente/src/escena.js`). La constante `KAPPA` que lleva las luces a esa razón salió de una sola medición, el 15 de febrero de 2024 a las 10:00. Aquí se comparan esa razón y la de la escena con Radiance 6.1a, con la geometría real del 106.

## Método

- **Radiance:** el 106 de los GLB del visor (arquitectura, techo de sombras, ventanas, entrada y sitio), con el cielo de Perez para la DNI y la difusa de cada momento (`gendaylit`) girado al norte del modelo, y la irradiancia en puntos del suelo a 3 a 9 m del edificio, separados entre los que reciben el sol y los que están a la sombra. La razón es la mediana de los primeros entre la mediana de los segundos.
- **Escena:** el visor con `?prueba` en el mismo momento; su razón es 1 + (Rv − 1) / fRel, el mismo modelo de luces con que se calibró `KAPPA`, con el tope de fRel en 0,3. No se leen los píxeles de la imagen.
- Los dos usan la DNI y la difusa que la escena tiene en ese instante.

## Resultado

| Momento | DNI / DHI (W/m²) | Fórmula | Escena | Radiance |
|---|---|---|---|---|
| 15/02/2024 10:00, el de la calibración | 636 / 136 | 8,04 | 8,04 | 7,92 |
| 25/03/2024 15:00, muy despejado | 806 / 126 | 14,41 | 11,05 (en el tope) | 10,15 |

- **Con cielo como el de la calibración, la escena coincide con Radiance**: 8,04 contra 7,92, un 1,5 %. Ahí la escena da la fórmula por construcción, porque `KAPPA` se midió en ese momento; lo que se contrasta es la fórmula contra Radiance.
- **Con cielo muy despejado, la fórmula pide más contraste del que da Radiance** (14,41 contra 10,15): con Ai alto (0,59), el cielo de Hay y Davies manda más de la mitad de la difusa al círculo del sol, y la sombra la pierde: la fórmula le deja 52 W/m² y Radiance le da 73. Esa diferencia junta el cielo de Perez y la luz que rebota en muros y suelo, que Radiance cuenta y la fórmula no; este contraste no separa una de otra. El tope de la escena la deja en 11,05, un 9 % más contrastada que Radiance.
- **El color de los muros casi no cambia el resultado**: con el sol de 852 y la difusa de 128 W/m² (el dato de la hora en la serie, antes de pasar a los valores que la escena interpola a ese minuto), la razón de Radiance da 10,79, 10,48 y 10,41 con muros de reflectancia 0,3, 0,5 y 0,7.
- En un día cubierto (18/06/2024 12:00, 16 y 256 W/m²) no hay sombra de sol que comparar: la fórmula da 1,07 y la escena no ajusta el relleno.

Las reflectancias de los materiales son supuestas, no medidas (muros 0,5, techo 0,2, vidrio 0,1 y suelo 0,2, el del visor). Ni Radiance ni la escena son una medición: es un modelo frente a otro, con el mismo dato de ERA5.

## Reproducir

Los archivos y los pasos están en [`luz/`](luz/) (`LEEME.txt`). Perez, R., Seals, R. y Michalsky, J. (1993). All-weather model for sky luminance distribution: preliminary configuration and validation. *Solar Energy*, 50(3), 235–245. doi:10.1016/0038-092X(93)90017-I.
