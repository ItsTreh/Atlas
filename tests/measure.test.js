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
