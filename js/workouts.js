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

   Units (volume.js): volume is counted sets (a primary set counts 1, an
   assisting set WORKOUT.secondaryCredit), time is performed sets. A day the
   distribution planned gives each muscle its own sets, with the expected
   credit already taken off; it is not taken off again here.

   After every session is built, two more passes run when the routine gives
   the week's goals (what experience and priority ask for):
     • ensureDirectWork: every chosen muscle gets an exercise of its own;
     • fillToGoals: time the sessions have left goes to muscles still under
       their goal, and to nothing else, so a session whose muscles are done
       ends early. Every limit holds there too: session length, weekly
       maximum, per-session cap, recovery, and heavy spinal loading.

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
  offDayDemotion:     configValue("offDayDemotion"),   // tier steps for one that also works a muscle trained on another day
  indirectRecoveryFraction: configValue("indirectRecoveryFraction"),   // share of the recovery days an assisting load needs
  dislikeDemotion:      configValue("dislikeDemotion"),   // tier steps for an exercise the user doesn't like
  functionRepeatDemotion: configValue("functionRepeatDemotion"), // tier steps for a second lift doing the same job
  interferenceDemotion: configValue("interferenceDemotion"),   // tier steps for one that cannot share a session cleanly with another
  maxAxialPerSession:   configValue("maxAxialPerSession"),     // high-axial lifts (volume.js) one session holds
  axialDemotion:        configValue("axialDemotion")           // tier steps for one more, or one next to another day's
});

/**
 * How each kind of lift is done: reps per set and rest between sets (the
 * rests are the timing values in evidence.js). These are common starting
 * ranges, not a prescription.
 */
