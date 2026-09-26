/* ===========================================================================
   Anatomy figure — an interactive front and back view of the body, in SVG.

   The fallback renderer: the anatomy stage mounts it where the browser has
   no WebGL2 for the 3D sculpture (anatomy-sculpture.js). Same contract.

   The drawing is data. Each view lists shapes for the LEFT half of the
   figure (x ≤ 100 in a 200-wide viewBox); the renderer mirrors every shape
   across x = 100, so the two sides always match. A shape with a `muscle`
   is clickable and belongs to that muscle id; one without is body (head,
   hands, knees…) and only gives the figure its outline. `lines` are
   non-interactive detail strokes drawn on top.

   A muscle can appear in both views (shoulders, forearms, calves…). All its
   shapes, in both views, sit in one group per view and light up together.
   ========================================================================= */

const ANATOMY_VIEWBOX = "0 0 200 440";

/* The outline both views share: neck, arm, hand, torso, leg, foot. */
const BODY_OUTLINE =
  "M100,42 L93,42 C93,50 92,56 90,60 C82,63 72,63 64,65 C52,68 45,76 44,88 " +
  "C43,98 43,106 43,114 C41,128 41,140 42,148 C39,164 35,180 33,198 " +
  "C30,208 29,218 31,226 C34,231 40,230 42,226 C44,216 45,208 46,201 " +
  "C50,186 55,168 57,152 C59,138 59,120 59,104 C61,120 64,140 66,160 " +
  "C66,172 64,184 63,196 C59,224 58,256 61,288 C62,298 63,306 65,314 " +
  "C61,338 61,364 67,394 C67,404 65,412 61,419 C58,425 62,430 71,430 " +
  "C79,430 85,428 86,423 C84,414 82,404 82,394 C86,366 88,340 86,316 " +
  "C88,306 90,298 92,288 C96,262 98,236 99,212 L100,212 Z";

