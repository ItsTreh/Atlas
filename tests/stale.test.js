/* When the week on screen stops answering what was asked. inputsKey() is
   what a week is planned from; mealsKey() is what its calendar's meals show.
   app.js compares both with the values at Generate. */
import { describe, expect, test } from "vitest";
import { loadApp, generatedWeek } from "./load-app.js";

const app = loadApp();
const keys = r => ({ inputs: r.inputsKey(), meals: r.mealsKey() });

describe("a generated week goes stale", () => {
  test.each([
    ["experience", r => { r.experience = "advanced"; }],
    ["a muscle's priority", r => r.selection.setPriority("chest", "focus")],
    ["the muscles", r => r.selection.set("abs", true)],
    ["the training days", r => { r.sessionsPerWeek = 2; }],
    ["the session length", r => { r.sessionMinutes = 90; }],
    ["the split", r => { r.split = "upper-lower"; }],
    ["a day off", r => { r.offDays = new Set(["SAT"]); }],
    ["the preferred window", r => { r.preferredWindow = "morning"; }],
    ["the meal times", r => r.nutrition.setWindow(7, 19)]
  ])("when %s changes", (_, change) => {
    const { routine } = generatedWeek(app, { program: "upper", sessions: 3 });
    const before = keys(routine);
    change(routine);
    expect(routine.inputsKey()).not.toBe(before.inputs);
  });

  test("not when the user removes a session, though the meals then fuel a day less", () => {
    const { routine } = generatedWeek(app, { program: "upper", sessions: 3 });
    const before = keys(routine);
    routine.removeSession(routine.sessions[0]);
    expect(routine.inputsKey()).toBe(before.inputs);
    expect(routine.mealsKey()).not.toBe(before.meals);
  });

  test("not when hours are painted busy: painting over a session edits the week", () => {
    const { routine } = generatedWeek(app, { program: "upper", sessions: 3 });
    const before = keys(routine);
    routine.markBusy("TUE", 7);
    expect(routine.inputsKey()).toBe(before.inputs);
  });

  test("a new goal changes the meals, not the training", () => {
    const { routine } = generatedWeek(app, { program: "upper", sessions: 3 });
    const before = keys(routine);
    routine.nutrition.setGoal("gain");
    expect(routine.inputsKey()).toBe(before.inputs);
    expect(routine.mealsKey()).not.toBe(before.meals);
  });

  test("the planner's cache follows the same inputs", () => {
    const { routine } = generatedWeek(app, { program: "upper", sessions: 3 });
    const plan = routine.weekPlan(routine.experience);
    expect(routine.weekPlan(routine.experience)).toBe(plan);
    routine.selection.setPriority("chest", "focus");
    expect(routine.weekPlan(routine.experience)).not.toBe(plan);
  });
});
