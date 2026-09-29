"""
Refines the Male_Body sculpture for ATLAS: writes assets/anatomy/Male_Body.blend.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python tools/anatomy/authored/refine_male_body.py [-- --source <original.blend>] [--out <path>]

It always starts from the generated sculpture exactly as first committed
(git 8766948:assets/anatomy/Male_Body.blend, checked by its SHA-256), so a run
is reproducible and never compounds on its own output. It records what it
wrote on the mesh (atlas_refinement, and a hash of the geometry).

It never overwrites hand-authored work (refine_guard.py). Next to the output
it writes a record (Male_Body.refinement.json) of the exact bytes it saved,
and it replaces an existing output only while that file still matches its
record. Any edit since (regions or materials painted, metadata added, even a
re-save in Blender), or a missing record, makes it stop before doing any work;
there is no override. From the first hand edit on, the .blend is the source of
truth and this script is its provenance. Tests: test_refine_guard.py.

Every change is local, blends out over a soft margin, and answers something
seen in matte renders of the original. Nothing is added for rendering effects,
and no cartography is baked in:

  normals   the stored custom normals equal the computed smooth normals
            (measured: < 0.1 deg apart); they are dropped so that edited areas
            shade from their new shape
  repairs   the torn front of the left deltoid, the crack at the right
            pectoral-deltoid junction, a vein ridge down the right biceps and
            a knot of lumps in the left armpit (with the mesh's only
            self-intersection) are smoothed away. Only the detail riding on
            the forms is smoothed (the surface minus a copy smoothed over
            ~2.5 cm), so the muscles under a defect keep their shape and volume
  forearms  the crumpled, veined surface of both forearms is quietened, the
            same way, to the muscle masses under it
  nipples   kept, but lowered to a sculptural mark rather than a realistic
            detail
  back      the back's own anatomy (scapulae, latissimus, erector columns,
            spinal furrow) is present but shallow; its relief at the scale of
            the muscles is deepened, the swellings more than the grooves, and
            the backs of the thighs a little. Nothing is added that the
            surface does not already hold, and any spot the deepening would
            fold is left as it was
  neck      the crumpled collar left by the generator is replaced by a
            fracture: an oblique break across the neck in two stages (a lower
            front plane, a higher back one, a riser between), angular facets,
            crisp edges and three chips out of the rim, as a marble torso that
            has lost its head
  material  one matte neutral material (atlas-stone) in place of the
            generator's textured marble; the old material and its packed
            textures are purged before saving, as ATLAS does not use them

Left as they were: the pose, the proportions, the front's anatomy, the
hands, the feet, the knees, the navel and the groin (a closed, restrained
form that does not pull towards a realistic nude). The back and thigh
deepening reaches a little past its areas at its soft margins: the backs of
the hands move by up to 1.2 mm, the backs of the upper arms by up to 2.9 mm
and the backs of the knees by up to 1.0 mm, too little to see.

The mesh keeps its name (Mesh_0), its frame and its UVs. It records
atlas_floor_to_neck, the original floor-to-neck-cut height, so the importer
(male_body.py) keeps the figure at the same scale now that the break sits
lower than the old collar.
"""

import hashlib
import heapq
import math
import os
import subprocess
import sys
import tempfile

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import delaunay_2d_cdt

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import refine_guard as guard  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
TARGET = os.path.join(ROOT, "assets", "anatomy", "Male_Body.blend")
ORIGINAL_GIT = "8766948:assets/anatomy/Male_Body.blend"
ORIGINAL_SHA256 = "ac954ccfe3064b2f7c88251e14f7de169ce9310722eacc9304b2a43aa07b63c0"
VERSION = "male-body-refine@1"
FLOOR_TO_NECK = 1.87393      # the original's floor to neck cut, as male_body.py measured it (source units)

# Source frame: z up, the figure faces -y, +x is the figure's left. Units as the
# generator left them (the figure is 1.90 tall); 0.01 is about 0.84 cm in ATLAS.

