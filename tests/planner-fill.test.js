/* The week uses the time it is given for volume that is still useful, counts
   every set one way in every stage, and never passes a limit to do it. */
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp();
const REFERENCE = ["shoulders", "triceps", "traps", "upper-back", "lats", "biceps", "forearms",
                   "quads", "hamstrings", "glutes", "adductors", "calves", "lower-back"];

function week({ muscles = [], program, days = 4, minutes = 90, experience = "intermediate", priority } = {}) {
  const r = new app.WeeklyRoutine();
  if (program) r.selection.applyProgram(app.PROGRAM_BY_ID.get(program));
  for (const id of muscles) r.selection.set(id, true);
  if (priority) for (const m of r.selection.muscles()) r.selection.setPriority(m.id, priority);
  Object.assign(r, { experience, sessionsPerWeek: days, sessionMinutes: minutes, preferredWindow: "evening" });
  r.generate();
  return r;
}
const counted = (r, id) => r.sessions.reduce((t, s) => t + s.workout.countedSets(id), 0);
const used = r => r.sessions.reduce((t, s) => t + s.workout.minutes, 0) / (r.sessions.length * r.sessionMinutes);

describe("the reference week (13 muscles, intermediate, 4 x 90 min)", () => {
  const r = week({ muscles: REFERENCE });

  test("uses at least 88% of the time and no session runs past 90 min", () => {
    expect(r.sessions.length).toBe(4);
    for (const s of r.sessions) expect(s.workout.minutes).toBeLessThanOrEqual(90);
    expect(used(r)).toBeGreaterThanOrEqual(0.88);
  });

  test("every muscle reaches its goal, or the audit names why not", () => {
    const audit = r.audit();
    for (const row of audit.rows) {
      if (row.status === "short") expect(row.causes.length, row.muscle.id).toBeGreaterThan(0);
      expect(row.unexplained, row.muscle.id).toBeLessThan(0.001);
    }
  });
});

describe("one way of counting sets", () => {
  test("a set counts 1 for a primary, the secondary credit for a helper, 0 otherwise", () => {
    const squat = app.EXERCISE_BY_NAME.get("Barbell Back Squat");
    expect(app.creditWeight(squat, "quads")).toBe(1);
    expect(app.creditWeight(squat, "glutes")).toBe(1);
    expect(app.creditWeight(squat, "adductors")).toBe(app.WORKOUT.secondaryCredit);
    expect(app.creditWeight(squat, "chest")).toBe(0);
  });

  test("weeklyVolume, the audit and the sessions report the same counted sets", () => {
    const r = week({ program: "full-body", days: 4, minutes: 75 });
    const rows = r.weeklyVolume().rows, audit = r.audit().rows;
    for (const row of rows) {
      expect(row.sets, row.muscle.id).toBeCloseTo(counted(r, row.muscle.id), 6);
      expect(audit.find(a => a.muscle === row.muscle).finalTotalCredit).toBeCloseTo(row.sets, 6);
    }
  });

  test("the time budget takes the expected credit off once", () => {
    // The lats' rows train the upper back as a primary too, so the upper back
    // needs fewer sets of its own than its target, and the pair costs less
    // than two muscles trained apart.
    const both = app.plannedWork(new Map([["lats", 12], ["upper-back", 12]]));
    const lats = app.plannedWork(new Map([["lats", 12]])), back = app.plannedWork(new Map([["upper-back", 12]]));
    expect(both.performed.get("upper-back")).toBeLessThan(12);
    expect(both.performed.get("upper-back")).toBeGreaterThanOrEqual(app.WORKOUT.minDirectSets);
    expect(both.minutes).toBeLessThan(lats.minutes + back.minutes);
    // A muscle fully covered still keeps one exercise of its own.
    const covered = app.plannedWork(new Map([["chest", 16], ["triceps", 2]]));
    expect(covered.performed.get("triceps")).toBe(app.WORKOUT.minDirectSets);
  });
});

