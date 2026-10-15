"""Renders of one arm of one scratch copy at 0/30/60/90 deg of elevation: clay, stretch heat,
paint, bones over clay, and the upper-arm weight at 0 and 90. The cameras are the armpit
study's, mirrored for the left (same directions and scales).
  Blender -b <file>.blend --python scripts/render2.py -- <tag> L|R"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C, viz as V
C.guard()
tag, SIDE = sys.argv[sys.argv.index("--") + 1:][:2]
sx = -1 if SIDE == "R" else 1
OUT = os.path.join(C.SCRATCH, "renders", "%s_%s" % (tag, SIDE)); os.makedirs(OUT, exist_ok=True)
obj = bpy.data.objects["Mesh_0"]; me = obj.data; arm = bpy.data.objects["ATLAS_Rig"]; BONE = "upper_arm." + SIDE
arm.hide_render = True
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
    g = np.array([0.80, 0.79, 0.77]); y = np.array([0.98, 0.85, 0.25]); o = np.array([0.97, 0.50, 0.12]); r = np.array([0.80, 0.08, 0.08]); b = np.array([0.25, 0.45, 0.90])
    L = np.log2(np.clip(ratio, 1e-3, 1e3))
    c = np.tile(g, (len(ratio), 1))
    t = np.clip(L / 1.0, 0, 1)[:, None]; c = np.where((L > 0)[:, None], g + t * (y - g), c)
    t = np.clip(L - 1.0, 0, 1)[:, None]; c = np.where((L > 1)[:, None], y + t * (o - y), c)
    t = np.clip((L - 2.0) / 1.32, 0, 1)[:, None]; c = np.where((L > 2)[:, None], o + t * (r - o), c)
    t = np.clip(-L - 1.0, 0, 1)[:, None]; c = np.where((L < -1)[:, None], g + t * (b - g), c)
    return c
W, names = C.weights(obj); GI = {n: k for k, n in enumerate(names)}
ua = W[:, GI[BONE]] + W[:, GI["upper_arm_twist." + SIDE]]
def heatw(x):
    x = np.clip(x, 0, 1)[:, None]
    return np.where(x < 0.5, (1 - 2 * x) * np.array([0.15, 0.25, 0.8]) + 2 * x * np.array([0.95, 0.95, 0.3]),
                    (2 - 2 * x) * np.array([0.95, 0.95, 0.3]) + (2 * x - 1) * np.array([0.85, 0.1, 0.1]))
wa = me.color_attributes.new("WView", 'BYTE_COLOR', 'POINT'); wc = np.ones((len(me.vertices), 4), np.float32); wc[:, :3] = heatw(ua); wa.data.foreach_set("color", wc.ravel())
V.setup_workbench((560, 560))
bpy.context.scene.display.shading.show_specular_highlight = True
target = (-0.255, 0.02, 0.63) if SIDE == "R" else (0.235, 0.04, 0.60)
VIEWS = {"front": ((0.30 * sx, -1.0, -0.08), 0.50), "back": ((0.30 * sx, 1.0, -0.08), 0.50), "under": ((1.0 * sx, -0.12, -0.75), 0.42)}
for deg in (0, 30, 60, 90):
    C.elevate(arm, deg, BONE)
    P = C.evaluated_co(obj)
    ratio = poly_area(P) / np.maximum(A0, 1e-14)
    hc = np.ones((nl, 4), np.float32); hc[:, :3] = heat_colours(ratio)[face_of_loop]
    heat_attr.data.foreach_set("color", hc.ravel())
    for view, (d, scale) in VIEWS.items():
        cam = V.camera(target, d, ortho_scale=scale); bpy.context.view_layer.update()
        f = os.path.join(OUT, "clay_%s_%02d.png" % (view, deg)); V.render(f, 'SINGLE')
        im = V.load_png(f) * 0.6 + 0.4
        for pb in arm.pose.bones:
            if not pb.bone.use_deform or pb.name.startswith(("thigh", "shin", "foot", "toe", "index", "middle", "ring", "pinky", "thumb")): continue
            Xp = C.project(cam, (560, 560), np.array([np.array(arm.matrix_world @ pb.head), np.array(arm.matrix_world @ pb.tail)]))
            n = int(min(4000, np.hypot(*(Xp[1] - Xp[0])))) + 2
            for t in np.linspace(0, 1, n):
                x, y = Xp[0] + (Xp[1] - Xp[0]) * t
                if 0 <= x < 560 and 0 <= y < 560: im[max(0, int(y) - 1):int(y) + 2, max(0, int(x) - 1):int(x) + 2] = (0.6, 0.1, 0.6) if "twist" in pb.name else (0.05, 0.35, 0.75)
            if 0 <= Xp[0][0] < 560 and 0 <= Xp[0][1] < 560: C.draw_dot(im, Xp[0], (0.85, 0.15, 0.1), 4)
        V.save_png(np.clip(im, 0, 1), os.path.join(OUT, "bones_%s_%02d.png" % (view, deg)))
        me.color_attributes.active_color = heat_attr; V.render(os.path.join(OUT, "heat_%s_%02d.png" % (view, deg)), 'VERTEX')
        me.color_attributes.active_color = paint_attr; V.render(os.path.join(OUT, "paint_%s_%02d.png" % (view, deg)), 'VERTEX')
        if deg in (0, 90):
            me.color_attributes.active_color = wa; V.render(os.path.join(OUT, "weight_%s_%02d.png" % (view, deg)), 'VERTEX')
C.rest_pose(arm)
print("rendered", tag, SIDE)
