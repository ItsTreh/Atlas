/* ===========================================================================
   Nutrition stage — fuel the training (optional).

   Two pages, each with one reading order.

   The sum. The day's calories are worked out from a few facts, and the
   page is that working, written as the sum it is and read from the top:
   body weight and the day outside training, the training, what the two
   burn; the goal and the change it makes; what to eat, and the protein in
   it. A line is three things in three columns that never move: its name,
   what sets it (changed right there: a figure stepped or typed, a choice
   among words), and what it comes to, the figures in one column down the
   page. Nothing is opened, zoomed to or looked for.

   Beside the sum stands the balance (balance.js), seen whole and still:
   what is burned in one pan, a jar a meal in the other, the beam leaning
   by how far eating is set from the burn. It carries no words but the goal
   cut in its plinth. It shows what the text changes and never stands in
   for it: the line in hand makes its piece of the balance pulse.

   A day of eating. The day's meals as courses across the top, each with
   its hour and the dish on it. Under them the open meal: every dish that
   fits it, on a menu, and beside the menu the dish itself, its ingredients
   set out one by one with what each brings. Pointing at a dish shows it;
   pressing it, the arrow keys or the wheel puts it on the day. How many
   meals, between which hours and which foods are the day's own settings,
   so they stand here, where they show.

   On a phone, or without WebGL, the same pages stand in one column and
   there is no balance.

   Everything is read from and written to routine.nutrition (nutrition.js)
   and the routine's training settings; goals, activity levels, meal
   patterns, diets and meal ideas all come from data, so adding one there
   adds it here.
   ========================================================================= */

const nutrition = () => routine.nutrition;
const nutritionEl = $("nutrition-panel");
const fmtK = n => Math.round(n).toLocaleString("en-US");

/* What is open: a day of eating and its meal; the reasoning; the dish
   pointed at on the menu (shown, not chosen); what the plate last showed. */
const nut = { day: false, meal: 0, reasons: false, fresh: false, peek: null, plate: "", table: "", overMenu: false };

/* Under every plan and day of eating: what the numbers are and are not. */
const CAVEAT = "Estimates to eat against, not a medical or dietetic prescription. Your real burn depends on " +
  "age, height, sex and body composition: weigh yourself for two or three weeks and adjust by 100–200 kcal " +
  "if the trend isn't moving the way you want. If you carry a lot of body fat, the low end of the protein " +
  "range is plenty.";

/* When the plan stops at the floor: for a deficit, going lower; for
   maintenance or a gain, eating more than the burn entered. */
const floorText = n => "The maths comes out under " + fmtK(KCAL_FLOOR) + " kcal, so the plan stops there" +
  (n.adjust < 0 ? ". Going lower is worth doing only with a professional's guidance."
                : ", above the " + fmtK(n.burn) + " kcal burn. If you really burn that little, check it with a professional.");

/* Protein above about 35% of the day's calories (the top of the usual
   range for adults, AMDR) leaves little room for anything else. */
const PROTEIN_SHARE_HIGH = 0.35;

function adjustLabel(adjust) {
  if (!adjust) return "= your burn";
  return (adjust > 0 ? "+" : "−") + Math.round(Math.abs(adjust) * 100) + "%";
}
const fmtGkg = v => v.toFixed(1);
/* The accepted body weight's low (0) or high (1) end in the unit shown. */
const weightBound = (n, i) => n.unit === "lb" ? Math.round(WEIGHT_KG_RANGE[i] / KG_PER_LB) : WEIGHT_KG_RANGE[i];
const trainingHours = h => { const v = Math.round(h * 2) / 2; return v + (v === 1 ? " hour" : " hours"); };
const tag = (own, text) => '<span class="pill-tag' + (own ? ' own' : '') + '">' + text + '</span>';
/* A signed figure in the sum's column: "+ 174", "− 420". */
const signed = v => (v < 0 ? "− " : "+ ") + fmtK(Math.abs(v));

/* --------------------------------- controls -------------------------------- */

/* A figure stepped down or up: two plain signs with the figure between them. */
const nuStep = (attr, less, more, lessLabel, moreLabel, mid) => '<span class="nu-step">' +
  '<button type="button" class="nu-pm" ' + attr + '="' + less + '" data-key="' + attr + '-less" aria-label="' + lessLabel + '"><i class="pm-minus" aria-hidden="true"></i></button>' +
  mid +
  '<button type="button" class="nu-pm" ' + attr + '="' + more + '" data-key="' + attr + '-more" aria-label="' + moreLabel + '"><i class="pm-plus" aria-hidden="true"></i></button></span>';
/* A choice among words, the one chosen underlined. */
const nuWords = (label, items, cls = "") => '<span class="nu-words' + (cls ? ' ' + cls : '') + '" role="radiogroup" aria-label="' + label + '">' + items.join("") + '</span>';
const nuWord = (on, attr, value, text, extra = "") =>
  '<button type="button" role="radio" aria-checked="' + on + '" ' + attr + '="' + value + '" data-key="' + attr + '-' + value + '"' + extra + '>' + text + '</button>';

/* ---------------------------------- the sum -------------------------------- */

/** What the diet is fuelling, in one line under the title. */
function fuelsText(n) {
  const load = n.load;
  if (!routine.selectedMuscles().length)
    return "No target muscles yet, so no training is counted. Skip this if you only want training.";
  if (!load.muscles.length) return "No exercises in the database yet for your targets, so no training is counted.";
  return routine.sessions.length
    ? "What to eat for the week you planned. Every line is yours to change."
    : "What to eat for the training you chose. Every line is yours to change.";
}

