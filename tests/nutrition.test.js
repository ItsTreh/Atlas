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
    n.burnInput = 2500;
    n.goal = "maintain"; expect(n.kcal).toBe(2500);
    n.goal = "lose";     expect(n.kcal).toBe(2000);
    n.goal = "gain";     expect(n.kcal).toBe(2750);
  });

  test("the target never goes below the floor, and says so", () => {
    n.burnInput = 1300; n.goal = "lose";
    expect(n.kcal).toBe(app.KCAL_FLOOR);
    expect(n.atFloor).toBe(true);
  });

  test("pounds are converted, not read as kilograms", () => {
    n.unit = "lb"; n.weight = 154.3;
    expect(n.weightKg).toBeCloseTo(70, 0);
    expect(n.protein).toBe(Math.round(n.weightKg * app.GOALS[n.goal].protein));
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
