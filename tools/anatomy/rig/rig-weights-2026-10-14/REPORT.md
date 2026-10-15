# New rig on the repaired armpit: weights and arm-elevation tests (2026-10-14)

Scratch only. The production files hash the same before and after (`production.sha`): `Male_Body.blend`, `Male_Body.paint.png`, `male-body.glb` and `js/anatomy-model-male-body.js`. Nothing in the repo was touched.

## Verdict

- **The new rig and weights on the repaired armpit beat both earlier versions at every angle**, apart from three corners noted below.
  - At 90° there are 71 crossing face pairs, against 179 for the old repair and 132 with keys v5.
  - Painted muscle has 5 triangles stretched more than 10×, against 50 and 113.
  - The worst painted stretch is 14×, against 37× and 81×.
  - Pocket faces stretched more than 10×: 25, against 1,945 and 2,361.
  - The deltoid has half the crushed faces.
  - There is no flap.
- **The old corrective keys v5 are not reused.** Tested on the new weights, they made everything worse. Crossings rose from 15/13/71 to 297/405/228 at 30/60/90°, and the worst painted stretch rose from 14× to 121×. Their offsets were solved against the old rig's skinning. What they did fix, the flap, is now fixed by the weights.
- **What's left is shape, not weights.**
  - The walls are still flat: they meet the arm at a 48° crease at 90°, against 43° with keys v5.
  - The pocket walls cross each other at the front fold end F at 75–90°, in 59 of the 71 crossing pairs.
  - Both need the sculpt or topology pass the armpit study already called for. Shape keys, if wanted, would have to be rebuilt against these weights.
- **Paint is preserved exactly.**
  - UVs, materials, rest positions and the painted region of every face are identical to the repaired copy.
  - The real exporter gives the same 96 regions and 344,016 triangles as the repair's export, with 0.00 cm² change in every region.

## Inputs

| File | What |
|---|---|
| `original/Male_Body_repaired.blend` | repair4, the source geometry (read-only copy) |
| `original/Male_Body_rig_calibrated.blend` | your calibrated rig file (read-only copy) |
| `original/Male_Body_unmodified.blend` | production geometry, for the comparison (same hash as production) |
| `original/Male_Body_repaired_keys_v5.blend` | repair + keys v5, for the comparison |

In the keys v5 file, `Armature.001` had been moved to z = 1.65 m, carrying the body with it. `build/prev_keys_v5.blend` puts it back to the location in every other copy, so all copies share one world frame. Nothing else was changed.

## The rig (`scripts/build_rig.py`, `scripts/verify_rig.py`)

The 59-bone ATLAS_Rig was rebuilt on both meshes, and the old 38-bone rig, its 38 vertex groups and its two Armature modifiers were removed.

**Joint positions come from your calibrated file** (`out/calibrated_rig.json`). Besides the fingers, that file also moves:
- the clavicle heads, by 17 mm (L) and 20 mm (R);
- the scapula tips, by 10 mm (L) and 21 mm (R).

All of these are kept.

**`thumb_03.R` was missing from your file** (58 bones). Your `thumb_02.R` already runs to the thumb's tip: a ray along it leaves the skin 2.7 mm past its tail. So I restored `thumb_03.R` by splitting your `thumb_02.R` at the measured IP joint (52 % along). That gives 21.8 + 20.2 mm, and both ends of your chain stay exactly where you put them. If you meant the right thumb to have two segments, delete `thumb_03.R` and merge.

**Axes were recomputed with build 1's rules.** Moving the joints in Edit Mode had kept the old rolls, so the finger axes had drifted by up to 44°. Positive X is the natural bend on all 59 bones again, and every finger curls to the palm.

**Checks:**
- Every bone matches your calibrated file exactly; the one exception is `thumb_02.R`'s tail, the split above.
- No joint lies outside the body.
- The twist constraints work.
- `renders/rig_final_repaired.png` shows the rebuilt rig.

## The weights (`scripts/weights.py`)