/** Why fewer training days count than were asked for, if they do. */
function fewerDays(counted) {
  const asked = routine.sessionsPerWeek, free = routine.availableDays().length;
  if (counted >= asked) return "";
  const d = x => x + (x === 1 ? " day" : " days");
  if (routine.sessions.length === counted && counted < Math.min(asked, free))
    return d(counted) + " in your generated week";
  if (free === counted)
    return "only " + d(free) + " of the week " + (free === 1 ? "is" : "are") + " free to train";
  return "your targets use " + counted + " of the " + d(asked) + " you offered; the rest are rest days";
}

function burnNoteHTML(n) {
  if (n.burnIsEstimate)
    return n.isValid() ? tag(false, "Estimate") + '<span>Know your own number? Type it over.</span>'
                       : '<span>Needs your body weight.</span>';
  return tag(true, "Your number") + '<span>' + (n.burnHeld ? 'Held to the ' + fmtK(BURN_RANGE[0]) + '–' +
      fmtK(BURN_RANGE[1]) + ' kcal range. ' : '') + 'Training included.</span>' +
    '<button type="button" class="text-link" id="burn-reset" data-key="burn-reset">Estimate it for me</button>';
}

/**
 * Every part of the sum that follows from the plan, by the id of the
 * element it is written in. The page is built from these and, when a
 * figure is typed, repainted from them, so the two cannot disagree.
 */
function sumParts(n) {
  const ok = n.isValid(), est = n.burnIsEstimate, load = n.load, rec = n.recommended;
  const goal = GOALS[n.goal].label.toLowerCase(), [plo, phi] = n.proteinRange;
  const muscles = routine.selectedMuscles(), fewer = fewerDays(load.sessionsPerWeek);
  return {
    text: {
      "nu-fuels": fuelsText(n),
      "nu-base-n": ok && est ? fmtK(Math.round(n.baseBurn / 10) * 10) : "—",
      "nu-train-n": ok && est ? signed(load.kcalPerDay) : "—",
      "nu-adj-n": ok ? signed(n.kcal - n.burn) : "—",
      "nu-adjust-v": n.adjust ? adjustLabel(n.adjust) : "level"
    },
    html: {
      "weight-error": ok ? "" : "Enter a weight between " + weightRangeText() + ".",
      "train-note": !muscles.length ? 'No target muscles yet, so none is counted. <button type="button" class="text-link" data-goto="targets">Pick targets</button>'
        : !load.muscles.length ? "No exercises in the database yet for these muscles, so none is counted."
        : !est ? "Already in your own burn number."
        : fewer ? fewer.charAt(0).toUpperCase() + fewer.slice(1) + "." : "",
      "burn-note": burnNoteHTML(n),
      "goal-note": esc(GOALS[n.goal].blurb),
      "adjust-note": n.adjustIsRecommended ? "Recommended for " + goal + "."
        : 'Your setting. Recommended: ' + adjustLabel(rec.adjust).replace("= your burn", "level") +
          '. <button type="button" class="text-link" data-tune-reset="adjust" data-key="reset-adjust">Use it</button>',
      "eat-note": ok ? 'In ' + n.mealsPerDay + ' meals, ' + hourLabel(n.hours[0]) + ' to ' + hourLabel(n.hours[n.hours.length - 1]) + '. ' +
          '<button type="button" class="text-link" id="open-day" data-key="open-day">See a day of eating</button>' : "",
      "protein-note": (n.proteinIsRecommended ? "Recommended."
        : 'Your setting. Recommended: ' + fmtGkg(rec.protein) +
          '. <button type="button" class="text-link" data-tune-reset="protein" data-key="reset-protein">Use it</button>') +
        (ok ? " Usually " + plo + "–" + phi + " g a day." : ""),
      "nu-warns": (n.atFloor ? '<p class="nu-warn">' + floorText(n) + '</p>' : '') +
        (ok && n.protein * 4 > n.kcal * PROTEIN_SHARE_HIGH ? '<p class="nu-warn">' + n.protein + ' g of protein is about ' +
          Math.round(n.protein * 400 / n.kcal) + '% of these calories, above the usual ' + Math.round(PROTEIN_SHARE_HIGH * 100) +
          '% top: consider a lower g per kg.</p>' : '')
    }
  };
}

/**
 * A line of the sum: its name, what sets it and what it comes to. `piece`
 * is the part of the balance it changes.
 */
const sumRow = (piece, name, control, figure = "", cls = "") =>
  '<div class="sum-row' + (cls ? ' ' + cls : '') + '" data-piece="' + piece + '">' +
    '<div class="sum-l">' + name + '</div><div class="sum-c">' + control + '</div><div class="sum-f">' + figure + '</div></div>';

