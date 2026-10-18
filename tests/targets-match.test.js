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

/** Weekdays busy until 18:00, as for someone at work: the evening is all there is to train in. */
const WORKDAYS = ["MON", "TUE", "WED", "THU", "FRI"];
function busyUntil18(r) {
  for (const day of WORKDAYS) for (let h = app.FIRST_HOUR; h < 18; h++) r.markBusy(day, h);
}

function week({ program, split, experience, days, minutes, focusFirst, busy = false }) {
  const r = new app.WeeklyRoutine();
  r.selection.applyProgram(app.PROGRAM_BY_ID.get(program));
  if (focusFirst) r.selection.setPriority(r.selection.muscles()[0].id, "focus");
  Object.assign(r, { experience, sessionsPerWeek: days, sessionMinutes: minutes, split, preferredWindow: "evening" });
  r.nutrition.showMeals = true;                 // meals on: their hours push a session within the evening
  if (busy) busyUntil18(r);
  const fit = r.weekFit();            // read before Generate: what the page shows
  const plan = r.weekPlan(experience);          // the week the page worked out before Generate
  const result = r.generate();
  return { r, fit, plan, result, volume: r.weeklyVolume() };
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

describe("with a busy calendar and meals on (review of #70)", () => {
  // Weekdays busy until 18:00 leave a short evening, where a meal hour can move
  // a session by an hour and so change which days and blocks the scheduler picks.
  // A preview that scheduled without the meals told the user "fits" for a week
  // Generate then could not place (biceps 7 → 3, Upper on PPL 3 × 75).
  test("the sets still match the target shown", () => {
    const bad = [];
    for (const split of SPLITS) for (const program of PROGRAMS) for (const experience of ["beginner", "intermediate"])
      for (const days of [2, 3, 4, 5]) for (const minutes of [60, 75, 90]) {
        const w = week({ program, split, experience, days, minutes, busy: true });
        for (const miss of misses(w))
          bad.push([split, program, experience, days + "x" + minutes, miss].join(" "));
      }
    expect(bad).toEqual([]);
  }, 90000);

  test("Generate places the week the preview worked out, session for session", () => {
    const bad = [];
    for (const busy of [false, true]) for (const split of SPLITS) for (const program of PROGRAMS)
      for (const [days, minutes] of [[3, 75], [5, 75], [4, 60], [2, 90]]) {
        const w = week({ program, split, experience: "intermediate", days, minutes, busy });
        const tag = [busy ? "busy" : "free", split, program, days + "x" + minutes].join(" ");
        const placed = w.r.sessions.map(s => s.day + s.startHour + s.block.label).sort();
        const planned = w.plan.placements.map(p => p.day + p.start + p.block.label).sort();
        if (JSON.stringify(placed) !== JSON.stringify(planned)) bad.push(tag + " placed " + placed + " planned " + planned);
        if (w.result.dropped !== w.plan.dropped) bad.push(tag + " dropped " + w.result.dropped + " vs " + w.plan.dropped);
        if (w.r.weekPlan("intermediate") !== w.plan) bad.push(tag + " Generate changed the plan it placed");
      }
    expect(bad).toEqual([]);
  }, 90000);

  test("the scheduler reads the same meal hours the diet shows", () => {
    const r = new app.WeeklyRoutine();
    for (const count of app.MEAL_COUNTS) {
      r.nutrition.mealsPerDay = count; r.nutrition.moved = {};
      expect(r.nutrition.mealHours, "meals " + count).toEqual(r.nutrition.meals.map(m => m.hour));
    }
  });
});

describe("overshoot: deliberate fails, incidental is allowed (review of #70)", () => {
  // Deliberate: sets chosen for a muscle that has already reached its target
  // (time left over is not a reason). Incidental: whole-exercise rounding, or a
  // compound lift picked for a muscle still short that also trains this one.
  // Both land above the target; only the second is allowed, up to TARGET_MATCH.over.
  const ownSets = (r, id) => r.sessions.reduce((t, s) =>
    t + s.workout.entriesFor(id).reduce((u, e) => u + e.sets, 0), 0);

  test("sets chosen for a muscle never take it past its target", () => {
    const bad = [];
    for (const busy of [false, true]) for (const split of SPLITS) for (const program of PROGRAMS)
      for (const experience of ["beginner", "advanced"]) for (const [days, minutes] of [[3, 75], [4, 90], [5, 60], [2, 45]]) {
        const w = week({ program, split, experience, days, minutes, busy });
        for (const m of w.r.selectedMuscles().filter(x => app.exercisesFor(x.id).length)) {
          const own = ownSets(w.r, m.id), target = w.fit.targets.get(m.id);
          if (own > target) bad.push([busy ? "busy" : "free", split, program, experience, days + "x" + minutes, m.id, "own " + own + " target " + target].join(" "));
        }
      }
    expect(bad).toEqual([]);
  }, 90000);

  test("no muscle above its target keeps a set of its own that could be shed", () => {
    // Own sets plus the credit of lifts chosen for other muscles can land above the
    // target. What the plan can take off without costing another muscle its floor
    // it takes off; what stays is rounding or other muscles' needs.
    const bad = [];
    for (const busy of [false, true]) for (const split of SPLITS) for (const program of PROGRAMS)
      for (const [days, minutes] of [[3, 75], [4, 90], [5, 60]]) {
        const w = week({ program, split, experience: "advanced", days, minutes, busy });
        const builder = new app.WorkoutBuilder(w.r.sessions, minutes, w.fit.targets);
        for (const m of w.r.selectedMuscles().filter(x => app.exercisesFor(x.id).length)) {
          const credit = w.r.sessions.reduce((t, s) => t + s.workout.directSets(m.id) + s.workout.assistedSets(m.id), 0);
          if (credit > w.fit.targets.get(m.id) && builder.shedSet(m.id))
            bad.push([busy ? "busy" : "free", split, program, days + "x" + minutes, m.id].join(" "));
        }
      }
    expect(bad).toEqual([]);
  }, 90000);

  test("a lone muscle with time to spare gets its target, not its maximum", () => {
    // Nothing else is chosen, so nothing is incidental: 90 minutes a session
    // and the whole week free must not stretch a muscle past its target.
    const bad = [];
    for (const m of app.MUSCLES.filter(x => app.exercisesFor(x.id).length)) for (const experience of ["beginner", "advanced"]) {
      const r = new app.WeeklyRoutine();
      r.selection.set(m.id, true);
      Object.assign(r, { experience, sessionsPerWeek: 3, sessionMinutes: 90, split: "auto", preferredWindow: "evening" });
      const target = r.weekFit().targets.get(m.id);
      r.generate();
      const got = r.weeklyVolume().rows[0].sets;
      if (got > target || got < target - app.TARGET_MATCH.under) bad.push(m.id + " " + experience + " target " + target + " got " + got);
    }
    expect(bad).toEqual([]);
  });

  test("a compound for a muscle still short may push another past its target, within +2", () => {
    // Full body, beginner, 3 x 75: the glutes' target is 3 and they get 5, all of it
    // from squats chosen for the quads. Allowed; no lift is chosen for the glutes.
    const w = week({ program: "full-body", split: "full-body", experience: "beginner", days: 3, minutes: 75 });
    const target = w.fit.targets.get("glutes");
    const got = w.r.weeklyVolume().rows.find(x => x.muscle.id === "glutes").sets;
    expect(got).toBeGreaterThan(target);
    expect(got).toBeLessThanOrEqual(target + app.TARGET_MATCH.over);
    expect(ownSets(w.r, "glutes")).toBe(0);
  });

  test("a lift that would take a muscle past its target ranks below an alternative that would not", () => {
    const hamstrings = app.MUSCLE_BY_ID.get("hamstrings");
    const pick = glutesSoFar => {
      const builder = new app.WorkoutBuilder([], 60, new Map([["hamstrings", 6], ["glutes", 3]]));
      builder.setsThisWeek.set("glutes", glutesSoFar);
      return builder.bestFor(hamstrings, new app.TrainingBlock([hamstrings]), new app.Workout([hamstrings], []));
    };
    const first = pick(0);                         // glutes still short: the best hamstring lift, whatever it credits
    const spared = pick(3);                        // glutes at their target
    expect(first.primary).toContain("glutes");     // Romanian deadlift: trains the glutes too
    expect(spared.primary).not.toContain("glutes");
  });
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
