/* What the week says about itself is true: one meaning of "trained", a block
   left without a day is named with its cause, and advice is only given when
   following it would change the week. */
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp();
const ALL = ["chest", "shoulders", "triceps", "lats", "upper-back", "biceps", "quads", "hamstrings", "glutes", "calves"];

function week({ muscles = ALL, days, minutes = 60, split = "auto", experience = "intermediate" }) {
  const r = new app.WeeklyRoutine();
  for (const id of muscles) r.selection.set(id, true);
  Object.assign(r, { experience, sessionsPerWeek: days, sessionMinutes: minutes, split, preferredWindow: "evening" });
  return { r, result: r.generate() };
}

describe("a block with no day (Push · Pull · Legs over 2 days)", () => {
  const { r, result } = week({ days: 2, split: "push-pull-legs" });

  test("generate() names the block it left out", () => {
    expect(result.leftOut.map(b => b.name)).toEqual(["Push"]);
    expect(r.leftOut).toBe(result.leftOut);
  });

  test("its muscles are 'unplanned', not 'no time': generating again cannot change it", () => {
    const v = r.weeklyVolume();
    expect(v.unplanned.map(m => m.id).sort()).toEqual(["chest", "triceps"]);
    expect(v.noTime).toEqual([]);
    const again = r.generate();
    expect(again.leftOut.map(b => b.name)).toEqual(["Push"]);
  });

  test("with a day more, nothing is left out", () => {
    expect(r.extraDayFits()).toBe(true);
    const three = week({ days: 3, split: "push-pull-legs" });
    expect(three.result.leftOut).toEqual([]);
    expect(three.r.weeklyVolume().unplanned).toEqual([]);
  });

  test("a week with nothing left out reports an empty list", () => {
    expect(week({ days: 4 }).result.leftOut).toEqual([]);
  });
});

describe("one meaning of trained", () => {
  test("untrained is unplanned plus noTime, and every untrained muscle has no set's worth", () => {
    for (const [days, split] of [[2, "push-pull-legs"], [2, "upper-lower"], [3, "auto"], [4, "full-body"]]) {
      const v = week({ days, split }).r.weeklyVolume();
      expect([...v.unplanned, ...v.noTime].map(m => m.id).sort()).toEqual(v.untrained.map(m => m.id).sort());
      for (const m of v.untrained) expect(v.rows.find(x => x.muscle === m).times).toBe(0);
    }
  });

  test("a muscle the user's removed session carried is unplanned, with nothing left out", () => {
    const { r } = week({ days: 3, split: "push-pull-legs" });
    r.removeSession(r.sessions.find(s => s.block.name === "Pull"));
    const v = r.weeklyVolume();
    expect(v.unplanned.map(m => m.id).sort()).toEqual(["biceps", "lats", "upper-back"].filter(id =>
      v.untrained.some(m => m.id === id)));
    expect(r.leftOut).toEqual([]);
  });
});

describe("a training day more", () => {
  test("is not offered when every free day is already used", () => {
    const { r } = week({ days: 7 });
    expect(r.extraDayFits()).toBe(false);
  });

  test("is offered only if a trial week with a day more places one", () => {
    for (const days of [2, 3, 4]) {
      const { r } = week({ days });
      const trial = week({ days: days + 1 });
      expect(r.extraDayFits()).toBe(trial.result.placed > r.sessions.length);
    }
  });

  test("asking does not change the week", () => {
    const { r } = week({ days: 3 });
    const before = r.sessions.map(s => s.day + s.startHour + s.block.label).join();
    r.extraDayFits();
    expect(r.sessions.map(s => s.day + s.startHour + s.block.label).join()).toBe(before);
  });
});
