/* Surface samples for anatomical cartography. Classic script, no DOM or imports.
 *
 * Both ends of a particle's movement are barycentric points on ONE triangle.
 * Gathering cannot cross a painted border, float off the body, or join two
 * unrelated surfaces. Sampling is proportional to area, not mesh density.
 * The map describes the authored anatomy; it does not infer new anatomy.
 */
function buildAnatomyCartography(model, bytes, budget = 14000) {
  const stride = model.vertexBytes, view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const indexStart = model.vertexCount * stride, wide = model.wideIndices;
  const index = i => wide ? view.getUint32(indexStart + i * 4, true) : view.getUint16(indexStart + i * 2, true);
  const positions = new Float32Array(model.vertexCount * 3);
  const normals = new Float32Array(model.vertexCount * 3);
  const region = i => view.getUint8(i * stride + 10);
  for (let i = 0; i < model.vertexCount; i++) {
    for (let k = 0; k < 3; k++) positions[i * 3 + k] = model.bounds.min[k] +
      view.getUint16(i * stride + k * 2, true) / 65535 * (model.bounds.max[k] - model.bounds.min[k]);
    let x = Math.max(-1, view.getInt16(i * stride + 6, true) / 32767);
    let y = Math.max(-1, view.getInt16(i * stride + 8, true) / 32767);
    const z = 1 - Math.abs(x) - Math.abs(y);
    if (z < 0) { const old = x; x = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1); y = (1 - Math.abs(old)) * (y >= 0 ? 1 : -1); }
    const len = Math.hypot(x, y, z) || 1;
    normals.set([x / len, y / len, z / len], i * 3);
  }
  const cumulative = new Float64Array(model.indexCount / 3);
  let area = 0;
  for (let t = 0; t < cumulative.length; t++) {
    const a = index(t * 3), b = index(t * 3 + 1), c = index(t * 3 + 2);
    // Never let a malformed mixed-region triangle manufacture a boundary.
    if (region(a) === region(b) && region(b) === region(c)) {
      const u = [], v = [];
      for (let k = 0; k < 3; k++) { u[k] = positions[b * 3 + k] - positions[a * 3 + k]; v[k] = positions[c * 3 + k] - positions[a * 3 + k]; }
      area += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
    }
    cumulative[t] = area;
  }
  const count = area > 0 ? Math.max(0, Math.min(24000, Math.floor(budget))) : 0;
  const particleStride = 12;
  const data = new Float32Array(count * particleStride), triangles = new Uint32Array(count);
  let seed = 1963, triangle = 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const weights = () => { const u = Math.sqrt(random()), v = random(); return [1 - u, u * (1 - v), u * v]; };
  for (let i = 0; i < count; i++) {
    const at = (i + 0.5) / count * area;
    while (cumulative[triangle] <= at) triangle++;
    const vertices = [index(triangle * 3), index(triangle * 3 + 1), index(triangle * 3 + 2)];
    const rest = weights(), gathered = weights(), offset = i * particleStride;
    for (let k = 0; k < 3; k++) {
      for (let j = 0; j < 3; j++) {
        data[offset + k] += positions[vertices[j] * 3 + k] * rest[j];
        data[offset + 3 + k] += positions[vertices[j] * 3 + k] * gathered[j];
        data[offset + 6 + k] += normals[vertices[j] * 3 + k] * gathered[j];
      }
    }
    // A marker's depth follows its source face. Using only its center depth
    // clips circular points into flecks on sloping surfaces.
    const ab = [0, 1, 2].map(k => positions[vertices[1] * 3 + k] - positions[vertices[0] * 3 + k]);
    const ac = [0, 1, 2].map(k => positions[vertices[2] * 3 + k] - positions[vertices[0] * 3 + k]);
    const normal = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const alignment = normal.reduce((sum, v, k) => sum + v * data[offset + 6 + k], 0) < 0 ? -1 : 1;
    const normalLength = Math.hypot(...normal);
    for (let k = 0; k < 3; k++) data[offset + 6 + k] = normal[k] / normalLength * alignment;
    data[offset + 9] = region(vertices[0]);
    data[offset + 10] = 2; // suppressed until admitted to a spaced level below
    for (let j = 0; j < 3; j++) data[offset + 11] +=
      view.getUint8(vertices[j] * stride + 12) / 255 * (model.seamMax || 3) * gathered[j];
    // Movement is a small surface adjustment, not a jump across a large face.
    const length = Math.hypot(...[0, 1, 2].map(k => data[offset + k] - data[offset + 3 + k]));
    const movement = Math.min(1, Math.sqrt(area / Math.max(count, 1)) * 0.18 / (length || 1));
    for (let k = 0; k < 3; k++) data[offset + k] = data[offset + 3 + k] +
      (data[offset + k] - data[offset + 3 + k]) * movement;
    triangles[i] = triangle;
  }
  // Nested blue-noise levels: coarse landmarks, selected field, close detail.
  // A random opacity threshold alone made the surface look like visual noise.
  // Every finer level retains the coarser one and enforces a minimum distance.
  const order = Uint32Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const spacing = Math.sqrt(area / Math.max(count, 1));
  const radii = [4.4, 2.2, 1.1].map(factor => spacing * factor);
  radii.forEach((radius, level) => {
    const grid = new Map(), key = (x, y, z) => x + "," + y + "," + z;
    const cell = i => [0, 1, 2].map(k => Math.floor(data[i * particleStride + 3 + k] / radius));
    const insert = i => {
      const name = key(...cell(i));
      const bucket = grid.get(name);
      if (bucket) bucket.push(i); else grid.set(name, [i]);
    };
    for (const i of order) if (data[i * particleStride + 10] < 1) insert(i);
    for (const i of order) {
      const offset = i * particleStride;
      if (data[offset + 10] < 1) continue;
      const [x, y, z] = cell(i);
      let clear = true;
      for (let dx = -1; dx <= 1 && clear; dx++)
        for (let dy = -1; dy <= 1 && clear; dy++)
          for (let dz = -1; dz <= 1 && clear; dz++)
            for (const j of grid.get(key(x + dx, y + dy, z + dz)) || []) {
              const other = j * particleStride;
              const d2 = [0, 1, 2].reduce((sum, k) => sum +
                (data[offset + 3 + k] - data[other + 3 + k]) ** 2, 0);
              if (d2 < radius * radius) { clear = false; break; }
            }
      if (clear) {
        data[offset + 10] = [0.015, 0.2, 0.56][level] + random() * [0.02, 0.08, 0.22][level];
        insert(i);
      }
    }
  });
  return { data, triangles, count, stride: particleStride, radii, positions };
}

