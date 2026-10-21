/* ===========================================================================
   Anatomy stage — the room the body stands in.

   Three layers, each knowing only the one below it:
     • the page (targets.js,   talks to the stage, never to the drawing
       stages.js)
     • the stage               owns the space: its size, what is layered in
                               it, and which renderer is mounted
     • the renderer            draws the body into the stage's viewport and
                               turns pointer and key input into
                               selection.toggle()
   and the MuscleSelection holds what is chosen, beneath all of them.

   So the drawing can be replaced without touching the page or the
   selection. A renderer is any class built as
   `new Renderer(mount, selection, { model, onHover, onTurn, onFail, shot })`
   with a `preview(ids)` method; it fills `mount` itself, follows the
   selection on its own, and sizes itself to the mount (see
   .anatomy-viewport in the CSS). The stage hands every renderer the same
   `model` (the anatomy, in the ANATOMY_MODEL shape); a renderer that draws
   its own figure ignores it. A renderer may have a static
   `supported(model)`; the stage mounts the first one that is supported and
   starts without an error. A renderer that stops being able to draw later
   calls `onFail()`: the stage calls its `destroy()` (if it has one) and
   mounts the next.

   A renderer that can move a camera (the sculpture) also has setShot,
   turnTo, setInteractive, setHighlight, setDim and setLayout; the stage
   passes those on and remembers them, so a renderer that takes over later
   starts where the page left off. One that cannot (the SVG figure) is
   "flat": the stage marks itself so, and the page lays it out as a plain
   figure on Targets and hides it elsewhere.

   Today: the 3D AnatomySculpture, or the SVG AnatomyFigure where the
   browser has no WebGL2.
   ========================================================================= */

class AnatomyStage {
  /**
   * @param root            the .anatomy-stage element
   * @param opts.model      the anatomy to draw; ANATOMY_MODEL when left out
   * @param opts.renderers  renderer classes in order of preference
   * @param opts.onHover    called with a Muscle when one is pointed at or
   *                        focused, and with null when it is left
   * @param opts.onTurn     called with the view ("front", "back") the body
   *                        is turned to, and whether a drag has turned it off
   * @param opts.onChange   called when a different renderer takes over
   */
  constructor(root, selection, { model = typeof ANATOMY_MODEL === "object" ? ANATOMY_MODEL : null,
                                 renderers = [AnatomySculpture, AnatomyFigure], onHover, onTurn, onChange } = {}) {
    this.root = root;
    this.mount = root.querySelector("[data-anatomy-mount]");
    this.selection = selection;
    this.model = model;
    this.renderers = renderers;
    this.onHover = onHover || (() => {});
    this.onTurn = onTurn || (() => {});
    this.onChange = onChange || (() => {});
    // What the page last asked of a camera, for a renderer that mounts later.
    this.state = { shot: "targets", interactive: true, highlight: null, dim: 1, layout: "desktop" };
    this.start(0);
  }

  /**
   * Mounts the first renderer from `from` on that is supported and starts
   * cleanly. A GPU can report WebGL2 and still fail a shader, or lose its
   * context for good later; the next renderer takes over rather than
   * leaving the stage (and the page below it) unbuilt or blank.
   */
  start(from) {
    for (let i = from; i < this.renderers.length; i++) {
      const Renderer = this.renderers[i];
      if (Renderer.supported && !Renderer.supported(this.model)) continue;
      try {
        this.renderer = new Renderer(this.mount, this.selection,
          { model: this.model, onHover: this.onHover, onTurn: this.onTurn,
            onFail: () => this.fail(i), shot: this.state.shot });
        this.root.classList.toggle("flat", !this.moves);
        const s = this.state;
        this.setLayout(s.layout); this.setInteractive(s.interactive);
        this.setHighlight(s.highlight); this.setDim(s.dim);
        this.onChange(this);
        return;
      } catch (e) {
        console.warn("Anatomy renderer " + Renderer.name + " failed; trying the next.", e);
      }
    }
  }

  /** The renderer at `index` can no longer draw: swap in the next one. */
  fail(index) {
    const Renderer = this.renderers[index];
    if (!(this.renderer instanceof Renderer)) return;       // already replaced
    console.warn("Anatomy renderer " + Renderer.name + " stopped drawing; trying the next.");
    if (this.renderer.destroy) this.renderer.destroy();
    this.onHover(null);
    this.start(index + 1);
  }

  /** True when the renderer has a camera to move (the sculpture). */
  get moves() { return !!(this.renderer && this.renderer.setShot); }

  /** Shows a program's muscles without selecting them; null to stop. */
  preview(ids, family) { if (this.renderer) this.renderer.preview(ids, family); }

  /** Moves the camera to a named shot (SCULPTURE_SHOTS, or "targets"). */
  setShot(name) { this.state.shot = name; if (this.moves) this.renderer.setShot(name); }
  /** Turns the body to "front" or "back" on Targets. */
  turnTo(view) { if (this.renderer && this.renderer.turnTo) this.renderer.turnTo(view); }
  setInteractive(on) { this.state.interactive = on; if (this.renderer && this.renderer.setInteractive) this.renderer.setInteractive(on); }
  setHighlight(ids) { this.state.highlight = ids; if (this.renderer && this.renderer.setHighlight) this.renderer.setHighlight(ids); }
  setDim(v) { this.state.dim = v; if (this.renderer && this.renderer.setDim) this.renderer.setDim(v); }
  setLayout(mode) { this.state.layout = mode; if (this.renderer && this.renderer.setLayout) this.renderer.setLayout(mode); }
}
