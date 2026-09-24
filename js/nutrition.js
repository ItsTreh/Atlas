/* --------------------------------------------------------------------------
   Nutrition. Still deliberately a light model — but now built on what the
   user says they burn a day rather than on body weight alone.

     daily burn  → the user's own number, or a rough estimate from body
                   weight and how active their day is
     goal        → a percentage above or below that burn
     body weight → the protein target

   Every number here is an ESTIMATE to eat against, not a prescription.
   A real figure would need age, height, sex, body composition and a few
   weeks of tracking; the page says so wherever the numbers appear.

   Meal times come from an eating window (first and last meal) with the
   meals spread evenly across it; any single meal can then be moved.
   Food ideas for each meal live in foods.js.
   -------------------------------------------------------------------------- */

/**
 * Goals. `adjust` is the change from daily burn: -0.2 means eat about 20%
 * below it. `protein` is grams per kg of body weight, with the usual range
 * it sits in shown to the user alongside.
 */
const GOALS = {
  lose:     { label: "Fat loss",        adjust: -0.20, protein: 2.2, range: [1.8, 2.7],
              blurb: "Eat below your burn. Higher protein helps keep muscle while you lose." },
  gain:     { label: "Muscle gain",     adjust: +0.10, protein: 2.0, range: [1.6, 2.2],
              blurb: "A small surplus — enough to build, without piling on fat." },
  maintain: { label: "Maintenance",     adjust:  0,    protein: 1.8, range: [1.6, 2.2],
              blurb: "Eat what you burn. Recomposition happens slowly here." },
  fitness:  { label: "General fitness", adjust:  0,    protein: 1.6, range: [1.2, 1.8],
              blurb: "Fuel training and recovery without chasing a body change." }
};

/* Rough daily burn per kg of body weight, by how active the day is,
   training included. Without height, age and sex this is only a start. */
const ACTIVITY_LEVELS = {
  seated:  { label: "Mostly seated",  kcalPerKg: 28, hint: "Desk job, little walking" },
  light:   { label: "Lightly active", kcalPerKg: 31, hint: "On your feet some of the day" },
  active:  { label: "Active",         kcalPerKg: 34, hint: "Walk a lot, or a physical job" },
  intense: { label: "Very active",    kcalPerKg: 38, hint: "Hard physical work most days" }
};

/* The lowest target the page will suggest, whatever the maths says. */
const KCAL_FLOOR = 1200;

/* The body weights the page will plan for, and the daily burns it accepts. */
const WEIGHT_KG_RANGE = [30, 250];
const BURN_RANGE = [1000, 6000];
const KG_PER_LB = 0.45359237;

/** The weight range in words, in both units, matching what isValid() accepts. */
function weightRangeText() {
  const [lo, hi] = WEIGHT_KG_RANGE;
  return lo + " and " + hi + " kg (" + Math.ceil(lo / KG_PER_LB) + "–" +
         Math.floor(hi / KG_PER_LB) + " lb)";
}

/** A daily burn held to the accepted range, to the nearest 10 kcal. */
const clampBurn = v => Math.max(BURN_RANGE[0], Math.min(BURN_RANGE[1], Math.round(v / 10) * 10));

/* Around this much protein per sitting is a practical amount to eat and use. */
const PROTEIN_PER_MEAL = 40;

/**
 * How the day's calories split, by number of meals. `main` meals are full
 * plates; `snack` ones are smaller, protein-led top-ups. Shares add to 1.
 */
const MEAL_PATTERNS = {
  2: [["main", .50], ["main", .50]],
  3: [["main", .30], ["main", .40], ["main", .30]],
  4: [["main", .27], ["main", .33], ["snack", .13], ["main", .27]],
  5: [["main", .22], ["snack", .13], ["main", .30], ["snack", .13], ["main", .22]],
  6: [["main", .20], ["snack", .10], ["main", .25], ["snack", .10], ["main", .25], ["snack", .10]]
};
const MEAL_COUNTS = Object.keys(MEAL_PATTERNS).map(Number);

/* What each kind of meal should be built around. */
const MEAL_FOCUS = {
  breakfast: "Protein + slow carbs",
  main:      "Protein + carbs + veg",
  snack:     "Protein + fruit or nuts"
};

/** A meal's name from its kind and time of day. */
function mealName(role, hour) {
  if (role === "snack")
    return hour < 12 ? "Morning snack" : hour < 17 ? "Afternoon snack" : "Evening snack";
  return hour < 11 ? "Breakfast" : hour < 16 ? "Lunch" : "Dinner";
}

class NutritionPlan {
  constructor() {
    this.weight = 70; this.unit = "kg"; this.goal = "maintain";
    this.activity = "light";
    this.burnInput = null;          // the user's own daily burn, or null to estimate
    this.mealsPerDay = 3;
    this.firstMeal = 8; this.lastMeal = 20;
    this.moved = {};                // meal index → hour the user moved it to
    this.diet = "any";              // see DIETS in foods.js
    this.showMeals = true;
  }

