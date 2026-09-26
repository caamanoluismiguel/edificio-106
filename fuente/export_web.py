"""Exporta el Edificio 106 (v016) a GLB por grupos de armado, para la web.
- Une por material (pocas llamadas de dibujo), sin césped de hojas sueltas (se reemplaza por textura).
- Aclara follaje: conserva una fracción de hojas y las agranda (misma masa visual).
- Color base de materiales procedurales = promedio de sus rampas de color.
- Ejes: Blender (x, y, z-arriba) -> glTF (x, z, -y)."""
import bpy, numpy as np, json, struct, os, math, random
SRC = "/mnt/user-data/uploads/isthmus-digitaldouble/delivery/v016/Isthmus_v016_rampa_contexto_luz.blend"
OUT = "/home/claude/web106/raw"
bpy.ops.wm.open_mainfile(filepath=SRC)
dg = bpy.context.evaluated_depsgraph_get()

GROUPS = [  # orden de armado
  ("sitio", ["Site", "V012 Access reconstruction", "V016 Access contact correction"]),
  ("arquitectura", ["Architecture", "V014 Glazing and inferred interior depth"]),
  ("ventanas", ["Windows"]),
  ("cubiertas", ["Roofs"]),
  ("entrada", ["Entrance"]),
  ("detalles", ["Details"]),
  ("vegetacion", ["Vegetation", "V015 Photographic planting", "V016 Context canopy and palms"]),
  ("contexto", ["V016 Context from supplied views"]),
]
LEAF_KEYS = ("leaf", "leaflet", "broadleaf", "Ixora", "hedge", "frond", "canopy")
LEAF_KEEP = {"vegetacion": 0.14, "contexto": 1.0}
SKIP_MATS = ("Lawn blade",)
GROUND_UV = {"Weathered asphalt 02 — photographic 3m": 3.0, "Concrete paving — Poly Haven CC0": 2.0,
             "Leafy grass — photographic 2m": 2.0}

def principled(nt):
    for n in nt.nodes:
        if n.type == 'BSDF_PRINCIPLED': return n
    return None

def avg_color(sock, depth=0):
    """Color promedio aproximado de un socket de color (rampas, mezclas, imágenes)."""
    if depth > 6: return None
    if not sock.is_linked:
        v = sock.default_value
        try: return np.array(v[:3], float)
        except TypeError: return np.array([v, v, v], float)
    n = sock.links[0].from_node
    if n.type == 'VALTORGB':
        els = n.color_ramp.elements
        return np.mean([np.array(e.color[:3]) for e in els], axis=0)
    if n.type in ('MIX_RGB', 'MIX'):
        ins = [i for i in n.inputs if i.type == 'RGBA']
        cs = [avg_color(i, depth + 1) for i in ins[:2]]
        cs = [c for c in cs if c is not None]
        if not cs: return None
        fac = n.inputs[0].default_value if not n.inputs[0].is_linked else 0.5
        try: fac = float(fac)
        except TypeError: fac = 0.5
        if len(cs) == 2:
            bt = getattr(n, "blend_type", "MIX")
            if bt == 'MULTIPLY': return cs[0] * (1 - fac + fac * cs[1])
            return cs[0] * (1 - fac) + cs[1] * fac
        return cs[0]
    if n.type == 'TEX_IMAGE' and n.image and n.image.has_data is not None:
        try:
            px = np.array(n.image.pixels[:], np.float32).reshape(-1, 4)[::97, :3]
            return px.mean(axis=0)
        except Exception: return None
    for i in n.inputs:
        if i.type == 'RGBA':
            c = avg_color(i, depth + 1)
            if c is not None: return c
    return None

