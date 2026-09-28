"""
Derives the ATLAS working asset from the user's AI-generated Male_Body.blend —
PROVENANCE for assets/anatomy/male-body-base.{blend,glb}; an evaluation, not a
production base.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python tools/anatomy/authored/derive_male_body.py [-- <out.blend> <out.glb> <summary.json>]

Male_Body.blend is only read (its mesh appended into a fresh scene); nothing is
saved back to it. Steps:

  1. align   the figure faces -y in Blender, as ATLAS's exporter expects; it is
             scaled so floor-to-neck-cut matches the procedural figure (157.5 cm),
             centred on the midline, its chest centred front to back
  2. reduce  Blender's collapse decimation to TARGET triangles; the distance from
             the original surface is measured (summary.json)
  3. regions nearest-surface transfer of the procedural model's regions
             (js/anatomy-model.js), then cheap cleanup: majority vote over
             neighbouring faces and absorption of small islands
  4. export  one material per region, through export_glb.py
"""

import base64
import json
import os
import re
import sys
from collections import Counter

import bmesh
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True
sys.path.insert(0, HERE)
import blend as bl          # noqa: E402
import export_glb           # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SOURCE = os.path.join(ROOT, "assets", "anatomy", "Male_Body.blend")
TARGET = int(os.environ.get("ATLAS_TARGET_TRIANGLES", "70000"))
NECK_CUT = 157.5            # the procedural figure's neck cut, cm
SMOOTH_PASSES = 4
MIN_ISLAND = 40             # faces: smaller islands of a region are absorbed by their surroundings


def procedural_model():
    """Positions (cm), triangles and per-vertex regions of js/anatomy-model.js."""
    src = open(os.path.join(ROOT, "js", "anatomy-model.js")).read()
    get = lambda k: json.loads(re.search(r"\b" + k + r": (\[[^\]]*\]|\d+|true|false)", src).group(1))
    bmin, bmax = get("min"), get("max")
    regions = json.loads(re.search(r'regions: Object.freeze\((\[.*?\])\)', src).group(1))
    n, ni, vb = get("vertexCount"), get("indexCount"), get("vertexBytes")
    raw = base64.b64decode(re.search(r'data: "([^"]+)"', src).group(1))
    v = np.frombuffer(raw[:n * vb], dtype=np.uint8).reshape(n, vb)
    q = v[:, :6].copy().view(np.uint16).astype(float) / 65535.0
    pos = np.array(bmin) + q * (np.array(bmax) - np.array(bmin))
    wide = get("wideIndices")
    idx = np.frombuffer(raw[n * vb:], dtype=np.uint32 if wide else np.uint16).reshape(-1, 3)
    return pos, idx, v[:, 10].copy(), regions


