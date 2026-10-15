"""Arma datos/di/fichas.json, etapas.json y alternativas.json. Las cifras de fachada salen de cifras.py (copiadas aquí y
comprobadas al final contra su salida). Uso: python3 armar.py <raíz del repo> """
import json, os, subprocess, sys
R = sys.argv[1]; OUT = os.path.join(R, 'datos', 'di')
C = json.loads(subprocess.run([sys.executable, '-I', os.path.join(OUT, 'cifras.py'), R], capture_output=True, text=True, check=True).stdout.split('\nOK:')[0])

def dec(v):
    s = f'{v:,.0f}' if float(v).is_integer() else f'{v:,.1f}'
    return s.replace(',', 'X').replace('.', ',').replace('X', '.')

SOL = C['sol_directo_pared']; LV = C['lluvia_viento_L_m2']; FR = C['horas_viento_frente']; T = C['techo_kWh_m2']
CARA = {'se': 'SE', 'no': 'NO', 'ne': 'NE', 'so': 'SO'}
def fila(d, k, suf=''):
    return ' · '.join(f'{CARA[c]} {dec(d[c][k] if k else d[c])}{suf}' for c in sorted(d, key=lambda c: -(d[c][k] if k else d[c])))
F_SOL = ['Sol directo en pared sin alero, kWh/m² al año', fila(SOL, 'directa_kWh_m2')]
F_LLU = ['Lluvia con viento (ISO 15927-3), L/m² al año', fila(LV, 'anual')]
F_VIE = ['Viento de frente, horas al año', fila(FR['anio'], None)]
F_VIE_SECA = ['Viento de frente en la seca (diciembre a marzo), horas', fila(FR['seca'], None)]
F_ALTO = ['Sol directo con perfil sobre 45,5° (el alero del piso 2 tapa todo el vidrio)', fila(SOL, 'pct_perfil_sobre_45', ' %')]
F_MEDIO = ['Con perfil entre 9,1° y 45,5° (tapa una parte)', fila(SOL, 'pct_perfil_entre', ' %')]
F_BAJO = ['Con perfil bajo 9,1° (no tapa el vidrio)', fila(SOL, 'pct_perfil_bajo_9', ' %')]
SRC_CLIMA = 'ERA5 2001 a 2025, celda de ~28 km (datos/clima_horario.bin.gz), recalculado con datos/di/cifras.py; coincide con datos/consultas.json (radiacion.fachadas, lluviaViento, viento.*.frente)'
SRC_CORTE = 'bandas del perfil con el CORTE de fuente/src/main.js (piso 2: alero 7,40 m, vidrio de 5,62 a 7,12 m, 0,10 m hacia adentro, vuelo 1,65 m), datos/di/cifras.py'
LIM_LLU = 'El índice de lluvia ordena caras en campo abierto; no mide el agua que llega al muro.'
LIM_SOL = 'El sol es el de una pared sin alero: bajo el alero llega menos.'
r_llu = dec(round(C['razon_lluvia_NO_NE'], 1)); r_sol = dec(round(C['razon_sol_SE_NO'], 1)); r_vie = dec(round(C['razon_viento_NO_siguiente'], 1))

def fachada(caras, texto, datos, fuente=SRC_CLIMA):
    return {'titulo': 'Lo que le pide su fachada', 'caras': caras, 'texto': texto, 'datos': datos, 'fuente': fuente}
CUATRO = ['se', 'no', 'ne', 'so']
INV = 'docs/INVENTARIO.md de D.I.Visor'
FOTO = 'fotos del 106 (archivo del proyecto, no publicado)'
EQUIPO = 'lo informa el equipo del proyecto, sin foto (13 de octubre de 2026)'
EQUIPO_14 = 'lo informa el equipo del proyecto, sin foto (14 de octubre de 2026)'

def ficha(titulo, sistema, texto, decision, del_106, tipico, datos, principio, certeza, certezas, foto, fuente, fach=None):
    f = {'titulo': titulo, 'sistema': sistema, 'texto': texto, 'decision': decision,
         'proceso': {'del_106': del_106, 'tipico': tipico}, 'datos': datos, 'principio': principio}
    if fach: f['fachada'] = fach
    f.update({'certeza': certeza, 'certezas': certezas, 'foto_que_falta': foto, 'fuente': fuente})
    return f

fichas = {}
# ---------------- base ----------------
fichas['zocalo'] = ficha('Zócalo', 'base',
    'El cuerpo del 106 arranca sobre una base más alta que el terreno, confirmada en fotos. En el modelo es un bloque macizo de 45,50 × 23,00 m y 0,65 m de alto en todo el perímetro, con marcas de salpicadura en el extremo SO puestas según las fotos.',
    'Un escalón corrido entre el suelo y el muro: lo que salpica el agua al caer del alero pega primero en la base.',
    'No se sabe de qué está hecho ni cómo se construyó. El modelo solo da su caja.',
    'Una base de este tipo suele ser de concreto o de mampostería con repello, construida sobre la cimentación antes que los muros.',
    [['Planta', '45,50 × 23,00 m'], ['Alto', '0,65 m'], ['Escala del modelo', '±12 %']],
    'Una base alta suele separar el cuerpo de un edificio del suelo húmedo y de la salpicadura.',
    'medido', [['Base más alta que el terreno', 'foto'], ['Medidas', 'medido en el modelo'], ['Material y altura real', 'no se sabe']],
    'Un tramo del zócalo de la NO con una cinta métrica apoyada en el suelo.',
    f'{INV} §1, §4.7; {FOTO}; PARTES › zócalo en fuente/src/main.js',
    fachada(CUATRO, f'La base de la NO es la que más lluvia con viento recibe, unas {r_llu} veces la de la NE. ¿Se ve la base de la NO más manchada que la de la NE? Es una pregunta para mirar en sitio. {LIM_LLU}', [F_LLU]))
fichas['bloque_calado'] = ficha('Bloque calado', 'base',
    'Al pie de las caras SE y NO, la base tiene franjas de bloques calados, confirmadas en fotos. En el modelo son 77, uno cada 0,36 m: 50 en la SE y 27 en la NO. Cada uno es un hueco de 0,32 × 0,28 m con cuatro cuadros claros delante.',
    'Una pieza modular con huecos que, repetida, hace una pared que deja pasar el aire sin piezas móviles.',
    'No se sabe de qué material son ni el dibujo real del calado.',
    'El bloque calado de concreto suele hacerse en molde, prensado y vibrado; el de barro, moldeado y cocido.',
    [['Bloques', '77 (50 SE, 27 NO)'], ['Paso', '0,36 m'], ['Hueco', '0,32 × 0,28 m']],
    'Una pieza modular con huecos convierte un muro en filtro de aire sin piezas móviles.',
    'medido', [['Bloques en la base', 'foto'], ['Cantidad y medidas', 'medido en el modelo'], ['Si ventila un espacio bajo el piso', 'no se sabe']],
    'Un bloque de frente con flash, para ver si tiene malla y si detrás hay un vacío.',
    f'{INV} §4.8; {FOTO}',
    fachada(['se', 'no'], f'Las dos caras con bloques son opuestas. La NO recibe el viento de frente unas {dec(FR["anio"]["no"])} horas al año y la SE, {dec(FR["anio"]["se"])}. Qué pasa con el aire detrás del bloque no se sabe: el visor no modela el interior ni hace CFD.', [F_VIE]))
# ---------------- estructura ----------------
fichas['losa'] = ficha('Losa de entrepiso', 'estructura',
    'El modelo tiene tres plantas de 3,65 m, con la cara de arriba de las losas a 0,65, 4,30 y 7,95 m. Los aleros siguen ese paso. Las ventanas y las molduras suben 3,80 m del piso 1 al 2, porque el antepecho del piso 1 es de 1,17 m y el de los pisos 2 y 3 de 1,32.',
    'Un plano horizontal repetido con el mismo paso: fija la altura de todo lo que se repite por piso.',
    'No se sabe de qué son las losas ni su grueso real. El interior del modelo es un volumen de fondo.',
    'En una obra de este tipo, la losa suele ser de concreto armado vaciado en sitio sobre encofrado.',
    [['Plantas', '3, de 3,65 m'], ['Losas', '0,65 · 4,30 · 7,95 m'], ['Antepecho', '1,17 m (piso 1) y 1,32 m (pisos 2 y 3)']],
    'Un paso repetido ordena la fachada: lo que depende de él se dibuja una vez y se copia.',
    'medido', [['Tres plantas', 'foto'], ['Cotas', 'medido en el modelo'], ['Material y grueso', 'no se sabe']],
    'Ninguna desde afuera; una cinta desde el piso de la galería SO hasta el alféizar de la ventana más cercana.',
    f'{INV} §1, §4.11, §4.12; docs/ciudad/espiga/kit-medidas.json')
