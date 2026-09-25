/* --------------------------------------------------------------------------
   Nutrition. Still deliberately a light model, but built from the whole plan
   rather than from body weight alone.

     daily burn  → the user's own number, or a rough estimate: their day
                   outside the gym from body weight and activity, plus the
                   training the routine plans
     goal        → a percentage above or below that burn
     body weight → the protein target

   The goal does not fix the numbers. Each goal names a span for its calorie
   change and its protein, and what the user trains decides where in that
   span the recommendation lands (see recommendTargets). The user can then
   set either number themselves; clearing it goes back to the recommendation.

   Every number here is an ESTIMATE to eat against, not a prescription.
   A real figure would need age, height, sex, body composition and a few
   weeks of tracking; the page says so wherever the numbers appear.

   Meal times come from an eating window (first and last meal) with the
   meals spread evenly across it; any single meal can then be moved.
   Food ideas for each meal live in foods.js.
   -------------------------------------------------------------------------- */

/**
 * Goals. `adjust` is the span of the change from daily burn: -0.2 means eat
 * about 20% below it. `protein` is the span in grams per kg of body weight,
 * shown to the user as the usual range. `adjustBy` names the part of the
 * training load (see trainingLoad) that moves the calorie change across its
 * span; protein always moves with how hard the week is.
 *
 *   lose  — the more you train, the smaller the deficit, so sessions stay fuelled
 *   gain  — the more of your body you train, the more a surplus can build
 */
const GOALS = {
  lose:     { label: "Fat loss",        adjust: [-0.20, -0.15], adjustBy: "load",
              protein: [1.8, 2.7],
              blurb: "Eat below your burn. Higher protein helps keep muscle while you lose." },
  gain:     { label: "Muscle gain",     adjust: [+0.05, +0.12], adjustBy: "coverage",
              protein: [1.6, 2.2],
              blurb: "A small surplus — enough to build, without piling on fat." },
  maintain: { label: "Maintenance",     adjust: [0, 0],         adjustBy: null,
              protein: [1.6, 2.2],
              blurb: "Eat what you burn. Recomposition happens slowly here." },
  fitness:  { label: "General fitness", adjust: [0, 0],         adjustBy: null,
              protein: [1.2, 1.8],
              blurb: "Fuel training and recovery without chasing a body change." }
};

/* Rough daily burn per kg of body weight, by how active the day is OUTSIDE
   training — the planned sessions are added on top (see trainingLoad), so
   they are never counted twice. Without height, age and sex this is only a
   start. */
const ACTIVITY_LEVELS = {
  seated:  { label: "Mostly seated",  kcalPerKg: 26, hint: "Desk job, little walking" },
  light:   { label: "Lightly active", kcalPerKg: 29, hint: "On your feet some of the day" },
  active:  { label: "Active",         kcalPerKg: 32, hint: "Walk a lot, or a physical job" },
  intense: { label: "Very active",    kcalPerKg: 36, hint: "Hard physical work most days" }
};

/**
 * What a planned session costs, for the burn estimate.
 *
 * `kcalPerKgHour` is the energy a lifting session burns above resting, per
 * kg of body weight and hour, rests included: the low end for training
 * small muscles (arms, calves), the high end for the big ones that carry
 * heavy compound lifts (see bigShare in trainingLoad). `heavyWeekHours` is
 * the week that counts as a hard one; protein sits at the top of its range
 * from there.
 */
const TRAINING_ENERGY = Object.freeze({
  kcalPerKgHour:  [3, 5],
  heavyWeekHours: 6
});

/* What the user may set the targets to themselves. */
const ADJUST_RANGE = [-0.30, +0.20];
const PROTEIN_PER_KG_RANGE = [1.2, 3.0];

/* A plan that is not part of a routine yet, so has no training to fuel. */
const NO_TRAINING = Object.freeze({ muscles: [], sessionsPerWeek: 0, sessionMinutes: 0 });

/* The weekly volume of training every muscle: what "all of the body" means. */
const FULL_BODY_SETS = MUSCLES.reduce((t, m) => t + m.weeklySets[1], 0);

/**
 * What the planned training asks of the diet.
 *
 *   hours       training hours a week
 *   bigShare    share of the week's volume that goes to large muscles
 *               (recoveryDays 2, the ones heavy compound lifts load), 0–1
 *   kcalPerDay  what the sessions burn above resting, averaged over 7 days
 *   coverage    how much of the body the plan trains, by weekly volume, 0–1
 *   load        how hard the week is, 0–1 (hours against a heavy week)
 *
 * `muscles` must be the ones the training system can fill with exercises;
 * no muscles means nothing is trained, whatever the session count says.
 *
 * Session length is a ceiling, not a promise: the workouts give each muscle
 * no more than its weekly maximum (workouts.js), so the hours are the
 * lesser of the sessions booked and the sets those muscles take, warm-ups
 * included — the same per-set and warm-up times as the training estimate.
 */
