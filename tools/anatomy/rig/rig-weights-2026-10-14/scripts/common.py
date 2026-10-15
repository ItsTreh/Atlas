"""Shared helpers for the rig-weights study (2026-10-14). Runs inside Blender on
scratch copies only; nothing here saves unless a script calls save explicitly on
a path under this scratch folder."""
import bpy, json, os
import numpy as np
from mathutils import Matrix

SCRATCH = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ARMPIT = os.path.abspath(os.path.join(SCRATCH, "..", "armpit-R-2026-10-14"))
RIGSTUDY = os.path.abspath(os.path.join(SCRATCH, "..", "rig-2026-10-14"))


def guard():
    fp = os.path.abspath(bpy.data.filepath)
    if not fp.startswith(os.path.abspath(os.path.join(SCRATCH, ".."))):
        raise SystemExit("refusing: %s is not under the scratch folder" % fp)


def mesh_co(me):
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); return co.reshape(-1, 3)


def mesh_world(obj):
    M = np.array(obj.matrix_world)
    return mesh_co(obj.data) @ M[:3, :3].T + M[:3, 3]


def edges(me):
    ev = np.empty(len(me.edges) * 2, np.int64); me.edges.foreach_get("vertices", ev); return ev.reshape(-1, 2)


def faces(me):
    nf = len(me.polygons)
    ls = np.empty(nf, np.int64); me.polygons.foreach_get("loop_start", ls)
    lt = np.empty(nf, np.int64); me.polygons.foreach_get("loop_total", lt)
    lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get("vertex_index", lv)
    return ls, lt, lv


def triangles(me):
    """Fan triangulation: (n, 4) = three vertex indices + the face index."""
    ls, lt, lv = faces(me)
    return np.concatenate([np.stack([lv[ls[lt > k]], lv[ls[lt > k] + k - 1], lv[ls[lt > k] + k], np.flatnonzero(lt > k)], 1)
                           for k in range(2, lt.max())])


def palette():
    key = json.load(open(os.path.join(SCRATCH, "original", "Male_Body.paint.json")))["colors"]
    ids = list(dict.fromkeys(key.values()))
    pal = np.array([[255, 255, 255]] + [[int(h[k:k + 2], 16) for k in (1, 3, 5)] for h in key], float)
    reg = np.array([0] + [ids.index(r) + 1 for r in key.values()])
    return ["body"] + ids, pal, reg


def paint_pixels():
    img = bpy.data.images.load(os.path.join(SCRATCH, "original", "Male_Body.paint.png"), check_existing=False)
    w, h = img.size
    px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px); bpy.data.images.remove(img)
    return px.reshape(h, w, 4)[:, :, :3], w, h


def face_regions(me, px=None):
    """Each face's painted region at its centre UV on the Paint map (nearest listed colour; 'blend' if far)."""
    names, pal, reg = palette()
    if px is None: px = paint_pixels()
    px, w, h = px
    ls, lt, lv = faces(me)
    uv = np.empty(len(me.loops) * 2); me.uv_layers["Paint"].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
    c = np.add.reduceat(uv, ls, axis=0) / lt[:, None]
    x = np.clip((c[:, 0] * w).astype(int), 0, w - 1); y = np.clip((c[:, 1] * h).astype(int), 0, h - 1)
    rgb = px[y, x] * 255
    d = ((rgb[:, None, :] - pal[None]) ** 2).sum(-1); k = d.argmin(1)
    out = np.array([names[reg[i]] for i in k], dtype=object); out[d.min(1) > 40.0 ** 2] = "blend"
    return out


def vertex_regions(me, freg):
    """Per vertex: the painted region covering most of its faces (by count)."""
    ls, lt, lv = faces(me)
    fol = np.repeat(np.arange(len(ls)), lt)
    names = np.unique(freg); idx = {n: i for i, n in enumerate(names)}
    fi = np.array([idx[r] for r in freg])
    cnt = np.zeros((len(me.vertices), len(names)), np.int32)
    np.add.at(cnt, (lv, fi[fol]), 1)
    return names[cnt.argmax(1)]


def weights(obj):
    """Vertex group weights as a dense (nv, ngroups) array and the group names."""
    me = obj.data; nv = len(me.vertices); names = [g.name for g in obj.vertex_groups]
    Wm = np.zeros((nv, len(names)), np.float32)
    for v in me.vertices:
        for g in v.groups:
            Wm[v.index, g.group] = g.weight
    return Wm, names


def rest_pose(arm):
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix()
    bpy.context.view_layer.update()


def elevate(arm, deg, bone):
    """Abduct the right upper arm `deg` degrees in the coronal plane, about the world y axis
    through the bone's head: the same motion as the armpit study (pure glenohumeral; the
    clavicle and scapula stay put)."""
    rest_pose(arm)
    pb = arm.pose.bones[bone]
    h = np.array(arm.matrix_world @ pb.head)
    Mw = Matrix.Translation(h) @ Matrix.Rotation(np.radians(deg), 4, 'Y') @ Matrix.Translation(-h) @ (arm.matrix_world @ pb.matrix)
    pb.matrix = arm.matrix_world.inverted() @ Mw
    bpy.context.view_layer.update()


def evaluated_co(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    e = obj.evaluated_get(dg); m = e.to_mesh()
    P = np.empty(len(m.vertices) * 3); m.vertices.foreach_get("co", P)
    e.to_mesh_clear()
    M = np.array(obj.matrix_world)
    return P.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]
# ------------------------------------------------------------- overlays
def project(cam, res, P):
    """World points -> pixel (x from left, y from top) for an orthographic camera."""
    W, H = res; s = cam.data.ortho_scale; ppm = max(W, H) / s
    M = np.array(cam.matrix_world); r, u, o = M[:3, 0], M[:3, 1], M[:3, 3]
    d = np.atleast_2d(P) - o
    return np.c_[W / 2 + (d @ r) * ppm, H / 2 - (d @ u) * ppm]


def draw_line(img, a, b, col, th=2):
    n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
    for t in np.linspace(0, 1, n + 1):
        x, y = a + (b - a) * t
        img[max(0, int(y) - th):int(y) + th + 1, max(0, int(x) - th):int(x) + th + 1] = col


def draw_dot(img, p, col, r=4):
    H, W, _ = img.shape
    yy, xx = np.ogrid[:H, :W]
    img[(xx - p[0]) ** 2 + (yy - p[1]) ** 2 <= r * r] = col
