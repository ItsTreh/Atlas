"""Contact sheets: before/after from matching cameras."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import numpy as np, viz as V
R = os.path.join(os.path.dirname(__file__), "..", "renders")
def ld(tag, name): return V.load_png(os.path.join(R, tag, name))
for view, title in (("front", "FRONT 3/4"), ("back", "BACK 3/4"), ("under", "FROM BELOW INTO THE ARMPIT")):
    for kind in ("clay", "heat"):
        ims, labs = [], []
        for tag in ("before", "after"):
            for deg in (0, 30, 60, 90):
                ims.append(ld(tag, "%s_%s_%02d.png" % (kind, view, deg))); labs.append("%s %d DEG" % (tag.upper(), deg))
        hdr = "RIGHT ARMPIT %s  %s" % (title, "CLAY" if kind == "clay" else "STRETCH: GREY 1X  YELLOW 2X  ORANGE 4X  RED 10X+  BLUE SHRUNK")
        V.save_png(V.sheet(ims, 4, labs, header=hdr, scale=3), os.path.join(R, "sheet_%s_%s.png" % (view, kind)))
ims, labs = [], []
for tag in ("before", "after"):
    for view in ("front", "back", "under"):
        for deg in (0, 90):
            ims.append(ld(tag, "paint_%s_%02d.png" % (view, deg))); labs.append("%s %s %d" % (tag.upper(), view.upper(), deg))
V.save_png(V.sheet(ims, 6, labs, header="PAINTED REGIONS  BEFORE / AFTER  REST AND 90 DEG", scale=3), os.path.join(R, "sheet_paint.png"))
print("sheets done")
