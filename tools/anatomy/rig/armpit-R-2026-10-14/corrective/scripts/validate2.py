"""Measure one scratch copy (repaired v4 = before, corrective = after) at
0/30/45/60/75/90 deg of right-arm elevation. Shape keys, if any, follow their
drivers.
  Blender -b <scratch .blend> --python validate2.py -- <tag>
Writes corrective/out/metrics2_<tag>.json.

  stretch        triangle area posed / rest, per group of faces
  intersections  face pairs crossing in the right armpit zone, split by kind
                 (pocket-pocket, pocket-original, original-original)
  seam           angle between the normals of the original face and the pocket
                 face on each cut edge (0 = smooth join, 90 = a right-angle edge)
  flap           arm-side vertices standing out from the upper arm's axis by more
                 than 3 cm beyond the median radius of their slice
  roundness      deviation of each wall from a circle fitted to the skin beside it
                 in the same section (arm: sections across the posed arm; chest:
                 horizontal sections); negative = inside the circle (flat or
                 dented), positive = bulging out
  preservation   UVs, materials, rest positions and painted regions of the
                 original faces against the reference copy; shape-key offsets
"""
import sys, os, json, heapq
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "scripts")); sys.dont_write_bytecode = True
import bpy, bmesh, numpy as np
from collections import Counter
from mathutils.bvhtree import BVHTree
import common as C
C.guard()
tag = sys.argv[sys.argv.index("--") + 1]
OUTD = os.path.join(C.SCRATCH, "corrective", "out")
ANG = (0, 30, 45, 60, 75, 90)
obj = bpy.data.objects["Mesh_0"]; arm = bpy.data.objects["Armature.001"]; me = obj.data
C.rest_pose(arm)
SETS = np.load(os.path.join(OUTD, "sets.npz"))
walls, dome, cut_arm, cut_chest, FB, inner = (SETS[k] for k in ("walls", "dome", "cut_arm", "cut_chest", "FB", "innerarm"))
co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)   # basis / rest
nv, nf = len(co), len(me.polygons)
ls = np.empty(nf, np.int64); me.polygons.foreach_get("loop_start", ls)
lt = np.empty(nf, np.int64); me.polygons.foreach_get("loop_total", lt)
lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get("vertex_index", lv)
ev = np.empty(len(me.edges) * 2, np.int64); me.edges.foreach_get("vertices", ev); ev = ev.reshape(-1, 2)
res = {"tag": tag, "shape_keys": [k.name for k in me.shape_keys.key_blocks] if me.shape_keys else []}

# ------------------------------------------------------------ preservation
with bpy.data.libraries.load(os.path.join(C.SCRATCH, "reference", "Male_Body.blend"), link=False) as (s_, d_):
    d_.meshes = ["Mesh_0"]
om = d_.meshes[0]; onv, onf = len(om.vertices), len(om.polygons)
oco = np.empty(onv * 3); om.vertices.foreach_get("co", oco); oco = oco.reshape(-1, 3)
nlo = ls[onf - 1] + lt[onf - 1]
def layer(mesh, name):
    a = np.empty(len(mesh.loops) * 2); mesh.uv_layers[name].data.foreach_get("uv", a); return a.reshape(-1, 2)[:nlo]
