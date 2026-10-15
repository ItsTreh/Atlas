/* A slot on the calendar always holds a session worth doing. A repeat of a
   block that would come out empty (0 min) or with less than one typical
   exercise is not scheduled, and the count, the status, the audit and the
   diet all describe the sessions that remain. */
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp();

function week({ muscles, program, days, minutes = 60, split = "auto", experience = "intermediate" }) {
  const r = new app.WeeklyRoutine();
  if (program) r.selection.applyProgram(app.PROGRAM_BY_ID.get(program));
  for (const id of muscles || []) r.selection.set(id, true);
  Object.assign(r, { experience, sessionsPerWeek: days, sessionMinutes: minutes, split, preferredWindow: "evening" });
  r.nutrition.showMeals = true;
  return { r, result: r.generate() };
}
const inWeek = (a, b) => app.DayOfWeek.indexOf(a.day) - app.DayOfWeek.indexOf(b.day) || a.startHour - b.startHour;

describe("repeats that would come out empty or bare", () => {
  test("Abs + Calves on Full body or Upper · Lower at 6 days has no empty session", () => {
    for (const split of ["full-body", "upper-lower"]) for (const minutes of [45, 60, 90]) {
      const { r } = week({ muscles: ["abs", "calves"], days: 6, minutes, split });
      for (const s of r.sessions) {
        expect(s.workout.entries.length, split + " " + minutes).toBeGreaterThan(0);
        expect(s.workout.minutes).toBeGreaterThan(0);
      }
    }
  });

  test("arms only at 6 and 7 days has no empty session", () => {
    for (const days of [6, 7]) for (const split of ["auto", "upper-lower", "push-pull-legs", "full-body"]) {
      const { r } = week({ muscles: ["biceps", "triceps", "forearms"], days, split });
      for (const s of r.sessions) expect(s.workout.entries.length, split + " " + days).toBeGreaterThan(0);
    }
  });

  test("a repeat holds at least one typical exercise's worth of sets", () => {
    for (const [program, days, split] of [["shoulders-arms", 5, "push-pull-legs"], ["chest-triceps", 6, "upper-lower"],
                                          ["legs", 6, "auto"], ["core", 6, "full-body"]]) {
      const { r } = week({ program, days, split, minutes: 45 });
      const seen = new Set();
      for (const s of [...r.sessions].sort(inWeek)) {
        if (seen.has(s.block)) expect(s.workout.sets, program).toBeGreaterThanOrEqual(app.WORKOUT.setsPerExercise);
        seen.add(s.block);
      }
    }
  });

  test("no muscle loses its day or its weekly goal to the dropped repeats", () => {
    const { r } = week({ muscles: ["abs", "calves"], days: 6, split: "full-body" });
    expect(r.weeklyVolume().untrained).toEqual([]);
    for (const m of r.selectedMuscles()) expect(r.sessions.some(s => s.block.has(m)), m.id).toBe(true);
    const goals = r.weeklyGoals();
    for (const row of r.weeklyVolume().rows) expect(row.sets).toBeGreaterThanOrEqual(goals.get(row.muscle.id) - 0.5);
  });
});

describe("the week, the status and the diet agree", () => {
  test("the result, the sessions, the calendar slots and the diet count the same days", () => {
    const { r, result } = week({ muscles: ["abs", "calves"], days: 6, split: "full-body" });
    const onCalendar = new Set(r.allSlots().filter(s => s.session).map(s => s.session));
    expect(result.placed).toBe(r.sessions.length);
    expect(onCalendar.size).toBe(r.sessions.length);
    expect(r.plannedSessions()).toBeLessThanOrEqual(r.sessions.length);
    expect(result.dropped).toBeGreaterThan(0);
  });

  test("the extra days asked for are rest days, not a silent shortfall", () => {
    const { result } = week({ muscles: ["abs", "calves"], days: 6, split: "full-body" });
    expect(result.placed).toBeLessThan(result.requested);
    expect(result.reason).toBe("rest");
  });

  test("the audit reads the events of the week that stays", () => {
    const { r } = week({ muscles: ["abs", "calves"], days: 6, split: "full-body" });
    const ids = new Set(r.sessions.map(s => s.id));
    for (const e of r.planned.events) if (e.sessionId != null) expect(ids.has(e.sessionId)).toBe(true);
  });

  test("a week with nothing to drop reports none", () => {
    expect(week({ program: "full-body", days: 3 }).result.dropped).toBe(0);
  });
});
