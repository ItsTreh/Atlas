"""
The ATLAS torso study, first pass — PROVENANCE, NOT SOURCE (see atelier.py).

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python tools/anatomy/authored/torso_study.py

writes assets/anatomy/torso-study.blend (the source from then on) and, through
export_glb.py, assets/anatomy/torso-study.glb.

A headless torso fragment with the shoulders and arms, cut level at the
neck and the waist and square across the middle of the forearms, like a
study cast. Its surface is its anatomy: every face belongs to a muscle, a
tendon or aponeurosis, a bone showing at the surface, or a cut.

Scale follows the procedural ATLAS figure so the two compare directly: the
humeral head at (18.4, 145.0, -0.8), the elbow at (24.8, 116.2, -2.2), the
wrist at (31.4, 92.8, 0.4); centimetres, y up, +x the figure's left, +z its
front. Only the left half is described.
"""

import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True           # leave no __pycache__ beside the scripts
sys.path.insert(0, HERE)
import atelier as at          # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))

# ------------------------------------------------------------------ joints

H = np.array([18.4, 145.0, -0.8])        # centre of the humeral head
E = np.array([24.8, 116.2, -2.2])        # elbow
W = np.array([31.4, 92.8, 0.4])          # wrist (the cut is halfway down the forearm)

NECK_CUT = 158.5                         # level cut through the neck
WAIST_CUT = 106.0                        # level cut just above the iliac crests
FOREARM_CUT = 0.5                        # square cut halfway along the forearm

# ------------------------------------------------------------------ frames

T = at.Cyl((0, 0, 0.3), (0, 1, 0), (0, 0, 1), (1, 0, 0))          # the trunk: t is the height y
NK = at.Cyl((0, 0, -0.9), (0, 1, 0), (0, 0, 1), (1, 0, 0))        # the neck
UA = at.Cyl(H, E - H, (0, 0, 1), (1, 0, 0), length=np.linalg.norm(E - H))   # upper arm: 0 front, 90 outer side
FA = at.Cyl(E, W - E, (0, 0, 1), (1, 0, 0), length=np.linalg.norm(W - E))   # forearm (palm forward)
SH = at.Sph(H)                                                     # the shoulder cap


def ua(phi, t, r): return UA.point(phi, t, r)
def fa(phi, t, r): return FA.point(phi, t, r)
def tr(theta, y, r): return T.point(theta, y, r)


# ----------------------------------------------------------- arm sections
#
# The arm measured as a sculptor would: its radius from the bone's axis
# every 30 degrees (0 front, 90 outer side, 180 back, 270 inner side), at a
# series of levels t (0 the humeral head ... 1 the elbow; the forearm from
# the elbow to the wrist). The deltoid's cap, the biceps's peak, the triceps
# and its flat tendon, the epicondyles, the forearm's two masses and its
# taper are all in these numbers.

ARM_UPPER = at.Sections(UA, [
    (-0.12, [3.9, 4.3, 4.5, 4.5, 4.4, 4.1, 3.9, 3.7, 3.6, 3.6, 3.6, 3.7]),
    (-0.04, [4.9, 5.3, 5.5, 5.6, 5.4, 5.1, 4.8, 4.5, 4.3, 4.2, 4.4, 4.7]),
    (0.06,  [5.4, 5.9, 6.2, 6.2, 6.0, 5.6, 5.3, 5.0, 4.7, 4.4, 4.8, 5.1]),
    (0.18,  [5.5, 5.8, 6.1, 6.2, 6.0, 5.7, 5.4, 5.2, 4.9, 4.4, 4.8, 5.2]),
    (0.30,  [5.5, 5.6, 5.8, 5.8, 5.7, 5.6, 5.5, 5.4, 5.0, 4.4, 4.7, 5.2]),
    (0.42,  [5.7, 5.4, 5.0, 4.9, 5.3, 5.7, 5.8, 5.6, 5.1, 4.3, 4.6, 5.4]),
    (0.52,  [6.0, 5.5, 4.8, 4.6, 5.2, 5.7, 5.9, 5.7, 5.0, 4.3, 4.6, 5.6]),
    (0.62,  [6.3, 5.6, 4.8, 4.5, 5.1, 5.6, 5.8, 5.6, 5.0, 4.2, 4.6, 5.8]),
    (0.74,  [5.8, 5.4, 5.1, 4.8, 4.7, 4.8, 4.6, 4.7, 4.6, 4.1, 4.3, 5.3]),
    (0.86,  [4.5, 4.7, 4.9, 4.8, 4.4, 4.0, 3.8, 4.0, 4.2, 4.3, 4.2, 4.2]),
    (0.96,  [3.7, 4.3, 4.8, 4.6, 4.1, 3.7, 3.6, 3.8, 4.3, 4.6, 4.3, 3.8]),
    (1.06,  [3.6, 4.4, 5.0, 4.8, 4.0, 3.6, 3.5, 3.7, 4.4, 4.8, 4.4, 3.8]),
])
ARM_FORE = at.Sections(FA, [
    (-0.06, [3.6, 4.4, 5.0, 4.8, 4.0, 3.6, 3.5, 3.7, 4.4, 4.8, 4.4, 3.8]),
    (0.06,  [3.9, 4.6, 5.1, 5.0, 4.4, 3.9, 3.5, 3.8, 4.6, 4.9, 4.7, 4.2]),
    (0.18,  [4.2, 4.8, 5.2, 4.9, 4.3, 3.8, 3.2, 3.3, 4.4, 4.9, 4.8, 4.5]),
    (0.30,  [3.9, 4.3, 4.6, 4.4, 3.9, 3.5, 3.0, 3.0, 3.9, 4.4, 4.4, 4.2]),
    (0.42,  [3.4, 3.6, 3.8, 3.7, 3.5, 3.2, 2.9, 2.9, 3.4, 3.8, 3.8, 3.6]),
    (0.52,  [3.2, 3.3, 3.4, 3.4, 3.3, 3.0, 2.8, 2.8, 3.2, 3.5, 3.5, 3.4]),
])
ARM = at.Limb(ARM_UPPER, ARM_FORE)


