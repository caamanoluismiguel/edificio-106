"""Recalcula las cifras de «Lo que le pide su fachada» desde datos/clima_horario.bin.gz (C107).
Uso: python3 datos/di/cifras.py .   (desde la raíz del repo edificio-106; necesita numpy)"""
import gzip, json, sys, os, datetime as dt
import numpy as np
R = sys.argv[1]
b = gzip.decompress(open(os.path.join(R, 'datos/clima_horario.bin.gz'), 'rb').read())
assert b[:4] == b'C107'; n = int(np.frombuffer(b[4:8], np.uint32)[0]); o = 8; C = {}
for k in ['nubes', 'lluvia', 'temp', 'hum', 'dni', 'dif', 'viento', 'dir']:
    t = np.dtype('<u2' if k == 'lluvia' else np.uint8); C[k] = np.frombuffer(b[o:o + n * t.itemsize], t).astype(float); o += n * t.itemsize
assert o == len(b)
P = C['lluvia'] / 10; DNI = C['dni'] * 4; DIF = C['dif'] * 4; Vk = C['viento']; V = Vk / 3.6; D = C['dir'] * 2
anios = n / 8766; rad = np.pi / 180
t0 = np.datetime64('2001-01-01T00')
fechas = t0 + np.arange(n).astype('timedelta64[h]')
mes = (fechas.astype('datetime64[M]').astype(int) % 12) + 1
TEMP = json.load(open(os.path.join(R, 'fuente/src/temporadas.json')))
seca = np.isin(mes, TEMP['seca']); lluv = np.isin(mes, TEMP['lluvias'])
FAC = {'se': 146, 'no': 326, 'ne': 56, 'so': 236}
out = {'horas': n, 'anios': round(anios, 3)}
# 1. lluvia con viento, ISO 15927-3: (2/9)·v·r^(8/9)·cos(D−θ), solo con el viento hacia la cara
lv = {}
for f, th in FAC.items():
    c = np.clip(np.cos((D - th) * rad), 0, None); I = 2 / 9 * V * P ** (8 / 9) * c
    lv[f] = dict(anual=round(I.sum() / anios), lluvias=round(I[lluv].sum() / anios))
out['lluvia_viento_L_m2'] = lv
out['razon_lluvia_NO_NE'] = round(lv['no']['anual'] / lv['ne']['anual'], 2)
# 2. horas al año con viento de frente: ±60° de la normal y 5 km/h o más
fr = {}
for nom, sel in [('anio', np.ones(n, bool)), ('seca', seca), ('lluvias', lluv)]:
    fr[nom] = {f: round((((np.cos((D - th) * rad) > 0.5) & (Vk >= 5) & sel).sum()) / anios) for f, th in FAC.items()}
