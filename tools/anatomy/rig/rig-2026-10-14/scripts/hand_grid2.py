"""Back-of-hand views aligned to each hand's frame (right = index->pinky, up = toward the wrist), u lines every 5 mm."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from mathutils import Matrix, Vector
import common as C, viz as V
C.guard()
bpy.data.objects["Armature.001"].hide_render = True
J = {k: np.array(v) for k, v in json.load(open(os.path.join(C.SCRATCH, "out", "joints.json")))["joints"].items()}
def unit(v): return v / np.linalg.norm(v)
V.setup_workbench((800, 800)); ims, labs = [], []
for side, sx in (("R", -1), ("L", 1)):
    w, k = J["wrist." + side], J["knuckles." + side]
    Yh = unit(k - w); Wd = unit(np.array([0, 1.0, 0]) - Yh * Yh[1]); N = np.cross(Wd, Yh)
    if N[0] * sx > 0: N = -N
    c = w + 0.13 * Yh
    for view, look in (("back", N), ("palm", -N)):
        cam = V.camera(tuple(c), tuple(-look), ortho_scale=0.16)
        zc = -look                                   # camera looks along -Z: Z points from the hand to the camera
        right = Wd if view == "back" else -Wd
        up = np.cross(zc, right)
        R3 = Matrix(np.c_[right, up, zc].tolist())
        cam.matrix_world = Matrix.Translation(Vector(c + zc * 2.0)) @ R3.to_4x4()
        bpy.context.view_layer.update()
        f = os.path.join(C.SCRATCH, "renders", "grid2_%s_%s.png" % (side, view)); V.render(f, 'SINGLE')
        im = V.load_png(f)
        for uc in np.arange(-0.06, 0.0601, 0.005):
            X = C.project(cam, (800, 800), np.array([w + uc * Wd + 0.06 * Yh + 0.2 * zc, w + uc * Wd + 0.21 * Yh + 0.2 * zc]))
            col = (0.9, 0.2, 0.2) if abs(uc) < 1e-6 else ((0.3, 0.5, 0.9) if round(uc * 1000) % 10 == 0 else (0.7, 0.8, 0.95))
            C.draw_line(im, X[0], X[1], col, 0)
            if round(uc * 1000) % 10 == 0: V.text(im, "%+d" % round(uc * 100), int(X[0][0]) - 6, int(X[0][1]) - 16, 2, (0.2, 0.2, 0.6))
        ims.append(im); labs.append("%s %s OF HAND" % (side, view.upper()))
V.save_png(V.sheet(ims, 4, labs, header="HAND-ALIGNED VIEWS  U LINES EVERY 5 MM  LABELS IN CM  INDEX AT NEGATIVE U", scale=3), os.path.join(C.SCRATCH, "renders", "hand_grid2.png"))
print("done")
