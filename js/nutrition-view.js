/* ===========================================================================
   Nutrition stage — configure the eating plan.

   Left, the settings: goal and the targets it recommends, the training the
   diet fuels, body weight, daily burn, eating rhythm and diet style. Right,
   the plan they produce and how each input shaped it, redrawn on every
   change. Below, the day as meal cards with example plates portioned to
   each meal.

   Everything is read from and written to routine.nutrition (nutrition.js);
   the goals, activity levels, meal patterns, diets and meal ideas all come
   from data, so adding one there adds it here.
   ========================================================================= */

const nutrition = () => routine.nutrition;
const nplanEl = $("nplan"), nmealsEl = $("nmeals");
const fmtK = n => n.toLocaleString("en-US");

/* Which example plates each meal card shows: an offset into its ranked list. */
const ideaOffset = {};

/* ------------------------------ configurator ----------------------------- */

function buildNutritionControls() {
  $("goal-cards").innerHTML = Object.entries(GOALS).map(([key, g]) =>
    '<button type="button" class="goal-card" role="radio" data-goal="' + key + '">' +
      '<span class="gc-top"><span class="gc-name">' + g.label + '</span>' +
      '<span class="gc-adj"></span></span>' +
      '<span class="gc-blurb">' + g.blurb + '</span>' +
    '</button>').join("");

  $("activity-chips").innerHTML = Object.entries(ACTIVITY_LEVELS).map(([key, a]) =>
    '<button type="button" class="chip-btn" role="radio" data-activity="' + key + '" ' +
      'title="' + a.hint + '">' + a.label + '</button>').join("");

  $("meal-counts").innerHTML = MEAL_COUNTS.map(n =>
    '<button type="button" class="seg-btn" role="radio" data-meals="' + n + '" ' +
      'aria-label="' + n + ' meals">' + n + '</button>').join("");

  $("diet-seg").innerHTML = Object.entries(DIETS).map(([key, d]) =>
    '<button type="button" class="seg-btn" role="radio" data-diet="' + key + '">' +
      d.label + '</button>').join("");

  const hourOptions = (from, to) => Array.from({ length: to - from + 1 }, (_, i) =>
    '<option value="' + (from + i) + '">' + hourLabel(from + i) + '</option>').join("");
  $("first-meal").innerHTML = hourOptions(FIRST_HOUR, 13);
  $("last-meal").innerHTML = hourOptions(14, LAST_HOUR);

  // The same choices as the week plan's controls, which edit the same numbers.
  $("n-sessions").innerHTML = Array.from({ length: 14 }, (_, i) =>
    '<option value="' + (i + 1) + '">' + (i + 1) + '</option>').join("");
  $("n-len").innerHTML = $("len").innerHTML;
}

function adjustLabel(adjust) {
  if (!adjust) return "= your burn";
  return (adjust > 0 ? "+" : "−") + Math.round(Math.abs(adjust) * 100) + "%";
}
const fmtGkg = v => v.toFixed(1);

/* Rewrites an element only when its content changes. A field's change event
   fires on blur, just before the click that caused it; replacing the link
   under the pointer then would swallow that click. */
function setHTML(el, html) { if (el.innerHTML !== html) el.innerHTML = html; }

/** Brings every control in line with the plan. Never rebuilds them, so focus stays put. */
function paintNutritionControls() {
  const n = nutrition();
  const mark = (sel, on) => { for (const b of document.querySelectorAll(sel)) {
    const active = on(b);
    b.classList.toggle("on", active);
    b.setAttribute("aria-checked", active ? "true" : "false");
  }};
  mark("[data-goal]", b => b.dataset.goal === n.goal);
  // Each goal shows what it would recommend for this training, not a fixed number.
  for (const b of document.querySelectorAll("[data-goal]"))
    b.querySelector(".gc-adj").textContent =
      adjustLabel(recommendTargets(b.dataset.goal, n.load).adjust);
  mark("[data-activity]", b => n.burnIsEstimate && b.dataset.activity === n.activity);
  mark("[data-meals]", b => Number(b.dataset.meals) === n.mealsPerDay);
  mark("[data-diet]", b => b.dataset.diet === n.diet);
  mark("[data-unit]", b => b.dataset.unit === n.unit);
  for (const b of document.querySelectorAll("[data-meals]"))
    b.classList.toggle("suggested", Number(b.dataset.meals) === n.suggestedMeals);

  // Without a weight there is nothing to estimate from, so both fields stay empty.
  const estimateless = n.burnIsEstimate && !n.isValid();
  if (document.activeElement !== $("n-weight")) $("n-weight").value = n.weight ?? "";
  if (document.activeElement !== $("n-burn")) $("n-burn").value = estimateless ? "" : n.burn;
  setHTML($("burn-source"), estimateless
    ? '<span class="src est">Estimate</span> needs your body weight. Know your number? Type it in.'
    : n.burnIsEstimate
    ? '<span class="src est">Estimate</span> from ' + fmtWeight(n) + ', ' +
      ACTIVITY_LEVELS[n.activity].label.toLowerCase() + ' outside training' +
      (n.load.kcalPerDay ? ', plus your training' : '') + '. Know your number? Type it in.'
    : '<span class="src own">Your number</span> Include your training in it. ' +
      '<button type="button" class="link-btn" id="burn-reset">Estimate it for me instead</button>');
  $("first-meal").value = n.firstMeal;
  $("last-meal").value = n.lastMeal;
  paintTargets();
  paintTraining();
  paintTimeline();
}

