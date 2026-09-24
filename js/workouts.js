/* ===========================================================================
   Workouts — the exercises inside each scheduled session.

   The chain is:  selected muscles → training blocks (routine.js) → sessions
   placed in the week (scheduler.js) → exercises for each session (here).

   For every session, each of its muscles gets a set budget from the session
   length, capped so the week does not exceed the muscle's weekly volume.
   Exercises then fill that budget:

     • higher tiers first — S+ before S before A+ before A, unrated last;
     • one exercise per movement per session, so a session never gets two
       flat presses or two squats;
     • secondary muscles count — pressing gives the triceps half credit, so
       the triceps need fewer direct sets after a chest block;
     • variety across the week — an exercise already used for a muscle this
       week ranks one tier lower the next time, so equal-tier alternatives
       rotate in while a clearly better exercise can still repeat.

   The result is a Workout per session, which the user can then edit freely.
   Nothing here touches the page.
   ========================================================================= */

const WORKOUT = Object.freeze({
  setsPerExercise:    3,   // typical working sets for one exercise
  maxSetsPerExercise: 4,   // past this, a second exercise does the job better
  minDirectSets:      2,   // a selected muscle always gets at least one exercise
  secondaryCredit:  0.5,   // a set where the muscle only assists counts as half
  repeatDemotion:     1    // tier steps an exercise drops once used this week
});

class WorkoutEntry {
  /**
   * @param exercise  the Exercise
   * @param muscleId  the target muscle this exercise is in the session for
   * @param sets      working sets
   * @param manual    true when the user chose it rather than the planner
   */
  constructor(exercise, muscleId, sets, manual = false) {
    this.exercise = exercise; this.muscleId = muscleId;
    this.sets = sets; this.manual = manual;
  }
  get tier() { return this.exercise.tierFor(this.muscleId); }
}

/** The exercises for one session, and the edits the user makes to them. */
class Workout {
  constructor(muscles, entries) {
    this.muscles = muscles;                 // the session's target Muscles
    this.entries = entries;
    this.recommended = entries.map(e => new WorkoutEntry(e.exercise, e.muscleId, e.sets));
  }

  entriesFor(muscleId) { return this.entries.filter(e => e.muscleId === muscleId); }
  get edited() { return this.entries.some(e => e.manual) ||
                        this.entries.length !== this.recommended.length; }
  get sets() { return this.entries.reduce((t, e) => t + e.sets, 0); }
  get minutes() {
    return this.entries.length
      ? Math.round(this.sets * ESTIMATE.minutesPerSet + ESTIMATE.warmupMinutes) : 0;
  }

  /** Sets that train the muscle directly: its own entries, plus any other
      entry that also lists it as a primary (a squat done for quads also
      trains glutes). */
  directSets(muscleId) {
    return this.entries.reduce((t, e) =>
      t + (e.exercise.trainsPrimarily(muscleId) ? e.sets : 0), 0);
  }
  /** Sets from entries where the muscle only assists, already discounted. */
  assistedSets(muscleId) {
    return this.entries.reduce((t, e) =>
      t + (e.exercise.assists(muscleId) ? e.sets * WORKOUT.secondaryCredit : 0), 0);
  }

  /** Another entry with the same movement as `exercise`, if there is one. */
  clashWith(exercise, except = null) {
    return this.entries.find(e => e !== except && e.exercise !== exercise &&
                                  e.exercise.movement === exercise.movement) || null;
  }
  has(exercise) { return this.entries.some(e => e.exercise === exercise); }

  /* ------------------------------ editing ------------------------------ */

  replace(entry, exercise) {
    const i = this.entries.indexOf(entry);
    if (i < 0 || entry.exercise === exercise) return;
    this.entries[i] = new WorkoutEntry(exercise, entry.muscleId, entry.sets, true);
  }
  remove(entry) { this.entries = this.entries.filter(e => e !== entry); }
  add(muscleId, exercise) {
    // Keep the entries grouped by muscle, in session order.
    const last = this.entries.map(e => e.muscleId).lastIndexOf(muscleId);
    const at = last < 0 ? this.entries.length : last + 1;
    this.entries.splice(at, 0,
      new WorkoutEntry(exercise, muscleId, WORKOUT.setsPerExercise, true));
  }
  restore() {
    this.entries = this.recommended.map(e => new WorkoutEntry(e.exercise, e.muscleId, e.sets));
  }
}

