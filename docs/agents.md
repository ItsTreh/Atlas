# Agents — how a sweep works

Every agent in `.claude/agents/` reads this file first. It holds what they
share: who inspects what, who may edit what, how to drive the page, and how
to report. Each agent's own file holds only its specialty.

## Two modes

- **Review (the default).** Inspect, reproduce, report. Change nothing in the
  repo: no edits, no `npm run build:*`, no Blender, no git. Scratch work
  (scripts, screenshots) goes in the directory the lead gives you, or
  `$CLAUDE_JOB_DIR/tmp`, never in the project.
- **Fix.** Only when the lead's prompt says *fix mode* and names the findings
  to fix. Edit only the files your lane owns (table below). A fix that needs
  another lane's file is a handoff: describe it, don't make it. Add a test
  that fails without the fix when the bug is in logic. Run `npm test`. Never
  commit, push or switch branches; the lead does that when the user asks.
  Fixers run one at a time, or each in its own worktree.

The hard constraints in `CLAUDE.md` bind every agent in both modes: `file://`,
classic scripts, `MuscleSelection` as the one source of truth, estimates
labelled, tests never loosened silently, region ids stable, the anatomy
rules. Anatomy borders and which muscle a region selects are the user's
decisions: report them, never "fix" them.

## Lanes

A sweep runs these in parallel. Each lane checks its own question and leaves
the others' alone. If you notice something in another lane, give it one line
under **Seen in passing** and don't investigate it.

| Agent | Asks | Not its job |
|---|---|---|
| `qa` | Does every control do what it says, and does state survive (stages, reload, Reset, regenerate)? The rules list in `qa.md`. | Visual polish, a11y, abuse |
| `breaker` | What breaks under abuse: interrupting transitions, rapid input, hostile values, resize, storage, WebGL loss, fallbacks? | The happy path |
| `accessibility` | Keyboard, focus, screen reader, ARIA, contrast, reduced motion, zoom 200%. | Visual taste |
| `ui-ux` | How it looks and reads: both themes, every breakpoint, alignment, type, overflow, motion quality. | Behaviour |
| `anatomy` | Does every point of the body select the muscle under it, in every view and renderer, and stay in sync with the selection and the programs? | Rendering quality |
| `anatomy-implementation` | Rendering: camera shots, transitions of the sculpture, cartography, picking buffer, context loss, frame cost, load time. | Which muscle a region should be |
| `training` | Are the workouts right: exercise choice, tiers, sets, minutes, movements, edits? | Placement in the week |
| `nutrition` | Are the figures right and honest: calories, protein, meals, ideas, units, floor? | The view's look |
| `schedule` | Is the week right: busy hours, days off, recovery, frequency, moves, meals on the grid, stale warning? | Exercise choice |
| `architect` | Code health: duplicated state, logic in views, globals, dead code, docs that no longer match the code. | Runtime bugs |

## File ownership (fix mode)

| Files | Owner |
|---|---|
| `js/anatomy-sculpture.js`, `js/anatomy-cartography.js`, `js/anatomy-model*.js` (generated: change the source, rebuild), `tools/anatomy/`, `assets/anatomy/` (never edit the `.blend` or the paint) | `anatomy-implementation` |
| `js/anatomy-regions.js`, `js/anatomy.js`, `js/anatomy-stage.js`, `js/selection.js`, `js/programs.js`, `js/model.js` (muscles) | `anatomy` |
| `js/exercises.js`, `js/workouts.js`, `js/estimate.js`, `js/evidence.js`, `js/distribution.js`, `js/workout-view.js` | `training` |
| `js/nutrition.js`, `js/foods.js`, `js/nutrition-view.js` | `nutrition` |
| `js/routine.js`, `js/scheduler.js`, `js/paint.js`, `js/week-view.js` | `schedule` |
| `css/styles.css`, `js/targets.js` (layout and copy only) | `ui-ux` |
| `index.html`, `js/app.js`, `js/stages.js`, `js/render.js`, `js/storage.js`, `README.md`, `docs/`, `CLAUDE.md` | the lead |
| `tests/` | whoever owns the code under test |

