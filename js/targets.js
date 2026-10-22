/* ===========================================================================
   Targets stage — define your focus.

   The sculpture stands in the centre; the two rails either side of it
   carry what the user needs while choosing:

     • left    where to start: the program families as tabs, one program
               at a time with previous and next, and what applying it does
     • right   until something is chosen, how ATLAS works; then the
               training focus, grouped by family, and each muscle's
               priority (training experience is set on the Week plan)

   Four views of one MuscleSelection (routine.selection): the figure, the
   programs, the focus summary and the estimate. None of them talk to each
   other. Each writes to the selection and redraws when it changes, so a
   new view (or a later stage) only has to subscribe.

   Browsing never costs the user their work: with nothing chosen, or a
   selection of their own, previous and next only show programs (pointing
   at one previews it on the sculpture) until one is applied. Once the
   selection follows a program, they switch programs directly.
   ========================================================================= */

const selection = routine.selection;
const programsEl = $("programs"), summaryEl = $("focus-summary"), captionEl = $("anatomy-caption");

/* The tab names: the families of PROGRAM_GROUPS, shortened to fit. */
const PROGRAM_TABS = { whole: "Whole body", movement: "Push · Pull · Legs", pairing: "Pairings" };
const PRIORITY_CHOICES = [["maintain", "Maintain"], ["normal", "Normal"], ["focus", "Focus"]];
const PRIORITY_MARK = { focus: "▲", maintain: "▼", normal: "" };
/* "What it will take" (estimateHTML) is hidden from Targets for now and kept
   for a later stage, likely an end-of-plan summary. Set true to show it here. */
const SHOW_ESTIMATE = false;

const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* -------------------------------- figure --------------------------------- */

let pointedAt = null, pointedRegion = null, pointedDetailMode = false;

function paintCaption() {
  const m = pointedAt;
  captionEl.classList.toggle("live", !!m);
  if (!m) {
    const flat = $("anatomy-stage").classList.contains("flat");
    captionEl.textContent = Stages.narrow ? "Tap a muscle to select it"
      : flat ? "Click a muscle to select it · click again to deselect"
      : "Explore the surface · click to select · drag to turn";
    return;
  }
  // Keep the picked region for a future detailed view; the current overview
  // names the training group that hovering and selection reveal together.
  const regionName = pointedDetailMode && pointedRegion && pointedRegion.replace(/-/g, " ");
  const action = Stages.narrow ? "tap" : "click";
  captionEl.innerHTML =
    '<span class="cartography-caption">' +
    '<span class="cartography-name">' + esc(regionName || m.name) + '</span>' +
    '<span>' + (regionName ? esc(m.name) + ' · ' : '') +
    (selection.has(m.id) ? 'Selected · ' + action + ' to remove' : action + ' to add') + '</span></span>';
}

/** Front and Back: the view shown is underlined; a drag off it fades the line. */
function paintTurn(view = "front", offView = false) {
  const turn = $("turn");
  turn.classList.toggle("off-view", offView);
  for (const b of turn.querySelectorAll("[data-view]"))
    b.setAttribute("aria-pressed", b.dataset.view === view ? "true" : "false");
}

/* The anatomy on the stage: the Male_Body sculpture, or the procedural
   figure when index.html?anatomy=procedural left the sculpture out or its
   file failed to load. If both are missing, the stage falls back to the SVG
   figure. */
const anatomyModel = typeof ANATOMY_MODEL_MALE_BODY === "object" ? ANATOMY_MODEL_MALE_BODY
  : typeof ANATOMY_MODEL === "object" ? ANATOMY_MODEL : null;
if (typeof ANATOMY_MODEL_MALE_BODY === "object") validateAnatomyModel(anatomyModel);

/* The one sculpture every stage shares. Its camera is the stages' to move
   (stages.js); this stage owns what it says and what pointing does. */
const figure = new AnatomyStage($("anatomy-stage"), selection, {
  model: anatomyModel,
  onHover(muscle, region, detailed = false) {
    pointedAt = muscle; pointedRegion = region || null; pointedDetailMode = detailed;
    paintCaption();
  },
  onTurn(view, offView) { paintTurn(view, offView); },
  onChange() { paintCaption(); paintTurn(); }
});

