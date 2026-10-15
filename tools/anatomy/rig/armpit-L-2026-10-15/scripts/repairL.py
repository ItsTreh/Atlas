"""Left-armpit reconstruction on a SCRATCH copy of the approved baseline
(rig-weights-2026-10-14/result/Male_Body_rigged.blend: right armpit repaired, ATLAS_Rig 59 bones).

  Blender -b build/src.blend --python scripts/repairL.py -- <out name>

The right armpit's method (armpit-R-2026-10-14/scripts/repair4.py), adapted to the left
side's own geometry. Nothing is mirrored: every position below is measured on the left.

  1. boundary  Per horizontal slice (every 2 mm) through the fused zone, the contour near
               the left armpit is ordered and compared with its convex hull. The front bay's
               deepest point is the front notch (biceps | latissimus), the back bay's the
               back notch (triceps/coracobrachialis | latissimus, then teres major). Per
               front-to-back slice, the top of the slit between arm and chest wall is the
               crotch. The cut runs from F (front notch, just under pectoralis major's lower
               edge) down, under the arm, and up the back to B (just under teres major's
               lower edge): the shortest edge path that stays on that measured curve.
  2. rip       The cut's edges are split; F and B stay shared. No existing face is moved,
               re-indexed or re-mapped; no existing vertex moves.
  3. pocket    Two walls (inner arm, chest wall) joined in a dome between F and B, laid on a
               Coons patch over the fused zone, one column per cut vertex along the flow lines
               of a harmonic field (repair4, unchanged). New faces: material 0, their own UV
               island on blank image (unpainted body).
  4. sets      out/sets_L.npz: walls (arm, chest), dome, the cut's two copies, F and B, the
               inner-arm skin near the cut. Weights are left to weightsL.py.
"""
import sys, os, heapq, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, bmesh, numpy as np
from collections import defaultdict, Counter
from mathutils.kdtree import KDTree
import common as C
C.guard()
np.set_printoptions(suppress=True, precision=4)
NAME = sys.argv[sys.argv.index("--") + 1]
SX = +1.0            # the left side is +x

# measured by probe2.py on the baseline (out/probe2_notches.json)
Z_LOW = 0.528        # the lowest slice where arm and chest wall are one contour
Z_FRONT = 0.636      # front notch: pectoralis major appears on the chest flank at 0.638
Z_BACK = 0.618       # back notch: teres major appears on the chest flank at 0.618-0.624
Y_SPLIT = 0.035      # front notches lie at y -0.015..0.017, back notches at 0.059..0.14
X_NOTCH = (0.175, 0.225)
DOME = 0.02
GAP = 0.0035
LIP = 0.0018
ARM_REACH, FB_FADE, SHOULDER_FADE = 0.12, 0.04, 0.04   # the inner-arm set, as the right's corrective study
OUT = os.path.join(C.SCRATCH, "build", NAME + ".blend")

obj = bpy.data.objects["Mesh_0"]; me = obj.data; ao = bpy.data.objects["ATLAS_Rig"]
assert np.allclose(np.array(obj.matrix_world), np.eye(4))
co = C.mesh_co(me); ev = C.edges(me)
nv0, nf0 = len(me.vertices), len(me.polygons)
assert nv0 == 153898 and nf0 == 297459, (nv0, nf0)
a, b = ev[:, 0], ev[:, 1]
tri = C.triangles(me); cen = co[tri[:, :3]].mean(1)
freg = C.face_regions(me); tr = freg[tri[:, 3]]
short = lambda r: r.split(".")[0].replace("-brachii", "").replace("-dorsi", "").replace("-anterior", "")

