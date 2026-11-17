# The stage redesign

ATLAS is moving to the stage-based design worked out in Claude Design
(*ATLAS Stages v3*). This file is the running record of that change: what
the design asks for, how it is built here, what was kept from the app that
the prototype left out, and the decisions taken along the way. It lands one
stage at a time, one pull request each:

| Stage | Branch | Status |
|---|---|---|
| 01 Targets, plus the shell and the sculpture's camera | `redesign/01-targets` | PR #72 |
| 02 Nutrition | `redesign/02-nutrition` | PR #73 (stacked on #72) |
| 03 Week plan | `redesign/03-week-plan` | this PR (stacked on #73) |

While a stage's redesign hadn't landed, it kept working as it was, inside a
full-screen panel over the sculpture (`css/legacy.css`, scoped to
`.legacy`). Stage 3 removes the last of it. Nothing in the logic changes:
the redesign is the views, the styles and the renderer. Every test runs the
same logic files as before.

## The principles

From the design conversation, in the user's words where possible:

- **The sculpture is a living part of the interface.** One continuous
  element across every stage. Moving to another stage moves the camera
  round the body; the interface settles around it.
- **Motion helps users understand where they are going. Stillness helps
  them concentrate on what they are doing.** The camera moves only when the
  stage changes, then settles. Nothing drifts while the user works.
- **The information goes to you, not you to the information.** Progressive
  disclosure: show what is needed at the moment it is needed, but never
  hide important settings so aggressively that the user has to guess where
  they went.
- **Minimalism is making the next action obvious**, not just having fewer
  boxes.
- A restrained, Greek-sculpture aesthetic: monochrome, a classical serif
  for stage titles and figures only.

## How it is built

### One screen

`index.html` is one fixed screen (`.atlas`). Nothing scrolls the page; a
pane with more than fits scrolls on its own (`data-scroll`). Layers, back
to front:

1. the sculpture (`#anatomy-stage`), the whole screen (on a phone, a band
   under the masthead);
2. the stages (`.stage`), each laying its interface over the sculpture
   (Targets leaves its middle open so the pointer reaches the body);
3. the masthead (ATLAS, the three stages, the theme) and the footer (back,
   the way on, and on a phone the stages as numbered dots).

### Moving between stages — `js/stages.js`

A change of stage runs in three phases, and nothing moves outside them:

| Phase | What happens |
|---|---|
| `out` (300 ms) | the stage's interface fades |
| `moving` (1250 ms, or until the camera lands if its move is longer) | the new stage is drawn, the camera travels to its shot; at 1250 ms the interface comes in group by group (`data-shown`, `data-reveal="0/1/2"`), without waiting for the camera |
| `idle` | the camera has landed; the controls are live, the sculpture can be picked (Targets) |

`Stages.relayout()` runs the same phases for a change inside a stage that
rearranges the screen. With reduced motion the phases shrink to a swap.

Each stage registers a view: `enter`, `shot`, `dim`, `highlight`, `footer`,
`onNext`/`onBack`/`onSkip`, `wheel`, `focus`. The controller only
sequences; the views own their content; the routine owns the data. Users
move with the masthead, the footer, any `data-goto` link, or an intentional
scroll (a firm wheel gesture over anything that is not itself scrolling).
Focus follows the user to the new stage when it was left on the old one.

### The sculpture's camera — `js/anatomy-sculpture.js`

The prototype drew the sculpture with three.js from a CDN and fetched the
`.glb`. Both break the rule that the page opens from disk, so the camera was
built into the existing WebGL2 renderer instead. Picking, the keyboard
checkboxes, Front/Back, the drag orbit, context-loss recovery and the SVG
fallback all keep working.

- **Perspective, not orthographic.** A 20° lens, so it still reads as a
  sculpture seen across a gallery, not a scene.
- **Named shots** (`SCULPTURE_SHOTS`). These are the prototype's framings
  converted to the model's centimetres; any other figure is scaled by its
  height. They are framing A for Targets, C for Nutrition and B for the Week
  plan, the ones the user chose:

  | Shot | Where | az | el | aim | distance | on screen |
  |---|---|---|---|---|---|---|
  | `targets-front` / `-back` | Targets | 0 / 180 | 2 | 79 cm | 615 cm | centre |
  | `nutrition` | Nutrition | −18 | −26 | 124 cm | 250 cm | left |
  | `plan` | Week plan, on a phone | 36 | −7 | 116 cm | 270 cm | right |

  On a wide screen the Week plan stands the figure on its ring each frame
  (`standAt`, the shot `plan-ring` is only where a change of stage heads).

  `SCULPTURE_MOBILE` reframes them for the phone band.
- **The move** lasts 1.35–2.3 s depending on how far round the body it goes,
  eases in and out, and pulls back a little while swinging round, so it
  never cuts through the figure. Front ↔ Back is the old 650 ms half-turn,
  in the direction a drag already started.
- **The gallery light** (`setLight`, `SCULPTURE_LIGHT`). On the start
  screen and Targets, a mouse or pen moves the key light like a lamp held
  up to the sculpture; it eases after the pointer and rests where it was
  left. Nutrition and the Week plan are forms, so there it returns to rest.
  Touch and reduced motion leave it still.
- **Only Targets is interactive** (`setInteractive`). There the selection
  shows and the pointer picks. Elsewhere the figure rests unmarked, except
  for muscles the page lights (`setHighlight`, e.g. a session pointed at in
  the Week plan). `setDim` lets it recede.
- `AnatomyStage` passes all of this on and remembers it, so a renderer that
  takes over after a failure starts where the page left off. The SVG figure
  has no camera: the stage marks itself `flat`, and the figure stands in the
  middle of Targets and steps aside elsewhere.

### Four rooms, four ways of looking

Branch `redesign/four-techniques`, 2026-11-11. Not yet accepted by the user.

Every stage used to say the same sentence: the marble, a large quiet word
behind it, an eyebrow, a serif title, a list, with the camera moving
between. A first answer changed the figure's material from room to room
(a drawing, a bronze cast); the user's verdict was that the figure should
stay the marble everywhere and the room around it should change. So each
room now has its own object, its own layout and its own way of being
moved through. The marble is one mesh, one renderer and one material.

| Stage | The room | How it is laid out | How it is moved |
|---|---|---|---|
| I Targets | the sculpture hall | the figure and the pages scrolled past it | scroll; point at the body |
| II Measure | an instrument: four rings round the figure, one a fact, each its own metal | the figure in the middle; each ring carries a tag (its name, reading and gauge), and what the ring in hand says goes round the body with it | turn a ring (drag, a sideways swipe, its coins, or type); the scroll goes from fact to fact, each with its own camera, and ends on your mark |
| III Nutrition | the day in perspective: a marble floor to a vanishing point, a gilt meridian of the hours, an arch a meal, the figure in a niche at the end | the sum at the threshold; each meal's figures and plate in its arch; the day laid out at the wall | walk the day: scroll, the arrow keys, the footer's beads, or press an arch |
| IV Week plan | the sun's path: the day as a ring of hours behind the figure, in the hour's light | a day at a time on its ring, then the week as seven rings and one sentence; generated, seven arches on one horizon | drag along a day's ring over busy hours (the session moves); scroll, the arrow keys or the footer's suns from day to day |

How each is built:

- **Measure** (`js/measure-view.js`). The rings are drawn in two 2D
  canvases, one under the sculpture's and one over it, so each passes
  behind the body. Their place, size and tilt come from the live camera
  (`room()`), so they follow every move of it. A ring's scale is engraved
  round its face and read under an index at the front. On a phone there
  are no rings; the facts stack.
  - *Each fact has its own shot*, framed so no ring reaches the top bar.
  - *Each ring is its own metal* (`METAL`), all four close to the bronze:
    pale gold, bronze, copper, verdigris. Its tag, its rule and its words
    take that tone (`--m-…`), which is how the page's colour ties a word
    to its ring. The scale is inlaid bright from its low end up to the
    reading, and each tag carries the same thing as a gauge.
  - *The reading goes round the body* (`drawOrbit`). What the ring in hand
    says (its reading, the other unit, one phrase) is set letter by letter
    on a wider circle in the ring's plane: the near half crosses the body
    and is read, the far half passes behind it. It turns as the ring is
    turned and drifts when left alone. The same words stay in the page for
    a screen reader. The typed number and its rule (bronze, graduated)
    stay at the side.
  - *The room moves.* The rings come down one after another on entering
    and sway when left alone; the body turns with the ring in hand.
    Reduced motion stills all of it.
  - *Your mark* (first "the seal", then the rings seen from above, which
    the user found too plain to keep in a profile). The camera still rises
    to look straight down, but that is now only the way in: the four rings
    close into the rim of a medal, each leaving a bead where its scale
    begins, and the mark is struck as they meet. Its face is a disc of
    polished stone whose veining is drawn from a seed kept with the
    measure (`BodyMeasure.seed`: cut once, unchanged when a reading
    changes, recut only on request), inscribed in gilt with the first
    letter of the name, the name and the day. Five stones to choose from
    (the keys the seal's inks had). Nothing on it depends on the chosen
    muscles or on a symbol the app picked.
- **Nutrition** (`js/nutrition-view.js`): *the day, in perspective*,
  from the user's Claude Design file "Nutrition - Perspectiva" (2026-11-14),
  which replaced the balance and the urn. A room drawn each frame in a 2D
  canvas under the sculpture: a marble floor laid to a vanishing point, a
  gilt meridian inlaid with the hours from six to eleven (their Roman
  numerals in the floor), an arch over each meal at its hour, a sun that
  crosses the sky as the day goes, and at the end a wall whose niche holds
  the figure. The user walks the day: the wheel, the arrow keys, the
  footer's way on or its beads (the day's index, `#foot-day`), or a press
  on an arch. Stations: the sum; a meal each; the day laid out at the wall.
  - *The figure is the marble.* `AnatomySculpture.standAt` stands the live
    sculpture in the niche each frame (its soles on the niche's floor, as
    tall as the niche allows), fading with the room's haze; a change of
    stage travels to it. No render or image of the figure is shipped.
  - *The words are set in the room.* A 1440 × 900 plate scaled to the
    screen; each station's words (`data-p`) are placed at its depth each
    frame, so walking carries them. The template is merged into the page
    on every change (`pvMorph`), so focus and transitions survive.
  - *The numbers are the plan's.* Every figure is `NutritionPlan`'s: the
    burn from Measure's weight and the planned training's load, the goal's
    recommendation, the meals and their shares, the dishes from `foods.js`.
    Pointing at a goal previews what it would come to; "How it's worked
    out" is the sum line by line. Body weight is asked only on Measure.
  - On a phone the plate is only scaled down for now (the phone gets its
    own redesign later), and without WebGL the niche stands empty.
- **Week plan** (`js/week-view.js`), from the user's Claude Design file
  "Week Plan - Lumen v3" (2026-11-15), with the user's changes on top. A
  1440 × 900 plate as Nutrition's; behind the figure, in the anatomy stage,
  the ring (`.lm-arc`, SVG on the same plate) and the sky (`.lm-sky`).
  Steps 0–6 are the days, 7 the week (`lm.step`, saved as the place).
  - *The ring.* Busy hours are hatched capsules that drift slowly; the
    session is a strand per family in its pigment, with a soft glow; meals
    are dots with their names inside the ring. Dragging along it paints
    busy hours on the routine as the stroke goes and gives back what it
    leaves; the plan (`weekPlan`) answers at once. On a generated day the
    session's band is dragged to another hour (`moveSession`). A row of
    hour toggles stands in for the drag for the keyboard.
  - *The light* (the user's change, 2026-11-15). The sun on the ring is a
    now-line that follows the pointer and writes the hour and what it
    holds. Its hour colours the page: `LM_SKY`, ten stops at the hours
    whose light people know, each a ground, a glow at the sun, a cooler
    light across from it and the sun's own colour, which turns into a pale
    moon after dusk. Morning and evening no longer read alike. The figure
    takes the same light (`setTint` on the renderer: the key the glow's
    hue and the hour's strength, the shade the far light's, the turned
    edges toward the ground) and is lit from the sun's place (`setSun`).
  - *The figure* (the user's change). It faces the page as on Targets, its
    feet on the ring's centre, and turns round when most of the day's
    muscles are seen from behind. The day's muscles are marked as Targets
    marks a selection (`setHighlight(ids, { selected, pointed })`), not in
    the design's own look; a muscle pointed at in the day's list is marked
    as one pointed at there. The day's name is Targets' ghost word, low at
    the shins, woven through the legs by `flow-front.js`.
  - *The week.* The terms as one sentence whose words open choosers;
    pointing at an option previews the week (`lmPreviewed` sets it on the
    routine for the one reading). Generated, seven arches on one horizon
    with every exercise; there the figure leaves (the user's change) and
    the day pointed at is named under its column in the ghost word's hand
    (`lmDayWord`), as large as the room under its list allows.
  - The frieze (`plates`), *Shape your week*, `paint.js` and the session
    panel went with it. On a phone the plate is only scaled down.

Open, for the user:

- `js/anatomy-sculpture.js` still carries the drawing and the cast
  (`SCULPTURE_TECHNIQUES`, `setTechnique`, `setCast`) and
  `tests/sculpture-technique.test.js` tests them. Nothing calls them now:
  to delete, once this direction is accepted.
- The rings, the mark and the room have no tests of their own beyond
  the mark's seed (`tests/measure.test.js`).
- The phone keeps plain versions of all three rooms.

### Type

Cormorant Garamond, shipped in `fonts/` (SIL Open Font License), is used
for stage titles, figures, the stages' Roman numerals (I, II, III) and the
ATLAS wordmark only; the interface stays in the system sans.

## Stage 01 · Targets

**From the design (v3):**
- Left rail: "01 / Targets", *Define your focus*. Below it, the program
  families as three tabs (Whole body · Push · Pull · Legs · Pairings, with
  no numbers). Then "Starting from" with ←, dots, →, showing one program at
  a time, sliding between them. Its name, muscle count, why it groups what
  it does, what was added or removed if edited, and *Apply X →* or *Reset
  to X*. Pointing at the arrows, a dot or the action previews that program
  on the sculpture.
- Caption and Front / Back under the body, centred and low.

**Three movements (design "Targets in three movements", 2026-10-22).** The
stage opens in three framings of the figure, one at a time (`data-sub` on
`#atlas`), and a change between them is a `Stages.relayout`: out, the
camera travels, in. A very large, quiet word behind the body names each
(Method, Muscles, Emphasis).
1. **How it works.** The figure stepped right; the title, and the three
   chapters (Targets · Nutrition, optional · Week plan). Each chapter's line
   fills as it is read, then the next plays, and the camera goes where that
   stage will put it (`targets-how0…2`). Pointing at or focusing a chapter
   plays it. The figure is shown, not picked (`interactive()` false), and
   its controls are away. Every new visit opens here, after the start
   screen, with what was entered kept; a reload skips the start screen and
   opens where the user was.
2. **Your muscles.** The figure in the middle, the programs on the left (as
   above), and on the right what is chosen: the count, where it came from
   (a program, edited, or your own), a bar of the families, and each
   family's muscles; pointing at a family lights it on the body.
3. **Training focus.** Opens once something is chosen; the figure steps
   left (`targets-train-front/back`), with Front / Back upright beside it.
   Every muscle by family with a three-way dial (Maintain · Normal · Focus)
   and the weekly sets it starts from. Resting on a row lights its muscle
   and turns the body to the side that shows it; pointing at a muscle on
   the body marks its row. Stepping back from Measure lands here.

**Movements as pages** (design "ATLAS Start", 2026-10-24). On a wide screen
with the sculpture's camera, a movement can be one page, scrolled, in place
of its panels: a page registers in `FLOW_DOCS` (`js/targets.js`), and
`data-doc` on `#atlas` names the one open. The scroll itself holds the
camera between the page's framings, so the figure crosses from side to side
with the page, and each part of the information gets the screen in turn. A
very large ghost word behind the figure names what is pointed at, in place
of the label beside the body. Below the hips it comes round in front of
the leg nearer the eye and stays behind the other, woven through the figure
(`js/flow-front.js`, design "ATLAS Start", 2026-10-26). On both pages the names stand low,
at the shins (`--gyl`), so they cross the legs. The way on, an inscription and a
coin (`FOOT_COIN`, `js/stages.js`), only shows at the foot of a page.
Until then the footer says "Scroll down", and past either end the wheel
moves between movements as before. On a phone, or with the flat SVG figure,
the panels above stay.
- *Your muscles* (`js/targets-muscles.js`, framings `targets-doc-…`): an
  opening; every program on one reel, turned by the scroll, the body
  showing each and its sixteen muscles as bars; Refine (the two sides, and
  what changed from the program); and What you have chosen, in one sentence
  with its mix by family. Down from the programs needs something chosen
  (or a skip). **Once a program is chosen the reel ends at it**
  (the user's call): scrolling on goes straight to Refine, and the programs
  after it are a click away (the ticks, or the next name).
- *Training focus* (`js/targets-train.js`, framings `targets-tdoc-…`): an
  opening with the three ways a set is drawn; one section per family, each
  muscle a ladder of its weekly sets against its range, with its priority
  (pointing at one shows what it would add or drop); and the week's total,
  which travels with the page and lands as the closing figure. Every
  figure is the same estimate as the panels' (`startingSets`), marked ≈.

**What it will take** (`estimateHTML` in `js/targets.js`) is drawn nowhere
for now and kept for a later stage, likely an end-of-plan summary.

**Kept from the app** (the prototype skipped or simplified these):
- `MuscleSelection` stays the one source of truth, so the program's
  "edited" state is the selection's own `source()`. A selection that
  matches a program exactly, by whatever route, shows as that program.
- **Browsing never costs the user their work.** With nothing selected, or
  a selection of their own (not from a program), ← and → only show programs
  until one is applied. Once the selection follows a program, they switch
  directly, as in the design.
- Removing a muscle from Training focus (× on its row). This is for
  keyboard users and the SVG fallback, as well as the figure.
- **Training experience** first lived here, in the right rail, and has since
  moved to the Week plan setup, beside Days a week and Split (your call,
  2026-10-20): it is about how you train, not which muscles. It still sets
  each muscle's starting weekly sets, which Training focus shows
  (`weeklyTarget`, before the week fits them to your time).
- The estimate is the real one (`estimateTraining`): sets, time, sessions,
  how often each muscle trains, the progress phases, and the caveat that it
  is not a prediction of a physique by a date.
- The note when some chosen muscles have no exercises in the database yet.

**Decisions:**
- The footer says "or scroll" only on wide screens, as in the design;
  narrower screens show just the button.
- Experience uses short labels ("6 mo – 2 yrs"); screen readers
  and tooltips get the full ones.

## Stage 02 · Nutrition

**From the design (v3, the "panels" layout with framing C):**
- The sculpture turns to its left and the camera looks up at the torso. The
  plan sits to its right, at a width where each row reads on one line.
- "02 / Nutrition *optional*", *Fuel the training*, and one line on what the
  diet is fuelling.
- The goal as four cards, each showing what it would change for this
  training (−17%, +8%, = burn).
- The day's targets, large: calories, and protein beside them, labelled
  **Estimate**, with the sum that made them.
- Rows that are one line until opened: **You** (body weight and unit, the
  day outside training, daily burn with ±50), **Targets** (calories against
  burn, protein per kg; *Recommended* or *Your setting* with *Use it*) and
  **Rhythm** (meals a day with the suggested count marked, first and last
  meal, diet style).
- *See a day of eating →*: the day as a timeline with dots sized by each
  meal's share, a bar of the day's calories, and **one meal open at a
  time**. It shows the meal's calories and protein, its share of the day,
  how far the day's targets are met by its end, and an example plate, with
  ← → to move between meals. The full day is still visible at a glance on
  the timeline.
- Footer: ← Targets · *Skip, training only* · *Continue to week plan →*.

**Kept from the app** (the prototype skipped or simplified these):
- All the numbers are the real `NutritionPlan`'s: goal ranges, load-based
  deficits and coverage-based surpluses, protein placed by how hard the
  week is, the 1,200 kcal floor with its warning, meal patterns of 2–6.
- **How it's worked out**: the old "Built from your plan" reasons, one click
  from the figures.
- **A Training row** (new to the design): days a week and session length,
  the same numbers as the Week plan, plus what the training adds to the
  burn. The old stage had these controls; the design didn't.
- The protein's usual range, the suggested number of meals with *Use N*,
  and *Estimate it for me* to go back from your own burn number.
- A body weight is required, not prefilled as in the prototype. Without one
  the figures say so, the You row opens, and the day of eating waits.
- Each meal's time can be moved within its neighbours (the time label in
  the open meal is a picker), and **Other ideas ↻** cycles the example
  plate. The plates are the real `mealIdeasFor` ideas, portioned to the
  meal, not repeated across the day where avoidable.
- Arrow keys move along the meals; every control keeps keyboard focus
  through a redraw. Typing a weight repaints the figures in place, so the
  field under the user's hands is never rebuilt.

**Decisions:**
- The Nutrition shot puts the figure at 19% across, not 22%. At 1440×900 the
  design's framing put the hand under the rows' labels.
- On screens narrower than 16:10, side-placed shots step back by the square
  of the shortfall, because the panel narrows faster than the screen.
  Where the figure still reaches under the panel, a veil of the ground
  fades in over the panel's margin, so the sculpture recedes behind text
  instead of competing with it.
- A pane starts at the top whenever its stage changes or rearranges.

**Also in this PR:** `tests/globals.test.js`. Building this stage hit a real
trap: `render.js` already declared `nutriEl`, so the new view's
`const nutriEl` stopped the whole script from loading. That only shows in a
browser, because the logic tests skip view files. The test runs every page
script in order in one shared context and fails on any SyntaxError, which
includes a top-level name declared twice. It was checked to fail on that
exact clash.

## Stage 03 · Week plan

**From the design (v3, framing B):** the camera comes in close on the upper
body, three-quarter from the figure's left, and the plan takes the other
side. There are three screens, one at a time:

- **Fit it into your life**, with the sculpture on the right:
  - the muscles chosen, with *Change*;
  - the week as seven day tiles (the session's name, its families' dots,
    its time; *Rest*, or hatched *Off*);
  - one line of facts (session length, preferred time, busy hours) with
    *Customize week →*;
  - **Days a week** (− n +) and **Split**;
  - notes that appear where a setting causes something;
  - **Generate my week**.

  Pointing at a day lights its muscles on the sculpture.
- **Shape your week**, the whole screen, with the sculpture receding:
  - Done, and a status line that says whether the week fits;
  - a toolbar: Session length, Preferred time, *Fill busy hours*
    (Weekdays 9–5, Weekdays 8–6, Clear all) and the Meals switch, or
    *Set up nutrition* when there is no nutrition plan;
  - a full-width calendar of day cards. Drag down a day to mark busy hours,
    drag again to clear them, and click a day's name to take it off. The
    preferred time shows as a band, each day's planned session as a solid
    block, and meals as pills.
- **Your week**, the whole screen:
  - "Your week", with sessions, hours and hard sets, labelled an estimate,
    and *Adjust plan*;
  - the generated week as day cards with session blocks, busy hours and
    meals;
  - the sculpture in a right-hand column. Pointing at a session lights its
    muscles; clicking one opens its panel over that column (below 1180px,
    over the calendar).
  - On a phone: an agenda, one line a day, with a session opening in place.
- Busy hours start empty (your call), with the presets one click away.

**Kept from the app** (the prototype skipped or simplified these):
- **The planner is the real one.** The tiles and the calendar's planned
  sessions are `routine.weekPlan()`, the same placements Generate then
  makes: recovery per muscle, the scoring scheduler, the distribution,
  meals kept clear. Nothing is faked from a simple rotation as the prototype
  did, so what the setup shows is what Generate places.
- **The fit**, before Generate: "looks feasible", "looks too short, so the
  plan lowers …", room for fewer days, a split leaving muscles without a
  day, and what would fix it. The weekly sets per muscle are one click away.
- **The session panel holds everything** the old "Your week" card could do
  (your call):
  - move the session to another day (days it can't go to are listed with
    the reason: day off, has a session, no free time, a muscle still
    recovering) or another time;
  - swap an exercise (grouped by tier, flagged when it repeats a
    movement), add one, remove one, *Restore suggestions*, *Remove
    session*;
  - the muscles with direct and assisting sets;
  - the Length, Recovery and Fuel notes;
  - the "no time left / covered by the lifts above" notes;
  - the tier key.
- **Every Generate message**: why fewer days than asked, which split would
  fit better, blocks left without a day, muscles under their weekly
  minimum, and what would close the gap. It also says when an edit removed
  a session, and when the week is out of date (adjust the plan, then
  *Your new week*).
- *Reset* (all hours, days off and training settings back to defaults),
  and *Your generated week →* after *Adjust plan*.
- Painting fills the rectangle between where a drag started and ended, as
  before, so a fast drag is not left patchy. While dragging, only the busy
  blocks are redrawn; the plan is worked out again on release.
- Days off are a click on the day's name. A fully painted day counts as
  off, as before.
- Saving between visits, and landing back on your week.

**Decisions:**
- On the setup screen, an automatic plan's days are named after the
  families they train ("Push + Core"); a chosen split's days keep their
  names ("Upper"). Three or more of push, pull and legs together is "Full
  body".
- Painting "clear" clears busy hours only. A generated session is removed
  by painting busy over it, or from its panel, and the status then says
  so.
- Sessions too short for their time line on a crowded calendar show only
  their name; the time is in the day's head and the panel.
- `render.js` is now just what every view shares. The old grid, sidebar
  and status box are gone with their markup, and so is `css/legacy.css`.

## Questions answered before starting

| Question | Answer |
|---|---|
| Where should the full session editing go (move day/time, swap/add/remove exercises, restore, remove session, recovery and fuel notes)? | Inside the session panel |
| Where should training experience live? | Targets right rail; moved to the Week plan setup on 2026-10-20 |
| Busy hours at first? | Start empty, with presets (Weekdays 9–5, 8–6, Clear all) |
| Git | A branch per stage, a commit per significant step, a PR per finished stage, everything documented |

## Checking it

`npm test` covers the logic, which is unchanged, and (from stage 2) that the
page's scripts load together. The views were checked in
Chromium, opened from `file://`, at 1440×900, 1280×800, 1100×800, 1024×768
and 390×844, in both themes, with the Male_Body sculpture, the procedural figure
(`?anatomy=procedural`) and the SVG fallback (WebGL off). Checked:
applying, browsing and editing programs; picking muscles on the
perspective camera; Front/Back; priorities; experience; the estimate;
moving to the legacy stages and back by the masthead, the footer and the
wheel; generating a week in the legacy Week plan; and reloading back to
it.
