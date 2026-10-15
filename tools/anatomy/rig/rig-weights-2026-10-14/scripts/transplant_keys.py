"""TEST ONLY: put the armpit study's corrective keys v5 (armpit_R_30/60/90) on a new-rig copy,
driven the same way but by upper_arm.R, to see whether they still help on the new weights.
  Blender -b build/<name>_weighted.blend --python scripts/transplant_keys.py -- <name>
Saves build/<name>_oldkeys.blend. The keys' offsets were solved against the OLD rig's skinning,
so on the new weights they no longer land where they were designed to."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C
C.guard()
name = sys.argv[sys.argv.index("--") + 1]
obj = bpy.data.objects["Mesh_0"]; me = obj.data; ao = bpy.data.objects["ATLAS_Rig"]
with bpy.data.libraries.load(os.path.join(C.SCRATCH, "build", "prev_keys_v5.blend"), link=False) as (s_, d_):
    d_.meshes = ["Mesh_0"]
src = d_.meshes[0]; nv = len(me.vertices); assert len(src.vertices) == nv
basis = C.mesh_co(me); sb = np.empty(nv * 3); src.shape_keys.key_blocks["Basis"].data.foreach_get("co", sb)
assert np.array_equal(sb.reshape(-1, 3), basis)
obj.shape_key_add(name="Basis", from_mix=False)
EXPR = {"armpit_R_30": "max(0.0, 1.0 - abs(degrees(2*acos(min(1.0, abs(w)))) - 30.0) / 30.0)",
        "armpit_R_60": "max(0.0, 1.0 - abs(degrees(2*acos(min(1.0, abs(w)))) - 60.0) / 30.0)",
        "armpit_R_90": "min(1.0, max(0.0, (degrees(2*acos(min(1.0, abs(w)))) - 60.0) / 30.0))"}
for k, ex in EXPR.items():
    kb = obj.shape_key_add(name=k, from_mix=False)
    X = np.empty(nv * 3); src.shape_keys.key_blocks[k].data.foreach_get("co", X); kb.data.foreach_set("co", X)
    fc = kb.driver_add("value"); d = fc.driver; d.type = 'SCRIPTED'; d.expression = ex
    v = d.variables.new(); v.name = "w"; v.type = 'TRANSFORMS'
    t = v.targets[0]; t.id = ao; t.bone_target = "upper_arm.R"; t.transform_type = 'ROT_W'; t.rotation_mode = 'QUATERNION'; t.transform_space = 'LOCAL_SPACE'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(C.SCRATCH, "build", name + "_oldkeys.blend"), check_existing=False, compress=True)
print("transplanted")
