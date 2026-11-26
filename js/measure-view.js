/* ===========================================================================
   Measure stage: four facts for Nutrition's estimates (measure.js), between
   Targets and Nutrition, and the resting burn the four make (restingBurn).
   Nutrition reads the weight; the resting burn is shown here only.

   From the user's Claude Design file "Measure v13" (2026-11-26), with one
   change of the user's: the sum is not called "the four, at rest".

   The marble stands on a plinth of two steps, in a sky that breathes at
   the pace of what it burns. Four rings lie round it, one a fact, each in
   one of the app's pigments; the one taken up rises to where it is
   measured, and a camera moves round the body to look at it:

     stature     a ring at the crown, read off a rod on the lower step,
                 seen from the floor
     mass        a girdle at the waist as wide as the kilos, read off a
                 rule running out level, seen over the shoulder
     years       the dial cut round the plinth's edge, a bead a year,
                 seen from above
     physiology  a ring at the hips with three stops; the one turned to
                 face you counts

   Then at rest: the four close into one ring at the chest, each term an
   arc as long as what it adds, what takes away hatched back from where
   they close; the camera walks slowly round. Everything orbits at the pace
   of the burn, and one light (the sweep) goes round the ring in hand,
   lighting its reading as it passes.

   The reading stands in its own column at the right, a thread running to
   it from the ring. A fact is set by the hand (drag, or press a ring to
   take it up), the arrow keys, or typing.

   The rings are drawn through the design's own perspective camera on two
   canvases, one under the sculpture and one over, each point on the side
   of the body it passes; the live figure is filmed through the same camera
   (AnatomySculpture.filmAt), scaled to the height given. The words are set
   in a 1440 × 900 plate scaled to the screen, as on the other stages. On a
   phone the rings and the sky are left out for now.
   ========================================================================= */
