# Reloj de la lluvia (pestaña «25 años»): a qué hora del día hay lluvia de mayo a noviembre, según ERA5 y según el
# observador del aeropuerto de Albrook (MPMG, a 4,1 km). Escribe datos/reloj_lluvia.json; siempre igual con los mismos datos.
#
#   cd fuente && python3 reloj_lluvia.py [carpeta con los METAR]      (por defecto ~/projects/edificio-106-estaciones/metar)
#
# Se comparan frecuencias con frecuencias, nunca milímetros (el METAR no da milímetros):
#  - ERA5 (datos/clima_horario.bin.gz, hora de Panamá, UTC−5): % de horas con lluvia desde el umbral del visor (umbralLluvia en
#    src/clima.js: 1,5 mm de abril a noviembre). Open-Meteo da en la marca h la lluvia de h−1 a h: la hora h del reloj es la
#    que termina a las h.
#  - Albrook: % de partes de rutina (minuto 00) hechos por un observador que informan lluvia: un grupo de tiempo presente
#    con RA (RA, SHRA, TSRA, con o sin «-» o «+»). VC (en las cercanías) no cuenta, TS solo es trueno sin precipitación y
#    DZ es llovizna (WMO-No. 306, vol. I.1, FM 15, 15.8). El parte de las HH:00 dice el tiempo de ese momento.
#  - Los partes AUTO no informan si llueve (como en cargarVivo, src/clima.js). Una hora del día se compara solo si al menos
#    la mitad de sus partes los hizo un observador; con los METAR de 2017–2025 quedan fuera las de 23 a 5 h.
#  - Período: 2017–2025, mayo a noviembre (al archivo de IEM le faltan las lluvias de 2011, 2015 y 2016).
# Además reproduce el 53,6 % del panel: la parte de la CANTIDAD de lluvia de ERA5 de mayo a noviembre (2001–2025) que cae en
# las horas que terminan de las 13 a las 18 h, es decir, de 12 a 18 h.
import csv, glob, gzip, json, os, re, sys, datetime as dt
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
METAR = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/projects/edificio-106-estaciones/metar')
PERIODO, MESES = (2017, 2025), list(range(5, 12))
UMBRAL = 1.5                                   # umbralLluvia de mayo a noviembre

b = gzip.decompress(open(os.path.join(AQUI, '../datos/clima_horario.bin.gz'), 'rb').read()); assert b[:4] == b'C107'
n = int(np.frombuffer(b[4:8], np.uint32)[0])
P = np.frombuffer(b[8 + n:8 + 3 * n], '<u2').astype(float) / 10          # lluvia: segunda columna, uint16 a 0,1 mm
tl = np.datetime64('2001-01-01T00', 'h') + np.arange(n)
yr = tl.astype('datetime64[Y]').astype(int) + 1970; mo = tl.astype('datetime64[M]').astype(int) % 12 + 1; hr = np.arange(n) % 24
lluvias = (mo >= 5) & (mo <= 11)
per = lluvias & (yr >= PERIODO[0]) & (yr <= PERIODO[1])

