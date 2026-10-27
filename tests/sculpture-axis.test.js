import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

// axisPoint is the sculpture's camera worked out for one line, so the word
// in front of the legs (js/flow-front.js) can follow the figure without the
// GPU. Here it is held to the matrices the figure is actually drawn with.
const { AnatomySculpture, SCULPTURE_SHOTS } = loadApp({
  extra: ["js/anatomy-sculpture.js"], exports: ["AnatomySculpture", "SCULPTURE_SHOTS"] });

/** A renderer with only what the camera reads: a model's bounds and a canvas. */
function renderer(cam, cw = 1440, ch = 900) {
  const r = Object.create(AnatomySculpture.prototype);
  const min = [-30, 0, -15], max = [30, 170, 15];
  Object.assign(r, {
    model: { bounds: { min, max } }, axis: [0, 0], height: 170,
    reach: Math.hypot(60, 170, 30), size: { cw, ch }, cur: cam, off: 0
  });
  return r;
}

/** A point through the real view-projection matrix, in canvas pixels, and its depth. */
function project(r, p) {
  const m = r.camera(r.live()).matrix, { cw, ch } = r.size;
  const c = i => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i];
  const w = c(3);
  return { x: (c(0) / w + 1) / 2 * cw, y: (1 - c(1) / w) / 2 * ch, w };
}

const shots = ["targets-front", "targets-back", "targets-how0", "targets-how1", "targets-how2",
  "targets-train-front", "nutrition", "plan"];

describe("the figure's axis on the canvas", () => {
  test.each(shots)("%s: axisPoint matches the drawing camera", name => {
    for (const turn of [0, -25, 25]) {
      const r = renderer({ ...SCULPTURE_SHOTS[name] });
      r.off = turn;
      for (const t of [0.1, 0.29, 0.58, 0.9]) {
        const a = r.axisPoint(t), p = project(r, [0, t * r.height, 0]);
        expect(a.x).toBeCloseTo(p.x, 3);
        expect(a.y).toBeCloseTo(p.y, 3);
      }
    }
  });

  test("side names the half of the screen where the nearer leg stands", () => {
    for (const az of [5, 20, 60, 120, 170, 185, 200, 250, 300, 355, -24, -5]) {
      const r = renderer({ ...SCULPTURE_SHOTS["targets-front"], az });
      const legs = [-10, 10].map(x => project(r, [x, 0.3 * r.height, 0]));
      const near = legs[0].w < legs[1].w ? legs[0] : legs[1];
      const { x, side } = r.axisPoint(0.3);
      expect(Math.sign(near.x - x)).toBe(side);
    }
  });

  test("no canvas yet, no point", () => {
    const r = renderer({ ...SCULPTURE_SHOTS["targets-front"] });
    r.size = null;
    expect(r.axisPoint(0.5)).toBe(null);
  });
});