def ag(phi, t, dr=0.0): return ARM_UPPER.point(phi, t, dr)       # on the upper arm, dr off its surface
def fg(phi, t, dr=0.0): return ARM_FORE.point(phi, t, dr)        # on the forearm
def nk(theta, y, r): return NK.point(theta, y, r)


# ------------------------------------------------------------------ regions

# id -> (structure, ATLAS region name or None). The manifest carries the
# same table for the converter; the mesh itself only knows the ids.
REGIONS = {
    "pectoralis-major":       ("muscle", "pectoralis-major"),
    "deltoid":                ("muscle", "deltoid"),
    "biceps-brachii":         ("muscle", "biceps-brachii"),
    "brachialis":             ("muscle", "brachialis"),
    "triceps-brachii":        ("muscle", "triceps-brachii"),
    "trapezius":              ("muscle", "trapezius"),
    "infraspinatus":          ("muscle", "infraspinatus"),
    "teres-major":            ("muscle", "teres-major"),
    "latissimus-dorsi":       ("muscle", "latissimus-dorsi"),
    "serratus-anterior":      ("muscle", "serratus-anterior"),
    "external-oblique":       ("muscle", "external-oblique"),
    "rectus-abdominis":       ("muscle", "rectus-abdominis"),
    "erector-spinae":         ("muscle", "erector-spinae"),
    "brachioradialis":        ("muscle", "brachioradialis"),
    "forearm-flexors":        ("muscle", "forearm-flexors"),
    "forearm-extensors":      ("muscle", "forearm-extensors"),
    "sternocleidomastoid":    ("muscle", "sternocleidomastoid"),
    "infrahyoid":             ("muscle", None),
    "scalenes":               ("muscle", None),
    "sternum":                ("bone", None),
    "clavicle":               ("bone", None),
    "scapular-spine":         ("bone", None),
    "elbow":                  ("bone", None),
    "trapezius-aponeurosis":  ("tendon", None),
    "linea-alba":             ("tendon", None),
    "triceps-tendon":         ("tendon", None),
    "cut":                    ("cut", None),
}

COLORS = {"muscle": (0.70, 0.50, 0.46), "bone": (0.88, 0.85, 0.76), "tendon": (0.80, 0.82, 0.86),
          "cut": (0.36, 0.36, 0.38)}


def region_colors():
    out, i = {}, 0
    for name, (kind, _) in REGIONS.items():
        r, g, b = COLORS[kind]
        if kind == "muscle":                  # a slight shift per muscle, so borders read in the viewport
            s = ((i * 37) % 11 - 5) / 60.0
            r, g, b = r + s, g - s * 0.4, b + s * 0.2
            i += 1
        out[name] = (r, g, b)
    return out


# ------------------------------------------------------------------- nodes

L = at.Layout()
N = L.node

# The neck, at its cut.
N("NF0", nk(0, NECK_CUT, 5.3))
N("N_scmA", nk(33, NECK_CUT, 5.6))
N("N_scmP", nk(82, NECK_CUT, 6.1))
N("N_trapA", nk(118, NECK_CUT, 6.2))
N("NB0", nk(180, NECK_CUT, 5.5))

# The root of the neck: the jugular notch between the tendons of the
# sternocleidomastoids, the heads of the clavicles.
N("JN", (0.0, 148.8, 4.7))
N("S_st", (1.5, 148.5, 6.1))            # sternal tendon of the sternocleidomastoid
N("SC_top", (2.6, 149.7, 6.2))          # sternoclavicular joint, above and below
N("SC_bot", (2.9, 148.3, 6.4))
N("S_cl", (7.2, 150.2, 6.2))            # clavicular head of the sternocleidomastoid ends
N("T_cl", (12.9, 150.5, 4.3))           # trapezius meets the clavicle
N("AC_top", (17.2, 150.7, -0.1))        # acromioclavicular joint
N("AC_bot", (17.9, 149.5, 0.9))
N("DP_cl", (12.6, 148.9, 4.4))          # deltopectoral triangle, under the clavicle

# The acromion and the spine of the scapula.
N("ACR_m", (17.7, 150.6, -2.8))         # acromion, medial border
N("ACR_tip", (20.4, 149.6, 0.3))        # acromion, front corner
N("ACR_lat", (21.0, 149.3, -1.8))       # acromion, lateral border
N("ACR_post", (20.1, 148.8, -3.9))      # acromial angle
N("SPU_1", (14.0, 147.0, -7.6))         # spine of the scapula, upper lip
N("SPL_1", (14.4, 145.1, -8.6))         # spine, lower lip
N("SP_del", (11.3, 143.4, -9.9))        # posterior deltoid's medial-most origin
N("SPR_top", (8.0, 142.7, -10.9))       # root of the spine
N("SPR_bot", (8.2, 141.2, -11.1))

# Sternum and the front midline.
N("XI", (0.0, 127.8, 9.2))              # xiphoid
N("LA_top", (0.7, 127.9, 9.3))
N("XI_lat", (1.4, 128.9, 9.7))          # the pectoral's lowest sternal fibres
N("LA_1", (0.7, 123.6, 10.1))           # linea alba at the tendinous intersections
N("LA_2", (0.7, 117.0, 10.3))
N("LA_3", (0.7, 110.4, 10.4))
N("LA_cut", (0.6, WAIST_CUT, 10.9))
N("UM", (0.0, 109.6, 9.4))              # the navel
N("CF0", (0.0, WAIST_CUT, 10.9))

# The rectus's lateral border (linea semilunaris).
N("R_top_lat", (8.4, 126.8, 10.9))
N("R_1_lat", (8.5, 124.2, 10.4))
N("R_2_lat", (8.3, 117.6, 10.4))
N("R_3_lat", (7.9, 111.0, 10.5))
N("R_semi_cut", (7.3, WAIST_CUT, 10.6))

