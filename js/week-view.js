/* ===========================================================================
   Week plan stage — the day as the sun's path.

   From the user's Claude Design file "Week Plan - Lumen v3" (2026-11-15).
   The day is a ring of hours behind the figure, six in the morning at the
   left to midnight at the right, and the week is told one day at a time,
   then all at once:

     0 … 6   a day. Drag along its ring over the hours that aren't yours
             (and again to free them); the session the planner would place
             moves to the hours left. Once the week is generated the ring
             holds the day's session: drag it to change its hour, swap its
             exercises, or move it to another day.
     7       the week: seven rings, Monday at the centre, and the week's
             terms as one sentence whose words open their choosers; then
             Generate. Generated, it takes the whole screen: seven arches on
             one horizon, a day each, every exercise written out.

   The hour pointed at on the ring is the hour of the light: the page's sky
   takes that hour's colour, and the sculpture is lit from where the sun
   stands on the ring. The stage's words are set in a 1440 × 900 plate
   scaled to the screen, as Nutrition's are; the ring is drawn behind the
   figure (#anatomy-stage), and the sky behind both.

   Every number is the routine's: the plan the planner would place
   (routine.weekPlan, the same plan Generate places), the generated
   sessions and their workouts, the meals' hours, the daily targets.
   Nothing is worked out here.
   ========================================================================= */

const weekEl = $("week-panel");
const planEl = $("stage-plan");

/* The plate's geometry. The ring: its centre and radius. The figure: its
   axis on the ring's centre, where its soles stand, how tall, how far
   round. The generated week: columns of COL from WX, the arches' horizon
   WY and radius WR. The figure faces the page, as on Targets, so the day's
   name low behind it runs between its legs. */
const LM = { CX: 980, CY: 640, R: 410, SOLE: 788, TALL: 532, AZ: 0, WX: 48, WY: 348, WR: 80, COL: 192 };
/* The camera a change of stage travels to; standAt moves its end onto the ring's centre as it goes. */
SCULPTURE_SHOTS["plan-ring"] = { az: LM.AZ, el: 0, ty: 79, d: 756, sx: .68, sy: .58, fov: 20 };

/* The muscles read from behind: a day that mostly trains them turns the figure round, as Targets turns it to the side a muscle is on. */
const LM_BEHIND = new Set(["traps", "upper-back", "lats", "triceps", "hamstrings", "glutes", "calves", "lower-back"]);

