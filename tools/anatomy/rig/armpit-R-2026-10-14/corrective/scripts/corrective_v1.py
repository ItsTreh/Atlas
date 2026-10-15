"""Pose-driven corrective shape keys for the reconstructed right armpit
(experiment, SCRATCH only). Reads repaired/Male_Body.blend (repair4.py's
output, left as it is) and saves corrective/Male_Body.blend.

  Blender -b repaired/Male_Body.blend --python corrective/scripts/corrective.py

What moves: only the pocket's own vertices, the ones on no original face (the
ribbon, both walls and the dome; 9,889 of them). Every vertex of an original
face, the cut's two copies included, keeps a zero offset in every key, so the
painted surface, its UVs and the folds above F and B are exactly as skinned.

How a key is made, per elevation (30, 60, 90 deg):
  1. Pose the arm (common.elevate) and take the skinned positions.
  2. Fill the pocket as a smooth surface in that pose: minimise the thin-plate
     (biharmonic) energy  x^T L M^-1 L x  over the pocket's vertices, with every
     other vertex fixed where the skin put it. L is the cotangent Laplacian of
     the rest mesh (weights clamped at 0), M the vertex areas. Because the rows
     of L reach one ring past the cut, the fill leaves the cut tangent to the
     surface beside it on each side: the arm wall carries on the arm's own
     curvature, the chest wall the rib wall's, and they turn into each other
     in the dome.
  3. Turn the filled positions into a rest-space offset: the armature is linear
     in the shape-keyed position, so offset = A^-1 (target - skinned), with
     A = d(skinned)/d(rest) per vertex, measured by finite differences.
The keys are driven by the upper arm's rotation angle (2 acos w of Bone.010's
pose quaternion): 30 peaks at 30 deg, 60 at 60, 90 from 60 on, linear between.
"""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "scripts")); sys.dont_write_bytecode = True
import bpy, numpy as np, time
import common as C
C.guard()
ANGLES = (30, 60, 90)
OUT = os.path.join(C.SCRATCH, "corrective", "Male_Body.blend")
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
U = np.flatnonzero(~on_orig); nu = len(U)
uidx = np.full(nv, -1); uidx[U] = np.arange(nu)
print("pocket: %d free vertices" % nu)

# ------------------------------------------------ cotangent Laplacian (rest)
tri = np.concatenate([np.stack([lv[ls[lt > k]], lv[ls[lt > k] + k - 1], lv[ls[lt > k] + k]], 1) for k in range(2, lt.max())])
nbr_of_U = np.zeros(nv, bool); nbr_of_U[U] = True
m_ = nbr_of_U[ev[:, 0]] | nbr_of_U[ev[:, 1]]
ROWS = np.zeros(nv, bool); ROWS[ev[m_].ravel()] = True          # U and its first ring: the rows of L that see U
T = tri[ROWS[tri].any(1)]
P = co[T]                                                          # t x 3 x 3
def cot(a, b, c):    # cot of the angle at a
    u, v = b - a, c - a
    return (u * v).sum(1) / np.maximum(np.linalg.norm(np.cross(u, v), axis=1), 1e-14)
ci = [cot(P[:, 0], P[:, 1], P[:, 2]), cot(P[:, 1], P[:, 2], P[:, 0]), cot(P[:, 2], P[:, 0], P[:, 1])]
area = 0.5 * np.linalg.norm(np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]), axis=1)
I = np.concatenate([T[:, 1], T[:, 2], T[:, 0]]); J = np.concatenate([T[:, 2], T[:, 0], T[:, 1]])
W = 0.5 * np.concatenate(ci)
I, J, W = np.concatenate([I, J]), np.concatenate([J, I]), np.concatenate([W, W])
key, inv = np.unique(I * nv + J, return_inverse=True)
Wsum = np.maximum(np.bincount(inv.ravel(), W), 0.0)               # clamp: obtuse slivers at the cut
EI, EJ = key // nv, key % nv
Mv = np.bincount(T.ravel(), np.repeat(area / 3, 3), minlength=nv)
rows = np.flatnonzero(ROWS)
print("Laplacian: %d rows, %d off-diagonal entries; %d negative weights clamped" % (len(rows), int(ROWS[EI].sum()), int((np.bincount(inv.ravel(), W) < 0).sum())))
sel = ROWS[EI]; EI, EJ, EW = EI[sel], EJ[sel], Wsum[sel]
diag = np.bincount(EI, EW, minlength=nv)
# per row j: (L x)_j = sum_k w_jk x_k - diag_j x_j ; weight 1/M_j
order = np.argsort(EI, kind="stable"); EI, EJ, EW = EI[order], EJ[order], EW[order]
starts = np.searchsorted(EI, rows); ends = np.searchsorted(EI, rows, side="right")

t0 = time.time()
A = np.zeros((nu, nu))
fixed_entries = []      # per row: (fixed cols, vals) for the right-hand side
rowcols = []
for r, j in enumerate(rows):
    ks, ws = EJ[starts[r]:ends[r]], EW[starts[r]:ends[r]]
    cols = np.concatenate([ks, [j]]); vals = np.concatenate([ws, [-diag[j]]])
    fu = uidx[cols] >= 0
    cu, vu = uidx[cols[fu]], vals[fu]
    s = 1.0 / Mv[j]
    A[np.ix_(cu, cu)] += s * np.outer(vu, vu)
    rowcols.append((cu, vu * s, cols[~fu], vals[~fu]))
