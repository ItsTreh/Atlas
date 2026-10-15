"""Shared helpers for the rig study. Runs inside Blender on scratch copies only."""
import bpy, json, os
import numpy as np
from mathutils import Vector

SCRATCH = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def guard():
    fp = os.path.abspath(bpy.data.filepath)
    if not fp.startswith(SCRATCH):
        raise SystemExit("refusing: %s is not under the scratch folder" % fp)


def mesh_world(obj):
    me = obj.data
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    M = np.array(obj.matrix_world)
    return co @ M[:3, :3].T + M[:3, 3]


def faces(me):
    nf = len(me.polygons)
    ls = np.empty(nf, np.int64); me.polygons.foreach_get("loop_start", ls)
    lt = np.empty(nf, np.int64); me.polygons.foreach_get("loop_total", lt)
    lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get("vertex_index", lv)
    return ls, lt, lv


def palette():
    key = json.load(open(os.path.join(SCRATCH, "original", "Male_Body.paint.json")))["colors"]
    ids = list(dict.fromkeys(key.values()))
    pal = np.array([[255, 255, 255]] + [[int(h[k:k + 2], 16) for k in (1, 3, 5)] for h in key], float)
    reg = np.array([0] + [ids.index(r) + 1 for r in key.values()])
    return ["body"] + ids, pal, reg


def face_regions(me):
    """Each face's painted region at its centre UV on the Paint map (nearest listed colour; 'blend' if far)."""
    names, pal, reg = palette()
    img = bpy.data.images.load(os.path.join(SCRATCH, "original", "Male_Body.paint.png"), check_existing=False)
    w, h = img.size
    px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px); bpy.data.images.remove(img)
    px = px.reshape(h, w, 4)[:, :, :3]
    ls, lt, lv = faces(me)
    uv = np.empty(len(me.loops) * 2); me.uv_layers["Paint"].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
    c = np.add.reduceat(uv, ls, axis=0) / lt[:, None]
    x = np.clip((c[:, 0] * w).astype(int), 0, w - 1); y = np.clip((c[:, 1] * h).astype(int), 0, h - 1)
    rgb = px[y, x] * 255
    d = ((rgb[:, None, :] - pal[None]) ** 2).sum(-1); k = d.argmin(1)
    out = np.array([names[reg[i]] for i in k], dtype=object); out[d.min(1) > 40.0 ** 2] = "blend"
    return out


def face_centres(me, P):
    ls, lt, lv = faces(me)
    return np.add.reduceat(P[lv], ls, axis=0) / lt[:, None]


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