const ANATOMY_VIEWS = [
  {
    id: "front", label: "Front",
    shapes: [
      { d: BODY_OUTLINE },
      { d: "M100,9 C91,9 85,17 85,28 C85,39 91,47 100,47 Z" },                 // head
      { d: "M71,305 C71,300 75,298 78,298 C82,298 86,301 86,306 C86,311 82,314 78,314 C74,314 71,311 71,305 Z", knee: true },

      { muscle: "traps",
        d: "M92,50 C89,56 80,61 67,64 C75,65 83,66 90,66 C91,61 92,56 92,50 Z" },
      { muscle: "shoulders",
        d: "M66,67 C56,67 48,73 46,84 C45,92 45,100 47,107 C51,104 55,100 58,96 " +
           "C60,86 64,78 72,70 C70,68 68,67 66,67 Z" },
      { muscle: "chest",
        d: "M74,69 C82,68 92,68 99,69 L99,103 C92,108 80,109 70,105 " +
           "C65,102 61,99 60,96 C62,86 67,76 74,69 Z" },
      { muscle: "lats",
        d: "M60,101 C63,104 66,106 68,108 C67,122 67,138 68,152 C64,138 61,120 60,101 Z" },
      { muscle: "biceps",
        d: "M47,110 C44,120 43,132 44,145 C48,147 53,147 56,145 C58,133 59,119 58,101 " +
           "C55,105 51,108 47,110 Z" },
      { muscle: "forearms",
        d: "M44,149 C41,163 37,180 35,197 C38,199 42,199 45,198 C49,183 54,167 56,149 " +
           "C52,151 48,151 44,149 Z" },
      { muscle: "abs",
        d: "M88,111 L99,111 L99,186 C95,184 92,180 90,175 C88,155 87,133 88,111 Z" },
      { muscle: "obliques",
        d: "M70,108 C76,110 81,111 86,111 C85,134 86,158 88,178 C81,176 75,170 71,162 " +
           "C70,145 69,126 70,108 Z" },
      { muscle: "quads",
        d: "M66,199 C74,204 83,208 91,211 C91,234 88,258 87,286 C85,293 81,296 77,296 " +
           "C70,296 65,291 63,284 C61,256 62,226 66,199 Z" },
      { muscle: "adductors",
        d: "M94,210 L99,213 C98,232 95,250 90,264 C91,246 93,228 94,210 Z" },
      { muscle: "calves",
        d: "M65,320 C61,338 61,358 65,380 C69,372 72,352 73,330 C71,324 68,321 65,320 Z" },
      { muscle: "calves",
        d: "M79,318 C85,328 88,348 86,370 C84,380 81,384 78,380 C77,360 76,340 79,318 Z" }
    ],
    lines: [
      "M89,130 L99,130", "M89,148 L99,148", "M89.5,166 L99,166",            // abs rows
      "M79,214 C78,240 78,266 79,288",                                       // rectus femoris
      "M88,262 C83,272 81,282 82,292"                                        // vastus medialis
    ]
  },
  {
    id: "back", label: "Back",
    shapes: [
      { d: BODY_OUTLINE },
      { d: "M100,9 C91,9 85,17 85,28 C85,39 91,47 100,47 Z" },

      { muscle: "traps",
        d: "M93,46 C92,54 85,60 67,64 C76,74 85,88 91,102 C95,112 98,122 99,132 L99,46 Z" },
      { muscle: "shoulders",
        d: "M64,67 C54,68 47,74 45,86 C44,94 45,102 47,108 C51,104 55,100 58,96 " +
           "C60,86 64,78 70,72 C68,70 66,68 64,67 Z" },
      { muscle: "upper-back",
        d: "M72,74 C79,84 85,96 90,108 L62,105 C60,101 59,98 59,96 C61,87 66,80 72,74 Z" },
      { muscle: "lats",
        d: "M61,109 L91,112 C94,120 96,127 98,134 C96,150 92,164 86,176 " +
           "C80,182 74,185 69,186 C67,168 65,150 64,136 C62,126 61,118 61,109 Z" },
      { muscle: "lower-back",
        d: "M99,137 L99,193 C94,193 90,191 86,188 C88,178 90,168 92,158 " +
           "C95,150 97,143 99,137 Z" },
      { muscle: "triceps",
        d: "M47,110 C44,120 43,132 44,145 C48,147 53,147 56,145 C58,133 59,119 58,101 " +
           "C55,105 51,108 47,110 Z" },
      { muscle: "forearms",
        d: "M44,149 C41,163 37,180 35,197 C38,199 42,199 45,198 C49,183 54,167 56,149 " +
           "C52,151 48,151 44,149 Z" },
      { muscle: "glutes",
        d: "M67,194 C74,190 83,191 90,194 C94,196 97,198 99,199 L99,236 " +
           "C92,241 82,241 74,237 C66,232 63,222 64,210 C64,204 65,199 67,194 Z" },
      { muscle: "hamstrings",
        d: "M63,242 C71,246 82,247 92,243 C91,262 88,282 86,300 C80,303 74,303 69,300 " +
           "C65,282 62,262 63,242 Z" },
      { muscle: "adductors",
        d: "M95,242 L99,239 C98,256 96,270 92,282 C93,268 94,255 95,242 Z" },
      { muscle: "calves",
        d: "M66,318 C60,336 61,356 68,372 C74,380 81,380 85,372 C89,354 88,334 84,318 " +
           "C78,314 72,314 66,318 Z" }
    ],
    lines: [
      "M52,112 C51,122 51,132 52,140",                                      // triceps heads
      "M78,250 C78,266 78,282 78,298",                                      // hamstring heads
      "M76,322 C76,340 76,356 76,374"                                       // calf heads
    ]
  }
];

const SVG_NS = "http://www.w3.org/2000/svg";
const MIRROR = "matrix(-1 0 0 1 200 0)";

/**
 * Renders the views into `mount` and keeps them in step with a
 * MuscleSelection. The figure never changes the selection's rules; it only
 * calls `selection.toggle()`.
 *
 * @param opts.onHover  called with a Muscle when one is pointed at or
 *                      focused, and with null when it is left
 */
class AnatomyFigure {
  constructor(mount, selection, opts = {}) {
    // The figure draws into a root of its own inside `mount`, so the stage
    // holding it keeps its own box and styles.
    this.container = document.createElement("div");
    this.container.className = "anatomy";
    mount.replaceChildren(this.container);
    this.selection = selection;
    this.onHover = opts.onHover || (() => {});
    this.groups = new Map();          // muscle id → [<g>, …] across the views
    this.build();
    this.bind();
    this.paint();
    selection.onChange(() => this.paint());
  }

