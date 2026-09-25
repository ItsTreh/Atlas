/* -------------------------------- stages --------------------------------- */

/* Targets, then nutrition, then the week. Stages are hidden rather than
   rebuilt, so the grid the user painted survives a trip back to change the
   muscles or the eating plan. */
const STAGES = { targets: $("stage-targets"), nutrition: $("stage-nutrition"),
                 plan: $("stage-plan") };

/* The quiet line under the product name: the stage's number and name. */
const STAGE_LABELS = { targets: "Define your focus", nutrition: "Nutrition", plan: "Week plan" };
function paintStageLabel(name) {
  const n = String(Object.keys(STAGES).indexOf(name) + 1).padStart(2, "0");
  $("stage-label").innerHTML = '<span class="stage-n">' + n + '</span> / ' + STAGE_LABELS[name];
}

function showStage(name) {
  if (name === "plan" && routine.selection.isEmpty()) name = "targets";
  for (const [key, el] of Object.entries(STAGES)) el.hidden = key !== name;
  paintStageLabel(name);
  for (const b of document.querySelectorAll(".step"))
    if (b.dataset.goto === name) b.setAttribute("aria-current", "step");
    else b.removeAttribute("aria-current");
  if (name === "plan") {
    buildControls();           // the nutrition stage may have changed sessions or length
    renderTargetsMini();
    renderNutritionMini();
    render();                  // the plan's summary shows the day's targets too
    warnIfStale();
  } else if (name === "nutrition") {
    renderNutritionStage();
  } else {
    renderTargets();
  }
  window.scrollTo({ top: 0 });
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-goto]");
  if (b && !b.disabled) showStage(b.dataset.goto);
});

/* The Week plan step is only reachable once something is selected. */
function paintSteps() {
  for (const b of document.querySelectorAll('button[data-goto="plan"]'))
    b.disabled = routine.selection.isEmpty();
}
routine.selection.onChange(paintSteps);

/* -------------------------------- actions -------------------------------- */

/* The week plan's controls write straight to the routine, so the nutrition
   stage (whose estimate reads sessions and length) and the targets estimate
   always see what is on screen. The nutrition summary follows at once. */
for (const id of ["len", "sessions", "window", "showmeals"])
  $(id).addEventListener("change", () => {
    readControls();
    renderNutritionMini();
    renderNutrition();
    renderWorkouts();
    warnIfStale();
  });

/* What the grid on screen was generated from, to spot a stale week: the
   muscles, how many days of what length were asked for, the days off, the
   preferred window, whether meals go on the calendar, the training days the
   week can hold, and the meals it placed (time, calories and protein, as
   the grid shows them) and kept sessions away from. Painting over a session
   or removing one is an edit, not a changed input; see weekEdited(). */
let generatedFor = null, placedCount = 0;
function planInputs() {
  const n = routine.nutrition;
  return routine.selection.muscles().map(m => m.id).join() + "|" +
         routine.sessionsPerWeek + "x" + routine.sessionMinutes + "|" +
         [...routine.offDays].sort().join() + "|" + routine.preferredWindow + "|" +
         n.showMeals + "|" + routine.plannedSessions() + "|" +
         (n.isValid() ? n.meals.map(m => m.hour + ":" + m.kcal + ":" + m.protein).join() : "");
}
const days = n => n + (n === 1 ? " day" : " days");
const timesText = n => ({ 1: "once", 2: "twice", 3: "three times" })[n] || n + " times";

/**
 * After a session leaves the week by the user's hand — removed, painted
 * over, or its day marked off — the status says what the week now holds.
 * Returns true if it did.
 */