# The side of the chest: the pectoral's lateral corner, and the band where
# the serratus and the external oblique interlock.
N("S_front", (13.8, 131.0, 7.4))
N("S_front_d", (12.6, 129.3, 8.7))      # the oblique's teeth reach the pectoral here
N("O_ser_u", (15.8, 124.2, -1.3))       # the serratus's lowest tooth leaves the latissimus
N("O_ser", (15.4, 121.6, -0.6))         # the oblique's highest tooth reaches the latissimus
N("O_lat_cut", (13.4, WAIST_CUT, -3.8))

# The back.
N("AP_top", (0.0, 157.4, -6.9))         # the tendinous diamond of the trapezii
N("AP_mid", (0.0, 154.4, -8.4))
N("AP_lat", (3.0, 154.4, -8.3))
N("AP_bot", (0.0, 149.3, -9.6))
N("TR_ml", (0.0, 139.5, -10.9))         # where the trapezius's middle fibres give way to its lower
N("T12", (0.0, 127.8, -10.5))           # the trapezius's lower tip
N("IA_m", (8.1, 133.0, -11.6))          # trapezius, infraspinatus, teres major and latissimus meet
N("IA", (10.3, 131.2, -10.9))           # inferior angle of the scapula
N("EL_top", (5.3, 124.5, -11.2))        # erector spinae, where it leaves the latissimus
N("E_cut", (6.2, WAIST_CUT, -9.6))
N("CB0", (0.0, WAIST_CUT, -8.0))

# The armpit: the pectoral's fold, the latissimus and teres major's fold.
N("P_ins", ag(-5, 0.15, -0.3))           # the pectoral's tendon passes under the deltoid
N("P_mid", ag(-22, 0.225, -0.3))
N("AXF", ag(-40, 0.30, -0.4))
N("AXM", ag(268, 0.31, -0.2))
N("AXB", ag(230, 0.36, -0.4))
N("TM_top", ag(205, 0.36, -0.4))

# The upper arm.
N("D_br", ag(40, 0.34, -0.3))            # deltoid, biceps and brachialis meet
N("V_ant", ag(76, 0.43, -0.25))           # the deltoid's V, front and back of its tendon
N("V_post", ag(98, 0.44, -0.25))
N("D_tri", ag(158, 0.26, -0.35))          # the triceps's long head appears under the deltoid
N("BR_top", ag(104, 0.70, -0.2))         # brachioradialis origin, on the lateral ridge
N("LE_a", ag(118, 0.94, -0.1))           # lateral epicondyle, above
N("TT_top", ag(185, 0.63, -0.15))         # triceps tendon plate
N("TT_bl", ag(150, 0.95, -0.1))
N("TT_bm", ag(215, 0.95, -0.1))
N("ME_a", ag(250, 0.97, -0.1))           # medial epicondyle, above
N("B_med_low", ag(-72, 0.92, -0.25))      # the biceps's lower corners
N("B_lat_low", ag(40, 0.92, -0.25))
N("B_tip", ag(-2, 1.03, -0.5))           # its tendon, into the elbow's hollow

# The forearm.
N("LE_b", fg(118, 0.07, -0.1))           # lateral epicondyle, below
N("UL_top", fg(192, 0.12, -0.15))         # top of the ulna's crest
N("ME_b", fg(252, 0.06, -0.1))           # medial epicondyle, below
N("FC_1", fg(38, FOREARM_CUT))     # round the forearm's cut
N("FC_2", fg(100, FOREARM_CUT))
N("FC_3", fg(205, FOREARM_CUT))
N("FC_4", fg(300, FOREARM_CUT))


# ------------------------------------------------------------------- edges
#
# Each edge: its cage segments, the points it passes through, the frame it
# follows, and its crease — 1 at a cut's rim, about 0.5 at a real groove
# (the deltopectoral, under the pectoral's rolled lower edge), 0.3 where
# two muscles merely meet, 0 inside a muscle.

G = L.edge

# The neck, and its cut.
G("NF0", "N_scmA", 2, frame=NK, crease=1.0)
G("N_scmA", "N_scmP", 2, frame=NK, crease=1.0)
G("N_scmP", "N_trapA", 2, frame=NK, crease=1.0)
G("N_trapA", "NB0", 3, frame=NK, crease=1.0)
G("NB0", "NF0", 4, mid=True)
G("NF0", "JN", 9, via=[(0, 155.2, 5.3), (0, 151.6, 4.5)], mid=True)
G("N_scmA", "S_st", 9, via=[(2.7, 155.0, 5.2), (2.1, 151.4, 6.0)], crease=0.5)
G("S_st", "JN", 1)
G("SC_top", "S_st", 1)
G("SC_top", "S_cl", 2, via=[(4.9, 150.0, 6.4)], crease=0.2)
G("N_scmP", "S_cl", 9, via=[(6.4, 155.0, 2.2), (6.9, 152.2, 4.1)], crease=0.5)
G("N_trapA", "T_cl", 9, via=[(6.2, 155.8, -2.0), (9.0, 153.4, 0.4), (11.4, 151.6, 2.2)], crease=0.45)
G("S_cl", "T_cl", 2, via=[(10.0, 150.4, 5.5)], crease=0.2)

# The clavicle.
G("T_cl", "AC_top", 2, via=[(15.2, 150.8, 2.3)], crease=0.2)
G("AC_top", "AC_bot", 2, crease=0.3)
G("SC_bot", "SC_top", 2, crease=0.3)
G("SC_bot", "DP_cl", 4, via=[(5.2, 148.3, 6.7), (7.6, 148.5, 6.6), (10.2, 148.7, 5.8)], crease=0.4)
G("DP_cl", "AC_bot", 2, via=[(15.5, 149.2, 2.6)], crease=0.4)

# The sternum.
G("JN", "XI", 10, via=[(0, 146.0, 6.4), (0, 141.0, 8.2), (0, 134.0, 9.0)], mid=True)
G("SC_bot", "XI_lat", 8, via=[(2.0, 144.0, 8.7), (1.6, 137.0, 9.8), (1.5, 132.0, 9.9)], crease=0.35)
G("XI_lat", "LA_top", 1, crease=0.3)
G("LA_top", "XI", 1, crease=0.3)