const LIFT_KINDS = Object.freeze({
  compound:  { label: "Compound",  reps: "6–10",  rest: configValue("restCompoundMinutes") + " min",
               reserve: configValue("rirCompound") },
  isolation: { label: "Isolation", reps: "10–15", rest: configValue("restIsolationMinutes") + " min",
               reserve: configValue("rirIsolation") }
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
  /** Reps to leave in reserve on the working sets (see rirCompound in evidence.js). */
  get reserve() { return this.kind.reserve; }
}

/**
 * Order inside a session, and which lifts fatigue which.
 *
 * `tires(a, b)`: lift `a` works, as a helper, a muscle that lift `b` trains
 * directly: a press leaves the triceps tired for a pushdown. Done the other
 * way round, the pushdown would hold the press back, so the lift whose
 * helpers are another's target goes first. Two lifts that tire each other
 * cannot both go first; the planner avoids pairing them (see bestFor).
 */
const tires = (a, b) => b.primary.some(id => a.secondary.includes(id));
const tiresBothWays = (a, b) => tires(a, b) && tires(b, a);

/**
 * Puts a session's entries in the order they should be done:
 *   1. a lift goes before any lift that trains one of its helper muscles;
 *   2. otherwise the user's Focus muscles first, Maintain last;
 *   3. then compounds before isolation (heavy spine-loading compounds
 *      first of all, volume.js), then the better tier, then the order the
 *      planner picked them in.
 * Nothing is scored: each step only breaks the ties the one before left.
 */
function orderEntries(entries, priorityOf = () => "normal") {
  const rank = e => ({ focus: 0, normal: 1, maintain: 2 })[priorityOf(e.muscleId)] ?? 1;
  const first = (a, b) => tires(a.exercise, b.exercise) && !tires(b.exercise, a.exercise);
  // Heavy spine-loading compounds (volume.js, axial load) before other compounds, while fresh.
  const kindOf = ex => !ex.compound ? 2 : axialLoad(ex) === "high" ? 0 : 1;
  const keyOf = x => [rank(x.e), kindOf(x.e.exercise), tierRank(x.e.tier), x.i];
  const rest = entries.map((e, i) => ({ e, i }));
  const out = [];
  while (rest.length) {
    const blocked = rest.filter(x => rest.some(y => y !== x && first(y.e, x.e)));
    let ready = rest.filter(x => !blocked.includes(x));
    if (!ready.length) ready = rest;                      // lifts that tire each other: plain tie-break
    ready.sort((a, b) => compareKeys(keyOf(a), keyOf(b)));
    const chosen = ready[0];

    // Which rule put it here, so the page can say so and exceptions are visible.
    const held = blocked.filter(x => x !== chosen && first(chosen.e, x.e) && compareKeys(keyOf(x), keyOf(chosen)) < 0);
    let rule, over;
    if (held.length) { rule = "dependency"; over = held; }
    else if (ready.length > 1) {
      const next = ready[1];
      const differs = [0, 1, 2].find(k => keyOf(chosen)[k] !== keyOf(next)[k]);
      rule = differs === 0 ? "priority" : differs === 1 ? "compound" : differs === 2 ? "tier" : "pick-order";
      over = ready.slice(1);
    } else { rule = "only-option"; over = []; }
    chosen.e.orderRule = { rule, over: over.map(x => x.e.exercise.name) };

    out.push(chosen.e);
    rest.splice(rest.indexOf(chosen), 1);
  }
  return out;
}

/** The exercises for one session, and the edits the user makes to them. */
class Workout {
  constructor(muscles, entries) {
    this.muscles = muscles;                 // the session's target Muscles
    this.entries = entries;
    this.recommended = entries.map(e => Object.assign(new WorkoutEntry(e.exercise, e.muscleId, e.sets), { orderRule: e.orderRule, penalties: e.penalties }));
    this.skipped = [];                      // Muscles the session had no time left for
  }

  entriesFor(muscleId) { return this.entries.filter(e => e.muscleId === muscleId); }
  get edited() { return this.entries.some(e => e.manual) ||
                        this.entries.length !== this.recommended.length; }
  get sets() { return this.entries.reduce((t, e) => t + e.sets, 0); }
  /** The session's time: each exercise's setup, then every set and the rest after it, plus the warm-up. */
  get minutes() {
    if (!this.entries.length) return 0;
    return Math.round(entriesMinutes(this.entries) + ESTIMATE.warmupMinutes);   // volume.js
  }

  /** Sets that train the muscle directly: its own entries, plus any other
      entry that also lists it as a primary (a squat done for quads also
      trains glutes). */
  directSets(muscleId) {
    return countedSets(this.entries.filter(e => e.exercise.trainsPrimarily(muscleId)), muscleId);
  }
  /** Sets from entries where the muscle only assists, already discounted. */
  assistedSets(muscleId) {
    return countedSets(this.entries.filter(e => e.exercise.assists(muscleId)), muscleId);
  }
  /** Counted sets (volume.js): direct sets plus the discounted assisting ones. */
  countedSets(muscleId) { return countedSets(this.entries, muscleId); }

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
    this.entries = this.recommended.map(e => Object.assign(new WorkoutEntry(e.exercise, e.muscleId, e.sets), { orderRule: e.orderRule, penalties: e.penalties }));
  }
}

class WorkoutBuilder {
  /**
   * @param sessions        the WorkoutSessions placed this week
   * @param sessionMinutes  the planned session length
   */
  /**
   * @param goals  Map muscle id -> the counted sets a week the user's
   *               experience and priority ask for (weeklyTarget, before
   *               fitting the time). When given, a last pass fills the time
   *               the sessions have left up to these and no further
   *               (fillToGoals), and every chosen muscle gets an exercise of
   *               its own (ensureDirectWork).
   */
  constructor(sessions, sessionMinutes, priorityOf = () => "normal", preferences = new ExercisePreferences(), goals = null) {
    this.priorityOf = priorityOf;
    this.preferences = preferences;
    this.goals = goals;
    this.gains = new Map();                 // muscle id -> { own, counted } added after the first pass
    this.blockReasons = new Set();          // why the last addition was refused (lastBlock)
    this.shortfalls = [];                   // muscles left under their goal, and why (fillToGoals)
    this.events = [];                       // sets the plan wanted and could not give (see lose)
    this.current = null;                    // the session being built
    this.sessions = [...sessions].sort((a, b) =>
      DayOfWeek.indexOf(a.day) - DayOfWeek.indexOf(b.day) || a.startHour - b.startHour);
    this.limit = sessionMinutes;
    this.available = Math.max(15, sessionMinutes - ESTIMATE.warmupMinutes);

    // How many sessions this week train each muscle — spreads its weekly volume.
    this.timesThisWeek = new Map();
    for (const s of this.sessions)
      for (const m of s.block.muscles)
        this.timesThisWeek.set(m.id, (this.timesThisWeek.get(m.id) || 0) + 1);

    // Muscles whose weekly maximum the plan keeps: every one trained this
    // week and every one the user chose, even if no day ended up planning it
    // (its credit from other lifts still counts toward the maximum).
    this.tracked = new Set([...this.timesThisWeek.keys(), ...(goals ? goals.keys() : [])]);
    this.usedThisWeek = new Map();          // muscle id → Set of exercises
    this.setsThisWeek = new Map();          // muscle id → sets credited so far (direct + assisting)
    // Every muscle with work of its own somewhere this week.
    this.trainedThisWeek = new Set(this.sessions.flatMap(s =>
      s.block.muscles.filter(m => !s.block.riders.has(m)).map(m => m.id)));
  }

