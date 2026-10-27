/* A set is counted one way. creditWeight / countedSets (volume.js) say how, and
   the workout, the week and the builder all read them, so what a session
   credits a muscle, what the week reports and what the builder aims at are
   the same number. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { loadApp, generatedWeek } from "./load-app.js";

const app = loadApp();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("how one set counts for a muscle", () => {
  test("1 for a primary, the secondary credit for an assisting muscle, 0 otherwise", () => {
    expect(app.WORKOUT.secondaryCredit).toBe(0.5);
    for (const ex of app.EXERCISES) for (const m of app.MUSCLES) {
      const expected = ex.primary.includes(m.id) ? 1 : ex.secondary.includes(m.id) ? app.WORKOUT.secondaryCredit : 0;
      expect(app.creditWeight(ex, m.id), ex.name + " for " + m.id).toBe(expected);
    }
  });

  test("no exercise lists a muscle as both a primary and a secondary", () => {
    // creditWeight would count it once, as a primary; direct + assisting would count it twice.
    for (const ex of app.EXERCISES) for (const id of ex.primary) expect(ex.secondary, ex.name).not.toContain(id);
  });

  test("a squat done for the quads counts for the glutes too, and half for the adductors", () => {
    const squat = app.EXERCISE_BY_NAME.get("Barbell Back Squat");
    const entries = [{ exercise: squat, muscleId: "quads", sets: 4 }];
    expect(app.countedSets(entries, "quads")).toBe(4);
    expect(app.countedSets(entries, "glutes")).toBe(4);
    expect(app.countedSets(entries, "chest")).toBe(0);
    expect(app.countedSets([], "quads")).toBe(0);
  });
});

describe("the workout, the week and the builder count alike", () => {
  const WEEKS = [
    { program: "full-body", sessions: 4, minutes: 60 }, { program: "upper", sessions: 5, minutes: 75 },
    { program: "legs", sessions: 3, minutes: 90 }, { program: "push", sessions: 2, minutes: 45 },
    { program: "chest-triceps", sessions: 4, minutes: 60 }, { program: "back-biceps", sessions: 3, minutes: 60 }
  ];

  test("counted = direct + assisting, for every muscle of every session", () => {
    for (const opts of WEEKS) {
      const { routine } = generatedWeek(app, opts);
      for (const s of routine.sessions) for (const m of app.MUSCLES) {
        const w = s.workout;
        expect(w.counted(m.id), opts.program + " " + s.day + " " + m.id)
          .toBe(w.directSets(m.id) + w.assistedSets(m.id));
      }
    }
  });

  test("the week reports what the sessions credit, and the builder sums the same", () => {
    for (const opts of WEEKS) {
      const { routine } = generatedWeek(app, opts);
      const builder = new app.WorkoutBuilder(routine.sessions, opts.minutes, routine.plannedWeeklySets());
      for (const row of routine.weeklyVolume().rows) {
        const fromSessions = routine.sessions.reduce((t, s) => t + app.countedSets(s.workout.entries, row.muscle.id), 0);
        expect(row.sets, opts.program + " " + row.muscle.id).toBe(fromSessions);
        expect(builder.weekCredit(row.muscle.id), opts.program + " " + row.muscle.id).toBe(fromSessions);
      }
    }
  });
});

describe("the half-credit rule is written in one place", () => {
  // A second copy of "primary counts 1, assisting counts secondaryCredit" is how
  // two parts of the planner end up disagreeing, so the rule is read from
  // creditWeight everywhere else. The value itself is configured in evidence.js
  // and handed to the planner in WORKOUT (workouts.js).
  test("WORKOUT.secondaryCredit is only read in volume.js", () => {
    const readers = fs.readdirSync(path.join(ROOT, "js")).filter(f => f.endsWith(".js"))
      .filter(f => fs.readFileSync(path.join(ROOT, "js", f), "utf8").includes("WORKOUT.secondaryCredit"));
    expect(readers).toEqual(["volume.js"]);
  });

  test("no other file decides primary or assisting weight by hand", () => {
    const hand = /\.primary\.includes\([^)]*\)\s*\?\s*1\b|e\.exercise\.assists\(|ex\.assists\(/;
    const offenders = fs.readdirSync(path.join(ROOT, "js")).filter(f => f.endsWith(".js") && f !== "exercises.js")
      .filter(f => hand.test(fs.readFileSync(path.join(ROOT, "js", f), "utf8")));
    expect(offenders).toEqual([]);
  });
});