/** The two targets the goal recommends, and whether the user has changed them. */
function paintTargets() {
  const n = nutrition();
  const rec = n.recommended;
  const goal = GOALS[n.goal].label.toLowerCase();
  $("n-adjust").textContent = adjustLabel(n.adjust);
  $("n-protein").textContent = fmtGkg(n.proteinPerKg);
  setHTML($("adjust-source"), n.adjustIsRecommended
    ? '<span class="src est">Recommended</span> for ' + goal + ' with your training.'
    : '<span class="src own">Your setting</span> Recommended: ' + adjustLabel(rec.adjust) + '. ' +
      '<button type="button" class="link-btn" data-tune-reset="adjust">Use it</button>');
  setHTML($("protein-source"), n.proteinIsRecommended
    ? '<span class="src est">Recommended</span> for ' + goal + ' with your training.'
    : '<span class="src own">Your setting</span> Recommended: ' + fmtGkg(rec.protein) + ' g/kg. ' +
      '<button type="button" class="link-btn" data-tune-reset="protein">Use it</button>');
}

/** What the diet is fuelling: the targets from stage 1, and how often they are trained. */
function paintTraining() {
  const n = nutrition();
  const load = n.load;
  const muscles = routine.selectedMuscles();
  const src = routine.selection.source();
  const name = src.kind === "program" ? src.program.name
             : src.kind === "modified" ? src.program.name + " (edited)" : "Your own selection";
  setHTML($("n-training"), muscles.length
    ? '<b>' + esc(name) + '</b> · ' + muscles.length + (muscles.length === 1 ? " muscle" : " muscles") +
      ' <button type="button" class="link-btn" data-goto="targets">Change</button>'
    : 'No target muscles yet, so no training is counted. ' +
      '<button type="button" class="link-btn" data-goto="targets">Pick targets</button>');
  $("n-sessions").value = routine.sessionsPerWeek;
  $("n-len").value = routine.sessionMinutes;
  setHTML($("n-training-effect"),
      muscles.length && !load.muscles.length
    ? 'No exercises in the database yet for these muscles, so no training is counted.'
    : !load.kcalPerDay || (n.burnIsEstimate && !n.isValid()) ? ""
    : n.burnIsEstimate
    ? '<span class="src est">Estimate</span> ≈ ' + fmtK(load.kcalPerDay) + ' kcal a day on ' +
      'average, added to your burn — about ' + trainingHours(load.hours) + ' of lifting a week, ' +
      'the sets your targets take with warm-ups.'
    : 'Your own burn number already includes this training, so nothing is added to it.');
}

const trainingHours = h => { const v = Math.round(h * 2) / 2; return v + (v === 1 ? " hour" : " hours"); };

const fmtWeight = n => (Math.round(n.weight * 10) / 10) + " " + n.unit;

/** The day from 6am to midnight, with each meal as a dot sized by its share. */
function paintTimeline() {
  const n = nutrition();
  const span = LAST_HOUR + 1 - FIRST_HOUR;
  const at = h => ((h - FIRST_HOUR) / span * 100).toFixed(2) + "%";
  $("timeline").innerHTML =
    '<div class="tl-window" style="left:' + at(n.firstMeal) + ';width:' +
      ((n.lastMeal - n.firstMeal) / span * 100).toFixed(2) + '%"></div>' +
    n.meals.map(m =>
      '<div class="tl-meal ' + m.role + '" style="left:' + at(m.hour) + '" title="' +
        m.name + ', ' + hourLabel(m.hour) + ', ' + m.kcal + ' kcal">' +
        '<span class="tl-dot" style="--s:' + (12 + m.share * 40).toFixed(1) + 'px"></span>' +
        '<span class="tl-time">' + hourLabel(m.hour) + '</span>' +
      '</div>').join("") +
    [6, 12, 18].map(h => '<span class="tl-tick" style="left:' + at(h) + '">' +
      hourLabel(h) + '</span>').join("");
}