fichas['mensula'] = ficha('Ménsula', 'estructura',
    'Bajo cada alero hay ménsulas blancas en escuadra, confirmadas en fotos; en las esquinas van dos, formando una V. El modelo tiene 78, 26 por alero, de 0,26 m de ancho, 0,82 de alto y 1,50 de vuelo. En la SE, las seis del centro van cada 6,70 m sobre el muro angosto entre las dos ventanas de un par; las de las puntas, a 0,30 m de la esquina.',
    'El triángulo es la forma mínima indeformable para sostener un voladizo desde un plano vertical: si la ménsula cargara, llevaría la carga del borde hacia el muro por la diagonal.',
    'No se sabe de qué es, cómo se une al muro y al alero, ni si carga o es decorativa.',
    'Una ménsula de este tamaño suele ser de concreto vaciado en molde o de madera ensamblada, anclada al muro.',
    [['Cantidad', '78 (26 por alero)'], ['Ancho × alto', '0,26 × 0,82 m'], ['Vuelo', '1,50 m'], ['Paso en la SE', '6,70 m (las seis centrales)']],
    'Si una pieza solo tuviera que parecer un apoyo, su forma podría cambiar: esa es la pregunta de clase.',
    'medido', [['Ménsulas en escuadra', 'foto'], ['Cantidad y medidas', 'medido en el modelo'], ['Material, unión y si carga', 'no se sabe']],
    'Desde abajo, bajo el alero bajo de la SE: la unión de la ménsula con el muro y con el alero.',
    f'{INV} §4.15; {FOTO}; PARTES › ménsula en fuente/src/main.js',
    fachada(CUATRO, f'La ménsula vive bajo el alero, pero su punta queda cerca del borde. La lluvia con viento cambia mucho de una cara a otra: la NO recibe unas {r_llu} veces lo de la NE. Una pieza igual en las cuatro caras tiene que aguantar la peor. {LIM_LLU}', [F_LLU]))
# ---------------- muros ----------------
fichas['muro'] = ficha('Muro con repello', 'muros',
    'Los muros del 106 son blancos en todas las fotos. En el modelo miden 0,30 m de grueso y suben de 0,65 a 11,60 m. De qué están hechos (bloque, concreto o ladrillo) no lo dice ninguna fuente del 106.',
    'Un plano continuo y liso que recibe todo lo demás: ventanas, molduras, ménsulas, tubos.',
    'No se sabe el material ni el acabado real. El nombre del material del modelo es solo apariencia.',
    'Un muro de este tipo suele ser de bloque de concreto, de concreto o de ladrillo, con repello de mortero; eso es del tipo y no dice nada del 106.',
    [['Grueso', '0,30 m'], ['Alto', '0,65 a 11,60 m'], ['Color', 'blanco neutro, medido en fotos']],
    'Una superficie que se repinta es la capa que más rápido cambia de un muro; conviene que sea la de afuera.',
    'medido', [['Muros blancos', 'foto'], ['Grueso y alto', 'medido en el modelo'], ['Material', 'no se sabe']],
    'Un borde roto o una perforación donde se vea qué hay bajo el repello.',
    f'{INV} §1, §4.4; {FOTO}; docs/HISTORIA.md (commit 225645c)',
    fachada(CUATRO, f'El mismo muro tiene cuatro exigencias distintas. La SE recibe {r_sol} veces el sol directo de la NO, y la NO recibe la mayor lluvia con viento. {LIM_SOL} {LIM_LLU}', [F_SOL, F_LLU]))
fichas['moldura'] = ficha('Moldura bajo las ventanas', 'muros',
    'Una línea fina recorre el muro bajo los alféizares de cada piso. En el modelo son 11 molduras de 5 × 6 cm, a 1,66, 5,46 y 9,11 m.',
    'Un listón saliente que marca cada piso con una línea de sombra.',
    'No se sabe de qué es ni si tapa una junta.',
    'Una moldura de este tipo suele correrse en mortero con una plantilla o colocarse como pieza prefabricada.',
    [['Molduras', '11'], ['Sección', '5 × 6 cm'], ['Alturas', '1,66 · 5,46 · 9,11 m']],
    'Un borde saliente da al acabado un lugar donde terminar sin que se note el corte.',
    'medido', [['Línea bajo las ventanas', 'foto'], ['Sección y cotas', 'medido en el modelo'], ['Perfil y material', 'no se sabe']],
    'La moldura de planta baja, de perfil, con una regla al lado.',
    f'{INV} §4.5; {FOTO}')
fichas['faja_mediagua'] = ficha('Faja sobre la mediagua', 'muros',
    'Sobre el arranque de cada mediagua se ve una banda parda oscura en todas las fotos. En el modelo son 8 fajas de 0,27 m de alto y 0,03 de grueso, a 4,27 y 7,91 m. El alero del techo principal no la tiene.',
    'Una banda que cubre la línea donde la teja de la mediagua se encuentra con el muro.',
    'No se sabe si es madera o pintura.',
    'En una unión de techo con muro es habitual una pieza o un remate que tape el encuentro.',
    [['Fajas', '8 (4 por mediagua)'], ['Alto', '0,27 m'], ['Cotas', '4,27 y 7,91 m']],
    'Donde dos sistemas se encuentran, una pieza propia cubre el encuentro.',
    'medido', [['Banda parda', 'foto'], ['Medidas', 'medido en el modelo'], ['Material', 'no se sabe']],
    'La faja de la mediagua baja, de cerca, desde la galería.',
    f'{INV} §4.3; {FOTO}')
# ---------------- ventanas ----------------
fichas['marco_ventana'] = ficha('Marco de la ventana', 'ventanas',
    'Las fotos muestran ventanas de aluminio claro, en pares en las fachadas largas, divididas en paños. En el modelo hay 113; 111 tienen tres travesaños y las 2 altas de la NE, en el piso 1, no tienen el del medio. La típica de la SE mide 2,28 × 1,63 m, con un parteluz y un travesaño que hacen 4 paños de 1,08 × 0,74 m y perfiles de 4 × 9 cm. El vidrio va 9 a 10 cm hacia adentro del muro. Según el equipo del proyecto, el paño de arriba queda fijo y solo sube la hoja de abajo; en las ventanas de dos columnas, cada columna tendría su hoja, como supuesto del tipo. Las 2 ventanas altas de la NE, de 0,57 m, no tienen hoja en el modelo y no se sabe si abren. Las de los pisos 2 y 3 son inferidas.',
    'Una retícula de perfiles iguales, cortados a la medida de cada vano.',
    'Aluminio, confirmado en foto. La unión de las esquinas (a inglete o a tope) no se sabe.',
    'El aluminio de carpintería se fabrica por extrusión: un perfil de sección constante que se corta a medida y se une en las esquinas.',
    [['Ventanas', '113'], ['Alto del vano', '79 de 1,58 m (pisos 2 y 3), 25 de 1,63 m (piso 1), 7 de 1,40 m (planta baja SO), 2 de 0,57 m (altas de la NE)'], ['Típica SE, piso 1', '2,28 × 1,63 m, paños de 1,08 × 0,74 m'], ['Perfil', '4 × 9 cm']],
    'Con perfiles extruidos de sección constante, la variedad de tamaños sale del corte y no del molde.',
    'modelo', [['Aluminio y paños', 'foto'], ['Medidas del piso 1', 'medido en el modelo'], ['Pisos 2 y 3', 'inferidas en el modelo'], ['Paño de arriba fijo', 'lo informa el equipo del proyecto, sin foto'], ['Si abren las 2 ventanas altas de la NE', 'no se sabe'], ['Unión de las esquinas', 'no se sabe']],
    'Una esquina del marco de planta baja, de cerca.',
    f'{INV} §4.12; {FOTO}; README.md (pisos 2 y 3 inferidos); recuento por alto de vano del verificador del plan (13 de octubre de 2026)',
    fachada(CUATRO, f'El vidrio está bajo un alero de 1,65 m. De todo el sol directo que recibiría la pared, en la NO, la SE y la NE más de la mitad llega con el sol alto en el perfil, cuando el alero del piso 2 deja el vidrio entero a la sombra; en la SO, el 47 %. El sol bajo, que entra hasta el vidrio, es poco en las cuatro caras. {LIM_SOL}', [F_SOL, F_ALTO, F_BAJO], f'{SRC_CLIMA}; {SRC_CORTE}'))
