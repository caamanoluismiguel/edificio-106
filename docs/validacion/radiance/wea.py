"""Escribe el .wea de Radiance (DNI y difusa, hora local estándar al centro de la hora) desde datos/clima_horario.bin.gz (C107)."""
import gzip, struct, sys, datetime as dt
b = gzip.open(sys.argv[1]).read(); assert b[:4] == b'C107'
n = struct.unpack('<I', b[4:8])[0]; o = 8 + n + 2 * n + n + n         # nubes, lluvia (u16), temp, humedad
dni, dif = b[o:o + n], b[o + n:o + 2 * n]
t0 = dt.datetime(2001, 1, 1)
with open(sys.argv[2], 'w') as f:
    f.write('place Edificio_106\nlatitude 8.9993\nlongitude 79.5827\ntime_zone 75\nsite_elevation 24\nweather_data_file_units 1\n')
    for i in range(n):
        c = t0 + dt.timedelta(hours=i) - dt.timedelta(minutes=30)       # la marca h:00 es el promedio de la hora anterior
        f.write('%d %d %.3f %d %d\n' % (c.month, c.day, c.hour + c.minute / 60, dni[i] * 4, dif[i] * 4))
print('horas', n, 'años', n / 8766)
