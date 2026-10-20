/* ===========================================================================
   Anatomy sculpture — the body as a lit 3D model (WebGL2).

   The renderer the anatomy stage mounts when the browser has WebGL2; the
   SVG AnatomyFigure (anatomy.js) takes over where it does not. It has the
   same contract: new AnatomySculpture(mount, selection, { onHover, onFail }),
   paint() and preview(ids), plus destroy(), and like the figure it only ever calls
   selection.toggle(). The selection stays the one source of truth.

   One sculpture, every stage. The canvas fills the page behind the
   interface, and a single camera moves between named shots
   (SCULPTURE_SHOTS): the whole figure, centred, for Targets; the torso from
   below, on the left, for Nutrition; a three-quarter close-up of the upper
   body, on the right, for the Week plan. Motion helps the user understand
   where they are going and stillness helps them concentrate, so the camera
   moves only when the stage changes, then settles; nothing drifts while the
   user works.

   What it draws: ANATOMY_MODEL (or the model it is given), once, through a
   narrow perspective lens (20°), so the figure reads as a sculpture seen
   from across a gallery rather than a scene. Light is soft and follows the
   viewer. It draws only when something changes (selection, pointer, size,
   theme, the camera); a change of state eases in over a few frames, then
   drawing stops again.

   How it turns: on Targets the camera stands in front of the body or
   behind it. turnTo() walks it the half circle between them; a sideways
   drag turns it a little either side (SCULPTURE_TURN) and turnTo() on the
   same view turns it back exactly. Every other stage is one fixed shot.

     front 0° ─ drag ±25° ─┐            ┌─ drag ±25° ─ back 180°
                           └─ the turn ─┘

   The sculpture is the body; cartography is how the body communicates.
   Area-weighted surface particles resolve around the pointer, with fine
   contours measured from the authored region borders. Selection retains
   a quieter map instead of painting a solid patch onto the sculpture.

   Only Targets is interactive (setInteractive): there the selection shows
   and the pointer picks. Elsewhere the figure rests unmarked, except for
   the muscles the page highlights (setHighlight), such as the session the
   user points at in the Week plan.

   How a muscle is found under the pointer: a second, hidden pass writes
   each pixel's region into an offscreen buffer, read back whenever the
   camera comes to rest. While it moves, nothing is pointed at.
   The region's name maps to an app muscle through ANATOMY_REGIONS.

     app muscle id → its regions (ANATOMY_REGIONS) → each region's colour

   Keyboard and screen-reader users get what the SVG figure gave them: a
   checkbox per muscle in each view that shows it, in catalogue order,
   placed on the muscle as that view shows it. Focusing one on the other
   side turns the body round to it.
   ========================================================================= */

const SCULPTURE_VIEWS = [
  { id: "front", label: "Front" },
  { id: "back",  label: "Back" }
];

/* The camera's shots. Written against Male_Body (157.7 cm tall), in its
   centimetres; any other figure scales them by its own height.
     az   degrees round the upright axis: 0 in front, 90 at the figure's left
     el   degrees above the point aimed at (below zero looks up)
     ty   height of the point aimed at, cm
     d    distance from it, cm
     sx   where it lands across the canvas, 0 left … 1 right
     sy   where it lands down the canvas, 0 top … 1 bottom
     fov  the lens, vertical degrees
   SCULPTURE_MOBILE reframes them for a phone, where the figure sits in a
   band above the content rather than beside it. On a screen narrower than
   SCULPTURE_WIDE (width ÷ height), a shot that sets the figure beside the
   content steps back (by the square of the shortfall: the panel beside it
   narrows faster than the screen), so the figure narrows with the screen
   instead of reaching under the panel. */
const SCULPTURE_SHOTS = {
  "targets-front":     { az: 0,   el: 2,   ty: 79,  d: 615, sx: .50, sy: .475, fov: 20 },
  "targets-back":      { az: 180, el: 2,   ty: 79,  d: 615, sx: .50, sy: .475, fov: 20 },
  "nutrition":         { az: -18, el: -26, ty: 124, d: 250, sx: .19, sy: .40,  fov: 20 },
  "plan":              { az: 36,  el: -7,  ty: 116, d: 270, sx: .75, sy: .50,  fov: 20 },
  "plan-availability": { az: 36,  el: -7,  ty: 110, d: 460, sx: .98, sy: .42,  fov: 20 },
  "plan-generated":    { az: 36,  el: -7,  ty: 118, d: 330, sx: .85, sy: .43,  fov: 20 }
};
const SCULPTURE_SHOT_HEIGHT = 157.683;
const SCULPTURE_WIDE = 1.6;
const SCULPTURE_MOBILE = {
  "targets":   { d: 1.02 },
  "nutrition": { d: 1.15 },
  "plan":      { d: 1.15, ty: 122 },
  "plan-generated": { d: 1.25, ty: 122 },
  "plan-availability": { d: 1.15, ty: 122 }
};

/* How the camera moves between shots, in ms: longer the further round the
   body it goes, and it eases out a little on the way (`arc`, a share of
   the distance) when it swings round, so it never cuts through the figure.
   Turning between Front and Back is `turn` (SCULPTURE_TURN). */
const SCULPTURE_MOVE = { base: 1350, perDegree: 4.5, max: 2300, arc: 0.22, arcNear: 0.05 };

/* How the body turns, in degrees and ms. Changing view turns it the half
   circle in `turn`. A drag turns it `perPx` degrees a pixel, up to `orbit`
   either side of the view; past that it gives only a little more (up to
   `give`) and springs back on release, in `settle`, as it does when the
   view's own button is pressed. A press that moves under `slop` px is
   still a click. With reduced motion, turns are shown at once. */
const SCULPTURE_TURN = { turn: 650, settle: 280, orbit: 25, give: 6, perPx: 0.3, slop: 4 };

// How long a lost WebGL context gets to come back before the stage swaps in
// the next renderer.
const SCULPTURE_RESTORE_MS = 3000;

/* Relative strength of the map's contours. The shader leaves only a trace
   of surface tint, so the same material models every state. Program and
   workout previews use the same map without changing the selection. */
const SCULPTURE_TONE = { hover: 0.32, selectedHover: 0.78, preview: 0.45, highlight: 0.62, highlightDepth: 0.4 };

/* A small amount of modelling under selection; the vertex shader attenuates
   the selection weight so cartography, rather than a solid fill, leads. */
const SCULPTURE_SELECTED_GAIN = 1.4;