olv = np.empty(len(om.loops), np.int64); om.loops.foreach_get("vertex_index", olv)
res["orig_faces_paint_uv_identical"] = bool(np.array_equal(layer(me, "Paint"), layer(om, "Paint")))
res["orig_faces_uvmap_identical"] = bool(np.array_equal(layer(me, "UVMap"), layer(om, "UVMap")))
res["orig_corner_rest_positions_identical"] = bool(np.array_equal(co[lv[:nlo]], oco[olv[:nlo]]))
mi = np.empty(nf, np.int64); me.polygons.foreach_get("material_index", mi)
omi = np.empty(onf, np.int64); om.polygons.foreach_get("material_index", omi)
res["orig_faces_material_identical"] = bool(np.array_equal(mi[:onf], omi))
names, pal, reg = C.palette(); px, w, h = C.paint_pixels()
freg = C.face_regions(me, px, w, h, names, pal, reg)
res["orig_faces_paint_region_identical"] = bool(np.array_equal(freg[:onf], C.face_regions(om, px, w, h, names, pal, reg)))
res["faces"], res["vertices"], res["edges"] = nf, nv, len(me.edges)
face_of_loop = np.repeat(np.arange(nf), lt)
on_orig = np.zeros(nv, bool); on_orig[lv[face_of_loop < onf]] = True
if me.shape_keys:
    moved = np.zeros(nv, bool)
    for k in me.shape_keys.key_blocks[1:]:
        X = np.empty(nv * 3); k.data.foreach_get("co", X); moved |= np.abs(X.reshape(-1, 3) - co).max(1) > 0
    vreg = {}
    for f in np.flatnonzero(np.arange(nf) < onf):
        pass
    res["keys_move_vertices"] = int(moved.sum())
    res["keys_move_original_vertices"] = int((moved & on_orig).sum())
    res["keys_move_left_side_vertices"] = int((moved & (co[:, 0] > 0)).sum())
    mf = np.zeros(nf, bool); np.logical_or.at(mf, face_of_loop, moved[lv]); mf[onf:] = False
    res["keys_move_original_faces_by_region"] = dict(Counter(freg[mf]).most_common())

# ----------------------------------------------------------------- groups
tri = np.concatenate([np.stack([lv[ls[lt > k]], lv[ls[lt > k] + k - 1], lv[ls[lt > k] + k], np.flatnonzero(lt > k)], 1) for k in range(2, lt.max())])
fr = freg[tri[:, 3]]
painted = np.array([r not in ("body", "blend") for r in fr])
cen0 = co[tri[:, :3]].mean(1)
right = cen0[:, 0] < -0.10
pocket = tri[:, 3] >= onf
isinner = np.zeros(nv, bool); isinner[inner] = True
innerf = isinner[tri[:, :3]].any(1) & ~pocket
A0 = 0.5 * np.linalg.norm(np.cross(co[tri[:, 1]] - co[tri[:, 0]], co[tri[:, 2]] - co[tri[:, 0]]), axis=1)
zone = np.flatnonzero((cen0[:, 0] < -0.12) & (cen0[:, 2] > 0.40) & (cen0[:, 2] < 0.85))
zpolys = [tuple(t) for t in tri[zone, :3]]
# wall membership and depth (0 at the cut, 1 at the dome), from the rest pocket graph
fv = np.bincount(face_of_loop, np.empty(0) if False else None, minlength=nf) if False else None
uvP = np.empty(len(me.loops) * 2); me.uv_layers["Paint"].data.foreach_get("uv", uvP); uvP = uvP.reshape(-1, 2)
pl = face_of_loop >= onf
vmid = 0.5 * (uvP[pl, 1].min() + uvP[pl, 1].max())
fvv = np.bincount(face_of_loop, uvP[:, 1], minlength=nf) / lt
armwall = np.zeros(nv, bool); armwall[lv[(face_of_loop >= onf) & (fvv[face_of_loop] < vmid)]] = True
chestwall = np.zeros(nv, bool); chestwall[lv[(face_of_loop >= onf) & (fvv[face_of_loop] > vmid)]] = True
isw = np.zeros(nv, bool); isw[walls] = True
nb = [[] for _ in range(nv)]
for i, j in ev:
    if (isw[i] or not on_orig[i]) or (isw[j] or not on_orig[j]) or True:
        l = np.linalg.norm(co[i] - co[j]); nb[i].append((j, l)); nb[j].append((i, l))
def geo(src, ok):
    d = {int(v): 0.0 for v in src}; pq = [(0.0, int(v)) for v in src]
    while pq:
        x, u = heapq.heappop(pq)
        if x > d[u]: continue
        for o, l in nb[u]:
            if ok[o] and x + l < d.get(o, 9):
                d[o] = x + l; heapq.heappush(pq, (x + l, o))
    return d
ok = ~on_orig.copy()
dcut = geo(np.concatenate([cut_arm, cut_chest]), ok | False); dd = geo(dome, ok)
depth = np.full(nv, np.nan)
for v in walls:
    a, b = dcut.get(int(v), 9), dd.get(int(v), 9); depth[v] = a / (a + b)
