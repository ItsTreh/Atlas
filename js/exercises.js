/* ===========================================================================
   Exercise database — data only, no page code.

   Kept in two parts, so each can grow without touching the other:

     EXERCISE_CATALOGUE  what an exercise IS: its movement and the muscles it
                         trains, primary and secondary. Rated or not.
     EXERCISE_RATINGS    how exercises are RATED for a muscle group: tier
                         lists, copied exactly as supplied.

   A rating applies to the muscles in the list's `rates` that the exercise
   trains as a primary. That is how one "Back" list rates a pulldown for the
   lats only, but a chest-supported row for both lats and upper back. An
   exercise listed under two groups (Barbell Back Squat is S for quads and A
   for glutes) keeps both labels, one per muscle.

   Tiers are labels with an order, never numbers. The only question the
   planner asks of a tier is "does this one rank above that one?" — they are
   not summed, averaged or weighted.

   To add an exercise: add it to the catalogue, then (optionally) to a tier
   list. To add a muscle group: add a ratings entry whose `rates` are muscle
   ids from MUSCLES. Mistakes are reported in the console at load.
   ========================================================================= */

/** Tier labels, best first. Only the order matters. */
const TIERS = Object.freeze(["S+", "S", "A+", "A"]);

/**
 * Movements. Two exercises with the same movement are "essentially the same
 * exercise" for planning: a session never gets both unless the user asks.
 */
const MOVEMENTS = Object.freeze({
  "flat-press":         "Flat press",
  "incline-press":      "Incline press",
  "dip":                "Dip",
  "chest-fly":          "Chest fly",
  "overhead-extension": "Overhead triceps extension",
  "lying-extension":    "Lying triceps extension",
  "pressdown":          "Triceps pressdown",
  "triceps-kickback":   "Triceps kickback",
  "close-grip-press":   "Close-grip press",
  "vertical-pull":      "Vertical pull",
  "row":                "Row",
  "wide-row":           "Wide row",
  "lat-isolation":      "Lat isolation",
  "face-pull":          "Face pull",
  "lateral-raise":      "Lateral raise",
  "rear-delt-fly":      "Rear delt fly",
  "overhead-press":     "Overhead press",
  "squat":              "Squat",
  "lunge":              "Lunge / split squat",
  "leg-press":          "Leg press",
  "knee-extension":     "Knee extension",
  "stretch-curl":       "Curl, arm behind the body",
  "preacher-curl":      "Preacher curl",
  "curl":               "Standing curl",
  "hammer-curl":        "Neutral-grip curl",
  "hip-abduction":      "Hip abduction",
  "hip-thrust":         "Hip thrust",
  "hinge":              "Hip hinge",
  "glute-kickback":     "Glute kickback"
});

/**
 * Compound movements: several joints working, heavy loads. They are done
 * for fewer reps with longer rests than isolation work (see LIFT_KINDS in
 * workouts.js). Every other movement counts as isolation.
 */
const COMPOUND_MOVEMENTS = Object.freeze(new Set([
  "flat-press", "incline-press", "dip", "close-grip-press", "overhead-press",
  "vertical-pull", "row", "wide-row",
  "squat", "lunge", "leg-press", "hip-thrust", "hinge"
]));

/* --------------------------------------------------------------------------
   Catalogue:  [name, movement, primary muscles, secondary muscles]
   Primary muscles do the work; secondary ones assist and get partial credit.
   -------------------------------------------------------------------------- */