`qa`, `breaker`, `accessibility` and `architect` own nothing: they find, the
owner fixes. An a11y fix in `styles.css` goes to `ui-ux`; one in a view goes
to that view's owner.

## Driving the page

- The page is `file:///Users/tred/Documents/Atlas/index.html`. No server.
- Playwright: in your scratch directory, `npm init -y && npm i playwright-core`.
  Keep it out of the repo's `package.json`. The newest Playwright may not
  match the cached browser, so launch the cached one directly:
  `executablePath` = the binary under
  `~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/`,
  with `args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']` so
  WebGL2 works headless. `--disable-webgl` gives the SVG fallback;
  `?anatomy=procedural` gives the procedural figure.
- Each agent launches its own browser with a fresh context, so sweeps don't
  share `localStorage` (`atlas.routine.v1`). Test persistence on purpose,
  with your own context.
- App globals are top-level `const`s, so they are **not** on `window`:
  `page.evaluate(() => routine.selection.size)` works,
  `window.routine` is `undefined`.
- Collect `pageerror` and `console` errors on every page. "GPU stall due to
  ReadPixels" warnings are swiftshader noise.
- A stage change takes about 1.6 s (`STAGE_TIMING`) and a camera move up to
  2.3 s (`SCULPTURE_MOVE`): wait for `$("atlas").dataset.phase === "idle"`
  (`Stages.phase`) before you assert, unless interrupting is the test.
- Look at screenshots, not only the DOM. Viewports worth covering: 1440×900,
  1280×800, 1180 and 1239 wide (the breakpoints are 760, 1180 and 1240),
  390×844 (phone).

### The page today

One fixed screen (`.atlas`), nothing scrolls the page, panes with
`data-scroll` scroll themselves. Masthead: `#stage-nav` (`[data-goto]`),
`#theme`. Footer: `#foot-back`, `#foot-dots`, `#foot-skip`, `#foot-hint`,
`#foot-next`. Stages `#stage-targets`, `#stage-nutrition`, `#stage-plan`;
the sculpture `#anatomy-stage` sits behind them all.

- **Targets:** family tabs `.tab[data-group]`, program arrows
  `.round-btn[data-step]`, dots `.pip[data-program]`, `#program-action`,
  `#focus-summary` (`#clear-sel`, `.fam-toggle[data-family-toggle]`),
  `#turn` (Front/Back), keyboard checkboxes `.hit[data-muscle][data-view]`
  (no pointer events: click the canvas; `figure.renderer.muscleAt(x, y)`
  names the muscle under a canvas point).
- **Nutrition:** `#nutrition-panel`; goals `.goal[data-goal]`, rows
  `.row-toggle[data-row]` (body, training, targets, rhythm),
  `#nu-reasons`, `#open-day`.
- **Week plan:** `#week-panel`; `#open-shape` (Shape your week: the busy
  calendar, days off, session length `[data-len]`), day stepper
  `[data-days-step]`, `[data-split]`, `[data-experience]`, `#generate`,
  `#reset-week`; then the generated week, its sessions opening into
  `workout-view.js`.

Controls carry `data-key`, used to keep focus across redraws.

## Known, already tracked

Report these as "known" if you hit them; don't spend time on them:
- `lab/anatomy-authored.html` doesn't load `js/anatomy-cartography.js`, so
  its sculpture throws and falls back to SVG.
- On the Week plan, a "your generated week" link sometimes appears beside
  Reset. A repro of *when* it appears is welcome.
- Exercise swaps aren't restored after a reload (`js/storage.js`).
- The cartography's look is still being designed. Report bugs in it, not
  taste.

## Reporting

Write to the lead, not to the user. Per finding:

```
[SEVERITY] short title                    (blocker / major / minor / nit)
Lane: <yours>   Confirmed in browser | Confirmed in code | Suspected
Repro: numbered steps, viewport, theme, renderer
Expected / Actual
Cause: file:line, and local bug or architectural
Owner: the lane that owns the fix (table above)
Evidence: screenshot path, console text, test name
```

Then **Checked and fine** (what you covered with no finding, so gaps are
visible) and **Not checked** (and why). Never pad: three real findings beat
twenty guesses. Mark anything you didn't reproduce as Suspected.
