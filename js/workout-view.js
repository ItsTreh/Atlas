/* ===========================================================================
   Your week — the final plan, Monday to Sunday.

   A training day shows its time, focus, exercises (sets × reps, rest),
   duration, when each muscle is next trained, and the meals around the
   session. A rest day says what is recovering; a day off says so. The user
   can move or remove a session and swap, drop or add exercises. Every change
   goes through the routine or the session's Workout (routine.js,
   workouts.js); this file only draws them and turns clicks into those calls.
   ========================================================================= */

const workoutsEl = $("workouts");

const TIER_CSS = { "S+": "splus", "S": "s", "A+": "aplus", "A": "a" };
const tierBadge = label =>
  '<span class="tier tier-' + (TIER_CSS[label] || "none") + '" title="' +
  (label ? "Tier " + label : "Not rated for this muscle") + '">' + (label || "–") + '</span>';

const byWeekOrder = (a, b) =>
  DayOfWeek.indexOf(a.day) - DayOfWeek.indexOf(b.day) || a.startHour - b.startHour;

const DAY_NAME = DayOfWeek.name;
const nameList = names => names.length < 2 ? names.join("")
  : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];

function renderWorkouts() {
  const sessions = [...routine.sessions].sort(byWeekOrder);
  if (!sessions.length) {
    workoutsEl.innerHTML = '<h3>Your week</h3><p class="empty-nutri">Generate your plan ' +
      'to see each day: the session, its exercises, rest days and meals.</p>';
    return;
  }

  // Remember what had focus: the card is redrawn after every edit.
  const focusKey = document.activeElement && workoutsEl.contains(document.activeElement)
    ? document.activeElement.dataset.key : null;

  workoutsEl.innerHTML =
    '<h3>Your week</h3>' + weekSummary(sessions) +
    '<p class="note">Exercises are picked from the tiers for the muscles you chose — ' +
    'higher tiers first, one per movement in a session, rotated across the week. ' +
    'Click an exercise to swap it or × to drop it; move a session with its day and time.</p>' +
    '<div class="tier-key">' + TIERS.map(tierBadge).join('<span class="gt">›</span>') +
      '<span class="tk-label">recommendation priority</span></div>' +
    DayOfWeek.values.map(day => {
      const session = sessions.find(s => s.day === day);
      return session ? renderSession(session) : renderRestDay(day);
    }).join("");

  if (focusKey) {
    const again = workoutsEl.querySelector('[data-key="' + focusKey + '"]');
    if (again) again.focus();
  }
}

/**
 * Training, rest and off days, time, how often each muscle is trained, any
 * chosen muscle the week no longer trains, and the daily targets.
 */
function weekSummary(sessions) {
  const minutes = sessions.reduce((t, s) => t + s.workout.minutes, 0);
  const times = new Map();
  for (const s of sessions)
    for (const m of s.block.muscles) if (!s.block.riders.has(m)) times.set(m, (times.get(m) || 0) + 1);
  const counts = [...new Set(times.values())].sort();
  const freq = !counts.length ? ""
    : counts.length === 1 ? "each muscle " + counts[0] + "× a week"
    : "each muscle " + counts[0] + "–" + counts[counts.length - 1] + "× a week";
  // Chosen muscles with exercises that no session trains any more (one was removed).
  const missing = routine.selectedMuscles()
    .filter(m => exercisesFor(m.id).length && !times.has(m)).map(m => m.name);
  const off = DayOfWeek.values.filter(d => routine.isDayUnavailable(d)).length;
  const n = routine.nutrition;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return '<div class="week-sum">' +
    '<span><b>' + sessions.length + '</b> training ' + (sessions.length === 1 ? "day" : "days") + '</span>' +
    '<span><b>' + (7 - sessions.length - off) + '</b> rest</span>' +
    (off ? '<span><b>' + off + '</b> off</span>' : '') +
    (minutes ? '<span>≈ <b>' + (h ? h + ' h ' : '') + (m ? m + ' min' : '') + '</b> training</span>' : '') +
    (freq ? '<span>' + freq + '</span>' : '') +
    (n.isValid() ? '<span>≈ <b>' + n.kcal.toLocaleString("en-US") + '</b> kcal · <b>' + n.protein +
      '</b> g protein a day</span>' : '') +
  '</div>' +
  (missing.length ? '<p class="week-gap">Not trained this week: ' + esc(nameList(missing)) +
    '. Generate again to fit ' + (missing.length === 1 ? 'it' : 'them') + ' back in.</p>' : '');
}

