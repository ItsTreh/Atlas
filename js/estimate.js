/* ===========================================================================
   Progress estimate — a first, deliberately rough answer to "what will it
   take to train these muscles?"

   It turns the chosen muscles into ranges: hard sets a week, time a week, and
   sessions at the chosen length. It does NOT predict when anyone will reach a
   particular physique. Nobody can: rate of progress depends on training
   history, sleep, food, age and genetics, none of which the app knows. What
   the app can say is how much training the goal usually takes, and how long
   consistent training usually runs before changes show. That is what this
   returns.

   The volume ranges come from each muscle's `weeklySets` (model.js), which
   follow the common reading of weekly-volume research: roughly 10 hard sets
   a week per muscle is where growth reliably shows, with small muscles
   needing less direct work because compound lifts already train them.
   ========================================================================= */

const ESTIMATE = Object.freeze({
  workSetMinutes:       configValue("workSetMinutes"),        // doing one set
  restCompoundMinutes:  configValue("restCompoundMinutes"),   // rest after a compound set
  restIsolationMinutes: configValue("restIsolationMinutes"),  // rest after an isolation set
  setupMinutes:         configValue("setupMinutes"),          // per exercise: weights, machine, position
  minutesPerSet: configValue("minutesPerSet"),   // planning average for one set, all of the above shared
  warmupMinutes: configValue("warmupMinutes")     // per session, not available for working sets
});

/* Experience, asked once. The weekly target for each muscle starts from it. */
const EXPERIENCE_LEVELS = Object.freeze([
  { id: "beginner",     label: "Under 6 months" },
  { id: "intermediate", label: "6 months to 2 years" },
  { id: "advanced",     label: "More than 2 years" }
]);

/**
 * Hard sets a week to aim for on one muscle: its range [low, high], then a
 * fraction of the way up it by experience and priority. A whole number that
 * always lies inside the range. Returns null until experience is known.
 */
function weeklyTarget(muscle, experience, priority = "normal") {
  const table = configValue("weeklyTargetFraction")[experience];
  if (!table || table[priority] === undefined) return null;
  const [low, high] = muscle.weeklySets;
  return Math.max(low, Math.min(high, Math.round(low + table[priority] * (high - low))));
}

/** What the plan assumes while the user has not said how long they have trained. */
const DEFAULT_EXPERIENCE = "beginner";

/** Session lengths the page offers, used when suggesting a longer one. */
const SESSION_LENGTH_OPTIONS = Object.freeze([45, 60, 75, 90]);

/** Minutes of working sets one session can hold, after the warm-up. */
const usableMinutes = sessionMinutes => Math.max(15, sessionMinutes - ESTIMATE.warmupMinutes);

/* ------------------------------ time model --------------------------------
   The one way the planner times sets before the exercises are chosen. The
   fit (fitToTime), the estimate (estimateTraining), the distribution
   (distribution.js) and the workout builder (workouts.js) all use it, so a
   week the targets fit is a week the sessions can hold. Every set is timed
   with the compound rest, the longer one, and each exercise adds its setup,
   split the way the builder splits a muscle's sets; the finished session is
   then timed exercise by exercise (Workout.minutes) and can only come out
   the same or shorter. */

/** Exercises the builder splits `sets` of one muscle into in one session (WorkoutBuilder.buildOne). */
const exercisesForSets = sets => Math.max(1, Math.round(sets / WORKOUT.setsPerExercise));

/** Working minutes for `sets` of one muscle in one session. */
function muscleSessionMinutes(sets) {
  if (sets <= 0) return 0;
  return sets * (ESTIMATE.workSetMinutes + ESTIMATE.restCompoundMinutes) +
         exercisesForSets(sets) * ESTIMATE.setupMinutes;
}

/**
 * Working minutes for one muscle's weekly sets, spread over as many sessions
 * as distribution.js starts it with: enough to keep each at or under
 * WORKOUT.maxSetsPerSession, at most `days`.
 */
function muscleWeekMinutes(sets, days = Infinity) {
  if (sets <= 0) return 0;
  const times = Math.max(1, Math.min(days, Math.ceil(sets / WORKOUT.maxSetsPerSession)));
  const base = Math.floor(sets / times), extra = sets % times;
  let minutes = 0;
  for (let i = 0; i < times; i++) minutes += muscleSessionMinutes(base + (i < extra ? 1 : 0));
  return minutes;
}