# ----------------------------------------------------------------- zones
# Seeds are (a, b) points on a view, cast onto the surface from that side:
# "front" (a = x, b = z) looks along +y, "left" (a = y, b = z) along -x.
# Repairs smooth only the detail finer than the muscle forms (what is left once
# the surface is smoothed over DETAIL_BAND iterations, ~2.5 cm), so the forms
# under a defect keep their shape and volume.
DETAIL_BAND = 220
# The tear covers the front and side of the left deltoid, from the acromion
# down to the insertion: an ellipsoid, limited to the surface near its centre.
# Its lumps are broader than the other defects, so its "forms" are smoothed
# further (~4.5 cm): the deltoid's own shape is broader still.
TEAR_LEFT_DELTOID = dict(centre=(0.250, -0.035, 0.745), axes=(0.070, 0.070, 0.105),
                         seed=("front", 0.260, 0.740), reach=0.16, iterations=90, band=700)
LUMPS_LEFT_ARMPIT = dict(seeds=[("front", 0.157, 0.570), ("front", 0.164, 0.554), ("front", 0.175, 0.560),
                                ("point", 0.191, -0.005, 0.620)],
                         inner=0.012, outer=0.030, iterations=40)
CRACK_RIGHT_SHOULDER = dict(seeds=[("front", -0.202, 0.703), ("front", -0.210, 0.690), ("front", -0.198, 0.716),
                                   ("right", -0.135, 0.740), ("right", -0.137, 0.717), ("right", -0.135, 0.689)],
                            inner=0.012, outer=0.030, iterations=36)
VEIN_RIGHT_BICEPS = dict(seeds=[("front", -0.283, z) for z in np.arange(0.545, 0.671, 0.018)],
                         inner=0.011, outer=0.028, iterations=36)
FOREARMS = [dict(elbow=("front", -0.337, 0.455)), dict(elbow=("front", 0.273, 0.432))]
FOREARM = dict(reach=0.40, outboard=0.20, z_full=(0.115, 0.425), z_fade=0.04, iterations=60)
NIPPLES = dict(seeds=[("front", -0.161, 0.630), ("front", 0.151, 0.625)], inner=0.006, outer=0.020,
               iterations=24, keep=0.45)
BACK = dict(z_full=(0.32, 0.80), z_fade=0.07, facing=(0.05, 0.40), arm_reach=0.26,
            fine=2, broad=150, bias=120, gain_up=1.65, gain_down=1.30,
            # The backs of the thighs, more gently; the glutes and calves are left as they are.
            thigh_z_full=(-0.42, -0.02), thigh_z_fade=0.06, thigh_midline=(0.03, 0.07),
            thigh_gain_up=1.35, thigh_gain_down=1.15)
NECK = dict(front=(-0.093, 0.870), back=(0.078, 0.912), lateral_tilt_deg=4.0, region=0.15, keep_below=0.07,
            spacing=0.0036, seed=7)


def log(msg):
    print("refine-male-body: " + msg, flush=True)


# ------------------------------------------------------------- the source

def load_original(source):
    """The original generated mesh, appended into an empty scene."""
    tmp = None
    if source is None:
        data = subprocess.run(["git", "-C", ROOT, "show", ORIGINAL_GIT], check=True, capture_output=True).stdout
        tmp = tempfile.NamedTemporaryFile(suffix=".blend", delete=False)
        tmp.write(data); tmp.close()
        source = tmp.name
    digest = hashlib.sha256(open(source, "rb").read()).hexdigest()
    if digest != ORIGINAL_SHA256:
        raise SystemExit("refine-male-body: %s is not the original Male_Body.blend (sha256 %s)" % (source, digest[:12]))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    with bpy.data.libraries.load(source, link=False) as (src, dst):
        dst.meshes = ["Mesh_0"]
    if tmp:
        os.unlink(tmp.name)
    me = dst.meshes[0]
    obj = bpy.data.objects.new("Mesh_0", me)
    bpy.context.scene.collection.objects.link(obj)
    return obj, me


