/* ------------------------------ aggregate root ---------------------------- */

/* Training days a week the user can ask for: one session a day at most. */
const TRAINING_DAYS_RANGE = [1, 7];

/* ------------------------------- recovery -------------------------------- */

/**
 * The muscles a block really works: its own (riders get no work of their
 * own), plus the other primary muscles of each one's first-choice exercise
 * — a quads day's back squat trains the glutes too, a lats day's row the
 * upper back. Recovery is judged on these, so a glutes day never lands the
 * day after a squat day.
 */
function loadedMuscles(block) {
  if (!block.loaded) {
    const own = block.muscles.filter(m => !block.riders.has(m));
    const extra = own.flatMap(m => (exercisesFor(m.id)[0] || { primary: [] }).primary)
                     .map(id => MUSCLE_BY_ID.get(id));
    block.loaded = [...new Set([...own, ...extra])];
  }
  return block.loaded;
}

/**
 * The muscle that block `a` on `dayA` and block `b` on `dayB` would both
 * train before its recovery days have passed, or null. The one recovery
 * rule: the scheduler, its lookahead and moving a session all ask it.
 */
function recoveryClash(a, dayA, b, dayB) {
  const gap = DayOfWeek.distance(dayA, dayB);
  const theirs = loadedMuscles(b);
  return loadedMuscles(a).find(m => theirs.includes(m) && gap < m.recoveryDays) || null;
}

/* ------------------------------- splits ---------------------------------- */

/**
 * How the user wants the week's sessions divided. "auto" is the planner's
 * own distribution (distribution.js): each muscle's weekly target spread
 * over the training days. The others are the splits people already
 * train by: each day trains the chosen muscles of the families listed for
 * it, the days repeat in order until the training days run out, and each
 * session gets the best dose for its muscles within the length the user
 * chose, which may end it early (WorkoutBuilder.doseSets).
 *
 * Core (abs, obliques, lower back) goes with the legs, as is common: it
 * keeps the upper days for the presses and pulls.
 */
const SPLITS = Object.freeze({
  "auto":           { label: "Automatic",           days: null },
  "upper-lower":    { label: "Upper · Lower",       days: [["Upper", ["push", "pull"]],
                                                          ["Lower", ["legs", "core"]]] },
  "push-pull-legs": { label: "Push · Pull · Legs",  days: [["Push", ["push"]], ["Pull", ["pull"]],
                                                          ["Legs", ["legs", "core"]]] },
  "full-body":      { label: "Full body",           days: [["Full body", ["push", "pull", "legs", "core"]]] }
});

class WeeklyRoutine {
  constructor() {
    this.sessionsPerWeek = 4;
    this.sessionMinutes = 60;
    this.experience = null;         // an EXPERIENCE_LEVELS id once the user says
    this.preferredWindow = "evening";
    this.firstHour = FIRST_HOUR;
    this.lastHour = LAST_HOUR;

    this.slots = new Map();
    for (const day of DayOfWeek.values)
      for (let h = this.firstHour; h <= this.lastHour; h++)
        this.slots.set(day + "-" + h, new TimeSlot(day, h));

    this.muscles = MUSCLES;
    this.selection = new MuscleSelection(MUSCLES);
    // The diet fuels this routine's training: its muscles, frequency and length.
    // Only muscles the exercise database can fill count; the rest get no work.
    // Only the days the plan will use count, not every day offered.
    this.nutrition = new NutritionPlan(() => ({
      muscles: this.selectedMuscles().filter(m => exercisesFor(m.id).length > 0),
      sessionsPerWeek: this.plannedSessions(),
      sessionMinutes: this.sessionMinutes,
      weeklySets: this.plannedWeeklySets()
    }));
    this.sessions = [];
    this.leftOut = [];          // blocks the last generate() could not give a day (see generate)
    this.plannedFor = new Set(); // ids of the muscles the last generated week was planned for
    this.plannedMeals = [];
    this.offDays = new Set();       // days the user can't train (they still eat)
    this.nextId = 1;
    this.split = "auto";            // how the sessions are divided; see SPLITS
  }

