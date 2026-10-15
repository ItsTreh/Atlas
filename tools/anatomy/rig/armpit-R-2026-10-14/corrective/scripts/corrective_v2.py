"""Pose-driven corrective shape keys for the reconstructed right armpit
(experiment, SCRATCH only). Reads repaired/Male_Body.blend (repair4.py's
output, left as it is) and saves corrective/Male_Body.blend.

  Blender -b repaired/Male_Body.blend --python corrective/scripts/corrective.py

Version 2. (Version 1, corrective_v1.py, filled the whole pocket freely: the
fill spanned the armpit from arm to chest, a new membrane.)

Per elevation (30, 60, 90 deg) one key, built in that pose:
  1. Inner-arm skin. Original arm-side vertices near the cut keep 12-43 %
     torso weight, so they lag the arm and hang as a flap. Each is drawn toward
     where the upper arm alone would carry it, by
        alpha = (1 - smoothstep(geodesic distance to the arm's copy of the cut / ARM_REACH))
                * smoothstep(distance to the fold ends F, B / FB_FADE),
     so the fold ends and everything farther than ARM_REACH stay as skinned.
     Only the arm side: the chest copy of the cut and the torso are untouched.
  2. The dome (the row the two walls share, the armpit's apex) stays where the
     skin puts it, half arm and half torso.
  3. The walls: thin-plate (biharmonic) fill, x^T L M^-1 L x minimised over the
     wall vertices with everything else fixed (cotangent Laplacian of the rest
     mesh, weights clamped at 0, M vertex areas). L reaches one ring past the
     cut, so each wall leaves the cut tangent to the skin beside it: the arm
     wall carries on the arm's curvature, the chest wall the rib wall's.
  4. Offsets in rest space: offset = A^-1 (target - skinned), A = d(skinned)/d(rest)
     per vertex by finite differences (the armature is linear in the shape-keyed
     position).
Drivers: the upper arm's rotation angle (2 acos w of Bone.010's pose
quaternion); 30 peaks at 30 deg, 60 at 60, 90 from 60 on, linear between.
"""
import sys, os, heapq, json, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "scripts")); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C
C.guard()
ANGLES = (30, 60, 90)
ARM_REACH = 0.05     # how far up the arm from the cut the inner-arm correction reaches (m, geodesic)
FB_FADE = 0.04       # the correction fades to nothing within this distance of F and B (m)
OUT = os.path.join(C.SCRATCH, "corrective", "Male_Body.blend")
OUTD = os.path.join(C.SCRATCH, "corrective", "out")
obj = bpy.data.objects["Mesh_0"]; arm = bpy.data.objects["Armature.001"]; me = obj.data
assert me.shape_keys is None, "expected the repaired copy without shape keys"
C.rest_pose(arm)

# ------------------------------------------------------------- the pocket
with bpy.data.libraries.load(os.path.join(C.SCRATCH, "reference", "Male_Body.blend"), link=False) as (s_, d_):
    d_.meshes = ["Mesh_0"]
nf0 = len(d_.meshes[0].polygons); bpy.data.meshes.remove(d_.meshes[0])
co, ev = C.mesh_arrays(me); nv, nf = len(co), len(me.polygons)
ls = np.empty(nf, np.int64); me.polygons.foreach_get("loop_start", ls)
lt = np.empty(nf, np.int64); me.polygons.foreach_get("loop_total", lt)
lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get("vertex_index", lv)
face_of_loop = np.repeat(np.arange(nf), lt)
on_orig = np.zeros(nv, bool); on_orig[lv[face_of_loop < nf0]] = True
uv = np.empty(len(me.loops) * 2); me.uv_layers["Paint"].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
pl = face_of_loop >= nf0
vmid = 0.5 * (uv[pl, 1].min() + uv[pl, 1].max())
fv = np.bincount(face_of_loop, uv[:, 1], minlength=nf) / lt
arm_face = (np.arange(nf) >= nf0) & (fv < vmid); chest_face = (np.arange(nf) >= nf0) & (fv > vmid)
in_arm = np.zeros(nv, bool); in_arm[lv[arm_face[face_of_loop]]] = True
in_chest = np.zeros(nv, bool); in_chest[lv[chest_face[face_of_loop]]] = True
FBv = np.flatnonzero(on_orig & in_arm & in_chest)
cut_arm = np.flatnonzero(on_orig & in_arm & ~in_chest); cut_chest = np.flatnonzero(on_orig & in_chest & ~in_arm)
dome = np.flatnonzero(~on_orig & in_arm & in_chest)
walls = np.flatnonzero(~on_orig & ~(in_arm & in_chest))
print("pocket: %d wall vertices, %d dome; cut copies arm %d / chest %d; fold ends %s" % (len(walls), len(dome), len(cut_arm), len(cut_chest), list(FBv)))
assert len(FBv) == 2 and len(cut_arm) == len(cut_chest)

