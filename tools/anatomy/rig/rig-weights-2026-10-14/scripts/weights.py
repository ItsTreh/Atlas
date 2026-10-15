"""Weights for the rebuilt ATLAS_Rig on one scratch copy.
  Blender -b build/<name>_rigged.blend --python scripts/weights.py -- <name> [pocket]
`pocket`: the copy carries the right-armpit repair (repair4); its vertex sets are read
from the armpit study (corrective/out/sets.npz) to fix the walls' and inner arm's sides.

Method (all on the rest mesh):
 1. Territories. Each vertex takes the nearest bone it can SEE: the straight line from
    the vertex to its closest point on the bone must stay inside the body. A twist bone
    shares its main bone's territory (split in step 4). Islands are merged into their
    neighbours, so each territory is one connected patch.
 2. Distances. For every territory, the geodesic distance over the surface (Dijkstra on
    the mesh edges) from it, out to 12 cm. Being on the surface, the distances go round
    the armpit pocket instead of jumping across it.
 3. Blending. Each joint has a half-width H (table JOINT_H). A vertex at distance d from
    a neighbouring territory gives that bone 0.5 - 0.5*smooth(d/H); its own bone gets
    0.5 + 0.5*smooth(d_nearest/H). Normalised, then 4 passes of Laplacian smoothing.
 4. Twist split: along the upper arm, upper_arm_twist (no roll) carries the shoulder half
    and upper_arm the elbow half; along the forearm, forearm_twist carries the wrist half.
 5. At most 4 influences, smallest dropped, normalised to 1.
"""
import sys, os, json, heapq, time
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import common as C
C.guard()
args = sys.argv[sys.argv.index("--") + 1:]
NAME = args[0]; POCKET = "pocket" in args; LABELS_ONLY = "labels" in args
t0 = time.time()
def say(*a): print("[%5.1fs]" % (time.time() - t0), *a, flush=True)
obj = bpy.data.objects["Mesh_0"]; ao = bpy.data.objects["ATLAS_Rig"]; me = obj.data
P = C.mesh_world(obj); nv = len(P)
ev = C.edges(me); el = np.linalg.norm(P[ev[:, 0]] - P[ev[:, 1]], axis=1)
ls, lt, lv = C.faces(me)
# CSR adjacency
src = np.r_[ev[:, 0], ev[:, 1]]; dst = np.r_[ev[:, 1], ev[:, 0]]; wl = np.r_[el, el]
o = np.argsort(src, kind="stable"); src, dst, wl = src[o], dst[o], wl[o]
indptr = np.r_[0, np.cumsum(np.bincount(src, minlength=nv))]
NB = [None] * nv
dl, wll = dst.tolist(), wl.tolist()
for i in range(nv):
    a, b = indptr[i], indptr[i + 1]; NB[i] = list(zip(dl[a:b], wll[a:b]))
say("mesh", nv, "verts", len(ev), "edges, median edge %.1f mm" % (np.median(el) * 1e3))

# ------------------------------------------------------------------ bones
MW = np.array(ao.matrix_world)
def Wp(v): return (MW @ np.r_[np.array(v), 1])[:3]
DEF = [b for b in ao.data.bones if b.use_deform]
HEAD = {b.name: Wp(b.head_local) for b in DEF}; TAIL = {b.name: Wp(b.tail_local) for b in DEF}
MERGE = {}                                   # twist bones share the main bone's territory
for s in ("L", "R"):
    MERGE["upper_arm_twist." + s] = "upper_arm." + s
    MERGE["forearm_twist." + s] = "forearm." + s
LAB = [b.name for b in DEF if b.name not in MERGE]; LI = {n: i for i, n in enumerate(LAB)}
nl = len(LAB)
def fam(n):
    b = n.split(".")[0]
    for f in ("thumb", "index", "middle", "ring", "pinky"):
        if b.startswith(f): return f
    return b
def side(n): return n.split(".")[1] if "." in n else "C"
def seg_dist(Pts, h, t):
    d = t - h; L2 = d @ d; tt = np.clip(((Pts - h) @ d) / L2, 0, 1)
    Q = h + tt[:, None] * d; return np.linalg.norm(Pts - Q, axis=1), Q, tt
