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

/*
 * What the four numbers about a muscle's week mean. Sets are counted as
 * weeklyVolume() counts them: direct sets plus half credit for assisting ones.
 *
 *   minimum    the floor for the muscle's priority (weeklyFloor): the least a
 *              short week trims it to before saying so. A week may end
 *              below it only when the time, the days or the split cannot
 *              hold it, and the fit note then says so.
 *   target     what the plan aims for (weeklyTarget, fitted to the week): a
 *              recommended goal, not a physiological ceiling. The plan stops
 *              when a muscle reaches it and never adds sets to a muscle that
 *              has, however much session time is left.
 *   maximum    the ceiling (weeklyCeiling): past it no extra growth has been
 *              shown. A planning limit, not a safety one; never a goal and
 *              never a reason to add sets.
 *   tolerance  TARGET_MATCH: how far the finished week may end from the
 *              target: at most `under` below it, and at most `over` above.
 *              The +2 is not permission to add sets. It absorbs what the
 *              plan does not choose: whole-exercise rounding, and a compound
 *              lift picked for a muscle still short of its target that also
 *              trains this one (a back squat for the quads gives the glutes
 *              direct sets). Sets chosen for a muscle that has reached its
 *              target are the deliberate kind, and are shed (meetTargets).
 *
 * Agreed in review (#69 and #70), not taken from a study.
 */
const TARGET_MATCH = Object.freeze({ under: 1, over: 2 });

/** Tier steps an exercise drops when its credit would take another muscle past its target. */
const OVERSHOOT_DEMOTION = 1;

/**
 * The least a muscle at `priority` with weekly target `target` may end the
 * week with: TARGET_MATCH.under below it, but never under the floor for its
 * priority when the target is at or above it (a target trimmed to the floor
 * should not read as short of it).
 */
function targetFloor(muscle, target, priority = "normal") {
  const low = weeklyFloor(muscle, priority);
  return target >= low ? Math.max(target - TARGET_MATCH.under, low) : target - TARGET_MATCH.under;
}

/**
 * Builds the workouts for `sessions` (WorkoutBuilder) and takes out a
 * session not worth a day: one the other days' lifts already cover, so
 * nothing is left to do in it, or a repeat of a block (a split the user
 * chose) with less than one typical exercise. The first session of a block
 * always stays, so no muscle loses its day. Taking one out raises the share
 * of the muscles left on the others, so the week is built again until every
 * session that remains is worth it. Returns { sessions, dropped }: the
 * sessions kept and the ones taken out.
 */
function buildWeek(sessions, sessionMinutes, targets, priorities = null) {
  const inWeek = (a, b) => DayOfWeek.indexOf(a.day) - DayOfWeek.indexOf(b.day) || a.startHour - b.startHour;
  let kept = [...sessions];
  const dropped = [];
  for (;;) {
    new WorkoutBuilder(kept, sessionMinutes, targets, priorities).build();
    const seen = new Set(), weak = [];
    for (const s of [...kept].sort(inWeek)) {
      if (!s.workout.entries.length || (seen.has(s.block) && s.workout.sets < WORKOUT.setsPerExercise))
        weak.push(s);
      seen.add(s.block);
    }
    if (!weak.length) return { sessions: kept, dropped };
    // The barest first, the later day on a tie.
    weak.sort((a, b) => a.workout.sets - b.workout.sets || inWeek(b, a));
    kept = kept.filter(s => s !== weak[0]);
    dropped.push(weak[0]);
  }
}

/** The most sets of one muscle that fit in `minutes` (muscleSessionMinutes, estimate.js). */
function setsThatFit(minutes) {
  let sets = 0;
  while (muscleSessionMinutes(sets + 1) <= minutes) sets++;
  return sets;
}

/**
 * How each kind of lift is done: reps per set and rest between sets (the
 * rests are the timing values in evidence.js). These are common starting
 * ranges, not a prescription.
 */
