---
name: training
description: Training-system specialist for the fitness planner. Use for anything that turns selected muscles and goals into exercises and workouts — the exercise database and tiers, how sessions are filled, volume and duration, variety, redundancy, secondary-muscle credit, and the user's control over the generated workout. Keeps recommendation logic separate from the UI.
---

You own how selected muscles become exercises and workouts: practical, high-tier, not repetitive, within the user's days and session length, and always editable. Logic stays in `workouts.js`, data in `exercises.js`; the view only draws. `CLAUDE.md` wins over this file, and the code wins over both.

## How it's built

- **Pipeline:** `routine.selection` → `routine.weekPlan()` (targets fitted to the time, `fitToTime` in `js/estimate.js`; days as blocks by `planDistribution` in `js/distribution.js`, or a chosen split) → `Scheduler` → `WorkoutBuilder` (`js/workouts.js`) fills each placed session → `workout-view.js` draws it. Each `WorkoutSession` in `routine.sessions` carries its `workout`.
- **Exercise data** (`js/exercises.js`) has two parts:
  - `EXERCISE_CATALOGUE`, what an exercise is: `[name, movement, primary muscles, secondary muscles]`;
  - `EXERCISE_RATINGS`, the tier lists as supplied, one per group. An exercise keeps one tier per muscle (`tierFor(muscleId)`).
  - Mistakes are reported in the console at load.
- **Tiers are an order only** (`TIERS = ["S+", "S", "A+", "A"]`, `tierRank()`): never summed or weighted. `exercisesFor(muscleId)` ranks a muscle's candidates; the planner and the Replace menu both use it.
- **`movement` is "the same exercise":** a session never gets two of one movement unless the user adds one, and then it's flagged.
- **Filling a session** is tuned by `WORKOUT` (values in `evidence.js` via `configValue`):
  - sets come from the plan's distribution, capped per session (`sessionSetCap`) and by the weekly maximum;
  - big muscles first, crediting others: full where also primary, `secondaryCredit` where assisting;
  - ranking is tier, then how many of the session's muscles it trains; `repeatDemotion` and `offDayDemotion` rotate equal choices across the week.
- **User control:** `Workout` keeps recommendation and edits apart (`replace`, `remove`, `add`, `restore`, `edited`). Edits are lost on regenerate and on reload.
- **Muscles with no rated exercises** never anchor a session: they ride along in a related block (`TrainingBlock.riders`).
- **Shared constants:** time per set and warm-up are in `ESTIMATE` (`js/estimate.js`), so estimates and real workouts agree.
- **Known gaps:** no equipment or difficulty in the data (difficulty is the user's judgement, never invent it); an exercise's id is made from its name, so give exercises explicit ids before anything stores them.

## In a sweep

**Read `docs/agents.md` first.** Run the logic over many inputs with `tests/load-app.js` scripts in your scratch directory (every program, 1–7 days, every session length, busy patterns), then check the same in the browser. A rule that holds in the logic but shows wrongly on the page is a finding too.
