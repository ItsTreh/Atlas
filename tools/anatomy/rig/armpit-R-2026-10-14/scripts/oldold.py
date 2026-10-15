"""The old-old pairs reported at rest in the repaired copy: do the same two faces intersect in the original?"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
from mathutils.bvhtree import BVHTree
import common as C
C.guard()
me = bpy.data.objects["Mesh_0"].data
co, _ = C.mesh_arrays(me)
nf0 = 287219
polys = [tuple(p.vertices) for p in me.polygons]
fc = np.array([co[list(p)].mean(0) for p in polys])
zone = np.flatnonzero((fc[:, 0] < -0.12) & (fc[:, 2] > 0.40) & (fc[:, 2] < 0.85) & (np.arange(len(polys)) < nf0))
sub = [polys[i] for i in zone]
_, canon = np.unique(np.round(co / 1e-6).astype(np.int64), axis=0, return_inverse=True); canon = canon.ravel()
t = BVHTree.FromPolygons([tuple(p) for p in co], sub)
for i, j in t.overlap(t):
    if i < j and not set(canon[list(sub[i])]) & set(canon[list(sub[j])]):
        fi, fj = zone[i], zone[j]
        print("pair", fi, fj, "verts", polys[fi], polys[fj], "shared index", set(polys[fi]) & set(polys[fj]))
        print("   min distance between their vertices (mm): %.4f" % (min(np.linalg.norm(co[a] - co[b]) for a in polys[fi] for b in polys[fj]) * 1000))
