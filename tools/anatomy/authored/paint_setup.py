"""
Gets Male_Body.blend ready for Texture Paint, once. The painted regions move
from the Vertex Paint colours (one colour per face corner) to an image, so a
border can run through a face instead of along its edges.

    PYTHONDONTWRITEBYTECODE=1 /Applications/Blender.app/Contents/MacOS/Blender \
        -b --factory-startup --python tools/anatomy/authored/paint_setup.py

Close Blender first: this saves the .blend. It adds

  - the UV map "Paint" (Smart UV Project: no overlaps, even detail). The
    sculpture's own "UVMap" overlaps and squashes faces, so it is left as it
    is, unused;
  - Male_Body.paint.png beside the .blend (PAINT_SIZE square): today's painted
    regions as the export draws them (borders smoothed and cut, islands
    absorbed), each in its first colour in Male_Body.paint.json, white where
    nothing is painted. Pixels outside the UV map's pieces take the nearest
    piece's colour, so a seam does not show;
  - that image as Texture Paint's canvas (Single Image mode, on "Paint").

The Vertex Paint colours stay in the file, untouched. male_body.py reads the
image as soon as it exists. Refuses to run again once the image or the UV map
exists (ATLAS_MALE_BODY_SOURCE points it at a copy, as it does male_body.py).
"""

import json
import math
import os
import sys

import bpy
import numpy as np

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import male_body as mb      # noqa: E402

PAINT_SIZE = 4096           # px, square
BLEED = 6                   # px: how far past each piece of the UV map its colours reach
MARGIN = 0.003              # the gap between the UV map's pieces, of the image's side


def unwrap(obj):
    me = obj.data
    uv = me.uv_layers.new(name=mb.PAINT_UV)
    me.uv_layers.active = uv                                        # what Texture Paint paints on
    for layer in me.uv_layers:
        layer.active_render = layer.name != mb.PAINT_UV             # the glTF export takes no UVs anyway
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    opts = dict(angle_limit=math.radians(66), island_margin=MARGIN, area_weight=0.0,
                correct_aspect=True, scale_to_bounds=False)
    props = {p.identifier for p in bpy.ops.uv.smart_project.get_rna_type().properties}
    bpy.ops.uv.smart_project(**{k: v for k, v in opts.items() if k in props})
    bpy.ops.object.mode_set(mode='OBJECT')


def regions(me):
    """The painted regions as male_body.py exports them, on a copy of the mesh:
    (the cut copy, its faces' colours as 0-255 RGB, white where unpainted)."""
    cut = me.copy()
    mb.align(cut)
    ids, face = mb.painted(cut)
    face = mb.majority(face, mb.face_neighbours(cut), 0, mb.PAINT_ISLAND)
    with open(mb.PAINT, encoding="utf-8") as f:
        key = json.load(f)["colors"]
    first = {}
    for h, r in key.items():
        first.setdefault(r, [int(h[k:k + 2], 16) for k in (1, 3, 5)])
    colour = np.array([[255, 255, 255]] + [first[r] for r in ids], np.uint8)
    return cut, colour[face]