/* -------------------------------- the plan ------------------------------- */

function renderPlan() {
  const n = nutrition();
  if (!n.isValid()) {
    nplanEl.innerHTML = '<h3>Your daily plan</h3><p class="est-empty">Enter a body ' +
      'weight between ' + weightRangeText() + ' to see your plan.</p>';
    return;
  }
  const g = GOALS[n.goal];
  const [lo, hi] = n.proteinRange;
  const meals = n.meals;
  const math = n.adjust
    ? fmtK(n.burn) + ' kcal burn ' + (n.adjust > 0 ? '+ ' : '− ') +
      Math.round(Math.abs(n.adjust) * 100) + '% for ' + g.label.toLowerCase()
    : fmtK(n.burn) + ' kcal burn, unchanged for ' + g.label.toLowerCase();

  const suggest = n.suggestedMeals !== n.mealsPerDay
    ? '<div class="np-suggest">Suggested: <b>' + n.suggestedMeals + ' meals</b> — about ' +
        Math.round(n.protein / n.suggestedMeals) + ' g protein each. ' +
        '<button type="button" class="link-btn" data-use-meals="' + n.suggestedMeals + '">Use ' +
        n.suggestedMeals + '</button></div>'
    : '<div class="np-suggest ok">The suggested number of meals for your protein target.</div>';

  nplanEl.innerHTML =
    '<div class="np-head"><h3>Your daily plan</h3><span class="tag">Estimate</span></div>' +
    '<div class="np-kcal"><span class="big">' + fmtK(n.kcal) + '</span> kcal a day</div>' +
    '<div class="np-math">' + math + '</div>' +
    (n.atFloor ? '<p class="np-warn">The maths comes out under ' + fmtK(KCAL_FLOOR) +
      ' kcal, so the plan stops there. Going lower is worth doing only with a ' +
      'professional\'s guidance.</p>' : '') +

    '<div class="np-row"><div class="k">Protein</div><div class="v"><b>' + n.protein +
      ' g</b> a day</div><div class="s">' + fmtGkg(n.proteinPerKg) + ' g per kg of body weight · usual range ' +
      lo + '–' + hi + ' g</div></div>' +

    '<div class="np-row"><div class="k">Meals</div><div class="v"><b>' + n.mealsPerDay +
      '</b> a day, ' + hourLabel(meals[0].hour) + '–' + hourLabel(meals[meals.length - 1].hour) +
      '</div>' + suggest + '</div>' +

    '<div class="np-row"><div class="k">Distribution</div>' +
      '<div class="dist" role="img" aria-label="' + meals.map(m =>
        m.name + ' ' + Math.round(m.share * 100) + ' percent').join(", ") + '">' +
      meals.map(m => '<span class="dist-seg ' + m.role + '" style="flex:' + m.share + '" ' +
        'title="' + m.name + ': ' + m.kcal + ' kcal"></span>').join("") + '</div>' +
      '<div class="dist-key">' + meals.map(m => '<span><i class="' + m.role + '"></i>' +
        m.name + ' ' + Math.round(m.share * 100) + '%</span>').join("") + '</div></div>' +

    '<div class="np-row"><div class="k">Built from your plan</div>' +
      '<ul class="np-why">' + planReasons(n).map(r => '<li>' + r + '</li>').join("") +
      '</ul></div>' +

    '<p class="caveat">These are estimates to eat against, not a medical or dietetic ' +
    'prescription. Your real burn depends on age, height, sex and body composition — ' +
    'weigh yourself for two or three weeks and adjust by 100–200 kcal if the trend ' +
    'is not moving the way you want. If you carry a lot of body fat, the low end of ' +
    'the protein range is plenty.</p>';
}

/**
 * How each input shaped the numbers, in the order they apply: what is
 * trained, how often, the goal's calorie change, then protein.
 */
