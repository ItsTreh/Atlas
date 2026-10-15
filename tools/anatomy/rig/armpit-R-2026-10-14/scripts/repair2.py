"""Experimental right-armpit reconstruction, version 2, on a SCRATCH copy of
Male_Body.blend. (Version 1, repair.py, crossed the skin near the front fold:
its cut zigzagged over sculpt facets and its rows ran up the crease instead of
back into the body.)

  Blender -b scratch/original/Male_Body.blend --python repair2.py

  1. boundary  The crease where the arm's surface runs into the chest wall,
               measured, not guessed: per horizontal slice (every 2 mm) the
               front notch (biceps | serratus/latissimus) and the back notch
               (triceps | latissimus/teres major); per front-to-back slice the
               crotch under the arm where they meet. It runs from just under
               the anterior fold (pectoralis major's lower edge, Z_FRONT) down
               the front, under the arm, and up the back to just under the
               posterior fold (teres major's lower edge, Z_BACK). The cut is
               the shortest edge path that stays on that measured curve.
  2. rip       The cut's edges are split: the arm side and the chest side get
               their own copies of its vertices; its two ends stay shared.
               Every existing face keeps its index, vertices and UVs.
  3. pocket    The hole is closed by two walls, the inner wall of the arm and
               the facing chest wall, meeting in a rounded dome between the
               cut's two ends. Each wall is a Coons patch on the fused zone:
               its sides are the front and back notches, its bottom the
               crotch, its top the dome; rows run from the front notch back
               into the body. The walls stand a few mm apart, opening toward
               the dome, and are zipped to the cut's vertices. New faces carry
               the sculpture's own material and their own UV island on blank
               image: they read as unpainted (body) and can be painted later.
  4. weights   Near the cut each side follows its own bone (geodesic distance
               to each side's copy of the cut); the walls follow their side
               and blend in the dome; smoothed; at most 4 influences,
               normalised. Only right-armpit vertices change.
  5. save      scratch/repaired/Male_Body.blend (never the production file).
"""
import sys, os, heapq
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, bmesh, numpy as np
from collections import defaultdict
from mathutils.kdtree import KDTree
import common as C
C.guard()
np.set_printoptions(suppress=True, precision=4)

Z_LOW, Z_FRONT, Z_BACK = 0.53, 0.665, 0.645   # bottom of the fusion; the folds' lower edges at each notch
DOME = 0.02          # the dome rises this much above the line between the cut's ends (m)
GAP = 0.0035         # half the gap between the walls at its widest (m)
NS, NW = 26, 22      # rows (crotch -> dome) and columns (front -> back) per wall
S_IN, W_IN = 0.035, 0.05   # the walls' grid starts this far in from the cut; a zip strip spans the rest
R = 0.06             # reach of the weight repair from the cut (m)
LIP = 0.0018         # a ribbon along the cut steps this far into the body first, along each side's own inward normal (m)
ARM_BONES = {"Bone.010", "Bone.011"}
OUT = os.path.join(C.SCRATCH, "repaired", "Male_Body.blend")

obj = bpy.data.objects["Mesh_0"]; me = obj.data
co, ev = C.mesh_arrays(me)
nv0, nf0 = len(me.vertices), len(me.polygons)
a, b = ev[:, 0], ev[:, 1]

# ---------------------------------------------------------------- 1. boundary
def crossings(axis, c, win):
    cross = (co[a, axis] - c) * (co[b, axis] - c) < 0
    t = (c - co[a, axis]) / np.where(cross, co[b, axis] - co[a, axis], 1)
    P = co[a] + t[:, None] * (co[b] - co[a])
    return P[cross & win(P)]

notch_win = lambda P: (P[:, 0] > -0.29) & (P[:, 0] < -0.19) & (P[:, 1] > -0.13) & (P[:, 1] < 0.15)
front, back = [], []
for z in np.arange(Z_LOW, Z_FRONT + 1e-6, 0.002):
    P = crossings(2, z, notch_win)
    fr = P[P[:, 1] < 0.005]; front.append(fr[np.argmax(fr[:, 1])])
    if z <= Z_BACK + 1e-6:
        bk = P[P[:, 1] >= 0.005]; back.append(bk[np.argmin(bk[:, 1])])
