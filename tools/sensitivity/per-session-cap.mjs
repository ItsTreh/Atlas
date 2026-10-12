/* ===========================================================================
   Sensitivity of the weekly plan to the per-session set cap
   (WORKOUT.maxSetsPerSession, default 8).

   Runs the app's own logic, unchanged, for each profile in profiles.json at
   several cap values and prints one row per run. Nothing in the app is edited:
   the cap is substituted in the source text of workouts.js as it is loaded,
   in a throwaway vm context, exactly where it is read (configValue).

   Usage:  node tools/sensitivity/per-session-cap.mjs [caps...]   (default 8 10 11)
   Writes: docs/sensitivity/per-session-cap.csv and .md
   =========================================================================== */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { logicScripts } from "../../tests/load-app.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CAPS = process.argv.slice(2).map(Number).filter(Boolean);
if (!CAPS.length) CAPS.push(8, 10, 11);
const KEY = 'configValue("maxSetsPerSession")';

function load(cap) {
  const context = vm.createContext({ console: { ...console, error: () => {} } });
  for (const src of logicScripts()) {
    let code = fs.readFileSync(path.join(ROOT, src), "utf8");
    if (path.basename(src) === "workouts.js") {
      if (!code.includes(KEY)) throw new Error("workouts.js no longer reads " + KEY);
      code = code.replace(KEY, String(cap));
    }
    vm.runInContext(code, context, { filename: src });
  }
  return vm.runInContext("({ WeeklyRoutine, PROGRAM_BY_ID, MUSCLES, WORKOUT })", context);
}

const round = n => Math.round(n * 10) / 10;

function run(app, p) {
  const r = new app.WeeklyRoutine();
  if (p.program) r.selection.applyProgram(app.PROGRAM_BY_ID.get(p.program));
  const ids = p.muscles === "all" ? app.MUSCLES.map(m => m.id) : p.muscles || [];
  for (const id of ids) r.selection.set(id, true);
  for (const id of p.focus) r.selection.setPriority(id, "focus");
  r.split = p.split;
  r.sessionsPerWeek = p.sessions;
  r.sessionMinutes = p.minutes;
  for (const d of p.offDays || []) r.offDays.add(d);
  r.experience = p.experience;
  r.generate();
  const audit = r.audit();
  const mins = r.sessions.map(s => s.workout.minutes);
  const focus = audit.rows.filter(x => x.priority === "focus");
  const cap = audit.rows.filter(x => x.causes.some(c => c.reason === "session-capacity"));
  const capSets = audit.rows.reduce((t, x) => t + (x.causes.find(c => c.reason === "session-capacity")?.sets || 0), 0);
  let maxDirect = 0;
  for (const s of r.sessions) for (const m of app.MUSCLES) maxDirect = Math.max(maxDirect, s.workout.directSets(m.id));
  return {
    sessions: r.sessions.length, asked: p.sessions,
    maxMin: mins.length ? Math.max(...mins) : 0,
    meanMin: mins.length ? round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0,
    totalMin: round(mins.reduce((a, b) => a + b, 0)),
    focusSets: round(focus.reduce((t, x) => t + x.finalTotalCredit, 0)),
    focusTarget: focus.reduce((t, x) => t + x.targetSets, 0),
    focusShort: round(focus.reduce((t, x) => t + Math.max(0, x.targetSets - x.finalTotalCredit), 0)),
    capMuscles: cap.length, capSets: round(capSets),
    missing: audit.rows.filter(x => x.finalTotalCredit === 0).length,
    belowMin: audit.rows.filter(x => x.belowMinimum).length,
    maxDirectInSession: round(maxDirect),
    issues: audit.issues.length
  };
}

const profiles = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/sensitivity/profiles.json"), "utf8"));
const rows = [];
for (const cap of CAPS) {
  const app = load(cap);
  for (const p of profiles) rows.push({ profile: p.name, cap, ...run(app, p) });
}

const cols = Object.keys(rows[0]);
const csv = [cols.join(","), ...rows.map(r => cols.map(c => r[c]).join(","))].join("\n") + "\n";
const md = "| " + cols.join(" | ") + " |\n|" + cols.map(() => "---").join("|") + "|\n" +
  rows.map(r => "| " + cols.map(c => r[c]).join(" | ") + " |").join("\n") + "\n";
const out = path.join(ROOT, "docs/sensitivity");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "per-session-cap.csv"), csv);
fs.writeFileSync(path.join(out, "per-session-cap-table.md"), md);
console.log(md);
