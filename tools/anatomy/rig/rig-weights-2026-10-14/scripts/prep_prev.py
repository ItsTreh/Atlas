"""Scratch copies of the previous repair for side-by-side measurement.
  Blender -b original/Male_Body_repaired_keys_v5.blend --python scripts/prep_prev.py -- keys_v5
  Blender -b original/Male_Body_repaired.blend --python scripts/prep_prev.py -- repair4
In the keys-v5 file the old armature object had been moved (to z 1.65 m, carrying the body
with it) after the corrective study; its location is put back to the value in every other
copy (0.0202, -0.1042, 0.6551) so all copies share one world frame. Nothing else changes."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C
tag = sys.argv[sys.argv.index("--") + 1]
arm = bpy.data.objects["Armature.001"]
arm.location = (0.020200001, -0.104200006, 0.655099988)
bpy.context.view_layer.update()
body = bpy.data.objects["Mesh_0"]
print("mesh world identity:", np.allclose(np.array(body.matrix_world), np.eye(4), atol=1e-6), np.array(body.matrix_world)[:3, 3])
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(C.SCRATCH, "build", "prev_%s.blend" % tag), check_existing=False, compress=True)
