"""Experimental right-armpit reconstruction on a SCRATCH copy of Male_Body.blend.

  Blender -b scratch/original/Male_Body.blend --python repair.py

What it does, in order (all local to the right armpit, x < -0.15):
  1. boundary  the crease where the arm's surface runs into the chest wall:
               per horizontal slice, the front notch (biceps | serratus/lat)
               and the back notch (triceps | lat/teres major), from the
               bottom of the fusion (z~0.53) up to just under the folds: the
               pectoralis major's lower edge in front (Z_FRONT), teres
               major's at the back (Z_BACK). Joined by a valley-following
               shortest path, under the arm too.
  2. rip       the path's edges are split: the arm side and the chest side get
               their own copies of its vertices; its two ends stay shared.
               Every existing face keeps its index, vertices and UVs.
  3. pocket    the hole is filled by two walls, the inner wall of the arm and
               the facing chest wall, meeting in a rounded vault between the
               two ends (the armpit's dome). They are apart by a few mm only,
               opening toward the dome. New faces carry the sculpture's own
               material and their own UV island on blank image, so they read
               as unpainted (body) and can be painted later.
  4. weights   near the cut, each side follows its own bone (geodesic distance
               to each side's copy of the cut); the dome blends; smoothed;
               at most 4 influences, normalised. Only right-armpit vertices.
  5. save      scratch/repaired/Male_Body.blend (never the production file).
"""
import sys, os, heapq
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, bmesh, numpy as np
from collections import defaultdict
from mathutils import Vector
import common as C
C.guard()
np.set_printoptions(suppress=True, precision=4)

Z_LOW, Z_FRONT, Z_BACK = 0.53, 0.665, 0.645   # bottom of the fusion; the folds' lower edges at each notch
DOME = 0.02          # the vault rises this much above the line between the two ends (m)
GAP = 0.0035         # half the gap between the walls at its widest near the dome (m)
K = 14               # rows from a lip to the vault, per wall
R = 0.06             # reach of the weight repair from the cut (m)
ARM_BONES = {"Bone.010", "Bone.011"}
OUT = os.path.join(C.SCRATCH, "repaired", "Male_Body.blend")

obj = bpy.data.objects["Mesh_0"]; me = obj.data
co, ev = C.mesh_arrays(me)
nv0, nf0 = len(me.vertices), len(me.polygons)

# ---------------------------------------------------------------- 1. boundary
a, b = ev[:, 0], ev[:, 1]
def notches(z):
    cross = (co[a, 2] - z) * (co[b, 2] - z) < 0
    t = (z - co[a, 2]) / np.where(cross, co[b, 2] - co[a, 2], 1)
    P = co[a] + t[:, None] * (co[b] - co[a])
    win = cross & (P[:, 0] > -0.29) & (P[:, 0] < -0.19) & (P[:, 1] > -0.13) & (P[:, 1] < 0.15)
    idx = np.flatnonzero(win)
    fr = idx[P[idx, 1] < 0.005]; bk = idx[P[idx, 1] >= 0.005]
    f = fr[np.argmax(P[fr, 1])]; g = bk[np.argmin(P[bk, 1])]
    pick = lambda e: a[e] if np.linalg.norm(co[a[e]] - P[e]) < np.linalg.norm(co[b[e]] - P[e]) else b[e]
    return pick(f), pick(g), P[f], P[g]

front, back = [], []
for z in np.arange(Z_LOW, Z_FRONT + 1e-6, 0.005):
    f, g, pf, pg = notches(z)
    front.append(f)
    if z <= Z_BACK + 1e-6:
        back.append(g)
print("front notch top", co[front[-1]], "bottom", co[front[0]])
print("back notch top", co[back[-1]], "bottom", co[back[0]])

# valley-following shortest paths over the edges of the zone
fcount = defaultdict(list)
bm0 = bmesh.new(); bm0.from_mesh(me); bm0.edges.ensure_lookup_table(); bm0.verts.ensure_lookup_table()
zone = (co[:, 0] < -0.15) & (co[:, 2] > 0.45) & (co[:, 2] < 0.75)
adj = defaultdict(list)
for e in bm0.edges:
    i, j = e.verts[0].index, e.verts[1].index
    if not (zone[i] and zone[j]) or len(e.link_faces) != 2:
        continue
    f1, f2 = e.link_faces
    n1 = f1.normal; c1, c2 = f1.calc_center_median(), f2.calc_center_median()
    concave = n1.dot(c2 - c1) > 0
    ang = f1.normal.angle(f2.normal, 0.0)
    L = e.calc_length()
    cost = L * (np.exp(-6.0 * ang) if concave else 1.5)
    adj[i].append((j, cost)); adj[j].append((i, cost))