const LM_NUM = ["None", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen"];
const LM_HOUR = ["midnight", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven",
  "noon", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "midnight"];
const LM_LEN = { 45: "forty-five minutes", 60: "an hour", 75: "seventy-five minutes", 90: "an hour and a half" };
const LM_WIN = { morning: ["Morning", "in the morning"], midday: ["Midday", "around midday"],
                 evening: ["Evening", "in the evening"], any: ["Any time", "whenever you’re free"] };
const LM_SPLIT = { "auto": "split automatically", "upper-lower": "split upper and lower",
                   "push-pull-legs": "split push, pull, legs", "full-body": "each one full body" };
const LM_EXP = { beginner: ["Under 6 months", "under six months"], intermediate: ["6 mo – 2 yrs", "six months to two years"],
                 advanced: ["2+ years", "more than two years"] };
/* The week's terms, each a word of the sentence, and the routine's value it sets. */
const LM_TERMS = { days: "sessionsPerWeek", len: "sessionMinutes", win: "preferredWindow", split: "split", exp: "experience" };

/*
 * The sky by hour, at the hours whose light people know: dawn, sunrise,
 * morning, noon, afternoon, the golden hour, sunset, dusk, night and
 * midnight. Each is the ground of the page, the glow round the sun, the
 * cooler light across from it, and the sun itself, which becomes a pale
 * moon after dusk. Morning is clear and cool-gold, evening amber to coral,
 * so the two halves of the day no longer read alike; noon is the flattest
 * and whitest. The light theme's ground stays light enough at night for
 * the faint ink to keep 4.5:1.
 */
const LM_SKY = {
  light: {
    base: [[6, "#e6e5ee"], [7.5, "#ece8e6"], [9, "#eff0ec"], [12, "#f6f4ef"], [15, "#f6f1e5"], [17.5, "#f4e8d6"], [19, "#f2e0d7"], [20.5, "#e9e4ee"], [22, "#e4e6ef"], [24, "#e4e6f0"]],
    glow: [[6, "#f0c9c0"], [7.5, "#f5d2b0"], [9, "#f4e7c0"], [12, "#fbf6e6"], [15, "#f7e3b3"], [17.5, "#f3c486"], [19, "#eca48c"], [20.5, "#d9b5cc"], [22, "#cbc9e2"], [24, "#c6c9e2"]],
    far:  [[6, "#d4dcee"], [7.5, "#d8e2f0"], [9, "#d5e4f0"], [12, "#e6edf0"], [15, "#e6e5dd"], [17.5, "#e3d8d0"], [19, "#dcd2e3"], [20.5, "#d2d8ec"], [22, "#cfd7ea"], [24, "#ccd5ea"]],
    sun:  [[6, "#e3907c"], [7.5, "#e9a25c"], [9, "#e2b84e"], [12, "#e2bd52"], [15, "#dca545"], [17.5, "#dc8a35"], [19, "#d66a52"], [20.5, "#a985b5"], [22, "#93a3d0"], [24, "#a4b1d8"]]
  },
  dark: {
    base: [[6, "#13141b"], [7.5, "#16141a"], [9, "#15161a"], [12, "#171612"], [15, "#18150f"], [17.5, "#1a140e"], [19, "#1a1012"], [20.5, "#141019"], [22, "#0f1018"], [24, "#0b0d16"]],
    glow: [[6, "#3b2629"], [7.5, "#3e2c1f"], [9, "#35321e"], [12, "#33301f"], [15, "#3b301a"], [17.5, "#452c14"], [19, "#48231e"], [20.5, "#33213a"], [22, "#232540"], [24, "#1d2038"]],
    far:  [[6, "#141a2b"], [7.5, "#151c2a"], [9, "#122028"], [12, "#1a1b19"], [15, "#1b1914"], [17.5, "#1d1713"], [19, "#1c1426"], [20.5, "#161632"], [22, "#0d1330"], [24, "#0a1028"]],
    sun:  [[6, "#e0907c"], [7.5, "#e8a25e"], [9, "#e6c062"], [12, "#f0d27e"], [15, "#eab456"], [17.5, "#e8913c"], [19, "#e0705a"], [20.5, "#b58ad0"], [22, "#a9b6e6"], [24, "#b8c4ea"]]
  }
};
/*
 * The figure in the hour's light (setTint): how much of the glow's hue the
 * key takes and of the far light's the shade, how strong the key is as the
 * day goes, and how far its turned edges go toward the page's ground.
 * Enough to stand the marble in the hour, never to dye it.
 */
const LM_TINT = { light: { key: .6, fill: .65, haze: .1 }, dark: { key: .45, fill: .45, haze: .1 } };
const LM_KEY = [[6, .86], [9, .97], [13, 1], [17, .97], [20, .9], [24, .8]];

/* What is on screen: the step (a day, or the week), what is pointed at or open, the drag. */
const lm = {
  step: 0, editing: false, notes: false, hoverDay: null, hoverMuscle: null, keyHot: null, chooser: null, preview: null,
  drag: null, moveHover: null, wkIn: false, status: null,
  k: 1, ox: 0, oy: 0, vw: 0, vh: 0, raf: 0, lt: 0, leftAt: 0, t0: 0,
  scrubH: null, hourF: null, sky: null, css: "", bg: "", beadR: 4.5, figOp: 0, aimX: null,
  acc: 0, locked: false, lastWheel: 0, edge: 0,
  F: null, byDay: {}, meals: {}, word: ""
};

const lmPad = h => String(h).padStart(2, "0");
/* The hour's angle on the ring, in degrees: six at the left, noon high on the left, midnight at the right. */
const lmAng = h => 180 + (h - FIRST_HOUR) * 10;
const lmDark = () => document.documentElement.dataset.theme === "dark";
const lmFam = x => (x && x.fams[0]) || "push";

/* --------------------------------- reading -------------------------------- */

/** The week the planner would place now (routine.weekPlan): its fit, and each day's placement. */
function weekPreview() {
  const plan = routine.weekPlan(routine.experience || DEFAULT_EXPERIENCE);
  return { plan, fit: plan.fit, byDay: new Map(plan.placements.map(p => [p.day, p])) };
}

const isBusy = (day, h) => { const s = routine.slot(day, h); return !!s && s.state === SlotState.BUSY; };

/** A day's busy hours as runs [from, to). */
function busyRuns(day) {
  const runs = []; let a = null;
  for (let h = FIRST_HOUR; h <= LAST_HOUR + 1; h++) {
    const b = h <= LAST_HOUR && isBusy(day, h);
    if (b && a === null) a = h;
    if (!b && a !== null) { runs.push([a, h]); a = null; }
  }
  return runs;
}

/** True while the week is being set up rather than shown generated. */
const lmDraft = () => !routine.sessions.length || lm.editing;

/** A day's session as the ring draws it: a placement the planner would make, or a generated session. */
function lmSession(block, start, end, session = null) {
  const muscles = block.muscles.filter(m => !block.riders.has(m));
  return { name: blockName(block), fams: blockFamilies(block), muscles, ids: muscles.map(m => m.id),
           start, end, hours: end - start, session };
}

/** Runs `fn` with the chooser's option pointed at set on the routine, so the week shows what it would come to. */
function lmPreviewed(fn) {
  if (!lm.preview) return fn();
  const prop = LM_TERMS[lm.preview.key], was = routine[prop];
  routine[prop] = lm.preview.value;
  try { return fn(); } finally { routine[prop] = was; }
}

/**
 * What the week holds, day by day: the planner's preview while it is set up
 * (with a chooser's option pointed at, if any), else the generated week; and
 * the meals at their hours, as Generate places them or has placed them.
 */
function lmWeek() {
  const draft = lmDraft(), byDay = {};
  let pv = null;
  if (draft) {
    pv = lmPreviewed(weekPreview);
    for (const p of pv.plan.placements) byDay[p.day] = lmSession(p.block, p.start, p.end);
  } else for (const s of routine.sessions) byDay[s.day] = lmSession(s.block, s.startHour, s.endHour(), s);
  const n = routine.nutrition, meals = {};
  if (n.isValid() && n.showMeals) {
    const list = draft
      ? routine.mealPlan(slot => { const x = byDay[slot.day]; return !x || slot.hour < x.start || slot.hour >= x.end; })
          .placed.map(p => ({ day: p.day, hour: p.hour, name: p.meal.name }))
      : routine.plannedMeals.map(m => ({ day: m.day, hour: m.hour, name: m.name }));
    for (const m of list) (meals[m.day] = meals[m.day] || []).push(m);
  }
  return { draft, pv, byDay, meals };
}

/** True when two days have the same busy hours and are both off or both not. */
function lmSameDay(a, b) {
  if (routine.offDays.has(a) !== routine.offDays.has(b)) return false;
  for (let h = FIRST_HOUR; h <= LAST_HOUR; h++) if (isBusy(a, h) !== isBusy(b, h)) return false;
  return true;
}

/**
 * What the weekly targets look like against the week, before Generate: a
 * prediction, so it says "looks" and "estimate", never "fits" as a fact.
 */
function fitNote(fit) {
  if (!fit || !routine.selection.size) return null;
  if (!routine.availableDays().length)
    return { warn: true, text: "There is no day left to train: every day is off or fully busy. Give some hours back." };
  const h = min => (Math.round(min / 6) / 10) + " h";
  const names = ids => nameList(ids.map(id => MUSCLE_BY_ID.get(id).name));
  const before = [];
  if (fit.days < fit.askedDays)
    before.push("Recovery and your free hours look like room for " + fit.days + " of your " + fit.askedDays + " training days (estimate).");
  if (fit.unplaced.length)
    before.push(SPLITS[routine.split].label + " would leave " + names(fit.unplaced) + " without a day this week.");
  const lead = before.length ? before.join(" ") + " " : "";
  if (!fit.fits || !fit.meetsMinimums)
    return { warn: true, text: lead + "Even the usual minimum for every muscle looks like more than your sessions can hold " +
      "(about " + h(fit.capacityMinutes) + " a week, estimate). Add a training day, make sessions longer, or drop a muscle." };
  if (fit.trimmed.length)
    return { warn: true, text: lead + "Your sessions (about " + h(fit.capacityMinutes) + " a week, estimate) look too short " +
      "for every target, so the plan lowers " + names(fit.trimmed) + ", never below their minimum." };
  return { warn: !!lead, text: lead + "Looks feasible (estimate): about " + h(fit.neededMinutes) +
    " of working sets in " + h(fit.capacityMinutes) + " of session time." };
}

/** A day in one line, for the rings of the week. */
function lmBrief(d, byDay) {
  if (routine.offDays.has(d)) return "Off. Left to you.";
  const x = byDay[d];
  if (x) {
    const at = x.start === 12 ? "at noon" : "at " + LM_HOUR[x.start] +
      (x.start < 12 ? " in the morning" : x.start < 17 ? " in the afternoon" : " in the evening");
    return x.name + " " + at + ", for " + (LM_LEN[routine.sessionMinutes] || routine.sessionMinutes + " minutes") + ".";
  }
  const pv = byDay[lmPrevDay(d)];
  return pv ? "Rest, while " + pv.muscles.map(m => m.name.toLowerCase()).join(", ") + " recover." : "Rest.";
}
const lmPrevDay = d => DayOfWeek.values[(DayOfWeek.indexOf(d) + 6) % 7];

/** Why `session` can't move to `day`, in a few words, or null if it can. */
function lmWhyNot(session, day) {
  if (day === session.day) return null;
  const b = routine.moveBlocker(session, day);
  if (!b) return null;
  return b.kind === "off" ? "Day off" : b.kind === "taken" ? "Has a session" : b.kind === "no-room" ? "No free time"
    : b.muscle.name + " still recovering";
}
/** Where `session` would start on `day`: its own hour if that fits, else the nearest that does (as moveSession). */
function lmStartOn(session, day) {
  const starts = routine.startsFor(session, day);
  return starts.length ? starts.reduce((a, b) => Math.abs(b - session.startHour) < Math.abs(a - session.startHour) ? b : a) : null;
}

/* -------------------------------- the ring --------------------------------- */

/** A rounded arc from hour a to b on radius r, `w` wide: its caps inside the hours, a small gap at each end. */
function lmCap(r, w, a, b, gap) {
  const c = 2 * Math.PI * r, raw = Math.max(0, b - a) * c / 36, len = Math.max(0, raw - w - gap), off = (w / 2 + gap / 2) / r * 180 / Math.PI;
  return { c, dash: len.toFixed(1) + " " + c.toFixed(1), rot: "rotate(" + (lmAng(a) + off).toFixed(2) + "deg)" };
}

/** The ring behind the figure: the dial, the seven days, the busy hours, the sessions, the meals, the words along it, the sun. */
function lmArcTemplate(W, step) {
  const { CX, CY, R } = LM, isWeek = step === 7, D = DayOfWeek.values, focus = isWeek ? null : D[step];
  const draft = W.draft, kOp = l => !lm.keyHot || lm.keyHot === l ? 1 : 0.2;
  const others = D.filter(d => d !== focus);
  const circle = (r, style) => '<circle cx="' + CX + '" cy="' + CY + '" style="r:' + r + 'px; fill:none; transform-origin:' + CX + 'px ' + CY + 'px; ' + style + '"></circle>';
  const ease = ".9s cubic-bezier(.16,1,.3,1)";

  const rings = D.map((d, i) => {
    const f = d === focus, off = routine.offDays.has(d);
    let r, w, op, sessOn;
    if (isWeek) { r = 278 + i * 22; w = 10; op = lm.hoverDay && lm.hoverDay !== d ? 0.38 : 1; sessOn = true; }
    else if (f) { r = R; w = 22; op = 1; sessOn = true; }
    else { r = R - 66 - others.indexOf(d) * 11; w = 3; op = 0.32; sessOn = false; }
    const c = 2 * Math.PI * r, gap = f ? 4 : 2.5;
    const runs = off ? [[FIRST_HOUR, 24]] : busyRuns(d), last = runs.length ? runs[runs.length - 1][1] : FIRST_HOUR;
    const dur = lm.drag ? ".32s" : ".75s";
    const busy = [0, 1, 2, 3, 4].map(k => {
      const run = runs[k];
      if (!run) return circle(r, "stroke:var(--lm-busy); stroke-width:0px; stroke-linecap:round; stroke-dasharray:0 " + c.toFixed(1) +
        "; transform:rotate(" + lmAng(last) + "deg); transition:r " + ease + ", stroke-width .55s cubic-bezier(.16,1,.3,1), stroke-dasharray " + dur + " cubic-bezier(.16,1,.3,1), transform " + dur + " cubic-bezier(.16,1,.3,1)");
      const q = lmCap(r, w, run[0], run[1], gap);
      return circle(r, "stroke:" + (off ? "var(--lm-off)" : "url(#lm-flow)") + "; stroke-width:" + w + "px; stroke-linecap:round; stroke-dasharray:" + q.dash +
        "; transform:" + q.rot + "; transition:r " + ease + ", stroke-width .55s cubic-bezier(.16,1,.3,1), stroke-dasharray " + dur + " cubic-bezier(.16,1,.3,1), transform " + dur + " cubic-bezier(.16,1,.3,1)");
    }).join("");
    const x = W.byDay[d], fams = x ? x.fams : [], n = fams.length, sw = w + (isWeek ? 3 : 4), sg = isWeek ? 1.2 : 2;
    const stw = n ? (sw - (n - 1) * sg) / n : 0, a0 = x ? x.start : 18, a1 = x ? x.end : 18;
    const sess = [0, 1, 2, 3].map(j => {
      const on = !!x && sessOn && j < n, rr = on ? r - sw / 2 + stw / 2 + j * (stw + sg) : r, q = lmCap(rr, on ? stw : 0, a0, a1, gap);
      return circle(rr.toFixed(2), "stroke:" + (on ? "var(--" + fams[j] + ")" : "transparent") + "; stroke-opacity:" + (on ? (draft ? 0.6 : 1) : 0) +
        "; stroke-width:" + (on ? stw.toFixed(2) : 0) + "px; stroke-linecap:round; stroke-dasharray:" + (on ? q.dash : "0 " + q.c.toFixed(1)) +
        "; transform:" + q.rot + "; transition:r " + ease + ", stroke-width " + ease + ", stroke-dasharray " + ease + ", transform " + ease +
        ", stroke-opacity 1s ease " + (draft ? 0 : i * 0.09 + j * 0.05).toFixed(2) + "s");
    }).join("");
    const gq = x && sessOn ? lmCap(r, sw, a0, a1, gap) : null;
    const glow = '<circle cx="' + CX + '" cy="' + CY + '" filter="url(#lm-soft)" style="r:' + r + 'px; fill:none; stroke:' + (x ? "var(--" + lmFam(x) + ")" : "transparent") +
      '; stroke-opacity:' + (gq ? (draft ? (f ? 0.18 : 0.12) : 0.38) : 0) + '; stroke-width:' + (gq ? sw + 12 : 0) + 'px; stroke-linecap:round; stroke-dasharray:' +
      (gq ? gq.dash : "0 " + c.toFixed(1)) + '; transform-origin:' + CX + 'px ' + CY + 'px; transform:' + (gq ? gq.rot : "rotate(" + lmAng(a0) + "deg)") +
      '; transition:r ' + ease + ', stroke-width ' + ease + ', stroke-dasharray ' + ease + ', transform ' + ease + ', stroke-opacity .8s ease"></circle>';
    return '<g style="opacity:' + (off && !f ? op * 0.7 : op) + '; transition:opacity .7s ease">' +
      circle(r, "stroke:var(--ink-faint); stroke-opacity:.42; stroke-width:" + (f ? 1.2 : isWeek ? 1 : 0.8) + "px; stroke-dasharray:" + (c / 2).toFixed(1) + " " + c.toFixed(1) +
        "; transform:rotate(180deg); transition:r " + ease + ", stroke-dasharray " + ease + ", stroke-width .6s ease") +
      '<g style="opacity:' + (f ? kOp("busy") : 1) + '; transition:opacity .35s ease">' + busy + '</g>' +
      '<g style="opacity:' + (f ? kOp("sess") : 1) + '; transition:opacity .35s ease">' + glow + sess + '</g>' +
    '</g>';
  }).join("");

  const ticks = Array.from({ length: 19 }, (_, k) => {
    const h = FIRST_HOUR + k, t = lmAng(h) * Math.PI / 180, a = R + 16, b = R + (h % 3 === 0 ? 28 : 22);
    return '<line x1="' + (CX + Math.cos(t) * a).toFixed(1) + '" y1="' + (CY + Math.sin(t) * a).toFixed(1) + '" x2="' + (CX + Math.cos(t) * b).toFixed(1) +
      '" y2="' + (CY + Math.sin(t) * b).toFixed(1) + '" style="stroke:var(--ink-faint); stroke-width:1; stroke-linecap:round; stroke-opacity:' + (h < 7 || h > 21 ? 0.45 : 0.9) + '"></line>';
  }).join("");

  const pct = h => ((h - FIRST_HOUR) / 18 * 100).toFixed(2) + "%";
  const fOff = !isWeek && routine.offDays.has(focus), fRuns = !isWeek && !fOff ? busyRuns(focus) : [];
  const fMeals = isWeek || fOff ? [] : (W.meals[focus] || []);
  const fx = !isWeek ? W.byDay[focus] : null;
  const win = routine.preferredWindow, W0 = WINDOWS[win], winR = isWeek ? 344 : R, winC = 2 * Math.PI * winR;
  const text = (path, off, style, body) => '<text style="' + style + '"><textPath href="#' + path + '" startOffset="' + off + '">' + body + '</textPath></text>';
  const mono = "font:500 10px/1 var(--mono); letter-spacing:.12em; fill:var(--ink-faint); text-anchor:middle";
  const curved =
    '<g style="opacity:' + (isWeek ? 0.55 : kOp("arc")) + '; transition:opacity .4s ease">' +
      [6, 9, 12, 15, 18, 21, 24].map(h => text("lm-p-hours", h === 6 ? "2.4%" : h === 24 ? "97.6%" : pct(h), mono, lmPad(h) + ":00")).join("") + '</g>' +
    '<g style="opacity:' + kOp("busy") + '; transition:opacity .35s ease">' +
      (fOff ? [[50, "DAY OFF"]] : fRuns.filter(([a, b]) => b - a >= 2).map(([a, b]) => [((a + b) / 2 - FIRST_HOUR) / 18 * 100, "BUSY " + lmPad(a) + "–" + lmPad(b)]))
        .map(([o, l]) => '<text dominant-baseline="central" style="font:500 9px/1 var(--mono); letter-spacing:.2em; fill:var(--ink-soft); text-anchor:middle"><textPath href="#lm-p-mid" startOffset="' + o.toFixed(2) + '%">' + l + '</textPath></text>').join("") + '</g>' +
    '<g style="opacity:' + kOp("meal") + '; transition:opacity .35s ease">' +
      fMeals.map(m => text("lm-p-meal", pct(m.hour + 0.5), "font:italic 400 15px/1 var(--serif); fill:var(--ink-soft); text-anchor:middle", esc(m.name.toLowerCase()))).join("") + '</g>' +
    '<g data-lm-sesslabel style="transition:opacity .3s ease"><g style="opacity:' + kOp("sess") + '; transition:opacity .35s ease">' +
      (fx ? '<text style="fill:var(--' + lmFam(fx) + '-trace); text-anchor:middle"><textPath href="#lm-p-sess" startOffset="' + pct(fx.start + fx.hours / 2) + '">' +
        '<tspan style="font:italic 400 25px/1 var(--serif)">' + esc(fx.name) + '</tspan><tspan dx="12" style="font:500 10px/1 var(--mono); letter-spacing:.14em">' +
        lmPad(fx.start) + "–" + lmPad(fx.end) + '</tspan></textPath></text>' : '') + '</g></g>' +
    '<g style="opacity:' + (isWeek ? 1 : 0) + '; transition:opacity .6s ease">' +
      D.map((d, i) => '<text x="' + (CX - (278 + i * 22)) + '" y="' + (CY + 17) + '" style="font:500 9px/1 var(--mono); letter-spacing:.08em; text-anchor:middle; fill:' +
        (lm.hoverDay === d ? "var(--ink)" : "var(--ink-faint)") + '">' + DayOfWeek.label[d].slice(0, 2).toUpperCase() + '</text>').join("") + '</g>' +
    '<text data-lm-needle style="opacity:0; transition:opacity .25s ease; text-anchor:middle; fill:var(--ink); pointer-events:none"><textPath href="#lm-p-sess" startOffset="50%" data-lm-needle-at>' +
      '<tspan data-lm-time style="font:500 11px/1 var(--mono); letter-spacing:.1em"></tspan><tspan data-lm-state dx="10" style="font:italic 400 19px/1 var(--serif); fill:var(--ink-soft)"></tspan></textPath></text>';

  const mealDots = fMeals.map(m => {
    const t = lmAng(m.hour + 0.5) * Math.PI / 180, cx = (CX + Math.cos(t) * (R - 23)).toFixed(1), cy = (CY + Math.sin(t) * (R - 23)).toFixed(1);
    return '<g><circle cx="' + cx + '" cy="' + cy + '" r="6.5" style="fill:none; stroke:var(--ink-faint); stroke-opacity:.5; stroke-width:1"></circle>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="2.8" style="fill:var(--ink-soft)"></circle></g>';
  }).join("");

  return '<svg width="1440" height="900" viewBox="0 0 1440 900" style="position:absolute; left:0; top:0; display:block; overflow:visible">' +
    '<defs>' +
      '<pattern id="lm-flow" data-lm-flow patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><rect width="7" height="7" style="fill:var(--lm-busy)"></rect><rect width="1.3" height="7" style="fill:var(--lm-busy-line)"></rect></pattern>' +
      '<radialGradient id="lm-glow"><stop offset="0" style="stop-color:var(--lm-sun); stop-opacity:.5"></stop><stop offset=".4" style="stop-color:var(--lm-sun); stop-opacity:.15"></stop><stop offset="1" style="stop-color:var(--lm-sun); stop-opacity:0"></stop></radialGradient>' +
      '<linearGradient id="lm-ray" gradientUnits="userSpaceOnUse" x1="398" y1="0" x2="214" y2="0"><stop offset="0" style="stop-color:var(--lm-sun); stop-opacity:.9"></stop><stop offset="1" style="stop-color:var(--lm-sun); stop-opacity:0"></stop></linearGradient>' +
      '<filter id="lm-soft" x="-7%" y="-7%" width="114%" height="114%"><feGaussianBlur stdDeviation="7"></feGaussianBlur></filter>' +
      '<path id="lm-p-hours" d="M 530 640 A 450 450 0 0 1 1430 640"></path>' +
      '<path id="lm-p-sess" d="M 506 640 A 474 474 0 0 1 1454 640"></path>' +
      '<path id="lm-p-mid" d="M 570 640 A 410 410 0 0 1 1390 640"></path>' +
      '<path id="lm-p-meal" d="M 612 640 A 368 368 0 0 1 1348 640"></path>' +
    '</defs>' +
    circle(winR, "stroke:var(--ink); stroke-opacity:" + (win === "any" ? 0 : (lmDark() ? 0.06 : 0.045) * (isWeek ? 1 : kOp("arc"))) + "; stroke-width:" + (isWeek ? 150 : 52) +
      "px; stroke-dasharray:" + ((W0.to - W0.from) * winC / 36).toFixed(1) + " " + winC.toFixed(1) + "; transform:rotate(" + lmAng(W0.from) + "deg); transition:r " + ease +
      ", stroke-width " + ease + ", stroke-dasharray " + ease + ", transform " + ease + ", stroke-opacity .5s ease") +
    '<g style="opacity:' + (isWeek ? 0.55 : kOp("arc")) + '; transition:opacity .5s ease">' + ticks + '</g>' +
    rings +
    '<g style="opacity:' + kOp("meal") + '; transition:opacity .35s ease">' + mealDots + '</g>' +
    '<g>' + curved + '</g>' +
    // The now-line: the hour pointed at, and the light it sends to the body.
    '<g data-lm-sun data-p transform="translate(' + LM.CX + ' ' + LM.CY + ') rotate(' + lmAng(Math.max(FIRST_HOUR, Math.min(24, lm.hourF == null ? 13 : lm.hourF))).toFixed(2) + ')" style="opacity:0; transition:opacity .5s ease; pointer-events:none">' +
      '<circle cx="410" cy="0" r="78" fill="url(#lm-glow)"></circle>' +
      '<polygon points="397,-3.2 397,3.2 214,0" fill="url(#lm-ray)"></polygon>' +
      '<line x1="424" y1="0" x2="447" y2="0" style="stroke:var(--ink); stroke-width:1.3; stroke-linecap:round"></line>' +
      '<circle data-lm-halo data-p cx="410" cy="0" r="10" style="fill:none; stroke:var(--ink); stroke-opacity:.3; stroke-width:1"></circle>' +
      '<circle data-lm-bead cx="410" cy="0" r="' + lm.beadR.toFixed(2) + '" style="fill:var(--ink); stroke:var(--bg); stroke-width:2"></circle>' +
    '</g>' +
  '</svg>';
}

/* ------------------------------- the template ------------------------------ */

const lmEyebrow = tail => '<p style="margin:0; font-size:11px; font-weight:600; line-height:1.3; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-faint)">' +
  '<span style="font:600 13px/1 var(--serif); letter-spacing:.06em; color:var(--ink)">' + STAGE_NUMERALS.plan + '</span> / Week plan · ' + tail + '</p>';
const lmLabel = (t, color = "var(--ink-faint)", style = "") => '<p style="margin:0; font:500 10px/1 var(--mono); letter-spacing:.16em; color:' + color + '; ' + style + '">' + t + '</p>';
const lmLink = (act, label, extra = "", color = "var(--ink)", size = "13px") => '<button type="button" class="lm-link" data-lm="' + act + '"' + extra +
  ' style="font-size:' + size + '; color:' + color + '">' + label + '</button>';

function lmTemplate() {
  const W = lmWeek(), D = DayOfWeek.values, step = lm.step, isWeek = step === 7, draft = W.draft, wg = isWeek && !draft;
  const focus = isWeek ? null : D[step], n = routine.nutrition;
  lm.byDay = W.byDay; lm.meals = W.meals;

  // The figure follows the day in hand, or the ring or column pointed at.
  const fd = isWeek ? lm.hoverDay : focus, fx = fd ? W.byDay[fd] : null;
  const all = fx ? fx.ids : [], hm = lm.hoverMuscle && all.includes(lm.hoverMuscle) ? lm.hoverMuscle : null;
  // The day's name for the ghost word, with its session under it, as Targets names a muscle.
  const off = !!(fd && routine.offDays.has(fd));
  const shown = hm ? [hm] : all;
  lm.F = { ids: all, pointed: hm, fams: fx ? fx.fams : [], off, behind: shown.filter(id => LM_BEHIND.has(id)).length * 2 >= shown.length && shown.length > 0,
           word: fd ? DayOfWeek.name[fd] : null, meta: fx ? fx.name + " · " + lmPad(fx.start) + ":00–" + lmPad(fx.end) + ":00" : off ? "Off" : "Rest",
           hour: fx ? fx.start + fx.hours / 2 : 13, sun: !isWeek, wg };

  const kc = l => lm.keyHot === l ? "var(--ink)" : "var(--ink-soft)";
  let left = "";

  if (!wg) {
    const dn = focus ? DayOfWeek.name[focus] : "";
    left += '<div style="position:absolute; left:48px; top:100px; width:432px; pointer-events:auto">' +
      lmEyebrow(isWeek ? "The week" : dn + ", " + (step + 1) + " of 7");

    if (!isWeek && draft) {
      // A day, being told.
      const pd = lmPrevDay(focus), isMon = focus === "MON", wk4 = ["TUE", "WED", "THU", "FRI"], off = routine.offDays.has(focus);
      const copyOn = isMon ? wk4.some(t => !lmSameDay("MON", t)) : !lmSameDay(pd, focus);
      const lede = off ? "Off. Nothing will be planned on " + dn + "." : !isMon && !copyOn ? "Shaped like " + DayOfWeek.name[pd] + " so far. Change only what’s different."
        : "Mark the hours that aren’t yours. We’ll find the best of what’s left.";
      const x = W.byDay[focus], pv = W.byDay[pd];
      let eyebrow, name, time = "", note, color = "var(--ink-faint)", muscles = "";
      if (off) { eyebrow = "OFF"; name = "Not a training day"; note = "Give it back with “Train on " + dn + "”."; }
      else if (x) {
        eyebrow = "WE’D TRAIN HERE"; name = x.name; time = lmPad(x.start) + ":00–" + lmPad(x.end) + ":00"; color = "var(--" + lmFam(x) + "-trace)";
        const W0 = WINDOWS[routine.preferredWindow], inWin = routine.preferredWindow === "any" || (x.start >= W0.from && x.end <= W0.to);
        note = routine.preferredWindow === "any" ? "The best free hour this day has, clear of your meals."
          : inWin ? "In your " + LM_WIN[routine.preferredWindow][0].toLowerCase() + ", clear of your meals."
          : "Outside your " + LM_WIN[routine.preferredWindow][0].toLowerCase() + ": the best hour this day has left.";
        muscles = x.muscles.map(m => '<button type="button" data-lm-muscle="' + m.id + '" style="display:inline-flex; align-items:center; gap:7px; padding:3px 0; background:none; border:0; cursor:default; font-size:13px; color:' +
          (lm.hoverMuscle === m.id ? "var(--ink)" : "var(--ink-soft)") + '; transition:color .25s ease"><span style="width:6px; height:6px; border-radius:50%; background:var(--' + m.family + ')"></span>' + esc(m.name) + '</button>').join("");
      } else {
        eyebrow = "REST"; name = "A day to recover";
        note = pv ? "Recovering from " + DayOfWeek.name[pd] + ": " + pv.muscles.map(m => m.name).join(", ") + "." : "Nothing to recover from yet.";
      }
      const key = (l, icon, body) => '<div data-lm-key="' + l + '" style="display:grid; grid-template-columns:40px minmax(0,1fr); gap:14px; align-items:center; padding:8px 0; border-top:1px solid var(--line-soft)">' +
        '<svg width="40" height="22" viewBox="0 0 40 22" style="display:block; overflow:visible" aria-hidden="true">' + icon + '</svg>' +
        '<span style="font-size:13.5px; line-height:1.4; color:' + kc(l) + '; transition:color .25s ease">' + body + '</span></div>';
      const mealsOn = n.isValid() && n.showMeals;
      left +=
        '<h1 id="plan-title" tabindex="-1" style="margin:14px 0 0; font:400 56px/.98 var(--serif); letter-spacing:-.015em; color:var(--ink); text-wrap:balance">Where does <em>' + dn + '</em> go?</h1>' +
        '<p style="margin:16px 0 0; font:italic 400 22px/1.3 var(--serif); color:var(--ink-soft); text-wrap:pretty">' + lede + '</p>' +
        '<div data-lm-keys style="margin-top:26px; display:flex; flex-direction:column; opacity:' + (off ? 0.4 : 1) + '; transition:opacity .4s ease">' +
          lmLabel("READING THE ARC", "var(--ink-faint)", "margin:0 0 6px") +
          key("arc", '<path d="M4 20 A16 16 0 0 1 36 20" style="fill:none; stroke:var(--ink-faint); stroke-width:1.2"></path><circle cx="20" cy="4" r="2.6" style="fill:var(--ink)"></circle>',
            '<b style="font-weight:600; color:var(--ink)">The arc is your day</b>, six in the morning to midnight.') +
          key("busy", '<line x1="9" y1="11" x2="31" y2="11" style="stroke:url(#lm-flow); stroke-width:11; stroke-linecap:round"></line>',
            '<b style="font-weight:600; color:var(--ink)">Drag along it</b> over busy hours. Drag again to free them.') +
          key("sess", '<line x1="9" y1="6.5" x2="31" y2="6.5" style="stroke:var(--push); stroke-width:3.4; stroke-linecap:round"></line><line x1="9" y1="11" x2="31" y2="11" style="stroke:var(--pull); stroke-width:3.4; stroke-linecap:round"></line><line x1="9" y1="15.5" x2="31" y2="15.5" style="stroke:var(--legs); stroke-width:3.4; stroke-linecap:round"></line>',
            '<b style="font-weight:600; color:var(--ink)">The coloured band</b> is training, in the muscles’ pigments.') +
          key("meal", '<circle cx="20" cy="11" r="6.5" style="fill:none; stroke:var(--ink-faint); stroke-opacity:.6; stroke-width:1"></circle><circle cx="20" cy="11" r="2.8" style="fill:var(--ink-soft)"></circle>',
            mealsOn ? '<b style="font-weight:600; color:var(--ink)">Dots are meals.</b> Training stays clear of them.'
              : n.isValid() ? '<b style="font-weight:600; color:var(--ink)">Meals are hidden.</b> Show them again on the week.'
              : '<b style="font-weight:600; color:var(--ink)">Meals come from Nutrition.</b> Set it up to see them here.') +
        '</div>' +
        '<div style="display:flex; flex-wrap:wrap; gap:6px 18px; margin-top:16px">' +
          lmLink("off", off ? "Train on " + dn : "Take " + dn + " off", ' aria-pressed="' + off + '"') +
          (copyOn ? lmLink("copy", isMon ? "Same for Tue–Fri" : "Same as " + DayOfWeek.name[pd]) : "") +
          (!off && busyRuns(focus).length ? lmLink("clear", "Clear " + dn, "", "var(--ink-soft)") : "") +
        '</div>' +
        // The ring's hours for the keyboard: out of sight until one has the focus.
        (off ? '' : '<div class="lm-hours" role="group" aria-label="' + dn + '’s busy hours">' +
          Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, j) => FIRST_HOUR + j).map(h =>
            '<button type="button" data-lm="hour" data-h="' + h + '" aria-pressed="' + isBusy(focus, h) + '" aria-label="' + hourRange(h, h + 1) + ', busy">' + lmPad(h) + '</button>').join("") +
        '</div>') +
        '<div style="margin-top:30px; padding-top:16px; border-top:1px solid var(--line)">' +
          lmLabel(eyebrow, color) +
          '<div style="display:flex; align-items:baseline; gap:12px; margin-top:10px">' +
            '<span style="font:italic 400 34px/1 var(--serif); color:var(--ink)">' + esc(name) + '</span>' +
            '<span style="font:500 10.5px/1 var(--mono); letter-spacing:.1em; color:var(--ink-faint)">' + time + '</span></div>' +
          (muscles ? '<div data-lm-muscles style="display:flex; flex-wrap:wrap; gap:2px 16px; margin-top:10px">' + muscles + '</div>' : '') +
          '<p style="margin:10px 0 0; font-size:12.5px; line-height:1.5; color:var(--ink-soft); text-wrap:pretty">' + esc(note) + '</p>' +
        '</div>';
    }

    if (!isWeek && !draft) {
      // A day, planned.
      const x = W.byDay[focus], off = routine.offDays.has(focus);
      const h1b = off ? "off." : x ? "at " + LM_HOUR[x.start] + "." : "at rest.";
      let sub, body = "";
      if (x) {
        const s = x.session, w = s.workout, sets = w ? w.sets : 0;
        sub = x.name + ", " + lmPad(x.start) + ":00 to " + lmPad(x.end) + ":00 · " + sets + " hard sets.";
        body += '<div data-lm-muscles style="margin-top:16px; display:flex; flex-direction:column">' +
          (w ? w.entries : []).map((e, i) => {
            const m = MUSCLE_BY_ID.get(e.muscleId), fam = m ? m.family : "push";
            return '<div data-lm-muscle="' + e.muscleId + '" style="display:grid; grid-template-columns:8px minmax(0,1fr) 72px 52px; gap:12px; align-items:center; padding:6px 0; border-top:1px solid var(--line-soft); background:' +
              (lm.hoverMuscle === e.muscleId ? "color-mix(in oklab, var(--" + fam + ") 9%, transparent)" : "transparent") + '; transition:background .25s ease">' +
              '<span style="width:7px; height:7px; border-radius:50%; background:var(--' + fam + ')"></span>' +
              '<span style="min-width:0; font-size:14px; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis" title="' + esc(e.exercise.name + (m ? " · " + m.name : "")) + '">' + esc(e.exercise.name) + '</span>' +
              '<span style="font:500 11px/1 var(--mono); letter-spacing:.04em; color:var(--ink-soft)">' + e.sets + ' × ' + e.reps + '</span>' +
              '<button type="button" class="lm-link" data-lm="swap" data-i="' + i + '" style="justify-self:end; font-size:12px; color:var(--ink-soft)" aria-label="Swap ' + esc(e.exercise.name) + ' for another ' + esc(m ? m.name.toLowerCase() : "") + ' exercise">Swap ↻</button>' +
            '</div>';
          }).join("") + '</div>';
        const mh = lm.moveHover, why = D.map(d => lmWhyNot(s, d));
        body += lmLabel("MOVE TO", "var(--ink-faint)", "margin-top:22px") +
          '<div data-lm-moves style="display:flex; gap:4px; margin-top:10px">' + D.map((d, i) => {
            const cur = d === s.day, ok = !cur && !why[i];
            return '<button type="button" data-lm="move" data-d="' + d + '" data-lm-move="' + d + '"' + (cur ? ' aria-current="true"' : '') + (!ok && !cur ? ' aria-disabled="true"' : '') +
              ' aria-label="' + DayOfWeek.name[d] + (cur ? ", where it is now" : why[i] ? ": " + why[i].toLowerCase() : "") + '" style="width:42px; height:32px; padding:0; border-radius:999px; border:1px solid ' +
              (cur ? "var(--ink)" : ok ? "var(--line)" : "var(--line-soft)") + '; background:' + (cur ? "var(--ink)" : "transparent") + '; color:' + (cur ? "var(--bg)" : ok ? "var(--ink)" : "var(--ink-faint)") +
              '; cursor:' + (ok ? "pointer" : "default") + '; font-size:11px; font-weight:500; opacity:' + (cur || ok ? 1 : 0.55) + '; transition:background .25s ease, color .25s ease">' + DayOfWeek.label[d] + '</button>';
          }).join("") + '</div>';
        const mi = mh ? D.indexOf(mh) : -1, at = mh && !why[mi] && mh !== s.day ? lmStartOn(s, mh) : null;
        body += '<p style="margin:8px 0 0; min-height:18px; font-size:12px; color:' + (mh && mh !== s.day && why[mi] ? "var(--warn)" : "var(--ink-faint)") + '">' +
          (mh ? (mh === s.day ? "Where it is now." : why[mi] ? DayOfWeek.name[mh] + ": " + why[mi].toLowerCase() + "." : "Move it to " + DayOfWeek.name[mh] + ", " + lmPad(at) + ":00.") : "Point at a day to see if it fits.") + '</p>' +
          '<p style="margin:4px 0 0; font-size:12px; color:var(--ink-faint)">Or drag the band along the arc to change its hour.</p>';
      } else {
        const pd = lmPrevDay(focus), pv = W.byDay[pd];
        sub = off ? "No training on " + dn + "." : pv ? "Recovering from " + DayOfWeek.name[pd] + ": " + pv.muscles.map(m => m.name).join(", ") + "." : "Nothing to recover from yet.";
      }
      left +=
        '<h1 id="plan-title" tabindex="-1" style="margin:14px 0 0; font:400 56px/.98 var(--serif); letter-spacing:-.015em; color:var(--ink); text-wrap:balance">' + dn + ', <em>' + h1b + '</em></h1>' +
        '<p style="margin:16px 0 0; font:italic 400 22px/1.3 var(--serif); color:var(--ink-soft); text-wrap:pretty">' + esc(sub) + '</p>' + body +
        '<div style="display:flex; gap:18px; margin-top:16px">' +
          lmLink("edit-hours", "Change " + dn + "’s hours", "", "var(--ink)", "12.5px") +
          (x ? lmLink("remove", "Remove session", "", "var(--warn)", "12.5px") : "") +
        '</div>';
    }

    if (isWeek) {
      // The week, told.
      const ch = lm.chooser, cur = k => lm.preview && lm.preview.key === k ? lm.preview.value : routine[LM_TERMS[k]];
      const exp = routine.experience || DEFAULT_EXPERIENCE;
      const word = (k, label) => '<button type="button" data-lm="chooser" data-k="' + k + '" aria-expanded="' + (ch === k) + '" style="padding:0 2px; background:none; border:0; cursor:pointer; font:italic 400 25px/1.32 var(--serif); color:var(--ink); text-decoration:underline; text-decoration-color:' +
        (ch === k ? "var(--ink)" : "var(--ink-faint)") + '; text-decoration-thickness:1px; text-underline-offset:6px">' + label + '</button>';
      const days = cur("days"), len = cur("len"), win = cur("win"), split = cur("split");
      const opt = (k, v, label, size, tag = "") => {
        const on = routine[LM_TERMS[k]] === v || (k === "exp" && !routine.experience && v === DEFAULT_EXPERIENCE);
        const pre = lm.preview && lm.preview.key === k && lm.preview.value === v;
        return '<button type="button" data-lm="pick" data-k="' + k + '" data-v="' + v + '" data-lm-opt="' + k + ':' + v + '" aria-pressed="' + on + '" style="position:relative; display:flex; flex-direction:column; align-items:center; gap:3px; padding:0 2px 9px; background:none; border:0; cursor:pointer; color:' +
          (on ? "var(--ink)" : pre ? "var(--ink-soft)" : "var(--ink-faint)") + '; transition:color .25s ease">' +
          '<span style="font-family:var(--serif); font-weight:400; font-size:' + size + '; line-height:1; font-style:' + (on ? "italic" : "normal") + '">' + label + '</span>' +
          '<span style="font:500 9px/1 var(--mono); letter-spacing:.12em; text-transform:uppercase; color:var(--ink-faint); min-height:9px">' + tag + '</span>' +
          '<span style="position:absolute; left:0; right:0; bottom:0; height:2px; border-radius:1px; background:var(--ink); transform:' + (on ? "scaleX(1)" : "scaleX(0)") + '; transition:transform .45s cubic-bezier(.16,1,.3,1)"></span></button>';
      };
      const CH = {
        days: () => [1, 2, 3, 4, 5, 6, 7].map(v => opt("days", v, String(v), "32px")),
        len: () => SESSION_LENGTH_OPTIONS.map(v => opt("len", v, String(v), "32px", "min")),
        win: () => ["morning", "midday", "evening", "any"].map(v => opt("win", v, LM_WIN[v][0], "24px")),
        split: () => Object.keys(SPLITS).map(v => opt("split", v, SPLITS[v].label, "22px")),
        exp: () => EXPERIENCE_LEVELS.map(lv => opt("exp", lv.id, LM_EXP[lv.id][0], "22px"))
      };
      const fit = fitNote(lmPreviewed(weekPreview).fit);
      const status = lm.status && lm.status.kind === "err" ? lm.status : null;
      const hd = lm.hoverDay, hx = hd ? W.byDay[hd] : null;
      const mealsOn = n.isValid() && n.showMeals;
      left +=
        '<h1 id="plan-title" tabindex="-1" style="margin:14px 0 0; font:400 56px/.98 var(--serif); letter-spacing:-.015em; color:var(--ink)">Seven days, <em>told.</em></h1>' +
        '<div style="position:relative">' +
          '<p style="margin:20px 0 0; font:400 25px/1.32 var(--serif); color:var(--ink-soft)">' +
            word("days", LM_NUM[days]) + ' ' + (days === 1 ? "day a week" : "days a week") + ', ' + word("len", LM_LEN[len] || len + " minutes") + ' each, ' +
            word("win", LM_WIN[win][1]) + ', ' + word("split", LM_SPLIT[split]) + '.</p>' +
          (ch && ch !== "exp" ? '<div data-lm-chooser style="position:absolute; left:-12px; top:calc(100% + 8px); z-index:20; display:flex; align-items:flex-end; gap:20px; padding:12px 18px 10px; background:var(--bg); box-shadow:0 0 28px 18px var(--bg); white-space:nowrap">' + CH[ch]().join("") + '</div>' : '') +
        '</div>' +
        '<div style="position:relative">' +
          '<p style="margin:10px 0 0; font-size:13.5px; color:var(--ink-soft)">' + (LM_NUM[routine.selection.size] || String(routine.selection.size)).replace(/^None$/, "No") + (routine.selection.size === 1 ? " muscle group" : " muscle groups") +
            ' from Targets, for someone training <button type="button" data-lm="chooser" data-k="exp" aria-expanded="' + (ch === "exp") + '" style="padding:0 1px; background:none; border:0; cursor:pointer; font-size:13.5px; font-weight:500; color:var(--ink); text-decoration:underline; text-decoration-color:' +
            (ch === "exp" ? "var(--ink)" : "var(--ink-faint)") + '; text-underline-offset:3px">' + LM_EXP[cur("exp") || exp][1] + '</button>.</p>' +
          (ch === "exp" ? '<div data-lm-chooser style="position:absolute; left:-12px; top:calc(100% + 8px); z-index:20; display:flex; align-items:flex-end; gap:20px; padding:12px 18px 10px; background:var(--bg); box-shadow:0 0 28px 18px var(--bg); white-space:nowrap">' + CH.exp().join("") + '</div>' : '') +
        '</div>' +
        (status ? '<p style="margin:12px 0 0; display:flex; align-items:baseline; gap:9px; font-size:13px; line-height:1.45; color:var(--warn)"><span style="flex:none; width:6px; height:6px; border-radius:50%; background:var(--warn); transform:translateY(-1px)"></span><span>' + esc(status.text) + '</span></p>'
          : fit ? '<p aria-live="polite" style="margin:12px 0 0; display:flex; align-items:baseline; gap:9px; font-size:13px; line-height:1.45; color:' + (fit.warn ? "var(--warn)" : "var(--ink-soft)") + '"><span style="flex:none; width:6px; height:6px; border-radius:50%; background:' +
            (fit.warn ? "var(--warn)" : "var(--legs)") + '; transform:translateY(-1px)"></span><span>' + esc(fit.text) + '</span></p>' : '') +
        '<div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px 14px; margin-top:16px; font-size:12px; color:var(--ink-faint)">' +
          '<span>Fill busy</span>' + [["9-17", "Weekdays 9–5"], ["8-18", "8–6"], ["clear", "Clear all"]].map(([k, l]) => lmLink("preset", l, ' data-k="' + k + '"', "var(--ink-soft)", "12px")).join("") +
          '<span style="width:1px; height:12px; background:var(--line)"></span>' +
          (n.isValid()
            ? '<button type="button" data-lm="meals" aria-pressed="' + n.showMeals + '" style="display:inline-flex; align-items:center; gap:7px; padding:0; background:none; border:0; cursor:pointer; font-size:12px; font-weight:500; color:var(--ink-soft)">' +
                '<span style="display:block; width:7px; height:7px; border-radius:50%; background:' + (mealsOn ? "var(--ink-faint)" : "transparent") + '; box-shadow:0 0 0 1px var(--ink-faint)"></span>' + (mealsOn ? "Meals shown" : "Meals hidden") + '</button>'
            : '<button type="button" class="lm-link" data-goto="nutrition" style="font-size:12px; color:var(--ink-soft)">Set up meals in Nutrition</button>') +
        '</div>' +
        (routine.sessions.length && lm.editing ? '<button type="button" class="lm-link" data-lm="return" style="margin-top:12px; font-size:12.5px">Keep the week as it was</button>' : '') +
        '<div style="margin-top:34px; padding-top:16px; border-top:1px solid var(--line)">' +
          lmLabel(hd ? DayOfWeek.name[hd].toUpperCase() + (routine.offDays.has(hd) ? " · OFF" : hx ? " · " + esc(hx.name.toUpperCase()) + " · " + lmPad(hx.start) + ":00" : " · REST") : "SEVEN RINGS, MONDAY AT THE CENTRE",
            hx ? "var(--" + lmFam(hx) + "-trace)" : "var(--ink-faint)") +
          '<p style="margin:10px 0 0; min-height:56px; font:italic 400 21px/1.32 var(--serif); color:var(--ink-soft); text-wrap:pretty">' +
            esc(hd ? lmBrief(hd, W.byDay) : "Point at a ring to see its day on the body. Click it to open the day.") + '</p>' +
        '</div>';
    }
    left += '</div>';
  }

  // The week, planned: the whole screen, seven suns on one horizon.
  let week = "";
  if (wg) {
    const g = [...routine.sessions].sort(byWeekOrder), wkIn = lm.wkIn;
    const sets = g.reduce((t, s) => t + (s.workout ? s.workout.sets : 0), 0);
    const v = routine.weeklyVolume(), tv = [...new Set(v.rows.map(r => r.times).filter(Boolean))].sort((a, b) => a - b);
    const tw = { 1: "once", 2: "twice", 3: "three times" };
    const sub = LM_NUM[g.length] + (g.length === 1 ? " session " : " sessions ") + LM_WIN[routine.preferredWindow][1] +
      (tv.length ? ", each muscle " + tv.map(t => tw[t] || t + " times").join(" or ") + " a week." : ".");
    const hrs = Math.round(g.reduce((t, s) => t + sessionMinutes(s), 0) / 30) / 2;
    const stats = [[String(g.length), g.length === 1 ? "session" : "sessions"], [String(hrs), "hours"], [String(sets), "hard sets"]];
    if (n.isValid()) stats.push([n.kcal.toLocaleString("en-US"), "kcal a day"], [n.protein + " g", "protein a day"]);
    const gaps = weekGaps(), stale = weekIsStale(), outdated = !stale && mealsOutdated();
    // What the week falls short of, in one line; the reasons open under it.
    const said = lm.status && lm.status.kind ? lm.status.text.replace(/ Some muscles get less than they usually need this week — see the notes below\./, "") : "";
    const notes = [
      stale && !/changed since/.test(said) ? "Your targets, training or nutrition changed since this week was generated. Generate again to plan for them." : "",
      outdated ? "The meals no longer match your daily targets. Generate again to update them." : "",
      said, ...gaps
    ].filter(Boolean);
    const short = stale ? "Your targets or settings changed since this week was generated." : outdated ? "The meals no longer match your daily targets."
      : "Some of your targets fall short this week (estimate).";
    const AR = LM.WR, AC = 2 * Math.PI * AR, any = !!lm.hoverDay, ang = lmAng;
    const cap = (r, w, a, b, gap) => lmCap(r, w, a, b, gap);
    const cols = D.map((d, i) => {
      const x = W.byDay[d], off = routine.offDays.has(d), hot = lm.hoverDay === d, runs = off ? [[FIRST_HOUR, 24]] : busyRuns(d), pv = W.byDay[lmPrevDay(d)];
      const bDelay = (0.2 + i * 0.07).toFixed(2) + "s";
      const arc = (r, style) => '<circle cx="96" cy="96" style="r:' + r + 'px; fill:none; stroke-linecap:round; transform-origin:96px 96px; ' + style + '"></circle>';
      const busy = [0, 1, 2, 3].map(k => {
        const run = runs[k];
        if (!run) return arc(AR, "stroke:transparent; stroke-width:0px; stroke-dasharray:0 " + AC.toFixed(1) + "; transform:rotate(180deg); transition:stroke-dasharray 1.1s cubic-bezier(.16,1,.3,1) " + bDelay);
        const q = cap(AR, 7, run[0], run[1], 2);
        return arc(AR, "stroke:" + (off ? "var(--lm-off)" : "var(--lm-busy-line)") + "; stroke-width:7px; stroke-dasharray:" + (wkIn ? q.dash : "0 " + AC.toFixed(1)) + "; transform:" + q.rot + "; transition:stroke-dasharray 1.1s cubic-bezier(.16,1,.3,1) " + bDelay);
      }).join("");
      // On the small arch a session reads as a band: at least 2.4 h of arc, centred on its hour.
      const fams = x ? x.fams : [], nf = fams.length, sw = 12, sg = 1.4, stw = nf ? (sw - (nf - 1) * sg) / nf : 0;
      const vm = x ? x.start + x.hours / 2 : 18, vs = x ? Math.max(2.4, x.hours) / 2 : 0, a0 = Math.max(FIRST_HOUR, vm - vs), a1 = Math.min(24, vm + vs);
      const sess = [0, 1, 2, 3].map(j => {
        const on = !!x && j < nf, rr = on ? AR - sw / 2 + stw / 2 + j * (stw + sg) : AR, q = cap(rr, on ? stw : 0, a0, a1, 1);
        return arc(rr.toFixed(2), "stroke:" + (on ? "var(--" + fams[j] + ")" : "transparent") + "; stroke-width:" + (on ? stw.toFixed(2) : 0) + "px; stroke-dasharray:" + (on && wkIn ? q.dash : "0 " + q.c.toFixed(1)) +
          "; transform:" + q.rot + "; transition:stroke-dasharray 1.1s cubic-bezier(.16,1,.3,1) " + (0.55 + i * 0.08 + j * 0.05).toFixed(2) + "s");
      }).join("");
      const gq = x ? cap(AR, 4, a0, a1, 0) : null;
      const mt = ang(x ? vm : 13) * Math.PI / 180, SR = AR + 14, sx = (96 + Math.cos(mt) * SR).toFixed(1), sy = (96 + Math.sin(mt) * SR).toFixed(1);
      const dm = (W.meals[d] || []).map(m => { const t = ang(m.hour + 0.5) * Math.PI / 180;
        return '<circle cx="' + (96 + Math.cos(t) * (AR - 13)).toFixed(1) + '" cy="' + (96 + Math.sin(t) * (AR - 13)).toFixed(1) + '" r="2.3" style="fill:var(--ink-soft); opacity:' + (wkIn ? 1 : 0) + '; transition:opacity .6s ease ' + (0.9 + i * 0.07).toFixed(2) + 's"></circle>'; }).join("");
      let items = "", bar = "", total = "";
      if (x) {
        const w = x.session.workout, entries = w ? w.entries : [], fs = {};
        entries.forEach(e => { const f = MUSCLE_BY_ID.get(e.muscleId).family; fs[f] = (fs[f] || 0) + e.sets; });
        items = entries.map(e => { const m = MUSCLE_BY_ID.get(e.muscleId);
          return '<div title="' + esc(e.exercise.name + " · " + m.name + " · " + e.sets + " × " + e.reps) + '" style="display:grid; grid-template-columns:5px minmax(0,1fr) auto; align-items:start; gap:8px; padding:5px 0; border-top:1px solid var(--line-soft)">' +
            '<span style="width:5px; height:5px; margin-top:6px; border-radius:50%; background:var(--' + m.family + ')"></span>' +
            '<span style="min-width:0; font-size:12.5px; line-height:1.3; color:var(--ink); text-wrap:pretty">' + esc(e.exercise.name) + '</span>' +
            '<span style="padding-top:3px; font:500 10.5px/1 var(--mono); color:var(--ink-faint); white-space:nowrap">' + e.sets + '×' + e.reps + '</span></div>'; }).join("");
        bar = fams.map((f, j) => '<span style="flex:' + (wkIn ? fs[f] || 1 : 0.001) + ' 1 0; min-width:0; border-radius:3px; background:var(--' + f + '); transition:flex-grow 1s cubic-bezier(.16,1,.3,1) ' + (0.7 + i * 0.07 + j * 0.05).toFixed(2) + 's"></span>').join("");
        total = (w ? w.sets : 0) + " hard sets · " + sessionMinutes(x.session) + " min";
      }
      const note = off ? "No training. The day is yours." : pv ? "Recovering from " + DayOfWeek.name[lmPrevDay(d)] + ": " + pv.muscles.map(m => m.name.toLowerCase()).join(", ") + "." : "A quiet day.";
      const inOp = wkIn ? 1 : 0, inTf = wkIn ? "none" : "translateY(14px)";
      return '<button type="button" data-lm="open" data-i="' + i + '" data-lm-col="' + d + '" title="Open ' + DayOfWeek.name[d] + '" style="position:relative; display:flex; flex-direction:column; justify-content:flex-start; align-items:stretch; width:192px; height:540px; padding:0; margin:0; background:none; border:0; text-align:left; color:var(--ink); cursor:pointer; opacity:' +
          (any && !hot ? 0.45 : 1) + '; transition:opacity .4s ease">' +
        '<div style="position:absolute; left:4px; right:4px; top:-12px; bottom:0; border-radius:16px; background:' + (hot ? "color-mix(in oklab, var(--bg) 58%, transparent)" : "transparent") +
          '; backdrop-filter:' + (hot ? "blur(14px)" : "none") + '; -webkit-backdrop-filter:' + (hot ? "blur(14px)" : "none") + '; box-shadow:' + (hot ? "0 0 0 1px var(--line-soft)" : "none") + '; transition:background .35s ease, box-shadow .35s ease"></div>' +
        '<svg width="192" height="104" viewBox="0 0 192 104" style="position:relative; display:block; overflow:visible" aria-hidden="true">' +
          '<path d="M 16 96 A 80 80 0 0 1 176 96" style="fill:none; stroke:var(--ink-faint); stroke-opacity:.42; stroke-width:1"></path>' +
          '<circle cx="' + sx + '" cy="' + sy + '" r="34" fill="url(#lm-glow)" style="opacity:' + (x && wkIn ? (hot ? 1 : 0.55) : 0) + '; transition:opacity .6s ease"></circle>' +
          busy +
          '<circle cx="96" cy="96" r="80" filter="url(#lm-soft-s)" style="fill:none; stroke:' + (x ? "var(--" + lmFam(x) + ")" : "transparent") + '; stroke-opacity:' + (x ? (hot ? 0.55 : 0.3) : 0) +
            '; stroke-width:16; stroke-linecap:round; stroke-dasharray:' + (gq && wkIn ? gq.dash : "0 " + AC.toFixed(1)) + '; transform-origin:96px 96px; transform:' + (gq ? gq.rot : "rotate(180deg)") +
            '; transition:stroke-dasharray 1.1s cubic-bezier(.16,1,.3,1) ' + (0.6 + i * 0.08).toFixed(2) + 's, stroke-opacity .4s ease"></circle>' +
          sess + dm +
          '<circle cx="' + sx + '" cy="' + sy + '" r="4.2" style="fill:var(--ink); stroke:var(--bg); stroke-width:1.6; opacity:' + (x && wkIn ? 1 : 0) + '; transition:opacity .6s ease ' + (0.9 + i * 0.07).toFixed(2) + 's"></circle>' +
        '</svg>' +
        '<div style="position:absolute; left:0; width:192px; top:54px; text-align:center; font:italic 400 36px/1 var(--serif); color:' + (x ? "var(--ink)" : "var(--ink-faint)") + '; opacity:' + inOp + '; transform:' + inTf +
          '; transition:opacity .8s ease ' + (0.25 + i * 0.06).toFixed(2) + 's, transform 1s cubic-bezier(.16,1,.3,1) ' + (0.25 + i * 0.06).toFixed(2) + 's, color .3s ease">' + DayOfWeek.label[d] + '</div>' +
        '<div style="position:relative; padding:22px 16px 0 16px; opacity:' + inOp + '; transform:' + inTf + '; transition:opacity .8s ease ' + (0.4 + i * 0.06).toFixed(2) + 's, transform 1s cubic-bezier(.16,1,.3,1) ' + (0.4 + i * 0.06).toFixed(2) + 's">' +
          '<p style="margin:0; font:500 10px/1 var(--mono); letter-spacing:.14em; color:' + (x ? "var(--" + lmFam(x) + "-trace)" : "var(--ink-faint)") + '">' + (x ? lmPad(x.start) + ":00 – " + lmPad(x.end) + ":00" : off ? "OFF" : "REST") + '</p>' +
          '<p style="margin:9px 0 0; font:italic 400 26px/1.05 var(--serif); color:' + (x ? "var(--" + lmFam(x) + "-trace)" : "var(--ink-soft)") + '; text-wrap:balance">' + esc(x ? x.name : off ? "Left to you" : "Rest") + '</p>' +
          (x ? '<div style="display:flex; gap:3px; height:5px; margin-top:14px">' + bar + '</div>' +
               '<div style="display:flex; flex-direction:column; margin-top:12px">' + items + '</div>' +
               '<p style="margin:8px 0 0; padding-top:8px; border-top:1px solid var(--line); font-size:11.5px; color:var(--ink-soft)">' + total + '</p>'
             : '<p style="margin:12px 0 0; font-size:12.5px; line-height:1.5; color:var(--ink-soft); text-wrap:pretty">' + esc(note) + '</p>') +
        '</div>' +
      '</button>';
    }).join("");
    week = '<div style="position:absolute; left:48px; top:96px; width:1344px; height:700px; pointer-events:auto">' +
      '<div style="height:132px; display:flex; align-items:flex-end; justify-content:space-between; gap:32px">' +
        '<div style="display:flex; flex-direction:column">' + lmEyebrow("Your week") +
          '<h1 id="plan-title" tabindex="-1" style="margin:10px 0 0; font:400 76px/.9 var(--serif); letter-spacing:-.02em; color:var(--ink)">Your <em>week.</em></h1>' +
          '<p style="margin:10px 0 0; font:italic 400 22px/1.25 var(--serif); color:var(--ink-soft)">' + esc(sub) + '</p>' +
          (notes.length ? '<div style="position:relative; margin-top:6px">' +
            '<p style="margin:0; display:flex; align-items:baseline; gap:9px; font-size:12.5px; line-height:1.45; color:var(--warn)"><span style="flex:none; width:6px; height:6px; border-radius:50%; background:var(--warn); transform:translateY(-1px)"></span>' +
              '<span>' + esc(short) + '</span><button type="button" class="lm-link" data-lm="notes" aria-expanded="' + !!lm.notes + '" style="font-size:12.5px; color:var(--ink)">' + (lm.notes ? "Hide" : "Why") + '</button></p>' +
            (lm.notes ? '<div style="position:absolute; left:-18px; top:calc(100% + 8px); z-index:20; width:620px; display:flex; flex-direction:column; gap:8px; padding:14px 18px; background:var(--bg); box-shadow:0 0 28px 18px var(--bg)">' +
              notes.map(t => '<p style="margin:0; font-size:12.5px; line-height:1.5; color:var(--ink-soft); text-wrap:pretty">' + esc(t) + '</p>').join("") + '</div>' : '') +
          '</div>' : '') +
        '</div>' +
        '<div style="display:flex; flex-direction:column; align-items:flex-end; gap:12px; padding-bottom:4px">' +
          '<div style="display:flex; align-items:flex-end; gap:34px">' + stats.map(([num, label], j) =>
            '<div style="display:flex; flex-direction:column; gap:6px; opacity:' + (wkIn ? 1 : 0) + '; transform:' + (wkIn ? "none" : "translateY(10px)") + '; transition:opacity .8s ease ' + (0.15 + j * 0.07).toFixed(2) + 's, transform 1s cubic-bezier(.16,1,.3,1) ' + (0.15 + j * 0.07).toFixed(2) + 's">' +
              '<span style="font:400 42px/.9 var(--serif); font-variant-numeric:lining-nums; color:var(--ink); white-space:nowrap">' + num + '</span>' +
              '<span style="font-size:11.5px; line-height:1.2; color:var(--ink-faint); white-space:nowrap">' + label + '</span></div>').join("") + '</div>' +
          '<p style="margin:0; font-size:12px; color:var(--ink-faint)">Estimate. Point at a day to see it on the body; click to open it.</p>' +
        '</div>' +
      '</div>' +
      '<div data-lm-cols style="position:relative; margin-top:24px; display:grid; grid-template-columns:repeat(7, 192px)">' +
        '<div style="position:absolute; left:0; right:0; top:96px; height:1px; background:var(--line); transform-origin:left center; transform:' + (wkIn ? "scaleX(1)" : "scaleX(0)") + '; transition:transform 1.6s cubic-bezier(.16,1,.3,1)"></div>' +
        cols +
      '</div>' +
      '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><filter id="lm-soft-s" x="-35%" y="-35%" width="170%" height="170%"><feGaussianBlur stdDeviation="5"></feGaussianBlur></filter></defs></svg>' +
    '</div>';
  }

  return { plate: '<div data-lm-hit style="position:absolute; inset:0; display:' + (wg ? "none" : "block") + '"></div>' + left + week, arc: lmArcTemplate(W, step) };
}

