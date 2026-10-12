/* ===========================================================================
   Volume and time — the one place that says how a set is counted and what
   it costs. Every stage of the planner reads these, so they cannot disagree:
   fitToTime (estimate.js), the distribution (distribution.js), the workout
   builder (workouts.js), weeklyVolume (routine.js) and the audit (audit.js).

   A COUNTED SET is the unit of volume. For one muscle, an exercise's sets
   count with a weight:

     1                         the muscle is a primary of the exercise
     WORKOUT.secondaryCredit   the muscle only assists (0.5, a heuristic;
                               evidence.js, "indirect-set-counting")
     0                         otherwise

   Weekly targets, weekly ranges and maxima, the per-session cap and every
   number the audit reports are counted sets. A squat done for the quads is
   one counted set for the quads AND one for the glutes (both primaries; the
   glute growth from squats is similar to a hip thrust's in one trial,
   evidence.js "squat-glute-hypertrophy"), and half a set for the adductors.

   TIME is measured in PERFORMED sets, which is a different thing: one squat
   set takes one set's time however many muscles it counts for. A performed
   set costs its work plus the rest after it (compound or isolation), and each
   exercise costs its setup once. Before exercises are chosen the planner
   estimates performed sets as "counted target less the credit the selected
   muscles' lead lifts are expected to give" (plannedWork), with the same
   per-kind costs, so what is budgeted and what is timed use one model.

   AXIAL LOAD is a coarse category for how much an exercise loads the lower
   back and spine (high / none). It is a heuristic label, not a fatigue score:
   the planner uses it to keep heavy squats, hinges and bent rows from piling
   up in one session or on back-to-back days (evidence.js, "axial-load").
   ========================================================================= */

/** How much one set of `exercise` counts for `muscleId`: 1, the secondary credit, or 0. */
function creditWeight(exercise, muscleId) {
  if (exercise.primary.includes(muscleId)) return 1;
  if (exercise.secondary.includes(muscleId)) return WORKOUT.secondaryCredit;
  return 0;
}

/** Counted sets of `muscleId` in a list of entries ({ exercise, sets }). */
function countedSets(entries, muscleId) {
  return entries.reduce((t, e) => t + e.sets * creditWeight(e.exercise, muscleId), 0);
}

/** Minutes one performed set takes: the set itself and the rest after it. */
function setMinutes(compound) {
  return ESTIMATE.workSetMinutes + (compound ? ESTIMATE.restCompoundMinutes : ESTIMATE.restIsolationMinutes);
}

/** Minutes of one exercise: its setup once, then every set and its rest. */
function exerciseMinutes(compound, sets) {
  return sets > 0 ? ESTIMATE.setupMinutes + sets * setMinutes(compound) : 0;
}

/** Working minutes of a list of entries (no warm-up). */
function entriesMinutes(entries) {
  return entries.reduce((t, e) => t + exerciseMinutes(e.exercise.compound, e.sets), 0);
}

/**
 * Planning cost of one performed set for a muscle whose lead exercise is
 * `exercise`: the set, its rest, and the setup shared over a typical
 * exercise (WORKOUT.setsPerExercise sets). Same parts as exerciseMinutes.
 */
function plannedSetMinutes(exercise) {
  const compound = exercise ? exercise.compound : false;
  return setMinutes(compound) + ESTIMATE.setupMinutes / WORKOUT.setsPerExercise;
}

/**
 * The expected work behind counted targets before any exercise is chosen.
 * Muscles are taken biggest first, as the builder does; each one's performed
 * sets are its target less the credit the expected lifts (leadInfo) of the
 * muscles before it already give it, never under WORKOUT.minDirectSets (a selected muscle always
 * gets an exercise). Credit is only counted between the muscles in `targets`,
 * so pass one day's targets to estimate that day.
 *
 * @param targets  Map muscle id -> counted sets
 * @returns { minutes, performed: Map id -> performed sets }
 */
function plannedWork(targets) {
  const ids = [];
  for (const [id, n] of targets) if (n > 0) ids.push(id);
  const order = plannedOrder(ids);
  const credit = new Map();
  const performed = new Map();
  let minutes = 0;
  for (const id of order) {
    const lead = leadInfo(id, targets.get(id));
    const own = Math.max(WORKOUT.minDirectSets, targets.get(id) - (credit.get(id) || 0));
    performed.set(id, own);
    minutes += own * lead.setMinutes;
    for (const [other, w] of lead.weights)
      if (other !== id && targets.get(other) > 0) credit.set(other, (credit.get(other) || 0) + own * w);
  }
  return { minutes, performed };
}

