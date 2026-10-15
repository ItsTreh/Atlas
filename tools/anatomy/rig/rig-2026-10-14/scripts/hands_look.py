"""Close-ups of both hands (clay) from four sides, with the current rig's hand bones."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C, viz as V
C.guard()
armo = bpy.data.objects["Armature.001"]; armo.hide_render = True
J = json.load(open(os.path.join(C.SCRATCH, "out", "joints.json")))["joints"]
cur = [(np.array(armo.matrix_world @ b.head_local), np.array(armo.matrix_world @ b.tail_local)) for b in armo.data.bones]
V.setup_workbench((600, 600))
ims, labs = [], []
for side in ("R", "L"):
    c = 0.5 * (np.array(J["wrist." + side]) + np.array(J["knuckles." + side])) + np.array([0, 0, -0.03])
    sx = -1 if side == "R" else 1
    for view, d_ in (("outer", (sx, 0, 0)), ("inner", (-sx, 0, 0)), ("front", (0, -1, 0)), ("below", (0, -0.3, -1))):
        cam = V.camera(tuple(c), d_, ortho_scale=0.26); bpy.context.view_layer.update()
        f = os.path.join(C.SCRATCH, "renders", "hand_%s_%s.png" % (side, view)); V.render(f, 'SINGLE')
        im = V.load_png(f)
        for h, t in cur:
            if np.linalg.norm(h - c) < 0.2:
                a2, b2 = C.project(cam, (600, 600), np.array([h, t])); C.draw_line(im, a2, b2, (0.85, 0.2, 0.2), 1); C.draw_dot(im, a2, (0.1, 0.2, 0.9), 3)
        ims.append(im); labs.append("%s %s" % (side, view.upper()))
V.save_png(V.sheet(ims, 4, labs, header="HANDS  CURRENT RIG BONES RED", scale=3), os.path.join(C.SCRATCH, "renders", "hands.png"))
print("done")
