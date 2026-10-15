"""Make a result file from a weighted build: remove this study's view-only colour attributes
(Territory, W_upper_arm_R/L), put the rig in rest pose, keep everything else.
  Blender -b build/<name>_weighted.blend --python scripts/finalize.py -- <out name>"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy
import common as C
C.guard()
out = sys.argv[sys.argv.index("--") + 1]
obj = bpy.data.objects["Mesh_0"]; me = obj.data
for n in ("Territory", "W_upper_arm_R", "W_upper_arm_L"):
    a = me.color_attributes.get(n)
    if a: me.color_attributes.remove(a)
print("colour attributes left:", [a.name for a in me.color_attributes])
C.rest_pose(bpy.data.objects["ATLAS_Rig"])
bpy.data.objects["ATLAS_Rig"].data["atlas"] = "ATLAS deform skeleton (59 bones), rebuilt 2026-10-14 from the user's calibrated joints; weights from rig-weights study (H_shoulder 7 cm)"
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(C.SCRATCH, "result", out + ".blend"), check_existing=False, compress=True)
print("saved", out)
