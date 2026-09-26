/* ===========================================================================
   The ATLAS anatomy sculpture — what the figure is made of.

   A standing figure in the anatomical position (arms a little away from
   the body, palms forward, feet apart), about 180 cm tall. It is built in
   two layers:

     • the form — head, neck, trunk, limbs, hands and feet, and the bone and
       tendon that show between muscles (collarbone, kneecap, Achilles
       tendon…). One region, "body", drawn in the lighter tone and never
       selectable.
     • the muscles — each superficial muscle is its own named region laid
       over the form. The names are anatomical (`vastus-medialis`), not the
       app's muscle ids: js/anatomy-regions.js says which app muscle each
       one belongs to, so the model never needs to know about the app.

   Most muscles are shells (sdf.mjs): the form's surface raised inside an
   outline, domed so each reads as a belly and meets its neighbours in a
   shallow groove. Outlines are drawn two ways:

     • torsoMuscle()  seen from the front, back or side, in cm (x or z
                      across, y up), clipped to that side of the body
     • limbMuscle()   round a limb: [angle, t] pairs, angle in degrees
                      (0 front, 90 outer side, 180 back, 270 or −90 inner
                      side) and t along it (0 at the upper joint, 1 at the
                      lower)

   A few structures that bridge a gap (the fold of the armpit, the slope of
   the neck) are strands of rounded cones instead.

   Everything is described for the figure's LEFT side (+x) and mirrored;
   parts marked `mid` sit on the midline and are not mirrored.
   ========================================================================= */

import { Ellipsoid, RoundCone, Field, Outline, Shell, Memo,
         add, sub, mul, dot, cross, len, norm } from "./sdf.mjs";

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
    a, b, u, f, l, length, ra, rb, cone, base: new Memo(cone),
    at: t => add(a, mul(u, t * length)),
    radius: t => ra + (rb - ra) * Math.min(1, Math.max(0, t)),
    dir: deg => { const r = deg * Math.PI / 180; return norm(add(mul(f, Math.cos(r)), mul(l, Math.sin(r)))); }
  };
}

const UPPER_ARM = limb(SHOULDER, ELBOW, 3.9, 3.3);
const FOREARM   = limb(ELBOW, WRIST, 3.2, 2.0);
const THIGH     = limb(HIP, KNEE, 7.0, 4.6);
const SHIN      = limb(add(KNEE, [0, -1.0, 0]), ANKLE, 4.3, 2.3);

/** A point on a limb's base surface. */
const limbPoint = (L, t, angle, lift = 0) => add(L.at(t), mul(L.dir(angle), L.radius(t) + lift));

/* ------------------------------- regions --------------------------------- */

