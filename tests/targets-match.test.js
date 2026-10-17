/* The sets each muscle gets match the target the page shows, and the fit note
   agrees with the week Generate places (review of #69, condition for stage 2).

   Counting is weeklyVolume()'s: direct sets plus half credit for assisting
   ones. A muscle ends the week at most 1 set under its target and at most 2
   over (less than one more exercise), except:
     • a muscle the lifts for others already cover (assisting credit alone
       reaches its target): "Covered by the lifts above";
     • a muscle the split gave no day: named by leftOut / "unplanned".
   The note says the week fits only when nothing is short. */
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp();
const PROGRAMS = ["full-body", "upper", "lower", "push", "pull", "legs", "chest-triceps", "back-biceps", "shoulders-arms", "core"];
const SPLITS = ["auto", "upper-lower", "push-pull-legs", "full-body"];
const { under, over } = app.TARGET_MATCH;

function week({ program, split, experience, days, minutes, focusFirst }) {
  const r = new app.WeeklyRoutine();
  r.selection.applyProgram(app.PROGRAM_BY_ID.get(program));
  if (focusFirst) r.selection.setPriority(r.selection.muscles()[0].id, "focus");
  Object.assign(r, { experience, sessionsPerWeek: days, sessionMinutes: minutes, split, preferredWindow: "evening" });
  r.nutrition.showMeals = true;
  const fit = r.weekFit();            // read before Generate: what the page shows
  const result = r.generate();
  return { r, fit, result, volume: r.weeklyVolume() };
}

/** Every way a muscle can miss its target, as strings (empty when it matches). */
function misses({ r, fit, volume }) {
  const out = [];
  for (const m of r.selectedMuscles().filter(x => app.exercisesFor(x.id).length)) {
    const target = fit.targets.get(m.id);
    let direct = 0, assisted = 0, own = 0;
    for (const s of r.sessions) {
      direct += s.workout.directSets(m.id);
      assisted += s.workout.assistedSets(m.id);
      own += s.workout.entriesFor(m.id).length;
    }
    const got = direct + assisted;
    const floor = target >= m.weeklySets[0] ? Math.max(target - under, m.weeklySets[0]) : target - under;
    if (got >= floor && got <= target + over) continue;
    if (got > target + over && own === 0 && assisted >= target) continue;   // covered by the lifts above
    if (volume.unplanned.includes(m)) continue;                              // no day, named in the status
    out.push(m.id + " target " + target + " got " + got);
  }
  return out;
}

describe("the sets each muscle gets match the target shown", () => {
  for (const split of SPLITS) test(split + ": every program, level, length and day count", () => {
    const bad = [];
    for (const program of PROGRAMS) for (const experience of ["beginner", "intermediate", "advanced"])
      for (const days of [2, 3, 4, 5, 6]) for (const minutes of [45, 60, 90]) for (const focusFirst of [false, true]) {
        const w = week({ program, split, experience, days, minutes, focusFirst });
        for (const miss of misses(w))
          bad.push([program, experience, days + "x" + minutes, focusFirst ? "focus" : "", miss].join(" "));
      }
    expect(bad).toEqual([]);
  }, 60000);
});

