import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scripts")); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C
C.guard()
obj = bpy.data.objects["Mesh_0"]; me = obj.data
with bpy.data.libraries.load(os.path.join(C.SCRATCH, "reference", "Male_Body.blend"), link=False) as (s, d):
    d.meshes = ["Mesh_0"]
om = d.meshes[0]; nv0, nf0 = len(om.vertices), len(om.polygons)
co, ev = C.mesh_arrays(me)
nf = len(me.polygons)
ls = np.empty(nf, np.int64); me.polygons.foreach_get("loop_start", ls)
lt = np.empty(nf, np.int64); me.polygons.foreach_get("loop_total", lt)
lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get("vertex_index", lv)
orig_loop = np.repeat(np.arange(nf), lt) < nf0
inorig = np.zeros(len(co), bool); inorig[lv[orig_loop]] = True
U = np.flatnonzero(~inorig)
print("nv0", nv0, "nf0", nf0, "nv", len(co), "nf", nf, "unknown pocket verts", len(U), "new verts that are on orig faces (rip copies)", int(inorig[nv0:].sum()))
uv = np.empty(len(me.loops)*2); me.uv_layers["Paint"].data.foreach_get("uv", uv); uv = uv.reshape(-1,2)
pu = uv[~orig_loop]; print("pocket uv range", pu.min(0), pu.max(0))
print("lt of pocket faces", np.unique(lt[nf0:], return_counts=True))
