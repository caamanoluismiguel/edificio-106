# Estado del modelo (2026-10-02, git 7861dbc)

Foto de referencia de cada GLB, pieza por pieza. Antes de publicar un cambio del modelo: `cd fuente && node estado.mjs --comprobar`.
Solo pueden aparecer en la lista de diferencias las piezas que el cambio dice tocar. Después de aprobar el cambio, `node estado.mjs` rehace la foto.

| Archivo | Piezas | Triángulos | md5 |
|---|---|---|---|
| modelo/arquitectura.glb | 575 | 8116 | `c3de5cea492e` |
| modelo/contexto.glb | 54930 | 415898 | `30cb6638c055` |
| modelo/cubiertas.glb | 45033 | 454780 | `03391bb3c569` |
| modelo/cubiertas_sombra.glb | 5466 | 33129 | `60449f2043bc` |
| modelo/detalles.glb | 1390 | 36008 | `e2ae61aee2b4` |
| modelo/entrada.glb | 580 | 26050 | `624257368b42` |
| modelo/sitio.glb | 321 | 10466 | `b17f8024180d` |
| modelo/vegetacion.glb | 53741 | 59760 | `a37be78e9211` |
| modelo/ventanas.glb | 1020 | 12634 | `a35e9f2ea6fe` |
| ar/modelo/arquitectura.glb | 575 | 8116 | `c3de5cea492e` |
| ar/modelo/cubiertas.glb | 5466 | 33129 | `60449f2043bc` |
| ar/modelo/detalles.glb | 1390 | 36008 | `e2ae61aee2b4` |
| ar/modelo/entrada.glb | 580 | 26050 | `624257368b42` |
| ar/modelo/ventanas.glb | 1020 | 12634 | `a35e9f2ea6fe` |

## Invariantes que hay que revisar a mano

- El pórtico: columnas en x 11,70 y 13,90 (2,20 m entre ejes), columna trasera en 11,46, capitel a 2,40 m, viga, zapatas y cinco cabios (`node portico.mjs --medir`).
- Los GLB de `ar/modelo/` son copias byte a byte de los de `modelo/` (`bash ar/verificar-huellas.sh`).
- Las sombras y el sol: `node verificar.mjs` (7 comprobaciones).
- La imagen: `node guardia.mjs` (18 cuadros contra main).

## El pórtico medido

```
Fresh cream trim                   x 11.44–11.96  y -0.00–0.62  z 16.14–16.66
Fresh cream trim                   x 11.51–11.89  y 0.18–2.32  z 16.21–16.59
Fresh cream trim                   x 11.46–11.93  y 2.14–2.40  z 16.17–16.64
Fresh cream trim                   x 13.64–14.16  y -0.00–0.62  z 16.14–16.66
Fresh cream trim                   x 13.71–14.09  y 0.18–2.32  z 16.21–16.59
Fresh cream trim                   x 13.67–14.14  y 2.14–2.40  z 16.17–16.64
Fresh cream trim                   x 15.60–21.50  y 0.03–0.76  z 14.15–14.25
Fresh cream trim                   x 15.60–21.50  y 0.03–0.76  z 12.87–12.97
Fresh cream trim                   x 11.20–11.72  y -0.00–0.62  z 13.74–14.26
Fresh cream trim                   x 11.27–11.65  y 0.18–2.32  z 13.81–14.19
Fresh cream trim                   x 11.23–11.70  y 2.14–2.40  z 13.77–14.24
Dark stained roof timber           x 11.35–14.25  y 2.58–2.88  z 16.17–16.63
Dark stained roof timber           x 10.87–14.72  y 2.64–3.64  z 11.30–17.30
Dark stained roof timber           x 11.20–12.20  y 2.40–2.58  z 16.20–16.60
Dark stained roof timber           x 13.40–14.40  y 2.40–2.58  z 16.20–16.60
Dark stained roof timber           x 11.34–11.58  y 2.40–2.58  z 13.50–14.50
Dark stained roof timber           x 11.34–11.58  y 2.58–2.88  z 13.40–16.20
Dark stained roof timber           x 11.56–11.64  y 2.60–2.97  z 16.40–17.22
Dark stained roof timber           x 12.16–12.24  y 2.60–3.18  z 15.80–17.22
Dark stained roof timber           x 12.76–12.84  y 2.60–3.18  z 15.80–17.22
Dark stained roof timber           x 13.36–13.44  y 2.60–3.18  z 15.80–17.22
Dark stained roof timber           x 13.96–14.04  y 2.60–2.97  z 16.40–17.22
Dark stained roof timber           x 10.93–14.67  y 2.48–2.68  z 16.95–17.13
Dark stained roof timber           x 10.96–11.14  y 2.48–2.68  z 11.55–17.13
Dark stained roof timber           x 14.46–14.64  y 2.48–2.68  z 11.55–17.13
teja del pórtico (todas)           x 10.87–14.73  y 2.70–3.73  z 11.30–17.30
Pale cast concrete — entrance      x 11.65–13.95  y 0.16–0.30  z 13.33–13.64
Pale cast concrete — entrance      x 11.65–13.95  y 0.16–0.43  z 13.04–13.35
Pale cast concrete — entrance      x 11.65–13.95  y 0.16–0.57  z 12.76–13.06
Pale cast concrete — entrance      x 11.65–13.95  y 0.16–0.71  z 12.47–12.77
Pale cast concrete — entrance      x 11.65–13.95  y 0.16–0.85  z 12.18–12.48
Pale cast concrete — entrance      x 11.65–13.95  y 0.16–0.98  z 11.89–12.20
Pale cast concrete — entrance      x 11.65–13.95  y 0.16–1.12  z 11.50–11.91
Pale cast concrete — entrance slab x 9.90–15.60  y -0.05–0.16  z 12.82–16.77
Warm lime-painted plaster          x 10.00–11.65  y 0.00–1.12  z 11.50–13.64
Warm lime-painted plaster          x 13.95–14.90  y 0.00–1.12  z 11.50–13.64
Galvanized guardrail               x 11.68–11.72  y 1.04–2.05  z 11.50–13.56
Galvanized guardrail               x 13.88–13.92  y 1.04–2.05  z 11.65–13.56
Galvanized guardrail               x 11.68–11.72  y 0.30–1.06  z 13.53–13.57
Galvanized guardrail               x 11.68–11.72  y 0.71–1.54  z 12.58–12.62
Galvanized guardrail               x 11.68–11.72  y 1.12–2.03  z 11.63–11.67
Galvanized guardrail               x 13.88–13.92  y 0.30–1.06  z 13.53–13.57
Galvanized guardrail               x 13.88–13.92  y 0.71–1.54  z 12.58–12.62
Galvanized guardrail               x 13.88–13.92  y 1.12–2.03  z 11.65–11.67
```
