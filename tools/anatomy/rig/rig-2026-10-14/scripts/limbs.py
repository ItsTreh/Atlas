"""Step 1 of the joint measurement: track each limb's centreline and print its
width/area profile, so the joint rules can be checked against the real shape.
  Blender -b original/Male_Body.blend --python scripts/limbs.py
Writes out/limbs.npz. Saves nothing to the .blend."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C, sections as S
C.guard()
obj = bpy.data.objects["Mesh_0"]; me = obj.data
P = C.mesh_world(obj)
ev = np.empty(len(me.edges) * 2, np.int64); me.edges.foreach_get("vertices", ev); ev = ev.reshape(-1, 2)
ls, lt, lv = C.faces(me)
le = np.empty(len(me.loops), np.int64); me.loops.foreach_get("edge_index", le)
M = S.Mesh(P, ev, ls, lt, lv, le)

def run(name, start, d):
    down, sd = S.track(M, start, np.array(d, float))
    up, su = S.track(M, start, -np.array(d, float))
    pts = np.vstack([up[::-1], down[1:]]); secs = su[::-1] + sd[1:]
    s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]
    print("\n== %s: %d sections, %.1f cm tracked, from %s to %s" % (name, len(pts), s[-1] * 100, np.round(pts[0], 3), np.round(pts[-1], 3)))
    rows = []
    for k, (p, l) in enumerate(zip(pts, secs)):
        # width across the limb in the world-x direction made perpendicular to the section normal
        ax = np.array([1.0, 0, 0]) - l["n"] * l["n"][0]; ax /= np.linalg.norm(ax)
        ay = np.cross(l["n"], ax)
        _, _, wx = S.extent(l, ax); _, _, wy = S.extent(l, ay)
        rows.append((s[k], p[0], p[1], p[2], l["area"] * 1e4, wx * 100, wy * 100, l["perimeter"] * 100))
    rows = np.array(rows)
    for r in rows[::2]:
        print("  s %5.1f cm  c (%6.3f %6.3f %6.3f)  area %6.1f cm2  width-x %5.1f  width-y %5.1f  perim %5.1f" % (r[0] * 100, *r[1:]))
    return rows

out = {}
for side, sx in (("R", -1), ("L", 1)):
    out["leg_" + side] = run("leg " + side, (0.10 * sx, -0.06, -0.10), (0, 0, -1))
    out["arm_" + side] = run("arm " + side, (0.31 * sx, 0.0, 0.42), (0, 0, -1))
np.savez(os.path.join(C.SCRATCH, "out", "limbs.npz"), **out)
