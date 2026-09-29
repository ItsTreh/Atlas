/* The authored anatomy prototype (the torso study): the model built from
   assets/anatomy/torso-study.glb, its manifest, and how it meets the app's
   region table. The drawing itself is checked in a browser (lab page). */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";
import { readGlb } from "../tools/anatomy/glb.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = loadApp({ extra: ["js/anatomy-model-authored.js"],
                      exports: ["ANATOMY_MODEL_AUTHORED", "validateAnatomyModel"] });
const MODEL = app.ANATOMY_MODEL_AUTHORED, REGIONS = app.ANATOMY_REGIONS;
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/anatomy/torso-study.manifest.json"), "utf8"));

const bytes = Buffer.from(MODEL.data, "base64");
const vertexBytes = MODEL.vertexCount * MODEL.vertexBytes;
const indices = MODEL.wideIndices
  ? new Uint32Array(bytes.buffer.slice(bytes.byteOffset + vertexBytes, bytes.byteOffset + bytes.length))
  : new Uint16Array(bytes.buffer.slice(bytes.byteOffset + vertexBytes, bytes.byteOffset + bytes.length));
const regionOf = v => bytes[v * MODEL.vertexBytes + 10];
const position = v => [0, 1, 2].map(i => MODEL.bounds.min[i] +
  bytes.readUInt16LE(v * MODEL.vertexBytes + i * 2) / 65535 * (MODEL.bounds.max[i] - MODEL.bounds.min[i]));

describe("regions → ATLAS muscles", () => {
  test("every manifest region is known to ATLAS or declared its own", () => {
    for (const r of manifest.regions) {
      expect(["muscle", "bone", "tendon", "cut"], r.id).toContain(r.structure);
      if (r.atlasRegion !== null) expect(REGIONS, r.id).toHaveProperty(r.atlasRegion);
    }
  });

  test("the model holds exactly the manifest's regions", () => {
    const expected = [...new Set(manifest.regions.map(r => r.atlasRegion ?? r.id))];
    expect([...MODEL.regions].sort()).toEqual(expected.sort());
  });

  test("every muscle region reaches an ATLAS muscle id, or is declared not selectable", () => {
    MODEL.regions.forEach((name, i) => {
      if (MODEL.kinds[i] !== "muscle") return;
      expect(REGIONS, name).toHaveProperty(name);
      const id = REGIONS[name];
      if (id !== null) expect(app.MUSCLE_BY_ID.has(id), name + " → " + id).toBe(true);
    });
  });

  test("the prototype selects the torso and arm muscles it shows", () => {
    const reached = new Set(MODEL.regions.map(n => REGIONS[n]).filter(Boolean));
    for (const id of ["chest", "shoulders", "triceps", "traps", "upper-back", "lats", "biceps", "forearms",
                      "abs", "obliques", "lower-back"])
      expect(reached.has(id), id).toBe(true);
  });

  test("bone, tendon and the cuts are never selectable", () => {
    MODEL.regions.forEach((name, i) => {
      if (MODEL.kinds[i] === "form") expect(REGIONS[name] ?? null, name).toBe(null);
    });
  });

  test("passes the app's own model check", () => {
    const before = app.errors.length;
    app.validateAnatomyModel(MODEL);
    expect(app.errors.slice(before)).toEqual([]);
    expect(app.errors).toEqual([]);
  });
});

describe("the mesh", () => {
  test("holds exactly the vertices and triangles it declares", () => {
    expect(bytes.length).toBe(vertexBytes + MODEL.indexCount * (MODEL.wideIndices ? 4 : 2));
    expect(MODEL.indexCount % 3).toBe(0);
    for (let i = 0; i < indices.length; i++) expect(indices[i]).toBeLessThan(MODEL.vertexCount);
  });

  test("every triangle lies in one region", () => {
    let mixed = 0;
    for (let i = 0; i < indices.length; i += 3)
      if (regionOf(indices[i]) !== regionOf(indices[i + 1]) || regionOf(indices[i + 1]) !== regionOf(indices[i + 2])) mixed++;
    expect(mixed).toBe(0);
  });

  test("every region keeps enough triangles to see and to pick", () => {
    const count = new Array(MODEL.regions.length).fill(0);
    for (let i = 0; i < indices.length; i += 3) count[regionOf(indices[i])]++;
    MODEL.regions.forEach((name, r) => expect(count[r], name).toBeGreaterThanOrEqual(manifest.minTriangles));
  });

  test("stays inside its budget", () => {
    expect(MODEL.indexCount / 3).toBeLessThanOrEqual(45000);
    expect(bytes.length).toBeLessThan(1024 * 1024);
    const stateBytes = MODEL.morphs.reduce((s, m) => s + Buffer.from(m.data, "base64").length, 0);
    expect(stateBytes).toBeLessThan(200 * 1024);
    expect(fs.statSync(path.join(ROOT, "js/anatomy-model-authored.js")).size).toBeLessThan(1024 * 1024);
  });

  test("is built from the committed asset (run npm run build:anatomy-authored after exporting it)", () => {
    const glb = fs.readFileSync(path.join(ROOT, manifest.glb));
    expect(crypto.createHash("sha256").update(glb).digest("hex")).toBe(MODEL.source.sha256);
    const materials = new Set(readGlb(glb).json.materials.map(m => m.name));
    expect([...materials].sort()).toEqual(manifest.regions.map(r => r.id).sort());
  });
});

