/* ===========================================================================
   The ATLAS anatomy sculpture — what the figure is made of.

   A headless anatomical study: a figure standing in the anatomical
   position (arms a little away from the body, palms forward, feet apart),
   cut level at the neck, about 158 cm to the cut. It reads as one carved
   object whose surface IS its muscles: they are thick enough, and
   overlap enough, to make the body's volume and outline themselves, and
   they meet in soft valleys, so the eye never finds a smooth mannequin
   under them. The material is one tone throughout; light does the carving.

   Two kinds of region, built the same way:

     • the form — the armature under the muscles (the trunk's core, the
       limbs' bones and deep muscles), and the landmarks that show between
       them (collarbone, elbow, kneecap, the tibia, Achilles tendon, hands
       and feet). One region, "body", never selectable.
     • the muscles — each superficial muscle is its own named region. The
       names are anatomical (`vastus-medialis`), not the app's muscle ids:
       js/anatomy-regions.js says which app muscle each one belongs to, so
       the model never needs to know about the app.

   The muscles are made two ways (sdf.mjs):

     • torsoMuscle()  a shell: the trunk's surface raised inside an outline
                      seen from the front, back or side, in cm (x or z
                      across, y up), clipped to that side of the body
     • bulge()        a belly raised off a limb's bone, round it at an
                      angle in degrees (0 front, 90 outer side, 180 back,
                      −90 inner side) and along it from t 0 (the upper
                      joint) to 1 (the lower), overlapping its neighbours

   A few structures that bridge a gap (the folds of the armpit, the
   collarbone) are bands or strands of rounded cones.

   The sculpture is a rest pose built from joints (SHOULDER, ELBOW, …) and
   limbs between them, so another pose is new joint positions, not a new
   model.

   Everything is described for the figure's LEFT side (+x) and mirrored;
   parts marked `mid` sit on the midline and are not mirrored.
   ========================================================================= */

import { Ellipsoid, RoundCone, Bulge, Field, Outline, Shell, Memo,
         add, sub, mul, dot, cross, len, norm, lerp } from "./sdf.mjs";

/* ------------------------------- skeleton -------------------------------- */

const SHOULDER = [18.4, 145.0, -0.8];      // centre of the humeral head
const ELBOW    = [24.8, 116.2, -2.2];
const WRIST    = [31.4, 92.8, 0.4];
const HIP      = [9.6, 92.4, 0.6];         // femoral head
const KNEE     = [11.0, 50.2, 0.4];
const ANKLE    = [12.4, 8.9, -1.8];

/** A limb from joint `a` to joint `b`, with a round base radius `ra` → `rb`. */
function limb(a, b, ra, rb, front = [0, 0, 1]) {
  const u = norm(sub(b, a));
  const f = norm(sub(front, mul(u, dot(front, u))));
  const l = cross(f, u);                              // outward, for the left side
  const length = len(sub(b, a));
  const cone = new RoundCone(a, b, ra, rb);
  return {
    a, b, u, f, l, length, ra, rb, cone,
    dir: deg => { const r = deg * Math.PI / 180; return norm(add(mul(f, Math.cos(r)), mul(l, Math.sin(r)))); }
  };
}

// The limbs' cores: bone and the deep muscles, which the surface muscles
// are raised off (bulge()). Where no muscle covers them they show, at the
// joints and along the shin.
const UPPER_ARM = limb(SHOULDER, ELBOW, 3.0, 2.2);
const FOREARM   = limb(ELBOW, WRIST, 2.5, 1.6);
const THIGH     = limb(HIP, KNEE, 5.0, 3.3);
const SHIN      = limb(add(KNEE, [0, -1.0, 0]), ANKLE, 3.4, 2.0);

/**
 * A muscle belly on limb L (Bulge): from t0 through its peak at tp to t1
 * along the bone, round `angle`° ± `span`° (0 front, 90 outer side, 180
 * back, −90 inner side), standing `d` cm off the bone at its peak.
 */
