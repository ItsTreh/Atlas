# ATLAS

**Plan a week of training around the muscles you want to build, and a schedule you actually have.**

ATLAS is a weekly training planner in three stages. Pick your target muscles on an interactive anatomy figure, get a nutrition plan built from that training, then let it place the sessions, exercises and meals into the free hours of your week.

One classical anatomical sculpture runs through all three. Moving to another stage moves the camera round it, and the interface settles around the body. The motion happens between stages; within one, everything stays still while you work.

It runs entirely in the browser: no account, no server, no build step. Open `index.html` and it works.

---

## How it works

### 01 · Targets — define your focus
Three movements, each its own framing of the sculpture: **How it works**, where the chapters play in turn and the camera shows what each stage will do; **Your muscles**; and, once something is chosen, **Training focus**. Continue, Back or a scroll moves between them, as between stages. On a wide screen, Your muscles and Training focus are each one page, scrolled: the figure crosses from side to side with the page, and each part gets the screen in turn.

- **Start from a program.** Whole-body splits, Push · Pull · Legs and classic pairings, one at a time (on a wide screen, a reel turned by the scroll; once one is chosen, scrolling on moves to refining it). Point at one to preview its muscles on the sculpture, apply it, then edit freely ("Full Body *edited* — removed Abs").
- **Or pick muscles on the body.** Click or tap any of the 16 muscle groups; click again to remove it. Front and Back turn the body round, and a sideways drag turns it a little either way to look at the borders.
- **Explore the surface.** Anatomical cartography draws fine, curved traces in the sculpture's own material. Pointing at a muscle reveals its whole training group, a little stronger near the pointer, and the traces flow while you rest there. Selected groups keep a faint, still imprint. A serif label beside the body names the group. The traces follow the existing authored borders and add no anatomy (see `docs/cartography.md`).
- **Set the focus.** Training focus lists the selection by family, each muscle with the weekly sets it starts from. Set any to Focus (more sets and days) or Maintain (the minimum, trimmed first). Resting on a row lights its muscle and turns the body to the side that shows it.

### 02 · Nutrition — fuel the training *(optional)*
- **Goal:** fat loss, muscle gain, maintenance or general fitness, each showing what it would change for your training.
- **Targets from your training:** calories are set against your daily burn and protein per kg of body weight, both adjusted to the plan's training load. The figures show the sum that made them, and every reason is one click away. You can fine-tune either.
- **Your rhythm:** meals a day, first and last meal times, and a diet style (everything, pescatarian, vegetarian, vegan).
- **A day of eating:** the day as a timeline, one meal open at a time, with its share of the day, how far the targets are met by its end, and an example plate in everyday portions near its numbers.
- **Skip it** if you only want training.

### 03 · Week plan — fit it into your life
- **See the week before you generate it.** Seven days, each with the session the planner would place there and when, plus how many days, how the week is split and how long you have trained. Notes say what fits and what won't (an estimate).
- **Shape your week.** A full-width calendar: drag down a day to mark the hours you're busy (or start from Weekdays 9–5), take days off, and set session length, preferred time and whether meals go on the calendar.
- **Generate the week.** Muscles are grouped into sessions with recovery tracked per muscle. Exercises are chosen from tiered ratings, and meals are placed around the workouts; busy hours block training, not meals, so a working day keeps its lunch. Point at a session to light its muscles on the sculpture. Open it to move it, or to swap, add or remove exercises. Your settings are saved in the browser; edits to a generated week are not kept yet. A reload comes back to the same stage; each new visit opens with a short start screen first, then goes back to where you were.

Every calorie, protein and progress figure is labelled an **estimate**, shows how it was worked out, and never promises a physique by a date.

---

## Run it

```sh
git clone https://github.com/ItsTreh/Atlas.git
cd Atlas
open index.html        # or double-click it
```

That's all. Light and dark themes are built in (top-right toggle), and the layout works from phones to large desktops. Stage titles use a classical serif (Cormorant Garamond) from Google Fonts. Opened offline, they fall back to Georgia and nothing else changes.

### Tests

```sh
npm install
npm test
```

