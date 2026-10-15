"""Measure one arm of one scratch copy at 0/30/45/60/75/90 deg of elevation, the other arm at rest.
  Blender -b <file>.blend --python scripts/validate2.py -- <tag> L|R
The rig-weights study's validate.py, made per side. Elevation: the upper-arm bone turned
about the world y axis through its head (outward for each side), nothing else moved.
Vertex sets are fixed by index on rest positions, so the baseline and the repair are
measured on the same skin (the baseline's 153,898 vertices keep their indices).

  stretch       triangle area posed / rest, per group: that side's painted muscle and unpainted
                skin, the pocket walls, the inner arm, the deltoid
  intersections face pairs crossing in that armpit's zone (|x|>0.12, 0.40<z<0.85)
  flap          arm skin > 3 cm further from the posed upper-arm axis than its slice's median
  bone          posed upper-arm bone: samples inside the posed skin, least clearance
  volume        whole-body volume posed / rest
  seam, wall    (repaired side) crease angle across the cut; arm wall's distance off a round section
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from collections import Counter
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
import common as C
C.guard()
tag, SIDE = sys.argv[sys.argv.index("--") + 1:][:2]
SX = -1.0 if SIDE == "R" else 1.0
ANG = (0, 30, 45, 60, 75, 90)
NVB, NFB, NF_R0 = 153898, 297459, 287219
obj = bpy.data.objects["Mesh_0"]; me = obj.data; arm = bpy.data.objects["ATLAS_Rig"]; BONE = "upper_arm." + SIDE
C.rest_pose(arm)
co = C.mesh_world(obj); nv = len(co)
ls, lt, lv = C.faces(me); nf = len(ls)
tri = C.triangles(me)
freg = C.face_regions(me); fr = freg[tri[:, 3]]
painted = ~np.isin(fr, ["body", "blend"])
if SIDE == "R":
    S = np.load(os.path.join(C.ARMPIT, "corrective", "out", "sets.npz"))
    pocket = (tri[:, 3] >= NF_R0) & (tri[:, 3] < NFB); REP = True
    inner, FB, cut_arm, cut_chest = S["innerarm"], S["FB"], S["cut_arm"], S["cut_chest"]
    fol = np.repeat(np.arange(nf), lt)
    uvP = np.empty(len(me.loops) * 2); me.uv_layers["Paint"].data.foreach_get("uv", uvP); uvP = uvP.reshape(-1, 2)
    pl = (fol >= NF_R0) & (fol < NFB); vmid = 0.5 * (uvP[pl, 1].min() + uvP[pl, 1].max())
    fvv = np.bincount(fol, uvP[:, 1], minlength=nf) / lt
    armwall = np.zeros(nv, bool); armwall[lv[pl & (fvv[fol] < vmid)]] = True
    chestwall = np.zeros(nv, bool); chestwall[lv[pl & (fvv[fol] > vmid)]] = True
    wall_arm = np.flatnonzero(armwall & ~chestwall)
else:
    S = np.load(os.path.join(C.SCRATCH, "out", "sets_L.npz"))
    REP = nf > NFB
    pocket = tri[:, 3] >= NFB
    inner = S["innerarm"]; inner = inner[inner < nv]
    if REP: FB, cut_arm, cut_chest, wall_arm = S["FB"], S["cut_arm"], S["cut_chest"], S["wall_arm"]
    else: FB = S["FB"]
cen0 = co[tri[:, :3]].mean(1)
side_m = SX * cen0[:, 0] > 0.10
res = {"tag": tag, "side": SIDE, "bone": BONE, "vertices": nv, "faces": nf, "repaired_side": bool(REP),
       "shape_keys": [k.name for k in me.shape_keys.key_blocks] if me.shape_keys else []}
isinner = np.zeros(nv, bool); isinner[inner] = True
innerf = isinner[tri[:, :3]].any(1) & ~pocket
# arm skin for the flap test: the upper-arm territory (labels from weightsL.py, nearest visible bone), between 0.3 and 0.9 of the bone
LAB = json.load(open(os.path.join(C.RIGW, "out", "label_names.json")))
TERR = np.load(os.path.join(C.SCRATCH, "out", "labels_L_v1.npy"))[:NVB] == LAB.index(BONE)
b_ = arm.data.bones[BONE]; MW = np.array(arm.matrix_world)
h0 = (MW @ np.r_[np.array(b_.head_local), 1])[:3]; t0_ = (MW @ np.r_[np.array(b_.tail_local), 1])[:3]
ax0 = (t0_ - h0) / np.linalg.norm(t0_ - h0)
rel = co - h0; tt = rel @ ax0 / np.linalg.norm(t0_ - h0)
armskin = (np.arange(nv) < NVB) & (tt > 0.3) & (tt < 0.9); armskin[:NVB] &= TERR
A0 = 0.5 * np.linalg.norm(np.cross(co[tri[:, 1]] - co[tri[:, 0]], co[tri[:, 2]] - co[tri[:, 0]]), axis=1)
def volume(X):
    a, b, c = X[tri[:, 0]], X[tri[:, 1]], X[tri[:, 2]]
    return float(np.einsum("ij,ij->i", a, np.cross(b, c)).sum() / 6)
V0 = volume(co)
zone = np.flatnonzero((SX * cen0[:, 0] > 0.12) & (cen0[:, 2] > 0.40) & (cen0[:, 2] < 0.85))
zpolys = [tuple(t) for t in tri[zone, :3]]
delt = fr == "deltoid." + SIDE
if REP:
    kd = KDTree(len(cut_arm))
    for k_, v in enumerate(cut_arm): kd.insert(co[v], k_)
    kd.balance()
    AW = np.array([v for v in wall_arm if kd.find(co[v])[2] < 0.025])
    pf = np.zeros(nf, bool); pf[np.unique(tri[pocket, 3])] = True
    ca, cc = set(cut_arm.tolist()), set(cut_chest.tolist())
    fol = np.repeat(np.arange(nf), lt)
    ef = {}
    for f in np.unique(fol[np.isin(lv, cut_arm) | np.isin(lv, cut_chest)]):
        vs = lv[ls[f]:ls[f] + lt[f]]
        for a_, b2 in zip(vs, np.roll(vs, -1)): ef.setdefault((min(a_, b2), max(a_, b2)), []).append(f)
    seam = {"arm": [], "chest": []}
    for (a_, b2), fs in ef.items():
        if len(fs) != 2 or pf[fs[0]] == pf[fs[1]]: continue
        sd = "arm" if (int(a_) in ca or int(b2) in ca) else "chest"
        seam[sd].append((fs[0], fs[1]) if not pf[fs[0]] else (fs[1], fs[0]))
    seam = {k: np.array(v) for k, v in seam.items()}
def face_normals(X, fl):
    out = np.zeros((len(fl), 3))
    for k in range(1, lt.max() - 1):
        m = lt[fl] > k + 1
        f = fl[m]; i0, i1, i2 = lv[ls[f]], lv[ls[f] + k], lv[ls[f] + k + 1]
        out[m] += np.cross(X[i1] - X[i0], X[i2] - X[i0])
    return out / np.maximum(np.linalg.norm(out, axis=1), 1e-15)[:, None]
def circle_dev(Q2, fit2):
    Am = np.c_[2 * fit2, np.ones(len(fit2))]; bm = (fit2 ** 2).sum(1)
    c = np.linalg.lstsq(Am, bm, rcond=None)[0]; R_ = np.sqrt(c[2] + c[0] ** 2 + c[1] ** 2)
    return np.linalg.norm(Q2 - c[:2], axis=1) - R_
def self_hits(P):
    _, canon = np.unique(np.round(P / 1e-6).astype(np.int64), axis=0, return_inverse=True); canon = canon.ravel()
    t = BVHTree.FromPolygons([tuple(p) for p in P], zpolys, all_triangles=True)
    kinds = Counter(); faces = []
    for i, j in t.overlap(t):
        if i < j and not set(canon[list(zpolys[i])]) & set(canon[list(zpolys[j])]):
            pi, pj = pocket[zone[i]], pocket[zone[j]]
            kinds["pocket-pocket" if pi and pj else ("pocket-original" if pi or pj else "original-original")] += 1
            faces.append((zone[i], zone[j]))
    return dict(kinds), faces
poses = {}
for deg in ANG:
    C.elevate(arm, deg, BONE)
    P = C.evaluated_co(obj)
    if deg == 0: res["rest_pose_max_displacement_mm"] = round(float(np.abs(P - co).max()) * 1e3, 6)
    A = 0.5 * np.linalg.norm(np.cross(P[tri[:, 1]] - P[tri[:, 0]], P[tri[:, 2]] - P[tri[:, 0]]), axis=1)
    r = A / np.maximum(A0, 1e-14)
    def stats(mask):
        rr_ = r[mask]
        return {"tris": int(mask.sum()), ">2x": int((rr_ > 2).sum()), ">4x": int((rr_ > 4).sum()), ">10x": int((rr_ > 10).sum()),
                "max": round(float(rr_.max()), 1), "p99": round(float(np.percentile(rr_, 99)), 2), "<0.5x": int((rr_ < 0.5).sum()),
                "growth_cm2": round(float(np.clip(A[mask] - A0[mask], 0, None).sum() * 1e4), 1)}
    kinds, hit = self_hits(P)
    m4 = side_m & ~pocket & (r > 4)
    pr = {"stretch": {"painted": stats(side_m & painted & ~pocket), "unpainted": stats(side_m & ~painted & ~pocket),
                      "inner_arm": stats(innerf), "deltoid": stats(delt)},
          "intersections": kinds, "intersections_total": int(sum(kinds.values())),
          "tris_over_4x_by_region": dict(Counter(fr[m4]).most_common(8))}
    if REP: pr["stretch"]["pocket"] = stats(pocket)
    if hit:
        cl = Counter()
        for a_, b2 in hit:
            c_ = np.round(0.5 * (cen0[a_] + cen0[b2]) / 0.02) * 2
            cl[("%+.0f %+.0f %+.0f" % tuple(c_), "pocket" if pocket[a_] else fr[a_], "pocket" if pocket[b2] else fr[b2])] += 1
        pr["intersection_clusters_cm"] = [[k[0], k[1], k[2], v] for k, v in cl.most_common(6)]
        np.save(os.path.join(C.SCRATCH, "out", "hits_%s_%s_%d.npy" % (tag, SIDE, deg)), np.array(hit))
    pb = arm.pose.bones[BONE]
    hd = np.array(arm.matrix_world @ pb.head); tl = np.array(arm.matrix_world @ pb.tail); Lb = np.linalg.norm(tl - hd); ax = (tl - hd) / Lb
    rel = P - hd; t = rel @ ax; rad = np.linalg.norm(rel - t[:, None] * ax, axis=1)
    flap, flap_max = 0, 0.0
    for t0 in np.arange(0.05, 0.9 * Lb, 0.01):
        sk = armskin & (t >= t0) & (t < t0 + 0.01)
        if sk.sum() < 30: continue
        ex = rad[sk] - np.median(rad[sk]); flap += int((ex > 0.03).sum()); flap_max = max(flap_max, float(ex.max()))
    pr["flap"] = {"vertices_>3cm_out": flap, "max_excess_cm": round(flap_max * 100, 1)}
    if REP:
        sm_ = {}
        for sd, pairs in seam.items():
            n1, n2 = face_normals(P, pairs[:, 0]), face_normals(P, pairs[:, 1])
            ang = np.degrees(np.arccos(np.clip((n1 * n2).sum(1), -1, 1)))
            sm_[sd] = {"edges": len(pairs), "median_deg": round(float(np.median(ang)), 1), "p90_deg": round(float(np.percentile(ang, 90)), 1)}
        pr["seam"] = sm_
        e1 = np.cross(ax, [0, 1.0, 0]); e1 /= np.linalg.norm(e1); e2 = np.cross(ax, e1)
        q2 = np.c_[(rel - t[:, None] * ax) @ e1, (rel - t[:, None] * ax) @ e2]
        devs = []
        for t0 in np.arange(0.05, 0.9 * Lb, 0.01):
            sk = armskin & (t >= t0) & (t < t0 + 0.01); wl_ = AW[(t[AW] >= t0) & (t[AW] < t0 + 0.01)]
            if sk.sum() < 30 or not len(wl_): continue
            devs.append(circle_dev(q2[wl_], q2[sk]))
        devs = np.concatenate(devs) if devs else np.zeros(1)
        pr["arm_wall_off_round_mm"] = {"median_abs": round(float(np.median(np.abs(devs))) * 1e3, 1), "p5": round(float(np.percentile(devs, 5)) * 1e3, 1)}
    polys = [tuple(x) for x in tri[:, :3]]
    bvh = BVHTree.FromPolygons([tuple(p) for p in P], polys, all_triangles=True)
    def inside(p):
        votes = 0
        for d in (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, -1))):
            o = Vector(p); n = 0
            while True:
                hh = bvh.ray_cast(o, d)
                if hh[0] is None: break
                n += 1; o = hh[0] + d * 1e-5
            votes += n % 2
        return votes >= 2
    samples = [hd + ax * Lb * f for f in np.linspace(0.0, 1.0, 11)]
    clear = [bvh.find_nearest(Vector(p))[3] * 1e3 for p in samples]
    pr["bone"] = {"samples_inside": int(sum(inside(p) for p in samples)), "of": len(samples),
                  "clearance_mm_min": round(float(min(clear)), 1), "clearance_mm_by_tenth": [round(float(c), 1) for c in clear]}
    pr["volume_ratio"] = round(volume(P) / V0, 5)
    poses[deg] = pr
    s = pr["stretch"]
    print("%s %2d deg | int %4d %s | painted >4x %4d >10x %3d max %6.1f grow %6.1f | inner >4x %3d max %5.1f | pocket %s | flap %3d (%.1f cm) | delt crush %d | bone in %d/11 clr %.1f mm | vol %.4f | seam %s | wall %s" % (
        SIDE, deg, pr["intersections_total"], kinds, s["painted"][">4x"], s["painted"][">10x"], s["painted"]["max"], s["painted"]["growth_cm2"],
        s["inner_arm"][">4x"], s["inner_arm"]["max"],
        ("%d/%d/%.1f" % (s["pocket"][">4x"], s["pocket"][">10x"], s["pocket"]["max"])) if REP else "-",
        pr["flap"]["vertices_>3cm_out"], pr["flap"]["max_excess_cm"], s["deltoid"]["<0.5x"], pr["bone"]["samples_inside"], pr["bone"]["clearance_mm_min"], pr["volume_ratio"],
        {k: v["median_deg"] for k, v in pr.get("seam", {}).items()}, pr.get("arm_wall_off_round_mm", {}).get("median_abs")), flush=True)
C.rest_pose(arm)
res["poses"] = poses
json.dump(res, open(os.path.join(C.SCRATCH, "out", "metrics_%s_%s.json" % (tag, SIDE)), "w"), indent=1, default=str)
print("written", tag, SIDE)
