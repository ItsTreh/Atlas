/* ===========================================================================
   Week plan stage — fit it into your life.

   The camera comes in close on the upper body, three-quarter from the
   figure's left, and the plan takes the other side. Three screens, one at
   a time, each the whole task in front of the user:

     • Fit it into your life   the week as a frieze: seven figures on one
                               ground line, one a day, each lit where that
                               day trains (the real plan the planner would
                               place, before Generate). Beside each figure
                               stands its day, from morning at the top to
                               night at the foot: drag down it to say when
                               you are busy, and the session moves to the
                               hours left. Under it, how many days, the
                               split, how long and when; then Generate.
     • Shape your week         the same hours as a full-width calendar, where
                               the frieze cannot be drawn (a phone, or no
                               WebGL): there the days are cards and this is
                               where busy hours are painted.
     • Your week               the generated week as a calendar. Pointing at a
                               session lights its muscles on the sculpture;
                               opening one shows it in full (workout-view.js),
                               with everything that can be changed about it.

   Hard limits come first: busy hours and days off are painted directly,
   preferences after. Everything is read from and written to the routine
   (routine.js); what the planner would do before Generate is
   routine.weekPlan(), the same plan Generate places.
   ========================================================================= */

const weekEl = $("week-panel");
const planEl = $("stage-plan");

/* What is on screen: the screen, the session open or pointed at, the day
   tile pointed at, the last Generate's message, and what was just changed. */
const wk = { view: "config", sel: null, hover: null, tile: null, status: null, changed: null, plates: false };

/* The calendars' hours, and how tall a day's head is. */
const WEEK_HOURS = [FIRST_HOUR, LAST_HOUR + 1];
const WEEK_HEAD = 98;

/** The week's message (what Generate did, what an edit changed); null to clear. */
function setStatus(text, kind = "") {
  wk.status = text ? { text, kind } : null;
  announce(text);
  if (Stages.current === "plan") renderWeek();
}

/* --------------------------------- reading -------------------------------- */

/** The week the planner would place now (routine.weekPlan): its fit, and each day's placement. */
function weekPreview() {
  const plan = routine.weekPlan(routine.experience || DEFAULT_EXPERIENCE);
  return { plan, fit: plan.fit, byDay: new Map(plan.placements.map(p => [p.day, p])) };
}

const isBusy = (day, h) => { const s = routine.slot(day, h); return !!s && s.state === SlotState.BUSY; };

/** A day's busy hours as runs [from, to). */
function busyRuns(day, [from, to] = WEEK_HOURS) {
  const runs = []; let a = null;
  for (let h = from; h <= to; h++) {
    const b = h < to && isBusy(day, h);
    if (b && a === null) a = h;
    if (!b && a !== null) { runs.push([a, h]); a = null; }
  }
  return runs;
}

/** "Mon–Fri", "Sat, Sun": a set of days, runs of three or more joined. */
function dayRuns(days) {
  const out = []; let run = [];
  for (const d of days) {
    const prev = run[run.length - 1];
    if (prev && DayOfWeek.indexOf(d) === DayOfWeek.indexOf(prev) + 1) run.push(d);
    else { if (run.length) out.push(run); run = [d]; }
  }
  if (run.length) out.push(run);
  return out.map(r => r.length > 2 ? DayOfWeek.label[r[0]] + "–" + DayOfWeek.label[r[r.length - 1]]
                                   : r.map(d => DayOfWeek.label[d]).join(", ")).join(", ");
}

/** The busy hours and days off in a line: "Mon–Fri 9am–5pm · Sun off". */
function busySummary() {
  const byDay = new Map();
  for (const d of DayOfWeek.values) {
    if (routine.isDayUnavailable(d)) continue;
    const runs = busyRuns(d).map(([a, b]) => hourRange(a, b));
    if (runs.length) byDay.set(d, runs.join(", "));
  }
  const groups = [];
  for (const [d, r] of byDay) {
    const g = groups.find(x => x.r === r);
    if (g) g.days.push(d); else groups.push({ r, days: [d] });
  }
  const parts = groups.map(g => dayRuns(g.days) + " " + g.r);
  const off = DayOfWeek.values.filter(d => routine.isDayUnavailable(d));
  if (off.length) parts.push(dayRuns(off) + " off");
  return parts.join(" · ");
}

const windowWord = () => routine.preferredWindow === "any" ? "Any time of day"
  : WINDOWS[routine.preferredWindow].label + "s when free";

/**
 * What the weekly targets look like against the week, and what would help if
 * not. A prediction made before Generate (WeeklyRoutine.weekPlan), so it says
 * "looks", "would" and "estimate", never "fits" as a fact.
 */
function fitNote(fit) {
  if (!fit || !routine.selection.size) return null;
  if (!routine.availableDays().length)
    return { warn: true, text: "There is no day left to train: every day is marked off or fully busy. " +
      "Turn a day back on or clear some hours." };
  const h = min => (Math.round(min / 6) / 10) + " h";
  const names = fit.trimmed.map(id => MUSCLE_BY_ID.get(id).name).join(", ");
  const fixes = [];
  if (fit.fixes && fit.fixes.extraDay) fixes.push("one more training day (" + fit.fixes.extraDay + ")");
  if (fit.fixes && fit.fixes.sessionMinutes) fixes.push("sessions of " + fit.fixes.sessionMinutes + " min");
  const fix = fixes.length ? " With " + fixes.join(" or ") + " everything should fit (estimate)." : "";
  // What the week the planner builds can hold: the days it really uses, and
  // muscles a split leaves without a day.
  const before = [];
  if (fit.days < fit.askedDays)
    before.push("Recovery and your free hours look like room for " + fit.days + " of your " +
                fit.askedDays + " training days (estimate).");
  if (fit.unplaced.length)
    before.push(SPLITS[routine.split].label + " would leave " +
                nameList(fit.unplaced.map(id => MUSCLE_BY_ID.get(id).name)) + " without a day this week.");
  const lead = before.length ? before.join(" ") + " " : "";
  if (!fit.fits || !fit.meetsMinimums) {
    const low = fit.belowMinimum.map(id => MUSCLE_BY_ID.get(id).name).join(", ");
    return { warn: true, text: lead + "Even the usual minimum for every muscle looks like more than your sessions can hold " +
      "(about " + h(fit.capacityMinutes) + " a week, estimate). " + (low ? "So that every muscle is still trained, " + low +
      " would get less than their usual minimum. " : "") + "Add a training day, make sessions longer, or drop a muscle." + fix };
  }
  if (fit.trimmed.length)
    return { warn: true, text: lead + "Your sessions (about " + h(fit.capacityMinutes) + " a week, estimate) look too short " +
      "for every target, so the plan lowers " + names + " (never below their minimum)." + fix };
  return { warn: !!lead, text: lead + "Your settings look feasible (estimate): about " + h(fit.neededMinutes) +
    " of working sets in about " + h(fit.capacityMinutes) + " of session time." };
}

