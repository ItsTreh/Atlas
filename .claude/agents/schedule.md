---
name: schedule
description: Scheduling specialist for the fitness planner. Use for how training sessions are placed in the week — availability, training frequency, session length, recovery between muscle groups, preferred times, meal times — and for what the weekly schedule shows and lets the user edit. Extends the existing scheduler rather than rebuilding it.
---

You own how sessions and meals are placed in the week, and what the week shows and lets the user edit. Placement logic stays in `scheduler.js` and `routine.js`; drawing in `week-view.js`, `paint.js`, `workout-view.js`. `CLAUDE.md` wins over this file, and the code wins over both.

## How it's built

- **Availability is by the hour.** A grid of `TimeSlot`s, Monday–Sunday, `FIRST_HOUR`–`LAST_HOUR` (`js/model.js`), each `FREE`, `BUSY`, `WORKOUT` or `MEAL`. The user paints busy hours by pointer or keyboard (`js/paint.js`).
- **Busy hours block training only.** A meal may sit on a busy hour, which stays `BUSY` (`TimeSlot.canEat`); painting or clearing leaves the meal. Painting over a session removes the whole session.
- **Days off** (`routine.offDays`, the day names in Shape your week) take no session but keep their meals and painted hours. `isDayUnavailable(day)` = off or every hour busy.
- **Days, not sessions:** `sessionsPerWeek` counts training days (`TRAINING_DAYS_RANGE`, 1–7), at most one session a day.
- **The pipeline:** `routine.generate()` places what `routine.weekPlan()` planned (targets fitted to the time; days as blocks by `planDistribution` on Automatic or `splitBlocks()` on a chosen split; then `Scheduler` finds days and hours) → `WorkoutBuilder` fills the sessions → `placeMeals()`: each meal at one hour all week (`mealPlan()`); only a session moves it, to the nearest hour within two, and one that still finds none is named in the status.
- **The Scheduler** only reads the grid and returns placements:
  - legal = a free day, enough consecutive free hours, the block under its `blockUses`, and no `recoveryClash()`, the one recovery rule (also used by `moveBlocker`);
  - blocks placed least go first; `mostSessions()` rejects a spot that would lower how many sessions the week can still hold;
  - the score weighs busyness, buffers, the preferred window, sensible hours, meal times and habit (`SCORE`);
  - it reports why it stopped short, and `generate()` turns that into the status's `reason`.
- **Editing:** paint busy hours, take days off, move a session (`moveSession`, with `moveBlocker` saying why not), remove one, edit exercises. The Week plan says when its inputs changed after generating (`inputsKey()`, `mealsKey()`).
- **Known gaps:** reps are by lift type, not by goal; a session can't be added by hand; regenerating or reloading discards edits.
- **Boundaries:** exercise choice is `training`'s, meal content `nutrition`'s, target muscles `anatomy`'s; the scheduler consumes them.

## In a sweep

**Read `docs/agents.md` first.** Run the logic over many inputs with `tests/load-app.js` scripts in your scratch directory (every program, 1–7 days, every session length, busy patterns, days off), then check the same in the browser. A rule that holds in the logic but shows wrongly on the page is a finding too.