/**
 * The sets each muscle is planned to get from exercises of its own, a whole
 * number: its counted target less the credit the week's lifts are expected
 * to give it (plannedWork), never under WORKOUT.minDirectSets. This is what
 * the distribution spreads over the days and the builder gives each muscle,
 * so the expected credit is taken off once, here, and nowhere again.
 */
function ownSets(targets) {
  const { performed } = plannedWork(targets);
  const out = new Map();
  for (const [id, n] of performed) out.set(id, Math.max(WORKOUT.minDirectSets, Math.round(n)));
  return out;
}

/** Minutes of `sets` performed sets of a muscle's own work, at its expected lifts' pace (no warm-up). */
function ownMinutes(muscleId, sets) {
  return sets * leadInfo(muscleId, sets).setMinutes;
}

/**
 * The exercises a muscle's sets are expected to go to, and what one of its
 * sets is worth to the others and costs in time, on average over them. A
 * session holds up to WORKOUT.maxSetsPerSession sets of a muscle, about
 * WORKOUT.setsPerExercise per exercise, one per movement; the builder takes
 * them in ranking order (exercisesFor). So a chest week of 16 sets is not 16
 * sets of the machine press: it is that press, a fly and an incline press,
 * and only two of the three give the triceps credit.
 */
const leadCache = new Map(), orderCache = new Map();
function leadInfo(id, target = WORKOUT.setsPerExercise) {
  const perSession = Math.min(Math.max(target, 1), WORKOUT.maxSetsPerSession);
  const count = Math.max(1, Math.round(perSession / WORKOUT.setsPerExercise));
  let byCount = leadCache.get(id);
  if (!byCount) leadCache.set(id, byCount = []);
  if (!byCount[count]) {
    const picks = [], movements = new Set();
    for (const ex of exercisesFor(id)) {
      if (picks.length >= count) break;
      if (movements.has(ex.movement)) continue;
      movements.add(ex.movement); picks.push(ex);
    }
    const weights = new Map();
    if (picks.length) for (const m of MUSCLES) {
      const w = picks.reduce((t, ex) => t + creditWeight(ex, m.id), 0) / picks.length;
      if (w) weights.set(m.id, w);
    }
    const setMinutes = picks.length
      ? picks.reduce((t, ex) => t + plannedSetMinutes(ex), 0) / picks.length
      : plannedSetMinutes(null);
    byCount[count] = { lead: picks[0] || null, picks, setMinutes, weights };
  }
  return byCount[count];
}
function plannedOrder(ids) {
  const key = ids.slice().sort().join(",");
  if (!orderCache.has(key))
    orderCache.set(key, ids.map(id => MUSCLE_BY_ID.get(id))
      .sort((a, b) => b.minutes - a.minutes || a.id.localeCompare(b.id)).map(m => m.id));
  return orderCache.get(key);
}

/* ------------------------------- axial load ------------------------------ */

/**
 * Exercises that load the spine heavily with a free weight, or hold the lower
 * back isometrically under a heavy load while bent forward. Named one by one
 * from the catalogue; anything not listed counts as "none". Machine and
 * supported variants (hack squat, leg press, chest-supported row) are left
 * out on purpose. A heuristic category (evidence.js, "axial-load").
 */
const AXIAL_HIGH = Object.freeze(new Set([
  "Barbell Back Squat", "Low-Bar Squat", "Barbell Front Squat",
  "Romanian Deadlift", "Deficit Pendlay Row"
]));

/** "high" or "none": how much the exercise loads the lower back and spine. */
function axialLoad(exercise) {
  return AXIAL_HIGH.has(exercise.name) ? "high" : "none";
}

/** How many high-axial exercises a list of entries holds. */
function axialCount(entries) {
  return entries.reduce((t, e) => t + (axialLoad(e.exercise) === "high" ? 1 : 0), 0);
}

(function checkAxial() {
  for (const name of AXIAL_HIGH)
    if (!EXERCISE_BY_NAME.has(name)) console.error("Volume data: axial list names \"" + name + "\", which is not in the catalogue");
})();

/** Counted sets below a goal that are not worth reporting (rounding). */
const VOLUME_TOLERANCE = 0.25;
