import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from collections import Counter
import common as C
obj = bpy.data.objects["Mesh_0"]; me = obj.data
co = C.mesh_world(obj); fr = C.face_regions(me); vr = C.vertex_regions(me, fr)
Z = np.load(os.path.join(C.SCRATCH, "out", "weights_repaired_h070.npz")); Wm = Z["W"]; n = list(Z["names"])
tl, tr, pel = Wm[:, n.index("thigh.L")], Wm[:, n.index("thigh.R")], Wm[:, n.index("pelvis")] + Wm[:, n.index("spine_01")]
for reg in ("adductor-longus.L", "gracilis.L", "adductor-longus.R", "adductor-magnus.R"):
    m = vr == reg
    print("%-18s n=%5d  thigh.L %.2f  thigh.R %.2f  pelvis+spine01 %.2f  (means); verts with thigh.R>0.2: %d" % (reg, m.sum(), tl[m].mean(), tr[m].mean(), pel[m].mean(), int((m & (tr > 0.2)).sum())) if reg.endswith("L") else
          "%-18s n=%5d  thigh.L %.2f  thigh.R %.2f  pelvis+spine01 %.2f  (means); verts with thigh.L>0.2: %d" % (reg, m.sum(), tl[m].mean(), tr[m].mean(), pel[m].mean(), int((m & (tl > 0.2)).sum())))
# does the left and right inner thigh skin touch? gap between left-labelled and right-labelled skin near the crotch
L = np.flatnonzero((tl > 0.5) & (np.abs(co[:, 0]) < 0.08) & (co[:, 2] < 0.2) & (co[:, 2] > -0.1))
R = np.flatnonzero((tr > 0.5) & (np.abs(co[:, 0]) < 0.08) & (co[:, 2] < 0.2) & (co[:, 2] > -0.1))
from mathutils.kdtree import KDTree
kd = KDTree(len(R))
for k, v in enumerate(R): kd.insert(co[v], k)
kd.balance()
d = np.array([kd.find(co[v])[2] for v in L])
print("left-thigh skin to nearest right-thigh skin near the crotch: min %.1f mm, p5 %.1f mm; vertices within 4 mm: %d" % (d.min() * 1e3, np.percentile(d, 5) * 1e3, int((d < 0.004).sum())))
# edges joining a thigh.L-majority vertex directly to a thigh.R-majority vertex
ev = C.edges(me); a, b = ev[:, 0], ev[:, 1]
lab = np.argmax(np.c_[tl, tr, pel], 1)
cross = ((lab[a] == 0) & (lab[b] == 1)) | ((lab[a] == 1) & (lab[b] == 0))
print("mesh edges joining left-thigh to right-thigh skin:", int(cross.sum()), "at z", np.percentile(co[a[cross], 2], [5, 50, 95]).round(3) if cross.any() else "-")
