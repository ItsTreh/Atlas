/* ===========================================================================
   Nutrition stage — the day, in perspective (optional).

   A room drawn in a canvas under the sculpture: a marble floor laid to a
   vanishing point, a gilt meridian inlaid with the hours from six to
   eleven, an arch over each meal at its hour, and at the end a wall whose
   niche holds the figure (the live marble, stood there each frame by
   standAt). The user walks the day: the wheel, the arrow keys, the
   footer's way on, its beads, or a press on an arch moves the eye along
   the meridian from station to station:

     0          the sum: the goal, what to eat and the protein in it, how
                it is worked out, and the day in one sentence whose words
                (meals, first and last hour, diet) open their choosers
     1 … n      each meal in its arch: its hour (moved there), its
                calories and protein beside it, and the plate under it
     n + 1      the day laid out at the wall, the figure behind

   The stage's words are set in a 1440 × 900 plate scaled to the screen;
   those of each station are placed at its depth in the room each frame
   (data-p), so walking carries them. The template is drawn again on every
   change and merged into the page (pvMorph), so a button keeps its focus
   and a bar its transition.

   Every number is the routine's NutritionPlan (nutrition.js): the burn,
   the goal's recommendation for the planned training, the meals and their
   shares, and the dishes from foods.js. The body weight is the one given
   on the Measure stage. Nothing is worked out here.
   ========================================================================= */

const nutrition = () => routine.nutrition;
const nutritionEl = $("nutrition-panel");
const fmtK = n => Math.round(n).toLocaleString("en-US");

/* The room: how far apart the hours lie (K), the eye's height (EY), an
   arch's outer and inner radius and the height of its piers (R, RI, YS),
   the floor's half-width and its tiles (XR, TW). Plate px at depth 1. */
