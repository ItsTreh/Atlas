"""
Blender side of the first pass (PROVENANCE, see atelier.py): turns an
assembled cage into the editable object saved in
assets/anatomy/torso-study.blend.

  • one mesh object, "torso-study": the LEFT half of the cage, quads with a
    few triangles, smooth shaded, one material slot per anatomical region
    (the material's name is the region id), subdivision creases on the
    grooves, ridges and cut rims;
  • a Mirror modifier (x, clipped and merged at the midline) and a
    Subdivision Surface modifier (Catmull-Clark, level 2, limit surface);
  • landmark empties named "landmark:<id>" with `region` and `type`
    custom properties;
  • optional shape keys named "state:<id>" (authored sculptural states on
    the same topology).

Blender works in metres, z up, the figure facing -y. ATLAS works in cm, y up,
the figure facing +z. to_blender() / to_atlas() convert.
"""

import bpy
import numpy as np


def to_blender(p):
    p = np.asarray(p, float)
    return np.stack([p[..., 0], -p[..., 2], p[..., 1]], axis=-1) / 100.0


def to_atlas(b):
    b = np.asarray(b, float) * 100.0
    return np.stack([b[..., 0], b[..., 2], -b[..., 1]], axis=-1)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.length_unit = 'CENTIMETERS'


def region_material(name, color):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)       # viewport colour only: the app has its own shading
    mat.roughness = 1.0
    mat.metallic = 0.0
    return mat


def build_object(cage, regions, colors, name="torso-study", front_region="pectoralis-major"):
    """The cage as a Blender object. `regions` orders the material slots."""
    verts = to_blender(np.array(cage.pos))
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in cage.faces])
    me.update()
    orient_outward(me, [i for i, r in enumerate(cage.face_region) if r == front_region])
    index = {r: i for i, r in enumerate(regions)}
    for r in regions:
        me.materials.append(region_material(r, colors.get(r, (0.7, 0.7, 0.7))))
    me.polygons.foreach_set("material_index", [index[r] for r in cage.face_region])
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    attr = me.attributes.get("crease_edge") or me.attributes.new("crease_edge", 'FLOAT', 'EDGE')
    values = []
    for e in me.edges:
        a, b = e.vertices
        values.append(cage.crease.get((min(a, b), max(a, b)), 0.0))
    attr.data.foreach_set("value", values)
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    m = obj.modifiers.new("Mirror", 'MIRROR')
    m.use_axis = (True, False, False)
    m.use_clip = True
    m.use_mirror_merge = True
    m.merge_threshold = 1e-5
    s = obj.modifiers.new("Subdivision", 'SUBSURF')
    s.levels = 2
    s.render_levels = 2
    s.use_limit_surface = True
    s.use_creases = True
    s.boundary_smooth = 'ALL'
    return obj


