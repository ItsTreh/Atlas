/* ===========================================================================
   A session, in full — what the generated week's session panel shows.

   A training day shows its day and time (each a picker that moves it), its
   muscles and their sets, its exercises grouped by muscle (sets × reps,
   rest, movement, what else they train), when each muscle is next trained,
   and the meals around it. The user can move or remove the session and
   swap, drop or add exercises. Every change goes through the routine or the
   session's Workout (routine.js, workouts.js); this file only draws them and
   turns clicks into those calls. week-view.js places the panel: beside the
   calendar on a desktop, under the day in the phone's agenda.

   Also here: what the week as a whole is missing (leftOutText, volumeNote),
   which the generated week shows under its summary.
   ========================================================================= */

const TIER_CSS = { "S+": "splus", "S": "s", "A+": "aplus", "A": "a" };
const tierBadge = label =>
  '<span class="tier tier-' + (TIER_CSS[label] || "none") + '" title="' +
  (label ? "Tier " + label : "Not rated for this muscle") + '">' + (label || "–") + '</span>';

const byWeekOrder = (a, b) =>
  DayOfWeek.indexOf(a.day) - DayOfWeek.indexOf(b.day) || a.startHour - b.startHour;

const DAY_NAME = DayOfWeek.name;
const nameList = names => names.length < 2 ? names.join("")
  : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
const fmtSets = n => (n % 1 ? n.toFixed(1) : String(n));

/** A session's short name: its split day ("Upper"), else the families it trains ("Push + Pull"). */
function blockName(block) {
  if (block.name) return block.name;
  const worked = block.muscles.filter(m => !block.riders.has(m));
  const fams = Object.keys(FAMILIES).filter(f => (worked.length ? worked : block.muscles).some(m => m.family === f));
  if (["push", "pull", "legs"].every(f => fams.includes(f))) return "Full body";
  return fams.map(f => FAMILIES[f].name).join(" + ");
}
/** The families a block works, in catalogue order. */
const blockFamilies = block => Object.keys(FAMILIES).filter(f =>
  block.muscles.some(m => m.family === f && !block.riders.has(m)));
const familyDots = fams => fams.map(f => '<span class="fdot" style="background:var(--' + FAMILIES[f].css + ')"></span>').join("");

/* ------------------------------- the panel -------------------------------- */

/** Everything about one session, for the panel (or, with `inline`, the phone's agenda). */
function sessionDetailHTML(session, inline = false) {
  const w = session.workout;
  const muscles = session.block.muscles.filter(m => !session.block.riders.has(m));
  const notes = editNote(session) + lengthNote(session) + recoveryNote(session) + fuelNote(session);
  return '<div class="sd" data-session="' + session.id + '">' +
    (inline ? '' :
      '<div class="sd-head">' +
        '<div class="sd-title">' +
          '<span class="sd-when">' + moveControls(session) + '</span>' +
          '<span class="sd-name">' + esc(blockName(session.block)) + '</span>' +
        '</div>' +
        '<button type="button" class="close-x" data-act="close" data-key="close-' + session.id + '" aria-label="Close">×</button>' +
      '</div>') +
    (inline ? '<span class="sd-when">' + moveControls(session) + '</span>' : '') +
    '<div class="sd-meta">' + w.entries.length + (w.entries.length === 1 ? ' exercise · ' : ' exercises · ') +
      w.sets + ' sets · ≈ ' + w.minutes + ' min' +
      (w.edited ? ' · <button type="button" class="text-link" data-act="restore" data-key="restore-' + session.id +
        '" aria-label="Restore suggested exercises for ' + DAY_NAME[session.day] + '">Restore suggestions</button>' : '') +
      ' · <button type="button" class="text-link" data-act="drop" data-key="drop-' + session.id +
        '" aria-label="Remove ' + DAY_NAME[session.day] + '\'s session">Remove session</button>' +
    '</div>' +
    '<div class="sd-muscles">' + muscles.map(m => {
      const direct = w.directSets(m.id), assisted = w.assistedSets(m.id);
      return '<span class="sd-m"><span class="fdot" style="background:var(--' + FAMILIES[m.family].css + ')"></span>' +
        esc(m.name) + ' <span class="faint">' + (direct ? direct + " sets" : "") +
        (assisted ? (direct ? " + " : "") + "≈" + fmtSets(assisted) + " assisting" : "") + '</span></span>';
    }).join("") + '</div>' +
    (notes ? '<div class="sd-notes">' + notes + '</div>' : '') +
    w.muscles.map(m => muscleHTML(session, w, m)).join("") +
    '<div class="tier-key">' + TIERS.map(tierBadge).join('<span class="gt">›</span>') +
      '<span class="tk-label">exercise tier</span></div>' +
  '</div>';
}

