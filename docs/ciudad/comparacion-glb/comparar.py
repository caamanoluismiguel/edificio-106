#!/usr/bin/env python3
"""Comparación de Codex, 7 oct 2026. Solo lectura de modelos; salidas en esta carpeta.
Uso: python3 docs/ciudad/comparacion-glb/comparar.py /ruta/ciudadelsaber.glb
Requiere Python 3, NumPy, SciPy y Node.js. No descarga ni integra geometría.
"""
import collections
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys

import numpy as np
import scipy
from scipy.spatial import cKDTree

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
EXPECTED = 'c09b25daf4eddef945b66ab7d80a82e6a4a3b661f94f55918f776dd3634668a2'


def properties(p):
    p = np.asarray(p)
    q = np.roll(p, -1, axis=0)
    cross = p[:, 0] * q[:, 1] - q[:, 0] * p[:, 1]
    area = cross.sum() / 2
    return abs(area), ((p + q) * cross[:, None]).sum(axis=0) / (6 * area)


def extract(data):
    assert data[:4] == b'glTF' and struct.unpack_from('<I', data, 4)[0] == 2
    n, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    gltf = json.loads(data[20:20 + n])
    assert struct.unpack_from('<I', data, 24 + n)[0] == 0x004E4942
    binary = data[28 + n:]

    def accessor(i):
        a = gltf['accessors'][i]
        assert 'sparse' not in a
        v = gltf['bufferViews'][a['bufferView']]
        assert v.get('buffer', 0) == 0
        dtype = np.dtype({5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}[a['componentType']])
        size = {'SCALAR': 1, 'VEC3': 3, 'VEC2': 2}[a['type']]
        return np.ndarray((a['count'], size), dtype, binary,
                          offset=v.get('byteOffset', 0) + a.get('byteOffset', 0),
                          strides=(v.get('byteStride', dtype.itemsize * size), dtype.itemsize)).copy()

    rows = []
    auxiliary = 0

    def visit(ni, parent):
        nonlocal auxiliary
        node = gltf['nodes'][ni]
        # This export uses matrices, never TRS. Fail rather than silently misread another export.
        assert not any(k in node for k in ('translation', 'rotation', 'scale'))
        matrix = parent @ np.array(node.get('matrix', np.eye(4).flatten(order='F'))).reshape(4, 4, order='F')
        if 'mesh' in node:
            for primitive in gltf['meshes'][node['mesh']]['primitives']:
                if '_INSTANCESTART' in primitive['attributes']:
                    assert 'material' not in primitive
                    auxiliary += 1
                    continue
                assert 'material' in primitive and primitive.get('mode', 4) == 4
                p = accessor(primitive['attributes']['POSITION'])
                p = (np.c_[p, np.ones(len(p))] @ matrix.T)[:, :3]
                ix = accessor(primitive['indices']).ravel() if 'indices' in primitive else np.arange(len(p))
                triangles = p[ix].reshape(-1, 3, 3)
                bottom = triangles[np.max(abs(triangles[:, :, 1] - p[:, 1].min()), axis=1) < 1e-4]
                edges = collections.Counter()
                for triangle in bottom:
                    vertices = [tuple(np.round(v[[0, 2]], 5)) for v in triangle]
                    for a, b in zip(vertices, vertices[1:] + vertices[:1]):
                        edges[tuple(sorted((a, b)))] += 1
                adjacency = collections.defaultdict(list)
                for (a, b), count in edges.items():
                    if count == 1:
                        adjacency[a].append(b)
                        adjacency[b].append(a)
                assert adjacency and all(len(v) == 2 for v in adjacency.values()), ni
                unseen, loops = set(adjacency), []
                while unseen:
                    start = min(unseen)
                    previous, current, loop = None, start, []
                    while True:
                        loop.append(current)
                        unseen.remove(current)
                        following = next(v for v in adjacency[current] if v != previous)
                        previous, current = current, following
                        if current == start:
                            break
                    loops.append(np.array(loop))
                assert len(loops) == 1, (ni, 'Esta comparación espera una huella sin huecos por primitiva')
                poly = loops[0]
                area, center = properties(poly)
                rows.append(dict(node=ni, mesh=node['mesh'], poly=poly.tolist(), area=area,
                                 centro=center.tolist(), ymin=float(p[:, 1].min()), height=float(np.ptp(p[:, 1]))))
        for child in node.get('children', []):
            visit(child, matrix)

    for node in gltf['scenes'][gltf.get('scene', 0)]['nodes']:
        visit(node, np.eye(4))
    return rows, auxiliary