  /**
   * How the weekly targets fit the time the user has, or null until
   * experience is known: fitToTime()'s answer, checked against the week the
   * planner would really build (weekPlan), so the targets it shows are the
   * sets Generate gives. Adds to fitToTime's fields:
   *   days         the training days the plan uses (recovery and the free
   *                hours may leave fewer than asked for)
   *   askedDays    the training days asked for that are free
   *   unplaced     muscle ids no placed session carries (a split with more
   *                days than the week: Push · Pull · Legs over 2 days)
   */
  weekFit(experience = this.experience) {
    if (!experience) return null;
    return this.weekPlan(experience).fit;
  }

  /**
   * The week the planner would build for these inputs, worked out once per
   * change of input (it is asked for by the notes, the diet and Generate):
   *
   *   1. fitToTime trims the weekly targets to the time, with the planner's
   *      one time model (estimate.js), which never under-counts;
   *   2. the blocks: the user's split, or distribution.js over the days;
   *   3. the scheduler tries them on the grid as painted (this week's
   *      generated sessions aside). An automatic plan with a day that cannot
   *      be placed is planned again for one day fewer, so no planned day's
   *      sets vanish;
   *   4. the workouts are built on those placements, and the targets
   *      adjusted to what the week really holds: the time model counts every
   *      set as a compound's and leaves out the credit a press gives the
   *      triceps, so a trimmed target goes back up, Focus first, while the
   *      week still delivers every target; a muscle the sessions cannot
   *      bring within TARGET_MATCH of its target has the target lowered to
   *      what they give, and is listed as trimmed.
   *
   * Returns { fit, blocks } where fit is weekFit's answer (also with
   * experience assumed) and blocks are the ones Generate places.
   */
  weekPlan(experience) {
    const key = JSON.stringify(this.planKey(experience));
    if (!this.planCache || this.planCache.key !== key)
      this.planCache = { key, plan: this.computeWeekPlan(experience) };
    return this.planCache.plan;
  }

  /** Everything weekPlan() reads, as a list; the busy hours come second to last. */
  planKey(experience) {
    const sel = this.selection.snapshot();
    return [experience, this.split, this.sessionsPerWeek, this.sessionMinutes,
      this.preferredWindow, [...this.offDays].sort(), sel.muscleIds, sel.priorities,
      this.allSlots().filter(s => s.state === SlotState.BUSY).map(s => s.day + s.hour),
      this.nutrition.showMeals && this.nutrition.isValid() ? this.nutrition.mealHours : []];
  }