$("turn").addEventListener("click", e => {
  const b = e.target.closest("[data-view]");
  if (b) figure.turnTo(b.dataset.view);
});

/* ---------------------------- left: programs ----------------------------- */

const rail = { program: PROGRAMS[0], out: false, dir: 1 };

/** True while previous and next only show programs, rather than apply them. */
const browsing = () => selection.isEmpty() || selection.source().kind === "custom";

/** The structure is built once; paintPrograms() keeps it in step, so focus stays put. */
function buildPrograms() {
  programsEl.innerHTML =
    '<div class="tabs" role="tablist" aria-label="Program families">' +
      PROGRAM_GROUPS.map(g =>
        '<button type="button" role="tab" class="tab" data-group="' + g.id + '" title="' + esc(g.name) + '">' +
          esc(PROGRAM_TABS[g.id] || g.name) + '<span class="tab-line" aria-hidden="true"></span></button>').join("") +
    '</div>' +
    '<div class="slider">' +
      '<div class="slider-head">' +
        '<span class="eyebrow">Starting from</span>' +
        '<div class="slider-ctl">' +
          '<button type="button" class="round-btn" data-step="-1">←</button>' +
          '<div class="pips" id="program-pips"></div>' +
          '<button type="button" class="round-btn" data-step="1">→</button>' +
        '</div>' +
      '</div>' +
      '<div class="program" id="program" tabindex="-1" aria-live="polite">' +
        '<span class="program-title"><span class="program-name" id="program-name"></span>' +
          '<span class="program-edited" id="program-edited" hidden>edited</span></span>' +
        '<span class="program-count" id="program-count"></span>' +
        '<p class="program-why" id="program-why"></p>' +
        '<div class="program-diff" id="program-diff" hidden></div>' +
      '</div>' +
      '<button type="button" class="text-link program-action" id="program-action" hidden></button>' +
      '<p class="note-rule">Refine it on the sculpture: click a muscle to add or remove it.</p>' +
    '</div>';
}

function inGroup(program = rail.program) { return PROGRAMS.filter(p => p.group === program.group); }

function paintPrograms() {
  const src = selection.source();
  // The rail follows the selection when it is a program, whichever way it got there.
  if (src.program && src.program !== rail.program && !rail.out) rail.program = src.program;
  const shown = rail.program, list = inGroup(), i = list.indexOf(shown);
  const prev = list[i - 1], next = list[i + 1];

  for (const tab of programsEl.querySelectorAll(".tab[data-group]")) {
    const on = tab.dataset.group === shown.group;
    tab.setAttribute("aria-selected", on ? "true" : "false");
    tab.tabIndex = on ? 0 : -1;
  }
  const pips = $("program-pips");
  // The pips' own family attribute: data-group would make them read as a tab.
  if (pips.dataset.family !== shown.group) {
    pips.dataset.family = shown.group;
    pips.innerHTML = list.map(p =>
      '<button type="button" class="pip" data-program="' + p.id + '" aria-label="' + esc(p.name) + '" title="' + esc(p.name) + '">' +
      '<span></span></button>').join("");
  }
  for (const pip of pips.children)
    if (pip.dataset.program === shown.id) pip.setAttribute("aria-current", "true");
    else pip.removeAttribute("aria-current");
  const [back, on] = programsEl.querySelectorAll(".round-btn");
  back.disabled = !prev; on.disabled = !next;
  back.setAttribute("aria-label", prev ? "Previous: " + prev.name : "First program");
  on.setAttribute("aria-label", next ? "Next: " + next.name : "Last program");
  back.title = back.getAttribute("aria-label"); on.title = on.getAttribute("aria-label");

  const edited = src.kind === "modified" && src.program === shown;
  const exact = src.kind === "program" && src.program === shown;
  $("program-name").textContent = shown.name;
  $("program-edited").hidden = !edited;
  $("program-count").textContent = plural(shown.muscles.length, "muscle group", "muscle groups");
  $("program-why").textContent = shown.why;
  const diff = $("program-diff");
  diff.hidden = !edited;
  diff.innerHTML = !edited ? "" :
    (src.added.length ? '<span><span class="faint">Added</span> ' + esc(src.added.map(m => m.name).join(", ")) + '</span>' : '') +
    (src.removed.length ? '<span><span class="faint">Removed</span> ' + esc(src.removed.map(m => m.name).join(", ")) + '</span>' : '');
  const action = $("program-action");
  action.hidden = exact;
  action.textContent = edited ? "Reset to " + shown.name : "Apply " + shown.name + " →";
}

