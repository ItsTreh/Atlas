/* ===========================================================================
   Signed distance fields for the anatomy sculpture.

   The sculpture is described as distance fields: every primitive answers
   "how far is this point from my surface" (negative inside). Primitives
   are blended into regions (one per anatomical structure) and the regions
   into one body. The mesher (mesh.mjs) turns the result into triangles.

   Units are centimetres. y is up (the floor is y = 0), +x is the figure's
   left, +z is the front.
   ========================================================================= */

/* ------------------------------ vectors ---------------------------------- */

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
                                a[0] * b[1] - a[1] * b[0]];
export const len = a => Math.hypot(a[0], a[1], a[2]);
export const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
                                  a[2] + (b[2] - a[2]) * t];
export const mirrorX = a => [-a[0], a[1], a[2]];

/** Rotates `v` about the unit axis `k` by `deg` degrees (Rodrigues). */
export function rotate(v, k, deg) {
  const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
}

/* ---------------------------- blending ----------------------------------- */

/** Polynomial smooth minimum: a union whose seam is rounded over `k` cm. */
export function smin(a, b, k) {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return (a < b ? a : b) - h * h * k * 0.25;
}
export const smax = (a, b, k) => -smin(-a, -b, k);

/* ---------------------------- primitives --------------------------------- */

/**
 * An ellipsoid with radii `r` along the orthonormal axes `u`, `v`, `w`.
 * The distance is Quilez's bound: exact on the surface, close near it.
 */
export class Ellipsoid {
  constructor(c, r, u = [1, 0, 0], v = [0, 1, 0], w = cross(u, v)) {
    this.c = c; this.r = r; this.u = u; this.v = v; this.w = w;
    const ext = i => Math.hypot(u[i] * r[0], v[i] * r[1], w[i] * r[2]);
    this.half = [ext(0), ext(1), ext(2)];
  }
  bounds() {
    const { c, half } = this;
    return [c[0] - half[0], c[1] - half[1], c[2] - half[2],
            c[0] + half[0], c[1] + half[1], c[2] + half[2]];
  }
  d(x, y, z) {
    const { c, r, u, v, w } = this;
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    const a = (px * u[0] + py * u[1] + pz * u[2]),
          b = (px * v[0] + py * v[1] + pz * v[2]),
          e = (px * w[0] + py * w[1] + pz * w[2]);
    const k0 = Math.hypot(a / r[0], b / r[1], e / r[2]);
    if (k0 < 1e-9) return -Math.min(r[0], r[1], r[2]);
    const k1 = Math.hypot(a / (r[0] * r[0]), b / (r[1] * r[1]), e / (r[2] * r[2]));
    return k0 * (k0 - 1) / k1;
  }
  mirrored() {
    return new Ellipsoid(mirrorX(this.c), this.r, mirrorX(this.u), mirrorX(this.v), mirrorX(this.w));
  }
}

/** A cone with rounded ends: radius `ra` at `a`, `rb` at `b` (Quilez, exact). */
export class RoundCone {
  constructor(a, b, ra, rb) {
    // The formula needs the radius change to be smaller than the length.
    const l = len(sub(b, a));
    if (Math.abs(ra - rb) >= l) rb = ra > rb ? ra - l * 0.95 : ra + l * 0.95;
    this.a = a; this.b = b; this.ra = ra; this.rb = rb;
    this.ba = sub(b, a); this.l2 = dot(this.ba, this.ba);
    this.rr = ra - rb; this.a2 = this.l2 - this.rr * this.rr; this.il2 = 1 / this.l2;
  }
  bounds() {
    const { a, b, ra, rb } = this;
    return [Math.min(a[0] - ra, b[0] - rb), Math.min(a[1] - ra, b[1] - rb), Math.min(a[2] - ra, b[2] - rb),
            Math.max(a[0] + ra, b[0] + rb), Math.max(a[1] + ra, b[1] + rb), Math.max(a[2] + ra, b[2] + rb)];
  }
  d(x, y, z) {
    const { a, ba, l2, rr, a2, il2, ra, rb } = this;
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const yy = pax * ba[0] + pay * ba[1] + paz * ba[2];
    const zz = yy - l2;
    const qx = pax * l2 - ba[0] * yy, qy = pay * l2 - ba[1] * yy, qz = paz * l2 - ba[2] * yy;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yy * yy * l2, z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra;
  }
  mirrored() { return new RoundCone(mirrorX(this.a), mirrorX(this.b), this.ra, this.rb); }
}

