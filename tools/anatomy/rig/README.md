# Male_Body rig: studies and scripts

This folder records how `assets/anatomy/Male_Body_rigged.blend` was made. That file is the experimental posing baseline: the Male_Body sculpture with both armpits separated, the 59-bone `ATLAS_Rig` and its weights.

The app doesn't use the rigged file. `male_body.py` exports from `Male_Body.blend`, which stays the painting source of truth.

The rigged file shares the Paint UVs on every original face, so `Male_Body.paint.png` paints it too. To export it, copy the image next to it as `Male_Body_rigged.paint.png` and set `ATLAS_MALE_BODY_SOURCE`. Without the image, the exporter silently falls back to the old Vertex Paint (62 regions).

## The studies, in order

| Folder | What it did | Report |
|---|---|---|
| `armpit-R-2026-10-14/` | Rip-and-pocket repair of the fused right armpit (`scripts/repair4.py`). `corrective/` holds the shape-key attempt, since retired. | `REPORT.md`, `corrective/REPORT.md` |
| `rig-2026-10-14/` | The 59-bone ATLAS_Rig: joints measured on the sculpture, then calibrated by hand. | `PROPOSAL.md`, `BUILD.md` |
| `rig-weights-2026-10-14/` | The rig rebuilt from the calibration and weighted on the repaired mesh (`scripts/weights.py`). Approved as the baseline on 2026-10-15. | `REPORT.md` |
| `armpit-L-2026-10-15/` | The left armpit, measured on its own geometry (`repairL.py`, `relaxL.py`, `weightsL.py`). The right side is bit-identical to the baseline. | `REPORT.md` |

## Running them

The scripts are kept as a record. They expect the layout of the scratch folder they ran in (`~/Documents/SD-Routine-scratch/<study>/`):
- `original/`
- `build/`
- `out/`
- `result/`

Each study's `common.py` finds those folders relative to itself and refuses to open a file outside the scratch tree. To rerun one, copy its folder to a scratch location and follow the Rebuild section of its report. Run Blender headless with `PYTHONDONTWRITEBYTECODE=1`.
