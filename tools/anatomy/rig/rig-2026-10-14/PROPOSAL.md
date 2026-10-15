# Male_Body armature: proposal (2026-10-14)

Read-only study on a scratch copy (`original/Male_Body.blend`, write-protected). Nothing is built yet, and the production files are unchanged (`production.sha`).

## The current rig: replace it rather than fix it

38 bones (`out/inventory.json`, `renders/current_rig.png`).

- **No neck bone.** One 59 cm bone runs from the chest down to the pelvis and carries the neck stump.
- **No foot or toe bones.** The feet are weighted to the shins.
- **Left upper arm:** pivots 8 cm from the shoulder joint, inside the trapezius.
- **Hips:** 7–10 cm from the measured hip joints.
- **Knees:** 7–10 cm off. The right knee sits 8 cm in front of the joint.
- **Hands:** the right hand has 4 finger chains, the left only 2. There are no proper thumbs.
- **Weights:** half the vertices' weights don't sum to 1, and some vertices have up to 8 influences (glTF/three.js uses 4).
- **What is accurate:** only the elbows and wrists, within 1–2 cm.

Re-weighting is needed anyway, because the bone layout changes.

## The sculpture

- **Headless:** it ends in a neck stump only 3 cm above C7.
- **Not symmetric.** It stands in a stride:
  - the right leg is back, with the knee bent about 40° and the heel raised;
  - the pelvis is higher on the planted left leg;
  - the left shoulder is dropped;
  - the spine curves up to 4 cm toward the right.
- **Mirror distance:** median 4 cm, 12 cm on the shins.

So every joint is measured per side, and X-mirror weight painting won't work. Bones still get mirrored `.L` / `.R` names and mirrored axes, so Blender's pose copy/paste-flipped still works.

## Proposed skeleton (`renders/proposal.png`: red joints, blue bones, current rig pink)

- **Bones:** 1 root (non-deform) + 6 trunk + 7 per arm + 15 fingers per hand + 4 per leg = 58 deform bones, or 60 with thigh twist bones. (Earlier versions of this file said 59: the count was off by one.)
- **Rest pose:** the sculpted pose, as it is. The page shows the sculpture as it stands, so it can't be moved into a T-pose.
- **Axes:** local Y along each bone; local X = the joint's main flexion axis, so bending is one rotation about X.

### Joint positions (measured; world metres, model's left = +x, front = −y)

| Bone | Parent | Head (joint) | Tail | Length |
|---|---|---|---|---|
| `pelvis` | `root` | pelvis (0.018, -0.122, 0.202) | L5 S1 (-0.004, -0.029, 0.302) | 13.8 cm |
| `spine_01` | `pelvis` | L5 S1 (-0.004, -0.029, 0.302) | L3 L4 (-0.021, -0.020, 0.381) | 8.1 cm |
| `spine_02` | `spine_01` | L3 L4 (-0.021, -0.020, 0.381) | T12 L1 (-0.042, 0.027, 0.543) | 17.1 cm |
| `spine_03` | `spine_02` | T12 L1 (-0.042, 0.027, 0.543) | T7 (-0.033, 0.053, 0.711) | 17.0 cm |
| `spine_04` | `spine_03` | T7 (-0.033, 0.053, 0.711) | C7 T1 (-0.013, 0.024, 0.878) | 17.1 cm |
| `neck` | `spine_04` | C7 T1 (-0.013, 0.024, 0.878) | neck top (-0.012, 0.034, 0.906) | 2.9 cm |
| `clavicle.L` | `spine_04` | sternoclavicular (0.022, -0.071, 0.843) | acromioclavicular (0.219, 0.041, 0.812) | 22.8 cm |
| `scapula.L` | `clavicle.L` | acromioclavicular (0.219, 0.041, 0.812) | scapula tip (0.064, 0.142, 0.580) | 29.6 cm |
| `upper_arm.L` | `scapula.L` | shoulder (0.239, 0.041, 0.765) | elbow (0.283, 0.048, 0.400) | 36.7 cm |
| `forearm.L` | `upper_arm.L` | elbow (0.283, 0.048, 0.400) | wrist (0.350, -0.022, 0.085) | 33.0 cm |
| `hand.L` | `forearm.L` | wrist (0.350, -0.022, 0.085) | knuckles (0.349, -0.025, -0.026) | 11.0 cm |
| `thigh.L` | `pelvis` | hip (0.125, -0.114, 0.214) | knee (0.101, -0.024, -0.372) | 59.4 cm |
| `shin.L` | `thigh.L` | knee (0.101, -0.024, -0.372) | ankle (0.051, 0.001, -0.837) | 46.9 cm |
| `foot.L` | `shin.L` | ankle (0.051, 0.001, -0.837) | ball (0.082, -0.139, -0.922) | 16.6 cm |
| `toe.L` | `foot.L` | ball (0.082, -0.139, -0.922) | toe tip (0.134, -0.195, -0.939) | 7.8 cm |
| `clavicle.R` | `spine_04` | sternoclavicular (-0.022, -0.071, 0.843) | acromioclavicular (-0.256, 0.005, 0.846) | 24.6 cm |
| `scapula.R` | `clavicle.R` | acromioclavicular (-0.256, 0.005, 0.846) | scapula tip (-0.148, 0.122, 0.592) | 29.9 cm |
| `upper_arm.R` | `scapula.R` | shoulder (-0.276, 0.005, 0.798) | elbow (-0.323, 0.001, 0.400) | 40.1 cm |
| `forearm.R` | `upper_arm.R` | elbow (-0.323, 0.001, 0.400) | wrist (-0.317, -0.136, 0.100) | 33.0 cm |
| `hand.R` | `forearm.R` | wrist (-0.317, -0.136, 0.100) | knuckles (-0.314, -0.151, -0.009) | 11.0 cm |
| `thigh.R` | `pelvis` | hip (-0.089, -0.130, 0.190) | knee (-0.151, -0.097, -0.393) | 58.8 cm |
| `shin.R` | `thigh.R` | knee (-0.151, -0.097, -0.393) | ankle (-0.169, 0.157, -0.750) | 43.8 cm |
| `foot.R` | `shin.R` | ankle (-0.169, 0.157, -0.750) | ball (-0.239, 0.059, -0.928) | 21.5 cm |
| `toe.R` | `foot.R` | ball (-0.239, 0.059, -0.928) | toe tip (-0.229, -0.030, -0.929) | 8.9 cm |