const bulge = (L, [t0, tp, t1], angle, span, d, opts = {}) =>
  new Bulge(L, { t0, tp, t1, angle, span, d, full: 3.5, ...opts });

/* ------------------------------- regions --------------------------------- */

const regions = [];
/**
 * A region. `midline` is for a muscle whose two halves meet at the
 * midline (the chest, the back): how softly, in cm, they join there.
 */
function region(name, kind = "muscle", { midline = 0 } = {}) {
  const r = { name, kind, midline, parts: [] };
  regions.push(r);
  return {
    /** Adds a primitive, joined to the region's earlier parts over `k` cm. */
    add(prim, k = 1.2, { mid = false } = {}) { r.parts.push({ prim, k, mid }); return this; }
  };
}

/** Rounded cones joining a list of [point, radius] into one strand. */
function strand(r, points, k = 0.6) {
  for (let i = 0; i + 1 < points.length; i++)
    r.add(new RoundCone(points[i][0], points[i + 1][0], points[i][1], points[i + 1][1]), k);
  return r;
}

/**
 * A flat band from `a` to `b` (a fold of the armpit): an ellipsoid along
 * the line, `w` cm wide, lying `t` cm thick against the body, whose
 * surface faces `out`.
 */
function band(a, b, w, t, out) {
  const along = norm(sub(b, a)), across = norm(cross(out, along));
  return new Ellipsoid(mul(add(a, b), 0.5), [len(sub(b, a)) / 2, w / 2, t], along, across, cross(along, across));
}

/* --------------------------------- form ---------------------------------- */

const body = region("body", "form");
const MID = { mid: true };

/* No head: the figure is an anatomical study, not a character. The neck
   ends in a level cut (CUTS, below), rounded at its rim. */

// The trunk. Also the form the torso's muscles are laid on (below).
const TRUNK = [
  { prim: new RoundCone([0, 149.0, -2.0], [0, 162.5, 0.6], 5.2, 4.6), k: 2.5 },    // neck, leaning forward
  { prim: new Ellipsoid([0, 139.4, -0.2], [13.2, 10.8, 8.8]), k: 5 },               // upper chest
  { prim: new Ellipsoid([0, 127.2, 0.0], [14.6, 15.2, 9.6]), k: 6 },                // lower ribs
  { prim: new Ellipsoid([0, 143.6, -1.4], [15.2, 6.2, 7.2]), k: 5 },                // shoulder girdle
  { prim: new Ellipsoid([0, 148.0, -2.4], [14.6, 4.8, 4.2]), k: 5 },                // neck-to-shoulder slope
  { prim: new Ellipsoid([0, 111.2, 2.4], [12.6, 12.2, 7.8]), k: 6 },                // abdomen, the small of the back
  { prim: new Ellipsoid([0, 96.4, -1.0], [15.0, 9.4, 9.8]), k: 5 }                  // pelvis
];
for (const { prim, k } of TRUNK) body.add(prim, k, MID);

// Collarbone, standing just proud between the neck and the chest.
strand(body, [[[1.8, 149.4, 5.0], 0.62], [[9.6, 150.2, 3.9], 0.58], [[17.0, 149.2, -0.5], 0.52]], 2.6);