  build() {
    this.container.innerHTML = "";
    for (const view of ANATOMY_VIEWS) {
      const fig = document.createElement("figure");
      fig.className = "anatomy-view";

      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("viewBox", ANATOMY_VIEWBOX);
      svg.setAttribute("role", "group");
      svg.setAttribute("aria-label", view.label + " of the body");

      const body = el("g", { class: "body" });
      const muscles = el("g", { class: "muscles" });
      const lines = el("g", { class: "details", "aria-hidden": "true" });
      svg.append(body, muscles, lines);

      // One focusable group per muscle per view, in catalogue order, so Tab
      // walks the body in a predictable order rather than drawing order.
      const byMuscle = new Map();
      for (const shape of view.shapes) {
        if (!shape.muscle) {
          for (const t of [null, MIRROR])
            body.appendChild(el("path", { d: shape.d, class: shape.knee ? "joint" : "",
                                          transform: t }));
          continue;
        }
        if (!byMuscle.has(shape.muscle)) byMuscle.set(shape.muscle, []);
        byMuscle.get(shape.muscle).push(shape.d);
      }
      for (const muscle of this.selection.catalog) {
        const paths = byMuscle.get(muscle.id);
        if (!paths) continue;
        const g = el("g", {
          class: "m", "data-muscle": muscle.id, tabindex: "0",
          role: "checkbox", "aria-checked": "false", "aria-label": muscle.name
        });
        const title = el("title", {});
        title.textContent = muscle.name;
        g.appendChild(title);
        for (const d of paths)
          for (const t of [null, MIRROR]) g.appendChild(el("path", { d, transform: t }));
        muscles.appendChild(g);
        if (!this.groups.has(muscle.id)) this.groups.set(muscle.id, []);
        this.groups.get(muscle.id).push(g);
      }
      for (const d of view.lines)
        for (const t of [null, MIRROR]) lines.appendChild(el("path", { d, transform: t }));

      const cap = document.createElement("figcaption");
      cap.textContent = view.label;
      fig.append(svg, cap);
      this.container.appendChild(fig);
    }
  }

  bind() {
    const idOf = e => {
      const g = e.target.closest && e.target.closest("[data-muscle]");
      return g ? g.dataset.muscle : null;
    };
    // Some muscles are only a few pixels wide on a phone (adductors, abs,
    // forearms). A finger that lands just beside one takes the nearest muscle
    // instead of nothing. Mouse clicks stay exact.
    let pointerType = "mouse";
    this.container.addEventListener("pointerdown", e => { pointerType = e.pointerType; });
    this.container.addEventListener("click", e => {
      let id = idOf(e);
      if (!id && pointerType === "touch" && e.target.closest && e.target.closest("svg"))
        id = this.muscleNear(e.clientX, e.clientY);
      if (id) this.selection.toggle(id);
    });
    this.container.addEventListener("keydown", e => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const id = idOf(e);
      if (!id) return;
      e.preventDefault();
      this.selection.toggle(id);
    });
    // Hover and focus both light the muscle in every view, so pointing at the
    // front delt also shows where the rear delt is.
    const enter = e => this.hover(idOf(e));
    const leave = e => { if (!this.container.contains(e.relatedTarget)) this.hover(null); };
    this.container.addEventListener("pointerover", enter);
    this.container.addEventListener("pointerleave", () => this.hover(null));
    // Keyboard focus only: a tap also focuses the muscle, just after the finger
    // has lifted, and would otherwise leave it stuck in its hover state.
    this.container.addEventListener("focusin", e => {
      if (e.target.matches && e.target.matches(":focus-visible")) enter(e);
    });
    this.container.addEventListener("focusout", leave);
  }

  /**
   * The muscle closest to a point, looking outward in rings up to `reach`
   * pixels, or null. Nearest ring wins, so a tap between two muscles goes to
   * the one it was closer to.
   */
  muscleNear(x, y, reach = 12) {
    for (let r = 3; r <= reach; r += 3) {
      const steps = Math.max(8, Math.round(r * 1.5));
      for (let i = 0; i < steps; i++) {
        const a = i / steps * 2 * Math.PI;
        const hit = document.elementFromPoint(x + r * Math.cos(a), y + r * Math.sin(a));
        const g = hit && hit.closest && hit.closest("[data-muscle]");
        if (g && this.container.contains(g)) return g.dataset.muscle;
      }
    }
    return null;
  }

  hover(id) {
    if (id === this.hovered) return;
    if (this.hovered)
      for (const g of this.groups.get(this.hovered)) g.classList.remove("hover");
    this.hovered = id;
    if (id) for (const g of this.groups.get(id)) g.classList.add("hover");
    this.onHover(id ? MUSCLE_BY_ID.get(id) : null);
  }

  /**
   * Shows what a program would select without changing anything, while its
   * button is pointed at. Pass null to go back to the real selection.
   */
  preview(ids) {
    this.container.classList.toggle("previewing", !!ids);
    const set = new Set(ids || []);
    for (const [id, gs] of this.groups)
      for (const g of gs) g.classList.toggle("preview", set.has(id));
  }

  paint() {
    for (const [id, gs] of this.groups) {
      const on = this.selection.has(id);
      for (const g of gs) {
        if (g.classList.contains("on") === on) continue;
        g.classList.toggle("on", on);
        g.setAttribute("aria-checked", on ? "true" : "false");
      }
    }
  }
}

function el(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs))
    if (v !== null && v !== "") node.setAttribute(k, v);
  return node;
}
