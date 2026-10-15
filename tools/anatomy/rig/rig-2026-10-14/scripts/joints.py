"""Step 2: joint centres measured from the sculpture, per side (it is not
symmetric: it stands in a stride). Every rule is printed with what it found.
  Blender -b original/Male_Body.blend --python scripts/joints.py
Writes out/joints.json and renders/proposal_*.png. Saves nothing to the .blend.

Rules (anatomical landmark -> joint centre):
  hip       Bell et al. (1990): from the midpoint of the two ASIS, 30 % of the
            inter-ASIS width down, 14 % back, 36 % out. ASIS = the top of the
            painted sartorius (its origin).
  knee      the narrowest section between thigh and calf (the joint line region);
            centre of that section. The kink between the thigh and shin lines is
            printed as a check.
  ankle     the widest section across the malleoli below the narrowest point
            above them; midpoint of the two malleoli, 8 mm lower (the joint axis
            runs just under their tips).
  ball      (metatarsophalangeal joints) the widest section of the forefoot, at
            that fraction of heel-to-toes but on the foot's own axis.
  toe tip   the centre of the foot's front 1.5 cm (the middle of the toe row).
  shoulder  (glenohumeral) 4.5 cm inside the skin both from the side and from
            the top of the shoulder (deltoid ~2 cm + humeral head radius ~2.4 cm),
            midway front to back.
  elbow     the narrowest section between the upper arm and the forearm bulge.
  wrist     1 cm beyond the narrowest section of the distal forearm.
  knuckles  the widest section of the hand (metacarpal heads), until the
            fingers are measured one by one.
  clavicle  sternoclavicular joint beside the jugular notch (2.2 cm out, 2 cm
            in, 5 mm down); acromioclavicular joint 1.8 cm under the top of the
            shoulder, 2 cm medial of the shoulder centre (the clavicle lies just
            under the skin and bows forward, so its straight chord must sit a
            little deep to stay inside).
  scapula   inferior angle = the lowest point of the painted infraspinatus,
            1 cm under the skin.
  spine     levels from surface anatomy: L5/S1 4 cm under the iliac crest's top
            (ASIS + 5 cm), L3/L4 at the navel, T12/L1 2 cm above the
            transpyloric plane (halfway between the jugular notch and the pubic
            symphysis), C7/T1 4 cm above the notch, T7 halfway between T12 and
            C7; across, on the spinal furrow (the sculpture leans, so the spine
            is up to 4 cm off x = 0). Neck top: the centre of the stump's cut. Depth: a fixed fraction of the body's front-to-back depth at that
            level, measured from the back (lumbar 0.33, thoracic 0.27, neck 0.45).
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.dont_write_bytecode = True
import bpy, numpy as np
import common as C, sections as S, viz as V
C.guard()
obj = bpy.data.objects["Mesh_0"]; me = obj.data; armo = bpy.data.objects["Armature.001"]
P = C.mesh_world(obj)
ev = np.empty(len(me.edges) * 2, np.int64); me.edges.foreach_get("vertices", ev); ev = ev.reshape(-1, 2)
ls, lt, lv = C.faces(me)
le = np.empty(len(me.loops), np.int64); me.loops.foreach_get("edge_index", le)
M = S.Mesh(P, ev, ls, lt, lv, le)
freg = C.face_regions(me)
face_of_loop = np.repeat(np.arange(len(ls)), lt)
def region_verts(name):
    f = np.flatnonzero(freg == name); return np.unique(lv[np.isin(face_of_loop, f)])
J, notes = {}, {}
FLOOR = P[:, 2].min()
def unit(v): return v / np.linalg.norm(v)
def fmt(p): return "(%.3f, %.3f, %.3f)" % tuple(p)

def limb(start, d):
    a, sa = S.track(M, np.array(start, float), np.array(d, float))
    b, sb = S.track(M, np.array(start, float), -np.array(d, float))
    pts = np.vstack([b[::-1], a[1:]]); secs = sb[::-1] + sa[1:]
    s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]
    return pts, secs, s, np.array([l["area"] for l in secs])
def fitline(X):
    c = X.mean(0); _, _, vt = np.linalg.svd(X - c); d = vt[0]
    return c, d if d @ (X[-1] - X[0]) > 0 else -d
def closest(c1, d1, c2, d2):
    w = c1 - c2; a, b, c_, d, e = d1 @ d1, d1 @ d2, d2 @ d2, d1 @ w, d2 @ w
    den = a * c_ - b * b
    if abs(den) < 1e-9: return None, None
    t1 = (b * e - c_ * d) / den; t2 = (a * e - b * d) / den
    p1, p2 = c1 + t1 * d1, c2 + t2 * d2
    return 0.5 * (p1 + p2), np.linalg.norm(p1 - p2)
def largest_patch(vs):
    """The biggest edge-connected piece of a vertex set."""
    keep = np.zeros(len(P), bool); keep[vs] = True
    e_ = ev[keep[ev[:, 0]] & keep[ev[:, 1]]]
    par = {int(v): int(v) for v in vs}
    def f(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    for a_, b_ in e_:
        ra, rb = f(int(a_)), f(int(b_))
        if ra != rb: par[ra] = rb
    from collections import Counter
    roots = np.array([f(int(v)) for v in vs]); big = Counter(roots).most_common(1)[0][0]
    return vs[roots == big]
def win(s, lo, hi): return np.flatnonzero((s >= lo) & (s <= hi))

for side, sx in (("R", -1), ("L", 1)):
    # ------------------------------------------------------------- leg
    pts, secs, s, A = limb((0.10 * sx, -0.06, -0.10), (0, 0, -1))
    L = s[-1]
    k = win(s, 0.25, 0.50)[np.argmin(A[win(s, 0.25, 0.50)])]
    knee = secs[k]["centroid"]
    c1, d1 = fitline(pts[win(s, 0.02, s[k] - 0.10)]); c2, d2 = fitline(pts[win(s, s[k] + 0.12, s[k] + 0.30)])
    kink, gap = closest(c1, d1, c2, d2)
    ang = np.degrees(np.arccos(np.clip(d1 @ d2, -1, 1)))
    notes["knee." + side] = "narrowest at %.1f cm along the leg, area %.0f cm2; thigh-shin angle %.0f deg; kink point %s (%.1f cm from it)" % (
        s[k] * 100, A[k] * 1e4, ang, fmt(kink) if kink is not None else "-", np.linalg.norm(kink - knee) * 100 if kink is not None else -1)
    J["knee." + side] = knee
    # ankle: narrowest above the malleoli, then the widest across them
    ia = win(s, s[k] + 0.25, s[k] + 0.50); a_ = ia[np.argmin(A[ia])]
    foot_v = np.flatnonzero((P[:, 2] < FLOOR + 0.12) & (np.abs(P[:, 0] - pts[a_, 0]) < 0.10) & (np.abs(P[:, 1] - pts[a_, 1]) < 0.20))
    shin_d = unit(pts[a_] - knee)
    best = None
    for i in win(s, s[a_], s[a_] + 0.09):
        l = secs[i]
        if abs(l["n"] @ shin_d) < 0.85: break       # the track has turned into the foot
        Q = l["points"]
        # mediolateral: horizontal, perpendicular to the foot's length (toe tip - heel)
        fwd_raw = None
        w_ = None
        best = best
        if best is None or True:
            pass
        lat = np.array([1.0, 0, 0])
        w = (Q @ lat).max() - (Q @ lat).min()
        if best is None or w > best[0]:
            best = (w, i, Q[np.argmin(Q @ lat)], Q[np.argmax(Q @ lat)])
    w, im, m1, m2 = best
    ankle = 0.5 * (m1 + m2) - shin_d * 0.008
    notes["ankle." + side] = "narrowest above the malleoli at %.1f cm (area %.0f cm2); malleoli width %.1f cm at %.1f cm; %.1f cm above the floor" % (
        s[a_] * 100, A[a_] * 1e4, w * 100, s[im] * 100, (ankle[2] - FLOOR) * 100)
    J["ankle." + side] = ankle
    # foot: heel = back-most, toe tip = front-most point of the foot (along its own length)
    F = P[foot_v]
    fwd = np.array([0, -1.0, 0])
    for _ in range(3):
        tip = F[np.argmax(F @ fwd)]; heel = F[np.argmin(F @ fwd)]
        fwd = unit(np.r_[(tip - heel)[:2], 0])
    # the toe bone ends at the middle of the toe row: the centre of the foot's front 1.5 cm
    front = F[(F @ fwd) > (tip @ fwd) - 0.015]
    J["toe_tip." + side] = front.mean(0); J["heel." + side] = heel
    lat = np.cross(fwd, [0, 0, 1.0])
    best = None
    for i in range(len(secs)):
        l = secs[i]
        if abs(l["n"] @ fwd) < 0.8 or l["centroid"] @ fwd < ankle @ fwd: continue
        Q = l["points"]; w = (Q @ lat).max() - (Q @ lat).min()
        if best is None or w > best[0]: best = (w, i)
    if best:
        ball = secs[best[1]]["centroid"]
    else:
        ball = heel + 0.72 * (tip - heel); ball[2] = FLOOR + 0.025
    # the widest cut centres on the big toe's joint bulge; the bone goes on the foot's own axis
    # (heel -> middle of the toe row) at that fraction of the length, at the measured height
    tt = J["toe_tip." + side]; frac = ((ball - heel) @ fwd) / ((tt - heel) @ fwd)
    on_axis = heel + frac * (tt - heel); on_axis[2] = ball[2]
    notes["ball." + side] = "forefoot widest %.1f cm at %.0f %% of heel-to-toes (%.1f cm); moved %.1f cm onto the foot's axis" % (
        best[0] * 100 if best else -1, frac * 100, np.linalg.norm((tt - heel)[:2]) * 100, np.linalg.norm((on_axis - ball)[:2]) * 100)
    J["ball." + side] = on_axis
    # ------------------------------------------------------------- hip (Bell)
    sar = region_verts("sartorius." + side)
    J["asis." + side] = P[sar[np.argmax(P[sar, 2])]]
    # ------------------------------------------------------------- arm
    pts, secs, s, A = limb((0.31 * sx, 0.0, 0.42), (0, 0, -1))
    e = win(s, 0.04, 0.22); e = e[np.argmin(A[e])]
    elbow = secs[e]["centroid"]
    c1, d1 = fitline(pts[win(s, 0.0, s[e] - 0.04)]); c2, d2 = fitline(pts[win(s, s[e] + 0.06, s[e] + 0.26)])
    kink, gap = closest(c1, d1, c2, d2); ang = np.degrees(np.arccos(np.clip(d1 @ d2, -1, 1)))
    notes["elbow." + side] = "narrowest at %.1f cm, area %.0f cm2; upper arm-forearm angle %.0f deg; kink %s (%.1f cm away)" % (
        s[e] * 100, A[e] * 1e4, ang, fmt(kink) if kink is not None else "-", np.linalg.norm(kink - elbow) * 100 if kink is not None else -1)
    J["elbow." + side] = elbow
    upper_line = (c1, d1)
    w_ = win(s, s[e] + 0.20, s[e] + 0.40); w_ = w_[np.argmin(A[w_])]
    fd = unit(pts[w_] - elbow)
    l = M.loop_at(secs[w_]["centroid"] + fd * 0.01, fd, secs[w_]["centroid"] + fd * 0.01)
    J["wrist." + side] = l["centroid"]
    notes["wrist." + side] = "narrowest forearm at %.1f cm (area %.0f cm2); wrist centre 1 cm beyond" % (s[w_] * 100, A[w_] * 1e4)
    h_ = win(s, s[w_] + 0.03, s[-1])
    hmax = h_[np.argmax(A[h_])]
    web = next((i for i in h_ if i > hmax and A[i] < 0.60 * A[hmax]), None)
    if web is not None:
        mcp_s = s[web] - 0.015; i_m = int(np.argmin(np.abs(s - mcp_s)))
        J["knuckles." + side] = pts[i_m]
        notes["knuckles." + side] = "palm widest %.0f cm2; fingers split (area under 60 %%) at %.1f cm; knuckles 1.5 cm before: %.1f cm from the wrist" % (
            A[hmax] * 1e4, s[web] * 100, np.linalg.norm(pts[i_m] - J["wrist." + side]) * 100)
    # ------------------------------------------------------------- shoulder (glenohumeral)
    # Under the deltoid the humeral head's centre sits ~4.5 cm inside the skin both from the side
    # and from the top (deltoid ~2 cm + head radius ~2.4 cm). Iterate to the point 4.5 cm in from
    # the outer surface (coronal section through the arm) and 4.5 cm under the top surface
    # (sagittal section through the point); front-back: midway in that sagittal section.
    DEPTH = 0.045
    y0 = upper_line[0][1]
    cor = np.vstack([l["points"] for l in M.section(np.array([0, y0, 0.0]), np.array([0, 1.0, 0]))])
    cor = cor[(cor[:, 0] * sx > 0.10) & (cor[:, 2] > 0.55)]
    def x_lat(z):
        q = cor[np.abs(cor[:, 2] - z) < 0.006]; return q[np.argmax(q[:, 0] * sx), 0]
    def sag(x):
        Q = np.vstack([l["points"] for l in M.section(np.array([x, 0, 0.0]), np.array([1.0, 0, 0]))])
        return Q[(Q[:, 2] > 0.55) & (np.abs(Q[:, 1]) < 0.35)]
    z = cor[np.argmax(cor @ (np.array([sx, 0, 1.0]) / np.sqrt(2))), 2] - 0.04
    for it in range(6):
        x = x_lat(z) - sx * DEPTH
        Q = sag(x); near = Q[np.abs(Q[:, 1] - y0) < 0.03]
        z_new = near[:, 2].max() - DEPTH
        if abs(z_new - z) < 5e-4: z = z_new; break
        z = z_new
    q = Q[np.abs(Q[:, 2] - z) < 0.004]
    gh = np.array([x, 0.5 * (q[:, 1].min() + q[:, 1].max()), z])
    c1, d1 = upper_line
    off = np.linalg.norm((gh - c1) - ((gh - c1) @ d1) * d1)
    J["shoulder." + side] = gh
    notes["shoulder." + side] = "%d iterations: outer skin at x %.3f, top skin at z %.3f; front-back %.1f cm at the joint; %.1f cm off the upper arm's line" % (
        it + 1, x_lat(z), z + DEPTH, (q[:, 1].max() - q[:, 1].min()) * 100, off * 100)
    ctr = gh
    # scapula's inferior angle
    iv = np.concatenate([region_verts("infraspinatus." + side), region_verts("teres-major." + side)])
    iv = iv[(P[iv, 0] * sx > 0.03) & (P[iv, 1] > 0.0) & (P[iv, 2] > 0.40)]
    iv = largest_patch(iv)
    ia_ = iv[np.argmin(P[iv, 2])]
    J["scapula_tip." + side] = P[ia_] + np.array([0, -0.01, 0])
    # acromioclavicular joint: 1 cm under the shoulder's top, 2 cm medial of the shoulder centre
    q = ctr + np.array([-sx * 0.02, 0, 0])
    top_ = P[(np.abs(P[:, 0] - q[0]) < 0.008) & (np.abs(P[:, 1] - q[1]) < 0.008)]
    J["acromioclavicular." + side] = np.array([q[0], q[1], top_[:, 2].max() - 0.018])
    notes["acromioclavicular." + side] = "shoulder top above it at z %.3f" % top_[:, 2].max()

# ------------------------------------------------------------- hips (Bell et al. 1990)
aR, aL = J["asis.R"], J["asis.L"]
PW = np.linalg.norm(aL - aR); mid = 0.5 * (aL + aR)
lat = unit(aL - aR); up = np.array([0, 0, 1.0]); post = unit(np.cross(up, lat)) * (1 if np.cross(up, lat)[1] > 0 else -1)
up = np.cross(lat, post) if np.cross(lat, post)[2] > 0 else -np.cross(lat, post)
for side, sg in (("R", -1), ("L", 1)):
    J["hip." + side] = mid - 0.30 * PW * up + 0.14 * PW * post + sg * 0.36 * PW * lat
notes["hip"] = "ASIS R %s, L %s; inter-ASIS width %.1f cm" % (fmt(aR), fmt(aL), PW * 100)

# ------------------------------------------------------------- trunk landmarks
FRONT_X = 0.0
mvert = np.abs(P[:, 0] - FRONT_X) < 0.012
def front_profile(z0, z1, dz=0.005):
    out = []
    for z in np.arange(z0, z1, dz):
        m = mvert & (P[:, 2] >= z) & (P[:, 2] < z + dz) & (P[:, 1] < 0.0)
        if m.sum(): out.append((z + dz / 2, P[m, 1].min()))
    return np.array(out)
ra = region_verts("rectus-abdominis")
pubis_z = P[ra, 2].min(); ra_top = P[ra, 2].max()
fp = front_profile(pubis_z + 0.06, pubis_z + 0.26)
sm = np.convolve(fp[:, 1], np.ones(9) / 9, mode="same")
dent = fp[:, 1] - sm; i_n = 4 + np.argmax(dent[4:-4])
navel_z = fp[i_n, 0]
notes["navel"] = "front midline dent %.1f mm deep at z %.3f" % (dent[i_n] * 1e3, navel_z)
# jugular notch: on the front midline, the deepest point between the chest and the neck
fp2 = front_profile(ra_top, P[:, 2].max() - 0.01)
pec = np.concatenate([region_verts("pectoralis-major.R"), region_verts("pectoralis-major.L")])
pec_top = P[pec, 2].max()
seg = fp2[(fp2[:, 0] > pec_top - 0.08) & (fp2[:, 0] < pec_top + 0.06)]
i_j = np.argmax(seg[:, 1]); notch = np.array([FRONT_X, seg[i_j, 1], seg[i_j, 0]])
notes["jugular_notch"] = "deepest front-midline point near the top of the pectorals (top z %.3f): %s" % (pec_top, fmt(notch))
J["jugular_notch"] = notch
# the back's midline: the spinal furrow (deepest dip between the erector ridges) per height;
# the sculpture leans (contrapposto), so the spine is not at x = 0
fz, fx = [], []
for z in np.arange(0.45, 0.88, 0.03):
    l = M.loop_at(np.array([0, 0, z]), np.array([0, 0, 1.0]), np.array([0.0, 0.0, z]), radius=0.5)
    Q = l["points"]; back = Q[(Q[:, 1] > l["centroid"][1]) & (np.abs(Q[:, 0]) < 0.16)]
    xs = np.arange(-0.15, 0.151, 0.004)
    yb = np.array([back[np.abs(back[:, 0] - x) < 0.004, 1].max() if (np.abs(back[:, 0] - x) < 0.004).any() else np.nan for x in xs])
    ys = np.convolve(np.nan_to_num(yb, nan=np.nanmin(yb)), np.ones(3) / 3, mode="same")
    best = max(((min(np.nanmax(ys[max(0, i - 15):i]), np.nanmax(ys[i + 1:i + 16])) - ys[i], xs[i]) for i in range(3, len(xs) - 3) if not np.isnan(yb[i])))
    if best[0] > 0.017: fz.append(z); fx.append(best[1])        # shallower dips (lower back) are noise
fz, fx = np.array(fz), np.convolve(np.r_[fx[0], fx, fx[-1]], np.ones(3) / 3, mode="valid")
pelvis_x = 0.5 * (J["hip.R"][0] + J["hip.L"][0])
def x_mid(z):
    return float(np.interp(z, np.r_[0.5 * (J["hip.R"][2] + J["hip.L"][2]), fz], np.r_[pelvis_x, fx]))
notes["spine_midline"] = "spinal furrow x from %+.3f (z %.2f) to %+.3f (z %.2f), most offset %+.3f" % (fx[0], fz[0], fx[-1], fz[-1], fx[np.argmax(np.abs(fx))])
crest_z = 0.5 * (aR[2] + aL[2]) + 0.05
levels = {"L5_S1": crest_z - 0.04, "L3_L4": navel_z, "T12_L1": 0.5 * (notch[2] + pubis_z) + 0.02, "C7_T1": notch[2] + 0.04}
levels["T7"] = 0.5 * (levels["T12_L1"] + levels["C7_T1"])
top_z = P[:, 2].max()
FR = {"L5_S1": 0.33, "L3_L4": 0.33, "T12_L1": 0.30, "T7": 0.27, "C7_T1": 0.40}
for nm, z in levels.items():
    xm = x_mid(z)
    l = M.loop_at(np.array([0, 0, z]), np.array([0, 0, 1.0]), np.array([xm, 0.0, z]), radius=0.5)
    Q = l["points"]; mq = np.abs(Q[:, 0] - xm) < 0.02
    yb, yf = Q[mq, 1].max(), Q[mq, 1].min()
    J[nm] = np.array([xm, yb - FR[nm] * (yb - yf), z])
    notes[nm] = "z %.3f; body depth %.1f cm at the midline; joint %.1f cm in front of the back's skin" % (z, (yb - yf) * 100, FR[nm] * (yb - yf) * 100)
J["pelvis"] = 0.5 * (J["hip.R"] + J["hip.L"])
cap = P[P[:, 2] > top_z - 0.03]
J["neck_top"] = cap.mean(0)
notes["neck_top"] = "centre of the neck stump's cut (vertices within 3 cm of its top): %s" % fmt(J["neck_top"])
for side, sx in (("R", -1), ("L", 1)):
    J["sternoclavicular." + side] = notch + np.array([sx * 0.022, 0.02, -0.005])

# ------------------------------------------------------------- compare with the current rig
cur = {b.name: (np.array(armo.matrix_world @ b.head_local), np.array(armo.matrix_world @ b.tail_local)) for b in armo.data.bones}
CUR = {"shoulder.R": cur["Bone.010"][0], "elbow.R": cur["Bone.011"][0], "wrist.R": cur["Bone.012"][0],
       "shoulder.L": cur["Bone.003"][0], "elbow.L": cur["Bone.004"][0], "wrist.L": cur["Bone.005"][0],
       "hip.R": cur["Bone.035"][0], "knee.R": cur["Bone.036"][0], "ankle.R": cur["Bone.036"][1],
       "hip.L": cur["Bone.034"][0], "knee.L": cur["Bone.037"][0], "ankle.L": cur["Bone.037"][1]}
print("\nJOINTS (world, m)   measured                    current rig            distance")
for k_ in sorted(J):
    c = CUR.get(k_)
    print("  %-22s %-26s %-26s %s" % (k_, fmt(J[k_]), fmt(c) if c is not None else "", "%.1f cm" % (np.linalg.norm(c - J[k_]) * 100) if c is not None else ""))
print("\nNOTES")
for k_, v in notes.items(): print("  %-20s %s" % (k_, v))
# bone lengths L vs R
print("\nSEGMENTS  R / L (cm)")
for a_, b_ in (("hip", "knee"), ("knee", "ankle"), ("ankle", "ball"), ("shoulder", "elbow"), ("elbow", "wrist"), ("wrist", "knuckles"), ("sternoclavicular", "acromioclavicular")):
    print("  %-18s -> %-18s %5.1f / %5.1f" % (a_, b_, np.linalg.norm(J[b_ + ".R"] - J[a_ + ".R"]) * 100, np.linalg.norm(J[b_ + ".L"] - J[a_ + ".L"]) * 100))
json.dump({"joints": {k_: list(map(float, v)) for k_, v in J.items()}, "notes": notes, "current": {k_: list(map(float, v)) for k_, v in CUR.items()}},
          open(os.path.join(C.SCRATCH, "out", "joints.json"), "w"), indent=1)

# ------------------------------------------------------------- overlay renders
CHAINS = [["pelvis", "L5_S1", "L3_L4", "T12_L1", "T7", "C7_T1", "neck_top"]]
for sd in ("R", "L"):
    CHAINS += [["pelvis", "hip." + sd, "knee." + sd, "ankle." + sd, "ball." + sd, "toe_tip." + sd],
               ["C7_T1", "sternoclavicular." + sd, "acromioclavicular." + sd, "shoulder." + sd, "elbow." + sd, "wrist." + sd, "knuckles." + sd],
               ["acromioclavicular." + sd, "scapula_tip." + sd]]
V.setup_workbench((560, 1000))
armo.hide_render = True
OUT = os.path.join(C.SCRATCH, "renders")
ims = []
for view, d_ in (("front", (0, -1, 0)), ("side_right", (-1, 0, 0)), ("back", (0, 1, 0)), ("side_left", (1, 0, 0))):
    cam = V.camera((0, 0, -0.01), d_, ortho_scale=2.0); bpy.context.view_layer.update()
    f = os.path.join(OUT, "body_%s.png" % view)
    if not os.path.exists(f): V.render(f, 'SINGLE')
    im = V.load_png(f) * 0.55 + 0.45      # lighten the body so the bones read
    for h_, t_ in cur.values():
        a2, b2 = C.project(cam, (560, 1000), np.array([h_, t_])); C.draw_line(im, a2, b2, (0.95, 0.65, 0.65), 0)
    for ch in CHAINS:
        X = C.project(cam, (560, 1000), np.array([J[c] for c in ch]))
        for a2, b2 in zip(X[:-1], X[1:]): C.draw_line(im, a2, b2, (0.05, 0.35, 0.75), 1)
        for p2 in X: C.draw_dot(im, p2, (0.85, 0.15, 0.1), 3)
    ims.append(im); V.save_png(im, os.path.join(OUT, "proposal_%s.png" % view))
V.save_png(V.sheet(ims, 4, ["FRONT", "RIGHT SIDE", "BACK", "LEFT SIDE"], header="PROPOSED JOINTS RED  BONES BLUE  CURRENT RIG PINK", scale=3),
           os.path.join(OUT, "proposal.png"))
print("rendered")