function weekEdited() {
  if (!generatedFor || routine.sessions.length === placedCount) return false;
  placedCount = routine.sessions.length;
  setStatus("Your week now has " + days(placedCount) + " of training after your edits." +
    (generatedFor !== planInputs() ? " Your daily targets changed with it; generate again " +
      "to update the meals on the calendar." : ""), "warn");
  return true;
}
function warnIfStale() {
  if (generatedFor && routine.sessions.length && generatedFor !== planInputs())
    setStatus("Your targets, training or nutrition changed since this week was generated. " +
              "Generate again to plan for them.", "warn");
}

/* A day toggle paints or clears that whole column of the grid; what the
   training and diet can use follows at once. */
$("off-days").addEventListener("click", e => {
  const b = e.target.closest("[data-off]");
  if (!b) return;
  routine.setDayUnavailable(b.dataset.off, !routine.isDayUnavailable(b.dataset.off));
  render();
  renderNutritionMini();
  weekEdited() || warnIfStale();
});

$("generate").addEventListener("click", () => {
  readControls();
  const r = routine.generate();
  generatedFor = planInputs();
  placedCount = routine.sessions.length;
  render();

  const mealNote = r.meals ? " " + r.meals + " meals added to the week." : "";
  const exercises = routine.sessions.reduce((t, s) => t + s.workout.entries.length, 0);
  const exNote = exercises ? " with " + exercises + " exercises" : "";

  switch (r.reason) {
    case "ok":
      setStatus("Planned " + days(r.placed) + " of training" + exNote + "." + mealNote);
      break;
    case "rest": {
      const spare = Math.min(r.requested, r.free) - r.placed;
      setStatus("Planned " + days(r.placed) + " of training" + exNote + "." + mealNote +
        " Your targets are best trained about " + timesText(ESTIMATE.timesPerWeek) +
        " a week each" + (spare > 0 ? ", so the other " + days(spare) + " you offered " +
        (spare === 1 ? "is a rest day." : "are rest days.") : "."));
      break;
    }
    case "days":
      setStatus("Planned " + days(r.placed) + " of training" + exNote + " — every day you " +
        "have free." + mealNote + " Free up " + (r.requested - r.placed === 1 ? "another day"
        : (r.requested - r.placed) + " more days") + " to train " + days(r.requested) + ".", "warn");
      break;
    case "partial":
      setStatus("Planned " + days(r.placed) + " of the " + days(r.requested) + " you asked for." +
        mealNote + " The rest were left out: either no free day had a long enough " +
        "gap, or every remaining muscle was still inside its recovery window.", "warn");
      break;
    case "no-muscles":
      setStatus("Pick at least one muscle first.", "err");
      break;
    case "no-exercises":
      setStatus("None of your target muscles have exercises in the database yet, so there " +
        "is nothing to schedule. Add a muscle such as Chest, Lats or Quads.", "err");
      break;
    case "no-room":
      setStatus("No free gap is long enough for a " + routine.sessionMinutes + "-minute session. " +
        "Clear some hours or shorten the session.", "err");
      break;
    case "no-blocks":
      setStatus("Every hour is blocked. Free some days or clear some cells and try again.", "err");
      break;
    default:
      setStatus("Nothing could be placed without breaking a recovery window. " +
        "Free up more hours, select more muscles, or shorten the session.", "err");
  }
});

$("reset").addEventListener("click", () => {
  routine.reset();
  buildControls();
  render();
  renderNutritionMini();       // reset puts sessions and length back, which the targets use
  setStatus("Cleared. Click or drag across the grid to block the hours you are " +
            "not available.");
});


/* --------------------------------- theme --------------------------------- */

/* Light is the primary design, so the page always opens in it; dark is one
   click away. */
const root = document.documentElement;

function paintThemeButton() {
  const dark = root.dataset.theme === "dark";
  $("theme-icon").textContent = dark ? "☀" : "☾";
  $("theme-label").textContent = dark ? "Light" : "Dark";
}
$("theme").addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  paintThemeButton();
});

/* ---------------------------------- boot --------------------------------- */

paintThemeButton();
buildOffDays();
buildControls();
buildGrid();
paintSteps();
showStage("targets");
