/* ===========================================================================
   Targets stage — in three movements.

     i    How it works    the figure steps aside, right, and acts out each
                          stage as it is read: the chapters play in turn,
                          and the camera goes where that stage will put it
     ii   Your muscles    the figure in the middle; on the left, where to
                          start (the program families as tabs, one program
                          at a time); on the right, what is chosen
     iii  Training focus  opens once something is chosen: the figure steps
                          left, and each muscle's priority gets the room

   A change of movement is a Stages.relayout, so it moves the way a change
   of stage does: out, the camera travels to the movement's framing
   (SCULPTURE_SHOTS "targets-…"), in. A first visit opens on How it
   works, a reload where the user was; coming back from a later stage
   lands on Training focus.

   Every part is a view of one MuscleSelection (routine.selection): the
   figure, the programs, what is chosen and the training focus. None of
   them talk to each other. Each writes to the selection and redraws when
   it changes, so a new view (or a later stage) only has to subscribe.

   Browsing never costs the user their work: with nothing chosen, or a
   selection of their own, previous and next only show programs (pointing
   at one previews it on the sculpture) until one is applied. Once the
   selection follows a program, they switch programs directly.
   ========================================================================= */

const selection = routine.selection;
const programsEl = $("programs"), trainList = $("train-list"), captionEl = $("anatomy-caption");

/* The tab names: the families of PROGRAM_GROUPS, shortened to fit. */
const PROGRAM_TABS = { whole: "Whole body", movement: "Push · Pull · Legs", pairing: "Pairings" };
const PRIORITY_CHOICES = [["maintain", "Maintain"], ["normal", "Normal"], ["focus", "Focus"]];

const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* -------------------------------- figure --------------------------------- */

let pointedAt = null, pointedRegion = null, pointedDetailMode = false, turnedTo = "front";

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

/* The ghost word. While a movement is a document (below), nothing labels
   the body beside it: the muscle pointed at is written very large in the
   ground behind the figure, in its family's tint, wherever the figure has
   gone (--gx, --gy). A document can pin a word there for while nothing is
   pointed at (pinGhost). */
const ghostEl = document.querySelector(".flow-ground .ghost");
const ghostWord = ghostEl.querySelector(".ghost-word"), ghostMeta = ghostEl.querySelector(".ghost-meta");
let ghostShown = null, ghostPinned = null;

function ghost(text, fam, line) {
  ghostMeta.textContent = line || "";
  if (text === ghostShown) return;
  ghostShown = text;
  ghostEl.parentNode.toggleAttribute("data-pointed", !!text);
  if (!text) return;                       // the letters stay to fade out
  ghostEl.dataset.family = fam || "";
  ghostEl.style.setProperty("--k", Math.min(1, 7.2 / Math.max(7, text.length)).toFixed(3));
  ghostWord.innerHTML = [...text].map((c, j) =>
    '<i style="--j:' + j + '">' + (c === " " ? "&nbsp;" : esc(c)) + '</i>').join("");
  ghostEl.classList.remove("swap"); void ghostEl.offsetWidth; ghostEl.classList.add("swap");
}

function paintGhost() {
  const m = pointedAt;
  if (Stages.current !== "targets" || !flowDoc()) return ghost(null);
  if (m) {
    const sel = selection.has(m.id), pr = sel ? selection.priority(m.id) : "";
    ghost(m.name, m.family, FAMILIES[m.family].name + (sel ? " · selected" + (pr && pr !== "normal" ? " · " + pr : "") : ""));
  } else if (ghostPinned) ghost(ghostPinned.text, ghostPinned.fam, ghostPinned.line);
  else ghost(null);
}

/** Holds `p` ({ text, fam, line }) behind the figure while nothing is pointed at; null to let it go. */
function pinGhost(p) { ghostPinned = p; paintGhost(); }

