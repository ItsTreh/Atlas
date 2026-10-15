# Left-armpit repair on the approved rig baseline (2026-10-15)

This is scratch work only. The production files hash the same before and after (`production.sha`):
- `Male_Body.blend`
- `Male_Body.paint.png`
- `male-body.glb`
- `js/anatomy-model-male-body.js`

**The baseline** is `rig-weights-2026-10-14/result/Male_Body_rigged.blend`: the repaired right armpit, ATLAS_Rig (59 bones) and the new weights. A read-only copy is in `original/`.

**The result** is `result/Male_Body_rigged.blend`.

## Verdict

- **The left armpit is separated, and the membrane is gone.** At 90° against the fused original:
  - the worst painted stretch is 17× (was 311×);
  - painted triangles over 10×: 11 (was 31);
  - extra painted area: 493 cm² (was 1,075);
  - the flap: 45 vertices (was 228);
  - crossing face pairs: 29 (was 335).
- **The left now sits close to the approved right**, with the same known limits: flat pocket walls, streaky thin cells and pinching at the fold ends. It is somewhat behind the right on these:
  - a sharper crease where the arm wall meets the arm (72°, right 48°);
  - flatter walls (wall off a round section 15 mm, right 5 mm);
  - a larger flap at 30–60° (61–75 vertices, right 12–64).

  All three come from the left's geometry (see below).
- **The right arm, the rig, the paint and all 96 regions are preserved exactly.**
  - The right arm measures identically to the baseline at every angle.
  - Right-side weights are bit-identical.
  - The rig is identical.
  - Every existing face keeps its corner positions, UVs, material and painted region.

## How the left differs from the right (measured, not mirrored)

Horizontal sections every 2 mm, read against the paint (`scripts/probe.py`, `probe2.py`):

| | Left | Right (approved) |
|---|---|---|
| Fusion starts (crotch) | z 0.527 | z 0.525 |
| Front fold end F, just under pectoralis major's lower edge | z 0.636 | z 0.665 |
| Back fold end B, just under teres major's lower edge | z 0.618 | z 0.645 |
| Front notch, chest flank | **latissimus** (the left lat is painted forward to the notch) | serratus/latissimus |
| Back notch, arm flank | triceps, and coracobrachialis at the bottom | triceps |
| Arm position | about 4 cm further back (y), pressed flat into the chest wall | — |
| Gap under the crotch | about 2 mm (arm and chest wall almost touching) | wider |
| Cut | 215 vertices, 31.7 cm, median 0.3 mm off the measured curve | 321 vertices, 35.6 cm |
| Fused patch | 11.2 × 9.5 cm | — |

**Why the left is harder.** The left arm presses harder and further back into the chest wall. Two things follow:
- The front crease is a tight V. The first build's walls cut through its flanks: 90 crossing pairs at rest, against 17 on the right.
- The chest wall beside the back notch belongs to the scapula's territory rather than the spine's. It holds more of the inner-triceps skin back as the arm lifts, which makes the flap.

## What was built

1. **`scripts/repairL.py`**: the right's repair4 method on the left's own geometry.
   - The notches come from each slice's convex-hull bays.
   - The crotch is the top of the slit, per front-to-back slice.
   - The cut is ripped (F and B stay shared), and a two-wall Coons-patch pocket is added: 6,848 faces in material 0, on their own blank UV island clear of the right's island.
   - No existing vertex moves, and no existing face changes its UVs or material.
2. **`scripts/relaxL.py`**: a rest-pose clean-up. Only new pocket vertices move (175 of them, median 0.7 mm).
   - Nine wall vertices near F lay outside the skin by up to 12 mm and were put back inside.
   - Crossings at rest went from 90 to 15, against 17 on the right.
3. **`scripts/weightsL.py`**: the baseline weight method (nearest visible bone, geodesic blending, shoulder 7 cm), with both pockets locked.
   - The rerun reproduces the approved weights everywhere else (the largest difference on the right is 0.00005, which is rounding).
   - Only vertices whose weights changed are written: 3,647 existing vertices, all at x ≥ 0.13 m on the left, plus the 6,816 new ones.
   - Adapted for the left: the inner arm's skin fades to the torso over 5 cm (`ATLAS_H_ARM_SIDE=0.05`, left only) rather than 7. The table below shows why.