  /** Gives every session its Workout, in week order. */
  build() {
    this.events = [];
    this.gains = new Map();
    this.shortfalls = [];
    this.firstPassDone = false;
    for (const session of this.sessions) session.workout = this.buildOne(session);
    this.firstPassDone = true;
    if (this.goals) {
      this.ensureDirectWork();
      this.fillToGoals();
      for (const s of this.sessions) {
        const w = s.workout;
        w.entries = orderEntries(w.entries, this.priorityOf);
        w.recommended = w.entries.map(e => Object.assign(new WorkoutEntry(e.exercise, e.muscleId, e.sets), { orderRule: e.orderRule, penalties: e.penalties }));
      }
    }
    return this.sessions;
  }

  /* ------------------------- after the first pass ------------------------- */

  /**
   * Why the last attempt to add to a muscle failed. Every session tried can
   * refuse for a different reason; the one reported is the most telling, so
   * a session that ran out of time does not hide that another had no
   * exercise left or would have passed a maximum.
   */
  note(reason) { this.blockReasons.add(reason); }
  get lastBlock() {
    return ["weekly-maximum", "session-set-limit", "recovery", "axial-load", "no-eligible-exercise",
            "not-placed", "session-time"].find(r => this.blockReasons.has(r)) || null;
  }
  set lastBlock(reason) { this.blockReasons = new Set(reason ? [reason] : []); }

  /** Counted sets of `muscleId` over the whole week as built so far. */
  weekly(muscleId) {
    return this.sessions.reduce((t, s) => t + (s.workout ? s.workout.countedSets(muscleId) : 0), 0);
  }

  /** The sessions that train `muscle` on purpose (riders excluded). */
  sessionsFor(muscle) {
    return this.sessions.filter(s => s.block.muscles.includes(muscle) && !s.block.riders.has(muscle));
  }

  /** Records what a later pass added, so the audit can tell it from the first pass. */
  gain(entryMuscleId, exercise, sets) {
    const ids = new Set([entryMuscleId, ...exercise.primary, ...exercise.secondary]);
    for (const id of ids) {
      const g = this.gains.get(id) || { own: 0, counted: 0 };
      if (id === entryMuscleId) g.own += sets;
      g.counted += sets * creditWeight(exercise, id);
      this.gains.set(id, g);
    }
  }

  /**
   * Why `sets` more of `exercise` cannot go into `session` for `muscleId`, or
   * null if they can. The same limits as the first pass, all hard here:
   * the session length, the weekly maximum of every muscle the sets count
   * for (counted sets), the per-session cap of the muscles it trains
   * directly, recovery between sessions, and heavy spinal loading.
   */
  blocker(session, muscleId, exercise, sets, isNew) {
    const w = session.workout;
    const extra = isNew ? exerciseMinutes(exercise.compound, sets)
                        : sets * setMinutes(exercise.compound);
    if (Math.round(entriesMinutes(w.entries) + extra + ESTIMATE.warmupMinutes) > this.limit) return "session-time";
    for (const id of [...exercise.primary, ...exercise.secondary]) {
      if (!this.tracked.has(id)) continue;
      const max = MUSCLE_BY_ID.get(id).weeklySets[1];
      if (this.weekly(id) + sets * creditWeight(exercise, id) > max + 1e-9) return "weekly-maximum";
    }
    for (const id of exercise.primary) {
      if (!this.tracked.has(id)) continue;
      if (w.countedSets(id) + sets > WORKOUT.maxSetsPerSession + 1e-9) return "session-set-limit";
    }
    if (isNew) {
      if (recoveryConflict(exercise, session, this.sessions) !== null) return "recovery";
      if (this.axialProblem(exercise, session)) return "axial-load";
    }
    return null;
  }

