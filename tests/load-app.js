/* ===========================================================================
   Loads the app's logic into Node for testing — the real files, unchanged.

   The app is classic browser scripts sharing one global scope (so it runs
   from file:// without a build), which means nothing can be `import`ed. This
   runs those scripts, in the order index.html loads them, inside one shared
   `vm` context — the same arrangement the browser uses — and hands back
   the globals the tests need.

   Only logic files run. The files that touch the page are skipped; if a new
   one appears, loading fails with its name, so add it to VIEW_FILES.
   ========================================================================= */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* Scripts that draw or wire up the page. Everything else must run without a DOM. */
const VIEW_FILES = new Set([
  "anatomy.js", "anatomy-sculpture.js", "anatomy-stage.js", "render.js", "targets.js",
  "workout-view.js", "nutrition-view.js", "paint.js", "app.js"
]);

/* The globals tests can use. Adding a name here is all it takes to expose one. */
const EXPORTS = [
  "SetLog", "ExerciseLog", "SessionLog", "TrainingLog", "ExercisePreferences", "logForSession", "SET_DIFFICULTY", "DISCARD_REASONS", "ratingSourceFor", "RATING_ORIGIN", "recoveryRequired", "recoveryCheck", "sessionExposures", "recoveryConflict", "auditPlan", "AUDIT_REASONS", "weekReasons", "sessionReasons", "tires", "tiresBothWays", "WorkoutEntry", "orderEntries", "EVIDENCE", "EVIDENCE_BY_ID", "PLANNER_CONFIG", "PLANNER_TABLES", "CERTAINTY", "ORIGINS", "configValue",
  "DayOfWeek", "SlotState", "FIRST_HOUR", "LAST_HOUR", "FAMILIES",
  "MUSCLES", "MUSCLE_BY_ID", "TrainingBlock",
  "PROGRAMS", "PROGRAM_BY_ID", "PROGRAM_GROUPS", "MuscleSelection", "PRIORITY_LEVELS", "EXPERIENCE_LEVELS", "weeklyTarget", "planDistribution", "maxSpread", "recoveryClash", "DEFAULT_EXPERIENCE", "fitToTime", "SESSION_LENGTH_OPTIONS",
  "ESTIMATE", "estimateTraining",
  "GOALS", "ACTIVITY_LEVELS", "MEAL_PATTERNS", "MEAL_COUNTS", "KCAL_FLOOR", "NutritionPlan",
  "WEIGHT_KG_RANGE", "BURN_RANGE", "weightRangeText",
  "TRAINING_ENERGY", "ADJUST_RANGE", "PROTEIN_PER_KG_RANGE", "trainingLoad", "recommendTargets",
  "FOODS", "MEAL_IDEAS", "DIETS", "fitsDiet", "portionIdea", "mealIdeasFor", "totals",
  "TIERS", "MOVEMENTS", "EXERCISES", "EXERCISE_BY_ID", "EXERCISE_BY_NAME",
  "exercisesFor", "tierRank", "EXERCISE_META", "MUSCLE_REGIONS", "META_CONFIDENCE",
  "WORKOUT", "WorkoutBuilder", "Workout", "LIFT_KINDS", "COMPOUND_MOVEMENTS",
  "WeeklyRoutine", "Scheduler", "TRAINING_DAYS_RANGE", "SPLITS",
  "ANATOMY_MODEL", "ANATOMY_REGIONS"
];

/** The logic scripts, in index.html order. */
export function logicScripts() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  return [...html.matchAll(/<script\s+src="(js\/[^"]+)"/g)]
    .map(m => m[1])
    .filter(src => !VIEW_FILES.has(path.basename(src)));
}

/**
 * A fresh copy of the app. Each call is independent, so tests cannot leak
 * state into each other. `errors` collects anything the data files report
 * with console.error while loading. `extra` scripts (not in index.html, such
 * as a lab model) run after the app's, and `exports` names more globals.
 */
export function loadApp({ extra = [], exports = [] } = {}) {
  const errors = [];
  const context = vm.createContext({
    console: { ...console, error: (...args) => errors.push(args.join(" ")) }
  });
  for (const src of [...logicScripts(), ...extra]) {
    const code = fs.readFileSync(path.join(ROOT, src), "utf8");
    try {
      vm.runInContext(code, context, { filename: src });
    } catch (e) {
      throw new Error("Loading " + src + " failed: " + e.message +
        (/document|window/.test(e.message)
          ? " — if it is a page script, add it to VIEW_FILES in tests/load-app.js" : ""));
    }
  }
  const app = vm.runInContext("({" + [...EXPORTS, ...exports].join(",") + "})", context);
  app.errors = errors;
  return app;
}

/**
 * A routine with `muscleIds` (or a program id) selected and a week generated.
 * `busy` is a list of [day, hour] slots to mark busy first.
 */
export function generatedWeek(app, { program, muscleIds = [], sessions = 4, minutes = 60,
                                      preferredWindow = "evening", busy = [] } = {}) {
  const routine = new app.WeeklyRoutine();
  if (program) routine.selection.applyProgram(app.PROGRAM_BY_ID.get(program));
  for (const id of muscleIds) routine.selection.set(id, true);
  routine.sessionsPerWeek = sessions;
  routine.sessionMinutes = minutes;
  routine.preferredWindow = preferredWindow;
  for (const [day, hour] of busy) routine.markBusy(day, hour);
  const result = routine.generate();
  return { routine, result };
}
