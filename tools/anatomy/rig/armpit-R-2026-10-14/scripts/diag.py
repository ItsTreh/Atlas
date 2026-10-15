"""Where does the pocket intersect the mesh at rest?"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from collections import Counter
from mathutils.bvhtree import BVHTree
import common as C
C.guard()
obj = bpy.data.objects["Mesh_0"]; me = obj.data
co, ev = C.mesh_arrays(me)
D = np.load(os.path.join(C.SCRATCH, "out", "repair_debug.npz"))
nf0 = int(D["nf0"]); finfo = D["faces"]; ring = D["ring"]; u = D["u"]
polys = [tuple(p.vertices) for p in me.polygons]
fc = np.array([co[list(p)].mean(0) for p in polys])
zone = np.flatnonzero((fc[:, 0] < -0.12) & (fc[:, 2] > 0.40) & (fc[:, 2] < 0.85))
sub = [polys[i] for i in zone]
t = BVHTree.FromPolygons([tuple(p) for p in co], sub)
kinds = Counter(); pk = []; partners_old = Counter()
names, pal, reg = C.palette(); px, w, h = C.paint_pixels()
freg = C.face_regions(me, px, w, h, names, pal, reg)
for i, j in t.overlap(t):
    if i >= j or set(sub[i]) & set(sub[j]): continue
    fi, fj = zone[i], zone[j]
    a, b = fi >= nf0, fj >= nf0
    kinds["pocket-pocket" if a and b else "pocket-old" if a or b else "old-old"] += 1
    for f, o in ((fi, fj), (fj, fi)):
        if f >= nf0:
            col, k, wall = finfo[f - nf0]
            pk.append((col, k, wall, o >= nf0))
            if o < nf0: partners_old[freg[o]] += 1
print("intersections at rest:", dict(kinds))
pk = np.array(pk)
if len(pk):
    print("pocket faces involved by row k (0 = lip):", dict(sorted(Counter(pk[:, 1]).items())))
    print("by wall:", dict(Counter(pk[:, 2])))
    cu = u[np.clip(pk[:, 0], 0, len(u) - 1)]
    print("by position along the cut (u, 0=F front top, 1=B back top):", dict(sorted(Counter(np.round(cu, 1)).items())))
    print("old faces hit, by paint:", partners_old.most_common(8))
# the cut itself: smoothness
seg = np.linalg.norm(np.diff(ring, axis=0), axis=1)
turn = []
for k in range(1, len(ring) - 1):
    d1, d2 = ring[k] - ring[k - 1], ring[k + 1] - ring[k]
    turn.append(np.degrees(np.arccos(np.clip(d1 @ d2 / np.linalg.norm(d1) / np.linalg.norm(d2), -1, 1))))
turn = np.array(turn)
print("cut: %d edges, length %.1f cm, edge mm median %.2f; turns >60deg: %d, >120deg: %d" % (
    len(seg), seg.sum() * 100, np.median(seg) * 1000, (turn > 60).sum(), (turn > 120).sum()))
for q in np.linspace(0, 1, 11):
    k = int(q * (len(ring) - 1)); print("   u %.2f  %s" % (u[k], np.round(ring[k], 3)))
