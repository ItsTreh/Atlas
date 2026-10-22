import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { loadApp } from "./load-app.js";

// The renderer reads the clock and sets timers through these, so the fake
// timers below drive it. Bound late, after vi.useFakeTimers has run.
const { AnatomySculpture, SCULPTURE_VIEWS, SCULPTURE_RESIZE_QUIET_MS: QUIET } = loadApp({
  extra: ["js/anatomy-sculpture.js"], exports: ["AnatomySculpture", "SCULPTURE_VIEWS", "SCULPTURE_RESIZE_QUIET_MS"],
  globals: {
    setTimeout: (...a) => setTimeout(...a), clearTimeout: (...a) => clearTimeout(...a),
    performance: { now: () => Date.now() }, window: { devicePixelRatio: 1 }, cancelAnimationFrame: () => {}
  } });

/**
 * A renderer without WebGL or a page: the real layout, picking and
 * scheduling code, with renderIds replaced by one that keeps the real
 * bookkeeping (a buffer the size of the canvas, pickKey for "live") and
 * paints every pixel region 0, the chest.
 */
function renderer() {
  const r = Object.create(AnatomySculpture.prototype);
  Object.assign(r, {
    ready: true, interactive: true, drawnOnce: true, needsLayout: false, mobile: false,
    mount: { clientWidth: 400, clientHeight: 300 }, canvas: {}, reducedMotion: null,
    size: null, cur: null, tween: null, offTween: null, drag: null, off: 0, shotName: "targets-front", view: SCULPTURE_VIEWS[0],
    pickKey: null, resizedAt: -Infinity, pointer: null, focused: null, hovered: null,
    muscleOf: ["chest"], reads: [], relayouts: [],
    placeHitsSoon() {}, moved() {}, onTurn() {}, unbind() {},
    hover(id) { this.hovered = id; },
    schedule(relayout = false) { this.relayouts.push(relayout); },
    renderIds(s, into) {
      const { cw, ch } = this.size;
      if (!this.idTarget || this.idTarget.w !== cw || this.idTarget.h !== ch)
        this.idTarget = { w: cw, h: ch, pixels: {} };
      this.idTarget.pixels[into] = new Uint8Array(cw * ch * 4).fill(1);
      this.reads.push({ into, size: { ...this.size }, camera: s });
      if (into === "live") this.pickKey = this.keyOf(s);
    }
  });
  return r;
}

const resize = (r, w, h = 300) => { r.mount.clientWidth = w; r.mount.clientHeight = h; r.layout(); };
const live = r => r.reads.filter(x => x.into === "live");

beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] }); vi.setSystemTime(10000); });
afterEach(() => vi.useRealTimers());