/* How fast the drawing follows a change, as time constants (ms) of an
   exponential ease: a muscle answers the pointer almost at once, eases
   back when left, and a selection settles in between. With reduced
   motion, changes are drawn at once. */
const SCULPTURE_EASE = { hoverIn: 35, hoverOut: 90, select: 60 };

class AnatomySculpture {
  /** True when this browser can draw the sculpture (ANATOMY_MODEL, or `model`). */
  static supported(model = typeof ANATOMY_MODEL === "object" ? ANATOMY_MODEL : null) {
    if (!model || typeof WebGL2RenderingContext !== "function") return false;
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();              // a probe; free it now
    return true;
  }

  /**
   * @param opts.onHover  called with a Muscle when one is pointed at or
   *                      focused, and with null when it is left
   * @param opts.onTurn   called with the view id ("front", "back") and
   *                      whether a drag has turned the body off it
   * @param opts.model    the model to draw, in the ANATOMY_MODEL shape;
   *                      ANATOMY_MODEL when left out
   * @param opts.shot     the shot to open on (SCULPTURE_SHOTS, or "targets")
   */
  constructor(mount, selection, opts = {}) {
    this.mount = mount;
    this.selection = selection;
    this.onHover = opts.onHover || (() => {});
    this.onFail = opts.onFail || (() => {});
    this.onTurn = opts.onTurn || (() => {});
    this.model = opts.model || ANATOMY_MODEL;
    // Region index → app muscle id, or null where the region is not selectable.
    this.muscleOf = this.model.regions.map(name => ANATOMY_REGIONS[name] || null);
    this.isForm = this.model.kinds.map(kind => kind === "form");
    this.shown = null;                       // per region: [selected, pointed at, highlighted], eased (ease)
    this.reducedMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)");
    this.hovered = null;
    this.mapPresence = 0;
    this.mapPointer = [0, 0];
    this.previewing = null;                  // a Set of muscle ids while a program is pointed at
    this.highlighting = null;                // a Set of muscle ids the page lights (setHighlight)
    this.interactive = true;                 // the selection shows and the pointer picks
    this.focused = null;                     // { view, id } while a muscle has keyboard focus
    this.hits = new Map();                   // "view:id" → its checkbox
    this.view = SCULPTURE_VIEWS[0];          // the view Targets turns to, or is turning to
    this.mobile = false;                     // the phone framing (setLayout)
    this.shotName = this.resolve(opts.shot || "targets");
    this.cur = null;                         // the camera's shot now, without the drag
    this.off = 0;                            // degrees a drag has turned it round the body
    this.tween = null;                       // { from, to, t, ms, arc } while the camera moves
    this.offTween = null;                    // { from, to, t, ms } while a drag springs back
    this.drag = null;                        // { x, y, from, active } while a press may become a drag
    this.pickKey = null;                     // the camera the region buffer was drawn with
    this.dim = "1";                          // how strongly the figure shows (setDim)

    this.container = document.createElement("div");
    this.container.className = "anatomy-sculpture";
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.groups = SCULPTURE_VIEWS.map(v => {
      const g = document.createElement("div");
      g.className = "hits";
      g.setAttribute("role", "group");
      g.setAttribute("aria-label", v.label + " of the body");
      return g;
    });
    this.canvas.style.opacity = "0";         // fades in once it has drawn (layout)
    this.container.append(this.canvas, ...this.groups);

