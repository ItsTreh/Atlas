/* The weekly schedule: availability, recovery, frequency and meals. */
import { describe, expect, test } from "vitest";
import { loadApp, generatedWeek } from "./load-app.js";

const app = loadApp();
const { DayOfWeek, SlotState } = app;

/* Every hour a session covers, as "DAY-hour". */
const sessionHours = routine => routine.sessions.flatMap(s =>
  Array.from({ length: s.durationHours }, (_, i) => s.day + "-" + (s.startHour + i)));

describe("availability", () => {
  test("no session covers a busy hour", () => {
    // Busy 9am–6pm on weekdays, and all of Wednesday.
    const busy = [];
    for (const day of ["MON", "TUE", "THU", "FRI"])
      for (let h = 9; h < 18; h++) busy.push([day, h]);
    for (let h = app.FIRST_HOUR; h <= app.LAST_HOUR; h++) busy.push(["WED", h]);

    for (const program of ["full-body", "push", "legs", "upper"]) {
      const { routine } = generatedWeek(app, { program, sessions: 5, busy });
      for (const key of sessionHours(routine)) {
        const [day, hour] = key.split("-");
        expect(routine.slot(day, Number(hour)).state).toBe(SlotState.WORKOUT);
      }
      expect(routine.sessions.some(s => s.day === "WED")).toBe(false);
      for (const [day, hour] of busy) expect(routine.slot(day, hour).state).toBe(SlotState.BUSY);
    }
  });

  test("a fully blocked week places nothing, and says why", () => {
    const busy = [];
    for (const day of DayOfWeek.values)
      for (let h = app.FIRST_HOUR; h <= app.LAST_HOUR; h++) busy.push([day, h]);
    const { routine, result } = generatedWeek(app, { program: "push", busy });
    expect(routine.sessions.length).toBe(0);
    expect(result.reason).toBe("no-blocks");
  });

  test("nothing selected is reported, not scheduled", () => {
    const { routine, result } = generatedWeek(app, {});
    expect(routine.sessions.length).toBe(0);
    expect(result.reason).toBe("no-muscles");
  });
});

describe("frequency and recovery", () => {
  test.each([1, 2, 3, 4, 5, 6, 7])("never more than %i sessions when %i are asked for", n => {
    const { routine, result } = generatedWeek(app, { program: "full-body", sessions: n });
    expect(routine.sessions.length).toBeLessThanOrEqual(n);
    expect(result.placed).toBe(routine.sessions.length);
    if (routine.sessions.length < n) expect(result.reason).not.toBe("ok");
  });

  test("no muscle is trained again before its recovery days have passed", () => {
    for (const program of ["full-body", "push", "pull", "legs", "upper", "lower", "shoulders-arms"]) {
      const { routine } = generatedWeek(app, { program, sessions: 7 });
      const list = routine.sessions;
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const gap = DayOfWeek.distance(list[i].day, list[j].day);
          for (const m of list[i].block.muscles)
            if (list[j].block.has(m)) expect(gap).toBeGreaterThanOrEqual(m.recoveryDays);
        }
    }
  });

  test("sessions are spread out rather than stacked on one day", () => {
    const { routine } = generatedWeek(app, { program: "full-body", sessions: 4 });
    const days = routine.sessions.map(s => s.day);
    expect(new Set(days).size).toBe(days.length);
  });
});

/* The muscles a session actually works (riders have no exercises to give them time). */
const worked = s => s.block.muscles.filter(m => !s.block.riders.has(m));

