/* ===========================================================================
   Food database — data only, no page code.

     FOODS       single foods: calories and protein per 100 g, what kind of
                 food it is (for diet filtering), and an optional everyday
                 unit ("egg", "slice") to show amounts in.
     MEAL_IDEAS  example meals built from FOODS at a base portion. The page
                 scales the whole portion to the calories a meal should have.
     DIETS       which kinds of food each diet style allows.

   A meal idea's diet fit is worked out from its foods, never tagged by
   hand: add tofu to a recipe and it stays vegan; add cheese and it doesn't.

   Values are typical per-100 g figures, rounded — good enough to build a
   plate from, not a food label.

   To add a food: add a FOODS entry. To add a meal: add a MEAL_IDEAS entry
   using food ids. Unknown ids are reported in the console at load.
   ========================================================================= */

/* Kinds of food. A diet style is the set of kinds it allows. */
const DIETS = {
  any:         { label: "Everything",  allows: ["meat", "fish", "egg", "dairy", "plant"] },
  pescatarian: { label: "Pescatarian", allows: ["fish", "egg", "dairy", "plant"] },
  vegetarian:  { label: "Vegetarian",  allows: ["egg", "dairy", "plant"] },
  vegan:       { label: "Vegan",       allows: ["plant"] }
};

const FOODS = {
  //                      name                      kind     kcal  protein  unit
  "chicken":        f("Chicken breast, cooked",   "meat",  165, 31),
  "beef-mince":     f("Lean beef mince, cooked",  "meat",  175, 26),
  "salmon":         f("Salmon, cooked",           "fish",  206, 22),
  "tuna":           f("Tuna, canned in water",    "fish",  116, 26),
  "eggs":           f("Eggs",                     "egg",   143, 13,  ["egg", 50]),
  "egg-whites":     f("Egg whites",               "egg",    52, 11),
  "greek-yogurt":   f("Greek yogurt, 0% fat",     "dairy",  59, 10),
  "cottage-cheese": f("Cottage cheese, low fat",  "dairy",  72, 12),
  "milk":           f("Semi-skimmed milk",        "dairy",  50, 3.5),
  "cheese":         f("Cheddar",                  "dairy", 403, 25),
  "whey":           f("Whey protein",             "dairy", 400, 80,  ["scoop", 30]),
  "tofu":           f("Firm tofu",                "plant", 144, 16),
  "tempeh":         f("Tempeh",                   "plant", 192, 20),
  "lentils":        f("Lentils, cooked",          "plant", 116, 9),
  "chickpeas":      f("Chickpeas, cooked",        "plant", 164, 9),
  "black-beans":    f("Black beans, cooked",      "plant", 132, 9),
  "pea-protein":    f("Pea protein",              "plant", 380, 78,  ["scoop", 30]),
  "soy-milk":       f("Soy milk, unsweetened",    "plant",  33, 3.3),
  "soy-yogurt":     f("Soy yogurt, plain",        "plant",  50, 4),
  "oats":           f("Oats",                     "plant", 380, 13),
  "rice":           f("Rice, cooked",             "plant", 130, 2.7),
  "potatoes":       f("Potatoes, boiled",         "plant",  87, 1.9),
  "pasta":          f("Wholewheat pasta, cooked", "plant", 150, 6),
  "quinoa":         f("Quinoa, cooked",           "plant", 120, 4.4),
  "bread":          f("Wholegrain bread",         "plant", 250, 12,  ["slice", 40]),
  "wrap":           f("Tortilla wrap",            "plant", 310, 8,   ["wrap", 60]),
  "banana":         f("Banana",                   "plant",  89, 1.1, ["banana", 120]),
  "berries":        f("Berries",                  "plant",  50, 1),
  "apple":          f("Apple",                    "plant",  52, 0.3, ["apple", 180]),
  "veg":            f("Mixed vegetables",         "plant",  40, 2),
  "broccoli":       f("Broccoli",                 "plant",  35, 2.4),
  "avocado":        f("Avocado",                  "plant", 160, 2),
  "olive-oil":      f("Olive oil",                "plant", 884, 0),
  "peanut-butter":  f("Peanut butter",            "plant", 588, 25),
  "almonds":        f("Almonds",                  "plant", 579, 21),
  "hummus":         f("Hummus",                   "plant", 166, 8)
};

