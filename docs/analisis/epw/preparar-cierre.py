"""Codex: prepara el cierre EPW desde la respuesta ERA5 conservada, sin cambiar C107."""
import gzip
import hashlib
import json
import struct
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
source = HERE / 'cierre-2025-api.json'
evidence = json.loads(source.read_text())
d = evidence['respuesta']
assert (d['latitude'], d['longitude'], d['elevation'], d['utc_offset_seconds']) == (9, -79.5, 24, -18000)
h = d['hourly']
keys = ['cloud_cover', 'precipitation', 'temperature_2m', 'relative_humidity_2m',
        'direct_normal_irradiance', 'diffuse_radiation', 'wind_speed_10m', 'wind_direction_10m']
names = ['nubes', 'lluvia', 'temp', 'humedad', 'dni', 'difusa', 'viento', 'dir']
scales = [1, 10, 6, 1, .25, .25, 1, .5]
offsets = [0, 0, 10, 0, 0, 0, 0, 0]
units = ['%', 'mm', '°C', '%', 'W/m²', 'W/m²', 'km/h', '°']
i = h['time'].index('2026-01-01T00:00')
assert i == 24 and h['time'][0] == '2025-12-31T00:00'
b = gzip.decompress((ROOT / 'datos/clima_horario.bin.gz').read_bytes())
assert b[:4] == b'C107'
n = struct.unpack_from('<I', b, 4)[0]
assert n == 219144
position = 8
values, differences = {}, {}
for key, name, scale, offset, unit in zip(keys, names, scales, offsets, units):
    assert d['hourly_units'][key] == unit
    raw = np.array(h[key][:i + 1], dtype=float)
    assert np.isfinite(raw).all()
    packed = np.floor(raw * scale + .5) if name == 'lluvia' else np.round((raw - offset) * scale)
    assert ((packed >= 0) & (packed <= (65535 if name == 'lluvia' else 254))).all()
    width = 2 if name == 'lluvia' else 1
    old = np.frombuffer(b, dtype='<u2' if width == 2 else 'u1', count=n, offset=position)
    differences[name] = int(np.count_nonzero(old[-24:] != packed[:24]))
    values[name] = float(packed[i] / scale + offset)
    position += n * width
assert position == len(b)
# Evita unir silenciosamente un cierre a una extracción incompatible.
assert sum(differences.values()) == 0, differences
result = dict(indice=n, fecha=h['time'][i], zona='America/Panama', valores=values,
              fuente='ERA5 Copernicus C3S via Open-Meteo; CC BY 4.0',
              consultado=evidence['consultado'], url=evidence['url'],
              evidencia_sha256=hashlib.sha256(source.read_bytes()).hexdigest())
(ROOT / 'fuente/src/epw-cierre.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
(HERE / 'cierre-verificacion.json').write_text(json.dumps(dict(
    autor='OpenAI Codex', solapamiento_horas=24, diferencias_c107=differences,
    indice=n, valores=values, evidencia_sha256=result['evidencia_sha256']), indent=2) + '\n')
print(json.dumps(dict(solapamiento_diferencias=differences, cierre=values), indent=2))
