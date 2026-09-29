"""
Authors ATLAS's anatomical regions on the Male_Body sculpture: every face of
Mesh_0 in assets/anatomy/Male_Body.blend is given to one region, as one
material per region (the material's name is the region id, e.g.
"pectoralis-major.L"). Faces no region claims keep the sculpture's own
material, atlas-stone, and export as the unselectable "body".

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python tools/anatomy/authored/male_body_regions.py [-- --preview <dir>] [--out <file.blend>]

--preview writes the face labels and a summary to <dir> and saves nothing.
--out authors another copy of the sculpture in place (tests use it).
Otherwise the regions are written into Male_Body.blend, which is guarded
like the refinement (see refine_guard.py): the script replaces the .blend
only while its bytes are exactly the refined sculpture's or exactly what
this script last wrote (Male_Body.regions.json). Once anyone edits the .blend
by hand, the .blend is the source of truth and this script stops.

HOW A REGION IS AUTHORED. Nothing anatomical is computed here. Every border
is placed by hand from renders of this sculpture, as a chain of points at
landmarks it visibly shows (a crease, a notch, the edge of a mass); between
two points the border follows the sculpture's own groove, the way Blender's
"select shortest path" does when it is weighted by the surface: each mesh
edge costs its length, less where the surface lies below a smoothed copy of
itself (a sculpted groove) and more where it rises (a muscle's belly). So a
border settles into the crease the sculptor made instead of cutting across
it. Where the sculpture shows no groove, the border runs straight on the
surface between the points, which are then placed closer together.

The borders cut the surface into cells; a seed point inside a cell names
its region. A cell with no seed stays body. A cell reached by two different
seeds means a border has a gap, and the script stops. So a muscle whose
edges this sculpture does not show is left out rather than guessed.

Points are given as they are read off orthographic renders, in the .blend's
own frame (z up, the figure faces -y, +x its left, the generator's units:
the figure is 1.90 tall):

  ("front", x, z)   cast along +y onto the front      ("back", x, z)   along -y
  ("left", y, z)    from the figure's left, along -x  ("right", y, z)  along +x
  ("top", x, y)     from above, along -z
  ("ray", x, y, z, dx, dy, dz)   from a point inside a limb out along a
                    direction: the inner side of an arm, which faces the body
  ("limb", axis, deg, z)   the same round a limb's own axis (AXES), read off
                    an unrolled map of the limb
  ("cyl", deg, z)   from the vertical axis outward at an angle round the body
                    (0 front, 90 its left, 180 back, 270 its right): the
                    torso's own surface, read off an unrolled map of it (a
                    hanging arm is never hit first)
  ("on", border, point)   the vertex of an earlier border nearest the point,
                          so a border that ends on another one closes on it
"""

import colorsys
import hashlib
import heapq
import json
import math
import os
import sys
from collections import deque

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True
sys.path.insert(0, HERE)
import refine_guard as guard  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
TARGET = os.path.join(ROOT, "assets", "anatomy", "Male_Body.blend")
VERSION = "male-body-regions@1"
RECORD_SUFFIX = ".regions.json"
STONE = "atlas-stone"                  # the refined sculpture's material; its faces are "body"

# The surface's grooves: how far each vertex lies below a copy of the surface
# smoothed over SMOOTH iterations (~1.5 cm), along its normal. GROOVE is the
# depth at which an edge is fully a groove; its cost then falls to FLOOR of
# its length.
SMOOTH = 60
GROOVE_BLUR = 6
GROOVE = 0.0025
FLOOR = 0.3
SNAP = 0.006                           # a hand-placed point moves to the deepest groove this close
# The second pass of a border: the groove found by the first, smoothed over
# PATH_SMOOTH of its length, is followed within CORRIDOR, straying from it
# at a cost that grows with the square of the distance over PATH_SIGMA.
PATH_SMOOTH = 0.030
CORRIDOR = 0.012
PATH_SIGMA = 0.003

# ----------------------------------------------------------------- regions
# Limbs' axes, for points read off their unrolled maps: (x, y, z) at two heights.
AXES = {
    "thigh.L": (0.110, -0.040, 0.05, 0.095, -0.050, -0.30),
    "thigh.R": (-0.120, -0.060, 0.05, -0.130, -0.150, -0.30),
}

# The regions themselves (id, ATLAS region, side) are the manifest's: this
# file holds only where they are on the surface.
MANIFEST = os.path.join(ROOT, "assets", "anatomy", "male-body.manifest.json")


def manifest_regions():
    """id -> (ATLAS region, side) for every authored region of the manifest."""
    with open(MANIFEST, encoding="utf-8") as f:
        regions = json.load(f)["regions"]
    return {r["id"]: (r["atlasRegion"], r["side"]) for r in regions if r["structure"] != "form"}


REGIONS = manifest_regions()

