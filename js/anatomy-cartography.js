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
  const data = new Float32Array(count * 11), triangles = new Uint32Array(count);
  let seed = 1963, triangle = 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const weights = () => { const u = Math.sqrt(random()), v = random(); return [1 - u, u * (1 - v), u * v]; };
  for (let i = 0; i < count; i++) {
    const at = (i + 0.5) / count * area;
    while (cumulative[triangle] <= at) triangle++;
    const vertices = [index(triangle * 3), index(triangle * 3 + 1), index(triangle * 3 + 2)];
    const rest = weights(), gathered = weights(), offset = i * 11;
    for (let k = 0; k < 3; k++) {
      for (let j = 0; j < 3; j++) {
        data[offset + k] += positions[vertices[j] * 3 + k] * rest[j];
        data[offset + 3 + k] += positions[vertices[j] * 3 + k] * gathered[j];
        data[offset + 6 + k] += normals[vertices[j] * 3 + k] * gathered[j];
      }
    }
    data[offset + 9] = region(vertices[0]);
    data[offset + 10] = random();
    triangles[i] = triangle;
  }
  return { data, triangles, count, stride: 11 };
}

const CARTOGRAPHY_VERTEX = `
layout(location = 0) in vec3 aRest;
layout(location = 1) in vec3 aGathered;
layout(location = 2) in vec3 aNormal;
layout(location = 3) in vec2 aInfo;
uniform mat4 uMatrix;
uniform mat3 uNormal;
uniform vec3 uStates[REGIONS];
uniform vec2 uSize, uPointer;
uniform float uPresence, uPointerActive, uDpr;
out float vAlpha;
out float vNode;

void main() {
  vec3 state = uStates[int(aInfo.x + 0.5)];
  vec4 projected = uMatrix * vec4(aGathered, 1.0);
  vec2 screen = (projected.xy / projected.w * vec2(0.5, -0.5) + 0.5) * uSize;
  float near = 1.0 - smoothstep(12.0, 95.0, distance(screen, uPointer));
  float local = state.y * mix(0.8, near, uPointerActive);
  float engagement = max(max(state.x * 0.57, state.z * 0.7), local);
  float density = max(uPresence * 0.065, engagement);
  float visible = smoothstep(aInfo.y - 0.035, aInfo.y + 0.035, density);
  // A small, finite rearrangement on the original surface as the map resolves.
  vec3 position = mix(aRest, aGathered, engagement);
  gl_Position = uMatrix * vec4(position, 1.0);
  // Bias only depth, not world position; hidden surfaces remain occluded.
  gl_Position.z -= 0.000015 * gl_Position.w;
  float facing = smoothstep(0.05, 0.45, (uNormal * normalize(aNormal)).z);
  vNode = 1.0 - step(0.035, aInfo.y);
  vAlpha = visible * facing * mix(0.4, 0.86, engagement) * min(1.0, uPresence + engagement * 4.0);
  gl_PointSize = mix(1.8, 2.3, engagement) * uDpr + vNode * engagement * 1.8 * uDpr;
}`;

const CARTOGRAPHY_FRAGMENT = `
precision highp float;
uniform vec3 uInk;
in float vAlpha;
in float vNode;
out vec4 outColor;
void main() {
  float radius = length(gl_PointCoord - 0.5) * 2.0;
  float edge = 1.0 - smoothstep(0.65, 1.0, radius);
  float ring = mix(1.0, smoothstep(0.25, 0.55, radius), vNode);
  float alpha = edge * ring * vAlpha;
  if (alpha < 0.01) discard;
  outColor = vec4(uInk, alpha);
}`;
