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
    const chestDay = routine.sessions.find(s => s.block.muscles.some(m => m.id === "chest"));
    const chest = chestDay.workout.entriesFor("chest");
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
    // The chest day's presses count toward the triceps, whichever day they are on.
    const { routine } = generatedWeek(app, { program: "chest-triceps", sessions: 2 });
    const chestDay = routine.sessions.find(s => s.workout.entriesFor("chest").length);
    expect(chestDay.workout.assistedSets("triceps")).toBeGreaterThan(0);
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
    const w = routine.sessions.find(s => s.block.muscles.some(m => m.id === "chest")).workout;
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

describe("weekly target", () => {
  const muscle = id => app.MUSCLE_BY_ID.get(id);
  const levels = app.EXPERIENCE_LEVELS.map(e => e.id);

  test("is unknown until experience is known", () => {
    expect(app.weeklyTarget(muscle("chest"), null)).toBeNull();
    expect(app.weeklyTarget(muscle("chest"), "expert")).toBeNull();
  });

  test("always a whole number inside the muscle's range", () => {
    for (const m of app.MUSCLES) for (const e of levels) for (const p of app.PRIORITY_LEVELS) {
      const t = app.weeklyTarget(m, e, p);
      expect(Number.isInteger(t), m.id).toBe(true);
      expect(t).toBeGreaterThanOrEqual(m.weeklySets[0]);
      expect(t).toBeLessThanOrEqual(m.weeklySets[1]);
    }
  });

  test("focus is never below normal, and normal never below maintain", () => {
    for (const m of app.MUSCLES) for (const e of levels) {
      const t = p => app.weeklyTarget(m, e, p);
      expect(t("focus")).toBeGreaterThanOrEqual(t("normal"));
      expect(t("normal")).toBeGreaterThanOrEqual(t("maintain"));
    }
  });

  test("maintain is the bottom of the range; experience only raises the target", () => {
    const chest = muscle("chest");
    for (const e of levels) expect(app.weeklyTarget(chest, e, "maintain")).toBe(chest.weeklySets[0]);
    const n = e => app.weeklyTarget(chest, e, "normal");
    expect(n("beginner")).toBeLessThanOrEqual(n("intermediate"));
    expect(n("intermediate")).toBeLessThanOrEqual(n("advanced"));
  });

  test("the routine keeps experience, restores it, and drops an unknown one", () => {
    const r = new app.WeeklyRoutine();
    expect(r.weeklyTargets()).toBeNull();
    r.selection.toggle("chest");
    r.experience = "intermediate";
    r.selection.setPriority("chest", "focus");
    expect(r.weeklyTargets().get("chest")).toBe(app.weeklyTarget(muscle("chest"), "intermediate", "focus"));
    const other = new app.WeeklyRoutine();
    other.restore(r.snapshot());
    expect(other.experience).toBe("intermediate");
    other.restore({ ...r.snapshot(), experience: "guru" });
    expect(other.experience).toBeNull();
  });
});

