# Radiación anual por fachada con Radiance 6.1a: cielo de Perez (gendaymtx -m 4, 2.305 parches) y coeficientes de rfluxmtx,
# sumando mes por mes. directo: solo el sol, sin suelo (-d, -g 0). cielo+sol: sin suelo (-g 0). total: con el suelo al 20 % (-g 0.2).
for cfg in "directo -d 0" "cielo+sol x 0" "total x 0.2"; do
  nom=${cfg% * *}; resto=${cfg#* }; op=${resto% *}; g=${resto#* }; [ "$op" = x ] && op=""
  for m in 1 2 3 4 5 6 7 8 9 10 11 12; do
    head -6 serie.wea > mm.wea; awk -v m=$m 'NR>6 && $1==m' serie.wea >> mm.wea; N=$(($(wc -l < mm.wea)-6))
    gendaymtx -m 4 -O1 -A $op -g $g $g $g mm.wea 2>/dev/null > mm.mtx
    dctimestep dc4.mtx mm.mtx | rmtxop -fa -c .33333 .33333 .33333 - | awk -v N=$N 'NR>11{printf "%.4f ", $1*N/25/1000}'; echo
  done | awk -v nom="$nom" '{for(i=1;i<=NF;i++)s[i]+=$i} END{printf "%-10s", nom; for(i=1;i<=5;i++) printf " %5.0f", s[i]; print ""}'
done