describe("the final plan", () => {
  test("a day marked unavailable never gets a session", () => {
    for (const program of ["full-body", "upper", "push", "legs"]) {
      const routine = new app.WeeklyRoutine();
      routine.selection.applyProgram(app.PROGRAM_BY_ID.get(program));
      routine.sessionsPerWeek = 5;
      routine.setDayUnavailable("MON", true);
      routine.setDayUnavailable("WED", true);
      routine.generate();
      expect(routine.sessions.length).toBeGreaterThan(0);
      expect(routine.sessions.some(s => s.day === "MON" || s.day === "WED")).toBe(false);
      expect(routine.isDayUnavailable("MON")).toBe(true);
    }
  });

  test("a day off keeps its meals and the hours painted on it", () => {
    const routine = new app.WeeklyRoutine();
    routine.selection.applyProgram(app.PROGRAM_BY_ID.get("full-body"));
    for (let h = 9; h < 12; h++) routine.markBusy("MON", h);     // a morning of work
    routine.setDayUnavailable("MON", true);
    routine.generate();
    expect(routine.sessions.some(s => s.day === "MON")).toBe(false);
    expect(routine.plannedMeals.filter(m => m.day === "MON").length)
      .toBe(routine.nutrition.mealsPerDay);
    routine.setDayUnavailable("MON", false);
    expect(routine.isDayUnavailable("MON")).toBe(false);
    expect(routine.slot("MON", 10).state).toBe(SlotState.BUSY);   // work hours kept
  });

  test("marking a day off removes its session; freeing a painted column clears it", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2 });
    const day = routine.sessions[0].day;
    routine.setDayUnavailable(day, true);
    expect(routine.sessions.some(s => s.day === day)).toBe(false);
    for (let h = app.FIRST_HOUR; h <= app.LAST_HOUR; h++) routine.markBusy("SUN", h);
    expect(routine.isDayUnavailable("SUN")).toBe(true);
    routine.setDayUnavailable("SUN", false);
    expect(routine.isDayUnavailable("SUN")).toBe(false);
  });

  test("muscles with no exercises are not scheduled as empty days", () => {
    const { routine, result } = generatedWeek(app, { program: "core", sessions: 3 });
    expect(routine.sessions.length).toBe(0);
    expect(result.reason).toBe("no-exercises");
    expect(routine.plannedSessions()).toBe(0);
  });

  test("a week that cannot be planned clears the previous one", () => {
    const { routine } = generatedWeek(app, { program: "upper", sessions: 2 });
    expect(routine.sessions.length).toBe(2);
    routine.selection.applyProgram(app.PROGRAM_BY_ID.get("core"));
    expect(routine.generate().reason).toBe("no-exercises");
    expect(routine.sessions.length).toBe(0);
    expect(routine.allSlots().some(s => s.state === SlotState.WORKOUT)).toBe(false);
  });

  test("no gap long enough is reported as that, not as recovery", () => {
    const busy = [];
    for (const day of DayOfWeek.values)
      for (let h = app.FIRST_HOUR; h <= app.LAST_HOUR; h++) if (h !== 17) busy.push([day, h]);
    const { result } = generatedWeek(app, { program: "legs", sessions: 3, minutes: 90, busy });
    expect(result.reason).toBe("no-room");
  });

  test("the diet counts only the training days the week holds", () => {
    const { routine } = generatedWeek(app, { program: "full-body", sessions: 4 });
    expect(routine.plannedSessions()).toBe(routine.sessions.length);
    routine.removeSession(routine.sessions[0]);
    expect(routine.plannedSessions()).toBe(routine.sessions.length);
    expect(routine.nutrition.load.sessionsPerWeek).toBe(routine.sessions.length);
  });

  test("no exercise trains a muscle that another session trains within its recovery", () => {
    for (const program of ["full-body", "lower", "legs", "upper"])
      for (const minutes of [45, 60, 90])
        for (const sessions of [3, 4, 5, 6]) {
          const { routine } = generatedWeek(app, { program, sessions, minutes });
          for (const s of routine.sessions) for (const o of routine.sessions) {
            if (s === o) continue;
            const gap = DayOfWeek.distance(s.day, o.day);
            for (const e of s.workout.entries) for (const id of e.exercise.primary) {
              const m = app.MUSCLE_BY_ID.get(id);
              // rear-delt work (face pulls) on a pull day is not the push day's delts
              if (id === "shoulders" && e.exercise.movement === "face-pull") continue;
              if (o.block.has(m) && !o.block.riders.has(m) && !s.block.has(m))
                expect(gap, program + " " + minutes + "×" + sessions + ": " + e.exercise.name)
                  .toBeGreaterThanOrEqual(m.recoveryDays);
            }
          }
        }
  });

  test("merged sessions use most of the session", () => {
    const { routine } = generatedWeek(app, { program: "full-body", sessions: 2, minutes: 60 });
    for (const s of routine.sessions) {
      expect(s.workout.minutes).toBeLessThanOrEqual(60);
      expect(s.workout.minutes).toBeGreaterThanOrEqual(40);
    }
  });

  test("a training day holds one session", () => {
    for (const program of ["full-body", "upper", "lower", "shoulders-arms"])
      for (const sessions of [3, 5, 7]) {
        const { routine } = generatedWeek(app, { program, sessions });
        const days = routine.sessions.map(s => s.day);
        expect(new Set(days).size).toBe(days.length);
      }
  });

  test("every chosen muscle with exercises is trained, however few the days", () => {
    for (const program of ["full-body", "upper", "lower"])
      for (const sessions of [1, 2, 3, 4]) {
        const { routine } = generatedWeek(app, { program, sessions });
        const trained = new Set(routine.sessions.flatMap(s => worked(s).map(m => m.id)));
        for (const m of routine.selectedMuscles())
          if (app.exercisesFor(m.id).length) expect(trained.has(m.id)).toBe(true);
      }
  });

  test("an early pick never costs a later session", () => {
    // Placing the best spot first used to leave pull with no legal day here.
    const routine = new app.WeeklyRoutine();
    routine.selection.applyProgram(app.PROGRAM_BY_ID.get("full-body"));
    routine.sessionsPerWeek = 5;
    routine.setDayUnavailable("MON", true);
    routine.setDayUnavailable("WED", true);
    expect(routine.generate().placed).toBe(5);
  });

  test("asking for more days than are free says so", () => {
    const routine = new app.WeeklyRoutine();
    routine.selection.applyProgram(app.PROGRAM_BY_ID.get("full-body"));
    routine.sessionsPerWeek = 6;
    for (const d of ["TUE", "THU", "SAT"]) routine.setDayUnavailable(d, true);
    const r = routine.generate();
    expect(r.placed).toBe(4);
    expect(r.reason).toBe("days");
  });

  test("spare days become rest days instead of repeating a focus", () => {
    const { routine, result } = generatedWeek(app, { program: "push", sessions: 6 });
    expect(routine.sessions.length).toBe(app.ESTIMATE.timesPerWeek);
    expect(result.reason).toBe("rest");
    expect(routine.nutrition.load.sessionsPerWeek).toBe(app.ESTIMATE.timesPerWeek);
  });

  test("muscles are trained a similar number of times", () => {
    const { routine } = generatedWeek(app, { program: "full-body", sessions: 6 });
    const times = new Map();
    for (const s of routine.sessions) for (const m of worked(s)) times.set(m.id, (times.get(m.id) || 0) + 1);
    expect(Math.max(...times.values()) - Math.min(...times.values())).toBeLessThanOrEqual(1);
  });

  test("a moved session keeps its exercises and its recovery rules", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2 });
    const [a, b] = [...routine.sessions].sort((x, y) =>
      DayOfWeek.indexOf(x.day) - DayOfWeek.indexOf(y.day));
    const entries = a.workout.entries;

    // Next to the other push day would train chest again too soon.
    const tooSoon = DayOfWeek.values.find(d => d !== b.day && DayOfWeek.distance(d, b.day) === 1);
    expect(routine.moveBlocker(a, tooSoon).kind).toBe("recovery");
    routine.setDayUnavailable("SUN", true);
    if (a.day !== "SUN") expect(routine.moveBlocker(a, "SUN").kind).toBe("off");
    expect(routine.moveSession(a, tooSoon, routine.startsFor(a, tooSoon)[0] ?? 18)).toBe(false);
    expect(routine.moveBlocker(a, b.day).kind).toBe("taken");

    const ok = DayOfWeek.values.find(d => !routine.moveBlocker(a, d) && d !== a.day);
    const start = routine.startsFor(a, ok)[0];
    expect(routine.moveSession(a, ok, start)).toBe(true);
    expect(a.day).toBe(ok);
    expect(a.workout.entries).toBe(entries);
    for (let h = start; h < a.endHour(); h++) expect(routine.slot(ok, h).session).toBe(a);
    expect(routine.allSlots().filter(s => s.session === a).length).toBe(a.durationHours);
  });

  test("every exercise comes with reps and rest", () => {
    const { routine } = generatedWeek(app, { program: "full-body", sessions: 4 });
    const entries = routine.sessions.flatMap(s => s.workout.entries);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.reps).toMatch(/^\d+–\d+$/);
      expect(e.rest).toBeTruthy();
    }
    expect(entries.some(e => e.exercise.compound)).toBe(true);
    expect(app.errors).toEqual([]);
  });
});

