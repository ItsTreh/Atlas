# ATLAS

**Plan a week of training around the muscles you want to build, and a schedule you actually have.**

ATLAS is a weekly training planner in three stages. Pick your target muscles on an interactive anatomy figure, get a nutrition plan built from that training, then let it place the sessions, exercises and meals into the free hours of your week.

One classical anatomical sculpture runs through all three. Moving to another stage moves the camera round it, and the interface settles around the body. The motion happens between stages; within one, everything stays still while you work.

It runs entirely in the browser: no account, no server, no build step. Open `index.html` and it works.

---

## How it works

### 01 · Targets — define your focus
- **Start from a program.** Whole-body splits, Push · Pull · Legs and classic pairings, one at a time with ← and →. Point at one to preview its muscles on the sculpture, apply it, then edit freely ("Full Body *edited* — removed Abs").
- **Or pick muscles on the body.** Click or tap any of the 16 muscle groups; click again to remove it. Front and Back turn the body round, and a sideways drag turns it a little either way to look at the borders.
- **Explore the surface.** Anatomical cartography reveals sparse points across the sculpture, resolving into a denser field near the muscle you point at. Fine contours and a quieter point field mark your selection; the caption names the anatomical region and its training group. The map follows the existing authored borders (see `docs/cartography.md`).
- **Set the focus.** The selection is grouped by family. Set any muscle to Focus (more sets and days) or Maintain (the minimum, trimmed first), and tell ATLAS how long you have trained.
- **See what it will take.** A preliminary estimate of weekly hard sets and time a week, with frequency, what consistent training usually brings, and the caveats stated plainly, one click away.

### 02 · Nutrition — fuel the training *(optional)*
- **Goal:** fat loss, muscle gain, maintenance or general fitness, each showing what it would change for your training.
- **Targets from your training:** calories are set against your daily burn and protein per kg of body weight, both adjusted to the plan's training load. The figures show the sum that made them, and every reason is one click away. You can fine-tune either.
- **Your rhythm:** meals a day, first and last meal times, and a diet style (everything, pescatarian, vegetarian, vegan).
- **A day of eating:** the day as a timeline, one meal open at a time, with its share of the day, how far the targets are met by its end, and an example plate portioned to it.
- **Skip it** if you only want training.

### 03 · Week plan — fit it into your life
- **See the week before you generate it.** Seven days, each with the session the planner would place there and when, plus how many days and how the week is split. Notes say what fits and what won't (an estimate).
- **Shape your week.** A full-width calendar: drag down a day to mark the hours you're busy (or start from Weekdays 9–5), take days off, and set session length, preferred time and whether meals go on the calendar.
- **Generate the week.** Muscles are grouped into sessions with recovery tracked per muscle. Exercises are chosen from tiered ratings, and meals are placed around the workouts. Point at a session to light its muscles on the sculpture. Open it to move it, or to swap, add or remove exercises.

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
  estimate.js       the "what it will take" estimate
  exercises.js      exercise catalogue with tier ratings
  workouts.js       builds each session's workout
  nutrition.js      calorie and protein targets
  foods.js          foods, diet styles, example meals
  routine.js        WeeklyRoutine: the shared plan state
  scheduler.js      places sessions and meals in the week
  anatomy*.js       the anatomy figure, its camera, and the stage it lives in
  stages.js         moving between stages: motion between, stillness within
  targets.js, nutrition-view.js, week-view.js, workout-view.js
                    the stages; workout-view.js is a session in full
  render.js, paint.js, app.js
                    shared helpers, painting busy hours, generating, boot
tests/              Vitest suites
```

Data lives apart from the UI and is validated when it loads. Views read from and write to shared state (`routine`, `routine.selection`); nothing keeps its own copy.

---

## Where we are

The current work is the anatomy: replacing the procedural figure with **Male_Body**, a sculpted 3D body whose muscles are painted by hand in Blender, one region per colour, then exported to the page. It's the figure the page shows; `index.html?anatomy=procedural` shows the procedural figure it replaced.

- **Painted so far:** the chest, abs, obliques, serratus, deltoids, trapezius and the whole arm (biceps, triceps, brachialis, coracobrachialis and the forearm muscles one by one).
- **Still to paint:** the rest of the back, the hips and the legs. Until they're painted, those areas use stand-in regions. The order is one muscle at a time, then a single pass to polish all the borders.
- **Just added:** one body that turns between front and back, with a small drag to look around it. It came early because it makes the painted borders easier to inspect; painting continues next.

Every painted muscle selects the muscle actually under it. Where there's no muscle (bone, tendon, the kneecap) nothing is selectable. A few painted muscles, such as the shin muscles, are drawn but not selectable yet; they'll become explorable with zoom.

---

## Roadmap — the ATLAS redesign

ATLAS is mid-way through a redesign towards a calm, monochrome, gallery-like interface, with the body as its centrepiece.

- [x] Foundation: light monochrome theme, one type family, fewer surfaces
- [x] A dedicated, centred stage for the anatomy
- [x] Front/back controls and rotation: one body that turns, with a limited free orbit
- [ ] A stylised 3D anatomical sculpture in place of the flat figure *(painting in progress, behind a flag)*
- [x] One continuous sculpture across the stages, with camera choreography between them
- [x] Side rails for programs and training focus (Targets, stage 1 of the redesign)
- [x] Redesigned nutrition stage: the plan beside the sculpture, a day of eating one meal at a time
- [x] Redesigned week-plan stage: the week before Generate, Shape your week, and the generated week beside the sculpture (see `docs/redesign.md`)
- [ ] Refined hover and selection states, a side view and zoom

### Planned for the anatomy

Agreed directions, each built only when its turn comes (see `docs/anatomy-levels.md`):

- **Three levels.** Training groups for the planner (today's 16 muscles); the individual muscles, revealed by zooming in, each with a short card on what it does and what trains it; and an exercise view that lights up everything an exercise works, with estimated contributions.
- **One anatomy knowledge dataset**, apart from the UI, that the cards and the exercise view both read. Contribution scores start as display-only estimates and don't change the planner.
- **Finer regions under the groups**, such as the three heads of the deltoid, sitting beneath the current group regions.
- **Later:** a weekly coverage map of the body, and selection that grows into a map-like "cartography" system.

