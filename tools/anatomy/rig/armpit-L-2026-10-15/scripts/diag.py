"""Read-only diagnosis of a weighted left repair: rest crossings and flap vertices.
  Blender -b build/<file>.blend --python scripts/diag.py -- <tag>"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from collections import Counter
import common as C
tag = sys.argv[sys.argv.index("--") + 1]
obj = bpy.data.objects["Mesh_0"]; me = obj.data; arm = bpy.data.objects["ATLAS_Rig"]
co = C.mesh_world(obj); nv = len(co); tri = C.triangles(me); NFB, NVB = 297459, 153898
S = np.load(os.path.join(C.SCRATCH, "out", "sets_L.npz"))
FB = S["FB"]; ca, cc = S["cut_arm"], S["cut_chest"]
W, names = C.weights(obj); GI = {n: k for k, n in enumerate(names)}
ua = W[:, GI["upper_arm.L"]] + W[:, GI["upper_arm_twist.L"]]
freg = C.face_regions(me); vreg = C.vertex_regions(me, freg)
isarm = np.zeros(nv, bool); isarm[S["wall_arm"]] = True
from mathutils.kdtree import KDTree
def kd_of(ix):
    k = KDTree(len(ix)); [k.insert(co[v], i) for i, v in enumerate(ix)]; k.balance(); return k
kdc = kd_of(np.r_[ca, cc])
hits = np.load(os.path.join(C.SCRATCH, "out", "hits_%s_L_0.npy" % tag))
pv = []
for a, b in hits:
    for f in (a, b):
        if tri[f, 3] >= NFB: pv += list(tri[f, :3])
pv = np.unique(pv)
dF = np.linalg.norm(co[pv] - co[FB[0]], axis=1); dB = np.linalg.norm(co[pv] - co[FB[1]], axis=1)
dc = np.array([kdc.find(co[v])[2] for v in pv])
print("rest crossings: %d pairs; pocket vertices involved %d (arm wall %d); dist to F median %.1f max %.1f mm; to B min %.1f mm; to cut median %.1f max %.1f mm" % (
    len(hits), len(pv), isarm[pv].sum(), np.median(dF) * 1e3, dF.max() * 1e3, dB.min() * 1e3, np.median(dc) * 1e3, dc.max() * 1e3))
orig_faces = [tri[f if tri[f, 3] < NFB else g, 3] for f, g in hits]
print("  original faces hit:", Counter(freg[orig_faces]).most_common(5))
# flap at 30 and 90 deg (the validator's definition)
LAB = json.load(open(os.path.join(C.RIGW, "out", "label_names.json")))
TERR = np.load(os.path.join(C.SCRATCH, "out", "labels_L_v1.npy"))[:NVB] == LAB.index("upper_arm.L")
b_ = arm.data.bones["upper_arm.L"]
h0, t0_ = np.array(b_.head_local), np.array(b_.tail_local); ax0 = (t0_ - h0) / np.linalg.norm(t0_ - h0)
tt = (co - h0) @ ax0 / np.linalg.norm(t0_ - h0)
armskin = (np.arange(nv) < NVB) & (tt > 0.3) & (tt < 0.9); armskin[:NVB] &= TERR
for deg in (30, 90):
    C.elevate(arm, deg, "upper_arm.L"); P = C.evaluated_co(obj)
    pb = arm.pose.bones["upper_arm.L"]; hd = np.array(pb.head); tl = np.array(pb.tail); Lb = np.linalg.norm(tl - hd); ax = (tl - hd) / Lb
    rel = P - hd; t = rel @ ax; rad = np.linalg.norm(rel - t[:, None] * ax, axis=1)
    fl = []
    for t0 in np.arange(0.05, 0.9 * Lb, 0.01):
        sk = armskin & (t >= t0) & (t < t0 + 0.01)
        if sk.sum() < 30: continue
        ex = rad[sk] - np.median(rad[sk]); fl += list(np.flatnonzero(sk)[ex > 0.03])
    fl = np.array(fl)
    if not len(fl): print(deg, "no flap"); continue
    dFB = np.min(np.linalg.norm(co[fl][:, None] - co[FB][None], axis=2), 1)
    print("flap %d deg: %d vertices; rest x %.3f..%.3f y %.3f..%.3f z %.3f..%.3f; upper-arm weight p0/50/100 %.2f/%.2f/%.2f; dist to F/B min %.0f median %.0f mm; regions %s; in inner set %d; cut copies %d" % (
        deg, len(fl), co[fl, 0].min(), co[fl, 0].max(), co[fl, 1].min(), co[fl, 1].max(), co[fl, 2].min(), co[fl, 2].max(),
        *np.percentile(ua[fl], [0, 50, 100]), dFB.min() * 1e3, np.median(dFB) * 1e3, Counter(vreg[fl]).most_common(4),
        np.isin(fl, S["innerarm"]).sum(), np.isin(fl, ca).sum()))
    # which bones hold the rest of their weight
    other = Counter()
    for v in fl:
        for k in np.flatnonzero(W[v] > 0.02):
            if not names[k].startswith("upper_arm"): other[names[k]] += 1
    print("   other bones on them:", other.most_common(5))
C.rest_pose(arm)
