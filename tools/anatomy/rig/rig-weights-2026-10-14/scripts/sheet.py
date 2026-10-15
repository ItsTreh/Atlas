"""Contact sheet: rows = tags, columns = 0/30/60/90.  Blender -b --python sheet.py -- <kind> <view> <out> tag1:LABEL1 tag2:LABEL2 ..."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np, viz as V
a = sys.argv[sys.argv.index("--") + 1:]
kind, view, out = a[0], a[1], a[2]; rows = [x.split(":") for x in a[3:]]
R = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "renders"))
ims, labs = [], []
for tag, lab in rows:
    for deg in (0, 30, 60, 90):
        f = os.path.join(R, tag, "%s_%s_%02d.png" % (kind, view, deg))
        ims.append(V.load_png(f) if os.path.exists(f) else np.ones((560, 560, 3), np.float32)); labs.append("%s %d DEG" % (lab.replace("_", " "), deg))
hdr = {"clay": "CLAY", "heat": "STRETCH: GREY 1X  YELLOW 2X  ORANGE 4X  RED 10X+  BLUE SHRUNK", "paint": "PAINTED REGIONS", "weight": "UPPER ARM WEIGHT: BLUE 0  YELLOW 0.5  RED 1", "bones": "POSED DEFORM BONES  BLUE  TWIST PURPLE  RED HEADS"}[kind]
V.save_png(V.sheet(ims, 4, labs, header="RIGHT ARMPIT %s  %s" % (view.upper(), hdr), scale=3), os.path.join(R, out))