function planHTML() {
  const n = nutrition(), ok = n.isValid(), p = sumParts(n);
  const note = id => '<span class="sum-n" id="' + id + '">' + p.html[id] + '</span>';
  const fig = id => '<output id="' + id + '">' + p.text[id] + '</output>';
  const off = n.burnIsEstimate ? "" : "off";

  const sum =
    sumRow("base", '<label for="n-weight">Body weight</label>',
      nuStep("data-weight-step", -0.5, 0.5, "Half a " + n.unit + " less", "Half a " + n.unit + " more",
        '<input id="n-weight" class="nu-in" type="number" min="' + weightBound(n, 0) + '" max="' + weightBound(n, 1) + '" step="0.5" inputmode="decimal" ' +
          'aria-describedby="weight-error"' + (ok ? '' : ' aria-invalid="true"') + ' value="' + (n.weight ?? "") + '">') +
      nuWords("Weight unit", ["kg", "lb"].map(u => nuWord(n.unit === u, "data-unit", u, u)), "small") +
      '<span class="sum-n warn" id="weight-error">' + p.html["weight-error"] + '</span>') +
    sumRow("base", '<span id="act-label">Outside training</span>',
      nuWords("Outside training", Object.entries(ACTIVITY_LEVELS).map(([key, a]) =>
        nuWord(n.burnIsEstimate && n.activity === key, "data-activity", key, a.label, ' title="' + esc(a.hint) + '"')), "small"),
      fig("nu-base-n"), off) +
    sumRow("training", '<span id="days-label" title="The same numbers as the Week plan: change them here or there.">Training</span>',
      nuStep("data-days-step", -1, 1, "One day fewer", "One day more",
        '<output class="nu-out" aria-labelledby="days-label">' + routine.sessionsPerWeek + '</output>') +
      '<span class="sum-w">days a week, each</span>' +
      nuWords("Session length", SESSION_LENGTH_OPTIONS.map(m => nuWord(routine.sessionMinutes === m, "data-len", m, m)), "small") +
      '<span class="sum-w">min</span>' + note("train-note"),
      fig("nu-train-n"), off) +
    sumRow("base", '<label for="n-burn">What you burn</label>', note("burn-note"),
      '<span class="sum-big"><span class="sum-approx" aria-hidden="true">≈</span><input id="n-burn" class="nu-in big" type="text" inputmode="numeric" autocomplete="off" ' +
        'aria-describedby="burn-note" value="' + (n.burnIsEstimate && !ok ? "" : fmtK(n.burn)) + '"></span><small>kcal a day</small>', "total") +
    sumRow("beam", "Your goal",
      nuWords("Your goal", Object.entries(GOALS).map(([key, g]) => nuWord(n.goal === key, "data-goal", key, g.label))) +
      note("goal-note"), "", "wide") +
    sumRow("beam", '<span id="adjust-label">Calories</span>',
      nuStep("data-adjust-step", -0.01, 0.01, "1% fewer calories", "1% more calories",
        '<output class="nu-out wide" id="nu-adjust-v" aria-labelledby="adjust-label">' + p.text["nu-adjust-v"] + '</output>') +
      note("adjust-note"), fig("nu-adj-n")) +
    sumRow("jars", "What you eat", note("eat-note"),
      '<span class="sum-big"><span class="sum-approx" aria-hidden="true">≈</span><output class="big" id="nu-eat-n">' + (ok ? fmtK(n.kcal) : "—") + '</output></span><small>kcal a day</small>', "total") +
    sumRow("jars", '<span id="protein-label">Protein</span>',
      nuStep("data-protein-step", -0.1, 0.1, "0.1 g per kg less", "0.1 g per kg more",
        '<output class="nu-out" aria-labelledby="protein-label">' + fmtGkg(n.proteinPerKg) + '</output>') +
      '<span class="sum-w">g per kg</span>' + note("protein-note"),
      '<output class="mid" id="nu-prot-n">' + (ok ? n.protein : "—") + '</output><small>g a day</small>', "second");

  return '<div class="nu-plan">' +
    '<div class="nu-head" data-reveal="0">' +
      '<p class="eyebrow"><span><span class="n">' + STAGE_NUMERALS.nutrition + '</span> / Nutrition</span><span class="eyebrow-note">optional</span></p>' +
      '<h1 class="display nu-title" id="nutrition-title" tabindex="-1">Fuel the training</h1>' +
      '<p class="nu-lede" id="nu-fuels">' + esc(p.text["nu-fuels"]) + '</p>' +
    '</div>' +
    '<div class="sum" data-reveal="1">' + sum + '</div>' +
    '<div class="nu-after" data-reveal="2">' +
      '<p class="nu-est">' + tag(false, "Estimate") + '<span>To eat against and adjust, not a prescription.</span>' +
        '<button type="button" class="text-link" id="nu-reasons" data-key="reasons" aria-expanded="' + nut.reasons + '"' +
          (nut.reasons ? ' aria-controls="nu-why"' : '') + '>' + (nut.reasons ? (onScale() ? "Back to the balance" : "Hide the reasoning") : "How it's worked out") + '</button></p>' +
      '<div id="nu-warns">' + p.html["nu-warns"] + '</div>' +
    '</div>' +
    (nut.reasons ? '<aside class="nu-why" id="nu-why" aria-label="How it is worked out">' +
        '<p class="nu-why-h">How it’s worked out</p>' +
        (ok ? '<ul class="nu-reasons">' + planReasons(n).map(r => '<li>' + r + '</li>').join("") + '</ul>'
            : '<p class="nu-reasons-none">It needs your body weight first.</p>') +
        '<p class="nu-caveat">' + CAVEAT + '</p>' +
      '</aside>' : '') +
  '</div>';
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

  if (n.burnIsEstimate) {
    const a = ACTIVITY_LEVELS[n.activity], raw = n.baseBurn + load.kcalPerDay;
    out.push('<b>Burn:</b> ' + Math.round(n.weightKg * 10) / 10 + ' kg × ' + a.kcalPerKg + ' kcal per kg, ' +
      a.label.toLowerCase() + ' outside training, ≈ ' + fmtK(Math.round(n.baseBurn / 10) * 10) +
      (load.kcalPerDay ? ', plus ≈ ' + fmtK(load.kcalPerDay) + ' a day for training' : '') +
      (raw > BURN_RANGE[1] ? ', held at the ' + fmtK(BURN_RANGE[1]) + ' kcal the plan goes up to'
       : raw < BURN_RANGE[0] ? ', raised to the ' + fmtK(BURN_RANGE[0]) + ' kcal the plan starts from' : '') +
      ', to the nearest 50. A rough start: height, age, sex and body composition move it, so your own number is better.');
  } else {
    out.push('<b>Burn:</b> your own number, ' + fmtK(n.burn) + ' kcal a day, training included.');
  }

  const selected = routine.selectedMuscles().length;
  const untrained = selected - load.muscles.length;
  if (!load.muscles.length) {
    out.push((selected ? "No exercises in the database yet for your target muscles"
                       : "No target muscles yet") +
             ", so no training is counted. The numbers are for your day alone.");
  } else {
    const fewer = fewerDays(load.sessionsPerWeek);
    out.push('<b>Targets:</b> ' + load.muscles.length +
      (load.muscles.length === 1 ? " muscle" : " muscles") + ', about ' + pct(load.coverage) +
      ' of a full-body week\'s training volume' +
      (untrained ? ' (' + untrained + ' more with no exercises yet, not counted).' : '.'));
    out.push('<b>Training:</b> ' + load.sessionsPerWeek + ' × ' + load.sessionMinutes + ' min a week' +
      (fewer ? ' (' + fewer + ')' : '') +
      '; your targets\' sets take about ' + trainingHours(load.hours) + ' of it, warm-ups included' +
      (n.burnIsEstimate ? ', adding ≈ ' + fmtK(load.kcalPerDay) + ' kcal a day to your burn.'
                        : ', already in the burn you entered.'));
  }

  const [alo, ahi] = g.adjust;
  const yours = n.adjustIsRecommended ? "" : ' You set ' + adjustLabel(n.adjust) + ' instead.';
  if (g.adjustBy === "load")
    out.push('<b>Calories:</b> ' + adjustLabel(rec.adjust) + ' for ' + goal + '. The deficit ' +
      'runs from ' + adjustLabel(alo) + ' with no training to ' + adjustLabel(ahi) + ' for a ' +
      'hard week, so sessions stay fuelled.' + yours);
  else if (g.adjustBy === "coverage")
    out.push('<b>Calories:</b> ' + adjustLabel(rec.adjust) + ' for ' + goal + '. The surplus ' +
      'runs from ' + adjustLabel(alo) + ' for a few muscles to ' + adjustLabel(ahi) + ' for the ' +
      'whole body: muscle you do not train cannot use the extra.' + yours);
  else
    out.push('<b>Calories:</b> eat what you burn for ' + goal + '.' + yours);

  const [plo, phi] = g.protein;
  out.push('<b>Protein:</b> ' + fmtGkg(rec.protein) + ' g/kg, placed in the ' + fmtGkg(plo) + '–' +
    fmtGkg(phi) + ' range by how hard your week is' +
    (load.hours ? ' (' + trainingHours(load.hours) + ' of lifting).' : ': the low end with no training.') +
    (n.proteinIsRecommended ? '' : ' You set ' + fmtGkg(n.proteinPerKg) + ' g/kg instead.'));
  return out;
}