1. **Territory.** Each vertex takes the nearest bone it can see: the straight line to the bone must stay inside the body.
   - The distance is measured to a capsule around the bone, with a radius per bone.
   - Points behind a bone's head count double, so the belly isn't "thigh" and the back of the hand isn't "finger".
   - The trunk bones are measured from the torso's centre line, not the spine.
   - In the repaired armpit:
     - the arm side of the cut and the arm wall are always upper arm;
     - the chest side, the chest wall and the dome take the territory of the nearest chest skin (spine_03, spine_02 or scapula.R).
   - Islands join their neighbours.
   - `renders/territory_repaired_v2.png` shows the result.
2. **Blending.** The blend runs over geodesic distance on the surface, which goes round the armpit pocket instead of across it, with a half-width per joint:

   | Joint | Half-width |
   |---|---|
   | Shoulder | 7 cm |
   | Spine | 6 cm |
   | Hip | 7 cm |
   | Elbow | 3.5 cm |
   | Knee | 4.5 cm |
   | Wrist | 2.5 cm |
   | Knuckles | 1.5 cm |
   | Finger joints | 0.8 cm |
   | Parts that only touch (finger against finger, left thigh against right) | 0.4 cm |

   Four smoothing passes follow.
3. **Twist bones.** `upper_arm_twist`, which doesn't roll, carries the shoulder half of the upper arm, and `forearm_twist` the wrist half of the forearm.
4. **Limits.** Each vertex keeps at most 4 influences, normalised to 1 (largest error 1.2e-7).

**Inner upper arm.** It is fully on the arm from 6 cm below the fold ends F and B. Within 6 cm it ramps to about 0.4 at F and B themselves, where the arm skin really does run into the pectoralis major and latissimus/teres major folds.

### Variants tried (repaired mesh; crossings / painted >4× triangles at 30, 60, 90°)

| Variant | Crossings | Painted >4× | Why not chosen |
|---|---|---|---|
| **Shoulder 7 cm (chosen)** | 15 / 13 / 71 | 11 / 56 / 182 | — |
| Shoulder 5 cm | 15 / 32 / 77 | 7 / 92 / 261 | more stretch and crushing at the shoulder |
| Shoulder 3.5 cm | 22 / 28 / 165 | 13 / 211 / 472 | worse everywhere |
| Shoulder 9 cm | 318 / 532 / 541 | 11 / 89 / 194 | the walls cross |
| 7 cm, arm side 3.5 cm | 15 / 11 / 12 | 15 / 164 / 349 | fewest crossings, but moves the stretch onto the inner biceps and triceps |
| 7 cm, arm side 5 cm | 14 / 30 / 56 | 9 / 84 / 224 | between the two |
| 7 cm + fold-end smoothing (40 / 150 passes) | 22 / 55 / 89; 69 / 18 / 11 | 19 / 99 / 229; 18 / 97 / 248 | trades crossings between angles |

## Arm elevation, 0 / 30 / 60 / 90°

**The motion** is the armpit study's: the upper-arm bone turns about the world y axis through its head, and the clavicle and scapula stay still. That keeps the numbers comparable, but nobody raises an arm to 90° without the shoulder blade turning, so the top of the shoulder is crushed in every version.

The two rigs pivot at different places. The old rig's arm bone starts near the acromion; the new one starts at the shoulder joint (see the `bones_*` sheets).

Each cell gives 30 / 60 / 90°.

