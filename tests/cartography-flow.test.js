import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const { buildAnatomyFlowFrames, AnatomySculpture } = loadApp({
  extra: ["js/anatomy-sculpture.js"], exports: ["buildAnatomyFlowFrames", "AnatomySculpture"] });

function samples(points) {
  const data = new Float32Array(points.length * 12);
  points.forEach((p, i) => data.set([...p, ...p, 0, 0, 1, 0, 0, 1], i * 12));
  return { count: points.length, stride: 12, data };
}

describe("surface flow frames", () => {
  test("mirrors both sides into one frame and places its origin beneath the visible patch", () => {
    const model = { regions: ["paired"], bounds: { min: [-9, 0, -5], max: [11, 30, 10] },
      regionAnchors: { paired: {
        left: { area: 10, centroid: [4, 14, 6], axis: [0, 1, 0] },
        right: { area: 10, centroid: [-2, 14, 6], axis: [0, -1, 0] }
      } } };
    const points = [];
    for (const side of [-1, 1]) for (const x of [2, 3, 4]) for (const y of [10, 14, 18]) points.push([1 + side * x, y, 6]);
    const { centers, axes } = buildAnatomyFlowFrames(model, samples(points));
    expect(centers[0]).toBeCloseTo(3, 6);
    expect(centers[1]).toBeCloseTo(14, 6);
    expect(centers[2]).toBeLessThan(6);
    expect(centers[2]).toBeGreaterThan(4);
    expect([...axes.slice(0, 3)]).toEqual([0, 1, 0]);
    expect(centers[3]).toBeGreaterThan(0);
    expect(axes[3]).toBeGreaterThan(centers[3]);
  });

  test("finds the shape's longitudinal direction without authored anchors", () => {
    const model = { regions: ["slanted"], bounds: { min: [-10, 0, -5], max: [10, 30, 10] } };
    const points = [];
    for (const along of [-4, -2, 0, 2, 4]) for (const across of [-0.5, 0, 0.5])
      points.push([5 + along * 0.4 - across * 0.8, 14 + along * 0.8 + across * 0.4, 6]);
    const { axes } = buildAnatomyFlowFrames(model, samples(points));
    expect(Math.hypot(...axes.slice(0, 3))).toBeCloseTo(1, 6);
    expect(axes[0] / Math.sqrt(5) + axes[1] * 2 / Math.sqrt(5)).toBeGreaterThan(0.999);
    expect(axes[2]).toBeCloseTo(0, 6);
  });

  test("a central region uses the folded surface centroid instead of folding its unpaired centroid", () => {
    const model = { regions: ["central"], bounds: { min: [-10, 0, -5], max: [10, 30, 10] },
      regionAnchors: { central: { centre: { area: 10, centroid: [0, 14, 6], axis: [0, 1, 0] } } } };
    const points = [];
    for (const x of [-4, -2, 2, 4]) for (const y of [10, 14, 18]) points.push([x, y, 6]);
    expect(buildAnatomyFlowFrames(model, samples(points)).centers[0]).toBeCloseTo(3, 6);
  });

  test("empty and degenerate regions keep finite normalized frames and positive scales", () => {
    const model = { regions: ["point", "empty"], bounds: { min: [0, 0, 0], max: [0, 0, 0] } };
    for (const fixture of [samples([]), samples([[0, 0, 0]])]) {
      const { centers, axes } = buildAnatomyFlowFrames(model, fixture);
      expect([...centers, ...axes].every(Number.isFinite)).toBe(true);
      for (let r = 0; r < 2; r++) {
        expect(Math.hypot(...axes.slice(r * 4, r * 4 + 3))).toBeCloseTo(1, 6);
        expect(centers[r * 4 + 3]).toBeGreaterThan(0);
        expect(axes[r * 4 + 3]).toBeGreaterThan(0);
      }
    }
  });
});

test("continuous flow runs only during visible pointer exploration", () => {
  const renderer = { ready: true, interactive: true, hovered: "chest", pointer: [20, 30],
    focused: null, previewing: null, reducedMotion: { matches: false }, calm: () => true };
  const flowing = (changes = {}, visible = true) => AnatomySculpture.prototype.flowing.call(
    { ...renderer, ...changes }, visible);
  expect(flowing()).toBe(true);
  expect(flowing({}, false)).toBe(false);
  for (const changes of [
    { ready: false }, { interactive: false }, { hovered: null }, { pointer: null },
    { focused: { id: "chest" } }, { previewing: new Set(["chest"]) },
    { reducedMotion: { matches: true } }, { calm: () => false }
  ]) expect(flowing(changes)).toBe(false);
});