# Named points, read off the renders and the unrolled map of the torso.
POINTS = {
    # The sternum: the notch between the clavicles' ends, and the xiphoid,
    # where the two pectorals' lower creases meet the midline.
    "sternum.top":       ("front", -0.006, 0.814),
    "xiphoid":           ("front", -0.004, 0.601),
    # Where each deltopectoral groove meets the clavicle (a small hollow) and
    # where it ends in the armpit crease.
    "deltopec.clav.R":   ("front", -0.185, 0.815),
    "deltopec.clav.L":   ("front", 0.150, 0.808),
    "axilla.R":          ("front", -0.225, 0.667),
    "axilla.L":          ("front", 0.203, 0.657),
    # The pubic crease under the belly, where each rectus border reaches it.
    "pubic.R":           ("cyl", 338, 0.215),
    "pubic.L":           ("cyl", 22, 0.215),
    # The front of each iliac crest, and the lumbar hollow behind each flank.
    "asis.R":            ("cyl", 296, 0.300),
    "asis.L":            ("cyl", 58, 0.328),
    "lumbar.R":          ("cyl", 247, 0.345),
    "lumbar.L":          ("cyl", 125, 0.345),
    # Just below where each upper arm rests against the ribcage (the surfaces
    # are joined there, from ~0.53 up to the armpit): the top of each
    # latissimus's front edge. The contact itself is left to the body.
    "lat.top.R":         ("cyl", 256, 0.508),
    "lat.top.L":         ("cyl", 112, 0.512),
    # Where each latissimus's front edge meets its lower crease.
    "latlow.R":          ("cyl", 246, 0.385),
    "latlow.L":          ("cyl", 112, 0.432),
    # The deltoid's corners: its insertion (the V on the side of the upper
    # arm), the back of the armpit, and where its rear border reaches the
    # spine of the scapula.
    "insertion.R":       ("right", -0.035, 0.618),
    "insertion.L":       ("left", 0.000, 0.605),
    "axilla.back.R":     ("back", -0.255, 0.702),
    "axilla.back.L":     ("back", 0.203, 0.657),
    "delt.spine.R":      ("top", -0.215, 0.105),
    "delt.spine.L":      ("top", 0.200, 0.098),
    # The elbow: each end of its crease in front (the outer end is the
    # biceps's), the point of its outer side, and its inner side; and where
    # the inner side of the upper arm leaves the ribcage.
    "elbow.lat.R":       ("front", -0.342, 0.440),
    "elbow.lat.L":       ("front", 0.290, 0.425),
    "elbow.out.R":       ("right", 0.003, 0.445),
    "elbow.out.L":       ("left", 0.012, 0.435),
    "elbow.in.R":        ("front", -0.275, 0.440),
    "elbow.in.L":        ("front", 0.232, 0.425),
    "arm.med.top.R":     ("ray", -0.315, 0.02, 0.515, 1, 0, 0),
    "arm.med.top.L":     ("ray", 0.290, 0.02, 0.515, -1, 0, 0),
    # The buttocks: the top of the cleft between them (below the flat of the
    # sacrum) and its bottom; each gluteus maximus's corners where its upper
    # edge meets the sacrum and the side of the hip, and where its fold
    # meets the side of the hip. The contrapposto drops the right buttock:
    # its fold sits ~5 cm below the left one.
    "sacrum.low":        ("back", 0.018, 0.215),
    "cleft.bottom":      ("back", -0.004, -0.015),
    "sacrum.L":          ("back", 0.035, 0.265),
    "sacrum.R":          ("back", -0.030, 0.250),
    "glute.side.top.L":  ("cyl", 95, 0.270),
    "glute.side.top.R":  ("cyl", 265, 0.235),
    "glute.side.low.L":  ("back", 0.182, 0.072),
    "glute.side.low.R":  ("back", -0.168, 0.024),
    # The calves: each end of the crease behind the knee (the gastrocnemius's
    # top) and of its lower edge, where its two heads end above the tendon.
    # The right knee is bent forward and its shin slopes back.
    "gastroc.top.med.L": ("back", 0.030, -0.360),
    "gastroc.top.lat.L": ("back", 0.170, -0.352),
    "gastroc.low.lat.L": ("ray", 0.070, -0.005, -0.560, 1, 0, 0),
    "gastroc.low.med.L": ("back", 0.028, -0.605),
    "gastroc.top.med.R": ("back", -0.085, -0.355),
    "gastroc.top.lat.R": ("back", -0.198, -0.348),
    "gastroc.low.lat.R": ("ray", -0.145, 0.035, -0.550, -1, 0, 0),
    "gastroc.low.med.R": ("back", -0.113, -0.582),
    # The latissimus: where its lower crease meets the column of the erector
    # beside the spine, and where its upper edge (below the scapula) does.
    "lat.med.low.R":     ("cyl", 213, 0.465),
    "lat.med.top.R":     ("cyl", 216, 0.545),
    "lat.med.low.L":     ("cyl", 168, 0.452),
    "lat.med.top.L":     ("cyl", 172, 0.555),
    # The quadriceps (one mass on this thigh: its heads are not sculpted
    # apart): the ends of its lower edge beside the kneecap, and the corners
    # of its upper edge where the sartorius's groove reaches the front of the
    # hip and where it stops short of the side of the hip.
    "quad.knee.med.L":   ("limb", "thigh.L", 305, -0.285),
    "quad.knee.lat.L":   ("limb", "thigh.L", 98, -0.275),
    "quad.top.med.L":    ("limb", "thigh.L", 355, 0.160),
    "quad.top.lat.L":    ("limb", "thigh.L", 108, 0.055),
    "quad.knee.med.R":   ("limb", "thigh.R", 48, -0.250),
    "quad.knee.lat.R":   ("limb", "thigh.R", 262, -0.275),
    "quad.top.med.R":    ("limb", "thigh.R", 2, 0.160),
    "quad.top.lat.R":    ("limb", "thigh.R", 255, 0.030),
}