fichas['hoja_guillotina'] = ficha('Hoja de guillotina', 'ventanas',
    'Según el equipo del proyecto, las ventanas del 106 se abren hacia arriba, deslizándose: son de guillotina. Sube una sola hoja, la de abajo, y la de arriba queda fija: la ventana abre por abajo. En el modelo la hoja es el paño de abajo con su travesaño, y sube hasta el travesaño de arriba. En las ventanas de dos columnas, cada columna tendría su hoja y el travesaño del medio se partiría en el parteluz: el parteluz va de arriba abajo sin cortarse, y así se ve en una foto. Es el supuesto del tipo, dos guillotinas unidas por el parteluz. Qué sostiene abierta cada hoja no se sabe. Las 2 ventanas altas de la NE, de 0,57 m, no tienen hoja en el modelo y no se sabe si abren.',
    'La hoja que se desliza en su plano no ocupa espacio hacia adentro ni hacia afuera del vano.',
    'Hoja de aluminio en un marco de aluminio, por la foto. Riel, equilibrio, seguro y sellos: no se sabe.',
    'Una hoja de guillotina se sostiene donde la dejas por una de tres vías: fricción del riel o de un burlete, un resorte dentro de la jamba, o un contrapeso con cuerda y polea.',
    [['Cómo abre', 'sube la hoja de abajo; la de arriba es fija (equipo)'], ['Recorrido en planta baja', '0,77 m en los 25 vanos de 1,63 m (SE, NO y NE) y 0,66 m en los 7 de 1,40 m (SO), del modelo, escala ±12 %'], ['Recorrido en pisos 2 y 3', '0,75 m en los 79 vanos de 1,58 m, ventanas inferidas, escala ±12 %'], ['Hojas en el modelo', '199: dos en cada una de las 88 ventanas de dos columnas y una en las 23 de una columna'], ['Sin travesaño del medio', '2 ventanas altas de la NE, piso 1']],
    'Equilibrar el peso de la hoja es lo que hace que una ventana de guillotina se quede abierta.',
    'modelo', [['Aluminio', 'foto'], ['Que sube deslizándose', 'lo informa el equipo del proyecto, sin foto'], ['Sube solo la hoja de abajo; la de arriba es fija', 'lo informa el equipo del proyecto, sin foto'], ['Una hoja por columna en las ventanas de dos columnas', 'supuesto del tipo; el parteluz continuo se ve en una foto'], ['Medidas de la hoja', 'modelo; pisos 2 y 3 inferidos'], ['Herraje, equilibrio y sellos', 'no se sabe']],
    'Una ventana de planta baja de la SE con la hoja subida: el canto de la hoja, la jamba, el riel y el cierre.',
    f'{EQUIPO}; {INV} §4.12; {FOTO}; recorridos por alto de vano medidos en la geometría de los GLB de main (datos/familias.json, hoja_guillotina, y verificador del plan, 13 de octubre de 2026)',
    fachada(CUATRO, f'Abrir es dejar entrar el viento. La NO lo recibe de frente unas {r_vie} veces las horas de la cara que le sigue, y en la seca {C["pct_seca_NO_de_frente"]} de cada 100 horas; la SE y la SO casi nunca en la seca. Es el viento de afuera a 10 m de altura, en una celda de ~28 km: no dice cuánto aire entra por la ventana.', [F_VIE, F_VIE_SECA]))
fichas['alfeizar'] = ficha('Alféizar', 'ventanas',
    'Bajo cada una de las 113 ventanas del modelo hay un alféizar claro de 5 cm de alto y 34 de fondo, de 2 a 4 cm más ancho que su ventana. Sale 0,19 m del muro, y el vidrio va 9 a 10 cm hacia adentro.',
    'Sobresale del muro para que el agua que escurre por el vidrio caiga delante del plano del muro.',
    'No se sabe su material ni su perfil real.',
    'En piezas de este tipo es habitual una leve pendiente hacia afuera y un goterón por debajo, una ranura que corta la gota.',
    [['Cantidad', '113'], ['Alto × fondo', '5 × 34 cm'], ['Sobrancho', '2 a 4 cm'], ['Vuelo sobre el muro', '0,19 m']],
    'Una pieza que sobresale y corta la gota decide dónde cae el agua y protege la superficie de abajo.',
    'modelo', [['Alféizar', 'modelo'], ['Pendiente y goterón', 'principio general'], ['Material', 'no se sabe']],
    'Un alféizar de planta baja, de perfil y desde abajo.',
    f'{INV} §4.6, §4.12',
    fachada(CUATRO, f'El alféizar es la pieza que recibe la lluvia que baja por la ventana. La de la NO recibe la mayor lluvia con viento, unas {r_llu} veces la de la NE: es la cara donde un goterón tiene más trabajo. {LIM_LLU}', [F_LLU]))
fichas['lama_celosia'] = ficha('Celosía de lamas', 'ventanas',
    'En algunas ventanas hay paños de lamas horizontales, visibles en fotos. En el modelo son 38 paneles con 301 lamas de 9 a 10 cm de alto y 7 de fondo, una cada 9,3 cm, que tapan la mitad de arriba o la de abajo de la ventana. Por fachada: SE 7, NO 9, NE 12 y SO 7, más 3 en la planta baja SO.',
    'Lamas angostas y repetidas que filtran la luz y dejan pasar el aire.',
    'No se sabe si son de vidrio o de aluminio, si van por fuera o por dentro del vidrio, ni si giran.',
    'En una celosía de lamas operables cada lama pivota sobre su eje largo y una varilla las une por un brazo, formando un paralelogramo que las gira a la vez.',
    [['Paneles', '38'], ['Lamas', '301'], ['Lama', '9 a 10 × 7 cm'], ['Paso', '9,3 cm']],
    'Un paralelogramo articulado convierte un solo movimiento lineal en el giro igual de muchas piezas.',
    'general', [['Paños con lamas', 'foto'], ['Cantidad y medidas', 'medido en el modelo'], ['Que giren', 'principio general, no confirmado']],
    'Un paño de lamas de la entrada: el extremo de una lama y, por dentro, si hay manivela.',
    f'{INV} §4.13 y §5; {FOTO}',
    fachada(CUATRO, 'Unas lamas horizontales cortan el sol según el mismo ángulo de perfil que el alero: son un alero en pequeño. Lo que el alero del piso 2 no tapa entero es el sol con perfil entre 9,1° y 45,5°, y ahí la SO es la que más recibe: la mitad de su sol directo. Que las lamas giren no está confirmado. ' + LIM_SOL, [F_MEDIO, F_BAJO], f'{SRC_CLIMA}; {SRC_CORTE}'))
# ---------------- cubierta ----------------
MAXH = ('%.1f' % C['hora_max_mm']['mm']).replace('.', ',')
TECHO = [['Sol sobre el techo, kWh/m² al año', f'{dec(T["total"])} en total, {dec(T["directa"])} directo'],
         ['Lluvia media de ERA5', f'{dec(C["lluvia_anual_media_mm"])} mm al año'],
         ['Horas con lluvia desde el umbral del visor', f'{dec(C["horas_lluvia_umbral_por_anio"])} al año'],
         ['Horas con 10 mm o más (clase fuerte de la OMM)', f'{dec(C["horas_10mm_por_anio"])} al año; la mayor, {MAXH} mm (1 de julio de 2023, de 14 a 15 h)']]