def orient_outward(me, front_faces):
    """Consistent face winding, outward: the front of the chest faces -y."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.faces.ensure_lookup_table()
    ny = sum(bm.faces[i].normal.y for i in front_faces)
    if ny > 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.update()


def cage_coords(obj):
    me = obj.data
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    return co.reshape(-1, 3)


def set_cage_coords(obj, co):
    me = obj.data
    me.vertices.foreach_set("co", np.asarray(co, float).ravel())
    me.update()


def limit_positions(obj):
    """Where each cage vertex lands on the subdivided limit surface (the
    evaluated mesh lists the cage's own vertices first)."""
    n = len(obj.data.vertices)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    em = ev.to_mesh()
    co = np.empty(len(em.vertices) * 3)
    em.vertices.foreach_get("co", co)
    ev.to_mesh_clear()
    return co.reshape(-1, 3)[:n]


def fit_to_limit(obj, targets, midline, iterations=8, rate=1.0):
    """Moves the cage until its limit surface passes through `targets`
    (Blender coordinates, one per cage vertex). Midline vertices stay on the
    mirror plane."""
    mid = np.array(sorted(midline), int)
    co = np.array(targets, float)
    set_cage_coords(obj, co)
    for it in range(iterations):
        lim = limit_positions(obj)
        err = targets - lim
        co = co + rate * err
        if len(mid):
            co[mid, 0] = 0.0
        set_cage_coords(obj, co)
    lim = limit_positions(obj)
    d = np.linalg.norm(targets - lim, axis=1) * 100.0
    return float(d.max()), float(np.percentile(d, 95))


def add_landmark(ident, position_atlas, region, kind):
    e = bpy.data.objects.new("landmark:" + ident, None)
    e.empty_display_type = 'SPHERE'
    e.empty_display_size = 0.006
    e.location = tuple(to_blender(position_atlas))
    e["region"] = region
    e["type"] = kind
    bpy.context.scene.collection.objects.link(e)
    return e


def add_shape_key(obj, name, coords_blender):
    if obj.data.shape_keys is None:
        obj.shape_key_add(name="Basis", from_mix=False)
    k = obj.shape_key_add(name=name, from_mix=False)
    k.data.foreach_set("co", np.asarray(coords_blender, float).ravel())
    k.value = 0.0
    return k


def evaluated_surface(obj):
    """The subdivided surface (ATLAS cm): vertices and triangles."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    em = ev.to_mesh()
    em.calc_loop_triangles()
    co = np.empty(len(em.vertices) * 3)
    em.vertices.foreach_get("co", co)
    tri = np.empty(len(em.loop_triangles) * 3, dtype=np.int64)
    em.loop_triangles.foreach_get("vertices", tri)
    ev.to_mesh_clear()
    return to_atlas(co.reshape(-1, 3)), tri.reshape(-1, 3)


def inverted_triangles(V, T):
    """Triangles of the subdivided surface that face against their
    neighbourhood's normal: a fold. A sound sculpture has none."""
    a, b, c = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    fn = np.cross(b - a, c - a)
    vn = np.zeros_like(V)
    for k in range(3):
        np.add.at(vn, T[:, k], fn)
    avg = vn[T[:, 0]] + vn[T[:, 1]] + vn[T[:, 2]]
    return int(np.sum(np.einsum("ij,ij->i", fn, avg) < 0))


def closest_on_surface(points, V, T):
    """For each point, the closest point on a triangle mesh (brute force,
    fine for a handful of landmarks)."""
    out = []
    A, B, C = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    for p in np.atleast_2d(points):
        q = _closest_points(p, A, B, C)
        d = np.linalg.norm(q - p, axis=1)
        out.append(q[np.argmin(d)])
    return np.array(out)


def _closest_points(p, a, b, c):
    """Closest point on each triangle (a, b, c arrays) to p (Ericson)."""
    ab, ac, ap = b - a, c - a, p - a
    d1, d2 = np.einsum('ij,ij->i', ab, ap), np.einsum('ij,ij->i', ac, ap)
    bp = p - b
    d3, d4 = np.einsum('ij,ij->i', ab, bp), np.einsum('ij,ij->i', ac, bp)
    cp = p - c
    d5, d6 = np.einsum('ij,ij->i', ab, cp), np.einsum('ij,ij->i', ac, cp)
    va = d3 * d6 - d5 * d4
    vb = d5 * d2 - d1 * d6
    vc = d1 * d4 - d3 * d2
    denom = va + vb + vc
    denom = np.where(np.abs(denom) < 1e-18, 1e-18, denom)
    v = vb / denom
    w = vc / denom
    res = a + ab * v[:, None] + ac * w[:, None]
    # vertex and edge regions
    m = (d1 <= 0) & (d2 <= 0); res[m] = a[m]
    m = (d3 >= 0) & (d4 <= d3); res[m] = b[m]
    m = (d6 >= 0) & (d5 <= d6); res[m] = c[m]
    m = (vc <= 0) & (d1 >= 0) & (d3 <= 0)
    t = d1 / np.where(np.abs(d1 - d3) < 1e-18, 1e-18, d1 - d3)
    res[m] = (a + ab * t[:, None])[m]
    m = (vb <= 0) & (d2 >= 0) & (d6 <= 0)
    t = d2 / np.where(np.abs(d2 - d6) < 1e-18, 1e-18, d2 - d6)
    res[m] = (a + ac * t[:, None])[m]
    m = (va <= 0) & ((d4 - d3) >= 0) & ((d5 - d6) >= 0)
    t = (d4 - d3) / np.where(np.abs((d4 - d3) + (d5 - d6)) < 1e-18, 1e-18, (d4 - d3) + (d5 - d6))
    res[m] = (b + (c - b) * t[:, None])[m]
    return res