const PV_ROOM = { K: 0.62, EY: 405, R: 400, RI: 372, YS: 300, XR: 1260, TW: 180 };
const PV_PAL = {
  light: { ink: [36, 32, 27], tileA: .045, lineA: .11, gilt: [185, 138, 60], deep: [138, 92, 30], hi: [244, 220, 164], glowA: .2 },
  dark:  { ink: [237, 230, 217], tileA: .035, lineA: .09, gilt: [205, 160, 80], deep: [217, 178, 106], hi: [248, 216, 145], glowA: .12 }
};
const PV_WORDS = { 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six" };
/* The figure in the niche: how far it is turned, and how much of the niche's height it stands. */
const PV_NICHE = { az: -8, fill: .88 };
/* The camera a change of stage travels to; standAt moves its end into the niche as it goes. */
SCULPTURE_SHOTS["nutrition-niche"] = { az: PV_NICHE.az, el: 0, ty: 79, d: 3400, sx: .5, sy: .62, fov: 20 };

/* Where the walk is, and what is open or pointed at. */
const pv = {
  station: 0, target: 0, cam: -0.6, cv: 0, acc: 0, edge: 0, locked: false, lastWheel: 0,
  dh: [], ap: [], pvx: 0, pvy: 0, mx: -1e4, my: -1e4, overHit: false, hoverArch: -1,
  k: 1, ox: 0, oy: 0, vw: 0, vh: 0, t0: 0, lt: 0, raf: 0, leftAt: 0, figOp: 0,
  chooser: null, hoverGoal: null, hoverFood: null, ledger: false, shift: {}
};

const pvPct = v => v === 0 ? "= burn" : (v > 0 ? "+" : "−") + Math.abs(Math.round(v * 100)) + "%";
const pvHH = h => (h < 10 ? "0" : "") + h + ":00";
const pvSigned = v => (v < 0 ? "− " : "+ ") + fmtK(Math.abs(v));
const pvSerif = "var(--serif)";

/* A coin to step with: a beaded rim, a fine ring, the sign `d` struck in it. */
const pvCoin = (d, w = 2.2) => '<svg viewBox="0 0 52 52" aria-hidden="true">' +
  '<circle cx="26" cy="26" r="24.2" style="stroke-width:2.4; stroke-linecap:round; stroke-dasharray:0 3.8"></circle>' +
  '<circle cx="26" cy="26" r="20.5" style="stroke-width:1; opacity:.4"></circle>' +
  '<path d="' + d + '" style="stroke-width:' + w + '; stroke-linecap:round; stroke-linejoin:round"></path></svg>';
const PV_SIGN = { earlier: "M33 26H19M24 21l-5 5 5 5", later: "M19 26h14M28 21l5 5-5 5", less: "M18 26h16", more: "M18 26h16M26 18v16" };
const pvStep = (act, sign, label, off = false, extra = "") =>
  '<button type="button" class="pv-coin' + (extra ? " " + extra : "") + '" data-act="' + act + '" title="' + label + '" aria-label="' + label + '"' +
  (off ? " disabled" : "") + '>' + pvCoin(PV_SIGN[sign], extra ? 1.8 : 2.2) + '</button>';

/* ------------------------------- the model -------------------------------- */

/**
 * What eating for goal `gk` comes to: the plan's own figures for its goal,
 * and for another (pointed at, before it is picked) that goal's
 * recommendation for the same training and burn, as setGoal would give.
 */
function goalFigures(n, gk, load) {
  if (gk === n.goal) return { adjust: n.adjust, ppk: n.proteinPerKg, kcal: n.kcal, protein: n.protein, burn: n.burn };
  const rec = recommendTargets(gk, load), raw = n.burn * (1 + rec.adjust);
  return { adjust: rec.adjust, ppk: rec.protein, kcal: Math.max(KCAL_FLOOR, Math.round(raw / 10) * 10),
           protein: Math.round(n.weightKg * rec.protein), burn: n.burn };
}

/** The day's meals, each with the dish it shows: the closest to its numbers, no dish twice if avoidable, turned by "Other ideas". */
function pvMeals(n) {
  if (!n.isValid()) return [];
  const avoid = new Set();
  return n.meals.map((m, i) => {
    const list = mealIdeasFor(m, n.diet, avoid), L = list.length, at = L ? (pv.shift[i] || 0) % L : 0, pick = list[at] || null;
    if (pick) avoid.add(pick.idea);
    return { ...m, list, at, pick };
  });
}

/** The stations: the sum, a meal each, the day. */
const pvLast = () => nutrition().isValid() ? nutrition().mealsPerDay + 1 : 0;

/* ------------------------------- the template ------------------------------ */

function pvTemplate() {
  const n = nutrition(), ok = n.isValid(), load = n.load, st = pv.station;
  const meals = pvMeals(n), count = meals.length;
  const M = ok ? goalFigures(n, n.goal, load) : null;
  const preview = ok && pv.hoverGoal && pv.hoverGoal !== n.goal ? pv.hoverGoal : null;
  const PV = preview ? goalFigures(n, preview, load) : M;
  const gl = GOALS[n.goal].label, w = Math.round(n.weightKg * 10) / 10;
  const sessions = load.sessionsPerWeek;
  const label = (t, style = "") => '<p class="pv-label"' + (style ? ' style="' + style + '"' : '') + '>' + t + '</p>';

  /* ------------------------- the threshold: the sum ------------------------ */
  const trainingLine = sessions ? sessions + " session" + (sessions === 1 ? "" : "s") + " a week"
    : "your day, with no training counted yet";
  const goals = Object.entries(GOALS).map(([k, g]) => {
    const on = k === n.goal, f = ok ? goalFigures(n, k, load) : null;
    return '<button type="button" data-act="goal" data-k="' + k + '" aria-pressed="' + on + '" style="position:relative; display:flex; align-items:baseline; justify-content:space-between; gap:16px; padding:8px 0 10px; background:none; border:0; cursor:pointer; text-align:left; color:' +
      (on ? "var(--ink)" : k === pv.hoverGoal ? "var(--ink-soft)" : "var(--ink-faint)") + '; transition:color .3s ease">' +
      '<span style="position:relative; font:400 34px/1 ' + pvSerif + '; font-style:' + (on ? "italic" : "normal") + '; letter-spacing:-.01em; padding-bottom:6px">' + esc(g.label) +
        '<span style="position:absolute; left:0; right:0; bottom:0; height:2px; border-radius:1px; background:var(--ink); transform-origin:left; transform:' + (on ? "scaleX(1)" : "scaleX(0)") + '; transition:transform .55s cubic-bezier(.16,1,.3,1)"></span></span>' +
      '<span style="font-size:12.5px; font-weight:500; font-variant-numeric:tabular-nums; color:' + (on ? "var(--gilt)" : "var(--ink-faint)") + '">' + (f ? pvPct(f.adjust) : "") + '</span></button>';
  }).join("");

  const sumLeft = '<div data-p="sum" data-r="0" style="position:absolute; left:48px; top:104px; width:372px; transform-origin:0 0">' +
    '<p style="margin:0; font-size:11px; font-weight:600; line-height:1.3; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-faint)"><span style="font:600 13px/1 ' + pvSerif + '; letter-spacing:.06em; color:var(--ink)">' + STAGE_NUMERALS.nutrition + '</span> / Nutrition · Optional</p>' +
    '<h1 id="nutrition-title" tabindex="-1" style="margin:14px 0 0; font:400 64px/.95 ' + pvSerif + '; letter-spacing:-.015em; color:var(--ink); text-wrap:balance">The day, in <em>perspective.</em></h1>' +
    '<p style="margin:18px 0 0; font-size:14px; line-height:1.55; color:var(--ink-soft); max-width:34ch; text-wrap:pretty">Calories and protein for ' + trainingLine + ', then the day they make, walked one meal at a time.</p>' +
    label("Eating for", "margin-top:40px") +
    '<div data-goals role="group" aria-label="Eating for" style="display:flex; flex-direction:column; margin-top:8px">' + goals + '</div>' +
    '<p style="margin:14px 0 0; font:italic 400 18px/1.35 ' + pvSerif + '; color:var(--ink-soft); min-height:48px; text-wrap:pretty">' + esc(GOALS[preview || n.goal].blurb) + '</p>' +
  '</div>';

  let sumRight;
  if (!ok) {
    sumRight = '<div data-p="sum" data-r="1" style="position:absolute; left:1020px; top:104px; width:372px; transform-origin:0 0">' +
      '<div style="display:flex; align-items:center; justify-content:space-between">' + label("To eat, each day") +
        '<span style="font-size:10px; font-weight:500; line-height:1; letter-spacing:.12em; text-transform:uppercase; color:var(--gilt); border:1px solid var(--gilt-line); border-radius:999px; padding:4px 8px 3px">Estimate</span></div>' +
      '<div style="display:flex; align-items:flex-end; gap:12px; margin-top:10px"><span style="font:400 112px/.86 ' + pvSerif + '; color:var(--ink-faint)">—</span>' +
        '<span style="font:italic 400 28px/1 ' + pvSerif + '; color:var(--gilt); padding-bottom:9px">kcal</span></div>' +
      '<p style="margin:18px 0 0; font:italic 400 18px/1.35 ' + pvSerif + '; color:var(--ink-soft); text-wrap:pretty">Worked out from your body weight, which the Measure asks for.</p>' +
      '<button type="button" class="pv-link" data-goto="measure" style="margin-top:12px">Give your weight on the Measure</button>' +
    '</div>';
  } else {
    const rec = n.recommended, est = n.burnIsEstimate, act = ACTIVITY_LEVELS[n.activity];
    const adjustText = (PV.adjust === 0 ? "Your burn, ≈ " : pvPct(PV.adjust) + " on a burn of ≈ ") + fmtK(PV.burn);
    const trainHow = !load.muscles.length
      ? (routine.selectedMuscles().length ? "no exercises yet for your targets" : "no target muscles yet")
      : Math.abs(load.hours - load.sessionsPerWeek * load.sessionMinutes / 60) < 0.05
        ? load.sessionsPerWeek + " × " + load.sessionMinutes + " min a week, over 7 days"
        : "≈ " + (Math.round(load.hours * 2) / 2) + " h of your " + load.sessionsPerWeek + " × " + load.sessionMinutes + " min, over 7 days";
    const rows = est ? [
      { label: "Your day", how: w + " kg × " + act.kcalPerKg + " kcal, " + act.label.toLowerCase(), value: fmtK(n.baseBurn), border: "1px solid var(--line)" },
      { label: "Training", how: trainHow, value: "+ " + fmtK(load.kcalPerDay), border: "1px solid var(--line-soft)" },
      { label: "Daily burn", how: "to the nearest 50", value: "≈ " + fmtK(n.burn), border: "1px solid var(--line-soft)" }
    ] : [
      { label: "Daily burn", how: "your own number, training included", value: fmtK(n.burn), border: "1px solid var(--line)" }
    ];
    rows.push({ label: gl, how: pvPct(n.adjust) + (n.adjustIsRecommended ? ", for this training" : ", your setting"),
                value: pvSigned(n.kcal - n.burn), border: "1px solid var(--line-soft)" });
    const [plo, phi] = n.proteinRange;
    const heavy = n.protein * 4 > n.kcal * 0.35;
    const ledger = !pv.ledger ? "" : '<div id="pv-ledger" style="margin-top:14px; display:flex; flex-direction:column">' +
      rows.map(r => '<div style="display:grid; grid-template-columns:92px 1fr auto; gap:12px; align-items:baseline; padding:7px 0; border-top:' + r.border + '">' +
        '<span style="font-size:10px; font-weight:500; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-faint)">' + esc(r.label) + '</span>' +
        '<span style="font-size:12.5px; color:var(--ink-soft)">' + esc(r.how) + '</span>' +
        '<span style="font:400 20px/1 ' + pvSerif + '; font-variant-numeric:lining-nums tabular-nums">' + r.value + '</span></div>').join("") +
      '<div role="group" aria-label="Your day outside training" style="display:flex; flex-wrap:wrap; gap:4px 14px; padding:2px 0 8px 104px">' +
        Object.entries(ACTIVITY_LEVELS).map(([k, a]) => {
          const on = est && k === n.activity;
          return '<button type="button" data-act="activity" data-k="' + k + '" aria-pressed="' + on + '" title="' + esc(a.hint) + '" style="padding:2px 0 4px; background:none; border:0; border-bottom:' +
            (on ? "1.5px solid var(--ink)" : "1.5px solid transparent") + '; cursor:pointer; font-size:12px; font-weight:500; color:' + (on ? "var(--ink)" : "var(--ink-faint)") + '">' + esc(a.label) + '</button>';
        }).join("") + '</div>' +
      '<div style="display:grid; grid-template-columns:92px 1fr auto; gap:12px; align-items:baseline; padding:9px 0; border-top:1px solid var(--ink)">' +
        '<span style="font-size:10px; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--ink)">To eat</span>' +
        '<span style="font-size:12.5px; color:var(--ink-soft)">rounded to 10</span>' +
        '<span style="font:500 22px/1 ' + pvSerif + '; font-variant-numeric:lining-nums tabular-nums">' + fmtK(n.kcal) + '</span></div>' +
      '<div style="display:grid; grid-template-columns:92px 1fr auto; gap:12px; align-items:baseline; padding:7px 0; border-top:1px solid var(--line-soft)">' +
        '<span style="font-size:10px; font-weight:500; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-faint)">Protein</span>' +
        '<span style="font-size:12.5px; color:var(--ink-soft)">' + w + ' kg × ' + n.proteinPerKg.toFixed(1) + ' g · usual ' + plo + '–' + phi + ' g</span>' +
        '<span style="font:400 20px/1 ' + pvSerif + '; font-variant-numeric:lining-nums tabular-nums">' + n.protein + ' g</span></div>' +
      '<p style="margin:8px 0 0; font:italic 400 15px/1.4 ' + pvSerif + '; color:var(--ink-soft)">An estimate to eat against, not a prescription. Weigh in over two or three weeks, then adjust.' +
        (heavy ? ' At ' + Math.round(n.protein * 400 / n.kcal) + '% of these calories, this protein is above the usual 35% top: consider a lower g per kg.' : '') + '</p>' +
    '</div>';

    sumRight = '<div data-p="sum" data-r="1" style="position:absolute; left:1020px; top:104px; width:372px; transform-origin:0 0">' +
      '<div style="display:flex; align-items:center; justify-content:space-between">' + label(preview ? "If " + esc(GOALS[preview].label.toLowerCase()) : "To eat, each day") +
        '<span style="font-size:10px; font-weight:500; line-height:1; letter-spacing:.12em; text-transform:uppercase; color:var(--gilt); border:1px solid var(--gilt-line); border-radius:999px; padding:4px 8px 3px">Estimate</span></div>' +
      '<div style="display:flex; align-items:flex-end; gap:12px; margin-top:10px">' +
        '<span style="font:400 112px/.86 ' + pvSerif + '; letter-spacing:-.03em; font-variant-numeric:lining-nums tabular-nums; color:' + (preview ? "var(--ink-faint)" : "var(--ink)") + '; transition:color .3s ease">' + fmtK(PV.kcal) + '</span>' +
        '<span style="font:italic 400 28px/1 ' + pvSerif + '; color:var(--gilt); padding-bottom:9px">kcal</span></div>' +
      '<div style="display:flex; align-items:center; gap:8px; margin-top:12px; font-size:13px; color:var(--ink-soft)">' +
        pvStep("kcal-less", "less", "Eat less", !!preview) + '<span style="font-variant-numeric:tabular-nums">' + adjustText + '</span>' + pvStep("kcal-more", "more", "Eat more", !!preview) +
        (preview ? '' : n.adjustIsRecommended ? '<span style="margin-left:auto; font-size:12px; color:var(--ink-faint)">Recommended</span>'
          : '<button type="button" class="pv-link" data-act="reset-adjust" style="margin-left:auto; font-size:12px">Use ' + pvPct(rec.adjust) + '</button>') +
      '</div>' +
      (!preview && n.atFloor ? '<p style="margin:8px 0 0; font-size:12px; color:#8a5212">Held at ' + fmtK(KCAL_FLOOR) + ' kcal, the lowest ATLAS will suggest.</p>' : '') +
      '<div style="display:flex; align-items:flex-end; gap:12px; margin-top:26px">' +
        '<span style="font:400 84px/.86 ' + pvSerif + '; letter-spacing:-.03em; font-variant-numeric:lining-nums tabular-nums; color:' + (preview ? "var(--ink-faint)" : "var(--ink)") + '; transition:color .3s ease">' + PV.protein + '</span>' +
        '<span style="font:italic 400 26px/1 ' + pvSerif + '; color:var(--gilt); padding-bottom:6px">g protein</span></div>' +
      '<div style="display:flex; align-items:center; gap:8px; margin-top:12px; font-size:13px; color:var(--ink-soft)">' +
        pvStep("protein-less", "less", "Less protein", !!preview) + '<span style="font-variant-numeric:tabular-nums">' + PV.ppk.toFixed(1) + ' g per kg of ' + w + ' kg</span>' + pvStep("protein-more", "more", "More protein", !!preview) +
        (preview ? '' : n.proteinIsRecommended ? '<span style="margin-left:auto; font-size:12px; color:var(--ink-faint)">Recommended</span>'
          : '<button type="button" class="pv-link" data-act="reset-protein" style="margin-left:auto; font-size:12px">Use ' + rec.protein.toFixed(1) + ' g/kg</button>') +
      '</div>' +
      '<button type="button" class="pv-link" data-act="ledger" aria-expanded="' + pv.ledger + '"' + (pv.ledger ? ' aria-controls="pv-ledger"' : '') + ' style="margin-top:22px">How it\'s worked out <span aria-hidden="true" style="display:inline-block; transform:' + (pv.ledger ? "rotate(180deg)" : "none") + '; transition:transform .4s ease">↓</span></button>' +
      ledger +
    '</div>';
  }

  /* The day in one sentence, its words opening their choosers. */
  let sentence = "";
  if (ok) {
    const hours = n.hours, sugg = n.suggestedMeals;
    const chooserBox = (inner, extra = "align-items:flex-end; gap:22px") => '<div style="position:absolute; bottom:calc(100% + 16px); left:50%; transform:translateX(-50%); display:flex; ' + extra + '; padding:10px 24px; background:var(--bg); box-shadow:0 0 28px 16px var(--bg); white-space:nowrap">' + inner + '</div>';
    let chooser = "";
    if (pv.chooser === "meals") chooser = chooserBox('<span class="pv-label" style="padding-bottom:12px">Meals a day</span>' +
      MEAL_COUNTS.map(c => { const on = c === n.mealsPerDay;
        return '<button type="button" data-act="count" data-k="' + c + '" aria-pressed="' + on + '" style="position:relative; display:flex; flex-direction:column; align-items:center; gap:4px; padding:0 2px 8px; background:none; border:0; cursor:pointer; color:' + (on ? "var(--ink)" : "var(--ink-faint)") + '">' +
          '<span style="font:400 34px/1 ' + pvSerif + '; font-style:' + (on ? "italic" : "normal") + '">' + c + '</span>' +
          '<span style="font-size:9px; font-weight:500; letter-spacing:.1em; text-transform:uppercase; color:var(--gilt); min-height:10px">' + (c === sugg ? "suggested" : "") + '</span>' +
          '<span style="position:absolute; left:0; right:0; bottom:0; height:2px; border-radius:1px; background:var(--ink); transform:' + (on ? "scaleX(1)" : "scaleX(0)") + '; transition:transform .45s cubic-bezier(.16,1,.3,1)"></span></button>'; }).join(""));
    else if (pv.chooser === "first" || pv.chooser === "last") {
      const lastOne = pv.chooser === "last";
      chooser = chooserBox('<span class="pv-label">' + (lastOne ? "Last meal" : "First meal") + '</span>' +
        pvStep("time-less", "earlier", "Earlier", false, "big") +
        '<span style="font:400 38px/1 ' + pvSerif + '; font-variant-numeric:lining-nums tabular-nums; min-width:96px" aria-live="polite">' + pvHH(lastOne ? hours[hours.length - 1] : hours[0]) + '</span>' +
        pvStep("time-more", "later", "Later", false, "big"), "align-items:center; gap:12px");
    } else if (pv.chooser === "diet") chooser = chooserBox(Object.entries(DIETS).map(([k, d]) => { const on = k === n.diet;
      return '<button type="button" data-act="diet" data-k="' + k + '" aria-pressed="' + on + '" style="position:relative; padding:0 0 8px; background:none; border:0; cursor:pointer; font:400 28px/1 ' + pvSerif + '; font-style:' + (on ? "italic" : "normal") + '; color:' + (on ? "var(--ink)" : "var(--ink-faint)") + '">' + esc(d.label) +
        '<span style="position:absolute; left:0; right:0; bottom:0; height:2px; border-radius:1px; background:var(--ink); transform:' + (on ? "scaleX(1)" : "scaleX(0)") + '; transition:transform .45s cubic-bezier(.16,1,.3,1)"></span></button>'; }).join(""), "align-items:flex-end; gap:20px");
    const word = (key, text) => '<button type="button" class="pv-word" data-act="open" data-k="' + key + '" aria-expanded="' + (pv.chooser === key) + '">' + text + '</button>';
    sentence = '<div data-p="sum" data-r="2" style="position:absolute; left:720px; top:688px; width:0; height:0; transform-origin:0 0">' +
      '<div style="position:absolute; left:-370px; top:0; width:740px; display:flex; flex-direction:column; align-items:center; text-align:center">' + chooser +
        '<p style="margin:0; font:400 30px/1.3 ' + pvSerif + '; color:var(--ink-soft); text-shadow:0 0 3px var(--bg), 0 0 12px var(--bg)">' +
          word("meals", PV_WORDS[n.mealsPerDay] || n.mealsPerDay) + ' meals, from ' + word("first", pvHH(hours[0])) + ' to ' + word("last", pvHH(hours[hours.length - 1])) +
          ', eating ' + word("diet", esc(DIETS[n.diet].label.toLowerCase())) + '.</p>' +
        '<p style="margin:12px 0 0; font-size:10px; font-weight:500; line-height:1; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-faint); text-shadow:0 0 3px var(--bg), 0 0 10px var(--bg)">Each meal waits at its hour · scroll to walk the day</p>' +
      '</div></div>';
  }

  /* ------------------------------ each meal ------------------------------ */
  let runK = 0, runP = 0;
  const cumK = [], cumP = [];
  meals.forEach(m => { runK += m.kcal; runP += m.protein; cumK.push(runK); cumP.push(runP); });
  const pc = (a, b) => Math.min(100, a / b * 100) + "%";
  const mealHTML = meals.map((m, i) => {
    const hf = pv.hoverFood && pv.hoverFood.i === i ? pv.hoverFood.j : -1, here = st === i + 1, pick = m.pick;
    const foods = pick ? pick.foods.map(([id, g]) => { const F = FOODS[id];
      return { amount: amountLabel(id, g), name: F.name, kcal: Math.round(F.kcal * g / 100), protein: Math.round(F.protein * g / 100) }; }) : [];
    const hv = hf >= 0 ? foods[hf] : null;
    const [lo, hi] = n.hourBounds(i), prevK = i ? cumK[i - 1] : 0, prevP = i ? cumP[i - 1] : 0;
    const side = (which, big, unit, note, done, thisW, beads, by) =>
      '<div style="position:absolute; left:' + (which ? "384px" : "-628px") + '; top:-96px; width:244px">' + label(which ? "Protein" : "Calories") +
        '<div style="display:flex; align-items:flex-end; gap:8px; margin-top:6px">' +
          '<span style="font:italic 400 34px/1 ' + pvSerif + '; color:var(--ink-faint); padding-bottom:14px">≈</span>' +
          '<span style="font:400 124px/.86 ' + pvSerif + '; letter-spacing:-.03em; font-variant-numeric:lining-nums tabular-nums">' + big + '</span>' +
          '<span style="font:italic 400 26px/1 ' + pvSerif + '; color:var(--gilt); padding-bottom:10px">' + unit + '</span></div>' +
        '<p style="margin:12px 0 0; font:italic 400 18px/1.3 ' + pvSerif + '; color:var(--ink-soft); min-height:24px">' + esc(note) + '</p>' +
        '<div aria-hidden="true" style="position:relative; height:9px; margin-top:16px">' +
          '<div style="position:absolute; left:0; right:0; top:4px; height:1px; background:var(--line)"></div>' +
          '<div style="position:absolute; left:0; top:4px; height:1px; width:' + done + '; background:var(--ink-soft)"></div>' +
          '<div style="position:absolute; top:3px; height:3px; left:' + done + '; width:' + thisW + '; background:var(--gilt-line); transition:width 1s cubic-bezier(.16,1,.3,1) .35s"></div>' +
          beads.map(left => '<span style="position:absolute; top:1.5px; left:' + left + '; width:6px; height:6px; margin-left:-3px; border-radius:50%; background:var(--bg); box-shadow:0 0 0 1px var(--ink-faint)"></span>').join("") +
        '</div>' +
        '<p style="margin:10px 0 0; font-size:12px; color:var(--ink-faint); font-variant-numeric:tabular-nums">' + by + '</p></div>';
    return '<div data-p="meal" data-i="' + i + '" style="position:absolute; left:720px; top:378px; width:0; height:0; transform-origin:0 0; opacity:0; visibility:hidden; pointer-events:none">' +
      '<div style="position:absolute; left:-320px; top:-190px; width:640px; display:flex; flex-direction:column; align-items:center">' +
        '<div style="display:flex; align-items:center; gap:8px; color:var(--gilt)">' +
          '<span style="font:600 14px/1 ' + pvSerif + '; letter-spacing:.22em">' + romanNumeral(m.hour) + '</span>' +
          '<span style="width:18px; height:1px; background:var(--gilt-line); opacity:.6"></span>' +
          pvStep("earlier", "earlier", esc(m.name) + " earlier", m.hour <= lo).replace('data-act="earlier"', 'data-act="earlier" data-i="' + i + '"') +
          '<span style="font-size:13px; font-weight:500; letter-spacing:.04em; font-variant-numeric:tabular-nums; color:var(--ink)">' + pvHH(m.hour) + '</span>' +
          pvStep("later", "later", esc(m.name) + " later", m.hour >= hi).replace('data-act="later"', 'data-act="later" data-i="' + i + '"') +
        '</div>' +
        '<h2 style="margin:8px 0 0; font:italic 400 92px/.9 ' + pvSerif + '; letter-spacing:-.02em; color:var(--ink); white-space:nowrap">' + esc(m.name) + '</h2>' +
      '</div>' +
      side(0, fmtK(m.kcal), "kcal", hv ? hv.name + " · " + hv.kcal + " kcal" : Math.round(m.share * 100) + "% of the day’s calories",
        pc(prevK, n.kcal), here ? pc(m.kcal, n.kcal) : "0%", cumK.slice(0, -1).map(c => pc(c, n.kcal)), "By its end · " + fmtK(cumK[i]) + " of " + fmtK(n.kcal)) +
      side(1, String(m.protein), "g", hv ? hv.name + " · " + hv.protein + " g" : Math.round(m.protein / n.protein * 100) + "% of the day’s protein",
        pc(prevP, n.protein), here ? pc(m.protein, n.protein) : "0%", cumP.slice(0, -1).map(c => pc(c, n.protein)), "By its end · " + cumP[i] + " of " + n.protein + " g") +
      '<div style="position:absolute; left:-276px; top:138px; width:552px; background:color-mix(in oklab, var(--bg) 84%, transparent); box-shadow:0 0 36px 30px color-mix(in oklab, var(--bg) 84%, transparent)">' +
        '<div style="display:flex; align-items:baseline; justify-content:space-between; gap:16px">' + label("The plate · " + esc(m.focus)) +
          (m.list.length > 1 ? '<button type="button" class="pv-link" data-act="idea" data-i="' + i + '" style="font-size:12.5px">Other ideas ↻ <span style="color:var(--ink-faint); font-variant-numeric:tabular-nums">' + (m.at + 1) + ' of ' + m.list.length + '</span></button>' : '') +
        '</div>' +
        '<div style="display:flex; align-items:baseline; justify-content:space-between; gap:16px; margin-top:8px">' +
          '<h3 style="margin:0; font:400 34px/1.05 ' + pvSerif + '; letter-spacing:-.01em">' + (pick ? esc(pick.idea.name) : "No idea fits this diet yet") + '</h3>' +
          '<span style="font:italic 400 17px/1 ' + pvSerif + '; color:var(--ink-soft); white-space:nowrap">' + (pick ? "as served ≈ " + fmtK(pick.kcal) + " kcal · " + pick.protein + " g" : "") + '</span>' +
        '</div>' +
        '<div style="margin-top:10px; display:flex; flex-direction:column">' + foods.map((f, j) =>
          '<div data-food="' + i + ':' + j + '" style="display:grid; grid-template-columns:84px 1fr auto; gap:14px; align-items:baseline; padding:7px 8px; margin:0 -8px; border-top:1px solid var(--line-soft); background:' +
            (hf === j ? "color-mix(in oklab, var(--gilt-line) 14%, transparent)" : "transparent") + '; transition:background .25s ease; cursor:default">' +
            '<span style="font-weight:600; font-size:14px; font-variant-numeric:tabular-nums">' + f.amount + '</span>' +
            '<span style="font-size:14.5px">' + esc(f.name) + '</span>' +
            '<span style="font-size:12.5px; color:var(--ink-faint); font-variant-numeric:tabular-nums">' + f.kcal + ' kcal · ' + f.protein + ' g</span></div>').join("") +
        '</div>' +
      '</div>' +
    '</div>';
  }).join("");

  /* The label that calls from the next arch, or the one pointed at. */
  const farHTML = meals.map((m, i) => '<div data-p="far" data-i="' + i + '" aria-hidden="true" style="position:absolute; left:720px; top:0; width:0; height:0; opacity:0; pointer-events:none">' +
    '<div style="position:absolute; left:-160px; bottom:0; width:320px; display:flex; flex-direction:column; align-items:center; gap:4px; text-shadow:0 0 3px var(--bg), 0 0 10px var(--bg), 0 0 18px var(--bg)">' +
      '<span style="font:italic 400 24px/1 ' + pvSerif + '; color:var(--ink)">' + esc(m.name) + '</span>' +
      '<span style="font-size:10px; font-weight:500; letter-spacing:.12em; text-transform:uppercase; color:var(--gilt); font-variant-numeric:tabular-nums">' + pvHH(m.hour) + ' · ' + fmtK(m.kcal) + ' kcal</span>' +
    '</div></div>').join("");

  /* ----------------------------- the day, laid ----------------------------- */
  const dayList = (val) => '<div style="margin-top:22px; display:flex; flex-direction:column">' + meals.map(m =>
    '<div style="display:grid; grid-template-columns:auto 1fr auto; gap:10px; align-items:baseline; padding:6px 0; border-top:1px solid var(--line-soft); font-size:13.5px">' +
      '<span style="font:italic 400 19px/1 ' + pvSerif + '">' + esc(m.name) + '</span>' + val(m) + '</div>').join("") + '</div>';
  const endHTML = !ok ? "" : '<div data-p="end" style="position:absolute; left:720px; top:378px; width:0; height:0; transform-origin:0 0; opacity:0; visibility:hidden; pointer-events:none">' +
    '<div style="position:absolute; left:-360px; top:-252px; width:720px; text-align:center">' +
      '<p style="margin:0; font:600 13px/1 ' + pvSerif + '; letter-spacing:.42em; color:var(--gilt)">PER · DIEM</p>' +
      '<h2 style="margin:14px 0 0; font:italic 400 62px/.95 ' + pvSerif + '; letter-spacing:-.015em; color:var(--ink)">The day, laid.</h2></div>' +
    '<div style="position:absolute; left:-628px; top:-120px; width:330px">' + label("Calories, a day") +
      '<div style="display:flex; align-items:flex-end; gap:12px; margin-top:8px"><span style="font:400 128px/.86 ' + pvSerif + '; letter-spacing:-.03em; font-variant-numeric:lining-nums tabular-nums">' + fmtK(n.kcal) + '</span>' +
        '<span style="font:italic 400 28px/1 ' + pvSerif + '; color:var(--gilt); padding-bottom:10px">kcal</span></div>' +
      dayList(m => '<span style="color:var(--ink-faint); font-size:12px; font-variant-numeric:tabular-nums">' + pvHH(m.hour) + '</span><span style="font-variant-numeric:tabular-nums">' + fmtK(m.kcal) + '</span>') +
      '<p style="margin:14px 0 0; font:italic 400 16px/1.35 ' + pvSerif + '; color:var(--ink-soft)">Estimates to eat against. The week plan places each meal around your sessions.</p></div>' +
    '<div style="position:absolute; left:298px; top:-120px; width:330px">' + label("Protein, a day") +
      '<div style="display:flex; align-items:flex-end; gap:12px; margin-top:8px"><span style="font:400 128px/.86 ' + pvSerif + '; letter-spacing:-.03em; font-variant-numeric:lining-nums tabular-nums">' + n.protein + '</span>' +
        '<span style="font:italic 400 28px/1 ' + pvSerif + '; color:var(--gilt); padding-bottom:10px">g</span></div>' +
      dayList(m => '<span style="color:var(--ink-faint); font-size:12px">' + (m.pick ? esc(m.pick.idea.name) : "") + '</span><span style="font-variant-numeric:tabular-nums">' + m.protein + ' g</span>') +
      '<button type="button" class="pv-link" data-act="sum" style="margin-top:14px">Walk it again</button></div>' +
  '</div>';

  return endHTML + mealHTML + farHTML + sumLeft + sumRight + sentence;
}

/** The day's index in the footer: the hours, a bead a meal, the sum and the day at its ends. */
function pvFootTemplate() {
  const n = nutrition(), st = pv.station, last = pvLast();
  if (!n.isValid()) return "";
  const span = LAST_HOUR - FIRST_HOUR, hx = h => 30 + (h - FIRST_HOUR) / span * 300, hours = n.hours;
  const ring = on => "0 0 0 1px " + (on ? "var(--gilt-line)" : "var(--ink-faint)");
  return '<div style="position:absolute; left:6px; right:6px; top:25px; height:1px; background:var(--line)"></div>' +
    '<div style="position:absolute; top:25px; height:1px; left:' + hx(hours[0]) + 'px; width:' + (hx(hours[hours.length - 1]) - hx(hours[0])) + 'px; background:var(--gilt-line)"></div>' +
    '<button type="button" data-act="sum" title="The sum" aria-label="The sum"' + (st === 0 ? ' aria-current="step"' : '') + ' style="left:-8px"><span style="width:11px; height:11px; background:var(--bg); box-shadow:' + ring(st === 0) + '"></span></button>' +
    n.meals.map((m, i) => '<div style="position:absolute; left:' + hx(m.hour) + 'px; top:0; width:0; height:52px">' +
      '<button type="button" data-act="station" data-k="' + (i + 1) + '" title="' + esc(m.name) + ' · ' + pvHH(m.hour) + '" aria-label="' + esc(m.name) + ' at ' + pvHH(m.hour) + '"' + (st === i + 1 ? ' aria-current="step"' : '') + ' style="left:-14px">' +
        '<span style="width:7px; height:7px; background:' + (st === i + 1 ? "var(--gilt-line)" : st > i + 1 ? "var(--ink-soft)" : "var(--bg)") + '; box-shadow:' + ring(st === i + 1) + '"></span></button>' +
      '<span class="fd-h" aria-hidden="true">' + String(m.hour).padStart(2, "0") + '</span></div>').join("") +
    '<button type="button" data-act="end" title="The day" aria-label="The day"' + (st === last ? ' aria-current="step"' : '') + ' style="right:-8px"><span style="width:11px; height:11px; background:var(--bg); box-shadow:' + ring(st === last) + '"></span></button>' +
    '<div id="fd-mark" aria-hidden="true" style="position:absolute; left:0; top:20px; width:0; height:0; pointer-events:none"><div style="position:absolute; left:-5px; top:0; width:10px; height:10px; transform:rotate(45deg); background:var(--gilt-line); box-shadow:0 0 0 3px var(--bg)"></div></div>';
}

/* --------------------------------- drawing --------------------------------- */

/* The plate everything is set on, and the room's canvas, under the sculpture. */
nutritionEl.innerHTML = '<div class="pv-stage" id="pv-stage"><div class="pv-hit" id="pv-hit"></div><div id="pv-live"></div></div>';
const pvStage = $("pv-stage"), pvHit = $("pv-hit"), pvLive = $("pv-live"), pvFoot = $("foot-day");
const pvCanvas = document.createElement("canvas");
pvCanvas.className = "pv-room";
pvCanvas.setAttribute("aria-hidden", "true");
document.querySelector("#anatomy-stage .anatomy-viewport").before(pvCanvas);

/**
 * Brings `el`'s children in line with `html`, keeping every element that
 * is still there: a button keeps its focus, a bar its transition. The
 * placed elements (data-p) keep the style the room gives them each frame.
 */
function pvMorph(el, html) {
  const t = document.createElement("div");
  t.innerHTML = html;
  (function kids(a, b) {
    const an = [...a.childNodes], bn = [...b.childNodes];
    bn.forEach((nb, i) => {
      const na = an[i];
      if (!na) a.appendChild(nb);
      else if (na.nodeType !== nb.nodeType || na.nodeName !== nb.nodeName) a.replaceChild(nb, na);
      else if (na.nodeType === 3) { if (na.nodeValue !== nb.nodeValue) na.nodeValue = nb.nodeValue; }
      else if (na.nodeType === 1) {
        const keep = na.hasAttribute("data-p") && nb.hasAttribute("data-p") ? "style" : null;
        for (const { name, value } of [...nb.attributes]) if (name !== keep && na.getAttribute(name) !== value) na.setAttribute(name, value);
        for (const { name } of [...na.attributes]) if (name !== keep && !nb.hasAttribute(name)) na.removeAttribute(name);
        kids(na, nb);
      }
    });
    for (let i = an.length - 1; i >= bn.length; i--) an[i].remove();
  })(el, t);
}

function renderNutritionStage() {
  pvMorph(pvLive, pvTemplate());
  const foot = pvFootTemplate();
  pvMorph(pvFoot, foot);
  pvFoot.hidden = !foot || Stages.narrow;
}

/* ------------------------------- the room --------------------------------- */

const pvFog = d => Math.max(0.22, Math.min(1, 1.15 - d / 13));
const pvSS = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Fits the 1440 × 900 plate to the screen, centred. */
function pvFit() {
  const vw = nutritionEl.clientWidth, vh = nutritionEl.clientHeight, k = Math.min(vw / 1440, vh / 900);
  pv.vw = vw; pv.vh = vh; pv.k = k; pv.ox = (vw - 1440 * k) / 2; pv.oy = (vh - 900 * k) / 2;
  pvStage.style.transform = "translate(" + pv.ox + "px," + pv.oy + "px) scale(" + k + ")";
}

/** One arch, or the niche: two piers, their capitals and bases, the archivolt and its keystone, beads round it. */
function pvArch(ctx, cx, hy, d, R, r, ys, col, lw, beads) {
  const s = 1 / d, EY = PV_ROOM.EY;
  const xL = cx - R * s, xl = cx - r * s, xr = cx + r * s, xRR = cx + R * s, yF = hy + EY * s, yS = hy + (EY - ys) * s;
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(xL, yF); ctx.lineTo(xL, yS); ctx.moveTo(xl, yF); ctx.lineTo(xl, yS);
  ctx.moveTo(xr, yF); ctx.lineTo(xr, yS); ctx.moveTo(xRR, yF); ctx.lineTo(xRR, yS);
  ctx.moveTo(xL - 12 * s, yS); ctx.lineTo(xl + 2 * s, yS); ctx.moveTo(xr - 2 * s, yS); ctx.lineTo(xRR + 12 * s, yS);
  ctx.moveTo(xL - 12 * s, yS + 8 * s); ctx.lineTo(xl, yS + 8 * s); ctx.moveTo(xr, yS + 8 * s); ctx.lineTo(xRR + 12 * s, yS + 8 * s);
  ctx.moveTo(xL - 14 * s, yF); ctx.lineTo(xl + 4 * s, yF); ctx.moveTo(xr - 4 * s, yF); ctx.lineTo(xRR + 14 * s, yF);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, yS, R * s, Math.PI, 2 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, yS, r * s, Math.PI, 2 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 13 * s, yS - r * s); ctx.lineTo(cx - 19 * s, yS - (R + 12) * s); ctx.lineTo(cx + 19 * s, yS - (R + 12) * s); ctx.lineTo(cx + 13 * s, yS - r * s); ctx.stroke();
  if (beads) {
    const br = Math.max(0.6, 2.2 * s);
    for (let t = 6; t <= 174; t += 6) {
      if (t > 84 && t < 96) continue;
      const th = Math.PI + t * Math.PI / 180;
      ctx.beginPath(); ctx.arc(cx + Math.cos(th) * (R + 10) * s, yS + Math.sin(th) * (R + 10) * s, br, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function pvFrame(now) {
  const dt = Math.min(0.05, (now - (pv.lt || now)) / 1000); pv.lt = now;
  if (nutritionEl.clientWidth !== pv.vw || nutritionEl.clientHeight !== pv.vh) pvFit();
  const still = Stages.still, here = Stages.current === "nutrition";
  if (pv.locked && now - pv.lastWheel > 240) pv.locked = false;
  pv.acc *= Math.exp(-dt * 5);

  const { K, EY, R, RI, YS, XR, TW } = PV_ROOM, TD = TW / 1080;
  const n = nutrition(), hours = n.isValid() ? n.hours : [], cnt = hours.length;
  for (let i = 0; i < cnt; i++) {
    if (pv.dh[i] == null) { pv.dh[i] = hours[i]; pv.ap[i] = still ? 1 : 0; }
    pv.dh[i] += (hours[i] - pv.dh[i]) * (still ? 1 : 1 - Math.exp(-dt * 5));
    if (now > pv.t0 + 500 + i * 140) pv.ap[i] = Math.min(1, pv.ap[i] + (still ? 1 : dt * 1.4));
  }
  pv.dh.length = cnt; pv.ap.length = cnt;
  const f0 = cnt ? pv.dh[0] : FIRST_HOUR + 2, zh = h => 2.4 + (h - f0) * K;
  const zm = pv.dh.map(zh);
  const zW = Math.max(zh(LAST_HOUR) + 0.5, cnt ? zm[cnt - 1] + 2 : 0);
  const cams = [0, ...zm.map(z => z - 1), zW - 1.04], last = cams.length - 1;
  if (pv.target > last) pv.target = last;

  // The eye: a spring to the station, leaning a little into a scroll still gathering.
  if (still) { pv.cam = pv.target; pv.cv = 0; }
  else if (now > pv.t0 - 400) {
    const goal = pv.target + Math.max(-0.1, Math.min(0.1, pv.acc / 460)) * 0.6, w = 4.4;
    pv.cv += (w * w * (goal - pv.cam) - 2 * w * pv.cv) * dt; pv.cam += pv.cv * dt;
  }
  const ct = pv.cam;
  let camZ;
  if (ct <= 0) camZ = ct * 1.2;
  else if (ct >= last) camZ = cams[last] + (ct - last);
  else { const a = Math.floor(ct); camZ = cams[a] + (cams[a + 1] - cams[a]) * (ct - a); }

  // The gaze: the eye drifts a little toward the pointer.
  const gaze = !still && pv.mx > -1e3;
  const tx = gaze ? (pv.mx - 720) / 720 * 22 : 0, ty = gaze ? (pv.my - 450) / 450 * 9 : 0;
  pv.pvx += (tx - pv.pvx) * (1 - Math.exp(-dt * 2.5)); pv.pvy += (ty - pv.pvy) * (1 - Math.exp(-dt * 2.5));
  const cx = 720 + pv.pvx, hy = 378 + pv.pvy;
  const P = (X, Y, z) => { const d = z - camZ; return [cx + X / d, hy + (EY - Y) / d]; };

  // What the pointer is over: the farthest arch it falls inside, or the niche.
  let hov = -1;
  if (pv.overHit && here) {
    const dW = zW - camZ;
    if (dW > 1.5 && Math.abs(pv.mx - cx) < 170 / dW && pv.my > hy + (EY - 540) / dW && pv.my < hy + EY / dW) hov = cnt;
    else for (let i = cnt - 1; i >= 0; i--) {
      const d = zm[i] + 0.18 - camZ; if (d < 1.5) continue;
      if (Math.abs(pv.mx - cx) < (R + 10) / d && pv.my > hy + (EY - YS - R - 50) / d && pv.my < hy + EY / d) { hov = i; break; }
    }
  }
  if (hov !== pv.hoverArch) { pv.hoverArch = hov; pvHit.style.cursor = hov >= 0 ? "pointer" : "default"; }
  const nextIdx = pv.target < cnt ? pv.target : -1;

  // The canvas, under the sculpture.
  const dpr = window.devicePixelRatio || 1, W = Math.round(pv.vw * dpr), H = Math.round(pv.vh * dpr);
  if (pvCanvas.width !== W || pvCanvas.height !== H) { pvCanvas.width = W; pvCanvas.height = H; }
  const ctx = pvCanvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.setTransform(dpr * pv.k, 0, 0, dpr * pv.k, dpr * pv.ox, dpr * pv.oy);
  const pal = PV_PAL[document.documentElement.dataset.theme === "dark" ? "dark" : "light"];
  const rgba = (c, a) => "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.max(0, Math.min(1, a)) + ")";
  const x0 = -pv.ox / pv.k, x1 = (pv.vw - pv.ox) / pv.k, y1 = (pv.vh - pv.oy) / pv.k, y0 = -pv.oy / pv.k;
  const hc = f0 + (camZ + 1 - 2.4) / K;

  // The sun, crossing the sky as the day goes.
  const u = Math.max(-1.25, Math.min(1.25, (hc - 13) / 8));
  const sunUp = Math.max(0.35, Math.min(1, (22.5 - hc) / 2.5));
  const gx = cx + u * 560, gy = hy - 60 - 190 * (1 - u * u);
  const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, 640);
  gg.addColorStop(0, rgba(pal.hi, pal.glowA * sunUp)); gg.addColorStop(1, rgba(pal.hi, 0));
  ctx.fillStyle = gg; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = rgba(pal.ink, pal.lineA * 0.9); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, hy); ctx.lineTo(x1, hy); ctx.stroke();

  // The far wall and its niche, where the figure stands.
  const dW = zW - camZ;
  if (dW > 0.3) {
    const [wx0, wy0] = P(-XR, 1030, zW), [wx1, wy1] = P(XR, 0, zW);
    ctx.fillStyle = rgba(pal.ink, 0.028); ctx.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    ctx.strokeStyle = rgba(pal.ink, pal.lineA * 1.2); ctx.strokeRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    pvArch(ctx, cx, hy, dW, 160, 136, 360, rgba(pal.gilt, 0.8 * pvFog(dW) * (hov === cnt ? 1.3 : 1)), hov === cnt ? 1.5 : 1, false);
  }
  pvStand(here, dW, cx, hy, now);

  // The pavement, laid to the vanishing point.
  const zN = camZ + 0.4, zF = zW;
  for (let j = Math.floor(zN / TD); j * TD < zF; j++) {
    const za = Math.max(j * TD, zN), zb = Math.min((j + 1) * TD, zF); if (zb <= za) continue;
    const fa = pvFog((za + zb) / 2 - camZ) * (0.35 + 0.65 * pvSS(0.4, 1.6, (za + zb) / 2 - camZ));
    ctx.fillStyle = rgba(pal.ink, pal.tileA * fa); ctx.beginPath();
    for (let c = -7; c < 7; c++) {
      if (((j + c) & 1) === 0) continue;
      const [ax, ay] = P(c * TW, 0, za), [bx] = P((c + 1) * TW, 0, za), [qx, qy] = P((c + 1) * TW, 0, zb), [dx] = P(c * TW, 0, zb);
      ctx.moveTo(ax, ay); ctx.lineTo(bx, ay); ctx.lineTo(qx, qy); ctx.lineTo(dx, qy); ctx.closePath();
    }
    ctx.fill();
    if (j * TD >= zN) {
      const [lx, ly] = P(-XR, 0, j * TD), [rx] = P(XR, 0, j * TD);
      ctx.strokeStyle = rgba(pal.ink, pal.lineA * fa); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(rx, ly); ctx.stroke();
    }
  }
  const [, ny] = P(0, 0, zN), [, fy] = P(0, 0, zF);
  const og = ctx.createLinearGradient(0, ny, 0, fy);
  og.addColorStop(0, rgba(pal.ink, pal.lineA * 1.1)); og.addColorStop(1, rgba(pal.ink, pal.lineA * 0.3));
  ctx.strokeStyle = og; ctx.beginPath();
  for (let c = -7; c <= 7; c++) { const [ax, ay] = P(c * TW, 0, zN), [bx, by] = P(c * TW, 0, zF); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); }
  ctx.stroke();

  // The meridian: a gilt line inlaid with the hours.
  const zE = Math.min(zh(LAST_HOUR) + 0.06, zF);
  if (zE > zN) {
    const [m0x, m0y] = P(-5, 0, zN), [m1x] = P(5, 0, zN), [m2x, m2y] = P(5, 0, zE), [m3x] = P(-5, 0, zE);
    const mg = ctx.createLinearGradient(0, m0y, 0, m2y);
    mg.addColorStop(0, rgba(pal.gilt, 0.95)); mg.addColorStop(1, rgba(pal.gilt, 0.35));
    ctx.fillStyle = mg; ctx.beginPath(); ctx.moveTo(m0x, m0y); ctx.lineTo(m1x, m0y); ctx.lineTo(m2x, m2y); ctx.lineTo(m3x, m2y); ctx.closePath(); ctx.fill();
  }
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  for (let h = FIRST_HOUR; h <= LAST_HOUR; h += 0.5) {
    const z = zh(h); if (z < zN || z > zF) continue;
    const d = z - camZ, full = h % 1 === 0, X = full ? 42 : 18, fa = pvFog(d);
    const [ax, ay] = P(-X, 0, z), [bx] = P(X, 0, z);
    ctx.strokeStyle = rgba(pal.gilt, (full ? 0.85 : 0.5) * fa); ctx.lineWidth = full ? 1.2 : 1;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, ay); ctx.stroke();
    const numA = 0.8 * fa * pvSS(0.45, 1.0, Math.abs(ct)) * pvSS(1.85, 1.45, d);
    if (full && d > 0.55 && numA > 0.01) {
      const [tx2, ty2] = P(64, 0, z);
      ctx.save(); ctx.translate(tx2, ty2); ctx.scale(1, Math.min(0.75, 0.5 / d));
      ctx.font = "500 " + (58 / d) + "px 'Cormorant Garamond', Georgia, serif";
      ctx.fillStyle = rgba(pal.deep, numA); ctx.fillText(romanNumeral(h), 0, 0); ctx.restore();
    }
  }
  ctx.lineWidth = 1;
  for (let i = 0; i < cnt; i++) {
    const z = zm[i]; if (z < zN || z > zF) continue;
    const q = 30 / 1080, [ax, ay] = P(-30, 0, z), [bx, by] = P(0, 0, z + q), [qx] = P(30, 0, z), [, dy] = P(0, 0, z - q);
    ctx.fillStyle = rgba(pal.hi, pv.ap[i]); ctx.strokeStyle = rgba(pal.deep, 0.9 * pv.ap[i]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(qx, ay); ctx.lineTo(bx, dy); ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // The sun's spot on the line, where you stand.
  ctx.save(); ctx.translate(cx, hy + EY); ctx.scale(1, 0.375);
  const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 150);
  sg.addColorStop(0, rgba(pal.hi, 0.6 * sunUp)); sg.addColorStop(1, rgba(pal.hi, 0));
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  // The arches, far to near.
  for (let i = cnt - 1; i >= 0; i--) {
    const d = zm[i] + 0.18 - camZ; if (d < 0.4) continue;
    const lit = i === hov ? 1.35 : 1, a = pvFog(d) * pvSS(0.55, 1.05, d) * pv.ap[i] * (d < 1.5 ? 0.55 : 0.9) * lit;
    pvArch(ctx, cx, hy, d, R, RI, YS, rgba(pal.gilt, a), i === hov ? 1.6 : 1, true);
    if (d > 1.5 && i !== hov && i !== nextIdx) {
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.font = "600 " + Math.max(9, 24 / d) + "px 'Cormorant Garamond', Georgia, serif";
      ctx.fillStyle = rgba(pal.deep, a); ctx.fillText(romanNumeral(Math.round(pv.dh[i])), cx, hy + (EY - YS - R - 26) / d);
    }
  }

  // The words, placed in the room.
  const vis = s => 1 - pvSS(0.1, 0.62, Math.abs(ct - s));
  for (const el of pvLive.querySelectorAll("[data-p]")) {
    const kind = el.dataset.p;
    if (el._ax == null) { el._ax = parseFloat(el.style.left) || 0; el._ay = parseFloat(el.style.top) || 0; }
    if (kind === "far") {
      const i = +el.dataset.i, d = i < cnt ? zm[i] + 0.18 - camZ : 0;
      const want = i < cnt && d > 1.5 && (i === hov || i === nextIdx) ? pv.ap[i] : 0;
      el._o = (el._o || 0) + (want - (el._o || 0)) * (still ? 1 : 1 - Math.exp(-dt * 7));
      // Over the keystone from the threshold; inside the opening once walking, clear of the meal's own name.
      const ly = pv.target === 0 ? EY - YS - R - 30 : EY - YS * 0.62;
      if (i < cnt && d > 0.3) el.style.transform = "translate(" + (cx - 720) + "px," + (hy + ly / d) + "px)";
      el.style.opacity = el._o; el.style.visibility = el._o < 0.01 ? "hidden" : "visible";
      continue;
    }
    let z, stn, extra = 1, dy = 0;
    if (kind === "sum") {
      z = 1; stn = 0;
      const t = still ? 9 : (now - pv.t0) / 1000 - 0.15 - (+el.dataset.r || 0) * 0.13;
      extra = Math.max(0, Math.min(1, t / 0.8)); const e2 = Math.max(0, Math.min(1, t / 1.1));
      dy = 14 * Math.pow(1 - e2, 3);
    } else if (kind === "meal") {
      const i = +el.dataset.i; if (i >= cnt) { el.style.visibility = "hidden"; continue; }
      z = zm[i]; stn = 1 + i; extra = pv.ap[i];
    } else { z = zW - 0.04; stn = last; }
    const d = z - camZ;
    if (d < 0.42) { el.style.opacity = 0; el.style.visibility = "hidden"; el.style.pointerEvents = "none"; continue; }
    const s = 1 / d, X = cx + (el._ax - cx) * s, Y = hy + (el._ay - hy) * s;
    const o = vis(stn) * pvSS(0.5, 0.9, d) * extra;
    el.style.transform = "translate(" + (X - el._ax) + "px," + (Y - el._ay + dy) + "px) scale(" + s + ")";
    el.style.opacity = o; el.style.visibility = o < 0.01 ? "hidden" : "visible";
    el.style.pointerEvents = o > 0.5 ? "auto" : "none"; el.style.zIndex = String(Math.round(1000 - d * 40));
  }

  // The marker on the footer's meridian.
  const mark = $("fd-mark");
  if (mark) {
    const xs = [0, ...pv.dh.map(h => 30 + (h - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR) * 300), 360];
    const c2 = Math.max(0, Math.min(last, ct)), a2 = Math.min(last - 1, Math.floor(c2));
    mark.style.transform = "translateX(" + (last ? xs[a2] + (xs[a2 + 1] - xs[a2]) * (c2 - a2) : 0) + "px)";
  }
}

