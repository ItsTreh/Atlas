/* ===========================================================================
   Anatomy sculpture — the body as a lit 3D model (WebGL2).

   The renderer the anatomy stage mounts when the browser has WebGL2; the
   SVG AnatomyFigure (anatomy.js) takes over where it does not. It has the
   same contract: new AnatomySculpture(mount, selection, { onHover }),
   paint() and preview(ids), and like the figure it only ever calls
   selection.toggle(). The selection stays the one source of truth.

   What it draws: ANATOMY_MODEL from the front and from the back, side by
   side, through an orthographic camera, so it reads as a plate in an
   anatomy book rather than a scene. Light is soft and follows the viewer.
   It draws only when something changes (selection, pointer, size, theme):
   there is no animation loop.

   How a muscle is found under the pointer: a second, hidden pass writes
   each pixel's region into an offscreen buffer, read back once per resize.
   The region's name maps to an app muscle through ANATOMY_REGIONS.

     app muscle id → its regions (ANATOMY_REGIONS) → each region's colour

   Keyboard and screen-reader users get what the SVG figure gave them: a
   checkbox per muscle in each view that shows it, in catalogue order,
   placed on the muscle.
   ========================================================================= */

const SCULPTURE_VIEWS = [
  { id: "front", label: "Front", back: false },
  { id: "back",  label: "Back",  back: true }
];

class AnatomySculpture {
  /** True when this browser can draw the sculpture. */
  static supported() {
    if (typeof ANATOMY_MODEL !== "object" || typeof WebGL2RenderingContext !== "function") return false;
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();              // a probe; free it now
    return true;
  }