def geometry_hash(me):
    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co)
    return hashlib.sha256(co.tobytes() + str(len(me.polygons)).encode()).hexdigest()[:16]


# ------------------------------------------------------------ mesh maths

class Surface:
    """Vertex positions and the mesh's connectivity, for numpy work."""

    def __init__(self, me):
        n = len(me.vertices)
        self.n = n
        co = np.empty(n * 3); me.vertices.foreach_get("co", co)
        self.co = co.reshape(-1, 3)
        e = np.empty(len(me.edges) * 2, dtype=np.int64); me.edges.foreach_get("vertices", e)
        self.edges = e.reshape(-1, 2)
        me.calc_loop_triangles()
        tri = np.empty(len(me.loop_triangles) * 3, dtype=np.int64); me.loop_triangles.foreach_get("vertices", tri)
        self.tris = tri.reshape(-1, 3)
        self.degree = np.bincount(self.edges.ravel(), minlength=n).astype(float)
        order = np.argsort(np.concatenate([self.edges[:, 0], self.edges[:, 1]]), kind="stable")
        self.adj_to = np.concatenate([self.edges[:, 1], self.edges[:, 0]])[order]
        self.adj_start = np.concatenate([[0], np.cumsum(np.bincount(self.edges.ravel(), minlength=n))])

    def neighbour_mean(self, p):
        a, b = self.edges[:, 0], self.edges[:, 1]
        out = np.empty_like(p)
        for k in range(p.shape[1] if p.ndim > 1 else 1):
            col = p[:, k] if p.ndim > 1 else p
            s = np.bincount(a, weights=col[b], minlength=self.n) + np.bincount(b, weights=col[a], minlength=self.n)
            if p.ndim > 1: out[:, k] = s / self.degree
            else: out = s / self.degree
        return out

    def smooth(self, p, iterations, weight=None, lam=0.5):
        """Plain Laplacian smoothing (shrinks convex forms a little)."""
        p = p.copy()
        w = lam if weight is None else lam * (weight[:, None] if p.ndim > 1 else weight)
        for _ in range(iterations):
            p += w * (self.neighbour_mean(p) - p)
        return p

    def folds(self, p, degrees=100):
        """Per pair of triangles sharing an edge: True where the surface folds sharply there."""
        if not hasattr(self, "pairs"):
            t = self.tris
            e = np.concatenate([t[:, [0, 1]], t[:, [1, 2]], t[:, [2, 0]]])
            key = np.minimum(e[:, 0], e[:, 1]) * self.n + np.maximum(e[:, 0], e[:, 1])
            face = np.tile(np.arange(len(t)), 3)
            order = np.argsort(key, kind="stable")
            k, f = key[order], face[order]
            same = np.where(k[1:] == k[:-1])[0]
            self.pairs = np.stack([f[same], f[same + 1]], 1)
        a, b, c = p[self.tris[:, 0]], p[self.tris[:, 1]], p[self.tris[:, 2]]
        fn = np.cross(b - a, c - a); fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-18)
        return np.einsum("ij,ij->i", fn[self.pairs[:, 0]], fn[self.pairs[:, 1]]) < math.cos(math.radians(degrees))

    def ring(self, vertices, rings):
        """The vertices within `rings` edges of `vertices` (a boolean mask)."""
        mask = vertices.copy()
        for _ in range(rings):
            grow = mask.copy()
            grow[self.edges[:, 1][mask[self.edges[:, 0]]]] = True
            grow[self.edges[:, 0][mask[self.edges[:, 1]]]] = True
            mask = grow
        return mask

    def normals(self, p):
        a, b, c = p[self.tris[:, 0]], p[self.tris[:, 1]], p[self.tris[:, 2]]
        fn = np.cross(b - a, c - a)
        vn = np.zeros_like(p)
        for k in range(3):
            for j in range(3):
                vn[:, k] += np.bincount(self.tris[:, j], weights=fn[:, k], minlength=self.n)
        return vn / np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)

    def geodesic(self, seeds, reach):
        """Distance over the surface from the nearest seed, up to `reach` (inf beyond)."""
        dist = np.full(self.n, np.inf)
        heap = [(0.0, s) for s in seeds]
        for s in seeds: dist[s] = 0.0
        co, start, to = self.co, self.adj_start, self.adj_to
        while heap:
            d, v = heapq.heappop(heap)
            if d > dist[v] or d > reach: continue
            for q in to[start[v]:start[v + 1]]:
                nd = d + float(np.linalg.norm(co[q] - co[v]))
                if nd < dist[q] and nd <= reach:
                    dist[q] = nd; heapq.heappush(heap, (nd, q))
        return dist

    def seed(self, spec, tree):
        """A vertex under a view-space point, cast from that side; or the vertex nearest a 3D point."""
        kind = spec[0]
        if kind == "point":
            p = np.array(spec[1:])
        else:
            a, b = spec[1], spec[2]
            origin, direction = {"front": (Vector((a, -2.0, b)), Vector((0, 1, 0))),
                                 "back": (Vector((a, 2.0, b)), Vector((0, -1, 0))),
                                 "left": (Vector((2.0, a, b)), Vector((-1, 0, 0))),
                                 "right": (Vector((-2.0, a, b)), Vector((1, 0, 0)))}[kind]
            hit, _, face, _ = tree.ray_cast(origin, direction)
            if hit is None:
                raise SystemExit("refine-male-body: no surface under %r" % (spec,))
            p = np.array(hit)
        return int(np.argmin(np.linalg.norm(self.co - p, axis=1)))


