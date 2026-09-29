"""
Atelier — the modelling tools the first pass of the ATLAS torso study was
made with. PROVENANCE, NOT SOURCE.

The source of the sculpture is the Blender file
assets/anatomy/torso-study.blend: an editable quad cage (mirror + subdivision
modifiers, edge creases, one material per anatomical region). This module and
torso_study.py record how that cage was first laid out, the way a modeller's
notes would. Edit the .blend, not these scripts; re-running them overwrites
hand edits.

How the cage is made:

  1. A LAYOUT: named nodes (anatomical points: the jugular notch, the
     acromion, the deltoid's insertion...) joined by edges (the borders of
     muscles, tendons and bones), each a curve placed by hand through a few
     via points and given a number of cage segments.
  2. PATCHES: every region is one or more four-sided patches bounded by
     layout edges. A patch is filled with rows of quads running across the
     muscle's fibres, from its origin to its insertion, so the edge loops
     follow the borders and the fibres. Where a fan narrows (the deltoid's V,
     the pectoral's tendon) rows lose vertices and a few triangles appear.
  3. RIDGES and PINS: curves and points placed inside a patch (the crest of
     a belly, the crest of the clavicle, a hollow) that fix cage vertices.
  4. FAIRING: every vertex not on a curve is placed by minimising the
     change of curvature (a discrete thin-plate surface), so the surface
     between the placed curves is taut, not inflated. Creased borders are
     decoupled, which lets a groove turn sharply.
  5. FITTING: the cage is moved until its Catmull-Clark limit surface passes
     through the placed and faired positions (in Blender, torso_study.py).

Units are centimetres in ATLAS axes: y up (floor 0), +x the figure's left,
+z its front. Only the figure's left half is authored; the mirror modifier
makes the right.
"""

import math
import numpy as np


# ----------------------------------------------------------------- vectors

def unit(a):
    a = np.asarray(a, float)
    return a / np.linalg.norm(a)


# ------------------------------------------------------------------ frames

class Cyl:
    """A cylindrical frame: `phi` degrees round an axis (0 = front, 90 =
    `left`), `t` along it (a fraction of `length`), `r` cm from it."""

    def __init__(self, origin, axis, front, left, length=1.0):
        self.o = np.asarray(origin, float)
        self.u = unit(axis)
        f = np.asarray(front, float)
        self.f = unit(f - self.u * f.dot(self.u))
        l = np.asarray(left, float)
        l = l - self.u * l.dot(self.u) - self.f * l.dot(self.f)
        self.l = unit(l)
        self.length = float(length)

    def point(self, phi, t, r):
        a = math.radians(phi)
        return self.o + self.u * (t * self.length) + r * (math.cos(a) * self.f + math.sin(a) * self.l)

    def param(self, p):
        d = np.asarray(p, float) - self.o
        along = d.dot(self.u)
        rad = d - self.u * along
        phi = math.degrees(math.atan2(rad.dot(self.l), rad.dot(self.f)))
        return np.array([phi, along / self.length, np.linalg.norm(rad)])

    def unparam(self, q):
        return self.point(q[0], q[1], q[2])

    def unwrap(self, qs):
        """Angles made continuous along a sequence of params."""
        qs = [np.array(q, float) for q in qs]
        for i in range(1, len(qs)):
            while qs[i][0] - qs[i - 1][0] > 180: qs[i][0] -= 360
            while qs[i][0] - qs[i - 1][0] < -180: qs[i][0] += 360
        return qs


class Sph:
    """A spherical frame about `center`: a direction and a radius."""

    def __init__(self, center):
        self.c = np.asarray(center, float)

    def param(self, p):
        d = np.asarray(p, float) - self.c
        r = np.linalg.norm(d)
        return np.concatenate([d / r, [r]])

    def unparam(self, q):
        return self.c + unit(q[:3]) * q[3]

    def unwrap(self, qs):
        return [np.array(q, float) for q in qs]


