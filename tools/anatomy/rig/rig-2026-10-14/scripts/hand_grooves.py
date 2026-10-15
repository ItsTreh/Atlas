import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C
C.guard()
P = C.mesh_world(bpy.data.objects["Mesh_0"])
J = json.load(open(os.path.join(C.SCRATCH, "out", "joints.json")))["joints"]
def unit(v): return v / np.linalg.norm(v)
def upper_hull(x, y):
    pts = sorted(zip(x, y)); H = []
    for p in pts:
        while len(H) >= 2 and (H[-1][0] - H[-2][0]) * (p[1] - H[-2][1]) - (H[-1][1] - H[-2][1]) * (p[0] - H[-2][0]) >= 0: H.pop()
        H.append(p)
    H = np.array(H); return np.interp(x, H[:, 0], H[:, 1])
for side, sx in (("R", -1), ("L", 1)):
    w, k = np.array(J["wrist." + side]), np.array(J["knuckles." + side])
    Yh = unit(k - w); Wd = unit(np.array([0, 1.0, 0]) - Yh * Yh[1]); N = np.cross(Wd, Yh)
    if N[0] * sx > 0: N = -N
    rel = P - w; u, v, n = rel @ Wd, rel @ Yh, rel @ N
    print("==", side)
    for vv in np.arange(0.10, 0.161, 0.01):
        m = (np.abs(v - vv) < 0.002) & (np.abs(u) < 0.08) & (n > -0.06) & (n < 0.02)
        us = np.arange(-0.07, 0.0701, 0.002); hs = np.array([-n[m & (np.abs(u - x) < 0.001)].min() if (m & (np.abs(u - x) < 0.001)).any() else np.nan for x in us])
        ok = ~np.isnan(hs); us, hs = us[ok], hs[ok]
        d = upper_hull(us, hs) - hs
        s = "".join("#" if x > 0.004 else ("+" if x > 0.0015 else ("." )) for x in d)
        print("  v %.2f  u %.3f..%.3f  %s" % (vv, us[0], us[-1], s))
