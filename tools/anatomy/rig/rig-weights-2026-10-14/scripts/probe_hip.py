import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from collections import Counter
from mathutils import Quaternion
import common as C
obj = bpy.data.objects["Mesh_0"]; me = obj.data; ao = bpy.data.objects["ATLAS_Rig"]
tri = C.triangles(me); co = C.mesh_world(obj); fr = C.face_regions(me)[tri[:, 3]]
A0 = 0.5 * np.linalg.norm(np.cross(co[tri[:, 1]] - co[tri[:, 0]], co[tri[:, 2]] - co[tri[:, 0]]), axis=1)
for name, rot in (("hip90 knee120 R", {"thigh.R": 90, "shin.R": 120}), ("hip90 only R", {"thigh.R": 90}), ("knee120 only R", {"shin.R": 120}), ("fist R", dict([("%s_%02d.R" % (f, i), 80) for f in ["index", "middle", "ring", "pinky"] for i in (1, 2, 3)]))):
    C.rest_pose(ao)
    for b, d in rot.items(): ao.pose.bones[b].rotation_quaternion = Quaternion((1, 0, 0), np.radians(d))
    bpy.context.view_layer.update(); P = C.evaluated_co(obj)
    r = 0.5 * np.linalg.norm(np.cross(P[tri[:, 1]] - P[tri[:, 0]], P[tri[:, 2]] - P[tri[:, 0]]), axis=1) / np.maximum(A0, 1e-14)
    m = r > 10; c = co[tri[m, :3]].mean(1)
    cl = Counter(("%+.0f %+.0f %+.0f" % tuple(np.round(x / 0.04) * 4)) for x in c)
    print(name, int(m.sum()), "by region", Counter(fr[m]).most_common(5), "clusters cm", cl.most_common(5))
