"""Renders of one scratch copy at 0/30/60/90 degrees of right-arm elevation,
from fixed orthographic cameras: clay, stretch heat and paint.
  Blender -b <scratch .blend> --python render.py -- <tag>"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C, viz as V
C.guard()
tag = sys.argv[sys.argv.index("--") + 1]
OUT = os.path.join(C.SCRATCH, "renders", tag); os.makedirs(OUT, exist_ok=True)
obj = bpy.data.objects["Mesh_0"]; arm = bpy.data.objects["Armature.001"]; me = obj.data
C.rest_pose(arm)
nl, nf = len(me.loops), len(me.polygons)
ls = np.empty(nf, np.int64); me.polygons.foreach_get("loop_start", ls)
lt = np.empty(nf, np.int64); me.polygons.foreach_get("loop_total", lt)
lv = np.empty(nl, np.int64); me.loops.foreach_get("vertex_index", lv)
face_of_loop = np.repeat(np.arange(nf), lt)

def poly_area(P):
    a = np.zeros(nf)
    for k in range(1, lt.max() - 1):
        m = lt > k + 1
        i0, i1, i2 = lv[ls[m]], lv[ls[m] + k], lv[ls[m] + k + 1]
        a[m] += 0.5 * np.linalg.norm(np.cross(P[i1] - P[i0], P[i2] - P[i0]), axis=1)
    return a
A0 = poly_area(C.evaluated_co(obj))

# paint colours per corner
px, w, h = C.paint_pixels()
uv = np.empty(nl * 2); me.uv_layers["Paint"].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
pc = np.ones((nl, 4), np.float32)
pc[:, :3] = px[np.clip((uv[:, 1] * h).astype(int), 0, h - 1), np.clip((uv[:, 0] * w).astype(int), 0, w - 1)]
paint_attr = me.color_attributes.new("PaintView", 'BYTE_COLOR', 'CORNER'); paint_attr.data.foreach_set("color", pc.ravel())
heat_attr = me.color_attributes.new("Heat", 'BYTE_COLOR', 'CORNER')

def heat_colours(ratio):
    """Area ratio -> colour: 1 grey, 2 yellow, 4 orange, >=10 red; <0.5 blue."""
    g = np.array([0.80, 0.79, 0.77]); y = np.array([0.98, 0.85, 0.25]); o = np.array([0.97, 0.50, 0.12]); r = np.array([0.80, 0.08, 0.08]); b = np.array([0.25, 0.45, 0.90])
    L = np.log2(np.clip(ratio, 1e-3, 1e3))
    c = np.tile(g, (len(ratio), 1))
    t = np.clip(L / 1.0, 0, 1)[:, None]; c = np.where((L > 0)[:, None], g + t * (y - g), c)
    t = np.clip(L - 1.0, 0, 1)[:, None]; c = np.where((L > 1)[:, None], y + t * (o - y), c)
    t = np.clip((L - 2.0) / 1.32, 0, 1)[:, None]; c = np.where((L > 2)[:, None], o + t * (r - o), c)
    t = np.clip(-L - 1.0, 0, 1)[:, None]; c = np.where((L < -1)[:, None], g + t * (b - g), c)
    return c

V.setup_workbench((560, 560))
bpy.context.scene.display.shading.show_specular_highlight = True
target = (-0.255, 0.02, 0.63)
VIEWS = {"front": ((-0.30, -1.0, -0.08), 0.50), "back": ((-0.30, 1.0, -0.08), 0.50), "under": ((-1.0, -0.12, -0.75), 0.42)}
for deg in (0, 30, 60, 90):
    C.elevate(arm, deg)
    P = C.evaluated_co(obj)
    ratio = poly_area(P) / np.maximum(A0, 1e-14)
    hc = np.ones((nl, 4), np.float32); hc[:, :3] = heat_colours(ratio)[face_of_loop]
    heat_attr.data.foreach_set("color", hc.ravel())
    for view, (d, scale) in VIEWS.items():
        V.camera(target, d, ortho_scale=scale)
        V.render(os.path.join(OUT, "clay_%s_%02d.png" % (view, deg)), 'SINGLE')
        me.color_attributes.active_color = heat_attr
        V.render(os.path.join(OUT, "heat_%s_%02d.png" % (view, deg)), 'VERTEX')
        if deg in (0, 90):
            me.color_attributes.active_color = paint_attr
            V.render(os.path.join(OUT, "paint_%s_%02d.png" % (view, deg)), 'VERTEX')
C.rest_pose(arm)
print("rendered", tag)
