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
     4. Balance. While the heaviest day is heavier than the lightest, a muscle
        trained once a week moves from the one to the other if that lowers the
        heaviest day.
     5. A day still over what a session holds loses sets, from the muscle with
        the most on it, never below that muscle's usual weekly minimum.
     6. A day nothing landed on is a rest day.

   The days here are positions in the week (0 = the first training day), not
   weekdays. The scheduler (scheduler.js) puts them on real days and keeps
   each muscle's recovery, so two positions next to each other here can still
   land a few days apart.
   ========================================================================= */

const FAMILY_ORDER = ["push", "pull", "legs", "core"];

/** A session of fewer sets than this is not worth a day (about 35 minutes with the warm-up). */
const MIN_SESSION_SETS = 6;

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
    if (week.days.length >= D || !pool.length) {
      // Final pass: fold tiny sessions into the others (changes frequency).
      const final = new Map(frequency);
      const folded = place(wanted, final, targets, priorities, D, sessionMinutes, true);
      return { ...folded, frequency: final };
    }
    const chosen = [...pool].sort((a, b) =>
      rank(a) - rank(b) || frequency.get(a.id) - frequency.get(b.id) || target(b) - target(a))[0];
    frequency.set(chosen.id, frequency.get(chosen.id) + 1);
  }
}

const BALANCE_SLACK = 4;   // sets (about 17 min) of difference between days that are left alone
const daySets = d => [...d.sets.values()].reduce((t, n) => t + n, 0);

/**
 * Step 4: even the days out. While the heaviest day is heavier than the
 * lightest, move one muscle that trains only once a week from the heaviest to
 * the lightest day, if that lowers the heaviest day: the muscle that leaves
 * the day lightest after the move, preferring a family already on the light
 * day, then the smaller one. A muscle trained several times stays where its
 * spacing put it. Nothing moves if no move helps, so a lone day is never
 * emptied for nothing.
 */
function balance(day, frequency) {
  for (let guard = 0; guard < 100; guard++) {
    const used = day.filter(d => d.muscles.length);
    if (used.length < 2) return;
    const sorted = [...used].sort((a, b) => daySets(b) - daySets(a));
    const heavy = sorted[0], light = sorted[sorted.length - 1];
    // A gap of a few sets is not worth splitting a family for.
    if (daySets(heavy) - daySets(light) <= BALANCE_SLACK) return;
    const once = d => d.muscles.filter(m => frequency.get(m.id) === 1);
    let best = null, bestKey = null;
    // Move one muscle across, or swap a bigger one for a smaller one.
    for (const m of once(heavy)) {
      const s = heavy.sets.get(m.id);
      for (const n of [null, ...once(light)]) {
        const t = n ? light.sets.get(n.id) : 0;
        if (n && t >= s) continue;
        const after = Math.max(daySets(heavy) - s + t, daySets(light) + s - t);
        if (after >= daySets(heavy)) continue;
        const kin = light.muscles.some(x => x.family === m.family) ? 0 : 1;
        const key = [after, n ? 1 : 0, kin, s];
        if (!bestKey || compareKeys(key, bestKey) < 0) { best = { m, n }; bestKey = key; }
      }
    }
    if (!best) return;
    const { m, n } = best;
    const s = heavy.sets.get(m.id);
    heavy.muscles = heavy.muscles.filter(x => x !== m); heavy.sets.delete(m.id);
    light.muscles.push(m); light.sets.set(m.id, s);
    if (n) {
      const t = light.sets.get(n.id);
      light.muscles = light.muscles.filter(x => x !== n); light.sets.delete(n.id);
      heavy.muscles.push(n); heavy.sets.set(n.id, t);
    }
  }
}

/**
 * Step 6: a day with fewer than MIN_SESSION_SETS sets is folded into the
 * others when every muscle on it can go: one that trains once joins the
 * lightest other day that has room; one that trains several times gives its
 * sets to its other sessions, losing a session, if they stay within
 * WORKOUT.maxSetsPerSession and the day's room. If any muscle cannot be
 * placed the day stays as it is. Repeats until no day can be folded.
 */
function consolidate(day, frequency, capacitySets) {
  for (let guard = 0; guard < 20; guard++) {
    const used = day.filter(d => d.muscles.length);
    if (used.length < 2) return;
    const tiny = used.filter(d => daySets(d) < MIN_SESSION_SETS)
                     .sort((a, b) => daySets(a) - daySets(b))[0];
    if (!tiny) return;
    const others = used.filter(d => d !== tiny);
    const plan = new Map(others.map(d => [d, daySets(d)]));
    const moves = [];
    let ok = true;
    for (const m of tiny.muscles) {
      const s = tiny.sets.get(m.id);
      const sessions = others.filter(d => d.sets.has(m.id));
      if (frequency.get(m.id) === 1) {
        const room = others.filter(d => plan.get(d) + s <= capacitySets)
                           .sort((a, b) => plan.get(a) - plan.get(b));
        if (!room.length) { ok = false; break; }
        plan.set(room[0], plan.get(room[0]) + s); moves.push([m, room[0], s, false]);
      } else {
        const home = sessions.filter(d => d.sets.get(m.id) + s <= WORKOUT.maxSetsPerSession &&
                                          plan.get(d) + s <= capacitySets)
                             .sort((a, b) => plan.get(a) - plan.get(b))[0];
        if (!home) { ok = false; break; }
        plan.set(home, plan.get(home) + s); moves.push([m, home, s, true]);
      }
    }
    if (!ok) return;
    for (const [m, home, s, merge] of moves) {
      home.sets.set(m.id, (home.sets.get(m.id) || 0) + s);
      if (!home.muscles.includes(m)) home.muscles.push(m);
      if (merge) frequency.set(m.id, frequency.get(m.id) - 1);
    }
    tiny.muscles = []; tiny.sets = new Map();
    balance(day, frequency);
  }
}

/**
 * Step 5: a day that still holds more than a session can take (its muscles
 * could not be moved) loses sets, one at a time from the muscle with the
 * most on that day, never taking a muscle below its usual weekly minimum or
 * WORKOUT.minDirectSets in the day.
 */
function trimOverfullDays(day, frequency, capacity) {
  const week = new Map();
  for (const d of day) for (const [id, n] of d.sets) week.set(id, (week.get(id) || 0) + n);
  for (const d of day) {
    while (daySets(d) * ESTIMATE.minutesPerSet > capacity) {
      const candidates = d.muscles.filter(m =>
        d.sets.get(m.id) > WORKOUT.minDirectSets && week.get(m.id) > m.weeklySets[0]);
      if (!candidates.length) break;
      const m = candidates.reduce((a, b) => d.sets.get(b.id) > d.sets.get(a.id) ? b : a);
      d.sets.set(m.id, d.sets.get(m.id) - 1);
      week.set(m.id, week.get(m.id) - 1);
    }
  }
}

/** Step 3 of the rules: put each muscle's sessions on days. */
function place(wanted, frequency, targets, priorities, D, sessionMinutes, fold = false) {
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

  balance(day, frequency);
  if (fold) consolidate(day, frequency, Math.floor(capacity / ESTIMATE.minutesPerSet));
  trimOverfullDays(day, frequency, capacity);

  // Days nothing landed on are rest days. Biggest muscles first inside a day.
  const used = day.filter(d => d.muscles.length);
  for (const d of used) d.muscles.sort((a, b) => b.minutes - a.minutes);
  return { days: used };
}
