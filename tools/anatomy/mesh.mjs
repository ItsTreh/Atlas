/* ===========================================================================
   Meshing the sculpture's field.

     surfaceNets()   triangles on the field's zero surface, from a grid
     splitRegions()  cuts every triangle that straddles two regions along
                     the boundary between them, so each triangle belongs to
                     exactly one region and region edges are smooth lines,
                     not the staircase of the triangles underneath
     seamDistances() how far each vertex is from the nearest region
                     boundary: the renderer draws the anatomical seams from
                     it at a constant on-screen width
   ========================================================================= */

import { sub, dot, cross, len, norm, lerp, add, mul } from "./sdf.mjs";

const BIG = 1e3;

/** Moves a point onto the surface along the field's gradient. */
export function project(field, p, steps = 3, limit = Infinity) {
  let q = p;
  for (let i = 0; i < steps; i++) {
    const d = field.d(q[0], q[1], q[2]);
    if (Math.abs(d) < 1e-4) break;
    const n = field.normal(q[0], q[1], q[2], 0.02);
    q = sub(q, mul(n, d));
  }
  return len(sub(q, p)) > limit ? p : q;
}

/**
 * Naive surface nets on a grid of spacing `h` over [lo, hi]. The field is
 * only evaluated in blocks near the surface; the rest take the sign of
 * their block, which is safe for a field that is (close to) a distance.
 */
export function surfaceNets(field, lo, hi, h) {
  const nx = Math.ceil((hi[0] - lo[0]) / h) + 1, ny = Math.ceil((hi[1] - lo[1]) / h) + 1,
        nz = Math.ceil((hi[2] - lo[2]) / h) + 1;
  const at = (i, j, k) => (k * ny + j) * nx + i;
  const val = new Float32Array(nx * ny * nz);
  const done = new Uint8Array(nx * ny * nz);
  // Shells rise faster than a true distance (up to ~3 cm per cm at their
  // edges), so a block is only skipped when it is far clear of the surface.
  const B = 8, reach = B * h * Math.sqrt(3) / 2 * 3 + h;

  for (let bk = 0; bk * B < nz; bk++)
    for (let bj = 0; bj * B < ny; bj++)
      for (let bi = 0; bi * B < nx; bi++) {
        const cx = lo[0] + (bi * B + B / 2) * h, cy = lo[1] + (bj * B + B / 2) * h,
              cz = lo[2] + (bk * B + B / 2) * h;
        const dc = field.d(cx, cy, cz);
        const i1 = Math.min(nx - 1, bi * B + B), j1 = Math.min(ny - 1, bj * B + B),
              k1 = Math.min(nz - 1, bk * B + B);
        if (Math.abs(dc) > reach) {
          const s = dc < 0 ? -BIG : BIG;
          for (let k = bk * B; k <= k1; k++) for (let j = bj * B; j <= j1; j++)
            for (let i = bi * B; i <= i1; i++) { const n = at(i, j, k); if (!done[n]) val[n] = s; }
          continue;
        }
        for (let k = bk * B; k <= k1; k++) for (let j = bj * B; j <= j1; j++)
          for (let i = bi * B; i <= i1; i++) {
            const n = at(i, j, k);
            if (done[n]) continue;
            val[n] = field.d(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h);
            done[n] = 1;
          }
      }

  // One vertex per cell the surface passes through: the mean of the edge
  // crossings, then pulled onto the surface.
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cellVertex = new Int32Array(cx * cy * cz).fill(-1);
  const pos = [];
  const corner = [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];
  const edges = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  const v = new Float64Array(8);
  for (let k = 0; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        let neg = 0;
        for (let c = 0; c < 8; c++) {
          v[c] = val[at(i + corner[c][0], j + corner[c][1], k + corner[c][2])];
          if (v[c] < 0) neg++;
        }
        if (neg === 0 || neg === 8) continue;
        let sx = 0, sy = 0, sz = 0, m = 0;
        for (const [a, b] of edges) {
          if ((v[a] < 0) === (v[b] < 0)) continue;
          const t = v[a] / (v[a] - v[b]);
          sx += corner[a][0] + (corner[b][0] - corner[a][0]) * t;
          sy += corner[a][1] + (corner[b][1] - corner[a][1]) * t;
          sz += corner[a][2] + (corner[b][2] - corner[a][2]) * t;
          m++;
        }
        const p = [lo[0] + (i + sx / m) * h, lo[1] + (j + sy / m) * h, lo[2] + (k + sz / m) * h];
        cellVertex[(k * cy + j) * cx + i] = pos.length;
        pos.push(project(field, p, 3, h));
      }

  // A quad round every grid edge the surface crosses, wound outwards.
  const tris = [];
  const cell = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= cx || j >= cy || k >= cz)
    ? -1 : cellVertex[(k * cy + j) * cx + i];
  const quad = (a, b, c, d, out) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    const [pa, pb, pc, pd] = [pos[a], pos[b], pos[c], pos[d]];
    const nrm = cross(sub(pc, pa), sub(pd, pb));
    if (dot(nrm, out) < 0) [b, d] = [d, b];
    // Split along the shorter diagonal.
    if (len(sub(pos[a], pos[c])) <= len(sub(pos[b], pos[d]))) tris.push(a, b, c, a, c, d);
    else tris.push(a, b, d, b, c, d);
  };
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const v0 = val[at(i, j, k)];
        if (i + 1 < nx && (v0 < 0) !== (val[at(i + 1, j, k)] < 0))
          quad(cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k), [v0 < 0 ? 1 : -1, 0, 0]);
        if (j + 1 < ny && (v0 < 0) !== (val[at(i, j + 1, k)] < 0))
          quad(cell(i - 1, j, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i - 1, j, k), [0, v0 < 0 ? 1 : -1, 0]);
        if (k + 1 < nz && (v0 < 0) !== (val[at(i, j, k + 1)] < 0))
          quad(cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k), [0, 0, v0 < 0 ? 1 : -1]);
      }
  return { positions: pos, triangles: tris };
}