def falloff(d, inner, outer):
    """1 within `inner`, easing to 0 at `outer` (smoothstep)."""
    t = np.clip((outer - d) / max(outer - inner, 1e-9), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def window(z, lo, hi, fade):
    return falloff(np.maximum(lo - z, z - hi).clip(min=0), 0.0, fade)


# ----------------------------------------------------------------- steps

def smooth_detail(surface, forms, w, iterations, name):
    """Smooths, where `w` > 0, the detail riding on the forms (surface − forms)."""
    before = surface.co.copy()
    surface.co = forms + surface.smooth(surface.co - forms, iterations, weight=w)
    moved = np.linalg.norm(surface.co - before, axis=1)
    log("%-22s %6d vertices, moved up to %.4f (mean %.4f where touched)" % (
        name, int((w > 0).sum()), moved.max(), moved[w > 0].mean()))


def seeded(surface, tree, zone):
    seeds = [surface.seed(s, tree) for s in zone["seeds"]]
    return falloff(surface.geodesic(seeds, zone["outer"]), zone["inner"], zone["outer"])


def ellipsoid(surface, tree, zone):
    e = np.sqrt((((surface.co - np.array(zone["centre"])) / np.array(zone["axes"])) ** 2).sum(1))
    near = np.isfinite(surface.geodesic([surface.seed(zone["seed"], tree)], zone["reach"]))
    return falloff(e, 0.55, 1.0) * near


def forearm_mask(surface, tree):
    total = np.zeros(surface.n)
    for arm in FOREARMS:
        elbow = surface.seed(arm["elbow"], tree)
        member = np.isfinite(surface.geodesic([elbow], FOREARM["reach"]))
        member &= np.abs(surface.co[:, 0]) > FOREARM["outboard"]           # not the waist, reached through the armpit
        total = np.maximum(total, member * window(surface.co[:, 2], *FOREARM["z_full"], FOREARM["z_fade"]))
    return total


def soften_nipples(surface, tree):
    seeds = [surface.seed(s, tree) for s in NIPPLES["seeds"]]
    w = falloff(surface.geodesic(seeds, NIPPLES["outer"]), NIPPLES["inner"], NIPPLES["outer"])
    flat = surface.smooth(surface.co, NIPPLES["iterations"], weight=w)
    surface.co = surface.co + (1 - NIPPLES["keep"]) * w[:, None] * (flat - surface.co)
    log("nipples                %6d vertices, lowered to %d%%" % (int((w > 0).sum()), NIPPLES["keep"] * 100))


def deepen_back(surface, tree):
    """Deepens the back's own relief at muscle scale; swellings more than grooves."""
    co, b = surface.co, BACK
    n = surface.normals(co)
    arm = np.zeros(surface.n)
    for a in FOREARMS:
        arm = np.maximum(arm, np.isfinite(surface.geodesic([surface.seed(a["elbow"], tree)], b["arm_reach"])))
    arm = surface.smooth(arm.astype(float), 12)                          # a soft edge where the arm meets the back
    facing = falloff(-n[:, 1], -b["facing"][1], -b["facing"][0])
    w = window(co[:, 2], *b["z_full"], b["z_fade"]) * facing * (1 - np.clip(arm * 1.5, 0, 1))
    w_thigh = (window(co[:, 2], *b["thigh_z_full"], b["thigh_z_fade"]) * facing
               * falloff(-np.abs(co[:, 0]), -b["thigh_midline"][1], -b["thigh_midline"][0]))   # not into the crotch
    fine = surface.smooth(co, b["fine"])
    broad = surface.smooth(fine, b["broad"] - b["fine"])
    relief = np.einsum("ij,ij->i", fine - broad, n)
    relief -= surface.smooth(relief, b["bias"])                          # the slow part is curvature, not anatomy
    up = relief > 0
    push = (w * (np.where(up, b["gain_up"], b["gain_down"]) - 1.0)
            + w_thigh * (np.where(up, b["thigh_gain_up"], b["thigh_gain_down"]) - 1.0)) * relief
    push = surface.smooth(push, 6)                                       # no abrupt steps for thin triangles to fold on
    # Where deepening would fold the surface (a tight crease, as behind the
    # armpit, whose two sides it pushes together), leave that spot as it was.
    before = surface.folds(co)
    reverted = np.zeros(surface.n, bool)
    for _ in range(4):
        new = surface.folds(co + push[:, None] * n) & ~before
        if not new.any(): break
        hit = np.zeros(surface.n, bool); hit[surface.tris[surface.pairs[new]].ravel()] = True
        spot = surface.ring(hit, 3)
        reverted |= spot
        push[spot] = 0.0
    surface.co = co + push[:, None] * n
    log("back                   %6d vertices (and %d on the thighs), moved up to %.4f; %d left as they were to avoid folds" % (
        int((w > 0.01).sum()), int((w_thigh > 0.01).sum()), np.abs(push).max(), int(reverted.sum())))


# ------------------------------------------------------------------ neck

def fracture_height(u, v, rng):
    """The break's relief above its oblique base plane (source units), from
    the plane's lateral (u) and front-to-back (v, + to the back) axes. The
    stone split in two stages: a lower front-right plane and a back-left one
    standing ~1.3 cm higher, joined by a wandering riser; each is broken into
    a few angular facets."""
    riser = 0.62 * u + 0.78 * v - 0.010 + 0.010 * np.sin(u / 0.03)
    upper = 1 / (1 + np.exp(-riser / 0.0025))
    h = upper * (0.015 + 0.012 * u - 0.008 * v) + (1 - upper) * (-0.002 - 0.006 * u + 0.004 * v)
    k = 9
    su, sv = rng.uniform(-0.09, 0.09, k), rng.uniform(-0.09, 0.09, k)
    a = rng.uniform(-0.0022, 0.0022, k)
    gu, gv = rng.uniform(-0.09, 0.09, k), rng.uniform(-0.09, 0.09, k)
    d = np.sqrt((u[:, None] - su) ** 2 + (v[:, None] - sv) ** 2)
    wts = np.exp(-(d - d.min(1, keepdims=True)) / 0.0025); wts /= wts.sum(1, keepdims=True)
    h += (wts * (a + gu * (u[:, None] - su) + gv * (v[:, None] - sv))).sum(1)
    # The front of the old collar dipped lowest: keep the break below it there.
    h = np.minimum(h, 0.003 + 0.12 * np.maximum(v + 0.02, 0))
    return np.clip(h, -0.008, 0.022)


def break_neck(me):
    """Replaces the neck's crumpled top with a fracture surface."""
    nk = NECK
    front = np.array([0.0, *nk["front"]]); back = np.array([0.0, *nk["back"]])
    t = back - front
    n = np.cross([1.0, 0, 0], t); n /= np.linalg.norm(n)
    tilt = math.radians(nk["lateral_tilt_deg"])                              # a little higher on the figure's right
    n = np.array([n[0] * math.cos(tilt) + n[2] * math.sin(tilt), n[1], -n[0] * math.sin(tilt) + n[2] * math.cos(tilt)])
    n /= np.linalg.norm(n)
    eu = np.array([1.0, 0, 0]) - n[0] * n; eu /= np.linalg.norm(eu)
    ev = np.cross(n, eu)
    if np.dot(back - front, ev) < 0: ev = -ev                                # v grows towards the back
    origin = (front + back) / 2
    rng = np.random.default_rng(nk["seed"])
    fracture_seed = rng.integers(1 << 30)

    bm = bmesh.new(); bm.from_mesh(me)
    co = np.array([v.co[:] for v in bm.verts])
    rel = co - origin
    u, v, hgt = rel @ eu, rel @ ev, rel @ n
    h = fracture_height(u, v, np.random.default_rng(fracture_seed))
    radial = np.sqrt(u ** 2 + v ** 2)
    in_region = (radial < nk["region"]) & (hgt > -nk["keep_below"])
    # Safety: where the region ends the surface must be well below the break,
    # or the cut would open a hole in the shoulders.
    ring = (radial > nk["region"] - 0.012) & (radial < nk["region"]) & (hgt > -nk["keep_below"])
    if ring.any() and (hgt - h)[ring].max() > -0.004:
        raise SystemExit("refine-male-body: the neck break would reach the shoulders (%.4f)" % (hgt - h)[ring].max())
    removed = in_region & (hgt > h)
    far = removed & (radial > 0.095)
    if far.any():
        log("neck: %d removed vertices beyond radius 0.095; furthest at %s (radius %.3f)" % (
            int(far.sum()), np.round(co[far][np.argmax(radial[far])], 3).tolist(), radial[far].max()))
    if radial[removed].max() > 0.125:                                        # the neck's corners reach ~0.11
        raise SystemExit("refine-male-body: the neck break would cut beyond the neck (radius %.3f)" % radial[removed].max())
    # Flatten the fracture surface into the plane (a shear along n), cut, cap, shear back.
    sheared = co - h[:, None] * n
    for bv, p in zip(bm.verts, sheared): bv.co = p
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    # (Everything handed to bmesh goes in index order, so a run always builds the same mesh.)
    region_faces = [f for f in bm.faces if all(in_region[x.index] for x in f.verts)]
    by_index = lambda items: sorted(items, key=lambda x: x.index)
    geom = (by_index({e for f in region_faces for e in f.edges}) + region_faces
            + by_index({x for f in region_faces for x in f.verts}))
    res = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-7, plane_co=origin, plane_no=n, clear_outer=True)
    bm.verts.index_update(); bm.edges.index_update()
    rim_edges = by_index(e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge) and e.is_boundary)
    if len(rim_edges) < 20:
        raise SystemExit("refine-male-body: the neck cut left no rim")
    rim_verts = {x for e in rim_edges for x in e.verts}
    start = min(rim_verts, key=lambda x: (round((x.co - Vector(origin)).dot(Vector(ev)), 6), x.index))   # its front-most point
    loop = [start]
    rim_set = set(rim_edges)
    while True:
        last = loop[-1]
        nxt = [e.other_vert(last) for e in last.link_edges if e in rim_set and e.other_vert(last) not in loop[-2:]]
        if not nxt or nxt[0] is loop[0]: break
        loop.append(nxt[0])
    if len(loop) != len(rim_edges):
        raise SystemExit("refine-male-body: the neck rim is not one loop (%d of %d edges)" % (len(loop), len(rim_edges)))
    # The cap, in the plane: the rim plus a jittered grid inside it, triangulated (constrained Delaunay).
    uv_rim = [((x.co - Vector(origin)).dot(Vector(eu)), (x.co - Vector(origin)).dot(Vector(ev))) for x in loop]
    poly = np.array(uv_rim)
    s = nk["spacing"]
    gu, gv = np.meshgrid(np.arange(poly[:, 0].min(), poly[:, 0].max(), s), np.arange(poly[:, 1].min(), poly[:, 1].max(), s * 0.866))
    gu = gu + (np.arange(gu.shape[0])[:, None] % 2) * s / 2
    pts = np.stack([gu.ravel(), gv.ravel()], 1) + rng.uniform(-0.18, 0.18, (gu.size, 2)) * s
    inside = np.array([_inside(p, poly) for p in pts])
    pts = pts[inside]
    near_rim = np.array([np.min(np.hypot(*(poly - p).T)) for p in pts]) if len(pts) else np.array([])
    pts = pts[near_rim > 0.55 * s]
    verts2d = [Vector(p) for p in uv_rim] + [Vector(p) for p in pts]
    out = delaunay_2d_cdt(verts2d, [], [list(range(len(uv_rim)))], 1, 1e-9, True)
    out_co, _, out_faces, orig_verts = out[0], out[1], out[2], out[3]
    bverts = []
    for i, c in enumerate(out_co):
        src = orig_verts[i]
        if src and src[0] < len(loop):
            bverts.append(loop[src[0]])
        else:
            p = Vector(origin) + Vector(eu) * c[0] + Vector(ev) * c[1]
            bverts.append(bm.verts.new(p))
    made, cap_faces = 0, []
    for f in out_faces:
        tri = [bverts[i] for i in f]
        if len(set(tri)) < 3: continue
        normal = (tri[1].co - tri[0].co).cross(tri[2].co - tri[0].co)
        if normal.dot(Vector(n)) < 0: tri = [tri[0], tri[2], tri[1]]
        try:
            cap_faces.append(bm.faces.new(tri)); made += 1
        except ValueError:
            pass
    for f in bm.faces: f.smooth = True
    for e in rim_edges: e.smooth = False     # a sharp rim: the break and the neck each keep their own shading
    # Shear back: the cap lifts onto the fracture surface, the rest returns.
    bm.verts.ensure_lookup_table()
    allco = np.array([x.co[:] for x in bm.verts])
    rel = allco - origin
    back_h = fracture_height(rel @ eu, rel @ ev, np.random.default_rng(fracture_seed))
    for bv, p in zip(bm.verts, allco + back_h[:, None] * n): bv.co = p
    # Chips out of the rim, where a flake of stone came away: a smooth scoop
    # into both the break and the neck below it. Every point of a chip moves
    # the same way (inwards and down, diagonally across the rim), by an amount
    # easing out from its centre, so no triangle can fold over.
    rim_co = np.array([x.co[:] for x in loop])
    centre = rim_co.mean(0)
    allco = np.array([x.co[:] for x in bm.verts])
    shift = np.zeros_like(allco)
    for angle_deg, radius, depth in ((230.0, 0.030, 0.0090), (35.0, 0.020, 0.0060), (130.0, 0.018, 0.0050)):
        a = math.radians(angle_deg)
        target = centre + 0.2 * (math.cos(a) * eu + math.sin(a) * ev)
        rp = rim_co[np.argmin(np.linalg.norm(rim_co - target, axis=1))]
        inward = centre - rp; inward -= np.dot(inward, n) * n; inward /= np.linalg.norm(inward)
        direction = (inward - n) / math.sqrt(2)
        reach = np.clip(np.linalg.norm(allco - rp, axis=1) / radius, 0, 1)
        amount = depth * (1 - reach ** 2) ** 2
        take = amount > np.linalg.norm(shift, axis=1)
        shift[take] = amount[take, None] * direction
    for i in np.where(np.abs(shift).sum(1) > 0)[0]:
        bm.verts[i].co = Vector(allco[i] + shift[i])
    # Crisp edges where the break turns sharply (the riser, facet ridges).
    for f in cap_faces: f.normal_update()
    for e in {e for f in cap_faces for e in f.edges}:
        if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > math.radians(32):
            e.smooth = False
    bm.normal_update()
    bm.to_mesh(me); bm.free()
    me.update()
    log("neck                   rim of %d vertices, cap of %d triangles, break tilted %.1f deg front to back" % (
        len(loop), made, math.degrees(math.atan2(t[2], t[1]))))


