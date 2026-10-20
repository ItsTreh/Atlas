# Anatomical cartography — first version

The sculpture is the body. The cartography is how the body communicates.

The default WebGL sculpture now uses surface points and fine contours for
hover, selection, program previews, and workout highlights. The stone keeps
its modelling instead of becoming a filled selection patch.

- Exploring the body reveals a sparse field. Near the pointed muscle, more
  points resolve and rearrange on the surface. Motion settles when the
  pointer stops; there is no continuously running particle simulation.
- Selected training groups retain a quieter, denser map and border contours.
- The caption identifies the authored anatomical region and the training
  group it selects. Multiple regions can still select one group.
- Keyboard focus exposes the same map with a strong focus edge. Touch
  selects directly. Reduced motion shows state changes immediately.
- Program previews and session highlights use the map in the existing
  workflow. The SVG fallback remains available without WebGL2.

## Anatomical limits

The authored mesh and `ANATOMY_REGIONS` remain the source of truth. This
version changes how selection is presented, not where muscle boundaries
are authored. Geometry alone cannot reliably identify a more accurate
anatomical division. No new divisions or functional relationships are inferred.

Contours are offsets from the authored border, using the existing baked
seam-distance field. They are cartographic guides, **not additional muscles
or muscle fibres**. The paths fade before that field's stored distance limit.

Each particle has two area-sampled barycentric positions on the same mesh
triangle. Interpolating between them keeps it on that triangle and inside
the same region; particles never fly through the body or migrate across
regions. Density also increases locally near the pointer. These are modest
surface rearrangements, not long-distance attraction between muscles.

Depth testing hides points on rear surfaces. Bone, tendon, and other
nonselectable regions can carry the faint exploratory field but never gain
a selectable muscle's dense map. A touch directly on such a region cannot
borrow a nearby muscle; touch tolerance applies only outside the silhouette.

## Implementation and checks

`js/anatomy-cartography.js` creates a deterministic, area-weighted sample
of 14,000 points (bounded to 24,000) and supplies the point shaders.
`js/anatomy-sculpture.js` owns the GPU resources, finite easing, picking,
contours, camera, and context restoration. `MuscleSelection` remains the
only source of selection state. No asset export or build step is needed.

Run `npm test -- --maxWorkers=3`. The cartography tests cover area weighting,
both index formats, movement staying inside source triangles, region
integrity, reproducibility, degenerate geometry, animation settling,
reduced motion, and touch boundaries.

Browser validation should cover both themes, pointer movement within and
between regions, click-to-toggle, keyboard selection, front/back and drag,
touch, program/session previews, context restoration, and the procedural
and SVG fallbacks. Check that the sculpture renders with no WebGL errors
and stops requesting frames once interaction settles.
