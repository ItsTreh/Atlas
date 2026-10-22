/* ===========================================================================
   The core data: the week's time slots, the muscles, training blocks (the
   muscles one session trains) and the sessions and meals placed on the
   grid. Sessions are built from the muscles the user picks, recovery is per
   muscle, and a session may span more than one hour.
   ========================================================================= */

const SlotState = Object.freeze({
  FREE: "FREE", BUSY: "BUSY", WORKOUT: "WORKOUT", MEAL: "MEAL"
});

const DayOfWeek = Object.freeze({
  values: ["MON","TUE","WED","THU","FRI","SAT","SUN"],
  label: { MON:"Mon", TUE:"Tue", WED:"Wed", THU:"Thu", FRI:"Fri", SAT:"Sat", SUN:"Sun" },
  name:  { MON:"Monday", TUE:"Tuesday", WED:"Wednesday", THU:"Thursday", FRI:"Friday",
           SAT:"Saturday", SUN:"Sunday" },
  indexOf(d) { return DayOfWeek.values.indexOf(d); },
  /**
   * Days between two weekdays, the short way round. The week repeats, so
   * Sunday and next Monday are 1 day apart, not 6. Recovery is written
   * against this.
   */
  distance(a, b) {
    const d = Math.abs(DayOfWeek.indexOf(a) - DayOfWeek.indexOf(b));
    return Math.min(d, 7 - d);
  }
});

const FIRST_HOUR = 6;
const LAST_HOUR  = 23;

/* --------------------------------------------------------------------------
   Muscles. `minutes` is how much of a session the muscle eats; `recoveryDays`
   is how many days must pass before it can be trained again. Big compound
   muscles get 2, small ones get 1 — that difference is the whole reason for
   modelling muscles individually instead of lumping them into splits.

   `weeklySets` is the range of hard sets a week the muscle is usually given
   for growth: large muscles take the most direct work, small ones need less
   because the compound lifts already train them. Only the progress estimate
   reads it (see estimate.js).

   The `id` is the stable key every other system uses — the anatomy figure,
   the programs, the selection. Names are for display and may change.
   -------------------------------------------------------------------------- */

const FAMILIES = {
  push: { name: "Push",  css: "push" },
  pull: { name: "Pull",  css: "pull" },
  legs: { name: "Legs",  css: "legs" },
  core: { name: "Core",  css: "core" }
};

class Muscle {
  constructor(id, name, family, minutes, recoveryDays, weeklySets) {
    this.id = id; this.name = name; this.family = family;
    this.minutes = minutes; this.recoveryDays = recoveryDays;
    this.weeklySets = weeklySets;
    Object.freeze(this);
  }
}

const MUSCLE_SEED = [
  //  id            name          family  min rec  sets/week
  ["chest",      "Chest",      "push", 20, 2, [8, 16]],
  ["shoulders",  "Shoulders",  "push", 15, 2, [6, 12]],
  ["triceps",    "Triceps",    "push", 15, 1, [4, 10]],
  ["traps",      "Traps",      "pull", 10, 1, [4, 8]],
  ["upper-back", "Upper Back", "pull", 20, 2, [8, 16]],
  ["lats",       "Lats",       "pull", 20, 2, [8, 16]],
  ["biceps",     "Biceps",     "pull", 15, 1, [4, 10]],
  ["forearms",   "Forearms",   "pull", 10, 1, [2, 6]],
  ["quads",      "Quads",      "legs", 25, 2, [8, 16]],
  ["hamstrings", "Hamstrings", "legs", 20, 2, [6, 12]],
  ["glutes",     "Glutes",     "legs", 20, 2, [6, 12]],
  ["adductors",  "Adductors",  "legs", 10, 1, [2, 6]],
  ["calves",     "Calves",     "legs", 10, 1, [4, 10]],
  ["abs",        "Abs",        "core", 15, 1, [4, 10]],
  ["obliques",   "Obliques",   "core", 10, 1, [2, 6]],
  ["lower-back", "Lower Back", "core", 10, 2, [2, 6]]
];

/** The one catalogue of muscles. Muscles are immutable and shared. */
const MUSCLES = Object.freeze(MUSCLE_SEED.map(s => new Muscle(...s)));
const MUSCLE_BY_ID = new Map(MUSCLES.map(m => [m.id, m]));

/** A set of muscles trained together in one session. Derived, disposable. */
class TrainingBlock {
  constructor(muscles) {
    this.muscles = muscles;
    this.family = muscles[0].family;
    this.riders = new Set();   // along for the ride: named, but no session time
    this.limit = Infinity;     // the session length, once the plan has set it (routine.js)
    this.name = null;          // a split day's name ("Upper", "Push"…), when the user chose a split
    this.plannedSets = null;   // Map muscle id -> sets, when distribution.js planned this day
  }
  get minutes() {
    if (this.plannedSets) {
      const work = this.muscles.reduce((t, m) => t + muscleSessionMinutes(this.plannedSets.get(m.id) || 0), 0);
      return Math.round(work + ESTIMATE.warmupMinutes);
    }
    return this.muscles.reduce((t, m) => t + (this.riders.has(m) ? 0 : m.minutes), 0);
  }
  /* A block planned longer than the session keeps the session's length. */
  get sessionMinutes() { return Math.min(this.minutes, this.limit); }
  /* The hours it takes on the calendar. A day of a split the user chose is
     filled to the session's length (WorkoutBuilder doses it by evidence up
     to its limit), so it books that, not its muscles' rough minutes. */
  get durationHours() {
    const minutes = this.name !== null && !this.plannedSets && Number.isFinite(this.limit) ? this.limit : this.sessionMinutes;
    return Math.max(1, Math.ceil(minutes / 60));
  }
  /** A day of a split the user chose (routine.js, SPLITS): dosed by evidence, not by time. */
  get splitDay() { return this.name !== null || this.plannedSets !== null; }
  get label() { return (this.name ? this.name + ": " : "") + this.muscles.map(m => m.name).join(" · "); }
  has(muscle) { return this.muscles.includes(muscle); }
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
    this.workout = null;       // the exercises, filled in by WorkoutBuilder
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