/**
 * Shows another program: slides the old one out and the new one in. Unless
 * the user is only browsing, it is applied as it arrives.
 */
function showProgram(program, dir) {
  if (!program || program === rail.program) return;
  const apply = !browsing();
  const before = new Set(selection.ids);
  const swap = () => {
    rail.program = program;
    rail.out = false;
    $("program").classList.remove("out");
    if (!apply) { paintPrograms(); return; }
    // A muscle clicked while the card slid is kept: the program goes on,
    // then what changed since the click on the arrow goes on top of it.
    const added = [...selection.ids].filter(id => !before.has(id));
    const removed = [...before].filter(id => !selection.has(id));
    selection.applyProgram(program);
    for (const id of added) selection.set(id, true);
    for (const id of removed) selection.set(id, false);
  };
  figure.preview(null);
  if (reducedMotion()) { swap(); return; }
  rail.out = true;
  $("program").style.setProperty("--dir", dir);
  $("program").classList.add("out");
  clearTimeout(rail.timer);
  rail.timer = setTimeout(swap, 170);
}

const programAt = el => {
  if (el.dataset.program) return PROGRAM_BY_ID.get(el.dataset.program);
  if (el.dataset.step) return inGroup()[inGroup().indexOf(rail.program) + Number(el.dataset.step)];
  if (el.id === "program-action") return rail.program;
  return null;
};

programsEl.addEventListener("click", e => {
  const tab = e.target.closest(".tab[data-group]");
  if (tab) {
    if (tab.dataset.group !== rail.program.group)
      showProgram(PROGRAMS.find(p => p.group === tab.dataset.group), 1);
    return;
  }
  const b = e.target.closest("button");
  if (!b) return;
  if (b.id === "program-action") {
    selection.applyProgram(rail.program);
    figure.preview(null);
    // The action hides once the program is applied; focus stays on the card.
    if (b.hidden && document.activeElement === document.body) $("program").focus({ preventScroll: true });
    return;
  }
  const p = programAt(b);
  if (p) showProgram(p, inGroup().indexOf(p) > inGroup().indexOf(rail.program) ? 1 : -1);
});

/* Arrow keys move along the tabs, wrapping, and Home and End go to either
   end, as a tab list should. */
programsEl.addEventListener("keydown", e => {
  const tab = e.target.closest(".tab[data-group]");
  if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  e.preventDefault();
  const tabs = [...programsEl.querySelectorAll(".tab[data-group]")], i = tabs.indexOf(tab);
  const to = e.key === "Home" ? tabs[0] : e.key === "End" ? tabs[tabs.length - 1] :
    tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
  to.focus();
  to.click();
});

/* Pointing at the action, an arrow or a pip previews that program on the
   sculpture; leaving it goes back to the selection. */
const previewFrom = el => {
  const b = el.closest && el.closest(".round-btn, .pip, #program-action");
  if (!b || b.disabled) return;
  const p = programAt(b);
  if (p && (b.id === "program-action" || p !== rail.program)) figure.preview(p.muscles);
};
programsEl.addEventListener("pointerover", e => previewFrom(e.target));
programsEl.addEventListener("pointerout", e => {
  if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest(".round-btn, .pip, #program-action"))
    figure.preview(null);
});
programsEl.addEventListener("focusin", e => { if (e.target.matches(":focus-visible")) previewFrom(e.target); });
programsEl.addEventListener("focusout", () => figure.preview(null));

/* ------------------------- right: training focus ------------------------- */

const focusState = { open: null, estimate: false };

