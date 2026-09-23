/* ===========================================================================
   Targets stage — pick the muscles to train.

   Four views of one MuscleSelection (routine.selection):
     • the anatomy figure     click a muscle to toggle it
     • the program list       apply a recommended selection in one click
     • the summary            what is selected, and where it came from
     • the estimate           what training those muscles will take

   None of them talk to each other. Each writes to the selection and redraws
   when it changes, so a new view (or a later stage) only has to subscribe.
   ========================================================================= */

const selection = routine.selection;
const programsEl = $("programs"), summaryEl = $("selection-summary"),
      estimateEl = $("estimate"), captionEl = $("anatomy-caption"),
      toPlanBtn = $("to-plan");

const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

/* -------------------------------- figure --------------------------------- */

const CAPTION_IDLE = "Click a muscle to select it · click again to deselect";
let pointedAt = null;

function paintCaption() {
  const m = pointedAt;
  captionEl.classList.toggle("live", !!m);
  if (!m) { captionEl.textContent = CAPTION_IDLE; return; }
  captionEl.innerHTML =
    '<span class="dot" style="background:var(--' + FAMILIES[m.family].css + ')"></span>' +
    '<span><b>' + esc(m.name) + '</b> · ' + FAMILIES[m.family].name + ' · ' +
    (selection.has(m.id) ? "selected — click to remove" : "click to add") + '</span>';
}

const figure = new AnatomyFigure($("anatomy"), selection, {
  onHover(muscle) { pointedAt = muscle; paintCaption(); }
});

/* ------------------------------- programs -------------------------------- */

function buildPrograms() {
  programsEl.innerHTML = "";
  for (const group of PROGRAM_GROUPS) {
    const list = PROGRAMS.filter(p => p.group === group.id);
    if (!list.length) continue;
    const head = document.createElement("div");
    head.className = "prog-group";
    head.textContent = group.name;
    programsEl.appendChild(head);

    const row = document.createElement("div");
    row.className = "prog-row";
    for (const program of list) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "prog";
      b.dataset.program = program.id;
      b.setAttribute("aria-pressed", "false");
      b.title = program.why;
      b.innerHTML = '<span class="pn">' + esc(program.name) + '</span>' +
                    '<span class="pc">' + program.muscles.length + '</span>';
      // Clicking the active program again clears it, like clicking a muscle.
      b.addEventListener("click", () => {
        const src = selection.source();
        if (src.kind === "program" && src.program === program) selection.clear();
        else selection.applyProgram(program);
      });
      b.addEventListener("pointerenter", () => previewProgram(program));
      b.addEventListener("focus", () => previewProgram(program));
      b.addEventListener("pointerleave", () => previewProgram(null));
      b.addEventListener("blur", () => previewProgram(null));
      row.appendChild(b);
    }
    programsEl.appendChild(row);
  }
  const why = document.createElement("p");
  why.className = "prog-why";
  why.id = "prog-why";
  programsEl.appendChild(why);
}

/** Shows why a program groups what it does, while it is pointed at. */
function previewProgram(program) {
  figure.preview(program ? program.muscles : null);
  const why = $("prog-why");
  if (program) {
    why.innerHTML = '<b>' + esc(program.name) + ':</b> ' + esc(program.why);
    return;
  }
  const src = selection.source();
  why.innerHTML = src.program
    ? '<b>' + esc(src.program.name) + ':</b> ' + esc(src.program.why)
    : "Pick a program to start from, then add or remove muscles on the figure.";
}

