"""
Exports the torso study for ATLAS: assets/anatomy/torso-study.blend ->
assets/anatomy/torso-study.glb. This is the one step between a hand edit in
Blender and the app's build (npm run build:anatomy-authored).

    /Applications/Blender.app/Contents/MacOS/Blender -b assets/anatomy/torso-study.blend \
        --python tools/anatomy/authored/export_glb.py

or, in Blender, open the Text Editor, pick "export_glb.py" (saved inside the
.blend) and press Run Script.

What it writes: the sculpture with its modifiers applied (the mirrored,
subdivided surface), one glTF primitive per material (= per anatomical
region), and each shape key named "state:<id>" as a morph target on the
same vertices; plus the "landmark:<id>" empties as nodes, their `region` and
`type` custom properties as glTF extras.

Why not a plain File > Export: Blender's glTF exporter drops shape keys when
it applies modifiers. Here each state is evaluated through the same
modifiers and written as a morph target by hand. A plain export (with
"Apply Modifiers") carries no states, and the build stops and says so,
because the manifest lists them.

Landmarks are snapped onto the sculpted surface as they are written, so a
hand edit that moves the surface under one does not strand it; the .blend
itself is left as it is.
"""

import os
import sys

import bpy
import numpy as np

OBJECT = "torso-study"


def evaluated_copy(obj):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    return bpy.data.meshes.new_from_object(obj.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)


def export(path, obj_name=OBJECT):
    obj = bpy.data.objects[obj_name]
    keys = obj.data.shape_keys
    blocks = list(keys.key_blocks) if keys else []
    saved = [(k, k.value) for k in blocks]
    for k in blocks:
        k.value = 0.0
    base = evaluated_copy(obj)
    states = []
    for k in blocks[1:]:
        if not k.name.startswith("state:"):
            continue
        k.value = 1.0
        m = evaluated_copy(obj)
        co = np.empty(len(m.vertices) * 3)
        m.vertices.foreach_get("co", co)
        if len(m.vertices) != len(base.vertices):
            raise RuntimeError("state %s changes the topology" % k.name)
        states.append((k.name, co))
        bpy.data.meshes.remove(m)
        k.value = 0.0
    for k, v in saved:
        k.value = v

    out = bpy.data.objects.new(obj_name + ".export", base)
    bpy.context.scene.collection.objects.link(out)
    if states:
        out.shape_key_add(name="Basis", from_mix=False)
        for name, co in states:
            sk = out.shape_key_add(name=name, from_mix=False)
            sk.data.foreach_set("co", co)
    base.polygons.foreach_set("use_smooth", [True] * len(base.polygons))

    # Landmarks ride on the surface: snap each onto the sculpture for the export.
    # (From the base mesh itself: evaluating the object could apply a state.)
    from mathutils.bvhtree import BVHTree
    tree = BVHTree.FromPolygons([v.co.copy() for v in base.vertices], [tuple(p.vertices) for p in base.polygons])
    moved = []
    for o in bpy.context.scene.objects:
        if o.name.startswith("landmark:"):
            hit = tree.find_nearest(o.location)
            if hit[0] is not None:
                moved.append((o, o.location.copy()))
                o.location = hit[0]
    for o in bpy.context.scene.objects:
        o.select_set(o is out or o.name.startswith("landmark:"))
    bpy.context.view_layer.objects.active = out
    opts = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=False,
                export_extras=True, export_morph=True, export_morph_normal=False, export_normals=True,
                export_texcoords=False, export_materials='EXPORT', export_yup=True,
                export_animations=False)
    props = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
    if "export_vertex_color" in props:
        opts["export_vertex_color"] = 'NONE'
    bpy.ops.export_scene.gltf(**{k: v for k, v in opts.items() if k in props})
    for o, loc in moved:
        o.location = loc
    bpy.data.objects.remove(out)
    bpy.data.meshes.remove(base)
    return path


if __name__ == "__main__":
    here = bpy.data.filepath or ""
    target = os.path.splitext(here)[0] + ".glb" if here else None
    if "--" in sys.argv:
        args = sys.argv[sys.argv.index("--") + 1:]
        if args:
            target = args[0]
    if not target:
        raise SystemExit("export_glb: save the .blend first, or pass -- <path.glb>")
    print("exported", export(target))
