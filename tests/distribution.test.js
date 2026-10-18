/* How often each muscle trains and on which days (distribution.js), and the
   invariants the planner promises whatever the week looks like. */
import { describe, expect, test } from "vitest";
import { loadApp, generatedWeek } from "./load-app.js";

const app = loadApp();
const { DayOfWeek } = app;
const muscle = id => app.MUSCLE_BY_ID.get(id);
const plan = (ids, targets, priorities = {}, days = 4, minutes = 60, cap) =>
  app.planDistribution(ids.map(muscle), new Map(Object.entries(targets)),
                       new Map(Object.entries(priorities)), days, minutes, cap);
const timesOf = (week, id) => week.days.filter(d => d.muscles.some(m => m.id === id)).length;

describe("frequency", () => {
  test("a muscle that fits in one session trains once", () => {
    expect(plan(["chest"], { chest: 8 }, {}, 1).frequency.get("chest")).toBe(1);
  });

  test("more volume than one session holds means more sessions", () => {
    const week = plan(["chest"], { chest: 16 }, {}, 2);
    expect(week.frequency.get("chest")).toBe(2);
    expect(timesOf(week, "chest")).toBe(2);
    expect(plan(["chest"], { chest: 25 }, {}, 4).frequency.get("chest")).toBe(4);
  });

  test("never more sessions than training days", () => {
    expect(plan(["chest"], { chest: 40 }, {}, 2).frequency.get("chest")).toBeLessThanOrEqual(2);
  });

  test("a muscle that needs two days to recover is capped by the free days", () => {
    // chest recovers in 2 days; on 3 consecutive free days it can train at most twice
    const cap = m => app.maxSpread(["MON", "TUE", "WED"], m.recoveryDays);
    expect(cap(muscle("chest"))).toBe(2);
    expect(plan(["chest"], { chest: 40 }, {}, 3, 60, cap).frequency.get("chest")).toBeLessThanOrEqual(2);
  });

  test("maxSpread counts days far enough apart, the short way round", () => {
    expect(app.maxSpread(DayOfWeek.values, 1)).toBe(7);
    expect(app.maxSpread(DayOfWeek.values, 2)).toBe(3);        // Sun and next Mon are 1 apart
    expect(app.maxSpread(["MON", "TUE", "WED", "THU"], 2)).toBe(2);
    expect(app.maxSpread(["MON"], 2)).toBe(1);
  });
});

describe("spare days", () => {
  test("an empty day gets another session for a Focus muscle before a Normal one", () => {
    const week = plan(["chest", "quads"], { chest: 16, quads: 16 }, { quads: "focus" }, 3, 90);
    expect(week.frequency.get("quads")).toBeGreaterThan(week.frequency.get("chest"));
  });

  test("Maintain muscles never gain sessions", () => {
    const week = plan(["chest"], { chest: 16 }, { chest: "maintain" }, 4);
    expect(week.frequency.get("chest")).toBe(2);       // from volume alone, not from spare days
    const small = plan(["chest"], { chest: 8 }, { chest: "maintain" }, 4);
    expect(small.frequency.get("chest")).toBe(1);
  });

  test("no session is made for fewer than four sets of one muscle", () => {
    const week = plan(["chest"], { chest: 6 }, {}, 4);
    expect(week.frequency.get("chest")).toBe(1);
    expect(week.days.length).toBe(1);                  // the other days are rest days
  });
});

