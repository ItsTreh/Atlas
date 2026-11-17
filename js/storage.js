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
   routine. The routine's nutrition reads the weight from it live. */
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

/* A new visit or a reload. A reload (Cmd+R) goes straight back to where the
   user was; closing ATLAS and opening it again is a new visit: the start
   screen, then Targets, with everything entered still there. A tab mark
   can't tell them apart (Firefox restores a closed tab's sessionStorage),
   so a reload is the browser saying "reload" while the page went only
   moments ago: the moment it went is kept as it goes. */
const LEFT_KEY = "atlas.left";
/* How soon after the page went a reload is still a reload, in ms. */
const RELOAD_GAP_MS = 60 * 1000;

/** True for a reload: `navType` "reload" and the page gone less than RELOAD_GAP_MS before `now`. */
function isReload(navType, leftAt, now) {
  return navType === "reload" && typeof leftAt === "number" && leftAt > 0 && now - leftAt >= 0 && now - leftAt < RELOAD_GAP_MS;
}

/** True when this load is a new visit, not a reload; from here on, notes when the page goes. */
function newVisit() {
  let navType, leftAt = null;
  try { navType = performance.getEntriesByType("navigation")[0].type; } catch {}
  try { leftAt = Number(localStorage.getItem(LEFT_KEY)) || null; } catch {}
  addEventListener("pagehide", () => { try { localStorage.setItem(LEFT_KEY, String(Date.now())); } catch {} });
  return !isReload(navType, leftAt, Date.now());
}
