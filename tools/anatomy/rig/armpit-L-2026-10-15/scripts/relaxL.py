"""Rest-pose clean-up of the left pocket walls: no new face may cross the skin at rest.
  Blender -b build/<in>.blend --python scripts/relaxL.py -- <out name>
Only the pocket's own new vertices move (walls, ribbon, dome); the cut's copies, F, B and
every existing vertex stay where they are. Per iteration:
  - outside: a wall vertex outside the body (ray parity against the existing skin, which is
    closed but for the zero-width cut) is put back 0.6 mm inside, below the nearest skin point;
  - crossing: the vertices of wall faces that cross existing skin or each other move halfway to
    the mean of their pocket neighbours (a local Laplacian step), and so do their neighbours, lightly.
Stops when nothing crosses, or after 25 iterations; keeps the iteration with the fewest
crossings (the earliest of equals), so the walls don't drift while the count plateaus."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import common as C
C.guard()
NAME = sys.argv[sys.argv.index("--") + 1]
obj = bpy.data.objects["Mesh_0"]; me = obj.data
co = C.mesh_co(me); nv = len(co); tri = C.triangles(me); NFB = 297459
S = np.load(os.path.join(C.SCRATCH, "out", "sets_L.npz"))
mov = np.zeros(nv, bool); mov[S["wall_arm"]] = True; mov[S["wall_chest"]] = True; mov[S["dome"]] = True
pk = tri[:, 3] >= NFB
cen = co[tri[:, :3]].mean(1)
zone = np.flatnonzero((cen[:, 0] > 0.12) & (cen[:, 2] > 0.40) & (cen[:, 2] < 0.85))
skin = tri[~pk, :3]
bvh_skin = BVHTree.FromPolygons([tuple(p) for p in co], [tuple(t) for t in skin], all_triangles=True)
# pocket adjacency (edges among pocket faces)
nb = [set() for _ in range(nv)]
for t in tri[pk, :3]:
    for i in range(3):
        a, b = t[i], t[(i + 1) % 3]; nb[a].add(b); nb[b].add(a)
def inside(p):
    votes = 0
    for d in (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, -1)), Vector((0.57735, -0.57735, 0.57735))):
        o = Vector(p); n = 0
        while True:
            hh = bvh_skin.ray_cast(o, d)
            if hh[0] is None: break
            n += 1; o = hh[0] + d * 1e-6
        votes += n % 2
    return votes >= 3
def crossings(X):
    zp = [tuple(t) for t in tri[zone, :3]]
    t_ = BVHTree.FromPolygons([tuple(p) for p in X], zp, all_triangles=True)
    _, canon = np.unique(np.round(X / 1e-6).astype(np.int64), axis=0, return_inverse=True); canon = canon.ravel()
    out = []
    for i, j in t_.overlap(t_):
        if i < j and (pk[zone[i]] or pk[zone[j]]) and not set(canon[list(zp[i])]) & set(canon[list(zp[j])]):
            out.append((zone[i], zone[j]))
    return out
X = co.copy()
idx_mov = np.flatnonzero(mov)
log = []; best = (10 ** 9, None, -1)
for it in range(25):
    hits = crossings(X)
    out_v = [v for v in idx_mov if not inside(X[v])]
    log.append((it, len(hits), len(out_v)))
    if not out_v and len(hits) < best[0]: best = (len(hits), X.copy(), it)
    print("iteration %2d: %d crossing pairs, %d wall vertices outside" % (it, len(hits), len(out_v)), flush=True)
    if not hits and not out_v: break
    for v in out_v:
        loc, n, fi, d = bvh_skin.find_nearest(Vector(X[v]))
        X[v] = np.array(loc) - np.array(n) * 0.0006
    bad = set()
    for a, b in hits:
        for f in (a, b):
            if pk[f]: bad |= set(int(v) for v in tri[f, :3] if mov[v])
    ring = set()
    for v in bad: ring |= set(o for o in nb[v] if mov[o])
    ring -= bad
    for group, k in ((bad, 0.5), (ring, 0.25)):
        upd = {}
        for v in group:
            if nb[v]: upd[v] = (1 - k) * X[v] + k * X[list(nb[v])].mean(0)
        for v, p in upd.items(): X[v] = p
print("kept iteration %d (%d crossing pairs)" % (best[2], best[0]))
X = best[1]
moved = np.linalg.norm(X - co, axis=1)
print("moved %d vertices; median %.2f max %.2f mm; existing vertices moved: %d" % ((moved > 0).sum(), np.median(moved[moved > 0]) * 1e3 if (moved > 0).any() else 0, moved.max() * 1e3, int((moved[:153898] > 0).sum())))
assert (moved[~mov] == 0).all()
me.vertices.foreach_set("co", X.ravel()); me.update()
json.dump(dict(kept_iteration=best[2], kept_crossings=best[0], log=log, moved=int((moved > 0).sum()), moved_max_mm=float(moved.max() * 1e3)), open(os.path.join(C.SCRATCH, "out", "relax_%s.json" % NAME), "w"))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(C.SCRATCH, "build", NAME + ".blend"), check_existing=False, compress=True)
print("saved", NAME)
