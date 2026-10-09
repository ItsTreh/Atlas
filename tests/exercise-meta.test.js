/* The exercise metadata is complete, consistent with the catalogue, and honest about its confidence. */
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp();
const NEEDS_META = new Set(["glutes", "shoulders", "upper-back", "traps", "chest", "lats"]);

describe("exercise metadata", () => {
  test("every exercise that works a regional muscle has metadata", () => {
    for (const e of app.EXERCISES)
      if ([...e.primary, ...e.secondary].some(m => NEEDS_META.has(m))) expect(e.meta, e.name).toBeTruthy();
  });

  test("each entry names exactly one catalogue exercise, once", () => {
    const names = app.EXERCISE_META.map(m => m[0]);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(app.EXERCISE_BY_NAME.has(n), n).toBe(true);
  });

  test("regions belong to a muscle the exercise works and are known parts of it", () => {
    for (const e of app.EXERCISES) {
      if (!e.meta) continue;
      for (const [muscle, list] of Object.entries(e.meta.regions)) {
        expect([...e.primary, ...e.secondary], e.name + " " + muscle).toContain(muscle);
        for (const r of list) expect(app.MUSCLE_REGIONS[muscle], e.name).toContain(r);
      }
    }
  });

  test("confidence is one of the three levels, and uncertain entries explain themselves", () => {
    for (const e of app.EXERCISES) {
      if (!e.meta) continue;
      expect(app.META_CONFIDENCE).toContain(e.meta.confidence);
      if (e.meta.confidence === "uncertain") expect(e.meta.note.length, e.name).toBeGreaterThan(20);
      expect(e.meta.review).toBe("pending");           // nobody has checked the sources yet
    }
  });

  test("the action agrees with the movement: same movement, same action", () => {
    const byMovement = new Map();
    for (const e of app.EXERCISES) {
      if (!e.meta) continue;
      const seen = byMovement.get(e.movement);
      if (seen && e.movement !== "hinge") expect(e.meta.action, e.name).toBe(seen);   // hinge mixes RDL and back extension
      byMovement.set(e.movement, e.meta.action);
    }
  });

  test("the three parts of the shoulder each have an exercise that trains them directly", () => {
    for (const region of ["anterior", "lateral", "posterior"])
      expect(app.EXERCISES.some(e => e.primary.includes("shoulders") && e.regionsFor("shoulders").includes(region)), region).toBe(true);
  });
});
