/* ===========================================================================
   Distribution — how many times a week each muscle trains, and on which of
   the week's training days.

   It starts from the weekly set targets (estimate.js, fitToTime), which are
   counted sets (volume.js). The days hold each muscle's OWN sets: its target
   less the credit the selected muscles' lead lifts are expected to give it
   (ownSets). That credit is taken off once, here; the workout builder does
   not take it off again. Day lengths are those own sets at their lead lift's
   pace, the same parts the finished session is timed with.

   A fixed chain of rules, in this order. It is not an optimiser: nothing is
   scored or weighted, and the same inputs always give the same week.

     1. Frequency. A muscle trains as often as it takes to keep each session
        at or under WORKOUT.maxSetsPerSession counted sets, never more often
        than it has days, than its recovery allows (Muscle.recoveryDays) on
        the days the week has free, or than leaves each session one exercise
        of its own. The research does not show that any particular frequency
        is better when volume is equal (evidence.js, "frequency"); this is a
        way to spread the volume and the fatigue, not a finding.
     2. Spare days. If some training day has nothing on it, one more session
        is added to a muscle, Focus first, then Normal (the one with the
        fewest sessions, then the bigger target), and the days are placed
        again, while each session keeps four of its own sets or more.
        Maintain muscles never gain frequency. Days still empty at the end
        are rest days.
     3. Days. Muscles are placed one at a time, Focus first and biggest
        first, on the pattern of days that, in order of importance:
          a. does not load a muscle (its own or through another's lead lift)
             on more days than its recovery can space out,
          b. keeps the days within the session's working time,
          c. loads the muscle, and those its lead lift also trains, on the
             fewest days (glutes with the quads' squat),
          d. spaces the sessions out evenly through the week,
          e. goes with muscles of the same family already on those days,
          f. leaves the busiest day lightest,
          g. comes first in week order.
        Then muscles trained once a week move or swap between days while
        that puts co-loaded muscles together (regroup).
     4. Balance. While the heaviest day is more than BALANCE_SLACK sets
        heavier than the lightest, a muscle trained once a week moves (or
        swaps with a smaller one) from the one to the other if that lowers the
        heaviest day and does not split co-loaded muscles.
     5. A day under MIN_SESSION_SETS is folded into the others when every
        muscle on it fits elsewhere with FOLD_MARGIN of the session to spare,
        and only when the week had time to spare.
     6. A day still over what a session holds loses own sets, Normal muscles
        before Focus ones, never below the muscle's usual weekly minimum.
     7. A day nothing landed on is a rest day.

   The days here are positions in the week (0 = the first training day), not
   weekdays. The scheduler (scheduler.js) puts them on real days and keeps
   each muscle's recovery, so two positions next to each other here can still
   land a few days apart.
   ========================================================================= */

const FAMILY_ORDER = ["push", "pull", "legs", "core"];

/** A session of fewer sets than this is not worth a day (about 35 minutes with the warm-up). */
const MIN_SESSION_SETS = 6;
/* A tiny day is only folded into another that keeps this share of the
   session's working time free: the day lengths here are estimates made before
   the exercises are chosen, and a day folded right to the limit tends to end
   up a few sets short. */
