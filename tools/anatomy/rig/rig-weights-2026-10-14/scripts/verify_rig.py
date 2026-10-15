"""Checks on the rebuilt armature (adapted from the rig study's verify_rig.py).
  Blender -b build/<name>.blend --python scripts/verify_rig.py -- <name>
Writes out/verify_<name>.json and renders/rig_<name>.png."""
import sys, os, json, re
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree
import common as C, viz as V
C.guard()
TAG = sys.argv[sys.argv.index("--") + 1]
ao = bpy.data.objects["ATLAS_Rig"]; ad = ao.data; body = bpy.data.objects["Mesh_0"]
CAL = json.load(open(os.path.join(C.SCRATCH, "out", "calibrated_rig.json")))["bones"]
res = {}
def unit(v): return v / np.linalg.norm(v)
MW = np.array(ao.matrix_world)
def W(v): return (MW @ np.r_[np.array(v), 1])[:3]
bones = ad.bones
res["bones"] = len(bones); res["deform"] = sum(b.use_deform for b in bones)
res["collections"] = {c.name: len(c.bones) for c in ad.collections}
# ---------------------------------------------------- inside the body
me = body.data; P = C.mesh_world(body)
ls, lt, lv = C.faces(me)
polys = [tuple(lv[ls[i]:ls[i] + lt[i]]) for i in range(len(ls))]
bvh = BVHTree.FromPolygons([tuple(p) for p in P], polys)
def inside(p):
    """Ray parity along +x, +y and -z; majority vote."""
    votes = 0
    for d in (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, -1))):
        o = Vector(p); n = 0
        while True:
            hit = bvh.ray_cast(o, d)
            if hit[0] is None: break
            n += 1; o = hit[0] + d * 1e-5
        votes += n % 2
    return votes >= 2
def depth(p):
    return bvh.find_nearest(Vector(p))[3]
outside, shallow, report = [], [], []
for b in bones:
    if not b.use_deform: continue
    for tag, p in (("head", W(b.head_local)), ("mid", 0.5 * (W(b.head_local) + W(b.tail_local))), ("tail", W(b.tail_local))):
        tip = tag == "tail" and not b.children        # chain ends (finger tips, toe tips, neck top, scapula tip) sit at the skin
        ins, dp = inside(p), depth(p)
        if not ins and not tip: outside.append("%s %s (%.1f mm out)" % (b.name, tag, dp * 1e3))
        elif ins and dp < 0.003 and not tip: shallow.append("%s %s (%.1f mm deep)" % (b.name, tag, dp * 1e3))
res["joints_outside_body"] = outside; res["joints_under_3mm_deep"] = shallow
# ---------------------------------------------------- positive X = the natural bend
RULES = [(r"^(pelvis|spine_\d+|neck)$", (0, -1, 0), "forward"), (r"^clavicle", (0, 0, 1), "up"), (r"^scapula\.L", (1, 0, 0), "out"),
         (r"^scapula\.R", (-1, 0, 0), "out"), (r"^(upper_arm|upper_arm_twist|forearm|forearm_twist)\.", (0, -1, 0), "forward"),
         (r"^thigh", (0, -1, 0), "forward"), (r"^shin", (0, 1, 0), "back"), (r"^foot", (0, 0, 1), "up"), (r"^toe", (0, 0, -1), "down")]
bend_bad = []
bpy.context.view_layer.update()
for b in bones:
    pb = ao.pose.bones[b.name]
    rule = next(((d, t) for pat, d, t in RULES if re.match(pat, b.name)), None)
    if rule is None: continue
    for q in ao.pose.bones: q.matrix_basis = Matrix()
    t0 = np.array(ao.matrix_world @ pb.tail) if False else W(b.tail_local)
    pb.rotation_quaternion = Quaternion((1, 0, 0), np.radians(20))
    bpy.context.view_layer.update()
    t1 = np.array(ao.matrix_world @ pb.tail)
    mv = t1 - t0
    if mv @ np.array(rule[0]) <= 0: bend_bad.append("%s moves %s on +X, expected %s" % (b.name, np.round(mv / np.linalg.norm(mv), 2), rule[1]))
    pb.rotation_quaternion = Quaternion()
for q in ao.pose.bones: q.matrix_basis = Matrix()
bpy.context.view_layer.update()
res["positive_X_wrong_way"] = bend_bad
# fingers: +X curls toward the palm (the tail moves toward the hand's palm side)
F = json.load(open(os.path.join(C.RIGSTUDY, "out", "fingers.json")))
curl_bad = []
for b in bones:
    m = re.match(r"^(index|middle|ring|pinky|thumb)_0(\d)\.([LR])$", b.name)
    if not m: continue
    Nh = np.array(F["frame." + m.group(3)]["N"]); Wd = np.array(F["frame." + m.group(3)]["W"])
    want = Wd if m.group(1) == "thumb" else Nh
    pb = ao.pose.bones[b.name]; t0 = W(b.tail_local)
    pb.rotation_quaternion = Quaternion((1, 0, 0), np.radians(20)); bpy.context.view_layer.update()
    mv = np.array(ao.matrix_world @ pb.tail) - t0; pb.rotation_quaternion = Quaternion(); bpy.context.view_layer.update()
    # the curl direction of a curled phalanx: toward the palm side, or (for the tip segments) toward the wrist
    if mv @ want <= 0 and mv @ (-np.array(F["frame." + m.group(3)]["Yh"])) <= 0:
        curl_bad.append(b.name)