/* Bilateral surface frames for the flowing material. Coordinates fold around
 * the body's upright axis, so paired regions share a coherent direction. The
 * authored principal axes describe shape, not inferred muscle fibres.
 */
function buildAnatomyFlowFrames(model, samples) {
  const count = model.regions.length, centers = new Float32Array(count * 4), axes = new Float32Array(count * 4);
  const midX = (model.bounds.min[0] + model.bounds.max[0]) * 0.5;
  const minimum = Math.max(1e-4, (model.bounds.max[1] - model.bounds.min[1]) * 0.002);
  const sums = Array.from({ length: count }, () => ({ n: 0, p: [0, 0, 0], normal: [0, 0, 0], covariance: new Float64Array(9) }));
  const pointAt = offset => [Math.abs(samples.data[offset + 3] - midX), samples.data[offset + 4], samples.data[offset + 5]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = (v, fallback = [0, 1, 0]) => {
    const length = Math.hypot(...v);
    return length > 1e-8 && Number.isFinite(length) ? v.map(x => x / length) : [...fallback];
  };
  const valid = v => v && v.length === 3 && v.every(Number.isFinite);
  for (let i = 0; i < samples.count; i++) {
    const offset = i * samples.stride, sum = sums[samples.data[offset + 9]];
    if (!sum) continue;
    const p = pointAt(offset);
    if (!valid(p)) continue;
    sum.n++;
    const sign = samples.data[offset + 3] < midX ? -1 : 1;
    for (let k = 0; k < 3; k++) {
      sum.p[k] += p[k];
      sum.normal[k] += samples.data[offset + 6 + k] * (k === 0 ? sign : 1);
    }
  }
  const means = sums.map(sum => sum.n ? sum.p.map(x => x / sum.n) :
    [0, (model.bounds.min[1] + model.bounds.max[1]) * 0.5, (model.bounds.min[2] + model.bounds.max[2]) * 0.5]);
  for (let i = 0; i < samples.count; i++) {
    const offset = i * samples.stride, r = samples.data[offset + 9], sum = sums[r];
    if (!sum) continue;
    const p = pointAt(offset).map((x, k) => x - means[r][k]);
    if (!valid(p)) continue;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) sum.covariance[a * 3 + b] += p[a] * p[b];
  }
  for (let r = 0; r < count; r++) {
    const sum = sums[r], covariance = sum.covariance;
    let center = [...means[r]], axis = null;
    const anchors = model.regionAnchors && model.regionAnchors[model.regions[r]];
    if (anchors) {
      let weight = 0;
      const averagedAxis = [0, 0, 0], averagedCenter = [0, 0, 0];
      let reference = null;
      for (const [side, anchor] of Object.entries(anchors)) {
        if (!anchor || !valid(anchor.centroid) || !valid(anchor.axis) || !(anchor.area > 0) || !Number.isFinite(anchor.area)) continue;
        const sign = anchor.centroid[0] < midX ? -1 : 1;
        const foldedAxis = unit([anchor.axis[0] * sign, anchor.axis[1], anchor.axis[2]]);
        if (!reference) reference = foldedAxis;
        const alignment = dot(reference, foldedAxis) < 0 ? -1 : 1;
        const foldedCenter = side === "centre" && sum.n ? means[r] :
          [Math.abs(anchor.centroid[0] - midX), anchor.centroid[1], anchor.centroid[2]];
        for (let k = 0; k < 3; k++) {
          averagedAxis[k] += foldedAxis[k] * anchor.area * alignment;
          averagedCenter[k] += foldedCenter[k] * anchor.area;
        }
        weight += anchor.area;
      }
      if (weight) { axis = unit(averagedAxis); center = averagedCenter.map(x => x / weight); }
    }
    if (!axis) {
      let major = 0;
      for (let k = 1; k < 3; k++) if (covariance[k * 3 + k] > covariance[major * 3 + major]) major = k;
      axis = [0, 0, 0]; axis[major] = 1;
      for (let iteration = 0; iteration < 16; iteration++) axis = unit([0, 1, 2].map(a =>
        covariance[a * 3] * axis[0] + covariance[a * 3 + 1] * axis[1] + covariance[a * 3 + 2] * axis[2]), axis);
    }
    let major = 0;
    for (let k = 1; k < 3; k++) if (Math.abs(axis[k]) > Math.abs(axis[major])) major = k;
    if (axis[major] < 0) axis = axis.map(x => -x);
    const longitudinalVariance = axis.reduce((total, a, i) => total + axis.reduce((s, b, j) =>
      s + a * covariance[i * 3 + j] * b, 0), 0) / Math.max(1, sum.n);
    const variance = (covariance[0] + covariance[4] + covariance[8]) / Math.max(1, sum.n);
    const radius = Math.max(minimum, Math.sqrt(Math.max(0, variance - longitudinalVariance)));
    const length = Math.max(minimum, Math.sqrt(Math.max(0, longitudinalVariance)) * 2);
    // A surface centroid lies on the shell. Move the angular origin inward,
    // perpendicular to the longitudinal axis, to avoid a visible atan vortex.
    const projection = dot(sum.normal, axis);
    const outward = sum.normal.map((x, k) => (x - axis[k] * projection) / Math.max(1, sum.n));
    if (Math.hypot(...outward) > 0.05) {
      const normal = unit(outward);
      center = center.map((x, k) => x - normal[k] * radius);
    }
    centers.set([...center, radius], r * 4);
    axes.set([...axis, length], r * 4);
  }
  return { centers, axes };
}

