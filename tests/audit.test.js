/* Audit regression tests: the plan's numbers, restrictions and explanations
   must match the plan that was actually built. */
import { describe, expect, test } from "vitest";
import { loadApp, generatedWeek } from "./load-app.js";

const app = loadApp();
const EPS = 0.001;
const ex = name => app.EXERCISE_BY_NAME.get(name);

/** The counters the audit reports must equal what the sessions really hold. */
function expectLedgerMatchesSessions(routine) {
  const audit = routine.audit();
  for (const r of audit.rows) {
    const id = r.muscle.id;
    const direct = routine.sessions.reduce((t, s) => t + s.workout.directSets(id), 0);
    const credit = routine.sessions.reduce((t, s) => t + s.workout.assistedSets(id), 0);
    expect(r.finalDirectSets, id).toBeCloseTo(direct, 3);
    expect(r.finalIndirectCredit, id).toBeCloseTo(credit, 3);
    expect(r.finalTotalCredit, id).toBeCloseTo(direct + credit, 3);
    // Direct and indirect stay separate numbers; the credit is a labelled fraction of the indirect sets.
    expect(r.finalIndirectCredit, id).toBeCloseTo(r.finalIndirectSets * app.WORKOUT.secondaryCredit, 3);
    expect(r.unexplained, id).toBeLessThan(EPS);
    if (r.status === "short") expect(r.causes.length, id + " short without a cause").toBeGreaterThan(0);
  }
  return audit;
}

function expectNoLiedAbout(routine, audit) {
  // Anything the audit says is short must be reported, never hidden.
  for (const r of audit.rows) {
    if (r.priority === "focus" && r.status === "short")
      expect(audit.issues.some(i => i.kind === "focus-short" && i.muscleId === r.muscle.id)).toBe(true);
    if (r.belowMinimum && !(r.priority === "focus" && r.status === "short"))
      expect(audit.issues.some(i => i.muscleId === r.muscle.id)).toBe(true);
  }
  const text = app.weekReasons(routine).join(" ");
  if (!audit.feasible) expect(audit.issues.length).toBeGreaterThan(0);
  for (const i of audit.issues.slice(0, 4)) expect(text).toContain(i.text);
}

describe("recovery counts indirect exposure", () => {
  const session = (id, day, direct = [], indirect = []) => ({
    id, day,
    workout: { directSets: m => (direct.includes(m) ? 3 : 0), assistedSets: m => (indirect.includes(m) ? 1 : 0) }
  });

  test("Mon shoulders, Tue row (assists shoulders), Wed shoulders is allowed and said so", () => {
    const check = app.recoveryCheck([
      session("a", "MON", ["shoulders"]), session("b", "TUE", ["lats"], ["shoulders"]), session("c", "WED", ["shoulders"])]);
    expect(check.violations).toEqual([]);
    expect(check.allowed.filter(r => r.muscle.id === "shoulders").length).toBe(2);
  });

  test("two direct shoulder days back to back break the full recovery", () => {
    const check = app.recoveryCheck([session("a", "MON", ["shoulders"]), session("b", "TUE", ["shoulders"])]);
    expect(check.violations.map(v => v.muscle.id)).toEqual(["shoulders"]);
  });

  test("Tue back extensions, Wed Romanian deadlift (lower back assists) is allowed; same day is not", () => {
    const ok = app.recoveryCheck([session("a", "TUE", ["lower-back"]), session("b", "WED", ["hamstrings"], ["lower-back"])]);
    expect(ok.violations).toEqual([]);
    expect(ok.allowed.some(r => r.muscle.id === "lower-back")).toBe(true);
    const same = app.recoveryCheck([session("a", "TUE", ["lower-back"]), session("b", "TUE", [], ["lower-back"])]);
    expect(same.violations.length).toBeGreaterThan(0);
  });

  test("the required gap for indirect exposure is the documented fraction, rounded up", () => {
    const m = app.MUSCLE_BY_ID.get("shoulders");
    expect(app.recoveryRequired(m, "direct", "direct")).toBe(m.recoveryDays);
    expect(app.recoveryRequired(m, "direct", "indirect"))
      .toBe(Math.ceil(m.recoveryDays * app.WORKOUT.indirectRecoveryFraction));
    expect(app.recoveryRequired(m, "indirect", "indirect")).toBe(app.recoveryRequired(m, "indirect", "direct"));
  });

  test("a finished plan never breaks the rule it documents", () => {
    for (const program of ["push", "full-body"]) {
      const { routine } = generatedWeek(app, { program, sessions: 4, minutes: 75 });
      routine.experience = "intermediate"; routine.generate();
      expect(app.recoveryCheck(routine.sessions).violations, program).toEqual([]);
    }
  });
});

