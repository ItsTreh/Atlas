/* ===========================================================================
   Builds an ATLAS anatomy model from an AUTHORED asset.

     npm run build:anatomy-authored

   Reads the manifest (assets/anatomy/torso-study.manifest.json), the glTF it
   names (exported from the .blend by tools/anatomy/authored/export_glb.py)
   and nothing else: no shapes are generated here. Writes a classic script
   (js/anatomy-model-authored.js) in the ANATOMY_MODEL shape the renderer
   already reads, so the page still opens straight from disk.

     asset material name ─► manifest region ─► ATLAS region name ─►
     ANATOMY_REGIONS ─► app muscle id

   Steps: read the primitives (one per region) → check every region against
   the manifest and ANATOMY_REGIONS → simplify, keeping region borders →
   seam distances (mesh.mjs) → ray-cast occlusion (occlusion.mjs) → bind the
   landmarks to triangles → region anchors → pack, with the states as morph
   deltas.

   Fails loudly on: an unknown region or landmark, a region the asset lacks,
   a region with too few triangles, a manifest region pointing at an ATLAS
   region that does not exist, a landmark off its region or off the surface,
   a state that changes the vertex count.

   Any asset: pass its manifest (a .json path; the torso study's by default).
   Options: --glb <path>, --out <path> override the manifest's paths.
   ========================================================================= */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { MeshoptSimplifier, MeshoptEncoder } from "meshoptimizer";
import { readGlb, readAccessor, worldMatrices, transform } from "./glb.mjs";
import { bakeOcclusion, closestOnTriangle, OCCLUSION } from "./occlusion.mjs";
import { seamDistances } from "./mesh.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SEAM_CAP = 3;                 // cm, as in the procedural build
const VERTEX_BYTES = 14;            // the renderer's vertex format (see js/anatomy-model.js)
const STRUCTURES = new Set(["muscle", "bone", "tendon", "cut", "form"]);
const SIDES = new Set(["left", "right", "midline"]);     // a region's side, where the manifest gives one

const t0 = Date.now();
const log = msg => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(5) + "s  " + msg);
const fail = msg => { throw new Error("build-authored: " + msg); };