  /**
   * Every chosen muscle gets at least one exercise of its own in the week,
   * even when other lifts already credit it (the user chose it). Tried in the
   * sessions that train it, emptiest first. When its weekly maximum leaves no
   * room, an assisting lift chosen for another muscle is swapped for that
   * muscle's next-best one that does not credit it (EZ bar curl → cable curl
   * for the forearms). A muscle that still gets nothing is recorded in
   * `shortfalls` and the audit says so.
   */
  ensureDirectWork() {
    const has = m => this.sessions.some(s => s.workout.entries.some(e => e.exercise.trainsPrimarily(m.id)));
    for (const id of this.goals.keys()) {
      const m = MUSCLE_BY_ID.get(id);
      if (!m || has(m) || !exercisesFor(id).length) continue;
      const sets = WORKOUT.minDirectSets;
      if (this.weekly(id) + sets > m.weeklySets[1]) this.makeRoom(m, sets);
      this.lastBlock = null;
      let placed = this.addExercise(m, sets, true);
      if (!placed && this.blockReasons.has("session-time")) placed = this.makeTimeFor(m, sets);
      if (!placed) this.shortfalls.push({ muscleId: id, sets, reason: this.lastBlock || "no-eligible-exercise", kind: "no-direct" });
    }
  }

  /**
   * When no session has the minutes for `muscle`'s own exercise, its own
   * sessions give up sets, one at a time, from the muscles furthest above
   * their weekly minimum (never an exercise below WORKOUT.minDirectSets),
   * until the exercise fits; see the two rules below. Nothing changes if it
   * still would not. The sets given up are recorded as "direct-work-floor".
   */
  makeTimeFor(muscle, sets) {
    // First only from muscles above their weekly minimum; in a week too short
    // for every minimum, also from muscles that keep two exercises' worth of
    // their own sets, so each chosen muscle gets one exercise before another
    // gets a third or fourth set.
    const ownWeek = id => this.sessions.reduce((t, s) => t + s.workout.entriesFor(id).reduce((u, e) => u + e.sets, 0), 0);
    const rules = [
      e => this.weekly(e.muscleId) - 1 - MUSCLE_BY_ID.get(e.muscleId).weeklySets[0],
      e => ownWeek(e.muscleId) - 1 - 2 * WORKOUT.minDirectSets
    ];
    for (const spare of rules) for (const s of this.sessionsFor(muscle)) {
      const taken = [];
      for (let guard = 0; guard < 20; guard++) {
        this.lastBlock = null;
        if (this.addExercise(muscle, sets)) {
          for (const e of taken) this.lose(e.muscleId, 1, "direct-work-floor");
          return true;
        }
        if (!this.blockReasons.has("session-time")) break;
        const e = s.workout.entries.filter(e => e.sets > WORKOUT.minDirectSets && spare(e) >= 0)
          .sort((a, b) => spare(b) - spare(a) || b.sets - a.sets)[0];
        if (!e) break;
        e.sets--; taken.push(e);
      }
      for (const e of taken) e.sets++;                  // not enough here: put them back
    }
    this.lastBlock = "session-time";
    return false;
  }

  /** Swaps assisting lifts that credit `muscle` until `sets` direct sets fit under its maximum. */
  makeRoom(muscle, sets) {
    for (const s of this.sessions) {
      for (const e of [...s.workout.entries]) {
        if (this.weekly(muscle.id) + sets <= muscle.weeklySets[1]) return;
        if (!e.exercise.assists(muscle.id) || e.muscleId === muscle.id) continue;
        const owner = MUSCLE_BY_ID.get(e.muscleId);
        this.current = s;
        // Ranked without the entry itself, so a variant of the same movement qualifies.
        const at = s.workout.entries.indexOf(e);
        s.workout.entries.splice(at, 1);
        const ranked = this.rankFor(owner, s.block, s.workout).map(r => r.exercise);
        s.workout.entries.splice(at, 0, e);
        const alt = ranked.find(x => !x.assists(muscle.id) && !x.trainsPrimarily(muscle.id) && this.swapFits(s, e, x));
        if (alt) { e.exercise = alt; e.swapped = true; }
      }
    }
  }