/** Front and Back: the view shown is underlined; a drag off it fades the line. */
function paintTurn(view = turnedTo, offView = false) {
  turnedTo = view;
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
    paintGhost();
    markRow(muscle);
  },
  onTurn(view, offView) { paintTurn(view, offView); },
  onChange() {
    paintCaption(); paintTurn();
    // A renderer taking over later (the SVG figure has no camera) may end the pages.
    if (Stages.views.targets && Stages.current === "targets") paintDocs();
  }
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

/* ------------------------------- estimate -------------------------------- */

/* "What it will take" (estimateHTML) is drawn nowhere for now: kept for a
   later stage, likely an end-of-plan summary. */

/** "25–40 min", "3.5–6 h" or "45 min – 1.5 h", half hours above an hour. */
function timeRange(lo, hi) {
  const h = min => { const v = Math.round(min / 30) / 2; return v % 1 ? v.toFixed(1) : String(v); };
  if (hi < 60) return lo === hi ? lo + " min" : lo + "–" + hi + " min";
  if (lo < 60) return lo + " min – " + h(hi) + " h";
  return h(lo) === h(hi) ? h(lo) + " h" : h(lo) + "–" + h(hi) + " h";
}
function range(lo, hi) { return lo === hi ? String(lo) : lo + "–" + hi; }