// Arm, elbow and hand (palm forward, thumb out).
body.add(UPPER_ARM.cone, 1.5)
    .add(new Ellipsoid(ELBOW, [3.4, 2.2, 2.2], FOREARM.l, FOREARM.u, FOREARM.f), 1.2)     // epicondyles
    .add(new Ellipsoid(add(ELBOW, mul(UPPER_ARM.dir(180), 1.9)), [1.4, 1.8, 1.2]), 0.8)   // olecranon
    .add(FOREARM.cone, 1.2)
    .add(new Ellipsoid(lerp(ELBOW, WRIST, 0.8), [2.4, 4.2, 1.35], FOREARM.l, FOREARM.u, FOREARM.f), 1.2)
    .add(new Ellipsoid(WRIST, [2.7, 1.3, 1.5], FOREARM.l, FOREARM.u, FOREARM.f), 1.2);
{
  const along = FOREARM.u, across = FOREARM.l, front = FOREARM.f;
  const at = (s, x, z) => add(add(add(WRIST, mul(along, s)), mul(across, x)), mul(front, z));
  body.add(new Ellipsoid(at(5.0, 0.1, 0.1), [3.7, 4.8, 1.45], across, along, front), 1.0);
  // Fingers together, index on the thumb's side, curling a little forward.
  [[2.6, 6.6], [0.85, 7.4], [-0.9, 7.0], [-2.55, 5.7]].forEach(([x, l]) =>
    body.add(new RoundCone(at(9.0, x, 0.1), at(9.0 + l, x * 0.96, 1.1), 0.92, 0.74), 0.7));
  body.add(new RoundCone(at(1.4, 2.9, 0.6), at(6.2, 4.4, 2.1), 1.3, 0.92), 1.0);   // thumb
}

// Leg, knee, ankle and foot.
body.add(THIGH.cone, 2)
    .add(new Ellipsoid(add(KNEE, [0, 0.2, 0.7]), [4.5, 3.4, 3.3]), 1.6)             // condyles, forward
    .add(new Ellipsoid(add(KNEE, [0.3, 1.0, 3.5]), [2.4, 2.8, 1.25]), 1.4)          // kneecap
    .add(new RoundCone(add(KNEE, [0.3, -1.6, 3.7]), add(KNEE, [0.45, -7.0, 2.9]), 0.95, 0.8), 1.2)
    .add(SHIN.cone, 1.5)
    .add(new Ellipsoid(add(ANKLE, [-1.9, 0.8, 0.3]), [1.15, 1.5, 1.2]), 1.0)
    .add(new Ellipsoid(add(ANKLE, [1.8, -0.4, -0.7]), [1.05, 1.6, 1.1]), 1.0)
    .add(new Ellipsoid([12.1, 3.6, -4.6], [3.0, 3.6, 3.3]), 2)                      // heel
    .add(new Ellipsoid([12.6, 5.4, 2.4], [3.3, 2.8, 6.2]), 2.4)                     // instep
    .add(new RoundCone([12.2, 3.8, -2.6], [13.6, 2.3, 11.4], 3.1, 2.3), 2)
    .add(new Ellipsoid([14.1, 1.7, 15.0], [4.2, 1.6, 3.3]), 1.2);                   // toes

/* The form the torso muscles are laid on: the trunk, blended like the
   body's, so a shell sits on the body's own surface; and a mass at the top
   of each thigh for the hip muscles, whose lower edges pass under the
   thigh's own muscles. */
const HIP_MASS = new RoundCone(HIP, lerp(HIP, KNEE, 0.45), 6.4, 5.4);
const TORSO = new Memo(new Field([{ name: "torso", kind: "form", parts: [
  ...TRUNK, { prim: HIP_MASS, k: 3 }, { prim: HIP_MASS.mirrored(), k: 3 }
] }], { reach: 40, cell: 8 }));

/* ------------------------------ muscle kinds ------------------------------ */

/* How far a torso muscle's volume runs past its outline (Shell), so
   muscles drawn edge to edge meet in valleys instead of showing the form. */
const GROW = 1.0;

/**
 * A torso muscle outlined as seen from `view` ("front", "back" or "side"),
 * in cm: [x, y] from the front or back, [z, y] from the side. `clip` is
 * where the muscle stops round the body: a depth (z) for front and back,
 * a width (x) for the side.
 */
