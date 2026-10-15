"""Standalone test: a wall grid from two harmonic fields, phi (cut 0 -> dome 1)
and psi (along the cut, F 0 -> B 1, linear across the dome), inverted by Newton."""
import numpy as np, time
Hs, Hw, NG = 0.146, 0.096, 129
u1, u2 = 0.438, 0.612
def solve(phi, fixed, iters=40000):
    h = 1.0 / (NG - 1); cs, cw = 1 / (Hs * h) ** 2, 1 / (Hw * h) ** 2
    for it in range(iters):
        inner = (cs * (phi[2:, 1:-1] + phi[:-2, 1:-1]) + cw * (phi[1:-1, 2:] + phi[1:-1, :-2])) / (2 * (cs + cw))
        if it % 2000 == 0 and np.abs(inner - phi[1:-1, 1:-1]).max() < 1e-8: break
        phi[1:-1, 1:-1] = inner
    return phi
t0 = time.time()
g = np.linspace(0, 1, NG)
phi = np.zeros((NG, NG)); phi[-1, 1:-1] = 1.0
phi = solve(phi, None)
psi = np.zeros((NG, NG))
psi[:, 0] = u1 * (1 - g)            # front notch, s index rows: s=g
psi[0, :] = u1 + g * (u2 - u1)      # crotch
psi[:, -1] = u2 + g * (1 - u2)      # back notch
psi[-1, :] = g                      # dome
psi[1:-1, 1:-1] = 0.5
psi = solve(psi, None)
h = 1.0 / (NG - 1)
ps, pw = np.gradient(phi, h, h); qs, qw = np.gradient(psi, h, h)
def interp(A, s, w):
    x, y = np.clip(s, 0, 1) * (NG - 1), np.clip(w, 0, 1) * (NG - 1)
    i, j = min(int(x), NG - 2), min(int(y), NG - 2); fx, fy = x - i, y - j
    return A[i, j] * (1 - fx) * (1 - fy) + A[i + 1, j] * fx * (1 - fy) + A[i, j + 1] * (1 - fx) * fy + A[i + 1, j + 1] * fx * fy
def invert(f_t, q_t, guess):
    p = np.array(guess, float)
    for _ in range(60):
        r = np.array([interp(phi, *p) - f_t, interp(psi, *p) - q_t])
        if np.abs(r).max() < 1e-7: break
        J = np.array([[interp(ps, *p), interp(pw, *p)], [interp(qs, *p), interp(qw, *p)]])
        try: d = np.linalg.solve(J, -r)
        except np.linalg.LinAlgError: break
        lam = 1.0
        n = np.linalg.norm(d)
        if n > 0.05: d *= 0.05 / n
        p = np.clip(p + d, 0, 1)
    return p, np.abs(r).max()
U = np.linspace(0, 1, 321)[1:-1]
def bpt(t):
    return (1 - t / u1, 0.0) if t <= u1 else ((0.0, (t - u1) / (u2 - u1)) if t <= u2 else ((t - u2) / (1 - u2), 1.0))
PHI = [0.03] + list(np.linspace(0.08, 0.95, 14) ** 1.1) + [1.0]
grid = np.zeros((len(U), len(PHI) + 1, 2)); worst = 0
for i, t in enumerate(U):
    grid[i, 0] = bpt(t); p = grid[i, 0]
    for k, f in enumerate(PHI):
        if f >= 1.0: grid[i, k + 1] = (1.0, t); continue          # the dome: psi = w there
        p, r = invert(f, t, p); grid[i, k + 1] = p; worst = max(worst, r)
        if r > 1e-4: print("  residual %.1e at column %d (t %.3f) row %d (phi %.2f)" % (r, i, t, k + 1, f))
# flipped cells (signed area in (s, w) scaled to metres)
def area(a, b, c, d):
    P = np.array([a, b, c, d]) * [Hs, Hw]
    x, y = P[:, 0], P[:, 1]
    return 0.5 * (x[0]*y[1]-x[1]*y[0] + x[1]*y[2]-x[2]*y[1] + x[2]*y[3]-x[3]*y[2] + x[3]*y[0]-x[0]*y[3])
A = np.array([[area(grid[i, k], grid[i + 1, k], grid[i + 1, k + 1], grid[i, k + 1]) for k in range(len(PHI))] for i in range(len(U) - 1)])
sgn = np.sign(np.median(A))
print("solve+invert %.1fs; worst residual %.1e; cells %d, flipped %d, near-zero (<1e-9 m2) %d" % (
    time.time() - t0, worst, A.size, int((np.sign(A) == -sgn).sum()), int((np.abs(A) < 1e-9).sum())))
ends = grid[:, -1, 1]
print("dome ends monotonic:", bool(np.all(np.diff(ends) >= -1e-9)), " min cell %.2e max %.2e m2" % (np.abs(A).min(), np.abs(A).max()))

z = np.argwhere(np.abs(A) < 1e-9)
print("near-zero cells at (column, row):", z.tolist())
