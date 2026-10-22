"""
Exports the Male_Body sculpture for ATLAS: assets/anatomy/Male_Body.blend ->
assets/anatomy/male-body.glb, the input of `npm run build:anatomy-authored
assets/anatomy/male-body.manifest.json` (-> js/anatomy-model-male-body.js).

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python tools/anatomy/authored/male_body.py [-- <out.glb>]

Male_Body.blend is only read: its mesh is appended into an empty scene and
nothing is saved back. ATLAS_MALE_BODY_SOURCE reads another .blend (the
rigged one); its paint image must sit beside it.

Every region is painted by hand in Texture Paint, one colour per region, into
Male_Body.paint.png on the UV map "Paint"; Male_Body.paint.json names the
colours (several may name one region). A pixel within PAINT_MATCH of a listed
colour or white is that colour; any other pixel (the soft edge of a stroke, a
blend of two colours) takes the region of the nearest pixel that is one, so
it stays with the area beside it rather than naming a third region whose
colour it resembles. Each vertex takes the region under it, each edge between
two regions is cut where the image changes along it, and each face takes the
region at its centre (image_cut), so a border runs where the brush went
however large or thin the faces. Small islands are absorbed. Faces no paint
names are "body".

  1. align   the figure faces -y in Blender, as the glTF export expects;
             scaled so floor-to-neck-cut matches the procedural figure
             (157.5 cm), centred on the midline, its chest centred front
             to back
  2. regions the painted regions, cut along their borders; the rest body
  3. export  one glTF primitive per region

Full resolution by default. ATLAS_TARGET_TRIANGLES decimates first.
"""

import json
import os
import sys
from collections import Counter

import bmesh
import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SOURCE = os.environ.get("ATLAS_MALE_BODY_SOURCE", os.path.join(ROOT, "assets", "anatomy", "Male_Body.blend"))
OBJECT = "male-body"
TARGET = int(os.environ.get("ATLAS_TARGET_TRIANGLES", "0"))     # 0: keep every triangle
NECK_CUT = 157.5            # the procedural figure's neck cut, cm
STONE = "atlas-stone"       # the sculpture's own material, exported as body
BODY = "body"
PAINT = os.path.join(ROOT, "assets", "anatomy", "Male_Body.paint.json")
# The paint: the image beside the .blend, laid on the sculpture by the UV map
# "Paint". PAINT_ISLAND: a painted island smaller than this (faces) is absorbed.
PAINT_IMAGE = os.path.splitext(SOURCE)[0] + ".paint.png"
PAINT_UV, PAINT_ISLAND = "Paint", 30
# The image is read as it is, not blurred: each read takes the commonest
# region within this distance (m), enough to clean up a stray pixel without
# moving a border.
PAINT_CLEAN = 0.001
# A pixel within PAINT_MATCH (0-255 RGB, Euclidean) of a listed colour or white
# is that colour; one further from all of them is a blend (a soft brush edge)
# and takes the region of the nearest pixel that is not, within PAINT_FILL
# pixels (unpainted beyond). Shades of one region's colour, a touch-up, must
# then be keyed, which the key allows.
PAINT_MATCH, PAINT_FILL = 6.0, 32


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


def face_neighbours(me):
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    nbrs = [[g.index for e in f.edges for g in e.link_faces if g.index != f.index] for f in bm.faces]
    bm.free()
    return nbrs


def islands(labels, nbrs):
    """Connected groups of faces with one label: lists of face indices."""
    seen = np.zeros(len(labels), bool)
    for i in range(len(labels)):
        if seen[i]:
            continue
        comp, stack = [], [i]; seen[i] = True
        while stack:
            f = stack.pop(); comp.append(f)
            for j in nbrs[f]:
                if not seen[j] and labels[j] == labels[i]:
                    seen[j] = True; stack.append(j)
        yield comp


