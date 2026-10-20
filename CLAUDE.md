# ATLAS — notes for Claude

ATLAS is a weekly training planner that runs in the browser. It has three stages:

1. **Targets**: pick muscles on an anatomy figure.
2. **Nutrition**: calorie and protein targets worked out from that training.
3. **Week plan**: sessions, exercises and meals placed into the user's free hours.

One sculpture runs through all three, its camera moving between stages (`docs/redesign.md`).

`README.md` describes the product and the code layout. This file covers how to work on it, where it is heading, and the anatomy pipeline, which is where most of the current work happens.

## Hard constraints

- **The page opens straight from disk (`file://`).** It uses plain HTML, CSS and JS as classic scripts, with no framework, bundler, modules or server. Generated models are classic scripts too (`js/anatomy-model*.js`). Never break this.
- **The data stays apart from the UI.** Views read and write shared state (`routine`, `routine.selection`). `MuscleSelection` (`js/selection.js`) is the one source of truth for targets, so nothing keeps its own copy.
- **Every calorie, protein or progress figure is labelled an estimate** and shows how it was worked out. The app never promises a physique by a date.
- **Never loosen size, triangle or region tests silently.** If a test has to change, say so and explain why.

## Commands

```sh
npm test                                   # Vitest: logic and anatomy model tests
npm run build:anatomy                      # procedural figure → js/anatomy-model.js
npm run build:anatomy-authored assets/anatomy/male-body.manifest.json
                                           # male-body.glb → js/anatomy-model-male-body.js
```

Blender 5.2.2 is **not on PATH**, so use `/Applications/Blender.app/Contents/MacOS/Blender`. Run it headless with `-b --factory-startup --python <script>`, and set `PYTHONDONTWRITEBYTECODE=1` so no `__pycache__` lands in the repo.

The page shows the Male_Body sculpture. To see the procedural figure it replaced, open `index.html?anatomy=procedural`.

## Anatomy pipeline (Male_Body)

```
assets/anatomy/Male_Body.blend      the sculpture; hand-edited, the source of truth
  │  + Male_Body.paint.png          the paint (Texture Paint, on the UV map "Paint")
  │  + Male_Body.paint.json         colour key: painted colour → region id
  ▼  tools/anatomy/authored/male_body.py   (Blender; only READS the .blend)
assets/anatomy/male-body.glb        one primitive per region
  ▼  tools/anatomy/build-authored.mjs + male-body.manifest.json
js/anatomy-model-male-body.js       what the page loads
  ▼  js/anatomy-regions.js          region id → app muscle id (16 muscles, model.js)
```

**Where a face's region comes from**, in priority order. All three are applied by `male_body.py` at export.

1. **Painted (the current method).** The user paints in Blender's Texture Paint into `Male_Body.paint.png`, one colour per region, and `Male_Body.paint.json` maps each hex colour to a region id. Several colours may map to one region, e.g. a touch-up in a slightly different shade. The image lies on the sculpture through its own UV map, `Paint`; the model's original `UVMap` overlaps and is unused. `paint_setup.py` made both once, baking the earlier Vertex Paint result into the image. The Vertex Paint colours are still in the .blend but the exporter ignores them while the image exists. At export:
   - the border is read straight from the image: each vertex takes the region under it (each pixel within a few RGB steps of a listed colour or white takes it; any other pixel, the soft edge of a stroke, takes the region of the nearest pixel that does, so a blend never names a third muscle whose colour it resembles. A touch-up in another shade must therefore be keyed), each edge between two regions is **cut where the image changes along it**, and each face takes the region at its centre. So a border runs where the brush went, however long or thin the faces, and highlights come out as smooth curves;
   - every read takes the commonest region within about 1 mm, which cleans up a stray pixel. There's no 3D blur any more: a blur by distance (Vertex Paint used 1 cm, the first image version 4 mm) made sawtooth spikes on long thin faces and leaked paint across tight creases (armpit, buttock cleft);
   - a painted region takes exactly its painted faces and replaces any older material of the same name.

   The regions painted so far are listed at the start of each session by a SessionStart hook (`tools/claude/session-context.sh`, which reads `Male_Body.paint.json`), so they're never written down here.
2. **Authored materials.** These are per-face materials named by region id, written earlier by `male_body_regions.py`, a landmark and border script. That script found curved areas unreliable and is now superseded by painting. It refuses to touch the hand-edited .blend (`Male_Body.regions.json` guard). Material names ending in `.001` are read without the suffix. Every authored muscle mass is now retired (`RETIRED` in `male_body.py`: adductors, hamstrings, quadriceps-femoris, gastrocnemius), so only painted faces are muscle and anything unpainted is `body`.
3. **Borrowed.** Manifest entries marked `"source": "borrowed"` fill faces nobody claimed, from the old procedural figure. This is a stand-in, and the hands always stay `body`. None are left today; the exporter still supports them.

**Adding a painted muscle:**
1. The user paints, saves the image (Image > Save; Ctrl+S saves only the .blend), then gives the colour and the muscle. Check the colour as stored in the image, since Blender's picker can show a different hex.
2. Add the colour to `Male_Body.paint.json`.
3. Make sure the region id is in `male-body.manifest.json` (drop `"source": "borrowed"` if it was borrowed) and in `js/anatomy-regions.js`.
4. Run `male_body.py`, then the authored build, then `npm test`.
5. Check it in a real browser by selecting the muscle and zooming in on its border.