The logic (muscles, programs, estimates, nutrition, exercise selection, scheduling) is tested with [Vitest](https://vitest.dev), running the app's own files unchanged.

---

## How it's built

Plain HTML, CSS and JavaScript as classic scripts, with no framework or bundler. That's why it opens straight from disk.

```
index.html          one screen: the sculpture, the three stages over it
css/styles.css      the ATLAS theme: tokens, light/dark, the shell, the stages
js/
  model.js          muscles, time slots, sessions — the core data
  selection.js      MuscleSelection: the one source of truth for targets
  programs.js       recommended programs
  evidence.js       the planner's figures, each with its source and certainty
  estimate.js       weekly sets and time, and fitting targets to the time
  exercises.js      exercise catalogue with tier ratings
  workouts.js       builds each session's workout
  distribution.js   spreads each muscle's weekly sets over the training days
  nutrition.js      calorie and protein targets
  foods.js          foods, diet styles, example meals
  routine.js        WeeklyRoutine: the shared plan state; places the week and its meals
  scheduler.js      finds the days and hours for the sessions
  storage.js        saving the routine in the browser, and restoring it
  anatomy*.js       the anatomy figure, its regions, cartography and camera, and its stage
  stages.js         moving between stages: motion between, stillness within
  start.js          the start screen: five openings, one per visit, that hand over to the stage
  targets.js, nutrition-view.js, week-view.js, workout-view.js
                    the stages (Targets in three movements); workout-view.js is a session in full
  targets-muscles.js, targets-train.js
                    Your muscles and Training focus as scrolled pages, on a wide screen
  render.js, paint.js, app.js
                    shared helpers, painting busy hours, generating, boot
tests/              Vitest suites
```

Data lives apart from the UI and is validated when it loads. Views read from and write to shared state (`routine`, `routine.selection`); nothing keeps its own copy.

---

## Where we are

The page shows **Male_Body**, a sculpted 3D body whose muscles are painted by hand in Blender, one region per colour, then exported to the page. Every muscle that matters for training is painted, so it selects all 16 muscle groups; `index.html?anatomy=procedural` shows the procedural figure it replaced. Borders are left as painted, for a single polishing pass later.

Every painted muscle selects the muscle actually under it. Where there's no muscle (bone, tendon, the kneecap) nothing is selectable. A few painted muscles, such as the shin muscles, are drawn but not selectable yet; they'll become explorable with zoom.

The current work is the anatomical cartography (`docs/cartography.md`): fine traces in the sculpture's material that show what is pointed at and chosen.

---

## Roadmap — the ATLAS redesign

ATLAS is mid-way through a redesign towards a calm, monochrome, gallery-like interface, with the body as its centrepiece.

- [x] Foundation: light monochrome theme, one type family, fewer surfaces
- [x] A dedicated, centred stage for the anatomy
- [x] Front/back controls and rotation: one body that turns, with a limited free orbit
- [x] A stylised 3D anatomical sculpture in place of the flat figure, painted muscle by muscle
- [x] One continuous sculpture across the stages, with camera choreography between them
- [x] Targets in three movements: How it works, Your muscles, Training focus
- [x] Redesigned nutrition stage: the plan beside the sculpture, a day of eating one meal at a time
- [x] Redesigned week-plan stage: the week before Generate, Shape your week, and the generated week beside the sculpture (see `docs/redesign.md`)
- [ ] Refined hover and selection states, a side view and zoom

### Planned for the anatomy

Agreed directions, each built only when its turn comes (see `docs/anatomy-levels.md`):

- **Three levels.** Training groups for the planner (today's 16 muscles); the individual muscles, revealed by zooming in, each with a short card on what it does and what trains it; and an exercise view that lights up everything an exercise works, with estimated contributions.
- **One anatomy knowledge dataset**, apart from the UI, that the cards and the exercise view both read. Contribution scores start as display-only estimates and don't change the planner.
- **Finer regions under the groups**, such as the three heads of the deltoid, sitting beneath the current group regions.
- **Later:** a weekly coverage map of the body, and selection that grows into a map-like "cartography" system.

