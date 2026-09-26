"""Empaqueta el clima horario (Open-Meteo, hora de Panamá) para el navegador.
Columnas uint8, 219.144 horas desde 2001-01-01 00:00:
 nubes %, lluvia (0,2 mm), temp ((°C−10)×6), humedad %, DNI (/4 W/m²), difusa (/4), viento km/h, dirección (/2°)."""
import json, glob, gzip, sys, datetime as dt
import numpy as np
src, out = sys.argv[1], sys.argv[2]
T, V = [], {}
meta = None
ERA5 = 'era5' in src
for f in sorted(glob.glob(src + '/openmeteo_*.json') + glob.glob(src + '/era5_*.json')):
    d = json.load(open(f)); meta = {k: d.get(k) for k in ('latitude', 'longitude', 'elevation')}
    h = d['hourly']; T += h['time']
    for k, v in h.items():
        if k != 'time': V.setdefault(k, []).extend(v)
A = {k: np.array([np.nan if x is None else x for x in v], float) for k, v in V.items()}
n = len(T); t0 = dt.datetime.fromisoformat(T[0]); assert T[0].startswith('2001-01-01T00')
def u8(a, esc, off=0.0):
    b = np.round((np.nan_to_num(a, nan=off) - off) * esc); return np.clip(b, 0, 254).astype(np.uint8)
cols = [u8(A['cloud_cover'], 1), u8(A['precipitation'], 5), u8(A['temperature_2m'], 6, 10), u8(A['relative_humidity_2m'], 1),
        u8(A['direct_normal_irradiance'], 0.25), u8(A['diffuse_radiation'], 0.25), u8(A['wind_speed_10m'], 1), u8(A['wind_direction_10m'], 0.5)]
buf = b'C106' + np.array([n], np.uint32).tobytes() + b''.join(c.tobytes() for c in cols)
open(out + '/clima_horario.bin.gz', 'wb').write(gzip.compress(buf, 9))
print('horas', n, 'crudo', len(buf) / 1e6, 'gz', len(gzip.compress(buf, 9)) / 1e6)
# bandas típicas por mes y hora
tt = np.array([dt.datetime.fromisoformat(x) for x in T]); mes = np.array([x.month for x in tt]); hora = np.array([x.hour for x in tt]); anio = np.array([x.year for x in tt])
def banda(a):
    r = {}
    for q in (10, 50, 90):
        M = np.zeros((12, 24))
        for m in range(12):
            for h in range(24):
                s = a[(mes == m + 1) & (hora == h)]; s = s[~np.isnan(s)]
                M[m, h] = np.percentile(s, q) if len(s) else np.nan
        r['p%d' % q] = np.round(M, 1).tolist()
    return r
prob = np.zeros((12, 24))
for m in range(12):
    for h in range(24):
        s = A['precipitation'][(mes == m + 1) & (hora == h)]; prob[m, h] = round(100 * np.mean(s >= 1.0), 1)
res = dict(fuente=('Reanálisis ERA5 vía Open-Meteo' if ERA5 else 'Open-Meteo, archivo histórico (mejor modelo disponible)') + ' · celda %.3f° N, %.3f° O, %d m' % (meta['latitude'], -meta['longitude'], meta['elevation']), era5=ERA5,
           inicio='2001-01-01T00:00', horas=n,
           temp=banda(A['temperature_2m']), nubes=banda(A['cloud_cover']), humedad=banda(A['relative_humidity_2m']), viento=banda(A['wind_speed_10m']), dni=banda(A['direct_normal_irradiance']),
           probLluvia=prob.tolist())
# serie mensual y anual
mens = []
for y in range(2001, 2026):
    for m in range(1, 13):
        s = (anio == y) & (mes == m); mens.append(dict(y=y, m=m, lluvia=round(float(np.nansum(A['precipitation'][s])), 1)))
clim_m = [round(float(np.mean([q['lluvia'] for q in mens if q['m'] == m])), 1) for m in range(1, 13)]
res['mensual'] = mens; res['climMensual'] = clim_m
res['anual'] = [dict(y=y, lluvia=round(sum(q['lluvia'] for q in mens if q['y'] == y), 1)) for y in range(2001, 2026)]
# momentos elegidos por los propios datos (extremos de la serie; nada curado a mano)
def fecha_de(i): return (t0 + dt.timedelta(hours=int(i)))
P = A['precipitation']; Tm = A['temperature_2m']
mom = []
i = int(np.nanargmax(P)); f = fecha_de(i)
mom.append(dict(id='hora-lluvia', titulo='La hora más lluviosa', fecha=f.strftime('%Y-%m-%d'), hora=f.hour, valor=round(float(P[i]), 1), unidad='mm en una hora'))
# la lluvia marcada en la hora H cayó entre H−1 y H: el día d va de la marca 01:00 a la 24:00 (00:00 del día siguiente)
nd = (n - 1) // 24; D = np.nansum(P[1:nd * 24 + 1].reshape(nd, 24), axis=1); j = int(np.argmax(D)); fd = t0 + dt.timedelta(days=j)
k = int(np.nanargmax(P[j * 24 + 1:j * 24 + 25])) + 1
mom.append(dict(id='dia-lluvia', titulo='El día más lluvioso', fecha=fd.strftime('%Y-%m-%d'), hora=k, valor=round(float(D[j]), 0), unidad='mm en el día'))
mm = max(mens, key=lambda q: q['lluvia'])
mom.append(dict(id='mes-lluvia', titulo='El mes más lluvioso', fecha='%d-%02d-15' % (mm['y'], mm['m']), hora=15, valor=round(mm['lluvia']), unidad='mm en el mes'))
an = res['anual']; ay = min(an, key=lambda q: q['lluvia']); aw = max(an, key=lambda q: q['lluvia'])
mom.append(dict(id='anio-seco', titulo='El año más seco', fecha='%d-10-15' % ay['y'], hora=15, valor=round(ay['lluvia']), unidad='mm en el año'))
mom.append(dict(id='anio-lluvia', titulo='El año más lluvioso', fecha='%d-10-15' % aw['y'], hora=15, valor=round(aw['lluvia']), unidad='mm en el año'))
i = int(np.nanargmax(Tm)); f = fecha_de(i)
mom.append(dict(id='hora-calor', titulo='La hora más calurosa', fecha=f.strftime('%Y-%m-%d'), hora=f.hour, valor=round(float(Tm[i]), 1), unidad='°C'))
res['promedioAnual'] = round(float(np.mean([q['lluvia'] for q in an])))
res['momentos'] = mom
json.dump(res, open(out + '/clima_resumen.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print('momentos', mom)
print('resumen KB', len(json.dumps(res)) / 1e3)