def absorb_islands(labels, nbrs, min_island):
    """Each group of fewer than min_island faces takes the commonest label around it."""
    for comp in islands(labels, nbrs):
        if len(comp) < min_island:
            ring = Counter(labels[j] for f in comp for j in nbrs[f] if labels[j] != labels[comp[0]])
            if ring:
                labels[comp] = ring.most_common(1)[0][0]
    return labels


def fill_blends(lab, w, h):
    """Pixel regions (bottom row first, -1 for a blend) -> each blend given the
    region of the nearest pixel that is not one, grown a pixel at a time
    (PAINT_FILL at most; 0, unpainted, beyond)."""
    lab = lab.reshape(h, w).copy()
    for _ in range(PAINT_FILL):
        blend = lab < 0
        if not blend.any():
            break
        grown = lab.copy()
        for src, dst in (((slice(1, None), slice(None)), (slice(None, -1), slice(None))),
                         ((slice(None, -1), slice(None)), (slice(1, None), slice(None))),
                         ((slice(None), slice(1, None)), (slice(None), slice(None, -1))),
                         ((slice(None), slice(None, -1)), (slice(None), slice(1, None)))):
            take = blend[dst] & (lab[src] >= 0) & (grown[dst] < 0)
            grown[dst][take] = lab[src][take]
        lab = grown
    lab[lab < 0] = 0
    return lab.ravel()


def image_cut(me, palette, region, ids):
    """painted(): the regions read straight from the paint image (PAINT_IMAGE,
    laid on by the PAINT_UV map), each pixel snapped to the nearest listed
    colour or white within PAINT_MATCH. Each vertex takes the region under
    it; each edge whose two ends differ is cut where the image changes along
    it; each face, cut or not, takes the region at its centre. Every read is the commonest region within
    PAINT_CLEAN of the point, which cleans up a stray pixel. So a border runs
    where the brush went, however long or thin the faces it crosses, and the
    paint of one surface never reaches another across a crease."""
    img = bpy.data.images.load(PAINT_IMAGE)
    w, h = img.size
    px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    rgb = np.round(px.reshape(-1, 4)[:, :3] * 255).astype(np.int64)
    colours, inverse = np.unique((rgb[:, 0] << 16) | (rgb[:, 1] << 8) | rgb[:, 2], return_inverse=True)
    rgb = np.stack([colours >> 16, (colours >> 8) & 255, colours & 255], 1) / 255.0
    near = ((rgb[:, None, :] - palette[None]) ** 2).sum(-1)
    colour_region = np.where(near.min(1) <= (PAINT_MATCH / 255.0) ** 2, region[near.argmin(1)], -1)
    pixel = fill_blends(colour_region[inverse.ravel()], w, h)       # each pixel's region, bottom row first
    if not pixel.any():
        return None
    k = len(ids) + 1

    bm = bmesh.new(); bm.from_mesh(me)
    uvl = bm.loops.layers.uv[PAINT_UV]
    # The image's scale on the body (m a pixel), for PAINT_CLEAN in pixels.
    area = sum(f.calc_area() for f in bm.faces)
    uv_area = sum(abs(np.cross(np.subtract(f.loops[1][uvl].uv, f.loops[0][uvl].uv),
                               np.subtract(f.loops[2][uvl].uv, f.loops[0][uvl].uv))) / 2 for f in bm.faces)
    r = max(1, round(PAINT_CLEAN / (area / (uv_area * w * h)) ** 0.5))
    oy, ox = np.mgrid[-r:r + 1, -r:r + 1]
    disk = (ox ** 2 + oy ** 2) <= r * r
    ox, oy = ox[disk], oy[disk]

    def read(uv):
        """UV points (n x 2) -> the commonest region within r pixels of each."""
        uv = np.asarray(uv, float).reshape(-1, 2)
        out = np.empty(len(uv), np.int64)
        for s in range(0, len(uv), 20000):
            q = uv[s:s + 20000]
            x = np.clip((q[:, 0] * w).astype(np.int64)[:, None] + ox, 0, w - 1)
            y = np.clip((q[:, 1] * h).astype(np.int64)[:, None] + oy, 0, h - 1)
            lab = pixel[y * w + x]
            rows = np.arange(len(lab))[:, None] * k + lab
            out[s:s + 20000] = np.bincount(rows.ravel(), minlength=len(lab) * k).reshape(-1, k).argmax(1)
        return out

    bm.verts.ensure_lookup_table()
    vert = read([v.link_loops[0][uvl].uv[:] if v.link_loops else (0.0, 0.0) for v in bm.verts])
    at = {v: int(vert[v.index]) for v in bm.verts}
    # Each edge between two regions: read the image along it (in the UVs of
    # one face beside it) and cut it halfway between the last point of the
    # first end's region and the first point of the other's.
    crossing = [e for e in bm.edges if at[e.verts[0]] != at[e.verts[1]] and e.link_loops]
    n = 32
    t = (np.arange(n) + 0.5) / n
    ends = []
    for e in crossing:
        loop = e.link_loops[0]                                      # runs loop.vert -> the next loop's vert
        a, b = np.array(loop[uvl].uv[:]), np.array(loop.link_loop_next[uvl].uv[:])
        if loop.vert != e.verts[0]:
            a, b = b, a
        ends.append((a, b))
    ends = np.array(ends).reshape(-1, 2, 2)
    along = read(ends[:, 0, None, :] + t[None, :, None] * (ends[:, 1, None, :] - ends[:, 0, None, :])).reshape(-1, n)
    cuts = []
    for e, lab in zip(crossing, along):
        v0 = e.verts[0]
        la, lb = at[v0], at[e.verts[1]]
        off_a = np.flatnonzero(lab != la)
        on_b = np.flatnonzero(lab == lb)
        lo = t[off_a[0]] if len(off_a) else 1.0
        hi = t[on_b[0]] if len(on_b) else lo
        f = min(max(0.5 * (lo - 0.5 / n) + 0.5 * (hi - 0.5 / n), 0.05), 0.95)
        _, nvert = bmesh.utils.edge_split(e, v0, f)
        cuts.append(nvert)
    if cuts:
        bmesh.ops.connect_verts(bm, verts=cuts)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    labels = read([np.mean([l[uvl].uv[:] for l in f.loops], 0) for f in bm.faces])
    bm.to_mesh(me); bm.free(); me.update()
    return ids, labels