# --------------------------------------------------------------- sections

def _hermite(xs, ys, x, periodic=False):
    """Catmull-Rom (cardinal) interpolation through (xs, ys) at x."""
    xs, ys = np.asarray(xs, float), np.asarray(ys, float)
    n = len(xs)
    if periodic:
        span = 360.0
        x = xs[0] + (x - xs[0]) % span
        xs = np.concatenate([xs[-2:] - span, xs, xs[:2] + span])
        ys = np.concatenate([ys[-2:], ys, ys[:2]])
    else:
        x = min(max(x, xs[0]), xs[-1])
        xs = np.concatenate([[2 * xs[0] - xs[1]], xs, [2 * xs[-1] - xs[-2]]])
        ys = np.concatenate([[2 * ys[0] - ys[1]], ys, [2 * ys[-1] - ys[-2]]])
    i = int(np.searchsorted(xs, x, side="right")) - 1
    i = min(max(i, 1), len(xs) - 3)
    x0, x1, x2, x3 = xs[i - 1:i + 3]
    y0, y1, y2, y3 = ys[i - 1:i + 3]
    h = x2 - x1
    t = (x - x1) / h
    m1 = (y2 - y0) / (x2 - x0) * h
    m2 = (y3 - y1) / (x3 - x1) * h
    t2, t3 = t * t, t * t * t
    return (2 * t3 - 3 * t2 + 1) * y1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * y2 + (t3 - t2) * m2


class Sections:
    """A limb described the way a sculptor measures one: its radius round
    an axis (`frame`) every 30 degrees, at a series of levels t."""

    def __init__(self, frame, sections):
        self.frame = frame
        self.ts = [float(t) for t, _ in sections]
        self.rows = [list(map(float, rs)) for _, rs in sections]
        self.phis = [30.0 * k for k in range(len(self.rows[0]))]

    def radius(self, phi, t):
        per_row = [_hermite(self.phis, row, phi, periodic=True) for row in self.rows]
        return float(_hermite(self.ts, per_row, t))

    def point(self, phi, t, dr=0.0):
        return self.frame.point(phi, t, self.radius(phi, t) + dr)

    def project(self, p, dr=0.0):
        phi, t, _ = self.frame.param(p)
        return self.point(phi, t, dr)


class Limb:
    """An arm: sections round the upper arm and round the forearm, blended
    across the elbow."""

    def __init__(self, upper, fore, blend=0.05):
        self.upper, self.fore, self.blend = upper, fore, blend

    def project(self, p, dr=0.0):
        tf = self.fore.frame.param(p)[1]
        if tf >= self.blend:
            return self.fore.project(p, dr)
        if tf <= -self.blend:
            return self.upper.project(p, dr)
        w = (tf + self.blend) / (2 * self.blend)
        w = w * w * (3 - 2 * w)
        return (1 - w) * self.upper.project(p, dr) + w * self.fore.project(p, dr)


# ------------------------------------------------------------------ curves

def catmull_rom(points, per_span=32):
    """A uniform Catmull-Rom curve through `points` (k x d), densely sampled."""
    P = np.asarray(points, float)
    if len(P) == 2:
        return np.linspace(P[0], P[1], per_span + 1)
    ext = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = [P[0]]
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for s in range(1, per_span + 1):
            t = s / per_span
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    return np.array(out)


