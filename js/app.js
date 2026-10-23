/* -------------------------------- stages --------------------------------- */

/* Moving between stages is stages.js's. Each stage registers itself:
   targets.js, nutrition-view.js and week-view.js. Stages are hidden rather
   than rebuilt, so the hours the user painted survive a trip back to change
   the muscles or the eating plan. */

/* ------------------------------- the week -------------------------------- */

/* What the week on screen was generated from (routine.inputsKey and
   mealsKey), to spot a stale week. A changed input means the week no longer
   answers what was asked. Painting over a session or removing one is an
   edit, not a changed input (see weekEdited()), though it can leave the
   meals on the calendar out of date: a day fewer to fuel. */
let generatedFor = null, placedCount = 0;
function planInputs() { return { inputs: routine.inputsKey(), meals: routine.mealsKey() }; }
const days = n => n + (n === 1 ? " day" : " days");
/** Weekdays as a short list, runs joined: "Mon–Fri", "Mon, Wed and Sun". */
function dayList(list) {
  const idx = list.map(d => DayOfWeek.indexOf(d)).sort((a, b) => a - b), runs = [];
  for (const i of idx) {
    const run = runs[runs.length - 1];
    if (run && i === run[1] + 1) run[1] = i; else runs.push([i, i]);
  }
  const names = runs.map(([a, b]) => DayOfWeek.label[DayOfWeek.values[a]] +
    (b > a + 1 ? "–" + DayOfWeek.label[DayOfWeek.values[b]] : b > a ? ", " + DayOfWeek.label[DayOfWeek.values[b]] : ""));
  return names.length < 2 ? names.join("") : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

/** True when the week on screen was generated from inputs that have since changed. */
function weekIsStale() {
  return !!generatedFor && routine.sessions.length > 0 && generatedFor.inputs !== routine.inputsKey();
}
/** True when the meals on the calendar no longer match the daily targets. */
function mealsOutdated() {
  return !!generatedFor && routine.sessions.length > 0 && generatedFor.meals !== routine.mealsKey();
}

/**
 * After a session leaves the week by the user's hand — removed, painted
 * over, or its day marked off — the status says what the week now holds.
 * Returns true if it did.
 */
function weekEdited() {
  if (!generatedFor || routine.sessions.length === placedCount) return false;
  placedCount = routine.sessions.length;
  setStatus("Your week now has " + days(placedCount) + " of training after your edits." +
    (mealsOutdated() ? " Your daily targets changed with it; generate again " +
      "to update the meals on the calendar." : ""), "warn");
  return true;
}
function warnIfStale() {
  if (weekIsStale())
    setStatus("Your targets, training or nutrition changed since this week was generated. " +
              "Generate again to plan for them.", "warn");
}

/**
 * Generates the week (routine.generate) and says what happened: how many
 * days, why fewer than asked if so, and which split would fit better. The
 * message goes to the week's status (setStatus, week-view.js).
 */
function generateWeek() {
  const r = routine.generate();
  generatedFor = planInputs();
  placedCount = routine.sessions.length;

  // A meal no hour near its time was free for, on some days, is named:
  // those days carry less than the daily targets on the calendar.
  const missed = routine.missedMeals.map(m => m.name + " on " + dayList(m.days)).join("; ");
  const mealNote = (r.meals ? " " + r.meals + " meals added to the week." : "") +
    (missed ? " No free hour near its time for " + missed + ", so those days show less to eat." : "");
  const exercises = routine.sessions.reduce((t, s) => t + s.workout.entries.length, 0);
  const exNote = exercises ? " with " + exercises + (exercises === 1 ? " exercise" : " exercises") : "";
  let text, kind = "";

  switch (r.reason) {
    case "ok":
      text = "Planned " + days(r.placed) + " of training" + exNote + "." + mealNote;
      break;
    case "rest": {
      const spare = Math.min(r.requested, r.free) - r.placed;
      const restDays = spare > 0 ? ", so the other " + days(spare) + " you offered " +
        (spare === 1 ? "is a rest day." : "are rest days.") : ".";
      // A repeat taken out for having too little to do (buildWorkouts): the
      // weekly sets already fit, which is the reason, not how often to train.
      text = "Planned " + days(r.placed) + " of training" + exNote + "." + mealNote +
        (r.dropped
          ? " The weekly sets for the muscles you selected already fit in " + r.placed +
            (r.placed === 1 ? " session" : " sessions") + " — another would have been " +
            "nearly empty" + restDays
          : spare > 0 ? " Your targets are covered without the other " + days(spare) + " you offered, " +
            (spare === 1 ? "so it is a rest day." : "so they are rest days.") : "");
      break;
    }
    case "days":
      text = "Planned " + days(r.placed) + " of training" + exNote + " — every day you " +
        "have free." + mealNote + " Free up " + (r.requested - r.placed === 1 ? "another day"
        : (r.requested - r.placed) + " more days") + " to train " + days(r.requested) + ".";
      kind = "warn";
      break;
    case "partial":
      text = "Planned " + days(r.placed) + " of the " + days(r.requested) + " you asked for." +
        mealNote + " The rest were left out: either no free day had a long enough " +
        "gap, or every remaining muscle was still inside its recovery window.";
      kind = "warn";
      break;
    case "no-muscles":
      text = "Pick at least one muscle first."; kind = "err";
      break;
    case "no-exercises":
      text = "None of your target muscles have exercises in the database yet, so there " +
        "is nothing to schedule. Add a muscle such as Chest, Lats or Quads."; kind = "err";
      break;
    case "no-room":
      text = "No free gap is long enough for a " + routine.sessionMinutes + "-minute session. " +
        "Clear some hours or shorten the session."; kind = "err";
      break;
    case "no-blocks":
      text = routine.offDays.size === DayOfWeek.values.length
        ? "Every day is marked off. Turn a day back on and try again."
        : "Every hour is blocked. Free some days or clear some hours and try again.";
      kind = "err";
      break;
    default:
      text = "Nothing could be placed without breaking a recovery window. " +
        "Free up more hours, select more muscles, or shorten the session."; kind = "err";
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
    text = "Nothing you selected goes on " + empty.join(" or ") + " days, so the week repeats " +
      kept.join(" and ") + ", which needs rest days between: " + r.placed + " of the " +
      days(r.requested) + " fit." + (fits.length ? " " + fits.join("; ") + "." : "");
    kind = "warn";
  }

  // A week that falls short of what the targets usually need says so here
  // too, not only in the notes under the summary.
  if (r.placed) {
    const v = routine.weeklyVolume();
    if (v.untrained.length || v.short.length) {
      text += " Some muscles get less than they usually need this week — see the notes below.";
      kind = kind || "warn";
    }
  }
  render();
  return { text, kind, placed: r.placed };
}

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
   the routine, so every stage is drawn from the restored values, not the
   defaults. A restored week counts as generated already, the same
   bookkeeping Generate does, so an edit right after loading is correctly
   seen as an edit rather than a silent, unflagged change. */
const restored = loadRoutine(routine);
if (restored && routine.sessions.length) {
  generatedFor = planInputs();
  placedCount = routine.sessions.length;
}
/* Saving follows the selection only from here on. Restoring the selection
   tells its listeners, and a save at that point would store the routine
   half restored: the muscles, with every other setting still at its
   default. Saving once now also replaces any stored value restore() had to
   drop. */
routine.selection.onChange(() => saveRoutine(routine));
if (restored) saveRoutine(routine);

paintThemeButton();
/* The page opens where the user was (storage.js, loadPlace): a first visit
   on Targets, at How it works. A new visit is greeted by the start screen
   (start.js) when the sculpture can move its camera: the stage is drawn
   beneath it, held, and comes in as it hands over. A reload goes straight
   back. */
const savedPlace = restored ? loadPlace() : null;
Stages.start(savedPlace ? savedPlace.stage : "targets", StartScreen.plays(newVisit()), savedPlace && savedPlace.at);
StartScreen.play();
