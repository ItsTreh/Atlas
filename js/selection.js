/* ===========================================================================
   MuscleSelection — which muscles the user wants to train.

   This is the hand-off point between the Targets stage and everything after
   it. It knows nothing about the page: the anatomy figure, the program list
   and the summary all write to it and redraw when it tells them to, and the
   schedule, training and diet systems read from it.

     selection.muscles()   the chosen Muscle objects, in catalogue order
     selection.snapshot()  a plain, serialisable description of the choice
     selection.onChange()  subscribe to every change

   It also remembers which program the selection started from, so that
   "Push, then add Abs" can be shown as a modified Push rather than as an
   anonymous list of four muscles.
   ========================================================================= */

/* How much a chosen muscle matters to this user. "normal" is the default and
   is never stored; the other two are the user's explicit statement. */
const PRIORITY_LEVELS = Object.freeze(["maintain", "normal", "focus"]);

class MuscleSelection {
  /** @param catalog  the Muscle objects that may be selected */
  constructor(catalog) {
    this.catalog = catalog;
    this.ids = new Set();
    this.basedOn = null;          // the Program last applied, if any
    this.priorities = new Map();  // id -> "maintain" | "focus"; absent means "normal"
    this.listeners = [];
  }

  /* ------------------------------- reading ------------------------------- */

  has(id) { return this.ids.has(id); }
  get size() { return this.ids.size; }
  isEmpty() { return this.ids.size === 0; }

  /** "maintain", "normal" or "focus" for a muscle (normal when not set). */
  priority(id) { return this.priorities.get(id) || "normal"; }

  /** The selected muscles, in catalogue order (not the order they were clicked). */
  muscles() { return this.catalog.filter(m => this.ids.has(m.id)); }

  /** The program this selection is exactly equal to, whatever route led here. */
  matchingProgram(programs = PROGRAMS) {
    return programs.find(p => p.muscles.length === this.ids.size &&
                              p.muscles.every(id => this.ids.has(id))) || null;
  }

  /**
   * Where the selection came from:
   *   { kind: "program",  program }                    exactly a program
   *   { kind: "modified", program, added, removed }    a program, then edited
   *   { kind: "custom" }  or  { kind: "empty" }
   * `added` and `removed` are Muscle arrays relative to the program.
   */
  source(programs = PROGRAMS) {
    if (this.isEmpty()) return { kind: "empty" };
    const exact = this.matchingProgram(programs);
    if (exact) return { kind: "program", program: exact };
    if (this.basedOn) {
      const base = new Set(this.basedOn.muscles);
      return {
        kind: "modified", program: this.basedOn,
        added:   this.catalog.filter(m => this.ids.has(m.id) && !base.has(m.id)),
        removed: this.catalog.filter(m => base.has(m.id) && !this.ids.has(m.id))
      };
    }
    return { kind: "custom" };
  }

  /**
   * A plain object describing the choice, safe to store or pass to another
   * system without handing it this live, mutable object.
   */
  snapshot() {
    const src = this.source();
    return {
      muscleIds: this.muscles().map(m => m.id),
      programId: src.program ? src.program.id : null,
      modified:  src.kind === "modified",
      priorities: Object.fromEntries(
        this.muscles().filter(m => this.priorities.has(m.id))
                      .map(m => [m.id, this.priorities.get(m.id)]))
    };
  }

  /* ------------------------------- editing ------------------------------- */

  toggle(id) { this.set(id, !this.has(id)); }

  set(id, on) {
    if (!this.catalog.some(m => m.id === id)) throw new Error("Unknown muscle: " + id);
    if (on === this.has(id)) return;
    if (on) this.ids.add(id); else { this.ids.delete(id); this.priorities.delete(id); }
    if (this.isEmpty()) this.basedOn = null;
    this.emit();
  }

  /** Sets how much a selected muscle matters: "maintain", "normal" or "focus". */
  setPriority(id, level) {
    if (!PRIORITY_LEVELS.includes(level)) throw new Error("Unknown priority: " + level);
    if (!this.has(id)) throw new Error("Not selected: " + id);
    if (level === this.priority(id)) return;
    if (level === "normal") this.priorities.delete(id); else this.priorities.set(id, level);
    this.emit();
  }

  /** Replaces the selection with the program's muscles. */
  applyProgram(program) {
    this.ids = new Set(program.muscles);
    this.priorities = new Map();
    this.basedOn = program;
    this.emit();
  }

  /** Restores a snapshot(). Unknown ids are dropped rather than trusted. */
  restore(snap) {
    const known = new Set(this.catalog.map(m => m.id));
    this.ids = new Set((snap.muscleIds || []).filter(id => known.has(id)));
    this.basedOn = (snap.programId && PROGRAM_BY_ID.get(snap.programId)) || null;
    this.priorities = new Map(Object.entries(snap.priorities || {})
      .filter(([id, level]) => this.ids.has(id) && (level === "maintain" || level === "focus")));
    if (this.isEmpty()) this.basedOn = null;
    this.emit();
  }

  clear() {
    if (this.isEmpty() && !this.basedOn) return;
    this.ids.clear();
    this.priorities.clear();
    this.basedOn = null;
    this.emit();
  }

  /* ------------------------------ observing ------------------------------ */

  /** Calls `fn(selection)` after every change. Returns an unsubscribe function. */
  onChange(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }
  emit() { for (const fn of this.listeners) fn(this); }
}