# ---------------------------------------------------------------- 1. boundary
def contour(axis, c, win):
    zz = co[:, axis] - c
    s_ = np.sign(zz[tri[:, :3]]); s_[s_ == 0] = 1
    cross = ~((s_ == s_[:, :1]).all(1)) & win(cen)
    nxt = defaultdict(list); pos = {}
    for t in np.flatnonzero(cross):
        vs = tri[t, :3]; keys = []
        for i, j in ((vs[0], vs[1]), (vs[1], vs[2]), (vs[2], vs[0])):
            if (zz[i] >= 0) != (zz[j] >= 0):
                k = (min(i, j), max(i, j)); u = zz[i] / (zz[i] - zz[j]); pos[k] = co[i] + u * (co[j] - co[i]); keys.append(k)
        if len(keys) == 2:
            nxt[keys[0]].append((keys[1], tr[t])); nxt[keys[1]].append((keys[0], tr[t]))
    seen, loops = set(), []
    for s in list(nxt):
        if s in seen: continue
        loop, labs, cur, prev = [s], [], s, None; seen.add(s)
        while True:
            cand = [(k, l) for k, l in nxt[cur] if k != prev and k not in seen]
            if not cand: break
            prev, (cur, l) = cur, cand[0]; seen.add(cur); loop.append(cur); labs.append(l)
        loops.append((np.array([pos[k] for k in loop]), labs + [labs[-1] if labs else "?"]))
    loops.sort(key=lambda L: -len(L[0]))
    return loops
def hull2(Q):
    idx = np.lexsort((Q[:, 1], Q[:, 0]))
    def half(seq):
        h = []
        for i in seq:
            while len(h) >= 2:
                p, q = Q[h[-2]], Q[h[-1]]; r = Q[i]
                if (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]) <= 0: h.pop()
                else: break
            h.append(i)
        return h
    return half(idx)[:-1] + half(idx[::-1])[:-1]
def notches(z):
    L = contour(2, z, lambda c: (c[:, 0] > 0.12) & (c[:, 0] < 0.36))
    Q = L[0][0][:, :2]; Q3 = L[0][0]
    H = Q[hull2(Q)]; Hn = np.roll(H, -1, 0); d = Hn - H; dd = (d * d).sum(1)
    dep = np.array([np.min(np.linalg.norm(H + np.clip(((p - H) * d).sum(1) / dd, 0, 1)[:, None] * d - p, axis=1)) for p in Q])
    n = len(Q); off = dep > 0.001; start = int(np.flatnonzero(~off)[0]); bays, run = [], []
    for k in range(1, n + 1):
        j = (start + k) % n
        if off[j]: run.append(j)
        elif run: bays.append(run); run = []
    out = {}
    for bb in bays:
        k = bb[int(np.argmax(dep[bb]))]
        if dep[k] < 0.004 or not (X_NOTCH[0] < Q[k, 0] < X_NOTCH[1]): continue
        key = "front" if Q[k, 1] < Y_SPLIT else "back"
        if key not in out or dep[k] > out[key][1]: out[key] = (Q3[k], dep[k])
    return out
front, back = [], []
for z in np.arange(Z_LOW, Z_FRONT + 1e-6, 0.002):
    nt = notches(z)
    front.append(nt["front"][0])
    if z <= Z_BACK + 1e-6: back.append(nt["back"][0])
front, back = np.array(front), np.array(back)
# crotch: the top of the slit between the arm's inner wall and the chest wall, per x-z slice
crotch = []
for y in np.arange(front[0, 1] + 0.003, back[0, 1] - 0.003, 0.002):
    L = contour(1, y, lambda c: (c[:, 0] > 0.17) & (c[:, 0] < 0.22) & (c[:, 2] > 0.47) & (c[:, 2] < Z_LOW + 0.012))
    if not L: continue
    pts = np.concatenate([l[0] for l in L])
    pts = pts[(pts[:, 0] > 0.17) & (pts[:, 0] < 0.22) & (pts[:, 2] < Z_LOW + 0.012)]
    if len(pts): crotch.append(pts[np.argmax(pts[:, 2])])
crotch = np.array(crotch)
print("guide: front %d pts (z %.3f..%.3f, x %.3f..%.3f, y %.3f..%.3f), crotch %d pts (z %.3f..%.3f, x %.3f..%.3f), back %d pts (y %.3f..%.3f)" % (
    len(front), front[:, 2].min(), front[:, 2].max(), front[:, 0].min(), front[:, 0].max(), front[:, 1].min(), front[:, 1].max(),
    len(crotch), crotch[:, 2].min(), crotch[:, 2].max(), crotch[:, 0].min(), crotch[:, 0].max(), len(back), back[:, 1].min(), back[:, 1].max()))
