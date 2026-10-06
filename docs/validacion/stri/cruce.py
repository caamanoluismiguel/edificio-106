"""Cruza la radiación global horizontal medida en la grúa del STRI (PNM, techo) con ERA5 (Open-Meteo) de la celda del visor.
Uso: python3 -I cruce.py <carpeta con los CSV del STRI> <ghi.json>  (anual.py y reciente.py: los mismos dos argumentos y la ruta de cruce.py)"""
import sys, json, csv, datetime as dt
from collections import defaultdict
import statistics as st

dstri, fera = sys.argv[1], sys.argv[2]

def leer(f):
    """15 min, valor = promedio del intervalo que TERMINA en la marca. Solo 'good' (y 'nc' aparte)."""
    out = {}
    with open(f) as fh:
        for r in csv.DictReader(fh):
            if r['chk_note'] not in ('good',):
                continue
            t = dt.datetime.strptime(r['datetime'], '%d/%m/%Y %H:%M:%S')
            out[t] = float(r['sr'])
    return out

fr = leer(dstri + '/pnm_cranetop_srf_elect.csv')
bk = leer(dstri + '/pnm_cranetop_srb_elect.csv')

# hora que termina en H (Open-Meteo: radiación = promedio de la hora anterior a la marca)
def horaria(s):
    acc = defaultdict(list)
    for t, v in s.items():
        fin = t if t.minute == 0 else t.replace(minute=0) + dt.timedelta(hours=1)
        acc[fin].append(v)
    return {h: sum(v) / 4 for h, v in acc.items() if len(v) == 4}

F, B = horaria(fr), horaria(bk)
# dato medido: promedio de los dos sensores si están los dos, si no el que haya
M = {}
for h in set(F) | set(B):
    vs = [x[h] for x in (F, B) if h in x]
    M[h] = sum(vs) / len(vs)

d = json.load(open(fera))['hourly']
E = {dt.datetime.fromisoformat(t): v for t, v in zip(d['time'], d['shortwave_radiation']) if v is not None}

comun = sorted(h for h in M if h in E)
print('horas comunes', len(comun), comun[0], comun[-1])
fb = [(F[h], B[h]) for h in comun if h in F and h in B and E[h] > 50]
print('frente vs atrás (día): media %.1f vs %.1f W/m², dif media %.1f' % (st.mean(a for a, b in fb), st.mean(b for a, b in fb), st.mean(a - b for a, b in fb)))

# desfase horario: correlación con desplazamientos de -2..+2 h
def corr(x, y):
    mx, my = st.mean(x), st.mean(y)
    sx = sum((a - mx) ** 2 for a in x) ** .5; sy = sum((b - my) ** 2 for b in y) ** .5
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / (sx * sy)
for k in (-2, -1, 0, 1, 2):
    par = [(M[h], E[h + dt.timedelta(hours=k)]) for h in comun if h + dt.timedelta(hours=k) in E]
    print('desfase ERA5 %+d h: r = %.3f' % (k, corr([a for a, b in par], [b for a, b in par])))

dia = [h for h in comun if E[h] > 0 or M[h] > 5]
m = [M[h] for h in dia]; e = [E[h] for h in dia]
print('\nHORARIO (horas de día, n=%d): media medida %.0f, ERA5 %.0f W/m², sesgo %+.0f (%+.1f %%), MAE %.0f, RMSE %.0f, r %.3f' % (
    len(dia), st.mean(m), st.mean(e), st.mean(e) - st.mean(m), 100 * (st.mean(e) / st.mean(m) - 1),
    st.mean(abs(a - b) for a, b in zip(e, m)), st.mean((a - b) ** 2 for a, b in zip(e, m)) ** .5, corr(m, e)))

# diario (solo días con 24 h medidas): kWh/m²
dd = defaultdict(lambda: [0, 0, 0])
for h in comun:
    k = (h - dt.timedelta(hours=1)).date()
    dd[k][0] += M[h]; dd[k][1] += E[h]; dd[k][2] += 1
dias = {k: v for k, v in dd.items() if v[2] == 24}
dm = [v[0] / 1000 for v in dias.values()]; de = [v[1] / 1000 for v in dias.values()]
print('DIARIO (n=%d días completos): medido %.2f, ERA5 %.2f kWh/m²·día, sesgo %+.1f %%, r %.3f' % (
    len(dias), st.mean(dm), st.mean(de), 100 * (st.mean(de) / st.mean(dm) - 1), corr(dm, de)))

print('\nPOR MES (días completos): mes  n  medido  ERA5  sesgo%')
for mes in range(1, 13):
    v = [x for k, x in dias.items() if k.month == mes]
    if v:
        a = st.mean(x[0] for x in v) / 1000; b = st.mean(x[1] for x in v) / 1000
        print('%4d %4d  %5.2f  %5.2f  %+5.1f' % (mes, len(v), a, b, 100 * (b / a - 1)))

print('\nPOR HORA (fin de la hora, hora de Panamá): media medida, ERA5, sesgo W/m²')
for hh in range(6, 20):
    v = [(M[h], E[h]) for h in comun if h.hour == hh]
    a = st.mean(x[0] for x in v); b = st.mean(x[1] for x in v)
    print('%02d:00  %4.0f  %4.0f  %+4.0f' % (hh, a, b, b - a))

# temporada seca (dic-abr) vs lluvias (may-nov), tarde 13-17
for nom, meses in (('seca dic-abr', (12, 1, 2, 3, 4)), ('lluvias may-nov', range(5, 12))):
    v = [(M[h], E[h]) for h in comun if h.month in meses and 14 <= h.hour <= 17]
    print('tarde (13-17 h) %s: medido %.0f, ERA5 %.0f W/m², %+.1f %%' % (nom, st.mean(x[0] for x in v), st.mean(x[1] for x in v),
          100 * (st.mean(x[1] for x in v) / st.mean(x[0] for x in v) - 1)))
print('años con datos:', sorted({k.year for k in dias}), {y: sum(1 for k in dias if k.year == y) for y in sorted({k.year for k in dias})})
