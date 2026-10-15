"""Painted area per region in exporter GLBs (scratch export vs references).
  Blender -b --python scripts/glbarea.py -- name=path name=path ..."""
import bpy, sys, json, os, numpy as np
args = sys.argv[sys.argv.index("--") + 1:]
out = {}
for a in args:
    name, path = a.split("=", 1)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    areas = {}; tris = 0
    for o in bpy.data.objects:
        if o.type != 'MESH': continue
        me = o.data; me.calc_loop_triangles()
        co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3) @ np.array(o.matrix_world)[:3, :3].T
        lt = np.empty(len(me.loop_triangles) * 3, np.int64); me.loop_triangles.foreach_get("vertices", lt); lt = lt.reshape(-1, 3)
        mi = np.empty(len(me.loop_triangles), np.int64); me.loop_triangles.foreach_get("material_index", mi)
        ar = 0.5 * np.linalg.norm(np.cross(co[lt[:, 1]] - co[lt[:, 0]], co[lt[:, 2]] - co[lt[:, 0]]), axis=1) * 1e4
        for k, m in enumerate(me.materials):
            areas[m.name] = areas.get(m.name, 0) + float(ar[mi == k].sum())
        tris += len(lt)
    out[name] = dict(areas=areas, tris=tris)
names = list(out)
ref = out[names[0]]["areas"]
print("regions:", {n: len(out[n]["areas"]) for n in names}, "tris:", {n: out[n]["tris"] for n in names})
for n in names[1:]:
    d = {k: round(out[n]["areas"].get(k, 0) - ref.get(k, 0), 2) for k in set(ref) | set(out[n]["areas"])}
    big = {k: v for k, v in sorted(d.items(), key=lambda x: -abs(x[1])) if abs(v) >= 0.05}
    print("%s vs %s: max |area change| %.2f cm2; regions changed by >=0.05 cm2: %s" % (n, names[0], max(abs(v) for v in d.values()), dict(list(big.items())[:10])))
json.dump(out, open(os.path.join(os.path.dirname(__file__), "..", "out", "glb_areas.json"), "w"), indent=1)