| | Unmodified, old rig | Repair, old rig | Repair + keys v5, old rig | **Unmodified, new rig** | **Repair, new rig** | Repair, new rig + old keys (test) |
|---|---|---|---|---|---|---|
| Crossing face pairs (armpit zone) | 86 / 160 / 174 | 104 / 98 / 179 | 79 / 75 / 132 | 199 / 301 / 420 | **15 / 13 / 71** | 297 / 405 / 228 |
| Painted muscle: triangles >4× | 454 / 493 / 542 | 55 / 171 / 295 | 132 / 217 / 275 | 26 / 223 / 473 | **11 / 56 / 182** | 35 / 145 / 314 |
| Painted muscle: triangles >10× | 382 / 429 / 440 | 5 / 29 / 50 | 52 / 94 / 113 | 0 / 6 / 21 | **0 / 0 / 5** | 4 / 15 / 44 |
| Painted muscle: worst stretch | 483× / 909× / 1211× | 18× / 31× / 37× | 31× / 59× / 81× | 9× / 17× / 23× | **5× / 10× / 14×** | 19× / 49× / 121× |
| Painted muscle: extra area (cm²) | 673 / 1240 / 1570 | 185 / 376 / 488 | 85 / 169 / 226 | 507 / 995 / 1285 | 181 / 360 / 478 | 257 / 562 / 917 |
| Inner arm: triangles >4× | 128 / 130 / 132 | 23 / 57 / 76 | 4 / 9 / 13 | 15 / 132 / 221 | 8 / 47 / 119 | 33 / 137 / 251 |
| Pocket walls: triangles >10× | — | 470 / 1288 / 1945 | 558 / 1617 / 2361 | — | **1 / 13 / 25** | 51 / 94 / 148 |
| Flap (arm skin >3 cm out) | 400 / 19 / 1 | 9 / 22 / 24 | 0 / 0 / 0 | 310 / 428 / 206 | 7 / 11 / 2 | 5 / 10 / 8 |
| Deltoid: crushed triangles (<0.5×) | 0 / 29 / 712 | 0 / 29 / 712 | 0 / 25 / 719 | 0 / 42 / 337 | 0 / 42 / 337 | 0 / 42 / 337 |
| Crease at the cut, arm / chest (median°) | — | 70/75 · 62/59 · 67/58 | 46/48 · 39/47 · 43/46 | — | 52/67 · 48/57 · 48/57 | 32/39 · 33/44 · 37/43 |
| Arm wall off a round section (median mm) | — | 19 / 20 / 21 | 14 / 14 / 14 | — | 8 / 8 / 12 | 5 / 6 / 6 |
| Upper-arm bone inside the skin; least clearance | 11/11; 49 / 48 / 40 mm | same | same | 11/11; 32 / 29 / 24 mm | 11/11; 32 / 29 / 24 mm | same |
| Whole-body volume, posed / rest | 1.011 / 1.018 / 1.020 | 1.003 / 1.005 / 1.004 | 1.002 / 1.002 / 1.002 | 1.022 / 1.038 / 1.043 | 1.009 / 1.015 / 1.017 | 1.010 / 1.016 / 1.019 |

Notes:

- **Where the remaining crossings are.** At 90°, 59 of the 71 are wall against wall inside the front fold end F (−22, −3, +66 cm). That is the corner the armpit study left for a hand pass. The rest are wall against latissimus skin, also at the fold.
- **Inner arm vs keys v5.** Keys v5 had fewer stretched inner-arm triangles. The new weights blend the inner arm into the folds within 6 cm of F and B, so that skin now stretches (119 triangles over 4× at 90°) instead of crossing.
- **Volume.** The whole-body volume grows 1.7 % at 90°, against 0.4 % for the old repair. It is measured over the whole closed shell. I didn't pin down where the extra sits; the fold skin bridging chest and arm is the likely place.
- **Rest pose.** With the new rig the mesh moves at most 0.00015 mm, which is rounding. The repair's 13 sub-millimetre rest crossings remain, counted as 14–17 depending on that rounding.
- **Metrics:** `out/metrics_<tag>.json`. Everything was measured by one script, `scripts/validate.py`, on the same vertex sets.

## Preservation (`metrics_final_repaired.json`, `out/glb_areas.json`)

- **Vertices, edges, faces and corners:** identical to repair4.
- **Each face's Paint and UVMap UVs, materials, rest position and painted region:** identical.
- **Shape keys:** none.
- **Colour attributes:** the same set as the source. The study's view-only ones were removed.
- **Exporter** (`ATLAS_MALE_BODY_SOURCE=result/Male_Body_rigged.blend`, `male_body.py`): 96 regions and 344,016 triangles, with 0.00 cm² area change against repair4's export in every region.
  - The exporter looks for its paint image under the source's own name (`<name>.paint.png`), which is why `result/` holds named copies. Without them it silently falls back to the old Vertex Paint, giving 62 regions and no leg muscles. My first export run hit exactly that.

## Renders (`renders/sheets/`)

