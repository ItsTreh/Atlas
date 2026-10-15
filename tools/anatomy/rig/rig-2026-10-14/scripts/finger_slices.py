"""Draw the outline of the hand cut by planes across it (perpendicular to the index->pinky axis), every 6 mm."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C, sections as S, viz as V
C.guard()
obj = bpy.data.objects["Mesh_0"]; me = obj.data
P = C.mesh_world(obj)
ev = np.empty(len(me.edges) * 2, np.int64); me.edges.foreach_get("vertices", ev); ev = ev.reshape(-1, 2)
ls, lt, lv = C.faces(me); le = np.empty(len(me.loops), np.int64); me.loops.foreach_get("edge_index", le)
M = S.Mesh(P, ev, ls, lt, lv, le)
J = {k: np.array(v) for k, v in json.load(open(os.path.join(C.SCRATCH, "out", "joints.json")))["joints"].items()}
def unit(v): return v / np.linalg.norm(v)
ims, labs = [], []
for side, sx in (("R", -1), ("L", 1)):
    w, k = J["wrist." + side], J["knuckles." + side]
    Yh = unit(k - w); Wd = unit(np.array([0, 1.0, 0]) - Yh * Yh[1]); N = np.cross(Wd, Yh)
    if N[0] * sx > 0: N = -N
    for uc in np.arange(-0.066, 0.067, 0.012):
        im = np.ones((300, 300, 3), np.float32)
        SG = M.segments(w + uc * Wd, Wd, near=w + uc * Wd + 0.10 * Yh, radius=0.13)
        for a3, b3 in SG:
            a2 = np.array([150 + ((a3 - w) @ N) * 1500, 20 + ((a3 - w) @ Yh) * 1300]); b2 = np.array([150 + ((b3 - w) @ N) * 1500, 20 + ((b3 - w) @ Yh) * 1300])
            if np.all((a2 > 0) & (a2 < 299)) and np.all((b2 > 0) & (b2 < 299)): C.draw_line(im, a2, b2, (0.1, 0.1, 0.1), 0)
        for vv in (0.0, 0.11):
            im[int(20 + vv * 1300), :, :] = (0.9, 0.3, 0.3)
        im[:, 150, :] = (0.6, 0.6, 0.9)
        ims.append(im); labs.append("%s U %+.3f" % (side, uc))
V.save_png(V.sheet(ims, 12, labs, header="HAND CUT ACROSS  DOWN THE HAND  PALM TO THE RIGHT  RED LINES WRIST AND KNUCKLE ROW", scale=2), os.path.join(C.SCRATCH, "renders", "finger_slices.png"))
print("done")
