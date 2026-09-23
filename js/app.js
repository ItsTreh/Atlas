/* -------------------------------- stages --------------------------------- */

/* Targets first, then the week. Stage 2 is hidden rather than rebuilt, so the
   grid the user painted survives a trip back to change the muscles. */
const STAGES = { targets: $("stage-targets"), plan: $("stage-plan") };

function showStage(name) {
  if (name === "plan" && routine.selection.isEmpty()) name = "targets";
  for (const [key, el] of Object.entries(STAGES)) el.hidden = key !== name;
  for (const b of document.querySelectorAll(".step"))
    if (b.dataset.goto === name) b.setAttribute("aria-current", "step");
    else b.removeAttribute("aria-current");
  if (name === "plan") {
    readControls();
    renderTargetsMini();
    if (generatedFor && routine.sessions.length &&
        generatedFor !== routine.selection.muscles().map(m => m.id).join())
      setStatus("Your target muscles changed since this week was generated. " +
                "Generate again to plan for the new selection.", "warn");
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

/* Which muscles the grid on screen was generated for, to spot a stale week. */
let generatedFor = null;

$("generate").addEventListener("click", () => {
  readControls();
  const r = routine.generate();
  generatedFor = routine.selection.muscles().map(m => m.id).join();
  render();

  const mealNote = r.meals ? " " + r.meals + " meals added to the week." : "";
  const plural = n => n === 1 ? "session" : "sessions";

  switch (r.reason) {
    case "ok":
      setStatus("Placed " + r.placed + " " + plural(r.placed) + "." + mealNote);
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

for (const id of ["weight", "unit", "goal", "mealcount"])
  $(id).addEventListener("change", () => { readControls(); renderNutrition(); });

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
