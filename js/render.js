/* =========================================================================
   Presentation — what every view shares: the one routine, and a few
   helpers for drawing it.
   ========================================================================= */

const routine = new WeeklyRoutine();

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function hourLabel(h) {
  h = h % 24;                   // a session ending at midnight ends at 12am
  const s = h < 12 ? "am" : "pm";
  return (h % 12 === 0 ? 12 : h % 12) + s;
}

/** "6–7pm", "11am–1pm": an hour range, the shared suffix said once. */
function hourRange(a, b) {
  const A = hourLabel(a), B = hourLabel(b);
  return A.slice(-2) === B.slice(-2) ? A.slice(0, -2) + "–" + B : A + "–" + B;
}

/** A session's length as the plan shows it: its workout, else the block's share of the session. */
function sessionMinutes(session) {
  return session.workout ? session.workout.minutes : session.block.sessionMinutes;
}

/**
 * Redraws the week after anything that changes it, and saves: every change
 * that reaches render() should survive a reload.
 */
function render() {
  if (typeof renderWeek === "function") renderWeek();
  saveRoutine(routine);
}