**Further bones:**
- **`root`:** on the floor under the pelvis, non-deform.
- **Twist bones** (not in the table; head at the segment's joint, halfway along it):
  - `upper_arm_twist`: the upper half of the upper arm. It follows the arm's swing but not its roll (Damped Track), so the deltoid doesn't candy-wrap.
  - `forearm_twist`: the lower half of the forearm. It takes about half of the hand's roll, which is pronation and supination.
  - `thigh_twist` (optional): the same idea for hip rotation.
- **Fingers:** 15 per hand.
  - Thumb: `thumb_01–03`, through the carpometacarpal, metacarpophalangeal and interphalangeal joints.
  - Each finger: `index`, `middle`, `ring`, `pinky` `_01–03`, through the knuckle and the two finger joints.
  - Measured finger by finger in the build step. The hands hang half-closed beside the thighs, so the table gives only the wrist and knuckles here.

### How each joint was found (`scripts/joints.py`; full numbers in `out/joints.log`)

| Joint | Rule | Cross-check |
|---|---|---|
| Hip | Bell et al. (1990) from the two ASIS (front points of the pelvis), taken as the top of the painted sartorius, its origin | lands at the pubic symphysis's level, as it should |
| Knee | the narrowest section between thigh and calf | — |
| Ankle | midpoint of the malleoli (the widest section below the shin's narrowest), 8 mm lower | — |
| Ball of the foot | the widest section of the forefoot | — |
| Shoulder | 4.5 cm inside the skin from both the side and the top (deltoid ≈ 2 cm + humeral head radius ≈ 2.4 cm), midway front to back | — |
| Elbow | the narrowest section above the forearm bulge | the bend between upper arm and forearm (0.9 cm away, right arm) |
| Wrist | 1 cm beyond the forearm's narrowest point | — |
| Knuckles | 1.5 cm before the fingers split off the palm | 11.0 cm from the wrist on both hands |
| Spine | levels from surface anatomy: L5/S1 under the iliac crest, L3/L4 at the navel, T12/L1 by the transpyloric plane, C7/T1 4 cm above the jugular notch; sideways on the spinal groove; depth 27–40 % of the body's depth, from the back | — |
| Scapula tip | the lowest corner of the painted infraspinatus and teres major | 10.6 cm from the spine on both sides |

### Uncertain (about ±2 cm; easy to nudge in Edit Mode)

- **Right knee and ankle (the bent, raised leg).** The right shin measures 43.8 cm against the left's 46.9, and the foot 21.5 against 16.6. The right ankle is probably about 3 cm too high.
- **Shoulders.** They are 2.6 (right) and 4.3 cm (left) off the upper arm's own centreline. That line can only be measured below the fused armpit.
- **Spine depth.** It uses typical fractions of body depth, and vertebrae can't be seen from the surface.

## Decisions for you (my recommendation first)

1. **Scapula bone:** yes. Shrugs, rows and push-up-plus move the shoulder blade, and the painted trapezius, rhomboids, infraspinatus and serratus deform with it. The upper arm is parented to it, since the glenoid is on the scapula.
2. **Twist bones:** upper arm and forearm yes. Thigh optional.
3. **Fingers:** a full 15 per hand, so the hands can grip a bar or dumbbell.
4. **Spine:** 4 segments, so crunches and hyperextensions bend smoothly.
5. **Shoulder rhythm:** the clavicle and scapula follow the arm automatically above about 60° (roughly 1° of shoulder blade per 2° of arm). This is a driver, added during pose testing.

## Next steps (each only when you say)

1. **Build:** the bones, rolls and constraints on a scratch copy. You check it in Blender.
2. **Weights:** computed for the new bones:
   - at most 4 influences per vertex, normalised;
   - smooth blends across each joint;
   - the inner arm fully on the arm.
   You then hand-paint the armpit and the fold ends.
3. **Pose tests:** squat, overhead press, curl, row, lunge and so on, measuring stretch and intersections as in the armpit work.

Your current `.blend` and its paint aren't touched until you decide to bring the rig across.