def path(s, t):
    dist, prev, pq = {s: 0.0}, {}, [(0.0, s)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == t: break
        if d > dist[u]: continue
        for v, c in adj[u]:
            nd = d + c
            if nd < dist.get(v, 1e9):
                dist[v] = nd; prev[v] = u; heapq.heappush(pq, (nd, v))
    out = [t]
    while out[-1] != s: out.append(prev[out[-1]])
    return out[::-1]

def chain(points):
    out = [points[0]]
    for p in points[1:]:
        if p != out[-1]:
            out += path(out[-1], p)[1:]
    return out

# F (top of the front notch) -> down -> under the arm -> up -> B (top of the back notch)
ring = chain(front[::-1] + back)
# a path must not revisit a vertex
seen = {}
clean = []
for v in ring:
    if v in seen:
        clean = clean[:seen[v] + 1]; seen = {u: k for k, u in enumerate(clean)}
        continue
    seen[v] = len(clean); clean.append(v)
ring = clean
F, B = ring[0], ring[-1]
L_ring = sum(np.linalg.norm(co[ring[k + 1]] - co[ring[k]]) for k in range(len(ring) - 1))
print("cut: %d vertices, %.1f cm long; F %s  B %s  lowest z %.3f" % (len(ring), L_ring * 100, co[F], co[B], co[ring, 2].min()))
bm0.free()

# --------------------------------------------------------------------- 2. rip
bm = bmesh.new(); bm.from_mesh(me)
bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()
pedges = []
for k in range(len(ring) - 1):
    e = bm.edges.get((bm.verts[ring[k]], bm.verts[ring[k + 1]]))
    assert e is not None, "cut path is not along edges"
    pedges.append(e)
bmesh.ops.split_edges(bm, edges=pedges)
bm.verts.ensure_lookup_table(); bm.verts.index_update(); bm.faces.index_update()
assert len(bm.faces) == nf0, "the rip must not create or remove faces"

# walk the hole: from F along boundary edges back to F
vF, vB = bm.verts[F], bm.verts[B]
def bnext(v, prev):
    for e in v.link_edges:
        if e.is_boundary:
            o = e.other_vert(v)
            if o is not prev:
                return o
    return None
loop = [vF]; cur, prev = vF, None
while True:
    n = bnext(cur, prev)
    if n is None or n is vF: break
    prev, cur = cur, n; loop.append(cur)
kB = loop.index(vB)
c1 = loop[1:kB]                       # one copy, F -> B
c2 = loop[kB + 1:][::-1]              # the other copy, F -> B
assert len(c1) == len(c2) == len(ring) - 2, (len(c1), len(c2), len(ring))
def side_x(chain_):
    return np.mean([np.mean([f.calc_center_median().x for f in v.link_faces]) - v.co.x for v in chain_])
if side_x(c1) < side_x(c2):
    armc, torc = c1, c2
else:
    armc, torc = c2, c1
print("arm side copy: mean face offset %.4f, chest side %.4f" % (side_x(armc), side_x(torc)))

# ------------------------------------------------------------------ 3. pocket
cpos = np.array([vF.co[:]] + [v.co[:] for v in armc] + [vB.co[:]])
seg = np.linalg.norm(np.diff(cpos, axis=0), axis=1)
u = np.concatenate([[0], np.cumsum(seg)]) / seg.sum()
# the sheet's normal: a plane fitted to the cut, pointing toward the chest (+x)
ctr = cpos.mean(0); _, _, vt = np.linalg.svd(cpos - ctr); n = vt[2]
if n[0] < 0: n = -n
up = np.array([0, 0, 1.0]) - n * n[2]; up /= np.linalg.norm(up)
pF, pB = cpos[0], cpos[-1]
zc = cpos[:, 2].min()
def vault(t):
    return pF + t * (pB - pF) + up * DOME * np.sin(np.pi * t)
zv = vault(0.5)[2]
print("sheet normal", n, " vault top z %.3f, bottom of cut z %.3f" % (zv, zc))

dl = bm.verts.layers.deform.verify()
uvP = bm.loops.layers.uv["Paint"]; uvO = bm.loops.layers.uv.get("UVMap")

# columns: index 0 = F, 1..m = cut vertices, m+1 = B
m = len(armc)
cols_arm, cols_tor = [[vF] * (K + 1)], [[vF] * (K + 1)]
info = []                                 # per new vertex: (vert, column, s, wall)
for i in range(1, m + 1):
    c = cpos[i]; V = vault(u[i]); Lc = np.linalg.norm(V - c)
    va = bm.verts.new(V)                  # the vault vertex, shared by both walls
    info.append((va, i, 1.0, 0))
    ca, ct = [armc[i - 1]], [torc[i - 1]]
    for k in range(1, K):
        s = (k / K) ** 0.6
        S = c + s * (V - c)
        h = np.clip((S[2] - zc) / max(zv - zc, 1e-6), 0, 1)
        d = GAP * (0.35 + 0.65 * h) * np.sin(np.pi * s) ** 0.8 * min(1.0, Lc / 0.03)
        pa = bm.verts.new(S - n * d); pt = bm.verts.new(S + n * d)
        ca.append(pa); ct.append(pt)
        info.append((pa, i, s, -1)); info.append((pt, i, s, +1))
    ca.append(va); ct.append(va)
    cols_arm.append(ca); cols_tor.append(ct)
cols_arm.append([vB] * (K + 1)); cols_tor.append([vB] * (K + 1))

# UV island on blank image: find room
nf = len(bm.faces)
uvs = np.array([[l[uvP].uv[:] for l in f.loops][:3] for f in bm.faces])
G = 512
cov = np.zeros((G, G), bool)
lo = np.clip((uvs.min(1) * G).astype(int), 0, G - 1); hi = np.clip((uvs.max(1) * G).astype(int), 0, G - 1)
for (x0, y0), (x1, y1) in zip(lo, hi):
    cov[y0:y1 + 1, x0:x1 + 1] = True
px, w, h = C.paint_pixels()
white = np.zeros((G, G), bool)
pw = (px.min(2) > 0.98)
white = pw[(np.arange(G) * h // G)[:, None], (np.arange(G) * w // G)[None, :]]
free = (~cov) & white
area3d = sum(f.calc_area() for f in bm.faces)
uvarea = 0.5 * np.abs(np.cross(uvs[:, 1] - uvs[:, 0], uvs[:, 2] - uvs[:, 0])).sum()
Wd, Ht = L_ring, 2 * 0.09                 # island in metres: along the cut x two walls' depth
# the largest free square-ish rect with the island's aspect, by trying sizes
best = None
ii = np.zeros((G + 1, G + 1)); ii[1:, 1:] = np.cumsum(np.cumsum(free, 0), 1)
for size in range(240, 8, -2):
    ww = size; hh = max(4, int(round(size * Ht / Wd)))
    if hh >= G - 2 or ww >= G - 2: continue
    tot = ii[hh:, ww:] - ii[:-hh, ww:] - ii[hh:, :-ww] + ii[:-hh, :-ww]     # sums of every hh x ww window
    ys, xs = np.nonzero(tot[1:-1, 1:-1] == hh * ww)
    if len(ys):
        best = (int(xs[0]) + 1, int(ys[0]) + 1, ww, hh); break
assert best, "no blank room in the Paint UV map for the pocket"
x0, y0, ww, hh = best
dens_body = (uvarea / area3d) ** 0.5               # UV units per metre on the body
dens_isl = (ww / G) / Wd
print("UV island: %d x %d cells of %d at (%d,%d); its density %.0f%% of the body's" % (ww, hh, G, x0, y0, 100 * dens_isl / dens_body))
ox, oy, sx, sy = (x0 + 0.5) / G, (y0 + 0.5) / G, (ww - 1) / G, (hh - 1) / G
def uv_of(col, k, wall):
    """wall -1: arm rows from bottom of the island up to the middle; +1: chest rows from the top down."""
    s = (k / K) ** 0.6 if 0 < k < K else (0.0 if k == 0 else 1.0)
    vv = 0.5 * s if wall < 0 else 1.0 - 0.5 * s
    return (ox + sx * u[col], oy + sy * vv)

# faces, wound against the existing face across each lip edge
new_faces = []
DEBUG_FACES = []
def make(strip, wall):
    made = []
    for i in range(m + 1):
        for k in range(K):
            q = [strip[i][k], strip[i + 1][k], strip[i + 1][k + 1], strip[i][k + 1]]
            ks = [(i, k), (i + 1, k), (i + 1, k + 1), (i, k + 1)]
            uniq, kk = [], []
            for v, key in zip(q, ks):
                if v not in uniq:
                    uniq.append(v); kk.append(key)
            if len(uniq) < 3:
                continue
            f = bm.faces.new(uniq)
            f.material_index = 0; f.smooth = True
            for l, (ci, ck) in zip(f.loops, kk):
                l[uvP].uv = uv_of(ci, ck, wall)
                if uvO: l[uvO].uv = l[uvP].uv
            made.append(f); DEBUG_FACES.append((i, k, wall))
    # orientation: the lip edge strip[1][0]-strip[2][0] must run opposite in the old face
    e = bm.edges.get((strip[1][0], strip[2][0]))
    old = [f for f in e.link_faces if f not in made][0]
    new = [f for f in e.link_faces if f in made][0]
    def dirn(f):
        for l in f.loops:
            if l.edge == e:
                return l.vert
    if dirn(old) is dirn(new):
        for f in made:
            f.normal_flip()
    return made
fa = make(cols_arm, -1); ft = make(cols_tor, +1)
new_faces = fa + ft
print("pocket: %d faces, %d new vertices" % (len(new_faces), len(info)))

# ----------------------------------------------------------------- 4. weights
bm.verts.ensure_lookup_table(); bm.verts.index_update()
names = {g.index: g.name for g in obj.vertex_groups}
gidx = {v: k for k, v in names.items()}
def wdict(v):
    return {names[g]: wt for g, wt in v[dl].items() if wt > 0}
pocket_verts = {p[0] for p in info}
# geodesic distance from each side's copy of the cut, over the old surface only
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
old_w = {v: wdict(v) for v in touched}
def norm(d):
    s = sum(d.values()); return {k: x / s for k, x in d.items()} if s > 0 else d
def mix(p, q, t):
    out = defaultdict(float)
    for k, x in p.items(): out[k] += (1 - t) * x
    for k, x in q.items(): out[k] += t * x
    return dict(out)
ARM = {"Bone.010": 1.0}
def torso_of(d):
    t = {k: x for k, x in d.items() if k not in ARM_BONES}
    return norm(t) if sum(t.values()) > 0.05 else {"Bone.001": 0.5, "Bone": 0.5}
new_w = {}
for v in touched:
    da, dt = dA.get(v, 9.0), dT.get(v, 9.0)
    sigma = dt / (da + dt) if da + dt > 0 else 0.5         # 1: arm side, 0: chest side
    tgt = mix(torso_of(old_w[v]), ARM, sigma)
    dmin = min(da, dt)
    x = np.clip((dmin - 0.4 * R) / (0.6 * R), 0, 1); f = 1 - x * x * (3 - 2 * x)
    new_w[v] = norm(mix(old_w[v], tgt, f))
for v, col, s, wall in info:
    wa, wt_ = new_w[armc[col - 1]], new_w[torc[col - 1]]
    mid = mix(wa, wt_, 0.5)
    new_w[v] = mix(wa if wall < 0 else wt_, mid, s * s) if wall else mid
# smooth over the zone (old surface near the cut + pocket), never across the cut
Z = list(new_w)
for it in range(12):
    nxt = {}
    for v in Z:
        nb = [e.other_vert(v) for e in v.link_edges]
        nb = [o for o in nb if o in new_w]
        if not nb: nxt[v] = new_w[v]; continue
        avg = defaultdict(float)
        for o in nb:
            for k_, x in new_w[o].items(): avg[k_] += x / len(nb)
        nxt[v] = mix(new_w[v], avg, 0.5)
    new_w = nxt
assert all(v.co.x < -0.12 for v in new_w), "weights touched outside the right armpit"
for v, d in new_w.items():
    top = dict(sorted(d.items(), key=lambda t: -t[1])[:4]); top = norm({k: x for k, x in top.items() if x > 1e-4})
    dv = v[dl]
    for g in list(dv.keys()):
        del dv[g]
    for k_, x in top.items():
        dv[gidx[k_]] = x
print("weights rewritten on %d vertices (%d old, %d new)" % (len(new_w), len(touched), len(info)))

np.savez(os.path.join(C.SCRATCH, "out", "repair_debug.npz"), ring=np.array([c for c in cpos]), u=u,
         faces=np.array(DEBUG_FACES), nf0=nf0, nv0=nv0)
bm.to_mesh(me); bm.free(); me.update()
me["atlas_armpit_experiment"] = "right armpit reconstruction, scratch only, 2026-10-14"
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT, check_existing=False, compress=True)
print("saved", OUT, "vertices %d -> %d, faces %d -> %d" % (nv0, len(me.vertices), nf0, len(me.polygons)))