/** The week's index in the footer: seven small suns, a day each, and the week. */
function lmFootTemplate() {
  const D = DayOfWeek.values, step = lm.step, draft = lmDraft(), byDay = lm.byDay;
  const arcP = (r, a, b) => { const A = lmAng(a) * Math.PI / 180, B = lmAng(b) * Math.PI / 180;
    return "M " + (14 + r * Math.cos(A)).toFixed(2) + " " + (16 + r * Math.sin(A)).toFixed(2) + " A " + r + " " + r + " 0 0 1 " + (14 + r * Math.cos(B)).toFixed(2) + " " + (16 + r * Math.sin(B)).toFixed(2); };
  const seg = (d, stroke, w, op) => '<path d="' + d + '" style="fill:none; stroke:' + stroke + '; stroke-width:' + w + '; stroke-linecap:round; stroke-opacity:' + op + '"></path>';
  const bead = (i, label, title, segs) => '<button type="button" data-lm="step" data-i="' + i + '" title="' + title + '" aria-label="' + title + '"' + (i === step ? ' aria-current="step"' : '') +
    ' style="left:' + i * 46 + 'px"><svg width="28" height="18" viewBox="0 0 28 18" aria-hidden="true">' + segs + '</svg>' +
    '<span style="color:' + (i === step ? "var(--ink)" : "var(--ink-faint)") + '">' + label + '</span></button>';
  return D.map((d, i) => {
    const off = routine.offDays.has(d), x = byDay[d];
    let segs = seg(arcP(11, 6, 24), "var(--ink-faint)", 1, off ? 0.35 : 0.6);
    if (!off) for (const [a, b] of busyRuns(d)) segs += seg(arcP(11, a + 0.3, b - 0.3), "var(--ink-soft)", 3, 0.45);
    if (x && !off) segs += seg(arcP(11, x.start + 0.3, x.end - 0.3), "var(--" + lmFam(x) + ")", 4, draft ? 0.6 : 1);
    return bead(i, DayOfWeek.label[d], DayOfWeek.name[d] + (x ? " · " + x.name : off ? " · off" : " · rest"), segs);
  }).join("") +
  bead(7, "Week", "The week", [4, 7.5, 11].map(r => seg(arcP(r, 6, 24), "var(--ink-faint)", 1.2, 0.7)).join("")) +
  '<div aria-hidden="true" style="position:absolute; left:0; top:-2px; width:0; height:0; pointer-events:none; transform:translateX(' + (step * 46 + 14) + 'px); transition:transform .6s cubic-bezier(.16,1,.3,1)">' +
    '<div style="position:absolute; left:-3.5px; top:0; width:7px; height:7px; transform:rotate(45deg); background:var(--ink)"></div></div>';
}

