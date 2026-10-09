/* ===========================================================================
   Exercise metadata — what each exercise does, beyond which muscles it lists.

   The catalogue (exercises.js) says which muscles an exercise works. That is
   not enough to tell a lateral raise from a reverse fly (both "shoulders"),
   or a squat from a hip thrust (both "glutes"). Each entry here adds:

     action       the joint action or movement job ("hip-extension",
                  "shoulder-abduction"). Two exercises with the same action
                  do the same job.
     regions      per muscle, which part of it the action loads most
                  (shoulders: anterior / lateral / posterior). Left out for
                  a muscle when the action does not point to one part.
     confidence   how sure the classification is, in three honest levels:
                    "anatomy"     follows directly from the joint action and
                                  line of pull (a lateral raise abducts the
                                  arm, which is the lateral deltoid's job)
                    "convention"  the usual coaching classification; EMG
                                  studies are mixed or limited on it
                    "uncertain"   a guess the sources do not settle
     note         why, when it is not obvious

   Where this comes from: the author's reading of functional anatomy, not a
   cited study per exercise. Every entry is therefore marked review: "pending"
   until a person with the sources has checked it. Nothing here rates how
   good an exercise is; that stays with the tier lists (exercises.js).

   Deliberately not recorded: muscle length / stretch-position claims and
   stimulus or fatigue scores. The evidence on them is contested and the
   project does not invent numbers (docs/atlas-design.md).
   ========================================================================= */

/** Parts of a muscle the metadata can name. A muscle not listed here has no regions. */
const MUSCLE_REGIONS = Object.freeze({
  chest:       ["clavicular", "sternal"],
  shoulders:   ["anterior", "lateral", "posterior"],
  "upper-back": ["retractors", "external-rotators"],
  traps:       ["upper", "middle", "lower"],
  glutes:      ["maximus", "medius"]
});

const META_CONFIDENCE = Object.freeze(["anatomy", "convention", "uncertain"]);

/**
 * [exercise name, action, { muscle id: [regions] }, confidence, note?]
 * Every exercise that lists glutes, shoulders, upper back, traps or chest
 * as a muscle has one. Lats and the others only have an action.
 */
