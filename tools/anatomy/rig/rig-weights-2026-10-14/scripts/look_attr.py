"""Sheet of one colour attribute from fixed views.
  Blender -b <blend> --python look_attr.py -- <attr> <out.png> [views]"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C, viz as V
a = sys.argv[sys.argv.index("--") + 1:]
attr, out = a[0], a[1]; which = a[2].split(",") if len(a) > 2 else None
obj = bpy.data.objects["Mesh_0"]; me = obj.data
for o in bpy.data.objects:
    if o.type == 'ARMATURE': o.hide_render = True
me.color_attributes.active_color = me.color_attributes[attr]
VIEWS = {"front": ((0, -0.02, -0.01), (0, -1, 0), 2.0), "back": ((0, -0.02, -0.01), (0, 1, 0), 2.0),
         "right": ((0, -0.02, -0.01), (-1, 0, 0), 2.0), "left": ((0, -0.02, -0.01), (1, 0, 0), 2.0),
         "armR_front": ((-0.255, 0.02, 0.63), (-0.30, -1.0, -0.08), 0.5), "armR_back": ((-0.255, 0.02, 0.63), (-0.30, 1.0, -0.08), 0.5),
         "armR_under": ((-0.255, 0.02, 0.63), (-1.0, -0.12, -0.75), 0.42), "armL_under": ((0.22, 0.05, 0.6), (1.0, -0.12, -0.75), 0.42),
         "handR": ((-0.29, -0.15, 0.0), (-0.6, -1.0, 0.0), 0.28), "handL": ((0.33, -0.05, -0.0), (0.6, -1.0, 0.0), 0.28),
         "shoulders_top": ((0, 0.02, 0.75), (0, -0.25, 1.0), 0.75)}
V.setup_workbench((560, 560))
ims, labs = [], []
for k, (t, d, s) in VIEWS.items():
    if which and k not in which: continue
    V.camera(t, d, ortho_scale=s)
    f = os.path.join(os.path.dirname(out), "_tmp_%s.png" % k)
    V.render(f, 'VERTEX'); ims.append(V.load_png(f)); labs.append(k.upper().replace("_", " ")); os.remove(f)
V.save_png(V.sheet(ims, 4, labs, header=attr.upper(), scale=3), out)
print("saved", out)
