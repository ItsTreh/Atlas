/* ===========================================================================
   Nutrition stage — fuel the training (optional).

   The room has no statue. Its centrepiece is a balance (balance.js): what
   the day burns stands in one pan, what the day eats in the other, and the
   beam leans by how far eating is set from the burn. What the page says is
   written on the balance and moves with it: each side's total over its end
   of the beam, what a pan holds beside its rim (the weights by name, a
   meal a jar), what the needle reads under its point, the goal cut in the
   plinth. Under the plinth, the goals to pick from and the sum that made
   the numbers.

   It is seen in four shots, stepped through by the scroll, the footer or a
   press on a pan:

     whole   the balance and all it says
     burn    close on what is burned; beside it its readings (weight, the
             day outside training, the burn, how often and how long you
             train), set large as Measure's are
     eat     close on what is eaten; beside it its readings (the calorie
             change, protein, meals, the eating window, diet). The piece
             of the balance a reading changes pulses while it is in hand
     set     the balance alone, and two plain answers: it weighs right, or
             weigh it again

   The beam can be taken by the hand: pulling a pan down eats more or less
   against the burn, a percent at a time. A meal's line (or its jar, seen
   close) opens it in A day of eating: the day as a timeline with one meal
   open at a time, its share of the day, how far the day's targets are met
   by the end of it, and an example plate portioned to it. There the statue
   stands by again.

   On a phone, or without WebGL, there is no balance: the two sides stand
   in columns and a row is edited in place.

   Everything is read from and written to routine.nutrition (nutrition.js)
   and the routine's training settings; goals, activity levels, meal
   patterns, diets and meal ideas all come from data, so adding one there
   adds it here.
   ========================================================================= */

const nutrition = () => routine.nutrition;
const nutritionEl = $("nutrition-panel");
const fmtK = n => Math.round(n).toLocaleString("en-US");

/* What is open: the shot the balance is seen in (and, where there is no
   balance, the one row being edited); the day view and its meal; whether
   the key has been turned. */
const nut = { shot: "whole", row: null, day: false, meal: 0, dir: 1, reasons: false, turned: false, fresh: false };
const NUT_SHOTS = ["whole", "burn", "eat", "set"];
const NUT_SHOT_NAMES = { whole: "The whole balance", burn: "What you burn", eat: "What you eat", set: "Weigh it" };

/* A coin, as the footer's and Measure's: a beaded rim, a fine ring, the sign struck in the field. */
const nuCoinSVG = d => '<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="mzc-beads" cx="26" cy="26" r="24.2" pathLength="40"/>' +
  '<circle class="mzc-ring" cx="26" cy="26" r="20.5"/><path class="mzc-arr" d="' + d + '"/></svg>';
/* The two coins that step a reading: less, more. */
const nuCoins = (attr, less, more, lessLabel, moreLabel) => '<span class="nu-coins">' +
  '<button type="button" class="arm-coin" ' + attr + '="' + less + '" data-key="' + attr + less + '" aria-label="' + lessLabel + '">' + nuCoinSVG("M19 26h14") + '</button>' +
  '<button type="button" class="arm-coin" ' + attr + '="' + more + '" data-key="' + attr + more + '" aria-label="' + moreLabel + '">' + nuCoinSVG("M19 26h14M26 19v14") + '</button></span>';
/* A choice among words, the one chosen underlined. */
const nuWords = (label, items) => '<span class="nu-words" role="radiogroup" aria-label="' + label + '">' + items.join("") + '</span>';
const nuWord = (on, attr, value, text, extra = "") =>
  '<button type="button" role="radio" aria-checked="' + on + '" ' + attr + '="' + value + '" data-key="' + attr + '-' + value + '"' + extra + '>' + text + '</button>';
/* A reading beside the balance: its name, its figure with what steps it, a note; `piece` is the part of the balance it changes. */
const nuRead = (piece, name, fig, note = "", wide = false) => '<div class="nu-read' + (wide ? ' wide' : '') + '" data-piece="' + piece + '">' +
  '<span class="nu-read-n">' + name + '</span><div class="nu-read-v">' + fig + '</div>' + (note ? '<p class="nu-read-note">' + note + '</p>' : '') + '</div>';

/** What is burned, as readings: weight, the day outside training, the burn, the training. */
function burnReadings(n) {
  const muscles = routine.selectedMuscles(), load = n.load;
  return nuRead("base", '<label for="n-weight">Body weight</label>',
      '<input id="n-weight" class="nu-fig" type="number" min="' + weightBound(n, 0) + '" max="' + weightBound(n, 1) + '" step="0.5" inputmode="decimal" ' +
        'aria-describedby="weight-error"' + (n.isValid() ? '' : ' aria-invalid="true"') + ' value="' + (n.weight ?? "") + '">' +
      nuWords("Weight unit", ["kg", "lb"].map(u => nuWord(n.unit === u, "data-unit", u, u))) +
      nuCoins("data-weight-step", -0.5, 0.5, "Half a " + n.unit + " less", "Half a " + n.unit + " more")) +
    nuRead("base", '<label for="n-burn">Daily burn</label>',
      '<input id="n-burn" class="nu-fig" type="number" min="1000" max="6000" step="10" inputmode="numeric" value="' + (n.burnIsEstimate && !n.isValid() ? "" : n.burn) + '">' +
      '<span class="nu-unit-w">kcal</span>' + nuCoins("data-burn-step", -50, 50, "50 kcal less", "50 kcal more"),
      '<span id="burn-note">' + burnNoteHTML(n) + '</span>') +
    nuRead("base", '<span id="act-label">Outside training</span>',
      nuWords("Outside training", Object.entries(ACTIVITY_LEVELS).map(([key, a]) =>
        nuWord(n.burnIsEstimate && n.activity === key, "data-activity", key, a.label, ' title="' + esc(a.hint) + '"'))), "", true) +
    nuRead("training", '<span id="days-label">Training</span>',
      '<output class="nu-fig" aria-labelledby="days-label">' + routine.sessionsPerWeek + '</output><span class="nu-unit-w">days a week</span>' +
      nuCoins("data-days-step", -1, 1, "One day fewer", "One day more"),
      (muscles.length && !load.muscles.length ? 'No exercises in the database yet for these muscles, so no training is counted.'
        : !muscles.length ? 'No target muscles yet, so no training is counted. <button type="button" class="text-link" data-goto="targets">Pick targets</button>'
        : !load.kcalPerDay || (n.burnIsEstimate && !n.isValid()) ? 'The same numbers as the Week plan.'
        : n.burnIsEstimate ? tag(false, "Estimate") + ' ≈ ' + fmtK(load.kcalPerDay) + ' kcal a day on average: about ' + trainingHours(load.hours) + ' of lifting a week' + fewerDays(load.sessionsPerWeek) + '.'
        : 'Your own burn number already includes this training.')) +
    nuRead("training", 'Each session',
      nuWords("Session length", SESSION_LENGTH_OPTIONS.map(m => nuWord(routine.sessionMinutes === m, "data-len", m, m))) + '<span class="nu-unit-w">min</span>');
}

