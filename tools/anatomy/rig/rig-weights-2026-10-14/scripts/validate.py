"""Measure one scratch copy at 0/30/45/60/75/90 deg of right-arm elevation.
  Blender -b build/<file>.blend --python scripts/validate.py -- <tag>
Works on both rigs (ATLAS_Rig: upper_arm.R; old Armature.001: Bone.010) and on both meshes
(repaired: 153,898 vertices; unmodified: 143,690). The elevation is the armpit study's:
the upper-arm bone turned about the world y axis through its head, nothing else moved.
Vertex sets are fixed once, on rest positions, so every copy is measured on the same skin
(the first 143,690 vertices are the same in both meshes). Writes out/metrics_<tag>.json.

  stretch       triangle area posed / rest (>2x, >4x, >10x, worst; extra area cm2), and
                <0.5x (crushed), per group: right painted muscle, right unpainted skin,
                pocket walls, inner arm
  intersections face pairs crossing in the right armpit zone (x<-0.12, 0.40<z<0.85)
  flap          arm skin standing > 3 cm further from the posed upper-arm axis than its
                1 cm slice's median radius
  bone          posed upper-arm bone: sample points inside the posed skin, and the least
                skin clearance around it (collapse shows as a small clearance)
  volume        enclosed volume posed / rest (whole body is one closed shell)
  shoulder      deltoid.R area and its crushed share
  preservation  (repaired mesh only) Paint/UVMap UVs, materials, rest positions and painted
                region of every face, against the repair4 reference; shape keys present
"""
import sys, os, json, re
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from collections import Counter
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import common as C
C.guard()
tag = sys.argv[sys.argv.index("--") + 1]
ANG = (0, 30, 45, 60, 75, 90)
obj = bpy.data.objects["Mesh_0"]; me = obj.data
if "ATLAS_Rig" in bpy.data.objects: arm, BONE = bpy.data.objects["ATLAS_Rig"], "upper_arm.R"
else: arm, BONE = bpy.data.objects["Armature.001"], "Bone.010"
C.rest_pose(arm)
co = C.mesh_world(obj); nv = len(co); NV0 = 143690; NF0 = 287219
ls, lt, lv = C.faces(me); nf = len(ls)
tri = C.triangles(me)
freg = C.face_regions(me)
fr = freg[tri[:, 3]]
painted = ~np.isin(fr, ["body", "blend"])
pocket = tri[:, 3] >= NF0
cen0 = co[tri[:, :3]].mean(1)
right = cen0[:, 0] < -0.10
REP = nv > NV0
res = {"tag": tag, "rig": arm.name, "bone": BONE, "vertices": nv, "faces": nf,
       "shape_keys": [k.name for k in me.shape_keys.key_blocks] if me.shape_keys else []}
# vertex sets, fixed on the repaired mesh (see weights.py) and shared by index
S = np.load(os.path.join(C.ARMPIT, "corrective", "out", "sets.npz"))
inner = S["innerarm"]; FB = S["FB"]
isinner = np.zeros(nv, bool); isinner[inner[inner < nv]] = True
innerf = isinner[tri[:, :3]].any(1) & ~pocket
# arm skin for the flap test: original vertices of the upper arm, by rest geometry
J = json.load(open(os.path.join(C.SCRATCH, "out", "calibrated_rig.json")))["bones"]["upper_arm.R"]
h0, t0_ = np.array(J["head"]), np.array(J["tail"]); ax0 = (t0_ - h0) / np.linalg.norm(t0_ - h0)
rel = co - h0; tt = rel @ ax0 / np.linalg.norm(t0_ - h0); rr = np.linalg.norm(rel - np.outer(rel @ ax0, ax0), axis=1)
# the upper-arm territory of the repaired mesh (weights.py step 1: nearest visible bone), shared by index
TERR = np.load(os.path.join(C.SCRATCH, "out", "territory_reference.npy"))
armskin = (np.arange(nv) < NV0) & (tt > 0.3) & (tt < 0.9)
armskin[:NV0] &= TERR[:NV0]
A0 = 0.5 * np.linalg.norm(np.cross(co[tri[:, 1]] - co[tri[:, 0]], co[tri[:, 2]] - co[tri[:, 0]]), axis=1)
def volume(X):
    a, b, c = X[tri[:, 0]], X[tri[:, 1]], X[tri[:, 2]]
    return float(np.einsum("ij,ij->i", a, np.cross(b, c)).sum() / 6)
