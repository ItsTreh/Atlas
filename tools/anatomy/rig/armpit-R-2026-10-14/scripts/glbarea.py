import bpy, sys, numpy as np, json
out = {}
for tag in ("original", "repaired"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath="/Users/tred/Documents/SD-Routine-scratch/armpit-R-2026-10-14/out/export_%s.glb" % tag)
    areas = {}
    for o in bpy.data.objects:
        if o.type != 'MESH': continue
        me = o.data
        co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3) @ np.array(o.matrix_world)[:3, :3].T
        for p in me.polygons:
            m = me.materials[p.material_index].name if me.materials else "?"
            v = [co[i] for i in p.vertices]
            ar = sum(0.5 * np.linalg.norm(np.cross(v[k] - v[0], v[k + 1] - v[0])) for k in range(1, len(v) - 1))
            areas[m] = areas.get(m, 0) + ar * 1e4
    out[tag] = areas
a, b = out["original"], out["repaired"]
print(sorted(a)[:8], len(a))
for k in ("latissimus-dorsi.R", "biceps-brachii.R", "triceps-brachii.R", "teres-major.R", "latissimus-dorsi.L"):
    print("%-22s original %8.1f cm2  repaired %8.1f cm2  change %+6.1f cm2 (%+.1f%%)" % (k, a.get(k, 0), b.get(k, 0), b.get(k, 0) - a.get(k, 0), 100 * (b.get(k, 0) - a.get(k, 0)) / max(a.get(k, 1), 1e-9)))