MATS = {}
def mat_info(m):
    if m.name in MATS: return MATS[m.name]
    d = dict(name=m.name, color=[0.7, 0.7, 0.7], roughness=0.7, metallic=0.0, transmission=0.0, image=None)
    if m.node_tree:
        p = principled(m.node_tree)
        if p:
            c = avg_color(p.inputs["Base Color"])
            if c is not None: d["color"] = [float(x) for x in np.clip(c, 0, 1)]
            r = p.inputs["Roughness"]
            d["roughness"] = float(r.default_value) if not r.is_linked else 0.75
            d["metallic"] = float(p.inputs["Metallic"].default_value)
            t = p.inputs.get("Transmission Weight")
            if t is not None: d["transmission"] = float(t.default_value)
            bc = p.inputs["Base Color"]
            if bc.is_linked and bc.links[0].from_node.type == 'TEX_IMAGE' and bc.links[0].from_node.image:
                d["image"] = bc.links[0].from_node.image.name
    nm = m.name.lower()
    d["leaf"] = any(k.lower() in nm for k in LEAF_KEYS)
    d["glass"] = "glass" in nm
    d["ground_uv"] = GROUND_UV.get(m.name)
    if m.name.startswith("Leafy grass"): d["image"] = "leafy_grass_diff_4k.jpg"
    if m.name.startswith("Weathered asphalt"): d["image"] = "asphalt_02_diff_4k.jpg"
    MATS[m.name] = d
    return d

