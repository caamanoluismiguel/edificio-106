# Uso: bash medir.sh M D H DNI DHI etiqueta. Cielo de Perez (gendaylit) girado al norte del modelo (−34°), puntos del suelo alrededor del 106.
R=~/projects/edificio-106-radiance/inst/radiance; export PATH=$R/bin:$PATH RAYPATH=.:$R/lib
M=$1 D=$2 H=$3 DNI=$4 DHI=$5 E=$6
{ gendaylit $M $D $H -y 2024 -W $DNI $DHI -a 8.9993 -o 79.5827 -m 75 -O 1 | xform -rz -34
  printf 'skyfunc glow sky_glow 0 0 4 1 1 1 0\nsky_glow source sky 0 0 4 0 0 1 180\nskyfunc glow gnd_glow 0 0 4 1 1 1 0\ngnd_glow source gnd 0 0 4 0 0 -1 180\n'; } > cielo_$E.rad
oconv materiales.rad arquitectura.rad cubiertas_sombra.rad ventanas.rad entrada.rad sitio.rad cielo_$E.rad > e_$E.oct
python3 -I -c "
for x in range(-33,34,2):
  for y in range(-21,22,2):
    dx=max(0,abs(x)-22.75); dy=max(0,abs(y)-11.5); d=max(dx,dy)
    if 3<=d<=9: print(x,y,0.3,0,0,1)" > p_$E.pts
rtrace -h -I -ab 0 -lw 1e-4 e_$E.oct < p_$E.pts | rcalc -e '$1=($1+$2+$3)/3' > dir_$E.txt
rtrace -h -I -ab 3 -ad 2048 -as 512 -aa .1 -ar 256 -lw 1e-4 e_$E.oct < p_$E.pts | rcalc -e '$1=($1+$2+$3)/3' > tot_$E.txt
paste dir_$E.txt tot_$E.txt > res_$E.txt
