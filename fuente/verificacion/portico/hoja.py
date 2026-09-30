# Hoja comparativa del pórtico: foto WA0014 / antes / después desde el punto de la foto (recorte de la entrada) y, abajo,
# frente cercano y laterales antes / después.   cd fuente/verificacion && python3 portico/hoja.py
from PIL import Image, ImageDraw
FOTO = '/Users/luismiguelcaamano/Documents/Web/isthmus-digitaldouble/evidence/recent_folder/IMG-20260920-WA0014.jpg'
A, D = 'entrada/antes/', 'entrada/despues/'
def panel(ruta, caja, alto, rotulo):
    im = Image.open(ruta).convert('RGB').crop(caja); im = im.resize((round(im.width * alto / im.height), alto), Image.LANCZOS)
    out = Image.new('RGB', (im.width, alto + 24), 'white'); out.paste(im, (0, 24)); ImageDraw.Draw(out).text((6, 6), rotulo, fill='black'); return out
def fila(ps):
    w = sum(p.width for p in ps) + 8 * (len(ps) - 1); h = max(p.height for p in ps); out = Image.new('RGB', (w, h), 'white'); x = 0
    for p in ps: out.paste(p, (x, 0)); x += p.width + 8
    return out
# la foto y las capturas no tienen exactamente la misma escala: cada recorte encuadra la entrada (alero a losa) igual
f1 = fila([panel(FOTO, (395, 470, 875, 810), 440, 'foto WA0014'),
           panel(A + 'foto.png', (395, 465, 875, 805), 440, 'antes (4,80 m entre ejes)'),
           panel(D + 'foto.png', (395, 465, 875, 805), 440, 'despues (3,10 m entre ejes, +0,28 m)')])
f2 = fila([panel(A + 'frente-cerca.png', (0, 0, 1600, 1000), 300, 'frente cercano, antes'), panel(D + 'frente-cerca.png', (0, 0, 1600, 1000), 300, 'frente cercano, despues')])
f3 = fila([panel(A + 'lateral-oeste.png', (0, 0, 1600, 1000), 300, 'lateral oeste, antes'), panel(D + 'lateral-oeste.png', (0, 0, 1600, 1000), 300, 'lateral oeste, despues')])
f4 = fila([panel(A + 'lateral-este.png', (0, 0, 1600, 1000), 300, 'lateral este, antes'), panel(D + 'lateral-este.png', (0, 0, 1600, 1000), 300, 'lateral este, despues')])
filas = [f1, f2, f3, f4]; W = max(f.width for f in filas); H = sum(f.height for f in filas) + 8 * 3
hoja = Image.new('RGB', (W, H), 'white'); y = 0
for f in filas: hoja.paste(f, ((W - f.width) // 2, y)); y += f.height + 8
hoja.save('portico/comparativa-portico.png', optimize=True); print(hoja.size)
