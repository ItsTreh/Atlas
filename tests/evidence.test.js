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