function f(name, kind, kcal, protein, unit) {
  return { name, kind, kcal, protein, unit: unit ? { name: unit[0], grams: unit[1] } : null };
}

/*
 * Example meals. `kinds` are the meal kinds an idea suits (breakfast, main,
 * snack — see MEAL_FOCUS in nutrition.js); `foods` are [food id, grams] at a
 * base portion. `fixed` foods keep their amount when the portion is scaled:
 * a meal twice the size does not need twice the cooking oil.
 */
const MEAL_IDEAS = [
  // breakfasts
  { name: "Greek yogurt bowl",   kinds: ["breakfast", "snack"],
    foods: [["greek-yogurt", 250], ["oats", 40], ["berries", 100], ["almonds", 15]] },
  { name: "Eggs on toast",       kinds: ["breakfast"],
    foods: [["eggs", 150], ["bread", 80], ["avocado", 50]] },
  { name: "Protein oats",        kinds: ["breakfast"],
    foods: [["oats", 70], ["milk", 250], ["whey", 30], ["banana", 120]] },
  { name: "Tofu scramble",       kinds: ["breakfast"],
    foods: [["tofu", 200], ["bread", 80], ["veg", 100], ["olive-oil", 5]], fixed: ["olive-oil"] },
  { name: "Vegan protein oats",  kinds: ["breakfast"],
    foods: [["oats", 70], ["soy-milk", 250], ["pea-protein", 30], ["berries", 100]] },
  { name: "Cottage cheese toast", kinds: ["breakfast"],
    foods: [["cottage-cheese", 200], ["bread", 80], ["berries", 80]] },

  // main meals
  { name: "Chicken, rice & veg",       kinds: ["main"],
    foods: [["chicken", 150], ["rice", 200], ["veg", 150], ["olive-oil", 10]], fixed: ["olive-oil"] },
  { name: "Salmon, potatoes & greens", kinds: ["main"],
    foods: [["salmon", 150], ["potatoes", 250], ["broccoli", 150]] },
  { name: "Beef & bean chilli",        kinds: ["main"],
    foods: [["beef-mince", 150], ["black-beans", 100], ["rice", 150], ["veg", 100]] },
  { name: "Tuna pasta",                kinds: ["main"],
    foods: [["tuna", 120], ["pasta", 200], ["veg", 100], ["olive-oil", 10]], fixed: ["olive-oil"] },
  { name: "Lentil & chickpea curry",   kinds: ["main"],
    foods: [["lentils", 200], ["chickpeas", 100], ["rice", 150], ["veg", 100]] },
  { name: "Tofu stir-fry",             kinds: ["main"],
    foods: [["tofu", 200], ["rice", 200], ["veg", 150], ["olive-oil", 10]], fixed: ["olive-oil"] },
  { name: "Tempeh quinoa bowl",        kinds: ["main"],
    foods: [["tempeh", 150], ["quinoa", 200], ["veg", 100], ["avocado", 50]] },
  { name: "Veg omelette & potatoes",   kinds: ["main", "breakfast"],
    foods: [["eggs", 200], ["veg", 150], ["potatoes", 200], ["cheese", 20]] },
  { name: "Chicken wrap",              kinds: ["main"],
    foods: [["chicken", 120], ["wrap", 60], ["hummus", 40], ["veg", 100]] },

  // snacks
  { name: "Cottage cheese & fruit",  kinds: ["snack"],
    foods: [["cottage-cheese", 200], ["berries", 100]] },
  { name: "Protein shake & banana",  kinds: ["snack"],
    foods: [["whey", 30], ["milk", 300], ["banana", 120]] },
  { name: "Vegan shake & banana",    kinds: ["snack"],
    foods: [["pea-protein", 30], ["soy-milk", 300], ["banana", 120]] },
  { name: "Hummus wrap",             kinds: ["snack"],
    foods: [["wrap", 60], ["hummus", 60], ["veg", 100]] },
  { name: "Apple & peanut butter",   kinds: ["snack"],
    foods: [["apple", 180], ["peanut-butter", 25]] },
  { name: "Soy yogurt & almonds",    kinds: ["snack", "breakfast"],
    foods: [["soy-yogurt", 250], ["almonds", 20], ["berries", 80]] },
  { name: "Egg whites & toast",      kinds: ["snack"],
    foods: [["egg-whites", 200], ["bread", 40]] }
];

