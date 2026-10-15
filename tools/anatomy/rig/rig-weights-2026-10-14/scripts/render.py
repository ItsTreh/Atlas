"""Renders of one scratch copy at 0/30/60/90 deg of right-arm elevation from the armpit
study's fixed orthographic cameras (same targets, directions and scales): clay, stretch
heat, paint, and (new rig only) the upper-arm weight.
  Blender -b build/<file>.blend --python scripts/render.py -- <tag>"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C, viz as V
C.guard()
tag = sys.argv[sys.argv.index("--") + 1]
OUT = os.path.join(C.SCRATCH, "renders", tag); os.makedirs(OUT, exist_ok=True)
obj = bpy.data.objects["Mesh_0"]; me = obj.data
if "ATLAS_Rig" in bpy.data.objects: arm, BONE = bpy.data.objects["ATLAS_Rig"], "upper_arm.R"
else: arm, BONE = bpy.data.objects["Armature.001"], "Bone.010"
for o in bpy.data.objects:
    if o.type == 'ARMATURE': o.hide_render = True
C.rest_pose(arm)
nl = len(me.loops); ls, lt, lv = C.faces(me); nf = len(ls)
face_of_loop = np.repeat(np.arange(nf), lt)
def poly_area(P):
    a = np.zeros(nf)
    for k in range(1, lt.max() - 1):
        m = lt > k + 1
        i0, i1, i2 = lv[ls[m]], lv[ls[m] + k], lv[ls[m] + k + 1]
        a[m] += 0.5 * np.linalg.norm(np.cross(P[i1] - P[i0], P[i2] - P[i0]), axis=1)
    return a
A0 = poly_area(C.evaluated_co(obj))
px, w, h = C.paint_pixels()
uv = np.empty(nl * 2); me.uv_layers["Paint"].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
pc = np.ones((nl, 4), np.float32)
pc[:, :3] = px[np.clip((uv[:, 1] * h).astype(int), 0, h - 1), np.clip((uv[:, 0] * w).astype(int), 0, w - 1)]
paint_attr = me.color_attributes.new("PaintView", 'BYTE_COLOR', 'CORNER'); paint_attr.data.foreach_set("color", pc.ravel())
heat_attr = me.color_attributes.new("Heat", 'BYTE_COLOR', 'CORNER')
def heat_colours(ratio):
    """Area ratio -> colour: 1 grey, 2 yellow, 4 orange, >=10 red; <0.5 blue."""
    g = np.array([0.80, 0.79, 0.77]); y = np.array([0.98, 0.85, 0.25]); o = np.array([0.97, 0.50, 0.12]); r = np.array([0.80, 0.08, 0.08]); b = np.array([0.25, 0.45, 0.90])
    L = np.log2(np.clip(ratio, 1e-3, 1e3))
    c = np.tile(g, (len(ratio), 1))
    t = np.clip(L / 1.0, 0, 1)[:, None]; c = np.where((L > 0)[:, None], g + t * (y - g), c)
    t = np.clip(L - 1.0, 0, 1)[:, None]; c = np.where((L > 1)[:, None], y + t * (o - y), c)
    t = np.clip((L - 2.0) / 1.32, 0, 1)[:, None]; c = np.where((L > 2)[:, None], o + t * (r - o), c)
    t = np.clip(-L - 1.0, 0, 1)[:, None]; c = np.where((L < -1)[:, None], g + t * (b - g), c)
    return c
V.setup_workbench((560, 560))
bpy.context.scene.display.shading.show_specular_highlight = True
target = (-0.255, 0.02, 0.63)
VIEWS = {"front": ((-0.30, -1.0, -0.08), 0.50), "back": ((-0.30, 1.0, -0.08), 0.50), "under": ((-1.0, -0.12, -0.75), 0.42)}
WA = me.color_attributes.get("W_upper_arm_R")
for deg in (0, 30, 60, 90):
    C.elevate(arm, deg, BONE)
    P = C.evaluated_co(obj)
    ratio = poly_area(P) / np.maximum(A0, 1e-14)
    hc = np.ones((nl, 4), np.float32); hc[:, :3] = heat_colours(ratio)[face_of_loop]
    heat_attr.data.foreach_set("color", hc.ravel())
    for view, (d, scale) in VIEWS.items():
        V.camera(target, d, ortho_scale=scale)
        V.render(os.path.join(OUT, "clay_%s_%02d.png" % (view, deg)), 'SINGLE')
        # bone placement: the posed deform bones drawn over the clay render
        cam = bpy.context.scene.camera; im = V.load_png(os.path.join(OUT, "clay_%s_%02d.png" % (view, deg))) * 0.6 + 0.4
        MWa = arm.matrix_world
        for pb in arm.pose.bones:
            if not pb.bone.use_deform or pb.name.startswith(("thigh", "shin", "foot", "toe")): continue
            Xp = C.project(cam, (560, 560), np.array([np.array(MWa @ pb.head), np.array(MWa @ pb.tail)]))
            if ((Xp < -200) | (Xp > 760)).all(): continue
            col = (0.6, 0.1, 0.6) if "twist" in pb.name else (0.85, 0.3, 0.0) if pb.name.startswith(("index", "middle", "ring", "pinky", "thumb")) else (0.05, 0.35, 0.75)
            C.draw_line(im, Xp[0], Xp[1], col, 1); C.draw_dot(im, Xp[0], (0.85, 0.15, 0.1), 3)
        V.save_png(np.clip(im, 0, 1), os.path.join(OUT, "bones_%s_%02d.png" % (view, deg)))
        me.color_attributes.active_color = heat_attr
        V.render(os.path.join(OUT, "heat_%s_%02d.png" % (view, deg)), 'VERTEX')
        me.color_attributes.active_color = paint_attr
        V.render(os.path.join(OUT, "paint_%s_%02d.png" % (view, deg)), 'VERTEX')
        if WA is not None and deg in (0, 90):
            me.color_attributes.active_color = WA
            V.render(os.path.join(OUT, "weight_%s_%02d.png" % (view, deg)), 'VERTEX')
C.rest_pose(arm)
print("rendered", tag)
