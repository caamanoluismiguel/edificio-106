# Ajuste de ERA5 a la estación del aeropuerto de Albrook (MPMG, a 4,1 km del edificio), para la serie 2001–2025 del visor.
# Escribe datos/ajuste_albrook.json, que la app (src/ajuste.js) y confort.mjs aplican al leer: el binario de ERA5 no cambia.
#
#   cd fuente && python3 ajuste_albrook.py [carpeta con los METAR]      (por defecto ~/projects/edificio-106-estaciones/metar)
#
# Los METAR (MPMG-AAAA.csv) se bajan del Iowa Environmental Mesonet, asos.py, con tmpf, dwpf y metar, en UTC, 2001–2025.
# Decisiones del panel de expertos y del verificador (2 de octubre de 2026; informes en ~/projects/edificio-106-estaciones):
#  - Temperatura: mapeo de cuantiles por mes y hora (cada mes y hora, la distribución de ERA5 se lleva a la de Albrook).
#  - Humedad: se resta el sesgo medio de la humedad específica de cada mes (g/kg); la humedad relativa se recalcula.
#  - Calibración: 2017–2025. El desfase de ERA5 bajó con los años, en Albrook y en Tocumen por igual; antes de 2017 el ajuste
#    se queda algo corto (la serie queda ~0,5 g/kg más húmeda y ~0,2 °C más fresca por la tarde que lo que midió Albrook).
#  - Solo partes de rutina (minuto 00). Los METAR redondean al grado entero (WMO-No. 306, 15.11.1): se desredondean con un
#    ruido uniforme de ±0,5 °C con semilla fija. Se excluyen los partes de 37 °C o más (valores dudosos al anochecer).
#  - ERA5 va en pasos de 1/6 °C en el binario y muchos percentiles empatan: sin más, el resultado cambia un 5 % con un
#    redondeo de centésimas. Se desredondea también ERA5 con medio paso de ruido fijo por hora, el mismo en la app
#    (src/ajuste.js): (i · 2654435761 mód 2³²) / 2³², llevado a ±1/12 °C. Así el ajuste no depende de los nudos ni del redondeo.
#  - Fuera de los percentiles 1 y 99 de cada mes y hora, el ajuste suma la diferencia del borde (delta constante).
import csv, glob, gzip, json, math, os, sys, datetime as dt
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
METAR = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/projects/edificio-106-estaciones/metar')
CALIB = (2017, 2025)
P = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 85, 90, 93, 95, 97, 98, 99]   # nudos de la tabla

b = gzip.decompress(open(os.path.join(AQUI, '../datos/clima_horario.bin.gz'), 'rb').read()); assert b[:4] == b'C107'
n = int(np.frombuffer(b[4:8], np.uint32)[0]); C = {}; o = 8
for k in ['nubes', 'lluvia', 'temp', 'hum', 'dni', 'dif', 'viento', 'dir']:
    t = np.dtype('<u2' if k == 'lluvia' else np.uint8); C[k] = np.frombuffer(b[o:o + n * t.itemsize], t).astype(float); o += n * t.itemsize
assert o == len(b)
ET, ERH = C['temp'] / 6 + 10, C['hum']
idx = np.arange(n, dtype=np.uint64)
ETj = ET + (((idx * np.uint64(2654435761)) % np.uint64(4294967296)).astype(float) / 4294967296.0 - 0.5) / 6   # ERA5 desredondeado
tl = np.datetime64('2001-01-01T00', 'h') + np.arange(n)                     # hora de Panamá (UTC−5), como en clima.js
yr = tl.astype('datetime64[Y]').astype(int) + 1970; mo = tl.astype('datetime64[M]').astype(int) % 12 + 1; hr = np.arange(n) % 24

def w_de(t, rh=None, td=None, p=101325.):                                   # la misma fórmula que humedadAbs (src/confort.js)
    pv = 610.94 * np.exp(17.625 * td / (td + 243.04)) if td is not None else rh / 100 * 610.94 * np.exp(17.625 * t / (t + 243.04))
    return 622 * pv / (p - pv)