  computeWeekPlan(experience) {
    // Only muscles the exercise database can fill take time.
    const muscles = this.selection.muscles().filter(m => exercisesFor(m.id).length > 0);
    const priorities = new Map(muscles.map(m => [m.id, this.selection.priority(m.id)]));
    const raw = new Map(muscles.map(m => [m.id, weeklyTarget(m, experience, priorities.get(m.id))]));
    const askedDays = Math.max(1, Math.min(this.sessionsPerWeek, this.availableDays().length));
    if (!muscles.length) {
      const fit = fitToTime(raw, muscles, priorities, askedDays, this.sessionMinutes);
      return { fit: { ...fit, days: askedDays, askedDays }, blocks: [], placements: [], limit: null, dropped: 0 };
    }

    let fit, blocks, placements, limit, days = askedDays;
    for (; days >= 1; days--) {
      fit = fitToTime(raw, muscles, priorities, days, this.sessionMinutes);
      blocks = this.split === "auto" ? this.distributedBlocks(fit.targets, days) : this.splitBlocks();
      ({ placements, limit } = new Scheduler(this.schedulingView(), blocks, this.blockUses(blocks.length))
        .plan(this.sessionsPerWeek));
      if (this.split !== "auto" || blocks.every(b => placements.some(p => p.block === b))) break;
    }
    days = Math.max(1, days);

    // 4. Build on the placements and settle each target on what the week holds.
    const targets = new Map(fit.targets);
    const trial = () => {
      const sessions = placements.map((p, i) => new WorkoutSession(i, p.day, p.start, p.block));
      return buildWeek(sessions, this.sessionMinutes, targets).sessions;
    };
    const credit = (sessions, id) => sessions.reduce((t, s) =>
      t + s.workout.directSets(id) + s.workout.assistedSets(id), 0);
    const carried = id => placements.some(p => p.block.muscles.some(m => m.id === id && !p.block.riders.has(m)));
    // How far the week misses the targets, in sets: under a floor, or over a
    // ceiling (TARGET_MATCH) other than by assisting credit alone, which the
    // page shows as "Covered by the lifts above".
    const miss = sessions => muscles.map(m => {
      if (!carried(m.id)) return 0;
      const got = credit(sessions, m.id), target = targets.get(m.id);
      const own = sessions.some(s => s.workout.entriesFor(m.id).length);
      const assisted = sessions.reduce((a, s) => a + s.workout.assistedSets(m.id), 0);
      const over = own || assisted < target ? Math.max(0, got - target - TARGET_MATCH.over) : 0;
      return Math.max(0, targetFloor(m, target) - got) + over;
    });

    let week = trial();
    // A target the sessions cannot reach comes down to what they give, until
    // the week built on the lowered targets reaches them all.
    for (let round = 0; round < 10; round++) {
      let lowered = false;
      for (const m of muscles) {
        if (!carried(m.id)) continue;
        const got = Math.floor(credit(week, m.id));
        if (got < targetFloor(m, targets.get(m.id))) { targets.set(m.id, got); lowered = true; }
      }
      if (!lowered) break;
      week = trial();
    }
    // A trimmed target goes back up while no muscle misses its own by more than before.
    const rank = { focus: 0, normal: 1, maintain: 2 };
    const raise = muscles.filter(m => carried(m.id) && targets.get(m.id) < raw.get(m.id))
      .sort((a, b) => rank[priorities.get(a.id)] - rank[priorities.get(b.id)] ||
                      (raw.get(b.id) - targets.get(b.id)) - (raw.get(a.id) - targets.get(a.id)));
    let missing = miss(week);
    for (const m of raise) {
      while (targets.get(m.id) < raw.get(m.id)) {
        targets.set(m.id, targets.get(m.id) + 1);
        const next = trial(), nextMissing = miss(next);
        if (nextMissing.every((n, i) => n <= missing[i])) { week = next; missing = nextMissing; continue; }
        targets.set(m.id, targets.get(m.id) - 1);
        break;
      }
    }

    const unplaced = muscles.filter(m => !carried(m.id)).map(m => m.id);
    const trimmed = muscles.filter(m => carried(m.id) && targets.get(m.id) < raw.get(m.id)).map(m => m.id);
    // A muscle with no day is reported as unplaced, not as lowered below its minimum.
    const belowMinimum = muscles.filter(m => carried(m.id) && targets.get(m.id) < m.weeklySets[0]).map(m => m.id);
    const worked = week.reduce((t, s) => t + Math.max(0, s.workout.minutes - ESTIMATE.warmupMinutes), 0);
    return {
      fit: { ...fit, targets, trimmed, belowMinimum, unplaced, meetsMinimums: !belowMinimum.length,
             fits: true, neededMinutes: worked,
             // The time of the sessions the week really has: a repeat taken out
             // for having nothing to do is not time the user can use.
             capacityMinutes: week.length * usableMinutes(this.sessionMinutes), days, askedDays },
      blocks,
      // Where the sessions that stay go, and what stopped the scheduler (generate() places these).
      placements: week.map(s => placements[s.id]), limit, dropped: placements.length - week.length
    };
  }

  /**
   * The grid as the user painted it, for planning the week without touching
   * the one on screen: generated sessions and meals count as free. Everything
   * else the Scheduler reads is this routine's own (the preferred window, the
   * days off, the meal hours), so the week it plans is the week Generate
   * places: generate() takes its placements from weekPlan(), it does not
   * schedule again.
   */
  schedulingView() {
    const slots = new Map(this.allSlots().map(s => [s.day + "-" + s.hour, {
      day: s.day, hour: s.hour,
      state: s.state === SlotState.BUSY ? SlotState.BUSY : SlotState.FREE,
      isFree() { return this.state === SlotState.FREE; }
    }]));
    return {
      preferredWindow: this.preferredWindow, nutrition: this.nutrition,
      offDays: this.offDays, firstHour: this.firstHour, lastHour: this.lastHour,
      allSlots: () => [...slots.values()], slot: (day, hour) => slots.get(day + "-" + hour)
    };
  }

  /** Weekly hard-set target per selected muscle id, after fitting the time, or null until experience is known. */
  weeklyTargets() {
    const fit = this.weekFit();
    return fit && fit.targets;
  }

