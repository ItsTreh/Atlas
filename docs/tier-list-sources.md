# Where the exercise tiers come from

ATLAS orders the exercises for a muscle by tier (S+, S, A+, A). This page says
where those lists come from and what they can and cannot tell you.

## What the lists are

The lists for chest, triceps, back (lats and upper back), shoulders, quads,
biceps and glutes were supplied by the project owner and are kept exactly as
supplied (`EXERCISE_RATINGS` in `js/exercises.js`). They match Jeff Nippard's
exercise tier-list videos, compiled on one page:
<https://hackmd.io/@dastratman/B1w4jGoDJx>. The link for each group is its
`source` in the code.

They are **one coach's opinion**. They say which exercises an experienced
coach prefers; they do not measure how much more muscle one exercise builds
than another. ATLAS uses them only to decide which exercise ranks above
another, never as a number, and the weekly dose of sets does not depend on them.

## Muscles with no list

Traps, forearms, hamstrings, adductors, calves, abs, obliques and the lower
back have no tier list from that source. The other tier lists found online
for them were either joke tiers from entertainment videos or unranked
mentions, so none is used. Their exercises are still offered, unrated, after
any rated ones, in catalogue order. If a source worth using appears, add a
ratings entry with its `source` link; the loader checks that every list has one.

## To check with the owner

That the supplied lists are the ones in the videos above (the chest S+, the
machine chest press, matches).
