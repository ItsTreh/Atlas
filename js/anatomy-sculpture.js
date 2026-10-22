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
   Fine surface currents resolve across the pointed muscle group.
   Exact anatomical regions remain available for future detailed views. Selection retains
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

// How long the size must stay put before a resize counts as done: the
// region buffer and the checkboxes are drawn again only then. A size change
// within this time of the last one continues a resize (resizing).
const SCULPTURE_RESIZE_QUIET_MS = 150;

// How far in from each edge of the canvas the side rails reach on Targets
// (the page's 48 px padding and a 320 px rail, css/styles.css), plus 4 px
// of air: the hover label keeps between the body and that line.
const SCULPTURE_LABEL_CLEAR = 372;

/* Relative strength of the map's contours. The shader leaves only a trace
   of surface tint, so the same material models every state. Program
   previews light muscles (the lit channel) and sessions draw as a hover,
   neither changing the selection itself. */
const SCULPTURE_TONE = { hover: 0.32, selectedHover: 0.78, highlight: 0.62, highlightDepth: 0.4 };

/* A small amount of modelling under selection; the vertex shader attenuates
   the selection weight so cartography, rather than a solid fill, leads. */
const SCULPTURE_SELECTED_GAIN = 1.4;

/* How fast the drawing follows a change, as time constants (ms) of an
   exponential ease: a muscle answers the pointer almost at once, eases
   back when left, and a selection settles in between. With reduced
   motion, changes are drawn at once. Lit muscles draw their traces in
   along their length once, over `reveal`, then rest. */
const SCULPTURE_EASE = { hoverIn: 100, hoverOut: 160, select: 130, reveal: 720 };

/* Families whose summary preview draws its traces in the family's hue
   (`--<family>-trace`), as a hover rather than a lit preview. */
const SCULPTURE_TINTED = ["push", "pull", "legs", "core"];

/* What the shaders know about each region and each flow guide, as rows of a
   float texture: one RGBA texel per region (or guide) in each row, read with
   texelFetch(uData, ivec2(index, ROW_…), 0). Not uniform arrays: WebGL2
   guarantees only 224 uniform vectors to a fragment shader and 256 to a
   vertex shader, and arrays would spend them per region, so finer regions
   would stop compiling on low-end GPUs (tests/shader-budget.test.js). The
   per-frame rows come first, so one upload sends them (uploadData). */
const SCULPTURE_DATA_ROWS = {
  state: 0,        // tone, focus edge, form, selected (regionStates); every frame
  map: 1,          // selected, pointed at, lit (shown), then the family tint; every frame
  center: 2,       // flow field centre, then its scale (buildAnatomyFlowFrames)
  axis: 3,         // flow field axis, then its length
  ink: 4,          // the family's hue (sRGB), then the region's guide slot (buildAnatomyFlowGuides)
  guideOrigin: 5,  // per guide from here on, not per region
  guideAcross: 6,
  guideAlong: 7
};
const SCULPTURE_DATA_FRAME_ROWS = 2;

/** The rows as GLSL defines: ROW_STATE, ROW_MAP, … ROW_GUIDE_ALONG. */
function sculptureDataDefines() {
  return Object.entries(SCULPTURE_DATA_ROWS).map(([name, row]) =>
    "#define ROW_" + name.replace(/[A-Z]/g, c => "_" + c).toUpperCase() + " " + row + "\n").join("");
}

/**
 * Writes items of `size` floats (1, 3 or 4) from `values` into one row of
 * the data texture's texels: item i at texel i, from component `at` on.
 */
function writeSculptureData(texels, width, row, values, size, at = 0) {
  const count = values.length / size;
  if (count > width) throw new Error("Sculpture data row " + row + " holds " + width + " items, not " + count);
  for (let i = 0; i < count; i++)
    for (let c = 0; c < size; c++) texels[(row * width + i) * 4 + at + c] = values[i * size + c];
}

