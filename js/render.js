/* =========================================================================
   Presentation — what every view shares: the one routine, and a few
   helpers for drawing it.
   ========================================================================= */

const routine = new WeeklyRoutine();

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * Puts focus back on a control drawn again under it. One that came back
 * disabled (a stepper at its end, the last meal's "next") hands focus to
 * a working neighbour, so it never falls to the page. Returns whether
 * anything took it.
 */
function focusAgain(el) {
  if (!el) return false;
  const to = !el.disabled ? el
    : el.parentElement && el.parentElement.querySelector("button:not(:disabled), select:not(:disabled), input:not(:disabled)");
  if (to) to.focus({ preventScroll: true });
  return !!to;
}

/**
 * Says `text` to a screen reader through the page's one lasting live region
 * (#announce). The same words twice are still said: the region is emptied
 * first, and filled on the next frame.
 */
function announce(text) {
  const el = $("announce");
  if (!el || !text) return;
  el.textContent = "";
  requestAnimationFrame(() => { el.textContent = text; });
}

/* In any radio group, the arrow keys move to the next or previous choice
   and choose it, as the ARIA radio pattern expects. */
document.addEventListener("keydown", e => {
  const radio = e.target.closest && e.target.closest('[role="radio"]');
  const group = radio && radio.closest('[role="radiogroup"]');
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!group || !step) return;
  const radios = [...group.querySelectorAll('[role="radio"]:not(:disabled)')];
  const to = radios[(radios.indexOf(radio) + step + radios.length) % radios.length];
  if (!to || to === radio) return;
  e.preventDefault();
  to.focus();
  to.click();
});

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
