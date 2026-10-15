"""Contact sheets comparing render sets from the same cameras.
  Blender -b --python sheets2.py -- <out dir> <label>=<render dir> ..."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "scripts")); sys.dont_write_bytecode = True
import viz as V
args = sys.argv[sys.argv.index("--") + 1:]
out = args[0]; sets = [a.split("=", 1) for a in args[1:]]
os.makedirs(out, exist_ok=True)
for view, title in (("front", "FRONT 3/4"), ("back", "BACK 3/4"), ("under", "FROM BELOW INTO THE ARMPIT")):
    for kind in ("clay", "heat"):
        ims, labs = [], []
        for lab, d in sets:
            for deg in (0, 30, 60, 90):
                ims.append(V.load_png(os.path.join(d, "%s_%s_%02d.png" % (kind, view, deg)))); labs.append("%s %d DEG" % (lab.upper(), deg))
        hdr = "RIGHT ARMPIT %s  %s" % (title, "CLAY" if kind == "clay" else "STRETCH: GREY 1X  YELLOW 2X  ORANGE 4X  RED 10X+  BLUE SHRUNK")
        V.save_png(V.sheet(ims, 4, labs, header=hdr, scale=3), os.path.join(out, "sheet_%s_%s.png" % (view, kind)))
print("sheets done")