assigned = set()
summary = {}
for gname, cols in GROUPS:
    soup = {}
    objs = []
    for cn in cols:
        c = bpy.data.collections.get(cn)
        if not c: continue
        for o in c.all_objects:
            if o.name in assigned or o.hide_render or o.type not in ('MESH', 'CURVE', 'FONT'): continue
            if o.type == 'MESH' and o.data.name == "Mown lawn shared botanical patch": continue
            assigned.add(o.name); objs.append(o)
    rng = np.random.default_rng(106)
    for o in objs:
        slots = [s.material for s in o.material_slots]
        if slots and all(m is not None and m.name.startswith(SKIP_MATS) for m in slots): continue
        ev = o.evaluated_get(dg)
        try: me = ev.to_mesh()
        except Exception: continue
        if me is None or len(me.polygons) == 0:
            ev.to_mesh_clear(); continue
        me.calc_loop_triangles()
        nt = len(me.loop_triangles)
        tl = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get("loops", tl)
        tv = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get("vertices", tv)
        mi = np.empty(nt, np.int32); me.loop_triangles.foreach_get("material_index", mi)
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
        cn_ = np.empty(len(me.loops) * 3, np.float32); me.corner_normals.foreach_get("vector", cn_); cn_ = cn_.reshape(-1, 3)
        M = np.array(o.matrix_world, np.float64)
        wco = (co @ M[:3, :3].T + M[:3, 3]).astype(np.float32)
        Nm = np.linalg.inv(M[:3, :3]).T
        wn = cn_ @ Nm.T; wn /= np.maximum(np.linalg.norm(wn, axis=1, keepdims=True), 1e-9)
        eslots = [s.material for s in ev.material_slots] or [None]
        for idx in np.unique(mi):
            m = eslots[idx] if idx < len(eslots) else None
            if m is None:
                m = bpy.data.materials.get("Warm lime-painted plaster")
            if m.name.startswith(SKIP_MATS): continue
            info = mat_info(m)
            sel = np.where(mi == idx)[0]
            if info["leaf"] and LEAF_KEEP.get(gname, 1.0) < 1.0:
                k = LEAF_KEEP[gname]
                sel = sel[rng.random(len(sel)) < k]
                if len(sel) == 0: continue
            li = tl.reshape(-1, 3)[sel].reshape(-1)
            vi = tv.reshape(-1, 3)[sel].reshape(-1)
            P = wco[vi].reshape(-1, 3, 3)
            if info["leaf"] and LEAF_KEEP.get(gname, 1.0) < 1.0:
                cen = P.mean(axis=1, keepdims=True)
                P = cen + (P - cen) * (1.0 / math.sqrt(LEAF_KEEP[gname]))
            Nn = wn[li].reshape(-1, 3, 3)
            soup.setdefault(m.name, []).append((P.reshape(-1, 3).astype(np.float32), Nn.reshape(-1, 3).astype(np.float32)))
        ev.to_mesh_clear()
    # --- write GLB for the group
    nodes, meshes, accessors, views, materials = [], [], [], [], []
    blob = bytearray()
    def add_view(arr, target=34962):
        nonlocal_blob = None
        off = len(blob); b = arr.tobytes(); blob.extend(b)
        while len(blob) % 4: blob.append(0)
        views.append(dict(buffer=0, byteOffset=off, byteLength=len(b), target=target)); return len(views) - 1
    gstat = {}
    for mname, parts in soup.items():
        P = np.concatenate([p for p, _ in parts]); N = np.concatenate([n for _, n in parts])
        # Blender -> glTF axes
        Pg = np.stack([P[:, 0], P[:, 2], -P[:, 1]], 1).astype(np.float32)
        Ng = np.stack([N[:, 0], N[:, 2], -N[:, 1]], 1).astype(np.float32)
        info = MATS[mname]
        attrs = {}
        v = add_view(Pg); accessors.append(dict(bufferView=v, componentType=5126, count=len(Pg), type="VEC3",
                                                min=[float(x) for x in Pg.min(0)], max=[float(x) for x in Pg.max(0)]))
        attrs["POSITION"] = len(accessors) - 1
        v = add_view(Ng); accessors.append(dict(bufferView=v, componentType=5126, count=len(Ng), type="VEC3")); attrs["NORMAL"] = len(accessors) - 1
        if info["ground_uv"]:
            UV = np.stack([P[:, 0], -P[:, 1]], 1).astype(np.float32) / info["ground_uv"]
            v = add_view(UV); accessors.append(dict(bufferView=v, componentType=5126, count=len(UV), type="VEC2")); attrs["TEXCOORD_0"] = len(accessors) - 1
        mat = dict(name=mname, pbrMetallicRoughness=dict(baseColorFactor=info["color"] + [1.0],
                   metallicFactor=info["metallic"], roughnessFactor=info["roughness"]),
                   extras=dict(leaf=info["leaf"], glass=info["glass"], image=info["image"], ground_uv=info["ground_uv"]))
        if info["leaf"]: mat["doubleSided"] = True
        if info["transmission"] > 0.5 or info["glass"]:
            mat["extensions"] = {"KHR_materials_transmission": {"transmissionFactor": max(info["transmission"], 0.9)}}
        materials.append(mat)
        meshes.append(dict(name=mname, primitives=[dict(attributes=attrs, material=len(materials) - 1)]))
        nodes.append(dict(name=mname, mesh=len(meshes) - 1))
        gstat[mname] = len(Pg) // 3
    if not nodes: continue
    root = dict(name=gname, children=list(range(len(nodes))), extras=dict(orden=[g for g, _ in GROUPS].index(gname)))
    nodes.append(root)
    gl = dict(asset=dict(version="2.0", generator="Claude export_web.py (Edificio 106)"),
              scene=0, scenes=[dict(nodes=[len(nodes) - 1])], nodes=nodes, meshes=meshes, materials=materials,
              accessors=accessors, bufferViews=views, buffers=[dict(byteLength=len(blob))])
    if any("extensions" in m for m in materials): gl["extensionsUsed"] = ["KHR_materials_transmission"]
    js = json.dumps(gl, ensure_ascii=False).encode("utf8")
    while len(js) % 4: js += b" "
    with open(os.path.join(OUT, gname + ".glb"), "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(blob), 0x004E4942)); f.write(blob)
    summary[gname] = dict(objects=len(objs), tris=sum(gstat.values()), materials=len(gstat), top=sorted(gstat.items(), key=lambda x: -x[1])[:6])
    print("GROUP", gname, summary[gname]["objects"], summary[gname]["tris"], flush=True)

# textures used
for im in bpy.data.images:
    if im.name in ("leafy_grass_diff_4k.jpg", "asphalt_02_diff_4k.jpg", "concrete_floor_01_diff_2k.jpg", "kloofendal_48d_partly_cloudy_puresky_8k.hdr", "asphalt_02_nor_gl_4k.jpg"):
        if im.packed_file:
            with open(os.path.join("/home/claude/web106/tex", im.name), "wb") as f: f.write(im.packed_file.data)
# cameras
cams = {o.name: dict(loc=list(o.location), rot=list(o.rotation_euler), lens=o.data.lens) for o in bpy.data.objects if o.type == 'CAMERA'}
json.dump(dict(summary=summary, materials=MATS, cameras=cams), open(os.path.join(OUT, "export_summary.json"), "w"), indent=1, ensure_ascii=False)
print("DONE")
