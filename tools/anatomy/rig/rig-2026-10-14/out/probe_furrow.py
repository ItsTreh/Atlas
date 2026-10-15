import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts")); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C, sections as S
C.guard()
obj = bpy.data.objects["Mesh_0"]; me = obj.data
P = C.mesh_world(obj)
ev = np.empty(len(me.edges) * 2, np.int64); me.edges.foreach_get("vertices", ev); ev = ev.reshape(-1, 2)
ls, lt, lv = C.faces(me); le = np.empty(len(me.loops), np.int64); me.loops.foreach_get("edge_index", le)
M = S.Mesh(P, ev, ls, lt, lv, le)
print(" z     furrow x   depth mm   front-midline-ish (linea) x   torso section centroid x")
for z in np.arange(0.24, 0.90, 0.03):
    l = M.loop_at(np.array([0, 0, z]), np.array([0, 0, 1.0]), np.array([0.0, 0.0, z]), radius=0.5)
    Q = l["points"]
    back = Q[(Q[:, 1] > l["centroid"][1]) & (np.abs(Q[:, 0]) < 0.16)]
    xs = np.arange(-0.15, 0.151, 0.004); yb = []
    for x in xs:
        q = back[np.abs(back[:, 0] - x) < 0.004]; yb.append(q[:, 1].max() if len(q) else np.nan)
    yb = np.array(yb)
    ok = ~np.isnan(yb)
    ys = np.convolve(np.nan_to_num(yb, nan=np.nanmin(yb)), np.ones(3) / 3, mode="same")
    # furrow: the deepest dip relative to the line between the highest points on each side
    best = None
    for i in range(3, len(xs) - 3):
        if not ok[i]: continue
        lm = np.nanmax(ys[max(0, i - 15):i]); rm = np.nanmax(ys[i + 1:i + 16])
        dip = min(lm, rm) - ys[i]
        if best is None or dip > best[0]: best = (dip, xs[i])
    front = Q[(Q[:, 1] < l["centroid"][1]) & (np.abs(Q[:, 0]) < 0.12)]
    print("%.2f   %+.3f   %5.1f    centroid %+.3f" % (z, best[1], best[0] * 1e3, l["centroid"][0]))
