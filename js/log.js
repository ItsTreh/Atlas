/* ===========================================================================
   Training log — the data the app will need to learn from what you did.

   Data only: there is no screen for it yet. It is shaped now so that plans
   saved today keep working when the logging screen arrives.

     SetLog       one set: load (kg), reps, reps in reserve, how hard it felt,
                  and whether it was done.
     ExerciseLog  the sets of one exercise in one session.
     SessionLog   one session on one date; compliance is sets done over sets
                  planned.
     TrainingLog  the sessions, saved with the routine (routine.snapshot()).
     ExercisePreferences
                  exercises the user dropped, and why. "dislike" only ranks the
                  exercise lower; "cannot" (injury, no equipment) keeps it out
                  until the user changes their mind. Dropping for preference
                  never removes an exercise for good.

   Everything read back from storage is cleaned field by field, so a damaged
   or older save loses at most the bad value, never the whole log.
   ========================================================================= */

const SET_DIFFICULTY = Object.freeze([
  { id: "easy",   label: "Easy" },
  { id: "right",  label: "Just right" },
  { id: "hard",   label: "Hard" },
  { id: "failed", label: "Could not finish the reps" }
]);

const DISCARD_REASONS = Object.freeze([
  { id: "dislike", label: "I don't like it" },
  { id: "cannot",  label: "I can't do it" }
]);

const MAX_LOAD_KG = 1000, MAX_REPS = 200, MAX_RESERVE = 10;

const inRange = (v, max) => {
  const n = typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};

class SetLog {
  constructor({ load = null, reps = null, reserve = null, difficulty = null, done = false } = {}) {
    this.load = inRange(load, MAX_LOAD_KG);                      // kg
    this.reps = inRange(reps, MAX_REPS) === null ? null : Math.round(reps);
    this.reserve = inRange(reserve, MAX_RESERVE) === null ? null : Math.round(reserve);   // reps in reserve
    this.difficulty = SET_DIFFICULTY.some(d => d.id === difficulty) ? difficulty : null;
    this.done = done === true;
  }
  snapshot() {
    return { load: this.load, reps: this.reps, reserve: this.reserve, difficulty: this.difficulty, done: this.done };
  }
}

class ExerciseLog {
  constructor(exerciseId, muscleId, sets = []) {
    this.exerciseId = exerciseId; this.muscleId = muscleId;
    this.sets = sets.map(s => s instanceof SetLog ? s : new SetLog(s));
  }
  get plannedSets() { return this.sets.length; }
  get doneSets() { return this.sets.filter(s => s.done).length; }
  snapshot() {
    return { exerciseId: this.exerciseId, muscleId: this.muscleId, sets: this.sets.map(s => s.snapshot()) };
  }
}

const isoDate = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
                     !Number.isNaN(Date.parse(v)) ? v : null;

class SessionLog {
  /** @param date  "YYYY-MM-DD" */
  constructor({ date, day = null, label = "", minutes = null, entries = [] } = {}) {
    this.date = isoDate(date);
    this.day = DayOfWeek.values.includes(day) ? day : null;
    this.label = String(label).slice(0, 80);
    this.minutes = inRange(minutes, 600);                        // how long it really took
    this.entries = entries.map(e => e instanceof ExerciseLog ? e : new ExerciseLog(e.exerciseId, e.muscleId, e.sets || []));
  }
  get plannedSets() { return this.entries.reduce((t, e) => t + e.plannedSets, 0); }
  get doneSets() { return this.entries.reduce((t, e) => t + e.doneSets, 0); }
  /** Sets done over sets planned, 0 to 1; null when nothing was planned. */
  get compliance() { return this.plannedSets ? this.doneSets / this.plannedSets : null; }
  snapshot() {
    return { date: this.date, day: this.day, label: this.label, minutes: this.minutes,
             entries: this.entries.map(e => e.snapshot()) };
  }
}

/** A blank log for a planned session: every planned set, not yet done. */
function logForSession(session, date) {
  return new SessionLog({
    date, day: session.day, label: session.block.label,
    entries: session.workout.entries.map(e =>
      new ExerciseLog(e.exercise.id, e.muscleId, Array.from({ length: e.sets }, () => new SetLog())))
  });
}

class TrainingLog {
  constructor() { this.sessions = []; }
  add(session) { this.sessions.push(session); return session; }
  /** Every logged set of an exercise, oldest first, with its date. */
  history(exerciseId) {
    return this.sessions.flatMap(s => s.entries.filter(e => e.exerciseId === exerciseId)
      .flatMap(e => e.sets.filter(x => x.done).map(set => ({ date: s.date, set }))))
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }
  /** Sets done over sets planned across the sessions between two dates (inclusive); null if none planned. */
  compliance(from, to) {
    const within = this.sessions.filter(s => s.date && s.date >= from && s.date <= to);
    const planned = within.reduce((t, s) => t + s.plannedSets, 0);
    return planned ? within.reduce((t, s) => t + s.doneSets, 0) / planned : null;
  }
  snapshot() { return { version: 1, sessions: this.sessions.map(s => s.snapshot()) }; }
  restore(snap) {
    this.sessions = [];
    for (const s of (snap && Array.isArray(snap.sessions) ? snap.sessions : [])) {
      if (!s || typeof s !== "object" || !isoDate(s.date)) continue;
      const entries = (Array.isArray(s.entries) ? s.entries : [])
        .filter(e => e && typeof e.exerciseId === "string" && EXERCISE_BY_ID.has(e.exerciseId) &&
                     MUSCLE_BY_ID.has(e.muscleId))
        .map(e => new ExerciseLog(e.exerciseId, e.muscleId, Array.isArray(e.sets) ? e.sets : []));
      this.sessions.push(new SessionLog({ ...s, entries }));
    }
  }
}

class ExercisePreferences {
  constructor() { this.reasons = new Map(); }       // exercise id → reason id
  reasonFor(exerciseId) { return this.reasons.get(exerciseId) || null; }
  discard(exerciseId, reason) {
    if (!EXERCISE_BY_ID.has(exerciseId) || !DISCARD_REASONS.some(r => r.id === reason)) return false;
    this.reasons.set(exerciseId, reason);
    return true;
  }
  /** Back in play. */
  clear(exerciseId) { return this.reasons.delete(exerciseId); }
  snapshot() { return Object.fromEntries(this.reasons); }
  restore(snap) {
    this.reasons = new Map();
    if (!snap || typeof snap !== "object") return;
    for (const [id, reason] of Object.entries(snap)) this.discard(id, reason);
  }
}