function paintPrograms() {
  const src = selection.source();
  for (const b of programsEl.querySelectorAll(".prog")) {
    const p = PROGRAM_BY_ID.get(b.dataset.program);
    const active = src.kind === "program" && src.program === p;
    const edited = src.kind === "modified" && src.program === p;
    b.classList.toggle("active", active);
    b.classList.toggle("edited", edited);
    b.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

/* -------------------------------- summary -------------------------------- */

function renderSummary() {
  const muscles = selection.muscles();
  const src = selection.source();

  let origin;
  if (src.kind === "program") {
    origin = 'Matches the <b>' + esc(src.program.name) + '</b> program.';
  } else if (src.kind === "modified") {
    const parts = [];
    if (src.added.length)   parts.push("added " + src.added.map(m => esc(m.name)).join(", "));
    if (src.removed.length) parts.push("removed " + src.removed.map(m => esc(m.name)).join(", "));
    origin = 'Based on <b>' + esc(src.program.name) + '</b> — ' + parts.join("; ") + '.';
  } else if (src.kind === "custom") {
    origin = "Your own selection.";
  } else {
    origin = "Nothing selected yet. Click muscles on the figure or pick a program.";
  }

  const chips = muscles.map(m =>
    '<li class="sel-chip">' +
      '<span class="dot" style="background:var(--' + FAMILIES[m.family].css + ')"></span>' +
      esc(m.name) +
      '<button type="button" class="x" data-remove="' + m.id + '" ' +
        'aria-label="Remove ' + esc(m.name) + '">×</button>' +
    '</li>').join("");

  summaryEl.innerHTML =
    '<div class="sel-head">' +
      '<h3 aria-live="polite"><span class="big">' + muscles.length + '</span> ' +
        (muscles.length === 1 ? "muscle group" : "muscle groups") + ' selected</h3>' +
      '<button type="button" class="link-btn" id="clear-sel"' +
        (muscles.length ? "" : " disabled") + '>Clear</button>' +
    '</div>' +
    '<p class="sel-origin">' + origin + '</p>' +
    (muscles.length ? '<ul class="sel-list">' + chips + '</ul>' : '');
}

summaryEl.addEventListener("click", e => {
  const x = e.target.closest("[data-remove]");
  if (x) {
    const next = x.closest("li").nextElementSibling || x.closest("li").previousElementSibling;
    const nextId = next && next.querySelector("[data-remove]").dataset.remove;
    selection.set(x.dataset.remove, false);
    // Keep keyboard focus in the list rather than dropping it on <body>.
    const target = nextId && summaryEl.querySelector('[data-remove="' + nextId + '"]');
    (target || $("clear-sel")).focus();
  } else if (e.target.id === "clear-sel") {
    selection.clear();
  }
});

/* ------------------------------- estimate -------------------------------- */

/** "25–40 min", "3.5–6 h" or "45 min – 1.5 h", half hours above an hour. */
function timeRange(lo, hi) {
  const h = min => { const v = Math.round(min / 30) / 2; return v % 1 ? v.toFixed(1) : String(v); };
  if (hi < 60) return lo === hi ? lo + " min" : lo + "–" + hi + " min";
  if (lo < 60) return lo + " min – " + h(hi) + " h";
  return h(lo) === h(hi) ? h(lo) + " h" : h(lo) + "–" + h(hi) + " h";
}
function range(lo, hi) { return lo === hi ? String(lo) : lo + "–" + hi; }

function renderEstimate() {
  const e = estimateTraining(selection.muscles(), routine.sessionMinutes);
  if (!e) {
    estimateEl.innerHTML =
      '<h3>What it will take</h3>' +
      '<p class="est-empty">Once you pick target muscles, this estimates the ' +
      'weekly training volume, the time it needs, and how long consistent ' +
      'training usually takes before progress shows.</p>';
    return;
  }

  const sessions = range(e.sessions.low, e.sessions.high);
  const phases = e.phases.map(p =>
    '<li><div class="ph-when">' + p.when + '</div>' +
    '<div class="ph-what">' + p.what + '</div></li>').join("");

  estimateEl.innerHTML =
    '<h3>What it will take <span class="tag">Preliminary estimate</span></h3>' +
    '<p class="note">The next stages use these ' + plural(e.muscleCount, "muscle", "muscles") +
    ' to plan your training volume, schedule and diet. Here is a first pass at what ' +
    'training them usually takes.</p>' +
    '<div class="stats">' +
      '<div class="stat"><div class="k">Weekly volume</div>' +
        '<div class="v">' + range(e.sets.low, e.sets.high) + ' <span class="u">hard sets</span></div>' +
        '<div class="s">Start at the low end; add sets as you adapt.</div></div>' +
      '<div class="stat"><div class="k">Time a week</div>' +
        '<div class="v">' + timeRange(e.minutes.low, e.minutes.high) + '</div>' +
        '<div class="s">≈ ' + sessions + ' ' + (e.sessions.high === 1 ? "session" : "sessions") +
          ' of ' + e.sessionMinutes + ' min, warm-up included.</div></div>' +
      '<div class="stat"><div class="k">Frequency</div>' +
        '<div class="v">' + e.timesPerWeek + '× <span class="u">per muscle a week</span></div>' +
        '<div class="s">Splitting a muscle\'s sets over two days beats one long session.</div></div>' +
    '</div>' +
    '<h4>If you train consistently</h4>' +
    '<ol class="phases">' + phases + '</ol>' +
    '<p class="caveat"><b>This is not a prediction of when you will reach a ' +
    'particular physique</b> — no app can know that. These are typical ranges ' +
    'that assume you complete most planned sessions, most weeks. Training ' +
    'history, sleep, nutrition, age and genetics all change the pace, and ' +
    'missed weeks stretch every timeline. The estimate gets more specific as ' +
    'the schedule and diet stages fill in.</p>';
}

/* --------------------------------- wiring -------------------------------- */

function renderTargets() {
  paintCaption();
  paintPrograms();
  renderSummary();
  renderEstimate();
  toPlanBtn.disabled = selection.isEmpty();
  $("to-plan-hint").textContent = selection.isEmpty()
    ? "Select at least one muscle to continue." : "";
}

buildPrograms();
selection.onChange(renderTargets);
renderTargets();