/** The region each vertex belongs to: the one that claims it most (Field.score). */
export function vertexRegions(field, positions) {
  return positions.map(p => {
    let best = 0, bs = -Infinity;
    for (const r of field.regionDistances(p[0], p[1], p[2]).keys()) {
      const sc = field.score(r, p[0], p[1], p[2]);
      if (sc > bs) { bs = sc; best = r; }
    }
    return best;
  });
}

/**
 * Cuts the triangles that straddle regions. Where a triangle's corners
 * belong to two regions, the cut follows where their claims are equal
 * (Field.score) along its edges; where three meet, it runs from each edge
 * to a centre point. The
 * new points are shared by both sides (same position, so no cracks) but
 * copied per region, so every output triangle has a single region.
 *
 * Returns positions, the region of each vertex, triangles, and the
 * boundary as line segments (pairs of positions).
 */
export function splitRegions(field, positions, regions, triangles) {
  const outPos = positions.slice(), outReg = regions.slice(), outTri = [];
  const segments = [];
  const edgePoint = new Map();          // "i:j" → position
  const copies = new Map();             // "key|region" → vertex index
  const vertexOf = (key, p, region) => {
    const k = key + "|" + region;
    let v = copies.get(k);
    if (v === undefined) { v = outPos.length; outPos.push(p); outReg.push(region); copies.set(k, v); }
    return v;
  };
  const cut = (i, j) => {
    const key = i < j ? i + ":" + j : j + ":" + i;
    let p = edgePoint.get(key);
    if (!p) {
      const [a, b] = i < j ? [i, j] : [j, i];
      const pa = positions[a], pb = positions[b], ra = regions[a], rb = regions[b];
      const fa = field.score(ra, ...pa) - field.score(rb, ...pa);
      const fb = field.score(ra, ...pb) - field.score(rb, ...pb);
      let t = fa === fb ? 0.5 : fa / (fa - fb);
      t = Math.min(0.92, Math.max(0.08, t));
      p = project(field, lerp(pa, pb, t), 2, len(sub(pb, pa)));
      edgePoint.set(key, p);
    }
    return { key, p };
  };

  for (let n = 0; n < triangles.length; n += 3) {
    const t = [triangles[n], triangles[n + 1], triangles[n + 2]];
    const r = t.map(i => regions[i]);
    if (r[0] === r[1] && r[1] === r[2]) { outTri.push(...t); continue; }

    if (r[0] !== r[1] && r[1] !== r[2] && r[0] !== r[2]) {
      // Three regions: each corner keeps the part nearest it.
      const e01 = cut(t[0], t[1]), e12 = cut(t[1], t[2]), e20 = cut(t[2], t[0]);
      const mid = project(field, mul(add(add(e01.p, e12.p), e20.p), 1 / 3), 2, 1);
      const cKey = "c" + n;
      const parts = [[0, e01, e20], [1, e12, e01], [2, e20, e12]];
      for (const [c, next, prev] of parts) {
        const reg = r[c];
        const vc = vertexOf(cKey, mid, reg), vn = vertexOf(next.key, next.p, reg),
              vp = vertexOf(prev.key, prev.p, reg);
        outTri.push(t[c], vn, vc, t[c], vc, vp);
      }
      segments.push([e01.p, mid], [e12.p, mid], [e20.p, mid]);
      continue;
    }

    // Two regions: rotate so the odd corner is last.
    let s = r[0] === r[1] ? 0 : r[1] === r[2] ? 1 : 2;
    const a = t[s], b = t[(s + 1) % 3], c = t[(s + 2) % 3];
    const A = regions[a], C = regions[c];
    const eac = cut(a, c), ebc = cut(b, c);
    const vac_A = vertexOf(eac.key, eac.p, A), vbc_A = vertexOf(ebc.key, ebc.p, A);
    const vac_C = vertexOf(eac.key, eac.p, C), vbc_C = vertexOf(ebc.key, ebc.p, C);
    outTri.push(a, b, vbc_A, a, vbc_A, vac_A, vac_C, vbc_C, c);
    segments.push([eac.p, ebc.p]);
  }
  return { positions: outPos, regions: outReg, triangles: outTri, segments };
}

