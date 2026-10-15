"""Contact sheet from PNGs:  Blender -b --python scripts/sheet.py -- out.png cols header img1 img2 ..."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import viz as V
a = sys.argv[sys.argv.index("--") + 1:]
out, cols, header, files = a[0], int(a[1]), a[2], a[3:]
ims = [V.load_png(f) for f in files]
labs = [os.path.basename(f)[:-4].upper().replace("_", " ") for f in files]
V.save_png(V.sheet(ims, cols, labs, header=header or None, scale=2), out)