const FOLD_MARGIN = 0.9;

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
function planDistribution(muscles, targets, priorities, days, sessionMinutes, timesCap = () => Infinity, { fold = true } = {}) {
  const level = m => priorities.get(m.id) || "normal";
  const rank = m => ({ focus: 0, normal: 1, maintain: 2 })[level(m)];
  const target = m => targets.get(m.id) || 0;
  const wanted = muscles.filter(m => target(m) > 0);
  const D = Math.max(1, days);
  const capMemo = new Map();
  const cap = m => {
    if (!capMemo.has(m.id)) capMemo.set(m.id, Math.max(1, Math.min(D, timesCap(m))));
    return capMemo.get(m.id);
  };

  // The days hold each muscle's OWN sets (volume.js, ownSets): its counted
  // target less the credit the week's lead lifts are expected to give it.
  // The credit is taken off here, once; the builder does not take it again.
  const counted = new Map(wanted.map(m => [m.id, target(m)]));
  const own = ownSets(counted);
  const ownOf = m => own.get(m.id) || 0;
  // How far a day may cut a muscle's own sets: as far as its target is above
  // its usual weekly minimum.
  const floor = new Map(wanted.map(m => [m.id,
    Math.max(WORKOUT.minDirectSets, ownOf(m) - Math.max(0, target(m) - m.weeklySets[0]))]));

  // 1. Frequency from the volume each session can hold (counted sets, the
  //    unit of the per-session cap), but never so often that a session would
  //    hold less than one exercise of its own.
  const frequency = new Map(wanted.map(m => [m.id,
    Math.min(cap(m), Math.max(1, Math.ceil(target(m) / WORKOUT.maxSetsPerSession)),
             Math.max(1, Math.floor(ownOf(m) / WORKOUT.minDirectSets)))]));

  // A muscle only gains a session while each session keeps at least two
  // exercises' worth of its own sets (twice WORKOUT.minDirectSets): a session
  // of one or two sets for a muscle is not worth a day.
  const canGrow = m => level(m) !== "maintain" && frequency.get(m.id) < cap(m) &&
    ownOf(m) / (frequency.get(m.id) + 1) >= 2 * WORKOUT.minDirectSets;

  // 2. Place the days; while one is empty, give a muscle one more session.
  for (;;) {
    const week = place(wanted, frequency, own, priorities, D, sessionMinutes, false, floor, cap);
    const pool = wanted.filter(canGrow);
    if (week.days.length >= D || !pool.length) {
      // Final pass: fold tiny sessions into the others (changes frequency).
      const final = new Map(frequency);
      const folded = place(wanted, final, own, priorities, D, sessionMinutes, fold, floor, cap);
      return { ...folded, frequency: final, own };
    }
    const chosen = [...pool].sort((a, b) =>
      rank(a) - rank(b) || frequency.get(a.id) - frequency.get(b.id) || target(b) - target(a))[0];
    frequency.set(chosen.id, frequency.get(chosen.id) + 1);
  }
}

