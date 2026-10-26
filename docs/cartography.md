# Anatomical cartography

The sculpture is the body. The cartography is how the body communicates.

Fine, curved traces in the sculpture's own material show which training
groups are pointed at and chosen, with a serif label beside the body. They
follow each authored region's shape and add no anatomy: what can be selected
still comes only from the mesh and `ANATOMY_REGIONS`. The look is still being
designed; change it only when asked.

## What it shows

Neutral ink matches the page; the sculpture itself is marble
(`--sculpt-form`), a shade warmer than the page's cool ground. Lines are engraved: they swell in shadow and thin in the light, so
the traces model the form rather than lie over it.

| State | How it draws |
|---|---|
| **Hover** (Targets) | The whole training group, a little stronger near the pointer, with a visible baseline between accents that travel along it. The surface stays alive while the pointer rests on a muscle. No border, so pointing and choosing never read alike. |
| **Selected** (Targets) | Still, engraved traces and a fine border just inside the group's seams, as a map draws a territory's edge. |
| **Lit** (a program or family pointed at) | The strongest state: darker traces and border, drawn in once along each muscle's length (`SCULPTURE_EASE.reveal`, 0.72 s, a darker head leading), then still. Selected muscles outside it are set aside meanwhile. Reduced motion shows it fully drawn at once. |
| **Family row** (Targets summary) | The family's muscles as a hover (moving traces, no draw-in) in its hue, `--<family>-trace`: a deeper shade of its dot (lighter in the dark theme), easing in and out with the hover. In the light theme `--trace-vivid: 1` keeps tinted lines from darkening as much in shadow, so they hold their colour on the pale sculpture. |
| **Session** (Week plan) | Its training groups as a selected group being hovered: still traces under moving ones, no border (borders are Targets only), no draw-in. Each muscle takes its family's hue, so a mixed session shows its families side by side; colours meet at seams without blending (a blend would need each region's neighbours baked into the model). |
| **Keyboard focus** | A strong focus edge and a still map. |

Also:

- **Scale.** Traces follow the body's size on screen against Targets
  (`traceScale`): a closer camera, as on the Week plan, gets more and
  heavier lines, half each, keeping Targets' balance of line and gap.
- **The pointer's pull.** Moving the pointer bends nearby hovered and
  selected traces toward it, by at most a third of a line and only in the
  direction of the pointer, so lines far from it stay whole. The pull eases
  away when exploration ends. Reduced motion turns it off.
- **The label.** A serif label beside the body names the group (Chest,
  Shoulders), with a fine leader to the surface. It keeps between the body
  and the rails (`SCULPTURE_LABEL_CLEAR`); where there is no room, and on
  narrow layouts, the caption says it instead.
- **Touch** selects directly.
- **When it moves.** Ongoing flow runs only during visible pointer
  exploration on Targets, or while a session is pointed at on the Week
  plan, with normal motion. It pauses when the document is hidden, the
  camera moves, or a program preview is shown. Resting selections are still.

### Overview and detail

The overview responds to every authored region of the pointed training
group; picking still records the exact region under the pointer.
`setDetailMode(true)` on the renderer gives exact anatomical names and a
response limited to that region, for a future zoom level; there is no page
control for it yet, and `setDetailMode(false)` restores the overview.
Selection uses training groups in either mode.

## Anatomical limits

The authored mesh and `ANATOMY_REGIONS` decide what can be selected. The flow
field describes surface shape, **not muscle fibres, new anatomical divisions
or functional relationships**, and it does not make the authored borders any
more accurate.

Traces are worked out in the sculpture's material shader, so they stay on its
visible surface: they cannot float above it, bridge empty space or draw
through the body. The baked seam distance softens their ends near region
borders. Bone, tendon and other regions that can't be selected never take a
muscle's hover or selected map, and a touch on one cannot borrow a nearby
muscle: touch tolerance applies only outside the silhouette.

## How it is built

**Sampling** (`js/anatomy-cartography.js`). `buildAnatomyCartography` takes
deterministic, area-weighted samples of the surface, each on one triangle of
one region. Its random sequence is fixed and part of the output: each sample
still makes two draws for a retired particle's resting point before the two
that place it, and removing them as dead code would move every sample, and so
every curve. `tests/cartography.test.js` pins the samples. The samples are not
drawn and are not kept once the frames and guides below are built.

