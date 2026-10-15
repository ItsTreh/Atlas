import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts")); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C, sections as S
C.guard()
obj = bpy.data.objects["Mesh_0"]; me = obj.data
P = C.mesh_world(obj)
ls, lt, lv = C.faces(me); freg = C.face_regions(me); fol = np.repeat(np.arange(len(ls)), lt)
def rv(n): return np.unique(lv[np.isin(fol, np.flatnonzero(freg == n))])
es, ra = rv("erector-spinae"), rv("rectus-abdominis")
tR, tL = rv("trapezius.R"), rv("trapezius.L"); pR, pL = rv("pectoralis-major.R"), rv("pectoralis-major.L")
rhR, rhL = rv("rhomboid-major.R"), rv("rhomboid-major.L")
print(" z      erector(x mid of extent)  rectus(x mid)  trap R|L border x   pec R|L border x  rhomboid border")
for z in np.arange(0.20, 0.93, 0.04):
    def mid(vs):
        m = vs[np.abs(P[vs, 2] - z) < 0.01]
        return "%+.3f (w %.1f)" % (0.5 * (P[m, 0].min() + P[m, 0].max()), (P[m, 0].max() - P[m, 0].min()) * 100) if len(m) > 5 else "   -          "
    def border(a, b):
        ma = a[np.abs(P[a, 2] - z) < 0.01]; mb = b[np.abs(P[b, 2] - z) < 0.01]
        if len(ma) < 5 or len(mb) < 5: return "   -   "
        return "%+.3f" % (0.5 * (P[ma, 0].max() + P[mb, 0].min()))
    print("%.2f   %s   %s   %s   %s   %s" % (z, mid(es), mid(ra), border(tR, tL), border(pR, pL), border(rhR, rhL)))
print("neck top region centroid x:", np.round(P[P[:, 2] > P[:, 2].max() - 0.03].mean(0), 3))
