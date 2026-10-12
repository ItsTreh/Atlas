/* ===========================================================================
   Audit — does the finished week match what it set out to do?

   The planner works in stages (weekly target → distribution → sessions →
   exercises), and each stage can give a little less than the one before. This
   adds the stages back up, per muscle, so a shortfall always has a name:

     requestedSets     what the experience and priority ask for (weeklyTarget)
     targetSets        that, after fitting the time you have (fitToTime)
     plannedSets       what the distribution gave the days (all planned days):
                       the muscle's own sets, the credit its lead lifts were
                       expected to give it already taken off (volume.js)
     placedPlannedSets the part of it on days that found a place in the week
     ownSets           sets of exercises chosen for this muscle
     finalDirectSets   every set that trains it as a primary, including sets
                       that exercises chosen for another muscle give it
     finalIndirectSets sets where it only assists, not yet discounted
     finalIndirectCredit  those, at WORKOUT.secondaryCredit (a heuristic)
     finalTotalCredit  direct + indirect credit, the convention weeklyVolume()
                       and the dose use. Never shown as one undifferentiated number.
     filledSets        own sets the later passes added (fillToGoals, ensureDirectWork)
     deviation         finalTotalCredit − requestedSets; `status` is measured
                       against requestedSets, the goal the week fills toward

   `causes` lists, in sets, which rule took sets away on the way, so that a
   muscle under target never goes unexplained. Sets the stages cannot account
   for are reported as "unexplained" instead of hidden (a test keeps that at zero).

   Read-only: it never changes the plan.
   ========================================================================= */

const AUDIT_REASONS = Object.freeze({
  "time-fit":            "your sessions do not hold the full target",
  "fewer-sessions":      "recovery or your free hours allowed fewer training days than asked",
  "session-capacity":    "a training day could not hold more of it",
  "not-placed":          "its session found no day in your week",
  "session-time":        "the session ran out of time",
  "weekly-maximum":      "more would take it, or a muscle its lifts also train, past the weekly maximum",
  "session-set-limit":   "a session holds only a few sets of one muscle",
  "minimum-exercise":    "one leftover set is not worth an exercise",
  "no-eligible-exercise": "there is no other exercise for it that does not repeat a movement",
  "user-restriction":    "an exercise you can't do is excluded",
  "direct-work-floor":   "a set went to give another chosen muscle an exercise of its own",
  "recovery":            "another session loads it too soon for its recovery",
  "axial-load":          "the session already has its heavy spine-loading lifts",
  "goal-met":            "it already has what your experience and priority ask for",
  "unexplained":         "not explained by any rule"
});

const SHORT_TOLERANCE = VOLUME_TOLERANCE, OVER_TOLERANCE = 0.75;     // counted sets (volume.js)

/**
 * @returns { rows, issues, feasible } — see the header. `issues` are the
 * plan-level problems: sessions that did not fit, muscles under their usual
 * minimum, Focus muscles under target.
 */