/** What is eaten, as readings: the calorie change, protein, meals, the eating window, the diet. */
function eatReadings(n) {
  const rec = n.recommended, goal = GOALS[n.goal].label.toLowerCase(), ok = n.isValid();
  const [plo, phi] = n.proteinRange;
  const mi = MEAL_COUNTS.indexOf(n.mealsPerDay);
  return nuRead("beam", '<span id="adjust-label">Calories against your burn</span>',
      '<output class="nu-fig" aria-labelledby="adjust-label">' + (n.adjust ? adjustLabel(n.adjust) : "level") + '</output>' +
      nuCoins("data-adjust-step", -0.01, 0.01, "1% fewer calories", "1% more calories"),
      n.adjustIsRecommended ? tag(false, "Recommended") + ' for ' + goal + ' with your training.'
        : tag(true, "Your setting") + ' Recommended: ' + adjustLabel(rec.adjust) + '. <button type="button" class="text-link" data-tune-reset="adjust" data-key="reset-adjust">Use it</button>') +
    nuRead("jars", '<span id="protein-label">Protein</span>',
      '<output class="nu-fig" aria-labelledby="protein-label">' + fmtGkg(n.proteinPerKg) + '</output><span class="nu-unit-w">g per kg</span>' +
      nuCoins("data-protein-step", -0.1, 0.1, "0.1 g per kg less", "0.1 g per kg more"),
      (n.proteinIsRecommended ? tag(false, "Recommended") + ' for ' + goal + '.'
        : tag(true, "Your setting") + ' Recommended: ' + fmtGkg(rec.protein) + '. <button type="button" class="text-link" data-tune-reset="protein" data-key="reset-protein">Use it</button>') +
      (ok ? ' ≈ ' + n.protein + ' g a day; the usual range is ' + plo + '–' + phi + ' g.' : '')) +
    nuRead("jars", '<span id="meals-label">Meals a day</span>',
      '<output class="nu-fig" aria-labelledby="meals-label">' + n.mealsPerDay + '</output>' +
      nuCoins("data-meals-to", MEAL_COUNTS[Math.max(0, mi - 1)], MEAL_COUNTS[Math.min(MEAL_COUNTS.length - 1, mi + 1)], "One meal fewer", "One meal more"),
      !ok ? "" : n.suggestedMeals !== n.mealsPerDay
        ? 'Suggested: ' + n.suggestedMeals + ', about ' + Math.round(n.protein / n.suggestedMeals) + ' g protein each. <button type="button" class="text-link" data-use-meals="' + n.suggestedMeals + '" data-key="use-meals">Use ' + n.suggestedMeals + '</button>'
        : 'The suggested number for your protein target.') +
    nuRead("jars", 'Eating between',
      '<span class="nu-span"><output class="nu-fig small">' + hourLabel(n.firstMeal) + '</output>' +
        nuCoins("data-first-to", Math.max(FIRST_HOUR, n.firstMeal - 1), Math.min(13, n.firstMeal + 1), "First meal an hour earlier", "First meal an hour later") + '</span>' +
      '<span class="nu-span"><span class="nu-unit-w">and</span><output class="nu-fig small">' + hourLabel(n.lastMeal) + '</output>' +
        nuCoins("data-last-to", Math.max(14, n.lastMeal - 1), Math.min(LAST_HOUR, n.lastMeal + 1), "Last meal an hour earlier", "Last meal an hour later") + '</span>') +
    nuRead("jars", 'Diet style',
      nuWords("Diet style", Object.entries(DIETS).map(([key, d]) => nuWord(n.diet === key, "data-diet", key, d.label))), "", true);
}

/* The example plate the user asked for on a meal ("Other ideas"), by meal
   index. Only that meal changes; the others keep the plates suggested. */
const ideaChosen = {};

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
/* What a goal would change for this training, short enough for its card. */
const goalAdjust = (goal, n) => { const a = recommendTargets(goal, n.load).adjust; return a ? adjustLabel(a) : "= burn"; };
const trainingHours = h => { const v = Math.round(h * 2) / 2; return v + (v === 1 ? " hour" : " hours"); };
const fmtWeight = n => (Math.round(n.weight * 10) / 10) + " " + n.unit;
const hourSpan = (a, b) => hourLabel(a) + "–" + hourLabel(b);
const tag = (own, text) => '<span class="pill-tag' + (own ? ' own' : '') + '">' + text + '</span>';

/* ---------------------------------- plan ---------------------------------- */

/** What the diet is fuelling, in one line under the title. */
function fuelsText(n) {
  const load = n.load;
  if (!routine.selectedMuscles().length)
    return "No target muscles yet, so no training is counted. Skip this if you only want training.";
  if (!load.muscles.length) return "No exercises in the database yet for your targets, so no training is counted.";
  const week = load.sessionsPerWeek + " × " + load.sessionMinutes + " min";
  const adds = !n.burnIsEstimate ? "; your own burn number already includes it."
             : n.isValid() ? ", adding ≈ " + fmtK(load.kcalPerDay) + " kcal a day to your burn." : ".";
  return routine.sessions.length
    ? "Fuels your " + week + " week" + adds
    : "Assumes " + week + " a week" + adds + " It updates when you set your week. Skip this if you only want training.";
}

/** The rows' one-line summaries. */
function rowSummaries(n) {
  const load = n.load;
  return {
    body: n.isValid() ? fmtWeight(n) + " · burns ≈ " + fmtK(n.burn) + " kcal a day" : "Add your body weight",
    training: !load.muscles.length ? "No training counted yet"
      : load.sessionsPerWeek + " × " + load.sessionMinutes + " min a week" +
        (load.sessionsPerWeek < routine.sessionsPerWeek ? " of " + routine.sessionsPerWeek + " offered" : "") +
        (n.burnIsEstimate && n.isValid() ? " · adds ≈ " + fmtK(load.kcalPerDay) + " kcal a day" : ""),
    targets: adjustLabel(n.adjust) + " calories · " + fmtGkg(n.proteinPerKg) + " g protein per kg",
    rhythm: n.mealsPerDay + " meals · " + hourSpan(n.hours[0], n.hours[n.hours.length - 1]) +
      " · " + DIETS[n.diet].label
  };
}
const ROWS = [["body", "You"], ["training", "Training"], ["targets", "Targets"], ["rhythm", "Rhythm"]];

/** What the burn is made of, under its figure. */
function burnParts(n) {
  if (!n.isValid()) return "Add your body weight to weigh the day.";
  if (!n.burnIsEstimate) return "Your own number, training included.";
  const day = Math.round(n.baseBurn / 10) * 10, tr = n.load.kcalPerDay;
  return "≈ " + fmtK(day) + " the day itself" + (tr ? ", ≈ " + fmtK(tr) + " your training" : "");
}
/** What the needle reads: how far eating is set from the burn. */
const needleText = n => !n.isValid() ? "" : n.adjust ? adjustLabel(n.adjust) : "level";

/** True where the page is laid out on the balance itself; false on a phone or without WebGL, where the sides stand in columns. */
const onScale = () => !Stages.narrow && scales.ok;

/** The plan on the balance, in the three parts drawn round it: the head, the shot's panel beside the balance, and what stands under the plinth. */
function scaleParts() {
  const n = nutrition(), ok = n.isValid(), shot = nut.shot;
  const goals = Object.entries(GOALS).map(([key, g]) =>
    '<button type="button" class="goal" role="radio" aria-checked="' + (n.goal === key) + '" ' +
      'data-goal="' + key + '" data-key="goal-' + key + '">' +
      '<span class="goal-top"><span class="goal-name">' + g.label + '</span>' +
        '<span class="goal-adj">' + goalAdjust(key, n) + '</span></span>' +
      '<span class="goal-blurb">' + g.blurb + '</span>' +
    '</button>').join("");
  const panel = shot === "burn"
    ? '<aside class="nu-panel" data-side="burn" data-reveal="1" aria-label="What you burn">' + burnReadings(n) + '</aside>'
    : shot === "eat"
    ? '<aside class="nu-panel" data-side="eat" data-reveal="1" aria-label="What you eat">' + eatReadings(n) + '</aside>'
    : '';
  const head = shot === "set"
    ? ['Does it weigh right?', ok ? '≈ ' + fmtK(n.kcal) + ' kcal and ' + n.protein + ' g protein a day, in ' + n.mealsPerDay + ' meals. An estimate to eat against.' : 'Nothing is weighed yet: it needs your body weight.']
    : ['Fuel the training', fuelsText(n)];
  const empty = routine.selection.isEmpty();
  const foot = shot === "set"
    ? '<div class="nu-set">' +
        '<div class="nu-answers">' +
          (empty ? '<button type="button" class="nu-answer" data-goto="targets" data-key="nu-yes">It weighs right: pick my muscles</button>'
                 : '<button type="button" class="nu-answer" id="nu-yes" data-key="nu-yes"' + (ok ? '' : ' disabled') + '>It weighs right</button>') +
          '<button type="button" class="nu-answer quiet" data-shot="whole" data-key="shot-whole">Weigh it again</button>' +
        '</div>' +
        '<p class="nu-set-note">' + (empty ? 'A week is planned round the muscles you pick.' : 'On to your week, planned round it.') + '</p>' +
      '</div>'
    : (shot === "whole" ? '<div class="goals' + (nut.turned ? ' turned' : '') + '" role="radiogroup" aria-label="Your goal">' + goals + '</div>' : '') +
      '<div class="nu-figures" id="nu-figures">' + figuresHTML(n) + '</div>' +
      (shot === "whole" ? '' : '<p class="nu-caveat">' + CAVEAT + '</p>');
  return {
    head: '<p class="eyebrow"><span><span class="n">' + STAGE_NUMERALS.nutrition + '</span> / Nutrition</span><span class="eyebrow-note">optional</span></p>' +
      '<h1 class="display nu-title" id="nutrition-title" tabindex="-1">' + head[0] + '</h1>' +
      '<p class="nu-lede" id="nu-fuels">' + esc(head[1]) + '</p>',
    panel, foot
  };
}