# Territory distance = distance to the bone's capsule (radius RAD), with points BEHIND a
# bone's head counted K_BEHIND times (so the belly is not "thigh" and the back of the hand
# not "finger"). Trunk bones are measured from the torso's centre line at their height,
# not from the spine, which runs close under the skin of the back.
TRUNK = ("pelvis", "spine_01", "spine_02", "spine_03", "spine_04", "neck")
def rad(n):
    b = n.split(".")[0]
    if b in ("spine_01", "spine_02", "spine_03", "spine_04"): return 0.11
    if b == "pelvis": return 0.10
    if b == "neck": return 0.05
    return {"clavicle": 0.015, "scapula": 0.02, "upper_arm": 0.04, "forearm": 0.03, "hand": 0.015, "thigh": 0.06, "shin": 0.04,
            "foot": 0.025, "toe": 0.01, "thumb_01": 0.012}.get(b, 0.006)
K_BEHIND = 2.0
def centre(p):
    """Middle of the torso's front-back extent in the slice through p (within 6 cm of it in x;
    the extent, not the vertex centroid, which the dense sculpt detail of the abs biases)."""
    m = (np.abs(P[:, 2] - p[2]) < 0.008) & (np.abs(P[:, 0] - p[0]) < 0.06)
    return np.array([p[0], 0.5 * (P[m, 1].min() + P[m, 1].max()), p[2]])
SEG = {}
for n in LAB:
    h, t = HEAD[n], TAIL[n]
    if n in TRUNK and n != "neck": h, t = centre(h), centre(t)
    SEG[n] = (h, t)
def eff_dist(Pts, n):
    h, t = SEG[n]; d = t - h; L = np.linalg.norm(d); u = d / L
    rel = Pts - h; al = rel @ u
    behind = np.clip(-al, 0, None); beyond = np.clip(al - L, 0, None)
    perp = np.linalg.norm(rel - al[:, None] * u, axis=1)
    kb = 1.0 if n in TRUNK else K_BEHIND
    return np.sqrt(perp ** 2 + (kb * behind) ** 2 + beyond ** 2) - rad(n)
D = np.empty((nv, nl), np.float32)
for i, n in enumerate(LAB): D[:, i] = eff_dist(P, n)
json.dump({n: [np.round(SEG[n][0], 4).tolist(), np.round(SEG[n][1], 4).tolist()] for n in TRUNK}, open(os.path.join(C.SCRATCH, "out", "trunk_centre_segments.json"), "w"))
say("bone distances")

# ------------------------------------------------------------------ 1. territories
polys = [tuple(lv[ls[i]:ls[i] + lt[i]]) for i in range(len(ls))]
bvh = BVHTree.FromPolygons([tuple(p) for p in P], polys)
order = np.argsort(D, axis=1)[:, :6]
label = np.full(nv, -1, np.int64)
blocked = 0
for v in range(nv):
    pv = P[v]
    for k in range(6):
        bi = order[v, k]; n = LAB[bi]
        _, Q, _ = seg_dist(pv[None], *SEG[n]); q = Q[0]
        d = q - pv; L = np.linalg.norm(d)
        if L < 1e-6: label[v] = bi; break
        dv = Vector(d / L); st = Vector(pv) + dv * 2e-4
        hit = bvh.ray_cast(st, dv, L - 4e-4)
        if hit[0] is None: label[v] = bi; break
        blocked += 1
    if label[v] < 0: label[v] = order[v, 0]
say("visible-nearest labels; %d occluded candidates skipped" % blocked)