  get weightKg() { return this.unit === "lb" ? this.weight * KG_PER_LB : this.weight; }
  isValid() {
    return this.weightKg >= WEIGHT_KG_RANGE[0] && this.weightKg <= WEIGHT_KG_RANGE[1];
  }

  /** Sets the body weight. Anything that isn't a number (an empty field) clears it. */
  setWeight(v) { this.weight = Number.isFinite(v) ? v : null; }

  /* Switching unit converts the weight, so 70 kg becomes 154.5 lb, not 70 lb. */
  setUnit(unit) {
    if (unit === this.unit) return;
    const kg = this.weightKg;
    this.unit = unit;
    if (this.weight !== null)
      this.weight = Math.round((unit === "lb" ? kg / KG_PER_LB : kg) * 2) / 2;
  }

  /* ------------------------------ calories ------------------------------ */

  /** Daily burn from weight and activity — the fallback when the user has no number. */
  get estimatedBurn() {
    return clampBurn(Math.round(this.weightKg * ACTIVITY_LEVELS[this.activity].kcalPerKg / 50) * 50);
  }
  get burnIsEstimate() { return this.burnInput === null; }
  get burn() { return this.burnIsEstimate ? this.estimatedBurn : this.burnInput; }

  /** The user's own burn, held to the accepted range. Empty or zero goes back to the estimate. */
  setBurn(v) { this.burnInput = v ? clampBurn(v) : null; }
  /** Picking an activity level means using the estimate again. */
  setActivity(activity) { this.activity = activity; this.burnInput = null; }

  /** The unrounded goal target, before the floor is applied. */
  get rawKcal() { return this.burn * (1 + GOALS[this.goal].adjust); }
  get kcal() { return Math.max(KCAL_FLOOR, Math.round(this.rawKcal / 10) * 10); }
  get atFloor() { return this.rawKcal < KCAL_FLOOR; }

  /* ------------------------------ protein ------------------------------- */

  get protein() { return Math.round(this.weightKg * GOALS[this.goal].protein); }
  get proteinRange() { return GOALS[this.goal].range.map(g => Math.round(this.weightKg * g)); }

  /** Enough meals to spread the protein at a practical amount per sitting. */
  get suggestedMeals() {
    return Math.min(5, Math.max(3, Math.ceil(this.protein / PROTEIN_PER_MEAL)));
  }

  /* ------------------------------- meals -------------------------------- */

  /** Sets the meal count, widening the eating window if it is too tight. */
  setMealCount(n) {
    this.mealsPerDay = n; this.moved = {};
    this.setWindow(this.firstMeal, this.lastMeal);
  }
  /** Sets the eating window. Meals need an hour each, so it is widened as needed. */
  setWindow(first, last) {
    const span = this.mealsPerDay - 1;
    first = Math.max(FIRST_HOUR, Math.min(first, LAST_HOUR - span));
    last = Math.min(LAST_HOUR, Math.max(last, first + span));
    this.firstMeal = first; this.lastMeal = last; this.moved = {};
  }
  /** Moves one meal. It must stay between its neighbours. */
  moveMeal(index, hour) {
    const [lo, hi] = this.hourBounds(index);
    this.moved[index] = Math.max(lo, Math.min(hi, hour));
  }

  /** The meal hours: spread evenly over the window, then any moved ones. */
  get hours() {
    const n = this.mealsPerDay;
    const spread = Array.from({ length: n }, (_, i) =>
      n === 1 ? this.firstMeal
              : Math.round(this.firstMeal + i * (this.lastMeal - this.firstMeal) / (n - 1)));
    return spread.map((h, i) => this.moved[i] ?? h);
  }
  /** The earliest and latest hour meal `index` can move to. */
  hourBounds(index) {
    const h = this.hours;
    return [index === 0 ? FIRST_HOUR : h[index - 1] + 1,
            index === h.length - 1 ? LAST_HOUR : h[index + 1] - 1];
  }

  /**
   * The day's meals: name, hour, kind, share, calories and protein. The
   * schedule reads `hour` to keep sessions off meal times and places them
   * on the calendar; the nutrition stage reads the rest.
   */
  get meals() {
    const pattern = MEAL_PATTERNS[this.mealsPerDay] || MEAL_PATTERNS[3];
    const hours = this.hours;
    const used = new Set();
    return pattern.map(([role, share], i) => {
      const hour = hours[i];
      let name = mealName(role, hour);
      if (used.has(name)) name = "Meal " + (i + 1);
      used.add(name);
      const kind = role === "main" && hour < 11 ? "breakfast" : role;
      return {
        index: i, name, hour, role, kind, share,
        focus:   MEAL_FOCUS[kind],
        kcal:    Math.round(this.kcal * share / 10) * 10,
        protein: Math.round(this.protein * share)
      };
    });
  }
}
