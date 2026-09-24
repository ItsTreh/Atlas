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
