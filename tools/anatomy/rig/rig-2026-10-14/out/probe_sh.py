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
for side, sx, y0 in (("R", -1, 0.006), ("L", 1, 0.044)):
    print("==", side)
    # sagittal sections through the shoulder at several x: the shoulder's top z and front/back y at a few heights
    for x in np.arange(0.18, 0.33, 0.02):
        L = M.section(np.array([sx * x, 0, 0.0]), np.array([1.0, 0, 0]))
        Q = np.vstack([l["points"] for l in L]) if L else np.zeros((0, 3))
        Q = Q[(Q[:, 2] > 0.55) & (np.abs(Q[:, 1]) < 0.35)]
        if not len(Q): continue
        top = Q[np.argmax(Q[:, 2])]
        row = []
        for z in (0.70, 0.74, 0.78):
            q = Q[np.abs(Q[:, 2] - z) < 0.004]
            row.append("z%.2f y %+.3f..%+.3f" % (z, q[:, 1].min(), q[:, 1].max()) if len(q) else "z%.2f -" % z)
        print("  x %+.2f  top z %.3f at y %+.3f | %s" % (sx * x, top[2], top[1], " | ".join(row)))