# Borders: name -> points in order. A border is traced between consecutive points.
BORDERS = {
    # The sternal groove between the pectorals.
    "sternum": ["sternum.top", ("front", -0.004, 0.76), ("front", -0.003, 0.70), ("front", -0.006, 0.65), "xiphoid"],
    # Each pectoral's lower crease, out from the xiphoid and up the front fold of the armpit.
    "pec.lower.R": ["xiphoid", ("front", -0.050, 0.600), ("front", -0.100, 0.600), ("front", -0.150, 0.603),
                    ("front", -0.182, 0.608), ("front", -0.202, 0.620), ("front", -0.214, 0.638), "axilla.R"],
    "pec.lower.L": ["xiphoid", ("front", 0.050, 0.598), ("front", 0.100, 0.593), ("front", 0.140, 0.588),
                    ("front", 0.165, 0.592), ("front", 0.180, 0.610), ("front", 0.192, 0.635), "axilla.L"],
    # The deltopectoral grooves, from the clavicle down to the armpit.
    "deltopec.R": ["deltopec.clav.R", ("front", -0.205, 0.800), ("front", -0.225, 0.785), ("front", -0.240, 0.760),
                   ("front", -0.248, 0.730), ("front", -0.245, 0.695), "axilla.R"],
    "deltopec.L": ["deltopec.clav.L", ("front", 0.172, 0.795), ("front", 0.190, 0.775), ("front", 0.203, 0.745),
                   ("front", 0.210, 0.715), ("front", 0.210, 0.685), "axilla.L"],
    # The pectorals' upper edge, just below the clavicle's ridge.
    "clavicle.R": ["sternum.top", ("front", -0.050, 0.813), ("front", -0.100, 0.815), ("front", -0.150, 0.816),
                   "deltopec.clav.R"],
    "clavicle.L": ["sternum.top", ("front", 0.030, 0.812), ("front", 0.070, 0.813), ("front", 0.115, 0.812),
                   "deltopec.clav.L"],
    # The rectus abdominis's outer borders (linea semilunaris): a groove beside
    # its blocks, then the valley between the belly and each oblique, down to
    # the pubic crease; and the pubic crease itself.
    "ls.R": [("on", "pec.lower.R", ("cyl", 322, 0.600)), ("cyl", 322, 0.555), ("cyl", 324, 0.515),
             ("cyl", 321, 0.470), ("cyl", 325, 0.440), ("cyl", 328, 0.400), ("cyl", 327, 0.360),
             ("cyl", 327, 0.320), ("cyl", 330, 0.285), ("cyl", 334, 0.250), "pubic.R"],
    "ls.L": [("on", "pec.lower.L", ("cyl", 30, 0.597)), ("cyl", 29, 0.555), ("cyl", 28, 0.510),
             ("cyl", 31, 0.470), ("cyl", 32, 0.440), ("cyl", 30, 0.405), ("cyl", 30, 0.360),
             ("cyl", 30, 0.320), ("cyl", 28, 0.285), ("cyl", 25, 0.250), "pubic.L"],
    "suprapubic": ["pubic.R", ("cyl", 350, 0.200), ("cyl", 0, 0.197), ("cyl", 10, 0.200), "pubic.L"],
    # Each oblique's lower edge: the inguinal groove, then the iliac furrow round the flank.
    "inguinal.R": [("on", "ls.R", ("cyl", 330, 0.280)), ("cyl", 320, 0.286), ("cyl", 308, 0.293), "asis.R"],
    "inguinal.L": [("on", "ls.L", ("cyl", 30, 0.300)), ("cyl", 40, 0.310), ("cyl", 50, 0.320), "asis.L"],
    "iliac.R": ["asis.R", ("cyl", 285, 0.310), ("cyl", 272, 0.322), ("cyl", 259, 0.337), "lumbar.R"],
    "iliac.L": ["asis.L", ("cyl", 72, 0.337), ("cyl", 88, 0.345), ("cyl", 104, 0.350), ("cyl", 116, 0.348),
                "lumbar.L"],
    # The serratus's top edge: from the armpit down in front of the arm's
    # contact with the ribcage, and under it.
    "serr.top.R": ["axilla.R", ("cyl", 282, 0.630), ("cyl", 284, 0.580), ("cyl", 281, 0.540),
                   ("cyl", 272, 0.508), "lat.top.R"],
    "serr.top.L": ["axilla.L", ("cyl", 70, 0.630), ("cyl", 76, 0.590), ("cyl", 84, 0.550),
                   ("cyl", 95, 0.515), "lat.top.L"],
    # The latissimus's front edge down the flank, and its lower crease.
    "lat.front.R": ["lat.top.R", ("cyl", 253, 0.480), ("cyl", 251, 0.450), ("cyl", 248, 0.410), "latlow.R"],
    "lat.front.L": ["lat.top.L", ("cyl", 114, 0.480), ("cyl", 113, 0.455), "latlow.L"],
    "lat.lower.L": ["latlow.L", ("cyl", 125, 0.435), ("cyl", 140, 0.440), ("cyl", 155, 0.447), "lat.med.low.L"],
    "lat.lower.R": ["latlow.R", ("cyl", 238, 0.400), ("cyl", 228, 0.420), ("cyl", 218, 0.445), "lat.med.low.R"],
    # The latissimus's inner edge against the erector's column, and its upper edge.
    "lat.med.R": ["lat.med.low.R", ("cyl", 213, 0.490), ("cyl", 214, 0.515), "lat.med.top.R"],
    "lat.med.L": ["lat.med.low.L", ("cyl", 169, 0.480), ("cyl", 170, 0.510), "lat.med.top.L"],
    "lat.upper.R": ["lat.med.top.R", ("cyl", 225, 0.565), ("cyl", 235, 0.585), ("cyl", 243, 0.603),
                    ("cyl", 247, 0.612), ("cyl", 247, 0.580), ("cyl", 248, 0.550), ("cyl", 251, 0.528),
                    "lat.top.R"],
    "lat.upper.L": ["lat.med.top.L", ("cyl", 160, 0.565), ("cyl", 145, 0.582), ("cyl", 132, 0.600),
                    ("cyl", 127, 0.612), ("cyl", 126, 0.580), ("cyl", 125, 0.550), ("cyl", 121, 0.528),
                    "lat.top.L"],
    # Each oblique's back edge: up the side of the lumbar hollow to the latissimus.
    "oblique.back.R": ["lumbar.R", ("cyl", 246, 0.365), "latlow.R"],
    "oblique.back.L": ["lumbar.L", ("cyl", 125, 0.380), ("on", "lat.lower.L", ("cyl", 125, 0.435))],
    # The deltoid's top edge along the clavicle, over the acromion and along
    # the spine of the scapula; its rear border down to the back of the
    # armpit; its lower border across the back of the arm to the insertion;
    # and its front border up to the armpit.
    "delt.top.R": ["deltopec.clav.R", ("top", -0.210, -0.055), ("top", -0.237, -0.030), ("top", -0.258, 0.000),
                   ("top", -0.262, 0.030), ("top", -0.250, 0.060), ("top", -0.232, 0.085), "delt.spine.R"],
    "delt.top.L": ["deltopec.clav.L", ("top", 0.175, -0.050), ("top", 0.205, -0.030), ("top", 0.228, -0.005),
                   ("top", 0.238, 0.025), ("top", 0.230, 0.052), ("top", 0.215, 0.078), "delt.spine.L"],
    "delt.post.R": ["delt.spine.R", ("back", -0.218, 0.780), ("back", -0.228, 0.755), ("back", -0.240, 0.730),
                    "axilla.back.R"],
    "delt.post.L": ["delt.spine.L", ("back", 0.205, 0.775), ("back", 0.212, 0.745), ("back", 0.212, 0.710),
                    ("back", 0.207, 0.680), "axilla.back.L"],
    "delt.back.R": ["axilla.back.R", ("back", -0.280, 0.710), ("back", -0.310, 0.715), ("right", 0.100, 0.705),
                    ("right", 0.060, 0.690), ("right", 0.030, 0.665), ("right", 0.000, 0.645), "insertion.R"],
    "delt.back.L": ["axilla.back.L", ("back", 0.240, 0.660), ("back", 0.270, 0.665), ("back", 0.300, 0.662),
                    ("left", 0.100, 0.655), ("left", 0.060, 0.635), ("left", 0.030, 0.615), "insertion.L"],
    "delt.front.R": ["insertion.R", ("right", -0.055, 0.635), ("right", -0.068, 0.655), "axilla.R"],
    "delt.front.L": ["insertion.L", ("left", -0.030, 0.620), ("left", -0.050, 0.640), "axilla.L"],
    # The upper arm below the deltoid: the biceps's outer groove, the elbow's
    # crease, the inner side of the arm (shared by biceps and triceps up to
    # where it leaves the ribcage, then up to each side of the armpit), the
    # groove down the middle of the arm's outer side (the triceps's edge; the
    # brachialis between the two grooves is left to the body), and the
    # triceps's lower edge above the point of the elbow.
    "bic.lat.R": ["insertion.R", ("front", -0.343, 0.590), ("front", -0.346, 0.545), ("front", -0.347, 0.500),
                  ("front", -0.345, 0.465), "elbow.lat.R"],
    "bic.lat.L": ["insertion.L", ("front", 0.290, 0.585), ("front", 0.295, 0.545), ("front", 0.298, 0.500),
                  ("front", 0.293, 0.460), "elbow.lat.L"],
    "elbow.crease.R": ["elbow.lat.R", ("front", -0.325, 0.432), ("front", -0.300, 0.433), "elbow.in.R"],
    "elbow.crease.L": ["elbow.lat.L", ("front", 0.275, 0.412), ("front", 0.255, 0.415), "elbow.in.L"],
    "arm.med.R": ["elbow.in.R", ("ray", -0.315, 0.02, 0.470, 1, 0, 0), ("ray", -0.315, 0.02, 0.495, 1, 0, 0),
                  "arm.med.top.R"],
    "arm.med.L": ["elbow.in.L", ("ray", 0.290, 0.02, 0.460, -1, 0, 0), ("ray", 0.290, 0.02, 0.490, -1, 0, 0),
                  "arm.med.top.L"],
    "bic.med.R": ["arm.med.top.R", ("front", -0.262, 0.550), ("front", -0.258, 0.600), ("front", -0.250, 0.640),
                  "axilla.R"],
    "bic.med.L": ["arm.med.top.L", ("front", 0.212, 0.550), ("front", 0.212, 0.600), ("front", 0.210, 0.635),
                  "axilla.L"],
    "tri.med.R": ["arm.med.top.R", ("back", -0.258, 0.550), ("back", -0.256, 0.600), ("back", -0.255, 0.650),
                  "axilla.back.R"],
    "tri.med.L": ["arm.med.top.L", ("back", 0.212, 0.550), ("back", 0.207, 0.600), ("back", 0.205, 0.630),
                  "axilla.back.L"],
    "tri.lat.R": ["insertion.R", ("right", -0.005, 0.580), ("right", -0.003, 0.530), ("right", 0.000, 0.480),
                  "elbow.out.R"],
    "tri.lat.L": ["insertion.L", ("left", 0.005, 0.565), ("left", 0.008, 0.520), ("left", 0.010, 0.475),
                  "elbow.out.L"],
    "tri.low.R": ["elbow.out.R", ("back", -0.345, 0.460), ("back", -0.315, 0.465), ("back", -0.285, 0.460),
                  "elbow.in.R"],
    "tri.low.L": ["elbow.out.L", ("back", 0.318, 0.457), ("back", 0.295, 0.460), ("back", 0.265, 0.455),
                  "elbow.in.L"],
    # The gluteus maximus: the cleft, each fold, the side of each hip (the
    # hollow behind the trochanter), each upper edge, and the edge of the
    # sacrum between the upper edge and the top of the cleft.
    "cleft": ["sacrum.low", ("back", 0.012, 0.150), ("back", 0.008, 0.090), ("back", 0.003, 0.040), "cleft.bottom"],
    "gfold.L": [("on", "cleft", ("back", 0.030, 0.065)), ("back", 0.070, 0.055), ("back", 0.120, 0.055),
                ("back", 0.155, 0.060), "glute.side.low.L"],
    "gfold.R": [("on", "cleft", ("back", -0.004, 0.005)), ("back", -0.050, -0.004), ("back", -0.100, 0.000),
                ("back", -0.140, 0.012), "glute.side.low.R"],
    "glute.side.L": ["glute.side.low.L", ("cyl", 100, 0.120), ("cyl", 90, 0.160), ("cyl", 90, 0.220),
                     "glute.side.top.L"],
    "glute.side.R": ["glute.side.low.R", ("cyl", 258, 0.100), ("cyl", 270, 0.140), ("cyl", 270, 0.190),
                     "glute.side.top.R"],
    "glute.top.L": ["glute.side.top.L", ("cyl", 110, 0.295), ("cyl", 130, 0.300), ("cyl", 150, 0.295),
                    ("cyl", 165, 0.285), "sacrum.L"],
    "glute.top.R": ["glute.side.top.R", ("cyl", 250, 0.255), ("cyl", 235, 0.262), ("cyl", 215, 0.262),
                    ("cyl", 200, 0.258), "sacrum.R"],
    "sacral.L": ["sacrum.L", ("back", 0.028, 0.240), "sacrum.low"],
    "sacral.R": ["sacrum.R", ("back", -0.005, 0.232), "sacrum.low"],
    # The gastrocnemius: the crease behind the knee, the groove down the outer
    # side of the calf (in front of the lateral head), its lower edge above
    # the tendon, and the front edge of the medial head.
    "popliteal.L": ["gastroc.top.med.L", ("back", 0.080, -0.358), ("back", 0.125, -0.357), "gastroc.top.lat.L"],
    "popliteal.R": ["gastroc.top.med.R", ("back", -0.125, -0.352), ("back", -0.160, -0.350), "gastroc.top.lat.R"],
    "gastroc.lat.L": ["gastroc.top.lat.L", ("ray", 0.090, -0.020, -0.400, 1, 0, 0),
                      ("ray", 0.080, -0.005, -0.450, 1, 0, 0), ("ray", 0.090, -0.003, -0.500, 1, 0, 0),
                      "gastroc.low.lat.L"],
    "gastroc.lat.R": ["gastroc.top.lat.R", ("ray", -0.150, -0.120, -0.400, -1, 0, 0),
                      ("ray", -0.165, -0.050, -0.450, -1, 0, 0), ("ray", -0.170, 0.000, -0.500, -1, 0, 0),
                      "gastroc.low.lat.R"],
    "gastroc.low.L": ["gastroc.low.lat.L", ("back", 0.150, -0.575), ("back", 0.105, -0.582), ("back", 0.060, -0.590),
                      "gastroc.low.med.L"],
    "gastroc.low.R": ["gastroc.low.lat.R", ("back", -0.175, -0.560), ("back", -0.140, -0.565),
                      ("back", -0.110, -0.572), "gastroc.low.med.R"],
    "gastroc.med.L": ["gastroc.low.med.L", ("ray", 0.080, 0.020, -0.550, -1, 0.3, 0),
                      ("ray", 0.090, 0.020, -0.500, -1, 0.3, 0), ("ray", 0.080, 0.000, -0.450, -1, 0.3, 0),
                      ("ray", 0.090, -0.020, -0.400, -1, 0.3, 0), "gastroc.top.med.L"],
    "gastroc.med.R": ["gastroc.low.med.R", ("ray", -0.140, 0.040, -0.550, 1, 0.3, 0),
                      ("ray", -0.165, 0.000, -0.500, 1, 0.3, 0), ("ray", -0.160, -0.050, -0.450, 1, 0.3, 0),
                      ("ray", -0.150, -0.120, -0.400, 1, 0.3, 0), "gastroc.top.med.R"],
    # The quadriceps: the sartorius's groove on its inner side, from the knee
    # to the front of the hip; its upper edge across the top of the thigh,
    # below the side of the hip (the tensor fasciae latae stays body); its
    # back edge, held ~25 degrees behind the thigh's outer midline because the
    # sculpture does not show where it meets the hamstrings; and the top of
    # the kneecap.
    "quad.med.L": ["quad.knee.med.L", ("limb", "thigh.L", 310, -0.230), ("limb", "thigh.L", 318, -0.180),
                   ("limb", "thigh.L", 325, -0.120), ("limb", "thigh.L", 330, -0.060),
                   ("limb", "thigh.L", 336, 0.000), ("limb", "thigh.L", 342, 0.050),
                   ("limb", "thigh.L", 348, 0.100), "quad.top.med.L"],
    "quad.top.L": ["quad.top.med.L", ("limb", "thigh.L", 20, 0.150), ("limb", "thigh.L", 45, 0.130),
                   ("limb", "thigh.L", 70, 0.100), ("limb", "thigh.L", 90, 0.075), "quad.top.lat.L"],
    "quad.back.L": ["quad.top.lat.L", ("limb", "thigh.L", 113, 0.000), ("limb", "thigh.L", 115, -0.080),
                    ("limb", "thigh.L", 115, -0.160), ("limb", "thigh.L", 110, -0.230), "quad.knee.lat.L"],
    "quad.low.L": ["quad.knee.lat.L", ("limb", "thigh.L", 80, -0.278), ("limb", "thigh.L", 55, -0.268),
                   ("limb", "thigh.L", 30, -0.262), ("limb", "thigh.L", 8, -0.262), ("limb", "thigh.L", 340, -0.275),
                   ("limb", "thigh.L", 320, -0.285), "quad.knee.med.L"],
    "quad.med.R": ["quad.knee.med.R", ("limb", "thigh.R", 44, -0.210), ("limb", "thigh.R", 40, -0.150),
                   ("limb", "thigh.R", 38, -0.090), ("limb", "thigh.R", 33, -0.030), ("limb", "thigh.R", 25, 0.040),
                   ("limb", "thigh.R", 15, 0.100), ("limb", "thigh.R", 8, 0.140), "quad.top.med.R"],
    "quad.top.R": ["quad.top.med.R", ("limb", "thigh.R", 340, 0.150), ("limb", "thigh.R", 315, 0.130),
                   ("limb", "thigh.R", 290, 0.100), ("limb", "thigh.R", 270, 0.070), "quad.top.lat.R"],
    "quad.back.R": ["quad.top.lat.R", ("limb", "thigh.R", 248, -0.030), ("limb", "thigh.R", 245, -0.100),
                    ("limb", "thigh.R", 245, -0.170), ("limb", "thigh.R", 250, -0.230), "quad.knee.lat.R"],
    "quad.low.R": ["quad.knee.lat.R", ("limb", "thigh.R", 285, -0.280), ("limb", "thigh.R", 310, -0.275),
                   ("limb", "thigh.R", 335, -0.270), ("limb", "thigh.R", 357, -0.262), ("limb", "thigh.R", 15, -0.270),
                   ("limb", "thigh.R", 35, -0.268), "quad.knee.med.R"],
    # Where the serratus's digitations meet the oblique's.
    "serr.low.R": [("on", "ls.R", ("cyl", 321, 0.470)), ("cyl", 310, 0.462), ("cyl", 298, 0.458),
                   ("cyl", 285, 0.455), ("cyl", 270, 0.448), ("on", "lat.front.R", ("cyl", 251, 0.445))],
    "serr.low.L": [("on", "ls.L", ("cyl", 31, 0.470)), ("cyl", 45, 0.465), ("cyl", 60, 0.460),
                   ("cyl", 75, 0.455), ("cyl", 92, 0.447), ("on", "lat.front.L", ("cyl", 113, 0.445))],
}