function renderSummary() {
  // Remember what had focus: the rail is redrawn after every change.
  const focusKey = document.activeElement && summaryEl.contains(document.activeElement)
    ? document.activeElement.dataset.key : null;
  summaryEl.innerHTML = selection.isEmpty() ? introHTML() : focusHTML();
  if (focusKey) {
    const again = summaryEl.querySelector('[data-key="' + focusKey + '"]');
    if (again) again.focus({ preventScroll: true });
  }
}

/** Before anything is chosen: what ATLAS does and how to begin. */
function introHTML() {
  const steps = [
    ["Targets", "You are here", "Choose the muscles to build, then set any of them to focus or maintain."],
    ["Nutrition", "Optional", "Calories and protein to match the training. Skip it if you only want workouts."],
    ["Week plan", "", "Tell ATLAS when you're busy. It fits the sessions around you and picks the exercises."]
  ];
  return '<div class="intro">' +
      '<span class="eyebrow">How ATLAS works</span>' +
      '<span class="intro-title">A week of training, built around you.</span>' +
      '<p>Plan around the muscles you want to build and the time you actually have.</p>' +
    '</div>' +
    '<ol class="howto">' + steps.map(([title, tag, text], i) =>
      '<li' + (i === 0 ? ' class="here"' : '') + '>' +
        '<span class="howto-head"><span class="howto-title">' + title + '</span>' +
          '<span class="howto-tag">' + tag + '</span></span>' +
        '<span class="howto-text">' + text + '</span></li>').join("") + '</ol>' +
    '<div class="intro-start">' +
      '<span class="intro-start-title">Start on the left, or on the figure.</span>' +
      '<span>Apply a program, or click any muscle on the sculpture. Nothing is selected yet.</span>' +
    '</div>';
}

/** The weekly hard sets a muscle starts from, for its experience and priority (estimate.js). */
function startingSets(m) {
  if (!exercisesFor(m.id).length) return 0;
  return weeklyTarget(m, routine.experience || DEFAULT_EXPERIENCE, selection.priority(m.id)) || 0;
}

/** Once something is chosen: the count and the focus by family. */
function focusHTML() {
  const muscles = selection.muscles();
  const families = Object.keys(FAMILIES).map(key => ({ key, muscles: muscles.filter(m => m.family === key) }))
    .filter(f => f.muscles.length);

  const groups = families.map(({ key, muscles: ms }) => {
    const open = focusState.open === key;
    const sets = ms.reduce((t, m) => t + startingSets(m), 0);
    const names = ms.map(m => {
      const p = selection.priority(m.id);
      return '<span class="fam-m" data-level="' + p + '">' + esc(m.name) +
        (PRIORITY_MARK[p] ? '<span class="mark" aria-hidden="true">' + PRIORITY_MARK[p] + '</span>' +
          '<span class="visually-hidden">, ' + p + '</span>' : '') + '</span>';
    }).join("");
    const rows = ms.map(m => {
      const now = selection.priority(m.id);
      return '<div class="fam-row">' +
        '<span class="fam-row-name">' + esc(m.name) + '</span>' +
        '<span class="segmented small" role="radiogroup" aria-label="' + esc(m.name) + ' priority">' +
          PRIORITY_CHOICES.map(([level, label]) =>
            '<button type="button" role="radio" aria-checked="' + (now === level) + '" ' +
              'data-priority="' + level + '" data-muscle="' + m.id + '" data-key="pri-' + m.id + '-' + level + '">' +
              label + '</button>').join("") +
        '</span>' +
        '<button type="button" class="row-x" data-remove="' + m.id + '" data-key="rm-' + m.id + '" ' +
          'aria-label="Remove ' + esc(m.name) + '" title="Remove ' + esc(m.name) + '">×</button>' +
      '</div>';
    }).join("");
    return '<div class="fam" data-family="' + key + '">' +
      '<button type="button" class="fam-toggle" data-family-toggle="' + key + '" data-key="fam-' + key + '" ' +
        'aria-expanded="' + open + '">' +
        '<span class="fam-line">' +
          '<span class="fam-dot" style="background:var(--' + FAMILIES[key].css + ')"></span>' +
          '<span class="fam-name">' + FAMILIES[key].name + '</span>' +
          '<span class="fam-count">' + ms.length + '</span>' +
          '<span class="fam-sets">' + (sets ? '≈ ' + sets + ' sets' : '') + '</span>' +
          '<span class="fam-chev" aria-hidden="true">' + (open ? "−" : "+") + '</span>' +
        '</span>' +
        (open ? '' : '<span class="fam-names">' + names + '</span>') +
      '</button>' +
      (open ? '<div class="fam-rows">' + rows +
        '<p class="fam-note">Focus gets more weekly sets and days. Maintain keeps the minimum and is trimmed first ' +
        'when your week is short.</p></div>' : '') +
    '</div>';
  }).join("");

  return '<div class="sel-head">' +
      '<span class="sel-count-wrap"><span class="sel-count">' + muscles.length + '</span>' +
        '<span class="sel-noun">' + (muscles.length === 1 ? "muscle group" : "muscle groups") + '</span></span>' +
      '<button type="button" class="quiet-btn" id="clear-sel" data-key="clear">Clear</button>' +
    '</div>' +
    '<div class="focus">' +
      '<div class="focus-head"><span class="eyebrow">Training focus</span>' +
        '<span class="focus-key"><span>▲</span> focus <span>▼</span> maintain</span></div>' +
      groups +
    '</div>' +
    noExercisesNote(muscles) +
    (SHOW_ESTIMATE ? estimateHTML(muscles) : "");
}