function planHTML() {
  const n = nutrition(), sums = rowSummaries(n), ok = n.isValid();
  const goals = Object.entries(GOALS).map(([key, g]) =>
    '<button type="button" class="goal" role="radio" aria-checked="' + (n.goal === key) + '" ' +
      'data-goal="' + key + '" data-key="goal-' + key + '">' +
      '<span class="goal-top"><span class="goal-name">' + g.label + '</span>' +
        '<span class="goal-adj">' + goalAdjust(key, n) + '</span></span>' +
      '<span class="goal-blurb">' + g.blurb + '</span>' +
    '</button>').join("");
  const below = false, label = key => ROWS.find(r => r[0] === key)[1];
  const row = key => {
    const open = nut.row === key;
    return '<div class="nu-row' + (open ? ' open' : '') + '">' +
      '<button type="button" class="row-toggle" data-row="' + key + '" data-key="row-' + key + '" ' +
        'aria-expanded="' + open + '"' + (open ? ' aria-controls="row-' + key + '"' : '') + '>' +
        '<span class="row-label">' + label(key) + '</span>' +
        '<span class="row-sum" data-row-sum="' + key + '">' + esc(sums[key]) + '</span>' +
        '<span class="row-act">' + (open ? "Done" : "Edit") + '</span>' +
      '</button>' +
      (open && !below ? '<div class="row-body" id="row-' + key + '">' + ROW_BODIES[key](n) + '</div>' : '') +
    '</div>';
  };
  const rows = keys => '<div class="nu-rows">' + keys.map(row).join("") + '</div>';
  return '<div class="nu-plan">' +
    '<div class="nu-head" data-reveal="0">' +
      '<p class="eyebrow"><span><span class="n">' + STAGE_NUMERALS.nutrition + '</span> / Nutrition</span><span class="eyebrow-note">optional</span></p>' +
      '<h1 class="display nu-title" id="nutrition-title" tabindex="-1">Fuel the training</h1>' +
      '<p class="nu-lede" id="nu-fuels">' + esc(fuelsText(n)) + '</p>' +
    '</div>' +
    '<div class="nu-side nu-burn" data-reveal="1">' +
      '<p class="nu-side-h">What you burn</p>' +
      '<p class="nu-num"><span class="nu-kcal" id="nu-burn-n">' + (ok ? "≈ " + fmtK(n.burn) : "—") + '</span><span class="nu-unit">kcal a day</span></p>' +
      '<p class="nu-parts" id="nu-burn-parts">' + esc(burnParts(n)) + '</p>' +
      rows(["body", "training"]) +
      '<p class="note-rule">' + CAVEAT + '</p>' +
    '</div>' +
    '<div class="nu-mid" id="nu-mid"></div>' +
    '<div class="nu-side nu-eat" data-reveal="1">' +
      '<p class="nu-side-h">What you eat</p>' +
      '<p class="nu-num"><span class="nu-kcal" id="nu-eat-n">' + (ok ? "≈ " + fmtK(n.kcal) : "—") + '</span><span class="nu-unit">kcal a day</span></p>' +
      '<p class="nu-parts"><span class="nu-prot" id="nu-prot-n">' + (ok ? n.protein : "—") + '</span> g protein, in <span id="nu-meals-n">' + n.mealsPerDay + '</span> meals</p>' +
      rows(["targets", "rhythm"]) +
      '<button type="button" class="btn ghost" id="open-day" data-key="open-day"' + (ok ? '' : ' disabled') + '>See a day of eating →</button>' +
    '</div>' +
    '<div class="nu-foot" data-reveal="2">' +
      '<div class="goals' + (nut.turned ? ' turned' : '') + '" role="radiogroup" aria-label="Your goal">' + goals + '</div>' +
      '<div class="nu-figures" id="nu-figures">' + figuresHTML(n) + '</div>' +
    '</div>' +
  '</div>';
}

/** The sum that made the day's two targets, what to know about them, and every reason on demand. */
function figuresHTML(n) {
  if (!n.isValid())
    return '<p class="nu-math" id="weight-error">Enter a body weight between ' + weightRangeText() + ' to see your plan.</p>';
  const g = GOALS[n.goal];
  const math = n.adjust
    ? fmtK(n.burn) + ' kcal burn ' + (n.adjust > 0 ? '+ ' : '− ') + Math.round(Math.abs(n.adjust) * 100) + '% for ' + g.label.toLowerCase()
    : fmtK(n.burn) + ' kcal burn, unchanged for ' + g.label.toLowerCase();
  return '<div class="nu-mathline">' +
      tag(false, "Estimate") +
      '<span class="nu-math">' + math + ' · ' + fmtGkg(n.proteinPerKg) + ' g per kg</span>' +
      '<button type="button" class="text-link" id="nu-reasons" data-key="reasons" aria-expanded="' + nut.reasons + '">' +
        (nut.reasons ? "Hide the reasoning" : "How it's worked out") + '</button>' +
    '</div>' +
    (n.atFloor ? '<p class="nu-warn">' + floorText(n) + '</p>' : '') +
    (n.protein * 4 > n.kcal * PROTEIN_SHARE_HIGH ? '<p class="nu-warn">' + n.protein + ' g of protein is about ' +
      Math.round(n.protein * 400 / n.kcal) + '% of these calories, above the ' + Math.round(PROTEIN_SHARE_HIGH * 100) +
      '% that is the top of the usual range. Consider a lower g per kg (Targets), especially with a lot of body fat.</p>' : '') +
    (nut.reasons ? '<ul class="nu-reasons">' + planReasons(n).map(r => '<li>' + r + '</li>').join("") + '</ul>' : '');
}

/* -------------------------------- the rows -------------------------------- */

const stepper = (attr, step, label, text) =>
  '<button type="button" class="stepper" ' + attr + '="' + step + '" data-key="' + attr + step + '" aria-label="' + label + '">' + text + '</button>';
const segmented = (label, items, small) =>
  '<span class="segmented' + (small ? ' small' : '') + '" role="radiogroup" aria-label="' + label + '">' + items.join("") + '</span>';
const segBtn = (on, attr, value, text, extra = "") =>
  '<button type="button" role="radio" aria-checked="' + on + '" ' + attr + '="' + value + '" data-key="' + attr + '-' + value + '"' + extra + '>' + text + '</button>';

function burnNoteHTML(n) {
  if (n.burnIsEstimate && !n.isValid())
    return tag(false, "Estimate") + '<span>needs your body weight. Know your number? Type it in.</span>';
  if (n.burnIsEstimate)
    return tag(false, "Estimate") + '<span>From ' + fmtWeight(n) + ', ' +
      ACTIVITY_LEVELS[n.activity].label.toLowerCase() + ' outside training' +
      (n.load.kcalPerDay ? ', plus your training' : '') + '. Know your number? Type it in.</span>';
  return tag(true, "Your number") + '<span>' + (n.burnHeld ? 'Held to the ' + fmtK(BURN_RANGE[0]) + '–' +
      fmtK(BURN_RANGE[1]) + ' kcal range. ' : '') + 'Include your training in it.</span>' +
    '<button type="button" class="text-link" id="burn-reset" data-key="burn-reset">Estimate it for me</button>';
}