AW = walls[armwall[walls] & ~chestwall[walls] & (depth[walls] < 0.7)]
CW = walls[chestwall[walls] & ~armwall[walls] & (depth[walls] < 0.7)]
wa = None
W = C.weights(obj); warm = W["Bone.010"] + W["Bone.011"]
# cut edges (original face | pocket face) per side
edge_faces = {}
for f in range(nf):
    vs = lv[ls[f]:ls[f] + lt[f]]
    if not (np.isin(vs, cut_arm).any() or np.isin(vs, cut_chest).any() or np.isin(vs, FB).any()): continue
    for a, b in zip(vs, np.roll(vs, -1)):
        edge_faces.setdefault((min(a, b), max(a, b)), []).append(f)
seam = {"arm": [], "chest": []}
for (a, b), fs in edge_faces.items():
    if len(fs) != 2 or (fs[0] < onf) == (fs[1] < onf): continue
    side = "arm" if (a in set(cut_arm.tolist()) or b in set(cut_arm.tolist())) else "chest"
    seam[side].append((fs[0], fs[1]) if fs[0] < onf else (fs[1], fs[0]))
cut_arm_set = set(cut_arm.tolist())
seam = {"arm": [], "chest": []}
for (a, b), fs in edge_faces.items():
    if len(fs) != 2 or (fs[0] < onf) == (fs[1] < onf): continue
    side = "arm" if (int(a) in cut_arm_set or int(b) in cut_arm_set) else "chest"
    seam[side].append((fs[0], fs[1]) if fs[0] < onf else (fs[1], fs[0]))
seam = {k: np.array(v) for k, v in seam.items()}
def face_normals(P, fl):
    out = np.zeros((len(fl), 3))
    for k in range(1, lt.max() - 1):
        m = lt[fl] > k + 1
        f = fl[m]; i0, i1, i2 = lv[ls[f]], lv[ls[f] + k], lv[ls[f] + k + 1]
        out[m] += np.cross(P[i1] - P[i0], P[i2] - P[i0])
    return out / np.maximum(np.linalg.norm(out, axis=1), 1e-15)[:, None]

def circle_dev(Q2, fit2):
    """Kasa circle fit to fit2 (n x 2); radial deviation of Q2 from it."""
    Am = np.c_[2 * fit2, np.ones(len(fit2))]; bm = (fit2 ** 2).sum(1)
    c = np.linalg.lstsq(Am, bm, rcond=None)[0]; R = np.sqrt(c[2] + c[0] ** 2 + c[1] ** 2)
    return np.linalg.norm(Q2 - c[:2], axis=1) - R, R

PAIRS = []
def self_hits(P):
    _, canon = np.unique(np.round(P / 1e-6).astype(np.int64), axis=0, return_inverse=True); canon = canon.ravel()
    t = BVHTree.FromPolygons([tuple(p) for p in P], zpolys, all_triangles=True)
    kinds = Counter(); faces = set(); PAIRS.clear()
    for i, j in t.overlap(t):
        if i < j and not set(canon[list(zpolys[i])]) & set(canon[list(zpolys[j])]):
            PAIRS.append((zone[i], zone[j]))
            pi, pj = pocket[zone[i]], pocket[zone[j]]
            kinds["pocket-pocket" if pi and pj else ("pocket-original" if pi or pj else "original-original")] += 1
            faces.add(zone[i]); faces.add(zone[j])
    return dict(kinds), faces