const BALANCE_SLACK = 4;   // sets (about 17 min) of difference between days that are left alone
const daySets = d => [...d.sets.values()].reduce((t, n) => t + n, 0);
/** Working minutes of a planned day: its muscles' own sets at their lead lift's pace (volume.js). */
const setsMinutes = sets => { let t = 0; for (const [id, n] of sets) t += ownMinutes(id, n); return t; };
const dayMinutes = d => setsMinutes(d.sets);
/** The same, with `extra` (Map id -> sets) added to the day. */
function dayMinutesWith(d, extra) {
  let t = dayMinutes(d);
  for (const [id, n] of extra) t += ownMinutes(id, n);
  return t;
}

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
        // Never split muscles one lift loads together (glutes from the quads' squat).
        if (loadDaysAfterMove(day, heavy, light, m, n) > loadDays(day)) continue;
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
function consolidate(day, frequency, capacity) {
  for (let guard = 0; guard < 20; guard++) {
    const used = day.filter(d => d.muscles.length);
    if (used.length < 2) return;
    const tiny = used.filter(d => daySets(d) < MIN_SESSION_SETS)
                     .sort((a, b) => daySets(a) - daySets(b))[0];
    if (!tiny) return;
    const others = used.filter(d => d !== tiny);
    // What each other day would receive, so its minutes are judged with all of it.
    const plan = new Map(others.map(d => [d, new Map()]));
    const after = (d, id, s) => dayMinutesWith(d, new Map([...plan.get(d), [id, (plan.get(d).get(id) || 0) + s]]));
    const add = (d, id, s) => plan.get(d).set(id, (plan.get(d).get(id) || 0) + s);
    const moves = [];
    let ok = true;
    for (const m of tiny.muscles) {
      const s = tiny.sets.get(m.id);
      const sessions = others.filter(d => d.sets.has(m.id));
      if (frequency.get(m.id) === 1) {
        const room = others.filter(d => after(d, m.id, s) <= capacity * FOLD_MARGIN)
                           .sort((a, b) => dayMinutesWith(a, plan.get(a)) - dayMinutesWith(b, plan.get(b)));
        if (!room.length) { ok = false; break; }
        add(room[0], m.id, s); moves.push([m, room[0], s, false]);
      } else {
        const home = sessions.filter(d => d.sets.get(m.id) + s <= WORKOUT.maxSetsPerSession &&
                                          after(d, m.id, s) <= capacity * FOLD_MARGIN)
                             .sort((a, b) => dayMinutesWith(a, plan.get(a)) - dayMinutesWith(b, plan.get(b)))[0];
        if (!home) { ok = false; break; }
        add(home, m.id, s); moves.push([m, home, s, true]);
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
 * could not be moved) loses sets, one at a time: Normal muscles before Focus
 * ones (Maintain is at its minimum already), then the muscle with the most on
 * that day, and only sets that save time (one covered by another lift's
 * credit saves none). Never a muscle below its usual weekly minimum or
 * WORKOUT.minDirectSets in the day.
 */
function trimOverfullDays(day, frequency, capacity, priorities = new Map(), floor = new Map()) {
  const rank = m => ({ focus: 0, normal: 1, maintain: 2 })[priorities.get(m.id) || "normal"] ?? 1;
  const week = new Map();
  for (const d of day) for (const [id, n] of d.sets) week.set(id, (week.get(id) || 0) + n);
  for (const d of day) {
    while (dayMinutes(d) > capacity) {
      const m = d.muscles.filter(m => d.sets.get(m.id) > WORKOUT.minDirectSets &&
                                      week.get(m.id) > (floor.get(m.id) ?? m.weeklySets[0]))
        .sort((a, b) => rank(b) - rank(a) || d.sets.get(b.id) - d.sets.get(a.id) || a.id.localeCompare(b.id))[0];
      if (!m) break;
      d.sets.set(m.id, d.sets.get(m.id) - 1);
      week.set(m.id, week.get(m.id) - 1);
    }
  }
}

/**
 * Step 3b: put muscles one lift loads together on the same day. Placing one
 * muscle at a time can leave the glutes on two days of their own while the
 * quads' squat and the hamstrings' hinge load them on two more, which
 * recovery then cannot space out. While it lowers the number of days each
 * muscle is loaded (loadDays), a muscle trained once a week moves to another
 * day, or swaps with a muscle trained once a week there, as long as neither
 * day goes over the session's working time (or over what it had already).
 */
function regroup(day, frequency, capacity) {
  for (let guard = 0; guard < 60; guard++) {
    const now = loadDays(day);
    let best = null, bestKey = null;
    const once = d => d.muscles.filter(m => frequency.get(m.id) === 1);
    for (const a of day) for (const m of once(a)) for (const b of day) {
      if (b === a || b.muscles.includes(m)) continue;
      for (const n of [null, ...once(b)]) {
        if (n && a.muscles.includes(n)) continue;
        const cost = loadDaysAfterMove(day, a, b, m, n);
        if (cost >= now) continue;
        const sa = new Map(a.sets); sa.delete(m.id); if (n) sa.set(n.id, b.sets.get(n.id));
        const sb = new Map(b.sets); if (n) sb.delete(n.id); sb.set(m.id, a.sets.get(m.id));
        const ma = setsMinutes(sa), mb = setsMinutes(sb);
        const limitA = Math.max(capacity, dayMinutes(a)), limitB = Math.max(capacity, dayMinutes(b));
        if (ma > limitA + 1e-9 || mb > limitB + 1e-9) continue;
        const key = [cost, Math.round(Math.max(ma, mb)), n ? 1 : 0];
        if (!bestKey || compareKeys(key, bestKey) < 0) { best = { a, b, m, n, sa, sb }; bestKey = key; }
      }
    }
    if (!best) return;
    const { a, b, m, n, sa, sb } = best;
    a.muscles = a.muscles.filter(x => x !== m); if (n) a.muscles.push(n);
    b.muscles = b.muscles.filter(x => x !== n); b.muscles.push(m);
    a.sets = sa; b.sets = sb;
  }
}

/** How many (muscle, day) pairs the week loads directly, counting lead-lift co-loading. */
function loadDays(days) {
  let n = 0;
  for (const d of days) {
    const set = new Set();
    for (const m of d.muscles) { set.add(m.id); for (const id of leadPrimaries(m.id)) set.add(id); }
    n += set.size;
  }
  return n;
}
/** loadDays after moving `m` from `from` to `to` (and `n` back, when swapping). */
function loadDaysAfterMove(days, from, to, m, n) {
  const moved = days.map(d => {
    let muscles = d.muscles;
    if (d === from) muscles = [...muscles.filter(x => x !== m), ...(n ? [n] : [])];
    if (d === to) muscles = [...muscles.filter(x => x !== n), m];
    return { muscles };
  });
  return loadDays(moved);
}

/** The other muscles the lead lift of `muscleId` trains as primaries (volume.js, leadInfo). */
const leadPrimariesCache = new Map();
function leadPrimaries(muscleId) {
  if (!leadPrimariesCache.has(muscleId)) {
    const lead = leadInfo(muscleId).lead;
    leadPrimariesCache.set(muscleId, lead ? lead.primary.filter(id => id !== muscleId) : []);
  }
  return leadPrimariesCache.get(muscleId);
}

/** Step 3 of the rules: put each muscle's sessions on days. */
function place(wanted, frequency, targets, priorities, D, sessionMinutes, fold = false, floor = new Map(), cap = () => D) {
  const level = m => priorities.get(m.id) || "normal";
  const rank = m => ({ focus: 0, normal: 1, maintain: 2 })[level(m)];
  const target = m => targets.get(m.id) || 0;
  const capacity = Math.max(15, sessionMinutes - ESTIMATE.warmupMinutes);
  const family = Array.from({ length: D }, () => new Map());   // sets by family on each day
  const day = Array.from({ length: D }, () => ({ muscles: [], sets: new Map() }));
  const order = [...wanted].sort((a, b) =>
    rank(a) - rank(b) || target(b) - target(a) ||
    FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family) || a.id.localeCompare(b.id));

  // Muscles each day loads directly: its own, plus the other primaries of
  // their lead lifts (a quads day's squat loads the glutes). Recovery is
  // judged on these (routine.js, loadedMuscles), so a muscle whose lift
  // loads others goes where those are already loaded: glutes with the
  // quads and hamstrings, not on a fourth day of their own.
  const loaded = Array.from({ length: D }, () => new Set());
  const coLoaded = m => new Set([m.id, ...leadPrimaries(m.id)]);

  for (const m of order) {
    const times = frequency.get(m.id);
    const sets = splitSets(target(m), times);
    const touches = coLoaded(m);
    let best = null, bestKey = null;
    for (const pattern of dayPatterns(D, times, 1)) {
      let over = 0, together = 0, heaviest = 0, loadDays = 0, tooOften = 0;
      for (const id of touches) {
        let n = 0;
        for (let d = 0; d < D; d++) if (pattern.includes(d) || loaded[d].has(id)) n++;
        loadDays += n;
        // Loaded on more days than its recovery can space out: the scheduler
        // would have to drop a session.
        tooOften += Math.max(0, n - cap(MUSCLE_BY_ID.get(id)));
      }
      pattern.forEach((d, i) => {
        const after = dayMinutesWith(day[d], new Map([[m.id, sets[i]]]));
        over += Math.max(0, after - capacity);
        together += family[d].get(m.family) || 0;
        heaviest = Math.max(heaviest, after);
      });
      const ideal = D / times;
      let spacing = 0;
      for (let i = 1; i < pattern.length; i++) spacing += Math.abs(pattern[i] - pattern[i - 1] - ideal);
      const key = [tooOften, Math.round(over), loadDays, Math.round(spacing * 100), -together, Math.round(heaviest)];
      if (!bestKey || compareKeys(key, bestKey) < 0) { best = pattern; bestKey = key; }
    }
    best.forEach((d, i) => {
      for (const id of touches) loaded[d].add(id);
      family[d].set(m.family, (family[d].get(m.family) || 0) + sets[i]);
      day[d].muscles.push(m);
      day[d].sets.set(m.id, sets[i]);
    });
  }

  regroup(day, frequency, capacity);
  balance(day, frequency);
  if (fold) consolidate(day, frequency, capacity);
  trimOverfullDays(day, frequency, capacity, priorities, floor);

  // Days nothing landed on are rest days. Biggest muscles first inside a day.
  const used = day.filter(d => d.muscles.length);
  for (const d of used) d.muscles.sort((a, b) => b.minutes - a.minutes);
  return { days: used };
}
