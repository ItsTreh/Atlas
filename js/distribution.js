/* ===========================================================================
   Distribution — how many times a week each muscle trains, and on which of
   the week's training days.

   It starts from the weekly set targets (estimate.js, fitToTime) and applies
   a fixed chain of rules, in this order. It is not an optimiser: nothing is
   scored or weighted, and the same inputs always give the same week.

     1. Frequency. A muscle trains as often as it takes to keep each session
        at or under WORKOUT.maxSetsPerSession sets, never more often than it
        has days, and never more often than its recovery allows
        (Muscle.recoveryDays) on the days the week has free. The research
        does not show that any particular frequency is better when volume is
        equal (evidence.js, "frequency"); this is a way to spread the volume,
        not a finding.
     2. Spare days. If some training day has nothing on it, one more session
        is added to a muscle, Focus first, then Normal (the one with the
        fewest sessions, then the bigger target), and the days are placed
        again, while each session keeps a worthwhile number of sets.
        Maintain muscles never gain frequency. Days still empty at the end
        are rest days.
     3. Days. Muscles are placed one at a time, Focus first and biggest
        first, on the pattern of days that, in order of importance:
          a. keeps the days within the session's working time,
          b. spaces the sessions out evenly through the week,
          c. goes with muscles of the same family already on those days,
          d. leaves the busiest day lightest,
          e. comes first in week order.

   The days here are positions in the week (0 = the first training day), not
   weekdays. The scheduler (scheduler.js) puts them on real days and keeps
   each muscle's recovery, so two positions next to each other here can still
   land a few days apart.
   ========================================================================= */

const FAMILY_ORDER = ["push", "pull", "legs", "core"];

/**
 * The most training days of the week `free` (weekday ids, in week order) a
 * muscle can have and still get `gap` days between them, the short way round.
 */
function maxSpread(free, gap) {
  let best = 0;
  for (let from = 0; from < free.length; from++) {
    const chosen = [];
    for (let i = 0; i < free.length; i++) {
      const day = free[(from + i) % free.length];
      if (chosen.every(c => DayOfWeek.distance(c, day) >= gap)) chosen.push(day);
    }
    best = Math.max(best, chosen.length);
  }
  return best;
}

/** Every way to pick `count` of the days 0..days-1, at least `gap` apart, in week order. */
function dayPatterns(days, count, gap) {
  const out = [];
  const walk = (from, chosen) => {
    if (chosen.length === count) { out.push(chosen); return; }
    for (let d = from; d < days; d++) walk(d + gap, [...chosen, d]);
  };
  walk(0, []);
  return out;
}

/** A target split over `times` sessions as evenly as whole sets allow, bigger ones first. */
function splitSets(target, times) {
  const base = Math.floor(target / times);
  const extra = target % times;
  return Array.from({ length: times }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * @param muscles     Muscle objects with exercises to train
 * @param targets     Map muscle id -> weekly sets (after fitToTime)
 * @param priorities  Map muscle id -> "maintain" | "normal" | "focus"
 * @param days        how many training days the week has
 * @param sessionMinutes  the planned session length
 * @param timesCap    function(muscle) -> the most sessions a week its recovery
 *                    allows on the free days (see maxSpread); defaults to `days`
 * @returns { days: [{ muscles: Muscle[], sets: Map id -> sets }], frequency: Map id -> times }
 */
function planDistribution(muscles, targets, priorities, days, sessionMinutes, timesCap = () => Infinity) {
  const level = m => priorities.get(m.id) || "normal";
  const rank = m => ({ focus: 0, normal: 1, maintain: 2 })[level(m)];
  const target = m => targets.get(m.id) || 0;
  const wanted = muscles.filter(m => target(m) > 0);
  const D = Math.max(1, days);
  const cap = m => Math.max(1, Math.min(D, timesCap(m)));

  // 1. Frequency from the volume each session can hold.
  const frequency = new Map(wanted.map(m => [m.id,
    Math.min(cap(m), Math.max(1, Math.ceil(target(m) / WORKOUT.maxSetsPerSession)))]));

  // A muscle only gains a session while each session keeps at least two
  // exercises' worth of direct sets (twice WORKOUT.minDirectSets): a session
  // of one or two sets for a muscle is not worth a day.
  const canGrow = m => level(m) !== "maintain" && frequency.get(m.id) < cap(m) &&
    target(m) / (frequency.get(m.id) + 1) >= 2 * WORKOUT.minDirectSets;

  // 2. Place the days; while one is empty, give a muscle one more session.
  for (;;) {
    const week = place(wanted, frequency, targets, priorities, D, sessionMinutes);
    const pool = wanted.filter(canGrow);
    if (week.days.length >= D || !pool.length) return { ...week, frequency };
    const chosen = [...pool].sort((a, b) =>
      rank(a) - rank(b) || frequency.get(a.id) - frequency.get(b.id) || target(b) - target(a))[0];
    frequency.set(chosen.id, frequency.get(chosen.id) + 1);
  }
}

/** Step 3 of the rules: put each muscle's sessions on days. */
function place(wanted, frequency, targets, priorities, D, sessionMinutes) {
  const level = m => priorities.get(m.id) || "normal";
  const rank = m => ({ focus: 0, normal: 1, maintain: 2 })[level(m)];
  const target = m => targets.get(m.id) || 0;
  const capacity = Math.max(15, sessionMinutes - ESTIMATE.warmupMinutes);
  const load = Array(D).fill(0);                        // working minutes on each day
  const family = Array.from({ length: D }, () => new Map());   // sets by family on each day
  const day = Array.from({ length: D }, () => ({ muscles: [], sets: new Map() }));
  const order = [...wanted].sort((a, b) =>
    rank(a) - rank(b) || target(b) - target(a) ||
    FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family) || a.id.localeCompare(b.id));

  for (const m of order) {
    const times = frequency.get(m.id);
    const sets = splitSets(target(m), times);
    let best = null, bestKey = null;
    for (const pattern of dayPatterns(D, times, 1)) {
      let over = 0, together = 0, heaviest = 0;
      pattern.forEach((d, i) => {
        const after = load[d] + sets[i] * ESTIMATE.minutesPerSet;
        over += Math.max(0, after - capacity);
        together += family[d].get(m.family) || 0;
        heaviest = Math.max(heaviest, after);
      });
      const ideal = D / times;
      let spacing = 0;
      for (let i = 1; i < pattern.length; i++) spacing += Math.abs(pattern[i] - pattern[i - 1] - ideal);
      const key = [Math.round(over), Math.round(spacing * 100), -together, Math.round(heaviest)];
      if (!bestKey || compareKeys(key, bestKey) < 0) { best = pattern; bestKey = key; }
    }
    best.forEach((d, i) => {
      load[d] += sets[i] * ESTIMATE.minutesPerSet;
      family[d].set(m.family, (family[d].get(m.family) || 0) + sets[i]);
      day[d].muscles.push(m);
      day[d].sets.set(m.id, sets[i]);
    });
  }

  // Days nothing landed on are rest days. Biggest muscles first inside a day.
  const used = day.filter(d => d.muscles.length);
  for (const d of used) d.muscles.sort((a, b) => b.minutes - a.minutes);
  return { days: used };
}
