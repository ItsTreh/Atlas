/* What a reload brings back. Stored data may be old, from another version
   or edited by hand: restore() takes only values the controls could have set,
   so one bad field keeps its default instead of breaking a stage. */
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp();
const json = x => JSON.parse(JSON.stringify(x));

function edited() {
  const r = new app.WeeklyRoutine();
  r.selection.applyProgram(app.PROGRAM_BY_ID.get("upper"));
  r.selection.setPriority("chest", "focus");
  Object.assign(r.nutrition, { weight: 95, goal: "lose", activity: "intense", diet: "vegetarian" });
  r.nutrition.setMealCount(4);
  r.nutrition.moveMeal(3, 21);
  r.sessionsPerWeek = 3; r.sessionMinutes = 75; r.split = "upper-lower";
  r.preferredWindow = "morning"; r.experience = "intermediate";
  r.offDays = new Set(["WED"]);
  r.markBusy("MON", 9); r.markBusy("TUE", 10);
  r.generate();
  return r;
}

describe("restore", () => {
  test("a stored routine comes back whole, week included", () => {
    const r = edited();
    const back = new app.WeeklyRoutine();
    back.restore(json(r.snapshot()));
    expect(back.snapshot()).toEqual(r.snapshot());
    const week = x => x.sessions.map(s => [s.day, s.startHour, s.workout.entries.map(e => e.exercise.id)]);
    expect(week(back)).toEqual(week(r));
  });

  test.each([
    ["sessionsPerWeek", "abc"], ["sessionsPerWeek", 12], ["sessionsPerWeek", -3],
    ["sessionMinutes", "long"], ["sessionMinutes", 37], ["preferredWindow", "night"],
    ["split", "__proto__"], ["split", "toString"], ["offDays", "Mon"], ["offDays", 5],
    ["busy", 7], ["busy", [["XYZ", 9], ["MON", 99], "MON"]], ["hadPlan", "yes"], ["selection", 3]
  ])("%s = %j keeps the default", (key, value) => {
    const snap = json(edited().snapshot());
    const fresh = new app.WeeklyRoutine().snapshot();
    const r = new app.WeeklyRoutine();
    expect(() => r.restore({ ...snap, [key]: value })).not.toThrow();
    const back = r.snapshot();
    if (key === "busy") expect(back.busy).toEqual([]);
    else if (key === "hadPlan") expect(back.hadPlan).toBe(false);
    else if (key === "selection") expect(back.selection.muscleIds).toEqual([]);
    else expect(back[key]).toEqual(fresh[key]);
    expect(() => r.weekPlan && r.weekPlan()).not.toThrow();
    expect(() => r.generate()).not.toThrow();
  });

  test.each([
    ["goal", "cut"], ["activity", "lightly-active"], ["diet", "keto"], ["unit", "stone"],
    ["weight", "heavy"], ["burnInput", "2000"], ["adjustInput", 5], ["proteinInput", 99],
    ["mealsPerDay", 0], ["firstMeal", "8"], ["moved", { 0: "x", 9: 12 }], ["moved", { 1: 2 }],
    ["showMeals", "no"]
  ])("nutrition %s = %j never breaks the figures", (key, value) => {
    const r = new app.WeeklyRoutine();
    r.selection.applyProgram(app.PROGRAM_BY_ID.get("push"));
    r.restore({ ...json(r.snapshot()), nutrition: { ...r.nutrition.snapshot(), [key]: value } });
    const n = r.nutrition;
    expect(Object.hasOwn(app.GOALS, n.goal) && Object.hasOwn(app.ACTIVITY_LEVELS, n.activity) &&
           Object.hasOwn(app.DIETS, n.diet)).toBe(true);
    expect(Number.isFinite(n.kcal) && Number.isFinite(n.protein)).toBe(true);
    expect(n.meals.every(m => Number.isInteger(m.hour) && Number.isFinite(m.kcal))).toBe(true);
    expect(n.adjust).toBeGreaterThanOrEqual(app.ADJUST_RANGE[0]);
    expect(n.adjust).toBeLessThanOrEqual(app.ADJUST_RANGE[1]);
    expect(() => r.generate()).not.toThrow();
  });

  test("moved meals come back as they were, even when moving one at a time could not place them", () => {
    const n = new app.NutritionPlan();
    n.moveMeal(2, 21); n.moveMeal(1, 20);           // dinner first, then lunch into its old hour
    const back = new app.NutritionPlan();
    back.restore(json(n.snapshot()));
    expect(back.hours).toEqual(n.hours);
  });
});

test("a snapshot from a newer version is left alone, not read as this one", () => {
  const r = new app.WeeklyRoutine();
  r.restore({ version: 2, sessionsPerWeek: 2, selection: { muscleIds: ["chest"] } });
  expect(r.snapshot()).toEqual(new app.WeeklyRoutine().snapshot());
});
