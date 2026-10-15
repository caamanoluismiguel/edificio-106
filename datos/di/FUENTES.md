# Fuentes y recálculo del contenido de «Diseño industrial»

Contenido de la lectura «Diseño industrial»: `fichas.json` (27 fichas), `etapas.json` (10 etapas) y `alternativas.json` (5 preguntas). Escrito el 13 de octubre de 2026. No está publicado y espera al verificador.

## Cómo se rehace

Desde la raíz del repo, con Python 3 y numpy:

```
python3 datos/di/cifras.py .     # recalcula las cifras de clima y las contrasta con datos/consultas.json
python3 datos/di/armar.py .      # escribe los tres JSON con esas cifras
```

`cifras.py` lee `datos/clima_horario.bin.gz` (formato C107) y termina con `OK: coincide con datos/consultas.json` si el índice de lluvia, las horas de viento de frente y el sol directo por fachada coinciden con lo que ya publica el visor. Si no coinciden, falla. `armar.py` toma las cifras de la salida de `cifras.py`: ningún número de clima está escrito a mano en los JSON.

## Cifras de clima («Lo que le pide su fachada» y «datos_del_106»)

Todas salen de ERA5, de 2001 a 2025, en la celda de unos 28 km del visor. Fachadas con los rumbos de `FACHADAS` en `fuente/src/sol.js`: SE 146°, NO 326°, NE 56°, SO 236°. Un año = 8.766 horas (219.144 horas / 25,0 años).

| Cifra | Valor | Cómo se calcula |
|---|---|---|
| Lluvia con viento, L/m² al año | NO 497 · SO 356 · SE 281 · NE 96 | ISO 15927-3, (2/9)·v·r^(8/9)·cos(D − θ) por hora, solo con el viento hacia la cara (coseno positivo), sumado y dividido entre los años. Igual que `lluviaViento` de `fuente/consultas.py`. Ordena caras en campo abierto; no mide el agua sobre el muro |
| NO contra NE en lluvia con viento | 5,2 veces | 497 / 96 = 5,18 |
| Viento de frente, horas al año | NO 5.880 · NE 1.445 · SO 1.235 · SE 1.104 | horas con el viento a menos de 60° de la normal de la cara (cos > 0,5) y 5 km/h o más. Igual que `viento.anio.frente` |
| NO contra la cara que le sigue | 4,1 veces | 5.880 / 1.445 = 4,07 |
| Viento de frente en la seca, horas | NO 2.681 · NE 1.009 · SO 45 · SE 38 | lo mismo, de diciembre a marzo (`fuente/src/temporadas.json`) |
| Parte de la seca con viento de frente en la NO | 92 de cada 100 horas | 2.681 / 2.910, con 2.910 horas de seca por año |
| Sol directo en pared sin alero, kWh/m² al año | SE 374 · SO 362 · NE 302 · NO 144 | DNI × coseno de incidencia sobre la pared vertical, con el sol al centro de cada hora (NOAA, como `consultas.py`). Coincide con `radiacion.fachadas.*.directa` a 1 kWh/m² |
| SE contra NO | 2,6 veces | 374 / 144 = 2,60 |
| Corte del piso 2 | todo el vidrio al sol bajo 9,1°, todo a la sombra sobre 45,5° | `CORTE` de `fuente/src/main.js`: atan((7,40 − 7,12) / 1,75) = 9,1°; atan((7,40 − 5,62) / 1,75) = 45,5° |
| Parte del sol directo de la pared con perfil sobre 45,5° | NO 66 % · SE 61 % · NE 52 % · SO 47 % | el sol directo de la fila anterior, partido por el ángulo de perfil, atan(tan(altura) / cos(acimut − rumbo)), la fórmula de `perfilSol` en main.js. Cifra nueva: no está publicada en el visor |
| Perfil entre 9,1° y 45,5° | SO 50 % · NE 42 % · SE 38 % · NO 33 % | igual; las tres bandas se redondean por separado y en la SE suman 101 |
| Perfil bajo 9,1° | NE 6 % · SO 3 % · SE 2 % · NO 1 % | igual |
| Sol sobre el techo, kWh/m² al año | 1.770 total, 1.058 directo | global horizontal y DNI × seno de la altura. Igual que `radiacion.techo` |
| Lluvia media | 2.042 mm al año | media de las 25 sumas anuales. Igual que `promedioAnual` de `clima_resumen.json` |
| Horas con lluvia desde el umbral | 388 al año | horas con 1 mm o más de diciembre a marzo y 1,5 mm o más de abril a noviembre (`umbralLluvia` en `fuente/src/clima.js`) |
| Horas con 10 mm o más | 2,4 al año | clase «fuerte» de la OMM, 10 mm/h o más (WMO-No. 8, 2023, vol. I, p. 484) |
| La hora más lluviosa | 19,0 mm, 1 de julio de 2023, de 14 a 15 h | máximo de la serie. Igual que `horasLluvia[0]` de `consultas.json` |

## Cifras del modelo

Las medidas, cuentas y cotas de las fichas salen de `docs/INVENTARIO.md` de D.I.Visor y de `contenido/lecciones.json`, que el verificador revisó en dos pasadas el 13 de octubre de 2026 contra `fuente/estado/estado.json` y los GLB de main. Cada ficha cita su sección en `fuente`. Se tomaron ya corregidas: 8,1 % y unos 14,6 m en la rampa, 2 a 4 cm de sobrancho en el alféizar, «las seis del centro» para las ménsulas de la SE, 17,9° en la mediagua y cinco piezas más la faja en el alero.

