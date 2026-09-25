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
     • the rest of the week's sessions    (rest days between, same time daily,
                                            no muscle on back-to-back days)

   Sessions are placed one at a time, each at the best-scoring spot that keeps
   every muscle's recovery window, on a day with no session yet: the user
   asks for training DAYS, so a day holds one session. Every block is placed
   once before any is placed again, so no chosen muscle is left out while
   another is repeated, and no block goes in more than ESTIMATE.timesPerWeek
   times: past that a day adds repetition, not useful training, and is
   better left as a rest day.

   Choosing the best spot one session at a time can paint the week into a
   corner — two push days that leave no legal day for pull. So before a
   spot is taken, a quick search over days (not hours) checks the rest of
   the week can still hold as many sessions as it could at the start; a spot
   that would cost a session is passed over for the next best.

   The grid is only read, never written: the caller turns the returned
   placements into real sessions.
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
  nextDay:       15,  // a session on the day before or after another one
  muscleNextDay: 20,  // per muscle trained again the day after (or before)
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
   * Places up to `requested` sessions, one a day.
   * @returns {{ placements: Placement[], limit: null | "enough" | "recovery" | "space" }}
   *   `limit` says what stopped the scheduler short, if anything: "enough"
   *   means every block already has all the sessions it can use.
   */
  plan(requested) {
    const placements = [];
    const taken = new Set();
    let limit = null;
    this.reachable = this.mostSessions([], requested);

    for (let i = 0; i < requested; i++) {
      const best = this.bestPlacement(placements, taken);
      if (!best.placement) { limit = best.limit; break; }
      placements.push(best.placement);
      for (let h = best.placement.start; h < best.placement.end; h++)
        taken.add(best.placement.day + "-" + h);
    }
    return { placements, limit };
  }

  /**
   * The highest-scoring legal placement, given what's placed. Blocks placed
   * the fewest times go first; a block only waits its turn if it has no
   * legal spot at all.
   */
  bestPlacement(placements, taken) {
    const uses = block => placements.filter(p => p.block === block).length;
    const days = new Set(placements.map(p => p.day));
    const open = this.blocks.filter(b => uses(b) < ESTIMATE.timesPerWeek);
    if (!open.length) return { placement: null, limit: "enough" };

    let sawRoom = false;
    for (const round of [...new Set(open.map(uses))].sort((a, b) => a - b)) {
      let best = null, bestScore = -Infinity;
      for (const block of open.filter(b => uses(b) === round)) {
        const starts = this.openStarts(block.durationHours, taken)
          .filter(({ day }) => !days.has(day));
        if (starts.length) sawRoom = true;
        const keeps = new Map();         // day → does placing here keep the week reachable?
        for (const { day, start } of starts) {
          const candidate = new Placement(day, start, block);
          if (!this.respectsRecovery(candidate, placements)) continue;
          if (!keeps.has(day)) {
            const next = [...placements, candidate];
            keeps.set(day, next.length + this.mostSessions(next, this.reachable - next.length)
                           >= this.reachable);
          }
          if (!keeps.get(day)) continue;
          const score = this.score(candidate, placements);
          if (score > bestScore) { best = candidate; bestScore = score; }
        }
      }
      if (best) return { placement: best, limit: null };
    }
    return { placement: null, limit: sawRoom ? "recovery" : "space" };
  }

  /**
   * How many more sessions fit on the days still empty, up to `want`,
   * keeping recovery, one session a day, and each block's weekly limit.
   * Works by day, not hour: a block fits a day if the day has a gap for it.
   */
  mostSessions(placements, want) {
    if (want <= 0) return 0;
    const used = new Set(placements.map(p => p.day));
    const days = DayOfWeek.values.filter(d => !used.has(d));
    const fits = new Map(this.blocks.map(b => [b,
      new Set(this.openStarts(b.durationHours, new Set()).map(s => s.day))]));
    const uses = new Map(this.blocks.map(b => [b, placements.filter(p => p.block === b).length]));
    const placed = placements.map(p => ({ day: p.day, block: p.block }));
    let best = 0;

    const search = (i, count) => {
      if (count > best) best = count;
      if (best >= want || i === days.length || count + days.length - i <= best) return;
      const day = days[i];
      for (const block of this.blocks) {
        if (uses.get(block) >= ESTIMATE.timesPerWeek || !fits.get(block).has(day)) continue;
        if (placed.some(p => recoveryClash(block, day, p.block, p.day))) continue;
        uses.set(block, uses.get(block) + 1); placed.push({ day, block });
        search(i + 1, count + 1);
        uses.set(block, uses.get(block) - 1); placed.pop();
        if (best >= want) return;
      }
      search(i + 1, count);            // or leave this day free
    };
    search(0, 0);
    return Math.min(best, want);
  }

  /** Every (day, start) where `hours` consecutive hours are free. */
  openStarts(hours, taken) {
    const out = [];
    const r = this.routine;
    for (const day of DayOfWeek.values) {
      if (r.offDays.has(day)) continue;       // the user can't train that day
      for (let start = r.firstHour; start + hours - 1 <= r.lastHour; start++) {
        let ok = true;
        for (let h = start; h < start + hours && ok; h++)
          ok = r.slot(day, h).isFree() && !taken.has(day + "-" + h);
        if (ok) out.push({ day, start });
      }
    }
    return out;
  }

  /** No muscle may be trained again before its recovery window has passed (see recoveryClash). */
  respectsRecovery(candidate, placements) {
    return !placements.some(p => recoveryClash(candidate.block, candidate.day, p.block, p.day));
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
      if (gap === 1) {
        score -= SCORE.nextDay;
        score -= SCORE.muscleNextDay * c.block.muscles.filter(m => other.trains(m)).length;
      }
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