/* ------------------------------ the field -------------------------------- */

/**
 * The whole sculpture as one field. `regions` is a list of
 * { name, kind, parts: [{ prim, k }] }: each region is the smooth union of
 * its parts (part k = how softly it joins the parts before it), and the
 * body is the union of the regions with the small `seamK`, so neighbouring
 * muscles meet in a soft crease rather than melting into each other.
 *
 * Evaluation only visits the primitives near a point (a uniform grid of
 * lists), so it stays fast with a few hundred primitives. Beyond `reach` cm
 * from every primitive the field just reports `reach`: enough for meshing
 * and for the short-range queries the shading bake makes.
 */
export class Field {
  constructor(regions, { seamK = 0.5, floorK = 0.35, reach = 3, cell = 3 } = {}) {
    this.regions = regions;
    this.seamK = seamK; this.floorK = floorK; this.reach = reach;
    this.prims = [];                        // flat, in region then part order
    regions.forEach((region, ri) => region.parts.forEach(part =>
      this.prims.push({ prim: part.prim, k: part.k, region: ri })));

    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const boxes = this.prims.map(p => {
      const b = p.prim.bounds();
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], b[i]); hi[i] = Math.max(hi[i], b[i + 3]); }
      return b;
    });
    this.lo = lo.map(v => v - reach - cell); this.hi = hi.map(v => v + reach + cell);
    this.cell = cell;
    this.dims = [0, 1, 2].map(i => Math.ceil((this.hi[i] - this.lo[i]) / cell));
    const [nx, ny, nz] = this.dims;
    const lists = Array.from({ length: nx * ny * nz }, () => []);
    boxes.forEach((b, pi) => {
      const pad = reach + this.prims[pi].k + seamK;
      const i0 = [0, 1, 2].map(i => Math.max(0, Math.floor((b[i] - pad - this.lo[i]) / cell)));
      const i1 = [0, 1, 2].map(i => Math.min(this.dims[i] - 1, Math.floor((b[i + 3] + pad - this.lo[i]) / cell)));
      for (let z = i0[2]; z <= i1[2]; z++)
        for (let y = i0[1]; y <= i1[1]; y++)
          for (let x = i0[0]; x <= i1[0]; x++) lists[(z * ny + y) * nx + x].push(pi);
    });
    this.lists = lists.map(l => Int32Array.from(l));
  }

  listAt(x, y, z) {
    const { lo, cell, dims } = this;
    const i = Math.floor((x - lo[0]) / cell), j = Math.floor((y - lo[1]) / cell),
          k = Math.floor((z - lo[2]) / cell);
    if (i < 0 || j < 0 || k < 0 || i >= dims[0] || j >= dims[1] || k >= dims[2]) return null;
    return this.lists[(k * dims[1] + j) * dims[0] + i];
  }

  /** The signed distance to the body at a point. */
  d(x, y, z) {
    const list = this.listAt(x, y, z);
    let total = this.reach;
    if (list && list.length) {
      const { prims, seamK } = this;
      let region = -1, rd = 0, acc = Infinity;
      for (let n = 0; n < list.length; n++) {
        const p = prims[list[n]];
        const d = p.prim.d(x, y, z);
        if (p.region !== region) {
          if (region >= 0) acc = smin(acc, rd, seamK);
          region = p.region; rd = d;
        } else rd = smin(rd, d, p.k);
      }
      acc = smin(acc, rd, seamK);
      total = Math.min(acc, this.reach);
    }
    return smax(total, -y, this.floorK);          // a flat sole at the floor
  }

  /**
   * The distance to each region near a point, as a Map region → distance.
   * The closest region is the one the surface there belongs to.
   */
  regionDistances(x, y, z) {
    const out = new Map();
    const list = this.listAt(x, y, z);
    if (!list) return out;
    const { prims } = this;
    for (let n = 0; n < list.length; n++) {
      const p = prims[list[n]];
      const d = p.prim.d(x, y, z);
      const prev = out.get(p.region);
      out.set(p.region, prev === undefined ? d : smin(prev, d, p.k));
    }
    return out;
  }

  /**
   * How strongly region `ri` claims a point on the surface. A muscle claims
   * by how deep the point lies inside its outline, so region edges follow
   * the outlines as drawn and, where two overlap, run midway between their
   * edges. The claim is discounted by how far the region's own surface is
   * below the point (a thicker neighbour covers it). The form claims 0: it
   * shows only where no outline reaches.
   */
  score(ri, x, y, z) {
    const region = this.regions[ri];
    let claim = region.kind === "form" ? 0 : -Infinity;
    if (region.kind !== "form")
      for (const part of region.parts)
        if (part.prim.claim) claim = Math.max(claim, part.prim.claim(x, y, z));
        else claim = Math.max(claim, 0);
    return claim - 8 * Math.max(0, this.regionD(ri, x, y, z));
  }

  /** The distance to one region, from all its parts. */
  regionD(ri, x, y, z) {
    let rd = Infinity;
    for (const part of this.regions[ri].parts) {
      const d = part.prim.d(x, y, z);
      rd = rd === Infinity ? d : smin(rd, d, part.k);
    }
    return rd;
  }

  /** The unit outward normal (the field's gradient). */
  normal(x, y, z, e = 0.04) {
    const dx = this.d(x + e, y, z) - this.d(x - e, y, z);
    const dy = this.d(x, y + e, z) - this.d(x, y - e, z);
    const dz = this.d(x, y, z + e) - this.d(x, y, z - e);
    return norm([dx, dy, dz]);
  }
}