**Contact sheets.** Rows are the repair with the old rig, the repair with keys v5, the new rig on unmodified geometry, and the new rig on the repair. Columns are 0 / 30 / 60 / 90°. Cameras are the armpit study's.

| Sheet | What |
|---|---|
| `clay_{front,back,under}.png` | form |
| `heat_{front,back,under}.png` | stretch: grey 1×, yellow 2×, orange 4×, red 10×+, blue shrunk |
| `paint_{front,back,under}.png` | the painted regions, posed |
| `bones_{front,back,under}.png` | bone placement: the posed deform bones over the clay |
| `weights.png` | upper-arm weight (upper_arm + twist) at rest and 90°, repair and unmodified |

Single frames are in `renders/<tag>/`. `renders/sanity_final_repaired.png` covers the rest of the body (below).

## The rest of the body (`scripts/pose_sanity.py`, `out/sanity_final_repaired.json`)

These are quick bends to catch gross weight errors, not a full pass.

- **Elbows (90°, 140°), spine bend, ankles and toes:** clean. There are no triangles over 10× at the elbows.
- **Inner thighs:** a hip flexion of 90° stretches 1,634 triangles over 10×, at the crotch midline (adductors of both legs, gracilis).
  - Cause: the inner thighs are fused. 682 mesh edges join left-thigh skin directly to right-thigh skin, between z = −0.52 and +0.11.
  - This is the armpit problem again, and needs the same kind of rip and pocket, not weights.
- **Right hand:** a fist stretches 127 triangles over 10× between the right fingers, which are sculpted pressed together. Same cause, smaller.
- **Left armpit:** still the fused original on both copies; the repair was right side only.

## Next steps (each when you say)

1. **Hand pass on the fold ends F and B**, sculpting, or rerouting the cut's ends a few mm apart. This is where the remaining crossings are.
2. **Rounding the flat walls** under the raised arm: a sculpt, or new corrective keys solved against these weights.
3. **Shoulder-rhythm driver**, the scapula turning with the arm. It should halve the crush at the top of the shoulder at 90°.
4. **The same rip and pocket repair for the inner thighs** (and, if wanted, the left armpit and the right fingers).

## Files

| Path | What |
|---|---|
| `result/Male_Body_rigged.blend` | **the result**: repaired armpit, ATLAS_Rig (59 bones), new weights |
| `result/Male_Body_unmodified_rigged.blend` | the same rig and weights method on the unmodified mesh (for comparison) |
| `result/*.paint.png`, `Male_Body.paint.json` | the paint, unchanged; named copies for the exporter |
| `build/` | intermediate copies: rigged, weighted variants, previous-repair copies, old-keys test |
| `scripts/` | everything used (see below) |
| `out/` | metrics, weights (`weights_*.npz`), territories, build logs, exporter GLB |

## Rebuild

```sh
B=/Applications/Blender.app/Contents/MacOS/Blender; export PYTHONDONTWRITEBYTECODE=1
cd ~/Documents/SD-Routine-scratch/rig-weights-2026-10-14
$B -b --factory-startup --python scripts/inspect.py                        # writes out/calibrated_rig.json
cp original/Male_Body_repaired.blend build/src.blend && chmod 644 build/src.blend
$B -b build/src.blend --factory-startup --python scripts/build_rig.py -- repaired_rigged
ATLAS_H_SHOULDER=0.07 $B -b build/repaired_rigged.blend --factory-startup --python scripts/weights.py -- repaired_h070 pocket
$B -b build/repaired_h070_weighted.blend --factory-startup --python scripts/finalize.py -- Male_Body_rigged
$B -b result/Male_Body_rigged.blend --factory-startup --python scripts/validate.py -- final_repaired
$B -b build/repaired_h070_weighted.blend --factory-startup --python scripts/render.py -- final_repaired
$B -b build/repaired_h070_weighted.blend --factory-startup --python scripts/bones_overlay.py -- final_repaired
```

To try it in Blender, open `result/Male_Body_rigged.blend`, select `ATLAS_Rig`, go to Pose Mode, and rotate `upper_arm.R`. Weight Paint mode shows each bone's group.
