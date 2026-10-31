/* Set credit (set-credit.js): exercise-specific estimates where growth was
   measured, checked against the whole catalogue before the planner reads them. */
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp();
const MUSCLE_IDS = app.MUSCLES.map(m => m.id);
const flat = (ex, id) => ex.trainsPrimarily(id) ? 1 : ex.assists(id) ? app.WORKOUT.secondaryCredit : 0;
const byMovement = m => app.EXERCISES.filter(e => e.movement === m);
const exercise = name => app.EXERCISE_BY_NAME.get(name);

describe("the table", () => {
  test("loads with no data errors", () => {
    expect(app.errors).toEqual([]);
  });

  test("every row is on the scale, cites findings that exist, and says why a zero is zero", () => {
    for (const row of app.SET_CREDIT) {
      const name = row.exercises.join("/") + " → " + (row.muscle || row.region);
      expect(row.basedOn.length, name).toBeGreaterThan(0);
      for (const id of row.basedOn) expect(app.EVIDENCE_BY_ID.has(id), name).toBe(true);
      if (row.region) { expect(app.CREDIT_STEPS, name).toContain(row.estimate); continue; }
      expect(app.CREDIT_STEPS, name).toContain(row.credit);
      if (row.credit === 0) expect(["measured", "unassigned"], name).toContain(row.zero);
      else expect(row.zero, name).toBeUndefined();
    }
  });

  test("the planner table entry cites exactly the findings the rows use", () => {
    const used = new Set(app.SET_CREDIT.flatMap(r => r.basedOn));
    expect(new Set(app.PLANNER_TABLES.setCredit.basedOn)).toEqual(used);
    expect(app.PLANNER_TABLES.setCredit.origin).not.toBe("evidence");   // the scale is ATLAS's choice
  });
});

describe("against the catalogue", () => {
  test("every exercise gives every muscle one credit on the scale, and none it doesn't list", () => {
    const steps = new Set([...app.CREDIT_STEPS, app.WORKOUT.secondaryCredit]);
    const out = [];
    for (const ex of app.EXERCISES)
      for (const id of MUSCLE_IDS) {
        const { credit } = app.setCredit(ex, id);
        if (!steps.has(credit)) out.push(ex.name + ": " + id + " " + credit + " is off the scale");
        if (credit > 0 && !ex.trainsPrimarily(id) && !ex.assists(id)) out.push(ex.name + ": " + id + " is not listed");
      }
    expect(out).toEqual([]);
  });

  /* What the planner will see change once it reads the table: every pair whose
     credit differs from today's flat 1 / 0.5. Everything else is unchanged. */
  test("only these credits differ from the flat default", () => {
    const changed = [];
    for (const ex of app.EXERCISES)
      for (const id of MUSCLE_IDS) {
        const now = flat(ex, id), next = app.setCredit(ex, id).credit;
        if (now !== next) changed.push(ex.name + ": " + id + " " + now + " → " + next);
      }
    expect(changed).toEqual([
      "Seated Calf Raise: calves 1 → 0.25"
    ]);
  });

  test("a pair with no row keeps the flat default and says so", () => {
    expect(app.setCredit(exercise("Pec Deck"), "chest")).toMatchObject({ credit: 1, tier: null, row: null });
    // lunges were not measured
    expect(app.setCredit(exercise("Walking Lunge"), "hamstrings")).toMatchObject({ credit: app.WORKOUT.secondaryCredit, row: null });
  });

  /* The user's rule, 2026-10-30: a row applies to the exercise that was
     measured. Variants of a measured movement keep the flat default. */
  test.each([
    ["Hack Squat", "glutes"], ["Pendulum Squat", "glutes"], ["Barbell Front Squat", "glutes"],
    ["Low-Bar Squat", "glutes"], ["Low-Bar Squat", "hamstrings"],
    ["45-Degree Leg Press", "glutes"],                        // the trial used a seated leg press
    ["Machine Hip Thrust", "hamstrings"], ["Single-Leg Dumbbell Hip Thrust", "hamstrings"],
    ["Incline Bench Press", "triceps"], ["Leg Press Calf Raise", "calves"]
  ])("%s → %s was not measured and keeps the flat default", (name, id) => {
    const ex = exercise(name);
    expect(app.setCredit(ex, id)).toMatchObject({ credit: flat(ex, id), row: null });
  });

  test("measured pairs carry their tier; ATLAS's choices on the value say so", () => {
    expect(app.setCredit(exercise("Bench Press"), "triceps")).toMatchObject({ credit: 0.5, tier: "B" });
    expect(app.setCredit(exercise("Seated Calf Raise"), "calves")).toMatchObject({ credit: 0.25, tier: "B+D" });
    expect(app.setCredit(exercise("Wide-Grip Lat Pulldown"), "biceps")).toMatchObject({ credit: 0.5, tier: "B+D" });
    // one trial read in abstract only: held at the flat 0.5 (the user's call, 2026-10-30)
    expect(app.setCredit(exercise("45-Degree Back Extension"), "hamstrings")).toMatchObject({ credit: 0.5, tier: "B+D" });
  });
});

/* The user's decisions, 2026-10-29 and 2026-10-30. The adductor magnus
   selects Hamstrings (unchanged). Its back squat stimulus is kept at the
   magnus and credited to no group until the app can hold sub-regions;
   Adductors takes the flat default in every squat, since squats do work the
   adductors (the Smith machine squat lists them too). */
describe("the adductor magnus", () => {
  test("still selects Hamstrings", () => {
    expect(app.ANATOMY_REGIONS["adductor-magnus"]).toBe("hamstrings");
  });

  test("its back squat stimulus is kept at the magnus, for no group", () => {
    const kept = app.SET_CREDIT.filter(r => r.region === "adductor-magnus");
    expect(kept.map(r => [r.exercises, r.estimate])).toEqual([[["Barbell Back Squat"], 1]]);
    for (const r of app.SET_CREDIT.filter(r => r.region)) expect(app.ANATOMY_REGIONS[r.region]).toBeTruthy();
  });

  test.each(byMovement("squat").filter(e => e.assists("adductors")).map(e => [e.name]))(
    "%s credits Adductors the flat default", name => {
      expect(app.setCredit(exercise(name), "adductors")).toMatchObject({ credit: app.WORKOUT.secondaryCredit, row: null });
    });

  test("the true hamstrings get 0 from the back squat: measured, not unassigned", () => {
    expect(app.setCredit(exercise("Barbell Back Squat"), "hamstrings").row.zero).toBe("measured");   // Kubo
  });
});

describe("the planner", () => {
  test("still counts the flat default", () => {
    const w = new app.Workout([], [{ exercise: exercise("Barbell Back Squat"), muscleId: "quads", sets: 3 }]);
    expect(w.assistedSets("adductors")).toBe(3 * app.WORKOUT.secondaryCredit);
  });
});
