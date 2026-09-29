"""
Imports the Male_Body sculpture for ATLAS: assets/anatomy/Male_Body.blend ->
assets/anatomy/male-body.glb, the input of `npm run build:anatomy-authored
assets/anatomy/male-body.manifest.json` (-> js/anatomy-model-male-body.js).

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python tools/anatomy/authored/male_body.py [-- <out.glb>]

Male_Body.blend is only read: its mesh is appended into an empty scene and
nothing is saved back. Its anatomy is AUTHORED on the sculpture itself (see
male_body_regions.py and the manifest): every face carries one material,
whose name is its region's id ("pectoralis-major.L", "rectus-abdominis"…);
faces still wearing the sculpture's own material, atlas-stone, are the
unselectable "body". This script only carries those assignments out:

  1. align   the figure faces -y in Blender, as export_glb.py expects;
             scaled so floor-to-neck-cut matches the procedural figure
             (157.5 cm), centred on the midline, its chest centred front
             to back
  2. regions atlas-stone becomes "body"; every other material is a region
             id and is exported as it is (the build checks each against
             the manifest and stops on one it does not list)
  3. export  one glTF primitive per region, through export_glb.py

Full resolution by default. ATLAS_TARGET_TRIANGLES decimates first (the
faces keep their materials).
"""

import json
import os
import sys
from collections import Counter

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True
sys.path.insert(0, HERE)
import blend as bl          # noqa: E402
import export_glb           # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SOURCE = os.environ.get("ATLAS_MALE_BODY_SOURCE", os.path.join(ROOT, "assets", "anatomy", "Male_Body.blend"))
OBJECT = "male-body"
TARGET = int(os.environ.get("ATLAS_TARGET_TRIANGLES", "0"))     # 0: keep every triangle
NECK_CUT = 157.5            # the procedural figure's neck cut, cm
STONE = "atlas-stone"       # the sculpture's own material: faces no region claims
BODY = "body"


def main(out_glb):
    bl.reset_scene()
    with bpy.data.libraries.load(SOURCE, link=False) as (src, dst):
        dst.meshes = ["Mesh_0"] if "Mesh_0" in src.meshes else src.meshes[:1]
    me = dst.meshes[0]
    names = [m.name if m else None for m in me.materials]
    if not names or None in names:
        raise SystemExit("male_body: every material slot of Mesh_0 must hold a material (%r)" % names)
    obj = bpy.data.objects.new(OBJECT, me)
    bpy.context.scene.collection.objects.link(obj)

    # 1. Align (Blender coordinates throughout; ATLAS = (x, z, -y) * 100).
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    z0 = co[:, 2].min()
    # Floor to the neck cut, as measured on the original generated figure; the
    # refined sculpture records it (refine_male_body.py) because its break sits
    # lower than the old collar, which would otherwise rescale the figure.
    floor_to_neck = me.get("atlas_floor_to_neck")
    if floor_to_neck is None:
        floor_to_neck = co[co[:, 2] > co[:, 2].max() - 0.05, 2].mean() - z0   # the neck cut (ragged): its mean height
    s = NECK_CUT / 100.0 / floor_to_neck
    co[:, 2] -= z0
    co *= s
    co[:, 0] -= 0.5 * (co[:, 0].min() + co[:, 0].max())
    chest = co[np.abs(co[:, 2] - 1.32) < 0.02]
    chest = chest[np.abs(chest[:, 0]) < 0.1]
    co[:, 1] -= 0.5 * (chest[:, 1].min() + chest[:, 1].max())
    me.vertices.foreach_set("co", co.ravel()); me.update()

    source_faces = len(me.polygons)
    if TARGET and TARGET < source_faces:
        m = obj.modifiers.new("Decimate", 'DECIMATE'); m.decimate_type = 'COLLAPSE'
        m.ratio = TARGET / source_faces; m.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=m.name)
    faces = len(me.polygons)

    # 2. Regions: the sculpture's own material is the body; every other one is a region id.
    for mat in me.materials:
        if mat.name == STONE:
            mat.name = BODY
    idx = np.empty(faces, np.int64); me.polygons.foreach_get("material_index", idx)
    region_of_slot = [m.name for m in me.materials]
    labels = [region_of_slot[i] for i in idx]
    me.polygons.foreach_set("use_smooth", [True] * faces)
    me.update()

    # 3. Export.
    export_glb.export(out_glb, obj_name=OBJECT)
    counts = Counter(labels)
    return dict(source_triangles=source_faces, triangles=faces, vertices=len(me.vertices), scale=round(s, 4),
                regions={k: counts[k] for k in sorted(counts)})


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = args[0] if args else os.path.join(ROOT, "assets", "anatomy", "male-body.glb")
    info = main(out)
    print("male body:", json.dumps(info))
