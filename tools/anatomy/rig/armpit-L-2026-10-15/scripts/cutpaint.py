"""Read-only: the paint on each side of a cut, along it.
  Blender -b <file> --python scripts/cutpaint.py -- L|R
For every cut vertex: the region of the faces on the arm copy's side and on the chest copy's
side; printed as runs along the cut (F -> crotch -> B) with their length."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from collections import Counter
import common as C
side = sys.argv[sys.argv.index("--") + 1]
obj = bpy.data.objects["Mesh_0"]; me = obj.data
co = C.mesh_co(me); ls, lt, lv = C.faces(me); fol = np.repeat(np.arange(len(ls)), lt)
freg = C.face_regions(me)
S = np.load(os.path.join(C.SCRATCH, "out", "sets_L.npz")) if side == "L" else np.load(os.path.join(C.ARMPIT, "corrective", "out", "sets.npz"))
nf0 = int(S["nf_before"]) if side == "L" else 287219
orig = fol < (nf0 if side == "L" else 287219)
def regs(vs):
    m = np.isin(lv, vs) & orig
    out = {}
    for v, f in zip(lv[m], fol[m]): out.setdefault(int(v), Counter())[freg[f].split(".")[0]] += 1
    return out
ra, rc = regs(S["cut_arm"]), regs(S["cut_chest"])
ca, cc = S["cut_arm"], S["cut_chest"]
seq = [(ra[int(a)].most_common(1)[0][0], rc[int(c)].most_common(1)[0][0], co[a]) for a, c in zip(ca, cc)]
runs = []; L = 0
for i, (x, y, p) in enumerate(seq):
    if i and (x, y) == runs[-1][0]:
        runs[-1][1] += np.linalg.norm(p - seq[i - 1][2]); runs[-1][3] = p
    else:
        runs.append([(x, y), 0.0, p, p])
for (x, y), l, p0, p1 in runs:
    print("%-34s %5.1f mm  from z %.3f y %+.3f  to z %.3f y %+.3f" % ("arm %s | chest %s" % (x, y), l * 1e3, p0[2], p0[1], p1[2], p1[1]))
tot = Counter()
for (x, y), l, _, _ in runs: tot[(x, y)] += l
print("totals (mm):", {"%s|%s" % k: round(v * 1e3) for k, v in tot.most_common()})