/* ---------------------------------------------------------------- inputs */

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const manifestPath = path.resolve(ROOT, args.find(a => a.endsWith(".json")) ||
                                        "assets/anatomy/torso-study.manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const glbPath = path.resolve(ROOT, opt("--glb") || manifest.glb);
const outPath = path.resolve(ROOT, opt("--out") || manifest.output);

/** ANATOMY_REGIONS and the muscle catalogue, from the app's own files. */
function atlasTables() {
  const ctx = vm.createContext({ console: { ...console, error: m => fail(m) },
                                 ANATOMY_MODEL: { regions: [], kinds: [] } });
  for (const f of ["js/model.js", "js/anatomy-regions.js"])
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
  return vm.runInContext("({ regions: ANATOMY_REGIONS, muscles: MUSCLE_BY_ID })", ctx);
}
const atlas = atlasTables();

/* The manifest's regions → the emitted regions. An emitted region is named
   for its ATLAS region where it has one (so the renderer's ANATOMY_REGIONS
   lookup finds it), and for the asset's own id where ATLAS has none; asset
   regions that map to the same ATLAS region are merged. */
const seen = new Set(), emitted = [], toEmitted = new Map();
for (const r of manifest.regions) {
  if (seen.has(r.id)) fail("region " + r.id + " is listed twice in the manifest");
  seen.add(r.id);
  if (!STRUCTURES.has(r.structure)) fail("region " + r.id + ": unknown structure " + r.structure);
  if (r.side !== undefined && !SIDES.has(r.side)) fail("region " + r.id + ": unknown side " + r.side);
  if (r.atlasRegion !== null && !(r.atlasRegion in atlas.regions))
    fail("region " + r.id + " maps to ATLAS region " + r.atlasRegion + ", which js/anatomy-regions.js does not list");
  const name = r.atlasRegion ?? r.id;
  let e = emitted.find(x => x.name === name);
  if (!e) emitted.push(e = { name, kind: r.atlasRegion !== null ? "muscle" : "form",
                             structure: r.structure, sources: [] });
  e.sources.push(r.id);
  toEmitted.set(r.id, emitted.indexOf(e));
}

/* ------------------------------------------------------------ the asset */

const glbBytes = fs.readFileSync(glbPath);
const sha256 = crypto.createHash("sha256").update(glbBytes).digest("hex");
const glb = readGlb(glbBytes);
const { json } = glb;
const toCm = manifest.units.toCm;
const matrices = worldMatrices(json);

const P = [], Nrm = [], R = [], S = [], idx = [], morphNames = [], morphs = [];
const sourceIndex = new Map(manifest.regions.map((r, i) => [r.id, i]));   // per vertex: its manifest region
const regionTris = new Array(emitted.length).fill(0), present = new Set();
(json.nodes || []).forEach((node, ni) => {
  if (node.mesh === undefined) return;
  const mesh = json.meshes[node.mesh], m = matrices[ni];
  const names = (mesh.extras && mesh.extras.targetNames) || [];
  for (const prim of mesh.primitives) {
    if ((prim.mode ?? 4) !== 4) fail("mesh " + mesh.name + ": only triangles are supported");
    const mat = prim.material !== undefined ? json.materials[prim.material].name : null;
    if (!mat || !toEmitted.has(mat)) fail("mesh " + mesh.name + " has faces in region " + JSON.stringify(mat) +
                                          ", which the manifest does not list");
    present.add(mat);
    const region = toEmitted.get(mat), src = sourceIndex.get(mat);
    const pos = readAccessor(glb, prim.attributes.POSITION);
    const nrm = prim.attributes.NORMAL !== undefined ? readAccessor(glb, prim.attributes.NORMAL) : fail("no normals");
    const base = P.length / 3, count = pos.length / 3;
    for (let i = 0; i < count; i++) {
      const p = transform(m, pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], 1);
      P.push(p[0] * toCm, p[1] * toCm, p[2] * toCm);
      const n = transform(m, nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2], 0), l = Math.hypot(...n) || 1;
      Nrm.push(n[0] / l, n[1] / l, n[2] / l);
      R.push(region);
      S.push(src);
    }
    const ind = prim.indices !== undefined ? readAccessor(glb, prim.indices) : Uint32Array.from({ length: count }, (_, i) => i);
    for (const v of ind) idx.push(base + v);
    regionTris[region] += ind.length / 3;
    const targets = prim.targets || [];
    targets.forEach((t, k) => {
      const name = names[k] || "morph" + k;
      if (!name.startsWith("state:")) fail("morph target " + name + " is not named state:<id>");
      let j = morphNames.indexOf(name);
      if (j < 0) { j = morphNames.push(name) - 1; morphs.push([]); }
      if (t.POSITION === undefined) fail("state " + name + " has no positions");
      const d = readAccessor(glb, t.POSITION);
      if (d.length !== pos.length) fail("state " + name + " does not match its primitive's vertices");
      for (let i = 0; i < count; i++) {
        const v = transform(m, d[i * 3], d[i * 3 + 1], d[i * 3 + 2], 0);
        morphs[j][(base + i) * 3] = v[0] * toCm; morphs[j][(base + i) * 3 + 1] = v[1] * toCm;
        morphs[j][(base + i) * 3 + 2] = v[2] * toCm;
      }
    });
    if (morphNames.length && targets.length !== morphNames.length)
      fail("mesh " + mesh.name + ": every region must carry every state");
  }
});
for (const r of manifest.regions) if (!present.has(r.id)) fail("the asset has no faces in region " + r.id);
emitted.forEach((e, i) => {
  if (regionTris[i] < manifest.minTriangles)
    fail("region " + e.name + " has only " + regionTris[i] + " triangles (the minimum is " + manifest.minTriangles + ")");
});
for (const n of manifest.states || []) if (!morphNames.includes(n.id)) fail("the asset lacks state " + n.id);
log("read " + path.relative(ROOT, glbPath) + ": " + P.length / 3 + " vertices, " + idx.length / 3 +
    " triangles, " + emitted.length + " regions, " + morphNames.length + " states");