/* ------------------------- outlines and shells --------------------------- */

/**
 * A closed 2D outline through `points` ([u, v] in cm), smoothed into a
 * Catmull-Rom curve. d() is the signed distance to it (negative inside).
 */
export class Outline {
  constructor(points, samples = 6) {
    const n = points.length, poly = [];
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
      for (let s = 0; s < samples; s++) {
        const t = s / samples, t2 = t * t, t3 = t2 * t;
        poly.push([0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
      }
    }
    this.u = Float64Array.from(poly, p => p[0]);
    this.v = Float64Array.from(poly, p => p[1]);
    this.box = [Math.min(...this.u), Math.min(...this.v), Math.max(...this.u), Math.max(...this.v)];
    // How far the deepest point inside is from the edge: a muscle rising
    // over this distance is domed right across.
    const [u0, v0, u1, v1] = this.box;
    let deepest = 0;
    for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++)
      deepest = Math.max(deepest, -this.d(u0 + (u1 - u0) * i / 40, v0 + (v1 - v0) * j / 40, Infinity));
    this.inradius = deepest;
  }
  d(pu, pv, margin = 4) {
    const [u0, v0, u1, v1] = this.box;
    const ou = Math.max(u0 - pu, pu - u1, 0), ov = Math.max(v0 - pv, pv - v1, 0);
    if (ou > margin || ov > margin) return Math.hypot(ou, ov);      // far: the box is enough
    const U = this.u, V = this.v, n = U.length;
    let d = Infinity, s = 1;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const eu = U[j] - U[i], ev = V[j] - V[i], wu = pu - U[i], wv = pv - V[i];
      const t = Math.min(1, Math.max(0, (wu * eu + wv * ev) / (eu * eu + ev * ev)));
      const bu = wu - eu * t, bv = wv - ev * t;
      d = Math.min(d, bu * bu + bv * bv);
      const c1 = pv >= V[i], c2 = pv < V[j], c3 = eu * wv > ev * wu;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * Math.sqrt(d);
  }
}

