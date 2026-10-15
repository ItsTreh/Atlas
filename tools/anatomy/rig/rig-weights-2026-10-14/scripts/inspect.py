"""Read-only inspection of the inputs. Blender -b --factory-startup --python inspect.py"""
import bpy, json, os, numpy as np
W = os.path.expanduser("~/Documents/SD-Routine-scratch/rig-weights-2026-10-14")
RIGS = os.path.expanduser("~/Documents/SD-Routine-scratch/rig-2026-10-14")
def load(path):
    bpy.ops.wm.open_mainfile(filepath=path, load_ui=False)
def mco(me):
    a = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", a); return a.reshape(-1, 3)
out = {}
for f in ("Male_Body_repaired.blend", "Male_Body_repaired_keys_v5.blend", "Male_Body_rig_calibrated.blend", "Male_Body_unmodified.blend"):
    load(os.path.join(W, "original", f))
    d = {}
    for o in bpy.data.objects:
        e = {"type": o.type, "parent": o.parent.name if o.parent else None, "hidden": o.hide_viewport or o.hide_get(),
             "mw_identity": bool(np.allclose(np.array(o.matrix_world), np.eye(4)))}
        if o.type == 'MESH':
            me = o.data
            e.update(v=len(me.vertices), f=len(me.polygons), groups=len(o.vertex_groups),
                     mods=[(m.type, getattr(m, "object", None) and m.object.name) for m in o.modifiers],
                     keys=[k.name for k in me.shape_keys.key_blocks] if me.shape_keys else [],
                     uvs=[u.name for u in me.uv_layers], mats=len(me.materials), co_sum=float(mco(me).sum()))
            np.save(os.path.join(W, "out", "co_" + f.replace(".blend", ".npy")), mco(me))
        if o.type == 'ARMATURE':
            e["bones"] = len(o.data.bones); e["deform"] = sum(b.use_deform for b in o.data.bones)
        d[o.name] = e
    out[f] = d
    if f == "Male_Body_rig_calibrated.blend":
        rig = bpy.data.objects["ATLAS_Rig"]
        bones = {b.name: dict(head=list(rig.matrix_world @ b.head_local), tail=list(rig.matrix_world @ b.tail_local),
                              parent=b.parent.name if b.parent else None, connect=b.use_connect, deform=b.use_deform,
                              z=list(b.matrix_local.to_3x3().col[2]), x=list(b.matrix_local.to_3x3().col[0]))
                 for b in rig.data.bones}
        cons = {pb.name: [(c.type, c.subtarget, round(c.influence, 3)) for c in pb.constraints] for pb in rig.pose.bones if pb.constraints}
        posed = {pb.name: [round(x, 5) for x in pb.matrix_basis.to_quaternion()] + [round(x, 5) for x in pb.location]
                 for pb in rig.pose.bones if not np.allclose(np.array(pb.matrix_basis), np.eye(4), atol=1e-6)}
        json.dump(dict(bones=bones, constraints=cons, posed=posed, mode=rig.mode), open(os.path.join(W, "out", "calibrated_rig.json"), "w"), indent=1)
print(json.dumps(out, indent=1, default=str))
