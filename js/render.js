/* =========================================================================
   Presentation
   ========================================================================= */

const routine = new WeeklyRoutine();

const $ = id => document.getElementById(id);
const gridEl = $("grid"), musclesEl = $("muscles"), statusEl = $("status"),
      nutriEl = $("nutri");

function hourLabel(h) {
  const s = h < 12 ? "am" : "pm";
  return (h % 12 === 0 ? 12 : h % 12) + s;
}

/* ------------------------------- controls -------------------------------- */

function buildControls() {
  musclesEl.innerHTML = "";
  for (const key of ["push", "pull", "legs", "core"]) {
    const head = document.createElement("div");
    head.className = "fam-label";
    head.innerHTML = '<span class="dot" style="background:var(--' + key + ')"></span>' +
                     FAMILIES[key].name;
    musclesEl.appendChild(head);

    for (const muscle of routine.muscles.filter(m => m.family === key)) {
      const row = document.createElement("label");
      row.className = "muscle";
      row.innerHTML = '<input type="checkbox" ' + (muscle.selected ? "checked" : "") + '>' +
                      '<span>' + muscle.name + '</span>' +
                      '<span class="mins">' + muscle.minutes + 'm</span>';
      row.querySelector("input").addEventListener("change", e => {
        muscle.selected = e.target.checked;
      });
      musclesEl.appendChild(row);
    }
  }
  $("len").value = routine.sessionMinutes;
  $("sessions").value = routine.sessionsPerWeek;
  $("window").value = routine.preferredWindow;
  $("weight").value = routine.nutrition.weight;
  $("unit").value = routine.nutrition.unit;
  $("goal").value = routine.nutrition.goal;
  $("mealcount").value = routine.nutrition.mealsPerDay;
  $("showmeals").checked = routine.nutrition.showMeals;
}

function readControls() {
  routine.sessionMinutes = Number($("len").value);
  routine.sessionsPerWeek = Math.max(1, Math.min(14, Number($("sessions").value) || 1));
  $("sessions").value = routine.sessionsPerWeek;
  routine.preferredWindow = $("window").value;
  const n = routine.nutrition;
  n.weight = Number($("weight").value) || 0;
  n.unit = $("unit").value;
  n.goal = $("goal").value;
  n.mealsPerDay = Math.max(3, Math.min(5, Number($("mealcount").value) || 3));
  $("mealcount").value = n.mealsPerDay;
  n.showMeals = $("showmeals").checked;
}

/* --------------------------------- grid ---------------------------------- */

function buildGrid() {
  gridEl.innerHTML = "";
  const corner = document.createElement("div");
  corner.className = "corner";
  gridEl.appendChild(corner);

  for (const day of DayOfWeek.values) {
    const h = document.createElement("div");
    h.className = "head"; h.textContent = DayOfWeek.label[day];
    gridEl.appendChild(h);
  }
  for (let hour = routine.firstHour; hour <= routine.lastHour; hour++) {
    const lab = document.createElement("div");
    lab.className = "hour"; lab.textContent = hourLabel(hour);
    gridEl.appendChild(lab);
    for (const day of DayOfWeek.values) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.day = day; cell.dataset.hour = hour;
      cell.setAttribute("role", "gridcell");
      gridEl.appendChild(cell);
    }
  }
  render();
}

function render() { renderGrid(); renderNutrition(); }

/**
 * Repaints the grid. A cell is only touched when its rendered content actually
 * changed — during a drag this runs on every pointermove, and rewriting 126
 * cells each time was slow enough to make the browser drop move events.
 */
function renderGrid() {
  for (const cell of gridEl.querySelectorAll(".cell")) {
    const slot = routine.slot(cell.dataset.day, Number(cell.dataset.hour));

    const sig = slot.state === SlotState.WORKOUT
        ? "W" + slot.session.id + ":" + slot.hour
        : slot.state === SlotState.MEAL ? "M" + slot.meal.id : slot.state;
    if (cell.dataset.sig === sig) continue;
    cell.dataset.sig = sig;

    cell.className = "cell";
    cell.innerHTML = "";
    const where = DayOfWeek.label[slot.day] + " " + hourLabel(slot.hour);

    if (slot.state === SlotState.BUSY) {
      cell.classList.add("busy");
      cell.setAttribute("aria-label", where + ", busy");

    } else if (slot.state === SlotState.WORKOUT) {
      const s = slot.session, first = slot.hour === s.startHour;
      cell.classList.add(s.block.css);
      if (!first) cell.classList.add("cont");
      cell.innerHTML = '<span class="bar"></span>' +
        (first
          ? '<span class="t1">' + s.block.label + '</span>' +
            '<span class="t2">' + s.block.minutes + ' min · ' +
              FAMILIES[s.block.family].name + '</span>'
          : '<span class="t2">…continues</span>');
      cell.setAttribute("aria-label",
        where + ", " + s.block.label + " session, " + s.block.minutes + " minutes");

    } else if (slot.state === SlotState.MEAL) {
      const m = slot.meal;
      cell.classList.add("meal");
      cell.innerHTML = '<span class="bar"></span>' +
        '<span class="t1">' + m.name + '</span>' +
        '<span class="t2">' + m.kcal + ' kcal · ' + m.protein + 'g P</span>';
      cell.setAttribute("aria-label",
        where + ", " + m.name + ", " + m.kcal + " calories, " + m.protein + " grams protein");

    } else {
      cell.setAttribute("aria-label", where + ", free");
    }
  }
}

function renderNutrition() {
  const n = routine.nutrition;
  if (!n.isValid()) {
    nutriEl.innerHTML = '<h3>Nutrition</h3><p class="empty-nutri">Enter a body ' +
      'weight between 30 and 250 kg (66–550 lb) to see your daily targets.</p>';
    return;
  }
  const rows = n.meals.map(m => {
    const placedToday = routine.plannedMeals.filter(p => p.name === m.name && p.day === "MON");
    const at = placedToday.length ? hourLabel(placedToday[0].hour) : hourLabel(m.hour);
    return '<tr><td class="name">' + m.name + '</td><td>' + at + '</td><td>' +
           m.kcal + ' kcal</td><td>' + m.protein + ' g</td>' +
           '<td class="food">' + m.focus + '</td></tr>';
  }).join("");

  nutriEl.innerHTML =
    '<h3>Nutrition</h3>' +
    '<p class="note">Estimated from body weight and goal. A rough target to eat ' +
    'against, not a prescription — age, height and activity level would move ' +
    'these numbers.</p>' +
    '<div class="stats">' +
      '<div class="stat"><div class="k">Daily calories</div>' +
        '<div class="v">' + n.kcal + ' <span class="u">kcal</span></div></div>' +
      '<div class="stat"><div class="k">Daily protein</div>' +
        '<div class="v">' + n.protein + ' <span class="u">g</span></div></div>' +
      '<div class="stat"><div class="k">Goal</div>' +
        '<div class="v" style="font-size:17px">' + GOALS[n.goal].label + '</div></div>' +
      '<div class="stat"><div class="k">Meals placed</div>' +
        '<div class="v">' + routine.plannedMeals.length +
        ' <span class="u">this week</span></div></div>' +
    '</div>' +
    '<table class="meals"><thead><tr><th>Meal</th><th>Around</th><th>Calories</th>' +
    '<th>Protein</th><th>Build it from</th></tr></thead><tbody>' + rows +
    '</tbody></table>';
}

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = "status" + (kind ? " " + kind : "");
}