fichas['teja'] = ficha('Teja canal y cobija', 'cubierta',
    'La cubierta del 106 es de teja curva roja tipo canal y cobija, confirmada en fotos. En el modelo, el canal mide 23 a 24 cm de ancho y la cobija 13 a 14, las dos de 39 cm de largo en planta, con un paso de 23,5 cm y filas que se solapan unos 6 cm en la mediagua SE, de 17,9°. Son unas 48.000 en el modelo.',
    'Dos piezas con una sola tarea cada una: el canal recoge el agua y la cobija tapa el encuentro de dos canales.',
    'No se sabe si es de barro o de concreto, ni su tamaño real ni cómo se fija.',
    'La teja de barro se moldea o prensa y se cuece; la de concreto se moldea y fragua. La fijación habitual va con clavo, gancho o mortero.',
    [['Canal', '23 a 24 × 39 cm'], ['Cobija', '13 a 14 × 39 cm'], ['Solape', '~6 cm'], ['Tejas en el modelo', '~48.000']],
    'Separar funciones entre dos piezas permite que cada una tenga la forma más simple para su tarea.',
    'medido', [['Canal y cobija, rojas', 'foto'], ['Medidas y número', 'medido en el modelo'], ['Barro o concreto, fijación', 'no se sabe']],
    'Una teja rota en el suelo (la fractura dice barro o concreto) y el borde del alero bajo de la SE, de canto.',
    f'{INV} §2, §4.1; {FOTO}; clase «fuerte» de 10 mm/h o más: OMM, WMO-No. 8, 2023, vol. I, p. 484',
    fachada(['techo'], f'El techo recibe mucho más sol que cualquier pared: {dec(T["directa"])} kWh/m² al año de sol directo, contra {dec(SOL["se"]["directa_kWh_m2"])} en la pared SE, la que más recibe. Las horas de 10 mm o más son pocas al año. Es la lluvia de una celda de ~28 km, no la de este techo.', TECHO))
fichas['cabio'] = ficha('Cabio del alero', 'cubierta',
    'Bajo los tres aleros asoman maderos oscuros, visibles en fotos. El modelo los dibuja como 624 viguetas de 7 × 11 cm y 1,65 m de largo, una cada 0,65 m: 70 en cada cara larga y 34 en cada cara corta por alero.',
    'Una pieza corta, más alta que ancha, repetida con un paso fijo.',
    'Maderos oscuros, por la foto. Su número, paso, sección y especie no están medidos.',
    'Un cabio de madera se asierra a sección y se corta a largo; en exterior es habitual protegerlo con un tratamiento o una pintura.',
    [['Cantidad', '624 (208 por alero)'], ['Sección', '7 × 11 cm'], ['Largo', '1,65 m'], ['Paso', '0,65 m']],
    'En una pieza a flexión, la altura de la sección rinde más que el ancho: su módulo resistente crece con el cuadrado del canto.',
    'medido', [['Maderos oscuros', 'foto'], ['Cantidad, sección y paso', 'medido en el modelo'], ['Especie y tratamiento', 'no se sabe']],
    'Desde abajo, la testa de un cabio del alero bajo de la SE.',
    f'{INV} §4.2; {FOTO}')
fichas['tablero_alero'] = ficha('Alero y su sofito', 'cubierta',
    'Los tres aleros corridos vuelan 1,65 m en las cuatro caras. Cada uno reúne cinco piezas en el modelo: la ménsula, los cabios, el plano inclinado bajo la teja, cuya cara de abajo es el sofito, el frente del alero y las tejas; en los dos de abajo se suma una faja contra el muro. El sofito está a 3,734, 7,386 y 11,035 m.',
    'Un voladizo fijo que sombrea con el sol alto y aleja el agua del muro.',
    'El sofito y el frente son oscuros en el modelo; su material real no está confirmado.',
    'En un alero de este tipo, el plano bajo la teja suele ser de tablas o de placas clavadas sobre los cabios.',
    [['Vuelo', '1,65 m'], ['Sofitos', '3,734 · 7,386 · 11,035 m'], ['Pendiente', '17,9° en las mediaguas, 17,8° en el techo principal'], ['Corte del piso 2', 'todo el vidrio al sol bajo 9,1°, todo a la sombra sobre 45,5°, con las cotas redondeadas del visor (alero a 7,40 m)']],
    'El mismo alero, repetido en cada piso, sombrea y aleja el agua de la fachada de abajo.',
    'medido', [['Tres aleros corridos', 'foto'], ['Vuelo y cotas', 'medido en el modelo'], ['Ángulos del corte', 'cálculo sobre el modelo'], ['Material del sofito', 'no se sabe']],
    'Ninguna; una cinta métrica desde el muro hasta el borde del alero bajo daría el vuelo real.',
    f'{INV} §2, §4.16; docs/ciudad/espiga/kit-medidas.json; CORTE de fuente/src/main.js',
    fachada(CUATRO, 'Un alero se dimensiona contra el sol de su cara. De todo el sol directo que recibiría la pared, la NO, la SE y la NE reciben más de la mitad por encima de 45,5° de perfil, cuando el alero del piso 2 tapa el vidrio entero. La SO es la que más sol recibe en la franja intermedia, donde solo tapa una parte. ' + LIM_SOL, [F_SOL, F_ALTO, F_MEDIO], f'{SRC_CLIMA}; {SRC_CORTE}'))
fichas['tabla_frente'] = ficha('Frente del alero', 'cubierta',
    'En el modelo, el borde de cada alero es una pieza oscura: son 4 por alero, 12 en total, de 0,14 m de alto y 0,10 de grueso.',
    'Una pieza que remata el borde y da una línea recta al canto de la teja.',
    'No se sabe su material real.',
    'En un alero de madera de este tipo, el frente suele ser una tabla clavada a la punta de los cabios.',
    [['Piezas', '12 (4 por alero)'], ['Alto × grueso', '0,14 × 0,10 m']],
    'El borde de una pieza es lo que más se ve y lo que primero se golpea: suele llevar una pieza propia.',
    'modelo', [['Borde oscuro', 'modelo'], ['Medidas', 'medido en el modelo'], ['Material', 'no se sabe']],
    'El canto del alero bajo de la SE, de lado.',
    f'{INV} §2, §4.3; {FOTO}',
    fachada(CUATRO, f'Es la pieza más expuesta del alero, en su borde. La lluvia con viento de la NO es unas {r_llu} veces la de la NE. {LIM_LLU}', [F_LLU]))
fichas['gablete'] = ficha('Gablete del ático', 'cubierta',
    'En lo alto de cada extremo corto hay un remate triangular oscuro con un montante y un travesaño oscuros, confirmado en una foto del testero NE; el del SO está extrapolado. Cada uno es un triángulo de unos 6,2 m de base y 1,0 m de alto, unos 3,1 m².',
    'Una abertura alta y protegida de la lluvia por el propio techo.',
    'No se sabe si el hueco tiene malla o lamas.',
    'Una abertura de ático suele cerrarse con malla contra animales e insectos, o con lamas fijas.',
    [['Gabletes', '2 (NE en foto, SO extrapolado)'], ['Triángulo', '6,20 × 0,99 m, unos 3,1 m²'], ['Altura', '14,61 a 15,60 m']],
    'Montante y travesaño dividen el hueco en partes más pequeñas.',
    'modelo', [['Gablete NE', 'foto'], ['Gablete SO', 'extrapolado en el modelo'], ['Malla o lamas', 'no se sabe']],
    'El gablete NE con zoom.',
    f'{INV} §4.18; {FOTO}',
    fachada(['ne', 'so'], f'Los gabletes miran al NE y al SO. En la seca, la NE recibe el viento de frente unas {dec(FR["seca"]["ne"])} horas y la SO unas {dec(FR["seca"]["so"])}. Por dónde entraría el aire al ático no se calcula: el visor no hace CFD y el viento es el de afuera, a 10 m.', [F_VIE_SECA]))