print("system %dx%d built in %.1fs" % (nu, nu, time.time() - t0))

def fill(X):
    """Positions of the pocket minimising the thin-plate energy, all else fixed at X."""
    b = np.zeros((nu, 3))
    for cu, vus, cf, vf in rowcols:
        y = vf @ X[cf]
        b[cu] -= np.outer(vus, y)
    return np.linalg.solve(A, b)

# --------------------------------------------------------------- the keys
basis = obj.shape_key_add(name="Basis", from_mix=False)
probe = obj.shape_key_add(name="probe", from_mix=False); probe.value = 1.0
base_co = co.copy()
def set_key(k, Xk):
    k.data.foreach_set("co", Xk.ravel())
def jacobian():
    """Per pocket vertex, d(skinned)/d(rest): 3 finite differences."""
    set_key(probe, base_co); P0 = C.evaluated_co(obj)[U]
    Jm = np.zeros((nu, 3, 3)); e = 1e-3
    for ax in range(3):
        X = base_co.copy(); X[U, ax] += e; set_key(probe, X)
        Jm[:, :, ax] = (C.evaluated_co(obj)[U] - P0) / e
    set_key(probe, base_co)
    return P0, Jm
offsets, report = {}, {}
for deg in ANGLES:
    C.elevate(arm, deg)
    Xs = C.evaluated_co(obj)
    t0 = time.time(); target = fill(Xs); ts = time.time() - t0
    P0, Jm = jacobian()
    off = np.linalg.solve(Jm, (target - P0)[:, :, None])[:, :, 0]
    # check: the key alone, at full value, must land the pocket on the target
    X = base_co.copy(); X[U] += off; set_key(probe, X)
    res = np.linalg.norm(C.evaluated_co(obj)[U] - target, axis=1).max()
    set_key(probe, base_co)
    move = np.linalg.norm(target - P0, axis=1)
    report[deg] = dict(solve_s=round(ts, 1), residual_mm=float(res * 1e3), move_mm_median=float(np.median(move) * 1e3), move_mm_max=float(move.max() * 1e3))
    print("%d deg: fill %.1fs; pocket moved median %.1f mm, max %.1f mm from skinning; key residual %.4f mm" % (
        deg, ts, report[deg]["move_mm_median"], report[deg]["move_mm_max"], res * 1e3))
    offsets[deg] = off
    np.save(os.path.join(C.SCRATCH, "corrective", "out", "target_%d.npy" % deg), target)
C.rest_pose(arm)
obj.shape_key_remove(probe)
for deg in ANGLES:
    k = obj.shape_key_add(name="armpit_R_%d" % deg, from_mix=False)
    X = base_co.copy(); X[U] += offsets[deg]; set_key(k, X)
    k.value = 0.0
    k.slider_min, k.slider_max = 0.0, 1.0
    fc = k.driver_add("value"); dr = fc.driver; dr.type = 'SCRIPTED'
    v = dr.variables.new(); v.name = "w"; v.type = 'TRANSFORMS'
    t = v.targets[0]; t.id = arm; t.bone_target = "Bone.010"
    t.transform_type = 'ROT_W'; t.rotation_mode = 'QUATERNION'; t.transform_space = 'LOCAL_SPACE'
    a = "degrees(2*acos(min(1.0, abs(w))))"
    dr.expression = {30: "max(0.0, 1.0 - abs(%s - 30.0) / 30.0)" % a,
                     60: "max(0.0, 1.0 - abs(%s - 60.0) / 30.0)" % a,
                     90: "min(1.0, max(0.0, (%s - 60.0) / 30.0))" % a}[deg]
    for m in fc.modifiers: fc.modifiers.remove(m)
# every original-face vertex must carry no offset in any key
for k in me.shape_keys.key_blocks[1:]:
    X = np.empty(nv * 3); k.data.foreach_get("co", X); d = np.abs(X.reshape(-1, 3) - base_co).max(1)
    assert d[on_orig].max() == 0.0, k.name
# drivers: do they evaluate headless, and give the intended values?
for deg in (0, 30, 45, 60, 75, 90):
    C.elevate(arm, deg)
    print("driver check %d deg:" % deg, [round(k.value, 3) for k in me.shape_keys.key_blocks[1:]])
C.rest_pose(arm)
np.save(os.path.join(C.SCRATCH, "corrective", "out", "pocket_U.npy"), U)
me["atlas_armpit_experiment"] = "right armpit reconstruction v4 + corrective shape keys 30/60/90 (thin-plate fill), scratch only, 2026-10-14"
bpy.ops.wm.save_as_mainfile(filepath=OUT, check_existing=False, compress=True)
import json; json.dump(report, open(os.path.join(C.SCRATCH, "corrective", "out", "build.json"), "w"), indent=1)
print("saved", OUT)
