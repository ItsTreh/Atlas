/* ===========================================================================
   Measure stage: four facts for Nutrition's estimates (measure.js), between
   Targets and Nutrition. Design only for now: nothing in the app reads them
   yet.

   The room is an instrument. The figure stands in the middle of it and
   three bronze rings hang round the body, each engraved with a scale and
   read at the front, where it passes under the index:

     stature   a ring at the crown, in centimetres or feet
     mass      a ring at the waist, in kilograms or pounds
     years     the widest ring, leaning, a mark a year

   A ring is turned by the hand (drag it, or swipe sideways), by its two
   coins, or by typing the number, and it keeps turning a little when let
   go. The scroll goes from one fact to the next; the body turns inside the
   rings as it does. Physiology is a choice, not a scale, so no ring turns
   for it. Each ring passes behind the body on its far side: it is drawn on
   two canvases, one under the sculpture and one over it.

   Last, the seal: the rings swing flat and close into one another, the
   figure steps out, and what was an instrument is the medal struck from
   it: the three dials, the four facts inscribed round them, a name in the
   field. Once all four are given, or coming back from Nutrition, the
   stage opens there.

   On a phone there are no rings: the facts stack in one column, typed or
   stepped.
   ========================================================================= */
(() => {
  const M = bodyMeasure;
  loadMeasure(M);
  const save = () => saveMeasure(M);
  const live = () => Stages.current === "measure";
  const root = Stages.root, stage = $("anatomy-stage"), mount = stage.querySelector(".anatomy-viewport");
  const sec = $("stage-measure"), doc = sec.querySelector(".arm");
  const PI = Math.PI;

  const KEYS = ["stature", "mass", "years", "physis", "seal"];
  const NAMES = { stature: "Stature", mass: "Mass", years: "Years", physis: "Physiology", seal: "The seal" };
  const USES = { stature: "Resting burn", mass: "Resting burn · protein", years: "Resting burn", physis: "The equation’s constant" };
  /** A weight in kg, to a tenth where it has one. */
  const kgText = kg => { const r = Math.round(kg * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
  const show = {
    stature: () => M.cm ? (M.imperial ? feetInches(M.cm)[0] + "′ " + feetInches(M.cm)[1] + "″" : Math.round(M.cm) + " cm") : "",
    mass: () => M.kg ? (M.imperial ? poundsOf(M.kg) + " lb" : kgText(M.kg) + " kg") : "",
    years: () => M.age ? M.age + " years" : "",
    physis: () => M.sex ? MEASURE_SEX[M.sex] : ""
  };
  const SEX_NOTE = {
    female: "The female constant is used.",
    male: "The male constant is used.",
    unspecified: "The midpoint of the two is used, so the estimate is a little less exact either way.",
    none: "Choose one, or leave it: the midpoint would be used."
  };

  /* ------------------------------- the rings ------------------------------ */
  /* Where each ring hangs (`at`, a share of the figure's height from the
     soles), how wide it is (`r`, in figure heights), how far it is seen
     from above (`k`: 1 would be a circle) and how it leans (`roll`). Its
     scale is in the units shown: [lo, hi], the step a value moves by, a
     mark every `tick`, a longer one every `mid`, a number every `major`,
     and how many degrees of the ring one unit takes. */
  const lim = (f, i, per = 1) => (i ? Math.floor : Math.ceil)(MEASURE_LIMITS[f][i] / per);
  const RINGS = {
    stature: {
      at: 1.035, r: .2, k: .2, roll: 0,
      scale: () => M.imperial
        ? { lo: lim("cm", 0, 2.54), hi: lim("cm", 1, 2.54), step: 1, tick: 1, mid: 6, major: 12, deg: 5.2, def: 62, label: u => u / 12 + "′" }
        : { lo: lim("cm", 0), hi: lim("cm", 1), step: 1, tick: 1, mid: 5, major: 10, deg: 2.7, def: 158, label: String },
      get: () => M.cm === null ? null : M.imperial ? M.cm / 2.54 : M.cm,
      put: v => M.set("cm", M.imperial ? v * 2.54 : v)
    },
    mass: {
      at: .56, r: .335, k: .2, roll: 0,
      scale: () => M.imperial
        ? { lo: lim("kg", 0, KG_PER_LB), hi: lim("kg", 1, KG_PER_LB), step: 1, tick: 2, mid: 10, major: 20, deg: 1.35, def: 154, label: String }
        : { lo: lim("kg", 0), hi: lim("kg", 1), step: .5, tick: 1, mid: 5, major: 10, deg: 2.7, def: 70, label: String },
      get: () => M.kg === null ? null : M.imperial ? M.kg / KG_PER_LB : M.kg,
      put: v => M.set("kg", M.imperial ? v * KG_PER_LB : v)
    },
    years: {
      at: .5, r: .46, k: .3, roll: -.34,
      scale: () => ({ lo: lim("age", 0), hi: lim("age", 1), step: 1, tick: 1, mid: 5, major: 10, deg: 3.3, def: 30, label: String }),
      get: () => M.age, put: v => M.set("age", v)
    }
  };
  const RING_KEYS = Object.keys(RINGS);
  /* Each ring as it is drawn: where its scale stands under the index (pos,
     easing to `to` or coasting at `vel` units a ms), and how far it is the
     one in hand (act, 0–1). */
  const st = {};
  for (const k of RING_KEYS) st[k] = { pos: RINGS[k].scale().def, to: RINGS[k].scale().def, vel: 0, act: 0 };

  /* -------------------------------- markup -------------------------------- */
  /* A coin, as the footer's (FOOT_COIN): a beaded rim, a fine ring, the sign struck in the field. */
  const coin = d => '<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="mzc-beads" cx="26" cy="26" r="24.2" pathLength="40"/>' +
    '<circle class="mzc-ring" cx="26" cy="26" r="20.5"/><path class="mzc-arr" d="' + d + '"/></svg>';
  const steps = (k, what) => '<div class="arm-steps">' +
    '<button type="button" class="arm-coin" data-step="-1" data-k="' + k + '" aria-label="Less ' + what + '">' + coin("M19 26h14") + '</button>' +
    '<button type="button" class="arm-coin" data-step="1" data-k="' + k + '" aria-label="More ' + what + '">' + coin("M19 26h14M26 19v14") + '</button></div>';
  const num = (f, label, ph) => '<input class="arm-num" data-f="' + f + '" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="' + label + '" placeholder="' + ph + '">';
  const read = (k, title, body) => '<section class="arm-read" data-k="' + k + '" aria-labelledby="arm-h-' + k + '">' +
    '<h2 class="arm-name" id="arm-h-' + k + '">' + title + '</h2>' + body + '</section>';

  doc.innerHTML =
    '<div class="arm-intro">' +
      '<p class="eyebrow"><span class="n">II</span> / Measure</p>' +
      '<h1 class="arm-title" id="mz-title" tabindex="-1">Take your measure</h1>' +
      '<p class="arm-lede">Four facts turn Nutrition’s estimate from an average into yours. Turn a ring to set it, or type the number.</p>' +
      '<ol class="arm-index">' + KEYS.slice(0, 4).map((k, i) =>
        '<li><button type="button" class="arm-ix" data-go="' + k + '"><span class="arm-ix-n">' + romanNumeral(i + 1) + '</span>' +
        '<span class="arm-ix-w">' + NAMES[k] + '</span><span class="arm-ix-v" data-show="' + k + '"></span></button></li>').join("") +
        '<li><button type="button" class="arm-ix arm-ix-seal" data-go="seal"><span class="arm-ix-n" aria-hidden="true">✦</span>' +
        '<span class="arm-ix-w">The seal</span><span class="arm-ix-v" data-show="seal"></span></button></li></ol>' +
      '<div class="arm-units" role="radiogroup" aria-label="Units"><button type="button" role="radio" data-units="metric">cm · kg</button>' +
        '<button type="button" role="radio" data-units="imperial">ft · lb</button></div>' +
    '</div>' +
    '<div class="arm-reads">' +
      read("stature", "How tall",
        '<div class="arm-val"><label class="arm-field" data-u="metric">' + num("cm", "Height in centimetres", "158") + '<span class="arm-unit">cm</span></label>' +
          '<span class="arm-field" data-u="imperial">' + num("ft", "Height, feet", "5") + '<span class="arm-unit">ft</span>' + num("in", "Height, inches", "2") + '<span class="arm-unit">in</span></span>' +
          steps("stature", "height") + '</div>' +
        '<p class="arm-alt" data-alt="stature"></p>' +
        '<p class="arm-why">A taller frame carries more of what burns at rest. Height is one term in the resting-burn estimate, and nothing else reads it.</p>') +
      read("mass", "How heavy",
        '<div class="arm-val"><label class="arm-field">' + num("kg", "Body weight", "70") + '<span class="arm-unit" data-unit="kg"></span></label>' + steps("mass", "weight") + '</div>' +
        '<p class="arm-alt" data-alt="mass"></p>' +
        '<p class="arm-why">The largest term in the resting-burn estimate, and the base for protein, counted in grams per kilogram. Today’s weight is enough; change it as you do.</p>') +
      read("years", "How many years",
        '<div class="arm-val"><label class="arm-field">' + num("age", "Age in years", "30") + '<span class="arm-unit">years</span></label>' + steps("years", "age") + '</div>' +
        '<p class="arm-alt" data-alt="years"></p>' +
        '<p class="arm-why">Resting burn eases slowly with the years, by roughly five calories a day for each one. An estimate, like every figure here.</p>') +
      read("physis", "Which physiology",
        '<div class="arm-phys" role="radiogroup" aria-label="Physiology for the estimate">' +
          Object.entries(MEASURE_SEX).map(([k, w]) => '<button type="button" role="radio" data-sex="' + k + '">' + w + '</button>').join("") + '</div>' +
        '<p class="arm-alt" data-alt="physis" aria-live="polite"></p>' +
        '<p class="arm-why">The standard resting-burn equations add a different constant for female and male physiology, about 166 kcal a day apart. Only that equation reads it; nothing else in ATLAS changes.</p>') +
      read("seal", "Your measure",
        '<p class="arm-alt" data-show="credit"></p>' +
        '<ul class="arm-facts">' + KEYS.slice(0, 4).map(k => '<li><span data-pl="' + k + '"></span><span class="arm-use">' + USES[k] + '</span>' +
          '<button type="button" class="text-link" data-go="' + k + '" aria-label="Edit ' + NAMES[k].toLowerCase() + '">Edit</button></li>').join("") + '</ul>' +
        '<div class="arm-own">' +
          '<label class="own-name"><span class="own-l">In the field</span>' +
            '<input class="own-in" maxlength="' + MEASURE_NAME_MAX + '" placeholder="You" autocomplete="off" spellcheck="false" aria-label="A name for the seal’s field"></label>' +
          '<div class="own-ink-w"><span class="own-l" aria-hidden="true">The ink</span><div class="own-ink" role="radiogroup" aria-label="The seal’s ink">' +
            Object.entries(MEASURE_INKS).map(([k, w]) => '<button type="button" role="radio" data-ink="' + k + '" aria-label="' + w + '" title="' + w + '"><i></i></button>').join("") +
          '</div></div>' +
        '</div>' +
        '<button type="button" class="quiet-btn arm-clear">Clear the seal</button>' +
        '<p class="arm-why">Kept in this browser only. The name and the ink are for the seal alone.</p>') +
    '</div>';
  const reads = doc.querySelector(".arm-reads");
  const q = s => doc.querySelector(s), qa = s => doc.querySelectorAll(s);

  /* The rings' two canvases: the far halves under the sculpture, the near halves over it. */
  const layer = cls => { const c = document.createElement("canvas"); c.className = "arm-canvas " + cls; c.setAttribute("aria-hidden", "true"); return c; };
  const back = layer("arm-back"), front = layer("arm-front");
  mount.before(back); mount.after(front);

  /* --------------------------------- paint -------------------------------- */
  /** Writes a field's value into its inputs, but the one being typed in; each input as wide as what it holds. */
  function setIn(f, v, except) {
    for (const i of qa('.arm-num[data-f="' + f + '"]')) {
      if (i !== except) i.value = v;
      i.style.setProperty("--len", Math.max(1, String(i.value || i.placeholder).length));
    }
  }
  function paint(except = null) {
    doc.dataset.units = M.units;
    const [ft, inch] = M.cm ? feetInches(M.cm) : ["", ""];
    setIn("cm", M.cm ? Math.round(M.cm) : "", except);
    setIn("ft", ft, except); setIn("in", inch, except);
    setIn("kg", M.kg ? (M.imperial ? poundsOf(M.kg) : kgText(M.kg)) : "", except);
    setIn("age", M.age || "", except);
    q('.arm-num[data-f="kg"]').setAttribute("aria-label", M.imperial ? "Body weight in pounds" : "Body weight in kilograms");
    q('[data-unit="kg"]').textContent = M.imperial ? "lb" : "kg";
    for (const el of qa("[data-show]")) {
      const k = el.dataset.show;
      if (show[k]) { const v = show[k](); el.textContent = v || "—"; el.classList.toggle("none", !v); }
    }
    q('[data-show="seal"]').textContent = M.complete ? "Struck" : M.given + " of 4";
    for (const b of qa("[data-units]")) {
      const on = b.dataset.units === M.units;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    }
    q('[data-alt="stature"]').textContent = M.cm
      ? (M.imperial ? Math.round(M.cm) + " cm" : feetInches(M.cm)[0] + "′ " + feetInches(M.cm)[1] + "″") + ", read at the crown."
      : "The marble stands 158 cm, as carved. And you?";
    q('[data-alt="mass"]').textContent = M.kg ? (M.imperial ? kgText(M.kg) + " kg" : poundsOf(M.kg) + " lb") + ", read at the waist." : "Turn the ring at the waist, or type it.";
    q('[data-alt="years"]').textContent = M.age ? romanNumeral(M.age) + ", a mark a year." : "Turn the widest ring, a mark a year.";
    q('[data-alt="physis"]').textContent = SEX_NOTE[M.sex || "none"];
    for (const b of qa("[data-sex]")) {
      const on = b.dataset.sex === M.sex;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on || (!M.sex && b.dataset.sex === "female") ? 0 : -1;
    }
    const PL = {
      years: M.age ? "Aged " + M.age : "Age not given",
      physis: M.sex ? (M.sex === "unspecified" ? "Physiology not said" : MEASURE_SEX[M.sex] + " physiology") : "Physiology not given",
      stature: M.cm ? show.stature() + " tall" : "Height not given",
      mass: M.kg ? show.mass() : "Weight not given"
    };
    for (const el of qa("[data-pl]")) { el.textContent = PL[el.dataset.pl]; el.classList.toggle("none", !show[el.dataset.pl]()); }
    for (const b of qa(".own-ink [data-ink]")) { const on = b.dataset.ink === M.ink; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; }
    const ni = q(".own-in");
    if (ni !== document.activeElement) ni.value = M.name || "";
    const day = new Date((M.sealed || new Date().toISOString().slice(0, 10)) + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    q('[data-show="credit"]').textContent = M.complete ? "Struck " + day + ", in this browser. Never sent anywhere."
      : ["Nothing given yet", "One fact given", "Two facts given", "Three facts given"][M.given] + "; the seal is struck with all four.";
    // Each ring turns to its value, unless the hand has it or it is still coasting.
    for (const k of RING_KEYS) {
      const v = RINGS[k].get(), s = st[k];
      s.to = v === null ? RINGS[k].scale().def : v;
      if (unitsFor !== M.units) { s.pos = s.to; s.vel = 0; }
    }
    unitsFor = M.units;
    if (wasComplete !== M.complete) { wasComplete = M.complete; if (M.complete && focus === "seal") punch = 1; }
    dirty = true;
  }
  let unitsFor = M.units, wasComplete = M.complete, dirty = true;

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
    } else if (f === "kg") {
      const kg = M.imperial ? n * KG_PER_LB : Math.round(n * 10) / 10;
      if (fits("kg", kg)) M.set("kg", kg); else if (!raw) M.set("kg", null);
    } else if (f === "age") { if (fits("age", n)) M.set("age", n); else if (!raw) M.set("age", null); }
    if (commit) save();
    paint(commit ? null : i);
  }

  /** A ring's value from where its scale stands: the nearest step, inside its limits. */
  function readRing(k) {
    const sc = RINGS[k].scale(), v = Math.max(sc.lo, Math.min(sc.hi, Math.round(st[k].pos / sc.step) * sc.step));
    const now = RINGS[k].get();
    if (now !== null && Math.abs(now - v) < sc.step / 2) return;
    RINGS[k].put(v);
    paint();
  }
  /** Turns a ring by `n` steps of its scale. */
  function stepRing(k, n) {
    const sc = RINGS[k].scale(), now = RINGS[k].get();
    const from = now === null ? sc.def : Math.round(now / sc.step) * sc.step;
    RINGS[k].put(Math.max(sc.lo, Math.min(sc.hi, from + n * sc.step)));
    st[k].vel = 0;
    save();
    paint();
  }

  /* A coin held down keeps stepping. */
  let holdT = 0, holdI = 0;
  const stopHold = () => { clearTimeout(holdT); clearInterval(holdI); };
  doc.addEventListener("pointerdown", e => {
    const b = e.target.closest("[data-step]");
    if (b) {
      e.preventDefault();
      const go = () => stepRing(b.dataset.k, +b.dataset.step);
      go();
      stopHold();
      holdT = setTimeout(() => { holdI = setInterval(go, 70); }, 420);
      return;
    }
    // A ring taken by the hand.
    if (Stages.narrow || e.target.closest("button, input, label, [role=radiogroup]") || (e.pointerType === "mouse" && e.button !== 0)) return;
    const k = ringAt(e.clientX, e.clientY);
    if (!k) return;
    e.preventDefault();
    if (focus !== k) setFocus(k);
    st[k].vel = 0;
    drag = { k, x: e.clientX, from: st[k].pos, lx: e.clientX, lt: performance.now(), v: 0 };
    doc.classList.add("turning");
  });
  addEventListener("pointermove", e => {
    if (!live() || Stages.narrow) return;
    lampTo = e.clientX / innerWidth * 2 - 1;
    if (!drag) { doc.classList.toggle("over-ring", !e.target.closest || !e.target.closest("button, input, label") ? !!ringAt(e.clientX, e.clientY) : false); return; }
    const s = st[drag.k], sc = RINGS[drag.k].scale(), per = unitPx(drag.k);
    s.pos = Math.max(sc.lo, Math.min(sc.hi, drag.from - (e.clientX - drag.x) / per));
    const now = performance.now(), dt = Math.max(1, now - drag.lt);
    drag.v = drag.v * .6 + (-(e.clientX - drag.lx) / per / dt) * .4;
    drag.lx = e.clientX; drag.lt = now;
    readRing(drag.k);
    dirty = true;
  }, { passive: true });
  const endDrag = () => {
    stopHold();
    if (!drag) return;
    // Let go while moving, it coasts; let go at rest, it stays.
    st[drag.k].vel = performance.now() - drag.lt < 80 ? drag.v : 0;
    drag = null;
    doc.classList.remove("turning");
    save();
  };
  addEventListener("pointerup", endDrag);
  addEventListener("pointercancel", endDrag);

  doc.addEventListener("input", e => {
    if (e.target.matches(".arm-num")) onInput(e.target, false);
    else if (e.target.matches(".own-in")) { M.name = e.target.value.trim().slice(0, MEASURE_NAME_MAX) || null; dirty = true; }
  });
  doc.addEventListener("change", e => {
    if (e.target.matches(".arm-num")) onInput(e.target, true);
    else if (e.target.matches(".own-in")) { save(); punch = 1; }
  });
  const ringOf = f => f === "kg" ? "mass" : f === "age" ? "years" : "stature";
  doc.addEventListener("keydown", e => {
    const t = e.target, k = e.key;
    if (t.matches(".arm-num")) {
      const d = { ArrowUp: 1, ArrowDown: -1 }[k];
      if (d) { e.preventDefault(); stepRing(ringOf(t.dataset.f), d * (e.shiftKey ? 10 : 1)); }
      else if (k === "Enter") t.blur();
      return;
    }
    if (t.matches(".own-in")) { if (k === "Enter") t.blur(); return; }
    const grp = t.closest("[role=radiogroup]"), side = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[k];
    if (grp && side) {
      e.preventDefault();
      const bs = [...grp.querySelectorAll("[role=radio]")], i = Math.max(0, bs.findIndex(b => b.getAttribute("aria-checked") === "true"));
      const n = bs[(i + side + bs.length) % bs.length];
      n.click();
      n.focus({ preventScroll: true });
    }
  });
  doc.addEventListener("click", e => {
    const t = e.target;
    // A coin is stepped on pointerdown; a click from the keyboard steps it here.
    const stp = t.closest("[data-step]");
    if (stp) { if (e.detail === 0) stepRing(stp.dataset.k, +stp.dataset.step); return; }
    const sx = t.closest("[data-sex]");
    if (sx) { M.set("sex", sx.dataset.sex); save(); paint(); return; }
    const u = t.closest(".arm-units [data-units]");
    if (u) { M.units = u.dataset.units; save(); paint(); return; }
    const ik = t.closest(".own-ink [data-ink]");
    if (ik) { M.ink = ik.dataset.ink; save(); paint(); punch = 1; return; }
    const g = t.closest("[data-go]");
    if (g) { setFocus(g.dataset.go, e.detail === 0 || !!t.closest(".arm-facts")); return; }
    if (t.closest(".arm-clear")) {
      M.clear();
      save(); paint();
      announce("The seal is cleared");
    }
  });
  doc.addEventListener("focusin", e => {
    const s = e.target.closest(".arm-read");
    if (s && live() && !Stages.narrow && s.dataset.k !== focus) setFocus(s.dataset.k);
  });

  /* -------------------------------- the room ------------------------------- */
  let focus = "stature", drag = null, seal = 0, punch = 0, lamp = 0, lampTo = 0;
  const shots = docShots("measure-");
  shots.set("stature", { d: 730, sx: .5, sy: .525, el: 9, az: -8 });
  shots.set("mass", { d: 730, sx: .5, sy: .525, el: 9, az: 26 });
  shots.set("years", { d: 730, sx: .5, sy: .525, el: 9, az: -34 });
  shots.set("physis", { d: 730, sx: .5, sy: .525, el: 9, az: 6 });
  shots.set("seal", { d: 730, sx: .5, sy: .525, el: 9, az: 6 });

  /** Goes to a fact (or the seal); `into` also puts the keyboard in its first field. */
  function setFocus(k, into = false) {
    if (!KEYS.includes(k)) return;
    focus = k;
    root.dataset.mzs = k;
    for (const el of qa(".arm-read")) el.classList.toggle("on", el.dataset.k === k);
    for (const b of qa(".arm-ix")) { if (b.dataset.go === k) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); }
    if (k === "seal" && M.complete) punch = 1;
    dirty = true;
    if (live()) { Stages.refresh(); if (!Stages.busy) Stages.remember(); }
    if (into) {
      const f = q('.arm-read.on .arm-field:not([data-u]) .arm-num, .arm-read.on .arm-field[data-u="' + M.units + '"] .arm-num, .arm-read.on [role=radiogroup] [tabindex="0"], .arm-read.on .own-in');
      if (f) f.focus({ preventScroll: true });
    }
  }
  /** The first fact not yet given, or the seal. */
  const firstMissing = () => (KEYS.slice(0, 4).find(k => !show[k]()) || "seal");

  /* Where the figure stands, and so where the rings hang: its soles and
     crown through the camera now. Without one (the flat figure), the middle
     of the room. The rings narrow where the columns beside them need room. */
  function room() {
    const cw = stage.clientWidth, ch = stage.clientHeight, r = figure.renderer;
    const a = r && r.axisPoint && r.axisPoint(0), b = a && r.axisPoint(1);
    const g = a && b && isFinite(a.y) && isFinite(b.y) && a.y - b.y > 60
      ? { x: mount.offsetLeft + a.x, top: mount.offsetTop + b.y, h: a.y - b.y }
      : { x: cw / 2, top: ch * .2, h: ch * .62 };
    g.cw = cw; g.ch = ch;
    g.fit = Math.max(.4, Math.min(1, (cw / 2 - 350) / (.46 * g.h)));
    g.S = Math.min(g.h * .34, cw * .2);       // the seal's outer ring
    return g;
  }
  const smooth = t => t * t * (3 - 2 * t);
  /** A ring as it hangs now: between its place round the body and its place in the seal. */
  function ringGeom(k, g) {
    const R = RINGS[k], e = smooth(seal), L = (a, b) => a + (b - a) * e;
    return {
      cx: g.x, cy: L(g.top + (1 - R.at) * g.h, g.top + g.h * .47),
      r: L(R.r * g.h * g.fit, g.S * [.62, .8, 1][RING_KEYS.indexOf(k)]) * (1 + punch * .05),
      k: L(R.k, 1), roll: L(R.roll, 0), e,
      b: (9 + 22 * st[k].act) * (1 - e), w: 5 + 2 * st[k].act
    };
  }
  /** How many px across the screen one unit of a ring's scale moves at the index. */
  const unitPx = k => { const R = ringGeom(k, room()); return Math.max(2, R.r * RINGS[k].scale().deg * PI / 180); };
  /** The ring whose near side is under a point of the screen, or null. */
  function ringAt(x, y) {
    if (!live() || Stages.busy) return null;
    const g = room(), sr = stage.getBoundingClientRect();
    let best = null, bd = 1e9;
    for (const k of RING_KEYS) {
      const R = ringGeom(k, g), dx = x - sr.left - R.cx, dy = y - sr.top - R.cy;
      const c = Math.cos(-R.roll), s = Math.sin(-R.roll), lx = dx * c - dy * s, ly = dx * s + dy * c;
      if (ly < -R.b && R.e < .5) continue;                       // the far side is behind the body
      const a = Math.atan2(ly / R.k, lx), d = Math.hypot(lx - R.r * Math.cos(a), ly - R.r * R.k * Math.sin(a)) - (k === focus ? 6 : 0);
      if (d < 16 + R.b / 2 && d < bd) { bd = d; best = k; }
    }
    return best;
  }

  /* -------------------------------- drawing -------------------------------- */
  /* Bronze by day and by lamp: the shade at a ring's edges, its body, where
     the light catches, its upper edge, its inside, and what is engraved. */
  const BRONZE = {
    light: { deep: "#452b0b", mid: "#8a5c1e", warm: "#b98a3c", hi: "#f4dca4", top: "#cfa85c", shade: "#6b4819", cut: "rgba(32,18,2,.92)", glint: "rgba(255,244,214,.6)" },
    dark: { deep: "#2c1b05", mid: "#7a5219", warm: "#ad7d31", hi: "#f8d891", top: "#c0924a", shade: "#4b320f", cut: "rgba(18,9,0,.94)", glint: "rgba(255,232,180,.5)" }
  };
  const INK_VAR = { core: "--core-trace", pull: "--pull-trace", legs: "--legs-trace", push: "--push-trace", ink: "--ink" };
  const near = v => Math.abs(v - Math.round(v)) < 1e-6;

  function drawRing(k, g, cb, cf, P) {
    const R = ringGeom(k, g), s = st[k], sc = RINGS[k].scale(), e = R.e, ri = R.r - R.w;
    const given = RINGS[k].get() !== null, alpha = (given ? 1 : .7) * (.8 + .2 * Math.max(s.act, e));
    const hx = .5 + lamp * .3;
    const grad = (c, kind) => {
      const gr = c.createLinearGradient(-R.r, 0, R.r, 0);
      const stops = kind === "face" ? [[0, P.deep], [Math.max(.02, hx - .3), P.mid], [hx - .09, P.warm], [hx, P.hi], [hx + .09, P.warm], [Math.min(.98, hx + .3), P.mid], [1, P.deep]]
        : kind === "lip" ? [[0, P.mid], [hx, P.top], [1, P.mid]] : [[0, P.deep], [1 - hx, P.shade], [1, P.deep]];
      for (const [t, col] of stops) gr.addColorStop(t, col);
      return gr;
    };
    const strip = (c, y1, r1, y2, r2, a0, a1, fill) => {
      c.beginPath();
      c.ellipse(0, y1, r1, r1 * R.k, 0, a0, a1, false);
      c.ellipse(0, y2, r2, r2 * R.k, 0, a1, a0, true);
      c.closePath(); c.fillStyle = fill; c.fill();
    };
    for (const c of [cb, cf]) { c.save(); c.translate(R.cx, R.cy); c.rotate(R.roll); c.globalAlpha = alpha; }
    // The far half: its inside, and its upper edge. The near half: the edge, then its face.
    if (R.b > .5) strip(cb, -R.b / 2, ri, R.b / 2, ri, PI, 2 * PI, grad(cb, "in"));
    strip(cb, -R.b / 2, R.r, -R.b / 2, ri, PI, 2 * PI, grad(cb, "lip"));
    strip(cf, -R.b / 2, R.r, -R.b / 2, ri, 0, PI, grad(cf, "lip"));
    if (R.b > .5) strip(cf, -R.b / 2, R.r, R.b / 2, R.r, 0, PI, grad(cf, "face"));

    // The scale: round the face while it hangs, across the ring's flat once it lies in the seal.
    const dth = sc.deg * PI / 180, span = (e > .5 ? PI - .02 : PI - .1) / dth;
    const from = Math.max(sc.lo, Math.ceil((s.pos - span) / sc.tick) * sc.tick), to = Math.min(sc.hi, s.pos + span);
    cf.font = "600 " + (10 + 2 * s.act).toFixed(1) + "px " + FONT;
    cf.textAlign = "center"; cf.textBaseline = "alphabetic";
    for (let u = from; u <= to + 1e-6; u += sc.tick) {
      const a = PI / 2 - (u - s.pos) * dth, ca = Math.cos(a), sa = Math.sin(a);
      const major = near(u / sc.major), mid = major || near(u / sc.mid), nearSide = sa > 0;
      if (!nearSide && e < .5 && R.b < 6) continue;
      const c = nearSide || e > .5 ? cf : cb, rr = nearSide ? R.r : ri;
      const len = (major ? .58 : mid ? .4 : .22) * R.b, sl = major ? 10 : mid ? 6.5 : 3.5;
      const x0 = rr * ca, y0 = rr * R.k * sa - R.b / 2 + 1.5;
      const x1 = x0 + (((ri - sl) * ca - x0) * e), y1 = y0 + len + (((ri - sl) * sa - (y0 + len)) * e);
      const xs = x0 + ((ri * ca - x0) * e), ys = y0 + ((ri * sa - y0) * e);
      const edge = e > .5 ? 1 : Math.min(1, Math.abs(sa) * 3);
      c.globalAlpha = alpha * edge * (nearSide || e > .5 ? 1 : .4);
      c.strokeStyle = e > .5 ? P.mid : P.cut; c.lineWidth = major ? 1.3 : 1;
      c.beginPath(); c.moveTo(xs, ys); c.lineTo(x1, y1); c.stroke();
      if (major && nearSide && s.act > .2 && e < .3 && sa > .25) {
        cf.save();
        cf.translate(x0, rr * R.k * sa + R.b / 2 - 4.5); cf.scale(Math.max(.25, sa), 1);
        cf.globalAlpha = alpha * Math.min(1, (sa - .25) * 3) * s.act * (1 - e * 3.3);
        cf.fillStyle = P.cut; cf.fillText(sc.label(u), 0, 0);
        cf.restore();
      }
    }
    // The index, on the ring in hand: where its scale is read.
    if (s.act > .05 && e < .5) {
      const y = R.r * R.k, a = s.act * (1 - e * 2) * alpha;
      cf.globalAlpha = a; cf.strokeStyle = P.glint; cf.lineWidth = 1;
      cf.strokeRect(-.5, y - R.b / 2 - 5.5, 1, R.b + 11);
      cf.fillStyle = P.hi;
      cf.beginPath(); cf.moveTo(0, y - R.b / 2 - 4); cf.lineTo(-5, y - R.b / 2 - 12); cf.lineTo(5, y - R.b / 2 - 12); cf.closePath(); cf.fill();
    }
    cb.restore(); cf.restore();
    return R;
  }

  /* What is struck in the seal: beads round the rim, the four facts in the
     outer band, and in the field a name between two rules, the year under it. */
  const SEAL_SEX = { female: "FEMALE", male: "MALE", unspecified: "NOT SAID" };
  function drawSeal(c, g, a) {
    const S = g.S * (1 + punch * .05), ink = getComputedStyle(root).getPropertyValue(INK_VAR[M.ink] || "--ink").trim() || "#222";
    c.save(); c.translate(g.x, g.top + g.h * .47);
    c.globalAlpha = a * (M.complete ? 1 : .42);
    c.fillStyle = ink; c.strokeStyle = ink;
    for (let i = 0; i < 84; i++) { const t = i / 84 * 2 * PI; c.beginPath(); c.arc(Math.cos(t) * S * 1.075, Math.sin(t) * S * 1.075, S * .0075 + .6, 0, 2 * PI); c.fill(); }
    const h = M.cm ? (M.imperial ? romanNumeral(Math.round(M.cm / 2.54)) + " IN" : romanNumeral(Math.round(M.cm)) + " CM") : "—";
    const w = M.kg ? (M.imperial ? romanNumeral(poundsOf(M.kg)) + " LB" : romanNumeral(Math.round(M.kg)) + " KG") : "—";
    const words = ["AGED " + (M.age ? romanNumeral(M.age) : "—"), M.sex ? SEAL_SEX[M.sex] : "—", h, w];
    // Round the band: each fact on its own quarter, a point between.
    c.font = "600 " + (S * .074).toFixed(1) + "px " + FONT; c.textAlign = "center"; c.textBaseline = "middle";
    const rad = S * .9;
    words.forEach((word, i) => {
      const mid = -PI / 2 + i * PI / 2, chars = [...word], adv = chars.map(ch => c.measureText(ch).width + S * .022);
      let t = mid - adv.reduce((s, v) => s + v, 0) / rad / 2;
      chars.forEach((ch, j) => {
        t += adv[j] / rad / 2;
        c.save(); c.rotate(t + PI / 2); c.fillText(ch, 0, -rad); c.restore();
        t += adv[j] / rad / 2;
      });
      c.beginPath(); c.arc(Math.cos(mid + PI / 4) * rad, Math.sin(mid + PI / 4) * rad, S * .011, 0, 2 * PI); c.fill();
    });
    // The field.
    const name = (M.name || "").trim() || "You";
    c.font = "500 " + (S * .058).toFixed(1) + "px " + FONT;
    c.fillText("M E T R O N", 0, -S * .27);
    c.lineWidth = 1; c.beginPath(); c.moveTo(-S * .26, -S * .17); c.lineTo(S * .26, -S * .17); c.moveTo(-S * .26, S * .17); c.lineTo(S * .26, S * .17); c.stroke();
    let px = S * .3;
    c.font = "500 " + px + "px \"Cormorant Garamond\", serif";
    const wide = c.measureText(name).width;
    if (wide > S * .96) { px *= S * .96 / wide; c.font = "500 " + px.toFixed(1) + "px \"Cormorant Garamond\", serif"; }
    c.fillText(name, 0, S * .012);
    c.font = "500 " + (S * .07).toFixed(1) + "px \"Cormorant Garamond\", serif";
    c.fillText(romanNumeral(new Date().getFullYear()), 0, S * .28);
    c.restore();
  }
  const FONT = getComputedStyle(document.documentElement).getPropertyValue("--font").trim() || "system-ui, sans-serif";

  function fitCanvas(c, w, h, dpr) {
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const x = c.getContext("2d");
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    return x;
  }
  let sig = "";
  function draw() {
    const g = room(), dpr = Math.min(devicePixelRatio || 1, 2);
    const now = [g.x, g.top, g.h, g.cw, g.ch, seal, punch, lamp, M.ink, M.name, M.given, document.documentElement.dataset.theme,
      ...RING_KEYS.flatMap(k => [st[k].pos, st[k].act])].map(v => typeof v === "number" ? v.toFixed(3) : v).join("|");
    if (now === sig && !dirty) return;
    sig = now; dirty = false;
    const cb = fitCanvas(back, g.cw, g.ch, dpr), cf = fitCanvas(front, g.cw, g.ch, dpr);
    const P = BRONZE[document.documentElement.dataset.theme === "dark" ? "dark" : "light"];
    // Widest first, so a nearer ring's face lies over a wider one's.
    let lead = null;
    for (const k of [...RING_KEYS].reverse()) { const R = drawRing(k, g, cb, cf, P); if (k === focus) lead = R; }
    if (seal > .5) drawSeal(cf, g, Math.min(1, (smooth(seal) - .55) / .4));
    // The reading stands level with the index it is read at, a hairline between them.
    const top = lead ? lead.cy + (lead.r * lead.k) * Math.cos(lead.roll) : g.top + g.h * (focus === "seal" ? .16 : .36);
    const ry = Math.max(16, Math.min(sec.clientHeight - reads.offsetHeight - 16, top - sec.offsetTop - (lead ? 104 : 0)));
    reads.style.setProperty("--ry", ry.toFixed(0) + "px");
    if (lead && seal < .3) {
      const ix = lead.cx - (lead.r * lead.k) * Math.sin(lead.roll), x1 = reads.offsetLeft - 18;
      cf.save();
      cf.globalAlpha = st[focus].act * (1 - seal * 3.3) * .7;
      cf.strokeStyle = getComputedStyle(root).getPropertyValue("--ink-faint").trim(); cf.lineWidth = 1;
      cf.setLineDash([1, 4]);
      cf.beginPath(); cf.moveTo(ix + 12, top + .5); cf.lineTo(Math.max(ix + 12, x1), top + .5); cf.stroke();
      cf.restore();
    }
  }

  /* -------------------------------- motion -------------------------------- */
  let last = 0;
  (function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(48, t - (last || t)); last = t;
    if (!live() || Stages.narrow) return;
    const still = Stages.still, toward = (v, to, ms) => Math.abs(to - v) < 1e-4 ? to : still ? to : v + (to - v) * (1 - Math.exp(-dt / ms));
    seal = toward(seal, focus === "seal" ? 1 : 0, 300);
    punch = toward(punch, 0, 170);
    lamp = toward(lamp, lampTo, 200);
    for (const k of RING_KEYS) {
      const s = st[k], sc = RINGS[k].scale();
      s.act = toward(s.act, focus === k ? 1 : 0, 190);
      if (drag && drag.k === k) continue;
      if (Math.abs(s.vel) > 2e-4 && !still) {
        s.pos += s.vel * dt; s.vel *= Math.exp(-dt / 340);
        if (s.pos <= sc.lo || s.pos >= sc.hi) { s.pos = Math.max(sc.lo, Math.min(sc.hi, s.pos)); s.vel = 0; }
        readRing(k);
        if (Math.abs(s.vel) <= 2e-4) { s.vel = 0; save(); }
      } else { s.vel = 0; s.pos = toward(s.pos, s.to, 120); }
    }
    draw();
  })(0);

  /* The scroll goes from fact to fact; a sideways swipe turns the ring in hand. */
  let owns = false, acc = 0, spent = false, wheelAt = 0, movedAt = 0;
  const stepFocus = dir => { const k = KEYS[KEYS.indexOf(focus) + dir]; if (k) { movedAt = performance.now(); setFocus(k); } return !!k; };
  addEventListener("wheel", e => {
    owns = false;
    if (!live() || Stages.busy || Stages.narrow || e.ctrlKey) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      if (!RINGS[focus]) return;
      owns = true;
      const s = st[focus], sc = RINGS[focus].scale();
      s.vel = 0;
      s.pos = s.to = Math.max(sc.lo, Math.min(sc.hi, s.pos + e.deltaX * (e.deltaMode === 1 ? 32 : 1) / unitPx(focus) * .6));
      readRing(focus);
      clearTimeout(saveT); saveT = setTimeout(save, 400);
      return;
    }
    const now = performance.now(), d = wheelDelta(e), i = KEYS.indexOf(focus);
    if (now - wheelAt > 380) { acc = 0; spent = false; }
    wheelAt = now;
    const can = d > 0 ? i < KEYS.length - 1 : i > 0;
    owns = can || now - movedAt < 750;
    if (!can || spent) return;
    acc += d;
    if (Math.abs(acc) > 70) { acc = 0; spent = true; stepFocus(Math.sign(d)); }
  }, { capture: true, passive: true });
  let saveT = 0;

  addEventListener("keydown", e => {
    const el = e.target instanceof Element ? e.target : document.body;
    if (!live() || Stages.busy || Stages.narrow || el.closest("input, textarea, select, [role=radiogroup]")) return;
    const dir = { PageDown: 1, ArrowDown: 1, PageUp: -1, ArrowUp: -1 }[e.key], turn = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (dir) { e.preventDefault(); stepFocus(dir); }
    else if (turn && RINGS[focus]) { e.preventDefault(); stepRing(focus, turn); }
  });
  addEventListener("resize", () => { dirty = true; });
  if (document.fonts) document.fonts.ready.then(() => { dirty = true; });

  /* ------------------------------- the stage ------------------------------- */
  let from = null, openAt = null;
  function finish() {
    if (Stages.busy) return;
    M.sealed = new Date().toISOString().slice(0, 10);
    save();
    Stages.go("nutrition");
  }

  Stages.register("measure", {
    arrive() { from = Stages.from; openAt = Stages.at; },
    enter() {
      paint();
      const at = KEYS.includes(openAt) ? openAt : M.complete || from === "nutrition" ? "seal" : firstMissing();
      seal = at === "seal" ? 1 : 0;
      for (const k of RING_KEYS) { st[k].pos = st[k].to; st[k].vel = 0; st[k].act = at === k ? 1 : 0; }
      openAt = null;
      setFocus(at);
    },
    place: () => focus,
    shot: () => "measure-" + (Stages.narrow ? "stature" : focus),
    // In the seal the figure has stepped out: the medal has the room.
    dim: () => focus === "seal" && !Stages.narrow && figure.moves ? 0 : 1,
    wheel: () => owns ? false : undefined,
    focus: () => $("mz-title"),
    footer() {
      const end = Stages.narrow || focus === "seal", next = KEYS[KEYS.indexOf(focus) + 1];
      return {
        back: selection.isEmpty() ? "← Your muscles" : "← Training focus",
        skip: end ? "" : "Skip for now",
        next: end ? (Stages.narrow ? "Continue →" : "Continue to nutrition →") : NAMES[next] + " →",
        hint: end ? "" : "or scroll"
      };
    },
    onNext() {
      if (Stages.narrow || focus === "seal") finish();
      else stepFocus(1);
      return true;
    },
    onBack() { Stages.go("targets"); return true; },
    onSkip() { Stages.go("nutrition"); return true; }
  });
})();