# ---------------- accesos ----------------
fichas['puerta_parda'] = ficha('Puerta parda', 'accesos',
    'Las fotos muestran puertas pardas en las fachadas SE y NO, y otra en la galería SO. En el modelo, las tres de servicio miden 2,54 m de alto, tienen tres listones verticales y de ancho 1,50, 1,70 y 1,80 m; la de la galería SO mide 1,26 × 2,07 m, con la manija 0,94 m sobre la galería. En la foto, la de la SE es de una hoja, con la manija del lado NE, y se ve más angosta que el 1,50 m del modelo: su ancho real no se sabe. Las dos de la NO serían de dos hojas, como sugiere el listón del centro del modelo. La de la galería SO es de una hoja en el modelo. Según el equipo del proyecto, las puertas pardas abren hacia afuera; cuántas hojas tiene cada una no lo ha confirmado.',
    'Una hoja plana con listones, que la rigidizarían contra el alabeo.',
    'No se sabe de qué son las hojas, qué bisagra ni qué cerradura llevan.',
    'Una puerta que abre hacia afuera deja los nudillos de la bisagra del lado de afuera, y abierta ocupa el paso de afuera y queda a la lluvia.',
    [['Puertas de servicio', '3: SE de 1,50 m en el modelo, más angosta y de una hoja en la foto; NO de 1,70 y 1,80 m, de dos hojas en el modelo'], ['Alto de hoja', '2,54 m'], ['Puerta de la galería SO', '1,26 × 2,07 m'], ['Abre', 'hacia afuera (equipo)']],
    'En una hoja plana, listones así suelen servir para rigidizarla contra el alabeo.',
    'modelo', [['Puertas pardas', 'foto'], ['Abren hacia afuera', 'lo informa el equipo del proyecto, sin foto; cuántas hojas tiene cada una no lo informa'], ['SE: una hoja, manija del lado NE', 'foto; el equipo no lo ha confirmado'], ['Ancho de la SE', 'no se sabe; la foto la muestra más angosta que el 1,50 m del modelo'], ['NO: dos hojas', 'modelo; una foto lejana lo apoya, no lo confirma; el equipo no lo ha confirmado'], ['SO: una hoja', 'modelo'], ['Medidas', 'modelo'], ['Material, bisagra y cerradura', 'no se sabe']],
    'La puerta de la galería SO abierta, vista desde afuera: bisagras, lado de giro, cerradura y umbral. Repetir en una parda de la NO y contar sus hojas.',
    f'{EQUIPO_14}; {INV} §4.21 b y c; {FOTO}',
    fachada(['se', 'no', 'so'], f'Una puerta que abre hacia afuera queda a la lluvia mientras está abierta. Las puertas pardas están en las caras con más lluvia con viento: la NO, la SO y la SE. {LIM_LLU}', [F_LLU]))
fichas['puerta_principal'] = ficha('Puerta principal de vidrio', 'accesos',
    'Tras el pórtico hay una entrada de vidrio, confirmada en foto. En el modelo son dos hojas de 0,94 × 2,00 m con dos tiradores verticales de 0,46 m. Según el equipo del proyecto, abre hacia adentro. Las dos hojas girarían en abanico, desde las jambas y con los tiradores al centro, que es lo habitual en una puerta doble de entrada: es un supuesto del tipo. En el modelo, el tirador de la hoja este queda junto a la jamba, pero es una copia del de la oeste sin reflejar, así que no dice hacia qué lado gira.',
    'Tiradores verticales largos: se toman a distintas alturas.',
    'No se sabe si las hojas giran sobre bisagras o sobre un pivote en el piso, ni qué cerradura llevan.',
    'Una puerta de vidrio de este tipo suele llevar bisagras o un pivote de piso con cierrapuertas.',
    [['Hojas', '2, de 0,94 × 2,00 m'], ['Tiradores', '0,46 m, verticales'], ['Abre', 'hacia adentro (equipo)'], ['Giro', 'las dos hojas, en abanico desde las jambas (supuesto del tipo)']],
    'Un tirador vertical se toma bien a alturas distintas.',
    'modelo', [['Entrada de vidrio', 'foto'], ['Abre hacia adentro', 'lo informa el equipo del proyecto, sin foto'], ['Dos hojas', 'modelo'], ['Que giren las dos, en abanico desde las jambas', 'supuesto del tipo; el tirador de la hoja este del modelo es una copia sin reflejar y no dice hacia qué lado gira'], ['Medidas', 'modelo'], ['Bisagra o pivote', 'no se sabe']],
    'Desde adentro, la parte de arriba y la de abajo de una hoja: bisagras o pivote.',
    f'{EQUIPO}; {INV} §4.21 a; {FOTO}')
fichas['escalera'] = ficha('Escaleras', 'accesos',
    'El modelo tiene cuatro escaleras y dos escalones pardos de servicio de 0,80 m de alto, frente a una puerta de la SE y otra de la NO. La de la entrada tiene 7 peldaños, contados en una foto, de 0,137 m; la trasera NO y la SO perpendicular, 8 peldaños de 0,16 × 0,30 m. La lista de revisión que la Alcaldía de Panamá publicó en 2020 pide huellas de 0,20 a 0,30 m y contrahuellas de 0,15 a 0,17 m.',
    'Peldaños iguales: el pie repite el mismo gesto en toda la escalera.',
    'No se sabe de qué están hechas. Salvo los 7 peldaños de la entrada, el número y las cotas son inferidos.',
    'Una escalera exterior de este tipo suele ser de concreto vaciado sobre encofrado escalonado.',
    [['Escaleras', '4 en el modelo, más 2 escalones de servicio'], ['Entrada', '7 peldaños de 0,137 m'], ['NO y SO perpendicular', '8 de 0,16 × 0,30 m']],
    'Peldaños iguales en un mismo tramo.',
    'modelo', [['Siete peldaños de la entrada', 'foto'], ['Demás cotas', 'inferidas en el modelo'], ['Si cumplen la lista', 'no se puede decir con escala de ±12 %']],
    'Una cinta en un peldaño de la escalera NO.',
    f'{INV} §4.22; {FOTO}; Alcaldía de Panamá, DOYC, lista de revisión de 2020 (Acuerdo 281 de 2016), ítem 16.02, https://doyc.mupa.gob.pa/wp-content/uploads/2020/06/ACC_281_.pdf')
fichas['rampa'] = ficha('Rampa', 'accesos',
    'A la derecha del pórtico, una rampa de dos tramos con giro sube adosada a la fachada; está confirmada en foto. En el modelo cada tramo mide 5,90 m y sube 0,48 m, con una pendiente de 8,1 %, y un descanso de 1,40 × 2,74 m une los dos; por la línea central, el recorrido es de unos 14,6 m.',
    'Cambia altura por largo, y dobla sobre sí misma para caber junto a la fachada.',
    'No se sabe de qué es ni cómo se construyó. Las cotas son inferidas.',
    'Una rampa de este tipo suele ser una losa de concreto vaciada sobre relleno o sobre muretes.',
    [['Pendiente', '8,1 %'], ['Tramo', '5,90 m, sube 0,48 m'], ['Descanso', '1,40 × 2,74 m'], ['Recorrido', 'unos 14,6 m']],
    'La rampa cambia altura por largo; el descanso y el pasamanos continuo hacen ese largo usable.',
    'modelo', [['Rampa de dos tramos', 'foto'], ['Cotas y pendiente', 'inferidas en el modelo'], ['Si cumple la lista de la Alcaldía', 'no se puede decir']],
    'Una cinta y un nivel sobre un tramo de la rampa.',
    f'{INV} §4.24; {FOTO}')
fichas['baranda_rampa'] = ficha('Baranda de la rampa', 'accesos',
    'La baranda de la rampa se ve metálica y clara en la foto. En el modelo tiene postes cada 0,98 m, un pasamanos de 5,4 cm de diámetro y dos travesaños de 3,6 cm. La lista de la Alcaldía de 2020 pide pasamanos de 0,04 a 0,05 m; con cotas del modelo y escala de ±12 %, no se puede decir si cumple.',
    'El pasamanos redondo, que la mano cierra.',
    'No se sabe de qué metal es ni cómo se anclan los postes.',
    'Una baranda de tubo suele soldarse o unirse con piezas y anclarse con placa y pernos o empotrada.',
    [['Postes', 'cada 0,98 m'], ['Pasamanos', 'Ø 5,4 cm'], ['Travesaños', 'Ø 3,6 cm']],
    'Un pasamanos que la mano puede cerrar se agarra mejor que uno plano.',
    'medido', [['Baranda metálica', 'foto'], ['Medidas', 'medido en el modelo'], ['Metal y anclaje', 'no se sabe'], ['Si cumple la lista de la Alcaldía', 'no se puede decir']],
    'La base de un poste de la rampa y la unión con el pasamanos.',
    f'{INV} §4.24; fuente/barandas.mjs; Alcaldía de Panamá, DOYC, lista de revisión de 2020, ítem 7.7 a')