  /**
   * A plain object describing every setting the user chose, safe to store:
   * the muscle selection, the nutrition inputs, the schedule preferences,
   * and the availability grid the user painted. Sessions and workouts are derived and are not
   * included - restore() rebuilds them with generate(), the same way
   * clicking Generate always has.
   */
  snapshot() {
    return {
      version: 1,
      selection: this.selection.snapshot(),
      nutrition: this.nutrition.snapshot(),
      sessionsPerWeek: this.sessionsPerWeek,
      sessionMinutes: this.sessionMinutes,
      experience: this.experience,
      preferredWindow: this.preferredWindow,
      split: this.split,
      offDays: [...this.offDays],
      busy: this.allSlots().filter(s => s.state === SlotState.BUSY).map(s => [s.day, s.hour]),
      hadPlan: this.sessions.length > 0
    };
  }

  /**
   * What a generated week is planned from: the planner's own inputs
   * (weekPlan's key) without the busy hours, since painting over a session
   * edits the week rather than asking for another. When it changes, the week
   * on screen no longer answers what was asked. The meals the calendar shows
   * are mealsKey().
   */
  inputsKey() {
    const key = this.planKey(this.experience);
    key.splice(-2, 1);
    return JSON.stringify(key);
  }

  /**
   * The meals as the calendar shows them: time, calories and protein. These
   * also follow the week itself (a removed session is a day less to fuel),
   * so after an edit they can change while inputsKey() does not.
   */
  mealsKey() {
    const n = this.nutrition;
    return n.showMeals && n.isValid() ? n.meals.map(m => m.hour + ":" + m.kcal + ":" + m.protein).join() : "";
  }

  /** Restores a snapshot(): every input, then the week it had, regenerated. */
  /*
   * Only values the controls could have set are taken; anything else keeps
   * the default. Stored data may be old or edited by hand, and a value no
   * control offers (a split id that is gone, 12 days a week, a busy hour off
   * the grid) would otherwise break the stages that read it.
   */
  restore(snap) {
    if (!snap || typeof snap !== "object") return;
    const list = v => Array.isArray(v) ? v : [];
    this.experience = EXPERIENCE_LEVELS.some(e => e.id === snap.experience) ? snap.experience : null;
    this.selection.restore(snap.selection && typeof snap.selection === "object" ? snap.selection : {});
    this.nutrition.restore(snap.nutrition || {});
    const [lo, hi] = TRAINING_DAYS_RANGE;
    if (Number.isInteger(snap.sessionsPerWeek) && snap.sessionsPerWeek >= lo && snap.sessionsPerWeek <= hi)
      this.sessionsPerWeek = snap.sessionsPerWeek;
    if (SESSION_LENGTH_OPTIONS.includes(snap.sessionMinutes)) this.sessionMinutes = snap.sessionMinutes;
    if (typeof snap.preferredWindow === "string" && Object.hasOwn(WINDOWS, snap.preferredWindow))
      this.preferredWindow = snap.preferredWindow;
    if (typeof snap.split === "string" && Object.hasOwn(SPLITS, snap.split)) this.split = snap.split;
    this.offDays = new Set(list(snap.offDays).filter(d => DayOfWeek.values.includes(d)));
    for (const entry of list(snap.busy))
      if (Array.isArray(entry) && this.slot(entry[0], entry[1])) this.markBusy(entry[0], entry[1]);
    if (snap.hadPlan === true) this.generate();
  }

  slot(day, hour) { return this.slots.get(day + "-" + hour); }
  allSlots() { return [...this.slots.values()]; }
  /** What the user chose on the Targets stage; see selection.js. */
  selectedMuscles() { return this.selection.muscles(); }

  /* ----------------------------- availability ---------------------------- */

  /**
   * A day the user cannot train: marked off with the day toggles, or every
   * hour of it painted busy. "Can't train" is not "busy": a day off keeps
   * its meals and any hours painted on it; it only takes no session.
   */
  isDayUnavailable(day) {
    return this.offDays.has(day) || this.isDayFullyBusy(day);
  }
  isDayFullyBusy(day) {
    return this.allSlots().every(s => s.day !== day || s.state === SlotState.BUSY);
  }
  /**
   * Marks a day off training, removing its session, or frees it again. A
   * day that is off only because its whole column is painted busy is freed
   * by clearing that paint.
   */
  setDayUnavailable(day, off) {
    if (off) {
      this.offDays.add(day);
      for (const s of this.sessions.filter(x => x.day === day)) this.removeSession(s);
      return;
    }
    this.offDays.delete(day);
    if (this.isDayFullyBusy(day))
      for (let h = this.firstHour; h <= this.lastHour; h++) this.clearSlot(day, h);
  }
  /** Days with at least one hour that is not busy. */
  availableDays() { return DayOfWeek.values.filter(d => !this.isDayUnavailable(d)); }

