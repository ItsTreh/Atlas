/* ===========================================================================
   Builds js/anatomy-model.js from the sculpture.

     npm run build:anatomy

   Steps: mesh the field (surface nets) → give every triangle one region,
   cutting along region boundaries → measure each vertex's distance to the
   nearest boundary (the seam lines) → simplify, keeping every boundary
   exactly where it is → bake normals and soft occlusion → pack.

   The output is plain data in a classic script, so the page still opens
   straight from disk. Only this script needs Node and meshoptimizer; the
   page needs neither.
   ========================================================================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MeshoptSimplifier, MeshoptEncoder } from "meshoptimizer";
import { Field, norm, cross, dot, add, mul } from "./sdf.mjs";
import { sculpture } from "./sculpture.mjs";
import { surfaceNets, vertexRegions, splitRegions, seamDistances } from "./mesh.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "js/anatomy-model.js");

const GRID = 0.5;            // cm between samples when meshing
const SEAM_CAP = 3;          // cm; seam distances beyond this are stored as the cap
const TARGET_TRIANGLES = 42000;
const MAX_ERROR = 0.0006;    // of the figure's size: about 1 mm

const t0 = Date.now();
const log = msg => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(5) + "s  " + msg);

const regions = sculpture();
const field = new Field(regions, { seamK: 0.5, reach: 2.5, cell: 3 });
const farField = new Field(regions, { seamK: 0.5, reach: 12, cell: 6 });
log(regions.length + " regions, " + field.prims.length + " primitives");

/* 1. Mesh. */
const lo = [-42, -0.5, -18], hi = [42, 182.5, 26];
const nets = surfaceNets(field, lo, hi, GRID);
log("surface nets: " + nets.positions.length + " vertices, " + nets.triangles.length / 3 + " triangles");

/* 2. One region per triangle. */
const split = splitRegions(field, nets.positions, vertexRegions(field, nets.positions), nets.triangles);
log("split: " + split.positions.length + " vertices, " + split.triangles.length / 3 +
    " triangles, " + split.segments.length + " boundary segments");

/* 3. Seams. */
const seam = seamDistances(split.positions, split.segments, SEAM_CAP);
log("seam distances");

/* 4. Simplify. Region boundaries are mesh borders (their vertices are
      copied per region), so locking the border keeps them intact. */
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const flat = new Float32Array(split.positions.length * 3);
split.positions.forEach((p, i) => flat.set(p, i * 3));
const [simplified] = MeshoptSimplifier.simplify(Uint32Array.from(split.triangles), flat, 3,
  TARGET_TRIANGLES * 3, MAX_ERROR, ["LockBorder"]);
const [remap, vertexCount] = MeshoptEncoder.reorderMesh(simplified, true, false);
const indices = simplified;                      // reordered in place by reorderMesh
const source = new Int32Array(vertexCount);      // new vertex → old vertex
remap.forEach((to, from) => { if (to !== 0xffffffff) source[to] = from; });
log("simplified: " + vertexCount + " vertices, " + indices.length / 3 + " triangles");

/* 5. Normals and occlusion, from the field itself so shading stays as
      smooth as the sculpture even where the mesh is coarse. */
const DIRS = hemisphere(14);
function occlusion(p, n) {
  // Creases: how quickly the surface closes in along the normal.
  let crease = 0, wsum = 0;
  [[0.3, 1], [0.7, 0.9], [1.3, 0.75], [2.1, 0.6], [3.2, 0.45]].forEach(([h, w]) => {
    const d = farField.d(p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h);
    crease += w * Math.min(1, Math.max(0, (h - d) / h)); wsum += w;
  });
  crease /= wsum;
  // Cavities: armpits, between the legs, under the chin.
  const t = norm(Math.abs(n[1]) < 0.9 ? cross(n, [0, 1, 0]) : cross(n, [1, 0, 0]));
  const b = cross(n, t);
  let blocked = 0, total = 0;
  for (const [x, y, z] of DIRS) {
    const dir = norm(add(add(mul(t, x), mul(b, y)), mul(n, z)));
    for (const r of [2.5, 6, 11]) {
      const q = add(p, mul(dir, r));
      total += z;
      if (farField.d(q[0], q[1], q[2]) < r * 0.35) blocked += z;
    }
  }
  return (1 - 0.8 * crease) * (1 - 0.6 * blocked / total);
}

