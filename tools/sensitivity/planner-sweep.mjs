/* ===========================================================================
   Sweep of the weekly planner over many profiles, and a before/after table.

   Runs the app's own logic, unchanged, for 11 selections (the 13-muscle
   reference case and every program) x 1-7 days x 45/60/75/90 min x the three
   experience levels x four priority settings (all Maintain, all Normal, all
   Focus, and mixed: the first two Focus, the last two Maintain), and records
   per run: time used, sets, counted sets per muscle against its range and
   goal, trims, muscles without an exercise of their own, and what the audit
   reported.

   Usage:
     node tools/sensitivity/planner-sweep.mjs run <out.json> [root] [selections]
         root: a copy of the app to run (default: this repo), for example an
               older commit extracted with `git archive <ref> js tests index.html`
         selections: comma-separated (ref,full-body,upper,...); default all
     node tools/sensitivity/planner-sweep.mjs compare <before.json,...> <after.json,...>
         writes docs/sensitivity/planner-fill-table.md and planner-fill.csv
   One full run takes a few minutes; split it by selections if needed.
   =========================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const [mode, ...args] = process.argv.slice(2);

if (mode === "run") {
  const [outFile, root = ROOT, selections] = args;
  const { loadApp } = await import(pathToFileURL(path.join(path.resolve(root), "tests/load-app.js")).href);
  const app = loadApp();
  const only = selections ? selections.split(",") : null;
  const REF = ["shoulders","triceps","traps","upper-back","lats","biceps","forearms","quads","hamstrings","glutes","adductors","calves","lower-back"];
  const SELECTIONS = { ref: { muscles: REF }, ...Object.fromEntries(app.PROGRAMS.map(p => [p.id, { program: p.id }])) };
  const PRIOS = ["maintain", "normal", "focus", "mixed"];
  const EXP = ["beginner", "intermediate", "advanced"];

  const rows = [];
  const t0 = Date.now();
  for (const [sel, spec] of Object.entries(SELECTIONS)) {
    if (only && !only.includes(sel)) continue;
    for (const days of [1,2,3,4,5,6,7]) for (const minutes of [45,60,75,90]) for (const exp of EXP) for (const prio of PRIOS) {
      const r = new app.WeeklyRoutine();
      if (spec.program) r.selection.applyProgram(app.PROGRAM_BY_ID.get(spec.program));
      for (const id of spec.muscles || []) r.selection.set(id, true);
      const ids = r.selection.muscles().map(m => m.id);
      ids.forEach((id, i) => r.selection.setPriority(id, prio === "mixed" ? (i < 2 ? "focus" : i >= ids.length - 2 ? "maintain" : "normal") : prio));
      r.experience = exp; r.sessionsPerWeek = days; r.sessionMinutes = minutes; r.preferredWindow = "evening";
      const res = r.generate();
      const s = r.sessions;
      const used = s.reduce((t, x) => t + x.workout.minutes, 0);
      const over = s.filter(x => x.workout.minutes > minutes).length;
      const fit = r.weekFit();
      const audit = r.audit();
      const counted = id => s.reduce((t, x) => t + x.workout.directSets(id) + x.workout.assistedSets(id), 0);
      const ms = r.selection.muscles().filter(m => app.exercisesFor(m.id).length);
      const per = ms.map(m => {
        const c = counted(m.id), [lo, hi] = m.weeklySets;
        const requested = app.weeklyTarget(m, exp, r.selection.priority(m.id));
        const noEx = !s.some(x => x.workout.entries.some(e => e.exercise.primary.includes(m.id)));
        return { id: m.id, c, lo, hi, requested, target: fit.targets.get(m.id), below: Math.round(c) < lo, over: c > hi + 1e-9, noEx,
                 underRequested: c + 0.25 < requested };
      });
      const flagged = new Set(audit.issues.map(i => i.muscleId).filter(Boolean));
      rows.push({ sel, days, minutes, exp, prio, placed: s.length, used, avail: s.length * minutes,
        use: s.length ? used / (s.length * minutes) : null, over,
        sets: s.reduce((t, x) => t + x.workout.sets, 0),
        trimmed: fit.trimmed.length, belowMinFit: fit.belowMinimum.length,
        musclesBelowMin: per.filter(p => p.below).length,
        belowMinUnflagged: per.filter(p => p.below && !flagged.has(p.id)).length,
        musclesOverMax: per.filter(p => p.over).length,
        maxOverBy: Math.max(0, ...per.map(p => p.c - p.hi)),
        noExercise: per.filter(p => p.noEx).length, noExUnflagged: per.filter(p => p.noEx && !flagged.has(p.id)).length, noExIds: per.filter(p => p.noEx).map(p => p.id + (p.below ? "!" : "")),
        underRequested: per.filter(p => p.underRequested).length,
        slackWithUnder: s.length && per.some(p => p.underRequested) ? (s.length * minutes - used) : 0,
        lost: Object.fromEntries(Object.entries((r.planned?.events || []).reduce((a, e) => (a[e.reason] = (a[e.reason] || 0) + e.sets, a), {}))),
        short: (r.planned?.shortfalls || []).map(x => x.muscleId + ':' + x.reason + ':' + x.kind + ':' + (+x.sets.toFixed(1))),
        slackPerSession: s.map(x => minutes - x.workout.minutes),
        perMuscle: per.map(p => [p.id, +p.c.toFixed(1), p.lo, p.hi, p.requested, p.target])
      });
    }
  }
  fs.writeFileSync(outFile, JSON.stringify(rows));
  console.error("runs", rows.length, "ms", Date.now() - t0);
} else if (mode === "compare") {
  const load = list => list.split(",").flatMap(f => JSON.parse(fs.readFileSync(f)));
  const B = load(args[0]), A = load(args[1]);
  const key = r => [r.sel, r.days, r.minutes, r.exp, r.prio].join("|");
  const bmap = new Map(B.map(r => [key(r), r]));
  const pct = x => (100 * x).toFixed(1) + " %";
  const stats = rows => {
    const u = rows.filter(r => r.placed);
    const used = u.reduce((t, r) => t + r.used, 0), avail = u.reduce((t, r) => t + r.avail, 0);
    const pm = rows.flatMap(r => r.perMuscle.map(p => ({ c: p[1], lo: p[2], hi: p[3], req: p[4] })));
    return {
      runs: rows.length, use: pct(used / avail),
      p10: pct(u.map(r => r.use).sort((a, b) => a - b)[Math.floor(u.length * 0.1)]),
      idle: rows.filter(r => r.slackWithUnder >= 15 * r.placed).length,
      overLen: rows.filter(r => r.over).length,
      overMax: rows.filter(r => r.musclesOverMax).length,
      inRange: pct(pm.filter(p => Math.round(p.c) >= p.lo && p.c <= p.hi + 1e-9).length / pm.length),
      belowLo: pct(pm.filter(p => Math.round(p.c) < p.lo).length / pm.length),
      atGoal: pct(pm.filter(p => p.c + 0.25 >= p.req).length / pm.length),
      noEx: rows.filter(r => r.noExercise).length,
      unflagged: rows.filter(r => r.belowMinUnflagged || r.noExUnflagged).length,
      trimmed: rows.filter(r => r.trimmed).length,
      sessions: rows.reduce((t, r) => t + r.placed, 0)
    };
  };
  const cols = ["runs", "use", "p10", "idle", "overLen", "overMax", "inRange", "belowLo", "atGoal", "noEx", "unflagged", "trimmed", "sessions"];
  const head = "| grupo | " + cols.map(c => c).join(" | ") + " |\n|" + "---|".repeat(cols.length + 1);
  const line = (name, rows) => { const b = stats(rows.map(r => bmap.get(key(r)))), a = stats(rows);
    return "| " + name + " | " + cols.map(c => c === "runs" ? a[c] : b[c] + " → " + a[c]).join(" | ") + " |"; };
  let md = "### Todo el barrido\n\n" + head + "\n" + line("todos", A) + "\n";
  for (const k of ["minutes", "days", "exp", "prio", "sel"]) {
    md += "\n### Por " + k + "\n\n" + head + "\n";
    const groups = {}; for (const r of A) (groups[r[k]] ||= []).push(r);
    for (const [g, rows] of Object.entries(groups)) md += line(g, rows) + "\n";
  }
  fs.writeFileSync(path.join(ROOT, "docs/sensitivity/planner-fill-table.md"), md);
  // per-profile CSV
  const csv = ["selection,days,minutes,experience,priority,sessions_before,sessions_after,use_before,use_after,sets_before,sets_after,trimmed_before,trimmed_after,muscles_below_min_before,muscles_below_min_after,muscles_over_max_before,muscles_over_max_after,muscles_without_exercise_before,muscles_without_exercise_after,muscles_under_goal_before,muscles_under_goal_after,idle_minutes_with_work_after,muscles_after (id:counted/low-high/goal)"];
  for (const a of A) { const b = bmap.get(key(a)); const f = x => x == null ? "" : x.toFixed(3);
    csv.push([a.sel, a.days, a.minutes, a.exp, a.prio, b.placed, a.placed, f(b.use), f(a.use), b.sets, a.sets, b.trimmed, a.trimmed,
      b.musclesBelowMin, a.musclesBelowMin, b.musclesOverMax, a.musclesOverMax, b.noExercise, a.noExercise, b.underRequested, a.underRequested,
      a.slackWithUnder, '"' + a.perMuscle.map(p => p[0] + ":" + p[1] + "/" + p[2] + "-" + p[3] + "/" + p[4]).join(" ") + '"'].join(",")); }
  fs.writeFileSync(path.join(ROOT, "docs/sensitivity/planner-fill.csv"), csv.join("\n") + "\n");
  console.log(md);
} else {
  console.error("usage: planner-sweep.mjs run <out.json> [root] [selections] | compare <before> <after>");
  process.exit(1);
}
