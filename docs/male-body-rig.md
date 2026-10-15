# Male_Body rig

`assets/anatomy/Male_Body_rigged.blend` is the experimental posing baseline. The app doesn't use it: `male_body.py` exports from `Male_Body.blend`, which stays the painting source of truth.

## What's in it

**ATLAS_Rig, 59 bones:**
- 58 deform bones plus `root`;
- joints measured on the sculpture and then calibrated by hand;
- rest pose = the sculpted pose;
- positive local X is each joint's natural bend.

**Weights:**
- Each vertex takes the nearest bone it can see.
- Territories are blended over geodesic distance (7 cm at the shoulder).
- At most 4 influences per vertex, normalised.

**Both armpits ripped and pocketed.** The sculpture had each inner arm fused to the chest wall, which made a membrane when the arm was raised. Each armpit was cut along the measured crease, from just under the pectoralis major's lower edge, under the arm, to just under teres major's. The hole is closed by two walls (inner arm and chest wall) meeting in a dome.
- The left was measured on its own geometry, not mirrored.
- The left inner arm blends over 5 cm, not 7.

The new walls are unpainted (`body`).

## Preserved

- Every original face keeps its positions, Paint/UV map, material and painted region.
- The exporter gives the same 96 regions.
- The paint image `Male_Body.paint.png` fits the rigged file too.

**To export it:** copy the image next to it as `Male_Body_rigged.paint.png` and set `ATLAS_MALE_BODY_SOURCE`. Without the image, the exporter silently falls back to the old Vertex Paint (62 regions).

The cut vertices are duplicated in place, so Blender's "Merge by distance" would undo the repair.

## Results at 90° arm elevation

| | Left before | Left after | Right after |
|---|---|---|---|
| Worst stretch on painted muscle | 311× | 17× | 14× |
| Crossing face pairs | 335 | 29 | 71 |
| Skin flap (vertices) | 228 | 45 | 11 |

## Known limits

- The pocket walls are flat.
- The fold ends need a hand pass (front fold end at 75–90°, and the ragged back corner on the left).
- The left shoulder joint sits 3.4 cm lower than the right, so the top of the left shoulder crushes more at 90°. A shoulder-rhythm driver would help.
- About 4.6 cm² of biceps.L paint spills past the front crease onto the chest wall.

## Still to do

- The fused inner thighs (hip flexion tears the crotch).
- The fused right fingers.

## Working on it

Work on scratch copies in `~/Documents/SD-Routine-scratch/<study>/`, never on the production files. Each study keeps its scripts, reports, metrics and renders there; they aren't committed.

Commit only results (the `.blend`, at milestones) and short notes like this one. Each version of the rigged file adds about 16 MB to the history.
