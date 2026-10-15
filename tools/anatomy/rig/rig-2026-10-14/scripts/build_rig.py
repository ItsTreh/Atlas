"""Build the new ATLAS armature on a SCRATCH copy of Male_Body.blend.
  Blender -b original/Male_Body.blend --python scripts/build_rig.py
Reads out/joints.json and out/fingers.json; saves build/Male_Body_rig.blend.

Only the bones are built: the mesh is not bound to the new armature (weights are
the next step) and keeps its old rig, which is hidden. Nothing outside the
scratch folder is written.

Axes: each bone's local Y runs along it; local X is the joint's hinge axis,
oriented so a POSITIVE rotation about X is the joint's natural bend:
  pelvis, spine, neck   forward bend (flexion)
  clavicle              elevation (shrug)
  scapula               upward rotation (the lower tip swings out)
  upper arm, forearm    flexion (forward / elbow bend)
  hand                  wrist flexion (toward the palm)
  fingers, thumb        curl toward the palm
  thigh                 hip flexion (forward)
  shin                  knee flexion (heel back)
  foot                  dorsiflexion (toes up)
  toe                   toe flexion (curl down)
Where a hinge is visibly bent in the sculpture (knees, fingers) the axis is the
bend's own axis: the cross product of the two segments' directions. Not the
elbows: their bend includes the carrying angle, so they follow the rule.
Twist bones: upper_arm_twist (upper half; Damped Track to the elbow, so it swings
with the arm but does not roll) and forearm_twist (lower half; copies half of the
hand's roll, i.e. pronation/supination).
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from mathutils import Vector
import common as C
C.guard()
OUTF = os.path.join(C.SCRATCH, "build", "Male_Body_rig.blend"); os.makedirs(os.path.dirname(OUTF), exist_ok=True)
J = {k: np.array(v) for k, v in json.load(open(os.path.join(C.SCRATCH, "out", "joints.json")))["joints"].items()}
F = json.load(open(os.path.join(C.SCRATCH, "out", "fingers.json")))
def unit(v): v = np.asarray(v, float); return v / np.linalg.norm(v)
FRONT, BACK, UP, DOWN = np.array([0, -1.0, 0]), np.array([0, 1.0, 0]), np.array([0, 0, 1.0]), np.array([0, 0, -1.0])

old = bpy.data.objects["Armature.001"]; old.hide_set(True); old.hide_viewport = True; old.hide_render = True
body = bpy.data.objects["Mesh_0"]
floor_z = C.mesh_world(body)[:, 2].min()

B = []          # (name, parent, head, tail, Z_desired or ("hinge", a, b) , connect, deform, collection)
def add(name, parent, head, tail, z, connect=False, deform=True, coll="Body"):
    B.append(dict(name=name, parent=parent, head=np.array(head, float), tail=np.array(tail, float), z=z, connect=connect, deform=deform, coll=coll))
def hinge(a_dir, b_dir, z_rule, min_deg=10):
    """The bend's own axis if bent by more than min_deg, else None (use the rule)."""
    c = np.cross(unit(a_dir), unit(b_dir))
    return ("hinge", c, z_rule) if np.degrees(np.arcsin(min(1, np.linalg.norm(c)))) > min_deg else z_rule

pel = J["pelvis"]
add("root", None, [pel[0], pel[1], floor_z], [pel[0], pel[1] - 0.25, floor_z], UP, deform=False, coll="Root")
add("pelvis", "root", pel, J["L5_S1"], FRONT, coll="Trunk")
chain = ["L5_S1", "L3_L4", "T12_L1", "T7", "C7_T1"]
for i, nm in enumerate(["spine_01", "spine_02", "spine_03", "spine_04"]):
    add(nm, "pelvis" if i == 0 else "spine_%02d" % i, J[chain[i]], J[chain[i + 1]], FRONT, connect=True, coll="Trunk")
