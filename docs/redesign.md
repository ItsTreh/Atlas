# The stage redesign

ATLAS is moving to the stage-based design worked out in Claude Design
(*ATLAS Stages v3*). This file is the running record of that change: what
the design asks for, how it is built here, what was kept from the app that
the prototype left out, and the decisions taken along the way. It lands one
stage at a time, one pull request each:

| Stage | Branch | Status |
|---|---|---|
| 01 Targets, plus the shell and the sculpture's camera | `redesign/01-targets` | this PR |
| 02 Nutrition | `redesign/02-nutrition` | next |
| 03 Week plan | `redesign/03-week-plan` | after |

Until a stage's redesign lands, it keeps working as it was, inside a
full-screen panel over the sculpture (`css/legacy.css`, scoped to
`.legacy`). Nothing in the logic changes: the redesign is the views, the
styles and the renderer. Every test runs the same logic files as before.

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
| `moving` (1250 ms) | the new stage is drawn, the camera travels to its shot, the interface comes in group by group (`data-reveal="0/1/2"`) |
| `idle` | still; the controls are live, the sculpture can be picked (Targets) |

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
  | `plan` | Week plan, setting up | 36 | −7 | 116 cm | 270 cm | right |
  | `plan-availability` | Shape your week | 36 | −7 | 110 cm | 460 cm | off right (hidden) |
  | `plan-generated` | Your week | 36 | −7 | 118 cm | 330 cm | right column |

  `SCULPTURE_MOBILE` reframes them for the phone band.
- **The move** lasts 1.35–2.3 s depending on how far round the body it goes,
  eases in and out, and pulls back a little while swinging round, so it
  never cuts through the figure. Front ↔ Back is the old 650 ms half-turn,
  in the direction a drag already started.
- **Only Targets is interactive** (`setInteractive`). There the selection
  shows and the pointer picks. Elsewhere the figure rests unmarked, except
  for muscles the page lights (`setHighlight`, e.g. a session pointed at in
  the Week plan). `setDim` lets it recede.
- `AnatomyStage` passes all of this on and remembers it, so a renderer that
  takes over after a failure starts where the page left off. The SVG figure
  has no camera: the stage marks itself `flat`, and the figure stands in the
  middle of Targets and steps aside elsewhere.

### Type

Cormorant Garamond, loaded from Google Fonts, is used for stage titles and
figures only; the interface stays in the system sans. Opened from disk
without a connection, the serif falls back to Georgia and everything else
is unchanged.

## Stage 01 · Targets

**From the design (v3):**
- Left rail: "01 / Targets", *Define your focus*. Below it, the program
  families as three tabs (Whole body · Push · Pull · Legs · Pairings, with
  no numbers). Then "Starting from" with ←, dots, →, showing one program at
  a time, sliding between them. Its name, muscle count, why it groups what
  it does, what was added or removed if edited, and *Apply X →* or *Reset
  to X*. Pointing at the arrows, a dot or the action previews that program
  on the sculpture.
- **Nothing selected at first.** The right rail explains how ATLAS works
  (Targets · Nutrition, optional · Week plan) and how to begin. The
  sculpture stays blank until a program is pointed at.
- Once something is selected, the right rail shows:
  - the count in large serif type, and Clear;
  - the **training focus grouped by family**, with priority marks (▲ focus,
    ▼ maintain) and expandable rows that set each muscle's priority;
  - **What it will take**, collapsed to its two figures, with the reasoning
    on demand.
- Caption and Front / Back under the body, centred and low.

**Kept from the app** (the prototype skipped or simplified these):
- `MuscleSelection` stays the one source of truth, so the program's
  "edited" state is the selection's own `source()`. A selection that
  matches a program exactly, by whatever route, shows as that program.
- **Browsing never costs the user their work.** With nothing selected, or
  a selection of their own (not from a program), ← and → only show programs
  until one is applied. Once the selection follows a program, they switch
  directly, as in the design.
- Removing a muscle from the summary (× in an expanded family). This is
  for keyboard users and the SVG fallback, as well as the figure.
- **Training experience** now lives here, in the right rail (your call).
  It sets each muscle's starting weekly sets, which the family rows show
  (`weeklyTarget`, before the week fits them to your time).
- The estimate is the real one (`estimateTraining`): sets, time, sessions,
  how often each muscle trains, the progress phases, and the caveat that it
  is not a prediction of a physique by a date.
- The note when some chosen muscles have no exercises in the database yet.

**Decisions:**
- The footer says "or scroll" only on wide screens, as in the design;
  narrower screens show just the button.
- Experience uses short labels in the rail ("6 mo – 2 yrs"); screen readers
  and tooltips get the full ones.

## Questions answered before starting

| Question | Answer |
|---|---|
| Where should the full session editing go (move day/time, swap/add/remove exercises, restore, remove session, recovery and fuel notes)? | Inside the session panel |
| Where should training experience live? | Targets right rail |
| Busy hours at first? | Start empty, with presets (Weekdays 9–5, 8–6, Clear all) |
| Git | A branch per stage, a commit per significant step, a PR per finished stage, everything documented |

## Checking it

`npm test` covers the logic, which is unchanged. The views were checked in
Chromium, opened from `file://`, at 1440×900, 1280×800 and 390×844, in
both themes, with the Male_Body sculpture, the procedural figure
(`?anatomy=procedural`) and the SVG fallback (WebGL off). Checked:
applying, browsing and editing programs; picking muscles on the
perspective camera; Front/Back; priorities; experience; the estimate;
moving to the legacy stages and back by the masthead, the footer and the
wheel; generating a week in the legacy Week plan; and reloading back to
it.
