/* The training log and the exercise preferences: shape, cleaning, saving. */
import { describe, expect, test } from "vitest";
import { loadApp, generatedWeek } from "./load-app.js";

const app = loadApp();

describe("a set", () => {
  test("keeps what is sensible and drops what is not", () => {
    const s = new app.SetLog({ load: 62.5, reps: 8.4, reserve: 2, difficulty: "hard", done: true });
    expect(s.snapshot()).toEqual({ load: 62.5, reps: 8, reserve: 2, difficulty: "hard", done: true });
    const bad = new app.SetLog({ load: -3, reps: "ten", reserve: 99, difficulty: "meh", done: "yes" });
    expect(bad.snapshot()).toEqual({ load: null, reps: null, reserve: null, difficulty: null, done: false });
  });
  test("a blank set is not done", () => {
    expect(new app.SetLog().done).toBe(false);
  });
});

describe("a session log", () => {
  test("is made from the planned session, every set not yet done", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2, minutes: 75 });
    const s = routine.sessions[0];
    const log = app.logForSession(s, "2026-10-12");
    expect(log.plannedSets).toBe(s.workout.sets);
    expect(log.doneSets).toBe(0);
    expect(log.compliance).toBe(0);
    expect(log.entries.map(e => e.exerciseId)).toEqual(s.workout.entries.map(e => e.exercise.id));
  });

  test("compliance is sets done over sets planned", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2, minutes: 75 });
    const log = app.logForSession(routine.sessions[0], "2026-10-12");
    log.entries[0].sets[0].done = true;
    log.entries[0].sets[1].done = true;
    expect(log.compliance).toBeCloseTo(2 / log.plannedSets, 10);
    expect(new app.SessionLog({ date: "2026-10-12" }).compliance).toBeNull();
  });

  test("an exercise's history lists only done sets, oldest first", () => {
    const log = new app.TrainingLog();
    const set = (reps, done) => ({ reps, done });
    log.add(new app.SessionLog({ date: "2026-10-19", entries: [{ exerciseId: "bench-press", muscleId: "chest", sets: [set(8, true)] }] }));
    log.add(new app.SessionLog({ date: "2026-10-12", entries: [{ exerciseId: "bench-press", muscleId: "chest", sets: [set(6, true), set(5, false)] }] }));
    expect(log.history("bench-press").map(h => [h.date, h.set.reps])).toEqual([["2026-10-12", 6], ["2026-10-19", 8]]);
  });

  test("compliance over a date range", () => {
    const log = new app.TrainingLog();
    const sets = n => Array.from({ length: n }, (_, i) => ({ done: i < n / 2 }));
    log.add(new app.SessionLog({ date: "2026-10-12", entries: [{ exerciseId: "bench-press", muscleId: "chest", sets: sets(4) }] }));
    expect(log.compliance("2026-10-12", "2026-10-18")).toBe(0.5);
    expect(log.compliance("2026-11-01", "2026-11-07")).toBeNull();
  });
});

describe("saving and restoring", () => {
  test("a saved routine keeps its log and its dropped exercises", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2, minutes: 75 });
    const s = routine.sessions[0];
    const log = app.logForSession(s, "2026-10-12");
    log.entries[0].sets[0] = new app.SetLog({ load: 80, reps: 8, reserve: 2, difficulty: "right", done: true });
    routine.log.add(log);
    routine.exercisePrefs.discard("bench-press", "dislike");

    const other = new app.WeeklyRoutine();
    other.restore(JSON.parse(JSON.stringify(routine.snapshot())));
    expect(other.log.snapshot()).toEqual(routine.log.snapshot());
    expect(other.exercisePrefs.reasonFor("bench-press")).toBe("dislike");
  });

  test("an older save without these fields still restores", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2 });
    const snap = JSON.parse(JSON.stringify(routine.snapshot()));
    delete snap.log; delete snap.exercisePrefs;
    const other = new app.WeeklyRoutine();
    other.restore(snap);
    expect(other.log.sessions).toEqual([]);
    expect(other.sessions.length).toBeGreaterThan(0);
  });

  test("damaged log data loses only the damaged part", () => {
    const log = new app.TrainingLog();
    log.restore({ sessions: [
      null, { date: "nope" },
      { date: "2026-10-12", entries: [
        { exerciseId: "not-an-exercise", muscleId: "chest", sets: [{ done: true }] },
        { exerciseId: "bench-press", muscleId: "chest", sets: [{ reps: 5, done: true }, { reps: "x" }] }
      ] }
    ] });
    expect(log.sessions).toHaveLength(1);
    expect(log.sessions[0].entries).toHaveLength(1);
    expect(log.sessions[0].entries[0].sets[1].reps).toBeNull();
    expect(() => log.restore("garbage")).not.toThrow();
    expect(log.sessions).toEqual([]);
  });
});

describe("dropping an exercise", () => {
  const press = app.EXERCISE_BY_NAME.get("Machine Chest Press");
  const chestWeek = routine => routine.sessions.find(s => s.block.muscles.some(m => m.id === "chest"));

  test("a reason has to be one we know", () => {
    const prefs = new app.ExercisePreferences();
    expect(prefs.discard(press.id, "bored")).toBe(false);
    expect(prefs.discard("nonsense", "dislike")).toBe(false);
    expect(prefs.discard(press.id, "dislike")).toBe(true);
    expect(prefs.clear(press.id)).toBe(true);
    expect(prefs.reasonFor(press.id)).toBeNull();
  });

  test("an exercise the user can't do is never planned again", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2, minutes: 75 });
    const s = chestWeek(routine);
    const entry = s.workout.entries.find(e => e.exercise === press);
    expect(entry).toBeTruthy();
    expect(routine.discardExercise(s, entry, "cannot")).toBe(true);
    routine.generate();
    expect(routine.sessions.flatMap(x => x.workout.entries).some(e => e.exercise === press)).toBe(false);
  });

  test("one the user doesn't like is ranked lower but not removed for good", () => {
    const chest = app.MUSCLE_BY_ID.get("chest");
    const block = { muscles: [chest] };
    const best = prefs => new app.WorkoutBuilder([], 60, undefined, prefs)
      .bestFor(chest, block, new app.Workout([chest], []));
    const prefs = new app.ExercisePreferences();
    expect(best(prefs)).toBe(press);                       // the S+ pick
    prefs.discard(press.id, "dislike");
    expect(best(prefs)).not.toBe(press);                   // ranked below the S tier now
    prefs.discard(press.id, "cannot");
    expect(best(prefs)).not.toBe(press);
    prefs.clear(press.id);
    expect(best(prefs)).toBe(press);                       // back in play
    // and it can still be chosen when asked for explicitly
    prefs.discard(press.id, "dislike");
    const w = new app.Workout([chest], []);
    w.add("chest", press);
    expect(w.has(press)).toBe(true);
  });

  test("an entry that is not in the session is refused", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2, minutes: 75 });
    const [a, b] = routine.sessions;
    expect(routine.discardExercise(a, b.workout.entries[0], "dislike")).toBe(false);
  });
});
