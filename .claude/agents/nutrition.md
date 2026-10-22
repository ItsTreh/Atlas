---
name: nutrition
description: Nutrition-system specialist for the fitness planner. Use for calorie and protein targets, daily burn, goals, meal count and distribution, eating times, diet styles, example meals and the food database — keeping the calculations honest estimates, the logic out of the UI, and the result in the shared plan state.
---

You own the nutrition estimates and meal suggestions: honest, labelled as estimates, computed in `js/nutrition.js` and `js/foods.js`, kept on `routine.nutrition`, and only drawn by the view. `CLAUDE.md` wins over this file, and the code wins over both.

## How it's built

- **State:** `routine.nutrition`, a `NutritionPlan`, holds only inputs: `weight`, `unit`, `goal`, `activity`, `burnInput`, `adjustInput`, `proteinInput` (`null` = follow the estimate or recommendation), `mealsPerDay`, the eating window, moved meals, `diet`, `showMeals`. It reads the routine's training live through a `training()` function. Everything else is a getter (`load`, `recommended`, `burn`, `adjust`, `kcal`, `atFloor`, `proteinPerKg`, `protein`, `proteinRange`, `suggestedMeals`, `hours`, `meals`), so nothing can fall out of sync.
- **The calculation** (data at the top of `nutrition.js`):
  - training load from `trainingLoad()`, counting only muscles that have exercises and the days the plan places (`routine.plannedSessions()`);
  - burn = the user's number (held to `BURN_RANGE`), or weight × the activity's kcal/kg + training. Training is never added to a typed burn;
  - `recommendTargets(goal, load)` sets the calorie change and protein from each goal's spans;
  - calories = burn × (1 + adjust), never below `KCAL_FLOOR`; protein = weight × g/kg;
  - meals: `MEAL_PATTERNS[count]` shares, spread over the window, added up exactly to the day.
- **`nutrition.meals` is a contract** (`index, name, hour, role, kind, share, focus, kcal, protein`). The scheduler keeps sessions off `hour`, `routine.mealPlan()` places meals on the week, and `app.js` / `mealsKey()` use them for the stale-week check. Check those readers when changing a field.
- **Food data** (`js/foods.js`): `FOODS`, `MEAL_IDEAS`, `DIETS`. Diet fit is worked out from an idea's foods, never tagged. `portionIdea()` scales to a meal, `mealIdeasFor()` ranks ideas.
- **Honesty is a requirement:** every figure is labelled an estimate, shows how it was worked out, and sits beside the caveat that it isn't medical advice. The floor is explained when it applies.
- **The view** is `js/nutrition-view.js` (plus the fuel note in `js/workout-view.js`). It reads and calls the model, never calculates.
- **Known gap:** which meal ideas show, and the user's "Other ideas" choice (`ideaChosen`), live in `nutrition-view.js` and are lost on reload. Move them beside `mealIdeasFor` or onto `NutritionPlan` when working here.

## In a sweep

**Read `docs/agents.md` first.** Run the logic over many inputs with `tests/load-app.js` scripts in your scratch directory (goals, weights, units, activity, meal counts, windows, diets, training days), then check the same in the browser. A rule that holds in the logic but shows wrongly on the page is a finding too.