/* ------------------------------ a day of eating ---------------------------- */

/* The dish the user put on a meal, by meal index. Only that meal changes;
   the others keep the dishes suggested. */
const ideaChosen = {};

/** The day's meals, each with the dish it shows (no dish twice if avoidable). */
function mealsWithIdeas(n) {
  const shown = new Set();
  const suggested = n.meals.map(m => {
    const ranked = mealIdeasFor(m, n.diet, shown);
    if (ranked.length) shown.add(ranked[0].idea);
    return { m, ranked };
  });
  return suggested.map(({ m, ranked }) => {
    const own = ideaChosen[m.index] && ranked.find(r => r.idea === ideaChosen[m.index]);
    return { ...m, pick: own || ranked[0] || null };
  });
}

/** The day as it stands: its meals, the open one, and every dish that fits it, closest to its numbers first. */
function dayData(n) {
  const meals = mealsWithIdeas(n), mi = Math.min(nut.meal, meals.length - 1), cm = meals[mi];
  const opts = mealIdeasFor(cm, n.diet);
  const at = cm.pick ? opts.findIndex(o => o.idea === cm.pick.idea) : -1;
  return { meals, mi, cm, opts, at };
}

/* How far a dish is from its meal, when that is more than a little. */
function plateGap(plate, meal) {
  const off = (plate.kcal - meal.kcal) / meal.kcal;
  return Math.abs(off) < 0.15 ? "" : "About " + Math.round(Math.abs(off) * 100) + "% " +
    (off > 0 ? "more" : "less") + " than this meal: its portions only stretch so far.";
}

/** The day's figures, and what the dishes on it come to. */
function daySumHTML(n, meals) {
  const k = meals.reduce((t, m) => t + (m.pick ? m.pick.kcal : 0), 0), p = meals.reduce((t, m) => t + (m.pick ? m.pick.protein : 0), 0);
  return tag(false, "Estimate") + '<span><b>' + fmtK(n.kcal) + '</b> kcal and <b>' + n.protein + '</b> g protein a day.</span>' +
    '<span class="day-plated">These dishes come to <b>' + fmtK(k) + '</b> kcal and <b>' + p + '</b> g.</span>';
}

/** A meal across the top: its hour, its name, the dish on it. */
const courseInner = m => '<span class="course-t">' + hourLabel(m.hour) + '</span><span class="course-n">' + esc(m.name) + '</span>' +
  '<span class="course-d">' + (m.pick ? esc(m.pick.idea.name) : "No dish yet") + '</span>';