guide = np.concatenate([front[::-1], crotch, back])
dense = []
for p, q in zip(guide[:-1], guide[1:]):
    n_ = max(1, int(np.linalg.norm(q - p) / 0.0005))
    dense += [p + (q - p) * t for t in np.arange(n_) / n_]
dense.append(guide[-1])
kd = KDTree(len(dense))
for i, p in enumerate(dense): kd.insert(p, i)
kd.balance()
zone = (SX * co[:, 0] > 0.15) & (co[:, 2] > 0.45) & (co[:, 2] < 0.75)
adj = defaultdict(list)
for i, j in ev[zone[a] & zone[b]]:
    mid = 0.5 * (co[i] + co[j]); dmid = kd.find(mid)[2]
    if dmid > 0.012: continue
    L = np.linalg.norm(co[i] - co[j])
    cost = L * (1 + (dmid / 0.0008) ** 2)
    adj[i].append((j, cost)); adj[j].append((i, cost))
def nearest_vert(p):
    cand = np.flatnonzero(zone)
    return int(cand[np.argmin(np.linalg.norm(co[cand] - p, axis=1))])
def path(s, t):
    dist, prev, pq = {s: 0.0}, {}, [(0.0, s)]
    while pq:
        d, u_ = heapq.heappop(pq)
        if u_ == t: break
        if d > dist[u_]: continue
        for v, c in adj[u_]:
            nd = d + c
            if nd < dist.get(v, 1e9):
                dist[v] = nd; prev[v] = u_; heapq.heappush(pq, (nd, v))
    out = [t]
    while out[-1] != s: out.append(prev[out[-1]])
    return out[::-1]
F, B = nearest_vert(front[-1]), nearest_vert(back[-1])
ring = path(F, B)
rp = co[ring]
seg = np.linalg.norm(np.diff(rp, axis=0), axis=1)
turns = [np.degrees(np.arccos(np.clip((rp[k] - rp[k - 1]) @ (rp[k + 1] - rp[k]) / seg[k - 1] / seg[k], -1, 1))) for k in range(1, len(rp) - 1)]
off = np.array([kd.find(p)[2] for p in rp])
print("cut: %d vertices, %.1f cm; edges median %.2f mm; turns >60 deg %d; off the measured curve: median %.2f mm, max %.2f mm" % (
    len(ring), seg.sum() * 100, np.median(seg) * 1000, int((np.array(turns) > 60).sum()), np.median(off) * 1000, off.max() * 1000))
print("F", np.round(co[F], 4), "B", np.round(co[B], 4))
assert (SX * rp[:, 0] > 0.15).all()
k1 = int(np.argmin(np.linalg.norm(rp - front[0], axis=1)))
k2 = int(np.argmin(np.linalg.norm(rp - back[0], axis=1)))
assert 0 < k1 < k2 < len(ring) - 1, (k1, k2, len(ring))

# --------------------------------------------------------------------- 2. rip
bm = bmesh.new(); bm.from_mesh(me)
bm.verts.ensure_lookup_table()
pedges = []
for k in range(len(ring) - 1):
    e = bm.edges.get((bm.verts[ring[k]], bm.verts[ring[k + 1]]))
    assert e is not None
    pedges.append(e)
bmesh.ops.split_edges(bm, edges=pedges)
bm.verts.ensure_lookup_table(); bm.verts.index_update(); bm.faces.index_update()
assert len(bm.faces) == nf0
vF, vB = bm.verts[F], bm.verts[B]
def bnext(v, prev):
    for e in v.link_edges:
        if e.is_boundary:
            o = e.other_vert(v)
            if o is not prev: return o
loop = [vF]; cur, prev = vF, None
while True:
    n_ = bnext(cur, prev)
    if n_ is None or n_ is vF: break
    prev, cur = cur, n_; loop.append(cur)