/**
 * A split day gets the best dose for its muscles, not the longest workout
 * the time allows (WorkoutBuilder.doseSets), so it can end well inside the
 * length the user chose. Saying so is part of the plan: the time left is a
 * choice, not a gap.
 */
/**
 * What the user's own edits did that the planner never would: a session
 * longer than its time on the calendar, or a muscle past its usual weekly
 * maximum (MUSCLES weeklySets, the safety limit the planner keeps to).
 */
function editNote(session) {
  const w = session.workout;
  if (!w.edited) return "";
  const notes = [];
  const booked = Math.min(routine.sessionMinutes, session.durationHours * 60);
  if (w.minutes > booked)
    notes.push("about " + w.minutes + " min now, longer than the " + booked + " min it has on your calendar");
  const over = w.muscles.filter(m => weekSets(m) > m.weeklySets[1]);
  if (over.length)
    notes.push(nameList(over.map(m => m.name + " (≈" + fmtSets(weekSets(m)) + " of at most " + m.weeklySets[1] + ")")) +
      " above the usual weekly maximum");
  return notes.length ? '<span class="warn"><b>Your edits:</b> ' + notes.join("; ") + '.</span>' : "";
}

function lengthNote(session) {
  const w = session.workout, limit = session.block.limit;
  if (!session.block.splitDay || w.skipped.length || w.minutes > limit - 5) return "";
  return '<span><b>Length:</b> finishes in about ' + w.minutes + ' of your ' + limit +
    ' min; more sets here would likely add more fatigue than results.</span>';
}

/**
 * The day and time of a session as two pickers. Days it cannot move to are
 * listed but disabled, with the reason; times are the starts that fit.
 */
function moveControls(session) {
  const days = DayOfWeek.values.map(day => {
    const why = day === session.day ? null : routine.moveBlocker(session, day);
    const note = !why ? "" : why.kind === "off" ? " — day off"
      : why.kind === "taken" ? " — has a session"
      : why.kind === "no-room" ? " — no free time"
      : " — " + why.muscle.name.toLowerCase() + " still recovering";
    return '<option value="' + day + '"' + (day === session.day ? " selected" : "") +
      (why ? " disabled" : "") + '>' + DAY_NAME[day] + note + '</option>';
  }).join("");
  const times = routine.startsFor(session, session.day).map(h =>
    '<option value="' + h + '"' + (h === session.startHour ? " selected" : "") + '>' +
      hourLabel(h) + '–' + hourLabel(h + session.durationHours) + '</option>').join("");
  return '<span class="picker caret"><span class="picker-label" aria-hidden="true">' +
      DAY_NAME[session.day] + '</span><select data-act="move-day" data-key="day-' + session.id +
      '" aria-label="Day of ' + esc(session.block.label) + ' session">' + days + '</select></span>' +
    '<span class="picker caret"><span class="picker-label" aria-hidden="true">' +
      hourLabel(session.startHour) + '–' + hourLabel(session.endHour()) + '</span>' +
      '<select data-act="move-time" data-key="time-' + session.id + '" aria-label="Time of ' +
      esc(session.block.label) + ' session">' + times + '</select></span>';
}