# Seeds: region id -> points inside it.
SEEDS = {
    "pectoralis-major.R":  [("front", -0.10, 0.69)],
    "pectoralis-major.L":  [("front", 0.09, 0.69)],
    "rectus-abdominis":    [("cyl", 350, 0.50), ("cyl", 0, 0.28)],
    "external-oblique.R":  [("cyl", 300, 0.38)],
    "external-oblique.L":  [("cyl", 60, 0.39)],
    "serratus-anterior.R": [("cyl", 295, 0.53)],
    "serratus-anterior.L": [("cyl", 60, 0.52)],
    "deltoid.R":           [("right", 0.030, 0.750)],
    "deltoid.L":           [("left", 0.030, 0.740)],
    "biceps-brachii.R":    [("front", -0.305, 0.540)],
    "biceps-brachii.L":    [("front", 0.250, 0.530)],
    "triceps-brachii.R":   [("back", -0.315, 0.560)],
    "triceps-brachii.L":   [("back", 0.285, 0.550)],
    "gluteus-maximus.R":   [("back", -0.110, 0.130)],
    "gluteus-maximus.L":   [("back", 0.120, 0.170)],
    "gastrocnemius.R":     [("back", -0.140, -0.450)],
    "gastrocnemius.L":     [("back", 0.100, -0.460)],
    "latissimus-dorsi.R":  [("cyl", 232, 0.480)],
    "latissimus-dorsi.L":  [("cyl", 140, 0.490)],
    "quadriceps-femoris.R": [("limb", "thigh.R", 330, -0.100)],
    "quadriceps-femoris.L": [("limb", "thigh.L", 40, -0.100)],
}

