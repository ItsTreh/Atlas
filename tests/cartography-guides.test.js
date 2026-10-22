/* The flow guides' layout (js/anatomy-cartography.js): which slot of the
   guide rows each group takes, and the code each region gets for the shader.
   Nothing here names a slot by number: a group added, removed or moved in
   FLOW_GUIDE_GROUPS must still give every region its own guide. */
import fs from "node:fs";
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp({ extra: ["js/anatomy-sculpture.js"],
  exports: ["buildAnatomyFlowGuides", "flowGuideSlots", "flowGuideDefines", "FLOW_GUIDE_GROUPS", "FLOW_GUIDE_KINDS"] });
const slots = app.flowGuideSlots();
const count = slots.reduce((n, g) => n + (g.paired ? 2 : 1), 0);

/* A model with every grouped region, each side posed differently, and the
   landmarks the central and torso guides lean on. */
function everyGroupedRegion() {
  const regions = [...new Set(slots.flatMap(g => g.names))];
  const anchor = (centroid, axis) => ({ centroid, axis, area: 10 });
  const regionAnchors = Object.fromEntries(regions.map((name, i) => [name, {
    left: anchor([8 + i * 0.1, 90 + i, -4], [0.1, 0.99, 0]),
    right: anchor([-9 - i * 0.1, 92 + i, -3], [-0.2, 0.97, 0.1]),
    centre: anchor([0, 110, -6], [0, 1, 0])
  }]));
  return { bounds: { min: [-30, 0, -20], max: [30, 160, 20] }, regions, regionAnchors };
}
const noSamples = { count: 0, stride: 12, data: new Float32Array(0) };

/* What the fragment shader does with a region's code: its guide slot, and
   for a paired group the right side's, the next one. */
const decode = code => {
  const guide = Math.abs(code) - 1;
  return code < 0 ? [guide, guide + 1] : [guide];
};

describe("flow guide slots never collide", () => {
  test("a region belongs to one group at most", () => {
    const names = app.FLOW_GUIDE_GROUPS.flatMap(g => g.names);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  test("every slot is taken by exactly one group, a paired group's two side by side", () => {
    const owner = new Array(count).fill(null);
    slots.forEach((g, i) => {
      for (const slot of g.paired ? [g.start, g.start + 1] : [g.start]) {
        expect(owner[slot]).toBe(null);
        owner[slot] = i;
      }
    });
    expect(owner.every(o => o !== null)).toBe(true);
  });

  test("each region's code leads the shader to its own group's slots, of its own kind, and nowhere else", () => {
    const model = everyGroupedRegion();
    const g = app.buildAnatomyFlowGuides(model, noSamples);
    expect(g.origins.length).toBe(count * 4);
    const seen = new Map();                      // slot -> the group whose regions read it
    model.regions.forEach((name, r) => {
      const group = slots.find(s => s.names.includes(name));
      const guides = decode(g.regions[r]);
      expect(guides).toEqual(group.paired ? [group.start, group.start + 1] : [group.start]);
      for (const slot of guides) {
        expect(slot).toBeGreaterThanOrEqual(0);
        expect(slot).toBeLessThan(count);
        expect(g.origins[slot * 4 + 3]).toBe(app.FLOW_GUIDE_KINDS[group.kind]);
        if (seen.has(slot)) expect(seen.get(slot)).toBe(group);
        seen.set(slot, group);
      }
    });
  });

  test("the kinds are distinct, every group's kind exists, and the shader reads them by name", () => {
    const values = Object.values(app.FLOW_GUIDE_KINDS);
    expect(new Set(values).size).toBe(values.length);
    expect(values.every(v => Number.isInteger(v) && v > 0)).toBe(true);
    for (const g of app.FLOW_GUIDE_GROUPS) expect(Object.hasOwn(app.FLOW_GUIDE_KINDS, g.kind)).toBe(true);
    const defines = app.flowGuideDefines();
    for (const name of Object.keys(app.FLOW_GUIDE_KINDS)) expect(defines).toContain("#define KIND_" + name.toUpperCase() + " ");
    // No kind compared by a bare number in the shader: they come from FLOW_GUIDE_KINDS.
    const source = fs.readFileSync(new URL("../js/anatomy-sculpture.js", import.meta.url), "utf8");
    expect(source).not.toMatch(/origin\.w\s*[<>=]=?\s*\d/);
    for (const name of Object.keys(app.FLOW_GUIDE_KINDS).filter(k => k !== "scapula" && k !== "limb"))
      expect(source).toContain("KIND_" + name.toUpperCase());
  });
});