### Weight variants (left arm; 30 / 60 / 90°)

| Variant | Crossings | Painted >10× | Worst painted | Flap | Arm-side crease at 90° |
|---|---|---|---|---|---|
| Baseline method (7 cm) | 29 / 32 / 52 | 2 / 8 / 15 | 36× / 62× / 71× | 119 / 158 / 122 | 63° |
| **Arm side 5 cm (chosen)** | 14 / 18 / 29 | 0 / 4 / 11 | 6× / 12× / 17× | 73 / 61 / 45 | 72° |
| Arm side 3.5 cm | 13 / 16 / 20 | 0 / 2 / 14 | 6× / 12× / 17× | 64 / 28 / 12 | 88°: the arm wall reads as a hard slab |

The renders are in `renders/sheets_*.png`, one row per variant.

## Both arms tested independently (`scripts/validate2.py`; the other arm stays at rest)

Each cell gives 0 / 30 / 60 / 90°. Full numbers, including 45° and 75°, are in `out/metrics_<tag>_<side>.json`.

| | Left before | **Left after** | Right after (= approved baseline) |
|---|---|---|---|
| Crossing face pairs (that armpit's zone) | 0 / 159 / 238 / 335 | 15 / 14 / 18 / 29 | 17 / 15 / 13 / 71 |
| Painted triangles >4× | 0 / 35 / 162 / 332 | 0 / 13 / 123 / 309 | 0 / 11 / 56 / 182 |
| Painted triangles >10× | 0 / 8 / 23 / 31 | 0 / 0 / 4 / 11 | 0 / 0 / 0 / 5 |
| Worst painted stretch | 1× / 115× / 222× / 311× | 1× / 6× / 12× / 17× | 1× / 5× / 10× / 14× |
| Extra painted area (cm²) | 0 / 417 / 823 / 1,075 | 0 / 188 / 369 / 493 | 0 / 181 / 360 / 478 |
| Pocket triangles >10× | — | 0 / 5 / 26 / 34 | 0 / 1 / 13 / 25 |
| Flap (arm skin >3 cm out) | 4 / 275 / 458 / 228 | 4 / 73 / 61 / 45 | 0 / 12 / 51 / 11 |
| Crease at the cut, arm / chest (median°) | — | 97/84 · 74/73 · 72/64 · 73/61 | 88/92 · 52/67 · 48/57 · 48/57 |
| Upper-arm bone inside the skin; least clearance | 11/11; 35 / 34 / 31 / 25 mm | same | 11/11; 33 / 32 / 29 / 24 mm |
| Deltoid crushed triangles (<0.5×) | 0 / 0 / 52 / 963 | 0 / 0 / 52 / 969 | 0 / 0 / 42 / 337 |
| Whole-body volume, posed / rest | 1 / 1.018 / 1.030 / 1.034 | 1 / 1.008 / 1.014 / 1.017 | 1 / 1.009 / 1.015 / 1.017 |

Notes:

- **Remaining crossings at rest (15).** They are sub-millimetre: the ribbon beside the cut meets the crease flanks near F. This is the same defect as the right's 17.
- **Remaining crossings at 90° (29).** They are wall against wall and wall against skin at the fold ends.
- **The deltoid crush is not from this repair.** It is identical before and after. The test moves only the upper arm, as the right's study did, so the shoulder blade doesn't turn.

  The left is worse than the right because the left shoulder joint sits 3.4 cm lower than the right in your calibrated rig: upper_arm.L's head is at z 0.765, upper_arm.R's at z 0.798. A shoulder-rhythm driver (scapula turning with the arm) would halve it. It is worth checking whether the left head is where you meant it.

## Preservation and integrity (`scripts/preserve.py`, `out/preserve_final.json`)

**Existing faces (297,459):**
- same corner counts and loop starts;
- corner positions, Paint and UVMap UVs, materials and the painted region identical.
- 674 corners now point at the rip's new vertex copies, at identical positions. This is the cut itself. Blender's "Merge by distance" would undo it.

**Existing vertices:**
- positions identical;
- weights identical at x < 0, and everywhere except 3,647 left-armpit vertices.
- At most 4 influences per vertex; the sum error is 1e-4, the same as the baseline (4-decimal rounding). No vertex is without weights.

**Rig:** 59 bones; heads, tails, matrices, parents, deform flags and constraints identical. One Armature modifier, no shape keys, and the same colour attributes as the baseline.

**Mesh:** closed manifold, 1 shell, 0 boundary or non-manifold edges, 0 inconsistent windings, 0 degenerate faces, 0 loose vertices.

**Real exporter** (`ATLAS_MALE_BODY_SOURCE=result/Male_Body_rigged.blend`, `male_body.py`):
- 96 regions, against 96 for the baseline export;
- body +157.9 cm²: the new unpainted pocket walls;
- latissimus-dorsi.L −0.28 cm² and triceps-brachii.L +0.08 cm²: border cleanup along the cut, as the right repair had;
- every other region unchanged (under 0.05 cm²).

## Paint note (not changed; your call)

**Biceps spill on the chest wall.** Along 12 cm of the front crease, the biceps.L paint runs past the crease onto the chest wall: 4.6 cm², median 2.5 mm, at most 11 mm (`scripts/spill.py`).
- At rest it hides in the crease. With the arm raised, it shows as a thin biceps strip on the chest wall.
- The cut follows the geometric crease, the true arm/chest boundary, so the paint was left as it is.
- A touch-up in Texture Paint (painting that strip as latissimus) fixes it.

**Sub-millimetre strays.** Latissimus on the arm side of the back notch, and triceps and coracobrachialis on the chest side, are brush-edge jitter. The exporter's 1 mm cleanup absorbs them.

The new walls are unpainted (`body`). Anatomically:
- the chest wall is latissimus in front and latissimus/teres major at the back;
- the arm wall is biceps, coracobrachialis and triceps.

## Still open (each when you say)

- **Fold-end hand pass:** F at 75–90°, and the ragged crotch corner at the back.
- **Rounding the flat walls:** a sculpt, or corrective keys solved against these weights.
- **Shoulder-rhythm driver,** and a check of the left shoulder joint's height.
- **The inner-thigh rip-and-pocket** and the right fingers (from the rig-weights report).

## Rebuild

```sh
B=/Applications/Blender.app/Contents/MacOS/Blender; export PYTHONDONTWRITEBYTECODE=1
cd ~/Documents/SD-Routine-scratch/armpit-L-2026-10-15
cp original/Male_Body_rigged.blend build/src.blend && chmod 644 build/src.blend
$B -b build/src.blend --factory-startup --python scripts/repairL.py -- repairedL_v1
$B -b build/repairedL_v1.blend --factory-startup --python scripts/relaxL.py -- repairedL_v2
ATLAS_H_SHOULDER=0.07 ATLAS_H_ARM_SIDE=0.05 ATLAS_H_ARM_SIDES=L $B -b build/repairedL_v2.blend --factory-startup --python scripts/weightsL.py -- L_v2a50
$B -b build/L_v2a50_weighted.blend --factory-startup --python scripts/finalize.py -- Male_Body_rigged
$B -b result/Male_Body_rigged.blend --factory-startup --python scripts/preserve.py -- final
$B -b result/Male_Body_rigged.blend --factory-startup --python scripts/validate2.py -- final L   # and R
$B -b result/Male_Body_rigged.blend --factory-startup --python scripts/render2.py -- final L     # and R
```

Note: `validate2.py` reads the territory labels written by the first weights run (`out/labels_L_v1.npy`). If you rebuild from scratch, run `weightsL.py -- L_v1` on `repairedL_v1` first, or point the validator at `labels_L_v2a50.npy`.

**To try it in Blender:** open `result/Male_Body_rigged.blend`, select `ATLAS_Rig`, go to Pose Mode, and rotate `upper_arm.L` or `upper_arm.R`.
