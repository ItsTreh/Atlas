# Anatomical cartography

The sculpture is the body. The cartography is how the body communicates.

The WebGL sculpture reveals fine, curved traces within its material. Their
direction follows each authored region's shape, with gentle bending and
tapered accents that travel together while the pointer hovers. Neutral ink
matches the page; the light theme uses the sculpture's original cool grey.

- Hover reveals a whole training group, with a little more emphasis near
  the pointer and a visible baseline between traveling accents. The surface
  stays alive while the pointer rests on a muscle.
- Selected groups retain clear, alternating-weight traces that preserve the
  sculpture's shading. Program previews and workout highlights use the same
  presentation through the existing selection workflow.
- Moving the pointer gently draws nearby hovered and selected traces toward
  it. The response eases away when exploration ends; resting selections stay
  still. Reduced motion disables this deformation.
- A serif label beside the body names the group, such as Chest or Shoulders,
  with a fine leader to the surface. Narrow layouts use the caption instead.
- Keyboard focus has a strong focus edge and a static map. Touch selects
  directly. Reduced motion keeps the traces still and applies state changes
  immediately. Ongoing flow pauses when the document is hidden, the stage is
  inactive, the camera moves, or a program preview is active.

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

`js/anatomy-sculpture.js` owns the surface shader, hover clock, state easing,
picking, presentation mode, camera, and context restoration. It advances the
clock only during visible pointer exploration with normal motion enabled.
Resting selections remain still. `MuscleSelection` is the only source of
selection state. Classic scripts and the SVG fallback remain available;
no asset export or build step is needed.

Run `npm test -- --maxWorkers=3`. Check sampling and frame validity, precise
picking, touch boundaries, overview/detail switching, and motion gating.
Browser validation should cover both themes, hover over time, the stationary
selected state, keyboard and reduced motion, front/back and drag, narrow
layouts, program/session previews, context restoration, and both fallbacks.
Confirm there are no WebGL errors and that continuous drawing stops when
pointer exploration ends or the document becomes hidden.
