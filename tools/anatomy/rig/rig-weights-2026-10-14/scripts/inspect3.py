import bpy, json, os, numpy as np
W = os.path.expanduser("~/Documents/SD-Routine-scratch/rig-weights-2026-10-14")
def bones(path):
    bpy.ops.wm.open_mainfile(filepath=path, load_ui=False)
    r = bpy.data.objects["ATLAS_Rig"]
    return {b.name: (np.array(b.head_local), np.array(b.tail_local), np.array(b.matrix_local.to_3x3()), b.parent.name if b.parent else None, b.use_connect) for b in r.data.bones}
b1 = bones(os.path.expanduser("~/Documents/SD-Routine-scratch/rig-2026-10-14/build/Male_Body_rig.blend1"))
b2 = bones(os.path.join(W, "original", "Male_Body_rig_calibrated.blend"))
print("build1 bones", len(b1), "calibrated", len(b2))
for k in b1:
    if k not in b2: print("MISSING in calibrated:", k, "head", b1[k][0].round(4), "tail", b1[k][1].round(4)); continue
    dh = np.linalg.norm(b1[k][0] - b2[k][0]) * 1000; dt = np.linalg.norm(b1[k][1] - b2[k][1]) * 1000
    ang = np.degrees(np.arccos(np.clip((b1[k][2][:, 0] * b2[k][2][:, 0]).sum(), -1, 1)))
    if dh > 0.01 or dt > 0.01 or ang > 0.05 or b1[k][3:] != b2[k][3:]:
        print("%-16s head %6.2f mm  tail %6.2f mm  Xaxis %5.1f deg  parent %s->%s connect %s->%s" % (k, dh, dt, ang, b1[k][3], b2[k][3], b1[k][4], b2[k][4]))
for k in ("thumb_01.R", "thumb_02.R", "thumb_03.R", "thumb_02.L", "thumb_03.L"):
    for nm, b in (("build1", b1), ("calib", b2)):
        if k in b: print(nm, k, "head", b[k][0].round(4), "tail", b[k][1].round(4), "len %.1f mm" % (np.linalg.norm(b[k][1] - b[k][0]) * 1000))
# right hand mesh extent near the thumb: distance from calibrated thumb_02.R tail to the skin
body = bpy.data.objects["Mesh_0"]; me = body.data
co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
from mathutils.bvhtree import BVHTree
t = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
for k in ("thumb_02.R", "thumb_03.L"):
    p = b2[k][1]; loc, n, i, d = t.find_nearest(p)
    print(k, "tail to skin %.1f mm" % (d * 1000))
