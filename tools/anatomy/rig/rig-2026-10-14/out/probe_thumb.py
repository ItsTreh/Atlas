import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts")); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C, sections as S
C.guard()
obj = bpy.data.objects["Mesh_0"]; me = obj.data
P = C.mesh_world(obj)
ev = np.empty(len(me.edges) * 2, np.int64); me.edges.foreach_get("vertices", ev); ev = ev.reshape(-1, 2)
ls, lt, lv = C.faces(me); le = np.empty(len(me.loops), np.int64); me.loops.foreach_get("edge_index", le)
M = S.Mesh(P, ev, ls, lt, lv, le)
J = {k: np.array(v) for k, v in json.load(open(os.path.join(C.SCRATCH, "out", "joints.json")))["joints"].items()}
def unit(v): return v / np.linalg.norm(v)
for side, sx in (("R", -1), ("L", 1)):
    w, k = J["wrist." + side], J["knuckles." + side]
    Yh = unit(k - w); Wd = unit(np.array([0, 1.0, 0]) - Yh * Yh[1]); N = np.cross(Wd, Yh)
    if N[0] * sx > 0: N = -N
    print("==", side)
    for vv in np.arange(0.06, 0.20, 0.01):
        L = M.section(w + vv * Yh, Yh, near=w + vv * Yh, radius=0.10)
        out = []
        for l in L:
            c = l["centroid"] - w
            if abs(c @ Wd) < 0.09 and -0.06 < c @ N < 0.10:
                out.append("[u %+.3f n %+.3f  %4.1f cm2]" % (c @ Wd, c @ N, l["area"] * 1e4))
        print("  v %.2f  %s" % (vv, " ".join(out)))
