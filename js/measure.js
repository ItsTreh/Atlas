/* ===========================================================================
   The measure: four facts about the body (stature, mass, years and the
   physiology the resting-burn equation should use), asked on the Measure
   stage between Targets and Nutrition (measure-view.js).

   They are meant to turn Nutrition's estimates from an average into the
   user's own. So far Nutrition reads the weight (NutritionPlan.weightKg);
   Measure itself shows the resting-burn estimate the four make
   (restingBurn), which Nutrition does not read yet. Kept in this
   browser only (storage.js, saveMeasure).
   ========================================================================= */

/* What the page accepts, in cm, kg and years. The weights match Nutrition's
   (WEIGHT_KG_RANGE). */
const MEASURE_LIMITS = { cm: [120, 230], kg: [30, 250], age: [14, 99] };
const MEASURE_SEX = { female: "Female", male: "Male", unspecified: "Not said" };

class BodyMeasure {
  constructor() {
    this.units = "metric";
    this.clear();
  }

  /** Forgets the four facts; the units stay. */
  clear() { this.cm = null; this.kg = null; this.age = null; this.sex = null; }

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
    const { cm, kg, age, sex, units } = this;
    return { cm, kg, age, sex, units };
  }

  /** Takes back only what the page could have set; anything else keeps its default (the mark's old name, stone and day are dropped). */
  restore(s) {
    if (!s || typeof s !== "object") return;
    for (const f of ["cm", "kg", "age"]) if (typeof s[f] === "number" && BodyMeasure.fits(f, s[f])) this.set(f, s[f]);
    if (Object.hasOwn(MEASURE_SEX, s.sex)) this.sex = s.sex;
    if (s.units === "metric" || s.units === "imperial") this.units = s.units;
  }
}

const bodyMeasure = new BodyMeasure();

/* ------------------------------ resting burn ------------------------------ */
/* An estimate of what the body burns at rest, in kcal a day, by the
   Mifflin–St Jeor equation: 10 × kg + 6.25 × cm − 5 × years + a constant
   for physiology (+5 male, −161 female). The equation and its constants are
   the paper's; two things here are ATLAS's own design choices, not findings:
     - "Not said" takes the midpoint of the two constants (−78);
     - a fact not given counts as the marble's own (158 cm, 70 kg, thirty
       years), and the page says so beside every term it fills.
   Shown on Measure only; Nutrition's daily burn does not read it yet. */
const RESTING_BURN = Object.freeze({
  source: "Mifflin MD, St Jeor ST, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241–7.",
  url: "https://doi.org/10.1093/ajcn/51.2.241",
  perKg: 10, perCm: 6.25, perYear: -5,
  constant: Object.freeze({ male: 5, female: -161, unspecified: -78 }),
  marble: Object.freeze({ cm: 158, kg: 70, age: 30 })
});

/**
 * The resting-burn estimate for a measure, term by term. Each term says
 * whether its fact was given (`own`) or the marble's stood in for it.
 * @returns {{ parts: { k: string, v: number, own: boolean }[], total: number }}
 */
function restingBurn({ cm = null, kg = null, age = null, sex = null } = {}) {
  const R = RESTING_BURN, m = R.marble;
  const parts = [
    { k: "stature", v: R.perCm * (cm ?? m.cm), own: cm !== null },
    { k: "mass", v: R.perKg * (kg ?? m.kg), own: kg !== null },
    { k: "years", v: R.perYear * (age ?? m.age), own: age !== null },
    { k: "physis", v: R.constant[sex ?? "unspecified"] ?? R.constant.unspecified, own: sex !== null }
  ];
  return { parts, total: parts.reduce((a, p) => a + p.v, 0) };
}

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