T = np.full(n, np.nan); Td = np.full(n, np.nan); U0 = dt.datetime(2001, 1, 1, 5)
for f in sorted(glob.glob(os.path.join(METAR, 'MPMG-*.csv'))):
    for r in csv.DictReader(open(f)):
        v = r['valid']
        if v[14:16] != '00': continue                                         # solo el parte de rutina
        i = int((dt.datetime.fromisoformat(v) - U0).total_seconds() // 3600)
        if 0 <= i < n:
            if r['tmpf'] != 'M': T[i] = round((float(r['tmpf']) - 32) * 5 / 9)
            if r['dwpf'] != 'M': Td[i] = round((float(r['dwpf']) - 32) * 5 / 9)
rng = np.random.default_rng(106)
T[T >= 37] = np.nan
Tdes = T + rng.uniform(-0.5, 0.5, n)
cal = (yr >= CALIB[0]) & (yr <= CALIB[1])

tabla = []
for m in range(1, 13):
    fila = []
    for h in range(24):
        s = cal & (mo == m) & (hr == h) & ~np.isnan(Tdes)
        assert s.sum() >= 30, (m, h, s.sum())
        fila.append([[round(float(x), 2) for x in np.percentile(ETj[s], P)], [round(float(x), 2) for x in np.percentile(Tdes[s], P)], int(s.sum())])
    tabla.append(fila)
WE = w_de(ET, rh=ERH); WA = w_de(None, td=Td)
dq = []
for m in range(1, 13):
    s = cal & (mo == m) & ~np.isnan(WA); dq.append(round(float((WE[s] - WA[s]).mean()), 3))

# aplicado a la serie, para el informe
def ajustarT(t, m, h):
    qe, qs, _ = tabla[m - 1][h]; qe, qs = np.array(qe), np.array(qs)
    y = np.interp(t, qe, qs); y = np.where(t < qe[0], t + qs[0] - qe[0], y); return np.where(t > qe[-1], t + qs[-1] - qe[-1], y)
TA = np.empty(n)
for m in range(1, 13):
    for h in range(24):
        a = (mo == m) & (hr == h); TA[a] = ajustarT(ETj[a], m, h)
anios = 25
out = dict(
    descripcion='ERA5 ajustado al aeropuerto de Albrook (MPMG, a 4,1 km): temperatura por mapeo de cuantiles por mes y hora; humedad específica menos el sesgo medio de cada mes. Calibración 2017–2025. Se aplica solo a la serie 2001–2025.',
    fuente='METAR de Albrook (MPMG), partes de rutina, Iowa Environmental Mesonet (https://mesonet.agron.iastate.edu/request/download.phtml?network=PA__ASOS)',
    calibracion=list(CALIB), percentiles=P,
    temperatura=dict(nota='tabla[mes 1–12][hora 0–23] = [percentiles de ERA5 desredondeado, percentiles de Albrook desredondeado, partes]; entre nudos, interpolación lineal; fuera de los percentiles 1 y 99, delta constante. ERA5 desredondeado: t + ((i·2654435761 mód 2^32)/2^32 − 0,5)/6, con i la hora de la serie desde 2001-01-01 00:00', tabla=tabla),
    humedad=dict(nota='g/kg que ERA5 marca de más, por mes (enero a diciembre); se resta a la humedad específica', sesgo=dq),
    resultado=dict(horas30_crudo=round(float((ET >= 30).sum() / anios)), horas30_ajustado=round(float((TA >= 30).sum() / anios)),
                   horas30_ajustado_2017_2025=round(float((TA[cal] >= 30).sum() / 9)),
                   maxima_crudo=round(float(ET.max()), 1), maxima_ajustada=round(float(TA.max()), 1),
                   # la hora más calurosa de la serie ajustada (el momento «La hora más calurosa» de «25 años»; main.js
                   # la usa en lugar de la cruda de clima_resumen.json, que sale de clima_bin.py y no conoce el ajuste)
                   hora_calor=dict(fecha=str(tl[int(np.argmax(TA))].astype('datetime64[D]')), hora=int(hr[int(np.argmax(TA))]),
                                   valor=round(float(TA.max()), 1))))
dst = os.path.join(AQUI, '../datos/ajuste_albrook.json')
json.dump(out, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
print('escrito', dst, os.path.getsize(dst), 'bytes')
print('sesgo de humedad por mes (g/kg):', dq)
print('horas ≥ 30 °C al año: crudo', out['resultado']['horas30_crudo'], '· ajustado', out['resultado']['horas30_ajustado'], '· máxima', out['resultado']['maxima_crudo'], '→', out['resultado']['maxima_ajustada'])