# The pectoral: clavicular and sternocostal parts, its rolled lower edge,
# the deltopectoral groove.
G("SC_bot", "P_mid", 7, via=[(6.2, 145.2, 9.9), (10.4, 142.6, 11.0), (14.6, 140.3, 9.4)])
G("P_ins", "DP_cl", 7, via=[(14.2, 146.6, 5.3), (16.0, 144.2, 5.2), (17.6, 142.2, 4.9)], crease=0.65)
G("P_mid", "P_ins", 1, frame=UA, crease=0.3, guide=ARM, dr=-0.3)
G("XI_lat", "R_top_lat", 2, via=[(4.8, 127.3, 10.5)], crease=0.7)
G("R_top_lat", "S_front_d", 2, via=[(10.6, 128.0, 9.9)], crease=0.7)
G("S_front_d", "S_front", 1, crease=0.65)
G("S_front", "AXF", 2, via=[(15.8, 133.4, 5.3)], crease=0.6)
G("AXF", "P_mid", 2, frame=UA, crease=0.3, guide=ARM, dr=-0.3)

# The deltoid: its origin round the acromion, its heads, its V.
G("AC_bot", "ACR_tip", 1, crease=0.55)
G("ACR_tip", "ACR_lat", 2, crease=0.7)
G("ACR_lat", "ACR_post", 2, crease=0.7)
G("ACR_tip", "V_ant", 12, frame=UA, via=[ag(45, 0.12), ag(60, 0.28)], crease=0.2, guide=ARM, dr=-0.15)
G("ACR_post", "V_post", 12, frame=UA, via=[ag(128, 0.12), ag(118, 0.29)], crease=0.2, guide=ARM, dr=-0.15)
G("V_ant", "D_br", 2, frame=UA, crease=0.5, guide=ARM, dr=-0.3)
G("D_br", "P_ins", 3, frame=UA, via=[ag(18, 0.25)], crease=0.55, guide=ARM, dr=-0.35)
G("V_post", "V_ant", 1, frame=UA, crease=0.35, guide=ARM, dr=-0.25)
G("ACR_post", "SPL_1", 4, via=[(17.4, 146.9, -6.5)], crease=0.5)
G("SPL_1", "SP_del", 2, crease=0.5)
G("SP_del", "D_tri", 8, via=[(15.6, 141.8, -9.3), (19.4, 140.0, -7.9)], crease=0.6)
G("D_tri", "V_post", 4, frame=UA, via=[ag(125, 0.36)], crease=0.6, guide=ARM, dr=-0.45)

# The acromion and the spine of the scapula.
G("AC_top", "ACR_m", 3, crease=0.3)
G("ACR_m", "SPU_1", 6, via=[(16.1, 149.2, -5.3)], crease=0.5)
G("SPU_1", "SPR_top", 6, via=[(11.0, 144.9, -9.4)], crease=0.5)
G("SPR_top", "SPR_bot", 2, crease=0.3)
G("SP_del", "SPR_bot", 4, via=[(9.7, 142.2, -10.6)], crease=0.5)

# The trapezius and its tendinous diamond.
G("AP_lat", "AP_top", 2, via=[(1.6, 156.1, -7.6)], crease=0.45)
G("AP_top", "NB0", 1, mid=True)
G("ACR_m", "AP_lat", 6, via=[(12.4, 151.6, -5.4), (7.4, 153.3, -7.4)])
G("AP_lat", "AP_bot", 2, via=[(1.5, 151.7, -9.2)], crease=0.45)
G("AP_top", "AP_mid", 2, via=[(0, 155.9, -7.8)], mid=True)
G("AP_mid", "AP_bot", 2, mid=True)
G("AP_bot", "TR_ml", 4, via=[(0, 144.4, -10.4)], mid=True)
G("TR_ml", "SPR_top", 6, via=[(4.2, 141.0, -11.3)])
G("TR_ml", "T12", 5, via=[(0, 133.6, -10.9)], mid=True)
G("T12", "IA_m", 3, via=[(4.4, 130.6, -11.5)], crease=0.5)
G("IA_m", "SPR_bot", 3, via=[(8.0, 137.0, -12.0)], crease=0.55)

# Infraspinatus, teres major, the latissimus.
G("D_tri", "TM_top", 1, crease=0.35)
G("TM_top", "IA_m", 3, via=[(15.6, 134.4, -9.4), (11.8, 133.6, -11.4)], crease=0.5)
G("IA", "IA_m", 1, crease=0.3)
G("TM_top", "AXB", 1, frame=UA, crease=0.3, guide=ARM, dr=-0.35)
G("AXB", "IA", 3, via=[(14.0, 131.6, -9.4)], crease=0.5)
G("T12", "EL_top", 2, via=[(2.8, 126.4, -11.1)], crease=0.3)
G("EL_top", "E_cut", 6, via=[(5.8, 118.0, -11.1), (6.1, 112.0, -10.4)], crease=0.5)
G("E_cut", "O_lat_cut", 3, frame=T, via=[tr(127, WAIST_CUT, 13.1)], crease=1.0)
G("O_lat_cut", "O_ser", 4, frame=T, via=[tr(98, 113.8, 14.6)], crease=0.45)
G("O_ser", "O_ser_u", 1, crease=0.3)
G("O_ser_u", "AXB", 2, via=[(16.5, 128.6, -2.8)], crease=0.45)

# The serratus: into the armpit, and its teeth against the oblique.
G("AXF", "AXM", 2, frame=UA, crease=0.3, guide=ARM, dr=-0.35)
G("AXM", "AXB", 2, frame=UA, crease=0.3, guide=ARM, dr=-0.35)
G("O_ser_u", "S_front", 4, via=[(15.4, 126.7, 2.3), (14.6, 129.1, 5.3)], crease=0.45)     # serratus side
G("O_ser", "S_front_d", 4, via=[(15.3, 123.8, 2.6), (14.1, 126.6, 5.9)], crease=0.45)     # oblique side

