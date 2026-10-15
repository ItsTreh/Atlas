import bpy
me = bpy.data.objects["Mesh_0"].data
ad = me.shape_keys.animation_data
for fc in ad.drivers:
    d = fc.driver
    print(fc.data_path, d.type, repr(d.expression), [(v.name, v.type, [(t.id.name if t.id else None, t.data_path, t.bone_target, t.transform_type, t.rotation_mode, t.transform_space) for t in v.targets]) for v in d.variables])