/* --------------------------------- drawing --------------------------------- */

/* The plate everything is set on; behind the figure, the sky and the ring. */
weekEl.innerHTML = '<div class="lm-stage" id="lm-stage"></div>';
const lmStage = $("lm-stage"), lmFoot = $("foot-week");
const lmSkyEl = document.createElement("div");
lmSkyEl.className = "lm-sky";
lmSkyEl.setAttribute("aria-hidden", "true");
lmSkyEl.innerHTML = '<div class="lm-sky-light"></div><div class="lm-grain"></div>';
const lmArcEl = document.createElement("div");
lmArcEl.className = "lm-arc";
lmArcEl.setAttribute("aria-hidden", "true");
{
  const stage = document.getElementById("anatomy-stage");
  stage.insertBefore(lmArcEl, stage.firstChild);
  stage.insertBefore(lmSkyEl, stage.firstChild);
}

/** The week's message (what Generate did, what an edit changed); null to clear. */
function setStatus(text, kind = "") {
  lm.status = text ? { text, kind } : null;
  announce(text);
  if (Stages.current === "plan") renderWeek();
}

function renderWeek() {
  const wg = lm.step === 7 && !lmDraft();
  if (wg && !lm.wgOn) { lm.wgOn = true; lm.wkIn = false; clearTimeout(lm.wkT); lm.wkT = setTimeout(() => { lm.wkIn = true; renderWeek(); }, 70); }
  else if (!wg && lm.wgOn) { lm.wgOn = false; lm.wkIn = false; clearTimeout(lm.wkT); }
  const t = lmTemplate();
  pvMorph(lmStage, t.plate);
  pvMorph(lmArcEl, t.arc);
  pvMorph(lmFoot, lmFootTemplate());
  lmFoot.hidden = Stages.narrow;
  planEl.dataset.view = wg ? "week" : lm.step === 7 ? "rings" : "day";
  // The day's name, very large and quiet behind the figure: Targets' ghost word (targets.js), woven through the legs.
  if (Stages.current === "plan") ghost(lm.F.word, lm.F.fams[0] || "", lm.F.word ? lm.F.meta : "");
  lm.needleEl = null;
  if (lm.scrubH != null && lm.step < 7) lmNeedle(lm.scrubH);
  Stages.refresh();
}