  /**
   * Whether entry `e` of `session` can do `alt` instead with the same sets:
   * no muscle the change credits passes its weekly maximum or the per-session
   * cap, and the session stays within its length, recovery and axial limits.
   */
  swapFits(session, e, alt) {
    const old = e.exercise;
    const ids = new Set([...alt.primary, ...alt.secondary]);
    for (const id of ids) {
      if (!this.tracked.has(id)) continue;
      const delta = e.sets * (creditWeight(alt, id) - creditWeight(old, id));
      if (delta <= 0) continue;
      if (this.weekly(id) + delta > MUSCLE_BY_ID.get(id).weeklySets[1] + 1e-9) return false;
      if (alt.primary.includes(id) && session.workout.countedSets(id) + delta > WORKOUT.maxSetsPerSession + 1e-9) return false;
    }
    const minutes = entriesMinutes(session.workout.entries) - exerciseMinutes(old.compound, e.sets) +
      exerciseMinutes(alt.compound, e.sets) + ESTIMATE.warmupMinutes;
    if (Math.round(minutes) > this.limit) return false;
    if (recoveryConflict(alt, session, this.sessions) !== null) return false;
    if (axialLoad(alt) === "high" && axialLoad(old) !== "high" && this.axialProblem(alt, session)) return false;
    return true;
  }

  /**
   * Adds a new exercise of `sets` sets for `muscle` in the first session that
   * takes it, emptiest first. Returns true when it found one; otherwise
   * `lastBlock` holds the reason the best candidate was refused.
   */
  addExercise(muscle, sets, anywhere = false) {
    const byRoom = (a, b) => a.workout.minutes - b.workout.minutes || DayOfWeek.indexOf(a.day) - DayOfWeek.indexOf(b.day);
    const own = this.sessionsFor(muscle).sort(byRoom);
    // The direct-work floor may also use another session of the muscle's
    // family (a pull day for the forearms) when its own sessions are full;
    // recovery (blocker) still decides whether that day can take it.
    const rest = anywhere ? this.sessions.filter(s => !own.includes(s) &&
      s.block.muscles.some(m => m.family === muscle.family && !s.block.riders.has(m))).sort(byRoom) : [];
    const order = [...own, ...rest];
    if (!order.length) this.note("not-placed");
    for (const s of order) {
      this.current = s;
      let tried = false;
      for (const r of this.rankFor(muscle, s.block, s.workout)) {
        if (r.penalties.some(p => p.reason === "weekly-maximum")) { this.note("weekly-maximum"); continue; }
        tried = true;
        const why = this.blocker(s, muscle.id, r.exercise, sets, true);
        if (why) { this.note(why); continue; }
        const entry = new WorkoutEntry(r.exercise, muscle.id, sets);
        entry.penalties = r.penalties;
        entry.filled = true;
        s.workout.entries.push(entry);
        s.workout.skipped = s.workout.skipped.filter(x => x !== muscle);
        if (!s.block.muscles.includes(muscle)) {        // the direct-work floor used another day:
          s.block.muscles.push(muscle);                  // that session now trains it, and says so
          if (!s.workout.muscles.includes(muscle)) s.workout.muscles.push(muscle);
          delete s.block.loaded;                         // recovery (routine.js) recomputes what it loads
        }
        const used = this.usedThisWeek.get(muscle.id) || new Set();
        used.add(r.exercise); this.usedThisWeek.set(muscle.id, used);
        this.gain(muscle.id, r.exercise, sets);
        return true;
      }
      if (!tried) this.note("no-eligible-exercise");   // nothing left that is not the same movement
    }
    return false;
  }

