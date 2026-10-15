"""Magnified sections through the right armpit's notch: old faces in their
paint, pocket faces blue, faces that intersect anything red.
  Blender -b <scratch .blend> --python look2.py -- <tag> [pose_deg]"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from mathutils.bvhtree import BVHTree
import common as C, viz as V
C.guard()
args = sys.argv[sys.argv.index("--") + 1:]
tag = args[0]; deg = float(args[1]) if len(args) > 1 else 0.0
obj = bpy.data.objects["Mesh_0"]; arm = bpy.data.objects["Armature.001"]; me = obj.data
C.elevate(arm, deg); co = C.evaluated_co(obj)
_, ev = C.mesh_arrays(me)
nf0 = 287219
names, pal, reg = C.palette(); px, w, h = C.paint_pixels()
uv = np.empty(len(me.loops) * 2); me.uv_layers["Paint"].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
cc = px[np.clip((uv[:, 1] * h).astype(int), 0, h - 1), np.clip((uv[:, 0] * w).astype(int), 0, w - 1)]
le = np.empty(len(me.loops), np.int64); me.loops.foreach_get("edge_index", le)
nf = len(me.polygons)
ls = np.empty(nf, np.int64); me.polygons.foreach_get("loop_start", ls)
lt = np.empty(nf, np.int64); me.polygons.foreach_get("loop_total", lt)
fcol = np.add.reduceat(cc, ls, axis=0) / lt[:, None]
fcol[fcol.min(1) > 0.97] = 0.6
fcol[nf0:] = (0.15, 0.35, 0.95)
polys = [tuple(p.vertices) for p in me.polygons]
fc = np.array([co[list(p)].mean(0) for p in polys])
zone = np.flatnonzero((fc[:, 0] < -0.12) & (fc[:, 2] > 0.40) & (fc[:, 2] < 0.85))
sub = [polys[i] for i in zone]
_, canon = np.unique(np.round(co / 1e-6).astype(np.int64), axis=0, return_inverse=True); canon = canon.ravel()
t = BVHTree.FromPolygons([tuple(p) for p in co], sub)
bad = set()
for i, j in t.overlap(t):
    if i < j and not set(canon[list(sub[i])]) & set(canon[list(sub[j])]):
        bad.add(zone[i]); bad.add(zone[j])
for f in bad: fcol[f] = (1, 0, 0)
ZS = [float(x) for x in args[2].split(",")] if len(args) > 2 else [0.535, 0.55, 0.57, 0.59, 0.61, 0.63, 0.645, 0.655, 0.665, 0.675]
X0, X1, Y0, Y1, N = -0.275, -0.195, -0.06, 0.10, 300
Y1 = Y0 + (X1 - X0) * 2
a, b = ev[:, 0], ev[:, 1]
panels, labels = [], []
for z in ZS:
    cv = np.ones((2 * N, N, 3), np.float32)
    cross = (co[a, 2] - z) * (co[b, 2] - z) < 0
    tt = (z - co[a, 2]) / np.where(cross, co[b, 2] - co[a, 2], 1)
    pt = co[a] + tt[:, None] * (co[b] - co[a])
    for f in np.flatnonzero(np.add.reduceat(cross[le].astype(int), ls) == 2):
        es = [e for e in le[ls[f]:ls[f] + lt[f]] if cross[e]]
        p, q = pt[es[0]], pt[es[1]]
        for s in np.linspace(0, 1, 12):
            r = p + s * (q - p)
            i = int((r[1] - Y0) / (Y1 - Y0) * 2 * N); j = int((r[0] - X0) / (X1 - X0) * N)
            if 0 <= i < 2 * N and 0 <= j < N:
                cv[i, j] = fcol[f]
                if f >= nf0 or f in bad:
                    cv[max(0, i - 1):i + 2, max(0, j - 1):j + 2] = fcol[f]
    sb = int(0.01 / (X1 - X0) * N); cv[2 * N - 8:2 * N - 6, 6:6 + sb] = 0
    panels.append(cv); labels.append("Z %.3f" % z)
V.save_png(V.sheet(panels, 5, labels, header="%s %gDEG NOTCH SECTIONS  BLUE POCKET  RED INTERSECTING  BAR 1CM  FRONT UP" % (tag.upper(), deg), scale=2),
           os.path.join(C.SCRATCH, "out", "notch_%s_%d.png" % (tag, deg)))
print("intersecting faces", len(bad), "pocket", sum(1 for f in bad if f >= nf0))