describe("fitting the weekly targets to the time", () => {
  const ids = ["chest", "quads", "triceps"];
  const muscles = ids.map(id => app.MUSCLE_BY_ID.get(id));
  const raw = level => new Map(muscles.map(m => [m.id, app.weeklyTarget(m, "advanced", level)]));
  const pri = level => new Map(ids.map(id => [id, level]));
  const sets = map => [...map.values()].reduce((t, n) => t + n, 0);

  test("a roomy week changes nothing", () => {
    const fit = app.fitToTime(raw("normal"), muscles, pri("normal"), 5, 90);
    expect(fit.fits).toBe(true);
    expect(fit.trimmed).toEqual([]);
    expect([...fit.targets]).toEqual([...raw("normal")]);
  });

  test("a short week lowers sets but never below a muscle's minimum", () => {
    const fit = app.fitToTime(raw("focus"), muscles, pri("focus"), 2, 60);
    expect(fit.meetsMinimums).toBe(true);
    for (const m of muscles) expect(fit.targets.get(m.id)).toBeGreaterThanOrEqual(m.weeklySets[0]);
    expect(sets(fit.targets)).toBeLessThan(sets(raw("focus")));
    expect(fit.trimmed.length).toBeGreaterThan(0);
  });

  test("when it does not all fit, normal muscles are lowered before focus ones", () => {
    const targets = new Map([["chest", 16], ["quads", 16], ["triceps", 12]]);
    const priorities = new Map([["chest", "focus"], ["quads", "normal"], ["triceps", "normal"]]);
    // Room for about 35 sets: 44 requested, so 9 must go, all of it from the normal muscles.
    const room = 35 * app.ESTIMATE.minutesPerSet, sessions = 1, len = Math.ceil(room) + app.ESTIMATE.warmupMinutes;
    const fit = app.fitToTime(targets, muscles, priorities, sessions, len);
    expect(fit.targets.get("chest")).toBe(16);
    expect(fit.fits).toBe(true);
    expect(fit.targets.get("quads")).toBeLessThan(16);
  });

  test("with an impossible week it says so and stops at the minimums", () => {
    const fit = app.fitToTime(raw("normal"), muscles, pri("normal"), 1, 45);
    // Too short even for the usual minimums: sets go below them (never below
    // the direct-set floor) so every muscle is still trained, and it says so.
    expect(fit.meetsMinimums).toBe(false);
    for (const m of muscles) expect(fit.targets.get(m.id)).toBeGreaterThanOrEqual(app.WORKOUT.minDirectSets);
    // Timed with the planner's one time model (estimate.js), over the one session.
    const minutes = [...fit.targets.values()].reduce((t, n) => t + app.muscleWeekMinutes(n, 1), 0);
    expect(fit.neededMinutes).toBeCloseTo(minutes, 5);
  });

  test("it names a fix that makes the requested targets fit", () => {
    const fit = app.fitToTime(raw("focus"), muscles, pri("focus"), 2, 45);
    if (fit.fixes.extraDay) {
      const more = app.fitToTime(raw("focus"), muscles, pri("focus"), fit.fixes.extraDay, 45);
      expect(more.trimmed).toEqual([]);
    }
    if (fit.fixes.sessionMinutes) {
      const longer = app.fitToTime(raw("focus"), muscles, pri("focus"), 2, fit.fixes.sessionMinutes);
      expect(longer.trimmed).toEqual([]);
    }
  });

  test("the routine reports it and uses the fitted targets", () => {
    const r = new app.WeeklyRoutine();
    for (const id of ids) r.selection.toggle(id);
    expect(r.weekFit()).toBeNull();
    r.experience = "advanced"; r.sessionsPerWeek = 1; r.sessionMinutes = 45;
    for (const id of ids) r.selection.setPriority(id, "focus");
    const fit = r.weekFit();
    expect(fit.capacityMinutes).toBe(35);
    expect([...r.weeklyTargets()]).toEqual([...fit.targets]);
  });
});

describe("found in the 2026-10-22 sweep", () => {
  const plan = ({ program, ids = [], days, minutes, experience = null, split = "auto", priorities = {} }) => {
    const r = new app.WeeklyRoutine();
    if (program) r.selection.applyProgram(app.PROGRAM_BY_ID.get(program));
    for (const id of ids) r.selection.set(id, true);
    for (const [id, level] of Object.entries(priorities)) r.selection.setPriority(id, level);
    Object.assign(r, { sessionsPerWeek: days, sessionMinutes: minutes, experience, split });
    r.generate();
    return r;
  };
  const sets = (r, id) => r.weeklyVolume().rows.find(x => x.muscle.id === id).sets;

  test("a muscle whose assisting credit can't land on its target ends at or above its floor, not below", () => {
    // Shoulders: 5.5 -> add a set -> 6.5 -> shedding one went back to 5.5, and so on.
    const r = plan({ program: "push", days: 1, minutes: 90 });
    expect(r.weeklyVolume().short).toEqual([]);
    expect(sets(r, "shoulders")).toBeGreaterThanOrEqual(6);
  });

  test("Focus never gives a one-movement muscle less than Normal", () => {
    const normal = plan({ program: "pull", days: 5, minutes: 90, experience: "intermediate" });
    const focus = plan({ program: "pull", days: 5, minutes: 90, experience: "intermediate", priorities: { traps: "focus" } });
    expect(sets(focus, "traps")).toBeGreaterThanOrEqual(sets(normal, "traps"));
    const alone = plan({ ids: ["traps"], days: 3, minutes: 60, experience: "advanced", priorities: { traps: "focus" } });
    expect(sets(alone, "traps")).toBe(alone.plannedWeeklySets().get("traps"));
  });

  test("a day of a chosen split books the hours its workout takes", () => {
    for (const split of ["upper-lower", "push-pull-legs", "full-body"])
      for (const minutes of [75, 90]) {
        const r = plan({ program: "push", days: 1, minutes, split, experience: "intermediate" });
        for (const s of r.sessions) expect(s.workout.minutes).toBeLessThanOrEqual(s.durationHours * 60);
      }
  });

  test("exercises the user took out are theirs, not a lack of time", () => {
    const r = plan({ program: "push", days: 2, minutes: 60 });
    const s = r.sessions.find(x => x.workout.entriesFor("chest").length);
    for (const e of s.workout.entriesFor("chest")) s.workout.remove(e);
    const v = r.weeklyVolume();
    expect(v.removed.map(m => m.id)).toEqual(["chest"]);
    expect(v.noTime).toEqual([]);
  });
});