const VERTEX_BYTES = 14;     // position 3×u16, normal 2×i16 (octahedral), region, occlusion, seam, spare
const vbuf = new ArrayBuffer(vertexCount * VERTEX_BYTES);
const view = new DataView(vbuf);
const bmin = [Infinity, Infinity, Infinity], bmax = [-Infinity, -Infinity, -Infinity];
for (let v = 0; v < vertexCount; v++) {
  const p = split.positions[source[v]];
  for (let i = 0; i < 3; i++) { bmin[i] = Math.min(bmin[i], p[i]); bmax[i] = Math.max(bmax[i], p[i]); }
}
const ext = bmax.map((m, i) => m - bmin[i]);
for (let v = 0; v < vertexCount; v++) {
  const s = source[v], p = split.positions[s];
  const n = field.normal(p[0], p[1], p[2]);
  const o = v * VERTEX_BYTES;
  for (let i = 0; i < 3; i++) view.setUint16(o + i * 2, Math.round((p[i] - bmin[i]) / ext[i] * 65535), true);
  const [ox, oy] = octEncode(n);
  view.setInt16(o + 6, Math.round(ox * 32767), true);
  view.setInt16(o + 8, Math.round(oy * 32767), true);
  view.setUint8(o + 10, split.regions[s]);
  view.setUint8(o + 11, Math.round(Math.min(1, Math.max(0, occlusion(p, n))) * 255));
  view.setUint8(o + 12, Math.round(Math.min(1, seam[s] / SEAM_CAP) * 255));
}
log("shading baked");

/* 6. Pack. */
const wide = vertexCount > 65535;
const ibuf = wide ? Uint32Array.from(indices) : Uint16Array.from(indices);
const bytes = new Uint8Array(vbuf.byteLength + ibuf.byteLength);
bytes.set(new Uint8Array(vbuf), 0);
bytes.set(new Uint8Array(ibuf.buffer), vbuf.byteLength);
const round = a => a.map(v => Math.round(v * 1000) / 1000);

const js = `/* ===========================================================================
   The ATLAS anatomy sculpture — GENERATED by tools/anatomy/build.mjs.
   Do not edit by hand: change tools/anatomy/sculpture.mjs and run
   \`npm run build:anatomy\`.

   ${vertexCount} vertices, ${indices.length / 3} triangles, ${regions.length} regions. Centimetres,
   y up (floor at 0), +x the figure's left, +z its front.

   \`data\` is base64: the vertex buffer, then the index buffer
   (${wide ? "uint32" : "uint16"}). Each vertex is ${VERTEX_BYTES} bytes:
     0  position   3 × uint16, scaled from bounds.min to bounds.max
     6  normal     2 × int16, octahedral
    10  region     uint8, an index into \`regions\`
    11  occlusion  uint8, 0 (fully occluded) … 255 (open)
    12  seam       uint8, distance to the nearest region boundary, 255 = seamMax cm
    13  (spare)
   Every triangle's three vertices share one region.
   ========================================================================= */

const ANATOMY_MODEL = Object.freeze({
  bounds: { min: [${round(bmin)}], max: [${round(bmax)}] },
  regions: Object.freeze(${JSON.stringify(regions.map(r => r.name))}),
  kinds: Object.freeze(${JSON.stringify(regions.map(r => r.kind))}),
  vertexCount: ${vertexCount},
  indexCount: ${indices.length},
  vertexBytes: ${VERTEX_BYTES},
  wideIndices: ${wide},
  seamMax: ${SEAM_CAP},
  data: "${Buffer.from(bytes).toString("base64")}"
});
`;
fs.writeFileSync(OUT, js);
log("wrote " + path.relative(ROOT, OUT) + " (" + (js.length / 1024).toFixed(0) + " KB)");

/* ------------------------------- helpers --------------------------------- */

function octEncode([x, y, z]) {
  const s = Math.abs(x) + Math.abs(y) + Math.abs(z);
  let ox = x / s, oy = y / s;
  if (z < 0) {
    const tx = (1 - Math.abs(oy)) * (ox >= 0 ? 1 : -1), ty = (1 - Math.abs(ox)) * (oy >= 0 ? 1 : -1);
    ox = tx; oy = ty;
  }
  return [ox, oy];
}

/** Directions over a hemisphere (z up), denser towards the pole. */
function hemisphere(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const z = Math.sqrt(1 - (i + 0.5) / n);           // cosine-weighted
    const r = Math.sqrt(1 - z * z), a = i * 2.39996323;
    out.push([r * Math.cos(a), r * Math.sin(a), z]);
  }
  return out;
}
