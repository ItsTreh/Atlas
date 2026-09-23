/* -------------------------------- actions -------------------------------- */

$("generate").addEventListener("click", () => {
  readControls();
  const r = routine.generate();
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
