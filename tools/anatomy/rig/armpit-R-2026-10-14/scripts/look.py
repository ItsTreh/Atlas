"""Cross-sections of the right armpit coloured by paint, and a few paint
renders, of whichever scratch .blend is open. Usage:
  Blender -b <scratch .blend> --python look.py -- <tag>"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from collections import defaultdict
import common as C, viz as V
C.guard()
tag = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "x"
OUT = os.path.join(C.SCRATCH, "out")
obj = bpy.data.objects["Mesh_0"]; me = obj.data
co, ev = C.mesh_arrays(me)
names, pal, reg = C.palette(); px, w, h = C.paint_pixels()

# per-corner paint colour (nearest pixel), white = unpainted
uv = np.empty(len(me.loops) * 2); me.uv_layers["Paint"].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
cc = px[np.clip((uv[:, 1] * h).astype(int), 0, h - 1), np.clip((uv[:, 0] * w).astype(int), 0, w - 1)]
lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get("vertex_index", lv)
le = np.empty(len(me.loops), np.int64); me.loops.foreach_get("edge_index", le)
nf = len(me.polygons)
ls = np.empty(nf, np.int64); me.polygons.foreach_get("loop_start", ls)
lt = np.empty(nf, np.int64); me.polygons.foreach_get("loop_total", lt)
fcol = np.add.reduceat(cc, ls, axis=0) / lt[:, None]

# --- sections: each crossing face drawn as a segment in its paint colour
X0, X1, Y0, Y1, N = -0.40, -0.10, -0.15, 0.15, 260
panels, labels = [], []
a, b = ev[:, 0], ev[:, 1]
for z in np.arange(0.50, 0.745, 0.02):
    cv = np.ones((N, N, 3), np.float32)
    # bone axis marker for the upper arm and a 5 cm scale bar
    cross = (co[a, 2] - z) * (co[b, 2] - z) < 0
    t = (z - co[a, 2]) / np.where(cross, co[b, 2] - co[a, 2], 1)
    pt = co[a] + t[:, None] * (co[b] - co[a])
    fl = np.flatnonzero(np.add.reduceat(cross[le].astype(int), ls) == 2)
    for f in fl:
        es = [e for e in le[ls[f]:ls[f] + lt[f]] if cross[e]]
        p, q = pt[es[0]], pt[es[1]]
        col = fcol[f]
        if col.min() > 0.97: col = np.array([0.55, 0.55, 0.55])
        for s in np.linspace(0, 1, 6):
            r = p + s * (q - p)
            i = int((r[1] - Y0) / (Y1 - Y0) * N); j = int((r[0] - X0) / (X1 - X0) * N)
            if 1 <= i < N - 1 and 1 <= j < N - 1:
                cv[i - 1:i + 2, j - 1:j + 2] = col
    sb = int(0.05 / (X1 - X0) * N); cv[N - 6:N - 4, 6:6 + sb] = 0
    panels.append(cv); labels.append("Z %.2f" % z)
V.save_png(V.sheet(panels, 5, labels, header="%s RIGHT ARMPIT SECTIONS  X -0.40..-0.10  FRONT UP  BAR 5CM" % tag.upper(), scale=2),
           os.path.join(OUT, "sections_%s.png" % tag))

# --- paint renders (rest pose)
at = me.color_attributes.new("PaintView", 'BYTE_COLOR', 'CORNER')
cols = np.ones((len(me.loops), 4), np.float32); cols[:, :3] = cc
at.data.foreach_set("color", cols.ravel())
me.color_attributes.active_color = at
V.setup_workbench((640, 640))
target = (-0.25, 0.02, 0.62)
views = {"front": (-0.45, -1.0, -0.25), "back": (-0.45, 1.0, -0.25), "below": (-0.35, -0.15, -1.0)}
for k, d in views.items():
    V.camera(target, d, ortho_scale=0.42)
    V.render(os.path.join(OUT, "paint_%s_%s.png" % (tag, k)), 'VERTEX')
print("done", tag)