/** Fits the 1440 × 900 plate to the screen, centred. */
function lmFit() {
  const vw = planEl.clientWidth, vh = planEl.clientHeight, k = Math.min(vw / 1440, vh / 900);
  lm.vw = vw; lm.vh = vh; lm.k = k; lm.ox = (vw - 1440 * k) / 2; lm.oy = (vh - 900 * k) / 2;
  const t = "translate(" + lm.ox + "px," + lm.oy + "px) scale(" + k + ")";
  lmStage.style.transform = t;
  lmArcEl.style.transform = t;
  lm.css = "";
}

/* --------------------------------- the light -------------------------------- */

const lmHex = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const lmSkyTable = {};
function lmSkyAt(list, h) {
  h = Math.max(FIRST_HOUR, Math.min(24, h));
  let i = 0; while (i < list.length - 2 && h > list[i + 1][0]) i++;
  const a = list[i], b = list[i + 1]; let t = (h - a[0]) / (b[0] - a[0]); t = t * t * (3 - 2 * t);
  return [0, 1, 2].map(j => a[1][j] + (b[1][j] - a[1][j]) * t);
}
/**
 * Not one colour: the ground of the hour, a glow where the sun stands, a
 * cooler light across from it; on the generated week, each day its own
 * light, from the hour its session stands at.
 */