/** When each trained muscle comes round again, grouped by day. */
function recoveryNote(session) {
  const byDay = new Map();
  for (const m of session.block.muscles) {
    if (session.block.riders.has(m)) continue;
    const next = routine.nextTraining(session, m);
    const key = next ? next.day : null;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(m.name);
  }
  const parts = [...byDay].map(([day, names]) => day
    ? nameList(names) + ' again ' + DAY_NAME[day] + ' (' +
      ((DayOfWeek.indexOf(day) - DayOfWeek.indexOf(session.day) + 7) % 7 || 7) + ' days)'
    : nameList(names) + ' once this week');
  // Riders get no work of their own, so they set no rest.
  const worked = session.block.muscles.filter(m => !session.block.riders.has(m));
  if (!worked.length) return "";
  const need = Math.max(...worked.map(m => m.recoveryDays));
  const one = worked.length === 1;
  return '<span><b>Recovery:</b> ' + parts.join(' · ') + '. Give ' + (one ? 'it' : 'these muscles') +
    ' at least ' + need + (need === 1 ? ' day' : ' days') + ' before training ' +
    (one ? 'it' : 'them') + ' again.</span>';
}

/** The meals either side of the session that day, if meals are on the calendar. */
function fuelNote(session) {
  const meals = routine.plannedMeals.filter(m => m.day === session.day)
    .sort((a, b) => a.hour - b.hour);
  if (!meals.length) return "";
  const before = meals.filter(m => m.hour < session.startHour).pop();
  const after = meals.find(m => m.hour >= session.endHour());
  const gap = (h, side) => h === 0 ? "right " + side
    : h + (h === 1 ? " hour " : " hours ") + side;
  const parts = [];
  if (before) parts.push(esc(before.name) + ' at ' + hourLabel(before.hour) + ', ' +
    gap(session.startHour - before.hour - 1, "before") + ' (≈ ' + before.kcal + ' kcal)');
  if (after) parts.push(esc(after.name) + ' at ' + hourLabel(after.hour) + ', ' +
    gap(after.hour - session.endHour(), "after") + ' · ' + after.protein + ' g protein');
  return parts.length ? '<span><b>Fuel:</b> ' + parts.join(' · ') + '.</span>' : "";
}

/** A day with no session, in words: a day off, or a rest day and what is recovering on it. */
function restDayText(day) {
  if (routine.isDayUnavailable(day)) return "Day off — no training";
  const recovering = routine.recoveringOn(day);
  return "Rest day" + (recovering.length ? " — " + nameList(recovering.map(m => m.name)) + " recovering" : "");
}

/**
 * Where a muscle that got no exercise in one session is dealt with, so that
 * what the session points to is true: the note under Your week names only
 * muscles with no time or under their weekly minimum.
 */
function skippedWhere(muscle) {
  const v = routine.weeklyVolume();
  if (v.noTime.includes(muscle) || v.short.some(r => r.muscle === muscle))
    return "it is named in the note under Your week, or add an exercise yourself.";
  const row = v.rows.find(r => r.muscle === muscle);
  return row && row.times
    ? "it gets ≈" + fmtSets(row.sets) + " sets in " + (row.times === 1 ? "another session" :
      row.times + " other sessions") + " this week, enough for its usual minimum. Add an exercise " +
      "yourself if you want more."
    : "add an exercise yourself.";
}

/** A muscle's sets over the whole week, direct and assisting. */
const weekSets = muscle => routine.sessions.reduce((t, s) =>
  t + (s.workout ? s.workout.directSets(muscle.id) + s.workout.assistedSets(muscle.id) : 0), 0);

