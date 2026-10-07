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
PERIODO, MESES = (2017, 2025), json.load(open(os.path.join(AQUI, 'src', 'temporadas.json')))['lluvias']   # mayo a noviembre
UMBRAL = 1.5                                   # umbralLluvia de mayo a noviembre

b = gzip.decompress(open(os.path.join(AQUI, '../datos/clima_horario.bin.gz'), 'rb').read()); assert b[:4] == b'C107'
n = int(np.frombuffer(b[4:8], np.uint32)[0])
Pi = np.frombuffer(b[8 + n:8 + 3 * n], '<u2').astype(np.int64)          # lluvia: segunda columna, uint16 a 0,1 mm
P = Pi / 10                                    # las comparaciones con umbrales van en décimas enteras (Pi)
tl = np.datetime64('2001-01-01T00', 'h') + np.arange(n)
yr = tl.astype('datetime64[Y]').astype(int) + 1970; mo = tl.astype('datetime64[M]').astype(int) % 12 + 1; hr = np.arange(n) % 24
lluvias = (mo >= 5) & (mo <= 11)
per = lluvias & (yr >= PERIODO[0]) & (yr <= PERIODO[1])

# METAR: misma lectura que ajuste_albrook.py (parte de rutina, hora local = UTC − 5) y el filtro de tiempoPresente (clima.js)
U0 = dt.datetime(2001, 1, 1, 5)
parte = np.zeros(n, bool); obs = np.zeros(n, bool); ra = np.zeros(n, bool)
GRUPO = re.compile(r'^(\+|-)?(VC)?(MI|BC|PR|DR|BL|SH|TS|FZ|VC){0,3}(DZ|RA|SN|SG|PL|GR|GS|UP|FG|BR|HZ)*$')
archivos = sorted(glob.glob(os.path.join(METAR, 'MPMG-*.csv'))); assert archivos, 'no hay METAR en ' + METAR
tardes = {}                                    # fecha → [partes del observador de 12:00 a 18:59, alguno con RA]
for f in archivos:
    for r in csv.DictReader(open(f)):
        v = r['valid']
        g = r['metar'].split()
        fin = next((k for k, x in enumerate(g) if re.fullmatch(r'TEMPO|BECMG|NOSIG|RMK', x) or re.fullmatch(r'[QA]\d{4}', x)), len(g))
        ob = g[:fin]; con_ra = any(GRUPO.match(x) and 'VC' not in x and 'RA' in x for x in ob[2:])
        t = dt.datetime.fromisoformat(v) - dt.timedelta(hours=5)
        # tardes con lluvia en Albrook (el hallazgo de la lluvia): todo parte del observador, de rutina o especial
        if PERIODO[0] <= t.year <= PERIODO[1] and 5 <= t.month <= 11 and 12 <= t.hour <= 18 and 'AUTO' not in ob:
            d = tardes.setdefault(t.date(), [0, False]); d[0] += 1; d[1] |= con_ra
        if v[14:16] != '00': continue
        i = int((dt.datetime.fromisoformat(v) - U0).total_seconds() // 3600)
        if not 0 <= i < n: continue
        parte[i] = True; obs[i] = 'AUTO' not in ob; ra[i] = con_ra
assert not (ra & ~obs & per).any()             # un parte AUTO nunca informa lluvia

era5, alb, partes, partes_obs, sin_obs = [], [], [], [], []
for h in range(24):
    s = per & (hr == h)
    era5.append(round(100 * float((Pi[s] >= round(UMBRAL * 10)).mean()), 1))
    po, pt = int((s & obs).sum()), int((s & parte).sum())
    partes.append(pt); partes_obs.append(po)
    if po >= pt / 2 and po > 0: alb.append(round(100 * float(ra[s & obs].mean()), 1))
    else: alb.append(None); sin_obs.append(h)

# tardes de mayo a noviembre: ERA5 con 1 mm o más sumando las horas que terminan de las 13 a las 18 h (de 12 a 18 h), en
# décimas de mm enteras (en coma flotante, 14 tardes de 1,0 mm justo sumaban 0,9999… y no contaban); Albrook, tardes con al
# menos 6 partes del observador de 12:00 a 18:59 y RA en alguno (el criterio del reloj)
nd = n // 24; Pd = Pi[:nd * 24].reshape(nd, 24)[:, 13:19].sum(1); md = mo[:nd * 24:24]; yd = yr[:nd * 24:24]
td = (md >= 5) & (md <= 11)
tardes_era5 = dict(tardes=int(td.sum()), con_1mm=int((Pd[td] >= 10).sum()))
tardes_era5['pct'] = round(100 * tardes_era5['con_1mm'] / tardes_era5['tardes'], 2)
t2 = td & (yd >= PERIODO[0]); tardes_era5['pct_2017_2025'] = round(100 * float((Pd[t2] >= 10).mean()), 2)
ok = [x for x in tardes.values() if x[0] >= 6]
tardes_alb = dict(tardes=len(ok), con_ra=sum(x[1] for x in ok)); tardes_alb['pct'] = round(100 * tardes_alb['con_ra'] / tardes_alb['tardes'], 2)
s25 = lluvias & (yr <= 2025); tot = P[s25].sum()
cantidad = [round(100 * float(P[s25 & (hr == h)].sum() / tot), 1) for h in range(24)]
tarde = round(100 * float(P[s25 & (hr >= 13) & (hr <= 18)].sum() / tot), 1)
pico_e = int(np.argmax(era5)); pico_a = int(np.nanargmax([np.nan if x is None else x for x in alb]))
# hora del máximo con una parábola por los tres valores de la cima: ERA5 en el centro de su hora (h − 0,5), Albrook en el instante h
def vertice(y0, y1, y2, x1):
    return x1 + 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2)
