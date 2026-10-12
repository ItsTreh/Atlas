/* The evidence and configuration registry: every number the planner uses is
   labelled with where it comes from, and nothing is passed off as evidence. */
import { describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp();
const cfg = Object.entries(app.PLANNER_CONFIG);
const tables = Object.entries(app.PLANNER_TABLES);

describe("evidence findings", () => {
  test("loading the data logs no errors", () => {
    expect(app.errors).toEqual([]);
  });
  test("each finding has sources, a certainty and a review date", () => {
    expect(app.EVIDENCE.length).toBeGreaterThan(0);
    for (const e of app.EVIDENCE) {
      expect(app.CERTAINTY).toContain(e.certainty);
      expect(e.sources.length).toBeGreaterThan(0);
      for (const s of e.sources) expect(s.url).toMatch(/^https:\/\//);
      expect(e.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.limits.length).toBeGreaterThan(0);
    }
  });
  test("ids are unique", () => {
    expect(new Set(app.EVIDENCE.map(e => e.id)).size).toBe(app.EVIDENCE.length);
  });
});

describe("pending verification", () => {
  const marks = text => [...text.matchAll(/PENDIENTE-VERIFICAR \((V\d+)\)/g)].map(m => m[1]);
  const textOf = e => [e.finding, e.limits, e.population || "", e.studyType || "",
    ...e.sources.map(s => s.label)].join(" ");

  test("every open check is marked in the text and every mark is a listed check", () => {
    for (const e of app.EVIDENCE) {
      const listed = new Set(e.pending || []);
      const marked = new Set(marks(textOf(e)));
      for (const id of listed) expect(marked.has(id), e.id + " " + id).toBe(true);
      for (const id of marked) expect(listed.has(id), e.id + " marks " + id + " without listing it").toBe(true);
    }
  });
  test("the volume findings carry the checks still open", () => {
    expect(app.EVIDENCE_BY_ID.get("weekly-volume").pending).toContain("V1");
    expect(app.EVIDENCE_BY_ID.get("indirect-set-counting").pending).toEqual(["V1"]);   // V4 closed 2026-10-11
    expect(app.EVIDENCE_BY_ID.get("per-session-volume").pending).toEqual(expect.arrayContaining(["V2", "V3"]));
  });
  test("the published meta-regression is the main source, the preprint a secondary one", () => {
    for (const id of ["weekly-volume", "indirect-set-counting"]) {
      const urls = app.EVIDENCE_BY_ID.get(id).sources.map(s => s.url);
      expect(urls).toContain("https://doi.org/10.1007/s40279-025-02344-w");
      expect(urls.indexOf("https://doi.org/10.1007/s40279-025-02344-w"))
        .toBeLessThan(urls.indexOf("https://sportrxiv.org/index.php/server/preprint/view/460"));
    }
  });
  test("what is unverified is not presented as evidence", () => {
    for (const key of ["secondaryCredit", "maxSetsPerSession", "indirectRecoveryFraction"])
      expect(app.PLANNER_CONFIG[key].origin, key).toBe("heuristic");
    expect(app.PLANNER_CONFIG.maxSetsPerSession.basedOn).toContain("per-session-volume");
    expect(app.PLANNER_CONFIG.secondaryCredit.note).toMatch(/PENDIENTE-VERIFICAR \(V1\)/);
  });
  test("the recovery fraction says it is not backed by the volume evidence", () => {
    expect(app.PLANNER_CONFIG.indirectRecoveryFraction.note).toMatch(/not set-counting|not a set-counting/);
  });
});

describe("planner configuration", () => {
  test("every entry has an origin, a note and existing evidence ids", () => {
    for (const [key, c] of [...cfg, ...tables]) {
      expect(app.ORIGINS, key).toContain(c.origin);
      expect(c.note.length, key).toBeGreaterThan(0);
      for (const id of c.basedOn) expect(app.EVIDENCE_BY_ID.has(id), key).toBe(true);
      if (c.origin === "evidence") expect(c.basedOn.length, key).toBeGreaterThan(0);
    }
  });
  test("WORKOUT and ESTIMATE hold exactly the registered values", () => {
    for (const [group, obj] of [["workout", app.WORKOUT], ["estimate", app.ESTIMATE]]) {
      const keys = cfg.filter(([, c]) => c.group === group).map(([k]) => k).sort();
      expect(Object.keys(obj).sort()).toEqual(keys);
      for (const k of keys) expect(obj[k]).toBe(app.PLANNER_CONFIG[k].value);
    }
  });
  test("the per-session set cap is not presented as evidence", () => {
    expect(app.PLANNER_CONFIG.maxSetsPerSession.origin).not.toBe("evidence");
  });
  test("an unknown key is an error", () => {
    expect(() => app.configValue("nope")).toThrow();
  });
});