def resample(dense, n):
    """n+1 points spaced evenly by arc length along a dense polyline."""
    seg = np.linalg.norm(np.diff(dense, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    targets = np.linspace(0, s[-1], n + 1)
    out = np.empty((n + 1, dense.shape[1]))
    for k in range(dense.shape[1]):
        out[:, k] = np.interp(targets, s, dense[:, k])
    return out


def curve(points, frame=None, per_span=32):
    """A dense 3D curve through `points`, interpolated in `frame`'s
    coordinates (so a curve between two points on a limb follows the limb
    round instead of cutting through it), or straight in 3D."""
    pts = [np.asarray(p, float) for p in points]
    if frame is None:
        return catmull_rom(pts, per_span)
    qs = frame.unwrap([frame.param(p) for p in pts])
    dense_q = catmull_rom(qs, per_span)
    return np.array([frame.unparam(q) for q in dense_q])


# ------------------------------------------------------------------ layout

class Layout:
    """Nodes, the edges between them, and the patches the edges bound."""

    def __init__(self):
        self.nodes = {}           # name -> position
        self.edges = {}           # frozenset(a, b) -> Edge
        self.patches = []
        self.bands = []

    def node(self, name, p):
        if name in self.nodes:
            raise ValueError("node defined twice: " + name)
        self.nodes[name] = np.asarray(p, float)
        return self.nodes[name]

    def edge(self, a, b, n, via=(), frame=None, crease=0.0, mid=False, guide=None, dr=0.0):
        """An edge from node a to node b in n cage segments, through `via`
        points, interpolated in `frame`. `crease` is the subdivision crease
        (0 smooth ... 1 sharp); `mid` marks an edge on the midline."""
        key = frozenset((a, b))
        if key in self.edges:
            raise ValueError("edge defined twice: %s-%s" % (a, b))
        for x in (a, b):
            if x not in self.nodes:
                raise ValueError("edge %s-%s: unknown node %s" % (a, b, x))
        e = Edge(a, b, n, [np.asarray(v, float) for v in via], frame, crease, mid, guide, dr)
        self.edges[key] = e
        return e

    def teeth(self, upper, lower, region_up, region_down, crease=0.5, name="teeth"):
        """Interlocking teeth between two regions, in a band between two
        edges with the same number of segments: `upper` (a -> b) and
        `lower` (c -> d), a above c and b above d. Each step is two
        triangles, one tooth of each region pointing into the other."""
        self.bands.append(dict(upper=upper, lower=lower, up=region_up, down=region_down,
                               crease=crease, name=name))

    def patch(self, region, cycle, corners, ridges=(), pins=(), rows=(), name=None, flat=None, widths=None,
              guide=None):
        """A patch of `region` bounded by the node `cycle`. `corners` are
        (c0, c1, c2, c3): side 1 runs c0 -> c1 (the origin row), rail B
        c1 -> c2, side 3 c2 -> c3 (the insertion row), rail A c3 -> c0. A
        side may be a single node (c0 == c1 or c2 == c3): the rows then
        close to a point, like a fan to its tendon."""
        p = Patch(region, list(cycle), tuple(corners), list(ridges), list(pins), list(rows),
                  name or region, flat, widths)
        p.guide = guide
        self.patches.append(p)
        return p


class Edge:
    def __init__(self, a, b, n, via, frame, crease, mid, guide=None, dr=0.0):
        self.a, self.b, self.n = a, b, int(n)
        self.via, self.frame, self.crease, self.mid = via, frame, float(crease), mid
        self.guide, self.dr = guide, float(dr)
        self.points = None        # n+1 positions, a -> b
        self.ids = None           # n+1 vertex ids, a -> b

    def sample(self, nodes):
        a, b = nodes[self.a], nodes[self.b]
        chord = b - a
        # Via points in order from a to b, whichever way they were written.
        via = sorted(self.via, key=lambda v: float(np.dot(v - a, chord)))
        dense = curve([a] + via + [b], self.frame)
        if self.guide is not None:
            # Onto the limb's sections, easing in from each end (an end may be bone).
            seg = np.linalg.norm(np.diff(dense, axis=0), axis=1)
            s = np.concatenate([[0], np.cumsum(seg)]) / max(seg.sum(), 1e-9)
            w = np.clip(np.minimum(s, 1 - s) / 0.15, 0, 1)
            w = w * w * (3 - 2 * w)
            proj = np.array([self.guide.project(q, self.dr) for q in dense])
            dense = dense + (proj - dense) * w[:, None]
        self.points = resample(dense, self.n)
        self.points[0], self.points[-1] = a, b
        seg = np.linalg.norm(np.diff(self.points, axis=0), axis=1)
        if self.n > 1 and seg.min() < 0.3 * seg.mean():
            raise ValueError("edge %s-%s doubles back on itself (segments %s)"
                             % (self.a, self.b, np.round(seg, 2)))


class Patch:
    def __init__(self, region, cycle, corners, ridges, pins, rows, name, flat, widths):
        self.region, self.cycle, self.corners = region, cycle, corners
        self.ridges, self.pins, self.rows_fixed = ridges, pins, rows
        self.name, self.flat, self.widths = name, flat, widths


# ------------------------------------------------------------ the cage mesh

class Cage:
    """The assembled cage: vertex positions, faces, which vertices are
    fixed (on a placed curve), the region of each face, the crease of each
    edge, and which vertices lie on the midline."""

    def __init__(self, layout):
        self.L = layout
        self.pos = []             # vertex positions
        self.fixed = []           # True where the position was placed
        self.faces = []           # vertex id lists
        self.face_region = []
        self.face_patch = []
        self.crease = {}          # (i, j) i<j -> crease weight
        self.node_id = {}
        self.midline = set()
        self.patch_rows = {}      # patch name -> list of rows (vertex id lists)
        self.lifts = []           # (vertex id, cm): raised off the faired membrane
        self.guided = {}          # vertex id -> guide it is drawn to
        self._crest_pairs = []    # (a, b, crease) along ridges, applied where they share an edge
        self._build()
        self._orient()

    def _vertex(self, p, fixed):
        self.pos.append(np.asarray(p, float))
        self.fixed.append(fixed)
        return len(self.pos) - 1

    def _build(self):
        L = self.L
        for name, p in L.nodes.items():
            self.node_id[name] = self._vertex(p, True)
        for e in L.edges.values():
            e.sample(L.nodes)
            ids = [self.node_id[e.a]]
            for k in range(1, e.n):
                ids.append(self._vertex(e.points[k], True))
            ids.append(self.node_id[e.b])
            e.ids = ids
            for i, j in zip(ids[:-1], ids[1:]):
                self.crease[(min(i, j), max(i, j))] = e.crease
            if e.mid:
                self.midline.update(ids)
        for p in L.patches:
            self._fill(p)
        for b in L.bands:
            self._band(b)
        edges = set()
        for f in self.faces:
            for a, b in zip(f, f[1:] + f[:1]):
                edges.add((min(a, b), max(a, b)))
        for a, b, c in self._crest_pairs:
            k = (min(a, b), max(a, b))
            if k in edges:
                self.crease[k] = max(self.crease.get(k, 0.0), c)

    def _band(self, b):
        U, D = self.chain(list(b["upper"])), self.chain(list(b["lower"]))
        if len(U) != len(D):
            raise ValueError("teeth %s: %d and %d segments" % (b["name"], len(U) - 1, len(D) - 1))
        for i in range(len(U) - 1):
            self.faces.append([U[i], U[i + 1], D[i + 1]]); self.face_region.append(b["up"])
            self.face_patch.append(b["name"])
            self.faces.append([U[i], D[i + 1], D[i]]); self.face_region.append(b["down"])
            self.face_patch.append(b["name"])
            for a, c in ((U[i], D[i + 1]), (U[i + 1], D[i + 1])):
                self.crease[(min(a, c), max(a, c))] = b["crease"]

    def _orient(self):
        """Winds every face the same way round, outward (the chest faces +z)."""
        edge_faces = {}
        for fi, f in enumerate(self.faces):
            for a, b in zip(f, f[1:] + f[:1]):
                edge_faces.setdefault((min(a, b), max(a, b)), []).append(fi)
        done = [False] * len(self.faces)
        for seed in range(len(self.faces)):
            if done[seed]:
                continue
            done[seed] = True
            stack = [seed]
            while stack:
                fi = stack.pop()
                f = self.faces[fi]
                for a, b in zip(f, f[1:] + f[:1]):
                    for gi in edge_faces[(min(a, b), max(a, b))]:
                        if done[gi]:
                            continue
                        g = self.faces[gi]
                        same = any((g[k], g[(k + 1) % len(g)]) == (a, b) for k in range(len(g)))
                        if same:
                            self.faces[gi] = g[::-1]
                        done[gi] = True
                        stack.append(gi)
        P = np.array(self.pos)
        nz = 0.0
        for f, r in zip(self.faces, self.face_region):
            if r == "pectoralis-major":
                nz += np.cross(P[f[1]] - P[f[0]], P[f[-1]] - P[f[0]])[2]
        if nz < 0:
            self.faces = [f[::-1] for f in self.faces]

    def normals(self):
        P = np.array(self.pos)
        N = np.zeros_like(P)
        for f in self.faces:
            for k in range(len(f)):
                a, b, c = f[k - 1], f[k], f[(k + 1) % len(f)]
                N[b] += np.cross(P[c] - P[b], P[a] - P[b])
        return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)

    def chain(self, names):
        """Vertex ids (and positions) along a path of nodes."""
        if len(names) == 1:
            return [self.node_id[names[0]]]
        ids = []
        for a, b in zip(names[:-1], names[1:]):
            e = self.L.edges.get(frozenset((a, b)))
            if e is None:
                raise ValueError("no edge %s-%s" % (a, b))
            seg = e.ids if e.a == a else e.ids[::-1]
            ids.extend(seg if not ids else seg[1:])
        return ids

    def _sides(self, p):
        cyc, (c0, c1, c2, c3) = p.cycle, p.corners
        n = len(cyc)

        def path(a, b):
            if a == b:
                return [a]
            i = cyc.index(a)
            out = [a]
            while True:
                i = (i + 1) % n
                out.append(cyc[i])
                if cyc[i] == b:
                    return out
                if len(out) > n + 1:
                    raise ValueError("patch %s: corner %s not after %s" % (p.name, b, a))
        sides = path(c0, c1), path(c1, c2), path(c2, c3), path(c3, c0)
        if sum(len(s) - 1 for s in sides) != n:
            raise ValueError("patch %s: corners %s are not in the order of its cycle %s"
                             % (p.name, p.corners, cyc))
        return sides

    def _fill(self, p):
        s1, rb, s3, ra = self._sides(p)
        A = self.chain(ra)[::-1]              # c0 -> c3
        B = self.chain(rb)                    # c1 -> c2
        if len(A) != len(B):
            raise ValueError("patch %s: rails have %d and %d segments (A %s, B %s)"
                             % (p.name, len(A) - 1, len(B) - 1, ra, rb))
        n = len(A) - 1
        row0 = self.chain(s1)                 # c0 -> c1
        rown = self.chain(s3)[::-1]           # c3 -> c2
        if row0[0] != A[0] or row0[-1] != B[0] or rown[0] != A[-1] or rown[-1] != B[-1]:
            raise ValueError("patch %s: sides do not meet the rails" % p.name)
        k1, k3 = len(row0) - 1, len(rown) - 1
        rows = [row0]
        for i in range(1, n):
            if p.widths:                              # segments across, from origin to insertion
                k = max(1, int(round(np.interp(i / n, np.linspace(0, 1, len(p.widths)), p.widths))))
            else:
                k = max(1, int(round(k1 + (k3 - k1) * i / n)))
            a, b = self.pos[A[i]], self.pos[B[i]]
            row = [A[i]] + [self._vertex(a + (b - a) * j / k, False) for j in range(1, k)] + [B[i]]
            rows.append(row)
        rows.append(rown)
        if getattr(p, "guide", None) is not None:
            for row in rows[1:-1]:
                for v in row[1:-1]:
                    self.guided[v] = p.guide
        for i in range(n):
            for f in zipper(rows[i], rows[i + 1]):
                self.faces.append(f)
                self.face_region.append(p.region)
                self.face_patch.append(p.name)
        self.patch_rows[p.name] = rows
        # Ridges: a curve from side 1 to side 3 fixing one vertex per row.
        for rg in p.ridges:
            frac = rg["across"]
            crest = []
            if "height" in rg:
                hs = np.asarray(rg["height"], float)
                prof = np.interp(np.arange(n + 1) / n, np.linspace(0, 1, len(hs)), hs)
            else:
                samp = resample(curve(rg["points"], rg.get("frame")), n)
            for i in range(1, n):
                row = rows[i]
                k = len(row) - 1
                if k < 2:
                    continue
                j = min(k - 1, max(1, int(round(frac * k))))
                crest.append(row[j])
                if "height" in rg:
                    self.lifts.append((row[j], float(prof[i])))
                else:
                    self.pos[row[j]] = samp[i].copy()
                    self.fixed[row[j]] = True
            if rg.get("crease"):
                for a, b in zip(crest[:-1], crest[1:]):
                    self._crest_pairs.append((a, b, float(rg["crease"])))
        # Pins: one vertex at (u along the rows, v across a row).
        for (u, v, point) in p.pins:
            i = min(n - 1, max(1, int(round(u * n))))
            row = rows[i]
            k = len(row) - 1
            if k < 2:
                raise ValueError("patch %s: pin at u=%.2f lands on a row with no inner vertex" % (p.name, u))
            j = min(k - 1, max(1, int(round(v * k))))
            if np.ndim(point) == 0:
                self.lifts.append((row[j], float(point)))
            else:
                self.pos[row[j]] = np.asarray(point, float)
                self.fixed[row[j]] = True
        # Row curves: every inner vertex of one row placed along a curve.
        for rc in p.rows_fixed:
            i = min(n - 1, max(1, int(round(rc["u"] * n))))
            row = rows[i]
            k = len(row) - 1
            pts = [self.pos[row[0]]] + [np.asarray(q, float) for q in rc["points"]] + [self.pos[row[-1]]]
            samp = resample(curve(pts, rc.get("frame")), k)
            for j in range(1, k):
                self.pos[row[j]] = samp[j].copy()
                self.fixed[row[j]] = True


def zipper(R, Q):
    """Faces between two rows of vertices (R then Q), quads where the rows
    step together and triangles, spread evenly, where one row has more."""
    k, m = len(R) - 1, len(Q) - 1
    faces = []
    if k == 0 and m == 0:
        return faces
    if k >= m:
        extra = k - m
        q = 0
        for p in range(k):
            merge = extra and (((p + 1) * extra) // k) > ((p * extra) // k)
            if merge or q >= m:
                faces.append([R[p], R[p + 1], Q[q]])
            else:
                faces.append([R[p], R[p + 1], Q[q + 1], Q[q]])
                q += 1
    else:
        extra = m - k
        p = 0
        for q in range(m):
            merge = ((q + 1) * extra) // m > (q * extra) // m
            if merge or p >= k:
                faces.append([R[p], Q[q + 1], Q[q]])
            else:
                faces.append([R[p], R[p + 1], Q[q + 1], Q[q]])
                p += 1
    return faces


# ----------------------------------------------------------------- fairing

CREASE_DECOUPLE = 0.35      # creases at least this sharp let the two sides turn independently


GUIDE_PULL = 0.25           # how strongly guided vertices keep to their sections (vs. smoothness)


def fair(cage):
    """Fairs the cage; vertices with a lift are then raised that far off the
    faired membrane along its normal, held, and the rest faired again.
    Vertices of guided patches are drawn to their limb's sections."""
    _fair(cage)
    for _ in range(3 if cage.guided else 0):
        _fair(cage, {v: g.project(cage.pos[v]) for v, g in cage.guided.items() if not cage.fixed[v]})
    if cage.lifts:
        N = cage.normals()
        for v, h in cage.lifts:
            cage.pos[v] = cage.pos[v] + h * N[v]
            cage.fixed[v] = True
        _fair(cage, {v: g.project(cage.pos[v]) for v, g in cage.guided.items() if not cage.fixed[v]})


def _fair(cage, pull=None):
    """Places every free vertex so the cage's change of curvature is least
    (the sum of squared umbrella Laplacians), with placed vertices held.

    The figure is symmetric about x = 0: a midline vertex sees its
    neighbours' mirror images too, so the halves meet smoothly (or, along a
    creased midline, in a groove). Along a creased border a vertex's
    curvature is measured along the border only, so the surfaces either side
    do not have to continue into each other."""
    P = np.array(cage.pos)
    N = len(P)
    nbr = [set() for _ in range(N)]
    for f in cage.faces:
        for a, b in zip(f, f[1:] + f[:1]):
            nbr[a].add(b)
            nbr[b].add(a)
    cn = [[] for _ in range(N)]
    for (i, j), c in cage.crease.items():
        if c >= CREASE_DECOUPLE:
            cn[i].append(j)
            cn[j].append(i)
    mid = cage.midline

    def operator(coord):
        K = np.zeros((N, N))
        for v in range(N):
            if coord == 0 and v in mid:
                continue                          # x is odd about the midline: no curvature row
            if len(cn[v]) >= 3:
                continue                          # a corner of creases
            if len(cn[v]) == 2:
                a, b = cn[v]
                K[v, a] += 0.5; K[v, b] += 0.5; K[v, v] -= 1.0
                continue
            ws = {}
            for w in nbr[v]:
                ws[w] = 1.0 if (v not in mid or w in mid) else 2.0
            tot = sum(ws.values())
            for w, wt in ws.items():
                K[v, w] += wt / tot
            K[v, v] -= 1.0
        return K

    fixed = np.array(cage.fixed)
    F, C = np.where(~fixed)[0], np.where(fixed)[0]
    if len(F) == 0:
        return
    Kx = operator(0)
    Kyz = operator(1)
    where = {v: k for k, v in enumerate(F)}
    for coord, K in ((0, Kx), (1, Kyz), (2, Kyz)):
        KF, KC = K[:, F], K[:, C]
        A = KF.T @ KF
        b = -KF.T @ (KC @ P[C, coord])
        for v, g in (pull or {}).items():
            k = where[v]
            A[k, k] += GUIDE_PULL
            b[k] += GUIDE_PULL * g[coord]
        P[F, coord] = np.linalg.solve(A + 1e-9 * np.eye(len(F)), b)
    for i in F:
        cage.pos[i] = P[i].copy()


# ----------------------------------------------------------------- reports

def report(cage):
    P = np.array(cage.pos)
    tris = sum(1 for f in cage.faces if len(f) == 3)
    quads = sum(1 for f in cage.faces if len(f) == 4)
    lens = []
    for f in cage.faces:
        for a, b in zip(f, f[1:] + f[:1]):
            lens.append(np.linalg.norm(P[a] - P[b]))
    lens = np.array(lens)
    per = {}
    for r in cage.face_region:
        per[r] = per.get(r, 0) + 1
    return {
        "vertices": len(P), "faces": len(cage.faces), "quads": quads, "triangles": tris,
        "fixed": int(np.sum(cage.fixed)), "edge_cm": [round(float(np.percentile(lens, q)), 2) for q in (0, 10, 50, 90, 100)],
        "regions": per,
    }


def check_manifold(cage):
    """Every cage edge is shared by two faces, except the midline (the
    mirror plane), where it has one."""
    use = {}
    for f in cage.faces:
        for a, b in zip(f, f[1:] + f[:1]):
            k = (min(a, b), max(a, b))
            use[k] = use.get(k, 0) + 1
    bad = []
    for k, c in use.items():
        on_mid = k[0] in cage.midline and k[1] in cage.midline
        if c > 2 or (c == 1 and not on_mid):
            bad.append((k, c))
    return bad
