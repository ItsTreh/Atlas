/* ===========================================================================
   Ambient occlusion for an authored mesh, by ray casting (no dependencies).

   The procedural build bakes occlusion from its distance field; an authored
   mesh has no field, so each vertex instead casts rays over its hemisphere
   and measures how soon they hit the sculpture:

     near   rays stopped within NEAR cm   — creases, grooves between muscles
     far    rays stopped within FAR cm    — hollows: the armpit, under the arm

   occlusion = (1 − NEAR_WEIGHT · near) · (1 − FAR_WEIGHT · far), 1 = open.
   The weights are tuned so the authored figure and the procedural one sit
   in the same tonal range under the renderer's light.
   ========================================================================= */

export const OCCLUSION = { rays: 64, near: 2.2, far: 12, nearWeight: 0.85, farWeight: 0.7, lift: 0.02 };

/** A bounding-volume hierarchy over triangles, for nearest-hit ray queries. */
export class Bvh {
  constructor(positions, indices) {
    this.p = positions; this.idx = indices;
    const n = indices.length / 3;
    this.tri = new Uint32Array(n).map((_, i) => i);
    const c = new Float64Array(n * 3), lo = new Float64Array(n * 3), hi = new Float64Array(n * 3);
    for (let t = 0; t < n; t++)
      for (let k = 0; k < 3; k++) {
        const a = positions[indices[t * 3] * 3 + k], b = positions[indices[t * 3 + 1] * 3 + k],
              d = positions[indices[t * 3 + 2] * 3 + k];
        lo[t * 3 + k] = Math.min(a, b, d); hi[t * 3 + k] = Math.max(a, b, d);
        c[t * 3 + k] = (a + b + d) / 3;
      }
    this.nodes = [];
    const build = (start, end) => {
      const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let i = start; i < end; i++) {
        const t = this.tri[i];
        for (let k = 0; k < 3; k++) {
          box[k] = Math.min(box[k], lo[t * 3 + k]); box[k + 3] = Math.max(box[k + 3], hi[t * 3 + k]);
        }
      }
      const node = { box, start, end, left: -1, right: -1 };
      const id = this.nodes.push(node) - 1;
      if (end - start <= 4) return id;
      const ext = [box[3] - box[0], box[4] - box[1], box[5] - box[2]];
      const axis = ext[0] > ext[1] ? (ext[0] > ext[2] ? 0 : 2) : (ext[1] > ext[2] ? 1 : 2);
      const sub = Array.from(this.tri.subarray(start, end)).sort((a, b) => c[a * 3 + axis] - c[b * 3 + axis]);
      this.tri.set(sub, start);
      const mid = (start + end) >> 1;
      node.left = build(start, mid);
      node.right = build(mid, end);
      return id;
    };
    build(0, n);
  }

  /** Distance to the nearest hit along a unit ray, or Infinity beyond `tmax`. */
  cast(ox, oy, oz, dx, dy, dz, tmax) {
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz, p = this.p, idx = this.idx;
    let best = tmax;
    const stack = [0];
    while (stack.length) {
      const node = this.nodes[stack.pop()], b = node.box;
      let t0 = ((ix >= 0 ? b[0] : b[3]) - ox) * ix, t1 = ((ix >= 0 ? b[3] : b[0]) - ox) * ix;
      const ty0 = ((iy >= 0 ? b[1] : b[4]) - oy) * iy, ty1 = ((iy >= 0 ? b[4] : b[1]) - oy) * iy;
      if (t0 > ty1 || ty0 > t1) continue;
      t0 = Math.max(t0, ty0); t1 = Math.min(t1, ty1);
      const tz0 = ((iz >= 0 ? b[2] : b[5]) - oz) * iz, tz1 = ((iz >= 0 ? b[5] : b[2]) - oz) * iz;
      if (t0 > tz1 || tz0 > t1) continue;
      t0 = Math.max(t0, tz0); t1 = Math.min(t1, tz1);
      if (t1 < 0 || t0 > best) continue;
      if (node.left < 0) {
        for (let i = node.start; i < node.end; i++) {
          const t = this.tri[i], a = idx[t * 3] * 3, bb = idx[t * 3 + 1] * 3, cc = idx[t * 3 + 2] * 3;
          const e1x = p[bb] - p[a], e1y = p[bb + 1] - p[a + 1], e1z = p[bb + 2] - p[a + 2];
          const e2x = p[cc] - p[a], e2y = p[cc + 1] - p[a + 1], e2z = p[cc + 2] - p[a + 2];
          const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x;
          const det = e1x * hx + e1y * hy + e1z * hz;
          if (Math.abs(det) < 1e-12) continue;
          const inv = 1 / det, sx = ox - p[a], sy = oy - p[a + 1], sz = oz - p[a + 2];
          const u = (sx * hx + sy * hy + sz * hz) * inv;
          if (u < 0 || u > 1) continue;
          const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
          const v = (dx * qx + dy * qy + dz * qz) * inv;
          if (v < 0 || u + v > 1) continue;
          const t2 = (e2x * qx + e2y * qy + e2z * qz) * inv;
          if (t2 > 1e-4 && t2 < best) best = t2;
        }
      } else {
        stack.push(node.left, node.right);
      }
    }
    return best;
  }
}