# The abdomen: the rectus's borders and tendinous intersections, the
# linea alba, the navel.
G("R_top_lat", "R_1_lat", 2, crease=0.3)
G("R_1_lat", "R_2_lat", 2, via=[(8.5, 121.0, 10.5)], crease=0.45)
G("R_2_lat", "R_3_lat", 2, via=[(8.2, 114.3, 10.55)], crease=0.45)
G("R_3_lat", "R_semi_cut", 2, crease=0.3)
G("R_semi_cut", "O_lat_cut", 6, frame=T, via=[tr(60, WAIST_CUT, 13.3), tr(85, WAIST_CUT, 14.1)], crease=1.0)
G("LA_top", "LA_1", 2, crease=0.4)
G("LA_1", "LA_2", 2, crease=0.4)
G("LA_2", "LA_3", 2, crease=0.4)
G("LA_3", "LA_cut", 2, crease=0.25)
G("R_1_lat", "LA_1", 3, via=[(4.6, 124.0, 10.6)], crease=0.5)
G("R_2_lat", "LA_2", 3, via=[(4.5, 117.2, 10.8)], crease=0.5)
G("R_3_lat", "LA_3", 3, via=[(4.3, 110.8, 10.9)], crease=0.45)
G("LA_cut", "R_semi_cut", 3, frame=T, crease=1.0)
G("CF0", "LA_cut", 1, crease=1.0)
G("XI", "UM", 7, via=[(0, 122.0, 9.9), (0, 115.0, 10.2)], mid=True)
G("UM", "CF0", 1, mid=True)

# The lower back and the waist's cut.
G("CB0", "E_cut", 2, frame=T, crease=1.0)
G("T12", "CB0", 6, via=[(0, 118.0, -9.7), (0, 111.0, -8.5)], mid=True, crease=0.4)
G("CB0", "CF0", 9, mid=True)

# The upper arm.
G("B_lat_low", "D_br", 8, frame=UA, via=[ag(38, 0.62)], crease=0.6, guide=ARM, dr=-0.45)
G("V_post", "BR_top", 4, frame=UA, via=[ag(100, 0.57)], crease=0.55, guide=ARM, dr=-0.4)
G("BR_top", "B_lat_low", 4, frame=UA, via=[ag(72, 0.82)], crease=0.55, guide=ARM, dr=-0.45)
G("AXM", "B_med_low", 11, frame=UA, via=[ag(283, 0.58)], crease=0.65, guide=ARM, dr=-0.55)
G("B_med_low", "B_tip", 2, frame=UA, via=[ag(-36, 0.96)], crease=0.35, guide=ARM, dr=-0.35)
G("B_tip", "B_lat_low", 2, frame=UA, via=[ag(20, 0.98)], crease=0.35, guide=ARM, dr=-0.35)
G("BR_top", "LE_a", 7, frame=UA, via=[ag(112, 0.82)], crease=0.3, guide=ARM, dr=-0.25)
G("TT_top", "D_tri", 11, frame=UA, via=[ag(172, 0.45)], guide=ARM, dr=-0.15)
G("LE_a", "TT_bl", 2, frame=UA, crease=0.3, guide=ARM, dr=-0.2)
G("TT_bl", "TT_top", 4, frame=UA, via=[ag(165, 0.80)], crease=0.6, guide=ARM, dr=-0.3)
G("TT_top", "TT_bm", 4, frame=UA, via=[ag(203, 0.80)], crease=0.6, guide=ARM, dr=-0.3)
G("TT_bm", "TT_bl", 2, frame=UA, via=[ag(182, 0.97)], crease=0.3, guide=ARM, dr=-0.15)
G("ME_a", "TT_bm", 1, frame=UA, crease=0.3, guide=ARM, dr=-0.2)
G("B_med_low", "ME_a", 1, frame=UA, crease=0.3, guide=ARM, dr=-0.2)

# The elbow and the forearm, and its cut.
G("LE_a", "LE_b", 2, crease=0.3, guide=ARM, dr=-0.15)
G("LE_b", "UL_top", 3, frame=FA, via=[fg(160, 0.08)], crease=0.3, guide=ARM, dr=-0.2)
G("UL_top", "ME_b", 2, frame=FA, via=[fg(225, 0.07)], crease=0.3, guide=ARM, dr=-0.2)
G("ME_b", "ME_a", 1, crease=0.3, guide=ARM, dr=-0.15)
G("LE_b", "FC_2", 5, frame=FA, via=[fg(108, 0.28)], crease=0.5, guide=ARM, dr=-0.35)
G("FC_1", "B_tip", 8, frame=FA, via=[fg(26, 0.34), fg(10, 0.18)], crease=0.5, guide=ARM, dr=-0.35)
G("FC_2", "FC_1", 3, frame=FA, crease=1.0, guide=ARM, dr=0.0)
G("FC_2", "FC_3", 3, frame=FA, crease=1.0, guide=ARM, dr=0.0)
G("FC_3", "UL_top", 5, frame=FA, via=[fg(200, 0.3)], crease=0.6, guide=ARM, dr=-0.4)
G("FC_3", "FC_4", 3, frame=FA, crease=1.0, guide=ARM, dr=0.0)
G("FC_4", "FC_1", 3, frame=FA, crease=1.0, guide=ARM, dr=0.0)


# ----------------------------------------------------------------- patches
#
# patch(region, the node cycle, (c0, c1, c2, c3)): rows of quads run from the
# side c0 -> c1 (the origin) to c2 -> c3 (the insertion), each row from rail
# A (c3 -> c0) across to rail B (c1 -> c2). `across` places a ridge between
# the rails, 0 on rail A and 1 on rail B.

P = L.patch


def ridge(across, *points, frame=None):
    """A crest placed absolutely (bone: the clavicle, the spine of the scapula)."""
    return {"across": across, "points": [np.asarray(p, float) for p in points], "frame": frame}


