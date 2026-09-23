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
  minutesPerSet: 2.5,   // one working set plus the rest after it
  warmupMinutes: 10,    // per session, not available for working sets
  timesPerWeek:  2      // how often each muscle is best trained
});

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
  const minutes = {
    low:  Math.round(sets.low  * ESTIMATE.minutesPerSet),
    high: Math.round(sets.high * ESTIMATE.minutesPerSet)
  };
  const usable = Math.max(15, sessionMinutes - ESTIMATE.warmupMinutes);
  const sessions = {
    low:  Math.max(1, Math.ceil(minutes.low  / usable)),
    high: Math.max(1, Math.ceil(minutes.high / usable))
  };

  return {
    muscleCount: muscles.length,
    sets, minutes, sessions, sessionMinutes,
    timesPerWeek: ESTIMATE.timesPerWeek,
    phases: PROGRESS_PHASES
  };
}