# Leak guard: the most area (source units²) a region may take (one side).
MAX_AREA = {
    "pectoralis-major": 0.090,
    "rectus-abdominis": 0.150,
    "external-oblique": 0.090,
    "serratus-anterior": 0.040,
    "deltoid": 0.080,
    "biceps-brachii": 0.045,
    "triceps-brachii": 0.055,
    "gluteus-maximus": 0.090,
    "gastrocnemius": 0.080,
    "latissimus-dorsi": 0.080,
    "quadriceps-femoris": 0.150,
}


def log(msg):
    print("male-body-regions: " + msg, flush=True)


# ------------------------------------------------------------------ surface

class Surface:
    """The mesh as arrays: positions, normals, edges and faces, grooves, and
    a ray-caster."""

    def __init__(self, me):
        n = len(me.vertices)
        self.co = np.empty(n * 3); me.vertices.foreach_get("co", self.co); self.co = self.co.reshape(-1, 3)
        self.nrm = np.empty(n * 3); me.vertices.foreach_get("normal", self.nrm); self.nrm = self.nrm.reshape(-1, 3)
        self.edges = np.empty(len(me.edges) * 2, np.int64); me.edges.foreach_get("vertices", self.edges)
        self.edges = self.edges.reshape(-1, 2)
        nf = len(me.polygons)
        self.loop_start = np.empty(nf, np.int64); me.polygons.foreach_get("loop_start", self.loop_start)
        self.loop_total = np.empty(nf, np.int64); me.polygons.foreach_get("loop_total", self.loop_total)
        self.loop_vert = np.empty(len(me.loops), np.int64); me.loops.foreach_get("vertex_index", self.loop_vert)
        self.loop_edge = np.empty(len(me.loops), np.int64); me.loops.foreach_get("edge_index", self.loop_edge)
        self.loop_face = np.repeat(np.arange(nf), self.loop_total)
        self.area = np.empty(nf); me.polygons.foreach_get("area", self.area)
        polys = [tuple(self.loop_vert[s:s + t]) for s, t in zip(self.loop_start, self.loop_total)]
        self.tree = BVHTree.FromPolygons([tuple(p) for p in self.co], polys)
        self.edge_index = {(int(min(a, b)), int(max(a, b))): i for i, (a, b) in enumerate(self.edges)}
        # Each edge's two faces (the sculpture is closed: every edge has two).
        order = np.argsort(self.loop_edge, kind="stable")
        self.edge_faces = self.loop_face[order].reshape(-1, 2)
        self.groove = self._groove()
        self._graph()

    def _groove(self):
        co, e = self.co, self.edges
        deg = np.bincount(e.ravel(), minlength=len(co)).astype(float)
        s = co.copy()
        for _ in range(SMOOTH):
            acc = np.empty_like(s)
            for k in range(3):
                acc[:, k] = np.bincount(e[:, 0], s[e[:, 1], k], len(co)) + np.bincount(e[:, 1], s[e[:, 0], k], len(co))
            s = 0.5 * s + 0.5 * acc / deg[:, None]
        h = np.einsum("ij,ij->i", co - s, self.nrm)          # < 0 in a groove
        for _ in range(GROOVE_BLUR):                         # the depth, not the mesh's noise
            h = 0.5 * h + 0.5 * (np.bincount(e[:, 0], h[e[:, 1]], len(co)) +
                                 np.bincount(e[:, 1], h[e[:, 0]], len(co))) / deg
        return h

    def _graph(self):
        e = self.edges
        length = np.linalg.norm(self.co[e[:, 0]] - self.co[e[:, 1]], axis=1)
        h = 0.5 * (self.groove[e[:, 0]] + self.groove[e[:, 1]])
        g = np.clip(-h / GROOVE, 0.0, 1.0)
        w = length * (FLOOR + (1.0 - g) ** 2)
        src = np.concatenate([e[:, 0], e[:, 1]]); dst = np.concatenate([e[:, 1], e[:, 0]])
        ww = np.concatenate([w, w])
        order = np.argsort(src, kind="stable")
        self.nbr = dst[order]; self.wt = ww[order]
        self.ptr = np.zeros(len(self.co) + 1, np.int64)
        np.cumsum(np.bincount(src, minlength=len(self.co)), out=self.ptr[1:])

    # ---- points

    def cast(self, spec):
        """A hand-placed point -> (surface point, face index)."""
        view = spec[0]
        if view == "front":
            o, d = Vector((spec[1], -5.0, spec[2])), Vector((0, 1, 0))
        elif view == "back":
            o, d = Vector((spec[1], 5.0, spec[2])), Vector((0, -1, 0))
        elif view == "left":
            o, d = Vector((5.0, spec[1], spec[2])), Vector((-1, 0, 0))
        elif view == "right":
            o, d = Vector((-5.0, spec[1], spec[2])), Vector((1, 0, 0))
        elif view == "top":
            o, d = Vector((spec[1], spec[2], 5.0)), Vector((0, 0, -1))
        elif view == "ray":              # from a point inside a limb out through its side
            o, d = Vector(spec[1:4]), Vector(spec[4:7]).normalized()
        elif view == "limb":             # from a limb's axis outward, at an angle round it (as "cyl")
            x0, y0, z0, x1, y1, z1 = AXES[spec[1]]
            t = (spec[3] - z0) / (z1 - z0)
            a = math.radians(spec[2])
            o = Vector((x0 + t * (x1 - x0), y0 + t * (y1 - y0), spec[3]))
            d = Vector((math.sin(a), -math.cos(a), 0.0))
        elif view == "cyl":              # from the vertical axis outward, at an angle round the body
            a = math.radians(spec[1])
            o, d = Vector((0.0, 0.0, spec[2])), Vector((math.sin(a), -math.cos(a), 0.0))
        else:
            raise SystemExit("male-body-regions: unknown view %r" % (view,))
        loc, _n, face, _d = self.tree.ray_cast(o, d)
        if loc is None:
            raise SystemExit("male-body-regions: the point %r misses the sculpture" % (spec,))
        return np.array(loc), face

    def nearest_vertex(self, p, face):
        verts = self.loop_vert[self.loop_start[face]:self.loop_start[face] + self.loop_total[face]]
        return int(verts[np.argmin(np.linalg.norm(self.co[verts] - p, axis=1))])

    def snap(self, v, radius=SNAP):
        """The deepest-groove vertex within `radius` of v (on the surface graph)."""
        seen, best, frontier = {v}, v, [v]
        c = self.co[v]
        while frontier:
            nxt = []
            for a in frontier:
                for b in self.nbr[self.ptr[a]:self.ptr[a + 1]]:
                    b = int(b)
                    if b in seen or np.linalg.norm(self.co[b] - c) > radius:
                        continue
                    seen.add(b); nxt.append(b)
                    if self.groove[b] < self.groove[best]:
                        best = b
            frontier = nxt
        return best

    # ---- paths

    def _dijkstra(self, a, b, allowed=None, extra=None):
        dist = {a: 0.0}; prev = {}
        heap = [(0.0, a)]
        while heap:
            d, u = heapq.heappop(heap)
            if u == b:
                break
            if d > dist.get(u, math.inf):
                continue
            for i in range(self.ptr[u], self.ptr[u + 1]):
                v = int(self.nbr[i])
                if allowed is not None and v not in allowed:
                    continue
                w = self.wt[i] if extra is None else self.wt[i] * 0.5 * (extra[u] + extra[v])
                nd = d + w
                if nd < dist.get(v, math.inf):
                    dist[v] = nd; prev[v] = u
                    heapq.heappush(heap, (nd, v))
        if b not in dist:
            raise SystemExit("male-body-regions: no path between vertices %d and %d" % (a, b))
        out = [b]
        while out[-1] != a:
            out.append(prev[out[-1]])
        return out[::-1]

    def border(self, vs):
        """A border through hand-placed vertices: first the cheapest path over
        the groove-weighted edges from each to the next (it finds the
        groove), then the cheapest path from the first to the last that also
        keeps close to a smoothed copy of the whole (it follows the groove
        without the mesh's zigzags, the noise's detours or kinks at the
        points). Its two ends are exactly the first and last points."""
        rough = [vs[0]]
        for a, b in zip(vs, vs[1:]):
            rough += self._dijkstra(a, b)[1:]
        if len(rough) < 4:
            return rough
        guide = smooth_polyline(self.co[rough], PATH_SMOOTH)
        near = self.within(rough, CORRIDOR)
        idx = np.fromiter(near, np.int64)
        d = distance_to_polyline(self.co[idx], guide)
        extra = {int(v): 1.0 + (dv / PATH_SIGMA) ** 2 for v, dv in zip(idx, d)}
        return self._dijkstra(vs[0], vs[-1], allowed=near, extra=extra)

    def within(self, verts, radius):
        """Vertices within `radius` (along the surface's edges) of any of `verts`."""
        best = {int(v): 0.0 for v in verts}
        heap = [(0.0, int(v)) for v in verts]
        heapq.heapify(heap)
        while heap:
            d, u = heapq.heappop(heap)
            if d > best.get(u, math.inf):
                continue
            for i in range(self.ptr[u], self.ptr[u + 1]):
                v = int(self.nbr[i])
                nd = d + float(np.linalg.norm(self.co[u] - self.co[v]))
                if nd <= radius and nd < best.get(v, math.inf):
                    best[v] = nd
                    heapq.heappush(heap, (nd, v))
        return set(best)