res["fingers_not_curling_to_palm"] = curl_bad
# ---------------------------------------------------- mirror consistency of axes
Mx = np.diag([-1.0, 1, 1])
mir = {}
for b in bones:
    if not b.name.endswith(".L"): continue
    r = bones.get(b.name[:-2] + ".R")
    XL = np.array(b.matrix_local)[:3, 0]; XR = np.array(r.matrix_local)[:3, 0]
    ang = np.degrees(np.arccos(np.clip(XR @ (-(Mx @ XL)), -1, 1)))
    mir[b.name[:-2]] = round(float(ang), 1)
res["mirror_axis_deviation_deg"] = mir
# ---------------------------------------------------- twist bones
tw = {}
for s in ("L", "R"):
    for q in ao.pose.bones: q.matrix_basis = Matrix()
    ao.pose.bones["hand." + s].rotation_quaternion = Quaternion((0, 1, 0), np.radians(60)); bpy.context.view_layer.update()
    pt, pp = ao.pose.bones["forearm_twist." + s], ao.pose.bones["forearm." + s]
    # evaluated rotation of the twist bone relative to its parent, compared with the rest relation
    rest_rel = pp.bone.matrix_local.inverted() @ pt.bone.matrix_local
    pose_rel = pp.matrix.inverted() @ pt.matrix
    a = (rest_rel.inverted() @ pose_rel).to_quaternion()
    tw["forearm_twist." + s + " roll for 60 deg hand roll (deg)"] = round(float(np.degrees(a.angle)), 1)
    for q in ao.pose.bones: q.matrix_basis = Matrix()
    ao.pose.bones["upper_arm." + s].rotation_quaternion = Quaternion((1, 0, 0), np.radians(70)); bpy.context.view_layer.update()
    u = ao.pose.bones["upper_arm." + s]; t = ao.pose.bones["upper_arm_twist." + s]
    du = unit(np.array(u.tail - u.head)); dt = unit(np.array(t.tail - t.head))
    tw["upper_arm_twist." + s + " off the arm after 70 deg flexion (deg)"] = round(float(np.degrees(np.arccos(np.clip(du @ dt, -1, 1)))), 2)
for q in ao.pose.bones: q.matrix_basis = Matrix()
bpy.context.view_layer.update()
res["twist"] = tw
# ---------------------------------------------------- positions vs the calibrated file
err = {}
for b in bones:
    if b.name not in CAL: continue
    e_ = max(np.linalg.norm(W(b.head_local) - np.array(CAL[b.name]["head"])), np.linalg.norm(W(b.tail_local) - np.array(CAL[b.name]["tail"]))) * 1e3
    if e_ > 0.001: err[b.name] = round(float(e_), 3)
res["position_error_vs_calibrated_mm"] = err
res["axis_change_vs_calibrated_deg"] = {b.name: round(float(np.degrees(np.arccos(np.clip(np.array(b.matrix_local)[:3, 0] @ np.array(CAL[b.name]["x"]), -1, 1)))), 1)
                                         for b in bones if b.name in CAL and np.array(b.matrix_local)[:3, 0] @ np.array(CAL[b.name]["x"]) < np.cos(np.radians(1))}
res["hierarchy_roots"] = [b.name for b in bones if b.parent is None]
res["connected"] = sum(b.use_connect for b in bones)
json.dump(res, open(os.path.join(C.SCRATCH, "out", "verify_%s.json" % TAG), "w"), indent=1)
print(json.dumps(res, indent=1))
# ---------------------------------------------------- renders: the rig read back from the file
V.setup_workbench((560, 1000)); ao.hide_render = True
segs = [(W(b.head_local), W(b.tail_local), b.name) for b in bones]
def col(n):
    if n.startswith(("upper_arm_twist", "forearm_twist")): return (0.6, 0.1, 0.6)
    if re.match(r"^(index|middle|ring|pinky|thumb)", n): return (0.75, 0.4, 0.0)
    if n in ("root",): return (0.4, 0.4, 0.4)
    return (0.05, 0.35, 0.75)
ims = []
for view, d_ in (("front", (0, -1, 0)), ("side_right", (-1, 0, 0)), ("back", (0, 1, 0)), ("side_left", (1, 0, 0))):
    cam = V.camera((0, 0, -0.01), d_, ortho_scale=2.0); bpy.context.view_layer.update()
    f = os.path.join(C.SCRATCH, "renders", "body_%s_%s.png" % (TAG, view))
    if not os.path.exists(f): V.render(f, 'SINGLE')
    im = V.load_png(f) * 0.55 + 0.45
    for h, t, n in segs:
        X = C.project(cam, (560, 1000), np.array([h, t])); C.draw_line(im, X[0], X[1], col(n), 1); C.draw_dot(im, X[0], (0.85, 0.15, 0.1), 2)
    ims.append(im)
V.save_png(V.sheet(ims, 4, ["FRONT", "RIGHT SIDE", "BACK", "LEFT SIDE"], header="ATLAS RIG REBUILT  BLUE BONES  PURPLE TWIST  ORANGE FINGERS  RED HEADS", scale=3), os.path.join(C.SCRATCH, "renders", "rig_%s.png" % TAG))
print("rendered")