  /* ------------------------------- editing ------------------------------- */

  markBusy(day, hour) {
    const s = this.slot(day, hour); if (!s) return;
    this.detach(s); s.markBusy();
  }
  clearSlot(day, hour) {
    const s = this.slot(day, hour); if (!s) return;
    this.detach(s); s.release();
  }
  /** A session and a meal are atomic: touching one hour removes the whole thing. */
  detach(slot) {
    if (slot.session) this.removeSession(slot.session);
    if (slot.meal) this.removeMeal(slot.meal);
  }
  removeSession(session) {
    this.sessions = this.sessions.filter(s => s !== session);
    for (const s of this.allSlots()) if (s.session === session) s.release();
  }
  removeMeal(meal) {
    this.plannedMeals = this.plannedMeals.filter(m => m !== meal);
    for (const s of this.allSlots()) if (s.meal === meal) s.release();
  }
  clearGenerated() {
    for (const s of this.allSlots())
      if (s.state === SlotState.WORKOUT || s.state === SlotState.MEAL) s.release();
    this.sessions = []; this.plannedMeals = []; this.leftOut = []; this.plannedFor = new Set();
  }
  /** Clears the week. Targets and nutrition belong to their own stages. */
  reset() {
    for (const s of this.allSlots()) s.release();
    this.sessions = []; this.plannedMeals = []; this.nextId = 1;
    this.offDays.clear();
    this.sessionsPerWeek = 4; this.sessionMinutes = 60;
    this.preferredWindow = "evening";
    this.split = "auto";
  }

  /* ----------------------------- block building --------------------------- */

  /**
   * The weekly sets the plan aims for, per muscle id, for the diet: the fitted
   * targets (assuming DEFAULT_EXPERIENCE until the user says), or null when
   * there is nothing to train.
   */
  plannedWeeklySets() {
    const fit = this.weekPlan(this.experience || DEFAULT_EXPERIENCE).fit;
    return fit.targets.size ? fit.targets : null;
  }

  /**
   * The blocks for the week: the user's split when they chose one
   * (splitBlocks), otherwise the planner's own distribution of the weekly
   * targets over the training days (distributedBlocks).
   */
  planBlocks() {
    return this.weekPlan(this.experience || DEFAULT_EXPERIENCE).blocks;
  }

  /**
   * The automatic plan: one block per training day, from the weekly targets
   * (fitted to the time) and the rules in distribution.js. A muscle the
   * exercise database has nothing for rides along in a block of its family,
   * riding along as a rider. `targets` and `days` come from weekPlan.
   */
  distributedBlocks(targets, days) {
    const picked = this.selectedMuscles();
    const trainable = picked.filter(m => exercisesFor(m.id).length > 0);
    if (!trainable.length) return [];
    const priorities = new Map(trainable.map(m => [m.id, this.selection.priority(m.id)]));
    const free = this.availableDays();
    const timesCap = m => maxSpread(free, m.recoveryDays);
    const plan = planDistribution(trainable, targets, priorities, days, this.sessionMinutes, timesCap);

    const blocks = plan.days.map(d => {
      const block = new TrainingBlock(d.muscles);
      block.plannedSets = d.sets;
      block.limit = this.sessionMinutes;
      return block;
    });
    for (const muscle of picked.filter(m => !trainable.includes(m))) {
      const host = blocks.find(b => b.family === muscle.family) || blocks[0];
      host.muscles.push(muscle);
      host.riders.add(muscle);
    }
    return blocks;
  }

  /**
   * The blocks for a split the user chose (SPLITS): one per split day that
   * has any chosen muscle, each named after its day. The session length is
   * its limit, not its target: WorkoutBuilder doses it (doseSets).
   * Days with nothing chosen are left out — Upper · Lower with only leg
   * muscles picked is a Lower day, repeated as recovery allows.
   */
  splitBlocks() {
    const picked = this.selectedMuscles().filter(m => exercisesFor(m.id).length > 0);
    const blocks = [];
    for (const [name, families] of SPLITS[this.split].days) {
      const muscles = picked.filter(m => families.includes(m.family))
                            .sort((a, b) => b.minutes - a.minutes);
      if (!muscles.length) continue;
      const block = new TrainingBlock(muscles);
      block.name = name; block.limit = this.sessionMinutes;
      blocks.push(block);
    }
    return blocks;
  }