/** A dish set out: its name, what it comes to, and each ingredient with its amount and what it brings. */
function plateHTML(opt, cm, chosen) {
  if (!opt) return '<p class="serve-none">No example dishes for this diet and meal yet.</p>';
  const foods = opt.foods.map(([id, g]) => {
    const f = FOODS[id], [name, how] = f.name.split(", ");
    return { name, how, amount: amountLabel(id, g), kcal: Math.round(f.kcal * g / 100), protein: Math.round(f.protein * g / 100) };
  });
  const most = Math.max(...foods.map(f => f.kcal), 1), gap = plateGap(opt, cm);
  return '<p class="serve-when">' + (chosen ? 'Your ' + esc(cm.name.toLowerCase()) : 'Press to make it your ' + esc(cm.name.toLowerCase())) + '</p>' +
    '<h2 class="serve-n">' + esc(opt.idea.name) + '</h2>' +
    '<p class="serve-f"><span><b>' + fmtK(opt.kcal) + '</b> kcal</span><span><b>' + opt.protein + '</b> g protein</span>' +
      '<span class="serve-aim">This meal aims for ' + fmtK(cm.kcal) + ' kcal and ' + cm.protein + ' g.' + (gap ? ' ' + gap : '') + '</span></p>' +
    '<ul class="foods">' + foods.map((f, i) =>
      '<li class="food" style="--i:' + i + ';--k:' + (f.kcal / most).toFixed(3) + ';--p:' + Math.min(1, f.protein * 4 / Math.max(1, f.kcal)).toFixed(3) + '">' +
        '<span class="food-a">' + f.amount + '</span>' +
        '<span class="food-n">' + esc(f.name) + (f.how ? '<small>' + esc(f.how) + '</small>' : '') + '</span>' +
        '<span class="food-b" aria-hidden="true"><i></i></span>' +
        '<span class="food-k">' + fmtK(f.kcal) + ' kcal</span><span class="food-p">' + f.protein + ' g</span>' +
      '</li>').join("") + '</ul>' +
    '<p class="serve-key" aria-hidden="true"><i class="key-k"></i>calories<i class="key-p"></i>of which protein</p>';
}

function dayHTML() {
  const n = nutrition(), d = dayData(n), { meals, mi, cm, opts } = d;
  const [lo, hi] = n.hourBounds(cm.index);
  const hourOptions = (from, to, now) => Array.from({ length: to - from + 1 }, (_, i) => from + i).map(h =>
    '<option value="' + h + '"' + (h === now ? ' selected' : '') + '>' + hourLabel(h) + '</option>').join("");
  const picker = (id, label, from, to, now, attrs = "") => '<span class="picker word"><span class="picker-label" aria-hidden="true">' + hourLabel(now) +
    '</span><select ' + (id ? 'id="' + id + '" ' : '') + 'data-key="' + (id || "move") + '" aria-label="' + label + '"' + attrs + '>' + hourOptions(from, to, now) + '</select></span>';
  // A dish another meal already shows says so: the day need not be the same plate twice.
  const elsewhere = new Map(meals.filter(m => m !== cm && m.pick).map(m => [m.pick.idea, m.name.toLowerCase()]));
  // What the table shows: a new meal, diet or count deals it out again; anything else leaves it be.
  const table = [cm.index, n.diet, n.mealsPerDay].join("/"), fresh = table !== nut.table;
  nut.table = table;
  nut.plate = cm.pick ? cm.pick.idea.name : "";
  nut.peek = null;

  return '<div class="day">' +
    '<div class="day-head" data-reveal="0">' +
      '<h1 class="display" id="nutrition-title" tabindex="-1">A day of eating</h1>' +
      '<p class="day-sum" id="day-sum">' + daySumHTML(n, meals) + '</p>' +
      (n.atFloor ? '<p class="nu-warn">' + floorText(n) + '</p>' : '') +
    '</div>' +
    '<div class="day-set" data-reveal="0">' +
      '<span class="day-set-i"><span class="day-set-l" id="meals-label">Meals</span>' +
        nuWords("Meals a day", MEAL_COUNTS.map(c => nuWord(n.mealsPerDay === c, "data-meals", c, c,
          c === n.suggestedMeals ? ' class="sug" title="Suggested for your protein target"' : '')), "small") + '</span>' +
      '<span class="day-set-i"><span class="day-set-l">Between</span>' + picker("first-meal", "First meal", FIRST_HOUR, 13, n.firstMeal) +
        '<span class="day-set-l">and</span>' + picker("last-meal", "Last meal", 14, LAST_HOUR, n.lastMeal) + '</span>' +
      '<span class="day-set-i"><span class="day-set-l">Eating</span>' +
        nuWords("Diet style", Object.entries(DIETS).map(([key, x]) => nuWord(n.diet === key, "data-diet", key, x.label)), "small") + '</span>' +
      (n.suggestedMeals !== n.mealsPerDay ? '<span class="day-set-n">' + n.suggestedMeals + ' meals would put about ' +
        Math.round(n.protein / n.suggestedMeals) + ' g protein in each.</span>' : '') +
    '</div>' +
    '<div class="courses" role="tablist" aria-label="The day’s meals" data-reveal="1" style="--n:' + meals.length + '">' +
      meals.map((m, i) => '<button type="button" class="course" role="tab" id="course-' + i + '" aria-selected="' + (i === mi) + '" aria-controls="day-table" ' +
        'data-meal="' + i + '" data-key="meal-' + i + '" tabindex="' + (i === mi ? 0 : -1) + '">' + courseInner(m) + '</button>').join("") +
    '</div>' +
    '<div class="table' + (fresh ? ' deal' : '') + '" id="day-table" role="tabpanel" aria-labelledby="course-' + mi + '" data-reveal="2">' +
      '<div class="menu">' +
        '<p class="menu-h"><span>' + esc(cm.name) + ' at</span>' + picker("", esc(cm.name) + " time", lo, hi, cm.hour, ' data-move="' + cm.index + '"') +
          '<span class="menu-aim">' + esc(cm.focus) + ' · ' + opts.length + (opts.length === 1 ? " dish" : " dishes") + ', closest to its numbers first</span></p>' +
        '<div class="dishes" id="dishes" role="radiogroup" aria-label="Dishes for ' + esc(cm.name.toLowerCase()) + '">' +
          opts.map((o, k) => '<button type="button" class="dish" role="radio" aria-checked="' + (k === d.at) + '" data-dish="' + k + '" data-key="dish-' + k + '" style="--i:' + k + '">' +
            '<span class="dish-n">' + esc(o.idea.name) + '</span>' +
            (elsewhere.has(o.idea) ? '<span class="dish-e">also your ' + esc(elsewhere.get(o.idea)) + '</span>' : '') +
            '<span class="dish-f">' + fmtK(o.kcal) + ' kcal<i>' + o.protein + ' g</i></span></button>').join("") +
        '</div>' +
      '</div>' +
      '<article class="serve" id="serve" aria-live="polite">' + plateHTML(cm.pick, cm, true) + '</article>' +
    '</div>' +
    '<p class="day-caveat" data-reveal="2">Each dish is an example in everyday portions, so it lands near its meal’s numbers, not on them: swap in foods you like with similar numbers. ' + CAVEAT + '</p>' +
  '</div>';
}