# ----------------------------------------- 1. inner-arm skin: who and how much
nbrs = [[] for _ in range(nv)]
L_e = np.linalg.norm(co[ev[:, 0]] - co[ev[:, 1]], axis=1)
blocked = np.zeros(nv, bool); blocked[FBv] = True; blocked[~on_orig] = True
for (i, j), l in zip(ev, L_e):
    if not (blocked[i] or blocked[j]):
        nbrs[i].append((j, l)); nbrs[j].append((i, l))
def geodesic(src, reach):
    dist = {int(v): 0.0 for v in src}; pq = [(0.0, int(v)) for v in src]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u] or d > reach: continue
        for o, l in nbrs[u]:
            nd = d + l
            if nd < dist.get(o, 9.0):
                dist[o] = nd; heapq.heappush(pq, (nd, o))
    return dist
dist = geodesic(cut_arm, ARM_REACH); dist_c = geodesic(cut_chest, 2 * ARM_REACH)
# arm side only: nearer (over the skin) to the arm's copy of the cut than to the chest's
G = np.array([k for k, d in dist.items() if d < ARM_REACH and d < dist_c.get(k, 9.0)]); Gd = np.array([dist[k] for k in G])
def smooth(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
dFB = np.min(np.linalg.norm(co[G][:, None] - co[FBv][None], axis=2), 1)
alpha = (1 - smooth(Gd / ARM_REACH)) * smooth(dFB / FB_FADE)
assert (co[G, 0] < -0.15).all(), "inner-arm set left the right arm"
Gs, alpha = G[alpha > 1e-4], alpha[alpha > 1e-4]
print("inner-arm skin: %d original vertices corrected (alpha max %.2f)" % (len(Gs), alpha.max()))

# ------------------------------------------------ cotangent Laplacian (rest)
U = walls; nu = len(U)
uidx = np.full(nv, -1); uidx[U] = np.arange(nu)
tri = np.concatenate([np.stack([lv[ls[lt > k]], lv[ls[lt > k] + k - 1], lv[ls[lt > k] + k]], 1) for k in range(2, lt.max())])
isU = np.zeros(nv, bool); isU[U] = True
m_ = isU[ev[:, 0]] | isU[ev[:, 1]]
ROWS = np.zeros(nv, bool); ROWS[ev[m_].ravel()] = True; ROWS[U] = True
T = tri[ROWS[tri].any(1)]
P = co[T]
def cot(a, b, c):
    u, v = b - a, c - a
    return (u * v).sum(1) / np.maximum(np.linalg.norm(np.cross(u, v), axis=1), 1e-14)
ci = [cot(P[:, 0], P[:, 1], P[:, 2]), cot(P[:, 1], P[:, 2], P[:, 0]), cot(P[:, 2], P[:, 0], P[:, 1])]
area = 0.5 * np.linalg.norm(np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]), axis=1)
I = np.concatenate([T[:, 1], T[:, 2], T[:, 0]]); J = np.concatenate([T[:, 2], T[:, 0], T[:, 1]])
W = 0.5 * np.concatenate(ci)
I, J, W = np.concatenate([I, J]), np.concatenate([J, I]), np.concatenate([W, W])
key, inv = np.unique(I * nv + J, return_inverse=True)
Wraw = np.bincount(inv.ravel(), W); Wsum = np.maximum(Wraw, 0.0)
EI, EJ = key // nv, key % nv
Mv = np.bincount(T.ravel(), np.repeat(area / 3, 3), minlength=nv)
rows = np.flatnonzero(ROWS)
sel = ROWS[EI]
print("Laplacian: %d rows; %d of %d edge weights negative, clamped to 0" % (len(rows), int((Wraw[sel] < 0).sum()), int(sel.sum())))
EI, EJ, EW = EI[sel], EJ[sel], Wsum[sel]
diag = np.bincount(EI, EW, minlength=nv)
order = np.argsort(EI, kind="stable"); EI, EJ, EW = EI[order], EJ[order], EW[order]
starts = np.searchsorted(EI, rows); ends = np.searchsorted(EI, rows, side="right")
A = np.zeros((nu, nu)); rowcols = []
for r, j in enumerate(rows):
    ks, ws = EJ[starts[r]:ends[r]], EW[starts[r]:ends[r]]
    cols = np.concatenate([ks, [j]]); vals = np.concatenate([ws, [-diag[j]]])
    fu = uidx[cols] >= 0
    cu, vu = uidx[cols[fu]], vals[fu]; s = 1.0 / Mv[j]
    A[np.ix_(cu, cu)] += s * np.outer(vu, vu)
    rowcols.append((cu, vu * s, cols[~fu], vals[~fu]))
def fill(X):
    b = np.zeros((nu, 3))
    for cu, vus, cf, vf in rowcols:
        b[cu] -= np.outer(vus, vf @ X[cf])
    return np.linalg.solve(A, b)