def painted(me):
    """The painted regions (see PAINT), the faces their borders cross cut
    along them: (region ids, each face's index into them + 1, 0 where
    unpainted), or None if nothing is painted."""
    for path in (PAINT, PAINT_IMAGE):
        if not os.path.exists(path):
            raise SystemExit("male_body: %s is missing" % path)
    if PAINT_UV not in me.uv_layers:
        raise SystemExit("male_body: the mesh has no UV map %r for the paint" % PAINT_UV)
    with open(PAINT, encoding="utf-8") as f:
        key = json.load(f)["colors"]
    ids = list(dict.fromkeys(key.values()))                         # several colours may name one region
    palette = np.array([[1.0, 1.0, 1.0]] + [[int(h[k:k + 2], 16) / 255.0 for k in (1, 3, 5)] for h in key])
    region = np.array([0] + [ids.index(r) + 1 for r in key.values()])
    return image_cut(me, palette, region, ids)


def align(me):
    """Step 1, in place: the figure scaled to the procedural one and centred.
    Returns the scale."""
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    z0 = co[:, 2].min()
    # Floor to the neck cut, as measured on the original generated figure; the
    # sculpture records it (atlas_floor_to_neck) because its break sits lower
    # than the old collar, which would otherwise rescale the figure.
    floor_to_neck = me.get("atlas_floor_to_neck")
    if floor_to_neck is None:
        floor_to_neck = co[co[:, 2] > co[:, 2].max() - 0.05, 2].mean() - z0   # the neck cut (ragged): its mean height
    s = NECK_CUT / 100.0 / floor_to_neck
    co[:, 2] -= z0
    co *= s
    co[:, 0] -= 0.5 * (co[:, 0].min() + co[:, 0].max())
    chest = co[np.abs(co[:, 2] - 1.32) < 0.02]
    chest = chest[np.abs(chest[:, 0]) < 0.1]
    co[:, 1] -= 0.5 * (chest[:, 1].min() + chest[:, 1].max())
    me.vertices.foreach_set("co", co.ravel()); me.update()
    return s


