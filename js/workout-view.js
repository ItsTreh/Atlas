/* ===========================================================================
   Workouts card — shows each session's exercises and lets the user change
   them. Every change goes through the session's Workout (workouts.js); this
   file only draws it and turns clicks into those calls.
   ========================================================================= */

const workoutsEl = $("workouts");

const TIER_CSS = { "S+": "splus", "S": "s", "A+": "aplus", "A": "a" };
const tierBadge = label =>
  '<span class="tier tier-' + (TIER_CSS[label] || "none") + '" title="' +
  (label ? "Tier " + label : "Not rated for this muscle") + '">' + (label || "–") + '</span>';

const byWeekOrder = (a, b) =>
  DayOfWeek.indexOf(a.day) - DayOfWeek.indexOf(b.day) || a.startHour - b.startHour;

function renderWorkouts() {
  const sessions = [...routine.sessions].sort(byWeekOrder);
  if (!sessions.length) {
    workoutsEl.innerHTML = '<h3>Workouts</h3><p class="empty-nutri">Generate a routine ' +
      'to see the exercises for each session.</p>';
    return;
  }

  // Remember what had focus: the card is redrawn after every edit.
  const focusKey = document.activeElement && workoutsEl.contains(document.activeElement)
    ? document.activeElement.dataset.key : null;

  workoutsEl.innerHTML =
    '<h3>Workouts</h3>' +
    '<p class="note">Picked from the exercise tiers for the muscles you chose — ' +
    'higher tiers first, one exercise per movement in a session, rotated across ' +
    'the week. Click an exercise name to swap it, or × to drop it.</p>' +
    '<div class="tier-key">' + TIERS.map(tierBadge).join('<span class="gt">›</span>') +
      '<span class="tk-label">recommendation priority</span></div>' +
    sessions.map(renderSession).join("");

  if (focusKey) {
    const again = workoutsEl.querySelector('[data-key="' + focusKey + '"]');
    if (again) again.focus();
  }
}

function renderSession(session) {
  const w = session.workout;
  const when = DayOfWeek.label[session.day] + " · " + hourLabel(session.startHour) +
               "–" + hourLabel(session.endHour());
  return '<article class="wo" data-session="' + session.id + '">' +
    '<header class="wo-head">' +
      '<div><div class="wo-when">' + when + '</div>' +
        '<div class="wo-title">' + esc(session.block.label) + '</div></div>' +
      '<div class="wo-meta">' + w.sets + ' sets · ≈ ' + w.minutes + ' min' +
        (w.edited ? ' <button type="button" class="link-btn" data-act="restore" ' +
                    'data-key="restore-' + session.id + '">Restore suggestions</button>' : '') +
      '</div>' +
    '</header>' +
    w.muscles.map(m => renderMuscle(session, w, m)).join("") +
  '</article>';
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
      '<div class="ex-sub">' + MOVEMENTS[ex.movement] +
        (also.length ? ' · also ' + also.join(", ") : '') +
        (entry.manual ? ' · <i>your pick</i>' : '') +
        (clash ? ' · <span class="clash">same movement as ' + esc(clash.exercise.name) + '</span>' : '') +
      '</div>' +
    '</div>' +
    '<span class="ex-sets">' + entry.sets + ' sets</span>' +
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
                 art.querySelector(".ex-add");
    if (next) next.focus();
  } else if (el.dataset.act === "restore") {
    w.restore();
    renderWorkouts();
  }
});