/**
 * The setup screen's one line about the fit: only when the plan would cut
 * something, the most serious thing first. The full reasoning is fitNote,
 * shown in Shape your week.
 */
function shortFitNote(fit) {
  if (!fit || !routine.selection.size) return null;
  const list = ids => nameList(ids.map(id => MUSCLE_BY_ID.get(id).name));
  if (!fit.fits || !fit.meetsMinimums)
    return "Even the usual minimum for every muscle looks like more than your sessions can hold (estimate).";
  if (fit.trimmed.length)
    return "Your sessions look too short for every target, so " + list(fit.trimmed) +
      (fit.trimmed.length === 1 ? " is" : " are") + " lowered (estimate).";
  if (fit.unplaced.length)
    return SPLITS[routine.split].label + " would leave " + list(fit.unplaced) + " without a day this week.";
  if (fit.days < fit.askedDays)
    return "There looks to be room for " + fit.days + " of your " + fit.askedDays + " training days (estimate).";
  return null;
}

/* ------------------------------ fit it in (config) ------------------------- */

/* EXPERIENCE_LEVELS' labels, short enough to sit side by side in the setup row. */
const EXPERIENCE_SHORT = { beginner: "Under 6 months", intermediate: "6 mo – 2 yrs", advanced: "2+ years" };

