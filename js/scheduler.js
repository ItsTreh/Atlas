/* ===========================================================================
   Scheduler — decides where each training block goes in the week.

   The old approach walked the days in order (Mon, Tue, Wed…) and dropped each
   session into the longest free gap of that day. It never looked at how the
   day was actually shaped, so it filled the start of the week back to back,
   started sessions the minute work ended, and happily squeezed a 90-minute
   session in before midnight on a packed day while the weekend sat empty.

   This one looks at every place a session could go and scores it against the
   shape of the week the user painted:

     • how busy the day already is        (a light day beats a 9-hour one)
     • what sits right before and after   (time to get to and from the gym)
     • the preferred training window      (and how far outside it we'd drift)
     • sensible hours                     (no 6am or 11pm unless asked for)
     • the meal times                     (don't eat the dinner hour)
     • the rest of the week's sessions    (rest days between, same time daily)

   Sessions are placed one at a time, each at the best-scoring spot that keeps
   every muscle's recovery window. The grid is only read, never written: the
   caller turns the returned placements into real sessions.
   ========================================================================= */

/* Weights. Positive is good. They are tuned against each other, so change one
   with the others in mind: a busy 8-hour day (-16) should lose to a free one,
   but not so badly that a session is pushed out of the preferred window (+40). */
const SCORE = Object.freeze({
  inWindow:      40,  // session fully inside the preferred window (scaled by overlap)
  windowDrift:    6,  // per hour a session sits outside the window
  dayLoad:        2,  // per busy hour on the day
  noBufferBefore: 8,  // busy right up to the start — no time to get there
  noBufferAfter:  8,  // busy straight after — no time to shower and leave
  oddHour:        8,  // per hour trained before 7am or after 10pm
  mealClash:     12,  // per recommended meal hour the session covers
  sameDay:       60,  // a second session on a day that already has one
  nextDay:       15,  // a session on the day before or after another one
  sameStart:      6,  // same start hour as another session — builds a habit
  reuse:         25,  // per time this block has already been placed
  volume:       0.1   // per minute of training — bigger blocks win ties
});

const EARLIEST_SENSIBLE = 7;   // training before this hour counts as odd
const LATEST_SENSIBLE   = 22;  // training past this hour counts as odd

class Placement {
  constructor(day, start, block) {
    this.day = day; this.start = start; this.block = block;
  }
  get hours() { return this.block.durationHours; }
  get end() { return this.start + this.hours; }
  trains(muscle) { return this.block.has(muscle); }
}

class Scheduler {
  /**
   * @param routine  the WeeklyRoutine, already cleared of generated sessions
   * @param blocks   the TrainingBlocks to rotate through
   */
  constructor(routine, blocks) {
    this.routine = routine;
    this.blocks = blocks;
    this.window = routine.preferredWindow === "any"
      ? null : WINDOWS[routine.preferredWindow];

    const n = routine.nutrition;
    this.mealHours = n.showMeals && n.isValid() ? n.meals.map(m => m.hour) : [];

    // How heavy each day is, counted once up front.
    this.load = new Map(DayOfWeek.values.map(day => [day,
      routine.allSlots().filter(s => s.day === day && s.state === SlotState.BUSY).length]));
  }

  /**
   * Places up to `requested` sessions.
   * @returns {{ placements: Placement[], limit: null | "recovery" | "space" }}
   *   `limit` says what stopped the scheduler short, if anything.
   */
  plan(requested) {
    const placements = [];
    const taken = new Set();
    let limit = null;

    for (let i = 0; i < requested; i++) {
      const best = this.bestPlacement(placements, taken);
      if (!best.placement) { limit = best.limit; break; }
      placements.push(best.placement);
      for (let h = best.placement.start; h < best.placement.end; h++)
        taken.add(best.placement.day + "-" + h);
    }
    return { placements, limit };
  }

  /** The highest-scoring legal placement of any block, given what's placed. */
  bestPlacement(placements, taken) {
    let best = null, bestScore = -Infinity, sawRoom = false;

    for (const block of this.blocks) {
      const starts = this.openStarts(block.durationHours, taken);
      if (starts.length) sawRoom = true;
      for (const { day, start } of starts) {
        const candidate = new Placement(day, start, block);
        if (!this.respectsRecovery(candidate, placements)) continue;
        const score = this.score(candidate, placements);
        if (score > bestScore) { best = candidate; bestScore = score; }
      }
    }
    return { placement: best, limit: best ? null : sawRoom ? "recovery" : "space" };
  }

  /** Every (day, start) where `hours` consecutive hours are free. */
  openStarts(hours, taken) {
    const out = [];
    const r = this.routine;
    for (const day of DayOfWeek.values) {
      for (let start = r.firstHour; start + hours - 1 <= r.lastHour; start++) {
        let ok = true;
        for (let h = start; h < start + hours && ok; h++)
          ok = r.slot(day, h).isFree() && !taken.has(day + "-" + h);
        if (ok) out.push({ day, start });
      }
    }
    return out;
  }

  /** No muscle may be trained again before its recovery window has passed. */
  respectsRecovery(candidate, placements) {
    for (const other of placements) {
      const gap = DayOfWeek.distance(candidate.day, other.day);
      for (const muscle of candidate.block.muscles)
        if (other.trains(muscle) && gap < muscle.recoveryDays) return false;
    }
    return true;
  }

  score(c, placements) {
    let score = 0;

    // --- the day itself -------------------------------------------------
    score -= SCORE.dayLoad * this.load.get(c.day);
    if (this.isBusy(c.day, c.start - 1)) score -= SCORE.noBufferBefore;
    if (this.isBusy(c.day, c.end))       score -= SCORE.noBufferAfter;

    // --- time of day ----------------------------------------------------
    if (this.window) {
      const overlap = Math.max(0,
        Math.min(c.end, this.window.to) - Math.max(c.start, this.window.from));
      if (overlap > 0) {
        score += SCORE.inWindow * overlap / c.hours;
      } else {
        const drift = c.end <= this.window.from
          ? this.window.from - c.end + 1
          : c.start - this.window.to + 1;
        score -= SCORE.windowDrift * drift;
      }
    }
    for (let h = c.start; h < c.end; h++) {
      if (h < EARLIEST_SENSIBLE || h >= LATEST_SENSIBLE) score -= SCORE.oddHour;
      if (this.mealHours.includes(h)) score -= SCORE.mealClash;
    }

    // --- the rest of the week -------------------------------------------
    let uses = 0, habit = false;
    for (const other of placements) {
      const gap = DayOfWeek.distance(c.day, other.day);
      if (gap === 0) score -= SCORE.sameDay;
      else if (gap === 1) score -= SCORE.nextDay;
      if (other.start === c.start) habit = true;
      if (other.block === c.block) uses++;
    }
    if (habit) score += SCORE.sameStart;
    score -= SCORE.reuse * uses;
    score += SCORE.volume * c.block.minutes;

    return score;
  }

  /** Busy in the grid the user painted. Hours off the grid count as free. */
  isBusy(day, hour) {
    const slot = this.routine.slot(day, hour);
    return !!slot && slot.state === SlotState.BUSY;
  }
}