const LIFT_KINDS = Object.freeze({
  compound:  { label: "Compound",  reps: "6–10",  rest: configValue("restCompoundMinutes") + " min" },
  isolation: { label: "Isolation", reps: "10–15", rest: configValue("restIsolationMinutes") + " min" }
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
  /** The session's time: each exercise's setup, then every set and the rest after it, plus the warm-up. */
  get minutes() {
    if (!this.entries.length) return 0;
    const work = this.entries.reduce((t, e) =>
      t + ESTIMATE.setupMinutes + e.sets * (ESTIMATE.workSetMinutes +
        (e.exercise.compound ? ESTIMATE.restCompoundMinutes : ESTIMATE.restIsolationMinutes)), 0);
    return Math.round(work + ESTIMATE.warmupMinutes);
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
   * @param targets         Map muscle id -> the weekly sets the plan aims for
   *                        (WeeklyRoutine.plannedWeeklySets), or null
   * @param priorities      Map muscle id -> its priority, for its floor and
   *                        default target; Normal when missing
   */
  constructor(sessions, sessionMinutes, targets = null, priorities = null) {
    this.sessions = [...sessions].sort((a, b) =>
      DayOfWeek.indexOf(a.day) - DayOfWeek.indexOf(b.day) || a.startHour - b.startHour);
    this.limit = sessionMinutes;
    this.available = usableMinutes(sessionMinutes);
    this.targets = targets;
    this.priorities = priorities;

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

  /** Gives every session its Workout, in week order, then brings each muscle's week to its target. */
  build() {
    for (const session of this.sessions) session.workout = this.buildOne(session);
    this.meetTargets();
    return this.sessions;
  }

  /** The priority of `id`: Normal when the builder was given none. */
  priorityOf(id) {
    return (this.priorities && this.priorities.get(id)) || "normal";
  }

  /** The weekly sets `id` is aimed at: its target when the plan has one, else the default for its priority. */
  targetFor(id) {
    if (this.targets && this.targets.has(id)) return this.targets.get(id);
    return weeklyTarget(MUSCLE_BY_ID.get(id), this.priorityOf(id));
  }

  /** The most a muscle may be credited this week: its target and the agreed margin, never past its ceiling. */
  ceilingFor(id) {
    const high = weeklyCeiling(MUSCLE_BY_ID.get(id));
    return this.targets && this.targets.has(id) ? Math.min(high, this.targets.get(id) + TARGET_MATCH.over) : high;
  }

  /**
   * The least `id` may end the week with: TARGET_MATCH.under below its
   * target, but never under the floor for its priority when the target is
   * at or above it.
   */
  floorFor(id) {
    return targetFloor(MUSCLE_BY_ID.get(id), this.targets.get(id), this.priorityOf(id));
  }

  /** What `id` is credited so far: earlier sessions, and the lifts already in this one. */
  creditSoFar(id, workout) {
    return (this.setsThisWeek.get(id) || 0) + workout.directSets(id) + workout.assistedSets(id);
  }

  /** Whether `id` has reached its target so far (false for a muscle without one). */
  reached(id, workout) {
    return !!this.targets && this.targets.has(id) && this.creditSoFar(id, workout) >= this.targets.get(id);
  }

  /** Whether the smallest dose of a lift, at `weight` credit, would take `id` past its target. */
  wouldPassTarget(id, workout, weight) {
    return this.targets.has(id) &&
           this.creditSoFar(id, workout) + WORKOUT.minDirectSets * weight > this.targets.get(id);
  }

  /** What `id` is credited over the whole week: direct sets plus half credit for assisting ones. */
  weekCredit(id) {
    return this.sessions.reduce((t, s) => t + s.workout.directSets(id) + s.workout.assistedSets(id), 0);
  }

  /**
   * The sessions are built one at a time, in week order, so a muscle dosed
   * on Monday cannot see what Thursday's lifts will credit it. Once the week
   * is built, each muscle with a target is brought within TARGET_MATCH of
   * it, one set at a time on its own exercises: a set off the biggest, or an
   * exercise dropped once its minimum is too much; a set onto the smallest,
   * or one more exercise, only while the session stays within its length.
   * A change that would push another muscle out of its own margin is not
   * made. What cannot be closed stays, and weeklyVolume() reports it.
   */
  meetTargets() {
    if (!this.targets) return;
    const ids = [...this.targets.keys()].filter(id => this.timesThisWeek.has(id));
    for (let pass = 0; pass < 60; pass++) {
      let changed = false;
      for (const id of ids) {
        const got = this.weekCredit(id);
        if (got > this.ceilingFor(id)) changed = this.takeSet(id) || changed;
        else if (got < this.floorFor(id)) changed = this.addSet(id) || changed;
        // Over its target, with sets of its own to spare: shed them. What stays
        // above the target is what the plan does not choose (rounding, or credit
        // from lifts picked for other muscles), up to TARGET_MATCH.over.
        else if (got > this.targets.get(id)) changed = this.shedSet(id) || changed;
      }
      if (!changed) break;
    }
    for (const s of this.sessions) {
      const w = s.workout;
      w.skipped = w.skipped.filter(m => !w.entriesFor(m.id).length);
      w.recommended = w.entries.map(e => new WorkoutEntry(e.exercise, e.muscleId, e.sets));
    }
  }

  /**
   * Whether changing `entry` by `delta` sets keeps every other muscle it
   * trains within its margin: not over its ceiling when sets are added, not
   * under its target when they are taken off.
   */
  sparesOthers(entry, delta) {
    const ex = entry.exercise;
    for (const id of [...ex.primary, ...ex.secondary]) {
      if (id === entry.muscleId || !this.targets.has(id)) continue;
      const after = this.weekCredit(id) + delta * (ex.primary.includes(id) ? 1 : WORKOUT.secondaryCredit);
      if (delta > 0 ? after > this.ceilingFor(id) : after < this.floorFor(id)) return false;
    }
    return true;
  }

  /**
   * One set off the biggest exercise chosen for `id`, if it has one above its
   * minimum and taking it spares every other muscle (its credit stays at or
   * above its floor). Never drops an exercise: that is takeSet's last resort.
   */
  shedSet(id) {
    // Never under its own floor: shedding below it would only have addSet
    // put the set back, and the week end on whichever came last.
    if (this.weekCredit(id) - 1 < this.floorFor(id)) return false;
    const own = this.sessions.flatMap(s => s.workout.entriesFor(id).map(e => ({ s, e })))
      .filter(({ e }) => e.sets > WORKOUT.minDirectSets && this.sparesOthers(e, -1))
      .sort((a, b) => b.e.sets - a.e.sets);
    if (!own.length) return false;
    own[0].e.sets--;
    return true;
  }

  /**
   * One set off `id`'s own exercises; or, when each is at its minimum and
   * `drop` allows it, one exercise.
   */
  takeSet(id, drop = true) {
    const own = this.sessions.flatMap(s => s.workout.entriesFor(id).map(e => ({ s, e })));
    const trimmable = own.filter(({ e }) => e.sets > WORKOUT.minDirectSets && this.sparesOthers(e, -1))
                         .sort((a, b) => b.e.sets - a.e.sets);
    if (trimmable.length) { trimmable[0].e.sets--; return true; }
    if (!drop) return false;
    // Dropping a whole exercise must not take the muscle under its floor. A
    // session it leaves empty is taken out of the week (buildWorkouts).
    const droppable = own.filter(({ e }) => this.weekCredit(id) - e.sets >= this.floorFor(id) && this.sparesOthers(e, -e.sets))
                         .sort((a, b) => a.e.sets - b.e.sets);
    if (!droppable.length) return false;
    droppable[0].s.workout.remove(droppable[0].e);
    return true;
  }

  /** One set onto `id`'s smallest exercise with room; or one more exercise for it. */
  addSet(id) {
    const muscle = MUSCLE_BY_ID.get(id);
    const carrying = this.sessions.filter(s => s.block.has(muscle) && !s.block.riders.has(muscle));
    const own = carrying.flatMap(s => s.workout.entriesFor(id).map(e => ({ s, e })))
      .filter(({ s, e }) => e.sets < WORKOUT.maxSetsPerExercise &&
                            s.workout.directSets(id) < WORKOUT.maxSetsPerSession && this.sparesOthers(e, 1))
      .sort((a, b) => a.e.sets - b.e.sets);
    for (const { s, e } of own) {
      e.sets++;
      if (s.workout.minutes <= this.limit) return true;
      e.sets--;
    }
    // An exercise already at its most is not "blocked" by others: more sets
    // there are not allowed; further sets go on another exercise below.
    // One more exercise, at its minimum, in a session with time for it. A
    // lift whose credit would push another muscle past its ceiling is tried
    // after the ones that do not; failing that, the muscle it would push
    // gives up a set of its own first (makeRoom), if it can spare one.
    for (const s of [...carrying].sort((a, b) => a.workout.minutes - b.workout.minutes)) {
      const w = s.workout;
      if (w.directSets(id) + WORKOUT.minDirectSets > WORKOUT.maxSetsPerSession) continue;
      const tried = new Set();
      for (let ex; (ex = this.bestFor(muscle, s.block, w, tried)); ) {
        tried.add(ex);
        const entry = new WorkoutEntry(ex, id, WORKOUT.minDirectSets);
        // Room made for a lift that is then not taken is given back, so it
        // can't free time a better lift was turned away for.
        const before = this.setsNow();
        if (!this.sparesOthers(entry, WORKOUT.minDirectSets) && !this.makeRoom(entry, WORKOUT.minDirectSets)) {
          this.restoreSets(before);
          continue;
        }
        const last = w.entries.map(x => x.muscleId).lastIndexOf(id);
        w.entries.splice(last < 0 ? w.entries.length : last + 1, 0, entry);
        if (w.minutes <= this.limit) return true;
        w.remove(entry);
        this.restoreSets(before);
      }
    }
    return false;
  }

  /** Every session's exercises and their sets, to put back with restoreSets(). */
  setsNow() {
    return this.sessions.map(s => [s.workout, [...s.workout.entries], s.workout.entries.map(e => e.sets)]);
  }
  restoreSets(saved) {
    for (const [w, entries, sets] of saved) {
      w.entries = entries;
      entries.forEach((e, i) => { e.sets = sets[i]; });
    }
  }

  /**
   * Frees the credit `entry` would need from the muscles it would push past
   * their ceiling, by taking sets off their own exercises (takeSet keeps
   * each at its floor). It never drops another muscle's exercise for it:
   * that would leave the muscle trained only by this lift's spill-over.
   * Returns whether `entry` then spares every muscle.
   */
  makeRoom(entry, sets) {
    const ex = entry.exercise;
    for (let guard = 0; guard < 12; guard++) {
      const blocked = [...ex.primary, ...ex.secondary].find(id => {
        if (id === entry.muscleId || !this.targets.has(id)) return false;
        const after = this.weekCredit(id) + sets * (ex.primary.includes(id) ? 1 : WORKOUT.secondaryCredit);
        return after > this.ceilingFor(id);
      });
      if (!blocked) return true;
      if (!this.takeSet(blocked, false)) return false;
    }
    return this.sparesOthers(entry, sets);
  }

  buildOne(session) {
    const block = session.block;
    // Big muscles first: their compounds give the small ones secondary credit.
    // A split day the user chose repeats in the week, and a long one may not
    // fit every muscle; there the muscles furthest below their weekly minimum
    // go first, so a muscle left out on Monday leads on Wednesday instead of
    // being left out every time. This decides the order, not the sets.
    const behind = m => (this.setsThisWeek.get(m.id) || 0) / weeklyFloor(m, this.priorityOf(m.id));
    const order = [...block.muscles].sort((a, b) =>
      (block.splitDay ? behind(a) - behind(b) : 0) || b.minutes - a.minutes);
    const workout = new Workout(order, []);
    const scale = Math.min(1, this.available / block.minutes);
    // Minutes of working sets the session has left, timed the way the plan was.
    const workMinutes = () => workout.entries.length ? workout.minutes - ESTIMATE.warmupMinutes : 0;

    for (const muscle of order) {
      const room = setsThatFit(this.available - workMinutes());
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
    this.fitToSession(workout);
    workout.recommended = workout.entries.map(e => new WorkoutEntry(e.exercise, e.muscleId, e.sets));
    // Every muscle trained this week, not only this session's: a Legs day's
    // Romanian deadlift credits the forearms trained on Pull days too.
    // and every chosen muscle, with a session of its own or not.
    for (const id of new Set([...this.timesThisWeek.keys(), ...(this.targets ? this.targets.keys() : [])]))
      this.setsThisWeek.set(id, (this.setsThisWeek.get(id) || 0) +
        workout.directSets(id) + workout.assistedSets(id));
    return workout;
  }

  /**
   * The budget in buildOne counts every set at the planning average
   * (ESTIMATE.minutesPerSet); the finished session is timed exercise by
   * exercise and may run over. Take sets off the biggest entries, last
   * muscles first, down to WORKOUT.minDirectSets each, and only then drop an
   * exercise, so a session never runs past the length the user chose.
   */
  fitToSession(workout) {
    while (workout.minutes > this.limit) {
      const room = workout.entries.filter(e => e.sets > WORKOUT.minDirectSets);
      if (room.length) {
        const most = Math.max(...room.map(e => e.sets));
        room.reverse().find(e => e.sets === most).sets--;
        continue;
      }
      const last = workout.entries[workout.entries.length - 1];
      workout.remove(last);
      if (!workout.entriesFor(last.muscleId).length) workout.skipped.push(MUSCLE_BY_ID.get(last.muscleId));
    }
  }

  /** Sets this muscle should get in one session: its share of the session
      time, but no more than its weekly ceiling spread over the week. */
  targetSets(muscle, scale) {
    // Rounded, not floored: a merged block scaled below 1 would otherwise lose
    // up to a set per muscle and leave a quarter of the session empty.
    const fromTime = Math.round(muscle.minutes * scale / ESTIMATE.minutesPerSet);
    const times = this.timesThisWeek.get(muscle.id) || 1;
    const weeklyCap = Math.ceil(weeklyCeiling(muscle) / times);
    return Math.max(WORKOUT.minDirectSets, Math.min(fromTime, weeklyCap));
  }

  /**
   * Direct sets for `muscle` on a split day: the best dose, not the most the
   * session could hold. The session length only limits it (the budget in
   * buildOne); it is never a reason to add sets.
   *
   *   • aim at the muscle's weekly target (targetFor), spread over the
   *     sessions that train it this week;
   *   • less what the lifts already in this session give it (`credit`);
   *   • no more than WORKOUT.maxSetsPerSession in one session;
   *   • never past the weekly target: its own sets never take what it has
   *     been credited this week past it. (Credit a muscle gets from
   *     lifts done for another muscle is counted where those lifts are
   *     chosen, not here.)
   *
   * A muscle with no direct work in the session still gets its minimum when
   * its maximum allows. Returns 0 when it needs nothing more here.
   */
  doseSets(muscle, workout, credit, block) {
    const times = this.timesThisWeek.get(muscle.id) || 1;
    const direct = workout.directSets(muscle.id);
    // Never past the weekly target: what earlier sessions and this one
    // already credit it counts first.
    const room = Math.min(WORKOUT.maxSetsPerSession - direct,
                          Math.floor(this.targetFor(muscle.id) - (this.setsThisWeek.get(muscle.id) || 0) - credit));
    // A day planned by distribution.js says how many sets each muscle gets;
    // a split the user chose spreads the weekly target over its sessions.
    const aim = block.plannedSets ? block.plannedSets.get(muscle.id) || 0
                                  : this.targetFor(muscle.id) / times;
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
    // A chosen muscle has its ceiling even with no session of its own: the
    // lifts for the others still count towards it.
    if (!this.timesThisWeek.has(muscleId) && !(this.targets && this.targets.has(muscleId))) return Infinity;
    return this.ceilingFor(muscleId) - (this.setsThisWeek.get(muscleId) || 0) -
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
  bestFor(muscle, block, workout, skip = null) {
    const used = this.usedThisWeek.get(muscle.id) || new Set();
    const others = block.muscles.filter(m => m !== muscle).map(m => m.id);
    let best = null, bestKey = null;

    exercisesFor(muscle.id).forEach((ex, order) => {
      if (workout.has(ex) || workout.clashWith(ex) || (skip && skip.has(ex))) return;
      const elsewhere = ex.primary.some(id => id !== muscle.id && !block.muscles.some(m => m.id === id) &&
                                              this.trainedThisWeek.has(id));
      // On a split day, a lift that would take another muscle it trains past
      // its weekly maximum goes last: a hack squat before a back squat once
      // the glutes have had enough.
      const overloads = block.splitDay &&
        (ex.primary.some(id => id !== muscle.id && this.headroom(id, workout) < WORKOUT.minDirectSets) ||
         ex.secondary.some(id => this.headroom(id, workout) < WORKOUT.minDirectSets * WORKOUT.secondaryCredit));
      // A lift whose credit would take another muscle past its target ranks one
      // tier lower, so an alternative of the same tier that does not goes first
      // (a leg curl before a Romanian deadlift once the glutes have had theirs).
      const pastTarget = this.targets && (
        ex.primary.some(id => id !== muscle.id && this.wouldPassTarget(id, workout, 1)) ||
        ex.secondary.some(id => this.wouldPassTarget(id, workout, WORKOUT.secondaryCredit)));
      const key = [
        tierRank(ex.tierFor(muscle.id)) + (used.has(ex) ? WORKOUT.repeatDemotion : 0) +
          (elsewhere ? WORKOUT.offDayDemotion : 0) + (overloads ? TIERS.length + 1 : 0) +
          (pastTarget ? OVERSHOOT_DEMOTION : 0),
        // Sharing the session with the muscles that still need sets is a plus;
        // sharing it with ones that have reached their target is not.
        -others.filter(id => (ex.trainsPrimarily(id) || ex.assists(id)) && !this.reached(id, workout)).length,
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
