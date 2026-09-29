/* The anatomy sculpture's data: the model, and the table that ties its
   regions to the app's muscles. The drawing itself is checked in a browser. */
import fs from "node:fs";
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";
import { sculpture } from "../tools/anatomy/sculpture.mjs";

const app = loadApp();
const MODEL = app.ANATOMY_MODEL, REGIONS = app.ANATOMY_REGIONS;
const AUTHORED_MANIFESTS = ["torso-study", "male-body"].map(name =>
  JSON.parse(fs.readFileSync(new URL("../assets/anatomy/" + name + ".manifest.json", import.meta.url), "utf8")));

describe("regions → muscles", () => {
  test("every region points at a muscle that exists, or at nothing", () => {
    for (const id of Object.values(REGIONS))
      if (id !== null) expect(app.MUSCLE_BY_ID.has(id)).toBe(true);
  });

  test("every muscle can be selected on the sculpture", () => {
    for (const m of app.MUSCLES)
      expect(MODEL.regions.some(r => REGIONS[r] === m.id), m.id).toBe(true);
  });

  test("the table names every muscle region of the model, and nothing no model draws", () => {
    const muscleRegions = MODEL.regions.filter((r, i) => MODEL.kinds[i] === "muscle");
    for (const r of muscleRegions) expect(REGIONS, r).toHaveProperty(r);
    // A region the procedural figure lacks must be drawn by an authored model (a group region).
    const authored = new Set(AUTHORED_MANIFESTS.flatMap(m => m.regions.map(r => r.atlasRegion)).filter(Boolean));
    for (const r of Object.keys(REGIONS))
      expect(muscleRegions.includes(r) || authored.has(r), r + " is drawn by no model").toBe(true);
  });

  test("the form (armature, bone, tendon, hands, feet) is never selectable", () => {
    expect(MODEL.kinds[MODEL.regions.indexOf("body")]).toBe("form");
    expect("body" in REGIONS).toBe(false);
  });
});

describe("the model", () => {
  const bytes = Buffer.from(MODEL.data, "base64");
  const vertexBytes = MODEL.vertexCount * MODEL.vertexBytes;
  const indices = MODEL.wideIndices
    ? new Uint32Array(bytes.buffer.slice(bytes.byteOffset + vertexBytes, bytes.byteOffset + bytes.length))
    : new Uint16Array(bytes.buffer.slice(bytes.byteOffset + vertexBytes, bytes.byteOffset + bytes.length));
  const regionOf = v => bytes[v * MODEL.vertexBytes + 10];

  test("has a finite size, and every vertex a finite position", () => {
    for (const v of [...MODEL.bounds.min, ...MODEL.bounds.max]) expect(Number.isFinite(v)).toBe(true);
    for (let i = 0; i < 3; i++) expect(MODEL.bounds.max[i]).toBeGreaterThan(MODEL.bounds.min[i]);
  });

  test("holds exactly the vertices and triangles it declares", () => {
    expect(bytes.length).toBe(vertexBytes + MODEL.indexCount * (MODEL.wideIndices ? 4 : 2));
    expect(MODEL.indexCount % 3).toBe(0);
  });

  test("every index is a vertex, and every triangle lies in one region", () => {
    let bad = 0, mixed = 0;
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]];
      if (a >= MODEL.vertexCount || b >= MODEL.vertexCount || c >= MODEL.vertexCount) bad++;
      else if (regionOf(a) !== regionOf(b) || regionOf(b) !== regionOf(c)) mixed++;
    }
    expect(bad).toBe(0);
    expect(mixed).toBe(0);
  });

  test("no muscle is buried under its neighbours", () => {
    // Muscles overlap to make the body's surface; one that ends up under
    // the others has (almost) no surface left, and nothing to click.
    const triangles = new Array(MODEL.regions.length).fill(0);
    for (let i = 0; i < indices.length; i += 3) triangles[regionOf(indices[i])]++;
    MODEL.regions.forEach((region, r) => expect(triangles[r], region).toBeGreaterThanOrEqual(60));
  });

  test("every vertex names a region the model has", () => {
    for (let v = 0; v < MODEL.vertexCount; v++)
      expect(regionOf(v)).toBeLessThan(MODEL.regions.length);
  });

  test("stays light enough to draw smoothly", () => {
    expect(MODEL.indexCount / 3).toBeLessThanOrEqual(60000);
    expect(bytes.length).toBeLessThan(1024 * 1024);
  });

  test("is built from the current sculpture (run `npm run build:anatomy` after editing it)", () => {
    const source = sculpture();
    expect([...MODEL.regions]).toEqual(source.map(r => r.name));
    expect([...MODEL.kinds]).toEqual(source.map(r => r.kind));
  });
});
