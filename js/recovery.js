/* ===========================================================================
   Recovery between sessions — which muscles each session really loads.

   A session loads a muscle in one of two ways:

     direct    the muscle is trained on purpose, or an exercise in the session
               has it as a primary muscle (a squat for the glutes too)
     indirect  an exercise only assists it (a row assists the biceps and rear
               shoulders)

   The rule, in one place, so the calendar, the exercise choice and the
   explanations all say the same thing:

     • two sessions that both load a muscle directly need its full recovery
       days between them (Muscle.recoveryDays);
     • if either one loads it only indirectly, half of that, rounded up
       (WORKOUT.indirectRecoveryFraction).

   The half is a heuristic, not a finding: the research on recovery is thin
   (evidence.js, "recovery-between-sessions"), and it does not say how long a
   muscle that only assisted needs. It is kept as a single adjustable value.

   Before the exercises are chosen, the scheduler can only use the direct
   exposure it can predict (loadedMuscles in routine.js: the session's own
   muscles and the primary muscles of their best exercise). The exercise
   choice then avoids breaking the rule, and recoveryCheck() reports any
   exposure that still does, so the plan never claims more rest than it gives.
   ========================================================================= */

/** Days apart two sessions must be for a muscle, given how each loads it. */
function recoveryRequired(muscle, kindA, kindB) {
  if (kindA === "direct" && kindB === "direct") return muscle.recoveryDays;
  return Math.ceil(muscle.recoveryDays * WORKOUT.indirectRecoveryFraction);
}

/**
 * How `session` loads `muscleId`: "direct", "indirect" or null. A session
 * whose exercises are not chosen yet counts the muscles it was planned for.
 */
function exposureKind(session, muscleId) {
  const w = session.workout;
  if (w) return w.directSets(muscleId) > 0 ? "direct" : w.assistedSets(muscleId) > 0 ? "indirect" : null;
  return session.block.muscles.some(m => m.id === muscleId && !session.block.riders.has(m)) ? "direct" : null;
}

/** Every muscle each finished session loads: Map session id → Map muscle id → "direct" | "indirect". */
function sessionExposures(sessions) {
  const out = new Map();
  for (const s of sessions) {
    const map = new Map();
    for (const m of MUSCLES) {
      const kind = exposureKind(s, m.id);
      if (kind) map.set(m.id, kind);
    }
    out.set(s.id, map);
  }
  return out;
}

/**
 * Pairs of sessions that load a muscle closer together than the rule allows,
 * and the indirect loads that sit between direct ones (allowed, but worth
 * saying). Each: { muscle, a, b, kindA, kindB, gap, required }.
 */
function recoveryCheck(sessions) {
  const exposures = sessionExposures(sessions);
  const violations = [], allowed = [];
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i], b = sessions[j];
      const gap = DayOfWeek.distance(a.day, b.day);
      for (const m of MUSCLES) {
        const kindA = exposures.get(a.id).get(m.id), kindB = exposures.get(b.id).get(m.id);
        if (!kindA || !kindB) continue;
        const required = recoveryRequired(m, kindA, kindB);
        const row = { muscle: m, a, b, kindA, kindB, gap, required };
        if (gap < required) violations.push(row);
        else if (gap < m.recoveryDays) allowed.push(row);     // closer than full recovery, but one side only assists
      }
    }
  }
  return { violations, allowed };
}

/**
 * Whether choosing `exercise` for `targetId` in `session` would load a muscle
 * that another session loads too soon, by the rule above. Muscles the
 * session trains on purpose are not counted: the scheduler already spaced them.
 * Returns the first such muscle, or null.
 */
function recoveryConflict(exercise, session, otherSessions) {
  const own = new Set(session.block.muscles.filter(m => !session.block.riders.has(m)).map(m => m.id));
  for (const id of [...exercise.primary, ...exercise.secondary]) {
    if (own.has(id)) continue;
    const muscle = MUSCLE_BY_ID.get(id);
    const kind = exercise.primary.includes(id) ? "direct" : "indirect";
    for (const other of otherSessions) {
      if (other === session) continue;
      const there = exposureKind(other, id);
      if (!there) continue;
      if (DayOfWeek.distance(session.day, other.day) < recoveryRequired(muscle, kind, there)) return muscle;
    }
  }
  return null;
}
