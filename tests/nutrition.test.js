/* The nutrition plan: estimates, meal structure and example meals. */
import { beforeEach, describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp();
let n;
beforeEach(() => { n = new app.NutritionPlan(); });

describe("calories", () => {
  test("daily burn is estimated from weight and activity until the user gives one", () => {
    n.weight = 80; n.activity = "active";
    expect(n.burnIsEstimate).toBe(true);
    expect(n.burn).toBe(Math.round(80 * app.ACTIVITY_LEVELS.active.kcalPerKg / 50) * 50);
    n.burnInput = 2600;
    expect(n.burnIsEstimate).toBe(false);
    expect(n.burn).toBe(2600);
  });

  test("the goal moves the target from the burn", () => {
    n.burnInput = 2500;             // no training: each goal's untrained end
    n.setGoal("maintain"); expect(n.kcal).toBe(2500);
    n.setGoal("lose");     expect(n.kcal).toBe(2000);
    n.setGoal("gain");     expect(n.kcal).toBe(2630);
  });

  test("the target never goes below the floor, and says so", () => {
    n.burnInput = 1300; n.goal = "lose";
    expect(n.kcal).toBe(app.KCAL_FLOOR);
    expect(n.atFloor).toBe(true);
  });

  test("pounds are converted, not read as kilograms", () => {
    n.unit = "lb"; n.weight = 154.3;
    expect(n.weightKg).toBeCloseTo(70, 0);
    expect(n.protein).toBe(Math.round(n.weightKg * n.proteinPerKg));
  });

  test("an impossible weight is invalid", () => {
    n.weight = 0; expect(n.isValid()).toBe(false);
    n.weight = 70; expect(n.isValid()).toBe(true);
  });

  test("the weight range message matches what is accepted", () => {
    n.unit = "lb";
    const [, lo, hi] = app.weightRangeText().match(/\((\d+)–(\d+) lb\)/).map(Number);
    n.weight = lo;     expect(n.isValid()).toBe(true);
    n.weight = lo - 1; expect(n.isValid()).toBe(false);
    n.weight = hi;     expect(n.isValid()).toBe(true);
    n.weight = hi + 1; expect(n.isValid()).toBe(false);
  });

  test("an empty weight is cleared, not read as zero", () => {
    n.setWeight(NaN);
    expect(n.weight).toBe(null);
    expect(n.isValid()).toBe(false);
    n.setUnit("lb");
    expect(n.weight).toBe(null);
    n.setWeight(154);
    expect(n.isValid()).toBe(true);
  });

  test("switching unit converts the weight", () => {
    n.weight = 70;
    n.setUnit("lb"); expect(n.weight).toBe(154.5);
    n.setUnit("kg"); expect(n.weight).toBe(70);
  });

  test("a typed burn is held to the accepted range, and empty means estimate", () => {
    const [lo, hi] = app.BURN_RANGE;
    n.setBurn(5);      expect(n.burn).toBe(lo);
    n.setBurn(99999);  expect(n.burn).toBe(hi);
    n.setBurn(2345);   expect(n.burn).toBe(2350);
    n.setBurn(0);      expect(n.burnIsEstimate).toBe(true);
  });

  test("the estimated burn stays in the same range as a typed one", () => {
    const [lo, hi] = app.BURN_RANGE;
    n.weight = 250; n.activity = "intense"; expect(n.burn).toBe(hi);
    n.weight = 30;  n.activity = "seated";  expect(n.burn).toBe(lo);
  });

  test("picking an activity level goes back to the estimate", () => {
    n.setBurn(3000);
    n.setActivity("active");
    expect(n.activity).toBe("active");
    expect(n.burnIsEstimate).toBe(true);
  });
});

/* A routine's plan, fed by what it trains. */
function planFor({ program, sessions = 4, minutes = 60, goal = "maintain", weight = 80 } = {}) {
  const routine = new app.WeeklyRoutine();
  if (program) routine.selection.applyProgram(app.PROGRAM_BY_ID.get(program));
  routine.sessionsPerWeek = sessions;
  routine.sessionMinutes = minutes;
  routine.nutrition.weight = weight;
  routine.nutrition.setGoal(goal);
  return { routine, n: routine.nutrition };
}

describe("recommendation from the plan", () => {
  test("planned training adds to the estimated burn, but never to a typed one", () => {
    const { routine, n } = planFor({ program: "full-body" });
    const load = n.load;
    expect(load.kcalPerDay).toBeGreaterThan(0);
    expect(n.burn).toBe(Math.round((n.baseBurn + load.kcalPerDay) / 50) * 50);

    routine.sessionsPerWeek = 6;
    expect(n.load.kcalPerDay).toBeGreaterThan(load.kcalPerDay);

    n.setBurn(2600);
    expect(n.burn).toBe(2600);
  });

  test("with no muscles chosen, no training is counted", () => {
    const { n } = planFor({ sessions: 5 });
    expect(n.load.kcalPerDay).toBe(0);
    expect(n.load.hours).toBe(0);
  });

  test("the plan reads the routine live: a new selection changes the targets", () => {
    const { routine, n } = planFor({ program: "shoulders-arms", goal: "gain" });
    const before = n.kcal;
    routine.selection.applyProgram(app.PROGRAM_BY_ID.get("full-body"));
    expect(n.kcal).toBeGreaterThan(before);
  });

  test("the more you train, the smaller the fat-loss deficit and the higher the protein", () => {
    const light = planFor({ program: "full-body", goal: "lose", sessions: 2 }).n;
    const hard  = planFor({ program: "full-body", goal: "lose", sessions: 6 }).n;
    expect(hard.adjust).toBeGreaterThan(light.adjust);
    expect(hard.adjust).toBeLessThan(0);
    expect(hard.proteinPerKg).toBeGreaterThan(light.proteinPerKg);
  });

  test("the muscle-gain surplus grows with how much of the body is trained", () => {
    const arms = planFor({ program: "shoulders-arms", goal: "gain" }).n;
    const full = planFor({ program: "full-body", goal: "gain" }).n;
    expect(full.adjust).toBeGreaterThan(arms.adjust);
    expect(arms.adjust).toBeGreaterThan(0);
  });

  test("every recommendation stays inside its goal's spans, however the week looks", () => {
    const extremes = [{ coverage: 0, load: 0 }, { coverage: 1, load: 1 },
                      { coverage: 0, load: 1 }, { coverage: 1, load: 0 }];
    for (const [key, g] of Object.entries(app.GOALS))
      for (const load of extremes) {
        const r = app.recommendTargets(key, load);
        expect(r.adjust).toBeGreaterThanOrEqual(Math.min(...g.adjust));
        expect(r.adjust).toBeLessThanOrEqual(Math.max(...g.adjust));
        expect(r.protein).toBeGreaterThanOrEqual(g.protein[0]);
        expect(r.protein).toBeLessThanOrEqual(g.protein[1]);
      }
  });

  test("the user's own targets survive training changes; a new goal takes its recommendation", () => {
    const { routine, n } = planFor({ program: "full-body", goal: "lose" });
    n.setAdjust(-0.25);
    n.setProtein(2.0);
    routine.sessionsPerWeek = 6;
    expect(n.adjust).toBe(-0.25);
    expect(n.proteinPerKg).toBe(2.0);
    expect(n.adjustIsRecommended).toBe(false);

    n.setGoal("gain");
    expect(n.adjustIsRecommended).toBe(true);
    expect(n.proteinIsRecommended).toBe(true);
    expect(n.adjust).toBe(n.recommended.adjust);
  });

  test("stepping back onto the recommendation follows it again", () => {
    const { n } = planFor({ program: "push", goal: "lose" });
    const rec = n.recommended.adjust;
    n.setAdjust(rec - 0.01);
    expect(n.adjustIsRecommended).toBe(false);
    n.setAdjust(n.adjust + 0.01);
    expect(n.adjustIsRecommended).toBe(true);
  });

  test("training time never exceeds what the chosen muscles' weekly sets take", () => {
    // Push is about 95 min of sets a week: fourteen 90-minute sessions can't burn 21 hours.
    const { routine, n } = planFor({ program: "push", goal: "lose", sessions: 14, minutes: 90 });
    const sets = routine.selectedMuscles().reduce((t, m) => t + m.weeklySets[1], 0);
    const cap = (sets * app.ESTIMATE.minutesPerSet + 14 * app.ESTIMATE.warmupMinutes) / 60;
    expect(n.load.hours).toBeCloseTo(cap, 5);
    expect(n.load.hours).toBeLessThan(14 * 90 / 60);
    expect(n.adjust).toBeLessThan(0);
    expect(n.kcal).toBeLessThan(n.burn);
  });

  test("the hours stay close to what the generated workouts hold", () => {
    for (const program of ["push", "full-body", "shoulders-arms"]) {
      const { routine, n } = planFor({ program, sessions: 6, minutes: 90 });
      routine.generate();
      const built = routine.sessions.reduce((t, s) => t + s.workout.minutes, 0) / 60;
      expect(n.load.hours).toBeGreaterThanOrEqual(built * 0.8);
      expect(n.load.hours).toBeLessThanOrEqual(built * 2);
    }
  });

  test("muscles with no exercises yet add no training", () => {
    const { routine, n } = planFor({ program: "full-body" });
    const bare = app.MUSCLES.filter(m => !app.exercisesFor(m.id).length);
    if (!bare.length) return;          // nothing to check once the database covers every muscle
    routine.selection.clear();
    for (const m of bare) routine.selection.set(m.id, true);
    expect(n.load.kcalPerDay).toBe(0);
    expect(n.load.muscles.length).toBe(0);
  });

  test("a kept setting the recommendation moves onto reads as recommended", () => {
    const { routine, n } = planFor({ program: "full-body", goal: "lose", weight: 95 });
    n.setAdjust(n.recommended.adjust + 0.01);
    expect(n.adjustIsRecommended).toBe(false);
    for (let s = 1; s <= 14 && !n.adjustIsRecommended; s++) routine.sessionsPerWeek = s;
    expect(n.adjustIsRecommended).toBe(true);
  });

  test("picking the goal that is already chosen keeps the user's targets", () => {
    const { n } = planFor({ program: "push", goal: "lose" });
    n.setProtein(2.9);
    n.setGoal("lose");
    expect(n.proteinPerKg).toBe(2.9);
  });

  test("the user's targets are held to a sane range", () => {
    n.setAdjust(-0.9);  expect(n.adjust).toBe(app.ADJUST_RANGE[0]);
    n.setAdjust(0.9);   expect(n.adjust).toBe(app.ADJUST_RANGE[1]);
    n.setProtein(10);   expect(n.proteinPerKg).toBe(app.PROTEIN_PER_KG_RANGE[1]);
    n.setProtein(0);    expect(n.proteinPerKg).toBe(app.PROTEIN_PER_KG_RANGE[0]);
  });
});

describe("meals", () => {
  test("meals are spread over the window, in order, one hour each", () => {
    for (const count of app.MEAL_COUNTS) {
      n.setMealCount(count);
      const hours = n.hours;
      expect(hours.length).toBe(count);
      expect(hours[0]).toBe(n.firstMeal);
      expect(hours[hours.length - 1]).toBe(n.lastMeal);
      for (let i = 1; i < hours.length; i++) expect(hours[i]).toBeGreaterThan(hours[i - 1]);
    }
  });

  test("a window too tight for the meals is widened", () => {
    n.setMealCount(6);
    n.setWindow(12, 14);
    expect(n.lastMeal - n.firstMeal).toBeGreaterThanOrEqual(5);
    expect(new Set(n.hours).size).toBe(6);
  });

  test("a moved meal stays between its neighbours", () => {
    n.setMealCount(3);               // 8am, 2pm, 8pm
    n.moveMeal(1, 23);
    expect(n.hours[1]).toBe(19);
    n.moveMeal(1, 6);
    expect(n.hours[1]).toBe(9);
  });

  test("meal calories add up to the day, give or take rounding", () => {
    for (const count of app.MEAL_COUNTS) {
      n.setMealCount(count);
      const sum = n.meals.reduce((t, m) => t + m.kcal, 0);
      expect(Math.abs(sum - n.kcal)).toBeLessThanOrEqual(10 * count);
    }
  });
});

describe("example meals", () => {
  test("ideas respect the diet style", () => {
    n.setMealCount(5);
    for (const diet of Object.keys(app.DIETS))
      for (const meal of n.meals)
        for (const p of app.mealIdeasFor(meal, diet))
          expect(p.foods.every(([id]) => app.DIETS[diet].allows.includes(app.FOODS[id].kind))).toBe(true);
  });

  test("portions scale toward the meal's calories, within half to double", () => {
    const idea = app.MEAL_IDEAS.find(i => i.name === "Chicken, rice & veg");
    const base = app.totals(idea.foods).kcal;
    const small = app.portionIdea(idea, base * 0.8);
    expect(Math.abs(small.kcal - base * 0.8)).toBeLessThan(base * 0.1);
    const huge = app.portionIdea(idea, base * 10);
    expect(huge.kcal).toBeLessThanOrEqual(base * 2.1);
  });
});