fichas['galeria'] = ficha('Galería elevada', 'accesos',
    'En el extremo oeste, una galería elevada con barandas pardas rodea la esquina, confirmada en fotos. En el modelo el piso está a 1,24 a 1,28 m; el tramo NO mide 1,30 × 22,45 m sobre una base maciza y el tramo SO 1,70 × 20,0 m, con un frente de tres rejillas y un hueco abierto entre pilares cerca de la esquina.',
    'Una plataforma corrida que reúne accesos en un solo nivel.',
    'No se sabe de qué está hecha. La cota de 1,28 m es inferida.',
    'Una galería de este tipo suele ser una losa sobre muretes o pilares.',
    [['Piso', '1,24 a 1,28 m'], ['Tramo NO', '1,30 × 22,45 m'], ['Tramo SO', '1,70 × 20,0 m']],
    'Una plataforma corrida reúne varios accesos en un solo nivel.',
    'modelo', [['Galería con barandas', 'foto'], ['Cotas', 'inferidas en el modelo'], ['Material', 'no se sabe']],
    'Una cinta desde el piso de la galería al suelo, en la esquina oeste.',
    f'{INV} §3, §4.23; {FOTO}')
fichas['portico'] = ficha('Pórtico de entrada', 'accesos',
    'Delante de la puerta principal hay un pórtico angosto y bajo, con columnas blancas cuadradas y una banda oscura, confirmado en foto. En el modelo tiene tres columnas, dos al frente a 2,20 m entre ejes, con capitel a 2,40 m, una viga, dos zapatas y cinco cabios de 8 × 10 cm. Las medidas son proporciones calibradas sobre la foto: la calibración dio de 2,10 a 2,16 m entre ejes y se adoptó 2,20.',
    'Un techo pequeño sobre columnas que marca la entrada y la cubre.',
    'No se sabe de qué son las columnas ni la viga.',
    'Como principio del tipo, la carga de un techo así baja por la viga a las columnas y de ahí al suelo.',
    [['Columnas', '3; 2,20 m entre ejes al frente'], ['Capitel', 'hasta 2,40 m'], ['Cabios', '5, de 8 × 10 cm']],
    'Un techo sobre la puerta deja esperar bajo cubierta.',
    'modelo', [['Pórtico y columnas blancas', 'foto'], ['Medidas', 'calibradas sobre una foto'], ['Materiales', 'no se sabe']],
    'Las columnas del pórtico con una cinta, de base a capitel.',
    f'{INV} §4.25; fuente/portico.mjs; {FOTO}')
# ---------------- servicios ----------------
fichas['condensadora'] = ficha('Condensadora', 'servicios',
    'Al pie de los muros hay condensadoras de aire acondicionado tipo split, confirmadas en varias fotos. Es el único mecanismo confirmado en foto: un ventilador gira detrás de la rejilla redonda. El modelo tiene 15 cajas de 0,91 × 0,62 × 0,44 m, con la rejilla y una celosía en el frente; las fotos muestran más unidades, de varios tamaños.',
    'Una rejilla redonda delante de un ventilador axial.',
    'No se sabe la marca, el modelo ni cómo se apoya cada unidad.',
    'En una unidad de este tipo, el compresor eleva la presión del refrigerante y el serpentín de aletas lo enfría con el aire que mueve el ventilador; el líquido vuelve por tubería a la unidad interior.',
    [['Unidades en el modelo', '15 (4 SE, 7 NO, 4 NE)'], ['Caja', '0,91 × 0,62 × 0,44 m'], ['Hueco del ventilador', '0,50 × 0,50 m']],
    'Lo que se fija por fuera queda a la vista y se puede mantener sin abrir el muro.',
    'modelo', [['Condensadoras con ventilador', 'foto'], ['Número y posición', 'modelo; no coinciden con las fotos'], ['Ciclo de refrigeración', 'principio general']],
    'El pie y la placa de datos de una condensadora de la NO.',
    f'{INV} §4.27 y §5; {FOTO}')
fichas['tubo_abrazadera'] = ficha('Tubo y abrazadera', 'servicios',
    'Sobre las fachadas SE, NO y NE corren tubos verticales; en el centro de la NO una foto muestra tubos de servicio a la vista. En el modelo son 12 tubos de 10,68 m, cada uno con 4 abrazaderas a 0,80, 2,60, 5,50 y 9,20 m: 48 abrazaderas.',
    'El tubo va sujeto por cuatro abrazaderas separadas a lo largo de su altura.',
    'No se sabe si son bajantes, desagües o ductos de servicio, ni de qué son.',
    'Como regla general, un tubo se sujeta en puntos para que pueda dilatarse con el calor sin romper el muro ni pandearse.',
    [['Tubos', '12, de 10,68 m'], ['Abrazaderas', '48 (4 por tubo)']],
    'Una sujeción por puntos deja que la pieza se mueva sin cargar el muro.',
    'medido', [['Tubos a la vista en la NO', 'foto'], ['Número y cotas', 'medido en el modelo'], ['Función', 'no se sabe']],
    'Una abrazadera de la NO a la altura de la mano y el pie del tubo.',
    f'{INV} §4.19; {FOTO}')
fichas['gabinete_verde'] = ficha('Gabinete verde', 'servicios',
    'Delante de la fachada NO hay un gabinete verde grande con aletas en un costado, confirmado en fotos. En el modelo mide 1,54 × 1,70 × 1,10 m, con una tapa que vuela y 17 aletas verticales de 1,26 m, una cada 7,5 cm. Qué es y qué tiene dentro no está confirmado.',
    'Aletas que multiplican la superficie sin agrandar la caja, y una tapa que vuela sobre los bordes del cuerpo.',
    'No se sabe qué aparato es ni de qué está hecho.',
    'Un gabinete de exterior de este tipo suele ser de chapa de acero doblada y pintada.',
    [['Cuerpo', '1,54 × 1,70 × 1,10 m'], ['Aletas', '17, de 1,26 m, cada 7,5 cm']],
    'Con el mismo material y la misma diferencia de temperatura, una superficie más grande cede más calor.',
    'medido', [['Gabinete con aletas', 'foto'], ['Medidas', 'medido en el modelo'], ['Qué es', 'no se sabe']],
    'El frente del gabinete con sus bisagras y la placa, si la hay.',
    f'{INV} §4.28; {FOTO}')
fichas['letrero'] = ficha('Letrero 106', 'accesos',
    'Junto a la rampa hay un tótem curvo gris con la parte de arriba azul que dice «106», confirmado en fotos. En el modelo, casi plano, mide 1,64 m de ancho y llega a 2,79 m, con la franja azul en la cara que mira al SE. En el jardín NE hay otro tótem gris y azul, visto en una foto; en el modelo mide 1,02 m de ancho, llega a 3,20 m y su posición es inferida.',
    'La franja de color arriba, a la altura de la vista de quien llega.',
    'No se sabe de qué es ni cómo se ancla.',
    'Un tótem de este tipo suele tener una estructura interna y paneles fijados, anclada a una base.',
    [['Tótem de la entrada', '1,64 m de ancho, hasta 2,79 m'], ['Tótem del jardín NE', '1,02 m de ancho, hasta 3,20 m, posición inferida']],
    'Una señal de entrada se lee mejor cuando su cara mira hacia quien llega.',
    'medido', [['Tótem curvo gris y azul', 'foto'], ['Medidas', 'medido en el modelo, que lo hace casi plano'], ['Anclaje', 'no se sabe']],
    'La base y el canto del letrero.',
    f'{INV} §4.26 a; {FOTO}')

# ---------------- etapas ----------------
SELLO = 'Orden lógico del tipo de obra'
GEN = f'{INV} (piezas y cotas del modelo); orden por qué se apoya en qué y qué tapa a qué, el método de «Building a house» de Pascal Architecture (architecture.pascal.app), aplicado como principio general'
def etapa(i, id_, titulo, familias, texto, apoya, tapa, pregunta):
    return {'id': id_, 'n': i, 'titulo': titulo, 'familias': familias, 'texto': texto, 'se_apoya_en': apoya, 'tapa_a': tapa,
            'para_pensar': pregunta, 'sello': SELLO, 'certeza': 'general', 'fuente': GEN}