  /** The days of split `id` (SPLITS) that none of the chosen muscles go on. */
  emptySplitDays(id = this.split) {
    if (!SPLITS[id] || !SPLITS[id].days) return [];
    const picked = this.selectedMuscles().filter(m => exercisesFor(m.id).length > 0);
    return SPLITS[id].days.filter(([, families]) => !picked.some(m => families.includes(m.family)))
                          .map(([name]) => name);
  }

  /**
   * The splits that would place every training day asked for, with
   * everything else as it is now — tried on a copy, so this week is not
   * touched. Used to suggest a split when the chosen one has days the
   * selection leaves empty.
   */
  splitsThatFit() {
    const want = Math.min(this.sessionsPerWeek, this.availableDays().length);
    return Object.keys(SPLITS).filter(id => {
      if (id === "auto" || this.emptySplitDays(id).length === SPLITS[id].days.length) return false;
      const trial = new WeeklyRoutine();
      trial.restore({ ...this.snapshot(), split: id, hadPlan: false });
      return trial.generate().placed >= want;
    });
  }

  /**
   * The most times one block may go in the week. In the automatic plan every
   * training day is its own block, so once. A chosen split repeats its days
   * to fill the training days asked for: Upper · Lower over 4 days is each
   * day twice, Full body over 3 is three times. Recovery (recoveryClash)
   * still decides which days can take them.
   */
  blockUses(blockCount) {
    if (this.split === "auto" || !blockCount) return 1;
    return Math.ceil(Math.min(this.sessionsPerWeek, this.availableDays().length) / blockCount);
  }

  /**
   * Training days the diet counts. Before a week is generated: the days
   * asked for and free, but no more than the plan has sessions for (a day
   * nothing is planned on is a rest day). Once a
   * week exists, no more than the sessions actually in it, so a session
   * that did not fit, or that the user removed, is not fuelled.
   */
  plannedSessions() {
    const blocks = this.planBlocks().length;
    const planned = Math.min(this.sessionsPerWeek, this.availableDays().length,
                             blocks * this.blockUses(blocks));
    return this.sessions.length ? Math.min(planned, this.sessions.length) : planned;
  }

  /* ------------------------------- generation ----------------------------- */

  generate() {
    // The old week goes first, so a week that cannot be planned never leaves
    // the previous one on screen under a message saying nothing was planned.
    this.clearGenerated();
    const requested = this.sessionsPerWeek;
    const blocks = this.planBlocks();
    if (blocks.length === 0) return { placed: 0, requested, meals: 0,
      reason: this.selectedMuscles().length ? "no-exercises" : "no-muscles" };
    if (requested < 1)       return { placed: 0, requested, meals: 0, reason: "no-sessions" };

    if (!this.availableDays().length || !this.allSlots().some(s => s.isFree()))
      return { placed: 0, requested, meals: 0, reason: "no-blocks" };

    // Where each session goes was worked out with the targets (weekPlan, which
    // asks the Scheduler, scheduler.js): Generate places that week, it does not
    // plan another, so what the page showed beforehand is what it gets.
    const plan = this.weekPlan(this.experience || DEFAULT_EXPERIENCE);
    let { limit } = plan;
    for (const p of plan.placements) {
      const session = new WorkoutSession(this.nextId++, p.day, p.start, p.block);
      for (let h = session.startHour; h < session.endHour(); h++)
        this.slot(p.day, h).assignTo(session);
      this.sessions.push(session);
    }

    // What to do in each session; see workouts.js. The plan already took out the
    // sessions not worth a day (`plan.dropped`), so building the week again on
    // the ones that stay takes out none; if it ever did, they are counted too.
    const dropped = plan.dropped + this.buildWorkouts();
    const placed = this.sessions.length;
    // A block none of the sessions carries got no day: more blocks than training
    // days (Push · Pull · Legs over 2 days), or no gap that fit. Said where the
    // week is described, rather than leaving its muscles out without a word.
    const withDay = new Set(this.sessions.map(s => s.block));
    this.leftOut = blocks.filter(b => !withDay.has(b));
    this.plannedFor = new Set(blocks.flatMap(b => b.muscles.map(m => m.id)));
    if (dropped && placed + dropped >= Math.min(requested, this.availableDays().length)) limit = "enough";

    const meals = this.nutrition.showMeals && this.nutrition.isValid()
      ? this.placeMeals() : 0;

    const free = this.availableDays().length;
    const reason = placed === 0 ? (limit === "space" ? "no-room" : "no-valid-combination")
                 : placed >= requested ? "ok"
                 : placed >= free ? "days"
                 : limit === "enough" ? "rest" : "partial";
    // `dropped`: repeats taken out for having too little to do, so the status
    // can give that as the reason for a shorter week, not rest days between.
    return { placed, requested, free, meals, reason, limit, dropped, leftOut: this.leftOut };
  }

