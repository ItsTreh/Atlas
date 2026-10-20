/* -------------------------------- stages --------------------------------- */

/* Moving between stages is stages.js's; Targets registers itself
   (targets.js). Nutrition and the Week plan are drawn here until their
   redesigns land: full-screen panels over the sculpture, which recedes
   behind them. Stages are hidden rather than rebuilt, so the grid the user
   painted survives a trip back to change the muscles or the eating plan. */
Stages.register("nutrition", {
  enter: renderNutritionStage,
  shot: () => "nutrition",
  dim: () => 0,
  focus: () => $("nutrition-title"),
  footer: () => ({
    back: "← Targets",
    skip: routine.selection.isEmpty() ? "" : Stages.narrow ? "Skip" : "Skip, training only",
    next: Stages.narrow ? "Week plan →" : "Continue to week plan →",
    nextDisabled: routine.selection.isEmpty()
  })
});

Stages.register("plan", {
  enter() {
    buildControls();           // the nutrition stage may have changed sessions or length
    renderTargetsMini();
    renderNutritionMini();
    render();                  // the plan's summary shows the day's targets too
    warnIfStale();
  },
  shot: () => "plan",
  dim: () => 0,
  focus: () => $("plan-title"),
  footer: () => ({ back: "← Nutrition" })
});

routine.selection.onChange(() => saveRoutine(routine));
routine.selection.onChange(renderWeekTargets);
routine.selection.onChange(renderWeekFit);

/* -------------------------------- actions -------------------------------- */

/* The week plan's controls write straight to the routine, so the nutrition
   stage (whose estimate reads sessions and length) and the targets estimate
   always see what is on screen. The nutrition summary follows at once. */
for (const id of ["len", "sessions", "split", "window", "showmeals"])
  $(id).addEventListener("change", () => {
    readControls();
    renderWeekTargets();
    renderWeekFit();
    renderTargets();
    renderSplitNote();
    renderNutritionMini();
    renderNutrition();
    renderWorkouts();
    warnIfStale();
    saveRoutine(routine);
  });

/* The fit note above the training days follows the days as they are typed.
   Left to "change", it would grow or shrink on the tap that blurs the field,
   moving Generate out from under that tap on a phone. */
$("sessions").addEventListener("input", () => {
  const n = Number($("sessions").value), [lo, hi] = TRAINING_DAYS_RANGE;
  if (!Number.isInteger(n) || n < lo || n > hi) return;
  routine.sessionsPerWeek = n;
  renderWeekFit();
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
         routine.sessionsPerWeek + "x" + routine.sessionMinutes + "|" + routine.split + "|" +
         [...routine.offDays].sort().join() + "|" + routine.preferredWindow + "|" +
         n.showMeals + "|" + routine.plannedSessions() + "|" +
         (n.isValid() ? n.meals.map(m => m.hour + ":" + m.kcal + ":" + m.protein).join() : "");
}
const days = n => n + (n === 1 ? " day" : " days");

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
      const restDays = spare > 0 ? ", so the other " + days(spare) + " you offered " +
        (spare === 1 ? "is a rest day." : "are rest days.") : ".";
      // A repeat taken out for having too little to do (buildWorkouts): the
      // weekly sets already fit, which is the reason, not how often to train.
      setStatus("Planned " + days(r.placed) + " of training" + exNote + "." + mealNote +
        (r.dropped
          ? " The weekly sets for the muscles you selected already fit in " + r.placed +
            (r.placed === 1 ? " session" : " sessions") + " — another would have been " +
            "nearly empty" + restDays
          : spare > 0 ? " Your targets are covered without the other " + days(spare) + " you offered, " +
            (spare === 1 ? "so it is a rest day." : "so they are rest days.") : ""));
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

  // A split whose days the selection leaves empty repeats the days it has,
  // and recovery can then hold the week below the days asked for. Say that,
  // and which split would fit, rather than a bare "partial". Not when dropped
  // repeats are the reason the week is shorter: the status above says that.
  const empty = routine.emptySplitDays();
  if (r.placed && r.placed < Math.min(r.requested, r.free) && empty.length &&
      !(r.dropped && r.reason === "rest")) {
    const kept = SPLITS[routine.split].days.map(([name]) => name).filter(n => !empty.includes(n));
    // A split with an empty day of its own still fits by repeating the days
    // it has, so say that rather than let it read as a contradiction.
    const fits = routine.splitsThatFit().map(id => {
      const gaps = routine.emptySplitDays(id);
      if (!gaps.length) return SPLITS[id].label + " fits your selection";
      const used = SPLITS[id].days.map(([name]) => name).filter(n => !gaps.includes(n));
      return SPLITS[id].label + " would fit: with nothing for " + gaps.join(" or ") +
        ", it alternates " + used.join(" and ");
    });
    setStatus("Nothing you selected goes on " + empty.join(" or ") + " days, so the week repeats " +
      kept.join(" and ") + ", which needs rest days between: " + r.placed + " of the " +
      days(r.requested) + " fit." + (fits.length ? " " + fits.join("; ") + "." : ""),
      "warn");
  }

  // Blocks the plan could not give a day (Push · Pull · Legs over 2 days):
  // named here, with what would change it, rather than left out silently.
  const left = leftOutText();
  if (left) setStatus($("status").textContent + " " + left, "warn");

  // A week that falls short of what the targets usually need says so here
  // too, not only in the note under Your week.
  if (r.placed) {
    const v = routine.weeklyVolume();
    if (v.untrained.length || v.short.length)
      setStatus($("status").textContent + " Some muscles get less than they usually need " +
                "this week — see the note under Your week.", "warn");
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

/* Bring back whatever was saved (see storage.js) before anything else reads
   the routine, so the controls below are built from the restored values,
   not the defaults. A restored week counts as generated already, the same
   bookkeeping the Generate button does, so an edit right after loading is
   correctly seen as an edit rather than a silent, unflagged change. */
const restored = loadRoutine(routine);
if (restored && routine.sessions.length) {
  generatedFor = planInputs();
  placedCount = routine.sessions.length;
}

paintThemeButton();
buildOffDays();
buildControls();
buildGrid();
Stages.start(restored && routine.sessions.length ? "plan"
           : restored && !routine.selection.isEmpty() ? "nutrition"
           : "targets");
