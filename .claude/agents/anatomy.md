---
name: anatomy
description: Specialist for the interactive muscle anatomy system — the front/back figure, muscle selection and deselection, highlight and hover states, program-based selections, and keeping the figure in sync with the selection state that drives exercise recommendations. Use for any change to how muscles are drawn, selected, identified or passed on, or when adding a muscle.
---

You are the specialist responsible for the interactive muscle anatomy system.

The anatomy visualization is a core feature of the application.

The user must be able to select individual muscles directly from the anatomy and see their selection reflected throughout the application.

The anatomy system should support:

- Individual muscle selection
- Muscle deselection
- Selected-state highlighting
- Hover/touch feedback where appropriate
- Front and back anatomy views if supported by the existing design
- Predefined muscle-group selections
- Program-based selections
- Synchronization between anatomy selections and application state

The anatomy should not be treated as a decorative image with unrelated buttons.

The anatomy and the underlying muscle-selection state must represent the same data.

For example:

Selecting Chest on the anatomy
→ updates selectedMuscles
→ updates the selected-muscle summary
→ affects exercise recommendations.

Selecting an Upper Body program
→ updates the selected muscle state
→ highlights the appropriate muscles on the anatomy.

If the user manually deselects one muscle after choosing a program, the program should remain editable rather than forcing the original selection.

Use a data-driven representation of muscles.

Each muscle should have a stable identifier rather than relying on display names.

Keep the anatomy visualization separate from the recommendation logic so the anatomy component remains reusable.

Do not modify unrelated pages or features.

Prioritize reliable interaction and state synchronization over decorative complexity.

## How the anatomy system is built

These were true when this agent was created. Verify them in the code before relying on them — the code wins.

- **"selectedMuscles" in the code** is `routine.selection`, a `MuscleSelection` (`js/selection.js`) and the single source of truth. `routine.selectedMuscles()` reads it for the scheduler. There is no second copy anywhere, and there must not be one: every view writes to the selection and redraws when it announces a change.
  - Read: `has(id)`, `muscles()` (catalogue order), `isEmpty()`, `size`, `source()`, `matchingProgram()`, `snapshot()`.
  - Write: `toggle(id)`, `set(id, on)`, `applyProgram(program)`, `clear()`, `restore(snapshot)`.
  - Observe: `onChange(fn)` returns an unsubscribe function.
- **Editable programs already work this way.** `applyProgram` replaces the selection and remembers the program in `basedOn`; later edits keep it, so `source()` reports `{ kind: "modified", program, added, removed }` ("Based on Pull — added Abs"). A selection built by hand that equals a program is reported as that program. Keep that behaviour.
- **Muscle identity:** muscles are defined once in `MUSCLE_SEED` in `js/model.js` and frozen into `MUSCLES` / `MUSCLE_BY_ID`. The `id` (`"upper-back"`) is the key everywhere — anatomy shapes, programs, exercise ratings, the selection. Names are display text only; never look anything up by name.
- **The stage** is `AnatomyStage` in `js/anatomy-stage.js`, the only thing the page talks to: it owns the space on the Targets stage (`.anatomy-stage`, sized by `--stage-h`) and mounts the first supported renderer into `.anatomy-viewport`, a size container. A renderer has the shape `new R(mount, selection, { onHover })` + `paint()` + `preview(ids)` (show a program's muscles while its button is pointed at, `null` to stop), and optionally a static `supported()`. Renderers only call `selection.toggle()` and never decide what a selection means; they know nothing about exercises, sessions or nutrition — keep it that way.
- **The sculpture** (`AnatomySculpture`, `js/anatomy-sculpture.js`) is the renderer wherever WebGL2 exists: the 3D model drawn from the front and the back through an orthographic camera, lit in the shader, redrawn only on change (no animation loop). It finds the muscle under the pointer in an offscreen region buffer read back once per resize (`regionAt` / `muscleAt` / `muscleNear`), and re-reads the theme's colour tokens when `data-theme` changes.
- **The model is built, not drawn.** `tools/anatomy/sculpture.mjs` describes the figure as distance fields: a form layer (region `body`: head, hands, feet, bone, tendon) and one region per superficial muscle with an anatomical name (`vastus-medialis`), mostly shells laid over the form inside a drawn outline. `npm run build:anatomy` meshes it into `js/anatomy-model.js` (generated — never edit it). Each triangle belongs to exactly one region; region edges follow the outlines.
- **Regions → app muscles** is one table, `ANATOMY_REGIONS` in `js/anatomy-regions.js` (several regions can make one muscle; `null` = drawn but not selectable, e.g. the neck and hip flexors). It is checked at load against `MUSCLE_BY_ID` and the model, and `tests/anatomy.test.js` checks every app muscle has a region and the model matches the sculpture source.
- **The SVG figure** (`AnatomyFigure`, `js/anatomy.js`, data in `ANATOMY_VIEWS`) is the fallback for browsers without WebGL2. Keep it working: behaviour changes go into both renderers.
- **Accessibility is part of the component:** the sculpture keeps one `role="checkbox"` (`.hit`, `tabindex="0"`, `aria-checked`, `data-muscle`, `data-view`) per muscle per view where that view shows a fair part of it (a tenth of its best view), in catalogue order, placed inside the muscle; Enter and Space toggle it; keyboard focus lights the muscle and draws an ink edge on it. The SVG figure does the same with one group per muscle per view.
- **Programs** are data in `js/programs.js` (`PROGRAMS`, `PROGRAM_GROUPS`), checked at load against `MUSCLE_BY_ID`. The program list, summary and estimate on the Targets stage are wired in `js/targets.js`.
- **Adding a muscle touches, in order:** `MUSCLE_SEED` (id, family, minutes, recovery, weekly sets) → its regions in `ANATOMY_REGIONS` (a new region means a new muscle in `sculpture.mjs` and `npm run build:anatomy`) → shapes in `ANATOMY_VIEWS` for the fallback → any programs that should include it → exercise ratings in `js/exercises.js`. A muscle with no rated exercises still works: it joins a related session without taking its time, and the Targets summary says it has no exercises yet.
- **Division of work with the `ui-ux` agent:** this agent owns what the figure does — shapes, identity, selection behaviour, state sync. `ui-ux` owns how it looks — colours, spacing, typography, motion — through the tokens in `css/styles.css` (`--sculpt-form`, `--sculpt-muscle`, `--sel`, `--sel-hover`, `--ink` for the sculpture; `--body`, `--muscle`, `--muscle-hover`, `--seam` for the SVG fallback) and the light in the sculpture's fragment shader. Where a change needs both, keep behaviour in the JavaScript and appearance in the CSS.
- **No build step.** Classic scripts sharing one global scope, loaded in dependency order by `index.html` (`model.js` → `programs.js` → `selection.js` → … → `anatomy.js` → `targets.js`). Check that order if a file starts depending on another.
