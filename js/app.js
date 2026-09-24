/* -------------------------------- stages --------------------------------- */

/* Targets, then nutrition, then the week. Stages are hidden rather than
   rebuilt, so the grid the user painted survives a trip back to change the
   muscles or the eating plan. */
const STAGES = { targets: $("stage-targets"), nutrition: $("stage-nutrition"),
                 plan: $("stage-plan") };

function showStage(name) {
  if (name === "plan" && routine.selection.isEmpty()) name = "targets";
  for (const [key, el] of Object.entries(STAGES)) el.hidden = key !== name;
  for (const b of document.querySelectorAll(".step"))
    if (b.dataset.goto === name) b.setAttribute("aria-current", "step");
    else b.removeAttribute("aria-current");
  if (name === "plan") {
    readControls();
    renderTargetsMini();
    renderNutritionMini();
    renderNutrition();
    if (generatedFor && routine.sessions.length && generatedFor !== planInputs())
      setStatus("Your targets or nutrition changed since this week was generated. " +
                "Generate again to plan for them.", "warn");
  } else if (name === "nutrition") {
    renderNutritionStage();
  } else {
    readControls();            // the estimate uses the session length
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
  document.querySelector('.step[data-goto="plan"]').disabled = routine.selection.isEmpty();
}
routine.selection.onChange(paintSteps);

/* -------------------------------- actions -------------------------------- */

/* What the grid on screen was generated from, to spot a stale week: the
   muscles, and the meals it placed (time, calories and protein, as the grid
   shows them) and kept sessions away from. */
let generatedFor = null;
function planInputs() {
  const n = routine.nutrition;
  return routine.selection.muscles().map(m => m.id).join() + "|" +
         (n.isValid() ? n.meals.map(m => m.hour + ":" + m.kcal + ":" + m.protein).join() : "");
}

$("generate").addEventListener("click", () => {
  readControls();
  const r = routine.generate();
  generatedFor = planInputs();
  render();

  const mealNote = r.meals ? " " + r.meals + " meals added to the week." : "";
  const plural = n => n === 1 ? "session" : "sessions";
  const exercises = routine.sessions.reduce((t, s) => t + s.workout.entries.length, 0);
  const exNote = exercises ? " with " + exercises + " exercises" : "";

  switch (r.reason) {
    case "ok":
      setStatus("Placed " + r.placed + " " + plural(r.placed) + exNote + "." + mealNote);
      break;
    case "partial":
      setStatus("Placed " + r.placed + " of " + r.requested + " " +
        plural(r.requested) + "." + mealNote + " The rest were left out: either " +
        "no free block was long enough, or every remaining muscle was still " +
        "inside its recovery window.", "warn");
      break;
    case "no-muscles":
      setStatus("Pick at least one muscle first.", "err");
      break;
    case "no-blocks":
      setStatus("Every hour is blocked. Clear some cells and try again.", "err");
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
  setStatus("Cleared. Click or drag across the grid to block the hours you are " +
            "not available.");
});


/* --------------------------------- theme --------------------------------- */

const root = document.documentElement;
if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)
  root.dataset.theme = "dark";

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
buildControls();
buildGrid();
paintSteps();
showStage("targets");
