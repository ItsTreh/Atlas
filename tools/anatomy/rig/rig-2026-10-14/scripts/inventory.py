"""Read-only inventory of Male_Body's rig and weights (scratch copy).
  Blender -b original/Male_Body.blend --python scripts/inventory.py
Writes out/inventory.json and prints a summary. Saves nothing."""
import sys, os, json
import bpy, numpy as np
SCRATCH = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
assert os.path.abspath(bpy.data.filepath).startswith(SCRATCH), "scratch copies only"
out = {}
print("objects:", [(o.name, o.type, o.parent.name if o.parent else None) for o in bpy.data.objects])
arm = bpy.data.objects["Armature.001"]; obj = bpy.data.objects["Mesh_0"]; me = obj.data
mw = arm.matrix_world
out["armature_object"] = {"location": list(arm.location), "rotation_euler": list(arm.rotation_euler), "scale": list(arm.scale),
                          "matrix_world": [list(r) for r in mw], "data": arm.data.name, "display": arm.data.display_type,
                          "pose_position": arm.data.pose_position}
out["mesh_object"] = {"matrix_world": [list(r) for r in obj.matrix_world], "parent": obj.parent.name if obj.parent else None,
                      "parent_type": obj.parent_type, "modifiers": [(m.name, m.type, getattr(m, "object", None) and m.object.name,
                      getattr(m, "use_deform_preserve_volume", None), getattr(m, "use_vertex_groups", None), getattr(m, "use_bone_envelopes", None)) for m in obj.modifiers]}
co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
Mo = np.array(obj.matrix_world); cw = co @ Mo[:3, :3].T + Mo[:3, 3]
out["mesh_bbox_world"] = [list(cw.min(0)), list(cw.max(0))]
print("mesh bbox world", np.round(cw.min(0), 3), np.round(cw.max(0), 3), "height %.3f m" % (cw[:, 2].max() - cw[:, 2].min()))
bones = []
for b in arm.data.bones:
    pb = arm.pose.bones[b.name]
    h = mw @ b.head_local; t = mw @ b.tail_local
    bones.append({"name": b.name, "parent": b.parent.name if b.parent else None, "connect": b.use_connect, "deform": b.use_deform,
                  "head": [round(x, 4) for x in h], "tail": [round(x, 4) for x in t], "length_m": round((t - h).length, 4),
                  "inherit_rotation": b.use_inherit_rotation, "constraints": [c.type for c in pb.constraints],
                  "rotation_mode": pb.rotation_mode, "lock_rot": list(pb.lock_rotation), "children": [c.name for c in b.children]})
out["bones"] = bones
def tree(name, d=0):
    b = next(x for x in bones if x["name"] == name)
    print("  " * d + "%s  head %s  tail %s  len %.3f%s%s" % (name, b["head"], b["tail"], b["length_m"], "" if b["deform"] else "  NON-DEFORM",
          ("  constraints " + ",".join(b["constraints"])) if b["constraints"] else ""))
    for c in b["children"]: tree(c, d + 1)
for r in [b["name"] for b in bones if b["parent"] is None]: tree(r)
# vertex groups
G = {g.index: g.name for g in obj.vertex_groups}
nv = len(me.vertices)
W = np.zeros((nv, len(G)))
for v in me.vertices:
    for g in v.groups:
        W[v.index, g.group] = g.weight
groups = []
for gi, gn in G.items():
    w = W[:, gi]; m = w > 1e-4
    groups.append({"name": gn, "has_bone": gn in arm.data.bones, "verts": int(m.sum()), "verts_full": int((w > 0.99).sum()),
                   "centroid": [round(x, 3) for x in (cw[m].T @ w[m] / w[m].sum())] if m.any() else None,
                   "bbox": [[round(x, 3) for x in cw[m].min(0)], [round(x, 3) for x in cw[m].max(0)]] if m.any() else None})
out["groups"] = groups
tot = W.sum(1); infl = (W > 1e-4).sum(1)
deform_names = {b["name"] for b in bones if b["deform"]}
Wd = W[:, [gi for gi, gn in G.items() if gn in deform_names]]
out["weights"] = {"vertices": nv, "unweighted": int((tot <= 1e-6).sum()), "sum_lt_0.99": int(((tot > 1e-6) & (tot < 0.99)).sum()),
                  "sum_gt_1.01": int((tot > 1.01).sum()), "influences_hist": {str(k): int((infl == k).sum()) for k in range(0, infl.max() + 1)},
                  "max_influences": int(infl.max()), "groups_without_bone": [g["name"] for g in groups if not g["has_bone"]],
                  "bones_without_group": [b["name"] for b in bones if b["name"] not in G.values()],
                  "deform_weight_unweighted": int((Wd.sum(1) <= 1e-6).sum())}
if out["weights"]["unweighted"]:
    u = tot <= 1e-6
    out["weights"]["unweighted_bbox"] = [list(np.round(cw[u].min(0), 3)), list(np.round(cw[u].max(0), 3))]
print(json.dumps(out["weights"], indent=1))
print("groups:")
for g in groups:
    print("  %-10s bone %-5s verts %6d (=1: %6d) centroid %s bbox %s" % (g["name"], g["has_bone"], g["verts"], g["verts_full"], g["centroid"], g["bbox"]))
print(json.dumps(out["armature_object"], indent=None))
print(json.dumps(out["mesh_object"], indent=None, default=str))
# does the mesh's own data have shape keys / other relevant data
print("shape keys:", me.shape_keys and [k.name for k in me.shape_keys.key_blocks], "| actions:", [a.name for a in bpy.data.actions])
json.dump(out, open(os.path.join(SCRATCH, "out", "inventory.json"), "w"), indent=1, default=str)