const EXERCISE_META = [
  // chest
  ["Machine Chest Press",            "horizontal-press", { chest: ["sternal"], shoulders: ["anterior"] }, "convention"],
  ["Bench Press",                    "horizontal-press", { chest: ["sternal"], shoulders: ["anterior"] }, "convention"],
  ["Flat Dumbbell Press",            "horizontal-press", { chest: ["sternal"], shoulders: ["anterior"] }, "convention"],
  ["Smith Machine Flat Bench Press", "horizontal-press", { chest: ["sternal"], shoulders: ["anterior"] }, "convention"],
  ["Deficit Push-Ups",               "horizontal-press", { chest: ["sternal"], shoulders: ["anterior"] }, "convention"],
  ["Dumbbell Guillotine Press",      "horizontal-press", { chest: ["sternal"], shoulders: ["anterior"] }, "uncertain",
    "Elbows flared high is said to shift load up the chest; the sources do not settle it."],
  ["Incline Bench Press",            "incline-press", { chest: ["clavicular"], shoulders: ["anterior"] }, "convention"],
  ["Incline Dumbbell Press",         "incline-press", { chest: ["clavicular"], shoulders: ["anterior"] }, "convention"],
  ["Incline Smith Machine Press",    "incline-press", { chest: ["clavicular"], shoulders: ["anterior"] }, "convention"],
  ["Dips",                           "dip", { chest: ["sternal"], shoulders: ["anterior"] }, "convention",
    "Torso lean decides how chest-biased a dip is."],
  ["Close-Grip Bench Press",         "close-grip-press", { chest: ["sternal"], shoulders: ["anterior"] }, "convention"],

  ["Seated Cable Pec Flye",  "chest-fly", { chest: ["sternal"] }, "convention"],
  ["Cable Crossovers",       "chest-fly", { chest: ["sternal"] }, "uncertain",
    "The cable angle (high-to-low or low-to-high) is said to shift the part of the chest; the sources do not settle it."],
  ["Pec Deck",               "chest-fly", { chest: ["sternal"] }, "convention"],
  ["Dumbbell Flye",          "chest-fly", { chest: ["sternal"] }, "convention"],
  ["Cable Press-Around",     "chest-fly", { chest: ["sternal"] }, "convention"],
  ["Smith Machine JM Press", "lying-extension", { chest: ["sternal"] }, "convention",
    "The chest only assists; listed so every exercise that credits the chest has an entry."],

  // back
  ["Wide-Grip Lat Pulldown",          "vertical-pull", {}, "anatomy"],
  ["Neutral-Grip Lat Pulldown",       "vertical-pull", {}, "anatomy"],
  ["Half-Kneeling 1-Arm Lat Pulldown", "vertical-pull", {}, "anatomy"],
  ["Wide-Grip Pull-Up",               "vertical-pull", {}, "anatomy"],
  ["Neutral-Grip Pull-Up",            "vertical-pull", {}, "anatomy"],
  ["Cross-Body Lat Pull-Around",      "lat-isolation", {}, "anatomy"],
  ["Cable Lat Pullover",              "lat-isolation", {}, "anatomy"],
  ["DB Lat Pullover",                 "lat-isolation", { chest: ["sternal"] }, "convention"],
  ["Chest-Supported Row",   "horizontal-row", { "upper-back": ["retractors"], shoulders: ["posterior"] }, "convention"],
  ["Meadows Row",           "horizontal-row", { "upper-back": ["retractors"] }, "convention"],
  ["Cable Row",             "horizontal-row", { "upper-back": ["retractors"] }, "convention"],
  ["1-Arm Dumbbell Row",    "horizontal-row", { "upper-back": ["retractors"] }, "convention"],
  ["Kroc Row",              "horizontal-row", { "upper-back": ["retractors"], traps: ["middle"] }, "convention"],
  ["Deficit Pendlay Row",   "horizontal-row", { "upper-back": ["retractors"], traps: ["middle"] }, "convention"],
  ["Wide-Grip Cable Row",   "horizontal-row", { "upper-back": ["retractors"], shoulders: ["posterior"], traps: ["middle"] }, "convention",
    "The wide grip is said to move work from the lats to the upper back."],
  ["Seated Rope Face-Pull", "face-pull", { "upper-back": ["external-rotators", "retractors"], shoulders: ["posterior"], traps: ["middle"] }, "convention"],
  ["Lying Rope Face-Pull",  "face-pull", { "upper-back": ["external-rotators", "retractors"], shoulders: ["posterior"], traps: ["middle"] }, "convention"],
  ["Rope Facepull",         "face-pull", { "upper-back": ["external-rotators", "retractors"], shoulders: ["posterior"], traps: ["middle"] }, "convention"],

  // shoulders
  ["Cable Lateral Raise",                     "shoulder-abduction", { shoulders: ["lateral"] }, "anatomy"],
  ["Behind-the-Back Cuffed Lateral Raise",    "shoulder-abduction", { shoulders: ["lateral"] }, "anatomy"],
  ["Atlantis Standing Machine Lateral Raise", "shoulder-abduction", { shoulders: ["lateral"] }, "anatomy"],
  ["Lean-In Dumbbell Lateral Raise",          "shoulder-abduction", { shoulders: ["lateral"] }, "anatomy"],
  ["Arnold Style Side-Lying Dumbbell Raise",  "shoulder-abduction", { shoulders: ["lateral"] }, "anatomy"],
  ["Cable Y-Raise",                           "shoulder-abduction", { shoulders: ["lateral"], traps: ["lower"] }, "uncertain",
    "The raise is high and angled forward, so the lower traps may help; the sources do not settle it."],
  ["Reverse Pec Deck",         "horizontal-abduction", { shoulders: ["posterior"], "upper-back": ["retractors"] }, "anatomy"],
  ["Reverse Cable Crossover",  "horizontal-abduction", { shoulders: ["posterior"], "upper-back": ["retractors"] }, "anatomy"],
  ["Machine Shoulder Press",   "overhead-press", { shoulders: ["anterior", "lateral"] }, "convention"],
  ["Dumbbell Overhead Press",  "overhead-press", { shoulders: ["anterior", "lateral"], traps: ["upper"] }, "convention"],

  // traps
  ["Dumbbell Shrug", "shrug", { traps: ["upper"] }, "anatomy"],
  ["Cable Shrug",    "shrug", { traps: ["upper"] }, "anatomy"],
  ["Barbell Shrug",  "shrug", { traps: ["upper"] }, "anatomy"],

  // glutes and legs
  ["Barbell Back Squat",       "knee-dominant", { glutes: ["maximus"] }, "convention", "Glute involvement grows with depth."],
  ["Smith Machine Squat",      "knee-dominant", { glutes: ["maximus"] }, "convention"],
  ["Hack Squat",               "knee-dominant", { glutes: ["maximus"] }, "convention"],
  ["Pendulum Squat",           "knee-dominant", { glutes: ["maximus"] }, "convention"],
  ["Barbell Front Squat",      "knee-dominant", { glutes: ["maximus"] }, "convention"],
  ["Low-Bar Squat",            "knee-dominant", { glutes: ["maximus"] }, "convention"],
  ["45-Degree Leg Press",      "knee-dominant", { glutes: ["maximus"] }, "convention"],
  ["Bulgarian Split Squat",    "knee-dominant", { glutes: ["maximus"] }, "convention"],
  ["Walking Lunge",            "knee-dominant", { glutes: ["maximus"] }, "convention"],
  ["Smith Machine Lunge (Front Foot Elevated)", "knee-dominant", { glutes: ["maximus"] }, "convention"],
  ["Smith Machine Lunge",      "knee-dominant", { glutes: ["maximus"] }, "convention"],
  ["Step Ups",                 "knee-dominant", { glutes: ["maximus"] }, "convention"],
  ["Machine Hip Thrust",           "hip-extension", { glutes: ["maximus"] }, "anatomy"],
  ["Single-Leg Dumbbell Hip Thrust", "hip-extension", { glutes: ["maximus"] }, "anatomy"],
  ["Glute Kickback",               "hip-extension", { glutes: ["maximus"] }, "anatomy"],
  ["45-Degree Back Extension",     "hip-extension", { glutes: ["maximus"] }, "convention",
    "Rounding the back or not changes how much glute and how much lower back it trains."],
  ["Romanian Deadlift",            "hip-extension", { glutes: ["maximus"] }, "convention",
    "Mostly hamstring-led; counted as a hip-extension job for the glutes."],
  ["Machine Hip Abduction",        "hip-abduction", { glutes: ["medius"] }, "anatomy"],
  ["Back Extension (Lower-Back Focus)", "back-extension", { glutes: ["maximus"] }, "convention"]
];

(function attachMeta() {
  const problem = msg => console.error("Exercise metadata: " + msg);
  const seen = new Set();
  for (const [name, action, regions, confidence, note] of EXERCISE_META) {
    const ex = EXERCISE_BY_NAME.get(name);
    if (!ex) { problem("\"" + name + "\" is not in the catalogue"); continue; }
    if (seen.has(name)) problem("\"" + name + "\" appears twice");
    seen.add(name);
    if (!META_CONFIDENCE.includes(confidence)) problem("\"" + name + "\" has unknown confidence " + confidence);
    for (const [muscle, list] of Object.entries(regions)) {
      if (!ex.primary.includes(muscle) && !ex.secondary.includes(muscle))
        problem("\"" + name + "\" lists regions of " + muscle + ", which it does not work");
      for (const r of list)
        if (!(MUSCLE_REGIONS[muscle] || []).includes(r)) problem("\"" + name + "\" has unknown region " + muscle + "/" + r);
    }
    ex.meta = Object.freeze({ action, regions, confidence, note: note || "", review: "pending" });
  }
})();
