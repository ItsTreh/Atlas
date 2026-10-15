"""Hand frames and the dorsal groove profile across the fingers (exploration)."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C
C.guard()
obj = bpy.data.objects["Mesh_0"]
P = C.mesh_world(obj)
J = json.load(open(os.path.join(C.SCRATCH, "out", "joints.json")))["joints"]
def unit(v): return v / np.linalg.norm(v)
for side, sx in (("R", -1), ("L", 1)):
    w, k = np.array(J["wrist." + side]), np.array(J["knuckles." + side])
    Yh = unit(k - w)
    Wd = unit(np.array([0, 1.0, 0]) - Yh * Yh[1])          # index -> pinky: toward the back
    N = np.cross(Wd, Yh)                                      # sign: make it point medially (palm side)
    if N[0] * sx > 0: N = -N
    H = np.flatnonzero(np.linalg.norm(P - (w + 0.06 * Yh), axis=1) < 0.13)
    H = H[((P[H] - w) @ Yh) > -0.01]
    rel = P[H] - w; u, v, n = rel @ Wd, rel @ Yh, rel @ N
    # exclude the thigh: points far on the palm side beyond the hand's thickness
    print("== %s  Yh %s  W %s  N(palm) %s  verts %d" % (side, np.round(Yh, 2), np.round(Wd, 2), np.round(N, 2), len(H)))
    print("   v (down the hand) range %.3f..%.3f   u range %.3f..%.3f   n range %.3f..%.3f" % (v.min(), v.max(), u.min(), u.max(), n.min(), n.max()))
    for vv in (0.09, 0.11, 0.13, 0.15):
        m = np.abs(v - vv) < 0.003
        row = []
        for uu in np.arange(-0.06, 0.061, 0.005):
            q = m & (np.abs(u - uu) < 0.0025) & (n < 0.03)
            row.append("%5.1f" % (-n[q].min() * 100) if q.any() else "   . ")
        print("   v %.2f dorsal height (cm) across u -6..6:" % vv, " ".join(row))
