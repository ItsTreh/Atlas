# Sensitivity of the weekly plan to the per-session set cap

Script: `tools/sensitivity/per-session-cap.mjs` (profiles in `tools/sensitivity/profiles.json`). It runs the app's own logic unchanged for 11 profiles at caps of 8, 10 and 11 sets (`WORKOUT.maxSetsPerSession`, counted in fractional sets), by substituting the value in `workouts.js` as it loads in a throwaway context. Full results: `per-session-cap.csv` and `per-session-cap-table.md`. Run on 2026-10-10 from branch `atlas-evidence-volume`.

Columns: `capMuscles`/`capSets` are muscles and sets lost to `session-capacity`; `focusShort` is how many Focus sets fall under target; `missing` is muscles with no sets; `belowMin` is muscles under their usual minimum; `maxDirectInSession` is the most direct sets one muscle got in one session.

## What happened

- **No effect in 6 of 11 profiles** (both beginner profiles, intermediate 4 days × 75 min, intermediate full body, advanced upper/lower 4 × 75, advanced 6 × 60). Every metric is identical at 8, 10 and 11.
- **Four consecutive days, three Focus muscles, 60 min** (two profiles, identical results): raising the cap to 10 or 11 lowers `session-capacity` losses from 2 sets to 1 and shortens sessions (max 58 → 54 min), but the Focus shortfall stays at 1 set.
- **Advanced, 5 days × 90 min, five Focus muscles:** cap 11 closes the Focus shortfall (3 → 0 sets) and clears both audit issues, but the longest session reaches 90 min (the limit) and one muscle gets 11 direct sets in a session. Cap 10 is mixed: shortfall 3 → 1, but a muscle falls under its minimum (0 → 1).
- **Advanced, 3 days × 90 min, Push/Pull/Legs, three Focus muscles:** worse. Muscles with no sets go from 1 to 3 and muscles under minimum from 2 to 4 (cap 10) or 3 (cap 11); Focus muscles overshoot their target (25.5 → 31.5 or 34 sets against 24) while other muscles lose the time.
- **Advanced, 2 days × 90 min, five muscles:** cap 10 and 11 close a 1-set Focus shortfall, but mean session length rises from 70.5 to 86.5 min and Focus ends 5 sets over target (21 against 16).

## Against the decision criterion in the plan (B6)

Raising the cap helps a Focus muscle only in a few cases, by 1 to 3 sets. Where it helps it costs 4 to 16 more minutes per session, in two profiles it reaches the 90-minute limit, and in one it takes volume from other muscles. It does not clearly pay for a variable cap. **Recommendation: keep 8 and do not implement the variable cap (Phase C) now.** The result is from 11 profiles and does not show that 8 is right, only that 10 or 11 is not clearly better.

## Things this run showed that are outside this question

- `focusTarget` (what the audit says Focus muscles should get after the time fit) is sometimes much lower than the sets actually given: intermediate, 3 days × 60 min, full body, quads and glutes in Focus gets 17 against a target of 7. The plan overshoots a trimmed target. It needs its own look.
- Beginner full body at 60 min leaves 9 muscles under their minimum; the audit reports it (it is the "not everything fits" case), the cap does not matter there.
- Intermediate and advanced give identical results at 4 days × 60 min, because the time fit trims both to the same targets.