/** A field that remembers its last answer: shells sharing a form ask it the same point in turn. */
export class Memo {
  constructor(field) { this.field = field; this.x = NaN; }
  d(x, y, z) {
    if (x === this.x && y === this.y && z === this.z) return this.v;
    this.x = x; this.y = y; this.z = z;
    return (this.v = this.field.d(x, y, z));
  }
}

/**
 * A muscle laid over a form: the form's surface raised by up to `t` cm
 * inside an outline, rising from nothing at the outline over `soft` cm.
 * By default `soft` is the outline's inradius, so the muscle is domed
 * right across; a smaller one gives a plateau with rounded edges.
 *
 * `chart(x, y, z, out)` writes the point's outline coordinates [u, v] and
 * a clip distance (negative on the side of the body the muscle is on) into
 * `out`. Options: `taper` [gu, gv] thickens the muscle along u and v (per
 * cm, from the outline's centre); `grooves` [{ v, w, depth }] cut shallow
 * furrows across it (the tendinous lines of the abdomen); `belly` swells it
 * in the middle of its length and thins it towards its ends (0 = even).
 */
export class Shell {
  constructor(base, chart, outline, { t, soft = null, taper = null, grooves = [], belly = 0 }, box) {
    this.base = base; this.chart = chart; this.outline = outline;
    this.t = t; this.soft = soft ?? outline.inradius * 0.95;
    this.taper = taper; this.grooves = grooves; this.belly = belly; this.box = box;
    const [u0, v0, u1, v1] = outline.box;
    this.centre = [(u0 + u1) / 2, (v0 + v1) / 2];
    this.halfLength = (v1 - v0) / 2;             // the length runs along v
    this.c = new Float64Array(3);
  }
  bounds() { return this.box; }
  d(x, y, z) {
    const c = this.c;
    this.chart(x, y, z, c);
    let m = this.outline.d(c[0], c[1], this.soft + this.t + 1);
    if (c[2] > m) m = c[2];
    const db = this.base.d(x, y, z);
    if (m >= 0) return Math.max(db, m * 0.5);
    // Half a dome, half a smoothstep: round across, easing into the form at
    // the edge instead of standing on it like a wall.
    const s = Math.min(1, -m / this.soft);
    let h = this.t * (0.5 * s * (2 - s) + 0.5 * s * s * (3 - 2 * s));
    if (this.taper) {
      const f = 1 + this.taper[0] * (c[0] - this.centre[0]) + this.taper[1] * (c[1] - this.centre[1]);
      h *= Math.min(2, Math.max(0.25, f));
    }
    if (this.belly) {
      const q = Math.min(1, Math.abs(c[1] - this.centre[1]) / this.halfLength);
      h *= 1 - this.belly * q * q;
    }
    for (const g of this.grooves) {
      const q = Math.min(1, Math.abs(c[1] - g.v) / g.w);
      h *= 1 - g.depth * (1 - q * q * (3 - 2 * q));
    }
    return Math.max(db - h, m * 0.5);
  }
  /** How deep a point lies inside the outline (cm; negative outside it). */
  claim(x, y, z) {
    const c = this.c;
    this.chart(x, y, z, c);
    const m = this.outline.d(c[0], c[1], 6);
    return -(c[2] > m ? c[2] : m);
  }
  mirrored() { return new Mirror(this); }
}

/** Any primitive reflected across x = 0. */
export class Mirror {
  constructor(prim) {
    this.prim = prim;
    const b = prim.bounds();
    this.box = [-b[3], b[1], b[2], -b[0], b[4], b[5]];
  }
  bounds() { return this.box; }
  d(x, y, z) { return this.prim.d(-x, y, z); }
  claim(x, y, z) { return this.prim.claim(-x, y, z); }
  mirrored() { return this.prim; }
}
