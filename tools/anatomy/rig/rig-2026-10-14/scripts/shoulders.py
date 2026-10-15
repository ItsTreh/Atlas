"""Close-up paint renders of both shoulders with the arm centrelines and candidate joint points."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C, sections as S, viz as V
C.guard()
obj = bpy.data.objects["Mesh_0"]; me = obj.data; armo = bpy.data.objects["Armature.001"]; armo.hide_render = True
P = C.mesh_world(obj)
ev = np.empty(len(me.edges) * 2, np.int64); me.edges.foreach_get("vertices", ev); ev = ev.reshape(-1, 2)
ls, lt, lv = C.faces(me); le = np.empty(len(me.loops), np.int64); me.loops.foreach_get("edge_index", le)
M = S.Mesh(P, ev, ls, lt, lv, le)
J = json.load(open(os.path.join(C.SCRATCH, "out", "joints.json")))["joints"]
# paint as a corner colour attribute
img = bpy.data.images.load(os.path.join(C.SCRATCH, "original", "Male_Body.paint.png"), check_existing=False)
w, h = img.size; px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(h, w, 4)
uv = np.empty(len(me.loops) * 2); me.uv_layers["Paint"].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
pc = px[np.clip((uv[:, 1] * h).astype(int), 0, h - 1), np.clip((uv[:, 0] * w).astype(int), 0, w - 1)].copy(); pc[:, 3] = 1
at = me.color_attributes.new("PaintView", 'BYTE_COLOR', 'CORNER'); at.data.foreach_set("color", pc.ravel()); me.color_attributes.active_color = at
tracks = {}
for side, sx in (("R", -1), ("L", 1)):
    a, _ = S.track(M, np.array([0.31 * sx, 0.0, 0.42]), np.array([0, 0, 1.0]), n_max=40)
    b, _ = S.track(M, np.array([0.31 * sx, 0.0, 0.42]), np.array([0, 0, -1.0]), n_max=6)
    tracks[side] = np.vstack([b[::-1], a])
cur = {b.name: np.array(armo.matrix_world @ b.head_local) for b in armo.data.bones}
V.setup_workbench((700, 700))
OUT = os.path.join(C.SCRATCH, "renders"); ims, labs = [], []
VIEWS = [("front", (0, 0, 0.72), (0, -1, 0), 0.9), ("top", (0, 0.02, 0.72), (0, 0, 1), 0.9),
         ("right", (-0.27, 0.0, 0.72), (-1, 0, 0), 0.5), ("left", (0.25, 0.04, 0.72), (1, 0, 0), 0.5)]
if len(sys.argv) > sys.argv.index("--") + 1 if "--" in sys.argv else False:
    VIEWS = [("back", (0, 0.1, 0.68), (0, 1, 0), 0.7)]
for view, tgt, d_, sc in VIEWS:
    up = (0, -1, 0) if view == "top" else (0, 0, 1)
    cam = V.camera(tgt, d_, ortho_scale=sc); 
    if view == "top": cam.rotation_euler = (0, 0, np.pi)
    bpy.context.view_layer.update()
    f = os.path.join(OUT, "shoulder_%s.png" % view); V.render(f, 'VERTEX')
    im = V.load_png(f) * 0.6 + 0.4
    for side in ("R", "L"):
        X = C.project(cam, (700, 700), tracks[side])
        for a2, b2 in zip(X[:-1], X[1:]): C.draw_line(im, a2, b2, (0.1, 0.1, 0.1), 1)
        for nm, col in (("shoulder." + side, (0.85, 0.1, 0.1)), ("acromioclavicular." + side, (0.1, 0.5, 0.1)), ("elbow." + side, (0.85, 0.1, 0.1)), ("scapula_tip." + side, (0.0, 0.0, 0.0))):
            C.draw_dot(im, C.project(cam, (700, 700), np.array(J[nm]))[0], col, 5)
    for nm in ("Bone.010", "Bone.003"):
        C.draw_dot(im, C.project(cam, (700, 700), cur[nm])[0], (0.1, 0.2, 0.9), 5)
    ims.append(im); labs.append(view.upper())
V.save_png(V.sheet(ims, 4, labs, header="SHOULDERS  BLACK ARM CENTRELINE  RED MEASURED  GREEN AC  BLUE CURRENT RIG", scale=3), os.path.join(OUT, "shoulders%s.png" % ("_back" if VIEWS[0][0] == "back" else "")))
print("done")
