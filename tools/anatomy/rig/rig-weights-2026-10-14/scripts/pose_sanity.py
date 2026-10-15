"""Sanity poses for the rest of the body (the weights cover all 58 deform bones).
  Blender -b build/<file>.blend --python scripts/pose_sanity.py -- <tag>
Each pose bends joints about their local X (the natural bend); one render per pose,
plus per-pose counts of triangles stretched >4x / >10x or crushed <0.25x.
Writes out/sanity_<tag>.json and renders/sanity_<tag>.png."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from mathutils import Quaternion
import common as C, viz as V
C.guard()
tag = sys.argv[sys.argv.index("--") + 1]
obj = bpy.data.objects["Mesh_0"]; me = obj.data; ao = bpy.data.objects["ATLAS_Rig"]; ao.hide_render = True
tri = C.triangles(me)
co = C.mesh_world(obj)
A0 = 0.5 * np.linalg.norm(np.cross(co[tri[:, 1]] - co[tri[:, 0]], co[tri[:, 2]] - co[tri[:, 0]]), axis=1)
F = ["index", "middle", "ring", "pinky"]
POSES = {
    "elbows 90": ({"forearm.L": 90, "forearm.R": 90}, ((0, -0.02, 0.35), (-1, -0.4, 0), 1.0)),
    "wrists 50, fists": (dict([("hand.L", 50), ("hand.R", 50)] + [("%s_%02d.%s" % (f, i, s), 70) for f in F for i in (1, 2, 3) for s in "LR"]
                              + [("thumb_%02d.%s" % (i, s), 30) for i in (2, 3) for s in "LR"]), ((0, -0.08, 0.02), (0, -1, 0), 0.85)),
    "hips 70, knees 90": ({"thigh.L": 70, "thigh.R": 70, "shin.L": 90, "shin.R": 90}, ((0, -0.1, -0.2), (-1, 0, 0), 1.9)),
    "spine bend 3x15": ({"spine_02": 15, "spine_03": 15, "spine_04": 15}, ((0, 0, 0.4), (-1, -0.3, 0), 1.3)),
    "elbow 140 R (close)": ({"forearm.R": 140}, ((-0.3, -0.05, 0.4), (-0.3, -1, 0), 0.45)),
    "fist R (close)": (dict([("%s_%02d.R" % (f, i), 80) for f in F for i in (1, 2, 3)] + [("thumb_%02d.R" % i, 35) for i in (2, 3)]), ((-0.3, -0.15, -0.02), (-0.5, -1, 0), 0.25)),
    "hip 90 knee 120 R (close)": ({"thigh.R": 90, "shin.R": 120}, ((-0.1, -0.2, 0.0), (-1, -0.3, 0), 0.9)),
    "toes 30, ankles 20": ({"toe.L": 30, "toe.R": 30, "foot.L": 20, "foot.R": 20}, ((0, -0.05, -0.85), (-1, -0.6, 0.2), 0.7)),
}
V.setup_workbench((520, 520)); bpy.context.scene.display.shading.show_specular_highlight = True
ims, labs, res = [], [], {}
for name, (rot, (tgt, d, sc)) in POSES.items():
    C.rest_pose(ao)
    for b, deg in rot.items(): ao.pose.bones[b].rotation_quaternion = Quaternion((1, 0, 0), np.radians(deg))
    bpy.context.view_layer.update()
    P = C.evaluated_co(obj)
    A = 0.5 * np.linalg.norm(np.cross(P[tri[:, 1]] - P[tri[:, 0]], P[tri[:, 2]] - P[tri[:, 0]]), axis=1); r = A / np.maximum(A0, 1e-14)
    res[name] = {">4x": int((r > 4).sum()), ">10x": int((r > 10).sum()), "<0.25x": int((r < 0.25).sum()), "max": round(float(r.max()), 1)}
    V.camera(tgt, d, ortho_scale=sc); f = os.path.join(C.SCRATCH, "renders", "_s.png"); V.render(f, 'SINGLE')
    ims.append(V.load_png(f)); labs.append(name.upper().replace(",", "")); os.remove(f)
    print(name, res[name], flush=True)
C.rest_pose(ao)
V.save_png(V.sheet(ims, 4, labs, header="OTHER JOINTS  NEW WEIGHTS  " + tag.upper().replace("_", " "), scale=3), os.path.join(C.SCRATCH, "renders", "sanity_%s.png" % tag))
json.dump(res, open(os.path.join(C.SCRATCH, "out", "sanity_%s.json" % tag), "w"), indent=1)