function planReasons(n) {
  const load = n.load, rec = n.recommended, g = GOALS[n.goal];
  const goal = g.label.toLowerCase();
  const pct = v => Math.round(v * 100) + "%";
  const out = [];

  const selected = routine.selectedMuscles().length;
  const untrained = selected - load.muscles.length;
  if (!load.muscles.length) {
    out.push((selected ? "No exercises in the database yet for your target muscles"
                       : "No target muscles yet") +
             ", so no training is counted. The numbers below are for your day alone.");
  } else {
    out.push('<b>Targets:</b> ' + load.muscles.length +
      (load.muscles.length === 1 ? " muscle" : " muscles") + ', about ' + pct(load.coverage) +
      ' of a full-body week\'s training volume' +
      (untrained ? ' (' + untrained + ' more with no exercises yet, not counted).' : '.'));
    out.push('<b>Training:</b> ' + load.sessionsPerWeek + ' × ' + load.sessionMinutes + ' min a week' +
      ' booked; your targets\' sets take about ' + trainingHours(load.hours) + ' of it' +
      (n.burnIsEstimate ? ', adding ≈ ' + fmtK(load.kcalPerDay) + ' kcal a day to your burn.'
                        : ', already in the burn you entered.'));
  }

  const [alo, ahi] = g.adjust;
  const yours = n.adjustIsRecommended ? ""
    : ' You set ' + adjustLabel(n.adjust) + ' instead.';
  if (g.adjustBy === "load")
    out.push('<b>Calories:</b> ' + adjustLabel(rec.adjust) + ' for ' + goal + '. The deficit ' +
      'runs from ' + adjustLabel(alo) + ' with no training to ' + adjustLabel(ahi) + ' for a ' +
      'hard week, so sessions stay fuelled.' + yours);
  else if (g.adjustBy === "coverage")
    out.push('<b>Calories:</b> ' + adjustLabel(rec.adjust) + ' for ' + goal + '. The surplus ' +
      'runs from ' + adjustLabel(alo) + ' for a few muscles to ' + adjustLabel(ahi) + ' for the ' +
      'whole body — muscle you do not train cannot use the extra.' + yours);
  else
    out.push('<b>Calories:</b> eat what you burn for ' + goal + '.' + yours);

  const [plo, phi] = g.protein;
  out.push('<b>Protein:</b> ' + fmtGkg(rec.protein) + ' g/kg, placed in the ' + fmtGkg(plo) + '–' +
    fmtGkg(phi) + ' range by how hard your week is' +
    (load.hours ? ' (' + trainingHours(load.hours) + ' of lifting).' : ' — the low end with no training.') +
    (n.proteinIsRecommended ? '' : ' You set ' + fmtGkg(n.proteinPerKg) + ' g/kg instead.'));
  return out;
}

/* --------------------------------- meals --------------------------------- */

function renderMealCards() {
  const n = nutrition();
  nmealsEl.hidden = !n.isValid();
  if (nmealsEl.hidden) { nmealsEl.innerHTML = ""; return; }
  const shown = new Set();       // ideas already on an earlier card today

  const cards = n.meals.map(m => {
    const ranked = mealIdeasFor(m, n.diet, shown);
    const offset = ranked.length ? (ideaOffset[m.index] || 0) % ranked.length : 0;
    // A second example only if it is new today: with a small pool (few vegan
    // mains, say) one fresh plate beats a second one repeated from lunch.
    const picks = [ranked[offset], ranked[(offset + 1) % ranked.length]]
      .filter((p, i, a) => p && a.indexOf(p) === i && (i === 0 || !shown.has(p.idea)));
    for (const p of picks) shown.add(p.idea);

    const [lo, hi] = n.hourBounds(m.index);
    const times = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map(h =>
      '<option value="' + h + '"' + (h === m.hour ? " selected" : "") + '>' + hourLabel(h) +
      '</option>').join("");

    return '<article class="meal-card ' + m.role + '">' +
      '<header class="mc-head">' +
        '<span class="picker mc-time"><span class="picker-label" aria-hidden="true">' +
          hourLabel(m.hour) + '</span><select data-move="' + m.index + '" aria-label="' +
          m.name + ' time">' + times + '</select></span>' +
        '<span class="mc-name">' + m.name + '</span>' +
        '<span class="mc-share">' + Math.round(m.share * 100) + '%</span>' +
      '</header>' +
      '<div class="mc-nums"><b>≈ ' + fmtK(m.kcal) + '</b> kcal · <b>' + m.protein +
        ' g</b> protein</div>' +
      '<div class="mc-focus">' + m.focus + '</div>' +
      (picks.length
        ? picks.map(p => renderIdea(p)).join("") +
          (ranked.length > 2 ? '<button type="button" class="link-btn mc-more" data-more="' +
            m.index + '">Other ideas ↻</button>' : '')
        : '<p class="est-empty">No example meals for this diet and meal yet.</p>') +
    '</article>';
  }).join("");

  nmealsEl.innerHTML =
    '<div class="nm-head"><h3>Your day of eating</h3>' +
    '<span class="nm-sub">Example plates, portioned to each meal. Swap in foods you ' +
    'like with similar calories and protein.</span></div>' +
    '<div class="meal-cards">' + cards + '</div>';
}

