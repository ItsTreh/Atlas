"""Full-body renders (front, right side, back) with the current bones drawn on top,
plus a mirror-symmetry check of the sculpture. Saves nothing to the .blend."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from mathutils.kdtree import KDTree
import common as C, viz as V
C.guard()
obj = bpy.data.objects["Mesh_0"]; arm = bpy.data.objects["Armature.001"]
P = C.mesh_world(obj)
# symmetry: distance from each vertex's mirror image (x -> -x) to the nearest vertex
kd = KDTree(len(P))
for i, p in enumerate(P): kd.insert(p, i)
kd.balance()
step = 7
d = np.array([kd.find((-P[i, 0], P[i, 1], P[i, 2]))[2] for i in range(0, len(P), step)])
z = P[::step, 2]
print("mirror symmetry (every %dth vertex): median %.1f mm, 90th pct %.1f mm, 99th %.1f mm, max %.1f mm" % (
    step, np.median(d) * 1e3, np.percentile(d, 90) * 1e3, np.percentile(d, 99) * 1e3, d.max() * 1e3))
for lo, hi, nm in ((0.55, 0.95, "head/neck/shoulders"), (0.05, 0.55, "torso/arms"), (-0.45, 0.05, "pelvis/thighs/hands"), (-0.96, -0.45, "shins/feet")):
    m = (z >= lo) & (z < hi)
    print("   z %.2f..%.2f %-20s median %.1f mm  90th %.1f mm  max %.1f mm" % (lo, hi, nm, np.median(d[m]) * 1e3, np.percentile(d[m], 90) * 1e3, d[m].max() * 1e3))
same_topo = np.mean(d < 1e-5)
print("   vertices whose mirror lands exactly on a vertex: %.1f %%" % (100 * same_topo))
# renders
V.setup_workbench((560, 1000))
bpy.context.scene.display.shading.show_specular_highlight = False
arm.hide_render = True
bones = [(arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local, b.name) for b in arm.data.bones]
OUT = os.path.join(C.SCRATCH, "renders")
imgs = []
for view, d_ in (("front", (0, -1, 0)), ("side_right", (-1, 0, 0)), ("back", (0, 1, 0))):
    cam = V.camera((0, 0, -0.01), d_, ortho_scale=2.0)
    f = os.path.join(OUT, "body_%s.png" % view); V.render(f, 'SINGLE')
    im = V.load_png(f)
    for h, t, n in bones:
        a, b = C.project(cam, (560, 1000), np.array([h, t]))
        C.draw_line(im, a, b, (0.85, 0.1, 0.1), 1); C.draw_dot(im, a, (0.1, 0.2, 0.85), 3)
    V.save_png(im, os.path.join(OUT, "current_rig_%s.png" % view)); imgs.append(im)
V.save_png(V.sheet(imgs, 3, ["FRONT", "RIGHT SIDE", "BACK"], header="CURRENT RIG  RED BONES  BLUE HEADS", scale=3), os.path.join(OUT, "current_rig.png"))
print("rendered")
