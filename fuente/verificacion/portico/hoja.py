# Hoja comparativa del pórtico: foto WA0014 / antes / después desde el punto de la foto; los dos acercamientos de Street View
# del usuario junto al después desde un punto parecido; frente cercano y laterales antes / después.
#   cd fuente && node verificacion/portico/capturar.mjs despues && RAIZ=<árbol de main> node verificacion/portico/capturar.mjs antes
#   cd verificacion && python3 portico/hoja.py
from PIL import Image, ImageDraw
FOTO = '/Users/luismiguelcaamano/Documents/Web/isthmus-digitaldouble/evidence/recent_folder/IMG-20260920-WA0014.jpg'
import os
# acercamientos de Street View que mandó el usuario (no están en el repositorio): SV=<carpeta con portico_sv1.png y portico_sv2.png>
SV = os.path.join(os.environ.get('SV', '/private/tmp/claude-501/-Users-luismiguelcaamano/31e89287-5f83-47c9-bc70-0ece2c1eb2bf/scratchpad'), 'portico_sv%d.png')
A, D = 'portico/antes/', 'portico/despues/'
def panel(ruta, caja, alto, rotulo):
    im = Image.open(ruta).convert('RGB'); im = im.crop(caja or (0, 0, im.width, im.height)); im = im.resize((round(im.width * alto / im.height), alto), Image.LANCZOS)
    out = Image.new('RGB', (im.width, alto + 24), 'white'); out.paste(im, (0, 24)); ImageDraw.Draw(out).text((6, 6), rotulo, fill='black'); return out
def fila(ps):
    w = sum(p.width for p in ps) + 8 * (len(ps) - 1); h = max(p.height for p in ps); out = Image.new('RGB', (w, h), 'white'); x = 0
    for p in ps: out.paste(p, (x, 0)); x += p.width + 8
    return out
filas = [
  fila([panel(FOTO, (395, 470, 875, 810), 400, 'foto WA0014'),
        panel(A + 'foto.png', (395, 465, 875, 805), 400, 'antes (4,80 m entre ejes, capitel 3,56 m)'),
        panel(D + 'foto.png', (395, 465, 875, 805), 400, 'despues (2,20 m entre ejes, capitel 2,40 m)')]),
  fila([panel(SV % 1, None, 330, 'Street View, acercamiento 1'), panel(D + 'sv1.png', (0, 250, 1600, 1000), 330, 'despues, punto parecido')]),
  fila([panel(SV % 2, None, 330, 'Street View, acercamiento 2'), panel(D + 'sv2.png', (150, 250, 1600, 1000), 330, 'despues, punto parecido')]),
  fila([panel(A + 'frente-cerca.png', None, 280, 'frente cercano, antes'), panel(D + 'frente-cerca.png', None, 280, 'frente cercano, despues')]),
  fila([panel(A + 'lateral-oeste.png', None, 280, 'lateral oeste, antes'), panel(D + 'lateral-oeste.png', None, 280, 'lateral oeste, despues')]),
  fila([panel(A + 'lateral-este.png', None, 280, 'lateral este, antes'), panel(D + 'lateral-este.png', None, 280, 'lateral este, despues')]),
]
W = max(f.width for f in filas); H = sum(f.height for f in filas) + 8 * (len(filas) - 1)
hoja = Image.new('RGB', (W, H), 'white'); y = 0
for f in filas: hoja.paste(f, ((W - f.width) // 2, y)); y += f.height + 8
hoja.save('portico/comparativa-portico.png', optimize=True); print(hoja.size)