kB = loop.index(vB)
c1, c2 = loop[1:kB], loop[kB + 1:][::-1]
assert len(c1) == len(c2) == len(ring) - 2
def side_score(ch):
    sc = 0.0
    for v in ch:
        for f in v.link_faces:
            sc += (f.calc_center_median() - v.co).x
    return sc / len(ch)
armc, torc = (c1, c2) if SX * side_score(c1) > SX * side_score(c2) else (c2, c1)
bm.normal_update()
inward = {v: -np.array(v.normal) for v in armc + torc}
def border_paint(ch):
    c = Counter()
    for v in ch:
        for f in v.link_faces: c[short(freg[f.index])] += 1
    return c.most_common(5)
bp_arm, bp_chest = border_paint(armc), border_paint(torc)
print("arm-side copy borders:", bp_arm)
print("chest-side copy borders:", bp_chest)

# ------------------------------------------------------------------ 3. pocket (repair4's construction)
P0 = np.array([vF.co[:]] + [v.co[:] for v in armc] + [vB.co[:]])
sl = np.linalg.norm(np.diff(P0, axis=0), axis=1)
U = np.concatenate([[0], np.cumsum(sl)]) / sl.sum()
u1, u2 = U[k1], U[k2]
_Lc = sl.sum(); _ts = np.linspace(0, 1, int(_Lc / 0.0005) + 1)
_Pu = np.stack([np.interp(_ts, U, P0[:, i]) for i in range(3)], 1)
_sig = 0.003 / (_Lc / (len(_ts) - 1)); _r = int(3 * _sig)
_ker = np.exp(-0.5 * (np.arange(-_r, _r + 1) / _sig) ** 2); _ker /= _ker.sum()
_pad = np.concatenate([2 * _Pu[:1] - _Pu[_r:0:-1], _Pu, 2 * _Pu[-1:] - _Pu[-2:-_r - 2:-1]])
_Ps = np.stack([np.convolve(_pad[:, i], _ker, mode="valid") for i in range(3)], 1)
_Ps[0], _Ps[-1] = P0[0], P0[-1]
print("smoothed cut: moved %.2f mm at most from the cut" % (np.linalg.norm(_Ps - _Pu, axis=1).max() * 1000))
def ring_at(t):
    return np.array([np.interp(t, _ts, _Ps[:, i]) for i in range(3)])
ctr = P0.mean(0); _, _, vt = np.linalg.svd(P0 - ctr); nrm = vt[2]
if SX * nrm[0] > 0: nrm = -nrm                      # toward the chest (medial)
up = np.array([0, 0, 1.0]) - nrm * nrm[2]; up /= np.linalg.norm(up)
pF, pB = P0[0], P0[-1]
D0 = lambda s: ring_at(u1 * (1 - s))
D1 = lambda s: ring_at(u2 + s * (1 - u2))
C0 = lambda w: ring_at(u1 + w * (u2 - u1))
C1 = lambda w: pF + w * (pB - pF) + up * DOME * np.sin(np.pi * w)
def coons(s, w):
    return ((1 - s) * C0(w) + s * C1(w) + (1 - w) * D0(s) + w * D1(s)
            - ((1 - s) * (1 - w) * C0(0) + (1 - s) * w * C0(1) + s * (1 - w) * C1(0) + s * w * C1(1)))
def normal(s, w, e=0.02):
    ds = coons(min(s + e, 1), w) - coons(max(s - e, 0), w)
    dw = coons(s, min(w + e, 1)) - coons(s, max(w - e, 0))
    n_ = np.cross(ds, dw); n_ /= np.linalg.norm(n_)
    return n_ if SX * n_[0] < 0 else -n_            # toward the chest