const EXERCISE_CATALOGUE = [
  // chest
  ["Machine Chest Press",            "flat-press",    ["chest"], ["triceps", "shoulders"]],
  ["Seated Cable Pec Flye",          "chest-fly",     ["chest"], []],
  ["Bench Press",                    "flat-press",    ["chest"], ["triceps", "shoulders"]],
  ["Incline Bench Press",            "incline-press", ["chest"], ["shoulders", "triceps"]],
  ["Flat Dumbbell Press",            "flat-press",    ["chest"], ["triceps", "shoulders"]],
  ["Incline Dumbbell Press",         "incline-press", ["chest"], ["shoulders", "triceps"]],
  ["Dips",                           "dip",           ["chest"], ["triceps", "shoulders"]],
  ["Deficit Push-Ups",               "flat-press",    ["chest"], ["triceps", "shoulders", "abs"]],
  ["Dumbbell Guillotine Press",      "flat-press",    ["chest"], ["shoulders", "triceps"]],
  ["Smith Machine Flat Bench Press", "flat-press",    ["chest"], ["triceps", "shoulders"]],
  ["Incline Smith Machine Press",    "incline-press", ["chest"], ["shoulders", "triceps"]],
  ["Cable Crossovers",               "chest-fly",     ["chest"], []],
  ["Pec Deck",                       "chest-fly",     ["chest"], []],
  ["Dumbbell Flye",                  "chest-fly",     ["chest"], []],
  ["Cable Press-Around",             "chest-fly",     ["chest"], ["triceps"]],

  // triceps
  ["Overhead Cable Triceps Extension",        "overhead-extension", ["triceps"], []],
  ["Skullcrushers",                           "lying-extension",    ["triceps"], []],
  ["Triceps Pressdown (Bar)",                 "pressdown",          ["triceps"], []],
  ["Overhead Cable Triceps Extension (Rope)", "overhead-extension", ["triceps"], []],
  ["Katana Cable Triceps Extension",          "overhead-extension", ["triceps"], []],
  ["One-Arm Dumbbell Overhead Extension",     "overhead-extension", ["triceps"], []],
  ["Dumbbell Skullcrushers",                  "lying-extension",    ["triceps"], []],
  ["Smith Machine JM Press",                  "lying-extension",    ["triceps"], ["chest"]],
  ["Cable Triceps Kickbacks",                 "triceps-kickback",   ["triceps"], []],
  ["Close-Grip Bench Press",                  "close-grip-press",   ["triceps"], ["chest", "shoulders"]],

  // back
  ["Chest-Supported Row",              "row",           ["upper-back", "lats"], ["biceps", "shoulders"]],
  ["Wide-Grip Lat Pulldown",           "vertical-pull", ["lats"], ["upper-back", "biceps"]],
  ["Neutral-Grip Lat Pulldown",        "vertical-pull", ["lats"], ["biceps"]],
  ["Half-Kneeling 1-Arm Lat Pulldown",  "vertical-pull", ["lats"], ["biceps"]],
  ["Meadows Row",                      "row",           ["lats", "upper-back"], ["biceps", "forearms"]],
  ["Cable Row",                        "row",           ["lats", "upper-back"], ["biceps"]],
  ["Wide-Grip Cable Row",              "wide-row",      ["upper-back"], ["lats", "shoulders", "traps"]],
  ["Wide-Grip Pull-Up",                "vertical-pull", ["lats"], ["upper-back", "biceps", "forearms"]],
  ["Neutral-Grip Pull-Up",             "vertical-pull", ["lats"], ["biceps", "forearms"]],
  ["Cross-Body Lat Pull-Around",       "lat-isolation", ["lats"], []],
  ["Deficit Pendlay Row",              "row",           ["upper-back", "lats"], ["lower-back", "biceps", "traps"]],
  ["1-Arm Dumbbell Row",               "row",           ["lats", "upper-back"], ["biceps"]],
  ["Kroc Row",                         "row",           ["lats", "upper-back"], ["biceps", "forearms", "traps"]],
  ["Seated Rope Face-Pull",            "face-pull",     ["upper-back", "shoulders"], ["traps"]],
  ["Lying Rope Face-Pull",             "face-pull",     ["upper-back", "shoulders"], ["traps"]],
  ["Cable Lat Pullover",               "lat-isolation", ["lats"], []],
  ["DB Lat Pullover",                  "lat-isolation", ["lats"], ["chest"]],

  // shoulders
  ["Cable Lateral Raise",                     "lateral-raise",  ["shoulders"], []],
  ["Cable Y-Raise",                           "lateral-raise",  ["shoulders"], ["traps"]],
  ["Behind-the-Back Cuffed Lateral Raise",    "lateral-raise",  ["shoulders"], []],
  ["Reverse Pec Deck",                        "rear-delt-fly",  ["shoulders"], ["upper-back"]],
  ["Reverse Cable Crossover",                 "rear-delt-fly",  ["shoulders"], ["upper-back"]],
  ["Machine Shoulder Press",                  "overhead-press", ["shoulders"], ["triceps"]],
  ["Atlantis Standing Machine Lateral Raise", "lateral-raise",  ["shoulders"], []],
  ["Lean-In Dumbbell Lateral Raise",          "lateral-raise",  ["shoulders"], []],
  ["Dumbbell Overhead Press",                 "overhead-press", ["shoulders"], ["triceps", "traps"]],
  ["Arnold Style Side-Lying Dumbbell Raise",  "lateral-raise",  ["shoulders"], []],
  ["Rope Facepull",                           "face-pull",      ["shoulders", "upper-back"], ["traps"]],

  // quads
  ["Barbell Back Squat",    "squat",          ["quads", "glutes"], ["adductors", "lower-back"]],
  ["Hack Squat",            "squat",          ["quads"], ["glutes"]],
  ["Pendulum Squat",        "squat",          ["quads"], ["glutes"]],
  ["Smith Machine Squat",   "squat",          ["quads", "glutes"], ["adductors"]],
  ["Bulgarian Split Squat", "lunge",          ["quads", "glutes"], ["adductors"]],
  ["Barbell Front Squat",   "squat",          ["quads"], ["glutes", "upper-back"]],
  ["Low-Bar Squat",         "squat",          ["quads"], ["glutes", "hamstrings", "lower-back"]],
  ["45-Degree Leg Press",   "leg-press",      ["quads"], ["glutes"]],
  ["Leg Extension",         "knee-extension", ["quads"], []],
  ["Reverse Nordic",        "knee-extension", ["quads"], []],

  // biceps
  ["Face Away Bayesian Cable Curl", "stretch-curl",  ["biceps"], []],
  ["Dumbbell Preacher Curl",        "preacher-curl", ["biceps"], []],
  ["Machine Preacher Curl",         "preacher-curl", ["biceps"], []],
  ["Hammer Grip Preacher Curl",     "preacher-curl", ["biceps"], ["forearms"]],
  ["EZ Bar Curl",                   "curl",          ["biceps"], ["forearms"]],
  ["Standing Dumbbell Curl",        "curl",          ["biceps"], ["forearms"]],
  ["Incline Curl",                  "stretch-curl",  ["biceps"], []],
  ["Lying Dumbbell Curl",           "stretch-curl",  ["biceps"], []],
  ["Modified 21s",                  "curl",          ["biceps"], ["forearms"]],
  ["Standard Cable Curl",           "curl",          ["biceps"], []],
  ["Bayesian Cable Curl",           "stretch-curl",  ["biceps"], []],
  ["Cheat Curl",                    "curl",          ["biceps"], ["forearms"]],
  ["Strict Curl",                   "curl",          ["biceps"], ["forearms"]],
  ["Hammer Curl",                   "hammer-curl",   ["biceps"], ["forearms"]],
  ["Inverse Zottman Curl",          "hammer-curl",   ["biceps"], ["forearms"]],

  // glutes (squats and the split squat are above, under quads)
  ["Walking Lunge",                              "lunge",          ["glutes", "quads"], ["adductors", "hamstrings"]],
  ["Machine Hip Abduction",                      "hip-abduction",  ["glutes"], []],
  ["Smith Machine Lunge (Front Foot Elevated)",  "lunge",          ["glutes", "quads"], ["adductors"]],
  ["45-Degree Back Extension",                   "hinge",          ["glutes"], ["hamstrings", "lower-back"]],
  ["Machine Hip Thrust",                         "hip-thrust",     ["glutes"], ["hamstrings"]],
  ["Single-Leg Dumbbell Hip Thrust",             "hip-thrust",     ["glutes"], ["hamstrings"]],
  ["Glute Kickback",                             "glute-kickback", ["glutes"], ["hamstrings"]],
  ["Step Ups",                                   "lunge",          ["glutes", "quads"], []],
  ["Smith Machine Lunge",                        "lunge",          ["glutes", "quads"], ["adductors"]],
  ["Romanian Deadlift",                          "hinge",          ["glutes", "hamstrings"], ["lower-back", "forearms"]]
];