  /**
   * Gives every session its workout, aimed at the weekly targets, and takes
   * out a session not worth a day (buildWeek). Returns how many were taken out.
   */
  buildWorkouts() {
    const { dropped } = buildWeek(this.sessions, this.sessionMinutes, this.plannedWeeklySets());
    for (const s of dropped) this.removeSession(s);
    return dropped.length;
  }

  /**
   * Whether one more training day would be placed, with everything else as
   * it is now — tried on a copy, like splitsThatFit(). Lets a note offer
   * "a training day more" only when that would add a session.
   */
  extraDayFits() {
    const days = Math.max(this.sessionsPerWeek, this.sessions.length) + 1;
    if (days > TRAINING_DAYS_RANGE[1] || this.sessions.length >= this.availableDays().length) return false;
    const trial = new WeeklyRoutine();
    trial.restore({ ...this.snapshot(), sessionsPerWeek: days, hadPlan: false });
    return trial.generate().placed > this.sessions.length;
  }

  /**
   * How the week measures up to what the chosen muscles usually need
   * (estimate.js). For each chosen muscle with exercises: its weekly sets,
   * direct plus assisting credit (already halved), against the low end of
   * its `weeklySets`, and how many sessions train it: give it at least a
   * set's worth, direct or assisting (a press trains the triceps too).
   *
   * A muscle is "trained" in a session when that session gives it at least a
   * set's worth, direct or assisting: the one definition the summary, the
   * notes and the per-muscle messages all use (`times`).
   *
   *   untrained   chosen muscles no session trains, and that other lifts do
   *               not credit with their weekly minimum either. A muscle the
   *               lifts above already cover — forearms from rows and
   *               deadlifts — is not one. Two kinds:
   *     unplanned   no session carries the muscle at all: its block got no
   *                 day (leftOut), or the user removed its session
   *     removed     a session carries it and was given exercises for it,
   *                 which the user took out
   *     noTime      a session carries it, but had no time left for it
   *   short       trained, but below the low end of their weekly sets
   *   estimate    estimateTraining() for the same muscles and session length
   *
   * Read-only: it only counts what generate() and the user's edits built.
   */
  weeklyVolume() {
    const muscles = this.selectedMuscles().filter(m => exercisesFor(m.id).length > 0);
    const rows = muscles.map(m => {
      let sets = 0, times = 0;
      for (const s of this.sessions) {
        if (!s.workout) continue;
        const here = s.workout.directSets(m.id) + s.workout.assistedSets(m.id);
        sets += here;
        if (here >= 1) times++;          // at least a set's worth, direct or assisting
      }
      return { muscle: m, sets, times, need: m.weeklySets[0] };
    });
    const untrained = rows.filter(r => r.times === 0 && Math.round(r.sets) < r.need).map(r => r.muscle);
    const carrying = m => this.sessions.filter(s => s.block.muscles.includes(m) && !s.block.riders.has(m));
    const takenOut = m => carrying(m).some(s => s.workout && s.workout.recommended.some(e => e.muscleId === m.id));
    return {
      rows,
      untrained,
      unplanned:  untrained.filter(m => !carrying(m).length),
      removed:    untrained.filter(m => carrying(m).length && takenOut(m)),
      noTime:     untrained.filter(m => carrying(m).length && !takenOut(m)),
      short:      rows.filter(r => r.times > 0 && Math.round(r.sets) < r.need),
      sets: rows.reduce((t, r) => t + r.sets, 0),
      need: rows.reduce((t, r) => t + r.need, 0),
      estimate: estimateTraining(muscles, this.sessionMinutes)
    };
  }

  /* --------------------------- editing the plan --------------------------- */

