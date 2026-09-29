/* ===========================================================================
   Anatomy stage — the room the body stands in.

   Three layers, each knowing only the one below it:
     • the page (targets.js)   talks to the stage, never to the drawing
     • the stage               owns the space: its size, what is layered in
                               it, and which renderer is mounted
     • the renderer            draws the body into the stage's viewport and
                               turns pointer and key input into
                               selection.toggle()
   and the MuscleSelection holds what is chosen, beneath all of them.

   So the drawing can be replaced without touching the page or the
   selection. A renderer is any class built as
   `new Renderer(mount, selection, { model, onHover, onFail })` with a
   `preview(ids)` method; it fills `mount` itself, follows the selection on
   its own, and sizes itself to the mount (see .anatomy-viewport in the
   CSS). The stage hands every renderer the same `model` (the anatomy, in
   the ANATOMY_MODEL shape); a renderer that draws its own figure ignores
   it. A renderer may have a static `supported(model)`; the stage mounts the
   first one that is supported and starts without an error. A renderer that
   stops being able to draw later calls `onFail()`: the stage calls its
   `destroy()` (if it has one) and mounts the next.

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
   */
  constructor(root, selection, { model = typeof ANATOMY_MODEL === "object" ? ANATOMY_MODEL : null, renderers = [AnatomySculpture, AnatomyFigure], onHover } = {}) {
    this.root = root;
    this.mount = root.querySelector("[data-anatomy-mount]");
    this.selection = selection;
    this.model = model;
    this.renderers = renderers;
    this.onHover = onHover || (() => {});
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
          { model: this.model, onHover: this.onHover, onFail: () => this.fail(i) });
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

  /** Shows a program's muscles without selecting them; null to stop. */
  preview(ids) { this.renderer.preview(ids); }
}