function muscleHTML(session, w, muscle) {
  const entries = w.entriesFor(muscle.id);
  const pool = exercisesFor(muscle.id);
  const direct = w.directSets(muscle.id), assisted = w.assistedSets(muscle.id);

  let body;
  if (!pool.length) {
    body = '<p class="wm-empty">No ' + esc(muscle.name.toLowerCase()) + ' exercises in the ' +
           'database yet' + (assisted ? ' — it gets assisting work from the lifts above.' : '.') + '</p>';
  } else {
    const noRoom = entries.length ? ''
      : w.skipped.includes(muscle) && direct + assisted > 0
      ? '<p class="wm-empty">No time left here for an exercise of its own; it gets ≈' +
        fmtSets(direct + assisted) + ' sets from the lifts above.</p>'
      : w.skipped.includes(muscle)
      ? '<p class="wm-empty">No time left in this session for ' + esc(muscle.name.toLowerCase()) +
        ' — ' + skippedWhere(muscle) + '</p>'
      : session.block.splitDay && direct + assisted > 0
      ? '<p class="wm-empty">Covered by the lifts above: an exercise of its own here would ' +
        'add more than it needs this week.</p>'
      : w.recommended.some(e => e.muscleId === muscle.id)
      ? '<p class="wm-empty">You took out its exercises here. Add one below, or restore the suggestions.</p>'
      : weekSets(muscle) > 0
      ? '<p class="wm-empty">Trained in your other sessions this week (≈' + fmtSets(weekSets(muscle)) +
        ' sets in all), so no exercise of its own here.</p>' : '';
    body = noRoom + '<ul class="wm-list">' + entries.map(e => entryHTML(session, w, e)).join("") + '</ul>' +
      exerciseSelect(w, muscle.id, null, session.id);
  }

  return '<section class="wm">' +
    '<div class="wm-head"><span class="fdot" style="background:var(--' +
      FAMILIES[muscle.family].css + ')"></span><b>' + esc(muscle.name) + '</b>' +
      '<span class="wm-sets">' + (direct ? direct + (direct === 1 ? " set" : " sets") : "") +
      (assisted ? (direct ? " + " : "") + "≈" + fmtSets(assisted) + " assisting" : "") + '</span></div>' +
    body + '</section>';
}

function entryHTML(session, w, entry) {
  const i = w.entries.indexOf(entry);
  const ex = entry.exercise;
  const clash = w.clashWith(ex, entry);
  const also = [...ex.primary, ...ex.secondary].filter(id => id !== entry.muscleId)
    .map(id => MUSCLE_BY_ID.get(id).name);
  return '<li class="ex' + (entry.manual ? ' manual' : '') + '">' +
    tierBadge(entry.tier) +
    '<div class="ex-main">' +
      exerciseSelect(w, entry.muscleId, entry, session.id, i) +
      '<div class="ex-sub">' + entry.kind.label + ' · rest ' + entry.rest + ' · ' + MOVEMENTS[ex.movement] +
        (also.length ? ' · also ' + also.join(", ") : '') +
        (entry.manual ? ' · <i>your pick</i>' : '') +
        (clash ? ' · <span class="clash">same movement as ' + esc(clash.exercise.name) + '</span>' : '') +
      '</div>' +
    '</div>' +
    '<span class="ex-sets" title="' + entry.sets + ' sets of ' + entry.reps + ' reps">' +
      entry.sets + ' × ' + entry.reps + '</span>' +
    '<button type="button" class="row-x" data-act="remove" data-entry="' + i + '" ' +
      'data-key="rm-' + session.id + '-' + i + '" aria-label="Remove ' + esc(ex.name) + '">×</button>' +
  '</li>';
}

/**
 * The picker for one slot. With an entry it swaps that entry's exercise and
 * shows its name; without one it is the "Add exercise" menu. Options are the
 * muscle's exercises grouped by tier, flagged when they would repeat a
 * movement already in the session.
 */
