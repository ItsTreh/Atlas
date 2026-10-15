# Right armpit: pose-driven corrective shape keys (experiment, 2026-10-14)

Scratch only. It builds on `../repaired/Male_Body.blend` (repair4, which it leaves unchanged) and saves `corrective/Male_Body.blend`.

- **Production files:** unchanged. `Male_Body.blend`, `Male_Body.paint.png`, `male-body.glb` and `js/anatomy-model-male-body.js` hash the same before and after this session.
- **Not touched:** the left arm, the export pipeline and the app code.

## Verdict

- **The keys fix the protruding skin.** They also bring the walls much closer to rounded, and they add no intersections.
- **The fold ends F and B need a manual pass.** Procedural fixes trade stretch against intersections at those two corners, and neither trade is good enough.
- **Not production-ready.**

## What the protruding skin actually was

It is not the pocket: it is **painted original skin**, biceps and triceps on the arm side of the cut, from z 0.475 to 0.64.

- **Cause:** these vertices keep 12–43 % torso weight (`Bone`, `Bone.001`). repair4's weight smoothing lowered their median arm weight from 0.88 to 0.76.
- **Effect:** as the arm rises they lag 4–6 cm behind it and hang under the arm. At 90° they stand up to 14 cm from the arm's axis, where the section's median is 7 cm.
- **If they moved with the arm:** 7.7 cm, a normal section.

So the cause is weights. A key can hide it, but repainting those weights is the cleaner fix (see the end).

## The keys (`scripts/corrective.py`, version 5)

There are three keys, `armpit_R_30`, `armpit_R_60` and `armpit_R_90`.

- **Driver:** the upper arm's rotation angle (2·acos w of Bone.010's pose quaternion), an ordinary scripted expression with no Python needed.
- **Blending:** each key peaks at its own angle and blends linearly between, so 45° = ½·30 + ½·60. `armpit_R_90` stays at 1 beyond 90°.
- **At rest** all three are 0.

Each key is built in its own pose:

