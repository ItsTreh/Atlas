/* ===========================================================================
   Weekly Gym Routine Planner — v2

   What changed from v1: sessions are built from SPECIFIC MUSCLES rather than
   fixed splits. The user picks muscles; the app packs them into blocks that
   fit the chosen session length, and a block may span more than one hour.
   Recovery is now per muscle instead of per split. Meals are placed on the
   same grid.
   ========================================================================= */

const SlotState = Object.freeze({
  FREE: "FREE", BUSY: "BUSY", WORKOUT: "WORKOUT", MEAL: "MEAL"
});

const DayOfWeek = Object.freeze({
  values: ["MON","TUE","WED","THU","FRI","SAT","SUN"],
  label: { MON:"Mon", TUE:"Tue", WED:"Wed", THU:"Thu", FRI:"Fri", SAT:"Sat", SUN:"Sun" },
  indexOf(d) { return DayOfWeek.values.indexOf(d); },
  /** Calendar distance in days. Recovery is written against this. */
  distance(a, b) { return Math.abs(DayOfWeek.indexOf(a) - DayOfWeek.indexOf(b)); }
});

const FIRST_HOUR = 6;
const LAST_HOUR  = 23;

/* --------------------------------------------------------------------------
   Muscles. `minutes` is how much of a session the muscle eats; `recoveryDays`
   is how many days must pass before it can be trained again. Big compound
   muscles get 2, small ones get 1 — that difference is the whole reason for
   modelling muscles individually instead of lumping them into splits.
   -------------------------------------------------------------------------- */

const FAMILIES = {
  push: { name: "Push",  css: "push" },
  pull: { name: "Pull",  css: "pull" },
  legs: { name: "Legs",  css: "legs" },
  core: { name: "Core",  css: "core" }
};

class Muscle {
  constructor(name, family, minutes, recoveryDays) {
    this.name = name; this.family = family;
    this.minutes = minutes; this.recoveryDays = recoveryDays;
    this.selected = true;
  }
}

const MUSCLE_SEED = [
  ["Chest",      "push", 20, 2],
  ["Shoulders",  "push", 15, 2],
  ["Triceps",    "push", 15, 1],
  ["Upper Back", "pull", 20, 2],
  ["Lats",       "pull", 20, 2],
  ["Biceps",     "pull", 15, 1],
  ["Forearms",   "pull", 10, 1],
  ["Quads",      "legs", 25, 2],
  ["Hamstrings", "legs", 20, 2],
  ["Glutes",     "legs", 20, 2],
  ["Calves",     "legs", 10, 1],
  ["Abs",        "core", 15, 1]
];

/** A set of muscles trained together in one session. Derived, disposable. */
class TrainingBlock {
  constructor(muscles) {
    this.muscles = muscles;
    this.family = muscles[0].family;
  }
  get minutes() { return this.muscles.reduce((t, m) => t + m.minutes, 0); }
  get durationHours() { return Math.max(1, Math.ceil(this.minutes / 60)); }
  get label() { return this.muscles.map(m => m.name).join(" · "); }
  get css() { return FAMILIES[this.family].css; }
  has(muscle) { return this.muscles.includes(muscle); }
  freeMinutes(limit) { return limit - this.minutes; }
}

class TimeSlot {
  constructor(day, hour) {
    this.day = day; this.hour = hour;
    this.state = SlotState.FREE; this.session = null; this.meal = null;
  }
  isFree() { return this.state === SlotState.FREE; }
  markBusy() { this.session = null; this.meal = null; this.state = SlotState.BUSY; }
  release()  { this.session = null; this.meal = null; this.state = SlotState.FREE; }
  assignTo(session) { this.meal = null; this.session = session; this.state = SlotState.WORKOUT; }
  assignMeal(meal)  { this.session = null; this.meal = meal; this.state = SlotState.MEAL; }
}

class WorkoutSession {
  constructor(id, day, startHour, block) {
    this.id = id; this.day = day; this.startHour = startHour; this.block = block;
    this.durationHours = block.durationHours;
  }
  endHour() { return this.startHour + this.durationHours; }
  trains(muscle) { return this.block.has(muscle); }
}

class PlannedMeal {
  constructor(id, day, hour, name, kcal, protein, focus) {
    this.id = id; this.day = day; this.hour = hour;
    this.name = name; this.kcal = kcal; this.protein = protein; this.focus = focus;
  }
}

/* Windows of the day the user can say they prefer to train in. */
const WINDOWS = {
  any:     { label: "Whenever", from: FIRST_HOUR, to: LAST_HOUR + 1 },
  morning: { label: "Morning",  from: 6,  to: 11 },
  midday:  { label: "Midday",   from: 11, to: 16 },
  evening: { label: "Evening",  from: 16, to: 23 }
};

class FreeBlock {
  constructor(day, startHour, length) {
    this.day = day; this.startHour = startHour; this.length = length;
  }
  get endHour() { return this.startHour + this.length; }
  fits(hours) { return this.length >= hours; }

  /**
   * Where a session of `hours` should start inside this block, given the
   * preferred window. If the block reaches into the window, the session starts
   * at the first hour of the overlap; otherwise it starts at the block start.
   */
  startFor(hours, window) {
    const w = WINDOWS[window] || WINDOWS.any;
    const from = Math.max(this.startHour, w.from);
    const latest = this.endHour - hours;
    if (from <= latest && from < w.to) return from;
    return this.startHour;
  }
  /** True when any part of the block falls inside the preferred window. */
  touches(window, hours) {
    const w = WINDOWS[window] || WINDOWS.any;
    const start = this.startFor(hours, window);
    return start >= w.from && start < w.to;
  }
}