const ROW_BODIES = {
  body(n) {
    return '<div class="kv"><label class="kv-label" for="n-weight">Body weight</label>' +
        '<input id="n-weight" class="serif-input" type="number" min="' + weightBound(n, 0) + '" max="' + weightBound(n, 1) +
          '" step="0.5" inputmode="decimal" aria-describedby="weight-error"' + (n.isValid() ? '' : ' aria-invalid="true"') + ' ' +
          'value="' + (n.weight ?? "") + '">' +
        segmented("Weight unit", ["kg", "lb"].map(u => segBtn(n.unit === u, "data-unit", u, u)), true) +
      '</div>' +
      '<div class="kv top"><span class="kv-label" id="act-label">Outside training</span>' +
        '<span class="pills" role="radiogroup" aria-labelledby="act-label">' +
          Object.entries(ACTIVITY_LEVELS).map(([key, a]) =>
            '<button type="button" class="pill" role="radio" aria-checked="' + (n.burnIsEstimate && n.activity === key) + '" ' +
              'data-activity="' + key + '" data-key="act-' + key + '" title="' + esc(a.hint) + '">' + a.label + '</button>').join("") +
        '</span>' +
      '</div>' +
      '<div class="kv"><label class="kv-label" for="n-burn">Daily burn</label>' +
        stepper("data-burn-step", -50, "50 kcal less", "−") +
        '<input id="n-burn" class="serif-input wide" type="number" min="1000" max="6000" step="10" inputmode="numeric" ' +
          'value="' + (n.burnIsEstimate && !n.isValid() ? "" : n.burn) + '">' +
        stepper("data-burn-step", 50, "50 kcal more", "+") +
        '<span class="unit">kcal</span>' +
      '</div>' +
      '<p class="kv-note" id="burn-note">' + burnNoteHTML(n) + '</p>';
  },

  training(n) {
    const muscles = routine.selectedMuscles(), src = routine.selection.source();
    const name = src.kind === "program" ? src.program.name
               : src.kind === "modified" ? src.program.name + " (edited)" : "Your own selection";
    const load = n.load;
    return '<p class="row-note">' + (muscles.length
        ? '<b>' + esc(name) + '</b> · ' + muscles.length + (muscles.length === 1 ? " muscle" : " muscles") + ' '
        : 'No target muscles yet, so no training is counted. ') +
        '<button type="button" class="text-link" data-goto="targets">' + (muscles.length ? "Change" : "Pick targets") + '</button></p>' +
      '<div class="kv-row">' +
        '<div class="kv-col"><span class="kv-label" id="days-label">Days a week</span>' +
          '<span class="kv">' + stepper("data-days-step", -1, "One day fewer", "−") +
            '<output class="serif-out narrow" aria-labelledby="days-label">' + routine.sessionsPerWeek + '</output>' +
            stepper("data-days-step", 1, "One day more", "+") + '</span></div>' +
        '<div class="kv-col"><span class="kv-label">Session length</span>' +
          segmented("Session length", SESSION_LENGTH_OPTIONS.map(m =>
            segBtn(routine.sessionMinutes === m, "data-len", m, m + " min"))) + '</div>' +
      '</div>' +
      '<p class="kv-note flush">' + (
          muscles.length && !load.muscles.length ? 'No exercises in the database yet for these muscles, so no training is counted.'
        : !load.kcalPerDay || (n.burnIsEstimate && !n.isValid()) ? 'The same numbers as the Week plan: change them here or there.'
        : n.burnIsEstimate
        ? tag(false, "Estimate") + '<span>≈ ' + fmtK(load.kcalPerDay) + ' kcal a day on average, added to your burn: about ' +
          trainingHours(load.hours) + ' of lifting a week' + fewerDays(load.sessionsPerWeek) + ', the sets your targets take with warm-ups.</span>'
        : 'Your own burn number already includes this training, so nothing is added to it.') + '</p>';
  },

  targets(n) {
    const rec = n.recommended, goal = GOALS[n.goal].label.toLowerCase();
    const [plo, phi] = n.proteinRange;
    return '<div class="tunes">' +
      '<div class="tune"><span class="kv-label" id="adjust-label">Calories against your burn</span>' +
        '<span class="kv">' + stepper("data-adjust-step", -0.01, "1% fewer calories", "−") +
          '<output class="serif-out" aria-labelledby="adjust-label">' + adjustLabel(n.adjust) + '</output>' +
          stepper("data-adjust-step", 0.01, "1% more calories", "+") + '</span>' +
        '<p class="kv-note flush">' + (n.adjustIsRecommended
          ? tag(false, "Recommended") + '<span>for ' + goal + ' with your training.</span>'
          : tag(true, "Your setting") + '<span>Recommended: ' + adjustLabel(rec.adjust) + '.</span>' +
            '<button type="button" class="text-link" data-tune-reset="adjust" data-key="reset-adjust">Use it</button>') + '</p>' +
      '</div>' +
      '<div class="tune"><span class="kv-label" id="protein-label">Protein</span>' +
        '<span class="kv">' + stepper("data-protein-step", -0.1, "0.1 g per kg less", "−") +
          '<output class="serif-out" aria-labelledby="protein-label">' + fmtGkg(n.proteinPerKg) + '</output>' +
          stepper("data-protein-step", 0.1, "0.1 g per kg more", "+") + '<span class="unit">g per kg</span></span>' +
        '<p class="kv-note flush">' + (n.proteinIsRecommended
          ? tag(false, "Recommended") + '<span>for ' + goal + ' with your training.</span>'
          : tag(true, "Your setting") + '<span>Recommended: ' + fmtGkg(rec.protein) + ' g/kg.</span>' +
            '<button type="button" class="text-link" data-tune-reset="protein" data-key="reset-protein">Use it</button>') + '</p>' +
        (n.isValid() ? '<p class="kv-note flush faint">≈ ' + n.protein + ' g a day · usual range ' + plo + '–' + phi + ' g</p>' : '') +
      '</div>' +
    '</div>';
  },

  rhythm(n) {
    const hourOptions = (from, to, now) => Array.from({ length: to - from + 1 }, (_, i) => from + i).map(h =>
      '<option value="' + h + '"' + (h === now ? ' selected' : '') + '>' + hourLabel(h) + '</option>').join("");
    const suggest = !n.isValid() ? ""
      : n.suggestedMeals !== n.mealsPerDay
      ? '<p class="kv-note flush">Suggested: <b>' + n.suggestedMeals + ' meals</b>, about ' +
        Math.round(n.protein / n.suggestedMeals) + ' g protein each. ' +
        '<button type="button" class="text-link" data-use-meals="' + n.suggestedMeals + '" data-key="use-meals">Use ' +
        n.suggestedMeals + '</button></p>'
      : '<p class="kv-note flush faint">The suggested number of meals for your protein target.</p>';
    return '<div class="kv-row">' +
        '<div class="kv-col"><span class="kv-label">Meals a day</span>' +
          segmented("Meals a day", MEAL_COUNTS.map(c => segBtn(n.mealsPerDay === c, "data-meals", c,
            c + (c === n.suggestedMeals && n.isValid() ? '<span class="sug" aria-hidden="true"></span>' : ''),
            c === n.suggestedMeals ? ' title="Suggested for your protein target"' : ''))) + '</div>' +
        '<label class="kv-col"><span class="kv-label">First meal</span>' +
          '<select class="select" id="first-meal" data-key="first-meal">' + hourOptions(FIRST_HOUR, 13, n.firstMeal) + '</select></label>' +
        '<label class="kv-col"><span class="kv-label">Last meal</span>' +
          '<select class="select" id="last-meal" data-key="last-meal">' + hourOptions(14, LAST_HOUR, n.lastMeal) + '</select></label>' +
      '</div>' + suggest +
      '<div class="kv-col"><span class="kv-label">Diet style</span>' +
        segmented("Diet style", Object.entries(DIETS).map(([key, d]) => segBtn(n.diet === key, "data-diet", key, d.label))) +
      '</div>';
  }
};

