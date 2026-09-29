/* The Male_Body sculpture's authored anatomy: the regions painted on
   assets/anatomy/Male_Body.blend (tools/anatomy/authored/male_body_regions.py),
   as the manifest names them, carried through the GLB into the model the app
   draws behind index.html?anatomy=male-body. The drawing itself is checked in
   a browser. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";
import { readGlb, readAccessor, worldMatrices, transform } from "../tools/anatomy/glb.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = loadApp({ extra: ["js/anatomy-model-male-body.js"],
                      exports: ["ANATOMY_MODEL_MALE_BODY", "validateAnatomyModel"] });
const MODEL = app.ANATOMY_MODEL_MALE_BODY, REGIONS = app.ANATOMY_REGIONS;
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/anatomy/male-body.manifest.json"), "utf8"));
const authored = manifest.regions.filter(r => r.structure !== "form");
const glbBytes = fs.readFileSync(path.join(ROOT, manifest.glb));

const bytes = Buffer.from(MODEL.data, "base64");
const vertexBytes = MODEL.vertexCount * MODEL.vertexBytes;
const indices = new Uint32Array(bytes.buffer.slice(bytes.byteOffset + vertexBytes, bytes.byteOffset + bytes.length));
const regionOf = v => bytes[v * MODEL.vertexBytes + 10];
const position = v => [0, 1, 2].map(i => MODEL.bounds.min[i] +
  bytes.readUInt16LE(v * MODEL.vertexBytes + i * 2) / 65535 * (MODEL.bounds.max[i] - MODEL.bounds.min[i]));

/** Each GLB primitive's material and area-weighted centroid (cm, ATLAS axes). */
function glbRegions() {
  const glb = readGlb(glbBytes), { json } = glb, matrices = worldMatrices(json), out = [];
  (json.nodes || []).forEach((node, ni) => {
    if (node.mesh === undefined) return;
    for (const prim of json.meshes[node.mesh].primitives) {
      const pos = readAccessor(glb, prim.attributes.POSITION), ind = readAccessor(glb, prim.indices);
      const p = i => transform(matrices[ni], pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], 1).map(c => c * 100);
      let area = 0; const c = [0, 0, 0];
      for (let t = 0; t < ind.length; t += 3) {
        const a = p(ind[t]), b = p(ind[t + 1]), d = p(ind[t + 2]);
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
        const ar = Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2;
        area += ar;
        for (let k = 0; k < 3; k++) c[k] += (a[k] + b[k] + d[k]) / 3 * ar;
      }
      out.push({ material: json.materials[prim.material].name, triangles: ind.length / 3,
                 centroid: c.map(v => v / area) });
    }
  });
  return out;
}
const PRIMS = glbRegions();

describe("the manifest's authored regions", () => {
  test("name each region once, with a structure and, for a muscle, its side in its id", () => {
    const ids = manifest.regions.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of authored) {
      expect(r.structure, r.id).toBe("muscle");
      expect(["left", "right", "midline"], r.id).toContain(r.side);
      const suffix = r.id.match(/\.(L|R)$/)?.[1];
      expect(suffix === "L" ? "left" : suffix === "R" ? "right" : "midline", r.id).toBe(r.side);
    }
  });

  test("each names an ATLAS region that reaches one of the app's muscles", () => {
    for (const r of authored) {
      expect(REGIONS, r.id).toHaveProperty(r.atlasRegion);
      expect(app.MUSCLE_BY_ID.has(REGIONS[r.atlasRegion]), r.id + " → " + REGIONS[r.atlasRegion]).toBe(true);
    }
  });

  test("each side's region has its counterpart on the other side", () => {
    for (const r of authored.filter(r => r.side !== "midline")) {
      const other = r.id.replace(/\.(L|R)$/, m => m === ".L" ? ".R" : ".L");
      const twin = manifest.regions.find(x => x.id === other);
      expect(twin, r.id).toBeDefined();
      expect(twin.atlasRegion, r.id).toBe(r.atlasRegion);
    }
  });

  test("everything not authored is one unselectable body", () => {
    const forms = manifest.regions.filter(r => r.structure === "form");
    expect(forms.map(r => r.id)).toEqual(["body"]);
    expect(forms[0].atlasRegion).toBe(null);
  });
});

describe("the exported sculpture", () => {
  test("carries exactly the manifest's regions, as its materials", () => {
    expect(PRIMS.map(p => p.material).sort()).toEqual(manifest.regions.map(r => r.id).sort());
  });

  test("keeps each side's region on that side of the figure (+x is its left)", () => {
    for (const r of authored.filter(r => r.side !== "midline")) {
      const x = PRIMS.find(p => p.material === r.id).centroid[0];
      if (r.side === "left") expect(x, r.id).toBeGreaterThan(3);
      else expect(x, r.id).toBeLessThan(-3);
    }
  });

  test("the midline region straddles the midline", () => {
    for (const r of authored.filter(r => r.side === "midline"))
      expect(Math.abs(PRIMS.find(p => p.material === r.id).centroid[0]), r.id).toBeLessThan(3);
  });
});