def smooth_polyline(pts, window):
    """A polyline's points averaged over `window` of arc length (ends kept)."""
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    arc = np.concatenate([[0.0], np.cumsum(seg)])
    out = pts.copy()
    for i in range(1, len(pts) - 1):
        half = min(window / 2, arc[i], arc[-1] - arc[i])
        m = np.abs(arc - arc[i]) <= half
        out[i] = pts[m].mean(axis=0)
    return out


def distance_to_polyline(p, line):
    """Each point's distance to a polyline."""
    best = np.full(len(p), np.inf)
    for a, b in zip(line[:-1], line[1:]):
        ab = b - a
        t = np.clip(((p - a) @ ab) / max(ab @ ab, 1e-12), 0.0, 1.0)
        best = np.minimum(best, np.linalg.norm(p - (a + t[:, None] * ab), axis=1))
    return best


# --------------------------------------------------------------- authoring

def trace_borders(surf):
    """Every border as a vertex path; the set of mesh edges they cover."""
    paths, where = {}, {}

    def vertex(spec, border):
        if isinstance(spec, str):
            if spec not in where:
                p, f = surf.cast(POINTS[spec])
                where[spec] = surf.snap(surf.nearest_vertex(p, f))
            return where[spec]
        if spec[0] == "on":
            _, other, near = spec
            if other not in paths:
                raise SystemExit("male-body-regions: border %s ends on %s, which is traced later" % (border, other))
            p, _f = surf.cast(near)
            vs = paths[other]
            return vs[int(np.argmin(np.linalg.norm(surf.co[vs] - p, axis=1)))]
        p, f = surf.cast(spec)
        return surf.snap(surf.nearest_vertex(p, f))

    for name, spec in BORDERS.items():
        paths[name] = surf.border([vertex(s, name) for s in spec])
    cut = set()
    for name, path in paths.items():
        for a, b in zip(path, path[1:]):
            cut.add(surf.edge_index[(min(a, b), max(a, b))])
    return paths, cut