V0 = volume(co)
zone = np.flatnonzero((cen0[:, 0] < -0.12) & (cen0[:, 2] > 0.40) & (cen0[:, 2] < 0.85))
zpolys = [tuple(t) for t in tri[zone, :3]]
delt = fr == "deltoid.R"
if REP:
    walls, cut_arm, cut_chest = S["walls"], S["cut_arm"], S["cut_chest"]
    fol = np.repeat(np.arange(nf), lt)
    uvP = np.empty(len(me.loops) * 2); me.uv_layers["Paint"].data.foreach_get("uv", uvP); uvP = uvP.reshape(-1, 2)
    pl = fol >= NF0; vmid = 0.5 * (uvP[pl, 1].min() + uvP[pl, 1].max())
    fvv = np.bincount(fol, uvP[:, 1], minlength=nf) / lt
    armwall = np.zeros(nv, bool); armwall[lv[pl & (fvv[fol] < vmid)]] = True
    chestwall = np.zeros(nv, bool); chestwall[lv[pl & (fvv[fol] > vmid)]] = True
    from mathutils.kdtree import KDTree
    kd = KDTree(len(cut_arm))
    for k_, v in enumerate(cut_arm): kd.insert(co[v], k_)
    kd.balance()
    AW = np.array([v for v in np.flatnonzero(armwall & ~chestwall) if kd.find(co[v])[2] < 0.025])   # arm wall near the cut
    # seam edges: an original face and a pocket face sharing a cut edge
    ca, cc = set(cut_arm.tolist()), set(cut_chest.tolist())
    ef = {}
    for f in np.flatnonzero(np.isin(np.arange(nf), np.unique(fol[np.isin(lv, cut_arm) | np.isin(lv, cut_chest)]))):
        vs = lv[ls[f]:ls[f] + lt[f]]
        for a_, b_ in zip(vs, np.roll(vs, -1)): ef.setdefault((min(a_, b_), max(a_, b_)), []).append(f)
    seam = {"arm": [], "chest": []}
    for (a_, b_), fs in ef.items():
        if len(fs) != 2 or (fs[0] < NF0) == (fs[1] < NF0): continue
        sd = "arm" if (int(a_) in ca or int(b_) in ca) else "chest"
        seam[sd].append((fs[0], fs[1]) if fs[0] < NF0 else (fs[1], fs[0]))
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

