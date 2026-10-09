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
    expect(app.weekReasons(routine).join(" ")).toMatch(/Not everything fits/);
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
    expect(app.sessionReasons(routine, s)[0]).toMatch(/triceps as a helper/);
  });

  test("a session with no exercises has no reasons", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2 });
    const s = routine.sessions[0];
    s.workout.entries = [];
    expect(app.sessionReasons(routine, s)).toEqual([]);
  });
});
