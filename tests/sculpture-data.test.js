/* The sculpture's per-region and per-guide data travels in a float texture
   (SCULPTURE_DATA_ROWS), read in the shaders with texelFetch by index and
   row. These tests hold the two ends together: every value lands on the
   texel the shaders read for its region or guide, the rows the shaders name
   are the rows the renderer writes, and only what changes is sent each frame. */
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp({ extra: ["js/anatomy-sculpture.js"], exports: [
  "AnatomySculpture", "SCULPTURE_DATA_ROWS", "SCULPTURE_DATA_FRAME_ROWS", "sculptureDataDefines",
  "writeSculptureData", "SCULPTURE_VERTEX", "SCULPTURE_FRAGMENT", "SCULPTURE_PICK"] });
const ROWS = app.SCULPTURE_DATA_ROWS;

describe("data rows", () => {
  test("are numbered 0 … n−1, with the per-frame rows first", () => {
    const rows = Object.values(ROWS).sort((a, b) => a - b);
    expect(rows).toEqual(rows.map((_, i) => i));
    expect([ROWS.state, ROWS.map].sort()).toEqual([0, 1]);
    expect(app.SCULPTURE_DATA_FRAME_ROWS).toBe(2);
  });

  test("the shaders read exactly the rows the renderer defines", () => {
    const defined = new Map(app.sculptureDataDefines().trim().split("\n")
      .map(line => line.match(/^#define (ROW_\w+) (\d+)$/)).map(m => [m[1], Number(m[2])]));
    expect(defined.get("ROW_GUIDE_ORIGIN")).toBe(ROWS.guideOrigin);
    const used = new Set([app.SCULPTURE_VERTEX, app.SCULPTURE_FRAGMENT, app.SCULPTURE_PICK]
      .flatMap(src => src.match(/\bROW_\w+/g) || []));
    expect([...used].sort()).toEqual([...defined.keys()].sort());
  });
});

describe("writeSculptureData", () => {
  test("puts item i at texel i of its row, from the given component on", () => {
    const width = 3, texels = new Float32Array(width * 2 * 4).fill(-1);
    app.writeSculptureData(texels, width, 1, [10, 11, 12, 20, 21, 22], 3);
    app.writeSculptureData(texels, width, 1, [0.5, 0.25], 1, 3);
    expect([...texels.subarray(0, 12)]).toEqual(Array(12).fill(-1));          // row 0 untouched
    expect([...texels.subarray(12)]).toEqual([10, 11, 12, 0.5, 20, 21, 22, 0.25, -1, -1, -1, -1]);
  });

  test("refuses a row longer than the texture", () => {
    expect(() => app.writeSculptureData(new Float32Array(16), 2, 0, new Float32Array(12), 4)).toThrow(/holds 2 items, not 3/);
  });
});

/**
 * A renderer with a stand-in WebGL that keeps every texture upload, and
 * per-region and per-guide inputs coded by index: region r's k-th value is
 * 1000·(source) + 10·r + k, so a value on the wrong texel shows.
 */
function renderer(regions, guides) {
  const coded = (source, count, size) =>
    Float32Array.from({ length: count * size }, (_, i) => 1000 * source + 10 * Math.floor(i / size) + i % size);
  const uploads = [];
  const gl = { TEXTURE_2D: 1, RGBA: 2, FLOAT: 3, bindTexture() {},
    texSubImage2D: (target, level, x, y, w, h, format, type, data, offset) =>
      uploads.push({ x, y, w, h, offset, texels: Float32Array.from(data.subarray(offset, offset + w * h * 4)) }) };
  const r = Object.create(app.AnatomySculpture.prototype);
  const width = Math.max(regions, guides), rows = Object.keys(ROWS).length;
  Object.assign(r, {
    gl, uploads, view: { id: "front" },
    data: { texture: {}, width, rows, texels: new Float32Array(width * rows * 4), fresh: false },
    source: {
      state: coded(1, regions, 4), shown: coded(2, regions, 3), tint: coded(3, regions, 1),
      centers: coded(4, regions, 4), axes: coded(5, regions, 4), ink: coded(6, regions, 3), slot: coded(7, regions, 1),
      origins: coded(8, guides, 4), across: coded(9, guides, 4), along: coded(10, guides, 4) },
    regionStates() { return this.source.state; }
  });
  r.shown = r.source.shown;
  r.tintShown = r.source.tint;
  r.flowFrames = { centers: r.source.centers, axes: r.source.axes };
  r.flowGuides = { regions: r.source.slot, origins: r.source.origins, across: r.source.across, along: r.source.along };
  r.colors = { regionInk: r.source.ink };
  return r;
}

/** texelFetch(uData, ivec2(index, row), 0) on what was last uploaded to each texel. */
function fetcher(r) {
  const tex = new Float32Array(r.data.width * r.data.rows * 4).fill(NaN);
  for (const u of r.uploads) tex.set(u.texels, (u.y * r.data.width + u.x) * 4);
  return (index, row) => [...tex.subarray((row * r.data.width + index) * 4, (row * r.data.width + index) * 4 + 4)];
}

describe("uploadData", () => {
  // Male_Body today, and a figure split into far more regions than guides.
  for (const [regions, guides] of [[50, 15], [400, 15], [6, 9]]) {
    test(`${regions} regions, ${guides} guides: each value is on the texel the shaders read`, () => {
      const r = renderer(regions, guides), s = r.source;
      r.uploadData();
      const fetch = fetcher(r), item = (a, i, size) => [...a.subarray(i * size, i * size + size)];
      for (let i = 0; i < regions; i++) {
        expect(fetch(i, ROWS.state)).toEqual(item(s.state, i, 4));              // vertex: region
        expect(fetch(i, ROWS.map)).toEqual([...item(s.shown, i, 3), s.tint[i]]); // vMapState, vMapTint
        expect(fetch(i, ROWS.center)).toEqual(item(s.centers, i, 4));
        expect(fetch(i, ROWS.axis)).toEqual(item(s.axes, i, 4));
        expect(fetch(i, ROWS.ink)).toEqual([...item(s.ink, i, 3), s.slot[i]]);  // ink.rgb, vFlowGuide
      }
      for (let g = 0; g < guides; g++) {                                         // guide and guide + 1 alike
        expect(fetch(g, ROWS.guideOrigin)).toEqual(item(s.origins, g, 4));
        expect(fetch(g, ROWS.guideAcross)).toEqual(item(s.across, g, 4));
        expect(fetch(g, ROWS.guideAlong)).toEqual(item(s.along, g, 4));
      }
    });
  }

  test("sends every row once, then only the per-frame rows until a theme change", () => {
    const r = renderer(50, 15), full = { x: 0, y: 0, w: 50, h: Object.keys(ROWS).length, offset: 0 };
    const frame = { ...full, h: app.SCULPTURE_DATA_FRAME_ROWS };
    const shape = u => ({ x: u.x, y: u.y, w: u.w, h: u.h, offset: u.offset });
    r.uploadData();
    expect(shape(r.uploads.at(-1))).toEqual(full);
    r.shown = r.shown.map(v => v + 0.5);                                        // the state eases on
    r.uploadData();
    expect(shape(r.uploads.at(-1))).toEqual(frame);
    expect(fetcher(r)(7, ROWS.map)[0]).toBe(r.shown[21]);
    r.colors.regionInk = r.colors.regionInk.map(v => -v);                        // readColors, new theme
    r.data.fresh = false;
    r.uploadData();
    expect(shape(r.uploads.at(-1))).toEqual(full);
    expect(fetcher(r)(7, ROWS.ink).slice(0, 3)).toEqual([...r.colors.regionInk.subarray(21, 24)]);
  });
});