out['horas_viento_frente'] = fr
out['razon_viento_NO_siguiente'] = round(fr['anio']['no'] / max(v for k, v in fr['anio'].items() if k != 'no'), 2)
mov = seca & (Vk >= 3.6); sec = (((D[mov] + 11.25) % 360) // 22.5).astype(int)
fq = np.bincount(sec, minlength=16) / seca.sum() * 100
out['seca_pct_horas_N_NNO_NO'] = round(fq[0] + fq[15] + fq[14], 1)
out['horas_seca_por_anio'] = round(seca.sum() / anios)
out['pct_seca_NO_de_frente'] = round(fr['seca']['no'] / (seca.sum() / anios) * 100)
out['viento_medio_kmh'] = dict(seca=round(Vk[seca].mean(), 1), lluvias=round(Vk[lluv].mean(), 1))
# 3. sol: NOAA al centro de cada hora (H−0,5), hora de Panamá = UTC−5
LAT, LON = 8.9993, -79.5827
h = np.arange(n) - 0.5 + 5; jd = 2451910.5 + h / 24; T = (jd - 2451545) / 36525
L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360; M = 357.52911 + T * (35999.05029 - 0.0001537 * T)
e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T)
Cc = np.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) + np.sin(2 * M * rad) * (0.019993 - 0.000101 * T) + np.sin(3 * M * rad) * 0.000289
om = 125.04 - 1934.136 * T; lam = L0 + Cc - 0.00569 - 0.00478 * np.sin(om * rad)
eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * np.cos(om * rad)
dec = np.arcsin(np.sin(eps * rad) * np.sin(lam * rad)); y = np.tan(eps / 2 * rad) ** 2
eq = 4 / rad * (y * np.sin(2 * L0 * rad) - 2 * e * np.sin(M * rad) + 4 * e * y * np.sin(M * rad) * np.cos(2 * L0 * rad) - 0.5 * y * y * np.sin(4 * L0 * rad) - 1.25 * e * e * np.sin(2 * M * rad))
ha = (((h % 24) * 60 + eq + 4 * LON) % 1440) / 4 - 180
cz = np.clip(np.sin(LAT * rad) * np.sin(dec) + np.cos(LAT * rad) * np.cos(dec) * np.cos(ha * rad), -1, 1)
alt = np.arcsin(cz) / rad; sa = np.clip(cz, 0, 1); ca = np.sqrt(1 - sa ** 2)
den = np.cos(LAT * rad) * np.sqrt(1 - cz ** 2)
aa = np.clip((np.sin(LAT * rad) * cz - np.sin(dec)) / np.where(np.abs(den) < 1e-6, 1e-6, den), -1, 1)
az = np.where(ha > 0, (np.arccos(aa) / rad + 180) % 360, (540 - np.arccos(aa) / rad) % 360)
# corte del piso 2 (CORTE en main.js): alero 7,40; vidrio 5,62 a 7,12; rehundido 0,10; vuelo 1,65
P_SOL = np.degrees(np.arctan((7.40 - 7.12) / 1.75)); P_SOMBRA = np.degrees(np.arctan((7.40 - 5.62) / 1.75))
out['corte_piso2_grados'] = dict(todo_al_sol_bajo=round(P_SOL, 1), todo_a_la_sombra_sobre=round(P_SOMBRA, 1))
sol = {}
for f, th in FAC.items():
    c = np.cos((az - th) * rad); inc = np.where((sa > 0) & (c > 0), ca * c, 0)
    E = DNI * inc  # W/m² de directa sobre la pared vertical
    pf = np.degrees(np.arctan(np.tan(np.clip(alt, 0, 89.9) * rad) / np.where(c > 0.01, c, np.nan)))
    tot = E.sum()
    bajo = E[(c > 0.01) & (pf < P_SOL)].sum(); alto = E[(c > 0.01) & (pf > P_SOMBRA)].sum()
    sol[f] = dict(directa_kWh_m2=round(tot / anios / 1000), pct_perfil_bajo_9=round(bajo / tot * 100), pct_perfil_sobre_45=round(alto / tot * 100), pct_perfil_entre=round((tot - bajo - alto) / tot * 100))
out['sol_directo_pared'] = sol
out['razon_sol_SE_NO'] = round(sol['se']['directa_kWh_m2'] / sol['no']['directa_kWh_m2'], 2)
out['razon_sol_SO_NO'] = round(sol['so']['directa_kWh_m2'] / sol['no']['directa_kWh_m2'], 2)
GHI = DNI * sa + DIF
out['techo_kWh_m2'] = dict(total=round(GHI.sum() / anios / 1000), directa=round((DNI * sa).sum() / anios / 1000))
# 4. lluvia sobre el techo
anual = {}
yr = fechas.astype('datetime64[Y]').astype(int) + 1970
for a in range(2001, 2026): anual[a] = P[yr == a].sum()
out['lluvia_anual_media_mm'] = round(np.mean(list(anual.values())))
um = np.where((mes >= 4) & (mes <= 11), 1.5, 1.0)
out['horas_lluvia_umbral_por_anio'] = round((P >= um - 1e-9).sum() / anios)
out['horas_10mm_por_anio'] = round((P >= 10).sum() / anios, 1)
i = int(np.argmax(P)); out['hora_max_mm'] = dict(mm=P[i], marca=str(fechas[i]))
print(json.dumps(out, ensure_ascii=False, indent=1, default=float))
# contraste con consultas.json
Q = json.load(open(os.path.join(R, 'datos/consultas.json')))
for f in FAC:
    assert Q['lluviaViento'][f]['anual'] == lv[f]['anual'], f
    assert Q['viento']['anio']['frente'][f] == fr['anio'][f], f
    assert abs(Q['radiacion']['fachadas'][f]['directa'] - sol[f]['directa_kWh_m2']) <= 1, f
print('OK: coincide con datos/consultas.json')
