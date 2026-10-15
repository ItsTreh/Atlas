"""Read-only: arm paint (biceps/triceps/coracobrachialis) that lies on the chest side of the left cut,
and chest paint (latissimus) on the arm side: connected patches touching the cut, their area and reach."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np, heapq
import common as C
obj = bpy.data.objects["Mesh_0"]; me = obj.data
co = C.mesh_co(me); ls, lt, lv = C.faces(me); nf = len(ls); fol = np.repeat(np.arange(nf), lt)
S = np.load(os.path.join(C.SCRATCH, "out", "sets_L.npz")); nf0 = int(S["nf_before"])
freg = C.face_regions(me); base = np.array([r.split(".")[0] for r in freg])
# face adjacency over shared edges (original faces only)
ed = {}
for f in range(nf0):
    vs = lv[ls[f]:ls[f] + lt[f]]
    for a, b in zip(vs, np.roll(vs, -1)): ed.setdefault((min(a, b), max(a, b)), []).append(f)
adj = [[] for _ in range(nf0)]
for fs in ed.values():
    if len(fs) == 2: adj[fs[0]].append(fs[1]); adj[fs[1]].append(fs[0])
fc = np.add.reduceat(co[lv], ls, axis=0)[:nf0] / lt[:nf0, None]
def area(f):
    vs = co[lv[ls[f]:ls[f] + lt[f]]]; return 0.5 * np.linalg.norm(sum(np.cross(vs[k] - vs[0], vs[k + 1] - vs[0]) for k in range(1, len(vs) - 1)))
for copy, want in (("cut_chest", ("biceps-brachii", "triceps-brachii", "coracobrachialis")), ("cut_arm", ("latissimus-dorsi", "teres-major", "serratus-anterior"))):
    cv = set(S[copy].tolist())
    seeds = [f for f in np.unique(fol[np.isin(lv, list(cv))]) if f < nf0 and base[f] in want]
    seen = set(seeds); st = list(seeds)
    while st:
        f = st.pop()
        for g in adj[f]:
            if g not in seen and base[g] in want and base[g] == base[f]: seen.add(g); st.append(g)
    fs = np.array(sorted(seen))
    from mathutils.kdtree import KDTree
    kd = KDTree(len(cv)); [kd.insert(co[v], i) for i, v in enumerate(cv)]; kd.balance()
    d = np.array([kd.find(fc[f])[2] for f in fs]) if len(fs) else np.zeros(1)
    for r in want:
        m = base[fs] == r if len(fs) else np.zeros(0, bool)
        if m.any():
            print("%s side: %-18s %5d faces, %.1f cm2, distance from cut median %.1f / p90 %.1f / max %.1f mm, z %.3f..%.3f" % (
                copy, r, m.sum(), sum(area(f) for f in fs[m]) * 1e4, np.median(d[m]) * 1e3, np.percentile(d[m], 90) * 1e3, d[m].max() * 1e3, fc[fs[m], 2].min(), fc[fs[m], 2].max()))
