"""Bone-placement overlays: the posed deform bones (arm, shoulder, trunk) drawn, clipped to
the frame, over the clay renders of render.py (same cameras, same poses).
  Blender -b build/<file>.blend --python scripts/bones_overlay.py -- <tag>"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C, viz as V
tag = sys.argv[sys.argv.index("--") + 1]
OUT = os.path.join(C.SCRATCH, "renders", tag)
if "ATLAS_Rig" in bpy.data.objects: arm, BONE = bpy.data.objects["ATLAS_Rig"], "upper_arm.R"
else: arm, BONE = bpy.data.objects["Armature.001"], "Bone.010"
V.setup_workbench((560, 560))
target = (-0.255, 0.02, 0.63)
VIEWS = {"front": ((-0.30, -1.0, -0.08), 0.50), "back": ((-0.30, 1.0, -0.08), 0.50), "under": ((-1.0, -0.12, -0.75), 0.42)}
def seg(im, a, b, col, th=1):
    H, W_, _ = im.shape
    n = int(min(4000, np.hypot(*(b - a)))) + 2
    for t in np.linspace(0, 1, n):
        x, y = a + (b - a) * t
        if 0 <= x < W_ and 0 <= y < H:
            im[max(0, int(y) - th):int(y) + th + 1, max(0, int(x) - th):int(x) + th + 1] = col
def dot(im, p, col, r=4):
    H, W_, _ = im.shape
    if not (0 <= p[0] < W_ and 0 <= p[1] < H): return
    yy, xx = np.ogrid[:H, :W_]; im[(xx - p[0]) ** 2 + (yy - p[1]) ** 2 <= r * r] = col
for deg in (0, 30, 60, 90):
    C.elevate(arm, deg, BONE)
    for view, (d, scale) in VIEWS.items():
        cam = V.camera(target, d, ortho_scale=scale); bpy.context.view_layer.update()
        im = V.load_png(os.path.join(OUT, "clay_%s_%02d.png" % (view, deg))) * 0.6 + 0.4
        for pb in arm.pose.bones:
            if not pb.bone.use_deform or pb.name.startswith(("thigh", "shin", "foot", "toe", "index", "middle", "ring", "pinky", "thumb")): continue
            Xp = C.project(cam, (560, 560), np.array([np.array(arm.matrix_world @ pb.head), np.array(arm.matrix_world @ pb.tail)]))
            col = (0.6, 0.1, 0.6) if "twist" in pb.name else (0.05, 0.35, 0.75)
            seg(im, Xp[0], Xp[1], col, 1); dot(im, Xp[0], (0.85, 0.15, 0.1), 4)
        V.save_png(np.clip(im, 0, 1), os.path.join(OUT, "bones_%s_%02d.png" % (view, deg)))
C.rest_pose(arm)
print("overlaid", tag)
