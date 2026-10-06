# Anatomy levels

How ATLAS will separate *what you train* from *what the body is*. Agreed with
the user on 2026-10-06. This is a direction, not a build plan: each step
below is its own change, started only when asked.

## The three levels

**Level 1: training.** The muscle groups the planner uses (`MUSCLES` in
`js/model.js`): Chest, Shoulders, Biceps, Quads, Abs, Obliques… Names are the
ones gym-goers already know; we keep "Abs" and "Obliques" rather than
systematic names like "Front Core". Only Level 1 affects workout generation.

**Level 2: anatomy.** The individual muscles painted on the sculpture,
revealed by zooming in. Names describe the anatomy, e.g.:

```
Shoulders
├─ Anterior deltoid
├─ Lateral deltoid
└─ Posterior deltoid
```

Hovering or tapping a muscle shows a short floating explanation. Selecting it
opens a card:

```
Serratus anterior
Helps protract and upwardly rotate the scapula and stabilise it against the rib cage.

Commonly trained by
- Push-up plus
- Serratus punches
- Wall slides
- Overhead pressing movements

Contributes to
Shoulder stability · Scapular control
```

Group Level 2 muscles by anatomy or location, not by training category. The
serratus belongs to the shoulder girdle, not the core.

**Level 3: exercise relationships.** Selecting an exercise lights up
everything it trains, with an estimated contribution:

```
Bench press
Chest        ●●●
Triceps      ●●
Front delt   ●●
```

This works without zoom, so it can come before Level 2.

## Rules

- **Painted muscles stay painted and stored independently**, even when
  they aren't selectable training targets. At normal view they can be
  non-interactive (mapped to `null` in `js/anatomy-regions.js`); when zoomed
  in they become explorable. The serratus anterior is the first case.
- **One anatomy knowledge dataset, apart from the UI.** For each Level 2
  muscle it holds the name, Level 1 parent, function, what it contributes to,
  and per-exercise contribution scores. The muscle cards, the exercise view
  and later features all read it, so they can't disagree. Content is sourced
  and checked region by region, the same way the painting is done.
- **"Commonly trained by" draws on the exercise database.** Anything not in
  it is shown as general advice, not as something ATLAS will schedule.
- **Contribution scores are estimates and display-only at first.** They're
  labelled as estimates, with how they were judged, and don't feed the
  planner, so workout generation doesn't change unexpectedly. The planner
  keeps its primary/secondary credit until a deliberate upgrade.
- **Cards must work on touch and keyboard**, not only hover.

## Order

1. Hide the serratus and document these rules. *(done: this file)*
2. Set up the knowledge-data structure with a few test muscles.
3. Add the exercise-to-muscle view (Level 3).
4. Keep painting region by region, researching each area, including
   splits such as the three deltoid heads.
5. Build zoom and the detailed cards once there's enough anatomy to make it
   worthwhile.

## Later, as deliberate upgrades

- A weekly coverage map: the body coloured by how much the week trains each
  part, built from the same scores.
- Planner logic that uses the scores, e.g. an emphasis on a Level 2 muscle
  that biases exercise choice.
