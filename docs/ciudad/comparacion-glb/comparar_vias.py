#!/usr/bin/env python3
"""Codex, 8 oct 2026. Recupera líneas auxiliares y compara con las vías OSM del repo.
Uso: python3 docs/ciudad/comparacion-glb/comparar_vias.py /ruta/ciudadelsaber.glb
Ejecutar comparar.py primero. No cambia modelos ni datos de la aplicación.
"""
import collections
import hashlib
import json
import struct
import subprocess
import sys

import numpy as np
from scipy.spatial import cKDTree

from comparar import OUT, ROOT, EXPECTED, inside, percentiles


def intersects(line, polygon):
    if any(inside(p, polygon) for p in line):
        return True
    def cross(a, b):
        return a[0] * b[1] - a[1] * b[0]
    for a, b in zip(line[:-1], line[1:]):
        for c, d in zip(polygon, np.roll(polygon, -1, axis=0)):
            v, w = b - a, d - c
            determinant = cross(v, w)
            if abs(determinant) > 1e-12:
                u, t = cross(c - a, w) / determinant, cross(c - a, v) / determinant
                if 0 <= u <= 1 and 0 <= t <= 1:
                    return True
            elif abs(cross(c - a, v)) < 1e-9:
                if np.all(np.maximum(np.minimum(a, b), np.minimum(c, d)) <= np.minimum(np.maximum(a, b), np.maximum(c, d))):
                    return True
    return False


def line_properties(p):
    lengths = np.linalg.norm(np.diff(p, axis=0), axis=1)
    assert lengths.sum() > 0
    return ((p[:-1] + p[1:]) * lengths[:, None] / 2).sum(0) / lengths.sum(), lengths.sum()