etapas = [
    etapa(1, 'base', 'La base', ['zocalo', 'bloque_calado'],
        'En una obra de este tipo, lo primero que se ve sobre el suelo es la base. En el modelo es un zócalo macizo de 0,65 m en todo el perímetro, con franjas de bloques calados en la SE y la NO. La cimentación no está en el modelo y no se sabe de qué tipo es.',
        'el suelo y la cimentación, que no se conocen', 'nada todavía; los muros la taparán por arriba',
        '¿Qué tendría que estar listo bajo el zócalo antes de seguir, si los bloques calados ventilan un espacio?'),
    etapa(2, 'cuerpo', 'Losas y muros, piso por piso', ['losa', 'muro'],
        'El cuerpo sube en tres plantas de 3,65 m. No se sabe si el 106 tiene un marco de concreto con muros de relleno o muros que cargan: en el primer tipo, columnas y losas van antes que los muros; en el segundo, cada muro sube y la losa se apoya en él. El modelo solo da las losas a 0,65, 4,30 y 7,95 m y un muro de 0,30 m hasta 11,60 m.',
        'la base', 'las instalaciones que vayan dentro del muro, si las hay',
        '¿Qué cambia en el orden de la obra si los muros cargan o si solo cierran?'),
    etapa(3, 'mensulas', 'Las ménsulas', ['mensula'],
        'Bajo cada alero van ménsulas en escuadra, 26 por alero en el modelo. En una obra, una pieza anclada al muro va antes que lo que se apoya o se arrima a ella. Si las ménsulas del 106 cargan el alero o son decorativas no se sabe, y eso cambia si tienen que estar antes del alero o pueden ir después.',
        'el muro', 'nada; quedan a la vista bajo el alero',
        '¿En qué etapa irían si fueran decorativas?'),
    etapa(4, 'aleros', 'Cabios y aleros', ['cabio', 'tabla_frente'],
        'Los tres aleros corridos vuelan 1,65 m. En el modelo, 624 cabios cada 0,65 m recibirán el plano inclinado bajo la teja, y una pieza oscura, el frente del alero, remata el borde.',
        'el muro y, si cargan, las ménsulas', 'la cabeza del muro',
        '¿Qué pieza del alero se cambiaría primero, y qué habría que quitar para llegar a ella?'),
    etapa(5, 'techo', 'El techo y el sofito', ['tablero_alero', 'gablete'],
        'Sobre el último piso va el techo a cuatro aguas, con un gablete en cada extremo corto. En el modelo la pendiente es de 17,8°, la cumbrera llega a unos 15,64 m, y cuatro limas bajan desde las esquinas de la base de cada gablete hasta las esquinas del alero. Bajo la teja, el modelo tiene un plano inclinado oscuro que en los aleros se ve desde abajo como sofito; de qué es no se sabe.',
        'los cabios y el remate de los muros', 'el interior, que queda bajo cubierta',
        '¿Por qué conviene cerrar el techo antes de trabajar en las ventanas?'),
    etapa(6, 'teja', 'La teja', ['teja', 'faja_mediagua'],
        'Sobre ese plano van las tejas, canal y cobija, de abajo hacia arriba para que cada fila se monte sobre la anterior. En el modelo son unas 48.000, con filas que se solapan unos 6 cm. Si son de barro o de concreto y cómo se fijan no se sabe. En las dos mediaguas, una faja oscura cubre el encuentro de la teja con el muro.',
        'el plano inclinado bajo la teja', 'ese plano y el encuentro de la teja de la mediagua con el muro',
        '¿Por qué la primera fila es la de abajo y no la de la cumbrera?'),
    etapa(7, 'ventanas', 'Ventanas y alféizares', ['marco_ventana', 'hoja_guillotina', 'alfeizar', 'moldura'],
        'Los vanos se cierran con ventanas de aluminio; según el equipo del proyecto, se abren hacia arriba, deslizándose. En el modelo son 113, cada una con su alféizar, y una moldura corre bajo los alféizares de cada piso. En obras de este tipo la carpintería suele llegar cuando el vano y el techo están listos.',
        'el vano del muro', 'el borde del vano',
        '¿Qué tiene que estar resuelto en el vano antes de colocar un marco?'),
    etapa(8, 'celosias', 'Celosías de lamas', ['lama_celosia'],
        'En algunas ventanas hay paneles de lamas que tapan media ventana: 38 en el modelo. No se sabe si van por fuera o por dentro del vidrio, y eso decide si llegan antes o después del marco.',
        'el marco o el vano', 'la mitad de la ventana',
        '¿Qué mitad de la ventana tapa cada panel en tu fachada, y qué mitad queda para abrir?'),
    etapa(9, 'accesos', 'Accesos', ['escalera', 'rampa', 'baranda_rampa', 'galeria', 'portico', 'puerta_parda', 'puerta_principal'],
        'Escaleras, rampa, galería y pórtico se arriman al cuerpo ya cerrado. En el modelo, la rampa sube 0,48 m en cada tramo de 5,90 m y el pórtico tiene tres columnas. Según el equipo del proyecto, la puerta principal abre hacia adentro y las pardas hacia afuera.',
        'el suelo y la base', 'el pie de la fachada en la entrada y en el extremo oeste',
        '¿Qué pasaría si la rampa se construyera antes que la fachada a la que se adosa?'),
    etapa(10, 'instalaciones', 'Instalaciones a la vista', ['condensadora', 'tubo_abrazadera', 'gabinete_verde', 'letrero'],
        'Por fuera del muro quedan condensadoras, tubos con abrazaderas, un gabinete verde y el letrero. En el modelo son 15 condensadoras y 12 tubos con 48 abrazaderas; las fotos muestran más unidades. Que estas piezas se fijen por fuera permite verlas y cambiarlas sin tocar el muro. Cuándo se pusieron en el 106 no se sabe.',
        'el muro y el suelo', 'nada; quedan a la vista',
        '¿Qué pieza de esta etapa se cambiará más veces en la vida del edificio?'),
]

# ---------------- alternativas ----------------
def op(nombre, cuando, cuesta, asi):
    return {'nombre': nombre, 'eligela_cuando': cuando, 'lo_que_cuesta': cuesta, 'asi_en_el_106': asi}