Del verificador del plan (13 de octubre de 2026), que manda sobre el plan:

- 113 ventanas: 79 vanos de 1,58 m (pisos 2 y 3), 25 de 1,63 m (piso 1), 7 de 1,40 m (planta baja SO) y 2 de 0,57 m (las altas de la NE, sin travesaño del medio); 111 con tres travesaños.
- Recorrido de la hoja, de la geometría de los GLB de main y con escala ±12 %: 0,772 m en los vanos de 1,63 m, 0,655 m en los de 1,40 m y 0,747 m en los de 1,58 m, que son inferidos. En el texto público van con dos decimales (0,77, 0,66 y 0,75 m): la escala de ±12 % no da para tres.
- El corte del piso 2 usa las cotas redondeadas del visor (alero a 7,40 m, `CORTE` en main.js); con el sofito del modelo, 7,386 m, los ángulos serían 8,6° y 45,3°.
- 3 puertas pardas de servicio (1,50, 1,70 y 1,80 m), la de la galería SO y la principal: 5 vanos de puerta.
- Ninguna ficha dice «arcilla»: «Clay terracotta» y «Clay-colored» son nombres de material del modelo.

## Lo que no tiene cita con página

Para que el verificador decida si pide fuente o lo deja como principio general. Todo va rotulado como del tipo de pieza, nunca como del 106:

- los procesos típicos de cada ficha (`proceso.tipico`), entre ellos los materiales posibles de un muro de este tipo: moldeo y cocción de la teja de barro, extrusión del aluminio, aserrado del cabio, vaciado del concreto, chapa doblada del gabinete, las tres formas de equilibrar una guillotina;
- los «Elígela cuando» y «Lo que cuesta» de las cinco alternativas;
- el orden de las diez etapas, que sigue el método de «Building a house» de Pascal Architecture (qué se apoya en qué y qué tapa a qué) aplicado como principio, sin datos de la obra del 106;

## Lo que el contenido no dice, a propósito

No dice cómo ni cuándo se construyó el 106, quién lo hizo, su uso original ni el uso de sus cuartos. No dice qué eligió quien lo hizo ni por qué. No habla de recoger agua, de consumo eléctrico ni de recorridos con sombra. La condensadora, el gabinete, la rampa, las escaleras, la baranda, los tubos y el letrero no llevan cifra de fachada por esas razones.

## Ids de familia

Los ids son los de `datos/familias.json` (carril C). `fichas.json` va por familia, como pide el contrato: cada familia lleva la ficha entera, con `ficha` (el id de la ficha) y `familias` (todas las que cubre). `armar.py` comprueba que cada familia exista en `datos/familias.json` (o en la ruta de `FAMILIAS_JSON`). Las etapas y las alternativas citan familias reales.

| Ficha | Familias |
|---|---|
| `zocalo` | `zocalo` |
| `bloque_calado` | `bloque_calado` |
| `losa` | `losa` |
| `mensula` | `mensula` |
| `muro` | `muro` |
| `moldura` | `moldura` |
| `faja_mediagua` | `faja_mediagua` |
| `marco_ventana` | `jamba`, `travesano`, `parteluz`, `vidrio` |
| `hoja_guillotina` | `hoja_guillotina` |
| `alfeizar` | `alfeizar` |
| `lama_celosia` | `lama_celosia` |
| `teja` | `teja` |
| `cabio` | `cabio` |
| `tablero_alero` | `tablero_alero` |
| `tabla_frente` | `tabla_frente` |
| `gablete` | `gablete` |
| `puerta_parda` | `puerta_parda`, `tirador` |
| `puerta_principal` | `puerta_principal`, `fondo_puerta` |
| `escalera` | `escalera_entrada`, `escalera_trasera`, `escalera_so`, `escalera_puerta_so`, `escalon_servicio` |
| `rampa` | `rampa` |
| `baranda_rampa` | `baranda_entrada` |
| `galeria` | `galeria`, `baranda_parda` |
| `portico` | `columna_portico`, `vigas_portico` |
| `condensadora` | `condensadora`, `cubretubos` |
| `tubo_abrazadera` | `tubo_vertical`, `abrazadera` |
| `gabinete_verde` | `gabinete` |
| `letrero` | `letrero` |

Sin ficha por ahora (25 familias): `acera`, `bordillo`, `calzada`, `cesped`, `cielorraso`, `cumbrera`, `difusor`, `faja_atico`, `faldon`, `franja_oscura`, `junta_acera`, `losa_entrada`, `marco_puerta`, `mastil`, `murete`, `muro_curvo`, `panel_ne`, `pilar`, `pintura_vial`, `piso_interior`, `poste_luz`, `rejilla_galeria`, `soporte_bicicletas`, `tarima_so`, `volumen_interior`.

## Campos además del contrato

Las fichas llevan, además de `titulo`, `texto`, `datos`, `principio`, `fachada`, `certeza` y `fuente`: `sistema`, `decision` (decisión morfológica), `proceso` con `del_106` y `tipico`, `certezas` (desglose por parte) y `foto_que_falta`. `certeza` es el nivel más débil de lo que la ficha afirma del 106 (foto, equipo, medido, modelo, general); lo que dice que no se sabe no cuenta. Las etapas llevan además `n`, `se_apoya_en`, `tapa_a`, `para_pensar` y `sello`. Las alternativas llevan `decidido_por` y `datos_del_106`.