front, back = np.array(front), np.array(back)
crotch = []
for y in np.arange(front[0, 1] + 0.003, back[0, 1] - 0.003, 0.002):
    P = crossings(1, y, lambda P: (P[:, 0] > -0.28) & (P[:, 0] < -0.20) & (P[:, 2] > 0.47) & (P[:, 2] < Z_LOW + 0.012))
    if len(P):
        crotch.append(P[np.argmax(P[:, 2])])
crotch = np.array(crotch)
guide = np.concatenate([front[::-1], crotch, back])
print("guide: front %d pts (z %.3f..%.3f), crotch %d pts (z %.3f..%.3f), back %d pts" % (
    len(front), front[:, 2].min(), front[:, 2].max(), len(crotch), crotch[:, 2].min(), crotch[:, 2].max(), len(back)))
dense = []
for p, q in zip(guide[:-1], guide[1:]):
    n_ = max(1, int(np.linalg.norm(q - p) / 0.0005))
    dense += [p + (q - p) * t for t in np.arange(n_) / n_]
dense.append(guide[-1])
kd = KDTree(len(dense))
for i, p in enumerate(dense): kd.insert(p, i)
kd.balance()

zone = (co[:, 0] < -0.15) & (co[:, 2] > 0.45) & (co[:, 2] < 0.75)
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
# the cut's corners where the notches meet the crotch
k1 = int(np.argmin(np.linalg.norm(rp - front[0], axis=1)))
k2 = int(np.argmin(np.linalg.norm(rp - back[0], axis=1)))
assert 0 < k1 < k2 < len(ring) - 1

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
def side_score(ch):          # arm-side faces lie toward the arm: -x of the cut, and below it near the crotch
    sc = 0.0
    for v in ch:
        for f in v.link_faces:
            d = f.calc_center_median() - v.co
            sc += d.x
    return sc / len(ch)
armc, torc = (c1, c2) if side_score(c1) < side_score(c2) else (c2, c1)
bm.normal_update()
inward = {v: -np.array(v.normal) for v in armc + torc}    # each copy's own side: into the body, toward its own half
# check against the paint too: the arm copy should border biceps/triceps, the chest copy latissimus/serratus/teres
names, pal, reg = C.palette(); px, w_img, h_img = C.paint_pixels()
freg = C.face_regions(me, px, w_img, h_img, names, pal, reg)
from collections import Counter
def border_paint(ch):
    c = Counter()
    for v in ch:
        for f in v.link_faces: c[freg[f.index]] += 1
    return c.most_common(4)
print("arm-side copy borders:", border_paint(armc))
print("chest-side copy borders:", border_paint(torc))

# ------------------------------------------------------------------ 3. pocket
P0 = np.array([vF.co[:]] + [v.co[:] for v in armc] + [vB.co[:]])
sl = np.linalg.norm(np.diff(P0, axis=0), axis=1)
U = np.concatenate([[0], np.cumsum(sl)]) / sl.sum()
u1, u2 = U[k1], U[k2]
def ring_at(t):
    return np.array([np.interp(t, U, P0[:, i]) for i in range(3)])
ctr = P0.mean(0); _, _, vt = np.linalg.svd(P0 - ctr); nrm = vt[2]
if nrm[0] < 0: nrm = -nrm
up = np.array([0, 0, 1.0]) - nrm * nrm[2]; up /= np.linalg.norm(up)
pF, pB = P0[0], P0[-1]
D0 = lambda s: ring_at(u1 * (1 - s))                  # front notch: s 0 (crotch) -> 1 (F)
D1 = lambda s: ring_at(u2 + s * (1 - u2))             # back notch:  s 0 -> 1 (B)
C0 = lambda w: ring_at(u1 + w * (u2 - u1))            # crotch: w 0 (front) -> 1 (back)
C1 = lambda w: pF + w * (pB - pF) + up * DOME * np.sin(np.pi * w)   # the dome
def coons(s, w):
    return ((1 - s) * C0(w) + s * C1(w) + (1 - w) * D0(s) + w * D1(s)
            - ((1 - s) * (1 - w) * C0(0) + (1 - s) * w * C0(1) + s * (1 - w) * C1(0) + s * w * C1(1)))
def normal(s, w, e=1e-3):
    ds = coons(min(s + e, 1), w) - coons(max(s - e, 0), w)
    dw = coons(s, min(w + e, 1)) - coons(s, max(w - e, 0))
    n_ = np.cross(ds, dw); n_ /= np.linalg.norm(n_)
    return n_ if n_[0] > 0 else -n_