/** Says up front which chosen muscles the exercise database cannot fill yet. */
function noExercisesNote(muscles) {
  const bare = muscles.filter(m => !exercisesFor(m.id).length);
  if (!bare.length) return "";
  const names = bare.map(m => esc(m.name));
  const list = names.length === 1 ? names[0]
             : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  return '<p class="note-rule">No exercises in the database yet for ' + list + '. ' +
    (bare.length === muscles.length
      ? "Sessions for " + (bare.length === 1 ? "it" : "them") + " will be planned without exercises."
      : (bare.length === 1 ? "It rides" : "They ride") + " along in related sessions, credited " +
        "with the work other lifts give " + (bare.length === 1 ? "it" : "them") + ".") + '</p>';
}

/* ------------------------------- estimate -------------------------------- */

/** "25–40 min", "3.5–6 h" or "45 min – 1.5 h", half hours above an hour. */
function timeRange(lo, hi) {
  const h = min => { const v = Math.round(min / 30) / 2; return v % 1 ? v.toFixed(1) : String(v); };
  if (hi < 60) return lo === hi ? lo + " min" : lo + "–" + hi + " min";
  if (lo < 60) return lo + " min – " + h(hi) + " h";
  return h(lo) === h(hi) ? h(lo) + " h" : h(lo) + "–" + h(hi) + " h";
}
function range(lo, hi) { return lo === hi ? String(lo) : lo + "–" + hi; }

/** What it will take: two figures, and the reasoning behind them on demand. */
function estimateHTML(muscles) {
  const e = estimateTraining(muscles, routine.sessionMinutes);
  if (!e) return "";
  const open = focusState.estimate;
  return '<div class="est">' +
    '<button type="button" class="est-toggle" id="est-toggle" data-key="est" aria-expanded="' + open + '" aria-controls="est-body">' +
      '<span class="est-label"><span class="eyebrow">What it will take</span><span class="est-tag">estimate</span></span>' +
      '<span class="fam-chev" aria-hidden="true">' + (open ? "−" : "+") + '</span>' +
      '<span class="est-figures">' +
        '<span><b>' + range(e.sets.low, e.sets.high) + '</b> sets a week</span>' +
        '<span><b>' + timeRange(e.minutes.low, e.minutes.high) + '</b> a week</span>' +
      '</span>' +
    '</button>' +
    (open ? '<div class="est-body" id="est-body">' +
      '<p>Hard sets across ' + plural(e.muscleCount, "selected muscle", "selected muscles") +
        '; start at the low end and add sets as you adapt. ≈ ' + range(e.sessions.low, e.sessions.high) + ' ' +
        (e.sessions.high === 1 ? "session" : "sessions") + ' of ' + e.sessionMinutes + ' min, warm-up included.</p>' +
      '<p>A muscle trains as often as it takes to keep each session to ' + WORKOUT.maxSetsPerSession +
        ' sets or fewer. The research does not show a best number.</p>' +
      '<ol class="phase-list">' + e.phases.map(p =>
        '<li><span class="phase-when">' + p.when + '</span><span class="phase-what">' + p.what + '</span></li>').join("") +
      '</ol>' +
      '<p class="note-rule"><b>Not a prediction of when you will reach a particular physique</b> — no app can know that. ' +
        'Typical ranges if you complete most planned sessions, most weeks; training history, sleep, food, age and ' +
        'genetics all change the pace.</p>' +
    '</div>' : '') +
  '</div>';
}