/**
 * The figure in the niche: the live sculpture stood on the niche's floor,
 * as tall as the niche allows, fading with the room's haze as the wall
 * recedes. `dW` is how far the wall is; (cx, hy) the room's centre and
 * horizon on the plate. Nothing when the sculpture cannot be stood (a flat
 * figure, a phone, another stage).
 */
function pvStand(here, dW, cx, hy) {
  const op = here && !Stages.narrow && dW > 0.3 ? pvFog(dW) * pvSS(0.5, 0.9, dW) : 0;
  if (typeof figure !== "object" || !here || Stages.narrow) return;
  if (Math.abs(op - pv.figOp) > 0.015 || (op === 0) !== (pv.figOp === 0)) { pv.figOp = op; figure.setDim(op); }
  if (dW <= 0.3) return;
  // The niche on the plate: centred under its arch, 496 tall from 91 above the horizon's mark to the floor.
  const s = 1 / dW, X = cx - pv.pvx * s, Y = hy - pv.pvy * s;
  const tall = 496 * s * pv.k, floor = pv.oy + pv.k * (Y + 405 * s);
  figure.standAt({ x: pv.ox + pv.k * X, y: floor - tall * 0.012, h: tall * PV_NICHE.fill, az: PV_NICHE.az });
}

function pvLoop(now) {
  pv.raf = 0;
  if (Stages.current !== "nutrition") {
    if (!pv.leftAt) pv.leftAt = now;
    if (now - pv.leftAt > 900) { pv.leftAt = 0; pv.lt = 0; return; }
  } else pv.leftAt = 0;
  pv.raf = requestAnimationFrame(pvLoop);
  try { pvFrame(now); } catch (e) { if (!pv.err) { pv.err = 1; console.warn("Nutrition room: " + e.message); } }
}
const pvRun = () => { if (!pv.raf) pv.raf = requestAnimationFrame(pvLoop); };