def export(path):
    """One glTF primitive per material, the object as evaluated."""
    obj = bpy.data.objects[OBJECT]
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    base = bpy.data.meshes.new_from_object(obj.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    out = bpy.data.objects.new(OBJECT + ".export", base)
    bpy.context.scene.collection.objects.link(out)
    base.polygons.foreach_set("use_smooth", [True] * len(base.polygons))
    for o in bpy.context.scene.objects:
        o.select_set(o is out)
    bpy.context.view_layer.objects.active = out
    opts = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=False,
                export_extras=True, export_morph=True, export_morph_normal=False, export_normals=True,
                export_texcoords=False, export_materials='EXPORT', export_yup=True,
                export_animations=False, export_vertex_color='NONE')
    props = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
    bpy.ops.export_scene.gltf(**{k: v for k, v in opts.items() if k in props})


def main(out_glb):
    reset_scene()
    with bpy.data.libraries.load(SOURCE, link=False) as (src, dst):
        dst.meshes = ["Mesh_0"] if "Mesh_0" in src.meshes else src.meshes[:1]
    me = dst.meshes[0]
    names = [m.name if m else None for m in me.materials]
    if not names or None in names:
        raise SystemExit("male_body: every material slot of Mesh_0 must hold a material (%r)" % names)
    obj = bpy.data.objects.new(OBJECT, me)
    bpy.context.scene.collection.objects.link(obj)

    # 1. Align (Blender coordinates throughout; ATLAS = (x, z, -y) * 100).
    s = align(me)

    source_faces = len(me.polygons)
    if TARGET and TARGET < source_faces:
        m = obj.modifiers.new("Decimate", 'DECIMATE'); m.decimate_type = 'COLLAPSE'
        m.ratio = TARGET / source_faces; m.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=m.name)
    paint = painted(me)                                             # cuts the faces its borders cross
    faces = len(me.polygons)

    # 2. Regions: exactly the paint; every other face is body. The .blend's
    # own materials (older authored regions) are kept as slots but ignored.
    labels = np.full(faces, BODY, dtype=object)
    if paint:
        ids, face_paint = paint
        face_paint = absorb_islands(face_paint, face_neighbours(me), PAINT_ISLAND)
        for i in np.flatnonzero(face_paint):
            labels[i] = ids[face_paint[i] - 1]
    for r in sorted(set(labels) - {m.name for m in me.materials} - {BODY}):
        me.materials.append(region_material(r, (0.7, 0.5, 0.46)))
    for mat in me.materials:
        if mat.name == STONE:
            mat.name = BODY
    slot = {m.name: i for i, m in enumerate(me.materials)}
    me.polygons.foreach_set("material_index", [slot[l] for l in labels])
    me.polygons.foreach_set("use_smooth", [True] * faces)
    me.update()

    # 3. Export.
    export(out_glb)
    counts = Counter(labels)
    return dict(source_triangles=source_faces, triangles=faces, vertices=len(me.vertices), scale=round(s, 4),
                regions={k: counts[k] for k in sorted(counts)})


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = args[0] if args else os.path.join(ROOT, "assets", "anatomy", "male-body.glb")
    info = main(out)
    print("male body:", json.dumps(info))
