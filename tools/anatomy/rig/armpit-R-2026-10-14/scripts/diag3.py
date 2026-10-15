"""Intersecting pairs at rest: where along the cut, and what kind of faces."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, bmesh, numpy as np
from collections import Counter
from mathutils.bvhtree import BVHTree
import common as C
C.guard()
obj = bpy.data.objects["Mesh_0"]; me = obj.data
co, _ = C.mesh_arrays(me)
D = np.load(os.path.join(C.SCRATCH, "out", "repair2_debug.npz"))
ring, U, u1, u2 = D["ring"], D["U"], float(D["u1"]), float(D["u2"])
nf0, nv0 = int(D["nf0"]), int(D["nv0"])
bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table(); bm.verts.ensure_lookup_table()
polys = [tuple(v.index for v in f.verts) for f in bm.faces]
fc = np.array([co[list(p)].mean(0) for p in polys])
zone = np.flatnonzero((fc[:, 0] < -0.12) & (fc[:, 2] > 0.40) & (fc[:, 2] < 0.85))
sub = [polys[i] for i in zone]
_, canon = np.unique(np.round(co / 1e-6).astype(np.int64), axis=0, return_inverse=True); canon = canon.ravel()
t = BVHTree.FromPolygons([tuple(p) for p in co], sub)
pairs = []
for i, j in t.overlap(t):
    if i < j and not set(canon[list(sub[i])]) & set(canon[list(sub[j])]):
        pairs.append((zone[i], zone[j]))
def u_of(p):
    k = np.argmin(np.linalg.norm(ring - p, axis=1)); return U[k], np.linalg.norm(ring[k] - p)
cut_pos = set(map(tuple, np.round(ring / 1e-6).astype(np.int64)))
def touches_cut(f):
    return any(tuple(np.round(co[v] / 1e-6).astype(np.int64)) in cut_pos for v in polys[f])
rows = []
for f, g in pairs:
    for x, y in ((f, g), (g, f)):
        if x >= nf0:
            uu, d = u_of(fc[x])
            rows.append((uu, d, "zip" if touches_cut(x) else "wall", "old" if y < nf0 else "pocket",
                         "old-touches-cut" if y < nf0 and touches_cut(y) else ""))
rows = sorted(rows)
print("pairs", len(pairs))
seg = lambda uu: "front" if uu < u1 - 0.01 else ("crotch" if uu <= u2 + 0.01 else "back")
print("by segment:", Counter(seg(r[0]) for r in rows))
print("near a corner (|u-u1|<.03 or |u-u2|<.03):", sum(1 for r in rows if abs(r[0] - u1) < .03 or abs(r[0] - u2) < .03))
print("pocket face kind:", Counter(r[2] for r in rows), " partner:", Counter(r[3] for r in rows), Counter(r[4] for r in rows))
print("distance of pocket face to the cut: median %.2f mm, max %.2f mm" % (np.median([r[1] for r in rows]) * 1000, max(r[1] for r in rows) * 1000))
print("u values (corners at %.3f, %.3f):" % (u1, u2), np.round(sorted(set(round(r[0], 3) for r in rows)), 3))
# for old partners: is the old face on the arm side or the chest side of the cut, relative to the pocket face's wall?
