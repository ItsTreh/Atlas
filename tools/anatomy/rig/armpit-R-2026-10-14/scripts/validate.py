"""Validate a scratch .blend against the original copy.
  Blender -b <scratch .blend> --python validate.py -- <tag>
Writes out/metrics_<tag>.json and prints a summary."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, bmesh, numpy as np
from collections import Counter
from mathutils.bvhtree import BVHTree
import common as C
C.guard()
tag = sys.argv[sys.argv.index("--") + 1]
OUT = os.path.join(C.SCRATCH, "out")
obj = bpy.data.objects["Mesh_0"]; arm = bpy.data.objects["Armature.001"]; me = obj.data
C.rest_pose(arm)
co, ev = C.mesh_arrays(me)
nv, nf = len(me.vertices), len(me.polygons)
res = {"tag": tag, "vertices": nv, "faces": nf}

# ---------------------------------------------------------------- integrity
bm = bmesh.new(); bm.from_mesh(me)
ef = Counter(len(e.link_faces) for e in bm.edges)
res["edge_face_counts"] = {str(k): v for k, v in ef.items()}
res["non_manifold_verts"] = sum(not v.is_manifold for v in bm.verts)
res["non_contiguous_edges"] = sum(1 for e in bm.edges if len(e.link_faces) == 2 and not e.is_contiguous)
res["degenerate_faces"] = sum(1 for f in bm.faces if f.calc_area() < 1e-12)
bm.verts.ensure_lookup_table()
# shells
par = np.arange(nv)
def find(x):
    while par[x] != x:
        par[x] = par[par[x]]; x = par[x]
    return x
for a_, b_ in ev:
    ra, rb = find(a_), find(b_)
    if ra != rb: par[ra] = rb
res["shells"] = len({find(i) for i in range(nv)})
# volume sign (closed mesh, outward normals => positive)
vol = 0.0
for f in bm.faces:
    p = [l.vert.co for l in f.loops]
    for k in range(1, len(p) - 1):
        vol += p[0].dot(p[k].cross(p[k + 1])) / 6
res["volume_m3"] = round(vol, 6)
bm.free()

# ------------------------------------------------- comparison to the original
names, pal, reg = C.palette(); px, w, h = C.paint_pixels()
freg = C.face_regions(me, px, w, h, names, pal, reg)
with bpy.data.libraries.load(os.path.join(C.SCRATCH, "reference", "Male_Body.blend"), link=False) as (src, dst):
    dst.meshes = ["Mesh_0"]
om = dst.meshes[0]
onv, onf = len(om.vertices), len(om.polygons)
oco = np.empty(onv * 3); om.vertices.foreach_get("co", oco); oco = oco.reshape(-1, 3)
def loops_of(mesh, nfaces, layer):
    ls = np.empty(len(mesh.polygons), np.int64); mesh.polygons.foreach_get("loop_start", ls)
    lt = np.empty(len(mesh.polygons), np.int64); mesh.polygons.foreach_get("loop_total", lt)
    n = ls[nfaces - 1] + lt[nfaces - 1]
    uv = np.empty(len(mesh.loops) * 2); mesh.uv_layers[layer].data.foreach_get("uv", uv)
    lv = np.empty(len(mesh.loops), np.int64); mesh.loops.foreach_get("vertex_index", lv)
    return uv.reshape(-1, 2)[:n], lv[:n]
uvn, lvn = loops_of(me, onf, "Paint"); uvo, lvo = loops_of(om, onf, "Paint")
res["orig_faces_paint_uv_identical"] = bool(np.array_equal(uvn, uvo))
res["orig_faces_paint_uv_max_diff"] = float(np.abs(uvn - uvo).max())
uvn2, _ = loops_of(me, onf, "UVMap"); uvo2, _ = loops_of(om, onf, "UVMap")
res["orig_faces_uvmap_identical"] = bool(np.array_equal(uvn2, uvo2))
res["orig_corner_positions_max_diff_m"] = float(np.abs(co[lvn] - oco[lvo]).max())
res["orig_vertex_index_positions_identical"] = bool(np.array_equal(co[:onv], oco))
mi = np.empty(nf, np.int64); me.polygons.foreach_get("material_index", mi)
omi = np.empty(onf, np.int64); om.polygons.foreach_get("material_index", omi)
res["orig_faces_material_identical"] = bool(np.array_equal(mi[:onf], omi))
ofreg = C.face_regions(om, px, w, h, names, pal, reg)
res["orig_faces_paint_region_identical"] = bool(np.array_equal(freg[:onf], ofreg))
res["new_faces_regions"] = dict(Counter(freg[onf:]).most_common())
# weights: left side identical?
W = C.weights(obj)
oW = {}
tmp = bpy.data.objects.new("orig_tmp", om); bpy.context.scene.collection.objects.link(tmp)
for g in obj.vertex_groups: tmp.vertex_groups.new(name=g.name)
# (vertex groups live on the object; read the original's from the original object instead)
with bpy.data.libraries.load(os.path.join(C.SCRATCH, "reference", "Male_Body.blend"), link=False) as (src, dst2):
    dst2.objects = ["Mesh_0"]
oobj = dst2.objects[0]
oW = C.weights(oobj)
left = oco[:, 0] > 0
diff_left = max(np.abs(W[k][:onv][left] - oW[k][left]).max() for k in oW)
res["left_side_weights_max_diff"] = float(diff_left)
res["left_side_positions_identical"] = bool(np.array_equal(co[:onv][left], oco[left]))
changed = np.zeros(onv, bool)
for k in oW: changed |= np.abs(W[k][:onv] - oW[k]) > 1e-6
res["old_vertices_weights_changed"] = int(changed.sum())
res["old_vertices_weights_changed_x_range"] = [float(oco[changed, 0].min()), float(oco[changed, 0].max())] if changed.any() else None
tot = sum(W.values()); infl = sum((x > 0).astype(int) for x in W.values())
res["new_vertices_max_influences"] = int(infl[onv:].max()) if nf > onf else None
res["new_vertices_weight_sum_range"] = [float(tot[onv:].min()), float(tot[onv:].max())] if nf > onf else None

# --------------------------------------------------------------- deformation
tri = []
for p in me.polygons:
    vs = p.vertices
    for k in range(1, len(vs) - 1):
        tri.append((vs[0], vs[k], vs[k + 1], p.index))
tri = np.array(tri)
def tri_area(P): return 0.5 * np.linalg.norm(np.cross(P[tri[:, 1]] - P[tri[:, 0]], P[tri[:, 2]] - P[tri[:, 0]]), axis=1)
A0 = tri_area(co)
fcen = co[tri[:, :3]].mean(1)
right = fcen[:, 0] < -0.10
fr = freg[tri[:, 3]]
painted = np.array([r not in ("body", "blend") for r in fr])
pocket = tri[:, 3] >= onf
zone_f = np.flatnonzero((fcen[:, 0] < -0.12) & (fcen[:, 2] > 0.40) & (fcen[:, 2] < 0.85))
polys_zone = [tuple(tri[i, :3]) for i in zone_f]

def self_hits(P):
    # vertices at the same position (the two copies of the cut while they
    # still touch) count as shared, so touching faces are not reported
    _, canon = np.unique(np.round(P / 1e-6).astype(np.int64), axis=0, return_inverse=True)
    canon = canon.ravel()
    t = BVHTree.FromPolygons([tuple(p) for p in P], polys_zone, all_triangles=True)
    hits = 0; faces = set()
    for i, j in t.overlap(t):
        if i < j and not set(canon[list(polys_zone[i])]) & set(canon[list(polys_zone[j])]):
            hits += 1; faces.add(i); faces.add(j)
    return hits, faces

poses = {}
for deg in (0, 30, 60, 90):
    C.elevate(arm, deg)
    P = C.evaluated_co(obj)
    A = tri_area(P); r = A / np.maximum(A0, 1e-14)
    def stats(mask):
        rr = r[mask]
        return {"faces": int(mask.sum()), ">2x": int((rr > 2).sum()), ">4x": int((rr > 4).sum()), ">10x": int((rr > 10).sum()),
                "max": round(float(rr.max()), 1) if len(rr) else 0, "<0.25x": int((rr < 0.25).sum()),
                "growth_cm2": round(float(np.clip(A[mask] - A0[mask], 0, None).sum() * 1e4), 1),
                "area_cm2_of_>4x_rest": round(float(A0[mask][rr > 4].sum() * 1e4), 1),
                "area_cm2_of_>4x_posed": round(float(A[mask][rr > 4].sum() * 1e4), 1)}
    hits, hf = self_hits(P)
    hf = np.array(sorted(hf), int)
    poses[deg] = {"right_all": stats(right), "right_painted": stats(right & painted),
                  "right_unpainted_old": stats(right & ~painted & ~pocket), "pocket": stats(pocket),
                  "self_intersections_zone": hits,
                  "self_intersection_faces_pocket": int(pocket[zone_f[hf]].sum()) if len(hf) else 0}
    np.save(os.path.join(OUT, "ratio_%s_%d.npy" % (tag, deg)), r)
C.rest_pose(arm)
res["poses"] = poses
json.dump(res, open(os.path.join(OUT, "metrics_%s.json" % tag), "w"), indent=1, default=str)
print(json.dumps({k: v for k, v in res.items() if k != "poses"}, indent=1, default=str))
for deg, p in poses.items():
    print("%3d deg  self-int %4d (pocket faces %d)" % (deg, p["self_intersections_zone"], p["self_intersection_faces_pocket"]))
    for k in ("right_all", "right_painted", "right_unpainted_old", "pocket"):
        s = p[k]
        print("    %-20s >2x %5d >4x %5d >10x %5d max %7.1f  <0.25x %4d  growth %7.1f cm2  >4x area %6.1f -> %7.1f" % (
            k, s[">2x"], s[">4x"], s[">10x"], s["max"], s["<0.25x"], s["growth_cm2"], s["area_cm2_of_>4x_rest"], s["area_cm2_of_>4x_posed"]))
