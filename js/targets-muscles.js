/* ===========================================================================
   Your muscles as one page, scrolled: the movement's document on a wide
   screen (targets.js, FLOW_DOCS). The scroll holds the camera between the
   page's framings, so the figure travels with the page:

     intro     what this is; the figure stands right
     programs  the figure crosses left. Every program on one reel, turned
               by the scroll: the one in view shows on the body, and under
               it the body's sixteen muscles stand as bars, risen where it
               trains them. Point at one to see it, click to start from it
     refine    the body as the tool, turned a little; beside it what it is
               for, its two sides (click one to turn) and what has changed
               from the program
     chosen    the figure crosses right; the selection in one sentence and
               its mix by family, the opening's mirror

   Down from the programs needs something chosen (or a skip). Once a
   program is chosen the reel ends at it: scrolling on goes straight to
   refine, and the programs after it are a click away (the ticks, or the
   next name on the reel). Past the end the wheel goes on to Training
   focus, and the way on only shows there.
   ========================================================================= */
(() => {
  const SECS = ["intro", "programs", "refine", "chosen"];
  const RKEYS = PROGRAMS.map((p, i) => "p" + i), LAST = PROGRAMS.length - 1;
  const KEYS = ["intro", ...RKEYS, "refine", "chosen"];
  const SEC_OF = { intro: "intro", refine: "refine", chosen: "chosen" };
  const REFINE_AZ = -14, TURN_MS = 950;
  const shots = docShots("targets-doc-");
  shots.set("intro", { d: 545, sx: .67, sy: .50, az: 0 });
  shots.set("refine", { d: 500, sx: .60, sy: .50, az: REFINE_AZ });
  shots.set("chosen", { d: 545, sx: .69, sy: .50, az: 16 });
  /* Each program framed from the side that shows it, turned a little, one way and then the other. */
  PROGRAMS.forEach((p, i) => {
    SEC_OF[RKEYS[i]] = "programs";
    const back = p.muscles.filter(id => FLOW_BACK.has(id)).length * 2 > p.muscles.length;
    shots.set(RKEYS[i], { d: 545, sx: .27, sy: .50, az: (back ? 180 : 0) + (i % 2 ? -16 : 16) });
  });
  const firstKey = s => KEYS.find(k => SEC_OF[k] === s);
  const lastKey = s => [...KEYS].reverse().find(k => SEC_OF[k] === s);
  const isBack = m => FLOW_BACK.has(m.id);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  /* -------------------------------- markup -------------------------------- */
  const pBtn = (p, i) => '<button type="button" class="px-n" data-program="' + p.id + '" data-i="' + i + '" aria-pressed="false">' +
    '<span class="px-nw">' + esc(p.name) + '</span><span class="px-nc">' + p.muscles.length + '</span></button>';
  const programsHTML = () => '<div class="px">' +
    '<span class="eyebrow" data-r="0">Start from a program</span>' +
    '<div class="pxr" data-r="1">' +
      '<div class="pxr-top"><div class="pxr-ticks">' + PROGRAM_GROUPS.map(g => '<span class="pxr-tg">' +
        PROGRAMS.filter(p => p.group === g.id).map(p =>
          '<button type="button" class="pxr-t" data-rjump="' + PROGRAMS.indexOf(p) + '" aria-label="' + esc(p.name) + '" title="' + esc(p.name) + '"></button>').join("") +
        '</span>').join("") + '</div><span class="pxr-gl"></span></div>' +
      '<div class="pxr-reel">' + PROGRAMS.map(pBtn).join("") +
        '<div class="pxr-cnt" aria-hidden="true"><span class="pxr-cn"></span><span class="pxr-cl">of ' + MUSCLES.length + ' muscles</span></div></div>' +
      '<div class="pxr-ros" aria-hidden="true">' + Object.keys(FAMILIES).map(k => {
        const ms = MUSCLES.filter(m => m.family === k);
        return '<div class="pxr-f" data-family="' + k + '" style="--fam:var(--' + FAMILIES[k].css + ');--c:' + ms.length + '">' +
          '<span class="pxr-bs">' + ms.map(m => '<i class="pxr-b" data-m="' + m.id + '"></i>').join("") + '</span>' +
          '<span class="pxr-fl"><span>' + FAMILIES[k].name + '</span><b class="pxr-fc"></b></span></div>';
      }).join("") + '</div>' +
      '<p class="pxr-read" aria-live="polite"></p>' +
      '<p class="px-why"></p>' +
      '<button type="button" class="ds-cue pxr-go"><span class="ds-cue-line" aria-hidden="true"></span><span class="pxr-gw"></span></button>' +
    '</div>' +
    '<div class="px-foot" data-r="3"><p class="px-state" aria-live="polite"></p>' +
      '<button type="button" class="text-link px-skip">or skip, and pick the muscles yourself ↓</button></div>' +
  '</div>';

  const sub = document.querySelector("#stage-targets .sub-focus");
  const doc = $("muscles-doc");
  doc.innerHTML = '<div class="doc-view"><div class="doc-page">' +
    '<section class="ds ds-intro" data-s="intro">' +
      '<p class="eyebrow" data-r="0"><span class="n">I</span> / Targets · Your muscles</p>' +
      '<h1 class="ds-title" id="doc-title" tabindex="-1" data-r="1">Define your <em>focus.</em></h1>' +
      '<p class="ds-lede" data-r="2">Choose the muscles this plan will build: start from a program, make it yours on the body, then look over what you have. Scroll down; the figure follows.</p>' +
      '<button type="button" class="ds-cue" data-key="programs" data-r="3"><span class="ds-cue-line" aria-hidden="true"></span>Scroll to begin</button>' +
    '</section>' +
    '<section class="ds ds-programs" data-s="programs">' + programsHTML() + '</section>' +
    '<section class="ds ds-refine" data-s="refine">' +
      '<div class="rf-side">' +
        '<span class="eyebrow" data-r="0">Refine on the body</span>' +
        '<p class="ds-aim" data-r="0">Make it <em>yours.</em></p>' +
        '<div class="rf-faces" data-r="1" role="group" aria-label="Turn the body">' +
          '<button type="button" class="rf-f" data-face="front"><span class="rf-f-w">The front</span><span class="rf-f-n"></span></button>' +
          '<button type="button" class="rf-f" data-face="back"><span class="rf-f-w">The back</span><span class="rf-f-n"></span></button>' +
        '</div>' +
        '<p class="ds-p rf-how" data-r="2">Lit muscles are in. Click one to drop it, a quiet one to add it, and a side to turn the body round.</p>' +
        '<div class="rf-log" data-r="3" aria-live="polite"></div>' +
      '</div>' +
    '</section>' +
    '<section class="ds ds-chosen" data-s="chosen">' +
      '<div class="cb">' +
        '<span class="eyebrow" data-r="0">What you have chosen</span>' +
        '<h2 class="cb-say" data-r="1"></h2>' +
        '<p class="cb-of" data-r="1"></p>' +
        '<div class="cb-mix" data-r="2">' + Object.keys(FAMILIES).map(k =>
          '<div class="cb-seg" data-family="' + k + '" style="--fam:var(--' + FAMILIES[k].css + ')">' +
            '<span class="cb-seg-bar" aria-hidden="true"></span>' +
            '<span class="cb-seg-name">' + FAMILIES[k].name + '</span>' +
            '<span class="cb-seg-n"></span></div>').join("") + '</div>' +
        '<div class="cb-end" data-r="3">' +
          '<button type="button" class="ds-cue cb-on"><span class="ds-cue-line" aria-hidden="true"></span>Next, decide which of them get the most work</button>' +
        '</div>' +
      '</div>' +
    '</section>' +
  '</div></div>';

  const view = doc.querySelector(".doc-view"), secEl = {};
  for (const el of doc.querySelectorAll(".ds")) secEl[el.dataset.s] = el;
  const P = secEl.programs, q = s => doc.querySelector(s);
  const live = () => !!flowDoc("focus");

  /* ------------------------------- geometry ------------------------------- */
  let H = 0, R = 0, max = 0, y = 0, target = 0, cur = null, skipped = false, atEnd = false, owns = false, movedAt = 0;
  let hover = null, hoverM = null, undo = null, rosterP = null;
  /* The reel ends at `fold`: the program started from, or one gone to past it. */
  let fold = LAST, foldFor = null;
  let turn = 0, turnFrom = 0, turnGoal = 0, turnAt = 0;
  const keyY = {};
  /* What the body shows when nothing is pointed at: on the reel, the program in view. */
  const base = () => cur === "programs" && rosterP ? rosterP.muscles : null;

  function measure() {
    const { top, ch } = docRoom(sub, doc);
    H = view.clientHeight || 1;
    R = Math.round(H * .46);
    let at = 0;
    KEYS.forEach((k, i) => {
      if (i) at += SEC_OF[k] !== SEC_OF[KEYS[i - 1]] ? H : RKEYS.indexOf(k) > fold ? 0 : R;
      keyY[k] = at;
    });
    max = keyY.chosen;
    for (const s of SECS) secEl[s].style.height = H + "px";
    y = Math.min(y, max); target = Math.min(target, max);
    for (const k of RKEYS) shots.fit(k, top - 12, ch - 30);
    shots.fit("refine", top - 12, ch - 26);
    shots.fit("chosen", top - 4, ch - 40);
  }
  /* Programs past the fold share its place: the nearest key is the first at a place. */
  const nearestKey = v => KEYS.reduce((b, k) => Math.abs(keyY[k] - v) < Math.abs(keyY[b] - v) ? k : b, KEYS[0]);
  /** The framings either side of `v`, and how far between them (eased). */
  function around(v) {
    let a = KEYS[0];
    for (const k of KEYS) if (keyY[k] <= v && keyY[k] > keyY[a]) a = k;
    const b = KEYS.find(k => keyY[k] > keyY[a]) || a, span = keyY[b] - keyY[a];
    const t = span ? Math.max(0, Math.min(1, (v - keyY[a]) / span)) : 0;
    return { a, b, e: t * t * (3 - 2 * t) };
  }
  const limit = () => selection.isEmpty() && !skipped ? keyY[lastKey("programs")] : max;
  function topOf(s) { const a = keyY[firstKey(s)], b = keyY[lastKey(s)]; return y < a ? a - y : y < b ? 0 : b - y; }

  /** Moves the fold, the page staying where it stands. */
  function setFold(i) {
    if (i === fold) return;
    const k = nearestKey(target), off = target - keyY[k], was = y - keyY[k];
    fold = i;
    if (!live()) return;
    measure();
    target = Math.min(max, keyY[k] + off);
    y = Math.min(max, keyY[k] + was);
    render();
  }
  /* A new program started from moves the fold to it; none (or your own selection) opens the whole reel. */
  function syncFold() {
    const p = applied();
    if (p === foldFor) return;
    foldFor = p;
    setFold(p ? PROGRAMS.indexOf(p) : LAST);
  }

  function render() {
    for (const s of SECS) {
      const t = topOf(s), p = t / H, a = Math.abs(p), el = secEl[s];
      el.style.transform = "translateY(" + t.toFixed(1) + "px)";
      el.style.opacity = Math.max(0, Math.min(1, 1.25 - a * 1.5)).toFixed(3);
      el.style.visibility = a > 1.1 ? "hidden" : "";
      el.style.setProperty("--p", p.toFixed(4));
    }
    holdRoster();
    const s = SEC_OF[nearestKey(y)];
    if (s !== cur) setSection(s);
    const g = around(y);
    if (holdFigure(shots, g.a, g.b, g.e, live())) paintRefine();
    const end = target >= max - 1;
    if (end !== atEnd) { atEnd = end; Stages.paintFooter(); }
  }

  /* Refine's turn: the two sides are one click apart, and the body walks round between them. */
  function setTurn(v) {
    turn = v;
    shots.set("refine", { az: REFINE_AZ - 180 * v });
  }
  function turnTo(f) {
    const g = f === "back" ? 1 : 0;
    if (g === turnGoal) return;
    turnFrom = turn; turnGoal = g; turnAt = performance.now();
    if (Math.abs(target - keyY.refine) > 1) go(keyY.refine);
    wake();
  }

  function setSection(s) {
    cur = s;
    Stages.root.dataset.docAt = s;
    hover = hoverM = null;
    figure.preview(base());
    paintPrograms(); paintBand();
    Stages.paintFooter();
  }

  /* ----------------------------- the programs ----------------------------- */
  const progOf = b => PROGRAM_BY_ID.get(b.dataset.program);
  const applied = () => { const src = selection.source(); return src.kind === "program" || src.kind === "modified" ? src.program : null; };
  const b = p => "<b>" + esc(p.name) + "</b>";
  function paintPrograms() {
    const src = selection.source(), on = applied();
    for (const n of P.querySelectorAll(".px-n")) {
      const p = progOf(n);
      n.classList.toggle("on", p === on);
      n.classList.toggle("edited", p === on && src.kind === "modified");
      n.setAttribute("aria-pressed", String(p === on));
    }
    if (rosterP) paintRoster(src, on);
    const show = hover || rosterP;
    P.querySelector(".px-why").textContent = show ? show.why : "";
    let say;
    if (undo && src.kind === "program" && src.program === undo.to)
      say = "Replaced your " + (undo.program ? "edited " + b(undo.program) : "own selection") + '. <button type="button" class="text-link px-undo">Undo</button>';
    else if (hover && hover !== rosterP) say = "Click to go to " + b(hover) + ".";
    else if (!hover && src.kind === "custom") say = "Your own selection is on the body.";
    else if (!hover && src.kind !== "empty") say = b(on) + (src.kind === "modified" ? ", made yours," : "") + " is on the body. Scroll on to make it yours ↓";
    else if (!hover) say = "Scroll through the programs; the body shows each in turn.";
    else if (!(src.kind === "program" && hover === on))
      say = (src.kind === "modified" && hover === on ? "Click to reset to " : "Click to start from ") + b(hover) +
        (src.kind === "empty" || hover === on ? "." : ". It replaces what you have.");
    else say = b(on) + " is on the body. Scroll on to make it yours ↓";
    P.querySelector(".px-state").innerHTML = say;
    P.querySelector(".px-skip").hidden = !selection.isEmpty() || skipped;
  }
  function point(p) {
    if (p === hover && !hoverM) return;
    hover = p; hoverM = null;
    figure.preview(p ? p.muscles : base());
    paintPrograms();
  }
  function pointMuscle(m) {
    if (m === hoverM) return;
    hover = null; hoverM = m;
    figure.preview([m.id], m.family);
    paintPrograms();
  }
  const unpoint = () => { if (hover || hoverM) { hover = hoverM = null; figure.preview(base()); paintPrograms(); } };
  const pointAt = el => {
    const n = el.closest && el.closest(".px-n");
    if (n) return point(progOf(n)), true;
    const bar = el.closest && el.closest(".pxr-b");
    if (bar) return pointMuscle(MUSCLE_BY_ID.get(bar.dataset.m)), true;
    return false;
  };
  P.addEventListener("pointerover", e => pointAt(e.target));
  P.addEventListener("pointerout", e => { const r = e.relatedTarget; if (!(r && r.closest && r.closest(".px-n, .pxr-b"))) unpoint(); });
  P.addEventListener("focusin", e => pointAt(e.target));
  P.addEventListener("focusout", e => { const r = e.relatedTarget; if (!(r && r.closest && r.closest(".px-n"))) unpoint(); });

  /* The reel, turned by the scroll. The one in view fills with ink and shows
     on the body; moving on runs a ripple through the bars, the way the page
     is going. */
  function holdRoster() {
    const t = Math.max(0, Math.min(fold, (y - keyY[RKEYS[0]]) / (R || 1)));
    const reel = P.querySelector(".pxr-reel"), row = reel.clientHeight * .34;
    for (const el of reel.querySelectorAll(".px-n")) {
      const d = Number(el.dataset.i) - t, aa = Math.abs(d);
      const off = Math.sign(d) * (Math.min(aa, 1) + Math.max(0, aa - 1) * .5) * row;
      el.style.transform = "translateY(-50%) translateY(" + off.toFixed(1) + "px) scale(" + Math.max(.42, 1 - Math.min(aa, 1.4) * .42).toFixed(3) + ")";
      el.style.opacity = Math.max(0, 1 - aa * .6).toFixed(3);
      el.style.visibility = aa > 1.9 ? "hidden" : "";
      el.classList.toggle("cur", aa < .5);
      el.tabIndex = aa < .5 ? 0 : -1;
    }
    const i = Math.round(t);
    if (PROGRAMS[i] !== rosterP) showRoster(PROGRAMS[i], rosterP ? i - PROGRAMS.indexOf(rosterP) : 1);
  }
  function showRoster(p, dir) {
    rosterP = p;
    const bars = [...P.querySelectorAll(".pxr-b")], N = bars.length;
    bars.forEach((bar, k) => {
      const on = p.muscles.includes(bar.dataset.m);
      if (on !== bar.classList.contains("in")) bar.style.setProperty("--d", (dir < 0 ? N - 1 - k : k) * 22 + "ms");
      bar.classList.toggle("in", on);
    });
    rollCount(p.muscles.length);
    const gl = P.querySelector(".pxr-gl"), gn = PROGRAM_TABS[p.group];
    if (gl.textContent !== gn) { gl.textContent = gn; gl.classList.remove("swap"); void gl.offsetWidth; gl.classList.add("swap"); }
    if (!hover && !hoverM && cur === "programs" && live()) figure.preview(p.muscles);
    paintBand(); paintPrograms();
  }
  /* The count's digits roll to their new value, the furthest right first. */
  function rollCount(v) {
    const el = P.querySelector(".pxr-cn"), txt = String(v);
    if (el.dataset.len !== String(txt.length)) {
      el.dataset.len = txt.length;
      el.innerHTML = [...txt].map(() => '<span class="rd"><span class="rd-c">' + [...Array(10).keys()].map(d => "<i>" + d + "</i>").join("") + '</span></span>').join("");
      void el.offsetWidth;
    }
    [...el.querySelectorAll(".rd-c")].forEach((c, j) => { c.style.setProperty("--v", txt[j]); c.style.transitionDelay = (txt.length - 1 - j) * 80 + "ms"; });
  }
  const listOf = p => {
    const s = andList(p.muscles.map(id => MUSCLE_BY_ID.get(id).name));
    return esc(s.charAt(0) + s.slice(1).toLowerCase()) + ".";
  };
  function paintRoster(src, on) {
    const p = rosterP, mine = !!on && on === p;
    for (const t of P.querySelectorAll(".pxr-t")) {
      const tp = PROGRAMS[t.dataset.rjump];
      t.classList.toggle("cur", tp === p);
      t.classList.toggle("has", tp === on);
      t.classList.toggle("ed", tp === on && src.kind === "modified");
    }
    for (const f of P.querySelectorAll(".pxr-f")) {
      const all = MUSCLES.filter(m => m.family === f.dataset.family), c = all.filter(m => p.muscles.includes(m.id)).length;
      f.querySelector(".pxr-fc").textContent = c + "/" + all.length;
      f.toggleAttribute("data-none", !c);
    }
    for (const bar of P.querySelectorAll(".pxr-b")) bar.classList.toggle("pt", !!hoverM && bar.dataset.m === hoverM.id);
    P.querySelector(".pxr-read").innerHTML = hoverM
      ? "<b>" + esc(hoverM.name) + "</b>" + (p.muscles.includes(hoverM.id) ? ", trained in " : ", not in ") + esc(p.name) + "."
      : p.muscles.length === MUSCLES.length ? "Every muscle on the body." : listOf(p);
    P.querySelector(".pxr-gw").innerHTML = mine ? "Now make it yours, on the body" : "Start from <b>" + esc(p.name) + "</b>";
    P.querySelector(".pxr-go").classList.toggle("done", mine);
  }

  /* Behind the body, the program in view runs as a band of cut letters. It
     goes on by itself, the page's scroll pushes it along, and pointing at
     anything holds it still. */
  const ground = document.querySelector(".flow-ground");
  const band = document.createElement("div");
  band.className = "pxs-band";
  band.setAttribute("aria-hidden", "true");
  band.innerHTML = '<div class="pxs-band-track"></div>';
  ground.append(band);
  const track = band.firstChild;
  let bandText = null, bx = 0, bv = 0, by = 0, halfW = 0;
  function paintBand() {
    const g = cur === "programs" && live() && rosterP ? rosterP.name : null;
    band.toggleAttribute("data-on", !!g);
    if (g) wake();
    if (!g || g === bandText) return;
    bandText = g;
    const run = '<div class="pb-half">' + Array.from({ length: 6 }, (_, w) => '<b class="pb-w">' +
      [...g].map((c, j) => '<i style="--j:' + (w * 3 + j) + '">' + (c === " " ? "&nbsp;" : esc(c)) + '</i>').join("") + '</b>').join("") + '</div>';
    track.innerHTML = run + run;
    halfW = 0;
    band.classList.remove("swap"); void band.offsetWidth; band.classList.add("swap");
  }
  /** Moves the band on; true while it has somewhere to go. */
  function driftBand(dt) {
    const on = band.hasAttribute("data-on");
    if (on) {
      const still = reduce.matches, held = hover || hoverM || ground.hasAttribute("data-pointed");
      bv += ((still || held ? 0 : .016) - bv) * (1 - Math.exp(-dt / 420));
      bx -= bv * dt + (still ? 0 : (y - by) * .6);
      if (!halfW && track.firstChild) halfW = track.firstChild.offsetWidth;
      if (halfW) { while (bx <= -halfW) bx += halfW; while (bx > 0) bx -= halfW; }
      track.style.transform = "translateX(" + bx.toFixed(1) + "px)";
    }
    by = y;
    return on && !reduce.matches;
  }

  function resetPrograms() { hover = hoverM = null; undo = null; }

  /* Taking a program over your own edits can be taken back. */
  function apply(p) {
    const src = selection.source();
    if (src.kind === "program" && src.program === p) return;
    undo = src.kind === "modified" ? { to: p, program: src.program, added: src.added.map(m => m.id), removed: src.removed.map(m => m.id) }
         : src.kind === "custom" ? { to: p, ids: selection.muscles().map(m => m.id) } : null;
    selection.applyProgram(p);
    figure.preview(p.muscles);
  }
  function unapply() {
    const u = undo;
    if (!u) return;
    undo = null;
    if (u.program) {
      selection.applyProgram(u.program);
      for (const id of u.added) selection.set(id, true);
      for (const id of u.removed) selection.set(id, false);
    } else {
      selection.clear();
      for (const id of u.ids) selection.set(id, true);
    }
    hover = hoverM = null; figure.preview(base());
  }

  /* --------------------------- refine and chosen --------------------------- */
  const names = (ms, k = 3) => ms.slice(0, k).map(m => esc(m.name)).join(", ") + (ms.length > k ? " +" + (ms.length - k) : "");
  function paintRefine() {
    const ms = selection.muscles(), src = selection.source(), back = ms.filter(isBack).length, face = docFace || "front";
    for (const f of doc.querySelectorAll(".rf-f")) {
      const n = f.dataset.face === "back" ? back : ms.length - back;
      f.querySelector(".rf-f-n").textContent = n;
      f.setAttribute("aria-pressed", String(f.dataset.face === face));
      f.setAttribute("aria-label", (f.dataset.face === "back" ? "The back" : "The front") + ", " + plural(n, "muscle group", "muscle groups") + " chosen");
    }
    let from, rows = "";
    if (src.kind === "empty") from = "Nothing chosen yet.";
    else if (src.kind === "program") from = "<b>" + esc(src.program.name) + "</b>, as the program has it.";
    else if (src.kind === "modified") {
      from = "<b>" + esc(src.program.name) + "</b>, made yours:";
      if (src.added.length) rows += '<span class="rf-d add"><i aria-hidden="true">+</i>' + names(src.added) + "</span>";
      if (src.removed.length) rows += '<span class="rf-d cut"><i aria-hidden="true">−</i>' + names(src.removed) + "</span>";
    } else from = "<b>Your own selection,</b> from nothing.";
    q(".rf-log").innerHTML = '<p class="rf-from">' + from + "</p>" + (rows ? '<p class="rf-ds">' + rows + "</p>" : "");
  }

  function gist(fams, n) {
    const ns = fams.map(f => FAMILIES[f.k].name.toLowerCase());
    if (fams.length === 4) return ", <em>across the whole body.</em>";
    if (fams.length === 1) return ", <em>all " + ns[0] + ".</em>";
    if (fams[0].ms.length / n >= .6) return ", <em>mostly " + ns[0] + ".</em>";
    return " of <em>" + andList(ns) + ".</em>";
  }
  function renderBoard() {
    const ms = selection.muscles(), n = ms.length, src = selection.source();
    const fams = Object.keys(FAMILIES).map(k => ({ k, ms: ms.filter(m => m.family === k) })).filter(f => f.ms.length);
    const ranked = [...fams].sort((a, z) => z.ms.length - a.ms.length);
    const total = ms.reduce((a, m) => a + startingSets(m), 0);
    q(".cb").toggleAttribute("data-empty", !n);
    q(".cb-say").innerHTML = !n ? "Nothing chosen, <em>yet.</em>" :
      countWord(n) + " muscle " + (n === 1 ? "group" : "groups") + gist(ranked, n);
    const by = src.kind === "program" ? " · " + esc(src.program.name) : src.kind === "modified" ? " · " + esc(src.program.name) + ", made yours" : "";
    q(".cb-of").innerHTML = !n ? "Scroll up to start from a program, or click muscles on the figure." :
      "<span>Of the body’s " + countWord(MUSCLES.length).toLowerCase() + by + '</span><span class="cb-sets">≈ ' + total + " hard sets a week to start</span>" +
      '<button type="button" class="text-link cb-clear">Clear</button>';
    for (const seg of doc.querySelectorAll(".cb-seg")) {
      const f = fams.find(x => x.k === seg.dataset.family), c = f ? f.ms.length : 0;
      seg.style.flexGrow = c;
      seg.toggleAttribute("data-none", !c);
      seg.querySelector(".cb-seg-n").textContent = c ? c + " · ≈ " + f.ms.reduce((a, m) => a + startingSets(m), 0) + " sets" : "";
    }
    q(".cb-on").hidden = !n;
  }
  q(".cb-mix").addEventListener("pointerover", e => {
    const r = e.target.closest("[data-family]");
    if (r) figure.preview(selection.muscles().filter(m => m.family === r.dataset.family).map(m => m.id), r.dataset.family);
  });
  q(".cb-mix").addEventListener("pointerleave", () => figure.preview(null));

  /* -------------------------------- motion -------------------------------- */
  let snapTimer = 0;
  const wake = docTicker(dt => {
    let moved = false;
    if (live()) {
      if (Math.abs(target - y) > .3) {
        y += (target - y) * (1 - Math.exp(-dt / 130));
        if (Math.abs(target - y) <= .3) { y = target; settleFigure(); }
        moved = true;
      }
      if (turn !== turnGoal) {
        const k = Math.min(1, (performance.now() - turnAt) / TURN_MS), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        setTurn(k >= 1 ? turnGoal : turnFrom + (turnGoal - turnFrom) * e);
        if (k >= 1) settleFigure();
        moved = true;
      }
      if (moved) render();
    }
    return driftBand(dt) || moved;
  });

  function nudge() {
    const n = q(".px-foot");
    n.classList.remove("nudge"); void n.offsetWidth; n.classList.add("nudge");
  }
  /* At rest, the page settles on the nearest framing. */
  function go(v) {
    const lim = limit();
    if (v > lim + 1 && lim < max) nudge();
    target = Math.max(0, Math.min(lim, v));
    movedAt = performance.now();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => { target = Math.min(limit(), keyY[nearestKey(target)]); wake(); }, 200);
    wake();
  }
  /* Going to a program past the fold opens the reel as far as it. */
  function goProgram(i) {
    if (i > fold) setFold(i);
    go(keyY[RKEYS[i]]);
  }
  /* Into the programs lands on the one you started from. */
  const progKey = () => applied() ? RKEYS[PROGRAMS.indexOf(applied())] : firstKey("programs");
  const goKey = k => { if (k === "refine" || k === "chosen") skipped = skipped || !selection.isEmpty(); go(keyY[k === "programs" ? progKey() : k]); };

  addEventListener("wheel", e => {
    owns = false;
    if (!live() || Stages.busy || e.ctrlKey) return;
    const d = wheelDelta(e);
    if (!d) return;
    const lim = limit(), can = d > 0 ? target < lim - .5 : target > .5;
    if (d > 0 && !can && lim < max) nudge();
    owns = can || performance.now() - movedAt < 650 || (d > 0 && lim < max);
    if (can) go(target + d);
  }, { capture: true, passive: true });

  addEventListener("keydown", e => {
    const el = e.target instanceof Element ? e.target : document.body;
    if (!live() || Stages.busy || el.closest("input, textarea, select")) return;
    const side = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (side && cur === "refine") { e.preventDefault(); turnTo(docFace === "back" ? "front" : "back"); return; }
    const dir = { PageDown: 1, ArrowDown: 1, PageUp: -1, ArrowUp: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    // A step goes to the next place on the page (the programs past the fold share one).
    const here = keyY[nearestKey(target)], places = [...new Set(KEYS.map(k => keyY[k]))];
    const to = dir > 0 ? places.find(v => v > here + .5) : places.reverse().find(v => v < here - .5);
    if (to !== undefined) go(to);
  });
  // The page is moved by the scroll, never by the browser bringing focus into view.
  doc.addEventListener("scroll", e => { const t = e.target; if (t.scrollTop || t.scrollLeft) { t.scrollTop = 0; t.scrollLeft = 0; } }, true);

  doc.addEventListener("click", e => {
    const t = e.target;
    const k = t.closest("[data-key]");
    if (k) return goKey(k.dataset.key);
    const pb = t.closest(".px-n"), rj = t.closest("[data-rjump]");
    if (rj) return goProgram(Number(rj.dataset.rjump));
    if (pb && progOf(pb) !== rosterP) return goProgram(PROGRAMS.indexOf(progOf(pb)));
    if (t.closest(".pxr-go")) return applied() === rosterP ? goKey("refine") : apply(rosterP);
    if (pb) return apply(progOf(pb));
    if (t.closest(".px-undo")) return unapply();
    if (t.closest(".px-skip")) { skipped = true; paintPrograms(); return go(keyY.refine); }
    const f = t.closest(".rf-f");
    if (f) return turnTo(f.dataset.face);
    if (t.closest(".cb-on")) return goSub("train");
    if (t.closest(".cb-clear")) { selection.clear(); go(keyY[firstKey("programs")]); }
  });
  selection.onChange(() => {
    if (selection.isEmpty()) skipped = false;
    syncFold();
    paintPrograms(); paintRefine(); renderBoard();
  });
  new ResizeObserver(() => { if (!live()) return; halfW = 0; measure(); render(); settleFigure(); }).observe(view);

  /* ------------------------------- the stage ------------------------------- */
  FLOW_DOCS.focus = {
    enter(from) {
      resetPrograms();
      foldFor = applied();
      fold = foldFor ? PROGRAMS.indexOf(foldFor) : LAST;
      measure();
      // From Training focus the page opens at what is chosen; otherwise at the top.
      y = target = keyY[from === "train" ? "chosen" : "intro"];
      turnFrom = turnGoal = 0; setTurn(0);
      cur = null;
      render(); paintRefine(); renderBoard(); settleFigure();
    },
    leave() {
      cur = null;
      hover = hoverM = null;
      paintBand();
      delete Stages.root.dataset.docAt;
    },
    shot: () => shots.name(nearestKey(y)).replace(/-front$/, ""),
    owns: () => owns,
    atEnd: () => atEnd,
    hint: () => limit() < max ? "" : "Scroll down",
    focus: () => $("doc-title")
  };

  paintPrograms(); paintRefine(); renderBoard();
})();