K = 16
PHI = list(np.linspace(0.08, 0.95, K - 2) ** 1.1)
Hs = np.mean([np.linalg.norm(coons(1, w) - coons(0, w)) for w in (0.25, 0.5, 0.75)])
Hw = np.mean([np.linalg.norm(coons(s, 1) - coons(s, 0)) for s in (0.25, 0.5, 0.75)])
NG = 129
phi = np.zeros((NG, NG)); phi[-1, 1:-1] = 1.0
h_s, h_w = 1.0 / (NG - 1), 1.0 / (NG - 1)
cs, cw = 1 / (Hs * h_s) ** 2, 1 / (Hw * h_w) ** 2
for it in range(40000):
    inner = (cs * (phi[2:, 1:-1] + phi[:-2, 1:-1]) + cw * (phi[1:-1, 2:] + phi[1:-1, :-2])) / (2 * (cs + cw))
    if it % 2000 == 0:
        res = np.abs(inner - phi[1:-1, 1:-1]).max()
        if res < 1e-7: break
    phi[1:-1, 1:-1] = inner
print("harmonic field: %d iterations, last change %.1e; patch %.1f x %.1f cm" % (it, res, Hs * 100, Hw * 100))
g_ = np.linspace(0, 1, NG)
psi = np.full((NG, NG), 0.5)
psi[:, 0] = u1 * (1 - g_); psi[0, :] = u1 + g_ * (u2 - u1); psi[:, -1] = u2 + g_ * (1 - u2); psi[-1, :] = g_
for it2 in range(40000):
    inner = (cs * (psi[2:, 1:-1] + psi[:-2, 1:-1]) + cw * (psi[1:-1, 2:] + psi[1:-1, :-2])) / (2 * (cs + cw))
    if it2 % 2000 == 0 and np.abs(inner - psi[1:-1, 1:-1]).max() < 1e-8: break
    psi[1:-1, 1:-1] = inner
ps_, pw_ = np.gradient(phi, h_s, h_w); qs_, qw_ = np.gradient(psi, h_s, h_w)
def interp(A, s, w):
    x, y = np.clip(s, 0, 1) * (NG - 1), np.clip(w, 0, 1) * (NG - 1)
    i, j = min(int(x), NG - 2), min(int(y), NG - 2); fx, fy = x - i, y - j
    return A[i, j] * (1 - fx) * (1 - fy) + A[i + 1, j] * fx * (1 - fy) + A[i, j + 1] * (1 - fx) * fy + A[i + 1, j + 1] * fx * fy
def invert(f_t, q_t, guess):
    p = np.array(guess, float); r = np.array([1.0])
    for _ in range(60):
        r = np.array([interp(phi, *p) - f_t, interp(psi, *p) - q_t])
        if np.abs(r).max() < 1e-7: break
        J = np.array([[interp(ps_, *p), interp(pw_, *p)], [interp(qs_, *p), interp(qw_, *p)]])
        try: d = np.linalg.solve(J, -r)
        except np.linalg.LinAlgError: break
        n_ = np.linalg.norm(d)
        if n_ > 0.05: d *= 0.05 / n_
        p = np.clip(p + d, 0, 1)
    return p, float(np.abs(r).max())
def column(t, b0, levels):
    out, p, good = [], np.array(b0, float), (0.0, np.array(b0, float))
    for f in levels:
        q, r = invert(f, t, p)
        if r < 1e-3:
            p = q; good = (f, q); out.append(q)
        else:
            f0, q0 = good; a_ = (f - f0) / max(1 - f0, 1e-9)
            out.append(q0 + a_ * (np.array([1.0, t]) - q0))
    return out, np.array([1.0, t])
def gap(s, f):
    return GAP * (0.6 + 0.4 * s) * np.sin(np.pi * min(f, 1.0)) ** 0.6

uvP = bm.loops.layers.uv["Paint"]; uvO = bm.loops.layers.uv.get("UVMap")
coord = {}
for k, v in enumerate(armc):
    t = U[k + 1]
    coord[v] = (1 - t / u1, 0.0) if t <= u1 else ((0.0, (t - u1) / (u2 - u1)) if t <= u2 else ((t - u2) / (1 - u2), 1.0))
for va, vt_ in zip(armc, torc): coord[vt_] = coord[va]
coord[vF], coord[vB] = (1.0, 0.0), (1.0, 1.0)
paths = []
for k, v in enumerate(armc):
    paths.append(column(U[k + 1], coord[v], [0.03] + PHI))
