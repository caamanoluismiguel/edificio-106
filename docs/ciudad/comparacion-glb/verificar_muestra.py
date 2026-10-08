#!/usr/bin/env python3
"""Verifica las seis identidades sobre la instantánea OSM, sin red. Codex, 8 oct 2026."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import numpy as np
from comparar import OUT, ROOT, EXPECTED, extract, boundary_difference

data = Path(sys.argv[1]).read_bytes()
assert hashlib.sha256(data).hexdigest() == EXPECTED
buildings, _ = extract(data)
by_node = {b['node']: b for b in buildings}
transform = json.loads((OUT / 'resultados.json').read_text())['transformacion']
snapshot = json.loads((OUT / 'muestra-osm.json').read_text())
js = """import fs from 'node:fs';
import {aEscena,osmRegistrado} from './fuente/contexto-osm.mjs';
const r=osmRegistrado().registro,a=r.rotacionGrados*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
const d=JSON.parse(fs.readFileSync('docs/ciudad/comparacion-glb/muestra-osm.json'));
console.log(JSON.stringify(d.pares.map(p=>p.osm.geometry.map(g=>{
 const v=aEscena(g.lat,g.lon),x=v[0]-r.centroOSM106[0],z=v[1]-r.centroOSM106[1];
 return [x*c-z*s,x*s+z*c];}))));"""
reference = json.loads(subprocess.check_output(['node','--input-type=module','-e',js],cwd=ROOT))
assert len(reference) == 6 and len({p['osm']['id'] for p in snapshot['pares']}) == 6
for pair, poly in zip(snapshot['pares'], reference):
    q = np.array(poly)
    if np.linalg.norm(q[0]-q[-1]) < 1e-6:
        q = q[:-1]
    b = by_node[pair['glb_node']]
    p = np.array(b['poly']) @ np.array(transform['rotacion']) * transform['escala_horizontal'] + transform['traslacion']
    error = boundary_difference(p,q)
    assert error < .1 and abs(error-pair['max_vertex_segment_difference']) < 1e-6
    print(f"Nodo {pair['glb_node']} → OSM {pair['osm']['id']}: {error:.6f} m nominales; {pair['osm']['tags']}")
