"""Rebuild the 59-bone ATLAS armature on a scratch copy and unbind the old rig.
  Blender -b original/<source>.blend --python scripts/build_rig.py -- <out name>
Joint positions: the user's calibrated file (out/calibrated_rig.json, read from
original/Male_Body_rig_calibrated.blend), which is joints.json + the user's edits
(fingers, thumbs, clavicle heads, scapula tips). thumb_03.R is missing from that
file; it is restored by splitting the calibrated thumb_02.R at the measured IP joint.
Axes are recomputed with build 1's rules (scripts/build_rig.py of the rig study), so
positive local X is again each joint's natural bend after the user's edits.
The old rig (Armature.001), its 38 vertex groups and both old Armature modifiers are
removed. Weights are a separate step (weights.py). Saves build/<out name>.blend."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import common as C
C.guard()
name = sys.argv[sys.argv.index("--") + 1]
OUTF = os.path.join(C.SCRATCH, "build", name + ".blend")
CAL = json.load(open(os.path.join(C.SCRATCH, "out", "calibrated_rig.json")))["bones"]
F = json.load(open(os.path.join(C.RIGSTUDY, "out", "fingers.json")))
def unit(v): v = np.asarray(v, float); return v / np.linalg.norm(v)
FRONT, BACK, UP, DOWN = np.array([0, -1.0, 0]), np.array([0, 1.0, 0]), np.array([0, 0, 1.0]), np.array([0, 0, -1.0])
body = bpy.data.objects["Mesh_0"]; P = C.mesh_world(body)
H = {k: np.array(v["head"]) for k, v in CAL.items()}; T = {k: np.array(v["tail"]) for k, v in CAL.items()}

# ---- restore thumb_03.R. In the calibrated file thumb_02.R already runs to the thumb's
# tip (the ray along it leaves the skin 2.7 mm past its tail), so thumb_03.R is restored by
# splitting thumb_02.R at the measured IP joint (fingers.json), projected onto it. The user's
# chain ends (thumb_02.R head, thumb tip) stay exactly where they were placed.
log = {}
if "thumb_03.R" not in CAL:
    ls, lt, lv = C.faces(body.data)
    bvh = BVHTree.FromPolygons([tuple(p) for p in P], [tuple(lv[ls[i]:ls[i] + lt[i]]) for i in range(len(ls))])
    h2, t2 = H["thumb_02.R"].copy(), T["thumb_02.R"].copy(); d = unit(t2 - h2); L = np.linalg.norm(t2 - h2)
    hit = bvh.ray_cast(Vector(t2), Vector(d))
    ip = np.array(F["thumb.R"]["ip"]); s_ = float(np.clip((ip - h2) @ d / L, 0.35, 0.65)); split = h2 + s_ * (t2 - h2)
    T["thumb_02.R"] = split; H["thumb_03.R"], T["thumb_03.R"] = split.copy(), t2
    CAL["thumb_03.R"] = dict(parent="thumb_02.R", connect=True, deform=True)
    log["thumb_03.R"] = dict(calibrated_thumb_02R_length_mm=round(L * 1e3, 1), tip_ray_exit_mm=round(float(np.linalg.norm(np.array(hit[0]) - t2)) * 1e3, 1) if hit[0] else None,
                             measured_ip_off_axis_mm=round(float(np.linalg.norm((ip - h2) - ((ip - h2) @ d) * d)) * 1e3, 1),
                             split_fraction=round(s_, 3), thumb_02R_mm=round(s_ * L * 1e3, 1), thumb_03R_mm=round((1 - s_) * L * 1e3, 1),
                             split_point=split.round(4).tolist())

# ---- bone list in build 1's order, with build 1's axis rules
B = []
def add(name, z, coll):
    c = CAL[name]
    B.append(dict(name=name, parent=c["parent"], head=H[name], tail=T[name], z=z, connect=c["connect"], deform=c["deform"], coll=coll))
def hinge(a_dir, b_dir, z_rule, min_deg=10):
    c = np.cross(unit(a_dir), unit(b_dir))
    return ("hinge", c, z_rule) if np.degrees(np.arcsin(min(1, np.linalg.norm(c)))) > min_deg else z_rule
add("root", UP, "Root")
for nm in ("pelvis", "spine_01", "spine_02", "spine_03", "spine_04", "neck"): add(nm, FRONT, "Trunk")
for s, sx in (("L", 1), ("R", -1)):
    LAT = np.array([sx, 0, 0.0])
    add("clavicle." + s, UP, "Arm." + s); add("scapula." + s, LAT, "Arm." + s)
    for nm in ("upper_arm", "upper_arm_twist", "forearm", "forearm_twist"): add(nm + "." + s, FRONT, "Arm." + s)
    Nh = np.array(F["frame." + s]["N"]); Wd = np.array(F["frame." + s]["W"])
    add("hand." + s, Nh, "Arm." + s)
    for fname in ("index", "middle", "ring", "pinky"):
        pts = [H["%s_01.%s" % (fname, s)], H["%s_02.%s" % (fname, s)], H["%s_03.%s" % (fname, s)], T["%s_03.%s" % (fname, s)]]
        n_ = np.cross(unit(pts[1] - pts[0]), unit(pts[3] - pts[1]))
        if np.linalg.norm(n_) < 0.15: n_ = np.cross(unit(pts[1] - pts[0]), Nh)
        n_ = unit(n_)
        if np.dot(np.cross(n_, unit(pts[1] - pts[0])), Nh) < 0: n_ = -n_
        for j in range(3): add("%s_%02d.%s" % (fname, j + 1, s), ("axis", n_), "Fingers." + s)
    for j in range(3): add("thumb_%02d.%s" % (j + 1, s), Wd, "Fingers." + s)
    add("thigh." + s, FRONT, "Leg." + s)
    add("shin." + s, hinge(H["shin." + s] - H["thigh." + s], T["shin." + s] - H["shin." + s], BACK), "Leg." + s)
    add("foot." + s, UP, "Leg." + s); add("toe." + s, DOWN, "Leg." + s)
assert len(B) == 59 and len({b["name"] for b in B}) == 59, len(B)

# ---- unbind and remove the old rig
for m in list(body.modifiers):
    if m.type == 'ARMATURE': body.modifiers.remove(m)
body.vertex_groups.clear()
old = bpy.data.objects.get("Armature.001")
Mw = body.matrix_world.copy()
body.parent = None; body.matrix_world = Mw
if old: bpy.data.objects.remove(old, do_unlink=True)

# ---- build
ad = bpy.data.armatures.new("ATLAS_Rig"); ao = bpy.data.objects.new("ATLAS_Rig", ad)
bpy.context.scene.collection.objects.link(ao)
ad.display_type = 'OCTAHEDRAL'; ao.show_in_front = True
bpy.context.view_layer.objects.active = ao; ao.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
def x_axis(b):
    Y = unit(b["tail"] - b["head"]); z = b["z"]
    if isinstance(z, tuple) and z[0] == "axis":
        X = z[1] - Y * (z[1] @ Y)
    elif isinstance(z, tuple) and z[0] == "hinge":
        X = z[1] - Y * (z[1] @ Y)
        if np.cross(X, Y) @ z[2] < 0: X = -X
    else:
        Zd = z - Y * (z @ Y); X = np.cross(Y, Zd)
    return unit(X)
eb = {}
for b in B:
    e = ad.edit_bones.new(b["name"]); e.head = Vector(b["head"]); e.tail = Vector(b["tail"])
    X = x_axis(b); Y = unit(b["tail"] - b["head"]); e.align_roll(Vector(np.cross(X, Y)))
    e.use_deform = b["deform"]; eb[b["name"]] = e
for b in B:
    if b["parent"]: eb[b["name"]].parent = eb[b["parent"]]; eb[b["name"]].use_connect = b["connect"]
bpy.ops.object.mode_set(mode='OBJECT')
for b in B:
    col = ad.collections.get(b["coll"]) or ad.collections.new(b["coll"]); col.assign(ad.bones[b["name"]])
for s in ("L", "R"):
    c = ao.pose.bones["upper_arm_twist." + s].constraints.new('DAMPED_TRACK'); c.target = ao; c.subtarget = "upper_arm." + s; c.head_tail = 1.0
    c = ao.pose.bones["forearm_twist." + s].constraints.new('COPY_ROTATION'); c.target = ao; c.subtarget = "hand." + s
    c.use_x = False; c.use_y = True; c.use_z = False; c.mix_mode = 'REPLACE'; c.target_space = 'LOCAL'; c.owner_space = 'LOCAL'; c.influence = 0.5
for pb in ao.pose.bones: pb.rotation_mode = 'QUATERNION'
ad["atlas"] = "ATLAS deform skeleton, rebuilt 2026-10-14 from the user's calibrated joints (rig-weights study)"
# ---- bind (no weights yet: weights.py fills the groups)
body.parent = ao; body.matrix_parent_inverse = ao.matrix_world.inverted()
for b in B:
    if b["deform"]: body.vertex_groups.new(name=b["name"])
mod = body.modifiers.new("ATLAS_Rig", 'ARMATURE'); mod.object = ao; mod.use_vertex_groups = True; mod.use_deform_preserve_volume = False
bpy.ops.wm.save_as_mainfile(filepath=OUTF, check_existing=False, compress=True)
log.update(bones=len(B), deform=sum(b["deform"] for b in B), out=OUTF)
json.dump(log, open(os.path.join(C.SCRATCH, "out", "build_%s.json" % name), "w"), indent=1)
print(json.dumps(log, indent=1))
