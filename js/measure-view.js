/* ===========================================================================
   Measure stage: four facts for Nutrition's estimates (measure.js), between
   Targets and Nutrition. Design only for now: nothing in the app reads them
   yet.

   One page, scrolled, in the grammar of Targets' pages (targets-train.js):
   the scroll holds the camera between the page's framings, the figure
   crossing from side to side, and a quiet word behind the body names each
   part, woven through the legs (flow-front.js copies it).

     intro    what is asked, why, and where it goes; the figure right

   On a phone the parts stack in one column under the figure's band.
   ========================================================================= */
(() => {
  const M = bodyMeasure;
  loadMeasure(M);
  const save = () => saveMeasure(M);
  const live = () => Stages.current === "measure";
  const show = {
    stature: () => M.cm ? (M.imperial ? feetInches(M.cm)[0] + "′ " + feetInches(M.cm)[1] + "″" : Math.round(M.cm) + " cm") : "",
    mass: () => M.kg ? (M.imperial ? poundsOf(M.kg) + " lb" : kgText(M.kg) + " kg") : "",
    years: () => M.age ? M.age + " years" : "",
    physis: () => M.sex ? MEASURE_SEX[M.sex] : ""
  };
  /** A weight in kg, to a tenth where it has one. */
  const kgText = kg => { const r = Math.round(kg * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };

  const root = Stages.root, stage = $("anatomy-stage"), mount = stage.querySelector(".anatomy-viewport");

  /* ------------------------------- framings ------------------------------- */
  const KEYS = ["intro"];
  const WORDS = { intro: "Measure" };
  const shots = docShots("measure-");
  shots.set("intro", { d: 560, sx: .70, sy: .50, az: -14 });

  /* -------------------------------- markup -------------------------------- */
  const INDEX = [["stature", "I", "Stature", "Resting burn"], ["mass", "II", "Mass", "Resting burn · protein"],
    ["years", "III", "Years", "Resting burn"], ["physis", "IV", "Physiology", "The equation’s constant"]];

  const HTML =
    '<section class="mz-s" data-s="intro" data-side="l"><div class="mz-col">' +
      '<p class="eyebrow" data-r="0"><span class="n">II</span> / The measure</p>' +
      '<h1 class="mz-title" id="mz-title" tabindex="-1" data-r="1">Your <em>measure.</em></h1>' +
      '<p class="mz-lede" data-r="2">Four facts turn Nutrition’s estimate from an average into yours. They stay in this browser; change or clear them whenever you like.</p>' +
      '<ol class="mz-index" data-r="2">' + INDEX.map(([k, n, w, u]) =>
        '<li><button type="button" class="mz-ix" data-go="' + k + '"><span class="mz-ix-n">' + n + '</span><span class="mz-ix-w">' + w + '</span>' +
        '<span class="mz-ix-u">' + u + '</span><span class="mz-ix-v" data-show="' + k + '"></span></button></li>').join("") + '</ol>' +
      '<div class="mz-row" data-r="3">' +
        '<button type="button" class="mz-cue" data-go="stature"><span class="mz-cue-line" aria-hidden="true"></span>Scroll to begin</button>' +
        '<div class="mz-units" role="radiogroup" aria-label="Units"><button type="button" role="radio" data-units="metric">cm · kg</button><button type="button" role="radio" data-units="imperial">ft · lb</button></div>' +
      '</div>' +
    '</div></section>';

  const sec = $("stage-measure");
  const doc = sec.querySelector(".mz"), view = sec.querySelector(".mz-view"), page = sec.querySelector(".mz-page");
  let built = false, secEl = {};

  /* The word behind the body (the twin over the figure copies it). */
  const word = document.createElement("span");
  word.className = "mz-word";
  word.dataset.w = "measure";
  document.querySelector(".flow-ground").append(word);

  function build() {
    page.innerHTML = HTML;
    secEl = {};
    for (const el of page.querySelectorAll(".mz-s")) secEl[el.dataset.s] = el;
    built = true;
  }

  /* --------------------------------- paint -------------------------------- */
  const q = s => page.querySelector(s), qa = s => page.querySelectorAll(s);
  function paint() {
    if (!built) return;
    doc.dataset.units = M.units;
    for (const el of qa("[data-show]")) {
      const k = el.dataset.show;
      if (show[k]) { const v = show[k](); el.textContent = v || "—"; el.classList.toggle("none", !v); }
    }
    for (const b of qa("[data-units]")) {
      const on = b.dataset.units === M.units;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    }
  }

  /* -------------------------------- editing ------------------------------- */
  page.addEventListener("keydown", e => {
    const t = e.target, k = e.key;
    const grp = t.closest("[role=radiogroup]"), side = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[k];
    if (grp && side) {
      e.preventDefault();
      const bs = [...grp.querySelectorAll("[role=radio]")], i = Math.max(0, bs.findIndex(b => b.getAttribute("aria-checked") === "true"));
      const n = bs[(i + side + bs.length) % bs.length];
      n.click();
      n.focus({ preventScroll: true });
    }
  });

  page.addEventListener("click", e => {
    const t = e.target;
    const u = t.closest("[data-units]");
    if (u) { M.units = u.dataset.units; save(); paint(); return; }
    const g = t.closest("[data-go]");
    if (g && stop[g.dataset.go]) {
      const k = g.dataset.go;
      go(stop[k].a);
      // Then into its first field, once the page has arrived.
      const f = secEl[k].querySelector(".mz-field:not([hidden]) .mz-num, [role=radiogroup] [tabindex='0']");
      if (f && !Stages.narrow) setTimeout(() => { if (live() && nearestKey(target) === k) f.focus({ preventScroll: true }); }, 650);
    }
  });
  // The page is moved by the scroll, never by the browser bringing focus into view.
  doc.addEventListener("scroll", e => { const t = e.target; if (!Stages.narrow && (t.scrollTop || t.scrollLeft)) { t.scrollTop = 0; t.scrollLeft = 0; } }, true);
  page.addEventListener("focusin", e => {
    const s = e.target.closest(".mz-s");
    if (!s || !live() || Stages.narrow || dragging) return;
    const at = stop[s.dataset.s];
    if (at && Math.abs(at.a - target) > 1) go(at.a);
  });

  /* ------------------------------- geometry ------------------------------- */
  let SH = 0, max = 0, y = 0, target = 0, cur = null, atEnd = false, owns = false, movedAt = 0, dragging = null;
  const stop = {};
  function measure() {
    if (!built) return;
    SH = view.clientHeight || 1;
    KEYS.forEach((k, i) => { secEl[k].style.height = Stages.narrow ? "" : SH + "px"; stop[k] = { a: i * SH }; });
    max = stop[KEYS[KEYS.length - 1]].a;
    y = Math.min(y, max); target = Math.min(target, max);
  }
  function seg(v = y) {
    for (let i = 0; i < KEYS.length - 1; i++) {
      const a = stop[KEYS[i]].a, b = stop[KEYS[i + 1]].a;
      if (v <= a + .01) return { a: KEYS[i], b: KEYS[i], e: 0 };
      if (v < b - .01) { const t = (v - a) / (b - a); return { a: KEYS[i], b: KEYS[i + 1], e: t * t * (3 - 2 * t) }; }
    }
    const l = KEYS[KEYS.length - 1];
    return { a: l, b: l, e: 0 };
  }
  const nearestKey = (v = y) => { if (!stop.intro) return "intro"; const g = seg(v); return g.a === g.b ? g.a : g.e < .5 ? g.a : g.b; };
  const snapOf = v => KEYS.map(k => stop[k].a).reduce((b, a) => Math.abs(a - v) < Math.abs(b - v) ? a : b, 0);

  function render() {
    if (!built || !stop.intro) return;
    if (Stages.narrow) {
      for (const k of KEYS) { const el = secEl[k]; el.style.transform = el.style.opacity = el.style.visibility = ""; el.style.removeProperty("--p"); }
      if (cur !== "all") { cur = "all"; setWord(""); }
      return;
    }
    for (const k of KEYS) {
      const d = stop[k].a - y, p = d / SH, a = Math.abs(p), el = secEl[k];
      el.style.transform = "translateY(" + d.toFixed(1) + "px)";
      el.style.opacity = Math.max(0, Math.min(1, 1.25 - a * 1.5)).toFixed(3);
      el.style.visibility = a > 1.1 ? "hidden" : "";
      el.style.setProperty("--p", p.toFixed(4));
    }
    const g = seg(), k = nearestKey();
    if (k !== cur) setSection(k);
    camera(g);
    const end = target >= max - 1;
    if (end !== atEnd) { atEnd = end; Stages.paintFooter(); }
  }

  /* Holds the camera between the framings, and tells the word where the figure stands. */
  function camera(g) {
    const A = shots[g.a], B = shots[g.b], e = g.e, L = (p, q) => p + (q - p) * e;
    const sx = L(A.sx, B.sx), sy = L(A.sy, B.sy), bh = DOC_FIT / L(A.d, B.d);
    root.style.setProperty("--mzx", sx.toFixed(4));
    root.style.setProperty("--mzy", Math.min(.84, sy + bh * .2).toFixed(4));
    root.style.setProperty("--mzs", (2 * Math.min(sx, 1 - sx) * 100 / 3.9).toFixed(2) + "vw");
    if (Stages.phase !== "idle") return;
    if (g.a === g.b || e <= 0) figure.scrubShot(shots.name(g.a), shots.name(g.a), 1);
    else if (e >= 1) figure.scrubShot(shots.name(g.b), shots.name(g.b), 1);
    else figure.scrubShot(shots.name(g.a), shots.name(g.b), e);
  }

  function setSection(k) {
    cur = k;
    root.dataset.mzs = k;
    setWord(WORDS[k], k);
    for (const el of page.querySelectorAll(".mz-s.here")) el.classList.remove("here");
    secEl[k].classList.add("here");
    Stages.paintFooter();
  }

  let wordT = 0;
  function setWord(w, k = "") {
    if (word.dataset.to === w) return;
    word.dataset.to = w;
    word.classList.remove("on");
    clearTimeout(wordT);
    wordT = setTimeout(() => {
      word.textContent = w;
      word.dataset.k = k;
      word.style.setProperty("--k", Math.min(1, 6.4 / Math.max(1, w.length)).toFixed(3));
      if (w) word.classList.add("on");
    }, 300);
  }

  /* -------------------------------- motion -------------------------------- */
  let last = 0, snapTimer = 0;
  (function frame(t) {
    const dt = Math.min(64, t - (last || t)); last = t;
    if (live() && !Stages.narrow && Math.abs(target - y) > .3) {
      y += (target - y) * (1 - Math.exp(-dt / 130));
      if (Math.abs(target - y) <= .3) { y = target; settleFigure(); }
      render();
    }
    requestAnimationFrame(frame);
  })(0);
  function go(v) {
    if (Stages.narrow) return;
    target = Math.max(0, Math.min(max, v));
    movedAt = performance.now();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => { target = snapOf(target); }, 200);
  }

  addEventListener("wheel", e => {
    owns = false;
    if (!live() || Stages.busy || Stages.narrow || e.ctrlKey || dragging) return;
    const d = wheelDelta(e);
    if (!d) return;
    const can = d > 0 ? target < max - .5 : target > .5;
    owns = can || performance.now() - movedAt < 650;
    if (can) go(target + d);
  }, { capture: true, passive: true });

  addEventListener("keydown", e => {
    const el = e.target instanceof Element ? e.target : document.body;
    if (!live() || Stages.busy || Stages.narrow || el.closest("input, textarea, select, [role=slider], [role=radiogroup]")) return;
    const dir = { PageDown: 1, ArrowDown: 1, PageUp: -1, ArrowUp: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    const i = KEYS.indexOf(nearestKey(target)) + dir;
    if (KEYS[i]) go(stop[KEYS[i]].a);
  });
  new ResizeObserver(() => { if (live()) { measure(); render(); } }).observe(view);
  if (document.fonts) document.fonts.ready.then(() => { if (live()) { measure(); render(); } });

  /* ------------------------------- the stage ------------------------------- */
  function finish() {
    if (Stages.busy) return;
    M.sealed = new Date().toISOString().slice(0, 10);
    save();
    Stages.go("nutrition");
  }

  Stages.register("measure", {
    enter() {
      if (!built) build();
      paint(); measure();
      y = target = 0;
      cur = null; atEnd = false;
      render(); settleFigure();
    },
    shot: () => "measure-" + (Stages.narrow ? "intro" : nearestKey(y)),
    wheel: () => owns ? false : undefined,
    focus: () => $("mz-title"),
    footer() {
      const end = Stages.narrow || atEnd;
      return {
        back: selection.isEmpty() ? "← Your muscles" : "← Training focus",
        skip: end ? "" : "Skip for now",
        next: end ? (Stages.narrow ? "Continue →" : "Continue to nutrition →") : "",
        hint: end ? "" : "Scroll down"
      };
    },
    onNext() {
      if (Stages.narrow || atEnd) finish();
      else go(stop[KEYS[Math.min(KEYS.length - 1, KEYS.indexOf(nearestKey(target)) + 1)]].a);
      return true;
    },
    onBack() { Stages.go("targets"); return true; },
    onSkip() { Stages.go("nutrition"); return true; }
  });
})();
