"""
Imports the Male_Body sculpture for ATLAS: assets/anatomy/Male_Body.blend ->
assets/anatomy/male-body.glb, the input of `npm run build:anatomy-authored
assets/anatomy/male-body.manifest.json` (-> js/anatomy-model-male-body.js).

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python tools/anatomy/authored/male_body.py [-- <out.glb>]

Male_Body.blend is only read: its mesh is appended into an empty scene and
nothing is saved back. Its regions come from two sources, recorded per
region in the manifest:

  painted   painted by hand, one colour per region (Male_Body.paint.json
            names them; several colours may name one region): in Texture
            Paint, into Male_Body.paint.png on the UV map "Paint", once
            paint_setup.py has made them, in Vertex Paint before that. Each
            colour read snaps to the nearest listed colour, or to none if
            nearest to white. In the image, a pixel matching no listed colour
            nor white (the soft edge of a brush stroke, a blend of two colours)
            takes the region of the nearest pixel that does, so it stays with
            the area beside it rather than naming some third region whose
            colour the blend happens to resemble. From the image, each
            vertex takes the region under it and each edge between two
            regions is cut where the image changes along it, so a border runs
            where the brush went however large or thin the faces (image_cut).
            From Vertex Paint, each region's share of the corners is blurred
            by distance (about a centimetre) and the faces a border crosses
            are cut where two shares are equal. Small islands are absorbed. A
            painted region takes
            exactly its painted faces, replacing any material of that name
  authored  painted on the sculpture itself (male_body_regions.py): every
            face carries one material, whose name is its region's id
            ("pectoralis-major.L", "rectus-abdominis"...); faces still
            wearing the sculpture's own material, atlas-stone, are unclaimed,
            and so are those of a RETIRED region, whose muscles are painted
  borrowed  a stand-in for a muscle not authored yet: an unclaimed face takes
            the region of the nearest surface of the procedural figure
            (js/anatomy-model.js), cleaned up by a majority vote over
            neighbouring faces. Its borders do not follow this sculpture's
            forms; authoring the muscle replaces it (drop its manifest entries)

This script carries those out:

  1. align   the figure faces -y in Blender, as export_glb.py expects;
             scaled so floor-to-neck-cut matches the procedural figure
             (157.5 cm), centred on the midline, its chest centred front
             to back
  2. regions every authored material is exported as it is (the build checks
             each against the manifest); an unclaimed face takes its borrowed
             region if the manifest borrows it (split by side as the manifest
             names it), and stays "body" otherwise, as do the hands (the
             procedural figure's hands hang elsewhere) and borrowed islands
             too small to pick
  3. export  one glTF primitive per region, through export_glb.py

Full resolution by default. ATLAS_TARGET_TRIANGLES decimates first (the
faces keep their materials).
"""

import base64
import json
import os
import re
import sys
from collections import Counter

import bmesh
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True
sys.path.insert(0, HERE)
import blend as bl          # noqa: E402
import export_glb           # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SOURCE = os.environ.get("ATLAS_MALE_BODY_SOURCE", os.path.join(ROOT, "assets", "anatomy", "Male_Body.blend"))
OBJECT = "male-body"
TARGET = int(os.environ.get("ATLAS_TARGET_TRIANGLES", "0"))     # 0: keep every triangle
NECK_CUT = 157.5            # the procedural figure's neck cut, cm
STONE = "atlas-stone"       # the sculpture's own material: faces no region claims
BODY = "body"
MANIFEST = os.path.join(ROOT, "assets", "anatomy", "male-body.manifest.json")
PAINT = os.path.join(ROOT, "assets", "anatomy", "Male_Body.paint.json")
# Texture Paint: the image beside the .blend, laid on the sculpture by the UV
# map "Paint" (paint_setup.py made both). It replaces the Vertex Paint colours
# once it exists. PAINT_SAMPLES: the points read across each triangle, per side.
PAINT_IMAGE = os.path.splitext(SOURCE)[0] + ".paint.png"
PAINT_UV, PAINT_SAMPLES = "Paint", 6
PAINT_SIGMA, PAINT_ISLAND = 0.01, 30  # the painted borders' cleanup: the blur's reach (m, a Gaussian's
                                      # sigma, measured on the surface, not in edges), an island's faces
