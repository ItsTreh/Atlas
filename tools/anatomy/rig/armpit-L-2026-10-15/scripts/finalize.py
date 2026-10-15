"""Make the result file from a weighted build: drop the study's view-only colour attributes,
put the rig in rest pose, keep everything else.
  Blender -b build/<name>_weighted.blend --python scripts/finalize.py -- <out name>"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy
import common as C
C.guard()
out = sys.argv[sys.argv.index("--") + 1]
me = bpy.data.objects["Mesh_0"].data
for n in ("Territory", "W_upper_arm_R", "W_upper_arm_L", "PaintView", "Heat", "WView"):
    a = me.color_attributes.get(n)
    if a: me.color_attributes.remove(a)
print("colour attributes left:", [a.name for a in me.color_attributes])
C.rest_pose(bpy.data.objects["ATLAS_Rig"])
me["atlas_armpit_L_experiment"] = "left armpit reconstruction 2026-10-15 (repairL + relaxL; weights: baseline method, left arm side 5 cm), scratch only"
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(C.SCRATCH, "result", out + ".blend"), check_existing=False, compress=True)
print("saved", out)