poses = {}
for deg in ANG:
    C.elevate(arm, deg)
    P = C.evaluated_co(obj)
    A = 0.5 * np.linalg.norm(np.cross(P[tri[:, 1]] - P[tri[:, 0]], P[tri[:, 2]] - P[tri[:, 0]]), axis=1)
    r = A / np.maximum(A0, 1e-14)
    def stats(mask):
        rr = r[mask]
        return {"tris": int(mask.sum()), ">2x": int((rr > 2).sum()), ">4x": int((rr > 4).sum()), ">10x": int((rr > 10).sum()),
                "max": round(float(rr.max()), 1), "p99": round(float(np.percentile(rr, 99)), 2), "<0.5x": int((rr < 0.5).sum()),
                "growth_cm2": round(float(np.clip(A[mask] - A0[mask], 0, None).sum() * 1e4), 1),
                "area_rest_cm2": round(float(A0[mask].sum() * 1e4), 1), "area_posed_cm2": round(float(A[mask].sum() * 1e4), 1)}
    dfb_t = np.min(np.linalg.norm(cen0[:, None] - co[FB][None], axis=2), 1)
    m10 = pocket & (r > 10)
    pocket_where = {"pocket_>10x_within_3cm_of_F_or_B": int((m10 & (dfb_t < 0.03)).sum()), "pocket_>10x_elsewhere": int((m10 & (dfb_t >= 0.03)).sum()),
                    "pocket_max_elsewhere": round(float(r[pocket & (dfb_t >= 0.03)].max()), 1),
                    "pocket_p50_elsewhere": round(float(np.median(r[pocket & (dfb_t >= 0.03)])), 2)}
    kinds, hf = self_hits(P)
    hf = np.array(sorted(hf), int)
    pr = {"stretch": {"pocket": stats(pocket), "right_painted": stats(right & painted & ~pocket),
                      "right_unpainted": stats(right & ~painted & ~pocket), "inner_arm_faces": stats(innerf)},
          "intersections": kinds, "intersection_faces_by_region": dict(Counter(np.where(pocket[hf], "pocket", fr[hf])).most_common(6)) if len(hf) else {}}
    # where the crossings are: pocket faces by depth (0 cut .. 1 dome), every face by distance to the fold ends
    if len(hf):
        hp = hf[pocket[hf]]; ho = hf[~pocket[hf]]
        dpt = np.nanmean(depth[tri[hp, :3]], 1) if len(hp) else np.zeros(1)
        dfb = lambda fs: np.min(np.linalg.norm(cen0[fs][:, None] - co[FB][None], axis=2), 1) * 100
        pr["intersection_where"] = {"pocket_depth_quartiles": [round(float(x), 2) for x in np.nanpercentile(dpt, [10, 25, 50, 75, 90])],
                                    "pocket_cm_to_fold_end_quartiles": [round(float(x), 1) for x in np.percentile(dfb(hp), [10, 25, 50, 75, 90])] if len(hp) else [],
                                    "original_cm_to_fold_end_quartiles": [round(float(x), 1) for x in np.percentile(dfb(ho), [10, 25, 50, 75, 90])] if len(ho) else [],
                                    "pocket_faces_arm_wall": int(armwall[tri[hp, :3]].all(1).sum()), "pocket_faces_chest_wall": int(chestwall[tri[hp, :3]].all(1).sum())}
        np.save(os.path.join(OUTD, "hits_%s_%d.npy" % (tag, deg)), np.array(PAIRS))
        # clusters: rest centroid of every crossing pair, rounded to 2 cm cells
        cl = Counter()
        for a_, b_ in PAIRS:
            c_ = np.round(0.5 * (cen0[a_] + cen0[b_]) / 0.02) * 2
            cl[("%+.0f %+.0f %+.0f" % tuple(c_), "pocket" if pocket[a_] else fr[a_], "pocket" if pocket[b_] else fr[b_])] += 1
        pr["intersection_clusters_cm"] = [[k[0], k[1], k[2], v] for k, v in cl.most_common(8)]
    # seam
    sm = {}
    for side, pairs in seam.items():
        if not len(pairs): continue
        n1, n2 = face_normals(P, pairs[:, 0]), face_normals(P, pairs[:, 1])
        ang = np.degrees(np.arccos(np.clip(np.abs((n1 * n2).sum(1)), -1, 1)))
        ang = np.degrees(np.arccos(np.clip((n1 * n2).sum(1), -1, 1)))
        sm[side] = {"edges": len(pairs), "median_deg": round(float(np.median(ang)), 1), "p90_deg": round(float(np.percentile(ang, 90)), 1), "max_deg": round(float(ang.max()), 1)}
    pr["seam"] = sm
    pr["pocket_stretch_where"] = pocket_where
    # flap and arm roundness
    pb = arm.pose.bones["Bone.010"]
    hd = np.array(arm.matrix_world @ pb.head); tl = np.array(arm.matrix_world @ pb.tail); Lb = np.linalg.norm(tl - hd); ax = (tl - hd) / Lb
    rel = P - hd; t = rel @ ax; radv = rel - t[:, None] * ax; rad = np.linalg.norm(radv, axis=1)
    e1 = np.cross(ax, [0, 1.0, 0]); e1 /= np.linalg.norm(e1); e2 = np.cross(ax, e1)
    q2 = np.c_[radv @ e1, radv @ e2]
    armskin = on_orig & (warm > 0.5) & (co[:, 0] < -0.15) & (co[:, 2] > 0.40)
    t_lo = np.percentile(t[AW], 5); t_hi = np.percentile(t[AW], 95)
    flap = 0; flap_max = 0.0; devs = []
    for t0 in np.arange(t_lo, t_hi, 0.01):
        sk = armskin & (t >= t0) & (t < t0 + 0.01); wl = AW[(t[AW] >= t0) & (t[AW] < t0 + 0.01)]
        if sk.sum() < 30: continue
        medr = np.median(rad[sk])
        ex = rad[sk | np.isin(np.arange(nv), wl)] - medr
        flap += int((ex > 0.03).sum()); flap_max = max(flap_max, float(ex.max()))
        if len(wl):
            d_, _ = circle_dev(q2[wl], q2[sk]); devs.append(d_)
    devs = np.concatenate(devs) if devs else np.zeros(1)
    pr["flap"] = {"vertices_>3cm_out": flap, "max_excess_cm": round(flap_max * 100, 1)}
    pr["arm_wall_roundness_mm"] = {"median_abs": round(float(np.median(np.abs(devs))) * 1e3, 1), "p5": round(float(np.percentile(devs, 5)) * 1e3, 1),
                                   "p95": round(float(np.percentile(devs, 95)) * 1e3, 1)}
    # chest wall roundness, horizontal sections
    torso = on_orig & (warm < 0.05) & (co[:, 0] < -0.10)
    cd = []
    for z0 in np.arange(np.percentile(P[CW, 2], 5), np.percentile(P[CW, 2], 95), 0.01):
        wl = CW[(P[CW, 2] >= z0) & (P[CW, 2] < z0 + 0.01)]
        if not len(wl): continue
        c2 = P[wl][:, :2].mean(0)
        sk = torso & (P[:, 2] >= z0) & (P[:, 2] < z0 + 0.01) & (np.linalg.norm(P[:, :2] - c2, axis=1) < 0.08)
        if sk.sum() < 30: continue
        d_, _ = circle_dev(P[wl][:, :2], P[sk][:, :2]); cd.append(d_)
    cd = np.concatenate(cd) if cd else np.zeros(1)
    pr["chest_wall_roundness_mm"] = {"median_abs": round(float(np.median(np.abs(cd))) * 1e3, 1), "p5": round(float(np.percentile(cd, 5)) * 1e3, 1),
                                     "p95": round(float(np.percentile(cd, 95)) * 1e3, 1)}
    if me.shape_keys: pr["key_values"] = [round(k.value, 3) for k in me.shape_keys.key_blocks[1:]]
    poses[deg] = pr
    s = pr["stretch"]
    print("%2d deg  int %-60s  pocket >4x %4d >10x %3d max %6.1f growth %6.1f | painted >4x %4d >10x %3d max %6.1f | flap %4d (%.1f cm) | seam arm %s chest %s | round arm %s chest %s" % (
        deg, kinds, s["pocket"][">4x"], s["pocket"][">10x"], s["pocket"]["max"], s["pocket"]["growth_cm2"],
        s["right_painted"][">4x"], s["right_painted"][">10x"], s["right_painted"]["max"], pr["flap"]["vertices_>3cm_out"], pr["flap"]["max_excess_cm"],
        sm.get("arm", {}).get("median_deg"), sm.get("chest", {}).get("median_deg"), pr["arm_wall_roundness_mm"], pr["chest_wall_roundness_mm"]))
C.rest_pose(arm)
res["poses"] = poses
json.dump(res, open(os.path.join(OUTD, "metrics2_%s.json" % tag), "w"), indent=1, default=str)
print(json.dumps({k: v for k, v in res.items() if k != "poses"}, indent=1, default=str))
