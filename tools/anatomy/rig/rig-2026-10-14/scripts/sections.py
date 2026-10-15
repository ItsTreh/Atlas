"""Planar cross-sections of a closed mesh, and limb centrelines tracked by them.
Pure numpy; give it world positions, edges and the face/loop arrays."""
import numpy as np
from collections import defaultdict


class Mesh:
    def __init__(self, P, ev, ls, lt, lv, le):
        self.P, self.ev, self.ls, self.lt, self.lv, self.le = P, ev, ls, lt, lv, le
        self.face_of_loop = np.repeat(np.arange(len(ls)), lt)

    def section(self, o, n, near=None, radius=None):
        """Closed loops where the plane (o, n) cuts the mesh. Each loop: dict with
        points (k x 3, ordered), centroid (area centroid, 3D), area, the plane basis.
        `near`/`radius` restrict the cut to edges within `radius` of `near`."""
        P, ev = self.P, self.ev
        n = n / np.linalg.norm(n)
        s = (P - o) @ n
        s = np.where(s == 0, 1e-12, s)
        a, b = ev[:, 0], ev[:, 1]
        ce = s[a] * s[b] < 0
        if near is not None:
            mid = 0.5 * (P[a] + P[b])
            ce &= np.linalg.norm(mid - near, axis=1) < radius
        idx = np.flatnonzero(ce)
        if len(idx) < 3:
            return []
        t = s[a[idx]] / (s[a[idx]] - s[b[idx]])
        X = np.zeros((len(ev), 3)); X[idx] = P[a[idx]] + t[:, None] * (P[b[idx]] - P[a[idx]])
        lc = ce[self.le]
        loops_hit = np.flatnonzero(lc)
        f = self.face_of_loop[loops_hit]
        order = np.argsort(f, kind="stable"); f = f[order]; e = self.le[loops_hit][order]
        adj = defaultdict(list)
        k = 0
        while k < len(f) - 1:
            if f[k] == f[k + 1]:
                adj[e[k]].append(e[k + 1]); adj[e[k + 1]].append(e[k]); k += 2
            else:
                k += 1
        u = np.cross(n, [0, 0, 1.0]) if abs(n[2]) < 0.9 else np.cross(n, [1.0, 0, 0])
        u /= np.linalg.norm(u); v = np.cross(n, u)
        seen, out = set(), []
        for start in adj:
            if start in seen:
                continue
            chain = [start]; seen.add(start); prev = None; cur = start
            while True:
                nxt = [x for x in adj[cur] if x != prev and x not in seen]
                if not nxt:
                    break
                prev, cur = cur, nxt[0]; seen.add(cur); chain.append(cur)
            closed = start in adj[cur] and len(chain) > 2
            if not closed or len(chain) < 6:
                continue
            Q = X[chain]; q = np.c_[(Q - o) @ u, (Q - o) @ v]
            x0, y0 = q[:, 0], q[:, 1]; x1, y1 = np.roll(x0, -1), np.roll(y0, -1)
            cr = x0 * y1 - x1 * y0; A = 0.5 * cr.sum()
            if abs(A) < 1e-8:
                continue
            cx = ((x0 + x1) * cr).sum() / (6 * A); cy = ((y0 + y1) * cr).sum() / (6 * A)
            out.append({"points": Q, "q": q, "area": abs(A), "centroid": o + cx * u + cy * v, "c2": np.array([cx, cy]),
                        "u": u, "v": v, "n": n, "o": o, "perimeter": float(np.linalg.norm(np.diff(np.vstack([q, q[:1]]), axis=0), axis=1).sum())})
        return out

    def segments(self, o, n, near=None, radius=None):
        """Every face's cut segment (k x 2 x 3), open or closed outline alike."""
        P, ev = self.P, self.ev
        n = n / np.linalg.norm(n)
        s = (P - o) @ n; s = np.where(s == 0, 1e-12, s)
        a, b = ev[:, 0], ev[:, 1]
        ce = s[a] * s[b] < 0
        if near is not None:
            ce &= np.linalg.norm(0.5 * (P[a] + P[b]) - near, axis=1) < radius
        idx = np.flatnonzero(ce)
        t = s[a[idx]] / (s[a[idx]] - s[b[idx]])
        X = np.zeros((len(ev), 3)); X[idx] = P[a[idx]] + t[:, None] * (P[b[idx]] - P[a[idx]])
        lc = ce[self.le]; hit = np.flatnonzero(lc)
        f = self.face_of_loop[hit]; order = np.argsort(f, kind="stable"); f = f[order]; e = self.le[hit][order]
        pairs = [(e[k], e[k + 1]) for k in range(len(f) - 1) if f[k] == f[k + 1]]
        if not pairs: return np.zeros((0, 2, 3))
        pr = np.array(pairs); return np.stack([X[pr[:, 0]], X[pr[:, 1]]], 1)

    def loop_at(self, o, n, guess, radius=0.25):
        """The loop of the plane (o, n) that encloses `guess` (smallest such), or the nearest one."""
        L = self.section(o, n, near=guess, radius=radius)
        if not L:
            return None
        n_ = n / np.linalg.norm(n)
        best, best_area = None, 1e9
        for l in L:
            g = np.array([(guess - l["o"]) @ l["u"], (guess - l["o"]) @ l["v"]])
            if inside(l["q"], g) and l["area"] < best_area:
                best, best_area = l, l["area"]
        if best is None:
            best = min(L, key=lambda l: np.linalg.norm(l["centroid"] - guess))
        return best


def inside(q, p):
    x, y = q[:, 0], q[:, 1]; x1, y1 = np.roll(x, -1), np.roll(y, -1)
    c = ((y > p[1]) != (y1 > p[1])) & (p[0] < (x1 - x) * (p[1] - y) / np.where(y1 - y == 0, 1e-12, y1 - y) + x)
    return bool(c.sum() % 2)


def track(M, start, direction, step=0.01, n_max=120, max_jump=0.03, area_jump=1.8, smooth=4):
    """Follow a limb: slice perpendicular to the running direction, step to the next centroid.
    Stops when the loop vanishes, jumps sideways, or its area jumps (a merge)."""
    d = direction / np.linalg.norm(direction)
    pts, secs = [], []
    p = np.array(start, float)
    for i in range(n_max):
        l = M.loop_at(p, d, p)
        if l is None:
            break
        c = l["centroid"]
        if secs and (np.linalg.norm(c - pts[-1]) > max_jump + step or l["area"] > area_jump * secs[-1]["area"] or l["area"] < secs[-1]["area"] / area_jump):
            break
        pts.append(c); secs.append(l)
        if len(pts) >= 2:
            k = max(0, len(pts) - smooth)
            dd = pts[-1] - pts[k]
            if np.linalg.norm(dd) > 1e-6:
                d = 0.5 * d + 0.5 * dd / np.linalg.norm(dd); d /= np.linalg.norm(d)
        p = c + d * step
    return np.array(pts), secs


def extent(l, axis):
    """Extreme points of a loop along a direction: (min point, max point, width)."""
    Q = l["points"]; s = Q @ axis
    return Q[np.argmin(s)], Q[np.argmax(s)], float(s.max() - s.min())
