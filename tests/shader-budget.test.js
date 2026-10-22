/* The sculpture's shaders must compile on every WebGL2 device, not only on
   the development machine. WebGL2 guarantees 256 uniform vectors to a vertex
   shader and 224 to a fragment shader; many desktop GPUs offer far more, so a
   shader past the minimum still runs here and fails only on low-end phones.

   Each uniform is counted the worst way: one vector per float, vec or array
   element, N per matN. Drivers may pack small uniforms tighter, never looser.

   Nothing the shaders know per region or per flow guide is a uniform: it is
   a row of the data texture (SCULPTURE_DATA_ROWS), so finer sub-regions
   (docs/anatomy-levels.md) cost texels, not uniform vectors. The counter
   knows no array sizes, so a uniform array sized by the figure fails here.
   The texture's own bill is its width: one texel per region or guide, and
   WebGL2 guarantees textures 2048 wide. */
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp({ extra: ["js/anatomy-model-male-body.js", "js/anatomy-sculpture.js"],
  exports: ["ANATOMY_MODEL_MALE_BODY", "buildAnatomyFlowGuides",
            "SCULPTURE_VERTEX", "SCULPTURE_FRAGMENT", "SCULPTURE_PICK", "SCULPTURE_DATA_ROWS"] });

const MIN_VERTEX = 256, MIN_FRAGMENT = 224, MIN_TEXTURE_SIZE = 2048;
const ROWS = { float: 1, int: 1, bool: 1, vec2: 1, vec3: 1, vec4: 1, ivec2: 1, ivec3: 1, ivec4: 1,
               mat2: 2, mat3: 3, mat4: 4, sampler2D: 1 };

function uniformVectors(source, sizes = {}) {
  let total = 0;
  for (const line of source.replace(/\/\/.*$/gm, "").split("\n")) {
    const m = line.trim().match(/^uniform\s+(?:(?:lowp|mediump|highp)\s+)?(\w+)\s+([^;]+);/);
    if (!m) continue;
    if (!(m[1] in ROWS)) throw new Error("unknown uniform type " + m[1]);
    for (const name of m[2].split(",")) {
      const size = name.match(/\[(\w+)\]/);
      const count = size ? (sizes[size[1]] ?? Number(size[1])) : 1;
      if (!Number.isInteger(count)) throw new Error("unknown array size " + size[1]);
      total += ROWS[m[1]] * count;
    }
  }
  return total;
}

describe("sculpture shader uniform budget", () => {
  test("the vertex shader fits WebGL2's minimum, whatever the figure", () => {
    expect(uniformVectors(app.SCULPTURE_VERTEX)).toBeLessThanOrEqual(MIN_VERTEX);
  });

  test("the surface and pick fragment shaders fit WebGL2's minimum, whatever the figure", () => {
    expect(uniformVectors(app.SCULPTURE_FRAGMENT)).toBeLessThanOrEqual(MIN_FRAGMENT);
    expect(uniformVectors(app.SCULPTURE_PICK)).toBeLessThanOrEqual(MIN_FRAGMENT);
  });

  const empty = { count: 0, stride: 12, data: new Float32Array(0) };
  for (const [label, model] of [["Male_Body", app.ANATOMY_MODEL_MALE_BODY], ["procedural", app.ANATOMY_MODEL]]) {
    test(`${label}: the data texture fits WebGL2's minimum texture size`, () => {
      const guides = app.buildAnatomyFlowGuides(model, empty).origins.length / 4;
      expect(Math.max(model.regions.length, guides)).toBeLessThanOrEqual(MIN_TEXTURE_SIZE);
      expect(Object.keys(app.SCULPTURE_DATA_ROWS).length).toBeLessThanOrEqual(MIN_TEXTURE_SIZE);
    });
  }

  test("the counter sees every uniform", () => {
    expect(uniformVectors("uniform vec4 a[N], b;\nuniform mat3 c; // uniform vec4 d;", { N: 3 })).toBe(7);
    expect(uniformVectors("uniform highp sampler2D uData;")).toBe(1);
    expect(() => uniformVectors("uniform vec4 uFlowCenters[REGIONS];")).toThrow(/unknown array size/);
  });
});