# forced sides in the repaired armpit
pocket_info = {}
if POCKET:
    S = np.load(os.path.join(C.ARMPIT, "corrective", "out", "sets.npz"))
    walls, dome, cut_arm, cut_chest, FB, inner = (S[k] for k in ("walls", "dome", "cut_arm", "cut_chest", "FB", "innerarm"))
    nf_orig = 287219
    fol = np.repeat(np.arange(len(ls)), lt)
    uvP = np.empty(len(me.loops) * 2); me.uv_layers["Paint"].data.foreach_get("uv", uvP); uvP = uvP.reshape(-1, 2)
    pl = fol >= nf_orig; vmid = 0.5 * (uvP[pl, 1].min() + uvP[pl, 1].max())
    fvv = np.bincount(fol, uvP[:, 1], minlength=len(ls)) / lt
    armwall = np.zeros(nv, bool); armwall[lv[pl & (fvv[fol] < vmid)]] = True
    chestwall = np.zeros(nv, bool); chestwall[lv[pl & (fvv[fol] > vmid)]] = True
    isdome = np.zeros(nv, bool); isdome[dome] = True
    ua = LI["upper_arm.R"]
    armside = (armwall & ~chestwall & ~isdome); armside[cut_arm] = True; armside[inner] = True; armside[FB] = False
    label[armside] = ua
    chestside = (chestwall & ~armwall) | isdome; chestside[cut_chest] = True; chestside[FB] = False
    # chest side: the territory of the nearest ordinary chest skin (not an arm bone)
    from mathutils.kdtree import KDTree
    arm_ids = [LI[n] for n in LAB if n.endswith(".R") and fam(n) in ("upper_arm", "forearm", "hand", "thumb", "index", "middle", "ring", "pinky")]
    ref = np.flatnonzero(~armside & ~chestside & ~np.isin(label, arm_ids) & (P[:, 0] < -0.05) & (P[:, 2] > 0.35) & (P[:, 2] < 0.9))
    kd = KDTree(len(ref))
    for k_, v in enumerate(ref): kd.insert(P[v], k_)
    kd.balance()
    cs = np.flatnonzero(chestside)
    label[cs] = [label[ref[kd.find(P[v])[1]]] for v in cs]
    locked = armside | chestside
    pocket_info = dict(arm_side=int(armside.sum()), chest_side=int(chestside.sum()),
                       chest_side_territories={LAB[k]: int(c) for k, c in zip(*np.unique(label[cs], return_counts=True))})
    say("pocket sides", pocket_info)
else:
    locked = np.zeros(nv, bool)

def components(mask):
    comp = np.full(nv, -1, np.int64); c = 0
    for s in np.flatnonzero(mask):
        if comp[s] >= 0: continue
        comp[s] = c; st = [s]
        while st:
            u = st.pop()
            for w_, _ in NB[u]:
                if mask[w_] and comp[w_] < 0: comp[w_] = c; st.append(w_)
        c += 1
    return comp, c
# islands: keep each territory's biggest piece; the rest joins its neighbours
moved = 0
for it in range(6):
    stray = np.zeros(nv, bool)
    for i in range(nl):
        m = label == i
        if not m.any(): continue
        comp, c = components(m)
        if c > 1:
            sizes = np.bincount(comp[m])
            stray |= m & (comp != sizes.argmax()) & ~locked
    if not stray.any(): break
    moved += int(stray.sum())
    for _ in range(200):
        idx = np.flatnonzero(stray)
        if not len(idx): break
        new = {}
        for v in idx:
            cnt = {}
            for w_, _ in NB[v]:
                if not stray[w_]: cnt[label[w_]] = cnt.get(label[w_], 0) + 1
            if cnt: new[v] = max(cnt, key=cnt.get)
        for v, l_ in new.items(): label[v] = l_; stray[v] = False
say("islands merged: %d vertices" % moved)
np.save(os.path.join(C.SCRATCH, "out", "labels_%s.npy" % NAME), label)
json.dump(LAB, open(os.path.join(C.SCRATCH, "out", "label_names.json"), "w"))

def colour_attr(name, rgb):
    a = me.color_attributes.get(name) or me.color_attributes.new(name, 'BYTE_COLOR', 'POINT')
    c = np.ones((nv, 4), np.float32); c[:, :3] = rgb; a.data.foreach_set("color", c.ravel()); return a