describe("meals and the week", () => {
  test("meals land on the nutrition plan's hours and never under a session", () => {
    const { routine } = generatedWeek(app, { program: "full-body", sessions: 4 });
    const planned = new Set(routine.nutrition.hours);
    expect(routine.plannedMeals.length).toBeGreaterThan(0);
    for (const m of routine.plannedMeals) {
      expect(planned.has(m.hour)).toBe(true);
      expect(routine.slot(m.day, m.hour).state).toBe(SlotState.MEAL);
    }
    const taken = new Set(sessionHours(routine));
    for (const m of routine.plannedMeals) expect(taken.has(m.day + "-" + m.hour)).toBe(false);
  });

  test("clearing one hour of a session removes the whole session", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2 });
    const s = routine.sessions[0];
    routine.clearSlot(s.day, s.startHour);
    expect(routine.sessions).not.toContain(s);
    expect(sessionHours(routine).some(k => k.startsWith(s.day + "-" + s.startHour))).toBe(false);
  });

  test("reset clears the week but keeps the targets and nutrition", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2 });
    routine.nutrition.goal = "lose";
    routine.markBusy("MON", 9);
    routine.reset();
    expect(routine.sessions.length).toBe(0);
    expect(routine.slot("MON", 9).state).toBe(SlotState.FREE);
    expect(routine.selection.source().program.id).toBe("push");
    expect(routine.nutrition.goal).toBe("lose");
  });
});