const regions = [];
function region(name, kind = "muscle") {
  const r = { name, kind, parts: [] };
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

/* --------------------------------- form ---------------------------------- */

const body = region("body", "form");
const MID = { mid: true };

// Head: a calm ovoid with just enough brow, nose, jaw and ear to say which
// way it faces.
body.add(new Ellipsoid([0, 170.6, -0.9], [7.3, 9.2, 9.5]), 0, MID)
    .add(new Ellipsoid([0, 163.0, 2.8], [5.5, 6.3, 6.2]), 3.5, MID)
    .add(new Ellipsoid([0, 168.3, 6.8], [4.6, 1.1, 1.5]), 2.2, MID)
    .add(new Ellipsoid([0, 165.6, 8.7], [0.8, 1.9, 0.95], [1, 0, 0], norm([0, 1, -0.3])), 0.9, MID)
    .add(new Ellipsoid([4.4, 160.8, 0.6], [1.7, 2.4, 2.6]), 2.4)
    .add(new Ellipsoid([7.15, 166.3, -0.8], [0.8, 2.3, 1.5]), 0.9);

// The trunk. Also the form the torso's muscles are laid on (below).
const TRUNK = [
  { prim: new RoundCone([0, 149.0, -2.2], [0, 162.5, -1.4], 6.0, 5.2), k: 2.5 },   // neck
  { prim: new Ellipsoid([0, 139.4, 0.2], [14.2, 10.8, 9.8]), k: 5 },                // upper chest
  { prim: new Ellipsoid([0, 127.2, 0.6], [15.6, 15.2, 10.6]), k: 6 },               // lower ribs
  { prim: new Ellipsoid([0, 143.6, -1.8], [16.2, 6.6, 8.4]), k: 5 },                // shoulder girdle
  { prim: new Ellipsoid([0, 148.5, -3.2], [15.5, 6.5, 5.0]), k: 5 },                // neck-to-shoulder slope
  { prim: new Ellipsoid([0, 111.2, 1.0], [13.6, 12.2, 9.8]), k: 6 },                // abdomen
  { prim: new Ellipsoid([0, 96.4, -0.6], [16.0, 9.4, 10.6]), k: 5 }                 // pelvis
];
for (const { prim, k } of TRUNK) body.add(prim, k, MID);

// Collarbone, standing just proud between the neck and the chest.
strand(body, [[[1.8, 149.4, 5.9], 0.8], [[9.6, 150.2, 4.8], 0.75], [[17.0, 149.2, 0.2], 0.65]], 0.9);

// Arm, elbow and hand (palm forward, thumb out).
body.add(UPPER_ARM.cone, 2)
    .add(new Ellipsoid(ELBOW, [3.7, 2.4, 2.6], FOREARM.l, FOREARM.u, FOREARM.f), 1.5)
    .add(new Ellipsoid(add(ELBOW, mul(UPPER_ARM.dir(180), 2.2)), [1.5, 1.7, 1.3]), 1.0)   // olecranon
    .add(FOREARM.cone, 1.5)
    .add(new Ellipsoid(WRIST, [2.8, 1.3, 1.7], FOREARM.l, FOREARM.u, FOREARM.f), 1.2);
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
body.add(THIGH.cone, 3)
    .add(new Ellipsoid(KNEE, [5.1, 3.6, 4.5]), 2)
    .add(new Ellipsoid(add(KNEE, [0.3, 0.9, 4.1]), [2.5, 3.0, 1.45]), 1.1)          // kneecap
    .add(new RoundCone(add(KNEE, [0.3, -1.8, 4.5]), add(KNEE, [0.45, -7.0, 3.7]), 1.2, 1.05), 1.0)
    .add(SHIN.cone, 2)
    .add(new Ellipsoid(add(ANKLE, [-1.9, 0.8, 0.3]), [1.15, 1.5, 1.2]), 1.0)
    .add(new Ellipsoid(add(ANKLE, [1.8, -0.4, -0.7]), [1.05, 1.6, 1.1]), 1.0)
    .add(new Ellipsoid([12.1, 3.6, -4.6], [3.0, 3.6, 3.3]), 2)                      // heel
    .add(new Ellipsoid([12.6, 5.4, 2.4], [3.3, 2.8, 6.2]), 2.4)                     // instep
    .add(new RoundCone([12.2, 3.8, -2.6], [13.6, 2.3, 11.4], 3.1, 2.3), 2)
    .add(new Ellipsoid([14.1, 1.7, 15.0], [4.2, 1.6, 3.3]), 1.2);                   // toes

/* The form the torso muscles are laid on: the trunk, with the thighs for
   the hip muscles. It blends like the body does, so a shell sits exactly
   on the body's own surface. */
const TORSO = new Memo(new Field([{ name: "torso", kind: "form", parts: [
  ...TRUNK, { prim: THIGH.cone, k: 3 }, { prim: THIGH.cone.mirrored(), k: 3 }
] }], { reach: 40, cell: 8 }));

/* ------------------------------ muscle kinds ------------------------------ */

/**
 * A torso muscle outlined as seen from `view` ("front", "back" or "side"),
 * in cm: [x, y] from the front or back, [z, y] from the side. `clip` is
 * where the muscle stops round the body: a depth (z) for front and back,
 * a width (x) for the side.
 */
function torsoMuscle(view, points, { clip, t, soft, taper, grooves }) {
  const chart = view === "front" ? (x, y, z, o) => { o[0] = x; o[1] = y; o[2] = clip - z; }
              : view === "back"  ? (x, y, z, o) => { o[0] = x; o[1] = y; o[2] = z - clip; }
              :                    (x, y, z, o) => { o[0] = z; o[1] = y; o[2] = clip - x; };
  const outline = new Outline(points);
  const [u0, v0, u1, v1] = outline.box, m = t + (soft ?? outline.inradius) + 1;
  const box = view === "front" ? [u0 - m, v0 - m, clip - 1, u1 + m, v1 + m, 30]
            : view === "back"  ? [u0 - m, v0 - m, -30, u1 + m, v1 + m, clip + 1]
            :                    [clip - 1, v0 - m, u0 - m, 40, v1 + m, u1 + m];
  return new Shell(TORSO, chart, outline, { t, soft, taper, grooves }, box);
}

/** The chart round a limb: arc length (cm) from `centre` degrees, and length along it. */
function limbChart(L, centre) {
  const c0 = centre * Math.PI / 180, [ax, ay, az] = L.a, [ux, uy, uz] = L.u,
        [fx, fy, fz] = L.f, [lx, ly, lz] = L.l;
  return (x, y, z, o) => {
    const wx = x - ax, wy = y - ay, wz = z - az;
    const along = wx * ux + wy * uy + wz * uz;
    const rx = wx - ux * along, ry = wy - uy * along, rz = wz - uz * along;
    let a = Math.atan2(rx * lx + ry * ly + rz * lz, rx * fx + ry * fy + rz * fz) - c0;
    if (a > Math.PI) a -= 2 * Math.PI; else if (a <= -Math.PI) a += 2 * Math.PI;
    o[0] = a * L.radius(along / L.length); o[1] = along; o[2] = -Infinity;
  };
}

/** [angle, t] round a limb → outline coordinates about `centre` degrees. */
const limbUV = (L, centre, [angle, t]) =>
  [(angle - centre) * Math.PI / 180 * L.radius(t), t * L.length];

/** A limb muscle outlined by [angle, t] points (see the header). Its belly
    swells mid-length and thins towards the tendons. */
function limbMuscle(L, centre, points, { t, soft, taper, belly = 0.4 }) {
  const outline = new Outline(points.map(p => limbUV(L, centre, p)));
  return limbShell(L, centre, outline, points.map(p => p[1]), { t, soft, taper, belly });
}

/** A strap along a limb: a band `width` cm wide following [angle, t] points. */
function limbBand(L, centre, points, width, { t, soft }) {
  const uv = points.map(p => limbUV(L, centre, p));
  const side = sign => uv.map((p, i) => {
    const a = uv[Math.max(0, i - 1)], b = uv[Math.min(uv.length - 1, i + 1)];
    const du = b[0] - a[0], dv = b[1] - a[1], l = Math.hypot(du, dv) || 1;
    return [p[0] - dv / l * width / 2 * sign, p[1] + du / l * width / 2 * sign];
  });
  const outline = new Outline([...side(1), ...side(-1).reverse()], 3);
  return limbShell(L, centre, outline, points.map(p => p[1]), { t, soft });
}

function limbShell(L, centre, outline, ts, opts) {
  const t0 = Math.min(...ts), t1 = Math.max(...ts);
  const r = Math.max(L.ra, L.rb) + opts.t + 2;
  const p0 = L.at(t0), p1 = L.at(t1);
  const box = [0, 1, 2].map(i => Math.min(p0[i], p1[i]) - r)
    .concat([0, 1, 2].map(i => Math.max(p0[i], p1[i]) + r));
  return new Shell(L.base, limbChart(L, centre), outline, opts, box);
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
    [5.2, 162.8], [4.0, 162.5], [3.6, 158.5], [2.2, 154.0], [1.0, 151.4]], { clip: -2, t: 1.18 }), 0);