def lip(x): return np.sin(0.5 * np.pi * min(1.0, x / 0.12)) ** 0.5   # opens quickly off the cut, so each wall leans to its own side
def gap(s, w):
    cap = np.sqrt(max(0.0, 1 - ((s - 0.7) / 0.3) ** 2)) if s > 0.7 else 1.0
    return GAP * (0.6 + 0.4 * s) * lip(s) * lip(w) * lip(1 - w) * cap
s_rows = [S_IN + (1 - S_IN) * np.sin(0.5 * np.pi * k / NS) for k in range(NS)]   # denser toward the dome
w_cols = list(np.linspace(W_IN, 1 - W_IN, NW))

dl = bm.verts.layers.deform.verify()
uvP = bm.loops.layers.uv["Paint"]; uvO = bm.loops.layers.uv.get("UVMap")
coord = {}                      # vertex -> (s, w) on the patch, for UVs and weights
dome = [vF] + [bm.verts.new(C1(w)) for w in w_cols] + [vB]
for v, w in zip(dome, [0.0] + w_cols + [1.0]): coord[v] = (1.0, w)
for v in dome[1:-1]: coord[v] = (1.0, coord[v][1])
for k, v in enumerate(armc):
    t = U[k + 1]
    coord[v] = (1 - t / u1, 0.0) if t <= u1 else ((0.0, (t - u1) / (u2 - u1)) if t <= u2 else ((t - u2) / (1 - u2), 1.0))
for va, vt_ in zip(armc, torc): coord[vt_] = coord[va]
walls = {}
for side, sign in (("arm", -1), ("chest", +1)):
    grid = []
    for s in s_rows:
        row = []
        for w in w_cols:
            p = coons(s, w) + sign * normal(s, w) * gap(s, w)
            v = bm.verts.new(p); coord[v] = (s, w); row.append(v)
        grid.append(row)
    grid.append(dome[1:-1])
    walls[side] = grid

