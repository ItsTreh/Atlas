/* Set credit (set-credit.js): exercise-specific estimates where growth was
   measured, checked against the whole catalogue before the planner reads them. */
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp();
const MUSCLE_IDS = app.MUSCLES.map(m => m.id);
const flat = (ex, id) => ex.trainsPrimarily(id) ? 1 : ex.assists(id) ? app.WORKOUT.secondaryCredit : 0;
const byMovement = m => app.EXERCISES.filter(e => e.movement === m);

describe("the table", () => {
  test("loads with no data errors", () => {
    expect(app.errors).toEqual([]);
  });

  test("every row is on the scale, cites findings that exist, and says why a zero is zero", () => {
    for (const row of app.SET_CREDIT) {
      const name = row.movements.join("/") + " → " + (row.muscle || row.region);
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
      "Barbell Back Squat: adductors 0.5 → 0",
      "Hack Squat: glutes 0.5 → 1",
      "Pendulum Squat: glutes 0.5 → 1",
      "Smith Machine Squat: adductors 0.5 → 0",
      "Barbell Front Squat: glutes 0.5 → 1",
      "Low-Bar Squat: hamstrings 0.5 → 0",
      "Low-Bar Squat: glutes 0.5 → 1",
      "45-Degree Back Extension: hamstrings 0.5 → 1",
      "Machine Hip Thrust: hamstrings 0.5 → 0",
      "Single-Leg Dumbbell Hip Thrust: hamstrings 0.5 → 0",
      "Seated Calf Raise: calves 1 → 0.25"
    ]);
  });

  test("a pair with no row keeps the flat default and says so", () => {
    const fly = app.EXERCISE_BY_NAME.get("Pec Deck");
    expect(app.setCredit(fly, "chest")).toMatchObject({ credit: 1, tier: null, row: null });
    const lunge = app.EXERCISE_BY_NAME.get("Walking Lunge");      // lunges were not measured
    expect(app.setCredit(lunge, "hamstrings")).toMatchObject({ credit: app.WORKOUT.secondaryCredit, row: null });
  });

  test("measured pairs carry their tier", () => {
    const bench = app.EXERCISE_BY_NAME.get("Bench Press");
    expect(app.setCredit(bench, "triceps")).toMatchObject({ credit: 0.5, tier: "B" });
    expect(app.setCredit(app.EXERCISE_BY_NAME.get("Seated Calf Raise"), "calves")).toMatchObject({ credit: 0.25, tier: "B" });
    expect(app.setCredit(app.EXERCISE_BY_NAME.get("45-Degree Leg Press"), "glutes")).toMatchObject({ credit: 0.5, tier: "B+D" });
  });
});

/* The user's decision, 2026-10-29. The adductor magnus selects Hamstrings
   (unchanged). Its squat stimulus is stored at the magnus and credited to
   neither Hamstrings nor Adductors until the app can hold sub-regions. A zero
   here means too little evidence for the current group mapping, not zero
   activation or growth. */
describe("the adductor magnus", () => {
  test("still selects Hamstrings", () => {
    expect(app.ANATOMY_REGIONS["adductor-magnus"]).toBe("hamstrings");
  });

  test.each(byMovement("squat").map(e => [e.name]))("%s credits it to neither group", name => {
    const ex = app.EXERCISE_BY_NAME.get(name);
    const adductors = app.setCredit(ex, "adductors");
    expect(adductors.credit).toBe(0);
    expect(adductors.row.zero).toBe("unassigned");      // insufficient evidence for the mapping, not no growth
    const hamstrings = app.setCredit(ex, "hamstrings");
    expect(hamstrings.credit).toBe(0);
    expect(hamstrings.row.zero).toBe("measured");       // the true hamstrings did not grow (Kubo)
  });

  test("its squat and leg press stimulus is kept at the magnus", () => {
    const kept = app.SET_CREDIT.filter(r => r.region === "adductor-magnus");
    expect(kept.map(r => [r.movements, r.estimate])).toEqual([[["squat"], 1], [["leg-press"], 0.5]]);
    for (const r of app.SET_CREDIT.filter(r => r.region)) expect(app.ANATOMY_REGIONS[r.region]).toBeTruthy();
  });
});

describe("the planner", () => {
  test("still counts the flat default", () => {
    const w = new app.Workout([], [{ exercise: app.EXERCISE_BY_NAME.get("Barbell Back Squat"), muscleId: "quads", sets: 3 }]);
    expect(w.assistedSets("adductors")).toBe(3 * app.WORKOUT.secondaryCredit);
  });
});