def lift(across, *heights, crest=0.0):
    """A muscle's belly: cm above the taut surface between its borders, from
    its origin to its insertion, along the line `across` its rows. `crest`
    creases that line, so the belly turns as two planes meeting at a crest
    rather than as a dome."""
    return {"across": across, "height": list(heights), "crease": crest}


# The neck.
P("infrahyoid", ["NF0", "N_scmA", "S_st", "JN"], ("NF0", "N_scmA", "S_st", "JN"))
P("sternocleidomastoid", ["N_scmA", "N_scmP", "S_cl", "SC_top", "S_st"], ("N_scmA", "N_scmP", "S_cl", "S_st"),
  ridges=[lift(0.35, 0.5, 0.8, 0.8, 0.5)])
P("scalenes", ["N_scmP", "N_trapA", "T_cl", "S_cl"], ("N_scmP", "N_trapA", "T_cl", "S_cl"),
  pins=[(0.8, 0.5, (10.0, 151.4, 2.0))])                       # the hollow above the clavicle

# Sternum and clavicle.
P("sternum", ["JN", "S_st", "SC_top", "SC_bot", "XI_lat", "LA_top", "XI"], ("JN", "SC_top", "XI_lat", "XI"))
P("clavicle", ["SC_bot", "SC_top", "S_cl", "T_cl", "AC_top", "AC_bot", "DP_cl"], ("SC_bot", "SC_top", "AC_top", "AC_bot"),
  ridges=[ridge(0.5, (2.75, 149.0, 6.6), (5.0, 149.3, 6.75), (7.4, 149.5, 6.6), (10.2, 149.7, 5.9),
                (12.8, 149.9, 4.7), (15.3, 150.1, 2.7), (17.55, 150.2, 0.3)) | {"crease": 0.3}])

# The pectoral.
P("pectoralis-major", ["DP_cl", "SC_bot", "P_mid", "P_ins"], ("DP_cl", "SC_bot", "P_mid", "P_ins"), name="pec-clavicular",
  widths=[4, 5, 5, 4, 3, 2, 1],
  ridges=[lift(0.5, 0.1, 0.6, 1.0, 1.0, 0.3, crest=0.15)])
P("pectoralis-major", ["SC_bot", "XI_lat", "R_top_lat", "S_front_d", "S_front", "AXF", "P_mid"], ("SC_bot", "XI_lat", "AXF", "P_mid"),
  name="pec-sternocostal", widths=[8, 8, 7, 6, 5, 4, 2],
  ridges=[lift(0.3, 0.3, 1.2, 1.6, 1.2, 0.3, crest=0.15), lift(0.72, 0.7, 2.6, 3.0, 2.0, 0.5, crest=0.3)])

# The deltoid, in three heads meeting at its V.
P("deltoid", ["DP_cl", "AC_bot", "ACR_tip", "V_ant", "D_br", "P_ins"], ("DP_cl", "ACR_tip", "V_ant", "V_ant"),
  name="deltoid-anterior", widths=[3, 5, 5, 4, 3, 2, 1, 0], guide=ARM)
P("deltoid", ["ACR_tip", "ACR_lat", "ACR_post", "V_post", "V_ant"], ("ACR_tip", "ACR_post", "V_post", "V_ant"),
  name="deltoid-middle", widths=[4, 6, 6, 5, 4, 3, 2, 1], guide=ARM)
P("deltoid", ["ACR_post", "SPL_1", "SP_del", "D_tri", "V_post"], ("ACR_post", "SP_del", "V_post", "V_post"),
  name="deltoid-posterior", widths=[6, 6, 5, 4, 3, 2, 1, 0], guide=ARM)

# The acromion and the spine of the scapula: one bony ridge.
P("scapular-spine", ["AC_bot", "AC_top", "ACR_m", "SPU_1", "SPR_top", "SPR_bot", "SP_del", "SPL_1", "ACR_post",
                     "ACR_lat", "ACR_tip"], ("AC_bot", "AC_top", "SPR_top", "SPR_bot"),
  ridges=[ridge(0.5, (17.6, 150.2, 0.2), (19.2, 150.45, -1.4), (19.0, 149.8, -3.7), (16.2, 147.4, -6.6),
                (13.0, 145.4, -8.7), (10.4, 143.6, -10.2), (8.1, 142.0, -11.2)) | {"crease": 0.45}])

# The trapezius: descending, transverse and ascending parts, and its diamond.
P("trapezius", ["AP_lat", "AP_top", "NB0", "N_trapA", "T_cl", "AC_top", "ACR_m"], ("NB0", "N_trapA", "T_cl", "ACR_m"),
  name="trapezius-upper",
  ridges=[lift(0.55, 0.0, 0.5, 0.7, 0.4)])
P("trapezius-aponeurosis", ["AP_top", "AP_lat", "AP_bot", "AP_mid"], ("AP_top", "AP_lat", "AP_bot", "AP_mid"))
P("trapezius", ["AP_lat", "AP_bot", "TR_ml", "SPR_top", "SPU_1", "ACR_m"], ("AP_lat", "TR_ml", "SPR_top", "ACR_m"),
  name="trapezius-middle",
  ridges=[lift(0.5, 0.2, 0.7, 0.8, 0.5, crest=0.25)])
P("trapezius", ["TR_ml", "T12", "IA_m", "SPR_bot", "SPR_top"], ("TR_ml", "T12", "SPR_bot", "SPR_top"),
  name="trapezius-lower",
  ridges=[lift(0.5, 0.2, 0.6, 0.6, 0.3)])

# The scapular muscles and the latissimus.
P("infraspinatus", ["IA_m", "SPR_bot", "SP_del", "D_tri", "TM_top"], ("IA_m", "SPR_bot", "SP_del", "D_tri"),
  ridges=[lift(0.5, 0.2, 0.6, 0.7, 0.4, crest=0.3)])
P("teres-major", ["IA", "IA_m", "TM_top", "AXB"], ("IA", "IA_m", "TM_top", "AXB"),
  ridges=[lift(0.5, 0.2, 0.6, 0.4)])
