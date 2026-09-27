/* ===========================================================================
   Local persistence — remembers the routine between visits.

   Only the INPUTS are stored (muscle selection, nutrition settings, the
   schedule preferences, the availability grid, which alternative arrangement
   was showing) plus whether a week had been generated. Sessions and workouts
   are derived and are rebuilt by generate() on load, deterministically, from
   those same inputs — nothing generated is stored directly, so this stays
   correct even if the exercise or food database changes later.

   Manual exercise swaps inside a session are not restored yet: reloading
   brings back the suggested workout for the same inputs, not a hand-edited
   one.

   Everything here is wrapped in try/catch: localStorage can throw (private
   browsing, storage disabled by the browser, quota exceeded) and a failed
   save or load should never break the app — it should just not persist.
   ========================================================================= */

const STORAGE_KEY = "atlas.routine.v1";

/** Saves the routine's current inputs. Called after every change that
 *  should survive a reload; see render(), the nutrition stage's `changed()`,
 *  the grid's endStroke(), and the schedule controls in app.js. */
function saveRoutine(routine) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routine.snapshot()));
  } catch {
    // Storage unavailable or full: the app still works for this visit.
  }
}

/** Restores a routine from what was last saved. Returns whether there was
 *  anything to restore, so the caller can decide where to land the user. */
function loadRoutine(routine) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    routine.restore(JSON.parse(raw));
    return true;
  } catch {
    return false;   // corrupt or foreign data under this key — start clean, not broken
  }
}