/* --------------------------------------------------------------------------
   Ratings, exactly as supplied. Within a tier, list order is kept and used
   only to break ties.
   -------------------------------------------------------------------------- */
const EXERCISE_RATINGS = [
  { group: "Chest", rates: ["chest"], tiers: {
    "S+": ["Machine Chest Press"],
    "S":  ["Seated Cable Pec Flye"],
    "A":  ["Bench Press", "Incline Bench Press", "Flat Dumbbell Press",
           "Incline Dumbbell Press", "Dips", "Deficit Push-Ups",
           "Dumbbell Guillotine Press", "Smith Machine Flat Bench Press",
           "Incline Smith Machine Press", "Cable Crossovers", "Pec Deck",
           "Dumbbell Flye", "Cable Press-Around"]
  }},
  { group: "Triceps", rates: ["triceps"], tiers: {
    "S":  ["Overhead Cable Triceps Extension", "Skullcrushers"],
    "A":  ["Triceps Pressdown (Bar)", "Overhead Cable Triceps Extension (Rope)",
           "Katana Cable Triceps Extension", "One-Arm Dumbbell Overhead Extension",
           "Dumbbell Skullcrushers", "Smith Machine JM Press",
           "Cable Triceps Kickbacks", "Close-Grip Bench Press"]
  }},
  { group: "Back", rates: ["lats", "upper-back"], tiers: {
    "S+": ["Chest-Supported Row"],
    "S":  ["Wide-Grip Lat Pulldown", "Neutral-Grip Lat Pulldown",
           "Half-Kneeling 1-Arm Lat Pulldown", "Meadows Row", "Cable Row",
           "Wide-Grip Cable Row"],
    "A":  ["Wide-Grip Pull-Up", "Neutral-Grip Pull-Up", "Cross-Body Lat Pull-Around",
           "Deficit Pendlay Row", "1-Arm Dumbbell Row", "Kroc Row",
           "Seated Rope Face-Pull", "Lying Rope Face-Pull", "Cable Lat Pullover",
           "DB Lat Pullover"]
  }},
  { group: "Shoulders", rates: ["shoulders"], tiers: {
    "S":  ["Cable Lateral Raise", "Cable Y-Raise", "Behind-the-Back Cuffed Lateral Raise",
           "Reverse Pec Deck", "Reverse Cable Crossover"],
    "A+": ["Machine Shoulder Press", "Atlantis Standing Machine Lateral Raise"],
    "A":  ["Lean-In Dumbbell Lateral Raise", "Dumbbell Overhead Press",
           "Arnold Style Side-Lying Dumbbell Raise", "Rope Facepull"]
  }},
  { group: "Quads", rates: ["quads"], tiers: {
    "S":  ["Barbell Back Squat", "Hack Squat", "Pendulum Squat", "Smith Machine Squat",
           "Bulgarian Split Squat"],
    "A":  ["Barbell Front Squat", "Low-Bar Squat", "45-Degree Leg Press",
           "Leg Extension", "Reverse Nordic"]
  }},
  { group: "Biceps", rates: ["biceps"], tiers: {
    "S":  ["Face Away Bayesian Cable Curl", "Dumbbell Preacher Curl",
           "Machine Preacher Curl", "Hammer Grip Preacher Curl"],
    "A":  ["EZ Bar Curl", "Standing Dumbbell Curl", "Incline Curl", "Lying Dumbbell Curl",
           "Modified 21s", "Standard Cable Curl", "Bayesian Cable Curl", "Cheat Curl",
           "Strict Curl", "Hammer Curl", "Inverse Zottman Curl"]
  }},
  { group: "Glutes", rates: ["glutes"], tiers: {
    "S+": ["Walking Lunge"],
    "S":  ["Machine Hip Abduction", "Smith Machine Lunge (Front Foot Elevated)",
           "45-Degree Back Extension"],
    "A":  ["Machine Hip Thrust", "Single-Leg Dumbbell Hip Thrust", "Barbell Back Squat",
           "Smith Machine Squat", "Bulgarian Split Squat", "Glute Kickback", "Step Ups",
           "Smith Machine Lunge", "Romanian Deadlift"]
  }}
];