/* The landmarks: nodes named landmark:<id>, matching the manifest. */
const authoredMarks = new Map();
(json.nodes || []).forEach((node, ni) => {
  if (!node.name || !node.name.startsWith("landmark:")) return;
  const id = node.name.slice("landmark:".length);
  const p = transform(matrices[ni], 0, 0, 0, 1).map(v => v * toCm);
  authoredMarks.set(id, { id, p, extras: node.extras || {} });
});
for (const lm of manifest.landmarks) {
  const a = authoredMarks.get(lm.id);
  if (!a) fail("the asset has no landmark " + lm.id);
  if (a.extras.region !== lm.region || a.extras.type !== lm.type)
    fail("landmark " + lm.id + " is " + a.extras.region + "/" + a.extras.type + " in the asset but " +
         lm.region + "/" + lm.type + " in the manifest");
  if (!toEmitted.has(lm.region)) fail("landmark " + lm.id + " names unknown region " + lm.region);
}
for (const id of authoredMarks.keys())
  if (!manifest.landmarks.some(l => l.id === id)) fail("landmark " + id + " is not in the manifest");

/* ------------------------------------------------------------- simplify */

let positions = Float32Array.from(P), normals = Float32Array.from(Nrm), regions = Uint8Array.from(R);
let sources = Uint16Array.from(S);
let indices = Uint32Array.from(idx), states = morphs.map(m => Float32Array.from(m, v => v || 0));
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
if (manifest.targetTriangles && indices.length / 3 > manifest.targetTriangles) {
  // Region borders are mesh borders (their vertices are copied per region), so locking the border keeps them.
  const [simplified] = MeshoptSimplifier.simplify(indices, positions, 3, manifest.targetTriangles * 3,
                                                   manifest.simplifyError, ["LockBorder"]);
  indices = simplified;
}
const [remap, unique] = MeshoptEncoder.reorderMesh(indices, true, false);
const source = new Int32Array(unique);
remap.forEach((to, from) => { if (to !== 0xffffffff) source[to] = from; });
const pick = (arr, k) => { const o = new Float32Array(unique * k);
  for (let v = 0; v < unique; v++) for (let j = 0; j < k; j++) o[v * k + j] = arr[source[v] * k + j]; return o; };
positions = pick(positions, 3); normals = pick(normals, 3); states = states.map(s => pick(s, 3));
regions = Uint8Array.from(source, s => regions[s]);
sources = Uint16Array.from(source, s => sources[s]);
log("simplified: " + unique + " vertices, " + indices.length / 3 + " triangles");

const triCount = indices.length / 3;
const finalTris = new Array(emitted.length).fill(0);
for (let t = 0; t < triCount; t++) {
  const r = regions[indices[t * 3]];
  if (r !== regions[indices[t * 3 + 1]] || r !== regions[indices[t * 3 + 2]]) fail("a triangle spans two regions");
  finalTris[r]++;
}
emitted.forEach((e, i) => { if (finalTris[i] < manifest.minTriangles) fail("region " + e.name + " fell below the minimum"); });

/* Normals at the cuts. A cut meets the sculpture at a sharp rim, but the
   exported normals are averaged across it, which tilts the surface beside
   the rim towards the cut face and shades it as a dark fringe. On both
   sides of a cut's border, each vertex takes the normal of its own
   region's faces instead. */
{
  const cutRegions = new Set(emitted.map((e, i) => e.structure === "cut" ? i : -1).filter(i => i >= 0));
  const key = v => Math.round(positions[v * 3] * 1e3) + "," + Math.round(positions[v * 3 + 1] * 1e3) + "," +
                   Math.round(positions[v * 3 + 2] * 1e3);
  const onCut = new Set();
  for (let v = 0; v < unique; v++) if (cutRegions.has(regions[v])) onCut.add(key(v));
  const fix = new Set();
  for (let v = 0; v < unique; v++) if (onCut.has(key(v))) fix.add(v);
  const acc = new Map([...fix].map(v => [v, [0, 0, 0]]));
  for (let t = 0; t < indices.length / 3; t++) {
    const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
    if (!fix.has(a) && !fix.has(b) && !fix.has(c)) continue;
    const u = [0, 1, 2].map(k => positions[b * 3 + k] - positions[a * 3 + k]);
    const w = [0, 1, 2].map(k => positions[c * 3 + k] - positions[a * 3 + k]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const v of [a, b, c]) if (fix.has(v)) { const s = acc.get(v); s[0] += n[0]; s[1] += n[1]; s[2] += n[2]; }
  }
  for (const [v, n] of acc) {
    const l = Math.hypot(...n) || 1;
    // Keep the exported direction's side: the faces' winding agrees with it.
    const sign = (n[0] * normals[v * 3] + n[1] * normals[v * 3 + 1] + n[2] * normals[v * 3 + 2]) < 0 ? -1 : 1;
    for (let k = 0; k < 3; k++) normals[v * 3 + k] = sign * n[k] / l;
  }
  log("normals split at the cuts: " + fix.size + " vertices");
}