# --------------------------------------------------------------- the keys
S = np.concatenate([U, Gs])                     # every vertex a key may move
assert not np.isin(S, dome).any() and not np.isin(S, cut_chest).any()
basis = obj.shape_key_add(name="Basis", from_mix=False)
probe = obj.shape_key_add(name="probe", from_mix=False); probe.value = 1.0
base_co = co.copy()
def set_key(k, Xk): k.data.foreach_set("co", Xk.ravel())
def jacobian(idx):
    set_key(probe, base_co); P0 = C.evaluated_co(obj)[idx]
    Jm = np.zeros((len(idx), 3, 3)); e = 1e-3
    for ax in range(3):
        X = base_co.copy(); X[idx, ax] += e; set_key(probe, X)
        Jm[:, :, ax] = (C.evaluated_co(obj)[idx] - P0) / e
    set_key(probe, base_co)
    return P0, Jm
offsets, report = {}, {}
for deg in ANGLES:
    C.elevate(arm, deg)
    Xs = C.evaluated_co(obj)
    pb = arm.pose.bones["Bone.010"]
    M = np.array(arm.matrix_world @ pb.matrix @ pb.bone.matrix_local.inverted() @ arm.matrix_world.inverted())
    rigid = co[Gs] @ M[:3, :3].T + M[:3, 3]
    X = Xs.copy()
    X[Gs] = (1 - alpha)[:, None] * Xs[Gs] + alpha[:, None] * rigid
    X[U] = fill(X)
    P0, Jm = jacobian(S)
    off = np.linalg.solve(Jm, (X[S] - P0)[:, :, None])[:, :, 0]
    Xk = base_co.copy(); Xk[S] += off; set_key(probe, Xk)
    res = np.linalg.norm(C.evaluated_co(obj)[S] - X[S], axis=1).max(); set_key(probe, base_co)
    mw = np.linalg.norm(X[U] - Xs[U], axis=1); ma = np.linalg.norm(X[Gs] - Xs[Gs], axis=1)
    report[deg] = dict(walls_move_mm_median=float(np.median(mw) * 1e3), walls_move_mm_max=float(mw.max() * 1e3),
                       innerarm_move_mm_median=float(np.median(ma) * 1e3), innerarm_move_mm_max=float(ma.max() * 1e3), residual_mm=float(res * 1e3))
    print("%d deg: walls moved median %.1f / max %.1f mm; inner-arm skin moved median %.1f / max %.1f mm; key residual %.4f mm" % (
        deg, mw.mean() * 0 + np.median(mw) * 1e3, mw.max() * 1e3, np.median(ma) * 1e3, ma.max() * 1e3, res * 1e3))
    offsets[deg] = off
    np.save(os.path.join(OUTD, "target_%d.npy" % deg), X[S])
C.rest_pose(arm)
obj.shape_key_remove(probe)
for deg in ANGLES:
    k = obj.shape_key_add(name="armpit_R_%d" % deg, from_mix=False)
    Xk = base_co.copy(); Xk[S] += offsets[deg]; set_key(k, Xk)
    k.value = 0.0; k.slider_min, k.slider_max = 0.0, 1.0
    fc = k.driver_add("value"); dr = fc.driver; dr.type = 'SCRIPTED'
    v = dr.variables.new(); v.name = "w"; v.type = 'TRANSFORMS'
    t = v.targets[0]; t.id = arm; t.bone_target = "Bone.010"
    t.transform_type = 'ROT_W'; t.rotation_mode = 'QUATERNION'; t.transform_space = 'LOCAL_SPACE'
    a = "degrees(2*acos(min(1.0, abs(w))))"
    dr.expression = {30: "max(0.0, 1.0 - abs(%s - 30.0) / 30.0)" % a,
                     60: "max(0.0, 1.0 - abs(%s - 60.0) / 30.0)" % a,
                     90: "min(1.0, max(0.0, (%s - 60.0) / 30.0))" % a}[deg]
    for m in list(fc.modifiers): fc.modifiers.remove(m)
moved_orig = np.zeros(nv, bool)
for k in me.shape_keys.key_blocks[1:]:
    X = np.empty(nv * 3); k.data.foreach_get("co", X); d = np.abs(X.reshape(-1, 3) - base_co).max(1)
    outside = np.ones(nv, bool); outside[S] = False
    assert d[outside].max() == 0.0, k.name
    moved_orig |= (d > 0) & on_orig
for deg in (0, 30, 45, 60, 75, 90):
    C.elevate(arm, deg)
    print("driver check %d deg:" % deg, [round(k.value, 3) for k in me.shape_keys.key_blocks[1:]])
C.rest_pose(arm)
np.savez(os.path.join(OUTD, "sets.npz"), walls=U, dome=dome, cut_arm=cut_arm, cut_chest=cut_chest, FB=FBv, innerarm=Gs, alpha=alpha)
report["original_vertices_moved_by_keys"] = int(moved_orig.sum())
report["params"] = dict(ARM_REACH=ARM_REACH, FB_FADE=FB_FADE)
json.dump(report, open(os.path.join(OUTD, "build.json"), "w"), indent=1)
me["atlas_armpit_experiment"] = "right armpit reconstruction v4 + corrective shape keys 30/60/90 (v2), scratch only, 2026-10-14"
bpy.ops.wm.save_as_mainfile(filepath=OUT, check_existing=False, compress=True)
print("saved", OUT, "; original vertices moved by any key:", int(moved_orig.sum()))
