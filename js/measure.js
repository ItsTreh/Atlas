/* ===========================================================================
   The measure: four facts about the body (stature, mass, years and the
   physiology the resting-burn equation should use), asked on the Measure
   stage between Targets and Nutrition (measure-view.js).

   They are meant to turn Nutrition's estimates from an average into the
   user's own. Nothing reads them yet: Nutrition still plans from the weight
   it asks for itself (nutrition.js). Kept in this browser only
   (storage.js, saveMeasure), with the seal's name and ink.
   ========================================================================= */

/* What the page accepts, in cm, kg and years. The weights match Nutrition's
   (WEIGHT_KG_RANGE). */
const MEASURE_LIMITS = { cm: [120, 230], kg: [30, 250], age: [14, 99] };
const MEASURE_SEX = { female: "Female", male: "Male", unspecified: "Not said" };
/* The seal's inks: the family hues' traces, and iron-gall ink. */
const MEASURE_INKS = { core: "Madder rose", pull: "Egyptian blue", legs: "Green earth", push: "Yellow ochre", ink: "Iron-gall ink" };
const MEASURE_NAME_MAX = 18;

class BodyMeasure {
  constructor() {
    this.units = "metric";
    this.ink = "core";
    this.clear();
  }

  /** Forgets the four facts, the seal's name and the day it was struck; the units and ink stay. */
  clear() {
    this.cm = null; this.kg = null; this.age = null; this.sex = null;
    this.sealed = null; this.name = null;
  }

  get imperial() { return this.units === "imperial"; }
  /** How many of the four facts are given. */
  get given() { return [this.cm, this.kg, this.age, this.sex].filter(v => v !== null).length; }
  get complete() { return this.given === 4; }

  /** Sets a fact, held to its limits (an age to whole years); anything not a number clears it. */
  set(field, v) {
    if (field === "sex") { this.sex = Object.hasOwn(MEASURE_SEX, v) ? v : null; return; }
    if (!Object.hasOwn(MEASURE_LIMITS, field)) return;
    if (v === null || v === "" || !Number.isFinite(Number(v))) { this[field] = null; return; }
    const [lo, hi] = MEASURE_LIMITS[field], n = Math.max(lo, Math.min(hi, Number(v)));
    this[field] = field === "age" ? Math.round(n) : n;
  }

  /** True when `v` is inside the field's limits, as typed so far. */
  static fits(field, v) {
    const [lo, hi] = MEASURE_LIMITS[field];
    return Number.isFinite(v) && v >= lo && v <= hi;
  }

  snapshot() {
    const { cm, kg, age, sex, units, sealed, name, ink } = this;
    return { cm, kg, age, sex, units, sealed, name, ink };
  }

  /** Takes back only what the page could have set; anything else keeps its default. */
  restore(s) {
    if (!s || typeof s !== "object") return;
    for (const f of ["cm", "kg", "age"]) if (typeof s[f] === "number" && BodyMeasure.fits(f, s[f])) this.set(f, s[f]);
    if (Object.hasOwn(MEASURE_SEX, s.sex)) this.sex = s.sex;
    if (s.units === "metric" || s.units === "imperial") this.units = s.units;
    if (Object.hasOwn(MEASURE_INKS, s.ink)) this.ink = s.ink;
    if (typeof s.name === "string" && s.name.trim()) this.name = s.name.trim().slice(0, MEASURE_NAME_MAX);
    if (typeof s.sealed === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.sealed)) this.sealed = s.sealed;
  }
}

const bodyMeasure = new BodyMeasure();

const ROMAN_DIGITS = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
/** A whole number in Roman numerals: 1984 → "MCMLXXXIV". */
function romanNumeral(n) {
  let s = "";
  for (const [v, r] of ROMAN_DIGITS) while (n >= v) { s += r; n -= v; }
  return s;
}

/** A height in cm as [feet, inches], to the nearest inch. */
function feetInches(cm) {
  const t = Math.round(cm / 2.54);
  return [Math.floor(t / 12), t % 12];
}
/** A weight in kg, in whole pounds. */
const poundsOf = kg => Math.round(kg / KG_PER_LB);
