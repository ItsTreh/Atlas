/* The measure (measure.js): four facts held to what the page accepts, and
   a stored copy taken back only where it could have come from the page. */
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp();
const json = x => JSON.parse(JSON.stringify(x));

describe("the measure", () => {
  test("starts with nothing given, in metric", () => {
    const m = new app.BodyMeasure();
    expect(m.given).toBe(0);
    expect(m.complete).toBe(false);
    expect(m.units).toBe("metric");
  });

  test("holds each fact to its limits; an age to whole years", () => {
    const m = new app.BodyMeasure();
    m.set("cm", 300); m.set("kg", 5); m.set("age", 33.6); m.set("sex", "female");
    expect([m.cm, m.kg, m.age, m.sex]).toEqual([app.MEASURE_LIMITS.cm[1], app.MEASURE_LIMITS.kg[0], 34, "female"]);
    expect(m.complete).toBe(true);
    m.set("cm", ""); m.set("sex", "other");
    expect([m.cm, m.sex, m.given]).toEqual([null, null, 2]);
  });

  test("the mark's stone is cut once, kept through a reload, and forgotten by clear()", () => {
    const m = new app.BodyMeasure();
    expect(m.seed).toBe(null);
    const seed = m.recut(() => .5);
    expect(Number.isInteger(seed) && seed > 0).toBe(true);
    m.set("kg", 80);                      // a fact changing does not recut it
    expect(m.seed).toBe(seed);
    const back = new app.BodyMeasure();
    back.restore(json(m.snapshot()));
    expect(back.seed).toBe(seed);
    back.restore({ seed: -4 }); back.restore({ seed: "x" }); back.restore({ seed: 1.5 });
    expect(back.seed).toBe(seed);
    m.clear();
    expect(m.seed).toBe(null);
  });

  test("clear() keeps the units and the ink", () => {
    const m = new app.BodyMeasure();
    Object.assign(m, { units: "imperial", ink: "pull", name: "Ada", sealed: "2026-10-27" });
    m.set("kg", 70);
    m.clear();
    expect([m.kg, m.name, m.sealed, m.units, m.ink]).toEqual([null, null, null, "imperial", "pull"]);
  });

  test("a stored measure comes back whole", () => {
    const m = new app.BodyMeasure();
    m.set("cm", 181); m.set("kg", 82.5); m.set("age", 41); m.set("sex", "unspecified");
    Object.assign(m, { units: "imperial", ink: "legs", name: "Ada", sealed: "2026-10-27" });
    const back = new app.BodyMeasure();
    back.restore(json(m.snapshot()));
    expect(back.snapshot()).toEqual(m.snapshot());
  });

  test.each([
    ["cm", 999], ["cm", "181"], ["kg", -4], ["age", 3], ["sex", "__proto__"], ["units", "furlongs"],
    ["ink", "toString"], ["name", 7], ["sealed", "yesterday"]
  ])("%s = %j keeps the default", (key, value) => {
    const m = new app.BodyMeasure(), fresh = new app.BodyMeasure().snapshot();
    expect(() => m.restore({ [key]: value })).not.toThrow();
    expect(m.snapshot()).toEqual(fresh);
  });

  test.each([null, 3, "x", []])("restoring %j does nothing", s => {
    const m = new app.BodyMeasure();
    expect(() => m.restore(s)).not.toThrow();
    expect(m.snapshot()).toEqual(new app.BodyMeasure().snapshot());
  });

  test("Roman numerals, feet and inches, pounds", () => {
    expect(app.romanNumeral(1984)).toBe("MCMLXXXIV");
    expect(app.romanNumeral(99)).toBe("XCIX");
    expect(app.feetInches(180)).toEqual([5, 11]);
    expect(app.poundsOf(70)).toBe(154);
  });
});

/* The resting-burn estimate (Mifflin–St Jeor, 1990), and what stands in for a fact not given. */
describe("the resting-burn estimate", () => {
  test("is the paper's equation for a measure given in full", () => {
    const b = app.restingBurn({ cm: 178, kg: 74, age: 31, sex: "male" });
    expect(b.total).toBeCloseTo(10 * 74 + 6.25 * 178 - 5 * 31 + 5, 9);
    expect(app.restingBurn({ cm: 165, kg: 60, age: 40, sex: "female" }).total).toBeCloseTo(600 + 1031.25 - 200 - 161, 9);
    expect(b.parts.map(p => p.own)).toEqual([true, true, true, true]);
  });

  test("not said takes the midpoint of the two constants", () => {
    const c = app.RESTING_BURN.constant;
    expect(c.unspecified).toBe(Math.round((c.male + c.female) / 2));
    expect(app.restingBurn({ cm: 170, kg: 70, age: 30, sex: "unspecified" }).parts[3]).toEqual({ k: "physis", v: -78, own: true });
  });

  test("a fact not given counts as the marble's, and says so", () => {
    const b = app.restingBurn({ kg: 80 });
    expect(b.parts.map(p => p.own)).toEqual([false, true, false, false]);
    expect(b.total).toBeCloseTo(6.25 * 158 + 800 - 150 - 78, 9);
    expect(app.restingBurn(new app.BodyMeasure()).total).toBeCloseTo(6.25 * 158 + 700 - 150 - 78, 9);
  });

  test("cites its source by DOI", () => {
    expect(app.RESTING_BURN.url).toBe("https://doi.org/10.1093/ajcn/51.2.241");
  });
});