region("trapezius")
  .add(torsoMuscle("back", [[0.8, 161.6], [3.4, 160.6], [5.8, 156.2], [9.6, 152.2], [14.0, 149.9],
    [17.4, 148.9], [16.4, 146.4], [12.8, 145.0], [10.0, 143.2], [8.6, 140.4], [6.8, 134.2],
    [4.4, 125.8], [1.4, 117.6], [0.7, 122], [0.7, 140], [0.7, 155]],
    { clip: 2.5, t: 1.53, taper: [0, 0.025] }), 0);

region("pectoralis-major")
  .add(torsoMuscle("front", [[1.2, 146.8], [5.0, 147.6], [9.8, 147.4], [13.6, 145.6], [15.8, 142.4],
    [16.4, 138.6], [14.6, 133.4], [11.8, 129.8], [8.2, 127.4], [4.6, 126.8], [1.8, 127.8],
    [1.1, 133.0], [1.0, 140.5]],
    { clip: -2, t: 2.95, taper: [0.008, -0.018] }), 0);

{
  // Four digitations on the side of the ribs, between the chest and the lat.
  const serratus = region("serratus-anterior");
  [[12.4, 131.4], [12.9, 127.6], [13.2, 123.8], [13.1, 120.0]].forEach(([x, y], i) =>
    serratus.add(torsoMuscle("front", ellipse(x, y, 2.6, 1.05, -30),
      { clip: -3, t: 0.5 }), i ? 0.3 : 0));
}

