import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

// filmAt lets Measure (js/measure-view.js) film the figure through the same
// camera it draws its rings with. Here the renderer's matrices are held to
// that camera, written out as the page writes it: a focal length in pixels,
// the aim point at (cx, cy) of the page, a roll about it.
const { AnatomySculpture } = loadApp({ extra: ["js/anatomy-sculpture.js"], exports: ["AnatomySculpture"] });

function renderer(cw = 1440, ch = 900) {
  const r = Object.create(AnatomySculpture.prototype);
  const min = [-30, 0, -15], max = [30, 157.683, 15];
  Object.assign(r, {
    model: { bounds: { min, max } }, axis: [0, 0], height: 157.683, scale: 1,
    reach: Math.hypot(60, 170, 30), size: { cw, ch }, cur: null, off: 0, schedule() {}
  });
  return r;
}
function project(r, p) {
  const m = r.camera(r.live()).matrix, { cw, ch } = r.size;
  const c = i => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i];
  const w = c(3);
  return { x: (c(0) / w + 1) / 2 * cw, y: (1 - c(1) / w) / 2 * ch };
}
/** The page's own camera (Measure): eye `d` from the aim point `ty` up, `e` up and `az` round, focal `foc` px, aim at (cx, cy), rolled. */
function pageCamera({ ty, d, e, az, roll, cx, cy }, foc) {
  const E = e * Math.PI / 180, A = az * Math.PI / 180, ce = Math.cos(E);
  const C = [d * ce * Math.sin(A), ty + d * Math.sin(E), d * ce * Math.cos(A)];
  let F = [-C[0], ty - C[1], -C[2]]; const fl = Math.hypot(...F); F = F.map(v => v / fl);
  let R = [-F[2], 0, F[0]]; const rl = Math.hypot(R[0], R[2]); R = R.map(v => v / rl);
  const U = [R[1] * F[2] - R[2] * F[1], R[2] * F[0] - R[0] * F[2], R[0] * F[1] - R[1] * F[0]];
  const rc = Math.cos(roll * Math.PI / 180), rs = Math.sin(roll * Math.PI / 180);
  return (x, y, z) => {
    const v = [x - C[0], y - C[1], z - C[2]], dot = a => v[0] * a[0] + v[1] * a[1] + v[2] * a[2];
    const k = foc / dot(F), X = dot(R) * k, Y = -dot(U) * k;
    return { x: cx + X * rc - Y * rs, y: cy + X * rs + Y * rc };
  };
}

describe("filming the figure through the page's camera", () => {
  const FOC = 1480;
  test.each([
    { ty: 89, d: 480, e: -5, az: -18, roll: 0, cx: 490, cy: 470 },
    { ty: 100, d: 400, e: 24, az: 30, roll: -3, cx: 445, cy: 425 },
    { ty: 46, d: 570, e: 40, az: -32, roll: 0, cx: 420, cy: 440 },
    { ty: 89, d: 450, e: 12, az: 38, roll: -2, cx: 430, cy: 415 }
  ])("az $az, el $e, roll $roll", cam => {
    for (const [cw, ch] of [[1440, 900], [1200, 900], [1600, 1000]]) {
      const r = renderer(cw, ch);
      const k = Math.min(cw / 1440, ch / 900), ox = (cw - 1440 * k) / 2, oy = (ch - 900 * k) / 2;
      r.filmAt({ az: cam.az, el: cam.e, ty: cam.ty, d: cam.d, x: ox + k * cam.cx, y: oy + k * cam.cy, focal: k * FOC, roll: cam.roll });
      const P = pageCamera(cam, FOC);
      for (const p of [[0, 0, 0], [0, 157, 0], [52, 158, 0], [-40, 90, 30], [20, 10, -60]]) {
        const a = project(r, p), b = P(...p), q = { x: ox + k * b.x, y: oy + k * b.y };
        expect(a.x).toBeCloseTo(q.x, 2);
        expect(a.y).toBeCloseTo(q.y, 2);
      }
    }
  });

  test("a later shot starts from no roll", () => {
    const r = renderer();
    expect(r.shotParams("targets-front").roll).toBe(0);
  });
});