describe("the model the app draws", () => {
  test("is built from the committed export (run npm run build:anatomy-authored after exporting)", () => {
    expect(MODEL.source.sha256).toBe(crypto.createHash("sha256").update(glbBytes).digest("hex"));
    expect(MODEL.source.manifest).toBe("assets/anatomy/male-body.manifest.json");
  });

  test("holds the manifest's regions, one per ATLAS region, each with the asset ids behind it", () => {
    const expected = [...new Set(manifest.regions.map(r => r.atlasRegion ?? r.id))];
    expect([...MODEL.regions]).toEqual(expected);
    for (const name of MODEL.regions)
      expect([...MODEL.regionSources[name]], name).toEqual(
        manifest.regions.filter(r => (r.atlasRegion ?? r.id) === name).map(r => r.id));
  });

  test("has no duplicate or conflicting region: every asset id reaches exactly one", () => {
    expect(new Set(MODEL.regions).size).toBe(MODEL.regions.length);
    const all = Object.values(MODEL.regionSources).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(manifest.regions.map(r => r.id).sort());
  });

  test("passes the app's own model check, and every muscle region can be selected", () => {
    const before = app.errors.length;
    app.validateAnatomyModel(MODEL);
    expect(app.errors.slice(before)).toEqual([]);
    MODEL.regions.forEach((name, i) => {
      if (MODEL.kinds[i] !== "muscle") return;
      expect(app.MUSCLE_BY_ID.has(REGIONS[name]), name).toBe(true);
    });
    expect(MODEL.kinds[MODEL.regions.indexOf("body")]).toBe("form");
  });

  test("every triangle lies in one region, and every region keeps enough to see and pick", () => {
    const count = new Array(MODEL.regions.length).fill(0);
    let mixed = 0;
    for (let i = 0; i < indices.length; i += 3) {
      const r = regionOf(indices[i]);
      if (r !== regionOf(indices[i + 1]) || r !== regionOf(indices[i + 2])) mixed++;
      count[r]++;
    }
    expect(mixed).toBe(0);
    MODEL.regions.forEach((name, r) => expect(count[r], name).toBeGreaterThanOrEqual(manifest.minTriangles));
  });

  test("places each region's anchors on its authored sides", () => {
    for (const r of authored) {
      const anchors = MODEL.regionAnchors[r.atlasRegion];
      if (r.side === "midline") expect(Math.abs(anchors.centre.centroid[0]), r.id).toBeLessThan(3);
      else if (r.side === "left") expect(anchors.left.centroid[0], r.id).toBeGreaterThan(3);
      else expect(anchors.right.centroid[0], r.id).toBeLessThan(-3);
    }
  });

  test("selects the muscles this pass authors, and leaves the rest to the body", () => {
    const reached = new Set(MODEL.regions.map(n => REGIONS[n]).filter(Boolean));
    expect([...reached].sort()).toEqual(["abs", "biceps", "calves", "chest", "glutes", "lats", "obliques",
                                         "quads", "shoulders", "triceps"]);
  });

  test("the quadriceps covers each thigh from the knee to the hip, not a patch above the knee", () => {
    const quads = MODEL.regions.indexOf("quadriceps-femoris");
    for (const side of ["left", "right"]) {
      expect(MODEL.regionAnchors["quadriceps-femoris"][side].area, side).toBeGreaterThan(700);   // cm²
      let low = Infinity, high = -Infinity;
      for (let v = 0; v < MODEL.vertexCount; v++) {
        if (regionOf(v) !== quads) continue;
        const [x, y] = position(v);
        if ((x > 0) !== (side === "left")) continue;
        low = Math.min(low, y); high = Math.max(high, y);
      }
      expect(low, side).toBeLessThan(62);      // down to the kneecap
      expect(high, side).toBeGreaterThan(85);  // up to the hip crease
    }
  });

  test("the hands select nothing (the borrowed map gave them to the quads)", () => {
    const body = MODEL.regions.indexOf("body");
    let hand = 0;
    for (let v = 0; v < MODEL.vertexCount; v++) {
      const [x, y] = position(v);
      if (Math.abs(x) > 24 && y > 65 && y < 88) { hand++; expect(regionOf(v)).toBe(body); }
    }
    expect(hand).toBeGreaterThan(5000);            // the hands and wrists are there to test
  });
});