region("rectus-abdominis")
  .add(torsoMuscle("front", [[1.0, 128.2], [4.4, 129.2], [7.6, 127.6], [8.2, 121.5], [8.0, 113.5],
    [7.3, 105.5], [5.9, 98.2], [3.8, 92.6], [1.9, 91.4], [0.9, 92.5], [0.8, 100], [0.8, 110],
    [0.85, 120]],
    { clip: 2, t: 1.89, grooves: [{ v: 110.6, w: 1.3, depth: 0.38 },
      { v: 117.2, w: 1.25, depth: 0.34 }, { v: 123.4, w: 1.2, depth: 0.3 }] }), 0);

region("external-oblique")
  .add(torsoMuscle("front", [[7.8, 128.4], [11.6, 130.2], [13.9, 127.4], [14.6, 120.5], [14.2, 113.5],
    [14.4, 107.0], [14.2, 101.8], [12.4, 100.2], [9.6, 97.4], [6.8, 94.8], [4.6, 93.4], [6.0, 98.6],
    [7.2, 104.5], [7.8, 112.0], [7.8, 121.0]],
    { clip: -6, t: 1.89, taper: [0.03, -0.02] }), 0);

/* --------------------------------- back ---------------------------------- */

region("infraspinatus")
  .add(torsoMuscle("back", [[9.6, 142.4], [13.8, 143.6], [15.6, 140.4], [15.2, 136.4], [13.0, 132.8],
    [10.2, 132.6], [8.6, 135.6], [8.8, 139.6]], { clip: 0, t: 1.77 }), 0);

region("teres-major")
  .add(torsoMuscle("back", [[10.6, 133.2], [13.0, 132.2], [15.6, 134.4], [16.4, 136.6], [15.0, 137.2],
    [12.4, 135.8]], { clip: 0, t: 1.65 }), 0);

region("latissimus-dorsi")
  .add(torsoMuscle("back", [[0.9, 127.8], [5.0, 129.8], [9.6, 131.8], [13.4, 133.6], [15.6, 135.6],
    [16.2, 131.5], [15.8, 125.0], [15.0, 118.0], [13.8, 111.5], [12.4, 106.4], [9.6, 106.0],
    [6.8, 109.8], [4.4, 115.2], [2.6, 120.4], [1.2, 124.6]],
    { clip: 4, t: 2.12, taper: [0.04, 0] }), 0);

region("erector-spinae")
  .add(torsoMuscle("back", [[1.4, 125.0], [4.6, 125.6], [6.4, 118.0], [6.9, 108.0], [6.1, 98.8],
    [4.0, 94.6], [1.6, 95.4], [1.1, 105], [1.2, 116]],
    { clip: -1, t: 2.36, taper: [0, -0.03] }), 0);

region("gluteus-medius")
  .add(torsoMuscle("back", [[8.6, 104.6], [12.0, 105.4], [14.9, 103.2], [16.0, 99.2], [15.2, 95.6],
    [12.6, 95.4], [9.8, 97.8]], { clip: 4, t: 2.12 }), 0);

region("gluteus-maximus")
  .add(torsoMuscle("back", [[1.4, 101.8], [5.8, 103.0], [10.6, 101.2], [14.3, 97.6], [15.8, 92.0],
    [15.5, 86.8], [13.0, 82.8], [8.4, 81.4], [4.2, 82.2], [1.6, 85.0], [1.0, 92.0]],
    { clip: 1, t: 3.89, taper: [0, -0.02] }), 0);