/* ============================== the index ================================ */

class Exercise {
  constructor(name, movement, primary, secondary) {
    this.id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    this.name = name; this.movement = movement;
    this.primary = primary; this.secondary = secondary;
    this.tiers = {};              // muscle id → tier label, e.g. { quads: "S" }
    this.listOrder = {};          // muscle id → position in its tier list
  }
  get compound() { return COMPOUND_MOVEMENTS.has(this.movement); }
  /** The tier label for this muscle, or null if it is not rated for it. */
  tierFor(muscleId) { return this.tiers[muscleId] || null; }
  trainsPrimarily(muscleId) { return this.primary.includes(muscleId); }
  assists(muscleId) { return this.secondary.includes(muscleId); }
}

/** Position of a tier label in TIERS; unrated sorts after every tier. */
function tierRank(label) {
  const i = TIERS.indexOf(label);
  return i < 0 ? TIERS.length : i;
}

const EXERCISES = [];
const EXERCISE_BY_ID = new Map();
const EXERCISE_BY_NAME = new Map();

(function buildIndex() {
  const problem = msg => console.error("Exercise data: " + msg);
  const muscleOk = id => MUSCLE_BY_ID.has(id) || (problem("unknown muscle " + id), false);
  for (const m of COMPOUND_MOVEMENTS)
    if (!MOVEMENTS[m]) problem("compound movement " + m + " is not a movement");

  for (const [name, movement, primary, secondary] of EXERCISE_CATALOGUE) {
    if (EXERCISE_BY_NAME.has(name)) { problem("\"" + name + "\" is in the catalogue twice"); continue; }
    if (!MOVEMENTS[movement]) problem("\"" + name + "\" has unknown movement " + movement);
    const ex = new Exercise(name, movement,
      primary.filter(muscleOk), secondary.filter(muscleOk));
    EXERCISES.push(ex);
    EXERCISE_BY_ID.set(ex.id, ex);
    EXERCISE_BY_NAME.set(name, ex);
  }

  for (const list of EXERCISE_RATINGS) {
    list.rates.forEach(muscleOk);
    let order = 0;
    for (const tier of TIERS) {
      for (const name of list.tiers[tier] || []) {
        const ex = EXERCISE_BY_NAME.get(name);
        if (!ex) { problem(list.group + " " + tier + " lists \"" + name + "\", which is not in the catalogue"); continue; }
        const rated = list.rates.filter(m => ex.trainsPrimarily(m));
        if (!rated.length) problem("\"" + name + "\" is rated under " + list.group +
                                   " but trains none of its muscles as a primary");
        for (const m of rated) {
          if (ex.tiers[m]) problem("\"" + name + "\" is rated twice for " + m);
          ex.tiers[m] = tier; ex.listOrder[m] = order;
        }
        order++;
      }
    }
    for (const label of Object.keys(list.tiers))
      if (!TIERS.includes(label)) problem(list.group + " uses unknown tier \"" + label + "\"");
  }
})();

/* ============================== queries ================================== */

const candidateCache = new Map();

/**
 * Every exercise that trains `muscleId` as a primary, best first: rated ones
 * by tier and then list order, then unrated ones in catalogue order. The
 * planner and the Replace menu both read this, so they always agree.
 */
function exercisesFor(muscleId) {
  if (!candidateCache.has(muscleId)) {
    const rated = EXERCISES.filter(e => e.tierFor(muscleId))
      .sort((a, b) => tierRank(a.tierFor(muscleId)) - tierRank(b.tierFor(muscleId)) ||
                      a.listOrder[muscleId] - b.listOrder[muscleId]);
    const unrated = EXERCISES.filter(e => !e.tierFor(muscleId) && e.trainsPrimarily(muscleId));
    candidateCache.set(muscleId, Object.freeze([...rated, ...unrated]));
  }
  return candidateCache.get(muscleId);
}