P("latissimus-dorsi", ["T12", "EL_top", "E_cut", "O_lat_cut", "O_ser", "O_ser_u", "AXB", "IA", "IA_m"],
  ("T12", "O_lat_cut", "AXB", "AXB"), widths=[11, 10, 9, 7, 5, 3, 0],
  ridges=[lift(0.35, 0.2, 0.6, 0.7, 0.5, crest=0.2), lift(0.75, 0.3, 0.9, 1.2, 1.0, 0.6, crest=0.25)])

# The side of the trunk.
P("serratus-anterior", ["AXF", "AXM", "AXB", "O_ser_u", "S_front"], ("AXF", "AXB", "O_ser_u", "S_front"))
L.teeth(("O_ser_u", "S_front"), ("O_ser", "S_front_d"), "serratus-anterior", "external-oblique", crease=0.65,
        name="serratus-teeth")
P("external-oblique", ["O_lat_cut", "O_ser", "S_front_d", "R_top_lat", "R_1_lat", "R_2_lat", "R_3_lat", "R_semi_cut"],
  ("O_lat_cut", "O_ser", "R_top_lat", "R_semi_cut"),
  ridges=[lift(0.35, 0.3, 0.9, 0.8, 0.3)])

# The abdomen: four segments of the rectus between its intersections.
for i, (top, bot, pts) in enumerate((
        (("LA_top", "XI_lat", "R_top_lat"), ("R_1_lat", "LA_1"), [(3.3, 125.8, 10.9), (6.1, 125.6, 10.95)]),
        (("LA_1", "R_1_lat"), ("R_2_lat", "LA_2"), [(3.3, 120.6, 11.15), (6.1, 120.8, 11.1)]),
        (("LA_2", "R_2_lat"), ("R_3_lat", "LA_3"), [(3.3, 113.9, 11.25), (6.0, 114.2, 11.2)]),
        (("LA_3", "R_3_lat"), ("R_semi_cut", "LA_cut"), [(3.2, 108.3, 11.3), (5.7, 108.3, 11.15)]))):
    cyc = list(top) + list(bot)
    P("rectus-abdominis", cyc, (top[0], top[-1], bot[0], bot[1]), name="rectus-%d" % (i + 1),
      rows=[{"u": 0.5, "points": pts}])
P("linea-alba", ["XI", "LA_top", "LA_1", "LA_2", "LA_3", "LA_cut", "CF0", "UM"], ("XI", "LA_top", "LA_cut", "CF0"))
P("erector-spinae", ["CB0", "E_cut", "EL_top", "T12"], ("CB0", "E_cut", "EL_top", "T12"),
  ridges=[lift(0.55, 0.6, 1.0, 1.0, 0.7, crest=0.3)])

# The arm.
P("brachialis", ["D_br", "V_ant", "V_post", "BR_top", "B_lat_low"], ("D_br", "V_post", "B_lat_low", "B_lat_low"),
  widths=[3, 3, 3, 3, 2, 2, 1, 0], guide=ARM)
P("biceps-brachii", ["P_ins", "P_mid", "AXF", "AXM", "B_med_low", "B_tip", "B_lat_low", "D_br"],
  ("P_ins", "AXM", "B_med_low", "B_lat_low"), guide=ARM)
P("triceps-brachii", ["D_tri", "V_post", "BR_top", "LE_a", "TT_bl", "TT_top"], ("D_tri", "V_post", "LE_a", "TT_top"),
  name="triceps-lateral", guide=ARM)
P("triceps-brachii", ["TM_top", "AXB", "AXM", "B_med_low", "ME_a", "TT_bm", "TT_top", "D_tri"],
  ("TM_top", "AXM", "ME_a", "TT_top"), name="triceps-long", guide=ARM)
P("triceps-tendon", ["TT_top", "TT_bm", "TT_bl"], ("TT_top", "TT_top", "TT_bm", "TT_bl"))
P("elbow", ["LE_a", "LE_b", "UL_top", "ME_b", "ME_a", "TT_bm", "TT_bl"], ("LE_a", "LE_b", "ME_b", "ME_a"),
  ridges=[ridge(0.5, ag(114, 0.99, 0.25), ag(150, 1.02, 0.15), ag(182, 1.05, 0.2), ag(215, 1.02, 0.15),
                ag(245, 0.99, 0.15), frame=UA)], guide=ARM)
P("brachioradialis", ["BR_top", "LE_a", "LE_b", "FC_2", "FC_1", "B_tip", "B_lat_low"], ("BR_top", "BR_top", "FC_2", "FC_1"),
  widths=[0, 2, 3, 3, 3, 3, 3], guide=ARM)
P("forearm-extensors", ["UL_top", "LE_b", "FC_2", "FC_3"], ("UL_top", "LE_b", "FC_2", "FC_3"),
  guide=ARM)
P("forearm-flexors", ["ME_b", "ME_a", "B_med_low", "B_tip", "FC_1", "FC_4", "FC_3", "UL_top"], ("ME_a", "B_tip", "FC_1", "FC_3"),
  widths=[3, 5, 6, 6, 6, 6], guide=ARM)

# The cuts.
P("cut", ["NF0", "N_scmA", "N_scmP", "N_trapA", "NB0"], ("NF0", "N_scmA", "N_trapA", "NB0"), name="cut-neck")
P("cut", ["CF0", "LA_cut", "R_semi_cut", "O_lat_cut", "E_cut", "CB0"], ("CF0", "R_semi_cut", "E_cut", "CB0"),
  name="cut-waist")
P("cut", ["FC_1", "FC_2", "FC_3", "FC_4"], ("FC_1", "FC_2", "FC_3", "FC_4"), name="cut-forearm")


# --------------------------------------------------------------- landmarks
#
# A handful of points the app can later hang information on. They are
# authored here beside the structure they belong to and snapped onto the
# surface when the file is built; `bilateral` ones exist on both sides.

