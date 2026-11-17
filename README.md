<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/atlas-plate-dark.svg">
  <img alt="ATLAS, a weekly training planner. I Targets, II Measure, III Nutrition, IV Week plan." src=".github/atlas-plate-light.svg" width="100%">
</picture>

<br>

**Plan a week of training around the muscles you want to build, and the hours you actually have.**

ATLAS is a weekly training planner built around a single sculpture. You choose muscles on a marble anatomical figure, give your measure, see what to eat for that training, and ATLAS places the sessions, exercises and meals into the free hours of your week.

The body never leaves the screen. Moving to another stage moves the camera around it, and the interface settles beside it: motion happens between stages, and within a stage everything stays still while you work.

It runs entirely in your browser. There is no account, no server and no build step: open `index.html` and it works. Nothing you enter leaves your machine.

> [!NOTE]
> ATLAS is a work in progress, built in the open. All four stages have their new design; the maths behind them is being evidenced next. See [the roadmap](#roadmap).

<br>

## The four stages

Each new visit opens on the sculpture in one of five ways: the figure from below, the chest rising from the bottom edge, the name carved out of the ground with the camera diving through the T, the back of the shoulder up close, or the whole figure standing before the five letters. You see each one once before any repeats. Closing ATLAS and opening it again starts at Targets, with everything you entered still there; a reload skips the opening and returns you to where you were.

| | Stage | What you do there | State |
|:-:|---|---|---|
| **I** | Targets | Pick muscles on the sculpture, then set each to Focus, Normal or Maintain. | Redesigned. The maths isn't evidenced yet. |
| **II** | Measure | Give your stature, mass, years and physiology on four bronze rings round the figure, then strike your mark. | Redesigned. Nutrition reads the weight. |
| **III** | Nutrition | Get calorie and protein targets worked out from the training, then walk the day meal by meal. | Redesigned. The maths isn't evidenced yet. |
| **IV** | Week plan | Mark your busy hours on each day's ring of hours, then get sessions, exercises and meals placed in what's left. | Redesigned. The maths isn't evidenced yet. |

### I · Targets

Targets has three movements, each with its own framing of the sculpture.

- **How it works.** The figure steps aside and acts out each stage as its chapter plays.
- **Your muscles.** Start from a program (whole-body splits, Push · Pull · Legs, or classic pairings), then refine it on the body. Pointing at a program previews its muscles on the sculpture. Click or tap any of the 16 muscle groups to add or remove it. Front and Back turn the body round, and a sideways drag turns it a little either way.
- **Training focus.** Your selection, grouped by family, each muscle with the weekly sets it starts from. Set a muscle to Focus for more sets and days, or Maintain for the minimum, which is trimmed first when the week is short. Resting on a row lights that muscle and turns the body to show it.

On the start screen, Targets and Measure, the light on the sculpture follows your pointer like a lamp held up to marble. Pointing at a muscle draws fine engraved traces across its whole training group, in the sculpture's own material, with a serif label beside the body. This is the **anatomical cartography** ([`docs/cartography.md`](docs/cartography.md)). The traces follow the painted borders and never invent anatomy.

### II · Measure

Measure is an instrument: four bronze rings hang round the figure, one for each fact, each read at the front under its index. A ring over the crown for your height, one at the waist for your weight, the widest, leaning, for your years, and one round the feet for the physiology the resting-burn equation uses. Turn a ring by dragging it, with its coins or by typing; the body turns with the ring in hand. Scroll to go from fact to fact, each with its own camera. Last, the camera rises to look straight down, the four rings close into the rim of a medal, and **your mark** is struck: a disc of polished stone inscribed with your name and the day.

Nutrition plans from the weight given here. The rest of Measure doesn't affect the plan yet: wiring it into training and the resting-burn maths is next on the roadmap.

### III · Nutrition *(optional)*

Nutrition is a room in perspective: a marble floor laid to a vanishing point, a gilt meridian inlaid with the hours, an arch over each meal at its hour, and at the far wall a niche where the sculpture stands. Scroll, use the arrow keys or the footer's beads to walk the day.

- **The sum:** your goal (fat loss, muscle gain, maintenance or general fitness, each showing the change it makes for this training), the calories and protein to eat, steppers for both, and how it's worked out, line by line. Your body weight comes from Measure.
- **The day in one sentence:** how many meals, from which hour to which, eating what. Each word opens its own chooser.
- **Each meal:** its hour (move it earlier or later), its calories and protein with the day's running total, and an example plate portioned to it. Point at a food to see what it brings, or turn to other ideas.
- **The day, laid:** every meal's calories and protein together, with the figure in the niche behind.

### IV · Week plan

The day is a ring of hours behind the figure, the sun's path from six in the morning at the left to midnight at the right. The week is told one day at a time, then all at once. Scroll, use the arrow keys or the footer's small suns to move between days.

- **Each day.** Drag along its ring over the hours that aren't yours, and drag again to free them. The session the planner would place moves to the hours left, clear of your meals. Take the day off, copy the day before (or Monday to the whole working week), or clear it. The day's muscles are marked on the sculpture as Targets marks a selection, and its name is written low behind the figure, woven through the legs.
- **The light.** The hour you point at is the hour of the light. The page takes that hour's colours (dawn rose, morning lemon, noon white, golden amber, sunset coral, dusk violet, night blue), the sun on the ring turns into a moon after dusk, and the sculpture is lit from where the sun stands, in that hour's colour.
- **The week.** Seven rings, Monday at the centre, and the week's terms as one sentence: days a week, session length, time of day, split and experience, each word opening its chooser. Pointing at an option shows what the week would become. A note says whether the targets look like they'll fit (an estimate).
- **Your week.** Generated, it fills the screen: seven arches on one horizon, each with its session, every exercise with its sets and reps, and the week's sessions, hours, hard sets, kcal and protein, all estimates. Pointing at a day names it under its column; opening it shows the session on its ring. Drag it to another hour, swap any exercise, or move it to another day that has room and lets every muscle recover. Busy hours block training but not meals, so a working day keeps its lunch.

Your inputs are saved in the browser. Edits to a generated week aren't kept yet: a reload rebuilds the week from the same inputs.

<br>

## What ATLAS holds to

- **Every number is an estimate, and it says so.** Each calorie, protein and progress figure shows how it was worked out. ATLAS never promises a physique by a date.
- **Evidence is kept apart from decisions.** [`js/evidence.js`](js/evidence.js) records what the research says and how sure it is. Each planner value is labelled *evidence*, *heuristic*, *preference*, *optimization* or *safety*. A value may be called evidence only when a source supports that exact number, and today none is.
- **Anatomy comes first.** Every clickable area selects the muscle actually under it. Bone, tendon, the kneecap and the point of the elbow select nothing.
- **Four pigments for four families.** Push is yellow ochre, Pull Egyptian blue, Legs green earth and Core madder rose. These are the four colours under the name above.

<br>

## Run it

```sh
git clone https://github.com/ItsTreh/Atlas.git
cd Atlas
open index.html        # or double-click it
```

That's all: it opens straight from disk, with no build step and no server. Light and dark themes are built in (top-right toggle). The titles use Cormorant Garamond, which ships with the page, so ATLAS looks the same offline. A Content-Security-Policy in `index.html` lets the page load only its own files.

It's designed for desktop first. The phone layout works but is due its own redesign.

| URL | Opens |
|---|---|
| `index.html?start=off` | Skips the opening |
| `index.html?start=carved` | A chosen opening: `cinematic`, `torso`, `carved`, `detail` or `monument` |
| `index.html?anatomy=procedural` | The procedural figure that came before the sculpture |

### Tests

```sh
npm install
npm test
```

The [Vitest](https://vitest.dev) suites run the app's own files unchanged, loading them in Node in the same order and shared scope the browser uses. They cover the muscles, programs, evidence, estimates, nutrition, exercise selection and scheduling. They also check the sculpture's data and regions, the cartography, saving and restoring, and that no two scripts declare the same global.

<br>

## How it's built

The app is plain HTML, CSS and JavaScript, loaded as classic scripts in dependency order, with no framework, bundler or modules. That's why it opens from `file://`. The data stays apart from the UI: views read and write one shared state (`routine`, and `routine.selection` for the targets), and nothing keeps its own copy.

### The sculpture

```
assets/anatomy/Male_Body.blend         sculpted, and painted by hand in Blender: one colour per muscle
  + Male_Body.paint.png / .paint.json  the paint, and which colour names which region
  ▼  tools/anatomy/authored/male_body.py   cuts the mesh along the painted borders
assets/anatomy/male-body.glb           one primitive per region
  ▼  tools/anatomy/build-authored.mjs
js/anatomy-model-male-body.js          what the page loads
  ▼  js/anatomy-regions.js             region → one of the 16 muscle groups, or nothing
```

Every training muscle is painted, so the sculpture selects all 16 groups. Some painted muscles that no program trains, such as those of the shin, are drawn but not selectable. The renderer is WebGL2 with a matte marble material. Without WebGL2, an SVG figure takes over. If the sculpture's file is missing, the procedural figure (`npm run build:anatomy`) stands in. A rigged copy, `Male_Body_rigged.blend` (59 bones), is being prepared for posing, and the app doesn't use it yet ([`docs/male-body-rig.md`](docs/male-body-rig.md)).

### Files

```
index.html               one screen: the sculpture, with the four stages over it
css/styles.css           the theme: tokens, light and dark, the shell, every stage
fonts/                   Cormorant Garamond, under the SIL Open Font License (OFL.txt)

js/                      ── data and logic: no page code, all tested ──
  model.js               the 16 muscles, time slots, training blocks
  selection.js           MuscleSelection, the one source of truth for targets
  programs.js            the preset programs
  evidence.js            findings with sources, and every planner value with its origin
  estimate.js            weekly sets and time, and fitting targets to the time
  exercises.js           the exercise catalogue and its tier ratings
  set-credit.js          how much a set counts for each muscle, where growth was measured
  workouts.js            each session's exercises
  distribution.js        spreads each muscle's weekly sets over the training days
  routine.js             WeeklyRoutine, the shared plan; places the week and its meals
  scheduler.js           finds the days and hours for the sessions
  nutrition.js, foods.js calorie and protein targets; foods, diets, example meals
  measure.js             the measure's four facts and your mark
  storage.js             saves your inputs in the browser, and restores them

                         ── the figure ──
  anatomy-load.js        loads the sculpture, unless ?anatomy=procedural
  anatomy-model*.js      the procedural figure and the sculpture (generated)
  anatomy-regions.js     region → app muscle
  anatomy-sculpture.js   the WebGL2 renderer, its camera shots and the lamp
  anatomy-cartography.js the surface samples the traces flow along
  anatomy.js             the SVG fallback
  anatomy-stage.js       the room the body stands in, between the page and a renderer

                         ── the page ──
  boot.js                shows the plain page if a script fails before start
  stages.js              moving between stages: out, moving, idle
  start.js               the five openings
  targets.js             Targets' three movements
  targets-muscles.js, targets-train.js
                         Your muscles and Training focus as scrolled pages, on a wide screen
  flow-front.js          the words behind the body, woven in front of the nearer leg
  measure-view.js        Measure: the four rings and your mark
  nutrition-view.js      Nutrition: the room in perspective, the sum and the walk through the day
  week-view.js           the Week plan: the day's ring, the hour's light, the week
  workout-view.js        what a generated week is missing, and how a session is named
  render.js, app.js      shared helpers; wiring and boot

assets/anatomy/          the sculpture, its paint and its export (all rights reserved)
tools/anatomy/           the Blender export and the builds that turn it into scripts
tests/                   Vitest suites; load-app.js runs the real scripts in Node
docs/                    design notes: the redesign, the cartography, anatomy levels, the rig; the training evidence
CLAUDE.md, .claude/      working notes and agents for building ATLAS with Claude Code
```

<br>

## Where it's heading

The four stages are the path for a new user. Once you've been through them, your plan will live in **My Atlas**, where you adjust it instead of starting over. A recovery section will live there too, alongside ideas still being settled.

ATLAS is a website first, with no backend yet. A backend comes next, and a native app after that.

## Roadmap

**Done**
- [x] The theme: calm, monochrome, gallery-like, with light and dark modes and the serif
- [x] Male_Body, a sculpted 3D body painted muscle by muscle, selecting all 16 groups
- [x] One sculpture across every stage, with the camera moving between named shots
- [x] Front and Back, with a limited drag orbit, and a lamp that follows the pointer
- [x] The start screen and its five openings
- [x] Targets in three movements: How it works, Your muscles, Training focus
- [x] Measure, as four bronze rings round the figure and your mark
- [x] Nutrition, as the day in perspective: the sum, each meal in its arch, the day laid out at the figure's niche
- [x] The Week plan, as the day's ring of hours in the hour's light: a day at a time, then the week
- [x] An evidence register that labels where every planner value comes from
- [x] The anatomical cartography: engraved traces for hover and selection
- [x] AGPL licensing, a local font, and a Content-Security-Policy

**Now: the maths of Targets, based on research** ([`docs/training-evidence.md`](docs/training-evidence.md))
- [ ] Map the existing Targets logic: how priorities are stored, how exercises are assigned, how the Week plan uses them
- [ ] Define the weekly targets in one place: Maintain about 4 sets, Normal about 10, Focus about 12–18, as planning defaults
- [ ] Count each muscle's direct weekly sets, never the same set twice
- [ ] Add estimated credit from compound lifts to the muscles that assist
- [ ] Handle short weeks: keep maintenance work first, give Focus the extra volume, cut optional work
- [ ] Connect it to the Week plan, so changing a priority changes the plan predictably
- [ ] Show whether each muscle is below, within or above its range, with credit marked as an estimate
- [ ] Polish the painted borders, one muscle at a time

**After that**
1. Make Measure's data affect the training algorithm.
2. Evidence Nutrition's maths the same way as Targets.
3. Evidence the Week plan's maths.
4. Redesign the full phone layout.
5. Add a backend, then My Atlas for returning users, with saved data.
6. Make it an app.
7. Add a fitness news section.

**For the anatomy** ([`docs/anatomy-levels.md`](docs/anatomy-levels.md))
- Zoom, added to the same camera.
- Three levels: the 16 training groups; the individual muscles, revealed by zooming in, each with a card on what it does and what trains it; and an exercise view that lights everything an exercise works.
- Finer regions under the groups, such as the three heads of the deltoid.
- Later, a weekly coverage map of the body.

**An idea, not a commitment**
- Optional sharing of progress: globally, locally or with friends.

<br>

## License

© 2026 Tred ([github.com/ItsTreh](https://github.com/ItsTreh)).

The code is licensed under the [GNU Affero General Public License v3.0 or later](LICENSE). If you run a modified version for others, including as a website, you must offer them its source.

The Male_Body sculpture is **not** under the AGPL: it is all rights reserved. That covers its `.blend` files (including the rigged one), the paint image and its colour key, the `.glb`, the manifest and `js/anatomy-model-male-body.js`; [ASSETS-LICENSE.md](ASSETS-LICENSE.md) lists them. Without the sculpture, ATLAS falls back to the procedural figure, which is AGPL like the rest of the code.

Cormorant Garamond is © the Cormorant Project Authors, under the [SIL Open Font License 1.1](fonts/cormorant-garamond/OFL.txt).
