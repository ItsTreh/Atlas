/* A repeat of a day that has nothing worth doing is not scheduled: no empty
   session, and none of a bare 2-set minimum. The week, the status and the
   diet all describe the sessions that are left. */
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp();

function week({ muscles, program, days, minutes = 60, split = "auto", experience = "beginner" }) {
  const r = new app.WeeklyRoutine();
  if (program) r.selection.applyProgram(app.PROGRAM_BY_ID.get(program));
  for (const id of muscles || []) r.selection.set(id, true);
  Object.assign(r, { experience, sessionsPerWeek: days, sessionMinutes: minutes, split, preferredWindow: "evening" });
  r.nutrition.showMeals = true;
  const result = r.generate();
  return { r, result };
}

describe("repeats that would come out empty or bare", () => {
  test("Abs + Calves on Full body over 6 days has no empty session", () => {
    const { r } = week({ muscles: ["abs", "calves"], days: 6, split: "full-body" });
    for (const s of r.sessions) expect(s.workout.entries.length).toBeGreaterThan(0);
  });

  test("a repeat holds at least one typical exercise's worth of sets", () => {
    for (const [program, days, split] of [["shoulders-arms", 5, "push-pull-legs"],
                                          ["chest-triceps", 4, "auto"], ["legs", 5, "auto"]]) {
      const { r } = week({ program, days, split, minutes: 30 });
      const seen = new Set();
      for (const s of r.sessions) {
        if (seen.has(s.block)) expect(s.workout.sets, program).toBeGreaterThanOrEqual(app.WORKOUT.setsPerExercise);
        seen.add(s.block);
      }
    }
  });

  test("the first session of a block always stays, so no muscle loses its day", () => {
    const { r } = week({ program: "shoulders-arms", days: 5, split: "push-pull-legs" });
    expect(r.weeklyVolume().untrained).toEqual([]);
    for (const m of r.selectedMuscles()) expect(r.sessions.some(s => s.block.has(m)), m.id).toBe(true);
  });

  test("the result, the week and the diet count the same sessions", () => {
    const { r, result } = week({ program: "shoulders-arms", days: 5, split: "push-pull-legs" });
    expect(result.placed).toBe(r.sessions.length);
    expect(r.plannedSessions()).toBe(r.sessions.length);
    expect(r.allSlots().filter(s => s.session).map(s => s.session)
      .every(s => r.sessions.includes(s))).toBe(true);
  });

  test("a week that lost a repeat says the extra day is a rest day", () => {
    const { r, result } = week({ program: "shoulders-arms", days: 5, split: "push-pull-legs" });
    expect(result.placed).toBeLessThan(result.requested);
    expect(result.reason).toBe("rest");
  });

  // The status gives dropped repeats as the reason for a shorter week, not
  // rest days between or twice a week (app.js reads `dropped`).
  test("a week shortened by dropped repeats reports them", () => {
    for (const [muscles, program, split] of [[["abs", "calves"], null, "upper-lower"],
                                             [["abs", "calves"], null, "full-body"],
                                             [["biceps", "triceps", "forearms"], null, "upper-lower"],
                                             [null, "upper", "push-pull-legs"]]) {
      const { r, result } = week({ muscles, program, days: 6, split });
      const name = (program || muscles.join("+")) + " " + split;
      expect(result.reason, name).toBe("rest");
      expect(result.dropped, name).toBeGreaterThan(0);
      expect(result.placed + result.dropped, name).toBe(6);
      expect(result.placed, name).toBe(r.sessions.length);
    }
  });

  test("a week that drops nothing reports no dropped repeats", () => {
    const { result } = week({ program: "legs", days: 3, split: "auto" });
    expect(result.dropped).toBe(0);
  });
});