function torsoMuscle(view, points, { clip, t, soft, grow = GROW, taper, grooves, belly, peak }) {
  const chart = view === "front" ? (x, y, z, o) => { o[0] = x; o[1] = y; o[2] = clip - z; }
              : view === "back"  ? (x, y, z, o) => { o[0] = x; o[1] = y; o[2] = z - clip; }
              :                    (x, y, z, o) => { o[0] = z; o[1] = y; o[2] = clip - x; };
  const outline = new Outline(points);
  soft ??= (outline.inradius + grow) * 0.95;          // Shell's own default, stated once here
  const [u0, v0, u1, v1] = outline.box, m = t + soft + grow + 1;
  const box = view === "front" ? [u0 - m, v0 - m, clip - 1, u1 + m, v1 + m, 30]
            : view === "back"  ? [u0 - m, v0 - m, -30, u1 + m, v1 + m, clip + 1]
            :                    [clip - 1, v0 - m, u0 - m, 40, v1 + m, u1 + m];
  return new Shell(TORSO, chart, outline, { t, soft, grow, taper, grooves, belly, peak }, box);
}

/** A small rotated ellipse as an outline: [x, y] points. */
function ellipse(cx, cy, rx, ry, deg, n = 8) {
  const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180);
  return Array.from({ length: n }, (_, i) => {
    const a = i / n * 2 * Math.PI, x = rx * Math.cos(a), y = ry * Math.sin(a);
    return [cx + x * c - y * s, cy + x * s + y * c];
  });
}

/* ------------------------------ neck & chest ------------------------------ */

region("sternocleidomastoid")
  .add(torsoMuscle("front", [[0.9, 150.2], [2.6, 149.4], [4.4, 150.0], [5.2, 154.5], [5.5, 159.5],
    [5.2, 162.8], [4.0, 162.5], [3.6, 158.5], [2.2, 154.0], [1.0, 151.4]], { clip: -2, t: 1.5 }), 0);

// Thickest where it slopes from the neck to the shoulder, thin up the
// neck and down over the back.
region("trapezius", "muscle", { midline: 1.6 })
  .add(torsoMuscle("back", [[0.05, 161.6], [3.4, 160.6], [5.8, 156.2], [9.6, 152.2], [14.0, 149.9],
    [17.4, 148.9], [16.4, 146.4], [12.8, 145.0], [10.0, 143.2], [8.6, 140.4], [6.8, 134.2],
    [4.4, 125.8], [1.4, 117.6], [0.05, 116.6], [0.05, 140], [0.05, 155]],
    { clip: 2.5, t: 2.4, belly: 0.65, peak: 0.74 }), 0);

// A thick fan from the breastbone and collarbone to the arm: heaviest at
// its lower outer corner, where its rolled lower border shadows the ribs,
// and bridging into the arm as the front fold of the armpit.
region("pectoralis-major", "muscle", { midline: 1.6 })
  .add(torsoMuscle("front", [[0.05, 147.8], [5.0, 148.6], [9.8, 148.4], [13.6, 146.4], [15.8, 142.4],
    [16.4, 138.6], [14.6, 133.4], [11.8, 129.8], [8.2, 127.4], [4.6, 126.8], [1.8, 127.8],
    [0.05, 128.4], [0.05, 133.0], [0.05, 140.5]],
    { clip: -2, t: 2.9, soft: 4.6, taper: [0.012, -0.028] }), 0)
  .add(band([13.2, 133.4, 4.2], [19.4, 139.4, 1.0], 3.8, 1.25, [0.3, -0.35, 0.9]), 2.4);

{
  // Finger-like digitations on the side of the ribs, reaching forward and
  // down from under the shoulder blade, between the chest and the lat.
  const serratus = region("serratus-anterior");
  [[3.6, 131.4], [3.8, 127.8], [3.6, 124.2], [3.0, 120.6]].forEach(([z, y], i) =>
    serratus.add(torsoMuscle("side", ellipse(z, y, 3.8, 1.25, -24, 16), { clip: 9, t: 0.9, grow: 0.8 }),
      i ? 0.4 : 0));
}