  /**
   * @param opts.onHover  called with a Muscle when one is pointed at or
   *                      focused, and with null when it is left
   */
  constructor(mount, selection, opts = {}) {
    this.mount = mount;
    this.selection = selection;
    this.onHover = opts.onHover || (() => {});
    this.model = ANATOMY_MODEL;
    // Region index → app muscle id, or null where the region is not selectable.
    this.muscleOf = this.model.regions.map(name => ANATOMY_REGIONS[name] || null);
    this.hovered = null;
    this.previewing = null;                  // a Set of muscle ids while a program is pointed at
    this.focused = null;                     // { view, id } while a muscle has keyboard focus
    this.hits = new Map();                   // "view:id" → its checkbox

    this.container = document.createElement("div");
    this.container.className = "anatomy-sculpture";
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.captions = SCULPTURE_VIEWS.map(v => {
      const c = document.createElement("div");
      c.className = "view-cap";
      c.textContent = v.label;
      return c;
    });
    this.groups = SCULPTURE_VIEWS.map(v => {
      const g = document.createElement("div");
      g.className = "hits";
      g.setAttribute("role", "group");
      g.setAttribute("aria-label", v.label + " of the body");
      return g;
    });
    this.container.append(this.canvas, ...this.captions, ...this.groups);

    this.gl = this.canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true });
    if (!this.gl) throw new Error("WebGL2 is not available");
    mount.replaceChildren(this.container);

    this.initGL();
    this.readColors();
    this.bind();
    new ResizeObserver(() => this.schedule(true)).observe(mount);
    window.addEventListener("resize", () => this.schedule(true));     // a zoom changes the pixel ratio only
    new MutationObserver(() => { this.readColors(); this.schedule(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    selection.onChange(() => this.paint());
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

    const defs = "#define REGIONS " + m.regions.length + "\n#define SEAM_MAX " +
                 m.seamMax.toFixed(3) + "\n";
    this.shade = this.program(defs + SCULPTURE_VERTEX, SCULPTURE_FRAGMENT);
    this.pick = this.program(defs + SCULPTURE_VERTEX, SCULPTURE_PICK);
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

  /** The matrices that put the model in a view: orthographic, centred, upright. */
  camera(view) {
    const { min, max } = this.model.bounds;
    const c = [0, 1, 2].map(i => (min[i] + max[i]) / 2);
    const s = view.back ? -1 : 1;                    // the back view turns the figure round
    const hw = this.half[0], hh = this.half[1], depth = 60;
    // Column-major: clip = M · (p − c) with x and z flipped for the back.
    const matrix = new Float32Array([
      s / hw, 0, 0, 0,
      0, 1 / hh, 0, 0,
      0, 0, -s / depth, 0,
      -s * c[0] / hw, -c[1] / hh, s * c[2] / depth, 1
    ]);
    const normal = new Float32Array([s, 0, 0, 0, 1, 0, 0, 0, s]);
    return { matrix, normal };
  }

  /* ------------------------------- layout -------------------------------- */

  /** Batches redraws (and relayouts) into the next frame. */
  schedule(relayout = false) {
    this.needsLayout = this.needsLayout || relayout;
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.needsLayout) { this.needsLayout = false; this.layout(); }
      this.draw();
    });
  }

  /**
   * Fits the two views into the mount: as large as its height allows (less
   * a line for the captions) or its width, whichever is smaller.
   */
  layout() {
    if (!this.ready) return;
    const W = this.mount.clientWidth, H = this.mount.clientHeight;
    if (!W || !H) return;                          // hidden: lay out when shown again
    const { min, max } = this.model.bounds;
    const halfH = (max[1] - min[1]) / 2 * 1.015, aspect = (max[0] - min[0]) * 1.03 / 2 / halfH;
    const CAPTION = 30;
    const gap = Math.round(Math.min(48, Math.max(8, W * 0.03)));
    const fw = Math.max(26, Math.floor(Math.min((W - gap) / 2, (H - CAPTION) * aspect)));
    const fh = Math.floor(fw / aspect);
    // The camera takes the view's exact proportions, so rounding never squashes the figure.
    this.half = [halfH * fw / fh, halfH];
    const cw = fw * 2 + gap, ch = fh;
    this.size = { fw, fh, cw, ch, gap };
    this.boxes = [0, fw + gap];                      // each view's left edge, CSS px

    this.container.style.width = cw + "px";
    this.container.style.height = ch + CAPTION + "px";
    this.canvas.style.width = cw + "px";
    this.canvas.style.height = ch + "px";
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);
    this.captions.forEach((cap, v) => {
      cap.style.left = this.boxes[v] + fw / 2 + "px";
      cap.style.top = ch + "px";
    });
    this.renderIds();
    // Placing the checkboxes searches the region buffer; while a window is
    // being dragged to a new size, do it once it settles.
    clearTimeout(this.hitTimer);
    this.hitTimer = setTimeout(() => this.placeHits(), this.hits.size ? 150 : 0);
  }

  /* -------------------------------- drawing ------------------------------- */

  draw() {
    if (!this.ready || !this.size) return;
    const gl = this.gl, { fw, ch } = this.size, dpr = this.dpr;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);             // the region cuts leave slivers facing either way
    gl.useProgram(this.shade.p);
    this.setModelUniforms(this.shade.u);
    gl.uniform3fv(this.shade.u.uInk, this.colors.ink);
    gl.uniform3fv(this.shade.u.uInkOnSelected, this.colors.muscle);
    gl.uniform1f(this.shade.u.uLineWidth, Math.max(1, 0.75 * dpr));
    gl.bindVertexArray(this.vao);
    SCULPTURE_VIEWS.forEach((view, v) => {
      gl.viewport(Math.round(this.boxes[v] * dpr), 0, Math.round(fw * dpr), Math.round(ch * dpr));
      const cam = this.camera(view);
      gl.uniformMatrix4fv(this.shade.u.uMatrix, false, cam.matrix);
      gl.uniformMatrix3fv(this.shade.u.uNormal, false, cam.normal);
      gl.uniform4fv(this.shade.u.uRegion, this.regionColors(view.id));
      gl.drawElements(gl.TRIANGLES, this.model.indexCount, this.indexType, 0);
    });
    gl.bindVertexArray(null);
  }

  setModelUniforms(u) {
    const { min, max } = this.model.bounds;
    this.gl.uniform3fv(u.uMin, min);
    this.gl.uniform3fv(u.uExt, [max[0] - min[0], max[1] - min[1], max[2] - min[2]]);
  }

  /**
   * Each region's colour (linear RGB), and in alpha its focus edge: 0 none,
   * 1 in ink, 2 in the muscle tone (on a selected muscle ink would vanish
   * into the selected tone, as the SVG figure's dashed ring allows for).
   */
  regionColors(viewId) {
    const n = this.model.regions.length;
    const out = this.regionBuffer || (this.regionBuffer = new Float32Array(n * 4));
    const c = this.colors;
    for (let r = 0; r < n; r++) {
      const id = this.muscleOf[r];
      let rgb = this.model.kinds[r] === "form" ? c.body : c.muscle;
      if (id) {
        if (this.previewing) rgb = this.previewing.has(id) ? c.preview : c.muscle;
        else if (this.selection.has(id)) rgb = id === this.hovered ? c.selHover : c.sel;
        else if (id === this.hovered) rgb = c.muscleHover;
      }
      out.set(rgb, r * 4);
      const focused = this.focused && this.focused.view === viewId && this.focused.id === id;
      out[r * 4 + 3] = !focused ? 0 : this.selection.has(id) ? 2 : 1;
    }
    return out;
  }

  /** The theme's colours, from the same tokens the page uses. */
  readColors() {
    const probe = document.createElement("span");
    probe.style.display = "none";
    this.container.appendChild(probe);
    const read = name => {
      probe.style.color = "var(" + name + ")";
      const nums = getComputedStyle(probe).color.match(/[\d.]+/g).slice(0, 3).map(Number);
      const unit = /color\(/.test(getComputedStyle(probe).color) ? 1 : 255;
      return nums.map(v => { const s = v / unit; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    };
    const c = {
      body: read("--sculpt-form"), muscle: read("--sculpt-muscle"),
      sel: read("--sel"), selHover: read("--sel-hover"), ink: read("--ink")
    };
    // Shading swallows a small step in tone, so pointing and previewing move
    // part of the way towards the selected tone, as the program preview did.
    const towardSel = f => c.sel.map((v, i) => v * f + c.muscle[i] * (1 - f));
    c.muscleHover = towardSel(0.3);
    c.preview = towardSel(0.45);
    probe.remove();
    this.colors = c;
  }

  /* -------------------------------- picking ------------------------------- */

  /** Renders each pixel's region and view into a buffer and reads it back. */
  renderIds() {
    const gl = this.gl, { cw, ch, fw } = this.size;
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
      this.idTarget = { fb, color, depth, w: cw, h: ch, pixels: new Uint8Array(cw * ch * 4) };
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.idTarget.fb);
    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.pick.p);
    this.setModelUniforms(this.pick.u);
    gl.bindVertexArray(this.vao);
    SCULPTURE_VIEWS.forEach((view, v) => {
      gl.viewport(this.boxes[v], 0, fw, ch);
      gl.uniformMatrix4fv(this.pick.u.uMatrix, false, this.camera(view).matrix);
      gl.uniform1f(this.pick.u.uView, v + 1);
      gl.drawElements(gl.TRIANGLES, this.model.indexCount, this.indexType, 0);
    });
    gl.bindVertexArray(null);
    gl.readPixels(0, 0, cw, ch, gl.RGBA, gl.UNSIGNED_BYTE, this.idTarget.pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** The region under a point (CSS px from the canvas's top left), or -1. */
  regionAt(x, y) {
    const t = this.idTarget;
    if (!t) return -1;
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= t.w || yi >= t.h) return -1;
    return t.pixels[((t.h - 1 - yi) * t.w + xi) * 4] - 1;
  }

  muscleAt(x, y) {
    const r = this.regionAt(x, y);
    return r < 0 ? null : this.muscleOf[r];
  }

  /**
   * The muscle closest to a point, looking outward in rings up to `reach`
   * pixels, or null. A finger that lands just beside a thin muscle takes it.
   */
  muscleNear(x, y, reach = 12) {
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
   * One focusable checkbox per muscle per view, placed well inside that
   * muscle (on the viewer's left where it shows on both sides), in
   * catalogue order so Tab walks the body predictably. A view lists a
   * muscle only where it shows a fair part of it (a tenth of its best
   * view), not a sliver at the silhouette; every muscle is in at least one.
   */
  placeHits() {
    const t = this.idTarget, { fw, fh } = this.size;
    const stats = SCULPTURE_VIEWS.map(() => new Map());
    for (let yi = 0; yi < t.h; yi++)
      for (let xi = 0; xi < t.w; xi++) {
        const o = ((t.h - 1 - yi) * t.w + xi) * 4;
        const r = t.pixels[o] - 1, v = t.pixels[o + 1] - 1;
        const id = r >= 0 ? this.muscleOf[r] : null;
        if (!id || v < 0) continue;
        let s = stats[v].get(id);
        if (!s) stats[v].set(id, s = { n: 0, left: 0, lx: 0, ly: 0, x: 0, y: 0 });
        s.n++; s.x += xi; s.y += yi;
        if (xi < this.boxes[v] + fw / 2) { s.left++; s.lx += xi; s.ly += yi; }
      }
    const minPixels = Math.max(16, fw * fh * 0.0006);
    const best = id => Math.max(...stats.map(st => (st.get(id) || { n: 0 }).n));
    const keep = new Set();
    SCULPTURE_VIEWS.forEach((view, v) => {
      const group = this.groups[v], order = [];
      for (const muscle of this.selection.catalog) {
        const s = stats[v].get(muscle.id);
        if (!s || s.n < minPixels || s.n < best(muscle.id) * 0.1) continue;
        const useLeft = s.left >= s.n * 0.25;
        const cx = useLeft ? s.lx / s.left : s.x / s.n, cy = useLeft ? s.ly / s.left : s.y / s.n;
        const [px, py] = this.nearestPixel(muscle.id, cx, cy);
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
  nearestPixel(id, x, y) {
    const x0 = Math.round(x), y0 = Math.round(y);
    const inside = (px, py, inset) => {
      for (let dy = -inset; dy <= inset; dy++)
        for (let dx = -inset; dx <= inset; dx++)
          if (this.muscleAt(px + dx, py + dy) !== id) return false;
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
    let pointerType = "mouse";
    this.canvas.addEventListener("pointerdown", e => {
      pointerType = e.pointerType;
      if (pointerType === "touch") this.hover(this.muscleAt(...local(e)) || this.muscleNear(...local(e)));
    });
    this.canvas.addEventListener("pointermove", e => {
      const id = this.muscleAt(...local(e));
      this.canvas.style.cursor = id ? "pointer" : "";
      this.hover(id);
    });
    this.canvas.addEventListener("pointerleave", () => this.hover(null));
    this.canvas.addEventListener("click", e => {
      let id = this.muscleAt(...local(e));
      if (!id && pointerType === "touch") id = this.muscleNear(...local(e));
      if (id) this.selection.toggle(id);
    });

    this.container.addEventListener("keydown", e => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const hit = e.target.closest && e.target.closest(".hit");
      if (!hit) return;
      e.preventDefault();
      this.selection.toggle(hit.dataset.muscle);
    });
    // Keyboard focus only: a tap would otherwise leave a muscle stuck lit.
    this.container.addEventListener("focusin", e => {
      if (!e.target.matches || !e.target.matches(".hit:focus-visible")) return;
      this.focused = { view: e.target.dataset.view, id: e.target.dataset.muscle };
      this.hover(this.focused.id);
      this.schedule();
    });
    this.container.addEventListener("focusout", e => {
      if (this.container.contains(e.relatedTarget)) return;
      this.focused = null;
      this.hover(null);
      this.schedule();
    });

    this.canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); this.ready = false; });
    this.canvas.addEventListener("webglcontextrestored", () => { this.initGL(); this.schedule(true); });
  }

  hover(id) {
    if (id === this.hovered) return;
    this.hovered = id;
    this.onHover(id ? MUSCLE_BY_ID.get(id) : null);
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
uniform vec4 uRegion[REGIONS];            // colour, and the focus edge in alpha (regionColors)
out vec3 vNormal;
out float vOcclusion;
out float vSeam;
flat out vec4 vColor;
flat out float vRegionId;

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
  int r = int(aAttr.x + 0.5);
  vColor = uRegion[r];
  vRegionId = aAttr.x;
}`;

/* Soft studio light that follows the viewer: a broad key from the upper
   left, a weak fill from the right, a sky-to-ground ambient, and the baked
   occlusion for creases and hollows. No highlights: the finish is matte. */
const SCULPTURE_FRAGMENT = `
precision highp float;
in vec3 vNormal;
in float vOcclusion;
in float vSeam;
flat in vec4 vColor;
flat in float vRegionId;
uniform vec3 uInk, uInkOnSelected;
uniform float uLineWidth;
out vec4 outColor;

vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 key = normalize(vec3(-0.45, 0.6, 0.66));
  vec3 fill = normalize(vec3(0.75, 0.05, 0.62));
  float k = clamp((dot(n, key) + 0.3) / 1.3, 0.0, 1.0);
  float f = clamp((dot(n, fill) + 0.2) / 1.2, 0.0, 1.0);
  float sky = 0.5 + 0.5 * n.y;
  float light = 0.26 + 0.14 * sky + 0.66 * k + 0.1 * f;
  // Surfaces turning away darken a little, as a matte sculpture does.
  float turn = mix(0.8, 1.0, sqrt(max(n.z, 0.0)));
  vec3 c = vColor.rgb * light * turn * mix(1.0, vOcclusion, 0.95);

  // Anatomical seams: a thin, darker line where regions meet, the same
  // width on screen at any size.
  float px = vSeam / max(fwidth(vSeam), 1e-4);
  float near = 1.0 - smoothstep(0.2, 0.45, vSeam);
  float seam = (1.0 - smoothstep(uLineWidth - 0.6, uLineWidth + 0.6, px)) * near;
  c *= 1.0 - 0.22 * seam;

  // Keyboard focus: an ink edge round the focused muscle.
  float ring = (1.0 - smoothstep(2.4 * uLineWidth - 0.6, 2.4 * uLineWidth + 0.6, px)) *
               (1.0 - smoothstep(0.5, 0.8, vSeam)) * min(vColor.a, 1.0);
  c = mix(c, vColor.a > 1.5 ? uInkOnSelected : uInk, ring);
  outColor = vec4(toSrgb(c), 1.0);
}`;

/* The picking pass: each pixel's region (+1, so 0 is empty) and view. */
const SCULPTURE_PICK = `
precision highp float;
flat in float vRegionId;
uniform float uView;
out vec4 outColor;
void main() {
  outColor = vec4((vRegionId + 1.0) / 255.0, uView / 255.0, 0.0, 1.0);
}`;