/** Cosine-weighted directions over a hemisphere about +z (a golden spiral). */
function hemisphere(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const z = Math.sqrt(1 - (i + 0.5) / n), r = Math.sqrt(1 - z * z), a = i * 2.399963229728653;
    out.push([r * Math.cos(a), r * Math.sin(a), z]);
  }
  return out;
}

/**
 * Occlusion per vertex (0 closed … 1 open) for `positions` (x, y, z per
 * vertex, cm) with unit `normals`, against the triangles `indices`.
 */
export function bakeOcclusion(positions, normals, indices, opts = OCCLUSION) {
  const bvh = new Bvh(positions, indices);
  const dirs = hemisphere(opts.rays);
  const count = positions.length / 3, out = new Float32Array(count);
  for (let v = 0; v < count; v++) {
    const nx = normals[v * 3], ny = normals[v * 3 + 1], nz = normals[v * 3 + 2];
    // A frame round the normal.
    let tx = Math.abs(ny) < 0.9 ? nz : 0, ty = Math.abs(ny) < 0.9 ? 0 : -nz, tz = Math.abs(ny) < 0.9 ? -nx : ny;
    const tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
    const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
    const ox = positions[v * 3] + nx * opts.lift, oy = positions[v * 3 + 1] + ny * opts.lift,
          oz = positions[v * 3 + 2] + nz * opts.lift;
    let near = 0, far = 0;
    for (const [a, b, c] of dirs) {
      const dx = tx * a + bx * b + nx * c, dy = ty * a + by * b + ny * c, dz = tz * a + bz * b + nz * c;
      const t = bvh.cast(ox, oy, oz, dx, dy, dz, opts.far);
      if (t < opts.near) near += 1 - t / opts.near;
      if (t < opts.far) far += 1 - t / opts.far;
    }
    near /= dirs.length; far /= dirs.length;
    out[v] = (1 - opts.nearWeight * near) * (1 - opts.farWeight * far);
  }
  return out;
}

/** The closest point on a triangle to p, with its barycentric weights. */
export function closestOnTriangle(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return { q: a, w: [1, 0, 0] };
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return { q: b, w: [0, 1, 0] };
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return { q: add(a, mul(ab, v)), w: [1 - v, v, 0] };
  }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return { q: c, w: [0, 0, 1] };
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return { q: add(a, mul(ac, w)), w: [1 - w, 0, w] };
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    return { q: add(b, mul(sub(c, b), w)), w: [0, 1 - w, w] };
  }
  const denom = 1 / (va + vb + vc), v = vb * denom, w = vc * denom;
  return { q: add(add(a, mul(ab, v)), mul(ac, w)), w: [1 - v - w, v, w] };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