/** Sets out a dish on the plate: the one chosen, or the one pointed at. A different dish is dealt out; the same one is left as it lies. */
function paintPlate(d = dayData(nutrition())) {
  const el = $("serve");
  if (!el) return;
  const peek = nut.peek !== null && nut.peek !== d.at ? d.opts[nut.peek] : null, opt = peek || d.cm.pick;
  const key = (opt ? opt.idea.name : "") + (peek ? "?" : "");
  if (key === nut.plate) return;
  nut.plate = key;
  el.innerHTML = plateHTML(opt, d.cm, !peek);
  el.classList.toggle("peek", !!peek);
  if (!reducedMotion()) { el.classList.remove("deal"); void el.offsetWidth; el.classList.add("deal"); }
}

/** Puts dish `k` of the menu on the open meal, in place: the menu, the course, the day's figures and the plate. */
function chooseDish(k, focus = false) {
  const n = nutrition(), was = dayData(n), opt = was.opts[k];
  if (!opt) return;
  ideaChosen[was.cm.index] = opt.idea;
  nut.peek = null;
  const d = dayData(n);
  for (const b of nutritionEl.querySelectorAll(".dish")) {
    const on = Number(b.dataset.dish) === d.at;
    b.setAttribute("aria-checked", on);
    b.classList.remove("peek");
    if (on && focus) b.focus({ preventScroll: true });
  }
  const course = $("course-" + d.mi);
  if (course) { course.innerHTML = courseInner(d.cm); if (!reducedMotion()) course.querySelector(".course-d").classList.add("new"); }
  if ($("day-sum")) $("day-sum").innerHTML = daySumHTML(n, d.meals);
  paintPlate(d);
  announce(d.cm.name + ": " + opt.idea.name + ", " + fmtK(opt.kcal) + " kcal and " + opt.protein + " g protein");
}

/** Opens another meal of the day. */
function pickMeal(i, focus = false) {
  const count = nutrition().meals.length;
  if (i < 0 || i >= count || i === nut.meal) return;
  nut.meal = i;
  renderNutritionStage();
  if (focus && $("course-" + i)) $("course-" + i).focus({ preventScroll: true });
}

/* -------------------------------- drawing --------------------------------- */

function renderNutritionStage() {
  // Remember what had focus: the panel is redrawn after every change.
  const active = document.activeElement;
  const focusKey = active && nutritionEl.contains(active) ? (active.dataset.key || active.id) : null;
  const day = nut.day && nutrition().isValid();
  if (!day) nut.table = "";
  nutritionEl.innerHTML = day ? dayHTML() : planHTML();
  const stage = $("stage-nutrition");
  stage.dataset.view = Stages.root.dataset.nview = day ? "day" : "plan";
  stage.toggleAttribute("data-why", !day && nut.reasons);
  if (!day) rollFigures();
  paintBalance();
  if (focusKey) focusAgain(nutritionEl.querySelector('[data-key="' + focusKey + '"]') || $(focusKey));
}

/**
 * Repaints what a typed weight or burn changes, in place: the field the
 * user is typing in is never rebuilt, so nothing under their hands moves.
 */
function paintNutritionFigures() {
  const n = nutrition(), p = sumParts(n), ok = n.isValid();
  for (const [id, html] of Object.entries(p.html)) { const el = $(id); if (el && el.innerHTML !== html) el.innerHTML = html; }
  if ($("nu-fuels")) $("nu-fuels").textContent = p.text["nu-fuels"];
  if ($("nu-adjust-v")) $("nu-adjust-v").textContent = p.text["nu-adjust-v"];
  rollFigures();
  const burn = $("n-burn");
  if (burn && document.activeElement !== burn) burn.value = n.burnIsEstimate && !ok ? "" : fmtK(n.burn);
  const weight = $("n-weight");
  if (weight) { if (ok) weight.removeAttribute("aria-invalid"); else weight.setAttribute("aria-invalid", "true"); }
  for (const row of nutritionEl.querySelectorAll('.sum-row[data-piece="base"]:not(.total), .sum-row[data-piece="training"]'))
    if (row.querySelector("output[id]")) row.classList.toggle("off", !n.burnIsEstimate);
  paintBalance();
}

/* The sum's figures turn to a new value instead of changing at once: what
   each shows now, by its element's id. */
