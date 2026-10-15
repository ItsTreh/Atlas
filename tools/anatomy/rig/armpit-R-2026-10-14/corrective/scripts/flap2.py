import sys, os, heapq
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "scripts")); sys.dont_write_bytecode = True
import bpy, numpy as np
from collections import Counter
import common as C
C.guard()
obj = bpy.data.objects["Mesh_0"]; arm = bpy.data.objects["Armature.001"]; me = obj.data
co, ev = C.mesh_arrays(me); nv = len(co)
W = C.weights(obj)
S = np.load(os.path.join(C.SCRATCH, "corrective", "out", "sets.npz"))
C.elevate(arm, 90)
pb = arm.pose.bones["Bone.010"]
P = C.evaluated_co(obj)
M = np.array(arm.matrix_world @ pb.matrix @ pb.bone.matrix_local.inverted() @ arm.matrix_world.inverted())
rigid = co @ M[:3, :3].T + M[:3, 3]
hd = np.array(arm.matrix_world @ pb.head); tl = np.array(arm.matrix_world @ pb.tail); Lb = np.linalg.norm(tl - hd); ax = (tl - hd) / Lb
def radius(X):
    rel = X - hd; t = rel @ ax; return np.linalg.norm(rel - t[:, None] * ax, axis=1), t
rad, t = radius(P); radr, _ = radius(rigid)
sel = np.flatnonzero((P[:, 0] < -0.36) & (t > 0.10) & (t < 0.22) & (rad > 0.10))
print("flap vertices at 90 deg (radius > 10 cm, t .10-.22):", len(sel))
print("  rest x %.3f..%.3f y %.3f..%.3f z %.3f..%.3f" % tuple(np.ravel([[co[sel, k].min(), co[sel, k].max()] for k in range(3)])))
print("  radius if they moved rigidly with the arm: median %.1f max %.1f cm  (posed median %.1f)" % (np.median(radr[sel]) * 100, radr[sel].max() * 100, np.median(rad[sel]) * 100))
wa = W["Bone.010"] + W["Bone.011"]
print("  arm weight median %.2f min %.2f max %.2f" % (np.median(wa[sel]), wa[sel].min(), wa[sel].max()))
inner = set(S["innerarm"].tolist()); print("  in the v2 inner-arm set:", sum(int(i) in inner for i in sel))
# rest geometry: their position relative to the arm at rest -- how far out from the rest arm axis
C.rest_pose(arm)
hd0 = np.array(arm.matrix_world @ arm.pose.bones["Bone.010"].head); tl0 = np.array(arm.matrix_world @ arm.pose.bones["Bone.010"].tail); ax0 = (tl0 - hd0) / np.linalg.norm(tl0 - hd0)
rel = co - hd0; t0 = rel @ ax0; r0 = np.linalg.norm(rel - t0[:, None] * ax0, axis=1)
print("  at rest, their radius from the arm axis: median %.1f max %.1f cm" % (np.median(r0[sel]) * 100, r0[sel].max() * 100))
# geodesic to the arm cut copy and to the chest cut copy on original edges
on_orig_edges = ev
nb = [[] for _ in range(nv)]
for (i, j) in ev:
    l = np.linalg.norm(co[i] - co[j]); nb[i].append((j, l)); nb[j].append((i, l))
def geo(src, reach=0.15):
    d = {int(v): 0.0 for v in src}; pq = [(0.0, int(v)) for v in src]
    while pq:
        x, u = heapq.heappop(pq)
        if x > d[u] or x > reach: continue
        for o, l in nb[u]:
            if o in blocked: continue
            if x + l < d.get(o, 9): d[o] = x + l; heapq.heappush(pq, (x + l, o))
    return d
blocked = set(S["FB"].tolist()) | set(S["walls"].tolist()) | set(S["dome"].tolist())
da = geo(S["cut_arm"]); dc = geo(S["cut_chest"])
print("  geodesic to the arm copy of the cut: median %.1f cm; to the chest copy: median %.1f cm" % (
    np.median([da.get(int(i), 9) for i in sel]) * 100, np.median([dc.get(int(i), 9) for i in sel]) * 100))
# nearest torso-weighted surface at rest
tors = np.flatnonzero(wa < 0.05)
from mathutils.kdtree import KDTree
kd = KDTree(len(tors))
for k, i in enumerate(tors): kd.insert(co[i], k)
kd.balance()
gaps = [kd.find(co[i])[2] for i in sel]
print("  at rest, distance to the nearest torso-only vertex: median %.1f mm, min %.1f mm" % (np.median(gaps) * 1000, min(gaps) * 1000))
