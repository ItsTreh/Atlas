# ATLAS

**Plan a week of training around the muscles you want to build, and a schedule you actually have.**

ATLAS is a weekly training planner in three stages. Pick your target muscles on an interactive anatomy figure, get a nutrition plan built from that training, then let it place the sessions, exercises and meals into the free hours of your week.

It runs entirely in the browser: no account, no server, no build step. Open `index.html` and it works.

---

## How it works

### 01 · Targets — define your focus
- **Pick muscles on the body.** Click or tap any of the 16 muscle groups; click again to remove it. Front and Back turn the body round, and a sideways drag turns it a little either way to look at the borders.
- **Or start from a program.** Full Body, Upper/Lower, Push · Pull · Legs and classic pairings. Point at one to preview its muscles, then edit freely ("Based on Push — added Abs").
- **See what it will take.** A preliminary estimate of weekly hard sets, time a week, training frequency, and what consistent training usually brings, with the caveats stated plainly.

### 02 · Nutrition — fuel the training
- **Goal:** fat loss, muscle gain, maintenance or general fitness.
- **Targets from your training:** calories are set against your daily burn and protein per kg of body weight, both adjusted to the plan's training load. You can fine-tune either.
- **Your rhythm:** meals a day, first and last meal times, and a diet style (everything, pescatarian, vegetarian, vegan), with example meals that hit the numbers.

### 03 · Week plan — fit it into your life
- **Paint your availability.** Click or drag across the hourly grid to block the time you're busy.
- **Choose how you train:** sessions a week, session length, days off and preferred time of day.
- **Generate the week.** Muscles are grouped into sessions with recovery tracked per muscle. Exercises are chosen from tiered ratings, and meals are placed around the workouts. You can then swap, add or remove exercises.

Every calorie, protein and progress figure is labelled an **estimate**, shows how it was worked out, and never promises a physique by a date.

---

## Run it

```sh
git clone https://github.com/ItsTreh/Atlas.git
cd Atlas
open index.html        # or double-click it
```

That's all. Light and dark themes are built in (top-right toggle), and the layout works from phones to large desktops.

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
index.html          the three stages
css/styles.css      the ATLAS theme: tokens, light/dark, layout
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
  anatomy*.js       the anatomy figure and the stage it lives in
  targets.js, nutrition-view.js, workout-view.js, render.js, paint.js, app.js
                    the views and wiring
tests/              Vitest suites
```

Data lives apart from the UI and is validated when it loads. Views read from and write to shared state (`routine`, `routine.selection`); nothing keeps its own copy.

---

## Where we are

The current work is the anatomy: replacing the procedural figure with **Male_Body**, a sculpted 3D body whose muscles are painted by hand in Blender, one region per colour, then exported to the page. It's on `main` behind a flag; open `index.html?anatomy=male-body` to see it. Without the flag the page shows the procedural figure.

- **Painted so far:** the chest, abs, obliques, serratus, deltoids, trapezius and the whole arm (biceps, triceps, brachialis, coracobrachialis and the forearm muscles one by one).
- **Still to paint:** the rest of the back, the hips and the legs. Until they're painted, those areas use stand-in regions. The order is one muscle at a time, then a single pass to polish all the borders.
- **Just added:** one body that turns between front and back, with a small drag to look around it. It came early because it makes the painted borders easier to inspect; painting continues next.

Every painted muscle selects the muscle actually under it. Where there's no muscle (bone, tendon, the kneecap) nothing is selectable. A few painted muscles, such as the serratus anterior, are drawn but not selectable yet; they'll become explorable with zoom.

---

## Roadmap — the ATLAS redesign

ATLAS is mid-way through a redesign towards a calm, monochrome, gallery-like interface, with the body as its centrepiece.

- [x] Foundation: light monochrome theme, one type family, fewer surfaces
- [x] A dedicated, centred stage for the anatomy
- [x] Front/back controls and rotation: one body that turns, with a limited free orbit
- [ ] A stylised 3D anatomical sculpture in place of the flat figure *(painting in progress, behind a flag)*
- [ ] Refined hover and selection states, a side view and zoom
- [ ] Side rails for programs and training demand
- [ ] Redesigned nutrition and week-plan stages

### Planned for the anatomy

Agreed directions, each built only when its turn comes (see `docs/anatomy-levels.md`):

- **Three levels.** Training groups for the planner (today's 16 muscles); the individual muscles, revealed by zooming in, each with a short card on what it does and what trains it; and an exercise view that lights up everything an exercise works, with estimated contributions.
- **One anatomy knowledge dataset**, apart from the UI, that the cards and the exercise view both read. Contribution scores start as display-only estimates and don't change the planner.
- **Finer regions under the groups**, such as the three heads of the deltoid, sitting beneath the current group regions.
- **Later:** a weekly coverage map of the body, and selection that grows into a map-like "cartography" system.

