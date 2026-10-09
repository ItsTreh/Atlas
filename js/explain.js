/* ===========================================================================
   Why the plan looks the way it does — one plain sentence per decision.

   Pure text from the routine's own numbers: nothing here decides anything,
   so a sentence can never disagree with the plan it describes. Where the
   evidence behind a rule is weak the wording says "usually" or "tends to"
   (see evidence.js for how sure each rule is), and numbers are estimates.
   The page shows these folded under the week and under each session
   (workout-view.js).
   ========================================================================= */

const EXPERIENCE_REASON = Object.freeze({
  beginner:     "You are starting out, so each muscle begins in the lower part of its weekly range and rises slowly.",
  intermediate: "With some experience, each muscle aims a little above the low end of its weekly range.",
  advanced:     "With a lot of experience, each muscle can go toward the upper part of its weekly range."
});

const setsText = n => (Math.round(n * 10) / 10) + (n === 1 ? " set" : " sets");
const listText = names => names.length < 2 ? names.join("")
  : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];

/** Sentences about the whole week, in the order a reader needs them. */
function weekReasons(routine) {
  const out = [];
  const fit = routine.weekFit();
  if (!fit) return ["Choose your experience to get weekly set targets for each muscle."];

  out.push(EXPERIENCE_REASON[routine.experience] || EXPERIENCE_REASON.beginner);

  const rows = routine.weeklyVolume().rows;
  const level = id => routine.selection.priority(id);
  const times = id => routine.sessions.filter(s =>
    s.block.muscles.some(m => m.id === id && !s.block.riders.has(m))).length;
  for (const r of rows.filter(r => level(r.muscle.id) === "focus" && r.times > 0).slice(0, 3)) {
    const [low, high] = r.muscle.weeklySets, n = times(r.muscle.id);
    out.push(r.muscle.name + ": " + setsText(r.sets) + " a week, near the top of its " + low + " to " + high +
      " range because it is your Focus" + (n > 1 ? ", spread over " + n + " sessions so each one stays shorter." : "."));
  }
  const keep = rows.filter(r => level(r.muscle.id) === "maintain").map(r => r.muscle.name);
  if (keep.length)
    out.push(listText(keep) + (keep.length === 1 ? " stays" : " stay") +
      " at the low end of the range: enough to keep what you have while the time goes to your Focus muscles.");

  if (!fit.meetsMinimums) {
    const low = fit.belowMinimum.map(id => MUSCLE_BY_ID.get(id).name);
    out.push("Not everything fits in " + routine.sessionsPerWeek + " sessions of " + routine.sessionMinutes +
      " min, so " + listText(low) + " get less than their usual minimum" +
      (fit.fixes.extraDay ? "; one more training day would fix it." : "; longer sessions or fewer muscles would fix it."));
  } else if (fit.trimmed.length) {
    out.push("Your targets needed more time than the week holds, so " +
      listText(fit.trimmed.map(id => MUSCLE_BY_ID.get(id).name)) + " were lowered, never below their minimum.");
  }

  out.push("Times are estimates: each set counts about " + ESTIMATE.minutesPerSet +
    " min including rest and setting up, plus " + ESTIMATE.warmupMinutes + " min of warm-up per session.");
  return out;
}

/** Sentences about one session: order, effort, volume and splitting. */
function sessionReasons(routine, session) {
  const out = [];
  const w = session.workout;
  if (!w || !w.entries.length) return out;
  const list = w.entries;

  if (list.length > 1) {
    const first = list[0], name = first.exercise.name;
    const muscle = MUSCLE_BY_ID.get(first.muscleId).name.toLowerCase();
    const helped = list.slice(1).filter(e => tires(first.exercise, e.exercise))
      .map(e => MUSCLE_BY_ID.get(e.muscleId).name.toLowerCase());
    if (helped.length)
      out.push(name + " goes first: it also works your " + listText([...new Set(helped)]) +
        " as a helper, so those get their own exercises after it instead of arriving tired.");
    else if (routine.selection.priority(first.muscleId) === "focus")
      out.push(name + " goes first because " + muscle + " is your Focus and you are freshest at the start.");
    else if (first.exercise.compound)
      out.push(name + " goes first: heavy multi-joint lifts are done while you are fresh, before the single-joint work.");
    else
      out.push(name + " goes first, then the rest in the order picked: none of them tires another's target muscle.");
  }

  // Why these exercises: the tier they hold, or that nothing rates them.
  const lead = list.find(e => !e.manual) || list[0];
  const mName = MUSCLE_BY_ID.get(lead.muscleId).name.toLowerCase();
  out.push(lead.tier
    ? lead.exercise.name + " is " + lead.tier + " tier for " + mName + " in " + RATING_ORIGIN.label +
      " (one coach's opinion), and each muscle gets its best-ranked exercises, one per movement."
    : "No tier list exists for " + mName + ", so " + lead.exercise.name +
      " is picked from the exercises that train it, without a ranking.");

  const kinds = new Set(list.map(e => e.exercise.compound ? "compound" : "isolation"));
  if (kinds.has("compound") && kinds.has("isolation"))
    out.push("Stop compound sets with " + LIFT_KINDS.compound.reserve + " reps in reserve and isolation sets with " +
      LIFT_KINDS.isolation.reserve + ": sets closer to failure tend to build more but take longer to recover from.");
  else {
    const k = LIFT_KINDS[[...kinds][0]];
    out.push("Stop sets with " + k.reserve + " reps in reserve: closer to failure tends to build more but takes longer to recover from.");
  }

  const rows = routine.weeklyVolume().rows;
  const parts = session.block.muscles.filter(m => !session.block.riders.has(m)).map(m => {
    const row = rows.find(r => r.muscle === m);
    const here = w.directSets(m.id);
    return here && row ? m.name + " " + setsText(here) + " of " + setsText(row.sets) : null;
  }).filter(Boolean);
  if (parts.length) out.push("Sets today out of the week's: " + parts.slice(0, 4).join("; ") +
    (parts.length > 4 ? "; and more." : "."));

  const split = session.block.muscles.filter(m => !session.block.riders.has(m) &&
    routine.sessions.filter(s => s.block.muscles.includes(m)).length > 1 && w.directSets(m.id));
  if (split.length)
    out.push(listText(split.map(m => m.name)) + (split.length === 1 ? " is" : " are") +
      " split across the week, with at most " + WORKOUT.maxSetsPerSession +
      " sets in a session: more than that tends to add fatigue faster than growth.");
  return out;
}