def rasterize(me, face_rgb, size):
    """Each face's colour into a size x size image through the "Paint" UV map
    (rows bottom first, as Blender stores them); None where no face lies."""
    me.calc_loop_triangles()
    nt = len(me.loop_triangles)
    tl = np.empty(nt * 3, np.int64); me.loop_triangles.foreach_get("loops", tl); tl = tl.reshape(-1, 3)
    tp = np.empty(nt, np.int64); me.loop_triangles.foreach_get("polygon_index", tp)
    uv = np.empty(len(me.loops) * 2); me.uv_layers[mb.PAINT_UV].data.foreach_get("uv", uv)
    tri = uv.reshape(-1, 2)[tl] * size - 0.5                         # pixel centres at whole numbers
    lo = np.floor(tri.min(1)).astype(np.int64) + 1
    hi = np.floor(tri.max(1)).astype(np.int64)
    img = np.zeros((size, size, 3), np.uint8)
    filled = np.zeros((size, size), bool)
    ext = np.maximum(hi - lo + 1, 0)
    for wx, wy in {tuple(e) for e in ext.tolist()}:                 # triangles by the box they cover
        sel = np.flatnonzero((ext[:, 0] == wx) & (ext[:, 1] == wy))
        if not len(sel) or not wx or not wy:
            continue
        gx, gy = np.meshgrid(np.arange(wx), np.arange(wy))
        for s in range(0, len(sel), max(1, 2_000_000 // (wx * wy))):
            t = sel[s:s + max(1, 2_000_000 // (wx * wy))]
            x = lo[t, 0, None] + gx.ravel()[None]
            y = lo[t, 1, None] + gy.ravel()[None]
            a, b, c = tri[t, 0], tri[t, 1], tri[t, 2]
            d = (b[:, 0] - a[:, 0]) * (c[:, 1] - a[:, 1]) - (c[:, 0] - a[:, 0]) * (b[:, 1] - a[:, 1])
            d = np.where(np.abs(d) < 1e-12, 1e-12, d)[:, None]
            u = ((b[:, None, 0] - x) * (c[:, None, 1] - y) - (c[:, None, 0] - x) * (b[:, None, 1] - y)) / d
            v = ((c[:, None, 0] - x) * (a[:, None, 1] - y) - (a[:, None, 0] - x) * (c[:, None, 1] - y)) / d
            inside = (u >= -1e-6) & (v >= -1e-6) & (1 - u - v >= -1e-6)
            inside &= (x >= 0) & (x < size) & (y >= 0) & (y < size)
            ti, pi = np.nonzero(inside)
            img[y[ti, pi], x[ti, pi]] = face_rgb[tp[t[ti]]]
            filled[y[ti, pi], x[ti, pi]] = True
    return img, filled


def bleed(img, filled, steps):
    """Pixels outside the pieces take a neighbouring piece's colour, steps deep."""
    for _ in range(steps):
        grow = np.zeros_like(filled)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            src = np.roll(np.roll(filled, dy, 0), dx, 1) & ~filled & ~grow
            img[src] = np.roll(np.roll(img, dy, 0), dx, 1)[src]
            grow |= src
        filled |= grow
    img[~filled] = 255
    return img


def main():
    blend, png = mb.SOURCE, mb.PAINT_IMAGE
    if os.path.exists(png):
        raise SystemExit("paint_setup: %s exists already" % png)
    bpy.ops.wm.open_mainfile(filepath=blend)
    obj = next(o for o in bpy.data.objects if o.type == 'MESH' and o.data.name == "Mesh_0")
    me = obj.data
    if mb.PAINT_UV in me.uv_layers:
        raise SystemExit("paint_setup: Mesh_0 has a UV map %r already" % mb.PAINT_UV)

    unwrap(obj)
    cut, face_rgb = regions(me)
    img, filled = rasterize(cut, face_rgb, PAINT_SIZE)
    bpy.data.meshes.remove(cut)
    used = filled.mean()
    img = bleed(img, filled, BLEED)

    canvas = bpy.data.images.new(os.path.basename(png), PAINT_SIZE, PAINT_SIZE, alpha=False)
    px = np.ones((PAINT_SIZE, PAINT_SIZE, 4), np.float32); px[..., :3] = img / 255.0
    canvas.pixels.foreach_set(px.ravel())
    canvas.filepath_raw = png
    canvas.file_format = 'PNG'
    canvas.save()
    canvas.source = 'FILE'                                          # the file on disk, not a generated image
    canvas.filepath = bpy.path.relpath(png, start=os.path.dirname(blend))
    canvas.reload()
    for scene in bpy.data.scenes:
        paint = scene.tool_settings.image_paint
        paint.mode = 'IMAGE'
        paint.canvas = canvas
    for screen in bpy.data.screens:                                 # Solid view shows the image
        for area in screen.areas:
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.color_type = 'TEXTURE'
    bpy.ops.wm.save_mainfile(filepath=blend, compress=True)
    print("paint setup: %s (%d px, %.0f%% of it on the body), UV map %r" % (png, PAINT_SIZE, 100 * used, mb.PAINT_UV))


if __name__ == "__main__":
    main()
