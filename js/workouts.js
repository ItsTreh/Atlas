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
       rotate in while a clearly better exercise can still repeat;
     • recovery — an exercise that also works, as a primary, a chosen muscle
       trained in a different session (a back squat in a quads day, when
       glutes have their own day) ranks one tier lower, so that muscle is
       not quietly trained on the day before its own session.

   A session never runs past its length. When there is not room left for a
   muscle's minimum (WORKOUT.minDirectSets), it gets no exercise in that
   session and is recorded in `workout.skipped`, smallest muscles last in
   line since the order is big muscles first. WeeklyRoutine.weeklyVolume()
   reports it, so a muscle is never left out without the user being told.

   The result is a Workout per session, which the user can then edit freely.
   Nothing here touches the page.
   ========================================================================= */

const WORKOUT = Object.freeze({
  setsPerExercise:    configValue("setsPerExercise"),   // typical working sets for one exercise
  maxSetsPerExercise: configValue("maxSetsPerExercise"),   // past this, a second exercise does the job better
  minDirectSets:      configValue("minDirectSets"),   // a selected muscle always gets at least one exercise
  // Direct sets for one muscle in one session, on a split day. Research
  // generally finds diminishing returns past roughly 6–10 hard sets per
  // muscle per session; the exact number is debated, so this is a tunable
  // middle of that range rather than a settled figure.
  maxSetsPerSession:  configValue("maxSetsPerSession"),
  secondaryCredit:  configValue("secondaryCredit"),   // a set where the muscle only assists counts as half
  repeatDemotion:     configValue("repeatDemotion"),   // tier steps an exercise drops once used this week
  offDayDemotion:     configValue("offDayDemotion")    // tier steps for one that also works a muscle trained on another day
});

/**
 * How each kind of lift is done: reps per set and rest between sets. The
 * estimate's 2.5 min a set (estimate.js) is the average of the two, rest
 * included. These are common starting ranges, not a prescription.
 */
