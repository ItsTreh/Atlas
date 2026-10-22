/* The sculpture's shaders must compile on every WebGL2 device, not only on
   the development machine. WebGL2 guarantees 256 uniform vectors to a vertex
   shader and 224 to a fragment shader; many desktop GPUs offer far more, so a
   shader past the minimum still runs here and fails only on low-end phones.

   Each uniform is counted the worst way: one vector per float, vec or array
   element, N per matN. Drivers may pack small uniforms tighter, never looser.
   Per-region arrays cost one vector per region each, so this test is also the
   bill for any future sub-regions (docs/anatomy-levels.md). */
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp({ extra: ["js/anatomy-model-male-body.js", "js/anatomy-sculpture.js"],
  exports: ["ANATOMY_MODEL_MALE_BODY", "buildAnatomyFlowGuides",
            "SCULPTURE_VERTEX", "SCULPTURE_FRAGMENT", "SCULPTURE_PICK"] });

const MIN_VERTEX = 256, MIN_FRAGMENT = 224;
const ROWS = { float: 1, int: 1, bool: 1, vec2: 1, vec3: 1, vec4: 1, ivec2: 1, ivec3: 1, ivec4: 1,
               mat2: 2, mat3: 3, mat4: 4, sampler2D: 1 };

function uniformVectors(source, sizes) {
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
  const empty = { count: 0, stride: 12, data: new Float32Array(0) };
  for (const [label, model] of [["Male_Body", app.ANATOMY_MODEL_MALE_BODY], ["procedural", app.ANATOMY_MODEL]]) {
    const sizes = { REGIONS: model.regions.length,
                    GUIDES: app.buildAnatomyFlowGuides(model, empty).origins.length / 4 };

    test(`${label}: the vertex shader fits WebGL2's minimum`, () => {
      expect(uniformVectors(app.SCULPTURE_VERTEX, sizes)).toBeLessThanOrEqual(MIN_VERTEX);
    });

    test(`${label}: the surface and pick fragment shaders fit WebGL2's minimum`, () => {
      expect(uniformVectors(app.SCULPTURE_FRAGMENT, sizes)).toBeLessThanOrEqual(MIN_FRAGMENT);
      expect(uniformVectors(app.SCULPTURE_PICK, sizes)).toBeLessThanOrEqual(MIN_FRAGMENT);
    });
  }

  test("the counter sees every uniform", () => {
    expect(uniformVectors("uniform vec4 a[N], b;\nuniform mat3 c; // uniform vec4 d;", { N: 3 })).toBe(7);
  });
});
