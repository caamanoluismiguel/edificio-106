"""Catálogo de consultas (extremos de la serie ERA5 2001–2025) para el panel «Ir a…».
Lee el binario horario del sitio; escribe datos/consultas.json. Todo sale de los datos, nada a mano."""
import gzip, json, sys, datetime as dt
import numpy as np
b = gzip.decompress(open(sys.argv[1], 'rb').read()); n = int(np.frombuffer(b[4:8], np.uint32)[0])
C = {k: np.frombuffer(b[8 + i * n: 8 + (i + 1) * n], np.uint8).astype(float) for i, k in enumerate(['nubes', 'lluvia', 'temp', 'hum', 'dni', 'dif', 'viento', 'dir'])}
P = C['lluvia'] / 5; DNI = C['dni'] * 4; DIF = C['dif'] * 4; V = C['viento'] / 3.6; D = C['dir'] * 2; T = C['temp'] / 6 + 10; NUB = C['nubes']
t0 = dt.datetime(2001, 1, 1)
# altitud del sol al centro de cada hora de radiación (H−0,5), NOAA vectorizado, hora de Panamá = UTC−5
LAT, LON = 8.9993, -79.5827; rad = np.pi / 180
h = np.arange(n) - 0.5 + 5          # horas UTC desde 2001-01-01 00:00 UTC
jd = 2451910.5 + h / 24; Tc = (jd - 2451545) / 36525
L0 = (280.46646 + Tc * (36000.76983 + Tc * 0.0003032)) % 360; M = 357.52911 + Tc * (35999.05029 - 0.0001537 * Tc)
e = 0.016708634 - Tc * (0.000042037 + 0.0000001267 * Tc)
Cc = np.sin(M * rad) * (1.914602 - Tc * (0.004817 + 0.000014 * Tc)) + np.sin(2 * M * rad) * (0.019993 - 0.000101 * Tc) + np.sin(3 * M * rad) * 0.000289
om = 125.04 - 1934.136 * Tc; lam = L0 + Cc - 0.00569 - 0.00478 * np.sin(om * rad)
eps = 23 + (26 + (21.448 - Tc * (46.815 + Tc * (0.00059 - Tc * 0.001813))) / 60) / 60 + 0.00256 * np.cos(om * rad)
dec = np.arcsin(np.sin(eps * rad) * np.sin(lam * rad)); yv = np.tan(eps / 2 * rad) ** 2
eq = 4 / rad * (yv * np.sin(2 * L0 * rad) - 2 * e * np.sin(M * rad) + 4 * e * yv * np.sin(M * rad) * np.cos(2 * L0 * rad) - 0.5 * yv * yv * np.sin(4 * L0 * rad) - 1.25 * e * e * np.sin(2 * M * rad))
tst = ((h % 24) * 60 + eq + 4 * LON) % 1440; ha = tst / 4 - 180
cz = np.sin(LAT * rad) * np.sin(dec) + np.cos(LAT * rad) * np.cos(dec) * np.cos(ha * rad)
sinalt = np.clip(cz, 0, 1)
GHI = DNI * sinalt + DIF                        # W/m², promedio de la hora
nd = (n - 1) // 24
dia = lambda a: a[1:nd * 24 + 1].reshape(nd, 24)   # el día d va de la marca 01:00 a la 24:00
Pd = dia(P).sum(1); Gd = dia(GHI).sum(1) / 1000   # mm/día, kWh/m²·día
DNId = dia(DNI * (sinalt > 0)).sum(1) / 1000
fecha = lambda j: (t0 + dt.timedelta(days=int(j))).strftime('%Y-%m-%d')
def top(a, k, mayor=True, sep=3):
    orden = np.argsort(-a if mayor else a); r = []
    for j in orden:
        if all(abs(j - q) > sep for q in r): r.append(int(j))
        if len(r) == k: break
    return r