/** Why fewer training days count than were asked for, if they do. */
function fewerDays(counted) {
  const asked = routine.sessionsPerWeek, free = routine.availableDays().length;
  if (counted >= asked) return "";
  const d = x => x + (x === 1 ? " day" : " days");
  if (routine.sessions.length === counted && counted < Math.min(asked, free))
    return " (" + d(counted) + " in your generated week)";
  if (free === counted)
    return " (only " + d(free) + " of the week " + (free === 1 ? "is" : "are") + " free to train)";
  return " (your targets use " + counted + " of the " + d(asked) + " you offered; the rest are rest days)";
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
      '. A rough start: height, age, sex and body composition move it, so your own number is better.');
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
    out.push('<b>Targets:</b> ' + load.muscles.length +
      (load.muscles.length === 1 ? " muscle" : " muscles") + ', about ' + pct(load.coverage) +
      ' of a full-body week\'s training volume' +
      (untrained ? ' (' + untrained + ' more with no exercises yet, not counted).' : '.'));
    out.push('<b>Training:</b> ' + load.sessionsPerWeek + ' × ' + load.sessionMinutes + ' min a week' +
      fewerDays(load.sessionsPerWeek) +
      '; your targets\' sets take about ' + trainingHours(load.hours) + ' of it' +
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

/** The day's meals, each with the example plate it shows (no plate repeated if avoidable). */
function mealsWithIdeas(n) {
  const shown = new Set();
  const suggested = n.meals.map(m => {
    const ranked = mealIdeasFor(m, n.diet, shown);
    if (ranked.length) shown.add(ranked[0].idea);
    return { m, ranked };
  });
  return suggested.map(({ m, ranked }) => {
    const own = ideaChosen[m.index] && ranked.find(r => r.idea === ideaChosen[m.index]);
    return { ...m, pick: own || ranked[0] || null, choices: ranked.length };
  });
}

/** The next plate for meal `index`, past the one it shows, not one another meal shows. */
function nextIdea(index) {
  const n = nutrition(), meals = mealsWithIdeas(n), cm = meals.find(m => m.index === index);
  if (!cm || !cm.pick) return;
  const others = new Set(meals.filter(m => m !== cm && m.pick).map(m => m.pick.idea));
  const ranked = mealIdeasFor(cm, n.diet);
  const pool = ranked.filter(r => !others.has(r.idea));
  const list = pool.length > 1 ? pool : ranked;
  const i = list.findIndex(r => r.idea === cm.pick.idea);
  ideaChosen[index] = list[(i + 1) % list.length].idea;
}

function dayHTML() {
  const n = nutrition(), meals = mealsWithIdeas(n);
  const mi = Math.min(nut.meal, meals.length - 1), cm = meals[mi];
  const hours = meals.map(m => m.hour);
  const t0 = Math.min(...hours) - 1, t1 = Math.max(...hours) + 1;
  const at = h => ((h - t0) / (t1 - t0) * 100).toFixed(2) + "%";
  // Names under the stops only where they have room to sit side by side.
  const gap = Math.min(99, ...hours.slice(1).map((h, i) => h - hours[i])) / (t1 - t0);
  const names = gap > 0.15 && !Stages.narrow;
  let beforeK = 0, beforeP = 0;
  meals.slice(0, mi).forEach(m => { beforeK += m.kcal; beforeP += m.protein; });
  const pct = v => Math.min(100, v * 100).toFixed(1) + "%";
  const [lo, hi] = n.hourBounds(cm.index);
  const times = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map(h =>
    '<option value="' + h + '"' + (h === cm.hour ? ' selected' : '') + '>' + hourLabel(h) + '</option>').join("");

  const stops = meals.map((m, i) =>
    '<button type="button" class="stop' + (i < mi ? ' past' : '') + '" role="tab" aria-selected="' + (i === mi) + '" ' +
      'data-meal="' + i + '" data-key="meal-' + i + '" tabindex="' + (i === mi ? 0 : -1) + '" style="left:' + at(m.hour) + '" ' +
      'aria-label="' + esc(m.name) + ', ' + hourLabel(m.hour) + ', ' + fmtK(m.kcal) + ' kcal">' +
      '<span class="stop-dot-wrap"><span class="stop-dot" style="--s:' + (10 + m.share * 36).toFixed(1) + 'px"></span></span>' +
      '<span class="stop-time">' + hourLabel(m.hour) + '</span>' +
      (names ? '<span class="stop-name">' + esc(m.name) + '</span>' : '') +
    '</button>').join("");
  const segs = meals.map((m, i) =>
    '<button type="button" class="seg' + (i === mi ? ' on' : i < mi ? ' past' : '') + '" style="flex:' + m.kcal + '" ' +
      'data-meal="' + i + '" tabindex="-1" aria-label="' + esc(m.name) + ', ' + fmtK(m.kcal) + ' kcal"></button>').join("");
  const p = cm.pick;

  return '<div class="day-head" data-reveal="0">' +
      '<button type="button" class="quiet-btn" id="close-day" data-key="close-day">← Your daily plan</button>' +
      '<h1 class="display" id="nutrition-title" tabindex="-1">A day of eating</h1>' +
      '<p class="nu-lede">' + tag(false, "Estimate") + ' ' + fmtK(n.kcal) + ' kcal and ' + n.protein +
        ' g protein across ' + n.mealsPerDay + ' meals, with an example plate for each. Plates come in everyday ' +
        'portions, so they land near a meal\'s numbers rather than on them. Swap in foods you like with similar numbers.</p>' +
      (n.atFloor ? '<p class="nu-warn">' + floorText(n) + '</p>' : '') +
    '</div>' +
    '<div class="day-body" data-reveal="1">' +
      '<div class="meal-line' + (names ? ' named' : '') + '" role="tablist" aria-label="Meals">' + stops + '</div>' +
      '<div class="meal-segs-wrap">' +
        '<div class="meal-segs">' + segs + '</div>' +
        '<span class="meal-share">' + esc(cm.name) + ' is ' + Math.round(cm.share * 100) + '% of the day · ' +
          fmtK(beforeK + cm.kcal) + ' of ' + fmtK(n.kcal) + ' kcal eaten by ' + hourLabel(cm.hour) + '</span>' +
      '</div>' +
      '<article class="meal-card" id="meal-card" aria-live="polite">' +
        '<header class="meal-card-head">' +
          '<div class="meal-card-title">' +
            '<span class="eyebrow meal-when"><span class="picker meal-time"><span class="picker-label" aria-hidden="true">' +
              hourLabel(cm.hour) + '</span><select data-move="' + cm.index + '" data-key="move" aria-label="' + esc(cm.name) +
              ' time">' + times + '</select></span><span>· ' + (mi + 1) + ' of ' + meals.length + '</span></span>' +
            '<span class="meal-name">' + esc(cm.name) + '</span>' +
          '</div>' +
          '<div class="meal-nav">' +
            '<button type="button" class="round-btn big" data-meal-step="-1" data-key="meal-prev" aria-label="Previous meal"' + (mi === 0 ? ' disabled' : '') + '>←</button>' +
            '<button type="button" class="round-btn big" data-meal-step="1" data-key="meal-next" aria-label="Next meal"' + (mi === meals.length - 1 ? ' disabled' : '') + '>→</button>' +
          '</div>' +
        '</header>' +
        '<div class="meal-figs">' +
          '<span><b>' + fmtK(cm.kcal) + '</b> kcal</span>' +
          '<span><b>' + cm.protein + '</b> g protein</span>' +
          '<span class="meal-of">' + Math.round(cm.share * 100) + '% of the day</span>' +
        '</div>' +
        '<div class="meal-progress">' +
          [["Calories by the end of " + cm.name.toLowerCase() + ": " + fmtK(beforeK + cm.kcal) + " / " + fmtK(n.kcal), beforeK / n.kcal, cm.kcal / n.kcal],
           ["Protein: " + (beforeP + cm.protein) + " / " + n.protein + " g", beforeP / n.protein, cm.protein / n.protein]]
            .map(([label, before, now]) =>
              '<div class="bar-block"><span class="bar-label">' + label + '</span>' +
                '<span class="bar"><span class="bar-before" style="width:' + pct(before) + '"></span>' +
                '<span class="bar-now" style="left:' + pct(before) + ';width:' + pct(now) + '"></span></span></div>').join("") +
        '</div>' +
        '<div class="meal-idea">' +
          '<span class="meal-focus">' + esc(cm.focus) + '</span>' +
          (p
            ? '<span class="idea-head"><span class="idea-name">' + esc(p.idea.name) + '</span>' +
                '<span class="idea-nums">' + p.kcal + ' kcal · ' + p.protein + ' g' + plateGap(p, cm) + '</span></span>' +
              '<ul class="idea-foods">' + p.foods.map(([id, g]) =>
                '<li><span>' + esc(FOODS[id].name) + '</span><span>' + amountLabel(id, g) + '</span></li>').join("") + '</ul>' +
              (cm.choices > 1 ? '<button type="button" class="text-link" data-more="' + cm.index + '" data-key="more">Other ideas ↻</button>' : '')
            : '<p class="kv-note flush">No example meals for this diet and meal yet.</p>') +
        '</div>' +
      '</article>' +
      '<p class="note-rule">' + CAVEAT + '</p>' +
    '</div>';
}

/* How far a plate is from its meal, when that is more than a little. */
function plateGap(plate, meal) {
  const off = (plate.kcal - meal.kcal) / meal.kcal;
  return Math.abs(off) < 0.15 ? "" : ' <span class="faint">(about ' + Math.round(Math.abs(off) * 100) + '% ' +
    (off > 0 ? 'more' : 'less') + ' than this meal)</span>';
}

/** Opens another meal: the card slides out and the next one in. */
function pickMeal(i) {
  const count = nutrition().meals.length;
  if (i < 0 || i >= count || i === nut.meal) return;
  const card = $("meal-card");
  nut.dir = i > nut.meal ? 1 : -1;
  if (!card || reducedMotion()) { nut.meal = i; renderNutritionStage(); return; }
  card.style.setProperty("--dir", nut.dir);
  card.classList.add("out");
  clearTimeout(nut.timer);
  nut.timer = setTimeout(() => {
    nut.meal = i;
    renderNutritionStage();
    // The new card comes in from the side the old one left towards.
    const fresh = $("meal-card");
    fresh.style.setProperty("--dir", -nut.dir);
    fresh.classList.add("out", "instant");
    requestAnimationFrame(() => requestAnimationFrame(() => fresh.classList.remove("out", "instant")));
  }, 160);
}

/* -------------------------------- drawing --------------------------------- */

function renderNutritionStage() {
  // Remember what had focus: the panel is redrawn after every change.
  const active = document.activeElement;
  const focusKey = active && nutritionEl.contains(active) ? (active.dataset.key || active.id) : null;
  const day = nut.day && nutrition().isValid();
  // The balance is one element, kept through every redraw: it steps out
  // while the panel is rebuilt and back into its place in the plan.
  if (!day && onScale()) {
    // On the balance only the words round it are redrawn: the balance stays where it is, mid-move or not.
    let plan = nutritionEl.querySelector(".nu-plan.scale");
    if (!plan) {
      balanceEl.remove();
      nutritionEl.innerHTML = '<div class="nu-plan scale"><div class="nu-head" data-reveal="0"></div>' +
        '<div class="nu-mid" id="nu-mid"><div class="nu-slot"></div></div><div class="nu-foot" data-reveal="2"></div></div>';
      plan = nutritionEl.firstChild;
      $("nu-mid").append(balanceEl);
    }
    const parts = scaleParts();
    plan.dataset.shot = nut.shot;
    plan.querySelector(".nu-head").innerHTML = parts.head;
    plan.querySelector(".nu-slot").innerHTML = parts.panel;
    plan.querySelector(".nu-foot").innerHTML = parts.foot;
  } else {
    balanceEl.remove();
    nutritionEl.innerHTML = day ? dayHTML() : planHTML();
    const mid = $("nu-mid");
    if (mid) mid.append(balanceEl);
  }
  $("stage-nutrition").dataset.view = Stages.root.dataset.nview = day ? "day" : "plan";
  balanceEl.dataset.shot = nut.shot;
  nut.turned = false;
  if (!day) rollFigures();
  paintBalance();
  if (focusKey) {
    focusAgain(nutritionEl.querySelector('[data-key="' + focusKey + '"]') || $(focusKey));
  }
}

/**
 * Repaints what a typed weight or burn, or the beam in the hand, changes,
 * in place: the field the user is typing in is never rebuilt, so nothing
 * under their hands moves.
 */
function paintNutritionFigures() {
  const n = nutrition(), sums = rowSummaries(n), ok = n.isValid();
  if ($("nu-figures")) $("nu-figures").innerHTML = figuresHTML(n);
  if ($("nu-fuels") && nut.shot !== "set") $("nu-fuels").textContent = fuelsText(n);
  if ($("nu-burn-parts")) $("nu-burn-parts").textContent = burnParts(n);
  rollFigures();
  for (const b of nutritionEl.querySelectorAll("[data-goal]"))
    b.querySelector(".goal-adj").textContent = goalAdjust(b.dataset.goal, n);
  const out = nutritionEl.querySelector('output[aria-labelledby="adjust-label"]');
  if (out) out.textContent = out.classList.contains("nu-fig") && !n.adjust ? "level" : adjustLabel(n.adjust);
  for (const [key, text] of Object.entries(sums)) {
    const el = nutritionEl.querySelector('[data-row-sum="' + key + '"]');
    if (el) el.textContent = text;
  }
  const burn = $("n-burn");
  if (burn && document.activeElement !== burn) burn.value = n.burnIsEstimate && !n.isValid() ? "" : n.burn;
  if ($("burn-note")) $("burn-note").innerHTML = burnNoteHTML(n);
  if ($("open-day")) $("open-day").disabled = !ok;
  const weight = $("n-weight");
  if (weight) { if (ok) weight.removeAttribute("aria-invalid"); else weight.setAttribute("aria-invalid", "true"); }
  paintBalance();
}

/* The plan's three large figures turn to a new value instead of changing
   at once: what each shows now, by its element's id. */
const rolled = {};
function rollTo(id, to, text, wait = 0) {
  const r = rolled[id] || (rolled[id] = { v: null, raf: 0, timer: 0 });
  cancelAnimationFrame(r.raf); clearTimeout(r.timer);
  // The balance's own figures are looked up in it: it is out of the page while a day of eating is open.
  const put = v => { const el = $(id) || balanceEl.querySelector("#" + id); if (el) el.textContent = v === null ? "—" : text(Math.round(v)); };
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
/** Turns the burn, the calories and the protein to the plan's; `arrive` counts them up as the pans are loaded. */
function rollFigures(arrive = false) {
  const n = nutrition(), ok = n.isValid(), late = arrive ? BalanceScene.SET_DOWN.jar : 0;
  // The same three figures stand in the columns (a phone) and on the balance.
  for (const at of ["nu-", "bal-"]) {
    if (arrive && ok) for (const id of ["burn-n", "eat-n", "prot-n"]) (rolled[at + id] || (rolled[at + id] = {})).v = 0;
    rollTo(at + "burn-n", ok ? n.burn : null, v => "≈ " + fmtK(v), arrive ? BalanceScene.SET_DOWN.base : 0);
    rollTo(at + "eat-n", ok ? n.kcal : null, v => "≈ " + fmtK(v), late);
    rollTo(at + "prot-n", ok ? n.protein : null, String, late);
  }
}

/* ------------------------------- the balance ------------------------------- */

/* The way in to a side: a coin, as the footer's and Measure's, and what it does in words. */
function balGo(side, text) {
  return '<button type="button" class="bal-go" data-shot="' + side + '" data-key="go-' + side + '">' +
    '<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="mzc-beads" cx="26" cy="26" r="24.2" pathLength="40"/>' +
    '<circle class="mzc-ring" cx="26" cy="26" r="20.5"/><path class="mzc-arr" d="M19 26h14M26 19v14"/></svg><span>' + text + '</span></button>';
}

/* The balance (balance.js) and what is written on it. The labels are made
   once and kept through every redraw, each set where its piece of the
   balance is as it draws, so the words swing with the beam. */
const balanceEl = $("balance");
balanceEl.insertAdjacentHTML("beforeend",
  '<div class="bal-total" id="bal-total-burn"><span class="bal-total-h">What you burn</span>' +
    '<span class="bal-total-n"><b id="bal-burn-n"></b><i>kcal a day</i></span></div>' +
  '<div class="bal-total" id="bal-total-eat"><span class="bal-total-h">What you eat</span>' +
    '<span class="bal-total-n"><b id="bal-eat-n"></b><i>kcal a day</i></span>' +
    '<span class="bal-total-p"><b id="bal-prot-n"></b> g protein<span class="bal-total-l" id="bal-lean-eat"></span></span></div>' +
  '<div class="bal-lean" id="bal-lean"><b></b><small></small></div>' +
  '<div class="bal-legend" id="bal-legend-burn" data-side="burn"></div>' +
  '<div class="bal-legend" id="bal-legend-eat" data-side="eat"></div>' +
  '<span class="bal-label bal-plinth" id="bal-plinth"></span>');
/* Its labels by name: the balance is out of the page while a day of eating is open, where $() cannot find them. */
const balPart = name => balanceEl.querySelector("#bal-" + name);
const scales = new BalanceScene(balanceEl.querySelector("canvas"));
balanceEl.hidden = !scales.ok;
const bal = { drag: null, jar: -1 };

/** What a pan holds, written beside its rim: the weights by name, a meal a jar. */
function legendHTML(side, n) {
  const row = (name, fig, note, attrs = "") => '<' + (attrs ? 'button type="button"' : 'span') + ' class="bal-row"' + attrs + '>' +
    '<i>' + name + '</i><b>' + fig + '</b><small>' + note + '</small></' + (attrs ? 'button' : 'span') + '>';
  if (!n.isValid())
    return side === "burn" ? '<button type="button" class="bal-row bal-ask" data-shot="burn" data-key="ask-weight"><i>Add your body weight</i><small>to weigh the day</small></button>' : '';
  if (side === "burn") {
    const load = n.load;
    if (!n.burnIsEstimate) return row("Your own number", "≈ " + fmtK(n.burn), "training included") + balGo("burn", "Change what you burn");
    return row("The day itself", "≈ " + fmtK(Math.round(n.baseBurn / 10) * 10), fmtWeight(n) + ", " + ACTIVITY_LEVELS[n.activity].label.toLowerCase()) +
      (load.kcalPerDay ? row("Your training", "≈ " + fmtK(load.kcalPerDay), load.sessionsPerWeek + " × " + load.sessionMinutes + " min a week") : '') +
      balGo("burn", "Change what you burn");
  }
  return n.meals.map((m, i) => row(esc(m.name), fmtK(m.kcal), hourLabel(m.hour) + ", " + m.protein + " g protein",
      ' data-meal-open="' + i + '" data-key="meal-open-' + i + '" aria-label="' + esc(m.name) + ", " + hourLabel(m.hour) + ", " + fmtK(m.kcal) + ' kcal: see it in a day of eating"')).join("") +
    '<span class="bal-row bal-sum"><small>' + adjustLabel(n.adjust) + ' calories, ' + fmtGkg(n.proteinPerKg) + ' g protein per kg, ' + DIETS[n.diet].label.toLowerCase() + '</small></span>' +
    balGo("eat", "Change what you eat");
}

/** Loads the pans from the plan and writes its labels; `arrive` sets the beam swinging from level and empty. */
function paintBalance(arrive = false) {
  const n = nutrition(), ok = n.isValid();
  if (!scales.ok) return;
  if (arrive) scales.arrive();
  scales.shotTo(nut.shot, arrive);
  scales.set({
    tilt: ok ? (n.atFloor ? n.kcal / n.burn - 1 : n.adjust) : null,
    base: n.burnIsEstimate ? n.baseBurn : n.burn,
    training: n.burnIsEstimate ? n.load.kcalPerDay : 0,
    meals: ok ? n.meals.map(m => m.share) : []
  });
  // How far eating is set from the burn, over the fulcrum between the two totals (and under the eating total, seen close).
  const lean = balPart("lean");
  lean.firstChild.textContent = needleText(n);
  lean.lastChild.textContent = !ok ? "" : n.adjust ? (n.adjust > 0 ? "eaten over the burn" : "eaten under the burn") : "eating equals the burn";
  balPart("lean-eat").textContent = ok ? ", " + (n.adjust ? adjustLabel(n.adjust) + " against the burn" : "level with the burn") : "";
  balPart("plinth").textContent = GOALS[n.goal].label;
  balPart("legend-burn").innerHTML = legendHTML("burn", n);
  balPart("legend-eat").innerHTML = legendHTML("eat", n);
  placeBalanceLabels();
}

/**
 * Sets what is written where the balance now is: called as it draws, so it
 * all swings with it. Seen close, a side's total stands at the head of the
 * room instead (its end of the beam is out of the shot).
 */
function placeBalanceLabels() {
  const at = (el, p, how = "") => { el.style.transform = "translate(" + p.x.toFixed(1) + "px, " + p.y.toFixed(1) + "px) " + how; };
  const close = nut.shot === "burn" || nut.shot === "eat";
  // While the camera travels the words stand back, and come in where it lands.
  balanceEl.classList.toggle("travel", scales.travelling);
  at(balPart("lean"), scales.anchor("pivot"), "translate(-50%, -100%)");
  const px = scales.unitPx(), plinth = balPart("plinth");
  plinth.style.fontSize = Math.max(8, px * .082).toFixed(1) + "px";
  at(plinth, scales.anchor("plinth"), "translate(-50%, -50%)");
  for (const side of ["burn", "eat"]) {
    const total = balPart("total-" + side);
    if (close) total.style.transform = "";
    else at(total, scales.anchor(side + "End"), "translate(-50%, -100%)");
    // Beside its pan's rim, and never off the edge of the room.
    const legend = balPart("legend-" + side), rim = scales.anchor(side), w = legend.offsetWidth;
    rim.x = side === "burn" ? Math.max(rim.x, w) : Math.min(rim.x, balanceEl.clientWidth - w);
    at(legend, rim, side === "burn" ? "translate(-100%, -50%)" : "translate(0, -50%)");
  }
}
scales.onFrame = placeBalanceLabels;

/* The eye and the lamp follow the pointer a little; a jar pointed at lights with its line. */
function lightJar(i) {
  if (i === bal.jar) return;
  bal.jar = scales.lit = i;
  for (const b of balanceEl.querySelectorAll("[data-meal-open]")) b.classList.toggle("lit", Number(b.dataset.mealOpen) === i);
  balanceEl.classList.toggle("on-jar", i >= 0 && nut.shot === "eat");
  scales.wake();
}
addEventListener("pointermove", e => {
  if (Stages.current !== "nutrition" || nut.day || !scales.ok || e.pointerType === "touch") return;
  scales.point(e.clientX / innerWidth * 2 - 1, 1 - e.clientY / innerHeight * 2);
}, { passive: true });
balanceEl.addEventListener("pointermove", e => {
  if (bal.drag) return;
  const line = e.target.closest("[data-meal-open]"), r = balanceEl.getBoundingClientRect();
  lightJar(line ? Number(line.dataset.mealOpen) : scales.jarAt(e.clientX - r.left, e.clientY - r.top));
});
balanceEl.addEventListener("pointerleave", () => lightJar(-1));
balanceEl.addEventListener("focusin", e => { const b = e.target.closest("[data-meal-open]"); if (b) lightJar(Number(b.dataset.mealOpen)); });
balanceEl.addEventListener("focusout", () => lightJar(-1));

/** Goes to a shot of the balance: the words step out, the camera travels, they come back. */
function goShot(name) {
  if (!NUT_SHOTS.includes(name) || name === nut.shot || nut.day) return;
  // The camera leaves at once, while the words step out; they are redrawn for the new shot on the way.
  if (!Stages.busy) { scales.shotTo(name); balanceEl.dataset.shot = name; balanceEl.classList.add("travel"); }
  Stages.relayout(() => { nut.shot = name; }, 700);
}
const stepShot = dir => { const to = NUT_SHOTS[NUT_SHOTS.indexOf(nut.shot) + dir]; if (to) goShot(to); return !!to; };

/* The beam in the hand: a pan pulled down eats more (the eating pan) or
   less (the burn's) against the burn, a percent every few pixels. A pan
   pressed and not pulled is gone to: the camera closes on it. */
const BALANCE_PX_PER_PERCENT = 5;
balanceEl.addEventListener("pointerdown", e => {
  const n = nutrition();
  if (Stages.busy || nut.shot === "set" || e.target.closest("button, a, input, select, label, .nu-panel") || (e.pointerType === "mouse" && e.button !== 0)) return;
  const r = balanceEl.getBoundingClientRect(), jar = scales.jarAt(e.clientX - r.left, e.clientY - r.top);
  const side = nut.shot === "burn" ? -1 : nut.shot === "eat" ? 1 : e.clientX - r.left < r.width / 2 ? -1 : 1;
  bal.drag = { y: e.clientY, side, from: n.adjust, moved: false, jar, can: n.isValid() };
  e.preventDefault();
});
addEventListener("pointermove", e => {
  const d = bal.drag;
  if (!d || !d.can) return;
  const dy = e.clientY - d.y;
  if (!d.moved && Math.abs(dy) < 4) return;
  d.moved = true;
  balanceEl.classList.add("held");
  const n = nutrition();
  n.setAdjust(d.from + d.side * Math.round(dy / BALANCE_PX_PER_PERCENT) / 100);
  scales.hold(n.adjust);
  paintNutritionFigures();
});
function endBalanceDrag() {
  const d = bal.drag;
  if (!d) return;
  bal.drag = null;
  balanceEl.classList.remove("held");
  scales.hold(null);
  if (d.moved) changed(() => {});
  // Pressed, not pulled: seen whole, the camera goes to that pan; seen close, a jar opens its meal.
  else if (nut.shot === "whole") goShot(d.side < 0 ? "burn" : "eat");
  else if (nut.shot === "eat" && d.jar >= 0) openDay(d.jar);
}
addEventListener("pointerup", endBalanceDrag);
addEventListener("pointercancel", endBalanceDrag);
new MutationObserver(() => scales.wake()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
addEventListener("resize", () => scales.wake());

const openDay = meal => Stages.relayout(() => { nut.day = true; nut.row = null; nut.meal = meal; }, 500);

/* The reading in hand lights the piece of the balance it changes, as a muscle pointed at lights on Targets. */
function lightPiece(e) {
  const r = e.type === "pointerout" || e.type === "focusout" ? null : e.target.closest && e.target.closest(".nu-read");
  const piece = r ? r.dataset.piece : null;
  if (scales.glow === piece) return;
  scales.glow = piece;
  scales.wake();
}
for (const type of ["pointerover", "pointerout", "focusin", "focusout"]) nutritionEl.addEventListener(type, lightPiece);

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
  else if (d.shot) goShot(d.shot);
  else if (d.mealOpen) openDay(Number(d.mealOpen));
  else if (b.id === "nu-yes") Stages.go("plan");
  else if (d.weightStep) changed(n => n.setWeight(Math.max(weightBound(n, 0), Math.min(weightBound(n, 1), (n.weight ?? (n.unit === "lb" ? 154 : 70)) + Number(d.weightStep)))));
  else if (d.mealsTo) changed(n => { n.setMealCount(Number(d.mealsTo)); nut.meal = 0; });
  else if (d.firstTo) changed(n => n.setWindow(Number(d.firstTo), n.lastMeal));
  else if (d.lastTo) changed(n => n.setWindow(n.firstMeal, Number(d.lastTo)));
  else if (d.row) { nut.row = nut.row === d.row ? null : d.row; nut.turned = true; renderNutritionStage(); }
  else if (d.unit) changed(n => n.setUnit(d.unit));
  else if (d.activity) changed(n => n.setActivity(d.activity));
  else if (d.burnStep) changed(n => n.setBurn(n.burn + Number(d.burnStep)));
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
  else if (d.useMeals) changed(n => { n.setMealCount(Number(d.useMeals)); nut.meal = 0; });
  else if (d.diet) changed(n => { n.diet = d.diet; });
  else if (b.id === "nu-reasons") { nut.reasons = !nut.reasons; renderNutritionStage(); }
  else if (b.id === "open-day") openDay(0);
  else if (b.id === "close-day") Stages.relayout(() => { nut.day = false; nut.fresh = true; }, 500);
  else if (d.meal) pickMeal(Number(d.meal));
  else if (d.mealStep) pickMeal(nut.meal + Number(d.mealStep));
  else if (d.more) { nextIdea(Number(d.more)); renderNutritionStage(); }
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
    n.setBurn(Number(t.value));
    t.value = n.burnIsEstimate && !n.isValid() ? "" : n.burn;
    saveRoutine(routine);
    paintNutritionFigures();
  }
  else if (t.id === "first-meal") changed(n => n.setWindow(Number(t.value), n.lastMeal));
  else if (t.id === "last-meal") changed(n => n.setWindow(n.firstMeal, Number(t.value)));
  else if (t.dataset.move) changed(n => n.moveMeal(Number(t.dataset.move), Number(t.value)));
});