/**
 * Whether the weekly targets fit the time the user has, and what to do if
 * not. `targets` is a Map of muscle id -> sets; `muscles` are the Muscle
 * objects (for each one's floor, the low end of its range); `priorities`
 * maps id -> "maintain" | "normal" | "focus".
 *
 * Over budget, sets come off one at a time: Normal muscles first, then Focus,
 * each from whichever is furthest above its floor, never below the floor.
 * Maintain is already at its floor. If even the floors do not fit, every
 * muscle still gets trained: Maintain, then Normal, then Focus muscles are
 * lowered below their usual minimum, one set at a time from whichever has the
 * most, down to WORKOUT.minDirectSets, and listed in `belowMinimum` so the
 * page can say so. Returns
 *   { targets, fits, meetsMinimums, neededMinutes, requestedMinutes, capacityMinutes,
 *     trimmed: [muscle ids lowered], belowMinimum: [muscle ids under their
 *     usual minimum], fixes: { extraDay, sessionMinutes } }
 * where a fix is the change that would let the requested targets fit
 * (null when it would not, or is unavailable).
 */
function fitToTime(targets, muscles, priorities, sessionsPerWeek, sessionMinutes) {
  const minutesOver = (map, days) => [...map.values()].reduce((t, n) => t + muscleWeekMinutes(n, days), 0);
  const minutesFor = (map, perWeek, len) => minutesOver(map, perWeek) <= perWeek * usableMinutes(len);
  const total = map => minutesOver(map, sessionsPerWeek);
  const floor = new Map(muscles.map(m => [m.id, m.weeklySets[0]]));
  const level = id => priorities.get(id) || "normal";
  const capacity = sessionsPerWeek * usableMinutes(sessionMinutes);

  const out = new Map(targets);
  const trimmed = new Set();
  for (const group of ["normal", "focus"]) {
    for (;;) {
      if (total(out) <= capacity) break;
      const candidates = [...out.keys()].filter(id => level(id) === group && out.get(id) > floor.get(id));
      if (!candidates.length) break;
      const id = candidates.reduce((a, b) =>
        out.get(b) - floor.get(b) > out.get(a) - floor.get(a) ? b : a);
      out.set(id, out.get(id) - 1);
      trimmed.add(id);
    }
  }

  // Not even the minimums fit: lower them too, least important first.
  const belowMinimum = new Set();
  for (const group of ["maintain", "normal", "focus"]) {
    for (;;) {
      if (total(out) <= capacity) break;
      const candidates = [...out.keys()].filter(id => level(id) === group && out.get(id) > WORKOUT.minDirectSets);
      if (!candidates.length) break;
      const id = candidates.reduce((a, b) => out.get(b) > out.get(a) ? b : a);
      out.set(id, out.get(id) - 1);
      trimmed.add(id);
      if (out.get(id) < floor.get(id)) belowMinimum.add(id);
    }
  }

  const fixes = { extraDay: null, sessionMinutes: null };
  if (total(targets) > capacity) {
    if (sessionsPerWeek < TRAINING_DAYS_RANGE[1] && minutesFor(targets, sessionsPerWeek + 1, sessionMinutes))
      fixes.extraDay = sessionsPerWeek + 1;
    fixes.sessionMinutes = SESSION_LENGTH_OPTIONS.find(len =>
      len > sessionMinutes && minutesFor(targets, sessionsPerWeek, len)) || null;
  }
  return {
    targets: out, fits: total(out) <= capacity, neededMinutes: total(out),
    requestedMinutes: total(targets), capacityMinutes: capacity,
    trimmed: [...trimmed], belowMinimum: [...belowMinimum],
    meetsMinimums: belowMinimum.size === 0, fixes
  };
}

/* The phases are typical, not promised, and all assume consistency. */
const PROGRESS_PHASES = Object.freeze([
  { when: "Weeks 1–4",
    what: "Lifts go up fast, mostly because your nervous system is learning " +
          "the movements. Little visible change yet — that is normal." },
  { when: "Weeks 6–12",
    what: "Muscle growth usually becomes measurable: tape measurements, " +
          "photos and how clothes fit start to move." },
  { when: "Months 4–12+",
    what: "Changes other people notice. How fast varies widely from person " +
          "to person, and slows the longer you have trained." }
]);

/**
 * @param muscles         the Muscle objects being targeted
 * @param sessionMinutes  the planned session length
 * @returns null when nothing is selected, otherwise ranges as {low, high}
 */
function estimateTraining(muscles, sessionMinutes) {
  if (!muscles.length) return null;

  const sets = {
    low:  muscles.reduce((t, m) => t + m.weeklySets[0], 0),
    high: muscles.reduce((t, m) => t + m.weeklySets[1], 0)
  };
  // The same time model as fitToTime, so this note and the fit note agree.
  const minutes = {
    low:  Math.round(muscles.reduce((t, m) => t + muscleWeekMinutes(m.weeklySets[0]), 0)),
    high: Math.round(muscles.reduce((t, m) => t + muscleWeekMinutes(m.weeklySets[1]), 0))
  };
  const usable = usableMinutes(sessionMinutes);
  const sessions = {
    low:  Math.max(1, Math.ceil(minutes.low  / usable)),
    high: Math.max(1, Math.ceil(minutes.high / usable))
  };

  return {
    muscleCount: muscles.length,
    sets, minutes, sessions, sessionMinutes,
    phases: PROGRESS_PHASES
  };
}