_n = len(paths)
_rows = [np.array([paths[i][0][k] for i in range(_n)]) for k in range(1, len(PHI) + 1)]
_rows.append(np.array([paths[i][1] for i in range(_n)]))
_lv = PHI + [1.0]
for k, R_ in enumerate(_rows):
    for _ in range(int(10 + 150 * _lv[k])):
        R_[1:-1] = 0.5 * R_[1:-1] + 0.25 * (R_[:-2] + R_[2:])
    if k == len(_rows) - 1: R_[:, 0] = 1.0
for i in range(_n):
    pts, end = paths[i]
    paths[i] = ([pts[0]] + [_rows[k][i] for k in range(len(PHI))], _rows[-1][i])
_SW = np.array([[pts[k] for k in range(1, len(pts))] + [end] for pts, end in paths])
def _flips(X, nref=None):
    a_ = X[:-1, :-1]; b_ = X[1:, :-1]; c_ = X[1:, 1:]; d_ = X[:-1, 1:]
    if X.shape[-1] == 2:
        cr = np.cross(np.c_[(c_ - a_).reshape(-1, 2), np.zeros(a_[..., 0].size)], np.c_[(d_ - b_).reshape(-1, 2), np.zeros(a_[..., 0].size)])[:, 2]
    else:
        cr = np.einsum("ij,j->i", np.cross((c_ - a_).reshape(-1, 3), (d_ - b_).reshape(-1, 3)), nref)
    sg = np.sign(np.median(cr)); return int((np.sign(cr) == -sg).sum()), cr.size
flips = {"sw": _flips(_SW)}
_P3 = np.array([[coons(*q) for q in col] for col in _SW]); flips["patch"] = _flips(_P3, nrm)
_PHIs = PHI + [1.0]
for sign_ in (-1, 1):
    _O = np.array([[coons(*q) + sign_ * normal(*q) * gap(q[0], f) for q, f in zip(col, _PHIs)] for col in _SW])
    flips["wall%+d" % sign_] = _flips(_O, nrm)
print("flipped cells:", flips)
dome = [bm.verts.new(C1(end[1])) for _, end in paths]
for v, (_, end) in zip(dome, paths): coord[v] = (1.0, end[1])
ends_w = [end[1] for _, end in paths]
print("dome: %d vertices, monotonic: %s" % (len(dome), bool(np.all(np.diff(ends_w) >= -1e-9))))
cols = {}
for side, chain, sign in (("arm", armc, -1), ("chest", torc, +1)):
    rows = []
    for i, v in enumerate(chain):
        pts, _ = paths[i]; col = []
        for (s_, w_), f in zip(pts[1:], PHI):
            nv_ = bm.verts.new(coons(s_, w_) + sign * normal(s_, w_) * gap(s_, f)); coord[nv_] = (s_, w_); col.append(nv_)
        rows.append(col)
    dirs, reach = [], []
    for i, v in enumerate(chain):
        r2 = np.array(rows[i][0].co); c_ = np.array(v.co)
        dp = r2 - c_; L_ = np.linalg.norm(dp); dp /= max(L_, 1e-9)
        dirs.append(inward[v] / np.linalg.norm(inward[v]) + dp); reach.append(L_)
    dirs = np.array(dirs)
    sm = np.array([dirs[max(0, k - 4):k + 5].mean(0) for k in range(len(dirs))]); sm /= np.linalg.norm(sm, axis=1)[:, None]
    RP = np.array([np.array(v.co) + sm[i] * min(LIP, 0.4 * reach[i]) for i, v in enumerate(chain)])
    for _ in range(8):
        RP[1:-1] = 0.5 * RP[1:-1] + 0.25 * (RP[:-2] + RP[2:])
    full = [[vF] * (K + 1)]
    for i, v in enumerate(chain):
        rv = bm.verts.new(RP[i]); coord[rv] = tuple(paths[i][0][0])
        full.append([v, rv] + rows[i] + [dome[i]])
    full.append([vB] * (K + 1))
    cols[side] = full

