# Right-armpit reconstruction: experiment report (2026-10-14)

Scratch only. The production files are unchanged and verified by hash (`production.sha`): `Male_Body.blend`, `Male_Body.paint.png`, `male-body.glb` and `js/anatomy-model-male-body.js`. The left arm is untouched.

## Verdict

- **Separating the fused surface works, and the paint survives.** The membrane is gone.
- **The reconstructed armpit is not yet anatomically plausible.** The new arm wall and chest wall are near-flat panels. Once the arm lifts they show as a sliced, flat underside on the arm, a flat streaky panel on the chest wall, and small pinches at the fold ends.
- **Not production-ready.** It shows that the topology route is viable, but the walls need to be shaped by hand (sculpt) or with pose-driven corrective shapes before it looks right.

## Separation boundary (measured, not guessed)

From horizontal sections every 2 mm, read against the existing paint:

| Piece | Where | Arm side | Chest side |
|---|---|---|---|
| Front notch | z 0.53 → 0.665 | biceps | serratus anterior / latissimus |
| Back notch | z 0.53 → 0.645 | triceps | latissimus / teres major |
| Crotch (the junction under the arm, where the notches meet) | z ≈ 0.525 | — | — |

- **Top front end, F:** just under the pectoralis major's lower edge, the anterior axillary fold.
- **Top back end, B:** just under teres major's lower edge, the posterior fold. It sits lower than F, as it does anatomically.
- **Above F and B** the folds stay joined. Pectoralis and latissimus really do bridge chest and arm there, so their stretch on raising the arm is correct.
- **The cut** is 321 vertices and 35.6 cm long, within 0.8 mm of the measured notch curve.

## What was built (`scripts/repair4.py`)

1. **Rip along the cut.** The arm side and the chest side get their own copies of the cut's vertices; F and B stay shared. No existing face is moved, re-indexed or re-mapped.
2. **Pocket.** Two walls are added, the inner arm wall and the facing chest wall, joined in a dome between F and B.
   - They are laid on a Coons patch over the fused zone: one column per cut vertex, placed with two harmonic fields so the grid cannot fold. Rows run from the cut back into the body.
   - The walls stand up to about 3.5 mm apart at rest.
   - 10,240 faces, using the material `atlas-stone`.
   - They have their own UV island on blank image, so they read as unpainted `body` and can be painted later.
3. **Weights.**
   - Near the cut (within 6 cm), each side follows its own bone, using geodesic distance to that side's copy of the cut.
   - The walls follow their side and blend in the dome, then everything is smoothed.
   - At most 4 influences per vertex, normalised.
   - 3,186 existing vertices change, all with x between −0.302 and −0.198 (right side only).

Earlier attempts are kept for the record:

| Script | What went wrong |
|---|---|
| `repair.py` | The cut zigzagged and the rows ran up the crease. |
| `repair2.py` | The zip strip folded. |
| `repair3.py` | Flow-line columns crossed at the corners. |

## Validation (`out/metrics_*.json`, `scripts/validate.py`)

**Integrity**

| Check | Original | Repaired |
|---|---|---|
| Closed manifold, 1 shell, edges with ≠ 2 faces | yes, 1, 0 | yes, 1, 0 |
| Inconsistent winding / degenerate faces | 0 / 0 | 0 / 0 |
| Self-intersections at rest (right armpit) | 0 | 13 face pairs, sub-mm, at the cut's inner ribbon |
| Self-intersections at 30° / 60° / 90° | 86 / 160 / 174 | 104 / 98 / 179 |

The original's posed intersections are the membrane folding. The repaired copy's posed intersections are pinching at F/B and at the ribbon.

**Preservation**

| Check | Result |
|---|---|
| Existing faces' Paint and UVMap UVs | identical (max diff 0.0) |
| Existing vertex positions and materials | identical |
| Painted region per existing face | identical |
| Real exporter (`male_body.py` → scratch GLB): painted area per region | within 0.2 cm² (e.g. latissimus.R 422.5 → 422.3 cm²) |
| Left-side positions and weights | identical |

In the exporter's output, 96 regions remain. Triangle counts differ only because there are fewer border-cut slivers along the cut.

**Stretch on painted muscle, right side** (extra surface over rest; faces stretched over 10×; worst face)

| Elevation | Original | Repaired |
|---|---|---|
| 30° | 673 cm², 382 faces, 483× | 185 cm², 5 faces, 18× |
| 60° | 1,240 cm², 429 faces, 909× | 376 cm², 29 faces, 31× |
| 90° | 1,570 cm², 440 faces, 1,211× | 488 cm², 50 faces, 37× |

- The remaining stretch on painted muscle is mostly the pectoralis and latissimus folds and the shoulder, where real skin stretches too.
- The new pocket surface grows by 45 / 104 / 156 cm², concentrated in the dome. That is where axillary skin stretches in reality, but up to 10× and more on thin cells.
- The elevation is pure rotation of the upper-arm bone about the world y axis; the clavicle/scapula bone stays still, as in the 2026-10-13 analysis.

## Screenshots (`renders/`)

All are orthographic and use matching cameras. Each sheet has a before row and an after row at 0 / 30 / 60 / 90°.

- `sheet_front_clay.png`, `sheet_back_clay.png`, `sheet_under_clay.png`: appearance.
- `sheet_*_heat.png`: stretch (grey 1×, yellow 2×, orange 4×, red 10×+, blue shrunk).
- `sheet_paint.png`: the painted regions at rest and at 90°. Rest is identical; the new walls show white (unpainted).
- Single frames are in `renders/before/` and `renders/after/`.

## Limitations

1. **The walls are flat.** They lie on one patch, a few mm apart, because at rest the arm presses on the chest. Raised, the arm's inner side reads as a flat cut and the chest wall as a flat panel. Real anatomy has a rounded arm (biceps short head, coracobrachialis, triceps long head) and a convex rib wall (serratus). The rounded shapes would intersect each other at rest. The usual answer is a pose-driven corrective shape key that inflates the walls as the arm rises; alternatively sculpt them in Blender.
2. **The dome is a stretched band** (10×+ at 90°). Wider spacing near the dome, or a corrective shape key, would spread it.
3. **Pinching at F and B.** The walls bunch at the two fold ends as the arm rises; those corners need a hand pass.
4. **Thin cells.** Cut edges are about 1 mm long and every one gets a column, so the walls have long, thin faces, which explains the streaky shading in the renders. Fewer columns away from the cut would need a transition strip; v2's version of that folded.
5. **13 sub-millimetre intersections at rest** where the inner ribbon meets the latissimus at the front crease. They are hidden inside the closed crease but are still a defect.
6. **Two copies of each cut vertex at one position.** "Merge by distance" in Blender would undo the cut.
7. **The new walls are unpainted (`body`).** Anatomically the chest wall is serratus anterior and the arm wall biceps/coracobrachialis/triceps. Painting them is your call; the UV island allows it.

## Files

| File | What |
|---|---|
| `repaired/Male_Body.blend` (+ paint png/json copy) | the experimental repaired copy |
| `original/`, `reference/` | read-only copies of the production .blend the experiment started from |
| `scripts/` | everything used; `repair4.py` builds the repaired copy |
| `out/` | metrics, sections, debug output |
