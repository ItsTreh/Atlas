/* ===========================================================================
   Measure stage: four facts for Nutrition's estimates (measure.js), between
   Targets and Nutrition. Design only for now: nothing in the app reads them
   yet.

   The room is an instrument. The figure stands in the middle of it and
   four bronze rings hang round the body, each engraved with a scale and
   read at the front, where it passes under the index:

     stature     a ring over the crown, as high as you are tall against
                 the marble's own 158 cm
     mass        a ring at the waist, in kilograms or pounds
     years       the widest ring, leaning, a mark a year
     physiology  a ring round the feet, with three stops

   A ring is turned by the hand (drag it, or swipe sideways), by its two
   coins, or by typing, and it keeps turning a little when let go. The body
   turns with the ring in hand. Each ring passes behind the body on its far
   side: it is drawn on two canvases, one under the sculpture and one over.

   Nothing here is a list. Each ring carries its own tag (its name and its
   reading), which hangs from it and goes where it goes; pressing a tag, or
   scrolling, takes that ring in hand: the camera goes to it, and its
   reading is written out large beside it. Left alone, the rings sway.

   Last, your measure: the camera rises over the figure and looks straight
   down the axis, so the four rings are seen as they are, four circles one
   inside the other, every reading under one rule. Nothing is swung flat or
   swapped: it is the same instrument from above. Once all four are given,
   or coming back from Nutrition, the stage opens there.

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

  const KEYS = ["stature", "mass", "years", "physis", "dial"];
  const NAMES = { stature: "Stature", mass: "Mass", years: "Years", physis: "Physiology", dial: "Your measure" };
  /* The marble's own height, in cm: what the stature ring is read against. */
  const MARBLE_CM = 158;
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
  /* The physiology ring's three stops, the midpoint between the two constants. */
  const SEX_STOPS = ["female", "unspecified", "male"];

  /* ------------------------------- the rings ------------------------------ */
  /* Where each ring hangs (`at`, a share of the figure's height from the
     soles), how wide it is (`r`, in figure heights), how far it tips toward
     the eye (`lift`, radians past the camera's own elevation), how it leans
     (`roll`) and how far its scale sways when left alone (`idle`, in its
     units). Its scale is in the units shown: [lo, hi], the step a value
     moves by, a mark every `tick`, a longer one every `mid`, a number every
     `major`, and how many degrees of the ring one unit takes. */
  const lim = (f, i, per = 1) => (i ? Math.floor : Math.ceil)(MEASURE_LIMITS[f][i] / per);
  const RINGS = {
    stature: {
      // As high over the marble as the height given is over the marble's own.
      at: () => 1.035 * Math.max(128, Math.min(196, M.cm === null ? MARBLE_CM : M.cm)) / MARBLE_CM,
      r: .2, lift: .04, roll: 0, idle: 5,
      scale: () => M.imperial
        ? { lo: lim("cm", 0, 2.54), hi: lim("cm", 1, 2.54), step: 1, tick: 1, mid: 6, major: 12, deg: 5.2, def: 62, label: u => u / 12 + "′" }
        : { lo: lim("cm", 0), hi: lim("cm", 1), step: 1, tick: 1, mid: 5, major: 10, deg: 2.7, def: MARBLE_CM, label: String },
      get: () => M.cm === null ? null : M.imperial ? M.cm / 2.54 : M.cm,
      put: v => M.set("cm", M.imperial ? v * 2.54 : v)
    },
    mass: {
      at: () => .56, r: .35, lift: .04, roll: 0, idle: 4,
      scale: () => M.imperial
        ? { lo: lim("kg", 0, KG_PER_LB), hi: lim("kg", 1, KG_PER_LB), step: 1, tick: 2, mid: 10, major: 20, deg: 1.35, def: 154, label: String }
        : { lo: lim("kg", 0), hi: lim("kg", 1), step: .5, tick: 1, mid: 5, major: 10, deg: 2.7, def: 70, label: String },
      get: () => M.kg === null ? null : M.imperial ? M.kg / KG_PER_LB : M.kg,
      put: v => M.set("kg", M.imperial ? v * KG_PER_LB : v)
    },
    years: {
      at: () => .5, r: .47, lift: .15, roll: -.34, idle: 3,
      scale: () => ({ lo: lim("age", 0), hi: lim("age", 1), step: 1, tick: 1, mid: 5, major: 10, deg: 3.3, def: 30, label: String }),
      get: () => M.age, put: v => M.set("age", v)
    },
    physis: {
      at: () => .012, r: .31, lift: .03, roll: 0, idle: .12,
      scale: () => ({ lo: 0, hi: 2, step: 1, tick: .25, mid: 1, major: 1, deg: 34, def: 1, label: u => MEASURE_SEX[SEX_STOPS[u]] }),
      get: () => M.sex === null ? null : SEX_STOPS.indexOf(M.sex),
      put: v => M.set("sex", SEX_STOPS[v])
    }
  };
  const RING_KEYS = Object.keys(RINGS);
  /* Each ring as it is drawn: where its scale stands under the index (pos,
     easing to `to` or coasting at `vel` units a ms), how far it is the one
     in hand (act, 0–1), how high it hangs (at), how far it has come down
     into the room (drop, 0–1, from `dropAt` on the room's clock), and its
     idle sway (bob in px, lean in radians, drift in units of its scale). */
  const st = {};
  for (const k of RING_KEYS) st[k] = { pos: RINGS[k].scale().def, to: RINGS[k].scale().def, vel: 0, act: 0, at: RINGS[k].at(), drop: 1, dropAt: 0, bob: 0, lean: 0, drift: 0 };

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
      '<p class="arm-lede">Four facts turn Nutrition’s estimate from an average into yours. Take a ring and turn it, or type the number.</p>' +
      '<div class="arm-units" role="radiogroup" aria-label="Units"><button type="button" role="radio" data-units="metric">cm · kg</button>' +
        '<button type="button" role="radio" data-units="imperial">ft · lb</button></div>' +
    '</div>' +
    // A tag a ring: its name and its reading, hung from the ring by a hairline.
    '<nav class="arm-tags" aria-label="The four facts">' + RING_KEYS.map(k =>
      '<button type="button" class="arm-tag" data-go="' + k + '"><span class="arm-tag-w">' + NAMES[k] + '</span>' +
      '<span class="arm-tag-v" data-show="' + k + '"></span></button>').join("") + '</nav>' +
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
      read("dial", "Your measure",
        '<p class="arm-alt" data-show="credit"></p>' +
        '<div class="arm-own">' +
          '<label class="own-name"><span class="own-l">Whose it is</span>' +
            '<input class="own-in" maxlength="' + MEASURE_NAME_MAX + '" placeholder="You" autocomplete="off" spellcheck="false" aria-label="A name under your measure"></label>' +
          '<div class="own-ink-w"><span class="own-l" aria-hidden="true">The rule</span><div class="own-ink" role="radiogroup" aria-label="The colour of the rule">' +
            Object.entries(MEASURE_INKS).map(([k, w]) => '<button type="button" role="radio" data-ink="' + k + '" aria-label="' + w + '" title="' + w + '"><i></i></button>').join("") +
          '</div></div>' +
        '</div>' +
        '<button type="button" class="quiet-btn arm-clear">Clear your measure</button>' +
        '<p class="arm-why">The same four rings, seen from above, each turned to its reading. Kept in this browser only; press a ring’s tag to change it.</p>') +
    '</div>';
  const reads = doc.querySelector(".arm-reads");
  const tags = Object.fromEntries(RING_KEYS.map(k => [k, doc.querySelector('.arm-tag[data-go="' + k + '"]')]));
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
      if (show[k]) { const v = show[k](); el.textContent = v; el.classList.toggle("none", !v); }
    }
    for (const k of RING_KEYS) tags[k].setAttribute("aria-label", NAMES[k] + ", " + (show[k]() || "not given"));
    for (const b of qa("[data-units]")) {
      const on = b.dataset.units === M.units;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    }
    q('[data-alt="stature"]').textContent = M.cm
      ? (M.imperial ? Math.round(M.cm) + " cm" : feetInches(M.cm)[0] + "′ " + feetInches(M.cm)[1] + "″") + ". " + overMarble()
      : "The marble stands " + MARBLE_CM + " cm, as carved. And you?";
    q('[data-alt="mass"]').textContent = M.kg ? (M.imperial ? kgText(M.kg) + " kg" : poundsOf(M.kg) + " lb") + ", read at the waist." : "Turn the ring at the waist, or type it.";
    q('[data-alt="years"]').textContent = M.age ? romanNumeral(M.age) + ", a mark a year." : "Turn the widest ring, a mark a year.";
    q('[data-alt="physis"]').textContent = SEX_NOTE[M.sex || "none"];
    for (const b of qa("[data-sex]")) {
      const on = b.dataset.sex === M.sex;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on || (!M.sex && b.dataset.sex === "female") ? 0 : -1;
    }
    for (const b of qa(".own-ink [data-ink]")) { const on = b.dataset.ink === M.ink; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; }
    const ni = q(".own-in");
    if (ni !== document.activeElement) ni.value = M.name || "";
    const day = new Date((M.sealed || new Date().toISOString().slice(0, 10)) + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    q('[data-show="credit"]').textContent = M.complete ? "Taken " + day + ". Never sent anywhere."
      : ["Nothing given yet", "One fact given", "Two facts given", "Three facts given"][M.given] + ": a ring not yet turned reads faint.";
    // Each ring turns to its value, unless the hand has it or it is still coasting.
    for (const k of RING_KEYS) {
      const v = RINGS[k].get(), s = st[k];
      s.to = v === null ? RINGS[k].scale().def : v;
      if (unitsFor !== M.units) { s.pos = s.to; s.vel = 0; }
    }
    unitsFor = M.units;
    if (wasComplete !== M.complete) { wasComplete = M.complete; if (M.complete && focus === "dial") punch = 1; }
    dirty = true;
  }
  let unitsFor = M.units, wasComplete = M.complete, dirty = true;
  /** How the height given stands against the marble's own. */
  function overMarble() {
    const d = M.imperial ? Math.round((M.cm - MARBLE_CM) / 2.54) : Math.round(M.cm - MARBLE_CM), u = M.imperial ? " in" : " cm";
    return !d ? "Level with the marble." : Math.abs(d) + u + (d > 0 ? " over" : " under") + " the marble.";
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
    if (g) { setFocus(g.dataset.go, e.detail === 0); return; }
    if (t.closest(".arm-clear")) {
      M.clear();
      save(); paint();
      announce("Your measure is cleared");
    }
  });
  doc.addEventListener("focusin", e => {
    const s = e.target.closest(".arm-read");
    if (s && live() && !Stages.narrow && s.dataset.k !== focus) setFocus(s.dataset.k);
  });

  /* -------------------------------- the room ------------------------------- */
  let focus = "stature", drag = null, punch = 0, lamp = 0, lampTo = 0, clock = 0, turn = 0, turnAt = null;
  /* Each fact has the camera its own way: close under the crown for stature,
     level with the waist for mass, the whole figure for the years, from
     higher up for the ring at the feet, and straight down the axis for
     your measure. */
  const shots = docShots("measure-");
  shots.set("stature", { d: 560, ty: 112, sx: .5, sy: .56, el: 10, az: -12 });
  shots.set("mass", { d: 540, ty: 92, sx: .5, sy: .5, el: 14, az: 24 });
  shots.set("years", { d: 760, ty: 80, sx: .5, sy: .52, el: 9, az: -30 });
  shots.set("physis", { d: 720, ty: 70, sx: .5, sy: .47, el: 21, az: 8 });
  shots.set("dial", { d: 800, ty: 80, sx: .5, sy: .49, el: 88, az: 0 });

  /** Goes to a fact (or your measure); `into` also puts the keyboard in its first field. */
  function setFocus(k, into = false) {
    if (!KEYS.includes(k)) return;
    focus = k;
    root.dataset.mzs = k;
    for (const el of qa(".arm-read")) el.classList.toggle("on", el.dataset.k === k);
    for (const b of qa(".arm-tag")) { if (b.dataset.go === k) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); }
    if (k === "dial" && M.complete) punch = 1;
    turn = 0; turnAt = null;
    dirty = true;
    if (live()) { Stages.refresh(); if (!Stages.busy) Stages.remember(); }
    if (into) {
      const f = q('.arm-read.on .arm-field:not([data-u]) .arm-num, .arm-read.on .arm-field[data-u="' + M.units + '"] .arm-num, .arm-read.on [role=radiogroup] [tabindex="0"], .arm-read.on .own-in');
      if (f) f.focus({ preventScroll: true });
    }
  }
  /** The first fact not yet given, or your measure. */
  const firstMissing = () => (KEYS.slice(0, 4).find(k => !show[k]()) || "dial");

  const smooth = t => t * t * (3 - 2 * t);
  /** Past its mark and back: how a ring comes down into its place. */
  const settleIn = t => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
  /* The room through the camera now: `pt(t)` is where the figure's axis lies
     on the stage at a share of its height, and how many px one of its units
     takes there; `el` is how far above the level the eye is, and `e` how
     near it is to looking straight down (0 to 1). Without a camera (the
     flat figure, which draws no rings) the middle of the room. */
  function room() {
    const cw = stage.clientWidth, ch = stage.clientHeight, r = figure.renderer;
    const cam = r && r.live && r.size && r.height ? r.live() : null;
    const el = cam ? (cam.el || 0) * PI / 180 : .16, f = cam ? r.size.ch / (2 * Math.tan(cam.fov * PI / 360)) : 0;
    const g = {
      cw, ch, el, H: cam ? r.height : 1,
      pt: cam ? t => {
        const dy = cam.ty - t * r.height, w = cam.d + dy * Math.sin(el);
        return { x: mount.offsetLeft + cam.sx * r.size.cw, y: mount.offsetTop + cam.sy * r.size.ch + f * dy * Math.cos(el) / w, s: f / w };
      } : t => ({ x: cw / 2, y: ch * (.82 - .62 * t), s: ch * .62 })
    };
    g.e = smooth(Math.max(0, Math.min(1, (el * 180 / PI - 28) / 50)));
    g.zoom = Math.max(.85, Math.min(1.5, Math.sqrt(g.pt(.5).s * g.H / 530)));
    return g;
  }
  /** A ring as it hangs now, through the camera. */
  function ringGeom(k, g) {
    const R = RINGS[k], s = st[k], p = g.pt(s.at), e = g.e, drop = Math.max(0, Math.min(1, s.drop));
    return {
      cx: p.x, cy: p.y + s.bob * (1 - e) - (1 - settleIn(drop)) * 110,
      r: R.r * g.H * p.s * (1 + punch * .05),
      k: Math.max(.04, Math.sin(Math.min(PI / 2, g.el + R.lift))), roll: (R.roll + s.lean) * (1 - e), e,
      b: (9 + 22 * s.act) * (1 - e) * g.zoom, w: (5 + 2 * s.act) * g.zoom, a: Math.min(1, drop * 2.5)
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
      if (R.a < .5 || (ly < -R.b && R.e < .5)) continue;         // not yet come down; or the far side, behind the body
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
  const FONT = getComputedStyle(document.documentElement).getPropertyValue("--font").trim() || "system-ui, sans-serif";

  function drawRing(k, R, cb, cf, P) {
    const s = st[k], sc = RINGS[k].scale(), e = R.e, ri = R.r - R.w, pos = s.pos + s.drift;
    const given = RINGS[k].get() !== null, alpha = (given ? 1 : .7) * (.8 + .2 * Math.max(s.act, e)) * R.a;
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

    // The scale: round the face while it hangs, across the ring's flat once it is seen from above.
    const dth = sc.deg * PI / 180, span = (e > .5 ? PI - .02 : PI - .1) / dth;
    const from = Math.max(sc.lo, Math.ceil((pos - span) / sc.tick) * sc.tick), to = Math.min(sc.hi, pos + span);
    cf.font = "600 " + ((10 + 2 * s.act) * R.zoom).toFixed(1) + "px " + FONT;
    cf.textAlign = "center"; cf.textBaseline = "alphabetic";
    for (let u = from; u <= to + 1e-6; u += sc.tick) {
      const a = PI / 2 - (u - pos) * dth, ca = Math.cos(a), sa = Math.sin(a);
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
        cf.translate(x0, rr * R.k * sa + R.b / 2 - 4.5 * R.zoom); cf.scale(Math.max(.25, sa), 1);
        cf.globalAlpha = alpha * Math.min(1, (sa - .25) * 3) * s.act * (1 - e * 3.3);
        cf.fillStyle = P.cut; cf.fillText(sc.label(Math.round(u)), 0, 0);
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
  }

  /* Seen from above: one rule from the innermost ring out past the widest,
     under which every ring stands at its reading, and whose it is beneath. */
  function drawRule(c, geo, order, a) {
    const inner = geo[order[0]], outer = geo[order[order.length - 1]];
    const ink = getComputedStyle(root).getPropertyValue(INK_VAR[M.ink] || "--ink").trim() || "#222";
    const x = outer.cx, y0 = inner.cy + inner.r * inner.k - inner.w - 12, y1 = outer.cy + outer.r * outer.k + 18;
    c.save();
    c.globalAlpha = a * (M.complete ? 1 : .45);
    c.strokeStyle = c.fillStyle = ink; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke();
    c.beginPath(); c.moveTo(x, y1 - 2); c.lineTo(x - 5, y1 + 8); c.lineTo(x + 5, y1 + 8); c.closePath(); c.fill();
    c.font = "italic 400 " + Math.round(Math.min(34, outer.r * .14)) + "px \"Cormorant Garamond\", serif";
    c.textAlign = "center"; c.textBaseline = "top";
    c.fillText((M.name || "").trim() || "You", x, y1 + 20);
    c.restore();
  }

  /* The tags: off its ring's left end while it hangs; seen from above, one
     under another beside the dial, each level with where its hairline meets
     its ring. The ring in hand needs none: its reading is written out. */
  const TAG_LEVEL = [.3, -.3, .9, -.9];
  function placeTags(cf, geo, order, g) {
    const r0 = geo[order[0]].r, outer = geo[order[order.length - 1]], e = g.e, L = (a, b) => a + (b - a) * e;
    const faint = getComputedStyle(root).getPropertyValue("--ink-faint").trim();
    for (const k of RING_KEYS) {
      const R = geo[k], el = tags[k], dy = TAG_LEVEL[order.indexOf(k)] * r0;
      const fy = outer.cy + dy - R.cy;
      const ax = L(R.cx - R.r * Math.cos(R.roll), R.cx - Math.sqrt(Math.max(0, R.r * R.r - fy * fy)));
      const ay = L(R.cy - R.r * Math.sin(R.roll), outer.cy + dy);
      const tx = L(ax - 30, outer.cx - outer.r - 38), ty = ay;
      const y = ty - sec.offsetTop, show = R.a * (1 - st[k].act * (1 - e));
      const on = show > .3 && y > 18 && y < sec.clientHeight - 18 && tx > 150 && !Stages.busy;
      el.classList.toggle("on", on);
      el.style.transform = "translate(" + (tx - sec.offsetLeft).toFixed(1) + "px, " + y.toFixed(1) + "px) translate(-100%, -50%)";
      if (!on) continue;
      cf.save();
      cf.globalAlpha = show * .8;
      cf.strokeStyle = cf.fillStyle = faint; cf.lineWidth = 1;
      cf.beginPath(); cf.moveTo(tx + 8, ty + .5); cf.lineTo(ax - 4, ay + .5); cf.stroke();
      cf.beginPath(); cf.arc(ax, ay, 2, 0, 2 * PI); cf.fill();
      cf.restore();
    }
  }

  function fitCanvas(c, w, h, dpr) {
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const x = c.getContext("2d");
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    return x;
  }
  let sig = "";
  function draw() {
    const g = room(), dpr = Math.min(devicePixelRatio || 1, 2), geo = {};
    for (const k of RING_KEYS) { geo[k] = ringGeom(k, g); geo[k].zoom = g.zoom; }
    const now = [g.cw, g.ch, g.e, punch, lamp, M.ink, M.name, M.given, Stages.busy, document.documentElement.dataset.theme,
      ...RING_KEYS.flatMap(k => [st[k].pos + st[k].drift, st[k].act, geo[k].cx, geo[k].cy, geo[k].r, geo[k].k, geo[k].roll, geo[k].a])]
      .map(v => typeof v === "number" ? v.toFixed(3) : v).join("|");
    if (now === sig && !dirty) return;
    sig = now; dirty = false;
    const cb = fitCanvas(back, g.cw, g.ch, dpr), cf = fitCanvas(front, g.cw, g.ch, dpr);
    const P = BRONZE[document.documentElement.dataset.theme === "dark" ? "dark" : "light"];
    // Widest first, so a nearer ring's face lies over a wider one's.
    const order = [...RING_KEYS].sort((a, b) => geo[a].r - geo[b].r);
    for (const k of [...order].reverse()) drawRing(k, geo[k], cb, cf, P);
    if (g.e > .5) drawRule(cf, geo, order, Math.min(1, (g.e - .5) / .4));
    placeTags(cf, geo, order, g);
    // The reading stands level with the index it is read at, a hairline between them; from above, beside the dial.
    const lead = geo[focus];
    const top = lead ? lead.cy + (lead.r * lead.k) * Math.cos(lead.roll) : geo.mass.cy - reads.offsetHeight / 2 + sec.offsetTop * 0;
    const ry = Math.max(16, Math.min(sec.clientHeight - reads.offsetHeight - 16, top - sec.offsetTop - (lead ? 104 : 0)));
    reads.style.setProperty("--ry", ry.toFixed(0) + "px");
    if (lead && g.e < .3) {
      const ix = lead.cx - (lead.r * lead.k) * Math.sin(lead.roll), x1 = reads.offsetLeft - 18;
      cf.save();
      cf.globalAlpha = st[focus].act * (1 - g.e * 3.3) * .7 * lead.a;
      cf.strokeStyle = getComputedStyle(root).getPropertyValue("--ink-faint").trim(); cf.lineWidth = 1;
      cf.setLineDash([1, 4]);
      cf.beginPath(); cf.moveTo(ix + 12, top + .5); cf.lineTo(ix + 12 + Math.max(0, x1 - ix - 12) * smooth(st[focus].act), top + .5); cf.stroke();
      cf.restore();
    }
  }

  /* -------------------------------- motion -------------------------------- */
  /* How far the body turns with the ring in hand: degrees of body for each
     degree of ring, and the most it turns before the ring slips on. */
  const BODY_GEAR = .3, BODY_MOST = 20;
  let last = 0;
  (function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(48, t - (last || t)); last = t;
    if (!live() || Stages.narrow) return;
    const still = Stages.still, toward = (v, to, ms) => Math.abs(to - v) < 1e-4 ? to : still ? to : v + (to - v) * (1 - Math.exp(-dt / ms));
    clock += dt;
    punch = toward(punch, 0, 170);
    lamp = toward(lamp, lampTo, 200);
    RING_KEYS.forEach((k, i) => {
      const s = st[k], R = RINGS[k], sc = R.scale(), mine = focus === k;
      s.act = toward(s.act, mine ? 1 : 0, 190);
      s.at = toward(s.at, R.at(), 240);
      if (clock >= s.dropAt) s.drop = toward(s.drop, 1, 230);
      // Left alone, a ring sways: it rides a little up and down, leans, and its scale drifts to and fro.
      s.bob = still ? 0 : Math.sin(clock / 1700 + i * 1.9) * 2.4 * (1 - s.act * .6);
      s.lean = still ? 0 : Math.sin(clock / 2900 + i * 2.3) * .016 * (1 - s.act * .5);
      s.drift = toward(s.drift, mine || focus === "dial" ? 0 : Math.sin(clock / 5200 + i * 1.3) * R.idle, 500);
      if (drag && drag.k === k) return;
      if (Math.abs(s.vel) > 2e-4 && !still) {
        s.pos += s.vel * dt; s.vel *= Math.exp(-dt / 340);
        if (s.pos <= sc.lo || s.pos >= sc.hi) { s.pos = Math.max(sc.lo, Math.min(sc.hi, s.pos)); s.vel = 0; }
        readRing(k);
        if (Math.abs(s.vel) <= 2e-4) { s.vel = 0; save(); }
      } else { s.vel = 0; s.pos = toward(s.pos, s.to, 120); }
    });
    // The body turns with the ring in hand, and comes back when it is let go.
    if (RINGS[focus] && !still) {
      const p = st[focus].pos;
      if (turnAt !== null) turn = Math.max(-BODY_MOST, Math.min(BODY_MOST, turn - (p - turnAt) * RINGS[focus].scale().deg * BODY_GEAR));
      turnAt = p;
      if (!drag && Math.abs(st[focus].vel) < 2e-4) turn = toward(turn, 0, 700);
    } else turn = 0;
    if (!Stages.busy) figure.setTurn(turn);
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
    const dir = { PageDown: 1, ArrowDown: 1, PageUp: -1, ArrowUp: -1 }[e.key], side = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (dir) { e.preventDefault(); stepFocus(dir); }
    else if (side && RINGS[focus]) { e.preventDefault(); stepRing(focus, side); }
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
    arrive() { from = Stages.from; openAt = Stages.at === "seal" ? "dial" : Stages.at; },
    enter() {
      paint();
      const at = KEYS.includes(openAt) ? openAt : M.complete || from === "nutrition" ? "dial" : firstMissing();
      // The rings come down into the room one after another, the highest first; from above they are already there.
      RING_KEYS.forEach((k, i) => {
        const s = st[k];
        s.pos = s.to; s.vel = 0; s.drift = 0; s.act = at === k ? 1 : 0; s.at = RINGS[k].at();
        s.drop = at === "dial" || Stages.still ? 1 : 0; s.dropAt = clock + 380 + i * 190;
      });
      openAt = null;
      setFocus(at);
    },
    place: () => focus,
    // Seen from above the marble is a pale shape at the middle of the dial: the rings have the room.
    dim: () => focus === "dial" && !Stages.narrow && figure.moves ? .3 : 1,
    shot: () => "measure-" + (Stages.narrow ? "years" : focus),
    wheel: () => owns ? false : undefined,
    focus: () => $("mz-title"),
    footer() {
      const end = Stages.narrow || focus === "dial", next = KEYS[KEYS.indexOf(focus) + 1];
      return {
        back: selection.isEmpty() ? "← Your muscles" : "← Training focus",
        skip: end ? "" : "Skip for now",
        next: end ? (Stages.narrow ? "Continue →" : "Continue to nutrition →") : NAMES[next] + " →",
        hint: end ? "" : "or scroll"
      };
    },
    onNext() {
      if (Stages.narrow || focus === "dial") finish();
      else stepFocus(1);
      return true;
    },
    onBack() { Stages.go("targets"); return true; },
    onSkip() { Stages.go("nutrition"); return true; }
  });
})();
