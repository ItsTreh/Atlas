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

   The weekly sets come from one table, weeklyTargets (evidence.js): a
   target and a floor for each priority, and a ceiling, on the main scale
   or the accessory one (Muscle.kind). They are planning defaults built on
   the volume research (docs/training-evidence.md): more sets help with
   diminishing returns, and no threshold exists.
   ========================================================================= */

const ESTIMATE = Object.freeze({
  workSetMinutes:       configValue("workSetMinutes"),        // doing one set
  restCompoundMinutes:  configValue("restCompoundMinutes"),   // rest after a compound set
  restIsolationMinutes: configValue("restIsolationMinutes"),  // rest after an isolation set
  setupMinutes:         configValue("setupMinutes"),          // per exercise: weights, machine, position
  minutesPerSet: configValue("minutesPerSet"),   // planning average for one set, all of the above shared
  warmupMinutes: configValue("warmupMinutes")     // per session, not available for working sets
});

/* Experience, asked once. It does not change the weekly targets (weeklyTarget):
   it is kept for the starting point and ramp, once training is logged. */
const EXPERIENCE_LEVELS = Object.freeze([
  { id: "beginner",     label: "Under 6 months" },
  { id: "intermediate", label: "6 months to 2 years" },
  { id: "advanced",     label: "More than 2 years" }
]);

/** The weekly sets scale a muscle uses (weeklyTargets, by Muscle.kind). */
const weeklyScale = muscle => configValue("weeklyTargets")[muscle.kind];

/**
 * Hard sets a week to aim for on one muscle at `priority`. Experience does
 * not change it: the research shows no experience-specific curve. Null for
 * an unknown priority.
 */
function weeklyTarget(muscle, priority = "normal") {
  const level = weeklyScale(muscle)[priority];
  return level ? level.target : null;
}

/** The least a short week trims a muscle at `priority` to before it says so. */
function weeklyFloor(muscle, priority = "normal") {
  return weeklyScale(muscle)[priority].floor;
}

/** The most a muscle is given a week, at any priority: past it no extra growth has been shown. */
const weeklyCeiling = muscle => weeklyScale(muscle).ceiling;

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
   week the targets fit is a week the sessions can hold. Each exercise adds
   its setup, split the way the builder splits a muscle's sets. A set is
   timed with the rest Workout.minutes will give it: a muscle with no
   compound in the catalogue can only get isolation sets, so it rests
   restIsolationMinutes; any other muscle (or one not named) rests
   restCompoundMinutes, the longer one, since the workout may pick compounds
   for it. The finished session is timed exercise by exercise
   (Workout.minutes) and can only come out the same or shorter. */

const compoundCache = new Map();
/** Whether any compound in the catalogue trains `muscleId` as a primary. */
function hasCompounds(muscleId) {
  if (!compoundCache.has(muscleId))
    compoundCache.set(muscleId, EXERCISES.some(e => e.compound && e.trainsPrimarily(muscleId)));
  return compoundCache.get(muscleId);
}

/** Rest after one set of `muscleId` (see above); compound rest when the muscle isn't named. */
const restFor = muscleId => muscleId && !hasCompounds(muscleId)
  ? ESTIMATE.restIsolationMinutes : ESTIMATE.restCompoundMinutes;

/** Exercises the builder splits `sets` of one muscle into in one session (WorkoutBuilder.buildOne). */
const exercisesForSets = sets => Math.max(1, Math.round(sets / WORKOUT.setsPerExercise));

/** Working minutes for `sets` of one muscle (`muscleId`) in one session. */
function muscleSessionMinutes(sets, muscleId = null) {
  if (sets <= 0) return 0;
  return sets * (ESTIMATE.workSetMinutes + restFor(muscleId)) +
         exercisesForSets(sets) * ESTIMATE.setupMinutes;
}

/**
 * Working minutes for one muscle's weekly sets, spread over as many sessions
 * as distribution.js starts it with: enough to keep each at or under
 * WORKOUT.maxSetsPerSession, at most `days`.
 */
function muscleWeekMinutes(sets, days = Infinity, muscleId = null) {
  if (sets <= 0) return 0;
  const times = Math.max(1, Math.min(days, Math.ceil(sets / WORKOUT.maxSetsPerSession)));
  const base = Math.floor(sets / times), extra = sets % times;
  let minutes = 0;
  for (let i = 0; i < times; i++) minutes += muscleSessionMinutes(base + (i < extra ? 1 : 0), muscleId);
  return minutes;
}

/**
 * The order credit flows in when the plan turns targets into direct sets:
 * biggest share of a session first (Muscle.minutes, the workout builder's
 * order), ties by position in MUSCLES. Credit only flows from a muscle to
 * one after it, so pairs that credit each other (chest and triceps,
 * shoulders and triceps) are settled the same way every time.
 */
function planOrder(muscles) {
  return [...muscles].sort((a, b) => b.minutes - a.minutes || MUSCLES.indexOf(a) - MUSCLES.indexOf(b));
}

/**
 * Sessions a week the time model gives `sets` direct sets of one muscle:
 * enough to keep each at or under WORKOUT.maxSetsPerSession, at most `days`.
 */
const sessionsFor = (sets, days = Infinity) =>
  Math.max(1, Math.min(days, Math.ceil(sets / WORKOUT.maxSetsPerSession)));

