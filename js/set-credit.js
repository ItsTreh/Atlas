/* ===========================================================================
   Set credit — how much one set of an exercise counts for each muscle.

   Data only, no page code. A row covers one or more movements (exercises.js,
   MOVEMENTS) and one muscle: its credit on ATLAS's scale (CREDIT_STEPS), the
   evidence tier behind it (docs/training-evidence.md, "How to read this
   file") and how it was worked out. The basis is that file's "Set-credit
   table"; so far only its rows backed by measured growth are here. A pair
   with no row keeps the flat default: 1 for a primary muscle,
   PLANNER_CONFIG.secondaryCredit for an assisting one.

   A credit of 0 is one of two things, and the row says which (`zero`):
     measured     growth was measured and the muscle did not change
     unassigned   the growth was measured in a part of a muscle that the
                  app's groups don't hold separately yet. It is kept at that
                  part (a `region` row, an anatomy-regions.js id), and no group
                  gets it. This means too little evidence for the current
                  group mapping, not zero activation or growth.

   Not read by the planner yet: Workout still counts the flat default.
   ========================================================================= */

const CREDIT_STEPS = Object.freeze([1, 0.5, 0.25, 0]);
/* B: measured growth. B+D: measured, with ATLAS's own choice on the value. */
const CREDIT_TIERS = Object.freeze(["B", "B+D"]);
const ZERO_KINDS = Object.freeze(["measured", "unassigned"]);

const SET_CREDIT = Object.freeze([
  // pressing
  { movements: ["flat-press", "incline-press"], muscle: "triceps", credit: 0.5, tier: "B",
    basedOn: ["press-triceps-growth"],
    how: "Bench pressing grew the triceps 0.51 to 0.57 as much as direct work; rounded " +
         "to 0.5. Measured on the bench press; incline presses share the row.",
    regions: "The long head barely grows from pressing: it needs overhead or extension work." },

  // pulling
  { movements: ["row", "vertical-pull"], muscle: "biceps", credit: 0.5, tier: "B",
    basedOn: ["pull-biceps-growth"],
    how: "Rows gave 0.47 of curls' growth, pulldowns about 1; the trials disagree, so the " +
         "lower end." },

  // squats
  { movements: ["squat"], muscle: "quads", credit: 1, tier: "B",
    basedOn: ["squat-regional-growth"],
    how: "The quads grew 4.9% from deep squats.",
    regions: "The rectus femoris needs knee extensions." },
  { movements: ["squat"], muscle: "glutes", credit: 1, tier: "B",
    basedOn: ["squat-regional-growth", "squat-vs-hip-thrust"],
    how: "The glutes grew 1.37 times as much as the quads from deep squats, and about as " +
         "much as from hip thrusts. Measured on barbell back squats; the other squats " +
         "share the row." },
  { movements: ["squat"], muscle: "hamstrings", credit: 0, zero: "measured", tier: "B",
    basedOn: ["squat-regional-growth", "squat-vs-hip-thrust"],
    how: "No hamstring muscle grew from deep squats." },
  { movements: ["squat"], muscle: "adductors", credit: 0, zero: "unassigned", tier: "B",
    basedOn: ["squat-regional-growth"],
    how: "The adductors were measured together, the adductor magnus among them, and the " +
         "magnus selects Hamstrings. Kept at the magnus until the app holds sub-regions " +
         "(the user's decision, 2026-10-29)." },
  { movements: ["squat"], region: "adductor-magnus", estimate: 1, tier: "B",
    basedOn: ["squat-regional-growth"],
    how: "The adductors grew 1.27 times as much as the quads. Credited to no group." },

  // leg press
  { movements: ["leg-press"], muscle: "glutes", credit: 0.5, tier: "B+D",
    basedOn: ["leg-press-regional-growth"],
    how: "The glutes grew 3.1 times as much as the quads, in a single trial; held at 0.5 " +
         "until it is replicated, ATLAS's choice." },
  { movements: ["leg-press"], region: "adductor-magnus", estimate: 0.5, tier: "B+D",
    basedOn: ["leg-press-regional-growth"],
    how: "The adductor magnus itself grew 1.27 times as much as the quads, in a single " +
         "trial; held at 0.5 until it is replicated. Credited to no group." },

  // hips
  { movements: ["hip-thrust"], muscle: "glutes", credit: 1, tier: "B",
    basedOn: ["squat-vs-hip-thrust"],
    how: "Hip thrusts grew the glutes about as much as squats." },
  { movements: ["hip-thrust"], muscle: "hamstrings", credit: 0, zero: "measured", tier: "B",
    basedOn: ["squat-vs-hip-thrust"],
    how: "Hamstring growth from hip thrusts was negligible." },
  { movements: ["hinge"], muscle: "hamstrings", credit: 1, tier: "B",
    basedOn: ["hip-extension-hamstrings"],
    how: "A hip extension exercise grew the biceps femoris long head more than Nordic " +
         "curls. One trial, read in abstract only." },

  // single joint
  { movements: ["knee-extension"], muscle: "quads", credit: 1, tier: "B",
    basedOn: ["leg-press-regional-growth"],
    how: "Knee extensions grew the rectus femoris 13.2%." },
  { movements: ["knee-flexion"], muscle: "hamstrings", credit: 1, tier: "B",
    basedOn: ["leg-curl-hamstrings"],
    how: "Seated and lying leg curls both grew the hamstrings (14% and 9%). Seated grows " +
         "them more: a note on the exercise, not extra credit." },
  { movements: ["calf-raise"], muscle: "calves", credit: 1, tier: "B",
    basedOn: ["calf-raise-knee-angle"],
    how: "The gastrocnemius grew 9 to 12% with the knee straight. Measured standing; the " +
         "other straight-knee raises share the row." },
  { movements: ["seated-calf-raise"], muscle: "calves", credit: 0.25, tier: "B",
    basedOn: ["calf-raise-knee-angle"],
    how: "The gastrocnemius grew only 0.6 to 1.7% with the knee bent." }
]);

