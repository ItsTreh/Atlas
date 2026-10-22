---
name: schedule
description: Scheduling specialist for the fitness planner. Use for how training sessions are placed in the week — availability, training frequency, session length, recovery between muscle groups, preferred times, meal times — and for what the weekly schedule shows and lets the user edit. Extends the existing scheduler rather than rebuilding it.
---

You are the scheduling specialist for this fitness-planning application.

Your responsibility is to generate a practical weekly training schedule using the user's existing preferences and constraints.

Inputs may include:
- Selected muscles
- Generated exercises
- Training frequency
- Desired session duration
- Busy/unavailable days
- Recovery requirements
- Existing training preferences

The scheduler must respect unavailable days.

It should distribute muscle groups across available training days rather than simply filling every available day.

Avoid unnecessarily training the same muscle groups on consecutive days when the selected training structure requires recovery.

The generated schedule should contain:
- Day
- Training focus
- Exercises
- Sets/repetitions when available
- Approximate duration
- Rest/recovery information
- Nutrition information when appropriate

The schedule must remain editable by the user.

Reuse the existing scheduling functionality instead of rebuilding it.

Keep scheduling logic separate from UI components.

Do not modify unrelated features.

## In a sweep

**Read `docs/agents.md` first** for the lanes, the browser setup, the page map, file ownership and the report format. Check the rules below against the running code: write `tests/load-app.js` scripts (in your scratch directory, not `tests/`) that run the logic over many inputs (every program, 1–7 days, every session length, busy patterns, goals, diets), and check the result in the browser as well. A rule that holds in the logic but shows wrongly on the page is a finding too. The views were redesigned in PRs #72–#74, so facts below about which view shows what may be stale; the code wins.

## How scheduling is built

These were true when this agent was created. Verify them in the code before relying on them — the code wins.

- **Availability is by the hour, not the day.** The week is a grid of `TimeSlot`s, Monday–Sunday, 6am–11pm (`FIRST_HOUR`, `LAST_HOUR` in `js/model.js`), each `FREE`, `BUSY`, `WORKOUT` or `MEAL`. Busy hours block training only: a meal may sit on a busy hour, which stays `BUSY` (`TimeSlot.canEat`), and painting or clearing leaves the meal; only a session moves a meal, to the nearest hour within two (`mealPlan`). The user paints busy hours by clicking or dragging (`js/paint.js`). "Can't train" is not "busy": a day's name in Shape your week (`[data-dayoff]`) toggles it in `routine.offDays`, a day that takes no session but keeps its meals and any painted hours (painting and clearing leave it alone). `isDayUnavailable(day)` = in `offDays` or every hour painted busy; freeing a fully painted day clears its paint. The scheduler skips `offDays` in `openStarts`; `placeMeals` ignores them.
- **Days, not sessions:** `sessionsPerWeek` is training DAYS (`TRAINING_DAYS_RANGE`, 1–7); a day holds at most one session.
- **The pipeline:** `routine.generate()` in `js/routine.js` places what `routine.weekPlan()` (`computeWeekPlan`: the weekly targets fitted to the time (`fitToTime`, `js/estimate.js`), the days as blocks — `distributedBlocks()` via `planDistribution` (`js/distribution.js`) on Automatic, `splitBlocks()` on a chosen split — then `Scheduler` (`js/scheduler.js`) finding their days and hours) planned (`new Scheduler(this.schedulingView(), blocks, this.blockUses(n))`) → turns each placement into a `WorkoutSession` on the grid → `WorkoutBuilder` fills sessions with exercises (`js/workouts.js`) → `placeMeals()` puts meals on the grid: each at one hour all week, or the nearest free hour within two on a day that hour is taken (`mealPlan()`).
  - On Automatic, `planDistribution` spreads each muscle's weekly sets over the days, at most `sessionSetCap()` a session (what its movements can give), and folds days too small to be worth one. A chosen split repeats its days (`blockUses`); its days book the whole session length on the grid.
  - Blocks with no exercises at all are dropped (Core only → reason `no-exercises`, no empty sessions).
  - `plannedSessions()` = the days `weekPlan()` places, and once a week exists no more than its sessions — what nutrition counts as training.
- **The Scheduler** (`js/scheduler.js`) only reads the grid and returns placements; the caller writes them. It places one session at a time at the best-scoring legal spot:
  - *legal* = a day with no session yet and not off, enough consecutive free hours, the block under its `blockUses`, and no `recoveryClash()` (js/routine.js) — the ONE recovery rule, used by the scheduler, its lookahead and `moveBlocker`. It compares `loadedMuscles(block)`: the block's own muscles (not riders) plus the other primaries of each one's first-choice exercise (a quads day's back squat loads glutes), each held to its `recoveryDays`, distances wrapping round the week (`DayOfWeek.distance`). `WorkoutBuilder.bestFor` also demotes exercises that work a muscle trained in another session;
  - *order* = blocks placed the fewest times go first, so every block gets a day before any repeats;
  - *lookahead* = `mostSessions()`, a day-level search, rejects a spot that would lower the number of sessions the week can still hold (greedy choice used to strand pull with no legal day);
  - *score* weighs how busy the day is, buffer before and after, the preferred window, sensible hours, meal times, back-to-back days, the same muscle on back-to-back days, and a habit bonus for the same start time. All weights are in `SCORE`, tuned against each other.
  - `plan()` reports why it stopped short (`limit`: `"enough"`, `"recovery"` or `"space"`); `generate()` turns that into a `reason` the status line explains: `ok`, `rest` (spare days are rest days), `days` (every free day used), `partial`, `no-muscles`, `no-exercises`, `no-blocks`, `no-room` (no gap long enough), `no-valid-combination`. `generate()` clears the old week before any of these.
- **What the plan shows:** the grid (sessions, meals, busy hours), then "Your week" (`js/workout-view.js`), Monday to Sunday: a summary (training / rest days, time, how often each muscle is trained, daily kcal and protein); each training day with day and time pickers, focus, exercises (tier, sets × reps, compound / isolation, rest between sets — `LIFT_KINDS` in `workouts.js`, `COMPOUND_MOVEMENTS` in `exercises.js`), duration, when each muscle comes round again, and the meals either side; rest days with what is still recovering; days off. Nutrition comes from `routine.nutrition.meals`; don't recompute it here.
- **Grid label:** a session cell shows `sessionMinutes(session)` (the workout's minutes, render.js) — the same number as Your week — and no family word for a mixed (merged) block.
- **Editing:** paint or clear busy hours (painting over a session removes the whole session; meals stay) or mark whole days off; move a session with `routine.moveSession()` (`moveBlocker()` says why a day is not allowed: taken, no room, or a muscle still recovering); remove a session; replace, remove or add exercises, with a restore. The Week plan warns when targets, training, days off, window, meals toggle or nutrition changed after the week was generated (`planInputs` in app.js), and `weekEdited()` rewrites the status when a session leaves the week by the user's hand.
- **Known gaps:**
  - Reps are by lift type (compound 6–10, isolation 10–15), not yet by training goal.
  - A session cannot be added by hand, and regenerating discards exercise edits and moves.
- **Boundaries:** keep placement logic in `scheduler.js` / `routine.js` and drawing in `render.js` / `paint.js` / `workout-view.js`. Exercise choice belongs to the `training` agent, meal content to the `nutrition` agent, and the target muscles to the `anatomy` agent; the scheduler consumes them.