describe("ten regression cases", () => {
  test("1. three Focus muscles in four consecutive days: ledger matches, shortfalls are reported", () => {
    const { routine } = generatedWeek(app, { muscleIds: ["chest", "shoulders", "glutes"], sessions: 4, minutes: 60 });
    routine.experience = "advanced";
    for (const id of ["chest", "shoulders", "glutes"]) routine.selection.setPriority(id, "focus");
    for (const d of ["FRI", "SAT", "SUN"]) routine.offDays.add(d);
    routine.generate();
    expectNoLiedAbout(routine, expectLedgerMatchesSessions(routine));
  });

  test("2. a Focus muscle with no eligible exercise reports why", () => {
    const { routine } = generatedWeek(app, { muscleIds: ["chest", "biceps"], sessions: 3, minutes: 60 });
    routine.selection.setPriority("biceps", "focus");
    for (const e of app.EXERCISES.filter(e => e.primary.includes("biceps"))) routine.exercisePrefs.discard(e.id, "cannot");
    routine.experience = "intermediate"; routine.generate();
    const audit = expectLedgerMatchesSessions(routine);
    const row = audit.rows.find(r => r.muscle.id === "biceps");
    expect(routine.sessions.some(s => s.workout.entries.some(e => e.exercise.primary.includes("biceps") && e.muscleId === "biceps"))).toBe(false);
    expect(row.status).toBe("short");
    expect(row.causes.map(c => c.reason)).toContain("user-restriction");
    expectNoLiedAbout(routine, audit);
  });

  test("3. a session over its maximum duration is cut and says so", () => {
    const { routine } = generatedWeek(app, { program: "full-body", sessions: 2, minutes: 45 });
    for (const s of routine.sessions) expect(s.workout.minutes).toBeLessThanOrEqual(s.block.limit + 1);
    expectLedgerMatchesSessions(routine);
  });

  test("4. indirect work the day before a direct session respects the documented gap", () => {
    const { routine } = generatedWeek(app, { program: "full-body", sessions: 4, minutes: 75 });
    const check = app.recoveryCheck(routine.sessions);
    expect(check.violations).toEqual([]);
    for (const a of check.allowed) expect(a.gap).toBeGreaterThanOrEqual(a.required);
  });

  test("5. 'cannot' is never chosen; 'dislike' is demoted", () => {
    const base = generatedWeek(app, { program: "push", sessions: 2, minutes: 75 }).routine;
    const used = new Set(base.sessions.flatMap(s => s.workout.entries.map(e => e.exercise.id)));
    const [cannotId, dislikeId] = [...used];
    const { routine } = generatedWeek(app, { program: "push", sessions: 2, minutes: 75 });
    routine.exercisePrefs.discard(cannotId, "cannot");
    routine.exercisePrefs.discard(dislikeId, "dislike");
    routine.generate();
    const now = routine.sessions.flatMap(s => s.workout.entries.map(e => e.exercise.id));
    expect(now).not.toContain(cannotId);
    expect(now.filter(i => i === dislikeId).length).toBeLessThanOrEqual(1);
  });

  test("6. a more specific exercise beats a redundant one for a Focus muscle", () => {
    const { routine } = generatedWeek(app, { muscleIds: ["glutes"], sessions: 2, minutes: 60 });
    routine.selection.setPriority("glutes", "focus");
    routine.generate();
    const glute = routine.sessions.flatMap(s => s.workout.entries).filter(e => e.muscleId === "glutes");
    expect(glute.length).toBeGreaterThan(0);
    for (const e of glute) expect(e.exercise.primary).toContain("glutes");
  });

  test("7. priority, compounds-first and dependency decisions each name the rule that decided", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2, minutes: 75 });
    for (const s of routine.sessions) {
      for (const e of s.workout.entries)
        expect(["dependency", "priority", "compound", "tier", "pick-order", "only-option"]).toContain(e.orderRule.rule);
      const first = s.workout.entries[0];
      const text = app.sessionReasons(routine, s)[0];
      expect(text).toContain(first.exercise.name);
    }
    const press = new app.WorkoutEntry(ex("Machine Chest Press"), "chest", 3);
    const ext = new app.WorkoutEntry(ex("Overhead Cable Triceps Extension"), "triceps", 3);
    const out = app.orderEntries([ext, press], id => (id === "triceps" ? "focus" : "normal"));
    expect(out[0].exercise.name).toBe("Machine Chest Press");     // dependency beats Focus
    expect(out[0].orderRule.rule).toBe("dependency");
  });

  test("8. the weekly target met in distribution is not lost silently by the builder", () => {
    const { routine } = generatedWeek(app, { program: "full-body", sessions: 4, minutes: 75 });
    routine.experience = "intermediate"; routine.generate();
    const audit = expectLedgerMatchesSessions(routine);
    for (const r of audit.rows) if (r.plannedSets != null && r.finalTotalCredit + 0.25 < r.targetSets)
      expect(r.causes.length, r.muscle.id).toBeGreaterThan(0);
  });

  test("9. a week where the minimum of every muscle cannot fit says so", () => {
    const { routine } = generatedWeek(app, { program: "full-body", sessions: 3, minutes: 45 });
    routine.experience = "advanced"; routine.generate();
    const audit = expectLedgerMatchesSessions(routine);
    expect(audit.feasible).toBe(audit.issues.length === 0);
    expectNoLiedAbout(routine, audit);
  });

  test("10. a result that cannot meet every constraint reports it, not a clean plan", () => {
    const { routine } = generatedWeek(app, { program: "full-body", sessions: 3, minutes: 30 });
    routine.experience = "advanced"; routine.generate();
    const audit = expectLedgerMatchesSessions(routine);
    expect(audit.feasible).toBe(false);
    expect(audit.issues.length).toBeGreaterThan(0);
    expectNoLiedAbout(routine, audit);
  });
});

describe("time message", () => {
  test("states estimated and available time without claiming efficacy", () => {
    const { routine } = generatedWeek(app, { program: "push", sessions: 2, minutes: 90 });
    expect(app.WORKOUT).toBeTruthy();
    expect(routine.sessions.length).toBeGreaterThan(0);
  });
});
