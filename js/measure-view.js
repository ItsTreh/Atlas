/* ===========================================================================
   Measure stage: four facts for Nutrition's estimates (measure.js), between
   Targets and Nutrition. Design only for now: nothing in the app reads them
   yet.

   One page, scrolled, in the grammar of Targets' pages (targets-train.js):
   the scroll holds the camera between the page's framings, the figure
   crossing from side to side, and a quiet word behind the body names each
   part, woven through the legs (flow-front.js copies it).

     intro    what is asked, why, and where it goes; the figure right
     stature  a stadiometer stands beside the figure, its rule numbered
              from the soles to the crown in the user's own height

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
  const KEYS = ["intro", "stature"];
  const WORDS = { intro: "Measure", stature: "Stature" };
  const shots = docShots("measure-");
  shots.set("intro", { d: 560, sx: .70, sy: .50, az: -14 });
  shots.set("stature", { d: 540, sx: .29, sy: .50, az: 4 });

  /* -------------------------------- markup -------------------------------- */
  /* A coin, as the footer's (FOOT_COIN): a beaded rim, a fine ring, the sign struck in the field. */
  const coin = d => '<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="mzc-beads" cx="26" cy="26" r="24.2" pathLength="40"/>' +
    '<circle class="mzc-ring" cx="26" cy="26" r="20.5"/><path class="mzc-arr" d="' + d + '"/></svg>';
  const steps = (f, what) => '<div class="mz-steps">' +
    '<button type="button" class="mz-coin" data-step="-1" data-f="' + f + '" aria-label="Less ' + what + '">' + coin("M19 26h14") + '</button>' +
    '<button type="button" class="mz-coin" data-step="1" data-f="' + f + '" aria-label="More ' + what + '">' + coin("M19 26h14M26 19v14") + '</button></div>';
  const num = (f, label, ph) => '<input class="mz-num" data-f="' + f + '" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="' + label + '" placeholder="' + ph + '">';
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
    '</div></section>' +

    '<section class="mz-s" data-s="stature" data-side="r"><div class="mz-col">' +
      '<p class="eyebrow" data-r="0"><span class="n">I</span> / Stature</p>' +
      '<h2 class="mz-h" data-r="0">How <em>tall.</em></h2>' +
      '<div class="mz-read" data-r="1">' +
        '<label class="mz-field" data-u="metric">' + num("cm", "Height in centimetres", "158") + '<span class="mz-unit">cm</span></label>' +
        '<span class="mz-field" data-u="imperial">' + num("ft", "Height, feet", "5") + '<span class="mz-unit">ft</span>' + num("in", "Height, inches", "2") + '<span class="mz-unit">in</span></span>' +
        steps("cm", "height") +
      '</div>' +
      '<p class="mz-alt" data-r="1" data-alt="stature"></p>' +
      '<p class="mz-why" data-r="2"><b>Why it’s asked.</b> A taller frame carries more of what burns at rest. Height is one term in the resting-burn estimate, and nothing else reads it.</p>' +
    '</div></section>';

  const sec = $("stage-measure");
  const doc = sec.querySelector(".mz"), view = sec.querySelector(".mz-view"), page = sec.querySelector(".mz-page");
  let built = false, secEl = {};

  /* The word behind the body (the twin over the figure copies it). */
  const word = document.createElement("span");
  word.className = "mz-word";
  word.dataset.w = "measure";
  document.querySelector(".flow-ground").append(word);

  /* The stadiometer, over the figure, beside it. */
  const rule = document.createElement("div");
  rule.className = "mz-rule";
  rule.setAttribute("aria-hidden", "true");
  rule.innerHTML = '<span class="mzr-spine"></span><span class="mzr-floor"></span><span class="mzr-head"></span><span class="mzr-slide"></span>' +
    '<span class="mzr-ticks"></span><span class="mzr-val"><span class="mzr-n"></span><span class="mzr-u"></span><span class="mzr-cap"></span></span>';
  stage.append(rule);
  const ticksEl = rule.querySelector(".mzr-ticks");
  let ticksFor = null;

  function build() {
    page.innerHTML = HTML;
    secEl = {};
    for (const el of page.querySelectorAll(".mz-s")) secEl[el.dataset.s] = el;
    built = true;
    buildScales();
  }

  /* The scales, in the units chosen: the rule's ticks, every 10 cm or every 6 inches. */
  function buildScales() {
    if (!built || ticksFor === M.units) return;
    ticksFor = M.units;
    const metric = !M.imperial, stepC = metric ? 10 : 15.24, n = metric ? 25 : 16;
    let t = "";
    for (let i = 0; i <= n; i++) {
      const c = i * stepC, mj = metric ? i % 5 === 0 : i % 2 === 0;
      const lab = mj && i ? (metric ? String(c) : i / 2 + "′") : "";
      t += '<i class="mzr-t' + (mj ? " mj" : "") + '" data-c="' + c.toFixed(2) + '">' + (lab ? "<span>" + lab + "</span>" : "") + "</i>";
    }
    ticksEl.innerHTML = t;
  }

  /* --------------------------------- paint -------------------------------- */
  const q = s => page.querySelector(s), qa = s => page.querySelectorAll(s);
  /** Writes a field's value into its inputs, but the one being typed in; each input as wide as what it holds. */
  function setIn(f, v, except) {
    for (const i of qa('.mz-num[data-f="' + f + '"]')) {
      if (i !== except) i.value = v;
      i.style.setProperty("--len", Math.max(1, String(i.value || i.placeholder).length));
    }
  }
  function paint(except = null) {
    if (!built) return;
    buildScales();
    doc.dataset.units = M.units;
    const [ft, inch] = M.cm ? feetInches(M.cm) : ["", ""];
    setIn("cm", M.cm ? Math.round(M.cm) : "", except);
    setIn("ft", ft, except); setIn("in", inch, except);
    for (const el of qa("[data-show]")) {
      const k = el.dataset.show;
      if (show[k]) { const v = show[k](); el.textContent = v || "—"; el.classList.toggle("none", !v); }
    }
    for (const b of qa("[data-units]")) {
      const on = b.dataset.units === M.units;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    }
    q('[data-alt="stature"]').textContent = M.cm
      ? (M.imperial ? Math.round(M.cm) + " cm" : feetInches(M.cm)[0] + "′ " + feetInches(M.cm)[1] + "″") + ". The rule beside the figure is yours now."
      : "The marble stands 158 cm, as carved. And you?";
    paintRule();
  }

  /* The rule is numbered in the user's height: the crown is at their stature, or the marble's. */
  function paintRule() {
    const H = M.cm || SCULPTURE_SHOT_HEIGHT;
    for (const t of ticksEl.children) {
      const c = +t.dataset.c;
      t.style.bottom = (c / H * 100).toFixed(3) + "%";
      t.classList.toggle("off", c > H + .01);
    }
    rule.classList.toggle("empty", !M.cm);
    rule.querySelector(".mzr-n").textContent = M.cm ? (M.imperial ? feetInches(M.cm)[0] + "′ " + feetInches(M.cm)[1] + "″" : Math.round(M.cm)) : "158";
    rule.querySelector(".mzr-u").textContent = M.cm && M.imperial ? "" : "cm";
    rule.querySelector(".mzr-cap").textContent = M.cm ? "You" : "The marble";
    if (rule.offsetHeight) nearTicks();
  }

  /* -------------------------------- editing ------------------------------- */
  /** A field typed in: kept while it fits the limits, held to them once it is left (commit). */
  function onInput(i, commit) {
    const f = i.dataset.f, raw = String(i.value).trim(), n = parseFloat(raw.replace(",", "."));
    const fits = (field, v) => commit ? Number.isFinite(v) : BodyMeasure.fits(field, v);
    if (f === "cm") { if (fits("cm", n)) M.set("cm", n); else if (!raw) M.set("cm", null); }
    else if (f === "ft" || f === "in") {
      const ft = parseFloat(q('[data-f="ft"]').value), inch = parseFloat(q('[data-f="in"]').value) || 0;
      if (Number.isFinite(ft)) { const cm = (ft * 12 + inch) * 2.54; if (fits("cm", cm)) M.set("cm", cm); }
      else if (!raw && f === "ft") M.set("cm", null);
    }
    if (commit) save();
    paint(commit ? null : i);
  }

  /** One step of a field: a centimetre or an inch. */
  function stepF(f, dir) {
    if (f === "cm") {
      if (M.imperial) M.set("cm", ((M.cm ? Math.round(M.cm / 2.54) : 62) + dir) * 2.54);
      else M.set("cm", (M.cm ? Math.round(M.cm) : 158) + dir);
    }
    save();
    paint();
  }

  /* A coin held down keeps stepping. */
  let holdT = 0, holdI = 0;
  const stopHold = () => { clearTimeout(holdT); clearInterval(holdI); };
  page.addEventListener("pointerdown", e => {
    const b = e.target.closest("[data-step]");
    if (!b) return;
    e.preventDefault();
    stepF(b.dataset.f, +b.dataset.step);
    stopHold();
    holdT = setTimeout(() => { holdI = setInterval(() => stepF(b.dataset.f, +b.dataset.step), 70); }, 420);
  });
  addEventListener("pointerup", stopHold);
  addEventListener("pointercancel", stopHold);

  page.addEventListener("input", e => { if (e.target.matches(".mz-num")) onInput(e.target, false); });
  page.addEventListener("change", e => { if (e.target.matches(".mz-num")) onInput(e.target, true); });
  page.addEventListener("keydown", e => {
    const t = e.target, k = e.key;
    if (t.matches(".mz-num")) {
      const d = { ArrowUp: 1, ArrowDown: -1 }[k];
      if (d) { e.preventDefault(); stepF(t.dataset.f === "ft" || t.dataset.f === "in" ? "cm" : t.dataset.f, d * (e.shiftKey ? 10 : 1)); }
      else if (k === "Enter") t.blur();
      return;
    }
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
    // A coin is stepped on pointerdown; a click from the keyboard steps it here.
    const st = t.closest("[data-step]");
    if (st) { if (e.detail === 0) stepF(st.dataset.f, +st.dataset.step); return; }
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
    let vt = 0;
    for (let el = sec; el; el = el.offsetParent) vt += el.offsetTop;
    const ch = mount.clientHeight || innerHeight;
    shots.fit("stature", vt + 18, ch - 44);     // room above the crown for the headboard
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
      // Stature stands back from the rule, to the far side of the figure.
      word.style.setProperty("--k", (Math.min(1, 6.4 / Math.max(1, w.length)) * (k === "stature" ? .84 : 1)).toFixed(3));
      if (w) word.classList.add("on");
    }, 300);
  }

  /* A tick's number gives way where the crown's readout stands over it. */
  function nearTicks(h = rule.offsetHeight) {
    const H = M.cm || SCULPTURE_SHOT_HEIGHT, room = (rule.querySelector(".mzr-val").offsetHeight || 55) + 22;
    for (const t of ticksEl.children) t.classList.toggle("near", (H - +t.dataset.c) / H * h < room);
  }

  /* The rule stands beside the figure through the camera it holds now. */
  let rk = "";
  function placeRule() {
    let o = 0;
    if (live() && !Stages.narrow && built && stop.stature && SH) o = Math.max(0, Math.min(1, 1 - Math.abs((stop.stature.a - y) / SH) * 1.8));
    const r = o > 0 && figure.renderer, a = r && r.axisPoint && r.axisPoint(0), b = a && r.axisPoint(1);
    if (!a || !b || !isFinite(a.y) || !isFinite(b.y)) { if (rk !== "off") { rk = "off"; rule.style.opacity = "0"; } return; }
    const top = mount.offsetTop + b.y, h = a.y - b.y, x = mount.offsetLeft + a.x;
    const side = x < stage.clientWidth / 2 ? 1 : -1, reach = h * .19, gap = reach + 26, rx = x + side * gap;
    const key = [rx, top, h, o].map(v => v.toFixed(1)).join() + side;
    if (key === rk) return;
    rk = key;
    rule.style.transform = "translate(" + rx.toFixed(1) + "px," + top.toFixed(1) + "px)";
    rule.style.height = h.toFixed(1) + "px";
    rule.style.setProperty("--in", (gap + h * .03).toFixed(1) + "px");
    rule.style.setProperty("--fl", (gap + reach).toFixed(1) + "px");
    rule.dataset.side = side;
    rule.style.opacity = o.toFixed(3);
    nearTicks(h);
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
    placeRule();
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
