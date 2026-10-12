// Investigación: "meta rebasada" (17 series de Enfoque contra una meta mostrada de 7).
// Estos tests DOCUMENTAN el comportamiento actual; no lo aprueban. Si se decide
// cambiar la regla, estos tests son los que deben cambiar a propósito.
import { describe, it, expect } from "vitest";
import { loadApp } from "./load-app.js";

function build({ focus = true } = {}) {
  const app = loadApp();
  const r = new app.WeeklyRoutine();
  for (const m of app.MUSCLES) r.selection.set(m.id, true);
  if (focus) for (const id of ["quads", "glutes"]) r.selection.setPriority(id, "focus");
  r.split = "full-body"; r.sessionsPerWeek = 3; r.sessionMinutes = 60; r.experience = "intermediate";
  r.generate();
  return r;
}

// Series propias (el músculo es el objetivo del ejercicio) vs. recibidas de ejercicios
// elegidos para otro músculo.
function origin(r, id) {
  let own = 0, side = 0;
  for (const s of r.sessions) for (const e of s.workout.entries) {
    if (e.muscleId === id) own += e.sets;
    else if (e.exercise.primary?.includes?.(id) || e.exercise.muscles?.primary?.includes?.(id)) side += e.sets;
  }
  return { own, side };
}

describe("meta rebasada en reparto elegido (full-body)", () => {
  it("reproduce: las series finales superan la meta mostrada por el ajuste de tiempo", () => {
    const r = build();
    const rows = r.audit().rows;
    for (const id of ["quads", "glutes"]) {
      const x = rows.find(w => w.muscle.id === id);
      expect(x.status).toBe("over");
      expect(x.finalDirectSets).toBeGreaterThan(x.targetSets);
    }
  });

  it("el ajuste de tiempo recorta la meta, pero el reparto elegido no la consulta", () => {
    const r = build();
    const fit = r.weekFit().targets;
    const rows = r.audit().rows;
    const q = rows.find(w => w.muscle.id === "quads");
    expect(q.targetSets).toBe(fit.get("quads"));
    expect(q.finalDirectSets).toBeGreaterThan(fit.get("quads"));
  });

  it("en reparto elegido el Enfoque ahora cuenta: nunca queda con menos series que sin Enfoque", () => {
    const con = build({ focus: true }), sin = build({ focus: false });
    const tot = (r, id) => r.audit().rows.find(w => w.muscle.id === id).finalTotalCredit;
    for (const id of ["quads", "glutes"]) expect(tot(con, id)).toBeGreaterThanOrEqual(tot(sin, id));
  });

  it("con poco tiempo, un músculo con Enfoque no queda por debajo de uno sin Enfoque", () => {
    const rows = build().audit().rows;
    const focusMin = Math.min(...rows.filter(r => r.priority === "focus").map(r => r.finalTotalCredit / r.muscle.weeklySets[0]));
    const others = rows.filter(r => r.priority !== "focus");
    expect(focusMin).toBeGreaterThanOrEqual(Math.min(...others.map(r => r.finalTotalCredit / r.muscle.weeklySets[0])));
  });

  it("el reparto automático sí respeta la meta ajustada (contraste)", () => {
    const app = loadApp();
    const r = new app.WeeklyRoutine();
    for (const m of app.MUSCLES) r.selection.set(m.id, true);
    for (const id of ["quads", "glutes"]) r.selection.setPriority(id, "focus");
    r.sessionsPerWeek = 3; r.sessionMinutes = 60; r.experience = "intermediate";
    r.generate();
    const x = r.audit().rows.find(w => w.muscle.id === "quads");
    expect(x.finalDirectSets).toBeLessThanOrEqual(x.targetSets + 1);
  });
});

describe("la explicación dice qué persiguió el constructor", () => {
  it("el reparto elegido se marca como punto medio del rango, el automático como meta ajustada", () => {
    const rows = build().audit().rows;
    expect(rows.every(r => r.basis === "split-priority")).toBe(true);
  });
  it("el texto de Enfoque describe lo que hizo el reparto elegido", () => {
    const app = loadApp();
    const r = new app.WeeklyRoutine();
    for (const m of app.MUSCLES) r.selection.set(m.id, true);
    for (const id of ["quads", "glutes"]) r.selection.setPriority(id, "focus");
    r.split = "full-body"; r.sessionsPerWeek = 3; r.sessionMinutes = 60; r.experience = "intermediate";
    r.generate();
    const text = app.weekReasons(r).join(" ");
    expect(text).toMatch(/does not shorten it to fit your time|aimed at the top/);
    expect(text).not.toMatch(/were lowered, never below/);
  });
});
