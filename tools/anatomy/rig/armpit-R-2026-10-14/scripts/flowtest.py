"""Standalone test of the harmonic-flow column layout (no Blender needed)."""
import numpy as np, time
Hs, Hw, NG = 0.146, 0.096, 129
t0 = time.time()
phi = np.zeros((NG, NG)); phi[-1, 1:-1] = 1.0
h = 1.0 / (NG - 1); cs, cw = 1 / (Hs * h) ** 2, 1 / (Hw * h) ** 2
for it in range(40000):
    inner = (cs * (phi[2:, 1:-1] + phi[:-2, 1:-1]) + cw * (phi[1:-1, 2:] + phi[1:-1, :-2])) / (2 * (cs + cw))
    if it % 2000 == 0 and np.abs(inner - phi[1:-1, 1:-1]).max() < 1e-7: break
    phi[1:-1, 1:-1] = inner
gs, gw = np.gradient(phi, h, h)
def interp(A, s, w):
    x, y = np.clip(s, 0, 1) * (NG - 1), np.clip(w, 0, 1) * (NG - 1)
    i, j = min(int(x), NG - 2), min(int(y), NG - 2); fx, fy = x - i, y - j
    return A[i, j] * (1 - fx) * (1 - fy) + A[i + 1, j] * fx * (1 - fy) + A[i, j + 1] * (1 - fx) * fy + A[i + 1, j + 1] * fx * fy
def vel(q):
    a, b = interp(gs, *q), interp(gw, *q)
    g = np.array([a / Hs ** 2, b / Hw ** 2]); den = g[0] * a + g[1] * b
    return g / max(den, 1e-12)
def flow(s, w, levels, inset=1e-3):
    # start a hair inside the domain (on the boundary the field's gradient is one-sided)
    p = np.array([max(s, inset) if s < 0.5 else s, min(max(w, inset), 1 - inset)])
    out, lv = [], list(levels)
    for _ in range(20000):
        f = interp(phi, *p)
        while lv and f >= lv[0]: out.append(p.copy()); lv.pop(0)
        if not lv and (p[0] >= 1 - 1e-4 or f >= 0.999): break
        d = 0.003 if f < 0.9 else 0.0005
        q = np.clip(p + 0.5 * d * vel(p), 0, 1); p = np.clip(p + d * vel(q), 0, 1)
    return out, np.array([1.0, p[1]])
# boundary samples like the cut: front (w=0, s 1->0), crotch (s=0), back (w=1, s 0->1)
bs = [(1 - t, 0.0) for t in np.linspace(0.01, 1, 140)] + [(0.0, t) for t in np.linspace(0, 1, 40)[1:-1]] + [(t, 1.0) for t in np.linspace(0, 0.99, 140)]
PHI = list(np.linspace(0.08, 0.95, 14) ** 1.1)
ends = []; cross = 0; prev = None
for s, w in bs:
    pts, end = flow(s, w, [0.03] + PHI); ends.append(end[1])
print("solve+trace %.1fs; dome ends monotonic: %s; inversions %d; first/last %.3f %.3f" % (
    time.time() - t0, bool(np.all(np.diff(ends) >= -1e-9)), int((np.diff(ends) < -1e-9).sum()), ends[0], ends[-1]))
bad = np.flatnonzero(np.diff(ends) < -1e-9)
print("inversions at sample indices", bad[:20], [bs[i] for i in bad[:5]])
