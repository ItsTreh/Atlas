import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp({ extra: ["js/anatomy-sculpture.js"],
  exports: ["buildAnatomyCartography", "AnatomySculpture", "SCULPTURE_FRAGMENT"] });

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
    // Each face is its own region here, so regions count the samples per face.
    const regions = Array.from({ length: samples.count }, (_, i) => samples.data[i * samples.stride + 9]);
    expect(regions.filter(t => t === 0)).toHaveLength(200);
    expect(regions.filter(t => t === 1)).toHaveLength(800);
    for (let i = 0; i < samples.count; i++) {
      const t = regions[i], offset = i * samples.stride;
      // Every sample stays on its own face.
      const x = samples.data[offset + 3] - (t ? 10 : 0), y = samples.data[offset + 4];
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x / (t ? 4 : 2) + y / (t ? 2 : 1)).toBeLessThanOrEqual(1.00001);
      expect(samples.data[offset + 5]).toBe(0);
      expect(samples.data[offset + 8]).toBeCloseTo(1, 6); // +z normal, Float32
    }
  });

  test("keeps every sample where the flow frames were tuned on", () => {
    // Points from the sampler before its particle data was retired. The flow
    // frames and guides, and so every curve, are built from these samples.
    // A failure after an optimization means the random sequence changed:
    // buildAnatomyCartography must keep its two unused draws per sample.
    const { model, bytes } = surface();
    const samples = app.buildAnatomyCartography(model, bytes, 5);
    [[1.27067089, 0.31433415, 0], [12.60820198, 0.06618421, 1], [12.64871311, 0.03236435, 1],
     [10.99518394, 0.42332235, 1], [11.71873856, 0.5616563, 1]].forEach(([x, y, region], i) => {
      const offset = i * samples.stride;
      expect(samples.data[offset + 3]).toBeCloseTo(x, 5);
      expect(samples.data[offset + 4]).toBeCloseTo(y, 5);
      expect(samples.data[offset + 9]).toBe(region);
    });
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
    expect(samples.count).toBe(100);
    for (let i = 0; i < samples.count; i++) {
      // All on the second face: the first now mixes regions 2 and 0.
      expect(samples.data[i * samples.stride + 9]).toBe(1);
      expect(samples.data[i * samples.stride + 3]).toBeGreaterThanOrEqual(10);
    }
  });

  test("marker depth uses the source face's plane on a sloped surface", () => {
    const { model, bytes } = surface();
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < 6; i++) view.setUint16(i * 14 + 4, view.getUint16(i * 14, true), true);
    const samples = app.buildAnatomyCartography(model, bytes, 60);
    for (let i = 0; i < samples.count; i++) {
      const offset = i * samples.stride;
      expect(samples.data[offset + 6]).toBeCloseTo(-Math.SQRT1_2, 6);
      expect(samples.data[offset + 7]).toBe(0);
      expect(samples.data[offset + 8]).toBeCloseTo(Math.SQRT1_2, 6);
      expect(samples.data[offset + 3]).toBeCloseTo(samples.data[offset + 5], 6);
    }
  });

  test("handles empty geometry and bounds its rendering budget", () => {
    const { model, bytes } = surface();
    expect(app.buildAnatomyCartography(model, bytes, 50000).count).toBe(24000);
    expect(app.buildAnatomyCartography(model, bytes, 0).count).toBe(0);
    bytes.fill(0);
    expect(app.buildAnatomyCartography(model, bytes).count).toBe(0);
  });
});

describe("surface shader", () => {
  test("stops early only where the line field provably adds nothing, branching per triangle", () => {
    const fs = app.SCULPTURE_FRAGMENT;
    const flat = new Set([...fs.matchAll(/^flat in \w+ (\w+);/gm)].map(m => m[1]));
    const uniforms = new Set([...fs.matchAll(/^uniform \w+ ([^;]+);/gm)]
      .flatMap(m => m[1].split(",").map(name => name.trim().replace(/\[.*\]$/, ""))));
    const exits = [...fs.matchAll(/if \((.+)\) \{\s*outColor = [^;]+;\s*return;/g)].map(m => m[1]);
    expect(exits).toHaveLength(1);
    // Derivatives (dFdx, dFdy, fwidth) after the exit are defined only if
    // each derivative quad branches alike. Flat inputs and uniforms are
    // constant across a triangle, and its quads never mix triangles, so a
    // condition on them alone is uniform there. Locals, gl_FragCoord or
    // smooth inputs could vary within a quad.
    const allowed = new Set(["vec2", "vec3", "vec4", "x", "y", "z", "w"]);
    for (const name of exits[0].match(/[A-Za-z_]\w*/g))
      expect(flat.has(name) || uniforms.has(name) || allowed.has(name), name + " must be flat or uniform").toBe(true);
    // Selected, pointed at and lit (vMapState) and keyboard focus (vFocus)
    // weight the traces, border and focus edge: all must be exactly zero.
    expect(exits[0]).toMatch(/vMapState == vec3\(0\.0\)/);
    expect(exits[0]).toMatch(/vFocus == 0\.0/);
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
