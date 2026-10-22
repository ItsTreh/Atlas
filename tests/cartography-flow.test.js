import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const { buildAnatomyFlowFrames, buildAnatomyFlowGuides, AnatomySculpture, flowGuideSlots, FLOW_GUIDE_KINDS } = loadApp({
  extra: ["js/anatomy-sculpture.js"],
  exports: ["buildAnatomyFlowFrames", "buildAnatomyFlowGuides", "AnatomySculpture", "flowGuideSlots", "FLOW_GUIDE_KINDS"] });

/* A region's guide, as the layout places it: never a slot number written
   here, so the tests follow the group list. `code` is what the region gets
   in buildAnatomyFlowGuides' `regions` (negative for a paired group). */
const groupOf = name => flowGuideSlots().find(g => g.names.includes(name));
const code = name => { const g = groupOf(name); return (g.start + 1) * (g.paired ? -1 : 1); };
const at = (slot, k = 0) => slot * 4 + k;          // a slot's first float in a guide row

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

describe("continuous surface guides", () => {
  const bounds = { min: [-30, 0, -20], max: [30, 160, 20] };
  const anchor = (centroid, axis = [0, 1, 0], area = 10) => ({ centroid, axis, area });

  test("the pelvis mirror follows tilted landmarks, independent of unequal painted areas", () => {
    const model = { bounds, regions: ["gluteus-maximus"], regionAnchors: {
      "gluteus-maximus": {
        left: anchor([12, 98, -6], undefined, 100),
        right: anchor([-8, 92, -4], undefined, 200)
      }
    } };
    const g = buildAnatomyFlowGuides(model, samples([]));
    const s = groupOf("gluteus-maximus").start;
    expect([...g.origins.slice(at(s), at(s, 3))]).toEqual([2, 95, -5]);
    const x = [...g.across.slice(at(s), at(s, 3))], y = [...g.along.slice(at(s), at(s, 3))];
    expect(x[1]).toBeGreaterThan(0);                 // a tilted pelvis, not world x = 0
    expect(x.reduce((sum, v, k) => sum + v * y[k], 0)).toBeCloseTo(0, 6);
    expect(Math.hypot(...x)).toBeCloseTo(1, 6);
  });

  test("neighbouring forearm regions share a field while each arm keeps its own direction", () => {
    const pair = { left: anchor([24, 100, -3], [0.2, 0.98, 0]),
      right: anchor([-27, 105, 3], [-0.4, 0.85, -0.3]) };
    const model = { bounds, regions: ["brachioradialis", "flexor-carpi-radialis", "extensor-digitorum"],
      regionAnchors: { "brachioradialis": pair, "flexor-carpi-radialis": pair, "extensor-digitorum": pair } };
    const g = buildAnatomyFlowGuides(model, samples([]));
    const c = code("brachioradialis"), left = groupOf("brachioradialis").start, right = left + 1;
    expect([...g.regions]).toEqual([c, c, c]);
    expect(g.along[at(left)]).toBeGreaterThan(0);
    expect(g.along[at(right)]).toBeLessThan(0);
    expect([...g.origins.slice(at(left), at(left, 3))]).toEqual([24, 100, -3]);
    expect([...g.origins.slice(at(right), at(right, 3))]).toEqual([-27, 105, 3]);
  });

  test("upper-back regions share a guide without changing the accepted front fields", () => {
    const regions = ["infraspinatus", "teres-major", "rhomboid-major", "pectoralis-major",
      "deltoid", "rectus-abdominis", "external-oblique"];
    const pair = { left: anchor([8, 138, -15]), right: anchor([-14, 140, -13]) };
    const g = buildAnatomyFlowGuides({ bounds, regions,
      regionAnchors: Object.fromEntries(regions.map(name => [name, pair])) }, samples([]));
    const c = code("infraspinatus");
    expect([...g.regions]).toEqual([c, c, c, 0, 0, 0, 0]);
  });

  test("missing or invalid bilateral landmarks keep the existing field", () => {
    const model = { bounds, regions: ["gluteus-maximus", "trapezius"], regionAnchors: {
      "gluteus-maximus": { left: anchor([10, 95, -6]) },
      "trapezius": { left: anchor([6, 140, -10]), right: anchor([NaN, 140, -10]) }
    } };
    const g = buildAnatomyFlowGuides(model, samples([]));
    expect([...g.regions]).toEqual([0, 0]);
    expect([...g.origins, ...g.across, ...g.along].every(Number.isFinite)).toBe(true);
  });

  test("each thigh group shares a continuous guide without mixing neighbouring training areas", () => {
    const regions = ['rectus-femoris', 'vastus-lateralis', 'vastus-medialis', 'sartorius',
      'gracilis', 'pectineus', 'adductor-longus', 'biceps-femoris', 'semitendinosus',
      'semimembranosus', 'adductor-magnus', 'gastrocnemius'];
    const pair = { left: anchor([10, 75, 5], [0.1, 0.99, 0]),
      right: anchor([-10, 72, 8], [-0.2, 0.96, 0.2]) };
    const g = buildAnatomyFlowGuides({ bounds, regions,
      regionAnchors: Object.fromEntries(regions.map(name => [name, pair])) }, samples([]));
    const quads = code("rectus-femoris"), adductors = code("gracilis"), hamstrings = code("biceps-femoris");
    expect([...g.regions]).toEqual([quads, quads, quads, quads, adductors, adductors, adductors,
                                    hamstrings, hamstrings, hamstrings, hamstrings, 0]);
    expect(new Set([quads, adductors, hamstrings]).size).toBe(3);
    // Both posed sides are allocated for every shared field.
    for (const id of [quads, adductors, hamstrings]) for (const offset of [0, 1]) {
      const base = (Math.abs(id) - 1 + offset) * 4;
      expect(g.across[base + 3]).toBeGreaterThan(0);
      expect(g.along[base + 3]).toBeGreaterThan(0);
      expect(Math.hypot(...g.along.slice(base, base + 3))).toBeCloseTo(1, 6);
    }
  });

  test("the central lower back follows the posed torso without creating a second mirrored patch", () => {
    const model = { bounds, regions: ['erector-spinae'], regionAnchors: {
      'erector-spinae': { centre: anchor([2, 110, -6], [0.4, 0.9, 0.1]) },
      'gluteus-maximus': { left: anchor([12, 96, -5]), right: anchor([-8, 94, -5]) },
      trapezius: { left: anchor([5, 148, -10]), right: anchor([-9, 146, -10]) }
    } };
    const g = buildAnatomyFlowGuides(model, samples([]));
    expect(g.regions[0]).toBeGreaterThan(0);         // single continuous patch
    const base = (g.regions[0] - 1) * 4;
    expect([...g.origins.slice(base, base + 3)]).toEqual([2, 110, -6]);
    const direction = [-4, 52, -5], length = Math.hypot(...direction);
    direction.forEach((v, k) => expect(g.along[base + k]).toBeCloseTo(v / length, 6));
    delete model.regionAnchors['gluteus-maximus'];
    const fallback = buildAnatomyFlowGuides(model, samples([]));
    expect(fallback.regions[0]).toBe(g.regions[0]);
    expect([...fallback.along].every(Number.isFinite)).toBe(true);
  });

  test("lat sweeps follow the posed torso despite conflicting painted principal axes", () => {
    const model = { bounds, regions: ['latissimus-dorsi', 'external-oblique'], regionAnchors: {
      'latissimus-dorsi': { left: anchor([12, 125, -10], [0.99, 0.1, 0]),
        right: anchor([-12, 125, -10], [-0.3, 0.95, 0]) },
      'gluteus-maximus': { left: anchor([10, 95, -5]), right: anchor([-10, 95, -5]) },
      trapezius: { left: anchor([8, 147, -10]), right: anchor([-8, 147, -10]) }
    } };
    const g = buildAnatomyFlowGuides(model, samples([]));
    expect(g.regions[0]).toBeLessThan(0);
    expect(g.regions[1]).toBe(0);
    const base = (Math.abs(g.regions[0]) - 1) * 4;
    expect(g.along[base]).toBeCloseTo(-g.along[base + 4], 6);
    expect(g.along[base + 1]).toBeCloseTo(g.along[base + 5], 6);
    expect(g.along[base + 2]).toBeCloseTo(g.along[base + 6], 6);
    expect(g.along[base + 2]).toBeLessThan(0); // follows the torso's backward lean
    delete model.regionAnchors.trapezius;
    const fallback = buildAnatomyFlowGuides(model, samples([]));
    expect(fallback.regions[0]).toBe(g.regions[0]);
    expect([...fallback.along].every(Number.isFinite)).toBe(true);
    expect(fallback.along[base + 1]).toBeLessThan(fallback.along[base + 5]);
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

test("a session pointed at off Targets draws as a selected group hovered on Targets, flowing", () => {
  const r = { model: { regions: ["a", "b"] }, muscleOf: ["chest", "quads"], interactive: false,
    selection: { has: () => true }, previewing: null, highlighting: new Set(["quads"]) };
  expect([...AnatomySculpture.prototype.targets.call(r)]).toEqual([0, 0, 0, 1, 1, 0]);
  const flow = changes => AnatomySculpture.prototype.flowing.call({ ...r, ready: true,
    hovered: null, pointer: null, reducedMotion: { matches: false }, calm: () => true, ...changes }, true);
  expect(flow()).toBe(true);
  expect(flow({ highlighting: null })).toBe(false);
  expect(flow({ reducedMotion: { matches: true } })).toBe(false);
  expect(flow({ calm: () => false })).toBe(false);
});

test("lit muscles draw in once, and repeating the same preview does not restart it", () => {
  // Regions 0, 1, 2 are chest, lats and quads; the draw-in is per region.
  const r = { previewing: null, litReveal: null, muscleOf: ["chest", "lats", "quads"], schedule() {},
    targets: () => new Float32Array(9), shown: new Float32Array(9), reducedMotion: { matches: false }, interactive: true,
    calm: () => true, pointer: null, regionAt: () => -1, mapPresence: 0, mapPointer: [0, 0], mapInfluence: 0 };
  AnatomySculpture.prototype.preview.call(r, ["chest"]);
  expect(r.litReveal[0]).toBe(0);
  expect(AnatomySculpture.prototype.ease.call(r, 360)).toBe(true);
  AnatomySculpture.prototype.preview.call(r, ["chest"]);
  expect(r.litReveal[0]).toBeGreaterThan(0);
  AnatomySculpture.prototype.ease.call(r, 400);
  expect(r.litReveal[0]).toBe(1);
  expect(AnatomySculpture.prototype.ease.call(r, 16)).toBe(false);
  AnatomySculpture.prototype.preview.call(r, ["lats"]);
  r.reducedMotion.matches = true;
  AnatomySculpture.prototype.ease.call(r, 16);
  expect([...r.litReveal]).toEqual([1, 1, 1]);
});

test("stepping to another program keeps the muscles both light drawn, and draws in only the new ones", () => {
  const r = { previewing: null, litReveal: null, muscleOf: ["chest", "lats", "quads"], schedule() {},
    targets: () => new Float32Array(9), shown: new Float32Array(9), reducedMotion: { matches: false }, interactive: true,
    calm: () => true, pointer: null, regionAt: () => -1, mapPresence: 0, mapPointer: [0, 0], mapInfluence: 0 };
  AnatomySculpture.prototype.preview.call(r, ["chest", "lats"]);
  AnatomySculpture.prototype.ease.call(r, 1000);
  AnatomySculpture.prototype.preview.call(r, ["chest", "quads"]);
  expect([...r.litReveal]).toEqual([1, 0, 0]);    // chest stays drawn; quads starts; lats is no longer lit
});

test("a tinted family preview draws as a hover in the family's hue, flowing, then fades back", () => {
  const S = AnatomySculpture.prototype;
  const r = { model: { regions: ["a", "b"] }, muscleOf: ["lats", "chest"], interactive: true,
    selection: { has: () => true }, hovered: null, highlighting: null, previewing: null,
    previewFamily: null, litReveal: null, schedule() {} };
  S.preview.call(r, ["lats"], "pull");
  expect(r.previewFamily).toBe("pull");
  expect(r.litReveal).toBe(null);                             // no draw-in
  expect([...S.targets.call(r)]).toEqual([1, 1, 0, 0, 0, 0]);
  const flow = () => S.flowing.call({ ...r, ready: true, pointer: null,
    reducedMotion: { matches: false }, calm: () => true }, true);
  expect(flow()).toBe(true);
  Object.assign(r, { targets: () => S.targets.call(r), tintTargets: () => S.tintTargets.call(r),
    tintShown: new Float32Array(2), reducedMotion: { matches: false },
    calm: () => true, pointer: null, regionAt: () => -1, mapPresence: 0, mapPointer: [0, 0], mapInfluence: 0 });
  S.ease.call(r, 16);
  expect(r.tintShown[0]).toBeGreaterThan(0);
  expect(r.tintShown[0]).toBeLessThan(1);
  for (let i = 0; i < 100; i++) S.ease.call(r, 16);
  expect([...r.tintShown]).toEqual([1, 0]);
  S.preview.call(r, null);
  for (let i = 0; i < 100; i++) S.ease.call(r, 16);
  expect([...r.tintShown]).toEqual([0, 0]);
  expect(flow()).toBe(false);
  S.preview.call(r, ["chest"], "other");                        // no hue: the lit preview
  expect(r.previewFamily).toBe(null);
  expect(r.litReveal[1]).toBe(0);                               // chest draws in
});

test("a session tints each of its muscles in its own family hue, mixed sessions side by side", () => {
  const S = AnatomySculpture.prototype;
  const r = { model: { regions: ["a", "b", "c"] }, muscleOf: ["lats", "upper-back", "quads"],
    interactive: false, previewFamily: null, previewing: null, highlighting: null, schedule() {} };
  S.setHighlight.call(r, ["lats", "upper-back"]);
  expect([...S.tintTargets.call(r)]).toEqual([1, 1, 0]);
  S.setHighlight.call(r, ["lats", "quads"]);
  expect([...S.tintTargets.call(r)]).toEqual([1, 0, 1]);
  S.setHighlight.call(r, null);
  expect([...S.tintTargets.call(r)]).toEqual([0, 0, 0]);
});

test("traces scale with the body's size on screen against Targets, within bounds", () => {
  const S = AnatomySculpture.prototype;
  const at = d => S.traceScale.call({ live: () => ({ d, fov: 20 }),
    shotParams: () => ({ d: 600, fov: 20 }) });
  expect(at(600)).toBeCloseTo(1, 6);
  expect(at(300)).toBeCloseTo(2, 6);
  expect(at(100)).toBe(2.5);
  expect(at(2000)).toBe(0.7);
});
