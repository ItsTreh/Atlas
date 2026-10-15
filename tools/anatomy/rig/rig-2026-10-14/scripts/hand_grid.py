import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C, viz as V
C.guard()
bpy.data.objects["Armature.001"].hide_render = True
J = {k: np.array(v) for k, v in json.load(open(os.path.join(C.SCRATCH, "out", "joints.json")))["joints"].items()}
def unit(v): return v / np.linalg.norm(v)
V.setup_workbench((700, 700)); ims, labs = [], []
for side, sx in (("R", -1), ("L", 1)):
    w, k = J["wrist." + side], J["knuckles." + side]
    Yh = unit(k - w); Wd = unit(np.array([0, 1.0, 0]) - Yh * Yh[1]); N = np.cross(Wd, Yh)
    if N[0] * sx > 0: N = -N
    c = w + 0.12 * Yh
    for view, d_ in (("back of hand", -N), ("palm side", N), ("index side", -Wd)):
        cam = V.camera(tuple(c), tuple(d_), ortho_scale=0.22, up=tuple(-Yh)); bpy.context.view_layer.update()
        f = os.path.join(C.SCRATCH, "renders", "grid_%s_%s.png" % (side, view.split()[0])); V.render(f, 'SINGLE')
        im = V.load_png(f)
        if view != "index side":
            for uc in np.arange(-0.06, 0.061, 0.01):
                X = C.project(cam, (700, 700), np.array([w + uc * Wd + 0.05 * Yh - 0.05 * N, w + uc * Wd + 0.22 * Yh - 0.05 * N]))
                C.draw_line(im, X[0], X[1], (0.9, 0.2, 0.2) if abs(uc) < 1e-6 else (0.3, 0.5, 0.9), 0)
                V.text(im, "%+d" % round(uc * 100), int(X[0][0]) - 6, int(X[0][1]) - 18, 2, (0.2, 0.2, 0.6))
        for vv in (0.11, 0.15, 0.19):
            X = C.project(cam, (700, 700), np.array([w - 0.07 * Wd + vv * Yh - 0.05 * N, w + 0.07 * Wd + vv * Yh - 0.05 * N]))
            C.draw_line(im, X[0], X[1], (0.2, 0.7, 0.2), 0)
        ims.append(im); labs.append("%s %s" % (side, view.upper()))
V.save_png(V.sheet(ims, 3, labs, header="HAND FRAME  BLUE LINES U EVERY 1 CM (RED U 0)  GREEN V 11 15 19 CM", scale=3), os.path.join(C.SCRATCH, "renders", "hand_grid.png"))
print("done")
