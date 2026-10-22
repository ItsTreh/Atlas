/* ===========================================================================
   Start screen — the way in.

   Before the first stage, the page opens on the sculpture in one of five
   ways (START_VARIANTS), a different one each time it loads: the next of a
   shuffled round, so every variant is seen once before any comes back.
   index.html?start=<variant> opens on that one; ?start=off skips it.

     cinematic   the figure from below, left; ATLAS and Begin beside it
     torso       the chest rising out of the bottom edge; ATLAS above it
     carved      the word cut out of the ground, the body seen through it;
                 the camera dives through the T
     detail      the back of the shoulder, close; a drag turns the figure
     monument    the whole figure standing in front of the five letters

   It moves the stage's own camera: the stage is drawn underneath, held
   (Stages.start(name, true)), and its interface waits. A scroll, a drag
   or a swipe up scrubs the camera from the opening shot to the stage's
   shot; let go past half way and the move finishes itself and the stage
   comes in, let go at half way or short of it and it springs back. Begin (a click, Enter, or the cue) runs the same move on its
   own: Stages.open() takes the camera on as any change of stage does.

   What sits under the body (the carved ground's ink, the monument's
   letters) is drawn in the anatomy stage beneath its viewport
   (.start-ground); the rest is this overlay, #start, over everything.
   ========================================================================= */

const START_VARIANTS = ["cinematic", "torso", "carved", "detail", "monument"];
const START_CUES = {
  cinematic: "Scroll to begin",
  torso: "Scroll to raise the figure",
  carved: "Scroll to step through",
  detail: "Drag to turn the figure",
  monument: "Touch the sculpture to begin"
};
/* Where the round of variants is kept: { deck: [the ones still to come], last }. */
const START_STORE = "atlas.start";
/* Scroll, drag and swipe all scrub one camera move. `wheelSpan` px of wheel
   (or `dragSpan` of the screen) is the whole move. `wheelRest` ms after the
   wheel stops, or as a drag lets go, a move past `commit` finishes on its
   own, over what is left of `autoMs` (as Begin on the carved ground runs it
   whole); one at `commit` or short of it springs back over `springMs`. A
   press that moves under `slop` px is still a tap. */
const START_SCRUB = { wheelSpan: 720, wheelRest: 420, dragSpan: .45, springMs: 560, autoMs: 1600, commit: .5, slop: 6 };
/* The camera drifts in from its approach after `approach` ms; the words come
   in, and input is taken, `ready` ms after that. Once the move has run to
   the stage's shot, its interface comes in after `settle`. */
const START_TIMING = { approach: 450, ready: 1000, leave: 260, settle: 200, gone: 800 };
/* The carved ground: the letters' focus (the T's stem, in the veil's
   1600 × 1000 units) and how far the camera's dive scales them. */
const START_CARVE = { fx: 531, fy: 560, zoom: 320 };

const startEase = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const startClamp = x => Math.max(0, Math.min(1, x));