def _inside(p, poly):
    x, y = p; inside = False; j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]; xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


# -------------------------------------------------------------- material

def stone_material(me):
    mat = bpy.data.materials.new("atlas-stone")
    mat.diffuse_color = (0.62, 0.62, 0.61, 1.0)
    mat.roughness = 0.9
    mat.metallic = 0.0
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.62, 0.62, 0.61, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.9
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = 0.15
    me.materials.clear()
    me.materials.append(mat)


# ------------------------------------------------------------------ main

def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = dict(zip(args[::2], args[1::2]))
    if len(args) % 2 or set(opts) - {"--source", "--out"}:
        raise SystemExit("refine-male-body: unknown arguments %s; it takes only --source <path> and --out <path> "
                         "(there is no --force: see refine_guard.py)" % " ".join(args))
    source = opts.get("--source")
    out = os.path.abspath(opts.get("--out", TARGET))
    checked = guard.check_target(out)
    obj, me = load_original(source)
    log("original: %d vertices, %d triangles" % (len(me.vertices), len(me.polygons)))

    # Normals: the custom normals are the smooth normals; drop them so edits shade from their shape.
    if "custom_normal" in me.attributes:
        me.attributes.remove(me.attributes["custom_normal"])
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))

    surface = Surface(me)
    tree = BVHTree.FromPolygons([tuple(p) for p in surface.co], [tuple(t) for t in surface.tris])
    forms = surface.smooth(surface.co, DETAIL_BAND)
    broad_forms = surface.smooth(forms, TEAR_LEFT_DELTOID["band"] - DETAIL_BAND)
    smooth_detail(surface, broad_forms, ellipsoid(surface, tree, TEAR_LEFT_DELTOID), TEAR_LEFT_DELTOID["iterations"],
                  "tear, left deltoid")
    for zone, name in ((LUMPS_LEFT_ARMPIT, "lumps, left armpit"), (CRACK_RIGHT_SHOULDER, "crack, right shoulder"),
                       (VEIN_RIGHT_BICEPS, "vein, right biceps")):
        smooth_detail(surface, forms, seeded(surface, tree, zone), zone["iterations"], name)
    smooth_detail(surface, forms, forearm_mask(surface, tree), FOREARM["iterations"], "forearms")
    soften_nipples(surface, tree)
    deepen_back(surface, tree)
    me.vertices.foreach_set("co", surface.co.ravel())
    me.update()

    break_neck(me)
    stone_material(me)
    me["atlas_refinement"] = VERSION
    me["atlas_floor_to_neck"] = FLOOR_TO_NECK
    me["atlas_refinement_geometry"] = geometry_hash(me)
    # The generator's material and its packed textures (~22 MB) are unused now; don't save them.
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
    bpy.context.preferences.filepaths.save_version = 0
    guard.check_unchanged(out, checked)
    bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
    guard.write_record(out, script=VERSION, source=ORIGINAL_GIT, source_sha256=ORIGINAL_SHA256,
                       geometry=me["atlas_refinement_geometry"])
    log("wrote %s: %d vertices, %d faces" % (out, len(me.vertices), len(me.polygons)))


main()