{
  // Two columns meeting at the midline. The tendinous lines across them
  // are not level and not quite matched left to right, as in life; below
  // the navel the columns run smooth to the pubis.
  const rectus = region("rectus-abdominis");
  const outline = [[0.05, 128.2], [4.4, 129.2], [7.6, 127.6], [8.2, 121.5], [8.0, 113.5],
    [7.3, 105.5], [5.9, 98.2], [3.8, 92.6], [1.9, 91.4], [0.05, 92.0], [0.05, 100], [0.05, 110],
    [0.05, 120]];
  const column = (sign, lines) => torsoMuscle("front", outline.map(([x, y]) => [sign * x, y]),
    { clip: 2, t: 2.2, taper: [0, 0.012],
      grooves: lines.map(([v, slope, depth]) => ({ v, w: 1.5, depth, slope: sign * slope })) });
  rectus.add(column(1, [[110.2, -0.05, 0.15], [117.0, 0.06, 0.18], [123.2, -0.03, 0.17]]), 0, MID)
        .add(column(-1, [[110.9, 0.04, 0.14], [116.4, -0.05, 0.19], [123.7, 0.05, 0.15]]), 1.2, MID);
}

// The flank: thin where it interlocks with the serratus, thick in the pad
// that rolls over the hip bone.
region("external-oblique")
  .add(torsoMuscle("front", [[7.8, 128.4], [11.6, 130.2], [13.9, 127.4], [14.6, 120.5], [14.2, 113.5],
    [14.4, 107.0], [14.2, 101.8], [12.4, 100.2], [9.6, 97.4], [6.8, 94.8], [4.6, 93.4], [6.0, 98.6],
    [7.2, 104.5], [7.8, 112.0], [7.8, 121.0]],
    { clip: -6, t: 2.3, soft: 4, taper: [0.035, -0.03] }), 0);

/* --------------------------------- back ---------------------------------- */

region("infraspinatus")
  .add(torsoMuscle("back", [[9.6, 142.4], [13.8, 143.6], [15.6, 140.4], [15.2, 136.4], [13.0, 132.8],
    [10.2, 132.6], [8.6, 135.6], [8.8, 139.6]], { clip: 0, t: 1.5, grow: 1.4 }), 0);

region("teres-major")
  .add(torsoMuscle("back", [[10.6, 133.2], [13.0, 132.2], [15.6, 134.4], [16.4, 136.6], [15.0, 137.2],
    [12.4, 135.8]], { clip: 0, t: 1.6, grow: 1.2 }), 0);

// Broad and thin over the lower back, thick along its outer edge where it
// wraps the side of the chest and runs into the arm as the back fold of
// the armpit.
region("latissimus-dorsi")
  .add(torsoMuscle("back", [[0.9, 127.8], [5.0, 129.8], [9.6, 131.8], [13.4, 133.6], [15.6, 135.6],
    [16.2, 131.5], [15.8, 125.0], [15.0, 118.0], [13.8, 111.5], [12.4, 106.4], [9.6, 106.0],
    [6.8, 109.8], [4.4, 115.2], [2.6, 120.4], [1.2, 124.6]],
    { clip: 4, t: 2.2, soft: 5, taper: [0.035, 0] }), 0)
  .add(band([14.6, 132.0, -4.2], [19.4, 139.0, -2.0], 3.6, 1.25, [0.3, -0.35, -0.9]), 2.4);

// Two columns either side of the spine, thickest in the small of the back.
region("erector-spinae", "muscle", { midline: 1.6 })
  .add(torsoMuscle("back", [[0.05, 125.0], [4.6, 125.6], [6.4, 118.0], [6.9, 108.0], [6.1, 98.8],
    [4.0, 94.6], [0.05, 95.0], [0.05, 105], [0.05, 116]],
    { clip: -1, t: 2.8, taper: [0, -0.035] }), 0);

region("gluteus-medius")
  .add(torsoMuscle("back", [[8.6, 104.6], [12.0, 105.4], [14.9, 103.2], [16.0, 99.2], [15.2, 95.6],
    [12.6, 95.4], [9.8, 97.8]], { clip: 4, t: 2.6, grow: 1.6 }), 0);

