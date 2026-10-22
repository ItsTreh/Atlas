/* Region ids past 255: a vertex keeps its region in two bytes (offset 10
   the low one, 13 the high one) and the pick buffer in two channels (red,
   green), so a finer zoom's sub-regions are not capped at 254. */
import fs from "node:fs";
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp({ extra: ["js/anatomy-sculpture.js", "js/anatomy-model-male-body.js"],
  exports: ["pickedRegion", "SCULPTURE_REGION_LIMIT", "ANATOMY_MODEL_MALE_BODY", "buildAnatomyCartography"] });

/* What SCULPTURE_PICK writes for a region, as bytes once read back. */
const picked = id => [(id + 1) % 256, Math.floor((id + 1) / 256), 0, 255];

describe("region ids in the pick buffer", () => {
  test("every id up to the limit reads back as itself, and empty reads as none", () => {
    for (const id of [0, 1, 253, 254, 255, 256, 300, 1000, 4095, app.SCULPTURE_REGION_LIMIT - 1])
      expect(app.pickedRegion(Uint8Array.from(picked(id)), 0)).toBe(id);
    expect(app.pickedRegion(new Uint8Array(4), 0)).toBe(-1);
  });

  test("the pick shader writes the id the way pickedRegion reads it", () => {
    const source = fs.readFileSync(new URL("../js/anatomy-sculpture.js", import.meta.url), "utf8");
    const pick = source.slice(source.indexOf("const SCULPTURE_PICK"));
    expect(pick).toContain("mod(id, 256.0) / 255.0, floor(id / 256.0) / 255.0");
    expect(source).toContain("int(aAttr.x + aAttr.w * 256.0 + 0.5)");
  });
});

describe("region ids in a model's vertices", () => {
  test("Male_Body's two bytes name a region it has (the high one is 0 below 256)", () => {
    const m = app.ANATOMY_MODEL_MALE_BODY, bytes = Buffer.from(m.data, "base64");
    for (let v = 0; v < m.vertexCount; v += 97) {
      const o = v * m.vertexBytes;
      expect(bytes[o + 10] + bytes[o + 13] * 256).toBeLessThan(m.regions.length);
    }
  });

  test("the cartography reads a vertex's high byte too", () => {
    // Three triangles, the last in region 300: its samples must say 300.
    const vertexBytes = 14, vertexCount = 9;
    const bytes = new Uint8Array(vertexCount * vertexBytes + 9 * 2);
    const view = new DataView(bytes.buffer);
    for (let v = 0; v < vertexCount; v++) {
      const o = v * vertexBytes, region = v < 6 ? 0 : 300;
      view.setUint16(o, (v % 3) * 20000, true); view.setUint16(o + 2, Math.floor(v / 3) * 20000 + (v % 2) * 9000, true);
      view.setInt16(o + 8, 32767, true);
      view.setUint8(o + 10, region & 255); view.setUint8(o + 13, region >> 8);
    }
    for (let i = 0; i < 9; i++) view.setUint16(vertexCount * vertexBytes + i * 2, i, true);
    const model = { vertexBytes, vertexCount, indexCount: 9, wideIndices: false,
      bounds: { min: [0, 0, 0], max: [10, 10, 10] }, regions: Array.from({ length: 301 }, (_, i) => "r" + i) };
    const s = app.buildAnatomyCartography(model, bytes, 300);
    const regions = new Set(Array.from({ length: s.count }, (_, i) => s.data[i * s.stride + 9]));
    expect(regions.has(300)).toBe(true);
  });
});