    this.gl = this.canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true });
    if (!this.gl) throw new Error("WebGL2 is not available");
    mount.replaceChildren(this.container);

    this.initGL();
    this.readColors();
    this.bind();
    const resized = new ResizeObserver(() => this.schedule(true));
    resized.observe(mount);
    const zoomed = () => this.schedule(true);                         // a zoom changes the pixel ratio only
    window.addEventListener("resize", zoomed);
    const themed = new MutationObserver(() => { this.readColors(); this.schedule(); });
    themed.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const unsubscribe = selection.onChange(() => this.paint());
    this.unbind = () => {
      resized.disconnect();
      window.removeEventListener("resize", zoomed);
      themed.disconnect();
      unsubscribe();
    };
  }

  /** Stops following the page and the selection, once the stage has replaced it. */
  destroy() {
    this.unbind();
    clearTimeout(this.lostTimer);
    clearTimeout(this.hitTimer);
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.ready = false;
    this.gl.deleteBuffer(this.mapBuffer);
    this.gl.deleteVertexArray(this.mapVao);
    this.gl.deleteProgram(this.mapProgram.p);
  }

  /* ------------------------------- WebGL --------------------------------- */

  initGL() {
    const gl = this.gl, m = this.model;
    const text = atob(m.data), bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    const vertexBytes = m.vertexCount * m.vertexBytes;

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, bytes.subarray(0, vertexBytes), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, bytes.subarray(vertexBytes), gl.STATIC_DRAW);
    const stride = m.vertexBytes;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.UNSIGNED_SHORT, true, stride, 0);     // position
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.SHORT, true, stride, 6);              // normal
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, false, stride, 10);    // region, occlusion, seam
    gl.bindVertexArray(null);
    this.indexType = m.wideIndices ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;

    // The figure's upright axis, its height, and how far it reaches from
    // that axis in any direction, so the camera's depth range always holds
    // all of it.
    const { min, max } = m.bounds;
    this.axis = [(min[0] + max[0]) / 2, (min[2] + max[2]) / 2];
    this.height = max[1] - min[1];
    this.scale = this.height / SCULPTURE_SHOT_HEIGHT;
    this.reach = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);

    const defs = "#define REGIONS " + m.regions.length + "\n#define SEAM_MAX " +
                 m.seamMax.toFixed(3) + "\n";
    this.shade = this.program(defs + SCULPTURE_VERTEX, SCULPTURE_FRAGMENT);
    this.pick = this.program(defs + SCULPTURE_VERTEX, SCULPTURE_PICK);
    this.mapProgram = this.program(defs + CARTOGRAPHY_VERTEX, CARTOGRAPHY_FRAGMENT);
    // Retain CPU samples across context restoration; regenerate GPU objects.
    this.mapSamples = this.mapSamples || buildAnatomyCartography(m, bytes);
    this.mapVao = gl.createVertexArray();
    this.mapBuffer = gl.createBuffer();
    gl.bindVertexArray(this.mapVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.mapBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.mapSamples.data, gl.STATIC_DRAW);
    [3, 3, 3, 2].forEach((size, location) => {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 44, location * 12);
    });
    gl.bindVertexArray(null);
    this.idTarget = null;
    this.ready = true;
  }

  program(vs, fs) {
    const gl = this.gl;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, "#version 300 es\n" + src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
      const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, "");
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  }

  /* ------------------------------- camera -------------------------------- */

  /** "targets" is whichever of Front and Back the body is turned to. */
  resolve(name) { return name === "targets" ? "targets-" + this.view.id : name; }

  /** A shot's camera in this figure's units, framed for the layout. */
  shotParams(name = this.shotName) {
    const s = { ...(SCULPTURE_SHOTS[name] || SCULPTURE_SHOTS["targets-front"]) };
    if (this.mobile) {
      const fit = SCULPTURE_MOBILE[name.startsWith("targets") ? "targets" : name] || {};
      s.sx = 0.5; s.sy = 0.5;
      if (fit.ty) s.ty = fit.ty;
      if (fit.d) s.d *= fit.d;
    } else if (this.size && Math.abs(s.sx - 0.5) > 0.1) {
      const aspect = this.size.cw / this.size.ch;
      if (aspect < SCULPTURE_WIDE) s.d *= Math.pow(SCULPTURE_WIDE / aspect, 2);
    }
    s.ty *= this.scale; s.d *= this.scale;
    return s;
  }

  /** The camera now: the shot, turned by any drag. */
  live() { return this.cur ? { ...this.cur, az: this.cur.az + this.off } : this.shotParams(); }

  /**
   * The matrices that show the model through camera `s`: the eye `d` from
   * the aim point at `az` round and `el` up, a perspective lens of `fov`,
   * and the aim point moved to (`sx`, `sy`) on the canvas. Column-major.
   */
  camera(s) {
    const r = Math.PI / 180, az = s.az * r, el = s.el * r;
    const tx = this.axis[0], ty = this.model.bounds.min[1] + s.ty, tz = this.axis[1];
    const eye = [tx + s.d * Math.sin(az) * Math.cos(el), ty + s.d * Math.sin(el),
                 tz + s.d * Math.cos(az) * Math.cos(el)];
    // Forward, right and up, a right-handed frame looking at the aim point.
    let f = [tx - eye[0], ty - eye[1], tz - eye[2]];
    const fl = Math.hypot(...f); f = f.map(v => v / fl);
    let x = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0];   // f × up(0,1,0)
    const xl = Math.hypot(...x) || 1; x = x.map(v => v / xl);
    const y = [x[1] * f[2] - x[2] * f[1], x[2] * f[0] - x[0] * f[2], x[0] * f[1] - x[1] * f[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

    const W = this.size ? this.size.cw : 1, H = this.size ? this.size.ch : 1;
    const t = Math.tan(s.fov * r / 2), aspect = W / H;
    const near = Math.max(1, s.d - this.reach), far = s.d + this.reach;
    const ox = 2 * (s.sx - 0.5), oy = -2 * (s.sy - 0.5);
    // Projection, with the aim point shifted to (sx, sy): x' = x + ox·w.
    const P = [
      1 / (aspect * t), 0, 0, 0,
      0, 1 / t, 0, 0,
      -ox, -oy, (far + near) / (near - far), -1,
      0, 0, 2 * far * near / (near - far), 0
    ];
    // View: rows x, y, −f; the eye at the origin.
    const V = [
      x[0], y[0], -f[0], 0,
      x[1], y[1], -f[1], 0,
      x[2], y[2], -f[2], 0,
      -dot(x, eye), -dot(y, eye), dot(f, eye), 1
    ];
    const matrix = new Float32Array(16);
    for (let c = 0; c < 4; c++)
      for (let rr = 0; rr < 4; rr++) {
        let v = 0;
        for (let k = 0; k < 4; k++) v += P[k * 4 + rr] * V[c * 4 + k];
        matrix[c * 4 + rr] = v;
      }
    // Normals into the camera's frame, so the light follows the viewer.
    const normal = new Float32Array([x[0], y[0], -f[0], x[1], y[1], -f[1], x[2], y[2], -f[2]]);
    return { matrix, normal };
  }

  /* ------------------------------- layout -------------------------------- */

  /**
   * Batches redraws (and relayouts) into the next frame, and keeps asking
   * for frames only while a change of state is still easing in.
   */
  schedule(relayout = false) {
    this.needsLayout = this.needsLayout || relayout;
    if (this.frame) return;
    this.frame = requestAnimationFrame(now => {
      this.frame = 0;
      const dt = this.lastFrame ? Math.min(now - this.lastFrame, 200) : 16;
      if (this.needsLayout) { this.needsLayout = false; this.layout(); }
      const turning = this.stepCamera(dt);
      const moving = this.ease(dt) || turning;
      this.draw();
      this.lastFrame = moving ? now : 0;
      if (moving) this.schedule();
    });
  }

  /** The canvas fills the mount; the shot decides where the body sits in it. */
  layout() {
    if (!this.ready) return;
    const W = this.mount.clientWidth, H = this.mount.clientHeight;
    if (!W || !H) return;                          // hidden: lay out when shown again
    this.size = { cw: W, ch: H };
    // A side shot depends on the canvas's proportions: re-take it as they change.
    if (!this.cur || (!this.tween && !this.offTween)) this.cur = this.shotParams();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(W * this.dpr);
    this.canvas.height = Math.round(H * this.dpr);
    this.pickKey = null;
    if (this.calm() && this.interactive) this.renderIds(this.live(), "live");
    this.placeHitsSoon();
    if (!this.drawnOnce) {
      this.drawnOnce = true;
      requestAnimationFrame(() => { this.canvas.style.opacity = this.dim; });
    }
  }

  /* -------------------------------- moving -------------------------------- */

  /** Moves the camera to a shot (SCULPTURE_SHOTS, or "targets"). */
  setShot(name) {
    name = this.resolve(name);
    if (name === this.shotName && !this.offTween && !this.off) return;
    this.goShot(name);
  }

  /**
   * Moves the camera from where it is now to shot `name`. `dir` (+1 or −1)
   * picks the way round for a half circle, which has no shorter side.
   */
  goShot(name, dir = 0) {
    const fromName = this.shotName;
    this.shotName = name;
    this.drag = null;
    this.offTween = null;
    if (!this.cur) { this.off = 0; this.schedule(true); return; }
    const to = this.shotParams(name);
    const from = this.live();
    this.off = 0;
    let daz = ((to.az - from.az) % 360 + 540) % 360 - 180;
    if (dir && Math.abs(Math.abs(daz) - 180) < 1e-6) daz = 180 * dir;
    const viewOnly = fromName.startsWith("targets") && name.startsWith("targets");
    if (this.reducedMotion && this.reducedMotion.matches) {
      this.tween = null;
      this.cur = to;
      if (!viewOnly) this.flash();
      this.moved();
      this.settle();
      this.schedule();
      return;
    }
    const ms = viewOnly ? SCULPTURE_TURN.turn
             : Math.min(SCULPTURE_MOVE.max, SCULPTURE_MOVE.base + Math.abs(daz) * SCULPTURE_MOVE.perDegree);
    const arc = viewOnly ? 0 : Math.abs(daz) > 30 ? SCULPTURE_MOVE.arc : SCULPTURE_MOVE.arcNear;
    this.tween = { from, to: { ...to, az: from.az + daz }, t: 0, ms, arc };
    this.moved();
    this.schedule();
  }

  /** With reduced motion a new shot fades in rather than travels. */
  flash() {
    const c = this.canvas;
    c.style.transition = "none";
    c.style.opacity = "0";
    requestAnimationFrame(() => { c.style.transition = ""; c.style.opacity = this.dim; });
  }

  /**
   * Turns the body to a view on Targets: the half circle round when it
   * shows the other one (on in the direction a drag already started, so it
   * feels like walking round it), or back exactly when it was dragged off.
   */
  turnTo(view) {
    if (typeof view === "string") view = SCULPTURE_VIEWS.find(v => v.id === view);
    const half = view !== this.view;
    const dir = this.off > 0 ? 1 : -1;
    this.view = view;
    if (!this.shotName.startsWith("targets")) { this.onTurn(view.id, false); return; }
    if (half) this.goShot(this.resolve("targets"), dir);
    else this.springBack(0);
    this.onTurn(view.id, false);
  }

  /** Eases a drag's turn to `to` degrees, or shows it there at once with reduced motion. */
  springBack(to) {
    this.drag = null;
    if (to === this.off || (this.reducedMotion && this.reducedMotion.matches)) {
      this.offTween = null;
      this.off = to;
      this.moved();
      this.settle();
      this.schedule();
      return;
    }
    this.offTween = { from: this.off, to, t: 0, ms: SCULPTURE_TURN.settle };
    this.moved();
    this.schedule();
  }

  /** Moves the camera `dt` ms on; true while it is still under way. */
  stepCamera(dt) {
    const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(2 - 2 * p, 3) / 2;   // in and out
    let moving = false;
    const tw = this.tween;
    if (tw) {
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.ms), e = ease(p);
      const s = {};
      for (const k of Object.keys(tw.to)) s[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
      s.d *= 1 + tw.arc * Math.sin(Math.PI * e);
      this.cur = s;
      if (p < 1) moving = true;
      else { this.cur = { ...tw.to, az: ((tw.to.az % 360) + 540) % 360 - 180 }; this.tween = null; }
    }
    const ot = this.offTween;
    if (ot) {
      ot.t += dt;
      const p = Math.min(1, ot.t / ot.ms);
      this.off = ot.from + (ot.to - ot.from) * ease(p);
      if (p < 1) moving = true; else this.offTween = null;
    }
    if (tw || ot) {
      this.moved();
      if (!moving) this.settle();
    }
    return moving;
  }

  /** Follows the camera while it changes: nothing is pointed at, checkboxes hide. */
  moved() {
    const calm = this.calm();
    this.container.classList.toggle("turning", !calm);
    this.container.classList.toggle("off-view", Math.abs(this.off) > 0.05 || !this.shotName.startsWith("targets"));
    if (!calm && !this.focused) this.hover(null);
  }

  /**
   * The camera has come to rest: redraw the region buffer as it now sees
   * the body, so pointing works again, and pick up the muscle under a
   * pointer that waited on it.
   */
  settle() {
    this.moved();
    this.onTurn(this.view.id, Math.abs(this.off) > 0.05);
    if (!this.ready || !this.size || !this.interactive) return;   // nothing to pick off Targets
    this.renderIds(this.live(), "live");
    if (this.pointer && !this.focused) this.hover(this.muscleAt(...this.pointer));
  }

  /** True while nothing moves the camera. */
  calm() { return !this.tween && !this.offTween && !(this.drag && this.drag.active); }

  /** True while the region buffer matches what is drawn, so the pointer can use it. */
  still() { return this.calm() && this.pickKey === this.keyOf(this.live()); }

  keyOf(s) { return s ? [s.az, s.el, s.ty, s.d, s.sx, s.sy, s.fov].map(v => v.toFixed(3)).join() + "@" + (this.size ? this.size.cw + "x" + this.size.ch : "") : ""; }

  /**
   * How far a drag `offset` degrees off the view turns the body: as far as
   * the orbit, and past it only a little more, harder the further it goes.
   */
  orbitOf(offset) {
    const { orbit, give } = SCULPTURE_TURN, over = Math.abs(offset) - orbit;
    if (over <= 0) return offset;
    return Math.sign(offset) * (orbit + give * (1 - Math.exp(-over / give)));
  }

  /* --------------------------- what the page sets -------------------------- */

  /** "desktop" or "mobile": the phone frames each shot for a band above the content. */
  setLayout(mode) {
    const mobile = mode === "mobile";
    if (mobile === this.mobile) return;
    this.mobile = mobile;
    this.tween = null;
    if (this.cur) this.cur = this.shotParams();
    this.moved();
    this.schedule(true);
  }

  /** Whether the selection shows and the pointer picks (Targets only). */
  setInteractive(on) {
    on = !!on;
    if (on === this.interactive) return;
    this.interactive = on;
    this.container.classList.toggle("inert", !on);
    for (const g of this.groups) g.inert = !on;
    if (!on) { this.drag = null; this.focused = null; this.hover(null); }
    else if (this.ready && this.size && this.calm()) {
      // The region buffer is drawn only while picking can use it (settle).
      if (!this.still()) this.renderIds(this.live(), "live");
      if (this.pointer) this.hover(this.muscleAt(...this.pointer));
    }
    this.schedule();
  }

  /** Lights these muscles whatever the stage (a session pointed at); null for none. */
  setHighlight(ids) {
    const next = ids && ids.length ? new Set(ids) : null;
    const same = (a, b) => a === b || (a && b && a.size === b.size && [...a].every(id => b.has(id)));
    if (same(next, this.highlighting)) return;
    this.highlighting = next;
    this.schedule();
  }

  /** How strongly the figure shows, 0 (gone) to 1, so a busy screen can let it recede. */
  setDim(v) {
    this.dim = String(Math.max(0, Math.min(1, Number(v))));
    this.canvas.style.opacity = this.dim;
  }

  /* -------------------------------- drawing ------------------------------- */

  draw() {
    if (!this.ready || !this.size) return;
    const gl = this.gl, dpr = this.dpr;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);             // the region cuts leave slivers facing either way
    gl.useProgram(this.shade.p);
    this.setModelUniforms(this.shade.u);
    const c = this.colors, u = this.shade.u;
    gl.uniform3fv(u.uForm, c.form);
    gl.uniform3fv(u.uMuscle, c.muscle);
    gl.uniform3fv(u.uSelected, c.selected);
    gl.uniform1f(u.uSelectedGain, SCULPTURE_SELECTED_GAIN);
    gl.uniform3fv(u.uInk, c.ink);
    gl.uniform1f(u.uLineWidth, Math.max(1, 0.75 * dpr));
    gl.bindVertexArray(this.vao);
    const cam = this.camera(this.live());
    gl.uniformMatrix4fv(u.uMatrix, false, cam.matrix);
    gl.uniformMatrix3fv(u.uNormal, false, cam.normal);
    gl.uniform4fv(u.uRegion, this.regionStates(this.view.id));
    gl.drawElements(gl.TRIANGLES, this.model.indexCount, this.indexType, 0);
    this.drawCartography(cam);
    gl.bindVertexArray(null);
  }

  drawCartography(cam) {
    const gl = this.gl, { p, u } = this.mapProgram;
    gl.useProgram(p);
    gl.uniformMatrix4fv(u.uMatrix, false, cam.matrix);
    gl.uniformMatrix3fv(u.uNormal, false, cam.normal);
    gl.uniform3fv(u.uStates, this.shown || this.targets());
    gl.uniform2f(u.uSize, this.size.cw, this.size.ch);
    gl.uniform2fv(u.uPointer, this.mapPointer);
    gl.uniform1f(u.uPresence, this.mapPresence);
    gl.uniform1f(u.uPointerActive, this.pointer && !this.focused ? 1 : 0);
    gl.uniform1f(u.uDpr, this.dpr);
    gl.uniform3fv(u.uInk, this.colors.ink);
    gl.bindVertexArray(this.mapVao);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.POINTS, 0, this.mapSamples.count);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
  }

  setModelUniforms(u) {
    const { min, max } = this.model.bounds;
    this.gl.uniform3fv(u.uMin, min);
    this.gl.uniform3fv(u.uExt, [max[0] - min[0], max[1] - min[1], max[2] - min[2]]);
  }

  /* -------------------------------- state -------------------------------- */

  /**
   * Where each region is heading, as [selected, pointed at, highlighted]
   * triples: selected is 1 for a selected muscle (or the preview's share
   * while a program is pointed at, when the selection underneath is set
   * aside), pointed at is 1 for the muscle under the pointer or keyboard
   * focus, highlighted is 1 for a muscle the page lights. Off Targets only
   * the highlight shows.
   */
  targets() {
    const n = this.model.regions.length;
    const out = this.targetBuffer || (this.targetBuffer = new Float32Array(n * 3));
    for (let r = 0; r < n; r++) {
      const id = this.muscleOf[r];
      let selected = 0, pointed = 0;
      if (id && this.interactive) {
        if (this.previewing) selected = this.previewing.has(id) ? SCULPTURE_TONE.preview : 0;
        else {
          selected = this.selection.has(id) ? 1 : 0;
          pointed = id === this.hovered ? 1 : 0;
        }
      }
      out[r * 3] = selected;
      out[r * 3 + 1] = pointed;
      out[r * 3 + 2] = id && this.highlighting && this.highlighting.has(id) ? 1 : 0;
    }
    return out;
  }

  /**
   * Moves what is shown `dt` ms closer to the targets; true while anything
   * is still on its way. The first call shows the targets at once, so a
   * selection already made when the page opens does not fade in.
   */
  ease(dt) {
    const target = this.targets();
    if (!this.shown) this.shown = Float32Array.from(target);
    const shown = this.shown, instant = this.reducedMotion && this.reducedMotion.matches;
    let moving = false;
    const follow = (from, to, tau, epsilon) => {
      const next = instant ? to : from + (to - from) * (1 - Math.exp(-dt / tau));
      if (Math.abs(next - to) < epsilon) return to;
      moving = true;
      return next;
    };
    const onBody = this.interactive && this.calm() &&
      (this.focused || (this.pointer && this.regionAt(...this.pointer) >= 0));
    this.mapPresence = follow(this.mapPresence, onBody ? 1 : 0, 130, 0.005);
    if (this.pointer) for (let i = 0; i < 2; i++)
      this.mapPointer[i] = follow(this.mapPointer[i], this.pointer[i], 45, 0.1);
    for (let i = 0; i < shown.length; i++) {
      const to = target[i], from = shown[i];
      if (from === to) continue;
      const tau = i % 3 !== 1 ? SCULPTURE_EASE.select
                : to > from ? SCULPTURE_EASE.hoverIn : SCULPTURE_EASE.hoverOut;
      const next = instant ? to : from + (to - from) * (1 - Math.exp(-dt / tau));
      shown[i] = Math.abs(to - next) < 0.008 ? to : next;      // under a shade of grey
      if (shown[i] !== to) moving = true;
    }
    return moving;
  }

  /**
   * Each region as the shader reads it: its tone (0 resting … 1 selected,
   * see SCULPTURE_TONE), whether it has the keyboard focus edge in this
   * view, whether it is form rather than muscle, and how selected it is
   * (for the deeper shading and the focus edge's colour).
   */
  regionStates(viewId) {
    const n = this.model.regions.length;
    const out = this.regionBuffer || (this.regionBuffer = new Float32Array(n * 4));
    const shown = this.shown || this.targets();
    const T = SCULPTURE_TONE;
    for (let r = 0; r < n; r++) {
      const selected = shown[r * 3], pointed = shown[r * 3 + 1], lit = shown[r * 3 + 2];
      // Where pointing takes it: from `hover` when resting to `selectedHover` when selected.
      const whenPointed = T.hover + (T.selectedHover - T.hover) * selected;
      const id = this.muscleOf[r];
      const focused = !!id && !!this.focused && this.focused.view === viewId && this.focused.id === id;
      out[r * 4] = Math.max(selected + (whenPointed - selected) * pointed, T.highlight * lit);
      out[r * 4 + 1] = focused ? 1 : 0;
      out[r * 4 + 2] = this.isForm[r] ? 1 : 0;
      out[r * 4 + 3] = Math.max(selected, T.highlightDepth * lit);
    }
    return out;
  }

  /** The theme's colours (sRGB, 0–1), from the same tokens the page uses. */
  readColors() {
    const probe = document.createElement("span");
    probe.style.display = "none";
    this.container.appendChild(probe);
    const read = name => {
      probe.style.color = "var(" + name + ")";
      const color = getComputedStyle(probe).color;
      const unit = /color\(/.test(color) ? 1 : 255;
      return color.match(/[\d.]+/g).slice(0, 3).map(v => Number(v) / unit);
    };
    this.colors = {
      form: read("--sculpt-form"), muscle: read("--sculpt-muscle"),
      selected: read("--sculpt-selected"), ink: read("--ink")
    };
    probe.remove();
  }

  /* -------------------------------- picking ------------------------------- */

  /**
   * Renders each pixel's region, through camera `s`, and reads it back
   * into one of the region buffers: "live" (what is drawn, for the
   * pointer) or a view's id (that Targets view exactly, for the checkboxes).
   */
  renderIds(s, into) {
    const gl = this.gl, { cw, ch } = this.size;
    if (!this.idTarget || this.idTarget.w !== cw || this.idTarget.h !== ch) {
      if (this.idTarget) {
        gl.deleteFramebuffer(this.idTarget.fb);
        gl.deleteRenderbuffer(this.idTarget.color);
        gl.deleteRenderbuffer(this.idTarget.depth);
      }
      const fb = gl.createFramebuffer(), color = gl.createRenderbuffer(), depth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, color);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, cw, ch);
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, cw, ch);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      this.idTarget = { fb, color, depth, w: cw, h: ch, pixels: {} };
    }
    const t = this.idTarget;
    if (!t.pixels[into]) t.pixels[into] = new Uint8Array(cw * ch * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.idTarget.fb);
    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.pick.p);
    this.setModelUniforms(this.pick.u);
    gl.bindVertexArray(this.vao);
    gl.uniformMatrix4fv(this.pick.u.uMatrix, false, this.camera(s).matrix);
    gl.drawElements(gl.TRIANGLES, this.model.indexCount, this.indexType, 0);
    gl.bindVertexArray(null);
    gl.readPixels(0, 0, cw, ch, gl.RGBA, gl.UNSIGNED_BYTE, t.pixels[into]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (into === "live") this.pickKey = this.keyOf(s);
  }

  /**
   * The region under a point (CSS px from the canvas's top left) in a
   * region buffer, or -1. The live one counts only while the body is still.
   */
  regionAt(x, y, from = "live") {
    const t = this.idTarget, pixels = t && t.pixels[from];
    if (!pixels || (from === "live" && !this.still())) return -1;
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= t.w || yi >= t.h) return -1;
    return pixels[((t.h - 1 - yi) * t.w + xi) * 4] - 1;
  }

  muscleAt(x, y, from = "live") {
    const r = this.regionAt(x, y, from);
    return r < 0 ? null : this.muscleOf[r];
  }

  /**
   * The muscle closest to a point, looking outward in rings up to `reach`
   * pixels, or null. A finger that lands just beside a thin muscle takes it.
   */
  muscleNear(x, y, reach = 12) {
    // A touch on known bone/tendon must not select a neighbouring muscle.
    if (this.regionAt(x, y) >= 0) return null;
    for (let r = 3; r <= reach; r += 3) {
      const steps = Math.max(8, Math.round(r * 1.5));
      for (let i = 0; i < steps; i++) {
        const a = i / steps * 2 * Math.PI;
        const id = this.muscleAt(x + r * Math.cos(a), y + r * Math.sin(a));
        if (id) return id;
      }
    }
    return null;
  }

  /* ------------------------------ checkboxes ------------------------------ */

  /** Places the checkboxes once a resize settles; it draws and searches both views. */
  placeHitsSoon() {
    clearTimeout(this.hitTimer);
    this.hitTimer = setTimeout(() => {
      if (!this.ready || !this.size) return;
      SCULPTURE_VIEWS.forEach(view => this.renderIds(this.shotParams("targets-" + view.id), view.id));
      this.placeHits();
    }, this.hits.size ? 150 : 0);
  }

  /**
   * One focusable checkbox per muscle per view, placed well inside that
   * muscle (on the viewer's left where it shows on both sides), in
   * catalogue order so Tab walks the body predictably. A view lists a
   * muscle only where it shows a fair part of it (a tenth of its best
   * view), not a sliver at the silhouette; every muscle is in at least one.
   */
  placeHits() {
    const t = this.idTarget, { ch } = this.size;
    const shot = this.shotParams("targets-front");
    const middle = shot.sx * t.w;
    const stats = SCULPTURE_VIEWS.map(view => {
      const pixels = t.pixels[view.id], st = new Map();
      for (let yi = 0; yi < t.h; yi++)
        for (let xi = 0; xi < t.w; xi++) {
          const r = pixels[((t.h - 1 - yi) * t.w + xi) * 4] - 1;
          const id = r >= 0 ? this.muscleOf[r] : null;
          if (!id) continue;
          let s = st.get(id);
          if (!s) st.set(id, s = { n: 0, left: 0, lx: 0, ly: 0, x: 0, y: 0 });
          s.n++; s.x += xi; s.y += yi;
          if (xi < middle) { s.left++; s.lx += xi; s.ly += yi; }
        }
      return st;
    });
    // A share of the box the body fills from the front: the figure's width
    // by its height, in pixels at the Targets shot.
    const { min, max } = this.model.bounds;
    const k = ch / (2 * shot.d * Math.tan(shot.fov * Math.PI / 360));        // px per unit at the aim point
    const minPixels = Math.max(16, (max[0] - min[0]) * k * this.height * k * 0.0006);
    const best = id => Math.max(...stats.map(st => (st.get(id) || { n: 0 }).n));
    const keep = new Set();
    SCULPTURE_VIEWS.forEach((view, v) => {
      const group = this.groups[v], order = [];
      for (const muscle of this.selection.catalog) {
        const s = stats[v].get(muscle.id);
        if (!s || s.n < minPixels || s.n < best(muscle.id) * 0.1) continue;
        const useLeft = s.left >= s.n * 0.25;
        const cx = useLeft ? s.lx / s.left : s.x / s.n, cy = useLeft ? s.ly / s.left : s.y / s.n;
        const [px, py] = this.nearestPixel(muscle.id, cx, cy, view.id);
        const key = view.id + ":" + muscle.id;
        keep.add(key);
        let hit = this.hits.get(key);
        if (!hit) {
          hit = document.createElement("span");
          hit.className = "hit";
          hit.tabIndex = 0;
          hit.setAttribute("role", "checkbox");
          hit.setAttribute("aria-label", muscle.name);
          hit.dataset.muscle = muscle.id;
          hit.dataset.view = view.id;
          this.hits.set(key, hit);
        }
        hit.style.left = px + 0.5 + "px";
        hit.style.top = py + 0.5 + "px";
        order.push(hit);
      }
      // Reorder only on a real change: moving a focused element blurs it.
      const now = [...group.children];
      if (now.length !== order.length || order.some((h, i) => h !== now[i])) {
        const had = order.includes(document.activeElement) && document.activeElement;
        group.replaceChildren(...order);
        if (had) had.focus();
      }
    });
    for (const [key, hit] of this.hits)
      if (!keep.has(key)) { hit.remove(); this.hits.delete(key); }
    this.paintHits();
  }

  /**
   * The pixel of a muscle nearest (x, y) that sits well inside it (its
   * neighbours for `inset` px around are the same muscle), searching
   * outward; a thinner margin is accepted where the muscle is narrow.
   */
  nearestPixel(id, x, y, from) {
    const x0 = Math.round(x), y0 = Math.round(y);
    const inside = (px, py, inset) => {
      for (let dy = -inset; dy <= inset; dy++)
        for (let dx = -inset; dx <= inset; dx++)
          if (this.muscleAt(px + dx, py + dy, from) !== id) return false;
      return true;
    };
    for (const inset of [3, 1, 0])
      for (let r = 0; r < 80; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            if (inside(x0 + dx, y0 + dy, inset)) return [x0 + dx, y0 + dy];
          }
    return [x0, y0];
  }

  paintHits() {
    for (const hit of this.hits.values()) {
      const on = this.selection.has(hit.dataset.muscle);
      hit.classList.toggle("on", on);
      hit.setAttribute("aria-checked", on ? "true" : "false");
    }
  }

  /* -------------------------------- input -------------------------------- */

  bind() {
    const local = e => {
      const r = this.canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    // A finger that lands just beside a thin muscle (adductors, forearms)
    // takes the nearest one. Mouse clicks stay exact.
    let pointerType = "mouse", dragged = false;
    this.canvas.addEventListener("pointerdown", e => {
      pointerType = e.pointerType;
      dragged = false;
      if (!this.interactive || (pointerType === "mouse" && e.button !== 0)) return;
      this.pointer = local(e);
      // A press may become a drag that turns the body, but not while the
      // camera travels on its own.
      if (!this.tween)
        this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, from: this.off, active: false };
      if (pointerType === "touch") this.hover(this.muscleAt(...local(e)) || this.muscleNear(...local(e)));
    });
    this.canvas.addEventListener("pointermove", e => {
      this.pointer = local(e);
      if (!this.interactive) return;
      const d = this.drag;
      if (d && d.id === e.pointerId) {
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!d.active && Math.abs(dx) >= SCULPTURE_TURN.slop && Math.abs(dx) > Math.abs(dy)) {
          d.active = true;
          this.offTween = null;
          this.canvas.setPointerCapture(e.pointerId);
        }
        if (d.active) {
          // Dragging right turns the body's front to the right, as if
          // turning it by hand: the camera goes the other way round.
          this.off = this.orbitOf(d.from - dx * SCULPTURE_TURN.perPx);
          this.canvas.style.cursor = "grabbing";
          this.moved();
          this.schedule();
          return;
        }
      }
      const id = this.muscleAt(...this.pointer);
      this.canvas.style.cursor = id ? "pointer" : "grab";
      if (this.still()) this.hover(id);
      this.schedule();                     // density follows motion within a muscle too
    });
    const release = e => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      if (!d.active) return;
      dragged = true;
      // Past the orbit it springs back to it; inside it, it stays.
      const { orbit } = SCULPTURE_TURN;
      this.springBack(Math.max(-orbit, Math.min(orbit, this.off)));
    };
    this.canvas.addEventListener("pointerup", release);
    this.canvas.addEventListener("pointercancel", release);
    this.canvas.addEventListener("pointerleave", () => {
      this.pointer = null;
      if (!this.drag || !this.drag.active) this.hover(null);
      this.schedule();
    });
    this.canvas.addEventListener("click", e => {
      if (dragged || !this.interactive) return;    // the end of a drag, not a click
      let id = this.muscleAt(...local(e));
      if (!id && pointerType === "touch") id = this.muscleNear(...local(e));
      if (id) this.selection.toggle(id);
    });

    this.container.addEventListener("keydown", e => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const hit = e.target.closest && e.target.closest(".hit");
      if (!hit || !this.interactive) return;
      e.preventDefault();
      this.selection.toggle(hit.dataset.muscle);
    });
    // Keyboard focus only: a tap would otherwise leave a muscle stuck lit.
    // A muscle on the other side turns the body round to it, and one on
    // this side returns it exactly to the view its checkbox was placed in.
    this.container.addEventListener("focusin", e => {
      if (!e.target.matches || !e.target.matches(".hit:focus-visible") || !this.interactive) return;
      this.focused = { view: e.target.dataset.view, id: e.target.dataset.muscle };
      this.hover(this.focused.id);
      const view = SCULPTURE_VIEWS.find(v => v.id === this.focused.view);
      if (view !== this.view || this.off) this.turnTo(view);
      this.schedule();
    });
    this.container.addEventListener("focusout", e => {
      if (e.relatedTarget && e.relatedTarget.matches && e.relatedTarget.matches(".anatomy-sculpture .hit")) return;
      this.focused = null;
      this.hover(null);
      this.schedule();
    });

    // A lost context usually comes back within moments. If it does not, or
    // comes back unusable, hand over (onFail) rather than stay blank.
    this.canvas.addEventListener("webglcontextlost", e => {
      e.preventDefault();
      this.ready = false;
      this.lostTimer = setTimeout(() => this.onFail(), SCULPTURE_RESTORE_MS);
    });
    this.canvas.addEventListener("webglcontextrestored", () => {
      clearTimeout(this.lostTimer);
      try {
        this.initGL();
      } catch (e) {
        console.warn("The sculpture could not restore its WebGL context.", e);
        this.onFail();
        return;
      }
      this.schedule(true);
    });
  }

  hover(id) {
    const at = id && this.pointer && !this.focused ? this.regionAt(...this.pointer) : -1;
    const region = at >= 0 && this.muscleOf[at] === id ? this.model.regions[at] : null;
    if (id === this.hovered && region === this.hoveredRegion) return;
    this.hovered = id;
    this.hoveredRegion = region;
    this.onHover(id ? MUSCLE_BY_ID.get(id) : null, region);
    this.schedule();
  }

  /**
   * Shows what a program would select without changing anything, while its
   * button is pointed at. Pass null to go back to the real selection.
   */
  preview(ids) {
    this.previewing = ids ? new Set(ids) : null;
    this.schedule();
  }

  /** Redraws from the selection. */
  paint() {
    this.paintHits();
    this.schedule();
  }
}