const LIFT_KINDS = Object.freeze({
  compound:  { label: "Compound",  reps: "6–10",  rest: "2–3 min" },
  isolation: { label: "Isolation", reps: "10–15", rest: "60–90 s" }
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
  get kind() { return LIFT_KINDS[this.exercise.compound ? "compound" : "isolation"]; }
  get reps() { return this.kind.reps; }
  get rest() { return this.kind.rest; }
}

/** The exercises for one session, and the edits the user makes to them. */
class Workout {
  constructor(muscles, entries) {
    this.muscles = muscles;                 // the session's target Muscles
    this.entries = entries;
    this.recommended = entries.map(e => new WorkoutEntry(e.exercise, e.muscleId, e.sets));
    this.skipped = [];                      // Muscles the session had no time left for
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
    this.setsThisWeek = new Map();          // muscle id → sets credited so far (direct + assisting)
    // Every muscle with work of its own somewhere this week.
    this.trainedThisWeek = new Set(this.sessions.flatMap(s =>
      s.block.muscles.filter(m => !s.block.riders.has(m)).map(m => m.id)));
  }

  /** Gives every session its Workout, in week order. */
  build() {
    for (const session of this.sessions) session.workout = this.buildOne(session);
    return this.sessions;
  }

  buildOne(session) {
    const block = session.block;
    // Big muscles first: their compounds give the small ones secondary credit.
    // A split day the user chose repeats in the week, and a long one may not
    // fit every muscle; there the muscles furthest below their weekly minimum
    // go first, so a muscle left out on Monday leads on Wednesday instead of
    // being left out every time. This decides the order, not the sets.
    const behind = m => (this.setsThisWeek.get(m.id) || 0) / m.weeklySets[0];
    const order = [...block.muscles].sort((a, b) =>
      (block.splitDay ? behind(a) - behind(b) : 0) || b.minutes - a.minutes);
    const workout = new Workout(order, []);
    const scale = Math.min(1, this.available / block.minutes);
    // Working sets that fit in the session after the warm-up.
    const budget = Math.floor(this.available / ESTIMATE.minutesPerSet);

    for (const muscle of order) {
      const room = budget - workout.sets;
      if (room < WORKOUT.minDirectSets) { workout.skipped.push(muscle); continue; }
      const credit = workout.directSets(muscle.id) + workout.assistedSets(muscle.id);
      let need;
      if (block.splitDay) {
        need = this.doseSets(muscle, workout, credit, block);
        if (!need) continue;           // dosed by the lifts above, or at its weekly maximum
        need = Math.min(room, need);
      } else {
        const target = this.targetSets(muscle, scale);
        need = Math.min(room, Math.max(WORKOUT.minDirectSets, Math.round(target - credit)));
      }
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
      if (block.splitDay) this.keepWithinMaximums(workout, picks);

      const used = this.usedThisWeek.get(muscle.id) || new Set();
      for (const ex of picks) used.add(ex);
      this.usedThisWeek.set(muscle.id, used);
    }
    workout.recommended = workout.entries.map(e => new WorkoutEntry(e.exercise, e.muscleId, e.sets));
    // Every muscle trained this week, not only this session's: a Legs day's
    // Romanian deadlift credits the forearms trained on Pull days too.
    for (const id of this.timesThisWeek.keys())
      this.setsThisWeek.set(id, (this.setsThisWeek.get(id) || 0) +
        workout.directSets(id) + workout.assistedSets(id));
    return workout;
  }

  /** Sets this muscle should get in one session: its share of the session
      time, but no more than its weekly maximum spread over the week. */
  targetSets(muscle, scale) {
    // Rounded, not floored: a merged block scaled below 1 would otherwise lose
    // up to a set per muscle and leave a quarter of the session empty.
    const fromTime = Math.round(muscle.minutes * scale / ESTIMATE.minutesPerSet);
    const times = this.timesThisWeek.get(muscle.id) || 1;
    const weeklyCap = Math.ceil(muscle.weeklySets[1] / times);
    return Math.max(WORKOUT.minDirectSets, Math.min(fromTime, weeklyCap));
  }

  /**
   * Direct sets for `muscle` on a split day: the best dose, not the most the
   * session could hold. The session length only limits it (the budget in
   * buildOne); it is never a reason to add sets.
   *
   *   • aim at the middle of the muscle's weekly range (weeklySets), spread
   *     over the sessions that train it this week;
   *   • less what the lifts already in this session give it (`credit`);
   *   • no more than WORKOUT.maxSetsPerSession in one session;
   *   • a hard weekly maximum: its own sets never take what it has been
   *     credited this week past weeklySets[1]. (Credit a muscle gets from
   *     lifts done for another muscle is counted where those lifts are
   *     chosen, not here.)
   *
   * A muscle with no direct work in the session still gets its minimum when
   * its maximum allows. Returns 0 when it needs nothing more here.
   */
  doseSets(muscle, workout, credit, block) {
    const [low, high] = muscle.weeklySets;
    const times = this.timesThisWeek.get(muscle.id) || 1;
    const direct = workout.directSets(muscle.id);
    const room = Math.min(WORKOUT.maxSetsPerSession - direct,
                          Math.floor(high - (this.setsThisWeek.get(muscle.id) || 0) - credit));
    // A day planned by distribution.js says how many sets each muscle gets;
    // a split the user chose aims at the middle of the weekly range.
    const aim = block.plannedSets ? block.plannedSets.get(muscle.id) || 0
                                  : (low + high) / 2 / times;
    const need = Math.min(room, Math.round(aim - credit));
    if (need >= WORKOUT.minDirectSets) return need;
    return direct === 0 && room >= WORKOUT.minDirectSets ? WORKOUT.minDirectSets : 0;
  }

  /**
   * What `muscleId` can still take this week before its weekly maximum, if
   * it is trained this week at all (Infinity otherwise): its maximum less
   * what earlier sessions and this one already credit it.
   */
  headroom(muscleId, workout) {
    if (!this.timesThisWeek.has(muscleId)) return Infinity;
    const m = MUSCLE_BY_ID.get(muscleId);
    return m.weeklySets[1] - (this.setsThisWeek.get(muscleId) || 0) -
           workout.directSets(muscleId) - workout.assistedSets(muscleId);
  }

  /**
   * On a split day, the sets just given to `picks` never take any other
   * muscle they train past its weekly maximum: a full set for another
   * primary muscle, half a set for a secondary one (WORKOUT.secondaryCredit),
   * as weeklyVolume() counts them. A pick cut below WORKOUT.minDirectSets is
   * dropped.
   */
  keepWithinMaximums(workout, picks) {
    for (const ex of picks) {
      const entry = workout.entries.find(e => e.exercise === ex);
      const want = entry.sets;
      entry.sets = 0;
      let limit = want;
      for (const id of ex.primary)
        if (id !== entry.muscleId) limit = Math.min(limit, Math.floor(this.headroom(id, workout)));
      for (const id of ex.secondary)
        limit = Math.min(limit, Math.floor(this.headroom(id, workout) / WORKOUT.secondaryCredit));
      if (limit >= WORKOUT.minDirectSets) entry.sets = limit;
      else workout.remove(entry);
    }
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
      const elsewhere = ex.primary.some(id => id !== muscle.id && !block.muscles.some(m => m.id === id) &&
                                              this.trainedThisWeek.has(id));
      // On a split day, a lift that would take another muscle it trains past
      // its weekly maximum goes last: a hack squat before a back squat once
      // the glutes have had enough.
      const overloads = block.splitDay &&
        (ex.primary.some(id => id !== muscle.id && this.headroom(id, workout) < WORKOUT.minDirectSets) ||
         ex.secondary.some(id => this.headroom(id, workout) < WORKOUT.minDirectSets * WORKOUT.secondaryCredit));
      const key = [
        tierRank(ex.tierFor(muscle.id)) + (used.has(ex) ? WORKOUT.repeatDemotion : 0) +
          (elsewhere ? WORKOUT.offDayDemotion : 0) + (overloads ? TIERS.length + 1 : 0),
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