function auditPlan(routine) {
  const planned = routine.planned;
  const muscles = routine.selectedMuscles().filter(m => exercisesFor(m.id).length > 0);
  const experience = routine.experience || DEFAULT_EXPERIENCE;
  const fit = routine.weekFit(experience);
  if (!planned || !fit || !routine.sessions.length) return { rows: [], issues: [], feasible: true };

  const auto = routine.split === "auto";
  const placed = new Set(routine.sessions.map(s => s.block));
  const sessionsOf = m => routine.sessions.filter(s => s.workout);
  const sum = (list, f) => list.reduce((t, x) => t + f(x), 0);
  const rows = muscles.map(m => {
    const priority = routine.selection.priority(m.id);
    const requested = weeklyTarget(m, experience, priority);
    const target = fit.targets.get(m.id) ?? requested;
    const all = sessionsOf(m);
    const own = sum(all, s => s.workout.entriesFor(m.id).reduce((t, e) => t + e.sets, 0));
    const direct = sum(all, s => s.workout.directSets(m.id));
    const indirectCredit = sum(all, s => s.workout.assistedSets(m.id));
    const indirect = indirectCredit / WORKOUT.secondaryCredit;
    const total = direct + indirectCredit;

    let plannedAll = null, placedPlanned = null;
    if (auto) {
      plannedAll = sum(planned.blocks, b => (b.plannedSets && b.plannedSets.get(m.id)) || 0);
      placedPlanned = sum(planned.blocks.filter(b => placed.has(b)), b => (b.plannedSets && b.plannedSets.get(m.id)) || 0);
    }

    // Where sets were lost, stage by stage.
    const causes = [];
    const add = (reason, sets) => {
      if (sets <= 0.0001) return;
      const found = causes.find(c => c.reason === reason);
      if (found) found.sets += sets; else causes.push({ reason, sets });
    };
    let unexplained = 0, rounding = 0, covered = 0;
    // What the later passes added (WorkoutBuilder.fillToGoals, ensureDirectWork).
    const gain = (planned.gains && planned.gains.get(m.id)) || { own: 0, counted: 0 };
    // The time fit lowered the target; whatever the fill pass gave back is not lost.
    add("time-fit", requested - target - gain.counted);
    if (auto) {
      // The days hold the muscle's own sets: its target less the credit the
      // week's lead lifts were expected to give it (volume.js, ownSets). That
      // credit is not a loss; only own sets the days could not hold are.
      const ownTarget = planned.own && planned.own.has(m.id) ? planned.own.get(m.id) : target;
      covered = Math.max(0, target - ownTarget);
      add(planned.blocks.length < planned.askedDays ? "fewer-sessions" : "session-capacity", ownTarget - plannedAll);
      add("not-placed", plannedAll - placedPlanned);
      const lost = (planned.events || []).filter(e => e.muscleId === m.id && e.reason !== "covered");
      for (const e of lost) add(e.reason, e.sets);
      const accounted = sum(lost, e => e.sets);
      const gap = placedPlanned - accounted - (own - gain.own);   // positive: sets nobody accounts for
      if (gap > 0.0001) { add("unexplained", gap); unexplained = gap; }
      else rounding = -gap;                             // negative: the builder gave a little more
    } else {
      for (const e of (planned.events || []).filter(e => e.muscleId === m.id && e.reason !== "covered")) add(e.reason, e.sets);
    }
    // Why the finished week stayed under the goal, when the fill pass could not close it.
    for (const f of (planned.shortfalls || []).filter(f => f.muscleId === m.id))
      if (!causes.some(c => c.reason === f.reason)) add(f.reason, f.sets);

    // Which parts of the muscle the final plan reaches (exercise-meta.js).
    const regions = regionCoverage(m, routine.sessions.filter(s => s.workout));

    // Measured against what experience and priority ask for (the goal the
    // week fills toward), not against the time-fitted estimate.
    const deviation = total - requested;
    const status = total + SHORT_TOLERANCE < requested ? "short" : total > requested + OVER_TOLERANCE ? "over" : "met";
    const directWork = all.some(s => s.workout.entries.some(e => e.exercise.trainsPrimarily(m.id)));
    return {
      muscle: m, priority,
      requestedSets: requested, targetSets: target, plannedSets: plannedAll, placedPlannedSets: placedPlanned,
      ownSets: own, coveredByOtherLifts: covered, finalDirectSets: direct, finalIndirectSets: indirect,
      finalIndirectCredit: indirectCredit, finalTotalCredit: total,
      creditFromOtherLifts: total - own, regions, deviation, status, causes, unexplained, rounding,
      filledSets: gain.own, filledCredit: gain.counted, directWork,
      belowMinimum: Math.round(total) < m.weeklySets[0]
    };
  });

  const issues = [];
  const asked = Math.min(routine.sessionsPerWeek, routine.availableDays().length);
  if (routine.sessions.length < asked)
    issues.push({ kind: "sessions", text: "Only " + routine.sessions.length + " of the " + asked +
      " sessions you asked for fit" + (planned.limit === "recovery" ? " once every muscle's recovery is respected." :
        planned.limit === "space" ? " in your free hours." : ".") });
  for (const r of rows) {
    if (r.priority === "focus" && r.status === "short")
      issues.push({ kind: "focus-short", muscleId: r.muscle.id, text: r.muscle.name + " is your Focus but gets " +
        fmtAuditSets(r.finalTotalCredit) + " of " + r.targetSets + " sets: " + auditCauseText(r) + "." });
    else if (r.belowMinimum)
      issues.push({ kind: "below-minimum", muscleId: r.muscle.id, text: r.muscle.name + " is under its usual minimum of " +
        r.muscle.weeklySets[0] + " sets (" + fmtAuditSets(r.finalTotalCredit) + "): " + auditCauseText(r) + "." });
    else if (!r.directWork)
      issues.push({ kind: "no-direct-work", muscleId: r.muscle.id, text: r.muscle.name +
        " has no exercise of its own this week, only credit from other lifts (" + fmtAuditSets(r.finalTotalCredit) +
        " sets): " + auditCauseText(r) + "." });
  }
  return { rows, issues, feasible: !issues.length };
}

/**
 * For a muscle with named parts: which parts have a lift that trains them
 * directly, which are only assisted, and which got nothing. A part is
 * "unreachable" when no catalogue exercise trains it directly, so a missing
 * part is not blamed on the plan. Returns null for muscles without parts.
 */
function regionCoverage(muscle, sessions) {
  const parts = MUSCLE_REGIONS[muscle.id];
  if (!parts) return null;
  const direct = new Set(), assisted = new Set();
  for (const s of sessions) for (const e of s.workout.entries) {
    const list = e.exercise.regionsFor(muscle.id);
    if (e.exercise.primary.includes(muscle.id)) list.forEach(r => direct.add(r));
    else if (e.exercise.secondary.includes(muscle.id)) list.forEach(r => assisted.add(r));
  }
  const reachable = r => EXERCISES.some(x => x.primary.includes(muscle.id) && x.regionsFor(muscle.id).includes(r));
  return {
    direct: parts.filter(r => direct.has(r)),
    assistedOnly: parts.filter(r => !direct.has(r) && assisted.has(r)),
    missing: parts.filter(r => !direct.has(r) && !assisted.has(r) && reachable(r)),
    unreachable: parts.filter(r => !reachable(r))
  };
}

const fmtAuditSets = n => String(Math.round(n * 10) / 10);

/** The reasons a muscle ended under its target, largest first, in words. */
function auditCauseText(row) {
  const list = [...row.causes].sort((a, b) => b.sets - a.sets);
  if (!list.length) return row.status === "short" ? AUDIT_REASONS.unexplained : "nothing was lost";
  return list.map(c => AUDIT_REASONS[c.reason] || c.reason).slice(0, 2).join("; ");
}