// One rounded mass from the sacrum to the thigh, flowing into the lower
// back and the hip; its lower edge is the crease above the hamstrings.
region("gluteus-maximus", "muscle", { midline: 1.6 })
  .add(torsoMuscle("back", [[0.05, 101.8], [5.8, 103.0], [10.6, 101.2], [14.3, 97.6], [15.8, 92.0],
    [15.5, 86.8], [13.0, 82.8], [8.4, 81.4], [4.2, 82.2], [1.6, 85.0], [0.05, 92.0]],
    { clip: 1, t: 4.4, grow: 1.6, taper: [0, -0.02] }), 0);

region("tensor-fasciae-latae")
  .add(torsoMuscle("front", [[11.4, 101.8], [13.9, 101.2], [15.1, 96.6], [15.4, 91.4], [14.3, 88.6],
    [12.6, 91.4], [11.7, 96.6]], { clip: -3, t: 1.6, grow: 1.0 }), 0);

/* ---------------------------------- arm ---------------------------------- */

/* Arm and leg muscles are bellies raised off the bone (bulge()), wide
   enough to overlap their neighbours, so they meet in shallow creases and
   the limb's outline is theirs. A muscle of several heads blends them. */

// The deltoid: a rounded cap over the head of the arm bone, its three
// heads converging below it on the outside of the arm.
region("deltoid")
  .add(new Ellipsoid(add(add(SHOULDER, mul(UPPER_ARM.l, 1.0)), mul(UPPER_ARM.u, 0.8)), [5.2, 6.4, 5.0],
    UPPER_ARM.l, UPPER_ARM.u, UPPER_ARM.f), 0)
  .add(bulge(UPPER_ARM, [-0.1, 0.12, 0.48], 30, 58, 2.9, { twist: 30 }), 3.2)
  .add(bulge(UPPER_ARM, [-0.1, 0.14, 0.52], 94, 60, 3.3), 3.2)
  .add(bulge(UPPER_ARM, [-0.1, 0.12, 0.46], 158, 58, 2.7, { twist: -30 }), 3.2);

region("biceps-brachii")
  .add(bulge(UPPER_ARM, [0.14, 0.56, 1.0], -4, 64, 2.9), 0);

region("brachialis")
  .add(bulge(UPPER_ARM, [0.4, 0.76, 0.98], 72, 38, 1.9), 0)
  .add(bulge(UPPER_ARM, [0.44, 0.78, 0.98], -74, 36, 1.7), 0.5);

region("triceps-brachii")
  .add(bulge(UPPER_ARM, [0.06, 0.34, 0.66], 130, 52, 2.7), 0)            // lateral head
  .add(bulge(UPPER_ARM, [0.02, 0.36, 0.76], 206, 54, 2.8), 1.6)          // long head
  .add(bulge(UPPER_ARM, [0.42, 0.62, 0.88], 180, 60, 2.1), 1.6);         // medial head

// The flat tendon above the elbow at the back.
body.add(bulge(UPPER_ARM, [0.6, 0.86, 1.02], 180, 44, 0.9), 1.0);

region("brachioradialis")
  .add(bulge(FOREARM, [-0.26, 0.14, 0.66], 76, 46, 2.6, { twist: -20 }), 0);

region("forearm-flexors")
  .add(bulge(FOREARM, [-0.08, 0.2, 0.72], -40, 78, 2.5), 0);

region("forearm-extensors")
  .add(bulge(FOREARM, [-0.08, 0.22, 0.7], 150, 66, 2.3), 0);

/* ---------------------------------- leg ---------------------------------- */

region("rectus-femoris")
  .add(bulge(THIGH, [0.0, 0.42, 0.94], 0, 46, 3.6), 0);

region("vastus-lateralis")
  .add(bulge(THIGH, [0.06, 0.52, 0.94], 80, 66, 4.0), 0)
  .add(bulge(THIGH, [0.44, 0.8, 0.98], 54, 46, 3.4), 2.0);               // its low outer swell

