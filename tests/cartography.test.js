import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp({ extra: ["js/anatomy-sculpture.js"],
  exports: ["buildAnatomyCartography", "AnatomySculpture"] });

// Two planar surfaces, area 1 and 4, with different anatomical region ids.
function surface(wideIndices = false) {
  const vertices = [[0, 0], [2, 0], [0, 1], [10, 0], [14, 0], [10, 2]];
  const bytes = new Uint8Array(6 * 14 + 6 * (wideIndices ? 4 : 2));
  const view = new DataView(bytes.buffer);
  vertices.forEach(([x, y], i) => {
    view.setUint16(i * 14, x, true);
    view.setUint16(i * 14 + 2, y, true);
    view.setUint8(i * 14 + 10, i < 3 ? 0 : 1);
    if (wideIndices) view.setUint32(84 + i * 4, i, true);
    else view.setUint16(84 + i * 2, i, true);
  });
  return { bytes, model: { vertexCount: 6, indexCount: 6, vertexBytes: 14, wideIndices,
    bounds: { min: [0, 0, 0], max: [65535, 65535, 65535] } } };
}

describe("anatomical surface sampling", () => {
  test.each([false, true])("samples by area with wide indices = %s", wide => {
    const { model, bytes } = surface(wide);
    const samples = app.buildAnatomyCartography(model, bytes, 1000);
    expect(samples.count).toBe(1000);
    expect([...samples.triangles].filter(t => t === 0)).toHaveLength(200);
    expect([...samples.triangles].filter(t => t === 1)).toHaveLength(800);
    for (let i = 0; i < samples.count; i++) {
      const t = samples.triangles[i], offset = i * samples.stride;
      expect(samples.data[offset + 9]).toBe(t);
      // Both endpoints and their interpolation stay on the original face.
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        const xyz = [0, 1, 2].map(k => samples.data[offset + k] * (1 - progress) +
          samples.data[offset + 3 + k] * progress);
        const x = xyz[0] - (t ? 10 : 0), y = xyz[1];
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x / (t ? 4 : 2) + y / (t ? 2 : 1)).toBeLessThanOrEqual(1.00001);
        expect(xyz[2]).toBe(0);
      }
      expect(samples.data[offset + 8]).toBeCloseTo(1, 6); // +z normal, Float32
    }
  });

  test("is reproducible across redraws and context restoration", () => {
    const { model, bytes } = surface();
    expect(app.buildAnatomyCartography(model, bytes, 100).data)
      .toEqual(app.buildAnatomyCartography(model, bytes, 100).data);
  });

  test("omits triangles crossing anatomical regions", () => {
    const { model, bytes } = surface();
    bytes[10] = 2;
    const samples = app.buildAnatomyCartography(model, bytes, 100);
    expect([...samples.triangles].every(t => t === 1)).toBe(true);
    expect(samples.count).toBe(100);
  });

  test("handles empty geometry and bounds its rendering budget", () => {
    const { model, bytes } = surface();
    expect(app.buildAnatomyCartography(model, bytes, 50000).count).toBe(24000);
    expect(app.buildAnatomyCartography(model, bytes, 0).count).toBe(0);
    bytes.fill(0);
    expect(app.buildAnatomyCartography(model, bytes).count).toBe(0);
  });
});

describe("cartography interaction boundaries", () => {
  const renderer = app.AnatomySculpture.prototype;

  test("a touch on known nonselectable surface cannot borrow a nearby muscle", () => {
    const body = { regionAt: () => 0, muscleAt: () => "chest" };
    expect(renderer.muscleNear.call(body, 10, 10)).toBe(null);
    const background = { ...body, regionAt: () => -1 };
    expect(renderer.muscleNear.call(background, 10, 10)).toBe("chest");
  });

  test("animations settle and stop requesting frames", () => {
    const r = { targets: () => new Float32Array([0, 1, 0]),
      shown: new Float32Array(3), reducedMotion: { matches: false },
      interactive: true, calm: () => true, pointer: [40, 80],
      regionAt: () => 0, mapPresence: 0, mapPointer: [0, 0] };
    let frames = 0;
    while (renderer.ease.call(r, 16) && frames < 200) frames++;
    expect(frames).toBeGreaterThan(0);
    expect(frames).toBeLessThan(200);
    expect(r.mapPresence).toBe(1);
    expect(r.mapPointer).toEqual([40, 80]);
    r.pointer = null;
    for (let i = 0; i < 100; i++) renderer.ease.call(r, 16);
    expect(r.mapPresence).toBe(0);
    expect(renderer.ease.call(r, 16)).toBe(false);
  });

  test("reduced motion resolves immediately", () => {
    const r = { targets: () => new Float32Array([1, 0, 0]),
      shown: new Float32Array(3), reducedMotion: { matches: true },
      interactive: true, calm: () => true, focused: { id: "chest" },
      pointer: [40, 80], regionAt: () => 0, mapPresence: 0, mapPointer: [0, 0] };
    expect(renderer.ease.call(r, 16)).toBe(false);
    expect(r.mapPresence).toBe(1);
    expect([...r.shown]).toEqual([1, 0, 0]);
  });
});