/** True when two Sets of muscle ids (or nulls) hold the same ids. */
function sameMuscleSet(a, b) {
  return a === b || !!(a && b && a.size === b.size && [...a].every(id => b.has(id)));
}

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
   * @param opts.detailMode opt in to exact-region hover for a detailed view
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
    this.detailMode = !!opts.detailMode;     // training groups by default; precise picking is retained
    this.mapPresence = 0;
    this.mapPointer = [0, 0];
    this.mapInfluence = 0;
    this.litReveal = 1;                      // 0 … 1 as newly lit muscles draw in
    this.previewFamily = null;               // a tinted family while its summary row is pointed at
    this.tintShown = null;                   // per region, 0 … 1 toward its family's hue
    this.flowTime = 0;
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
    this.resizedAt = -Infinity;              // when the size last changed (resizing)
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
    this.mapAnnotation = document.createElement("div");
    this.mapAnnotation.className = "cartography-annotation";
    this.mapAnnotation.setAttribute("aria-hidden", "true"); // the caption announces the same information
    this.mapAnnotation.innerHTML = '<svg class="cartography-leader"><path/><circle r="2"/></svg>' +
      '<div class="cartography-label"><span class="cartography-label-group"></span>' +
      '<span class="cartography-label-name"></span><span class="cartography-label-action"></span></div>';
    this.container.append(this.canvas, this.mapAnnotation, ...this.groups);

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
    const resume = () => this.schedule();
    document.addEventListener("visibilitychange", resume);
    if (this.reducedMotion) this.reducedMotion.addEventListener("change", resume);
    const unsubscribe = selection.onChange(() => this.paint());
    this.unbind = () => {
      resized.disconnect();
      window.removeEventListener("resize", zoomed);
      themed.disconnect();
      document.removeEventListener("visibilitychange", resume);
      if (this.reducedMotion) this.reducedMotion.removeEventListener("change", resume);
      unsubscribe();
    };
  }

  /** Stops following the page and the selection, once the stage has replaced it. */
  destroy() {
    this.unbind();
    clearTimeout(this.lostTimer);
    clearTimeout(this.hitTimer);
    clearTimeout(this.pickTimer);
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.ready = false;
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

    // Shape frames use area-weighted samples, retained across context recovery.
    // The samples only shape the frames and guides, which a restored context
    // keeps; they are not held after (14,000 samples, about 0.7 MB).
    if (!this.flowFrames || !this.flowGuides) {
      const samples = buildAnatomyCartography(m, bytes);
      this.flowFrames = this.flowFrames || buildAnatomyFlowFrames(m, samples);
      this.flowGuides = this.flowGuides || buildAnatomyFlowGuides(m, samples);
    }
    // The regions' and guides' data, one texel each per row (SCULPTURE_DATA_ROWS).
    const rows = Object.keys(SCULPTURE_DATA_ROWS).length;
    const width = Math.max(1, m.regions.length, this.flowGuides.origins.length / 4);
    if (width > gl.getParameter(gl.MAX_TEXTURE_SIZE)) throw new Error("The figure has more regions than this GPU's textures hold");
    this.data = { texture: gl.createTexture(), width, rows, texels: new Float32Array(width * rows * 4), fresh: false };
    gl.bindTexture(gl.TEXTURE_2D, this.data.texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, width, rows);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);   // complete without mipmaps
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const defs = "#define SEAM_MAX " + m.seamMax.toFixed(3) + "\n" + sculptureDataDefines() + flowGuideDefines();
    this.shade = this.program(defs + SCULPTURE_VERTEX, defs + SCULPTURE_FRAGMENT);
    this.pick = this.program(defs + SCULPTURE_VERTEX, SCULPTURE_PICK);
    gl.bindVertexArray(null);
    this.idTarget = null;
    this.pickKey = null;                     // no region buffer, so none matches the camera
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

  /**
   * How much larger the body shows now than on Targets. The traces grow
   * with it, half in count and half in weight, so a closer camera keeps
   * Targets' balance of line and gap instead of spreading thin lines apart.
   */
  traceScale() {
    const now = this.live(), ref = this.shotParams("targets-front");
    const span = s => s.d * Math.tan(s.fov * Math.PI / 360);
    return Math.min(2.5, Math.max(0.7, span(ref) / span(now)));
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
   * Batches redraws into the next frame. State changes settle; active pointer
   * exploration keeps a gentle material current moving until the pointer leaves.
   */
  schedule(relayout = false) {
    this.needsLayout = this.needsLayout || relayout;
    if (this.frame) return;
    this.frame = requestAnimationFrame(now => {
      this.frame = 0;
      const dt = this.lastFrame ? Math.min(now - this.lastFrame, 200) : 16;
      if (this.needsLayout) { this.needsLayout = false; this.layout(); }
      const turning = this.stepCamera(dt);
      const easing = this.ease(dt);
      const flowing = this.flowing();
      if (flowing) this.flowTime += dt / 1000;
      const moving = easing || turning || flowing;
      this.draw();
      this.lastFrame = moving ? now : 0;
      if (moving) this.schedule();
    });
  }

  /**
   * The surface moves only during exploration, or while the page highlights
   * muscles (a session pointed at, drawn as a hover); resting selections
   * stay still.
   */
  flowing(visible = !document.hidden) {
    const exploring = this.interactive && this.hovered && this.pointer && !this.focused && !this.previewing;
    const showing = this.highlighting || (this.interactive && this.previewFamily);
    return !!(this.ready && (exploring || showing) && this.calm() && visible &&
      !(this.reducedMotion && this.reducedMotion.matches));
  }

  /** The canvas fills the mount; the shot decides where the body sits in it. */
  layout() {
    if (!this.ready) return;
    const W = this.mount.clientWidth, H = this.mount.clientHeight;
    if (!W || !H) return;                          // hidden: lay out when shown again
    const resizing = this.resizing(W, H);
    this.size = { cw: W, ch: H };
    // A side shot depends on the canvas's proportions: re-take it as they
    // change. A move under way keeps going, to the shot as this size frames
    // it (its angle stays the way round the move already took).
    if (!this.cur || (!this.tween && !this.offTween)) this.cur = this.shotParams();
    else if (this.tween) this.tween.to = { ...this.shotParams(this.shotName), az: this.tween.to.az };
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(W * this.dpr);
    this.canvas.height = Math.round(H * this.dpr);
    // The region buffer is in CSS px: a layout that keeps the size and the
    // shot (a zoom, the window's second resize event) leaves it current.
    if (resizing) this.pickSoon();
    else if (!this.pickTimer && this.calm() && this.interactive && !this.still()) this.renderIds(this.live(), "live");
    this.placeHitsSoon();
    if (!this.drawnOnce) {
      this.drawnOnce = true;
      requestAnimationFrame(() => { this.canvas.style.opacity = this.dim; });
    }
  }

  /**
   * True when a layout of W × H continues a resize: the size changes again
   * within SCULPTURE_RESIZE_QUIET_MS of its last change. Reading the whole
   * region buffer back on every step of a dragged window edge drops frames,
   * so those steps wait (pickSoon). The first change of a resize, and every
   * layout that keeps the size (the first frame, a zoom, a restored
   * context, the phone framing), read it at once if it no longer matches,
   * unless a resize is already waiting: a window resize lays out twice
   * (ResizeObserver and the window's own event), and the second, at the
   * size already laid out, joins the wait without restarting it.
   */
  resizing(W, H, now = performance.now()) {
    if (!this.size || (this.size.cw === W && this.size.ch === H)) return false;
    const going = now - this.resizedAt < SCULPTURE_RESIZE_QUIET_MS;
    this.resizedAt = now;
    return going;
  }

  /**
   * Draws the region buffer once a resize has been still for
   * SCULPTURE_RESIZE_QUIET_MS. Each step restarts the wait, so only the
   * last size is read, through the camera and at the size of that moment,
   * never those the wait began with. Until then the buffer doesn't match
   * the canvas (still() is false), so the pointer picks nothing rather than
   * the wrong muscle. A wait that ends while something else will draw the
   * buffer anyway (a layout due, the camera moving, off Targets) leaves it
   * to that.
   */
  pickSoon() {
    clearTimeout(this.pickTimer);
    this.pickTimer = setTimeout(() => {
      this.pickTimer = 0;
      if (!this.ready || !this.size || this.needsLayout || !this.interactive || !this.calm() || this.still()) return;
      this.renderIds(this.live(), "live");
      if (this.pointer && !this.focused) this.hover(this.muscleAt(...this.pointer));
    }, SCULPTURE_RESIZE_QUIET_MS);
  }

  /* -------------------------------- moving -------------------------------- */

  /** Moves the camera to a shot (SCULPTURE_SHOTS, or "targets"). */
  setShot(name) {
    name = this.resolve(name);
    if (name === this.shotName && !this.offTween && !this.off) return;
    this.goShot(name);
    if (this.hitsDue && name.startsWith("targets")) this.placeHitsSoon();
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
    if (!this.still()) this.renderIds(this.live(), "live");      // back where the buffer was drawn: still current
    if (this.pointer && !this.focused) this.hover(this.muscleAt(...this.pointer));
  }

  /** How long, in ms, until the camera stops: what is left of the move and of a turn. */
  moveRemaining() {
    const left = tw => tw ? Math.max(0, tw.ms - tw.t) : 0;
    return Math.max(left(this.tween), left(this.offTween));
  }

  /** True while nothing moves the camera. */
  calm() { return !this.tween && !this.offTween && !(this.drag && this.drag.active); }

  /** True while the region buffer matches what is drawn, so the pointer can use it. */
  still() { return this.calm() && this.pickKey === this.keyOf(this.live()); }

  /* The camera that drew a region buffer, and the canvas size. The angle is
     taken round to −180…180, so a turn that ends at −180° (stepCamera) and
     the shot's own 180° are one camera, not a second read of the buffer. */
  keyOf(s) {
    if (!s) return "";
    const az = ((s.az % 360) + 540) % 360 - 180;
    return [az, s.el, s.ty, s.d, s.sx, s.sy, s.fov].map(v => v.toFixed(3)).join() + "@" +
      (this.size ? this.size.cw + "x" + this.size.ch : "");
  }

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
    if (sameMuscleSet(next, this.highlighting)) return;
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
    gl.uniform3fv(u.uMapInk, c.mapInk);
    gl.uniform1f(u.uTraceVivid, c.vivid);
    gl.uniform1f(u.uBorder, this.interactive ? 1 : 0);
    gl.uniform1f(u.uTraceScale, this.traceScale());
    this.uploadData();
    gl.uniform2fv(u.uMapPointer, this.mapPointer);
    gl.uniform2f(u.uMapSize, this.size.cw, this.size.ch);
    gl.uniform1f(u.uMapPointerActive, this.pointer && !this.focused ? 1 : 0);
    gl.uniform1f(u.uMapInfluence, this.mapInfluence);
    gl.uniform1f(u.uLitReveal, 1 - Math.pow(1 - this.litReveal, 3));
    gl.uniform1f(u.uPointedRegion, this.pointedRegionIndex());
    gl.uniform1f(u.uDetailed, this.detailMode ? 1 : 0);
    gl.uniform1f(u.uFlowTime, this.flowTime);
    gl.uniform1f(u.uDpr, this.dpr);
    gl.uniform1f(u.uLineWidth, Math.max(1, 0.75 * dpr));
    gl.bindVertexArray(this.vao);
    const cam = this.camera(this.live());
    gl.uniformMatrix4fv(u.uMatrix, false, cam.matrix);
    gl.uniformMatrix3fv(u.uNormal, false, cam.normal);
    gl.drawElements(gl.TRIANGLES, this.model.indexCount, this.indexType, 0);
    // Surface traces share the sculpture's material, lighting and exact depth.
    this.drawAnnotation();
    gl.bindVertexArray(null);
  }

  drawAnnotation() {
    const root = this.mapAnnotation, muscle = MUSCLE_BY_ID.get(this.hovered);
    const shot = this.live(), { cw, ch } = this.size;
    const bounds = this.model.bounds;
    const k = ch / (2 * shot.d * Math.tan(shot.fov * Math.PI / 360));
    const halfWidth = (bounds.max[0] - bounds.min[0]) * k * 0.5;
    // Only use the space between the sculpture and rails; small screens keep
    // the existing caption instead of putting a floating panel over the body.
    const width = Math.min(174, cw * 0.5 - SCULPTURE_LABEL_CLEAR - halfWidth - 24);
    const show = muscle && this.interactive && this.calm() && !this.previewing &&
      !this.mobile && width >= 124 && (this.pointer || this.focused);
    root.classList.toggle("visible", !!show);
    if (!show) return;
    let anchor = this.mapPointer;
    if (this.focused) {
      const hit = this.hits.get(this.focused.view + ":" + this.focused.id);
      if (!hit) { root.classList.remove("visible"); return; }
      anchor = [parseFloat(hit.style.left), parseFloat(hit.style.top)];
    }
    const center = shot.sx * cw, left = anchor[0] < center;
    const x = left ? center - halfWidth - 24 - width : center + halfWidth + 24;
    const y = Math.max(100, Math.min(ch - 170, anchor[1] - 18));
    // Drawn with every frame while the traces flow: write only what changed.
    const drawn = [muscle.id, this.hoveredRegion, this.detailMode, this.selection.has(muscle.id),
      width, x, y, anchor[0], anchor[1]].join();
    if (drawn === this.annotationDrawn) return;
    this.annotationDrawn = drawn;
    const label = root.querySelector(".cartography-label");
    label.style.width = width + "px";
    label.style.transform = "translate(" + x + "px," + y + "px)";
    const name = this.detailMode && this.hoveredRegion ? this.hoveredRegion.replace(/-/g, " ") : muscle.name;
    root.querySelector(".cartography-label-group").textContent =
      (this.detailMode ? muscle.name + " / " : "") + FAMILIES[muscle.family].name;
    root.querySelector(".cartography-label-name").textContent = name;
    root.querySelector(".cartography-label-action").textContent = this.selection.has(muscle.id)
      ? "Selected · click to remove" : "Click to select";
    const end = left ? x + width : x;
    root.querySelector("path").setAttribute("d", "M" + anchor[0] + " " + anchor[1] +
      " L" + (end + (left ? 16 : -16)) + " " + y + " H" + end);
    const dot = root.querySelector("circle");
    dot.setAttribute("cx", anchor[0]); dot.setAttribute("cy", anchor[1]);
  }

  setModelUniforms(u) {
    const { min, max } = this.model.bounds;
    this.gl.uniform3fv(u.uMin, min);
    this.gl.uniform3fv(u.uExt, [max[0] - min[0], max[1] - min[1], max[2] - min[2]]);
  }

  /**
   * Sends the shaders their per-region and per-guide data (SCULPTURE_DATA_ROWS):
   * the rows that change with every frame each draw, the flow fields, guides
   * and hues only after initGL or a theme change (readColors) has marked
   * them stale.
   */
  uploadData() {
    const gl = this.gl, d = this.data, R = SCULPTURE_DATA_ROWS, w = d.width, t = d.texels;
    writeSculptureData(t, w, R.state, this.regionStates(this.view.id), 4);
    writeSculptureData(t, w, R.map, this.shown || this.targets(), 3);
    writeSculptureData(t, w, R.map, this.tintShown || this.tintTargets(), 1, 3);
    if (!d.fresh) {
      writeSculptureData(t, w, R.center, this.flowFrames.centers, 4);
      writeSculptureData(t, w, R.axis, this.flowFrames.axes, 4);
      writeSculptureData(t, w, R.ink, this.colors.regionInk, 3);
      writeSculptureData(t, w, R.ink, this.flowGuides.regions, 1, 3);
      writeSculptureData(t, w, R.guideOrigin, this.flowGuides.origins, 4);
      writeSculptureData(t, w, R.guideAcross, this.flowGuides.across, 4);
      writeSculptureData(t, w, R.guideAlong, this.flowGuides.along, 4);
    }
    gl.bindTexture(gl.TEXTURE_2D, d.texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, d.fresh ? SCULPTURE_DATA_FRAME_ROWS : d.rows,
                     gl.RGBA, gl.FLOAT, t, 0);
    d.fresh = true;
  }

  pointedRegionIndex() {
    return this.hoveredRegion ? this.model.regions.indexOf(this.hoveredRegion) : -1;
  }

  /** Preserve precise-region exploration for a future zoom view; no UI toggle yet. */
  setDetailMode(enabled) {
    this.detailMode = !!enabled;
    this.onHover(MUSCLE_BY_ID.get(this.hovered) || null, this.hoveredRegion, this.detailMode);
    this.schedule();
  }

  /* -------------------------------- state -------------------------------- */

  /**
   * Where each region is heading, as [selected, pointed at, lit] triples:
   * selected is 1 for a selected muscle, pointed at is 1 for the muscle
   * under the pointer or keyboard focus, both are 1 for the muscles the
   * page highlights (a session pointed at reads as a selected group hovered
   * on Targets), lit is 1 for a muscle a program pointed at would work. While a program is pointed at, selected
   * muscles outside it are set aside. Off Targets only the highlight shows.
   */
  targets() {
    const n = this.model.regions.length;
    const out = this.targetBuffer || (this.targetBuffer = new Float32Array(n * 3));
    for (let r = 0; r < n; r++) {
      const id = this.muscleOf[r];
      let selected = 0, pointed = 0, lit = 0;
      if (id && this.interactive) {
        selected = this.selection.has(id) ? 1 : 0;
        if (this.previewing) {
          const shown = this.previewing.has(id) ? 1 : 0;
          selected *= shown;
          if (this.previewFamily) pointed = shown; else lit = shown;
        } else pointed = id === this.hovered ? 1 : 0;
      }
      // A session reads as a selected group hovered on Targets: still traces
      // under the moving ones (the border is Targets' alone, uBorder).
      if (id && this.highlighting && this.highlighting.has(id)) selected = pointed = 1;
      out[r * 3] = selected;
      out[r * 3 + 1] = pointed;
      out[r * 3 + 2] = lit;
    }
    return out;
  }

  /**
   * Per region, 1 where its traces take its family's hue: a family row in
   * the summary, or a session the page highlights, each muscle in its own
   * family's hue (a mixed session shows its families side by side).
   */
  tintTargets() {
    const n = this.model.regions.length;
    const out = this.tintBuffer || (this.tintBuffer = new Float32Array(n));
    for (let r = 0; r < n; r++) {
      const id = this.muscleOf[r];
      out[r] = id && ((this.interactive && this.previewFamily && this.previewing.has(id)) ||
        (this.highlighting && this.highlighting.has(id))) ? 1 : 0;
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
    const responding = onBody && this.pointer && !this.focused && !this.previewing && !instant;
    this.mapInfluence = follow(this.mapInfluence || 0, responding ? 1 : 0, 110, 0.005);
    // The traces lean toward the pointer only while it responds; otherwise
    // the point just follows it, without frames of its own.
    if (this.pointer) for (let i = 0; i < 2; i++)
      this.mapPointer[i] = responding || this.mapInfluence > 0
        ? follow(this.mapPointer[i], this.pointer[i], 45, 0.1) : this.pointer[i];
    if (this.tintTargets) {                // the hue comes and goes with the hover
      const tint = this.tintTargets();
      if (!this.tintShown) this.tintShown = Float32Array.from(tint);
      for (let r = 0; r < tint.length; r++) if (this.tintShown[r] !== tint[r])
        this.tintShown[r] = follow(this.tintShown[r], tint[r],
          tint[r] > this.tintShown[r] ? SCULPTURE_EASE.hoverIn : SCULPTURE_EASE.hoverOut, 0.005);
    }
    if (this.litReveal < 1) {
      this.litReveal = instant ? 1 : Math.min(1, this.litReveal + dt / SCULPTURE_EASE.reveal);
      if (this.litReveal < 1) moving = true;
    }
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
      selected: read("--sculpt-selected"), ink: read("--ink"), mapInk: read("--cartography-ink"),
      // Each region's family hue, or the map ink where it has none.
      regionInk: new Float32Array(this.muscleOf.length * 3),
      vivid: parseFloat(getComputedStyle(this.container).getPropertyValue("--trace-vivid")) || 0
    };
    const families = Object.fromEntries(SCULPTURE_TINTED.map(f => [f, read("--" + f + "-trace")]));
    this.muscleOf.forEach((id, r) => {
      const muscle = id && MUSCLE_BY_ID.get(id);
      this.colors.regionInk.set((muscle && families[muscle.family]) || this.colors.mapInk, r * 3);
    });
    probe.remove();
    if (this.data) this.data.fresh = false;     // the hues are in the data texture
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
      this.pickKey = null;                 // the live buffer went with the old target
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
    gl.bindTexture(gl.TEXTURE_2D, this.data.texture);   // the shared vertex shader reads it
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

  /**
   * Places the checkboxes once a resize settles; it draws and searches both
   * views. Off Targets they are inert, so a resize there (the phone's band
   * changes height with every stage) only marks them due, for when the
   * camera comes back to Targets (setShot). A size they were placed for
   * already keeps them.
   */
  placeHitsSoon() {
    clearTimeout(this.hitTimer);
    if (this.hits.size && !this.shotName.startsWith("targets")) { this.hitsDue = true; return; }
    this.hitsDue = false;
    this.hitTimer = setTimeout(() => {
      if (!this.ready || !this.size) return;
      const key = this.size.cw + "x" + this.size.ch + (this.mobile ? ":mobile" : "");
      if (this.hits.size && key === this.hitsKey) return;
      SCULPTURE_VIEWS.forEach(view => this.renderIds(this.shotParams("targets-" + view.id), view.id));
      this.placeHits();
      this.hitsKey = key;
      // Only placing reads the two views' buffers: no need to hold them.
      delete this.idTarget.pixels.front;
      delete this.idTarget.pixels.back;
    }, this.hits.size ? SCULPTURE_RESIZE_QUIET_MS : 0);
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
      const region = this.regionAt(...this.pointer), id = region < 0 ? null : this.muscleOf[region];
      this.canvas.style.cursor = id ? "pointer" : "grab";
      if (this.still()) this.hover(id);
      // Density follows motion within a muscle too. Over the empty canvas
      // nothing on screen follows the pointer, once the map has eased away.
      if (region >= 0 || this.mapPresence > 0 || this.mapInfluence > 0) this.schedule();
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
      if (!e.repeat) this.selection.toggle(hit.dataset.muscle);   // a held key toggles once
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
    this.onHover(id ? MUSCLE_BY_ID.get(id) : null, region, this.detailMode);
    this.schedule();
  }

  /**
   * Shows what a program would select without changing anything, while its
   * button is pointed at. Pass null to go back to the real selection. With
   * a tinted `family` (a summary row), its muscles draw as a hover in the
   * family's hue instead.
   */
  preview(ids, family = null) {
    const next = ids ? new Set(ids) : null;
    const tinted = next && SCULPTURE_TINTED.includes(family) ? family : null;
    // pointerover repeats within one row
    if (sameMuscleSet(next, this.previewing) && tinted === this.previewFamily) return;
    this.previewing = next;
    this.previewFamily = tinted;
    if (next && !tinted) this.litReveal = 0;
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
uniform highp sampler2D uData;            // per region and guide (SCULPTURE_DATA_ROWS)
uniform vec3 uForm, uMuscle, uSelected;   // surfaces before light, sRGB
out vec3 vNormal;
out float vOcclusion;
out float vSeam;
out vec3 vSurface;
flat out vec3 vMapState;
flat out vec3 vAlbedo;                    // linear
flat out float vSelected;
flat out float vFocus;
flat out float vRegionId;
flat out float vMapTint;
flat out float vFlowGuide;

vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 octDecode(vec2 e) {
  vec3 v = vec3(e, 1.0 - abs(e.x) - abs(e.y));
  if (v.z < 0.0) v.xy = (1.0 - abs(v.yx)) * vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0);
  return normalize(v);
}

void main() {
  vec3 surface = uMin + aPos * uExt;
  gl_Position = uMatrix * vec4(surface, 1.0);
  int index = int(aAttr.x + 0.5);
  vSurface = vec3(surface.x - uMin.x - uExt.x * 0.5, surface.y, surface.z);
  vec4 map = texelFetch(uData, ivec2(index, ROW_MAP), 0);
  vMapState = map.xyz;
  vMapTint = map.w;
  vFlowGuide = texelFetch(uData, ivec2(index, ROW_INK), 0).w;
  vNormal = uNormal * octDecode(aOct);
  vOcclusion = aAttr.y / 255.0;
  vSeam = aAttr.z / 255.0 * SEAM_MAX;
  vec4 region = texelFetch(uData, ivec2(index, ROW_STATE), 0);
  float tone = region.z > 0.5 ? 0.0 : region.x;
  vAlbedo = toLinear(region.z > 0.5 ? uForm : mix(uMuscle, uSelected, tone * 0.07));
  vSelected = region.z > 0.5 ? 0.0 : region.w * 0.08;
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
in vec3 vSurface;
flat in vec3 vMapState;
flat in vec3 vAlbedo;
flat in float vSelected;
flat in float vFocus;
flat in float vRegionId;
flat in float vMapTint;
flat in float vFlowGuide;
uniform vec3 uInk;                       // sRGB
uniform vec3 uMapInk;
uniform vec3 uExt;
uniform highp sampler2D uData;           // per region and guide (SCULPTURE_DATA_ROWS)
uniform float uTraceVivid;              // 1 where tinted lines need help to keep their hue (light theme)
uniform float uBorder;                   // 1 on Targets: chosen muscles draw their border
uniform float uTraceScale;               // the body's size on screen against Targets (traceScale)
uniform vec2 uMapPointer, uMapSize;
uniform float uMapPointerActive, uMapInfluence, uLitReveal, uPointedRegion, uDetailed, uFlowTime, uDpr;
uniform float uSelectedGain;
uniform float uLineWidth;
out vec4 outColor;

vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec4 data(int index, int row) { return texelFetch(uData, ivec2(index, row), 0); }
/* Whether a guide's stored kind is k (a KIND_* define): whole numbers in a float. */
bool isKind(float w, float k) { return abs(w - k) < 0.5; }

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

  // A region that is not selected, lit, pointed at or focused draws no
  // traces, border or focus edge: each would mix in with weight exactly 0,
  // so it stops here. Both inputs are flat, so every fragment of a triangle,
  // including the helpers that give the derivatives below, branches alike.
  if (vMapState == vec3(0.0) && vFocus == 0.0) {
    outColor = vec4(toSrgb(c), 1.0);
    return;
  }

  // Slow currents live in the material's surface coordinates. Their shared
  // direction comes from the authored shape; these are not muscle fibres.
  vec2 screen = vec2(gl_FragCoord.x / uDpr, uMapSize.y - gl_FragCoord.y / uDpr);
  float nearby = 1.0 - smoothstep(24.0, 145.0, distance(screen, uMapPointer));
  float exact = 1.0 - step(0.5, abs(vRegionId - uPointedRegion));
  float hover = vMapState.y * mix(1.0, mix(1.0, exact, uMapPointerActive), uDetailed);
  float pointed = hover * mix(1.0, 0.8 + nearby * 0.2, uMapPointerActive);
  float selected = vMapState.x, lit = vMapState.z;
  float chosen = max(selected, lit);
  int region = int(vRegionId + 0.5);
  vec4 center = data(region, ROW_CENTER), axis = data(region, ROW_AXIS);
  vec3 side = normalize(cross(axis.xyz, abs(axis.z) < 0.85 ? vec3(0,0,1) : vec3(0,1,0)));
  vec3 depth = cross(side, axis.xyz);
  // Fold on the surface, after interpolation: triangles straddling the
  // midline must not turn the abdominal field into little zigzags.
  vec3 q = vec3(abs(vSurface.x), vSurface.yz) - center.xyz;
  vec3 flow = vec3(dot(q, side) / center.w, dot(q, depth) / center.w, dot(q, axis.xyz) / axis.w);
  // A rounded depth keeps the field open where its axis reaches the skin.
  // Unlike a full angular wrap, it has no pole or branch cut to gather
  // shoulder, thigh and forearm traces into rings or crowded fans.
  float angle = atan(flow.x, sqrt(flow.y * flow.y + 0.65 * 0.65));
  float along = flow.z;
  float density = clamp(center.w / max(uExt.y * 0.028, 1e-4), 0.55, 1.0);
  float field = angle * 3.2 * density;
  if (abs(vFlowGuide) > 0.5) {
    int guide = int(abs(vFlowGuide) + 0.5) - 1;
    if (vFlowGuide < 0.0) {
      vec3 left = data(guide, ROW_GUIDE_ORIGIN).xyz, right = data(guide + 1, ROW_GUIDE_ORIGIN).xyz;
      if (dot(vSurface - (left + right) * 0.5, left - right) < 0.0) guide++;
    }
    vec4 origin = data(guide, ROW_GUIDE_ORIGIN), across = data(guide, ROW_GUIDE_ACROSS),
         lengthwise = data(guide, ROW_GUIDE_ALONG);
    vec3 relative = vSurface - origin.xyz;
    float lateral = dot(relative, across.xyz);
    float vertical = dot(relative, lengthwise.xyz);
    float relief = dot(relative, cross(across.xyz, lengthwise.xyz));
    float roundWidth = uExt.y * 0.004;
    float folded = sqrt(lateral * lateral + roundWidth * roundWidth);
    float sweep;
    // origin.w is the guide's kind (FLOW_GUIDE_KINDS, given as KIND_* defines).
    if (isKind(origin.w, KIND_PELVIS)) {
      sweep = (vertical - 0.65 * folded - 0.25 * relief) / across.w;
    } else if (isKind(origin.w, KIND_TRAPEZIUS)) {
      sweep = (folded - 0.32 * vertical) / across.w;
    } else if (isKind(origin.w, KIND_SPINE)) {
      // Open, rounded sweeps across the posed spine. The vertical term stays
      // monotonic: no angular pole or mirrored seam inside the lower back.
      float bendWidth = uExt.y * 0.018;
      float bowl = sqrt(lateral * lateral + bendWidth * bendWidth) - bendWidth;
      sweep = (vertical - 1.15 * bowl - 0.2 * relief) / across.w;
    } else if (isKind(origin.w, KIND_LAT)) {
      // Each lat bows along its own posed axis, with bounded curvature and
      // no wrap around an origin that could turn the traces back on themselves.
      float t = vertical / lengthwise.w;
      float bow = lengthwise.w * (sqrt(1.0 + t * t) - 1.0);
      sweep = (lateral + 0.55 * bow + 0.12 * relief) / across.w;
    } else {
      sweep = (lateral + 0.15 * relief) / across.w;
    }
    // Keep the broad upper-trap curves; straighten their narrow lower tail.
    float blend = isKind(origin.w, KIND_TRAPEZIUS) ?
      1.0 - smoothstep(-0.5, 0.15, vertical / lengthwise.w) : 1.0;
    field = mix(field, sweep, blend);
    along = mix(along, vertical / lengthwise.w, blend);
    angle = mix(angle, sweep / 3.2, blend);
  }
  float warp = 0.22 * sin(along * 2.4) + hover * 0.32 *
    (sin(along * 2.4 - uFlowTime * 0.48) - sin(along * 2.4));
  warp += hover * 0.08 * sin(along * 5.2 - uFlowTime * 0.32);
  float phase = field * sqrt(uTraceScale) + warp;
  // Pull the existing curves gently toward the pointer. Derivatives give
  // their local direction on screen; only that direction is used, never its
  // product with the distance, so the 2×2 steps in screen derivatives stay
  // a fraction of a line rather than breaking lines far from the pointer.
  // Within ~18 px the pull eases to zero, so nothing jumps under the cursor.
  vec2 offset = screen - uMapPointer;
  vec2 gradient = vec2(dFdx(phase), -dFdy(phase)) * uDpr;
  float lean = dot(gradient, offset) / ((length(gradient) + 1e-4) * (length(offset) + 18.0));
  float reach = exp(-dot(offset, offset) / (105.0 * 105.0));
  phase += 0.3 * lean * reach * uMapInfluence * max(hover, chosen);
  float footprint = max(fwidth(phase), 0.0001);
  float linePx = abs(fract(phase + 0.5) - 0.5) / footprint;
  // Engraved weight: lines swell in shadow and thin in the light, so the
  // traces model the form instead of laying a pattern over it.
  float dark = 1.0 - smoothstep(0.35, 0.95, shade);
  float weight = mix(0.75, 1.35, dark) * max(1.0, sqrt(uTraceScale));
  float trace = 1.0 - smoothstep(0.25 * uDpr * weight, 0.85 * uDpr * weight, linePx);
  // Tapered accents travel together along the field. They reveal short arcs
  // instead of drawing a fixed set of stripes across the entire muscle.
  float travel = 0.5 + 0.5 * cos(along * 3.6 - uFlowTime * 1.05 + angle * 2.1);
  float current = pow(travel, 3.0);
  float drift = 0.28 + 0.72 * current;
  float inset = smoothstep(0.08, 0.85, vSeam);
  float facing = smoothstep(0.08, 0.5, n.z);
  float visible = (1.0 - smoothstep(0.2, 0.5, footprint)) * inset * facing;
  // Lit muscles (a program or session pointed at) draw their lines in along
  // their length once, a slightly darker head leading, then rest fully drawn.
  float front = mix(-1.5, 2.5, uLitReveal);
  float drawn = 1.0 - smoothstep(front - 0.3, front, along);
  float ahead = (along - front) / 0.22;
  float head = exp(-ahead * ahead) * (1.0 - uLitReveal);
  float etched = trace * visible * min(0.8,
    selected * mix(0.07, 0.26, dark) +
    lit * (drawn * mix(0.24, 0.5, dark) + head * 0.3) +
    pointed * drift * 0.48);
  // A family's hue keeps its chroma: on a light sculpture it darkens less in
  // shadow and draws a little stronger, so it reads as colour, not as grey.
  float tint = vMapTint, vivid = tint * uTraceVivid;
  vec3 ink = toLinear(mix(uMapInk, data(region, ROW_INK).rgb, tint)) *
             clamp(shade, mix(0.45, 0.8, vivid), 1.0);
  c = mix(c, ink, min(1.0, etched * (1.0 + 0.35 * vivid)));

  // Chosen muscles keep a fine border just inside their seams, as a map
  // draws a territory's edge; hover alone has none, so the two never read alike.
  float border = (1.0 - smoothstep(0.4 * uLineWidth, 0.4 * uLineWidth + 0.8,
                                   abs(px - 3.0 * uLineWidth))) *
                 (1.0 - smoothstep(0.3, 0.6, vSeam)) * facing * (1.0 - vFocus) * uBorder;
  // These guides span several small regions. Their individual inset borders
  // compete with the shared curves in overview; retain them in detail mode.
  border *= vFlowGuide < 0.0 ? mix(0.2, 1.0, uDetailed) : 1.0;
  c = mix(c, ink,
          border * max(selected * 0.32, lit * mix(0.3, 0.6, drawn)));

  // Keyboard focus keeps a strong edge independent of point density.
  float ring = (1.0 - smoothstep(2.4 * uLineWidth - 0.6, 2.4 * uLineWidth + 0.6, px)) *
               (1.0 - smoothstep(0.5, 0.8, vSeam)) * vFocus;
  c = mix(c, toLinear(uInk), ring);
  outColor = vec4(toSrgb(c), 1.0);
}
`;

/* The picking pass: each pixel's region (+1, so 0 is empty). */
const SCULPTURE_PICK = `
precision highp float;
flat in float vRegionId;
out vec4 outColor;
void main() {
  outColor = vec4((vRegionId + 1.0) / 255.0, 0.0, 0.0, 1.0);
}`;