/* ============================== the index ================================ */

(function checkFoods() {
  const problem = msg => console.error("Food data: " + msg);
  const kinds = new Set(Object.values(DIETS).flatMap(d => d.allows));
  for (const [id, food] of Object.entries(FOODS))
    if (!kinds.has(food.kind)) problem(id + " has unknown kind " + food.kind);
  for (const idea of MEAL_IDEAS)
    for (const [id] of idea.foods)
      if (!FOODS[id]) problem("\"" + idea.name + "\" uses unknown food " + id);
})();

/** Calories and protein of a list of [food id, grams]. */
function totals(foods) {
  return foods.reduce((t, [id, g]) => ({
    kcal:    t.kcal + FOODS[id].kcal * g / 100,
    protein: t.protein + FOODS[id].protein * g / 100
  }), { kcal: 0, protein: 0 });
}

/** True when every food in the idea is allowed by the diet style. */
function fitsDiet(idea, diet) {
  const allows = DIETS[diet].allows;
  return idea.foods.every(([id]) => allows.includes(FOODS[id].kind));
}

/**
 * The idea resized to about `kcal`, amounts rounded to something you could
 * actually measure. Portions stay within half to double the base, so a
 * meal never becomes a thimble or a trough; the returned calories are what
 * the rounded portion really comes to.
 */
function portionIdea(idea, kcal) {
  const fixed = new Set(idea.fixed || []);
  const fixedKcal = totals(idea.foods.filter(([id]) => fixed.has(id))).kcal;
  const scalable = totals(idea.foods.filter(([id]) => !fixed.has(id))).kcal;
  const scale = Math.min(2, Math.max(0.5, (kcal - fixedKcal) / scalable));

  const foods = idea.foods.map(([id, g]) => {
    const food = FOODS[id];
    let grams = fixed.has(id) ? g : g * scale;
    if (food.unit) grams = Math.max(1, Math.round(grams / food.unit.grams)) * food.unit.grams;
    else grams = Math.max(5, Math.round(grams / (grams >= 100 ? 10 : 5)) * (grams >= 100 ? 10 : 5));
    return [id, grams];
  });
  const t = totals(foods);
  return { idea, foods, kcal: Math.round(t.kcal / 10) * 10, protein: Math.round(t.protein) };
}

/** "3 eggs", "2 slices", "150 g" — how to show an amount of a food. */
function amountLabel(id, grams) {
  const unit = FOODS[id].unit;
  if (!unit) return grams + " g";
  const n = Math.round(grams / unit.grams);
  return n + " " + unit.name + (n === 1 ? "" : "s");
}

/**
 * Example meals for one meal of the day, best first: ideas of the right
 * kind and diet, portioned to its calories, ranked by how close they land
 * to its protein target. `avoid` holds ideas already shown for another meal
 * today, which drop behind the rest so the day is not the same plate twice.
 */
function mealIdeasFor(meal, diet, avoid = new Set()) {
  return MEAL_IDEAS
    .filter(idea => idea.kinds.includes(meal.kind) && fitsDiet(idea, diet))
    .map(idea => portionIdea(idea, meal.kcal))
    .sort((a, b) =>
      (avoid.has(a.idea) - avoid.has(b.idea)) ||
      (Math.abs(a.protein - meal.protein) + Math.abs(a.kcal - meal.kcal) / 25) -
      (Math.abs(b.protein - meal.protein) + Math.abs(b.kcal - meal.kcal) / 25));
}