def fit(a, b):
    ac, bc = a - a.mean(0), b - b.mean(0)
    u, singular, vt = np.linalg.svd(ac.T @ bc)
    rotation = u @ vt
    assert np.linalg.det(rotation) > 0
    scale = singular.sum() / (ac * ac).sum()
    return scale, rotation, b.mean(0) - a.mean(0) @ rotation * scale


def boundary_difference(a, b):
    """Maximum vertex-to-opposite-segment distance, symmetric; NOT exact Hausdorff."""
    def one(p, q):
        vectors = np.roll(q, -1, axis=0) - q
        delta = p[:, None, :] - q[None, :, :]
        u = np.clip((delta * vectors).sum(2) / (vectors * vectors).sum(1), 0, 1)
        return float(np.linalg.norm(delta - u[:, :, None] * vectors, axis=2).min(1).max())
    return max(one(np.array(a), np.array(b)), one(np.array(b), np.array(a)))


def inside(q, polygon):
    x, y = q
    result = False
    for a, b in zip(polygon, np.roll(polygon, -1, axis=0)):
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            result = not result
    return result


def percentiles(values):
    return dict(zip(('min', 'mediana', 'p95', 'max'), map(float, np.percentile(values, [0, 50, 95, 100]))))


def main():
    data = Path(sys.argv[1]).read_bytes()
    assert hashlib.sha256(data).hexdigest() == EXPECTED, 'Archivo distinto: revisar los supuestos antes de comparar'
    glb, auxiliary = extract(data)
    # Reuse the actual project coordinate registration, not a separately transcribed projection.
    js = """import {osmRegistrado} from './fuente/contexto-osm.mjs';
import {entornoRegistrado} from './fuente/entorno-osm.mjs';
const o=osmRegistrado(),e=entornoRegistrado();
console.log(JSON.stringify({registro:o.registro,edificios:[...o.edificios,...e.edificios]}));"""
    reference = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', js], cwd=ROOT))
    ref = reference['edificios']
    inventory = json.loads((ROOT / 'docs/ciudad/edificios.json').read_text())['edificios']
    city = json.loads((ROOT / 'datos/ciudad_mapa.json').read_text())
    A = np.array([g['centro'] for g in glb])
    areas_a = np.array([g['area'] for g in glb])
    B = np.array([properties(g['poly'])[1] for g in ref])
    areas_b = np.array([properties(g['poly'])[0] for g in ref])
    calibration = np.array([g['id'] % 5 != 0 for g in ref])
    theta = np.deg2rad(34 + reference['registro']['rotacionGrados'])
    # Coarse discovery by votes among footprints of similar area. Held-out IDs never vote.
    best = None
    for s in np.arange(.5, 3.01, .025):
        candidates = np.argwhere((abs(np.log(areas_a[:, None] * s * s / areas_b[None, :])) < .018) & calibration[None, :])
        for angle in (theta, -theta, np.pi - theta, np.pi + theta, 0, np.pi / 2, np.pi, 3 * np.pi / 2):
            rot = np.array([[np.cos(angle), np.sin(angle)], [-np.sin(angle), np.cos(angle)]])
            shifts = B[candidates[:, 1]] - (A @ rot * s)[candidates[:, 0]]
            votes = collections.Counter(map(tuple, np.round(shifts / 25).astype(int)))
            cell, count = votes.most_common(1)[0]
            if best is None or count > best[0]:
                best = (count, s, rot, np.array(cell) * 25)
    _, scale, rotation, translation = best
    tree = cKDTree(B)
    for threshold, area_threshold in [(25, .15)] * 4 + [(2, .03)] * 3:
        distance, index = tree.query(A @ rotation * scale + translation)
        accepted = (distance < threshold) & (abs(np.log(areas_a * scale * scale / areas_b[index])) < area_threshold)
        train = accepted & calibration[index]
        # During coarse alignment, retain only the nearest candidate for each reference.
        seen = set()
        for i in np.argsort(distance):
            if train[i]:
                if index[i] in seen:
                    train[i] = False
                else:
                    seen.add(index[i])
        scale, rotation, translation = fit(A[train], B[index[train]])
    transformed = A @ rotation * scale + translation
    distance, index = tree.query(transformed)
    accepted = (distance < 2) & (abs(np.log(areas_a * scale * scale / areas_b[index])) < .03)
    assert len(set(index[accepted])) == int(accepted.sum())
    by_id = {ref[index[i]]['id']: i for i in np.where(accepted)[0]}
    ids = {e['osm_id'] for e in inventory}
    city_by_id = {e['o']: e for e in city['edificios']}
    inventory_by_id = {e['osm_id']: e for e in inventory}
    polygons = [np.array(g['poly']) @ rotation * scale + translation for g in glb]
    pairs = []
    for i in np.where(accepted)[0]:
        r = ref[index[i]]
        e = inventory_by_id.get(r['id'])
        m = city_by_id.get(r['id'])
        pairs.append(dict(osm_id=r['id'], glb_node=glb[i]['node'], numero=e['numero'] if e else None,
                          modelo=e['modelo'] if e else None, inventario=e is not None,
                          grupo='ajuste' if calibration[index[i]] else 'control',
                          residuo_centro=float(distance[i]),
                          diferencia_vertices_osm=boundary_difference(polygons[i], r['poly']),
                          diferencia_vertices_mapa=boundary_difference(polygons[i], m['p']) if m else None,
                          altura_glb_unidades=glb[i]['height'], altura_mapa_aproximada=m['h'] if m else None))
    coverage = collections.Counter()
    unmatched_outside_query = 0
    angle = np.deg2rad(reference['registro']['rotacionGrados'])
    undo = np.array([[np.cos(angle), -np.sin(angle)], [np.sin(angle), np.cos(angle)]])
    for i, center in enumerate(transformed):
        kind = 'inventario' if accepted[i] and ref[index[i]]['id'] in ids else 'osm_contexto' if accepted[i] else 'sin_correspondencia'
        coverage[f'{kind}_{"dentro" if inside(center, city["limite"]) else "fuera"}'] += 1
        if not accepted[i]:
            x, z = center @ undo + reference['registro']['centroOSM106']
            east = x * np.sin(np.deg2rad(56)) + z * np.cos(np.deg2rad(56))
            north = x * np.cos(np.deg2rad(56)) - z * np.sin(np.deg2rad(56))
            lat = 8.9993 + north / 6378137 * 180 / np.pi
            lon = -79.5827 + east / (6378137 * np.cos(np.deg2rad(8.9993))) * 180 / np.pi
            unmatched_outside_query += not (8.984 <= lat <= 9.020 and -79.606 <= lon <= -79.564)
    report = dict(autor='OpenAI Codex', fecha='2026-10-07', glb_sha256=EXPECTED,
                  dependencias=dict(numpy=np.__version__, scipy=scipy.__version__),
                  fuentes_sha256={f: hashlib.sha256((ROOT / f).read_bytes()).hexdigest() for f in
                      ['fuente/osm.json', 'fuente/osm-amplio.json', 'fuente/contexto-osm.mjs', 'fuente/entorno-osm.mjs',
                       'fuente/src/sol.js', 'docs/ciudad/edificios.json', 'datos/ciudad_mapa.json']},
                  unidades='Residuos y transformación: marco del proyecto en metros nominales; no exactitud geográfica real. Alturas GLB: unidades originales.',
                  transformacion=dict(convencion='[x,z] de GLTFLoader como vector fila @ rotacion * escala + traslacion',
                                      escala_horizontal=scale, rotacion=rotation.tolist(), traslacion=translation.tolist(),
                                      giro_grados=float(np.rad2deg(np.arctan2(rotation[0, 1], rotation[0, 0])))),
                  conteos=dict(huellas_glb=len(glb), primitivas_auxiliares=auxiliary, huellas_referencia=len(ref),
                               correspondencias=len(pairs), referencia_sin_correspondencia=len(ref)-len(pairs),
                               inventario=len(inventory), inventario_emparejado=len(ids & by_id.keys()),
                               mapa_navegacion=len(city_by_id), control=sum(p['grupo'] == 'control' for p in pairs),
                               ajuste=sum(p['grupo'] == 'ajuste' for p in pairs),
                               sin_correspondencia_fuera_consulta=int(unmatched_outside_query)),
                  cobertura_centroides=dict(coverage),
                  residuos_control=percentiles([p['residuo_centro'] for p in pairs if p['grupo'] == 'control']),
                  diferencias_vertices_osm=percentiles([p['diferencia_vertices_osm'] for p in pairs]),
                  diferencias_vertices_mapa=percentiles([p['diferencia_vertices_mapa'] for p in pairs if p['diferencia_vertices_mapa'] is not None]),
                  alturas_glb=dict(collections.Counter(str(round(g['height'], 3)) for g in glb)),
                  alturas_glb_inventario=dict(collections.Counter(str(round(glb[by_id[e['osm_id']]]['height'], 3)) for e in inventory if e['osm_id'] in by_id)),
                  cota_base_max_absoluta=float(max(abs(g['ymin']) for g in glb)), pares=pairs)
    (OUT / 'resultados.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    plot(polygons, accepted, index, ref, ids, city, glb)
    print(json.dumps({k: v for k, v in report.items() if k not in ('pares', 'fuentes_sha256')}, ensure_ascii=False, indent=2))


def plot(polygons, accepted, index, ref, ids, city, glb):
    # Architectural plan in SVG, same scale on both axes; no vertical/geographic accuracy implied.
    import html
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="880" viewBox="0 0 1500 880">',
             '<rect width="1500" height="880" fill="#f7f8fa"/>',
             '<style>text{font-family:Arial,sans-serif;fill:#172c40}.title{font-size:27px;font-weight:700}.sub{font-size:15px}.label{font-size:18px;font-weight:700}</style>',
             '<text x="35" y="44" class="title">GLB de Descargas y ciudad del proyecto</text>',
             '<text x="35" y="72" class="sub">Comparación de huellas tras alinear la planta · Codex · 7 oct 2026</text>']
    unmatched_ref = [r for j, r in enumerate(ref) if j not in set(index[accepted])]
    all_points = np.concatenate(polygons + [np.array(r['poly']) for r in unmatched_ref])
    lo, hi = all_points.min(0) - 80, all_points.max(0) + 80
    views = [(30, 110, 720, 655, (lo[0], hi[0], lo[1], hi[1]), 'Cobertura de los 991 volúmenes'),
             (775, 110, 695, 410, (-470, 1260, -1320, 970), 'Campus y límite del proyecto'),
             (775, 555, 695, 210, (-100, 150, -65, 75), 'Detalle junto al 106')]
    for n, (left, top, width, height, bounds, title) in enumerate(views):
        x0, x1, z0, z1 = bounds
        factor = min((width - 32) / (x1 - x0), (height - 62) / (z1 - z0))
        cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
        def points(poly):
            return ' '.join(f'{left + width / 2 + (x - cx) * factor:.2f},{top + (height + 25) / 2 + (z - cz) * factor:.2f}' for x, z in poly)
        parts += [f'<rect x="{left}" y="{top}" width="{width}" height="{height}" rx="12" fill="white" stroke="#d6dfe5"/>',
                  f'<text x="{left+18}" y="{top+27}" class="label">{html.escape(title)}</text>',
                  f'<clipPath id="clip{n}"><rect x="{left+1}" y="{top+40}" width="{width-2}" height="{height-41}"/></clipPath>',
                  f'<g clip-path="url(#clip{n})">']
        for i, poly in enumerate(polygons):
            color = '#147d92' if accepted[i] and ref[index[i]]['id'] in ids else '#8796a0' if accepted[i] else '#aa5b94'
            parts.append(f'<polygon points="{points(poly)}" fill="{color}" fill-opacity=".30" stroke="{color}" stroke-width=".65"/>')
        for r in unmatched_ref:
            parts.append(f'<polygon points="{points(r["poly"])}" fill="none" stroke="#4b6b33" stroke-width=".8"/>')
        if n > 0:
            for building in city['edificios']:
                parts.append(f'<polygon points="{points(building["p"])}" fill="none" stroke="#b84830" stroke-width=".85"/>')
            if n == 2:
                parts.append(f'<text x="{left+width/2-cx*factor}" y="{top+(height+25)/2-cz*factor+4}" text-anchor="middle" font-size="12">106</text>')
        parts += [f'<polygon points="{points(city["limite"])}" fill="none" stroke="#34435b" stroke-width="1.3" stroke-dasharray="5 4"/>', '</g>']
        length = 500 if n == 0 else 200 if n == 1 else 20
        parts.append(f'<path d="M {left+18} {top+height-16} h {length*factor:.2f}" stroke="#172c40" stroke-width="3"/>')
        parts.append(f'<text x="{left+18}" y="{top+height-23}" font-size="11">{length} m del marco del proyecto</text>')
    for x, color, text in [(35, '#147d92', '322 del inventario'), (315, '#8796a0', '344 del contexto OSM'), (625, '#aa5b94', '325 fuera de la consulta OSM'), (1030, '#b84830', 'Huellas del mapa actual')]:
        parts += [f'<rect x="{x}" y="797" width="13" height="13" fill="{color}"/>', f'<text x="{x+20}" y="809" class="sub">{text}</text>']
    parts += ['<rect x="35" y="823" width="13" height="13" fill="none" stroke="#4b6b33"/>',
              '<text x="55" y="835" class="sub">133 huellas del contexto OSM sin correspondencia en el GLB</text>',
              '<text x="35" y="863" class="sub">La coincidencia con OSM es interna entre archivos; no demuestra exactitud en sitio. Plano X/Z del visor, sin norte arriba.</text>', '</svg>']
    (OUT / 'comparacion.svg').write_text('\n'.join(parts) + '\n')


if __name__ == '__main__':
    main()