region("vastus-medialis")
  .add(bulge(THIGH, [0.44, 0.8, 0.99], -46, 50, 4.0, { twist: -40 }), 0); // the teardrop

// The long strap crossing the thigh from the hip bone to the inside of the
// knee; it starts on the pelvis, above where the thigh's muscles begin.
region("sartorius")
  .add(torsoMuscle("front", [[11.9, 101.8], [13.9, 101.2], [13.9, 95.0], [13.2, 89.6], [11.2, 89.2],
    [11.3, 95.0]], { clip: 2, t: 1.3, grow: 0.4 }), 0)
  .add(bulge(THIGH, [-0.04, 0.4, 1.04], -40, 22, 2.9, { twist: -170 }), 0.8);

// The hip flexors in the hollow between the sartorius and the adductors.
region("iliopsoas")
  .add(torsoMuscle("front", [[6.2, 93.6], [9.6, 97.2], [11.4, 96.6], [11.4, 90.0], [10.2, 86.0],
    [7.4, 85.8], [5.2, 88.4]], { clip: 2, t: 1.4, grow: 0.4 }), 0);

// Round the inner thigh, front to back: the adductor mass high up, the
// gracilis strap down its inner edge to the knee, then the hamstrings.
region("adductors")
  .add(bulge(THIGH, [-0.04, 0.24, 0.68], -86, 44, 3.6), 0);

region("gracilis")
  .add(bulge(THIGH, [-0.02, 0.35, 1.0], -114, 24, 3.0), 0);

region("biceps-femoris")
  .add(bulge(THIGH, [0.1, 0.5, 0.96], 146, 46, 3.4), 0);

region("semitendinosus")
  .add(bulge(THIGH, [0.04, 0.4, 0.9], 192, 32, 3.4), 0);

region("semimembranosus")
  .add(bulge(THIGH, [0.3, 0.7, 0.97], 216, 28, 3.2), 0);

region("gastrocnemius")                              // two heads, the inner lower and larger
  .add(bulge(SHIN, [-0.1, 0.28, 0.62], 212, 52, 4.4), 0)
  .add(bulge(SHIN, [-0.1, 0.24, 0.52], 152, 46, 3.7), 1.4);

region("soleus")
  .add(bulge(SHIN, [0.2, 0.56, 0.9], 180, 88, 2.9), 0);

region("tibialis-anterior")
  .add(bulge(SHIN, [0.0, 0.3, 0.84], 40, 38, 2.5, { twist: -30 }), 0);

region("fibularis")
  .add(bulge(SHIN, [0.04, 0.34, 0.82], 100, 36, 2.4), 0);

// The Achilles tendon, from the calf to the heel.
body.add(bulge(SHIN, [0.58, 0.86, 1.04], 180, 18, 1.7), 1.0);

/* ------------------------------- the result ------------------------------ */

/** Where the sculpture is cut off: the neck, level, a hand's width above the collarbones. */
export const CUTS = [{ n: [0, 1, 0], c: 157.5, k: 1.2 }];

/**
 * The regions, with the left-side parts mirrored to the right. A region
 * whose halves meet at the midline lists its left half, then its right,
 * the right joining the left over `midline` cm: a rounded valley rather
 * than a sharp crease.
 */
export function sculpture() {
  return regions.map(r => {
    const own = r.parts.map(p => ({ prim: p.prim, k: p.k }));
    const mirror = p => ({ prim: p.prim.mirrored(), k: p.k });
    const parts = !r.midline
      ? r.parts.flatMap(p => p.mid ? [{ prim: p.prim, k: p.k }] : [{ prim: p.prim, k: p.k }, mirror(p)])
      : [...own, ...r.parts.filter(p => !p.mid).map((p, i) => i ? mirror(p) : { ...mirror(p), k: r.midline })];
    return { name: r.name, kind: r.kind, parts };
  });
}