  /**
   * The time the sessions have left goes to the muscles still under their
   * goal (the counted sets their experience and priority ask for), and to
   * nothing else: a session whose muscles have all reached their goal ends
   * early. Focus first, then Normal, then Maintain; within a level, the
   * muscle furthest below its goal. Each step is the cheapest that helps:
   * a set more on one of its exercises (up to WORKOUT.setsPerExercise), a
   * new exercise, then a set more up to WORKOUT.maxSetsPerExercise. Every
   * limit of the first pass holds (blocker). A muscle that cannot get closer
   * is recorded in `shortfalls` with the limit that stopped it.
   */
  fillToGoals() {
    const rank = id => ({ focus: 0, normal: 1, maintain: 2 })[this.priorityOf(id)] ?? 1;
    const need = id => this.goals.get(id) - this.weekly(id);
    const stuck = new Map();
    for (let guard = 0; guard < 500; guard++) {
      const open = [...this.goals.keys()]
        .filter(id => !stuck.has(id) && need(id) > VOLUME_TOLERANCE && exercisesFor(id).length)
        .sort((a, b) => rank(a) - rank(b) ||
          this.weekly(a) / this.goals.get(a) - this.weekly(b) / this.goals.get(b) || a.localeCompare(b));
      if (!open.length) break;
      const id = open[0], muscle = MUSCLE_BY_ID.get(id);
      if (!this.stepToward(muscle, need(id))) stuck.set(id, this.lastBlock || "no-eligible-exercise");
    }
    for (const [id, goal] of this.goals) {
      const short = goal - this.weekly(id);
      if (short > VOLUME_TOLERANCE)
        this.shortfalls.push({ muscleId: id, sets: short, reason: stuck.get(id) || "no-eligible-exercise", kind: "goal" });
    }
  }

  /** One step of fillToGoals for `muscle`; false when no session can take any. */
  stepToward(muscle, missing) {
    const sessions = this.sessionsFor(muscle).sort((a, b) => a.workout.minutes - b.workout.minutes ||
      DayOfWeek.indexOf(a.day) - DayOfWeek.indexOf(b.day));
    this.lastBlock = sessions.length ? null : "not-placed";
    const more = cap => {
      for (const s of sessions) {
        const own = s.workout.entriesFor(muscle.id).filter(e => e.sets < cap).sort((a, b) => a.sets - b.sets);
        for (const e of own) {
          const why = this.blocker(s, muscle.id, e.exercise, 1, false);
          if (why) { this.note(why); continue; }
          e.sets++; this.gain(muscle.id, e.exercise, 1);
          return true;
        }
      }
      return false;
    };
    if (more(WORKOUT.setsPerExercise)) return true;
    const sets = Math.min(WORKOUT.setsPerExercise, Math.max(WORKOUT.minDirectSets, Math.round(missing)));
    for (let n = sets; n >= WORKOUT.minDirectSets; n--) if (this.addExercise(muscle, n, true)) return true;
    return more(WORKOUT.maxSetsPerExercise);
  }

  /**
   * Records sets the plan wanted for a muscle and the session could not
   * give, with the rule that stopped them. routine.audit() turns these into
   * the reasons a muscle finished under its target.
   */
  lose(muscleId, sets, reason) {
    if (sets > 0) this.events.push({ sessionId: this.current ? this.current.id : null, muscleId, sets, reason });
  }