class WorkoutBuilder {
  /**
   * @param sessions        the WorkoutSessions placed this week
   * @param sessionMinutes  the planned session length
   */
  constructor(sessions, sessionMinutes) {
    this.sessions = [...sessions].sort((a, b) =>
      DayOfWeek.indexOf(a.day) - DayOfWeek.indexOf(b.day) || a.startHour - b.startHour);
    this.available = Math.max(15, sessionMinutes - ESTIMATE.warmupMinutes);

    // How many sessions this week train each muscle — spreads its weekly volume.
    this.timesThisWeek = new Map();
    for (const s of this.sessions)
      for (const m of s.block.muscles)
        this.timesThisWeek.set(m.id, (this.timesThisWeek.get(m.id) || 0) + 1);

    this.usedThisWeek = new Map();          // muscle id → Set of exercises
  }

  /** Gives every session its Workout, in week order. */
  build() {
    for (const session of this.sessions) session.workout = this.buildOne(session);
    return this.sessions;
  }

  buildOne(session) {
    const block = session.block;
    // Big muscles first: their compounds give the small ones secondary credit.
    const order = [...block.muscles].sort((a, b) => b.minutes - a.minutes);
    const workout = new Workout(order, []);
    const scale = Math.min(1, this.available / block.minutes);

    for (const muscle of order) {
      const target = this.targetSets(muscle, scale);
      const credit = workout.directSets(muscle.id) + workout.assistedSets(muscle.id);
      const need = Math.max(WORKOUT.minDirectSets, Math.round(target - credit));
      const wanted = Math.max(1, Math.round(need / WORKOUT.setsPerExercise));

      const picks = [];
      for (let i = 0; i < wanted; i++) {
        const next = this.bestFor(muscle, block, workout);
        if (!next) break;
        picks.push(next);
        workout.entries.push(new WorkoutEntry(next, muscle.id, 0));   // sets below
      }
      const entries = workout.entriesFor(muscle.id);
      this.shareSets(entries, need);

      const used = this.usedThisWeek.get(muscle.id) || new Set();
      for (const ex of picks) used.add(ex);
      this.usedThisWeek.set(muscle.id, used);
    }
    workout.recommended = workout.entries.map(e => new WorkoutEntry(e.exercise, e.muscleId, e.sets));
    return workout;
  }

  /** Sets this muscle should get in one session: its share of the session
      time, but no more than its weekly maximum spread over the week. */
  targetSets(muscle, scale) {
    const fromTime = Math.floor(muscle.minutes * scale / ESTIMATE.minutesPerSet);
    const times = this.timesThisWeek.get(muscle.id) || 1;
    const weeklyCap = Math.ceil(muscle.weeklySets[1] / times);
    return Math.max(WORKOUT.minDirectSets, Math.min(fromTime, weeklyCap));
  }

  /** Splits `total` sets over the entries as evenly as the per-exercise cap allows. */
  shareSets(entries, total) {
    if (!entries.length) return;
    const base = Math.floor(total / entries.length);
    let extra = total % entries.length;
    for (const e of entries) {
      e.sets = Math.min(WORKOUT.maxSetsPerExercise,
                        Math.max(WORKOUT.minDirectSets, base + (extra-- > 0 ? 1 : 0)));
    }
  }

  /**
   * The best exercise for `muscle` that this session does not already have,
   * and whose movement it does not already have. Ranked by, in order:
   *   1. tier, one step lower if already used for this muscle this week
   *   2. how many of the session's other muscles it also trains
   *   3. list order in the ratings
   */
  bestFor(muscle, block, workout) {
    const used = this.usedThisWeek.get(muscle.id) || new Set();
    const others = block.muscles.filter(m => m !== muscle).map(m => m.id);
    let best = null, bestKey = null;

    exercisesFor(muscle.id).forEach((ex, order) => {
      if (workout.has(ex) || workout.clashWith(ex)) return;
      const key = [
        tierRank(ex.tierFor(muscle.id)) + (used.has(ex) ? WORKOUT.repeatDemotion : 0),
        -others.filter(id => ex.trainsPrimarily(id) || ex.assists(id)).length,
        order
      ];
      if (!bestKey || compareKeys(key, bestKey) < 0) { best = ex; bestKey = key; }
    });
    return best;
  }
}

function compareKeys(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
