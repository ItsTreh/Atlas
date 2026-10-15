"""Finger joints, measured (exploration + result). Run after joints.py.
  Blender -b original/Male_Body.blend --python scripts/fingers.py
Writes out/fingers.json, renders/fingers.png.

Four fingers: each lies in its own plane across the hand. A cut through a
finger's centre shows it at full thickness; the planes are the four thickness
peaks of the first phalanx across the hand (the right index: read off the
aligned render, see below). In each plane the finger's outline is
followed from inside the palm, round the curl, to the tip: at every step the
centre between the nearest outline crossing on each side of the running
direction. MCP 1.5 cm before the finger leaves the palm;
PIP and DIP at 48 % and 78 % of MCP-to-tip, snapped to the sharpest bend within
8 mm, unless that makes the phalanges not shorten from base to tip (then the
plain proportions).
Thumb: in cuts across the hand every 5 mm, the separate small loop on the
radial, palm side, followed from where it first separates (taken as its MCP)
to where it ends (the tip); IP at 52 % between them; the CMC (base of the
first metacarpal) one typical metacarpal length (4.8 cm) back toward the
radial side of the wrist.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C, sections as S, viz as V
C.guard()
obj = bpy.data.objects["Mesh_0"]; me = obj.data; armo = bpy.data.objects["Armature.001"]; armo.hide_render = True
P = C.mesh_world(obj)
ev = np.empty(len(me.edges) * 2, np.int64); me.edges.foreach_get("vertices", ev); ev = ev.reshape(-1, 2)
ls, lt, lv = C.faces(me); le = np.empty(len(me.loops), np.int64); me.loops.foreach_get("edge_index", le)
M = S.Mesh(P, ev, ls, lt, lv, le)
J = {k: np.array(v) for k, v in json.load(open(os.path.join(C.SCRATCH, "out", "joints.json")))["joints"].items()}
def unit(v): return v / np.linalg.norm(v)
def upper_hull(x, y):
    pts = sorted(zip(x, y)); H = []
    for p in pts:
        while len(H) >= 2 and (H[-1][0] - H[-2][0]) * (p[1] - H[-2][1]) - (H[-1][1] - H[-2][1]) * (p[0] - H[-2][0]) >= 0: H.pop()
        H.append(p)
    H = np.array(H); return np.interp(x, H[:, 0], H[:, 1])
def runs(mask, xs, depth, gap=0.006):
    """Groove centres: runs of the mask, merged across gaps under `gap`; the three deepest kept."""
    rr, i = [], 0
    while i < len(mask):
        if mask[i]:
            j = i
            while j + 1 < len(mask) and mask[j + 1]: j += 1
            rr.append([i, j]); i = j + 1
        else: i += 1
    merged = []
    for a, b in rr:
        if merged and xs[a] - xs[merged[-1][1]] < gap: merged[-1][1] = b
        else: merged.append([a, b])
    cand = [(depth[a:b + 1].sum(), 0.5 * (xs[a] + xs[b])) for a, b in merged]
    return sorted(c for _, c in sorted(cand, reverse=True)[:3])
def ray_hits(segA, segB, o, d):
    """Distances t>0 along o + t d (2D) where it crosses the segments."""
    e = segB - segA; den = d[0] * e[:, 1] - d[1] * e[:, 0]
    ok = np.abs(den) > 1e-12
    w = segA - o
    t = (w[:, 0] * e[:, 1] - w[:, 1] * e[:, 0]) / np.where(ok, den, 1)
    s = (w[:, 0] * d[1] - w[:, 1] * d[0]) / np.where(ok, den, 1)
    m = ok & (s >= 0) & (s <= 1) & (t > 1e-6)
    return t[m]
def curvature(C2):
    t = np.gradient(C2, axis=0); t /= np.linalg.norm(t, axis=1)[:, None]
    ang = np.arctan2(t[:, 1], t[:, 0]); dang = np.diff(np.unwrap(ang))
    return np.r_[0, np.abs(dang)]
def trace(w, Yh, N, Wd, uc):
    """Centreline of the hand's outline in the plane u = uc, from inside the palm round the curl."""
    o3 = w + uc * Wd
    SG = M.segments(o3, Wd, near=o3 + 0.10 * Yh, radius=0.14)
    if not len(SG): return None
    A_ = np.c_[(SG[:, 0] - w) @ Yh, (SG[:, 0] - w) @ N]; B_ = np.c_[(SG[:, 1] - w) @ Yh, (SG[:, 1] - w) @ N]
    dd = np.array([1.0, 0.0])
    tn = np.sort(ray_hits(A_, B_, np.array([0.07, -0.3]), np.array([0, 1.0]))) - 0.3
    iv = [(tn[i], tn[i + 1]) for i in range(0, len(tn) - 1, 2)]
    if not iv: return None
    lo_, hi_ = min(iv, key=lambda p: 0 if p[0] <= 0 <= p[1] else min(abs(p[0]), abs(p[1])))
    c = np.array([0.07, 0.5 * (lo_ + hi_)])
    path, thick = [], []
    for it in range(200):
        nrm = np.array([-dd[1], dd[0]])
        h1, h2 = ray_hits(A_, B_, c, nrm), ray_hits(A_, B_, c, -nrm)
        if not len(h1) or not len(h2): break
        a, b = h1.min(), h2.min()
        if a + b > 0.09: break
        cen = c + nrm * 0.5 * (a - b)
        if path and (a + b < 0.007 or (min(thick) < 0.035 and a + b - thick[-1] > 0.012)): break
        path.append(cen); thick.append(a + b)
        if len(path) >= 4:
            dn = unit(path[-1] - path[-4]); dd = unit(0.6 * dd + 0.4 * dn)
        c = cen + dd * 0.002
    if len(path) < 8: return None
    path = np.array(path); thick = np.array(thick)
    s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))]
    fs = np.flatnonzero(thick < 0.75 * thick[:5].mean()); fstart = int(fs[0]) if len(fs) else 0
    return dict(A=A_, B=B_, path=path, thick=thick, s=s, fstart=fstart, dd=dd)