const rolled = {};
function rollTo(id, to, text, wait = 0) {
  const r = rolled[id] || (rolled[id] = { v: null, raf: 0, timer: 0 });
  cancelAnimationFrame(r.raf); clearTimeout(r.timer);
  const put = v => { const el = $(id); if (el) el.textContent = v === null ? "—" : text(Math.round(v)); };
  if (to === null || r.v === null || reducedMotion()) { r.v = to; put(to); return; }
  const from = r.v;
  put(from);
  if (from === to) return;
  r.timer = setTimeout(() => {
    const t0 = performance.now();
    (function turn(now) {
      const p = Math.min(1, (now - t0) / 560);
      r.v = from + (to - from) * (1 - Math.pow(1 - p, 3));
      put(r.v);
      if (p < 1) r.raf = requestAnimationFrame(turn); else r.v = to;
    })(t0);
  }, wait);
}
/** Turns the sum's figures to the plan's; `arrive` counts them up as the pans are loaded. */
function rollFigures(arrive = false) {
  const n = nutrition(), ok = n.isValid(), est = ok && n.burnIsEstimate, at = BalanceScene.SET_DOWN;
  const figures = [
    ["nu-base-n", est ? Math.round(n.baseBurn / 10) * 10 : null, fmtK, at.base],
    ["nu-train-n", est ? n.load.kcalPerDay : null, signed, at.training],
    ["nu-adj-n", ok ? n.kcal - n.burn : null, signed, at.jar],
    ["nu-eat-n", ok ? n.kcal : null, fmtK, at.jar],
    ["nu-prot-n", ok ? n.protein : null, String, at.jar]
  ];
  for (const [id, to, text, wait] of figures) {
    if (arrive && to !== null) (rolled[id] || (rolled[id] = {})).v = 0;
    rollTo(id, to, text, arrive ? wait : 0);
  }
}

/* ------------------------------- the balance ------------------------------- */

/* The balance (balance.js) stands beside the sum and carries one word: the
   goal, cut in its plinth, set where the plinth is as the balance draws. */
const balanceEl = $("balance");
balanceEl.insertAdjacentHTML("beforeend", '<span class="bal-plinth" id="bal-plinth"></span>');
const scales = new BalanceScene(balanceEl.querySelector("canvas"));
balanceEl.hidden = !scales.ok;

/** True where the balance is drawn: not on a phone, not without WebGL. */
const onScale = () => !Stages.narrow && scales.ok;

/** Loads the pans from the plan; `arrive` sets the load down piece by piece from level and empty. */
function paintBalance(arrive = false) {
  const n = nutrition(), ok = n.isValid();
  if (!scales.ok) return;
  if (arrive) scales.arrive();
  scales.set({
    tilt: ok ? (n.atFloor ? n.kcal / n.burn - 1 : n.adjust) : null,
    base: n.burnIsEstimate ? n.baseBurn : n.burn,
    training: n.burnIsEstimate ? n.load.kcalPerDay : 0,
    meals: ok ? n.meals.map(m => m.share) : []
  });
  $("bal-plinth").textContent = GOALS[n.goal].label;
  placePlinth();
}
function placePlinth() {
  const el = $("bal-plinth"), p = scales.anchor("plinth");
  el.style.fontSize = Math.max(8, scales.unitPx() * .082).toFixed(1) + "px";
  el.style.transform = "translate(" + p.x.toFixed(1) + "px, " + p.y.toFixed(1) + "px) translate(-50%, -50%)";
}
scales.onFrame = placePlinth;
new MutationObserver(() => scales.wake()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
addEventListener("resize", () => scales.wake());

/* The line in hand lights the piece of the balance it changes, as a muscle pointed at lights on Targets. */
function lightPiece(e) {
  const row = e.type === "pointerout" || e.type === "focusout" ? null : e.target.closest && e.target.closest(".sum-row");
  const piece = row ? row.dataset.piece : null;
  if (scales.glow === piece) return;
  scales.glow = piece;
  scales.wake();
}
for (const type of ["pointerover", "pointerout", "focusin", "focusout"]) nutritionEl.addEventListener(type, lightPiece);

/* --------------------------------- changes --------------------------------- */

const openDay = (meal = nut.meal) => Stages.relayout(() => { nut.day = true; nut.meal = meal; nut.reasons = false; }, 500);
const closeDay = () => Stages.relayout(() => { nut.day = false; nut.fresh = true; }, 500);

function changed(fn) {
  fn(nutrition());
  saveRoutine(routine);
  renderNutritionStage();
  const n = nutrition();
  if (n.isValid() && !nut.day) announce("Estimate: " + fmtK(n.kcal) + " kcal and " + n.protein + " g protein a day");
}

nutritionEl.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.goal) changed(n => n.setGoal(d.goal));
  else if (d.weightStep) changed(n => n.setWeight(Math.max(weightBound(n, 0), Math.min(weightBound(n, 1), (n.weight ?? (n.unit === "lb" ? 154 : 70)) + Number(d.weightStep)))));
  else if (d.unit) changed(n => n.setUnit(d.unit));
  else if (d.activity) changed(n => n.setActivity(d.activity));
  else if (b.id === "burn-reset") { changed(n => { n.burnInput = null; }); if ($("n-burn")) $("n-burn").focus(); }
  else if (d.daysStep) {
    const [lo, hi] = TRAINING_DAYS_RANGE;
    changed(() => { routine.sessionsPerWeek = Math.max(lo, Math.min(hi, routine.sessionsPerWeek + Number(d.daysStep))); });
  }
  else if (d.len) changed(() => { routine.sessionMinutes = Number(d.len); });
  else if (d.adjustStep) changed(n => n.setAdjust(n.adjust + Number(d.adjustStep)));
  else if (d.proteinStep) changed(n => n.setProtein(n.proteinPerKg + Number(d.proteinStep)));
  else if (d.tuneReset) changed(n => { n[d.tuneReset + "Input"] = null; });
  else if (d.meals) changed(n => { n.setMealCount(Number(d.meals)); nut.meal = 0; });
  else if (d.diet) changed(n => { n.diet = d.diet; });
  else if (b.id === "nu-reasons") { nut.reasons = !nut.reasons; renderNutritionStage(); }
  else if (b.id === "open-day") openDay(0);
  else if (d.meal) pickMeal(Number(d.meal));
  else if (d.dish) chooseDish(Number(d.dish));
});