1. **Inner-arm skin.** Arm-side vertices that can lag (some weight off the arm) are drawn toward the arm's rigid motion. This fades out:
   - toward F and B (4 cm),
   - toward the shoulder (from the fold ends' level),
   - 8–12 cm from the cut,
   - and stops 6 cm above the elbow.
2. **The dome**, the walls' shared top row, stays where the skin puts it. Freeing it (v1) made the fill span the armpit again, a new membrane.
3. **Walls.** A thin-plate (biharmonic) fill with everything else fixed, using the cotangent Laplacian of the rest mesh.
   - The fill reaches one ring past the cut, so each wall leaves the cut tangent to the skin beside it: the arm wall carries on the arm's curvature, the chest wall the rib wall's.
   - Near F, B and the bottom of the cut, the walls meet the cut's position but not its tangent. Carrying the tangent there folded the walls over the crease (v3).
   - Within 3 cm of F and B the walls go back to plain skinning (see "Fold ends").
4. **Rest-space offsets.** Offset = A⁻¹(target − skinned), with A measured per vertex by finite differences. Each key on its own lands the vertices on target within 0.015 mm.

| Version | Change | Result |
|---|---|---|
| v1 (`corrective_v1.py`) | free fill of the whole pocket | spans arm to chest: a new membrane |
| v2 | inner-arm correction within 5 cm only | the flap sits at about 5 cm and stays |
| v3 | correction across the whole inner arm | flap gone; new crossings where the walls fold over the bottom of the cut |
| v4 (`Male_Body_keyv4.blend`) | tangent dropped at the corners | bottom-of-cut crossings gone; the F corner crowds (277 pairs at 90°) |
| **v5** (`Male_Body.blend`) | plain skinning at F and B | crossings back to repair4's level, all at the old corners |

## Measurements (`out/metrics2_*.json`, `scripts/validate2.py`)

Before = repair4 (no keys). After = keys v5. Same mesh and the same evaluation: 45° and 75° are blends of two keys.

| | 30° before → after | 60° | 90° |
|---|---|---|---|
| **Intersections** (face pairs, armpit zone) | 104 → 104 | 98 → 85 | 179 → 154 |
| … pocket/pocket · pocket/original · original/original | 54·44·6 → 52·46·6 | 51·35·12 → 47·29·9 | 45·75·59 → 32·68·54 |
| **Protruding skin** (vertices > 3 cm out; worst) | 0 → 0 | 12, 4.0 cm → 0 | 28, 6.7 cm → 0 |
| **Seam angle at the cut** (median, arm/chest; 0 = smooth) | 70/75° → 46/53° | 62/59° → 39/44° | 67/58° → 43/42° |
| **Arm wall:** off a round section (median) | 26 → 16 mm | 26 → 16 mm | 28 → 16 mm |
| **Chest wall:** off the rib wall's curve (median) | 7.7 → 3.6 mm | 11.3 → 5.6 mm | 10.3 → 4.9 mm |
| **Painted muscle stretch:** extra area; tris > 4× / > 10×; worst | 185 cm², 55/5, 18× → 107 cm², 36/0, 10× | 376, 171/29, 31× → 226, 123/16, 17× | 488, 295/50, 37× → 314, 233/32, 23× |
| **Pocket stretch away from F/B:** median; worst; tris > 10× | 1.03×, 2.8×, 0 → 1.73×, 20×, 51 | 1.19×, 4.6×, 0 → 2.41×, 20×, 45 | 1.36×, 6.1×, 0 → 2.86×, 19×, 82 |
| **Pocket stretch within 3 cm of F/B:** tris > 10× | 470 → 467 | 1,288 → 1,225 | 1,945 → 1,841 |

At 45° and 75° the blend behaves too:
- crossings 94 → 81 and 131 → 102;
- no flap;
- worst pocket stretch away from F/B 20×.

### Intersections

- **No new ones.** All that remain, before and after, sit at F (rest −0.22, −0.03, 0.66) and B (−0.25, 0.08, 0.64).
- **The original/original pairs are the skin's own.** They are the same with or without keys, so no pocket key can remove them.

### Stretching, the honest trade

- **Away from the corners the walls now stretch more** than repair4's (median 2.9× at 90°). A rounded wall covers more surface than a flat chord, and at rest the pocket is squeezed to 3.5 mm.
- **This is spread out, not spiky:** the worst face away from the corners is 19×. The heat sheets show it as an even orange (4×) over the walls, not red streaks.
- **Painting:** the walls are unpainted (`body`), so this stretch would matter for texture if they are ever painted.

### Preservation

Compared with the reference copy:

- **Faces, edges and vertices:** the same count as repair4.
- **Original faces:** Paint and UVMap UVs, materials, rest positions and painted regions are all identical.
- **Left side:** no key moves a left-side vertex.
- **Original vertices moved by the keys:** 1,211, posed only. By region:

| Region | Faces |
|---|---|
| biceps-brachii.R | 1,630 |
| triceps-brachii.R | 832 |
| deltoid.R | 42 |
| latissimus-dorsi.R | 39 |
| body | 31 |
| brachialis.R | 5 |

All of these are on the inner arm or at the arm-side fold ends. The other 8,963 moved vertices are pocket vertices.

## Renders (`renders/`)

- **Sheets:** `sheet_{front,back,under}_{clay,heat}.png`. Rows are repair4 / keys v5 / keys v4, at 0 / 30 / 60 / 90°, from repair4's cameras.
- **Single frames:** `key_v5/`, `key_v4/` and `../renders/after/`.

What they show:
- **Front and back:** the hanging flap (repair4 at 30–90°) is gone, and the arm's outline under the raised arm is clean.
- **From below:** the walls form a rounded trough instead of two flat panels.
- **Still visible:** streaky shading from the long, thin wall cells, and lumpy skin at the front fold end.

## Needs manual work (not forced)

1. **Fold ends F and B (anterior and posterior axillary folds).** Every wall meets the fold at one shared vertex.
   - Plain skinning leaves 10×+ stretch there.
   - The fill crowds the corner instead and its walls cross the fold skin.
   - The fix is to sculpt the fold ends in a raised-arm pose, or to re-route the cut's ends a few mm apart (topology), then take that as the 60°/90° key.
2. **The skin's own crossings at F**, 54 pairs at 90° with or without keys: unpainted skin against latissimus.
   - These come from the weights at the fold end.
   - They need weight painting there, or a sculpted corrective.
3. **Inner-arm weights.** The flap is a weights fault, so a key only hides it. Setting the arm-side skin along the cut to the arm bones (the 12–43 % torso weight off) fixes it for every pose, not just these three angles. That is a weight-paint pass on painted biceps and triceps, a production-asset change, so it is your call.
4. **Arm-wall fullness.** The arm wall is still about 1.6 cm flatter than a round section, because the fill keeps to the cut's own tangent. A full biceps short head, coracobrachialis and triceps long head under the arm is sculpting, not a procedure.
5. **Thin cells.** The walls' long, thin faces cause the streaky shading. Fewer columns away from the cut would fix it; repair4 limitation 4 still applies.

## Files

| File | What |
|---|---|
| `Male_Body.blend` | repair4 + keys v5 (the result) |
| `Male_Body_keyv3.blend`, `Male_Body_keyv4.blend` | earlier keys, kept for comparison |
| `scripts/corrective.py` | v5 builder; `corrective_v1…v4.py` are the earlier versions |
| `scripts/validate2.py` | the measurements above |
| `scripts/sheets2.py` | contact sheets |
| `scripts/flap.py`, `flap2.py` | the flap diagnosis |
| `out/` | metrics, build log (`build.json`), vertex sets (`sets.npz`), key targets |

To rebuild and measure:

```sh
B=/Applications/Blender.app/Contents/MacOS/Blender; cd ~/Documents/SD-Routine-scratch/armpit-R-2026-10-14
PYTHONDONTWRITEBYTECODE=1 $B -b repaired/Male_Body.blend --factory-startup --python corrective/scripts/corrective.py
PYTHONDONTWRITEBYTECODE=1 $B -b corrective/Male_Body.blend --factory-startup --python corrective/scripts/validate2.py -- after_v5
PYTHONDONTWRITEBYTECODE=1 $B -b corrective/Male_Body.blend --factory-startup --python scripts/render.py -- ../corrective/renders/key_v5
```