function exerciseSelect(w, muscleId, entry, sessionId, index) {
  const pool = exercisesFor(muscleId).filter(ex =>
    entry ? ex === entry.exercise || !w.has(ex) : !w.has(ex));
  if (!entry && !pool.length) return "";

  const groups = [...TIERS, null].map(tier => {
    const list = pool.filter(ex => ex.tierFor(muscleId) === tier);
    if (!list.length) return "";
    return '<optgroup label="' + (tier ? "Tier " + tier : "Unrated") + '">' +
      list.map(ex => {
        const clash = ex !== (entry && entry.exercise) && w.clashWith(ex, entry);
        return '<option value="' + ex.id + '"' + (entry && ex === entry.exercise ? " selected" : "") + '>' +
          esc(ex.name) + (clash ? " (same movement as " + esc(clash.exercise.name) + ")" : "") +
          '</option>';
      }).join("") + '</optgroup>';
  }).join("");

  // A native select is as wide as its longest option, so the visible part is
  // a label and the select sits invisibly on top of it: still a real,
  // keyboard- and screen-reader-friendly select, but only as wide as the name.
  const name = MUSCLE_BY_ID.get(muscleId).name;
  return entry
    ? '<span class="picker caret ex-pick"><span class="picker-label" aria-hidden="true">' +
        esc(entry.exercise.name) + '</span>' +
        '<select data-act="replace" data-entry="' + index + '" ' +
        'data-key="pick-' + sessionId + '-' + index + '" ' +
        'aria-label="' + esc(name) + ' exercise: ' + esc(entry.exercise.name) + '. Choose another to replace it">' +
        groups + '</select></span>'
    : '<span class="picker ex-add"><span class="picker-label" aria-hidden="true">+ Add ' +
        esc(name.toLowerCase()) + ' exercise</span>' +
        '<select data-act="add" data-muscle="' + muscleId + '" ' +
        'data-key="add-' + sessionId + '-' + muscleId + '" aria-label="Add a ' + esc(name) + ' exercise">' +
        '<option value="">Choose an exercise…</option>' + groups + '</select></span>';
}

/* --------------------------- what the week misses -------------------------- */

/**
 * What the last generate() left without a day, and why, or "": the blocks no
 * session carries. Plain text; the caller escapes it. Generating again does
 * not change this, so it names what would: a day more, or a smaller split.
 */
function leftOutText() {
  const out = routine.leftOut || [];
  if (!out.length) return "";
  const names = out.map(b => (b.name || "Some muscles") + " (" +
    nameList(b.muscles.filter(m => !b.riders.has(m)).map(m => m.name)) + ")");
  const days = routine.sessions.length, split = SPLITS[routine.split];
  const wanted = new Set(routine.sessions.map(s => s.block)).size + out.length;
  const why = split.days && wanted > days
    ? split.label + " has " + wanted + " days and this week has " + days + " training " +
      (days === 1 ? "day" : "days") + ". Add a training day, or choose a split with fewer days."
    : "No free gap fit it, or its muscles were still inside a recovery window.";
  return "No day this week for " + nameList(names) + ". " + why;
}

/* At most this many names in a volume note before "and N more". */
const VOLUME_NOTE_NAMES = 4;
const someNames = names => names.length <= VOLUME_NOTE_NAMES ? nameList(names)
  : names.slice(0, VOLUME_NOTE_NAMES).join(", ") + " and " + (names.length - VOLUME_NOTE_NAMES) + " more";

/**
 * How the week compares with what the chosen muscles usually need
 * (WeeklyRoutine.weeklyVolume). Muscles left without direct work, or under
 * the low end of their weekly sets, are a warning. Silent when the week meets
 * the estimate. Plain text.
 */
function volumeNote(sessions, v = routine.weeklyVolume()) {
  // Muscles with no session at all are named elsewhere (leftOutText, or a
  // removed session); this note is about the sessions the week does have.
  // Exercises the user took out are theirs to put back, not a lack of time.
  const removed = v.removed.length ? "You took out every exercise for " + nameList(v.removed.map(m => m.name)) +
    ": add one back in its session, or restore the suggestions." : "";
  if (!v.noTime.length && !v.short.length) return removed;
  const parts = removed ? [removed] : [];
  if (v.noTime.length)
    parts.push("No time this week for " + nameList(v.noTime.map(m => m.name)) + ".");
  if (v.short.length)
    parts.push("Under their usual weekly minimum: " +
      someNames(v.short.map(r => r.muscle.name + " (" + fmtSets(r.sets) + " of " + r.need + " sets)")) + ".");
  const e = v.estimate;
  if (e && sessions.length < e.sessions.low)
    parts.push("Your targets usually take " + e.sessions.low + "–" + e.sessions.high + " sessions of " +
      e.sessionMinutes + " min a week; this plan has " + sessions.length + ".");
  // Only the ways out this week really has: a day more is tried on a copy
  // (extraDayFits), and a longer session needs a longer option to pick.
  const ways = [];
  if (routine.extraDayFits()) ways.push("add a training day");
  if (routine.sessionMinutes < Math.max(...SESSION_LENGTH_OPTIONS)) ways.push("lengthen sessions");
  ways.push("pick fewer muscles");
  parts.push("To close the gap, " + (ways.length < 2 ? ways[0]
    : ways.slice(0, -1).join(", ") + " or " + ways[ways.length - 1]) + ".");
  return (removed ? parts.shift() + " " : "") + "Below what your targets usually need. " + parts.join(" ");
}

