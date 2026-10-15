"""Where does the inner-arm flap come from? At 60/90 deg, original vertices
whose skinned position lags the upper arm's rigid motion."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "scripts")); sys.dont_write_bytecode = True
import bpy, numpy as np
from collections import Counter
import common as C
C.guard()
obj = bpy.data.objects["Mesh_0"]; arm = bpy.data.objects["Armature.001"]; me = obj.data
co, ev = C.mesh_arrays(me); nv = len(co)
W = C.weights(obj)
with bpy.data.libraries.load(os.path.join(C.SCRATCH, "reference", "Male_Body.blend"), link=False) as (s, d):
    d.objects = ["Mesh_0"]
oW = C.weights(d.objects[0]); nv0 = len(d.objects[0].data.vertices)
warm = W["Bone.010"] + W.get("Bone.011", 0)
names, pal, reg = C.palette(); px, w, h = C.paint_pixels()
freg = C.face_regions(me, px, w, h, names, pal, reg)
vreg = np.empty(nv, object); vreg[:] = "-"
for p in me.polygons:
    if p.index < 287219:
        for v in p.vertices: vreg[v] = freg[p.index]
for deg in (60, 90):
    C.elevate(arm, deg)
    pb = arm.pose.bones["Bone.010"]
    M = np.array(arm.matrix_world @ pb.matrix @ pb.bone.matrix_local.inverted() @ arm.matrix_world.inverted())
    rigid = co @ M[:3, :3].T + M[:3, 3]
    P = C.evaluated_co(obj)
    lag = np.linalg.norm(P - rigid, axis=1)
    # the flap: posed out beside the arm (x < -0.36), but far from the upper arm's axis
    hd = np.array(arm.matrix_world @ pb.head); tl = np.array(arm.matrix_world @ pb.tail)
    ax = (tl - hd) / np.linalg.norm(tl - hd)
    rel = P - hd; t = rel @ ax; rad = np.linalg.norm(rel - t[:, None] * ax, axis=1)
    armish = (P[:, 0] < -0.36) & (t > 0) & (t < np.linalg.norm(tl - hd)) & (vreg != "-")
    print("%d deg: arm-section radius: median %.1f cm, 95th pct %.1f cm" % (deg, np.median(rad[armish]) * 100, np.percentile(rad[armish], 95) * 100))
    bad = armish & (rad > np.percentile(rad[armish], 50) + 0.03)
    print("   flap candidates (radius > median + 3 cm): %d; lag behind the arm's rigid motion: median %.1f cm" % (bad.sum(), np.median(lag[bad]) * 100 if bad.any() else 0))
    if bad.any():
        b = np.flatnonzero(bad)
        print("   x %.3f..%.3f  y %.3f..%.3f  z %.3f..%.3f" % (co[b,0].min(), co[b,0].max(), co[b,1].min(), co[b,1].max(), co[b,2].min(), co[b,2].max()))
        print("   regions", Counter(vreg[b]).most_common(6))
        print("   arm weight now: median %.2f min %.2f ; in the original: median %.2f min %.2f" % (np.median(warm[b]), warm[b].min(),
              np.median((oW["Bone.010"] + oW.get("Bone.011", 0))[b[b < nv0]]), (oW["Bone.010"] + oW.get("Bone.011", 0))[b[b < nv0]].min()))
        top = Counter()
        for i in b:
            for g, x in W.items():
                if x[i] > 0.05 and g not in ("Bone.010", "Bone.011"): top[g] += 1
        print("   other bones on them", top.most_common(5))
        ch = np.array([any(abs(W[k][i] - oW[k][i]) > 1e-6 for k in oW) for i in b if i < nv0])
        print("   weights changed by repair4: %d of %d" % (ch.sum(), len(ch)))
C.rest_pose(arm)
# the flap's shape in the arm's own frame: radius from the upper arm's axis, at rest (x, z) and posed
C.elevate(arm, 90)
pb = arm.pose.bones["Bone.010"]
P = C.evaluated_co(obj)
hd = np.array(arm.matrix_world @ pb.head); tl = np.array(arm.matrix_world @ pb.tail); Lb = np.linalg.norm(tl - hd); ax = (tl - hd) / Lb
rel = P - hd; t = rel @ ax; rad = np.linalg.norm(rel - t[:, None] * ax, axis=1)
sel = (P[:, 0] < -0.36) & (t > 0) & (t < Lb)
print("90 deg, slices along the upper arm (t from the shoulder head): radius median / max, and where the max sits at rest")
for t0 in np.arange(0.0, Lb, 0.03):
    m = sel & (t >= t0) & (t < t0 + 0.03)
    if m.sum() < 20: continue
    i = np.flatnonzero(m)[np.argmax(rad[m])]
    print("  t %.2f-%.2f  n %5d  r med %.1f  max %.1f cm  max at rest x %.3f y %.3f z %.3f  %s  shape-key moved %.1f mm" % (
        t0, t0 + .03, m.sum(), np.median(rad[m]) * 100, rad[m].max() * 100, co[i, 0], co[i, 1], co[i, 2], vreg[i],
        0 if me.shape_keys is None else np.linalg.norm(P[i] - (co[i] @ np.eye(3))) * 0))
C.rest_pose(arm)
