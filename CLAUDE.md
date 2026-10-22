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

**Every region is painted.** The user paints in Blender's Texture Paint into `Male_Body.paint.png` (on the UV map `Paint`; the model's own `UVMap` is unused), one colour per region, and `Male_Body.paint.json` maps each hex colour to a region id. Several colours may map to one region, so a touch-up in another shade must be keyed. Faces no paint names are `body`. At export, `male_body.py` reads borders straight from the image and cuts the mesh along them, so a border runs where the brush went (details in its docstring). It stops with an error if the image or the UV map is missing.

The regions painted so far are listed at the start of each session by a SessionStart hook (`tools/claude/session-context.sh`, which reads `Male_Body.paint.json`), so they're never written down here.

**Adding a painted muscle:**
1. The user paints, saves the image (Image > Save; Ctrl+S saves only the .blend), then gives the colour and the muscle. Check the colour as stored in the image, since Blender's picker can show a different hex.
2. Add the colour to `Male_Body.paint.json`.
3. Make sure the region id is in `male-body.manifest.json` and in `js/anatomy-regions.js`.
4. Run `male_body.py`, then the authored build, then `npm test`.
5. Check it in a real browser by selecting the muscle and zooming in on its border.

**Other files:**
- `Male_Body.blend1` is Blender's backup and is git-ignored.
- `Male_Body_rigged.blend` is the newest model, the posing baseline being prepared for animation: both armpits repaired, `ATLAS_Rig` (59 bones) and weights. The app doesn't use it yet. See `docs/male-body-rig.md`. Rig work happens on scratch copies in `~/Documents/SD-Routine-scratch/`; commit only results and short notes, never study scripts.

## Anatomy rules (from the user)

- **Anatomical accuracy is the basis.** Every clickable area selects the muscle actually under it. Where there's no muscle (bone, tendon, the kneecap, the point of the elbow), nothing is selectable. Decide borders by anatomy, not by what a user might expect to click. Explain surface anatomy that isn't obvious instead of quietly "fixing" it against the anatomy.
- **Keep region ids stable**, and keep group regions where a sculpture shows one mass (the procedural figure's `adductors`). Male_Body paints its muscles one by one and selects all 16 app muscles. The adductor magnus selects Hamstrings: its visible rear part is the "fourth hamstring". Finer sub-regions may sit under them later.
- **The user prefers one muscle, one change.** Every muscle is painted; polishing the borders is what's left, still one muscle at a time.
- **The serratus anterior selects Shoulders and the iliopsoas Abs** (the user's call, 2026-10-13). The serratus moves the shoulder blade forward and up, trained by presses and push-ups, so not Obliques; the iliopsoas is the hip flexor, trained by leg raises. Painted muscles no program trains stay drawn but not selectable (`null`): the tibialis anterior, extensor digitorum longus, flexor digitorum longus and the lower soleus (`soleus-lower`). Calves is the gastrocnemius and upper soleus only. The zoom plan is in `docs/anatomy-levels.md`.

## Where it's heading

The redesign aims for a calm, monochrome, gallery-like interface with the body as its centrepiece.

Done: the theme, the three-stage redesign (`docs/redesign.md`) and the Male_Body sculpture, painted and shown by default. It is one fixed screen. The sculpture sits behind every stage and a perspective camera moves between named shots (`SCULPTURE_SHOTS` in `js/anatomy-sculpture.js`), with Front/Back and a ±25° drag orbit on Targets. `js/stages.js` runs each change of stage as out → moving → idle: motion between stages, stillness within. Classic scripts share one global scope: `tests/globals.test.js` fails if two of them declare the same top-level name.

In progress:
- the anatomical cartography (`docs/cartography.md`): fine surface traces in the sculpture's material show the pointed and selected training groups, with a serif label beside the body. It is the hover and selection state now. The first version works, but the design is still being polished, so treat its look as unsettled and change it only when asked. It follows the painted borders and adds no anatomy: selectable regions still come only from the mesh and `ANATOMY_REGIONS`. `setDetailMode(true)` on the renderer gives exact anatomical names for the future zoom level and has no page control yet.

Next:
- a side view (90°) and zoom, both added to the same camera (a side view is one more entry in `SCULPTURE_SHOTS`)

**The anatomy architecture is hybrid.** An authored Blender mesh is the visible body. The existing renderer (`js/anatomy-sculpture.js`), picking, region table, `MuscleSelection`, accessibility layer and SVG fallback all stay. The procedural figure stays as the fallback (if the sculpture's file fails to load, or with `?anatomy=procedural`).

**Future plans, not to build yet:**
- zooming into a muscle group reveals finer selectable parts (e.g. the heads of the chest). The cartography's detail mode is the hook for it.

Don't build toward it unprompted, but flag any change that would make it harder.

## How to work with this user

- **Only start work when explicitly asked.** An answer to a question is information, not a go-ahead. Propose the next step, then stop.
- **Small, restrained prototypes stop at the first version that answers the question.** Report a weak result instead of building more.
- **Keep the repo lean.** Delete what nothing uses (pages, scripts, assets, code, docs) rather than keeping it "for reference"; git history keeps it. Don't spend agent time reviewing or fixing something the app doesn't use: flag it for deletion instead.
- **Agents:** spawn exactly the ones the user lists, and treat a combined line ("Training/Nutrition/Schedule") as one agent. The user asks for `.claude/agents/anatomy-implementation` by name for asset, converter and renderer work. Sweeps (lanes, review against fix mode, file ownership, browser setup, report format) follow `docs/agents.md`.
- **Load the `frontend-design:frontend-design` skill before any visual or UI work.**
- **Git:**
  - feature branches only, with PRs into `main`;
  - commit or push only when asked;
  - the current branch is reported at the start of each session by the same hook, not written here.
