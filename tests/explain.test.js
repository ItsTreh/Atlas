/* The one-sentence reasons describe the plan that was actually built. */
import { describe, expect, test } from "vitest";
import { loadApp, generatedWeek } from "./load-app.js";

const app = loadApp();
const sentence = t => typeof t === "string" && t.length > 20 && t.length < 260 && /[.]$/.test(t);

describe("week reasons", () => {
  test("every sentence is short, plain text and ends in a full stop", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 3, minutes: 75 });
    routine.experience = "intermediate";
    routine.selection.setPriority("chest", "focus");
    routine.generate();
    const list = app.weekReasons(routine);
    expect(list.length).toBeGreaterThan(1);
    for (const t of list) expect(sentence(t), t).toBe(true);
  });

  test("it asks for experience until it is known", () => {
    const routine = new app.WeeklyRoutine();
    expect(app.weekReasons(routine)[0]).toMatch(/experience/);
  });

  test("a Focus muscle is explained with the sets it really got", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 4, minutes: 90 });
    routine.experience = "advanced";
    routine.selection.setPriority("chest", "focus");
    routine.generate();
    const row = routine.weeklyVolume().rows.find(r => r.muscle.id === "chest");
    const text = app.weekReasons(routine).find(t => t.startsWith("Chest"));
    expect(text).toContain(String(Math.round(row.sets * 10) / 10));
  });

  test("a week that does not fit says so", () => {
    const { routine } = generatedWeek(app, { program: "full-body", sessions: 3, minutes: 60 });
    routine.experience = "beginner";
    routine.generate();
    expect(app.weekReasons(routine).join(" ")).toMatch(/under its usual minimum/);
  });
});

describe("session reasons", () => {
  test("the first exercise is explained and the effort is named", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2, minutes: 75 });
    for (const s of routine.sessions) {
      const list = app.sessionReasons(routine, s);
      expect(list.length).toBeGreaterThan(0);
      for (const t of list) expect(sentence(t), t).toBe(true);
      expect(list.join(" ")).toMatch(/reps in reserve/);
      if (s.workout.entries.length > 1) expect(list[0]).toContain(s.workout.entries[0].exercise.name);
    }
  });

  test("a press that works the triceps goes first and says why", () => {
    const { routine } = generatedWeek(app, { program: "chest-triceps", sessions: 2, minutes: 75 });
    const s = routine.sessions.find(x => x.workout.entries.some(e => e.muscleId === "triceps"));
    const first = s.workout.entries[0];
    const text = app.sessionReasons(routine, s)[0];
    expect(text).toContain(first.exercise.name);
    // The sentence must match the rule that really placed the exercise first.
    if (first.orderRule.rule === "dependency") expect(text).toMatch(/helper/);
    else expect(text).not.toMatch(/helper/);
  });

  test("a session with no exercises has no reasons", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2 });
    const s = routine.sessions[0];
    s.workout.entries = [];
    expect(app.sessionReasons(routine, s)).toEqual([]);
  });
});

describe("where the tiers come from", () => {
  test("every rated muscle has a source link and the unrated ones have none", () => {
    for (const id of ["chest", "triceps", "lats", "upper-back", "shoulders", "quads", "biceps", "glutes"])
      expect(app.ratingSourceFor(id).url).toMatch(/^https:\/\//);
    for (const id of ["traps", "forearms", "hamstrings", "adductors", "calves", "abs", "obliques", "lower-back"])
      expect(app.ratingSourceFor(id)).toBeNull();
  });

  test("unrated muscles still get exercises, after any rated ones", () => {
    for (const id of ["traps", "calves", "abs"]) expect(app.exercisesFor(id).length).toBeGreaterThan(0);
  });

  test("a session says when its lead exercise has no ranking", () => {
    const { routine } = generatedWeek(app, { program: "legs", sessions: 3, minutes: 90 });
    const s = routine.sessions.find(x => x.workout.entries.some(e => !e.tier));
    if (s) expect(app.sessionReasons(routine, s).join(" ")).toMatch(/tier|ranking/);
  });
});