add("neck", "spine_04", J["C7_T1"], J["neck_top"], FRONT, connect=True, coll="Trunk")
for s, sx in (("L", 1), ("R", -1)):
    LAT = np.array([sx, 0, 0.0])
    sh, el, wr, kn = J["shoulder." + s], J["elbow." + s], J["wrist." + s], J["knuckles." + s]
    add("clavicle." + s, "spine_04", J["sternoclavicular." + s], J["acromioclavicular." + s], UP, coll="Arm." + s)
    add("scapula." + s, "clavicle." + s, J["acromioclavicular." + s], J["scapula_tip." + s], LAT, connect=True, coll="Arm." + s)
    add("upper_arm." + s, "scapula." + s, sh, el, FRONT, coll="Arm." + s)
    add("upper_arm_twist." + s, "scapula." + s, sh, sh + 0.5 * (el - sh), FRONT, coll="Arm." + s)
    # the elbow's bend in the sculpture includes its carrying angle, so the axis comes from the rule, not the bend
    add("forearm." + s, "upper_arm." + s, el, wr, FRONT, connect=True, coll="Arm." + s)
    add("forearm_twist." + s, "forearm." + s, el + 0.5 * (wr - el), wr, FRONT, coll="Arm." + s)
    fr = F["frame." + s]; Nh = np.array(fr["N"])
    add("hand." + s, "forearm." + s, wr, kn, Nh, connect=True, coll="Arm." + s)
    for fname in ("index", "middle", "ring", "pinky"):
        d = {k: np.array(v) for k, v in F["%s.%s" % (fname, s)].items() if k != "flex_axis"}
        pts = [d["mcp"], d["pip"], d["dip"], d["tip"]]
        # one hinge axis for the whole finger: normal of its curl plane, oriented so positive = toward the palm
        n_ = np.cross(unit(pts[1] - pts[0]), unit(pts[3] - pts[1]))
        if np.linalg.norm(n_) < 0.15: n_ = np.cross(unit(pts[1] - pts[0]), Nh)
        n_ = unit(n_)
        if np.dot(np.cross(n_, unit(pts[1] - pts[0])), Nh) < 0: n_ = -n_
        for j in range(3):
            add("%s_%02d.%s" % (fname, j + 1, s), "hand." + s if j == 0 else "%s_%02d.%s" % (fname, j, s), pts[j], pts[j + 1],
                ("axis", n_), connect=j > 0, coll="Fingers." + s)
    d = {k: np.array(v) for k, v in F["thumb." + s].items()}
    pts = [d["cmc"], d["mcp"], d["ip"], d["tip"]]
    Wd = np.array(fr["W"])
    for j in range(3):
        add("thumb_%02d.%s" % (j + 1, s), "hand." + s if j == 0 else "thumb_%02d.%s" % (j, s), pts[j], pts[j + 1], Wd, connect=j > 0, coll="Fingers." + s)
    hp, kn_, an, ba, tt = J["hip." + s], J["knee." + s], J["ankle." + s], J["ball." + s], J["toe_tip." + s]
    add("thigh." + s, "pelvis", hp, kn_, FRONT, coll="Leg." + s)
    add("shin." + s, "thigh." + s, kn_, an, hinge(kn_ - hp, an - kn_, BACK), connect=True, coll="Leg." + s)
    add("foot." + s, "shin." + s, an, ba, UP, connect=True, coll="Leg." + s)
    add("toe." + s, "foot." + s, ba, tt, DOWN, connect=True, coll="Leg." + s)

# ------------------------------------------------------------------ build
ad = bpy.data.armatures.new("ATLAS_Rig"); ao = bpy.data.objects.new("ATLAS_Rig", ad)
bpy.context.scene.collection.objects.link(ao)
ad.display_type = 'OCTAHEDRAL'; ao.show_in_front = True
bpy.context.view_layer.objects.active = ao; ao.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb = {}
def x_axis(b):
    Y = unit(b["tail"] - b["head"]); z = b["z"]
    if isinstance(z, tuple) and z[0] == "axis":
        X = z[1] - Y * (z[1] @ Y)
    elif isinstance(z, tuple) and z[0] == "hinge":
        X = z[1] - Y * (z[1] @ Y)
        # orient the bend axis so positive rotation moves the tail toward the rule's direction
        if np.cross(X, Y) @ z[2] < 0: X = -X
    else:
        Zd = z - Y * (z @ Y)
        X = np.cross(Y, Zd)
    return unit(X)
for b in B:
    e = ad.edit_bones.new(b["name"]); e.head = Vector(b["head"]); e.tail = Vector(b["tail"])
    X = x_axis(b); Y = unit(b["tail"] - b["head"]); Z = np.cross(X, Y)
    e.align_roll(Vector(Z))
    e.use_deform = b["deform"]; eb[b["name"]] = e
for b in B:
    if b["parent"]:
        eb[b["name"]].parent = eb[b["parent"]]
        eb[b["name"]].use_connect = b["connect"]
bpy.ops.object.mode_set(mode='OBJECT')
# collections
for b in B:
    cn = b["coll"]
    col = ad.collections.get(cn) or ad.collections.new(cn)
    col.assign(ad.bones[b["name"]])
# constraints on the twist bones
for s in ("L", "R"):
    pb = ao.pose.bones["upper_arm_twist." + s]
    c = pb.constraints.new('DAMPED_TRACK'); c.target = ao; c.subtarget = "upper_arm." + s; c.head_tail = 1.0
    pb = ao.pose.bones["forearm_twist." + s]
    c = pb.constraints.new('COPY_ROTATION'); c.target = ao; c.subtarget = "hand." + s
    c.use_x = False; c.use_y = True; c.use_z = False; c.mix_mode = 'REPLACE'
    c.target_space = 'LOCAL'; c.owner_space = 'LOCAL'; c.influence = 0.5
for pb in ao.pose.bones: pb.rotation_mode = 'QUATERNION'
ad["atlas"] = "ATLAS deform skeleton, built 2026-10-14 from measured joints (scratch rig study); not yet bound to Mesh_0"
bpy.ops.wm.save_as_mainfile(filepath=OUTF, check_existing=False, compress=True)
print("built %d bones (%d deform) -> %s" % (len(B), sum(b["deform"] for b in B), OUTF))