OUT = {}; DBG = []
NAMES = ["index", "middle", "ring", "pinky"]
for side, sx in (("R", -1), ("L", 1)):
    w, k = J["wrist." + side], J["knuckles." + side]
    Yh = unit(k - w); Wd = unit(np.array([0, 1.0, 0]) - Yh * Yh[1]); N = np.cross(Wd, Yh)
    if N[0] * sx > 0: N = -N                      # N points out of the palm
    rel = P - w; u, v, n = rel @ Wd, rel @ Yh, rel @ N
    # finger planes: a cut through a finger's centre shows its full thickness, a cut through
    # a groove less; trace every 3 mm across the hand and take the thickness of the first
    # phalanx (1-3 cm past where the finger leaves the palm); the four highest peaks >= 2 cm apart
    us = np.arange(-0.06, 0.0601, 0.003); T = np.zeros(len(us))
    for i, uc in enumerate(us):
        tr = trace(w, Yh, N, Wd, uc)
        if tr is None: continue
        m = (tr["s"] > tr["s"][tr["fstart"]] + 0.01) & (tr["s"] < tr["s"][tr["fstart"]] + 0.03)
        if m.sum() >= 3: T[i] = np.median(tr["thick"][m])
    Ts = np.convolve(T, np.ones(3) / 3, mode="same")
    peaks = []
    for i in np.argsort(-Ts):
        if Ts[i] <= 0: break
        if all(abs(us[i] - us[j]) >= 0.02 for j in peaks): peaks.append(i)
        if len(peaks) == 4: break
    centres = sorted(us[peaks])
    # where a plane's trace fails (the cut catches the thumb), take the nearest plane within 6 mm that traces
    for i_, uc in enumerate(centres):
        for du in (0, 0.003, -0.003, 0.006, -0.006):
            tr_ = trace(w, Yh, N, Wd, uc + du)
            if tr_ is not None and tr_["s"][-1] > 0.09: centres[i_] = uc + du; break
    print("== %s first-phalanx thickness across the hand (mm): %s" % (side, " ".join("%d" % round(x * 1000) for x in Ts)))
    print("   finger planes at u %s" % np.round(centres, 3))
    for name, uc in zip(NAMES, centres):
        tr = trace(w, Yh, N, Wd, uc)
        A_, B_, path, thick, s, fstart, dd = tr["A"], tr["B"], tr["path"], tr["thick"], tr["s"], tr["fstart"], tr["dd"]
        kap = np.convolve(curvature(path), np.ones(5) / 5, mode="same")
        # the knuckle: the first sharp bend after the palm (the thickness drops from the hand's to the finger's there)
        # windows along the path, measured from where the finger's own thickness starts
        s0 = s[fstart]
        # MCP: 1.5 cm before the finger leaves the palm (the palm's crease lies ~1.5-2 cm past the joint);
        # PIP and DIP at typical proportions of MCP->tip (48 / 30 / 22 %), each snapped to the
        # sharpest bend within +-8 mm
        s_tip = s[-1] + 0.5 * thick[-1]
        i_mcp = int(np.argmin(np.abs(s - (s0 - 0.015))))
        Lf = s_tip - s[i_mcp]
        # a trace that runs on where the fingertip touches the palm, thumb or thigh is cut back to the
        # typical length (MCP->tip: middle ~ the palm's length; index 0.96, ring 0.97, pinky 0.80 of it)
        L_exp = {"index": 0.96, "middle": 1.0, "ring": 0.97, "pinky": 0.80}[name] * np.linalg.norm(k - w)
        cut = Lf > 1.08 * L_exp
        if cut:
            Lf = L_exp; s_tip = s[i_mcp] + Lf
            j = int(np.searchsorted(s, s_tip)); j = min(j, len(path) - 1)
            path, thick, s, kap = path[:j + 1], thick[:j + 1], s[:j + 1], kap[:j + 1]
            dd = unit(path[-1] - path[-3])
        def pick(frac, win=0.008):
            m = np.abs(s - (s[i_mcp] + frac * Lf)) <= win
            if not m.any(): return None
            return int(np.flatnonzero(m)[np.argmax(kap[m])])
        i_pip = pick(0.48); i_dip = pick(0.78)
        # sanity: phalanges shorten from base to tip; if snapping to a bend breaks that (or makes a
        # bone under 1.5 cm), fall back to the plain proportions
        if None not in (i_pip, i_dip):
            tip_ = path[-1] + dd * max(0.0, s_tip - s[-1])
            l1, l2, l3 = (np.linalg.norm(path[i_pip] - path[i_mcp]), np.linalg.norm(path[i_dip] - path[i_pip]), np.linalg.norm(tip_ - path[i_dip]))
            if not (l1 >= 0.9 * l2 and l2 >= 0.8 * l3 and min(l1, l2, l3) >= 0.015):
                i_pip = int(np.argmin(np.abs(s - (s[i_mcp] + 0.48 * Lf)))); i_dip = int(np.argmin(np.abs(s - (s[i_mcp] + 0.78 * Lf))))
                print("  %-6s bends gave %.1f / %.1f / %.1f cm: plain proportions used" % (name, l1 * 100, l2 * 100, l3 * 100))
        if None in (i_mcp, i_pip, i_dip):
            print("  %-6s plane u %+.3f: trace too short (%d steps, %.1f cm)" % (name, uc, len(path), s[-1] * 100))
            DBG.append(("%s %s" % (side, name), A_, B_, path, [])); continue
        tip2 = path[-1] + dd * max(0.0, s_tip - s[-1])
        to3 = lambda q: w + uc * Wd + q[0] * Yh + q[1] * N
        res = {"mcp": to3(path[i_mcp]), "pip": to3(path[i_pip]), "dip": to3(path[i_dip]), "tip": to3(tip2)}
        segl = [np.linalg.norm(res[b] - res[a]) * 100 for a, b in (("mcp", "pip"), ("pip", "dip"), ("dip", "tip"))]
        ang = []
        for i in (i_mcp, i_pip, i_dip):
            a2 = unit(path[min(i + 6, len(path) - 1)] - path[i]); b2 = unit(path[i] - path[max(i - 6, 0)])
            ang.append(np.degrees(np.arccos(np.clip(a2 @ b2, -1, 1))))
        print("  %-6s%s plane u %+.3f: path %d steps, %.1f cm round the curl from the palm; finger %.1f cm; thickness %.1f->%.1f cm;"
              " phalanges %.1f / %.1f / %.1f cm; bends MCP %.0f PIP %.0f DIP %.0f deg" % (
              name, " (cut back)" if cut else "", uc, len(path), s[-1] * 100, Lf * 100, thick[fstart] * 100, thick[-1] * 100, *segl, *ang))
        DBG.append(("%s %s" % (side, name), A_, B_, path, [path[i_mcp], path[i_pip], path[i_dip], tip2]))
        OUT["%s.%s" % (name, side)] = {k_: list(map(float, v_)) for k_, v_ in res.items()}
        OUT["%s.%s" % (name, side)]["flex_axis"] = list(map(float, Wd * (1 if side == "R" else 1)))
    # ------------------------------------------------------------- thumb
    # Cut across the hand every 5 mm: the thumb is the separate small loop (3-14 cm2) on the
    # radial, palm side (u < -2 cm, n > 3.5 cm); followed from where it first separates (about
    # its MCP) loop by loop, always the one nearest the last, to where it ends (the tip).
    tl = []
    for vv in np.arange(0.06, 0.20, 0.005):
        L = M.section(w + vv * Yh, Yh, near=w + vv * Yh, radius=0.10)
        cands = [l for l in L if 3e-4 < l["area"] < 14e-4]
        if not tl:
            cands = [l for l in cands if (l["centroid"] - w) @ Wd < -0.02 and (l["centroid"] - w) @ N > 0.035]
            if cands: tl.append(min(cands, key=lambda l: l["area"]))
            continue
        cands = [l for l in L if l["area"] < 14e-4 and np.linalg.norm(l["centroid"] - tl[-1]["centroid"]) < 0.015]
        if not cands: break
        tl.append(min(cands, key=lambda l: np.linalg.norm(l["centroid"] - tl[-1]["centroid"])))
    tp = np.array([l["centroid"] for l in tl])
    dirt = unit(tp[-1] - tp[max(0, len(tp) - 4)])
    tip_t = tp[-1] + dirt * np.sqrt(tl[-1]["area"] / np.pi)
    mcp_t = tp[0]
    ip_t = mcp_t + 0.52 * (tip_t - mcp_t)
    st = np.r_[0, np.cumsum(np.linalg.norm(np.diff(tp, axis=0), axis=1))]
    # CMC: one typical first-metacarpal length (4.8 cm) back from the thumb's MCP, toward the radial side of the wrist
    cmc_t = mcp_t + 0.048 * unit((w - 0.02 * Wd + 0.01 * N) - mcp_t)
    OUT["thumb." + side] = {"cmc": list(map(float, cmc_t)), "mcp": list(map(float, mcp_t)), "ip": list(map(float, ip_t)), "tip": list(map(float, tip_t))}
    print("  thumb: %d separate loops from %.1f cm down the hand, %.1f cm free; metacarpal %.1f, proximal %.1f, distal %.1f cm" % (
        len(tp), ((tp[0] - w) @ Yh) * 100, np.linalg.norm(tip_t - mcp_t) * 100, np.linalg.norm(mcp_t - cmc_t) * 100, np.linalg.norm(ip_t - mcp_t) * 100, np.linalg.norm(tip_t - ip_t) * 100))
    OUT["frame." + side] = {"Yh": list(map(float, Yh)), "W": list(map(float, Wd)), "N": list(map(float, N))}