/* -------------------------------- moving ---------------------------------- */

/** Walks to station `t`: the sum, a meal, or the day. */
function pvGoTo(t) {
  const last = pvLast();
  t = Math.max(0, Math.min(last, t));
  pv.target = t;
  if (pv.station === t && !pv.chooser) return;
  const moved = pv.station !== t;
  pv.station = t; pv.chooser = null; pv.hoverFood = null;
  renderNutritionStage();
  if (!moved) return;
  Stages.paintFooter();
  Stages.remember();
  const n = nutrition();
  if (t === 0) announce("The sum: " + fmtK(n.kcal) + " kcal and " + n.protein + " g protein a day");
  else if (t === last) announce("The day: " + n.mealsPerDay + " meals, " + fmtK(n.kcal) + " kcal and " + n.protein + " g protein");
  else { const m = n.meals[t - 1]; announce(m.name + " at " + pvHH(m.hour) + ": about " + fmtK(m.kcal) + " kcal and " + m.protein + " g protein"); }
}

nutritionEl.addEventListener("wheel", e => {
  if (Stages.current !== "nutrition" || Stages.busy || Stages.narrow || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  const now = performance.now(), dir = Math.sign(e.deltaY), last = pvLast();
  // At either end the wheel goes on to the next stage, as firmly as anywhere else.
  if ((pv.target === 0 && dir < 0) || (pv.target >= last && dir > 0)) {
    if (now - pv.lastWheel > STAGE_WHEEL.gap) pv.edge = 0;
    pv.lastWheel = now;
    if (pv.locked) return;
    pv.edge += e.deltaY;
    if (Math.abs(pv.edge) > STAGE_WHEEL.threshold) {
      pv.edge = 0; pv.locked = true;
      Stages.wheelAt = now; Stages.spent = true;
      if (dir < 0) Stages.back(); else Stages.next();
    }
    return;
  }
  pv.edge = 0;
  if (pv.locked) { pv.lastWheel = now; return; }
  pv.acc += e.deltaY;
  if (Math.abs(pv.acc) > 46) { pvGoTo(pv.target + Math.sign(pv.acc)); pv.acc = 0; pv.locked = true; pv.lastWheel = now; }
}, { passive: true });

addEventListener("keydown", e => {
  if (Stages.current !== "nutrition" || Stages.busy || Stages.opening || Stages.narrow || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target, tag = (t && t.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t.closest && t.closest(".masthead"))) return;
  if (e.key === "Escape") { if (pv.chooser) { pv.chooser = null; renderNutritionStage(); } return; }
  if (e.key === " " && tag === "BUTTON") return;
  if (["ArrowDown", "PageDown", "ArrowRight", " "].includes(e.key)) { e.preventDefault(); pvGoTo(pv.target + 1); }
  else if (["ArrowUp", "PageUp", "ArrowLeft"].includes(e.key)) { e.preventDefault(); pvGoTo(pv.target - 1); }
  else if (e.key === "Home") { e.preventDefault(); pvGoTo(0); }
  else if (e.key === "End") { e.preventDefault(); pvGoTo(pvLast()); }
});

addEventListener("pointermove", e => {
  if (Stages.current !== "nutrition" || e.pointerType === "touch") return;
  const b = nutritionEl.getBoundingClientRect();
  pv.mx = (e.clientX - b.left - pv.ox) / pv.k; pv.my = (e.clientY - b.top - pv.oy) / pv.k;
  pv.overHit = e.target === pvHit;
}, { passive: true });

pvHit.addEventListener("click", () => {
  if (pv.chooser) { pv.chooser = null; renderNutritionStage(); return; }
  const cnt = nutrition().isValid() ? nutrition().mealsPerDay : 0;
  if (pv.hoverArch >= 0) pvGoTo(pv.hoverArch === cnt ? cnt + 1 : pv.hoverArch + 1);
});

/* -------------------------------- changes --------------------------------- */

/** Changes the plan, keeps it, and draws the stage again. */
function pvChanged(fn) {
  fn(nutrition());
  saveRoutine(routine);
  // A plan with fewer meals than the station walked to ends at its day.
  if (pv.station > pvLast()) { pv.station = pv.target = pvLast(); Stages.remember(); }
  renderNutritionStage();
  Stages.paintFooter();
}

/** Moves the eating window's first (`df`) or last (`dl`) hour. */
const pvWindow = (df, dl) => pvChanged(n => n.setWindow(n.firstMeal + df, n.lastMeal + dl));

function pvClick(e) {
  const b = e.target.closest("button[data-act]");
  if (!b || b.disabled) return;
  const act = b.dataset.act, k = b.dataset.k, i = Number(b.dataset.i);
  const announceTargets = () => { const n = nutrition(); if (n.isValid()) announce("Estimate: " + fmtK(n.kcal) + " kcal and " + n.protein + " g protein a day"); };
  switch (act) {
    case "goal": pv.hoverGoal = null; pvChanged(n => n.setGoal(k)); announceTargets(); break;
    case "kcal-less": case "kcal-more": pvChanged(n => n.setAdjust(n.adjust + (act === "kcal-more" ? 0.01 : -0.01))); announceTargets(); break;
    case "protein-less": case "protein-more": pvChanged(n => n.setProtein(n.proteinPerKg + (act === "protein-more" ? 0.1 : -0.1))); announceTargets(); break;
    case "reset-adjust": pvChanged(n => { n.adjustInput = null; }); announceTargets(); break;
    case "reset-protein": pvChanged(n => { n.proteinInput = null; }); announceTargets(); break;
    case "activity": pvChanged(n => n.setActivity(k)); announceTargets(); break;
    case "ledger": pv.ledger = !pv.ledger; renderNutritionStage(); break;
    case "open": pv.chooser = pv.chooser === k ? null : k; renderNutritionStage(); break;
    case "count": pv.shift = {}; pvChanged(n => n.setMealCount(Number(k))); break;
    case "diet": pv.shift = {}; pvChanged(n => { n.diet = k; }); break;
    case "time-less": case "time-more": {
      const d = act === "time-more" ? 1 : -1;
      if (pv.chooser === "last") pvWindow(0, d); else pvWindow(d, 0);
      break;
    }
    case "earlier": case "later": pvChanged(n => n.moveMeal(i, n.hours[i] + (act === "later" ? 1 : -1))); break;
    case "idea": {
      pv.shift = { ...pv.shift, [i]: (pv.shift[i] || 0) + 1 };
      renderNutritionStage();
      const m = pvMeals(nutrition())[i];
      if (m && m.pick) announce(m.name + ": " + m.pick.idea.name + ", " + fmtK(m.pick.kcal) + " kcal and " + m.pick.protein + " g protein");
      break;
    }
    case "sum": pvGoTo(0); break;
    case "end": pvGoTo(pvLast()); break;
    case "station": pvGoTo(Number(k)); break;
  }
}
nutritionEl.addEventListener("click", pvClick);
pvFoot.addEventListener("click", pvClick);

/* Pointing at a goal shows what it would come to; pointing at a food, what it brings. */
function pvPoint(e) {
  // Leaving, what counts is where the pointer or the focus went.
  const to = e.type === "pointerout" || e.type === "focusout" ? e.relatedTarget : e.target;
  const el = to && to.closest && nutritionEl.contains(to) ? to : null;
  const goal = el && el.closest('[data-act="goal"]');
  const goalTo = goal ? goal.dataset.k : null;
  const food = el && el.closest("[data-food]");
  const [fi, fj] = food ? food.dataset.food.split(":").map(Number) : [-1, -1];
  const foodTo = food ? { i: fi, j: fj } : null;
  const sameFood = (pv.hoverFood && foodTo && pv.hoverFood.i === fi && pv.hoverFood.j === fj) || (!pv.hoverFood && !foodTo);
  if (goalTo === pv.hoverGoal && sameFood) return;
  pv.hoverGoal = goalTo; pv.hoverFood = foodTo;
  renderNutritionStage();
}
for (const type of ["pointerover", "pointerout", "focusin", "focusout"]) nutritionEl.addEventListener(type, pvPoint);

/* ---------------------------------- stage --------------------------------- */

Stages.register("nutrition", {
  arrive() {
    const last = pvLast(), at = /^s(\d+)$/.exec(Stages.at || "");
    pv.station = at ? Math.min(last, Number(at[1])) : Stages.from === "plan" ? last : 0;
    pv.target = pv.station;
    pv.cam = pv.station - 0.6; pv.cv = 0; pv.acc = 0; pv.edge = 0;
    pv.dh = []; pv.ap = [];
    pv.chooser = null; pv.hoverGoal = null; pv.hoverFood = null; pv.ledger = false;
    pv.figOp = 0;
    // The room comes in as the stage's words do: after the change's settle.
    pv.t0 = performance.now() + (Stages.from === null ? 0 : Stages.still ? STAGE_TIMING.settleStill : STAGE_TIMING.settle);
  },
  enter() {
    if (pv.station > pvLast()) pv.station = pv.target = pvLast();
    pvFit();
    renderNutritionStage();
    pvRun();
  },
  place: () => "s" + pv.station,
  shot: () => Stages.narrow ? "nutrition" : "nutrition-niche",
  // The figure shows in the niche as the room's haze lets it; on a phone the stage has the screen.
  dim: () => Stages.narrow ? 0 : pv.figOp,
  focus: () => $("nutrition-title"),
  // The wheel walks the day, and leaves the stage at either end (above).
  wheel: () => Stages.narrow,
  footer() {
    const n = nutrition(), ok = n.isValid(), st = pv.station, last = pvLast(), empty = routine.selection.isEmpty();
    const meals = ok ? n.meals : [];
    const toPlan = !ok || st >= last;
    return {
      back: st === 0 ? "Measure" : st === 1 ? "The sum" : meals[st - 2] ? meals[st - 2].name : "The sum",
      skip: st === 0 && !empty ? (Stages.narrow ? "Skip" : "Skip, training only") : "",
      next: toPlan ? "Week plan" : st === 0 ? "Walk the day" : st < meals.length ? meals[st].name : "The day",
      hint: toPlan ? "" : "or scroll",
      nextDisabled: toPlan && empty
    };
  },
  onNext() { if (nutrition().isValid() && pv.station < pvLast()) { pvGoTo(pv.station + 1); return true; } },
  onBack() { if (pv.station > 0) { pvGoTo(pv.station - 1); return true; } }
});

/* A new theme redraws the room at once; a resize refits the plate. */
addEventListener("resize", () => { if (Stages.current === "nutrition") { pvFit(); renderNutritionStage(); } });