describe("a target is only lowered for a reason the page gives", () => {
  // The shown target comes down only when the time cannot hold it (the note
  // says "we lowered …"), when recovery leaves fewer days than asked, or when
  // a split leaves the muscle without a day. Otherwise it stays what the
  // experience and priority ask for, give or take the 1 set of TARGET_MATCH.
  test("with time, days and a day for every muscle, targets stay within 1 set of the ask", () => {
    const bad = [];
    for (const split of SPLITS) for (const program of PROGRAMS) for (const experience of ["beginner", "intermediate", "advanced"])
      for (const days of [2, 3, 4, 5, 6]) for (const minutes of [45, 60, 90]) {
        const w = week({ program, split, experience, days, minutes });
        const muscles = w.r.selection.muscles().filter(m => app.exercisesFor(m.id).length);
        const raw = new Map(muscles.map(m => [m.id, app.weeklyTarget(m, experience, w.r.selection.priority(m.id))]));
        const pure = app.fitToTime(raw, muscles, new Map(muscles.map(m => [m.id, w.r.selection.priority(m.id)])),
                                   w.fit.askedDays, minutes);
        if (pure.trimmed.length || w.fit.days < w.fit.askedDays || w.fit.unplaced.length) continue;
        for (const m of muscles)
          if (w.fit.targets.get(m.id) < raw.get(m.id) - under)
            bad.push([split, program, experience, days + "x" + minutes, m.id, raw.get(m.id) + "→" + w.fit.targets.get(m.id)].join(" "));
      }
    expect(bad).toEqual([]);
  }, 60000);
});

describe("the fit note agrees with what Generate places", () => {
  test("it says the days it really uses, and 'fits' only when nothing is short", () => {
    const bad = [];
    for (const split of SPLITS) for (const program of PROGRAMS) for (const experience of ["beginner", "advanced"])
      for (const days of [2, 4, 6]) for (const minutes of [45, 90]) {
        const w = week({ program, split, experience, days, minutes });
        const tag = [split, program, experience, days + "x" + minutes].join(" ");
        const asked = Math.min(days, w.r.availableDays().length);
        // The days the note counts are the sessions placed (a repeat taken
        // out for having nothing to do is the one allowed difference).
        if (w.fit.days > asked || w.result.placed > w.fit.days) bad.push(tag + " days " + w.fit.days + " placed " + w.result.placed);
        // The capacity it quotes is the sessions Generate places, no more.
        const usable = Math.max(15, minutes - app.ESTIMATE.warmupMinutes);
        if (w.fit.capacityMinutes !== w.result.placed * usable)
          bad.push(tag + " capacity " + w.fit.capacityMinutes + " for " + w.result.placed + " sessions");
        // A muscle with no day is not also listed as lowered below its minimum.
        for (const id of w.fit.unplaced) if (w.fit.belowMinimum.includes(id)) bad.push(tag + " " + id + " unplaced and below minimum");
        if (w.fit.fits && w.fit.meetsMinimums && !w.fit.unplaced.length &&
            (w.volume.noTime.length || w.volume.short.length)) bad.push(tag + " says fits but a muscle is short");
        const left = new Set(w.result.leftOut ? w.result.leftOut.flatMap(b => b.muscles.map(m => m.id)) : []);
        for (const id of w.fit.unplaced) if (!left.has(id)) bad.push(tag + " unplaced " + id + " not in leftOut");
      }
    expect(bad).toEqual([]);
  }, 60000);

  test("a split with a day too many names the muscles it leaves out", () => {
    const w = week({ program: "full-body", split: "push-pull-legs", experience: "intermediate", days: 2, minutes: 60 });
    expect(w.fit.unplaced.length).toBeGreaterThan(0);
    expect(w.result.leftOut.map(b => b.name)).toEqual(["Push"]);
  });
});

describe("one time model", () => {
  test("a week the fit says fits is a week the sessions can hold", () => {
    for (const program of PROGRAMS) for (const minutes of [45, 60, 90]) {
      const w = week({ program, split: "auto", experience: "intermediate", days: 4, minutes });
      for (const s of w.r.sessions) expect(s.workout.minutes, program + " " + minutes).toBeLessThanOrEqual(minutes);
    }
  });
  test("the estimate and the fit time a muscle's sets the same way", () => {
    for (const sets of [2, 4, 8, 12, 16]) {
      expect(app.muscleWeekMinutes(sets)).toBeGreaterThan(0);
      expect(app.muscleWeekMinutes(sets)).toBeGreaterThanOrEqual(app.muscleSessionMinutes(Math.min(sets, app.WORKOUT.maxSetsPerSession)));
    }
  });
});
