/* --------------------------------------------------------------------------
   Nutrition. Deliberately a light model: body weight and goal drive daily
   calories and protein, and the meal times are recommendations, not a
   prescription. Anything more would need age, height, sex and activity level,
   and would still be an estimate.
   -------------------------------------------------------------------------- */

const GOALS = {
  lose:     { label: "Lose fat",     kcalPerKg: 28, proteinPerKg: 2.2 },
  maintain: { label: "Maintain",     kcalPerKg: 33, proteinPerKg: 1.8 },
  gain:     { label: "Build muscle", kcalPerKg: 38, proteinPerKg: 2.0 }
};

/* Recommended clock times and the share of the day's calories each meal takes. */
const MEAL_PLANS = {
  3: [
    { name: "Breakfast", hour: 8,  share: .30, focus: "Protein + slow carbs" },
    { name: "Lunch",     hour: 13, share: .40, focus: "Protein + carbs + veg" },
    { name: "Dinner",    hour: 20, share: .30, focus: "Protein + veg + fats" }
  ],
  4: [
    { name: "Breakfast", hour: 8,  share: .27, focus: "Protein + slow carbs" },
    { name: "Lunch",     hour: 13, share: .33, focus: "Protein + carbs + veg" },
    { name: "Snack",     hour: 17, share: .13, focus: "Protein + fruit" },
    { name: "Dinner",    hour: 20, share: .27, focus: "Protein + veg + fats" }
  ],
  5: [
    { name: "Breakfast",   hour: 7,  share: .22, focus: "Protein + slow carbs" },
    { name: "Mid-morning", hour: 10, share: .13, focus: "Protein + fruit" },
    { name: "Lunch",       hour: 13, share: .30, focus: "Protein + carbs + veg" },
    { name: "Afternoon",   hour: 17, share: .13, focus: "Protein + nuts" },
    { name: "Dinner",      hour: 20, share: .22, focus: "Protein + veg + fats" }
  ]
};

class NutritionPlan {
  constructor() {
    this.weight = 70; this.unit = "kg"; this.goal = "maintain";
    this.mealsPerDay = 3; this.showMeals = true;
  }
  get weightKg() { return this.unit === "lb" ? this.weight * 0.45359237 : this.weight; }
  get kcal()    { return Math.round(this.weightKg * GOALS[this.goal].kcalPerKg / 10) * 10; }
  get protein() { return Math.round(this.weightKg * GOALS[this.goal].proteinPerKg); }
  get meals() {
    const plan = MEAL_PLANS[this.mealsPerDay] || MEAL_PLANS[3];
    return plan.map(m => ({
      ...m,
      kcal:    Math.round(this.kcal * m.share / 10) * 10,
      protein: Math.round(this.protein * m.share)
    }));
  }
  isValid() { return this.weightKg >= 30 && this.weightKg <= 250; }
}
