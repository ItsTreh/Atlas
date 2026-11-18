/* ===========================================================================
   Measure stage: four facts for Nutrition's estimates (measure.js), between
   Targets and Nutrition. Nutrition reads the weight; height, years and
   physiology wait for the resting-burn maths.

   From the user's Claude Design file "Measure v4" (2026-11-17), with their
   four changes: the live sculpture in the middle, swaying a little; the
   rings not in hand breathe; the reading at the right and the ring in hand
   are larger.

   Four rings of sticks hang round the marble, one a fact, each in one of
   the app's pigments:

     stature     over the crown, as high as you are tall against the
                 marble's own 158 cm
     mass        at the waist, in kilograms or pounds
     years       the widest, leaning, a stick a year
     physiology  round the feet, three stops

   A stick is a unit of the ring's scale: those reached stand in colour,
   every major one in full; the rest stand low and outlined, as Targets'
   empty places do. A ring is turned by the hand (drag it sideways, or
   scroll on it; let go while it moves and it coasts), by its two coins,
   the arrow keys, or by typing the number. What the ring in hand says goes
   round the body with it, letter by letter.

   Then the four together, each read at the front; then your mark, a disc
   of the user's own stone that the four rings close round as rims, each
   filled as far as its reading. Once all four are given, or coming back
   from Nutrition, the stage opens there.

   The words are set in a 1440 × 900 plate scaled to the screen, as
   Nutrition's and the Week plan's are; the rings are drawn on two
   canvases, one under the sculpture and one over, so each passes behind
   the body. On a phone the rings are left out for now.
   ========================================================================= */