nutritionEl.addEventListener("input", e => {
  if (e.target.id !== "n-weight") return;
  nutrition().setWeight(e.target.valueAsNumber);
  saveRoutine(routine);
  paintNutritionFigures();
});
nutritionEl.addEventListener("change", e => {
  const t = e.target, n = nutrition();
  if (t.id === "n-burn") {
    n.setBurn(Number(t.value.replace(/[^0-9.]/g, "")));
    t.value = n.burnIsEstimate && !n.isValid() ? "" : fmtK(n.burn);
    saveRoutine(routine);
    paintNutritionFigures();
  }
  else if (t.id === "first-meal") changed(n => n.setWindow(Number(t.value), n.lastMeal));
  else if (t.id === "last-meal") changed(n => n.setWindow(n.firstMeal, Number(t.value)));
  else if (t.dataset.move) changed(n => n.moveMeal(Number(t.dataset.move), Number(t.value)));
});

/* The menu. Pointing at a dish sets it out on the plate without choosing
   it; leaving the menu puts the chosen one back. */
let peekTimer = 0;
function peekDish(k) {
  if (k === nut.peek) return;
  nut.peek = k;
  for (const b of nutritionEl.querySelectorAll(".dish")) b.classList.toggle("peek", Number(b.dataset.dish) === k);
  clearTimeout(peekTimer);
  // A moment's rest on a dish, so a pointer crossing the menu does not deal out every one it passes.
  peekTimer = setTimeout(() => paintPlate(), k === null ? 140 : 60);
}
nutritionEl.addEventListener("pointerover", e => {
  if (!nut.day || e.pointerType === "touch") return;
  const dish = e.target.closest(".dish");
  nut.overMenu = !!e.target.closest(".menu");
  if (dish) peekDish(Number(dish.dataset.dish));
  else if (!e.target.closest(".dishes")) peekDish(null);
});
nutritionEl.addEventListener("pointerleave", () => { nut.overMenu = false; if (nut.day) peekDish(null); });

/* The wheel over the menu turns through its dishes, one a notch. */
const MENU_NOTCH = 70;
let menuWheel = { acc: 0, at: 0 };
nutritionEl.addEventListener("wheel", e => {
  if (!nut.day || !e.target.closest(".menu") || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  const now = performance.now();
  if (now - menuWheel.at > 300) menuWheel.acc = 0;
  menuWheel.at = now;
  menuWheel.acc += e.deltaY;
  if (Math.abs(menuWheel.acc) < MENU_NOTCH) return;
  const d = dayData(nutrition()), to = Math.max(0, Math.min(d.opts.length - 1, d.at + Math.sign(menuWheel.acc)));
  menuWheel.acc = 0;
  if (to !== d.at) chooseDish(to);
}, { passive: true });

/* Arrow keys move along the day's meals, as a tab list should. */
nutritionEl.addEventListener("keydown", e => {
  if (!e.target.closest(".courses") || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
  e.preventDefault();
  pickMeal(nut.meal + (e.key === "ArrowRight" ? 1 : -1), true);
});

/* Without the balance (no WebGL) the statue stands where it would be. */
SCULPTURE_SHOTS["nutrition-plan"] = { ...SCULPTURE_SHOTS["nutrition"], az: -10, d: 640, sx: .74 };

Stages.register("nutrition", {
  arrive() {
    nut.fresh = true;
    nut.reasons = false;
    // Back from the week, or reloaded there: the day of eating, the stage's last page.
    nut.day = (Stages.from === "plan" || Stages.at === "day") && nutrition().isValid();
  },
  enter() {
    if (!nutrition().isValid()) nut.day = false;
    renderNutritionStage();
    // Arriving, the pans are loaded and the figures count up with them; a redraw leaves them be.
    if (nut.fresh && !nut.day) { paintBalance(true); rollFigures(true); }
    nut.fresh = false;
  },
  place: () => nut.day ? "day" : "plan",
  shot: () => nut.day || Stages.narrow ? "nutrition" : "nutrition-plan",
  // The balance has the room, and the menu in a day of eating; on a phone the statue stands by.
  dim: () => nut.day ? (Stages.narrow ? 0.45 : 0) : scales.ok && !Stages.narrow ? 0 : 1,
  focus: () => $("nutrition-title"),
  // The wheel over the menu turns its dishes, not the stage.
  wheel: () => !(nut.day && nut.overMenu),
  footer() {
    const empty = routine.selection.isEmpty(), ok = nutrition().isValid();
    const last = nut.day || !ok;
    return {
      back: nut.day ? "← Fuel the training" : "← Your measure",
      skip: empty || nut.day ? "" : Stages.narrow ? "Skip" : "Skip, training only",
      next: last ? (Stages.narrow ? "Week plan →" : "Continue to week plan →") : "A day of eating →",
      hint: last ? "" : "or scroll",
      nextDisabled: last && empty
    };
  },
  onNext() { if (!nut.day && nutrition().isValid()) { openDay(0); return true; } },
  onBack() { if (nut.day) { closeDay(); return true; } }
});