describe("filling the time without padding it", () => {
  test("no muscle passes its goal by more than one exercise's worth when time is left", () => {
    for (const program of ["upper", "lower", "full-body"]) for (const days of [3, 4]) {
      const r = week({ program, days, minutes: 90, experience: "beginner" });
      const goals = r.weeklyGoals();
      for (const [id, goal] of goals) {
        const filled = r.planned.gains.get(id);
        if (filled && filled.own > 0)                       // the fill pass added to it
          expect(counted(r, id), program + days + id).toBeLessThanOrEqual(goal + app.WORKOUT.setsPerExercise);
      }
    }
  });

  test("a session that ends well early says why", () => {
    for (const program of ["legs", "lower", "full-body"]) for (const days of [3, 5, 7]) {
      const r = week({ program, days, minutes: 90, experience: "advanced" });
      for (const s of r.sessions) if (r.sessionMinutes - s.workout.minutes >= 10)
        expect(app.sessionReasons(r, s).join(" "), program + days + s.day).toMatch(/ends about \d+ min early/);
    }
  });

  test("a 90-minute leg day with quads, hamstrings and glutes has 6 exercises unless its muscles are at their goal", () => {
    for (const program of ["legs", "lower", "full-body"]) for (const days of [2, 3, 4, 5, 6, 7])
      for (const experience of ["beginner", "intermediate", "advanced"]) {
        const r = week({ program, days, minutes: 90, experience });
        const audit = r.audit().rows;
        for (const s of r.sessions) {
          const ids = s.block.muscles.map(m => m.id);
          if (!["quads", "hamstrings", "glutes"].every(id => ids.includes(id))) continue;
          if (s.workout.entries.length >= 6) continue;
          const short = s.block.muscles.filter(m => audit.find(a => a.muscle === m)?.status === "short");
          const text = app.sessionReasons(r, s).join(" ");
          expect(short.length === 0 || /could not take more/.test(text), [program, days, experience, s.day].join(" ")).toBe(true);
          expect(text).toMatch(/ends about/);
        }
      }
  });
});

describe("limits that hold in every pass", () => {
  const cases = [];
  for (const program of ["full-body", "upper", "lower", "legs", "pull"]) for (const days of [1, 3, 5, 7])
    for (const minutes of [45, 90]) for (const priority of ["maintain", "focus"]) cases.push([program, days, minutes, priority]);

  test.each(cases)("%s, %i days x %i min, %s", (program, days, minutes, priority) => {
    const r = week({ program, days, minutes, experience: "advanced", priority });
    const audit = r.audit();
    const flagged = new Set(audit.issues.map(i => i.muscleId));
    for (const s of r.sessions) {
      expect(s.workout.minutes).toBeLessThanOrEqual(minutes);
      expect(app.axialCount(s.workout.entries)).toBeLessThanOrEqual(app.WORKOUT.maxAxialPerSession);
    }
    for (const row of audit.rows) {
      const id = row.muscle.id;
      // the weekly maximum, counting assisting credit
      expect(counted(r, id), id).toBeLessThanOrEqual(row.muscle.weeklySets[1] + 1e-9);
      // a chosen muscle without an exercise of its own, or under its minimum, is never silent
      if (!row.directWork || row.belowMinimum) expect(flagged.has(id), id).toBe(true);
    }
  });
});

describe("determinism", () => {
  test("the same inputs give the same week, in a fresh copy of the app too", () => {
    const sig = a => {
      const r = new a.WeeklyRoutine();
      for (const id of REFERENCE) r.selection.set(id, true);
      Object.assign(r, { experience: "intermediate", sessionsPerWeek: 4, sessionMinutes: 90 });
      r.generate();
      return r.sessions.map(s => s.day + s.startHour + ":" +
        s.workout.entries.map(e => e.exercise.id + "x" + e.sets).join(",")).join("|");
    };
    const first = sig(app);
    expect(sig(app)).toBe(first);
    expect(sig(loadApp())).toBe(first);
  });
});