/* Continuous guides for patches where wrapping each anatomical region creates
 * an extra fold or changes direction at every border. These describe drawing
 * direction only; region IDs, seams and picking still come from the mesh.
 * Six guides: pelvis, lower traps, left/right scapula, left/right forearm.
 */
function buildAnatomyFlowGuides(model, samples) {
  const regions = new Float32Array(model.regions.length);
  const origins = new Float32Array(24), across = new Float32Array(24), along = new Float32Array(24);
  const height = Math.max(1e-4, model.bounds.max[1] - model.bounds.min[1]);
  const midX = (model.bounds.min[0] + model.bounds.max[0]) * 0.5;
  const dot = (a, b) => a.reduce((sum, x, k) => sum + x * b[k], 0);
  const valid = v => v && v.length === 3 && v.every(Number.isFinite);
  const unit = (a, fallback = [0, 1, 0]) => {
    const length = Math.hypot(...a);
    return length > 1e-6 ? a.map(x => x / length) : [...fallback];
  };
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const groups = [
    { names: ['gluteus-maximus'], start: 0, kind: 1, spacing: 0.016, paired: false },
    { names: ['trapezius'], start: 1, kind: 2, spacing: 0.014, paired: false },
    { names: ['infraspinatus', 'teres-major', 'rhomboid-major'], start: 2, kind: 3, spacing: 0.014, paired: true },
    { names: ['brachioradialis', 'extensor-carpi-radialis-longus', 'extensor-carpi-radialis-brevis',
      'pronator-teres', 'flexor-carpi-radialis', 'palmaris-longus', 'flexor-digitorum-superficialis',
      'flexor-carpi-ulnaris', 'extensor-carpi-ulnaris', 'extensor-digiti-minimi', 'extensor-digitorum',
      'abductor-pollicis-longus', 'extensor-pollicis-brevis', 'anconeus', 'forearm-flexors', 'forearm-extensors'],
      start: 4, kind: 4, spacing: 0.01, paired: true }
  ];
  for (const group of groups) {
    const ids = model.regions.map((name, i) => group.names.includes(name) ? i : -1).filter(i => i >= 0);
    const anchors = [[], []];
    for (const id of ids) {
      const entry = model.regionAnchors && model.regionAnchors[model.regions[id]];
      for (const [side, at] of Object.entries(entry || {})) {
        if (!['left', 'right'].includes(side) || !at || !(at.area > 0) || !Number.isFinite(at.area) ||
            !valid(at.centroid) || !valid(at.axis)) continue;
        anchors[side === 'left' ? 0 : 1].push(at);
      }
    }
    // Models without bilateral authored landmarks retain their surface frames.
    if (anchors.some(side => !side.length)) continue;
    const means = anchors.map(side => {
      const area = side.reduce((n, at) => n + at.area, 0);
      return [0, 1, 2].map(k => side.reduce((n, at) => n + at.centroid[k] * at.area, 0) / area);
    });
    const midpoint = means[0].map((x, k) => (x + means[1][k]) * 0.5);
    const lateral = unit(means[0].map((x, k) => x - means[1][k]), [1, 0, 0]);
    const points = [[], []];
    for (let i = 0; i < samples.count; i++) {
      const offset = i * samples.stride;
      if (!ids.includes(samples.data[offset + 9])) continue;
      const p = [0, 1, 2].map(k => samples.data[offset + 3 + k]);
      const side = dot(p.map((x, k) => x - midpoint[k]), lateral) >= 0 ? 0 : 1;
      points[side].push(p);
    }
    for (let side = 0; side < (group.paired ? 2 : 1); side++) {
      const index = group.start + side;
      const origin = group.paired ? means[side] : midpoint;
      let direction;
      if (group.paired) {
        // A common longitudinal axis for the whole patch, keeping each posed
        // arm independent. Align principal-axis signs before averaging.
        direction = unit([0, 1, 2].map(k => anchors[side].reduce((sum, at) =>
          sum + at.axis[k] * (at.axis[1] < 0 ? -1 : 1) * at.area, 0)));
      } else {
        direction = unit([0, 1, 0].map((x, k) => x - lateral[k] * lateral[1]));
      }
      const transverse = group.paired ? unit(cross(direction, [0, 0, side === 0 ? 1 : -1]), lateral) : lateral;
      const patch = group.paired ? points[side] : points.flat();
      const variance = patch.reduce((sum, p) => sum + dot(p.map((x,k) => x - origin[k]), direction) ** 2, 0) / Math.max(1, patch.length);
      origins.set([origin[0] - midX, origin[1], origin[2], group.kind], index * 4);
      across.set([...transverse, height * group.spacing], index * 4);
      along.set([...direction, Math.max(height * 0.02, 2 * Math.sqrt(variance))], index * 4);
    }
    for (const id of ids) regions[id] = (group.start + 1) * (group.paired ? -1 : 1);
  }
  return { regions, origins, across, along };
}
