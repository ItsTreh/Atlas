/* ------------------------------ aggregate root ---------------------------- */

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

    this.muscles = MUSCLE_SEED.map(s => new Muscle(...s));
    this.nutrition = new NutritionPlan();
    this.sessions = [];
    this.plannedMeals = [];
    this.nextId = 1;
  }

  slot(day, hour) { return this.slots.get(day + "-" + hour); }
  allSlots() { return [...this.slots.values()]; }
  selectedMuscles() { return this.muscles.filter(m => m.selected); }

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
  reset() {
    for (const s of this.allSlots()) s.release();
    this.sessions = []; this.plannedMeals = []; this.nextId = 1;
    for (const m of this.muscles) m.selected = true;
    this.sessionsPerWeek = 4; this.sessionMinutes = 60;
    this.preferredWindow = "evening";
    this.nutrition = new NutritionPlan();
  }

  /* ----------------------------- block building --------------------------- */

  /**
   * Packs the selected muscles into blocks that fit `sessionMinutes`.
   * Muscles are grouped by family first — training Chest with Triceps is a
   * routine, training Chest with Hamstrings is a coincidence. Core is treated
   * as a filler: it rides along in a block with room to spare, and only forms
   * its own block when nothing else will take it.
   */
  buildBlocks() {
    const limit = this.sessionMinutes;
    const picked = this.selectedMuscles();
    const blocks = [];

    for (const key of ["push", "pull", "legs"]) {
      const pool = picked.filter(m => m.family === key)
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

    // Core muscles ride along where there is room, once each.
    const core = picked.filter(m => m.family === "core");
    for (const muscle of core) {
      const host = blocks.find(b => b.freeMinutes(limit) >= muscle.minutes);
      if (host) host.muscles.push(muscle);
      else blocks.push(new TrainingBlock([muscle]));
    }
    return blocks;
  }

  findFreeBlocks() {
    const out = [];
    for (const day of DayOfWeek.values) {
      let start = null;
      for (let h = this.firstHour; h <= this.lastHour + 1; h++) {
        const free = h <= this.lastHour && this.slot(day, h).isFree();
        if (free && start === null) start = h;
        else if (!free && start !== null) { out.push(new FreeBlock(day, start, h - start)); start = null; }
      }
    }
    return out;
  }

  /* ------------------------------- generation ----------------------------- */

  generate() {
    const requested = this.sessionsPerWeek;
    const blocks = this.buildBlocks();
    if (blocks.length === 0) return { placed: 0, requested, meals: 0, reason: "no-muscles" };
    if (requested < 1)       return { placed: 0, requested, meals: 0, reason: "no-sessions" };

    this.clearGenerated();

    const byDay = new Map();
    for (const fb of this.findFreeBlocks()) {
      if (!byDay.has(fb.day)) byDay.set(fb.day, []);
      byDay.get(fb.day).push(fb);
    }
    for (const list of byDay.values())
      list.sort((a, b) => b.length - a.length || a.startHour - b.startHour);

    const days = DayOfWeek.values.filter(d => byDay.has(d));
    if (days.length === 0) return { placed: 0, requested, meals: 0, reason: "no-blocks" };

    let rotation = 0, placed = 0;

    for (let i = 0; i < requested; i++) {
      const day = days[i % days.length];
      const free = byDay.get(day);
      if (!free || free.length === 0) continue;

      const choice = this.pickBlock(day, blocks, rotation, free);
      if (!choice) continue;                       // recovery says no — skip, don't force

      const { block, fb } = choice;
      const start = fb.startFor(block.durationHours, this.preferredWindow);
      const session = new WorkoutSession(this.nextId++, day, start, block);
      for (let h = session.startHour; h < session.endHour(); h++)
        this.slot(day, h).assignTo(session);
      this.sessions.push(session);

      // The session may sit in the middle of the block, so up to two remainders
      // go back into the pool.
      free.splice(free.indexOf(fb), 1);
      const headLength = session.startHour - fb.startHour;
      const tailLength = fb.endHour - session.endHour();
      if (headLength >= 1) free.push(new FreeBlock(day, fb.startHour, headLength));
      if (tailLength >= 1) free.push(new FreeBlock(day, session.endHour(), tailLength));
      free.sort((a, b) => b.length - a.length || a.startHour - b.startHour);

      rotation = (blocks.indexOf(block) + 1) % blocks.length;
      placed++;
    }

    const meals = this.nutrition.showMeals && this.nutrition.isValid()
      ? this.placeMeals() : 0;

    const reason = placed === 0 ? "no-valid-combination"
                 : placed < requested ? "partial" : "ok";
    return { placed, requested, meals, reason };
  }

  /**
   * Walks the block rotation from `startAt` and returns the first block that
   * (a) respects every muscle's recovery window against what is already
   * scheduled, and (b) has a free block on this day long enough to hold it.
   */
  pickBlock(day, blocks, startAt, freeBlocks) {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[(startAt + i) % blocks.length];
      if (!this.respectsRecovery(day, block)) continue;
      const hours = block.durationHours;
      const fitting = freeBlocks.filter(f => f.fits(hours));
      if (fitting.length === 0) continue;
      // A block inside the preferred window wins; otherwise fall back to the
      // longest one, which is what the rule was before the preference existed.
      const inWindow = fitting.find(f => f.touches(this.preferredWindow, hours));
      return { block, fb: inWindow || fitting[0] };
    }
    return null;
  }

  /** No muscle may be trained again before its recovery window has passed. */
  respectsRecovery(day, block) {
    for (const session of this.sessions) {
      const gap = DayOfWeek.distance(day, session.day);
      for (const muscle of block.muscles) {
        if (!session.trains(muscle)) continue;
        if (gap < muscle.recoveryDays) return false;
      }
    }
    return true;
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