function trainingLoad({ muscles, sessionsPerWeek, sessionMinutes }, weightKg) {
  if (!muscles.length || !sessionsPerWeek)
    return { muscles, sessionsPerWeek: 0, sessionMinutes, hours: 0, bigShare: 0,
             kcalPerDay: 0, coverage: 0, load: 0 };
  const sets = muscles.reduce((t, m) => t + m.weeklySets[1], 0);
  const bigSets = muscles.reduce((t, m) => t + (m.recoveryDays >= 2 ? m.weeklySets[1] : 0), 0);
  const minutes = Math.min(sessionsPerWeek * sessionMinutes,
    sets * ESTIMATE.minutesPerSet + sessionsPerWeek * ESTIMATE.warmupMinutes);
  const hours = minutes / 60;
  const bigShare = bigSets / sets;
  const [lo, hi] = TRAINING_ENERGY.kcalPerKgHour;
  return {
    muscles, sessionsPerWeek, sessionMinutes, hours, bigShare,
    kcalPerDay: Math.round(weightKg * hours * (lo + (hi - lo) * bigShare) / 7),
    coverage: Math.min(1, sets / FULL_BODY_SETS),
    load: Math.min(1, hours / TRAINING_ENERGY.heavyWeekHours)
  };
}

/**
 * The recommended calorie change and protein (g/kg) for a goal, given the
 * training load. Each lands in its goal's span, placed by the load:
 * `adjust` to the whole percent, protein to 0.1 g/kg.
 */
function recommendTargets(goal, load) {
  const g = GOALS[goal];
  const across = ([lo, hi], t) => lo + (hi - lo) * t;
  return {
    adjust:  Math.round(across(g.adjust, g.adjustBy ? load[g.adjustBy] : 0) * 100) / 100,
    protein: Math.round(across(g.protein, load.load) * 10) / 10
  };
}

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
  /**
   * @param training  returns what the plan fuels: { muscles, sessionsPerWeek,
   *                  sessionMinutes }. The routine passes its own, read live
   *                  so there is nothing to keep in sync.
   */
  constructor(training = () => NO_TRAINING) {
    this.training = training;
    this.weight = 70; this.unit = "kg"; this.goal = "maintain";
    this.activity = "light";
    this.burnInput = null;          // the user's own daily burn, or null to estimate
    this.adjustInput = null;        // the user's own calorie change, or null to recommend
    this.proteinInput = null;       // the user's own protein in g/kg, or null to recommend
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

  /* ---------------------------- recommendation --------------------------- */

  /** What the planned training asks of the diet; see trainingLoad(). */
  get load() { return trainingLoad(this.training(), this.weightKg); }
  /** The goal's recommended calorie change and protein for this training. */
  get recommended() { return recommendTargets(this.goal, this.load); }

  /** Picking a different goal means taking its recommendation again. */
  setGoal(goal) {
    if (goal === this.goal) return;
    this.goal = goal; this.adjustInput = null; this.proteinInput = null;
  }

  /* ------------------------------ calories ------------------------------ */

  /** The day outside training, from weight and activity. */
  get baseBurn() { return this.weightKg * ACTIVITY_LEVELS[this.activity].kcalPerKg; }
  /** Daily burn from the day plus the planned training — the fallback when the user has no number. */
  get estimatedBurn() {
    return clampBurn(Math.round((this.baseBurn + this.load.kcalPerDay) / 50) * 50);
  }
  get burnIsEstimate() { return this.burnInput === null; }
  get burn() { return this.burnIsEstimate ? this.estimatedBurn : this.burnInput; }

  /** The user's own burn, held to the accepted range. Empty or zero goes back to the estimate. */
  setBurn(v) { this.burnInput = v ? clampBurn(v) : null; }
  /** Picking an activity level means using the estimate again. */
  setActivity(activity) { this.activity = activity; this.burnInput = null; }

  /** The change from burn: the user's, or the recommendation. */
  get adjust() { return this.adjustInput ?? this.recommended.adjust; }
  /* A kept setting the recommendation has since moved onto reads as the recommendation. */
  get adjustIsRecommended() { return this.adjust === this.recommended.adjust; }
  /** Sets the calorie change, held to the accepted range. The recommendation clears it. */
  setAdjust(v) {
    const a = Math.round(Math.max(ADJUST_RANGE[0], Math.min(ADJUST_RANGE[1], v)) * 100) / 100;
    this.adjustInput = a === this.recommended.adjust ? null : a;
  }

  /** The unrounded goal target, before the floor is applied. */
  get rawKcal() { return this.burn * (1 + this.adjust); }
  get kcal() { return Math.max(KCAL_FLOOR, Math.round(this.rawKcal / 10) * 10); }
  get atFloor() { return this.rawKcal < KCAL_FLOOR; }

  /* ------------------------------ protein ------------------------------- */

  /** Protein in g/kg: the user's, or the recommendation. */
  get proteinPerKg() { return this.proteinInput ?? this.recommended.protein; }
  get proteinIsRecommended() { return this.proteinPerKg === this.recommended.protein; }
  /** Sets protein in g/kg, held to the accepted range. The recommendation clears it. */
  setProtein(v) {
    const p = Math.round(Math.max(PROTEIN_PER_KG_RANGE[0], Math.min(PROTEIN_PER_KG_RANGE[1], v)) * 10) / 10;
    this.proteinInput = p === this.recommended.protein ? null : p;
  }

  get protein() { return Math.round(this.weightKg * this.proteinPerKg); }
  get proteinRange() { return GOALS[this.goal].protein.map(g => Math.round(this.weightKg * g)); }

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