region("tensor-fasciae-latae")
  .add(torsoMuscle("front", [[11.4, 101.8], [13.9, 101.2], [15.1, 96.6], [15.4, 91.4], [14.3, 88.6],
    [12.6, 91.4], [11.7, 96.6]], { clip: -3, t: 1.77 }), 0);

/* ---------------------------------- arm ---------------------------------- */

region("deltoid")
  .add(limbMuscle(UPPER_ARM, 90, [[-32, -0.10], [0, -0.19], [60, -0.24], [120, -0.22], [180, -0.15],
    [218, -0.06], [208, 0.12], [150, 0.34], [95, 0.47], [40, 0.33], [-8, 0.16], [-34, 0.03]],
    { t: 2.6 }), 0);

region("biceps-brachii")
  .add(limbMuscle(UPPER_ARM, 0, [[-48, 0.3], [0, 0.22], [34, 0.34], [42, 0.6], [30, 0.8], [8, 0.94],
    [-12, 0.94], [-30, 0.8], [-44, 0.6]], { t: 2.6 }), 0);

region("brachialis")
  .add(limbMuscle(UPPER_ARM, 66, [[34, 0.56], [74, 0.46], [98, 0.62], [92, 0.9], [56, 0.96], [32, 0.8]],
    { t: 1.42 }), 0)
  .add(limbMuscle(UPPER_ARM, -62, [[-40, 0.58], [-75, 0.54], [-86, 0.7], [-78, 0.88], [-50, 0.93],
    [-38, 0.8]], { t: 1.18 }), 0.5);

region("triceps-brachii")
  .add(limbMuscle(UPPER_ARM, 185, [[104, 0.14], [175, 0.05], [240, 0.1], [276, 0.3], [272, 0.6],
    [248, 0.84], [215, 0.72], [200, 0.6], [180, 0.57], [160, 0.6], [132, 0.8], [100, 0.66], [94, 0.4]],
    { t: 2.6 }), 0);

// The flat tendon above the elbow at the back.
body.add(new Ellipsoid(limbPoint(UPPER_ARM, 0.8, 180, -1.0), [5.2, 1.3, 2.4], UPPER_ARM.u,
  UPPER_ARM.dir(180), cross(UPPER_ARM.u, UPPER_ARM.dir(180))), 1.0);

region("brachioradialis")
  .add(limbMuscle(FOREARM, 75, [[58, -0.14], [95, -0.08], [106, 0.15], [93, 0.45], [72, 0.63],
    [52, 0.46], [42, 0.12]], { t: 2.12 }), 0);

region("forearm-flexors")
  .add(limbMuscle(FOREARM, -20, [[-10, -0.02], [35, 0.06], [40, 0.3], [20, 0.62], [-20, 0.66],
    [-60, 0.6], [-85, 0.35], [-75, 0.08]], { t: 2.01 }), 0);

region("forearm-extensors")
  .add(limbMuscle(FOREARM, 160, [[110, 0.02], [160, -0.04], [205, 0.04], [215, 0.35], [195, 0.64],
    [150, 0.66], [115, 0.45]], { t: 1.89 }), 0);

/* ---------------------------------- leg ---------------------------------- */

region("rectus-femoris")
  .add(limbMuscle(THIGH, 3, [[0, 0.05], [26, 0.14], [34, 0.45], [22, 0.8], [4, 0.88], [-14, 0.8],
    [-28, 0.45], [-24, 0.14]], { t: 2.6 }), 0);

region("vastus-lateralis")
  .add(limbMuscle(THIGH, 85, [[30, 0.12], [95, 0.10], [135, 0.25], [140, 0.6], [115, 0.86], [70, 0.93],
    [30, 0.84], [24, 0.5]], { t: 2.95 }), 0);

region("vastus-medialis")
  .add(limbMuscle(THIGH, -55, [[-25, 0.5], [-15, 0.8], [-22, 0.95], [-55, 0.97], [-88, 0.85],
    [-95, 0.66], [-70, 0.52], [-45, 0.45]], { t: 3.19 }), 0);

