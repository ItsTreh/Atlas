/* ===========================================================================
   Local persistence — remembers the routine between visits.

   Only the INPUTS are stored (muscle selection, nutrition settings, the
   schedule preferences, the availability grid) plus whether a week had been generated,
   and, apart, the measure. Sessions and workouts
   are derived and are rebuilt by generate() on load, deterministically, from
   those same inputs — nothing generated is stored directly, so this stays
   correct even if the exercise or food database changes later.

   Edits to a generated week are not restored yet (moved or removed
   sessions, exercise swaps, adds and removals): reloading brings back the
   week the same inputs give, not a hand-edited one.

   Everything here is wrapped in try/catch: localStorage can throw (private
   browsing, storage disabled by the browser, quota exceeded) and a failed
   save or load should never break the app — it should just not persist.
   ========================================================================= */

const STORAGE_KEY = "atlas.routine.v1";

/** Saves the routine's current inputs. Called after every change that
 *  should survive a reload; see render(), the nutrition stage's `changed()`,
 *  the grid's endStroke(), the selection (app.js, once booted). */
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

/* The measure (measure.js): the four facts and the seal, kept beside the
   routine, since nothing the routine plans from reads them yet. */
const MEASURE_KEY = "atlas.measure.v1";

function saveMeasure(m) {
  try { localStorage.setItem(MEASURE_KEY, JSON.stringify(m.snapshot())); } catch {}
}

function loadMeasure(m) {
  try { m.restore(JSON.parse(localStorage.getItem(MEASURE_KEY))); } catch {}
}

/* Where the user is: the stage, and the view's own place in it (Targets'
   movement), so a reload opens there. Kept beside the routine, and read
   only when the routine was restored. */
const PLACE_KEY = "atlas.place";

function savePlace(place) {
  try { localStorage.setItem(PLACE_KEY, JSON.stringify(place)); } catch {}
}

/** The place last saved, { stage, at }, or null. Stages checks it still makes sense. */
function loadPlace() {
  try {
    const p = JSON.parse(localStorage.getItem(PLACE_KEY));
    return p && typeof p.stage === "string" ? { stage: p.stage, at: typeof p.at === "string" ? p.at : null } : null;
  } catch {
    return null;
  }
}

/* A new visit or a reload: the tab keeps a mark (sessionStorage) until it
   is closed. The start screen greets a new visit; a reload goes straight
   back to where the user was. */
const VISIT_KEY = "atlas.visit";

/** True on the first load in this tab; marks the tab, so its reloads are not. */
function newVisit() {
  try {
    if (sessionStorage.getItem(VISIT_KEY)) return false;
    sessionStorage.setItem(VISIT_KEY, "1");
  } catch {}
  return true;
}
