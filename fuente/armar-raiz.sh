#!/bin/bash
# Arma el sitio publicado en la raíz del repositorio (GitHub Pages): compila js/app.js y escribe index.html desde cuerpo.html.
# El script lleva ?v=<huella> con la huella de todo lo que se publica (código, modelos, datos y texturas): cuando algo
# cambia, cambia la huella y el navegador baja la versión nueva en vez de usar su caché (GitHub Pages deja guardar 10 min
# o más). La app lee esa huella y la agrega a cada archivo que pide (src/datos.js, conVersion).
set -e
cd "$(dirname "$0")"
npx vite build --logLevel warn
cp dist/js/app.js ../js/app.js
# datos/ tiene subcarpetas (datos/di/): find, para que su contenido también entre en la huella (cat datos/* las saltaba con un error)
V=$(cd .. && cat js/app.js modelo/*.glb $(find datos -type f | LC_ALL=C sort) texturas/* | shasum | cut -c1-10)
{ echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'; sed -n '1,/<\/style>/p' cuerpo.html; echo '</head><body>'; sed '1,/<\/style>/d' cuerpo.html; echo "<script type=\"module\" src=\"js/app.js?v=$V\"></script></body></html>"; } > ../index.html
# los puntos de la intro (datos/intro.bin.gz) se precargan con la misma URL que pide la app (conVersion): llegan antes que el modelo
perl -pi -e "s|<meta charset=\"utf-8\">|<meta charset=\"utf-8\"><link rel=\"preload\" href=\"datos/intro.bin.gz?v=$V\" as=\"fetch\" crossorigin>|" ../index.html
echo "raíz armada · versión $V"
