/* ===========================================================================
   Stages — moving between Targets, Nutrition and the Week plan.

   One rule: motion helps the user understand where they are going;
   stillness helps them concentrate on what they are doing. So a change of
   stage runs in three phases, and nothing moves outside them:

     out      the stage's interface fades (STAGE_TIMING.out)
     moving   the new stage is drawn, the sculpture's camera travels to its
              shot, and the interface comes in group by group as it lands
     idle     everything is still; the controls are live

   The same three phases carry a change inside a stage that rearranges the
   screen (opening "A day of eating", "Shape your week", a generated week):
   relayout().

   Each stage registers a view (Stages.register): what to draw on entering,
   which shot the sculpture takes, how strongly it shows, which muscles it
   lights, and what the footer offers. This file only sequences them; the
   views own their content and the routine owns the data.

   The user moves with the navigation in the masthead, the footer's
   Continue, or an intentional scroll: a firm wheel gesture over anything
   that is not itself scrolling.
   ========================================================================= */

const STAGE_ORDER = ["targets", "nutrition", "plan"];
const STAGE_NAMES = { targets: "Targets", nutrition: "Nutrition", plan: "Week plan" };

/* Phase lengths in ms; with reduced motion, just long enough to swap. */
const STAGE_TIMING = { out: 300, settle: 1250, outStill: 60, settleStill: 120 };

/* The wheel: how far (deltaY, summed while the gestures keep coming within
   `gap` ms) counts as meaning it, and how long after a pane scrolled the
   wheel is left to it. */
const STAGE_WHEEL = { threshold: 260, gap: 450, quiet: 450 };

/* Below this width the sculpture sits in a band above the stage. */
const STAGE_NARROW = "(max-width: 759px)";

