/* The data files: they load cleanly and every cross-reference holds. */
import { describe, expect, test } from "vitest";
import { loadApp, logicScripts } from "./load-app.js";

const app = loadApp();

describe("loading", () => {
  test("the logic scripts load in index.html order with no data errors", () => {
    expect(logicScripts().length).toBeGreaterThan(5);
    expect(app.errors).toEqual([]);
  });
});

describe("muscles", () => {
  test("ids are unique and every muscle has a known family", () => {
    const ids = app.MUSCLES.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of app.MUSCLES) expect(Object.keys(app.FAMILIES)).toContain(m.family);
  });

  test("every muscle uses a known weekly sets scale", () => {
    for (const m of app.MUSCLES) expect(Object.keys(app.configValue("weeklyTargets")), m.id).toContain(m.kind);
  });

  test("each scale runs floor to target to ceiling, Maintain below Normal below Focus", () => {
    for (const [kind, scale] of Object.entries(app.configValue("weeklyTargets"))) {
      for (const p of app.PRIORITY_LEVELS) {
        expect(scale[p].floor, kind + " " + p).toBeLessThanOrEqual(scale[p].target);
        expect(scale[p].target, kind + " " + p).toBeLessThanOrEqual(scale.ceiling);
      }
      expect(scale.maintain.target, kind).toBeLessThan(scale.normal.target);
      expect(scale.normal.target, kind).toBeLessThan(scale.focus.target);
    }
  });
});

describe("programs", () => {
  test("every program lists known muscles, once each", () => {
    for (const p of app.PROGRAMS) {
      expect(p.muscles.length).toBeGreaterThan(0);
      expect(new Set(p.muscles).size).toBe(p.muscles.length);
      for (const id of p.muscles) expect(app.MUSCLE_BY_ID.has(id)).toBe(true);
    }
  });

  test("Full Body is every muscle", () => {
    expect([...app.PROGRAM_BY_ID.get("full-body").muscles].sort())
      .toEqual(app.MUSCLES.map(m => m.id).sort());
  });
});

describe("exercises", () => {
  test("tiers keep their labels exactly, one per muscle", () => {
    const squat = app.EXERCISE_BY_NAME.get("Barbell Back Squat");
    expect(squat.tierFor("quads")).toBe("S");
    expect(squat.tierFor("glutes")).toBe("A");
    expect(app.EXERCISE_BY_NAME.get("Machine Chest Press").tierFor("chest")).toBe("S+");
    expect(app.EXERCISE_BY_NAME.get("Machine Shoulder Press").tierFor("shoulders")).toBe("A+");
    for (const ex of app.EXERCISES)
      for (const label of Object.values(ex.tiers)) expect(app.TIERS).toContain(label);
  });

  test("ids are unique and every exercise has a known movement", () => {
    expect(app.EXERCISE_BY_ID.size).toBe(app.EXERCISES.length);
    for (const ex of app.EXERCISES) expect(app.MOVEMENTS[ex.movement]).toBeTruthy();
  });

  test("a muscle's candidates come best tier first, unrated last", () => {
    for (const m of app.MUSCLES) {
      const ranks = app.exercisesFor(m.id).map(ex => app.tierRank(ex.tierFor(m.id)));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  });
});

describe("foods", () => {
  test("meal ideas use known foods, and diet fit follows the foods", () => {
    for (const idea of app.MEAL_IDEAS)
      for (const [id] of idea.foods) expect(app.FOODS[id]).toBeTruthy();
    const byName = n => app.MEAL_IDEAS.find(i => i.name === n);
    expect(app.fitsDiet(byName("Tofu stir-fry"), "vegan")).toBe(true);
    expect(app.fitsDiet(byName("Veg omelette & potatoes"), "vegan")).toBe(false);
    expect(app.fitsDiet(byName("Veg omelette & potatoes"), "vegetarian")).toBe(true);
    expect(app.fitsDiet(byName("Tuna pasta"), "vegetarian")).toBe(false);
    expect(app.fitsDiet(byName("Tuna pasta"), "pescatarian")).toBe(true);
  });

  test("every meal pattern's shares add up to the whole day", () => {
    for (const pattern of Object.values(app.MEAL_PATTERNS)) {
      const total = pattern.reduce((t, [, share]) => t + share, 0);
      expect(total).toBeCloseTo(1, 5);
    }
  });
});