# Texture Paint is read straight from the image, not blurred: each read takes
# the commonest region within this distance (m), enough to clean up a stray
# pixel without moving a border.
PAINT_CLEAN = 0.001
# A pixel within PAINT_MATCH (0-255 RGB, Euclidean) of a listed colour or white
# is that colour; one further from all of them is a blend (a soft brush edge)
# and takes the region of the nearest pixel that is not, within PAINT_FILL
# pixels (unpainted beyond). Shades of one region's colour, a touch-up, must
# then be keyed, which the key allows.
PAINT_MATCH, PAINT_FILL = 6.0, 32
# Authored regions the painting has replaced: their faces are unclaimed, so a
# face no paint names there is body. The adductors were one authored mass over
# the inner thigh; the adductor longus, pectineus and gracilis are painted.
RETIRED = {"adductors.L", "adductors.R"}
# The borrowed regions' cleanup, as the borrowing-only importer had it at 70k
# faces, kept at the same physical reach.
BASE_FACES, BASE_PASSES, BASE_ISLAND = 70000, 4, 40
# The hands (ATLAS cm): beside the thighs, below the wrists. No muscle is
# borrowed there (the procedural figure's hands hang elsewhere).
HAND_X, WRIST_Y = 24.0, 88.0


def borrowed_regions():
    """ATLAS region -> {side: manifest id} for every region the manifest borrows."""
    with open(MANIFEST, encoding="utf-8") as f:
        regions = json.load(f)["regions"]
    out = {}
    for r in regions:
        if r.get("source") == "borrowed":
            out.setdefault(r["atlasRegion"], {})[r["side"]] = r["id"]
    return out


def procedural_model():
    """Positions (cm), triangles and per-vertex regions of js/anatomy-model.js."""
    with open(os.path.join(ROOT, "js", "anatomy-model.js"), encoding="utf-8") as f:
        src = f.read()
    get = lambda k: json.loads(re.search(r"\b" + k + r": (\[[^\]]*\]|\d+|true|false)", src).group(1))
    bmin, bmax = get("min"), get("max")
    regions = json.loads(re.search(r'regions: Object.freeze\((\[.*?\])\)', src).group(1))
    n, vb = get("vertexCount"), get("vertexBytes")
    raw = base64.b64decode(re.search(r'data: "([^"]+)"', src).group(1))
    v = np.frombuffer(raw[:n * vb], dtype=np.uint8).reshape(n, vb)
    q = v[:, :6].copy().view(np.uint16).astype(float) / 65535.0
    pos = np.array(bmin) + q * (np.array(bmax) - np.array(bmin))
    idx = np.frombuffer(raw[n * vb:], dtype=np.uint32 if get("wideIndices") else np.uint16).reshape(-1, 3)
    return pos, idx, v[:, 10].copy(), regions


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


def majority(labels, nbrs, passes, min_island):
    """A majority vote over neighbouring faces, then small islands absorbed."""
    for _ in range(passes):
        new = labels.copy()
        for i, nb in enumerate(nbrs):
            c = Counter(labels[j] for j in nb); c[labels[i]] += 1
            new[i] = c.most_common(1)[0][0]
        labels = new
    for comp in islands(labels, nbrs):
        if len(comp) < min_island:
            ring = Counter(labels[j] for f in comp for j in nbrs[f] if labels[j] != labels[comp[0]])
            if ring:
                labels[comp] = ring.most_common(1)[0][0]
    return labels