function renderSession(session) {
  const w = session.workout;
  return '<article class="wo" data-session="' + session.id + '">' +
    '<header class="wo-head">' +
      '<div><div class="wo-when">' + moveControls(session) + '</div>' +
        '<div class="wo-title">' + esc(session.block.label) + '</div></div>' +
      '<div class="wo-meta">' + w.entries.length + ' exercises · ' + w.sets + ' sets · ≈ ' +
        w.minutes + ' min' +
        (w.edited ? ' · <button type="button" class="link-btn" data-act="restore" ' +
                    'data-key="restore-' + session.id + '" aria-label="Restore suggested exercises for ' +
                    DAY_NAME[session.day] + '">Restore suggestions</button>' : '') +
        ' · <button type="button" class="link-btn" data-act="drop" data-key="drop-' + session.id +
          '" aria-label="Remove ' + DAY_NAME[session.day] + '\'s session">Remove session</button>' +
      '</div>' +
    '</header>' +
    '<p class="wo-notes">' + recoveryNote(session) + fuelNote(session) + '</p>' +
    w.muscles.map(m => renderMuscle(session, w, m)).join("") +
  '</article>';
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
  return '<span class="picker"><span class="picker-label" aria-hidden="true">' +
      DAY_NAME[session.day] + '</span><select data-act="move-day" data-key="day-' + session.id +
      '" aria-label="Day of ' + esc(session.block.label) + ' session">' + days + '</select></span>' +
    '<span class="picker"><span class="picker-label" aria-hidden="true">' +
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

/** A day with no session: a day off, or a rest day and what is recovering on it. */
function renderRestDay(day) {
  const meals = routine.plannedMeals.filter(m => m.day === day).sort((a, b) => a.hour - b.hour);
  const mealLine = meals.length
    ? ' <span class="rd-meals">Meals ' + meals.map(m => hourLabel(m.hour)).join(" · ") + '</span>' : '';
  if (routine.isDayUnavailable(day))
    return '<div class="rest-day off"><span class="rd-day">' + DAY_NAME[day] + '</span>' +
      '<span class="rd-what">Day off — no training</span>' + mealLine + '</div>';
  const recovering = routine.recoveringOn(day);
  return '<div class="rest-day"><span class="rd-day">' + DAY_NAME[day] + '</span>' +
    '<span class="rd-what"><b>Rest day</b>' + (recovering.length
      ? ' — ' + esc(nameList(recovering.map(m => m.name))) + ' recovering' : '') + '</span>' +
    mealLine + '</div>';
}

function renderMuscle(session, w, muscle) {
  const entries = w.entriesFor(muscle.id);
  const pool = exercisesFor(muscle.id);
  const direct = w.directSets(muscle.id), assisted = w.assistedSets(muscle.id);

  let body;
  if (!pool.length) {
    body = '<p class="wm-empty">No ' + esc(muscle.name.toLowerCase()) + ' exercises in the ' +
           'database yet' + (assisted ? ' — it gets assisting work from the lifts above.' : '.') + '</p>';
  } else {
    body = '<ul class="wm-list">' + entries.map(e => renderEntry(session, w, e)).join("") + '</ul>' +
      exerciseSelect(w, muscle.id, null, session.id);
  }

  return '<section class="wm">' +
    '<div class="wm-head"><span class="dot" style="background:var(--' +
      FAMILIES[muscle.family].css + ')"></span><b>' + esc(muscle.name) + '</b>' +
      '<span class="wm-sets">' + (direct ? direct + (direct === 1 ? " set" : " sets") : "") +
      (assisted ? (direct ? " + " : "") + "≈" + fmtSets(assisted) + " assisting" : "") + '</span></div>' +
    body + '</section>';
}

function renderEntry(session, w, entry) {
  const i = w.entries.indexOf(entry);
  const ex = entry.exercise;
  const clash = w.clashWith(ex, entry);
  const also = [...ex.primary, ...ex.secondary].filter(id => id !== entry.muscleId)
    .map(id => MUSCLE_BY_ID.get(id).name);
  return '<li class="wo-ex' + (entry.manual ? ' manual' : '') + '">' +
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
    '<button type="button" class="x" data-act="remove" data-entry="' + i + '" ' +
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
    ? '<span class="picker ex-pick"><span class="picker-label" aria-hidden="true">' +
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

const fmtSets = n => (n % 1 ? n.toFixed(1) : String(n));

/* ------------------------------- editing --------------------------------- */

function sessionOf(el) {
  const art = el.closest("[data-session]");
  return art && routine.sessions.find(s => s.id === Number(art.dataset.session));
}

workoutsEl.addEventListener("change", e => {
  const el = e.target, session = sessionOf(el);
  if (!session || !el.value) return;
  if (el.dataset.act === "move-day" || el.dataset.act === "move-time") {
    // A new day keeps the start time where it fits, else the nearest that does.
    if (el.dataset.act === "move-day") routine.moveSession(session, el.value);
    else routine.moveSession(session, session.day, Number(el.value));
    render();
    const again = workoutsEl.querySelector('[data-key="' + el.dataset.key + '"]');
    if (again) again.focus();
    return;
  }
  const w = session.workout, ex = EXERCISE_BY_ID.get(el.value);
  if (el.dataset.act === "replace") w.replace(w.entries[Number(el.dataset.entry)], ex);
  else if (el.dataset.act === "add") w.add(el.dataset.muscle, ex);
  renderWorkouts();
});

workoutsEl.addEventListener("click", e => {
  const el = e.target.closest("button[data-act]");
  const session = el && sessionOf(el);
  if (!session) return;
  const w = session.workout;
  if (el.dataset.act === "remove") {
    const i = Number(el.dataset.entry);
    w.remove(w.entries[i]);
    renderWorkouts();
    // Keep focus nearby: the next row's ×, else this session's add menu.
    const art = workoutsEl.querySelector('[data-session="' + session.id + '"]');
    const next = art.querySelector('[data-key="rm-' + session.id + '-' + i + '"]') ||
                 art.querySelector(".ex-add select");
    if (next) next.focus();
  } else if (el.dataset.act === "restore") {
    w.restore();
    renderWorkouts();
    // The link goes once there is nothing to restore; stay in this session.
    workoutsEl.querySelector('[data-key="day-' + session.id + '"]').focus();
  } else if (el.dataset.act === "drop") {
    routine.removeSession(session);
    render();
    renderNutritionMini();
    weekEdited() || warnIfStale();
    const rest = workoutsEl.querySelector("[data-act=drop]") || $("generate");
    rest.focus();
  }
});
