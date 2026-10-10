/* The Male_Body sculpture's anatomy: the regions painted on
   assets/anatomy/Male_Body.blend (tools/anatomy/authored/male_body_regions.py),
   and, for the muscles not authored yet, regions borrowed from the procedural
   figure at export (tools/anatomy/authored/male_body.py), as the manifest names them, carried through the GLB into the model the app
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
const authored = manifest.regions.filter(r => r.structure !== "form");     // muscles, painted or borrowed
const borrowed = authored.filter(r => r.source === "borrowed");
const painted = authored.filter(r => r.source !== "borrowed");
// Muscles painted on the sculpture but deliberately not selectable yet: they
// map to no app muscle until a zoomed anatomy view shows them on their own
// (docs/anatomy-levels.md). Only these may map to nothing.
const HIDDEN = new Set(["serratus-anterior", "iliopsoas"]);
// Muscles painted on one side only, because the other side's is out of sight
// on the sculpture (the right coracobrachialis is hidden in its armpit).
const ONE_SIDED = new Map([["coracobrachialis", "left"]]);
// How far off the midline (cm) a side's region must lie: the adductor longus
// and the gracilis, on the inner thigh where the thighs nearly
// meet (about 1 cm left of x = 0, so the right adductor longus centres near
// x = -1 and the gracilis, the innermost, at x = -2 and +1), and any borrowed
// region may hug it.
// So may the rhomboids: the sculpture's spine runs about 4 cm right of x = 0 at
// shoulder-blade height, so the left one, ~5 cm from the spine like the right,
// lies only ~1 cm left of x = 0.
const ZERO_MARGIN = new Set(["adductor-longus", "gracilis", "rhomboid-major"]);
const margin = r => r.source === "borrowed" || ZERO_MARGIN.has(r.atlasRegion) ? 0 : 3;
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
      if (HIDDEN.has(r.atlasRegion)) expect(REGIONS[r.atlasRegion], r.id).toBe(null);
      else expect(app.MUSCLE_BY_ID.has(REGIONS[r.atlasRegion]), r.id + " → " + REGIONS[r.atlasRegion]).toBe(true);
    }
  });

  test("each side's painted region has its counterpart on the other side", () => {
    for (const r of painted.filter(r => r.side !== "midline" && !ONE_SIDED.has(r.atlasRegion))) {
      const other = r.id.replace(/\.(L|R)$/, m => m === ".L" ? ".R" : ".L");
      const twin = manifest.regions.find(x => x.id === other);
      expect(twin, r.id).toBeDefined();
      expect(twin.atlasRegion, r.id).toBe(r.atlasRegion);
    }
  });

  test("a borrowed region stands in only for an anatomical region nobody painted", () => {
    // Per ATLAS region, not per app muscle: a group such as the forearm is painted one muscle at
    // a time, its other muscles borrowed until their turn.
    const paintedRegions = new Set(painted.map(r => r.atlasRegion));
    for (const r of borrowed) expect(paintedRegions.has(r.atlasRegion), r.id).toBe(false);
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
      if (r.side === "left") expect(x, r.id).toBeGreaterThan(margin(r));
      else expect(x, r.id).toBeLessThan(-margin(r));
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
      if (HIDDEN.has(name)) expect(REGIONS[name], name).toBe(null);
      else expect(app.MUSCLE_BY_ID.has(REGIONS[name]), name).toBe(true);
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
      else if (r.side === "left") expect(anchors.left.centroid[0], r.id).toBeGreaterThan(margin(r));
      else expect(anchors.right.centroid[0], r.id).toBeLessThan(-margin(r));
    }
  });

  test("selects every one of the app's muscles: painted, or borrowed until it is painted", () => {
    const reached = new Set(MODEL.regions.map(n => REGIONS[n]).filter(Boolean));
    expect([...reached].sort()).toEqual(app.MUSCLES.map(m => m.id).sort());
    const byPaint = new Set(painted.filter(r => !HIDDEN.has(r.atlasRegion)).map(r => REGIONS[r.atlasRegion]));
    expect([...byPaint].sort()).toEqual(["abs", "adductors", "biceps", "calves", "chest", "forearms", "glutes",
                                         "hamstrings", "lats", "lower-back", "obliques", "quads", "shoulders", "traps", "triceps",
                                         "upper-back"]);
  });

  test("keeps the hidden muscles painted (both sides unless one is out of sight), drawn but never selectable", () => {
    for (const name of HIDDEN) {
      expect(painted.filter(r => r.atlasRegion === name).map(r => r.side).sort(), name)
        .toEqual(ONE_SIDED.has(name) ? [ONE_SIDED.get(name)] : ["left", "right"]);
      expect(MODEL.regions, name).toContain(name);
      expect(MODEL.kinds[MODEL.regions.indexOf(name)], name).toBe("muscle");
    }
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

  test("the back of each thigh is hamstrings, its inner side adductors, its front quads", () => {
    // Around each thigh in its upper and lower thirds (ATLAS cm; +x the figure's left, +z its
    // front), the outermost vertices in each direction: behind → hamstrings, inward → a muscle of
    // the adductor group (the adductor longus where the thighs meet, or the gracilis, the
    // innermost, running down to the knee), in front → quads. (At mid-thigh the
    // sartorius crosses to the inner side, and it is the quads'.)
    const ham = MODEL.regions.indexOf("hamstrings"), quad = MODEL.regions.indexOf("quadriceps-femoris"),
          inner = MODEL.regions.flatMap((r, i) => (REGIONS[r] === "adductors" ? [i] : []));
    for (const side of [1, -1]) for (const [low, high] of [[62, 68], [74, 78]]) {
      const band = [];
      for (let v = 0; v < MODEL.vertexCount; v++) {
        const p = position(v);
        if (p[1] > low && p[1] < high && p[0] * side > 0.5 && p[0] * side < 20) band.push([p, regionOf(v)]);
      }
      const cx = band.reduce((s, [p]) => s + p[0], 0) / band.length, cz = band.reduce((s, [p]) => s + p[2], 0) / band.length;
      // The commonest region among the vertices within 2 mm of the outermost: a border vertex is
      // split once per region, so the outermost is often a tie between copies of one point.
      const extreme = (dx, dz) => {
        const reach = ([p]) => (p[0] - cx) * dx + (p[2] - cz) * dz, max = Math.max(...band.map(reach));
        const count = new Map();
        for (const e of band) if (reach(e) > max - 0.2) count.set(e[1], (count.get(e[1]) || 0) + 1);
        return [...count].reduce((b, e) => (e[1] > b[1] ? e : b))[0];
      };
      expect(extreme(0, -1), "back " + side + " at " + low).toBe(ham);
      expect(inner, "inner " + side + " at " + low).toContain(extreme(-side, 0));
      expect(extreme(0, 1), "front " + side + " at " + low).toBe(quad);
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
