"""Preservation of the approved baseline in a result file.
  Blender -b result/<file>.blend --python scripts/preserve.py -- <tag>
Against original/Male_Body_rigged.blend (the approved baseline):
  - every existing face: same corner count, corner positions, Paint and UVMap UVs, material, painted region
  - every existing vertex: position; vertex groups: identical on the right (x < 0) and outside the changed set
  - the rig: same bones, heads, tails, rolls, parents, deform flags, constraints
  - the right side: no vertex, face, UV or weight differs anywhere at x < 0
  - mesh integrity: closed manifold, one shell, consistent winding, no degenerate faces"""
import sys, os, json, re
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, bmesh, numpy as np
import common as C
tag = sys.argv[sys.argv.index("--") + 1]
obj = bpy.data.objects["Mesh_0"]; me = obj.data; ao = bpy.data.objects["ATLAS_Rig"]
with bpy.data.libraries.load(os.path.join(C.SCRATCH, "original", "Male_Body_rigged.blend"), link=False) as (s_, d_):
    d_.objects = ["Mesh_0", "ATLAS_Rig"]
ob0 = [o for o in d_.objects if o.type == 'MESH'][0]; ar0 = [o for o in d_.objects if o.type == 'ARMATURE'][0]; m0 = ob0.data
NV, NF = len(m0.vertices), len(m0.polygons)
ls, lt, lv = C.faces(me); ls0, lt0, lv0 = C.faces(m0)
co, co0 = C.mesh_co(me), C.mesh_co(m0)
def uv(m, n):
    a = np.empty(len(m.loops) * 2); m.uv_layers[n].data.foreach_get("uv", a); return a.reshape(-1, 2)
L0 = len(m0.loops)
r = {}
r["existing_faces_same_corner_counts"] = bool(np.array_equal(lt[:NF], lt0))
r["existing_faces_same_loop_starts"] = bool(np.array_equal(ls[:NF], ls0))
r["existing_corner_positions_identical"] = bool(np.array_equal(co[lv[:L0]], co0[lv0]))
r["existing_corner_vertex_index_changed"] = int((lv[:L0] != lv0).sum())
r["paint_uv_identical"] = bool(np.array_equal(uv(me, "Paint")[:L0], uv(m0, "Paint")))
r["uvmap_identical"] = bool(np.array_equal(uv(me, "UVMap")[:L0], uv(m0, "UVMap")))
mi = np.array([p.material_index for p in me.polygons]); mi0 = np.array([p.material_index for p in m0.polygons])
r["materials_identical"] = [re.sub(r"\.\d{3}$", "", m.name) for m in me.materials] == [re.sub(r"\.\d{3}$", "", m.name) for m in m0.materials] and bool(np.array_equal(mi[:NF], mi0))
fr, fr0 = C.face_regions(me), C.face_regions(m0)
r["painted_region_per_existing_face_identical"] = bool(np.array_equal(fr[:NF], fr0))
r["regions_on_existing_faces"] = int(len(set(fr0) - {"blend"}))
r["new_faces_regions"] = sorted(set(fr[NF:]))
r["existing_vertex_positions_identical"] = bool(np.array_equal(co[:NV], co0))
W, gn = C.weights(obj); W0, gn0 = C.weights(ob0)
assert gn == gn0, "vertex group list changed"
dW = np.abs(W[:NV] - W0).max(1)
right = co0[:, 0] < 0
r["weights_right_side_identical"] = bool((dW[right] == 0).all())
r["weights_changed_vertices"] = int((dW > 0).sum()); r["weights_changed_x_min"] = round(float(co0[dW > 0, 0].min()), 4)
r["weights_max_influences"] = int((W > 0).sum(1).max()); r["weights_sum_err_max"] = float(np.abs(W.sum(1) - 1).max())
r["weights_sum_err_max_baseline"] = float(np.abs(W0.sum(1) - 1).max())
r["vertices_without_weights"] = int((W.sum(1) == 0).sum())
# right side: faces whose corners are all at x<0 are identical in every respect above; and no new face reaches x<0
fc = np.add.reduceat(co[lv], ls, axis=0) / lt[:, None]
r["new_faces_min_x"] = round(float(fc[NF:, 0].min()), 4)
# rig
def rig(a):
    return {b.name: (np.round(np.array(b.head_local), 7).tolist(), np.round(np.array(b.tail_local), 7).tolist(), np.round(np.array(b.matrix_local), 7).tolist(),
                     b.parent.name if b.parent else None, b.use_deform) for b in a.data.bones}
r["rig_identical"] = rig(ao) == rig(ar0) and np.allclose(np.array(ao.matrix_world), np.array(ar0.matrix_world))
r["constraints_identical"] = {p.name: [c.type for c in p.constraints] for p in ao.pose.bones} == {p.name: [c.type for c in p.constraints] for p in ar0.pose.bones}
r["bones"] = len(ao.data.bones)
r["modifiers"] = [(m.type, getattr(m, "object", None) and m.object.name) for m in obj.modifiers]
r["shape_keys"] = bool(me.shape_keys)
r["colour_attributes"] = [a.name for a in me.color_attributes]; r["colour_attributes_baseline"] = [a.name for a in m0.color_attributes]
# integrity
bm = bmesh.new(); bm.from_mesh(me)
r["non_manifold_edges"] = sum(1 for e in bm.edges if len(e.link_faces) != 2)
r["boundary_edges"] = sum(1 for e in bm.edges if e.is_boundary)
r["inconsistent_winding_edges"] = sum(1 for e in bm.edges if len(e.link_faces) == 2 and e.link_loops[0].vert == e.link_loops[1].vert)
r["degenerate_faces"] = sum(1 for f in bm.faces if f.calc_area() < 1e-12)
r["loose_vertices"] = sum(1 for v in bm.verts if not v.link_faces)
seen = set(); shells = 0
for v in bm.verts:
    if v.index in seen: continue
    shells += 1; st = [v]; seen.add(v.index)
    while st:
        u = st.pop()
        for e in u.link_edges:
            o = e.other_vert(u)
            if o.index not in seen: seen.add(o.index); st.append(o)
r["shells"] = shells
r["counts"] = dict(vertices=len(me.vertices), faces=len(me.polygons), baseline_vertices=NV, baseline_faces=NF)
bm.free()
for k, v in r.items(): print("%-45s %s" % (k, v))
json.dump(r, open(os.path.join(C.SCRATCH, "out", "preserve_%s.json" % tag), "w"), indent=1, default=str)