describe("one-time layouts read the region buffer at once", () => {
  test("the first frame, and layouts that keep the size (a zoom, a restored context, the phone framing)", () => {
    const r = renderer();
    r.layout();                                            // first frame
    expect(live(r)).toHaveLength(1);
    expect(r.still()).toBe(true);
    for (let i = 0; i < 3; i++) { vi.advanceTimersByTime(10); r.layout(); }
    expect(live(r)).toHaveLength(1);                       // same size and shot: the buffer is current
    expect(r.still()).toBe(true);
    r.mobile = true;                                       // the phone framing moves the camera
    r.layout();
    expect(live(r)).toHaveLength(2);                       // read at once
    expect(r.still()).toBe(true);
    r.idTarget = null; r.pickKey = null;                   // what initGL leaves after a restored context
    r.layout();
    expect(live(r)).toHaveLength(3);
    expect(r.muscleAt(100, 100)).toBe("chest");
    expect(vi.getTimerCount()).toBe(0);
  });

  test("a single resize, and the first step of a dragged one, read at the new size at once", () => {
    const r = renderer();
    r.layout();
    vi.advanceTimersByTime(1000);
    resize(r, 380);
    expect(live(r).at(-1).size).toEqual({ cw: 380, ch: 300 });
    expect(r.still()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  test("a layout keeping the size joins a resize that waits, without restarting it", () => {
    // A window resize lays out twice: the mount's ResizeObserver, then the
    // window's resize event (kept for zooms) at the size already laid out.
    const r = renderer();
    r.layout();
    vi.advanceTimersByTime(1000);
    resize(r, 380); vi.advanceTimersByTime(16); resize(r, 360);   // the second step waits
    expect(live(r)).toHaveLength(2);
    vi.advanceTimersByTime(100);
    r.layout();                                                  // same size, mid-resize
    expect(live(r)).toHaveLength(2);
    expect(r.still()).toBe(false);
    vi.advanceTimersByTime(QUIET - 100);                         // the wait was not restarted
    expect(live(r)).toHaveLength(3);
    expect(r.still()).toBe(true);
    vi.advanceTimersByTime(10);
    r.mobile = true;
    r.layout();                                                  // and once it is over, at once again
    expect(live(r)).toHaveLength(4);
  });

  test("stage changes and camera moves never lay out again", () => {
    const r = renderer();
    r.layout();
    r.cur = r.shotParams();
    r.setShot("nutrition");
    r.setShot("targets");
    r.turnTo("back");
    expect(r.relayouts.length).toBeGreaterThan(0);
    expect(r.relayouts.every(x => x === false)).toBe(true);
  });
});

describe("a resize in progress waits, and the latest size wins", () => {
  test("steps after the first wait until the size has been still for the quiet time", () => {
    const r = renderer();
    r.layout();
    vi.advanceTimersByTime(1000);
    for (let k = 1; k <= 20; k++) { resize(r, 400 - k * 5); vi.advanceTimersByTime(16); }
    expect(live(r)).toHaveLength(2);                             // the first frame and the first step
    vi.advanceTimersByTime(QUIET - 16 - 1);
    expect(live(r)).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(live(r)).toHaveLength(3);                             // exactly one more
    expect(live(r).at(-1).size).toEqual({ cw: 300, ch: 300 });   // the last size
    expect(r.still()).toBe(true);
    vi.advanceTimersByTime(QUIET * 4);
    expect(live(r)).toHaveLength(3);
  });

  test("each step restarts the wait, however slowly it comes within it", () => {
    const r = renderer();
    r.layout();
    vi.advanceTimersByTime(1000);
    resize(r, 390);
    for (let k = 2; k <= 6; k++) { vi.advanceTimersByTime(QUIET - 1); resize(r, 400 - k * 10); }
    expect(live(r)).toHaveLength(2);
    vi.advanceTimersByTime(QUIET);
    expect(live(r)).toHaveLength(3);
    expect(live(r).at(-1).size).toEqual({ cw: 340, ch: 300 });
  });

  test("the wait draws through the camera and size of the moment it ends", () => {
    const r = renderer();
    r.layout();
    vi.advanceTimersByTime(1000);
    resize(r, 380); vi.advanceTimersByTime(16); resize(r, 360);
    r.off = 20;                                                   // dragged round while waiting
    vi.advanceTimersByTime(QUIET);
    expect(live(r)).toHaveLength(3);
    expect(live(r).at(-1).size).toEqual({ cw: 360, ch: 300 });
    expect(live(r).at(-1).camera.az).toBe(r.cur.az + 20);
    expect(r.still()).toBe(true);
  });

  test("a wait that ends with a layout still due leaves the buffer to that layout", () => {
    const r = renderer();
    r.layout();
    vi.advanceTimersByTime(1000);
    resize(r, 380); vi.advanceTimersByTime(16); resize(r, 360);
    r.mount.clientWidth = 350;                                    // resized again, laid out next frame
    r.needsLayout = true;
    vi.advanceTimersByTime(QUIET);
    expect(live(r)).toHaveLength(2);                              // not drawn at the old size
    expect(r.muscleAt(100, 100)).toBe(null);
    r.needsLayout = false;
    r.layout();
    expect(live(r)).toHaveLength(3);
    expect(live(r).at(-1).size).toEqual({ cw: 350, ch: 300 });
    expect(r.still()).toBe(true);
  });

  test("a wait that ends while the camera moves leaves the buffer to settle()", () => {
    const r = renderer();
    r.layout();
    vi.advanceTimersByTime(1000);
    resize(r, 380); vi.advanceTimersByTime(16); resize(r, 360);
    r.tween = {};                                                 // the camera is travelling
    vi.advanceTimersByTime(QUIET);
    expect(live(r)).toHaveLength(2);
    r.tween = null;
    r.settle();
    expect(live(r)).toHaveLength(3);
    expect(live(r).at(-1).size).toEqual({ cw: 360, ch: 300 });
    expect(r.still()).toBe(true);
  });

  test("off Targets nothing is read, and a destroyed renderer leaves no wait behind", () => {
    const r = renderer();
    r.layout();
    r.interactive = false;
    vi.advanceTimersByTime(1000);
    resize(r, 380); vi.advanceTimersByTime(16); resize(r, 360);
    vi.advanceTimersByTime(QUIET);
    expect(live(r)).toHaveLength(1);
    r.interactive = true;
    resize(r, 340);
    r.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("a stale region buffer selects nothing", () => {
  test("while a resize waits, the old buffer names no muscle, then the new one does", () => {
    const r = renderer();
    r.layout();
    expect(r.muscleAt(100, 100)).toBe("chest");
    vi.advanceTimersByTime(1000);
    resize(r, 380); vi.advanceTimersByTime(16); resize(r, 360);
    expect(r.idTarget.pixels.live).toBeDefined();                 // the old buffer is still there
    expect(r.still()).toBe(false);
    expect(r.muscleAt(100, 100)).toBe(null);                      // the click handler toggles nothing
    expect(r.muscleNear(100, 100)).toBe(null);                    // nor does a touch beside a muscle
    r.pointer = [100, 100];
    vi.advanceTimersByTime(QUIET);
    expect(r.muscleAt(100, 100)).toBe("chest");
    expect(r.hovered).toBe("chest");                              // a waiting pointer picks it up
  });
});
