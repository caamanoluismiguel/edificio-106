#!/usr/bin/env python3
"""Codex, 8 oct 2026. Contrasta reglas de map3d y selecciona seis piezas exteriores.
Usa el GLB indicado y los datos OSM existentes. No descarga ni integra modelos.
"""
import collections
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import numpy as np
from comparar import OUT, ROOT, EXPECTED, extract


def main():
    data = Path(sys.argv[1]).read_bytes()
    assert hashlib.sha256(data).hexdigest() == EXPECTED
    buildings, _ = extract(data)
    report = json.loads((OUT / 'resultados.json').read_text())
    for path, expected in report['fuentes_sha256'].items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected
    tags = {}
    for filename in ['fuente/osm-amplio.json', 'fuente/osm.json']:
        for element in json.loads((ROOT / filename).read_text())['elements']:
            if element['type'] == 'way':
                tags[element['id']] = element.get('tags', {})
    def parse(value):
        m = re.match(r'^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)', str(value))
        return float(m[1]) if m else None
    rows = []
    for pair in report['pares']:
        t = tags[pair['osm_id']]
        h, levels = parse(t.get('height', '')), parse(t.get('building:levels', ''))
        source = 'levels' if levels is not None else 'height' if h is not None else 'default'
        expected = levels * 2.2 if levels is not None else h if h is not None else 10
        rows.append(dict(osm_id=pair['osm_id'], nodo=pair['glb_node'], regla=source,
                         altura_glb=pair['altura_glb_unidades'], altura_regla=expected,
                         error=abs(pair['altura_glb_unidades'] - expected)))
    transform = report['transformacion']
    scale, rotation, translation = transform['escala_horizontal'], np.array(transform['rotacion']), np.array(transform['traslacion'])
    matched = {p['glb_node'] for p in report['pares']}
    exterior = []
    for b in buildings:
        if b['node'] in matched:
            continue
        polygon = np.array(b['poly']) @ rotation * scale + translation
        center = np.array(b['centro']) @ rotation * scale + translation
        exterior.append(dict(node=b['node'], centro=center.tolist(), distancia=float(np.linalg.norm(center)),
                             area=b['area']*scale*scale, altura_original=b['height'],
                             bounds=[polygon.min(0).tolist(), polygon.max(0).tolist()]))
    # Deterministic spatial sample: nearest, largest, then four coordinate extremes.
    criteria = [('más cercano al 106', lambda x: x['distancia']),
                ('mayor huella', lambda x: -x['area']),
                ('extremo X menor', lambda x: x['centro'][0]),
                ('extremo X mayor', lambda x: -x['centro'][0]),
                ('extremo Z menor', lambda x: x['centro'][1]),
                ('extremo Z mayor', lambda x: -x['centro'][1])]
    selected = []
    for reason, key in criteria:
        row = min((x for x in exterior if x['node'] not in {a['node'] for a in selected}), key=key)
        selected.append(dict(row, motivo=reason))
    formula = 6378137 * math.pi / 180 / 51000
    output = dict(autor='OpenAI Codex', fecha='2026-10-08',
                  confirmacion_usuario='Luis Miguel confirmó en este chat que generó el GLB con el repositorio identificado.',
                  repositorio='https://github.com/cartesiancs/map3d',
                  commit_consultado='2c5d732477ba7c55995572aae926bf80303c00b9',
                  version_original_exportacion='No acreditada; el commit consultado no identifica por sí solo la versión usada.',
                  escala_formula=formula, escala_ajustada=scale,
                  diferencia_escala_ppm=(scale/formula-1)*1e6,
                  reglas_conteos=dict(collections.Counter(x['regla'] for x in rows)),
                  discrepancias=[x for x in rows if x['error'] > .001], pares=rows,
                  distancia_centros_exteriores=[min(x['distancia'] for x in exterior), max(x['distancia'] for x in exterior)],
                  muestra=selected, exteriores=exterior)
    (OUT / 'procedencia-resultados.json').write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k:v for k,v in output.items() if k not in ('pares','exteriores')},ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