alternativas = [
    {'id': 'techo', 'pregunta': '¿Con qué se cubre el techo?', 'familias': ['teja', 'tablero_alero'],
     'decidido_por': 'La lluvia, el sol sobre el techo, la pendiente y el mantenimiento.',
     'datos_del_106': TECHO[:2],
     'opciones': [
        op('Teja canal y cobija', 'el techo tiene pendiente suficiente para que el agua baje entre piezas solapadas y quieres poder cambiar una pieza sola.', 'muchas piezas que colocar y revisar una por una, y un tablero o una estructura que aguante su peso.', 'Es la del 106, confirmada en fotos: teja curva roja. Barro o concreto no se sabe.'),
        op('Lámina metálica', 'buscas una cubierta liviana, rápida de montar y con pocas juntas.', 'una lámina delgada casi no guarda calor y lo deja pasar pronto hacia abajo, así que depende de lo que se ponga debajo; además suena con la lluvia.', 'No está en el 106.'),
        op('Losa plana con impermeabilizante', 'quieres usar el techo o necesitas una losa por estructura.', 'una superficie plana depende de que la impermeabilización no falle, y hay que revisarla.', 'No está en el 106.')],
     'certeza': 'general', 'fuente': f'{INV} §2, §4.1; {SRC_CLIMA}; propiedades de los materiales como principio general'},
    {'id': 'sol_ventana', 'pregunta': '¿Cómo se protege la ventana del sol?', 'familias': ['tablero_alero', 'lama_celosia', 'marco_ventana'],
     'decidido_por': 'El ángulo de perfil del sol en cada fachada y si la protección tiene que dejar pasar el aire.',
     'datos_del_106': [F_ALTO, F_MEDIO],
     'opciones': [
        op('Alero corrido', 'el sol de la fachada llega sobre todo alto en el perfil: un voladizo fijo lo corta sin piezas móviles y además aleja la lluvia.', 'no corta el sol bajo, y un vuelo más largo pesa más en la raíz del voladizo.', 'El 106 tiene tres aleros corridos de 1,65 m en las cuatro caras.'),
        op('Celosía de lamas', 'necesitas cortar el sol que el alero no alcanza y dejar pasar el aire.', 'muchas piezas pequeñas que limpiar, y si giran, un mecanismo que mantener.', 'Hay 38 paneles de lamas en el modelo, que tapan media ventana. Si giran no se sabe.'),
        op('Parasol vertical', 'el sol llega por un costado de la ventana, muy oblicuo a la fachada.', 'casi no corta el sol que llega de frente, y tapa la vista de lado.', 'No está en el 106.')],
     'certeza': 'general', 'fuente': f'{INV} §4.13, §4.16; {SRC_CORTE}'},
    {'id': 'ventana_abre', 'pregunta': '¿Cómo abre la ventana?', 'familias': ['hoja_guillotina', 'marco_ventana', 'lama_celosia'],
     'decidido_por': 'Lo que hay delante y detrás de la ventana, el viento y qué parte del vano quieres abrir.',
     'datos_del_106': [F_VIE],
     'opciones': [
        op('Guillotina', 'delante hay un alero, lamas o paso de gente, porque la hoja corre en su plano y no sale del vano.', 'abre como mucho la mitad del vano, y la hoja necesita algo que la sostenga abierta: fricción, resorte o contrapeso.', 'Según el equipo del proyecto, en las ventanas del 106 sube una sola hoja, la de abajo, y la de arriba queda fija: abre por abajo. En las ventanas de dos columnas, cada columna tendría su hoja, como supuesto del tipo. Qué la sostiene no se sabe.'),
        op('Abatible', 'quieres abrir el vano entero y cerrar apretando contra un burlete.', 'la hoja abierta ocupa espacio hacia adentro o hacia afuera, y el viento la puede golpear.', 'No es la que informa el equipo del proyecto para el 106.'),
        op('Corrediza horizontal', 'el vano es más ancho que alto.', 'abre como mucho la mitad y el riel de abajo junta agua y suciedad.', 'No es la que informa el equipo del proyecto para el 106.')],
     'certeza': 'general', 'fuente': f'{EQUIPO}; {INV} §4.12; {SRC_CLIMA}'},
    {'id': 'subir_entrada', 'pregunta': '¿Cómo se sube a la entrada?', 'familias': ['rampa', 'escalera', 'baranda_rampa'],
     'decidido_por': 'La altura que hay que subir, el espacio delante de la fachada y quién tiene que poder subir.',
     'datos_del_106': [['Altura que se sube en el modelo', '0,96 m (de 0,16 a 1,12 m)'], ['Rampa', '2 tramos de 5,90 m al 8,1 %'], ['Escalera de la entrada', '7 peldaños']],
     'opciones': [
        op('Escalera', 'el espacio es corto: sube la misma altura en mucho menos largo.', 'no la puede usar quien va en silla de ruedas o con un coche.', 'La entrada tiene una escalera de 7 peldaños, contados en una foto.'),
        op('Rampa', 'todos tienen que poder entrar por el mismo lugar.', 'mucho largo: para subir 0,96 m, el modelo necesita dos tramos de 5,90 m y un descanso, unos 14,6 m de recorrido.', 'Hay una rampa de dos tramos con giro, adosada a la fachada, confirmada en foto.'),
        op('Escalera y rampa juntas', 'quieres el camino corto para quien puede y el accesible para todos.', 'ocupa más fachada y lleva dos barandas.', 'Es lo que se ve en el 106: escalera bajo el pórtico y rampa a su derecha. Con escala de ±12 % no se puede decir si cumplen la lista de la Alcaldía.')],
     'certeza': 'modelo', 'fuente': f'{INV} §4.22, §4.24; Alcaldía de Panamá, DOYC, lista de revisión de 2020, ítems 7.1 a 7.7 y 16.02'},
    {'id': 'puerta_abre', 'pregunta': '¿Hacia dónde abre la puerta?', 'familias': ['puerta_parda', 'puerta_principal'],
     'decidido_por': 'Lo que hay afuera de la puerta, la lluvia que llega a esa cara y por dónde se sale en una emergencia.',
     'datos_del_106': [F_LLU],
     'opciones': [
        op('Hacia adentro', 'afuera hay poco espacio, una galería o una escalera que la hoja invadiría.', 'el umbral tiene que frenar el agua que empuja el viento desde afuera, y la hoja ocupa espacio adentro.', 'Según el equipo del proyecto, así abre la puerta principal de vidrio.'),
        op('Hacia afuera', 'la puerta da salida a mucha gente y tiene que abrir en el sentido en que se sale.', 'la hoja abierta invade el paso de afuera y queda a la lluvia.', 'Según el equipo del proyecto, así abren las puertas pardas.'),
        op('Corrediza', 'no hay espacio para el giro de la hoja en ningún lado.', 'el riel junta suciedad y cuesta más que cierre apretado.', 'No es la que informa el equipo del proyecto para ninguna puerta del 106.')],
     'certeza': 'general', 'fuente': f'{EQUIPO_14}; {INV} §4.21; {SRC_CLIMA}'},
]

# ---------------- familias de datos/familias.json (carril C) ----------------
# Cada ficha cubre una o varias familias. El JSON va por familia (como pide el contrato): cada familia de la lista
# lleva la ficha entera, con `ficha` = id de la ficha y `familias` = todas las que cubre. Lo genera este script, así
# que las copias no pueden divergir.
FAMILIAS_DE = {
    'zocalo': ['zocalo'], 'bloque_calado': ['bloque_calado'], 'losa': ['losa'], 'mensula': ['mensula'],
    'muro': ['muro'], 'moldura': ['moldura'], 'faja_mediagua': ['faja_mediagua'],
    'marco_ventana': ['jamba', 'travesano', 'parteluz', 'vidrio'], 'hoja_guillotina': ['hoja_guillotina'],
    'alfeizar': ['alfeizar'], 'lama_celosia': ['lama_celosia'], 'teja': ['teja'], 'cabio': ['cabio'],
    'tablero_alero': ['tablero_alero'], 'tabla_frente': ['tabla_frente'], 'gablete': ['gablete'],
    'puerta_parda': ['puerta_parda', 'tirador'], 'puerta_principal': ['puerta_principal', 'fondo_puerta'],
    'escalera': ['escalera_entrada', 'escalera_trasera', 'escalera_so', 'escalera_puerta_so', 'escalon_servicio'],
    'rampa': ['rampa'], 'baranda_rampa': ['baranda_entrada'], 'galeria': ['galeria', 'baranda_parda'],
    'portico': ['columna_portico', 'vigas_portico'], 'condensadora': ['condensadora', 'cubretubos'],
    'tubo_abrazadera': ['tubo_vertical', 'abrazadera'], 'gabinete_verde': ['gabinete'], 'letrero': ['letrero'],
}
assert set(FAMILIAS_DE) == set(fichas), set(FAMILIAS_DE) ^ set(fichas)
FJ = os.environ.get('FAMILIAS_JSON', os.path.join(R, 'datos', 'familias.json'))
if os.path.exists(FJ):
    FAM = json.load(open(FJ))['familias']
    falta = [f for v in FAMILIAS_DE.values() for f in v if f not in FAM]
    assert not falta, f'familias que no existen en {FJ}: {falta}'
    for k, v in FAMILIAS_DE.items():
        if FAM[v[0]]['sistema'] != fichas[k]['sistema']: print('aviso: sistema distinto', k, fichas[k]['sistema'], FAM[v[0]]['sistema'])
    sin = sorted(set(FAM) - {f for v in FAMILIAS_DE.values() for f in v})
    print('familias sin ficha:', ', '.join(sin))
else:
    print('aviso: no encontré', FJ, '(no se comprobaron los ids)')
fam = lambda ids: [f for i in ids for f in FAMILIAS_DE[i]]
for e in etapas: e['familias'] = fam(e['familias'])
for a in alternativas: a['familias'] = fam(a['familias'])
por_familia = {}
for k, f in fichas.items():
    for x in FAMILIAS_DE[k]: por_familia[x] = {'ficha': k, 'familias': FAMILIAS_DE[k], **f}
fichas_salida = por_familia

for nombre, obj in [('fichas.json', fichas_salida), ('etapas.json', etapas), ('alternativas.json', alternativas)]:
    json.dump(obj, open(os.path.join(OUT, nombre), 'w'), ensure_ascii=False, indent=1); open(os.path.join(OUT, nombre), 'a').write('\n')
print(len(fichas), 'fichas en', len(fichas_salida), 'familias ·', len(etapas), 'etapas ·', len(alternativas), 'alternativas')
for r in [F_SOL, F_LLU, F_VIE, F_VIE_SECA, F_ALTO, F_MEDIO, F_BAJO] + TECHO: print(r)
print('razones', r_llu, r_sol, r_vie)