/** Every gap the generated week has, as plain sentences, for the notes under its summary. */
function weekGaps() {
  const sessions = [...routine.sessions].sort(byWeekOrder);
  if (!sessions.length) return [];
  const v = routine.weeklyVolume();
  // Muscles no session carries at all. Those of a block the plan could not
  // give a day are explained by leftOutText(), and those chosen after the
  // week was generated by the stale-week note; the rest lost their session
  // to the user, and generating again does fit them back in.
  const leftIds = new Set((routine.leftOut || []).flatMap(b => b.muscles.map(m => m.id)));
  const missing = v.unplanned.filter(m => !leftIds.has(m.id) && routine.plannedFor.has(m.id)).map(m => m.name);
  return [
    leftOutText(),
    missing.length ? "Not trained this week: " + nameList(missing) + " — " +
      (missing.length === 1 ? "its session was" : "their sessions were") + " removed. Generate again to fit " +
      (missing.length === 1 ? "it" : "them") + " back in." : "",
    volumeNote(sessions, v)
  ].filter(Boolean);
}

/* ------------------------------- editing --------------------------------- */

function sessionOf(el) {
  const box = el.closest("[data-session]");
  return box && routine.sessions.find(s => s.id === Number(box.dataset.session));
}

/** Redraws the week after an edit and keeps keyboard focus on the same control. */
function afterEdit(key) {
  render();
  const again = key && document.querySelector('#stage-plan [data-key="' + key + '"]');
  if (again) again.focus({ preventScroll: true });
}

$("stage-plan").addEventListener("change", e => {
  const el = e.target;
  if (!el.dataset.act) return;
  const session = sessionOf(el);
  if (!session || !el.value) return;
  if (el.dataset.act === "move-day" || el.dataset.act === "move-time") {
    // A new day keeps the start time where it fits, else the nearest that does.
    if (el.dataset.act === "move-day") routine.moveSession(session, el.value);
    else routine.moveSession(session, session.day, Number(el.value));
    afterEdit(el.dataset.key);
    return;
  }
  const w = session.workout, ex = EXERCISE_BY_ID.get(el.value);
  if (el.dataset.act === "replace") w.replace(w.entries[Number(el.dataset.entry)], ex);
  else if (el.dataset.act === "add") w.add(el.dataset.muscle, ex);
  afterEdit(el.dataset.key);
});

$("stage-plan").addEventListener("click", e => {
  const el = e.target.closest("button[data-act]");
  const session = el && sessionOf(el);
  if (!session) return;
  const w = session.workout;
  if (el.dataset.act === "remove") {
    const i = Number(el.dataset.entry);
    w.remove(w.entries[i]);
    // Keep focus nearby: the next row's ×, else this session's add menu.
    afterEdit("rm-" + session.id + "-" + i);
    const box = document.querySelector('#stage-plan [data-session="' + session.id + '"]');
    if (box && !box.contains(document.activeElement)) {
      const add = box.querySelector(".ex-add select");
      if (add) add.focus({ preventScroll: true });
    }
  } else if (el.dataset.act === "restore") {
    w.restore();
    // The link goes once there is nothing to restore; stay in this session.
    afterEdit("day-" + session.id);
  } else if (el.dataset.act === "drop") {
    routine.removeSession(session);
    weekEdited() || warnIfStale();
    closeSession();
  } else if (el.dataset.act === "close") {
    closeSession();
  }
});
