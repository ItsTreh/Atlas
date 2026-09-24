/* Workouts: selected muscles become practical, tier-led, non-redundant sessions. */
import { describe, expect, test } from "vitest";
import { loadApp, generatedWeek } from "./load-app.js";

const app = loadApp();
const PROGRAMS = ["full-body", "upper", "lower", "push", "pull", "legs",
                  "chest-triceps", "back-biceps", "shoulders-arms"];

describe.each(PROGRAMS)("%s", program => {
  const cases = [[2, 45], [3, 60], [5, 90]];

  test.each(cases)("%i sessions of %i min: exercises fit the session", (sessions, minutes) => {
    const { routine } = generatedWeek(app, { program, sessions, minutes });
    expect(routine.sessions.length).toBeGreaterThan(0);

    for (const s of routine.sessions) {
      const muscles = s.block.muscles.map(m => m.id);
      const movements = s.workout.entries.map(e => e.exercise.movement);

      // every exercise is there for one of the session's muscles, and trains it
      for (const e of s.workout.entries) {
        expect(muscles).toContain(e.muscleId);
        expect(e.exercise.trainsPrimarily(e.muscleId)).toBe(true);
      }
      // never the same movement twice, never the same exercise twice
      expect(new Set(movements).size).toBe(movements.length);
      // the plan fits the session the user asked for
      expect(s.workout.minutes).toBeLessThanOrEqual(minutes);
    }
  });
});

describe("priorities", () => {
  test("the best tier comes first", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2 });
    const chest = routine.sessions[0].workout.entriesFor("chest");
    expect(chest[0].exercise.name).toBe("Machine Chest Press");   // the only S+
  });

  test("not every exercise for a muscle is used", () => {
    const { routine } = generatedWeek(app, { program: "chest-triceps", sessions: 2 });
    const chestSlots = routine.sessions.flatMap(s => s.workout.entriesFor("chest"));
    expect(chestSlots.length).toBeLessThan(app.exercisesFor("chest").length);
  });

  test("the week rotates between equal alternatives", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2 });
    const names = s => s.workout.entries.map(e => e.exercise.name).join();
    expect(names(routine.sessions[0])).not.toBe(names(routine.sessions[1]));
  });

  test("assisting work lowers what small muscles need directly", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2 });
    const w = routine.sessions[0].workout;
    expect(w.assistedSets("triceps")).toBeGreaterThan(0);
  });
});

describe("muscles with no exercises", () => {
  test("never get a session of their own while anything else is selected", () => {
    for (const program of ["pull", "legs", "full-body", "lower"]) {
      const { routine } = generatedWeek(app, { program, sessions: 5 });
      for (const s of routine.sessions) expect(s.workout.entries.length).toBeGreaterThan(0);
    }
  });

  test("still ride along in a related session", () => {
    const { routine } = generatedWeek(app, { program: "pull", sessions: 3 });
    const planned = new Set(routine.sessions.flatMap(s => s.block.muscles.map(m => m.id)));
    expect(planned.has("traps")).toBe(true);
    expect(planned.has("forearms")).toBe(true);
  });
});

describe("user control", () => {
  test("replace, remove, add and restore", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2 });
    const w = routine.sessions[0].workout;
    const original = w.entries.map(e => e.exercise.name);

    // Adding a second flat press is allowed, but flagged against the first.
    const bench = app.EXERCISE_BY_NAME.get("Bench Press");
    w.add("chest", bench);
    expect(w.clashWith(bench).exercise.name).toBe("Machine Chest Press");

    const dips = app.EXERCISE_BY_NAME.get("Dips");
    w.replace(w.entries[0], dips);
    expect(w.entries[0].exercise).toBe(dips);
    expect(w.entries[0].manual).toBe(true);
    expect(w.edited).toBe(true);

    w.remove(w.entries[1]);
    expect(w.entries.length).toBe(original.length);   // one added, one removed

    w.restore();
    expect(w.entries.map(e => e.exercise.name)).toEqual(original);
    expect(w.edited).toBe(false);
  });
});