function lmSkyFrame(dt) {
  const theme = lmDark() ? "dark" : "light";
  const T = lmSkyTable[theme] || (lmSkyTable[theme] = Object.fromEntries(Object.entries(LM_SKY[theme]).map(([k, v]) => [k, v.map(([h, hex]) => [h, lmHex(hex)])])));
  if (lm.theme !== theme) { lm.theme = theme; lm.sky = null; }
  const F = lm.F, H = lm.hourF, bd = lm.byDay, D = DayOfWeek.values, { CX, CY, R, WX, WY, WR, COL } = LM;
  const ang = h => lmAng(Math.max(FIRST_HOUR, Math.min(24, h))) * Math.PI / 180, tg = {};
  if (F.wg) {
    tg.cols = D.map(d => { const x = bd[d]; return lmSkyAt(T.base, x ? x.start + x.hours / 2 : 13); });
    const x = lm.hoverDay && bd[lm.hoverDay];
    if (x) { const i = D.indexOf(lm.hoverDay), hm = x.start + x.hours / 2, t = ang(hm); tg.g = lmSkyAt(T.glow, hm); tg.gp = [WX + COL / 2 + COL * i + Math.cos(t) * WR, WY + Math.sin(t) * WR, 520]; tg.gA = 1; }
    else { tg.g = lm.sky ? lm.sky.g : lmSkyAt(T.glow, 13); tg.gp = lm.sky ? lm.sky.gp : [720, 300, 520]; tg.gA = 0; }
    tg.f = lmSkyAt(T.far, 13); tg.fp = [720, 820, 900]; tg.fA = 0.35; tg.s = lm.sky ? lm.sky.s : lmSkyAt(T.sun, 13);
  } else {
    const b = lmSkyAt(T.base, H), t = ang(H); tg.cols = D.map(() => b);
    tg.g = lmSkyAt(T.glow, H); tg.gp = [CX + Math.cos(t) * R, CY + Math.sin(t) * R, 800]; tg.gA = 1;
    tg.f = lmSkyAt(T.far, H); tg.fp = [CX - Math.cos(t) * R * 1.15, CY + Math.sin(t) * R * 0.6 - 40, 860]; tg.fA = 0.8;
    tg.s = lmSkyAt(T.sun, H);
  }
  if (!lm.sky) lm.sky = JSON.parse(JSON.stringify(tg));
  const e = Stages.still ? 1 : 1 - Math.exp(-dt * 3), L = (a, b) => a + (b - a) * e, LA = (a, b) => a.map((v, i) => L(v, b[i])), k = lm.sky;
  k.cols = k.cols.map((c, i) => LA(c, tg.cols[i])); k.g = LA(k.g, tg.g); k.gp = LA(k.gp, tg.gp); k.gA = L(k.gA, tg.gA); k.f = LA(k.f, tg.f); k.fp = LA(k.fp, tg.fp); k.fA = L(k.fA, tg.fA); k.s = LA(k.s, tg.s);
  const K = lm.k, px = v => Math.round(v) + "px";
  const rgb = c => "rgb(" + c.map(v => Math.round(v)).join(",") + ")", rgba = (c, a) => "rgba(" + c.map(v => Math.round(v)).join(",") + "," + Math.max(0, a).toFixed(3) + ")";
  const rad = (c, a, p, sq) => "radial-gradient(" + px(p[2] * K) + " " + px(p[2] * sq * K) + " at " + px(lm.ox + p[0] * K) + " " + px(lm.oy + p[1] * K) + ", " + rgba(c, a) + " 0%, " + rgba(c, a * 0.5) + " 38%, " + rgba(c, 0) + " 100%)";
  const css = rad(k.g, k.gA, k.gp, 0.78) + ", " + rad(k.f, k.fA, k.fp, 0.7) + ", linear-gradient(90deg, " + k.cols.map((c, i) => rgb(c) + " " + px(lm.ox + (WX + COL / 2 + COL * i) * K)).join(", ") + ")";
  lmTint(k, theme, F.wg ? 13 : H);
  if (css === lm.css) return;
  lm.css = css;
  lmSkyEl.firstChild.style.background = css;
  const hex = "#" + k.cols[3].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  if (hex !== lm.bg) { lm.bg = hex; Stages.root.style.setProperty("--bg", hex); }
  const sun = rgb(k.s);
  if (sun !== lm.sunCol) { lm.sunCol = sun; Stages.root.style.setProperty("--lm-sun", sun); }
}