FAM = {"pelvis": (0.15, 0.25, 0.55), "spine_01": (0.25, 0.4, 0.75), "spine_02": (0.45, 0.6, 0.9), "spine_03": (0.65, 0.78, 0.95),
       "spine_04": (0.3, 0.7, 0.8), "neck": (0.1, 0.5, 0.5), "clavicle": (0.95, 0.85, 0.2), "scapula": (0.95, 0.55, 0.1),
       "upper_arm": (0.85, 0.15, 0.15), "forearm": (0.85, 0.3, 0.7), "hand": (0.55, 0.3, 0.75), "thigh": (0.35, 0.7, 0.3),
       "shin": (0.2, 0.55, 0.45), "foot": (0.6, 0.45, 0.3), "toe": (0.35, 0.25, 0.15)}
FING = {"thumb": (0.95, 0.6, 0.6), "index": (0.6, 0.95, 0.6), "middle": (0.6, 0.6, 0.95), "ring": (0.95, 0.95, 0.5), "pinky": (0.5, 0.95, 0.95)}
def fam_col(n):
    b = n.split(".")[0]
    if b in FAM: c = np.array(FAM[b])
    else: c = np.array(FING[b.split("_")[0]]) * (1.0 - 0.22 * (int(b[-1]) - 1))
    return c if not n.endswith(".L") else c * 0.8 + 0.1
pal = np.array([fam_col(n) for n in LAB])
colour_attr("Territory", pal[label])
if LABELS_ONLY:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(C.SCRATCH, "build", NAME + "_labels.blend"), check_existing=False, compress=True)
    say("labels saved"); raise SystemExit

# ------------------------------------------------------------------ 2. geodesic distance fields
TRUNKF = {"pelvis", "spine_01", "spine_02", "spine_03", "spine_04"}
def joint_h(a, b):
    """Half-width (m) of the blend between territories a and b."""
    fa, fb = fam(a), fam(b); pair = {fa, fb}
    if side(a) != side(b) and "C" not in (side(a), side(b)): return 0.004          # left against right (inner thighs)
    if pair <= TRUNKF: return 0.06
    if pair == {"neck", "spine_04"}: return 0.03
    if "neck" in pair and pair & {"clavicle", "scapula"}: return 0.03
    if "clavicle" in pair and (pair & TRUNKF): return 0.05
    if "scapula" in pair and (pair & TRUNKF): return 0.06
    if pair == {"clavicle", "scapula"}: return 0.04
    if "upper_arm" in pair and (pair & ({"clavicle", "scapula"} | TRUNKF)): return H_SHOULDER
    if pair == {"upper_arm", "forearm"}: return 0.035
    if pair == {"forearm", "hand"}: return 0.025
    if "hand" in pair and len(pair) == 2 and (pair - {"hand"}).pop() in ("thumb", "index", "middle", "ring", "pinky"):
        other = a if fam(b) == "hand" else b
        if other.split(".")[0].endswith("_01"): return 0.02 if fam(other) == "thumb" else 0.015
        return 0.004
    if len(pair) == 1 and fa in ("thumb", "index", "middle", "ring", "pinky"): return 0.008
    if "thigh" in pair and (pair & TRUNKF): return 0.07
    if pair == {"thigh", "shin"}: return 0.045
    if pair == {"shin", "foot"}: return 0.03
    if pair == {"foot", "toe"}: return 0.015
    return 0.004                                                                       # touching, unrelated parts
H_SHOULDER = float(os.environ.get("ATLAS_H_SHOULDER", "0.05"))
Hm = np.array([[joint_h(a, b) for b in LAB] for a in LAB])
RMAX = float(Hm.max()) + 0.005
Df = np.full((nv, nl), np.inf, np.float32)
lab_l = label.tolist()
for b in range(nl):
    mem = label == b
    if not mem.any(): continue
    # the territory's border vertices start at 0; distances run outward only
    srcs = [v for v in np.flatnonzero(mem) if any(lab_l[w_] != b for w_, _ in NB[v])]
    dist = {v: 0.0 for v in srcs}; pq = [(0.0, v) for v in srcs]; heapq.heapify(pq)
    while pq:
        x, u = heapq.heappop(pq)
        if x > dist[u]: continue
        for w_, l_ in NB[u]:
            if lab_l[w_] == b: continue
            y = x + l_
            if y < RMAX and y < dist.get(w_, 9.0):
                dist[w_] = y; heapq.heappush(pq, (y, w_))
    ks = np.fromiter(dist.keys(), np.int64); vs = np.fromiter(dist.values(), np.float32)
    keep = ~mem[ks]; Df[ks[keep], b] = vs[keep]