/* -------------------------------- shaders -------------------------------- */

const SCULPTURE_VERTEX = `
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aOct;
layout(location = 2) in vec4 aAttr;       // region, occlusion, seam distance, spare
uniform vec3 uMin, uExt;
uniform mat4 uMatrix;
uniform mat3 uNormal;
uniform vec4 uRegion[REGIONS];            // tone, focus edge, form, selected (regionStates)
uniform vec3 uForm, uMuscle, uSelected;   // surfaces before light, sRGB
out vec3 vNormal;
out float vOcclusion;
out float vSeam;
flat out vec3 vAlbedo;                    // linear
flat out float vSelected;
flat out float vFocus;
flat out float vRegionId;
flat out float vMap;

vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 octDecode(vec2 e) {
  vec3 v = vec3(e, 1.0 - abs(e.x) - abs(e.y));
  if (v.z < 0.0) v.xy = (1.0 - abs(v.yx)) * vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0);
  return normalize(v);
}

void main() {
  gl_Position = uMatrix * vec4(uMin + aPos * uExt, 1.0);
  vNormal = uNormal * octDecode(aOct);
  vOcclusion = aAttr.y / 255.0;
  vSeam = aAttr.z / 255.0 * SEAM_MAX;
  vec4 region = uRegion[int(aAttr.x + 0.5)];
  float tone = region.z > 0.5 ? 0.0 : region.x;
  vAlbedo = toLinear(region.z > 0.5 ? uForm : mix(uMuscle, uSelected, tone * 0.07));
  vSelected = region.z > 0.5 ? 0.0 : region.w * 0.08;
  vMap = region.z > 0.5 ? 0.0 : max(region.x, region.y);
  vFocus = region.y;
  vRegionId = aAttr.x;
}`;

