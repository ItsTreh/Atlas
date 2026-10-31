/* ===========================================================================
   Set credit — how much one set of an exercise counts for each muscle.

   Data only, no page code. A row names the catalogue exercises that were
   measured (exercises.js) and one muscle: its credit on ATLAS's scale
   (CREDIT_STEPS), the evidence tier behind it (docs/training-evidence.md,
   "How to read this file") and how it was worked out. The basis is that
   file's "Set-credit table"; so far only its rows backed by measured growth
   are here. A row applies to the exercise that was measured: a variant nobody
   measured keeps the flat default, even when it shares the movement (the
   user's rule, 2026-10-30). The flat default is 1 for a primary muscle,
   PLANNER_CONFIG.secondaryCredit for an assisting one. What is held at the
   default for want of evidence is listed under "Evidence wanted" in that file.

   A credit of 0 is one of two things, and the row says which (`zero`):
     measured     growth was measured and the muscle did not change
     unassigned   the growth was measured in a part of a muscle that the
                  app's groups don't hold separately yet. It is kept at that
                  part (a `region` row, an anatomy-regions.js id), and no group
                  gets it. This means too little evidence for the current
                  group mapping, not zero activation or growth. No row uses it
                  now (squat → Adductors takes the flat default, the user's
                  call, 2026-10-30); the check stays for a real case.

   Not read by the planner yet: Workout still counts the flat default.
   ========================================================================= */

const CREDIT_STEPS = Object.freeze([1, 0.5, 0.25, 0]);
/* B: measured growth. B+D: measured, with ATLAS's own choice on the value. */
const CREDIT_TIERS = Object.freeze(["B", "B+D"]);
const ZERO_KINDS = Object.freeze(["measured", "unassigned"]);

const SET_CREDIT = Object.freeze([
  // pressing
  { exercises: ["Bench Press"], muscle: "triceps", credit: 0.5, tier: "B",
    basedOn: ["press-triceps-growth"],
    how: "Barbell bench pressing grew the triceps 0.51 to 0.57 as much as direct work; " +
         "rounded to 0.5.",
    regions: "The long head barely grows from pressing: it needs overhead or extension work." },

  // pulling
  { exercises: ["1-Arm Dumbbell Row"], muscle: "biceps", credit: 0.5, tier: "B",
    basedOn: ["pull-biceps-growth"],
    how: "One-arm dumbbell rows grew the elbow flexors 0.47 as much as curls; rounded to 0.5." },
  { exercises: ["Wide-Grip Lat Pulldown"], muscle: "biceps", credit: 0.5, tier: "B+D",
    basedOn: ["pull-biceps-growth"],
    how: "Wide-grip pulldowns grew the elbow flexors about as much as curls, but rows gave " +
         "0.47 in another trial; held at the lower end until the trials agree, ATLAS's choice." },

  // squats
  { exercises: ["Barbell Back Squat"], muscle: "quads", credit: 1, tier: "B",
    basedOn: ["squat-regional-growth"],
    how: "The quads grew 4.9% from deep barbell back squats.",
    regions: "The rectus femoris needs knee extensions." },
  { exercises: ["Barbell Back Squat"], muscle: "glutes", credit: 1, tier: "B",
    basedOn: ["squat-regional-growth", "squat-vs-hip-thrust"],
    how: "The glutes grew 1.37 times as much as the quads from deep back squats, and about " +
         "as much as from hip thrusts." },
  { exercises: ["Barbell Back Squat"], muscle: "hamstrings", credit: 0, zero: "measured", tier: "B",
    basedOn: ["squat-regional-growth", "squat-vs-hip-thrust"],
    how: "No hamstring muscle grew from deep back squats." },
  { exercises: ["Barbell Back Squat"], region: "adductor-magnus", estimate: 1, tier: "B",
    basedOn: ["squat-regional-growth"],
    how: "The adductors were measured together, the adductor magnus among them, and grew " +
         "1.27 times as much as the quads. The magnus selects Hamstrings, so this is kept " +
         "at the magnus and credited to no group until the app holds sub-regions; Adductors " +
         "keeps the flat default (the user's decisions, 2026-10-29 and 2026-10-30)." },

  // hips
  { exercises: ["45-Degree Back Extension"], muscle: "hamstrings", credit: 0.5, tier: "B+D",
    basedOn: ["hip-extension-hamstrings"],
    how: "A 45-degree hip extension grew the biceps femoris long head more than Nordic " +
         "curls, in one trial read in abstract only; held at the flat 0.5 until it is read " +
         "in full and replicated (the user's call, 2026-10-30)." },

  // single joint
  { exercises: ["Leg Extension"], muscle: "quads", credit: 1, tier: "B",
    basedOn: ["leg-press-regional-growth"],
    how: "Machine knee extensions grew the rectus femoris 13.2%." },
  { exercises: ["Seated Leg Curl", "Lying Leg Curl"], muscle: "hamstrings", credit: 1, tier: "B",
    basedOn: ["leg-curl-hamstrings"],
    how: "Seated and lying leg curls both grew the hamstrings (14% and 9%). Seated grows " +
         "them more: a note on the exercise, not extra credit." },
  { exercises: ["Standing Calf Raise"], muscle: "calves", credit: 1, tier: "B",
    basedOn: ["calf-raise-knee-angle"],
    how: "The gastrocnemius grew 9 to 12% on a standing calf raise machine." },
  { exercises: ["Seated Calf Raise"], muscle: "calves", credit: 0.25, tier: "B+D",
    basedOn: ["calf-raise-knee-angle"],
    how: "The whole calf grew 2.1% seated against 5.6% standing (0.375): the gastrocnemius " +
         "barely grew, the soleus as much as standing (2.9% against 2.1%). Rounded down to " +
         "0.25, a conservative ATLAS choice, not a measured ratio for the app's Calves " +
         "(the gastrocnemius and upper soleus; the user's call, 2026-10-30)." }
]);