summaryEl.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.priority) selection.setPriority(b.dataset.muscle, b.dataset.priority);
  else if (b.dataset.remove) {
    // Keep keyboard focus in the family rather than dropping it on <body>.
    const row = b.closest(".fam-row"), near = row.nextElementSibling || row.previousElementSibling;
    const nearId = near && near.querySelector("[data-remove]") && near.querySelector("[data-remove]").dataset.remove;
    selection.set(b.dataset.remove, false);
    const to = (nearId && summaryEl.querySelector('[data-remove="' + nearId + '"]')) ||
               summaryEl.querySelector("[data-family-toggle]") || $("targets-title");
    to.focus();
  }
  else if (b.dataset.familyToggle) {
    focusState.open = focusState.open === b.dataset.familyToggle ? null : b.dataset.familyToggle;
    renderSummary();
  }
  else if (b.id === "est-toggle") { focusState.estimate = !focusState.estimate; renderSummary(); }
  else if (b.id === "clear-sel") { selection.clear(); $("targets-title").focus(); }
});

/* Pointing at a family shows its muscles on the sculpture, in the family's
   hue where the sculpture has one for it. */
summaryEl.addEventListener("pointerover", e => {
  const fam = e.target.closest("[data-family]"), key = fam && fam.dataset.family;
  if (fam) figure.preview(selection.muscles().filter(m => m.family === key).map(m => m.id), key);
});
summaryEl.addEventListener("pointerout", e => {
  const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest("[data-family]");
  const from = e.target.closest("[data-family]");
  if (from && to !== from) figure.preview(null);
});

/* --------------------------------- wiring -------------------------------- */

function renderTargets() {
  paintCaption();
  paintPrograms();
  renderSummary();
}

buildPrograms();
selection.onChange(renderTargets);

/* What a change to the selection did, said once (the rail is redrawn whole
   and no longer reads itself out). */
let announcedIds = new Set(selection.ids);
selection.onChange(() => {
  const now = new Set(selection.ids);
  const names = ids => MUSCLES.filter(m => ids.includes(m.id)).map(m => m.name);
  const added = names([...now].filter(id => !announcedIds.has(id)));
  const removed = names([...announcedIds].filter(id => !now.has(id)));
  announcedIds = now;
  if (document.readyState === "loading") return;     // restoring a saved selection, not a change
  if (!added.length && !removed.length) return;
  const list = l => l.length > 3 ? l.length + " muscle groups" : l.join(", ");
  announce([added.length ? list(added) + " added" : "", removed.length ? list(removed) + " removed" : "",
            plural(now.size, "muscle group", "muscle groups") + " selected"].filter(Boolean).join(". "));
});

Stages.register("targets", {
  enter: renderTargets,
  shot: () => "targets",
  focus: () => $("targets-title"),
  footer() {
    const empty = selection.isEmpty();
    return {
      next: Stages.narrow ? "Continue →" : "Continue to nutrition →",
      nextDisabled: empty,
      hint: empty ? "Select at least one muscle to continue." : Stages.wide ? "or scroll" : ""
    };
  },
  onNext() { if (!selection.isEmpty()) Stages.go("nutrition"); return true; }
});
