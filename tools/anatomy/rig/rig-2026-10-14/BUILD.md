# ATLAS armature: build 1 (2026-10-14)

Scratch only. The file is `build/Male_Body_rig.blend`; the production files are unchanged (`production.sha`).

## What's in the file

- **`ATLAS_Rig`:** the new armature, drawn in front of the body.
  - 59 bones: 58 deform plus `root`, which doesn't deform.
  - 37 bones connected to their parent, one hierarchy under `root`.
- **`Armature.001`:** the old rig. It is hidden, not deleted.
- **`Mesh_0`:** unchanged. It is still bound to the old rig. Weights for the new rig are the next step, so posing `ATLAS_Rig` doesn't move the body yet.
- **Bone collections:** `Root`, `Trunk`, `Arm.L/R`, `Fingers.L/R`, `Leg.L/R`.
- **Rotation:** every pose bone uses quaternions.

## The bones

| Group | Bones |
|---|---|
| Trunk | `pelvis` → `spine_01`–`spine_04` → `neck` |
| Each arm | `clavicle` → `scapula` → `upper_arm` → `forearm` → `hand`, plus `upper_arm_twist` (child of `scapula`) and `forearm_twist` (child of `forearm`) |
| Each hand | `thumb_01–03`; `index`, `middle`, `ring`, `pinky` `_01–03` |
| Each leg | `thigh` (child of `pelvis`) → `shin` → `foot` → `toe` |

Joint positions for every bone except the fingers are in `PROPOSAL.md`. They were since corrected:
- the clavicle joints moved slightly deeper (their straight chord had poked 1–3 mm out of the skin);
- the toe tip is now the middle of the toe row;
- the ball of the foot is on the foot's own axis.

### Fingers (measured; `scripts/fingers.py`)

How they were measured:
- **Fingers:** each sits in its own plane across the hand, at the first phalanx's thickness peak. Its centreline is traced in that plane from the palm, round the curl, to the tip.
- **Knuckle (MCP):** 1.5 cm before the finger leaves the palm.
- **PIP and DIP:** at 48 % and 78 % of the finger's length, snapped to the sharpest bend unless that breaks the shortening pattern. The right middle and pinky use plain proportions.
- **Overlong traces:** fingers whose trace ran on into a touching surface are cut back to typical length.
- **Thumb:** the separate loop in cuts across the hand. The CMC is 4.8 cm back from the MCP.

| Finger | Bone lengths (cm), base to tip |
|---|---|
| thumb.L | 4.8 / 3.6 / 3.3 |
| index.L | 3.4 / 3.6 / 2.6 |
| middle.L | 4.8 / 3.8 / 2.4 |
| ring.L | 4.4 / 3.0 / 2.8 |
| pinky.L | 3.4 / 2.6 / 2.6 |
| thumb.R | 4.8 / 3.2 / 3.0 |
| index.R | 3.0 / 2.8 / 3.0 |
| middle.R | 3.9 / 2.8 / 1.9 |
| ring.R | 4.8 / 3.1 / 1.6 |
| pinky.R | 4.2 / 2.5 / 2.0 |

These are the least certain joints, about ±5 mm. The right hand's fingers press together, so no cut there shows a clean groove. The right index plane is the nearest one that traces.

## Axes

Local Y runs along each bone. A positive rotation about local X is the joint's natural bend:

| Bone | Positive X rotation |
|---|---|
| pelvis, spine, neck | forward bend |
| clavicle | elevation |
| scapula | upward rotation |
| arms | flexion |
| hand | wrist flexion |
| fingers | curl toward the palm |
| thigh | hip flexion |
| shin | knee flexion |
| foot | dorsiflexion |
| toe | curl |

- **Knees and fingers** take their axis from their own visible bend.
- **Elbows** follow the rule instead, because their bend includes the carrying angle.
- **Left/right mirror:** the axes are mirrored. They differ 5–13° where the stride and lean make the two sides really differ (clavicle, forearm, hand, thigh, shin, toe). Paste-flipped pose works, but is approximate there.

## Constraints

- **`upper_arm_twist`:** Damped Track to the elbow. It swings with the arm but doesn't roll.
- **`forearm_twist`:** copies the hand's roll in local space at 0.5 influence, so pronation and supination spread down the forearm.
- **Export:** constraints are baked when animation is exported to glTF.

## Checks (`scripts/verify_rig.py` → `out/verify.json`)

- **Positions:** every joint matches the measurements (0 mm).
- **Inside the body:** every head, midpoint and inner tail is inside. The end of a chain (fingertips, toe tips, neck top, scapula tip) sits at the skin by design. The tightest point is `middle_03.L`'s midpoint, 3 mm under the skin.
- **Bend direction:** positive X bends the intended way on all 59 bones; every finger and thumb segment curls to the palm.
- **Twist bones:**
  - a 60° hand roll gives the forearm twist 30°;
  - after 70° of arm flexion the upper-arm twist is 0.03° off the arm.
- **Rendered from the saved file:** `renders/rig_built.png`.

## Not done yet (each when you say)

- **Weights.** The mesh is still bound to the old rig. Next is computing new weights: at most 4 influences, normalised, smooth across each joint, the inner arm fully on the arm.
- **Shoulder rhythm driver**, the shoulder blade following the arm above about 60°: added during pose testing.
- **Animation controls** (IK for legs and arms, foot roll): optional, on top of this deform skeleton.

## Checking it in Blender

1. Open `build/Male_Body_rig.blend` in the scratch folder.
2. Select `ATLAS_Rig` and enter Pose Mode.
3. Rotate any bone about its local X (`R X X`) to see the bend.
4. To nudge a joint: Edit Mode, then move the head or tail. Connected chains move together.

## Rebuild

```sh
B=/Applications/Blender.app/Contents/MacOS/Blender; export PYTHONDONTWRITEBYTECODE=1
cd ~/Documents/SD-Routine-scratch/rig-2026-10-14
$B -b original/Male_Body.blend --factory-startup --python scripts/joints.py
$B -b original/Male_Body.blend --factory-startup --python scripts/fingers.py
$B -b original/Male_Body.blend --factory-startup --python scripts/build_rig.py
$B -b build/Male_Body_rig.blend --factory-startup --python scripts/verify_rig.py
```
