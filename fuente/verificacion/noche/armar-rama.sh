#!/bin/bash
# Arma el sitio de la rama en la raíz (js/app.js e index.html) para las capturas; antes de commitear: git checkout -- js/app.js index.html
set -e
cd "$(dirname "$0")/../.."
npx vite build --logLevel error
cp dist/js/app.js ../js/app.js
{ echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'; sed -n '1,/<\/style>/p' cuerpo.html; echo '</head><body>'; sed '1,/<\/style>/d' cuerpo.html; echo '<script type="module" src="js/app.js"></script></body></html>'; } > ../index.html