json.dump(OUT, open(os.path.join(C.SCRATCH, "out", "fingers.json"), "w"), indent=1)
ims, labs = [], []
for lab, A_, B_, path, jts in DBG:
    im = np.ones((320, 320, 3), np.float32)
    f2 = lambda q: np.array([160 + q[1] * 1400, 10 + q[0] * 1300])
    for a2, b2 in zip(A_, B_):
        pa, pb = f2(a2), f2(b2)
        if np.all((pa > 0) & (pa < 319)) and np.all((pb > 0) & (pb < 319)): C.draw_line(im, pa, pb, (0.2, 0.2, 0.2), 0)
    for a2, b2 in zip(path[:-1], path[1:]): C.draw_line(im, f2(a2), f2(b2), (0.2, 0.5, 0.9), 0)
    for q in jts: C.draw_dot(im, f2(q), (0.85, 0.1, 0.1), 3)
    ims.append(im); labs.append(lab.upper())
V.save_png(V.sheet(ims, 8, labs, header="FINGER PLANES  OUTLINE  CENTRELINE BLUE  MCP PIP DIP TIP RED  PALM TO THE RIGHT", scale=2), os.path.join(C.SCRATCH, "renders", "finger_traces.png"))

# renders: the hands from four sides with the finger chains
V.setup_workbench((600, 600)); ims, labs = [], []
for side in ("R", "L"):
    sx = -1 if side == "R" else 1
    c = 0.5 * (J["wrist." + side] + J["knuckles." + side]) + np.array([0, 0, -0.03])
    for view, d_ in (("outer", (sx, 0, 0)), ("inner", (-sx, 0, 0)), ("front", (0, -1, 0)), ("below", (0, -0.3, -1))):
        cam = V.camera(tuple(c), d_, ortho_scale=0.26); bpy.context.view_layer.update()
        f = os.path.join(C.SCRATCH, "renders", "hand_%s_%s.png" % (side, view))
        im = V.load_png(f) * 0.6 + 0.4
        ch = [J["wrist." + side], J["knuckles." + side]]
        X = C.project(cam, (600, 600), np.array(ch)); C.draw_line(im, X[0], X[1], (0.3, 0.3, 0.3), 1)
        for name, col in zip(NAMES + ["thumb"], ((0.85, 0.1, 0.1), (0.1, 0.55, 0.1), (0.1, 0.2, 0.85), (0.75, 0.4, 0.0), (0.6, 0.1, 0.6))):
            F = OUT["%s.%s" % (name, side)]
            ks = ["cmc", "mcp", "ip", "tip"] if name == "thumb" else ["mcp", "pip", "dip", "tip"]
            X = C.project(cam, (600, 600), np.array([F[k_] for k_ in ks]))
            for a2, b2 in zip(X[:-1], X[1:]): C.draw_line(im, a2, b2, col, 1)
            for p2 in X: C.draw_dot(im, p2, col, 4)
        ims.append(im); labs.append("%s %s" % (side, view.upper()))
V.save_png(V.sheet(ims, 4, labs, header="FINGERS  INDEX RED  MIDDLE GREEN  RING BLUE  PINKY ORANGE  THUMB PURPLE", scale=3), os.path.join(C.SCRATCH, "renders", "fingers.png"))
print("done")
