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

test("pointer deformation responds on selected surfaces and settles after leaving", () => {
  const r = { targets: () => new Float32Array([1, 0, 0]),
    shown: new Float32Array([1, 0, 0]), reducedMotion: { matches: false },
    interactive: true, calm: () => true, pointer: [40, 80], regionAt: () => 0,
    mapPresence: 0, mapPointer: [40, 80], mapInfluence: 0 };
  const ease = () => AnatomySculpture.prototype.ease.call(r, 16);
  ease();
  expect(r.mapInfluence).toBeGreaterThan(0);
  expect(r.mapInfluence).toBeLessThan(1);
  for (let i = 0; i < 100; i++) ease();
  expect(r.mapInfluence).toBe(1);
  r.pointer = null;
  for (let i = 0; i < 100; i++) ease();
  expect(r.mapInfluence).toBe(0);
  expect(ease()).toBe(false);
  r.pointer = [40, 80];
  r.mapInfluence = 1;
  r.reducedMotion.matches = true;
  ease();
  expect(r.mapInfluence).toBe(0);
});

test("a program pointed at lights its muscles and sets aside the rest of the selection", () => {
  const r = { model: { regions: ["a", "b", "c"] }, muscleOf: ["chest", "back", "quads"],
    interactive: true, hovered: "quads", highlighting: null,
    selection: { has: id => id === "chest" || id === "back" },
    previewing: new Set(["chest", "quads"]) };
  const t = [...AnatomySculpture.prototype.targets.call(r)];
  expect(t).toEqual([1, 0, 1, 0, 0, 0, 0, 0, 1]);           // [selected, pointed, lit] per region
  r.previewing = null;
  expect([...AnatomySculpture.prototype.targets.call(r)]).toEqual([1, 0, 0, 1, 0, 0, 0, 1, 0]);
});

test("a session pointed at off Targets draws exactly as a hovered group, flowing", () => {
  const r = { model: { regions: ["a", "b"] }, muscleOf: ["chest", "quads"], interactive: false,
    selection: { has: () => true }, previewing: null, highlighting: new Set(["quads"]) };
  expect([...AnatomySculpture.prototype.targets.call(r)]).toEqual([0, 0, 0, 0, 1, 0]);
  const flow = changes => AnatomySculpture.prototype.flowing.call({ ...r, ready: true,
    hovered: null, pointer: null, reducedMotion: { matches: false }, calm: () => true, ...changes }, true);
  expect(flow()).toBe(true);
  expect(flow({ highlighting: null })).toBe(false);
  expect(flow({ reducedMotion: { matches: true } })).toBe(false);
  expect(flow({ calm: () => false })).toBe(false);
});

test("lit muscles draw in once, and repeating the same preview does not restart it", () => {
  const r = { previewing: null, litReveal: 1, schedule() {}, targets: () => new Float32Array(3),
    shown: new Float32Array(3), reducedMotion: { matches: false }, interactive: true,
    calm: () => true, pointer: null, regionAt: () => -1, mapPresence: 0, mapPointer: [0, 0], mapInfluence: 0 };
  AnatomySculpture.prototype.preview.call(r, ["chest"]);
  expect(r.litReveal).toBe(0);
  expect(AnatomySculpture.prototype.ease.call(r, 360)).toBe(true);
  AnatomySculpture.prototype.preview.call(r, ["chest"]);
  expect(r.litReveal).toBeGreaterThan(0);
  AnatomySculpture.prototype.ease.call(r, 400);
  expect(r.litReveal).toBe(1);
  expect(AnatomySculpture.prototype.ease.call(r, 16)).toBe(false);
  AnatomySculpture.prototype.preview.call(r, ["back"]);
  r.reducedMotion.matches = true;
  AnatomySculpture.prototype.ease.call(r, 16);
  expect(r.litReveal).toBe(1);
});
