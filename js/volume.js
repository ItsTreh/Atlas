/* ===========================================================================
   Volume — the one place that says how a set is counted.

   A COUNTED SET is the unit of volume. For one muscle, an exercise's sets
   count with a weight:

     1                         the muscle is a primary of the exercise
     WORKOUT.secondaryCredit   the muscle only assists (0.5, a heuristic;
                               evidence.js, "indirect-set-counting")
     0                         otherwise

   Weekly targets, the ranges and maxima in model.js, the per-session cap and
   every figure the page reports are counted sets. A squat done for the quads
   is one counted set for the quads and one for the glutes (both are primaries
   of the exercise) and half a set for the adductors.

   Everything that adds up what a muscle gets reads these two functions: the
   workout (Workout.counted), the week (WeeklyRoutine.weeklyVolume) and the
   builder (WorkoutBuilder), so they cannot disagree about a set. Time is a
   different measure, of performed sets, and lives in estimate.js.
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