/* ---------------------------------------------------------------- seams */

const vec = i => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
const edgeUse = new Map();
for (let t = 0; t < triCount; t++)
  for (let k = 0; k < 3; k++) {
    const a = indices[t * 3 + k], b = indices[t * 3 + (k + 1) % 3], key = a < b ? a + ":" + b : b + ":" + a;
    edgeUse.set(key, (edgeUse.get(key) || 0) + 1);
  }
const segments = [];
for (const [key, n] of edgeUse) if (n === 1) { const [a, b] = key.split(":").map(Number); segments.push([vec(a), vec(b)]); }
const points = Array.from({ length: unique }, (_, i) => vec(i));
const seam = seamDistances(points, segments, SEAM_CAP);
log("seams: " + segments.length + " border segments");

/* ------------------------------------------------------------ occlusion */

const occlusion = bakeOcclusion(positions, normals, indices);
log("occlusion baked (" + OCCLUSION.rays + " rays a vertex)");

/* ------------------------------------------------------------ landmarks */

function bind(id, p, region) {
  let best = null;
  for (let t = 0; t < triCount; t++) {
    const a = vec(indices[t * 3]), b = vec(indices[t * 3 + 1]), c = vec(indices[t * 3 + 2]);
    const { q, w } = closestOnTriangle(p, a, b, c);
    const d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    if (!best || d < best.d) best = { t, w, q, d };
  }
  const got = regions[indices[best.t * 3]];
  if (got !== toEmitted.get(region))
    fail("landmark " + id + " lies on " + emitted[got].name + ", not on its region " + region);
  if (best.d > manifest.landmarkTolerance)
    fail("landmark " + id + " is " + best.d.toFixed(3) + " cm off the surface");
  const r3 = v => Math.round(v * 1e4) / 1e4;
  return { id, region: emitted[toEmitted.get(region)].name, structure: region, triangle: best.t,
           barycentric: best.w.map(r3), position: best.q.map(r3), offset: r3(best.d) };
}
const landmarks = [];
for (const lm of manifest.landmarks) {
  const p = authoredMarks.get(lm.id).p;
  if (lm.bilateral) {
    landmarks.push({ ...bind(lm.id + ".l", p, lm.region), type: lm.type });
    landmarks.push({ ...bind(lm.id + ".r", [-p[0], p[1], p[2]], lm.region), type: lm.type });
  } else {
    landmarks.push({ ...bind(lm.id, p, lm.region), type: lm.type });
  }
}
log("landmarks: " + landmarks.length + " bound to the surface");

/* ------------------------------------------------------- region anchors */

