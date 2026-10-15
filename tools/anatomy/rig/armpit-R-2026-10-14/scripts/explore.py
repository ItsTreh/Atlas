"""Map the right armpit's fused zone: per horizontal slice, the front and back
notches between arm and torso, and the paint around them."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from collections import Counter, defaultdict
import common as C
C.guard()
np.set_printoptions(suppress=True, precision=3)
obj = bpy.data.objects["Mesh_0"]; me = obj.data
co, ev = C.mesh_arrays(me)
names, pal, reg = C.palette(); px, w, h = C.paint_pixels()
freg = C.face_regions(me, px, w, h, names, pal, reg)
nf = len(me.polygons)
ls = np.empty(nf, np.int64); me.polygons.foreach_get("loop_start", ls)
lt = np.empty(nf, np.int64); me.polygons.foreach_get("loop_total", lt)
le = np.empty(len(me.loops), np.int64); me.loops.foreach_get("edge_index", le)
lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get("vertex_index", lv)
fc = np.add.reduceat(co[lv], ls, axis=0) / lt[:, None]


def slice_loops(z):
    a, b = ev[:, 0], ev[:, 1]
    cross = (co[a, 2] - z) * (co[b, 2] - z) < 0
    t = (z - co[a, 2]) / np.where(cross, co[b, 2] - co[a, 2], 1)
    pt = co[a] + t[:, None] * (co[b] - co[a])
    nb = defaultdict(list)
    for f in np.flatnonzero(np.add.reduceat(cross[le].astype(int), ls) == 2):
        es = [e for e in le[ls[f]:ls[f] + lt[f]] if cross[e]]
        nb[es[0]].append((es[1], f)); nb[es[1]].append((es[0], f))
    seen, loops = set(), []
    for s in nb:
        if s in seen: continue
        path, fs, cur, prev = [s], [], s, None
        seen.add(s)
        while True:
            nxt = [(e, f) for e, f in nb[cur] if e != prev and e not in seen]
            if not nxt: break
            prev, (cur, f) = cur, nxt[0]; seen.add(cur); path.append(cur); fs.append(f)
        loops.append((pt[path], np.array(fs)))
    return loops


def hull(P):
    idx = sorted(range(len(P)), key=lambda i: (P[i][0], P[i][1]))
    def cross(o, a, b): return (P[a][0]-P[o][0])*(P[b][1]-P[o][1]) - (P[a][1]-P[o][1])*(P[b][0]-P[o][0])
    lo, up = [], []
    for i in idx:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], i) <= 0: lo.pop()
        lo.append(i)
    for i in reversed(idx):
        while len(up) >= 2 and cross(up[-2], up[-1], i) <= 0: up.pop()
        up.append(i)
    return lo[:-1] + up[:-1]


print("z     | loops | front notch (x,y) depth | back notch (x,y) depth | regions at front notch / back notch (faces within 1.5 cm)")
rows = []
for z in np.arange(0.49, 0.80, 0.01):
    L = slice_loops(z)
    big = max(L, key=lambda l: len(l[0]))
    P, F = big
    arm_side = [l for l in L if l is not big and l[0][:, 0].mean() < -0.15]
    H = hull(P[:, :2])
    notches = []
    n = len(P)
    hs = set(H)
    for k in range(len(H)):
        i, j = H[k], H[(k + 1) % len(H)]
        # points strictly between i and j along the loop (the shorter way)
        seg = [(i + s) % n for s in range(1, (j - i) % n)]
        if len(seg) < 3: continue
        A, B = P[i, :2], P[j, :2]
        d = np.abs(np.cross(B - A, P[seg, :2] - A)) / max(np.linalg.norm(B - A), 1e-9)
        m = int(np.argmax(d))
        notches.append((d[m], seg[m], A, B))
    # keep notches on the right side, between arm and torso
    right = [nt for nt in notches if P[nt[1], 0] < -0.17 and P[nt[1], 0] > -0.30 and nt[0] > 0.004]
    front = [nt for nt in right if P[nt[1], 1] < 0.02]
    back = [nt for nt in right if P[nt[1], 1] >= 0.02]
    def desc(nts):
        if not nts: return None
        d, i, A, B = max(nts, key=lambda t: t[0])
        return P[i], d
    fr, bk = desc(front), desc(back)
    def near_regions(p):
        if p is None: return ""
        m = np.linalg.norm(fc - p[0], axis=1) < 0.015
        c = Counter(freg[m]); tot = sum(c.values())
        return ",".join("%s:%d%%" % (k.replace("-major", "M").replace("brachii", "b").replace("-dorsi", "D"), 100 * v // tot) for k, v in c.most_common(3))
    print("%.2f  | %d%s | %s %.1fmm | %s %.1fmm | %s / %s" % (
        z, len(L), "+arm" if arm_side else "    ",
        fr[0][:2] if fr else "-", fr[1] * 1000 if fr else 0,
        bk[0][:2] if bk else "-", bk[1] * 1000 if bk else 0,
        near_regions(fr), near_regions(bk)))

# Painted region extents on the right, near the arm
print("\nLowest/ highest z of painted faces near the right armpit (x in -0.30..-0.17):")
m = (fc[:, 0] < -0.17) & (fc[:, 0] > -0.30) & (fc[:, 2] > 0.40) & (fc[:, 2] < 0.85)
for r in ["pectoralis-major.R", "latissimus-dorsi.R", "teres-major.R", "serratus-anterior.R", "biceps-brachii.R",
          "coracobrachialis.R", "triceps-brachii.R", "deltoid.R", "infraspinatus.R", "external-oblique.R", "body"]:
    k = m & (freg == r)
    if k.any():
        print("  %-22s faces %5d  z %.3f..%.3f  x %.3f..%.3f  y %.3f..%.3f" % (r, k.sum(), fc[k, 2].min(), fc[k, 2].max(),
              fc[k, 0].min(), fc[k, 0].max(), fc[k, 1].min(), fc[k, 1].max()))
print("coracobrachialis.R painted at all:", (freg == "coracobrachialis.R").sum())