  /** Starts on `day` where `session` fits in hours that are free or already its own. */
  startsFor(session, day) {
    const fits = h => { const s = this.slot(day, h);
      return s && (s.isFree() || s.session === session); };
    const out = [];
    for (let start = this.firstHour; start + session.durationHours - 1 <= this.lastHour; start++) {
      let ok = true;
      for (let h = start; h < start + session.durationHours && ok; h++) ok = fits(h);
      if (ok) out.push(start);
    }
    return out;
  }

  /**
   * Why `session` cannot move to `day`, or null if it can: another session
   * is already there, no free hours fit it, or a muscle would be trained
   * again before its recovery days have passed.
   */
  moveBlocker(session, day) {
    const others = this.sessions.filter(s => s !== session);
    if (this.isDayUnavailable(day)) return { kind: "off" };
    if (others.some(s => s.day === day)) return { kind: "taken" };
    if (!this.startsFor(session, day).length) return { kind: "no-room" };
    for (const other of others) {
      const muscle = recoveryClash(session.block, day, other.block, other.day);
      if (muscle) return { kind: "recovery", muscle, other };
    }
    return null;
  }

  /**
   * Moves a session, keeping its exercises. Without a start it keeps its
   * time if that fits the new day, else the nearest that does. Returns
   * false if it cannot go there.
   */
  moveSession(session, day, start) {
    if (this.moveBlocker(session, day)) return false;
    const starts = this.startsFor(session, day);
    if (start === undefined)
      start = starts.reduce((a, b) =>
        Math.abs(b - session.startHour) < Math.abs(a - session.startHour) ? b : a);
    if (!starts.includes(start)) return false;
    for (const s of this.allSlots()) if (s.session === session) s.release();
    session.day = day; session.startHour = start;
    for (let h = start; h < session.endHour(); h++) this.slot(day, h).assignTo(session);
    return true;
  }

  /**
   * Muscles still inside their recovery window on `day`: trained on a day
   * before it, fewer than their recoveryDays ago. Riders get no work, so
   * they have nothing to recover from.
   */
  recoveringOn(day) {
    const out = [];
    for (const s of this.sessions) {
      const ago = (DayOfWeek.indexOf(day) - DayOfWeek.indexOf(s.day) + 7) % 7;
      for (const m of s.block.muscles)
        if (!s.block.riders.has(m) && ago > 0 && ago < m.recoveryDays && !out.includes(m)) out.push(m);
    }
    return out;
  }

  /** The next session after `session`, round the week, that trains `muscle`. */
  nextTraining(session, muscle) {
    const ahead = s => (DayOfWeek.indexOf(s.day) - DayOfWeek.indexOf(session.day) + 7) % 7 || 7;
    return this.sessions.filter(s => s !== session && s.trains(muscle))
      .sort((a, b) => ahead(a) - ahead(b))[0] || null;
  }

  /**
   * Puts the meals on the grid.
   *
   * Each meal gets ONE hour for the whole week, not one per day. Choosing per
   * day makes breakfast sit at 7am on the days with no session and 8am on the
   * days where a session covers 7am, and the row ends up ragged for no reason
   * the user can see. A meal is a habit: it belongs on the same line all week.
   * Days where that hour is genuinely taken simply miss that meal.
   */
  placeMeals() {
    let count = 0;
    for (const meal of this.nutrition.meals) {
      const hour = this.bestHourForWeek(meal.hour, 2);
      if (hour === null) continue;
      for (const day of DayOfWeek.values) {
        if (!this.slot(day, hour).isFree()) continue;
        const planned = new PlannedMeal(this.nextId++, day, hour,
          meal.name, meal.kcal, meal.protein, meal.focus);
        this.slot(day, hour).assignMeal(planned);
        this.plannedMeals.push(planned);
        count++;
      }
    }
    return count;
  }

  /**
   * The hour near `target` that is free on the most days. Ties go to the hour
   * closest to the target, and then to the earlier one.
   */
  bestHourForWeek(target, radius) {
    let best = null;
    for (let d = 0; d <= radius; d++) {
      for (const h of (d === 0 ? [target] : [target - d, target + d])) {
        if (h < this.firstHour || h > this.lastHour) continue;
        const free = DayOfWeek.values.filter(day => this.slot(day, h).isFree()).length;
        if (free === 0) continue;
        if (!best || free > best.free) best = { hour: h, free };
      }
    }
    return best ? best.hour : null;
  }
}