/** What it will take: two figures, and the reasoning behind them on demand. */
function estimateHTML(muscles, open = false) {
  const e = estimateTraining(muscles, routine.sessionMinutes);
  if (!e) return "";
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

/* ------------------------------ the movements ---------------------------- */

const FLOW_SUBS = ["how", "focus", "train"];
const FLOW_NAMES = { how: "How it works", focus: "Your muscles", train: "Training focus" };
/* Muscles best seen from behind: dwelling on one in Training focus turns the body round. */
const FLOW_BACK = new Set(["traps", "upper-back", "lats", "triceps", "hamstrings", "glutes", "calves", "lower-back"]);
/* How long a change of movement gives the camera, in ms (Stages.relayout),
   and how long the pointer rests on a chapter before it plays, or on a
   muscle's row before the body turns to show it. */
const FLOW_SETTLE = 1000;
const FLOW_DWELL = { chapter: 220, turn: 480 };

const flow = { sub: "how", last: null, chapter: 0, families: new Set(), wasEmpty: true };

/** The way the movements are travelled, for the CSS: 1 forward, −1 back. */
const setFlowDir = d => Stages.root.style.setProperty("--fdir", d);

function goSub(name) {
  if (Stages.current !== "targets" || !FLOW_SUBS.includes(name) || name === flow.sub) return;
  if (name === "train" && selection.isEmpty()) return;
  setFlowDir(FLOW_SUBS.indexOf(name) > FLOW_SUBS.indexOf(flow.sub) ? 1 : -1);
  figure.preview(null);
  Stages.relayout(() => {
    flow.sub = name;
    flow.chapter = 0;
    paintSub();
  }, FLOW_SETTLE);
  announce("Targets: " + FLOW_NAMES[name] + ", part " + (FLOW_SUBS.indexOf(name) + 1) + " of " + FLOW_SUBS.length);
}

function paintSub() {
  const from = flow.last;
  flow.last = flow.sub;
  Stages.root.dataset.sub = flow.sub;
  for (const p of $("stage-targets").querySelectorAll("[data-panel]")) p.classList.toggle("on", p.dataset.panel === flow.sub);
  trainList.classList.remove("calm");
  paintChapters();
  paintDocs(from);
}

/* ----------------------- the movements as documents ---------------------- */

/* On a wide screen, with the sculpture's camera, Your muscles and Training
   focus are each one page, scrolled (targets-muscles.js, targets-train.js):
   the scroll holds the camera between the page's framings, so the figure
   travels with the page, and each part of it gets the screen in turn. On
   a phone, or with the flat SVG figure, they stay the panels above. Each
   registers here as FLOW_DOCS[movement]:

     enter(from)  the movement opens as a page; `from` is the movement
                  before it (null on a fresh arrival)
     leave()      it closes, or stops being a page
     shot()       the framing the camera rests on now
     owns()       true while the wheel moves the page, not the stages
     atEnd()      true at the foot of the page: the way on shows there
     hint()       the footer's hint until then
     focus()      where focus goes as it opens                          */
const FLOW_DOCS = {};
const DOC_FIT = 455;          // the body's height on screen is DOC_FIT / d of the viewport
const docMount = document.querySelector("[data-anatomy-mount]");
let docOpen = null, docFace = null;

/** The page the movement `sub` is now, or null while it is a panel (or off stage). */
function flowDoc(sub = flow.sub) {
  return Stages.current === "targets" && docOpen === sub && flow.sub === sub ? FLOW_DOCS[sub] : null;
}

/** Opens the movement's page, after closing the one open, as the movement and the screen allow. */
function paintDocs(from = null) {
  const want = !Stages.narrow && figure.moves && FLOW_DOCS[flow.sub] ? flow.sub : null;
  if (docOpen) {
    FLOW_DOCS[docOpen].leave();
    pinGhost(null);
    figure.preview(null);
  }
  docOpen = want;
  docFace = null;
  delete Stages.root.dataset.face;
  if (want) Stages.root.dataset.doc = want; else delete Stages.root.dataset.doc;
  if (want) FLOW_DOCS[want].enter(from);
  paintGhost();
}

/**
 * A page's framings, each `prefix + key` in SCULPTURE_SHOTS (its Front and
 * Back alike: the page turns the body itself). set() changes one; fit()
 * sizes one to the room between `top` and `bottom` (px down the viewport),
 * so the figure is as large as it can be without anything crossing it.
 */
function docShots(prefix) {
  const shots = {};
  shots.set = (k, f) => {
    shots[k] = { ...(shots[k] || {}), ...f };
    for (const side of ["front", "back"])
      SCULPTURE_SHOTS[prefix + k + "-" + side] = { ...SCULPTURE_SHOTS["targets-front"], ...shots[k] };
  };
  shots.fit = (k, top, bottom) => {
    const ch = docMount.clientHeight || innerHeight;
    shots.set(k, { d: Math.max(430, DOC_FIT / Math.max(.3, (bottom - top) / ch)), sy: (top + bottom) / 2 / ch - .009 });
  };
  shots.name = k => prefix + k + "-front";
  return shots;
}

/**
 * Holds the camera `e` (eased) of the way from framing `a` to `b`, turning
 * the body's picking and Front / Back to the side it shows, and tells the
 * ground where the figure stands (--gx, --gy, --gs) for the ghost word.
 * Returns true when the side shown changed.
 */
function holdFigure(shots, a, b, e, live) {
  const A = shots[a], B = shots[b];
  const sx = A.sx + (B.sx - A.sx) * e, sy = A.sy + (B.sy - A.sy) * e;
  const daz = ((B.az - A.az) % 360 + 540) % 360 - 180, az = A.az + daz * e;
  const turned = docFaceTo(Math.cos(az * Math.PI / 180) < 0 ? "back" : "front");
  Stages.root.style.setProperty("--gx", sx.toFixed(4));
  Stages.root.style.setProperty("--gy", (sy - .07).toFixed(4));
  Stages.root.style.setProperty("--gs", (2 * Math.min(sx, 1 - sx) * 100 / 3.9).toFixed(2) + "vw");
  // The pages write their words low, at the shins, where they cross the
  // legs (flow-front.js weaves them through): --gyl, the line a fifth of
  // the body's height below its middle, and --gbw, how far the legs reach
  // either side of its axis, so the small meta line can stand beside them.
  const bh = DOC_FIT / (A.d + (B.d - A.d) * e);
  Stages.root.style.setProperty("--gyl", (sy + bh * .2).toFixed(4));
  Stages.root.style.setProperty("--gbw", Math.round(bh * (docMount.clientHeight || innerHeight) * .13) + "px");
  if (!live || Stages.phase !== "idle") return turned;
  if (a === b || e <= 0) figure.scrubShot(shots.name(a), shots.name(a), 1);
  else if (e >= 1) figure.scrubShot(shots.name(b), shots.name(b), 1);
  else figure.scrubShot(shots.name(a), shots.name(b), e);
  return turned;
}

function docFaceTo(f) {
  if (f === docFace) return false;
  docFace = f;
  Stages.root.dataset.face = f;
  const r = figure.renderer;
  if (r && r.view && r.view.id !== f) r.view = SCULPTURE_VIEWS.find(v => v.id === f);
  paintTurn(f);
  return true;
}

/**
 * Lets a page reach the foot of the screen, under the footer, and says
 * where it starts: its top and the viewport's height, in px.
 */
function docRoom(sub, doc) {
  let top = 0;
  for (let el = sub; el; el = el.offsetParent) top += el.offsetTop;
  const ch = docMount.clientHeight || innerHeight, foot = Math.max(0, ch - top - sub.offsetHeight);
  doc.style.bottom = -foot + "px";
  doc.style.setProperty("--foot", foot + "px");
  return { top, ch };
}

/** Once a page is still, the body can be pointed at again where it now stands. */
function settleFigure() {
  const r = figure.renderer;
  if (r) setTimeout(() => { if (r.pickSoon) r.pickSoon(); if (r.placeHitsSoon) r.placeHitsSoon(); }, 0);
}

/** Runs `step(dt)` every frame from a wake() until it returns false. */
function docTicker(step) {
  let last = 0, running = false;
  const frame = t => {
    const dt = Math.min(64, t - (last || t));
    last = t;
    if (step(dt)) requestAnimationFrame(frame);
    else { running = false; last = 0; }
  };
  return () => { if (!running) { running = true; requestAnimationFrame(frame); } };
}

/** A wheel event's distance, in px, whichever way it was turned. */
const wheelDelta = e => (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * (e.deltaMode === 1 ? 32 : 1);

const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty", "Twenty-one", "Twenty-two"];
/** "Seven", for a count written out in a sentence. */
const countWord = n => COUNT_WORDS[n] || String(n);

/** "A, B and C." */
const andList = names => names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0] || "";

/* ---------------------------- i: how it works ---------------------------- */

const chaptersEl = $("chapters");
let chapterDwell = 0;

function paintChapters() {
  for (const c of chaptersEl.querySelectorAll(".chapter")) {
    const on = Number(c.dataset.ch) === flow.chapter;
    c.classList.toggle("on", on);
    c.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

/** Plays chapter `i`: its line fills (css), and the camera goes where that stage will put it. */
function setChapter(i) {
  if (i === flow.chapter) return;
  flow.chapter = i;
  paintChapters();
  if (Stages.current === "targets" && flow.sub === "how" && !Stages.opening) figure.setShot(Stages.shot());
}

chaptersEl.addEventListener("click", e => {
  const c = e.target.closest(".chapter");
  if (c) setChapter(Number(c.dataset.ch));
});
chaptersEl.addEventListener("pointerover", e => {
  const c = e.target.closest(".chapter");
  clearTimeout(chapterDwell);
  if (c && Stages.phase === "idle") chapterDwell = setTimeout(() => setChapter(Number(c.dataset.ch)), FLOW_DWELL.chapter);
});
chaptersEl.addEventListener("pointerleave", () => clearTimeout(chapterDwell));
chaptersEl.addEventListener("focusin", e => {
  const c = e.target.closest(".chapter");
  if (c && e.target.matches(":focus-visible")) setChapter(Number(c.dataset.ch));
});
/* A chapter's line fills as it is read; when it has, the next one plays. */
chaptersEl.addEventListener("animationend", e => {
  if (e.animationName === "chFill" && flow.sub === "how") setChapter((flow.chapter + 1) % chaptersEl.children.length);
});

/* -------------------------- ii: what is chosen --------------------------- */

const ledgerEl = $("ledger");

/** Counts `el` up or down to `to`. */
function countTo(el, to) {
  const from = Number(el.textContent) || 0;
  cancelAnimationFrame(el._raf);
  if (from === to || reducedMotion()) { el.textContent = to; return; }
  const t0 = performance.now(), ms = 520;
  const step = now => {
    const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (to - from) * e);
    if (k < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

function renderLedger() {
  const ms = selection.muscles(), n = ms.length, src = selection.source();
  ledgerEl.toggleAttribute("data-empty", !n);
  countTo($("lg-n"), n);
  $("lg-noun").textContent = n === 1 ? "muscle group" : "muscle groups";
  $("lg-src").innerHTML =
    src.kind === "empty" ? "Nothing chosen yet. Apply a program, or " + (Stages.narrow ? "tap" : "click") + " a muscle on the sculpture." :
    src.kind === "program" ? "Exactly <b>" + esc(src.program.name) + "</b>, as the program has it." :
    src.kind === "modified" ? "<b>" + esc(src.program.name) + "</b>, edited by hand." :
    "Your own selection, muscle by muscle.";

  const fams = Object.keys(FAMILIES).map(k => ({ k, ms: ms.filter(m => m.family === k) })).filter(f => f.ms.length);
  for (const span of $("lg-bar").children) {
    const f = fams.find(x => x.k === span.dataset.f);
    span.style.flexGrow = f ? f.ms.length : 0;
  }
  // A family new to the selection slides in; the others stay put.
  $("lg-fams").innerHTML = fams.map((f, i) =>
    '<div class="lf' + (flow.families.has(f.k) ? '' : ' new') + '" data-family="' + f.k + '" style="--i:' + i + '">' +
      '<span class="lf-top"><span class="dot" style="background:var(--' + FAMILIES[f.k].css + ')"></span>' +
        '<span class="lf-name">' + FAMILIES[f.k].name + '</span><span class="lf-n">' + f.ms.length + '</span></span>' +
      '<span class="lf-ms">' + f.ms.map(m => esc(m.name)).join(" · ") + '</span>' +
    '</div>').join("");
  flow.families = new Set(fams.map(f => f.k));
  $("ledger-clear").hidden = !n;
}

ledgerEl.addEventListener("click", e => {
  if (e.target.closest("#ledger-clear")) { selection.clear(); $("targets-title").focus(); }
});
/* Pointing at a family shows its muscles on the sculpture, in the family's hue. */
ledgerEl.addEventListener("pointerover", e => {
  const fam = e.target.closest("[data-family]");
  if (fam) figure.preview(selection.muscles().filter(m => m.family === fam.dataset.family).map(m => m.id), fam.dataset.family);
});
ledgerEl.addEventListener("pointerout", e => {
  const from = e.target.closest("[data-family]");
  const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest("[data-family]");
  if (from && to !== from) figure.preview(null);
});

/* ---------------------------- iii: training focus ------------------------- */

/** The weekly hard sets a muscle starts from, for its experience and priority (estimate.js). */
function startingSets(m) {
  if (!exercisesFor(m.id).length) return 0;
  return weeklyTarget(m, routine.experience || DEFAULT_EXPERIENCE, selection.priority(m.id)) || 0;
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

/** The most weekly sets any of `ms` would get on Focus: the sets bars' full length. */
function maxSets(ms) {
  const exp = routine.experience || DEFAULT_EXPERIENCE;
  return Math.max(1, ...ms.map(m => exercisesFor(m.id).length ? weeklyTarget(m, exp, "focus") || 0 : 0));
}

function renderTrain() {
  const ms = selection.muscles(), key = ms.map(m => m.id).join();
  if (trainList.dataset.key !== key) {
    trainList.dataset.key = key;
    // The rows come in as the movement opens; redrawn after that, they just appear.
    trainList.classList.toggle("calm", Stages.phase === "idle");
    let i = 0;
    trainList.innerHTML = Object.keys(FAMILIES).map(k => {
      const fm = ms.filter(m => m.family === k);
      if (!fm.length) return "";
      return '<div class="tg" data-family="' + k + '"><span class="dot" style="background:var(--' + FAMILIES[k].css + ')"></span>' +
          '<span class="tg-name">' + FAMILIES[k].name + '</span><span class="tg-sets" data-tg="' + k + '"></span></div>' +
        fm.map(m => '<div class="tr" data-row="' + m.id + '" data-muscle="' + m.id + '" data-family="' + k + '" style="--i:' + (i++) + '">' +
          '<span class="tr-name">' + esc(m.name) + '</span>' +
          '<span class="dial" role="radiogroup" aria-label="' + esc(m.name) + ' priority">' +
            '<span class="dial-thumb" aria-hidden="true"></span>' +
            PRIORITY_CHOICES.map(([level, label]) =>
              '<button type="button" role="radio" data-priority="' + level + '" data-muscle="' + m.id + '">' + label + '</button>').join("") +
          '</span>' +
          '<span class="tr-sets"><span class="tr-bar"><span></span></span><span class="tr-v"></span></span>' +
          '<button type="button" class="row-x" data-remove="' + m.id + '" aria-label="Remove ' + esc(m.name) + '" title="Remove ' + esc(m.name) + '">×</button>' +
        '</div>').join("");
    }).join("");
  }
  const top = maxSets(ms), counts = { focus: 0, normal: 0, maintain: 0 }, famSets = {};
  let total = 0;
  for (const row of trainList.querySelectorAll(".tr")) {
    const m = MUSCLE_BY_ID.get(row.dataset.muscle), level = selection.priority(m.id), sets = startingSets(m);
    counts[level]++; total += sets; famSets[m.family] = (famSets[m.family] || 0) + sets;
    row.dataset.level = level;
    for (const b of row.querySelectorAll("[data-priority]")) {
      const on = b.dataset.priority === level;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    }
    row.querySelector(".tr-bar span").style.setProperty("--w", (sets / top).toFixed(3));
    row.querySelector(".tr-v").innerHTML = sets ? "<b>" + sets + "</b> sets a week" : "No exercises yet";
  }
  for (const el of trainList.querySelectorAll("[data-tg]"))
    el.textContent = famSets[el.dataset.tg] ? "≈ " + famSets[el.dataset.tg] + " sets" : "";
  $("tt-sets").textContent = total;
  $("tt-mix").innerHTML = PRIORITY_CHOICES.slice().reverse().map(([level, label]) =>
    '<span><b>' + counts[level] + '</b> ' + label.toLowerCase() + '</span>').join("");
  $("train-note").innerHTML = noExercisesNote(ms);
}

trainList.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.priority) selection.setPriority(b.dataset.muscle, b.dataset.priority);
  else if (b.dataset.remove) {
    // Keep keyboard focus on the list rather than dropping it on <body>.
    const rows = [...trainList.querySelectorAll(".tr")], i = rows.indexOf(b.closest(".tr"));
    const near = rows[i + 1] || rows[i - 1];
    selection.set(b.dataset.remove, false);
    const to = near && trainList.querySelector('[data-remove="' + near.dataset.muscle + '"]');
    if (to) to.focus();
    else if (Stages.current === "targets" && flow.sub === "train") $("train-title").focus();
  }
});

/* Pointing at a row lights its muscle; staying on it turns the body to the side that shows it. */
let pointedRow = null, turnDwell = 0;
trainList.addEventListener("pointerover", e => {
  const row = e.target.closest(".tr");
  if (!row || row === pointedRow) return;
  pointedRow = row;
  figure.preview([row.dataset.muscle], row.dataset.family);
  clearTimeout(turnDwell);
  turnDwell = setTimeout(() => {
    const want = FLOW_BACK.has(row.dataset.muscle) ? "back" : "front";
    if (Stages.phase === "idle" && figure.moves && turnedTo !== want) figure.turnTo(want);
  }, FLOW_DWELL.turn);
});
trainList.addEventListener("pointerleave", () => {
  pointedRow = null;
  clearTimeout(turnDwell);
  figure.preview(null);
});

/** Pointing at a muscle on the body marks its row, in the list or the document. */
function markRow(muscle) {
  const sub = $("stage-targets").querySelector(".sub-train");
  for (const row of sub.querySelectorAll(".pointed")) row.classList.remove("pointed");
  const row = muscle && Stages.root.dataset.sub === "train" && sub.querySelector('[data-row="' + muscle.id + '"]');
  if (row) row.classList.add("pointed");
}

/* --------------------------------- wiring -------------------------------- */

function renderTargets() {
  paintCaption();
  paintGhost();
  paintPrograms();
  renderLedger();
  renderTrain();
}

buildPrograms();
selection.onChange(renderTargets);

selection.onChange(() => {
  const empty = selection.isEmpty();
  // The first muscle chosen opens Training focus: the way on, now live, says so.
  if (flow.wasEmpty && !empty && document.readyState !== "loading") {
    const next = $("foot-next");
    next.classList.remove("fresh"); void next.offsetWidth; next.classList.add("fresh");
  }
  flow.wasEmpty = empty;
  if (empty && flow.sub === "train" && Stages.current === "targets") goSub("focus");
});

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
  arrive() {
    // The page opens where the user was (Stages.at), else on How it works;
    // coming back from a later stage lands on Training focus, unless
    // nothing is chosen any more.
    const back = !!Stages.from, empty = selection.isEmpty();
    const at = FLOW_SUBS.includes(Stages.at) && !(Stages.at === "train" && empty) ? Stages.at : null;
    // Back from the Measure with nothing chosen, its way back said Your muscles.
    flow.sub = at || (back && !empty ? "train" : back && Stages.from === "measure" ? "focus" : "how");
    flow.chapter = 0;
    setFlowDir(back ? -1 : 1);
    paintSub();
  },
  enter: renderTargets,
  place: () => flow.sub,
  shot() {
    const doc = flowDoc();
    if (doc) return doc.shot();
    return flow.sub === "how" ? "targets-how" + flow.chapter : flow.sub === "train" ? "targets-train" : "targets";
  },
  // How it works shows the figure; it is not yet the figure to pick on.
  interactive: () => flow.sub !== "how",
  // A page takes the wheel while it can still move; at either end, the stages have it.
  wheel: () => { const doc = flowDoc(); return doc && doc.owns() ? false : undefined; },
  focus() {
    const doc = flowDoc();
    return doc ? doc.focus() : $({ how: "how-title", focus: "targets-title", train: "train-title" }[flow.sub]);
  },
  footer() {
    const f = this.panelFooter(), doc = flowDoc();
    // On a page the way on shows at its foot; until then, a hint.
    if (doc && !doc.atEnd()) { f.next = ""; f.hint = doc.hint(); }
    return f;
  },
  panelFooter() {
    const empty = selection.isEmpty(), scroll = Stages.wide ? "or scroll" : "";
    if (flow.sub === "how") return { next: Stages.narrow ? "Continue →" : "Define your focus →", hint: scroll };
    if (flow.sub === "focus") return {
      back: "← How it works",
      next: Stages.narrow ? "Continue →" : "Training focus →",
      nextDisabled: empty,
      hint: empty ? "Select at least one muscle to continue." : scroll
    };
    return { back: "← Your muscles", next: Stages.narrow ? "Continue →" : "Continue to your measure →", hint: scroll };
  },
  onNext() {
    if (flow.sub === "how") goSub("focus");
    else if (flow.sub === "focus") goSub("train");
    else if (!selection.isEmpty()) Stages.go("measure");
    return true;
  },
  onBack() {
    if (flow.sub === "train") goSub("focus");
    else if (flow.sub === "focus") goSub("how");
    return true;
  }
});

/* Crossing to a phone's layout (or back) turns the pages into panels (or back). */
matchMedia(STAGE_NARROW).addEventListener("change", () => { if (Stages.current === "targets") paintDocs(); });
