"""Small image helpers inside Blender: a numpy canvas saved as PNG, and
Workbench renders of the body with a per-corner colour attribute."""
import bpy, numpy as np, math
from mathutils import Vector


def save_png(rgb, path):
    """rgb: h x w x 3 floats 0-1, top row first."""
    h, w, _ = rgb.shape
    img = bpy.data.images.new("tmp_canvas", w, h, alpha=False)
    a = np.ones((h, w, 4), np.float32); a[:, :, :3] = rgb[::-1]
    img.pixels.foreach_set(a.ravel())
    img.filepath_raw = path; img.file_format = 'PNG'; img.save()
    bpy.data.images.remove(img)


def load_png(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4)[::-1, :, :3].copy()


FONT = {  # 3x5 bitmap digits/letters for labels
    '0': "111101101101111", '1': "010110010010111", '2': "111001111100111", '3': "111001111001111",
    '4': "101101111001001", '5': "111100111001111", '6': "111100111101111", '7': "111001001001001",
    '8': "111101111101111", '9': "111101111001111", '.': "000000000000010", '-': "000000111000000",
    'A': "010101111101101", 'B': "110101110101110", 'E': "111100110100111", 'F': "111100110100100",
    'O': "111101101101111", 'R': "110101110101101", 'T': "111010010010010", ' ': "000000000000000",
    'D': "110101101101110", 'G': "111100101101111", 'K': "101101110101101", 'C': "111100100100111",
    'S': "111100111001111", 'I': "111010010010111", 'L': "100100100100111", 'N': "101111111111101",
    'P': "111101111100100", 'H': "101101111101101", 'Y': "101101010010010", 'M': "101111111101101",
    'U': "101101101101111", 'V': "101101101101010", 'W': "101101111111101", 'X': "101101010101101",
    'Z': "111001010100111", 'Q': "111101101111001", 'J': "001001001101111", '/': "001001010100100",
    ':': "000010000010000", '>': "100010001010100", 'x': "000101010101000", '%': "101001010100101",
}


def text(canvas, s, x, y, scale=3, color=(0, 0, 0)):
    for ch in s.upper():
        g = FONT.get(ch, FONT[' '])
        for r in range(5):
            for c in range(3):
                if g[r * 3 + c] == '1':
                    canvas[y + r * scale:y + (r + 1) * scale, x + c * scale:x + (c + 1) * scale] = color
        x += 4 * scale


def sheet(images, cols, labels=None, pad=8, bg=1.0, header=None, scale=3):
    """Grid of equally sized images (h x w x 3); optional label per image."""
    h, w, _ = images[0].shape
    rows = math.ceil(len(images) / cols)
    top = 0 if header is None else 10 * scale
    lab = 8 * scale if labels else 0
    out = np.full((top + rows * (h + lab + pad) + pad, cols * (w + pad) + pad, 3), bg, np.float32)
    if header:
        text(out, header, pad, pad // 2 + 2, scale)
    for i, im in enumerate(images):
        r, c = divmod(i, cols)
        y0 = top + pad + r * (h + lab + pad); x0 = pad + c * (w + pad)
        if labels:
            text(out, labels[i], x0, y0, scale)
        out[y0 + lab:y0 + lab + h, x0:x0 + w] = im
    return out


def setup_workbench(res=(720, 720)):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sh = sc.display.shading
    sh.light = 'STUDIO'
    sh.show_cavity = False
    sh.show_object_outline = False
    sh.show_specular_highlight = False
    sc.display_settings.display_device = 'sRGB'
    sc.view_settings.view_transform = 'Standard'
    try:
        sc.world.color = (1, 1, 1)
    except Exception:
        pass
    sh.background_type = 'VIEWPORT' if hasattr(sh, "background_type") else None
    sh.background_color = (1, 1, 1)
    return sc


def camera(target, direction, ortho_scale=0.5, dist=2.0, up=(0, 0, 1)):
    sc = bpy.context.scene
    cam = bpy.data.objects.get("ExpCam")
    if cam is None:
        cam = bpy.data.objects.new("ExpCam", bpy.data.cameras.new("ExpCam"))
        sc.collection.objects.link(cam)
    d = Vector(direction).normalized()
    cam.location = Vector(target) + d * dist
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = ortho_scale
    cam.data.clip_start = 0.01; cam.data.clip_end = 10
    sc.camera = cam
    return cam


def render(path, color='SINGLE'):
    sc = bpy.context.scene
    sh = sc.display.shading
    sh.color_type = color
    sh.single_color = (0.78, 0.76, 0.73)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