# UV island on blank image
uvs = np.array([[l[uvP].uv[:] for l in f.loops][:3] for f in bm.faces if f.index < nf0 or True][:nf0])
G = 512
cov = np.zeros((G, G), bool)
lo = np.clip((uvs.min(1) * G).astype(int), 0, G - 1); hi = np.clip((uvs.max(1) * G).astype(int), 0, G - 1)
for (x0, y0), (x1, y1) in zip(lo, hi): cov[y0:y1 + 1, x0:x1 + 1] = True
white = (px.min(2) > 0.98)[(np.arange(G) * h_img // G)[:, None], (np.arange(G) * w_img // G)[None, :]]
free = ~cov & white
depth = np.linalg.norm(coons(0.5, 1) - coons(0.5, 0)); height = np.linalg.norm(coons(1, 0.5) - coons(0, 0.5))
ii = np.zeros((G + 1, G + 1)); ii[1:, 1:] = np.cumsum(np.cumsum(free, 0), 1)
best = None
for size in range(200, 6, -2):
    ww = size; hh = int(round(size * 2 * height / depth))
    if hh >= G - 2: continue
    tot = ii[hh:, ww:] - ii[:-hh, ww:] - ii[hh:, :-ww] + ii[:-hh, :-ww]
    ys, xs = np.nonzero(tot[1:-1, 1:-1] == hh * ww)
    if len(ys):
        best = (int(xs[0]) + 1, int(ys[0]) + 1, ww, hh); break
assert best
x0, y0, ww, hh = best
area3d = sum(f.calc_area() for f in bm.faces if f.index < nf0)
uvarea = 0.5 * np.abs(np.cross(np.c_[uvs[:, 1] - uvs[:, 0], np.zeros(len(uvs))], np.c_[uvs[:, 2] - uvs[:, 0], np.zeros(len(uvs))])[:, 2]).sum()
print("UV island %dx%d cells (of %d) at (%d,%d); texel density %.0f%% of the body's" % (
    ww, hh, G, x0, y0, 100 * (ww / G / depth) / (uvarea / area3d) ** 0.5))
ox, oy, sx, sy = (x0 + 0.5) / G, (y0 + 0.5) / G, (ww - 1) / G, (hh - 1) / G
def uv_of(v, side):
    s, w = coord[v]
    return (ox + sx * w, oy + sy * (0.5 * s if side == "arm" else 1 - 0.5 * s))

made = {"arm": [], "chest": []}
RIBBON = {}                     # ribbon vertex -> its cut vertex
def face(vs, side):
    vs = [v for k, v in enumerate(vs) if v not in vs[:k]]
    if len(vs) < 3: return
    f = bm.faces.new(vs); f.material_index = 0; f.smooth = True
    for l in f.loops:
        l[uvP].uv = uv_of(l.vert, side)
        if uvO: l[uvO].uv = l[uvP].uv
    made[side].append(f)
for side, chain in (("arm", armc), ("chest", torc)):
    g = walls[side]
    for k in range(NS):
        for j in range(NW - 1):
            face([g[k][j], g[k][j + 1], g[k + 1][j + 1], g[k + 1][j]], side)
    # the rim the zip runs to, and each rim point's place along the cut
    Q = [g[NS][0]] + [g[k][0] for k in range(NS - 1, -1, -1)] + [g[0][j] for j in range(1, NW)] + [g[k][NW - 1] for k in range(1, NS)] + [g[NS][NW - 1]]
    def qparam(v):
        s, w = coord[v]
        if w <= W_IN + 1e-9 and s > S_IN + 1e-9: return u1 * (1 - (s - S_IN) / (1 - S_IN))
        if w >= 1 - W_IN - 1e-9 and s > S_IN + 1e-9: return u2 + (s - S_IN) / (1 - S_IN) * (1 - u2)
        return u1 + (w - W_IN) / (1 - 2 * W_IN) * (u2 - u1)
    qu = [qparam(v) for v in Q]; qu[0], qu[-1] = 0.0, 1.0
    Qp = np.array([v.co[:] for v in Q])
    # the ribbon: each cut vertex steps LIP into the body, half along its own side's inward
    # normal (clears the valley floor beside a cut that runs a hair up one flank), half
    # toward the rim (so the zip never folds back over it); smoothed along the cut
    dirs = []
    for k, v in enumerate(chain):
        rim = np.array([np.interp(U[k + 1], qu, Qp[:, i]) for i in range(3)])
        dp = rim - np.array(v.co); dp /= np.linalg.norm(dp)
        dirs.append(inward[v] / np.linalg.norm(inward[v]) + dp)
    dirs = np.array(dirs)
    sm = np.array([dirs[max(0, k - 4):k + 5].mean(0) for k in range(len(dirs))])
    sm /= np.linalg.norm(sm, axis=1)[:, None]
    lips = []
    for k, v in enumerate(chain):
        taper = min(1.0, (k + 1) / 6, (len(chain) - k) / 6)
        lv = bm.verts.new(np.array(v.co) + sm[k] * LIP * taper)
        s_, w_ = coord[v]
        coord[lv] = (max(s_, 0.35 * S_IN) if w_ > 0 and w_ < 1 else s_,
                     0.35 * W_IN if w_ == 0 else (1 - 0.35 * W_IN if w_ == 1 else w_))
        if s_ == 0: coord[lv] = (0.35 * S_IN, coord[lv][1])
        lips.append(lv); RIBBON[lv] = v
    cut = [vF] + chain + [vB]
    Pz = [vF] + lips + [vB]
    for k in range(len(cut) - 1):
        face([cut[k], cut[k + 1], Pz[k + 1], Pz[k]], side)
    # the zip: the ribbon (F .. B) against the grid's rim (dome start, down the front column, along the bottom, up the back)
    pu = list(U)
    i = j = 0
    while i < len(Pz) - 1 or j < len(Q) - 1:
        if j == len(Q) - 1 or (i < len(Pz) - 1 and pu[i + 1] <= qu[j + 1]):
            face([Pz[i], Pz[i + 1], Q[j]], side); i += 1
        else:
            face([Pz[i], Q[j + 1], Q[j]], side); j += 1
# dome ends: F - dome[1] and dome[-2] - B are zip edges already. Orientation per wall:
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
new_faces = made["arm"] + made["chest"]
bm.verts.index_update()
pocket_verts = set(v for f in new_faces for v in f.verts) - set([vF, vB]) - set(armc) - set(torc)
print("pocket: %d faces (%d arm wall, %d chest wall), %d new vertices" % (len(new_faces), len(made["arm"]), len(made["chest"]), len(pocket_verts)))

# ----------------------------------------------------------------- 4. weights
gname = {g.index: g.name for g in obj.vertex_groups}; gidx = {v_: k_ for k_, v_ in gname.items()}
def wdict(v): return {gname[g]: x for g, x in v[dl].items() if x > 0}
def norm(d):
    s = sum(d.values()); return {k_: x / s for k_, x in d.items()} if s > 0 else d
def mix(p, q, t):
    out = defaultdict(float)
    for k_, x in p.items(): out[k_] += (1 - t) * x
    for k_, x in q.items(): out[k_] += t * x
    return dict(out)
def dijkstra(srcs):
    dist = {v: 0.0 for v in srcs}; pq = [(0.0, v.index, v) for v in srcs]
    while pq:
        d, _, v = heapq.heappop(pq)
        if d > dist[v] or d > R: continue
        for e in v.link_edges:
            o = e.other_vert(v)
            if o in pocket_verts: continue
            nd = d + e.calc_length()
            if nd < dist.get(o, 1e9):
                dist[o] = nd; heapq.heappush(pq, (nd, o.index, o))
    return dist
dA = dijkstra(armc + [vF, vB]); dT = dijkstra(torc + [vF, vB])
touched = set(dA) | set(dT)
ARM = {"Bone.010": 1.0}
def torso_of(d):
    t = {k_: x for k_, x in d.items() if k_ not in ARM_BONES}
    return norm(t) if sum(t.values()) > 0.05 else {"Bone.001": 0.5, "Bone": 0.5}
new_w = {}
for v in touched:
    old = wdict(v); da, dt = dA.get(v, 9.0), dT.get(v, 9.0)
    sigma = dt / (da + dt) if da + dt > 0 else 0.5
    x = np.clip((min(da, dt) - 0.4 * R) / (0.6 * R), 0, 1); f = 1 - x * x * (3 - 2 * x)
    new_w[v] = norm(mix(old, mix(torso_of(old), ARM, sigma), f))
kd_a = KDTree(len(armc))
for k, v in enumerate(armc): kd_a.insert(v.co, k)
kd_a.balance()
for side in ("arm", "chest"):
    for row in walls[side]:
        for v in row:
            if v in new_w and v in dome: continue
            k = kd_a.find(v.co)[1]
            wa, wt_ = new_w[armc[k]], new_w[torc[k]]
            s = coord[v][0]
            bl_ = np.clip((s - 0.45) / 0.55, 0, 1); bl_ = bl_ * bl_ * (3 - 2 * bl_)
            mid = mix(wa, wt_, 0.5)
            new_w[v] = mid if v in dome else mix(wa if side == "arm" else wt_, mid, bl_)
for lv, v in RIBBON.items(): new_w[lv] = dict(new_w[v])
Z = list(new_w)
for it in range(12):
    nxt = {}
    for v in Z:
        nb = [e.other_vert(v) for e in v.link_edges]; nb = [o for o in nb if o in new_w]
        if not nb: nxt[v] = new_w[v]; continue
        avg = defaultdict(float)
        for o in nb:
            for k_, x in new_w[o].items(): avg[k_] += x / len(nb)
        nxt[v] = mix(new_w[v], avg, 0.5)
    new_w = nxt
assert all(v.co.x < -0.12 for v in new_w), "weights touched outside the right armpit"
for v, d in new_w.items():
    top = norm({k_: x for k_, x in sorted(d.items(), key=lambda t: -t[1])[:4] if x > 1e-4})
    dv = v[dl]
    for g in list(dv.keys()): del dv[g]
    for k_, x in top.items(): dv[gidx[k_]] = x
print("weights rewritten on %d vertices (%d existing)" % (len(new_w), len(touched)))

np.savez(os.path.join(C.SCRATCH, "out", "repair2_debug.npz"), ring=P0, U=U, u1=u1, u2=u2, guide=guide, nf0=nf0, nv0=nv0)
bm.to_mesh(me); bm.free(); me.update()
me["atlas_armpit_experiment"] = "right armpit reconstruction v2, scratch only, 2026-10-14"
bpy.ops.wm.save_as_mainfile(filepath=OUT, check_existing=False, compress=True)
print("saved", OUT, "vertices %d -> %d, faces %d -> %d" % (nv0, len(me.vertices), nf0, len(me.polygons)))