# METAR: misma lectura que ajuste_albrook.py (parte de rutina, hora local = UTC − 5) y el filtro de tiempoPresente (clima.js)
U0 = dt.datetime(2001, 1, 1, 5)
parte = np.zeros(n, bool); obs = np.zeros(n, bool); ra = np.zeros(n, bool)
GRUPO = re.compile(r'^(\+|-)?(VC)?(MI|BC|PR|DR|BL|SH|TS|FZ|VC){0,3}(DZ|RA|SN|SG|PL|GR|GS|UP|FG|BR|HZ)*$')
archivos = sorted(glob.glob(os.path.join(METAR, 'MPMG-*.csv'))); assert archivos, 'no hay METAR en ' + METAR
for f in archivos:
    for r in csv.DictReader(open(f)):
        v = r['valid']
        if v[14:16] != '00': continue
        i = int((dt.datetime.fromisoformat(v) - U0).total_seconds() // 3600)
        if not 0 <= i < n: continue
        g = r['metar'].split()
        fin = next((k for k, x in enumerate(g) if re.fullmatch(r'TEMPO|BECMG|NOSIG|RMK', x) or re.fullmatch(r'[QA]\d{4}', x)), len(g))
        ob = g[:fin]; parte[i] = True; obs[i] = 'AUTO' not in ob
        ra[i] = any(GRUPO.match(x) and 'VC' not in x and 'RA' in x for x in ob[2:])
assert not (ra & ~obs & per).any()             # un parte AUTO nunca informa lluvia

era5, alb, partes, partes_obs, sin_obs = [], [], [], [], []
for h in range(24):
    s = per & (hr == h)
    era5.append(round(100 * float((P[s] >= UMBRAL).mean()), 1))
    po, pt = int((s & obs).sum()), int((s & parte).sum())
    partes.append(pt); partes_obs.append(po)
    if po >= pt / 2 and po > 0: alb.append(round(100 * float(ra[s & obs].mean()), 1))
    else: alb.append(None); sin_obs.append(h)

s25 = lluvias & (yr <= 2025); tot = P[s25].sum()
cantidad = [round(100 * float(P[s25 & (hr == h)].sum() / tot), 1) for h in range(24)]
tarde = round(100 * float(P[s25 & (hr >= 13) & (hr <= 18)].sum() / tot), 1)
pico_e = int(np.argmax(era5)); pico_a = int(np.nanargmax([np.nan if x is None else x for x in alb]))

out = dict(
    descripcion='A qué hora del día hay lluvia de mayo a noviembre: ERA5 (celda de ~28 km) y el observador del aeropuerto de Albrook (MPMG, a 4,1 km), 2017–2025. Frecuencias, no milímetros.',
    fuente=dict(era5='ERA5 vía Open-Meteo, celda 9,000° N 79,500° O (datos/clima_horario.bin.gz)',
                albrook='METAR de Albrook (MPMG), Iowa Environmental Mesonet (https://mesonet.agron.iastate.edu/request/download.phtml?network=PA__ASOS)'),
    periodo=list(PERIODO), meses=MESES, hora_local='UTC−5',
    era5=dict(nota=f'% de horas con {UMBRAL} mm o más (umbralLluvia de mayo a noviembre); la hora h es la que termina a las h (lluvia de h−1 a h)',
              umbral_mm=UMBRAL, pct=era5, pico=pico_e),
    albrook=dict(nota='% de partes de rutina de las h:00 hechos por un observador con RA, SHRA o TSRA (con «-» o «+»); no cuentan VC, TS solo ni DZ (WMO-No. 306, FM 15). null: hora sin comparación, menos de la mitad de los partes con observador (AUTO no informa si llueve)',
                 pct=alb, partes=partes, partes_observador=partes_obs, sin_observador=sin_obs, pico=pico_a),
    cantidad=dict(nota='% de la lluvia de ERA5 de mayo a noviembre de 2001–2025 en cada hora (la que termina a las h); tarde = horas que terminan de las 13 a las 18 h (de 12 a 18 h)',
                  periodo=[2001, 2025], pct=cantidad, tarde=tarde),
    sesgo=dict(cita='Watters, D., Battaglia, A. y Allan, R. P. (2021). The Diurnal Cycle of Precipitation according to Multiple Decades of Global Satellite Observations, Three CMIP6 Models, and the ECMWF Reanalysis. Journal of Climate, 34(12), 5063–5080. doi:10.1175/JCLI-D-20-0966.1',
               dice='Resumen, p. 5063: «The simulated diurnal cycle is unrealistically early when compared with observations, particularly over land (NCAR-CESM2 AMIP: −1 h; ERA5: −2 h; CNRM-CM6.1 AMIP: −4 h on average)». Junio a agosto de 2000–2019, 60° N a 60° S, contra IMERG.'))
dst = os.path.join(AQUI, '../datos/reloj_lluvia.json')
json.dump(out, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
print('escrito', dst, os.path.getsize(dst), 'bytes')
print('ERA5 % horas >=', UMBRAL, 'mm:', era5, '· pico la hora que termina a las', pico_e)
print('Albrook % partes con lluvia:', alb, '· pico el parte de las', pico_a, '· sin observador', sin_obs)
print('cantidad de 12 a 18 h (2001–2025): %.1f %%' % tarde)
