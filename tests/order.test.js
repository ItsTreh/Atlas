/* The order exercises are done in, and how hard each set is taken. */
import { describe, expect, test } from "vitest";
import { loadApp, generatedWeek } from "./load-app.js";

const app = loadApp();
const entry = (name, muscleId, sets = 3) =>
  new app.WorkoutEntry(app.EXERCISE_BY_NAME.get(name), muscleId, sets);
const names = list => list.map(e => e.exercise.name);

describe("order inside a session", () => {
  test("a lift goes before the lift that trains its helper muscle", () => {
    // The press works the triceps as a helper, so it comes before the pushdown
    // however they were listed.
    const press = entry("Machine Chest Press", "chest");
    const ext = entry("Overhead Cable Triceps Extension", "triceps");
    expect(app.tires(press.exercise, ext.exercise)).toBe(true);
    expect(names(app.orderEntries([ext, press]))).toEqual([press.exercise.name, ext.exercise.name]);
  });

  test("Focus muscles go first when nothing depends on anything", () => {
    const raise = entry("Cable Lateral Raise", "shoulders");
    const curl = entry("Hammer Grip Preacher Curl", "biceps");
    expect(app.tires(raise.exercise, curl.exercise) || app.tires(curl.exercise, raise.exercise)).toBe(false);
    const focus = id => (id === "biceps" ? "focus" : "normal");
    expect(names(app.orderEntries([raise, curl], focus))[0]).toBe(curl.exercise.name);
    expect(names(app.orderEntries([raise, curl]))[0]).toBe(raise.exercise.name);   // same kind and tier: listed order
  });

  test("compounds come before isolation lifts at equal priority", () => {
    const iso = entry("Cable Lateral Raise", "shoulders");
    const press = entry("Machine Chest Press", "chest");
    expect(names(app.orderEntries([iso, press]))[0]).toBe(press.exercise.name);
  });

  test("lifts that tire each other keep the order they were picked in", () => {
    const pairs = app.EXERCISES.flatMap(a => app.EXERCISES.filter(b => a.id < b.id && app.tiresBothWays(a, b))
      .map(b => [a, b]));
    expect(pairs.length).toBeGreaterThan(0);
    const [a, b] = pairs[0];
    const mk = ex => new app.WorkoutEntry(ex, ex.primary[0], 3);
    expect(app.orderEntries([mk(a), mk(b)]).map(e => e.exercise)).toHaveLength(2);
  });
});

describe("every planned session respects the order", () => {
  for (const program of ["full-body", "push", "pull", "legs", "upper", "lower"]) {
    test(program, () => {
      for (const [sessions, minutes] of [[3, 60], [4, 90], [5, 75]]) {
        const { routine } = generatedWeek(app, { program, sessions, minutes });
        for (const s of routine.sessions) {
          const list = s.workout.entries;
          list.forEach((later, j) => list.slice(0, j).forEach(earlier => {
            // nothing earlier may be one that should have come after `later`
            const mustBeAfter = app.tires(later.exercise, earlier.exercise) &&
                                !app.tires(earlier.exercise, later.exercise);
            expect(mustBeAfter, earlier.exercise.name + " before " + later.exercise.name).toBe(false);
          }));
        }
      }
    });
  }

  test("a restored session keeps the planned order", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2, minutes: 75 });
    const w = routine.sessions[0].workout;
    const planned = names(w.entries);
    w.remove(w.entries[0]);
    w.restore();
    expect(names(w.entries)).toEqual(planned);
  });
});

describe("effort", () => {
  test("compounds stop a little short of failure, isolation lifts go closer", () => {
    expect(entry("Machine Chest Press", "chest").reserve).toBe(app.configValue("rirCompound"));
    expect(entry("Cable Lateral Raise", "shoulders").reserve).toBe(app.configValue("rirIsolation"));
  });

  test("the effort values are registered as heuristics based on the failure research", () => {
    for (const key of ["rirCompound", "rirIsolation"]) {
      const p = app.PLANNER_CONFIG[key];
      expect(p.origin).toBe("heuristic");
      expect(p.basedOn).toContain("proximity-to-failure");
    }
  });
});