function configHTML() {
  const pv = weekPreview(), fit = pv.fit;
  const muscles = routine.selectedMuscles(), src = routine.selection.source();
  const program = src.program ? " · " + src.program.name + (src.kind === "modified" ? " (edited)" : "") : "";
  const names = muscles.map(m => m.name);
  // The frieze: the week as seven plates, the figure standing in each as
  // that day trains it. A rest day's figure stands back; a day off has none.
  // Beside each figure, its day: the hours from morning to night, as tall
  // as the plate, with what is busy, where the session would go, and the
  // meals. Each hour is a cell to paint (paint.js).
  const [H0, H1] = WEEK_HOURS, rows = H1 - H0;
  const ph = Math.round(Math.max(180, Math.min(360, innerHeight * .31))), rh = ph / rows;
  wk.rh = rh;
  const n = routine.nutrition, mealsOn = n.isValid() && n.showMeals;
  const mealPlan = mealsOn ? routine.mealPlan(slot => {
    const p = pv.byDay.get(slot.day);
    return !p || slot.hour < p.start || slot.hour >= p.end;
  }) : { placed: [] };
  const band = routine.preferredWindow === "any" ? null : WINDOWS[routine.preferredWindow];
  const marks = Array.from({ length: rows }, (_, k) => H0 + k).filter(h => h % 3 === 0 && h > H0)
    .map(h => '<span class="staff-hour" style="top:' + px((h - H0) * rh) + '">' + hourLabel(h) + '</span>').join("");
  const staff = (d, p) => '<div class="staff">' + marks +
    (band ? '<i class="band" style="top:' + px((Math.max(band.from, H0) - H0) * rh) + ';height:' + px((Math.min(band.to, H1) - Math.max(band.from, H0)) * rh) + '"></i>' : '') +
    '<div class="day-busy" data-busy="' + d + '">' + busyHTML(d, rh, WEEK_HOURS) + '</div>' +
    (p ? '<i class="staff-sess" data-ghost="' + d + '" style="top:' + px((p.start - H0) * rh + 1) + ';height:' + px(Math.max(8, (p.end - p.start) * rh - 2)) + '"></i>' : '') +
    mealPlan.placed.filter(x => x.day === d && x.hour >= H0 && x.hour < H1).map(x =>
      '<i class="staff-meal" style="top:' + px((x.hour - H0) * rh + rh / 2) + '"></i>').join("") +
    Array.from({ length: rows }, (_, k) =>
      '<div class="paint" role="button" data-day="' + d + '" data-hour="' + (H0 + k) + '" data-key="paint-' + d + '-' + (H0 + k) + '" ' +
        'data-t="' + hourRange(H0 + k, H0 + k + 1) + '" tabindex="' + (paintCellKey() === "paint-" + d + "-" + (H0 + k) ? 0 : -1) + '" ' +
        'aria-pressed="' + (routine.slot(d, H0 + k).state === SlotState.BUSY) + '" ' +
        'aria-label="' + DAY_NAME[d] + ' ' + hourLabel(H0 + k) + ', busy" style="top:' + px(k * rh) + ';height:' + px(rh) + '"></div>').join("") +
    '</div>';
  const tiles = DayOfWeek.values.map((d, i) => {
    const off = routine.isDayUnavailable(d), p = pv.byDay.get(d);
    const fams = p ? blockFamilies(p.block) : [];
    const cls = off ? " off" : p ? " on" : " rest";
    return '<div class="tile' + cls + (wk.tile === d ? ' pointed' : '') + '" data-tile="' + d + '" style="--i:' + i + '">' +
      '<div class="plate">' + (off ? '' : staff(d, p) +
        '<canvas class="plate-fig" data-plate="' + d + '" data-ids="' + (p ? workedIds(p.block).join(",") : "") + '" aria-hidden="true"></canvas>') + '</div>' +
      '<span class="tile-day">' + DayOfWeek.label[d] + '</span>' +
      '<span class="tile-name">' + (off ? "Off" : p ? esc(blockName(p.block)) : "Rest") + '</span>' +
      '<span class="tile-dots">' + familyDots(fams) + '</span>' +
      '<span class="tile-meta">' + (p ? hourRange(p.start, p.end) : off ? "" : "Free day") + '</span>' +
      '<button type="button" class="tile-off" data-dayoff="' + d + '" data-key="off-' + d + '" aria-pressed="' + off + '" ' +
        'aria-label="' + (off ? "Make " + DAY_NAME[d] + " available" : "Take " + DAY_NAME[d] + " off") + '">' + (off ? "Train this day" : "Take it off") + '</button>' +
    '</div>';
  }).join("");
  const note = fitNote(fit);
  const unplacedBlocks = pv.plan.blocks.filter(b => !pv.plan.placements.some(p => p.block === b));
  const short = shortFitNote(fit), empty = routine.emptySplitDays();
  const busy = busySummary();
  const status = wk.status && !routine.sessions.length ? wk.status : null;
  const [lo, hi] = TRAINING_DAYS_RANGE;

  return '<div class="wk-config">' +
    '<div class="wk-head" data-reveal="0">' +
      '<p class="eyebrow"><span class="n">' + STAGE_NUMERALS.plan + '</span> / Week plan</p>' +
      '<h1 class="display" id="plan-title" tabindex="-1">Fit it into your life</h1>' +
      '<p class="who"><b>' + muscles.length + (muscles.length === 1 ? " muscle group" : " muscle groups") + esc(program) + '</b>' +
        '<span>' + esc(names.length > 5 ? names.slice(0, 4).join(", ") + " +" + (names.length - 4) : names.join(", ")) + '</span>' +
        '<button type="button" class="text-link" data-goto="targets">Change</button></p>' +
    '</div>' +
    '<div class="wk-week" data-reveal="1">' +
      '<div class="tiles' + (wk.changed === "shuffle" ? " shuffle" : "") + '" style="--ph:' + ph + 'px">' + tiles + '</div>' +
      '<p class="staff-hint"><span>Drag down a day’s hours to mark when you’re busy, and again to clear them. The session moves to the hours you leave.</span>' +
        '<span class="legend-keys"><span><i class="k-session"></i>Session</span><span><i class="k-busy"></i>Busy</span>' +
        (band ? '<span><i class="k-band"></i>Preferred time</span>' : '') + (mealsOn ? '<span><i class="k-meal"></i>Meal</span>' : '') + '</span></p>' +
      '<div class="wk-facts">' +
        '<span class="facts"><span>' + routine.sessionMinutes + '-minute sessions</span><span>' + windowWord() + '</span>' +
          '<span>' + (busy ? "Busy " + esc(busy) : "No busy hours set") + '</span></span>' +
        '<button type="button" class="text-link" id="open-shape" data-key="open-shape">Customize week →</button>' +
      '</div>' +
      (unplacedBlocks.length && routine.split === "auto"
        ? '<p class="warn-line">No free day fits ' + nameList(unplacedBlocks.map(b => blockName(b))) + ' yet: unblock some hours or take fewer days off.</p>' : '') +
    '</div>' +
    '<div class="wk-controls" data-reveal="2">' +
      '<div class="wk-row">' +
        '<div class="kv-col"><span class="eyebrow" id="days-label">Days a week</span>' +
          '<span class="kv">' +
            '<button type="button" class="stepper" data-days-step="-1" data-key="days-down" aria-label="One day fewer"' + (routine.sessionsPerWeek <= lo ? ' disabled' : '') + '>−</button>' +
            '<output class="serif-out narrow big" aria-labelledby="days-label">' + routine.sessionsPerWeek + '</output>' +
            '<button type="button" class="stepper" data-days-step="1" data-key="days-up" aria-label="One day more"' + (routine.sessionsPerWeek >= hi ? ' disabled' : '') + '>+</button>' +
          '</span></div>' +
        '<div class="kv-col"><span class="eyebrow" id="split-label">Split</span>' +
          '<span class="segmented" role="radiogroup" aria-labelledby="split-label">' +
            Object.entries(SPLITS).map(([id, sp]) => {
              const gaps = routine.emptySplitDays(id);
              return '<button type="button" role="radio" aria-checked="' + (routine.split === id) + '" data-split="' + id + '" ' +
                'data-key="split-' + id + '"' + (gaps.length ? ' title="No muscles for ' + gaps.join(" or ") + '"' : '') + '>' +
                sp.label + '</button>';
            }).join("") +
          '</span></div>' +
        '<div class="kv-col"><span class="eyebrow" id="experience-label">Training experience</span>' +
          '<span class="segmented" role="radiogroup" aria-labelledby="experience-label">' +
            EXPERIENCE_LEVELS.map(lv =>
              '<button type="button" role="radio" aria-checked="' + (routine.experience === lv.id) + '" ' +
                'data-experience="' + lv.id + '" data-key="exp-' + lv.id + '" aria-label="' + esc(lv.label) + '" ' +
                'title="' + esc(lv.label) + '">' + esc(EXPERIENCE_SHORT[lv.id] || lv.label) + '</button>').join("") +
          '</span>' +
          '<span class="field-note">It does not change your weekly sets yet.</span>' +
        '</div>' +
      '</div>' +
      '<div class="wk-row wk-time">' +
        '<div class="kv-col"><span class="eyebrow">Session length</span>' +
          '<span class="segmented" role="radiogroup" aria-label="Session length">' + SESSION_LENGTH_OPTIONS.map(m =>
            '<button type="button" role="radio" aria-checked="' + (routine.sessionMinutes === m) + '" data-len="' + m + '" data-key="len-' + m + '">' + m + ' min</button>').join("") +
          '</span></div>' +
        '<div class="kv-col"><span class="eyebrow">Preferred time</span>' +
          '<span class="segmented" role="radiogroup" aria-label="Preferred time">' + ["morning", "midday", "evening", "any"].map(k =>
            '<button type="button" role="radio" aria-checked="' + (routine.preferredWindow === k) + '" data-window="' + k + '" data-key="win-' + k + '">' +
              (k === "any" ? "Any" : WINDOWS[k].label) + '</button>').join("") +
          '</span></div>' +
        '<div class="kv-col"><span class="eyebrow">I’m busy</span>' +
          '<span class="presets">' + [["9-17", "Weekdays 9–5"], ["8-18", "Weekdays 8–6"], ["clear", "Never"]].map(([k, label]) =>
            '<button type="button" class="preset" data-preset="' + k + '" data-key="preset-' + k + '">' + label + '</button>').join("") + '</span></div>' +
        (n.isValid() ? '<div class="kv-col"><span class="eyebrow">Meals</span><span class="switch-row"><button type="button" role="switch" class="switch" id="meals-switch" data-key="meals-switch" ' +
            'aria-checked="' + n.showMeals + '" aria-label="Show meals in the week"><i></i></button><span>' + (n.showMeals ? n.mealsPerDay + " a day" : "Hidden") + '</span></span></div>' : '') +
      '</div>' +
      '<div class="wk-notes">' +
        (status ? '<p class="' + (status.kind || "soft") + '">' + esc(status.text) + '</p>' : '') +
        (empty.length ? '<p class="warn">Nothing you selected goes on ' + empty.join(" or ") + ' days.</p>' : '') +
        (short ? '<p class="warn fit-short">' + esc(short) + '<button type="button" class="text-link small" data-shape="1" ' +
          'data-key="note-shape">See why</button></p>' : '') +
        (note ? '<p class="fit-full' + (note.warn ? ' warn' : '') + '" aria-live="polite">' + esc(note.text) + '</p>' : '') +
      '</div>' +
      '<div class="wk-actions">' +
        '<button type="button" class="btn primary" id="generate" data-key="generate">Generate my week</button>' +
        '<span class="wk-actions-note">Exercises come from tiered ratings. You can swap any of them afterwards.</span>' +
        '<span class="wk-actions-end">' +
          (routine.sessions.length ? '<button type="button" class="text-link" id="to-week" data-key="to-week">Your generated week →</button>' : '') +
          '<button type="button" class="quiet-btn" id="reset-week" data-key="reset-week">Reset</button>' +
        '</span>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/* ------------------------------ shape your week ---------------------------- */

/** Row height for a calendar of `rows` hours that should fit the screen without scrolling. */
const rowHeight = (rows, spare, lo, hi) => Math.max(lo, Math.min(hi, Math.floor((innerHeight - spare - WEEK_HEAD) / rows)));
const px = v => Math.round(v) + "px";

function shapeHTML() {
  const pv = weekPreview(), [H0, H1] = WEEK_HOURS, rows = H1 - H0;
  const rh = rowHeight(rows, 470, 18, 30);
  const n = routine.nutrition, mealsOn = n.isValid() && n.showMeals;
  // Meals as Generate will place them: busy hours keep them, the previewed
  // sessions move them.
  const mealPlan = mealsOn ? routine.mealPlan(slot => {
    const p = pv.byDay.get(slot.day);
    return !p || slot.hour < p.start || slot.hour >= p.end;
  }) : { placed: [] };
  const band = routine.preferredWindow === "any" ? null : WINDOWS[routine.preferredWindow];
  const colW = (planEl.clientWidth - 96 - 44 - 36) / 7;
  const note = fitNote(pv.fit);
  const placed = pv.plan.placements.length;
  const okLine = placed + (placed === 1 ? " session" : " sessions") + " of " + routine.sessionMinutes + " min, " +
    (routine.preferredWindow === "any" ? "wherever your day is free." : windowWord().toLowerCase() + ".");
  const warn = note && note.warn;
  const hours = Array.from({ length: rows + 1 }, (_, k) => H0 + k).filter(h => h % 3 === 0 && h < H1)
    .map(h => '<span style="top:' + px(WEEK_HEAD + 2 + (h - H0) * rh) + '">' + hourLabel(h) + '</span>').join("");

  const days = DayOfWeek.values.map(d => {
    const off = routine.isDayUnavailable(d), p = pv.byDay.get(d);
    const fams = p ? blockFamilies(p.block) : [];
    const head = '<button type="button" class="cal-head" data-dayoff="' + d + '" data-key="off-' + d + '" aria-pressed="' + off + '" ' +
        'title="' + (off ? "Make " + DAY_NAME[d] + " available" : "Take " + DAY_NAME[d] + " off") + '">' +
        '<span class="cal-day">' + DayOfWeek.label[d] + '</span>' +
        '<span class="cal-name">' + (off ? "Off" : p ? esc(blockName(p.block)) : "Rest") + '</span>' +
        '<span class="cal-meta">' + familyDots(fams) + '<span>' +
          (off ? "Click to train" : p ? hourRange(p.start, p.end) : "Free day") + '</span></span>' +
      '</button>';
    if (off) return '<div class="cal-col off" data-day="' + d + '">' + head + '<div class="cal-body" style="height:' + px(rows * rh) + '"></div></div>';
    const restCls = p ? "" : " rest";
    const rules = Array.from({ length: rows - 1 }, (_, k) => H0 + k + 1).filter(h => h % 3 === 0)
      .map(h => '<i class="rule" style="top:' + px((h - H0) * rh) + '"></i>').join("");
    const bandEl = band ? '<i class="band" style="top:' + px((Math.max(band.from, H0) - H0) * rh) + ';height:' +
      px((Math.min(band.to, H1) - Math.max(band.from, H0)) * rh) + '"></i>' : "";
    const ghost = p ? (() => {
      const h = Math.max(26, p.block.sessionMinutes / 60 * rh - 4), tall = h >= 48;
      return '<div class="plan-ghost' + (tall ? ' tall' : '') + '" style="top:' + px((p.start - H0) * rh + 2) + ';height:' + px(h) + '">' +
        '<span class="plan-ghost-name">' + esc(blockName(p.block)) + '</span><span class="plan-ghost-time">' + hourRange(p.start, p.end) + '</span></div>';
    })() : "";
    // Each meal where Generate will put it this day (mealPlan): its usual
    // hour, over a busy block too, or the nearest one a session leaves.
    const meals = mealsOn ? mealPlan.placed.filter(x => x.day === d && x.hour >= H0 && x.hour < H1).map(({ meal: m, hour }) =>
      '<span class="meal-pill' + (m.role === "snack" ? " snack" : "") + '" style="top:' + px((hour - H0) * rh + rh / 2) + '" ' +
        'title="' + esc(m.name) + ' · ' + hourLabel(hour) + ' · ≈ ' + m.kcal + ' kcal"><i></i>' +
        (colW >= 128 ? (m.role === "snack" ? "Snack" : esc(m.name)) : "") + '</span>').join("") : "";
    const cells = Array.from({ length: rows }, (_, k) =>
      // One hour to paint. The keyboard reaches the grid through one cell
      // at a time (paint.js): arrows move, Space or Enter toggles busy.
      '<div class="paint" role="button" data-day="' + d + '" data-hour="' + (H0 + k) + '" data-key="paint-' + d + '-' + (H0 + k) + '" ' +
        'tabindex="' + (paintCellKey() === "paint-" + d + "-" + (H0 + k) ? 0 : -1) + '" ' +
        'aria-pressed="' + (routine.slot(d, H0 + k).state === SlotState.BUSY) + '" ' +
        'aria-label="' + DAY_NAME[d] + ' ' + hourLabel(H0 + k) + ', busy" style="top:' + px(k * rh) + ';height:' + px(rh) + '"></div>').join("");
    return '<div class="cal-col' + restCls + '" data-day="' + d + '" aria-label="' + DAY_NAME[d] + (busyRuns(d).length ? ", busy " +
        busyRuns(d).map(([a, b]) => hourRange(a, b)).join(", ") : ", free") + '">' + head +
      '<div class="cal-body" style="height:' + px(rows * rh) + '">' + rules + bandEl +
        '<div class="day-busy" data-busy="' + d + '">' + busyHTML(d, rh, [H0, H1]) + '</div>' +
        ghost + meals + cells + '</div></div>';
  }).join("");

  const presets = [["9-17", "Weekdays 9–5"], ["8-18", "Weekdays 8–6"], ["clear", "Clear all"]];
  return '<div class="wk-wide">' +
    '<div class="wide-head" data-reveal="0">' +
      '<button type="button" class="quiet-btn back" id="close-shape-back" data-key="close-shape-back">← Week plan</button>' +
      '<div class="wide-title">' +
        '<h1 class="display" id="plan-title" tabindex="-1">Shape your week</h1>' +
        '<p class="status-line' + (warn ? ' warn' : '') + '" aria-live="polite"><i></i><span>' +
          esc(warn ? note.text : okLine + (note ? " " + note.text : "")) + '</span></p>' +
        // Painting over a generated session takes it out of that week: said
        // here, where it happened, not only once the user leaves.
        (wk.status && /^Your week now has/.test(wk.status.text)
          ? '<p class="warn-line">' + esc(wk.status.text) + '</p>' : '') +
      '</div>' +
      '<button type="button" class="btn primary" id="close-shape" data-key="close-shape">Done</button>' +
    '</div>' +
    '<div class="toolbar" data-reveal="1">' +
      '<div class="kv-col"><span class="eyebrow small">Session length</span>' +
        '<span class="segmented" role="radiogroup" aria-label="Session length">' + SESSION_LENGTH_OPTIONS.map(m =>
          '<button type="button" role="radio" aria-checked="' + (routine.sessionMinutes === m) + '" data-len="' + m + '" data-key="len-' + m + '">' + m + '</button>').join("") +
        '</span></div>' +
      '<div class="kv-col"><span class="eyebrow small">Preferred time</span>' +
        '<span class="segmented" role="radiogroup" aria-label="Preferred time">' + ["morning", "midday", "evening", "any"].map(k =>
          '<button type="button" role="radio" aria-checked="' + (routine.preferredWindow === k) + '" data-window="' + k + '" data-key="win-' + k + '">' +
            (k === "any" ? "Any" : WINDOWS[k].label) + '</button>').join("") +
        '</span></div>' +
      '<div class="kv-col"><span class="eyebrow small">Fill busy hours</span>' +
        '<span class="presets">' + presets.map(([k, label]) =>
          '<button type="button" class="preset" data-preset="' + k + '" data-key="preset-' + k + '">' + label + '</button>').join("") + '</span></div>' +
      '<span class="toolbar-gap"></span>' +
      '<div class="kv-col"><span class="eyebrow small">Meals</span>' + (n.isValid()
        ? '<span class="switch-row"><button type="button" role="switch" class="switch" id="meals-switch" data-key="meals-switch" ' +
            'aria-checked="' + n.showMeals + '" aria-label="Show meals in the week"><i></i></button>' +
            '<span>' + (n.showMeals ? n.mealsPerDay + " a day, " + hourRange(n.hours[0], n.hours[n.hours.length - 1]) : "Hidden") + '</span></span>'
        : '<button type="button" class="text-link switch-row" data-goto="nutrition">Set up nutrition</button>') +
      '</div>' +
    '</div>' +
    '<div class="cal shape-cal" data-reveal="2">' +
      '<div class="cal-hours" style="height:' + px(WEEK_HEAD + 2 + rows * rh) + '">' + hours + '</div>' + days +
    '</div>' +
    '<div class="legend" data-reveal="2">' +
      '<span class="legend-keys">' +
        '<span><i class="k-session"></i>Session</span><span><i class="k-busy"></i>Busy</span>' +
        (band ? '<span><i class="k-band"></i>Preferred time</span>' : '') +
        (mealsOn ? '<span><i class="k-meal"></i>Meal</span>' : '') +
        '<span><i class="k-off"></i>Day off</span>' +
      '</span>' +
      '<span class="faint">Drag across a day to mark busy hours · drag again to clear · click a day\'s name to take it off</span>' +
    '</div>' +
  '</div>';
}

/** A day's busy hours as blocks, labelled where there is room. */
/** The paint cell the keyboard enters the grid at: the last one it was on, else the first free day's first hour. */
function paintCellKey() {
  const day = wk.paintDay && !routine.offDays.has(wk.paintDay) ? wk.paintDay
    : DayOfWeek.values.find(d => !routine.offDays.has(d));
  return "paint-" + day + "-" + (wk.paintHour ?? WEEK_HOURS[0]);
}

function busyHTML(day, rh, [H0, H1]) {
  return busyRuns(day, [H0, H1]).map(([a, b]) =>
    '<div class="busy" style="top:' + px((a - H0) * rh + 3) + ';height:' + px((b - a) * rh - 6) + '">' +
      (b - a >= 2 ? '<span class="busy-label">Busy</span>' : '<span class="visually-hidden">Busy</span>') +
      ((b - a) * rh >= 30 ? '<span class="busy-time">' + hourRange(a, b) + '</span>' : '') + '</div>').join("");
}

/** Repaints only the busy blocks, while a drag is under way: cheap, on every move. */
function paintBusy() {
  const [H0, H1] = WEEK_HOURS, rh = wk.view === "config" ? wk.rh : rowHeight(H1 - H0, 470, 18, 30);
  for (const el of weekEl.querySelectorAll("[data-busy]")) el.innerHTML = busyHTML(el.dataset.busy, rh, WEEK_HOURS);
}

/** Replaces every busy hour with a preset: weekdays from `a` to `b`, or none. */
function fillBusy(preset) {
  for (const s of routine.allSlots()) if (s.state === SlotState.BUSY) routine.clearSlot(s.day, s.hour);
  if (preset !== "clear") {
    const [a, b] = preset.split("-").map(Number);
    for (const d of ["MON", "TUE", "WED", "THU", "FRI"])
      for (let h = a; h < b; h++) routine.markBusy(d, h);
  }
}

/* --------------------------------- your week ------------------------------- */

/** The hours the generated week needs on screen: its sessions and meals, an hour either side, at least seven. */
function genHours() {
  let lo = 24, hi = 0;
  for (const s of routine.sessions) { lo = Math.min(lo, s.startHour); hi = Math.max(hi, s.endHour()); }
  for (const m of routine.plannedMeals) { lo = Math.min(lo, m.hour); hi = Math.max(hi, m.hour + 1); }
  if (lo > hi) { lo = 16; hi = 21; }
  lo = Math.max(FIRST_HOUR, lo - 1); hi = Math.min(LAST_HOUR + 1, hi + 1);
  while (hi - lo < 7) { if (lo > FIRST_HOUR) lo--; if (hi - lo < 7 && hi < LAST_HOUR + 1) hi++; if (lo === FIRST_HOUR && hi === LAST_HOUR + 1) break; }
  return [lo, hi];
}

function genHTML() {
  const sessions = [...routine.sessions].sort(byWeekOrder);
  const minutes = sessions.reduce((t, s) => t + sessionMinutes(s), 0);
  const sets = sessions.reduce((t, s) => t + s.workout.sets, 0);
  const n = routine.nutrition;
  const v = routine.weeklyVolume();
  const counts = [...new Set(v.rows.filter(r => r.times > 0).map(r => r.times))].sort();
  const freq = !counts.length ? "" : "each muscle " + (counts.length === 1 ? counts[0] : counts[0] + "–" + counts[counts.length - 1]) + "× a week";
  const off = DayOfWeek.values.filter(d => routine.isDayUnavailable(d)).length;
  const hrs = Math.round(minutes / 30) / 2;
  const facts = [
    (7 - sessions.length - off) + " rest" + (off ? " · " + off + " off" : ""),
    freq,
    n.isValid() ? "≈ " + n.kcal.toLocaleString("en-US") + " kcal · " + n.protein + " g protein a day" : ""
  ].filter(Boolean);
  const gaps = weekGaps();
  const stale = weekIsStale(), outdated = !stale && mealsOutdated();
  const status = wk.status;
  const detail = routine.sessions.find(s => s.id === wk.sel);
  const focus = routine.sessions.find(s => s.id === (wk.hover || wk.sel));

  const head = '<div class="gen-head" data-reveal="0">' +
      '<p class="eyebrow"><span class="n">' + STAGE_NUMERALS.plan + '</span> / Week plan</p>' +
      '<div class="gen-title">' +
        '<div class="gen-title-text">' +
          '<h1 class="display" id="plan-title" tabindex="-1">Your week</h1>' +
          '<p class="gen-summary' + (gaps.length || stale || outdated || (status && status.kind) ? ' warn' : '') +
            '"><i></i><span>' + sessions.length + (sessions.length === 1 ? " session" : " sessions") +
            ' · ≈ ' + hrs + ' h · ' + sets + ' hard sets</span><span class="pill-tag">Estimate</span></p>' +
          '<p class="gen-facts">' + facts.map(esc).join('<span aria-hidden="true">·</span>') + '</p>' +
        '</div>' +
        '<div class="gen-actions">' +
          (stale || outdated ? '<button type="button" class="btn primary" id="regen" data-key="regen">Generate again</button>' : '') +
          '<button type="button" class="btn ghost" id="adjust" data-key="adjust">Adjust plan</button>' +
        '</div>' +
      '</div>' +
      ((status || gaps.length || stale || outdated) ? '<div class="gen-notes">' +
        (status ? '<p class="' + (status.kind || "soft") + '">' + esc(status.text) + '</p>' : '') +
        (stale && !(status && /changed since/.test(status.text)) ? '<p class="warn">Your targets, training or nutrition changed since this week was generated. Generate again to plan for them.</p>' : '') +
        (outdated && !(status && /generate again/i.test(status.text)) ? '<p class="warn">The meals on the calendar no longer match your daily targets. Generate again to update them.</p>' : '') +
        gaps.map(g => '<p class="warn">' + esc(g) + '</p>').join("") +
      '</div>' : '') +
    '</div>';

  if (Stages.narrow) return '<div class="wk-gen">' + head + agendaHTML(sessions) + '</div>';

  const [H0, H1] = genHours(), rows = H1 - H0;
  const rh = rowHeight(rows, 330 + (gaps.length + (status ? 1 : 0)) * 22, 28, 60);
  const side = planEl.clientWidth >= 1180;
  const colW = (planEl.clientWidth - 96 - 44 - 36 - (side ? 388 : 0)) / 7, narrow = colW < 110;
  const hours = Array.from({ length: rows }, (_, k) => H0 + k).filter(h => h % 2 === 0)
    .map(h => '<span style="top:' + px(WEEK_HEAD + 2 + (h - H0) * rh) + '">' + hourLabel(h) + '</span>').join("");
  const days = DayOfWeek.values.map(d => {
    const off = routine.isDayUnavailable(d), x = sessions.find(s => s.day === d);
    const fams = x ? blockFamilies(x.block) : [];
    const on = x && wk.sel === x.id, hov = x && wk.hover === x.id;
    const worked = x ? x.block.muscles.filter(m => !x.block.riders.has(m)) : [];
    const restText = !x ? restDayText(d) : "";
    const headEl = '<div class="cal-head static"' + (restText ? ' title="' + esc(restText) + '"' : '') + '>' +
        // The frieze, carried into the week: the day's figure, lit where it trains.
        (x && !narrow ? '<canvas class="cal-plate" data-plate="' + d + '" data-ids="' + workedIds(x.block).join(",") + '" aria-hidden="true"></canvas>' : '') +
        '<span class="cal-day">' + DayOfWeek.label[d] + '</span>' +
        '<span class="cal-name">' + (off ? "Off" : x ? esc(blockName(x.block)) : "Rest") + '</span>' +
        '<span class="cal-meta">' + familyDots(fams) + '<span>' + (narrow ? "" : off ? "Day off" : x ? worked.length +
          (worked.length === 1 ? " muscle" : " muscles") : routine.recoveringOn(d).length ? "Recovering" : "Recovery") + '</span></span>' +
      '</div>';
    if (off) return '<div class="cal-col off">' + headEl + '<div class="cal-body" style="height:' + px(rows * rh) + '"></div></div>';
    const rules = Array.from({ length: rows - 1 }, (_, k) => H0 + k + 1).filter(h => h % 2 === 0)
      .map(h => '<i class="rule" style="top:' + px((h - H0) * rh) + '"></i>').join("");
    const busy = busyRuns(d, [H0, H1]).map(([a, b]) =>
      '<div class="busy" style="top:' + px((a - H0) * rh + 3) + ';height:' + px((b - a) * rh - 6) + '">' +
        (b - a >= 2 ? '<span class="busy-label">Busy</span>' : '') +
        (!narrow && (b - a) * rh >= 34 ? '<span class="busy-time">' + hourRange(a, b) + '</span>' : '') + '</div>').join("");
    const meals = routine.plannedMeals.filter(m => m.day === d && m.hour >= H0 && m.hour < H1).map(m =>
      '<span class="meal-pill' + (/snack/i.test(m.name) ? " snack" : "") + '" style="top:' + px((m.hour - H0) * rh + rh / 2) + '" ' +
        'title="' + esc(m.name) + ' · ' + hourLabel(m.hour) + ' · ≈ ' + m.kcal + ' kcal · ' + m.protein + ' g protein"><i></i>' +
        (colW >= 128 ? (/snack/i.test(m.name) ? "Snack" : esc(m.name)) : "") + '</span>').join("");
    const sess = x ? (() => {
      const h = Math.max(30, (x.endHour() - x.startHour) * rh - 6);
      return '<button type="button" class="session' + (h < 44 ? ' tiny' : h < 58 ? ' short' : '') + (on ? ' on' : '') + (hov ? ' pointed' : '') + '" data-sess="' + x.id + '" ' +
          'data-key="sess-' + x.id + '" aria-expanded="' + !!on + '" style="top:' + px((x.startHour - H0) * rh + 3) + ';height:' + px(h) + '" ' +
          'aria-label="' + esc(DAY_NAME[d] + ", " + blockName(x.block) + ", " + hourRange(x.startHour, x.endHour()) + ". Open for the exercises.") + '">' +
        '<span class="session-name">' + esc(blockName(x.block)) + '</span>' +
        '<span class="session-time">' + (narrow ? hourLabel(x.startHour) : hourRange(x.startHour, x.endHour()) + ' · ' + sessionMinutes(x) + ' min') + '</span>' +
        (h >= 84 ? '<span class="session-mus">' + esc(worked.map(m => m.name).join(", ")) + '</span>' : '') +
      '</button>';
    })() : "";
    return '<div class="cal-col' + (x ? '' : ' rest') + (on ? ' on' : hov ? ' pointed' : '') + '">' + headEl +
      '<div class="cal-body" style="height:' + px(rows * rh) + '">' + rules + busy + meals + sess + '</div></div>';
  }).join("");

  // With the SVG figure (no WebGL) nothing on screen lights up: no hint to point.
  const flat = $("anatomy-stage").classList.contains("flat");
  const idle = flat ? "" : '<div class="side-idle" data-reveal="2">' +
      '<span class="eyebrow small">' + (focus ? esc(blockName(focus.block)) + " · " + DayOfWeek.label[focus.day] : "On the sculpture") + '</span>' +
      '<span>' + (focus ? "Trains " + esc(nameList(focus.block.muscles.filter(m => !focus.block.riders.has(m)).map(m => m.name))) +
        ". Click it to see the exercises." : "Point at a session to light up the muscles it trains. Click one for its exercises.") + '</span>' +
    '</div>';
  const aside = detail ? '<aside class="side-detail" data-scroll aria-label="Session details" data-reveal="2">' + sessionDetailHTML(detail) + '</aside>' : "";

  return '<div class="wk-gen">' + head +
    '<div class="gen-body' + (side ? ' with-side' : '') + '">' +
      '<div class="gen-cal" data-reveal="1">' +
        '<div class="cal">' +
          '<div class="cal-hours" style="height:' + px(WEEK_HEAD + 2 + rows * rh) + '">' + hours + '</div>' + days +
        '</div>' +
        '<div class="legend">' +
          '<span class="legend-keys"><span><i class="k-session"></i>Session</span><span><i class="k-busy"></i>Busy</span>' +
            (routine.plannedMeals.length ? '<span><i class="k-meal"></i>Meal</span>' : '') +
            '<span><i class="k-off"></i>Day off</span></span>' +
          '<span class="faint">Point at a session to see what it trains · click it for the exercises</span>' +
        '</div>' +
      '</div>' +
      '<div class="gen-side' + (detail ? ' open' : '') + '">' + (detail ? aside : side ? idle : '') + '</div>' +
    '</div>' +
  '</div>';
}

/** The phone's week: one line a day, a session opening in place with everything it has. */
function agendaHTML(sessions) {
  return '<ol class="agenda" data-reveal="1">' + DayOfWeek.values.map(d => {
    const x = sessions.find(s => s.day === d), open = x && wk.sel === x.id;
    const meals = routine.plannedMeals.filter(m => m.day === d).sort((a, b) => a.hour - b.hour);
    return '<li>' +
      '<div class="agenda-row">' +
        '<span class="agenda-day">' + DayOfWeek.label[d] + '</span>' +
        (x ? '<button type="button" class="agenda-sess" data-sess="' + x.id + '" data-key="sess-' + x.id + '" aria-expanded="' + !!open + '">' +
              '<span><span class="agenda-name">' + esc(blockName(x.block)) + '</span>' +
              '<span class="agenda-mus">' + esc(x.block.muscles.filter(m => !x.block.riders.has(m)).map(m => m.name).join(", ")) + '</span></span>' +
              '<span class="agenda-time">' + hourRange(x.startHour, x.endHour()) + '</span></button>'
           : '<span class="agenda-rest">' + esc(restDayText(d)) +
              (meals.length ? '<span class="faint"> · meals ' + meals.map(m => hourLabel(m.hour)).join(", ") + '</span>' : '') + '</span>') +
      '</div>' +
      (open ? sessionDetailHTML(x, true) : '') +
    '</li>';
  }).join("") + '</ol>';
}

/* --------------------------------- the frieze ------------------------------- */

/* The muscles read from behind: a day that mostly trains them turns its figure round. */
const PLATE_BEHIND = new Set(["traps", "upper-back", "lats", "triceps", "hamstrings", "glutes", "calves", "lower-back"]);
/* How far round each day's figure stands, Monday to Sunday: one figure turning through the week. */
const PLATE_TURN = [-33, -22, -11, 0, 11, 22, 33];

/**
 * Draws the week's plates (configHTML): the sculpture itself, once per day,
 * lit where that day's session trains. The stage's own figure steps out
 * while they stand (the view's dim). Where the sculpture cannot draw them
 * (no WebGL, or not ready yet) the days stay as names and dots.
 */
function paintPlates(tries = 0) {
  const canvases = [...weekEl.querySelectorAll("canvas[data-plate]")];
  if (!canvases.length || typeof figure !== "object") return;
  // The plates take their size from the frieze's layout, so that comes first.
  const can = !!figure.moves && (tries < 20 || wk.plates);
  if (can !== planEl.hasAttribute("data-plates")) planEl.toggleAttribute("data-plates", can);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const list = can ? canvases.map(canvas => {
    const day = canvas.dataset.plate, ids = canvas.dataset.ids ? canvas.dataset.ids.split(",") : [];
    const behind = ids.filter(id => PLATE_BEHIND.has(id)).length > ids.length / 2;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    return { canvas, ids, az: PLATE_TURN[DayOfWeek.indexOf(day)] + (behind ? 180 : 0) };
  }) : [];
  const drawn = can && figure.plates(list);
  if (drawn !== wk.plates) { wk.plates = drawn; Stages.refresh(); }
  // The sculpture lays itself out a frame after the page: ask again, briefly.
  if (can && !drawn) requestAnimationFrame(() => paintPlates(tries + 1));
}
/* The plates are drawn in the theme's stone and hues. */
new MutationObserver(() => requestAnimationFrame(() => { if (Stages.current === "plan") paintPlates(); }))
  .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

/* --------------------------------- drawing --------------------------------- */

function renderWeek() {
  // Where each day's session stood on its staff, so it can travel from there.
  const stood = new Map([...weekEl.querySelectorAll("[data-ghost]")].map(el => [el.dataset.ghost, parseFloat(el.style.top)]));
  const active = document.activeElement;
  const focusKey = active && weekEl.contains(active) ? active.dataset.key : null;
  const top = planEl.scrollTop;
  const sideEl = weekEl.querySelector(".side-detail"), sideTop = sideEl ? sideEl.scrollTop : 0;
  // Once the last session is gone (removed, painted over, its day taken
  // off) there is no week to show: back to the setup, camera and footer too.
  if (wk.view === "gen" && !routine.sessions.length) wk.view = "config";
  planEl.dataset.view = wk.view;
  weekEl.innerHTML = wk.view === "shape" ? shapeHTML() : wk.view === "gen" ? genHTML() : configHTML();
  planEl.scrollTop = top;
  const side = weekEl.querySelector(".side-detail");
  if (side) side.scrollTop = sideTop;
  if (focusKey) focusAgain(weekEl.querySelector('[data-key="' + focusKey + '"]'));
  Stages.refresh();
  paintPlates();
  if (!Stages.still) for (const el of weekEl.querySelectorAll("[data-ghost]")) {
    const was = stood.get(el.dataset.ghost), now = parseFloat(el.style.top);
    if (was === undefined) el.animate([{ opacity: 0, transform: "scaleY(.2)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: "cubic-bezier(.2,.7,.2,1)" });
    else if (Math.abs(was - now) > .5) el.animate([{ transform: "translateY(" + (was - now) + "px)" }, { transform: "none" }], { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" });
  }
}

/** Closes the open session, back to the week. */
function closeSession() {
  const was = wk.sel;
  wk.sel = null;
  render();
  const again = was && weekEl.querySelector('[data-sess="' + was + '"]');
  (again || $("plan-title")).focus({ preventScroll: true });
}

/** A change that rearranges the preview tiles: they settle again, one after another. */
function shuffled(fn, key) {
  fn();
  wk.changed = key;
  saveRoutine(routine);
  renderWeek();
  if (key === "shuffle") setTimeout(() => { wk.changed = wk.changed === "shuffle" ? null : wk.changed; }, 600);
}

weekEl.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || b.dataset.act) return;      // a session's own controls: workout-view.js
  const d = b.dataset;
  const [lo, hi] = TRAINING_DAYS_RANGE;
  if (d.daysStep) {
    shuffled(() => { routine.sessionsPerWeek = Math.max(lo, Math.min(hi, routine.sessionsPerWeek + Number(d.daysStep))); }, "days");
    announce(routine.sessionsPerWeek + (routine.sessionsPerWeek === 1 ? " training day" : " training days") + " a week");
  }
  else if (d.split) shuffled(() => { routine.split = d.split; }, "shuffle");
  else if (d.experience) shuffled(() => { routine.experience = d.experience; }, "shuffle");
  else if (b.id === "open-shape" || d.shape) Stages.relayout(() => { wk.view = "shape"; wk.tile = null; }, 900);
  else if (b.id === "close-shape" || b.id === "close-shape-back")
    Stages.relayout(() => { wk.view = "config"; wk.changed = null; }, 900);
  else if (d.len) { routine.sessionMinutes = Number(d.len); afterWeekChange(); }
  else if (d.window) { routine.preferredWindow = d.window; afterWeekChange(); }
  else if (d.preset) { fillBusy(d.preset); afterWeekChange(); }
  else if (b.id === "meals-switch") { routine.nutrition.showMeals = !routine.nutrition.showMeals; afterWeekChange(); }
  else if (d.dayoff) {
    routine.setDayUnavailable(d.dayoff, !routine.isDayUnavailable(d.dayoff));
    afterWeekChange();
  }
  else if (b.id === "generate" || b.id === "regen") generate();
  else if (b.id === "reset-week") {
    routine.reset();
    generatedFor = null; placedCount = 0;
    wk.status = { text: "Cleared: no busy hours, no days off, and the training settings back to their defaults.", kind: "" };
    wk.changed = null;
    render();
  }
  else if (b.id === "adjust") Stages.relayout(() => { wk.view = "config"; wk.sel = null; wk.hover = null; wk.changed = null; }, 900);
  else if (b.id === "to-week") Stages.relayout(() => { wk.view = "gen"; }, 1000);
  else if (d.sess) {
    const id = Number(d.sess);
    wk.sel = wk.sel === id ? null : id;
    renderWeek();
    const panel = weekEl.querySelector(".side-detail");
    if (panel && wk.sel !== null && !Stages.narrow) {
      const first = panel.querySelector("select");
      if (e.detail === 0 && first) first.focus({ preventScroll: true });    // from the keyboard: into the panel
    }
  }
});

/** After a change to the hours, the length or the days: redraw, save, and say what a generated week lost. */
function afterWeekChange() {
  render();
  weekEdited() || warnIfStale();
}

/** Generates the week; a week with sessions takes the screen, one without stays here with the reason. */
function generate() {
  const r = generateWeek();
  wk.status = { text: r.text, kind: r.kind };
  wk.sel = null; wk.hover = null; wk.changed = null;
  if (r.placed) Stages.relayout(() => { wk.view = "gen"; }, 1000);
  else { wk.view = "config"; renderWeek(); }
}

/* Pointing: a day tile or a session lights its muscles on the sculpture. */
weekEl.addEventListener("pointerover", e => {
  const tile = e.target.closest("[data-tile]"), sess = e.target.closest("[data-sess]");
  if (tile && wk.tile !== tile.dataset.tile) { wk.tile = tile.dataset.tile; paintPointed(); }
  if (sess && !Stages.narrow && wk.hover !== Number(sess.dataset.sess)) { wk.hover = Number(sess.dataset.sess); paintPointed(); }
});
weekEl.addEventListener("pointerout", e => {
  const to = e.relatedTarget;
  if (e.target.closest("[data-tile]") && !(to && to.closest && to.closest("[data-tile]"))) { wk.tile = null; paintPointed(); }
  if (e.target.closest("[data-sess]") && !(to && to.closest && to.closest("[data-sess]"))) { wk.hover = null; paintPointed(); }
});

/** What pointing changes, without redrawing the screen under the pointer. */
function paintPointed() {
  for (const t of weekEl.querySelectorAll("[data-tile]")) t.classList.toggle("pointed", t.dataset.tile === wk.tile);
  for (const s of weekEl.querySelectorAll("[data-sess]")) {
    s.classList.toggle("pointed", Number(s.dataset.sess) === wk.hover);
    const col = s.closest(".cal-col");
    if (col) col.classList.toggle("pointed", Number(s.dataset.sess) === wk.hover && !col.classList.contains("on"));
  }
  const idle = weekEl.querySelector(".side-idle");
  if (idle) {
    const focus = routine.sessions.find(s => s.id === wk.hover);
    idle.children[0].textContent = focus ? blockName(focus.block) + " · " + DayOfWeek.label[focus.day] : "On the sculpture";
    idle.children[1].textContent = focus ? "Trains " + nameList(focus.block.muscles.filter(m => !focus.block.riders.has(m)).map(m => m.name)) +
      ". Click it to see the exercises." : "Point at a session to light up the muscles it trains. Click one for its exercises.";
  }
  Stages.refresh();
}

/* The calendars fit the screen's height; redraw them when it changes. */
let weekResize = 0;
addEventListener("resize", () => {
  clearTimeout(weekResize);
  weekResize = setTimeout(() => {
    if (Stages.current !== "plan") return;
    renderWeek();
  }, 120);
});

/* --------------------------------- the stage -------------------------------- */

/** The muscles a block really works (riders get no work of their own). */
const workedIds = block => block.muscles.filter(m => !block.riders.has(m)).map(m => m.id);

Stages.register("plan", {
  arrive() {
    // A week already generated opens on it; otherwise, on setting one up.
    wk.view = routine.sessions.length ? "gen" : "config";
    wk.sel = null; wk.hover = null; wk.tile = null; wk.changed = null;
    if (wk.status && wk.status.kind !== "err" && !routine.sessions.length) wk.status = null;
  },
  enter: renderWeek,
  shot: () => wk.view === "shape" ? "plan-availability" : wk.view === "gen" ? "plan-generated" : "plan",
  dim() {
    if (wk.view === "shape") return 0;
    // Setting up, the frieze's seven figures are the body; the stage's own steps out.
    if (wk.view !== "gen") return wk.plates && !Stages.narrow ? 0 : 1;
    if (Stages.narrow) return wk.sel !== null ? 1 : 0.5;
    return wk.sel !== null ? 0.35 : 1;
  },
  highlight() {
    if (wk.view === "gen") {
      const s = routine.sessions.find(x => x.id === (wk.hover !== null ? wk.hover : wk.sel));
      return s ? workedIds(s.block) : null;
    }
    if (wk.view === "config" && wk.tile) {
      const p = weekPreview().byDay.get(wk.tile);
      return p ? workedIds(p.block) : null;
    }
    return null;
  },
  footer: () => wk.view === "config" || Stages.narrow ? { back: "← Nutrition" } : {},
  wheel: () => wk.view !== "shape",
  focus: () => $("plan-title")
});