def main(out_blend, out_glb, summary_path):
    bl.reset_scene()
    with bpy.data.libraries.load(SOURCE, link=False) as (src, dst):
        dst.meshes = ["Mesh_0"] if "Mesh_0" in src.meshes else src.meshes[:1]
    me = dst.meshes[0]
    me.materials.clear()
    obj = bpy.data.objects.new("male-body-base", me)
    bpy.context.scene.collection.objects.link(obj)

    # 1. Align (Blender coordinates throughout; ATLAS = (x, z, -y) * 100).
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    z0 = co[:, 2].min()
    top = co[co[:, 2] > co[:, 2].max() - 0.05, 2].mean()          # the neck cut (ragged): its mean height
    s = NECK_CUT / 100.0 / (top - z0)
    co[:, 2] -= z0
    co *= s
    co[:, 0] -= 0.5 * (co[:, 0].min() + co[:, 0].max())
    chest = co[np.abs(co[:, 2] - 1.32) < 0.02]
    chest = chest[np.abs(chest[:, 0]) < 0.1]
    co[:, 1] -= 0.5 * (chest[:, 1].min() + chest[:, 1].max())
    me.vertices.foreach_set("co", co.ravel()); me.update()
    orig = co.copy()
    orig_tris = np.array([p.vertices[:] for p in me.polygons])

    # 2. Reduce.
    before = len(me.polygons)
    m = obj.modifiers.new("Decimate", 'DECIMATE'); m.decimate_type = 'COLLAPSE'
    m.ratio = TARGET / before; m.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=m.name)
    after = len(me.polygons)
    dco = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", dco); dco = dco.reshape(-1, 3)
    tree = BVHTree.FromPolygons([tuple(v) for v in dco], [tuple(p.vertices) for p in me.polygons])
    sample = orig[:: max(1, len(orig) // 60000)]
    dev = np.array([(tree.find_nearest(tuple(p))[3] or 0.0) for p in sample]) * 100.0   # cm

    # 3. Regions: nearest procedural surface, in ATLAS cm.
    ppos, pidx, preg, names = procedural_model()
    ptree = BVHTree.FromPolygons([tuple(p) for p in bl.to_blender(ppos) * 100.0], [tuple(t) for t in pidx])
    centres = np.array([p.center[:] for p in me.polygons]) * 100.0
    labels = np.array([preg[pidx[ptree.find_nearest(tuple(c))[2]][0]] for c in centres])
    raw_labels = labels.copy()
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    nbrs = [[g.index for e in f.edges for g in e.link_faces if g.index != f.index] for f in bm.faces]
    for _ in range(SMOOTH_PASSES):
        new = labels.copy()
        for i, nb in enumerate(nbrs):
            c = Counter(labels[j] for j in nb); c[labels[i]] += 1
            new[i] = c.most_common(1)[0][0]
        labels = new
    # absorb small islands
    seen = np.zeros(len(labels), bool); absorbed = 0
    for i in range(len(labels)):
        if seen[i]:
            continue
        comp, stack = [], [i]; seen[i] = True
        while stack:
            f = stack.pop(); comp.append(f)
            for j in nbrs[f]:
                if not seen[j] and labels[j] == labels[i]:
                    seen[j] = True; stack.append(j)
        if len(comp) < MIN_ISLAND:
            ring = Counter(labels[j] for f in comp for j in nbrs[f] if labels[j] != labels[i])
            if ring:
                labels[comp] = ring.most_common(1)[0][0]; absorbed += 1
    bm.free()
    changed = float(np.mean(labels != raw_labels))

    used = [names[k] for k in sorted(set(labels.tolist()))]
    colors = {r: ((0.88, 0.85, 0.76) if r == "body" else (0.70 - 0.01 * (i % 7), 0.50, 0.46)) for i, r in enumerate(used)}
    for r in used:
        me.materials.append(bl.region_material(r, colors[r]))
    slot = {names.index(r): i for i, r in enumerate(used)}
    me.polygons.foreach_set("material_index", [slot[l] for l in labels])
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.update()

    # 4. Save and export (the fresh scene holds only this object; unused data is purged).
    for img in list(bpy.data.images):
        bpy.data.images.remove(img)
    bpy.context.preferences.filepaths.save_version = 0
    txt = bpy.data.texts.new("export_glb.py"); txt.from_string(open(os.path.join(HERE, "export_glb.py")).read())
    bpy.ops.wm.save_as_mainfile(filepath=out_blend, compress=True)
    export_glb.export(out_glb, obj_name="male-body-base")
    counts = Counter(names[l] for l in labels.tolist())
    info = dict(source_triangles=len(orig_tris), triangles=after, vertices=len(me.vertices), scale=round(s, 4),
                deviation_cm=dict(mean=round(float(dev.mean()), 3), p95=round(float(np.percentile(dev, 95)), 3),
                                  p99=round(float(np.percentile(dev, 99)), 3), max=round(float(dev.max()), 3)),
                relabelled_by_cleanup=round(changed, 3), islands_absorbed=absorbed,
                regions={k: counts.get(k, 0) for k in names})
    if summary_path:
        json.dump(info, open(summary_path, "w"), indent=1)
    return info


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out_blend = args[0] if args else os.path.join(ROOT, "assets", "anatomy", "male-body-base.blend")
    out_glb = args[1] if len(args) > 1 else os.path.join(ROOT, "assets", "anatomy", "male-body-base.glb")
    info = main(out_blend, out_glb, args[2] if len(args) > 2 else None)
    print("male body:", {k: v for k, v in info.items() if k != "regions"})
