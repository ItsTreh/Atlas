import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

// The hands the sculpture is shown by (SCULPTURE_TECHNIQUES): the logic that
// brings the drawing and the cast in and settles the bronze, without WebGL.
const { AnatomySculpture, SCULPTURE_TECHNIQUES, SCULPTURE_TECHNIQUE_MS: MS, SCULPTURE_FRAGMENT } = loadApp({
  extra: ["js/anatomy-sculpture.js"],
  exports: ["AnatomySculpture", "SCULPTURE_TECHNIQUES", "SCULPTURE_TECHNIQUE_MS", "SCULPTURE_FRAGMENT"] });

function renderer() {
  const r = Object.create(AnatomySculpture.prototype);
  return Object.assign(r, {
    tech: [0, 0], techTo: [0, 0], frames: 0,
    castOf: { level: 0, to: 0, hot: 0, hotTo: 0, mark: 0, slosh: 0, time: 0 },
    schedule() { this.frames++; }
  });
}
/** Runs frames of 16 ms until nothing moves; how many it took. */
function settle(r, instant = false) {
  let n = 0;
  while (r.easeTechnique(16, instant) && n < 2000) n++;
  return n;
}

describe("the sculpture's techniques", () => {
  test("each stage's hand is one of three, and the marble is neither of the others", () => {
    expect(Object.keys(SCULPTURE_TECHNIQUES).sort()).toEqual(["cast", "drawing", "marble"]);
    expect(SCULPTURE_TECHNIQUES.marble).toEqual([0, 0]);
  });

  test("a technique comes in over its time, then stops asking for frames", () => {
    const r = renderer();
    r.setTechnique("drawing");
    expect(r.frames).toBe(1);
    const n = settle(r);
    expect(r.tech).toEqual([1, 0]);
    expect(n * 16).toBeGreaterThanOrEqual(MS.draw - 32);
    expect(n * 16).toBeLessThan(MS.draw + 64);
    expect(r.easeTechnique(16, false)).toBe(false);
  });

  test("asking for the technique already shown schedules nothing", () => {
    const r = renderer();
    r.setTechnique("marble");
    r.setTechnique("no such hand");          // falls back to the marble
    expect(r.frames).toBe(0);
  });

  test("leaving the cast takes it out again", () => {
    const r = renderer();
    r.setTechnique("cast");
    settle(r);
    expect(r.tech).toEqual([0, 1]);
    r.setTechnique("drawing");
    settle(r);
    expect(r.tech).toEqual([1, 0]);
  });

  test("reduced motion shows it at once", () => {
    const r = renderer();
    r.setTechnique("cast");
    r.setCast({ level: 0.7, hot: 0.6, mark: 0.74 });
    expect(r.easeTechnique(16, true)).toBe(false);
    expect(r.tech).toEqual([0, 1]);
    expect(r.castOf.level).toBe(0.7);
    expect(r.castOf.slosh).toBe(0);
  });
});

describe("the cast's bronze", () => {
  test("it finds its level, its wave dies away, and it rests", () => {
    const r = renderer();
    r.setTechnique("cast");
    r.setCast({ level: 0.74, hot: 0.69, mark: 0.74 });
    expect(r.castOf.slosh).toBe(1);
    const n = settle(r);
    expect(n).toBeLessThan(2000);
    expect(r.castOf.level).toBe(0.74);
    expect(r.castOf.hot).toBe(0.69);
    expect(r.castOf.slosh).toBe(0);
  });

  test("levels stay inside the figure, and the hot band never stands above the surface", () => {
    const r = renderer();
    r.setCast({ level: 1.4, hot: 2, mark: -1 });
    expect(r.castOf.to).toBe(1);
    expect(r.castOf.hotTo).toBe(1);
    expect(r.castOf.mark).toBe(0);
    r.setCast({ level: 0.5, hot: 0.8, mark: 0.74 });
    expect(r.castOf.hotTo).toBe(0.5);
  });

  test("pouring empties it first; the same levels again change nothing", () => {
    const r = renderer();
    r.setTechnique("cast");
    r.setCast({ level: 0.6, hot: 0.6, mark: 0.74 });
    settle(r);
    const frames = r.frames;
    r.setCast({ level: 0.6, hot: 0.6, mark: 0.74 });
    expect(r.frames).toBe(frames);
    r.setCast({ level: 0.6, hot: 0.6, mark: 0.74 }, true);
    expect(r.castOf.level).toBe(0);
    expect(r.frames).toBe(frames + 1);
    settle(r);
    expect(r.castOf.level).toBe(0.6);
  });
});

describe("the techniques in the shader", () => {
  test("the marble alone leaves the canvas opaque: only the drawing writes alpha", () => {
    // The drawing is ink on the page, so it alone lets the ground through.
    const writes = [...SCULPTURE_FRAGMENT.matchAll(/alpha = ([^;]+);/g)].map(m => m[1]);
    expect(writes).toEqual(["1.0", "mix(1.0, drawn, t)"]);
    expect(SCULPTURE_FRAGMENT).toMatch(/if \(uTechnique\.x > 0\.0\) \{[\s\S]*alpha = mix\(1\.0, drawn, t\);/);
  });
});
