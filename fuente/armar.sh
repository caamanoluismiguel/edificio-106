#!/bin/bash
# Compila y arma dist/ (sitio para hosting propio: index.html + cuerpo.html) y dist_art/ (variante para el Artifact).
set -e
cd "$(dirname "$0")"
npx vite build --logLevel warn
rm -rf dist/modelo dist/texturas dist/datos && mkdir -p dist/modelo dist/datos
cp public/modelo/*.glb dist/modelo/
cp -r public/texturas dist/
cp public/datos/intro.bin.gz public/datos/clima_horario.bin.gz public/datos/clima_resumen.json dist/datos/
cp cuerpo.html dist/cuerpo.html
{ echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'; sed -n '1,/<\/style>/p' cuerpo.html; echo '</head><body>'; sed '1,/<\/style>/d' cuerpo.html; echo '<script type="module" src="js/app.js"></script></body></html>'; } > dist/index.html
# Variante para el Artifact: cada binario viaja como texto base64 de su versión gzip (el servidor solo entrega tipos web)
rm -rf dist_art && mkdir -p dist_art/modelo dist_art/datos && cp -r dist/js dist/texturas dist_art/
for f in dist/modelo/*.glb; do gzip -9c "$f" | base64 -w0 > "dist_art/modelo/$(basename "$f").gz.b64.txt"; done
for f in dist/datos/*.bin.gz; do base64 -w0 "$f" > "dist_art/datos/$(basename "$f").b64.txt"; done
cp dist/datos/clima_resumen.json dist_art/datos/
{ echo '<script>window.MODELO_B64 = true;</script>'; cat cuerpo.html; echo '<script type="module" src="js/app.js"></script>'; } > dist_art/cuerpo.html
du -sh dist dist_art; du -ch dist_art/modelo/* dist_art/datos/* | tail -1