def main():
    data = open(sys.argv[1], 'rb').read()
    assert hashlib.sha256(data).hexdigest() == EXPECTED
    n = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20 + n])
    binary = data[28 + n:]
    result_buildings = json.loads((OUT / 'resultados.json').read_text())
    assert result_buildings['glb_sha256'] == EXPECTED
    for path, expected in result_buildings['fuentes_sha256'].items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected, 'Repetir comparar.py: ' + path
    transform = result_buildings['transformacion']
    rotation, scale, translation = np.array(transform['rotacion']), transform['escala_horizontal'], np.array(transform['traslacion'])

    def accessor(i):
        a = gltf['accessors'][i]
        v = gltf['bufferViews'][a['bufferView']]
        assert a['componentType'] == 5126 and a['type'] == 'VEC3' and 'sparse' not in a
        return np.ndarray((a['count'], 3), '<f4', binary,
                          offset=v.get('byteOffset', 0) + a.get('byteOffset', 0), strides=(v.get('byteStride', 12), 4)).copy()

    lines, nodes, heights = [], [], []
    for ni, node in enumerate(gltf['nodes']):
        if 'mesh' not in node:
            assert not any(k in node for k in ('matrix', 'translation', 'rotation', 'scale'))
            continue
        for primitive in gltf['meshes'][node['mesh']]['primitives']:
            if '_INSTANCESTART' not in primitive['attributes']:
                continue
            assert not any(k in node for k in ('matrix', 'translation', 'rotation', 'scale'))
            start = accessor(primitive['attributes']['_INSTANCESTART'])
            end = accessor(primitive['attributes']['_INSTANCEEND'])
            assert start.shape == end.shape and np.allclose(start[1:], end[:-1], atol=.001)
            points = np.concatenate([start, end[-1:]])
            lines.append(points[:, [0, 2]] @ rotation * scale + translation)
            heights.extend(points[:, 1].tolist())
            nodes.append(ni)

    js = """import fs from 'node:fs';
import {osmRegistrado,aEscena} from './fuente/contexto-osm.mjs';
import {entornoRegistrado} from './fuente/entorno-osm.mjs';
const {registro:r}=osmRegistrado(),a=r.rotacionGrados*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
const reg=(lat,lon)=>{const p=aEscena(lat,lon),x=p[0]-r.centroOSM106[0],z=p[1]-r.centroOSM106[1];return [x*c-z*s,x*s+z*c]};
const trees=JSON.parse(fs.readFileSync('fuente/arboles_cds.geojson'));
console.log(JSON.stringify({calles:entornoRegistrado().calles,
 caja:[[8.984,-79.606],[8.984,-79.564],[9.020,-79.564],[9.020,-79.606]].map(p=>reg(...p)),
 copas:trees.features.map(f=>reg(f.geometry.coordinates[1],f.geometry.coordinates[0]))}));"""
    reference = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', js], cwd=ROOT))
    refs = reference['calles']
    ref_lines = [np.array(r['linea']) for r in refs]
    tree = cKDTree([line_properties(p)[0] for p in ref_lines])
    pairs, unmatched = [], []
    for i, line in enumerate(lines):
        center, length = line_properties(line)
        _, candidates = tree.query(center, k=10)
        best = None
        for j in candidates:
            p = ref_lines[j]
            if len(p) != len(line):
                continue
            error = min(np.linalg.norm(line - p, axis=1).max(), np.linalg.norm(line - p[::-1], axis=1).max())
            if best is None or error < best[0]:
                best = (float(error), int(j))
        if best and best[0] < .1:
            error, j = best
            r = refs[j]
            pairs.append(dict(glb_index=i, glb_node=nodes[i], osm_id=r['id'], tipo_osm=r['tipo'],
                              nombre_osm=r['nombre'], error_max_vertices=error,
                              cerrado=bool(np.linalg.norm(line[0] - line[-1]) < .01)))
        else:
            unmatched.append(i)
    matched_ids = {p['osm_id'] for p in pairs}
    assert len(matched_ids) == len(pairs)
    city = json.loads((ROOT / 'datos/ciudad_mapa.json').read_text())
    report = dict(autor='OpenAI Codex', fecha='2026-10-08', glb_sha256=EXPECTED,
                  transformacion=result_buildings['transformacion'],
                  metodo='Misma transformación que los edificios, sin reajuste. Diez vecinos por centro ponderado por longitud; igual cantidad de vértices y comparación ordenada directa o inversa; máximo <0,1 m nominales.',
                  fuentes_sha256={p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in
                                  ['fuente/osm-amplio.json', 'fuente/contexto.mjs', 'fuente/arboles_cds.geojson']},
                  conteos=dict(lineas_glb=len(lines), segmentos_glb=sum(len(p)-1 for p in lines),
                               vias_osm=len(refs), correspondencias=len(pairs), glb_sin_correspondencia=len(unmatched),
                               osm_sin_correspondencia=len(refs)-len(pairs),
                               sin_correspondencia_intersectan_consulta=sum(intersects(lines[i], np.array(reference['caja'])) for i in unmatched),
                               sin_correspondencia_intersectan_campus=sum(intersects(lines[i], np.array(city['limite'])) for i in unmatched),
                               lineas_cerradas=sum(bool(np.linalg.norm(p[0]-p[-1]) < .01) for p in lines),
                               cerradas_emparejadas=sum(p['cerrado'] for p in pairs)),
                  tipos_emparejados=dict(collections.Counter(p['tipo_osm'] for p in pairs)),
                  error_vertices=percentiles([p['error_max_vertices'] for p in pairs]),
                  y_original_rango=[min(heights), max(heights)],
                  nombres_y_tipos='Recuperados por correspondencia con OSM, no presentes en el GLB.',
                  pares=pairs, nodos_sin_correspondencia=[nodes[i] for i in unmatched])
    (OUT / 'resultados-vias.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    plot(lines, refs, matched_ids, unmatched, city, reference)
    print(json.dumps({k: v for k, v in report.items() if k not in ('pares', 'nodos_sin_correspondencia', 'fuentes_sha256')}, ensure_ascii=False, indent=2))


def plot(lines, refs, matched_ids, unmatched, city, reference):
    unmatched = set(unmatched)
    combined = np.concatenate(lines + [np.array(r['linea']) for r in refs])
    lo, hi = combined.min(0)-80, combined.max(0)+80
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="900">',
             '<rect width="1500" height="900" fill="#f7f8fa"/>',
             '<style>text{font-family:Arial,sans-serif;fill:#172c40}.title{font-size:27px;font-weight:700}.label{font-size:19px;font-weight:700}.note{font-size:15px}</style>',
             '<text x="30" y="43" class="title">Calles recuperadas del GLB y vegetación del proyecto</text>',
             '<text x="30" y="72" class="note">Coincidencia de trazados, no de anchos ni pavimentos · Codex · 8 oct 2026</text>']
    views = [(30, 720, (lo[0], hi[0], lo[1], hi[1]), 'Cobertura de la red'),
             (775, 695, (-470, 1270, -1300, 950), 'Campus: vías y copas aproximadas existentes')]
    for n, (left, width, bounds, title) in enumerate(views):
        top, height = 105, 620
        x0, x1, z0, z1 = bounds
        factor = min((width-30)/(x1-x0), (height-65)/(z1-z0))
        cx, cz = (x0+x1)/2, (z0+z1)/2
        def point(x, z):
            return (left+width/2+(x-cx)*factor, top+(height+25)/2+(z-cz)*factor)
        def points(p):
            return ' '.join(f'{a:.2f},{b:.2f}' for a,b in [point(x,z) for x,z in p])
        parts += [f'<rect x="{left}" y="{top}" width="{width}" height="{height}" rx="12" fill="white" stroke="#d6dfe5"/>',
                  f'<text x="{left+18}" y="{top+29}" class="label">{title}</text>',
                  f'<clipPath id="clip{n}"><rect x="{left+1}" y="{top+42}" width="{width-2}" height="{height-43}"/></clipPath>', f'<g clip-path="url(#clip{n})">']
        if n:
            for x,z in reference['copas']:
                a,b = point(x,z)
                parts.append(f'<circle cx="{a:.2f}" cy="{b:.2f}" r="1.4" fill="#91b38d" fill-opacity=".55"/>')
            for e in city['edificios']:
                parts.append(f'<polygon points="{points(e["p"])}" fill="#dbe2e6" stroke="#aab4bb" stroke-width=".4"/>')
        for r in refs:
            if r['id'] not in matched_ids:
                parts.append(f'<polyline points="{points(r["linea"])}" fill="none" stroke="#b84830" stroke-width="1.1"/>')
        for i,line in enumerate(lines):
            color = '#aa5b94' if i in unmatched else '#147d92'
            parts.append(f'<polyline points="{points(line)}" fill="none" stroke="{color}" stroke-width=".85"/>')
        parts += [f'<polygon points="{points(city["limite"])}" fill="none" stroke="#34435b" stroke-width="1.2" stroke-dasharray="5 4"/>', '</g>']
        length = 500 if n==0 else 200
        parts += [f'<path d="M {left+18} {top+height-16} h {length*factor}" stroke="#172c40" stroke-width="3"/>',
                  f'<text x="{left+18}" y="{top+height-23}" font-size="11">{length} m del marco del proyecto</text>']
    for x,color,text in [(35,'#147d92','660 trazados coincidentes'),(395,'#aa5b94','151 líneas GLB fuera de la consulta'),(880,'#b84830','81 vías OSM sin correspondencia')]:
        parts += [f'<rect x="{x}" y="750" width="13" height="13" fill="{color}"/>',f'<text x="{x+21}" y="763" class="note">{text}</text>']
    parts += ['<rect x="35" y="787" width="13" height="13" fill="#91b38d"/>',
              '<text x="56" y="799" class="note">Copas del modelo existente, fuente de imágenes 2018. No delimitan parques ni certifican árboles actuales.</text>',
              '<text x="35" y="835" class="note">Parques: no se identificaron polígonos propios en el GLB. Los espacios vacíos no se clasifican como áreas verdes.</text>',
              '<text x="35" y="868" class="note">Comparación en el plano X/Z del visor; el norte no está arriba. Datos OSM del repo, consulta de octubre de 2026.</text>', '</svg>']
    (OUT / 'calles.svg').write_text('\n'.join(parts)+'\n')


if __name__ == '__main__':
    main()