def cells(surf, cut):
    """Connected groups of faces that no border separates: a label per face."""
    nf = len(surf.area)
    adj = [[] for _ in range(nf)]
    for ei, (f, g) in enumerate(surf.edge_faces):
        if ei not in cut:
            adj[f].append(int(g)); adj[g].append(int(f))
    label = np.full(nf, -1, np.int64)
    n = 0
    for start in range(nf):
        if label[start] >= 0:
            continue
        label[start] = n
        q = deque([start])
        while q:
            f = q.popleft()
            for g in adj[f]:
                if label[g] < 0:
                    label[g] = n; q.append(g)
        n += 1
    return label


def assign(surf, strict=True):
    """Face -> region id (None for body), with a report. Not strict (a preview):
    a region over its area limit is reported rather than refused."""
    for rid, (atlas, side) in REGIONS.items():
        if side not in ("left", "right", "midline"):
            raise SystemExit("male-body-regions: %s has side %r" % (rid, side))
        if rid not in SEEDS:
            raise SystemExit("male-body-regions: %s has no seed" % rid)
    for rid in SEEDS:
        if rid not in REGIONS:
            raise SystemExit("male-body-regions: seed for unknown region %s" % rid)
    paths, cut = trace_borders(surf)
    label = cells(surf, cut)
    owner = {}
    for rid, seeds in SEEDS.items():
        for s in seeds:
            _p, f = surf.cast(s)
            c = int(label[f])
            if owner.get(c, rid) != rid:
                raise SystemExit("male-body-regions: %s and %s share one cell: a border around them has a gap"
                                 % (owner[c], rid))
            owner[c] = rid
    region = np.full(len(label), None, dtype=object)
    for c, rid in owner.items():
        region[label == c] = rid
    report = {}
    for rid in REGIONS:
        m = region == rid
        area = float(surf.area[m].sum())
        limit = MAX_AREA.get(REGIONS[rid][0])
        if limit and area > limit:
            msg = "%s takes %.4f of surface (limit %.4f): a border leaks" % (rid, area, limit)
            if strict:
                raise SystemExit("male-body-regions: " + msg)
            log("WARNING " + msg)
        report[rid] = dict(faces=int(m.sum()), area=round(area, 5))
    report["body"] = dict(faces=int(sum(r is None for r in region)))
    return region, paths, report