**Per-region frames.** `buildAnatomyFlowFrames` derives each region's scale,
centre and axis from the samples and the shape axes in
`model.regionAnchors`; a region without usable anchors takes an axis from its
samples. Paired regions share a direction by folding coordinates about the
body's upright plane. In the shader, positions are folded after
interpolation, so triangles across the midline don't kink the abdominal
traces; a rounded angular field keeps curves open where a region's axis nears
the skin (no pinched fans or tiny rings); and narrow regions get fewer traces
in proportion to their width, giving inner thighs and forearms more room.

**Continuous guides.** `buildAnatomyFlowGuides` gives some patches one guide,
so the curves and the pulse don't restart at every small region's border.
`FLOW_GUIDE_GROUPS` is the one list of them:

- shared per side: the forearm, quads, adductors, hamstrings and the upper
  back (infraspinatus, teres major, rhomboid major);
- one guide each: the gluteus maximus, the trapezius (its broad upper field
  blends into a straight lower tail), the lower back, and each lat.

Guides follow the posed sculpture. Paired guides take their direction from
the authored landmarks of each limb or shoulder blade; the pelvic and spinal
mirror planes follow the landmarks' tilt. The lower back runs between the
pelvic and upper-back landmarks (its own axis is the fallback), in rounded
open sweeps with no pole or mirrored join at the spine. Each lat bows along a
direction the torso sets, so unequal painted axes cannot make one side
horizontal and the other diagonal. Depth enters linearly, so curves follow
the surface without turning back on themselves. The chest, shoulders, abs and
obliques keep their per-region fields, as does any region without usable
landmarks. Inset borders inside a shared guide are quieter in the overview and
full weight in detail mode.

How a guide draws is its kind, named in `FLOW_GUIDE_KINDS` (pelvis,
trapezius, scapula, limb, spine, lat) and given to the shader as `KIND_*`
defines, so neither side holds a bare number. `flowGuideSlots()` lays the
groups out in the guide rows in list order, two slots for a paired group
(left, then right); each region gets the code `(start + 1)`, negative for a
paired group, and the shader takes the next slot for the right side.

**Data texture and uniforms.** WebGL2 guarantees only 224 uniform vectors to
a fragment shader (256 to a vertex shader); desktop GPUs offer more, so an
overrun fails only on low-end devices. Uniform arrays sized by the figure used
to spend that budget per region (Male_Body reached 212 of 224 and 212 of 256).
Everything the shaders know per region or per guide is now a row of one
RGBA32F data texture (`SCULPTURE_DATA_ROWS`), one texel per region or guide,
read with `texelFetch`: the state, map and reveal rows every frame (each lit
region draws in on its own, so muscles two programs share stay drawn); the flow fields,
guide frames and hues after a context restore or a theme change
(`uploadData`). The shaders keep 13 vertex and 18 fragment uniform vectors
whatever the figure, so finer zoom sub-regions cost texels; WebGL2 guarantees
textures 2048 wide.

**Region ids.** A vertex carries its region in two bytes (the low one, and the
high one in what was the spare byte), and the pick buffer in two channels (red,
then green), so picking reaches `SCULPTURE_REGION_LIMIT` (65,535) regions; the
data texture's width is the nearer bound.

**The renderer** (`js/anatomy-sculpture.js`) owns the surface shader, the hover
clock, state easing, picking, detail mode, the camera and context
restoration. A lit group's draw-in is a single eased reveal, not the clock, and
restarts only when the lit set changes. `MuscleSelection` is the only source of
selection state. Classic scripts and the SVG fallback remain; no asset export
or build step is needed for any of this.

## Checks

`npm test` covers the cartography with:

| Test | What it holds |
|---|---|
| `tests/cartography.test.js` | the samples (positions pinned, reproducible, never across a border); the shader's early exit; a touch on bone or tendon borrowing no muscle; animations settling; reduced motion |
| `tests/cartography-flow.test.js` | frame validity; each guide's direction; motion gating; the pointer's pull; lit, family and session previews; trace scale |
| `tests/cartography-guides.test.js` | guide slots never collide; each region's code leads to its own group's slots and kind; no kind compared by a bare number in the shader |
| `tests/shader-budget.test.js` | no uniform array sized by the figure; both shaders within the minimum |
| `tests/sculpture-data.test.js` | each value lands on the texel the shaders read |
| `tests/pick-ids.test.js` | region ids past 255, in the vertices and the pick buffer |

In a browser, check both themes; hover over time; the still selected state;
keyboard and reduced motion; Front/Back and the drag; narrow layouts; program
and session previews; context restoration; both fallbacks (`?anatomy=procedural`
and no WebGL). There should be no WebGL errors, and continuous drawing should
stop when pointer exploration ends or the document is hidden.
