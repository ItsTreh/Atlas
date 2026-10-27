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
     mass     a steelyard: the poise slides along the beam, which swings
     years    a frieze of decades, a metope each, the years lived filled
     physis   which physiology the resting-burn equation should use
     label    the seal: everything given, struck, each fact led out to it
              like a catalogue plate; the figure steps away

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
  const SEX_NOTE = {
    female: "The female constant is used.",
    male: "The male constant is used.",
    unspecified: "The midpoint of the two is used, so the estimate is a little less exact either way.",
    none: "Choose one, or leave it: the midpoint would be used."
  };
  /** A weight in kg, to a tenth where it has one. */
  const kgText = kg => { const r = Math.round(kg * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };

  const root = Stages.root, stage = $("anatomy-stage"), mount = stage.querySelector(".anatomy-viewport");

  /* ------------------------------- framings ------------------------------- */
  const KEYS = ["intro", "stature", "mass", "years", "physis", "label"];
  const WORDS = { intro: "Measure", stature: "Stature", mass: "Mass", years: "Years", physis: "Physiology", label: "" };
  const shots = docShots("measure-");
  shots.set("intro", { d: 560, sx: .70, sy: .50, az: -14 });
  shots.set("stature", { d: 540, sx: .29, sy: .50, az: 4 });
  shots.set("mass", { d: 540, sx: .71, sy: .50, az: -24 });
  shots.set("years", { d: 540, sx: .29, sy: .50, az: 26 });
  shots.set("physis", { d: 540, sx: .71, sy: .50, az: -40 });
  shots.set("label", { az: -26, el: -4, ty: 96, d: 640, sx: -.34, sy: .50 });    // the figure steps away; the seal has the room

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

  /* The seal: a beaded rim, the facts inscribed round it in Roman numerals,
     a ring of dentils, and You struck in the field. The ink is uneven, as
     a real impression is (the filter). */
  const SEAL = '<svg class="seal-svg" viewBox="0 0 320 320" aria-hidden="true">' +
    '<defs><filter id="mzInk" x="-4%" y="-4%" width="108%" height="108%">' +
      '<feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="d"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3 2.4" result="m"/>' +
      '<feComposite in="d" in2="m" operator="in"/></filter>' +
      '<path id="mzArc" d="M160 160m-121 0a121 121 0 1 1 242 0a121 121 0 1 1-242 0"/></defs>' +
    '<g class="seal-ink" filter="url(#mzInk)">' +
      '<circle class="s-rim" cx="160" cy="160" r="153"/><circle class="s-beads" cx="160" cy="160" r="145" pathLength="90"/>' +
      '<circle class="s-hair" cx="160" cy="160" r="137"/>' +
      '<text class="s-arc"><textPath href="#mzArc" textLength="748" lengthAdjust="spacing"></textPath></text>' +
      '<circle class="s-hair" cx="160" cy="160" r="107"/><circle class="s-dent" cx="160" cy="160" r="100" pathLength="144"/>' +
      '<circle class="s-hair" cx="160" cy="160" r="92"/>' +
      '<text class="s-top" x="160" y="126" text-anchor="middle">ΜΕΤΡΟΝ</text><path class="s-rule" d="M124 138h72"/>' +
      '<text class="s-you" x="160" y="183" text-anchor="middle">You</text><path class="s-rule" d="M124 198h72"/>' +
      '<text class="s-year" x="160" y="219" text-anchor="middle"></text>' +
    '</g></svg>';
  const SEAL_SEX = { female: "FEMALE", male: "MALE", unspecified: "NOT SAID" };
  /* A callout on the plate: a fact, what it is for, and Edit, led by a hairline to the seal's rim. */
  const anno = (k, u, pos) => '<button type="button" class="pl-line" data-go="' + k + '" data-pos="' + pos + '"><span class="pl-v" data-pl="' + k + '"></span>' +
    '<span class="pl-u">' + u + '</span><span class="pl-e">Edit</span></button>';

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
    '</div></section>' +

    '<section class="mz-s" data-s="mass" data-side="l"><div class="mz-col">' +
      '<p class="eyebrow" data-r="0"><span class="n">II</span> / Mass</p>' +
      '<h2 class="mz-h" data-r="0">How <em>heavy.</em></h2>' +
      '<div class="mz-read" data-r="1"><label class="mz-field">' + num("kg", "Body weight", "00") + '<span class="mz-unit" data-unit="kg"></span></label>' + steps("kg", "weight") + '</div>' +
      '<div class="mz-yard" data-r="1" role="slider" tabindex="0" aria-label="Body weight">' +
        '<span class="yard-hang" aria-hidden="true"><svg viewBox="0 0 24 44"><circle class="yh-ring" cx="12" cy="7" r="5.5"/><circle class="yh-beads" cx="12" cy="7" r="5.5" pathLength="12"/><path d="M12 12.5V40"/><circle class="yh-pin" cx="12" cy="40" r="2.6"/></svg></span>' +
        '<span class="yard-arm" aria-hidden="true"><span class="yard-beam"></span><span class="yard-key"></span>' +
          '<span class="yard-load"><svg viewBox="0 0 20 40"><path d="M10 0V24"/><path d="M10 24a5 5 0 1 0 5 5"/></svg><b>you</b></span>' +
          '<span class="yard-track"><span class="yard-ticks"></span><span class="yard-nums"></span>' +
          '<span class="yard-poise"><span class="yp-swing"><i class="yp-ring"></i><i class="yp-thread"></i>' +
            '<svg class="yp-coin" viewBox="0 0 52 52"><circle class="ypc-face" cx="26" cy="26" r="24"/><circle class="ypc-beads" cx="26" cy="26" r="21.4" pathLength="36"/>' +
            '<circle class="ypc-ring" cx="26" cy="26" r="17.6"/><text class="ypc-v" x="26" y="31" text-anchor="middle"></text></svg></span></span></span></span>' +
      '</div>' +
      '<p class="mz-alt" data-r="2" data-alt="mass"></p>' +
      '<p class="mz-why" data-r="2"><b>Why it’s asked.</b> The largest term in the resting-burn estimate, and the base for protein, counted in grams per kilogram. Today’s weight is enough; change it as you do.</p>' +
    '</div></section>' +

    '<section class="mz-s" data-s="years" data-side="r"><div class="mz-col">' +
      '<p class="eyebrow" data-r="0"><span class="n">III</span> / Years</p>' +
      '<h2 class="mz-h" data-r="0">How many <em>years.</em></h2>' +
      '<div class="mz-read" data-r="1"><label class="mz-field">' + num("age", "Age in years", "00") + '<span class="mz-unit">years</span></label>' +
        '<span class="mz-roman" aria-hidden="true"></span>' + steps("age", "age") + '</div>' +
      '<div class="mz-frieze" data-r="1"><div class="frz" role="slider" tabindex="0" aria-label="Age" aria-valuemin="' + MEASURE_LIMITS.age[0] + '" aria-valuemax="' + MEASURE_LIMITS.age[1] + '"></div><div class="frz-l" aria-hidden="true"></div></div>' +
      '<p class="mz-why" data-r="2"><b>Why it’s asked.</b> Resting burn eases slowly with the years, by roughly five calories a day for each one. An estimate, like every figure here.</p>' +
    '</div></section>' +

    '<section class="mz-s" data-s="physis" data-side="l"><div class="mz-col">' +
      '<p class="eyebrow" data-r="0"><span class="n">IV</span> / Physiology</p>' +
      '<h2 class="mz-h" data-r="0">Which <em>physiology.</em></h2>' +
      '<div class="mz-phys" data-r="1" role="radiogroup" aria-label="Physiology for the estimate">' +
        Object.entries(MEASURE_SEX).map(([k, w]) => '<button type="button" role="radio" data-sex="' + k + '">' + w + '</button>').join('<span class="mz-dot" aria-hidden="true">·</span>') +
      '</div>' +
      '<p class="mz-alt" data-r="1" data-alt="physis" aria-live="polite"></p>' +
      '<p class="mz-why" data-r="2"><b>Why it’s asked.</b> The standard resting-burn equations add a different constant for female and male physiology, about 166 kcal a day apart. Only that equation reads it; nothing else in ATLAS changes.</p>' +
    '</div></section>' +

    '<section class="mz-s" data-s="label" data-side="c"><div class="mz-col mz-end">' +
      '<p class="eyebrow" data-r="0">The seal · kept in this browser</p>' +
      '<div class="mz-plate" data-r="1">' +
        anno("years", "Resting burn", "tl") + anno("physis", "The equation’s constant", "tr") +
        '<button type="button" class="seal" id="mz-label" data-state="blank">' + SEAL + '</button>' +
        anno("stature", "Resting burn", "bl") + anno("mass", "Resting burn · protein", "br") +
      '</div>' +
      '<p class="pl-credit" data-r="2" data-show="credit"></p>' +
      '<div class="mz-own" data-r="2">' +
        '<label class="own-name"><span class="own-l">In the field</span>' +
          '<input class="own-in" maxlength="' + MEASURE_NAME_MAX + '" placeholder="You" autocomplete="off" spellcheck="false" aria-label="A name for the seal’s field"></label>' +
        '<div class="own-ink-w"><span class="own-l" aria-hidden="true">The ink</span><div class="own-ink" role="radiogroup" aria-label="The seal’s ink">' +
          Object.entries(MEASURE_INKS).map(([k, w]) => '<button type="button" role="radio" data-ink="' + k + '" aria-label="' + w + '" title="' + w + '"><i></i></button>').join("") +
        '</div></div>' +
        '<button type="button" class="mz-clear">Clear the seal</button>' +
      '</div>' +
      '<p class="mz-priv" data-r="3">Nothing here leaves this browser: no account, no upload. Nutrition reads the four facts for its estimates; the name and the ink are only for the seal.</p>' +
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
    // The frieze: a metope a decade, a slot a year, its decade numbered under it.
    let h = "", l = "";
    for (let d = 1; d <= 9; d++) {
      h += '<span class="frz-m" data-d="' + d + '">';
      for (let j = 0; j < 10; j++) h += '<i data-y="' + (d * 10 + j) + '" style="--j:' + j + '"></i>';
      h += '</span>';
      l += '<span data-d="' + d + '">' + romanNumeral(d * 10) + '</span>';
    }
    page.querySelector(".frz").innerHTML = h;
    page.querySelector(".frz-l").innerHTML = l;
    built = true;
    buildScales();
  }

  /* The steelyard's beam, in the units chosen: [from, to, a tick every, a number every]. */
  const YARD = { metric: [40, 160, 5, 20], imperial: [90, 350, 10, 50] };
  /* The scales, in the units chosen: the rule's ticks, every 10 cm or every 6 inches, and the beam's. */
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
    const [lo, hi, minor, major] = YARD[M.units];
    let yt = "", yn = "";
    for (let v = lo; v <= hi; v += minor) {
      const x = ((v - lo) / (hi - lo) * 100).toFixed(2), mj = v % major === 0;
      yt += "<i" + (mj ? ' class="mj"' : "") + ' style="left:' + x + '%"></i>';
      if (mj) yn += '<span style="left:' + x + '%">' + v + "</span>";
    }
    page.querySelector(".yard-ticks").innerHTML = yt;
    page.querySelector(".yard-nums").innerHTML = yn;
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
    setIn("kg", M.kg ? (M.imperial ? poundsOf(M.kg) : kgText(M.kg)) : "", except);
    setIn("age", M.age || "", except);
    q('.mz-num[data-f="kg"]').setAttribute("aria-label", M.imperial ? "Body weight in pounds" : "Body weight in kilograms");
    q('[data-unit="kg"]').textContent = M.imperial ? "lb" : "kg";
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
    paintSeal();
    const PL = {
      years: M.age ? "Aged " + M.age : "Age not given",
      physis: M.sex ? (M.sex === "unspecified" ? "Physiology not said" : MEASURE_SEX[M.sex] + " physiology") : "Physiology not given",
      stature: M.cm ? show.stature() + " tall" : "Height not given",
      mass: M.kg ? show.mass() : "Weight not given"
    };
    for (const el of qa("[data-pl]")) {
      const k = el.dataset.pl;
      el.textContent = PL[k];
      el.classList.toggle("none", !show[k]());
    }
    q('[data-alt="physis"]').textContent = SEX_NOTE[M.sex || "none"];
    for (const b of qa("[data-sex]")) {
      const on = b.dataset.sex === M.sex;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on || (!M.sex && b.dataset.sex === "female") ? 0 : -1;
    }
    q('[data-alt="mass"]').textContent = M.kg ? (M.imperial ? kgText(M.kg) + " kg" : poundsOf(M.kg) + " lb") + ", on the beam." : "Slide the weight along the beam, or type it.";

    // The steelyard.
    const [lo, hi] = YARD[M.units], dv = M.kg ? (M.imperial ? M.kg / KG_PER_LB : M.kg) : null;
    const yard = q(".mz-yard");
    Y.tx = dv == null ? 0 : Math.max(0, Math.min(1, (dv - lo) / (hi - lo)));
    Y.base = dv == null ? 3.5 : 0;
    Y.rested = false;
    q(".ypc-v").textContent = dv == null ? "" : Math.round(dv);
    yard.classList.toggle("empty", dv == null);
    yard.setAttribute("aria-valuemin", lo); yard.setAttribute("aria-valuemax", hi);
    if (dv == null) { yard.removeAttribute("aria-valuenow"); yard.setAttribute("aria-valuetext", "Not given"); }
    else { yard.setAttribute("aria-valuenow", Math.round(dv)); yard.setAttribute("aria-valuetext", show.mass()); }

    // The frieze: the years lived filled, this one standing up; before 14, hatched.
    q(".mz-roman").textContent = M.age ? romanNumeral(M.age) : "";
    const frz = q(".frz");
    for (const i of frz.querySelectorAll("i")) {
      const yr = +i.dataset.y;
      i.classList.toggle("x", yr < MEASURE_LIMITS.age[0]);
      i.classList.toggle("f", !!M.age && yr < M.age);
      i.classList.toggle("now", yr === M.age);
    }
    const dec = M.age ? Math.floor(M.age / 10) : 0;
    for (const el of qa(".frz-l span, .frz-m")) el.classList.toggle("on", +el.dataset.d === dec);
    if (M.age) { frz.setAttribute("aria-valuenow", M.age); frz.setAttribute("aria-valuetext", M.age + " years"); }
    else { frz.removeAttribute("aria-valuenow"); frz.setAttribute("aria-valuetext", "Not given"); }

    paintRule();
  }

  /* The seal: the four facts round the rim, the name in the field, the ink.
     Struck once all four are given, and struck again on arriving at it. */
  function paintSeal() {
    const seal = q(".seal"), n = M.given, sep = "\u00a0\u00a0·\u00a0\u00a0";
    const h = M.cm ? (M.imperial ? romanNumeral(Math.round(M.cm / 2.54)) + " IN" : romanNumeral(Math.round(M.cm)) + " CM") : "—";
    const w = M.kg ? (M.imperial ? romanNumeral(poundsOf(M.kg)) + " LB" : romanNumeral(Math.round(M.kg)) + " KG") : "—";
    seal.querySelector("textPath").textContent = "AGED " + (M.age ? romanNumeral(M.age) : "—") + sep + (M.sex ? SEAL_SEX[M.sex] : "—") + sep + h + sep + w + sep;
    seal.querySelector(".s-year").textContent = romanNumeral(new Date().getFullYear());
    // The field: a name, if one is given, sized to sit inside the inner ring.
    const nm = (M.name || "").trim() || "You", you = seal.querySelector(".s-you");
    you.textContent = nm;
    you.style.fontSize = Math.min(64, 170 / (nm.length * .47)).toFixed(1) + "px";
    q(".mz-plate").dataset.tint = M.ink;
    for (const b of qa(".own-ink [data-ink]")) { const on = b.dataset.ink === M.ink; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; }
    const ni = q(".own-in");
    if (ni !== document.activeElement) ni.value = M.name || "";
    seal.setAttribute("aria-label", n === 4 ? "Your seal, struck. Press to strike it again" : "Your seal, not yet struck. Press to give what is missing");
    const state = n === 4 ? "struck" : "blank";
    if (seal.dataset.state !== state) { seal.dataset.state = state; if (state === "struck" && cur === "label") strike(); }
    const day = new Date((M.sealed || new Date().toISOString().slice(0, 10)) + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    q('[data-show="credit"]').textContent = n === 4 ? "Struck " + day + ", in this browser. Never sent anywhere."
      : ["Nothing given yet", "One fact given", "Two facts given", "Three facts given"][n] + "; the seal is struck with all four. Never sent anywhere.";
  }
  function strike() {
    const s = q(".seal");
    if (!s || s.dataset.state !== "struck") return;
    s.classList.remove("strike"); void s.offsetWidth; s.classList.add("strike");
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
    } else if (f === "kg") {
      const kg = M.imperial ? n * KG_PER_LB : Math.round(n * 10) / 10;
      if (fits("kg", kg)) M.set("kg", kg); else if (!raw) M.set("kg", null);
    } else if (f === "age") { if (fits("age", n)) M.set("age", n); else if (!raw) M.set("age", null); }
    if (commit) save();
    paint(commit ? null : i);
  }

  /** One step of a field: a centimetre or an inch; half a kilogram or a pound. */
  function stepF(f, dir) {
    if (f === "cm") {
      if (M.imperial) M.set("cm", ((M.cm ? Math.round(M.cm / 2.54) : 62) + dir) * 2.54);
      else M.set("cm", (M.cm ? Math.round(M.cm) : 158) + dir);
    } else if (f === "kg") {
      if (M.imperial) M.set("kg", ((M.kg ? poundsOf(M.kg) : 154) + dir) * KG_PER_LB);
      else M.set("kg", (M.kg ? Math.round(M.kg * 2) / 2 : 70) + dir * .5);
    } else if (f === "age") M.set("age", (M.age || 30) + dir);
    save();
    paint();
  }

  /* The steelyard moves as a thing hung on threads: the poise follows the
     hand on a spring, the beam rocks toward where it is going and settles,
     the coin swings on its thread. Empty, the long arm tips down; given a
     weight, it balances. */
  const Y = { x: 0, v: 0, tx: 0, th: 0, w: 0, sw: 0, sv: 0, base: 3.5, set: false, rested: false };
  function yardStep(dt) {
    const yard = q(".mz-yard");
    if (!yard) return;
    const s = Math.min(dt, 34) / 1000, drag = dragging === "yard";
    if (!Y.set) { Y.x = Y.tx; Y.th = Y.base; Y.set = true; }
    const k = drag ? 260 : 90, c = 2 * Math.sqrt(k) * (drag ? .9 : .62);
    const a = k * (Y.tx - Y.x) - c * Y.v;
    Y.v += a * s; Y.x += Y.v * s;
    const want = Y.base + Math.max(-4, Math.min(4, Y.v * 2.4));
    Y.w += (55 * (want - Y.th) - 4.2 * Y.w) * s; Y.th += Y.w * s;
    Y.sv += (-38 * Y.sw - 2.6 * Y.sv + a * 7) * s; Y.sw = Math.max(-28, Math.min(28, Y.sw + Y.sv * s));
    const still = Math.abs(Y.tx - Y.x) < 1e-4 && Math.abs(Y.v) < 1e-4 && Math.abs(Y.th - Y.base) < .01 && Math.abs(Y.w) < .01 && Math.abs(Y.sw) < .02 && Math.abs(Y.sv) < .02;
    if (still && Y.rested) return;
    Y.rested = still;
    yard.style.setProperty("--x", Y.x.toFixed(4));
    yard.style.setProperty("--tilt", Y.th.toFixed(3) + "deg");
    yard.style.setProperty("--sw", Y.sw.toFixed(2) + "deg");
  }

  /** The poise dragged to `x` (px across the screen): the weight it reads, a pound or half a kilogram at a time. */
  function setMassFrom(x) {
    const track = q(".yard-track").getBoundingClientRect(), [lo, hi] = YARD[M.units];
    const f = Math.max(0, Math.min(1, (x - track.left) / track.width)), dv = lo + f * (hi - lo);
    M.set("kg", M.imperial ? Math.round(dv) * KG_PER_LB : Math.round(dv * 2) / 2);
    paint();
  }
  /** The frieze touched at `x`: the year under it. */
  function setAgeFrom(x) {
    const r = q(".frz").getBoundingClientRect(), f = Math.max(0, Math.min(.9999, (x - r.left) / r.width));
    M.set("age", 10 + Math.floor(f * 90));
    paint();
  }

  /* A coin held down keeps stepping. */
  let holdT = 0, holdI = 0;
  const stopHold = () => { clearTimeout(holdT); clearInterval(holdI); };
  page.addEventListener("pointerdown", e => {
    const b = e.target.closest("[data-step]");
    if (b) {
      e.preventDefault();
      stepF(b.dataset.f, +b.dataset.step);
      stopHold();
      holdT = setTimeout(() => { holdI = setInterval(() => stepF(b.dataset.f, +b.dataset.step), 70); }, 420);
      return;
    }
    const yard = e.target.closest(".mz-yard"), frz = e.target.closest(".frz");
    if (!yard && !frz) return;
    e.preventDefault();
    dragging = yard ? "yard" : "frz";
    const el = yard || frz;
    el.focus({ preventScroll: true });
    el.setPointerCapture(e.pointerId);
    el.classList.add("drag");
    (yard ? setMassFrom : setAgeFrom)(e.clientX);
  });
  page.addEventListener("pointermove", e => {
    if (dragging) (dragging === "yard" ? setMassFrom : setAgeFrom)(e.clientX);
  });
  const endDrag = () => {
    stopHold();
    if (!dragging) return;
    for (const el of qa(".drag")) el.classList.remove("drag");
    dragging = null;
    save();
  };
  addEventListener("pointerup", endDrag);
  addEventListener("pointercancel", endDrag);

  page.addEventListener("input", e => {
    if (e.target.matches(".mz-num")) onInput(e.target, false);
    else if (e.target.matches(".own-in")) { M.name = e.target.value.trim().slice(0, MEASURE_NAME_MAX) || null; paintSeal(); }
  });
  page.addEventListener("change", e => {
    if (e.target.matches(".mz-num")) onInput(e.target, true);
    else if (e.target.matches(".own-in")) { save(); strike(); }
  });
  page.addEventListener("keydown", e => {
    const t = e.target, k = e.key;
    if (t.matches(".mz-num")) {
      const d = { ArrowUp: 1, ArrowDown: -1 }[k];
      if (d) { e.preventDefault(); stepF(t.dataset.f === "ft" || t.dataset.f === "in" ? "cm" : t.dataset.f, d * (e.shiftKey ? 10 : 1)); }
      else if (k === "Enter") t.blur();
      return;
    }
    if (t.matches(".own-in")) { if (k === "Enter") t.blur(); return; }
    const dir = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[k];
    if (t.matches(".mz-yard") && (dir || k === "Home" || k === "End")) {
      e.preventDefault();
      const [lo, hi] = YARD[M.units];
      if (k === "Home" || k === "End") { M.set("kg", (k === "Home" ? lo : hi) * (M.imperial ? KG_PER_LB : 1)); save(); paint(); }
      else for (let i = 0; i < Math.abs(dir); i++) stepF("kg", Math.sign(dir) * (M.imperial ? 1 : 2));
      return;
    }
    if (t.matches(".frz") && (dir || k === "Home" || k === "End")) {
      e.preventDefault();
      M.set("age", k === "Home" ? MEASURE_LIMITS.age[0] : k === "End" ? MEASURE_LIMITS.age[1] : (M.age || 30) + dir);
      save(); paint();
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
    const sx = t.closest("[data-sex]");
    if (sx) { M.set("sex", sx.dataset.sex); save(); paint(); return; }
    const u = t.closest("[data-units]");
    if (u) { M.units = u.dataset.units; save(); paint(); return; }
    const ik = t.closest(".own-ink [data-ink]");
    if (ik) { M.ink = ik.dataset.ink; save(); paintSeal(); strike(); return; }
    // The seal, struck, strikes again; not yet struck, it goes to the first fact missing.
    if (t.closest(".seal")) {
      if (M.complete) return strike();
      const miss = [["stature", M.cm], ["mass", M.kg], ["years", M.age], ["physis", M.sex]].find(([, v]) => v === null);
      if (miss) go(stop[miss[0]].a);
      return;
    }
    const g = t.closest("[data-go]");
    if (g && stop[g.dataset.go]) {
      const k = g.dataset.go;
      go(stop[k].a);
      // Then into its first field, once the page has arrived.
      const f = secEl[k].querySelector(".mz-field:not([hidden]) .mz-num, [role=radiogroup] [tabindex='0']");
      if (f && !Stages.narrow) setTimeout(() => { if (live() && nearestKey(target) === k) f.focus({ preventScroll: true }); }, 650);
      return;
    }
    if (t.closest(".mz-clear")) {
      M.clear();
      save(); paint();
      announce("The seal is cleared");
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
    for (const k of ["mass", "years", "physis"]) shots.fit(k, vt - 14, ch - 34);
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
    if (k === "label") strike();
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
    if (built && live()) yardStep(dt);
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
    focus: () => $(nearestKey(target) === "label" ? "mz-label" : "mz-title"),
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
