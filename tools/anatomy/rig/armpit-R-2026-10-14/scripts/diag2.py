"""Where does the v2 pocket intersect the mesh at rest?  -- <pose deg>"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from collections import Counter
from mathutils.bvhtree import BVHTree
import common as C
C.guard()
deg = float(sys.argv[sys.argv.index("--") + 1]) if "--" in sys.argv else 0
obj = bpy.data.objects["Mesh_0"]; arm = bpy.data.objects["Armature.001"]; me = obj.data
C.elevate(arm, deg); co = C.evaluated_co(obj)
D = np.load(os.path.join(C.SCRATCH, "out", "repair2_debug.npz"))
nf0 = int(D["nf0"]); nv0 = int(D["nv0"])
names, pal, reg = C.palette(); px, w, h = C.paint_pixels()
freg = C.face_regions(me, px, w, h, names, pal, reg)
polys = [tuple(p.vertices) for p in me.polygons]
fc = np.array([co[list(p)].mean(0) for p in polys])
zone = np.flatnonzero((fc[:, 0] < -0.12) & (fc[:, 2] > 0.40) & (fc[:, 2] < 0.85))
sub = [polys[i] for i in zone]
_, canon = np.unique(np.round(co / 1e-6).astype(np.int64), axis=0, return_inverse=True); canon = canon.ravel()
t = BVHTree.FromPolygons([tuple(p) for p in co], sub)
kinds = Counter(); where = []
for i, j in t.overlap(t):
    if i >= j or set(canon[list(sub[i])]) & set(canon[list(sub[j])]): continue
    fi, fj = zone[i], zone[j]
    pa, pb = fi >= nf0, fj >= nf0
    k = "pocket-pocket" if pa and pb else "pocket-old" if pa or pb else "old-old"
    kinds[k] += 1
    where.append((k, fc[fi], fc[fj], freg[fi], freg[fj], fi, fj))
print("pose %g: intersections" % deg, dict(kinds))
for k in ("pocket-old", "pocket-pocket", "old-old"):
    rows = [r for r in where if r[0] == k]
    if not rows: continue
    P = np.array([r[1] for r in rows])
    print("  %s: %d; first face centre z %.3f..%.3f, y %.3f..%.3f, x %.3f..%.3f" % (k, len(rows), P[:, 2].min(), P[:, 2].max(), P[:, 1].min(), P[:, 1].max(), P[:, 0].min(), P[:, 0].max()))
    print("     paint pairs:", Counter((r[3], r[4]) for r in rows).most_common(5))
    # do the pocket faces touching this sit on the zip strip (they touch a cut vertex)?
    if k != "old-old":
        cutv = set(range(nv0, nv0 + 10**6))
        ring = set(np.flatnonzero(np.array([len(me.vertices[v].link_edges) if False else 0 for v in []])))
# pocket faces near the cut: share a vertex with an old face?
old_verts = set()
for p in polys[:nf0]: old_verts.update(p)
rowsP = [r for r in where if r[0] != "old-old"]
zip_like = sum(1 for r in rowsP for f in (r[5], r[6]) if f >= nf0 and set(polys[f]) & old_verts)
print("  pocket faces in these pairs that touch the cut (zip strip):", zip_like, "of", sum(1 for r in rowsP for f in (r[5], r[6]) if f >= nf0))
C.rest_pose(arm)

# classify pocket faces: ribbon (touches an old vertex), zip (touches a ribbon vertex), grid
oldv = set()
for p in polys[:nf0]: oldv.update(p)
ribbon_f = [f for f in range(nf0, len(polys)) if set(polys[f]) & oldv]
ribv = set(v for f in ribbon_f for v in polys[f]) - oldv
def kind(f):
    if f < nf0: return "old"
    s_ = set(polys[f])
    return "ribbon" if s_ & oldv else ("zip" if s_ & ribv else "grid")
print("  pairs by part:", Counter(tuple(sorted((kind(r[5]), kind(r[6])))) for r in where).most_common(8))

# grid-grid pairs: same wall or opposite walls (by which half of the UV island), and how far from F / B
uvl = np.empty(len(me.loops) * 2); me.uv_layers["Paint"].data.foreach_get("uv", uvl); uvl = uvl.reshape(-1, 2)
fls = np.empty(len(polys), np.int64); me.polygons.foreach_get("loop_start", fls)
pocket_uv = uvl[fls[nf0]:]
ymid = 0.5 * (pocket_uv[:, 1].min() + pocket_uv[:, 1].max())
def wall(f):
    return "arm" if uvl[fls[f], 1] < ymid else "chest"
ring = D["ring"]; Fp, Bp = ring[0], ring[-1]
gg = [r for r in where if kind(r[5]) not in ("old",) and kind(r[6]) not in ("old",)]
print("  pocket-pocket by walls:", Counter(tuple(sorted((wall(r[5]), wall(r[6])))) for r in gg))
dF = np.array([min(np.linalg.norm(r[1] - Fp), np.linalg.norm(r[1] - Bp)) for r in gg])
if len(dF):
    print("  distance to F or B: <5mm %d, 5-20mm %d, >20mm %d" % ((dF < .005).sum(), ((dF >= .005) & (dF < .02)).sum(), (dF >= .02).sum()))
    far = [r for r, d in zip(gg, dF) if d >= .02]
    if far:
        P = np.array([r[1] for r in far]); print("  far ones: z %.3f..%.3f y %.3f..%.3f" % (P[:, 2].min(), P[:, 2].max(), P[:, 1].min(), P[:, 1].max()))

# where on the patch: (s, w) recovered from the island UVs
ux0, ux1 = pocket_uv[:, 0].min(), pocket_uv[:, 0].max(); uy0, uy1 = pocket_uv[:, 1].min(), pocket_uv[:, 1].max()
def sw(f):
    uv_ = uvl[fls[f]:fls[f] + len(polys[f])].mean(0)
    w_ = (uv_[0] - ux0) / (ux1 - ux0); y_ = (uv_[1] - uy0) / (uy1 - uy0)
    return (2 * y_ if y_ < 0.5 else 2 * (1 - y_)), w_
SW = np.array([sw(f) for r in gg for f in (r[5], r[6])])
if len(SW):
    print("  s (0 crotch .. 1 dome) histogram:", np.histogram(SW[:, 0], bins=10, range=(0, 1))[0].tolist())
    print("  w (0 front .. 1 back) histogram:", np.histogram(SW[:, 1], bins=10, range=(0, 1))[0].tolist())