/* Arrow keys move along the day's meals, as a tab list should. */
nutritionEl.addEventListener("keydown", e => {
  if (!e.target.closest(".meal-line") || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
  e.preventDefault();
  const i = nut.meal + (e.key === "ArrowRight" ? 1 : -1);
  if (i < 0 || i >= nutrition().meals.length) return;
  nut.meal = i;
  renderNutritionStage();
  const stop = nutritionEl.querySelector('.stop[data-meal="' + i + '"]');
  if (stop) stop.focus();
});

/* Without the balance (no WebGL) the statue stands where it would be. */
SCULPTURE_SHOTS["nutrition-plan"] = { ...SCULPTURE_SHOTS["nutrition"], az: -10, d: 640, sx: .5 };

Stages.register("nutrition", {
  arrive() { nut.fresh = true; if (Stages.from !== "plan") nut.shot = "whole"; },
  enter() {
    // Without a weight there is nothing to plan from: open where it goes.
    if (!nutrition().isValid()) { nut.day = false; nut.row = "body"; if (nut.fresh) nut.shot = "burn"; }
    if (!onScale()) nut.shot = "whole";
    renderNutritionStage();
    // Arriving, the pans are loaded and the beam swings to rest; a redraw, or a change of shot, leaves it be.
    if (nut.fresh && !nut.day) { paintBalance(true); rollFigures(true); }
    nut.fresh = false;
  },
  place: () => nut.day ? "day" : nut.shot,
  shot: () => nut.day || Stages.narrow ? "nutrition" : "nutrition-plan",
  // The balance has the room; in a day of eating, and on a phone, the statue stands by.
  dim: () => nut.day ? 0.45 : scales.ok && !Stages.narrow ? 0 : 1,
  focus: () => $("nutrition-title"),
  footer() {
    const empty = routine.selection.isEmpty(), i = NUT_SHOTS.indexOf(nut.shot), stepped = onScale() && !nut.day;
    const last = !stepped || nut.shot === "set";
    return {
      back: stepped && i > 0 ? "← " + NUT_SHOT_NAMES[NUT_SHOTS[i - 1]] : "← Your measure",
      skip: empty ? "" : Stages.narrow ? "Skip" : "Skip, training only",
      next: last ? (Stages.narrow ? "Week plan →" : "Continue to week plan →") : NUT_SHOT_NAMES[NUT_SHOTS[i + 1]] + " →",
      hint: last ? "" : "or scroll",
      nextDisabled: last && empty
    };
  },
  onNext() { if (onScale() && !nut.day && stepShot(1)) return true; },
  onBack() { if (onScale() && !nut.day && stepShot(-1)) return true; }
});