out = {'fuente': 'ERA5 (Open-Meteo), celda de ~28 km, 2001–2025', 'dias': nd}
# lluvia
out['diasLluvia'] = [dict(fecha=fecha(j), mm=round(float(Pd[j])), hora=int(np.argmax(dia(P)[j])) + 1, pico=round(float(dia(P)[j].max()), 1)) for j in top(Pd, 5)]
Hj = [int(i) for i in np.argsort(-P)]; hr = []
for i in Hj:
    if all(abs(i - q) > 72 for q in hr): hr.append(i)
    if len(hr) == 5: break
def marca(i):   # la marca 00:00 es la hora 24 del día anterior (la lluvia cayó de 23 a 24)
    f = t0 + dt.timedelta(hours=int(i))
    return ((f - dt.timedelta(days=1)).strftime('%Y-%m-%d'), 24) if f.hour == 0 else (f.strftime('%Y-%m-%d'), f.hour)
out['horasLluvia'] = [dict(fecha=marca(i)[0], hora=marca(i)[1], mm=round(float(P[i]), 1)) for i in hr]
# luz: irradiación global horizontal del día (kWh/m²)
out['diasSol'] = [dict(fecha=fecha(j), kwh=round(float(Gd[j]), 2), directa=round(float(DNId[j]), 2)) for j in top(Gd, 5)]
out['diasOscuros'] = [dict(fecha=fecha(j), kwh=round(float(Gd[j]), 2), mm=round(float(Pd[j]))) for j in top(Gd, 5, False)]
out['solMedio'] = round(float(Gd.mean()), 2)
# racha seca más larga (días seguidos con menos de 1 mm)
seco = Pd < 1; best = (0, 0); cur = 0
for j, s in enumerate(seco):
    cur = cur + 1 if s else 0
    if cur > best[0]: best = (cur, j)
out['rachaSeca'] = dict(dias=best[0], desde=fecha(best[1] - best[0] + 1), hasta=fecha(best[1]))
# lluvia con viento sobre cada fachada (índice de lluvia impulsada por el viento, ISO 15927-3: (2/9)·v·r^(8/9)·cos(D−θ))
FAC = {'se': 146, 'no': 326, 'ne': 56, 'so': 236}
out['lluviaViento'] = {}
anios = n / 8766
for k, th in FAC.items():
    c = np.cos((D - th) * rad); c[c < 0] = 0
    I = 2 / 9 * V * np.power(P, 8 / 9) * c           # l/m² en la hora
    i = int(np.argmax(I)); fm, hm = marca(i)
    lluvioso = np.isin(np.array([(t0 + dt.timedelta(hours=int(x))).month for x in range(0, n, 24)]).repeat(24)[:n], [5, 6, 7, 8, 9, 10, 11])
    out['lluviaViento'][k] = dict(anual=round(float(I.sum() / anios)), temporada=round(float(I[lluvioso].sum() / anios)), max=dict(fecha=fm, hora=hm, l=round(float(I[i]), 1), mm=round(float(P[i]), 1), viento=round(float(V[i] * 3.6)), dir=int(D[i])))
# día típico de cada mes: el día real más cercano a la mediana del mes en sol (kWh/m²) y lluvia (mm), en unidades de desviación
meses = np.array([(t0 + dt.timedelta(days=j)).month for j in range(nd)])
tip = []
for m in range(1, 13):
    J = np.where(meses == m)[0]; g, p = Gd[J], Pd[J]
    dz = ((g - np.median(g)) / g.std()) ** 2 + ((np.sqrt(p) - np.median(np.sqrt(p))) / np.sqrt(p).std()) ** 2
    j = int(J[np.argmin(dz)])
    tip.append(dict(m=m, fecha=fecha(j), kwh=round(float(Gd[j]), 2), mm=round(float(Pd[j]), 1), kwhMed=round(float(np.median(g)), 2), mmMed=round(float(np.median(p)), 1), probLluvia=round(float(np.mean(p >= 1) * 100))))