# ---------------------------------------------------------------- the file

def check_target(out):
    """The .blend may be replaced only while it is exactly the refined sculpture
    or exactly what this script last wrote; anything else is hand-authored."""
    actual = guard.sha256_file(out)
    for suffix in (RECORD_SUFFIX, guard.RECORD_SUFFIX):
        record = os.path.splitext(out)[0] + suffix
        try:
            with open(record, encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError):
            continue
        if data.get("output") == os.path.basename(out) and data.get("output_sha256") == actual:
            return actual
    raise SystemExit(
        "male-body-regions: REFUSING to overwrite %s\n"
        "  It is neither the refined sculpture nor what this script last wrote (SHA-256 %s):\n"
        "  it has been edited by hand, and that work is now the source of truth.\n"
        "  Nothing has been written. Edit its regions in Blender, or move it aside to start again." % (out, actual[:16]))


def write(region, report, out, checked):
    bpy.ops.wm.open_mainfile(filepath=out)
    me = bpy.data.meshes["Mesh_0"]
    stone = bpy.data.materials[STONE]
    geometry = me.get("atlas_refinement_geometry")
    mats = [stone]
    for rid in REGIONS:
        mat = bpy.data.materials.get(rid) or stone.copy()
        mat.name = rid
        mat.diffuse_color = viewport_colour(rid)
        mats.append(mat)
    me.materials.clear()
    for m in mats:
        me.materials.append(m)
    slot = {rid: i + 1 for i, rid in enumerate(REGIONS)}
    me.polygons.foreach_set("material_index", [0 if r is None else slot[r] for r in region])
    me["atlas_regions"] = VERSION
    me.update()
    if geometry_hash(me) != geometry:
        raise SystemExit("male-body-regions: the geometry changed; not saving")
    bpy.context.preferences.filepaths.save_version = 0
    guard.check_unchanged(out, checked)
    bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
    write_record(out, report)
    log("wrote %s: %d regions" % (out, len(REGIONS)))


def write_record(out, report):
    """Male_Body.regions.json: the bytes just saved. The refinement's own record
    is left as it is, so the refinement script now refuses this file."""
    record = os.path.splitext(out)[0] + RECORD_SUFFIX
    data = dict(note="Written by tools/anatomy/authored/male_body_regions.py. It may rewrite %s only while "
                     "the file's SHA-256 matches output_sha256; any hand edit makes the .blend the source of truth."
                     % os.path.basename(out),
                output=os.path.basename(out), output_sha256=guard.sha256_file(out), script=VERSION,
                regions=report)
    tmp = record + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    os.replace(tmp, record)


def geometry_hash(me):
    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co)
    return hashlib.sha256(co.tobytes() + str(len(me.polygons)).encode()).hexdigest()[:16]


def viewport_colour(rid):
    """A quiet tint per region for Blender's solid view (the app shades on its own)."""
    names = sorted({a for a, _s in REGIONS.values()})
    k = names.index(REGIONS[rid][0])
    hue = (k * 0.61803) % 1.0
    r, g, b = colorsys.hls_to_rgb(hue, 0.62, 0.28)
    return (r, g, b, 1.0)


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = dict(zip(args[::2], args[1::2]))
    if len(args) % 2 or set(opts) - {"--preview", "--out"}:
        raise SystemExit("male-body-regions: unknown arguments %s; it takes --preview <dir> and --out <file>"
                         % " ".join(args))
    preview = opts.get("--preview")
    target = os.path.abspath(opts.get("--out", TARGET))
    checked = None if preview else check_target(target)          # refuse before doing any work
    # The regions are computed on the sculpture as saved (appended, read only).
    bpy.ops.wm.read_factory_settings(use_empty=True)
    with bpy.data.libraries.load(target, link=False) as (src, dst):
        dst.meshes = ["Mesh_0"]
    surf = Surface(dst.meshes[0])
    log("surface: %d vertices, %d faces; groove depth p5 %.4f p50 %.4f" %
        (len(surf.co), len(surf.area), np.percentile(surf.groove, 5), np.percentile(surf.groove, 50)))
    region, paths, report = assign(surf, strict=not preview)
    if preview:
        for name, pth in paths.items():
            pts = surf.co[pth]
            seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
            wander = distance_to_polyline(pts, smooth_polyline(pts, 0.03)) if len(pts) > 3 else np.zeros(1)
            log("  border %-16s %4d edges, length %.3f, edge mean %.4f max %.4f, wander p90 %.4f max %.4f" %
                (name, len(seg), seg.sum(), seg.mean(), seg.max(), np.percentile(wander, 90), wander.max()))
    for rid, r in report.items():
        log("  %-28s %s" % (rid, r))
    if preview:
        os.makedirs(preview, exist_ok=True)
        np.save(os.path.join(preview, "region.npy"), np.array([r or "" for r in region]))
        np.save(os.path.join(preview, "borders.npy"), np.array(sorted({v for p in paths.values() for v in p})))
        with open(os.path.join(preview, "report.json"), "w") as f:
            json.dump(report, f, indent=1)
        log("preview written to " + preview)
        return
    write(region, report, target, checked)


main()
