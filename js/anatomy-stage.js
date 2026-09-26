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
   `new Renderer(mount, selection, { onHover })` with a `preview(ids)`
   method; it fills `mount` itself, follows the selection on its own, and
   sizes itself to the mount (see .anatomy-viewport in the CSS). A renderer
   may have a static `supported()`; the stage mounts the first one that is
   supported and starts without an error.

   Today: the 3D AnatomySculpture, or the SVG AnatomyFigure where the
   browser has no WebGL2.
   ========================================================================= */

class AnatomyStage {
  /**
   * @param root            the .anatomy-stage element
   * @param opts.renderers  renderer classes in order of preference
   * @param opts.onHover    called with a Muscle when one is pointed at or
   *                        focused, and with null when it is left
   */
  constructor(root, selection, { renderers = [AnatomySculpture, AnatomyFigure], onHover } = {}) {
    this.root = root;
    const mount = root.querySelector("[data-anatomy-mount]");
    // The first renderer that is supported and starts cleanly. A GPU can
    // report WebGL2 and still fail a shader; the next renderer takes over
    // rather than leaving the stage (and the page below it) unbuilt.
    for (const Renderer of renderers) {
      if (Renderer.supported && !Renderer.supported()) continue;
      try {
        this.renderer = new Renderer(mount, selection, { onHover });
        break;
      } catch (e) {
        console.warn("Anatomy renderer " + Renderer.name + " failed; trying the next.", e);
      }
    }
  }

  /** Shows a program's muscles without selecting them; null to stop. */
  preview(ids) { this.renderer.preview(ids); }
}