function renderIdea(p) {
  return '<div class="idea">' +
    '<div class="idea-head"><span class="idea-name">' + esc(p.idea.name) + '</span>' +
      '<span class="idea-nums">' + p.kcal + ' kcal · ' + p.protein + ' g</span></div>' +
    '<ul class="idea-foods">' + p.foods.map(([id, g]) =>
      '<li><span>' + esc(FOODS[id].name) + '</span><span>' + amountLabel(id, g) +
      '</span></li>').join("") + '</ul></div>';
}

/* ------------------------------- updating -------------------------------- */

function renderNutritionStage() {
  paintNutritionControls();
  renderPlan();
  renderMealCards();
}

function changed(fn) { fn(nutrition()); renderNutritionStage(); }

$("stage-nutrition").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.goal)      changed(n => n.setGoal(b.dataset.goal));
  else if (b.dataset.activity) changed(n => n.setActivity(b.dataset.activity));
  else if (b.dataset.meals)    changed(n => n.setMealCount(Number(b.dataset.meals)));
  else if (b.dataset.useMeals) changed(n => n.setMealCount(Number(b.dataset.useMeals)));
  else if (b.dataset.diet)     changed(n => { n.diet = b.dataset.diet; });
  else if (b.dataset.unit)     changed(n => n.setUnit(b.dataset.unit));
  else if (b.dataset.step)     changed(n => n.setBurn(n.burn + Number(b.dataset.step)));
  else if (b.id === "burn-reset") { changed(n => { n.burnInput = null; }); $("n-burn").focus(); }
  else if (b.dataset.adjustStep)  changed(n => n.setAdjust(n.adjust + Number(b.dataset.adjustStep)));
  else if (b.dataset.proteinStep) changed(n => n.setProtein(n.proteinPerKg + Number(b.dataset.proteinStep)));
  else if (b.dataset.tuneReset) {
    // The link goes once used; keep focus on the target it reset.
    const which = b.dataset.tuneReset;
    changed(n => { n[which + "Input"] = null; });
    $("n-" + which).focus();
  }
  else if (b.dataset.more) {
    ideaOffset[b.dataset.more] = (ideaOffset[b.dataset.more] || 0) + 2;
    renderMealCards();
    const again = nmealsEl.querySelector('[data-more="' + b.dataset.more + '"]');
    if (again) again.focus();
  }
});

$("n-weight").addEventListener("input", e => changed(n => n.setWeight(e.target.valueAsNumber)));
$("n-burn").addEventListener("change", e => {
  changed(n => n.setBurn(Number(e.target.value)));
  const n = nutrition();   // the field has focus, so repaint it here
  e.target.value = n.burnIsEstimate && !n.isValid() ? "" : n.burn;
});
/* Training frequency and length belong to the routine; the week plan shows
   the same numbers when it is opened (showStage). */
$("n-sessions").addEventListener("change", e =>
  changed(() => { routine.sessionsPerWeek = Number(e.target.value); }));
$("n-len").addEventListener("change", e =>
  changed(() => { routine.sessionMinutes = Number(e.target.value); }));
$("first-meal").addEventListener("change", e =>
  changed(n => n.setWindow(Number(e.target.value), n.lastMeal)));
$("last-meal").addEventListener("change", e =>
  changed(n => n.setWindow(n.firstMeal, Number(e.target.value))));
nmealsEl.addEventListener("change", e => {
  const s = e.target.closest("[data-move]");
  if (!s) return;
  changed(n => n.moveMeal(Number(s.dataset.move), Number(s.value)));
  const again = nmealsEl.querySelector('[data-move="' + s.dataset.move + '"]');
  if (again) again.focus();
});

buildNutritionControls();