/**
 * The direct sets that deliver each muscle's weekly target, counting the
 * planned overlap (plannedOverlap, set-credit.js) from muscles earlier in
 * planOrder. Targets are effective sets: direct + credit.
 *
 *   • A muscle's sets give credit only from its first exercise in each
 *     session, the compound the workout opens with: at most
 *     WORKOUT.maxSetsPerExercise sets a session (sessionsFor).
 *   • Half-target rule (assistedShareCap, evidence.js; [D]): for Normal and
 *     Focus, credit below 1 covers at most that share of the target; the
 *     rest is direct work. Maintain is exempt: keeping a muscle needs load
 *     and effort more than set count (the user's call, 2026-11-09).
 *   • Never fewer direct sets than WORKOUT.minDirectSets (or the target, if
 *     smaller): a chosen muscle always gets an exercise of its own.
 *
 * Direct sets are whole sets, rounded up, so the plan never books less than
 * the target. Returns { direct: Map id -> sets, credit: Map id -> the
 * credit counted toward it }.
 */
function directSetsFor(targets, muscles, priorities = new Map(), days = Infinity) {
  const direct = new Map(), credit = new Map();
  const share = configValue("assistedShareCap");
  const order = planOrder(muscles);
  for (const [i, m] of order.entries()) {
    const target = targets.get(m.id) || 0;
    if (target <= 0) { direct.set(m.id, 0); credit.set(m.id, 0); continue; }
    let part = 0, full = 0;
    for (const from of order.slice(0, i)) {
      const sets = direct.get(from.id);
      const c = sets ? plannedOverlap(from.id, m.id).credit : 0;
      if (!c) continue;
      const credited = Math.min(sets, WORKOUT.maxSetsPerExercise * sessionsFor(sets, days)) * c;
      if (c < 1) part += credited; else full += credited;
    }
    const capped = (priorities.get(m.id) || "normal") === "maintain" ? part : Math.min(part, target * share);
    const counted = Math.min(target, capped + full);
    direct.set(m.id, Math.max(Math.min(WORKOUT.minDirectSets, target), Math.ceil(target - counted - 1e-9)));
    credit.set(m.id, counted);
  }
  return { direct, credit };
}

/**
 * Whether the weekly targets fit the time the user has, and what to do if
 * not. `targets` is a Map of muscle id -> sets; `muscles` are the Muscle
 * objects; `priorities` maps id -> "maintain" | "normal" | "focus".
 *
 * Over budget, sets come off one at a time: Normal muscles first, then Focus,
 * each from whichever is furthest above its floor (weeklyFloor), never below
 * it. If even the floors do not fit, Normal, then Focus, then Maintain
 * muscles are lowered further, one set at a time from whichever has the
 * most, but never below the Maintain floor: with diminishing returns the
 * first sets on a muscle are worth the most, so the cheap floor is the last
 * thing to go. A muscle taken under its own priority's floor is listed in
 * `belowMinimum` so the page can say so. Returns
 *   { targets, fits, meetsMinimums, neededMinutes, requestedMinutes, capacityMinutes,
 *     trimmed: [muscle ids lowered], belowMinimum: [muscle ids under their
 *     usual minimum], fixes: { extraDay, sessionMinutes } }
 * where a fix is the change that would let the requested targets fit
 * (null when it would not, or is unavailable).
 */
function fitToTime(targets, muscles, priorities, sessionsPerWeek, sessionMinutes) {
  const minutesOver = (map, days) => [...map].reduce((t, [id, n]) => t + muscleWeekMinutes(n, days, id), 0);
  const minutesFor = (map, perWeek, len) => minutesOver(map, perWeek) <= perWeek * usableMinutes(len);
  const total = map => minutesOver(map, sessionsPerWeek);
  const level = id => priorities.get(id) || "normal";
  const byId = new Map(muscles.map(m => [m.id, m]));
  const floor = new Map(muscles.map(m => [m.id, weeklyFloor(m, level(m.id))]));
  const lowest = id => weeklyFloor(byId.get(id), "maintain");
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

  // Not even the floors fit: lower them too, Maintain last and never below its floor.
  const belowMinimum = new Set();
  for (const group of ["normal", "focus", "maintain"]) {
    for (;;) {
      if (total(out) <= capacity) break;
      const candidates = [...out.keys()].filter(id => level(id) === group && out.get(id) > lowest(id));
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
 * @param priorityOf      function(muscle) -> its priority; Normal by default
 * @returns null when nothing is selected, otherwise ranges as {low, high}:
 *          every muscle at its floor, and at its target
 */
function estimateTraining(muscles, sessionMinutes, priorityOf = () => "normal") {
  if (!muscles.length) return null;

  const low = m => weeklyFloor(m, priorityOf(m)), high = m => weeklyTarget(m, priorityOf(m));
  const sets = {
    low:  muscles.reduce((t, m) => t + low(m), 0),
    high: muscles.reduce((t, m) => t + high(m), 0)
  };
  // The same time model as fitToTime, so this note and the fit note agree.
  const minutes = {
    low:  Math.round(muscles.reduce((t, m) => t + muscleWeekMinutes(low(m), Infinity, m.id), 0)),
    high: Math.round(muscles.reduce((t, m) => t + muscleWeekMinutes(high(m), Infinity, m.id), 0))
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