say("distance fields (to %.0f mm)" % (RMAX * 1e3))
if POCKET:
    # pocket depth: geodesic distance from the arm-side cut to the chest side, through the walls
    non_arm = [k for k in range(nl) if k not in arm_ids]
    dd = Df[cut_arm][:, non_arm].min(1)
    pocket_info["arm_cut_to_chest_territory_mm"] = {"reached_within_%dmm" % (RMAX * 1e3): int(np.isfinite(dd).sum()), "of": len(dd),
                                                    "percentiles_0_10_50": [round(float(x) * 1e3, 1) for x in np.percentile(dd[np.isfinite(dd)], [0, 10, 50])] if np.isfinite(dd).any() else None}

# ------------------------------------------------------------------ 3. blending
def sm(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
R = np.zeros((nv, nl), np.float32)
Hv = Hm[label].astype(np.float32)                          # (nv, nl): H between own territory and each bone
# Asymmetric armpit blend (ATLAS_H_ARM_SIDE): below the shoulder (6 cm under the joint), arm
# skin fades to the torso over a shorter H than torso skin fades to the arm, so the inner arm
# stays on the arm and the chest wall and folds take the stretch.
H_ARM_SIDE = float(os.environ.get("ATLAS_H_ARM_SIDE", "0"))
if H_ARM_SIDE > 0:
    torso_cols_all = [k for k, n in enumerate(LAB) if fam(n) in TRUNKF | {"clavicle", "scapula"}]
    for s_ in ("L", "R"):
        ua_i = LI["upper_arm." + s_]
        rows = np.flatnonzero((label == ua_i) & (P[:, 2] < HEAD["upper_arm." + s_][2] - 0.06))
        cols = [k for k in torso_cols_all if side(LAB[k]) in (s_, "C")]
        Hv[np.ix_(rows, cols)] = H_ARM_SIDE
ratio = Df / Hv
ratio[np.arange(nv), label] = np.inf
R = np.where(ratio < 1, 0.5 - 0.5 * sm(ratio), 0).astype(np.float32)
own = 0.5 + 0.5 * sm(ratio.min(1))
R[np.arange(nv), label] = own
R /= R.sum(1, keepdims=True)
# Laplacian smoothing (uniform), a few passes, to iron out the graph metric's zigzag
deg = np.diff(indptr).astype(np.float32)
for _ in range(4):
    Nsum = np.add.reduceat(R[dst], indptr[:-1], axis=0)
    R = 0.5 * R + 0.5 * Nsum / deg[:, None]
# Fold ends (ATLAS_FB_SMOOTH passes): extra smoothing within FB_R of the anterior and posterior
# fold ends F and B, where the pocket walls meet the folds, so the walls ease into the folds
# instead of pinching against each other.
FB_SMOOTH = int(os.environ.get("ATLAS_FB_SMOOTH", "0")); FB_R = float(os.environ.get("ATLAS_FB_R", "0.04"))
if POCKET and FB_SMOOTH:
    dfb = np.min(np.linalg.norm(P[:, None, :] - P[FB][None], axis=2), 1)
    loc = np.flatnonzero(dfb < FB_R + 0.01); fade = (1 - sm((dfb[loc] - FB_R + 0.01) / 0.02))[:, None].astype(np.float32)
    for _ in range(FB_SMOOTH):
        Nsum = np.add.reduceat(R[dst], indptr[:-1], axis=0)
        R[loc] = (1 - 0.5 * fade) * R[loc] + 0.5 * fade * Nsum[loc] / deg[loc, None]
    pocket_info["fold_end_smoothing"] = dict(passes=FB_SMOOTH, radius_m=FB_R, vertices=int(len(loc)))
say("blended")

# ------------------------------------------------------------------ 4. twist split
NAMES = [b.name for b in DEF]; NI = {n: i for i, n in enumerate(NAMES)}
Wt = np.zeros((nv, len(NAMES)), np.float32)
for i, n in enumerate(LAB): Wt[:, NI[n]] = R[:, i]
def along(n):
    h, t = HEAD[n], TAIL[n]; d = t - h; return np.clip(((P - h) @ d) / (d @ d), 0, 1)
for s in ("L", "R"):
    ua, uat = NI["upper_arm." + s], NI["upper_arm_twist." + s]
    f = 1 - sm((along("upper_arm." + s) - 0.25) / 0.5)          # 1 at the shoulder third, 0 near the elbow
    Wt[:, uat] = Wt[:, ua] * f; Wt[:, ua] *= (1 - f)
    fa, fat = NI["forearm." + s], NI["forearm_twist." + s]
    g = sm((along("forearm." + s) - 0.3) / 0.5)                  # 0 at the elbow, 1 toward the wrist
    Wt[:, fat] = Wt[:, fa] * g; Wt[:, fa] *= (1 - g)

# ------------------------------------------------------------------ 5. four influences, normalised
top = np.argsort(-Wt, axis=1)[:, :4]
Wl = np.take_along_axis(Wt, top, 1); Wl[Wl < 1e-3] = 0; Wl /= Wl.sum(1, keepdims=True)
dropped = 1 - np.take_along_axis(Wt, top, 1).sum(1) / Wt.sum(1)
Wf = np.zeros_like(Wt); np.put_along_axis(Wf, top, Wl, 1)
say("weights: max dropped by the 4-influence limit %.3f, vertices with >4 nonzero before %d" % (dropped.max(), int(((Wt > 1e-3).sum(1) > 4).sum())))
np.savez_compressed(os.path.join(C.SCRATCH, "out", "weights_%s.npz" % NAME), W=Wf, names=np.array(NAMES), label=label)

# ------------------------------------------------------------------ write groups
for n in NAMES:
    g = obj.vertex_groups.get(n) or obj.vertex_groups.new(name=n)
    col = Wf[:, NI[n]]; nz = np.flatnonzero(col > 0)
    g.remove(list(range(nv)))
    for w_ in np.unique(np.round(col[nz], 4)):
        idx = nz[np.round(col[nz], 4) == w_]
        g.add(idx.tolist(), float(w_), 'REPLACE')
# weight views: upper arm (+twist) as a heat colour, for renders
def heat(x):
    x = np.clip(x, 0, 1)[:, None]
    return np.where(x < 0.5, (1 - 2 * x) * np.array([0.15, 0.25, 0.8]) + 2 * x * np.array([0.95, 0.95, 0.3]),
                    (2 - 2 * x) * np.array([0.95, 0.95, 0.3]) + (2 * x - 1) * np.array([0.85, 0.1, 0.1]))
colour_attr("W_upper_arm_R", heat(Wf[:, NI["upper_arm.R"]] + Wf[:, NI["upper_arm_twist.R"]]))
colour_attr("W_upper_arm_L", heat(Wf[:, NI["upper_arm.L"]] + Wf[:, NI["upper_arm_twist.L"]]))
info = dict(name=NAME, pocket=POCKET, H_shoulder=H_SHOULDER, H_arm_side=H_ARM_SIDE, max_influences=int((Wf > 0).sum(1).max()),
            sum_err=float(np.abs(Wf.sum(1) - 1).max()), **pocket_info)
if POCKET:
    ua_r = Wf[:, NI["upper_arm.R"]] + Wf[:, NI["upper_arm_twist.R"]]
    info["inner_arm_upper_arm_weight"] = [round(float(x), 3) for x in np.percentile(ua_r[inner], [0, 5, 50])]
    info["arm_cut_upper_arm_weight"] = [round(float(x), 3) for x in np.percentile(ua_r[cut_arm], [0, 5, 50])]
    info["chest_cut_upper_arm_weight"] = [round(float(x), 3) for x in np.percentile(ua_r[cut_chest], [50, 95, 100])]
json.dump(info, open(os.path.join(C.SCRATCH, "out", "weights_%s.json" % NAME), "w"), indent=1)
say(json.dumps(info))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(C.SCRATCH, "build", NAME + "_weighted.blend"), check_existing=False, compress=True)
say("saved")