function anchorOf(tris) {
  let area = 0; const c = [0, 0, 0], cov = [0, 0, 0, 0, 0, 0];
  const cents = [];
  for (const t of tris) {
    const a = vec(indices[t * 3]), b = vec(indices[t * 3 + 1]), d = vec(indices[t * 3 + 2]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const ar = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
    const m = [(a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3, (a[2] + b[2] + d[2]) / 3];
    area += ar; for (let k = 0; k < 3; k++) c[k] += m[k] * ar;
    cents.push([m, ar]);
  }
  for (let k = 0; k < 3; k++) c[k] /= area;
  for (const [m, ar] of cents) {
    const d = [m[0] - c[0], m[1] - c[1], m[2] - c[2]];
    cov[0] += d[0] * d[0] * ar; cov[1] += d[0] * d[1] * ar; cov[2] += d[0] * d[2] * ar;
    cov[3] += d[1] * d[1] * ar; cov[4] += d[1] * d[2] * ar; cov[5] += d[2] * d[2] * ar;
  }
  // Principal axis by power iteration.
  let e = [0.3, 1, 0.2];
  for (let i = 0; i < 50; i++) {
    const n = [cov[0] * e[0] + cov[1] * e[1] + cov[2] * e[2], cov[1] * e[0] + cov[3] * e[1] + cov[4] * e[2],
               cov[2] * e[0] + cov[4] * e[1] + cov[5] * e[2]];
    const l = Math.hypot(...n) || 1; e = n.map(v => v / l);
  }
  if (e[1] < 0) e = e.map(v => -v);
  const r3 = v => Math.round(v * 1000) / 1000;
  return { area: r3(area), centroid: c.map(r3), axis: e.map(r3) };
}
/* A region authored per side must lie on that side (+x is the figure's
   left): a .L painted on the right, or a swapped name, stops the build. */
for (const [i, r] of manifest.regions.entries()) {
  if (r.side !== "left" && r.side !== "right") continue;
  const tris = [];
  for (let t = 0; t < triCount; t++) if (sources[indices[t * 3]] === i) tris.push(t);
  const cx = anchorOf(tris).centroid[0];
  if ((r.side === "left") !== (cx > 0))
    fail("region " + r.id + " is authored as " + r.side + " but its centroid lies at x = " + cx + " cm");
}

/* Where each region is, per side: from the sides the manifest authors where
   it gives them, otherwise split at the midline. */
const regionAnchors = {};
emitted.forEach((e, ri) => {
  const all = [];
  for (let t = 0; t < triCount; t++) if (regions[indices[t * 3]] === ri) all.push(t);
  const sides = e.sources.map(id => manifest.regions[sourceIndex.get(id)].side);
  if (sides.every(Boolean)) {
    const bySide = { left: [], right: [], centre: [] };
    for (const t of all) {
      const side = manifest.regions[sources[indices[t * 3]]].side;
      bySide[side === "midline" ? "centre" : side].push(t);
    }
    regionAnchors[e.name] = Object.fromEntries(Object.entries(bySide).filter(([, ts]) => ts.length)
                                                 .map(([k, ts]) => [k, anchorOf(ts)]));
    return;
  }
  const onMidline = all.some(t => [0, 1, 2].some(k => Math.abs(positions[indices[t * 3 + k] * 3]) < 1e-3));
  if (onMidline) regionAnchors[e.name] = { centre: anchorOf(all) };
  else regionAnchors[e.name] = {
    left: anchorOf(all.filter(t => positions[indices[t * 3] * 3] > 0)),
    right: anchorOf(all.filter(t => positions[indices[t * 3] * 3] < 0))
  };
});

/* ----------------------------------------------------------------- pack */

const bmin = [Infinity, Infinity, Infinity], bmax = [-Infinity, -Infinity, -Infinity];
for (let v = 0; v < unique; v++)
  for (let k = 0; k < 3; k++) { bmin[k] = Math.min(bmin[k], positions[v * 3 + k]); bmax[k] = Math.max(bmax[k], positions[v * 3 + k]); }
const ext = bmax.map((m, k) => m - bmin[k]);
const vbuf = new ArrayBuffer(unique * VERTEX_BYTES), view = new DataView(vbuf);
for (let v = 0; v < unique; v++) {
  const o = v * VERTEX_BYTES;
  for (let k = 0; k < 3; k++) view.setUint16(o + k * 2, Math.round((positions[v * 3 + k] - bmin[k]) / ext[k] * 65535), true);
  const [ox, oy] = octEncode(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]);
  view.setInt16(o + 6, Math.round(ox * 32767), true);
  view.setInt16(o + 8, Math.round(oy * 32767), true);
  view.setUint8(o + 10, regions[v]);
  view.setUint8(o + 11, Math.round(Math.min(1, Math.max(0, occlusion[v])) * 255));
  view.setUint8(o + 12, Math.round(Math.min(1, seam[v] / SEAM_CAP) * 255));
}
const wide = unique > 65535;
const ibuf = wide ? Uint32Array.from(indices) : Uint16Array.from(indices);
const bytes = new Uint8Array(vbuf.byteLength + ibuf.byteLength);
bytes.set(new Uint8Array(vbuf), 0);
bytes.set(new Uint8Array(ibuf.buffer, ibuf.byteOffset, ibuf.byteLength), vbuf.byteLength);

const packedStates = morphNames.map((name, j) => {
  const d = states[j];
  let max = 0; for (const x of d) max = Math.max(max, Math.abs(x));
  const scale = max / 32767 || 1, q = new Int16Array(d.length);
  for (let i = 0; i < d.length; i++) q[i] = Math.round(d[i] / scale);
  return { name, scale, maxDisplacement: Math.round(max * 1000) / 1000,
           data: Buffer.from(q.buffer).toString("base64") };
});

const round = a => a.map(v => Math.round(v * 1000) / 1000);
const sided = manifest.regions.some(r => r.side);         // regions authored per side: name their sources
const model = {
  version: manifest.asset + "@" + manifest.version + "+" + sha256.slice(0, 12),
  source: { asset: manifest.source, glb: path.relative(ROOT, glbPath), sha256, manifest: path.relative(ROOT, manifestPath) },
  bounds: { min: round(bmin), max: round(bmax) },
  regions: emitted.map(e => e.name),
  kinds: emitted.map(e => e.kind),
  structures: emitted.map(e => e.structure),
  vertexCount: unique,
  indexCount: indices.length,
  vertexBytes: VERTEX_BYTES,
  wideIndices: wide,
  seamMax: SEAM_CAP,
  data: Buffer.from(bytes).toString("base64"),
  landmarks,
  regionAnchors,
  ...(sided ? { regionSources: Object.fromEntries(emitted.map(e => [e.name, e.sources])) } : {}),
  morphs: packedStates
};
const name = manifest.global;
const js = `/* ===========================================================================
   The ATLAS authored anatomy (${manifest.asset}) — GENERATED by
   tools/anatomy/build-authored.mjs from ${path.relative(ROOT, glbPath)}
   (sha256 ${sha256.slice(0, 16)}…). Do not edit by hand: edit
   ${manifest.source} in Blender, export it (tools/anatomy/authored/
   export_glb.py) and run \`npm run build:anatomy-authored\`.

   ${unique} vertices, ${indices.length / 3} triangles, ${emitted.length} regions. Centimetres,
   y up, +x the figure's left, +z its front.

   The same shape as ANATOMY_MODEL (js/anatomy-model.js): \`data\` is the
   vertex buffer then the index buffer (${wide ? "uint32" : "uint16"}), 14 bytes a vertex —
   position 3×uint16 over bounds, normal 2×int16 octahedral, region uint8,
   occlusion uint8, seam uint8, spare. Every triangle lies in one region.
   \`kinds\` is "muscle" for regions ANATOMY_REGIONS lists, "form" otherwise;
   \`structures\` says what each is (muscle, bone, tendon, cut). Also:
     landmarks      points bound to a triangle by barycentric weights, so
                    they follow any state
     regionAnchors  each region's area, centroid and principal axis (per
                    side where it has two)${sided ? `
     regionSources  the asset's own region ids behind each region (its
                    Blender materials: one per side, as the manifest
                    authors them; the anchors follow those sides)` : ""}
     morphs         authored states: per-vertex deltas, int16 × scale (cm)
   ========================================================================= */

const ${name} = Object.freeze(${JSON.stringify(model)});
`;
fs.writeFileSync(outPath, js);
log("wrote " + path.relative(ROOT, outPath) + " (" + (js.length / 1024).toFixed(0) + " KB; raw " +
    (bytes.length / 1024).toFixed(0) + " KB mesh + " +
    (packedStates.reduce((s, m) => s + m.data.length * 3 / 4, 0) / 1024).toFixed(0) + " KB states)");

function octEncode(x, y, z) {
  const s = Math.abs(x) + Math.abs(y) + Math.abs(z);
  let ox = x / s, oy = y / s;
  if (z < 0) {
    const tx = (1 - Math.abs(oy)) * (ox >= 0 ? 1 : -1), ty = (1 - Math.abs(ox)) * (oy >= 0 ? 1 : -1);
    ox = tx; oy = ty;
  }
  return [ox, oy];
}