  buildOne(session) {
    const block = session.block;
    this.current = session;
    // Big muscles first: their compounds give the small ones secondary credit.
    // A split day the user chose repeats in the week, and a long one may not
    // fit every muscle; there the muscles furthest below their weekly minimum
    // go first, so a muscle left out on Monday leads on Wednesday instead of
    // being left out every time. This decides the order, not the sets.
    const behind = m => (this.setsThisWeek.get(m.id) || 0) / m.weeklySets[0];
    const order = [...block.muscles].sort((a, b) =>
      (block.splitDay && !block.plannedSets ? behind(a) - behind(b) : 0) || b.minutes - a.minutes || a.id.localeCompare(b.id));
    const workout = new Workout(order, []);
    this.building = workout;
    const scale = Math.min(1, this.available / block.minutes);
    // Working sets that fit in the session after the warm-up.
    const budget = Math.floor(this.available / ESTIMATE.minutesPerSet);

    for (const muscle of order) {
      const room = budget - workout.sets;
      const aim = block.plannedSets ? block.plannedSets.get(muscle.id) || 0 : 0;
      if (room < WORKOUT.minDirectSets) {
        workout.skipped.push(muscle);
        this.lose(muscle.id, aim, "session-time");
        continue;
      }
      const credit = workout.directSets(muscle.id) + workout.assistedSets(muscle.id);
      let need;
      if (block.splitDay) {
        need = this.doseSets(muscle, workout, credit, block);
        if (block.plannedSets) {
          // What the distribution asked for: the muscle's own sets. The credit
          // other lifts give it was already taken off when the week was planned
          // (volume.js, ownSets), so it is not taken off again here.
          const hard = Math.floor(muscle.weeklySets[1] - (this.setsThisWeek.get(muscle.id) || 0) - credit);
          if (need < aim)
            this.lose(muscle.id, aim - need,
              hard < aim ? "weekly-maximum"
              : credit + aim > WORKOUT.maxSetsPerSession ? "session-set-limit"
              : "minimum-exercise");
        }
        if (!need) continue;           // dosed by the lifts above, or at its weekly maximum
        if (need > room) this.lose(muscle.id, need - room, "session-time");
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
        const made = new WorkoutEntry(next, muscle.id, 0);            // sets below
        made.penalties = this.lastPenalties;
        workout.entries.push(made);
      }
      const entries = workout.entriesFor(muscle.id);
      this.shareSets(entries, need);
      const given = entries.reduce((t, e) => t + e.sets, 0);
      if (given < need) {
        const barred = exercisesFor(muscle.id).some(ex => this.preferences.reasonFor(ex.id) === "cannot");
        this.lose(muscle.id, need - given, barred ? "user-restriction" : "no-eligible-exercise");
      }
      if (block.splitDay) this.keepWithinMaximums(workout, picks);

      const used = this.usedThisWeek.get(muscle.id) || new Set();
      for (const ex of picks) used.add(ex);
      this.usedThisWeek.set(muscle.id, used);
    }
    this.fitToSession(workout);
    workout.entries = orderEntries(workout.entries, this.priorityOf);
    workout.recommended = workout.entries.map(e => Object.assign(new WorkoutEntry(e.exercise, e.muscleId, e.sets), { orderRule: e.orderRule, penalties: e.penalties }));
    // Every muscle trained this week, not only this session's: a Legs day's
    // Romanian deadlift credits the forearms trained on Pull days too.
    for (const id of this.tracked)
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
        const cut = room.reverse().find(e => e.sets === most);
        cut.sets--;
        this.lose(cut.muscleId, 1, "session-time");
        continue;
      }
      const last = workout.entries[workout.entries.length - 1];
      this.lose(last.muscleId, last.sets, "session-time");
      workout.remove(last);
      if (!workout.entriesFor(last.muscleId).length) workout.skipped.push(MUSCLE_BY_ID.get(last.muscleId));
    }
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
    // The per-session cap counts what the session already credits it (counted sets, volume.js).
    const room = Math.min(Math.floor(WORKOUT.maxSetsPerSession - credit),
                          Math.floor(high - (this.setsThisWeek.get(muscle.id) || 0) - credit));
    // A day planned by distribution.js says how many of its own sets each
    // muscle gets, the expected credit already taken off; a split the user
    // chose aims at the middle of the weekly range, less this session's credit.
    const aim = block.plannedSets ? block.plannedSets.get(muscle.id) || 0
                                  : (low + high) / 2 / times - credit;
    const need = Math.min(room, Math.round(aim));
    if (need >= WORKOUT.minDirectSets) return need;
    return direct === 0 && room >= WORKOUT.minDirectSets ? WORKOUT.minDirectSets : 0;
  }

  /**
   * What `muscleId` can still take this week before its weekly maximum, if
   * it is trained this week at all (Infinity otherwise): its maximum less
   * what earlier sessions and this one already credit it.
   */
  headroom(muscleId, workout) {
    if (!this.tracked.has(muscleId)) return Infinity;
    // After the first pass every session is built: the week's count is the truth.
    if (this.firstPassDone) return MUSCLE_BY_ID.get(muscleId).weeklySets[1] - this.weekly(muscleId);
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
      this.lose(entry.muscleId, want - (limit >= WORKOUT.minDirectSets ? limit : 0), "weekly-maximum");
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
    const ranked = this.rankFor(muscle, block, workout);
    this.lastPenalties = ranked.length ? ranked[0].penalties : [];
    return ranked.length ? ranked[0].exercise : null;
  }

  /**
   * Every exercise bestFor could pick for `muscle` in this session, best
   * first, each with its sort key and named penalties. The fill pass
   * (fillToGoals) walks the same list, so both stages rank alike.
   */
  rankFor(muscle, block, workout) {
    const used = this.usedThisWeek.get(muscle.id) || new Set();
    const others = block.muscles.filter(m => m !== muscle).map(m => m.id);
    const focus = this.priorityOf(muscle.id) === "focus";
    const out = [];

    exercisesFor(muscle.id).forEach((ex, order) => {
      if (workout.has(ex) || workout.clashWith(ex)) return;
      const liked = this.preferences.reasonFor(ex.id);
      if (liked === "cannot") return;                    // the user can't do it: never picked
      // Loads a muscle that another session loads too soon (recovery.js).
      const elsewhere = this.current ? recoveryConflict(ex, this.current, this.sessions) !== null : false;
      // On a split day, a lift that would take another muscle it trains past
      // its weekly maximum goes last: a hack squat before a back squat once
      // the glutes have had enough.
      const overloads = block.splitDay &&
        (ex.primary.some(id => id !== muscle.id && this.headroom(id, workout) < WORKOUT.minDirectSets) ||
         ex.secondary.some(id => this.headroom(id, workout) < WORKOUT.minDirectSets * WORKOUT.secondaryCredit));
      // Two lifts that tire each other's helpers: whichever goes second is held back.
      const interferes = workout.entries.some(e => tiresBothWays(e.exercise, ex));
      // Same job as a lift this muscle already has in the session.
      const redundant = workout.entriesFor(muscle.id).some(e => ex.sameJobAs(e.exercise, muscle.id));
      // Heavy spinal loading the session or the day next to it already has (volume.js, axial load).
      const axial = this.current ? this.axialProblem(ex, this.current) : false;
      // Each reason is its own number, so a choice can be inspected afterwards.
      const penalties = [
        [used.has(ex), "repeat", WORKOUT.repeatDemotion],
        [interferes, "interference", WORKOUT.interferenceDemotion],
        [liked === "dislike", "dislike", WORKOUT.dislikeDemotion],
        [elsewhere, "recovery", WORKOUT.offDayDemotion],
        [redundant, "same-job", WORKOUT.functionRepeatDemotion],
        [axial, "axial-load", WORKOUT.axialDemotion],
        [overloads, "weekly-maximum", TIERS.length + 1]
      ].filter(p => p[0]).map(p => ({ reason: p[1], steps: p[2] }));
      // The session-overlap tie-break favours lifts that also train the day's other
      // muscles. For a Focus muscle it would pick the broader, less specific
      // movement, so it is left out there.
      const overlap = focus ? 0 :
        -others.filter(id => ex.trainsPrimarily(id) || ex.assists(id)).length;
      const key = [
        tierRank(ex.tierFor(muscle.id)) + penalties.reduce((t, p) => t + p.steps, 0),
        overlap,
        order
      ];
      out.push({ exercise: ex, key, penalties });
    });
    return out.sort((a, b) => compareKeys(a.key, b.key));
  }

  /**
   * Whether adding high-axial `exercise` (volume.js) to `session` would give
   * it more than WORKOUT.maxAxialPerSession such lifts, or put one the day
   * before or after another session that has one. Always false for a lift
   * that does not load the spine heavily.
   */
  axialProblem(exercise, session) {
    if (axialLoad(exercise) !== "high") return false;
    const w = session.workout || this.building;
    if (w && axialCount(w.entries) + 1 > WORKOUT.maxAxialPerSession) return true;
    return this.sessions.some(o => o !== session && o.workout &&
      DayOfWeek.distance(o.day, session.day) <= 1 && axialCount(o.workout.entries) > 0);
  }
}

function compareKeys(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