/* Light that carves: a raking key from the upper left whose edge between
   light and shade is firm enough to model every belly and valley, a weak
   fill from the right, a low sky-to-ground ambient, and the baked occlusion
   for creases and hollows. It follows the viewer. No highlights: the
   finish is matte, like plaster or stone. */
const SCULPTURE_FRAGMENT = `
precision highp float;
in vec3 vNormal;
in float vOcclusion;
in float vSeam;
flat in vec3 vAlbedo;
flat in float vSelected;
flat in float vFocus;
flat in float vRegionId;
flat in float vMap;
uniform vec3 uInk;                       // sRGB
uniform float uSelectedGain;
uniform float uLineWidth;
out vec4 outColor;

vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 key = normalize(vec3(-0.55, 0.62, 0.56));
  vec3 fill = normalize(vec3(0.75, 0.05, 0.62));
  float k = clamp((dot(n, key) + 0.12) / 1.12, 0.0, 1.0);
  k = mix(k, k * k * (3.0 - 2.0 * k), 0.5);
  float f = clamp((dot(n, fill) + 0.2) / 1.2, 0.0, 1.0);
  float sky = 0.5 + 0.5 * n.y;
  float light = 0.2 + 0.12 * sky + 0.74 * k + 0.12 * f;
  // Surfaces turning away darken a little, as a matte sculpture does.
  float turn = mix(0.8, 1.0, sqrt(max(n.z, 0.0)));
  float shade = light * turn * mix(1.0, vOcclusion, 0.95);
  vec3 c = vAlbedo * pow(shade, mix(1.0, uSelectedGain, vSelected));

  // Anatomical seams: a thin, darker line where regions meet, the same
  // width on screen at any size.
  float px = vSeam / max(fwidth(vSeam), 1e-4);
  float near = 1.0 - smoothstep(0.2, 0.45, vSeam);
  float seam = (1.0 - smoothstep(uLineWidth - 0.6, uLineWidth + 0.6, px)) * near;
  // Deepest in real creases; only a trace where the surface runs smooth
  // across a boundary, so it never reads as a panel line.
  c *= 1.0 - mix(0.12, 0.05, smoothstep(0.85, 1.0, vOcclusion)) * seam;

  // Survey contours follow distance to the AUTHORED border. Their ends
  // fade before the stored seam distance saturates; never invent interior
  // muscle divisions or connect lines across bone, tendon, or empty space.
  float interval = 0.85;
  float phase = vSeam / interval;
  float contourPx = abs(fract(phase + 0.5) - 0.5) / max(fwidth(phase), 1e-4);
  float contour = (1.0 - smoothstep(0.3, 0.85, contourPx)) *
                  (1.0 - smoothstep(1.8, 2.5, vSeam));
  float mapped = max(seam * 0.5, contour * 0.2) * vMap;
  c = mix(c, toLinear(uInk), mapped);

  // Keyboard focus keeps a strong edge independent of point density.
  float ring = (1.0 - smoothstep(2.4 * uLineWidth - 0.6, 2.4 * uLineWidth + 0.6, px)) *
               (1.0 - smoothstep(0.5, 0.8, vSeam)) * vFocus;
  c = mix(c, toLinear(uInk), ring);
  outColor = vec4(toSrgb(c), 1.0);
}`;

/* The picking pass: each pixel's region (+1, so 0 is empty). */
const SCULPTURE_PICK = `
precision highp float;
flat in float vRegionId;
out vec4 outColor;
void main() {
  outColor = vec4((vRegionId + 1.0) / 255.0, 0.0, 0.0, 1.0);
}`;