/**
 * The figure takes the hour's light: the key the glow's hue, the shade the
 * far light's, the key as strong as the hour allows, and its turned edges
 * the ground's colour (AnatomySculpture.setTint). `k` is the eased sky.
 */
function lmTint(k, theme, h) {
  if (typeof figure !== "object" || Stages.current !== "plan") return;
  const P = LM_TINT[theme], lin = c => c.map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  const hue = (c, w) => { const l = lin(c), m = Math.max(...l, 1e-4); return l.map(v => 1 + (v / m - 1) * w); };
  let i = 0; while (i < LM_KEY.length - 2 && h > LM_KEY[i + 1][0]) i++;
  const a = LM_KEY[i], b = LM_KEY[i + 1], t = Math.max(0, Math.min(1, (h - a[0]) / (b[0] - a[0]))), strength = a[1] + (b[1] - a[1]) * t;
  figure.setTint({ key: hue(k.g, P.key).map(v => v * strength), fill: hue(k.f, P.fill), haze: [...lin(k.cols[3]), P.haze] });
}

/* -------------------------------- each frame -------------------------------- */

function lmFrame(now) {
  const dt = Math.min(0.05, (now - (lm.lt || now)) / 1000); lm.lt = now;
  if (planEl.clientWidth !== lm.vw || planEl.clientHeight !== lm.vh) lmFit();
  const F = lm.F; if (!F) return;
  const here = Stages.current === "plan", still = Stages.still;
  if (lm.locked && now - lm.lastWheel > 260) lm.locked = false;
  lm.acc *= Math.exp(-dt * 5);

  // The hour of the light: the one pointed at, else the middle of the day's session.
  const hT = lm.scrubH != null ? lm.scrubH : F.hour;
  lm.hourF = lm.hourF == null || still ? hT : lm.hourF + (hT - lm.hourF) * (1 - Math.exp(-dt * (lm.scrubH != null ? 9 : 2.4)));
  const h = Math.max(FIRST_HOUR, Math.min(24, lm.hourF)), deg = lmAng(h);

  // The now-line stands on the ring at the hour of the light, and follows the pointer.
  const sun = lmArcEl.querySelector("[data-lm-sun]");
  if (sun) {
    sun.setAttribute("transform", "translate(" + LM.CX + " " + LM.CY + ") rotate(" + deg.toFixed(2) + ")");
    const o = F.sun ? "1" : "0"; if (sun.style.opacity !== o) sun.style.opacity = o;
    const on = lm.scrubH != null;
    lm.beadR += ((on ? 6.5 : 4.5) - lm.beadR) * (1 - Math.exp(-dt * 10));
    sun.querySelector("[data-lm-bead]").setAttribute("r", lm.beadR.toFixed(2));
    const p = still ? 0.35 : ((now / 1000) * 0.6) % 1, halo = sun.querySelector("[data-lm-halo]");
    halo.setAttribute("r", (7 + p * 18).toFixed(2)); halo.style.strokeOpacity = ((on ? 0.55 : 0.35) * (1 - p)).toFixed(3);
    const tp = lmArcEl.querySelector("[data-lm-needle-at]");
    if (tp && on) tp.setAttribute("startOffset", Math.max(9, Math.min(91, (h - FIRST_HOUR) / 18 * 100)).toFixed(2) + "%");
  }
  lmSkyFrame(dt);
  const flow = lmArcEl.querySelector("[data-lm-flow]");
  if (flow && !still) flow.setAttribute("patternTransform", "rotate(45) translate(" + ((now / 1000 * 3.2) % 7).toFixed(2) + " 0)");

  // The figure stands on the ring's centre; on the generated week it steps behind the day pointed at, and leaves when nothing is.
  const D = DayOfWeek.values, hi = F.wg && lm.hoverDay ? D.indexOf(lm.hoverDay) : -1;
  const ax = F.wg ? (hi >= 0 ? LM.WX + LM.COL / 2 + LM.COL * hi : lm.aimX) : LM.CX;
  lm.aimX = lm.aimX == null || still ? ax : lm.aimX + (ax - lm.aimX) * (1 - Math.exp(-dt * (F.wg && lm.figOp > 0.05 ? 4.5 : 2.6)));
  if (F.wg && hi >= 0 && lm.figOp < 0.03) lm.aimX = ax;
  const flat = typeof figure !== "object" || !figure.moves;
  const opT = !here || Stages.narrow || flat ? 0 : F.wg ? (hi >= 0 ? (lmDark() ? 0.34 : 0.3) : 0) : 1;
  lm.figOp = still ? opT : lm.figOp + (opT - lm.figOp) * (1 - Math.exp(-dt * 2.2));
  if (Math.abs(lm.figOp - opT) < 0.004) lm.figOp = opT;
  if (here && !flat && !Stages.narrow) {
    figure.setDim(lm.figOp);
    const x = lm.ox + lm.k * lm.aimX, y = lm.oy + lm.k * LM.SOLE, tall = lm.k * LM.TALL;
    // Facing the page, or turned round to the back when that is where the day's muscles are.
    const azT = LM.AZ + (F.behind ? 180 : 0);
    lm.az = lm.az == null || still ? azT : lm.az + (azT - lm.az) * (1 - Math.exp(-dt * 5));
    if (Math.abs(lm.az - azT) < 0.05) lm.az = azT;
    figure.standAt({ x, y, h: tall, az: lm.az });
    // The light comes from where the sun stands on the ring (view space: x right, y up, z toward the eye).
    const th = deg * Math.PI / 180;
    figure.setSun([Math.cos(th), -Math.sin(th) + 0.14, 0.62]);
    // Where the ghost word stands, as Targets' pages say it (holdFigure): the
    // figure's axis, its middle, low at the shins (--gyl), how large the
    // space beside it allows (--gs), how far its legs reach (--gbw).
    const vw = planEl.clientWidth || innerWidth, vh = planEl.clientHeight || innerHeight, sx = x / vw, mid = (y - tall / 2) / vh;
    const ws = [sx.toFixed(4), mid.toFixed(4), (mid + tall / vh * .2).toFixed(4), (2 * Math.min(sx, 1 - sx) * 100 / 3.9).toFixed(2) + "vw", Math.round(tall * .13) + "px"];
    if (ws.join() !== lm.ws) {
      lm.ws = ws.join();
      ["--gx", "--gy", "--gyl", "--gs", "--gbw"].forEach((k, i) => Stages.root.style.setProperty(k, ws[i]));
    }
  }
}

function lmLoop(now) {
  lm.raf = 0;
  if (Stages.current !== "plan") {
    if (!lm.leftAt) lm.leftAt = now;
    if (now - lm.leftAt > 900) {
      lm.leftAt = 0; lm.lt = 0;
      Stages.root.style.removeProperty("--bg"); Stages.root.style.removeProperty("--lm-sun"); lm.bg = ""; lm.css = ""; lm.sunCol = "";
      if (typeof figure === "object") { figure.setSun(null); figure.setTint(null); }
      lm.ws = "";
      return;
    }
  } else lm.leftAt = 0;
  lm.raf = requestAnimationFrame(lmLoop);
  try { lmFrame(now); } catch (e) { if (!lm.err) { lm.err = 1; console.warn("Week plan: " + e.message); } }
}
const lmRun = () => { if (!lm.raf) lm.raf = requestAnimationFrame(lmLoop); };

/* --------------------------------- pointing --------------------------------- */

/** Where a pointer event lands on the plate. */
function lmPlate(e) {
  const r = planEl.getBoundingClientRect();
  return { x: (e.clientX - r.left - lm.ox) / lm.k, y: (e.clientY - r.top - lm.oy) / lm.k };
}
/** A plate point round the ring: its distance, its angle, the hour there, and whether it lies over the ring's half. */
function lmPolar(p) {
  const dx = p.x - LM.CX, dy = p.y - LM.CY, rr = Math.hypot(dx, dy);
  let a = Math.atan2(dy, dx) * 180 / Math.PI; if (a < 0) a += 360; if (a < 90) a += 360;
  return { rr, a, h: Math.max(FIRST_HOUR, Math.min(24, FIRST_HOUR + (a - 180) / 10)), okA: a >= 172 && a <= 368 };
}
/** The week's ring under a point, as a day index, or -1. */
function lmRingAt(q) {
  const i = Math.round((q.rr - 278) / 22);
  return q.okA && i >= 0 && i <= 6 && Math.abs(q.rr - (278 + i * 22)) <= 11 ? i : -1;
}

/** The now-line's words: the hour pointed at, and what it holds; null hides them. */
function lmNeedle(h) {
  const n = lmArcEl.querySelector("[data-lm-needle]"), sl = lmArcEl.querySelector("[data-lm-sesslabel]");
  if (sl) sl.style.opacity = h == null ? "1" : "0";
  if (!n) return;
  if (h == null) { n.style.opacity = "0"; return; }
  n.style.opacity = "1";
  const d = DayOfWeek.values[lm.step], hh = Math.min(LAST_HOUR, Math.floor(h)), mm = Math.min(55, Math.floor((h - hh) * 12) * 5), g = lm.drag;
  let st;
  if (g && g.mode !== "move") { const a = Math.min(g.h0, hh), b = Math.max(g.h0, hh); st = (g.mode === "busy" ? "busy " : "free ") + lmPad(a) + "–" + lmPad(b + 1); }
  else if (routine.offDays.has(d)) st = "day off";
  else {
    const x = lm.byDay[d], meal = (lm.meals[d] || []).find(m => m.hour === hh);
    if (x && hh >= x.start && hh < x.end) st = x.name + (lmDraft() ? "" : " · drag to move");
    else if (isBusy(d, hh)) st = "busy · drag to free";
    else if (meal) st = meal.name.toLowerCase();
    else st = lmDraft() ? "free · drag if busy" : "free";
  }
  n.querySelector("[data-lm-time]").textContent = lmPad(hh) + ":" + lmPad(mm);
  n.querySelector("[data-lm-state]").textContent = st;
}

/** Paints the drag's hours on its day, from where it began to the hour now, and gives back what it has left. */
function lmPaintStroke(h1) {
  const g = lm.drag, [a, b] = [g.h0, h1].sort((x, y) => x - y);
  for (let h = FIRST_HOUR; h <= LAST_HOUR; h++) {
    const want = h >= a && h <= b ? g.mode === "busy" : g.before.has(h);
    if (want && !isBusy(g.d, h)) routine.markBusy(g.d, h);
    else if (!want && isBusy(g.d, h)) routine.clearSlot(g.d, h);
  }
  g.h1 = h1;
}

function lmArcMove(e, hit) {
  if (Stages.current !== "plan" || (e.pointerType === "touch" && !lm.drag)) return;
  const q = lmPolar(lmPlate(e)), D = DayOfWeek.values;
  if (lm.drag) {
    lm.scrubH = q.h; lmNeedle(q.h);
    if (lm.drag.mode === "move") {
      const s = lm.drag.session, st = Math.round(q.h - lm.drag.off);
      if (st !== s.startHour && routine.startsFor(s, s.day).includes(st)) { routine.moveSession(s, s.day, st); renderWeek(); }
      return;
    }
    const h = Math.min(LAST_HOUR, Math.floor(q.h));
    if (h !== lm.drag.h1) { lmPaintStroke(h); renderWeek(); }
    return;
  }
  if (lm.step === 7) {
    const i = lmRingAt(q), d = i >= 0 ? D[i] : null;
    lm.scrubH = d ? q.h : null; lmNeedle(null);
    hit.style.cursor = d ? "pointer" : "default";
    if (d !== lm.hoverDay) { lm.hoverDay = d; renderWeek(); }
    return;
  }
  const on = q.okA && Math.abs(q.rr - LM.R) < 36, near = q.okA && q.rr > 150 && q.rr < LM.R + 120, d = D[lm.step];
  lm.scrubH = near ? q.h : null; lmNeedle(near ? q.h : null);
  let cur = "default";
  if (on) {
    if (lmDraft()) cur = routine.offDays.has(d) ? "not-allowed" : "crosshair";
    else { const x = lm.byDay[d]; cur = x && q.h >= x.start && q.h < x.end ? "grab" : "default"; }
  }
  hit.style.cursor = cur;
}