(() => {
  const M = bodyMeasure;
  loadMeasure(M);
  const save = () => saveMeasure(M);
  const live = () => Stages.current === "measure";
  const sec = $("stage-measure"), doc = sec.querySelector(".arm");
  const stage = $("anatomy-stage"), mount = stage.querySelector(".anatomy-viewport");

  const KG = KG_PER_LB, TAU = Math.PI * 2;
  const KEYS = ["stature", "mass", "years", "physis"];
  const STEPS = [...KEYS, "rest"];
  const NAMES = { stature: "Stature", mass: "Mass", years: "Years", physis: "Physiology", rest: "At rest" };
  const NUM = ["I", "II", "III", "IV"];
  const PIG = { stature: "push", mass: "pull", years: "core", physis: "legs" };
  const CONST = RESTING_BURN.constant, MARBLE = RESTING_BURN.marble;
  const SEXN = MEASURE_SEX;
  const STOPS = ["female", "unspecified", "male"];
  const SERIF = '"Cormorant Garamond", Georgia, serif', MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
  const WATT = 4184 / 86400;
  /* The camera's focal length (plate px). */
  const FOC = 1480;
  /* Where each ring is measured, in cm round the body's axis; put down, each lies on the plinth at its own radius, years the dial cut round its edge. */
  const RAD = { stature: 52, physis: 78, sum: 92 };
  const FLOOR = { stature: 38, mass: 54, physis: 72, years: 92 };
  const BEAD = TAU / 100;
  const rMass = kg => 44 + .45 * kg, kgOfR = r => (r - 44) / .45;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  /* Each fact's shot: where the camera looks (ty, cm up the body), from how far (d), how high (e, deg; below zero it looks up), from which side (az, deg round the body), its roll (deg), and where on the plate the body stands (cx, cy).
     Stature from the floor, looking up at the crown; mass over the shoulder onto the girdle; years from above, onto the dial; physiology level with the hips; at rest the camera walks slowly round. */
  const SHOT = (i, H, kg, t) => [
    { ty: .5 * H, d: 480, e: -5, az: -18, roll: 0, cx: 490, cy: 470 },
    { ty: .56 * H, d: clamp(190 + 2.4 * rMass(kg), 370, 640), e: 24, az: 30, roll: -3, cx: 445, cy: 425 },
    { ty: .26 * H, d: 570, e: 40, az: -32, roll: 0, cx: 420, cy: 440 },
    { ty: .5 * H, d: 450, e: 12, az: 38, roll: -2, cx: 430, cy: 415 },
    { ty: .5 * H, d: 510, e: 16, az: 12 + 22 * Math.sin(t / 19000 * TAU), roll: 0, cx: 420, cy: 405 }
  ][i];
  const Q = { stature: "How tall do you stand?", mass: "What do you weigh?", years: "How many years?", physis: "Which physiology?", rest: "Your estimated burn at rest." };
  const HINT = { stature: "Lift the ring at your crown.", mass: "Draw the girdle out, or in.", years: "Turn the dial, a bead a year.", physis: "Turn the ring at the hips, or press a name.", rest: "Spin the four. Press one to take it up." };
  /* The canvas palette, as the design has it (the page's own colours, and the sum's warm light). */
  const LIGHT = { "--bg": "#f3f0ea", "--ink": "#24201b", "--ink-faint": "#6b6459", "--push": "#c38a1e", "--pull": "#2f5fa8", "--legs": "#3e7b4c", "--core": "#b5536f", "--push-trace": "#87590a", "--pull-trace": "#1f4787", "--legs-trace": "#295a35", "--core-trace": "#8b3352", "--warm": "#dca545", "--gilt": "#8a5c1e" };
  const DARK = { "--bg": "#14120f", "--ink": "#ede6d9", "--ink-faint": "#9c9283", "--push": "#d4a03c", "--pull": "#5d8fd6", "--legs": "#5fa571", "--core": "#d27993", "--push-trace": "#f0c870", "--pull-trace": "#a9c4ef", "--legs-trace": "#a2d3ab", "--core-trace": "#f1adc1", "--warm": "#eab456", "--gilt": "#d9b26a" };
  const SKY = {
    light: { glow: [241, 220, 184], core: [249, 238, 216], far: [222, 229, 238], gA: .66, cA: .5, fA: .6 },
    dark: { glow: [84, 53, 20], core: [128, 84, 38], far: [20, 26, 46], gA: .9, cA: .42, fA: .85 }
  };
  const fi = cm => feetInches(cm);
  const ftin = inch => { const t = Math.round(inch); return Math.floor(t / 12) + "′ " + (t % 12) + "″"; };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgba = (c, a = 1) => "rgba(" + c.join(",") + "," + clamp(a, 0, 1).toFixed(3) + ")";
  const fmt = n => Math.round(n).toLocaleString("en-GB");
  const signed = n => (n < 0 ? "−" : "+") + fmt(Math.abs(n));
  const wr = a => ((a % TAU) + TAU) % TAU;
  const pIdx = (rot, front = Math.PI / 2) => ((Math.round((front - rot) / (TAU / 3)) % 3) + 3) % 3;

  /* What the page shows apart from the measure itself. */
  const ui = { step: 0, cur: null, typing: null };

  /* ------------------------------ the plate ------------------------------ */
  doc.innerHTML = '<div class="mz-plate" id="mz-plate">' +
    '<div class="mz-pad" id="mz-pad"></div>' +
    '<p id="mz-spoken" aria-live="polite" style="position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0)"></p>' +
    '<div class="mz-ro" id="mz-ro"></div>' +
  '</div>';
  const plate = $("mz-plate"), pad = $("mz-pad"), ro = $("mz-ro"), spokenEl = $("mz-spoken"), foot = $("foot-measure");
  const layer = cls => { const c = document.createElement("canvas"); c.className = "mz-canvas " + cls; c.setAttribute("aria-hidden", "true"); return c; };
  const backC = layer("mz-back"), frontC = layer("mz-front");
  mount.before(backC); mount.after(frontC);
  const sky = document.createElement("div");
  sky.className = "mz-sky"; sky.setAttribute("aria-hidden", "true");
  sky.innerHTML = '<div class="mz-sky-light"></div><div class="mz-grain"></div>';
  stage.insertBefore(sky, stage.firstChild);
  const skyLight = sky.firstChild;
  const fit = { k: 1, ox: 0, oy: 0, sx: 0, sy: 0, fx: 0, fy: 0 };
  /** Fits the 1440 × 900 plate to the screen, centred; and where it lies on the stage's canvases and the figure's. */
  function fitPlate() {
    const vw = sec.clientWidth, vh = sec.clientHeight, k = Math.min(vw / 1440, vh / 900);
    const s = sec.getBoundingClientRect(), r = stage.getBoundingClientRect(), m = mount.getBoundingClientRect();
    Object.assign(fit, { k, ox: (vw - 1440 * k) / 2, oy: (vh - 900 * k) / 2 });
    fit.sx = s.left - r.left + fit.ox; fit.sy = s.top - r.top + fit.oy;
    fit.fx = s.left - m.left + fit.ox; fit.fy = s.top - m.top + fit.oy;
    plate.style.transform = "translate(" + fit.ox + "px," + fit.oy + "px) scale(" + k + ")";
    room.skyCss = "";
  }
  function toPlate(e) { const r = plate.getBoundingClientRect(), k = r.width / 1440 || 1; return [(e.clientX - r.left) / k, (e.clientY - r.top) / k]; }

  /* ------------------------------ the room ------------------------------ */
  /* The design's component, as a plain object: its state is the measure
     itself (M) and the page's ui; setState writes them back. */
  const room = {
    props: { orbit: true, camera: true },
    get state() { return { cm: M.cm, kg: M.kg, age: M.age, sex: M.sex, units: M.units, step: ui.step, cur: ui.cur, typing: ui.typing }; },
    setState(p) {
      let facts = false;
      for (const f of ["cm", "kg", "age"]) if (f in p) { M.set(f, p[f]); facts = true; }
      if ("sex" in p) { M.set("sex", p.sex); facts = true; }
      if ("units" in p) { M.units = p.units; facts = true; }
      for (const f of ["step", "cur", "typing"]) if (f in p) ui[f] = p[f];
      if (facts) save();
      render();
    },
    get reduce() { return Stages.still; },

    /* Starts the room over at step `step`: the rings where that step has them, the camera on its shot. */
    reset(step) {
      const s = this.state;
      this.clock = this.clock || 0; this.swapT = -1e4; this.om = 0;
      this.L = { H: s.cm ?? MARBLE.cm, vH: 0, kg: s.kg ?? MARBLE.kg, vkg: 0, age: s.age ?? MARBLE.age, vage: 0 };
      this.hold = {};
      this.rot = { stature: 0, mass: 2.1, years: 1.1, physis: Math.PI / 2 - STOPS.indexOf(s.sex ?? "unspecified") * TAU / 3, rest: 1.4, vP: 0, vRest: 0 };
      this.ra = {}; this.w = {}; this.lift = {}; this.vl = {}; this.tl = 0; this.td = [1, 0];
      KEYS.forEach(k => { this.ra[k] = step === 4 ? 1 : 0; this.w[k] = KEYS[step] === k ? 1 : 0; this.lift[k] = this.w[k]; this.vl[k] = 0; });
      this.cam = { ...this.shot(step) };
      this.setCam();
      this.roT = null; this.cAng = 0; this.flare = 0; this.roA = 0; this.kick = 0; this.kv = 0; this.turn = 0; this.bph = 0; this.breath = 0;
      this.sv = { stature: 0, mass: 0, years: 0 };
      this.hits = { rings: {}, stops: [], arcs: [] };
      this.burnV = this.burnLive();
      this.drag = null; this.hovK = null;
      this.advC = this.advC || new Map();
    },

    /* ------------------------------ the facts ------------------------------ */
    imp(s = this.state) { return s.units === "imperial"; },
    stored(k, s = this.state) { return k === "stature" ? s.cm : k === "mass" ? s.kg : k === "years" ? s.age : s.sex == null ? null : STOPS.indexOf(s.sex); },
    shot(i) { const L = this.L || { H: MARBLE.cm, kg: MARBLE.kg }; return SHOT(this.props.camera === false ? 4 : i, L.H, L.kg, this.om ? this.clock : 0); },
    side(d, y) { const R = this.V.R; return this.P(R[0] * d, y, R[2] * d); },
    overMarble(cm) {
      const imp = this.imp(), d = imp ? Math.round((cm - MARBLE.cm) / 2.54) : Math.round(cm - MARBLE.cm), u = imp ? " in" : " cm";
      return !d ? "level with the marble" : Math.abs(d) + u + (d > 0 ? " over" : " under") + " the marble";
    },
    put(k, v) {
      const imp = this.imp(), s = this.state;
      if (k === "stature") { const cm = clamp(imp ? Math.round(v / 2.54) * 2.54 : Math.round(v), 120, 230); if (cm !== s.cm) this.setState({ cm }); }
      else if (k === "mass") { const kg = clamp(imp ? Math.round(v / KG) * KG : Math.round(v * 2) / 2, 30, 250); if (kg !== s.kg) this.setState({ kg }); }
      else if (k === "years") { const age = clamp(Math.round(v), 14, 99); if (age !== s.age) this.setState({ age }); }
      else { const sex = STOPS[clamp(Math.round(v), 0, 2)]; if (sex !== s.sex) this.setState({ sex }); }
    },
    stepBy(k, n) {
      const s = this.state, imp = this.imp();
      if (k === "physis") return this.put(k, clamp(STOPS.indexOf(s.sex ?? "unspecified") + n, 0, 2));
      const cur = { stature: s.cm ?? MARBLE.cm, mass: s.kg ?? MARBLE.kg, years: s.age ?? MARBLE.age }[k], st = { stature: imp ? 2.54 : 1, mass: imp ? KG : .5, years: 1 }[k];
      this.put(k, cur + n * st);
    },
    clearFact(k) { this.setState(k === "stature" ? { cm: null } : k === "mass" ? { kg: null } : k === "years" ? { age: null } : { sex: null }); },
    go(i, into = false) {
      i = clamp(i, 0, 4);
      const s = this.state; if (i === s.step) return;
      this.release();
      this.kv = (i > s.step ? 1 : -1) * .12;
      if (!this.reduce && this.sv) { const k = KEYS[i]; if (k in this.sv) this.sv[k] = .006; else if (k === "physis") this.rot.vP = .004; else this.rot.vRest = .008; }
      this.swapT = this.clock || 0; this.roA = 0;
      ro.style.opacity = "0";
      this.setState({ step: i, cur: null, typing: null });
      if (live()) { Stages.refresh(); if (!Stages.busy) Stages.remember(); }
      if (into) { const f = ro.querySelector(".mz-in, [role=radio][tabindex='0'], .mz-term"); if (f) f.focus({ preventScroll: true }); }
    },
    burn(s = this.state) { return restingBurn(s); },
    liveParts() { const L = this.L, R = RESTING_BURN; return { stature: R.perCm * L.H, mass: R.perKg * L.kg, years: R.perYear * L.age, physis: CONST[this.state.sex || "unspecified"] }; },
    burnLive() { const p = this.liveParts(); return p.stature + p.mass + p.years + p.physis; },
    /* At rest the four orbits close into one: the positive terms laid round the body end to end, what takes away hatched back from where they close. */
    sumLayout() {
      const p = this.liveParts(), pos = ["stature", "mass"], neg = ["years"];
      (p.physis >= 0 ? pos : neg).push("physis");
      const Ps = pos.reduce((a, k) => a + p[k], 0), out = {};
      let a = this.rot.rest;
      pos.forEach(k => { const len = TAU * p[k] / Ps; out[k] = { a0: a, len, neg: false, v: p[k] }; a -= len; });
      let e = this.rot.rest - TAU;
      neg.forEach(k => { const len = TAU * -p[k] / Ps; out[k] = { a0: e + len, len, neg: true, v: p[k] }; e += len; });
      out.end = e;
      return out;
    },

    /* -------------------------------- motion -------------------------------- */
    frame(dt) {
      this.clock += dt;
      const s = this.state, RM = !!this.reduce, step = s.step, K = KEYS[step], L = this.L, P = this.props, r = this.rot, D = this.drag;
      const tw = (v, to, ms) => RM ? to : v + (to - v) * (1 - Math.exp(-dt / ms));
      const sub = f => { for (let q = dt; q > 0; q -= 8) f(Math.min(8, q)); };
      const spr = (k, tg, c) => { if (RM) { L[k] = tg; L["v" + k] = 0; return; } sub(ds => { L["v" + k] += (.00026 * (tg - L[k]) - c * L["v" + k]) * ds; L[k] += L["v" + k] * ds; }); };
      const hd = this.hold;
      if (hd.stature != null) { L.H = hd.stature; L.vH = 0; } else spr("H", s.cm ?? MARBLE.cm, .019);
      if (hd.mass != null) { L.kg = hd.mass; L.vkg = 0; } else spr("kg", s.kg ?? MARBLE.kg, .021);
      if (hd.years != null) { L.age = hd.years; L.vage = 0; } else spr("age", s.age ?? MARBLE.age, .026);
      this.burnV = tw(this.burnV, this.burnLive(), 300);
      // Everything orbits at the pace of what the body burns at rest.
      const om = this.om = P.orbit === false || RM ? 0 : TAU / (26000 * 1500 / Math.max(800, this.burnV));
      // A ring taken in hand arrives spinning, and settles to the common pace.
      const sv = this.sv, dec = Math.exp(-dt / 650);
      r.stature += (om + sv.stature) * dt; r.mass -= (om * .8 + sv.mass) * dt; r.years += (om * .55 + sv.years) * dt;
      for (const k in sv) sv[k] *= dec;
      if (!(D && D.moved && step === 4)) { r.vRest *= Math.exp(-dt / 700); r.rest += (om * 1.1 + r.vRest) * dt; }
      if (!(D && D.moved && step === 3)) {
        let tg = (this.V ? this.V.front : Math.PI / 2) - STOPS.indexOf(s.sex ?? "unspecified") * TAU / 3;
        tg += TAU * Math.round((r.physis - tg) / TAU) + (om ? .05 * Math.sin(this.clock / 3400) : 0);
        if (RM) { r.physis = tg; r.vP = 0; } else sub(ds => { r.vP += (.00018 * (tg - r.physis) - .02 * r.vP) * ds; r.physis += r.vP * ds; });
      }
      KEYS.forEach((k, i) => { this.w[k] = tw(this.w[k], K === k ? 1 : 0, 320); this.ra[k] = tw(this.ra[k], step === 4 ? 1 : 0, 420 + i * 170); });
      // A ring taken up rises off the plinth to where it is measured, rocking as it goes; one put down drops back; one under the hand lifts a little.
      KEYS.forEach(k => { const tg = K === k ? 1 : this.hovK === k ? .07 : 0; if (RM) { this.lift[k] = tg; this.vl[k] = 0; } else sub(ds => { this.vl[k] += (.00011 * (tg - this.lift[k]) - .0155 * this.vl[k]) * ds; this.lift[k] += this.vl[k] * ds; }); });
      const sh = this.shot(step);
      for (const n in sh) this.cam[n] = tw(this.cam[n], sh[n], 640);
      this.setCam();
      // The breath, paced by the burn.
      if (om) this.bph += dt / clamp(8.8e6 / Math.max(800, this.burnV), 3600, 7200);
      this.breath = om ? Math.sin(this.bph * TAU) : 0;
      // The sweep: one light going round the chosen ring at the pace of the burn; passing the reading, it lights it.
      if (om) {
        const lap = clamp(6.2e6 / Math.max(800, this.burnV), 2600, 6000), th = this.V ? this.V.front - Math.PI / 2 : 0, p0 = wr(this.cAng - th);
        this.cAng -= dt * TAU / lap;
        if (wr(this.cAng - th) > p0 + Math.PI) this.flare = 1;
      }
      this.flare *= Math.exp(-dt / 520);
      // The figure turns half way to the camera as it goes round, and kicks a little at a change of step.
      if (RM) { this.kick = 0; this.kv = 0; } else sub(ds => { this.kv += (-.00016 * this.kick - .011 * this.kv) * ds; this.kick += this.kv * ds; });
      this.turn = tw(this.turn, clamp(-this.cam.az * .5, -26, 26), 450);
      this.tw = tw;
    },
    /** Films the live figure through the room's camera, as tall as the height given. */
    film() {
      if (typeof figure !== "object" || !figure.moves) return;
      const c = this.cam, sH = this.L.H / SCULPTURE_SHOT_HEIGHT, k = fit.k;
      figure.filmAt({ az: c.az + this.turn + this.kick, el: c.e, ty: c.ty / sH, d: c.d / sH, x: fit.fx + k * c.cx, y: fit.fy + k * c.cy, focal: k * FOC, roll: c.roll });
    },
    setCam() {
      const c = this.cam, e = c.e * Math.PI / 180, az = c.az * Math.PI / 180, ce = Math.cos(e);
      const Cp = [c.d * ce * Math.sin(az), c.ty + c.d * Math.sin(e), c.d * ce * Math.cos(az)];
      let F = [-Cp[0], c.ty - Cp[1], -Cp[2]]; const fl = Math.hypot(F[0], F[1], F[2]); F = F.map(v => v / fl);
      let Rv = [-F[2], 0, F[0]]; const rl = Math.hypot(Rv[0], Rv[2]); Rv = Rv.map(v => v / rl);
      const U = [Rv[1] * F[2] - Rv[2] * F[1], Rv[2] * F[0] - Rv[0] * F[2], Rv[0] * F[1] - Rv[1] * F[0]], rr = c.roll * Math.PI / 180;
      this.V = { C: Cp, F, R: Rv, U, cx: c.cx, cy: c.cy, rc: Math.cos(rr), rs: Math.sin(rr), front: Math.atan2(Cp[2], Cp[0]) };
    },
    P(x, y, z) {
      if (this.tl) y += this.tl * (x * this.td[0] + z * this.td[1]);
      const V = this.V, vx = x - V.C[0], vy = y - V.C[1], vz = z - V.C[2];
      const zc = vx * V.F[0] + vy * V.F[1] + vz * V.F[2], k = FOC / Math.max(1, zc);
      const X = (vx * V.R[0] + vy * V.R[1] + vz * V.R[2]) * k, Y = -(vx * V.U[0] + vy * V.U[1] + vz * V.U[2]) * k;
      return { x: V.cx + X * V.rc - Y * V.rs, y: V.cy + X * V.rs + Y * V.rc, z: zc };
    },
    /* The reading stands in its own column at the right, square to the page, drawn only a little toward the height of the ring it reads; the thread carries the connection. */
    placeReadout() {
      const A = this.anchor, tw = this.tw; if (!A || !tw) return;
      const W = ro.offsetWidth || 380, Hh = ro.offsetHeight || 260, vr = ro.querySelector(".mz-val");
      const vy = vr ? vr.offsetTop + vr.offsetHeight : 140;
      const gx = 1440 - 36 - W, gy = clamp(lerp(430, A.y, .3), 100 + vy, 808 - (Hh - vy));
      if (!this.roT) this.roT = { x: gx, y: gy };
      this.roT.x = tw(this.roT.x, gx, 300); this.roT.y = tw(this.roT.y, gy, 300);
      const T = this.roT;
      ro.style.transform = "translate(" + T.x.toFixed(2) + "px," + (T.y - vy).toFixed(2) + "px)";
      this.roA = tw(this.roA, this.clock - this.swapT > 420 ? 1 : 0, 260);
      ro.style.opacity = this.roA.toFixed(3);
      ro.style.setProperty("--flare", this.flare.toFixed(3));
      this.roLead = { x: T.x - 18, y: T.y };
    },

    /* ------------------------------- the hand ------------------------------- */
    pick(px, py) {
      const s = this.state, H = this.hits, near = (pts, t) => !!pts && pts.some(p => Math.abs(p.x - px) < t && Math.abs(p.y - py) < t);
      if (s.step === 3) for (const o of H.stops) if (Math.hypot(px - o.x, py - o.y) < 42) return { kind: "stop", i: o.i };
      if (s.step === 4) { for (const a of H.arcs) if (near(a.pts, 14)) return { kind: "arc", k: a.k }; return { kind: "spin" }; }
      for (const k of KEYS) if (k !== KEYS[s.step] && near(H.rings[k], 12)) return { kind: "ring", k };
      return { kind: "drag" };
    },
    down(e) {
      const [px, py] = toPlate(e), w = this.pick(px, py), L = this.L, K = KEYS[this.state.step];
      const D = { w, x0: px, y0: py, lt: performance.now(), vel: 0, moved: false };
      if (K === "stature") { D.v0 = L.H; D.ppc = Math.max(.5, this.P(0, L.H, 0).y - this.P(0, L.H + 1, 0).y); }
      else if (K === "mass") { const g = this.geo("mass"), a = this.side(g.r, g.y), b = this.side(g.r + 1, g.y); D.v0 = rMass(L.kg); D.ppc = Math.max(.5, Math.hypot(b.x - a.x, b.y - a.y)); }
      else if (K === "years") D.v0 = L.age;
      else { const ph = K === "physis", y = ph ? .52 * L.H : .6 * L.H, a = this.side(ph ? RAD.physis : RAD.sum, y), o = this.P(0, y, 0); D.v0 = ph ? this.rot.physis : this.rot.rest; D.rpx = Math.max(20, Math.hypot(a.x - o.x, a.y - o.y)); }
      this.drag = D;
    },
    move(e) {
      const [px, py] = toPlate(e), D = this.drag;
      if (D) {
        if (!D.moved && Math.hypot(px - D.x0, py - D.y0) > 5) { D.moved = true; this.setState({ cur: "held" }); }
        if (!D.moved) return;
        const K = KEYS[this.state.step], now = performance.now(), dx = px - D.x0;
        if (K === "stature") { const H = clamp(D.v0 + (D.y0 - py) / D.ppc, 120, 230); this.hold.stature = H; this.put("stature", H); }
        else if (K === "mass") { const kg = clamp(kgOfR(D.v0 + dx / D.ppc), 30, 250); this.hold.mass = kg; this.put("mass", kg); }
        else if (K === "years") { const a = clamp(D.v0 + dx / 11, 14, 99); this.hold.years = a; this.put("years", a); }
        else if (K === "physis") { this.rot.physis = D.v0 - dx / D.rpx; this.rot.vP = 0; this.put("physis", pIdx(this.rot.physis, this.V.front)); }
        else { const nv = D.v0 - dx / D.rpx, dt = Math.max(1, now - D.lt); D.vel = .7 * D.vel + .3 * (nv - this.rot.rest) / dt; this.rot.rest = nv; D.lt = now; }
        return;
      }
      const w = this.pick(px, py); this.hovK = w.kind === "ring" || w.kind === "arc" ? w.k : null;
      const cur = w.kind === "drag" ? "drag-" + this.state.step : w.kind;
      if (cur !== this.state.cur) this.setState({ cur });
    },
    leave() { if (!this.drag) { this.hovK = null; if (this.state.cur) this.setState({ cur: null }); } },
    release() {
      const D = this.drag; if (!D) return;
      this.drag = null; this.hold = {};
      if (!D.moved) {
        if (D.w.kind === "ring" || D.w.kind === "arc") this.go(KEYS.indexOf(D.w.k));
        else if (D.w.kind === "stop") this.put("physis", D.w.i);
      } else if (this.state.step === 4 && !this.reduce) this.rot.vRest = clamp(D.vel, -.012, .012);
      if (this.state.cur) this.setState({ cur: null });
    },

    /* ------------------------------- typing ------------------------------- */
    typed(f, text, commit) {
      const s = this.state, imp = this.imp(), blank = !String(text).trim(), n = parseFloat(String(text).replace(",", "."));
      const ok = (v, lo, hi) => commit || (v >= lo && v <= hi);
      if (f === "cm") { if (blank) { if (commit) this.setState({ cm: null }); return; } if (isFinite(n) && ok(n, 120, 230)) this.setState({ cm: clamp(n, 120, 230) }); }
      else if (f === "ft" || f === "in") {
        const [ft0, in0] = s.cm != null ? fi(s.cm) : [5, 2], ft = f === "ft" ? n : ft0, inch = f === "in" ? (blank ? 0 : n) : in0;
        if (!isFinite(ft)) return; const cm = (ft * 12 + inch) * 2.54; if (ok(cm, 120, 230)) this.setState({ cm: clamp(cm, 120, 230) });
      } else if (f === "kg") { if (blank) { if (commit) this.setState({ kg: null }); return; } const kg = imp ? n * KG : Math.round(n * 10) / 10; if (isFinite(kg) && ok(kg, 30, 250)) this.setState({ kg: clamp(kg, 30, 250) }); }
      else if (f === "age") { if (blank) { if (commit) this.setState({ age: null }); return; } if (isFinite(n) && ok(n, 14, 99)) this.setState({ age: clamp(Math.round(n), 14, 99) }); }
    },

    /* ------------------------------- the light ------------------------------- */
    palette() {
      const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      if (this.themeFor === theme) return;
      this.themeFor = theme;
      const dark = theme === "dark", V = dark ? DARK : LIGHT;
      this.C = { ink: V["--ink"], faint: V["--ink-faint"], bg: V["--bg"], dark };
      this.pal = { ink: hex(V["--ink"]), faint: hex(V["--ink-faint"]), bg: hex(V["--bg"]), warm: hex(V["--warm"]), gilt: hex(V["--gilt"]) };
      KEYS.forEach(k => { this.pal[k] = hex(V["--" + PIG[k]]); this.pal[k + "T"] = hex(V["--" + PIG[k] + "-trace"]); });
      this.skyCss = "";
    },
    paintSky() {
      const C = this.C; if (!C) return;
      const S = SKY[C.dark ? "dark" : "light"], br = this.breath || 0, k = fit.k, ox = fit.sx, oy = fit.sy;
      const ctr = this.P(0, .6 * this.L.H, 0), ra = smooth(clamp(this.ra.physis, 0, 1));
      const r = (200 + this.burnV * .17) * (540 / this.cam.d) * (1 + .03 * br) * (1 + .1 * ra);
      const px = v => Math.round(v) + "px";
      const rad = (c, al, x, y, rx, ry) => "radial-gradient(" + px(rx * k) + " " + px(ry * k) + " at " + px(ox + x * k) + " " + px(oy + y * k) + ", " + rgba(c, al) + " 0%, " + rgba(c, al * .5) + " 38%, " + rgba(c, 0) + " 100%)";
      const css = rad(S.core, S.cA * (1 + .1 * br) + .1 * ra, ctr.x, ctr.y - 30, r * .42, r * .52) + ", " + rad(S.glow, S.gA * (1 + .05 * br) + .08 * ra, ctr.x, ctr.y, r, r * 1.08) + ", " + rad(S.far, S.fA, 1260, 140, 760, 560) + ", " + C.bg;
      if (css !== this.skyCss) { this.skyCss = css; skyLight.style.background = css; }
    },
    /** A canvas the size of the stage, drawing in plate units. */
    canvas(c) {
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const x = c.getContext("2d");
      this.sf = dpr * fit.k; this.o = [dpr * fit.sx, dpr * fit.sy];
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
      x.setTransform(this.sf, 0, 0, this.sf, this.o[0], this.o[1]); x.globalAlpha = 1; x.setLineDash([]); x.lineCap = "round"; x.filter = "none";
      return x;
    },
    /* A ring round the body, sampled; each point knows whether it passes in front of the figure or behind it. */
    ring(y, r, a0, len, n) {
      const az = this.P(0, y, 0).z, out = [];
      for (let i = 0; i <= n; i++) { const t = a0 - len * i / n, p = this.P(r * Math.cos(t), y, r * Math.sin(t)); p.fr = p.z < az; out.push(p); }
      return out;
    },
    stroke(pts, col, w, a, ba = .32, dash = null) {
      [[this.cb, false, a * ba], [this.cf, true, a]].forEach(([c, want, al]) => {
        if (al <= .004) return;
        c.beginPath(); let pen = false, any = false;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i], ok = p.fr === want || (i > 0 && pts[i - 1].fr === want) || (i < pts.length - 1 && pts[i + 1].fr === want);
          if (ok) { if (pen) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); pen = true; any = true; } else pen = false;
        }
        if (!any) return;
        c.globalAlpha = al; c.strokeStyle = col; c.lineWidth = w; c.setLineDash(dash || []); c.stroke(); c.setLineDash([]);
      });
    },
    adv(font, chs) {
      const key = font + "|" + chs.join(""); let a = this.advC.get(key);
      if (!a) { if (this.advC.size > 400) this.advC.clear(); const c = this.cf; c.save(); c.font = font; if ("letterSpacing" in c) c.letterSpacing = "0px"; a = chs.map(ch => c.measureText(ch).width); c.restore(); this.advC.set(key, a); }
      return a;
    },
    /* Words carried on a ring, each glyph stood on the ring in perspective: upright round the body, or laid flat on the floor. Behind the figure they read backwards, as they would. */
    text(str, y, r, th, cm, col, a, o) {
      if (a < .01 || r < 1) return;
      o = o || {};
      const font = o.mono ? "500 20px " + MONO : "italic 400 20px " + SERIF, chs = [...str], ad = this.adv(font, chs), u = cm / 20;
      const W = ad.reduce((t, v) => t + v, 0) * u;
      let reps = 1, gap = 0;
      if (o.repeat) { const circ = TAU * r; reps = Math.max(1, Math.floor(circ / W)); gap = (circ - reps * W) / reps; }
      const az = this.P(0, y, 0).z, sf = this.sf, [o0, o1] = this.o, mid = o.floor || o.mid, ly = o.lift != null ? o.lift : mid ? 0 : -6;
      for (const c of [this.cb, this.cf]) { c.font = font; c.textAlign = "center"; c.textBaseline = mid ? "middle" : "alphabetic"; c.fillStyle = col; if ("letterSpacing" in c) c.letterSpacing = "0px"; }
      let s = o.center ? -W / 2 : 0;
      for (let q = 0; q < reps; q++) {
        for (let i = 0; i < chs.length; i++) {
          const wch = ad[i] * u, t = th - (s + wch / 2) / r; s += wch;
          if (chs[i] === " ") continue;
          const ct = Math.cos(t), st = Math.sin(t), X = r * ct, Z = r * st, p0 = this.P(X, y, Z);
          if (p0.z < 20) continue;
          const pT = this.P(X + st * u, y, Z - ct * u), pU = o.floor ? this.P(X - ct * u, y, Z - st * u) : this.P(X, y + u, Z);
          const fr = p0.z < az, c = fr ? this.cf : this.cb, al = a * (fr ? 1 : .3);
          if (al < .01) continue;
          c.globalAlpha = al;
          c.setTransform(sf * (pT.x - p0.x), sf * (pT.y - p0.y), -sf * (pU.x - p0.x), -sf * (pU.y - p0.y), o0 + sf * p0.x, o1 + sf * p0.y);
          c.fillText(chs[i], 0, ly);
        }
        s += gap;
      }
      for (const c of [this.cb, this.cf]) c.setTransform(sf, 0, 0, sf, o0, o1);
    },
    disc(p, rpx, fill, stroke, a, lw = 1) {
      const c = p.fr ? this.cf : this.cb, al = a * (p.fr ? 1 : .32); if (al < .01) return;
      c.globalAlpha = al; c.beginPath(); c.arc(p.x, p.y, Math.max(.6, rpx), 0, TAU);
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
    },
    label(c, t, x, y, col, a, align = "center", size = 9.5) {
      if (a < .01) return;
      c.globalAlpha = a; c.font = "500 " + size + "px " + MONO; if ("letterSpacing" in c) c.letterSpacing = "1.4px";
      c.textAlign = align; c.textBaseline = "middle"; c.fillStyle = col; c.fillText(t, x, y);
    },
    /* Where a ring is: taken up, at the crown, round the waist, at the hips, or (years) the dial just off the plinth; put down, flat on the plinth; at rest, all four at the chest. */
    geo(k) {
      const L = this.L, ra = smooth(clamp(this.ra[k], 0, 1)), u = this.lift[k] || 0;
      const o = k === "stature" ? [L.H + 1, RAD.stature] : k === "years" ? [5, FLOOR.years] : k === "mass" ? [.57 * L.H, rMass(L.kg)] : [.52 * L.H, RAD.physis];
      return { y: lerp(lerp(.6, o[0], u), .6 * L.H, ra), r: lerp(lerp(FLOOR[k], o[1], u), RAD.sum, ra), ra, u: clamp(u, 0, 1) };
    },
    tilt(k) { this.tl = this.reduce ? 0 : clamp((this.vl[k] || 0) * 42, -.26, .26); },
    arcOf(k, ra) {
      const own = this.rot[k];
      if (ra < .001) return { a0: own, len: TAU };
      const t = this.sum[k], a = t.a0 + TAU * Math.round((own - t.a0) / TAU);
      return { a0: lerp(own, a, ra), len: lerp(TAU, t.len, ra) };
    },
    ringLine(k, g) {
      const w = this.w[k], ra = g.ra, own = this.stored(k) != null, hv = this.hovK === k ? 1 : 0, neg = ra > .01 && this.sum[k].neg;
      const { a0, len } = this.arcOf(k, ra), pts = this.ring(g.y, g.r, a0, len, Math.max(24, Math.round(140 * len / TAU)));
      const e = Math.max(w, neg ? .2 * ra : ra), col = rgba(mix(this.pal.faint, this.pal[k], Math.max(.3, w, ra)));
      if (ra > .01 && !neg) this.stroke(pts, rgba(this.pal[k]), 11, .16 * ra, .4);
      this.stroke(pts, col, 1 + .9 * w + (neg ? 0 : 3 * ra) + .7 * hv, clamp(.3 + .7 * e + .35 * hv, 0, 1), .32, own ? null : [4, 5]);
      if (ra < .6) this.comet(g.y, g.r, rgba(mix(this.pal.faint, this.pal[k], .35 + .65 * w)), 1.6 + 2.6 * w, w * (1 - ra / .6), .9 + .7 * w);
      const hp = pts.filter((_, i) => i % 3 === 0);
      this.hits.rings[k] = hp;
      if (ra > .5) this.hits.arcs.push({ k, pts: hp });
    },
    /* The sweep's head on a ring: a light running round it with a tail that thins and fades, passing behind the body and out again. */
    comet(y, r, col, w, a, tail = 1.2) {
      if (a < .01 || !this.om) return;
      const head = this.cAng, n = 30, az = this.P(0, y, 0).z, fn = typeof col === "function";
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const t = head + tail * i / n, p = this.P(r * Math.cos(t), y, r * Math.sin(t)); p.fr = p.z < az;
        if (prev) { const f = 1 - i / n, c = p.fr ? this.cf : this.cb; c.globalAlpha = a * f * f * (p.fr ? 1 : .35); c.strokeStyle = fn ? col(t) : col; c.lineWidth = w * (.3 + .7 * f); c.beginPath(); c.moveTo(prev.x, prev.y); c.lineTo(p.x, p.y); c.stroke(); }
        prev = p;
      }
      const h = this.P(r * Math.cos(head), y, r * Math.sin(head)); h.fr = h.z < az;
      const c = h.fr ? this.cf : this.cb, hc = fn ? col(head) : col;
      c.save(); c.shadowColor = hc; c.shadowBlur = 14; this.disc(h, w * .8, hc, null, a); c.restore();
    },
    ringWords(k, g, str) {
      const w = this.w[k], fade = 1 - g.ra, up = w * g.u, dn = (1 - g.u) * fade; if (fade < .01) return;
      if (up > .01) this.text(str, g.y, g.r, this.rot[k], 9, rgba(mix(this.pal.faint, this.pal[k + "T"], w)), up * fade, { repeat: true });
      if (dn > .01) this.text(str.replace(/ · $/, ""), g.y, g.r + 5, this.rot[k], 5, rgba(mix(this.pal.faint, this.pal[k + "T"], .35)), .8 * dn, { floor: true, mid: true });
    },
    draw() {
      this.palette();
      const b = this.canvas(backC), f = this.canvas(frontC);
      this.cb = b; this.cf = f;
      this.hits = { rings: {}, stops: [], arcs: [] };
      this.sum = this.sumLayout();
      this.td = [this.V.R[0], this.V.R[2]];
      this.drawFloor();
      [["years", "drawYears"], ["physis", "drawPhysis"], ["mass", "drawMass"], ["stature", "drawStature"]].forEach(([k, fn]) => { this.tilt(k); this[fn](); this.tl = 0; });
      this.drawSum();
      this.drawLeader();
    },
    /* The floor: a plinth of two steps, in the same stone as the room and told by its shade alone: sides in shadow, tops barely toned, the near arris catching the light. The figure's shadow lies across it and turns slowly, as on a sundial. */
    drawFloor() {
      const L = this.L, C = this.C, c = this.cb, dk = C.dark, ink = this.pal.ink, shd = dk ? [0, 0, 0] : ink, lt = dk ? [255, 236, 206] : [255, 253, 249], N = 120;
      const ring = (R, y) => { const a = []; for (let i = 0; i <= N; i++) { const t = i * TAU / N; a.push(this.P(R * Math.cos(t), y, R * Math.sin(t))); } return a; };
      const path = (...rs) => { const p = new Path2D(); rs.forEach(r => { r.forEach((q, i) => i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)); p.closePath(); }); return p; };
      let face = null;
      [[126, -7, -14], [112, 0, -7]].forEach(([R, y0, y1], up) => {
        const top = ring(R, y0), bot = ring(R, y1), cz = this.P(0, y0, 0).z, fc = path(top), side = new Path2D();
        for (let i = 0; i < N; i++) { const a = top[i], b = top[i + 1], d = bot[i + 1], e = bot[i]; side.moveTo(a.x, a.y); side.lineTo(b.x, b.y); side.lineTo(d.x, d.y); side.lineTo(e.x, e.y); side.closePath(); }
        const out = new Path2D(); out.rect(-4000, -4000, 9440, 8900); out.addPath(fc);
        c.save(); c.clip(out, "evenodd"); c.globalAlpha = 1; c.fillStyle = dk ? rgba([0, 0, 0], up ? .36 : .5) : rgba(ink, up ? .06 : .085); c.fill(side); c.restore();
        c.globalAlpha = 1; c.fillStyle = dk ? rgba(lt, .025) : rgba(ink, .02); c.fill(up ? fc : path(top, ring(112, y0)), "evenodd");
        const near = new Path2D(), far = new Path2D();
        for (let i = 0; i < N; i++) { const a = top[i], b = top[i + 1], p = (a.z + b.z) / 2 < cz ? near : far; p.moveTo(a.x, a.y); p.lineTo(b.x, b.y); }
        c.lineWidth = 1; c.strokeStyle = dk ? rgba(lt, .1) : rgba(ink, .13); c.stroke(far);
        c.lineWidth = 1.3; c.strokeStyle = rgba(lt, dk ? .3 : .95); c.stroke(near);
        if (up) face = fc;
      });
      c.lineWidth = 1; c.strokeStyle = rgba(dk ? lt : ink, .07); c.stroke(path(ring(104, 0)));
      const sa = 3.95 + .32 * Math.sin(this.clock / 34000 * TAU), dx = Math.cos(sa), dz = Math.sin(sa), len = .5 * L.H;
      const S = (a, b) => this.P(dx * a - dz * b, .3, dz * a + dx * b), sh = new Path2D();
      [[-5, -12], [len * .35, -16], [len * .8, -11], [len + 4, -3], [len + 4, 3], [len * .8, 11], [len * .35, 16], [-5, 12]].map(([a, b]) => S(a, b)).forEach((p, i) => i ? sh.lineTo(p.x, p.y) : sh.moveTo(p.x, p.y)); sh.closePath();
      const f0 = this.P(0, 0, 0), f1 = S(len, 0), gr = c.createLinearGradient(f0.x, f0.y, f1.x, f1.y);
      gr.addColorStop(0, rgba(shd, dk ? .55 : .2)); gr.addColorStop(.7, rgba(shd, dk ? .2 : .06)); gr.addColorStop(1, rgba(shd, 0));
      c.save(); c.clip(face); if ("filter" in c) c.filter = "blur(4px)"; c.fillStyle = gr; c.fill(sh); c.restore();
      const mf = clamp((L.kg - 30) / 120, 0, 1), rr = 28, ex = this.P(this.V.R[0] * rr, 0, this.V.R[2] * rr), ez = this.P(this.V.R[2] * rr, 0, -this.V.R[0] * rr);
      const rx = Math.max(4, Math.hypot(ex.x - f0.x, ex.y - f0.y)), ry = Math.max(2, Math.hypot(ez.x - f0.x, ez.y - f0.y)), a = (dk ? .55 : .2) + .1 * mf;
      c.save(); c.translate(f0.x, f0.y); c.rotate(Math.atan2(ex.y - f0.y, ex.x - f0.x)); c.scale(1, ry / rx);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, rgba(shd, a)); g.addColorStop(.55, rgba(shd, a * .35)); g.addColorStop(1, rgba(shd, 0));
      c.globalAlpha = 1; c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
    },
    /* Stature: a ring at the crown, read off a measuring rod that stands on the lower step, away from the body; an arm runs from the ring to the rod, the rod filled to where you stand. */
    drawStature() {
      const k = "stature", g = this.geo(k), L = this.L, s = this.state, imp = this.imp(), show = this.w[k] * g.u * (1 - g.ra), C = this.C;
      this.ringLine(k, g);
      this.ringWords(k, g, (imp ? ftin(L.H / 2.54) : Math.round(L.H) + " cm") + (s.cm != null ? " · stature · " : " · the marble’s · "));
      this.tl = 0;
      if (show < .01) return;
      const R = this.V.R, d0 = 119, at = (d, y) => this.P(-R[0] * d, y, -R[2] * d), c = this.cf, faint = C.faint, pig = rgba(this.pal[k]), trace = rgba(this.pal[k + "T"]);
      const ln = (a, b, col, lw, al) => { if (al < .01) return; c.globalAlpha = al; c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); };
      const fall = y => Math.exp(-Math.pow((y - L.H) / 45, 2)), mk = Math.abs(L.H - MARBLE.cm) > 3;
      ln(at(d0 - 8, -7), at(d0 + 8, -7), faint, 1.2, .8 * show);
      const topY = Math.min(236, Math.max(L.H, MARBLE.cm) + 26), tp = at(d0, topY), ft = at(d0, -7), rg = c.createLinearGradient(ft.x, ft.y, tp.x, tp.y);
      rg.addColorStop(0, rgba(this.pal.faint, .6 * show)); rg.addColorStop(.82, rgba(this.pal.faint, .6 * show)); rg.addColorStop(1, rgba(this.pal.faint, 0));
      c.globalAlpha = 1; c.strokeStyle = rg; c.lineWidth = 1; c.beginPath(); c.moveTo(ft.x, ft.y); c.lineTo(tp.x, tp.y); c.stroke();
      ln(at(d0, 0), at(d0, L.H), pig, 2.2, .5 * show);
      const marks = [];
      if (imp) for (let i = 0; i <= 92; i++) marks.push([i * 2.54, i % 6 === 0, i % 12 === 0 || (i % 6 === 0 && Math.abs(i * 2.54 - L.H) < 30), ftin(i)]);
      else for (let cm = 0; cm <= 234; cm += 2) marks.push([cm, cm % 10 === 0, cm % 20 === 0 || (cm % 10 === 0 && Math.abs(cm - L.H) < 30), String(cm)]);
      for (const [y, maj, lab, t] of marks) {
        if (y > topY - 4) continue;
        const a = show * (.25 + .75 * fall(y)) * clamp((topY - 4 - y) / 14, 0, 1), p = at(d0, y);
        if (p.y < 96) continue;
        ln(p, at(d0 + (maj ? 7 : 3.5), y), faint, 1, a * (maj ? .85 : .5));
        if (lab && Math.abs(y - L.H) > 4 && !(mk && Math.abs(y - MARBLE.cm) < 4)) { const q = at(d0 + 9, y); this.label(c, t, q.x - 4, q.y, faint, a, "right", 10); }
      }
      if (mk) { const p = at(d0, MARBLE.cm), q = at(d0 - 9, MARBLE.cm); ln(p, at(d0 - 6, MARBLE.cm), faint, 1, show); this.label(c, "MARBLE", q.x + 4, q.y, faint, .9 * show, "left", 9); }
      const v = at(d0, L.H), q = at(d0 + 9, L.H);
      ln(v, at(g.r, L.H), pig, 1.4, .85 * show);
      c.save(); c.shadowColor = pig; c.shadowBlur = 8; this.disc({ x: v.x, y: v.y, fr: true }, 4.5, pig, C.bg, show, 2); c.restore();
      this.label(c, imp ? ftin(L.H / 2.54) : Math.round(L.H) + " CM", q.x - 4, q.y, trace, show, "right", 11);
    },
    /* Mass: a girdle at the waist, as wide as the kilos, its far edge read off a straight rule that runs out level from the body, filled to where you stand. */
    drawMass() {
      const k = "mass", g = this.geo(k), L = this.L, s = this.state, imp = this.imp(), show = this.w[k] * g.u * (1 - g.ra), C = this.C, own = s.kg != null;
      this.ringLine(k, g);
      this.ringWords(k, g, (imp ? Math.round(L.kg / KG) + " lb" : (Math.round(L.kg * 2) / 2) + " kg") + (own ? " · mass · " : " · the marble’s · "));
      this.tl = 0;
      if (show < .01) return;
      const y = g.y, R = this.V.R, at = (d, h = 0) => this.P(-R[0] * d, y + h, -R[2] * d), c = this.cf, faint = C.faint, fa = this.pal.faint, pig = rgba(this.pal[k]), trace = rgba(this.pal[k + "T"]);
      const rv = rMass(L.kg), r0 = rMass(30), r1 = rMass(250), fall = r => Math.exp(-Math.pow((r - rv) / 38, 2)), mk = Math.abs(L.kg - MARBLE.kg) > 4;
      const a0 = at(r0), a1 = at(r1), av = at(rv), gr = c.createLinearGradient(a0.x, a0.y, a1.x, a1.y);
      for (let i = 0; i <= 16; i++) gr.addColorStop(i / 16, rgba(fa, show * (.15 + .6 * fall(lerp(r0, r1, i / 16)))));
      c.globalAlpha = 1; c.strokeStyle = gr; c.lineWidth = 1; c.beginPath(); c.moveTo(a0.x, a0.y); c.lineTo(a1.x, a1.y); c.stroke();
      c.globalAlpha = .55 * show * (own ? 1 : .6); c.strokeStyle = pig; c.lineWidth = 2.2; c.beginPath(); c.moveTo(a0.x, a0.y); c.lineTo(av.x, av.y); c.stroke();
      const st = imp ? 10 : 5, lo = imp ? 70 : 30, hi = imp ? 550 : 250, big = imp ? 50 : 20, mid = imp ? 50 : 10;
      for (let u = Math.ceil(lo / st) * st; u <= hi; u += st) {
        const kv = imp ? u * KG : u, r = rMass(kv), maj = u % big === 0, a = show * (.15 + .85 * fall(r)); if (a < .03) continue;
        const p = at(r), q = at(r, maj ? -5 : u % mid === 0 ? -3.5 : -2);
        c.globalAlpha = a * (maj ? .85 : .5); c.strokeStyle = faint; c.lineWidth = 1; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke();
        if (maj && q.x > 48 && Math.abs(kv - L.kg) > 7 && !(mk && Math.abs(kv - MARBLE.kg) < 12)) this.label(c, String(u), q.x, q.y + 11, faint, a * clamp((q.x - 48) / 40, 0, 1), "center", 10);
      }
      if (mk) { const p = at(rMass(MARBLE.kg)), q = at(rMass(MARBLE.kg), -5); this.disc({ x: p.x, y: p.y, fr: true }, 3, C.bg, faint, .9 * show, 1); this.label(c, "MARBLE", q.x, q.y + 11, faint, .9 * show, "center", 9); }
      c.save(); c.shadowColor = pig; c.shadowBlur = 8; this.disc({ x: av.x, y: av.y, fr: true }, 4.5, pig, C.bg, show, 2); c.restore();
      this.label(c, imp ? Math.round(L.kg / KG) + " LB" : (Math.round(L.kg * 2) / 2) + " KG", av.x - 10, av.y - 14, trace, show, "right", 11);
    },
    /* Years: the dial cut round the plinth's edge, a mark a year to a hundred, numbered by the decade; a bead for each year lived, every tenth larger; the sweep swells each bead it passes. */
    drawYears() {
      const k = "years", g = this.geo(k), L = this.L, s = this.state, w = this.w[k], fade = 1 - g.ra, own = s.age != null, C = this.C;
      this.ringLine(k, g);
      if (fade < .01) return;
      const n = clamp(L.age, 0, 99), whole = Math.floor(n), fr = n - whole, pig = rgba(this.pal[k]), trace = rgba(this.pal[k + "T"]), ba = fade * (.4 + .6 * w), az = this.P(0, g.y, 0).z, ticks = [new Path2D(), new Path2D()];
      for (let j = 0; j < 100; j++) {
        const t = this.rot[k] - (j + .5) * BEAD, ct = Math.cos(t), st = Math.sin(t), r0 = g.r + 2.5, l = (j + 1) % 10 ? 2.2 : 5, p = this.P(r0 * ct, g.y, r0 * st), q = this.P((r0 + l) * ct, g.y, (r0 + l) * st), f = p.z < az ? 1 : 0;
        ticks[f].moveTo(p.x, p.y); ticks[f].lineTo(q.x, q.y);
        if ((j + 1) % 10 === 0) this.text(String(j + 1), g.y, g.r + 12, t, 3.2 + 1.4 * w, j < n ? trace : C.faint, fade * (.45 + .5 * w), { floor: true, mono: true, center: true });
      }
      [[this.cb, .3], [this.cf, 1]].forEach(([c, f], j) => { c.globalAlpha = (.3 + .4 * w) * fade * f; c.strokeStyle = C.faint; c.lineWidth = 1; c.stroke(ticks[j]); });
      for (let j = 0; j < Math.ceil(n); j++) {
        const t = this.rot[k] - (j + .5) * BEAD, p = this.P(g.r * Math.cos(t), g.y, g.r * Math.sin(t)), dec = (j + 1) % 10 === 0, dA = wr(t - this.cAng), sw = this.om && w > .01 && dA < 1.2 ? Math.exp(-dA / .14) * w : 0, ja = j === whole ? fr : 1;
        p.fr = p.z < az;
        const px = (dec ? 1.6 : 1.05) * (1 + 1.1 * sw) * FOC / p.z;
        if (sw > .05) { const c = p.fr ? this.cf : this.cb; c.save(); c.shadowColor = pig; c.shadowBlur = 12 * sw; this.disc(p, px, pig, null, ba * sw * ja); c.restore(); }
        this.disc(p, px, own ? pig : C.bg, own ? null : pig, ba * ja, 1);
      }
      if (w > .01 && Math.abs(n - MARBLE.age) > 1.5) { const t = this.rot[k] - (MARBLE.age - .5) * BEAD, p = this.P(g.r * Math.cos(t), g.y, g.r * Math.sin(t)); p.fr = p.z < az; this.disc(p, 2.6 * FOC / p.z, null, C.faint, w * fade * .9, 1); }
      this.text(Math.round(n) + (own ? " years" : " years · the marble’s"), g.y, g.r, this.rot[k] - (n + 1.4) * BEAD, 5.5 + 3.5 * w, rgba(mix(this.pal.faint, this.pal[k + "T"], w)), fade * (.6 + .4 * w), {});
    },
    /* Physiology: a ring at the hips with three stops; the one turned to face you counts. Put down, it lies on the plinth, the name it reads cut flat beside it. */
    drawPhysis() {
      const k = "physis", g = this.geo(k), s = this.state, w = this.w[k], fade = 1 - g.ra, C = this.C, idx = pIdx(this.rot[k], this.V.front), flat = g.u < .5;
      this.ringLine(k, g);
      if (fade < .01) return;
      const az = this.P(0, g.y, 0).z;
      if (w > .01) {
        const paths = [new Path2D(), new Path2D()];
        for (let i = 0; i < 72; i++) {
          const t = this.rot[k] + i * TAU / 72, ct = Math.cos(t), st = Math.sin(t), l = i % 6 ? 2.5 : 5, p = this.P(g.r * ct, g.y, g.r * st), q = flat ? this.P((g.r + l) * ct, g.y, (g.r + l) * st) : this.P(g.r * ct, g.y - l, g.r * st), j = p.z < az ? 1 : 0;
          paths[j].moveTo(p.x, p.y); paths[j].lineTo(q.x, q.y);
        }
        [[this.cb, .3], [this.cf, 1]].forEach(([c, f], j) => { c.globalAlpha = .6 * w * fade * f; c.strokeStyle = C.faint; c.lineWidth = 1; c.stroke(paths[j]); });
      }
      STOPS.forEach((sx, i) => {
        const t = this.rot[k] + i * TAU / 3, p = this.P(g.r * Math.cos(t), g.y, g.r * Math.sin(t)), on = i === idx, given = on && s.sex != null;
        p.fr = p.z < az;
        this.disc(p, on ? 5 : 3.5, given ? rgba(this.pal[k]) : C.bg, given ? C.bg : C.faint, fade * (.4 + .6 * w), on ? 2 : 1);
        const la = (on ? .55 + .45 * w : .8 * w) * fade, nc = on ? rgba(mix(this.pal.faint, this.pal.ink, .4 + .6 * w)) : C.faint, sz = on ? 5 + 5 * w : 7;
        if (flat) {
          this.text(SEXN[sx], g.y, g.r + 15, t, sz, nc, la, { floor: true, center: true });
          if (w > .01) this.text(signed(CONST[sx]) + " KCAL", g.y, g.r + 27, t, 3.6, C.faint, w * fade * .9, { floor: true, center: true, mono: true });
        } else {
          this.text(SEXN[sx], g.y, g.r, t, sz, nc, la, { center: true, lift: -14 });
          this.text(signed(CONST[sx]) + " KCAL", g.y, g.r, t, 3.4, C.faint, w * fade * .9, { center: true, mono: true, lift: 52 });
        }
        if (w > .5) { const q = flat ? this.P((g.r + 15) * Math.cos(t), g.y, (g.r + 15) * Math.sin(t)) : p; this.hits.stops.push({ i, x: q.x, y: q.y }); }
      });
    },
    /* At rest: the four orbits have closed into one ring; each term names its arc; the sweep runs round it in the colour of the arc it crosses; where the sum ends, a bead. */
    drawSum() {
      const A = smooth(clamp(Math.min(...KEYS.map(k => this.ra[k])), 0, 1)); if (A < .01) return;
      const L = this.L, y = .6 * L.H, r = RAD.sum, S = this.sum, C = this.C, az = this.P(0, y, 0).z;
      KEYS.forEach(k => {
        const t = S[k], own = this.stored(k) != null;
        if (t.neg) {
          const paths = [new Path2D(), new Path2D()];
          for (let th = t.a0; th > t.a0 - t.len; th -= .035) { const p1 = this.P(r * Math.cos(th), y - 2.8, r * Math.sin(th)), p2 = this.P(r * Math.cos(th - .03), y + 2.8, r * Math.sin(th - .03)), j = p1.z < az ? 1 : 0; paths[j].moveTo(p1.x, p1.y); paths[j].lineTo(p2.x, p2.y); }
          [[this.cb, .35], [this.cf, 1]].forEach(([c, f], j) => { c.globalAlpha = A * f * (own ? 1 : .55); c.strokeStyle = rgba(this.pal[k]); c.lineWidth = 1.2; c.stroke(paths[j]); });
        }
        if (t.len * r > 26) this.text(NAMES[k].toLowerCase() + " " + signed(t.v), y, r, t.a0 - t.len / 2, 7.5, rgba(this.pal[k + "T"]), A * (own ? 1 : .6), { center: true, lift: t.neg ? 30 : -9 });
      });
      const arcCol = t => { for (const k of KEYS) { const q = S[k]; if (!q.neg && wr(q.a0 - t) < q.len) return rgba(this.pal[k]); } return rgba(this.pal.warm); };
      this.comet(y, r, arcCol, 5, A, 1.7);
      const p = this.P(r * Math.cos(S.end), y, r * Math.sin(S.end)); p.fr = p.z < az;
      this.disc(p, 5, C.ink, C.bg, A, 2);
    },
    /* The anchor the reading hangs from: the side of the ring in hand nearest the reading. */
    placeAnchor() {
      const K = KEYS[this.state.step], V = this.V, g = K ? this.geo(K) : { r: RAD.sum, y: .6 * this.L.H };
      this.anchorW = [V.R[0] * g.r, g.y, V.R[2] * g.r];
      this.anchor = this.P(this.anchorW[0], this.anchorW[1], this.anchorW[2]);
    },
    /* The thread from the ring to its reading: it leaves the ring at the side nearest the leaf and runs into the value's rule. When the sweep passes, it lights. */
    drawLeader() {
      const K = KEYS[this.state.step], A = this.anchor;
      const c = this.cf, a = this.roA, pc = K ? this.pal[K] : this.pal.warm, col = rgba(pc), Ld = this.roLead, held = !!(this.drag && this.drag.moved), fl = this.flare || 0;
      if (Ld && a > .02) { const mx = (A.x + Ld.x) / 2; c.globalAlpha = (.5 + .5 * fl) * a; c.strokeStyle = col; c.lineWidth = 1 + .6 * fl; c.beginPath(); c.moveTo(A.x, A.y); c.bezierCurveTo(mx, A.y, mx, Ld.y, Ld.x, Ld.y); c.stroke(); }
      if (fl > .02) { const gr = c.createRadialGradient(A.x, A.y, 0, A.x, A.y, 30); gr.addColorStop(0, rgba(pc, .5 * fl)); gr.addColorStop(1, rgba(pc, 0)); c.globalAlpha = 1; c.fillStyle = gr; c.beginPath(); c.arc(A.x, A.y, 30, 0, TAU); c.fill(); }
      c.globalAlpha = 1; c.fillStyle = col; c.strokeStyle = this.C.bg; c.lineWidth = 2; c.beginPath(); c.arc(A.x, A.y, (held ? 6.5 : 4.5) + 2 * fl, 0, TAU); c.fill(); c.stroke();
    }
  };

  /* ---------------------------------- words ---------------------------------- */
  /** The reading at the right: the fact, its question, its value, what it adds to the estimate; at rest, the sum line by line. */
  function readoutHtml() {
    const R = room, s = R.state, step = s.step, K = KEYS[step], rest = step === 4, imp = R.imp(s);
    const B = R.burn(s), total = B.total, n = KEYS.filter(k => R.stored(k, s) != null).length, own = K ? R.stored(K, s) != null : false;
    const roInk = K ? "var(--" + PIG[K] + "-trace)" : "var(--gilt)", roPig = K ? "var(--" + PIG[K] + ")" : "var(--warm)";
    const rule = '<span class="mz-rule" aria-hidden="true" style="background:' + roPig + '"></span>';
    let h = '<div class="mz-ro-head"><span class="mz-ro-num" style="color:' + roInk + '">' + (K ? NUM[step] : "I–IV") + '</span>' +
      '<span class="mz-ro-name">' + (K ? NAMES[K] : "At rest").toUpperCase() + '</span><span class="mz-ro-line"></span>' +
      '<span class="mz-ro-of" style="color:' + (K && !own ? "var(--warn)" : "var(--ink-faint)") + '">' + (K ? (own ? "GIVEN" : "NOT GIVEN") : "THE SUM") + '</span></div>' +
      '<h1 class="mz-ro-q" id="mz-title" tabindex="-1">' + Q[K || "rest"] + '</h1>';
    if (K && K !== "physis") {
      const ty = f => s.typing && s.typing.f === f ? s.typing.text : null;
      const field = (f, val, ph, unit, aria) => { const t = ty(f), shown = t != null ? t : val; return '<label class="mz-field"><input class="mz-in" data-f="' + f + '" value="' + esc(shown) + '" placeholder="' + ph + '" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="' + aria + '" style="width:' + (Math.max(1, String(shown || ph).length) * .42 + .06).toFixed(2) + 'em"><span class="mz-unit" style="color:' + roInk + '">' + unit + '</span></label>'; };
      const [ft, inch] = s.cm != null ? fi(s.cm) : ["", ""];
      const fields = K === "stature" ? (imp ? field("ft", ft === "" ? "" : String(ft), "5", "ft", "Height, feet") + field("in", inch === "" ? "" : String(inch), "2", "in", "Height, inches") : field("cm", s.cm != null ? String(Math.round(s.cm)) : "", String(MARBLE.cm), "cm", "Height in centimetres"))
        : K === "mass" ? field("kg", s.kg != null ? (imp ? String(Math.round(s.kg / KG)) : String(Math.round(s.kg * 10) / 10)) : "", imp ? "154" : String(MARBLE.kg), imp ? "lb" : "kg", imp ? "Body weight in pounds" : "Body weight in kilograms")
        : field("age", s.age != null ? String(s.age) : "", String(MARBLE.age), "years", "Age in years");
      h += '<div class="mz-val mz-val-num">' + fields + rule + '</div>';
    } else if (K) {
      h += '<div class="mz-val mz-val-phys" role="radiogroup" aria-label="Physiology">' + STOPS.map((sx, i) => {
        const on = s.sex === sx;
        return '<button type="button" role="radio" class="mz-stop" data-sex="' + sx + '" aria-checked="' + on + '" tabindex="' + (on || (!s.sex && i === 0) ? 0 : -1) + '" style="color:' + (on ? "var(--ink)" : "var(--ink-faint)") + '">' +
          '<span class="mz-stop-l" style="font-style:' + (on ? "italic" : "normal") + '">' + SEXN[sx] + '</span><span class="mz-stop-t">' + signed(CONST[sx]) + ' KCAL</span>' +
          '<span class="mz-stop-bar" style="transform:' + (on ? "scaleX(1)" : "scaleX(0)") + '"></span></button>';
      }).join("") + rule + '</div>';
    } else {
      h += '<div class="mz-val mz-val-num"><span class="mz-total">' + fmt(Math.round(total / 10) * 10) + '</span><span class="mz-unit mz-unit-rest" style="color:' + roInk + '">kcal a day</span>' + rule + '</div>';
    }
    const kc = v => ({ k: "TO THE ESTIMATE", v: signed(v) + " kcal" }), dl = (d, u) => !Math.round(d) ? "level" : signed(d) + u, P4 = B.parts;
    let facts;
    if (K === "stature") { const cm = s.cm ?? MARBLE.cm; facts = own ? [{ k: imp ? "IN CENTIMETRES" : "IN FEET", v: imp ? Math.round(cm) + " cm" : ftin(cm / 2.54) }, { k: "AGAINST THE MARBLE", v: imp ? dl((cm - MARBLE.cm) / 2.54, " in") : dl(cm - MARBLE.cm, " cm") }, kc(P4[0].v)] : [{ k: "THE MARBLE’S COUNTS", v: imp ? "5′ 2″" : MARBLE.cm + " cm", warn: 1 }, kc(P4[0].v)]; }
    else if (K === "mass") { const kg = s.kg ?? MARBLE.kg; facts = own ? [{ k: imp ? "IN KILOS" : "IN POUNDS", v: imp ? (Math.round(kg * 10) / 10) + " kg" : Math.round(kg / KG) + " lb" }, { k: "AGAINST THE MARBLE", v: imp ? dl((kg - MARBLE.kg) / KG, " lb") : dl(kg - MARBLE.kg, " kg") }, kc(P4[1].v)] : [{ k: "THE MARBLE’S COUNTS", v: imp ? "154 lb" : MARBLE.kg + " kg", warn: 1 }, kc(P4[1].v)]; }
    else if (K === "years") facts = own ? [{ k: "EACH YEAR", v: "−5 kcal" }, { k: "AGAINST THE MARBLE", v: dl(s.age - MARBLE.age, Math.abs(s.age - MARBLE.age) === 1 ? " year" : " years") }, kc(P4[2].v)] : [{ k: "THE MARBLE’S COUNTS", v: "thirty", warn: 1 }, kc(P4[2].v)];
    else if (K === "physis") facts = own ? [{ k: "AGAINST THE MIDPOINT", v: signed(CONST[s.sex] - CONST.unspecified) + " kcal" }, kc(P4[3].v)] : [{ k: "THE MIDPOINT COUNTS", v: "not chosen", warn: 1 }, kc(P4[3].v)];
    else facts = [{ k: "THE WARMTH OF A LAMP", v: "≈ " + Math.round(total * WATT) + " W" }, { k: n === 4 ? "ALL FOUR YOURS" : "THE REST ARE THE MARBLE’S", v: n + " of 4 given", warn: n < 4 ? 1 : 0 }];
    h += '<div class="mz-facts">' + facts.map(f => '<div class="mz-fact"><span style="color:' + (f.warn ? "var(--warn)" : "var(--ink-faint)") + '">' + f.k + '</span><span>' + esc(f.v) + '</span></div>').join("") + '</div>';
    if (rest) {
      const HOW = { stature: () => "6.25 × " + Math.round(s.cm ?? MARBLE.cm), mass: () => "10 × " + (Math.round((s.kg ?? MARBLE.kg) * 10) / 10), years: () => "−5 × " + (s.age ?? MARBLE.age), physis: () => s.sex === "male" ? "MALE" : s.sex === "female" ? "FEMALE" : "MIDPOINT" };
      h += '<div class="mz-terms">' + B.parts.map((p, i) => '<button type="button" class="mz-term" data-go="' + i + '" title="Change ' + NAMES[p.k].toLowerCase() + '">' +
        '<span class="mz-dot" style="background:var(--' + PIG[p.k] + '); opacity:' + (p.own ? 1 : .35) + '"></span>' +
        '<span class="mz-term-n">' + NAMES[p.k] + '<span>' + HOW[p.k]() + (p.own ? "" : " · MARBLE’S") + '</span></span>' +
        '<span class="mz-term-v">' + signed(p.v) + '</span></button>').join("") + '</div>' +
        '<p class="mz-source">An estimate by the <a href="' + RESTING_BURN.url + '" target="_blank" rel="noopener">Mifflin–St Jeor equation (1990)</a>. “Not said” takes the midpoint of its two constants.</p>';
    }
    h += '<span class="mz-hint">' + HINT[K || "rest"] + '</span>';
    const link = (label, attrs, on) => '<button type="button" class="mz-link"' + attrs + (on === undefined ? "" : ' aria-pressed="' + on + '"') + '>' + label + '</button>';
    h += '<div class="mz-acts">' +
      (K === "stature" || K === "mass" || rest ? '<div role="group" aria-label="Units" class="mz-units">' + link("CM · KG", ' data-units="metric"', !imp) + link("FT · LB", ' data-units="imperial"', imp) + '</div>' : "") +
      (K && own ? link("CLEAR " + NAMES[K].toUpperCase() + " ×", ' data-act="clear"') : "") +
      (rest && n > 0 ? link("CLEAR YOUR MEASURE ×", ' data-act="wipe"') : "") +
    '</div>';
    return h;
  }

  /* A render can set off another (a field losing the focus as it is replaced): that one waits its turn. */
  let rendering = false;
  function render() {
    if (!live()) return;
    if (rendering) { queueMicrotask(render); return; }
    rendering = true;
    try { renderNow(); } finally { rendering = false; }
  }
  function renderNow() {
    const R = room, s = R.state, step = s.step, K = KEYS[step], cur = s.cur || "";
    pvMorph(ro, readoutHtml());
    // A field not being typed in shows the value as it is now.
    for (const i of ro.querySelectorAll(".mz-in")) if (i !== document.activeElement && i.value !== i.getAttribute("value")) i.value = i.getAttribute("value");
    pad.style.cursor = cur === "ring" || cur === "arc" || cur === "stop" ? "pointer" : cur === "drag-0" ? "ns-resize" : cur === "spin" ? "grab" : cur === "held" ? (step === 0 ? "ns-resize" : "grabbing") : cur.startsWith("drag") ? "ew-resize" : "default";
    const B = R.burn(s), own = K ? R.stored(K, s) != null : false;
    const said = K ? NAMES[K] + ": " + (own ? ro.querySelector(".mz-fact span:last-child")?.textContent || "given" : "not given") : "Estimated resting burn: about " + fmt(Math.round(B.total / 10) * 10) + " kcal a day";
    if (spokenEl.textContent !== said) spokenEl.textContent = said;
    // The footer's index: a bead a fact, filled in its pigment once given; the sum, a warm light.
    pvMorph(foot, STEPS.map((k, i) => {
      const on = step === i, isRest = k === "rest", given = !isRest && R.stored(k, s) != null;
      const title = isRest ? "At rest: what the four burn" : NAMES[k] + (given ? ", given" : ", not given");
      return '<button type="button" data-go="' + i + '" title="' + title + '" aria-label="' + title + '"' + (on ? ' aria-current="step"' : "") + '>' +
        '<svg width="24" height="24" viewBox="-12 -12 24 24" aria-hidden="true"><circle r="10.5" style="fill:none; stroke:var(--ink); stroke-width:1; stroke-opacity:' + (on ? .6 : 0) + '; transition:stroke-opacity .3s ease"></circle>' +
        (isRest ? '<circle r="7.5" style="fill:var(--warm); fill-opacity:.3"></circle>' : "") +
        '<circle r="' + (isRest ? 3.4 : 4.2) + '" style="fill:' + (isRest ? "var(--warm)" : given ? "var(--" + PIG[k] + ")" : "transparent") + '; stroke:' + (isRest || given ? "transparent" : "var(--ink-faint)") + '; stroke-width:1"></circle></svg>' +
        '<span>' + NAMES[k] + '</span></button>';
    }).join(""));
    foot.hidden = Stages.narrow;
  }

  /* --------------------------------- the hand --------------------------------- */
  pad.addEventListener("pointerdown", e => {
    if (Stages.busy || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    try { pad.setPointerCapture(e.pointerId); } catch (_) {}
    room.down(e);
  });
  pad.addEventListener("pointermove", e => { if (live()) room.move(e); });
  pad.addEventListener("pointerleave", () => room.leave());
  addEventListener("pointerup", () => room.release());
  addEventListener("pointercancel", () => room.release());

  /* The wheel goes from step to step, and leaves the stage at either end. */
  let owns = false, acc = 0, spent = false, wheelAt = 0, movedAt = 0;
  addEventListener("wheel", e => {
    owns = false;
    if (!live() || Stages.busy || Stages.narrow || e.ctrlKey || (e.target.closest && e.target.closest(".mz-ro input"))) return;
    const now = performance.now(), d = e.deltaY * (e.deltaMode === 1 ? 32 : 1);
    if (now - wheelAt > 380) { acc = 0; spent = false; }
    wheelAt = now;
    const can = d > 0 ? ui.step < STEPS.length - 1 : ui.step > 0;
    owns = can || now - movedAt < 750;
    if (!can || spent) return;
    acc += d;
    if (Math.abs(acc) > 70) { acc = 0; spent = true; movedAt = now; room.go(ui.step + Math.sign(d)); }
  }, { capture: true, passive: true });

  addEventListener("keydown", e => {
    const el = e.target instanceof Element ? e.target : document.body;
    if (!live() || Stages.busy || el.closest("input, textarea, select, [role=radiogroup]")) return;
    const side = { ArrowRight: 1, ArrowLeft: -1, PageDown: 1, PageUp: -1 }[e.key], up = { ArrowUp: 1, ArrowDown: -1 }[e.key], K = KEYS[ui.step];
    if (side) { e.preventDefault(); room.go(ui.step + side); }
    else if (up && K) { e.preventDefault(); room.stepBy(K, up * (e.shiftKey && K !== "physis" ? 10 : 1)); }
  });

  /* --------------------------------- typing --------------------------------- */
  const ringOf = f => f === "kg" ? "mass" : f === "age" ? "years" : "stature";
  ro.addEventListener("input", e => {
    const t = e.target; if (!t.matches(".mz-in")) return;
    ui.typing = { f: t.dataset.f, text: t.value };
    room.typed(t.dataset.f, t.value, false);
    render();
  });
  ro.addEventListener("focusout", e => {
    const t = e.target; if (!t.matches(".mz-in")) return;
    room.typed(t.dataset.f, t.value, true);
    room.setState({ typing: null });
  });
  ro.addEventListener("keydown", e => {
    const t = e.target, k = e.key;
    if (t.matches(".mz-in")) {
      const d = { ArrowUp: 1, ArrowDown: -1 }[k];
      if (d) { e.preventDefault(); ui.typing = null; room.stepBy(ringOf(t.dataset.f), d * (e.shiftKey ? 10 : 1)); }
      else if (k === "Enter" || k === "Escape") t.blur();
      return;
    }
    const grp = t.closest("[role=radiogroup]"), side = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[k];
    if (grp && side) {
      e.preventDefault();
      const bs = [...grp.querySelectorAll("[role=radio]")], i = Math.max(0, bs.findIndex(b => b.getAttribute("aria-checked") === "true"));
      bs[(i + side + bs.length) % bs.length].click();
      const n = grp.querySelector("[aria-checked=true]"); if (n) n.focus({ preventScroll: true });
    }
  });

  const onClick = e => {
    const t = e.target, K = KEYS[ui.step];
    const g = t.closest("[data-go]");
    if (g) { room.go(+g.dataset.go, e.detail === 0); return; }
    const u = t.closest("[data-units]");
    if (u) { if (u.dataset.units !== M.units) room.setState({ units: u.dataset.units, typing: null }); return; }
    const sx = t.closest("[data-sex]");
    if (sx) { room.setState({ sex: sx.dataset.sex }); return; }
    const act = t.closest("[data-act]"), a = act && act.dataset.act;
    if (a === "clear" && K) room.clearFact(K);
    else if (a === "wipe") { room.setState({ cm: null, kg: null, age: null, sex: null, typing: null }); announce("Your measure is cleared"); }
  };
  ro.addEventListener("click", onClick);
  foot.addEventListener("click", onClick);

  /* -------------------------------- each frame -------------------------------- */
  let raf = 0, last = 0, leftAt = 0, refit = true;
  function loop(now) {
    raf = 0;
    if (!live()) {
      if (!leftAt) leftAt = now;
      if (now - leftAt > 900) { leftAt = 0; last = 0; return; }
    } else leftAt = 0;
    raf = requestAnimationFrame(loop);
    if (Stages.opening) { last = 0; return; }
    const dt = clamp(now - (last || now), 0, 100); last = now;
    if (refit) { refit = false; fitPlate(); }
    try {
      room.palette();
      room.frame(dt);
      room.placeAnchor();
      room.placeReadout();
      if (!Stages.narrow) { room.paintSky(); room.draw(); if (live()) room.film(); }
    } catch (err) { if (!loop.err) { loop.err = 1; console.warn("Measure: " + err.message); } }
  }
  const run = () => { if (!raf) raf = requestAnimationFrame(loop); };
  addEventListener("resize", () => { refit = true; if (live()) render(); });
  new ResizeObserver(() => { refit = true; }).observe(sec);
  if (document.fonts) document.fonts.ready.then(() => room.advC && room.advC.clear());

  /* --------------------------------- the stage -------------------------------- */
  /* The camera a change of stage travels to; filmAt moves its end onto the room's camera as it goes. */
  SCULPTURE_SHOTS["measure-plate"] = { az: -9, el: -5, ty: 79, d: 480, sx: .34, sy: .52, fov: 34 };
  SCULPTURE_SHOTS["measure"] = SCULPTURE_SHOTS["targets-front"];
  let from = null, openAt = null;

  Stages.register("measure", {
    arrive() { from = Stages.from; openAt = ["four", "mark", "seal", "dial"].includes(Stages.at) ? "rest" : Stages.at; },
    enter() {
      // Stepping back from Nutrition lands on the sum; any other arrival starts at the first fact still to give.
      const firstMissing = () => { const i = KEYS.findIndex(k => room.stored(k) == null); return i < 0 ? 4 : i; };
      const at = STEPS.includes(openAt) ? STEPS.indexOf(openAt) : from === "nutrition" ? 4 : M.complete ? 0 : firstMissing();
      openAt = null;
      ui.step = at; ui.cur = null; ui.typing = null;
      room.reset(at);
      room.swapT = room.clock - (Stages.still ? 1e4 : 0);
      ro.style.opacity = "0";
      refit = true; fitPlate();
      render();
      run();
    },
    place: () => STEPS[ui.step],
    shot: () => Stages.narrow ? "measure" : "measure-plate",
    // The wheel goes from step to step, and leaves the stage at either end.
    wheel: () => owns ? false : undefined,
    focus: () => $("mz-title"),
    footer() {
      const s = ui.step, end = s === STEPS.length - 1;
      return {
        back: s > 0 ? NAMES[STEPS[s - 1]] : selection.isEmpty() ? "Your muscles" : "Training focus",
        skip: s < 4 ? "Skip for now" : "",
        next: end ? "Nutrition" : NAMES[STEPS[s + 1]],
        hint: "or scroll"
      };
    },
    onNext() { if (ui.step < STEPS.length - 1) room.go(ui.step + 1); else if (!Stages.busy) Stages.go("nutrition"); return true; },
    onBack() { if (ui.step > 0) room.go(ui.step - 1); else Stages.go("targets"); return true; },
    onSkip() { Stages.go("nutrition"); return true; }
  });
})();
