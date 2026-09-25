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

    this.muscles = MUSCLES;
    this.selection = new MuscleSelection(MUSCLES);
    // The diet fuels this routine's training: its muscles, frequency and length.
    // Only muscles the exercise database can fill count; the rest get no work.
    this.nutrition = new NutritionPlan(() => ({
      muscles: this.selectedMuscles().filter(m => exercisesFor(m.id).length > 0),
      sessionsPerWeek: this.sessionsPerWeek,
      sessionMinutes: this.sessionMinutes
    }));
    this.sessions = [];
    this.plannedMeals = [];
    this.nextId = 1;
  }

  slot(day, hour) { return this.slots.get(day + "-" + hour); }
  allSlots() { return [...this.slots.values()]; }
  /** What the user chose on the Targets stage; see selection.js. */
  selectedMuscles() { return this.selection.muscles(); }

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

  /* ------------------------------- generation ----------------------------- */

  generate() {
    const requested = this.sessionsPerWeek;
    const blocks = this.buildBlocks();
    if (blocks.length === 0) return { placed: 0, requested, meals: 0, reason: "no-muscles" };
    if (requested < 1)       return { placed: 0, requested, meals: 0, reason: "no-sessions" };

    this.clearGenerated();
    if (!this.allSlots().some(s => s.isFree()))
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

    const reason = placed === 0 ? "no-valid-combination"
                 : placed < requested ? "partial" : "ok";
    return { placed, requested, meals, reason, limit };
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