const SET_CREDIT_INDEX = new Map();      // "movement|muscle" → row

/**
 * What one set of `exercise` counts for `muscleId`: { credit, tier, how, row }.
 * A row in SET_CREDIT wins; otherwise the flat default, with no tier: 1 for a
 * primary muscle, secondaryCredit for an assisting one, 0 for any other.
 */
function setCredit(exercise, muscleId) {
  const row = SET_CREDIT_INDEX.get(exercise.movement + "|" + muscleId);
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
    const name = row.movements.join("/") + " → " + (row.muscle || row.region);
    if (!row.muscle === !row.region) problem(name + " needs a muscle or a region, not both");
    if (!CREDIT_TIERS.includes(row.tier)) problem(name + " has unknown tier " + row.tier);
    if (!row.basedOn.length) problem(name + " cites no evidence");
    for (const id of row.basedOn)
      if (!EVIDENCE_BY_ID.has(id)) problem(name + " is based on unknown evidence " + id);
    for (const m of row.movements) {
      if (!MOVEMENTS[m]) problem(name + " has unknown movement " + m);
      if (!EXERCISES.some(e => e.movement === m)) problem(name + ": no exercise has movement " + m);
    }
    if (row.region) {
      if (!CREDIT_STEPS.includes(row.estimate) || !row.estimate) problem(name + " has estimate " + row.estimate);
      continue;
    }
    if (!MUSCLE_BY_ID.has(row.muscle)) problem(name + " has unknown muscle " + row.muscle);
    if (!CREDIT_STEPS.includes(row.credit)) problem(name + " has credit " + row.credit + ", off the scale");
    if (row.credit === 0 && !ZERO_KINDS.includes(row.zero)) problem(name + " is 0 without saying why");
    if (row.credit !== 0 && row.zero) problem(name + " says why it is 0, but is " + row.credit);
    if (row.zero === "unassigned" &&
        !SET_CREDIT.some(r => r.region && row.movements.every(m => r.movements.includes(m))))
      problem(name + " is unassigned, but no region row keeps its stimulus");
    for (const m of row.movements) {
      const key = m + "|" + row.muscle;
      if (SET_CREDIT_INDEX.has(key)) problem(name + " is credited twice for " + m);
      SET_CREDIT_INDEX.set(key, row);
      // a credit the catalogue doesn't list would be counted for nothing the planner chose it for
      if (row.credit > 0)
        for (const ex of EXERCISES.filter(e => e.movement === m && !e.trainsPrimarily(row.muscle) && !e.assists(row.muscle)))
          problem(name + ": \"" + ex.name + "\" does not list " + row.muscle);
    }
  }
})();