const SET_CREDIT_INDEX = new Map();      // "exercise name|muscle" → row

/**
 * What one set of `exercise` counts for `muscleId`: { credit, tier, how, row }.
 * A row in SET_CREDIT wins; otherwise the flat default, with no tier: 1 for a
 * primary muscle, secondaryCredit for an assisting one, 0 for any other.
 */
function setCredit(exercise, muscleId) {
  const row = SET_CREDIT_INDEX.get(exercise.name + "|" + muscleId);
  if (row) return { credit: row.credit, tier: row.tier, how: row.how, row };
  if (exercise.trainsPrimarily(muscleId))
    return { credit: 1, tier: null, how: "Flat default for the muscle it mainly trains.", row: null };
  if (exercise.assists(muscleId))
    return { credit: configValue("secondaryCredit"), tier: null,
             how: "Flat default for an assisting muscle, not yet reviewed.", row: null };
  return { credit: 0, tier: null, how: "", row: null };
}

/* ============================== validation =============================== */

(function checkSetCredit() {
  const problem = msg => console.error("Set credit data: " + msg);
  for (const row of SET_CREDIT) {
    const name = row.exercises.join("/") + " → " + (row.muscle || row.region);
    if (!row.muscle === !row.region) problem(name + " needs a muscle or a region, not both");
    if (!CREDIT_TIERS.includes(row.tier)) problem(name + " has unknown tier " + row.tier);
    if (!row.basedOn.length) problem(name + " cites no evidence");
    for (const id of row.basedOn)
      if (!EVIDENCE_BY_ID.has(id)) problem(name + " is based on unknown evidence " + id);
    for (const n of row.exercises)
      if (!EXERCISE_BY_NAME.has(n)) problem(name + ": no exercise is called \"" + n + "\"");
    if (row.region) {
      if (!CREDIT_STEPS.includes(row.estimate) || !row.estimate) problem(name + " has estimate " + row.estimate);
      continue;
    }
    if (!MUSCLE_BY_ID.has(row.muscle)) problem(name + " has unknown muscle " + row.muscle);
    if (!CREDIT_STEPS.includes(row.credit)) problem(name + " has credit " + row.credit + ", off the scale");
    if (row.credit === 0 && !ZERO_KINDS.includes(row.zero)) problem(name + " is 0 without saying why");
    if (row.credit !== 0 && row.zero) problem(name + " says why it is 0, but is " + row.credit);
    if (row.zero === "unassigned" &&
        !SET_CREDIT.some(r => r.region && row.exercises.every(n => r.exercises.includes(n))))
      problem(name + " is unassigned, but no region row keeps its stimulus");
    for (const n of row.exercises) {
      const key = n + "|" + row.muscle;
      if (SET_CREDIT_INDEX.has(key)) problem(name + " is credited twice for " + n);
      SET_CREDIT_INDEX.set(key, row);
      // a credit the catalogue doesn't list would be counted for nothing the planner chose it for
      const ex = EXERCISE_BY_NAME.get(n);
      if (ex && row.credit > 0 && !ex.trainsPrimarily(row.muscle) && !ex.assists(row.muscle))
        problem(name + ": \"" + n + "\" does not list " + row.muscle);
    }
  }
})();
