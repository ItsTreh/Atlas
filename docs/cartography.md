# Anatomical cartography

The sculpture is the body. The cartography is how the body communicates.

The WebGL sculpture reveals fine, curved traces within its material. Their
direction follows each authored region's shape, with gentle bending and
tapered accents that travel together while the pointer hovers. Neutral ink
matches the page; the light theme uses the sculpture's original cool grey.

- Hover reveals a whole training group, with a little more emphasis near
  the pointer and a visible baseline between traveling accents. The surface
  stays alive while the pointer rests on a muscle.
- Lines are engraved: they swell in shadow and thin in the light, so the
  traces model the form rather than lie over it.
- Selected groups keep still, engraved traces and a fine border just inside
  their seams, as a map draws a territory's edge. Hover alone has no border,
  so pointing and choosing never read alike.
- Lit groups, the muscles a program or family pointed at would work, are
  the strongest state: darker traces and border, drawn in once along each
  muscle's length (about 0.7 s, a darker head leading) and then still.
  While a program or family is pointed at, selected muscles outside it are
  set aside. Reduced motion shows them fully drawn at once.
- Pointing at a family row (Push, Pull, Legs, Core) in the selection
  summary draws its muscles as a hover (the moving traces, no draw-in) in
  the family's hue, `--<family>-trace`: a deeper shade of the family's dot
  colour (lighter in the dark theme) so fine lines hold up on the lit
  sculpture. The hue eases in and out with the hover. In the light theme
  (`--trace-vivid: 1`) tinted lines darken less in shadow and draw a little
  stronger, so they keep their colour on the pale sculpture.
- A session pointed at on the week stage draws its training groups as a
  selected group hovered on Targets: still engraved traces under the moving
  ones, with no border (borders are drawn only on Targets) and no draw-in,
  so it never outlines individual authored regions. Each muscle takes its
  own family's hue, so a mixed session (several dots on its card) shows its
  families side by side. Colours meet at seams without blending; a blend
  would need each region's neighbours baked into the model.
- Traces scale with the body's size on screen against Targets
  (`traceScale`): a closer camera, as on the week stage, gets more and
  heavier lines, half each, keeping Targets' balance of line and gap. Hues
  are per region (`uRegionInk` in the fragment shader, `uMapTint` passed
  from the vertex shader).
- Moving the pointer gently draws nearby hovered and selected traces toward
  it. Only the direction to the pointer bends them, by at most a third of a
  line, so lines far from the pointer stay whole. The response eases away
  when exploration ends; resting selections stay still. Reduced motion
  disables this deformation.
- A serif label beside the body names the group, such as Chest or Shoulders,
  with a fine leader to the surface. Narrow layouts use the caption instead.
- Keyboard focus has a strong focus edge and a static map. Touch selects
  directly. Reduced motion keeps the traces still and applies state changes
  immediately. Ongoing flow pauses when the document is hidden, the camera
  moves, or a program preview is active; off Targets it runs only while a
  session is pointed at.

## Overview and detailed presentation

The overview responds to all authored regions belonging to the pointed
training group. Picking still records the precise region under the pointer.
The renderer's `setDetailMode(true)` method exposes exact anatomical names
and a response limited to that region for a future detailed view. There is
no page control for this mode; `setDetailMode(false)` restores the overview.
Selection uses shared training groups in either mode.

## Anatomical limits

The authored mesh and `ANATOMY_REGIONS` determine selectable anatomy. The
flow field describes surface shape, **not muscle fibres, new anatomical
divisions, or functional relationships**. It does not improve the accuracy
of the authored boundaries.

Traces are evaluated in the sculpture's material shader and therefore stay
on its visible surface. They cannot float above it, bridge empty space, or
draw through the body. The baked seam distance softens their ends near
region boundaries. Bone, tendon, and other nonselectable regions never gain
a muscle's hover or selected map. A touch on such a region cannot borrow a
nearby muscle; touch tolerance applies only outside the silhouette.

## Implementation and checks

`js/anatomy-cartography.js` retains deterministic, area-weighted surface
sampling. `buildAnatomyFlowFrames` uses those samples to derive each region's
scale and centre, together with the shape axes in `model.regionAnchors`.
Regions without valid anchors use an axis estimated from their sample
positions. Paired regions share a direction by folding coordinates around
the body's upright plane. These frames guide the material traces; samples
are not rendered as particles or a separate graph.

The shader folds surface positions after interpolation, so triangles across
the midline do not kink the abdominal traces. A rounded angular field keeps
curves open where a region's axis approaches the skin, avoiding pinched fans
and tiny rings. Narrow regions receive fewer traces in proportion to their
width relative to body height, giving inner thighs and forearms more space.
These adjustments affect the drawn curves, not authored borders or picking.

`buildAnatomyFlowGuides` provides continuous drawing guides for the gluteus
maximus, lower trapezius, upper-back regions, forearms, quads, adductors,
hamstrings, lower back and lats. The pelvic and
spinal mirror planes follow the paired authored landmarks and their tilt.
Each limb and scapular patch gets its own posed direction, shared by its
small anatomical regions so the curves and pulse do not restart at every
border. Linear depth relief lets the curves follow the surface without
reversing around an angular axis. The broad upper-trap field blends into its
narrow lower guide; the chest, shoulders, abs and obliques retain their
existing fields. The central lower back uses one continuous guide aligned
between the pelvic and upper-back landmarks, with its own authored axis as
a fallback. Its rounded, open sweeps cross the spine without an angular
pole or a sharp mirrored join. Each lat uses an open bow in a separate
guide; the torso landmarks align their directions so unequal painted
principal axes do not make one side horizontal and the other diagonal.
Both curved fields retain the existing pulse and pointer response.
Inner thighs have more space between lines. Regions without
suitable landmarks retain their original surface frames. Inset borders
inside shared guides are quieter in overview and retain their full weight
in detail mode. Shader guide capacity comes from the generated guide data.

`js/anatomy-sculpture.js` owns the surface shader, hover clock, state easing,
picking, presentation mode, camera, and context restoration. It advances the
clock only during visible pointer exploration, or while a session is
highlighted, with normal motion enabled.
A lit group's draw-in (program and family previews only) is a single eased reveal (`SCULPTURE_EASE.reveal`),
not the clock; it restarts only when the lit set changes. Resting
selections remain still. `MuscleSelection` is the only source of
selection state. Classic scripts and the SVG fallback remain available;
no asset export or build step is needed.

Run `npm test -- --maxWorkers=3`. Check sampling and frame validity, precise
picking, touch boundaries, overview/detail switching, and motion gating.
Browser validation should cover both themes, hover over time, the stationary
selected state, keyboard and reduced motion, front/back and drag, narrow
layouts, program/session previews, context restoration, and both fallbacks.
Confirm there are no WebGL errors and that continuous drawing stops when
pointer exploration ends or the document becomes hidden.
