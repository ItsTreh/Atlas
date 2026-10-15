import bpy, json, os, numpy as np
W = os.path.expanduser("~/Documents/SD-Routine-scratch/rig-weights-2026-10-14")
for f in ("Male_Body_repaired_keys_v5.blend", "Male_Body_rig_calibrated.blend", "Male_Body_unmodified.blend", "Male_Body_repaired.blend"):
    bpy.ops.wm.open_mainfile(filepath=os.path.join(W, "original", f), load_ui=False)
    print("==", f)
    for o in bpy.data.objects:
        print("  ", o.name, o.type, "loc", tuple(round(x, 4) for x in o.location), "rot", tuple(round(x, 4) for x in o.rotation_euler), "scale", tuple(round(x, 4) for x in o.scale),
              "mpi_ident", np.allclose(np.array(o.matrix_parent_inverse), np.eye(4)))
        if o.type == 'ARMATURE':
            posed = [pb.name for pb in o.pose.bones if not np.allclose(np.array(pb.matrix_basis), np.eye(4), atol=1e-6)]
            print("     posed bones:", posed[:20], "pose_position", o.data.pose_position)
        if o.type == 'MESH':
            for m in o.modifiers: print("     mod", m.name, m.type, getattr(m, "object", None), m.show_viewport, m.show_render)
            G = [g.name for g in o.vertex_groups]; print("     groups", len(G), G[:3], "...", G[-60:] if len(G) > 40 else "")
            if f.startswith("Male_Body_rig"):
                me = o.data; nv = len(me.vertices)
                cnt = {}
                for v in me.vertices:
                    for g in v.groups:
                        if g.weight > 0: cnt[g.group] = cnt.get(g.group, 0) + 1
                print("     nonzero groups:", {G[k]: c for k, c in sorted(cnt.items())})
            me = o.data
            if me.shape_keys:
                for k in me.shape_keys.key_blocks: print("     key", k.name, round(k.value, 3), k.mute)
    for t in bpy.data.texts: print("   text:", t.name)