describe("landmarks", () => {
  const landmark = lm => {
    const t = lm.triangle, w = lm.barycentric;
    const [a, b, c] = [indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]].map(position);
    return [0, 1, 2].map(k => a[k] * w[0] + b[k] * w[1] + c[k] * w[2]);
  };

  test("every manifest landmark is bound, both sides where it is bilateral", () => {
    const ids = MODEL.landmarks.map(l => l.id).sort();
    const expected = manifest.landmarks.flatMap(l => l.bilateral ? [l.id + ".l", l.id + ".r"] : [l.id]).sort();
    expect(ids).toEqual(expected);
  });

  test("lie on the surface, on their own region, within tolerance", () => {
    for (const lm of MODEL.landmarks) {
      expect(lm.offset, lm.id).toBeLessThanOrEqual(manifest.landmarkTolerance);
      const p = landmark(lm);
      for (let k = 0; k < 3; k++) expect(Math.abs(p[k] - lm.position[k]), lm.id).toBeLessThan(0.02);
      expect(MODEL.regions[regionOf(indices[lm.triangle * 3])], lm.id).toBe(lm.region);
    }
  });

  test("mirror across the midline", () => {
    const byId = new Map(MODEL.landmarks.map(l => [l.id, l]));
    for (const l of manifest.landmarks.filter(l => l.bilateral)) {
      const a = byId.get(l.id + ".l").position, b = byId.get(l.id + ".r").position;
      expect(Math.abs(a[0] + b[0]), l.id).toBeLessThan(0.05);
      expect(Math.abs(a[1] - b[1]), l.id).toBeLessThan(0.05);
    }
  });
});

describe("authored states", () => {
  const state = name => {
    const m = MODEL.morphs.find(s => s.name === name);
    const q = new Int16Array(Uint8Array.from(Buffer.from(m.data, "base64")).buffer);
    return { m, delta: v => [q[v * 3] * m.scale, q[v * 3 + 1] * m.scale, q[v * 3 + 2] * m.scale] };
  };

  test("share the base topology: one delta per vertex, nothing else changes", () => {
    for (const s of manifest.states) {
      const m = MODEL.morphs.find(x => x.name === s.id);
      expect(m, s.id).toBeTruthy();
      expect(Buffer.from(m.data, "base64").length).toBe(MODEL.vertexCount * 3 * 2);
    }
  });

  test("the arm-raised state lifts the arms and leaves the midline where it is", () => {
    const { delta } = state("state:arm-raised");
    let moved = 0, midlineMoved = 0;
    for (let v = 0; v < MODEL.vertexCount; v++) {
      const d = Math.hypot(...delta(v));
      if (d > 0.5) moved++;
      if (Math.abs(position(v)[0]) < 0.05 && d > 0.01) midlineMoved++;
    }
    expect(moved).toBeGreaterThan(MODEL.vertexCount * 0.2);
    expect(midlineMoved).toBe(0);
  });

  test("landmarks follow the state; the sternum stays", () => {
    const { delta } = state("state:arm-raised");
    const moved = lm => {
      const t = lm.triangle, w = lm.barycentric;
      const d = [0, 1, 2].map(k => w.reduce((s, wi, j) => s + wi * delta(indices[t * 3 + j])[k], 0));
      return Math.hypot(...d);
    };
    const byId = new Map(MODEL.landmarks.map(l => [l.id, l]));
    expect(moved(byId.get("deltoid-insertion.l"))).toBeGreaterThan(2);
    expect(moved(byId.get("deltoid-insertion.r"))).toBeGreaterThan(2);
    expect(moved(byId.get("jugular-notch"))).toBeLessThan(0.01);
  });
});