// The long strap crossing the thigh from the hip bone to the inside of the
// knee; it starts on the pelvis, above where the thigh's own form begins.
region("sartorius")
  .add(torsoMuscle("front", [[11.9, 101.8], [13.9, 101.2], [13.9, 95.0], [13.2, 89.6], [11.2, 89.2],
    [11.3, 95.0]], { clip: 2, t: 1.3 }), 0)
  .add(limbBand(THIGH, -40, [[38, 0.02], [12, 0.22], [-30, 0.46], [-70, 0.7], [-100, 0.9], [-112, 1.0]],
    2.6, { t: 1.3 }), 0.8);

// The hip flexors in the hollow between the sartorius and the adductors.
region("iliopsoas")
  .add(torsoMuscle("front", [[6.2, 93.6], [9.6, 97.2], [11.4, 96.6], [11.4, 90.0], [10.2, 86.0],
    [7.4, 85.8], [5.2, 88.4]], { clip: 2, t: 1.6 }), 0);

region("adductors")
  .add(limbMuscle(THIGH, -110, [[-40, 0.02], [-100, -0.02], [-160, 0.05], [-170, 0.3], [-144, 0.6],
    [-100, 0.62], [-70, 0.4], [-45, 0.2]], { t: 2.6 }), 0);

region("gracilis")
  .add(limbBand(THIGH, -118, [[-118, 0.04], [-122, 0.4], [-118, 0.75], [-110, 0.97]], 2.2,
    { t: 1.3 }), 0);

region("biceps-femoris")
  .add(limbMuscle(THIGH, 150, [[125, 0.14], [168, 0.10], [182, 0.4], [174, 0.78], [150, 0.93],
    [128, 0.8], [120, 0.4]], { t: 2.71 }), 0);

region("semitendinosus")
  .add(limbMuscle(THIGH, 198, [[182, 0.1], [212, 0.08], [218, 0.45], [208, 0.8], [190, 0.86],
    [182, 0.5]], { t: 2.71 }), 0);

region("semimembranosus")
  .add(limbMuscle(THIGH, 235, [[218, 0.42], [245, 0.40], [252, 0.7], [238, 0.92], [220, 0.86]],
    { t: 2.12 }), 0);

region("gastrocnemius")
  .add(limbMuscle(SHIN, 215, [[185, 0.05], [235, 0.04], [252, 0.25], [240, 0.5], [215, 0.58],
    [190, 0.5], [184, 0.25]], { t: 3.19 }), 0)
  .add(limbMuscle(SHIN, 150, [[120, 0.08], [175, 0.03], [178, 0.25], [170, 0.44], [145, 0.47],
    [122, 0.3]], { t: 2.71 }), 0.6);

region("soleus")
  .add(limbMuscle(SHIN, 180, [[105, 0.35], [140, 0.5], [180, 0.56], [225, 0.6], [262, 0.42],
    [262, 0.7], [215, 0.82], [180, 0.84], [140, 0.8], [104, 0.65]], { t: 1.89 }), 0);

region("tibialis-anterior")
  .add(limbMuscle(SHIN, 34, [[10, 0.08], [54, 0.05], [66, 0.35], [50, 0.68], [22, 0.72], [8, 0.4]],
    { t: 1.77 }), 0);

region("fibularis")
  .add(limbMuscle(SHIN, 92, [[64, 0.1], [110, 0.08], [120, 0.4], [106, 0.72], [74, 0.7], [60, 0.35]],
    { t: 1.18 }), 0);

// The Achilles tendon and the shin's bony front edge.
body.add(new Ellipsoid(limbPoint(SHIN, 0.86, 180, -0.3), [6.0, 0.9, 1.0], SHIN.u, SHIN.dir(180),
  cross(SHIN.u, SHIN.dir(180))), 1.0);

/* ------------------------------- the result ------------------------------ */

/** The regions, with the left-side parts mirrored to the right. */
export function sculpture() {
  return regions.map(r => ({
    name: r.name, kind: r.kind,
    parts: r.parts.flatMap(p => p.mid ? [{ prim: p.prim, k: p.k }]
                                      : [{ prim: p.prim, k: p.k }, { prim: p.prim.mirrored(), k: p.k }])
  }));
}