/** Distance from each position to the nearest boundary segment, capped at `cap`. */
export function seamDistances(positions, segments, cap) {
  const cell = cap;
  const grid = new Map();
  const keyOf = (x, y, z) => x + "," + y + "," + z;
  segments.forEach((s, n) => {
    const lo = [0, 1, 2].map(i => Math.floor(Math.min(s[0][i], s[1][i]) / cell));
    const hi = [0, 1, 2].map(i => Math.floor(Math.max(s[0][i], s[1][i]) / cell));
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++)
      for (let z = lo[2]; z <= hi[2]; z++) {
        const k = keyOf(x, y, z);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(n);
      }
  });
  const segDist = (p, [a, b]) => {
    const ab = sub(b, a), l2 = dot(ab, ab);
    const t = l2 ? Math.min(1, Math.max(0, dot(sub(p, a), ab) / l2)) : 0;
    return len(sub(p, add(a, mul(ab, t))));
  };
  return positions.map(p => {
    let best = cap;
    const c = p.map(v => Math.floor(v / cell));
    for (let x = c[0] - 1; x <= c[0] + 1; x++) for (let y = c[1] - 1; y <= c[1] + 1; y++)
      for (let z = c[2] - 1; z <= c[2] + 1; z++) {
        const list = grid.get(keyOf(x, y, z));
        if (list) for (const n of list) best = Math.min(best, segDist(p, segments[n]));
      }
    return best;
  });
}
