# Referencia independiente para la posición del sol: NREL SPA (Reda y Andreas, 2004, «Solar position algorithm for solar
# radiation applications», Solar Energy 76(5), 577–589, doi:10.1016/j.solener.2003.12.003), en la implementación de pvlib
# (pvlib.solarposition.spa_python y sun_rise_set_transit_spa). Escribe fuente/spa_referencia.csv, que verificar-sol.mjs
# compara con src/sol.js (NOAA/Meeus). El CSV se comitea: la comprobación corre sin Python.
#   python fuente/spa_referencia.py        (requiere pvlib y pandas; probado con pvlib 0.16.1)
# Filas «pos»: instante UTC en ms, altura aparente y azimut de SPA, con un paso irregular de 3 d 1 h 7 min que barre todas las
# horas del día de 2001 a 2025. Filas «dia»: salida y puesta de SPA (centro del disco a −0,8333°) los días 1 y 15 de cada mes.
# Atmósfera: 1013,25 hPa y 27 °C (Tocumen promedia 27,3 °C al año, ETESA); la refracción de NOAA en sol.js no depende de ellas.
import os
import numpy as np
import pandas as pd
import pvlib

LAT, LON, ALTURA = 8.9993, -79.5827, 24          # lat y lon de src/sol.js; 24 m de altura sobre el mar (casi no cambia nada)
AQUI = os.path.dirname(os.path.abspath(__file__))

# posiciones
ms = np.arange(pd.Timestamp('2001-01-01 05:00Z').value // 10**6, pd.Timestamp('2026-01-01 05:00Z').value // 10**6,
               (3 * 86400 + 3600 + 7 * 60) * 1000, dtype=np.int64)
t = pd.to_datetime(ms, unit='ms', utc=True)
s = pvlib.solarposition.spa_python(t, LAT, LON, altitude=ALTURA, pressure=101325, temperature=27)

# salida y puesta (días a medianoche, hora de Panamá: UTC−5 todo el año)
dias = pd.DatetimeIndex([pd.Timestamp(y, m, d) for y in range(2001, 2026) for m in range(1, 13) for d in (1, 15)]).tz_localize('Etc/GMT+5')
r = pvlib.solarposition.sun_rise_set_transit_spa(dias, LAT, LON, how='numpy')
minuto = lambda x: (x.dt.tz_convert('Etc/GMT+5') - dias.to_series(index=r.index)).dt.total_seconds() / 60

with open(os.path.join(AQUI, 'spa_referencia.csv'), 'w') as f:
    f.write(f'# NREL SPA via pvlib {pvlib.__version__} spa_python; lat {LAT} lon {LON}; 1013,25 hPa, 27 °C. Lo genera fuente/spa_referencia.py\n')
    f.write('tipo,a,b,c\n')
    for k in range(len(ms)):
        f.write(f"pos,{ms[k]},{s['apparent_elevation'].iloc[k]:.5f},{s['azimuth'].iloc[k]:.5f}\n")
    for d, sa, po in zip(dias, minuto(r['sunrise']), minuto(r['sunset'])):
        f.write(f'dia,{d.strftime("%Y-%m-%d")},{sa:.3f},{po:.3f}\n')
print(len(ms), 'posiciones y', len(dias), 'días')
