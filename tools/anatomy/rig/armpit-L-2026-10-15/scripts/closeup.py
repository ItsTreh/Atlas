"""Close-up renders around one point of one arm at given elevations (clay, paint, heat).
  Blender -b <file> --python scripts/closeup.py -- <tag> L|R x y z dx dy dz scale deg1 [deg2 ...]"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C, viz as V
a = sys.argv[sys.argv.index("--") + 1:]
tag, SIDE = a[0], a[1]; tgt = tuple(map(float, a[2:5])); d = tuple(map(float, a[5:8])); sc = float(a[8]); degs = [int(x) for x in a[9:]]
OUT = os.path.join(C.SCRATCH, "renders", "close"); os.makedirs(OUT, exist_ok=True)
obj = bpy.data.objects["Mesh_0"]; me = obj.data; arm = bpy.data.objects["ATLAS_Rig"]; arm.hide_render = True
nl = len(me.loops)
px, w, h = C.paint_pixels()
uv = np.empty(nl * 2); me.uv_layers["Paint"].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
pc = np.ones((nl, 4), np.float32); pc[:, :3] = px[np.clip((uv[:, 1] * h).astype(int), 0, h - 1), np.clip((uv[:, 0] * w).astype(int), 0, w - 1)]
pa = me.color_attributes.new("PaintView", 'BYTE_COLOR', 'CORNER'); pa.data.foreach_set("color", pc.ravel())
V.setup_workbench((600, 600)); bpy.context.scene.display.shading.show_specular_highlight = True
for deg in degs:
    C.elevate(arm, deg, "upper_arm." + SIDE)
    V.camera(tgt, d, ortho_scale=sc)
    V.render(os.path.join(OUT, "%s_%s_clay_%02d.png" % (tag, SIDE, deg)), 'SINGLE')
    me.color_attributes.active_color = pa; V.render(os.path.join(OUT, "%s_%s_paint_%02d.png" % (tag, SIDE, deg)), 'VERTEX')
C.rest_pose(arm)