LANDMARKS = [
    # id, region, type, approximate position (left side), bilateral
    ("jugular-notch", "sternum", "bony", (0.0, 148.1, 5.3), False),
    ("clavicle-crest", "clavicle", "bony", (7.4, 149.5, 7.0), True),
    ("acromion", "scapular-spine", "bony", (19.3, 150.4, -1.4), True),
    ("spine-root", "scapular-spine", "bony", (9.4, 142.9, -10.8), True),
    ("pectoral-centre", "pectoralis-major", "centroid", (8.4, 133.2, 12.3), True),
    ("deltoid-insertion", "deltoid", "insertion", (25.6, 135.0, -1.1), True),
]


# ------------------------------------------------------ sculptural states
#
# state:arm-raised — the arm lifted about 18° from the side (abduction about
# the humeral head, front-to-back axis). The arm turns wholly; the deltoid
# blends from its origin to its insertion; the pectoral, latissimus, teres
# and serratus follow near where they reach the arm; the girdle rises a
# little. One authored state on the same topology, not a rig.

RAISE_DEG = 18.0
ARM = {"biceps-brachii", "brachialis", "triceps-brachii", "triceps-tendon", "elbow", "brachioradialis",
       "forearm-flexors", "forearm-extensors"}


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def raise_weight(p, regions):
    near = {"pectoralis-major": [L.nodes["P_ins"], L.nodes["AXF"]],
            "latissimus-dorsi": [L.nodes["AXB"]], "teres-major": [L.nodes["AXB"], L.nodes["TM_top"]],
            "infraspinatus": [L.nodes["D_tri"]], "serratus-anterior": [L.nodes["AXM"], L.nodes["AXF"]]}
    w = 0.0
    phi, t, r = UA.param(p)
    for reg in regions:
        if reg in ARM:
            w = max(w, 1.0)
        elif reg == "deltoid":
            w = max(w, 0.35 + 0.65 * smoothstep(-0.12, 0.40, t))
        elif reg in near:
            d = min(np.linalg.norm(p - q) for q in near[reg])
            w = max(w, 0.85 * float(np.exp(-(d / 7.0) ** 2)))
        elif reg in ("scapular-spine", "clavicle"):
            w = max(w, 0.12 * smoothstep(8.0, 20.0, p[0]))
        elif reg == "trapezius":
            w = max(w, 0.08 * smoothstep(10.0, 18.0, p[0]))
        elif reg == "cut-forearm":                       # the forearm's cut face (by patch)
            w = max(w, 1.0)
    return w


def arm_raised(cage_atlas, vertex_regions, midline):
    """The cage turned into state:arm-raised (ATLAS cm). The midline never
    moves: the state must keep the mirror's seam where it is."""
    out = cage_atlas.copy()
    for i, p in enumerate(cage_atlas):
        w = raise_weight(p, vertex_regions[i])
        if w < 0.01 or i in midline:
            continue
        a = np.radians(RAISE_DEG * w)
        c, s = np.cos(a), np.sin(a)
        d = p - H
        out[i] = H + np.array([d[0] * c - d[1] * s, d[0] * s + d[1] * c, d[2]])
    return out


# -------------------------------------------------------------------- build

def build(blend_path, glb_path, summary_path=None):
    import json
    import bpy
    import blend as bl
    import export_glb

    cage = at.Cage(L)
    bad = at.check_manifold(cage)
    if bad:
        raise RuntimeError("cage is not closed: %d edges, e.g. %s" % (len(bad), bad[:5]))
    at.fair(cage)
    info = at.report(cage)

    bl.reset_scene()
    obj = bl.build_object(cage, list(REGIONS), region_colors())
    # A damped fit: the limit surface comes within a few millimetres of the
    # placed curves while the cage stays calm enough to edit by hand.
    iters = int(os.environ.get("ATLAS_FIT_ITERATIONS", "4"))
    rate = float(os.environ.get("ATLAS_FIT_RATE", "0.6"))
    fit_max, fit_p95 = bl.fit_to_limit(obj, bl.to_blender(np.array(cage.pos)), cage.midline,
                                       iterations=iters, rate=rate)

    # Landmarks, snapped onto the subdivided surface.
    V, Tri = bl.evaluated_surface(obj)
    for ident, region, kind, p, bilateral in LANDMARKS:
        q = bl.closest_on_surface(np.array([p], float), V, Tri)[0]
        e = bl.add_landmark(ident, q, region, kind)
        e["bilateral"] = bilateral

    # The authored state, from the fitted cage.
    vregions = [set() for _ in cage.pos]
    for f, r, pname in zip(cage.faces, cage.face_region, cage.face_patch):
        for v in f:
            vregions[v].add(r)
            if pname == "cut-forearm":
                vregions[v].add(pname)
    base = bl.to_atlas(bl.cage_coords(obj))
    bl.add_shape_key(obj, "state:arm-raised", bl.to_blender(arm_raised(base, vregions, cage.midline)))

    # The export script travels inside the .blend, for hand edits.
    txt = bpy.data.texts.new("export_glb.py")
    txt.from_string(open(os.path.join(HERE, "export_glb.py")).read())

    bpy.context.preferences.filepaths.save_version = 0      # no .blend1 backups beside the source
    bpy.ops.wm.save_as_mainfile(filepath=blend_path, compress=True)
    export_glb.export(glb_path)
    V2, T2 = bl.evaluated_surface(obj)
    info.update(inverted_triangles=bl.inverted_triangles(V2, T2))
    info.update(fit_max_cm=round(fit_max, 3), fit_p95_cm=round(fit_p95, 3),
                cage_vertices=len(obj.data.vertices), cage_faces=len(obj.data.polygons))
    if summary_path:
        with open(summary_path, "w") as fh:
            json.dump(info, fh, indent=1)
    return info


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    blend_out = args[0] if len(args) > 0 else os.path.join(ROOT, "assets", "anatomy", "torso-study.blend")
    glb_out = args[1] if len(args) > 1 else os.path.join(ROOT, "assets", "anatomy", "torso-study.glb")
    summary = args[2] if len(args) > 2 else None
    info = build(blend_out, glb_out, summary)
    print("torso study:", {k: v for k, v in info.items() if k != "regions"})