**Other files:**
- `Male_Body.blend1` is Blender's backup and is git-ignored.
- `refine_male_body.py` and `refine_guard.py` produced the refined sculpture and also refuse to overwrite hand edits.
- `torso-study.*` is retired and kept as reference only.
- `Male_Body_rigged.blend` is the experimental posing baseline: both armpits ripped and pocketed, `ATLAS_Rig` (59 bones) and weights. The app doesn't use it. See `docs/male-body-rig.md`. Rig work happens on scratch copies in `~/Documents/SD-Routine-scratch/`; commit only results and short notes, never study scripts.

## Anatomy rules (from the user)

- **Anatomical accuracy is the basis.** Every clickable area selects the muscle actually under it. Where there's no muscle (bone, tendon, the kneecap, the point of the elbow), nothing is selectable. Decide borders by anatomy, not by what a user might expect to click. Explain surface anatomy that isn't obvious instead of quietly "fixing" it against the anatomy.
- **Keep region ids stable**, and keep group regions where a sculpture shows one mass (the procedural figure's `adductors`). On Male_Body the old authored `adductors`, `hamstrings`, `quadriceps-femoris` and `gastrocnemius` masses are retired (`RETIRED` in `male_body.py`): their muscles are painted one by one, and until they are, the unpainted part is plain body. Every leg muscle that matters for training is now painted, so Male_Body selects all 16 app muscles. The quadriceps coverage test is back on, at 500 cm² a thigh rather than 700, because the painted muscles rightly leave the iliotibial band and the quadriceps tendon out. The procedural figure keeps its `adductors` region (its hamstrings were always separate muscles). The adductor magnus selects Hamstrings: its visible rear part is the "fourth hamstring". Finer sub-regions may sit under them later.
- **The user prefers one muscle, one change.** The agreed order is to fill in the missing muscles first and polish all borders at the end.
- **The serratus anterior selects Shoulders and the iliopsoas Abs** (the user's call, 2026-10-13). The serratus moves the shoulder blade forward and up, trained by presses and push-ups, so not Obliques; the iliopsoas is the hip flexor, trained by leg raises. Painted muscles no program trains stay drawn but not selectable (`null`): the tibialis anterior, extensor digitorum longus, flexor digitorum longus and the lower soleus (`soleus-lower`). Calves is the gastrocnemius and upper soleus only. The zoom plan is in `docs/anatomy-levels.md`.

## Where it's heading

The redesign aims for a calm, monochrome, gallery-like interface with the body as its centrepiece.

Done:
- the foundation theme
- a dedicated anatomy stage
- front/back controls and rotation (PR #33): a ±25° drag orbit, and keyboard focus that turns the body to the muscle
- the Male_Body sculpture painted muscle by muscle and shown by default (2026-10-13); borders are left as painted
- the stage redesign, from Claude Design's *ATLAS Stages v3* (`docs/redesign.md`, one PR per stage). It is one fixed screen. The sculpture sits behind every stage and a perspective camera moves between named shots (`SCULPTURE_SHOTS` in `js/anatomy-sculpture.js`: az, el, aim height, distance, screen position). `js/stages.js` runs each change of stage as out → moving → idle: motion between stages, stillness within. All three stages are done. Classic scripts share one global scope: `tests/globals.test.js` fails if two of them declare the same top-level name

In progress:
- the anatomical cartography (PR #79, `docs/cartography.md`): fine surface traces in the sculpture's material show the pointed and selected training groups, with a serif label beside the body. It is the hover and selection state now. The first version works, but the design is still being polished, so treat its look as unsettled and change it only when asked. It follows the authored borders and adds no anatomy: selectable regions still come only from the mesh and `ANATOMY_REGIONS`. `setDetailMode(true)` on the renderer gives exact anatomical names for the future zoom level and has no page control yet.

Next:
- a side view (90°) and zoom, a side view (90°) and zoom, both added to the same camera (a side view is one more entry in `SCULPTURE_SHOTS`)

**The anatomy architecture is hybrid.** An authored Blender mesh is the visible body. The existing renderer (`js/anatomy-sculpture.js`), picking, region table, `MuscleSelection`, accessibility layer and SVG fallback all stay. The procedural figure stays as the fallback (if the sculpture's file fails to load, or with `?anatomy=procedural`).

**Future plans, not to build yet:**
- zooming into a muscle group reveals finer selectable parts (e.g. the heads of the chest). The cartography's detail mode is the hook for it.

Don't build toward it unprompted, but flag any change that would make it harder. `lab/anatomy-cartography.*` is an untracked experiment, so leave it alone.

## How to work with this user

- **Only start work when explicitly asked.** An answer to a question is information, not a go-ahead. Propose the next step, then stop.
- **Small, restrained prototypes stop at the first version that answers the question.** Report a weak result instead of building more.
- **Agents:** spawn exactly the ones the user lists, and treat a combined line ("Training/Nutrition/Schedule") as one agent. The user asks for `.claude/agents/anatomy-implementation` by name for asset, converter and renderer work.
- **Load the `frontend-design:frontend-design` skill before any visual or UI work.**
- **Git:**
  - feature branches only, with PRs into `main`;
  - commit or push only when asked;
  - the current branch is reported at the start of each session by the same hook, not written here.