v_e = vertice(era5[pico_e - 1], era5[pico_e], era5[pico_e + 1], pico_e - 0.5)
v_a = vertice(alb[pico_a - 1], alb[pico_a], alb[pico_a + 1], pico_a)
# la cima de Albrook: las horas a menos de 1 punto de su máximo (con ~1.850 partes por hora, el error típico ronda 0,7 puntos)
cima_a = [h for h, x in enumerate(alb) if x is not None and x >= alb[pico_a] - 1]
# el máximo menor de ERA5 en la madrugada (horas que terminan de la 1 a las 6), con el mismo criterio de 1 punto
mad = int(np.argmax(era5[1:7])) + 1; madrugada = [h for h in range(1, 7) if era5[h] >= era5[mad] - 1]
# de 19 a 22 h hay partes AUTO en algunos años: esas horas mezclan años distintos
tarde_auto = {int(y): int((per & parte & ~obs & (hr >= 19) & (hr <= 22) & (yr == y)).sum()) for y in range(PERIODO[0], PERIODO[1] + 1)}
tarde_auto = {y: c for y, c in tarde_auto.items() if c}
coma = lambda x, d=1: f'{x:.{d}f}'.replace('.', ',')

out = dict(
    descripcion='A qué hora del día hay lluvia de mayo a noviembre: ERA5 (celda de ~28 km) y el observador del aeropuerto de Albrook (MPMG, a 4,1 km), 2017–2025. Frecuencias, no milímetros.',
    fuente=dict(era5='ERA5 vía Open-Meteo, celda 9,000° N 79,500° O (datos/clima_horario.bin.gz)',
                albrook='METAR de Albrook (MPMG), Iowa Environmental Mesonet (https://mesonet.agron.iastate.edu/request/download.phtml?network=PA__ASOS)'),
    periodo=list(PERIODO), meses=MESES, hora_local='UTC−5',
    era5=dict(nota=f'% de horas con {coma(UMBRAL)} mm o más (umbralLluvia de mayo a noviembre); la hora h es la que termina a las h (lluvia de h−1 a h)',
              umbral_mm=UMBRAL, pct=era5, pico=pico_e, vertice=round(v_e, 2), madrugada=madrugada),
    albrook=dict(nota='% de partes de rutina de las h:00 hechos por un observador con RA, SHRA o TSRA (con «-» o «+»); no cuentan VC, TS solo ni DZ (WMO-No. 306, FM 15). null: hora sin comparación, menos de la mitad de los partes con observador (AUTO no informa si llueve)',
                 pct=alb, partes=partes, partes_observador=partes_obs, sin_observador=sin_obs, pico=pico_a, cima=cima_a, vertice=round(v_a, 2),
                 nota_tarde='De 19 a 22 h también hay partes AUTO, que no cuentan: ' + ', '.join(f'{c} en {y}' for y, c in tarde_auto.items()) + '. Esas horas salen de una mezcla de años distinta de la del resto del día.',
                 auto_19_22=tarde_auto),
    comparacion=dict(nota='Las dos curvas miden cosas distintas (ERA5: horas enteras con 1,5 mm o más en una celda; Albrook: el instante del parte, con cualquier lluvia, en un punto). Solo se compara la hora del máximo; cada curva se dibuja a escala de su propio máximo. vertice: hora del máximo por una parábola en la cima (ERA5 en el centro de su hora).',
                     desfase_h=round(v_a - v_e, 2), desfase_picos_h=round(pico_a - (pico_e - 0.5), 2),
                     texto='algo más de 1 h: el verificador remuestreó los 9 años (4.000 réplicas) y el desfase por parábola dio una mediana de 1,22 h, con el 95 % entre 0,43 y 1,93 h'),
    cantidad=dict(nota='% de la lluvia de ERA5 de mayo a noviembre de 2001–2025 en cada hora (la que termina a las h); tarde = horas que terminan de las 13 a las 18 h (de 12 a 18 h)',
                  periodo=[2001, 2025], pct=cantidad, tarde=tarde),
    tardes=dict(nota='Tardes de mayo a noviembre. ERA5 (2001–2025): suma de las horas que terminan de las 13 a las 18 h, 1 mm o más, en décimas enteras. Albrook (2017–2025): tardes con 6 partes del observador o más (rutina y especiales) de 12:00 a 18:59, con RA, SHRA o TSRA en alguno; sin llovizna ni lluvia reciente (RE).',
                era5=tardes_era5, albrook=tardes_alb),
    sesgo=dict(cita='Watters, D., Battaglia, A. y Allan, R. P. (2021). The Diurnal Cycle of Precipitation according to Multiple Decades of Global Satellite Observations, Three CMIP6 Models, and the ECMWF Reanalysis. Journal of Climate, 34(12), 5063–5080. doi:10.1175/JCLI-D-20-0966.1',
               dice='Resumen, p. 5063: «The simulated diurnal cycle is unrealistically early when compared with observations, particularly over land (NCAR-CESM2 AMIP: −1 h; ERA5: −2 h; CNRM-CM6.1 AMIP: −4 h on average)». Junio a agosto de 2000–2019, 60° N a 60° S, contra IMERG.'))
dst = os.path.join(AQUI, '../datos/reloj_lluvia.json')
json.dump(out, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
print('escrito', dst, os.path.getsize(dst), 'bytes')
print('ERA5 % horas >=', UMBRAL, 'mm:', era5, '· pico la hora que termina a las', pico_e)
print('Albrook % partes con lluvia:', alb, '· pico el parte de las', pico_a, '· sin observador', sin_obs)
print('madrugada de ERA5 (horas que terminan):', madrugada); print('vértices: ERA5 %.2f h · Albrook %.2f h · desfase %.2f h · cima de Albrook %s · AUTO de 19 a 22 h %s' % (v_e, v_a, v_a - v_e, cima_a, tarde_auto))
print('tardes: ERA5', tardes_era5, '· Albrook', tardes_alb)
print('cantidad de 12 a 18 h (2001–2025): %.1f %%' % tarde)
