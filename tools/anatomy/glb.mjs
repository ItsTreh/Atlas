/* ===========================================================================
   A small reader for binary glTF (.glb), enough for the authored anatomy:
   the JSON, its buffer, accessors as typed arrays, and each node's world
   matrix. No dependencies; see the glTF 2.0 specification, §4.4 (GLB) and
   §5.1 (accessors).
   ========================================================================= */

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const TYPES = {
  5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array,
  5125: Uint32Array, 5126: Float32Array
};

/** Splits a .glb into its JSON and binary chunks. */
export function readGlb(buffer) {
  const data = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (data.getUint32(0, true) !== 0x46546c67) throw new Error("not a .glb file (bad magic)");
  if (data.getUint32(4, true) !== 2) throw new Error("only glTF 2.0 .glb files are supported");
  let offset = 12, json = null, bin = null;
  while (offset < data.byteLength) {
    const length = data.getUint32(offset, true), type = data.getUint32(offset + 4, true);
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
    else if (type === 0x004e4942) bin = chunk;
    offset += 8 + length;
  }
  if (!json) throw new Error(".glb has no JSON chunk");
  return { json, bin };
}

/** An accessor's elements as a flat typed array (a copy, stride removed). */
export function readAccessor({ json, bin }, index) {
  const acc = json.accessors[index];
  const Type = TYPES[acc.componentType];
  const n = COMPONENTS[acc.type];
  if (!Type || !n) throw new Error("unsupported accessor " + index);
  const out = new Type(acc.count * n);
  const size = Type.BYTES_PER_ELEMENT;
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const GET = { 5120: "getInt8", 5121: "getUint8", 5122: "getInt16", 5123: "getUint16",
                5125: "getUint32", 5126: "getFloat32" };
  const get = GET[acc.componentType];
  if (acc.bufferView !== undefined) {                           // else: zeros, before any sparse values
    const view = json.bufferViews[acc.bufferView];
    const stride = view.byteStride || n * size;
    const base = (view.byteOffset || 0) + (acc.byteOffset || 0);
    for (let i = 0; i < acc.count; i++)
      for (let k = 0; k < n; k++) out[i * n + k] = dv[get](base + i * stride + k * size, true);
  }
  if (acc.sparse) {
    // A sparse accessor (glTF §3.6.2.3) replaces `count` elements of the base: exporters use it
    // for morph targets that are zero almost everywhere.
    const { count, indices, values } = acc.sparse;
    const iv = json.bufferViews[indices.bufferView], vv = json.bufferViews[values.bufferView];
    const iget = GET[indices.componentType], isize = { 5121: 1, 5123: 2, 5125: 4 }[indices.componentType];
    const ib = (iv.byteOffset || 0) + (indices.byteOffset || 0), vb = (vv.byteOffset || 0) + (values.byteOffset || 0);
    for (let j = 0; j < count; j++) {
      const i = dv[iget](ib + j * isize, true);
      for (let k = 0; k < n; k++) out[i * n + k] = dv[get](vb + (j * n + k) * size, true);
    }
  }
  if (acc.normalized && Type !== Float32Array) {
    const max = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[acc.componentType];
    return Float32Array.from(out, v => Math.max(v / max, -1));
  }
  return out;
}

/** Column-major 4x4 world matrix of every node. */
export function worldMatrices(json) {
  const nodes = json.nodes || [], out = new Array(nodes.length).fill(null);
  const local = node => {
    if (node.matrix) return Float64Array.from(node.matrix);
    const [tx, ty, tz] = node.translation || [0, 0, 0];
    const [qx, qy, qz, qw] = node.rotation || [0, 0, 0, 1];
    const [sx, sy, sz] = node.scale || [1, 1, 1];
    const xx = qx * qx, yy = qy * qy, zz = qz * qz, xy = qx * qy, xz = qx * qz, yz = qy * qz,
          wx = qw * qx, wy = qw * qy, wz = qw * qz;
    return Float64Array.from([
      (1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
      2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
      2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
      tx, ty, tz, 1
    ]);
  };
  const multiply = (a, b) => {
    const r = new Float64Array(16);
    for (let c = 0; c < 4; c++)
      for (let rr = 0; rr < 4; rr++)
        r[c * 4 + rr] = a[rr] * b[c * 4] + a[4 + rr] * b[c * 4 + 1] + a[8 + rr] * b[c * 4 + 2] + a[12 + rr] * b[c * 4 + 3];
    return r;
  };
  const visit = (i, parent) => {
    out[i] = parent ? multiply(parent, local(nodes[i])) : local(nodes[i]);
    for (const c of nodes[i].children || []) visit(c, out[i]);
  };
  const roots = new Set(nodes.map((_, i) => i));
  nodes.forEach(n => (n.children || []).forEach(c => roots.delete(c)));
  for (const r of roots) visit(r, null);
  return out;
}

/** Applies a column-major matrix to a point (w = 1) or a direction (w = 0). */
export function transform(m, x, y, z, w = 1) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12] * w,
          m[1] * x + m[5] * y + m[9] * z + m[13] * w,
          m[2] * x + m[6] * y + m[10] * z + m[14] * w];
}
