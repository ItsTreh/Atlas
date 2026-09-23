/* ===========================================================================
   Recommended programs — preset selections of target muscles.

   Each program is data: an id, the muscles it trains (by muscle id), and a
   one-line reason it groups them. They follow the splits lifters actually
   run, so the grouping is never arbitrary — muscles land together because
   the same lifts train them (Push: every pressing movement loads chest,
   front delts and triceps at once) or because a split puts them on the
   same day.

   To add a program, append an entry. `group` must be one of PROGRAM_GROUPS
   and every id in `muscles` must exist in MUSCLES; both are checked at load.
   ========================================================================= */

const PROGRAM_GROUPS = [
  { id: "whole",    name: "Whole-body splits" },
  { id: "movement", name: "Push · Pull · Legs" },
  { id: "pairing",  name: "Classic pairings" }
];

const PROGRAMS = [
  {
    id: "full-body", name: "Full Body", group: "whole",
    muscles: MUSCLES.map(m => m.id),
    why: "Every major muscle. Suits 2–4 sessions a week, with each muscle " +
         "trained in most of them."
  },
  {
    id: "upper", name: "Upper Body", group: "whole",
    muscles: ["chest", "shoulders", "triceps", "traps", "upper-back", "lats",
              "biceps", "forearms"],
    why: "The upper half of an upper/lower split: pressing and pulling in " +
         "the same session."
  },
  {
    id: "lower", name: "Lower Body", group: "whole",
    muscles: ["quads", "hamstrings", "glutes", "adductors", "calves",
              "abs", "obliques", "lower-back"],
    why: "The lower half of an upper/lower split. Core work usually sits " +
         "here, since squats and hinges already brace it."
  },
  {
    id: "push", name: "Push", group: "movement",
    muscles: ["chest", "shoulders", "triceps"],
    why: "Everything a press trains: bench, overhead press and dips all load " +
         "these three together."
  },
  {
    id: "pull", name: "Pull", group: "movement",
    muscles: ["traps", "upper-back", "lats", "biceps", "forearms"],
    why: "Everything a row or pull-up trains, down to the grip."
  },
  {
    id: "legs", name: "Legs", group: "movement",
    muscles: ["quads", "hamstrings", "glutes", "adductors", "calves"],
    why: "Squats, hinges and lunges: the full lower body without the core " +
         "block of an upper/lower split."
  },
  {
    id: "chest-triceps", name: "Chest & Triceps", group: "pairing",
    muscles: ["chest", "triceps"],
    why: "Triceps finish every press, so they are already warm when chest " +
         "work ends."
  },
  {
    id: "back-biceps", name: "Back & Biceps", group: "pairing",
    muscles: ["traps", "upper-back", "lats", "biceps"],
    why: "Biceps assist every row and pull-up — the mirror of chest & triceps."
  },
  {
    id: "shoulders-arms", name: "Shoulders & Arms", group: "pairing",
    muscles: ["shoulders", "biceps", "triceps", "forearms"],
    why: "Smaller muscles that recover fast, often given their own day in a " +
         "five-day split."
  },
  {
    id: "core", name: "Core", group: "pairing",
    muscles: ["abs", "obliques", "lower-back"],
    why: "The trunk from every side: flexion, rotation and extension."
  }
];

/* Catch a typo in the data at load, not as a silently empty highlight later. */
(function validatePrograms() {
  const groups = new Set(PROGRAM_GROUPS.map(g => g.id));
  const seen = new Set();
  for (const p of PROGRAMS) {
    if (seen.has(p.id)) console.error("Program id used twice: " + p.id);
    seen.add(p.id);
    if (!groups.has(p.group)) console.error("Program " + p.id + " has unknown group " + p.group);
    for (const id of p.muscles)
      if (!MUSCLE_BY_ID.has(id)) console.error("Program " + p.id + " lists unknown muscle " + id);
    Object.freeze(p.muscles); Object.freeze(p);
  }
})();

const PROGRAM_BY_ID = new Map(PROGRAMS.map(p => [p.id, p]));