const Stages = {
  current: "targets",
  phase: "idle",
  busy: false,
  views: {},

  /**
   * A stage's view:
   *   arrive()      set up for arriving from elsewhere (before enter)
   *   enter()       draw it, as it is entered or rearranged (before it is shown)
   *   shot()        the sculpture's shot (SCULPTURE_SHOTS), default the stage
   *   dim()         how strongly the sculpture shows, 0–1, default 1
   *   highlight()   muscle ids to light, or null
   *   footer()      { back, next, skip, hint }: each a label, or empty
   *   onBack(), onNext(), onSkip()   what those do, default the stages either side
   *   wheel()       false while the stage needs the wheel for itself
   *   focus()       the element to focus once it is shown
   */
  register(name, view) { this.views[name] = view; },

  get root() { return $("atlas"); },
  get narrow() { return matchMedia(STAGE_NARROW).matches; },
  get wide() { return matchMedia("(min-width: 1240px)").matches; },
  get still() { return matchMedia("(prefers-reduced-motion: reduce)").matches; },

  /** Week plan opens only once something is selected. */
  can(name) { return name !== "plan" || !routine.selection.isEmpty(); },

  /** Shows a stage at once, with no motion: where the page opens. */
  start(name) {
    if (!this.can(name)) name = "targets";
    this.current = name;
    this.paintStage();
    this.call("arrive");
    this.call("enter");
    this.phase = "idle";
    this.root.dataset.phase = "idle";
    this.refresh();
  },

  /** Moves to a stage: out, then the new one drawn while the camera travels, then still. */
  go(name, before) {
    if (!STAGE_ORDER.includes(name) || this.busy || !this.can(name)) return;
    if (name === this.current) { if (before) { before(); this.refresh(); } return; }
    this.run(() => {
      if (before) before();
      this.current = name;
      this.paintStage();
      this.call("arrive");
      this.call("enter");
      this.toTop();
    }, STAGE_TIMING.settle, () => this.landed());
  },

  /**
   * Rearranges the current stage the same way: `change` makes the new
   * state (and draws it) while the interface is out; `settle` is how long
   * the camera is given.
   */
  relayout(change, settle = 900) {
    if (this.busy) return;
    this.run(() => { change(); this.call("enter"); this.toTop(); }, settle, () => this.landed());
  },

  run(change, settle, done) {
    this.busy = true;
    const still = this.still;
    this.setPhase("out");
    setTimeout(() => {
      change();
      this.setPhase("moving");
      setTimeout(() => {
        this.busy = false;
        this.setPhase("idle");
        done();
      }, still ? STAGE_TIMING.settleStill : settle);
    }, still ? STAGE_TIMING.outStill : STAGE_TIMING.out);
  },

  setPhase(phase) {
    this.phase = phase;
    this.root.dataset.phase = phase;
    this.refresh();
  },

  /** A stage arrives at its start: every pane in it scrolled to the top. */
  toTop() {
    const el = $("stage-" + this.current);
    for (const pane of [el, ...el.querySelectorAll("[data-scroll]")]) pane.scrollTop = 0;
  },

  /** Focus follows the user to the new screen when it was left behind on the old one. */
  landed() {
    const active = document.activeElement;
    const lost = !active || active === document.body || !active.isConnected ||
      !!active.closest(".stage:not(.is-current)") || active.offsetParent === null;
    if (!lost) return;
    const el = this.call("focus") || $("stage-" + this.current).querySelector("h1");
    if (el) el.focus({ preventScroll: true });
  },

  next() {
    if (this.busy) return;
    if (this.call("onNext") === undefined) {
      const i = STAGE_ORDER.indexOf(this.current);
      if (i < STAGE_ORDER.length - 1) this.go(STAGE_ORDER[i + 1]);
    }
  },
  back() {
    if (this.busy) return;
    if (this.call("onBack") === undefined) {
      const i = STAGE_ORDER.indexOf(this.current);
      if (i > 0) this.go(STAGE_ORDER[i - 1]);
    }
  },

  /** Calls the current view's `fn`, if it has one; undefined if not. */
  call(fn, name = this.current) {
    const view = this.views[name];
    return view && typeof view[fn] === "function" ? view[fn]() : undefined;
  },

  /* ------------------------------- painting ------------------------------ */

  paintStage() {
    const root = this.root;
    root.dataset.stage = this.current;
    for (const name of STAGE_ORDER) $("stage-" + name).classList.toggle("is-current", name === this.current);
    const n = String(STAGE_ORDER.indexOf(this.current) + 1).padStart(2, "0");
    $("stage-label").innerHTML = '<span class="n">' + n + '</span> / ' + STAGE_NAMES[this.current];
  },

  /** Brings the sculpture, the navigation and the footer in line with the stage and phase. */
  refresh() {
    const idle = this.phase === "idle";
    if (typeof figure === "object") {
      figure.setLayout(this.narrow ? "mobile" : "desktop");
      figure.setShot(this.call("shot") || this.current);
      const dim = this.call("dim");
      figure.setDim(dim === undefined ? 1 : dim);
      figure.setInteractive(this.current === "targets" && idle);
      figure.setHighlight(this.call("highlight") || null);
    }
    this.root.dataset.layout = this.narrow ? "mobile" : "desktop";
    this.paintNav();
    this.paintFooter();
  },

  paintNav() {
    for (const b of document.querySelectorAll("#stage-nav [data-goto], #foot-dots [data-goto]")) {
      const name = b.dataset.goto;
      b.disabled = !this.can(name);
      if (name === this.current) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    }
  },

  paintFooter() {
    const f = this.call("footer") || {};
    const set = (id, text) => {
      const el = $(id);
      el.hidden = !text;
      if (text && el.textContent !== text) el.textContent = text;
    };
    set("foot-back", f.back);
    set("foot-skip", f.skip);
    set("foot-next", f.next);
    $("foot-next").disabled = !!f.nextDisabled;
    $("foot-hint").textContent = f.hint || "";
  },

  /* -------------------------------- input -------------------------------- */

  /**
   * An intentional scroll moves on a stage: deltaY adding up past the
   * threshold within a gesture. Anything that scrolls itself (marked
   * data-scroll) takes the wheel first, and keeps it for a moment after.
   */
  wheel(e) {
    if (this.busy || this.narrow || this.call("wheel") === false) return;
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const now = performance.now();
    const pane = e.target && e.target.closest && e.target.closest("[data-scroll]");
    if (pane) {
      const down = e.deltaY > 0;
      const can = down ? pane.scrollTop + pane.clientHeight < pane.scrollHeight - 2 : pane.scrollTop > 2;
      if (can) { this.acc = 0; this.scrolledAt = now; return; }
    }
    if (now - (this.scrolledAt || 0) < STAGE_WHEEL.quiet) return;
    if (now - (this.wheelAt || 0) > STAGE_WHEEL.gap) this.acc = 0;
    this.wheelAt = now;
    this.acc = (this.acc || 0) + e.deltaY;
    if (Math.abs(this.acc) > STAGE_WHEEL.threshold) {
      const down = this.acc > 0;
      this.acc = 0;
      if (down) this.next(); else this.back();
    }
  },

  wire() {
    // The masthead's stages, the phone's numbered dots, and any
    // "Change"-style link to a stage (data-goto) anywhere on the page.
    $("foot-dots").innerHTML = STAGE_ORDER.map((name, i) =>
      '<button type="button" data-goto="' + name + '" aria-label="' + STAGE_NAMES[name] + '">' +
      (i + 1) + '</button>').join("");
    document.addEventListener("click", e => {
      const b = e.target.closest("[data-goto]");
      if (b && !b.disabled) this.go(b.dataset.goto);
    });
    $("foot-back").addEventListener("click", () => this.back());
    $("foot-next").addEventListener("click", () => this.next());
    $("foot-skip").addEventListener("click", () => { if (this.call("onSkip") === undefined) this.go("plan"); });
    addEventListener("wheel", e => this.wheel(e), { passive: true });
    matchMedia(STAGE_NARROW).addEventListener("change", () => this.refresh());
    matchMedia("(min-width: 1240px)").addEventListener("change", () => this.paintFooter());
    routine.selection.onChange(() => { this.paintNav(); this.paintFooter(); });
  }
};

Stages.wire();
