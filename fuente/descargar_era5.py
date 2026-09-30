"""Baja la serie horaria ERA5 2001–2025 de Open-Meteo, un archivo por año, para rehacer datos/clima_horario.bin.gz.
  cd fuente && python3 descargar_era5.py            escribe raw/era5/era5_YYYY.json (carpeta ignorada por git)
  python3 clima_bin.py raw/era5 ../datos && python3 consultas.py ../datos/clima_horario.bin.gz ../datos/consultas.json
Fuente: API de archivo de Open-Meteo (gratis, sin clave), reanálisis ERA5 de Copernicus/ECMWF. Accedida el 2026-09-30:
  https://archive-api.open-meteo.com/v1/archive?latitude=8.9993&longitude=-79.5827&start_date=AAAA-01-01&end_date=AAAA-12-31
  &hourly=cloud_cover,precipitation,temperature_2m,relative_humidity_2m,direct_normal_irradiance,diffuse_radiation,
  wind_speed_10m,wind_direction_10m&models=era5&timezone=America/Panama
Unidades por defecto de la API (°C, mm, km/h, W/m²); Open-Meteo devuelve la celda 9,000° N, 79,500° O, 24 m.
Los últimos meses salen de ERA5T (preliminar): ECMWF puede revisarlos, así que una bajada posterior puede diferir ahí.
Pide un año cada vez con pausa entre pedidos (el límite gratuito cuenta variables × días) y no repite los que ya bajó."""
import json, os, sys, time, urllib.request, urllib.error
from urllib.parse import urlencode

URL = 'https://archive-api.open-meteo.com/v1/archive'
LAT, LON = 8.9993, -79.5827                       # fuente/src/sol.js
VARS = 'cloud_cover,precipitation,temperature_2m,relative_humidity_2m,direct_normal_irradiance,diffuse_radiation,wind_speed_10m,wind_direction_10m'
AQUI = os.path.dirname(os.path.abspath(__file__))
DEST = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, 'raw', 'era5')
PAUSA = 8                                          # s entre pedidos

os.makedirs(DEST, exist_ok=True)
for y in range(2001, 2026):
    f = os.path.join(DEST, 'era5_%d.json' % y)
    if os.path.exists(f): continue
    q = dict(latitude=LAT, longitude=LON, start_date='%d-01-01' % y, end_date='%d-12-31' % y, hourly=VARS, models='era5', timezone='America/Panama')
    for intento in range(5):
        try:
            d = json.load(urllib.request.urlopen(URL + '?' + urlencode(q), timeout=120)); break
        except urllib.error.HTTPError as e:            # 429: límite por minuto u hora; se espera y se reintenta
            print(y, 'HTTP', e.code, e.read()[:200]); time.sleep(60 * (intento + 1))
    else: sys.exit('no se pudo bajar %d' % y)
    h = d['hourly']; assert h['time'][0] == '%d-01-01T00:00' % y and len(h['time']) in (8760, 8784), (y, len(h['time']))
    json.dump(d, open(f, 'w'))
    print(y, len(h['time']), 'horas', d['latitude'], d['longitude'], d['elevation'])
    time.sleep(PAUSA)
