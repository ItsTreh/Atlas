import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
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
    for uc in np.arange(-0.060, 0.061, 0.004):
        SG = M.segments(w + uc * Wd, Wd, near=w + uc * Wd + 0.10 * Yh, radius=0.14).reshape(-1, 3)
        q = np.c_[(SG - w) @ Yh, (SG - w) @ N]
        q = q[(q[:, 0] > 0.11) & (q[:, 0] < 0.25) & (np.abs(q[:, 1]) < 0.09)]
        if not len(q): print("  u %+.3f  -" % uc); continue
        print("  u %+.3f  lowest v %.3f   reach to palm n %.3f   %s" % (uc, q[:, 0].max(), q[:, 1].max(), "#" * int(max(0, (q[:, 0].max() - 0.11) * 500))))