const StartScreen = {
  variant: null,
  phase: "off",     // intro (the camera drifting in), idle (taking input), out, done
  p: 0,             // how far along the move into the stage, 0 … 1
  drag: null,
  auto: false,

  get el() { return $("start"); },
  get still() { return matchMedia("(prefers-reduced-motion: reduce)").matches; },

  /** True when the start screen can play: the sculpture has a camera to move. */
  plays() {
    return new URLSearchParams(location.search).get("start") !== "off" &&
      typeof figure === "object" && figure.moves;
  },

  /** This load's variant: the next of the round, or the one ?start= asks for. */
  pick() {
    const asked = new URLSearchParams(location.search).get("start");
    if (START_VARIANTS.includes(asked)) return asked;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(START_STORE)); } catch (e) {}
    const last = saved && saved.last;
    let deck = saved && Array.isArray(saved.deck) ? saved.deck.filter(v => START_VARIANTS.includes(v)) : [];
    if (!deck.length) {
      deck = START_VARIANTS.slice();
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      // A new round never opens on the one the last round ended with.
      if (deck[0] === last) deck.push(deck.shift());
    }
    const v = deck.shift();
    try { localStorage.setItem(START_STORE, JSON.stringify({ deck, last: v })); } catch (e) {}
    return v;
  },

  /** Opens on a variant, while Stages holds the page. */
  play() {
    if (!Stages.opening) return;
    const v = this.variant = this.pick(), el = this.el;
    Stages.root.dataset.opening = v;
    el.dataset.variant = v;
    el.hidden = false;
    $("start-cue-label").textContent = START_CUES[v];
    const hit = $("start-hit");
    if (v === "carved" || v === "monument") {
      hit.setAttribute("role", "button");
      hit.setAttribute("aria-label", "Begin");
      hit.tabIndex = 0;
    }
    this.fitVeil();
    this.wire();
    this.paint();
    if (this.still) {
      figure.scrubShot("start-" + v, "start-" + v, 1);
      this.setPhase("idle");
      return;
    }
    figure.scrubShot("start-" + v + "-pre", "start-" + v + "-pre", 1);
    this.setPhase("intro");
    this.timer = setTimeout(() => {
      figure.setShot("start-" + v);
      this.timer = setTimeout(() => this.setPhase("idle"), START_TIMING.ready);
    }, START_TIMING.approach);
  },

  setPhase(phase) {
    this.phase = phase;
    this.el.dataset.phase = phase;
  },

  /* ------------------------------- the move ------------------------------ */

  /** Places the camera `p` of the way along the move into the stage. */
  scrubTo(p) {
    this.p = startClamp(p);
    figure.scrubShot("start-" + this.variant, Stages.shot(), startEase(this.p));
    this.paint();
  },

  /** Let go part way: past `commit` the move finishes, otherwise it springs back to the opening. */
  release() {
    cancelAnimationFrame(this.raf);
    if (this.p <= 0 || this.p >= 1 || this.phase !== "idle") return;
    if (this.p > START_SCRUB.commit) { this.run(); return; }
    if (this.still) { this.scrubTo(0); return; }
    const from = this.p, t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / START_SCRUB.springMs);
      this.scrubTo(from * Math.pow(1 - k, 3));
      if (k < 1 && this.phase === "idle") this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  },

  /** Begin: the camera goes on to the stage's shot by itself. */
  begin() {
    if (this.phase !== "idle") return;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.wheelTimer);
    // The carved ground's letters dive with the camera, so its move is the scrub's, run through.
    if (this.variant === "carved") { this.run(); return; }
    this.leave(START_TIMING.leave, STAGE_TIMING.settle);
  },

  run() {
    if (this.still) { this.scrubTo(1); this.complete(); return; }
    const from = this.p, t0 = performance.now();
    this.auto = true;
    const step = now => {
      const k = Math.min(1, (now - t0) / (START_SCRUB.autoMs * (1 - from)));
      this.scrubTo(from + (1 - from) * startEase(k));
      if (k < 1) this.raf = requestAnimationFrame(step);
      else { this.auto = false; this.complete(); }
    };
    this.raf = requestAnimationFrame(step);
  },

  /** The move has reached the stage's shot: the stage comes in at once. */
  complete() {
    if (this.phase !== "idle") return;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.wheelTimer);
    this.leave(0, START_TIMING.settle);
  },

  /** The words go, then the stage takes over and this overlay goes. */
  leave(delay, settle) {
    this.drag = null;
    this.setPhase("out");
    this.paint();
    this.unwire();
    // Focus leaves with the overlay, so the stage takes it once it lands (Stages.landed).
    if (this.el.contains(document.activeElement)) document.activeElement.blur();
    this.timer = setTimeout(() => {
      Stages.open(settle);
      this.timer = setTimeout(() => {
        this.el.hidden = true;
        this.setPhase("done");
      }, START_TIMING.gone);
    }, delay);
  },

  /* -------------------------------- drawing ------------------------------ */

  paint() {
    const p = this.p, el = this.el;
    Stages.root.style.setProperty("--start-p", p.toFixed(4));
    el.toggleAttribute("data-live", p > 0 || !!(this.drag && this.drag.moved));
    el.toggleAttribute("data-dragging", !!this.drag);
    if (this.variant !== "carved") return;
    // The letters swell around the T's stem and drift to the centre while
    // the camera closes in; the ink goes, then the veil.
    const C = START_CARVE, zoom = Math.exp(Math.log(C.zoom) * Math.pow(p, 2.2));
    const e = startEase(Math.min(1, p * 1.6)), cx = C.fx + (800 - C.fx) * e, cy = C.fy + (500 - C.fy) * e;
    $("start-carve-letters").setAttribute("transform", "translate(" + cx.toFixed(2) + " " + cy.toFixed(2) +
      ") scale(" + zoom.toFixed(4) + ") translate(" + -C.fx + " " + -C.fy + ")");
    document.querySelector(".start-ink").style.opacity = startClamp(1 - (p - .3) / .35);
    $("start-veil").style.opacity = startClamp(1 - (p - .62) / .26);
  },

  /**
   * The veil fills a wide screen edge to edge; on a tall one, it keeps the
   * whole word in view. Its mask and ground cover what the screen shows of
   * it and no more: Firefox (156) drops a mask whose surface outgrows its
   * limit, and a full screen at 2× took the design's fixed 13600-unit one
   * past it, leaving the ground with no letters cut out.
   */
  fitVeil() {
    const veil = $("start-veil"), W = innerWidth, H = innerHeight, tall = W < H;
    veil.setAttribute("preserveAspectRatio", tall ? "xMidYMid meet" : "xMidYMid slice");
    const k = (tall ? Math.min : Math.max)(W / 1600, H / 1000);
    const w = W / k + 2, h = H / k + 2;      // a unit's margin either side
    const box = { x: 800 - w / 2, y: 500 - h / 2, width: w, height: h };
    for (const el of [$("start-carve"), veil.querySelector("mask rect"), veil.querySelector(".start-veil-ground")])
      for (const [name, v] of Object.entries(box)) el.setAttribute(name, v.toFixed(1));
  },

  /* -------------------------------- input -------------------------------- */

  wheel(e) {
    if (this.phase !== "idle" || e.ctrlKey || this.drag || this.auto) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    if (dy <= 0 && this.p <= 0) return;
    cancelAnimationFrame(this.raf);
    this.scrubTo(this.p + dy / START_SCRUB.wheelSpan);
    clearTimeout(this.wheelTimer);
    if (this.p >= 1) { this.complete(); return; }
    this.wheelTimer = setTimeout(() => this.release(), START_SCRUB.wheelRest);
  },

  key(e) {
    if (this.phase !== "idle" || e.altKey || e.ctrlKey || e.metaKey) return;
    // A focused button begins on its own click.
    if ((e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest("button")) return;
    if (["Enter", " ", "ArrowDown", "PageDown"].includes(e.key)) { e.preventDefault(); this.begin(); }
  },

  /* On the detail, a drag either way turns the figure; elsewhere a swipe
     up (touch or pen) raises it, as a scroll does. A tap on the carved
     ground or the monument begins. */
  down(e) {
    if (this.phase !== "idle" || this.auto || e.button > 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    cancelAnimationFrame(this.raf);
    clearTimeout(this.wheelTimer);
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, p0: this.p, moved: false, mouse: e.pointerType === "mouse" };
    this.paint();
  },
  move(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < START_SCRUB.slop) return;
    d.moved = true;
    const detail = this.variant === "detail";
    const along = detail ? Math.abs(dx) : d.mouse ? 0 : Math.max(0, -dy);
    const span = (detail ? innerWidth : innerHeight) * START_SCRUB.dragSpan;
    this.scrubTo(d.p0 + along / span);
    if (this.p >= 1) { this.drag = null; this.complete(); }
  },
  up(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    this.paint();
    if (!d.moved && e.type === "pointerup" && (this.variant === "carved" || this.variant === "monument")) this.begin();
    else this.release();
  },

  wire() {
    if (this.unwire) return;
    const hit = $("start-hit"), begin = () => this.begin();
    const on = {
      wheel: e => this.wheel(e), keydown: e => this.key(e), resize: () => this.fitVeil()
    };
    const ptr = {
      pointerdown: e => this.down(e), pointermove: e => this.move(e),
      pointerup: e => this.up(e), pointercancel: e => this.up(e)
    };
    addEventListener("wheel", on.wheel, { passive: true });
    addEventListener("keydown", on.keydown);
    addEventListener("resize", on.resize);
    for (const [type, fn] of Object.entries(ptr)) hit.addEventListener(type, fn);
    $("start-begin").addEventListener("click", begin);
    $("start-cue").addEventListener("click", begin);
    this.unwire = () => {
      removeEventListener("wheel", on.wheel);
      removeEventListener("keydown", on.keydown);
      removeEventListener("resize", on.resize);
      for (const [type, fn] of Object.entries(ptr)) hit.removeEventListener(type, fn);
      $("start-begin").removeEventListener("click", begin);
      $("start-cue").removeEventListener("click", begin);
      this.unwire = () => {};
    };
  }
};
