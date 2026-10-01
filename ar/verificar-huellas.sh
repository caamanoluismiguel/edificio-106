#!/bin/bash
# Comprueba que ningún GLB del sitio ni ningún .blend existente cambió desde ar/HUELLAS.txt. Sale con 1 si alguno cambió.
cd "$(dirname "$0")/.." || exit 2
mal=0
while read -r h f; do
  [[ "$h" =~ ^[0-9a-f]{32}$ ]] || continue
  [ -f "$f" ] || { echo "FALTA  $f"; mal=1; continue; }
  [ "$(md5 -q "$f")" = "$h" ] || { echo "CAMBIÓ $f"; mal=1; }
done < ar/HUELLAS.txt
[ $mal = 0 ] && echo "huellas: todo igual" || echo "huellas: HAY CAMBIOS, no seguir"
exit $mal
