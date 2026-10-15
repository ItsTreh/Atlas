import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C
deg = float(sys.argv[sys.argv.index("--") + 1])
obj = bpy.data.objects["Mesh_0"]; me = obj.data
if "ATLAS_Rig" in bpy.data.objects: arm, BONE = bpy.data.objects["ATLAS_Rig"], "upper_arm.R"
else: arm, BONE = bpy.data.objects["Armature.001"], "Bone.010"
co = C.mesh_world(obj); nv = len(co)
J = json.load(open(os.path.join(C.SCRATCH, "out", "calibrated_rig.json")))["bones"]["upper_arm.R"]
h0, t0_ = np.array(J["head"]), np.array(J["tail"]); L0 = np.linalg.norm(t0_ - h0); ax0 = (t0_ - h0) / L0
rel = co - h0; tt = rel @ ax0 / L0; rr = np.linalg.norm(rel - np.outer(rel @ ax0, ax0), axis=1)
armskin = (np.arange(nv) < 143690) & (tt > 0.3) & (tt < 0.9) & (rr < 0.075) & (co[:, 0] < -0.20)
C.elevate(arm, deg, BONE); P = C.evaluated_co(obj)
pb = arm.pose.bones[BONE]; hd = np.array(arm.matrix_world @ pb.head); tl = np.array(arm.matrix_world @ pb.tail); Lb = np.linalg.norm(tl - hd); ax = (tl - hd) / Lb
rel = P - hd; t = rel @ ax; rad = np.linalg.norm(rel - t[:, None] * ax, axis=1)
fl = []
for a in np.arange(0.05, 0.9 * Lb, 0.01):
    sk = np.flatnonzero(armskin & (t >= a) & (t < a + 0.01))
    if len(sk) < 30: continue
    ex = rad[sk] - np.median(rad[sk]); fl += [(v, a, ex_) for v, ex_ in zip(sk[ex > 0.03], ex[ex > 0.03])]
fl = np.array(fl)
print("flagged", len(fl))
if len(fl):
    v = fl[:, 0].astype(int)
    print("rest pos pct (x,y,z):", np.percentile(co[v], [5, 50, 95], axis=0).round(3).tolist())
    print("rest tt:", np.percentile(tt[v], [5, 50, 95]).round(2), "rr:", np.percentile(rr[v], [5, 50, 95]).round(3))
    print("slice t (posed):", np.percentile(fl[:, 1], [5, 50, 95]).round(3), "of Lb", round(Lb, 3))
    print("posed pos pct:", np.percentile(P[v], [5, 50, 95], axis=0).round(3).tolist())
    Wm, names = C.weights(obj)
    mw = Wm[v].mean(0); print({names[i]: round(float(mw[i]), 3) for i in np.argsort(-mw)[:5]})
