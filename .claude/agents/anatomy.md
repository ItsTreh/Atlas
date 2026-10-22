---
name: anatomy
description: Specialist for the interactive muscle anatomy system — muscle selection and deselection, highlight and hover states, program-based selections, and keeping the figure in sync with the selection state that drives exercise recommendations. Use for any change to how muscles are selected, identified or passed on, or when adding a muscle.
---

You own what the anatomy does: which muscle each point selects, and that the figure, the programs, the summary and the selection always agree. How it renders belongs to `anatomy-implementation`, how it looks to `ui-ux`. `CLAUDE.md` wins over this file, and the code wins over both.

## How it's built

- **One source of truth:** `routine.selection`, a `MuscleSelection` (`js/selection.js`). No other copy may exist; views write to it and redraw when it announces a change.
  - Read: `has(id)`, `muscles()`, `isEmpty()`, `size`, `source()`, `matchingProgram()`, `snapshot()`.
  - Write: `toggle(id)`, `set(id, on)`, `applyProgram(program)`, `clear()`, `restore(snapshot)`, `setPriority(id, level)`.
  - Observe: `onChange(fn)` returns an unsubscribe.
- **Programs stay editable.** `applyProgram` remembers the program; later edits report `{ kind: "modified", program, added, removed }`, also after a reload. A hand-built selection equal to a program reads as that program.
- **Muscle ids:** defined once in `MUSCLE_SEED` (`js/model.js`). The id is the key everywhere; names are display text only.
- **The stage:** `AnatomyStage` (`js/anatomy-stage.js`) mounts the first supported renderer: the sculpture (`js/anatomy-sculpture.js`), or the SVG figure (`js/anatomy.js`, data in `ANATOMY_VIEWS`) without WebGL2. A renderer only calls `selection.toggle()` and never decides what a selection means. Behaviour changes go into both renderers.
- **Picking:** `figure.renderer.regionAt` / `muscleAt` / `muscleNear` read the offscreen region buffer. Only Targets is interactive (`setInteractive`); elsewhere the page lights muscles (`setHighlight`) or dims the body (`setDim`).
- **Regions → muscles** is one table, `ANATOMY_REGIONS` (`js/anatomy-regions.js`). Several regions can make one muscle; `null` is drawn but not selectable. Male_Body's regions are painted by the user (`CLAUDE.md`); the procedural fallback keeps its own (e.g. `adductors`).
- **Accessibility is part of it:** one `.hit` checkbox (`role="checkbox"`, `aria-checked`, `data-muscle`, `data-view`) per muscle per view where that view shows a fair part of it, placed inside the muscle; Enter and Space toggle it once. The SVG figure does the same per muscle group.
- **Adding a muscle, in order:** `MUSCLE_SEED` → its regions in `ANATOMY_REGIONS` (on Male_Body painted by the user, following "Adding a painted muscle" in `CLAUDE.md`) → shapes in `ANATOMY_VIEWS` → programs (`js/programs.js`) → exercise ratings (`js/exercises.js`).

## In a sweep

**Read `docs/agents.md` first.**
- **Map the whole surface.** On Targets, sample the canvas on a fine grid with `muscleAt`, front and back, at the orbit's limits and at rest, on the sculpture, the procedural figure and the SVG fallback. Every region id is in `ANATOMY_REGIONS`, `null` regions and `body` select nothing, all 16 muscles are reachable, and islands and gaps are found. Screenshot the region map and look at it.
- **Click, don't only query.** Real clicks toggle the muscle `muscleAt` names, hover points at the same one, a muscle seen in both views is lit in both, and the `.hit` checkboxes follow.
- **Selection in sync** through programs, Clear, the family rows, priorities, reload, Front/Back and the fallback taking over.
- **Anatomy is the user's call.** A border that looks wrong is a finding with the anatomy behind it, never something to change. Painted borders are known to be unpolished: report only a wrong muscle, or an island or gap a user would hit.