# UV island on blank image, clear of every existing face (the right pocket's island included)
px, w_img, h_img = C.paint_pixels()
uvs = np.array([[l[uvP].uv[:] for l in f.loops][:3] for f in bm.faces][:nf0])
G = 512
cov = np.zeros((G, G), bool)
lo = np.clip((uvs.min(1) * G).astype(int), 0, G - 1); hi = np.clip((uvs.max(1) * G).astype(int), 0, G - 1)
for (x0, y0), (x1, y1) in zip(lo, hi): cov[y0:y1 + 1, x0:x1 + 1] = True
white = (px.min(2) > 0.98)[(np.arange(G) * h_img // G)[:, None], (np.arange(G) * w_img // G)[None, :]]
free = ~cov & white
ii = np.zeros((G + 1, G + 1)); ii[1:, 1:] = np.cumsum(np.cumsum(free, 0), 1)
best = None
for size in range(200, 6, -2):
    ww = size; hh = int(round(size * 2 * Hs / Hw))
    if hh >= G - 2: continue
    tot = ii[hh:, ww:] - ii[:-hh, ww:] - ii[hh:, :-ww] + ii[:-hh, :-ww]
    ys, xs = np.nonzero(tot[1:-1, 1:-1] == hh * ww)
    if len(ys):
        best = (int(xs[0]) + 1, int(ys[0]) + 1, ww, hh); break
assert best
x0, y0, ww, hh = best
print("UV island %dx%d cells (of %d) at (%d,%d)" % (ww, hh, G, x0, y0))
ox, oy, sx, sy = (x0 + 0.5) / G, (y0 + 0.5) / G, (ww - 1) / G, (hh - 1) / G
def uv_of(v, side):
    s, w = coord[v]
    return (ox + sx * w, oy + sy * (0.5 * s if side == "arm" else 1 - 0.5 * s))
made = {"arm": [], "chest": []}
def face(vs, side):
    vs = [v for k, v in enumerate(vs) if v not in vs[:k]]
    if len(vs) < 3: return
    f = bm.faces.new(vs); f.material_index = 0; f.smooth = True
    for l in f.loops:
        l[uvP].uv = uv_of(l.vert, side)
        if uvO: l[uvO].uv = l[uvP].uv
    made[side].append(f)
for side in ("arm", "chest"):
    full = cols[side]
    for i in range(len(full) - 1):
        for k in range(K):
            face([full[i][k], full[i + 1][k], full[i + 1][k + 1], full[i][k + 1]], side)
for side, chain in (("arm", armc), ("chest", torc)):
    fs = made[side]
    bmesh.ops.recalc_face_normals(bm, faces=fs)
    e = bm.edges.get((chain[len(chain) // 2], chain[len(chain) // 2 + 1]))
    old = [f for f in e.link_faces if f.index < nf0 and f not in fs]
    new = [f for f in e.link_faces if f in fs]
    assert len(old) == 1 and len(new) == 1, (len(old), len(new))
    def first(f):
        for l in f.loops:
            if l.edge == e: return l.vert
    if first(old[0]) is first(new[0]):
        for f in fs: f.normal_flip()
bm.verts.index_update(); bm.faces.index_update()
wall_arm = sorted(set(v.index for f in made["arm"] for v in f.verts) - set(v.index for v in dome) - {vF.index, vB.index} - set(v.index for v in armc))
wall_chest = sorted(set(v.index for f in made["chest"] for v in f.verts) - set(v.index for v in dome) - {vF.index, vB.index} - set(v.index for v in torc))
print("pocket: %d faces (%d arm wall, %d chest wall); new wall vertices arm %d / chest %d, dome %d" % (
    len(made["arm"]) + len(made["chest"]), len(made["arm"]), len(made["chest"]), len(wall_arm), len(wall_chest), len(dome)))
cut_arm = np.array([v.index for v in armc]); cut_chest = np.array([v.index for v in torc]); domei = np.array([v.index for v in dome])
FBv = np.array([vF.index, vB.index])
bm.to_mesh(me); bm.free(); me.update()

# ------------------------------------------------------------------ 4. sets (inner-arm skin as the right's corrective study)
co2 = C.mesh_co(me); ev2 = C.edges(me); nv = len(co2); nf = len(me.polygons)
ls2, lt2, lv2 = C.faces(me); fol = np.repeat(np.arange(nf), lt2)
on_orig = np.zeros(nv, bool); on_orig[lv2[fol < nf0]] = True
blocked = ~on_orig; blocked[FBv] = True
nbrs = [[] for _ in range(nv)]
for (i, j) in ev2:
    if not (blocked[i] or blocked[j]):
        l = float(np.linalg.norm(co2[i] - co2[j])); nbrs[i].append((j, l)); nbrs[j].append((i, l))
def geodesic(src, reach):
    dist = {int(v): 0.0 for v in src}; pq = [(0.0, int(v)) for v in src]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u] or d > reach: continue
        for o, l in nbrs[u]:
            nd = d + l
            if nd < dist.get(o, 9.0): dist[o] = nd; heapq.heappush(pq, (nd, o))
    return dist
dist = geodesic(cut_arm, ARM_REACH); dist_c = geodesic(cut_chest, 2 * ARM_REACH)
Gv = np.array([k for k, d in dist.items() if d < ARM_REACH and d < dist_c.get(k, 9.0)]); Gd = np.array([dist[k] for k in Gv])
def smooth(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
dFB = np.min(np.linalg.norm(co2[Gv][:, None] - co2[FBv][None], axis=2), 1)
C.rest_pose(ao)
bn = ao.data.bones["upper_arm.L"]; MW = np.array(ao.matrix_world)
_h = (MW @ np.r_[np.array(bn.head_local), 1])[:3]; _t = (MW @ np.r_[np.array(bn.tail_local), 1])[:3]
_ax = (_t - _h) / np.linalg.norm(_t - _h); _tip = (_t - _h) @ _ax
t_fold = ((co2[FBv] - _h) @ _ax).max()
alpha = ((1 - smooth((Gd / ARM_REACH - 2 / 3) * 3)) * smooth(dFB / FB_FADE) * smooth(((co2[Gv] - _h) @ _ax - t_fold) / SHOULDER_FADE))
alpha *= (((co2[Gv] - _h) @ _ax) < _tip - 0.06)
inner = Gv[alpha > 1e-4]
assert (SX * co2[inner, 0] > 0.15).all(), "inner-arm set left the left arm"
print("inner-arm skin near the cut: %d vertices" % len(inner))
np.savez(os.path.join(C.SCRATCH, "out", "sets_L.npz"), wall_arm=np.array(wall_arm), wall_chest=np.array(wall_chest), dome=domei,
         cut_arm=cut_arm, cut_chest=cut_chest, FB=FBv, innerarm=inner, nf_before=nf0, nv_before=nv0, guide=guide, ring=P0)
json.dump(dict(Z_LOW=Z_LOW, Z_FRONT=Z_FRONT, Z_BACK=Z_BACK, F=co2[FBv[0]].round(4).tolist(), B=co2[FBv[1]].round(4).tolist(),
               cut_vertices=len(ring), cut_cm=round(float(seg.sum() * 100), 1), off_curve_mm_max=round(float(off.max() * 1000), 2),
               arm_copy_borders=bp_arm, chest_copy_borders=bp_chest, flips=flips, pocket_faces=nf - nf0, new_vertices=nv - nv0,
               inner_arm=len(inner), front=front.round(4).tolist(), back=back.round(4).tolist(), crotch=crotch.round(4).tolist()),
          open(os.path.join(C.SCRATCH, "out", "repair_%s.json" % NAME), "w"), indent=1)
me["atlas_armpit_L_experiment"] = "left armpit reconstruction (repair4 method on the left's own geometry), scratch only, 2026-10-15"
bpy.ops.wm.save_as_mainfile(filepath=OUT, check_existing=False, compress=True)
print("saved", OUT, "vertices %d -> %d, faces %d -> %d" % (nv0, nv, nf0, nf))
