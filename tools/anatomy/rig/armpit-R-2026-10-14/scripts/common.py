"""Shared helpers for the right-armpit experiment. Runs inside Blender on a
scratch copy only; nothing here saves unless a script calls save explicitly
on a path under the scratch folder."""
import bpy, bmesh, json, os
import numpy as np
from collections import defaultdict
from mathutils import Matrix

SCRATCH = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PROD = "/Users/tred/Documents/SD-Routine/assets/anatomy/"


def guard():
    """Refuse to run on the production file."""
    fp = os.path.abspath(bpy.data.filepath)
    if not fp.startswith(SCRATCH):
        raise SystemExit("refusing: %s is not under the scratch folder" % fp)


def mesh_arrays(me):
    nv = len(me.vertices)
    co = np.empty(nv * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    ev = np.empty(len(me.edges) * 2, np.int64); me.edges.foreach_get("vertices", ev); ev = ev.reshape(-1, 2)
    return co, ev


def palette():
    key = json.load(open(os.path.join(SCRATCH, "original", "Male_Body.paint.json")))["colors"]
    ids = list(dict.fromkeys(key.values()))
    pal = np.array([[255, 255, 255]] + [[int(h[k:k + 2], 16) for k in (1, 3, 5)] for h in key], float)
    reg = np.array([0] + [ids.index(r) + 1 for r in key.values()])
    return ["body"] + ids, pal, reg


def paint_pixels():
    img = bpy.data.images.load(os.path.join(SCRATCH, "original", "Male_Body.paint.png"), check_existing=False)
    w, h = img.size
    px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4)[:, :, :3], w, h


def region_of_rgb(rgb255, names, pal, reg):
    """Nearest listed colour (or white) -> region name; far from all -> 'blend'."""
    d = ((rgb255[:, None, :] - pal[None]) ** 2).sum(-1)
    k = d.argmin(1)
    out = np.array([names[reg[i]] for i in k], dtype=object)
    out[d.min(1) > 40.0 ** 2] = "blend"
    return out


def face_regions(me, px, w, h, names, pal, reg):
    """Each face's painted region, read at its centre UV on the Paint map."""
    nl = len(me.loops)
    uv = np.empty(nl * 2); me.uv_layers["Paint"].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
    ls = np.empty(len(me.polygons), np.int64); me.polygons.foreach_get("loop_start", ls)
    lt = np.empty(len(me.polygons), np.int64); me.polygons.foreach_get("loop_total", lt)
    sums = np.add.reduceat(uv, ls, axis=0); c = sums / lt[:, None]
    x = np.clip((c[:, 0] * w).astype(int), 0, w - 1); y = np.clip((c[:, 1] * h).astype(int), 0, h - 1)
    return region_of_rgb(px[y, x] * 255, names, pal, reg)


def weights(obj):
    """Vertex group weights as {name: array}, plus the per-vertex total."""
    me = obj.data; nv = len(me.vertices)
    G = {g.index: g.name for g in obj.vertex_groups}
    W = {n: np.zeros(nv) for n in G.values()}
    for v in me.vertices:
        for g in v.groups:
            W[G[g.group]][v.index] = g.weight
    return W


def rest_pose(arm):
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix()
    bpy.context.view_layer.update()


def elevate(arm, deg, bone="Bone.010"):
    """Abduct the right upper arm `deg` degrees in the coronal plane (about the
    world y axis through the bone's head). Pure glenohumeral motion: the
    clavicle/scapula bone stays put, as in the 2026-10-13 analysis."""
    rest_pose(arm)
    pb = arm.pose.bones[bone]
    h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(np.radians(deg), 4, 'Y') @ Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()


def evaluated_co(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    e = obj.evaluated_get(dg); m = e.to_mesh()
    P = np.empty(len(m.vertices) * 3); m.vertices.foreach_get("co", P)
    e.to_mesh_clear()
    return P.reshape(-1, 3) @ np.array(obj.matrix_world)[:3, :3].T + np.array(obj.matrix_world)[:3, 3]