describe("days", () => {
  test("a muscle's sets add up to its target and each session stays within the maximum", () => {
    const week = plan(["chest", "lats", "quads"], { chest: 16, lats: 12, quads: 14 }, {}, 4, 90);
    for (const [id, target] of [["chest", 16], ["lats", 12], ["quads", 14]]) {
      const sets = week.days.map(d => d.sets.get(id) || 0);
      expect(sets.reduce((t, n) => t + n, 0)).toBe(target);
      expect(Math.max(...sets)).toBeLessThanOrEqual(app.WORKOUT.maxSetsPerSession);
    }
  });

  test("a muscle trained twice gets its sessions apart", () => {
    const week = plan(["chest", "lats"], { chest: 16, lats: 16 }, {}, 4);
    const at = id => week.days.map((d, i) => d.muscles.some(m => m.id === id) ? i : -1).filter(i => i >= 0);
    expect(at("chest")[1] - at("chest")[0]).toBeGreaterThanOrEqual(2);
  });

  test("muscles of one family end up together when nothing else decides", () => {
    const week = plan(["chest", "shoulders", "triceps", "lats", "biceps"],
      { chest: 6, shoulders: 4, triceps: 4, lats: 6, biceps: 4 }, {}, 2, 120);
    const dayOf = id => week.days.findIndex(d => d.muscles.some(m => m.id === id));
    expect(dayOf("chest")).toBe(dayOf("triceps"));
    expect(dayOf("lats")).toBe(dayOf("biceps"));
  });

  test("the same inputs always give the same week", () => {
    const run = () => JSON.stringify(plan(["chest", "lats", "quads", "abs"],
      { chest: 16, lats: 12, quads: 14, abs: 4 }, { chest: "focus" }, 4)
      .days.map(d => [d.muscles.map(m => m.id), [...d.sets]]));
    expect(run()).toBe(run());
  });
});

describe("the generated week", () => {
  const weeks = [
    { program: "full-body", sessions: 3, minutes: 60 },
    { program: "full-body", sessions: 4, minutes: 75 },
    { program: "full-body", sessions: 6, minutes: 90 },
    { program: "push", sessions: 4, minutes: 60 },
    { program: "legs", sessions: 3, minutes: 60 },
    { program: "upper", sessions: 5, minutes: 60 }
  ];

  test("every chosen muscle with exercises is trained, and none passes its weekly maximum", () => {
    for (const opts of weeks) {
      const { routine } = generatedWeek(app, opts);
      const v = routine.weeklyVolume();
      expect(v.untrained, JSON.stringify(opts)).toEqual([]);
      for (const r of v.rows) expect(r.sets, r.muscle.id).toBeLessThanOrEqual(r.muscle.weeklySets[1]);
    }
  });

  test("no muscle is trained again before its recovery days have passed", () => {
    for (const opts of weeks) {
      const { routine } = generatedWeek(app, opts);
      const s = routine.sessions;
      for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++)
        expect(app.recoveryClash(s[i].block, s[i].day, s[j].block, s[j].day), JSON.stringify(opts)).toBeNull();
    }
  });

  test("sessions only go on days the user left free, one a day", () => {
    const routine = new app.WeeklyRoutine();
    routine.selection.applyProgram(app.PROGRAM_BY_ID.get("full-body"));
    Object.assign(routine, { sessionsPerWeek: 5, sessionMinutes: 60 });
    routine.setDayUnavailable("TUE", true); routine.setDayUnavailable("SAT", true);
    routine.generate();
    const days = routine.sessions.map(s => s.day);
    expect(days).not.toContain("TUE"); expect(days).not.toContain("SAT");
    expect(new Set(days).size).toBe(days.length);
  });

  test("a Focus muscle gets at least the sets a Normal one does", () => {
    const routine = new app.WeeklyRoutine();
    routine.selection.applyProgram(app.PROGRAM_BY_ID.get("full-body"));
    routine.experience = "advanced";
    routine.selection.setPriority("quads", "focus");
    const fit = routine.weekFit();
    expect(fit.targets.get("quads")).toBeGreaterThanOrEqual(fit.targets.get("hamstrings"));
  });

  test("an unanswered experience plans as a beginner", () => {
    const routine = new app.WeeklyRoutine();
    routine.selection.applyProgram(app.PROGRAM_BY_ID.get("push"));
    const asked = [...routine.plannedWeeklySets()];
    routine.experience = app.DEFAULT_EXPERIENCE;
    expect([...routine.plannedWeeklySets()]).toEqual(asked);
  });

  test("changing nothing but the priority changes the week", () => {
    const base = generatedWeek(app, { program: "full-body", sessions: 4, minutes: 75 });
    const routine = new app.WeeklyRoutine();
    routine.selection.applyProgram(app.PROGRAM_BY_ID.get("full-body"));
    Object.assign(routine, { sessionsPerWeek: 4, sessionMinutes: 75, experience: "advanced" });
    routine.selection.setPriority("chest", "focus");
    routine.generate();
    const chest = r => r.weeklyVolume().rows.find(x => x.muscle.id === "chest").sets;
    expect(chest(routine)).toBeGreaterThan(chest(base.routine));
  });
});
