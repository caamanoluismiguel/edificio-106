import sys, math, statistics as st, datetime as dt
E, M, D, H, DNI, DHI = sys.argv[1], *map(float, sys.argv[2:7])
sys.path.insert(0, '.')
r = [tuple(map(float, l.split())) for l in open(f'res_{E}.txt') if l.strip()]
# altura del sol de gendaylit: se lee del cielo
alt = None
for l in open(f'cielo_{E}.rad'):
    if 'Solar altitude' in l: alt = float(l.split(':')[1].split()[0])
sh = math.sin(math.radians(alt)); Eb = DNI * sh
sol = [t for d, t in r if d > 0.5 * Eb]; som = [t for d, t in r if d < 0.05 * Eb]
doy = dt.date(2024, int(M), int(D)).timetuple().tm_yday
Ai = min(1, DNI / (1367 * (1 + 0.033 * math.cos(2 * math.pi * doy / 365))))
Rf = (DNI * sh + DHI) / (DHI * max(0.05, 1 - Ai))
print(f'{E}: sol a {alt:.1f}°, DNI {DNI:.0f}, DHI {DHI:.0f} | puntos al sol {len(sol)}, en sombra {len(som)} | '
      f'Radiance: {st.median(sol):.0f} / {st.median(som):.0f} W/m² → razón {st.median(sol)/st.median(som):.2f} | fórmula del visor {Rf:.2f}')