out['tipicos'] = tip
# viento: rosa de 16 rumbos por temporada, calmas y horas con viento de frente en cada fachada
mesH = np.array([(t0 + dt.timedelta(hours=int(i))).month for i in range(0, n, 24)]).repeat(24)[:n]
Vk = C['viento']                                   # km/h
TEMP = {'seca': [12, 1, 2, 3, 4], 'lluvias': [5, 6, 7, 8, 9, 10, 11], 'anio': list(range(1, 13))}
vien = {}
for kk, ms in TEMP.items():
    sel = np.isin(mesH, ms); tot = sel.sum(); mov = sel & (Vk >= 3.6)
    sec = (((D[mov] + 11.25) % 360) // 22.5).astype(int)
    frec = np.bincount(sec, minlength=16) / tot * 100
    vel = np.array([Vk[mov][sec == i].mean() if (sec == i).any() else 0 for i in range(16)])
    fr = {}
    for f, th in FAC.items():
        c = np.cos((D - th) * rad); fr[f] = round(float(((c > 0.5) & (Vk >= 5) & sel).sum() / anios))
    vien[kk] = dict(frec=[round(float(x), 1) for x in frec], vel=[round(float(x), 1) for x in vel], calma=round(float((sel & (Vk < 3.6)).sum() / tot * 100), 1),
                    media=round(float(Vk[sel].mean()), 1), frente=fr)
out['viento'] = vien
# radiación anual sobre cada fachada (muro sin alero): directa, difusa (cielo anisótropo de Hay-Davies) y reflejada (suelo al 20 %)
den = np.cos(LAT * rad) * np.sqrt(1 - np.clip(cz, -1, 1) ** 2)
aa = np.clip((np.sin(LAT * rad) * np.clip(cz, -1, 1) - np.sin(dec)) / np.where(np.abs(den) < 1e-6, 1e-6, den), -1, 1)
az = np.where(ha > 0, (np.arccos(aa) / rad + 180) % 360, (540 - np.arccos(aa) / rad) % 360)
calt = np.sqrt(1 - sinalt ** 2)
# Hay-Davies: Id = DHI · [Ai · Rb + (1 − Ai) · (1 + cos β) / 2]; en un muro vertical, cos β = 0.
# Ai = DNI / DNI fuera de la atmósfera ese día (1.367 W/m² con la excentricidad de la órbita), la parte de la difusa que viene
# de alrededor del sol; Rb = cos(incidencia) / cos(cenit), con el cenit acotado a 85° (0,087) y 0 con el sol detrás del muro.
dia_h = np.datetime64('2001-01-01') + np.floor((np.arange(n) - 0.5) / 24).astype(int)          # fecha local del centro de la hora
doy = (dia_h - dia_h.astype('datetime64[Y]')).astype(int) + 1
Ai = np.clip(DNI / (1367 * (1 + 0.033 * np.cos(2 * np.pi * doy / 365))), 0, 1)
rad_f = {}
for f, th in FAC.items():
    inc = calt * np.cos((az - th) * rad); inc = np.where((sinalt > 0) & (inc > 0), inc, 0)
    Rb = inc / np.maximum(sinalt, 0.087)
    d_ = (DNI * inc).sum() / anios / 1000; f_ = (DIF * (Ai * Rb + (1 - Ai) * 0.5)).sum() / anios / 1000; r_ = 0.5 * 0.2 * GHI.sum() / anios / 1000
    rad_f[f] = dict(directa=round(float(d_)), difusa=round(float(f_)), reflejada=round(float(r_)), total=round(float(d_ + f_ + r_)))
out['radiacion'] = dict(fachadas=rad_f, techo=dict(total=round(float(GHI.sum() / anios / 1000)), directa=round(float((DNI * sinalt).sum() / anios / 1000)), difusa=round(float(DIF.sum() / anios / 1000))))
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, separators=(',', ':'))
print(json.dumps(out, ensure_ascii=False, indent=1))
