"""Read-only probe of the left armpit on the approved baseline (and the right, for comparison).
  Blender -b original/Male_Body_rigged.blend --python scripts/probe.py
Horizontal sections every 5 mm: the closed contours of the slice near each armpit, how many
there are (arm separate from the torso or fused to it), and the paint on each. Also the arm
bones of both sides and the painted regions around the left armpit."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from collections import Counter, defaultdict
import common as C
C.guard()
obj = bpy.data.objects["Mesh_0"]; me = obj.data; ao = bpy.data.objects["ATLAS_Rig"]
P = C.mesh_world(obj); nv = len(P)
tri = C.triangles(me); freg = C.face_regions(me); tr = freg[tri[:, 3]]
print("vertices", nv, "faces", len(me.polygons), "matrix_world identity:", np.allclose(np.array(obj.matrix_world), np.eye(4)))
MW = ao.matrix_world
for n in ("clavicle", "scapula", "upper_arm", "upper_arm_twist", "forearm"):
    for s in "LR":
        b = ao.data.bones[n + "." + s]
        print("%-18s head %s tail %s" % (n + "." + s, np.round(np.array(MW @ b.head_local), 4), np.round(np.array(MW @ b.tail_local), 4)))
for n in ("spine_02", "spine_03", "spine_04"):
    b = ao.data.bones[n]; print("%-18s head %s tail %s" % (n, np.round(np.array(MW @ b.head_local), 4), np.round(np.array(MW @ b.tail_local), 4)))

# painted regions near each armpit: extents
cen = P[tri[:, :3]].mean(1)
for s, sg in (("L", 1), ("R", -1)):
    print("--- side", s)
    for r in ("biceps-brachii", "triceps-brachii", "coracobrachialis", "latissimus-dorsi", "serratus-anterior", "teres-major", "pectoralis-major", "deltoid"):
        m = (tr == r + "." + s) & (sg * cen[:, 0] > 0.1) & (cen[:, 2] > 0.4) & (cen[:, 2] < 0.8)
        if m.any():
            c = cen[m]
            print("  %-22s %6d tris  x %.3f..%.3f  y %.3f..%.3f  z %.3f..%.3f" % (r, m.sum(), c[:, 0].min(), c[:, 0].max(), c[:, 1].min(), c[:, 1].max(), c[:, 2].min(), c[:, 2].max()))

def section(z, side):
    """Closed contours of the plane z, restricted to |x| > 0.08 on one side."""
    sg = 1 if side == "L" else -1
    zz = P[:, 2] - z
    a, b, c = tri[:, 0], tri[:, 1], tri[:, 2]
    s_ = np.sign(zz[tri[:, :3]]); s_[s_ == 0] = 1
    cross = ~((s_ == s_[:, :1]).all(1))
    cross &= sg * cen[:, 0] > 0.08
    segs, lab = [], []
    for t in np.flatnonzero(cross):
        vs = tri[t, :3]; pts, keys = [], []
        for i, j in ((vs[0], vs[1]), (vs[1], vs[2]), (vs[2], vs[0])):
            if (zz[i] >= 0) != (zz[j] >= 0):
                u = zz[i] / (zz[i] - zz[j]); pts.append(P[i] + u * (P[j] - P[i])); keys.append((min(i, j), max(i, j)))
        if len(keys) == 2: segs.append((keys[0], keys[1], pts[0], pts[1])); lab.append(tr[t])
    parent = {}
    def f(x):
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    for k1, k2, _, _ in segs: parent[f(k1)] = f(k2)
    groups = defaultdict(list)
    for (k1, k2, p, q), l in zip(segs, lab): groups[f(k1)].append((p, q, l))
    out = []
    for g in groups.values():
        pts = np.array([p for p, q, l in g]); L = sum(np.linalg.norm(q - p) for p, q, l in g)
        if L < 0.02: continue
        out.append(dict(n=len(g), length_cm=round(L * 100, 1), x=(round(pts[:, 0].min(), 3), round(pts[:, 0].max(), 3)),
                        y=(round(pts[:, 1].min(), 3), round(pts[:, 1].max(), 3)),
                        paint=Counter(l for _, _, l in g).most_common(5), pts=pts))
    return out

res = {}
for side in ("L", "R"):
    print("=== sections, side", side)
    for z in np.arange(0.40, 0.78, 0.005):
        cs = section(z, side)
        cs.sort(key=lambda d: -d["length_cm"])
        print("z %.3f: %d contours | " % (z, len(cs)) + " || ".join(
            "%.1fcm x%s y%s %s" % (d["length_cm"], d["x"], d["y"], ",".join("%s:%d" % (k.replace("-brachii", "").replace("-dorsi", "").replace("-anterior", ""), v) for k, v in d["paint"][:4])) for d in cs[:3]))
        res["%s_%.3f" % (side, z)] = [dict((k, v) for k, v in d.items() if k != "pts") for d in cs]
json.dump(res, open(os.path.join(C.SCRATCH, "out", "probe_sections.json"), "w"), indent=0, default=str)
