"""Read-only: the left armpit's notches and crotch, measured on its own geometry.
  Blender -b original/Male_Body_rigged.blend --python scripts/probe2.py
Per horizontal slice (every 2 mm) through the fused zone: the contour near the left
armpit, ordered; its convex hull; the bays (runs of contour off the hull). The front
bay's and back bay's deepest points are the notches, with the paint on each flank.
Per front-to-back slice (x-z plane at fixed y), the underside of the bridge: the crotch.
Renders the area at rest (clay + paint) from mirrored versions of the armpit cameras."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from collections import Counter, defaultdict
import common as C, viz as V
C.guard()
obj = bpy.data.objects["Mesh_0"]; me = obj.data; ao = bpy.data.objects["ATLAS_Rig"]
P = C.mesh_world(obj)
tri = C.triangles(me); freg = C.face_regions(me); tr = freg[tri[:, 3]]
cen = P[tri[:, :3]].mean(1)
short = lambda r: r.replace("-brachii", "").replace("-dorsi", "").replace("-anterior", "").replace("-major", "M").replace(".L", "").replace(".R", "")

def contour(axis, c, win):
    """Ordered closed contours of the plane P[:,axis]=c among triangles whose centre passes win."""
    zz = P[:, axis] - c
    s_ = np.sign(zz[tri[:, :3]]); s_[s_ == 0] = 1
    cross = ~((s_ == s_[:, :1]).all(1)) & win(cen)
    nxt = defaultdict(list); pos = {}; lab = {}
    for t in np.flatnonzero(cross):
        vs = tri[t, :3]; keys = []
        for i, j in ((vs[0], vs[1]), (vs[1], vs[2]), (vs[2], vs[0])):
            if (zz[i] >= 0) != (zz[j] >= 0):
                k = (min(i, j), max(i, j)); u = zz[i] / (zz[i] - zz[j]); pos[k] = P[i] + u * (P[j] - P[i]); keys.append(k)
        if len(keys) == 2:
            nxt[keys[0]].append((keys[1], tr[t])); nxt[keys[1]].append((keys[0], tr[t]))
    seen, loops = set(), []
    for s in list(nxt):
        if s in seen: continue
        loop, labs, cur, prev = [s], [], s, None; seen.add(s)
        while True:
            cand = [(k, l) for k, l in nxt[cur] if k != prev and k not in seen]
            if not cand:
                break
            prev, (cur, l) = cur, cand[0]; seen.add(cur); loop.append(cur); labs.append(l)
        loops.append((np.array([pos[k] for k in loop]), labs + [labs[-1] if labs else "?"], loop))
    loops.sort(key=lambda L: -len(L[0]))
    return loops

def hull2(Q):
    """Indices of the 2D convex hull (monotone chain), counter-clockwise."""
    idx = np.lexsort((Q[:, 1], Q[:, 0])); pts = Q[idx]
    def half(seq):
        h = []
        for i in seq:
            while len(h) >= 2:
                a, b = Q[h[-2]], Q[h[-1]]; c = Q[i]
                if (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) <= 0: h.pop()
                else: break
            h.append(i)
        return h
    lo = half(idx); up = half(idx[::-1])
    return lo[:-1] + up[:-1]

win = lambda c: (c[:, 0] > 0.12) & (c[:, 0] < 0.36)
rows = []
for z in np.arange(0.520, 0.722, 0.002):
    L = contour(2, z, win)
    if not L: continue
    Q3, labs, keys = L[0]; Q = Q3[:, :2]
    # restrict to the outer part (x > 0.15): the torso's front and back walls run to x=0.12
    h = hull2(Q); onh = np.zeros(len(Q), bool); onh[h] = True
    # distance of each point to the hull polygon
    H = Q[h]; Hn = np.roll(H, -1, 0)
    def dist_to_hull(p):
        d = Hn - H; t = np.clip(((p - H) * d).sum(1) / (d * d).sum(1), 0, 1); return np.min(np.linalg.norm(H + t[:, None] * d - p, axis=1))
    dep = np.array([dist_to_hull(p) for p in Q])
    # bays: maximal runs with dep > 1 mm
    n = len(Q); off = dep > 0.001
    bays = []; i = 0
    if off.all(): continue
    start = int(np.flatnonzero(~off)[0])
    run = []
    for k in range(1, n + 1):
        j = (start + k) % n
        if off[j]: run.append(j)
        elif run: bays.append(run); run = []
    for b in bays:
        k = b[int(np.argmax(dep[b]))]
        if dep[k] < 0.004 or Q[k, 0] < 0.15: continue
        # paint on each side of the notch within 1.5 cm along the contour
        def side_paint(dirn):
            acc, out, j = 0.0, Counter(), k
            while acc < 0.015:
                jn = (j + dirn) % n; acc += np.linalg.norm(Q[jn] - Q[j]); out[short(labs[jn])] += 1; j = jn
            return out.most_common(2)
        rows.append(dict(z=round(float(z), 3), x=round(float(Q[k, 0]), 4), y=round(float(Q[k, 1]), 4), depth_mm=round(float(dep[k]) * 1e3, 1),
                         bay_len=len(b), a=side_paint(-1), b=side_paint(+1), nloops=len(L)))
for r in rows:
    print("z %.3f  notch x %.4f y %+.4f depth %5.1f mm  run %4d  | %s | %s | loops %d" % (r["z"], r["x"], r["y"], r["depth_mm"], r["bay_len"], r["a"], r["b"], r["nloops"]))
json.dump(rows, open(os.path.join(C.SCRATCH, "out", "probe2_notches.json"), "w"), indent=0)

# crotch: per x-z slice at fixed y, the lowest point of the bridge (highest point of the gap below it)
print("--- crotch (x-z slices at fixed y)")
cr = []
for y in np.arange(-0.06, 0.16, 0.004):
    L = contour(1, y, lambda c: (c[:, 0] > 0.15) & (c[:, 0] < 0.30) & (c[:, 2] > 0.44) & (c[:, 2] < 0.75))
    if not L: continue
    pts = np.concatenate([l[0] for l in L])
    # points in the gap column between the torso (x<0.19) and the arm: the lowest underside of the bridge
    m = (pts[:, 0] > 0.17) & (pts[:, 0] < 0.215)
    if not m.any(): continue
    q = pts[m]
    # the bridge's underside: in this column, the highest z of the gap is the crotch; report the z
    # distribution of crossings to read it
    zs = np.sort(q[:, 2])
    print("y %+.3f: %d crossings in x 0.17-0.215; z %s" % (y, m.sum(), np.round(zs[:12], 3)))
    cr.append(dict(y=round(float(y), 3), z=[round(float(t), 4) for t in zs]))
json.dump(cr, open(os.path.join(C.SCRATCH, "out", "probe2_crotch.json"), "w"))

# renders at rest
OUT = os.path.join(C.SCRATCH, "renders", "probe"); os.makedirs(OUT, exist_ok=True)
ao.hide_render = True
px, w, h = C.paint_pixels()
nl = len(me.loops)
uv = np.empty(nl * 2); me.uv_layers["Paint"].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
pc = np.ones((nl, 4), np.float32)
pc[:, :3] = px[np.clip((uv[:, 1] * h).astype(int), 0, h - 1), np.clip((uv[:, 0] * w).astype(int), 0, w - 1)]
pa = me.color_attributes.new("PaintView", 'BYTE_COLOR', 'CORNER'); pa.data.foreach_set("color", pc.ravel())
V.setup_workbench((560, 560)); bpy.context.scene.display.shading.show_specular_highlight = True
for side, tgt, sx in (("L", (0.235, 0.04, 0.60), 1), ("R", (-0.255, 0.02, 0.63), -1)):
    VIEWS = {"front": ((0.30 * sx, -1.0, -0.08), 0.50), "back": ((0.30 * sx, 1.0, -0.08), 0.50), "under": ((1.0 * sx, -0.12, -0.75), 0.42),
             "side": ((1.0 * sx, 0.0, 0.0), 0.45)}
    for view, (d, sc) in VIEWS.items():
        V.camera(tgt, d, ortho_scale=sc)
        V.render(os.path.join(OUT, "clay_%s_%s.png" % (side, view)), 'SINGLE')
        me.color_attributes.active_color = pa
        V.render(os.path.join(OUT, "paint_%s_%s.png" % (side, view)), 'VERTEX')
print("done")