def snap(c, palette, region):
    """Colours (n x 3, 0-1) -> region indices: the nearest listed colour's
    region, 0 when nearest to white."""
    return region[np.argmin(((c[:, None, :] - palette[None]) ** 2).sum(-1), axis=1)]


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
    """painted() for Texture Paint: the regions read straight from the paint
    image (PAINT_IMAGE, laid on by the PAINT_UV map), each pixel snapped like a
    corner. Each vertex takes the region under it; each edge whose two ends
    differ is cut where the image changes along it; each face, cut or not,
    takes the region at its centre. Every read is the commonest region within
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
    unpainted), or None if nothing is painted. Read from the paint image
    (Texture Paint) once there is one, from the Vertex Paint colours until
    then."""
    if not os.path.exists(PAINT):
        return None
    use_image = os.path.exists(PAINT_IMAGE) and PAINT_UV in me.uv_layers
    if not use_image and not me.color_attributes:
        return None
    with open(PAINT, encoding="utf-8") as f:
        key = json.load(f)["colors"]
    ids = list(dict.fromkeys(key.values()))                         # several colours may name one region
    palette = np.array([[1.0, 1.0, 1.0]] + [[int(h[k:k + 2], 16) / 255.0 for k in (1, 3, 5)] for h in key])
    region = np.array([0] + [ids.index(r) + 1 for r in key.values()])
    nv, k = len(me.vertices), len(ids) + 1
    vi = np.empty(len(me.loops), np.int64); me.loops.foreach_get("vertex_index", vi)
    if use_image:
        return image_cut(me, palette, region, ids)
    # Each vertex: the share of the paint around it of each colour (its corners' colours), then
    # blurred by distance (a Gaussian, PAINT_SIGMA), each vertex weighted by the
    # surface it stands for. Blurring by distance rather than along edges
    # reaches as far where the faces are small as where they are large, so a
    # border does not wobble where the mesh's density changes. Surface facing
    # away (the arm against the chest) is left out.
    attr = me.color_attributes.get(me.color_attributes.active_color_name or "") or me.color_attributes[0]
    c = np.empty(len(attr.data) * 4, np.float32); attr.data.foreach_get("color_srgb", c)
    c = c.reshape(-1, 4)[:, :3]
    if attr.domain == 'POINT':
        c = c[vi]
    elif attr.domain != 'CORNER':
        raise SystemExit("male_body: paint on %s is neither per vertex nor per corner" % attr.domain)
    corner = snap(c, palette, region)
    if not corner.any():
        return None
    share = np.stack([np.bincount(vi, corner == j, nv) for j in range(k)], 1)
    share /= np.maximum(share.sum(1, keepdims=True), 1)
    co = np.empty(nv * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    nor = np.empty(nv * 3); me.vertices.foreach_get("normal", nor); nor = nor.reshape(-1, 3)
    fa = np.empty(len(me.polygons)); me.polygons.foreach_get("area", fa)
    ft = np.empty(len(me.polygons), np.int64); me.polygons.foreach_get("loop_total", ft)
    area = np.bincount(vi, np.repeat(fa / ft, ft), nv)
    sigma = PAINT_SIGMA
    reach = 2.5 * sigma
    tree = KDTree(nv)
    for i, p in enumerate(co):
        tree.insert(p, i)
    tree.balance()
    e = np.empty(len(me.edges) * 2, np.int64); me.edges.foreach_get("vertices", e)
    a, b = e[0::2], e[1::2]
    top = share.argmax(1)
    edge = np.zeros(nv, bool); edge[a[top[a] != top[b]]] = True; edge[share.max(1) < 1] = True
    near = np.zeros(nv, bool)                                       # only these can change
    for i in np.flatnonzero(edge):
        near[[j for _, j, _ in tree.find_range(co[i], reach)]] = True
    blurred = share.copy()
    for i in np.flatnonzero(near):
        j = np.array([j for _, j, _ in tree.find_range(co[i], reach)])
        d2 = ((co[j] - co[i]) ** 2).sum(1)
        w = area[j] * np.exp(-d2 / (2 * sigma ** 2)) * np.clip(nor[j] @ nor[i], 0, 1)
        blurred[i] = w @ share[j] / max(w.sum(), 1e-12)
    share = blurred

    # Cut the faces a border crosses: each edge between two vertices that lean
    # to different colours is split where their shares are equal, and the
    # split points are joined across each face.
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    at = {v: share[v.index] for v in bm.verts}
    cuts = []
    for edge in list(bm.edges):
        v0, v1 = edge.verts
        s0, s1 = at[v0], at[v1]
        la, lb = int(s0.argmax()), int(s1.argmax())
        if la == lb:
            continue
        d0, d1 = s0[la] - s0[lb], s1[la] - s1[lb]
        if d0 - d1 <= 1e-9:
            continue
        t = min(max(d0 / (d0 - d1), 0.05), 0.95)
        _, nvert = bmesh.utils.edge_split(edge, v0, t)
        at[nvert] = s0 + (s1 - s0) * t
        cuts.append(nvert)
    if cuts:
        bmesh.ops.connect_verts(bm, verts=cuts)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    labels = np.array([int(np.mean([at[v] for v in f.verts], 0).argmax()) for f in bm.faces])   # a tie stays unpainted
    bm.to_mesh(me); bm.free(); me.update()
    return ids, labels


def borrow(me, nbrs, passes, min_island):
    """Each face's region on the procedural figure (by nearest surface), cleaned
    up: a majority vote over neighbouring faces, small islands absorbed."""
    ppos, pidx, preg, names = procedural_model()
    ptree = BVHTree.FromPolygons([tuple(p) for p in bl.to_blender(ppos) * 100.0], [tuple(t) for t in pidx])
    centres = np.empty(len(me.polygons) * 3); me.polygons.foreach_get("center", centres)
    labels = np.array([preg[pidx[ptree.find_nearest(tuple(c))[2]][0]] for c in centres.reshape(-1, 3) * 100.0])
    return [names[k] for k in majority(labels, nbrs, passes, min_island).tolist()]


def align(me):
    """Step 1, in place: the figure scaled to the procedural one and centred.
    Returns the scale."""
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    z0 = co[:, 2].min()
    # Floor to the neck cut, as measured on the original generated figure; the
    # refined sculpture records it (refine_male_body.py) because its break sits
    # lower than the old collar, which would otherwise rescale the figure.
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


def main(out_glb):
    bl.reset_scene()
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

    # 2. Regions: authored materials as they are; atlas-stone is unclaimed.
    idx = np.empty(faces, np.int64); me.polygons.foreach_get("material_index", idx)
    # A region id never ends in Blender's duplicate suffix (".001"): drop it.
    labels = [re.sub(r"\.\d{3}$", "", me.materials[i].name) for i in idx]
    labels = [STONE if l in RETIRED else l for l in labels]
    nbrs = face_neighbours(me)
    if paint:                                                       # painted regions: exactly their paint
        ids, face_paint = paint
        face_paint = majority(face_paint, nbrs, 0, PAINT_ISLAND)
        labels = [STONE if l in ids else l for l in labels]
        for i in np.flatnonzero(face_paint):
            labels[i] = ids[face_paint[i] - 1]
    unclaimed = np.array([l == STONE for l in labels])
    density = faces / BASE_FACES
    passes = max(1, round(BASE_PASSES * density ** 0.5))          # a pass reaches one face further
    min_island = max(1, round(BASE_ISLAND * density))              # an island's area, in faces
    lend = borrowed_regions()
    centres = np.empty(faces * 3); me.polygons.foreach_get("center", centres)
    centres = bl.to_atlas(centres.reshape(-1, 3))
    hand = (np.abs(centres[:, 0]) > HAND_X) & (centres[:, 1] < WRIST_Y)
    for i, r in enumerate(borrow(me, nbrs, passes, min_island)):
        if not unclaimed[i] or hand[i] or r not in lend:
            continue
        sides = lend[r]                                             # a side it does not name stays body
        labels[i] = sides.get("midline") or sides.get("left" if centres[i, 0] > 0 else "right", STONE)
    labels = np.array([BODY if l == STONE else l for l in labels], dtype=object)
    borrowed = {rid for ids in lend.values() for rid in ids.values()}
    for comp in islands(labels, nbrs):                              # a borrowed sliver: body
        if labels[comp[0]] in borrowed and len(comp) < min_island:
            labels[comp] = BODY
    for r in sorted(set(labels) - {m.name for m in me.materials} - {BODY}):
        me.materials.append(bl.region_material(r, (0.7, 0.5, 0.46)))
    for mat in me.materials:
        if mat.name == STONE:
            mat.name = BODY
    slot = {m.name: i for i, m in enumerate(me.materials)}
    me.polygons.foreach_set("material_index", [slot[l] for l in labels])
    me.polygons.foreach_set("use_smooth", [True] * faces)
    me.update()

    # 3. Export.
    export_glb.export(out_glb, obj_name=OBJECT)
    counts = Counter(labels)
    return dict(source_triangles=source_faces, triangles=faces, vertices=len(me.vertices), scale=round(s, 4),
                regions={k: counts[k] for k in sorted(counts)})


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = args[0] if args else os.path.join(ROOT, "assets", "anatomy", "male-body.glb")
    info = main(out)
    print("male body:", json.dumps(info))
