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

/* How far over the session length a family may run and still be one session,
   its sets scaled down to fit, rather than splitting off a small extra day. */
const SESSION_STRETCH = 1.25;

class WeeklyRoutine {
  constructor() {
    this.sessionsPerWeek = 4;
    this.sessionMinutes = 60;
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
      sessionMinutes: this.sessionMinutes
    }));
    this.sessions = [];
    this.plannedMeals = [];
    this.offDays = new Set();       // days the user can't train (they still eat)
    this.nextId = 1;
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
    this.sessions = []; this.plannedMeals = [];
  }
  /** Clears the week. Targets and nutrition belong to their own stages. */
  reset() {
    for (const s of this.allSlots()) s.release();
    this.sessions = []; this.plannedMeals = []; this.nextId = 1;
    this.offDays.clear();
    this.sessionsPerWeek = 4; this.sessionMinutes = 60;
    this.preferredWindow = "evening";
  }

  /* ----------------------------- block building --------------------------- */

  /**
   * Packs the selected muscles into blocks that fit `sessionMinutes`.
   * Muscles are grouped by family first — training Chest with Triceps is a
   * routine, training Chest with Hamstrings is a coincidence. Core is treated
   * as a filler: it rides along in a block with room to spare, and only forms
   * its own block when nothing else will take it.
   *
   * A muscle the exercise database has nothing for yet (exercises.js) never
   * anchors a session — it would be a session with nothing in it. It joins
   * one as a rider instead: named in it, credited with the secondary work
   * the session gives it, but taking none of its time, since there is no
   * exercise to spend the time on. Only when nothing else is selected do
   * such muscles form blocks of their own.
   */
  buildBlocks() {
    const limit = this.sessionMinutes;
    const picked = this.selectedMuscles();
    const blocks = [];
    const hasExercises = m => exercisesFor(m.id).length > 0;
    const riders = picked.filter(m => !hasExercises(m));
    const fillers = picked.filter(m => m.family === "core" && hasExercises(m));

    for (const key of ["push", "pull", "legs"]) {
      const pool = picked.filter(m => m.family === key && hasExercises(m))
                         .sort((a, b) => b.minutes - a.minutes);
      let current = [];
      let used = 0;
      for (const muscle of pool) {
        if (used + muscle.minutes > limit && current.length) {
          blocks.push(new TrainingBlock(current)); current = []; used = 0;
        }
        if (muscle.minutes > limit) {           // a single muscle longer than the
          blocks.push(new TrainingBlock([muscle])); continue;   // whole session
        }
        current.push(muscle); used += muscle.minutes;
      }
      if (current.length) blocks.push(new TrainingBlock(current));
    }

    // Riders join a block of their own family if there is one (Traps goes
    // with Back rather than Chest), otherwise the first block.
    if (blocks.length) {
      for (const muscle of riders) {
        const host = blocks.find(b => b.family === muscle.family) || blocks[0];
        host.muscles.push(muscle);
        host.riders.add(muscle);
      }
    } else {
      fillers.push(...riders);           // nothing to ride on: plan them as fillers
    }

    // Core muscles ride along where there is room, once each.
    for (const muscle of fillers) {
      const host = blocks.find(b => b.freeMinutes(limit) >= muscle.minutes);
      if (host) host.muscles.push(muscle);
      else blocks.push(new TrainingBlock([muscle]));
    }
    return blocks;
  }

  /**
   * The blocks for the week, from buildBlocks() and then joined up:
   *
   *   • a family split only because it ran a little over the session (legs
   *     at 65 min in a 60-min session) is put back together, with its sets
   *     scaled to fit, rather than leaving a lone 20-minute Glutes day;
   *   • with fewer training days than blocks, the smallest block joins one
   *     of its own family, or the next smallest, until every block has a
   *     day — so every chosen muscle is trained. No muscle is dropped.
   */
  planBlocks() {
    // A block with no exercises at all (only Core chosen, say) is not a
    // training day: there is nothing to do in it.
    let blocks = this.buildBlocks().filter(b => b.muscles.some(m => exercisesFor(m.id).length));
    const join = (host, guest) => {
      blocks = blocks.filter(b => b !== host && b !== guest);
      blocks.push(TrainingBlock.merge(host, guest));
    };
    for (let pair; (pair = this.nearlyFits(blocks)); ) join(...pair);

    const days = Math.min(this.sessionsPerWeek, this.availableDays().length);
    while (blocks.length > Math.max(1, days)) {
      const [guest, ...rest] = [...blocks].sort((a, b) => a.minutes - b.minutes);
      join(rest.find(b => b.family === guest.family) || rest[0], guest);
    }
    for (const b of blocks) b.limit = this.sessionMinutes;
    return blocks;
  }

  /** Two blocks of one family that together run at most SESSION_STRETCH over the session. */
  nearlyFits(blocks) {
    let best = null;
    for (const a of blocks) for (const b of blocks) {
      if (a === b || a.family !== b.family || a.minutes < b.minutes) continue;
      const total = a.minutes + b.minutes;
      if (total <= this.sessionMinutes * SESSION_STRETCH && (!best || total < best.total))
        best = { pair: [a, b], total };
    }
    return best && best.pair;
  }

  /**
   * Training days the diet counts. Before a week is generated: the days
   * asked for and free, but no more than each block can use
   * (ESTIMATE.timesPerWeek each — past that a day is a rest day). Once a
   * week exists, no more than the sessions actually in it, so a session
   * that did not fit, or that the user removed, is not fuelled.
   */
  plannedSessions() {
    const planned = Math.min(this.sessionsPerWeek, this.availableDays().length,
                             this.planBlocks().length * ESTIMATE.timesPerWeek);
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

    // Where each session goes is the Scheduler's call; see scheduler.js.
    const { placements, limit } = new Scheduler(this, blocks).plan(requested);
    for (const p of placements) {
      const session = new WorkoutSession(this.nextId++, p.day, p.start, p.block);
      for (let h = session.startHour; h < session.endHour(); h++)
        this.slot(p.day, h).assignTo(session);
      this.sessions.push(session);
    }
    const placed = placements.length;

    // What to do in each session; see workouts.js.
    new WorkoutBuilder(this.sessions, this.sessionMinutes).build();

    const meals = this.nutrition.showMeals && this.nutrition.isValid()
      ? this.placeMeals() : 0;

    const free = this.availableDays().length;
    const reason = placed === 0 ? (limit === "space" ? "no-room" : "no-valid-combination")
                 : placed >= requested ? "ok"
                 : limit === "enough" ? "rest"
                 : placed >= free ? "days" : "partial";
    return { placed, requested, free, meals, reason, limit };
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