(() => {
  const M = bodyMeasure;
  loadMeasure(M);
  const save = () => saveMeasure(M);
  const live = () => Stages.current === "measure";
  const sec = $("stage-measure"), doc = sec.querySelector(".arm");
  const stage = $("anatomy-stage"), mount = stage.querySelector(".anatomy-viewport");
  const PI = Math.PI;

  const KEYS = ["stature", "mass", "years", "physis"];
  const STEPS = [...KEYS, "four", "mark"];
  const NAMES = { stature: "Stature", mass: "Mass", years: "Years", physis: "Physiology", four: "The four", mark: "Your mark" };
  const NUM = ["I", "II", "III", "IV"];
  /* Each ring takes one of the app's pigments, as the mark's stones do (MEASURE_INKS). */
  const PIG = { stature: "push", mass: "pull", years: "core", physis: "legs" };
  /* The plate's geometry: the figure's axis, where its soles stand, the
     height the rings are hung against and the figure's own; the mark's
     centre and radius. */
  const G = { X: 712, SOLE: 760, TALL: 520, FIG: 500, MX: 712, MY: 456, MR: 146 };
  /* Per ring, resting / in hand / the four together: its radius; the
     sticks' full height by the same three. The ring in hand is larger than
     the design's (280–310) by the user's word, up to what the two columns
     leave between them. */
  const SIZE = { stature: [120, 322, 190], mass: [190, 330, 245], years: [250, 330, 290], physis: [170, 320, 225] };
  const HMAX = [11, 38, 19];
  const KK = { stature: .22, mass: .2, years: .28, physis: .19 };
  const ROLL = { stature: 0, mass: 0, years: -.3, physis: 0 };
  /* Left alone, a ring's scale drifts to and fro by this many of its units. */
  const DRIFT = { stature: 1.4, mass: 1.4, years: 1.1, physis: .05 };
  /* The rims of the mark, inside out. */
  const RIM = ["stature", "physis", "mass", "years"];
  const MARBLE_CM = 158;
  const SEX_STOPS = ["female", "unspecified", "male"];
  const SEX_NOTE = { female: "THE FEMALE CONSTANT IS USED", male: "THE MALE CONSTANT IS USED", unspecified: "THE MIDPOINT OF THE TWO IS USED", none: "CHOOSE ONE, OR LEAVE IT: THE MIDPOINT" };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = t => t * t * (3 - 2 * t);
  const kgText = kg => { const r = Math.round(kg * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
  const hexMix = (a, b, t) => "#" + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");

  /* What the page is showing, apart from the measure itself. */
  const ui = { step: 0, hover: null, editing: false, typing: null, grabbing: false };

  /* ------------------------------ the facts ------------------------------ */
  /* A ring's scale: its ends, what a step is, a stick every `per` units, a full-colour stick every `major`. */
  function scale(k) {
    const imp = M.imperial;
    if (k === "stature") return imp ? { lo: 48, hi: 90, step: 1, per: 1, major: 12, label: u => (u / 12) + "′" } : { lo: 120, hi: 230, step: 1, per: 1, major: 10, label: String };
    if (k === "mass") return imp ? { lo: 68, hi: 550, step: 1, per: 2, major: 20, label: String } : { lo: 30, hi: 250, step: .5, per: 1, major: 10, label: String };
    if (k === "years") return { lo: 14, hi: 99, step: 1, per: 1, major: 10, label: String };
    return { lo: 0, hi: 2, step: 1, per: 1, major: 1, label: u => MEASURE_SEX[SEX_STOPS[u]] };
  }
  /** How far round one unit turns a ring: the scale fills nine tenths of it. */
  function dthU(k) { if (k === "physis") return .62; const sc = scale(k), n = Math.round((sc.hi - sc.lo) / sc.per); return 2 * PI * .9 / n / sc.per; }
  function stored(k) {
    if (k === "stature") return M.cm === null ? null : M.imperial ? M.cm / 2.54 : M.cm;
    if (k === "mass") return M.kg === null ? null : M.imperial ? M.kg / KG_PER_LB : M.kg;
    if (k === "years") return M.age;
    return M.sex === null ? null : SEX_STOPS.indexOf(M.sex);
  }
  const def = k => ({ stature: M.imperial ? 62 : MARBLE_CM, mass: M.imperial ? 154 : 70, years: 30, physis: 1 }[k]);
  function reading(k) {
    if (stored(k) === null) return null;
    const imp = M.imperial;
    if (k === "stature") {
      const [ft, i] = feetInches(M.cm), cm = Math.round(M.cm) + " cm", fi = ft + "′ " + i + "″";
      return imp ? { big: fi, other: cm, num: ft + "′" + i, unit: "″", short: fi } : { big: cm, other: fi, num: String(Math.round(M.cm)), unit: "cm", short: cm };
    }
    if (k === "mass") {
      const lb = poundsOf(M.kg) + " lb", kg = kgText(M.kg) + " kg";
      return imp ? { big: lb, other: kg, num: String(poundsOf(M.kg)), unit: "lb", short: lb } : { big: kg, other: lb, num: kgText(M.kg), unit: "kg", short: kg };
    }
    if (k === "years") return { big: M.age + " years", other: romanNumeral(M.age), num: String(M.age), unit: "yrs", short: M.age + " yrs" };
    return { big: MEASURE_SEX[M.sex], other: { female: "the female constant", male: "the male constant", unspecified: "the midpoint of the two" }[M.sex], num: MEASURE_SEX[M.sex], unit: "", short: MEASURE_SEX[M.sex] };
  }
  /** How the height given stands against the marble's own. */
  function overMarble() {
    const d = M.imperial ? Math.round((M.cm - MARBLE_CM) / 2.54) : Math.round(M.cm - MARBLE_CM), u = M.imperial ? " in" : " cm";
    return !d ? "level with the marble" : Math.abs(d) + u + (d > 0 ? " over" : " under") + " the marble";
  }
  /** Sets a fact from a ring's units. */
  function put(k, v) {
    if (k === "stature") M.set("cm", M.imperial ? Math.round(v) * 2.54 : Math.round(v));
    else if (k === "mass") M.set("kg", M.imperial ? Math.round(v) * KG_PER_LB : Math.round(v * 2) / 2);
    else if (k === "years") M.set("age", Math.round(v));
    else M.set("sex", SEX_STOPS[clamp(Math.round(v), 0, 2)]);
    render();
  }
  function stepBy(k, n) { const cur = stored(k) ?? def(k); put(k, Math.round(cur) + n); save(); }
  function clearFact(k) { M.set(k === "stature" ? "cm" : k === "mass" ? "kg" : k === "years" ? "age" : "sex", null); save(); render(); }
  function setUnits(u) {
    if (u === M.units) return;
    M.units = u;
    ui.typing = null; ui.editing = false;
    for (const k of ["stature", "mass"]) { const s = st[k]; s.pos = stored(k) ?? def(k); s.vel = 0; s.mode = "spring"; }
    save(); render();
  }

  /* -------------------------------- motion -------------------------------- */
  /* Each ring as it is drawn: where its scale stands under the index (pos,
     sprung to its value, or coasting at `vel` units a ms, or in the hand),
     and its size and place easing toward target() (disp). */
  const st = {}, disp = {}, sticks = {};
  let calm = false, born = 0, clock = 0, spin = 0, medal = 0, punch = 0, lamp = 0, lampTo = 0, turn = 0, turnAt = null, figOp = 1, drag = null;
  for (const k of KEYS) { st[k] = { pos: def(k), vel: 0, mode: "spring" }; disp[k] = { ...target(k), op: 0 }; }

  /** Where a ring would rest now: its radius, sticks' height, tilt, height on the body, how far it is in hand. */
  function target(k) {
    const s = ui.step, all = s === 4, act = s < 4 && KEYS[s] === k, m = act ? 1 : all ? 2 : 0, T = G.TALL, S = G.SOLE;
    const cy = k === "stature" ? S - T * (1 + (clamp(M.cm ?? MARBLE_CM, 140, 200) - MARBLE_CM) / MARBLE_CM * .45) : k === "mass" ? S - .56 * T : k === "years" ? S - .5 * T : S - .04 * T;
    const lift = ui.hover === k && !act ? 1 : 0;
    return { r: SIZE[k][m] * (1 + .03 * lift), H: HMAX[m] * (1 + .25 * lift), kk: KK[k] + (act ? .02 : 0), cy, e: act ? 1 : all ? .55 : 0, op: 1 };
  }
  /** A ring's sticks: where each stands on the scale, whether it is a full-colour one, which stop it belongs to; each one's height, sprung. */
  function sticksOf(k) {
    const id = k + M.units;
    if (sticks[id]) return sticks[id];
    const sc = scale(k), u = [], maj = [], grp = [];
    if (k === "physis") for (let g = 0; g < 3; g++) for (let j = 0; j < 7; j++) { u.push(g + (j - 3) * .072); maj.push(j === 3 ? 1 : 0); grp.push(g); }
    else for (let x = sc.lo; x <= sc.hi + 1e-6; x += sc.per) { u.push(x); maj.push(Math.abs(x / sc.major - Math.round(x / sc.major)) < 1e-6 ? 1 : 0); grp.push(-1); }
    const n = u.length;
    return sticks[id] = { n, u, maj, grp, h: new Float32Array(n), hv: new Float32Array(n), born: performance.now() };
  }
  /**
   * A ring as it hangs now. Left alone it breathes: a slow swell of its
   * width and its sticks, a little rise and fall, its scale drifting to and
   * fro. Seen at the mark, it closes round the stone as a rim (`m`).
   */
  function geom(k) {
    const d = disp[k], i = KEYS.indexOf(k), mm = smooth(medal), L = (a, b) => a + (b - a) * mm;
    const idle = calm ? 0 : Math.max(0, 1 - d.e) * (1 - mm);
    const breath = Math.sin(clock * 2 * PI / 5600 + i * 1.7);
    const rim = (G.MR + 14 + RIM.indexOf(k) * 17) * (1 + punch * .025);
    return {
      cx: L(G.X, G.MX), cy: L(d.cy + idle * 2.4 * Math.sin(clock * 2 * PI / 7300 + i * 2.1), G.MY),
      r: L(d.r * (1 + .016 * idle * breath), rim), kk: L(d.kk, 1), roll: ROLL[k] * (1 - mm),
      H: L(d.H * (1 + .08 * idle * breath), 9), e: d.e * (1 - mm), op: d.op, m: mm, idle,
      drift: idle * DRIFT[k] * Math.sin(clock * 2 * PI / 18000 + i * 1.3)
    };
  }
  /** A ring's value from where its scale stands: the nearest step, inside its limits. */
  function commit(k) {
    const s = st[k], sc = scale(k), v = clamp(Math.round(s.pos / sc.step) * sc.step, sc.lo, sc.hi), now = stored(k);
    if (now === null || Math.abs(now - v) >= sc.step / 2) put(k, v);
  }

  function frame(dt, now) {
    const still = calm = Stages.still, toward = (v, to, ms) => Math.abs(to - v) < 1e-4 || still ? to : v + (to - v) * (1 - Math.exp(-dt / ms));
    clock += dt;
    KEYS.forEach((k, i) => {
      const late = now - born < i * 130 && !still;
      const d = disp[k], T = target(k);
      if (!late) for (const p of ["r", "H", "kk", "cy", "e", "op"]) d[p] = toward(d[p], T[p], p === "cy" && d.op < .99 ? 260 : 200);
      const s = st[k], sc = scale(k);
      if (s.mode === "coast") {
        const cd = Math.min(dt, 48); s.pos += s.vel * cd; s.vel *= Math.exp(-cd / 380);
        if (s.pos < sc.lo || s.pos > sc.hi) { s.pos = clamp(s.pos, sc.lo, sc.hi); s.vel = 0; }
        commit(k);
        if (Math.abs(s.vel) < .0025) { s.mode = "spring"; save(); }
      } else if (s.mode === "spring") {
        const tg = stored(k) ?? def(k);
        if (still) { s.pos = tg; s.vel = 0; }
        else for (let q = dt; q > 0; q -= 8) { const ds = Math.min(8, q); s.vel += (.00016 * (tg - s.pos) - .021 * s.vel) * ds; s.pos += s.vel * ds; }
      }
      // The sticks rise to what is given and settle past their mark, as Targets' sets do.
      const S = sticksOf(k), v = stored(k), age = now - S.born - i * 130;
      for (let j = 0; j < S.n; j++) {
        const on = v !== null && (k === "physis" ? S.grp[j] === v : S.u[j] <= v + 1e-6), here = v !== null && k !== "physis" && Math.abs(S.u[j] - v) < sc.per / 2 + 1e-6;
        const ready = still || age > 140 + j * (k === "physis" ? 24 : 5);
        const t = !ready ? 0 : on ? (here ? 1.2 : 1) : .36;
        if (still) { S.h[j] = t; S.hv[j] = 0; continue; }
        let h = S.h[j], hv = S.hv[j];
        for (let q = dt; q > 0; q -= 8) { const ds = Math.min(8, q); hv += (.0011 * (t - h) - .042 * hv) * ds; h += hv * ds; }
        S.h[j] = h; S.hv[j] = hv;
      }
    });
    spin += still ? 0 : dt * .000035;
    punch = toward(punch, 0, 170);
    lamp = toward(lamp, lampTo, 200);
    // At the mark, the rings close round the stone, and it is struck as they meet.
    const was = medal, mark = ui.step === 5;
    medal = toward(medal, mark ? 1 : 0, mark ? 420 : 160);
    if (was < .8 && medal >= .8) punch = 1;
    // The marble steps back behind the mark.
    figOp = toward(figOp, mark ? .16 : 1, 260);
    // The body turns with the ring in hand, and comes back when it is let go.
    const K = KEYS[ui.step];
    if (K && !still) {
      const p = st[K].pos;
      if (turnAt !== null) turn = clamp(turn - (p - turnAt) * dthU(K) * 180 / PI * .3, -20, 20);
      turnAt = p;
      if (!drag && st[K].mode !== "coast") turn = toward(turn, 0, 700);
    } else { turn = toward(turn, 0, 400); turnAt = null; }
  }

  /* --------------------------------- the plate -------------------------------- */
  doc.innerHTML = '<div class="mz-plate" id="mz-plate"></div>';
  const plate = $("mz-plate"), foot = $("foot-measure");
  const layer = cls => { const c = document.createElement("canvas"); c.className = "mz-canvas " + cls; c.setAttribute("aria-hidden", "true"); return c; };
  const back = layer("mz-back"), front = layer("mz-front");
  mount.before(back); mount.after(front);
  const fit = { k: 1, ox: 0, oy: 0, vw: 0, vh: 0 };
  /** Fits the 1440 × 900 plate to the screen, centred. */
  function fitPlate() {
    const vw = sec.clientWidth, vh = sec.clientHeight, k = Math.min(vw / 1440, vh / 900);
    Object.assign(fit, { vw, vh, k, ox: (vw - 1440 * k) / 2, oy: (vh - 900 * k) / 2 });
    plate.style.transform = "translate(" + fit.ox + "px," + fit.oy + "px) scale(" + k + ")";
  }
  /** Where a pointer event lands on the plate. */
  function toPlate(e) { const r = plate.getBoundingClientRect(), k = r.width / 1440 || 1; return [(e.clientX - r.left) / k, (e.clientY - r.top) / k]; }

  /* ---------------------------------- words ---------------------------------- */
  const WHY = {
    stature: "A taller frame carries more of what burns at rest. Height is one term in the resting-burn estimate, and nothing else reads it.",
    mass: "The largest term in the resting-burn estimate, and the base for protein, counted in grams per kilogram. Today’s weight is enough; change it as you do.",
    years: "Resting burn eases slowly with the years, by roughly five calories a day for each one. An estimate, like every figure here.",
    physis: "The standard resting-burn equations add a different constant for female and male physiology, about 166 kcal a day apart. Only that equation reads it.",
    four: "Every ring at its own height round the marble, each turned to what you gave it. Kept in this browser only. Nutrition reads the weight today; height, years and physiology wait for the resting-burn maths.",
    mark: "The four rings close round a stone of your own, each filled as far as its reading. No two stones are veined alike, and yours stays as it is when a reading changes. Kept in this browser only."
  };
  /* A coin: a beaded rim, a fine ring, the sign struck in the field. */
  const coinSvg = d => '<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="mz-beads" cx="26" cy="26" r="24.2" pathLength="40"></circle><circle cx="26" cy="26" r="20.5" style="stroke-width:1; opacity:.4"></circle><path d="' + d + '" style="stroke-width:1.3; stroke-linecap:round"></path></svg>';
  const pigOf = k => "var(--" + PIG[k] + ")", traceOf = k => "var(--" + PIG[k] + "-trace)";
  const softOf = k => "color-mix(in srgb, var(--" + PIG[k] + ") 52%, var(--bg))";
  const STICK = {
    low: "transform:scaleY(.36); background:transparent; box-shadow:inset 0 0 0 1px var(--line)",
    full: k => "background:" + pigOf(k),
    part: k => "background:" + softOf(k),
    hatch: k => "background:repeating-linear-gradient(135deg, color-mix(in srgb, var(--" + PIG[k] + ") 62%, var(--bg)) 0 1.5px, transparent 1.5px 4.5px); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--" + PIG[k] + ") 55%, var(--bg))"
  };
  const legendHtml = items => '<div style="display:flex; flex-wrap:wrap; gap:12px 26px; margin-top:16px" aria-hidden="true">' + items.map(g =>
    '<div style="display:flex; align-items:flex-end; gap:10px"><div style="display:flex; align-items:flex-end; gap:3px">' +
    g.sticks.map(s => '<span class="mz-stick" style="' + s + '"></span>').join("") + '</div>' +
    '<span style="font:500 12px/1 var(--font); color:var(--ink-soft); padding-bottom:1px">' + esc(g.label) + '</span></div>').join("") + '</div>';

  /** The left column: where the stage is, what the fact is for, how to turn its ring. */
  function leftHtml() {
    const s = ui.step, key = STEPS[s], K = KEYS[s], all = key === "four", mark = key === "mark";
    const eyebrow = K ? NAMES[K] + ", " + NUM[s] + " of IV" : NAMES[key];
    const title = mark ? ["Your ", "mark."] : all ? ["Your measure, ", "entire."] : ["Take your ", "measure."];
    const lede = mark ? "A stone of your own, set in the four rings." : all ? "Four rings round the marble, every one read at the front." : "Four rings of sticks round the marble, one a fact. Turn one, and the sticks you reach stand up in colour.";
    let legend = "", how, howLabel, factNum, factName, factColor;
    if (K) {
      factNum = NUM[s]; factName = NAMES[K]; factColor = traceOf(K);
      const unitWord = { stature: M.imperial ? "an inch" : "a centimetre", mass: M.imperial ? "two pounds" : "a kilogram", years: "a year" }[K];
      const majWord = { stature: M.imperial ? "every foot" : "every ten", mass: M.imperial ? "every twenty" : "every ten", years: "every decade" }[K];
      legend = legendHtml(K === "physis"
        ? [{ label: "Chosen", sticks: [STICK.full(K), STICK.full(K), STICK.full(K)] }, { label: "The midpoint", sticks: [STICK.hatch(K), STICK.hatch(K), STICK.hatch(K)] }, { label: "Not chosen", sticks: [STICK.low, STICK.low, STICK.low] }]
        : [{ label: "Reached, " + majWord + " in full", sticks: [STICK.part(K), STICK.part(K), STICK.full(K)] }, { label: "Not yet", sticks: [STICK.low, STICK.low, STICK.low] }]);
      howLabel = "HOW TO TURN IT";
      how = K === "physis" ? "Take the ring by its sticks and turn it to a stop, or click one. Left alone, the midpoint is used."
        : "A stick is " + unitWord + ". Take the ring by its sticks and drag sideways, or scroll on it; let go while it moves and it coasts, then settles. Up and down arrows step it.";
    } else if (all) {
      factNum = "◆"; factName = "The four, together"; factColor = "var(--ink)";
      legend = legendHtml(KEYS.map(k => ({ label: NAMES[k], sticks: stored(k) !== null ? [STICK.part(k), STICK.part(k), STICK.full(k)] : [STICK.low, STICK.low, STICK.low] })));
      howLabel = "TO CHANGE ONE"; how = "Click a ring or a reading to take it in hand again.";
    } else {
      factNum = "◆"; factName = "Your mark"; factColor = "var(--ink)";
      howLabel = "TO CHANGE IT"; how = "Name it and choose its stone at the right. To change a reading, go back to its ring.";
    }
    const link = (label, attrs, on) => '<button type="button" class="mz-link"' + attrs + (on === undefined ? "" : ' aria-pressed="' + on + '"') + '>' + label + '</button>';
    return '<div style="position:absolute; left:48px; top:108px; width:330px">' +
      '<p style="margin:0; font-size:11px; font-weight:600; line-height:1.3; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-faint)"><span style="font:600 13px/1 var(--serif); letter-spacing:.06em; color:var(--ink)">II</span> / Measure · ' + esc(eyebrow) + '</p>' +
      '<h1 id="mz-title" tabindex="-1" style="margin:14px 0 0; font:400 52px/.96 var(--serif); letter-spacing:-.015em; color:var(--ink); text-wrap:balance; outline:none">' + title[0] + '<em>' + title[1] + '</em></h1>' +
      '<p style="margin:16px 0 0; font:italic 400 19px/1.32 var(--serif); color:var(--ink-soft); text-wrap:pretty">' + lede + '</p>' +
      '<div style="margin-top:28px; padding-top:16px; border-top:1px solid var(--line)">' +
        '<div style="display:flex; align-items:baseline; gap:12px"><span style="font:500 20px/1 var(--serif); letter-spacing:.04em; color:' + factColor + '">' + factNum + '</span>' +
        '<span style="font:italic 400 34px/1 var(--serif); color:' + factColor + '">' + factName + '</span></div>' +
        '<p style="margin:12px 0 0; font-size:13.5px; line-height:1.5; color:var(--ink-soft); text-wrap:pretty">' + WHY[key] + '</p>' + legend +
      '</div>' +
      '<div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px 14px; margin-top:22px; font-size:13px; color:var(--ink-faint)">' +
        '<span>Units</span>' + link("cm · kg", ' data-units="metric"', !M.imperial) + link("ft · lb", ' data-units="imperial"', M.imperial) +
        '<span style="width:1px; height:12px; background:var(--line)"></span>' + link("Clear your measure", ' data-act="wipe"') +
      '</div>' +
      '<p style="margin:24px 0 8px; font:500 10px/1 var(--mono); letter-spacing:.16em; color:var(--ink-faint)">' + howLabel + '</p>' +
      '<p style="margin:0; font-size:13.5px; line-height:1.5; color:var(--ink-soft); text-wrap:pretty">' + how + '</p>' +
    '</div>';
  }

  /* The reading at the right, larger than the design's by the user's word: 184 px numbers, 48 px coins. */
  const NUM_PX = 184, PAIR_PX = 128, DIGITS = "0123456789".split("").map(d => "<span>" + d + "</span>").join("");
  function factHtml(K) {
    const s = ui.step, rd = reading(K), given = !!rd, imp = M.imperial, dark = document.documentElement.dataset.theme === "dark";
    const numColor = given ? "color-mix(in srgb, var(--" + PIG[K] + "-trace) " + (dark ? 82 : 78) + "%, var(--bg))" : "var(--line)";
    const cap = '<p style="margin:0; font:500 11px/1 var(--mono); letter-spacing:.18em; color:' + traceOf(K) + '">' + NUM[s] + " · " + NAMES[K].toUpperCase() + '</p>';
    if (K === "physis") {
      return cap +
        '<p style="margin:12px 0 0; font:italic 400 96px/1 var(--serif); letter-spacing:-.02em; white-space:nowrap; color:' + numColor + '; transition:color .5s ease">' + (given ? MEASURE_SEX[M.sex] : "Not given") + '</p>' +
        '<p aria-live="polite" style="margin:12px 0 0; font:500 11px/1.5 var(--mono); letter-spacing:.1em; color:var(--ink-faint)">' + SEX_NOTE[M.sex || "none"] + '</p>' +
        '<div role="radiogroup" aria-label="Physiology for the estimate" style="display:flex; flex-wrap:wrap; gap:4px 22px; margin-top:18px">' +
          SEX_STOPS.map(sx => { const on = M.sex === sx; return '<button type="button" role="radio" class="mz-stop" data-sex="' + sx + '" aria-checked="' + on + '" tabindex="' + (on || (!M.sex && sx === "female") ? 0 : -1) + '" style="font:' + (on ? "italic " : "") + '400 27px/1 var(--serif); color:' + (on ? "var(--ink)" : "var(--ink-faint)") + '">' + MEASURE_SEX[sx] +
            '<span style="transform:' + (on ? "scaleX(1)" : "scaleX(0)") + '"></span></button>'; }).join("") +
        '</div>' +
        (given ? '<button type="button" class="mz-link" data-act="clear" style="margin-top:14px">Clear physiology</button>' : "");
    }
    const ty = f => ui.typing && ui.typing.f === f ? ui.typing.text : null;
    const pair = K === "stature" && imp, size = pair ? PAIR_PX : NUM_PX;
    const field = (f, val, ph, unit, aria) => { const t = ty(f), shown = t !== null ? t : val; return '<label style="display:flex; align-items:baseline; gap:6px; cursor:text">' +
      '<input class="mz-in" data-f="' + f + '" value="' + esc(shown) + '" placeholder="' + ph + '" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="' + aria + '" style="width:' + (Math.max(1, String(shown || ph).length) * .5 + .08).toFixed(2) + 'em; font:italic 400 ' + size + 'px/1 var(--serif); font-variant-numeric:lining-nums tabular-nums">' +
      '<span style="font:italic 400 34px/1 var(--serif)">' + unit + '</span></label>'; };
    const [ft, inch] = M.cm !== null ? feetInches(M.cm) : ["", ""];
    const ph = { stature: imp ? "5′2" : String(MARBLE_CM), mass: imp ? "154" : "70", years: "30" }[K];
    const shown = given ? rd.num : ph;
    const roll = [...shown].map(ch => /\d/.test(ch)
      ? '<span class="mz-digit"><span style="transform:translateY(-' + ch + 'em)">' + DIGITS + '</span></span>'
      : '<span style="display:inline-block; height:1em">' + esc(ch) + '</span>').join("");
    const unit = given ? rd.unit : { stature: imp ? "″" : "cm", mass: imp ? "lb" : "kg", years: "yrs" }[K];
    const alt = {
      stature: given ? (rd.other + " · " + overMarble()).toUpperCase() : "THE MARBLE STANDS " + MARBLE_CM + " CM. AND YOU?",
      mass: given ? (rd.other + " · read at the waist").toUpperCase() : "TURN THE RING AT THE WAIST, OR TYPE IT",
      years: given ? romanNumeral(M.age) + " · A STICK A YEAR" : "TURN THE WIDEST RING, A STICK A YEAR"
    }[K];
    const fields = K === "stature" ? (imp ? field("ft", ft === "" ? "" : String(ft), "5", "ft", "Height, feet") + field("in", inch === "" ? "" : String(inch), "2", "in", "Height, inches")
      : field("cm", M.cm !== null ? String(Math.round(M.cm)) : "", String(MARBLE_CM), "cm", "Height in centimetres"))
      : K === "mass" ? field("kg", M.kg !== null ? (imp ? String(poundsOf(M.kg)) : kgText(M.kg)) : "", imp ? "154" : "70", imp ? "lb" : "kg", imp ? "Body weight in pounds" : "Body weight in kilograms")
      : field("age", M.age !== null ? String(M.age) : "", "30", "years", "Age in years");
    const what = NAMES[K].toLowerCase();
    return cap +
      '<div style="display:flex; align-items:baseline; gap:10px; margin-top:8px; color:' + numColor + '; transition:color .5s ease">' +
        (ui.editing ? fields
          : '<button type="button" class="mz-roll" data-act="edit" aria-label="' + NAMES[K] + ", " + (given ? rd.big : "not given") + '. Type it" title="Click to type" style="font:italic 400 ' + size + 'px/1 var(--serif); font-variant-numeric:lining-nums tabular-nums">' + roll + '</button>' +
            '<span style="font:italic 400 50px/1 var(--serif)">' + unit + '</span>') +
      '</div>' +
      '<p style="margin:8px 0 0; font:500 11px/1.5 var(--mono); letter-spacing:.1em; color:var(--ink-faint)">' + esc(alt) + '</p>' +
      '<div style="display:flex; align-items:center; gap:8px; margin-top:18px">' +
        '<button type="button" class="mz-coin" data-step="-1" aria-label="Turn ' + what + ' down">' + coinSvg("M19 26h14") + '</button>' +
        '<button type="button" class="mz-coin" data-step="1" aria-label="Turn ' + what + ' up">' + coinSvg("M19 26h14M26 19v14") + '</button>' +
        '<span style="margin-left:8px; font:italic 400 17px/1.2 var(--serif); color:var(--ink-faint)">or click the number to type it</span>' +
      '</div>' +
      (given ? '<button type="button" class="mz-link" data-act="clear" style="margin-top:14px">Clear ' + what + '</button>' : "");
  }
  function fourHtml() {
    const n = M.given;
    return '<p style="margin:0; font:500 11px/1 var(--mono); letter-spacing:.18em; color:var(--ink-faint)">READ AT THE INDEX</p>' +
      '<div style="display:flex; flex-direction:column; margin-top:10px">' + KEYS.map((k, i) => {
        const rd = reading(k);
        return '<button type="button" class="mz-row" data-go="' + i + '" data-hover="' + k + '">' +
          '<span style="display:flex; align-items:baseline; gap:10px"><span style="font:500 15px/1 var(--serif); color:var(--ink-faint)">' + NUM[i] + '</span>' +
          '<span style="font:italic 400 21px/1 var(--serif); color:' + (ui.hover === k ? traceOf(k) : "var(--ink-soft)") + '; transition:color .3s ease">' + NAMES[k] + '</span></span>' +
          '<span style="font:italic 400 50px/1 var(--serif); font-variant-numeric:lining-nums; letter-spacing:-.02em; color:' + (rd ? traceOf(k) : "var(--ink-faint)") + '">' + (rd ? rd.short : "—") + '</span></button>';
      }).join("") + '</div>' +
      '<p style="margin:14px 0 0; display:flex; align-items:baseline; gap:9px; font-size:13.5px; line-height:1.45; color:' + (n === 4 ? "var(--ink-soft)" : "var(--warn)") + '"><span style="flex:none; width:6px; height:6px; border-radius:50%; background:' + (n === 4 ? "var(--legs)" : "var(--warn)") + '; transform:translateY(-1px)"></span><span>' +
        (n === 4 ? "All four given. Nutrition’s estimate is yours, not an average (estimate)." : ["Nothing given yet", "One fact given", "Two facts given", "Three facts given"][n] + ": a ring not yet turned stands low.") + '</span></p>';
  }
  function markHtml() {
    const day = new Date((M.sealed || new Date().toISOString().slice(0, 10)) + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    return '<p style="margin:0; font:500 11px/1 var(--mono); letter-spacing:.18em; color:var(--ink-faint)">YOUR MARK</p>' +
      '<p style="margin:12px 0 0; font:italic 400 22px/1.3 var(--serif); color:var(--ink-soft)">' + (M.complete ? "Taken " + day + ". Never sent anywhere." : ["Nothing given yet", "One fact given", "Two facts given", "Three facts given"][M.given] + ": a rim not yet turned stands low.") + '</p>' +
      '<div class="mz-own">' +
        '<label class="own-name"><span class="own-l">Whose it is</span>' +
          '<input class="own-in" maxlength="' + MEASURE_NAME_MAX + '" placeholder="You" value="' + esc(M.name || "") + '" autocomplete="off" spellcheck="false" aria-label="A name on your mark"></label>' +
        '<div class="own-ink-w"><span class="own-l" aria-hidden="true">The stone</span><div class="own-ink" role="radiogroup" aria-label="The stone your mark is cut from">' +
          Object.entries(MEASURE_INKS).map(([k, w]) => '<button type="button" role="radio" data-ink="' + k + '" aria-checked="' + (M.ink === k) + '" tabindex="' + (M.ink === k ? 0 : -1) + '" aria-label="' + w + '" title="' + w + '"><i></i></button>').join("") +
        '</div></div>' +
      '</div>' +
      '<p style="margin:22px 0 0; display:flex; flex-wrap:wrap; gap:6px 22px"><button type="button" class="mz-link" data-act="recut">Cut another stone</button></p>';
  }

  function render() {
    if (!live()) return;
    const key = STEPS[ui.step], K = KEYS[ui.step];
    pvMorph(plate,
      '<div class="mz-hit" id="mz-hit" style="cursor:' + (ui.grabbing ? "grabbing" : ui.hover ? (ui.hover === K ? "grab" : "pointer") : "default") + '"></div>' +
      leftHtml() +
      '<div class="mz-read" data-k="' + key + '">' + (K ? factHtml(K) : key === "four" ? fourHtml() : markHtml()) + '</div>');
    // The footer's coins: a ring each, its pigment round it once given; the four; your mark.
    pvMorph(foot, STEPS.map((k, i) => {
      const on = ui.step === i, ring = KEYS.includes(k) && stored(k) !== null ? pigOf(k) : "transparent";
      return '<button type="button" data-go="' + i + '" title="' + NAMES[k] + '" aria-label="' + NAMES[k] + '"' + (on ? ' aria-current="step"' : "") + '>' +
        '<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="mz-beads" cx="26" cy="26" r="24.2" pathLength="40" style="opacity:.7"></circle><circle cx="26" cy="26" r="19.5" style="stroke:' + ring + '; stroke-width:2"></circle></svg>' +
        '<span>' + (i < 4 ? NUM[i] : i === 4 ? "◆" : '<i class="mz-stone" data-ink="' + M.ink + '"></i>') + '</span></button>';
    }).join(""));
    foot.hidden = Stages.narrow;
    if (ui.editing && !wasEditing) { const i = plate.querySelector(".mz-in"); if (i) { i.focus(); i.select(); } }
    wasEditing = ui.editing;
  }
  let wasEditing = false;

  /** Goes to a step: a fact, the four, or your mark. */
  function go(i, into = false) {
    i = clamp(i, 0, STEPS.length - 1);
    if (i === ui.step) return;
    release();
    ui.step = i; ui.hover = null; ui.typing = null; ui.editing = false;
    if (STEPS[i] === "mark" && !M.seed) { M.recut(); save(); }
    turnAt = null;
    render();
    if (live()) { Stages.refresh(); if (!Stages.busy) Stages.remember(); }
    if (into) { const f = plate.querySelector(".mz-read [data-act=edit], .mz-read [role=radio][tabindex='0'], .mz-read .mz-row, .mz-read .own-in"); if (f) f.focus({ preventScroll: true }); }
  }
  const firstMissing = () => { const i = KEYS.findIndex(k => stored(k) === null); return i < 0 ? 4 : i; };

  /* --------------------------------- the hand --------------------------------- */
  /** The ring whose sticks are under a point of the plate, or null. */
  function ringAt(px, py) {
    if (medal > .3) return null;
    let best = null, bd = 1e9;
    for (const k of KEYS) {
      const R = geom(k), co = Math.cos(-R.roll), si = Math.sin(-R.roll), dx = px - R.cx, dy = py - R.cy;
      const lx = dx * co - dy * si, ly = dx * si + dy * co;
      if (Math.abs(lx) > R.r + 8 || R.op < .5) continue;
      const a = Math.acos(clamp(lx / R.r, -1, 1)), yc = R.r * R.kk * Math.sin(a), mid = yc - R.H * .5;
      const dist = Math.abs(ly - mid) - R.H * .5 - (KEYS[ui.step] === k ? 8 : 0);
      if (dist < 12 && dist < bd) { bd = dist; best = k; }
    }
    return best;
  }
  const unitPx = k => Math.max(2, geom(k).r * dthU(k));
  function release() {
    const D = drag; if (!D) return;
    const s = st[D.k];
    s.vel = performance.now() - D.lt < 90 ? clamp(D.v, -.12, .12) : 0;
    s.mode = Math.abs(s.vel) > .003 ? "coast" : "spring";
    if (s.mode === "spring") { commit(D.k); save(); }
    drag = null;
    ui.grabbing = false;
    render();
  }

  sec.addEventListener("pointerdown", e => {
    if (!e.target.closest("#mz-hit") || Stages.busy || (e.pointerType === "mouse" && e.button !== 0)) return;
    const [px, py] = toPlate(e), k = ringAt(px, py);
    if (!k) return;
    if (KEYS[ui.step] !== k) { go(KEYS.indexOf(k)); return; }
    e.preventDefault();
    const s = st[k];
    s.mode = "drag"; s.vel = 0;
    drag = { k, x: px, from: s.pos, lx: px, lt: performance.now(), v: 0 };
    ui.grabbing = true; ui.editing = false;
    render();
  });
  addEventListener("pointermove", e => {
    if (!live()) return;
    lampTo = e.clientX / innerWidth * 2 - 1;
    const [px, py] = toPlate(e);
    if (drag) {
      const D = drag, s = st[D.k], sc = scale(D.k), per = unitPx(D.k), now = performance.now(), dt = Math.max(1, now - D.lt);
      s.pos = clamp(D.from - (px - D.x) / per, sc.lo, sc.hi);
      D.v = D.v * .6 + (-(px - D.lx) / per / dt) * .4; D.lx = px; D.lt = now;
      commit(D.k);
      return;
    }
    const over = e.target.closest && e.target.closest("#mz-hit") ? ringAt(px, py) : null;
    if (over !== ui.hover && !e.target.closest(".mz-row")) { ui.hover = over; render(); }
  }, { passive: true });
  addEventListener("pointerup", release);
  addEventListener("pointercancel", release);

  /* The wheel: on the ring in hand, or sideways, it turns it; otherwise it goes from step to step. */
  let owns = false, acc = 0, spent = false, wheelAt = 0, movedAt = 0;
  addEventListener("wheel", e => {
    owns = false;
    if (!live() || Stages.busy || Stages.narrow || e.ctrlKey || (e.target.closest && e.target.closest(".mz-read input"))) return;
    const K = KEYS[ui.step], px = e.deltaMode === 1 ? 32 : 1;
    if (K) {
      const [x, y] = toPlate(e), side = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (side || ringAt(x, y) === K) {
        owns = true;
        const s = st[K], d = (side ? e.deltaX : e.deltaY) * px;
        s.vel = clamp((s.mode === "coast" ? s.vel : 0) + d / unitPx(K) / 220, -.1, .1); s.mode = "coast";
        return;
      }
    }
    const now = performance.now(), d = e.deltaY * px;
    if (now - wheelAt > 380) { acc = 0; spent = false; }
    wheelAt = now;
    const can = d > 0 ? ui.step < STEPS.length - 1 : ui.step > 0;
    owns = can || now - movedAt < 750;
    if (!can || spent) return;
    acc += d;
    if (Math.abs(acc) > 70) { acc = 0; spent = true; movedAt = now; go(ui.step + Math.sign(d)); }
  }, { capture: true, passive: true });

  addEventListener("keydown", e => {
    const el = e.target instanceof Element ? e.target : document.body;
    if (!live() || Stages.busy || el.closest("input, textarea, select, [role=radiogroup]")) return;
    const side = { ArrowRight: 1, ArrowLeft: -1, PageDown: 1, PageUp: -1 }[e.key], up = { ArrowUp: 1, ArrowDown: -1 }[e.key], K = KEYS[ui.step];
    if (side) { e.preventDefault(); go(ui.step + side); }
    else if (up && K) { e.preventDefault(); stepBy(K, up); }
  });

  /* --------------------------------- typing --------------------------------- */
  /** A field typed in: kept while it fits the limits, held to them once it is left (commit). */
  function typed(f, text, commitIt) {
    const blank = !String(text).trim(), n = parseFloat(String(text).replace(",", "."));
    const ok = (field, v) => commitIt ? Number.isFinite(v) : BodyMeasure.fits(field, v);
    if (f === "cm") { if (blank) { if (commitIt) M.set("cm", null); } else if (ok("cm", n)) M.set("cm", n); }
    else if (f === "ft" || f === "in") {
      const [ft0, in0] = M.cm !== null ? feetInches(M.cm) : [5, 2], ft = f === "ft" ? n : ft0, inch = f === "in" ? (blank ? 0 : n) : in0;
      if (Number.isFinite(ft)) { const cm = (ft * 12 + inch) * 2.54; if (ok("cm", cm)) M.set("cm", cm); }
    } else if (f === "kg") { if (blank) { if (commitIt) M.set("kg", null); } else { const kg = M.imperial ? n * KG_PER_LB : Math.round(n * 10) / 10; if (ok("kg", kg)) M.set("kg", kg); } }
    else if (f === "age") { if (blank) { if (commitIt) M.set("age", null); } else if (ok("age", n)) M.set("age", n); }
    if (commitIt) save();
  }
  const ringOf = f => f === "kg" ? "mass" : f === "age" ? "years" : "stature";
  plate.addEventListener("input", e => {
    const t = e.target;
    if (t.matches(".mz-in")) { ui.typing = { f: t.dataset.f, text: t.value }; typed(t.dataset.f, t.value, false); render(); }
    else if (t.matches(".own-in")) M.name = t.value.trim().slice(0, MEASURE_NAME_MAX) || null;
  });
  plate.addEventListener("focusout", e => {
    const t = e.target;
    if (t.matches(".own-in")) { save(); punch = 1; return; }
    if (!t.matches(".mz-in")) return;
    typed(t.dataset.f, t.value, true);
    // The pair of imperial fields: stay open while the other one takes the focus.
    setTimeout(() => { const a = document.activeElement; if (!(a && a.matches && a.matches(".mz-in"))) { ui.typing = null; ui.editing = false; render(); } }, 0);
  });
  plate.addEventListener("keydown", e => {
    const t = e.target, k = e.key;
    if (t.matches(".mz-in")) {
      const d = { ArrowUp: 1, ArrowDown: -1 }[k];
      if (d) { e.preventDefault(); ui.typing = null; stepBy(ringOf(t.dataset.f), d * (e.shiftKey ? 10 : 1)); }
      else if (k === "Enter" || k === "Escape") t.blur();
      return;
    }
    if (t.matches(".own-in")) { if (k === "Enter") t.blur(); return; }
    const grp = t.closest("[role=radiogroup]"), side = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[k];
    if (grp && side) {
      e.preventDefault();
      const bs = [...grp.querySelectorAll("[role=radio]")], i = Math.max(0, bs.findIndex(b => b.getAttribute("aria-checked") === "true"));
      bs[(i + side + bs.length) % bs.length].click();
      const n = grp.querySelector("[aria-checked=true]"); if (n) n.focus({ preventScroll: true });
    }
  });

  /* A coin held down keeps stepping. */
  let holdT = 0, holdI = 0;
  const stopHold = () => { clearTimeout(holdT); clearInterval(holdI); };
  plate.addEventListener("pointerdown", e => {
    const b = e.target.closest("[data-step]"), K = KEYS[ui.step];
    if (!b || !K) return;
    e.preventDefault();
    const n = +b.dataset.step, once = () => stepBy(K, n);
    once(); stopHold();
    holdT = setTimeout(() => { holdI = setInterval(once, 70); }, 420);
  });
  addEventListener("pointerup", stopHold);
  addEventListener("pointercancel", stopHold);

  const onClick = e => {
    const t = e.target, K = KEYS[ui.step];
    const stp = t.closest("[data-step]");
    // A coin is stepped on pointerdown; a click from the keyboard steps it here.
    if (stp) { if (e.detail === 0 && K) stepBy(K, +stp.dataset.step); return; }
    const g = t.closest("[data-go]");
    if (g) { go(+g.dataset.go, e.detail === 0); return; }
    const u = t.closest("[data-units]");
    if (u) { setUnits(u.dataset.units); return; }
    const sx = t.closest("[data-sex]");
    if (sx) { M.set("sex", sx.dataset.sex); save(); render(); return; }
    const ik = t.closest("[data-ink]");
    if (ik && ik.closest(".own-ink")) { M.ink = ik.dataset.ink; save(); render(); punch = 1; return; }
    const act = t.closest("[data-act]"), a = act && act.dataset.act;
    if (a === "edit") { ui.editing = true; render(); }
    else if (a === "clear" && K) clearFact(K);
    else if (a === "recut") { M.recut(); save(); punch = 1; announce("A new stone is cut"); }
    else if (a === "wipe") { M.clear(); M.recut(); save(); render(); announce("Your measure is cleared"); }
  };
  plate.addEventListener("click", onClick);
  foot.addEventListener("click", onClick);
  plate.addEventListener("pointerover", e => { const r = e.target.closest(".mz-row"); if (r && ui.hover !== r.dataset.hover) { ui.hover = r.dataset.hover; render(); } });
  plate.addEventListener("pointerout", e => { const r = e.target.closest(".mz-row"); if (r && !(e.relatedTarget && r.contains(e.relatedTarget))) { ui.hover = null; render(); } });

  /* --------------------------------- drawing --------------------------------- */
  let C = null, themeFor = "";
  /** The page's colours, read once a theme. */
  function colours() {
    const theme = document.documentElement.dataset.theme || "light";
    if (C && themeFor === theme) return C;
    themeFor = theme;
    const cs = getComputedStyle(Stages.root), v = n => cs.getPropertyValue(n).trim();
    const V = { bg: v("--bg"), ink: v("--ink"), faint: v("--ink-faint"), line: v("--line") };
    const dark = theme === "dark", pig = {}, trace = {}, soft = {}, hatch = {};
    for (const k of KEYS) {
      pig[k] = v("--" + PIG[k]); trace[k] = v("--" + PIG[k] + "-trace");
      soft[k] = hexMix(pig[k], V.bg, .48); hatch[k] = hexMix(pig[k], V.bg, .38);
    }
    return C = { ...V, dark, pig, trace, soft, hatch, empty: hexMix(V.line, V.faint, dark ? .45 : .2) };
  }
  /** A canvas the size of the stage, its drawing in plate units. */
  function canvas(c) {
    const r = stage.getBoundingClientRect(), s = sec.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const x = c.getContext("2d");
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
    x.setTransform(dpr * fit.k, 0, 0, dpr * fit.k, dpr * (s.left - r.left + fit.ox), dpr * (s.top - r.top + fit.oy));
    return x;
  }
  function draw() {
    const cb = canvas(back), cf = canvas(front), P = colours();
    const order = [...KEYS].sort((a, b) => disp[a].e - disp[b].e);
    if (medal > .02) drawMedal(cb, cf, P);
    for (const k of order) drawRing(cb, cf, k, P);
    const K = KEYS[ui.step];
    if (K && disp[K].e > .6 && medal < .1) drawOrbit(cb, cf, K, P);
  }
  /* A ring of sticks round the body, one a unit of its scale: those reached
     stand in the pigment, softened, every major one and the reading in
     full; the rest stand low, outlined. Breathing, the sticks swell and a
     soft wave goes round them. At the mark the sticks turn outward from
     the stone. */
  function drawRing(cb, cf, k, P) {
    const R = geom(k), S = sticksOf(k), sc = scale(k), e = R.e, m = R.m, all = ui.step === 4, act = KEYS[ui.step] === k;
    const alpha = R.op * (all && ui.hover && ui.hover !== k ? .35 : 1);
    if (alpha < .01) return;
    const r = R.r, kk = R.kk, dth = dthU(k), pos = st[k].pos + R.drift, Hm = R.H;
    const spacing = r * dth * (k === "physis" ? .072 : sc.per), Wb = Math.min(act ? 15 : 13, Math.max(2.4, spacing * .6));
    const midpoint = k === "physis" && M.sex === "unspecified", v = stored(k);
    for (const c of [cb, cf]) { c.save(); c.translate(R.cx, R.cy); c.rotate(R.roll); c.globalAlpha = alpha; }
    // The line the sticks stand on.
    if (m < .5) {
      cb.strokeStyle = P.faint; cb.lineWidth = 1; cb.globalAlpha = alpha * .3 * (1 - m * 2); cb.beginPath(); cb.ellipse(0, 0, r, r * kk, 0, PI, 2 * PI); cb.stroke();
    }
    cf.strokeStyle = P.faint; cf.lineWidth = 1; cf.globalAlpha = alpha * (.5 + .2 * m); cf.beginPath(); cf.ellipse(0, 0, r, r * kk, 0, m > .5 ? PI : 0, m > .5 ? 3 * PI : PI); cf.stroke();
    const list = [];
    for (let j = 0; j < S.n; j++) { const a = PI / 2 - (S.u[j] - pos) * dth; list.push([Math.sin(a), Math.cos(a), j, a]); }
    list.sort((x, y) => x[0] - y[0]);
    for (const [sa, ca, j, a] of list) {
      const back = sa < 0 && m < .5, c = back ? cb : cf;
      const wave = 1 + R.idle * .05 * Math.sin(clock / 520 - j * .45);
      const hf = (.74 + .26 * sa) * (1 - m) + m, h = Math.max(0, S.h[j]) * Hm * hf * wave;
      const w = (Wb * (.22 + .78 * Math.abs(sa)) * (.86 + .14 * sa)) * (1 - m) + Wb * .8 * m;
      if (h < .4 || w < .3) continue;
      const x = r * ca, y = r * kk * sa, on = v !== null && (k === "physis" ? S.grp[j] === v : S.u[j] <= v + 1e-6);
      const here = v !== null && k !== "physis" && Math.abs(S.u[j] - v) < sc.per / 2 + 1e-6;
      // Over the crown, a tall stature's far sticks would reach the masthead: they fade as they climb.
      const ceil = clamp((R.cy + y - h - 84) / 36, 0, 1);
      c.globalAlpha = alpha * ((back ? .42 : 1) * (.55 + .45 * Math.min(1, Math.abs(sa) * 2.5)) * (1 - m) + m) * ceil;
      c.save(); c.translate(x, y);
      // Upright while it hangs; at the mark, turned out from the stone.
      if (m > 0) { let t = a + PI / 2; t = Math.atan2(Math.sin(t), Math.cos(t)); c.rotate(t * m); }
      c.beginPath(); c.roundRect(-w / 2, -h, w, h, Math.min(2, w / 2));
      if (on) {
        if (midpoint) {
          c.save(); c.clip(); c.strokeStyle = P.hatch[k]; c.lineWidth = 1.4; c.beginPath();
          for (let q = -h; q < w + h; q += 4.2) { c.moveTo(-w / 2 + q, 0); c.lineTo(-w / 2 + q - h, -h); }
          c.stroke(); c.restore();
          c.strokeStyle = P.hatch[k]; c.lineWidth = 1; c.beginPath(); c.roundRect(-w / 2 + .5, -h + .5, w - 1, h - 1, Math.min(2, w / 2)); c.stroke();
        } else { c.fillStyle = S.maj[j] || here || k === "physis" ? P.pig[k] : P.soft[k]; c.fill(); }
      } else { c.strokeStyle = P.empty; c.lineWidth = 1; c.beginPath(); c.roundRect(-w / 2 + .5, -h + .5, Math.max(.5, w - 1), Math.max(.5, h - 1), Math.min(2, w / 2)); c.stroke(); }
      c.restore();
    }
    // The scale's numbers under the near sticks, on the ring in hand.
    if (e > .6 && k !== "physis" && m < .1) {
      cf.fillStyle = P.faint; cf.textAlign = "center"; cf.textBaseline = "top"; cf.font = "500 10.5px " + 'ui-monospace, "SF Mono", Menlo, monospace';
      for (const [sa, ca, j] of list) {
        if (sa < .3 || !S.maj[j]) continue;
        cf.save(); cf.translate(r * ca, r * kk * sa + 8); cf.scale(Math.max(.3, sa), 1);
        cf.globalAlpha = alpha * Math.min(1, (sa - .3) * 3) * (e - .6) / .4;
        cf.fillText(sc.label(Math.round(S.u[j])), 0, 0); cf.restore();
      }
    }
    // The index over the front, where the ring in hand is read.
    if ((act || all) && m < .5) {
      const top = r * kk - Hm * 1.2 - 8;
      cf.globalAlpha = alpha * (act ? 1 : .7) * (1 - m * 2); cf.fillStyle = P.ink;
      cf.beginPath(); cf.moveTo(0, top - 13); cf.lineTo(4.5, top - 6.5); cf.lineTo(0, top); cf.lineTo(-4.5, top - 6.5); cf.closePath(); cf.fill();
    }
    cb.restore(); cf.restore();
  }
  /* What the ring in hand says goes round the body with it, letter by letter
     on a wider circle in its plane: the near half read, the far half behind
     the figure. */
  const glyphW = new Map(), SERIF = '"Cormorant Garamond", serif';
  function drawOrbit(cb, cf, k, P) {
    const R = geom(k), a0 = clamp((R.e - .6) / .4, 0, 1) * R.op * (1 - medal * 10);
    if (a0 < .02) return;
    const rd = reading(k), words = rd ? [rd.big, rd.other, { stature: () => overMarble(), mass: () => "read at the waist", years: () => "a stick a year", physis: () => "for the resting burn" }[k]()]
      : { stature: ["how tall", "the marble stands " + MARBLE_CM + " cm", "and you"], mass: ["how heavy", "turn the ring", "or type it"], years: ["how many years", "turn the ring", "a stick a year"], physis: ["which physiology", "three stops", "or leave it"] }[k];
    const slots = words.length * 2, ro = clamp(R.r * 1.06, 250, 330), arc = 2 * PI * ro / slots;
    const wide = (ch, f) => { const id = f + ch; let w = glyphW.get(id); if (w === undefined) { cf.font = f + " 100px " + SERIF; w = cf.measureText(ch).width / 100; glyphW.set(id, w); } return w; };
    const style = i => i % words.length ? "italic 400" : "italic 600";
    const len = (w, f) => { let n = 0; for (const ch of w) n += wide(ch, f); return n; };
    const fs = Math.min(42, arc * .78 / Math.max(...words.map((w, i) => len(w, style(i)))));
    const phase = st[k].pos * dthU(k) + spin, lift = -(ro - R.r) * R.kk - R.H * 1.25 - fs * .55;
    // Over the crown, the far half would run into the masthead: it fades out as it climbs.
    const ceil = y => clamp((R.cy + y - 92) / 40, 0, 1);
    const seen = sa => clamp((Math.abs(sa) - .16) * 3.2, 0, 1);
    for (const c of [cb, cf]) { c.save(); c.translate(R.cx, R.cy); c.rotate(R.roll); c.fillStyle = P.trace[k]; c.textAlign = "center"; c.textBaseline = "alphabetic"; }
    for (let i = 0; i < slots; i++) {
      const w = words[i % words.length], f = style(i), mid = PI / 2 + phase - i * 2 * PI / slots, font = f + " " + fs.toFixed(1) + "px " + SERIF;
      let x = -len(w, f) * fs / 2;
      for (const ch of w) {
        const cw = wide(ch, f) * fs, a = mid - (x + cw / 2) / ro, sa = Math.sin(a), ca = Math.cos(a);
        x += cw;
        if (ch === " " || Math.abs(sa) < .17) continue;
        const c = sa > 0 ? cf : cb;
        c.save(); c.globalAlpha = a0 * seen(sa) * (sa > 0 ? 1 : .3) * ceil(ro * R.kk * sa + lift); c.font = font;
        c.transform(sa, -R.kk * ca, 0, 1, ro * ca, ro * R.kk * sa + lift);
        c.fillText(ch, 0, 0); c.restore();
      }
      // A small lozenge between one phrase and the next.
      const a = mid + PI / slots, sa = Math.sin(a), c = sa > 0 ? cf : cb;
      c.globalAlpha = a0 * seen(sa) * (sa > 0 ? .8 : .25) * ceil(ro * R.kk * sa + lift);
      c.beginPath(); const bx = ro * Math.cos(a), by = ro * R.kk * sa + lift - fs * .28;
      c.moveTo(bx, by - 3.2); c.lineTo(bx + 2.4, by); c.lineTo(bx, by + 3.2); c.lineTo(bx - 2.4, by); c.closePath(); c.fill();
    }
    cb.restore(); cf.restore();
  }

  /* The mark: a disc of the user's own stone. Its veining is drawn from a
     seed kept with the measure (cut once, the same ever after, unlike a
     reading); what is inscribed is gilt: the first letter of the name, the
     name round the head, the day it was struck round the foot. */
  const GILT = { light: { deep: "#452b0b", mid: "#8a5c1e", warm: "#b98a3c", hi: "#f4dca4" }, dark: { deep: "#2c1b05", mid: "#7a5219", warm: "#ad7d31", hi: "#f8d891" } };
  const STONES = {
    core: { base: "#8a3a3c", deep: "#4f1b22", vein: "#f2dfd4", fleck: "#c98b7a" },
    pull: { base: "#2b4884", deep: "#15264d", vein: "#e3e8f1", fleck: "#c9a24a" },
    legs: { base: "#2c5943", deep: "#122d21", vein: "#dfe9d8", fleck: "#86ad92" },
    push: { base: "#c0913c", deep: "#7a5116", vein: "#f9eecd", fleck: "#8a4a22" },
    ink: { base: "#242221", deep: "#0a0909", vein: "#eeeae2", fleck: "#8f8a80" }
  };
  const rgba = (hex, a) => "rgba(" + [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(",") + "," + a.toFixed(3) + ")";
  const slab = { id: "", c: null };
  /** The stone for a seed, cut once and kept: clouds, veins running with one grain, flecks. */
  function cutStone(seed, ink) {
    const id = seed + ink;
    if (slab.id === id) return slab.c;
    const T = 720, c = slab.c || document.createElement("canvas"), S = STONES[ink] || STONES.ink;
    c.width = c.height = T;
    const x = c.getContext("2d");
    let a = seed >>> 0;
    const rnd = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    x.fillStyle = S.base; x.fillRect(0, 0, T, T);
    for (let i = 0; i < 52; i++) {
      const cx = rnd() * T, cy = rnd() * T, r = T * (.07 + rnd() * .3), dark = rnd() < .58, col = dark ? S.deep : S.vein;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, rgba(col, dark ? .12 + rnd() * .2 : .04 + rnd() * .09)); g.addColorStop(1, rgba(col, 0));
      x.fillStyle = g; x.fillRect(0, 0, T, T);
    }
    const grain = rnd() * PI;
    x.lineCap = "round";
    const vein = (px, py, ang, w, al, depth) => {
      const wob = rnd() * 10, inside = () => px > -30 && px < T + 30 && py > -30 && py < T + 30;
      let been = inside();
      for (let i = 0; i < 260; i++) {
        ang += (rnd() - .5) * .3 + Math.sin(i * .07 + wob) * .05 + (grain - ang) * .04;
        const nx = px + Math.cos(ang) * 7, ny = py + Math.sin(ang) * 7, ww = w * (.45 + rnd());
        x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny);
        x.strokeStyle = rgba(S.vein, al * .1); x.lineWidth = ww * 7; x.stroke();
        x.strokeStyle = rgba(S.vein, al * (.6 + rnd() * .4)); x.lineWidth = ww; x.stroke();
        if (depth < 2 && rnd() < .02) vein(nx, ny, ang + (rnd() < .5 ? -1 : 1) * (.4 + rnd() * .7), w * .55, al * .8, depth + 1);
        px = nx; py = ny;
        if (inside()) been = true; else if (been) break;
      }
    };
    for (let i = 0, n = 4 + Math.floor(rnd() * 3); i < n; i++) {
      const off = (rnd() - .5) * T * 1.1;
      vein(T / 2 - Math.cos(grain) * T * .72 - Math.sin(grain) * off, T / 2 - Math.sin(grain) * T * .72 + Math.cos(grain) * off, grain, .7 + rnd() * 2.6, .35 + rnd() * .5, 0);
    }
    for (let i = 0; i < 1100; i++) {
      x.fillStyle = rgba(rnd() < .5 ? S.fleck : S.vein, .12 + rnd() * .4);
      x.beginPath(); x.arc(rnd() * T, rnd() * T, .4 + rnd() * 1.1, 0, 2 * PI); x.fill();
    }
    slab.id = id; slab.c = c;
    return c;
  }
  /** Writes round a circle, read from outside at the head or from inside at the foot. */
  function arcText(c, text, r, foot, fs, track) {
    const ws = [...text].map(ch => c.measureText(ch).width + track), total = ws.reduce((a, b) => a + b, 0) - track;
    let x = -total / 2;
    [...text].forEach((ch, i) => {
      const a = (x + (ws[i] - track) / 2) / r;
      c.save();
      if (foot) { c.rotate(-a); c.translate(0, r + fs * .36); } else { c.rotate(a); c.translate(0, -r + fs * .36); }
      c.fillText(ch, 0, 0);
      c.restore();
      x += ws[i];
    });
  }
  function drawMedal(cb, c, P) {
    const a = smooth(clamp((medal - .25) / .6, 0, 1)), Rm = G.MR * (1 + punch * .025), B = GILT[P.dark ? "dark" : "light"];
    if (a < .01) return;
    const outer = Rm + 14 + 3 * 17 + 12;
    // Its shadow on the ground, under everything.
    cb.save(); cb.globalAlpha = a;
    const sh = cb.createRadialGradient(G.MX, G.MY + 22, outer * .82, G.MX, G.MY + 22, outer * 1.22);
    sh.addColorStop(0, P.dark ? "rgba(0,0,0,.5)" : "rgba(60,40,10,.18)"); sh.addColorStop(1, "rgba(0,0,0,0)");
    cb.fillStyle = sh; cb.beginPath(); cb.arc(G.MX, G.MY + 22, outer * 1.25, 0, 2 * PI); cb.fill();
    cb.restore();

    c.save(); c.globalAlpha = a; c.translate(G.MX, G.MY);
    c.save();
    c.beginPath(); c.arc(0, 0, Rm + 2.5, 0, 2 * PI); c.clip();
    c.drawImage(cutStone(M.seed || 1, M.ink), -Rm - 3, -Rm - 3, 2 * Rm + 6, 2 * Rm + 6);
    // Polished: the lamp on its upper left, following the pointer; darker toward the rim.
    const lx = (-.34 + lamp * .5) * Rm, ly = -.46 * Rm;
    let gr = c.createRadialGradient(lx, ly, 0, lx, ly, Rm * 1.5);
    gr.addColorStop(0, "rgba(255,255,255,.36)"); gr.addColorStop(.3, "rgba(255,255,255,.08)"); gr.addColorStop(1, "rgba(0,0,0,.34)");
    c.fillStyle = gr; c.fillRect(-Rm - 3, -Rm - 3, 2 * Rm + 6, 2 * Rm + 6);
    gr = c.createRadialGradient(0, 0, Rm * .8, 0, 0, Rm + 3);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.42)");
    c.fillStyle = gr; c.fillRect(-Rm - 3, -Rm - 3, 2 * Rm + 6, 2 * Rm + 6);
    c.restore();
    // The inscription, cut into the stone and gilt.
    const gilt = c.createLinearGradient(-Rm, -Rm, Rm, Rm);
    gilt.addColorStop(0, B.hi); gilt.addColorStop(.35 + lamp * .15, "#fff3cf"); gilt.addColorStop(.55, B.warm); gilt.addColorStop(1, B.mid);
    const cut = d => {
      c.fillStyle = c.strokeStyle = "rgba(0,0,0,.6)"; c.save(); c.translate(-1.1, -1.2); d(); c.restore();
      c.fillStyle = c.strokeStyle = "rgba(255,255,255,.28)"; c.save(); c.translate(1, 1.1); d(); c.restore();
      c.fillStyle = c.strokeStyle = gilt; d();
    };
    c.textAlign = "center"; c.textBaseline = "alphabetic"; c.lineWidth = 1.2;
    cut(() => { c.beginPath(); c.arc(0, 0, Rm * .93, 0, 2 * PI); c.stroke(); });
    const name = (M.name || "").trim(), first = name ? [...name][0].toLocaleUpperCase() : "";
    if (first) { const fs = Rm * 1.08; c.font = "500 " + fs.toFixed(1) + "px " + SERIF; cut(() => c.fillText(first, 0, fs * .32)); }
    const small = Rm * .105;
    c.font = "600 " + small.toFixed(1) + "px " + SERIF;
    if (name) cut(() => arcText(c, name.toLocaleUpperCase(), Rm * .77, false, small, small * .34));
    const d = new Date((M.sealed || new Date().toISOString().slice(0, 10)) + "T12:00:00");
    cut(() => arcText(c, romanNumeral(d.getDate()) + " · " + romanNumeral(d.getMonth() + 1) + " · " + romanNumeral(d.getFullYear()), Rm * .77, true, small, small * .3));
    c.restore();
  }

  /* -------------------------------- each frame -------------------------------- */
  /* The marble stands in the middle of the rings, and is not quite still:
     it turns a few degrees one way and the other over a long breath, and
     with the ring in hand. */
  const SWAY = 4, SWAY_MS = 16000;
  let raf = 0, last = 0, leftAt = 0, refit = true;
  function loop(now) {
    raf = 0;
    if (!live()) {
      if (!leftAt) leftAt = now;
      if (now - leftAt > 900) { leftAt = 0; last = 0; return; }
    } else leftAt = 0;
    raf = requestAnimationFrame(loop);
    if (Stages.opening) { last = 0; return; }
    const dt = Math.min(100, now - (last || now)); last = now;
    if (refit) { refit = false; fitPlate(); }
    try {
      frame(dt, now);
      if (!Stages.narrow) draw();
      if (live() && !Stages.narrow && typeof figure === "object" && figure.moves) {
        figure.setDim(figOp);
        const sway = Stages.still ? 0 : SWAY * Math.sin(clock * 2 * PI / SWAY_MS);
        figure.standAt({ x: fit.ox + fit.k * G.X, y: fit.oy + fit.k * G.SOLE, h: fit.k * G.FIG, az: sway + turn });
      }
    } catch (e) { if (!loop.err) { loop.err = 1; console.warn("Measure: " + e.message); } }
  }
  const run = () => { if (!raf) raf = requestAnimationFrame(loop); };
  addEventListener("resize", () => { refit = true; if (live()) render(); });
  new ResizeObserver(() => { refit = true; }).observe(sec);

  /* --------------------------------- the stage -------------------------------- */
  /* The camera a change of stage travels to; standAt moves its end onto the rings' axis as it goes. */
  SCULPTURE_SHOTS["measure-plate"] = { az: 0, el: 0, ty: 79, d: 756, sx: .5, sy: .55, fov: 20 };
  SCULPTURE_SHOTS["measure"] = SCULPTURE_SHOTS["targets-front"];
  let from = null, openAt = null;
  function finish() {
    if (Stages.busy) return;
    M.sealed = new Date().toISOString().slice(0, 10);
    save();
    Stages.go("nutrition");
  }

  Stages.register("measure", {
    arrive() { from = Stages.from; openAt = Stages.at === "seal" || Stages.at === "dial" ? "mark" : Stages.at; },
    enter() {
      // Stepping back from Nutrition lands on the mark; any other arrival starts at the first ring still to set.
      const at = STEPS.includes(openAt) ? STEPS.indexOf(openAt) : from === "nutrition" ? 5 : M.complete ? 0 : firstMissing();
      openAt = null;
      ui.step = at; ui.hover = null; ui.editing = false; ui.typing = null;
      if (STEPS[at] === "mark" && !M.seed) { M.recut(); save(); }
      // The rings come down into the room one after another, the highest first; at the mark they are already there.
      const now = performance.now();
      born = now + (Stages.still ? 0 : from === null ? 0 : STAGE_TIMING.settle);
      medal = at === 5 ? 1 : 0; figOp = at === 5 ? .16 : 1;
      for (const k of KEYS) {
        const s = st[k], T = target(k);
        s.pos = stored(k) ?? def(k); s.vel = 0; s.mode = "spring";
        disp[k] = at === 5 || Stages.still ? { ...T } : { ...T, cy: T.cy - 110, op: 0 };
        const S = sticksOf(k); S.born = born; S.h.fill(0); S.hv.fill(0);
      }
      turn = 0; turnAt = null;
      refit = true; fitPlate();
      render();
      run();
    },
    place: () => STEPS[ui.step],
    shot: () => Stages.narrow ? "measure" : "measure-plate",
    dim: () => Stages.narrow ? 1 : figOp,
    // The wheel turns the ring in hand and goes from step to step, and leaves the stage at either end.
    wheel: () => owns ? false : undefined,
    focus: () => $("mz-title"),
    footer() {
      const s = ui.step, end = s === STEPS.length - 1;
      return {
        back: s > 0 ? NAMES[STEPS[s - 1]] : selection.isEmpty() ? "Your muscles" : "Training focus",
        skip: s < 4 ? "Skip for now" : "",
        next: end ? "Nutrition" : NAMES[STEPS[s + 1]],
        hint: end ? "" : "or scroll"
      };
    },
    onNext() { if (ui.step < STEPS.length - 1) go(ui.step + 1); else finish(); return true; },
    onBack() { if (ui.step > 0) go(ui.step - 1); else Stages.go("targets"); return true; },
    onSkip() { Stages.go("nutrition"); return true; }
  });
})();
