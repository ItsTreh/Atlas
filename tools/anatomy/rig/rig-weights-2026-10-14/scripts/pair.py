import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import viz as V
a = sys.argv[sys.argv.index("--") + 1:]; out = a[0]; files = a[1:]
R = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "renders"))
V.save_png(V.sheet([V.load_png(os.path.join(R, f)) for f in files], min(4, len(files)), [os.path.basename(f)[:-4].upper().replace("_", " ") for f in files], scale=3), os.path.join(R, out))
