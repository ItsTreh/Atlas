/* The muscle plan's own maths, before any exercise is chosen: the overlap it
   may count (plannedOverlap, set-credit.js) and the direct sets that deliver
   each target (directSetsFor, estimate.js). Targets are effective sets
   (the user's decision, 2026-11-09); the rankings must never move them. */
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const EXTRA = ["plannedOverlap", "overlapTable", "directSetsFor", "planOrder",
               "PLANNED_CREDIT_EXCLUDED", "PLANNED_OVERLAP_LABELS", "givesPlannedCredit"];
const app = loadApp({ exports: EXTRA });
const byId = id => app.MUSCLE_BY_ID.get(id);
const half = app.PLANNER_CONFIG.assistedShareCap.value;

/** A deterministic shuffle (a fixed linear congruential sequence), so a failure repeats. */
function shuffled(list, seed) {
  const out = [...list];
  let x = seed;
  for (let i = out.length - 1; i > 0; i--) {
    x = (x * 1103515245 + 12345) % 2147483648;
    const j = x % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

describe("planned overlap", () => {
  test("loading logs no data errors", () => {
    expect(app.errors).toEqual([]);
  });

  test("is the table the plan was agreed on, hamstrings excluded", () => {
    const table = Object.fromEntries([...app.overlapTable()].map(([k, v]) => [k, v.credit]));
    expect(table).toEqual({
      "chest>shoulders": 0.5, "chest>triceps": 0.5, "shoulders>triceps": 0.5,
      "triceps>chest": 0.5, "triceps>shoulders": 0.5, "upper-back>lats": 0.5,
      "lats>biceps": 0.5, "quads>glutes": 0.5
    });
  });

  test("every overlap carries a tier and a note", () => {
    for (const pair of app.overlapTable().keys()) {
      const [from, to] = pair.split(">");
      const o = app.plannedOverlap(from, to);
      expect(["B+D", "D"], pair).toContain(o.tier);
      expect(o.how.length, pair).toBeGreaterThan(0);
    }
  });

  test("nothing above 0.5 without a measured row behind every compound", () => {
    for (const [pair, o] of app.overlapTable())
      if (o.credit > app.WORKOUT.secondaryCredit) expect(o.measured, pair).toBe(true);
  });

  test("hamstrings give none and so have no compound-first", () => {
    expect(app.PLANNED_CREDIT_EXCLUDED.map(x => x.muscle)).toEqual(["hamstrings"]);
    for (const m of app.MUSCLES) expect(app.plannedOverlap("hamstrings", m.id).credit).toBe(0);
    expect(app.givesPlannedCredit("hamstrings")).toBe(false);
    expect(app.givesPlannedCredit("chest")).toBe(true);
  });

  test("the rankings don't move it: emptying every tier list changes nothing", () => {
    const before = [...app.overlapTable()];
    const fresh = loadApp({ exports: EXTRA });
    for (const e of fresh.EXERCISES) { e.tiers = {}; e.listOrder = {}; }
    expect([...fresh.overlapTable()]).toEqual(before);
  });
});

describe("the order credit flows in", () => {
  test("is the same whatever order the muscles arrive in", () => {
    const want = app.planOrder(app.MUSCLES).map(m => m.id);
    for (const seed of [1, 7, 42, 99])
      expect(app.planOrder(shuffled(app.MUSCLES, seed)).map(m => m.id)).toEqual(want);
  });

  test("breaks the shoulders–triceps tie by catalogue order", () => {
    expect(byId("shoulders").minutes).toBe(byId("triceps").minutes);
    const ids = app.planOrder(app.MUSCLES).map(m => m.id);
    expect(ids.indexOf("shoulders")).toBeLessThan(ids.indexOf("triceps"));
    expect(ids.indexOf("chest")).toBeLessThan(ids.indexOf("triceps"));
  });

  test("gives the same direct sets whatever order the muscles arrive in", () => {
    const targets = new Map(app.MUSCLES.map(m => [m.id, app.weeklyTarget(m, "normal")]));
    const want = [...app.directSetsFor(targets, app.MUSCLES, new Map(), 4).direct].sort();
    for (const seed of [3, 11, 58])
      expect([...app.directSetsFor(targets, shuffled(app.MUSCLES, seed), new Map(), 4).direct].sort()).toEqual(want);
  });
});

describe("direct sets for the targets", () => {
  const all = app.MUSCLES;
  const targetsAt = level => new Map(all.map(m => [m.id, app.weeklyTarget(m, level)]));

  test("never book less than the target: direct + credit counted reaches it", () => {
    for (const level of ["maintain", "normal", "focus"]) {
      const targets = targetsAt(level);
      const priorities = new Map(all.map(m => [m.id, level]));
      for (const days of [1, 3, 5]) {
        const { direct, credit } = app.directSetsFor(targets, all, priorities, days);
        for (const m of all)
          expect(direct.get(m.id) + credit.get(m.id), m.id).toBeGreaterThanOrEqual(targets.get(m.id));
      }
    }
  });

  test("half-target rule: every Normal and Focus muscle does at least half its target directly", () => {
    for (const level of ["normal", "focus"]) {
      const targets = targetsAt(level);
      const priorities = new Map(all.map(m => [m.id, level]));
      for (const days of [1, 3, 5]) {
        const { direct } = app.directSetsFor(targets, all, priorities, days);
        for (const m of all)
          expect(direct.get(m.id), m.id + " " + level).toBeGreaterThanOrEqual(Math.ceil(targets.get(m.id) * half));
      }
    }
  });

  test("Maintain is exempt: it leans on credit down to the minimum, and no further", () => {
    // Heavy pressing with triceps at a Maintain target of 6, where the rule would ask for 3.
    const muscles = ["chest", "shoulders", "triceps"].map(byId);
    const targets = new Map([["chest", 10], ["shoulders", 10], ["triceps", 6]]);
    const asMaintain = app.directSetsFor(targets, muscles, new Map([["triceps", "maintain"]]), 3);
    expect(asMaintain.direct.get("triceps")).toBe(app.WORKOUT.minDirectSets);
    const asNormal = app.directSetsFor(targets, muscles, new Map([["triceps", "normal"]]), 3);
    expect(asNormal.direct.get("triceps")).toBe(Math.ceil(6 * half));
  });

  test("a muscle no one credits books its whole target directly", () => {
    const targets = targetsAt("normal");
    const { direct, credit } = app.directSetsFor(targets, all, new Map(), 4);
    for (const id of ["chest", "quads", "hamstrings", "calves", "abs"]) {
      expect(credit.get(id), id).toBe(0);
      expect(direct.get(id), id).toBe(targets.get(id));
    }
  });

  test("a target of zero books nothing", () => {
    const { direct } = app.directSetsFor(new Map([["chest", 0]]), [byId("chest")]);
    expect(direct.get("chest")).toBe(0);
  });
});

describe("the time model's rest", () => {
  const { workSetMinutes, restCompoundMinutes, restIsolationMinutes, setupMinutes } = app.ESTIMATE;
  const oneSet = rest => workSetMinutes + rest + setupMinutes;

  test("a muscle with no compound in the catalogue is timed at isolation rest, as its sessions are", () => {
    for (const id of ["biceps", "calves", "abs", "traps", "forearms", "adductors", "obliques", "lower-back"]) {
      expect(app.EXERCISES.some(e => e.compound && e.trainsPrimarily(id)), id).toBe(false);
      expect(app.muscleSessionMinutes(1, id), id).toBeCloseTo(oneSet(restIsolationMinutes));
    }
  });

  test("a muscle with compounds, or none named, keeps compound rest: never under-counted", () => {
    for (const id of ["chest", "quads", "lats", "hamstrings", "triceps"])
      expect(app.muscleSessionMinutes(1, id), id).toBeCloseTo(oneSet(restCompoundMinutes));
    expect(app.muscleSessionMinutes(1)).toBeCloseTo(oneSet(restCompoundMinutes));
  });
});