# --------------------------------------------------------------- preservation
if REP:
    ref = bpy.data.libraries.load(os.path.join(C.SCRATCH, "original", "Male_Body_repaired.blend"), link=False)
    with ref as (s_, d_): d_.meshes = ["Mesh_0"]
    om = d_.meshes[0]
    def uv(mesh, n):
        a = np.empty(len(mesh.loops) * 2); mesh.uv_layers[n].data.foreach_get("uv", a); return a
    oco = C.mesh_co(om)
    res["preservation"] = {
        "same_counts": [len(me.vertices), len(me.edges), len(me.polygons), len(me.loops)] == [len(om.vertices), len(om.edges), len(om.polygons), len(om.loops)],
        "paint_uv_identical": bool(np.array_equal(uv(me, "Paint"), uv(om, "Paint"))),
        "uvmap_identical": bool(np.array_equal(uv(me, "UVMap"), uv(om, "UVMap"))),
        "rest_positions_identical": bool(np.array_equal(C.mesh_co(me), oco)),
        "face_vertices_identical": bool(np.array_equal(lv, C.faces(om)[2])),
        "materials_identical": [re.sub(r"\.\d{3}$", "", m.name) for m in me.materials] == [re.sub(r"\.\d{3}$", "", m.name) for m in om.materials] and bool(np.array_equal(
            np.array([p.material_index for p in me.polygons]), np.array([p.material_index for p in om.polygons]))),
        "painted_region_per_face_identical": bool(np.array_equal(freg, C.face_regions(om))),
    }
    print("preservation", res["preservation"])

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
                "growth_cm2": round(float(np.clip(A[mask] - A0[mask], 0, None).sum() * 1e4), 1),
                "shrink_cm2": round(float(np.clip(A0[mask] - A[mask], 0, None).sum() * 1e4), 1)}
    kinds, hit = self_hits(P)
    m4 = right & ~pocket & (r > 4)
    by_region = Counter(fr[m4])
    pr = {"stretch": {"right_painted": stats(right & painted & ~pocket), "right_unpainted": stats(right & ~painted & ~pocket),
                      "inner_arm": stats(innerf), "deltoid_R": stats(delt)},
          "intersections": kinds, "intersections_total": int(sum(kinds.values())),
          "right_tris_over_4x_by_region": dict(by_region.most_common(8))}
    if REP: pr["stretch"]["pocket"] = stats(pocket)
    if hit:
        cl = Counter()
        for a_, b_ in hit:
            c_ = np.round(0.5 * (cen0[a_] + cen0[b_]) / 0.02) * 2
            cl[("%+.0f %+.0f %+.0f" % tuple(c_), "pocket" if pocket[a_] else fr[a_], "pocket" if pocket[b_] else fr[b_])] += 1
        pr["intersection_clusters_cm"] = [[k[0], k[1], k[2], v] for k, v in cl.most_common(6)]
        np.save(os.path.join(C.SCRATCH, "out", "hits_%s_%d.npy" % (tag, deg)), np.array(hit))
    # flap
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
        # arm wall near the cut against a circle fitted to the arm skin of the same section
        e1 = np.cross(ax, [0, 1.0, 0]); e1 /= np.linalg.norm(e1); e2 = np.cross(ax, e1)
        q2 = np.c_[(rel - t[:, None] * ax) @ e1, (rel - t[:, None] * ax) @ e2]
        devs = []
        for t0 in np.arange(0.05, 0.9 * Lb, 0.01):
            sk = armskin & (t >= t0) & (t < t0 + 0.01); wl_ = AW[(t[AW] >= t0) & (t[AW] < t0 + 0.01)]
            if sk.sum() < 30 or not len(wl_): continue
            devs.append(circle_dev(q2[wl_], q2[sk]))
        devs = np.concatenate(devs) if devs else np.zeros(1)
        pr["arm_wall_off_round_mm"] = {"median_abs": round(float(np.median(np.abs(devs))) * 1e3, 1), "p5": round(float(np.percentile(devs, 5)) * 1e3, 1)}
    # bone inside the posed skin; clearance
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
                  "clearance_mm_min": round(float(min(clear)), 1), "clearance_mm_head": round(float(clear[0]), 1),
                  "clearance_mm_by_tenth": [round(float(c), 1) for c in clear]}
    pr["volume_ratio"] = round(volume(P) / V0, 5)
    poses[deg] = pr
    s = pr["stretch"]
    print("%2d deg | int %4d %s | painted >4x %4d >10x %3d max %6.1f grow %6.1f crush %3d | inner >4x %3d max %5.1f | pocket %s | flap %3d (%.1f cm) | delt crush %d | bone in %d/11 clr %.1f mm | vol %.4f | seam %s | wall %s" % (
        deg, pr["intersections_total"], kinds, s["right_painted"][">4x"], s["right_painted"][">10x"], s["right_painted"]["max"], s["right_painted"]["growth_cm2"],
        s["right_painted"]["<0.5x"], s["inner_arm"][">4x"], s["inner_arm"]["max"],
        ("%d/%d/%.1f" % (s["pocket"][">4x"], s["pocket"][">10x"], s["pocket"]["max"])) if REP else "-",
        pr["flap"]["vertices_>3cm_out"], pr["flap"]["max_excess_cm"], s["deltoid_R"]["<0.5x"], pr["bone"]["samples_inside"], pr["bone"]["clearance_mm_min"], pr["volume_ratio"],
        {k: v["median_deg"] for k, v in pr.get("seam", {}).items()}, pr.get("arm_wall_off_round_mm", {}).get("median_abs")), flush=True)
C.rest_pose(arm)
res["poses"] = poses
json.dump(res, open(os.path.join(C.SCRATCH, "out", "metrics_%s.json" % tag), "w"), indent=1, default=str)
print("written", tag)