function lmArcDown(e, hit) {
  if (Stages.current !== "plan" || Stages.busy || e.button !== 0) return;
  const q = lmPolar(lmPlate(e)), D = DayOfWeek.values;
  if (lm.step === 7) { const i = lmRingAt(q); if (i >= 0) lmGoStep(i); return; }
  if (!q.okA || Math.abs(q.rr - LM.R) >= 36) return;
  const d = D[lm.step];
  if (!lmDraft()) {
    const x = lm.byDay[d];
    if (x && q.h >= x.start && q.h < x.end) {
      try { hit.setPointerCapture(e.pointerId); } catch (_) {}
      lm.drag = { mode: "move", session: x.session, off: q.h - x.start };
      hit.style.cursor = "grabbing";
    }
    return;
  }
  if (routine.offDays.has(d)) return;
  try { hit.setPointerCapture(e.pointerId); } catch (_) {}
  const h = Math.min(LAST_HOUR, Math.floor(q.h)), before = new Set();
  for (let k = FIRST_HOUR; k <= LAST_HOUR; k++) if (isBusy(d, k)) before.add(k);
  lm.drag = { d, h0: h, h1: null, mode: isBusy(d, h) ? "free" : "busy", before };
  lm.scrubH = q.h;
  lmPaintStroke(h);
  renderWeek();
}

function lmArcUp() {
  const g = lm.drag; if (!g) return;
  lm.drag = null;
  if (g.mode === "move") { render(); return; }
  afterWeekChange();
}

function lmArcLeave() {
  if (lm.drag) return;
  lm.scrubH = null; lmNeedle(null);
  if (lm.hoverDay && lm.step === 7 && lmDraft()) { lm.hoverDay = null; renderWeek(); }
}

const lmHit = () => lmStage.querySelector("[data-lm-hit]");
lmStage.addEventListener("pointermove", e => { if (lm.drag || e.target.closest("[data-lm-hit]")) lmArcMove(e, lmHit()); });
lmStage.addEventListener("pointerdown", e => { if (e.target.closest("[data-lm-hit]")) lmArcDown(e, lmHit()); });
lmStage.addEventListener("pointerup", lmArcUp);
lmStage.addEventListener("pointercancel", lmArcUp);
lmStage.addEventListener("pointerout", e => { if (e.target.closest("[data-lm-hit]") && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest("[data-lm-hit]"))) lmArcLeave(); });

/* What the pointer or the keyboard rests on: a muscle, a key of the arc, a chooser's option, a day to move to, a day of the week. */
function lmPoint(e) {
  const to = e.type === "pointerout" || e.type === "focusout" ? e.relatedTarget : e.target;
  const el = to && to.closest && weekEl.contains(to) ? to : null;
  const pick = (sel, attr) => { const x = el && el.closest(sel); return x ? x.getAttribute(attr) : null; };
  const muscle = pick("[data-lm-muscle]", "data-lm-muscle"), key = pick("[data-lm-key]", "data-lm-key");
  const opt = pick("[data-lm-opt]", "data-lm-opt"), move = pick("[data-lm-move]", "data-lm-move"), col = pick("[data-lm-col]", "data-lm-col");
  const preview = opt ? { key: opt.split(":")[0], value: lmValue(opt.split(":")[0], opt.split(":").slice(1).join(":")) } : null;
  const wg = lm.step === 7 && !lmDraft();
  const hoverDay = wg ? col : lm.hoverDay;
  const same = muscle === lm.hoverMuscle && key === lm.keyHot && move === lm.moveHover && hoverDay === lm.hoverDay &&
    JSON.stringify(preview) === JSON.stringify(lm.preview);
  if (same) return;
  // Leaving a chooser's options keeps the chooser open, but stops the preview.
  lm.hoverMuscle = muscle; lm.keyHot = key; lm.moveHover = move; lm.hoverDay = hoverDay; lm.preview = preview;
  renderWeek();
}
for (const type of ["pointerover", "pointerout", "focusin", "focusout"]) weekEl.addEventListener(type, lmPoint);

/** A chooser's value as the routine keeps it: a number of days or minutes, else the word. */
const lmValue = (k, v) => k === "days" || k === "len" ? Number(v) : v;

/* --------------------------------- changes ---------------------------------- */

/** After a change to the hours, the days or the terms: redraw, save, and say what a generated week lost. */
function afterWeekChange() {
  render();
  weekEdited() || warnIfStale();
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

/** Gives the days `targets` the hours and the day off of `src`. */
function lmCopy(src, targets) {
  for (const t of targets) {
    if (routine.offDays.has(src) !== routine.offDays.has(t)) routine.setDayUnavailable(t, routine.offDays.has(src));
    for (let h = FIRST_HOUR; h <= LAST_HOUR; h++) {
      if (isBusy(src, h) && !isBusy(t, h)) routine.markBusy(t, h);
      else if (!isBusy(src, h) && isBusy(t, h)) routine.clearSlot(t, h);
    }
  }
}

/** Goes to step `i`: a day (0–6) or the week (7). */
function lmGoStep(i) {
  i = Math.max(0, Math.min(7, i));
  if (i === lm.step) return;
  lm.step = i; lm.notes = false; lm.chooser = null; lm.preview = null; lm.hoverDay = null; lm.hoverMuscle = null; lm.moveHover = null; lm.keyHot = null;
  renderWeek();
  Stages.remember();
  announce(i === 7 ? "The week" : DayOfWeek.name[DayOfWeek.values[i]]);
  const h = $("plan-title");
  if (h && weekEl.contains(document.activeElement) && !document.activeElement.isConnected) h.focus({ preventScroll: true });
}

/** Generates the week; one with sessions shows on the week's step, one without stays here with the reason. */
function generate() {
  const r = generateWeek();
  lm.status = { text: r.text, kind: r.kind };
  lm.editing = !r.placed && lm.editing;
  lm.hoverDay = null; lm.chooser = null; lm.preview = null;
  lm.step = 7;
  renderWeek();
  announce(r.text);
}

weekEl.addEventListener("click", e => {
  const b = e.target.closest("[data-lm]");
  if (!b || b.disabled || Stages.busy) return;
  const act = b.dataset.lm, D = DayOfWeek.values, d = D[lm.step];
  const session = !lmDraft() && lm.byDay[d] ? lm.byDay[d].session : null;
  switch (act) {
    case "off": routine.setDayUnavailable(d, !routine.offDays.has(d)); afterWeekChange(); break;
    case "copy": lmCopy(d === "MON" ? "MON" : lmPrevDay(d), d === "MON" ? ["TUE", "WED", "THU", "FRI"] : [d]); afterWeekChange(); break;
    case "clear": for (const [a, z] of busyRuns(d)) for (let h = a; h < z; h++) routine.clearSlot(d, h); afterWeekChange(); break;
    case "chooser": lm.chooser = lm.chooser === b.dataset.k ? null : b.dataset.k; lm.preview = null; renderWeek(); break;
    case "pick": {
      const k = b.dataset.k;
      routine[LM_TERMS[k]] = lmValue(k, b.dataset.v);
      lm.chooser = null; lm.preview = null;
      afterWeekChange();
      announce(b.textContent.trim());
      break;
    }
    case "preset": fillBusy(b.dataset.k); afterWeekChange(); break;
    case "hour": {
      const h = Number(b.dataset.h);
      if (isBusy(d, h)) routine.clearSlot(d, h); else routine.markBusy(d, h);
      afterWeekChange();
      announce(hourRange(h, h + 1) + (isBusy(d, h) ? " busy" : " free"));
      break;
    }
    case "meals": routine.nutrition.showMeals = !routine.nutrition.showMeals; afterWeekChange(); break;
    case "return": lm.editing = false; renderWeek(); break;
    case "notes": lm.notes = !lm.notes; renderWeek(); break;
    case "edit-hours": lm.editing = true; renderWeek(); break;
    case "remove":
      if (session) { routine.removeSession(session); lm.moveHover = null; render(); weekEdited() || warnIfStale(); }
      break;
    case "swap": {
      const w = session && session.workout, entry = w && w.entries[Number(b.dataset.i)];
      if (!entry) break;
      const pool = exercisesFor(entry.muscleId).filter(ex => ex === entry.exercise || !w.has(ex));
      const next = pool[(pool.indexOf(entry.exercise) + 1) % pool.length];
      if (next && next !== entry.exercise) { w.replace(entry, next); render(); announce(entry.exercise.name + " swapped for " + next.name); }
      break;
    }
    case "move": {
      const to = b.dataset.d;
      if (!session || to === session.day || lmWhyNot(session, to)) break;
      if (routine.moveSession(session, to)) { lm.step = D.indexOf(to); lm.moveHover = null; render(); Stages.remember(); announce("Moved to " + DayOfWeek.name[to]); }
      break;
    }
    case "open": lmGoStep(Number(b.dataset.i)); break;
  }
});
lmFoot.addEventListener("click", e => { const b = e.target.closest('[data-lm="step"]'); if (b && !Stages.busy) lmGoStep(Number(b.dataset.i)); });

/* The wheel walks the week a step a gesture, and leaves the stage before Monday. */
weekEl.addEventListener("wheel", e => {
  if (Stages.current !== "plan" || Stages.busy || Stages.narrow || lm.chooser || lm.drag || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  const now = performance.now(), dir = Math.sign(e.deltaY);
  if (!dir) return;
  if (lm.locked) { lm.lastWheel = now; return; }
  if ((lm.step === 0 && dir < 0) || (lm.step === 7 && dir > 0)) {
    if (now - lm.lastWheel > STAGE_WHEEL.gap || Math.sign(lm.edge) !== dir) lm.edge = 0;
    lm.lastWheel = now;
    lm.edge += e.deltaY;
    if (dir < 0 && Math.abs(lm.edge) > STAGE_WHEEL.threshold) { lm.edge = 0; lm.locked = true; Stages.wheelAt = now; Stages.spent = true; Stages.back(); }
    return;
  }
  lm.edge = 0;
  if (Math.sign(lm.acc) !== dir) lm.acc = 0;
  lm.acc += e.deltaY;
  if (Math.abs(lm.acc) > 46) { lmGoStep(lm.step + dir); lm.acc = 0; lm.locked = true; lm.lastWheel = now; }
}, { passive: true });

addEventListener("keydown", e => {
  if (Stages.current !== "plan" || Stages.busy || Stages.opening || Stages.narrow || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target, tag = (t && t.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t.closest && t.closest(".masthead"))) return;
  if (e.key === "Escape") { if (lm.chooser || lm.notes) { lm.chooser = null; lm.preview = null; lm.notes = false; renderWeek(); } return; }
  if (["ArrowDown", "ArrowRight", "PageDown"].includes(e.key)) { e.preventDefault(); lmGoStep(lm.step + 1); }
  else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); lmGoStep(lm.step - 1); }
});

/* --------------------------------- the stage -------------------------------- */

Stages.register("plan", {
  arrive() {
    const at = /^s(\d)$/.exec(Stages.at || "");
    lm.step = at ? Math.min(7, Number(at[1])) : routine.sessions.length ? 7 : Stages.from === "nutrition" || Stages.from === null ? 0 : lm.step;
    lm.editing = false; lm.hoverDay = null; lm.hoverMuscle = null; lm.keyHot = null; lm.chooser = null; lm.preview = null;
    lm.moveHover = null; lm.drag = null; lm.scrubH = null; lm.hourF = null; lm.aimX = null; lm.az = null; lm.figOp = 0;
    if (lm.status && lm.status.kind !== "err" && !routine.sessions.length) lm.status = null;
  },
  enter() { lmFit(); renderWeek(); lmRun(); },
  place: () => "s" + lm.step,
  shot: () => Stages.narrow ? "plan" : "plan-ring",
  dim: () => Stages.narrow ? 0 : lm.figOp,
  // The day's muscles as Targets marks a selection; the one pointed at in the list, as one pointed at there.
  highlight: () => lm.F && lm.F.ids.length ? { ids: lm.F.ids, selected: true, pointed: lm.F.pointed } : null,
  footer() {
    const s = lm.step, name = i => i === 7 ? "The week" : DayOfWeek.name[DayOfWeek.values[i]];
    return {
      back: s === 0 ? "Nutrition" : name(s - 1),
      next: s < 7 ? name(s + 1) : lmDraft() ? (routine.sessions.length ? "Generate again" : "Generate my week") : "Adjust plan",
      hint: s < 7 ? "or scroll" : ""
    };
  },
  onNext() {
    if (lm.step < 7) lmGoStep(lm.step + 1);
    else if (lmDraft()) generate();
    else { lm.editing = true; lm.hoverDay = null; renderWeek(); }
    return true;
  },
  onBack() { if (lm.step > 0) { lmGoStep(lm.step - 1); return true; } },
  wheel: () => Stages.narrow,
  focus: () => $("plan-title")
});

/* A resize refits the plate. */
addEventListener("resize", () => { if (Stages.current === "plan") { lmFit(); renderWeek(); } });
